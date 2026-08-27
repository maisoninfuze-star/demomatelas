/* ============================================================
   Applique la classification canonique à data.js.
       node tools/apply-classification.mjs [--dry-run]

   Ajoute à chaque produit : sku · type · dept · subcat ·
   collection · sizes · sleeper. Le champ `cat` d'origine est
   conservé — le site le lit encore — mais il est corrigé quand
   le département était faux.

   Aucune suppression : le nombre de produits est vérifié avant
   et après, et l'écriture est refusée s'il bouge.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classify, LEGACY_DEPT } from "./classify.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const file = path.join(ROOT, "data.js");
const src = readFileSync(file, "utf8");
const bloc = src.match(/window\.CATALOG\s*=\s*(\[[\s\S]*?\]);\s*\n/);
if (!bloc) { console.error("CATALOG introuvable"); process.exit(1); }
const cat = JSON.parse(bloc[1]);
const AVANT = cat.length;

// `cat` reste la clé du site ; on la corrige quand le département est faux.
const BACK = { matelas: "matelas", chambre: null, salon: "salon", salle: "salle", bureau: "divers", decor: "divers" };
const CHAMBRE_SUB = { lits: "lits", "tetes-de-lit": "lits", ensembles: "ensembles",
  commodes: "pieces", chiffonniers: "pieces", "tables-de-nuit": "pieces", armoires: "pieces", miroirs: "pieces" };

let corriges = 0, enrichis = 0, incertains = 0;
const journal = [], conflits = [];
const LITERIE = new Set(["matelas", "lits", "ensembles"]);

for (const p of cat) {
  const c = classify(p);
  if (!c.type) { incertains++; continue; }      // incertains : intacts (§26)
  if (c.conflict) {                            // nom vs sous-ligne contradictoires
    conflits.push({ sku: c.sku, nom: p.name, sub: p.sub || "", nom_dit: c.type, sub_dit: c.conflictWith, cat: p.cat });
    continue;                                  // on n'y touche pas
  }

  const avantCat = p.cat;
  p.sku = c.sku || "";
  p.type = c.type;
  p.dept = c.department;
  p.subcat = c.subcategory;
  if (c.collection) p.collection = c.collection; else delete p.collection;
  if (c.sizes.length) p.sizes = c.sizes; else delete p.sizes;
  if (c.sleeper) p.sleeper = 1; else delete p.sleeper;
  if (c.style && c.type === "bed") p.style = c.style; else delete p.style;
  enrichis++;

  const nouveauCat = c.department === "chambre" ? CHAMBRE_SUB[c.subcategory] : BACK[c.department];

  /* Garde-fou : un produit dont les variantes sont des formats de lit
     (« Lit Queen 60″ ») n'est pas déplacé hors des rayons literie sur la
     seule foi de son nom. Le conflit est signalé, pas tranché. */
  const varTexte = (p.variants || []).map((v) => v.t).join(" ");
  const varLit = /lit\s+(simple|double|queen|king)|39\u2033|54\u2033|60\u2033|78\u2033/i.test(varTexte);
  if (nouveauCat && nouveauCat !== avantCat && varLit && !LITERIE.has(nouveauCat)) {
    conflits.push({ sku: p.sku, nom: p.name, sub: p.sub || "", nom_dit: c.type, sub_dit: "variantes = formats de lit", cat: avantCat });
    continue;
  }

  if (nouveauCat && nouveauCat !== avantCat) {
    p.cat = nouveauCat;
    corriges++;
    journal.push({ sku: p.sku, nom: p.name, de: avantCat, vers: nouveauCat, type: c.type, coll: c.collection || "" });
  }
}

const APRES = cat.length;
if (APRES !== AVANT) { console.error(`PERTE DE PRODUITS ${AVANT} → ${APRES} — écriture refusée`); process.exit(1); }

console.log(`produits ${AVANT} → ${APRES} (supprimés : 0)`);
console.log(`enrichis : ${enrichis} · département corrigé : ${corriges} · non classés : ${incertains} · conflits nom/sous-ligne : ${conflits.length}`);
if (conflits.length) {
  console.log("\n=== CONFLITS DE SOURCE (intacts — à trancher par le propriétaire) ===");
  conflits.forEach((c) => console.log(`  ${(c.sku||"—").padEnd(10)} « ${c.nom} »\n${" ".repeat(13)}sous-ligne « ${c.sub} »  →  nom dit ${c.nom_dit}, sous-ligne dit ${c.sub_dit}`));
}
if (journal.length) {
  console.log("\n=== DÉPLACEMENTS ===");
  journal.forEach((j) => console.log(`  ${(j.sku||"—").padEnd(12)} ${j.de.padEnd(12)}→ ${j.vers.padEnd(10)} ${j.type.padEnd(16)} ${j.nom.slice(0,44)}`));
}
if (DRY) { console.log("\n--dry-run : rien écrit"); process.exit(0); }
writeFileSync(file, src.replace(bloc[0], "window.CATALOG = " + JSON.stringify(cat) + ";\n"));
writeFileSync(path.join(ROOT, "tools/moved-skus.json"), JSON.stringify(journal, null, 1) + "\n");
writeFileSync(path.join(ROOT, "tools/conflicts.json"), JSON.stringify(conflits, null, 1) + "\n");
console.log("\ndata.js écrit · journal dans tools/moved-skus.json");
