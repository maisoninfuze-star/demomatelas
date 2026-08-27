/* ============================================================
   SEO — node tools/seo-build.mjs
   · injecte une balise canonical dans chaque page (si absente)
   · génère sitemap.xml (pages + 961 fiches produit + rayons)
   · génère robots.txt
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://literiedamitie.com";
const CAT = JSON.parse(readFileSync(path.join(ROOT, "data.js"), "utf8")
  .match(/window\.CATALOG\s*=\s*(\[[\s\S]*?\]);\s*\n/)[1]);

// Pages hors index : cleanUrls est actif, donc pas de « .html » dans les URL.
const chemin = (f) => (f === "index.html" ? "/" : "/" + f.replace(/\.html$/, ""));
const NOINDEX = new Set(["merci.html"]);          // page de remerciement : sans intérêt pour l'index

let injectees = 0;
for (const f of readdirSync(ROOT).filter((f) => f.endsWith(".html"))) {
  const p = path.join(ROOT, f);
  let s = readFileSync(p, "utf8");
  if (/rel="canonical"/.test(s)) continue;
  const url = SITE + chemin(f);
  const tag = `  <link rel="canonical" href="${url}">\n`
    + (NOINDEX.has(f) ? `  <meta name="robots" content="noindex,follow">\n` : "");
  if (!/<\/head>/i.test(s)) continue;
  s = s.replace(/<\/head>/i, tag + "</head>");
  writeFileSync(p, s);
  injectees++;
}

// Sitemap : pages statiques, rayons, sous-rayons, puis chaque fiche produit.
const DEPTS = ["matelas", "lits", "ensembles", "pieces", "salon", "salle", "divers"];
const SOUS = { salon: ["sectionnels", "inclinables", "sofas", "sofaslits", "fauteuils", "tables", "tele", "bancs"],
  salle: ["ensembles", "tables", "chaises", "tabourets"], lits: ["lits", "tetes", "superpose", "dejour", "coffre", "bancs"],
  matelas: ["matelas", "bases", "sommiers"], pieces: ["commodes", "tnuit", "chiffonniers"],
  divers: ["bureaux", "chaisesbureau", "etageres", "rangement"] };

const urls = [];
const add = (loc, pri, freq) => urls.push({ loc, pri, freq });
for (const f of readdirSync(ROOT).filter((f) => f.endsWith(".html") && !NOINDEX.has(f)))
  add(SITE + chemin(f), f === "index.html" ? "1.0" : "0.7", "weekly");
for (const d of DEPTS) {
  add(`${SITE}/matelas?cat=${d}`, "0.8", "weekly");
  for (const s of SOUS[d] || []) add(`${SITE}/matelas?cat=${d}&amp;sub=${s}`, "0.6", "weekly");
}
for (const p of CAT) if (!p.off) add(`${SITE}/produit?p=${encodeURIComponent(p.h)}`, "0.5", "monthly");

writeFileSync(path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
  + urls.map((u) => `  <url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n")
  + `\n</urlset>\n`);

writeFileSync(path.join(ROOT, "robots.txt"),
`User-agent: *
Allow: /

# Paramètres de suivi et de panier : sans valeur pour l'index.
Disallow: /*?*utm_
Disallow: /*?*cb=
Disallow: /merci

Sitemap: ${SITE}/sitemap.xml
`);

console.log(`canonical injectées : ${injectees} page(s)`);
console.log(`sitemap.xml : ${urls.length} URL (${CAT.filter((p) => !p.off).length} fiches produit)`);
console.log("robots.txt écrit");
