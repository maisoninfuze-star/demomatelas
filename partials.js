/* ============================================================
   LITERIE D'AMITIÉ — démo
   En-tête, pied de page, panier & toast partagés (source unique)
   Injecté avant app.js pour que le panier soit câblé partout.
   ============================================================ */
(function () {
  "use strict";

  const PHONE = "438-375-4949";
  const TEL = "+14383754949";
  const ADDR = "3512, boul. Industriel, Montréal";
  const MAPS = "https://maps.google.com/?q=3512+Boulevard+Industriel+Montréal";
  const EMAIL = "literiedamitieinc@outlook.com";

  const NAV = [
    { label: "Matelas", href: "matelas.html", key: "matelas" },
    { label: "Chambres", href: "collections.html", key: "collections" },
    { label: "Sectionnels", href: "matelas.html?cat=sectionnels", key: "sectionnels" },
    { label: "Liquidation", href: "liquidation.html", key: "liquidation" },
    { label: "Livraison", href: "livraison.html", key: "livraison" },
    { label: "Contact", href: "contact.html", key: "contact" },
  ];

  let page = document.body.getAttribute("data-page") || "";
  // On the catalogue, refine the active tab from the ?cat= filter.
  if (page === "matelas") {
    const cat = new URLSearchParams(location.search).get("cat");
    if (cat === "sectionnels") page = "sectionnels";
  }

  const phoneSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 2Z"/></svg>`;
  const brandSvg = `<svg class="brand-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true"><circle cx="22" cy="22" r="20.5" stroke="currentColor" stroke-width="1.3"/><path d="M28.5 10.5a13.5 13.5 0 1 0 5 18.5 15 15 0 0 1-5-18.5Z" fill="currentColor"/><path d="M13 15.5l3.4 2M12 21.6h3.9M13 27.7l3.4-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  const arrowSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg>`;

  const navLinks = NAV.map(
    (n) => `<a href="${n.href}"${n.key === page ? ' class="is-active"' : ""}>${n.label}</a>`
  ).join("");

  const mobileLinks = NAV.map(
    (n) => `<li><a href="${n.href}"${n.key === page ? ' class="is-active"' : ""}>${n.label}</a></li>`
  ).join("");

  const header = `
  <div class="topbar">
    <div class="container">
      <div class="topbar-left">
        <span><span class="dot"></span>Showroom ouvert<span class="tb-addr"> · ${ADDR}</span></span>
        <span class="tb-extra">Livraison soignée — Grand Montréal</span>
      </div>
      <div class="topbar-right">
        <span class="tb-extra"><span class="stars">★★★★★</span>&nbsp;5,0 Google</span>
        <a href="tel:${TEL}">${phoneSvg}<span class="tb-phone-label">${PHONE}</span></a>
      </div>
    </div>
  </div>

  <div class="nav-wrap">
    <nav class="nav" id="nav" aria-label="Navigation principale">
      <a class="brand" href="index.html" aria-label="Literie d'Amitié — accueil">
        ${brandSvg}
        <span><span class="brand-name">Literie d'Amitié</span><span class="brand-sub">Matelassier · Montréal</span></span>
      </a>
      <div class="nav-links">${navLinks}</div>
      <div class="nav-actions">
        <a class="nav-phone" href="tel:${TEL}">${phoneSvg}${PHONE}</a>
        <button class="cart-btn" id="cartOpen" aria-label="Ouvrir le panier">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1.3 12.1a1.8 1.8 0 0 1-1.8 1.9H6.5a1.8 1.8 0 0 1-1.8-1.9L6 7Z"/><path d="M8.5 9.5V6a3.5 3.5 0 0 1 7 0v3.5"/></svg>
          <span class="cart-count" id="cartCount">0</span>
        </button>
        <button class="burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span></button>
      </div>
    </nav>
  </div>

  <div class="mobile-menu" id="mobileMenu">
    <ul>
      ${mobileLinks}
      <li><a href="guide.html"${page === "guide" ? ' class="is-active"' : ""}>Guide des dimensions</a></li>
      <li class="mm-info"><span>${ADDR}<br><a href="tel:${TEL}">${PHONE}</a></span></li>
    </ul>
  </div>`;

  const footer = `
  <footer class="footer">
    <div class="container">
      <div class="footer-main">
        <div>
          <a class="brand" href="index.html" style="color:var(--ivory)">
            <svg class="brand-mark" viewBox="0 0 44 44" fill="none" aria-hidden="true" style="color:var(--brass-2)"><circle cx="22" cy="22" r="20.5" stroke="currentColor" stroke-width="1.3"/><path d="M28.5 10.5a13.5 13.5 0 1 0 5 18.5 15 15 0 0 1-5-18.5Z" fill="currentColor"/><path d="M13 15.5l3.4 2M12 21.6h3.9M13 27.7l3.4-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <span><span class="brand-name">Literie d'Amitié</span><span class="brand-sub">Matelassier · Montréal · 2020</span></span>
          </a>
          <p class="footer-about">On fabrique, on entrepose et on livre nos matelas nous-mêmes, du Plateau à Brossard. Du vrai sommeil, à prix juste.</p>
        </div>
        <div class="footer-col">
          <h4>Boutique</h4>
          <a href="matelas.html">Matelas</a>
          <a href="collections.html">Chambres à coucher</a>
          <a href="matelas.html?cat=sectionnels">Sectionnels-lits</a>
          <a href="bases.html">Bases &amp; sommiers</a>
          <a href="liquidation.html">Liquidation</a>
        </div>
        <div class="footer-col">
          <h4>Aide</h4>
          <a href="guide.html">Guide des dimensions</a>
          <a href="livraison.html">Zones de livraison</a>
          <a href="contact.html">Contact &amp; showroom</a>
          <a href="tel:${TEL}">${PHONE}</a>
        </div>
        <div class="footer-col">
          <h4>Showroom</h4>
          <a href="${MAPS}" target="_blank" rel="noopener">3512, boul. Industriel<br>Montréal, QC</a>
          <a href="mailto:${EMAIL}">${EMAIL}</a>
          <ul>
            <li class="foot-hours"><span>Lun – Ven</span><span>9 h – 18 h</span></li>
            <li class="foot-hours"><span>Samedi</span><span>10 h – 17 h</span></li>
            <li class="foot-hours"><span>Dimanche</span><span>11 h – 16 h</span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Literie d'Amitié Inc. — Matelassier montréalais depuis 2020</span>
        <div class="footer-legal">
          <a href="#">Confidentialité</a>
          <a href="#">Conditions</a>
          <span>Proposition de refonte — démo B12</span>
        </div>
      </div>
    </div>
  </footer>`;

  const drawer = `
  <div class="cart-overlay" id="cartOverlay"></div>
  <aside class="cart-drawer" id="cartDrawer" aria-label="Panier">
    <div class="cart-head">
      <h3>Votre panier <span id="cartQty"></span></h3>
      <button class="cart-close" id="cartClose" aria-label="Fermer le panier"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
    </div>
    <div class="cart-ship" id="cartShip"></div>
    <div class="cart-items" id="cartItems"></div>
    <div class="cart-foot">
      <div class="cart-total"><span>Sous-total</span><b id="cartTotal">0&nbsp;$</b></div>
      <button class="btn" id="checkoutBtn">Passer la commande <span class="btn-orb">${arrowSvg}</span></button>
      <p class="cart-note">Démo — le paiement sera branché sur la boutique Shopify existante.</p>
    </div>
  </aside>
  <div class="toast" id="toast" role="status"><span class="t-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg></span><span id="toastMsg"></span></div>`;

  // Mount points: [data-header] and [data-footer]; fall back to body edges.
  const h = document.querySelector("[data-header]");
  if (h) h.outerHTML = header;
  else document.body.insertAdjacentHTML("afterbegin", header);

  const f = document.querySelector("[data-footer]");
  if (f) f.outerHTML = footer + drawer;
  else document.body.insertAdjacentHTML("beforeend", footer + drawer);
})();
