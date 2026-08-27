# Audit de classification — Literie d'Amitié

_Généré le 2026-08-26 · aucune modification appliquée._

```
TOTAL PRODUITS SCANNÉS:            961
CORRECTEMENT CLASSÉS:              947
MAL CLASSÉS:                       12
DÉPLACÉS (appliqué):               0   ← rapport seulement
INCERTAINS:                        2
SKU À CLASSIFICATION CONTRADICTOIRE: 62
PRODUITS SUPPRIMÉS:                0
```

## Mal classés, par type canonique

| Type | Nombre | Destination |
|---|---|---|
| `adjustable-base` | 6 | Matelas > Bases ajustables |
| `bed` | 4 | Chambre > Lits |
| `headboard` | 1 | Chambre > Têtes de lit |
| `bookcase` | 1 | Bureau > Bibliothèques |

## Détail — chaque SKU mal classé

```
SKU:        —
PRODUIT:    Laura
ACTUEL:     Ensembles de chambre
CORRECT:    Chambre > Lits
COLLECTION: Laura
RAISON:     Pièce individuelle (bed). « Laura » est le nom de la collection, pas l'indication que ce SKU vend un ensemble complet.
```

```
SKU:        —
PRODUIT:    Jordyn (Blanc)
ACTUEL:     Ensembles de chambre
CORRECT:    Chambre > Lits
COLLECTION: Jordyn
RAISON:     Pièce individuelle (bed). « Jordyn » est le nom de la collection, pas l'indication que ce SKU vend un ensemble complet.
```

```
SKU:        —
PRODUIT:    Jordyn « Ava » (Gris)
ACTUEL:     Ensembles de chambre
CORRECT:    Chambre > Lits
COLLECTION: Jordyn
RAISON:     Pièce individuelle (bed). « Jordyn » est le nom de la collection, pas l'indication que ce SKU vend un ensemble complet.
```

```
SKU:        IF-100
PRODUIT:    Madison IF-100 — Lit
ACTUEL:     Ensembles de chambre
CORRECT:    Chambre > Lits
COLLECTION: Madison
FORMATS:    king, queen
RAISON:     Pièce individuelle (bed). « Madison » est le nom de la collection, pas l'indication que ce SKU vend un ensemble complet.
```

```
SKU:        —
PRODUIT:    Pompei (Blanc) — Lit
ACTUEL:     Ensembles de chambre
CORRECT:    Chambre > Têtes de lit
COLLECTION: Pompei
FORMATS:    king, queen, double
RAISON:     Pièce individuelle (headboard). « Pompei » est le nom de la collection, pas l'indication que ce SKU vend un ensemble complet.
```

```
SKU:        IF-3520
PRODUIT:    Lit électrique ajustable IF-3520
ACTUEL:     Lits & têtes de lit
CORRECT:    Matelas > Bases ajustables
COLLECTION: —
FORMATS:    simple
RAISON:     Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.
```

```
SKU:        IF-3521
PRODUIT:    Lit électrique ajustable IF-3521
ACTUEL:     Lits & têtes de lit
CORRECT:    Matelas > Bases ajustables
COLLECTION: —
FORMATS:    double
RAISON:     Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.
```

```
SKU:        IF-3522
PRODUIT:    Lit électrique ajustable IF-3522
ACTUEL:     Lits & têtes de lit
CORRECT:    Matelas > Bases ajustables
COLLECTION: —
FORMATS:    queen
RAISON:     Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.
```

```
SKU:        IF-3610
PRODUIT:    Lit électrique ajustable IF-3610
ACTUEL:     Lits & têtes de lit
CORRECT:    Matelas > Bases ajustables
COLLECTION: —
FORMATS:    simple
RAISON:     Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.
```

```
SKU:        IF-3611
PRODUIT:    Lit électrique ajustable IF-3611
ACTUEL:     Lits & têtes de lit
CORRECT:    Matelas > Bases ajustables
COLLECTION: —
FORMATS:    double
RAISON:     Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.
```

```
SKU:        IF-3612
PRODUIT:    Lit électrique ajustable IF-3612
ACTUEL:     Lits & têtes de lit
CORRECT:    Matelas > Bases ajustables
COLLECTION: —
FORMATS:    queen
RAISON:     Base ajustable électrique, pas un cadre de lit. §7 : bases et lits sont distincts.
```

