#!/usr/bin/env node
// lint.mjs — check a PLAYME page against the reader budgets in a real (headless) browser.
//
//   node lint.mjs --url <page>  [--widths 1440,400] [--langs en,zh] [--reduced] [--parts id,id]
//                               [--dump text.json] [--shots dir] [--json report.json] [--root dir]
//   node lint.mjs --offline-file PLAYME.html   [same options]
//
// <page> is an http(s) URL, a file:// URL or a local path. A local path is served over http from a built-in static
// server rooted at the smallest directory that holds the page and the local files it links (or --root).
// --offline-file opens the file itself from file:// with every http(s) request blocked: the test for "one file that
// opens offline". Blocked requests and the errors they cause fail the run; a loaded three.js revision is reported.
//
// Per part (section.pm-part) at rest, at every width × language (?lang=… and <html lang>):
//   q        words in .pm-q                                     ≤ 14 EN words / ≤ 30 ZH characters
//   prose    visible text outside the stage, eyebrow, source line, outcome and folds (q + lead + takeaway + any
//            other paragraph)                                   ≤ 70 EN words / ≤ 140 ZH characters
//   primary  visible .pm-primary                                exactly 1
//   ctrls    visible controls outside .pm-scene (buttons, links, inputs, tabs, switches; the scrubber and fold
//            summaries do not count)                            ≤ 4, primary included
//   folds    details in .pm-deeper                              ≤ 4, none open at rest
//   chips    boxed non-interactive labels ("fake buttons": background + border + radius ≥ 4 px + ≤ 4 words,
//            outside .pm-scene, not a control)                  0
//   scrub    every .pm-stage with a .pm-primary has a .pm-scrub
//   height   part height at widths ≥ 1200 px                    ≤ 1250 px
// Per page: console errors, page errors, failed requests, horizontal overflow (with the offending elements and
// their causes), duplicate part ids. Words are counted as in SKILL.md (reader budgets): EN = whitespace-separated tokens with a
// letter or digit; ZH = CJK characters + Latin/number tokens.
//
// --dump writes, per language (at the first width): each part's text at rest, the captions of a full play-through,
// the text after every player has played to the end (PM.players[id].seek(duration)), the text after each option of
// the bar, the text of every fold (opened), the quotes (.pm-quote / [data-quote]) and facts ([data-fact]). It is the
// input of fidelity.py.
// --shots writes page-<width>-<lang>.png (full page) and part-<id>-<width>-<lang>.png at rest; with --dump also
// part-<id>-<width>-<lang>-end.png at the end of each story (first width).
// Output: a PASS/FAIL table per width × language and the reasons; exit code 1 on any FAIL, 2 on a usage error.
import path from 'node:path';
import {
  launch, parseArgs, list, openTarget, withQuery, collect, settle, sleep, table, c, ensureDir, writeJson, short,
} from './_browser.mjs';

const VERSION = '1.0.0';
const BUDGET = {
  q: { en: 14, zh: 30 },
  prose: { en: 70, zh: 140 },
  primary: 1,
  ctrls: 4,
  folds: 4,
  height: 1250,
  heightMinWidth: 1200,
  chipWords: { en: 4, zh: 8 },
};
const USAGE = `usage: node lint.mjs --url <page|file> [--widths 1440,400] [--langs en,zh] [--reduced]
                    [--parts id,…] [--dump text.json] [--shots dir] [--json report.json] [--root dir]
       node lint.mjs --offline-file PLAYME.html [same options]`;

/** Hide (or show again) the page's own fixed and sticky chrome outside the parts (a top bar would cover a part in an
 * element screenshot). */
async function hideChrome(page, on) {
  await page.evaluate((hide) => {
    if (hide) {
      for (const x of document.body.querySelectorAll('*')) {
        if (x.closest('.pm-part') || x.querySelector('.pm-part')) continue;
        const pos = getComputedStyle(x).position;
        if (pos === 'fixed' || pos === 'sticky') { x.setAttribute('data-pm-lint-hidden', ''); x.style.setProperty('visibility', 'hidden', 'important'); }
      }
    } else {
      for (const x of document.querySelectorAll('[data-pm-lint-hidden]')) { x.removeAttribute('data-pm-lint-hidden'); x.style.removeProperty('visibility'); }
    }
  }, on).catch(() => {});
}

/* ============================================================================ in-page probes
 * These functions run inside the page (page.evaluate serialises them): no closures over module scope. */

