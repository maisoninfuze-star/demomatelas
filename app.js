/* ============================================================
   LITERIE D'AMITIÉ — démo
   Motion, panier, rail, catalogue & fiche produit
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
  const fmt = (n) =>
    n.toLocaleString("fr-CA", { maximumFractionDigits: 0 }).replace(/ /g, " ") + " $";


  /* ---------- Prix affiché ----------
     Sur une fiche d'ensemble, les variantes mêlent l'ensemble complet et
     ses pièces vendues à l'unité. Prendre le minimum brut affichait la
     table de nuit comme prix de l'ensemble : « Amelia — dès 320 $ » pour
     un ensemble à 2 699,98 $. On s'ancre donc sur les variantes qui
     désignent l'ensemble lui-même, et « dès » n'apparaît que s'il existe
     réellement plusieurs prix. */
  const RE_ENSEMBLE = /^ensemble|ensemble\s+(de\s+)?(chambre|salle)|\d\s*pc\b|\d\s*pi[èe]ces/i;
  const prixAffiche = (p) => {
    const v = (p && p.variants) || [];
    const tous = [...new Set(v.map((x) => x.p).filter((n) => n > 0))];
    if (!tous.length) return { val: (p && p.from) || 0, multi: false, idx: 0 };
    const idxDe = (prix) => Math.max(0, v.findIndex((x) => x.p === prix));
    if (p.type === "bedroom-set" || p.type === "dining-set") {
      const ens = [...new Set(v.filter((x) => RE_ENSEMBLE.test(x.t)).map((x) => x.p).filter((n) => n > 0))];
      if (ens.length) { const m = Math.min(...ens); return { val: m, multi: ens.length > 1, idx: idxDe(m) }; }
    }
    const m = Math.min(...tous);
    return { val: m, multi: tous.length > 1, idx: idxDe(m) };
  };
  const prixHTML = (p) => {
    const { val, multi } = prixAffiche(p);
    if (!(val > 0)) return `<span class="val">Sur demande</span>`;
    return `${multi ? `<span class="from">dès</span>` : ""}<span class="val">${fmt(val)}</span>`;
  };

  /* ---------- Lenis (défilement inertiel) ---------- */
  let lenis = null;
  if (window.Lenis && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1.02 });
    window.__lenis = lenis;
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    // ancres internes
    $$('a[href^="#"], a[href^="index.html#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").split("#")[1];
        const t = id && document.getElementById(id);
        if (t) { e.preventDefault(); lenis.scrollTo(t, { offset: -90, duration: 1.4 }); }
      });
    });
  }

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const onScroll = () => nav && nav.classList.toggle("is-scrolled", window.scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const burger = $("#burger");
  if (burger) {
    burger.addEventListener("click", () => {
      const open = document.body.classList.toggle("menu-open");
      burger.setAttribute("aria-expanded", open);
    });
    $$("#mobileMenu a").forEach((a) =>
      a.addEventListener("click", () => document.body.classList.remove("menu-open"))
    );
  }

  // lien actif
  const path = location.pathname.split("/").pop() || "index.html";
  $$(".nav-links a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === path || (path === "matelas.html" && href.startsWith("matelas.html") && href.includes(new URLSearchParams(location.search).get("cat") || " ")))
      a.classList.add("is-active");
    else if (path === "matelas.html" && href === "matelas.html" && !location.search) a.classList.add("is-active");
  });

  /* ---------- Reveals ---------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }),
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  $$(".reveal, .mask-lines").forEach((el) => io.observe(el));

  /* ---------- Compteurs ---------- */
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      cio.unobserve(en.target);
      const el = en.target, target = +el.dataset.count, dur = 1400, t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => cio.observe(el));

  /* ---------- Marquees : dupliquer pour boucler ---------- */
  $$(".marquee-inner").forEach((m) => m.appendChild(m.children[0].cloneNode(true)));
  $$(".zone-row").forEach((r) => {
    const c = r.children[0];
    r.appendChild(c.cloneNode(true));
    r.appendChild(c.cloneNode(true));
  });

  /* ---------- Rail collections ---------- */
  const rail = $("#rail");
  if (rail) {
    const bar = $("#railBar"), prev = $("#railPrev"), next = $("#railNext");
    const step = () => rail.querySelector(".rail-card").getBoundingClientRect().width + 20;
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      if (bar) bar.style.width = Math.max(8, (rail.scrollLeft / max) * 100) + "%";
      if (prev) prev.disabled = rail.scrollLeft < 10;
      if (next) next.disabled = rail.scrollLeft > max - 10;
    };
    rail.addEventListener("scroll", update, { passive: true });
    update();
    prev && prev.addEventListener("click", () => rail.scrollBy({ left: -step() * 2, behavior: "smooth" }));
    next && next.addEventListener("click", () => rail.scrollBy({ left: step() * 2, behavior: "smooth" }));
    // drag à la souris
    let down = false, sx = 0, sl = 0, moved = false;
    rail.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") return;
      down = true; moved = false; sx = e.clientX; sl = rail.scrollLeft; rail.classList.add("dragging");
    });
    addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) moved = true;
      rail.scrollLeft = sl - dx;
    });
    addEventListener("pointerup", () => { down = false; rail.classList.remove("dragging"); });
    rail.addEventListener("click", (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  /* ---------- FAQ / divulgations ---------- */
  document.addEventListener("click", (e) => {
    const q = e.target.closest(".faq-q");
    if (!q) return;
    const item = q.parentElement;
    const open = item.classList.toggle("open");
    q.setAttribute("aria-expanded", open);
  });

  /* ---------- Réveil « en couches » du titre ----------
     Chaque mot est reconstruit en trois calques superposés — ressorts,
     mousse, coutil — qui se posent du bas vers le haut. Le geste imite
     l'assemblage d'un matelas ; le coutil arrive en dernier avec un léger
     rebond, comme une mousse qui reprend sa forme.
     Le texte reste intact pour les lecteurs d'écran : seuls les calques 2
     et 3 sont dupliqués, et ils sont masqués aux technologies d'assistance. */
  const heroTitle = $("#heroTitle");
  if (heroTitle && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const build = (node, out) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { out.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "w";
            for (let i = 1; i <= 3; i++) {
              const l = document.createElement("span");
              l.className = "lyr l" + i;
              l.textContent = part;
              if (i > 1) l.setAttribute("aria-hidden", "true");
              w.appendChild(l);
            }
            out.appendChild(w);
          });
        } else {
          const clone = child.cloneNode(false);
          build(child, clone);
          out.appendChild(clone);
        }
      });
    };
    // On garde le titre d'origine sous la main : une fois l'animation jouée,
    // on le remet tel quel plutot que de laisser trois copies de chaque mot
    // dans le DOM (le h1 se lirait « BienBienBien dormir… »).
    const original = heroTitle.innerHTML;
    const rebuilt = document.createElement("h1");
    build(heroTitle, rebuilt);
    heroTitle.innerHTML = rebuilt.innerHTML;
    heroTitle.classList.add("is-layering");

    const words = $$(".w", heroTitle);
    words.forEach((w, i) => w.style.setProperty("--wd", (i * 0.075).toFixed(3) + "s"));
    requestAnimationFrame(() => words.forEach((w) => w.classList.add("armed")));
    // Une fois posé, le titre redevient exactement ce qu'il était : un texte
    // simple, sélectionnable, sans découpe ni doublon.
    setTimeout(() => {
      heroTitle.classList.add("layers-done");
      heroTitle.innerHTML = original;
      heroTitle.classList.remove("is-layering", "layers-done");
    }, 900 + words.length * 75);
  }

  /* ---------- Parallaxe légère du héros ---------- */
  const heroImg = $(".hero-frame-core img");
  if (heroImg && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let ticking = false;
    addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, 800);
        heroImg.style.translate = `0 ${y * 0.06}px`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ============================================================
     PANIER (localStorage)
     ============================================================ */
  /* ---------- Délais ----------
     Deux réalités dans le catalogue : ce qui dort dans l'entrepôt part en
     24–48 h, le reste est commandé chez le fournisseur (6–7 jours ouvrables,
     autant pour la livraison que pour le ramassage). Les articles fournisseur
     portent un handle « ifdc- ».                                        */
  const isStock = (p) => !!p && !String(p.h || p).startsWith("ifdc-");
  const DELAI_STOCK = "24–48 h";
  const DELAI_COMMANDE = "6–7 jours ouvrables";
  const delaiOf = (p) => (isStock(p) ? DELAI_STOCK : DELAI_COMMANDE);
  // Une commande mixte avance au rythme du plus lent.
  const delaiCart = (c) => (c.some((i) => !isStock(i.h)) ? DELAI_COMMANDE : DELAI_STOCK);
  window.LDA_DELAI = { isStock, delaiOf, delaiCart, DELAI_STOCK, DELAI_COMMANDE };

  const CART_KEY = "lda_cart_v1";
  const ZONE_KEY = "lda_zone_v1";
  const DELIVERY_FEE = 50;
  const getZone = () => { try { return localStorage.getItem(ZONE_KEY) || "montreal"; } catch { return "montreal"; } };
  const setZone = (z) => { try { localStorage.setItem(ZONE_KEY, z); } catch {} };
  // Le panier et la fiche produit doivent retrouver même un article retiré :
  // on cherche dans le catalogue complet, la disponibilité se lit sur `off`.
  const byHandle = (h) => (window.LDA_TOUT || window.CATALOG || []).find((p) => p.h === h);
  const loadCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const saveCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

  const toastEl = $("#toast"); let toastT;
  function toast(msg) {
    if (!toastEl) return;
    $("#toastMsg").textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  function cartCountTotal(c) { return c.reduce((s, i) => s + i.q, 0); }

  function renderCart() {
    const c = loadCart();
    const n = cartCountTotal(c);
    const cnt = $("#cartCount");
    if (cnt) {
      cnt.textContent = n;
      cnt.classList.toggle("has-items", n > 0);
    }
    const itemsEl = $("#cartItems");
    if (!itemsEl) return;
    const qtyEl = $("#cartQty");
    if (qtyEl) qtyEl.textContent = n ? `(${n})` : "";

    if (!c.length) {
      itemsEl.innerHTML = `<div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1.3 12.1a1.8 1.8 0 0 1-1.8 1.9H6.5a1.8 1.8 0 0 1-1.8-1.9L6 7Z"/><path d="M8.5 9.5V6a3.5 3.5 0 0 1 7 0v3.5"/></svg>
        <b>Votre panier dort encore</b><p>Ajoutez un matelas — nos modèles en stock partent en 24–48 h.</p>
      </div>`;
    } else {
      itemsEl.innerHTML = c.map((i, idx) => {
        const p = byHandle(i.h);
        const img = p && p.imgs[0] ? p.imgs[0] + (p.imgs[0].includes("?") ? "&" : "?") + "width=200" : "";
        // Un panier peut dormir des semaines dans le navigateur : l'article
        // qu'il contient a pu être retiré par le fournisseur entre-temps.
        const parti = !!(p && p.off);
        return `<div class="cart-item${parti ? " cart-item--parti" : ""}">
          <span class="ci-img"><img src="${img}" alt=""></span>
          <span>
            <span class="ci-name">${i.name}</span>
            <span class="ci-variant">${i.v}</span>
            ${parti ? `<span class="ci-parti">Plus offert — retirez-le pour continuer</span>` : ""}
            <span class="ci-price">${fmt(i.p * i.q)}</span>
          </span>
          <span class="ci-right">
            <span class="ci-qty">
              <button data-dec="${idx}" aria-label="Réduire"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
              <b>${i.q}</b>
              <button data-inc="${idx}" aria-label="Augmenter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
            </span>
            <button class="ci-remove" data-rm="${idx}">Retirer</button>
          </span>
        </div>`;
      }).join("");
    }

    const total = c.reduce((s, i) => s + i.p * i.q, 0);
    const totalEl = $("#cartTotal");
    if (totalEl) totalEl.textContent = fmt(total);

    // Livraison : 50 $ dans Montréal et environs, gratuit au ramassage.
    const ship = $("#cartShip");
    if (ship) {
      ship.innerHTML = c.length
        ? `<div class="ship-pick">
             <span class="ship-lab">Livraison</span>
             <div class="ship-opts">
               <label class="ship-opt"><input type="radio" name="zone" value="montreal" ${getZone() === "montreal" ? "checked" : ""}><span><b>Montréal et environs</b><em>Jusqu'à Saint-Jérôme et Joliette · 50&nbsp;$</em></span></label>
               <label class="ship-opt"><input type="radio" name="zone" value="ramassage" ${getZone() === "ramassage" ? "checked" : ""}><span><b>Ramassage au showroom</b><em>3512, boul. Industriel · gratuit</em></span></label>
             </div>
             <p class="ship-far">Plus loin que Saint-Jérôme ou Joliette&nbsp;? <a href="tel:+14383754949">Appelez-nous</a> — on vous soumissionne la livraison.</p>
           </div>`
        : "";
    }

    const delaiLine = $("#cartDelai");
    if (delaiLine) {
      delaiLine.hidden = !c.length;
      if (c.length) {
        const d = delaiCart(c);
        delaiLine.innerHTML = `<span>${d === DELAI_STOCK ? "En stock" : "Sur commande"}</span><b>${
          getZone() === "ramassage" ? "Prêt à ramasser" : "Livré"} sous ${d}</b>`;
      }
    }

    const shipLine = $("#cartShipLine");
    if (shipLine) {
      const fee = getZone() === "ramassage" ? 0 : DELIVERY_FEE;
      shipLine.hidden = !c.length;
      shipLine.querySelector("b").textContent = fee ? fmt(fee) : "Gratuit";
    }
    if (totalEl && c.length) {
      totalEl.textContent = fmt(total + (getZone() === "ramassage" ? 0 : DELIVERY_FEE));
    }
  }

  /* variantIdx = null ⇒ « celle dont le prix est affiché ».
     Ces fiches fournisseur mélangent l'ensemble et ses pièces, dans un ordre
     arbitraire : variants[0] n'a aucun rapport avec le prix de la carte. Le
     bouton « Panier » ajoutait donc autre chose que ce qui était annoncé —
     un ensemble à 2 199,98 $ sous une carte affichant 459,98 $. */
  function addToCart(handle, variantIdx = null, qty = 1) {
    const p = byHandle(handle) || (window.LDA_TOUT || []).find((x) => x.h === handle);
    if (!p) return;
    if (variantIdx === null || variantIdx === undefined) variantIdx = prixAffiche(p).idx;
    // Retiré chez IFDC entre-temps : mieux vaut un refus net qu'une commande
    // qu'on ne pourra pas honorer.
    if (p.off) return toast(`${p.name} n'est plus offert — appelez-nous au 438-375-4949`);
    const v = p.variants[variantIdx] || p.variants[0];
    const c = loadCart();
    const key = handle + "::" + v.t;
    const found = c.find((i) => i.k === key);
    if (found) found.q += qty;
    else c.push({ k: key, h: handle, name: p.name, v: v.t === "Default Title" ? "Format unique" : v.t, p: v.p, q: qty });
    saveCart(c);
    renderCart();
    window.LDA_PIXEL && window.LDA_PIXEL.addToCart(p, v, qty);
    const cnt = $("#cartCount");
    if (cnt) { cnt.classList.remove("bump"); void cnt.offsetWidth; cnt.classList.add("bump"); }
    toast(`${p.name} — ajouté au panier`);
  }

  const drawer = $("#cartDrawer");
  const openCart = () => { document.body.classList.add("cart-open"); renderCart(); };
  const closeCart = () => document.body.classList.remove("cart-open");
  $("#cartOpen") && $("#cartOpen").addEventListener("click", openCart);
  $("#cartClose") && $("#cartClose").addEventListener("click", closeCart);
  $("#cartOverlay") && $("#cartOverlay").addEventListener("click", closeCart);
  addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCart(); document.body.classList.remove("menu-open"); } });
  // Choix de la zone de livraison
  drawer && drawer.addEventListener("change", (e) => {
    const r = e.target.closest('input[name="zone"]');
    if (!r) return;
    setZone(r.value);
    renderCart();
  });

  // Paiement — on passe d'abord par « Vos coordonnées » (commande.js), puis
  // Stripe. Le repli direct sert si ce script n'a pas pu charger.
  /* Chargement à la demande du module de commande.
     Le formulaire de coordonnées — dont le champ téléphone obligatoire pour
     planifier la livraison — n'a rien à faire dans le DOM des pages de
     catalogue : il n'entre dans la page qu'au moment où le client passe à la
     caisse. Moins de DOM sur chaque page, et aucun champ requis caché sur
     des pages où l'on ne commande pas. */
  const VERSION = ((document.currentScript && document.currentScript.src.match(/\?v=\d+/)) || [""])[0];
  let promesseCommande = null;
  const chargerCommande = () => {
    if (window.LDA_COMMANDE) return Promise.resolve();
    if (!promesseCommande)
      promesseCommande = new Promise((ok, ko) => {
        const sc = document.createElement("script");
        sc.src = "commande.js" + VERSION;
        sc.onload = ok;
        sc.onerror = ko;
        document.head.appendChild(sc);
      }).catch(() => { promesseCommande = null; throw new Error("commande.js"); });
    return promesseCommande;
  };

  const checkoutBtn = $("#checkoutBtn");
  checkoutBtn && checkoutBtn.addEventListener("click", async () => {
    const c = loadCart();
    if (!c.length) { toast("Votre panier est vide."); return; }
    // Le serveur refuserait de toute façon : autant le dire ici, clairement.
    const partis = c.filter((i) => { const p = byHandle(i.h); return p && p.off; });
    if (partis.length) { openCart(); toast(`${partis[0].name} n'est plus offert — retirez-le du panier`); return; }
    window.LDA_PIXEL && window.LDA_PIXEL.initiateCheckout(c);
    try { await chargerCommande(); } catch (e) { /* on retombe sur le téléphone */ }
    if (window.LDA_COMMANDE) { window.LDA_COMMANDE.open(); return; }
    // Sans commande.js on n'a ni coordonnées ni adresse, et le serveur les
    // exige. Inutile de tenter l'appel : on oriente vers le téléphone.
    toast("Commande en ligne indisponible — appelez-nous au 438-375-4949.");
  });

  if (drawer) {
    drawer.addEventListener("click", (e) => {
      const dec = e.target.closest("[data-dec]"), inc = e.target.closest("[data-inc]"), rm = e.target.closest("[data-rm]");
      if (!dec && !inc && !rm) return;
      const c = loadCart();
      if (inc) c[+inc.dataset.inc].q++;
      if (dec) { const i = c[+dec.dataset.dec]; i.q = Math.max(0, i.q - 1); if (!i.q) c.splice(+dec.dataset.dec, 1); }
      if (rm) c.splice(+rm.dataset.rm, 1);
      saveCart(c);
      renderCart();
    });
  }

  // boutons "Panier" (ajout rapide = premier format)
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (b) { e.preventDefault(); addToCart(b.dataset.add, null, 1); }
  });

  renderCart();

  /* ============================================================
     PAGE CATALOGUE
     ============================================================ */
  const catGrid = $("#catGrid");
  if (catGrid && window.CATALOG) {
    const params = new URLSearchParams(location.search);
    let cat = params.get("cat") || "tous";
    let size = (params.get("size") || "").toLowerCase();

    /* « sectionnels » était un département de premier niveau ; c'est en
       réalité une sous-catégorie du salon. Les anciennes URL et les liens
       déjà partagés continuent de fonctionner : on les traduit ici. */
    const CAT_ALIAS = { sectionnels: ["salon", "sectionnels"] };
    let aliasSub = "";
    if (CAT_ALIAS[cat]) [cat, aliasSub] = CAT_ALIAS[cat];

    const CAT_LABELS = {
      tous: "Tous",
      matelas: "Matelas",
      ensembles: "Chambres à coucher",
      lits: "Lits & têtes de lit",
      salon: "Salon",
      salle: "Salle à manger",
      pieces: "Commodes & tables de nuit",
      divers: "Bureau, rangement & décor",
    };
    const SIZE_MATCH = {
      simple: ["simple", "single", "twin", "39"],
      double: ["double", "54"],
      queen: ["queen", "60"],
      king: ["king", "76", "78"],
    };

    const catOf = (p) => p.cat;
    const matchSize = (p) =>
      !size || p.cat !== "matelas"
        ? !size
        : p.variants.some((v) => SIZE_MATCH[size].some((m) => v.t.toLowerCase().includes(m)));
    const matches = (p) => (cat === "tous" || catOf(p) === cat) && (size ? (p.cat === "matelas" && matchSize(p)) : true) && matchSub(p);

    /* Sous-filtres pilotés par les données.
       Chaque puce liste des `type` canoniques stockés sur le produit. Les
       types étant exclusifs, un produit tombe dans exactement une puce —
       fini les 62 inclinables comptés à la fois en « inclinables » et en
       « sofas », et les 83 produits qu'aucun filtre n'attrapait. */
    const SUBS = {
      matelas: [
        { k: "matelas", label: "Matelas", types: ["mattress"] },
        { k: "bases", label: "Bases ajustables", types: ["adjustable-base"] },
        { k: "sommiers", label: "Sommiers", types: ["box-spring"] },
      ],
      lits: [
        { k: "lits", label: "Lits", types: ["bed"] },
        { k: "tetes", label: "Têtes de lit", types: ["headboard"] },
        { k: "superpose", label: "Superposés", style: "superpose" },
        { k: "dejour", label: "De jour & gigognes", style: "dejour" },
        { k: "coffre", label: "Coffre & rangement", style: "coffre" },
        { k: "bancs", label: "Bancs & coffres", types: ["bench", "chest"] },
      ],
      pieces: [
        { k: "commodes", label: "Commodes & dressoirs", types: ["dresser"] },
        { k: "tnuit", label: "Tables de nuit", types: ["nightstand"] },
        { k: "chiffonniers", label: "Chiffonniers & coffres", types: ["chest"] },
      ],
      salon: [
        { k: "sectionnels", label: "Sectionnels", types: ["sectional"] },
        { k: "inclinables", label: "Fauteuils inclinables", types: ["recliner"] },
        { k: "sofas", label: "Sofas & causeuses", types: ["sofa"] },
        { k: "sofaslits", label: "Sofas-lits & futons", types: ["sofa-bed"] },
        { k: "fauteuils", label: "Fauteuils & ottomans", types: ["accent-chair", "ottoman"] },
        { k: "tables", label: "Tables de salon", types: ["coffee-table", "end-table", "console-table"] },
        { k: "tele", label: "Meubles télé", types: ["tv-stand"] },
        { k: "bancs", label: "Bancs", types: ["bench"] },
      ],
      salle: [
        { k: "ensembles", label: "Ensembles", types: ["dining-set"] },
        { k: "tables", label: "Tables", types: ["dining-table"] },
        { k: "chaises", label: "Chaises", types: ["dining-chair"] },
        { k: "tabourets", label: "Tabourets", types: ["bar-stool"] },
      ],
      divers: [
        { k: "bureaux", label: "Bureaux", types: ["desk"] },
        { k: "chaisesbureau", label: "Chaises de bureau", types: ["office-chair"] },
        { k: "etageres", label: "Étagères & bibliothèques", types: ["shelving", "bookcase"] },
        { k: "rangement", label: "Rangement & entrée", types: ["coat-rack"] },
      ],
    };
    const inSub = (p, d) => (d.style ? p.style === d.style : (d.types || []).includes(p.type));

    let sub = aliasSub || params.get("sub") || "";
    const matchSub = (p) => {
      if (!sub) return true;
      const def = (SUBS[cat] || []).find((d) => d.k === sub);
      return def ? inSub(p, def) : true;
    };

    // barre de filtres
    const bar = $("#filterBar");
    const counts = { tous: CATALOG.length };
    CATALOG.forEach((p) => (counts[p.cat] = (counts[p.cat] || 0) + 1));
    bar.innerHTML = Object.keys(CAT_LABELS)
      .map((k) => `<button class="fchip ${k === cat ? "on" : ""}" data-cat="${k}">${CAT_LABELS[k]}<span>${counts[k] || 0}</span></button>`)
      .join("");

    const subBar = $("#subBar");
    function renderSubBar() {
      if (!subBar) return;
      const defs = SUBS[cat];
      if (!defs || size) { subBar.hidden = true; subBar.innerHTML = ""; return; }
      const base = CATALOG.filter((p) => p.cat === cat);
      subBar.hidden = false;
      subBar.innerHTML =
        `<button class="schip ${!sub ? "on" : ""}" data-sub="">Tout</button>` +
        defs
          .map((s) => {
            const n = base.filter((p) => inSub(p, s)).length;
            return n ? `<button class="schip ${sub === s.k ? "on" : ""}" data-sub="${s.k}">${s.label}<span>${n}</span></button>` : "";
          })
          .join("");
    }
    subBar && subBar.addEventListener("click", (e) => {
      const c = e.target.closest(".schip");
      if (!c) return;
      sub = c.dataset.sub;
      const u = new URL(location.href);
      sub ? u.searchParams.set("sub", sub) : u.searchParams.delete("sub");
      history.replaceState(null, "", u);
      $$(".schip", subBar).forEach((x) => x.classList.toggle("on", x === c));
      shown = PAGE;
      renderGrid();
    });

    const CARD_KICKERS = { matelas: "Matelas", ensembles: "Ensemble de chambre", lits: "Lit & tête de lit", sectionnels: "Sectionnel-lit", salon: "Salon", salle: "Salle à manger", pieces: "Pièce à l'unité", divers: "Bureau & divers" };

    function card(p, i) {
      const img = p.imgs[0] ? p.imgs[0] + (p.imgs[0].includes("?") ? "&" : "?") + "width=600" : "";
      const img2 = p.imgs[1] ? p.imgs[1] + (p.imgs[1].includes("?") ? "&" : "?") + "width=600" : "";
      const multi = p.variants.length > 1;
      return `<article class="product-card" style="--d:${Math.min(i * 0.05, 0.45)}s">
        <div class="pc-core">
          <a class="pc-media" href="produit.html?p=${encodeURIComponent(p.h)}" ${img2 ? `data-img2="${img2}" data-img1="${img}"` : ""}>
            ${isStock(p) ? `<span class="pc-chip pc-chip--stock">En stock · ${DELAI_STOCK}</span>` : `<span class="pc-chip pc-chip--order">Sur commande · ${DELAI_COMMANDE}</span>`}
            <img src="${img}" alt="${p.name}" loading="lazy" decoding="async">
          </a>
          <div class="pc-body">
            <span class="pc-cat">${p.sub ? p.sub.split("—")[0].slice(0, 46) : CARD_KICKERS[p.cat]}</span>
            <h3 class="pc-name"><a href="produit.html?p=${encodeURIComponent(p.h)}">${p.name}</a></h3>
            <div class="pc-foot">
              <span class="pc-price">${prixHTML(p)}</span>
              <button class="pc-add" data-add="${p.h}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Panier
              </button>
            </div>
          </div>
        </div>
      </article>`;
    }

    const ORDER = { matelas: 0, ensembles: 1, lits: 2, sectionnels: 3, salon: 4, salle: 5, pieces: 6, divers: 7 };
    const PAGE = 60;
    let shown = PAGE;
    let sort = "reco";
    const SORTS = {
      reco: (a, b) => ORDER[a.cat] - ORDER[b.cat] || a.from - b.from,
      asc: (a, b) => a.from - b.from,
      desc: (a, b) => b.from - a.from,
      az: (a, b) => a.name.localeCompare(b.name, "fr"),
    };
    const moreBtn = $("#moreBtn");
    function renderGrid() {
      renderSubBar();
      const list = CATALOG.filter(matches).sort(SORTS[sort] || SORTS.reco);
      const slice = list.slice(0, shown);
      catGrid.innerHTML = slice.map(card).join("");
      $("#catCount").textContent = size
        ? `${list.length} matelas offerts en format ${size.charAt(0).toUpperCase() + size.slice(1)}`
        : `${list.length} produit${list.length > 1 ? "s" : ""} — prix d'usine, taxes en sus`;
      if (moreBtn) {
        const rest = list.length - slice.length;
        moreBtn.hidden = rest <= 0;
        moreBtn.querySelector("b").textContent = rest > 0 ? `Afficher plus (${rest} restant${rest > 1 ? "s" : ""})` : "";
      }
      // survol : deuxième image
      $$("[data-img2]", catGrid).forEach((a) => {
        const im = a.querySelector("img");
        a.addEventListener("mouseenter", () => (im.src = a.dataset.img2));
        a.addEventListener("mouseleave", () => (im.src = a.dataset.img1));
      });
    }
    moreBtn && moreBtn.addEventListener("click", () => { shown += PAGE * 2; renderGrid(); });

    const sortSel = $("#sortSel");
    sortSel && sortSel.addEventListener("change", () => { sort = sortSel.value; shown = PAGE; renderGrid(); });

    bar.addEventListener("click", (e) => {
      const chip = e.target.closest(".fchip");
      if (!chip) return;
      cat = chip.dataset.cat;
      size = "";
      sub = "";
      shown = PAGE;
      $$(".fchip", bar).forEach((c) => c.classList.toggle("on", c === chip));
      const url = new URL(location);
      url.searchParams.delete("size");
      url.searchParams.delete("sub");
      sub = "";
      cat === "tous" ? url.searchParams.delete("cat") : url.searchParams.set("cat", cat);
      history.replaceState(null, "", url);
      renderSubBar();
      renderGrid();
    });

    const heroTitle = $("#catTitle");
    if (heroTitle) {
      if (size) heroTitle.innerHTML = `Matelas <em>${size.charAt(0).toUpperCase() + size.slice(1)}</em>`;
      else if (cat === "ensembles") heroTitle.innerHTML = `Chambres <em>à coucher</em>`;
      else if (cat === "lits") heroTitle.innerHTML = `Lits &amp; <em>têtes de lit</em>`;
      else if (sub === "sectionnels") heroTitle.innerHTML = `Sectionnels<em>-lits</em>`;
      else if (cat === "salon") heroTitle.innerHTML = `Le <em>salon</em>`;
      else if (cat === "salle") heroTitle.innerHTML = `Salle à <em>manger</em>`;
      else if (cat === "pieces") heroTitle.innerHTML = `Commodes <em>&amp; tables</em>`;
      else if (cat === "divers") heroTitle.innerHTML = `Bureau <em>&amp; divers</em>`;
    }
    renderGrid();
  }

  /* ============================================================
     TUILES DÉPARTEMENTS (accueil)
     ============================================================ */
  const deptGrid = $("#deptGrid");
  if (deptGrid && window.CATALOG) {
    const DEPT_TILES = [
      { cat: "matelas", label: "Matelas & sommiers", pick: "royal-supreme-10-matelas-euro-top-a-ressorts-800-pocket-coil" },
      { cat: "lits", label: "Lits & têtes de lit" },
      { cat: "ensembles", label: "Ensembles de chambre", pick: "madison-100" },
      { cat: "pieces", label: "Commodes & tables de nuit", pick: "commode-miroir-if-100-if-100-d-m" },
      { cat: "sectionnels", label: "Sectionnels-lits", pick: "if-9470-9471-sofa-bed-sectionnel-reversible-avec-rangement-ottoman-optionnel" },
      { cat: "salon", label: "Salon" },
      { cat: "salle", label: "Salle à manger", pickSub: /7 pièces/i },
      { cat: "divers", label: "Bureau & divers" },
    ];
    deptGrid.innerHTML = DEPT_TILES.map((d, i) => {
      const items = CATALOG.filter((p) => p.cat === d.cat);
      if (!items.length) return "";
      let p = d.pick ? items.find((x) => x.h === d.pick) : null;
      if (!p && d.pickSub) p = items.find((x) => d.pickSub.test(x.sub || ""));
      if (!p) p = items.find((x) => x.imgs && x.imgs[0]) || items[0];
      const img = p.imgs && p.imgs[0] ? p.imgs[0] + (p.imgs[0].includes("?") ? "&" : "?") + "width=500" : "";
      const min = Math.min(...items.map((x) => x.from));
      return `<a class="dept-card reveal" style="--d:${(i % 4) * 0.07}s" href="matelas.html?cat=${d.cat}">
        <span class="dc-media"><img src="${img}" alt="${d.label}" loading="lazy" decoding="async"></span>
        <span class="dc-body">
          <b>${d.label}</b>
          <span>${items.length} produit${items.length > 1 ? "s" : ""} · dès ${fmt(min)}</span>
        </span>
        <span class="dc-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span>
      </a>`;
    }).join("");
    $$(".dept-card", deptGrid).forEach((el) => io.observe(el));
  }

  /* ============================================================
     PAGE PRODUIT
     ============================================================ */
  const pRoot = $("#productRoot");
  if (pRoot && window.CATALOG) {
    const handle = new URLSearchParams(location.search).get("p") || "royal-supreme-10-matelas-euro-top-a-ressorts-800-pocket-coil";
    const p = byHandle(handle) || byHandle("royal-supreme-10-matelas-euro-top-a-ressorts-800-pocket-coil");
    let vi = 0, qty = 1;

    document.title = `${p.name} — Literie d'Amitié`;
    const KICKERS = { matelas: "Matelas cousu à Montréal", ensembles: "Ensemble de chambre", lits: "Lit & tête de lit", sectionnels: "Sectionnel-lit", salon: "Meuble de salon", salle: "Salle à manger", pieces: "Meuble de chambre", divers: "Bureau & divers" };

    const imgs = p.imgs.length ? p.imgs : [""];
    const imgUrl = (u, w) => (u ? u + (u.includes("?") ? "&" : "?") + "width=" + w : "");

    $("#pCrumb").textContent = p.name;
    $("#pKicker").textContent = p.sub ? p.sub.split("—")[0] : KICKERS[p.cat];
    $("#pTitle").textContent = p.name;
    $("#pSub").textContent = p.sub && p.sub.includes("—") ? p.sub.split("—").slice(1).join("—").trim() : (p.sub || "");

    // Le délai dépend du produit : entrepôt ou commande fournisseur.
    const dTitre = $("#pDelaiTitre"), dTexte = $("#pDelaiTexte");
    if (dTitre && dTexte) {
      dTitre.textContent = isStock(p) ? `Livraison ${DELAI_STOCK}` : `Livraison en ${DELAI_COMMANDE}`;
      dTexte.textContent = isStock(p)
        ? "En stock — Grand Montréal 50 $, ou ramassage gratuit"
        : "Sur commande chez notre fournisseur — livraison 50 $ ou ramassage gratuit";
    }

    const mainImg = $("#gMain");
    mainImg.src = imgUrl(imgs[0], 1000);
    mainImg.alt = p.name;

    if (imgs.length > 1) {
      $("#gThumbs").innerHTML = imgs
        .map((u, i) => `<button class="g-thumb ${i === 0 ? "on" : ""}" data-g="${i}"><img src="${imgUrl(u, 160)}" alt=""></button>`)
        .join("");
      $("#gThumbs").addEventListener("click", (e) => {
        const t = e.target.closest("[data-g]");
        if (!t) return;
        $$(".g-thumb").forEach((x) => x.classList.toggle("on", x === t));
        mainImg.classList.add("swap");
        setTimeout(() => { mainImg.src = imgUrl(imgs[+t.dataset.g], 1000); mainImg.classList.remove("swap"); }, 180);
      });
    }

    function renderPrice() {
      const v = p.variants[vi];
      $("#pPrice").textContent = fmt(v.p);
      const was = $("#pWas"), save = $("#pSave");
      if (v.c && v.c > v.p) {
        was.textContent = fmt(v.c); was.hidden = false;
        save.textContent = `Économisez ${fmt(v.c - v.p)}`; save.hidden = false;
      } else { was.hidden = true; save.hidden = true; }
    }

    if (p.variants.length > 1) {
      $("#vBlock").hidden = false;
      $("#vChips").innerHTML = p.variants
        .map((v, i) => `<button class="v-chip ${i === 0 ? "on" : ""}" data-v="${i}"><b>${v.t}</b><span>${fmt(v.p)}</span></button>`)
        .join("");
      $("#vChips").addEventListener("click", (e) => {
        const c = e.target.closest("[data-v]");
        if (!c) return;
        vi = +c.dataset.v;
        $$(".v-chip").forEach((x) => x.classList.toggle("on", x === c));
        renderPrice();
      });
    }
    renderPrice();

    $("#qtyVal") && $("#qtyPlus").addEventListener("click", () => { qty++; $("#qtyVal").textContent = qty; });
    $("#qtyVal") && $("#qtyMinus").addEventListener("click", () => { qty = Math.max(1, qty - 1); $("#qtyVal").textContent = qty; });
    $("#pAdd").addEventListener("click", () => { addToCart(p.h, vi, qty); openCart(); });
    window.LDA_PIXEL && window.LDA_PIXEL.viewContent(p, p.variants[vi]);

    /* ---------- Article retiré chez le fournisseur ----------
       Un lien partagé ou indexé par Google reste vivant longtemps. Plutôt
       que de rediriger vers autre chose, la fiche se tient debout et le dit :
       ce meuble n'est plus offert, voici le téléphone, voici trois voisins. */
    if (p.off) {
      const actions = $(".p-actions");
      if (actions) {
        actions.innerHTML = `<a class="btn" href="tel:+14383754949">Appelez-nous — 438-375-4949
          <span class="btn-orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span></a>
          <a class="btn btn--ghost" href="matelas.html?cat=${p.cat}">Voir les modèles offerts</a>`;
        actions.insertAdjacentHTML("beforebegin", `<div class="p-parti">
          <b>Ce modèle n'est plus offert</b>
          <span>Notre fournisseur l'a retiré de sa gamme. Appelez-nous&nbsp;: il reste parfois une pièce au showroom, et on vous trouve l'équivalent.</span>
        </div>`);
      }
      const prix = $(".p-price-row"), vb = $("#vBlock");
      if (prix) prix.hidden = true;
      if (vb) vb.hidden = true;
      const dTit = $("#pDelaiTitre"), dTex = $("#pDelaiTexte");
      if (dTit && dTex) { dTit.textContent = "Plus au catalogue"; dTex.textContent = "Retiré par le fournisseur — appelez-nous pour un équivalent"; }
      document.title = `${p.name} — plus offert | Literie d'Amitié`;
      const rob = document.createElement("meta");
      rob.name = "robots"; rob.content = "noindex";      // qu'il sorte des résultats de recherche
      document.head.appendChild(rob);
    }

    // Détails générés selon la catégorie
    const dims = { simple: "39 po × 75 po", double: "54 po × 75 po", queen: "60 po × 80 po", king: "76/78 po × 80 po" };
    const sizeList = p.cat === "matelas"
      ? p.variants.map((v) => {
          const t = v.t.toLowerCase();
          const d = t.includes("king") ? dims.king : t.includes("queen") ? dims.queen : t.includes("double") ? dims.double : dims.simple;
          return `${v.t} — ${d}`;
        })
      : [];
    $("#dDims").innerHTML = sizeList.length
      ? sizeList.map((s) => `<li>${s}</li>`).join("")
      : `<li>Dimensions détaillées sur demande — appelez-nous au 438-375-4949.</li>`;

    // produits reliés (même catégorie)
    const rel = CATALOG.filter((x) => x.cat === p.cat && x.h !== p.h).slice(0, 3);
    $("#relatedGrid").innerHTML = rel
      .map(
        (r) => `<article class="product-card reveal">
        <div class="pc-core">
          <a class="pc-media" href="produit.html?p=${encodeURIComponent(r.h)}">
            <img src="${imgUrl(r.imgs[0], 600)}" alt="${r.name}" loading="lazy" decoding="async">
          </a>
          <div class="pc-body">
            <span class="pc-cat">${KICKERS[r.cat]}</span>
            <h3 class="pc-name"><a href="produit.html?p=${encodeURIComponent(r.h)}">${r.name}</a></h3>
            <div class="pc-foot">
              <span class="pc-price">${prixHTML(r)}</span>
              <button class="pc-add" data-add="${r.h}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                Panier
              </button>
            </div>
          </div>
        </div>
      </article>`
      )
      .join("");
    $$("#relatedGrid .reveal").forEach((el) => io.observe(el));
  }

  /* ============================================================
     COMPOSANTS PARTAGÉS — pages étendues
     ============================================================ */
  const imgW = (u, w) => (u ? u + (u.includes("?") ? "&" : "?") + "width=" + w : "");
  const KICK = { matelas: "Matelas", ensembles: "Ensemble de chambre", lits: "Lit & tête de lit", sectionnels: "Sectionnel-lit", salon: "Salon", salle: "Salle à manger", pieces: "Pièce à l'unité", divers: "Bureau & divers" };
  const priceLabel = (p) => (p.from > 0 ? prixHTML(p) : `<span class="val">Sur demande</span>`);

  function prodCardHTML(p, i) {
    const img = imgW(p.imgs[0], 600), img2 = imgW(p.imgs[1], 600);
    return `<article class="product-card" style="--d:${Math.min((i || 0) * 0.05, 0.4)}s">
      <div class="pc-core">
        <a class="pc-media" href="produit.html?p=${encodeURIComponent(p.h)}" ${img2 ? `data-img1="${img}" data-img2="${img2}"` : ""}>
          ${isStock(p) ? `<span class="pc-chip pc-chip--stock">En stock · ${DELAI_STOCK}</span>` : `<span class="pc-chip pc-chip--order">Sur commande · ${DELAI_COMMANDE}</span>`}
          <img src="${img}" alt="${p.name}" loading="lazy" decoding="async">
        </a>
        <div class="pc-body">
          <span class="pc-cat">${p.sub ? p.sub.split("—")[0].slice(0, 46) : (KICK[p.cat] || "")}</span>
          <h3 class="pc-name"><a href="produit.html?p=${encodeURIComponent(p.h)}">${p.name}</a></h3>
          <div class="pc-foot">
            <span class="pc-price">${priceLabel(p)}</span>
            <button class="pc-add" data-add="${p.h}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>Panier</button>
          </div>
        </div>
      </div>
    </article>`;
  }
  const hoverSwap = (scope) =>
    $$("[data-img2]", scope).forEach((a) => {
      const im = a.querySelector("img");
      a.addEventListener("mouseenter", () => (im.src = a.dataset.img2));
      a.addEventListener("mouseleave", () => (im.src = a.dataset.img1));
    });

  function colCardHTML(c, i) {
    const href = c.link ? c.link : `collection.html?c=${c.slug}`;
    return `<a class="col-card" style="--d:${Math.min(i * 0.05, 0.4)}s" href="${href}">
      <span class="col-media">${c.badge ? `<span class="col-badge">${c.badge}</span>` : ""}<img src="${imgW(c.img, 700)}" alt="${c.name}" loading="lazy" decoding="async"></span>
      <span class="col-body">
        <span class="col-kicker">${c.kicker}</span>
        <span class="col-name">${c.name}</span>
        ${c.desc ? `<span class="col-desc">${c.desc}</span>` : ""}
        ${c.features ? `<span class="col-tags">${c.features.map((f) => `<span class="col-tag">${f}</span>`).join("")}</span>` : ""}
        <span class="col-foot"><span class="col-price"><span class="from">dès</span><b>${fmt(c.from)}</b></span><span class="col-go">Découvrir <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span></span>
      </span>
    </a>`;
  }

  /* ---------- Index des collections ---------- */
  const collectionsGrid = $("#collectionsGrid");
  if (collectionsGrid && window.COLLECTIONS) {
    collectionsGrid.innerHTML = COLLECTIONS.map((c, i) => colCardHTML(c, i)).join("");
  }

  /* ---------- Liquidation : grille matelas ---------- */
  const liquidationGrid = $("#liquidationGrid");
  if (liquidationGrid && window.CATALOG) {
    // Liquidation = nos matelas cousus ici (fins de série) — pas les articles fournisseur.
    const mats = CATALOG.filter((p) => p.cat === "matelas" && !p.h.startsWith("ifdc-")).sort((a, b) => a.from - b.from);
    liquidationGrid.innerHTML = mats.map((p, i) => prodCardHTML(p, i)).join("");
    hoverSwap(liquidationGrid);
  }

  /* ---------- Fiche collection ---------- */
  const collectionRoot = $("#collectionRoot");
  if (collectionRoot && window.COLLECTIONS) {
    const slug = new URLSearchParams(location.search).get("c");
    const c = COLLECTIONS.find((x) => x.slug === slug);
    if (!c || c.link) {
      location.replace("collections.html");
    } else {
      const typeKey = (p) => {
        const s = (p.name + " " + (p.sub || "")).toLowerCase();
        if (/table de nuit/.test(s)) return "ns";
        if (/chiffonnier/.test(s)) return "chest";
        if (/coffre/.test(s)) return "coffre";
        if (/commode|miroir|dressoir|dresser/.test(s)) return "dresser";
        if (/\blit\b/.test(s)) return "bed";
        return "other";
      };
      document.title = `Collection ${c.name} — Literie d'Amitié, Montréal`;
      $("#collCrumb").textContent = c.name;
      const im = $("#collImg"); im.src = imgW(c.img, 1100); im.alt = c.name;
      $("#collKicker").textContent = c.kicker;
      $("#collTitle").textContent = c.name;
      $("#collDesc").textContent = c.desc;
      $("#collFeats").innerHTML = (c.features || [])
        .map((f) => `<span class="coll-feat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6"/></svg>${f}</span>`)
        .join("");

      const order = { ensembles: 0, sectionnels: 1, pieces: 2, matelas: 3 };
      const prods = (c.handles || []).map(byHandle).filter(Boolean).sort((a, b) => (order[a.cat] - order[b.cat]) || a.from - b.from);
      $("#collGrid").innerHTML = prods.map((p, i) => prodCardHTML(p, i)).join("");
      hoverSwap($("#collGrid"));

      // Module « acheter l'ensemble » : mettre en vedette le produit-ensemble.
      const setProd = prods.find((p) => p.cat === "ensembles" && /ensemble de chambre/i.test((p.sub || "") + " " + p.name) && p.from > 0);
      if (setProd) {
        const seen = new Set([typeKey(setProd)]);
        const included = prods.filter((p) => {
          if (p === setProd || p.from <= 0) return false;
          const k = typeKey(p);
          if (k === "other" || seen.has(k)) return false;
          seen.add(k); return true;
        });
        $("#collBundleWrap").hidden = false;
        $("#collBundle").innerHTML = `
          <div class="bundle-grid">
            <div>
              <span class="eyebrow" style="color:var(--brass-2)">Achat groupé</span>
              <h2>Toute la chambre ${c.name}, d'un coup.</h2>
              <p class="lede">L'ensemble complet — lit, commode, miroir et tables de nuit — livré ensemble par notre équipe montréalaise. Un seul prix, aucune majoration.</p>
              ${included.length ? `<div class="bundle-list">${included.map((p) => `<div class="bundle-row"><span class="bundle-thumb"><img src="${imgW(p.imgs[0], 120)}" alt=""></span><span class="bn">${p.name}</span><span class="bp">inclus</span></div>`).join("")}</div>` : ""}
            </div>
            <div class="bundle-total">
              <div class="bt-label">Ensemble à partir de</div>
              <div class="bt-val">${fmt(setProd.from)}</div>
              <div class="bt-note">Prix d'usine — livré &amp; installé</div>
              <button class="btn btn--ivory" id="bundleAdd">Ajouter l'ensemble <span class="btn-orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span></button>
              <a class="btn btn--ghost" href="tel:+14383754949" style="color:var(--ivory);border-color:var(--line-dark)">Conseil expert</a>
            </div>
          </div>`;
        const ba = $("#bundleAdd");
        if (ba) ba.addEventListener("click", () => { addToCart(setProd.h, null, 1); openCart(); });
      }

      const rel = COLLECTIONS.filter((x) => x.slug !== c.slug).slice(0, 3);
      $("#collRelated").innerHTML = rel.map((r, i) => colCardHTML(r, i)).join("");
    }
  }

  /* ---------- Formulaire de contact (démo) ---------- */
  // Formulaire de contact — envoi réel via Web3Forms. Tant que la clé n'est
  // pas remplie, on n'annonce SURTOUT pas « message envoyé » : on affiche le
  // téléphone et le courriel. Un client qui a un problème de commande ne doit
  // jamais écrire dans le vide.
  const cform = $("#contactForm");
  if (cform) {
    const KEY = cform.dataset.key || "";
    cform.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!cform.checkValidity()) { cform.reportValidity(); return; }

      const showOk = () => {
        cform.classList.add("sent");
        const target = cform.querySelector(".form-ok");
        if (window.__lenis && target) window.__lenis.scrollTo(cform, { offset: -140, duration: 1.1 });
        else cform.scrollIntoView({ behavior: "smooth", block: "center" });
      };

      if (!KEY) {
        toast("Écrivez-nous plutôt à literiedamitieinc@outlook.com ou appelez le 438-375-4949.");
        return;
      }

      const btn = cform.querySelector('button[type="submit"]');
      const label = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.textContent = "Envoi…"; }
      try {
        const fd = new FormData(cform);
        fd.append("access_key", KEY);
        fd.append("subject", "Nouveau message — literiedamitie.com");
        const r = await fetch("https://api.web3forms.com/submit", { method: "POST", body: fd });
        const data = await r.json().catch(() => ({}));
        if (!data.success) throw new Error(data.message || "Envoi impossible");
        showOk();
      } catch (err) {
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
        toast("Envoi impossible — appelez-nous au 438-375-4949.");
      }
    });
  }

  /* ---------- API interne (extras.js : palette, devis, quiz, planificateur) ---------- */
  /* ---------- Verrou de défilement ----------
     Sans ça, la molette au-dessus d'une fenêtre modale fait défiler la PAGE
     derrière : Lenis capte l'événement au niveau de la racine. On gèle donc
     l'arrière-plan dès qu'une surface s'ouvre — panier, menu, recherche,
     quiz, coordonnées — et on rend sa position exacte à la fermeture.      */
  const SURFACES = ["cart-open", "menu-open", "pal-open", "quiz-on", "coord-on"];
  let lockY = 0, locked = false;
  function syncLock() {
    const open = SURFACES.some((c) => document.body.classList.contains(c));
    if (open && !locked) {
      locked = true;
      lockY = window.scrollY;
      if (window.__lenis) window.__lenis.stop();
      const b = document.body.style;
      b.position = "fixed"; b.top = `-${lockY}px`; b.left = "0"; b.right = "0"; b.width = "100%";
    } else if (!open && locked) {
      locked = false;
      const b = document.body.style;
      b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = "";
      window.scrollTo(0, lockY);
      if (window.__lenis) { window.__lenis.start(); window.__lenis.scrollTo(lockY, { immediate: true }); }
    }
  }
  new MutationObserver(syncLock).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  window.LDA = { addToCart, openCart, toast, fmt, byHandle, loadCart, renderCart, prixAffiche, prixHTML };
})();
