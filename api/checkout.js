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
    const { items = [], zone = "montreal" } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "Panier vide." });
    }

    const list = catalog();
    const line_items = [];

    for (const it of items) {
      const p = list.find((x) => x.h === it.h);
      if (!p) return res.status(400).json({ error: `Produit inconnu : ${it.h}` });

      // La variante choisie doit exister dans le catalogue ; sinon, première variante.
      const v = p.variants.find((x) => x.t === it.v) || p.variants[0];
      const qty = Math.min(Math.max(parseInt(it.q, 10) || 1, 1), MAX_QTY);
      const label = v.t && v.t !== "Default Title" ? `${p.name} — ${v.t}` : p.name;
      const img = (p.imgs && p.imgs[0] || "").split("?")[0];

      line_items.push({
        quantity: qty,
        price_data: {
          currency: "cad",
          unit_amount: Math.round(v.p * 100),
          product_data: {
            name: label.slice(0, 250),
            ...(img.startsWith("https://") ? { images: [img] } : {}),
            metadata: { handle: p.h, variante: v.t },
          },
        },
      });
    }

    if (!FREE_ZONES.has(zone)) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: DELIVERY_FEE_CENTS,
          product_data: {
            name: "Livraison — Montréal et environs",
            description: "Jusqu'à Saint-Jérôme et Joliette. Au-delà : nous vous soumissionnons.",
          },
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      locale: "fr-CA",
      // Les taxes (TPS 5 % + TVQ 9,975 %) sont calculées par Stripe Tax.
      automatic_tax: { enabled: true },
      phone_number_collection: { enabled: true },
      shipping_address_collection: FREE_ZONES.has(zone) ? undefined : { allowed_countries: ["CA"] },
      success_url: `${siteUrl}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/matelas.html?annule=1`,
      metadata: { zone, articles: String(items.length) },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Message lisible côté client, détail complet dans les logs Vercel.
    console.error("checkout error:", err);
    const msg = err && err.raw && err.raw.message ? err.raw.message : err.message || "Erreur inconnue";
    return res.status(500).json({ error: msg });
  }
}
