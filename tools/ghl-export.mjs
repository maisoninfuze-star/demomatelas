/* ============================================================
   Export catalogue → GoHighLevel (Paiements › Produits › Import CSV)
       node tools/ghl-export.mjs
   Sort exports/ghl/literie-ghl-produits.csv (tout le catalogue) et un
   fichier par rayon, au format EXACT du gabarit « Download sample CSV »
   de GoHighLevel (29 colonnes, style Shopify : une ligne par variante,
   les colonnes produit remplies sur la première ligne seulement).

   Ce que l'import GHL accepte et refuse — vérifié sur l'aperçu réel :
     — une ligne sans prix (ligne « image seule ») est REFUSÉE :
       « Cannot have row without any variants » → une seule image par
       produit, celle de la première ligne ;
     — le titre et les champs SEO gardent l'UTF-8 (« — » passe), mais la
       colonne Body (HTML) affiche « ��� » pour tout caractère hors
       Latin-1 → on les encode en entités HTML numériques (&#x2014;) ;
     — un produit sans option (Option1 vides) passe : GHL nomme alors le
       prix « Titre @ prix » ;
     — les guillemets dans les valeurs d'option se doublent («""») ;
     — l'import ne met JAMAIS à jour un produit existant : ce qui entre
       avec une erreur devra être supprimé à la main, d'où le soin mis
       aux doublons et aux références ci-dessous.

   data.js reste la source unique : prix, variantes, retraits « off ».
   Un produit retiré chez IFDC n'est pas exporté du tout — GHL ne doit
   jamais pouvoir facturer un meuble que le fournisseur ne livre plus.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "exports", "ghl");
mkdirSync(OUT, { recursive: true });

const win = {};
new Function("window", readFileSync(path.join(ROOT, "data.js"), "utf8"))(win);
const CATALOG = win.CATALOG || [];
const COLLECTIONS = win.COLLECTIONS || [];
const byHandle = (h) => CATALOG.find((p) => p.h === h);

/* Les 29 colonnes du gabarit GoHighLevel, dans l'ordre, sans en retirer
   aucune : l'aide GHL est explicite, les en-têtes doivent rester intacts. */
const COLS = [
  "Handle", "Title", "Body (HTML)", "Included in Online Store", "Image Src",
  "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant Price", "Variant Compare At Price",
  "Track Inventory", "Allow Out of Stock Purchases", "Available Quantity", "SKU",
  "Weight Value", "Weight Unit", "Dimension Length", "Dimension Width", "Dimension Height", "Dimension Unit",
  "Product Label Enable", "Label Title", "Label Start Date", "Label End Date",
  "SEO Title", "SEO Description",
];

const RAYON = {
  chambre: "Chambre", salon: "Salon", matelas: "Matelas & sommiers",
  salle: "Salle à manger", bureau: "Bureau", decor: "Rangement & décor",
};

/* ---------- Texte ---------- */
const propre = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