/** Measure every part at rest. */
function probeParts(lang, budget) {
  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;
  const count = (text) => {
    if (lang === 'zh') {
      const cjk = (text.match(CJK) || []).length;
      const latin = (text.replace(CJK, ' ').match(/[A-Za-z0-9][\w.'’+/-]*/g) || []).length;
      return cjk + latin;
    }
    return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  };
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 2 || r.height <= 2) return false;
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const inClosedFold = (el) => {
    for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) {
      if (!d.open && !(el.closest('summary') && el.closest('summary').parentElement === d)) return true;
    }
    return false;
  };
  const CTRL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], '
    + '[role=switch], [role=checkbox], [role=radio], [role=menuitem], [role=option], [contenteditable=""], [contenteditable=true]';
  const INTERACTIVE = CTRL + ', label, [tabindex]:not([tabindex="-1"]), .pm-target, [onclick], [role=slider], kbd';
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
    if (cls.length) s += '.' + cls.join('.');
    return s;
  };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.title || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 32);
  const alpha = (color) => {
    if (!color || color === 'transparent') return 0;
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1;
    const p = m[1].split(/[\s,/]+/).filter(Boolean);
    return p.length >= 4 ? parseFloat(p[3]) * (p[3].endsWith('%') ? 0.01 : 1) : 1;
  };

  const parts = [...document.querySelectorAll('section.pm-part, [data-pm-part]')]
    .filter((el, i, all) => !all.some((o) => o !== el && o.contains(el)));
  return parts.map((part) => {
    const id = part.dataset.pmPart || part.id || '(no id)';
    const regions = { q: 0, lead: 0, takeaway: 0, other: 0, stage: 0 };
    const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent.trim() || el.closest('script, style, template, noscript')) continue;
      if (!visible(el) || inClosedFold(el)) continue;
      if (el.closest('.pm-stage')) { regions.stage += count(n.textContent); continue; }
      if (el.closest('.pm-eyebrow, .pm-source, .pm-outcome, .pm-deeper')) continue;
      const key = el.closest('.pm-q') ? 'q' : el.closest('.pm-lead') ? 'lead' : el.closest('.pm-takeaway') ? 'takeaway' : 'other';
      regions[key] += count(n.textContent);
    }
    const qEl = part.querySelector('.pm-q');
    const qWords = qEl ? count(qEl.innerText || qEl.textContent || '') : null;

    // controls outside the scene (the scrubber is transport, fold summaries are counted as folds)
    const counted = [];
    for (const el of part.querySelectorAll(CTRL)) {
      if (!visible(el) || inClosedFold(el)) continue;
      if (el.closest('.pm-scene, .pm-scrub')) continue;
      if (el.tagName === 'SUMMARY' && el.closest('details') && el.closest('.pm-deeper, .pm-fold')) continue;
      if (el.closest('details.pm-fold') && el.closest('.pm-deeper') && el.tagName !== 'SUMMARY' && inClosedFold(el)) continue;
      if (counted.some((o) => o.contains(el))) continue;
      counted.push(el);
    }
    const primaries = [...part.querySelectorAll('.pm-primary')].filter((el) => visible(el) && !inClosedFold(el));
    const folds = [...part.querySelectorAll('details')].filter((d) => d.closest('.pm-deeper') || d.classList.contains('pm-fold'));
    const openFolds = folds.filter((d) => d.open);

    // boxed non-interactive chips ("fake buttons")
    const chips = [];
    for (const el of part.querySelectorAll('*')) {
      if (el.closest('.pm-scene, .pm-scrub, pre, code, .pm-code, svg, canvas')) continue;
      if (chips.some((c) => c.el.contains(el))) continue;
      if (inClosedFold(el) || el.matches(INTERACTIVE) || el.closest(INTERACTIVE) || el.querySelector(INTERACTIVE + ', pre, code')) continue;
      const r = el.getBoundingClientRect();
      if (r.height > 48 || r.width > 360 || r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      if (cs.cursor === 'pointer' || !visible(el)) continue;
      const bg = alpha(cs.backgroundColor) > 0.02 || (cs.backgroundImage && cs.backgroundImage !== 'none');
      if (!bg) continue;
      const sides = ['Top', 'Right', 'Bottom', 'Left'];
      let border = sides.some((s) => parseFloat(cs[`border${s}Width`]) >= 0.5 && !['none', 'hidden'].includes(cs[`border${s}Style`]) && alpha(cs[`border${s}Color`]) > 0.05);
      if (!border && cs.boxShadow && cs.boxShadow !== 'none') {
        // a ring drawn with box-shadow (no blur, positive spread) looks like a border
        border = cs.boxShadow.split(/,(?![^(]*\))/).some((sh) => {
          const nums = (sh.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
          return nums.length >= 4 && nums[2] === 0 && nums[3] > 0 && alpha((sh.match(/rgba?\([^)]*\)/) || ['rgb(0,0,0)'])[0]) > 0.05;
        });
      }
      if (!border) continue;
      const radius = Math.max(...['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map((k) => {
        const v = cs[`border${k}Radius`] || '0';
        return v.endsWith('%') ? (parseFloat(v) / 100) * Math.min(r.width, r.height) : parseFloat(v);
      }));
      if (!(radius >= 4)) continue;
      const text = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (!text || count(text) > (lang === 'zh' ? budget.chipWords.zh : budget.chipWords.en)) continue;
      chips.push({ el, text, sel: describe(el) });
    }

    const stages = [...part.querySelectorAll('.pm-stage')];
    const noScrub = stages.filter((s) => s.querySelector('.pm-primary') && !s.querySelector('.pm-scrub')).length;
    const player = window.PM && PM.players ? PM.players[id] : null;
    return {
      id,
      q: qWords,
      qText: qEl ? (qEl.innerText || '').trim() : '',
      prose: regions.q + regions.lead + regions.takeaway + regions.other,
      proseParts: { q: regions.q, lead: regions.lead, takeaway: regions.takeaway, other: regions.other },
      stageWords: regions.stage,
      primary: primaries.length,
      ctrls: counted.length,
      ctrlList: counted.map(label),
      folds: folds.length,
      foldsOpen: openFolds.length,
      openFoldTitles: openFolds.map((d) => label(d.querySelector('summary .pm-fold-title') || d.querySelector('summary') || d)),
      chips: chips.map((c) => ({ text: c.text.slice(0, 40), sel: c.sel })),
      stages: stages.length,
      noScrub,
      player: player ? { duration: Math.round(player.duration || 0), state: player.state, marks: (player.marks || []).length } : null,
      height: Math.round(part.getBoundingClientRect().height),
    };
  });
}

