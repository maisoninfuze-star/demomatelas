/* ============================================================
   Compte client (Vercel serverless)

   Le compte se crée tout seul au moment de l'achat : api/webhook.js
   pousse la commande dans GoHighLevel, qui devient la fiche client.
   Ce point d'entrée sert l'autre moitié — permettre au client de
   revenir voir ses commandes.

   AUCUNE BASE DE DONNÉES, AUCUN MOT DE PASSE STOCKÉ.
     · Les commandes vivent déjà chez Stripe, rattachées à un Customer
       créé à la caisse. Stripe EST le registre des commandes.
     · L'identité se prouve par un lien signé envoyé au courriel du
       client. Un jeton HMAC porte le courriel et une échéance ; rien
       n'est conservé de notre côté, donc il n'y a pas de table de mots
       de passe à protéger, à réinitialiser, ni à se faire voler.
     · C'est GoHighLevel qui envoie le courriel — le site n'a pas besoin
       d'un service d'envoi de plus.

   DEUX MODES
     POST  { courriel }   → émet un lien d'accès (réponse toujours
                            identique, qu'un compte existe ou non)
     GET   ?t=<jeton>     → vérifie le jeton, renvoie les commandes

   VARIABLES D'ENVIRONNEMENT
     STRIPE_SECRET_KEY   déjà présente
     COMPTE_SECRET       chaîne longue et aléatoire — signe les jetons.
                         La changer invalide tous les liens en circulation.
     GHL_WEBHOOK_URL     déjà présente — sert ici à faire envoyer le
                         courriel par un workflow GoHighLevel
     SITE_URL            racine publique, pour bâtir le lien
   ============================================================ */
import Stripe from "stripe";
import crypto from "node:crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const JOURS_VALIDITE = 14;
const b64 = (s) => Buffer.from(s).toString("base64url");
const deb64 = (s) => Buffer.from(s, "base64url").toString("utf8");

function signer(charge) {
  return crypto.createHmac("sha256", process.env.COMPTE_SECRET).update(charge).digest("base64url");
}

function emettre(courriel) {
  const exp = Date.now() + JOURS_VALIDITE * 86400000;
  const charge = b64(JSON.stringify({ e: courriel.toLowerCase(), x: exp }));
  return charge + "." + signer(charge);
}

/* Comparaison à temps constant : comparer deux signatures avec === laisse
   fuir, par le temps de réponse, combien de caractères sont justes. */
function verifier(jeton) {
  if (typeof jeton !== "string" || !jeton.includes(".")) return null;
  const [charge, sig] = jeton.split(".");
  const attendue = signer(charge);
  const a = Buffer.from(sig || "", "utf8");
  const b = Buffer.from(attendue, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let d;
  try { d = JSON.parse(deb64(charge)); } catch { return null; }
  if (!d || !d.e || !d.x || Date.now() > d.x) return null;
  return d.e;
}

const propre = (v, max = 200) =>
  String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);

async function commandesDe(courriel) {
  // Un même courriel peut avoir plusieurs Customers (une par commande si
  // la caisse en recrée) : on les parcourt tous plutôt que le premier.
  const clients = await stripe.customers.list({ email: courriel, limit: 20 });
  const out = [];
  for (const c of clients.data) {
    const sessions = await stripe.checkout.sessions.list({ customer: c.id, limit: 50 });
    for (const s of sessions.data) {
      if (s.payment_status !== "paid") continue;
      const m = s.metadata || {};
      let articles = [];
      try {
        const li = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100 });
        articles = li.data.map((x) => ({ nom: x.description, q: x.quantity, total: (x.amount_total || 0) / 100 }));
      } catch { /* la commande reste affichable sans son détail */ }
      out.push({
        commande: m.commande || s.client_reference_id || "",
        date: new Date((s.created || 0) * 1000).toISOString(),
        total: (s.amount_total || 0) / 100,
        devise: (s.currency || "cad").toUpperCase(),
        mode: m.mode || "",
        adresse: m.adresse || "",
        delai: m.delai || "",
        souhait: m.souhait || "",
        articles,
      });
    }
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

export default async function handler(req, res) {
  if (!process.env.COMPTE_SECRET) {
    console.error("[compte] COMPTE_SECRET absente");
    return res.status(500).json({ erreur: "config" });
  }

  /* ---------- Demander un lien d'accès ---------- */
  if (req.method === "POST") {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const courriel = propre(body.courriel, 254).toLowerCase();
    // Validation volontairement souple : on ne cherche pas à départager
    // les adresses exotiques, seulement à écarter le manifestement faux.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel)) {
      return res.status(400).json({ erreur: "courriel" });
    }

    let existe = false;
    try {
      const c = await stripe.customers.list({ email: courriel, limit: 1 });
      existe = c.data.length > 0;
    } catch (e) {
      console.error("[compte] Stripe injoignable :", e.message);
    }

    if (existe) {
      const lien = `${(process.env.SITE_URL || "").replace(/\/$/, "")}/compte.html?t=${emettre(courriel)}`;
      const url = process.env.GHL_WEBHOOK_URL;
      if (url) {
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // `type` permet au workflow GoHighLevel d'aiguiller : ce message
            // n'est pas une commande, c'est une demande d'accès au compte.
            body: JSON.stringify({ type: "acces_compte", email: courriel, lien, expire_jours: JOURS_VALIDITE }),
          });
        } catch (e) {
          console.error("[compte] envoi GHL échoué :", e.message);
        }
      } else {
        console.error("[compte] GHL_WEBHOOK_URL absente — lien non envoyé");
      }
    }

    /* Réponse identique dans les deux cas. Dire « aucun compte à cette
       adresse » transformerait ce point d'entrée en outil pour savoir qui
       est client de la boutique. */
    return res.status(200).json({ ok: true });
  }

  /* ---------- Consulter ses commandes ---------- */
  if (req.method === "GET") {
    const courriel = verifier(req.query && req.query.t);
    if (!courriel) return res.status(401).json({ erreur: "lien" });
    try {
      const commandes = await commandesDe(courriel);
      return res.status(200).json({ courriel, commandes });
    } catch (e) {
      console.error("[compte] lecture Stripe échouée :", e.message);
      return res.status(502).json({ erreur: "stripe" });
    }
  }

  return res.status(405).end("Method Not Allowed");
}
