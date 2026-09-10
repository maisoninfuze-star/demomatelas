/* ============================================================
   Diagnostic de configuration — TEMPORAIRE

   Répond à une seule question : parmi les variables d'environnement
   que le code attend, lesquelles le déploiement voit-il ?

   NE RENVOIE JAMAIS DE VALEUR. Uniquement `true` / `false`, plus la
   longueur pour distinguer une variable vide d'une variable absente.
   Les noms des variables sont déjà publics — ils sont dans le dépôt —
   donc les exposer n'apprend rien à personne. Les valeurs, elles, ne
   sortent pas d'ici.

   À SUPPRIMER une fois la configuration confirmée : un point d'entrée
   de diagnostic n'a rien à faire en production sur la durée.
   ============================================================ */

const ATTENDUES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GHL_WEBHOOK_URL",
  "COMPTE_SECRET",
  "SITE_URL",
  "CRON_SECRET",
];

export default function handler(req, res) {
  const vues = {};
  for (const n of ATTENDUES) {
    const v = process.env[n];
    vues[n] = v ? { presente: true, longueur: String(v).length } : { presente: false };
  }

  /* Si une variable attendue manque, il y en a peut-être une équivalente
     sous un autre nom. On liste donc les NOMS — jamais les valeurs — de
     tout ce qui ressemble à de la configuration Stripe, GHL ou compte,
     pour repérer un « STRIPE_WEBHOOK » ou un « GHL_TOKEN » mal nommé. */
  const voisines = Object.keys(process.env)
    .filter((k) => /STRIPE|GHL|WEBHOOK|COMPTE|SITE|CRON|LEAD/i.test(k))
    .filter((k) => !ATTENDUES.includes(k))
    .sort();

  const manquantes = ATTENDUES.filter((n) => !vues[n].presente);

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    attendues: vues,
    manquantes,
    autres_noms_ressemblants: voisines,
    note: "Aucune valeur n'est renvoyée. Supprimer api/diag.js après vérification.",
  });
}
