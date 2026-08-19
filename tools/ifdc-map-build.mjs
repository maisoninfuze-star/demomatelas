/* ============================================================
   Construction de la table d'appariement produit → page IFDC.
   À relancer seulement quand on ajoute des produits au catalogue :
       node tools/ifdc-map-build.mjs
   Le résultat, tools/ifdc-map.json, est versionné ; c'est lui que
   la vérification hebdomadaire lit. On ne redécouvre pas les liens
   chaque semaine — 900 sondages, ça ne se refait pas pour rien.

   Trois façons de relier un produit à IFDC, de la plus sûre à la
   moins sûre :
     direct — /product-page/<handle sans ifdc-> répond 200 ;
     codes  — nos codes d'article (if-300, t-1447, c-1760…) se
              retrouvent tous dans un slug du plan de site. Un
              produit vaut alors une grappe de pages, une par
              fini : if-300 → if-300-e, if-300-g, if-300-w ;
     aucune — l'article vient de la liste de prix et n'a jamais eu
              de page web. Invérifiable en ligne, jamais masqué
              automatiquement.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";
const BASE = "https://www.ifdc.ca";

const win = {};
new Function("window", readFileSync(path.join(ROOT, "data.js"), "utf8"))(win);
const prods = win.CATALOG.filter((p) => p.h.startsWith("ifdc-"));

const xml = await (await fetch(`${BASE}/store-products-sitemap.xml`, { headers: { "user-agent": UA } })).text();
const slugs = [...new Set([...xml.matchAll(/<loc>[^<]*\/product-page\/([^<]+)<\/loc>/g)].map((m) => decodeURIComponent(m[1])))].sort();
if (slugs.length < 500) throw new Error(`Plan de site suspect : ${slugs.length} produits`);
console.log("plan de site :", slugs.length, "pages produit");

// Un code d'article IFDC : 1 à 3 lettres, un tiret, 2 à 5 chiffres.
const CODE = /\b([a-z]{1,3})-(\d{2,5})\b/g;
const codesOf = (s) => [...new Set([...String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").matchAll(CODE)].map((m) => m[1] + "-" + m[2]))];
const slugCodes = new Map(slugs.map((s) => [s, new Set(codesOf(s))]));

/* Sondage : le handle donne-t-il directement une page ?
   Une panne réseau ne doit surtout pas se lire comme « page absente » —
   c'est ainsi qu'on efface une grappe entière de la table. On ne croit donc
   que les réponses explicites, et on réessaie les échecs. */
const direct = new Map();
let i = 0, done = 0, ratés = 0;
async function statut(url) {
  for (let essai = 0; essai < 3; essai++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 25000);
    try {
      return (await fetch(url, { method: "HEAD", headers: { "user-agent": UA }, signal: ac.signal })).status;
    } catch { await new Promise((r) => setTimeout(r, 800 * (essai + 1))); }
    finally { clearTimeout(t); }
  }
  return null;                                        // trois échecs : on ne sait pas
}
async function worker() {
  while (i < prods.length) {
    const h = prods[i++].h.slice(5);
    const st = await statut(`${BASE}/product-page/${encodeURIComponent(h)}`);
    if (st === 200) direct.set(h, true);
    if (st === null) ratés++;
    if (++done % 100 === 0) console.log(`  sondé ${done}/${prods.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log("pages atteintes directement :", direct.size, "| sondages perdus :", ratés);
if (ratés > prods.length * 0.05) throw new Error(`${ratés} sondages perdus — réseau trop instable pour bâtir une table fiable.`);

const produits = {};
const compte = { direct: 0, codes: 0, nom: 0, aucune: 0 };
const auPlan = new Set(slugs);
for (const p of prods) {
  const h = p.h.slice(5);
  const codes = codesOf(h).length ? codesOf(h) : codesOf(p.name);
  const grappe = codes.length ? slugs.filter((s) => codes.every((c) => slugCodes.get(s).has(c))) : [];

  let hits = [], via = "aucune";
  // IFDC renomme ses pages : if-6311 est devenu if-6311-recliner. Un sondage
  // direct qui répond 200 mais qu'on ne retrouve pas au plan de site est une
  // adresse en sursis — si la grappe de codes couvre l'article, elle prime.
  const gardeDirect = direct.has(h) && (auPlan.has(h) || !grappe.length);
  if (gardeDirect) { hits.push(h); via = "direct"; }
  if (grappe.length) { grappe.forEach((s) => hits.includes(s) || hits.push(s)); if (!gardeDirect) via = "codes"; }
  if (!hits.length) {
    hits = slugs.filter((s) => s === h || s.startsWith(h + "-"));
    if (!hits.length) {
      const mot = h.split("-")[0];
      if (/^[a-z]{4,}$/.test(mot)) hits = slugs.filter((s) => s === mot || s.startsWith(mot + "-"));
    }
    if (hits.length) via = "nom";
  }
  compte[via]++;
  produits[p.h] = { via, slugs: hits.sort() };
}

const connus = new Set(Object.values(produits).flatMap((m) => m.slugs));
const out = {
  genere: new Date().toISOString().slice(0, 10),
  source: `${BASE}/product-page/<slug>`,
  produits,
  // Ce qu'IFDC publie et que nous ne vendons pas : la base du volet
  // « nouveautés » du rapport hebdomadaire.
  nonPortes: slugs.filter((s) => !connus.has(s)),
};
writeFileSync(path.join(ROOT, "tools/ifdc-map.json"), JSON.stringify(out, null, 1) + "\n");
console.log("appariement :", compte, "| slugs suivis :", connus.size, "| non portés :", out.nonPortes.length);
