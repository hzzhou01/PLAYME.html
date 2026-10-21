/* PLAYME lab kit · playme-3d.js — the exploded 3D view (references/kit.md). Plain classic script; adds PM.layers3d and
 * PM.loadThree to the global PM. Works with or without playme.js (it uses the core's lang/reduced-motion when present).
 *
 *   const view = await PM.layers3d(el, {
 *     layers: [                                    // TOUR order: layer 1 is the first one a guided pass visits
 *       {id: 'screen', label: 'Screen', sub: 'what the reader sees', tint: 'accent', w: 1200, h: 750,
 *        draw(ctx, w, h, state) { … }},           // drawn in logical px; the kit scales the canvas for the screen's DPR
 *       {id: 'photo', label: {en: 'Photo', zh: '照片'}, img: imageOrUrl},
 *     ],
 *     stackOrder: ['ui', 'screen', …],             // PHYSICAL order, top → bottom (default: the layers order)
 *     face: 'screen',                              // the layer explode = 0 shows (default: layers[0]); layers above it
 *                                                  // appear as the stack opens (a translucent UI tree above a screen)
 *     gap: 120,                                    // sheet spacing at explode = 1 in layer px (default: fitted to the view)
 *     tilt: {x: -0.35, y: 0.55},                   // home camera, radians: x = pitch (negative looks down), y = yaw
 *     orbit: true, labels: true, hint: true, explode: 0, background: 'transparent',
 *     onPick(id) {}, onHover(id) {}, onUserCam() {},
 *   });
 *   view.explode(k, {snap, slow}) · view.focus(id|null, {snap}) · view.light(id|null, {snap}) · view.setOpacity(id, a)
 *   view.redraw(id?) · view.reset({snap}) · view.pick(id) · view.hover(id) · view.orbit(dTheta, dPhi) · view.zoom(f)
 *   view.anchors() · view.pickAt(x, y) · view.setVisible(v) · view.relayout() · view.state() · view.dispose()
 *   ({snap: true} sets a state at once: pass it from a player's tween or when ctx.seeking, so seeks land exactly.)
 *
 * The promise resolves once a renderer is attached (three.js, or the CSS fallback). `promise.view` is the same object,
 * available at once, so a part can set its state while three.js is still loading (the state is replayed on attach).
 *
 * Renderer: three.js r160, loaded on demand (window.PM_THREE_SRC inlined by bundle.py --offline → window.PM_THREE_URL →
 * ./vendor/three-0.160.0.module.min.js next to this script → jsDelivr). Each layer is a luminous glass sheet: the
 * painted canvas, a crisp edge line, a faint additive glass tint and a soft additive glow frame, all in the layer's tint.
 * The camera is a custom spherical orbit (no OrbitControls): damped goals, render on demand only.
 * Fallback chain: forced (?pm3d=off, <html data-pm-3d="off">, window.PM_3D = false, opts.renderer = 'css') → WebGL probe
 * → 15 s load timeout → load or renderer failure → WebGL context lost: a CSS preserve-3d stack with the same API (no
 * orbit) and a one-line note. While three.js loads, the composite (explode = 0) is shown as a placeholder. */
