/* ============================================================
   Vérification hebdomadaire de la disponibilité chez IFDC.
   Tourne chaque lundi matin (GitHub Actions) :
       node tools/ifdc-check.mjs            # applique et écrit le rapport
       node tools/ifdc-check.mjs --dry-run  # ne touche à rien

   Ce qu'on vérifie : chaque produit « ifdc- » du catalogue est relié,
   par tools/ifdc-map.json, à une ou plusieurs pages du site IFDC. Une
   requête HEAD par page suffit — 200 la page vit, 404 elle est retirée.

   Ce qu'on en fait :
     toutes les pages d'un produit disparues  → "off": 1 dans data.js.
        Le produit sort de la boutique et la caisse le refuse.
     une partie seulement                     → signalé, rien masqué :
        le meuble existe encore, c'est un fini qui est parti.
     un produit "off" dont une page revient    → "off" retiré.

   Trois garde-fous, parce qu'un faux positif vide la boutique :
     1. une page absente est resondée avant d'être crue morte ;
     2. au-delà de SEUIL_PANIQUE de disparitions, on n'applique rien —
        c'est IFDC qui a déménagé ses URL, pas 300 meubles qui ont
        disparu le même lundi ;
     3. trop d'erreurs réseau → on sort sans rien changer.
   ============================================================ */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.ifdc.ca";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";
const SEUIL_PANIQUE = 40;      // disparitions au-delà desquelles on ne touche à rien
const SEUIL_ERREURS = 0.10;    // part d'erreurs réseau tolérée
const CONCURRENCE = 8;
const DRY = process.argv.includes("--dry-run");

// La date de Montréal, pas celle d'UTC : le rapport et les dates de retrait
// sont lus par le client, et un décalage d'un jour n'aide personne.
const jour = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const fr = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });

/* ---------- lecture ---------- */
const mapPath = path.join(ROOT, "tools/ifdc-map.json");
if (!existsSync(mapPath)) { console.error("tools/ifdc-map.json manquant — lancez d'abord tools/ifdc-map-build.mjs"); process.exit(1); }
const carte = JSON.parse(readFileSync(mapPath, "utf8"));

const dataPath = path.join(ROOT, "data.js");
const dataSrc = readFileSync(dataPath, "utf8");
// Même expression qu'api/checkout.js : non gourmande, sinon elle avale
// aussi la ligne COLLECTIONS qui suit.
const bloc = dataSrc.match(/window\.CATALOG\s*=\s*(\[[\s\S]*?\]);\s*\n/);
if (!bloc) { console.error("CATALOG introuvable dans data.js"); process.exit(1); }
const catalogue = JSON.parse(bloc[1]);
const parHandle = new Map(catalogue.map((p) => [p.h, p]));

/* ---------- sondage ---------- */
const slugs = [...new Set(Object.values(carte.produits).flatMap((m) => m.slugs))].sort();
console.log(`${slugs.length} pages IFDC à vérifier pour ${Object.keys(carte.produits).length} produits`);

const etat = new Map();
async function head(slug) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25000);
  try {
    const r = await fetch(`${BASE}/product-page/${encodeURIComponent(slug)}`, { method: "HEAD", headers: { "user-agent": UA }, signal: ac.signal });
    return r.status;
  } catch { return null; } finally { clearTimeout(t); }
}
/* Une seule requête ne suffit pas à condamner un produit. Un délai d'attente
   dépassé ressemble à une page absente et ne l'est pas : on exige deux 404
   espacés avant de conclure, et toute autre réponse rend la page vivante.
   Le coût est nul dans le cas courant — une page qui répond 200 du premier
   coup n'est jamais resondée. */
