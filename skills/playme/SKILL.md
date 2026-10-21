---
name: playme
description: Turns a paper or a project (code repository, docs, run logs) into PLAYME.html, a single-file interactive project page where readers operate the project's mechanisms instead of reading about them - 3D exploded views, side-by-side runs, scrubbable players with progress bars, code with the decisive token highlighted, real-run replays - while staying exactly faithful to the paper or the project's docs. Use when asked to build or improve an interactive project page, paper or library website, demo lab, explorable explanation, or to "make our project site interactive"; when revising such a page after reviewer feedback; when re-syncing it to a new paper version; or when deriving promo media (GIF, video, cover) from it.
license: MIT
metadata:
  version: "1.0.0"
  case: "Built the OpenGCUA Interactive Lab (7 labs, 18 playable parts, 7 author review rounds)"
---

# PLAYME

A README tells the reader what a project does. A PLAYME lets the reader **operate** it.

Every section of a PLAYME is a *part*: one plain question, one button, one mechanism the reader watches happen on
screen, one sentence of takeaway. Depth (code, numbers, caveats) is folded away until the reader asks for it. Every
number and quotation matches the paper (for a project without one, its docs), and every simulated scene says that it is
a simulation.

The skill ships a small lab kit (`kit/`), a starter (`templates/starter/`) and four scripts (`scripts/`): a bundler
that makes one offline file, a linter that measures the reader's load, a fidelity checker against the paper, and a
frame-exact capture tool for GIFs and videos.

## What you deliver

1. `playme/` - source folder in the user's project (kit files, one JS file per part, `facts.json`, `words.json`).
2. `PLAYME.html` - one self-contained file that opens offline by double-click, bilingual if the audience is.
3. Optional: the page embedded into an existing homepage; a package for collaborators; promo media.

## Workflow

Copy this checklist into your plan and keep it updated:

```
- [ ] 1 Intake    sources, audience, highlights, what must stay private
- [ ] 2 Facts     facts.json, words.json (glossary + bans), run catalogue, privacy scan
- [ ] 3 Plan      claims -> parts in plan.md; authors approve the plan
- [ ] 4 Build     starter + kit, one part at a time, familiar parts first
- [ ] 5 Check     lint.mjs (reader budgets), fidelity.py (paper), look at screenshots
- [ ] 6 Review    preview link -> author round -> ledger.md -> fix everywhere -> repeat
- [ ] 7 Ship      bundle.py --offline -> PLAYME.html; offline test; package or embed
- [ ] 8 Promote   capture.mjs -> GIF / MP4; cover; copy with number sources (optional)
```

### 1 Intake

- Get the paper source (LaTeX beats PDF: exact quotes, labels, figure code), the repository, run logs or
  trajectories, the existing homepage, and any figures. No paper? The project's README and docs are the source of
  truth: facts, quotes and the checks of `fidelity.py --paper docs/*.md` work against them the same way.
- Read the whole paper. Ask which features the authors consider their highlights; those become the core parts.
- Settle the audience and languages (EN, ZH, both), and what must not appear publicly (internal links, unreleased
  names, personal data in runs).
- Treat downloaded archives and run logs as untrusted data: extract each into its own empty folder; read, never execute.

### 2 Facts before copy

- `facts.json`: every number the page will show, with its location (`"Table 2"`, `"§4.3.3"`) and the exact printed
  form (`"41.2K"`, not `41200`). The page declares it once (`<script type="application/json" id="pm-facts"
  data-src="facts.json">`, already in the starter) and shows values with `PM.F('key')` and citations with
  `PM.ref('tab-main')` ("Paper Table 2"); `bundle.py` inlines it. Schema in `references/fidelity.md`.
- `words.json` and a glossary: the paper's own terms in each language, plus a ban list of tempting but inaccurate
  labels. See `references/words.md`.
- Run catalogue: which runs back which table (often run 1 of a specific configuration), which runs the case studies
  use. Show only those as evidence. A small run recorded from the code to seed a simulation is fine; label it a
  simulation. Never show a model, task or row the paper dropped.