(function () {
  'use strict';
  const PM = (window.PM = window.PM || {});
  // captured while the script runs: the vendored three.js is resolved relative to this file
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';
  const THREE_VERSION = '0.160.0';
  const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/+esm`;
  const THREE_VENDOR = `vendor/three-${THREE_VERSION}.module.min.js`;
  const LOAD_TIMEOUT = 15000;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  /* ------------------------------------------------------------------ helpers (standalone; the core is optional) */

  const lang = () => (typeof PM.lang === 'function' ? PM.lang() : /^zh/i.test(document.documentElement.lang || '') ? 'zh' : 'en');
  const tr = (en, zh) => (lang() === 'zh' && zh ? zh : en);
  /** A text value — 'string' | {en, zh} | Node — as a string in the page language. */
  const textOf = (v) => (v == null ? '' : typeof v === 'object' ? (v.nodeType ? v.textContent : tr(v.en, v.zh)) : String(v));
  const reduced = () => {
    if (typeof PM.reduced === 'function') return PM.reduced();
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]motion=reduce\b/.test(location.search); } catch (_) { return false; }
  };
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = Array.isArray(v) ? v.filter(Boolean).join(' ') : v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else e.setAttribute(k, v === true ? '' : String(v));
      }
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : String(c)); });
    return e;
  }
  /** Put a text value into an element (a Node is moved in; strings and {en, zh} follow the page language). */
  function setText(el, v) {
    if (v && v.nodeType) { if (v.parentNode !== el) { el.textContent = ''; el.append(v); } } else el.textContent = textOf(v);
  }
  const STR = {
    reset: ['Reset view', '复位视角'],
    resetAria: ['Reset the camera to the overview', '把视角复位到全景'],
    hint: ['Drag to orbit · Ctrl/⌘ + scroll to zoom', '拖动旋转 · Ctrl/⌘ + 滚轮缩放'],
    hintTouch: ['Swipe sideways to orbit · pinch to zoom', '左右滑动旋转 · 双指缩放'],
    hintShort: ['Drag to orbit', '拖动旋转'],
    hintShortTouch: ['Swipe sideways to orbit · pinch to zoom', '左右滑动旋转 · 双指缩放'],
    loading: ['Loading the 3D view…', '正在加载 3D 视图…'],
    fallback: ['3D is not available in this browser, so the layers are shown as a flat stack.', '当前浏览器无法显示 3D，图层改为平面堆叠展示。'],
    lost: ['The 3D view stopped, so the layers are shown as a flat stack.', '3D 视图已中断，图层改为平面堆叠展示。'],
    role: ['3D view', '3D 视图'],
    labels: ['Layers', '图层'],
  };
  const str = (k) => tr(STR[k][0], STR[k][1]);

  /** Layer tints: a kit tone name → its token (with the default as a fallback for pages without playme.css), or any CSS colour. */
  const TONES = ['accent', 'agent', 'user', 'ok', 'info', 'warn', 'accent-2', 'err'];
  const TONE_DEFAULT = { accent: '#5EEAFF', 'accent-2': '#2BB8FF', agent: '#A98BFF', user: '#FFB454', ok: '#45E3A2', err: '#FF6378', warn: '#FFD25E', info: '#7AA8FF', hi: '#F3F4FA', tx: '#B3B8CC', mu: '#767C93' };
  function tintCss(t, i) {
    const name = t || TONES[i % TONES.length];
    if (TONE_DEFAULT[name]) return `var(--pm-${name}, ${TONE_DEFAULT[name]})`;
    return String(name).replace(/["<>;{}]/g, '');
  }
  /** Any CSS colour (tokens included) → '#rrggbb', resolved inside `within` so the page's tokens apply. */
  function resolveColor(css, within) {
    const probe = h('i', { style: 'position:absolute;width:0;height:0;visibility:hidden' });
    probe.style.color = css;
    within.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    // the canvas normalises every colour syntax (rgb, color(srgb …), oklch …) to bytes
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d');
    x.fillStyle = '#5eeaff';
    x.fillStyle = computed;
    x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data;
    return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function forcedFlat(opts) {
    if (opts.renderer === 'css') return true;
    try { if (new URLSearchParams(location.search).get('pm3d') === 'off') return true; } catch (_) { /* ignore */ }
    if (document.documentElement.getAttribute('data-pm-3d') === 'off') return true;
    return window.PM_3D === false;
  }
  /** Probe WebGL before three.js is involved, so an unsupported browser never constructs a WebGLRenderer. */
  function webglAvailable() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return false;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (_) { return false; }
  }

  /* ------------------------------------------------------------------ three.js loader */

  let threePromise = null;
  /** PM.loadThree() → Promise<THREE namespace> (cached). Sources in order; each failure is a warning, not an error. */
  PM.loadThree = function loadThree() {
    if (threePromise) return threePromise;
    const sources = [];
    if (typeof window.PM_THREE_SRC === 'string' && window.PM_THREE_SRC.length > 1000) {
      sources.push(() => URL.createObjectURL(new Blob([window.PM_THREE_SRC], { type: 'text/javascript' })));
    }
    if (typeof window.PM_THREE_URL === 'string' && window.PM_THREE_URL) sources.push(() => window.PM_THREE_URL);
    // a module cannot be imported from file:// (CORS), so the vendored copy is only tried when the page is served
    if (SCRIPT_SRC && !/^(file|blob|data):/i.test(SCRIPT_SRC)) sources.push(() => new URL(THREE_VENDOR, SCRIPT_SRC).href);
    sources.push(() => THREE_CDN);
    threePromise = (async () => {
      let last = null;
      for (const src of sources) {
        try {
          const THREE = await import(src());
          if (THREE && THREE.WebGLRenderer) return THREE;
        } catch (err) {
          last = err;
          console.warn('[playme-3d] a three.js source failed; trying the next one:', err && err.message);
        }
      }
      throw last || new Error('three.js is not available');
    })();
    return threePromise;
  };

  /* ------------------------------------------------------------------ the model: layers, canvases, physical order */

  async function loadImage(src) {
    if (src && typeof src === 'object' && (src.width || src.naturalWidth)) {
      if (src.decode && !src.complete) await src.decode().catch(() => {});
      return src;
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = typeof PM.asset === 'function' ? PM.asset(String(src)) : String(src);
    await img.decode().catch(() => {});
    return img;
  }

  function buildModel(list, stackOrder, faceId) {
    const layers = list.map((L, i) => {
      const img = L._img || null;
      const w = +L.w || (img && (img.naturalWidth || img.width)) || 1280;
      const hh = +L.h || (img && (img.naturalHeight || img.height)) || 800;
      return {
        id: String(L.id != null ? L.id : `layer-${i + 1}`), i, label: L.label, sub: L.sub,
        w, h: hh, x: L.x, y: L.y, draw: typeof L.draw === 'function' ? L.draw : null, img,
        tintCss: tintCss(L.tint, i), rgb: '#5eeaff', alpha: L.opacity == null ? 1 : clamp(+L.opacity, 0, 1),
        canvas: document.createElement('canvas'), rank: 0,
      };
    });
    const ids = layers.map((L) => L.id);
    // physical order, top → bottom; ids the author left out keep their tour order underneath
    const order = (Array.isArray(stackOrder) ? stackOrder.map(String) : []).filter((id, k, a) => ids.includes(id) && a.indexOf(id) === k);
    ids.forEach((id) => { if (!order.includes(id)) order.push(id); });
    const byId = new Map(layers.map((L) => [L.id, L]));
    order.forEach((id, k) => { byId.get(id).rank = order.length - 1 - k; });   // rank 0 = bottom
    const FW = Math.max(...layers.map((L) => L.w));
    const FH = Math.max(...layers.map((L) => L.h));
    layers.forEach((L) => {
      if (L.x == null) L.x = (FW - L.w) / 2;
      if (L.y == null) L.y = (FH - L.h) / 2;
      L.canvas.className = 'pm-l3d-surface';
      L.canvas.setAttribute('aria-hidden', 'true');
    });
    // the face: the layer explode = 0 shows (default: the first tour layer, the familiar one; R3). Layers physically above
    // it fade in as the stack opens, e.g. a translucent UI tree that sits above the screen (R7.3).
    const face = byId.get(String(faceId)) || layers[0];
    return { layers, byId, order, FW, FH, N: layers.length, top: layers.length - 1, faceRank: face.rank, face: face.id };
  }

  /** Texels per layer px: crisp at the screen's DPR when a layer is focused, capped so six layers stay light on phones. */
  function textureScale(L, override) {
    if (override) return clamp(+override, 0.25, 4);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const narrow = Math.min(window.innerWidth || 1440, document.documentElement.clientWidth || 1440) < 700;
    // a focused sheet fills ~900 css px at most: 0.8 × DPR texels per layer px keeps it sharp at a 1200-px layer
    const s = narrow ? Math.max(1, dpr * 0.8) : Math.max(1.25, dpr * 0.8);
    const cap = narrow ? 1600 : 2048;
    return Math.min(s, cap / Math.max(L.w, L.h));
  }
  function paintLayer(L, scale) {
    const c = L.canvas;
    const cw = Math.max(1, Math.round(L.w * scale));
    const ch = Math.max(1, Math.round(L.h * scale));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(cw / L.w, 0, 0, ch / L.h, 0, 0);
    ctx.save();
    try {
      if (L.draw) L.draw(ctx, L.w, L.h, { id: L.id, lang: lang(), scale: cw / L.w });
      else if (L.img) ctx.drawImage(L.img, 0, 0, L.w, L.h);
    } catch (err) { console.warn(`[playme-3d] layer "${L.id}" failed to draw:`, err); }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  /** The flat composite (what explode = 0 shows): the face and the layers under it, bottom → top, with their opacities. */
  function paintComposite(M, c, maxW) {
    const k = Math.min(1, maxW / M.FW);
    c.width = Math.round(M.FW * k);
    c.height = Math.round(M.FH * k);
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    M.layers.slice().sort((a, b) => a.rank - b.rank).forEach((L) => {
      if (L.rank > M.faceRank) return;
      x.globalAlpha = L.alpha;
      x.drawImage(L.canvas, L.x * k, L.y * k, L.w * k, L.h * k);
    });
    x.globalAlpha = 1;
    return c;
  }

  /* ------------------------------------------------------------------ the WebGL renderer */

  /**
   * createGL(THREE, host, M, cfg) → renderer api. World: the layer frame (FW × FH layer px) lies in the XZ plane, 19.2
   * units wide (top of the frame = −Z); a sheet of rank r sits at height r · gap · smooth(explode), so rank N−1 (the top of
   * the physical stack) is highest. Renders on demand: every change schedules frames until the damped values settle.
   *   cfg: {tilt, gapPx, clear, glow, orbit, focusCamera, reserveRight(), onFrame(), onPick(id|null), onHover(id|null),
   *         onUserCam(), onContextLost(), reduced()}
   */
  function createGL(THREE, host, M, cfg) {
    const U = M.FW / 19.2;               // layer px per world unit
    const PHI_TOP = Math.PI / 2 - 0.0005;
    const PHI_MIN = 0.22;
    const PHI_MAX = PHI_TOP;
    const R_MIN = 8;
    const R_MAX = 160;
    const LIFT = 2.6;                    // extra lift of the sheets above a focused one (out of the way)
    const RISE = 0.55;                   // the focused sheet itself rises a little out of the stack
    const GLOW_M = 0.62;                 // glow margin around a sheet (world units)
    // home pose: low and a little from the right, so each lower sheet shows a band in front of the one above it
    const HOME = { theta: cfg.tilt.y, phi: clamp(-cfg.tilt.x, PHI_MIN + 0.02, 1.45) };
    // a focused sheet is read from higher up, still turned a little so it reads as one sheet of the stack
    const FOCUS = { theta: HOME.theta * 0.3, phi: 1.12 };

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    if (cfg.clear) renderer.setClearColor(new THREE.Color(cfg.clear), 1); else renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.className = 'pm-l3d-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 1, 600);
    const raycaster = new THREE.Raycaster();
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const disposables = [];
    const keep = (o) => { disposables.push(o); return o; };

    function texture(cnv) {
      const t = keep(new THREE.CanvasTexture(cnv));
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      return t;
    }
    function rectGeo(w, hh) {
      const g = keep(new THREE.PlaneGeometry(w, hh));
      g.rotateX(-Math.PI / 2);
      return g;
    }
    function loopGeo(w, hh) {
      const g = keep(new THREE.BufferGeometry());
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, -hh / 2, w / 2, 0, -hh / 2, w / 2, 0, hh / 2, -w / 2, 0, hh / 2], 3));
      return g;
    }
    // one blurred white frame per sheet size, tinted per layer by the material colour (additive)
    const glowCache = new Map();
    function glowTex(W, H) {
      const key = `${W.toFixed(3)}x${H.toFixed(3)}`;
      if (glowCache.has(key)) return glowCache.get(key);
      const ppu = 1024 / (Math.max(W, H) + 2 * GLOW_M);
      const cw = Math.max(16, Math.round(ppu * (W + 2 * GLOW_M)));
      const ch = Math.max(16, Math.round(ppu * (H + 2 * GLOW_M)));
      const c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      const x = c.getContext('2d');
      const m = GLOW_M * ppu;
      x.strokeStyle = '#fff';
      [[m * 0.95, 3, 0.55], [m * 0.42, 2.5, 0.75], [m * 0.14, 2, 0.9]].forEach(([blur, lw, a]) => {
        x.save(); x.shadowColor = '#fff'; x.shadowBlur = blur; x.globalAlpha = a; x.lineWidth = lw;
        x.beginPath(); x.rect(m, m, cw - 2 * m, ch - 2 * m); x.stroke(); x.restore();
      });
      const t = keep(new THREE.CanvasTexture(c));
      t.colorSpace = THREE.SRGBColorSpace;
      glowCache.set(key, t);
      return t;
    }

    /* ---------------------------------------------------------------- sheets */

    const floors = M.layers.map((L) => {
      const W = L.w / U;
      const H = L.h / U;
      const col = new THREE.Color(L.rgb);
      const order = (sub) => L.rank * 10 + sub;   // bottom first: the camera is always above the stack
      const group = new THREE.Group();
      group.name = `pm-l3d-${L.id}`;
      group.position.set((L.x + L.w / 2 - M.FW / 2) / U, 0, (L.y + L.h / 2 - M.FH / 2) / U);
      scene.add(group);
      const tex = texture(L.canvas);
      const sheetMat = keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true }));
      const sheet = new THREE.Mesh(rectGeo(W, H), sheetMat);
      sheet.renderOrder = order(2);
      sheet.userData.id = L.id;
      const fillMat = keep(new THREE.MeshBasicMaterial({ color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.05 }));
      const fill = new THREE.Mesh(rectGeo(W, H), fillMat);
      fill.position.y = -0.004;
      fill.renderOrder = order(1);
      const edgeMat = keep(new THREE.LineBasicMaterial({ color: col, transparent: true, depthWrite: false }));
      const edge = new THREE.LineLoop(loopGeo(W, H), edgeMat);
      edge.position.y = 0.006;
      edge.renderOrder = order(3);
      const glowMat = keep(new THREE.MeshBasicMaterial({ map: glowTex(W, H), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      const glow = new THREE.Mesh(rectGeo(W + 2 * GLOW_M, H + 2 * GLOW_M), glowMat);
      glow.position.y = 0.008;
      glow.renderOrder = order(9);
      group.add(fill, sheet, edge, glow);
      return {
        L, id: L.id, rank: L.rank, group, sheet, glow, tex, sheetMat, fillMat, edgeMat, glowMat, W, H, y: 0, shown: 1,
        op: 1, opGoal: 1, lift: 0, liftGoal: 0, rise: 0, riseGoal: 0, sel: 0, selGoal: 0, hov: 0, hovGoal: 0, a: L.alpha, aGoal: L.alpha,
      };
    });
    const byId = new Map(floors.map((f) => [f.id, f]));
    const FACE = M.faceRank;

    /* ---------------------------------------------------------------- state */

    const st = {
      e: 0, eGoal: 0, focus: null, lit: null, hover: null, peel: null, userCam: false, zoomK: 1, slow: false,
      cam: { theta: 0, phi: PHI_TOP, r: 60, tx: 0, ty: 0, tz: 0 },
      camGoal: { theta: 0, phi: PHI_TOP, r: 60, tx: 0, ty: 0, tz: 0 },
      frames: 0, visible: true, raf: 0, last: 0, w: 1, h: 1, gap: 2.6,
    };
    let disposed = false;

    const floorBase = (f, e) => f.rank * (st.gap * smooth(e) + 0.012);
    const floorY = (f) => floorBase(f, st.e) + (f.lift * LIFT + f.rise * RISE) * smooth(st.e);
    const floorYGoal = (f) => floorBase(f, st.eGoal) + (f.liftGoal * LIFT + f.riseGoal * RISE) * smooth(st.eGoal);

    function goals() {
      const F = st.focus ? byId.get(st.focus) : null;
      // a translucent focused layer is read over the layer under it (R7.3): that one stays fully visible
      const under = F && F.aGoal < 0.95 ? 1 : 0.4;
      floors.forEach((f) => {
        let o = 1;
        if (F) o = f === F ? 1 : f.rank > F.rank ? 0 : f.rank === F.rank - 1 ? under : 0.06;
        // hover-peel from the label column: the sheets above the hovered one fade (only when the stack is apart)
        else if (st.peel && st.eGoal > 0.05 && f.rank > byId.get(st.peel).rank) o = 0.1;
        // a guided pass: the lit sheet stays bright, the others step back
        else if (st.lit && st.eGoal > 0.05) o = f.id === st.lit ? 1 : 0.5;
        f.opGoal = o;
        f.liftGoal = F && f.rank > F.rank ? 1 : 0;
        f.riseGoal = F === f ? 1 : 0;
        f.selGoal = f.id === st.focus || f.id === st.lit ? 1 : 0;
        f.hovGoal = f.id === st.hover && f.selGoal === 0 ? 1 : 0;
      });
    }

    /* ---------------------------------------------------------------- camera */

    function avail() {
      const lw = Math.min(st.w * 0.45, cfg.reserveRight ? cfg.reserveRight() : 0);
      const bottom = cfg.reserveBottom ? cfg.reserveBottom() : 0;
      return { lw, aw: Math.max(40, st.w - lw), ah: Math.max(40, st.h - bottom) };
    }
    function setProjection() {
      const { lw, aw, ah } = avail();
      // taller areas get a taller stack, so the sheets separate instead of leaving the space empty
      const base = 2.75 * Math.sqrt(5 / Math.max(1, M.N - 1));
      st.gap = cfg.gapPx ? cfg.gapPx / U : clamp(base * Math.pow((ah / aw) / 0.72, 0.85), 2.1, 5.2);
      // the projection centre sits in the middle of the area left of the label column
      const shift = lw / 2;
      const fullW = st.w + 2 * shift;
      camera.aspect = fullW / st.h;
      camera.setViewOffset(fullW, st.h, 2 * shift, 0, st.w, st.h);
      camera.updateProjectionMatrix();
    }
    const tmpV = new THREE.Vector3();
    function placeCamera(c, cam = camera) {
      const cp = Math.cos(c.phi);
      const sp = Math.sin(c.phi);
      cam.position.set(c.tx + c.r * cp * Math.sin(c.theta), c.ty + c.r * sp, c.tz + c.r * cp * Math.cos(c.theta));
      cam.up.set(-sp * Math.sin(c.theta), cp, -sp * Math.cos(c.theta));
      cam.lookAt(c.tx, c.ty, c.tz);
      cam.updateMatrixWorld();
    }
    const fitCam = new THREE.PerspectiveCamera();
    const vRight = new THREE.Vector3();
    const vUp = new THREE.Vector3();
    /** Distance and target that frame the points at the given angles, centred in the area left of the labels (9 passes). */
    function fitPose(points, c) {
      fitCam.copy(camera);
      const { aw, ah } = avail();
      const pad = Math.max(14, Math.min(34, Math.min(aw, ah) * 0.06));
      const out = { ...c, r: c.r || 60 };
      for (let i = 0; i < 9; i++) {
        placeCamera(out, fitCam);
        let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
        for (const p of points) {
          tmpV.copy(p).project(fitCam);
          const px = ((tmpV.x + 1) / 2) * st.w;
          const py = ((1 - tmpV.y) / 2) * st.h;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        const k = Math.max((x1 - x0) / (aw - 2 * pad), (y1 - y0) / (ah - 2 * pad));
        const wpp = (2 * out.r * Math.tan((fitCam.fov * Math.PI) / 360)) / st.h;
        const dx = (x0 + x1) / 2 - aw / 2;
        const dy = (y0 + y1) / 2 - ah / 2;
        vRight.setFromMatrixColumn(fitCam.matrixWorld, 0);
        vUp.setFromMatrixColumn(fitCam.matrixWorld, 1);
        out.tx += (vRight.x * dx - vUp.x * dy) * wpp;
        out.ty += (vRight.y * dx - vUp.y * dy) * wpp;
        out.tz += (vRight.z * dx - vUp.z * dy) * wpp;
        out.r = clamp(out.r * clamp(k, 0.55, 1.8), R_MIN, R_MAX);
      }
      return out;
    }
    function corners(list, out = []) {
      list.forEach((f) => {
        const y = floorYGoal(f);
        const { x, z } = f.group.position;
        for (const dx of [-f.W / 2, f.W / 2]) for (const dz of [-f.H / 2, f.H / 2]) for (const dy of [0.05, -0.05]) out.push(new THREE.Vector3(x + dx, y + dy, z + dz));
      });
      return out;
    }
    const focusFloor = () => (st.focus && cfg.focusCamera ? byId.get(st.focus) : null);
    function homeGoal() {
      const e = smooth(st.eGoal);
      const c = { theta: lerp(0, HOME.theta, e), phi: lerp(PHI_TOP, HOME.phi, e), tx: 0, ty: 0, tz: 0, r: st.camGoal.r };
      return fitPose(corners(floors), c);
    }
    function focusGoal(f) {
      const e = smooth(st.eGoal);
      const c = { theta: lerp(0, FOCUS.theta, e), phi: lerp(PHI_TOP, FOCUS.phi, e), tx: f.group.position.x, ty: floorYGoal(f), tz: f.group.position.z, r: st.camGoal.r };
      return fitPose(corners([f]), c);
    }
    function camTarget() { const f = focusFloor(); return f ? focusGoal(f) : homeGoal(); }
    /** After a manual orbit, keep the reader's angles but re-fit distance and target (e.g. when the explode changes). */
    function refitUser() {
      const angles = { theta: st.camGoal.theta, phi: st.camGoal.phi };
      const f = focusFloor();
      Object.assign(st.camGoal, fitPose(corners(f ? [f] : floors), { ...camTarget(), ...angles }));
      // the reader's own zoom (Ctrl/⌘ + scroll, pinch, + / −) is kept across re-fits
      st.camGoal.r = clamp(st.camGoal.r * st.zoomK, R_MIN, R_MAX);
    }
    function retarget({ snap = false, refit = false } = {}) {
      goals();
      if (!st.userCam) Object.assign(st.camGoal, camTarget());
      else if (refit) refitUser();
      if (snap || cfg.reduced()) snapAll();
      invalidate();
    }
    function snapAll() {
      st.e = st.eGoal;
      Object.assign(st.cam, st.camGoal);
      floors.forEach((f) => { f.op = f.opGoal; f.lift = f.liftGoal; f.rise = f.riseGoal; f.sel = f.selGoal; f.hov = f.hovGoal; f.a = f.aGoal; });
    }

    /* ---------------------------------------------------------------- frame */

    function step(dt) {
      if (cfg.reduced()) { snapAll(); return false; }
      const slow = st.slow ? 2.6 : 1;
      const k = 1 - Math.exp(-dt / (110 * slow));
      const kc = 1 - Math.exp(-dt / (150 * slow));
      let moving = false;
      const app = (o, key, goal, kk, eps) => {
        const d = goal - o[key];
        if (Math.abs(d) > eps) { o[key] += d * kk; moving = true; } else o[key] = goal;
      };
      app(st, 'e', st.eGoal, k, 0.0005);
      app(st.cam, 'theta', st.camGoal.theta, kc, 0.0004);
      app(st.cam, 'phi', st.camGoal.phi, kc, 0.0004);
      app(st.cam, 'r', st.camGoal.r, kc, 0.01);
      app(st.cam, 'tx', st.camGoal.tx, kc, 0.002);
      app(st.cam, 'ty', st.camGoal.ty, kc, 0.002);
      app(st.cam, 'tz', st.camGoal.tz, kc, 0.002);
      floors.forEach((f) => {
        app(f, 'op', f.opGoal, k, 0.002); app(f, 'lift', f.liftGoal, k, 0.002); app(f, 'rise', f.riseGoal, k, 0.002);
        app(f, 'sel', f.selGoal, k, 0.004); app(f, 'hov', f.hovGoal, k * 1.5, 0.01); app(f, 'a', f.aGoal, k, 0.002);
      });
      return moving;
    }
    function applyScene() {
      const apart = clamp(st.e * 10, 0, 1);
      floors.forEach((f) => {
        f.y = floorY(f);
        f.group.position.y = f.y;
        // layers physically above the face appear as the stack opens
        const op = f.op * (f.rank > FACE ? clamp(st.e * 8, 0, 1) : 1);
        f.group.visible = op > 0.01;
        f.shown = op;
        // flat (explode 0) the sheets coincide: only the face shows its frame, the rest only add their pixels
        const vis = f.rank === FACE ? 1 : apart;
        const lit = Math.max(f.sel, 0.6 * f.hov);
        // glow carries the state: resting ~0.4 (the flat face glows a little more, like a lit screen), hovered ~0.64, lit 1
        const rest = f.rank === FACE ? lerp(0.62, 0.4, clamp(st.e * 4, 0, 1)) : 0.4;
        const g = op * vis * (rest + (1 - rest) * lit) * cfg.glow;
        f.sheetMat.opacity = op * f.a;
        f.sheet.visible = f.sheetMat.opacity > 0.004;
        f.glowMat.opacity = g;
        f.glow.visible = g > 0.01;
        f.edgeMat.opacity = op * vis * (0.55 + 0.45 * lit);
        f.fillMat.opacity = op * vis * (0.05 + 0.07 * f.sel);
      });
      placeCamera(st.cam);
    }
    function render() {
      applyScene();
      renderer.render(scene, camera);
      st.frames += 1;
      if (cfg.onFrame) cfg.onFrame();
    }
    function frame(now) {
      st.raf = 0;
      if (!st.visible || disposed) return;
      const dt = st.last ? Math.min(64, now - st.last) : 16;
      st.last = now;
      const moving = step(dt);
      render();
      if (moving) st.raf = requestAnimationFrame(frame);
      else { st.last = 0; st.slow = false; }
    }
    function invalidate() {
      if (!st.visible || st.raf || disposed) return;
      st.raf = requestAnimationFrame(frame);
    }

    /* ---------------------------------------------------------------- size */

    function resize() {
      const w = Math.max(1, host.clientWidth);
      const hh = Math.max(1, host.clientHeight);
      if (w === st.w && hh === st.h) return;
      st.w = w; st.h = hh;
      renderer.setSize(w, hh, false);
      setProjection();
      if (!st.userCam) { goals(); Object.assign(st.camGoal, camTarget()); Object.assign(st.cam, st.camGoal); } else refitUser();
      invalidate();
    }
    const ro = new ResizeObserver(() => resize());
    ro.observe(host);

    /* ---------------------------------------------------------------- projection helpers */

    function toScreen(v) {
      tmpV.copy(v).project(camera);
      return { x: ((tmpV.x + 1) / 2) * st.w, y: ((1 - tmpV.y) / 2) * st.h, behind: tmpV.z > 1 };
    }
    const anchorV = new THREE.Vector3();
    /** Leader-line anchor of a sheet: the middle of its right edge (canvas px). */
    function anchor(f) {
      anchorV.set(f.group.position.x + f.W / 2, f.y, f.group.position.z);
      return toScreen(anchorV);
    }

    /* ---------------------------------------------------------------- pointer */

    const ptr = { id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: false, type: 'mouse' };
    const touches = new Map();
    let pinch = 0;
    const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const ndc = new THREE.Vector2();
    /** Alpha of a layer's painted canvas at a texture position (0..255), read from a small cached alpha map
     * (rebuilt after redraw); 255 when the canvas cannot be read (a tainted image). */
    const ALPHA_W = 192;
    function alphaMap(f) {
      if (f.alphaMap !== undefined) return f.alphaMap;
      const c = f.L.canvas;
      f.alphaMap = null;
      if (!c.width || !c.height) return null;
      try {
        const w = ALPHA_W;
        const h = Math.max(1, Math.round((ALPHA_W * c.height) / c.width));
        const m = document.createElement('canvas');
        m.width = w; m.height = h;
        const x = m.getContext('2d', { willReadFrequently: true });
        x.drawImage(c, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data;
        const a = new Uint8Array(w * h);
        for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
        f.alphaMap = { w, h, a };
      } catch (_) { f.alphaMap = null; }
      return f.alphaMap;
    }
    function alphaAt(f, uv) {
      const m = uv ? alphaMap(f) : null;
      if (!m) return 255;
      const x = Math.min(m.w - 1, Math.max(0, Math.floor(uv.x * m.w)));
      const y = Math.min(m.h - 1, Math.max(0, Math.floor((1 - uv.y) * m.h)));
      return m.a[y * m.w + x];
    }
    /** The layer under a view point: the topmost sheet whose canvas is painted there (glass areas let the click
     * through to the content below); on bare glass everywhere, the topmost sheet. */
    function pickAt(p) {
      ndc.set((p.x / st.w) * 2 - 1, -(p.y / st.h) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const cands = floors.filter((f) => f.group.visible && f.shown > 0.2).map((f) => f.sheet);
      const hits = raycaster.intersectObjects(cands, false);
      if (!hits.length) return null;
      for (const hit of hits) {
        const f = byId.get(hit.object.userData.id);
        if (f && alphaAt(f, hit.uv) >= 12) return f.id;
      }
      return hits[0].object.userData.id;
    }
    function setCursor(id) { canvas.style.cursor = id ? 'pointer' : cfg.orbit ? 'grab' : 'default'; }
    function hoverAt(p) {
      const id = pickAt(p);
      if (id !== st.hover) { st.hover = id; goals(); invalidate(); if (cfg.onHover) cfg.onHover(id); }
      setCursor(id);
    }
    let hoverRaf = 0;
    let lastHover = null;
    const pinchDist = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    function startDrag() {
      ptr.moved = true;               // past the threshold: no longer a click, even when orbit is off
      if (!cfg.orbit) return;
      canvas.classList.add('is-dragging');
      if (st.hover) { st.hover = null; goals(); if (cfg.onHover) cfg.onHover(null); }
      if (cfg.onUserCam) cfg.onUserCam();
    }
    function onMove(e) {
      const p = local(e);
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        touches.set(e.pointerId, p);
        if (pinch && touches.size >= 2) {
          const d = pinchDist();
          if (d > 0) { zoomBy(pinch / d); pinch = d; }
          return;
        }
      }
      if (ptr.id === e.pointerId) {
        const dx = p.x - ptr.x;
        const dy = p.y - ptr.y;
        if (!ptr.moved) {
          const ax = Math.abs(p.x - ptr.sx);
          const ay = Math.abs(p.y - ptr.sy);
          if (ptr.type === 'touch') {
            // direction lock: a vertical swipe belongs to the page (touch-action: pan-y); only a clearly horizontal
            // swipe orbits, and nothing about the camera changes until the swipe commits
            if (ay > 8 && ay >= ax) { ptr.id = null; return; }
            if (ax > 10 && ax > ay * 1.2) startDrag();
          } else if (Math.hypot(ax, ay) > 5) startDrag();
        }
        if (ptr.moved && cfg.orbit) {
          st.userCam = true;
          st.camGoal.theta -= dx * 0.008;   // a full turn: the reader can walk round the stack
          if (ptr.type !== 'touch') st.camGoal.phi = clamp(st.camGoal.phi + dy * 0.006, PHI_MIN, PHI_MAX);
          st.cam.theta = st.camGoal.theta;
          st.cam.phi = st.camGoal.phi;
          invalidate();
        }
        ptr.x = p.x; ptr.y = p.y;
        return;
      }
      if (e.pointerType === 'touch') return;
      lastHover = p;
      if (!hoverRaf) hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; if (lastHover) hoverAt(lastHover); });
    }
    function onDown(e) {
      if (e.button != null && e.button > 0) return;
      const p = local(e);
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, p);
        if (touches.size === 2 && cfg.orbit) { pinch = pinchDist(); ptr.id = null; if (cfg.onUserCam) cfg.onUserCam(); return; }
      }
      Object.assign(ptr, { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: false, type: e.pointerType || 'mouse' });
      if (e.pointerType !== 'touch') { try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } }
    }
    function endTouch(e) { touches.delete(e.pointerId); if (touches.size < 2) pinch = 0; }
    function onUp(e) {
      endTouch(e);
      if (ptr.id !== e.pointerId) return;
      const p = local(e);
      const wasClick = !ptr.moved && performance.now() - ptr.t < 700;
      ptr.id = null;
      canvas.classList.remove('is-dragging');
      // after a drag, re-fit the distance for the new angles, so the whole stack stays in view
      if (ptr.moved && cfg.orbit && st.userCam) { refitUser(); if (cfg.reduced()) snapAll(); invalidate(); }
      if (wasClick && cfg.onPick) cfg.onPick(pickAt(p));
    }
    function onCancel(e) { endTouch(e); if (ptr.id === e.pointerId) { ptr.id = null; canvas.classList.remove('is-dragging'); } }
    function onLeave() {
      lastHover = null;
      if (st.hover) { st.hover = null; goals(); invalidate(); if (cfg.onHover) cfg.onHover(null); }
    }
    function onWheel(e) {
      if (!cfg.orbit || !(e.ctrlKey || e.metaKey)) return;   // plain scrolling keeps scrolling the page
      e.preventDefault();
      if (cfg.onUserCam) cfg.onUserCam();
      zoomBy(Math.exp(e.deltaY * 0.0022));
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    const onLost = (e) => { e.preventDefault(); if (!disposed && cfg.onContextLost) cfg.onContextLost(); };
    canvas.addEventListener('webglcontextlost', onLost);
    setCursor(null);

    /* ---------------------------------------------------------------- api */

    function orbitBy(dTheta, dPhi) {
      if (!cfg.orbit) return;
      st.userCam = true;
      st.camGoal.theta += dTheta;
      st.camGoal.phi = clamp(st.camGoal.phi + dPhi, PHI_MIN, PHI_MAX);
      if (cfg.reduced()) Object.assign(st.cam, st.camGoal);
      invalidate();
    }
    function zoomBy(f) {
      if (!cfg.orbit) return;
      st.userCam = true;
      st.camGoal.r = clamp(st.camGoal.r * f, R_MIN, R_MAX);
      st.zoomK = clamp(st.zoomK * f, 0.15, 6);
      if (cfg.reduced()) st.cam.r = st.camGoal.r;
      invalidate();
    }

    const api = {
      kind: 'webgl',
      canvas,
      /** {slow} stretches the damping (a guided "take it apart"); any later change runs at normal speed. */
      setExplode(v, { snap, slow } = {}) { st.eGoal = clamp(v, 0, 1); st.slow = !!slow; retarget({ snap, refit: true }); },
      /** A focused sheet: lit, risen a little; the sheets above lift away and fade; the camera flies to it. */
      setFocus(id, { snap } = {}) {
        st.focus = id && byId.has(id) ? id : null;
        if (st.focus && cfg.focusCamera) { st.userCam = false; st.zoomK = 1; }
        retarget({ snap, refit: true });
      },
      /** Light a sheet (glow + edge) without moving the camera or dimming the others: a guided pass in the overview. */
      setLit(id, { snap } = {}) {
        st.lit = id && byId.has(id) ? id : null;
        goals();
        if (snap || cfg.reduced()) floors.forEach((f) => { f.sel = f.selGoal; f.hov = f.hovGoal; });
        invalidate();
      },
      setAlpha(id, a, { snap } = {}) {
        const f = byId.get(id);
        if (!f) return;
        f.aGoal = clamp(a, 0, 1);
        if (snap || cfg.reduced()) f.a = f.aGoal;
        invalidate();
      },
      /** The overview camera: no focus, no reader zoom. */
      home({ snap } = {}) { st.focus = null; st.userCam = false; st.zoomK = 1; retarget({ snap }); },
      /** The reader takes the camera while a sheet is focused: show the whole stack again, keep the reader's angles. */
      unfocus() {
        if (!st.focus) return;
        st.focus = null; st.peel = null; st.userCam = true;
        goals(); refitUser();
        if (cfg.reduced()) snapAll();
        invalidate();
      },
      hover(id) { const v = id && byId.has(id) ? id : null; if (st.hover === v) return; st.hover = v; goals(); invalidate(); },
      peel(id) { const v = id && byId.has(id) ? id : null; if (st.peel === v) return; st.peel = v; goals(); if (cfg.reduced()) snapAll(); invalidate(); },
      orbitBy, zoomBy,
      /** The id of the sheet drawn at a view point (px), as a click there would pick it; null for empty space. */
      pickAt(x, y) { applyScene(); return pickAt({ x, y }); },
      anchors() { applyScene(); return floors.map((f) => ({ id: f.id, ...anchor(f) })); },
      /** The layer canvases were repainted: upload them again. */
      redraw(ids) { floors.forEach((f) => { if (!ids || ids.includes(f.id)) { f.tex.needsUpdate = true; f.alphaMap = undefined; } }); invalidate(); },
      /** QA: the projected box of one sheet or of the whole stack (canvas px). */
      screenBox(id) {
        applyScene();
        const list = id ? [byId.get(id)].filter(Boolean) : floors;
        let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
        list.forEach((f) => {
          for (const dx of [-f.W / 2, f.W / 2]) for (const dz of [-f.H / 2, f.H / 2]) {
            const q = toScreen(new THREE.Vector3(f.group.position.x + dx, f.y, f.group.position.z + dz));
            x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
          }
        });
        return { x0, x1, y0, y1, w: st.w, h: st.h, avail: avail() };
      },
      /** QA: the screen point of a sheet's centre (canvas px). */
      centerOf(id) { const f = byId.get(id); if (!f) return null; applyScene(); return toScreen(new THREE.Vector3(f.group.position.x, f.y, f.group.position.z)); },
      floorOpacity: (id) => (byId.get(id) ? byId.get(id).shown : 0),
      setVisible(v) {
        st.visible = !!v;
        if (!v && st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; st.last = 0; }
        if (v) { resize(); invalidate(); }
      },
      resize() { st.w = 0; resize(); },
      relayout() { setProjection(); if (!st.userCam) { goals(); Object.assign(st.camGoal, camTarget()); Object.assign(st.cam, st.camGoal); } else refitUser(); invalidate(); },
      renderNow() { render(); },
      state() {
        return {
          kind: 'webgl', explode: st.e, explodeGoal: st.eGoal, focus: st.focus, lit: st.lit, hover: st.hover, userCam: st.userCam,
          frames: st.frames, animating: !!st.raf, visible: st.visible, cam: { ...st.cam }, gap: st.gap,
          pixelRatio: renderer.getPixelRatio(), size: [st.w, st.h],
        };
      },
      dispose() {
        disposed = true;
        if (st.raf) cancelAnimationFrame(st.raf);
        if (hoverRaf) cancelAnimationFrame(hoverRaf);
        ro.disconnect();
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onCancel);
        canvas.removeEventListener('pointerleave', onLeave);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('webglcontextlost', onLost);
        disposables.forEach((o) => { try { o.dispose(); } catch (_) { /* ignore */ } });
        renderer.dispose();
        // free the GPU context at once (not when it is already lost: three.js would warn)
        try { if (!renderer.getContext().isContextLost()) renderer.forceContextLoss(); } catch (_) { /* ignore */ }
        canvas.remove();
      },
    };
    st.w = 0;
    resize();
    // upload the textures and compile the shaders now, while the placeholder still shows, so the first move does not stutter
    try {
      floors.forEach((f) => renderer.initTexture && renderer.initTexture(f.tex));
      placeCamera(st.cam);
      renderer.compile(scene, camera);
    } catch (_) { /* optional warm-up */ }
    return api;
  }

  /* ------------------------------------------------------------------ the CSS fallback (same api, no orbit) */

  /**
   * createFlat(host, M, cfg) → renderer api. The sheets are DOM planes in a preserve-3d stack holding the same canvases.
   * Explode, lift and fit are damped in a small rAF loop (the fit is re-measured each frame, so the leaders follow).
   */
  function createFlat(host, M, cfg) {
    const pct = (v, of) => `${(v / of) * 100}%`;
    const root = h('div', { class: 'pm-l3d-flat' });
    const stack = h('div', { class: 'pm-l3d-flat-stack' });
    const scaler = h('div', { class: 'pm-l3d-flat-scaler' }, stack);
    root.append(scaler);
    host.append(root);
    const st = { e: 0, eGoal: 0, focus: null, lit: null, hover: null, peel: null, frames: 0, visible: true, scale: 1, w: 0, h: 0, base: 0, raf: 0, last: 0 };
    // the home pose in CSS terms: tilt back by the camera's height above the stack, turn by its yaw
    const tiltDeg = clamp(90 - (clamp(-cfg.tilt.x, 0.22, 1.45) * 180) / Math.PI, 30, 58);
    const spinDeg = -clamp((cfg.tilt.y * 180) / Math.PI, -45, 45) * 0.85;

    const floors = M.layers.slice().sort((a, b) => a.rank - b.rank).map((L) => {
      const anchorEl = h('i', { class: 'pm-l3d-flat-anchor', 'aria-hidden': 'true' });
      const sheet = h('div', { class: 'pm-l3d-flat-sheet', 'data-id': L.id });
      Object.assign(sheet.style, { left: pct(L.x, M.FW), top: pct(L.y, M.FH), width: pct(L.w, M.FW), height: pct(L.h, M.FH) });
      sheet.append(L.canvas, anchorEl);
      const el = h('div', { class: 'pm-l3d-flat-floor' }, sheet);
      el.style.setProperty('--pm-l3d-c', L.tintCss);
      el.style.setProperty('--k', String(L.rank));
      stack.append(el);
      sheet.addEventListener('click', (e) => { e.stopPropagation(); if (cfg.onPick) cfg.onPick(L.id); });
      sheet.addEventListener('pointerenter', (e) => { if (e.pointerType === 'touch') return; st.hover = L.id; apply(); if (cfg.onHover) cfg.onHover(L.id); });
      sheet.addEventListener('pointerleave', () => { if (st.hover === L.id) { st.hover = null; apply(); if (cfg.onHover) cfg.onHover(null); } });
      return { L, id: L.id, rank: L.rank, el, sheet, anchorEl, op: 1, lift: 0, liftGoal: 0, a: L.alpha };
    });
    root.addEventListener('click', () => { if (cfg.onPick) cfg.onPick(null); });
    const byId = new Map(floors.map((f) => [f.id, f]));

    function opacityOf(f) {
      const F = st.focus ? byId.get(st.focus) : null;
      if (F) return f === F ? 1 : f.rank > F.rank ? 0 : f.rank === F.rank - 1 ? (F.a < 0.95 ? 1 : 0.45) : 0.08;
      if (st.peel && st.eGoal > 0.05 && f.rank > byId.get(st.peel).rank) return 0.1;
      if (st.lit && st.eGoal > 0.05 && f.id !== st.lit) return 0.5;
      // layers physically above the face appear as the stack opens
      if (f.rank > M.faceRank) return clamp(st.e * 8, 0, 1);
      return 1;
    }
    function apply() {
      root.classList.toggle('is-reduced', cfg.reduced());
      const e = smooth(st.e);
      stack.style.setProperty('--pm-l3d-gap', `${(e * st.gapPx || 0).toFixed(2)}px`);
      stack.style.setProperty('--pm-l3d-tilt', `${(e * tiltDeg).toFixed(2)}deg`);
      stack.style.setProperty('--pm-l3d-spin', `${(e * spinDeg).toFixed(2)}deg`);
      floors.forEach((f) => {
        const o = opacityOf(f);
        const F = st.focus ? byId.get(st.focus) : null;
        f.liftGoal = F && f.rank > F.rank ? 1 : 0;
        f.el.style.opacity = String(o);
        f.el.style.visibility = o < 0.01 ? 'hidden' : '';
        f.el.style.setProperty('--pm-l3d-lift', `${(f.lift * e * st.gapPx * 1.4 + (F === f ? e * st.gapPx * 0.3 : 0)).toFixed(2)}px`);
        f.L.canvas.style.opacity = String(f.a);
        // sheets lifted out of the way let the pointer through to the focused one
        f.sheet.style.pointerEvents = (F && f.rank > F.rank) || o < 0.05 ? 'none' : '';
        f.el.classList.toggle('is-lit', f.id === st.focus || f.id === st.lit);
        f.el.classList.toggle('is-hover', f.id === st.hover);
        f.el.classList.toggle('is-under', f.rank !== M.faceRank && st.e < 0.02);
      });
      st.frames += 1;
    }
    function fitScale() {
      const lw = cfg.reserveRight ? cfg.reserveRight() : 0;
      const top = cfg.reserveTop ? cfg.reserveTop() : 0;
      const aw = Math.max(40, host.clientWidth - lw);
      const ah = Math.max(40, host.clientHeight - top);
      const base = Math.min(aw * 0.86, ah * 0.92 * (M.FW / M.FH));
      st.base = base;
      st.gapPx = cfg.gapPx ? (cfg.gapPx * base) / M.FW : base * 0.12 * Math.sqrt(5 / Math.max(1, M.N - 1));
      stack.style.width = `${base}px`;
      stack.style.height = `${(base * M.FH) / M.FW}px`;
      scaler.style.left = `${aw / 2}px`;
      scaler.style.top = `${top + ah / 2}px`;
      scaler.style.transform = 'none';
      apply();
      const hr = host.getBoundingClientRect();
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      floors.forEach((f) => {
        if (f.el.style.visibility === 'hidden') return;
        const r = f.sheet.getBoundingClientRect();
        if (!r.width) return;
        x0 = Math.min(x0, r.left - hr.left); x1 = Math.max(x1, r.right - hr.left); y0 = Math.min(y0, r.top - hr.top); y1 = Math.max(y1, r.bottom - hr.top);
      });
      if (Number.isFinite(x0)) {
        const pad = Math.max(14, Math.min(34, Math.min(aw, ah) * 0.06));
        const k = clamp(Math.min((aw - 2 * pad) / (x1 - x0), (ah - 2 * pad) / (y1 - y0)), 0.2, 1.6);
        const O = { x: aw / 2, y: top + ah / 2 };
        const C = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
        st.scale = k;
        scaler.style.transform = `translate(${(-k * (C.x - O.x)).toFixed(1)}px, ${(-k * (C.y - O.y)).toFixed(1)}px) scale(${k.toFixed(4)})`;
      }
    }
    function frame(now) {
      st.raf = 0;
      if (!st.visible) return;
      const dt = st.last ? Math.min(64, now - st.last) : 16;
      st.last = now;
      let moving = false;
      if (cfg.reduced()) { st.e = st.eGoal; floors.forEach((f) => { f.lift = f.liftGoal; }); } else {
        const k = 1 - Math.exp(-dt / 110);
        const d = st.eGoal - st.e;
        if (Math.abs(d) > 0.0005) { st.e += d * k; moving = true; } else st.e = st.eGoal;
        floors.forEach((f) => { const dl = f.liftGoal - f.lift; if (Math.abs(dl) > 0.002) { f.lift += dl * k; moving = true; } else f.lift = f.liftGoal; });
      }
      fitScale();
      if (cfg.onFrame) cfg.onFrame();
      if (moving) st.raf = requestAnimationFrame(frame); else st.last = 0;
    }
    function invalidate() { if (st.visible && !st.raf) st.raf = requestAnimationFrame(frame); }
    const ro = new ResizeObserver(() => {
      if (host.clientWidth === st.w && host.clientHeight === st.h) return;
      st.w = host.clientWidth; st.h = host.clientHeight;
      fitScale(); if (cfg.onFrame) cfg.onFrame();
    });
    ro.observe(host);
    function center(el) {
      const r = el.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      return { x: r.left + r.width / 2 - hr.left, y: r.top + r.height / 2 - hr.top, behind: false };
    }
    const snapNow = () => { st.e = st.eGoal; floors.forEach((f) => { f.liftGoal = st.focus && byId.get(st.focus) && f.rank > byId.get(st.focus).rank ? 1 : 0; f.lift = f.liftGoal; }); fitScale(); if (cfg.onFrame) cfg.onFrame(); };

    const api = {
      kind: 'css',
      setExplode(v, { snap } = {}) { st.eGoal = clamp(v, 0, 1); if (snap) snapNow(); else { apply(); invalidate(); } },
      setFocus(id, { snap } = {}) { st.focus = id && byId.has(id) ? id : null; apply(); if (snap) snapNow(); else invalidate(); },
      setLit(id) { st.lit = id && byId.has(id) ? id : null; apply(); if (cfg.onFrame) cfg.onFrame(); },
      setAlpha(id, a) { const f = byId.get(id); if (!f) return; f.a = clamp(a, 0, 1); apply(); },
      home({ snap } = {}) { api.setFocus(null, { snap }); },
      unfocus() { api.setFocus(null); },
      hover(id) { st.hover = id && byId.has(id) ? id : null; apply(); },
      peel(id) { const v = id && byId.has(id) ? id : null; if (st.peel === v) return; st.peel = v; apply(); },
      orbitBy() {}, zoomBy() {},
      pickAt(x, y) {
        const hr = host.getBoundingClientRect();
        const el = document.elementFromPoint(hr.left + x, hr.top + y);
        const sheet = el && el.closest && el.closest('.pm-l3d-flat-sheet');
        return sheet && root.contains(sheet) ? sheet.getAttribute('data-id') : null;
      },
      anchors() { return M.layers.map((L) => ({ id: L.id, ...center(byId.get(L.id).anchorEl) })); },
      redraw() { /* the canvases are in the DOM: repainting them is enough */ },
      screenBox(id) {
        const hr = host.getBoundingClientRect();
        let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
        floors.filter((f) => !id || f.id === id).forEach((f) => {
          const r = f.sheet.getBoundingClientRect();
          x0 = Math.min(x0, r.left - hr.left); x1 = Math.max(x1, r.right - hr.left); y0 = Math.min(y0, r.top - hr.top); y1 = Math.max(y1, r.bottom - hr.top);
        });
        return { x0, x1, y0, y1, w: host.clientWidth, h: host.clientHeight };
      },
      centerOf(id) { const f = byId.get(id); return f ? center(f.sheet) : null; },
      floorOpacity: (id) => (byId.get(id) ? Number(byId.get(id).el.style.opacity || 1) : 0),
      setVisible(v) { st.visible = !!v; if (v) { fitScale(); if (cfg.onFrame) cfg.onFrame(); invalidate(); } },
      resize() { fitScale(); if (cfg.onFrame) cfg.onFrame(); },
      relayout() { fitScale(); if (cfg.onFrame) cfg.onFrame(); },
      renderNow() { fitScale(); if (cfg.onFrame) cfg.onFrame(); },
      state() {
        return { kind: 'css', explode: st.e, explodeGoal: st.eGoal, focus: st.focus, lit: st.lit, hover: st.hover, userCam: false, frames: st.frames, animating: !!st.raf, visible: st.visible, scale: st.scale };
      },
      dispose() { if (st.raf) cancelAnimationFrame(st.raf); ro.disconnect(); root.remove(); },
      el: root,
    };
    fitScale();
    return api;
  }

  /* ------------------------------------------------------------------ PM.layers3d: DOM, labels, leaders, fallback chain */

  /**
   * PM.layers3d(host, opts) → Promise<view> (also `promise.view`, available at once).
   * opts: layers (required), stackOrder, face, gap, tilt {x, y}, orbit (true), labels (true), hint (true), explode (0),
   *       background ('transparent' | CSS colour), glow (1), focusCamera (true), pickFocus (true), aspect (16 / 9),
   *       height (px or CSS length, instead of the aspect ratio), labelWidth (px, max 244), compactBelow (640),
   *       textureScale (texels per layer px), ariaLabel, labelsTitle, redrawOnLang (true), renderer ('auto' | 'css'),
   *       onPick(id, how), onHover(id|null), onFocus(id|null), onUserCam().
   */
  PM.layers3d = function layers3d(host, opts) {
    opts = opts || {};
    if (!host || !Array.isArray(opts.layers) || !opts.layers.length) throw new Error('PM.layers3d(el, {layers: [...]}) needs a host element and at least one layer');
    const LIST = opts.layers;
    const ids = LIST.map((L, i) => String(L.id != null ? L.id : `layer-${i + 1}`));
    const tilt = { x: -0.35, y: 0.55, ...(opts.tilt || {}) };
    const labelsOn = opts.labels !== false;
    const orbitOn = opts.orbit !== false;
    const S = {
      renderer: null, M: null, explode: clamp(+opts.explode || 0, 0, 1), focus: null, lit: null, hover: null, hoverLabel: null,
      alpha: {}, compact: false, visible: true, mounted: true, fallbackReason: null, usedCam: false, fonts: 0,
    };
    LIST.forEach((L, i) => { S.alpha[ids[i]] = L.opacity == null ? 1 : clamp(+L.opacity, 0, 1); });
    const known = (id) => id != null && ids.includes(String(id));

    /* ------------------------------------------------------------ DOM */

    const root = h('div', { class: 'pm-l3d', 'data-renderer': 'loading' });
    if (!host.closest('.pm')) root.classList.add('pm');
    const viewEl = h('div', { class: 'pm-l3d-view', tabindex: '0', role: 'group' });
    if (opts.aspect) viewEl.style.setProperty('--pm-l3d-aspect', String(opts.aspect));
    if (opts.height) { viewEl.style.height = typeof opts.height === 'number' ? `${opts.height}px` : opts.height; viewEl.classList.add('is-sized'); }
    if (opts.background && opts.background !== 'transparent') { viewEl.style.background = opts.background; viewEl.classList.add('has-bg'); }
    const placeholder = h('div', { class: 'pm-l3d-placeholder' });
    const phCanvas = h('canvas', { class: 'pm-l3d-phimg', 'aria-hidden': 'true' });
    const loadingEl = h('p', { class: 'pm-l3d-loading', 'aria-hidden': 'true' });
    placeholder.append(phCanvas, loadingEl);
    const leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    leaders.setAttribute('class', 'pm-l3d-leaders');
    leaders.setAttribute('aria-hidden', 'true');
    const resetBtn = h('button', { type: 'button', class: 'pm-l3d-reset', hidden: true, onClick: () => { api.reset(); viewEl.focus({ preventScroll: true }); } },
      h('span', { class: 'pm-l3d-reset-ico', 'aria-hidden': 'true' }), h('span', { class: 'pm-l3d-reset-text' }));
    // a counter-clockwise arrow round a dot: "back to the overview"
    resetBtn.firstChild.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 6.2A5.2 5.2 0 1 1 3 9.6"/><path d="M2.6 2.8v3.6h3.6"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/></svg>';
    const hintEl = h('p', { class: 'pm-l3d-hint', 'aria-hidden': 'true', hidden: true });
    const noteEl = h('p', { class: 'pm-l3d-note', hidden: true });
    const labelsBox = h('div', { class: 'pm-l3d-labels', role: 'group' });
    // DOM order = keyboard order: the corner button comes before the label column
    viewEl.append(placeholder, leaders, resetBtn, hintEl, noteEl);
    if (labelsOn) viewEl.append(labelsBox);
    const legend = h('p', { class: 'pm-l3d-legend', 'aria-hidden': 'true' });
    root.append(viewEl);
    if (labelsOn) root.append(legend);
    host.append(root);

    /* ------------------------------------------------------------ labels = the in-scene list of layers (targets) */

    const labelEls = LIST.map((L, i) => {
      const id = ids[i];
      const name = h('span', { class: 'pm-l3d-name' });
      const sub = L.sub != null ? h('span', { class: 'pm-l3d-sub' }) : null;
      const b = h('button', { type: 'button', class: 'pm-l3d-label', 'data-id': id },
        h('span', { class: 'pm-l3d-badge', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'pm-l3d-labeltext' }, name, sub));
      b.style.setProperty('--pm-l3d-c', tintCss(L.tint, i));
      b.addEventListener('click', () => pick(id, 'label'));
      b.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') hoverLabel(id); });
      b.addEventListener('pointerleave', () => hoverLabel(null));
      b.addEventListener('focus', () => hoverLabel(id));
      b.addEventListener('blur', () => hoverLabel(null));
      b._name = name; b._sub = sub;
      labelsBox.append(b);
      return b;
    });
    const legendItems = LIST.map((L, i) => {
      const it = h('span', { class: 'pm-l3d-legenditem' }, h('span', { class: 'pm-l3d-legendnum' }, String(i + 1)), h('span', { class: 'pm-l3d-legendname' }));
      it.style.setProperty('--pm-l3d-c', tintCss(L.tint, i));
      legend.append(it);
      return it;
    });

    const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } };
    /** Every text in the kit's own language (labels, hint, reset, note, aria). Called again on a language change. */
    function renderText() {
      labelEls.forEach((b, i) => {
        const L = LIST[i];
        setText(b._name, L.label);
        if (b._sub) setText(b._sub, L.sub);
        b.setAttribute('aria-label', `${i + 1}: ${textOf(L.label)}${L.sub != null ? ` · ${textOf(L.sub)}` : ''}`);
        const ln = legendItems[i].lastChild;
        ln.textContent = '';
        ln.append(L.label && L.label.nodeType ? L.label.cloneNode(true) : textOf(L.label));
      });
      labelsBox.setAttribute('aria-label', textOf(opts.labelsTitle) || str('labels'));
      resetBtn.lastChild.textContent = str('reset');
      resetBtn.setAttribute('aria-label', str('resetAria'));
      resetBtn.title = str('resetAria');
      hintEl.textContent = S.compact ? (coarse() ? str('hintShortTouch') : str('hintShort')) : coarse() ? str('hintTouch') : str('hint');
      loadingEl.textContent = str('loading');
      viewEl.setAttribute('aria-roledescription', str('role'));
      const n = LIST.length;
      viewEl.setAttribute('aria-label', textOf(opts.ariaLabel) || tr(
        `Exploded view of ${n} layers. ${orbitOn ? 'Arrow keys turn it, + and − zoom, 0 resets. ' : ''}Keys 1 to ${n} pick a layer.`,
        `${n} 个图层的拆解视图。${orbitOn ? '方向键旋转，+ 和 − 缩放，0 复位。' : ''}数字键 1 到 ${n} 选择图层。`));
      if (S.fallbackReason) noteEl.textContent = S.fallbackReason === 'lost' ? str('lost') : str('fallback');
    }
    function renderLabels() {
      labelEls.forEach((b, i) => {
        const id = ids[i];
        b.setAttribute('aria-pressed', String(S.focus === id));
        b.classList.toggle('is-lit', S.lit === id);
        b.classList.toggle('is-hover', S.hover === id && S.hoverLabel !== id);
      });
    }

    /* ------------------------------------------------------------ label column (fixed) + leader lines (after each frame) */

    // The column is laid out once per size / language, never per frame: the labels stay put while the camera flies, so
    // nothing moves under the reader's pointer; only the leader lines follow the sheets. Rows follow the PHYSICAL order
    // (top sheet first), so no two leader lines cross; the badges keep the tour numbers.
    const LAY = { key: '', x: 0, lw: 0, ys: [], hs: [] };
    function labelWidth() {
      if (!labelsOn) return 0;
      if (S.compact) return 34;
      return Math.round(clamp(viewEl.clientWidth * 0.25, 176, opts.labelWidth || 244));
    }
    const reserveRight = () => (labelsOn ? labelWidth() + (S.compact ? 14 : 26) : 0);
    function layoutLabels() {
      if (!labelsOn) return;
      const W = viewEl.clientWidth;
      const H = viewEl.clientHeight;
      if (!W || !H) return;
      const key = `${W}x${H}|${lang()}|${S.compact}|${S.fonts}`;
      if (key === LAY.key) return;
      LAY.key = key;
      viewEl.style.setProperty('--pm-l3d-reserve', `${reserveRight()}px`);
      const lw = labelWidth();
      const x = W - lw - (S.compact ? 8 : 12);
      labelsBox.classList.remove('is-names');
      labelEls.forEach((b) => { b.style.width = `${lw}px`; });
      const n = labelEls.length;
      const top = 12;
      const bottom = H - 12;
      const sum = (a) => a.reduce((s, v) => s + v, 0);
      let hs = labelEls.map((b) => b.offsetHeight);
      let gap = S.compact ? 6 : 8;
      if (!S.compact && sum(hs) + (n - 1) * gap > bottom - top) { labelsBox.classList.add('is-names'); hs = labelEls.map((b) => b.offsetHeight); }
      if (sum(hs) + (n - 1) * gap > bottom - top) gap = Math.max(2, (bottom - top - sum(hs)) / Math.max(1, n - 1));
      let y = top + Math.max(0, (bottom - top - sum(hs) - (n - 1) * gap) / 2);
      const ys = new Array(n);
      const order = S.M ? S.M.order : ids;
      order.forEach((id) => { const i = ids.indexOf(id); ys[i] = y; y += hs[i] + gap; });
      Object.assign(LAY, { x, lw, ys, hs });
      labelEls.forEach((b, i) => { b.style.transform = `translate(${Math.round(x)}px, ${Math.round(ys[i])}px)`; });
    }
    let lastSvg = '';
    function drawLeaders() {
      syncChrome();
      if (!labelsOn) return;
      layoutLabels();
      const R = S.renderer;
      if (!R) return;
      const W = viewEl.clientWidth;
      const H = viewEl.clientHeight;
      const anchors = R.anchors();
      const st0 = R.state();
      const x = LAY.x;
      let svg = '';
      LIST.forEach((L, i) => {
        const id = ids[i];
        const a = anchors[i];
        const Lm = S.M.byId.get(id);
        const on = id === S.hover || id === st0.focus || id === S.lit;
        // in a focused view the other sheets bunch up: draw the focused and the hovered leaders only
        if (st0.focus && id !== st0.focus && id !== S.hover) return;
        // flat: every sheet shares one plane and the anchors coincide; only the face's line means something
        if (st0.explode < 0.02 && Lm.rank !== S.M.faceRank && id !== S.hover) return;
        const ly = (LAY.ys[i] + LAY.hs[i] / 2).toFixed(1);
        const cls = `${on ? 'is-on' : ''}${id === S.lit ? ' is-lit' : ''}`;
        const style = `--pm-l3d-c:${Lm.tintCss}`;
        const r = on ? 3.6 : 2.6;
        if (!a || a.behind || !Number.isFinite(a.x) || !Number.isFinite(a.y) || a.y < 0 || a.y > H || a.x < 0 || a.x > x - 14) {
          // the focused sheet can fill the view: a short level line from its label points into it
          if (id === st0.focus && st0.explode > 0.5) {
            svg += `<path class="${cls}" style="${style}" d="M${x - 2} ${ly}H${x - 40}"/><circle class="${cls}" style="${style}" cx="${x - 40}" cy="${ly}" r="${r}"/>`;
          }
          return;
        }
        svg += `<path class="${cls}" style="${style}" d="M${x - 2} ${ly}H${x - 12}L${a.x.toFixed(1)} ${a.y.toFixed(1)}"/>`;
        svg += `<circle class="${cls}" style="${style}" cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="${r}"/>`;
      });
      if (svg !== lastSvg) { leaders.innerHTML = svg; lastSvg = svg; }
      leaders.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }
    /** The reset button shows once the camera left the overview; the hint until the reader first moves the camera. */
    function syncChrome() {
      const R = S.renderer;
      const st0 = R ? R.state() : null;
      const moved = !!(st0 && (st0.userCam || (st0.focus && S.focusByReader)));
      if (resetBtn.hidden === moved) resetBtn.hidden = !moved;
      const hint = !!(opts.hint !== false && orbitOn && R && R.kind === 'webgl' && !S.usedCam);
      if (hintEl.hidden === hint) hintEl.hidden = !hint;
    }

    /* ------------------------------------------------------------ interaction */

    function hoverLabel(id) {
      S.hoverLabel = id;
      S.hover = id;
      const R = S.renderer;
      if (R) {
        R.hover(id);
        // peel the sheets above a hovered label (overview only: a focused view already shows one sheet)
        R.peel(!S.focus && S.explode > 0.05 ? id : null);
      }
      renderLabels();
      drawLeaders();
      if (opts.onHover) opts.onHover(id);
    }
    /** A reader picks a layer (label, sheet, number key): the stack comes apart if it is flat, the layer is focused. */
    function pick(id, how) {
      if (id == null) {   // a click on empty space
        if (S.focus && opts.pickFocus !== false) api.focus(null);
        return;
      }
      if (!known(id)) return;
      if (opts.pickFocus !== false) {
        if (S.explode < 0.25) api.explode(1);
        api.focus(id, { byReader: true });
      }
      if (opts.onPick) opts.onPick(String(id), how || 'click');
    }
    /** The reader takes the camera (drag, pinch, Ctrl/⌘ + scroll, keys): open the stack if it is flat, leave a focused
     * layer for the whole stack (keeping the reader's angles), and tell the part (it may pause a running player). */
    function onUserCam() {
      S.usedCam = true;
      if (S.explode < 0.25) api.explode(1);
      if (S.focus && S.renderer) { S.focus = null; S.renderer.unfocus(); renderLabels(); if (opts.onFocus) opts.onFocus(null); }
      if (opts.onUserCam) opts.onUserCam();
      drawLeaders();
    }
    viewEl.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target !== viewEl && !(e.target.classList && e.target.classList.contains('pm-l3d-label'))) return;
      const R = S.renderer;
      let used = true;
      const cam = /^(Arrow(Left|Right|Up|Down)|[+=_-])$/.test(e.key);
      if (cam && (!orbitOn || !R || R.kind !== 'webgl')) used = false;
      else if (cam) {
        onUserCam();
        if (e.key === 'ArrowLeft') R.orbitBy(-0.12, 0);
        else if (e.key === 'ArrowRight') R.orbitBy(0.12, 0);
        else if (e.key === 'ArrowUp') R.orbitBy(0, 0.08);
        else if (e.key === 'ArrowDown') R.orbitBy(0, -0.08);
        else if (e.key === '+' || e.key === '=') R.zoomBy(1 / 1.15);
        else R.zoomBy(1.15);
      } else if (e.key === '0') api.reset();
      else if (/^[1-9]$/.test(e.key) && Number(e.key) <= ids.length) pick(ids[Number(e.key) - 1], 'key');
      else if (e.key === 'Escape' && S.focus) api.focus(null);
      else used = false;
      if (used) { e.preventDefault(); drawLeaders(); }
    });

    /* ------------------------------------------------------------ renderer life cycle */

    const cfg = {
      tilt, orbit: orbitOn, gapPx: +opts.gap || 0, glow: opts.glow == null ? 1 : clamp(+opts.glow, 0, 2),
      focusCamera: opts.focusCamera !== false, clear: null, reserveRight, reduced,
      // a fixed strip for the hint (fixed, so the stack does not move when the hint goes away); the note of the fallback
      reserveBottom: () => (opts.hint !== false && orbitOn ? 22 : 0),
      reserveTop: () => (noteEl.hidden ? 0 : noteEl.offsetHeight + 16),
      onFrame: drawLeaders,
      onPick: (id) => pick(id, 'click'),
      onHover: (id) => {
        if (S.hoverLabel) return;   // a hovered label wins over the canvas
        S.hover = id; renderLabels(); drawLeaders();
        if (opts.onHover) opts.onHover(id);
      },
      onUserCam,
      onContextLost: () => useFallback('lost'),
    };
    function attach(R) {
      S.renderer = R;
      root.dataset.renderer = R.kind;
      viewEl.classList.add('is-ready');
      placeholder.hidden = true;
      ids.forEach((id) => R.setAlpha(id, S.alpha[id], { snap: true }));
      R.setLit(S.lit, { snap: true });
      R.setExplode(S.explode, { snap: true });
      R.setFocus(S.focus, { snap: true });
      R.setVisible(true);
      R.renderNow();
      R.setVisible(S.visible);
      drawLeaders();
    }
    function useFallback(reason) {
      if (!S.mounted) return;
      S.fallbackReason = reason;
      if (S.renderer) { try { S.renderer.dispose(); } catch (_) { /* ignore */ } S.renderer = null; }
      viewEl.classList.add('is-flat');
      noteEl.hidden = false;
      renderText();
      const R = createFlat(viewEl, S.M, cfg);
      viewEl.insertBefore(R.el, leaders);
      attach(R);
    }
    function repaint(only) {
      const M = S.M;
      M.layers.forEach((L) => { if (!only || only.includes(L.id)) paintLayer(L, L.scale); });
      M.layers.forEach((L) => { L.alpha = S.alpha[L.id]; });
      paintComposite(M, phCanvas, 1400);
    }
    async function start() {
      const list = await Promise.all(LIST.map(async (L) => ({ ...L, _img: L.img ? await loadImage(L.img) : null })));
      if (!S.mounted) return api;
      const M = buildModel(list, opts.stackOrder, opts.face);
      S.M = M;
      M.layers.forEach((L) => { L.rgb = resolveColor(L.tintCss, root); L.scale = textureScale(L, opts.textureScale); });
      repaint();
      // the composite placeholder glows in the face's tint
      phCanvas.style.setProperty('--pm-l3d-c', M.byId.get(M.face).tintCss);
      LAY.key = '';
      drawLeaders();
      // canvas text uses the page's web fonts: paint again once they are in (the label column is re-laid out too)
      if (document.fonts && document.fonts.status !== 'loaded') {
        document.fonts.ready.then(() => { if (!S.mounted) return; S.fonts += 1; repaint(); if (S.renderer) S.renderer.redraw(); drawLeaders(); });
      }
      if (opts.background && opts.background !== 'transparent') cfg.clear = resolveColor(opts.background, root);
      if (forcedFlat(opts)) { useFallback('forced'); return api; }
      if (!webglAvailable()) { useFallback('webgl'); return api; }
      await new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => { if (done) return; done = true; useFallback('timeout'); resolve(); }, LOAD_TIMEOUT);
        PM.loadThree().then((THREE) => {
          if (done) return;
          done = true; clearTimeout(timer);
          if (!S.mounted) { resolve(); return; }
          try {
            const R = createGL(THREE, viewEl, M, cfg);
            viewEl.insertBefore(R.canvas, leaders);
            attach(R);
          } catch (err) {
            console.warn('[playme-3d] WebGL renderer failed; showing the flat stack:', err && err.message);
            useFallback('webgl');
          }
          resolve();
        }).catch((err) => {
          if (done) return;
          done = true; clearTimeout(timer);
          console.warn('[playme-3d] three.js did not load; showing the flat stack:', err && err.message);
          useFallback('load');
          resolve();
        });
      });
      return api;
    }

    /* ------------------------------------------------------------ the view api */

    const api = {
      el: root,
      view: viewEl,
      get kind() { return S.renderer ? S.renderer.kind : 'loading'; },
      /** explode(k 0..1, {snap, slow}): animated (damped) unless snap or reduced motion. */
      explode(k, o = {}) {
        S.explode = clamp(+k || 0, 0, 1);
        if (S.renderer) S.renderer.setExplode(S.explode, o);
        drawLeaders();
        return api;
      },
      /** focus(id|null, {snap}): the layer lights and rises, the others dim, the layers above lift away; the camera flies
       * to it (opts.focusCamera). focus(null) returns to the overview. */
      focus(id, o = {}) {
        const v = known(id) ? String(id) : null;
        const changed = v !== S.focus;
        S.focus = v;
        S.focusByReader = !!(v && o.byReader);   // a scripted tour's focus does not show "Reset view"
        if (S.renderer) { S.renderer.setFocus(v, o); if (v) S.renderer.peel(null); }
        renderLabels();
        drawLeaders();
        if (changed && opts.onFocus) opts.onFocus(v);
        return api;
      },
      /** light(id|null, {snap}): highlight one layer (glow, label, travelling leader) without moving the camera — a
       * guided pass. Pass {snap: ctx.seeking} from a player so a seek shows the final glow at once. */
      light(id, o = {}) {
        S.lit = known(id) ? String(id) : null;
        if (S.renderer) S.renderer.setLit(S.lit, o);
        renderLabels();
        drawLeaders();
        return api;
      },
      /** setOpacity(id, a 0..1, {snap}): a translucent layer shows the layers under it (R7.3). */
      setOpacity(id, a, o = {}) {
        if (!known(id)) return api;
        S.alpha[String(id)] = clamp(+a, 0, 1);
        if (S.renderer) S.renderer.setAlpha(String(id), S.alpha[String(id)], o);
        if (S.M) { S.M.byId.get(String(id)).alpha = S.alpha[String(id)]; paintComposite(S.M, phCanvas, 1400); }
        return api;
      },
      /** redraw(id?): call draw() again (all layers, or one) and upload the result, e.g. after a language change. */
      redraw(id) {
        if (!S.M) return api;
        const only = id == null ? null : [].concat(id).map(String);
        repaint(only);
        if (S.renderer) S.renderer.redraw(only);
        return api;
      },
      /** reset({snap}): the overview camera (no focus, no reader zoom); explode and opacities stay. */
      reset(o = {}) {
        const had = S.focus;
        S.focus = null;
        if (S.renderer) S.renderer.home(o);
        renderLabels();
        drawLeaders();
        if (had && opts.onFocus) opts.onFocus(null);
        return api;
      },
      hover(id) { hoverLabel(known(id) ? String(id) : null); return api; },
      pick(id) { pick(known(id) ? String(id) : null, 'api'); return api; },
      orbit(dTheta, dPhi) { if (S.renderer) { onUserCam(); S.renderer.orbitBy(+dTheta || 0, +dPhi || 0); } return api; },
      zoom(f) { if (S.renderer && +f > 0) { onUserCam(); S.renderer.zoomBy(+f); } return api; },
      /** pickAt(x, y) → id | null: the layer a click at this view point (px) would pick (e.g. for your own tooltip). */
      pickAt(x, y) { return S.renderer ? S.renderer.pickAt(+x, +y) : null; },
      /** anchors() → [{id, x, y, behind}] in view px: the middle of each sheet's right edge (for your own leader lines). */
      anchors() { return S.renderer ? S.renderer.anchors() : []; },
      setVisible(v) { S.visible = !!v; if (S.renderer) S.renderer.setVisible(S.visible); return api; },
      relayout() { LAY.key = ''; if (S.renderer) S.renderer.relayout(); drawLeaders(); return api; },
      state() {
        const r = S.renderer ? S.renderer.state() : {};
        return {
          kind: S.renderer ? S.renderer.kind : 'loading', explode: S.explode, focus: S.focus, lit: S.lit, hover: S.hover,
          opacity: { ...S.alpha }, compact: S.compact, fallbackReason: S.fallbackReason, resetVisible: !resetBtn.hidden,
          hintVisible: !hintEl.hidden, renderer: r,
        };
      },
      /** QA helpers: where a layer's sheet is on screen (view px), and the label column as laid out. */
      centerOf(id) { return S.renderer && S.renderer.centerOf ? S.renderer.centerOf(String(id)) : null; },
      screenBox(id) { return S.renderer && S.renderer.screenBox ? S.renderer.screenBox(id == null ? null : String(id)) : null; },
      labelLayout() { return { x: LAY.x, lw: LAY.lw, ys: LAY.ys.slice(), hs: LAY.hs.slice() }; },
      /** QA: the attached renderer (webgl or css), e.g. renderer().floorOpacity(id). */
      renderer() { return S.renderer; },
      dispose() {
        S.mounted = false;
        ro.disconnect();
        io.disconnect();
        offLang();
        if (S.renderer) { try { S.renderer.dispose(); } catch (_) { /* ignore */ } }
        S.renderer = null;
        root.remove();
      },
    };

    /* ------------------------------------------------------------ size, visibility, language */

    const ro = new ResizeObserver(() => {
      // narrow views: badges in the column and a legend under the view instead of named labels
      const compact = root.clientWidth < (opts.compactBelow || 640);
      if (compact !== S.compact) {
        S.compact = compact;
        root.classList.toggle('is-compact', compact);
        LAY.key = '';
        renderText();
        if (S.renderer) S.renderer.relayout();
      }
      drawLeaders();
    });
    ro.observe(root);
    ro.observe(viewEl);
    // render only while on screen
    const io = new IntersectionObserver((entries) => {
      const v = entries.some((en) => en.isIntersecting);
      if (v === S.visible) return;
      S.visible = v;
      if (S.renderer) S.renderer.setVisible(v);
    }, { rootMargin: '120px' });
    io.observe(viewEl);
    const langMo = new MutationObserver(() => {
      renderText();
      LAY.key = '';
      if (opts.redrawOnLang !== false) api.redraw();
      drawLeaders();
    });
    langMo.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const offLang = () => langMo.disconnect();

    renderText();
    renderLabels();
    const ready = start();
    ready.view = api;
    root.pmLayers3d = api;
    return ready;
  };
})();
