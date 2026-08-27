/* ============================================================
   Classifieur canonique du catalogue Literie d'Amitié.

   Le catalogue n'a qu'un champ `cat` : huit départements plats.
   Ni type, ni sous-catégorie, ni collection, ni SKU. Les
   sous-catégories du site sont des expressions régulières
   évaluées à l'affichage — rien n'est stocké.

   Ce module déduit, pour chaque produit, une identité canonique :
       sku · type · department · subcategory · collection · size

   Ordre des règles : du plus spécifique au plus générique. Une
   « table de nuit » doit être reconnue avant « table », un
   « sofa inclinable » avant « sofa ». C'est l'inverse qui produit
   les erreurs qu'on vient corriger.
   ============================================================ */

/* ---------- SKU ---------- */
// IF-9024, T-1447, C-1010, ST-1004, B-1842, T Toronto…
const SKU_RE = /\b((?:IF|T|C|ST|B|BR|DR|TR)[-\s]?\d{2,5}(?:[-\/]\d{2,5})?)\b/i;
export const skuOf = (p) => {
  const m = (p.name + " " + (p.sub || "")).match(SKU_RE);
  return m ? m[1].toUpperCase().replace(/\s+/g, "-") : "";
};

/* ---------- Collections (univers de chambre) ----------
   Une collection est une métadonnée, jamais une sous-catégorie.
   Madison est un univers ; « Madison 6-Drawer Dresser » reste une
   commode. */
const COLLECTIONS = [
  "Madison", "Pompei", "Jordyn", "Ava", "Logan", "Luna", "Riley", "Lucia",
  "Laura", "Reid", "Roxy", "Olivia", "Austin", "Amelia", "Andros", "Aurora",
  "Emma", "Seville", "Harper", "Athens", "Naples", "Verona", "Sienna",
];
export const collectionOf = (p) => {
  const hay = p.name + " " + (p.sub || "");
  for (const c of COLLECTIONS) {
    if (new RegExp("(^|[\\s(«\"'-])" + c + "([\\s)»\"',—-]|$)", "i").test(hay)) return c;
  }
  return "";
};

/* ---------- Format (attribut, jamais type) ---------- */
export const sizeOf = (p) => {
  const hay = (p.name + " " + (p.sub || "") + " " + p.variants.map((v) => v.t).join(" ")).toLowerCase();
  const out = [];
  if (/\bking\b|78\s*″|76\/78/.test(hay)) out.push("king");
  if (/\bqueen\b|60\s*″/.test(hay)) out.push("queen");
  if (/\bdouble\b|54\s*″|\bfull\b/.test(hay)) out.push("double");
  if (/\bsimple\b|39\s*″|\btwin\b/.test(hay)) out.push("simple");
  return out;
};