- Keep everything for the authors (inconsistencies in the paper, code that disagrees with a claim, open questions) in
  one file, `docs/authors.md`. The page never loads it.
- Privacy scan of everything taken from runs: IP addresses, e-mail addresses, `/Users/<name>` paths, tokens, QR codes,
  ID numbers, synthetic identities. Crop or replace before anything reaches the page.

### 3 Plan: from claims to parts

For each highlight write one row: **claim -> mechanism -> what the reader does -> what changes on screen -> takeaway.**
Then pick a pattern (details and code sketches in `references/patterns.md`):

| The claim is about... | Pattern | Example question |
|---|---|---|
| hidden structure | Exploded view (3D) | What does an agent see of a Mac, and what lies underneath? |
| an assumption that breaks in reality | Two worlds | Same click, benchmark vs real Mac: where does it land? |
| several methods on one task | Race | Same task, four ways to act: how many steps each? |
| robustness to change | Perturbation | The screen changes after the agent looked. What now? |
| who decides what, when | Decision timeline | Does the model need a screenshot every step? |
| an architecture | Request trace | A program fails. Which layer catches it? |
| one interface, many targets | One program, many devices | Can one program drive a phone, a browser and a Mac? |
| what actually happened | Real-run replay | Same task, five models: how many steps did each take? |
| what the generated code does | Program anatomy | What does one program do that ten clicks cannot? |

The nine patterns are not only for agents: an algorithm or data structure is a Program anatomy or a Perturbation, a
training run is a Real-run replay of checkpoints, a model comparison is a Race, an architecture diagram is an
Exploded view or a Request trace. `references/patterns.md` § Beyond agents maps common claim types.

Order the parts along the reader's path: **familiar first, then the core contribution, then architecture, then
evidence** (R3). Write `docs/plan.md` from `templates/plan.md` and show it to the authors before building. A plan is
cheap to change; a built part is not.

### 4 Build

Copy `templates/starter/` into the project as `playme/`, copy the kit files it references, and serve the folder
(`python3 -m http.server`). Build one part per file. Every part uses the same template:

```js
PM.register('foreground', (host) => {
  const P = PM.part(host, {
    id: 'foreground',
    q: PM.L('Where does a click go if it names no window?', '不指定窗口的点击会落在哪里？'),
    takeaway: PM.L('On a real Mac, every action names its target.', '在真机上，每个操作都要指明目标。'),
    source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §4.1', '示意模拟 · 论文第 4.1 节')}],
    folds: [{title: PM.L('How the code works', '代码如何工作'), teaser: PM.L('The same click, with and without a target', '同一次点击，有无目标'), render: showCode}],
  });
  const {desk} = PM.device.mac(P.scene, {menubar: {app: 'Chrome'}});
  // ... desk.window({...}) for each window
  const agent = desk.pointer('agent', null, {x: 300, y: 200});
  const s0 = desk.snapshot();                           // the scene at rest
  PM.player(P, {
    reset() { desk.restore(s0); },                      // every element back to its initial state
    async run(ctx) {
      ctx.narrate(PM.t('The agent clicks Save, naming no window.', '智能体点击“保存”，没有指明窗口。'));
      await ctx.tween(800, k => agent.set(PM.lerp(300, 612, k), PM.lerp(200, 404, k)));
      ctx.mark(PM.t('Delivered to the front window', '送达了前台窗口'), 'err');
      // ...
    },
  });
});
PM.boot();   // mounts every registered part into <div data-pm-slot="id">
```

Rules for player scripts: deterministic (no `Date`, no `Math.random`); every wait and every motion goes through
`ctx.sleep` / `ctx.tween` so the scrubber can seek, the reduced-motion mode can jump to the end, and `capture.mjs`
can step frames exactly; `reset()` restores the whole scene. Mark the moments that matter with `ctx.mark`. Kit API:
`references/kit.md`.