/** Horizontal overflow: scrollWidth vs innerWidth, plus the outermost elements past the viewport and their causes. */
function probeOverflow() {
  const vw = window.innerWidth;
  const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const describe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
    if (cls.length) s += '.' + cls.join('.');
    const host = el.closest('[data-pm-part]');
    if (host && host !== el) s = `[${host.dataset.pmPart}] ` + s;
    return s;
  };
  // an ancestor that clips (overflow ≠ visible) and itself fits the viewport hides the overflow; html/body do not
  // count, since clipping there cuts content off instead of scrolling it
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (getComputedStyle(a).overflowX !== 'visible') {
        const r = a.getBoundingClientRect();
        if (r.right <= vw + 1 && r.left >= -1) return true;
      }
    }
    return false;
  };
  const bad = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height <= 4) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed' && cs.opacity === '0') continue;
    if (cs.clip && cs.clip !== 'auto' || cs.clipPath && cs.clipPath !== 'none') continue;
    if (!clipped(el)) bad.push(el);
    if (bad.length > 400) break;
  }
  const set = new Set(bad);
  const info = (el) => { const r = el.getBoundingClientRect(); return { el: describe(el), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) }; };
  const offenders = [];
  const causes = [];
  for (const el of bad) {
    let outer = true;
    for (let a = el.parentElement; a; a = a.parentElement) if (set.has(a)) { outer = false; break; }
    if (outer && offenders.length < 6) offenders.push(info(el));
    // a cause sticks out of its parent's content box: a fixed width, wide media, unbreakable text, or a grid/flex
    // track blown out by a child without min-width: 0
    const p = el.parentElement;
    if (p && causes.length < 6) {
      const pr = p.getBoundingClientRect();
      const cs = getComputedStyle(p);
      const contentRight = pr.right - parseFloat(cs.paddingRight || 0) - parseFloat(cs.borderRightWidth || 0);
      const r = el.getBoundingClientRect();
      if (r.right > contentRight + 1 || r.left < pr.left - 1) causes.push({ ...info(el), parent: describe(p), parentDisplay: cs.display });
    }
  }
  const parts = [...new Set(bad.map((el) => { const h = el.closest('[data-pm-part]'); return h ? h.dataset.pmPart : null; }).filter(Boolean))];
  return { scrollWidth: sw, innerWidth: vw, overflow: sw > vw + 1 || offenders.length > 0, offenders, causes, parts };
}

/** Text, quotes, facts and attribute texts of every part plus the whole page. */
function probeText() {
  const parts = {};
  for (const el of document.querySelectorAll('section.pm-part, [data-pm-part]')) {
    const id = el.dataset.pmPart || el.id || '(no id)';
    if (parts[id]) continue;
    parts[id] = {
      text: (el.innerText || '').trim(),
      quotes: [...el.querySelectorAll('.pm-quote, [data-quote]')].map((q) => {
        const attr = q.getAttribute('data-quote');
        const shown = (q.innerText || q.textContent || '').trim().replace(/\s+/g, ' ');
        // data-quote holds the original sentence (or a facts.json quote id); shown is what the reader sees
        return { text: (attr || shown).trim(), shown, attr: !!attr };
      }).filter((q) => q.text),
      facts: [...el.querySelectorAll('[data-fact]')].map((f) => ({ key: f.dataset.fact, text: (f.innerText || f.textContent || '').trim() })),
      attrs: [...new Set([...el.querySelectorAll('[title], [aria-label], [alt], [placeholder]')]
        .flatMap((e) => ['title', 'aria-label', 'alt', 'placeholder'].map((a) => e.getAttribute(a)).filter(Boolean)))],
      folds: [...el.querySelectorAll('details')].map((d) => {
        const s = d.querySelector('summary');
        const body = [...d.children].filter((k) => k !== s).map((k) => k.innerText || '').join('\n').trim();
        const one = (sel) => { const x = s && s.querySelector(sel); return x ? x.innerText.trim().replace(/\s+/g, ' ') : ''; };
        const title = one('.pm-fold-title') || (s ? s.innerText.trim().replace(/\s+/g, ' ') : '');
        return { title, teaser: one('.pm-fold-teaser'), text: body, open: d.open };
      }),
    };
  }
  return { parts, page: (document.body.innerText || '').trim(), lang: document.documentElement.lang };
}

