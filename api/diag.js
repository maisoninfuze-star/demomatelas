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

import { stripeSecret, stripeWebhookSecret, ghlWebhookUrl, compteSecret, siteUrl } from "./_env.js";

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
  /* Tous les noms définis par le propriétaire — on écarte seulement ce que
     Vercel et Node injectent eux-mêmes. Noms uniquement, jamais les valeurs. */
  const SYSTEME = /^(VERCEL|AWS|NODE|NOW|PATH|HOME|PWD|SHLVL|LANG|LC_|TZ|TMPDIR|_|LAMBDA|NEXT|npm_|CI$|HOSTNAME|TERM|USER|LOGNAME|SHELL|OLDPWD|INIT_CWD|COLOR|DEBIAN|FUNCTIONS?_|TASK)/i;
  const voisines = Object.keys(process.env)
    .filter((k) => !SYSTEME.test(k))
    .filter((k) => !ATTENDUES.includes(k))
    .sort();

  const manquantes = ATTENDUES.filter((n) => !vues[n].presente);

  /* Ce que le code RÉSOUT réellement, alias et dérivation compris :
     c'est la seule ligne qui compte pour savoir si ça marche. */
  const resolu = {
    stripe_secret:   !!stripeSecret(),
    stripe_webhook:  !!stripeWebhookSecret(),
    ghl_webhook_url: !!ghlWebhookUrl(),
    compte_secret:   !!compteSecret(),
    site_url:        siteUrl(),
  };

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    attendues: vues,
    manquantes,
    resolu,
    autres_noms_definis: voisines,
    note: "Aucune valeur n'est renvoyée. Supprimer api/diag.js après vérification.",
  });
}
