/* PLAYME kit — devices (playme-desk.js): realistic device frames for lab scenes.
 *
 * Readers should recognise a device without a label (rule R10): a Mac laptop or display with a menubar,
 * wallpaper and dock; macOS windows with traffic lights; a browser with tabs and an address bar; an Android
 * phone with a punch-hole camera and a gesture bar; a terminal. Everything a scene moves is laid out in
 * LOGICAL pixels (a Mac is 1280×800, a phone 360×780 dp) and scaled to its container with one CSS transform,
 * so the code shown to readers can use the coordinates the scene uses.
 *
 * Players are pure functions of time (PM.player re-runs a story to seek), so every state here can be set
 * instantly: pointer.set(x, y), desk.raise(id), desk.order([...]), desk.restore(snapshot),
 * pointer.ripple(k), desk.flash(target, tone, k). Motion that is only polish (the one-shot ripple of
 * pointer.click, one-shot flashes, the toast slide-in, pointer.moveTo) is skipped while a player measures or
 * seeks (.pm-measuring / .pm-seeking on an ancestor) and under reduced motion.
 *
 *   PM.device.mac(el, opts)        → {el, screen, desk}     desktop: menubar, wallpaper, dock, windows, pointers
 *   PM.device.window(desk, opts)   → win                    same as desk.window(opts)
 *   PM.device.browser(el, opts)    → {el, screen, ...}      tab strip, back / forward / reload, address bar
 *   PM.device.phone(el, opts)      → {el, screen, ...}      Android phone, 360×780 dp
 *   PM.device.terminal(el, opts)   → {el, print, clear}     dark terminal window
 *   PM.device.sheet / doc / list / termView                 light app content for windows and screens
 *
 * Depends on playme.js (PM.h, PM.t, PM.L, PM.lAttr, PM.reduced, PM.ease). Classic script, no build step.
 * Reference: references/kit.md § Devices. Styles: playme-desk.css (every selector under .pm). */
