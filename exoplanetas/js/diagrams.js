/* Diagramas 2D: zona habitable interactiva, metodos de deteccion,
   espectro ilustrativo y grafica de descubrimientos. Todo se dibuja a la
   densidad de pixeles real de la pantalla (canvas x devicePixelRatio o SVG). */
(function () {
  'use strict';
  const EXO = window.EXO;
  const TAU = Math.PI * 2;
  const fmt = function (n, d) {
    return n.toLocaleString('es-MX', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };
  EXO.fmt = fmt;

  function fitCanvas(c) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return { w: r.width, h: r.height, dpr: dpr };
  }
  function rgba(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }
  function kRGB(K) { return EXO.kelvinSRGB(K).map(function (v) { return Math.round(v * 255); }); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ======================================================================
     Zona habitable
     ====================================================================== */
  /* Teff, tipo, luminosidad, masa, radio (valores tipicos de secuencia principal) */
  const MS = [
    [2570, 'M8 V', 0.00055, 0.09, 0.12], [2700, 'M7 V', 0.0008, 0.095, 0.13],
    [2850, 'M6 V', 0.0012, 0.10, 0.15], [3060, 'M5 V', 0.003, 0.14, 0.2],
    [3210, 'M4 V', 0.0063, 0.2, 0.26], [3410, 'M3 V', 0.0145, 0.3, 0.4],
    [3550, 'M2 V', 0.025, 0.4, 0.45], [3690, 'M1 V', 0.052, 0.47, 0.5],
    [3850, 'M0 V', 0.08, 0.57, 0.6], [4050, 'K7 V', 0.12, 0.63, 0.64],
    [4450, 'K5 V', 0.17, 0.7, 0.7], [4830, 'K3 V', 0.3, 0.78, 0.77],
    [5270, 'K0 V', 0.5, 0.88, 0.85], [5490, 'G8 V', 0.66, 0.94, 0.9],
    [5660, 'G5 V', 0.85, 0.98, 0.94], [5772, 'G2 V', 1, 1, 1],
    [5920, 'G0 V', 1.3, 1.06, 1.1], [6150, 'F8 V', 1.7, 1.15, 1.2],
    [6510, 'F5 V', 3.2, 1.33, 1.45], [6810, 'F2 V', 5, 1.46, 1.55],
    [7220, 'F0 V', 7.2, 1.6, 1.7]
  ];
  function starProps(T) {
    T = clamp(T, MS[0][0], MS[MS.length - 1][0]);
    let i = 0;
    while (i < MS.length - 2 && MS[i + 1][0] < T) i++;
    const a = MS[i], b = MS[i + 1];
    const t = (T - a[0]) / (b[0] - a[0]);
    const lg = function (x, y) { return Math.exp(lerp(Math.log(x), Math.log(y), t)); };
    const near = t < 0.5 ? a : b;
    return { T: T, type: near[1], L: lg(a[2], b[2]), M: lg(a[3], b[3]), R: lg(a[4], b[4]) };
  }
  const CLASS_TXT = {
    M: ['enana roja', 'La zona habitable queda muy pegada a la estrella. Ahí los planetas suelen mostrarle siempre la misma cara y reciben llamaradas intensas, pero estas estrellas son las más comunes de la galaxia.'],
    K: ['enana naranja', 'Viven decenas de miles de millones de años y son más tranquilas que las rojas. Para muchos astrónomos son el mejor lugar para buscar vida.'],
    G: ['enana amarilla, tipo Sol', 'Así es nuestro vecindario: la Tierra orbita a 1 UA, dentro de la zona conservadora.'],
    F: ['enana blanco-amarilla', 'Son más brillantes y calientes. Viven unos pocos miles de millones de años y emiten más radiación ultravioleta.']
  };
  function cls(T) { return T < 3900 ? 'M' : T < 5300 ? 'K' : T < 6000 ? 'G' : 'F'; }
  function niceStep(x) {
    const e = Math.pow(10, Math.floor(Math.log10(x)));
    const m = x / e;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
  }
  function auFmt(a) { return a < 0.1 ? fmt(a, 3) : a < 1 ? fmt(a, 2) : fmt(a, 2); }

  function HZWidget(root) {
    this.c = root.querySelector('#hz-canvas');
    this.ctx = this.c.getContext('2d');
    this.input = root.querySelector('#hz-temp');
    this.out = root.querySelector('#hz-temp-out');
    this.ui = {
      type: root.querySelector('#hz-type'), lum: root.querySelector('#hz-lum'),
      range: root.querySelector('#hz-range'), year: root.querySelector('#hz-year'),
      note: root.querySelector('#hz-note'), scale: root.querySelector('#hz-scale')
    };
    this.target = +this.input.value;
    this.T = this.target;
    this.zoom = null;
    this.ang = 0;
    this.visible = false;
    const self = this;
    this.input.addEventListener('input', function () { self.set(+self.input.value, false); });
    root.querySelectorAll('.hz-presets button').forEach(function (b) {
      b.addEventListener('click', function () { self.set(+b.dataset.t, true); });
    });
    this.presets = root.querySelectorAll('.hz-presets button');
    this.set(this.target, true);
  }
  HZWidget.prototype.set = function (T, fromPreset) {
    this.target = T;
    if (fromPreset) this.input.value = T;
    this.out.textContent = fmt(T) + ' K';
    this.presets.forEach(function (b) { b.classList.toggle('on', Math.abs(+b.dataset.t - T) < 1); });
    const s = starProps(T);
    const hz = EXO.hz(T, s.L);
    const ac = (hz.rg + hz.mg) / 2;
    const yrs = Math.sqrt(ac * ac * ac / s.M);
    const k = cls(T);
    this.ui.type.textContent = s.type + ' · ' + CLASS_TXT[k][0];
    this.ui.lum.textContent = (s.L < 0.01 ? fmt(s.L, 4) : s.L < 1 ? fmt(s.L, 3) : fmt(s.L, 1)) + ' × Sol';
    this.ui.range.textContent = auFmt(hz.rg) + ' – ' + auFmt(hz.mg) + ' UA';
    this.ui.year.textContent = yrs < 1 ? fmt(yrs * 365.25, yrs * 365.25 < 20 ? 1 : 0) + ' días' : fmt(yrs, 1) + ' años';
    const near = EXO.planets.filter(function (p) { return Math.abs(p.teff - T) < 200; }).map(function (p) { return p.name; });
    this.ui.note.textContent = CLASS_TXT[k][1] + (near.length ? ' Mundos reales con estrellas así: ' + near.slice(0, 4).join(', ') + '.' : '');
  };
  HZWidget.prototype.draw = function (t, dt) {
    const T = this.T = lerp(this.T, this.target, 1 - Math.pow(0.0015, dt));
    const s = starProps(T);
    const hz = EXO.hz(T, s.L);
    const maxAU = hz.em * 1.28;
    this.zoom = this.zoom === null ? maxAU : Math.exp(lerp(Math.log(this.zoom), Math.log(maxAU), 1 - Math.pow(0.002, dt)));
    const f = fitCanvas(this.c);
    const ctx = this.ctx;
    ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    ctx.clearRect(0, 0, f.w, f.h);
    const cx = f.w / 2, cy = f.h / 2 - 12;
    const Rpx = Math.min(f.w, f.h) / 2 * 0.9;
    const k = Rpx / this.zoom;
    const scol = kRGB(T);

    /* zona fria */
    let g = ctx.createRadialGradient(cx, cy, hz.em * k, cx, cy, Rpx * 1.25);
    g.addColorStop(0, 'rgba(134,197,255,0.14)');
    g.addColorStop(1, 'rgba(134,197,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rpx * 1.25, 0, TAU); ctx.arc(cx, cy, hz.em * k, 0, TAU, true); ctx.fill();
    /* zona caliente */
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, hz.rv * k);
    g.addColorStop(0, 'rgba(255,122,89,0.55)');
    g.addColorStop(0.6, 'rgba(255,122,89,0.2)');
    g.addColorStop(1, 'rgba(255,122,89,0.08)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, hz.rv * k, 0, TAU); ctx.fill();
    /* zona habitable optimista y conservadora */
    ctx.fillStyle = 'rgba(110,245,210,0.10)';
    ctx.beginPath(); ctx.arc(cx, cy, hz.em * k, 0, TAU); ctx.arc(cx, cy, hz.rv * k, 0, TAU, true); ctx.fill();
    g = ctx.createRadialGradient(cx, cy, hz.rg * k, cx, cy, hz.mg * k);
    g.addColorStop(0, 'rgba(110,245,210,0.34)');
    g.addColorStop(0.5, 'rgba(110,245,210,0.22)');
    g.addColorStop(1, 'rgba(110,245,210,0.30)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, hz.mg * k, 0, TAU); ctx.arc(cx, cy, hz.rg * k, 0, TAU, true); ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(110,245,210,0.75)';
    ctx.beginPath(); ctx.arc(cx, cy, hz.rg * k, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, hz.mg * k, 0, TAU); ctx.stroke();

    /* rejilla de escala */
    const step = niceStep(this.zoom / 3);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(190,205,255,0.07)';
    for (let a = step; a < this.zoom * 1.3; a += step) { ctx.beginPath(); ctx.arc(cx, cy, a * k, 0, TAU); ctx.stroke(); }
    this.ui.scale.textContent = 'Cada anillo gris = ' + auFmt(step) + ' UA';

    /* orbita terrestre de referencia */
    if (k * 1 < Rpx * 1.35) {
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(cx, cy, k, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '500 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Órbita de la Tierra · 1 UA', cx, cy - k - 7);
    }

    /* planetas reales con estrellas parecidas */
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    const self = this;
    EXO.planets.forEach(function (p, i) {
      const w = clamp(1 - Math.abs(p.teff - T) / 220, 0, 1);
      if (w <= 0 || p.a * k > Rpx * 1.2) return;
      const an = -0.6 + i * 2.39 + t * 0.12 / Math.sqrt(Math.max(p.per, 1) / 5);
      const x = cx + Math.cos(an) * p.a * k, y = cy + Math.sin(an) * p.a * k;
      ctx.globalAlpha = w;
      ctx.fillStyle = '#eaf2ff';
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(234,242,255,0.8)';
      ctx.fillText(p.name, x + 7, y + 4);
      ctx.globalAlpha = 1;
    });

    /* planeta de ejemplo en el centro de la zona */
    const ac = (hz.rg + hz.mg) / 2;
    this.ang += dt * 0.45;
    const px = cx + Math.cos(this.ang) * ac * k, py = cy + Math.sin(this.ang) * ac * k;
    g = ctx.createRadialGradient(px, py, 0, px, py, 16);
    g.addColorStop(0, 'rgba(110,245,210,0.55)'); g.addColorStop(1, 'rgba(110,245,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 16, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(px - 2, py - 2, 0, px, py, 6);
    g.addColorStop(0, '#d9fff5'); g.addColorStop(0.5, '#3fb6d9'); g.addColorStop(1, '#0d3a70');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.fill();

    /* estrella */
    const sr = clamp(7 + s.R * 12, 7, 30);
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 5);
    g.addColorStop(0, rgba(scol, 0.9)); g.addColorStop(0.2, rgba(scol, 0.35)); g.addColorStop(1, rgba(scol, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sr * 5, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, rgba(scol.map(function (v) { return Math.round(lerp(v, 255, 0.5)); }), 1)); g.addColorStop(1, rgba(scol, 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, sr, 0, TAU); ctx.fill();
  };
  EXO.HZWidget = HZWidget;

  /* ======================================================================
     Metodo de transito
     ====================================================================== */
  function overlap(R, r, d) {
    if (d >= R + r) return 0;
    if (d <= R - r) return Math.PI * r * r;
    const a = r * r * Math.acos(clamp((d * d + r * r - R * R) / (2 * d * r), -1, 1)) +
      R * R * Math.acos(clamp((d * d + R * R - r * r) / (2 * d * R), -1, 1)) -
      0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)));
    return a;
  }
  function Transit(c) { this.c = c; this.ctx = c.getContext('2d'); this.visible = false; this.t = 0; }
  Transit.prototype.flux = function (ph, R, r, b) {
    const x = lerp(-1.75, 1.75, ph) * R;
    const d = Math.hypot(x, b * R);
    const ld = 1 - 0.55 * (1 - Math.sqrt(Math.max(0, 1 - Math.min(d / R, 1) * Math.min(d / R, 1))));
    return 1 - overlap(R, r, d) / (Math.PI * R * R) * ld * 1.15;
  };
  Transit.prototype.draw = function (t, dt) {
    const f = fitCanvas(this.c), ctx = this.ctx;
    ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    ctx.clearRect(0, 0, f.w, f.h);
    this.t += dt;
    const period = 7;
    const ph = (this.t % period) / period;
    const R = f.h * 0.21, r = R * 0.16, b = 0.28;
    const scx = f.w * 0.5, scy = f.h * 0.3;
    /* estrella con oscurecimiento al limbo */
    let g = ctx.createRadialGradient(scx, scy, R * 0.8, scx, scy, R * 2.6);
    g.addColorStop(0, 'rgba(255,190,120,0.35)'); g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(scx, scy, R * 2.6, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(scx, scy, 0, scx, scy, R);
    g.addColorStop(0, '#fff6e6'); g.addColorStop(0.6, '#ffd39a'); g.addColorStop(0.9, '#f59a52'); g.addColorStop(1, '#d9642e');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(scx, scy, R, 0, TAU); ctx.fill();
    /* planeta */
    const x = scx + lerp(-1.75, 1.75, ph) * R, y = scy + b * R;
    ctx.fillStyle = '#05060d';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(134,197,255,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r + 0.6, 0, TAU); ctx.stroke();
    /* curva de luz */
    const gx0 = f.w * 0.08, gx1 = f.w * 0.92, gy0 = f.h * 0.64, gy1 = f.h * 0.92;
    const fmin = this.flux(0.5, R, r, b);
    const Y = function (fl) { return lerp(gy0, gy1, (1 - fl) / (1 - fmin) * 0.85); };
    ctx.strokeStyle = 'rgba(190,205,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(gx1, gy0); ctx.stroke();
    ctx.fillStyle = 'rgba(185,193,222,0.7)'; ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('Brillo de la estrella', gx0, gy0 - 10);
    ctx.textAlign = 'right'; ctx.fillText('tiempo →', gx1, gy1 + 16);
    ctx.beginPath();
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      const X = lerp(gx0, gx1, p), Yv = Y(this.flux(p, R, r, b));
      if (i) ctx.lineTo(X, Yv); else ctx.moveTo(X, Yv);
    }
    ctx.strokeStyle = 'rgba(255,184,112,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath();
    const M = Math.round(ph * N);
    for (let i = 0; i <= M; i++) {
      const p = i / N;
      const X = lerp(gx0, gx1, p), Yv = Y(this.flux(p, R, r, b));
      if (i) ctx.lineTo(X, Yv); else ctx.moveTo(X, Yv);
    }
    ctx.strokeStyle = '#ffb870'; ctx.lineWidth = 2; ctx.stroke();
    const cxp = lerp(gx0, gx1, ph), cyp = Y(this.flux(ph, R, r, b));
    g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, 12);
    g.addColorStop(0, 'rgba(255,184,112,0.8)'); g.addColorStop(1, 'rgba(255,184,112,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cxp, cyp, 3, 0, TAU); ctx.fill();
  };
  EXO.Transit = Transit;

  /* ======================================================================
     Metodo de velocidad radial
     ====================================================================== */
  const LINES = [0.12, 0.2, 0.27, 0.41, 0.46, 0.58, 0.63, 0.77, 0.86];
  function RV(c) { this.c = c; this.ctx = c.getContext('2d'); this.visible = false; this.t = 0; }
  RV.prototype.draw = function (t, dt) {
    const f = fitCanvas(this.c), ctx = this.ctx;
    ctx.setTransform(f.dpr, 0, 0, f.dpr, 0, 0);
    ctx.clearRect(0, 0, f.w, f.h);
    this.t += dt;
    const th = this.t * 0.9;
    const cx = f.w * 0.5, cy = f.h * 0.3;
    const ap = f.w * 0.3, as = f.w * 0.035, sq = 0.3;
    const vr = -Math.cos(th);
    /* orbita del planeta */
    ctx.strokeStyle = 'rgba(190,205,255,0.16)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, ap, ap * sq, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, as, as * sq, 0, 0, TAU); ctx.stroke();
    const px = cx + Math.cos(th) * ap, py = cy + Math.sin(th) * ap * sq;
    const sx = cx - Math.cos(th) * as, sy = cy - Math.sin(th) * as * sq;
    const behind = Math.sin(th) < 0;
    const drawPlanet = function () {
      const g = ctx.createRadialGradient(px - 2, py - 2, 0, px, py, 8);
      g.addColorStop(0, '#d9fff5'); g.addColorStop(0.5, '#3fb6d9'); g.addColorStop(1, '#0d3a70');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
    };
    if (behind) drawPlanet();
    /* estrella con corrimiento Doppler */
    const shift = vr;
    const base = [255, 226, 190];
    const tint = shift < 0 ? [120, 170, 255] : [255, 105, 80];
    const k = Math.abs(shift) * 0.65;
    const col = base.map(function (v, i) { return Math.round(lerp(v, tint[i], k)); });
    const R = f.h * 0.13;
    let g = ctx.createRadialGradient(sx, sy, R * 0.6, sx, sy, R * 2.8);
    g.addColorStop(0, rgba(col, 0.4)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R * 2.8, 0, TAU); ctx.fill();
    g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, rgba(col, 1)); g.addColorStop(1, rgba(col.map(function (v) { return Math.round(v * 0.8); }), 1));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R, 0, TAU); ctx.fill();
    if (!behind) drawPlanet();
    ctx.font = '500 11px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = shift < 0 ? 'rgba(150,190,255,' + (0.3 + k) + ')' : 'rgba(255,140,110,' + (0.3 + k) + ')';
    ctx.fillText(shift < 0 ? 'se acerca · corrimiento al azul' : 'se aleja · corrimiento al rojo', cx, cy + R + 30);

    /* espectro con lineas de absorcion desplazadas */
    const x0 = f.w * 0.08, x1 = f.w * 0.92, y0 = f.h * 0.62, hh = f.h * 0.1;
    g = ctx.createLinearGradient(x0, 0, x1, 0);
    ['#6a3cff', '#3d7bff', '#22c6ff', '#35f0a0', '#d8f74a', '#ffc53d', '#ff7a3d', '#e83d3d'].forEach(function (c, i, a) { g.addColorStop(i / (a.length - 1), c); });
    ctx.fillStyle = g; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, x1 - x0, hh, 6) : ctx.rect(x0, y0, x1 - x0, hh); ctx.fill();
    ctx.globalAlpha = 1;
    const dx = shift * (x1 - x0) * 0.018;
    ctx.fillStyle = 'rgba(2,3,10,0.9)';
    LINES.forEach(function (l, i) { ctx.fillRect(x0 + l * (x1 - x0) + dx - 1.5, y0, i % 3 === 0 ? 3.5 : 2.2, hh); });
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([2, 3]);
    LINES.forEach(function (l) { const X = x0 + l * (x1 - x0); ctx.beginPath(); ctx.moveTo(X, y0 - 5); ctx.lineTo(X, y0); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(185,193,222,0.7)'; ctx.textAlign = 'left';
    ctx.fillText('Espectro de la estrella', x0, y0 - 10);

    /* curva de velocidad */
    const gy = f.h * 0.87, amp = f.h * 0.055;
    ctx.strokeStyle = 'rgba(190,205,255,0.12)';
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x1, gy); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const p = i / 120, X = lerp(x0, x1, p), a = th - (1 - p) * TAU * 1.5;
      const Yv = gy + Math.cos(a) * amp;
      if (i) ctx.lineTo(X, Yv); else ctx.moveTo(X, Yv);
    }
    ctx.strokeStyle = '#86c5ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
    const ey = gy + Math.cos(th) * amp;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x1, ey, 3.2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(185,193,222,0.7)'; ctx.textAlign = 'right';
    ctx.fillText('velocidad hacia nosotros', x1, gy + amp + 18);
  };
  EXO.RV = RV;

  /* ======================================================================
     Espectro de transmision ilustrativo (SVG)
     ====================================================================== */
  const MOLS = [
    { k: 'O2', f: 'O₂', n: 'Oxígeno', c: '110,245,210', bands: [0.76], w: [0.012], d: 'En la Tierra lo producen casi por completo las plantas y el fitoplancton.' },
    { k: 'O3', f: 'O₃', n: 'Ozono', c: '185,155,255', bands: [0.6], w: [0.08], d: 'Se forma a partir del oxígeno y es más fácil de detectar que el propio O₂.' },
    { k: 'H2O', f: 'H₂O', n: 'Agua', c: '90,180,255', bands: [1.15, 1.4, 1.9, 2.7], w: [0.04, 0.06, 0.07, 0.1], d: 'No es una biofirma por sí sola, pero indica que el ingrediente clave está presente.' },
    { k: 'CH4', f: 'CH₄', n: 'Metano', c: '255,184,112', bands: [1.7, 2.3, 3.3], w: [0.05, 0.07, 0.12], d: 'Junto con CO₂ y sin monóxido de carbono sugiere un desequilibrio químico difícil de explicar sin vida.' },
    { k: 'CO2', f: 'CO₂', n: 'Dióxido de carbono', c: '255,122,138', bands: [2.0, 4.3], w: [0.03, 0.14], d: 'Gas de efecto invernadero. Es clave para entender el clima y el contexto químico.' },
    { k: 'DMS', f: 'DMS', n: 'Sulfuro de dimetilo', c: '245,226,110', bands: [], w: [], d: 'En la Tierra lo emite sobre todo el fitoplancton marino. Su posible detección en K2-18 b sigue en debate.' }
  ];
  function Spectrum(host, chips) {
    const W = 1200, H = 300, x0 = 60, x1 = 1180, y0 = 30, y1 = 250;
    const lmin = 0.5, lmax = 5.0;
    const X = function (l) { return x0 + (l - lmin) / (lmax - lmin) * (x1 - x0); };
    const depth = function (l) {
      let d = 0.25 + 0.06 * Math.exp(-(l - 0.5) * 1.6);
      MOLS.forEach(function (m, mi) {
        m.bands.forEach(function (b, i) {
          const amp = [0.42, 0.3, 0.45, 0.55, 0.5, 0][mi] * (m.k === 'CO2' && b > 4 ? 1.35 : 1);
          d += amp * Math.exp(-Math.pow((l - b) / m.w[i], 2));
        });
      });
      return d;
    };
    const Y = function (d) { return y1 - d / 1.25 * (y1 - y0); };
    let path = '';
    for (let i = 0; i <= 600; i++) {
      const l = lmin + (lmax - lmin) * i / 600;
      path += (i ? 'L' : 'M') + X(l).toFixed(1) + ' ' + Y(depth(l)).toFixed(1);
    }
    let bands = '', labels = '';
    MOLS.forEach(function (m) {
      m.bands.forEach(function (b, i) {
        const w = Math.max(m.w[i] * 2.4, 0.03);
        bands += '<rect class="sb" data-k="' + m.k + '" x="' + X(b - w).toFixed(1) + '" y="' + y0 + '" width="' + (X(b + w) - X(b - w)).toFixed(1) + '" height="' + (y1 - y0) + '" fill="rgb(' + m.c + ')" />';
        labels += '<text class="sl" data-k="' + m.k + '" x="' + X(b).toFixed(1) + '" y="' + (Y(depth(b)) - 12).toFixed(1) + '" fill="rgb(' + m.c + ')">' + m.f + '</text>';
      });
    });
    let ticks = '';
    for (let l = 1; l <= 5; l++) ticks += '<line x1="' + X(l) + '" x2="' + X(l) + '" y1="' + y1 + '" y2="' + (y1 + 6) + '" stroke="rgba(190,205,255,.3)"/><text x="' + X(l) + '" y="' + (y1 + 24) + '" class="tk">' + l + ' µm</text>';
    host.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Espectro de transmisión ilustrativo con bandas de oxígeno, ozono, agua, metano y dióxido de carbono">' +
      '<defs><linearGradient id="spg" x1="0" x2="1"><stop offset="0" stop-color="#86c5ff"/><stop offset=".55" stop-color="#6ef5d2"/><stop offset="1" stop-color="#ffb870"/></linearGradient>' +
      '<linearGradient id="spf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(110,245,210,.22)"/><stop offset="1" stop-color="rgba(110,245,210,0)"/></linearGradient></defs>' +
      '<style>.sb{opacity:.035;transition:opacity .4s}.sb.on{opacity:.24}.sl{font:600 15px "Space Grotesk",sans-serif;text-anchor:middle;opacity:.85;transition:opacity .4s}.sl.dim{opacity:.25}.tk{font:12px "JetBrains Mono",monospace;fill:#7e88ab;text-anchor:middle}.ax{font:12px Inter,sans-serif;fill:#7e88ab}</style>' +
      bands +
      '<line x1="' + x0 + '" x2="' + x1 + '" y1="' + y1 + '" y2="' + y1 + '" stroke="rgba(190,205,255,.25)"/>' + ticks +
      '<path d="' + path + 'L' + x1 + ' ' + y1 + 'L' + x0 + ' ' + y1 + 'Z" fill="url(#spf)"/>' +
      '<path class="spline" d="' + path + '" fill="none" stroke="url(#spg)" stroke-width="2.2" stroke-linejoin="round"/>' +
      labels +
      '<text class="ax" x="' + x0 + '" y="' + (y0 - 10) + '">Luz absorbida por la atmósfera ↑</text>' +
      '<text class="ax" x="' + x1 + '" y="' + (y1 + 44) + '" text-anchor="end">longitud de onda</text>' +
      '</svg>';
    const svg = host.querySelector('svg');
    chips.innerHTML = MOLS.map(function (m) {
      return '<button class="mol" data-k="' + m.k + '" style="--c:' + m.c + '" data-reveal><b>' + m.f + '</b><span>' + m.n + '</span><p>' + m.d + '</p></button>';
    }).join('');
    function hi(k) {
      svg.querySelectorAll('.sb').forEach(function (e) { e.classList.toggle('on', e.dataset.k === k); });
      svg.querySelectorAll('.sl').forEach(function (e) { e.classList.toggle('dim', !!k && e.dataset.k !== k); });
      chips.querySelectorAll('.mol').forEach(function (e) { e.classList.toggle('on', e.dataset.k === k); });
    }
    chips.querySelectorAll('.mol').forEach(function (b) {
      b.addEventListener('mouseenter', function () { hi(b.dataset.k); });
      b.addEventListener('focus', function () { hi(b.dataset.k); });
      b.addEventListener('mouseleave', function () { hi(null); });
      b.addEventListener('blur', function () { hi(null); });
      b.addEventListener('click', function () { hi(b.dataset.k); });
    });
    const line = svg.querySelector('.spline');
    const len = line.getTotalLength ? line.getTotalLength() : 3000;
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.2,.7,.1,1)';
    return { reveal: function () { line.style.strokeDashoffset = 0; } };
  }
  EXO.Spectrum = Spectrum;

  /* ======================================================================
     Grafica de descubrimientos por año (SVG, una sola serie)
     ====================================================================== */
  function Chart(host, tableHost) {
    const data = EXO.discoveries;
    const W = 1200, H = 380, L = 56, R = 1180, T = 24, B = 330;
    const max = 1600;
    const n = data.length;
    const bw = (R - L) / n;
    const Y = function (v) { return B - v / max * (B - T); };
    let grid = '';
    [0, 400, 800, 1200, 1600].forEach(function (v) {
      grid += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="rgba(190,205,255,' + (v ? 0.08 : 0.28) + ')"/>' +
        '<text x="' + (L - 12) + '" y="' + (Y(v) + 4) + '" class="tk" text-anchor="end">' + fmt(v) + '</text>';
    });
    let bars = '', xl = '';
    data.forEach(function (d, i) {
      const x = L + i * bw + 1, w = bw - 2;
      const h = Math.max(B - Y(d[1]), d[1] ? 1.5 : 0);
      const r = Math.min(4, w / 2, h);
      const y = B - h;
      const partial = d[0] === 2026;
      const p = h > 0 ? 'M' + x + ' ' + B + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + B + 'Z' : '';
      bars += '<g class="bar' + (partial ? ' partial' : '') + '" data-i="' + i + '"><rect class="hit" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + (B - T) + '" fill="transparent"/>' +
        (p ? '<path d="' + p + '" style="--i:' + i + '"/>' : '') + '</g>';
      if (d[0] % 4 === 0 || i === n - 1) xl += '<text x="' + (L + i * bw + bw / 2) + '" y="' + (B + 22) + '" class="tk" text-anchor="middle">' + d[0] + '</text>';
    });
    const ann = function (year, txt) {
      const i = data.findIndex(function (d) { return d[0] === year; });
      const x = L + i * bw + bw / 2, y = Y(data[i][1]);
      return '<g class="ann"><line x1="' + x + '" x2="' + (x - 40) + '" y1="' + (y - 4) + '" y2="' + (y - 30) + '" stroke="rgba(238,241,255,.35)"/>' +
        '<text x="' + (x - 46) + '" y="' + (y - 34) + '" text-anchor="end">' + txt + '</text></g>';
    };
    host.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Gráfica de barras: exoplanetas confirmados por año de descubrimiento, de 1992 a 2026">' +
      '<defs><linearGradient id="bg1" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8ffbe0"/><stop offset="1" stop-color="#2aa98f"/></linearGradient></defs>' +
      '<style>.tk{font:12px "JetBrains Mono",monospace;fill:#7e88ab}.bar path{fill:url(#bg1);transform-origin:0 ' + B + 'px;transform:scaleY(0);transition:transform 1.2s cubic-bezier(.2,.7,.1,1) calc(var(--i)*25ms),opacity .2s}.in .bar path{transform:scaleY(1)}.bar.partial path{fill:rgba(110,245,210,.35);stroke:#6ef5d2;stroke-dasharray:3 3}.bar:hover path,.bar.on path{fill:#e6fff8}.ann text{font:500 13px Inter,sans-serif;fill:#b9c1de}</style>' +
      grid + bars + xl +
      ann(2014, 'Kepler · 872') + ann(2016, 'Kepler · 1,504') +
      '<text x="' + L + '" y="' + (T - 8) + '" class="tk">Planetas confirmados por año</text>' +
      '</svg><div class="chart-tip" role="status"></div>';
    const svg = host.querySelector('svg');
    const tip = host.querySelector('.chart-tip');
    function show(g) {
      const i = +g.dataset.i, d = data[i];
      svg.querySelectorAll('.bar.on').forEach(function (e) { e.classList.remove('on'); });
      g.classList.add('on');
      const sr = svg.getBoundingClientRect(), hr = host.getBoundingClientRect();
      const s = sr.width / W;
      tip.innerHTML = '<b>' + fmt(d[1]) + '</b> planetas<span>' + d[0] + (d[0] === 2026 ? ' · hasta el 22 de sep' : '') + '</span>';
      tip.style.left = (sr.left - hr.left + (L + i * bw + bw / 2) * s) + 'px';
      tip.style.top = (sr.top - hr.top + Y(d[1]) * s) + 'px';
      tip.style.opacity = 1;
    }
    svg.querySelectorAll('.bar').forEach(function (g) {
      g.addEventListener('mouseenter', function () { show(g); });
      g.addEventListener('click', function () { show(g); });
    });
    svg.addEventListener('mouseleave', function () {
      tip.style.opacity = 0;
      svg.querySelectorAll('.bar.on').forEach(function (e) { e.classList.remove('on'); });
    });
    tableHost.innerHTML = '<table><thead><tr><th>Año</th><th>Planetas</th></tr></thead><tbody>' +
      data.map(function (d) { return '<tr><td>' + d[0] + '</td><td>' + fmt(d[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
    return { reveal: function () { svg.classList.add('in'); } };
  }
  EXO.Chart = Chart;
})();
