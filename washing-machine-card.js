/*
 * washing-machine-card — carte Lovelace animée pour lave-linge à hublot
 * Auteur : JVmaisGpeur — Licence MIT
 *
 * type: custom:washing-machine-card
 * power_entity:    capteur de puissance (W)                      [obligatoire]
 * running_entity:  input_boolean "cycle en cours"                [optionnel, sinon puissance > pause_threshold]
 * start_entity:    input_datetime "début du cycle"               [optionnel, sinon last_changed de running_entity]
 * name:            titre de la carte
 * heat_threshold:  W au-dessus desquels on considère la chauffe   (défaut 1000)
 * spin_threshold:  W au-dessus desquels on considère l'essorage   (défaut 260)
 * pause_threshold: W en dessous desquels le tambour est en pause  (défaut 15)
 */

const WMC_PHASES = {
  idle:  { label: "À l'arrêt",   color: "var(--disabled-text-color, #9e9e9e)" },
  pause: { label: "Pause",       color: "#8e9aaf" },
  wash:  { label: "Lavage",      color: "#2196f3" },
  heat:  { label: "Chauffe",     color: "#ff7043" },
  spin:  { label: "Essorage",    color: "#7e57c2" },
};

class WashingMachineCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.power_entity) {
      throw new Error("power_entity est obligatoire");
    }
    this._config = {
      name: "Machine à laver",
      heat_threshold: 1000,
      spin_threshold: 260,
      pause_threshold: 15,
      ...config,
    };
    this._built = false;
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
  }

  static getStubConfig() {
    return { power_entity: "", running_entity: "", start_entity: "", name: "Machine à laver" };
  }

  getCardSize() { return 3; }
  getGridOptions() { return { columns: 12, rows: 3, min_columns: 6, min_rows: 3 }; }

  connectedCallback() {
    this._startTicker();
  }

  disconnectedCallback() {
    this._stopTicker();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  /* ---------- état ---------- */

  _num(entityId) {
    const s = entityId && this._hass && this._hass.states[entityId];
    if (!s) return null;
    const v = parseFloat(s.state);
    return isNaN(v) ? null : v;
  }

  _isRunning(power) {
    const c = this._config;
    if (c.running_entity) {
      const s = this._hass.states[c.running_entity];
      if (s) return s.state === "on";
    }
    return power !== null && power > c.pause_threshold;
  }

  _startTs() {
    const c = this._config;
    if (c.start_entity) {
      const s = this._hass.states[c.start_entity];
      if (s && s.attributes && s.attributes.timestamp) return s.attributes.timestamp * 1000;
    }
    if (c.running_entity) {
      const s = this._hass.states[c.running_entity];
      if (s) return new Date(s.last_changed).getTime();
    }
    return null;
  }

  _phase(running, power) {
    const c = this._config;
    if (!running) return "idle";
    if (power === null || power < c.pause_threshold) return "pause";
    if (power >= c.heat_threshold) return "heat";
    if (power >= c.spin_threshold) return "spin";
    return "wash";
  }

  _fmtDuration(ms) {
    if (ms === null || ms < 0) return "--:--";
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }

  _fmtStart(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    const now = new Date();
    const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === now.toDateString()) return `aujourd'hui ${hm}`;
    return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })} ${hm}`;
  }

  /* ---------- rendu ---------- */

  _build() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const uid = "wmc" + Math.random().toString(36).slice(2, 8);
    this._uid = uid;

    // vêtements dans le tambour
    const clothes = [
      { x: 72, y: 150, w: 26, h: 15, r: 7, c: "#ef5350", a: -18 },
      { x: 98, y: 158, w: 30, h: 13, r: 6, c: "#ffca28", a: 10 },
      { x: 112, y: 142, w: 22, h: 16, r: 8, c: "#66bb6a", a: 35 },
      { x: 84, y: 128, w: 20, h: 12, r: 6, c: "#42a5f5", a: -40 },
      { x: 104, y: 120, w: 18, h: 11, r: 5, c: "#ab47bc", a: 20 },
      { x: 66, y: 134, w: 16, h: 10, r: 5, c: "#ffffff", a: 60 },
    ].map((k) => `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="${k.r}" fill="${k.c}"
        transform="rotate(${k.a} ${k.x + k.w / 2} ${k.y + k.h / 2})" opacity=".92"/>`).join("");

    // trous du tambour
    let holes = "";
    for (let ring = 0; ring < 2; ring++) {
      const R = ring === 0 ? 46 : 32;
      const n = ring === 0 ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.3;
        holes += `<circle cx="${(100 + R * Math.cos(a)).toFixed(1)}" cy="${(140 + R * Math.sin(a)).toFixed(1)}" r="1.6" fill="rgba(255,255,255,.18)"/>`;
      }
    }

    const bubbles = [
      [76, 6, 0], [90, 4, 0.7], [104, 5, 1.4], [118, 3.5, 0.3], [128, 4.5, 1.9], [84, 3, 2.4], [112, 6, 1.1],
    ].map(([x, r, d]) => `<circle class="bubble" cx="${x}" cy="180" r="${r}" style="animation-delay:${d}s"/>`).join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { padding:16px; cursor:pointer; overflow:hidden; position:relative; }
        .wrap { display:flex; align-items:center; gap:16px; }
        svg.machine { width:132px; min-width:110px; height:auto; flex:0 0 auto; overflow:visible; }
        .info { flex:1; min-width:0; display:flex; flex-direction:column; gap:10px; }
        .head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .name { font-size:1.15em; font-weight:600; color:var(--primary-text-color);
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .chip { display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:999px;
                font-size:.8em; font-weight:600; color:#fff; background:var(--phase-color); white-space:nowrap;
                transition:background .4s; }
        .chip .dot { width:7px; height:7px; border-radius:50%; background:#fff; }
        .running .chip .dot { animation: blink 1.2s infinite; }
        .stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .stat { background:var(--secondary-background-color, rgba(127,127,127,.08)); border-radius:12px; padding:8px 10px; }
        .stat .lbl { font-size:.72em; text-transform:uppercase; letter-spacing:.06em; color:var(--secondary-text-color); }
        .stat .val { font-size:1.45em; font-weight:700; color:var(--primary-text-color); font-variant-numeric:tabular-nums; line-height:1.25; }
        .stat .val small { font-size:.6em; font-weight:500; color:var(--secondary-text-color); margin-left:2px; }
        .bar { height:5px; border-radius:3px; background:var(--divider-color, rgba(127,127,127,.2)); overflow:hidden; margin-top:6px; }
        .bar > div { height:100%; width:0; background:var(--phase-color); border-radius:3px; transition:width .6s, background .4s; }
        .sub { font-size:.8em; color:var(--secondary-text-color); }

        /* --- machine --- */
        .body { fill:var(--wmc-body, #f4f6f8); stroke:rgba(0,0,0,.12); stroke-width:1.5; }
        .panel { fill:var(--wmc-panel, #e3e7eb); }
        .lcd { fill:#1d2b24; }
        .lcd-txt { fill:#5dff9a; font: 700 11px monospace; opacity:.25; transition:opacity .3s; }
        .running .lcd-txt { opacity:1; }
        .led { fill:#555; transition:fill .3s; }
        .running .led { fill:var(--phase-color); animation: blink 1.4s infinite; }
        .ring { fill:#cfd6dc; stroke:#9aa5ae; stroke-width:2; }
        .glass-bg { fill:#2b3640; transition:fill .6s; }
        .running .glass-bg { fill:#20435e; }
        .phase-heat .glass-bg { fill:#4a2f2a; }
        .drum { transform-box:view-box; transform-origin:100px 140px; }
        .water { transform-box:view-box; transition:transform 1.2s ease, opacity .6s; transform:translateY(60px); opacity:0; }
        .water path { animation: wave 2.2s linear infinite; animation-play-state:paused; }
        .bubble { fill:rgba(255,255,255,.55); opacity:0; }
        .glare { fill:rgba(255,255,255,.18); pointer-events:none; }
        .shaker { transform-box:view-box; transform-origin:100px 230px; }

        /* phases */
        .phase-wash .drum  { animation: tumble 3.2s ease-in-out infinite alternate; }
        .phase-heat .drum  { animation: tumble 5s ease-in-out infinite alternate; }
        .phase-pause .drum { animation: none; }
        .phase-spin .drum  { animation: spin .35s linear infinite; }
        .phase-spin .clothes { filter: url(#${uid}-blur); }
        .phase-spin .shaker { animation: shake .12s linear infinite; }

        .phase-wash .water, .phase-heat .water, .phase-pause .water { transform:translateY(0); opacity:1; }
        .phase-spin .water { transform:translateY(38px); opacity:.6; }
        .running .water path { animation-play-state:running; }
        .phase-heat .water path { fill:rgba(255,138,101,.45); }

        .phase-wash .bubble, .phase-heat .bubble { animation: rise 2.6s ease-in infinite; }
        .phase-heat .bubble { animation-duration:1.6s; }

        .steam { opacity:0; transition:opacity .6s; }
        .phase-heat .steam { opacity:1; }
        .steam path { fill:none; stroke:rgba(255,255,255,.55); stroke-width:2.4; stroke-linecap:round; animation: steam 2s ease-in-out infinite; }
        .steam path:nth-child(2) { animation-delay:.6s; }
        .steam path:nth-child(3) { animation-delay:1.2s; }

        @keyframes tumble { 0% { transform:rotate(-140deg); } 100% { transform:rotate(220deg); } }
        @keyframes spin   { to { transform:rotate(360deg); } }
        @keyframes shake  { 0%,100% { transform:translate(0,0) rotate(0); } 25% { transform:translate(-.8px,.3px) rotate(-.4deg); }
                            50% { transform:translate(.6px,-.4px) rotate(.3deg); } 75% { transform:translate(-.4px,.5px) rotate(-.2deg); } }
        @keyframes wave   { from { transform:translateX(0); } to { transform:translateX(-60px); } }
        @keyframes rise   { 0% { transform:translateY(0); opacity:0; } 15% { opacity:1; } 100% { transform:translateY(-70px); opacity:0; } }
        @keyframes steam  { 0% { transform:translateY(6px); opacity:0; } 40% { opacity:1; } 100% { transform:translateY(-10px); opacity:0; } }
        @keyframes blink  { 50% { opacity:.25; } }

        @media (prefers-reduced-motion: reduce) {
          .drum, .shaker, .water path, .bubble, .steam path, .led, .chip .dot { animation:none !important; }
        }
        @media (max-width: 380px) { svg.machine { width:104px; min-width:96px; } .stat .val { font-size:1.2em; } }
      </style>

      <ha-card>
        <div class="wrap phase-idle" id="root">
          <svg class="machine" viewBox="0 0 200 240" aria-hidden="true">
            <defs>
              <clipPath id="${uid}-glass"><circle cx="100" cy="140" r="54"/></clipPath>
              <filter id="${uid}-blur"><feGaussianBlur stdDeviation="1.6"/></filter>
            </defs>
            <g class="shaker">
              <rect class="body" x="14" y="8" width="172" height="222" rx="16"/>
              <rect class="panel" x="14" y="8" width="172" height="44" rx="16"/>
              <rect class="panel" x="14" y="36" width="172" height="16"/>
              <line x1="14" y1="52" x2="186" y2="52" stroke="rgba(0,0,0,.1)" stroke-width="1.5"/>
              <!-- tiroir lessive -->
              <rect x="26" y="18" width="42" height="22" rx="4" fill="#fff" stroke="rgba(0,0,0,.12)"/>
              <rect x="36" y="27" width="22" height="4" rx="2" fill="rgba(0,0,0,.15)"/>
              <!-- écran -->
              <rect class="lcd" x="80" y="19" width="50" height="20" rx="4"/>
              <text class="lcd-txt" id="lcd" x="105" y="33" text-anchor="middle">--:--</text>
              <!-- bouton + led -->
              <circle cx="158" cy="29" r="11" fill="#fff" stroke="rgba(0,0,0,.15)" stroke-width="1.5"/>
              <line x1="158" y1="20" x2="158" y2="27" stroke="#9aa5ae" stroke-width="2.4" stroke-linecap="round"/>
              <circle class="led" cx="140" cy="22" r="2.8"/>
              <!-- hublot -->
              <circle class="ring" cx="100" cy="140" r="68"/>
              <circle cx="100" cy="140" r="60" fill="#b7c1c9"/>
              <g clip-path="url(#${uid}-glass)">
                <circle class="glass-bg" cx="100" cy="140" r="54"/>
                <g class="drum">
                  <circle cx="100" cy="140" r="52" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"/>
                  ${holes}
                  <path d="M100 88 L104 100 L96 100 Z M152 140 L140 144 L140 136 Z M48 140 L60 136 L60 144 Z" fill="rgba(255,255,255,.22)"/>
                  <g class="clothes">${clothes}</g>
                </g>
                <g class="water">
                  <path d="M20 150 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V200 H20 Z" fill="rgba(100,181,246,.45)"/>
                </g>
                <g>${bubbles}</g>
                <g class="steam">
                  <path d="M84 118 q-4 -6 0 -12 t0 -12"/>
                  <path d="M100 114 q-4 -6 0 -12 t0 -12"/>
                  <path d="M116 118 q-4 -6 0 -12 t0 -12"/>
                </g>
                <path class="glare" d="M66 112 a44 44 0 0 1 42 -22 a50 50 0 0 0 -36 30 z"/>
              </g>
              <circle cx="100" cy="140" r="54" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
              <!-- poignée -->
              <rect x="164" y="128" width="8" height="24" rx="4" fill="#9aa5ae"/>
              <!-- pieds -->
              <rect x="28" y="228" width="18" height="6" rx="2" fill="#7d8790"/>
              <rect x="154" y="228" width="18" height="6" rx="2" fill="#7d8790"/>
            </g>
          </svg>

          <div class="info">
            <div class="head">
              <div class="name" id="name"></div>
              <div class="chip"><span class="dot"></span><span id="phase"></span></div>
            </div>
            <div class="stats">
              <div class="stat">
                <div class="lbl">Puissance</div>
                <div class="val"><span id="power">--</span><small>W</small></div>
                <div class="bar"><div id="pbar"></div></div>
              </div>
              <div class="stat">
                <div class="lbl" id="durlbl">Durée du cycle</div>
                <div class="val" id="dur">--:--</div>
              </div>
            </div>
            <div class="sub" id="sub"></div>
          </div>
        </div>
      </ha-card>`;

    const $ = (id) => this.shadowRoot.getElementById(id);
    this._els = {
      root: $("root"), name: $("name"), phase: $("phase"), power: $("power"), pbar: $("pbar"),
      dur: $("dur"), durlbl: $("durlbl"), sub: $("sub"), lcd: $("lcd"),
    };
    this.shadowRoot.querySelector("ha-card").addEventListener("click", () => this._moreInfo());
    this._built = true;
    this._startTicker();
  }

  _update() {
    if (!this._els || !this._hass) return;
    const c = this._config;
    const power = this._num(c.power_entity);
    const running = this._isRunning(power);
    const phase = this._phase(running, power);
    const e = this._els;

    e.root.className = `wrap phase-${phase}${running ? " running" : ""}`;
    e.root.style.setProperty("--phase-color", WMC_PHASES[phase].color);
    e.name.textContent = c.name;
    e.phase.textContent = WMC_PHASES[phase].label;
    e.power.textContent = power === null ? "--" : (power >= 100 ? Math.round(power) : power.toFixed(1)).toString();
    const pct = power === null ? 0 : Math.min(100, (power / Math.max(c.heat_threshold * 2.2, 1)) * 100);
    e.pbar.style.width = `${pct}%`;

    this._running = running;
    this._start = this._startTs();
    this._tick();
  }

  _tick() {
    if (!this._els) return;
    const e = this._els;
    if (this._running) {
      const d = this._start ? this._fmtDuration(Date.now() - this._start) : "--:--";
      e.durlbl.textContent = "Durée du cycle";
      e.dur.textContent = d;
      e.lcd.textContent = d.length > 5 ? d.slice(0, -3) : d;
      e.sub.textContent = this._start ? `Démarré ${this._fmtStart(this._start)}` : "Cycle en cours";
    } else {
      e.durlbl.textContent = "Cycle";
      e.dur.textContent = "—";
      e.lcd.textContent = "--:--";
      e.sub.textContent = this._start ? `Dernier démarrage : ${this._fmtStart(this._start)}` : "";
    }
  }

  _startTicker() {
    if (this._timer || !this._built) return;
    this._timer = setInterval(() => { if (this._running) this._tick(); }, 1000);
  }

  _stopTicker() {
    clearInterval(this._timer);
    this._timer = null;
  }

  _moreInfo() {
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId: this._config.power_entity };
    this.dispatchEvent(ev);
  }
}

if (!customElements.get("washing-machine-card")) {
  customElements.define("washing-machine-card", WashingMachineCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "washing-machine-card",
    name: "Machine à laver animée",
    description: "Lave-linge à hublot animé selon la phase du cycle, avec puissance et durée.",
    preview: true,
  });
}
