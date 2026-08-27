/* ============================================================
   Audit de classification — rapport AVANT toute modification.
       node tools/audit-categories.mjs
   N'écrit rien dans data.js. Produit tools/audit-categories.md
   et un résumé en console.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classify, LEGACY_DEPT, MAP } from "./classify.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const win = {};
new Function("window", readFileSync(path.join(ROOT, "data.js"), "utf8"))(win);
const CAT = win.CATALOG;

const LABEL = {
  matelas: "Matelas", chambre: "Chambre", salon: "Salon",
  salle: "Salle à manger", bureau: "Bureau", decor: "Décor",
};
const SUBLABEL = {
  modeles: "Modèles", sommiers: "Sommiers", "bases-ajustables": "Bases ajustables",
  lits: "Lits", "tetes-de-lit": "Têtes de lit", ensembles: "Ensembles de chambre",
  commodes: "Commodes", chiffonniers: "Chiffonniers", "tables-de-nuit": "Tables de nuit",
  armoires: "Armoires", miroirs: "Miroirs",
  sectionnels: "Sectionnels", canapes: "Canapés", causeuses: "Causeuses",
  "canapes-lits": "Canapés-lits", inclinables: "Fauteuils inclinables",
  fauteuils: "Fauteuils d'appoint", ottomans: "Ottomans", bancs: "Bancs",
  "tables-basses": "Tables basses", "tables-appoint": "Tables d'appoint",
  consoles: "Consoles", "meubles-tele": "Meubles télé",
  tables: "Tables", chaises: "Chaises", banquettes: "Banquettes",
  tabourets: "Tabourets", buffets: "Buffets",
  bureaux: "Bureaux", "chaises-bureau": "Chaises de bureau",
  bibliotheques: "Bibliothèques", classeurs: "Classeurs",
  tapis: "Tapis", luminaires: "Luminaires",
};
const LEGACY_LABEL = {
  matelas: "Matelas & sommiers", lits: "Lits & têtes de lit",
  ensembles: "Ensembles de chambre", pieces: "Commodes & tables de nuit",
  sectionnels: "Sectionnels-lits", salon: "Salon",
  salle: "Salle à manger", divers: "Bureau & divers",
};
const chemin = (c) => `${LABEL[c.department] || "?"} > ${SUBLABEL[c.subcategory] || c.subcategory || "?"}`;

const moved = [], correct = [], uncertain = [], dupes = [];

for (const p of CAT) {
  const c = classify(p);
  if (!c.type) {
    uncertain.push({ p, c, why: "Aucune règle ne s'applique — accessoire ou libellé hors convention." });
    continue;
  }
  const legacyDept = LEGACY_DEPT[p.cat];
  const rec = { p, c, oldPath: LEGACY_LABEL[p.cat], newPath: chemin(c) };

  // §4 / §12 : un ensemble doit vraiment vendre plusieurs pièces
  if (p.cat === "ensembles" && c.type !== "bedroom-set") {
    rec.why = `Pièce individuelle (${c.type}). « ${c.collection || "—"} » est le nom de la collection, pas l'indication que ce SKU vend un ensemble complet.`;
    moved.push(rec); continue;
  }
  if (legacyDept !== c.department) {
    rec.why = raison(p, c);
    moved.push(rec); continue;
  }
  // même département : la sous-catégorie est un gain d'architecture, pas une erreur
  correct.push(rec);
}

function raison(p, c) {
  const t = c.type;
  if (t === "recliner")        return "Fauteuil inclinable, pas un canapé : « Recliner » dans le descriptif. Type propre selon §10.";
  if (t === "adjustable-base") return "Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.";
  if (t === "box-spring")      return "Sommier, pas un matelas. §7 : le sommier a sa propre sous-catégorie.";
  if (t === "sectional")       return "Sectionnel : sous-catégorie du Salon, pas un département de premier niveau.";
  if (t === "accent-chair")    return "Fauteuil d'appoint, pas un canapé — le descriptif le nomme explicitement.";
  if (t === "sofa-bed")        return "Canapé-lit : identité propre, distincte du sectionnel et du canapé.";
  if (t === "office-chair")    return "Chaise de bureau — §13 : ne doit pas tomber dans les chaises de salle à manger.";
  if (t === "desk")            return "Bureau de travail — département Bureau.";
  if (t === "bookcase")        return "Bibliothèque / étagère — département Bureau.";
  if (t === "tv-stand")        return "Meuble télé — §14 : n'appartient ni au bureau ni au mobilier d'appoint.";
  if (t === "coffee-table")    return "Table basse — Salon, jamais Salle à manger (§11).";
  if (t === "end-table")       return "Table d'appoint — Salon (§11).";
  if (t === "console-table")   return "Table console — Salon (§11).";
  if (t === "nightstand")      return "Table de nuit — Chambre, jamais une table de salle à manger (§11).";
  if (t === "dresser")         return `Commode individuelle.${c.collection ? ` « ${c.collection} » est la collection, pas un ensemble.` : ""}`;
  if (t === "chest")           return `Chiffonnier / coffre individuel.${c.collection ? ` Collection « ${c.collection} ».` : ""}`;
  if (t === "mirror")          return "Miroir de commode — Chambre > Miroirs.";
  if (t === "headboard")       return "Tête de lit seule — pas un lit complet (§4).";
  if (t === "bed")             return "Cadre de lit — Chambre > Lits, jamais Matelas (§6).";
  if (t === "mattress")        return "Matelas — le format est un attribut, pas le type (§5).";
  return `Type canonique « ${t} » incompatible avec le département actuel.`;
}

/* §19 — un même SKU réclamé par deux identités */
const bySku = {};
CAT.forEach((p) => { const s = classify(p).sku; if (s) (bySku[s] = bySku[s] || []).push(p); });
for (const [sku, list] of Object.entries(bySku)) {
  if (list.length < 2) continue;
  const types = [...new Set(list.map((p) => classify(p).type))];
  if (types.length > 1) dupes.push({ sku, list, types });
}

