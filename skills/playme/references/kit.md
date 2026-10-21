# The lab kit: API reference

The kit is plain CSS and classic scripts. There is no build step and no runtime dependency. Everything hangs off
`window.PM`. The live kitchen sink is `kit/demo.html`; open it next to this file.

```html
<link rel="stylesheet" href="kit/playme.css">
<!-- optional, in this order: playme-desk.css, playme-3d.css -->
<script src="kit/playme.js"></script>
<!-- optional, in this order: playme-desk.js, playme-3d.js -->
```

Every kit selector sits under the `.pm` root class, so the kit can live inside an existing homepage. `PM.part()` adds
`.pm` to its host when no ancestor has it. A standalone page uses `<body class="pm pm-page">` (background, base type).

## Contents

1. [Tokens](#tokens)
2. [Core helpers](#core-helpers): language, DOM, motion, time math, formatting
3. [The part template](#the-part-template): `PM.part`
4. [The player](#the-player): `PM.player`, the virtual clock
5. [Controls](#controls): `PM.button`, `PM.segmented`, `PM.toggle`, `PM.target`, `PM.langToggle`
6. [Code and intent](#code-and-intent): `PM.code`, `PM.intent`
7. [Readouts, source line, folds](#readouts-source-line-folds)
8. [Page helpers and hooks](#page-helpers-and-hooks): `PM.boot`, `PM.players`, events, URL parameters
9. [A complete part in 40 lines](#a-complete-part-in-40-lines)
10. [Rules the kit enforces, and gotchas](#rules-the-kit-enforces-and-gotchas)
11. [Devices (playme-desk.js)](#devices-playme-deskjs)
12. [Exploded 3D view (playme-3d.js)](#exploded-3d-view-playme-3djs)

## Tokens

Declared on `.pm` in `playme.css`. Override any of them on `.pm` (or on one part) to restyle. Extension CSS
(desk, 3d) uses only these tokens, except inside simulated app screens, which are light like real screens.

| token | default | use |
|---|---|---|
| `--pm-bg` / `--pm-bg-2` | `#07080E` / `#0C0E18` | page ground / raised ground |
| `--pm-panel` / `--pm-panel-2` | `rgba(18,21,36,.78)` / `rgba(28,32,52,.92)` | panels / selected fills |
| `--pm-line` / `--pm-line-2` | `rgba(150,162,230,.14)` / `.28` | hairlines / control outlines |
| `--pm-hi` / `--pm-tx` / `--pm-mu` | `#F3F4FA` / `#B3B8CC` / `#767C93` | headings and live text / body / muted |
| `--pm-accent` / `--pm-accent-2` | `#5EEAFF` / `#2BB8FF` | live, focus, scrubber fill |
| `--pm-play` | `#F3F4FA` | primary button fill (its text is `--pm-bg`) |
| `--pm-agent` `--pm-user` | `#A98BFF` `#FFB454` | the two actors |
| `--pm-ok` `--pm-err` `--pm-warn` `--pm-info` | `#45E3A2` `#FF6378` `#FFD25E` `#7AA8FF` | outcomes, marks |
| `--pm-paper` / `--pm-paper-ink` | `#ECE5D4` / `#2A2620` | the static "presentation" look |
| `--pm-code-bg` / `--pm-code-ink` | `#0A0C15` / `#D8DCEB` | code panes |
| `--pm-display` `--pm-sans` `--pm-mono` | Archivo / Instrument Sans / JetBrains Mono stacks | type; link `kit/fonts/fonts.css` (OFL subsets, inlined by bundle.py) |
| `--pm-r` `--pm-r-sm` `--pm-r-lg` | `10px` `6px` `16px` | radii |

Derived tokens (also overridable): `--pm-code-ln`, `--pm-tk-kw|str|num|fn|com|key` (syntax colours), `--pm-tone`.
`--pm-scroll-top` sets the scroll margin of a part (height of a sticky page header).

Tone classes `.pm-tone-ok|err|warn|info|agent|user|accent|neutral` set `--pm-tone` on any element. The focus ring is
`outline: 2px solid var(--pm-accent); outline-offset: 3px` everywhere. Under `html[lang^=zh]` labels drop uppercase
and letter-spacing, and prose gets taller line height.

## Core helpers

### Language

Bilingual text lives in attributes, so a language switch never re-renders a page: a `MutationObserver` on
`<html lang>` re-sets every bilingual node and attribute, then calls the `onLang` subscribers.

```js
PM.lang() → 'en' | 'zh'                 // from <html lang>: anything starting with "zh" is 'zh'
PM.setLang('zh')                         // sets <html lang="zh-CN"> (or "en"), swaps now, stores the choice in localStorage 'pm-lang'
PM.onLang(cb) → off                      // cb('en'|'zh') after each actual change
PM.t(en, zh?) → string                   // also PM.t({en, zh}); zh falls back to en
PM.L(en, zh?, tag = 'span', attrs?) → Element   // text that follows the language (data-l-en / data-l-zh)
PM.LH(enHtml, zhHtml?, tag, attrs?) → Element   // same, trusted HTML (prose with <code>, <b>)
PM.lAttr(el, name, en, zh?) → el         // bilingual attribute (aria-label, title, alt, placeholder)
PM.applyLang(root?)                      // re-apply to static markup you inserted yourself
```

Start language: `?lang=zh|en` (this visit only) wins, then the stored choice, then the page's own `<html lang>`.
Static HTML can be bilingual too: `<span data-l-en="Play" data-l-zh="播放">Play</span>`.

Use `PM.L(...)` or `{en, zh}` objects for anything that stays on screen (labels, captions, marks). A `PM.t(...)`
string is resolved once and does not follow a later switch.

### DOM

```js
PM.h(tag, attrs?, ...children) → Element
//   attrs: class (string | array), style (object | string; numbers get px), dataset, html (trusted), text,
//          ref(el), on<Event>: fn, aria-*, role, any attribute; an {en, zh} value makes a bilingual attribute.
//   children: nodes, strings, numbers, {en, zh}, arrays, null / false (skipped).
//   SVG tags (svg, g, path, circle, rect, line, text, defs, linearGradient, …) are created in the SVG namespace.
PM.s(tag, attrs?, ...children) → SVGElement   // any tag in the SVG namespace (a, title, image, style)
PM.content(v) → Node | null                   // 'text' | {en, zh} | Node | array | () => any
PM.plain(v) → string                          // visible text of v in the current language
PM.icon(name, {label?, size = 16}) → <svg>    // play pause replay chev prev arrow check close plus minus reset copy external
PM.asset(path) → url                          // window.PM_ASSETS[path] (data URI written by bundle.py) || path
```

Write asset paths as string literals inside `PM.asset('assets/x.png')`: `bundle.py` finds them and inlines the files.

### Motion, viewport, time math

```js
PM.reduced() → bool              // prefers-reduced-motion, ?motion=reduce, or <html data-pm-motion="reduce">
PM.inView(el, cb(visible), {rootMargin, threshold}?) → disconnect
PM.ease.linear | in | out | inOut   // k → k (cubic)
PM.clamp(v, a, b) ; PM.lerp(a, b, k)
PM.span(t, t0, t1, ease?) → 0..1    // progress of t inside [t0, t1]
PM.step(t, [[t0, v0], [t1, v1], …]) → v   // value of the last pair whose time ≤ t (before the first: the first value)
```

### Formatting

```js
PM.fmt.int(3651) → '3,651'        PM.fmt.num(75.63, 1) → '75.6'
PM.fmt.k(41200) → '41.2K'         PM.fmt.pct(0.684) → '68%'   PM.fmt.pct(0.684, 1) → '68.4%'   // pct takes a 0–1 ratio
PM.fmt.time(7000) → '0:07'        PM.fmt.time(3725000) → '1:02:05'
```

Negative numbers use a true minus sign. Print numbers exactly as the paper prints them; format, never re-round.

## The part template

Every interactive section is built from one template. This is the skill's central rule: one question, one stage,
one sentence of takeaway, depth folded away.

```js
const P = PM.part(hostEl, {
  id: 'read-or-play',                        // deep links (#read-or-play, ?part=read-or-play), lint, capture
  eyebrow: PM.L('Lab 01 · Presentation vs experience', '实验 01 · 呈现与体验'),   // optional mono label
  q: PM.L('One plain question, at most 14 words?', '……'),                         // required
  lead: PM.L('Optional: one sentence.', '……'),                                    // optional
  takeaway: PM.L('One sentence: muted at rest, bright after the first run.', '……'),
  source: [{ kind: 'sim' | 'real' | 'paper' | 'note', text: PM.L('…', '…') }],   // one plain line, never pills
  folds: [{ title, teaser, render(el) { … } }],                                   // ≤ 4, closed, rendered on first open
  flush: false,                                                                   // true: no padding in the scene
});
// P = {id, el, bar, scene, narration, outcome, stage, takeaway, folds,
//      setSource(list), markRun(), fold(i) → <details>, player}
```

`PM.part` appends one section to the host. The DOM is a contract: `lint.mjs`, `capture.mjs` and the docs rely on
these class names, so never rename them.

```
section.pm-part#<id>[data-pm-part=<id>][data-pm-state=static|idle|running|paused|done]
  p.pm-eyebrow?   h3.pm-q   p.pm-lead?
  div.pm-stage
    div.pm-bar         primary · ≤ 2 options · transport (scrubber + timecode)
    div.pm-scene       the thing that moves; in-scene targets allowed (.pm-target)
    div.pm-narration   live caption, aria-live=polite, two lines reserved
  p.pm-source
  div.pm-outcome       readouts
  p.pm-takeaway        (.is-lit after the first run)
  div.pm-deeper > p.pm-deeper-label + details.pm-fold > summary(.pm-fold-chev .pm-fold-title .pm-fold-teaser) + div.pm-fold-body
```

Empty slots collapse (`:empty`), so a part without readouts or source shows nothing there.

- `P.markRun()` lights the takeaway once; it stays lit. The player calls it when a run reaches the end. Call it
  yourself for parts that end without a player (for example, after the reader found every hotspot).
- `P.fold(i)` returns the i-th `<details>`. Set `.open = true` to open it; its `render(el)` runs on the first open.
  `render` may fill `el` directly or return a node / `{en, zh}` / string.
- Put the scene's DOM in `P.scene`. Put options in the bar with `P` (or `P.bar`) as their parent.

## The player

A part's story runs on a **virtual clock** that the kit owns. Every wait and every motion goes through `ctx.sleep` and
`ctx.tween`. Because of that, one script can

- **play** in real time (a `requestAnimationFrame` driver advances the clock),
- be **measured** instantly on mount: every wait resolves at once, so the kit learns the total duration, the caption
  times and the marks, and the scrubber shows its ticks before the first Play,
- be **sought** to any time: `reset()`, then re-run instantly up to that time (tweens land on their clamped `k`),
- be **captured** frame by frame: `setManual(true)` and `advance(ms)`, or `seek(t)` per frame.

### Two ways to write a story

```js
// 1. A script: reset() restores the scene's rest state; run(ctx) tells the story.
const player = PM.player(P, {
  label: PM.L('Play', '播放'),                        // primary label at rest (then Pause / Resume / Replay)
  reset() { ptr.set(200, 300); win.classList.remove('is-hit'); ro.reset(); },
  async run(ctx) {
    ctx.narrate(PM.L('The agent clicks without naming a window.', '……'));
    await ctx.tween(900, (k) => ptr.set(PM.lerp(200, 612, k), PM.lerp(300, 404, PM.ease.inOut(k))));
    ctx.mark(PM.L('Click lands in the front window', '……'), 'err');   // a toned tick on the scrubber, here
    await ctx.sleep(600);
  },
  onDone() { ro.set('hits', 1, 'err'); },              // fill readouts when a run reaches the end
});

// 2. A pure timeline: the scene is a function of t. The kit wraps it as tweens between captions and marks.
PM.player(P, {
  duration: 9600,
  render(t) { /* set everything from t alone */ },
  captions: [{ t: 0, text: PM.L('…', '…') }, { t: 3000, text: PM.L('…', '…'), tone: 'ok' }],
  marks: [{ t: 3000, label: PM.L('Three lanes done', '……'), tone: 'ok' }],
  reset() { /* optional: extra rest state; render(0) is called for you */ },
});
```

Other options: `labels: {pause, resume, replay}` (custom words), `hint` (the muted caption at rest; default
"Press “<label>” to watch it happen."; `null` for none), `autoPause: false` (keep playing off screen).

### ctx

```js
ctx.sleep(ms)                 → thenable   // wait on the virtual clock
ctx.tween(ms, fn(k), ease?)   → thenable   // fn gets k from 0 to 1 (eased if ease is given); always ends with fn(1)
ctx.narrate(text, tone?)                   // one caption at a time; tone: ok err warn info agent user accent neutral
ctx.mark(label, tone = 'warn')             // a key moment: a toned tick on the scrubber; the frame flashes in that tone
ctx.seeking  ctx.measuring  ctx.reduced    // booleans (seeking is true while the clock jumps, including measure)
ctx.now                                    // the script's own clock (ms)
ctx.signal                                 // AbortSignal: aborted when the run is replaced (seek, replay, reset)
```

`await` every `ctx.sleep` / `ctx.tween`, or `await Promise.all([...])` of several (they run side by side). Awaiting a
wait moves the script's clock to the end of that wait, whatever the frame timing was, so marks and captions land at
exact times. A wait created "in the past" (during a seek, or inside a long frame) lands at once on its end state.

### Player API

```js
player.play()  pause()  resume()  replay()       // every method that moves time returns a Promise
player.seek(ms, {pause}?)    // reset + instant re-run to ms; keeps playing if it was playing (or pass pause)
player.reset()               // back to rest ('idle') and re-measure; call it when an option changes the story
player.advance(ms)           // step the clock exactly (manual capture); resolves when the scene shows that time
player.setManual(bool)       // the clock moves only through advance(); CSS transitions in the part are off
player.measure()             // re-learn the timeline (at rest) → {total, beats, marks}
player.onState(cb) → off     // cb('idle' | 'running' | 'paused' | 'done')
player.state  duration  time  marks  beats       // read-only; marks = [{t, label, tone}]
player.ready                 // Promise: the first measure is done (duration and marks are known)
player.el  primary  scrub    // the stage, the primary button, the scrubber
```

`PM.players[partId]` holds every player, for capture scripts and the console.

### What the reader gets

- **Primary button** `.pm-primary`: Play → Pause → Resume → Replay. It keeps the width of its widest label, so the
  bar never shifts. At rest it breathes softly (five times, only while on screen).
- **Scrubber** `.pm-scrub` (`role=slider`): track, cyan fill, playhead, dark notches at caption beats, toned pins at
  marks. Click or drag to seek; hover shows the time and the caption or mark there. Keys: ← / → previous / next beat
  or mark, Home / End, Space or Enter play / pause. A click at rest lands paused at that moment.
- **Timecode** `0:03 / 0:09` (mono, tabular).
- **Narration**: one caption at a time in `.pm-narration` (two lines reserved). Under reduced motion, Play jumps to the
  end at once and the narration lists the last four captions; the scrubber still steps through every moment.
- **Auto-pause** when the part leaves the viewport; it resumes when it comes back.
- **Done**: the takeaway brightens, the readouts pulse, `onDone()` runs, the button says Replay.

### Writing deterministic stories

A player is a pure function of time. Seek, capture and measure all depend on that.

- Set every visual from the script's progress: positions from `k`, classes from the step you are at.
- Never use `Date`, `Math.random`, `setTimeout` or CSS transitions for meaning. Decorative transitions are fine:
  the kit turns transitions off while the clock jumps (`.pm-seeking`), measures (`.pm-measuring`) or captures
  (`.pm-manual`).
- `reset()` must restore everything the script changes, including readouts (`ro.reset()`).
- The story must end. An endless loop is stopped after 20,000 waits in instant mode, with a console warning.
- Do not await anything except `ctx.*` inside `run`; the kit cannot pause or measure other promises.
- An option that changes the story calls `player.reset()` in its `onChange`, so the marks are re-measured.

### Capture recipe

```js
const p = PM.players['read-or-play'];
p.setManual(true);
await p.seek(0, { pause: true });
await p.play();                                   // running, but the clock moves only through advance()
for (let f = 0; f < fps * p.duration / 1000; f++) { await p.advance(1000 / fps); /* screenshot */ }
// or, statelessly: for each frame, await p.seek(t, {pause: true}) and screenshot
```

## Controls

Only these, and in-scene targets, carry button shapes (rule R5). Labels, sources and statuses stay flat text.
Pass `P` (or `P.bar`) as the parent to put a control in a part's bar; it lands before the scrubber.

```js
PM.button(parent, label, {kind: 'primary' | 'secondary' | 'ghost', icon?, onClick, ariaLabel?, title?, small?}) → <button>
//   el.setLabel(label), el.setIcon(name). label null → an icon-only button (give it ariaLabel).
PM.segmented(parent, {options: [{id, label, disabled?}], value, onChange(id), ariaLabel?}) → {el, set(id, {silent}?), value}
PM.toggle(parent, {label, value = false, onChange(v), ariaLabel?}) → {el, set(v, {silent}?), value}   // role=switch
PM.target(el, {onActivate, label?, pressed?}) → el      // in-scene: hover glow, focus ring, Enter/Space, aria-pressed
PM.langToggle(parent?) → <button>                       // "EN / 中文"; place it inside .pm
```

Budget: one primary and at most two options per part. `.pm-target[aria-pressed=true]` (or `.is-selected`) is the
selected look.

## Code and intent

```js
PM.intent(parent, PM.L('Fill seven status cells, then save', '……')) → el     // "<intent> …" above the code
const pane = PM.code(parent, {
  src, lang: 'python' | 'js' | 'bash' | 'json' | 'text',
  title?,                     // head line (file name); the language name shows on the right
  lineNumbers: true, start: 1, lineMap?: [n | null, …],   // displayed numbers (lineMap for real excerpts)
  maxHeight?,                 // number (px) or CSS length: the pane scrolls vertically
  focus?: ['window="Report.xlsx"'],                        // decisive text: a glowing outline, every occurrence
  marks?: { 3: 'run', 6: 'err', 7: 'ok', 1: 'dim' },      // run | ok | err | warn | dim, by displayed line number
});
// → {el, scroller, set(src?, opts?), mark(line, tone | null), mark({line: tone, …}), clear(), focus(tokens), reveal(line), lines}
PM.highlight(src, lang) → html                              // the highlighter alone
```

- Lines never wrap. The pane scrolls both ways inside itself; the line-number gutter stays put. While there is more
  to see, the right edge fades and a "scroll →" hint shows (in the head, or over the corner) until the reader scrolls.
- A line that is only `…` (or `...`) renders muted and unnumbered: the elision. Numbers continue after it; pass
  `lineMap` when the numbers must match a real file.
- Focus tokens are matched as plain substrings inside one line and outlined across syntax spans.
- `reveal(line)` scrolls the pane, never the page.

## Readouts, source line, folds

```js
const ro = PM.readouts(P, [{ id, label, value: '—', tone?, unit?, sub? }]) → {el, set(id, value, tone?), get(id), reset()}
ro.set('steps', 41).set('ok', PM.fmt.pct(0.684, 1), 'ok');   // integers print with fmt.int; '—' / null = "no result yet"

PM.source(P, [{ kind: 'sim' }, { kind: 'paper', text: PM.L('Paper §4.3.1 · Fig. 6', '论文第 4.3.1 节 · 图 6') }]);
// one plain line: "◇ Simulation · ¶ Paper §4.3.1 · Fig. 6"; ● Real run (green), ※ note. Without text, sim / real /
// paper print "Simulation" / "Real run" / "Paper". Also accepts a <p class="pm-source"> instead of P.

PM.fold(parent, { title, teaser, render(el) }) → <details>   // a fold outside the template (same look and lazy body)
```

Readouts are big tabular numbers between hairlines. Use a tone only when it carries meaning (ok / err), not for
decoration. A real run's source names its provenance: model · task · run · step.

### Quotes and tables

`<q class="pm-quote">…</q>` (inline) or `<blockquote class="pm-quote">…</blockquote>` marks a sentence quoted from
the paper: it is styled, and `fidelity.py` checks it verbatim. Wrap a data table as
`<div class="pm-table-wrap"><table class="pm-table">…</table></div>` (scrolls sideways on phones; give numeric cells
`class="num"`).

## Page helpers and hooks

```js
PM.register(id, (host, PM) => { /* build one part into host */ })   // one part per file
// facts: <script type="application/json" id="pm-facts" data-src="facts.json"></script> is read by PM.boot() before
// any part mounts (inline when bundled, fetched over http in development)
PM.fact(key, lang?) → '41.2K'        PM.F(key, tag='span') → element with data-fact (checked by fidelity.py)
PM.ref(id) → "Paper §4.3.1" / 「论文第 4.3.1 节」 from facts.json refs   PM.loadFacts() → Promise<facts>
PM.boot(async (PM) => { /* optional page-level setup */ }) → Promise<PM>
// after DOMContentLoaded: applies the language to static markup, runs your builder, mounts every registered part
// into <div data-pm-slot="id"> (created inside #pm-parts or <main> when missing), scrolls to #<part-id>,
// then sets <html data-pm-ready> and fires 'pm:ready' on document.
PM.players          // {partId: player}
PM.version          // '1.0.0'
```

| hook | where | detail |
|---|---|---|
| `pm:state` event | part section (bubbles) | `{id, state}` |
| `pm:fold` event | `<details>` (bubbles) | `{index, open}` |
| `pm:ready` event | `document` | after `PM.boot` |
| `data-pm-state` | part section | `static` (no player) / `idle` / `running` / `paused` / `done` |
| `data-pm-ready` | `<html>` | set by `PM.boot` |
| `?part=<id>&t=<ms>` | URL | seek that player to t (or `t=4.2s`), pause, scroll to it: screenshots and reviews |
| `?lang=zh` | URL | start in Chinese for this visit |
| `?motion=reduce` | URL | behave as under prefers-reduced-motion |

## A complete part in 40 lines

```js
PM.boot((PM) => {
  const { h, L, lerp, ease } = PM;
  const P = PM.part(document.getElementById('labs'), {
    id: 'retry',
    q: L('What does one retry change for a lost packet?', '一次重试能为丢失的数据包带来什么？'),
    takeaway: L('One retry delivers the packet, at the cost of a second trip.', '重试一次能送达，代价是多跑一趟。'),
    source: [{ kind: 'sim' }],
    folds: [{ title: L('The sender', '发送方'), teaser: L('The retries argument decides it.', '决定结果的是 retries 参数。'),
      render(el) { PM.code(el, { lang: 'python', src: 'send(packet)\nsend(packet, retries=3)', focus: ['retries=3'] }); } }],
  });
  const dot = h('div', { class: 'dot' });
  P.scene.append(h('div', { class: 'wire' }, dot));
  const at = (x) => { dot.style.left = `${x}%`; };
  const ro = PM.readouts(P, [{ id: 'tries', label: L('Attempts', '尝试次数') }]);
  let retry = false;
  PM.toggle(P, { label: L('Retry on loss', '丢失后重试'), onChange(v) { retry = v; player.reset(); } });
  const player = PM.player(P, {
    reset() { at(0); dot.classList.remove('is-lost'); ro.reset(); },
    async run(ctx) {
      ctx.narrate(L('The sender sends the packet.', '发送方发出数据包。'));
      await ctx.tween(1200, (k) => at(lerp(0, 50, k)), ease.inOut);
      dot.classList.add('is-lost');
      ctx.mark(L('Packet lost', '数据包丢失'), 'err');
      await ctx.sleep(800);
      if (!retry) return;
      dot.classList.remove('is-lost');
      ctx.narrate(L('Retry: it passes this time.', '重试：这次通过了。'), 'ok');
      await ctx.tween(2000, (k) => at(lerp(0, 100, k)), ease.inOut);
      ctx.mark(L('Delivered', '已送达'), 'ok');
    },
    onDone() { ro.set('tries', retry ? 2 : 1); },
  });
});
```

## Rules the kit enforces, and gotchas

- One `.pm-primary` per part (the player makes it); at most two options next to it. Reset is Replay, not a button.
- Folds start closed and render lazily; the part warns in the console above four.
- Never put boxed chips around labels, sources or statuses: only controls and `.pm-target` look clickable.
- The stage clips its content (`overflow: hidden`). Keep tooltips and popovers inside the scene.
- A part's id must be unique on the page; a second player with the same id replaces the first (console warning).
- Language: prefer `PM.L` / `{en, zh}` over `PM.t` for anything that stays on screen.
- Reduced motion is honoured by the kit (instant runs, no breathing, no pulses). Ambient scene animations of your own
  should check `PM.reduced()` or `@media (prefers-reduced-motion: reduce)`.
- Test at 1440 and 400 px, in both languages, at rest and after Play (`lint.mjs` does this).

## Devices (playme-desk.js)

Realistic device frames, so readers recognise a Mac, a browser, a phone or a terminal without a text label (rule R10;
author feedback R4.6 "put the cross-device UI in phone / browser / Mac frames" and R6.1 "make the frames look more
like a real computer, browser and phone"). Include after the core:

```html
<link rel="stylesheet" href="kit/playme.css">
<link rel="stylesheet" href="kit/playme-desk.css">
<script src="kit/playme.js"></script>
<script src="kit/playme-desk.js"></script>
```

Live demo of everything below: `kit/demo-desk.html` (EN / 中文, 1440 and 400 px).

### Three rules the module is built on

1. **Logical pixels.** A Mac desktop is laid out in a fixed logical size (default 1280 × 800), a phone screen in
   360 × 780 dp. The whole screen is scaled to its container with one CSS transform, so the code you show readers can
   use the scene's own coordinates (`click(612, 404)` really is the point where the pointer lands).
2. **State is set, not animated.** A player seeks by resetting and re-running the story instantly, so every state can be
   set for any time `t`: `ptr.set(x, y)`, `desk.raise(id)`, `desk.order(ids)`, `desk.restore(snap)`,
   `ptr.ripple(k)`, `desk.flash(target, tone, k)`. Drive them from `ctx.tween`. Motion that is only polish (the
   one-shot ripple of `ptr.click`, one-shot flashes, the toast slide-in, `ptr.moveTo`) is skipped while a player
   measures or seeks (`.pm-measuring` / `.pm-seeking`) and under reduced motion.
3. **Screens are light, like real screens.** Device chrome and app content use a light palette (`--pm-s-*`, declared on
   `.pm-screen`) and literal hardware materials (`--pm-dev-*`, declared on `.pm-dev`); everything that belongs to the
   page (glows, terminal text) uses the kit tokens. Override any of them on `.pm`.

### Mac desktop

```js
const { el, screen, desk } = PM.device.mac(P.scene, {
  width: 1280, height: 800,               // logical size
  hardware: 'laptop',                     // 'laptop' (lid + base) | 'display' (bezel + stand) | 'none'
  wallpaper: 'aurora',                    // 'aurora' | 'dusk' | 'light' | 'dark' | any CSS background (+ wallTone: 'light')
  menubar: { app: 'Finder', clock: 'Tue 9:41 AM' },   // app shown when no window is focused; false hides the bar
  dock: true,                             // true: Finder + the apps of the windows | ['Finder', 'Mail', …] | false
  icons: [{ name: 'Report.xlsx' }],       // desktop icons on the right edge (kind from the extension; x, y optional)
  crop: { x: 330, y: 0, w: 930, h: 720 }, // phones: below 560 px of width (or with always: true) show only this region, larger
  interactive: false,                     // true: readers drag windows by the title bar; a click raises
});
```

| desk | does |
|---|---|
| `desk.window({id, title, app, x, y, w, h, content, kind, focused, z, theme})` → `win` | a macOS window: traffic lights, centred title, shadow. `kind`: `'standard'` · `'browser'` (tab strip with the lights, toolbar, address bar; takes `url`, `tabs` like `PM.device.browser`) · `'terminal'` (dark; takes `prompt`, `lines`; `win.term.print`) · `'plain'` (no chrome). The newest window is focused unless `focused: false` or `z: 'back'` (added behind the others). `content`: a Node or anything with `.el` (the app helpers below). Same as `PM.device.window(desk, opts)`. |
| `win` | `{id, el, content, app, title, rect(), setTitle(t), setContent(node), raise(), move(x, y), resize(w, h), show(on), find(sel), browser?, term?}` |
| `desk.raise(id, {focus = true})` | bring a window to the front; by default it becomes the focused window (bright title and lights, its app in the menubar), as a click does on macOS |
| `desk.focus(id \| null)` · `desk.order()` / `desk.order(ids)` | focus without reordering · read or set the stacking order (back → front) instantly |
| `desk.windowAt(x, y)` → `win \| null` · `desk.windowsAt(x, y)` → `[win]` | the window a global click reaches (front-most; null on the desktop or the menubar) · every window under the point, front → back. Never depends on `crop`, so a story behaves the same at every width |
| `desk.pointer('agent' \| 'user', label?, {id, style, x, y, visible})` → `ptr` | one pointer per kind (a second call returns it). Agent violet "Agent / 智能体", user amber "You / 你"; `label`: string, `{en, zh}`, Node or `false`. Arrows counter-scale (`--pm-ui`) so they stay legible when the desktop is drawn small |
| `ptr.set(x, y)` · `ptr.show(on)` · `ptr.label(text)` · `ptr.pos()` | instant placement (the call players use) |
| `ptr.ripple(k, tone?)` | deterministic click ripple at the pointer, progress `k` 0..1 (`k ≤ 0` or `≥ 1` hides it) |
| `ptr.click(x, y, tone?)` → `win \| null` | place, one-shot ripple (polish), return what the click hits |
| `ptr.moveTo(x, y, ms?)` → `Promise` | wall-clock glide, for pages without a player only |
| `desk.flash(target, tone, k?, {hold}?)` | outline a window, an element (e.g. `sheet.cell('E2')`) or `'screen'`. With `k`: deterministic (fade in, hold, fade out over 0..1; with `{hold: true}` it fades in and stays until `restore()`/`clearFx()`). Without: one-shot polish. A target hidden behind another window flashes dashed, as an x-ray, above the front window |
| `desk.toast({title, body, app, icon, time, ms})` → `{el, remove()}` | a notification banner, top right. Appears instantly, stays until `remove()`, `clearFx()` or `restore()` (`ms` auto-dismisses on wall-clock time, pages without a player only) |
| `desk.snapshot()` · `desk.restore(snap?)` | save / restore windows (order, focus, geometry, visibility, title) and pointers; `restore` also clears every flash, ripple and toast. Take the snapshot after building the scene |
| `desk.clearFx()` · `desk.rectOf(el)` · `desk.toLocal(clientX, clientY)` | remove effects · element → logical rectangle · page → logical coordinates |
| `desk.wallpaper(wp, tone?)` · `desk.menubar({app, clock})` · `desk.icons(list)` · `desk.crop(region \| null)` · `desk.on('raise' \| 'focus' \| 'move', fn)` → off · `desk.scale` · `desk.destroy()` | |

Tones everywhere: `'ok' | 'err' | 'warn' | 'info' | 'agent' | 'user' | 'accent'`.

### Browser, phone, terminal

```js
const br = PM.device.browser(el, {
  tabs: [{ title: 'Release notes', url: 'https://docs.example.com/2.4', active: true, content: pageNode }, 'Pricing'],
  height: 300,                 // fluid width, page height in CSS px; or width + height (logical) to scale it like a Mac
});
// → {el, screen /* active page */, select(i), setUrl(url, i?), setTitle(t, i?), addTab(tab), page(i),
//    pointer(kind, label), flash(target, tone, k?), rectOf(el), clearFx()}
const ph = PM.device.phone(el, { time: '9:41', app: 'Files', items: [{ title: 'Boarding pass.pdf', sub: 'Today' }], maxWidth: 260 });
// → {el, screen /* app slot */, setScreen(node), tap(x, y, tone), pointer(kind, label) /* fingertip */, flash(…), rectOf(el), clearFx()}
const term = PM.device.terminal(el, { title: 'zsh', prompt: 'user@mac ~ %', rows: 9 });
const ln = term.print('python fill_report.py', 'cmd');   // kinds: cmd out ok err warn info dim agent user
ln.set('python fill_report.py --window "Report.xlsx"');   // rewrite a line (type it letter by letter from a tween)
```

The browser is Chrome-like (tab strip with the window's traffic lights, back / forward / reload, address bar with lock,
host dark and path grey); a narrow fluid browser shrinks inactive tabs to their favicon. The phone is an Android phone
(rounded body, side keys, punch-hole camera, status bar, gesture pill); its coordinates are dp on the screen. The
terminal keeps the newest line in view and fades the top edge once older lines scroll away.

### App content (light, like real screens)

| helper | gives |
|---|---|
| `PM.device.sheet({cols, rows, title, minRows = 16, colWidths, selected})` | ribbon, formula bar, lettered columns, numbered rows, sheet tabs. `cols` (names) fills row 1 as a bold header; numbers get thousands separators. API: `cell(ref)`, `get(ref)`, `set(ref, value, tone?)`, `mark(ref, tone \| null)`, `select(ref)`, `selected()`; refs as displayed (`'C4'`) or `[row, col]` |
| `PM.device.doc({title, paragraphs})` | word processor: ribbon, toolbar, white page on a grey canvas, status bar. Paragraph styles `title h1 h2 p li muted`; API `add(text, style)`, `paragraphs()`, `page` |
| `PM.device.list({title, search, items, selected})` | a list app (files, inbox, phone apps): icon tile, title, second line, meta. API `item(i)`, `select(i)`, `setItems(items)`; phone type sizes inside a phone |
| `PM.device.termView({prompt, lines})` | the terminal body alone (used by terminal windows) |
| `PM.device.icon(name, size)` · `PM.device.appIcon(app, size)` · `PM.device.fileKind(name)` | line glyphs · generic rounded app icons (no brand marks) · `'sheet' \| 'doc' \| 'pdf' \| 'image' \| 'folder' \| 'file'` |

Menu-bar menus and ribbon tabs follow the page language (as macOS and Office show them in Chinese). Text you pass as a
plain string (window and tab titles, cell values) stays as written, like a real device; pass `{en, zh}`
or a `PM.L` node wherever the reader should see the page language (toasts, list items, pointer labels).

### Recipe: a click that names no window

```js
const { desk } = PM.device.mac(P.scene, { crop: { x: 330, y: 0, w: 930, h: 720 } });
const sheet = PM.device.sheet({ cols: ['Region', 'Q4'], rows: [['North', '']] });
desk.window({ id: 'report', app: 'Excel', title: 'Report.xlsx', x: 70, y: 64, w: 720, h: 500, content: sheet });
desk.window({ id: 'web', kind: 'browser', app: 'Chrome', x: 430, y: 150, w: 780, h: 560, url: 'https://example.com', content: page });
const agent = desk.pointer('agent').set(420, 690);
const s0 = desk.snapshot();

PM.player(P, {
  reset() { desk.restore(s0); sheet.set('B2', '', null); },
  async run(ctx) {
    ctx.narrate({ en: 'The agent clicks (612, 404) and names no window.', zh: '智能体点击 (612, 404)，没有指定窗口。' });
    await ctx.tween(1000, (k) => agent.set(PM.lerp(420, 612, k), PM.lerp(690, 404, k)), PM.ease.inOut);
    const hit = desk.windowAt(612, 404);                       // the browser: it is in front
    ctx.mark({ en: 'The click lands in the front window', zh: '点击落在前台窗口' }, 'err');
    await ctx.tween(800, (k) => { agent.ripple(k, 'err'); desk.flash(hit, 'err', k); });
    sheet.set('B2', 14980, 'ok');                              // the named-window save reaches the back window
    await ctx.tween(1000, (k) => desk.flash(sheet.cell('B2'), 'ok', k));   // dashed: it is behind the browser
  },
});
```

### Gotchas

- Text inside a 1280-px desktop is small on a phone. Use `crop` (the region the story happens in) and keep the key
  information in pointer labels, flashes, the narration and readouts, not in tiny window text.
- `desk.pointer('agent')` twice returns the same pointer; pass `{id}` for a second agent.
- Toasts and deterministic flashes stay until removed: always `desk.restore(s0)` (or `clearFx()`) in `reset()`.
- Never use `ptr.moveTo` or `toast({ms})` inside a player story: they run on wall-clock time.
- Device chrome sits inside `.pm-scene`, so its tabs, cells and buttons do not count as controls or chips for lint.
  Classes are `pm-` prefixed under `.pm-dev`; the flash box is `.pm-dev-flash` (the core's `.pm-flash` is the stage
  flash).

## Exploded 3D view (playme-3d.js)

Use it when depth carries meaning: layers that really sit on top of each other (a screen and its UI tree, a page and
its data, the parts of a system). `PM.layers3d` turns canvases or images into luminous glass sheets that readers take
apart, orbit and pick. three.js r160 is loaded on demand; there is nothing else to install. Live demo: `kit/demo-3d.html`.

```html
<link rel="stylesheet" href="kit/playme-3d.css">     <!-- after playme.css -->
<script src="kit/playme-3d.js"></script>             <!-- after playme.js; kit/vendor/ must sit next to it -->
```

```js
const ready = PM.layers3d(P.scene, {
  layers: [                                         // TOUR order: badges 1…n, keys 1…9, your guided pass
    {id: 'screen', label: {en: 'App screen', zh: '应用界面'}, sub: 'what the user sees', tint: 'accent',
     w: 1200, h: 750, draw(ctx, w, h, state) { … }},  // draw in layer px; state = {id, lang, scale}
    {id: 'ui', label: 'UI tree', tint: 'ok', w: 1200, h: 750, draw: drawTree, opacity: 0.6},
    {id: 'photo', label: 'Photo', img: 'assets/shot.webp'},   // or an <img> / <canvas>; size from the image
  ],
  stackOrder: ['ui', 'screen'],                     // PHYSICAL order, top first (default: the tour order)
  onPick(id, how) { … },                           // how: 'click' | 'label' | 'key' | 'api'
});
const view = ready.view;                            // usable at once; `await ready` waits for the renderer
```

| Layer field | Meaning |
|---|---|
| `id`, `label`, `sub?` | `label` / `sub`: string, `{en, zh}` or a Node. `sub` is a second line in the label column (a call, a size) |
| `w`, `h` + `draw(ctx, w, h, state)` | a canvas the kit sizes for the screen (1.25–1.6 texels per layer px, ≤ 2048 px; ≤ 1600 px on phones) and redraws on a language change |
| `img` | an image URL (through `PM.asset`), `<img>` or `<canvas>`; `w` / `h` default to its size |
| `tint?` | `accent` `agent` `user` `ok` `info` `warn` `err` `accent-2` (kit tokens) or any CSS colour; default: a tone per layer |
| `opacity?` | start opacity of the sheet (0…1), e.g. `0.6` for a translucent overlay |
| `x?`, `y?` | top-left inside the frame (the largest layer); default: centred |

Options: `stackOrder`, `face` (the layer shown at `explode = 0`; default `layers[0]`), `gap` (sheet spacing at
`explode = 1`, in layer px; default: fitted to the view), `tilt: {x: -0.35, y: 0.55}` (home camera in radians: `x` pitch,
negative looks down; `y` yaw), `orbit: true`, `labels: true` (label column + leader lines), `hint: true`,
`explode: 0`, `background: 'transparent'` (or a CSS colour), `glow: 1`, `focusCamera: true` (focus flies the camera),
`pickFocus: true` (a pick explodes a flat stack and focuses the layer), `aspect: 16 / 9` (10 / 11 below
`compactBelow: 640`), `height` (fixed height instead), `labelWidth` (≤ 244 px), `textureScale`, `ariaLabel`,
`redrawOnLang: true`, `renderer: 'auto' | 'css'`; callbacks `onPick(id, how)`, `onHover(id | null)`,
`onFocus(id | null)`, `onUserCam()`.

### View API

```js
view.explode(k, {snap?, slow?})   // 0 = the flat face, 1 = apart; damped (≈110 ms) unless snap; slow = a 2.6× calmer move
view.focus(id | null, {snap?})    // the layer lights and rises, the layers above lift away and hide, the one below stays
                                  // as context (fully, when the focused layer is translucent), the camera flies to it
view.light(id | null, {snap?})    // highlight one layer in the overview: glow, label, travelling leader; others step back
view.setOpacity(id, a, {snap?})   // a translucent layer shows the layer under it (R7.3)
view.redraw(id?)                  // call draw() again and upload it (after your data changes)
view.reset({snap?})               // the overview camera: no focus, no reader zoom (explode and opacity stay)
view.pick(id)  view.hover(id)     // what a click / a label hover does (pick also calls onPick)
view.orbit(dTheta, dPhi)  view.zoom(f)            // as the arrow and + / − keys (f < 1 zooms in)
view.anchors() → [{id, x, y, behind}]             // the middle of each sheet's right edge, view px (own leader lines)
view.pickAt(x, y) → id | null                     // the layer a click at this view point would pick (own tooltips)
view.setVisible(v)  view.relayout()  view.dispose()
view.state() → {kind: 'loading' | 'webgl' | 'css', explode, focus, lit, hover, opacity, compact, fallbackReason,
                resetVisible, hintVisible, renderer}
view.el  view.view                                // the root .pm-l3d and the scene box .pm-l3d-view
```

### What the reader gets

- **Orbit**: drag to turn (a full turn round the stack; pitch clamped between 0.22 rad and straight down). A drag
  starts after 5 px, so a small wiggle is still a click. On touch, a sideways swipe orbits and a vertical swipe scrolls
  the page (direction lock); two fingers pinch to zoom. Ctrl/⌘ + scroll zooms; a plain scroll keeps scrolling the
  page. After a drag the distance is re-fitted, so the whole stack stays in view.
- **Keys** on the focused view: ← → ↑ ↓ orbit, + / − zoom, 0 resets, 1…9 pick a layer, Esc leaves a focus.
- **Picking**: hovering a sheet lights its glow and its label (pointer cursor); a click picks the visible sheet under
  the pointer. Clicking empty space leaves a focus. Hovering a label peels the sheets above that layer.
- **Label column** on the right, in physical order so no leader lines cross; it never moves while the camera flies.
  Below 640 px it becomes number badges plus a one-line legend under the view.
- **Reset view** button in the scene corner, shown only once the camera has left the overview. A one-line hint
  ("Drag to orbit · Ctrl/⌘ + scroll to zoom") shows until the reader first moves the camera.
- The reader taking the camera opens a flat stack, leaves a focus (keeping the angles) and calls `onUserCam()`, where a
  part pauses its running player.
- Renders only while something moves and only while on screen. Reduced motion: every change lands at once.

### Tour order, physical order, face (R7.3, R3)

The `layers` array is the tour: badge numbers, number keys and your guided pass follow it. `stackOrder` is how the
sheets physically lie, top first. In OpenGCUA the accessibility layer sat above the screenshot, translucent, so the
screenshot showed through it, while the tour still started at the screenshot:

```js
layers: [screen, axTree, …], stackOrder: ['ax', 'screen', …]   // ax: opacity 0.6, a dark glass background
```

At `explode = 0` the view shows the **face** (`layers[0]` unless you pass `face`): the familiar view first. Layers
physically above the face fade in as the stack opens. Give an overlay layer a dark translucent background
(`rgba(…, .85)`) rather than a clear one: then `setOpacity` visibly decides how much of the layer below shows through.

### In a player

The view's own motion is damped on the wall clock; a player must stay a pure function of time. Drive the explode with a
tween and snap it, and snap discrete changes while seeking:

```js
reset() { view.light(null, {snap: true}); view.reset({snap: true}); view.explode(0, {snap: true}); },
async run(ctx) {
  await ctx.tween(1800, (k) => view.explode(k, {snap: true}), PM.ease.inOut);
  for (const id of ['screen', 'ui', 'code']) {
    view.light(id, {snap: ctx.seeking});
    ctx.mark(label(id), tone(id));
    await ctx.sleep(1500);
  }
  view.light(null, {snap: ctx.seeking});
},
// and in PM.layers3d: onUserCam() { if (player.state === 'running') player.pause(); }
```

`focus(id)` also works inside a story, but its camera flight is damped: use it at the end of a story or in response to
the reader, and prefer `light()` for a scrubbable pass.

### Loading and fallbacks

three.js comes from `window.PM_THREE_SRC` (the module source, inlined by `bundle.py --offline` and imported from a blob
URL), else `window.PM_THREE_URL`, else `vendor/three-0.160.0.module.min.js` next to `playme-3d.js` (when the page is
served; a module cannot be imported from `file://`), else jsDelivr. Every failed source is a console warning, not an
error. While it loads the scene shows the flat composite (the face and the layers under it), so nothing jumps.
`PM.loadThree()` → `Promise<THREE>` is public (cached), for a scene of your own.

The CSS fallback (a `preserve-3d` stack with the same API, explode and focus animated, no orbit, a one-line note) takes
over when: `?pm3d=off`, `<html data-pm-3d="off">`, `window.PM_3D = false` or `renderer: 'css'`; WebGL is missing; three.js
fails or takes more than 15 s; the WebGL context is lost. Test it with `?pm3d=off`.

### Gotchas

- Text on a sheet must survive the overview: at a 1200-px-wide layer use 15 px and up for anything a reader should
  read, 26 px for headings. Focus shows a sheet nearly full size.
- Canvas text uses the page's fonts; the kit paints again when `document.fonts` is ready. Inline the fonts (R15).
- `tint` colours are resolved once, when the view starts; change tokens before calling `PM.layers3d`.
- The view clips its content. Put inspectors or cards outside the scene (under it), not over the canvas.
- QA hooks: `view.centerOf(id)`, `view.screenBox(id?)`, `view.labelLayout()`, `view.renderer()`; the root element
  carries `el.pmLayers3d` (the view) and `data-renderer="webgl" | "css"`.