/** Play one player through on its manual clock (or seek), recording captions; ends at the end of the story. */
async function probePlay(id, stepMs) {
  const p = window.PM && PM.players && PM.players[id];
  if (!p) return null;
  const part = document.querySelector(`[data-pm-part="${CSS.escape(id)}"]`) || document.getElementById(id);
  const narr = part && part.querySelector('.pm-narration');
  const captions = [];
  const add = () => { const t = narr && (narr.innerText || '').trim(); if (t && captions[captions.length - 1] !== t) captions.push(t); };
  const mo = narr ? new MutationObserver(add) : null;
  if (mo) mo.observe(narr, { subtree: true, childList: true, characterData: true });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  let mode = 'seek';
  try {
    if (typeof p.setManual === 'function' && typeof p.advance === 'function') {
      mode = 'manual';
      p.setManual(true);
      await p.seek(0); await tick();
      await p.play(); await tick();
      const limit = Math.min(Math.max((p.duration || 0) + 2000, 3000), 180000);
      for (let t = 0; t < limit && p.state !== 'done'; t += stepMs) { await p.advance(stepMs); await tick(); add(); }
      p.setManual(false);
      // the play-through saw every caption; the seek below replays them instantly, so stop recording
      if (captions.length && mo) mo.disconnect();
    }
    await p.seek(p.duration > 0 ? p.duration : 600000);
    for (let i = 0; i < 60 && p.state !== 'done'; i++) await new Promise((r) => setTimeout(r, 50));
    await tick(); add();
  } catch (err) {
    return { mode, error: String(err && err.message || err), captions };
  } finally {
    if (mo) mo.disconnect();
    try { p.setManual && p.setManual(false); } catch (_) { /* ignore */ }
  }
  const marks = (p.marks || []).map((m) => ({ t: Math.round(m.t ?? m.time ?? 0), label: String(m.label ?? m.text ?? '').trim() }));
  return { mode, captions, state: p.state, duration: Math.round(p.duration || 0), marks };
}

/* ============================================================================ runner */

function fail(msg) { console.error(c.red('error: ') + msg); console.error(USAGE); process.exit(2); }

const args = parseArgs(process.argv.slice(2), { flags: ['reduced', 'help', 'no-variants'] });
if (args.help) { console.log(USAGE); process.exit(0); }
const offlineFile = typeof args.offlineFile === 'string' ? args.offlineFile : null;
const input = offlineFile || (typeof args.url === 'string' ? args.url : args._[0]);
if (!input) fail('give --url <page> or --offline-file <file>');
const widths = list(args.widths, ['1440', '400']).map(Number).filter((w) => w > 0);
const langs = list(args.langs, ['en', 'zh']).map((l) => (l.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
const onlyParts = list(args.parts);
const reduced = !!args.reduced;
if (!widths.length || !langs.length) fail('--widths and --langs need at least one value');

let target;
try { target = await openTarget(input, { root: typeof args.root === 'string' ? args.root : null, file: !!offlineFile }); } catch (e) { fail(e.message); }
let browser;
try { browser = await launch(); } catch (e) { await target.close(); console.error(c.red('error: ') + e.message); process.exit(2); }

const runs = [];
const dump = args.dump ? { format: 'playme-dump/1', tool: `playme lint.mjs ${VERSION}`, url: offlineFile ? path.basename(offlineFile) : target.url, width: widths[0], langs, pages: {}, parts: [] } : null;

async function openPage(width, lang) {
  const page = await browser.newPage();
  const bucket = collect(page);
  const blocked = [];
  const localLoads = [];
  if (offlineFile) {
    // no network at all; and a self-contained file loads no other local file either
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (/^https?:/i.test(u)) { blocked.push(short(u)); r.abort('internetdisconnected').catch(() => {}); return; }
      if (/^file:/i.test(u) && !r.isNavigationRequest()) localLoads.push(short(u));
      r.continue().catch(() => {});
    });
  }
  await page.setViewport({ width, height: width >= 1200 ? 900 : 860, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('pm-lang', l); } catch (_) { /* blocked */ } }, lang);
  const url = withQuery(target.url, { lang, motion: reduced ? 'reduce' : null });
  const notes = [];
  try {
    await page.goto(url, { waitUntil: offlineFile ? 'load' : 'networkidle0', timeout: 45000 });
  } catch (e) {
    notes.push(`page did not settle: ${e.message.split('\n')[0]}`);
  }
  await page.evaluate((l) => {
    const want = l === 'zh' ? 'zh-CN' : 'en';
    if (window.PM && typeof PM.setLang === 'function' && typeof PM.lang === 'function' && PM.lang() !== l) PM.setLang(l);
    if (!(document.documentElement.lang || '').toLowerCase().startsWith(l)) document.documentElement.lang = want;
  }, lang).catch(() => {});
  try { await page.waitForSelector('section.pm-part, [data-pm-part]', { timeout: 10000 }); } catch (_) { notes.push('no .pm-part appeared within 10 s'); }
  await settle(page, offlineFile ? 1200 : 500);
  // visit every part once: the kit measures players (and renders lazy scenes) when a part first scrolls into view
  await page.evaluate(async () => {
    for (const el of document.querySelectorAll('section.pm-part, [data-pm-part]')) {
      el.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, 0);
  }).catch(() => {});
  if (!reduced) {
    await page.waitForFunction(() => !window.PM || !PM.players || Object.values(PM.players).every((p) => p && p.duration > 0),
      { timeout: 6000, polling: 100 }).catch(() => notes.push('some players never reported a duration (measure pass)'));
  }
  await settle(page, 300);
  return { page, bucket, blocked, localLoads, notes };
}