```
SKU:        IF-3250
PRODUIT:    Geometric Display Shelf IF-3250
ACTUEL:     Salon
CORRECT:    Bureau > Bibliothèques
COLLECTION: —
RAISON:     Bibliothèque / étagère — département Bureau.
```

## Incertains — laissés intacts (§26)

```
SKU:        IF-091
PRODUIT:    Accent Stand IF-091
ACTUEL:     Salon
PROBABLE:   à déterminer
CONFIANCE:  faible
RAISON:     Aucune règle ne s'applique — accessoire ou libellé hors convention.
```

```
SKU:        IF-4001
PRODUIT:    Coat Rack IF-4001
ACTUEL:     Salon
PROBABLE:   à déterminer
CONFIANCE:  faible
RAISON:     Aucune règle ne s'applique — accessoire ou libellé hors convention.
```

## SKU réclamés par deux identités (§19)

```
SKU: IF-100
  bedroom-set      Madison IF-100
  chest            Madison IF-100 — Chiffonnier
  bed              Madison IF-100 — Lit
  nightstand       Madison IF-100 — Table de nuit
  dresser          Madison IF-100 — Commode & miroir
  chest            Madison IF-100 — Coffre
```

```
SKU: IF-5340
  bedroom-set      IF-5340
  bed              Lit IF-5340
```

```
SKU: C-1010
  dining-set       Ensemble salle à manger 3 pièces T Toronto/C-1010
  dining-chair     Chaise C-1010
```

```
SKU: C-1011
  dining-set       Ensemble salle à manger 3 pièces T Toronto/C-1011
  dining-chair     Chaise C-1011
```

```
SKU: C-1033
  dining-set       Ensemble salle à manger 3 pièces T Toronto/C-1033
  dining-chair     Chaise C-1033
```

```
SKU: T-1025
  dining-set       Ensemble salle à manger 3 pièces T-1025/ C-1023
  dining-table     Table seulement T-1025
  dining-set       Ensemble salle à manger 3 pièces T-1025/ C-1025
```

```
SKU: T-1030
  dining-set       Ensemble salle à manger 7 pièces T-1030/ C-1031
  dining-set       Ensemble salle à manger 7 pièces T-1030/ C-1032
  dining-table     Table seulement T-1030
```

```
SKU: T-1045
  dining-set       5Pc Din Set T-1045/ C-1010
  dining-set       7Pc Din Set T-1045/ C-1011
  dining-set       7Pc Din Set T-1045/ C-1033
  dining-table     Extension Table seulement T-1045
```

```
SKU: T-1047
  dining-set       Ensemble salle à manger 5 pièces T-1047/ C-1010
  dining-set       Ensemble salle à manger 5 pièces T-1047/ C-1011
  dining-set       Ensemble salle à manger 5 pièces T-1047/ C-1033
  dining-table     Table seulement T-1047
```

```
SKU: T-1048
  dining-set       Ensemble salle à manger 7 pièces T-1048/ C-1010
  dining-set       Ensemble salle à manger 7 pièces T-1048/ C-1011
  dining-set       Ensemble salle à manger 7 pièces T-1048/ C-1033
  dining-table     Table seulement T-1048
```

```
SKU: T-1050
  dining-set       Ensemble salle à manger 5 pièces T-1050/ C-1052
  dining-set       Ensemble salle à manger 5 pièces T-1050/ C-1053
  dining-table     Table seulement T-1050
```

```
SKU: T-1051
  dining-set       Ensemble salle à manger 7 pièces T-1051/ C-1052
  dining-set       Ensemble salle à manger 7 pièces T-1051/ C-1053
  dining-table     Table seulement T-1051
```

```
SKU: T-1060
  dining-set       Ensemble salle à manger 5 pièces T-1060/ C-1062
  dining-set       Ensemble salle à manger 5 pièces T-1060/ C-1064
  dining-table     Table seulement T-1060
```

```
SKU: T-1079
  dining-set       Ensemble salle à manger 5 pièces T-1079/ C-1081
  dining-set       Ensemble salle à manger 5 pièces T-1079/ C-1082
  dining-set       Ensemble salle à manger 5 pièces T-1079/ C-1083
  dining-set       Ensemble salle à manger 5 pièces T-1079/ C-1084
  dining-table     Table seulement T-1079
```

