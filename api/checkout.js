/* ============================================================
   Stripe Checkout — création de session (Vercel serverless)
   Les prix ne viennent JAMAIS du navigateur : le client envoie
   des handles + variantes, le serveur relit data.js.
   ============================================================ */
import Stripe from "stripe";
import { readFileSync } from "node:fs";
import path from "node:path";

const FREE_ZONES = new Set(["ramassage"]);
const DELIVERY_FEE_CENTS = 5000; // 50 $ — Montréal et environs
const MAX_QTY = 20;
const MAX_ITEMS = 40;

let catalogCache = null;
function catalog() {
  if (catalogCache) return catalogCache;
  // data.js est un fichier statique du site : `window.CATALOG = [...];`
  const file = readFileSync(path.join(process.cwd(), "data.js"), "utf8");
  const m = file.match(/window\.CATALOG\s*=\s*(\[[\s\S]*?\]);\s*\n/);
  if (!m) throw new Error("CATALOG introuvable dans data.js");
  catalogCache = JSON.parse(m[1]);
  return catalogCache;
}

// zones.js est partagé avec le navigateur : on l'exécute avec un faux
// `window` plutôt que d'en recopier la table ici (aucune dérive possible).
let zonesCache = null;
function zones() {
  if (zonesCache) return zonesCache;
  const src = readFileSync(path.join(process.cwd(), "zones.js"), "utf8");
  const w = {};
  new Function("window", src)(w);
  zonesCache = w.LDA_ZONES;
  return zonesCache;
}

