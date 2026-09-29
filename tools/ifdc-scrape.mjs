/* ============================================================
   Re-collecte complète du catalogue IFDC.
       node tools/ifdc-scrape.mjs              # tout le plan de site
       node tools/ifdc-scrape.mjs --reprendre  # complète un fichier existant

   La vérification du lundi (tools/ifdc-check.mjs) se contente d'un HEAD :
   200, la page vit. C'est rapide mais aveugle — une page peut répondre 200
   en étant masquée ou en rupture. Ici on lit ce que la page dit vraiment.

   Chaque page produit Wix embarque son propre objet catalogue :
       name · ribbon · isVisible · isInStock · inventory.status · media
   Le ruban est ce qui compte : c'est là qu'IFDC écrit « DISCONTINUED ».
   On l'extrait et on écrit tools/ifdc-catalogue.json : l'état réel du
   catalogue fournisseur, à comparer ensuite avec le nôtre.

   Politesse et prudence : 5 requêtes en parallèle, réponses compressées,
   trois tentatives, et un échec ne vaut jamais « produit disparu » — il
   est noté comme inconnu.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.ifdc.ca";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";
const SORTIE = path.join(ROOT, "tools/ifdc-catalogue.json");
const CONCURRENCE = 5;
const REPRENDRE = process.argv.includes("--reprendre");

const jour = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

/* ---------- plan de site ---------- */
const xml = await (await fetch(`${BASE}/store-products-sitemap.xml`, { headers: { "user-agent": UA } })).text();
const slugs = [...new Set([...xml.matchAll(/<loc>[^<]*\/product-page\/([^<]+)<\/loc>/g)].map((m) => decodeURIComponent(m[1])))].sort();
if (slugs.length < 500) throw new Error(`Plan de site suspect : ${slugs.length} pages`);
console.log(`plan de site : ${slugs.length} pages produit`);

const deja = REPRENDRE && existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, "utf8")).produits : {};
const produits = { ...deja };
const restants = slugs.filter((s) => !produits[s]);
console.log(`${restants.length} à collecter${REPRENDRE ? ` (${slugs.length - restants.length} déjà en place)` : ""}`);

/* ---------- extraction ----------
   L'objet cherché est la valeur de "product" dans la clé
   productPage_<DEVISE>_<slug>. On équilibre les accolades plutôt que
   d'utiliser une expression régulière : la description d'un meuble peut
   contenir n'importe quoi. */
function objetProduit(html, slug) {
  const cle = html.indexOf(`"productPage_CAD_${slug}"`);
  const depart = cle >= 0 ? cle : html.indexOf('"catalog":{"product":{');
  if (depart < 0) return null;
  const i = html.indexOf('"product":{', depart);
  if (i < 0) return null;
  const brut = html.slice(i + 10);
  let d = 0;
  for (let k = 0; k < brut.length && k < 2e6; k++) {
    const c = brut[k];
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) { try { return JSON.parse(brut.slice(0, k + 1)); } catch { return null; } } }
    else if (c === '"') { // sauter la chaîne, sinon une accolade dans un texte fausse le compte
      k++;
      while (k < brut.length && !(brut[k] === '"' && brut[k - 1] !== "\\")) k++;
    }
  }
  return null;
}

async function page(slug) {
  for (let essai = 0; essai < 3; essai++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 40000);
    try {
      const r = await fetch(`${BASE}/product-page/${encodeURIComponent(slug)}`, {
        headers: { "user-agent": UA, "accept-encoding": "gzip, deflate" },
        signal: ac.signal,
      });
      if (r.status === 404) return { statut: 404 };
      if (!r.ok) throw new Error("HTTP " + r.status);
      return { statut: 200, html: await r.text() };
    } catch (e) {
      if (essai === 2) return { statut: null, erreur: e.message };
      await new Promise((r) => setTimeout(r, 1200 * (essai + 1)));
    } finally { clearTimeout(t); }
  }
}

let i = 0, fait = 0, perdus = 0, absents = 0, sansObjet = 0;
async function worker() {
  while (i < restants.length) {
    const slug = restants[i++];
    const r = await page(slug);
    if (r.statut === 404) { produits[slug] = { slug, statut: "404" }; absents++; }
    else if (r.statut === null) { produits[slug] = { slug, statut: "erreur", erreur: r.erreur }; perdus++; }
    else {
      const p = objetProduit(r.html, slug);
      if (!p) { produits[slug] = { slug, statut: "illisible" }; sansObjet++; }
      else {
        /* Le ruban est la SEULE marque de disponibilité qu'IFDC entretienne :
           « DISCONTINUED », « Partially Discontinued », « NEW (Nov 1st) »…
           isInStock et inventory.status, eux, disent « in_stock » sur les 978
           pages — le magasin ne suit pas ses stocks, la valeur ne veut rien
           dire. On garde les deux, mais on sait laquelle porte le signal. */
        produits[slug] = {
          slug,
          statut: "ok",
          id: p.id,
          nom: p.name,
          ruban: p.ribbon || "",
          rubansSup: (p.additionalRibbons || []).map((r) => (typeof r === "string" ? r : r && r.text) || "").filter(Boolean),
          retire: /discontinu/i.test(p.ribbon || ""),
          visible: p.isVisible !== false,
          enStock: p.isInStock !== false,
          suitStock: p.isTrackingInventory === true,
          inventaire: (p.inventory && p.inventory.status) || null,
          image: (p.media && p.media[0] && p.media[0].url) || null,
          images: (p.media || []).map((m) => m.url).filter(Boolean),
          nbImages: (p.media || []).length,
          prix: p.price || 0,
        };
      }
    }
    if (++fait % 50 === 0) {
      console.log(`  ${fait}/${restants.length} · absents ${absents} · perdus ${perdus} · illisibles ${sansObjet}`);
      writeFileSync(SORTIE, JSON.stringify({ date: jour, source: BASE, total: slugs.length, produits }, null, 1));
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCE }, worker));

writeFileSync(SORTIE, JSON.stringify({ date: jour, source: BASE, total: slugs.length, produits }, null, 1));
const vals = Object.values(produits);
console.log(`\ncollecté ${vals.length} pages · ok ${vals.filter((p) => p.statut === "ok").length} · 404 ${vals.filter((p) => p.statut === "404").length} · illisibles ${vals.filter((p) => p.statut === "illisible").length} · erreurs ${vals.filter((p) => p.statut === "erreur").length}`);
const ok = vals.filter((p) => p.statut === "ok");
const retires = ok.filter((p) => p.retire);
console.log(`rubans « discontinued » : ${retires.length}${retires.length ? " → " + retires.map((p) => p.slug).join(", ") : ""}`);
console.log(`suivi de stock actif chez IFDC : ${ok.filter((p) => p.suitStock).length}/${ok.length} (0 = « en stock » ne prouve rien)`);
console.log("→ tools/ifdc-catalogue.json");
