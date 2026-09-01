/* ============================================================
   tracking.js — Pixel Meta et événements de commerce.

   INERTE PAR DÉFAUT. Tant que PIXEL_ID est vide, ce fichier ne
   charge rien, ne dépose aucun témoin et n'envoie aucune requête :
   les fonctions publiques existent mais ne font rien. Les appelants
   n'ont donc jamais à se demander si le pixel est actif.

   Loi 25 : un pixel publicitaire sert au profilage, donc il exige
   un consentement préalable. `consentement()` est le seul endroit
   à modifier le jour où une bannière de consentement existe —
   retourner l'état réel du choix du visiteur au lieu de true.

   Les identifiants de contenu envoyés à Meta sont les handles du
   catalogue (p.h). Le même identifiant doit servir de `id` dans le
   flux produits, sinon le reciblage dynamique ne raccorde rien.
   ============================================================ */
(function () {
  "use strict";

  var PIXEL_ID = "";          // ← identifiant du jeu de données Meta
  var DEVISE = "CAD";

  var actif = false;

  function consentement() {
    // À remplacer par l'état réel de la bannière quand elle existera.
    return true;
  }

  function inerte() {
    return { viewContent: rien, addToCart: rien, initiateCheckout: rien, purchase: rien, actif: false };
  }
  function rien() {}

  if (!PIXEL_ID || !consentement()) { window.LDA_PIXEL = inerte(); return; }

  /* Extrait officiel du pixel Meta — ne pas reformater. */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  fbq("init", PIXEL_ID);
  fbq("track", "PageView");
  actif = true;

  /* Un identifiant d'événement stable permettra de dédoublonner avec
     l'API Conversions quand le webhook Stripe l'enverra côté serveur :
     sans lui, un achat serait compté deux fois. */
  function idEvenement(prefixe, graine) {
    return prefixe + "-" + (graine || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)));
  }

  function envoyer(nom, donnees, eventID) {
    try {
      fbq("track", nom, donnees, eventID ? { eventID: eventID } : undefined);
    } catch (e) { /* jamais casser la boutique pour une balise */ }
  }

  function prixDe(produit, variante) {
    if (variante && variante.p > 0) return variante.p;
    if (window.LDA && window.LDA.prixAffiche) return window.LDA.prixAffiche(produit).val;
    return produit && produit.from ? produit.from : 0;
  }

  window.LDA_PIXEL = {
    actif: true,

    // Fiche produit consultée.
    viewContent: function (p, variante) {
      if (!p) return;
      envoyer("ViewContent", {
        content_ids: [p.h],
        content_name: p.name,
        content_type: "product",
        content_category: p.dept || p.cat || "",
        value: prixDe(p, variante),
        currency: DEVISE,
      });
    },

    // Ajout au panier — la variante réellement ajoutée, pas variants[0].
    addToCart: function (p, variante, qte) {
      if (!p) return;
      var prix = prixDe(p, variante);
      envoyer("AddToCart", {
        content_ids: [p.h],
        content_name: p.name,
        content_type: "product",
        value: prix * (qte || 1),
        currency: DEVISE,
      });
    },

    // Départ vers la page de paiement Stripe.
    initiateCheckout: function (panier) {
      var items = panier || [];
      var total = 0, ids = [], n = 0;
      items.forEach(function (i) { total += (i.p || 0) * (i.q || 1); ids.push(i.h); n += i.q || 1; });
      envoyer("InitiateCheckout", {
        content_ids: ids,
        content_type: "product",
        num_items: n,
        value: Math.round(total * 100) / 100,
        currency: DEVISE,
      });
    },

    /* Achat confirmé. `ref` est la référence de commande (LDA-XXXXXX)
       produite par api/checkout.js : elle sert d'identifiant d'événement,
       donc le même achat envoyé plus tard par l'API Conversions sera
       reconnu comme un doublon plutôt que compté une seconde fois. */
    purchase: function (panier, ref) {
      var items = panier || [];
      if (!items.length) return;
      var total = 0, ids = [], contenus = [], n = 0;
      items.forEach(function (i) {
        var q = i.q || 1;
        total += (i.p || 0) * q; n += q; ids.push(i.h);
        contenus.push({ id: i.h, quantity: q, item_price: i.p || 0 });
      });
      envoyer("Purchase", {
        content_ids: ids,
        contents: contenus,
        content_type: "product",
        num_items: n,
        value: Math.round(total * 100) / 100,
        currency: DEVISE,
        order_id: ref || "",
      }, ref || idEvenement("achat"));
    },
  };
})();
