/* ============================================================
   Flux catalogue Meta — généré depuis data.js, la source unique.
       node tools/feed-build.mjs
   Sort feed.csv à la racine du site : Meta va le chercher tout seul
   à https://literiedamitie.com/feed.csv selon l'horaire configuré.

   Deux choses le distinguent d'un flux ordinaire :
     — les variantes sont éclatées en lignes distinctes reliées par
       item_group_id, pour que Meta annonce le bon format au bon prix
       plutôt qu'un « à partir de » qui déçoit au clic ;
     — un produit portant "off" (retiré chez IFDC par la vérification
       du lundi) sort en « out of stock ». Le flux ne peut donc jamais
       annoncer un meuble que le fournisseur ne livre plus.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://literiedamitie.com";

const win = {};
new Function("window", readFileSync(path.join(ROOT, "data.js"), "utf8"))(win);

// Le rayon du catalogue -> la taxonomie Google que Meta comprend.
const RAYON = {
  matelas:     ["Matelas & sommiers", "Furniture > Bedroom Furniture > Mattresses"],
  lits:        ["Lits & têtes de lit", "Furniture > Bedroom Furniture > Beds & Bed Frames"],
  ensembles:   ["Ensembles de chambre", "Furniture > Bedroom Furniture > Bedroom Furniture Sets"],
  pieces:      ["Commodes & tables de nuit", "Furniture > Bedroom Furniture > Dressers"],
  sectionnels: ["Sectionnels-lits", "Furniture > Sofas"],
  salon:       ["Salon", "Furniture > Sofas"],
  salle:       ["Salle à manger", "Furniture > Dining Room Furniture"],
  divers:      ["Bureau & divers", "Furniture > Office Furniture"],
};

const esc = (v) => {
  const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const COLS = [
  "id", "item_group_id", "title", "description", "availability", "condition",
  "price", "link", "image_link", "additional_image_link", "brand",
  "product_type", "google_product_category", "custom_label_0", "custom_label_1",
];

const lignes = [COLS.join(",")];
let nProduits = 0, nLignes = 0, nRetires = 0;

for (const p of win.CATALOG) {
  const [rayon, gpc] = RAYON[p.cat] || ["Divers", "Furniture"];
  const fournisseur = p.h.startsWith("ifdc-");
  // Le delai est un argument de vente : on l'expose comme etiquette
  // pour pouvoir segmenter les campagnes dessus.
  const delai = fournisseur ? "6-7 jours ouvrables" : "24-48 h";
  const dispo = p.off ? "out of stock" : "in stock";
  if (p.off) nRetires++;
  nProduits++;

  const lien = `${SITE}/produit?p=${encodeURIComponent(p.h)}`;
  const img = (p.imgs && p.imgs[0]) || "";
  if (!img) continue;
  const autres = (p.imgs || []).slice(1, 11).join(",");

  for (const v of p.variants) {
    const format = v.t && v.t !== "Default Title" ? v.t : "";
    const titre = (format ? `${p.name} — ${format}` : p.name).slice(0, 150);
    const desc = (p.sub || p.name).slice(0, 5000);
    const prix = Number(v.p);
    if (!Number.isFinite(prix) || prix <= 0) continue;

    lignes.push([
      esc(p.h + (format ? "-" + format.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "")),
      esc(p.h),
      esc(titre),
      esc(desc),
      esc(dispo),
      "new",
      esc(prix.toFixed(2) + " CAD"),
      esc(lien),
      esc(img),
      esc(autres),
      "Literie d'Amitié",
      esc(rayon),
      esc(gpc),
      esc(delai),
      // Tranche de prix : sert a miser differemment sur un matelas a 140 $
      // et sur un ensemble de chambre a 3 200 $.
      esc(prix < 500 ? "0-499" : prix < 1000 ? "500-999" : prix < 2000 ? "1000-1999" : "2000+"),
    ].join(","));
    nLignes++;
  }
}

writeFileSync(path.join(ROOT, "feed.csv"), lignes.join("\n") + "\n");
console.log(`feed.csv — ${nLignes} lignes pour ${nProduits} produits`);
console.log(`  dont ${nRetires} marqués « out of stock » par la vérification IFDC`);
console.log(`  ${(Buffer.byteLength(lignes.join("\n")) / 1048576).toFixed(2)} Mo`);