```
SKU: T-1080
  dining-set       Ensemble salle à manger 7 pièces T-1080/ C-1081
  dining-set       Ensemble salle à manger 7 pièces T-1080/ C-1082
  dining-set       Ensemble salle à manger 7 pièces T-1080/ C-1083
  dining-set       Ensemble salle à manger 7 pièces T-1080/ C-1084
  dining-table     Table seulement T-1080
```

```
SKU: T-1085
  dining-set       Ensemble salle à manger 5 pièces T-1085/ C-1085
  dining-set       Ensemble salle à manger 5 pièces T-1085/ C-1091
  dining-set       Ensemble salle à manger 5 pièces T-1085/ C-1092
  dining-table     Table seulement T-1085
```

```
SKU: T-1095
  dining-set       Ensemble salle à manger 7 pièces T-1095/ C-1098
  dining-set       Ensemble salle à manger 7 pièces T-1095/ C-1099
  dining-table     Table seulement T-1095
```

```
SKU: T-1210
  dining-set       Ensemble salle à manger 3 pièces T-1210/ C-1210
  dining-table     Table seulement T-1210
```

```
SKU: T-1211
  dining-set       Ensemble salle à manger 3 pièces T-1211/ C-1211
  dining-table     Table seulement T-1211
```

```
SKU: T-1240
  dining-set       Ensemble salle à manger 7 pièces T-1240/ C-1241
  dining-table     Table seulement T-1240
```

```
SKU: T-1274
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1250
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1251
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1253
  dining-table     Table seulement T-1274
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1260
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1261
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1262
  dining-set       Ensemble salle à manger 7 pièces T-1274/ C-1263
```

```
SKU: T-1275
  dining-set       Ensemble salle à manger 7 pièces T-1275/ C-1285
  dining-table     Table seulement T-1275
```

```
SKU: T-1402
  dining-set       Ensemble salle à manger 7 pièces T-1402/ C-1782
  dining-set       Ensemble salle à manger 5 pièces T-1402/ C-1782
  dining-table     Table seulement T-1402
```

```
SKU: T-1405
  dining-set       Ensemble salle à manger 5 pièces T-1405/ C-1420
  dining-set       Ensemble salle à manger 5 pièces T-1405/ C-1421
  dining-set       Ensemble salle à manger 5 pièces T-1405/ C-1423
  dining-table     Table Eiffel T-1405
```

```
SKU: T-1408
  dining-set       Ensemble salle à manger 5 pièces T-1408/ C-1413
  dining-table     Table seulement T-1408
```

```
SKU: T-1410
  dining-set       Ensemble salle à manger 7 pièces T-1410/ C-1411
  dining-set       Ensemble salle à manger 7 pièces T-1410/ C-1412
  dining-table     Table seulement T-1410
```

```
SKU: T-1429
  dining-set       Ensemble salle à manger 5 pièces T-1429/ C-1745
  dining-table     Table seulement T-1429
  dining-set       Ensemble salle à manger 5 pièces T-1429/ C-5053
```

```
SKU: T-1430
  dining-set       Ensemble salle à manger 5 pièces T-1430/ C-1760
  dining-set       Ensemble salle à manger 5 pièces T-1430/ C-1761
  dining-set       Ensemble salle à manger 5 pièces T-1430/ C-1762
  dining-table     Table seulement T-1430
  dining-set       Ensemble salle à manger 5 pièces T-1430/ C-1770
  dining-set       Ensemble salle à manger 5 pièces T-1430/ C-1771
  dining-set       Ensemble salle à manger 5 pièces T-1430/ C-1772
```

```
SKU: T-1435
  dining-set       Ensemble salle à manger 5 pièces T-1435/ C-1436
  dining-table     Table seulement T-1435
```

```
SKU: T-1442
  dining-set       Ensemble salle à manger 7 pièces T-1442/ C-1877
  dining-set       Ensemble salle à manger 7 pièces T-1442/ C-1878
  dining-set       Ensemble salle à manger 7 pièces T-1442/ C-1879
  dining-table     Table seulement T-1442
```