async function verdict(slug) {
  let quatreCentQuatre = 0;
  for (let essai = 0; essai < 3; essai++) {
    const code = await head(slug);
    if (code === 200) return 200;
    if (code === 404 && ++quatreCentQuatre >= 2) return 404;
    await new Promise((r) => setTimeout(r, 1200 * (essai + 1)));
  }
  return quatreCentQuatre ? 404 : null;
}
let idx = 0, faits = 0;
async function worker() {
  while (idx < slugs.length) {
    const s = slugs[idx++];
    etat.set(s, await verdict(s));
    if (++faits % 100 === 0) console.log(`  ${faits}/${slugs.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCE }, worker));

const erreurs = [...etat.values()].filter((c) => c === null).length;
console.log(`vivantes ${[...etat.values()].filter((c) => c === 200).length} · disparues ${[...etat.values()].filter((c) => c === 404).length} · erreurs ${erreurs}`);
if (erreurs / Math.max(slugs.length, 1) > SEUIL_ERREURS) {
  console.error(`Trop d'erreurs réseau (${erreurs}) — aucune modification. IFDC est peut-être hors ligne.`);
  process.exit(2);
}

/* ---------- ce qu'IFDC publie aujourd'hui ---------- */
let publies = [];
try {
  const xml = await (await fetch(`${BASE}/store-products-sitemap.xml`, { headers: { "user-agent": UA } })).text();
  const l = [...new Set([...xml.matchAll(/<loc>[^<]*\/product-page\/([^<]+)<\/loc>/g)].map((m) => decodeURIComponent(m[1])))];
  if (l.length >= 500) publies = l;
} catch { /* le plan de site n'est qu'un bonus */ }

// Même lecture des codes d'article que tools/ifdc-map-build.mjs.
const CODE = /\b([a-z]{1,3})-(\d{2,5})\b/g;
const codesOf = (s) => [...new Set([...String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").matchAll(CODE)].map((m) => m[1] + "-" + m[2]))];
const codesPubli = new Map(publies.map((s) => [s, new Set(codesOf(s))]));

/* ---------- diagnostic par produit ---------- */
const disparus = [], partiels = [], revenus = [], renommes = [];
for (const [h, m] of Object.entries(carte.produits)) {
  const p = parHandle.get(h);
  if (!p || !m.slugs.length) continue;                       // produit retiré du site, ou invérifiable
  const vues = m.slugs.map((s) => etat.get(s));
  const vivantes = m.slugs.filter((s) => etat.get(s) === 200);
  const mortes = m.slugs.filter((s) => etat.get(s) === 404);
  if (vues.includes(null)) continue;                          // sondage incomplet : on ne juge pas
  if (!vivantes.length) {
    // Avant de conclure à la disparition : IFDC renomme ses adresses plus
    // souvent qu'il ne retire des meubles (if-6311 → if-6311-recliner). On
    // cherche, parmi ce qu'il publie aujourd'hui, une page qui porte les
    // mêmes codes d'article.
    const codes = codesOf(h.slice(5)).length ? codesOf(h.slice(5)) : codesOf(p.name);
    let repris = codes.length ? publies.filter((s) => codes.every((c) => codesPubli.get(s).has(c))) : [];
    // Dernier recours : l'adresse tirée de notre propre handle. Certaines
    // pages IFDC vivent hors du plan de site — c'est peu de chose, une requête
    // par produit condamné, et ça évite d'en masquer un qui se porte bien.
    if (!repris.length && (await verdict(h.slice(5))) === 200) repris = [h.slice(5)];
    if (repris.length) { renommes.push({ p, h, avant: m.slugs, apres: repris }); continue; }
    if (!p.off) disparus.push({ p, mortes });
  }
  else {
    if (p.off) revenus.push({ p, vivantes });
    if (mortes.length) partiels.push({ p, mortes, vivantes });
  }
}

const connus = new Set([...slugs, ...renommes.flatMap((r) => r.apres)]);
const dejaVus = new Set(carte.nonPortes || []);
const nouveautes = publies.filter((s) => !connus.has(s) && !dejaVus.has(s));

/* ---------- application ---------- */
let applique = false;
const bloque = disparus.length > SEUIL_PANIQUE;
if (bloque) {
  console.error(`${disparus.length} disparitions d'un coup (seuil ${SEUIL_PANIQUE}) — rien n'a été modifié. À vérifier à la main.`);
} else if (!DRY && (disparus.length || revenus.length)) {
  for (const { p } of disparus) { p.off = 1; p.offDate = jour; }
  for (const { p } of revenus) { delete p.off; delete p.offDate; }
  writeFileSync(dataPath, dataSrc.replace(bloc[0], "window.CATALOG = " + JSON.stringify(catalogue) + ";\n"));
  applique = true;
}
/* La table d'appariement se tient à jour toute seule : un produit renommé
   retrouve son adresse, et les nouveautés signalées ce lundi entrent dans
   `nonPortes` pour ne pas être re-annoncées chaque semaine jusqu'à la fin des
   temps. Le rapport, lui, reste dans l'historique git. */
if (!DRY && (renommes.length || nouveautes.length)) {
  for (const { h, apres } of renommes) carte.produits[h] = { via: "renomme", slugs: apres.sort() };
  const portes = new Set(Object.values(carte.produits).flatMap((m) => m.slugs));
  if (publies.length) carte.nonPortes = publies.filter((s) => !portes.has(s)).sort();
  writeFileSync(mapPath, JSON.stringify(carte, null, 1) + "\n");
  applique = true;
}

/* ---------- rapport ---------- */
const offs = catalogue.filter((p) => p.off);
const lignes = [];
lignes.push(`# Disponibilité IFDC — ${fr(jour)}`, "");
lignes.push(`${slugs.length} pages vérifiées · **${disparus.length}** disparition${disparus.length > 1 ? "s" : ""} · **${renommes.length}** adresse${renommes.length > 1 ? "s" : ""} changée${renommes.length > 1 ? "s" : ""} · **${partiels.length}** produit${partiels.length > 1 ? "s" : ""} amputé${partiels.length > 1 ? "s" : ""} d'un fini · **${revenus.length}** retour${revenus.length > 1 ? "s" : ""}`, "");
if (bloque) lignes.push(`> **Rien n'a été appliqué.** ${disparus.length} disparitions le même jour dépasse le seuil de ${SEUIL_PANIQUE} : c'est presque toujours IFDC qui a réorganisé ses adresses. À vérifier à la main avant de masquer quoi que ce soit.`, "");
else if (applique) lignes.push(`> data.js a été modifié : les produits disparus sont masqués, les revenus sont ressortis.`, "");
else if (DRY) lignes.push(`> Simulation — aucun fichier modifié.`, "");

const bloc2 = (titre, items, ligne) => { if (items.length) { lignes.push(`## ${titre}`, ""); items.forEach((x) => lignes.push("- " + ligne(x))); lignes.push(""); } };
const lien = (s) => `[${s}](${BASE}/product-page/${s})`;

bloc2(`Disparus d'IFDC — masqués sur le site`, disparus, ({ p, mortes }) => `**${p.name}** (${p.cat}, ${p.from} $) — ${mortes.map(lien).join(", ")}`);
bloc2(`Adresses changées chez IFDC — appariement réparé, rien de masqué`, renommes, ({ p, avant, apres }) => `**${p.name}** — ${avant.map(lien).join(", ")} → ${apres.map(lien).join(", ")}`);
bloc2(`Un fini en moins — le produit reste en vente`, partiels, ({ p, mortes, vivantes }) => `**${p.name}** — parti : ${mortes.map(lien).join(", ")} · reste : ${vivantes.length} page${vivantes.length > 1 ? "s" : ""}`);
bloc2(`De retour chez IFDC — remis en vente`, revenus, ({ p }) => `**${p.name}** (${p.cat})`);
bloc2(`Nouveautés chez IFDC — pas encore au catalogue (signalées une seule fois)`, nouveautes.slice(0, 60), (s) => lien(s));
if (nouveautes.length > 60) lignes.push(`…et ${nouveautes.length - 60} autres.`, "");

if (offs.length) {
  lignes.push(`## Actuellement masqués (${offs.length})`, "");
  offs.forEach((p) => lignes.push(`- **${p.name}** — ${p.cat} — masqué le ${p.offDate || "?"}`));
  lignes.push("");
}
const invisibles = Object.entries(carte.produits).filter(([, m]) => !m.slugs.length).length;
lignes.push("---", "", `_${invisibles} produits du catalogue viennent de la liste de prix et n'ont pas de page IFDC : leur disponibilité ne peut pas être vérifiée en ligne, et ils ne sont jamais masqués automatiquement._`);

const rapport = lignes.join("\n") + "\n";
writeFileSync(path.join(ROOT, "tools/ifdc-rapport.md"), rapport);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, [
    `disparus=${disparus.length}`,
    `renommes=${renommes.length}`,
    `partiels=${partiels.length}`,
    `revenus=${revenus.length}`,
    `bloque=${bloque ? 1 : 0}`,
    `applique=${applique ? 1 : 0}`,
  ].join("\n") + "\n");
}
console.log(rapport);
process.exit(bloque ? 3 : 0);