function verdictFor(m, width, lang) {
  const reasons = [];
  const l = lang === 'zh' ? 'zh' : 'en';
  if (m.q == null) reasons.push('no .pm-q question');
  else if (m.q > BUDGET.q[l]) reasons.push(`question ${m.q} ${l === 'zh' ? 'chars' : 'words'} > ${BUDGET.q[l]}`);
  if (m.prose > BUDGET.prose[l]) reasons.push(`prose ${m.prose} > ${BUDGET.prose[l]} (q ${m.proseParts.q} · lead ${m.proseParts.lead} · takeaway ${m.proseParts.takeaway} · other ${m.proseParts.other})`);
  if (m.primary !== BUDGET.primary) reasons.push(`${m.primary} primary buttons (need exactly 1)`);
  if (m.ctrls > BUDGET.ctrls) reasons.push(`${m.ctrls} controls > ${BUDGET.ctrls}: ${m.ctrlList.join(' | ')}`);
  if (m.folds > BUDGET.folds) reasons.push(`${m.folds} folds > ${BUDGET.folds}`);
  if (m.foldsOpen) reasons.push(`${m.foldsOpen} fold${m.foldsOpen > 1 ? 's' : ''} open at rest: ${m.openFoldTitles.join(' | ')}`);
  if (m.chips.length) reasons.push(`${m.chips.length} boxed non-interactive chip${m.chips.length > 1 ? 's' : ''} (looks clickable): ${m.chips.map((x) => `"${x.text}" ${x.sel}`).join(', ')}`);
  if (m.noScrub) reasons.push(`${m.noScrub} player${m.noScrub > 1 ? 's' : ''} without a .pm-scrub progress bar`);
  if (width >= BUDGET.heightMinWidth && m.height > BUDGET.height) reasons.push(`height ${m.height} px > ${BUDGET.height} at ${width} px`);
  if (m.overflow) reasons.push(`horizontal overflow at ${width} px`);
  return reasons;
}