// Les caracteres de controle sont retires : ces valeurs finissent dans les
// metadonnees Stripe et sur la feuille de route du livreur.
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
const tel10 = (v) => {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return d.length === 10 && /^[2-9]/.test(d) ? d : "";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non permise" });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: "STRIPE_SECRET_KEY manquante sur le serveur." });

  const siteUrl = (process.env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const items = Array.isArray(body.items) ? body.items : [];
    // `= {}` ne couvre que undefined : un `client: null` explicite passerait au travers.
    const client = body.client && typeof body.client === "object" ? body.client : {};
    const zone = typeof body.zone === "string" ? body.zone.trim().toLowerCase() : "montreal";

    if (!items.length) return res.status(400).json({ error: "Panier vide." });
    if (items.length > MAX_ITEMS) {
      return res.status(400).json({ error: "Trop d'articles — appelez-nous au 438-375-4949." });
    }
    // Piège à pourriel : rempli = robot. On répond 200 sans rien créer.
    if (clean(body.site, 20)) return res.status(200).json({ url: `${siteUrl}/merci.html` });

    const livraison = !FREE_ZONES.has(zone);

    // Le formulaire valide déjà tout ça ; on le refait ici parce que rien
    // de ce qui arrive du navigateur n'est digne de confiance.
    const c = {
      prenom: clean(client.prenom, 60),
      nom: clean(client.nom, 60),
      tel: tel10(client.tel),
      courriel: clean(client.courriel, 254).toLowerCase(),
      moment: clean(client.moment, 40),
      jour: clean(client.jour, 30),
      plage: clean(client.plage, 40),
      // Consentement SMS : la charge de la preuve appartient a l'expediteur
      // (LCAP art. 13), alors on horodate.
      sms: client.sms === "oui" ? "oui" : "non",
      smsAt: clean(client.smsAt, 40),
    };
    if (!c.prenom || !c.nom) return res.status(400).json({ error: "Nom et prénom requis." });
    if (!c.tel) return res.status(400).json({ error: "Numéro de téléphone invalide." });
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(c.courriel)) {
      return res.status(400).json({ error: "Courriel invalide." });
    }

    if (livraison) {
      Object.assign(c, {
        adresse: clean(client.adresse, 120),
        app: clean(client.app, 24),
        ville: clean(client.ville, 80),
        cp: zones().normalize(client.cp),
        etage: clean(client.etage, 30),
        ascenseur: clean(client.ascenseur, 10),
        notes: clean(client.notes, 400),
      });
      if (!c.adresse || !c.ville) return res.status(400).json({ error: "Adresse de livraison incomplète." });
      if (!c.cp) return res.status(400).json({ error: "Code postal invalide." });
      // Le tarif fixe ne s'applique qu'au territoire desservi — un code
      // postal hors zone ne doit jamais passer à 50 $.
      if (!zones().covers(c.cp)) {
        return res.status(400).json({
          error: "Votre secteur dépasse notre zone de livraison à tarif fixe. Appelez-nous au 438-375-4949 pour votre prix de livraison.",
        });
      }
    }

    const list = catalog();
    const line_items = [];
    // Les articles « ifdc- » viennent du fournisseur : 6–7 jours ouvrables.
    // Une commande mixte suit le plus lent.
    let commande = false;

    for (const it of items) {
      if (!it || typeof it !== "object") return res.status(400).json({ error: "Panier illisible." });
      const p = list.find((x) => x.h === it.h);
      if (!p) return res.status(400).json({ error: "Un article du panier n'existe plus. Rafraîchissez la page." });

      // La variante choisie doit exister dans le catalogue ; sinon, première variante.
      if (p.h.startsWith("ifdc-")) commande = true;
      const v = p.variants.find((x) => x.t === it.v) || p.variants[0];
      const qty = Math.min(Math.max(parseInt(it.q, 10) || 1, 1), MAX_QTY);
      const label = v.t && v.t !== "Default Title" ? `${p.name} — ${v.t}` : p.name;
      const img = (p.imgs && p.imgs[0] || "").split("?")[0];

      // Un prix illisible dans data.js bloquerait TOUTE la boutique, avec pour
      // seul symptome un message d'excuse. On le detecte ici.
      const cents = Math.round(Number(v.p) * 100);
      if (!Number.isFinite(cents) || cents <= 0) {
        console.error("prix invalide:", p.h, v.t, v.p);
        return res.status(500).json({ error: "Un prix est momentanement indisponible. Appelez-nous au 438-375-4949." });
      }

      line_items.push({
        quantity: qty,
        price_data: {
          currency: "cad",
          unit_amount: cents,
          // Explicite : sinon Stripe exige un defaut regle dans le tableau de
          // bord, et une case decochee la-bas casserait tous les paiements.
          tax_behavior: "exclusive",
          product_data: {
            name: label.slice(0, 250),
            ...(img.startsWith("https://") ? { images: [img] } : {}),
            metadata: { handle: p.h, variante: v.t },
          },
        },
      });
    }

    if (livraison) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: DELIVERY_FEE_CENTS,
          tax_behavior: "exclusive",
          product_data: {
            name: "Livraison — Montréal et environs",
            tax_code: "txcd_92010001", // Transport — pas le code « biens »
            description: "Créneau planifié par téléphone. Jusqu'à Saint-Jérôme et Joliette.",
          },
        },
      });
    }

    const adresse = livraison
      ? `${c.adresse}${c.app ? ", app. " + c.app : ""}, ${c.ville} (QC) ${c.cp}`
      : "Ramassage au showroom — 3512, boul. Industriel";
    const acces = livraison
      ? [c.etage, c.ascenseur && `ascenseur : ${c.ascenseur}`, c.notes].filter(Boolean).join(" · ")
      : "";

    // Reference courte, prononcable au telephone, qu'on retrouve des deux
    // cotes : page de remerciement, tableau de bord Stripe, et cle
    // d'idempotence (un double-clic ne cree pas deux sessions payables).
    const ref = "LDA-" + Math.random().toString(36).slice(2, 8).toUpperCase();

    // Stripe Tax calcule la taxe d'apres l'adresse de FACTURATION de la carte.
    // Une carte facturee en Ontario livree a Laval se verrait donc facturer
    // 13 % de TVH au lieu de 5 % TPS + 9,975 % TVQ. On rattache l'adresse de
    // livraison deja validee au client Stripe : c'est elle qui fait foi.
    const customer = await stripe.customers.create({
      email: c.courriel,
      name: `${c.prenom} ${c.nom}`,
      phone: "+1" + c.tel,
      ...(livraison
        ? {
            shipping: {
              name: `${c.prenom} ${c.nom}`,
              phone: "+1" + c.tel,
              address: {
                line1: c.adresse,
                ...(c.app ? { line2: "App. " + c.app } : {}),
                city: c.ville,
                state: "QC",
                postal_code: c.cp,
                country: "CA",
              },
            },
          }
        : {}),
      metadata: { commande: ref },
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      locale: "fr-CA",
      // Les taxes (TPS 5 % + TVQ 9,975 %) sont calculées par Stripe Tax.
      automatic_tax: { enabled: true },
      customer: customer.id,
      client_reference_id: ref,
      // Le panier ne doit pas rester payable indefiniment a un vieux prix.
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      // Le formulaire a déjà tout demandé : on ne le refait pas faire à Stripe.
      phone_number_collection: { enabled: false },
      success_url: `${siteUrl}/merci.html?session_id={CHECKOUT_SESSION_ID}&ref=${ref}`,
      cancel_url: `${siteUrl}/matelas.html?annule=1`,
      // Ces champs suivent la commande jusqu'au tableau de bord Stripe : c'est
      // la feuille de route que l'équipe utilise pour appeler et livrer.
      metadata: {
        commande: ref,
        mode: livraison ? "Livraison" : "Ramassage",
        client: `${c.prenom} ${c.nom}`.slice(0, 200),
        telephone: `${c.tel.slice(0, 3)} ${c.tel.slice(3, 6)}-${c.tel.slice(6)}`,
        adresse: adresse.slice(0, 480),
        acces: acces.slice(0, 480),
        appeler: c.moment || "Peu importe",
        sms_promo: c.sms === "oui" ? `consenti ${c.smsAt || ""}`.trim() : "non",
        // Ce que le client souhaite : l'équipe confirme le créneau réel au téléphone.
        souhait: [c.jour || "Jour : peu importe", c.plage || "Heure : peu importe"].join(" · "),
        delai: commande ? "6–7 jours ouvrables (fournisseur)" : "24–48 h (en stock)",
        articles: String(items.length),
      },
    }, { idempotencyKey: ref });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Le détail reste dans les logs Vercel ; le client reçoit une phrase utile.
    // On ne renvoie pas le message brut : il peut nommer des fichiers ou des clés.
    console.error("checkout error:", err && err.type, err && err.code, err && err.param, err && err.message);
    return res.status(500).json({
      error: "Le paiement est momentanément indisponible. Réessayez, ou appelez-nous au 438-375-4949 — on prend la commande au téléphone.",
    });
  }
}
