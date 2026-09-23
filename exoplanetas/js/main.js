/* Orquestador: construye el DOM a partir de los datos, conecta el motor
   WebGL, el scroll suave y todas las interacciones en un solo bucle. */
(function () {
  'use strict';
  const EXO = window.EXO;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  const fmt = EXO.fmt;
  const clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const smooth = function (a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MINUS = '−';

  /* ---------- estado compartido con el motor ---------- */
  const state = {
    t: 0, dt: 0.016, scrollY: window.scrollY, vel: 0, streak: 0,
    mx: 0, my: 0, tmx: 0, tmy: 0,
    dim: 0, modalK: 0, modalT: 0,
    motion: reduce ? 0.2 : 1, motionT: reduce ? 0.2 : 1,
    tintA: [0.26, 0.16, 0.55], tintB: [0.08, 0.3, 0.6],
    sun: null
  };

  /* ---------- motor ---------- */
  let eng = null;
  try {
    eng = new EXO.Engine($('#gl'));
  } catch (e) {
    console.warn('[Otras Tierras] WebGL2 no disponible:', e);
    document.documentElement.classList.add('no-webgl');
  }
  EXO.eng = eng;
  EXO.state = state;
  const viewOf = new Map();
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { const v = viewOf.get(e.target); if (v) v.active = e.isIntersecting; });
  }, { rootMargin: '240px 240px' });
  function addView(v) {
    if (!eng) return v;
    eng.add(v); viewOf.set(v.el, v); io.observe(v.el);
    return v;
  }
  function makePlanet(el, look, teff, opts) {
    if (!eng) {
      el.style.setProperty('--fb1', EXO.kelvinCss(teff, 0.35));
      return null;
    }
    return addView(new EXO.PlanetView(el, look, teff, opts));
  }

  /* ---------- formato ---------- */
  function lyTxt(ly) { return ly < 100 ? fmt(ly, 1) : fmt(ly); }
  function perTxt(d) { return d < 100 ? fmt(d, 1) + ' días' : fmt(d) + ' días'; }
  function tempTxt(k) {
    if (k === null || k === undefined) return '—';
    const c = Math.round(k - 273.15);
    return (c < 0 ? MINUS + Math.abs(c) : c) + ' °C';
  }
  function classTxt(p) {
    return { M: 'Enana roja', K: 'Enana naranja', G: 'Tipo Sol', F: 'Tipo F' }[p.cls];
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }

  /* =====================================================================
     HERO
     ===================================================================== */
  const hero = $('#inicio');
  const heroEl = $('#hero-planet');
  const heroInner = $('.hero-inner');
  const heroStats = $('.hero-stats');
  const SUN_A = 0.46;
  const heroSpec = EXO.byId['kepler-442-b'];
  const heroView = makePlanet(heroEl,
    Object.assign({}, heroSpec.look, { cloud: 0.4, spinSpeed: 0.02, sea: 0.1, freq: 1.45 }),
    heroSpec.teff,
    { R: 0.8, expo: 1.15, preX: 1.15, tilt: 0.12, L: EXO.util.norm([Math.sin(SUN_A) * 0.85, Math.cos(SUN_A) * 0.85, -0.3]), fade: 0 });
  if (heroView) heroView.active = true;
  const sunCol = EXO.util.starLight(heroSpec.teff, 0.7);

  function updateHero() {
    const h = window.innerHeight;
    const p = clamp(state.scrollY / h, 0, 1.5);
    if (p < 1.4) {
      heroEl.style.transform = 'translate3d(0,' + (state.scrollY * 0.42).toFixed(1) + 'px,0)';
      heroInner.style.transform = 'translate3d(0,' + (state.scrollY * 0.22).toFixed(1) + 'px,0)';
      heroInner.style.opacity = clamp(1 - p * 1.5, 0, 1);
      heroStats.style.opacity = clamp(1 - p * 2.2, 0, 1);
    }
    if (heroView) heroView.alpha = 1 - smooth(0.2, 0.95, p);
    if (!eng || p > 1.2) { state.sun = null; return; }
    const r = heroEl.getBoundingClientRect();
    const R = r.width / 2 * 0.8;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    state.sun = {
      x: cx + Math.sin(SUN_A) * R * 1.004,
      y: cy - Math.cos(SUN_A) * R * 1.004,
      r: 6 + Math.min(window.innerWidth, h * 1.6) * 0.0045,
      k: (1 - smooth(0, 0.9, p)) * (1 - state.modalK) * loaderK * (heroView ? heroView.fade : 1),
      col: sunCol
    };
  }

  /* =====================================================================
     CATALOGO
     ===================================================================== */
  const grid = $('#grid');
  const cards = [];
  const cardById = {};
  EXO.planets.forEach(function (p) {
    const el = document.createElement('article');
    el.className = 'card';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'Abrir expediente de ' + p.full);
    el.style.setProperty('--accent', hexRgb(Object.assign({}, EXO.LOOKS[p.look.base], p.look).atmo));
    el.innerHTML =
      '<div class="card-planet" aria-hidden="true"></div>' +
      '<span class="card-rank">#' + String(p.rank).padStart(2, '0') + '</span>' +
      '<span class="card-esi">IST <b>' + fmt(p.esi, 2) + '</b></span>' +
      '<div class="card-body">' +
      '<span class="card-tag">' + classTxt(p) + ' · ' + (p.spec.indexOf('(') >= 0 ? fmt(p.teff) + ' K' : p.spec) + '</span>' +
      '<h3>' + p.name + '</h3>' +
      '<dl>' +
      '<div><dt>Distancia</dt><dd>' + lyTxt(p.ly) + ' a.l.</dd></div>' +
      '<div><dt>Radio</dt><dd>' + (p.radKind === 'estimado' ? '≈' : '') + fmt(p.rad, 2) + ' R⊕</dd></div>' +
      '<div><dt>Año</dt><dd>' + perTxt(p.per) + '</dd></div>' +
      '<div><dt>Temp. eq.</dt><dd>' + tempTxt(p.teq) + '</dd></div>' +
      '</dl>' +
      '<div class="esi-bar"><i style="--v:' + p.esi.toFixed(3) + '"></i></div>' +
      '</div>';
    grid.appendChild(el);
    const v = makePlanet($('.card-planet', el), p.look, p.teff, { R: 0.74 });
    const c = { p: p, el: el, v: v };
    cards.push(c);
    cardById[p.id] = c;
    el.addEventListener('mouseenter', function () { if (v) v.hoverT = 1; });
    el.addEventListener('mouseleave', function () { if (v) v.hoverT = 0; });
    el.addEventListener('pointermove', function (e) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
    el.addEventListener('click', function () { openDetail(p.id); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p.id); }
    });
  });

  let filter = 'all', sortKey = 'esi';
  let current = EXO.planets.slice();
  const SORTS = {
    esi: function (a, b) { return b.esi - a.esi; },
    ly: function (a, b) { return a.ly - b.ly; },
    rad: function (a, b) { return a.rad - b.rad; },
    year: function (a, b) { return a.year - b.year || b.esi - a.esi; }
  };
  $$('.chip').forEach(function (b) {
    const f = b.dataset.filter;
    const n = f === 'all' ? EXO.planets.length : EXO.planets.filter(function (p) { return p.cls === f; }).length;
    $('span', b).textContent = n;
    if (!n) b.hidden = true;
    b.addEventListener('click', function () {
      filter = f;
      $$('.chip').forEach(function (x) { x.classList.toggle('on', x === b); });
      applyGrid();
    });
  });
  $$('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      sortKey = b.dataset.sort;
      $$('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
      applyGrid();
    });
  });
  function applyGrid() {
    const first = new Map();
    cards.forEach(function (c) { first.set(c.el, c.el.getBoundingClientRect()); });
    current = EXO.planets.filter(function (p) { return filter === 'all' || p.cls === filter; }).sort(SORTS[sortKey]);
    const keep = new Set(current.map(function (p) { return p.id; }));
    cards.forEach(function (c) { c.el.classList.toggle('hidden', !keep.has(c.p.id)); });
    current.forEach(function (p) { grid.appendChild(cardById[p.id].el); });
    current.forEach(function (p) {
      const c = cardById[p.id];
      const f = first.get(c.el), l = c.el.getBoundingClientRect();
      if (f && f.width) {
        const dx = f.left - l.left, dy = f.top - l.top;
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          c.el.style.transition = 'none';
          c.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              c.el.style.transition = 'transform 0.9s cubic-bezier(.2,.7,.1,1)';
              c.el.style.transform = '';
              setTimeout(function () { c.el.style.transition = ''; }, 950);
            });
          });
        }
      } else {
        c.el.classList.add('in');
        if (c.v) c.v.fade = 0;
      }
    });
  }

  /* =====================================================================
     TAMAÑOS
     ===================================================================== */
  const strip = $('#strip');
  const stripWrap = $('#strip-wrap');
  const hsec = $('#tamanos');
  const stripItems = [EXO.solar[0], EXO.earth].concat(EXO.planets.filter(function (p) { return p.radKind === 'medido'; }));
  const maxRad = Math.max.apply(null, stripItems.map(function (p) { return p.rad; }));
  stripItems.sort(function (a, b) { return a.rad - b.rad; });
  stripItems.forEach(function (p) {
    const it = document.createElement('div');
    const isRef = p.id === 'tierra', isSolar = p.id === 'marte' || p.id === 'neptuno';
    it.className = 'strip-item' + (isRef ? ' ref' : '') + (isSolar ? ' solar' : '');
    it.style.setProperty('--r', p.rad);
    it.innerHTML = '<div class="strip-planet" style="width:calc(var(--u) * ' + p.rad + ');height:calc(var(--u) * ' + p.rad + ')"></div><span>' + p.name + '</span><b>' + fmt(p.rad, 2) + ' R⊕</b>';
    strip.appendChild(it);
    makePlanet($('.strip-planet', it), p.look, p.teff || 5772, { R: 0.8, clipEl: stripWrap, L: EXO.util.norm([-0.5, 0.3, 0.8]) });
  });
  const baseLine = document.createElement('div');
  baseLine.className = 'strip-baseline';
  stripWrap.appendChild(baseLine);
  let stripSpan = 0;
  function layoutStrip() {
    const avail = Math.max(120, stripWrap.clientHeight - 70);
    const u = clamp(avail / maxRad / 0.95, 34, 190);
    strip.style.setProperty('--u', u.toFixed(1) + 'px');
    stripSpan = Math.max(0, strip.scrollWidth - window.innerWidth);
    hsec.style.height = (window.innerHeight + stripSpan * 1.1 + window.innerHeight * 0.25) + 'px';
  }
  function updateStrip() {
    const r = hsec.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    const e = smooth(0.06, 0.94, p);
    strip.style.transform = 'translate3d(' + (-e * stripSpan).toFixed(1) + 'px,0,0)';
    $('#strip-progress').style.transform = 'scaleX(' + e.toFixed(4) + ')';
  }

  /* =====================================================================
     TRAPPIST-1
     ===================================================================== */
  const story = $('#trappist');
  const sysStage = $('#sys-stage');
  const sysLabels = $('#sys-labels');
  const sysList = $('#sys-list');
  const T1 = EXO.trappist;
  const lumT = Math.pow(T1.star.radSun, 2) * Math.pow(T1.star.teff / 5772, 4);
  const hzT = EXO.hz(T1.star.teff, lumT);
  const labels = T1.planets.map(function (p, i) {
    const inHZ = p.a >= hzT.rg && p.a <= hzT.mg;
    const s = document.createElement('span');
    s.textContent = p.k;
    if (inHZ) s.className = 'in-hz';
    sysLabels.appendChild(s);
    const li = document.createElement('li');
    if (inHZ) li.className = 'in-hz';
    li.innerHTML = '<b>' + p.k + '</b>' + fmt(p.per, 1) + ' d';
    li.title = 'TRAPPIST-1 ' + p.k + ': ' + fmt(p.rad, 2) + ' radios terrestres, año de ' + fmt(p.per, 2) + ' días';
    li.addEventListener('mouseenter', function () { if (sysView) sysView.hi = i; li.classList.add('on'); });
    li.addEventListener('mouseleave', function () { if (sysView) sysView.hi = -1; li.classList.remove('on'); });
    sysList.appendChild(li);
    return s;
  });
  const sysView = eng ? addView(new EXO.SystemView(sysStage, T1, labels)) : null;
  $$('.sys-controls button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (sysView) sysView.speed = +b.dataset.speed;
      $$('.sys-controls button').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });
  const steps = $$('.step');
  let curStep = 0;
  function updateStory() {
    const r = story.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    const p = total > 0 ? clamp(-r.top / total, 0, 1) : 0;
    if (sysView) {
      const target = lerp(0.03, 1.02, smooth(0.14, 0.62, p));
      sysView.elev = lerp(sysView.elev, target, 1 - Math.pow(0.001, state.dt));
      sysView.hzA = lerp(sysView.hzA, smooth(0.6, 0.78, p), 1 - Math.pow(0.01, state.dt));
    }
    const st = p < 0.3 ? 0 : p < 0.62 ? 1 : 2;
    if (st !== curStep) {
      curStep = st;
      steps.forEach(function (s, i) { s.classList.toggle('on', i === st); });
    }
    sysStage.style.opacity = eng ? 1 : 0.3;
  }

  /* =====================================================================
     DISTANCIAS
     ===================================================================== */
  const C_KMS = 299792.458;
  const VEH = { light: C_KMS, starshot: C_KMS * 0.2, parker: 191.7, voyager: 17.0 };
  const ERAS = [
    [1790, 1830, 'en vísperas de la Independencia de México'],
    [1700, 1790, 'en tiempos de la Nueva España'],
    [1420, 1492, 'antes de que Colón llegara a América'],
    [1325, 1420, 'en pleno México-Tenochtitlan'],
    [900, 1200, 'cuando florecía Chichén Itzá'],
    [250, 900, 'en el periodo clásico maya'],
    [27, 250, 'en tiempos del Imperio romano']
  ];
  const dist = $('#dist');
  const distRows = EXO.planets.slice().sort(function (a, b) { return a.ly - b.ly; });
  const maxLog = Math.log10(2200);
  function travelTxt(years) {
    if (years < 100) return fmt(years, 1) + ' años';
    if (years < 1e6) return fmt(Math.round(years)) + ' años';
    return fmt(years / 1e6, 1) + ' millones de años';
  }
  function renderDist(vkey) {
    const v = VEH[vkey];
    let html = '<div class="dist-row head"><span>Planeta</span><span>Distancia</span><span>Escala logarítmica</span><span>Tiempo de viaje</span><span>La luz salió en</span></div>';
    distRows.forEach(function (p) {
      const yrs = p.ly * C_KMS / v;
      const dep = Math.round(2026 - p.ly);
      const era = ERAS.find(function (e) { return dep >= e[0] && dep < e[1]; });
      html += '<div class="dist-row" title="' + (era ? 'La luz salió ' + era[2] : '') + '">' +
        '<span class="dist-name">' + p.name + '</span>' +
        '<span class="dist-ly">' + lyTxt(p.ly) + ' a.l.</span>' +
        '<span class="dist-bar"><i style="--w:' + (Math.log10(Math.max(p.ly, 1.5)) / maxLog).toFixed(3) + '"></i></span>' +
        '<span class="dist-time">' + travelTxt(yrs) + '</span>' +
        '<span class="dist-year">' + dep + '</span>' +
        '</div>';
    });
    dist.innerHTML = html;
  }
  renderDist('light');
  $$('.vehicles button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.vehicles button').forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('.dist-time', dist).forEach(function (el, i) {
        const p = distRows[i];
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 180, fill: 'forwards' })
          .onfinish = function () {
            el.textContent = travelTxt(p.ly * C_KMS / VEH[b.dataset.v]);
            el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: i * 18, fill: 'forwards', easing: 'cubic-bezier(.2,.7,.1,1)' });
          };
      });
    });
  });

  /* =====================================================================
     DIAGRAMAS 2D
     ===================================================================== */
  const diagrams = [];
  const hzW = new EXO.HZWidget($('#zona'));
  hzW.el = $('#hz-canvas');
  const tr = new EXO.Transit($('#transit-canvas')); tr.el = tr.c;
  const rv = new EXO.RV($('#rv-canvas')); rv.el = rv.c;
  [hzW, tr, rv].forEach(function (d) { diagrams.push(d); });
  const dio = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      diagrams.forEach(function (d) { if (d.el === e.target) d.visible = e.isIntersecting; });
    });
  }, { rootMargin: '100px' });
  diagrams.forEach(function (d) { dio.observe(d.el); });

  const spectrum = EXO.Spectrum($('#spectrum'), $('#molecules'));
  const chart = EXO.Chart($('#chart'), $('#chart-table'));

  /* =====================================================================
     APARICIONES AL HACER SCROLL
     ===================================================================== */
  const rio = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      if (el.id === 'spectrum' || el.closest('.spectrum')) spectrum.reveal();
      if (el.closest('.chart')) chart.reveal();
      rio.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  function observeReveal() { $$('[data-reveal]:not(.in), .card:not(.in), .dist').forEach(function (el) { rio.observe(el); }); }
  observeReveal();

  /* =====================================================================
     EXPEDIENTE
     ===================================================================== */
  const detail = $('#detail');
  const dEls = {
    planet: $('#d-planet'), kicker: $('#d-kicker'), name: $('#d-name'), host: $('#d-host'),
    esiFill: $('#d-esi-fill'), esiVal: $('#d-esi-val'), blurb: $('#d-blurb'), stats: $('#d-stats'),
    cmpP: $('#d-cmp-p'), cmpE: $('#d-cmp-e'), cmpName: $('#d-cmp-name'),
    weight: $('#d-weight'), kg: $('#d-kg'), kgOut: $('#d-kg-out'), gNote: $('#d-g-note'), facts: $('#d-facts')
  };
  const first = EXO.planets[0];
  const dView = makePlanet(dEls.planet, first.look, first.teff, { modal: true, drag: true, R: 0.8, expo: 1.35, L: EXO.util.norm([-0.62, 0.32, 0.72]) });
  const dCmpP = makePlanet(dEls.cmpP, first.look, first.teff, { modal: true, R: 0.8 });
  const dCmpE = makePlanet(dEls.cmpE, EXO.earth.look, 5772, { modal: true, R: 0.8 });
  let dId = null, lastFocus = null;

  function statRow(dt, dd) { return '<div><dt>' + dt + '</dt><dd>' + dd + '</dd></div>'; }
  function fillDetail(id) {
    const p = EXO.byId[id];
    dId = id;
    const pos = current.findIndex(function (x) { return x.id === id; });
    dEls.kicker.textContent = '#' + p.rank + ' de ' + EXO.planets.length + ' por similitud · ' + classTxt(p);
    dEls.name.textContent = p.full;
    dEls.host.textContent = 'Orbita a ' + p.host + ' · descubierto en ' + p.year + ' por ' + p.method.toLowerCase() + ' · ' + p.facility;
    dEls.esiFill.style.width = (p.esi * 100).toFixed(1) + '%';
    dEls.esiVal.textContent = 'IST ' + fmt(p.esi, 2);
    dEls.blurb.textContent = p.blurb;
    const mass = p.mass ? (p.massKind === 'minima' ? '≥ ' : p.massKind === 'estimada' ? '≈ ' : '') + fmt(p.mass, 2) + ' M⊕' + (p.massKind === 'minima' ? '<small>mínima</small>' : p.massKind === 'estimada' ? '<small>est.</small>' : '') : '—';
    dEls.stats.innerHTML =
      statRow('Distancia', lyTxt(p.ly) + ' <small>años luz</small>') +
      statRow('Radio', (p.radKind === 'estimado' ? '≈ ' : '') + fmt(p.rad, 2) + ' R⊕' + (p.radKind === 'estimado' ? '<small>est.</small>' : '')) +
      statRow('Masa', mass) +
      statRow('Año', perTxt(p.per)) +
      statRow('Órbita', fmt(p.a, p.a < 0.1 ? 3 : 2) + ' UA') +
      statRow('Luz recibida', fmt(p.insol * 100) + ' % <small>de la Tierra</small>') +
      statRow('Temp. equilibrio', tempTxt(p.teq)) +
      statRow('Estrella', p.spec.indexOf('(') >= 0 ? 'Tipo ' + p.cls : p.spec) +
      statRow('Temp. estrella', fmt(p.teff) + ' K');
    const big = window.innerWidth < 980 ? 86 : 112;
    const m = Math.max(p.rad, 1);
    dEls.cmpP.style.width = (big * p.rad / m).toFixed(1) + 'px';
    dEls.cmpE.style.width = (big / m).toFixed(1) + 'px';
    dEls.cmpName.textContent = p.name + ' · ' + fmt(p.rad, 2) + ' R⊕';
    if (p.g) {
      dEls.weight.hidden = false;
      const how = p.massKind === 'medida' && p.radKind === 'medido' ? 'Gravedad calculada con masa y radio medidos: ' :
        p.massKind === 'minima' ? 'Calculado con la masa mínima, así que sería al menos esto: ' : 'Gravedad estimada a partir de modelos: ';
      dEls.gNote.textContent = how + fmt(p.g, 2) + ' veces la terrestre.';
      updateWeight();
    } else {
      dEls.weight.hidden = true;
    }
    dEls.facts.innerHTML = p.facts.map(function (f) { return '<li>' + f + '</li>'; }).join('');
    dEls.planet.setAttribute('aria-label', 'Recreación artística de ' + p.full);
    if (dView) { dView.setLook(p.look, p.teff); dView.fade = 0; dView.userVel = 2.2; dView.userSpin = 0; }
    if (dCmpP) { dCmpP.setLook(p.look, p.teff); dCmpP.fade = 0; }
    $('#d-prev').hidden = $('#d-next').hidden = current.length < 2;
    $('#d-info').scrollTop = 0;
    return pos;
  }
  function updateWeight() {
    const p = EXO.byId[dId];
    if (!p || !p.g) return;
    const kg = clamp(+dEls.kg.value || 0, 0, 1000);
    dEls.kgOut.textContent = (p.massKind === 'minima' ? '≥ ' : '≈ ') + fmt(kg * p.g, 1) + ' kg';
  }
  dEls.kg.addEventListener('input', updateWeight);

  function openDetail(id) {
    lastFocus = document.activeElement;
    fillDetail(id);
    setPlanetParam(id);
    detail.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(function () { detail.classList.add('open'); });
    state.modalT = 1;
    if (lenis) lenis.stop();
    setTimeout(function () { $('#d-close').focus({ preventScroll: true }); }, 60);
  }
  function closeDetail() {
    detail.classList.remove('open');
    document.body.classList.remove('modal-open');
    state.modalT = 0;
    setPlanetParam(null);
    if (lenis) lenis.start();
    setTimeout(function () { if (!detail.classList.contains('open')) detail.hidden = true; }, 700);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  function stepDetail(d) {
    let i = current.findIndex(function (x) { return x.id === dId; });
    if (i < 0) i = 0;
    i = (i + d + current.length) % current.length;
    fillDetail(current[i].id);
    setPlanetParam(current[i].id);
  }
  $('#d-close').addEventListener('click', closeDetail);
  $('#d-prev').addEventListener('click', function () { stepDetail(-1); });
  $('#d-next').addEventListener('click', function () { stepDetail(1); });
  document.addEventListener('keydown', function (e) {
    if (!detail.classList.contains('open')) return;
    if (e.key === 'Escape') closeDetail();
    else if (e.key === 'ArrowRight' && e.target !== dEls.kg) stepDetail(1);
    else if (e.key === 'ArrowLeft' && e.target !== dEls.kg) stepDetail(-1);
    else if (e.key === 'Tab') {
      const f = $$('button:not([hidden]), input', detail).filter(function (x) { return !x.closest('[hidden]'); });
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });
  detail.addEventListener('click', function (e) { if (e.target === detail || e.target.classList.contains('d-grid')) closeDetail(); });

  /* =====================================================================
     NAVEGACION, SCROLL SUAVE Y HUD
     ===================================================================== */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1, touchMultiplier: 1.4, smoothWheel: true });
  }
  EXO.lenis = lenis;
  const nav = $('#nav');
  const navLinks = $('#nav-links');
  const navToggle = $('#nav-toggle');
  navToggle.addEventListener('click', function () {
    const open = !navLinks.classList.contains('open');
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id.length > 1 ? $(id) : null;
    if (!target) return;
    e.preventDefault();
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    const off = (target.id === 'tamanos' || target.id === 'trappist') ? 0 : -20;
    if (lenis) lenis.scrollTo(target, { offset: off, duration: 1.8, easing: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  });
  const sections = $$('main > section');
  const linkFor = {};
  $$('a', navLinks).forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });
  const TINTS = {
    inicio: [[0.26, 0.16, 0.55], [0.08, 0.3, 0.6]],
    zona: [[0.06, 0.42, 0.36], [0.1, 0.25, 0.55]],
    catalogo: [[0.12, 0.22, 0.62], [0.32, 0.14, 0.52]],
    tamanos: [[0.1, 0.32, 0.52], [0.36, 0.2, 0.42]],
    trappist: [[0.58, 0.16, 0.08], [0.42, 0.08, 0.24]],
    distancias: [[0.5, 0.3, 0.1], [0.2, 0.14, 0.42]],
    metodos: [[0.12, 0.3, 0.6], [0.4, 0.26, 0.12]],
    vida: [[0.08, 0.45, 0.32], [0.18, 0.2, 0.5]],
    historia: [[0.3, 0.16, 0.6], [0.1, 0.36, 0.5]],
    futuro: [[0.46, 0.12, 0.42], [0.1, 0.24, 0.62]]
  };
  let activeSec = 'inicio';
  function updateNav() {
    const y = state.scrollY, h = window.innerHeight;
    nav.classList.toggle('scrolled', y > 40);
    const max = document.documentElement.scrollHeight - h;
    $('#nav-progress').style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ')';
    let cur = 'inicio';
    for (let i = 0; i < sections.length; i++) {
      const r = sections[i].getBoundingClientRect();
      if (r.top < h * 0.5 && r.bottom > h * 0.5) { cur = sections[i].id; break; }
    }
    if (cur !== activeSec) {
      activeSec = cur;
      Object.keys(linkFor).forEach(function (k) { linkFor[k].classList.toggle('active', k === cur); });
    }
    const tt = TINTS[activeSec] || TINTS.inicio;
    const k = 1 - Math.pow(0.25, state.dt);
    for (let i = 0; i < 3; i++) {
      state.tintA[i] = lerp(state.tintA[i], tt[0][i], k);
      state.tintB[i] = lerp(state.tintB[i], tt[1][i], k);
    }
  }

  const hudRes = $('#hud-res'), hudFps = $('#hud-fps'), hudMode = $('#hud-mode'), hudMotion = $('#hud-motion');
  if (!eng) $('#hud').hidden = true;
  hudMode.addEventListener('click', function () {
    if (!eng) return;
    eng.mode = eng.mode === 'auto' ? 'max' : 'auto';
    if (eng.mode === 'auto') eng.quality = 1;
    hudMode.textContent = eng.mode === 'auto' ? 'AUTO' : 'NATIVA';
  });
  hudMotion.addEventListener('click', function () {
    const paused = state.motionT > 0.5;
    state.motionT = paused ? 0 : 1;
    hudMotion.setAttribute('aria-pressed', paused);
    hudMotion.textContent = paused ? 'Pausado' : 'Movimiento';
  });
  let hudT = 0;
  function updateHud(dt) {
    hudT += dt;
    if (hudT < 0.5 || !eng) return;
    hudT = 0;
    hudRes.textContent = eng.W + ' × ' + eng.H;
    hudFps.textContent = Math.round(eng.fps) + ' FPS' + (eng.gpu ? ' · GPU ' + eng.gpu.toFixed(1) + ' ms' : '');
  }

  window.addEventListener('pointermove', function (e) {
    state.tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    state.tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  /* ---------- contadores del hero ---------- */
  function countUp() {
    $$('[data-count]').forEach(function (el) {
      const to = +el.dataset.count, dec = +(el.dataset.dec || 0);
      const t0 = performance.now(), dur = 2200;
      (function tick(now) {
        const k = clamp((now - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - k, 4);
        el.textContent = fmt(to * e, dec);
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* ---------- redimensionar ---------- */
  function onResize() {
    layoutStrip();
  }
  window.addEventListener('resize', onResize);
  onResize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  /* =====================================================================
     BUCLE PRINCIPAL
     ===================================================================== */
  let last = performance.now();
  let loaderK = 0;
  let started = false;
  const loader = $('#loader');
  function start() {
    if (started) return;
    started = true;
    loader.classList.add('done');
    document.documentElement.classList.add('ready');
    countUp();
    setTimeout(function () { loader.remove(); }, 1400);
    deepLink();
  }

  /* Enlaces directos: ?planeta=<id> abre su expediente; ?at=<seccion>&p=<0-1> lleva a una escena */
  function deepLink() {
    const q = new URLSearchParams(location.search);
    const at = q.get('at') && document.getElementById(q.get('at'));
    if (at) {
      const pr = parseFloat(q.get('p') || '0');
      const y = at.getBoundingClientRect().top + window.scrollY + Math.max(0, at.offsetHeight - window.innerHeight) * pr;
      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    }
    const id = q.get('planeta');
    if (id && EXO.byId[id]) openDetail(id);
  }
  function setPlanetParam(id) {
    const u = new URL(location.href);
    if (id) u.searchParams.set('planeta', id); else u.searchParams.delete('planeta');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (lenis) lenis.raf(now);
    state.dt = dt;
    state.t += dt;
    const sy = window.scrollY;
    const vel = lenis ? lenis.velocity : (sy - state.scrollY) / Math.max(dt * 60, 0.5);
    state.scrollY = sy;
    state.vel = vel;
    state.streak = reduce ? 0 : lerp(state.streak, clamp(vel * 0.55, -38, 38), 1 - Math.pow(0.02, dt));
    state.mx = lerp(state.mx, state.tmx, 1 - Math.pow(0.05, dt));
    state.my = lerp(state.my, state.tmy, 1 - Math.pow(0.05, dt));
    state.motion = lerp(state.motion, state.motionT * (reduce ? 0.2 : 1), 1 - Math.pow(0.02, dt));
    state.modalK = lerp(state.modalK, state.modalT, 1 - Math.pow(0.004, dt));
    if (Math.abs(state.modalK - state.modalT) < 0.002) state.modalK = state.modalT;
    state.dim = state.modalK * 0.75;
    loaderK = lerp(loaderK, started ? 1 : 0, 1 - Math.pow(0.1, dt));

    updateNav();
    updateStrip();
    updateStory();
    updateHero();

    if (eng) {
      eng.frame(state);
      eng.adapt(dt * 1000, now);
    }
    for (let i = 0; i < diagrams.length; i++) {
      if (diagrams[i].visible && state.modalK < 0.99) diagrams[i].draw(state.t, dt * Math.max(state.motion, 0.05));
    }
    updateHud(dt);
    if (!started && state.t > 0.35) start();
  }
  requestAnimationFrame(function (now) { last = now; loop(now); });
  setTimeout(start, 3500);
})();
