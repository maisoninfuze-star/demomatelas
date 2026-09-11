/* ============================================================
   Audit des prix et de la cohérence des fiches
       node tools/audit-prix.mjs            → rapport à l'écran
       node tools/audit-prix.mjs --json     → tools/audit-prix.json

   Tout ce qui se vérifie par arithmétique ou par comparaison de
   champs. Ce que seule une paire d'yeux peut juger — « la photo
   montre-t-elle bien un lit ? » — est laissé à l'audit visuel.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(ROOT, "data.js"), "utf8");
const CAT = JSON.parse(src.match(/window\.CATALOG\s*=\s*(\[[\s\S]*?\]);\s*\n/)[1]);
const COL = JSON.parse(src.match(/window\.COLLECTIONS\s*=\s*(\[[\s\S]*?\]);?\s*$/m)[1]);
const by = (h) => CAT.find((p) => p.h === h);
const vivants = CAT.filter((p) => !p.off);

const F = [];
const flag = (gravite, categorie, p, titre, detail) =>
  F.push({ gravite, categorie, sku: p.sku || "", h: p.h, nom: p.name, type: p.type, titre, detail });

const prixDe = (p) => (p.variants || []).map((v) => v.p).filter((n) => n > 0);
const minPrix = (p) => (prixDe(p).length ? Math.min(...prixDe(p)) : 0);
const RE_ENS = /^ensemble|ensemble\s+(de\s+)?(chambre|salle)|\d\s*pc\b|\d\s*pi[èe]ces/i;
const prixEnsemble = (p) => {
  const e = (p.variants || []).filter((v) => RE_ENS.test(v.t) && v.p > 0).map((v) => v.p);
  return e.length ? Math.min(...e) : minPrix(p);
};

/* ───────────── A. Ensembles : prix vs somme des pièces ───────────── */
for (const c of COL) {
  const prods = (c.handles || []).map(by).filter(Boolean).filter((p) => !p.off);
  const sets = prods.filter((p) => p.type === "bedroom-set" || p.type === "dining-set");
  if (!sets.length) continue;
  for (const set of sets) {
  /* Une collection peut réunir deux coloris (« Jordyn (Blanc) », « Jordyn
     « Ava » (Gris) ») : on n'additionne que les pièces qui portent le nom
     de CET ensemble, sinon on compte deux chambres pour une. */
  const prefixe = set.name.replace(/\s*—.*$/, "").trim().toLowerCase();
  const pieces = prods.filter((p) => p !== set && p.type !== "bedroom-set" && p.type !== "dining-set"
    && p.name.toLowerCase().startsWith(prefixe));
  const somme = pieces.reduce((s, p) => s + minPrix(p), 0);
  const ps = prixEnsemble(set);
  const aLit = pieces.some((p) => p.type === "bed");
  const dit = /\blit\b/i.test(set.sub || "");
  const ecart = ps - somme;
  if (pieces.length && somme > 0) {
    if (ecart < 0)
      flag("bloquant", "prix-ensemble", set, "L'ensemble coûte MOINS que ses pièces réunies",
        `ensemble ${ps} $ · pièces ${somme.toFixed(2)} $ (${pieces.length}) · écart ${ecart.toFixed(2)} $`);
    else if (!aLit && dit)
      flag("bloquant", "prix-ensemble", set, "Prix d'ensemble sans aucun lit parmi les pièces, alors que la fiche annonce un lit",
        `ensemble ${ps} $ · pièces sans lit ${somme.toFixed(2)} $ · ${ecart.toFixed(2)} $ non justifiés`);
    else if (ecart > somme * 0.35)
      flag("majeur", "prix-ensemble", set, "Ensemble bien plus cher que la somme de ses pièces",
        `ensemble ${ps} $ · pièces ${somme.toFixed(2)} $ · +${((ecart / somme) * 100).toFixed(0)} %`);
  }
  }
}

/* ───────────── B. Prix nuls, absents, absurdes ───────────── */
for (const p of vivants) {
  const pr = prixDe(p);
  if (!pr.length) flag("bloquant", "prix-absent", p, "Aucun prix > 0", `variantes : ${JSON.stringify((p.variants || []).map((v) => v.p))}`);
  for (const v of p.variants || []) {
    if (v.p > 0 && v.p < 20) flag("majeur", "prix-absurde", p, "Prix anormalement bas", `${v.p} $ — « ${v.t} »`);
    if (v.p > 12000) flag("majeur", "prix-absurde", p, "Prix anormalement élevé", `${v.p} $ — « ${v.t} »`);
  }
}

