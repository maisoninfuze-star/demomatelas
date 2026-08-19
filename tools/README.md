# Surveillance de la disponibilité chez IFDC

898 des 961 articles du catalogue viennent d'IFDC. Quand le fournisseur retire
un meuble de sa gamme, rien ne le dit — le produit reste en vente sur le site,
un client le paie, et l'appel qui suit est désagréable. Ces trois fichiers
ferment ce trou, chaque lundi matin, sans que personne ait à y penser.

## Ce qui tourne, et quand

`.github/workflows/ifdc-lundi.yml` — **lundi 8 h** (heure de Montréal). GitHub
lance la vérification, pousse les changements s'il y en a, et Vercel redéploie
tout seul. On peut aussi la lancer à la main depuis l'onglet **Actions** du
dépôt (bouton *Run workflow*, avec l'option *Simulation* pour ne rien modifier).

## Les trois fichiers

| Fichier | Rôle |
|---|---|
| `ifdc-map.json` | Relie chaque produit à ses pages chez IFDC. Versionné, modifiable à la main. |
| `ifdc-check.mjs` | La vérification hebdomadaire. Sonde, décide, écrit. |
| `ifdc-rapport.md` | Le compte rendu de la dernière exécution. Réécrit chaque lundi. |
| `ifdc-map-build.mjs` | Reconstruit la table d'appariement. À lancer **seulement** après avoir ajouté des produits au catalogue. |

## Ce que la vérification décide

- **Toutes les pages d'un produit ont disparu** → `"off": 1` dans `data.js`.
  Le produit sort des grilles, sa fiche explique qu'il n'est plus offert, et la
  caisse le refuse même s'il traîne dans un panier vieux de trois semaines.
- **Une page sur trois a disparu** → rien n'est masqué. C'est un fini qui est
  parti, pas le meuble ; le rapport le signale.
- **L'adresse a changé** (`if-6311` → `if-6311-recliner`, ce qui arrive
  souvent) → la table se répare toute seule, rien n'est masqué.
- **Un produit masqué réapparaît** → il ressort en vente.

## Les garde-fous

Un faux positif vide la boutique, alors le script est méfiant par construction :

1. une page n'est déclarée morte qu'après **deux 404 espacés** — un délai
   d'attente dépassé ressemble à une page absente et ne l'est pas ;
2. au-delà de **40 disparitions** dans une même exécution, **rien n'est
   appliqué** : à cette échelle c'est IFDC qui a réorganisé ses adresses ;
3. plus de **10 % d'erreurs réseau** → sortie sans rien changer ;
4. un produit dont le sondage est incomplet n'est jamais jugé.

## Quand quelque chose bouge

Un **billet GitHub** s'ouvre — donc un courriel arrive — avec le rapport
complet. C'est le seul moment où il y a quelque chose à faire :

- **produits retirés** : ils sont déjà masqués, rien à faire, sauf appeler
  IFDC si le meuble se vendait bien ;
- **rien n'a été appliqué** (garde-fou 2) : ouvrir `ifdc-rapport.md`, vérifier
  deux ou trois liens à la main. Si IFDC a bel et bien tout renommé, relancer
  `node tools/ifdc-map-build.mjs`, commiter la table, et relancer la
  vérification ;
- **nouveautés chez IFDC** : ce sont des meubles qu'il publie et qu'on ne vend
  pas. Rien d'automatique — les prix viennent de la liste de prix, pas du site,
  et la règle du client reste *prix fournisseur × 2*.

## À la main

```bash
node tools/ifdc-check.mjs --dry-run   # vérifie sans rien modifier
node tools/ifdc-check.mjs             # vérifie et applique
```

## Ce qui échappe à la surveillance

**67 produits** viennent de la liste de prix d'août et n'ont jamais eu de page
sur le site d'IFDC : tables seules (T-1004, T-1210…), chaises seules (C-1027,
C-5051…), quelques lits B-101 à B-122. Leur disponibilité ne peut se vérifier
qu'auprès du fournisseur, et ils ne sont **jamais masqués automatiquement**.
Le rapport rappelle leur nombre à chaque exécution.
