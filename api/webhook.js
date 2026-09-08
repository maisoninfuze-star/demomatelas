/* ============================================================
   Stripe → webhook (Vercel serverless)

   Sans ce point d'entrée, une commande payée n'existe nulle part
   ailleurs que dans le tableau de bord Stripe : le site ne l'apprend
   jamais, personne n'est prévenu, et la confirmation promise par les
   conditions de vente n'est envoyée par aucun code.

   Il fait une seule chose et la fait bien : vérifier la signature de
   Stripe, puis transmettre la commande à GoHighLevel sous une forme
   directement exploitable par un workflow.

   VARIABLES D'ENVIRONNEMENT (Vercel → Settings → Environment Variables)
     STRIPE_SECRET_KEY      déjà présente pour la caisse
     STRIPE_WEBHOOK_SECRET  « whsec_… », donné par Stripe à la création
                            du endpoint. Sans elle, tout est refusé.
     GHL_WEBHOOK_URL        l'URL du déclencheur « Inbound Webhook »
                            du workflow GoHighLevel.

   Le corps doit rester BRUT : la signature porte sur les octets exacts.
   D'où bodyParser désactivé plus bas — c'est l'erreur classique qui fait
   échouer toutes les signatures.
   ============================================================ */
import Stripe from "stripe";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

/* Corps brut : on accumule les octets sans les interpréter.
   Vercel analyse le corps par défaut (api/checkout.js lit déjà req.body
   comme un objet). Le `config` ci-dessus le désactive pour cette route.
   Si un changement de plateforme le réactivait un jour, le flux serait
   déjà consommé et la signature échouerait sans explication : on détecte
   ce cas explicitement plutôt que de renvoyer un 400 opaque. */
function corpsBrut(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body, "utf8"));
  if (req.body && typeof req.body === "object") {
    // Ré-encoder un objet déjà analysé ne redonne pas les octets d'origine :
    // l'ordre des clés et l'espacement diffèrent, la signature ne peut plus
    // correspondre. Inutile de faire semblant.
    return Promise.reject(new Error(
      "le corps a été analysé en amont — bodyParser doit rester désactivé sur cette route"
    ));
  }
  return new Promise((resolve, reject) => {
    const morceaux = [];
    req.on("data", (c) => morceaux.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(morceaux)));
    req.on("error", reject);
  });
}

/* GoHighLevel peut être momentanément indisponible. On réessaie deux fois
   avant d'abandonner, puis on journalise bruyamment : une commande perdue
   se rattrape à la main depuis Stripe, mais encore faut-il le savoir. */
async function versGHL(charge) {
  const url = process.env.GHL_WEBHOOK_URL;
  if (!url) { console.error("[webhook] GHL_WEBHOOK_URL absente — commande non transmise", charge.commande); return false; }
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(charge),
      });
      if (r.ok) return true;
      console.error(`[webhook] GHL a répondu ${r.status} (essai ${essai})`, charge.commande);
    } catch (e) {
      console.error(`[webhook] GHL injoignable (essai ${essai})`, e.message);
    }
    if (essai < 3) await new Promise((r) => setTimeout(r, essai * 600));
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { console.error("[webhook] STRIPE_WEBHOOK_SECRET absente"); return res.status(500).end("config"); }

  let evenement;
  try {
    const brut = await corpsBrut(req);
    evenement = stripe.webhooks.constructEvent(brut, req.headers["stripe-signature"], secret);
  } catch (e) {
    // Signature invalide : la requête ne vient pas de Stripe. On ne dit rien de plus.
    console.error("[webhook] signature refusée :", e.message);
    return res.status(400).end("signature");
  }

  // On ne traite que les paiements réellement aboutis.
  const interessants = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
  if (!interessants.has(evenement.type)) return res.status(200).json({ ignore: evenement.type });

  const session = evenement.data.object;

  // Un paiement différé (virement) arrive « completed » mais non payé :
  // le confirmer tout de suite annoncerait une commande qui n'est pas réglée.
  if (session.payment_status !== "paid") {
    console.log("[webhook] session non payée, ignorée", session.id, session.payment_status);
    return res.status(200).json({ ignore: "unpaid" });
  }

  const m = session.metadata || {};

  // Le détail des articles vit sur les line items, pas sur la session.
  let articles = [];
  try {
    const li = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    articles = li.data.map((x) => ({
      nom: x.description,
      quantite: x.quantity,
      total: (x.amount_total || 0) / 100,
    }));
  } catch (e) {
    console.error("[webhook] line items illisibles", e.message);
  }

  const charge = {
    // Identité — GoHighLevel rapproche le contact par courriel.
    email: session.customer_details?.email || "",
    phone: m.telephone || session.customer_details?.phone || "",
    name: m.client || session.customer_details?.name || "",

    // La commande.
    commande: m.commande || session.client_reference_id || "",
    total: (session.amount_total || 0) / 100,
    devise: (session.currency || "cad").toUpperCase(),
    articles: articles,
    nb_articles: m.articles || String(articles.length),

    // La feuille de route : c'est ce dont l'équipe a besoin pour livrer.
    mode: m.mode || "",
    adresse: m.adresse || "",
    acces: m.acces || "",
    souhait: m.souhait || "",
    appeler: m.appeler || "",
    delai: m.delai || "",

    // Utile pour segmenter dans GHL sans recalculer.
    livraison: m.mode === "Livraison",
    paye_le: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
    session_id: session.id,
  };

  const transmis = await versGHL(charge);

  // On répond 200 même si GoHighLevel n'a pas répondu : renvoyer une erreur
  // ferait rejouer l'événement par Stripe, donc un second courriel de
  // confirmation au client. Mieux vaut une alerte dans les journaux qu'un
  // doublon chez le client — la commande reste récupérable dans Stripe.
  console.log(`[webhook] ${charge.commande} · ${charge.total} ${charge.devise} · GHL:${transmis ? "ok" : "ÉCHEC"}`);
  return res.status(200).json({ recu: true, commande: charge.commande, ghl: transmis });
}
