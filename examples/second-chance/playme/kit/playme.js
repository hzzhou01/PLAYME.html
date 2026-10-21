/* PLAYME lab kit — core (playme.js).
 *
 * One classic script, no build step, no dependencies. Everything hangs off window.PM:
 *   i18n        PM.lang / setLang / onLang / t / L / LH / lAttr (bilingual nodes swap when <html lang> changes)
 *   DOM         PM.h / PM.s / PM.icon / PM.asset
 *   motion      PM.reduced / PM.inView / PM.ease / PM.span / PM.step / PM.lerp / PM.clamp / PM.fmt
 *   template    PM.part (the one layout every interactive section uses) + PM.source / PM.readouts / folds
 *   player      PM.player: a story on a virtual clock (measured, scrubbable, seekable, frame-exact capture)
 *   controls    PM.button / PM.segmented / PM.toggle / PM.target / PM.langToggle
 *   code        PM.code (highlighted pane, marks, focus tokens, elision, two-axis scroll) + PM.intent
 *   page        PM.boot / PM.players
 * Styles: playme.css (every selector under .pm). API reference: ../references/kit.md. */
(function () {
  'use strict';

  const PM = (window.PM = window.PM || {});
  PM.version = '1.0.0';

  const docEl = document.documentElement;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const QUERY = (() => { try { return new URLSearchParams(location.search); } catch (_) { return new URLSearchParams(''); } })();

  /* ------------------------------------------------------------------ small utilities */

  let uidSeq = 0;
  const uid = (prefix = 'pm') => `${prefix}-${(++uidSeq).toString(36)}`;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** {en, zh} — a bilingual value (not a Node, not an array). */
  const isBi = (v) => !!v && typeof v === 'object' && !(v instanceof Node) && !Array.isArray(v) && ('en' in v || 'zh' in v);
  /** localStorage that never throws (private windows, file:// sandboxes, blocked site data). */
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (_) { /* not available: the choice lasts for this visit */ } },
  };
  /** One macrotask: every pending microtask (a script's continuation chain) has run when it resolves. */
  const macrotask = (() => {
    if (typeof MessageChannel !== 'function') return () => new Promise((r) => setTimeout(r, 0));
    const ch = new MessageChannel();
    const queue = [];
    ch.port1.onmessage = () => { const r = queue.shift(); if (r) r(); };
    return () => new Promise((r) => { queue.push(r); ch.port2.postMessage(0); });
  })();

  /* ------------------------------------------------------------------ language
   * Bilingual text lives in attributes (data-l-en / data-l-zh, or data-lh-* for trusted HTML); a MutationObserver on
   * <html lang> re-sets every such node, so pages never re-render on a language switch. */

  function lang() {
    return (docEl.getAttribute('lang') || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  /** t(en, zh?) or t({en, zh}) → the string for the current language (zh falls back to en). */
  function t(en, zh) {
    if (isBi(en)) { zh = en.zh; en = en.en; }
    if (lang() === 'zh' && zh != null) return String(zh);
    return en == null ? '' : String(en);
  }

  function normBi(args) {
    // L(en, zh?, tag?, attrs?) | L({en, zh}, tag?, attrs?) | L(en, zh, attrs)
    let [en, zh, tag, attrs] = args;
    if (isBi(en)) { attrs = tag; tag = zh; zh = en.zh; en = en.en; }
    if (tag && typeof tag === 'object') { attrs = tag; tag = null; }
    en = en == null ? '' : String(en);
    zh = zh == null ? en : String(zh);
    return { en, zh, tag: tag || 'span', attrs };
  }

  /** L(en, zh?, tag='span', attrs?) → element whose text follows the page language. */
  function L(...args) {
    const { en, zh, tag, attrs } = normBi(args);
    const el = h(tag, attrs);
    el.setAttribute('data-l-en', en);
    el.setAttribute('data-l-zh', zh);
    el.textContent = lang() === 'zh' ? zh : en;
    return el;
  }

  /** LH(enHtml, zhHtml?, tag, attrs) → like L, for trusted HTML (prose with inline <code>, <b>). */
  function LH(...args) {
    const { en, zh, tag, attrs } = normBi(args);
    const el = h(tag, attrs);
    el.setAttribute('data-lh-en', en);
    el.setAttribute('data-lh-zh', zh);
    el.innerHTML = lang() === 'zh' ? zh : en;
    return el;
  }

  /** lAttr(el, name, en, zh?) → el: a bilingual attribute (aria-label, title, alt, placeholder). */
  function lAttr(el, name, en, zh) {
    if (isBi(en)) { zh = en.zh; en = en.en; }
    en = en == null ? '' : String(en);
    zh = zh == null ? en : String(zh);
    el.setAttribute(`data-l-attr-${name}-en`, en);
    el.setAttribute(`data-l-attr-${name}-zh`, zh);
    const names = new Set((el.getAttribute('data-l-attrs') || '').split(' ').filter(Boolean));
    names.add(name);
    el.setAttribute('data-l-attrs', [...names].join(' '));
    el.setAttribute(name, lang() === 'zh' ? zh : en);
    return el;
  }

  /** applyLang(root = document): re-set every bilingual node and attribute under root. */
  function applyLang(root) {
    const zh = lang() === 'zh';
    const scope = root || document;
    const each = (sel, fn) => {
      if (scope.nodeType === 1 && scope.matches(sel)) fn(scope);
      scope.querySelectorAll(sel).forEach(fn);
    };
    each('[data-l-en]', (el) => {
      const v = zh ? (el.getAttribute('data-l-zh') ?? el.getAttribute('data-l-en')) : el.getAttribute('data-l-en');
      if (el.textContent !== v) el.textContent = v;
    });
    each('[data-lh-en]', (el) => {
      el.innerHTML = zh ? (el.getAttribute('data-lh-zh') ?? el.getAttribute('data-lh-en')) : el.getAttribute('data-lh-en');
    });
    each('[data-l-attrs]', (el) => {
      for (const name of el.getAttribute('data-l-attrs').split(' ').filter(Boolean)) {
        const v = el.getAttribute(`data-l-attr-${name}-${zh ? 'zh' : 'en'}`);
        if (v != null) el.setAttribute(name, v);
      }
    });
  }

  const langSubs = new Set();
  let currentLang = lang();

  /** onLang(cb) → off. cb(lang) runs once per actual language change, after the text swap. */
  function onLang(cb) {
    langSubs.add(cb);
    return () => langSubs.delete(cb);
  }

  function langChanged() {
    const now = lang();
    if (now === currentLang) return;
    currentLang = now;
    applyLang(document);
    for (const cb of Array.from(langSubs)) {
      try { cb(now); } catch (err) { console.error('[PM] onLang handler failed', err); }
    }
  }

  /** setLang('en' | 'zh') — sets <html lang> ('en' | 'zh-CN'), swaps every bilingual node, remembers the choice. */
  function setLang(next, { persist = true } = {}) {
    const l = String(next || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
    docEl.setAttribute('lang', l === 'zh' ? 'zh-CN' : 'en');
    if (persist) store.set('pm-lang', l);
    langChanged();   // synchronous; the observer below covers pages that set <html lang> themselves
  }

  if (typeof MutationObserver === 'function') {
    new MutationObserver(langChanged).observe(docEl, { attributes: true, attributeFilter: ['lang'] });
  }

  // Start language: ?lang=zh|en (one visit) > the reader's stored choice > the page's own <html lang>.
  (function initLang() {
    const q = (QUERY.get('lang') || '').toLowerCase();
    const want = q ? (q.startsWith('zh') ? 'zh' : 'en') : store.get('pm-lang');
    if ((want === 'zh' || want === 'en') && want !== lang()) docEl.setAttribute('lang', want === 'zh' ? 'zh-CN' : 'en');
    currentLang = lang();
  })();

  /* ------------------------------------------------------------------ DOM helpers */

  // Tags created in the SVG namespace by h() (also through PM.s). 'text' is safe: HTML has no <text> element.
  const SVG_TAGS = new Set(('svg g path circle rect line polyline polygon ellipse text tspan textPath defs symbol use '
    + 'linearGradient radialGradient stop clipPath mask pattern marker filter foreignObject feGaussianBlur feOffset '
    + 'feMerge feMergeNode feColorMatrix feBlend feFlood feComposite feDropShadow').split(' '));
  const UNITLESS = /^(opacity|zIndex|flex|flexGrow|flexShrink|order|fontWeight|lineHeight|zoom|scale)$/;
  const PROPS = new Set(['value', 'checked', 'selected', 'muted', 'indeterminate']);

  function setAttrs(el, attrs, svg) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'class' || key === 'className') {
        const list = (Array.isArray(value) ? value.flat(Infinity) : String(value).split(/\s+/)).filter(Boolean);
        if (list.length) el.classList.add(...list);
      } else if (key === 'style') {
        if (typeof value === 'string') el.style.cssText += value;
        else for (const [p, v] of Object.entries(value)) {
          if (v == null || v === false) continue;
          if (p.includes('-')) el.style.setProperty(p, String(v));
          else el.style[p] = typeof v === 'number' && !UNITLESS.test(p) ? `${v}px` : String(v);
        }
      } else if (key === 'dataset') {
        for (const [d, v] of Object.entries(value)) if (v != null) el.dataset[d] = String(v);
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key === 'text') {
        if (isBi(value)) {
          el.setAttribute('data-l-en', value.en ?? '');
          el.setAttribute('data-l-zh', value.zh ?? value.en ?? '');
          el.textContent = t(value);
        } else el.textContent = String(value);
      } else if (key === 'ref') {
        if (typeof value === 'function') value(el);
      } else if (/^on[A-Za-z]/.test(key) && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (isBi(value)) {
        lAttr(el, key, value);
      } else if (!svg && PROPS.has(key)) {
        el[key] = value;
      } else if (!svg && (key === 'hidden' || key === 'disabled') && key in el) {
        el[key] = !!value;
      } else {
        el.setAttribute(key, value === true ? '' : String(value));
      }
    }
  }

  function appendKids(el, kids) {
    for (const k of kids) {
      if (k == null || k === false || k === true) continue;
      if (Array.isArray(k)) appendKids(el, k);
      else if (k instanceof Node) el.appendChild(k);
      else if (isBi(k)) el.appendChild(L(k));
      else el.appendChild(document.createTextNode(String(k)));
    }
  }

  const isAttrs = (v) => v != null && typeof v === 'object' && !(v instanceof Node) && !Array.isArray(v) && !isBi(v);

  /** h(tag, attrs?, ...children) → Element. attrs: class (str|array), style (obj|str), dataset, html, text, ref(el),
   * on<Event>: fn, aria-*, role, any attribute; an {en, zh} value makes a bilingual attribute. children: nodes,
   * strings, numbers, {en, zh}, arrays, null/false (skipped). SVG tags (svg, path, circle, g, text…) get the SVG namespace. */
  function h(tag, attrs, ...kids) {
    if (!isAttrs(attrs)) { if (attrs !== undefined) kids.unshift(attrs); attrs = null; }
    const svg = SVG_TAGS.has(tag);
    const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    if (attrs) setAttrs(el, attrs, svg);
    appendKids(el, kids);
    return el;
  }

  /** s(tag, attrs?, ...children) → an SVG-namespace element for any tag (use for SVG <a>, <title>, <image>, <style>). */
  function s(tag, attrs, ...kids) {
    if (!isAttrs(attrs)) { if (attrs !== undefined) kids.unshift(attrs); attrs = null; }
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) setAttrs(el, attrs, true);
    appendKids(el, kids);
    return el;
  }

  /** content(v) → a Node for 'text' | {en, zh} | Node | array | () => any (null for nothing). */
  function content(v) {
    if (v == null || v === false || v === true) return null;
    if (v instanceof Node) return v;
    if (typeof v === 'function') return content(v());
    if (Array.isArray(v)) {
      const f = document.createDocumentFragment();
      v.forEach((x) => { const n = content(x); if (n) f.appendChild(n); });
      return f;
    }
    if (isBi(v)) return L(v);
    return document.createTextNode(String(v));
  }
  function setContent(el, v) {
    el.textContent = '';
    const n = content(v);
    if (n) el.appendChild(n);
    return el;
  }
  /** plain(v) → the visible text of v in the current language (for tooltips, aria values). */
  function plain(v) {
    if (v == null || v === false || v === true) return '';
    if (typeof v === 'function') return plain(v());
    if (Array.isArray(v)) return v.map(plain).join('');
    if (isBi(v)) return t(v);
    if (v instanceof Element && v.hasAttribute('data-l-en') && !v.children.length) return t(v.getAttribute('data-l-en'), v.getAttribute('data-l-zh'));
    if (v instanceof Node) return v.textContent || '';
    return String(v);
  }
  /** bi(v) → {en, zh} for a string, {en, zh} or an L() node; null for other nodes. */
  function bi(v) {
    if (v == null) return null;
    if (isBi(v)) return { en: String(v.en ?? ''), zh: String(v.zh ?? v.en ?? '') };
    if (v instanceof Element && v.hasAttribute('data-l-en')) return { en: v.getAttribute('data-l-en'), zh: v.getAttribute('data-l-zh') ?? v.getAttribute('data-l-en') };
    if (typeof v === 'string' || typeof v === 'number') return { en: String(v), zh: String(v) };
    return null;
  }

  /** asset(path) → the data URI bundle.py inlined for path (window.PM_ASSETS), else path itself. */
  function asset(path) {
    return (window.PM_ASSETS && window.PM_ASSETS[path]) || path;
  }

  /* ------------------------------------------------------------------ icons (16 × 16, stroke = currentColor) */

  const ICONS = {
    play: '<path d="M5 3.2v9.6L12.8 8z" fill="currentColor" stroke-linejoin="round"/>',
    pause: '<path d="M5.5 3.5v9M10.5 3.5v9"/>',
    replay: '<path d="M3.3 8.7A4.9 4.9 0 1 0 4.7 4.5"/><path d="M4.5 1.8v2.9h2.9"/>',
    chev: '<path d="M6 3.5 10.5 8 6 12.5"/>',
    prev: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
    arrow: '<path d="M2.5 8h11M9 3.5 13.5 8 9 12.5"/>',
    check: '<path d="m3 8.5 3.2 3.2L13 4.8"/>',
    close: '<path d="m4 4 8 8M12 4l-8 8"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    minus: '<path d="M3 8h10"/>',
    reset: '<circle cx="8" cy="8" r="5.2"/><path d="M8 1.2v2.6M8 12.2v2.6M1.2 8h2.6M12.2 8h2.6"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/>',
    external: '<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/>',
  };
  /** icon(name, {label?, size=16}) → inline SVG; decorative (aria-hidden) unless a label is given. */
  function icon(name, { label, size = 16 } = {}) {
    const el = s('svg', { viewBox: '0 0 16 16', width: size, height: size, class: ['pm-ico', `pm-ico-${name}`], focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    el.innerHTML = ICONS[name] || '';
    if (label) { el.setAttribute('role', 'img'); lAttr(el, 'aria-label', label); } else el.setAttribute('aria-hidden', 'true');
    return el;
  }

  /* ------------------------------------------------------------------ motion, viewport, timing math */

  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  if (QUERY.get('motion') === 'reduce') docEl.setAttribute('data-pm-motion', 'reduce');

  /** reduced() → true under prefers-reduced-motion, ?motion=reduce, or <html data-pm-motion="reduce">. */
  function reduced() {
    const forced = docEl.getAttribute('data-pm-motion');
    if (forced === 'reduce') return true;
    if (forced === 'full') return false;
    return !!(motionQuery && motionQuery.matches);
  }

  /** inView(el, cb(visible), {rootMargin, threshold}?) → disconnect. cb runs once at start and on every change. */
  function inView(el, cb, opts = {}) {
    if (typeof IntersectionObserver !== 'function') { cb(true); return () => {}; }
    let last = null;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      const visible = e.isIntersecting;
      if (visible !== last) { last = visible; cb(visible); }
    }, { rootMargin: opts.rootMargin || '0px', threshold: opts.threshold || 0 });
    io.observe(el);
    return () => io.disconnect();
  }

  const ease = {
    linear: (k) => k,
    in: (k) => k * k * k,
    out: (k) => 1 - Math.pow(1 - k, 3),
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  };

  /** span(t, t0, t1, ease?) → progress 0..1 of t inside [t0, t1] (eased when an ease function is given). */
  function span(time, t0, t1, ez) {
    const k = t1 > t0 ? clamp((time - t0) / (t1 - t0), 0, 1) : (time >= t1 ? 1 : 0);
    return typeof ez === 'function' ? ez(k) : k;
  }

  /** step(t, [[t0, v0], [t1, v1], …]) → the value of the last pair whose time ≤ t (before the first: the first value). */
  function step(time, pairs) {
    if (!pairs || !pairs.length) return undefined;
    let v = pairs[0][1];
    for (const [at, val] of pairs) { if (at <= time) v = val; else break; }
    return v;
  }

  /* ------------------------------------------------------------------ number formatting */

  const nfCache = new Map();
  function nf(d) {
    const key = `${lang()}|${d}`;
    if (!nfCache.has(key)) nfCache.set(key, new Intl.NumberFormat(lang() === 'zh' ? 'zh-CN' : 'en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
    return nfCache.get(key);
  }
  const MINUS = '\u2212';
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmt = {
    /** 3651 → "3,651" */
    int(n) { return nf(0).format(Math.round(Number(n) || 0)).replace('-', MINUS); },
    /** fixed decimals: num(75.63, 1) → "75.6" */
    num(n, d = 1) { return nf(d).format(Number(n) || 0).replace('-', MINUS); },
    /** compact: 41200 → "41.2K", 1.2e6 → "1.2M" (as papers print them) */
    k(n, d = 1) {
      const v = Number(n) || 0;
      const a = Math.abs(v);
      if (a >= 1e9) return `${fmt.num(v / 1e9, d)}B`;
      if (a >= 1e6) return `${fmt.num(v / 1e6, d)}M`;
      if (a >= 1e3) return `${fmt.num(v / 1e3, d)}K`;
      return fmt.int(v);
    },
    /** a 0–1 ratio → percent: pct(0.684) → "76%", pct(0.684, 1) → "75.6%" */
    pct(x, d = 0) { return `${fmt.num((Number(x) || 0) * 100, d)}%`; },
    /** milliseconds → timecode: 7000 → "0:07", 3725000 → "1:02:05" */
    time(ms) {
      if (!Number.isFinite(Number(ms))) return '–:––';
      const sec = Math.max(0, Math.round(Number(ms) / 1000));
      const hr = Math.floor(sec / 3600);
      const min = Math.floor((sec % 3600) / 60);
      return hr ? `${hr}:${pad2(min)}:${pad2(sec % 60)}` : `${min}:${pad2(sec % 60)}`;
    },
  };

  /* ------------------------------------------------------------------ controls
   * Only these (and in-scene targets) look interactive (rule R5). A control placed in a part's bar (P or P.bar) goes
   * before the player's transport, so the bar always reads: primary · options · scrubber · time. */

  function place(parent, el) {
    if (!parent) return el;
    const host = parent.bar instanceof Element ? parent.bar : parent;
    const transport = host.classList && host.classList.contains('pm-bar') ? host.querySelector(':scope > .pm-transport') : null;
    host.insertBefore(el, transport);
    return el;
  }

  /** button(parent, label, {kind:'primary'|'secondary'|'ghost', icon?, onClick, ariaLabel?, title?, small?}) → <button>
   * el.setLabel(label) / el.setIcon(name) swap the visible label / icon. */
  function button(parent, label, opts = {}) {
    const { kind = 'secondary', onClick, ariaLabel, title, small } = opts;
    const ico = typeof opts.icon === 'string' ? icon(opts.icon) : opts.icon || null;
    const glyph = kind === 'primary' && ico;
    const el = h('button', {
      type: 'button',
      class: ['pm-btn', `pm-${kind}`, small && 'pm-btn-sm', label == null && 'pm-btn-icon', glyph && 'has-glyph'],
      'aria-label': ariaLabel, title, onClick,
    },
    glyph ? h('span', { class: 'pm-btn-glyph', 'aria-hidden': 'true' }, ico) : ico,
    label == null ? null : h('span', { class: 'pm-btn-label' }, content(label)));
    el.setLabel = (next) => { const slot = el.querySelector('.pm-btn-label'); if (slot) setContent(slot, next); };
    el.setIcon = (name) => {
      const old = el.querySelector('.pm-ico');
      const next = typeof name === 'string' ? icon(name) : name;
      if (old && next) old.replaceWith(next);
    };
    return place(parent, el);
  }

  /** segmented(parent, {options:[{id, label}], value, onChange(id), ariaLabel?}) → {el, set(id, {silent}?), value} */
  function segmented(parent, { options = [], value, onChange, ariaLabel } = {}) {
    const idOf = (o) => (o.id != null ? o.id : o.value);
    let cur = value != null ? value : options.length ? idOf(options[0]) : null;
    const el = h('div', { class: 'pm-seg', role: 'group', 'aria-label': ariaLabel });
    const btns = new Map();
    const sync = () => { for (const [k, b] of btns) b.setAttribute('aria-pressed', String(k === cur)); };
    const api = {
      el,
      get value() { return cur; },
      set(id, { silent = false } = {}) {
        if (!btns.has(id)) return;
        const changed = id !== cur;
        cur = id;
        sync();
        if (changed && !silent && onChange) onChange(id);
      },
    };
    for (const o of options) {
      const b = h('button', { type: 'button', class: 'pm-seg-btn', disabled: o.disabled, onClick: () => api.set(idOf(o)) }, content(o.label));
      btns.set(idOf(o), b);
      el.append(b);
    }
    el.addEventListener('keydown', (e) => {
      const ids = [...btns.keys()];
      const i = ids.indexOf(cur);
      let next = null;
      if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
      else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
      if (next == null) return;
      e.preventDefault();
      api.set(next);
      btns.get(next).focus();
    });
    sync();
    place(parent, el);
    return api;
  }

  /** toggle(parent, {label, value=false, onChange(v), ariaLabel?}) → {el, set(v, {silent}?), value} — a switch. */
  function toggle(parent, { label, value = false, onChange, ariaLabel } = {}) {
    let on = !!value;
    const el = h('button', { type: 'button', class: 'pm-toggle', role: 'switch', 'aria-checked': String(on), 'aria-label': ariaLabel, onClick: () => api.set(!on) },
      h('span', { class: 'pm-toggle-track', 'aria-hidden': 'true' }, h('span', { class: 'pm-toggle-knob' })),
      label != null ? h('span', { class: 'pm-toggle-label' }, content(label)) : null);
    const api = {
      el,
      get value() { return on; },
      set(v, { silent = false } = {}) {
        const changed = !!v !== on;
        on = !!v;
        el.setAttribute('aria-checked', String(on));
        if (changed && !silent && onChange) onChange(on);
      },
    };
    place(parent, el);
    return api;
  }

  /** target(el, {onActivate, label?, pressed?}) → el: an in-scene thing the reader points at (a window, a layer, a
   * tile). Hover glow, pointer cursor, focus ring, Enter/Space, role=button when it is not a native control. */
  function target(el, { onActivate, label, pressed } = {}) {
    el.classList.add('pm-target');
    const native = el.matches('button, a[href], input, select, textarea, summary');
    if (!native) {
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (onActivate) onActivate(e); }
      });
    }
    if (onActivate) el.addEventListener('click', onActivate);
    if (label) lAttr(el, 'aria-label', label);
    if (pressed != null) el.setAttribute('aria-pressed', String(!!pressed));
    return el;
  }

  /** langToggle(parent?) → <button> "EN / 中文" that switches the page language (place it inside .pm). */
  function langToggle(parent) {
    const b = h('button', {
      type: 'button', class: 'pm-lang',
      'aria-label': { en: 'Switch to Chinese', zh: 'Switch to English' },
      onClick: () => setLang(lang() === 'zh' ? 'en' : 'zh'),
    },
    h('span', { class: 'pm-lang-opt', 'data-pm-lang': 'en' }, 'EN'),
    h('span', { class: 'pm-lang-sep', 'aria-hidden': 'true' }, '/'),
    h('span', { class: 'pm-lang-opt', 'data-pm-lang': 'zh', lang: 'zh-CN' }, '中文'));
    if (parent) parent.append(b);
    return b;
  }

  /* ------------------------------------------------------------------ code: a tiny highlighter
   * Each tokenizer returns [[cls|null, text], …]; cls maps to .pm-tk-<cls> (kw, str, num, com, fn, key). */

  const CALL_RE = /[ \t]*\(/y;
  /** shared word classifier: keywords, definitions after def/function/class, calls (word followed by "("). */
  function wordClass(word, prev, afterDot, src, endIndex, kw, ctxKw) {
    CALL_RE.lastIndex = endIndex;
    const call = CALL_RE.test(src);
    if (!afterDot && kw.has(word) && !(ctxKw && ctxKw.has(word) && call)) return 'kw';
    if (prev === 'def' || prev === 'function' || prev === 'class') return 'fn';
    return call ? 'fn' : null;
  }

  const PY_KW = new Set(('and as assert async await break class continue def del elif else except finally for from global if '
    + 'import in is lambda nonlocal not or pass raise return try while with yield match case True False None').split(' '));
  const PY_CTX = new Set(['match', 'case']);
  const PY_RE = /(#[^\n]*)|((?:\b[rRbBuUfF]{1,2})?(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?))|(@[A-Za-z_][\w.]*)|(\b(?:0[xXoObB][\da-fA-F_]+|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?j?)\b)|([A-Za-z_][A-Za-z0-9_]*)|([ \t]+|\n)|([\s\S])/g;
  function tokPython(src) {
    const out = [];
    let prev = '';
    let dot = false;
    let m;
    PY_RE.lastIndex = 0;
    while ((m = PY_RE.exec(src))) {
      const [text, com, str, dec, num, word, ws] = m;
      if (com) out.push(['com', text]);
      else if (str) out.push(['str', text]);
      else if (dec) out.push(['fn', text]);
      else if (num) out.push(['num', text]);
      else if (word) { out.push([wordClass(word, prev, dot, src, PY_RE.lastIndex, PY_KW, PY_CTX), text]); prev = word; dot = false; continue; }
      else out.push([null, text]);
      if (!ws) { prev = ''; dot = text === '.'; }
    }
    return out;
  }

  const JS_KW = new Set(('break case catch class const continue debugger default delete do else export extends finally for '
    + 'function if import in instanceof let new of return static super switch this throw try typeof var void while with '
    + 'yield async await from as get set true false null undefined NaN Infinity').split(' '));
  const JS_CTX = new Set(['of', 'from', 'as', 'get', 'set', 'async', 'static']);
  const JS_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(`(?:\\[\s\S]|[^`\\])*`?|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b(?:0[xXoObB][\da-fA-F_]+n?|\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?)\b)|([A-Za-z_$][\w$]*)|([ \t]+|\n)|([\s\S])/g;
  function tokJs(src) {
    const out = [];
    let prev = '';
    let dot = false;
    let m;
    JS_RE.lastIndex = 0;
    while ((m = JS_RE.exec(src))) {
      const [text, com, str, num, word, ws] = m;
      if (com) out.push(['com', text]);
      else if (str) out.push(['str', text]);
      else if (num) out.push(['num', text]);
      else if (word) { out.push([wordClass(word, prev, dot, src, JS_RE.lastIndex, JS_KW, JS_CTX), text]); prev = word; dot = false; continue; }
      else out.push([null, text]);
      if (!ws) { prev = ''; dot = text === '.' || text === '?.'; }
    }
    return out;
  }

  const JSON_RE = /("(?:\\.|[^"\\\n])*"?)(\s*:)?|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)|(\s+)|([\s\S])/g;
  function tokJson(src) {
    const out = [];
    let m;
    JSON_RE.lastIndex = 0;
    while ((m = JSON_RE.exec(src))) {
      const [text, str, colon, num, kw] = m;
      if (str) { out.push([colon ? 'key' : 'str', str]); if (colon) out.push([null, colon]); }
      else if (num) out.push(['num', text]);
      else if (kw) out.push(['kw', text]);
      else out.push([null, text]);
    }
    return out;
  }

  const SH_KW = new Set('if then else elif fi for in do done while until case esac function return local export set unset'.split(' '));
  const SH_RE = /(#[^\n]*)|('[^']*'?|"(?:\\.|[^"\\])*"?)|(\$\{[^}\n]*\}|\$\(|\$[\w@#?$!*-])|(--?[A-Za-z][\w-]*)|(\b\d+\b)|([A-Za-z_./~][\w./~:@-]*)|(\|\||&&|[|;&()\n])|([ \t]+)|([\s\S])/g;
  function tokBash(src) {
    const out = [];
    let cmd = true;
    let prevCh = '\n';
    let m;
    SH_RE.lastIndex = 0;
    while ((m = SH_RE.exec(src))) {
      const [text, com, str, vr, flag, num, word, sep, ws] = m;
      if (com && /[\s;|&(]/.test(prevCh)) out.push(['com', text]);
      else if (com) { out.push([null, '#']); SH_RE.lastIndex = m.index + 1; prevCh = '#'; continue; }
      else if (str) { out.push(['str', text]); cmd = false; }
      else if (vr) { out.push(['num', text]); cmd = text === '$('; }
      else if (flag) out.push([/\s/.test(prevCh) ? 'key' : null, text]);
      else if (num) { out.push(['num', text]); cmd = false; }
      else if (word) {
        if (SH_KW.has(word)) { out.push(['kw', text]); cmd = !['in', 'function', 'export', 'local', 'set', 'unset', 'return'].includes(word); }
        else if (cmd) { out.push(['fn', text]); cmd = false; }
        else out.push([null, text]);
      } else if (sep) { out.push([null, text]); cmd = true; }
      else out.push([null, text]);
      prevCh = ws != null ? ' ' : text[text.length - 1];
    }
    return out;
  }

  const LANGS = { python: tokPython, py: tokPython, js: tokJs, javascript: tokJs, ts: tokJs, json: tokJson, bash: tokBash, sh: tokBash, shell: tokBash };
  function tokenize(src, language) {
    const fn = LANGS[String(language || 'text').toLowerCase()];
    return fn ? fn(src) : [[null, src]];
  }

  /** highlightLines(src, lang) → one HTML string per source line (token spans never cross a line). */
  function highlightLines(src, language) {
    const lines = [''];
    for (const [cls, text] of tokenize(String(src ?? ''), language)) {
      text.split('\n').forEach((part, i) => {
        if (i > 0) lines.push('');
        if (part) lines[lines.length - 1] += cls ? `<span class="pm-tk-${cls}">${esc(part)}</span>` : esc(part);
      });
    }
    return lines;
  }

  /* ------------------------------------------------------------------ code pane */

  const ELIDED = /^\s*(…|\.\.\.|⋯)\s*$/;
  const MARK_TONES = ['run', 'ok', 'err', 'warn', 'dim'];
  const LANG_NAMES = { python: 'Python', py: 'Python', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', json: 'JSON', bash: 'Bash', sh: 'Shell', shell: 'Shell', text: '' };

  /** Wrap the characters [a, b) of root's text in span.pm-focus (across token spans; splits text nodes). */
  function wrapRange(root, a, b) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    let off = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.nodeValue.length;
      const x = Math.max(a, off);
      const y = Math.min(b, off + len);
      if (x < y) hits.push([n, x - off, y - off]);
      off += len;
    }
    hits.forEach(([n, x, y], i) => {
      let mid = n;
      if (x > 0) mid = mid.splitText(x);
      if (y - x < mid.nodeValue.length) mid.splitText(y - x);
      const w = document.createElement('span');
      w.className = `pm-focus${i === 0 ? ' is-first' : ''}${i === hits.length - 1 ? ' is-last' : ''}`;
      mid.parentNode.insertBefore(w, mid);
      w.appendChild(mid);
    });
  }

  /**
   * code(parent, {src, lang:'python'|'js'|'bash'|'json'|'text', title?, lineNumbers=true, start=1, lineMap?, maxHeight?,
   *              focus?:[string], marks?:{[line]: 'run'|'ok'|'err'|'warn'|'dim'}, ariaLabel?})
   * → {el, scroller, set(src, opts?), mark(line, tone|null), clear(), focus(tokens), reveal(line)}
   * Never wraps: the pane scrolls both ways inside itself with a sticky line-number gutter and shows a "scroll" hint
   * while there is more to see. A line that is only "…" renders muted, unnumbered (elision). Focus tokens (the decisive
   * text, e.g. window="Report.xlsx") get a glowing outline wherever they occur. Line numbers in marks are displayed numbers.
   */
  function code(parent, opts = {}) {
    let o = { lang: 'text', lineNumbers: true, start: 1, ...opts };
    let marks = { ...(o.marks || {}) };
    let tokens = [].concat(o.focus || []).filter(Boolean);
    let rows = [];
    let scrolled = false;

    const body = h('code', { class: 'pm-code-body' });
    const pre = h('pre', { class: 'pm-code-pre' }, body);
    const scroller = h('div', { class: 'pm-code-scroll' }, pre);
    const hint = h('span', { class: 'pm-code-hint', 'aria-hidden': 'true', hidden: true });
    const titleEl = h('span', { class: 'pm-code-title' });
    const langEl = h('span', { class: 'pm-code-lang' });
    const head = h('div', { class: 'pm-code-head' }, titleEl, langEl);
    const view = h('div', { class: 'pm-code-view' }, scroller, hint);
    const root = h('div', { class: 'pm-code', translate: 'no' }, head, view);

    function applyOptions() {
      head.hidden = o.title == null;
      setContent(titleEl, o.title);
      // the "scroll" hint sits in the head when there is one, else over the code's bottom-right corner
      if (o.title != null) head.insertBefore(hint, langEl); else view.append(hint);
      langEl.textContent = LANG_NAMES[String(o.lang).toLowerCase()] ?? String(o.lang);
      root.classList.toggle('no-ln', !o.lineNumbers);
      body.className = `pm-code-body pm-lang-${o.lang}`;
      const mh = o.maxHeight;
      scroller.style.maxHeight = mh == null ? '' : typeof mh === 'number' ? `${mh}px` : String(mh);
      lAttr(scroller, 'aria-label', o.ariaLabel || { en: 'Code', zh: '代码' });
    }

    function render() {
      const src = String(o.src ?? '').replace(/\r\n?/g, '\n').replace(/^\n+/, '').replace(/\s+$/, '');
      const html = highlightLines(src, o.lang);
      let n = o.start;
      rows = src.split('\n').map((line, i) => {
        const elided = ELIDED.test(line);
        let num = null;
        if (o.lineMap) num = o.lineMap[i] == null ? null : o.lineMap[i];
        else if (!elided) num = n++;
        return { num, elided, html: html[i] || '' };
      });
      const maxNum = rows.reduce((mx, r) => (r.num != null ? Math.max(mx, r.num) : mx), 0);
      body.innerHTML = rows.map((r) => `<span class="pm-cl${r.elided ? ' is-elided' : ''}"${r.num != null ? ` data-n="${r.num}"` : ''}>`
        + `<span class="pm-ln" aria-hidden="true">${r.num == null ? '' : r.num}</span>`
        + `<span class="pm-lc">${r.elided ? '…' : r.html}</span></span>`).join('');
      Array.from(body.children).forEach((el, i) => { rows[i].el = el; });
      root.style.setProperty('--pm-ln-ch', String(Math.max(2, String(maxNum).length)));
      applyMarks();
      applyFocus();
      requestAnimationFrame(overflow);
    }

    function applyMarks() {
      for (const r of rows) {
        const tone = r.num == null ? null : marks[r.num];
        for (const k of MARK_TONES) r.el.classList.toggle(`is-${k}`, tone === k);
      }
    }

    function applyFocus() {
      const list = tokens.map(String).filter(Boolean).sort((a, b) => b.length - a.length);
      if (!list.length) return;
      for (const r of rows) {
        if (r.elided) continue;
        const lc = r.el.lastChild;
        const text = lc.textContent;
        const ranges = [];
        for (const tok of list) {
          for (let at = text.indexOf(tok); at >= 0; at = text.indexOf(tok, at + tok.length)) {
            if (!ranges.some(([a, b]) => at < b && at + tok.length > a)) ranges.push([at, at + tok.length]);
          }
        }
        ranges.forEach(([a, b]) => wrapRange(lc, a, b));
      }
    }

    /* overflow state: .is-ox / .is-oy, the edge fade (.is-end-x) and the "scroll" hint until the reader scrolls */
    function overflow() {
      const ox = scroller.scrollWidth > scroller.clientWidth + 1;
      const oy = scroller.scrollHeight > scroller.clientHeight + 1;
      root.classList.toggle('is-ox', ox);
      root.classList.toggle('is-oy', oy);
      root.classList.toggle('is-end-x', scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2);
      if (ox || oy) { scroller.tabIndex = 0; scroller.setAttribute('role', 'region'); } else { scroller.removeAttribute('tabindex'); scroller.removeAttribute('role'); }
      hint.hidden = !(ox || oy) || scrolled;
      if (!hint.hidden) {
        hint.textContent = '';
        hint.append(L('scroll', '滑动'), ` ${ox && oy ? '→↓' : ox ? '→' : '↓'}`);
      }
    }
    scroller.addEventListener('scroll', () => {
      if (!scrolled && (scroller.scrollLeft > 4 || scroller.scrollTop > 4)) { scrolled = true; hint.hidden = true; }
      root.classList.toggle('is-end-x', scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2);
    }, { passive: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(overflow).observe(scroller);

    const api = {
      el: root,
      scroller,
      /** set(src?, opts?) — new source and/or options (marks, focus, lang, title, maxHeight…) */
      set(src, more = {}) {
        if (src != null && typeof src === 'object' && !(src instanceof String)) { more = src; src = undefined; }
        o = { ...o, ...more };
        if (src !== undefined) o.src = src;
        if (more.marks) marks = { ...more.marks };
        if (more.focus) tokens = [].concat(more.focus).filter(Boolean);
        applyOptions();
        render();
        return api;
      },
      /** mark(line, tone) highlights a displayed line ('run' | 'ok' | 'err' | 'warn' | 'dim'); tone null clears it.
       * mark({line: tone, …}) replaces every mark. */
      mark(line, tone) {
        if (line != null && typeof line === 'object') marks = { ...line };
        else if (tone) marks[line] = tone;
        else delete marks[line];
        applyMarks();
        return api;
      },
      /** clear() removes every mark and focus token. */
      clear() { marks = {}; tokens = []; render(); return api; },
      /** focus(tokens) — outline these substrings (string or array; [] clears). */
      focus(list) { tokens = [].concat(list || []).filter(Boolean); render(); return api; },
      /** reveal(line) scrolls the pane (never the page) so the line is in view. */
      reveal(line, { smooth = true } = {}) {
        const r = rows.find((x) => x.num === line);
        if (!r || scroller.scrollHeight <= scroller.clientHeight + 1) return api;
        const top = r.el.offsetTop;
        const bottom = top + r.el.offsetHeight;
        let to = null;
        if (top < scroller.scrollTop + 8) to = top - 8;
        else if (bottom > scroller.scrollTop + scroller.clientHeight - 8) to = bottom - scroller.clientHeight + 8;
        if (to != null) scroller.scrollTo({ top: Math.max(0, to), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
        return api;
      },
      get lines() { return rows.length; },
    };
    applyOptions();
    render();
    if (parent) (parent.scene instanceof Element ? parent.scene : parent).append(root);
    return api;
  }

  /** intent(parent, text) → el: the plain-language line above a code pane ("<intent> Save the report, then close it"). */
  function intent(parent, text) {
    const el = h('div', { class: 'pm-intent' },
      h('span', { class: 'pm-intent-tag', 'aria-hidden': 'true' }, '<intent>'),
      h('span', { class: 'pm-sr' }, L('Intent: ', '意图：')),
      h('span', { class: 'pm-intent-text' }, content(text)));
    if (parent) parent.append(el);
    return el;
  }

  /* ------------------------------------------------------------------ source line, readouts, folds */

  const SOURCE_KINDS = {
    sim: { glyph: '◇', text: { en: 'Simulation', zh: '模拟' } },
    real: { glyph: '●', text: { en: 'Real run', zh: '真实运行' } },
    paper: { glyph: '¶', text: { en: 'Paper', zh: '论文' } },
    note: { glyph: '※', text: null },
  };

  /** Render [{kind, text}] into el as one plain line: "◇ Simulation · ¶ Paper §4.1" (glyph + text; never boxed). */
  function renderSource(el, list) {
    el.textContent = '';
    const items = (Array.isArray(list) ? list : list ? [list] : []).filter(Boolean);
    items.forEach((it, i) => {
      const kind = SOURCE_KINDS[it.kind] ? it.kind : 'note';
      const def = SOURCE_KINDS[kind];
      if (i) el.append(h('span', { class: 'pm-src-sep', 'aria-hidden': 'true' }, ' · '));
      el.append(h('span', { class: ['pm-src', `pm-src-${kind}`] },
        h('span', { class: 'pm-src-glyph', 'aria-hidden': 'true' }, def.glyph),
        content(it.text != null ? it.text : def.text)));
    });
  }

  /** source(P, [{kind:'sim'|'real'|'paper'|'note', text}]) — re-render a part's source line. */
  function source(P, list) {
    const el = P && P.el ? P.el.querySelector(':scope > .pm-source') : P;
    if (el) renderSource(el, list);
    return el;
  }

  const EMPTY = new Set([null, undefined, '', '—', '–', '-']);
  /** readouts(P.outcome | P, [{id, label, value='—', tone?, unit?, sub?}]) → {el, set(id, value, tone?), get(id), reset()}
   * Big tabular numbers between hairlines. set() keeps the unit; '—' (or null) shows the faint "no result yet" state. */
  function readouts(target, items = []) {
    const host = target && target.outcome instanceof Element ? target.outcome : target;
    const cells = new Map();
    const shown = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? fmt.int(v) : fmt.num(v, 1)) : v);
    for (const it of items) {
      const value = h('span', { class: 'pm-ro-num' });
      const unit = it.unit != null ? h('span', { class: 'pm-ro-unit' }, content(it.unit)) : null;
      const el = h('div', { class: 'pm-ro', dataset: { ro: it.id } },
        h('span', { class: 'pm-ro-label' }, content(it.label)),
        h('span', { class: 'pm-ro-value' }, value, unit),
        it.sub != null ? h('span', { class: 'pm-ro-sub' }, content(it.sub)) : null);
      cells.set(it.id, { el, value, tone: null, v: null, init: it });
      host.append(el);
    }
    const api = {
      el: host,
      set(id, v, tone) {
        const c = cells.get(id);
        if (!c) return api;
        c.v = v;
        const empty = EMPTY.has(v);
        setContent(c.value, empty ? '—' : shown(v));
        c.el.classList.toggle('is-empty', empty);
        if (tone !== undefined) {
          if (c.tone) c.el.classList.remove(`pm-tone-${c.tone}`);
          c.tone = tone || null;
          if (c.tone) c.el.classList.add(`pm-tone-${c.tone}`);
        }
        return api;
      },
      get(id) { const c = cells.get(id); return c ? c.v : undefined; },
      reset() { for (const [id, c] of cells) api.set(id, c.init.value ?? '—', c.init.tone || null); return api; },
    };
    for (const it of items) api.set(it.id, it.value ?? '—', it.tone || null);
    return api;
  }

  function buildFold(f, i) {
    const body = h('div', { class: 'pm-fold-body' });
    const det = h('details', { class: 'pm-fold', dataset: { fold: f.id || String(i + 1) } },
      h('summary', null,
        h('span', { class: 'pm-fold-chev', 'aria-hidden': 'true' }, icon('chev')),
        h('span', { class: 'pm-fold-title' }, content(f.title)),
        f.teaser != null ? h('span', { class: 'pm-fold-teaser' }, content(f.teaser)) : null),
      body);
    let rendered = false;
    det.addEventListener('toggle', () => {
      if (det.open && !rendered) {
        rendered = true;
        try {
          const out = typeof f.render === 'function' ? f.render(body) : f.body;
          if (out != null && out !== body && !(out instanceof Node && body.contains(out))) { const n = content(out); if (n) body.append(n); }
        } catch (err) {
          console.error(`[PM] fold "${plain(f.title)}" failed to render`, err);
          body.append(L('This section failed to load.', '这一部分加载失败。', 'p', { class: 'pm-fold-error' }));
        }
      }
      det.dispatchEvent(new CustomEvent('pm:fold', { bubbles: true, detail: { index: i, open: det.open } }));
    });
    return det;
  }

  /** fold(parent, {title, teaser?, render(el)}) → <details class="pm-fold"> outside the part template (closed; the
   * body renders on first open). Inside a part, pass folds to PM.part instead. */
  function fold(parent, f = {}) {
    const det = buildFold(f, 0);
    if (parent) parent.append(det);
    return det;
  }

  /* ------------------------------------------------------------------ the part template */

  let partSeq = 0;
  /**
   * part(host, {id, eyebrow?, q, lead?, takeaway?, source?:[{kind, text}], folds?:[{title, teaser?, render(el)}], flush?})
   * → P = {id, el, bar, scene, narration, outcome, stage, takeaway, folds, setSource(list), markRun(), fold(i), player}
   * Appends one section to host (host gets .pm when no ancestor has it). DOM contract (lint.mjs relies on it):
   *   section.pm-part#<id>[data-pm-part] > .pm-eyebrow? h3.pm-q p.pm-lead? .pm-stage(.pm-bar .pm-scene .pm-narration)
   *   p.pm-source .pm-outcome p.pm-takeaway .pm-deeper > details.pm-fold > summary(.pm-fold-title .pm-fold-teaser) .pm-fold-body
   */
  function part(host, def = {}) {
    if (!host) throw new Error('[PM] part(host, def): host element missing');
    if (!host.closest('.pm')) host.classList.add('pm');
    const id = def.id || `part-${++partSeq}`;
    if (def.q == null) console.warn(`[PM] part "${id}": q (the one plain question) is required`);
    const qId = `${id}-q`;
    const bar = h('div', { class: 'pm-bar' });
    const scene = h('div', { class: ['pm-scene', def.flush && 'pm-flush'] });
    const narration = h('div', { class: 'pm-narration', 'aria-live': 'polite' });
    const stage = h('div', { class: 'pm-stage' }, bar, scene, narration);
    const sourceEl = h('p', { class: 'pm-source' });
    const outcome = h('div', { class: 'pm-outcome', role: 'group', 'aria-label': { en: 'Result', zh: '结果' } });
    const takeaway = h('p', { class: 'pm-takeaway' }, content(def.takeaway));
    const deeper = h('div', { class: 'pm-deeper' });
    const folds = (def.folds || []).map(buildFold);
    if (folds.length > 4) console.warn(`[PM] part "${id}": ${folds.length} folds; the budget is 4`);
    if (folds.length) deeper.append(L('Go deeper', '深入了解', 'p', { class: 'pm-deeper-label' }), ...folds);
    const el = h('section', { class: 'pm-part', id, dataset: { pmPart: id, pmState: 'static' }, 'aria-labelledby': qId },
      def.eyebrow != null ? h('p', { class: 'pm-eyebrow' }, content(def.eyebrow)) : null,
      h('h3', { class: 'pm-q', id: qId }, content(def.q)),
      def.lead != null ? h('p', { class: 'pm-lead' }, content(def.lead)) : null,
      stage, sourceEl, outcome, takeaway, deeper);
    let lit = false;
    const P = {
      id, el, bar, scene, narration, outcome, stage, takeaway, deeper, folds, player: null,
      setSource(list) { renderSource(sourceEl, list); return P; },
      /** markRun() — the takeaway brightens (after the first run; it stays lit). The player calls it on done. */
      markRun() { if (!lit) { lit = true; takeaway.classList.add('is-lit'); } return P; },
      /** fold(i) → the i-th <details> (set .open = true to open it; its body renders on first open). */
      fold(i) { return folds[i] || null; },
    };
    if (def.source) P.setSource(def.source);
    host.append(el);
    return P;
  }

  /* ------------------------------------------------------------------ the player: a story on a virtual clock
   *
   * The kit owns the clock. Every wait and every motion of a script goes through ctx.sleep / ctx.tween, so one script can
   *   - play in real time (a rAF driver advances the clock),
   *   - be measured instantly (every wait resolves at once: total duration, captions, marks → scrubber ticks),
   *   - be sought to any time (reset(), then re-run instantly up to that time; tweens land on their clamped k),
   *   - be captured frame by frame (setManual(true) + advance(ms), or seek(t) per frame).
   * A wait is a thenable: awaiting it moves the script's own clock (ctx.now) to the wait's end, so the next wait starts
   * exactly there whatever the frame timing was. When a wait is created it catches up with the clock at once, so a
   * frame always shows the state of its own time. Scripts must be deterministic: no Date, Math.random, setTimeout or CSS
   * transitions for meaning; await only ctx.* calls (Promise.all of them is fine). */

  const NEVER = new Promise(() => {});
  const WORDS = {
    play: { en: 'Play', zh: '播放' },
    pause: { en: 'Pause', zh: '暂停' },
    resume: { en: 'Resume', zh: '继续' },
    replay: { en: 'Replay', zh: '重播' },
    scrub: { en: 'Playback position. Arrow keys jump between moments.', zh: '播放进度。方向键在关键时刻之间跳转。' },
  };
  const NARR_KEEP = 4;            // reduced motion: captions kept in the list
  const GUARD_WAITS = 20000;      // instant runs: a script that never ends is stopped here …
  const GUARD_MS = 1500;          // … or after this much wall time
  const TONES = new Set(['ok', 'err', 'warn', 'info', 'agent', 'user', 'accent', 'neutral']);
  const toneOf = (v) => { const x = v && typeof v === 'object' ? v.tone : v; return x && TONES.has(x) ? x : null; };

  PM.players = PM.players || {};

  /** The {duration, render(t)} form as a script: one tween per segment between captions and marks. */
  function timelineScript(def) {
    const dur = Math.max(0, Number(def.duration) || 0);
    const evs = [];
    for (const c of def.captions || []) {
      const [at, text, tone] = Array.isArray(c) ? c : [c.t, c.text, c.tone];
      evs.push({ t: clamp(Number(at) || 0, 0, dur), kind: 'cap', text, tone });
    }
    for (const m of def.marks || []) {
      const [at, label, tone] = Array.isArray(m) ? m : [m.t, m.label, m.tone];
      evs.push({ t: clamp(Number(at) || 0, 0, dur), kind: 'mark', text: label, tone });
    }
    evs.sort((a, b) => a.t - b.t || (a.kind === 'cap' ? -1 : 1));
    return async (ctx) => {
      const info = { duration: dur };
      const render = (time) => def.render(time, info);
      let at = 0;
      const to = async (end) => {
        if (end <= at) return;
        const a = at;
        const len = end - a;
        at = end;
        await ctx.tween(len, (k) => render(a + len * k));
      };
      render(0);
      for (const ev of evs) {
        await to(ev.t);
        if (ev.kind === 'mark') ctx.mark(ev.text, ev.tone); else ctx.narrate(ev.text, ev.tone);
      }
      await to(dur);
    };
  }

  /**
   * player(P, {reset(), run(ctx)} | {duration, render(t), reset?, captions?:[{t, text, tone}], marks?:[{t, label, tone}]},
   *           + {label?, labels?:{pause, resume, replay}, hint?, onDone?(), autoPause=true})
   * → {el, primary, scrub, ready, state, duration, marks, beats, time, play(), pause(), resume(), replay(), seek(ms, {pause}?),
   *    reset(), advance(ms), setManual(bool), measure(), onState(cb) → off}
   * ctx = {sleep(ms), tween(ms, fn(k), ease?), narrate(text, tone?), mark(label, tone?), seeking, measuring, reduced, now, signal}
   * Every method that changes time returns a Promise that settles once the scene shows that time.
   */
  function player(P, def = {}) {
    if (!P || !(P.bar instanceof Element) || !(P.scene instanceof Element)) throw new Error('[PM] player(P, def): P must come from PM.part()');
    const id = P.id;
    const partEl = P.el;
    /** The page's sticky header height: the bar's own computed top (it sticks at var(--pm-sticky-top)). */
    const stickyTop = () => { const v = parseFloat(getComputedStyle(P.bar).top); return Number.isFinite(v) ? v : 0; };
    const timelineForm = typeof def.render === 'function';
    const script = timelineForm ? timelineScript(def) : def.run;
    if (typeof script !== 'function') throw new Error(`[PM] player "${id}": pass run(ctx) or duration + render(t)`);
    const resetScene = timelineForm
      ? () => { if (def.reset) def.reset(); def.render(0, { duration: Math.max(0, Number(def.duration) || 0) }); }
      : def.reset;
    if (typeof resetScene !== 'function') console.warn(`[PM] player "${id}": pass reset() so the kit can measure, seek and replay the story`);
    if (timelineForm && !(Number(def.duration) > 0)) console.warn(`[PM] player "${id}": the timeline form needs duration > 0 (ms)`);
    const labels = {
      play: def.label != null ? def.label : WORDS.play,
      pause: (def.labels && def.labels.pause) || WORDS.pause,
      resume: (def.labels && def.labels.resume) || WORDS.resume,
      replay: (def.labels && def.labels.replay) || WORDS.replay,
    };
    const hint = def.hint !== undefined ? def.hint : (() => {
      const b = bi(labels.play);
      return b ? { en: `Press “${b.en}” to watch it happen.`, zh: `按“${b.zh}”观看过程。` } : null;
    })();

    /* ---- bar: primary · (options the page adds) · transport */
    const primary = button(null, labels.play, { kind: 'primary', icon: 'play', onClick: () => onPrimary() });
    // The button is as wide as its widest label (Play / Pause / Resume / Replay, in the current language), so nothing
    // in the bar moves when the label changes: every label sits, hidden, in the same grid cell as the visible one.
    {
      const slot = primary.querySelector('.pm-btn-label');
      const sizer = h('span', { class: 'pm-btn-sizer', 'aria-hidden': 'true' },
        [labels.play, labels.pause, labels.resume, labels.replay].map((l) => h('span', null, l instanceof Node ? l.cloneNode(true) : content(l))));
      const stack = h('span', { class: 'pm-btn-stack' });
      slot.replaceWith(stack);
      stack.append(slot, sizer);
    }
    P.bar.prepend(primary);
    // .is-stuck on the stage while its bar sticks under the page header (phones show a compact bar then)
    {
      const setStuck = (on) => {
        if (on === P.stage.classList.contains('is-stuck')) return;
        // the compact bar is shorter; a bottom margin of the difference keeps everything below where it was
        const h0 = P.bar.offsetHeight;
        P.stage.classList.toggle('is-stuck', on);
        const d = on ? Math.max(0, h0 - P.bar.offsetHeight) : 0;
        P.bar.style.marginBottom = d ? `${d}px` : '';
      };
      // decided from positions on every scroll frame (an observer misses jumps such as anchor links)
      let stickRaf = 0;
      const checkStuck = () => {
        stickRaf = 0;
        const top = stickyTop();
        const r = P.stage.getBoundingClientRect();
        setStuck(r.top < top - 1 && r.bottom > top + 40);
      };
      const queueStuck = () => { if (!stickRaf) stickRaf = requestAnimationFrame(checkStuck); };
      window.addEventListener('scroll', queueStuck, { passive: true });
      window.addEventListener('resize', queueStuck, { passive: true });
      queueStuck();
    }
    const fill = h('span', { class: 'pm-scrub-fill' });
    const ticks = h('span', { class: 'pm-scrub-ticks', 'aria-hidden': 'true' });
    const knob = h('span', { class: 'pm-scrub-head' });
    const track = h('span', { class: 'pm-scrub-track' }, fill, ticks, knob);
    const tip = h('span', { class: 'pm-scrub-tip', 'aria-hidden': 'true', hidden: true });
    const scrub = h('div', { class: 'pm-scrub', role: 'slider', tabindex: '0', 'aria-label': WORDS.scrub, 'aria-valuemin': '0', 'aria-valuemax': '0', 'aria-valuenow': '0' }, track, tip);
    const tCur = h('span', { class: 'pm-time-cur' }, '0:00');
    const tTot = h('span', { class: 'pm-time-total' }, '–:––');
    const timeEl = h('span', { class: 'pm-time', 'aria-hidden': 'true' }, tCur, h('span', { class: 'pm-time-sep' }, ' / '), tTot);
    P.bar.append(h('div', { class: 'pm-transport' }, scrub, timeEl));
    /* ---- narration: one live caption (two lines reserved) */
    const lines = h('div', { class: 'pm-narr-lines' });
    P.narration.textContent = '';
    P.narration.append(h('span', { class: 'pm-narr-dot', 'aria-hidden': 'true' }), lines);

    let state = 'idle';
    let run = null;            // the run on screen: live, or a seek catching up
    let measuring = null;      // a measure run in progress
    let timeline = null;       // {total, beats:[{t, text, tone}], marks:[{t, label, tone}]}
    let manual = false;
    let opSeq = 0;             // every play / seek / reset bumps it; stale async steps bail out
    let rafId = 0;
    let lastFrame = 0;
    let autoPaused = false;
    let holdDepth = 0;
    let readyDone = null;
    const ready = new Promise((r) => { readyDone = r; });
    const subs = new Set();

    /* ---- transitions off while the clock jumps (.pm-seeking); styles are flushed before they come back on, so
     * nothing animates from the old state to the new one */
    function hold(delta) {
      holdDepth = Math.max(0, holdDepth + delta);
      if (holdDepth > 0) { partEl.classList.add('pm-seeking'); P.narration.setAttribute('aria-busy', 'true'); return; }
      void P.scene.offsetWidth;
      partEl.classList.remove('pm-seeking');
      P.narration.removeAttribute('aria-busy');
    }

    /* ---- runs and waits */
    function newRun(mode, vt) {
      return {
        mode, vt, now: 0, maxEnd: 0, waits: [], count: 0, t0: performance.now(),
        token: { aborted: false }, ctrl: typeof AbortController === 'function' ? new AbortController() : null,
        scriptDone: false, failed: false, completed: false, beats: [], marks: [], onComplete: null, onAbort: null,
      };
    }
    function abort(r) {
      if (!r || r.token.aborted) return;
      r.token.aborted = true;
      r.waits = [];
      if (r.ctrl) r.ctrl.abort();
      if (r.onAbort) { const f = r.onAbort; r.onAbort = null; f(); }
    }
    function stopAll() {
      stopLoop();
      if (run) { abort(run); run = null; }
      if (measuring) { abort(measuring); measuring = null; }
    }
    function guardTripped(r) {
      r.count += 1;
      const slow = (r.count & 255) === 0 && performance.now() - r.t0 > (r.mode === 'measure' ? GUARD_MS : GUARD_MS * 3);
      if (r.count <= GUARD_WAITS && !slow) return false;
      console.warn(`[PM] player "${id}": the story did not finish in instant mode (${r.count} waits); check for an endless loop`);
      abort(r);
      return true;
    }
    function callFn(w, k) {
      try { w.fn(w.ease ? w.ease(clamp(k, 0, 1)) : clamp(k, 0, 1)); } catch (err) { console.error(`[PM] player "${id}": a tween failed`, err); }
    }
    function finishWait(w) {
      w.done = true;
      if (w.fn) callFn(w, 1);
      const cbs = w.cbs;
      w.cbs = [];
      cbs.forEach((cb) => cb());
    }
    function makeWait(r, ms, fn, ez) {
      if (r.token.aborted) return NEVER;
      if (r.mode !== 'live' && guardTripped(r)) return NEVER;
      const len = Math.max(0, Number(ms) || 0);
      const w = { start: r.now, end: r.now + len, len, fn: typeof fn === 'function' ? fn : null, ease: typeof ez === 'function' ? ez : null, done: false, cbs: [] };
      if (w.end > r.maxEnd) r.maxEnd = w.end;
      const then = (onOk, onErr) => new Promise((res) => {
        const fire = () => { if (r.token.aborted) return; if (w.end > r.now) r.now = w.end; res(); };
        if (w.done) queueMicrotask(fire); else w.cbs.push(fire);
      }).then(onOk, onErr);
      const thenable = { then, catch: (f) => then(undefined, f), finally: (f) => then((v) => { f(); return v; }, (e) => { f(); throw e; }) };
      if (w.end <= r.vt) finishWait(w);                       // already in the past: land on the end state
      else { if (w.fn) callFn(w, (r.vt - w.start) / w.len); r.waits.push(w); }
      return thenable;
    }
    function tick(r) {
      const due = [];
      for (const w of r.waits) {
        if (w.end <= r.vt) due.push(w);
        else if (w.fn) callFn(w, (r.vt - w.start) / w.len);
      }
      if (due.length) {
        r.waits = r.waits.filter((w) => w.end > r.vt);
        due.sort((a, b) => a.end - b.end).forEach(finishWait);
      }
      if (r.scriptDone) maybeComplete(r);
    }
    function maybeComplete(r) {
      if (r.token.aborted || r.completed || !r.scriptDone || r.waits.length) return;
      r.completed = true;
      if (r.onComplete) r.onComplete(r);
    }
    function makeCtx(r) {
      return {
        get seeking() { return r.mode !== 'live'; },
        get measuring() { return r.mode === 'measure'; },
        get reduced() { return reduced(); },
        get now() { return r.now; },
        signal: r.ctrl ? r.ctrl.signal : undefined,
        sleep: (ms) => makeWait(r, ms, null, null),
        tween: (ms, fn, ez) => makeWait(r, ms, fn, ez),
        narrate: (text, tone) => narrate(r, text, tone),
        mark: (label, tone) => mark(r, label, tone),
      };
    }
    function launch(r) {
      let p;
      try { p = Promise.resolve(script(makeCtx(r))); } catch (err) { p = Promise.reject(err); }
      p.then(() => { r.scriptDone = true; maybeComplete(r); }, (err) => {
        if (r.token.aborted) return;
        console.error(`[PM] player "${id}": the story failed`, err);
        r.scriptDone = true;
        r.failed = true;
        maybeComplete(r);
      });
    }

    /* ---- captions and marks */
    function narrate(r, text, tone) {
      if (r.token.aborted) return;
      const tn = toneOf(tone) || 'neutral';
      r.beats.push({ t: r.now, text, tone: tn });
      if (r.mode === 'measure') return;
      P.narration.classList.remove('is-hint');
      P.narration.dataset.tone = tn;
      if (reduced()) {
        const old = lines.querySelectorAll('.pm-narr-line');
        old.forEach((n) => n.classList.add('is-old'));
        for (let i = 0; i <= old.length - NARR_KEEP; i++) old[i].remove();
      } else lines.textContent = '';
      lines.append(h('div', { class: ['pm-narr-line', r.mode === 'live' && 'is-in'] }, content(text)));
    }
    function mark(r, label, tone) {
      if (r.token.aborted) return;
      const tn = toneOf(tone) || 'warn';
      const index = r.marks.length;
      r.marks.push({ t: r.now, label, tone: tn });
      if (r.mode !== 'live' || reduced() || manual) return;
      const tickEl = ticks.querySelector(`[data-mark="${index}"]`);
      if (tickEl) { tickEl.classList.remove('is-hit'); void tickEl.offsetWidth; tickEl.classList.add('is-hit'); }
      P.stage.dataset.flash = tn;
      P.stage.classList.remove('pm-flash');
      void P.stage.offsetWidth;
      P.stage.classList.add('pm-flash');
    }
    function showHint() {
      lines.textContent = '';
      P.narration.dataset.tone = 'neutral';
      P.narration.classList.add('is-hint');
      if (hint != null) lines.append(h('div', { class: 'pm-narr-line' }, content(hint)));
    }

    /* ---- measure: the whole story in instant mode; scene hidden only if it takes longer than a frame */
    function measure() {
      return new Promise((resolve) => {
        const r = newRun('measure', Infinity);
        let settled = false;
        let guard = 0;
        let hideId = 0;
        const finish = (val) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          cancelAnimationFrame(hideId);
          partEl.classList.remove('pm-measuring');
          if (measuring === r) measuring = null;
          hold(-1);
          resolve(val);
        };
        r.onComplete = () => finish(r.failed ? null : { total: Math.max(r.now, r.maxEnd), beats: r.beats, marks: r.marks });
        r.onAbort = () => finish(null);              // superseded (stopAll), endless (guard) or too slow (timer)
        guard = setTimeout(() => abort(r), GUARD_MS);
        hideId = requestAnimationFrame(() => partEl.classList.add('pm-measuring'));
        measuring = r;
        hold(+1);
        launch(r);
      });
    }
    function setTimeline(m) {
      timeline = m;
      renderTicks();
      paint();
    }
    function renderTicks() {
      ticks.textContent = '';
      if (!timeline || !(timeline.total > 0)) return;
      const tot = timeline.total;
      const at = (x) => `${(clamp(x / tot, 0, 1) * 100).toFixed(3)}%`;
      for (const b of timeline.beats) if (b.t > 0 && b.t < tot) ticks.append(h('i', { class: 'pm-tick pm-beat', style: { left: at(b.t) } }));
      timeline.marks.forEach((m, i) => ticks.append(h('i', { class: ['pm-tick', 'pm-mark', `pm-tone-${m.tone}`], dataset: { mark: i }, style: { left: at(m.t) } })));
    }

    /* ---- state, painting */
    function setState(next) {
      if (state === next) return;
      state = next;
      partEl.dataset.pmState = next;
      const [lab, ico] = { idle: [labels.play, 'play'], running: [labels.pause, 'pause'], paused: [labels.resume, 'play'], done: [labels.replay, 'replay'] }[next];
      primary.setLabel(lab);
      primary.setIcon(ico);
      if (next === 'idle') showHint();
      for (const cb of Array.from(subs)) { try { cb(next); } catch (err) { console.error(`[PM] player "${id}": onState failed`, err); } }
      partEl.dispatchEvent(new CustomEvent('pm:state', { bubbles: true, detail: { id, state: next } }));
    }
    function currentTime() {
      const total = timeline ? timeline.total : 0;
      if (state === 'done') return total || (run ? Math.max(run.now, run.maxEnd) : 0);
      if (!run || state === 'idle') return 0;
      return total > 0 ? Math.min(run.vt, total) : (Number.isFinite(run.vt) ? run.vt : 0);
    }
    function paint() {
      const total = timeline ? timeline.total : 0;
      const now = currentTime();
      const k = total > 0 ? clamp(now / total, 0, 1) : 0;
      scrub.style.setProperty('--pm-k', k.toFixed(5));
      tCur.textContent = fmt.time(now);
      tTot.textContent = total > 0 ? fmt.time(total) : '–:––';
      scrub.setAttribute('aria-valuemax', String(Math.round(total)));
      scrub.setAttribute('aria-valuenow', String(Math.round(now)));
      scrub.setAttribute('aria-valuetext', total > 0 ? `${fmt.time(now)} / ${fmt.time(total)}` : fmt.time(now));
      scrub.classList.toggle('is-ready', total > 0);
    }

    /* ---- the real-time driver */
    function startLoop() {
      if (rafId || manual || state !== 'running') return;
      lastFrame = performance.now();
      rafId = requestAnimationFrame(frame);
    }
    function stopLoop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
    function frame(now) {
      rafId = 0;
      if (state !== 'running' || manual || !run || run.mode !== 'live') return;
      const dt = clamp(now - lastFrame, 0, 100);
      lastFrame = now;
      advanceClock(dt);
      if (state === 'running' && !manual && !rafId) rafId = requestAnimationFrame(frame);
    }
    function advanceClock(dt) {
      if (!run || run.mode !== 'live') return;
      run.vt += dt;
      tick(run);
      paint();
    }

    /* ---- completion */
    function complete(r) {
      if (r !== run) return;
      stopLoop();
      const total = Math.max(r.now, r.maxEnd);
      if (!timeline) setTimeline({ total, beats: r.beats, marks: r.marks });
      else if (r.mode === 'live' && Math.abs(timeline.total - total) > 1) { timeline.total = total; renderTicks(); }
      setState('done');
      paint();
      P.markRun();
      if (r.mode === 'live' && !reduced() && !manual) {
        P.outcome.classList.remove('pm-pulse');
        void P.outcome.offsetWidth;
        P.outcome.classList.add('pm-pulse');
      }
      if (typeof def.onDone === 'function') {
        try { def.onDone(); } catch (err) { console.error(`[PM] player "${id}": onDone failed`, err); }
      }
    }

    async function callReset() {
      if (typeof resetScene !== 'function') return;
      try { const v = resetScene(); if (v && typeof v.then === 'function') await v; } catch (err) { console.error(`[PM] player "${id}": reset() failed`, err); }
    }

    /* ---- operations */
    async function startOp() {
      const seq = ++opSeq;
      stopAll();
      autoPaused = false;
      hold(+1);
      try {
        await callReset(); if (seq !== opSeq) return;
        if (typeof resetScene === 'function') {
          const m = await measure(); if (seq !== opSeq) return;
          if (m) setTimeline(m);
          await callReset(); if (seq !== opSeq) return;
        }
        if (reduced()) { await seekRun(seq, Infinity, true); return; }
        const r = newRun('live', 0);
        r.onComplete = complete;
        run = r;
        lines.textContent = '';
        P.narration.classList.remove('is-hint');
        launch(r);
        setState('running');
        paint();
      } finally { hold(-1); }
      if (seq === opSeq && state === 'running') startLoop();
    }

    async function seekRun(seq, at, pause) {
      const r = newRun('seek', at);
      r.onComplete = complete;
      run = r;
      lines.textContent = '';
      P.narration.classList.remove('is-hint');
      launch(r);
      await macrotask();                      // the instant catch-up runs entirely in microtasks
      if (seq !== opSeq || run !== r || r.completed) return;
      r.mode = 'live';
      setState(pause ? 'paused' : 'running');
      paint();
    }

    async function seekOp(at, pause) {
      const seq = ++opSeq;
      stopAll();
      autoPaused = false;
      if (reduced()) pause = true;
      hold(+1);
      try {
        await callReset(); if (seq !== opSeq) return;
        if (!timeline && typeof resetScene === 'function') {
          const m = await measure(); if (seq !== opSeq) return;
          if (m) setTimeline(m);
          await callReset(); if (seq !== opSeq) return;
        }
        await seekRun(seq, at, pause);
      } finally { hold(-1); }
      if (seq === opSeq && state === 'running') startLoop();
    }

    async function resetOp() {
      const seq = ++opSeq;
      stopAll();
      autoPaused = false;
      setState('idle');
      showHint();
      hold(+1);
      try {
        await callReset(); if (seq !== opSeq) return;
        if (typeof resetScene === 'function') {
          const m = await measure(); if (seq !== opSeq) return;
          if (m) setTimeline(m);
          await callReset();
        }
      } finally { hold(-1); }
      paint();
    }

    /* the latest operation, so advance() (and anything else) can wait until the scene shows its result */
    let busy = Promise.resolve();
    const latest = (p) => { busy = p; return p; };
    const start = () => latest(startOp());
    const seekTo = (at, pause) => latest(seekOp(at, pause));
    const resetAll = () => latest(resetOp());

    function pause() {
      if (state !== 'running') return;
      stopLoop();
      setState('paused');
      paint();
    }
    function resume() {
      if (state !== 'paused' || !run) return Promise.resolve();
      autoPaused = false;
      if (reduced()) return seekTo(Infinity, true);
      setState('running');
      startLoop();
      return Promise.resolve();
    }
    /** Before a run starts, bring the stage into view when most of it is off screen (a reader who pressed Play at
     * the bottom edge of the window would otherwise miss the story). The page may set --pm-sticky-top (px) for a
     * sticky header. Resolves when the scroll has settled. */
    function frameStage() {
      const r = P.stage.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const top = stickyTop();
      if (!(r.height > 0)) return Promise.resolve();
      // a stage that fits is brought fully into view; a taller one is brought to the top unless it already fills
      // the window (the reader may be looking at its lower half on purpose)
      const fits = r.height <= vh - top;
      const ok = fits ? r.top >= top - 1 && r.bottom <= vh + 1 : r.top <= top + 8 && r.bottom >= vh;
      if (ok) return Promise.resolve();
      const y = window.scrollY + r.top - top - 12;
      const smooth = !reduced();
      window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
      if (!smooth) return Promise.resolve();
      return new Promise((done) => {
        let last = window.scrollY, still = 0, n = 0;
        const tick = () => {
          n++;
          if (Math.abs(window.scrollY - last) < 1) still++; else still = 0;
          last = window.scrollY;
          if (still >= 3 || n > 90) done(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    function onPrimary() {
      if (state === 'running') { autoPaused = false; pause(); return; }
      frameStage().then(() => { if (state === 'paused') resume(); else if (state !== 'running') start(); });
    }

    /* ---- scrubber: click / drag to seek (one seek in flight, the latest target wins), hover tooltip, keys */
    let seekBusy = false;
    let seekNext = null;
    function queueSeek(at, pause) {
      seekNext = { at, pause };
      if (seekBusy) return;
      seekBusy = true;
      (async () => {
        while (seekNext) { const n = seekNext; seekNext = null; await seekTo(n.at, n.pause); }
        seekBusy = false;
      })();
    }
    const fracAt = (ev) => { const rc = track.getBoundingClientRect(); return clamp((ev.clientX - rc.left) / Math.max(1, rc.width), 0, 1); };
    const hasTimeline = () => !!(timeline && timeline.total > 0);
    let drag = null;
    scrub.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      if (!hasTimeline()) { if (state === 'idle') start(); return; }
      ev.preventDefault();
      scrub.focus({ preventScroll: true });
      try { scrub.setPointerCapture(ev.pointerId); } catch (_) { /* synthetic events */ }
      drag = { id: ev.pointerId, wasRunning: state === 'running', f: fracAt(ev) };
      scrub.classList.add('is-drag');
      queueSeek(drag.f * timeline.total, true);
      showTip(ev);
    });
    scrub.addEventListener('pointermove', (ev) => {
      if (!hasTimeline()) return;
      showTip(ev);
      if (!drag || ev.pointerId !== drag.id) return;
      const f = fracAt(ev);
      if (Math.abs(f - drag.f) < 0.0005) return;
      drag.f = f;
      queueSeek(f * timeline.total, true);
    });
    const endDrag = (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      scrub.classList.remove('is-drag');
      if (d.wasRunning) queueSeek(d.f * timeline.total, false);
      if (ev.pointerType !== 'mouse') hideTip();
    };
    scrub.addEventListener('pointerup', endDrag);
    scrub.addEventListener('pointercancel', endDrag);
    scrub.addEventListener('pointerleave', () => { if (!drag) hideTip(); });
    function showTip(ev) {
      const rc = track.getBoundingClientRect();
      const f = fracAt(ev);
      const total = timeline.total;
      let near = null;
      let best = 9;                                             // px: a mark within reach of the pointer
      for (const m of timeline.marks) {
        const dx = Math.abs((m.t / total - f) * rc.width);
        if (dx <= best) { best = dx; near = m; }
      }
      const at = near ? near.t : f * total;
      let text = near ? plain(near.label) : '';
      if (!near) for (const b of timeline.beats) if (b.t <= at + 1) text = plain(b.text);
      tip.textContent = '';
      tip.append(h('span', { class: 'pm-tip-time' }, fmt.time(at)), text ? h('span', { class: 'pm-tip-text' }, text) : null);
      if (near) tip.dataset.tone = near.tone; else delete tip.dataset.tone;
      tip.hidden = false;
      const sr = scrub.getBoundingClientRect();
      const w = tip.offsetWidth;
      const x = near ? rc.left + (near.t / total) * rc.width : ev.clientX;
      const left = clamp(x - w / 2, 8, Math.max(8, document.documentElement.clientWidth - w - 8));
      tip.style.left = `${Math.round(left - sr.left)}px`;
    }
    function hideTip() { tip.hidden = true; }
    scrub.addEventListener('keydown', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); onPrimary(); return; }
      if (!hasTimeline()) return;
      const total = timeline.total;
      const now = currentTime();
      const times = [...new Set([...timeline.beats, ...timeline.marks].map((b) => b.t))].filter((x) => x > 0 && x < total).sort((a, b) => a - b);
      let next = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') next = times.find((x) => x > now + 1) ?? total;
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') next = [...times].reverse().find((x) => x < now - 400) ?? 0;
      else if (ev.key === 'Home') next = 0;
      else if (ev.key === 'End') next = total;
      if (next == null) return;
      ev.preventDefault();
      queueSeek(next, state !== 'running');
    });

    /* ---- the primary keeps the width of its widest label, so Pause / Resume / Replay never shift the bar */
    function lockWidth() { /* CSS sizes the button to its widest label (.pm-btn-stack); nothing to measure */ }

    /* ---- viewport: auto-pause off screen; lock the width and (re)measure once it is first seen */
    let seen = false;
    inView(partEl, (visible) => {
      partEl.classList.toggle('is-off', !visible);
      if (visible && !seen) { seen = true; lockWidth(); if (!timeline && state === 'idle') resetAll(); }
      if (def.autoPause === false || manual) return;
      if (!visible && state === 'running') { pause(); autoPaused = true; }
      else if (visible && autoPaused && state === 'paused') resume();
    });
    onLang(() => { lockWidth(); paint(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => lockWidth()).catch(() => {});

    const api = {
      id,
      el: P.stage,
      primary,
      scrub,
      /** resolves (with the player) after the first measure: duration and marks are known */
      ready,
      get state() { return state; },
      get duration() { return timeline ? timeline.total : null; },
      get marks() { return timeline ? timeline.marks.map((m) => ({ t: m.t, label: plain(m.label), tone: m.tone })) : []; },
      get beats() { return timeline ? timeline.beats.map((b) => ({ t: b.t, text: plain(b.text), tone: b.tone })) : []; },
      get time() { return currentTime(); },
      play() { if (state === 'running') return Promise.resolve(); if (state === 'paused') return resume(); return start(); },
      pause() { autoPaused = false; pause(); },
      resume,
      replay: () => start(),
      /** seek(ms, {pause}?) — reset, re-run instantly up to ms; then keep playing if it was playing (or pause:false) */
      seek(ms, opts = {}) {
        const at = Math.max(0, Number(ms) || 0);
        const pause = opts.pause != null ? !!opts.pause : state !== 'running';
        return seekTo(at, pause);
      },
      /** reset() — back to rest (idle) and re-measure; call it after an option changes the story */
      reset: () => resetAll(),
      /** advance(ms) — step the virtual clock exactly (for frame capture with setManual(true)); resolves when settled */
      async advance(ms) {
        await busy;                              // a play() / seek() issued just before has settled
        if (run && run.mode === 'live' && state === 'running') advanceClock(Math.max(0, Number(ms) || 0));
        await macrotask();
        return currentTime();
      },
      /** setManual(true) — the clock moves only through advance(); CSS transitions inside the part are off */
      setManual(on) {
        manual = !!on;
        partEl.classList.toggle('pm-manual', manual);
        if (manual) stopLoop(); else startLoop();
        return api;
      },
      /** measure() → Promise<{total, marks, beats}|null>: re-learn the timeline (only at rest) */
      async measure() { if (state === 'idle') await resetAll(); return timeline; },
      onState(cb) { subs.add(cb); return () => subs.delete(cb); },
    };

    if (PM.players[id]) console.warn(`[PM] player "${id}" replaced an earlier player with the same part id`);
    PM.players[id] = api;
    P.player = api;
    partEl.dataset.pmState = 'idle';
    showHint();
    paint();

    // first measure (after the page has built the scene), then the ?part=<id>&t=<ms> deep link
    setTimeout(async () => {
      if (state === 'idle' && !timeline) await resetAll();
      readyDone(api);
      if (QUERY.get('part') !== id) return;
      const raw = QUERY.get('t');
      const ms = raw == null || raw === '' ? NaN : /s$/i.test(raw) ? parseFloat(raw) * 1000 : parseFloat(raw);
      if (Number.isFinite(ms)) await api.seek(ms, { pause: true });
      partEl.scrollIntoView({ block: 'start' });
    }, 0);
    return api;
  }

  /* ------------------------------------------------------------------ boot */

  /* ------------------------------------------------------------------ facts
   * Every paper number the page shows comes from facts.json (schema: references/fidelity.md). The page declares it as
   *   <script type="application/json" id="pm-facts" data-src="facts.json"></script>
   * PM.boot() reads it before any part mounts: inline JSON when bundled (bundle.py fills the tag), otherwise fetched
   * over http (a dev server). fidelity.py checks every [data-fact] element against the same file. */
  let factsData = window.PM_FACTS || null;
  async function loadFacts() {
    if (factsData) return factsData;
    const tag = document.getElementById('pm-facts');
    if (!tag) return null;
    try {
      if (tag.textContent.trim()) factsData = JSON.parse(tag.textContent);
      else if (tag.dataset.src) factsData = await (await fetch(tag.dataset.src)).json();
    } catch (err) {
      console.warn('[PM] facts could not be read (open the page through a server, or bundle it):', err && err.message);
    }
    if (factsData) window.PM_FACTS = factsData;
    return factsData;
  }
  const factTable = () => ((factsData && (factsData.facts || factsData)) || {});
  /** fact(key) → the printed value ('41.2K'); fact(key, 'zh') → its Chinese form when the file has one. */
  function fact(key, lng) {
    const f = factTable()[key];
    if (f == null) { console.warn(`[PM] fact "${key}" is not in facts.json`); return '?'; }
    if (typeof f !== 'object') return String(f);
    if (lng === 'zh' && f.zh != null) return String(f.zh);
    return f.value == null ? '?' : String(f.value);
  }
  /** F(key, tag='span') → an element showing the value, marked data-fact so fidelity.py can check it. */
  function F(key, tag = 'span') {
    const el = L(fact(key), fact(key, 'zh'), tag);
    el.dataset.fact = key;
    return el;
  }
  /** ref(id) → "Paper §4.3.1" / 「论文第 4.3.1 节」 from facts.json refs (the labels change when the paper renumbers). */
  function ref(id) {
    const r = factsData && factsData.refs && factsData.refs[id];
    if (!r) { console.warn(`[PM] ref "${id}" is not in facts.json`); return L('Paper', '论文'); }
    return L(`Paper ${r.en}`, `论文${r.zh || r.en}`);
  }

  /** register(id, mount(host, PM)) — one part per file: the file registers its builder, and boot() mounts it into
   * <div data-pm-slot="id"> (or, when the page has no such slot, into a new slot appended to #pm-parts or <main>/<body>),
   * in registration order. A builder that throws leaves a short notice in its slot; the other parts still mount. */
  const registry = [];
  function register(id, mount) {
    if (typeof mount !== 'function') throw new Error(`[PM] register("${id}"): mount must be a function`);
    if (registry.some((r) => r.id === id)) console.warn(`[PM] register("${id}"): registered twice; the later one wins`);
    for (let i = registry.length - 1; i >= 0; i--) if (registry[i].id === id) registry.splice(i, 1);
    registry.push({ id, mount });
  }
  async function mountRegistered() {
    for (const { id, mount } of registry) {
      let slot = document.querySelector(`[data-pm-slot="${CSS.escape(id)}"]`);
      if (!slot) {
        const parent = document.getElementById('pm-parts') || document.querySelector('main') || document.body;
        slot = h('div', { dataset: { pmSlot: id } });
        parent.append(slot);
      }
      if (slot.dataset.pmMounted) continue;
      slot.dataset.pmMounted = '1';
      try { await mount(slot, PM); } catch (err) {
        console.error(`[PM] part "${id}" failed to mount`, err);
        slot.append(L(`This part failed to load: ${err && err.message}`, `这个部件加载失败：${err && err.message}`, 'p', { class: 'pm-fail' }));
      }
    }
  }

  /** boot(fn?) → Promise<PM>: after DOMContentLoaded, applies the language to static [data-l-en] markup, runs
   * fn(PM), mounts every part registered with PM.register (in order), scrolls to #<part-id>
   * (the parts did not exist when the browser tried), then sets <html data-pm-ready> and fires 'pm:ready' on document. */
  function boot(fn) {
    return new Promise((resolve) => {
      const go = async () => {
        applyLang(document);
        await loadFacts();
        try { if (typeof fn === 'function') await fn(PM); } catch (err) { console.error('[PM] boot failed', err); }
        await mountRegistered();
        const hash = decodeURIComponent((location.hash || '').slice(1));
        const target = hash && !QUERY.get('part') ? document.getElementById(hash) : null;
        if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
        docEl.setAttribute('data-pm-ready', '');
        document.dispatchEvent(new CustomEvent('pm:ready', { detail: PM }));
        resolve(PM);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go, { once: true }); else go();
    });
  }

  // Static bilingual markup written in the page (data-l-en / data-l-zh) follows the start language too.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyLang(document), { once: true });
  else applyLang(document);

  Object.assign(PM, {
    lang, setLang, onLang, t, L, LH, lAttr, applyLang,
    h, s, content, plain, icon, asset, uid, esc, isBi,
    reduced, inView, ease, span, step, lerp, clamp, fmt,
    part, source, readouts, fold, player,
    button, segmented, toggle, target, langToggle,
    code, intent, highlight: (src, language) => highlightLines(src, language).join('\n'),
    register, boot, loadFacts, fact, F, ref,
  });
})();
