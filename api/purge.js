/* ============================================================
   Purge des détails d'accès (Vercel Cron, une fois par jour)

   La politique de confidentialité promet que l'étage, l'ascenseur
   et les notes d'accès disparaissent 30 jours après la commande.
   Ces renseignements vivent dans les métadonnées Stripe — donc
   c'est là qu'il faut aller les effacer. Une promesse que le
   système n'applique pas est pire que pas de promesse du tout.

   Le reste de la commande (nom, adresse, montant) est conservé :
   obligations fiscales, 7 ans.
   ============================================================ */
import Stripe from "stripe";

const JOURS = 30;
const CHAMPS = ["acces", "souhait"]; // opérationnels, plus utiles une fois livré

export default async function handler(req, res) {
  // Vercel Cron s'authentifie avec CRON_SECRET ; on refuse tout le reste.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) return res.status(401).json({ error: "Non autorisé" });
  }

  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return res.status(500).json({ error: "STRIPE_SECRET_KEY manquante" });
  const stripe = new Stripe(key, { apiVersion: "2024-06-20" });

  const limite = Math.floor(Date.now() / 1000) - JOURS * 86400;
  let vus = 0, purges = 0;

  try {
    // On remonte une fenêtre raisonnable : au-delà, tout a déjà été purgé
    // lors des exécutions précédentes.
    for await (const s of stripe.checkout.sessions.list({
      created: { lte: limite, gte: limite - 60 * 86400 },
      limit: 100,
    })) {
      vus++;
      const m = s.metadata || {};
      const aPurger = CHAMPS.filter((k) => m[k]);
      if (!aPurger.length) continue;

      const vide = {};
      aPurger.forEach((k) => (vide[k] = "")); // "" supprime la clé chez Stripe
      // Les métadonnées vivent sur le PaymentIntent une fois la session payée.
      if (s.payment_intent) {
        await stripe.paymentIntents.update(s.payment_intent, { metadata: vide });
      }
      purges++;
    }

    console.log(`purge: ${purges} commandes nettoyées sur ${vus} examinées (> ${JOURS} jours)`);
    return res.status(200).json({ ok: true, examinees: vus, purgees: purges, jours: JOURS });
  } catch (err) {
    console.error("purge error:", err && err.type, err && err.code, err && err.message);
    return res.status(500).json({ error: "Purge échouée — voir les journaux." });
  }
}