(function () {
  'use strict';

  const PM = window.PM;
  if (!PM || typeof PM.h !== 'function') throw new Error('[PM.device] load playme.js before playme-desk.js');

  const MENU_H = 25; // macOS menubar height (logical px)
  const PHONE = { w: 360, h: 780, bezel: 12, rim: 3 }; // phone screen in dp, body bezel, side-button room

  /* ------------------------------------------------------------------ small helpers */

  const h = PM.h;
  const tr = (en, zh) => (PM.t ? PM.t(en, zh) : en);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduced = () => !!(PM.reduced && PM.reduced());
  const ease = (k) => (PM.ease && PM.ease.inOut ? PM.ease.inOut(k) : (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2));
  const cx = (...names) => names.filter(Boolean).join(' ');
  const div = (cls, ...kids) => h('div', cls ? { class: cls } : null, ...kids);
  const span = (cls, ...kids) => h('span', cls ? { class: cls } : null, ...kids);
  const isBi = (v) => !!v && typeof v === 'object' && !(v instanceof Node) && !Array.isArray(v) && 'en' in v;

  /** Text-ish value (string | number | Node | {en, zh}) → Node | null. {en, zh} becomes an auto-swapping PM.L. */
  function tx(v) {
    if (v == null || v === false) return null;
    if (v instanceof Node) return v;
    if (isBi(v)) return PM.L ? PM.L(v.en, v.zh) : document.createTextNode(String(v.en));
    return document.createTextNode(String(v));
  }
  /** Text-ish value → plain string in the current language. */
  function plain(v) {
    if (v == null) return '';
    if (v instanceof Node) return v.textContent || '';
    if (isBi(v)) return tr(v.en, v.zh);
    return String(v);
  }
  /** A text-ish value shown in a second place: Nodes are cloned (an element can only live once). */
  const again = (v) => (v instanceof Node ? v.cloneNode(true) : tx(v));

  /** True while a player measures or seeks: one-shot polish (ripples, flashes, slide-ins) is skipped. */
  const quiet = (el) => !!(el && el.closest && el.closest('.pm-seeking, .pm-measuring'));

  /** Small deterministic string hash (favicon colours, stable across reloads). */
  function hash(str) {
    let x = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
    return x;
  }

  /** aria-label that follows the page language when it is given as {en, zh} (PM.lAttr). */
  function ariaLabel(el, v) {
    if (isBi(v) && PM.lAttr) PM.lAttr(el, 'aria-label', v.en, v.zh);
    else el.setAttribute('aria-label', plain(v));
  }

  /** Scale a fixed-size logical stage to the width of its frame (the frame keeps the stage's aspect ratio).
   * Sets --pm-s (scale) and --pm-ui (counter-scale, 1…3.2) on the stage so pointers, labels and flash
   * borders keep a legible on-screen size when the device is drawn small.
   * view(frameWidth) → {x, y, w} | null optionally shows only a region of the stage (Mac `crop` on narrow screens). */
  function fitter(frame, stage, W, onScale, view) {
    let s = 0;
    let key = '';
    function apply(w) {
      if (!(w > 0)) return; // not laid out yet (closed fold, display:none): wait for the observer
      const r = view ? view(w) : null;
      const ns = w / (r ? r.w : W);
      const nk = `${ns}|${r ? `${r.x},${r.y}` : ''}`;
      if (nk === key) return;
      key = nk;
      s = ns;
      stage.style.transform = r ? `translate(${-r.x * s}px, ${-r.y * s}px) scale(${s})` : `scale(${s})`;
      stage.style.setProperty('--pm-s', String(s));
      stage.style.setProperty('--pm-ui', String(clamp(0.82 / s, 1, 3.2)));
      if (onScale) onScale(s);
    }
    const ro = typeof ResizeObserver === 'function'
      ? new ResizeObserver((entries) => apply(entries[entries.length - 1].contentRect.width))
      : null;
    if (ro) ro.observe(frame);
    return {
      get scale() { return s || 1; },
      measure() { key = ''; apply(frame.getBoundingClientRect().width); },
      disconnect() { if (ro) ro.disconnect(); },
    };
  }

  /** Tiny event emitter for desk events ('raise', 'move', 'focus'). */
  function emitter() {
    const map = new Map();
    return {
      on(evt, fn) { if (!map.has(evt)) map.set(evt, new Set()); map.get(evt).add(fn); return () => map.get(evt).delete(fn); },
      emit(evt, data) { const set = map.get(evt); if (set) for (const fn of Array.from(set)) fn(data); },
    };
  }

  /* ------------------------------------------------------------------ glyphs and app icons */

  // 16-px line glyphs (stroke = currentColor). Generic shapes only: no brand marks.
  const GLYPHS = {
    mark: '<rect x="2.4" y="2.4" width="11.2" height="11.2" rx="3.4"/><circle cx="8" cy="8" r="2.2"/>',
    search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 13.6 13.6"/>',
    wifi: '<path d="M2 6.3a8.6 8.6 0 0 1 12 0M4.2 8.6a5.5 5.5 0 0 1 7.6 0M6.4 10.9a2.4 2.4 0 0 1 3.2 0"/><circle cx="8" cy="13" r=".7" fill="currentColor"/>',
    battery: '<rect x="1.4" y="5" width="11.8" height="6.2" rx="1.7"/><path d="M14.6 7.3v1.6"/><rect x="2.9" y="6.5" width="7.6" height="3.2" rx=".7" fill="currentColor" stroke="none"/>',
    signal: '<path d="M2.5 13.2h1.8v-2.4H2.5zM6 13.2h1.8V8.6H6zM9.5 13.2h1.8V6.2H9.5zM13 13.2h1.8V3.8H13z" fill="currentColor" stroke="none"/>',
    cc: '<rect x="1.8" y="2.8" width="12.4" height="4.4" rx="2.2"/><circle cx="12" cy="5" r="1.1"/><rect x="1.8" y="8.8" width="12.4" height="4.4" rx="2.2"/><circle cx="4" cy="11" r="1.1"/>',
    'chev-l': '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
    'chev-r': '<path d="M6 3.5 10.5 8 6 12.5"/>',
    'chev-d': '<path d="M4 6l4 4 4-4"/>',
    reload: '<path d="M13 8.2A5 5 0 1 1 11.5 4.6"/><path d="M12.9 2.6v2.8h-2.8"/>',
    lock: '<rect x="3.6" y="7" width="8.8" height="6.4" rx="1.4"/><path d="M5.6 7V5.3a2.4 2.4 0 0 1 4.8 0V7"/>',
    star: '<path d="m8 2.5 1.7 3.4 3.7.5-2.7 2.6.7 3.7L8 11l-3.4 1.7.7-3.7-2.7-2.6 3.7-.5z"/>',
    plus: '<path d="M8 3.2v9.6M3.2 8h9.6"/>',
    x: '<path d="m4.6 4.6 6.8 6.8m0-6.8-6.8 6.8"/>',
    dots: '<circle cx="8" cy="3.6" r=".9" fill="currentColor"/><circle cx="8" cy="8" r=".9" fill="currentColor"/><circle cx="8" cy="12.4" r=".9" fill="currentColor"/>',
    puzzle: '<path d="M3 5.5h2.6a1.6 1.6 0 1 1 3.2 0H11v2.4a1.6 1.6 0 1 1 0 3.2V13.5H3z"/>',
    folder: '<path d="M1.8 4.3c0-.7.5-1.2 1.2-1.2h3.1l1.6 1.6h5.3c.7 0 1.2.5 1.2 1.2v6.3c0 .7-.5 1.2-1.2 1.2H3c-.7 0-1.2-.5-1.2-1.2z"/>',
    doc: '<path d="M4 1.8h5.2l3.3 3.3v9.1H4z"/><path d="M9 1.8v3.4h3.5M6 8.2h4.5M6 10.6h4.5"/>',
    file: '<path d="M4 1.8h5.2l3.3 3.3v9.1H4z"/><path d="M9 1.8v3.4h3.5"/>',
    pdf: '<path d="M4 1.8h5.2l3.3 3.3v9.1H4z"/><path d="M9 1.8v3.4h3.5M5.8 11.6c1.5-1.2 2.6-3.2 2.9-5 .4 1.8 1.6 3.4 3 4.1-1.9-.1-4.1.2-5.9.9z"/>',
    image: '<rect x="2" y="3" width="12" height="10" rx="1.3"/><circle cx="5.6" cy="6.3" r="1.1"/><path d="m2.5 12 3.8-3.6 2.6 2.4 1.8-1.6 2.8 2.6"/>',
    sheet: '<rect x="2" y="2.6" width="12" height="10.8" rx="1.3"/><path d="M2 6.2h12M2 9.8h12M6 2.6v10.8M10 2.6v10.8"/>',
    notes: '<rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/>',
    mail: '<rect x="1.8" y="3.5" width="12.4" height="9" rx="1.5"/><path d="m2.3 4.3 5.7 4.4 5.7-4.4"/>',
    chat: '<path d="M2.5 7.6c0-2.9 2.5-4.9 5.5-4.9s5.5 2 5.5 4.9-2.5 4.9-5.5 4.9c-.8 0-1.5-.1-2.2-.4L3 13l.6-2.4C2.9 9.8 2.5 8.7 2.5 7.6z"/>',
    terminal: '<path d="m3.6 5 3 3-3 3M8.4 11.4h4"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6 5 5M11 11l1.4 1.4M3.6 12.4 5 11M11 5l1.4-1.4"/>',
    globe: '<circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c-2.3 2.4-2.3 9.6 0 12M8 2c2.3 2.4 2.3 9.6 0 12"/>',
    apps: '<path d="M3 3h3v3H3zM10 3h3v3h-3zM3 10h3v3H3zM10 10h3v3h-3z"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".6" fill="currentColor"/><circle cx="2.8" cy="8" r=".6" fill="currentColor"/><circle cx="2.8" cy="12" r=".6" fill="currentColor"/>',
    clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.4 1.5"/>',
    download: '<path d="M8 2.5v8M4.8 7.4 8 10.6l3.2-3.2M3 13.5h10"/>',
    share: '<path d="M8 10V2.5M5.2 5.2 8 2.4l2.8 2.8M3.5 8.5v4.6h9V8.5"/>',
    check: '<path d="m3.2 8.4 3 3 6.6-6.8"/>',
  };

  /** icon(name, size=16, stroke=1.4) → inline SVG (trusted static markup; colour = currentColor). */
  function icon(name, size = 16, stroke = 1.4) {
    const tpl = document.createElement('template');
    tpl.innerHTML = `<svg class="pm-dev-ico" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${GLYPHS[name] || GLYPHS.file}</svg>`;
    return tpl.content.firstElementChild;
  }

  // App kinds: icon colour + glyph, and the menus the menubar shows while that app is in front.
  const APP_RE = [
    [/finder/i, 'finder'], [/chrome|safari|firefox|edge|browser|web/i, 'browser'], [/excel|numbers|sheet|calc/i, 'sheet'],
    [/word|pages|doc|textedit|writer/i, 'doc'], [/mail|outlook|inbox/i, 'mail'], [/notes/i, 'notes'],
    [/terminal|shell|iterm|console/i, 'terminal'], [/settings|preferences/i, 'settings'], [/files/i, 'files'],
    [/messages|chat/i, 'chat'], [/photos|preview|image/i, 'photos'],
  ];
  const APP_STYLE = {
    finder: ['#3d8af7', 'folder'], browser: ['#2a8bd8', 'globe'], sheet: ['#1f9d5c', 'sheet'], doc: ['#2f6bd8', 'doc'],
    mail: ['#2f8cf3', 'mail'], notes: ['#e8b31a', 'notes'], terminal: ['#2b2e37', 'terminal'], settings: ['#8a8f9c', 'gear'],
    files: ['#4a6fd6', 'folder'], chat: ['#2fb85a', 'chat'], photos: ['#e5644e', 'image'], generic: ['#8a72e0', 'apps'],
  };
  const MENUS = {
    finder: ['File', 'Edit', 'View', 'Go', 'Window', 'Help'],
    browser: ['File', 'Edit', 'View', 'History', 'Bookmarks', 'Profiles', 'Tab', 'Window', 'Help'],
    sheet: ['File', 'Edit', 'View', 'Insert', 'Format', 'Data', 'Window', 'Help'],
    doc: ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Window', 'Help'],
    mail: ['File', 'Edit', 'View', 'Mailbox', 'Message', 'Format', 'Window', 'Help'],
    terminal: ['Shell', 'Edit', 'View', 'Window', 'Help'],
    generic: ['File', 'Edit', 'View', 'Window', 'Help'],
  };
  /** Chinese names of menu-bar menus and ribbon tabs, as macOS and Office show them in Chinese. */
  const UI_ZH = {
    File: '文件', Edit: '编辑', View: '显示', Go: '前往', Window: '窗口', Help: '帮助', History: '历史记录', Bookmarks: '书签',
    Profiles: '个人资料', Tab: '标签页', Insert: '插入', Format: '格式', Data: '数据', Tools: '工具', Mailbox: '邮箱',
    Message: '邮件', Home: '开始', Draw: '绘图', 'Page Layout': '页面布局', Formulas: '公式', Review: '审阅', Design: '设计',
    Layout: '布局', References: '引用',
  };
  /** A device UI word that follows the page language (menus, ribbon tabs). */
  const uiWord = (w) => (UI_ZH[w] ? tx({ en: w, zh: UI_ZH[w] }) : tx(w));
  function appKind(app) {
    const name = plain(app);
    if (APP_STYLE[name]) return name;
    for (const [re, kind] of APP_RE) if (re.test(name)) return kind;
    return 'generic';
  }

  /** appIcon(kindOrAppName, size=40) → a rounded-square app icon with a light gradient (generic glyphs). */
  function appIcon(app, size = 40) {
    const [color, glyph] = APP_STYLE[appKind(app)];
    const el = span('pm-appicon', icon(glyph, Math.round(size * 0.56), 1.5));
    el.setAttribute('aria-hidden', 'true');
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = `${Math.round(size * 0.235)}px`;
    el.style.setProperty('--pm-app', color);
    return el;
  }

  /** A filled macOS-style folder (desktop icons). */
  function folderArt() {
    const tpl = document.createElement('template');
    tpl.innerHTML = '<svg class="pm-dev-folder" viewBox="0 0 60 48" width="60" height="48" aria-hidden="true" focusable="false"><path d="M4 9a4 4 0 0 1 4-4h14l5 5h25a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#5aa7f5"/><path d="M4 16a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#8cc6ff"/><path d="M4 17a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4" fill="none" stroke="#b9dcff" stroke-width="1.2"/></svg>';
    return tpl.content.firstElementChild;
  }

  /** Traffic lights (close / minimise / zoom). */
  function lights(extra) {
    const el = span(cx('pm-lights', extra), h('i', { class: 'is-close' }), h('i', { class: 'is-min' }), h('i', { class: 'is-zoom' }));
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  /** The two pointer glyphs: a macOS arrow (desktops) and a fingertip (touch screens). */
  function pointerGlyph(style) {
    const tpl = document.createElement('template');
    tpl.innerHTML = style === 'touch'
      ? '<svg class="pm-ptr-glyph" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="15" class="pm-ptr-halo"/><circle cx="20" cy="20" r="9.5" class="pm-ptr-tip"/></svg>'
      : '<svg class="pm-ptr-glyph" viewBox="0 0 20 28" width="20" height="28" aria-hidden="true" focusable="false"><path class="pm-ptr-tip" d="M2.2 1.6v20.6l5-4.7 3.3 7.8 3.6-1.6-3.3-7.6h6.9z" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    return tpl.content.firstElementChild;
  }

  /* ------------------------------------------------------------------ surface: pointers, ripples, flashes */

  /** Shared machinery of every scaled screen (Mac desk, phone, scaled browser).
   * cfg: {stage, fit, fx, ptrs, W, H, touch, hit(x, y), occluded(target, rect)} → surface. */
  function surface(cfg) {
    const { stage, fx, ptrs } = cfg;
    const pointers = new Map();
    const keyed = new Map(); // deterministic flashes: target (element | window | 'screen') → box

    /** Element → its rectangle in logical coordinates of the stage. */
    function rectOf(el) {
      const s = cfg.fit.scale;
      const sr = stage.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: (r.left - sr.left) / s, y: (r.top - sr.top) / s, w: r.width / s, h: r.height / s };
    }
    /** Client (page) coordinates → logical coordinates. */
    function toLocal(clientX, clientY) {
      const s = cfg.fit.scale;
      const sr = stage.getBoundingClientRect();
      return { x: (clientX - sr.left) / s, y: (clientY - sr.top) / s };
    }

    /* ---- flashes ("the moment the screen changes", rule R6) ---- */
    function targetRect(target) {
      if (target == null || target === 'screen' || target === stage) return { x: 0, y: 0, w: cfg.W, h: cfg.H };
      if (typeof target.rect === 'function' && target.el) return target.rect();
      if (target.nodeType === 1) return rectOf(target);
      throw new Error('[PM.device] flash(): target must be a window, an element, or "screen"');
    }
    function flashBox(target, tone) {
      const r = targetRect(target);
      const pad = target == null || target === 'screen' || target === stage ? -2 : 3;
      const xray = !!(cfg.occluded && cfg.occluded(target, r));
      const box = div(cx('pm-dev-flash', `is-${tone || 'accent'}`, xray && 'is-xray', pad < 0 && 'is-screen'));
      Object.assign(box.style, { left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.w + pad * 2}px`, height: `${r.h + pad * 2}px` });
      return { box, xray };
    }
    /** flash(target, tone='accent', k?) — outline a window, an element or the whole screen.
     * Without k: a one-shot flash (polish; skipped while seeking). With k in 0..1: a deterministic flash at
     * progress k (fade in, hold, fade out), for players: `await ctx.tween(900, k => desk.flash(el, 'ok', k))`.
     * k ≤ 0 or ≥ 1 removes it. With {hold: true} the flash fades in and stays (k ≥ 1 keeps it) until restore()
     * or clearFx(). A target hidden behind another window flashes as an x-ray (dashed). */
    function flash(target, tone, k, { hold = false } = {}) {
      const key = target == null ? 'screen' : target;
      if (k !== undefined) {
        const prev = keyed.get(key);
        if (prev) { prev.remove(); keyed.delete(key); }
        if (k == null || !(k > 0 && (k < 1 || hold))) return null;
        const { box } = flashBox(target, tone);
        box.style.opacity = String(k < 0.12 ? k / 0.12 : hold || k < 0.7 ? 1 : (1 - k) / 0.3);
        fx.appendChild(box);
        keyed.set(key, box);
        return box;
      }
      if (quiet(stage)) return null;
      const { box, xray } = flashBox(target, tone);
      fx.appendChild(box);
      const rm = () => box.remove();
      if (reduced()) { setTimeout(rm, xray ? 1300 : 700); return box; }
      box.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
        { duration: xray ? 1500 : 900, easing: 'ease-out' }).finished.then(rm, rm);
      return box;
    }

    /** One-shot click ripple at (x, y) (polish: skipped while a player measures or seeks). */
    function burst(x, y, tone) {
      if (quiet(stage)) return;
      const r = div(cx('pm-ripple', 'is-burst', `is-${tone || 'accent'}`), span(null));
      r.style.transform = `translate(${x}px, ${y}px)`;
      ptrs.insertBefore(r, ptrs.firstChild);
      const rm = () => r.remove();
      if (reduced()) { setTimeout(rm, 450); return; }
      r.firstChild.animate([{ transform: 'scale(.25)', opacity: 0.95 }, { transform: 'scale(1.7)', opacity: 0 }],
        { duration: 560, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(rm, rm);
    }

    /* ---- pointers ---- */
    /** pointer(kind='agent'|'user', label?, opts?) → pointer. One pointer per kind (or per opts.id): a second
     * call returns the same pointer (and relabels it when a label is given). label: string | {en, zh} | Node |
     * false (no label). Default labels: "Agent" / 「智能体」 and "You" / 「你」. */
    function pointer(kind = 'agent', label, opts = {}) {
      const id = opts.id || kind;
      if (pointers.has(id)) { const p = pointers.get(id); if (label !== undefined) p.label(label); return p; }
      const style = opts.style || (cfg.touch ? 'touch' : 'arrow');
      const labelEl = span('pm-ptr-label');
      const el = div(cx('pm-ptr', `is-${kind}`, `is-${style}`), span('pm-ptr-in', pointerGlyph(style), labelEl));
      el.setAttribute('aria-hidden', 'true');
      const ring = div(cx('pm-ripple', `is-${kind}`), span(null));
      ring.hidden = true;
      ptrs.append(ring, el);
      let x = opts.x != null ? opts.x : cfg.W * (kind === 'user' ? 0.66 : 0.5);
      let y = opts.y != null ? opts.y : cfg.H * (kind === 'user' ? 0.7 : 0.55);
      let anim = null;
      let labelVal = false;    // the last label given, so a snapshot can restore it
      const place = (nx, ny) => { x = nx; y = ny; el.style.transform = `translate(${x}px, ${y}px)`; };
      const stop = () => { if (anim) { cancelAnimationFrame(anim.raf); const done = anim.resolve; anim = null; done(); } };
      const api = {
        el,
        kind,
        /** Place the pointer instantly (cancels a running moveTo). The call players use. */
        set(nx, ny) { stop(); place(nx, ny); return api; },
        /** Glide to (x, y) over ms (default from the distance) → Promise. For pages without a player:
         * it runs on wall-clock time. Instant under reduced motion, while seeking, or in a hidden tab. */
        moveTo(nx, ny, ms) {
          stop();
          api.show(true);
          const x0 = x;
          const y0 = y;
          const dist = Math.hypot(nx - x0, ny - y0);
          const dur = ms != null ? ms : clamp(240 + dist * 0.55, 280, 950);
          if (dur <= 0 || dist < 0.5 || reduced() || quiet(stage) || document.hidden) { place(nx, ny); return Promise.resolve(); }
          return new Promise((resolve) => {
            const t0 = performance.now();
            const token = { resolve, raf: 0 };
            const step = (now) => {
              if (anim !== token) return;
              const k = clamp((now - t0) / dur, 0, 1);
              const e = ease(k);
              place(x0 + (nx - x0) * e, y0 + (ny - y0) * e);
              if (k < 1) token.raf = requestAnimationFrame(step);
              else { anim = null; resolve(); }
            };
            anim = token;
            token.raf = requestAnimationFrame(step);
          });
        },
        /** Click at (x, y): place the pointer there, play a one-shot ripple (tone defaults to the pointer's
         * colour), and return what the click hits (a desk: the front window at that point, or null). */
        click(nx, ny, tone) {
          api.set(nx, ny);
          api.show(true);
          burst(nx, ny, tone || kind);
          return cfg.hit ? cfg.hit(nx, ny) : null;
        },
        /** Deterministic click ripple at the pointer's position, progress k in 0..1 (k ≤ 0 or ≥ 1 hides it):
         * `await ctx.tween(500, k => ptr.ripple(k, 'err'))`. */
        ripple(k, tone) {
          if (k == null || !(k > 0 && k < 1)) { ring.hidden = true; return api; }
          ring.className = cx('pm-ripple', `is-${tone || kind}`);
          ring.hidden = false;
          ring.style.transform = `translate(${x}px, ${y}px)`;
          const e = 1 - (1 - k) ** 3;
          ring.firstChild.style.transform = `scale(${0.25 + 1.45 * e})`;
          ring.firstChild.style.opacity = String(0.95 * (1 - k));
          return api;
        },
        show(on = true) { el.hidden = !on; if (!on) ring.hidden = true; return api; },
        label(text) {
          labelVal = text;
          labelEl.replaceChildren();
          const node = text === false || text === null ? null : tx(text);
          if (node) labelEl.appendChild(node);
          labelEl.hidden = !node;
          return api;
        },
        pos: () => ({ x, y, visible: !el.hidden, label: labelVal }),
      };
      place(x, y);
      if (opts.visible === false) el.hidden = true;
      api.label(label !== undefined ? label : kind === 'user' ? { en: 'You', zh: '你' } : kind === 'agent' ? { en: 'Agent', zh: '智能体' } : false);
      pointers.set(id, api);
      return api;
    }

    /** Remove every flash and ripple (pointers stay where they are). */
    function clearFx() {
      fx.replaceChildren();
      keyed.clear();
      for (const p of pointers.values()) p.ripple(null);
      for (const r of Array.from(ptrs.querySelectorAll('.pm-ripple.is-burst'))) r.remove();
    }

    return { rectOf, toLocal, flash, burst, pointer, pointers, clearFx };
  }

  /* ------------------------------------------------------------------ Mac desktop */

  const WALLPAPERS = { aurora: 1, dusk: 1, light: 1, dark: 1 };
  const DEFAULT_APP = { standard: 'Finder', browser: 'Browser', terminal: 'Terminal', plain: 'Finder' };

  /**
   * PM.device.mac(el, opts) → {el, screen, desk}
   * opts: {width=1280, height=800, hardware='laptop'|'display'|'none', wallpaper='aurora'|'dusk'|'light'|'dark'|css,
   *        wallTone='dark'|'light' (for a css wallpaper),
   *        menubar:{app='Finder', clock={en:'Tue 9:41 AM', zh:'周二 上午9:41'}} | false, dock=true | [appNames] | false,
   *        icons:[{name, kind?, x?, y?}], interactive=false, label,
   *        crop:{x, y, w, h, below=560, always}: on frames narrower than `below` CSS px (or always) show only this logical region, larger
   *        (keep the story's windows inside it; coordinates do not change)}
   * desk: windows, pointers, hit testing, flashes and notifications in logical pixels (see kit.md § Devices).
   */
  function mac(host, opts = {}) {
    const W = opts.width || 1280;
    const H = opts.height || 800;
    const hw = ['laptop', 'display', 'none'].includes(opts.hardware) ? opts.hardware : 'laptop';
    const bus = emitter();
    const wins = new Map();
    let order = []; // window ids, back → front
    let keyId = null;
    let seq = 0;
    let lastSnap = null;
    const bar = Object.assign({ app: 'Finder', clock: { en: 'Tue 9:41 AM', zh: '周二 上午9:41' } }, opts.menubar || {});

    /* ---- DOM ---- */
    const stage = div('pm-desk pm-screen');
    stage.style.width = `${W}px`;
    stage.style.height = `${H}px`;
    stage.setAttribute('role', 'group');
    ariaLabel(stage, opts.label || { en: 'Simulated Mac desktop', zh: '模拟 Mac 桌面' });
    const wall = div('pm-desk-wall');
    const iconLayer = div('pm-desk-icons');
    const winLayer = div('pm-desk-wins');
    const dockEl = div('pm-desk-dock');
    const sysLayer = div('pm-desk-sys');
    const fx = div('pm-desk-fx');
    const ptrs = div('pm-desk-ptrs');
    for (const n of [wall, dockEl, fx, ptrs]) n.setAttribute('aria-hidden', 'true');
    const menuApp = h('b', { class: 'pm-menu-app' });
    const menuList = span('pm-menu-items');
    const clockEl = span('pm-menu-clock');
    const menubar = div('pm-desk-menubar',
      span('pm-menu-left', span('pm-menu-mark', icon('mark', 15, 1.6)), menuApp, menuList),
      span('pm-menu-right', icon('cc', 15), icon('wifi', 15), icon('battery', 18), icon('search', 14), clockEl));
    menubar.setAttribute('aria-hidden', 'true');
    if (opts.menubar === false) menubar.hidden = true;
    stage.append(wall, iconLayer, winLayer, dockEl, menubar, sysLayer, fx, ptrs);

    const glass = div('pm-mac-glass', stage);
    glass.style.aspectRatio = `${W} / ${H}`;
    let crop = opts.crop || null;
    const lid = div('pm-mac-lid', span('pm-mac-cam'), glass);
    const root = div(cx('pm-dev', 'pm-dev-mac', `is-${hw}`), lid,
      hw === 'laptop' ? div('pm-mac-base', span('pm-mac-notch')) : null,
      hw === 'display' ? [div('pm-mac-neck'), div('pm-mac-foot')] : null);
    host.appendChild(root);
    /** The region shown at a given frame width: the crop on narrow frames, else the whole desktop. The menubar and
     * the notifications follow the region so the cropped view still reads as a Mac screen. This is drawing only:
     * hit testing (windowAt) never depends on the crop, so a story behaves the same at every width. */
    function view(fw) {
      const r = crop && (crop.always || fw < (crop.below || 560)) ? crop : null;
      glass.style.aspectRatio = r ? `${r.w} / ${r.h}` : `${W} / ${H}`;
      root.classList.toggle('is-cropped', !!r);
      Object.assign(menubar.style, r ? { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px` } : { left: '', top: '', width: '' });
      sysLayer.style.right = `${r ? W - (r.x + r.w) + 12 : 12}px`;
      sysLayer.style.top = `${(r ? r.y : 0) + MENU_H + 10}px`;
      return r;
    }
    const fit = fitter(glass, stage, W, null, view);
    fit.measure();

    /* ---- wallpaper, menubar, dock, desktop icons ---- */
    /** wallpaper(name | css, tone?) — tone 'light' | 'dark' sets the menubar and label colours for a custom
     * CSS background (named wallpapers know their own; only 'light' is light). */
    function wallpaper(wp, tone) {
      wall.className = 'pm-desk-wall';
      wall.style.background = '';
      if (!wp || WALLPAPERS[wp]) wall.classList.add(`is-${wp || 'aurora'}`);
      else wall.style.background = wp;
      const light = WALLPAPERS[wp] || !wp ? wp === 'light' : (tone || opts.wallTone) === 'light';
      stage.classList.toggle('is-wall-light', light);
    }
    wallpaper(opts.wallpaper);

    function renderMenubar() {
      const key = keyId && wins.get(keyId);
      const app = key ? key.app : bar.app;
      menuApp.replaceChildren(again(app) || '');
      menuList.replaceChildren(...(MENUS[appKind(app)] || MENUS.generic).map((m) => span(null, uiWord(m))));
      clockEl.replaceChildren(again(bar.clock) || '');
    }
    function renderDock() {
      if (opts.dock === false) { dockEl.hidden = true; return; }
      const apps = Array.isArray(opts.dock) ? opts.dock.slice() : ['Finder'];
      const running = new Set();
      for (const w of wins.values()) {
        const name = plain(w.app);
        running.add(name);
        if (!Array.isArray(opts.dock) && !apps.some((a) => plain(a) === name)) apps.push(w.app);
      }
      dockEl.replaceChildren(...apps.map((a) => span(cx('pm-dock-item', running.has(plain(a)) && 'is-running'), appIcon(a, 46))));
    }
    function setIcons(list) {
      iconLayer.replaceChildren(...(list || []).map((it, i) => {
        const kind = it.kind || fileKind(plain(it.name));
        const el = div('pm-dicon',
          span(cx('pm-dicon-img', `is-${kind}`), kind === 'folder' ? folderArt() : icon(FILE_GLYPH[kind] || 'file', 30, 1.2)),
          span('pm-dicon-name', tx(it.name)));
        el.style.transform = `translate(${it.x != null ? it.x : W - 104}px, ${it.y != null ? it.y : MENU_H + 14 + i * 92}px)`;
        return el;
      }));
    }
    if (opts.icons) setIcons(opts.icons);

    /* ---- windows ---- */
    function win(id) {
      const w = typeof id === 'object' && id ? id : wins.get(id);
      if (!w) throw new Error(`[PM.device] no window "${id && id.id ? id.id : id}"`);
      return w;
    }
    function applyZ() { order.forEach((id, i) => { wins.get(id).el.style.zIndex = String(i + 1); }); }
    function place(w) {
      w.el.style.transform = `translate(${w.x}px, ${w.y}px)`;
      w.el.style.width = `${w.w}px`;
      w.el.style.height = `${w.h}px`;
    }
    function applyKey() {
      for (const w of wins.values()) w.el.classList.toggle('is-key', w.id === keyId);
      renderMenubar();
    }

    /**
     * desk.window(opts) → win
     * opts: {id, title, app, x, y, w, h, content?: Node | {el}, kind='standard'|'browser'|'terminal'|'plain',
     *        focused?: bool (default: the newest window is key), z: 'back' (add behind the others), theme: 'dark',
     *        browser kind: url, tabs (as PM.device.browser); terminal kind: prompt, lines}
     * win: {id, el, content, app, title, rect(), setTitle(t), setContent(node), raise(), move(x, y), resize(w, h),
     *       show(on), find(sel), browser? (kind 'browser'), term? (kind 'terminal')}
     */
    function addWindow(o = {}) {
      const id = o.id || `win-${seq + 1}`;
      if (wins.has(id)) throw new Error(`[PM.device] duplicate window id "${id}"`);
      seq += 1;
      const kind = DEFAULT_APP[o.kind] ? o.kind : 'standard';
      const w = {
        id, kind, app: o.app || DEFAULT_APP[kind], title: o.title || '',
        x: Math.round(o.x != null ? o.x : 90 + (seq % 5) * 36), y: Math.round(o.y != null ? o.y : MENU_H + 40 + (seq % 5) * 30),
        w: Math.round(o.w || 640), h: Math.round(o.h || 420), hidden: false,
      };
      w.el = div(cx('pm-win', `is-${kind}`, (o.theme === 'dark' || kind === 'terminal') && 'is-dark', o.className));
      w.el.dataset.win = id;
      w.el.setAttribute('role', 'group');
      if (kind === 'browser') {
        w.browser = browserView(o, { lights: true });
        w.el.appendChild(w.browser.el);
        w.content = w.browser.screen;
      } else {
        if (kind !== 'plain') {
          w.titleEl = span('pm-win-title');
          w.bar = div('pm-win-bar', lights(), w.titleEl);
          w.el.appendChild(w.bar);
        }
        w.content = div('pm-win-body');
        w.el.appendChild(w.content);
        if (kind === 'terminal') {
          w.term = termView(o);
          w.content.appendChild(w.term.el);
        }
      }
      Object.assign(w, {
        rect: () => ({ x: w.x, y: w.y, w: w.w, h: w.h }),
        setTitle(t) {
          w.title = t;
          if (w.titleEl) w.titleEl.replaceChildren(again(t) || '');
          ariaLabel(w.el, isBi(t) ? t : plain(t) || plain(w.app));
          return w;
        },
        setContent(node) {
          const target = w.browser ? w.browser.screen : w.content;
          target.replaceChildren();
          const n = node && node.el instanceof Node ? node.el : node;
          if (n) target.appendChild(n);
          return w;
        },
        raise: (ro) => raise(w.id, ro),
        move: (x, y) => move(w.id, x, y),
        resize: (ww, hh) => { w.w = Math.round(ww); w.h = Math.round(hh); place(w); return w; },
        show(on = true) { w.hidden = !on; w.el.hidden = !on; if (!on && keyId === w.id) { keyId = null; applyKey(); } return w; },
        find: (sel) => w.el.querySelector(sel),
      });
      w.setTitle(w.title || (w.browser ? w.browser.title() : ''));
      if (o.content && kind !== 'browser') w.setContent(o.content);
      else if (o.content && kind === 'browser' && !(o.tabs && o.tabs.some((tb) => tb && tb.content))) w.setContent(o.content);
      place(w);
      wins.set(id, w);
      if (o.z === 'back') order.unshift(id); else order.push(id);
      winLayer.appendChild(w.el);
      applyZ();
      renderDock();
      if (o.focused === true || (o.focused !== false && o.z !== 'back')) focus(id);
      else renderMenubar();
      return w;
    }

    /** raise(id, {focus=true}) — bring a window to the front; by default it also becomes the key (focused)
     * window, as a click does on macOS, and the menubar shows its app. */
    function raise(id, ro = {}) {
      const w = win(id);
      order = order.filter((x) => x !== w.id).concat(w.id);
      applyZ();
      if (w.hidden) w.show(true);
      if (ro.focus !== false) { keyId = w.id; applyKey(); }
      bus.emit('raise', { id: w.id, by: ro.by || 'program' });
      return w;
    }
    /** focus(id | null) — make a window key without changing the order (null: no key window). */
    function focus(id) {
      keyId = id == null ? null : win(id).id;
      applyKey();
      bus.emit('focus', { id: keyId });
    }
    function move(id, x, y, by) {
      const w = win(id);
      w.x = Math.round(x);
      w.y = Math.round(y);
      place(w);
      bus.emit('move', { id: w.id, x: w.x, y: w.y, by: by || 'program' });
      return w;
    }
    /** order() → ids back → front; order(ids) sets it instantly (ids not listed keep their place behind). */
    function setOrder(ids) {
      if (!ids) return order.slice();
      const listed = ids.map((id) => win(id).id);
      order = order.filter((id) => !listed.includes(id)).concat(listed);
      applyZ();
      return order.slice();
    }

    /* ---- hit testing ---- */
    const inRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
    /** Windows under (x, y), front → back (hidden windows and the menubar strip excluded). */
    function windowsAt(x, y) {
      if (opts.menubar !== false && y < MENU_H) return [];
      const out = [];
      for (let i = order.length - 1; i >= 0; i--) { const w = wins.get(order[i]); if (!w.hidden && inRect(x, y, w.rect())) out.push(w); }
      return out;
    }
    /** The window a global click at (x, y) reaches: the front-most one there, or null (desktop / menubar). */
    const windowAt = (x, y) => windowsAt(x, y)[0] || null;
    function occluded(target, r) {
      const owner = target && target.el && typeof target.rect === 'function' ? target
        : target && target.nodeType === 1 && target.closest('.pm-win') ? wins.get(target.closest('.pm-win').dataset.win) : null;
      if (!owner) return false;
      const front = windowAt(r.x + r.w / 2, r.y + r.h / 2);
      return !!front && front !== owner;
    }

    const sf = surface({ stage, fit, fx, ptrs, W, H, hit: windowAt, occluded });

    /* ---- notifications ---- */
    /** toast({title, body?, app?, icon?, time='now', ms?}) → {el, remove()} — a notification banner at the top
     * right. It appears instantly (the slide-in is polish) and stays until removed, desk.clearFx() or restore();
     * ms auto-dismisses on wall-clock time (pages without a player only). */
    function toast(o = {}) {
      const el = div('pm-toast',
        appIcon(o.icon || o.app || 'generic', 36),
        div('pm-toast-body',
          div('pm-toast-head', h('b', null, tx(o.title)), span('pm-toast-time', tx(o.time || 'now'))),
          o.body != null ? div('pm-toast-text', tx(o.body)) : null));
      sysLayer.appendChild(el);
      if (!quiet(stage) && !reduced()) {
        el.animate([{ transform: 'translateX(380px)', opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
      const api = { el, remove() { el.remove(); } };
      if (o.ms) setTimeout(api.remove, o.ms);
      return api;
    }

    /* ---- snapshots (reset for players) ---- */
    function clearFx() { sf.clearFx(); sysLayer.replaceChildren(); }
    /** snapshot() → state of windows (order, key, geometry, visibility, title) and pointers. */
    function snapshot() {
      const s = { order: order.slice(), key: keyId, wins: {}, pointers: {} };
      for (const w of wins.values()) s.wins[w.id] = { x: w.x, y: w.y, w: w.w, h: w.h, hidden: w.hidden, title: w.title };
      for (const [id, p] of sf.pointers) s.pointers[id] = p.pos();
      lastSnap = s;
      return s;
    }
    /** restore(snapshot = the last one taken) — put windows and pointers back and clear every effect and toast.
     * The usual player reset: `const s0 = desk.snapshot();  reset() { desk.restore(s0); … }`. */
    function restore(s = lastSnap) {
      clearFx();
      if (!s) return;
      for (const [id, st] of Object.entries(s.wins)) {
        const w = wins.get(id);
        if (!w) continue;
        Object.assign(w, { x: st.x, y: st.y, w: st.w, h: st.h });
        place(w);
        w.hidden = st.hidden;
        w.el.hidden = st.hidden;
        if (st.title !== w.title) w.setTitle(st.title);
      }
      order = s.order.filter((id) => wins.has(id)).concat(order.filter((id) => !s.order.includes(id)));
      applyZ();
      keyId = s.key && wins.has(s.key) ? s.key : null;
      applyKey();
      for (const [id, st] of Object.entries(s.pointers)) {
        const p = sf.pointers.get(id);
        if (!p) continue;
        p.set(st.x, st.y).show(st.visible);
        if ('label' in st && p.pos().label !== st.label) p.label(st.label);
      }
    }

    /* ---- reader interaction (opt-in) ---- */
    if (opts.interactive) {
      stage.classList.add('is-interactive');
      let drag = null;
      winLayer.addEventListener('pointerdown', (e) => {
        const wEl = e.target.closest('.pm-win');
        if (!wEl || e.button > 0) return;
        const w = wins.get(wEl.dataset.win);
        raise(w.id, { by: 'reader' });
        if (!e.target.closest('.pm-win-bar, .pm-br-strip') || e.target.closest('.pm-lights i, .pm-br-tab')) return;
        const p = sf.toLocal(e.clientX, e.clientY);
        drag = { w, dx: p.x - w.x, dy: p.y - w.y, pid: e.pointerId };
        wEl.setPointerCapture(e.pointerId);
        wEl.classList.add('is-dragging');
        e.preventDefault();
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        drag.w.el.classList.remove('is-dragging');
        drag = null;
      };
      winLayer.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.pid) return;
        const p = sf.toLocal(e.clientX, e.clientY);
        move(drag.w.id, clamp(p.x - drag.dx, 40 - drag.w.w, W - 40), clamp(p.y - drag.dy, MENU_H, H - 30), 'reader');
      });
      winLayer.addEventListener('pointerup', end);
      winLayer.addEventListener('pointercancel', end);
    }

    renderMenubar();
    renderDock();

    const desk = {
      el: root,
      screen: stage,
      W,
      H,
      MENU_H,
      get scale() { return fit.scale; },
      window: addWindow,
      win: (id) => wins.get(id) || null,
      windows: () => order.map((id) => wins.get(id)),
      raise,
      focus,
      move: (id, x, y) => move(id, x, y),
      order: setOrder,
      windowAt,
      windowsAt,
      pointer: sf.pointer,
      flash: sf.flash,
      toast,
      clearFx,
      snapshot,
      restore,
      rectOf: sf.rectOf,
      toLocal: sf.toLocal,
      wallpaper,
      icons: setIcons,
      menubar(o) { Object.assign(bar, o || {}); renderMenubar(); },
      /** crop(region | null) — change the narrow-screen region (see opts.crop). */
      crop(r) { crop = r || null; fit.measure(); },
      on: bus.on,
      destroy() { fit.disconnect(); root.remove(); },
    };
    return { el: root, screen: stage, desk };
  }

  /* ------------------------------------------------------------------ browser */

  const FAVICON_COLORS = ['#d9573b', '#1f8a5b', '#3a64c8', '#b8741a', '#13879e', '#a3436c', '#6e57c9'];
  function favicon(tb) {
    const label = plain(tb.title) || hostOf(tb.url) || '?';
    const letter = (tb.icon && tb.icon.letter) || label.trim().replace(/^www\./, '').charAt(0).toUpperCase();
    const fav = span('pm-br-fav', letter);
    fav.style.background = (tb.icon && tb.icon.color) || FAVICON_COLORS[hash(label) % FAVICON_COLORS.length];
    fav.setAttribute('aria-hidden', 'true');
    return fav;
  }
  const stripScheme = (u) => String(u || '').replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '');
  const hostOf = (u) => stripScheme(u).split(/[/?#]/)[0];

  /** The browser chrome (tab strip, toolbar, address bar, pages) used by PM.device.browser and browser windows.
   * opt.lights puts the traffic lights into the tab strip (a macOS browser window has no separate title bar). */
  function browserView(o = {}, opt = {}) {
    const tabs = (o.tabs && o.tabs.length ? o.tabs : [{ title: o.title, url: o.url, active: true }])
      .map((tb) => (tb && typeof tb === 'object' && !(tb instanceof Node) && !isBi(tb) ? Object.assign({}, tb) : { title: tb }));
    let active = Math.max(0, tabs.findIndex((tb) => tb.active));
    if (o.url && !tabs[active].url) tabs[active].url = o.url;

    const root = div('pm-br pm-screen');
    const tabsEl = span('pm-br-tabs');
    const strip = div('pm-br-strip', opt.lights ? lights('is-strip') : null, tabsEl, span('pm-br-newtab', icon('plus', 14, 1.6)));
    const hostEl = span('pm-br-host');
    const pathEl = span('pm-br-path');
    const omni = div('pm-br-omni', span('pm-br-secure', icon('lock', 13, 1.5)), span('pm-br-url', hostEl, pathEl), span('pm-br-star', icon('star', 14)));
    const tool = (name, off) => span(cx('pm-br-btn', off && 'is-off'), icon(name, 16, 1.6));
    const bar = div('pm-br-bar', tool('chev-l'), tool('chev-r', true), tool('reload'), omni,
      span('pm-br-btn', icon('puzzle', 15)), span('pm-br-avatar'), span('pm-br-btn', icon('dots', 16)));
    const view = div('pm-br-view');
    strip.setAttribute('aria-hidden', 'true');
    bar.setAttribute('aria-hidden', 'true');
    root.append(strip, bar, view);

    const tabEls = [];
    const pages = [];
    function build(tb) {
      const tabEl = span('pm-br-tab', favicon(tb), span('pm-br-tab-title', tx(tb.title) || hostOf(tb.url) || 'New Tab'), span('pm-br-tab-x', icon('x', 10, 1.6)));
      const page = div('pm-br-page');
      const content = tb.content && tb.content.el instanceof Node ? tb.content.el : tb.content;
      if (content) page.appendChild(content);
      tabEls.push(tabEl);
      pages.push(page);
      tabsEl.appendChild(tabEl);
      view.appendChild(page);
    }
    tabs.forEach(build);

    function showUrl() {
      const u = stripScheme(tabs[active].url);
      const host = hostOf(tabs[active].url);
      hostEl.textContent = host;
      pathEl.textContent = u.slice(host.length);
      omni.classList.toggle('is-empty', !u);
      if (!u) hostEl.textContent = 'Search or type a URL';
    }
    function select(i) {
      if (i < 0 || i >= tabs.length) return api;
      active = i;
      tabEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
      pages.forEach((p, k) => { p.hidden = k !== i; });
      showUrl();
      return api;
    }
    const api = {
      el: root,
      strip,
      view,
      /** The active tab's page element (put the page content here). */
      get screen() { return pages[active]; },
      pages,
      tabs: tabEls,
      get active() { return active; },
      select,
      page: (i = active) => pages[i],
      url: (i = active) => tabs[i].url || '',
      title: (i = active) => tabs[i].title,
      setUrl(url, i = active) { tabs[i].url = url; if (i === active) showUrl(); return api; },
      setTitle(title, i = active) {
        tabs[i].title = title;
        tabEls[i].querySelector('.pm-br-tab-title').replaceChildren(tx(title) || hostOf(tabs[i].url) || 'New Tab');
        return api;
      },
      addTab(tb, makeActive = true) { tabs.push(Object.assign({}, tb)); build(tabs[tabs.length - 1]); return makeActive ? select(tabs.length - 1) : select(active); },
    };
    select(active);
    return api;
  }

  /**
   * PM.device.browser(el, opts) → {el, screen, select(i), setUrl(url, i?), setTitle(t, i?), addTab(tab), page(i),
   *                                 pointer(kind, label), flash(target, tone, k?), rectOf(el)}
   * opts: {url, title?, tabs?: [string | {title, url, active, content, icon:{letter, color}}], content?: Node,
   *        height=320 (page height in CSS px, fluid width) | width + height (logical px, scaled like a Mac), label}
   * Fluid by default: the chrome keeps a legible size and the page reflows. Give `width` to lay the whole window
   * out in logical pixels and scale it (pointer coordinates then stay fixed at every width).
   */
  function browser(host, o = {}) {
    const view = browserView(o, { lights: true });
    if (o.content && !(o.tabs && o.tabs.some((tb) => tb && tb.content))) view.screen.appendChild(o.content.el instanceof Node ? o.content.el : o.content);
    const fx = div('pm-dev-fx');
    const ptrs = div('pm-dev-ptrs');
    fx.setAttribute('aria-hidden', 'true');
    ptrs.setAttribute('aria-hidden', 'true');
    const winEl = div('pm-br-win', view.el, fx, ptrs);
    winEl.setAttribute('role', 'group');
    ariaLabel(winEl, o.label || { en: 'Simulated browser window', zh: '模拟浏览器窗口' });
    let root;
    let fit;
    let W;
    let H;
    if (o.width) {
      W = o.width;
      H = o.height || Math.round(W * 0.625);
      winEl.style.width = `${W}px`;
      winEl.style.height = `${H}px`;
      winEl.classList.add('is-scaled');
      const box = div('pm-br-fit', winEl);
      box.style.aspectRatio = `${W} / ${H}`;
      root = div('pm-dev pm-dev-browser is-scaled', box);
      host.appendChild(root);
      fit = fitter(box, winEl, W);
      fit.measure();
    } else {
      view.view.style.height = `${o.height || 320}px`;
      root = div('pm-dev pm-dev-browser', winEl);
      host.appendChild(root);
      fit = { scale: 1 };
      W = 0;
      H = 0;
    }
    const sf = surface({
      stage: winEl, fit, fx, ptrs,
      get W() { return W || winEl.offsetWidth; },
      get H() { return H || winEl.offsetHeight; },
    });
    return Object.assign(view, {
      el: root,
      window: winEl,
      pointer: sf.pointer,
      flash: sf.flash,
      rectOf: sf.rectOf,
      toLocal: sf.toLocal,
      clearFx: sf.clearFx,
      get scale() { return fit.scale; },
    });
  }

  /* ------------------------------------------------------------------ phone */

  /**
   * PM.device.phone(el, opts) → {el, screen, setScreen(node), tap(x, y, tone), pointer(kind, label),
   *                               flash(target, tone, k?), rectOf(el), clearFx()}
   * opts: {time='9:41', app?: title of the default list app, items?: [{title, sub, meta, kind}], content?: Node,
   *        maxWidth=260 (CSS px), label}
   * An Android phone: a 360×780 dp screen in a rounded body with a punch-hole camera, a status bar and a
   * gesture bar. Coordinates (tap, pointer, flash) are dp on the screen, origin at its top-left corner.
   */
  function phone(host, o = {}) {
    const { w: SW, h: SH, bezel: B, rim: R } = PHONE;
    const BW = SW + B * 2;
    const BH = SH + B * 2;
    const main = div('pm-ph-main');
    const fx = div('pm-dev-fx');
    const ptrs = div('pm-dev-ptrs');
    fx.setAttribute('aria-hidden', 'true');
    ptrs.setAttribute('aria-hidden', 'true');
    const status = div('pm-ph-status',
      span('pm-ph-time', o.time || '9:41'),
      span('pm-ph-cam'),
      span('pm-ph-sicons', icon('signal', 15), icon('wifi', 15), icon('battery', 19)));
    status.setAttribute('aria-hidden', 'true');
    const nav = div('pm-ph-nav', span('pm-ph-pill'));
    nav.setAttribute('aria-hidden', 'true');
    const screen = div('pm-ph-screen pm-screen', status, main, nav, fx, ptrs);
    screen.style.width = `${SW}px`;
    screen.style.height = `${SH}px`;
    const shell = div('pm-ph-shell', screen);
    Object.assign(shell.style, { left: `${R}px`, width: `${BW}px`, height: `${BH}px`, padding: `${B}px` });
    // the body is the scaled stage: the shell plus room for the side keys on both edges
    const body = div('pm-ph-body', h('i', { class: 'pm-ph-key is-power' }), h('i', { class: 'pm-ph-key is-vol' }), shell);
    body.style.width = `${BW + R * 2}px`;
    body.style.height = `${BH}px`;
    const box = div('pm-ph-fit', body);
    box.style.aspectRatio = `${BW + R * 2} / ${BH}`;
    const root = div('pm-dev pm-dev-phone', box);
    root.style.maxWidth = `${o.maxWidth || 260}px`;
    root.setAttribute('role', 'group');
    ariaLabel(root, o.label || { en: 'Simulated Android phone', zh: '模拟 Android 手机' });
    host.appendChild(root);
    const fit = fitter(box, body, BW + R * 2);
    fit.measure();
    const sf = surface({ stage: screen, fit, fx, ptrs, W: SW, H: SH, touch: true });

    function setScreen(node) {
      let n = node && node.el instanceof Node ? node.el : node;
      if (!n) n = list({ title: o.app || 'Files', items: o.items || [], search: true }).el;
      main.replaceChildren(n);
    }
    setScreen(o.content || null);

    return {
      el: root,
      screen: main,
      display: screen,
      setScreen,
      /** One-shot tap ripple at (x, y) dp (polish; for players use pointer('user').ripple(k)). */
      tap(x, y, tone = 'user') { sf.burst(x, y, tone); },
      pointer: (kind, label, po) => sf.pointer(kind, label, Object.assign({ style: 'touch' }, po || {})),
      flash: sf.flash,
      rectOf: sf.rectOf,
      toLocal: sf.toLocal,
      clearFx: sf.clearFx,
      get scale() { return fit.scale; },
      destroy() { fit.disconnect(); root.remove(); },
    };
  }

  /* ------------------------------------------------------------------ terminal */

  /** termView({prompt='user@mac ~ %', lines?: [string | {text, kind}]}) → {el, print(text, kind), clear(), lines()}
   * The dark terminal body used by PM.device.terminal and terminal windows. print() returns the line, whose
   * set(text) rewrites it (type a command letter by letter from a tween: `ln.set(cmd.slice(0, n))`).
   * kinds: 'cmd' (prompt + command), 'out' (default), 'ok', 'err', 'warn', 'info', 'dim', 'agent', 'user'. */
  function termView(o = {}) {
    const prompt = o.prompt != null ? o.prompt : 'user@mac ~ %';
    const box = div('pm-term');
    // keep the newest line in view; a faded top edge shows that older lines scrolled away
    const scroll = () => { box.scrollTop = box.scrollHeight; box.classList.toggle('is-scrolled', box.scrollTop > 0); };
    function print(text, kind = 'out') {
      const textEl = span('pm-term-text');
      const line = div(cx('pm-term-line', `is-${kind}`), kind === 'cmd' && prompt ? span('pm-term-prompt', `${prompt} `) : null, textEl);
      const ln = { el: line, set(v) { textEl.replaceChildren(tx(v) || ''); scroll(); return ln; } };
      box.appendChild(line);
      ln.set(text);
      return ln;
    }
    (o.lines || []).forEach((l) => (l && typeof l === 'object' && !isBi(l) && !(l instanceof Node) ? print(l.text, l.kind) : print(l)));
    return { el: box, print, clear() { box.replaceChildren(); }, lines: () => Array.from(box.children) };
  }

  /**
   * PM.device.terminal(el, opts) → {el, body, print(text, kind) → line, clear(), lines()}
   * opts: {title='Terminal — zsh', prompt, lines, rows=9 (visible lines; older lines scroll), label}
   */
  function terminal(host, o = {}) {
    const term = termView(o);
    term.el.style.height = `calc(${o.rows || 9} * 1.6em + 20px)`;
    const root = div('pm-dev pm-dev-term',
      div('pm-term-win', div('pm-win-bar', lights(), span('pm-win-title', tx(o.title || 'Terminal — zsh'))), term.el));
    root.setAttribute('role', 'group');
    ariaLabel(root, o.label || { en: 'Terminal', zh: '终端' });
    host.appendChild(root);
    return { el: root, body: term.el, print: term.print, clear: term.clear, lines: term.lines };
  }

  /* ------------------------------------------------------------------ app content (light, like real screens) */

  const FILE_GLYPH = { folder: 'folder', doc: 'doc', sheet: 'sheet', pdf: 'pdf', image: 'image', mail: 'mail', chat: 'chat', file: 'file', app: 'apps' };
  /** File name → kind ('folder' | 'doc' | 'sheet' | 'pdf' | 'image' | 'file'). */
  function fileKind(name) {
    const n = String(name || '');
    if (/\.(xlsx?|csv|numbers)$/i.test(n)) return 'sheet';
    if (/\.(docx?|pages|txt|md|rtf)$/i.test(n)) return 'doc';
    if (/\.pdf$/i.test(n)) return 'pdf';
    if (/\.(png|jpe?g|webp|heic|gif)$/i.test(n)) return 'image';
    return /\./.test(n) ? 'file' : 'folder';
  }

  const colLetter = (c) => { let s = ''; let n = c + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  /** 'B3' | [row, col] (0-based) → {r, c} (0-based), or null. */
  function parseRef(ref) {
    if (Array.isArray(ref)) return { r: ref[0], c: ref[1] };
    const m = /^([A-Z]+)(\d+)$/i.exec(String(ref || '').trim());
    if (!m) return null;
    let c = 0;
    for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
    return { r: Number(m[2]) - 1, c: c - 1 };
  }

  /**
   * PM.device.sheet({cols, rows, title='Sheet1', minRows=16, colWidths?, selected?}) → {el, cell(ref), get(ref),
   *                 set(ref, value, tone?), mark(ref, tone | null), select(ref | null), selected()}
   * A spreadsheet: ribbon tabs, formula bar, lettered columns, numbered rows, sheet tabs. `cols` (array of names)
   * fills row 1 as a bold header row; `rows` follow from row 2. Refs are as displayed: 'C4' or [row, col] 0-based.
   * Numbers are right-aligned with thousands separators. tone: 'ok' | 'err' | 'warn' | 'info' | 'agent' | 'user'.
   */
  function sheet(o = {}) {
    const head = Array.isArray(o.cols) ? o.cols : null;
    const data = (head ? [head] : []).concat(o.rows || []);
    const nCols = Math.max(typeof o.cols === 'number' ? o.cols : 0, ...data.map((r) => r.length), 4);
    const nRows = Math.max(o.minRows != null ? o.minRows : 16, data.length);
    const widths = Array.from({ length: nCols }, (_, c) => (o.colWidths && o.colWidths[c]) || (c === 0 ? 140 : 96));
    const refBox = span('pm-sh-ref');
    const valBox = span('pm-sh-val');
    const grid = div('pm-sh-grid');
    grid.style.setProperty('--pm-sh-cols', `40px ${widths.map((w) => `${w}px`).join(' ')}`);
    grid.appendChild(div('pm-sh-row is-colh', span('pm-sh-corner'), Array.from({ length: nCols }, (_, c) => span(null, colLetter(c)))));
    const cells = [];
    const show = (el, v) => {
      el.replaceChildren(typeof v === 'number' ? v.toLocaleString('en-US') : tx(v) || '');
      el.classList.toggle('is-num', typeof v === 'number');
    };
    for (let r = 0; r < nRows; r++) {
      const rowCells = [];
      const row = div(cx('pm-sh-row', head && r === 0 && 'is-head'), span('pm-sh-rowh', String(r + 1)));
      for (let c = 0; c < nCols; c++) {
        const cell = span('pm-sh-cell');
        show(cell, data[r] && data[r][c] != null ? data[r][c] : '');
        rowCells.push(cell);
        row.appendChild(cell);
      }
      cells.push(rowCells);
      grid.appendChild(row);
    }
    const ribbon = div('pm-app-ribbon', ['Home', 'Insert', 'Draw', 'Page Layout', 'Formulas', 'Data', 'Review', 'View'].map((t, i) => span(i === 0 ? 'is-active' : null, uiWord(t))));
    const root = div('pm-app pm-app-sheet pm-screen',
      ribbon,
      div('pm-sh-bar', refBox, span('pm-sh-fx', 'fx'), valBox),
      div('pm-sh-scroll', grid),
      div('pm-sh-tabs', span('is-active', tx(o.title || 'Sheet1')), span(null, icon('plus', 11, 1.6))));
    ribbon.setAttribute('aria-hidden', 'true');
    let sel = null;
    const api = {
      el: root,
      grid,
      cell(ref) { const p = parseRef(ref); return p && cells[p.r] ? cells[p.r][p.c] || null : null; },
      get(ref) { const el = api.cell(ref); return el ? el.textContent : null; },
      set(ref, v, tone) {
        const el = api.cell(ref);
        if (!el) return api;
        show(el, v);
        if (tone !== undefined) api.mark(ref, tone);
        if (el === sel) valBox.textContent = el.textContent;
        return api;
      },
      /** Tint a cell (deterministic highlight of a change); tone null clears it. */
      mark(ref, tone) {
        const el = api.cell(ref);
        if (!el) return api;
        el.className = cx('pm-sh-cell', el.classList.contains('is-num') && 'is-num', el === sel && 'is-selected', tone && `is-${tone}`);
        return api;
      },
      select(ref) {
        if (sel) sel.classList.remove('is-selected');
        sel = ref == null ? null : api.cell(ref);
        const p = parseRef(ref);
        refBox.textContent = sel && p ? `${colLetter(p.c)}${p.r + 1}` : '';
        valBox.textContent = sel ? sel.textContent : '';
        if (sel) sel.classList.add('is-selected');
        return api;
      },
      selected: () => (refBox.textContent || null),
      rows: nRows,
      cols: nCols,
    };
    api.select(o.selected || (head ? 'A2' : 'A1'));
    return api;
  }

  /**
   * PM.device.doc({title?, paragraphs: [text | {text, style: 'title'|'h1'|'h2'|'p'|'li'|'muted'}]}) →
   *               {el, page, add(text, style), paragraphs()}
   * A word-processor window body: ribbon, toolbar, a white page on a grey canvas, a status bar.
   */
  function doc(o = {}) {
    const page = div('pm-doc-page');
    const para = (text, style) => {
      const p = h('p', { class: cx('pm-doc-p', style && `is-${style}`) }, tx(text));
      page.appendChild(p);
      return p;
    };
    if (o.title) para(o.title, 'title');
    for (const p of o.paragraphs || []) {
      if (p && typeof p === 'object' && !isBi(p) && !(p instanceof Node)) para(p.text, p.style);
      else para(p);
    }
    const tool = (label, cls) => span(cx('pm-doc-tool', cls), label);
    const sep = () => span('pm-doc-sep');
    const ribbon = div('pm-app-ribbon is-doc', ['Home', 'Insert', 'Draw', 'Design', 'Layout', 'References', 'Review', 'View'].map((t, i) => span(i === 0 ? 'is-active' : null, uiWord(t))));
    const tools = div('pm-doc-tools',
      span('pm-doc-select is-wide', 'Aptos (Body)', icon('chev-d', 10)), span('pm-doc-select', '12', icon('chev-d', 10)), sep(),
      tool('B', 'is-b'), tool('I', 'is-i'), tool('U', 'is-u'), sep(), tool(icon('list', 14)), sep(), tool(icon('download', 14)));
    ribbon.setAttribute('aria-hidden', 'true');
    tools.setAttribute('aria-hidden', 'true');
    const root = div('pm-app pm-app-doc pm-screen', ribbon, tools, div('pm-doc-canvas', page),
      div('pm-doc-status', span(null, 'Page 1 of 1'), span(null, 'English (US)'), span('pm-doc-zoom', '100%')));
    return {
      el: root,
      page,
      add: (text, style) => para(text, style),
      paragraphs: () => Array.from(page.children),
    };
  }

  /**
   * PM.device.list({title?, search?: bool | placeholder, items: [{title, sub?, meta?, kind?, unread?}], selected?})
   *                → {el, item(i), select(i | null), setItems(items)}
   * A list app (files, inbox, settings): optional large title and search field, rows with an icon tile, a title,
   * a second line and a right-aligned meta (time, size). kind: a file kind ('doc', 'sheet', 'pdf', 'image',
   * 'folder', 'mail', 'chat', 'app'); by default it follows the title's extension.
   */
  function list(o = {}) {
    const body = div('pm-ls-items');
    const root = div('pm-app pm-app-list pm-screen',
      o.title ? div('pm-ls-title', tx(o.title)) : null,
      o.search ? div('pm-ls-search', icon('search', 14), span(null, typeof o.search === 'string' ? o.search : 'Search')) : null,
      body);
    let rows = [];
    let sel = -1;
    const api = {
      el: root,
      item: (i) => rows[i] || null,
      select(i) {
        sel = i == null ? -1 : i;
        rows.forEach((r, k) => r.classList.toggle('is-selected', k === sel));
        return api;
      },
      setItems(items) {
        rows = (items || []).map((it) => {
          const kind = it.kind || fileKind(plain(it.title));
          return div(cx('pm-ls-item', it.unread && 'is-unread'),
            span(cx('pm-ls-ico', `is-${kind}`), icon(FILE_GLYPH[kind] || 'file', 18, 1.3)),
            span('pm-ls-text', h('b', null, tx(it.title)), it.sub != null ? span(null, tx(it.sub)) : null),
            it.meta != null ? span('pm-ls-meta', tx(it.meta)) : null);
        });
        body.replaceChildren(...rows);
        return api.select(sel);
      },
    };
    api.setItems(o.items);
    if (o.selected != null) api.select(o.selected);
    return api;
  }

  /* ------------------------------------------------------------------ exports */

  PM.device = {
    mac,
    window: (desk, o) => desk.window(o),
    browser,
    phone,
    terminal,
    sheet,
    doc,
    list,
    termView,
    icon,
    appIcon,
    fileKind,
    MENU_H,
  };
})();