/* ───────────── C. Valeurs aberrantes par type ───────────── */
const prixRef = (p) => (p.type === "bedroom-set" || p.type === "dining-set" ? prixEnsemble(p) : minPrix(p));
const parType = {};
for (const p of vivants) { const m = prixRef(p); if (m > 0 && p.type) (parType[p.type] = parType[p.type] || []).push(m); }
const mediane = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const p of vivants) {
  const m = prixRef(p); const grp = parType[p.type];
  if (!m || !grp || grp.length < 6) continue;
  const med = mediane(grp);
  if (m > med * 4) flag("majeur", "prix-aberrant", p, `Prix ${(m / med).toFixed(1)}× la médiane de son type`, `${m} $ · médiane ${p.type} = ${med} $`);
  if (m < med / 4 && p.type !== "mattress") flag("majeur", "prix-aberrant", p, `Prix ${(med / m).toFixed(1)}× SOUS la médiane de son type`, `${m} $ · médiane ${p.type} = ${med} $`);
}

/* ───────────── D. Échelle des formats : plus grand doit coûter ≥ ───────────── */
const RANG = { simple: 1, single: 1, twin: 1, "39": 1, double: 2, full: 2, "54": 2, queen: 3, "60": 3, king: 4, "78": 4, "76": 4 };
const rang = (t) => { const s = t.toLowerCase(); for (const k of Object.keys(RANG)) if (new RegExp(`\\b${k}\\b`).test(s)) return RANG[k]; return 0; };
for (const p of vivants) {
  const vs = (p.variants || []).filter((v) => v.p > 0 && rang(v.t));
  if (vs.length < 2) continue;
  // ne comparer qu'à l'intérieur d'une même « famille » (ensemble vs lit seul)
  const fam = (t) => (RE_ENS.test(t) ? "ens" : /sommier|sans sommier|requiert/i.test(t) ? "lit" : "x");
  const groupes = {};
  vs.forEach((v) => (groupes[fam(v.t)] = groupes[fam(v.t)] || []).push(v));
  for (const g of Object.values(groupes)) {
    const tri = [...g].sort((a, b) => rang(a.t) - rang(b.t));
    for (let i = 1; i < tri.length; i++)
      if (rang(tri[i].t) > rang(tri[i - 1].t) && tri[i].p < tri[i - 1].p)
        flag("majeur", "echelle-formats", p, "Un format plus grand coûte moins cher qu'un plus petit",
          `« ${tri[i - 1].t} » ${tri[i - 1].p} $  >  « ${tri[i].t} » ${tri[i].p} $`);
  }
}

/* ───────────── E. Sous-ligne annonce un format, prix vient d'un autre ───────────── */
for (const p of vivants) {
  const v = p.variants || []; if (v.length < 2) continue;
  const r = rang(p.sub || ""); if (!r) continue;
  const mn = Math.min(...v.map((x) => x.p).filter((n) => n > 0));
  const mv = v.find((x) => x.p === mn);
  if (mv && rang(mv.t) && rang(mv.t) !== r)
    flag("majeur", "format-annonce", p, "La sous-ligne annonce un format, le prix « dès » vient d'un autre",
      `annonce « ${(p.sub || "").slice(0, 40)} » · dès ${mn} $ = « ${mv.t} »`);
}

/* ───────────── F. Tous les formats au même prix ───────────── */
for (const p of vivants) {
  const vs = (p.variants || []).filter((v) => v.p > 0 && rang(v.t));
  const rangs = new Set(vs.map((v) => rang(v.t)));
  if (rangs.size >= 3 && new Set(vs.map((v) => v.p)).size === 1)
    flag("mineur", "formats-meme-prix", p, "Trois formats ou plus, tous au même prix", `${vs.length} formats à ${vs[0].p} $`);
}

/* ───────────── G. Convention de prix (.98) rompue ───────────── */
let nb98 = 0, nbRond = 0;
for (const p of vivants) for (const v of p.variants || []) {
  if (!(v.p > 0)) continue;
  const c = Math.round((v.p % 1) * 100);
  if (c === 98 || c === 99) nb98++; else if (c === 0) nbRond++;
}
// signalé une seule fois, en info : pas une erreur, mais un indice de saisie manuelle
F.push({ gravite: "info", categorie: "convention", sku: "", h: "", nom: "—", type: "",
  titre: "Deux conventions de prix cohabitent", detail: `${nb98} prix en .98/.99 · ${nbRond} prix ronds` });

/* ───────────── H. Doublons de nom ───────────── */
const parNom = {};
for (const p of vivants) (parNom[p.name.trim().toLowerCase()] = parNom[p.name.trim().toLowerCase()] || []).push(p);
for (const [, g] of Object.entries(parNom)) if (g.length > 1)
  flag("majeur", "doublon", g[0], "Même nom sur plusieurs fiches", g.map((p) => `${p.h} (${minPrix(p)} $)`).join(" · "));