let exitCode = 0;
try {
  for (const width of widths) {
    for (const lang of langs) {
      const { page, bucket, blocked, localLoads, notes } = await openPage(width, lang);
      let parts = await page.evaluate(probeParts, lang, BUDGET).catch((e) => { notes.push(`probe failed: ${e.message}`); return []; });
      if (onlyParts.length) parts = parts.filter((p) => onlyParts.includes(p.id));
      const overflow = await page.evaluate(probeOverflow).catch(() => ({ overflow: false, offenders: [], causes: [], parts: [] }));
      const extra = await page.evaluate(async (offline) => {
        const text = document.body ? document.body.innerText || '' : '';
        let three = (window.THREE && window.THREE.REVISION) || window.PM_THREE_REVISION || null;
        let threeError = null;
        // offline: prove the 3D layer can load three.js from inside the file, through the kit's own loader
        if (!three && offline && window.PM && typeof PM.loadThree === 'function') {
          try {
            const T = await Promise.race([PM.loadThree(), new Promise((_, no) => setTimeout(() => no(new Error('timed out after 20 s')), 20000))]);
            three = T && T.REVISION;
          } catch (e) { threeError = String((e && e.message) || e); }
        }
        return { hasPM: !!window.PM, version: (window.PM && PM.version) || null, cjk: /[\u4e00-\u9fff]/.test(text),
          canvases: document.querySelectorAll('canvas').length, three: three ? String(three) : null, threeError,
          inlinedThree: typeof window.PM_THREE_SRC === 'string' };
      }, !!offlineFile).catch(() => ({}));
      for (const m of parts) {
        m.overflow = overflow.parts.includes(m.id);
        m.reasons = verdictFor(m, width, lang);
      }
      const ids = parts.map((p) => p.id);
      const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
      if (args.shots) {
        const dir = ensureDir(path.resolve(String(args.shots)));
        // a sticky stage bar would land mid-part in an element screenshot: unstick it while filming
        await page.addStyleTag({ content: '.pm .pm-stage > .pm-bar { position: relative !important; top: auto !important; }' }).catch(() => {});
        await page.screenshot({ path: path.join(dir, `page-${width}-${lang}.png`), fullPage: true }).catch(() => {});
        await hideChrome(page, true);
        for (const m of parts) {
          const handle = await page.evaluateHandle((id) => document.querySelector(`[data-pm-part="${CSS.escape(id)}"]`) || document.getElementById(id), m.id).catch(() => null);
          const el = handle && handle.asElement();
          const file = `part-${m.id.replace(/[^\w.-]+/g, '_')}-${width}-${lang}.png`;
          if (el) await el.screenshot({ path: path.join(dir, file) }).catch(() => {});
        }
        await hideChrome(page, false);
      }
      if (dump && width === widths[0]) await dumpLang(page, lang, parts.map((p) => p.id));
      const errs = await bucket.take();
      const pageReasons = [];
      if (!parts.length) pageReasons.push('no .pm-part found (is the kit loaded? does the page follow the part template?)');
      if (errs.errors.length) pageReasons.push(`${errs.errors.length} console error${errs.errors.length > 1 ? 's' : ''}`);
      if (errs.pageErrors.length) pageReasons.push(`${errs.pageErrors.length} page error${errs.pageErrors.length > 1 ? 's' : ''}`);
      // offline: requests we blocked are reported as such; anything else that failed (a missing local file) too
      errs.failedRequests = errs.failedRequests.filter((r) => !blocked.some((b) => r.startsWith(b)));
      if (errs.failedRequests.length) pageReasons.push(`${errs.failedRequests.length} failed request${errs.failedRequests.length > 1 ? 's' : ''}`);
      if (blocked.length) pageReasons.push(`${blocked.length} network request${blocked.length > 1 ? 's' : ''} blocked (the file is not self-contained)`);
      const loaded = [...new Set(localLoads)].filter((f) => !errs.failedRequests.some((r) => r.startsWith(f)));
      if (loaded.length) pageReasons.push(`${loaded.length} other local file${loaded.length > 1 ? 's' : ''} loaded (not inlined): ${loaded.slice(0, 4).join(', ')}`);
      if (overflow.overflow) pageReasons.push(`horizontal overflow (scrollWidth ${overflow.scrollWidth} > ${overflow.innerWidth})`);
      if (dupes.length) pageReasons.push(`duplicate part ids: ${dupes.join(', ')}`);
      if (extra.threeError) pageReasons.push(`three.js did not load offline (${extra.threeError}); bundle with --offline`);
      runs.push({ width, lang, parts, page: { reasons: pageReasons, errors: errs, blocked, overflow, notes, ...extra } });
      await page.close();
    }
  }
} finally {
  await browser.close().catch(() => {});
  await target.close();
}

/* ---------------------------------------------------------------------------- dump */

