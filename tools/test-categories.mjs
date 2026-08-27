/* ============================================================
   Tests d'intégrité du catalogue — node tools/test-categories.mjs
   Sort en code 1 au premier échec : utilisable en CI / pre-push.
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MAP } from "./classify.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lire = (f) => readFileSync(path.join(ROOT, f), "utf8");
const CAT = JSON.parse(lire("data.js").match(/window\.CATALOG\s*=\s*(\[[\s\S]*?\]);\s*\n/)[1]);

const TOTAL_ATTENDU = 961;      // ← relever ce nombre en même temps qu'un ajout réel
const NON_CLASSES_MAX = 3;      // 2 sans type + 1 conflit de source assumé

// Les puces de sous-filtre, recopiées d'app.js. Le test échoue si elles divergent.
const SUBS = JSON.parse(lire("tools/subs.json"));

let echecs = 0;
const ok = (nom, cond, detail = "") => {
  console.log(`${cond ? "  ok  " : "ÉCHEC "} ${nom}${detail && !cond ? "\n         " + detail : ""}`);
  if (!cond) echecs++;
};

ok(`aucun produit perdu (${TOTAL_ATTENDU})`, CAT.length === TOTAL_ATTENDU, `trouvé ${CAT.length}`);

const sansType = CAT.filter((p) => !p.type);
ok("tout produit porte un type canonique", sansType.length <= NON_CLASSES_MAX,
   sansType.map((p) => p.name).join(" · "));

const orphelins = CAT.filter((p) => p.type && !MAP[p.type]);
ok("tout type connaît son département", orphelins.length === 0,
   [...new Set(orphelins.map((p) => p.type))].join(" · "));

const incoherents = CAT.filter((p) => p.type && MAP[p.type] && (MAP[p.type][0] !== p.dept || MAP[p.type][1] !== p.subcat));
ok("dept/subcat concordent avec le type", incoherents.length === 0,
   incoherents.slice(0, 5).map((p) => `${p.name} (${p.type}→${p.dept}/${p.subcat})`).join(" · "));

// Le cœur du problème signalé : chevauchement et angles morts des filtres.
const inSub = (p, d) => (d.style ? p.style === d.style : (d.types || []).includes(p.type));
for (const [cat, defs] of Object.entries(SUBS)) {
  const base = CAT.filter((p) => p.cat === cat);
  const styles = defs.filter((d) => d.style), types = defs.filter((d) => !d.style);
  const multi = base.filter((p) => types.filter((d) => inSub(p, d)).length > 1);
  ok(`« ${cat} » : aucun produit dans deux puces à la fois`, multi.length === 0,
     multi.slice(0, 5).map((p) => p.name).join(" · "));
  const aucune = base.filter((p) => !defs.some((d) => inSub(p, d)));
  ok(`« ${cat} » : aucun produit hors de toute puce`, aucune.length === 0,
     `${aucune.length} orphelins — ex. ${aucune.slice(0, 4).map((p) => p.name).join(" · ")}`);
  void styles;
}

const skus = {};
CAT.forEach((p) => p.sku && (skus[p.sku] = (skus[p.sku] || 0) + 1));
const collisions = Object.entries(skus).filter(([, n]) => n > 1);
console.log(`\n  info  ${Object.keys(skus).length} SKU distincts · ${collisions.length} partagés (ensembles + leurs pièces)`);

console.log(echecs ? `\n${echecs} test(s) en échec` : "\nTous les tests passent");
process.exit(echecs ? 1 : 0);
