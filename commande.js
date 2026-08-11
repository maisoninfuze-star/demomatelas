/* ============================================================
   LITERIE D'AMITIÉ — étape « Vos coordonnées »
   S'intercale entre le panier et Stripe : on récupère de quoi
   appeler le client et livrer chez lui AVANT le paiement, pour
   qu'un panier abandonné laisse quand même une piste.
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => [...(c || document).querySelectorAll(s)];
  const LDA = window.LDA || {};
  const ZONES = window.LDA_ZONES;
  const DRAFT_KEY = "lda_coord_v1";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Validation ---------- */
  // On accepte tout ce qu'un Québécois tape vraiment : 514-555-1234,
  // (514) 555-1234, 5145551234, +1 514 555 1234…
  const digits = (s) => String(s || "").replace(/\D/g, "");
  function telOk(v) {
    let d = digits(v);
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    return d.length === 10 && /^[2-9]/.test(d);
  }
  const telFormat = (v) => {
    let d = digits(v);
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}` : v;
  };
  // Volontairement permissif : c'est Stripe qui confirmera le courriel.
  const mailOk = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || "").trim());

  const RULES = {
    prenom: { req: true, test: (v) => v.trim().length >= 2, msg: "Entrez votre prénom." },
    nom: { req: true, test: (v) => v.trim().length >= 2, msg: "Entrez votre nom." },
    tel: { req: true, test: telOk, msg: "Entrez un numéro à 10 chiffres, par exemple 514 555-1234." },
    courriel: { req: true, test: mailOk, msg: "Entrez un courriel valide, par exemple nom@exemple.com." },
    adresse: { req: "liv", test: (v) => v.trim().length >= 5, msg: "Entrez le numéro et la rue." },
    ville: { req: "liv", test: (v) => v.trim().length >= 2, msg: "Entrez votre ville." },
    cp: { req: "liv", test: (v) => !!ZONES.normalize(v), msg: "Code postal invalide, par exemple H1P 2B3." },
  };

  /* ---------- Gabarit ---------- */
  const OVERLAY = `<div class="coord-overlay" id="coordOverlay"></div>`;
  const SHELL = `
  <div class="coord" id="coord" role="dialog" aria-modal="true" aria-labelledby="coordTitle">
    <button class="pal-esc coord-close" id="coordClose" aria-label="Fermer">esc</button>
    <form id="coordForm" novalidate>
      <span class="eyebrow">Dernière étape</span>
      <h2 id="coordTitle" tabindex="-1">Vos coordonnées</h2>
      <p class="coord-lede" id="coordLede"></p>

      <div class="coord-err" id="coordErrBox" role="alert" tabindex="-1" hidden></div>

      <div class="form-row">
        <div class="form-field">
          <label for="cd-prenom">Prénom <span class="req">*</span></label>
          <input id="cd-prenom" name="prenom" type="text" autocomplete="given-name" maxlength="60" enterkeyhint="next" required>
          <p class="field-error" id="err-prenom"></p>
        </div>
        <div class="form-field">
          <label for="cd-nom">Nom <span class="req">*</span></label>
          <input id="cd-nom" name="nom" type="text" autocomplete="family-name" maxlength="60" enterkeyhint="next" required>
          <p class="field-error" id="err-nom"></p>
        </div>
      </div>

      <div class="form-row">
        <div class="form-field">
          <label for="cd-tel">Téléphone <span class="req">*</span></label>
          <input id="cd-tel" name="tel" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" enterkeyhint="next" required
                 aria-describedby="aide-tel err-tel" placeholder="514 555-1234">
          <p class="field-help" id="aide-tel">On vous appelle pour fixer l'heure de livraison — pas de fenêtre de 8 heures.</p>
          <p class="field-error" id="err-tel"></p>
        </div>
        <div class="form-field">
          <label for="cd-courriel">Courriel <span class="req">*</span></label>
          <input id="cd-courriel" name="courriel" type="email" inputmode="email" autocomplete="email" maxlength="254" enterkeyhint="next" required
                 aria-describedby="aide-courriel err-courriel">
          <p class="field-help" id="aide-courriel">Pour le reçu et la confirmation.</p>
          <p class="field-error" id="err-courriel"></p>
        </div>
      </div>

      <div id="coordLiv">
        <div class="coord-sep"><span>Adresse de livraison</span></div>

        <div class="form-row">
          <div class="form-field" style="grid-column:1 / span 1">
            <label for="cd-adresse">Adresse <span class="req">*</span></label>
            <input id="cd-adresse" name="adresse" type="text" autocomplete="shipping address-line1" maxlength="120" enterkeyhint="next"
                   placeholder="3512, boul. Industriel" aria-describedby="err-adresse">
            <p class="field-error" id="err-adresse"></p>
          </div>
          <div class="form-field">
            <label for="cd-app">Appartement <span class="opt">(facultatif)</span></label>
            <input id="cd-app" name="app" type="text" autocomplete="shipping address-line2" maxlength="24" enterkeyhint="next" placeholder="4B">
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="cd-ville">Ville <span class="req">*</span></label>
            <input id="cd-ville" name="ville" type="text" autocomplete="shipping address-level2" maxlength="80" enterkeyhint="next"
                   aria-describedby="err-ville">
            <p class="field-error" id="err-ville"></p>
          </div>
          <div class="form-field">
            <label for="cd-cp">Code postal <span class="req">*</span></label>
            <input id="cd-cp" name="cp" type="text" inputmode="text" autocapitalize="characters" autocomplete="shipping postal-code"
                   maxlength="7" enterkeyhint="next" placeholder="H1P 2B3" aria-describedby="err-cp">
            <p class="field-error" id="err-cp"></p>
          </div>
        </div>

        <div class="coord-zone" id="coordZone" hidden></div>

        <div class="form-row">
          <div class="form-field">
            <label for="cd-etage">Étage</label>
            <select id="cd-etage" name="etage">
              <option value="Rez-de-chaussée">Rez-de-chaussée</option>
              <option value="1er étage">1er étage</option>
              <option value="2e étage">2e étage</option>
              <option value="3e étage">3e étage</option>
              <option value="4e étage ou plus">4e étage ou plus</option>
            </select>
          </div>
          <div class="form-field" id="cd-ascWrap" hidden>
            <label for="cd-ascenseur">Y a-t-il un ascenseur&nbsp;?</label>
            <select id="cd-ascenseur" name="ascenseur">
              <option value="Non">Non — escalier</option>
              <option value="Oui">Oui</option>
            </select>
          </div>
        </div>

        <div class="form-field full">
          <label for="cd-notes">Accès au logement <span class="opt">(facultatif)</span></label>
          <textarea id="cd-notes" name="notes" rows="2" maxlength="400"
                    placeholder="Escalier en colimaçon, porte étroite, stationnement difficile…"
                    aria-describedby="aide-notes"></textarea>
          <p class="field-help" id="aide-notes">Ces détails nous évitent un deuxième déplacement. <b>N'inscrivez pas votre code d'entrée ici</b> — donnez-le au livreur lors de l'appel de planification.</p>
        </div>
      </div>

      <div id="coordPref">
        <div class="coord-sep"><span id="prefTitre">Votre préférence de livraison</span></div>
        <p class="field-help" id="prefAide"></p>
        <div class="form-row">
          <div class="form-field">
            <label for="cd-jour">Jour de la semaine</label>
            <select id="cd-jour" name="jour">
              <option value="">Peu importe</option>
              <option value="Lundi">Lundi</option>
              <option value="Mardi">Mardi</option>
              <option value="Mercredi">Mercredi</option>
              <option value="Jeudi">Jeudi</option>
              <option value="Vendredi">Vendredi</option>
              <option value="Samedi">Samedi</option>
              <option value="Dimanche">Dimanche</option>
              <option value="En semaine">N'importe quel jour de semaine</option>
              <option value="Fin de semaine">Fin de semaine</option>
            </select>
          </div>
          <div class="form-field">
            <label for="cd-plage">Plage horaire</label>
            <select id="cd-plage" name="plage">
              <option value="">Peu importe</option>
              <option value="Avant-midi (9 h – 12 h)">Avant-midi (9 h – 12 h)</option>
              <option value="Après-midi (12 h – 17 h)">Après-midi (12 h – 17 h)</option>
              <option value="Soirée (17 h – 20 h)">Soirée (17 h – 20 h)</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-field full">
        <label for="cd-moment">Meilleur moment pour vous appeler <span class="opt">(facultatif)</span></label>
        <select id="cd-moment" name="moment">
          <option value="">Peu importe</option>
          <option value="Matin (9 h – 12 h)">Matin (9 h – 12 h)</option>
          <option value="Après-midi (12 h – 17 h)">Après-midi (12 h – 17 h)</option>
          <option value="Soirée (17 h – 20 h)">Soirée (17 h – 20 h)</option>
        </select>
      </div>

      <!-- Consentement SMS : jamais coché d'avance, jamais requis pour payer.
           C'est la preuve d'adhésion exigée pour l'enregistrement A2P. -->
      <label class="coord-optin" for="cd-sms">
        <input type="checkbox" id="cd-sms" name="sms" value="oui">
        <span>
          <b>Recevoir les nouvelles et promotions par texto</b>
          <em>Facultatif — vous serez livré et appelé de toute façon. Fréquence variable&nbsp;; des frais de messagerie et de données peuvent s'appliquer. Répondez STOP pour vous désabonner, HELP pour de l'aide. Voir les <a href="conditions.html#sms" target="_blank" rel="noopener">conditions</a> et la <a href="confidentialite.html" target="_blank" rel="noopener">confidentialité</a>.</em>
        </span>
      </label>

      <div class="coord-hp" aria-hidden="true">
        <label for="cd-site">Ne remplissez pas ce champ</label>
        <input id="cd-site" name="site" type="text" tabindex="-1" autocomplete="off">
      </div>

      <div class="coord-recap" id="coordRecap"></div>

      <button class="btn coord-go" type="submit" id="coordGo">
        Passer au paiement sécurisé
        <span class="btn-orb"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
      </button>
      <p class="coord-note">
        Paiement par Stripe — vous serez redirigé vers sa page sécurisée. Nous ne voyons jamais votre numéro de carte.<br>
        Vos coordonnées servent uniquement à préparer et livrer votre commande.
        Questions&nbsp;: <a href="tel:+14383754949">438-375-4949</a>.
      </p>
    </form>
  </div>`;

  document.body.insertAdjacentHTML("beforeend", OVERLAY + SHELL);

  const form = $("#coordForm");
  const box = $("#coord");
  const errBox = $("#coordErrBox");
  const livBlock = $("#coordLiv");
  const zoneBox = $("#coordZone");
  const goBtn = $("#coordGo");
  let mode = "montreal";     // « montreal » = livraison, « ramassage » = cueillette
  let lastTrigger = null;
  let outOfZone = false;

  const isLiv = () => mode !== "ramassage";
  const field = (n) => form.elements[n];

  /* ---------- Brouillon (survit à un retour de Stripe) ---------- */
  const NAMES = ["prenom", "nom", "tel", "courriel", "adresse", "app", "ville", "cp", "etage", "ascenseur", "notes", "jour", "plage", "moment"];
  function saveDraft() {
    try {
      const d = {};
      NAMES.forEach((n) => { const el = field(n); if (el) d[n] = el.value; });
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch (e) {}
  }
  function loadDraft() {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
      NAMES.forEach((n) => { const el = field(n); if (el && d[n]) el.value = d[n]; });
    } catch (e) {}
  }
  form.addEventListener("input", saveDraft);

  /* ---------- Erreurs ---------- */
  function setErr(name, msg) {
    const el = field(name);
    const p = $("#err-" + name);
    if (!el || !p) return;
    p.textContent = msg || "";
    if (msg) el.setAttribute("aria-invalid", "true");
    else el.removeAttribute("aria-invalid");
    el.classList.toggle("is-bad", !!msg);
  }
  function checkField(name) {
    const r = RULES[name], el = field(name);
    if (!r || !el) return true;
    if (r.req === "liv" && !isLiv()) { setErr(name, ""); return true; }
    const v = el.value;
    if (!v.trim()) { setErr(name, r.msg); return false; }
    const ok = r.test(v);
    setErr(name, ok ? "" : r.msg);
    return ok;
  }

  // « Récompenser tôt, punir tard » : on valide au blur, puis en direct
  // seulement une fois que le champ a déjà fauté.
  Object.keys(RULES).forEach((name) => {
    const el = field(name);
    if (!el) return;
    el.addEventListener("blur", () => {
      if (name === "tel" && telOk(el.value)) el.value = telFormat(el.value);
      if (name === "cp") { const n = ZONES.normalize(el.value); if (n) el.value = n; }
      checkField(name);
      if (name === "cp") renderZone();
    });
    el.addEventListener("input", () => { if (el.classList.contains("is-bad")) checkField(name); });
  });

  /* ---------- Zone de livraison ---------- */
  function renderZone() {
    const cp = field("cp").value;
    const norm = ZONES.normalize(cp);
    if (!isLiv() || !norm) { zoneBox.hidden = true; outOfZone = false; renderRecap(); return; }
    outOfZone = !ZONES.covers(norm);
    zoneBox.hidden = false;
    zoneBox.className = "coord-zone " + (outOfZone ? "is-out" : "is-in");
    zoneBox.innerHTML = outOfZone
      ? `<b>Votre secteur dépasse notre zone à tarif fixe.</b>
         <p>On livre jusqu'à Saint-Jérôme et Joliette. Pour aller plus loin, on vous prépare un prix de livraison au téléphone — c'est souvent une bonne nouvelle.</p>
         <div class="zone-acts">
           <a class="btn btn--ghost" href="tel:+14383754949">Appeler le 438-375-4949</a>
           <button type="button" class="link-more" id="zoneToPickup">Ramasser au showroom plutôt <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
         </div>`
      : `<b>On livre chez vous&nbsp;: 50&nbsp;$.</b>
         <p>Votre secteur fait partie de notre tournée régulière — livraison planifiée avec vous par téléphone.</p>`;
    renderRecap();
  }

  zoneBox.addEventListener("click", (e) => {
    if (!e.target.closest("#zoneToPickup")) return;
    try { localStorage.setItem("lda_zone_v1", "ramassage"); } catch (err) {}
    mode = "ramassage";
    applyMode();
    // Le tiroir du panier garde son propre affichage : il faut le resynchroniser,
    // sinon il continue d'annoncer 50 $ de livraison une fois rouvert.
    LDA.renderCart && LDA.renderCart();
    LDA.toast && LDA.toast("Mode ramassage — livraison retirée du total.");
  });

  /* ---------- Récapitulatif ---------- */
  function renderRecap() {
    const cart = (LDA.loadCart && LDA.loadCart()) || [];
    const sub = cart.reduce((s, i) => s + i.p * i.q, 0);
    const fee = isLiv() ? ZONES.fee : 0;
    const f = LDA.fmt || ((n) => n + " $");
    const n = cart.reduce((s, i) => s + i.q, 0);
    $("#coordRecap").innerHTML = `
      <div class="rc-line"><span>${n} article${n > 1 ? "s" : ""}</span><b>${f(sub)}</b></div>
      <div class="rc-line"><span>${isLiv() ? "Livraison — Montréal et environs" : "Ramassage au showroom"}</span><b>${fee ? f(fee) : "Gratuit"}</b></div>
      <div class="rc-line rc-total"><span>Total avant taxes</span><b>${f(sub + fee)}</b></div>
      <p class="rc-tax">TPS et TVQ ajoutées à l'étape du paiement.${
        window.LDA_DELAI ? ` ${isLiv() ? "Livraison" : "Prêt à ramasser"} sous ${LDA_DELAI.delaiCart(cart)}.` : ""
      }</p>`;
  }

  /* ---------- Mode livraison / ramassage ---------- */
  function applyMode() {
    const liv = isLiv();
    livBlock.hidden = !liv;
    // Un champ caché ne doit jamais rester requis, sinon le formulaire
    // refuse de partir en pointant un champ invisible.
    ["adresse", "ville", "cp"].forEach((n) => {
      const el = field(n);
      if (el) { el.required = liv; if (!liv) setErr(n, ""); }
    });
    $("#coordLede").textContent = liv
      ? "On en a besoin pour préparer la livraison et vous appeler — deux minutes, puis le paiement."
      : "On en a besoin pour préparer votre commande et vous prévenir quand elle est prête à ramasser.";

    // La préférence porte sur la livraison ou sur le ramassage, selon le mode.
    const delai = (window.LDA_DELAI && LDA_DELAI.delaiCart((LDA.loadCart && LDA.loadCart()) || [])) || "";
    $("#prefTitre").textContent = liv ? "Votre préférence de livraison" : "Votre préférence de ramassage";
    $("#prefAide").textContent = liv
      ? `On fait l'impossible pour respecter votre choix — on confirme le créneau exact par téléphone. Délai prévu : ${delai}.`
      : `On vous appelle dès que la commande est prête. Délai prévu : ${delai}. Showroom ouvert 7 jours.`;
    if (!liv) { zoneBox.hidden = true; outOfZone = false; }
    else renderZone();
    renderRecap();
  }

  $("#cd-etage").addEventListener("change", (e) => {
    const asc = $("#cd-ascWrap");
    asc.hidden = e.target.value === "Rez-de-chaussée";
  });

  /* ---------- Ouverture / fermeture ---------- */
  function open() {
    const cart = (LDA.loadCart && LDA.loadCart()) || [];
    if (!cart.length) { LDA.toast && LDA.toast("Votre panier est vide."); return; }
    lastTrigger = document.activeElement;
    try { mode = localStorage.getItem("lda_zone_v1") || "montreal"; } catch (e) { mode = "montreal"; }
    document.body.classList.remove("cart-open");
    document.body.classList.add("coord-on");
    loadDraft();
    applyMode();
    $("#cd-ascWrap").hidden = $("#cd-etage").value === "Rez-de-chaussée";
    // On donne le focus au titre plutôt qu'au premier champ : sur mobile,
    // ouvrir le clavier masquerait tout le contexte.
    setTimeout(() => $("#coordTitle").focus(), 60);
  }
  function close() {
    document.body.classList.remove("coord-on");
    errBox.hidden = true;
    // On était venu du panier : on le rouvre, sinon le focus repart sur un
    // bouton hors écran, dans un tiroir fermé.
    if (lastTrigger && lastTrigger.closest && lastTrigger.closest("#cartDrawer")) {
      LDA.openCart ? LDA.openCart() : document.body.classList.add("cart-open");
    }
    if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
  }
  $("#coordClose").addEventListener("click", close);
  $("#coordOverlay").addEventListener("click", close);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("coord-on")) close();
    if (e.key !== "Tab" || !document.body.classList.contains("coord-on")) return;
    const f = $$('a[href], button:not([disabled]), input:not([tabindex="-1"]), select, textarea, [tabindex="-1"]#coordTitle', box)
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Envoi ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (field("site").value) return; // piège à pourriel

    // Le code postal a pu changer sans blur (Entrée depuis un autre champ) :
    // on refait le calcul de zone avant de décider quoi que ce soit.
    if (isLiv()) renderZone();

    const names = Object.keys(RULES).filter((n) => RULES[n].req !== "liv" || isLiv());
    const bad = names.filter((n) => !checkField(n));

    if (bad.length) {
      errBox.hidden = false;
      errBox.innerHTML = `<b>${bad.length === 1 ? "Un champ demande une correction" : `${bad.length} champs demandent une correction`}&nbsp;:</b>
        <ul>${bad.map((n) => `<li><a href="#cd-${n}">${esc($("#err-" + n).textContent)}</a></li>`).join("")}</ul>`;
      errBox.focus();
      return;
    }
    errBox.hidden = true;

    if (isLiv() && outOfZone) {
      zoneBox.scrollIntoView({ block: "center", behavior: "smooth" });
      LDA.toast && LDA.toast("Appelez-nous pour le prix de livraison de votre secteur.");
      return;
    }

    const cart = (LDA.loadCart && LDA.loadCart()) || [];
    if (!cart.length) { LDA.toast && LDA.toast("Votre panier est vide."); return; }

    const client = {
      prenom: field("prenom").value.trim(),
      nom: field("nom").value.trim(),
      tel: telFormat(field("tel").value),
      courriel: field("courriel").value.trim(),
    };
    if (isLiv()) Object.assign(client, {
      adresse: field("adresse").value.trim(),
      app: field("app").value.trim(),
      ville: field("ville").value.trim(),
      cp: ZONES.normalize(field("cp").value),
      etage: field("etage").value,
      ascenseur: $("#cd-ascWrap").hidden ? "" : field("ascenseur").value,
      notes: field("notes").value.trim(),
    });
    client.moment = field("moment").value;
    // Preuve d'adhesion SMS : valeur + horodatage, exiges a l'enregistrement A2P.
    client.sms = field("sms").checked ? "oui" : "non";
    if (field("sms").checked) client.smsAt = new Date().toISOString();
    client.jour = field("jour").value;
    client.plage = field("plage").value;

    const label = goBtn.innerHTML;
    goBtn.disabled = true;
    goBtn.setAttribute("aria-busy", "true");
    goBtn.textContent = "Redirection vers le paiement…";
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: mode,
          client,
          site: field("site").value, // piège à pourriel, revalidé côté serveur
          items: cart.map((i) => ({ h: i.h, v: i.v === "Format unique" ? "Default Title" : i.v, q: i.q })),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.url) throw new Error(data.error || `Erreur ${r.status}`);
      location.href = data.url;
    } catch (err) {
      goBtn.disabled = false;
      goBtn.removeAttribute("aria-busy");
      goBtn.innerHTML = label;
      LDA.toast && LDA.toast("Paiement indisponible : " + err.message);
    }
  });

  window.LDA_COMMANDE = { open, close };
})();