async function dumpLang(page, lang, ids) {
  const rest = await page.evaluate(probeText);
  const out = {};
  for (const id of ids) out[id] = { id, lang, rest: rest.parts[id] ? rest.parts[id].text : '', captions: [], after: '', variants: [], folds: [], quotes: [], facts: [], attrs: [], marks: [], duration: 0 };
  const union = (id, t) => {
    if (!t) return;
    const o = out[id];
    for (const q of t.quotes) if (!o.quotes.some((x) => x.text === q.text)) o.quotes.push(q);
    for (const f of t.facts) if (!o.facts.some((x) => x.key === f.key && x.text === f.text)) o.facts.push(f);
    for (const a of t.attrs) if (!o.attrs.includes(a)) o.attrs.push(a);
  };
  for (const id of ids) union(id, rest.parts[id]);
  // 1. play every player through (captions), ending at the end of its story
  for (const id of ids) {
    const r = await page.evaluate(probePlay, id, 100).catch((e) => ({ error: e.message }));
    if (r) {
      out[id].captions = r.captions || [];
      out[id].marks = r.marks || [];
      out[id].duration = r.duration || 0;
      if (r.error) out[id].error = r.error;
    }
  }
  await sleep(200);
  const after = await page.evaluate(probeText);
  for (const id of ids) { out[id].after = after.parts[id] ? after.parts[id].text : ''; union(id, after.parts[id]); }
  if (args.shots) {
    // with --shots, the dump also films every part at the end of its story (review "after Play" too)
    const dir = ensureDir(path.resolve(String(args.shots)));
    await page.addStyleTag({ content: '.pm .pm-stage > .pm-bar { position: relative !important; top: auto !important; }' }).catch(() => {});
    await hideChrome(page, true);
    for (const id of ids) {
      const handle = await page.evaluateHandle((pid) => document.querySelector(`[data-pm-part="${CSS.escape(pid)}"]`) || document.getElementById(pid), id).catch(() => null);
      const el = handle && handle.asElement();
      if (el) await el.screenshot({ path: path.join(dir, `part-${id.replace(/[^\w.-]+/g, '_')}-${dump.width}-${lang}-end.png`) }).catch(() => {});
    }
    await hideChrome(page, false);
  }
  // 2. every option in each bar (segments, toggles): select it, play to the end, record
  if (!args.noVariants) {
    for (const id of ids) {
      const n = await page.evaluate((pid) => {
        const part = document.querySelector(`[data-pm-part="${CSS.escape(pid)}"]`);
        if (!part) return 0;
        const ctl = [...part.querySelectorAll('.pm-bar [role=radio], .pm-bar [role=tab], .pm-bar [role=switch], .pm-bar [aria-pressed], .pm-bar input[type=checkbox], .pm-bar input[type=radio]')]
          .filter((el) => !el.closest('.pm-primary, .pm-scrub'));
        ctl.forEach((el, i) => el.setAttribute('data-pm-lint-ctl', String(i)));
        return ctl.length;
      }, id).catch(() => 0);
      for (let i = 0; i < n; i++) {
        const name = await page.evaluate((pid, k) => {
          const el = document.querySelector(`[data-pm-part="${CSS.escape(pid)}"] [data-pm-lint-ctl="${k}"]`);
          if (!el) return null;
          const on = el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true' || el.checked;
          if (on && /radio|tab/.test(el.getAttribute('role') || el.type || '')) return null;   // already selected
          el.click();
          return (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\s+/g, ' ');
        }, id, i).catch(() => null);
        if (name == null) continue;
        await sleep(120);
        const r = await page.evaluate(probePlay, id, 100).catch(() => null);
        const t = await page.evaluate(probeText);
        union(id, t.parts[id]);
        out[id].variants.push({ control: name, captions: r ? r.captions || [] : [], text: t.parts[id] ? t.parts[id].text : '' });
      }
    }
  }
  // 3. open every fold (folds render lazily on first open)
  await page.evaluate(() => document.querySelectorAll('section.pm-part details, [data-pm-part] details').forEach((d) => { d.open = true; }));
  await sleep(400);
  const final = await page.evaluate(probeText);
  for (const id of ids) {
    const t = final.parts[id];
    if (!t) continue;
    out[id].folds = t.folds.map(({ title, teaser, text }) => ({ title, teaser, text }));
    union(id, t);
  }
  dump.pages[lang] = { rest: rest.page, final: final.page };
  for (const id of ids) dump.parts.push(out[id]);
}

/* ---------------------------------------------------------------------------- report */