// Champ CSV : guillemets doublés, entouré si nécessaire. Jamais de saut de ligne.
const csv = (v) => {
  const s = propre(v);
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Texte → HTML sûr : échappement des 5 caractères réservés, puis entités
// numériques pour tout ce qui dépasse Latin-1 (voir en-tête du fichier).
const html = (s) =>
  propre(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#x27;")
    .replace(/[Ā-￿]/g, (c) => "&#x" + c.charCodeAt(0).toString(16) + ";");

// Slug majuscule sans accents, coupé à une frontière de mot.
const ORPHELINS = /-(DE|D|L|A|AU|ET|EN|LA|LE|LES|DU|DES|POUR|AVEC|SANS|FOR|WITH|W)$/;
const slug = (s, max = 24) => {
  const t = propre(s).replace(/(\d)\.(\d)/g, "$1$2") // 8.5″ → 85, jamais coupé en « 8 »
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
  let r = t;
  if (t.length > max) {
    const c = t.slice(0, max + 1);
    r = (c.includes("-") ? c.slice(0, c.lastIndexOf("-")) : c.slice(0, max)).replace(/-$/, "");
  }
  return r.replace(ORPHELINS, "");
};

/* ---------- Image ----------
   Un même fichier Wix revient 19 fois dans data.js : sans extension il
   renvoie 403, avec « ~mv2.jpg » c'est le logo du fournisseur IFDC. Ni
   l'un ni l'autre n'est une photo de produit ; on prend la première
   vraie image, ou rien (GHL accepte une image vide).
   Les adresses de transformation Wix contiennent des virgules
   (w_1200,h_1200,q_85) : on les encode en %2C — Wix sert exactement le
   même fichier — pour qu'aucun importateur ne puisse y voir une liste. */
const IMG_FANTOME = /c1a65e_454d4f3f032f4619ba661f4a42370fea/;
const imageDe = (p) => {
  const u = (p.imgs || []).find((x) => x && /^https?:\/\//.test(x) && !IMG_FANTOME.test(x)) || "";
  return u.replace(/,/g, "%2C");
};

/* ---------- Pièces incluses dans un ensemble ----------
   Même règle que la fiche collection du site : les pièces d'un ensemble
   sont les produits dont le nom commence par le nom de l'ensemble suivi
   de « — » (même coloris), hors l'ensemble lui-même. On cherche dans la
   collection déclarée, sinon dans le catalogue par nom de collection
   (Reid et Olivia ont leurs pièces mais pas d'entrée COLLECTIONS). */
function piecesIncluses(p) {
  if (p.type !== "bedroom-set" && p.type !== "dining-set") return [];
  const c = COLLECTIONS.find((c) => (c.handles || []).includes(p.h));
  const bassin = c
    ? (c.handles || []).map(byHandle).filter(Boolean)
    : CATALOG.filter((x) => p.collection && x.collection === p.collection);
  const prefixe = p.name + " — ";
  const noms = bassin
    .filter((x) => x !== p && !x.off && x.from > 0 && x.name.startsWith(prefixe))
    .map((x) => x.name.slice(prefixe.length));
  return [...new Set(noms)];
}

function corpsHTML(p) {
  const parts = [];
  parts.push(`<p>${html(p.sub || p.name)}</p>`);
  const inc = piecesIncluses(p);
  if (inc.length) parts.push(`<p>Inclus dans cet ensemble : ${html(inc.join(", "))}.</p>`);
  if (p.collection) parts.push(`<p>Collection ${html(p.collection)}</p>`);
  if (p.sku) parts.push(`<p>Réf. ${html(p.sku)}</p>`);
  return parts.join("");
}

/* ---------- Variantes ---------- */
const DEFAUT = "Default Title";
const estEnsemble = (p) => p.type === "bedroom-set" || p.type === "dining-set";
// Même expression que prixAffiche() dans app.js : les variantes qui
// désignent l'ensemble complet, par opposition à ses pièces.
const RE_ENSEMBLE = /^ensemble|ensemble\s+(de\s+)?(chambre|salle)|\d\s*pc\b|\d\s*pi[èe]ces/i;

const RE_TAILLE = /\b(30|39|54|60|78)\b|simple|single|twin|double|queen|king/i;
// « coffre » seul désignait aussi les « Lit coffre » (lits avec rangement) :
// on n'accepte que le coffre en début de libellé, ou le banc coffre.
const RE_PIECE = /chest|chiffonnier|commode|table de nuit|miroir|dressoir|\bbanc\b|^coffre\b|\bsofa\b|\blove\b|\bchaise\b|recliner|inclinable|table basse|table d[\u2019']appoint|sectional|secional/i;
const RE_COULEUR = /^(espresso|gris|grey|gray|blanc|white|noir|black|honey|miel|beige|brun|brown|naturel|natural|taupe|cr[èe]me|cream|argent|silver|rouge|red|bleu|blue)(\s*pu)?$/i;

// Nom de l'option : ce que les valeurs distinguent réellement.
function nomOption(variants) {
  const t = variants.map((v) => v.t);
  // « Tabouret de bar - Grey PU — l'unité » vs « … Red PU … » : une fois le
  // texte commun retiré, il ne reste que la couleur.
  if (sansTexteCommun(t).every((x) => RE_COULEUR.test(x))) return "Couleur";
  if (t.every((x) => RE_TAILLE.test(x) && !RE_PIECE.test(x))) return "Format";
  if (t.every((x) => RE_PIECE.test(x))) return "Pièce";
  return "Choix";
}

/* Descripteurs d'un libellé de variante : nature, épaisseur, largeur,
   particularités, couleur. Le code SKU d'une variante ne garde que les
   descripteurs qui la DISTINGUENT des autres variantes du même produit —
   « Ensemble chambre — Queen 60″ » et « Lit Queen 60″ (sommier requis) »
   donnent ENS-60 et LIT-60, jamais 60 et 60-2. */
const LARGEURS = new Set(["30", "39", "54", "60", "78"]);
const COULEURS = [
  [/espresso/, "ESP"], [/\b(gris|grey|gray)\b/, "GRIS"], [/\b(blanc|white)\b/, "BLANC"],
  [/\b(noir|black)\b/, "NOIR"], [/\b(honey|miel)\b/, "MIEL"], [/\bbeige\b/, "BEIGE"],
  [/\b(brun|brown)\b/, "BRUN"], [/\b(naturel|natural)\b/, "NAT"], [/\btaupe\b/, "TAUPE"],
  [/\b(cr[èe]me|cream)\b/, "CREME"], [/\b(argent|silver)\b/, "ARG"], [/\b(rouge|red)\b/, "ROUGE"],
  [/\b(bleu|blue)\b/, "BLEU"],
];
function descripteurs(t) {
  const s = t.toLowerCase();
  const d = [];
  if (RE_ENSEMBLE.test(s)) d.push("ENS");
  else if (/support/.test(s)) d.push("SUP");
  else if (/\b(lit|bed)\b/.test(s)) d.push("LIT");
  else if (/table de nuit|nightstand/.test(s)) d.push("TN");
  else if (/chiffonnier|chest/.test(s)) d.push("CH");
  else if (/commode|dresser|dressoir/.test(s)) d.push("CM");
  else if (/matelas|mattress/.test(s)) d.push("MAT");
  else if (/sommier|box spring/.test(s)) d.push("SOM");
  else if (/\b(banc|bench)\b/.test(s)) d.push("BANC");
  else if (/ottoman/.test(s)) d.push("OTT");
  // Pouces : les largeurs de lit sont des formats, tout autre nombre
  // suivi d'un pouce est une épaisseur (matelas 4″, 6″, 8″…).
  for (const m of s.matchAll(/(\d{1,2})\s*[″"”]/g)) {
    if (LARGEURS.has(m[1])) { if (!d.includes(m[1])) d.push(m[1]); }
    else d.push("EP" + m[1]);
  }
  if (!d.some((x) => LARGEURS.has(x))) {
    if (/twin\s*xl/.test(s)) d.push("39XL");
    else if (/\b(simple|single|twin)\b/.test(s)) d.push("39");
    else if (/\b(double|full)\b/.test(s)) d.push("54");
    else if (/\bqueen\b/.test(s)) d.push("60");
    else if (/\bking\b/.test(s)) d.push("78");
  } else if (/twin\s*xl/.test(s)) d.push("XL");
  if (/divis/.test(s)) d.push("DIV");
  if (/gigogne|trundle/.test(s)) d.push("GIG");
  if (/pliant|folding/.test(s)) d.push("PLI");
  if (/rangement|storage/.test(s)) d.push("RANG");
  const code = s.match(/\((\d[a-z])\)/); // (8A), (8D)
  if (code) d.push(code[1].toUpperCase());
  for (const [re, c] of COULEURS) if (re.test(s)) { d.push(c); break; }
  return d;
}

// Préfixe de mots commun à tous les libellés d'un produit — ce qui reste
// après l'avoir retiré est ce qui distingue chaque variante.
function sansTexteCommun(labels) {
  if (labels.length < 2) return labels.map(propre);
  const mots = labels.map((l) => propre(l).split(" "));
  const eq = (a, b) => a.toLowerCase() === b.toLowerCase();
  let n = 0;
  while (mots.every((m) => m.length > n + 1 && eq(m[n], mots[0][n]))) n++;
  let f = 0;
  while (mots.every((m) => m.length - f > n + 1 && eq(m[m.length - 1 - f], mots[0][mots[0].length - 1 - f]))) f++;
  return mots.map((m) => m.slice(n, m.length - f).join(" "));
}

function codesVariantes(variants) {
  // Une seule variante : la référence de base suffit, elle est déjà unique.
  if (variants.length === 1) return [""];
  const labels = variants.map((v) => v.t);
  const desc = labels.map(descripteurs);
  const communs = desc[0].filter((x) => desc.every((d) => d.includes(x)));
  let codes = desc.map((d) => d.filter((x) => !communs.includes(x)).join("-"));
  // Descripteurs insuffisants (vides ou identiques) : on retombe sur le
  // libellé lui-même, débarrassé de ce que toutes les variantes partagent.
  const ambigus = codes.some((c, i) => !c || codes.indexOf(c) !== i);
  if (ambigus) {
    const restes = sansTexteCommun(labels);
    codes = codes.map((c, i) => (!c || codes.indexOf(c) !== i) ? slug(restes[i] || labels[i], 20) : c);
  }
  return codes;
}

/* ---------- Références ----------
   Une référence par ligne, unique dans tout le fichier. La référence
   fournisseur est gardée telle quelle quand un seul produit la porte.
   Quand plusieurs produits partagent la même (T-1447 est sur 15 produits :
   la table seule et chacun de ses ensembles avec chaises ; IF-100 sur les
   cinq pièces Madison), on la complète avec ce qui les distingue plutôt
   qu'un compteur : le handle IFDC porte déjà les chaises (T-1447-C-1262),
   les pièces d'une collection portent leur nature (IF-100-TN). */
const NATURE = {
  "bedroom-set": "ENS", "dining-set": "ENS", chest: "CH", nightstand: "TN", dresser: "CM",
  bed: "LIT", headboard: "TDL", bench: "BANC", mattress: "MAT", "box-spring": "SOM", ottoman: "OTT",
  "dining-table": "TABLE", "dining-chair": "CHAISE", "bar-stool": "TAB", "coffee-table": "TB",
  "end-table": "TA", "console-table": "CONS", "tv-stand": "TV", sofa: "SOFA", recliner: "INC",
  "sofa-bed": "CL", sectional: "SECT", "accent-chair": "FAUT", desk: "BUR", "office-chair": "CB",
  shelving: "ETAG", "coat-rack": "PORTM", "adjustable-base": "BASE",
};
function baseSku(p, partage) {
  const ifdc = p.h.startsWith("ifdc-") ? p.h.slice(5).toUpperCase() : "";
  if (p.sku) {
    if (!partage.has(p.sku)) return p.sku;
    if (ifdc) {
      // Le handle IFDC porte ce qui distingue les produits d'une même
      // référence (T-1447-C-1262, B-1890-EK) — sauf quand ce n'est qu'un
      // numéro : « -2 » ne dit rien, le nombre de pièces ou la nature, si.
      const queue = ifdc.startsWith(p.sku.toUpperCase()) ? ifdc.slice(p.sku.length) : "";
      if (!queue) return ifdc; // le produit de base garde la référence nue
      const pieces = p.name.match(/(\d+)\s*pi[èe]ces/i);
      // Un chiffre seul en fin de handle (T-1402-C-1782-2) est un numéro de
      // copie ; un code de chaise (C-1262) fait toujours plusieurs chiffres.
      if (/-\d$/.test(queue)) {
        if (pieces) return `${p.sku}${queue.replace(/-\d$/, "")}-${pieces[1]}PC`;
        return p.sku + (NATURE[p.type] ? "-" + NATURE[p.type] : "");
      }
      return ifdc;
    }
    return p.sku + (NATURE[p.type] ? "-" + NATURE[p.type] : "");
  }
  if (ifdc) return ifdc; // T-TORONTO, C-YLIME : le code fournisseur est dans le handle
  // Sans référence fournisseur : le nom, ou pour une pièce de collection
  // (« Jordyn « Ava » (Gris) — Chiffonnier ») la collection + la nature,
  // pour que la pièce et son ensemble ne se disputent pas le même code.
  const i = p.name.indexOf(" — ");
  if (i > 0) return "LDA-" + slug(p.name.slice(0, i), 20) + "-" + (NATURE[p.type] || slug(p.name.slice(i + 3), 10));
  return "LDA-" + slug(p.name, 24);
}
const skusVus = new Set();
function skuUnique(base) {
  let s = base.replace(/[^A-Za-z0-9\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!skusVus.has(s)) { skusVus.add(s); return s; }
  let n = 2;
  while (skusVus.has(`${s}-${n}`)) n++;
  skusVus.add(`${s}-${n}`);
  return `${s}-${n}`;
}

/* ---------- Sélection ---------- */
const exportables = CATALOG.filter((p) => !p.off && (p.variants || []).some((v) => v.p > 0));

// Doublons stricts (même nom, mêmes variantes, mêmes prix) : le catalogue
// en garde quelques-uns de l'ancienne boutique. Un seul entre dans GHL,
// le premier rencontré — l'import ne sachant pas mettre à jour, un doublon
// importé resterait à supprimer à la main.
const empreinte = (p) => p.name + "|" + p.variants.map((v) => v.t + "=" + v.p).join("|");
const vus = new Map();
const doublons = [];
const retenus = exportables.filter((p) => {
  const e = empreinte(p);
  if (vus.has(e)) { doublons.push({ ignore: p.h, garde: vus.get(e) }); return false; }
  vus.set(e, p.h);
  return true;
});

const partage = new Set();
{
  const n = new Map();
  for (const p of retenus) if (p.sku) n.set(p.sku, (n.get(p.sku) || 0) + 1);
  for (const [k, v] of n) if (v > 1) partage.add(k);
}

/* ---------- Lignes ---------- */
const journal = {
  exportes: 0, lignes: 0, retires: CATALOG.filter((p) => p.off).map((p) => p.h),
  doublonsIgnores: doublons, sansImage: [], multi: 0, sansSku: 0, parRayon: {}, options: {},
};
const parRayon = {};

for (const p of retenus) {
  let variants = p.variants.filter((v) => v.p > 0);
  // Sur une fiche d'ensemble, GHL prend la première variante comme prix
  // par défaut : ce doit être l'ensemble complet, jamais la table de nuit.
  if (estEnsemble(p)) variants = [...variants.filter((v) => RE_ENSEMBLE.test(v.t)), ...variants.filter((v) => !RE_ENSEMBLE.test(v.t))];

  const base = baseSku(p, partage);
  if (!p.sku) journal.sansSku++;
  const simple = variants.length === 1 && variants[0].t === DEFAUT;
  if (!simple) journal.multi++;
  const option = simple ? "" : nomOption(variants);
  if (option) journal.options[option] = (journal.options[option] || 0) + 1;
  const codes = simple ? [""] : codesVariantes(variants);
  const image = imageDe(p);
  if (!image) journal.sansImage.push(p.h);
  const seoTitre = `${p.name} | Literie d'Amitié`;
  const seoDesc = propre(p.sub || `${p.name} — ${RAYON[p.dept] || "Meubles"} à prix d'usine, Literie d'Amitié Montréal.`).slice(0, 160);

  const lignes = variants.map((v, i) => {
    const r = Object.fromEntries(COLS.map((c) => [c, ""]));
    r["Handle"] = p.h;
    if (i === 0) {
      r["Title"] = p.name;
      r["Body (HTML)"] = corpsHTML(p);
      r["Included in Online Store"] = "TRUE";
      r["Image Src"] = image;
      r["Option1 Name"] = option;
      r["Track Inventory"] = "FALSE";
      r["Product Label Enable"] = "FALSE";
      r["SEO Title"] = seoTitre;
      r["SEO Description"] = seoDesc;
    }
    r["Option1 Value"] = simple ? "" : v.t;
    r["Variant Price"] = v.p.toFixed(2);
    r["SKU"] = skuUnique(codes[i] ? `${base}-${codes[i]}` : base);
    return COLS.map((c) => csv(r[c])).join(",");
  });

  (parRayon[p.dept] ||= []).push(...lignes);
  journal.exportes++;
  journal.lignes += lignes.length;
  journal.parRayon[p.dept] = (journal.parRayon[p.dept] || 0) + 1;
}

const entete = COLS.join(",");
const tout = [entete];
for (const [dept, lignes] of Object.entries(parRayon)) {
  tout.push(...lignes);
  writeFileSync(path.join(OUT, `literie-ghl-${dept}.csv`), [entete, ...lignes].join("\n") + "\n", "utf8");
}
writeFileSync(path.join(OUT, "literie-ghl-produits.csv"), tout.join("\n") + "\n", "utf8");
writeFileSync(path.join(OUT, "journal.json"), JSON.stringify(journal, null, 2) + "\n");

console.log(`GHL : ${journal.exportes} produits, ${journal.lignes} lignes · ${journal.retires.length} retirés (off) · ${doublons.length} doublons ignorés · ${journal.multi} à variantes · ${journal.sansSku} sans référence fournisseur · ${journal.sansImage.length} sans image`);
console.log("Par rayon :", journal.parRayon, "Options :", journal.options);
console.log("→", path.relative(ROOT, path.join(OUT, "literie-ghl-produits.csv")));