```
SKU: T-1443
  dining-set       Ensemble salle à manger 7 pièces T-1443/ C-1578
  dining-table     Table seulement T-1443
```

```
SKU: T-1445
  dining-set       Ensemble salle à manger 5 pièces T-1445/ C-1760
  dining-set       Ensemble salle à manger 5 pièces T-1445/ C-1761
  dining-set       Ensemble salle à manger 5 pièces T-1445/ C-1762
  dining-table     Table seulement T-1445
```

```
SKU: T-1446
  dining-set       Ensemble salle à manger 5 pièces T-1446/ C-1760
  dining-set       Ensemble salle à manger 5 pièces T-1446/ C-1761
  dining-set       Ensemble salle à manger 5 pièces T-1446/ C-1762
  dining-table     Table seulement T-1446
```

```
SKU: T-1447
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1250
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1251
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1253
  dining-table     Table seulement T-1447
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1260
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1261
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1262
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1263
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1760
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1761
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1762
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1785
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-1786
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-5063
  dining-set       Ensemble salle à manger 5 pièces T-1447/ C-5065
```

```
SKU: T-1448
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1250
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1251
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1253
  dining-table     Table seulement T-1448
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1260
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1261
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1262
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1263
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1574
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1575
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1576
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1577
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1579
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1785
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1786
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1877
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1878
  dining-set       Ensemble salle à manger 7 pièces T-1448/ C-1879
```

```
SKU: T-1449
  dining-set       Ensemble salle à manger 7 pièces T-1449/ C-1710
  dining-set       Ensemble salle à manger 7 pièces T-1449/ C-1711
  dining-set       Ensemble salle à manger 7 pièces T-1449/ C-1712
  dining-table     Table seulement T-1449
  dining-set       Ensemble salle à manger 7 pièces T-1449 C-1871
  dining-set       Ensemble salle à manger 7 pièces T-1449 C-1872
  dining-set       Ensemble salle à manger 7 pièces T-1449 C-1873
```

```
SKU: T-1472
  dining-set       Ensemble salle à manger 7 pièces T-1472/ C-1473
  dining-set       Ensemble salle à manger 7 pièces T-1472/ C-1474
  dining-table     Table seulement T-1472
```

```
SKU: T-1510
  dining-set       Ensemble salle à manger 7 pièces T-1510/ C-1511
  dining-set       Ensemble salle à manger 7 pièces T-1510/ C-1512
  dining-table     Table seulement T-1510
```

```
SKU: T-1530
  dining-set       Ensemble salle à manger 7 pièces T-1530/ C-1531
  dining-set       Ensemble salle à manger 7 pièces T-1530/ C-1532
  dining-table     Table seulement T-1530
  dining-set       Ensemble salle à manger 7 pièces T-1530/ C-1535
  dining-set       Ensemble salle à manger 7 pièces T-1530/ C-1536
```

```
SKU: T-1540
  dining-set       Ensemble salle à manger 7 pièces T-1540/ C-1541
  dining-table     Table seulement T-1540
```

```
SKU: T-1545
  dining-set       Ensemble salle à manger 7 pièces T-1545/ C-1546
  dining-table     Table seulement T-1545
  dining-set       Ensemble salle à manger 7 pièces T-1545/ C-1561
```

```
SKU: T-1550
  dining-set       Ensemble salle à manger 7 pièces T-1550/ C-1551
  dining-set       Ensemble salle à manger 7 pièces T-1550/ C-1552
  dining-table     Table seulement T-1550
```

```
SKU: T-1560
  dining-set       Ensemble salle à manger 7 pièces T-1560/ C-1561
  dining-table     Table seulement T-1560
```

```
SKU: T-1570
  dining-set       Ensemble salle à manger 7 pièces T-1570/ C-1571
  dining-set       Ensemble salle à manger 7 pièces T-1570/ C-1578
  dining-table     Table seulement T-1570
```

```
SKU: T-1580
  dining-set       Ensemble salle à manger 5 pièces T-1580/ C-1582
  dining-table     Table seulement T-1580
```

```
SKU: T-1590
  dining-set       Ensemble salle à manger 5 pièces T-1590/ C-1591
  dining-set       Ensemble salle à manger 5 pièces T-1590/ C-1592
  dining-set       Ensemble salle à manger 5 pièces T-1590/ C-1593
  dining-table     Table seulement T-1590
```

