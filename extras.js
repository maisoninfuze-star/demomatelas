/* ============================================================
   LITERIE D'AMITIÉ — démo
   Extras « rares » : palette de recherche (⌘K), soumission PDF
   (TPS/TVQ), quiz matelas 60 s, planificateur de chambre,
   pré-rendu des pages au survol (Speculation Rules).
   Dépend de window.LDA (app.js) et window.CATALOG (data.js).
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
  const LDA = window.LDA || {};
  const CAT = window.CATALOG || [];
  const norm = (s) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const esc = (s) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const imgW = (u, w) => (u ? u + (u.includes("?") ? "&" : "?") + "width=" + w : "");

  /* ============================================================
     1. PALETTE DE RECHERCHE (⌘K / Ctrl+K / bouton loupe)
     ============================================================ */
  const PAGES = [
    { t: "Boutique — tous les produits", href: "matelas.html" },
    { t: "Matelas — cousus à Montréal", href: "matelas.html?cat=matelas" },
    { t: "Chambres à coucher — collections", href: "collections.html" },
    { t: "Sectionnels-lits", href: "matelas.html?cat=sectionnels" },
    { t: "Bases & sommiers", href: "bases.html" },
    { t: "Liquidation — matelas neufs", href: "liquidation.html" },
    { t: "Guide des dimensions (Queen, King…)", href: "guide.html" },
    { t: "Ça va rentrer ? — planificateur de chambre", href: "chambre.html" },
    { t: "Livraison — zones du Grand Montréal", href: "livraison.html" },
    { t: "Contact & showroom", href: "contact.html" },
  ];
  const SUGGEST = ["matelas queen", "sommier", "madison", "sectionnel", "commode", "futon"];
  const RECENT_KEY = "lda_recent_v1";
  const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
  const pushRecent = (q) => {
    const r = loadRecent().filter((x) => x !== q);
    r.unshift(q);
    localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 5)));
  };

  let palIndex = null;
  const buildIndex = () => {
    if (palIndex) return palIndex;
    palIndex = CAT.map((p) => ({
      p, name: p.name, sub: p.sub || "",
      n: norm(p.name + " " + (p.sub || "") + " " + p.cat),
    }));
    return palIndex;
  };

  // Score : préfixe > début de mot > inclusion. Tous les mots doivent matcher.
  function score(hay, qWords) {
    let total = 0;
    for (const w of qWords) {
      let s = 0;
      if (hay.startsWith(w)) s = 100;
      else if (hay.includes(" " + w)) s = 60;
      else if (hay.includes(w)) s = 25;
      if (!s) return 0;
      total += s + Math.min(w.length * 2, 14);
    }
    return total;
  }

  function markMatch(text, qWords) {
    let out = esc(text);
    for (const w of qWords) {
      if (w.length < 2) continue;
      const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i");
      const plain = norm(out);
      const i = plain.indexOf(w);
      if (i < 0) continue;
      out = out.replace(re, "<mark>$1</mark>");
    }
    return out;
  }

  // Injecte la palette une seule fois
  const palHTML = `
  <div class="pal-overlay" id="palOverlay"></div>
  <div class="pal" id="pal" role="dialog" aria-modal="true" aria-label="Recherche" data-lenis-prevent>
    <div class="pal-top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>
      <input id="palInput" type="text" placeholder="Matelas queen, commode Madison, sommier…" autocomplete="off" spellcheck="false" aria-label="Rechercher un produit ou une page">
      <button class="pal-esc" id="palClose">esc</button>
    </div>
    <div class="pal-body" id="palBody"></div>
    <div class="pal-foot">
      <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
      <span><kbd>⏎</kbd> ouvrir</span>
      <span><kbd>+</kbd> au panier avec le bouton</span>
      <span class="pal-count" id="palCount">${CAT.length} produits indexés</span>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", palHTML);

  const pal = $("#pal"), palInput = $("#palInput"), palBody = $("#palBody");
  let palOpen = false, activeIdx = 0, curItems = [];

  function openPal() {
    palOpen = true;
    document.body.classList.add("pal-open");
    renderPal("");
    palInput.value = "";
    setTimeout(() => palInput.focus(), 30);
  }
  function closePal() {
    palOpen = false;
    document.body.classList.remove("pal-open");
  }

  function renderPal(q) {
    const qn = norm(q.trim());
    const qWords = qn.split(/\s+/).filter(Boolean);
    let prodHits = [], pageHits = [];

    if (!qWords.length) {
      const recents = loadRecent();
      const sugg = (recents.length ? recents : SUGGEST).slice(0, 5);
      palBody.innerHTML = `
        <div class="pal-group"><span class="pal-label">${recents.length ? "Recherches récentes" : "Suggestions"}</span>
          ${sugg.map((s) => `<button class="pal-item pal-item--sugg" data-q="${esc(s)}">
            <span class="pal-thumb pal-thumb--ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg></span>
            <span class="pal-main"><b>${esc(s)}</b></span>
          </button>`).join("")}
        </div>
        <div class="pal-group"><span class="pal-label">Pages</span>
          ${PAGES.slice(0, 5).map((pg) => pageItem(pg, [])).join("")}
        </div>`;
      wireItems();
      return;
    }

    prodHits = buildIndex()
      .map((e) => ({ e, s: score(e.n, qWords) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.e.p.from - b.e.p.from)
      .slice(0, 7);

    pageHits = PAGES
      .map((pg) => ({ pg, s: score(norm(pg.t), qWords) }))
      .filter((x) => x.s > 0)
      .slice(0, 3);

    if (!prodHits.length && !pageHits.length) {
      palBody.innerHTML = `<div class="pal-empty">
        <b>Aucun résultat pour « ${esc(q)} »</b>
        <p>Essayez « matelas », « commode », « sectionnel »… ou appelez-nous au 438-375-4949 — un humain trouve plus vite qu'un moteur.</p>
      </div>`;
      curItems = [];
      return;
    }

    palBody.innerHTML =
      (prodHits.length ? `<div class="pal-group"><span class="pal-label">Produits</span>${prodHits.map((x) => prodItem(x.e, qWords)).join("")}</div>` : "") +
      (pageHits.length ? `<div class="pal-group"><span class="pal-label">Pages</span>${pageHits.map((x) => pageItem(x.pg, qWords)).join("")}</div>` : "");
    wireItems();
  }

  function prodItem(e, qWords) {
    const p = e.p;
    const multi = p.variants && p.variants.length > 1;
    return `<a class="pal-item" href="produit.html?p=${encodeURIComponent(p.h)}" data-name="${esc(p.name)}">
      <span class="pal-thumb"><img src="${imgW(p.imgs[0], 100)}" alt="" loading="lazy"></span>
      <span class="pal-main">
        <b>${markMatch(p.name, qWords)}</b>
        <span>${esc((p.sub || "").split("—")[0].trim() || p.cat)}</span>
      </span>
      <span class="pal-side">
        <span class="pal-price">${multi ? "dès " : ""}${(LDA.fmt || String)(p.from)}</span>
        <button class="pal-add" data-h="${esc(p.h)}" aria-label="Ajouter au panier" title="Ajouter au panier">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </span>
    </a>`;
  }
  function pageItem(pg, qWords) {
    return `<a class="pal-item" href="${pg.href}">
      <span class="pal-thumb pal-thumb--ghost"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z"/><path d="M14 3v5h5"/></svg></span>
      <span class="pal-main"><b>${markMatch(pg.t, qWords)}</b></span>
      <span class="pal-side"><span class="pal-go">Ouvrir →</span></span>
    </a>`;
  }

  function wireItems() {
    curItems = $$(".pal-item", palBody);
    activeIdx = 0;
    setActive(0);
    curItems.forEach((it, i) => {
      it.addEventListener("mouseenter", () => setActive(i));
      if (it.dataset.q !== undefined) {
        it.addEventListener("click", () => { palInput.value = it.dataset.q; renderPal(it.dataset.q); palInput.focus(); });
      } else if (it.dataset.name) {
        it.addEventListener("click", () => pushRecent(palInput.value.trim() || it.dataset.name));
      }
    });
    $$(".pal-add", palBody).forEach((b) =>
      b.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        LDA.addToCart && LDA.addToCart(b.dataset.h, 0, 1);
      })
    );
  }

  function setActive(i) {
    if (!curItems.length) return;
    activeIdx = (i + curItems.length) % curItems.length;
    curItems.forEach((el, j) => el.classList.toggle("active", j === activeIdx));
    curItems[activeIdx].scrollIntoView({ block: "nearest" });
  }

  palInput.addEventListener("input", () => renderPal(palInput.value));
  palInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(activeIdx + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIdx - 1); }
    else if (e.key === "Enter" && curItems[activeIdx]) { e.preventDefault(); curItems[activeIdx].click(); }
  });
  $("#palOverlay").addEventListener("click", closePal);
  $("#palClose").addEventListener("click", closePal);
  const searchBtn = $("#searchOpen");
  searchBtn && searchBtn.addEventListener("click", openPal);
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palOpen ? closePal() : openPal(); }
    else if (e.key === "/" && !palOpen && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPal(); }
    else if (e.key === "Escape" && palOpen) closePal();
  });

  /* ============================================================
     2. SOUMISSION PDF — panier → devis imprimable avec TPS/TVQ
     ============================================================ */
  const TPS = 0.05, TVQ = 0.09975;
  const fmtC = (n) => n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";

  document.body.insertAdjacentHTML("beforeend", `<div id="devisSheet" aria-hidden="true"></div>`);

  function buildDevis() {
    const cart = (LDA.loadCart && LDA.loadCart()) || [];
    if (!cart.length) { LDA.toast && LDA.toast("Votre panier est vide — ajoutez d'abord un produit."); return false; }
    const now = new Date();
    const num = "LDA-" + now.toISOString().slice(2, 10).replace(/-/g, "") + "-" +
      String(Math.floor(Math.random() * 900) + 100);
    const dateStr = now.toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
    const sub = cart.reduce((s, i) => s + i.p * i.q, 0);
    // La soumission doit refléter ce que le client paiera vraiment : la
    // livraison est taxable elle aussi.
    let zone = "montreal";
    try { zone = localStorage.getItem("lda_zone_v1") || "montreal"; } catch (e) {}
    const liv = zone === "ramassage" ? 0 : ((window.LDA_ZONES && window.LDA_ZONES.fee) || 50);
    const base = sub + liv;
    const tps = base * TPS, tvq = base * TVQ, total = base + tps + tvq;

    $("#devisSheet").innerHTML = `
      <div class="devis">
        <div class="devis-head">
          <div class="devis-brand">
            <b>Literie d'Amitié</b>
            <span>Matelassier · Montréal · depuis 2020</span>
          </div>
          <div class="devis-meta">
            <b>Soumission ${num}</b>
            <span>${dateStr} · valide 14 jours</span>
          </div>
        </div>
        <table class="devis-table">
          <thead><tr><th>Produit</th><th>Format</th><th>Qté</th><th>Prix</th></tr></thead>
          <tbody>
            ${cart.map((i) => `<tr>
              <td>${esc(i.name)}</td>
              <td>${esc(i.v)}</td>
              <td>${i.q}</td>
              <td>${fmtC(i.p * i.q)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div class="devis-totals">
          <div><span>Sous-total</span><span>${fmtC(sub)}</span></div>
          <div><span>${liv ? "Livraison — Montréal et environs" : "Ramassage au showroom"}</span><span>${liv ? fmtC(liv) : "Gratuit"}</span></div>
          <div><span>TPS (5 %)</span><span>${fmtC(tps)}</span></div>
          <div><span>TVQ (9,975 %)</span><span>${fmtC(tvq)}</span></div>
          <div class="devis-total"><span>Total</span><span>${fmtC(total)}</span></div>
          <p class="devis-ship">${liv
            ? "Livraison 50 $ dans le Grand Montréal, jusqu'à Saint-Jérôme et Joliette — créneau planifié avec vous par téléphone. Plus loin ? Appelez-nous, on vous prépare un prix."
            : "Ramassage gratuit au showroom, 3512 boul. Industriel — on vous appelle dès que la commande est prête."}</p>
        </div>
        <div class="devis-foot">
          <span>3512, boul. Industriel, Montréal QC · 438-375-4949 · literiedamitieinc@outlook.com</span>
          <span>Showroom ouvert 7 jours · Lun–Ven 9 h–18 h · Sam 10 h–17 h · Dim 11 h–16 h</span>
          <span class="devis-note">Soumission générée sur literiedamitie.com — les prix incluent la garantie 1 an. Taxes en sus, sauf indication contraire.</span>
        </div>
      </div>`;
    return true;
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("#devisBtn");
    if (!b) return;
    if (!buildDevis()) return;
    document.body.classList.add("printing-devis");
    setTimeout(() => window.print(), 60);
  });
  addEventListener("afterprint", () => document.body.classList.remove("printing-devis"));

  /* ============================================================
     3. QUIZ MATELAS — 4 questions, recommandation locale
     ============================================================ */
  const QUIZ_DATA = {
    "royal-supreme-10-matelas-euro-top-a-ressorts-800-pocket-coil": { feel: "moelleux", couple: true, cool: false, why: "Euro-top moelleux · 800 ressorts ensachés" },
    "matelas-encore-12-pillow-top-a-ressorts-ensaches-mousse-haute-resilience": { feel: "moelleux", couple: true, cool: false, why: "Pillow-top 12 po · le plus enveloppant" },
    "comfort-plus-matelas-pillow-top-a-ressorts-800-coil": { feel: "moelleux", couple: false, cool: false, why: "Pillow-top accessible · 800 ressorts" },
    "matelas-prelude-11-ressorts-ensaches-mousse-gel-confort-optimal": { feel: "equilibre", couple: true, cool: true, why: "Ressorts ensachés + mousse gel fraîche" },
    "classic-sleep-matelas-8-5-a-ressorts-bonnell-tissu-bambou": { feel: "equilibre", couple: false, cool: true, why: "Tissu bambou respirant · valeur sûre" },
    "rest-easy-8-5-matelas-euro-top-a-ressorts-416-coil": { feel: "equilibre", couple: false, cool: false, why: "Euro-top équilibré · petit prix" },
    "matelas-accord-10-mousse-gel-integrale-soutien-haute-densite": { feel: "ferme", couple: false, cool: true, why: "Mousse gel haute densité · soutien ferme" },
    "matelas-en-mousse-haute-densite-6-4-double-face": { feel: "ferme", couple: false, cool: false, appoint: true, why: "Double face · idéal appoint & enfants" },
    "matelas-foam-bamboo-6-mousse-haute-densite-housse-en-bambou": { feel: "ferme", couple: false, cool: true, appoint: true, why: "Compact, housse bambou lavable" },
  };
  const QUIZ_STEPS = [
    { q: "Vous dormez surtout…", key: "pos", opts: [
      { v: "cote", t: "Sur le côté", d: "Épaules et hanches ont besoin de moelleux" },
      { v: "dos", t: "Sur le dos", d: "Un soutien équilibré garde la colonne droite" },
      { v: "ventre", t: "Sur le ventre", d: "Il faut du ferme pour ne pas creuser" },
      { v: "mixte", t: "Un peu de tout", d: "On vise le juste milieu" }] },
    { q: "Côté sensation, vous préférez…", key: "feel", opts: [
      { v: "moelleux", t: "Moelleux enveloppant", d: "On s'enfonce doucement, effet cocon" },
      { v: "equilibre", t: "Équilibré", d: "Ni trop mou, ni trop dur — le choix le plus populaire" },
      { v: "ferme", t: "Ferme et soutenu", d: "On dort « sur » le matelas, pas dedans" }] },
    { q: "Votre budget (format Queen) ?", key: "budget", opts: [
      { v: "1", t: "Moins de 500 $", d: "L'essentiel, bien fait" },
      { v: "2", t: "500 $ à 900 $", d: "Le meilleur rapport confort-prix" },
      { v: "3", t: "900 $ et plus", d: "Le confort maximal, sans compromis" }] },
    { q: "Une dernière chose…", key: "extra", opts: [
      { v: "couple", t: "Je dors à deux", d: "Les ressorts ensachés isolent les mouvements" },
      { v: "chaud", t: "J'ai chaud la nuit", d: "Gel ou bambou pour dormir au frais" },
      { v: "appoint", t: "C'est pour l'appoint", d: "Chambre d'amis, enfant, roulotte…" },
      { v: "aucun", t: "Rien de spécial", d: "Juste un bon matelas" }] },
  ];
  const BUDGET_OF = (p) => (p.from < 450 ? 1 : p.from < 900 ? 2 : 3);

  document.body.insertAdjacentHTML("beforeend", `
  <div class="quiz-overlay" id="quizOverlay"></div>
  <div class="quiz" id="quiz" role="dialog" aria-modal="true" aria-label="Trouver mon matelas" data-lenis-prevent>
    <button class="pal-esc quiz-close" id="quizClose">esc</button>
    <div id="quizBody"></div>
  </div>`);

  const quizState = {};
  let quizStep = 0;

  function openQuiz() { quizStep = 0; for (const k in quizState) delete quizState[k]; document.body.classList.add("quiz-on"); renderQuiz(); }
  function closeQuiz() { document.body.classList.remove("quiz-on"); }

  function renderQuiz() {
    const body = $("#quizBody");
    if (quizStep < QUIZ_STEPS.length) {
      const st = QUIZ_STEPS[quizStep];
      body.innerHTML = `
        <span class="eyebrow">Question ${quizStep + 1} / ${QUIZ_STEPS.length}</span>
        <h3 class="quiz-q">${st.q}</h3>
        <div class="q-opts">
          ${st.opts.map((o) => `<button class="q-opt" data-v="${o.v}"><b>${o.t}</b><span>${o.d}</span></button>`).join("")}
        </div>
        <div class="q-nav">
          ${quizStep > 0 ? '<button class="q-back" id="qBack">← Retour</button>' : "<span></span>"}
          <span class="q-dots">${QUIZ_STEPS.map((_, i) => `<i class="${i <= quizStep ? "on" : ""}"></i>`).join("")}</span>
        </div>`;
      $$(".q-opt", body).forEach((b) =>
        b.addEventListener("click", () => { quizState[st.key] = b.dataset.v; quizStep++; renderQuiz(); })
      );
      const back = $("#qBack");
      back && back.addEventListener("click", () => { quizStep--; renderQuiz(); });
    } else {
      // pointage
      const wantFeel = quizState.feel ||
        (quizState.pos === "cote" ? "moelleux" : quizState.pos === "ventre" ? "ferme" : "equilibre");
      const scored = Object.entries(QUIZ_DATA).map(([h, a]) => {
        const p = LDA.byHandle && LDA.byHandle(h);
        if (!p) return null;
        let s = 0, why = [a.why];
        if (a.feel === wantFeel) s += 3;
        if (quizState.pos === "cote" && a.feel === "moelleux") s += 1;
        if (quizState.pos === "ventre" && a.feel === "ferme") s += 1;
        if (+quizState.budget === BUDGET_OF(p)) { s += 2; why.push("dans votre budget"); }
        else if (Math.abs(+quizState.budget - BUDGET_OF(p)) === 1) s += 1;
        if (quizState.extra === "couple" && a.couple) { s += 2; why.push("isole les mouvements"); }
        if (quizState.extra === "chaud" && a.cool) { s += 2; why.push("dort au frais"); }
        if (quizState.extra === "appoint") s += a.appoint ? 4 : -2;
        return { p, s, why };
      }).filter(Boolean).sort((a, b) => b.s - a.s || a.p.from - b.p.from).slice(0, 2);

      body.innerHTML = `
        <span class="eyebrow">Notre recommandation</span>
        <h3 class="quiz-q">${scored.length > 1 ? "Deux matelas faits pour vous." : "Le matelas fait pour vous."}</h3>
        <div class="q-results">
          ${scored.map((r, i) => `
          <div class="q-result ${i === 0 ? "top" : ""}">
            ${i === 0 ? '<span class="q-badge">Meilleur choix</span>' : ""}
            <a class="q-img" href="produit.html?p=${encodeURIComponent(r.p.h)}"><img src="${imgW(r.p.imgs[0], 400)}" alt="${esc(r.p.name)}"></a>
            <div class="q-info">
              <b>${esc(r.p.name)}</b>
              <span class="q-why">${r.why.slice(0, 3).map((w) => `<i>${esc(w)}</i>`).join("")}</span>
              <span class="q-price">dès ${(LDA.fmt || String)(r.p.from)}</span>
              <span class="q-acts">
                <a class="btn q-see" href="produit.html?p=${encodeURIComponent(r.p.h)}">Voir le matelas</a>
                <button class="q-add" data-h="${esc(r.p.h)}">Ajouter au panier</button>
              </span>
            </div>
          </div>`).join("")}
        </div>
        <button class="q-restart" id="qRestart">↺ Recommencer le quiz</button>`;
      $$(".q-add", body).forEach((b) =>
        b.addEventListener("click", () => { LDA.addToCart && LDA.addToCart(b.dataset.h, 0, 1); closeQuiz(); LDA.openCart && LDA.openCart(); })
      );
      $("#qRestart").addEventListener("click", openQuiz);
    }
  }

  $("#quizOverlay").addEventListener("click", closeQuiz);
  $("#quizClose").addEventListener("click", closeQuiz);
  document.addEventListener("click", (e) => { if (e.target.closest("#quizOpen")) openQuiz(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeQuiz(); });

  /* ============================================================
     4. PLANIFICATEUR DE CHAMBRE — « Ça va rentrer ? »
     ============================================================ */
  const plannerRoot = $("#plannerRoot");
  if (plannerRoot) {
    const SIZES = [
      { k: "simple", n: "Simple", w: 39, l: 75 },
      { k: "double", n: "Double", w: 54, l: 75 },
      { k: "queen", n: "Queen", w: 60, l: 80 },
      { k: "king", n: "King", w: 76, l: 80 },
    ];
    const PRESETS = {
      "3h": { w: 9, l: 10, label: "3½ typique" },
      "4h": { w: 10, l: 11, label: "4½ typique" },
      main: { w: 12, l: 13, label: "Chambre principale" },
    };
    const state = { w: 10, l: 11, size: "queen", door: 30, tight: false };

    // verdict pour une taille donnée (pouces restants)
    function judge(sz) {
      const W = state.w * 12, L = state.l * 12;
      const side = (W - sz.w) / 2;              // de chaque côté (lit centré)
      const foot = L - sz.l - 2;                // 2 po pour la tête de lit
      const small = sz.k === "simple" || sz.k === "double";
      const sideEff = small ? W - sz.w : side;  // petit lit : peut aller contre un mur
      let level = "ok";
      if (small) {
        if (sideEff < 18 || foot < 24) level = "bad";
        else if (sideEff < 26 || foot < 32) level = "warn";
      } else {
        if (side < 15 || foot < 24) level = "bad";
        else if (side < 24 || foot < 30) level = "warn";
      }
      return { side: Math.round(side), sideEff: Math.round(sideEff), foot: Math.round(foot), level, small };
    }

    function draw() {
      const sz = SIZES.find((s) => s.k === state.size);
      const W = state.w * 12, L = state.l * 12;
      const maxPx = 400, scale = Math.min(maxPx / W, maxPx / L, 3.4);
      const rw = W * scale, rl = L * scale;
      const bw = sz.w * scale, bl = sz.l * scale;
      const bx = (rw - bw) / 2, by = 2 * scale;
      const j = judge(sz);
      const colr = j.level === "ok" ? "#2e7d4f" : j.level === "warn" ? "#b07b1e" : "#9e2b3a";
      const doorPx = state.door * scale;
      const pad = 34;

      $("#planSvg").innerHTML = `
      <svg viewBox="0 0 ${rw + pad * 2} ${rl + pad * 2}" role="img" aria-label="Plan de la chambre avec le lit ${sz.n}">
        <!-- pièce -->
        <rect x="${pad}" y="${pad}" width="${rw}" height="${rl}" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5" rx="3"/>
        <!-- porte (bas gauche) -->
        <path d="M ${pad + 8} ${pad + rl} a ${doorPx} ${doorPx} 0 0 1 ${doorPx} ${-doorPx}" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 4"/>
        <line x1="${pad + 8}" y1="${pad + rl}" x2="${pad + 8 + doorPx}" y2="${pad + rl}" stroke="var(--paper)" stroke-width="4"/>
        <line x1="${pad + 8}" y1="${pad + rl}" x2="${pad + 8}" y2="${pad + rl - doorPx}" stroke="var(--muted)" stroke-width="2"/>
        <!-- lit -->
        <g>
          <rect x="${pad + bx}" y="${pad + by}" width="${bw}" height="${bl}" rx="6" fill="rgba(176,141,87,.18)" stroke="${colr}" stroke-width="2"/>
          <rect x="${pad + bx}" y="${pad + by}" width="${bw}" height="${14 * scale / 2.2}" rx="5" fill="rgba(176,141,87,.35)"/>
          <text x="${pad + bx + bw / 2}" y="${pad + by + bl / 2 + 4}" text-anchor="middle" font-family="Switzer,sans-serif" font-weight="600" font-size="14" fill="var(--ink)">${sz.n}</text>
          <text x="${pad + bx + bw / 2}" y="${pad + by + bl / 2 + 22}" text-anchor="middle" font-family="Switzer,sans-serif" font-size="11" fill="var(--muted)">${sz.w}″ × ${sz.l}″</text>
        </g>
        <!-- cotes -->
        <text x="${pad + rw / 2}" y="${pad - 12}" text-anchor="middle" font-size="12" font-family="Switzer,sans-serif" fill="var(--muted)">${state.w} pi (${W}″)</text>
        <text x="${pad - 12}" y="${pad + rl / 2}" text-anchor="middle" font-size="12" font-family="Switzer,sans-serif" fill="var(--muted)" transform="rotate(-90 ${pad - 12} ${pad + rl / 2})">${state.l} pi (${L}″)</text>
        ${j.side > 0 ? `
        <line x1="${pad + 2}" y1="${pad + by + bl / 2}" x2="${pad + bx - 2}" y2="${pad + by + bl / 2}" stroke="${colr}" stroke-width="1.4" stroke-dasharray="5 4"/>
        <text x="${pad + bx / 2}" y="${pad + by + bl / 2 - 7}" text-anchor="middle" font-size="11.5" font-weight="600" font-family="Switzer,sans-serif" fill="${colr}">${j.side}″</text>
        <line x1="${pad + bx + bw + 2}" y1="${pad + by + bl / 2}" x2="${pad + rw - 2}" y2="${pad + by + bl / 2}" stroke="${colr}" stroke-width="1.4" stroke-dasharray="5 4"/>
        <text x="${pad + bx + bw + bx / 2}" y="${pad + by + bl / 2 - 7}" text-anchor="middle" font-size="11.5" font-weight="600" font-family="Switzer,sans-serif" fill="${colr}">${j.side}″</text>` : ""}
        ${j.foot > 0 ? `
        <line x1="${pad + bx + bw / 2}" y1="${pad + by + bl + 2}" x2="${pad + bx + bw / 2}" y2="${pad + rl - 2}" stroke="${colr}" stroke-width="1.4" stroke-dasharray="5 4"/>
        <text x="${pad + bx + bw / 2 + 8}" y="${pad + by + bl + (rl - by - bl) / 2 + 4}" font-size="11.5" font-weight="600" font-family="Switzer,sans-serif" fill="${colr}">${j.foot}″</text>` : ""}
      </svg>`;

      // verdicts des 4 tailles
      $("#planVerdicts").innerHTML = SIZES.map((s) => {
        const v = judge(s);
        const ico = v.level === "ok" ? "✓" : v.level === "warn" ? "≈" : "✗";
        const msg = v.level === "bad"
          ? (v.foot < 24 ? "trop long pour la pièce" : "pas assez de dégagement")
          : v.small
            ? `${v.sideEff}″ de circulation, ${v.foot}″ au pied`
            : `${v.side}″ de chaque côté, ${v.foot}″ au pied`;
        const lbl = v.level === "ok" ? "À l'aise" : v.level === "warn" ? "Serré mais correct" : "On oublie";
        return `<button class="verdict v-${v.level} ${s.k === state.size ? "on" : ""}" data-size="${s.k}">
          <i>${ico}</i>
          <span><b>${s.n} <em>${s.w}″ × ${s.l}″</em></b><span>${lbl} — ${msg}</span></span>
          <span class="v-go">Voir →</span>
        </button>`;
      }).join("");
      $$(".verdict", $("#planVerdicts")).forEach((b) =>
        b.addEventListener("click", () => { state.size = b.dataset.size; draw(); })
      );

      // meilleur choix + CTA
      const best = SIZES.slice().reverse().find((s) => judge(s).level === "ok") ||
        SIZES.slice().reverse().find((s) => judge(s).level === "warn");
      $("#planCta").innerHTML = best
        ? `<a class="btn" href="matelas.html?size=${best.k}">Voir les matelas ${best.n}
            <span class="btn-orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span></a>
           <span class="plan-best">Recommandé pour votre ${state.w} × ${state.l} pi : <b>${best.n}</b></span>`
        : `<span class="plan-best">Pièce très compacte — appelez-nous au 438-375-4949, on a des solutions (mousses compactes, futons).</span>`;

      // conseil sommier divisé (escalier / porte étroite)
      const tightAccess = state.tight || state.door < 30;
      const bigBed = state.size === "queen" || state.size === "king";
      const som = LDA.byHandle && LDA.byHandle("ifdc-sommier-boite-a-ressorts");
      $("#planTip").innerHTML = bigBed && som ? `
        <div class="plan-tip ${tightAccess ? "urgent" : ""}">
          <img src="${imgW(som.imgs[0], 200)}" alt="Sommier divisé en deux morceaux">
          <div>
            <b>${tightAccess ? "Escalier serré détecté — pensez au sommier divisé." : "Le saviez-vous ? Le sommier divisé sauve les escaliers."}</b>
            <p>Un matelas ${state.size === "king" ? "King" : "Queen"} plie légèrement dans un tournant — un sommier une-pièce, jamais. Notre <a href="produit.html?p=ifdc-sommier-boite-a-ressorts">sommier divisé en 2 morceaux</a> (dès ${(LDA.fmt || String)(state.size === "king" ? 359.98 : 339.98)}) passe partout où passe une boîte de déménagement.</p>
          </div>
        </div>` : "";
    }

    // câblage du formulaire
    $("#planW").addEventListener("input", (e) => { state.w = Math.min(30, Math.max(6, +e.target.value || 10)); draw(); });
    $("#planL").addEventListener("input", (e) => { state.l = Math.min(30, Math.max(6, +e.target.value || 11)); draw(); });
    $("#planDoor").addEventListener("change", (e) => { state.door = +e.target.value; draw(); });
    $("#planTight").addEventListener("change", (e) => { state.tight = e.target.checked; draw(); });
    $$("#planPresets button").forEach((b) =>
      b.addEventListener("click", () => {
        const p = PRESETS[b.dataset.p];
        if (!p) return;
        state.w = p.w; state.l = p.l;
        $("#planW").value = p.w; $("#planL").value = p.l;
        $$("#planPresets button").forEach((x) => x.classList.toggle("on", x === b));
        draw();
      })
    );
    draw();
  }

  /* ============================================================
     5. PRÉ-RENDU AU SURVOL (Speculation Rules — pages instantanées)
     ============================================================ */
  try {
    if (HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules")) {
      const sp = document.createElement("script");
      sp.type = "speculationrules";
      sp.textContent = JSON.stringify({
        prerender: [{ where: { and: [{ href_matches: "/*" }, { not: { href_matches: "/*.pdf" } }] }, eagerness: "moderate" }],
      });
      document.body.append(sp);
    }
  } catch (e) { /* navigateur sans speculation rules — aucun impact */ }
})();