/* ---------- rapport ---------- */
const L = [];
L.push("# Audit de classification — Literie d'Amitié", "");
L.push(`_Généré le ${new Date().toLocaleDateString("fr-CA")} · aucune modification appliquée._`, "");
L.push("```");
L.push(`TOTAL PRODUITS SCANNÉS:            ${CAT.length}`);
L.push(`CORRECTEMENT CLASSÉS:              ${correct.length}`);
L.push(`MAL CLASSÉS:                       ${moved.length}`);
L.push(`DÉPLACÉS (appliqué):               0   ← rapport seulement`);
L.push(`INCERTAINS:                        ${uncertain.length}`);
L.push(`SKU À CLASSIFICATION CONTRADICTOIRE: ${dupes.length}`);
L.push(`PRODUITS SUPPRIMÉS:                0`);
L.push("```", "");

const parType = {};
moved.forEach((m) => (parType[m.c.type] = (parType[m.c.type] || 0) + 1));
L.push("## Mal classés, par type canonique", "");
L.push("| Type | Nombre | Destination |", "|---|---|---|");
Object.entries(parType).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => {
  const [d, s] = MAP[t] || ["", ""];
  L.push(`| \`${t}\` | ${n} | ${LABEL[d]} > ${SUBLABEL[s] || s} |`);
});
L.push("");

L.push("## Détail — chaque SKU mal classé", "");
for (const m of moved) {
  L.push("```");
  L.push(`SKU:        ${m.c.sku || "—"}`);
  L.push(`PRODUIT:    ${m.p.name}`);
  L.push(`ACTUEL:     ${m.oldPath}`);
  L.push(`CORRECT:    ${m.newPath}`);
  L.push(`COLLECTION: ${m.c.collection || "—"}`);
  if (m.c.sizes.length) L.push(`FORMATS:    ${m.c.sizes.join(", ")}`);
  L.push(`RAISON:     ${m.why}`);
  L.push("```", "");
}

L.push("## Incertains — laissés intacts (§26)", "");
for (const u of uncertain) {
  L.push("```");
  L.push(`SKU:        ${u.c.sku || "—"}`);
  L.push(`PRODUIT:    ${u.p.name}`);
  L.push(`ACTUEL:     ${LEGACY_LABEL[u.p.cat]}`);
  L.push(`PROBABLE:   à déterminer`);
  L.push(`CONFIANCE:  faible`);
  L.push(`RAISON:     ${u.why}`);
  L.push("```", "");
}

if (dupes.length) {
  L.push("## SKU réclamés par deux identités (§19)", "");
  dupes.forEach((d) => {
    L.push("```");
    L.push(`SKU: ${d.sku}`);
    d.list.forEach((p) => L.push(`  ${classify(p).type.padEnd(16)} ${p.name}`));
    L.push("```", "");
  });
}

writeFileSync(path.join(ROOT, "tools/audit-categories.md"), L.join("\n") + "\n");
console.log(`scannés ${CAT.length} · corrects ${correct.length} · mal classés ${moved.length} · incertains ${uncertain.length} · SKU contradictoires ${dupes.length}`);
console.log("\n=== MAL CLASSÉS PAR TYPE ===");
Object.entries(parType).sort((a,b)=>b[1]-a[1]).forEach(([t,n])=>{
  const [d,s]=MAP[t]||["",""]; console.log("  "+String(n).padStart(3)+"  "+t.padEnd(16)+"→ "+LABEL[d]+" > "+(SUBLABEL[s]||s));
});