```
SKU: T-1630
  dining-set       Ensemble salle à manger 5 pièces T-1630/ C-1631
  dining-set       Ensemble salle à manger 5 pièces T-1630/ C-1632
  dining-table     Table seulement T-1630
```

```
SKU: T-1640
  dining-set       Ensemble salle à manger 5 pièces T-1640/ C-1644
  dining-table     Table seulement T-1640
```

```
SKU: T-1641
  dining-set       Ensemble salle à manger 7 pièces T-1641/ C-1644
  dining-table     Table seulement T-1641
```

```
SKU: T-1642
  dining-set       Ensemble salle à manger 5 pièces T-1642/ C-1644
  dining-set       Ensemble salle à manger 5 pièces T-1642/ C-1645
  dining-table     Table seulement T-1642
```

```
SKU: T-1643
  dining-set       Ensemble salle à manger 7 pièces T-1643/ C-1644
  dining-set       Ensemble salle à manger 7 pièces T-1643/ C-1645
  dining-table     Table seulement T-1643
```

```
SKU: T-1650
  dining-set       Ensemble salle à manger 5 pièces T-1650/ C-1651
  dining-set       Ensemble salle à manger 5 pièces T-1650/ C-1652
  dining-table     Table seulement T-1650
```

```
SKU: T-1808
  dining-set       Ensemble salle à manger 7 pièces T-1808/ C-1820
  dining-set       Ensemble salle à manger 7 pièces T-1808/ C-1821
  dining-table     Table seulement T-1808
```

```
SKU: T-1810
  dining-set       Ensemble salle à manger 7 pièces T-1810/ C-1825-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1810/ C-1825-5Pc
  dining-set       Ensemble salle à manger 7 pièces T-1810/ C-1826-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1810/ C-1826-5Pc
  dining-table     Table seulement T-1810
```

```
SKU: T-1811
  dining-set       Ensemble salle à manger 7 pièces T-1811/ C-1826-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1811/ C-1826-5Pc
  dining-table     Table seulement T-1811
  dining-set       Ensemble salle à manger 7 pièces T-1811/ C-1835-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1811/ C-1835-5Pc
```

```
SKU: T-1812
  dining-set       Ensemble salle à manger 7 pièces T-1812/ C-1825-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1812/ C-1825-5Pc
  dining-set       Ensemble salle à manger 7 pièces T-1812/ C-1826-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1812/ C-1826-5Pc
  dining-table     Table seulement T-1812
```

```
SKU: T-1814
  dining-set       Ensemble salle à manger 7 pièces T-1814/ C-1710
  dining-set       Ensemble salle à manger 7 pièces T-1814/ C-1711
  dining-set       Ensemble salle à manger 7 pièces T-1814/ C-1712
  dining-table     Table seulement T-1814
  dining-set       Ensemble salle à manger 7 pièces T-1814/ C-1825-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1814/ C-1825-5Pc
  dining-set       Ensemble salle à manger 7 pièces T-1814/ C-1826-7Pc
  dining-set       Ensemble salle à manger 5 pièces T-1814/ C-1826-5Pc
```

```
SKU: T-1815
  dining-set       Ensemble salle à manger 7 pièces T-1815/ C-1815
  dining-table     Table seulement T-1815
  dining-set       Ensemble salle à manger 7 pièces T-1815/ C-1817
```

```
SKU: T-1817
  dining-set       Ensemble salle à manger 7 pièces T-1817/ C-1817
  dining-table     Table seulement T-1817
```

```
SKU: T-1818
  dining-set       Ensemble salle à manger 7 pièces T-1818/ C-1817
  dining-table     Table seulement T-1818
```

```
SKU: T-5065
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-1760
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-1761
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-1762
  dining-table     Table seulement T-5065
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-1770
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-1771
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-1772
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-5063
  dining-set       Ensemble salle à manger 5 pièces T-5065/ C-5065
```

```
SKU: T-5067
  dining-set       Ensemble salle à manger 7 pièces T-5067/ C-1785
  dining-set       Ensemble salle à manger 5 pièces T-5067/ C-1785
  dining-table     Table seulement T-5067
  dining-table     Table seulement T-5067
```