const mark = (v, bad) => (bad ? `${v}✗` : String(v));
let failures = 0;
const failedParts = new Set();
console.log(c.bold(`PLAYME lint ${VERSION}`) + c.dim(`  ${offlineFile ? 'file://' + path.resolve(offlineFile) + ' (network blocked)' : target.url}${target.served ? '  served from ' + target.served : ''}`));
for (const run of runs) {
  const l = run.lang;
  console.log('');
  console.log(c.bold(`${run.width} px · ${l}`) + (reduced ? c.dim(' · reduced motion') : ''));
  const rows = [['part', 'q', 'prose', 'primary', 'ctrls', 'folds', 'chips', 'scrub', 'height', 'result']];
  for (const m of run.parts) {
    const ok = !m.reasons.length;
    if (!ok) { failures += m.reasons.length; failedParts.add(m.id); }
    rows.push([
      m.id,
      m.q == null ? '—✗' : mark(m.q, m.q > BUDGET.q[l]),
      mark(m.prose, m.prose > BUDGET.prose[l]),
      mark(m.primary, m.primary !== 1),
      mark(m.ctrls, m.ctrls > BUDGET.ctrls),
      mark(`${m.folds}${m.foldsOpen ? '/' + m.foldsOpen + ' open' : ''}`, m.folds > BUDGET.folds || m.foldsOpen > 0),
      mark(m.chips.length, m.chips.length > 0),
      m.noScrub ? `${m.noScrub} missing✗` : (m.stages ? 'ok' : '—'),
      run.width >= BUDGET.heightMinWidth ? mark(m.height, m.height > BUDGET.height) : c.dim(String(m.height)),
      ok ? 'PASS' : (m.overflow && m.reasons.length === 1 ? 'FAIL overflow' : 'FAIL'),
    ]);
  }
  console.log(table(rows, {
    color: (cell, ri, ci, raw) => (ri === 0 ? c.dim(cell) : raw.startsWith('FAIL') || raw.endsWith('✗') ? c.red(cell) : raw === 'PASS' ? c.green(cell) : cell),
  }));
  const pg = run.page;
  const e = pg.errors;
  const pageOk = !pg.reasons.length;
  if (!pageOk) failures += pg.reasons.length;
  const facts = [`console errors ${e.errors.length}`, `page errors ${e.pageErrors.length}`,
    `failed requests ${e.failedRequests.length}`, ...(offlineFile ? [`network ${pg.blocked.length ? pg.blocked.length + ' blocked' : 'not used'}`] : []),
    `overflow ${pg.overflow.overflow ? pg.overflow.scrollWidth + ' > ' + pg.overflow.innerWidth : 'none'}`];
  if (pg.three) facts.push(`three.js r${pg.three}${pg.inlinedThree ? ' (inlined)' : ''}`);
  console.log(`${pageOk ? c.green('PASS') : c.red('FAIL')} page  ${facts.join(' · ')}${e.warnings.length ? c.dim(` · ${e.warnings.length} warnings`) : ''}`);
  // reasons, in detail
  for (const m of run.parts) for (const r of m.reasons) console.log(`  ${c.red('✗')} ${m.id}: ${r}`);
  for (const r of pg.reasons) console.log(`  ${c.red('✗')} page: ${r}`);
  for (const x of [...e.errors, ...e.pageErrors].slice(0, 6)) console.log(c.dim(`      ${x.slice(0, 220)}`));
  for (const x of [...e.failedRequests, ...pg.blocked.map((b) => b + ' (blocked)')].slice(0, 6)) console.log(c.dim(`      request: ${x}`));
  if (pg.overflow.overflow) {
    for (const o of pg.overflow.offenders) console.log(c.dim(`      past the edge: ${o.el} (${o.left}…${o.right}, width ${o.width})`));
    for (const o of pg.overflow.causes) console.log(c.dim(`      cause: ${o.el} sticks out of ${o.parent} (${o.parentDisplay}); give it max-width: 100% / min-width: 0 / overflow: auto`));
  }
  for (const n of pg.notes) console.log(c.yellow(`  ! ${n}`));
  if (l === 'zh' && pg.hasPM && !pg.cjk) console.log(c.yellow('  ! no Chinese text on the page in zh mode (bilingual strings missing?)'));
  if (!pg.hasPM && run.parts.length) console.log(c.yellow('  ! window.PM is missing: players could not be checked'));
}

const nParts = new Set(runs.flatMap((r) => r.parts.map((p) => p.id))).size;
console.log('');
if (failures) {
  exitCode = 1;
  console.log(c.red(c.bold('FAIL')) + ` ${failures} problem${failures > 1 ? 's' : ''}` + (failedParts.size ? ` in ${failedParts.size} of ${nParts} parts (${[...failedParts].join(', ')})` : '')
    + ` · ${widths.join('/')} px × ${langs.join('/')}`);
} else {
  console.log(c.green(c.bold('PASS')) + ` ${nParts} part${nParts === 1 ? '' : 's'} × ${widths.length} width${widths.length > 1 ? 's' : ''} × ${langs.length} language${langs.length > 1 ? 's' : ''} within the reader budgets`);
}
if (dump) {
  // captions are only seen while a story plays, so their budget is checked here (a warning, not a failure)
  const CJKC = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
  const capLen = (t, lng) => (lng === 'zh'
    ? (t.match(CJKC) || []).length + (t.replace(CJKC, ' ').match(/[A-Za-z0-9][\w.'’+/-]*/g) || []).length
    : t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length);
  const long = [];
  for (const pd of dump.parts) {
    const caps = [...(pd.captions || []), ...(pd.variants || []).flatMap((v) => v.captions || [])];
    for (const cap of new Set(caps)) {
      const first = String(cap).split('\n')[0];
      const n = capLen(first, pd.lang);
      if (n > (pd.lang === 'zh' ? 24 : 12)) long.push(`${pd.id} (${pd.lang}): ${n} ${pd.lang === 'zh' ? 'characters' : 'words'} · "${first.slice(0, 90)}"`);
    }
  }
  if (long.length) {
    console.log(c.yellow(`! ${long.length} caption${long.length > 1 ? 's' : ''} over the budget (12 words / 24 characters):`));
    for (const x of long.slice(0, 12)) console.log(c.dim(`    ${x}`));
  }
  writeJson(String(args.dump), dump);
  console.log(c.dim(`dump: ${dump.parts.length} part texts → ${args.dump}`));
}
if (args.shots) console.log(c.dim(`screenshots → ${path.resolve(String(args.shots))}`));
if (args.json) {
  writeJson(String(args.json), { tool: `playme lint.mjs ${VERSION}`, url: target.url, budgets: BUDGET, verdict: failures ? 'FAIL' : 'PASS',
    runs: runs.map((r) => ({ ...r, page: { ...r.page } })) });
  console.log(c.dim(`report → ${args.json}`));
}
process.exit(exitCode);
