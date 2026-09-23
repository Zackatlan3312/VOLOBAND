/* Motor WebGL2: un solo lienzo fijo detras del contenido. Cada planeta se
   dibuja en la posicion exacta de su elemento HTML (con precision subpixel),
   asi el DOM decide el layout y el GPU pinta a la resolucion nativa. */
(function () {
  'use strict';
  const EXO = window.EXO;
  const S = EXO.shaders;

  /* ---------- color ---------- */
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function hexLin(h) {
    const n = parseInt(h.slice(1), 16);
    return [s2l(((n >> 16) & 255) / 255), s2l(((n >> 8) & 255) / 255), s2l((n & 255) / 255)];
  }
  function kelvinSRGB(K) {
    const t = K / 100;
    let r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
      b = 255;
    }
    return [r, g, b].map(function (v) { return Math.min(255, Math.max(0, v)) / 255; });
  }
  /* Color de la luz estelar, lineal y normalizado; sat=0 es blanco puro */
  function starLight(K, sat) {
    const c = kelvinSRGB(K).map(s2l);
    const m = Math.max(c[0], c[1], c[2]);
    const k = sat === undefined ? 0.4 : sat;
    return c.map(function (v) { return 1 + (v / m - 1) * k; });
  }
  function kelvinCss(K, sat) {
    const c = kelvinSRGB(K);
    const k = sat === undefined ? 1 : sat;
    return 'rgb(' + c.map(function (v) { return Math.round((1 + (v - 1) * k) * 255); }).join(',') + ')';
  }
  EXO.kelvinSRGB = kelvinSRGB;
  EXO.kelvinCss = kelvinCss;

  /* ---------- zona habitable (Kopparapu et al. 2014) ---------- */
  const HZ_COEF = {
    rv: [1.776, 2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
    rg: [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15],
    mg: [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
    em: [0.32, 5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16]
  };
  EXO.hz = function (teff, lum) {
    const T = Math.min(7200, Math.max(2600, teff)) - 5780;
    const out = {};
    Object.keys(HZ_COEF).forEach(function (k) {
      const c = HZ_COEF[k];
      const seff = c[0] + c[1] * T + c[2] * T * T + c[3] * T * T * T + c[4] * T * T * T * T;
      out[k] = Math.sqrt(lum / seff);
    });
    return out;
  };

  /* ---------- matrices 3x3 (column-major) ---------- */
  function rotX(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, s, 0, -s, c]; }
  function rotY(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, -s, 0, 1, 0, s, 0, c]; }
  function rotZ(t) { const c = Math.cos(t), s = Math.sin(t); return [c, s, 0, -s, c, 0, 0, 0, 1]; }
  function mul(a, b) {
    const o = new Array(9);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) {
      o[c * 3 + r] = a[r] * b[c * 3] + a[3 + r] * b[c * 3 + 1] + a[6 + r] * b[c * 3 + 2];
    }
    return o;
  }
  function mv(m, v) {
    return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  }
  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function frac(x) { return x - Math.floor(x); }

  /* ---------- apariencia de un planeta ---------- */
  function buildLook(spec, teff) {
    const base = EXO.LOOKS[spec.base] || EXO.LOOKS.terran;
    const L = Object.assign({}, base, spec);
    const locked = !!(L.locked || L.eye > -1.5);
    return {
      seed: L.seed || 1,
      freq: L.freq || (spec.base === 'hycean' ? 1.25 : 1.7),
      sea: L.sea, ice: L.ice, eye: L.eye, cloud: L.cloud, bands: L.bands,
      atmoK: L.atmoK, haze: L.haze, relief: L.relief,
      deep: hexLin(L.deep), shallow: hexLin(L.shallow), low: hexLin(L.low),
      high: hexLin(L.high), snow: hexLin(L.snow), atmo: hexLin(L.atmo),
      atmoHex: L.atmo,
      climate: L.climate || 0, wet: L.wet || 0,
      sat: L.sat === undefined ? 1 : L.sat,
      veg: L.veg ? hexLin(L.veg).map(function (v) { return v * 2.2; }) : [1, 1, 1],
      earth: !!L.earth,
      cloudLon: L.earth ? 0 : L.seed * 2.3,
      landScale: L.landScale || 3.2,
      tint: L.tint ? hexLin(L.tint).map(function (v) { return v * 1.9; }) : [1, 1, 1],
      star: starLight(teff || 5772),
      locked: locked,
      tilt: locked ? 0 : (L.tilt !== undefined ? L.tilt : 0.25 + frac(L.seed * 0.37) * 0.25),
      spinSpeed: L.spinSpeed || 0.06,
      spin0: L.seed * 1.7
    };
  }
  EXO.buildLook = buildLook;

  /* ---------- programas ---------- */
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    const shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(function (d) {
      const s = gl.createShader(d[0]);
      gl.shaderSource(s, d[1]);
      gl.compileShader(s);
      gl.attachShader(p, s);
      return s;
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = shaders.map(function (s) { return gl.getShaderInfoLog(s); }).join('\n');
      throw new Error('Error de shader:\n' + log + '\n' + gl.getProgramInfoLog(p));
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { p: p, u: u };
  }

  /* =====================================================================
     Engine
     ===================================================================== */
  function Engine(canvas) {
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: 'high-performance', desynchronized: false
    });
    if (!gl) throw new Error('WebGL2 no disponible');
    this.gl = gl;
    this.canvas = canvas;
    this.P = {
      neb: program(gl, S.VS_FULL, S.FS_NEBULA),
      comp: program(gl, S.VS_FULL, S.FS_COMPOSITE),
      stars: program(gl, S.VS_STARS, S.FS_STARS),
      planet: program(gl, S.VS_FULL, S.FS_PLANET),
      star: program(gl, S.VS_FULL, S.FS_STAR),
      orbits: program(gl, S.VS_FULL, S.FS_ORBITS),
      epic: program(gl, S.VS_FULL, S.FS_EPIC)
    };
    this.initTextures();
    this.vao = gl.createVertexArray();
    this.views = [];
    this.quality = 1;
    this.mode = 'auto';
    this.ft = 16.7;
    this.frameN = 0;
    this.lastAdj = 0;
    this.ceiling = 1;
    this.ceilingUntil = 0;
    this.W = this.H = this.cssW = this.cssH = 0;
    this.scale = 1;
    this.maxDpr = 2;
    this.fps = 60;
    this._fpsAcc = 0; this._fpsN = 0;
    this.tq = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.q = null;
    this.genStars();
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }
  EXO.Engine = Engine;

  /* ---------- texturas reales (NASA / ESA) ----------
     Unidades fijas: 1 nubes, 2 terreno (array), 3 Tierra, 4 oceano, 5 fotos EPIC (array) */
  Engine.prototype.initTextures = function () {
    const gl = this.gl;
    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.tex = { ready: {} };
    this.texOn = 0;
    this.texOnTarget = 0;
    const px = new Uint8Array([0, 0, 0, 255]);
    const self = this;
    [[1, gl.TEXTURE_2D], [2, gl.TEXTURE_2D_ARRAY], [3, gl.TEXTURE_2D], [4, gl.TEXTURE_2D], [5, gl.TEXTURE_2D_ARRAY]].forEach(function (d) {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + d[0]);
      gl.bindTexture(d[1], t);
      if (d[1] === gl.TEXTURE_2D) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      else gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.texParameteri(d[1], gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(d[1], gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      self.tex['u' + d[0]] = t;
    });
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(this.P.planet.p);
    gl.uniform1i(this.P.planet.u.uCloudTex, 1);
    gl.uniform1i(this.P.planet.u.uLandTex, 2);
    gl.uniform1i(this.P.planet.u.uEarthTex, 3);
    gl.uniform1i(this.P.planet.u.uOceanTex, 4);
    gl.useProgram(this.P.epic.p);
    gl.uniform1i(this.P.epic.u.uEpic, 5);
    gl.useProgram(null);
  };

  /* Descarga con progreso y decodificacion fuera del hilo principal */
  Engine.prototype.fetchImage = function (url, onBytes) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + ' ' + res.status);
      const total = +res.headers.get('content-length') || 0;
      if (!res.body || !res.body.getReader) return res.blob();
      const reader = res.body.getReader();
      const chunks = [];
      let got = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks);
          chunks.push(r.value);
          got += r.value.length;
          if (onBytes) onBytes(got, total);
          return pump();
        });
      }
      return pump();
    }).then(function (blob) {
      if (window.createImageBitmap) {
        return createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' });
      }
      return new Promise(function (ok, fail) {
        const img = new Image();
        img.onload = function () { ok(img); };
        img.onerror = fail;
        img.src = URL.createObjectURL(blob);
      });
    });
  };

  /* Sube una imagen como textura 2D o como array (capas apiladas en vertical) */
  Engine.prototype.upload = function (unit, img, o) {
    const gl = this.gl;
    const target = o.layers ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    if (o.layers) {
      const h = img.height / o.layers;
      gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, h);
      gl.texImage3D(target, 0, o.internal, img.width, h, o.layers, 0, o.format, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
    } else {
      gl.texImage2D(target, 0, o.internal, o.format, gl.UNSIGNED_BYTE, img);
    }
    gl.generateMipmap(target);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, o.wrapS || gl.REPEAT);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, o.wrapT || gl.CLAMP_TO_EDGE);
    if (this.aniso) {
      gl.texParameterf(target, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(8, gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    gl.deleteTexture(this.tex['u' + unit]);
    this.tex['u' + unit] = t;
    gl.activeTexture(gl.TEXTURE0);
    if (img.close) img.close();
  };

  /* Nubes y terreno (necesarios para el primer cuadro); resuelve cuando estan en la GPU */
  Engine.prototype.loadCore = function (base, onProgress) {
    const gl = this.gl, self = this;
    const big = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1) >= 2400 && this.maxTex >= 8192;
    const files = [
      { url: base + (big ? 'nubes-8k.jpg' : 'nubes-4k.jpg'), size: big ? 4.9e6 : 1.6e6 },
      { url: base + 'terreno.jpg', size: 1.46e6 }
    ];
    const got = [0, 0];
    function prog(i) {
      return function (g, t) {
        got[i] = g; if (t) files[i].size = t;
        if (onProgress) onProgress((got[0] + got[1]) / (files[0].size + files[1].size));
      };
    }
    return Promise.all([self.fetchImage(files[0].url, prog(0)), self.fetchImage(files[1].url, prog(1))]).then(function (imgs) {
      self.upload(1, imgs[0], { internal: gl.R8, format: gl.RED, wrapS: gl.REPEAT });
      self.upload(2, imgs[1], { internal: gl.SRGB8_ALPHA8, format: gl.RGBA, layers: 8, wrapS: gl.MIRRORED_REPEAT, wrapT: gl.MIRRORED_REPEAT });
      self.tex.ready.core = true;
      self.texOnTarget = 1;
    });
  };
  Engine.prototype.loadEarth = function (base) {
    const gl = this.gl, self = this;
    return Promise.all([this.fetchImage(base + 'tierra-2k.jpg'), this.fetchImage(base + 'tierra-oceano.png')]).then(function (imgs) {
      self.upload(3, imgs[0], { internal: gl.SRGB8_ALPHA8, format: gl.RGBA, wrapS: gl.REPEAT });
      self.upload(4, imgs[1], { internal: gl.R8, format: gl.RED, wrapS: gl.REPEAT });
      self.tex.ready.earth = true;
    });
  };
  Engine.prototype.loadEpic = function (base, layers) {
    const gl = this.gl, self = this;
    if (this.tex.epicLoading) return this.tex.epicLoading;
    this.tex.epicLoading = this.fetchImage(base + 'tierra-epic.jpg').then(function (img) {
      self.upload(5, img, { internal: gl.RGBA8, format: gl.RGBA, layers: layers, wrapS: gl.CLAMP_TO_EDGE });
      self.tex.ready.epic = true;
    });
    return this.tex.epicLoading;
  };

  Engine.prototype.genStars = function () {
    const gl = this.gl;
    const area = Math.max(screen.width * screen.height, 1280 * 720);
    const n = Math.min(12000, Math.max(2200, Math.round(area / 480)));
    const spikes = 9 + Math.round(area / 400000);
    const d = new Float32Array(n * 9);
    const aspect = Math.max(screen.width / screen.height, 1);
    let rnd = 1234567;
    function rand() { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; }
    for (let i = 0; i < n; i++) {
      let x, y, tries = 0;
      do {
        x = rand(); y = rand();
        const px = (x - 0.5) * aspect, py = y - 0.5 - 0.08;
        const dd = -0.355 * px + 0.935 * py;
        if (rand() < 0.3 + 0.7 * Math.exp(-dd * dd * 18)) break;
      } while (++tries < 8);
      const depth = 0.12 + Math.pow(rand(), 1.4) * 0.88;
      const m = Math.pow(rand(), 7);
      const spike = i < spikes;
      const size = spike ? 1.25 + rand() * 0.6 : 0.42 + m * 1.35;
      const bright = spike ? 0.97 + rand() * 0.03 : Math.min(0.955, 0.18 + m * 0.8 + rand() * 0.12);
      const temp = 3200 + Math.pow(rand(), 0.8) * 9500;
      const c = starLight(temp, 0.75);
      const mx = Math.max(c[0], c[1], c[2]);
      const o = i * 9;
      d[o] = x; d[o + 1] = y;
      d[o + 2] = depth; d[o + 3] = size; d[o + 4] = rand(); d[o + 5] = bright;
      d[o + 6] = c[0] / mx; d[o + 7] = c[1] / mx; d[o + 8] = c[2] / mx;
    }
    this.starN = n;
    this.starVao = gl.createVertexArray();
    gl.bindVertexArray(this.starVao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 36, 0); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 8); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 36, 24); gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  };

  Engine.prototype.makeFbo = function () {
    const gl = this.gl;
    /* la nebulosa es muy suave: basta con ~1400 px de ancho, a cualquier resolucion */
    const w = Math.max(1, Math.min(Math.round(this.W / 2), 1400));
    const h = Math.max(1, Math.round(w * this.H / this.W));
    if (!this.nebTex) { this.nebTex = gl.createTexture(); this.fbo = gl.createFramebuffer(); }
    gl.bindTexture(gl.TEXTURE_2D, this.nebTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.nebTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fw = w; this.fh = h;
  };

  Engine.prototype.resize = function () {
    const cssW = this.canvas.clientWidth || window.innerWidth;
    const cssH = this.canvas.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const cap = this.mode === 'max' ? Math.min(dpr, 3) : Math.min(dpr, this.maxDpr);
    const q = this.mode === 'max' ? 1 : this.quality;
    const W = Math.max(1, Math.round(cssW * cap * q));
    const H = Math.max(1, Math.round(cssH * cap * q));
    this.cssW = cssW; this.cssH = cssH;
    if (W !== this.W || H !== this.H) {
      this.canvas.width = W; this.canvas.height = H;
      this.W = W; this.H = H;
      this.makeFbo();
    }
    this.scale = W / cssW;
    this.dprCap = cap;
  };

  /* Ajuste automatico de resolucion. Con EXT_disjoint_timer_query se mide el
     tiempo real de GPU (no se confunde con un navegador que limita los FPS);
     solo baja la resolucion si la GPU no sostiene la fluidez y la recupera
     en cuanto hay margen. */
  Engine.prototype.gpuBegin = function () {
    const gl = this.gl, tq = this.tq;
    if (!tq) return;
    if (this.q) {
      const ok = gl.getQueryParameter(this.q, gl.QUERY_RESULT_AVAILABLE);
      const dis = gl.getParameter(tq.GPU_DISJOINT_EXT);
      if (ok || dis) {
        if (ok && !dis) {
          const ms = gl.getQueryParameter(this.q, gl.QUERY_RESULT) / 1e6;
          this.gpu = this.gpu === undefined ? ms : this.gpu * 0.85 + ms * 0.15;
          this.gpuN = (this.gpuN || 0) + 1;
        }
        gl.deleteQuery(this.q);
        this.q = null;
      }
    }
    if (!this.q) {
      this.q = gl.createQuery();
      gl.beginQuery(tq.TIME_ELAPSED_EXT, this.q);
      this.qOpen = true;
    }
  };
  Engine.prototype.gpuEnd = function () {
    if (this.qOpen) { this.gl.endQuery(this.tq.TIME_ELAPSED_EXT); this.qOpen = false; }
  };

  Engine.prototype.adapt = function (dtMs, now) {
    this.frameN++;
    this._fpsAcc += dtMs; this._fpsN++;
    if (this._fpsAcc > 500) { this.fps = 1000 * this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
    if (this.mode !== 'auto' || this.frameN < 30 || document.hidden) return;
    if (now - this.lastAdj < 700) return;
    const q0 = this.quality;
    if (this.tq && this.gpuN > 10) {
      /* presupuesto de ~11 ms de GPU por cuadro; el costo escala con q^2 */
      const g = this.gpu;
      if (g > 13) this.quality = Math.max(0.5, q0 * Math.max(0.8, Math.sqrt(11 / g)));
      else if (g < 8 && q0 < 1) this.quality = Math.min(1, q0 * Math.min(1.2, Math.sqrt(10 / g)));
    } else if (!this.tq) {
      if (dtMs > 250) return;
      this.ft = this.ft * 0.92 + dtMs * 0.08;
      if (this.ft > 26) this.quality = Math.max(0.6, q0 * 0.9);
      else if (this.ft < 18.5 && q0 < 1) this.quality = Math.min(1, q0 * 1.1);
    }
    if (this.quality !== q0) { this.lastAdj = now; this.gpuN = 0; }
  };

  Engine.prototype.add = function (v) { this.views.push(v); return v; };
  Engine.prototype.remove = function (v) {
    const i = this.views.indexOf(v);
    if (i >= 0) this.views.splice(i, 1);
  };

  /* rect en px de dispositivo (origen abajo-izquierda) interseccion con clip */
  Engine.prototype.scissor = function (x0, y0, x1, y1, clip) {
    if (clip) { x0 = Math.max(x0, clip[0]); y0 = Math.max(y0, clip[1]); x1 = Math.min(x1, clip[2]); y1 = Math.min(y1, clip[3]); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(this.W, Math.ceil(x1)); y1 = Math.min(this.H, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return false;
    this.gl.scissor(x0, y0, x1 - x0, y1 - y0);
    return true;
  };

  Engine.prototype.clipOf = function (el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = this.scale;
    return [r.left * s, this.H - r.bottom * s, r.right * s, this.H - r.top * s];
  };

  Engine.prototype.use = function (prog) {
    if (this._cur !== prog) { this.gl.useProgram(prog.p); this._cur = prog; }
    return prog.u;
  };

  /* Dibuja un planeta centrado en (cx,cy) px de dispositivo; half = semilado del cuadro */
  Engine.prototype.drawPlanet = function (look, cx, cy, half, o) {
    if (half < 1.5) return;
    if (!this.scissor(cx - half, cy - half, cx + half, cy + half, o.clip)) return;
    const gl = this.gl;
    const u = this.use(this.P.planet);
    const R = o.R || 0.78;
    const radiusPx = R * half;
    const oct = Math.max(3, Math.min(9.2, Math.log2(Math.max(radiusPx, 1)) - 1.55));
    gl.uniform3f(u.uView, cx, cy, half);
    gl.uniform1f(u.uR, R);
    gl.uniformMatrix3fv(u.uRot, false, o.rot);
    gl.uniform1f(u.uCloudSpin, o.cloudSpin || 0);
    gl.uniform3fv(u.uL, o.L);
    gl.uniform3fv(u.uSub, o.sub);
    gl.uniform3fv(u.uStar, look.star);
    gl.uniform1f(u.uSeed, look.seed);
    gl.uniform1f(u.uFreq, look.freq);
    gl.uniform1f(u.uSea, look.sea);
    gl.uniform1f(u.uIce, look.ice);
    gl.uniform1f(u.uEye, look.eye);
    gl.uniform1f(u.uCloud, look.cloud);
    gl.uniform1f(u.uBands, look.bands);
    gl.uniform1f(u.uAtmoK, look.atmoK);
    gl.uniform1f(u.uHaze, look.haze);
    gl.uniform1f(u.uRelief, look.relief);
    gl.uniform1f(u.uOct, oct);
    gl.uniform1f(u.uFade, o.fade === undefined ? 1 : o.fade);
    gl.uniform1f(u.uExpo, o.expo || 1.25);
    gl.uniform1f(u.uTime, o.time || 0);
    gl.uniform2fv(u.uVFade, o.vfade || [0, 0]);
    gl.uniform3fv(u.uDeep, look.deep);
    gl.uniform3fv(u.uShallow, look.shallow);
    gl.uniform3fv(u.uLow, look.low);
    gl.uniform3fv(u.uHigh, look.high);
    gl.uniform3fv(u.uSnow, look.snow);
    gl.uniform3fv(u.uAtmo, look.atmo);
    gl.uniform1f(u.uTexOn, this.texOn);
    gl.uniform1f(u.uEarth, look.earth && this.tex.ready.earth ? 1 : 0);
    gl.uniform1f(u.uCloudLon, look.cloudLon);
    gl.uniform1f(u.uClimate, look.climate);
    gl.uniform1f(u.uWet, look.wet);
    gl.uniform1f(u.uSat, look.sat);
    gl.uniform3fv(u.uVeg, look.veg);
    gl.uniform1f(u.uLandScale, look.landScale);
    gl.uniform3fv(u.uTint, look.tint);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Engine.prototype.drawEpic = function (cx, cy, half, o) {
    if (!this.scissor(cx - half, cy - half, cx + half, cy + half, o.clip)) return;
    const gl = this.gl;
    const u = this.use(this.P.epic);
    gl.uniform3f(u.uView, cx, cy, half);
    gl.uniform1f(u.uR, o.R);
    gl.uniform2f(u.uCur, o.cur[0], o.cur[1]);
    gl.uniform4fv(u.uA, o.A);
    gl.uniform4fv(u.uB, o.B);
    gl.uniform4fv(u.uGeo, o.geo);
    gl.uniform1f(u.uF, o.f);
    gl.uniform1f(u.uFade, o.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  Engine.prototype.drawStar = function (cx, cy, half, R, col, t, clip) {
    if (!this.scissor(cx - half, cy - half, cx + half, cy + half, clip)) return;
    const gl = this.gl;
    const u = this.use(this.P.star);
    gl.uniform3f(u.uView, cx, cy, half);
    gl.uniform1f(u.uR, R);
    gl.uniform3fv(u.uCol, col);
    gl.uniform1f(u.uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* ---------- cuadro completo ---------- */
  Engine.prototype.frame = function (st) {
    this.resize();
    this.texOn += (this.texOnTarget - this.texOn) * Math.min(1, st.dt * 2.5);
    if (Math.abs(this.texOnTarget - this.texOn) < 0.002) this.texOn = this.texOnTarget;
    const gl = this.gl, W = this.W, H = this.H, s = this.scale;
    this.gpuBegin();
    this._cur = null;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);

    /* nebulosa (media resolucion) */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.fw, this.fh);
    let u = this.use(this.P.neb);
    gl.uniform2f(u.uRes, this.fw, this.fh);
    gl.uniform1f(u.uTime, st.t);
    gl.uniform2f(u.uOff, st.mx * 0.012, -st.scrollY / this.cssH * 0.035 + st.my * 0.008);
    gl.uniform3fv(u.uTintA, st.tintA);
    gl.uniform3fv(u.uTintB, st.tintB);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);

    /* composicion */
    const sun = st.sun;
    const sunVec = sun ? [sun.x * s, H - sun.y * s, Math.max(sun.r * s, 1), sun.k] : [0, 0, 1, 0];
    u = this.use(this.P.comp);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.nebTex);
    gl.uniform1i(u.uNeb, 0);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform4fv(u.uSun, sunVec);
    gl.uniform3fv(u.uSunCol, sun ? sun.col : [1, 1, 1]);
    gl.uniform1f(u.uTime, st.t);
    gl.uniform1f(u.uDim, st.dim);
    gl.uniform1i(u.uMode, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    /* estrellas */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    u = this.use(this.P.stars);
    gl.uniform2f(u.uRes, W, H);
    gl.uniform2f(u.uOff, st.mx * 0.004 + st.t * 0.0009, st.scrollY / this.cssH * 0.1 + st.my * 0.003);
    gl.uniform1f(u.uTime, st.t);
    gl.uniform1f(u.uScale, s);
    gl.uniform1f(u.uStreak, st.streak);
    gl.uniform1f(u.uDim, st.dim);
    gl.bindVertexArray(this.starVao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.starN);
    gl.bindVertexArray(this.vao);

    /* vistas (planetas, sistemas) */
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    for (let i = 0; i < this.views.length; i++) {
      const v = this.views[i];
      if (!v.active) continue;
      const k = v.modal ? st.modalK : 1 - st.modalK;
      if (k <= 0.002) continue;
      v.render(this, st, k);
    }
    gl.disable(gl.SCISSOR_TEST);

    /* destello de la estrella del hero, por encima del planeta */
    if (sun && sun.k > 0.001) {
      gl.blendFunc(gl.ONE, gl.ONE);
      u = this.use(this.P.comp);
      gl.uniform1i(u.uMode, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    this.gpuEnd();
  };

  /* =====================================================================
     PlanetView: un planeta anclado a un elemento HTML
     ===================================================================== */
  const L_CARD = norm([-0.58, 0.36, 0.73]);

  function PlanetView(el, spec, teff, opts) {
    opts = opts || {};
    this.el = el;
    this.R = opts.R || 0.78;
    this.modal = !!opts.modal;
    this.clipEl = opts.clipEl || null;
    this.vfadeEl = opts.vfadeEl || null;
    this.vfadeLen = opts.vfadeLen || 0.3;
    this.L0 = opts.L || L_CARD;
    this.speed = opts.speed || 1;
    this.expo = opts.expo || 1.25;
    this.preX = opts.preX || 0;
    this.alpha = 1;
    this.tiltOverride = opts.tilt;
    this.hover = 0; this.hoverT = 0;
    this.userSpin = 0; this.userVel = 0;
    this.fade = opts.fade === undefined ? 0 : opts.fade;
    this.active = false;
    this.spinAcc = 0;
    this.setLook(spec, teff);
    if (opts.drag) this.enableDrag();
  }
  PlanetView.prototype.vfadeOf = function (eng) {
    const b = this.vfadeEl.getBoundingClientRect().bottom;
    const y0 = eng.H - b * eng.scale;
    return [y0, y0 + this.vfadeLen * eng.cssH * eng.scale];
  };
  PlanetView.prototype.setLook = function (spec, teff) {
    this.look = buildLook(spec, teff);
  };
  PlanetView.prototype.enableDrag = function () {
    const self = this, el = this.el;
    let down = false, lx = 0, lt = 0;
    el.addEventListener('pointerdown', function (e) {
      down = true; lx = e.clientX; lt = performance.now();
      el.setPointerCapture(e.pointerId); el.classList.add('grabbing');
    });
    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      const now = performance.now();
      const dx = e.clientX - lx;
      const w = el.getBoundingClientRect().width || 300;
      const d = dx / w * 3.2;
      self.userSpin += d;
      self.userVel = d / Math.max((now - lt) / 1000, 0.008);
      lx = e.clientX; lt = now;
    });
    function up() { down = false; el.classList.remove('grabbing'); }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    this._dragging = function () { return down; };
  };
  PlanetView.prototype.render = function (eng, st, vis) {
    const r = this.el.getBoundingClientRect();
    if (r.width < 2 || r.bottom < -40 || r.top > eng.cssH + 40 || r.right < -40 || r.left > eng.cssW + 40) return;
    const s = eng.scale;
    const cx = (r.left + r.width / 2) * s;
    const cy = eng.H - (r.top + r.height / 2) * s;
    const half = Math.min(r.width, r.height) / 2 * s;
    const dt = st.dt;

    this.hover += (this.hoverT - this.hover) * Math.min(1, dt * 6);
    this.fade += (1 - this.fade) * Math.min(1, dt * 2.2);
    if (!(this._dragging && this._dragging())) {
      this.userSpin += this.userVel * dt;
      this.userVel *= Math.pow(0.08, dt);
    }
    this.spinAcc += dt * this.look.spinSpeed * this.speed * (1 + this.hover * 5) * st.motion;
    const alpha = this.fade * (vis === undefined ? 1 : vis) * this.alpha;
    if (alpha < 0.003) return;

    const lk = this.look;
    let rot, L;
    if (lk.locked) {
      const sway = 0.5 * Math.sin(st.t * 0.07 * st.motion + lk.seed) + this.userSpin + this.hover * 0.35;
      rot = rotY(lk.spin0 + sway);
      L = mv(rotY(-sway), this.L0);
    } else {
      const tilt = this.tiltOverride !== undefined ? this.tiltOverride : lk.tilt;
      rot = mul(rotY(lk.spin0 + this.spinAcc + this.userSpin), this.preX ? mul(rotZ(tilt), rotX(this.preX)) : rotZ(tilt));
      L = this.L0;
    }
    eng.drawPlanet(lk, cx, cy, half, {
      R: this.R, rot: rot, L: L, sub: mv(rot, L),
      cloudSpin: st.t * 0.004 * st.motion,
      fade: alpha, expo: this.expo, time: st.t,
      clip: this.clipEl ? eng.clipOf(this.clipEl) : null,
      vfade: this.vfadeEl ? this.vfadeOf(eng) : null
    });
  };
  EXO.PlanetView = PlanetView;

  /* =====================================================================
     SystemView: TRAPPIST-1 en 3D, con fases reales iluminadas por la estrella
     ===================================================================== */
  function SystemView(el, sys, labels) {
    this.el = el;
    this.sys = sys;
    this.labels = labels || [];
    this.active = false;
    this.elev = 0.06;
    this.hzA = 0;
    this.hi = -1;
    this.days = 3.2;
    this.speed = 0.9;
    const aMax = sys.planets[sys.planets.length - 1].a;
    this.k = 0.9 / aMax;
    this.orb = sys.planets.map(function (p) { return p.a * 0.9 / aMax; });
    this.looks = sys.planets.map(function (p) { return buildLook(p.look, sys.star.teff); });
    this.phase0 = [0.6, 2.4, 4.1, 5.3, 1.2, 3.3, 5.9];
    const lum = Math.pow(sys.star.radSun, 2) * Math.pow(sys.star.teff / 5772, 4);
    const hz = EXO.hz(sys.star.teff, lum);
    this.hz = [hz.rg * this.k, hz.mg * this.k];
    const c = kelvinSRGB(sys.star.teff).map(s2l);
    const m = Math.max(c[0], c[1], c[2]);
    this.starCol = c.map(function (v) { return v / m; });
    this.pos = [];
  }
  SystemView.prototype.render = function (eng, st) {
    const r = this.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > eng.cssH) return;
    const s = eng.scale;
    const gl = eng.gl;
    const sinE = Math.sin(this.elev), cosE = Math.cos(this.elev);
    const halfCss = Math.min(r.width / 2, r.height / 2 / Math.max(sinE, 0.001)) * 0.95;
    const half = halfCss * s;
    const cx = (r.left + r.width / 2) * s;
    const cy = eng.H - (r.top + r.height / 2) * s;
    const clip = [r.left * s, eng.H - r.bottom * s, r.right * s, eng.H - r.top * s];
    this.days += st.dt * this.speed * st.motion;

    /* orbitas + zona habitable */
    if (eng.scissor(clip[0], clip[1], clip[2], clip[3], null)) {
      const u = eng.use(eng.P.orbits);
      gl.uniform3f(u.uView, cx, cy, half);
      gl.uniform1f(u.uElev, sinE);
      gl.uniform1fv(u.uOrb, this.orb);
      gl.uniform1f(u.uHi, this.hi);
      gl.uniform2f(u.uHZ, this.hz[0], this.hz[1]);
      gl.uniform1f(u.uHZa, this.hzA);
      gl.uniform1f(u.uLineW, 1.4 * s);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    /* posiciones */
    const list = [];
    const ps = this.sys.planets;
    for (let i = 0; i < ps.length; i++) {
      const th = this.phase0[i] + 2 * Math.PI * this.days / ps[i].per;
      const X = this.orb[i] * Math.cos(th), Y = this.orb[i] * Math.sin(th);
      const sx = X, sy = Y * sinE, z = -Y * cosE;
      const L = norm([-X, -Y * sinE, Y * cosE]);
      const rot = mul(rotY(-th + i * 0.9), rotX(-this.elev));
      const pr = 0.027 * ps[i].rad * (1 + (this.hi === i ? 0.35 : 0));
      list.push({ i: i, sx: sx, sy: sy, z: z, L: L, rot: rot, pr: pr });
      this.pos[i] = { x: sx, y: sy, z: z };
    }
    list.sort(function (a, b) { return a.z - b.z; });

    const self = this;
    function drawP(p) {
      const R = 0.6;
      const hp = p.pr * half / R;
      eng.drawPlanet(self.looks[p.i], cx + p.sx * half, cy + p.sy * half, hp, {
        R: R, rot: p.rot, L: p.L, sub: mv(p.rot, p.L), cloudSpin: st.t * 0.01,
        fade: 1, expo: 1.35, time: st.t, clip: clip
      });
    }
    let k = 0;
    while (k < list.length && list[k].z < 0) drawP(list[k++]);
    const starR = 0.05 * half;
    eng.drawStar(cx, cy, starR / 0.16, 0.16, this.starCol, st.t, clip);
    while (k < list.length) drawP(list[k++]);

    /* etiquetas HTML */
    for (let i = 0; i < this.labels.length; i++) {
      const lb = this.labels[i];
      if (!lb) continue;
      const p = this.pos[i];
      const x = r.width / 2 + p.x * halfCss;
      const y = r.height / 2 - p.y * halfCss - (0.027 * ps[i].rad * halfCss + 14);
      lb.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      lb.style.zIndex = p.z > 0 ? 3 : 2;
    }
  };
  EXO.SystemView = SystemView;

  /* =====================================================================
     EpicView: la Tierra real girando, reconstruida con fotos EPIC
     ===================================================================== */
  const D2R = Math.PI / 180;
  function wrap180(d) { return ((d + 540) % 360) - 180; }
  function EpicView(el, epic, onTime) {
    this.el = el;
    this.epic = epic;
    this.onTime = onTime;
    this.active = false;
    this.tau = 6;
    this.speed = 0.3;
    this.vel = 0;
    this.fade = 0;
    this.lastLabel = '';
    const self = this;
    let down = false, lx = 0, lt = 0;
    el.addEventListener('pointerdown', function (e) { down = true; lx = e.clientX; lt = performance.now(); el.setPointerCapture(e.pointerId); el.classList.add('grabbing'); });
    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      const now = performance.now();
      const w = el.getBoundingClientRect().width || 300;
      const d = -(e.clientX - lx) / w * 3.5;
      self.tau += d;
      self.vel = d / Math.max((now - lt) / 1000, 0.008);
      lx = e.clientX; lt = now;
    });
    function up() { down = false; el.classList.remove('grabbing'); }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    this.dragging = function () { return down; };
  }
  EpicView.prototype.render = function (eng, st, vis) {
    if (!eng.tex.ready.epic) return;
    const r = this.el.getBoundingClientRect();
    if (r.width < 2 || r.bottom < -40 || r.top > eng.cssH + 40) return;
    const s = eng.scale;
    const F = this.epic.frames, N = F.length;
    if (!this.dragging()) {
      this.tau += (this.speed * st.motion + this.vel) * st.dt;
      this.vel *= Math.pow(0.05, st.dt);
    }
    this.tau = ((this.tau % N) + N) % N;
    this.fade += (1 - this.fade) * Math.min(1, st.dt * 2);
    const i = Math.floor(this.tau), j = (i + 1) % N, f = this.tau - i;
    const a = F[i], b = F[j];
    const lon = a.lon + wrap180(b.lon - a.lon) * f;
    const lat = a.lat + (b.lat - a.lat) * f;
    const g = this.epic;
    eng.drawEpic((r.left + r.width / 2) * s, eng.H - (r.top + r.height / 2) * s, Math.min(r.width, r.height) / 2 * s, {
      R: 0.9, cur: [lat * D2R, lon * D2R],
      A: [a.lat * D2R, a.lon * D2R, i, g.r], B: [b.lat * D2R, b.lon * D2R, j, g.r],
      geo: [g.cx, g.cy, g.cx, g.cy], f: f, fade: this.fade * (vis === undefined ? 1 : vis)
    });
    if (this.onTime) {
      const ma = +a.t.slice(0, 2) * 60 + +a.t.slice(3), mb0 = +b.t.slice(0, 2) * 60 + +b.t.slice(3);
      const mb = mb0 < ma ? mb0 + 1440 : mb0;
      const m = Math.round(ma + (mb - ma) * f) % 1440;
      const label = String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
      if (label !== this.lastLabel) { this.lastLabel = label; this.onTime(label, lon); }
    }
  };
  EXO.EpicView = EpicView;

  EXO.util = { hexLin: hexLin, starLight: starLight, norm: norm, rotY: rotY, mv: mv };
})();
