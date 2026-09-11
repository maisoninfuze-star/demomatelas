/* ============================================================
   Lecture tolérante des variables d'environnement.

   Vercel ignore les fichiers de api/ préfixés d'un « _ » : ce module
   n'est pas une route, seulement un utilitaire partagé.

   Les noms de variables sont sensibles à la casse et le propriétaire a
   saisi « Stripe_webhook » pour STRIPE_WEBHOOK_SECRET. Plutôt que
   d'exiger une orthographe exacte à chaque fois, on accepte plusieurs
   noms et on compare sans tenir compte de la casse. La valeur, elle,
   n'est jamais transformée.
   ============================================================ */
import crypto from "node:crypto";

/* Renvoie la première variable trouvée parmi les noms proposés, en
   essayant d'abord le nom exact, puis sans distinction de casse. */
export function env(...noms) {
  for (const n of noms) if (process.env[n]) return process.env[n];
  const bas = new Map(Object.keys(process.env).map((k) => [k.toLowerCase(), k]));
  for (const n of noms) {
    const k = bas.get(n.toLowerCase());
    if (k && process.env[k]) return process.env[k];
  }
  return "";
}

export const stripeSecret = () => env("STRIPE_SECRET_KEY", "STRIPE_KEY", "STRIPE_SECRET");

export const stripeWebhookSecret = () =>
  env("STRIPE_WEBHOOK_SECRET", "STRIPE_WEBHOOK", "STRIPE_SIGNING_SECRET", "WEBHOOK_SECRET");

export const ghlWebhookUrl = () =>
  env("GHL_WEBHOOK_URL", "GHL_WEBHOOK", "GOHIGHLEVEL_WEBHOOK_URL", "LEADCONNECTOR_WEBHOOK_URL");

/* Clé de signature des liens de compte.
   Si COMPTE_SECRET n'est pas définie, on la DÉRIVE de la clé Stripe par
   HMAC : aussi secrète que la clé Stripe, jamais exposée, et une variable
   de moins à créer. Changer la clé Stripe invalide les liens en cours —
   ils ne valent que 14 jours, c'est acceptable. */
export function compteSecret() {
  const explicite = env("COMPTE_SECRET", "ACCOUNT_SECRET");
  if (explicite) return explicite;
  const base = stripeSecret();
  if (!base) return "";
  return crypto.createHmac("sha256", base).update("literie:compte:v1").digest("hex");
}

export const siteUrl = () => (env("SITE_URL", "PUBLIC_URL", "BASE_URL") || "https://literiedamitie.com").replace(/\/$/, "");