/* ---------- Règles de type, du plus précis au plus vague ---------- */
const RULES = [
  // ——— Matelas et soutien (§5, §6, §7) ———
  { t: "adjustable-base", re: /lit\s+électrique|base\s+ajustable|ajustable\s+électrique|adjustable\s+base/i },
  { t: "box-spring",      re: /sommier|box\s*spring|boîte\s+à\s+ressorts/i },
  // Une base de futon se décrit « matelas vendu séparément » : la mention
  // du matelas y est une clause, pas le produit. La règle passe avant.
  { t: "sofa-bed",        re: /base\s+de\s+futon|futon\s+base/i },
  { t: "mattress",        re: /\bmatelas\b|mattress/i },

  /* ——— Les ENSEMBLES d'abord ———
     Un « Ensemble de chambre — lit avec rangement intégré » est un ensemble,
     pas un lit. Le nom du groupe cite ses composants ; si une règle de
     composant passe avant, tous les ensembles se dispersent dans les rayons
     de leurs pièces. Ces deux règles doivent rester en tête de liste. */
  { t: "bedroom-set", re: /ensemble\s+de\s+chambre|bedroom\s+set|ensemble\s+chambre/i },
  { t: "dining-set",   re: /ensemble\s+(de\s+)?salle\s+à\s+manger|ensemble\s+pub|dining\s+set|ensemble\s+\d\s*pièces|\d\s*pc\s+din\s+set/i },

  // ——— Composés du salon en « -lit » ———
  // « Sectionnel-lit » et « Canapé-lit » contiennent « -lit ». Sans ces deux
  // règles en tête, un sectionnel convertible devient un cadre de lit.
  // §8 : identité canonique unique, la fonction couchage est un attribut.
  { t: "sectional", re: /sectionnel/i },
  { t: "sofa-bed",  re: /canapé-lit|sofa[-\s]?bed/i },
  { t: "sofa-bed",  re: /futon/i },

  // ——— Chambre : pièces précises avant « lit » ———
  // « lit coffre » est un lit à rangement, pas un coffre : la règle
  // doit passer avant celle des chiffonniers, sinon le lit devient meuble.
  { t: "bed",         re: /lit\s+coffre|lit\s+.*rangement|lit\s+d'appoint|folding\s+bed|lit\s+pliant/i },
  { t: "nightstand",  re: /table\s+de\s+nuit|table\s+de\s+chevet|nightstand|night\s+table/i },
  // « Banc coffre » est un banc, pas un chiffonnier — ancré sur le début du nom.
  { t: "bench",       re: /^banc\b|\bbench\b/i },
  { t: "chest",       re: /chiffonnier|chiffonier|\bchest\b|tallboy|\bcoffre\b/i },
  { t: "dresser",     re: /commode|dressoir|\bdresser\b/i },
  { t: "wardrobe",    re: /armoire|penderie|wardrobe/i },
  { t: "mirror",      re: /^miroir|—\s*miroir|\bmirror\b/i },
  { t: "headboard",   re: /tête\s+de\s+lit|headboard|support.*tête/i },
  { t: "bed",         re: /^lit\b|[—-]\s*lit\b|\blit\s+(simple|double|queen|king|plateforme|superposé|gigogne)|bed\s*frame|bunk|^\d+\"?\s*(double|king|queen|single)\b/i },

  // ——— Salon : le plus spécifique d'abord (§8, §9, §10) ———
  // « Chaise » au sens du fournisseur = méridienne, pas chaise de table.
  { t: "recliner",     re: /lift\s+chaise|rocking\s+chaise|inclinable|recliner|berçante|rocking/i },
  { t: "sofa-bed",     re: /sleeper\s+chaise/i },
  { t: "accent-chair", re: /\bchaise\s+longue\b|méridienne/i },
  { t: "accent-chair", re: /fauteuil|accent\s+chair|chaise\s+d'appoint/i },
  { t: "ottoman",      re: /ottoman|pouf|repose-pied/i },
  { t: "loveseat",     re: /causeuse|loveseat/i },

  // ——— Tables : règles précises AVANT « table » (§11) ———
  { t: "coffee-table",  re: /table\s+basse|table\s+à\s+café|coffee\s+(table|set)|coffee\s+tbl/i },
  { t: "end-table",     re: /table\s+d'appoint|table\s+de\s+bout|end\s+table|side\s+table/i },
  { t: "console-table", re: /console/i },
  { t: "tv-stand",      re: /meuble\s+t[ée]l[ée]|tv\s+stand|meuble\s+tv/i },

  // ——— Bureau (§13) ———
  { t: "office-chair",   re: /chaise\s+de\s+bureau|office\s+chair/i },
  { t: "desk",           re: /bureau\s+de\s+travail|^bureau\b|\bdesk\b/i },
  { t: "coat-rack",      re: /coat\s?rack|porte-manteau|patère/i },
  { t: "end-table",      re: /accent\s+stand|accent\s+table|sellette/i },
  { t: "shelving",       re: /étagère|display\s+shelf|shelf\s+unit/i },
  { t: "bookcase",       re: /bibliothèque|bookcase/i },
  { t: "filing-cabinet", re: /classeur|filing/i },

  // ——— Salle à manger (§12) ———
  { t: "bar-stool",    re: /tabouret|bar\s*stool|counter\s*stool/i },
  { t: "buffet",       re: /buffet|sideboard|vaisselier/i },
  { t: "dining-bench", re: /banquette/i },
  { t: "dining-table", re: /table\s+seulement|table\s+de\s+salle|dining\s+table|^table\b/i },
  { t: "dining-chair", re: /^chaise\b|\bchaise\b/i },

  // ——— Salon générique en dernier (§9) ———
  { t: "sofa", re: /^sofa\b|\bsofa\b|canapé/i },

  // ——— Décor ———
  { t: "rug",              re: /tapis|\brug\b/i },
  { t: "lamp",             re: /lampe|luminaire|\blamp\b/i },
  { t: "decorative-mirror", re: /miroir\s+décoratif/i },
];

/* ---------- Type canonique ---------- */
export function typeOf(p) {
  const hay = p.name + " " + (p.sub || "");
  for (const r of RULES) if (r.re.test(hay)) return r.t;
  return "";
}

/* Le NOM prime sur la sous-ligne marketing.
   « Pompei (Blanc) — Lit » a pour sous-ligne « Tête de lit capitonnée » :
   c'est un lit, pas une tête de lit. On teste donc le nom seul d'abord. */
export function typeOfName(p) {
  for (const r of RULES) if (r.re.test(p.name)) return r.t;
  return "";
}

/* ---------- Type → département / sous-catégorie ---------- */
export const MAP = {
  "mattress":        ["matelas", "modeles"],
  "box-spring":      ["matelas", "sommiers"],
  "adjustable-base": ["matelas", "bases-ajustables"],

  "bed":         ["chambre", "lits"],
  "headboard":   ["chambre", "tetes-de-lit"],
  "bedroom-set": ["chambre", "ensembles"],
  "dresser":     ["chambre", "commodes"],
  "chest":       ["chambre", "chiffonniers"],
  "nightstand":  ["chambre", "tables-de-nuit"],
  "wardrobe":    ["chambre", "armoires"],
  "mirror":      ["chambre", "miroirs"],

  "sectional":    ["salon", "sectionnels"],
  "sofa":         ["salon", "canapes"],
  "loveseat":     ["salon", "causeuses"],
  "sofa-bed":     ["salon", "canapes-lits"],
  "recliner":     ["salon", "inclinables"],
  "accent-chair": ["salon", "fauteuils"],
  "ottoman":      ["salon", "ottomans"],
  "bench":        ["salon", "bancs"],
  "coffee-table":  ["salon", "tables-basses"],
  "end-table":     ["salon", "tables-appoint"],
  "console-table": ["salon", "consoles"],
  "tv-stand":      ["salon", "meubles-tele"],

  "dining-set":   ["salle", "ensembles"],
  "dining-table": ["salle", "tables"],
  "dining-chair": ["salle", "chaises"],
  "dining-bench": ["salle", "banquettes"],
  "bar-stool":    ["salle", "tabourets"],
  "buffet":       ["salle", "buffets"],

  "desk":           ["bureau", "bureaux"],
  "office-chair":   ["bureau", "chaises-bureau"],
  "bookcase":       ["bureau", "bibliotheques"],
  "shelving":       ["decor",  "etageres"],
  "coat-rack":      ["decor",  "rangement"],
  "filing-cabinet": ["bureau", "classeurs"],

  "rug":               ["decor", "tapis"],
  "lamp":              ["decor", "luminaires"],
  "decorative-mirror": ["decor", "miroirs"],
};

/* Le département actuel du site → celui de la nouvelle taxonomie,
   pour pouvoir comparer des choses comparables. */
export const LEGACY_DEPT = {
  matelas: "matelas", lits: "chambre", ensembles: "chambre", pieces: "chambre",
  sectionnels: "salon", salon: "salon", salle: "salle", divers: "bureau",
};

/* Style de lit — axe secondaire. La taille (39/54/60/78) reste un attribut
   dans `sizes`, jamais une sous-catégorie : un lit queen n'est pas un type
   de meuble différent d'un lit king. */
const STYLES = [
  { k: "superpose", re: /superposé|superpose|\bbunk\b|mezzanine/i },
  { k: "dejour",    re: /lit de jour|day\s?bed|trundle|gigogne/i },
  { k: "coffre",    re: /coffre|rangement|storage/i },
  { k: "capitonne", re: /capitonn|upholster|velours/i },
  { k: "plateforme",re: /plateforme|platform/i },
  { k: "appoint",   re: /pliant|d'appoint|folding|murphy/i },
];
export function styleOf(p) {
  const hay = p.name + " " + (p.sub || "");
  for (const r of STYLES) if (r.re.test(hay)) return r.k;
  return "";
}

export function classify(p) {
  const tName = typeOfName(p);            // d'après le nom seul — fait autorité
  const tBoth = typeOf(p);                // nom + sous-ligne — filet de sécurité
  const type = tName || tBoth;
  const [department, subcategory] = MAP[type] || ["", ""];

  /* Conflit de source : le nom et la sous-ligne décrivent deux produits
     différents (« Lit IF-5101 » / « Table de nuit »). On refuse de trancher
     et on signale — déplacer sur une donnée contradictoire, c'est deviner. */
  const dName = (MAP[tName] || [""])[0];
  const dBoth = (MAP[tBoth] || [""])[0];
  const conflict = !!(tName && tBoth && tName !== tBoth && dName !== dBoth);

  return {
    sku: skuOf(p),
    type,
    department,
    subcategory,
    collection: collectionOf(p),
    sizes: sizeOf(p),
    style: styleOf(p),
    sleeper: /sectionnel-lit|canapé-lit|sofa[-\s]?bed|fonction lit/i.test(p.name + " " + (p.sub || "")),
    conflict,
    conflictWith: conflict ? tBoth : "",
  };
}