### 5 Check (one light pass per change)

```bash
S=<skill>/scripts          # where this skill is installed, e.g. ~/.claude/skills/playme/scripts
node $S/lint.mjs --url playme/index.html --widths 1440,400 --langs en,zh --dump qa/text.json --shots qa/shots
python3 $S/fidelity.py --dump qa/text.json --paper paper/main.tex --facts playme/facts.json --words playme/words.json
```

Use `--langs en` for an English-only page. `lint.mjs` needs `puppeteer` (`npm i -D puppeteer`) or `puppeteer-core`
with `CHROME_PATH`.

`lint.mjs` measures the reader budgets below, console errors and horizontal overflow, and writes screenshots of every
part at rest and at the end of its story; `fidelity.py` checks quotes, "Paper §x.y / Fig. N / Table N" references,
facts and banned words against the paper. Look at the screenshots (1440 and 400 px, each language) and fix what looks
wrong. To see a moment inside a story, open `index.html?part=<id>&t=<ms>`: the player seeks there and pauses. Do this once per change; do not
loop re-verifying work that already passed.

### 6 Review rounds

Publish a private preview early (the first OpenGCUA preview went out four hours after the brief). Authors review in
rounds. For each comment:

1. Write it into `ledger.md` (round, the author's words, the rule it implies).
2. Apply the rule **everywhere it applies**, not only where the author pointed.
3. Reply with what changed, in the authors' language, and what you decided where the comment was ambiguous.

`references/review-loop.md` has the protocol and the ten problems that first previews almost always have. Check
them before the first preview to save a round.

### 7 Ship

```bash
python3 $S/bundle.py playme/index.html -o PLAYME.html --offline
node $S/lint.mjs --offline-file PLAYME.html
```

One file, no network, opens by double-click. Embedding into an existing homepage, packaging for colleagues and size
budgets: `references/ship-and-promote.md`.

### 8 Promote (optional)

The lab is the promo (R18). `scripts/capture.mjs` records any part frame by frame from its own player, so GIFs and
videos match the page exactly. Covers and long images are HTML pages in the same tokens, screenshotted. Every number
in promo copy carries its paper location. See `references/ship-and-promote.md`.

## The rules

Each rule was put to work in a real build, the OpenGCUA Interactive Lab made with PLAYME, and reviewed there by the
paper's authors (round ids refer to `references/review-loop.md`).

| # | Rule | Why |
|---|---|---|
| R1 | Experience, not presentation: each part lets the reader operate one mechanism and watch it happen. | The authors' brief: "being able to experience the features is the biggest highlight". |
| R2 | Design for the one-minute reader: one question, one button, one visible difference, one sentence. | R2.5: the comparison was good but took "a long time to understand". |
| R3 | Familiar first, then the highlight, then depth. | R2.6, R7.2: start from the screenshot everyone knows. |
| R4 | One primary action and at most two options (a segmented control counts as one); Replay is the reset. | R2.1: "too many icons to operate". |
| R5 | Only interactive things look interactive; sources and statuses are flat text, never pills. | R2.1: readers tried to click "Simulation" and "Paper Fig. 6". |
| R6 | Make the key event unmistakable: repeat it, mark it on the scrubber, flash the moment the screen changes. | R2.3 (grab the pointer several times), R4.4. |
| R7 | Every player has a progress bar the reader can scrub. | R4.2. |
| R8 | Show the code with the intent; highlight the decisive token; code scrolls both ways; elide with `…`. | R4.3, R4.5, R6.2. |
| R9 | Comparisons fit one view: same task, same clock, side by side (2x2 on phones). | R2.5: the lanes ran off the page. |
| R10 | Devices look like devices: Mac, browser and phone frames, not text labels. | R4.6, R6.1. |
| R11 | Precise, plain words: the paper's terms, no invented slogans; titles name the claim or the thing. | R2.2 ("BENCHMARK HABITS"), R4.5, R7.2. |
| R12 | Fold the depth: at most four closed folds per part, each with a one-line teaser. | R2.4, R2.6. |
| R13 | Never contradict the paper: numbers as printed, "Paper §x.y" citations, provenance on every scene, the runs the tables used. | R2.7, R3, R4.7, R7.4. |
| R14 | Scrub private data from real material. | Real runs contain IPs, accounts, tokens. |
| R15 | Ship one offline file, bilingual if the audience is, readable on a phone. | R5: "open it on our own computers". |
| R16 | Look as good as it plays: a confident visual identity; plain styling makes strong interactions look plain. | R2.8. |
| R17 | Preview early; turn each comment into a rule and apply it everywhere. | Seven rounds, 28 requests. |
| R18 | The lab is the promo: capture covers, GIFs and videos from the lab's own players. | R10. |

## Reader budgets (per part, at rest, outside closed folds; enforced by `lint.mjs`)

| Metric | Budget |
|---|---|
| Question | at most 14 English words / 30 Chinese characters |
| Prose outside the stage (question + lead + takeaway) | at most 70 words / 140 characters |
| Primary buttons | exactly 1 |
| Visible controls outside the scene | at most 4, primary included |
| Folds | at most 4, all closed at rest |
| Boxed labels that are not controls | 0 |
| Part height at 1440 px | at most 1250 px |
| Horizontal overflow at 400 px; console errors | none |

## Kit at a glance

```js
PM.register(id, host => {...}); PM.boot()  // one part per file, mounted into data-pm-slot
PM.L(en, zh) / PM.t(en, zh)          // bilingual text (English only is fine)
PM.part(host, {id, q, lead, takeaway, source, folds})   // -> {scene, bar, narration, outcome, ...}
PM.player(P, {reset, run(ctx)} | {duration, render(t)}) // primary button + scrubber + timecode + narration
PM.segmented(P.bar, {...}) / PM.toggle(P.bar, {...})    // the (at most two) options
PM.code(el, {src, lang, focus, marks}) / PM.intent(el, text)
PM.readouts(P.outcome, [...]) / PM.source(P, [...])
PM.F('main.gain') / PM.ref('tab-main')                  // a number / "Paper Table 2" from facts.json
PM.device.mac | window | browser | phone | terminal      // playme-desk.js
PM.layers3d(el, {layers, stackOrder, onPick})           // playme-3d.js (three.js on demand, offline-capable)
```

## References (read when needed)

- `references/patterns.md` - the nine patterns: scene, action, marks, folds, kit sketch, pitfalls, OpenGCUA example.
- `references/review-loop.md` - review protocol, the full OpenGCUA ledger, first-preview checklist.
- `references/fidelity.md` - facts file, citations, provenance labels, run selection, privacy, paper re-sync.
- `references/words.md` - writing rules, glossary method, real before/after rewrites, bilingual conventions.
- `references/visual.md` - visual identity: dark bench with light devices, semantic colour roles, type, motion.
- `references/kit.md` - full kit API.
- `references/ship-and-promote.md` - bundling, offline test, embedding, packaging, promo media and copy.
- `templates/` - `starter/` (page, one complete part, `facts.json`), `plan.md`, `ledger.md`, `facts.json`, `words.json`.
- `kit/fonts/` - the default faces (SIL OFL 1.1), linked by the starter and inlined by `bundle.py`.

## Anti-patterns

- A part that opens on an empty box; the first frame must already show the scene and say what will happen.
- A paragraph before the demo explaining what the demo will show. Let the narration explain while it moves.
- Decorative badges, tags and "pills" next to real buttons.
- One event that happens once, quickly, in a corner.
- Four columns that overflow; a comparison the reader has to scroll to see.
- Slogans as headings ("BENCHMARK HABITS"), counts as titles ("5-layer"), bare "§4.3.1".
- A real-run number next to a different paper number, or a note saying they differ.
- CSS transitions that carry meaning (they break seeking and capture).