/* ───────────── I. Même image, types différents ───────────── */
/* Deux CDN, deux formes. Wix : « …/<hash>~mv2.jpg/v1/fit/…/file.jpg » — le
   vrai identifiant est le hash, « file.jpg » n'est qu'un suffixe d'URL.
   Shopify : « …/files/Nom.png » avec parfois un UUID ajouté au re-téléversement. */
const base = (u) => {
  u = u || "";
  const wix = u.match(/([0-9a-f]{20,}~mv2[^/]*)/i);
  if (wix) return wix[1].toLowerCase();
  return u.split("/").pop().split("?")[0].replace(/_[0-9a-f-]{36}(?=\.)/i, "").toLowerCase();
};
const parImg = {};
for (const p of vivants) { const b = base((p.imgs || [])[0]); if (b) (parImg[b] = parImg[b] || []).push(p); }
/* Un ensemble de salle à manger et sa table seule partagent la photo du
   fournisseur : c'est la norme, pas une erreur. On ne signale que les
   partages ENTRE familles de références différentes. */
const famille = (p) => {
  const m = (p.name + " " + (p.sku || "")).match(/\b[A-Z]{1,2}-?\s?(\d{3,5})\b/i);
  return m ? m[1] : null;
};
for (const [b, g] of Object.entries(parImg)) {
  const types = new Set(g.map((p) => p.type));
  if (g.length < 2 || types.size < 2) continue;
  const fams = new Set(g.map(famille).filter(Boolean));
  const memeFamille = fams.size === 1 && g.every(famille);
  flag(memeFamille ? "info" : "majeur", "image-partagee", g[0],
    memeFamille ? "Photo du fournisseur partagée entre un ensemble et ses pièces" : "Même photo sur des produits de familles DIFFÉRENTES",
    `${b.slice(0, 40)} → ${g.map((p) => `${p.name} [${p.type}]`).join(" · ")}`);
}

/* ───────────── J. Fiche « Default Title » alors que la sous-ligne parle de formats ───────────── */
for (const p of vivants) {
  const v = p.variants || [];
  if (v.length === 1 && v[0].t === "Default Title" && /queen|king|double|simple|\b(39|54|60|78)\b/i.test(p.sub || ""))
    flag("mineur", "format-manquant", p, "Un seul prix alors que la sous-ligne mentionne des formats", `sub : « ${(p.sub || "").slice(0, 60)} »`);
}

/* ───────────── K. Ensemble sans lit dans ses images ni ses pièces (heuristique) ───────────── */
for (const p of vivants.filter((p) => p.type === "bedroom-set")) {
  const dit = /\blit\b/i.test(p.sub || "") || /\blit\b/i.test(p.name);
  const c = COL.find((x) => (x.handles || []).includes(p.h));
  const pieces = c ? (c.handles || []).map(by).filter(Boolean) : [];
  const aLit = pieces.some((q) => q.type === "bed") || (p.variants || []).some((v) => /\blit\b/i.test(v.t));
  if (dit && !aLit && pieces.length)
    flag("bloquant", "ensemble-sans-lit", p, "La fiche promet un lit, mais ni les pièces ni les variantes n'en contiennent",
      `pièces : ${pieces.filter((q) => q !== p).map((q) => q.type).join(", ") || "aucune"}`);
}

/* ───────────── Sortie ───────────── */
const ordre = { bloquant: 0, majeur: 1, mineur: 2, info: 3 };
F.sort((a, b) => ordre[a.gravite] - ordre[b.gravite] || a.categorie.localeCompare(b.categorie));
const n = (g) => F.filter((f) => f.gravite === g).length;
console.log(`AUDIT PRIX — ${vivants.length} fiches en vente · ${F.length} constats`);
console.log(`  bloquants ${n("bloquant")} · majeurs ${n("majeur")} · mineurs ${n("mineur")}\n`);
const parCat = {};
F.forEach((f) => (parCat[f.categorie] = (parCat[f.categorie] || 0) + 1));
Object.entries(parCat).sort((a, b) => b[1] - a[1]).forEach(([c, k]) => console.log(`  ${String(k).padStart(4)}  ${c}`));
console.log();
for (const g of ["bloquant", "majeur"]) {
  const l = F.filter((f) => f.gravite === g);
  if (!l.length) continue;
  console.log(`═══ ${g.toUpperCase()} (${l.length}) ═══`);
  l.slice(0, 40).forEach((f) => console.log(`  [${f.categorie}] ${f.nom.slice(0, 40)}\n      ${f.titre}\n      ${f.detail.slice(0, 150)}`));
  if (l.length > 40) console.log(`  … +${l.length - 40}`);
  console.log();
}
if (process.argv.includes("--json")) {
  writeFileSync(path.join(ROOT, "tools/audit-prix.json"), JSON.stringify(F, null, 1));
  console.log("→ tools/audit-prix.json");
}
