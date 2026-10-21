# Nine lab patterns

This catalogue helps you choose the interactive form for one claim. Find the claim type in the decision table, read
that pattern, then adapt its kit sketch. Every pattern uses the same part template (`PM.part` + `PM.player`) and must
pass the reader budgets in `SKILL.md`; this file covers only what differs between patterns.

Each form is shown at work in the OpenGCUA Interactive Lab, built with PLAYME (7 labs, 18 playable parts, 7 author
review rounds). Round ids
such as R2.5 point to the review ledger in `review-loop.md`; "rule R4" points to the rules table in `SKILL.md`.

## Contents

- [Choosing a pattern](#choosing-a-pattern) · [What every pattern shares](#what-every-pattern-shares)
- [1. Exploded view](#1-exploded-view) · [2. Two worlds](#2-two-worlds) · [3. Race](#3-race)
- [4. Perturbation](#4-perturbation) · [5. Decision timeline](#5-decision-timeline)
- [6. Request trace](#6-request-trace) · [7. One program, many devices](#7-one-program-many-devices)
- [8. Real-run replay](#8-real-run-replay) · [9. Program anatomy](#9-program-anatomy)
- [Beyond agents](#beyond-agents) · [Combining patterns](#combining-patterns) · [Signs that the pattern is wrong](#signs-that-the-pattern-is-wrong)

## Choosing a pattern

Write the claim as one sentence in the paper's words first. Then pick the row whose left column matches it.

| The claim says… | Pattern | The reader does, then sees | OpenGCUA part |
|---|---|---|---|
| A familiar surface hides several separate parts, and the system uses the hidden ones | Exploded view | Takes the surface apart; counts what it did not show | `layers/stack3d` |
| The system behaves differently from a standard assumption (benchmark, baseline) on the same step | Two worlds | Runs both sides; sees a wrong effect on one side only | `gaps/sharing`, `gaps/foreground`, `gaps/environment`, `sdk/emit` |
| Method A needs fewer steps, calls or tokens than methods B and C on the same task | Race | Runs all lanes on one clock; reads one count per lane | `program/paradigms` |
| The system copes when the world changes during the task | Perturbation | Watches the change at a marked moment; sees which side recovers | `gaps/changing`, `gaps/requests` |
| The framework provides a mechanism; the model decides when to use it | Decision timeline | Watches decisions accumulate over many steps under two policies | `transfer/observe`, `transfer/todo` |
| Each failure is caught at a specific layer and returned as a specific error | Request trace | Picks a failure, sends one request, sees which layer stops it | `stack/request` |
| One interface reaches several devices or platforms | One program, many devices | Runs one program; sees each call arrive at its own device | `sdk/devices`, `sdk/platforms` |
| The evidence is recorded runs or a case study printed in the paper | Real-run replay | Replays the recorded runs; reads the recorded counts | `traces/explorer`, `traces/target`, `transfer/intent` |
| The system writes programs with structure (loop, branch, verification) | Program anatomy | Runs a program line by line; sees what each line did | `program/patterns`, `traces/coverage` |

Tie-breakers when two rows fit:

- Two approaches with a visible difference: Two worlds. Three or more compared on a number: Race.
- The difference shows in one step: Two worlds. It builds up over many steps: Decision timeline.
- The structure is static: Exploded view. Something flows through the structure: Request trace.
- Measured counts belong to Real-run replay or to a fold "What the paper measured". A simulation never presents its own
  counts as measurements (rule R13).
- The code is the claim: Program anatomy. The code only explains a mechanism: show it under the scene or in the fold
  "How the code works" of another pattern (rule R8).

## What every pattern shares

1. **The scene at rest shows the setup.** Sides are labelled, counters read zero, the primary glows. The first frame
   says what Play will show; an empty box is never acceptable.
2. **One primary action, at most two options** (rule R4). The player creates the primary; options are `PM.segmented`
   or `PM.toggle` in `P.bar`. Case pickers, layer labels and program cards are in-scene targets (`PM.target`) and do
   not count toward the control budget.
3. **The run is a pure function of the virtual clock.** `reset()` restores every visible state (`desk.restore(s0)`,
   `out.reset()`). `run(ctx)` sets state absolutely (`ptr.set(x, y)`, `out.set(id, n)`), so seek, Replay and capture
   show the same frame. No `Date`, `Math.random`, `setTimeout` or CSS transitions that carry meaning.
4. **Mark the key moment** with `ctx.mark(label, tone)` and flash the place where it happens (rule R6, R4.4). Use the
   `k` forms of effects inside a tween (`desk.flash(win, tone, k)`, `ptr.ripple(k)`, `view.explode(k, {snap: true})`):
   one-shot effects are skipped while the player seeks, so they never reach a captured frame (rule R18).
5. **Words:** question ≤ 14 words; captions ≤ 12 words, each on screen for about 2 s or more; side labels in the
   paper's terms (rule R11). Status words are coloured text, never boxes (rule R5).
6. **One source line** says simulation, real run or paper, with the section ("Paper §4.1", R7.4).
7. **Folds** use four standard titles where they fit: "How the code works", "In real runs", "What the paper measured"
   and "How this simulation differs" (rule R12). `templates/plan.md` uses the same four.

The sketches use only the kit API in `kit.md`. Helpers such as `makeSide()` stand for scene code you write. Strings
are English only for brevity; pass the Chinese text as the second argument of `PM.L` and `PM.t`.

## 1. Exploded view

- **Question it answers:** What lies underneath the surface the reader already knows?
- **Use it when** a familiar surface (a screenshot, a page, a model input) is really several parts and the system
  works with the hidden ones. The parts share one frame, so they draw as planes of equal size.
- **Avoid it when** the parts happen one after another (use Request trace), there are fewer than three, or the planes
  would be unrelated diagrams stacked for effect.
- **Scene at rest:** the familiar surface, flat (explode 0), exactly as readers know it, with an in-scene list that
  names every part (letter, name, leader line to its plane).
- **Action:** primary "Take it apart" separates the stack, then lights one part at a time with one caption each.
  Option: a segmented switch between two readings ("Sandbox benchmark | Real device") that dims what the assumption
  ignores. In the scene: click a part for a compact inspector card; drag to orbit at any time.
- **What changes:** the separation, then each part the surface does not show; mark those (`warn`).
- **Outcome readouts:** "Visible in the screenshot", "Partly visible", "Not in the screenshot", letters as sub lines.
- **Typical folds:** How each part is reached · In real runs · What the paper measured · How this simulation differs.

```js
const P = PM.part(host, { id: 'underneath', q: PM.L('What does a screenshot of a real Mac show, and what does it miss?'),
  takeaway: PM.L('Several parts of the desktop do not appear in the screenshot at all.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §4.1')}],
  folds: [{title: PM.L('How each part is reached'), teaser: PM.L('Code for each part.'), render: codeFold}] });
const LAYERS = [                                       // tour order: the familiar screenshot comes first
  {id: 'shot', label: 'Screenshot', img: PM.asset('assets/desktop.webp')},
  {id: 'back', label: 'Background windows', w: 1280, h: 800, draw: drawBack},
  {id: 'ax', label: 'AX trees', hidden: true, w: 1280, h: 800, draw: drawAx},
  {id: 'files', label: 'Shell and files', hidden: true, w: 1280, h: 800, draw: drawFiles}];
// physical order (top → bottom) differs from the tour: AX sits above the screenshot, translucent (R7.3)
const view = PM.layers3d(P.scene, {layers: LAYERS, stackOrder: ['ax', 'shot', 'back', 'files'], onPick: openCard}).view;
view.setOpacity('ax', 0.55);
const out = PM.readouts(P.outcome, [{id: 'hidden', label: PM.L('Not in the screenshot'), tone: 'warn'}]);
PM.player(P, { label: PM.t('Take it apart', '拆开看看'),
  reset() { view.explode(0, {snap: true}); view.light(null); out.reset(); },   // the camera stays as the reader left it
  async run(ctx) {
    ctx.narrate(PM.t('This is a screenshot: the whole desktop in one image.')); await ctx.sleep(1600);
    await ctx.tween(2200, k => view.explode(PM.ease.inOut(k), {snap: true})); let n = 0;
    for (const l of LAYERS) {
      view.light(l.id); ctx.narrate(CAPTION[l.id]);
      if (l.hidden) { out.set('hidden', ++n, 'warn'); ctx.mark(PM.t(`${l.label}: not in the screenshot`), 'warn'); }
      await ctx.sleep(2200);
    }
    view.light(null);
  } });
```

**Pitfalls.**
- Tour order and stacking order are separate decisions: the AX layer sits above the screenshot, translucent, while the
  tour still starts at the screenshot (R7.3, rule R3).
- Readers can drag the whole stack at any time (R8). The tour uses `view.light(id)`, which keeps the camera where the
  reader left it; `view.focus(id)` flies the camera and belongs to a reader's click.
- The authors asked whether the AX view was missing layers (R8). A fixed in-scene list that names every part shows
  that none is missing when the camera hides one.
- No explode slider, tour button or reset button in the bar (R2.1); the kit shows a reset-view icon in the scene corner
  once the camera has moved.
- If the paper already uses "layer" for something else, call the planes "parts" (rule R11).

**In OpenGCUA.** Lab 1 "What a screenshot leaves out" (`layers/stack3d`) separates a real Mac desktop into eight parts,
A to H, from the screenshot down to AX trees and shell and files. Of the seven parts under the screenshot, two are
fully visible in it, two partly and three not at all. It opens the lab because every reader knows a screenshot (R7.2).

## 2. Two worlds

- **Question it answers:** What breaks when the usual assumption meets the real setting?
- **Use it when** the claim contrasts an assumption (a benchmark, a baseline, a naive method) with the system on the
  same concrete step, and the difference has a visible effect: a stolen pointer, a click in the wrong window.
- **Avoid it when** there are three or more approaches (use Race), the difference exists only as a number in a table,
  or the left side is a behaviour the paper does not describe.
- **Scene at rest:** two device frames side by side, same scenario. Each side has the paper's term and one line that
  states its assumption or behaviour ("Benchmark assumption: the agent has the pointer and keyboard to itself").
  Live counters under each side read zero.
- **Action:** primary "Run both" plays both sides on one clock. Options: usually none; at most one scenario toggle.
- **What changes:** the first wrong effect on the left (flash `err`, mark it), then the right side's handling (`ok`).
  Repeat a quick key event: the pointer grab happened four times, each with its own caption ("grab N of 4").
- **Outcome readouts:** paired values, left in `err` and right in `ok` ("Pointer taken without asking: 4 vs 0").
- **Typical folds:** How the code works (both programs) · In real runs · What the paper measured · How this simulation differs.

```js
const P = PM.part(host, { id: 'foreground', q: PM.L('Where does a click go when no window is named?'),
  takeaway: PM.L('Input sent to a screen position lands in the front window; a bound action reaches the named window.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §4.1')}],
  folds: [{title: PM.L('How the code works'), teaser: PM.L('Both programs, side by side.'), render: codeFold}] });
function side(label, claim, src, focus) {
  const col = P.scene.appendChild(PM.h('div', {class: 'side'}, PM.L(label, null, 'p'), PM.L(claim, null, 'p')));
  const mac = PM.device.mac(col, {menubar: {app: 'Chrome'}});
  const sheet = mac.desk.window({id: 'xlsx', title: 'Report.xlsx', app: 'Excel', x: 420, y: 200, w: 720, h: 460});
  const web = mac.desk.window({id: 'web', title: 'Product page', kind: 'browser', url: 'shop.example.test', x: 140, y: 110, w: 780, h: 540});
  return {mac, sheet, web, ptr: mac.desk.pointer('agent'), s0: mac.desk.snapshot(), code: PM.code(col, {src, lang: 'python', focus})};
}
const A = side('Benchmark assumption', 'The target app is in front.', 'click(612, 404)');
const B = side('Real-device harness', 'Binds the action to the named window.', 'click(612, 404, window="Report.xlsx")', ['window="Report.xlsx"']);
const out = PM.readouts(P.outcome, [{id: 'a', label: PM.L('Saved · benchmark assumption')}, {id: 'b', label: PM.L('Saved · real-device harness')}]);
PM.player(P, { label: PM.t('Run both', '同时运行'),
  reset() { [A, B].forEach(s => { s.mac.desk.restore(s.s0); s.ptr.set(300, 640); s.code.clear(); }); out.reset(); },
  async run(ctx) {
    ctx.narrate(PM.t('Both agents press Save in the workbook behind the browser.'));
    await ctx.tween(900, k => A.ptr.set(PM.lerp(300, 612, k), PM.lerp(640, 404, k)), PM.ease.inOut);
    A.code.mark(1, 'err'); out.set('a', 'no', 'err'); ctx.mark(PM.t('Left: the click lands in the browser'), 'err');
    await ctx.tween(1800, k => { A.ptr.ripple(k * 2, 'err'); A.mac.desk.flash(A.web, 'err', k); });
    B.code.mark(1, 'ok'); out.set('b', 'yes', 'ok'); ctx.mark(PM.t('Right: the workbook saves; the browser is untouched'), 'ok');
    await ctx.tween(1800, k => B.mac.desk.flash(B.sheet, 'ok', k));   // a window behind flashes as an x-ray
  } });
```

**Pitfalls.**
- Label each side with the paper's term and one plain sentence; "BENCHMARK HABITS" and a two-sentence summary were
  rejected as inaccurate and hard to understand (R2.2).
- One pointer grab was too fast to follow; the authors asked for several (R2.3). Repeat short events 3 to 4 times.
- Both sides fit one view at 1440 px (rule R9). Show the code under each side and focus the decisive token: a benchmark
  click names no target, a real-device click must name one (R4.3).
- A design the recorded runs never exercised is labelled a simulation, and "In real runs" says what the runs did
  (rule R13). In OpenGCUA every recorded run used foreground demo mode, so background delivery is a simulation.
- Readers ask how the right side works; one author asked whether background execution uses a virtual display (R4.1).
  Answer such questions in a fold.

**In OpenGCUA.** Lab "Five differences between a benchmark and a real Mac" (`gaps/*`) has five parts, each with two
simplified Mac desktops and one "Run both". In `sharing` a person keeps typing in Notes while the left agent takes the
pointer four times and the right agent fills fields in the background, asking before it borrows the pointer once.

## 3. Race

- **Question it answers:** Same task, several ways: how much does each way need?
- **Use it when** the claim compares three or more methods on one count (steps, model calls, tokens, errors) for the
  same task, and the count can grow visibly on a shared clock.
- **Avoid it when** two methods differ in a visible effect (use Two worlds), or the numbers are measured in recorded
  runs (use Real-run replay; a simulated race shows illustrative counts only).
- **Scene at rest:** N lanes side by side in one view (2×2 on a phone), each with its paper name, one line on what one
  step contains, a compact screen, a counter at 0 and an empty strip of step boxes. The lead defines the unit.
- **Action:** primary "Run all four". Option: one toggle that adds a perturbation ("A dialog appears midway"), which
  separates methods that react between actions from methods that cannot.
- **What changes:** each lane's finish (one mark per lane); with the toggle on, the first wrong effect in each lane.
- **Outcome readouts:** per lane: steps, actions per step, wrong effects, with a sub line that says what is counted.
- **Typical folds:** What each step contains · The prompts · What the paper measured · Simulation and real runs.

```js
const LANES = [   // [steps without the dialog, with it]: counts from your own simulation, labelled as such
  {id: 'gui', name: 'GUI (single action)', steps: [14, 16]}, {id: 'batch', name: 'GUI + batch', steps: [8, 10]},
  {id: 'cli', name: 'GUI+CLI hybrid', steps: [5, 7]}, {id: 'code', name: 'Code execution', steps: [2, 2]}];
let dialog = false; const n = l => l.steps[+dialog];
const P = PM.part(host, { id: 'paradigms', q: PM.L('Same task, four ways to act: how many steps does each need?'),
  lead: PM.L('A step is one model response.'),
  takeaway: PM.L('One step can carry many actions; only a program can react between them.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §2.3')}] });
LANES.forEach(l => { l.view = makeLane(P.scene, l); });         // compact screen + counter + strip of step boxes
const out = PM.readouts(P.outcome, LANES.map(l => ({id: l.id, label: PM.L(`Steps · ${l.name}`)})));
const STEP = 650;                                                // one step lasts the same in every lane
const draw = t => LANES.forEach(l => l.view.show(Math.min(n(l), Math.floor(t / STEP)), {dialog}));
const player = PM.player(P, { label: PM.t('Run all four', '四种方式同时运行'),
  reset() { draw(0); out.reset(); },
  async run(ctx) {
    ctx.narrate(PM.t('Same task, same clock. Each box is one model response.'));
    let t = 0;
    for (const l of [...LANES].sort((a, b) => n(a) - n(b))) {
      const t1 = n(l) * STEP;
      if (t1 > t) await ctx.tween(t1 - t, k => draw(PM.lerp(t, t1, k)));    // linear: every lane moves together
      t = t1; out.set(l.id, n(l)); ctx.mark(PM.t(`${l.name}: done in ${n(l)} steps`), l.id === 'code' ? 'ok' : 'info');
    }
  } });
// a changed option changes the story: reset() re-measures it, so the scrubber shows the new marks
PM.toggle(P.bar, {label: PM.t('A dialog appears midway'), onChange(v) { dialog = v; if (player.state === 'idle') player.reset(); else player.replay(); }});
```

**Pitfalls.**
- The first version laid four lanes beyond the page and put too much text before the race; the author needed a long
  time to see what it compared (R2.5). All lanes fit one view, with at most two sentences before them (rules R9, R2).
- One clock for every lane, and one step lasts the same time in every lane. A caption about one moment holds until
  every lane has reached it.
- Use the paper's method names and its unit ("step") in lanes, readouts and folds alike (rule R11). The paper's
  measured numbers go in "What the paper measured", exactly as printed (round R3, rule R13).
- Show what each step contains in the animation or one click away; for code execution the code is the point (R4.5).

**In OpenGCUA.** `program/paradigms` races GUI (single action), GUI + batch, GUI+CLI hybrid (batched) and code
execution on one task: set Status for seven orders from a CSV file two screens long. With "A dialog appears midway" on,
a batch types into the dialog while the program checks for it and dismisses it; the paper's measurements sit in a fold.

## 4. Perturbation

- **Question it answers:** What happens when the world changes during the run?
- **Use it when** the claim is robustness to a change between observing and acting, or during the task: the screen
  moves, a dialog appears, the person corrects the request, a session has expired.
- **Avoid it when** nothing in the system reacts visibly to the change, or the change would have to be random. The
  player is deterministic, so the change is scheduled at a fixed time.
- **Scene at rest:** the world before the change, with the agent's earlier observation visible (a crosshair on the
  target it picked). Usually staged as Two worlds, with the same change on both sides at the same moment.
- **Action:** primary "Run both". Option: none, or one segmented switch between up to three kinds of change.
- **What changes:** three marked moments: the change (`warn`, flash both screens), the consequence on the naive side
  (`err`), the recovery on the other side (`ok`).
- **Outcome readouts:** "Intended target opened: no / yes" and the honest cost of recovering ("Screenshots: 1 vs 2").
- **Typical folds:** How the code works · In real runs · What the paper measured · How this simulation differs.

```js
const P = PM.part(host, { id: 'changing', q: PM.L('What if the screen changes between looking and clicking?'),
  takeaway: PM.L('A coordinate must come from what the model was shown; a stale one is refused.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §4.3.1')}] });
const ROW = 72, T = {x: 900, y: 300};                  // the target's place in the earlier screenshot (logical px)
const A = makeSide(P.scene, 'Benchmark assumption', 'click(900, 300)');        // a browser window with a result list
const B = makeSide(P.scene, 'Real-device harness', 'win.click(img.point(900, 300))', ['img.point']);
const out = PM.readouts(P.outcome, [{id: 'a', label: PM.L('Intended hotel opened · left')}, {id: 'b', label: PM.L('Intended hotel opened · right')}]);
const shift = k => [A, B].forEach(s => { s.list.style.transform = `translateY(${k * ROW}px)`; s.ad.style.opacity = k; });
PM.player(P, { label: PM.t('Run both', '同时运行'),
  reset() { shift(0); [A, B].forEach(s => { s.desk.restore(s.s0); s.ptr.set(T.x, T.y); s.code.clear(); s.err.hidden = true; }); out.reset(); },
  async run(ctx) {
    ctx.narrate(PM.t('Both agents screenshot the list and pick the second hotel.')); await ctx.sleep(2000);
    ctx.narrate(PM.t('Meanwhile a sponsored hotel loads at the top.'), 'warn');
    await ctx.tween(500, k => shift(PM.ease.out(k)));     // the change: same moment, same change on both sides
    ctx.mark(PM.t('The list moves down one row'), 'warn');
    await ctx.tween(1600, k => [A, B].forEach(s => s.desk.flash(null, 'warn', k)));   // null = the whole screen
    A.ptr.set(T.x, T.y); A.code.mark(1, 'err'); out.set('a', 'no', 'err');
    ctx.mark(PM.t('Left opens the wrong hotel; nothing reports it'), 'err'); await ctx.tween(1800, k => A.ptr.ripple(k * 2, 'err'));
    B.err.hidden = false; B.code.mark(1, 'err');          // "MuError: STALE_TARGET" under the right program
    ctx.narrate(PM.t('Right is refused with a typed error: STALE_TARGET.'), 'info'); await ctx.sleep(1800);
    B.ptr.set(T.x, T.y + ROW); out.set('b', 'yes', 'ok');
    ctx.mark(PM.t('Right observes again and opens the intended hotel'), 'ok'); await ctx.tween(1400, k => B.ptr.ripple(k * 2, 'ok'));
  } });
```

**Pitfalls.**
- Highlight the moment the screen changes (R4.4): flash it and mark it, so a reader can jump straight to it (R4.2).
- Schedule the change at a fixed time and apply it to both sides at once; otherwise seek is inexact and the comparison
  is unfair.
- Compress long real waits (2 min 40 s between looking and clicking), show the elapsed time on a clock, and say in the
  fold that time is compressed. Show the recovery's cost too; hiding it overstates the claim (rule R13).
- An error that never occurred in the recorded runs is labelled as derived from the source code (rule R13). In
  OpenGCUA, `STALE_TARGET` appeared in real runs and `GEOMETRY_CHANGED` did not.

**In OpenGCUA.** In `gaps/changing` both agents screenshot a hotel list; while they do other steps, a sponsored hotel
loads at the top and the list moves down. The left agent clicks the old coordinate and silently opens the wrong hotel;
the right one gets `STALE_TARGET`, observes again and opens the intended hotel. `gaps/requests` covers a mid-task
correction by the person.

## 5. Decision timeline

- **Question it answers:** Who decides what, and when?
- **Use it when** the claim divides responsibility over time: a fixed rule in the framework versus a choice the model
  makes at each step (when to look, what to record, what to tell the user), with an effect that accumulates.
- **Avoid it when** one step shows the whole difference (use Two worlds), or the claim is a static table of who decides
  what; such a table belongs in a fold of a part that has a run (R2.6).
- **Scene at rest:** one row of step slots (10 to 20) per policy, labelled "Harness rule: a screenshot after every
  step" and "Model decides: it calls `screenshot()` when needed"; a shared screen above shows the task.
- **Action:** primary "Run both". Options: usually none; deeper mechanisms (caching, buffers) go into folds.
- **What changes:** each step where the model acts on its own decision (mark in `agent` tone); about eight marks.
- **Outcome readouts:** totals over the run: "Screenshots sent" and "Input tokens (simulated)".
- **Typical folds:** How the mechanism works · What the paper measured · In real runs · The formal definition.

```js
const N = 20, LOOKS = new Set([4, 5, 9, 14, 18]);   // steps whose next action needs the screen (illustrative)
const P = PM.part(host, { id: 'observe', q: PM.L('Who decides when the model gets a new screenshot?'),
  takeaway: PM.L('The model receives only the screenshots it requests, so its context stays shorter.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §3.2.1')}] });
const lanes = [
  {id: 'rule', tone: 'info', title: 'Harness rule: a screenshot after every step', gets: s => true},
  {id: 'model', tone: 'agent', title: 'Model decides: it calls screenshot() when needed', gets: s => LOOKS.has(s)}];
lanes.forEach(l => { l.cells = Array.from({length: N}, () => PM.h('li'));
  P.scene.append(PM.L(l.title, null, 'p', {class: 'lane-title'}), PM.h('ol', {class: 'lane-steps'}, l.cells)); });
const out = PM.readouts(P.outcome, lanes.map(l => ({id: l.id, label: PM.L(`Screenshots sent · ${l.title.split(':')[0]}`)})));
function show(step) {                                // a pure function of the step reached, so seek is exact
  lanes.forEach(l => { let sent = 0;
    l.cells.forEach((c, i) => { const on = i < step && l.gets(i + 1); sent += on;
      c.className = on ? `pm-tone-${l.tone} is-shot` : i < step ? 'is-done' : ''; });
    out.set(l.id, step ? sent : '—'); });
}
PM.player(P, { label: PM.t('Run both', '同时运行'), reset() { show(0); },
  async run(ctx) {
    ctx.narrate(PM.t(`The same ${N} steps play on each side.`));
    for (let s = 1; s <= N; s++) {
      show(s);
      if (LOOKS.has(s)) ctx.mark(PM.t(`Step ${s}: the model asks for a screenshot`), 'agent');
      await ctx.sleep(500);
    }
  } });
```

**Pitfalls.**
- "Mechanism in the harness, decision in the model" was valuable but hard to grasp with everything shown at once. The
  authors asked for the most intuitive part first and the deeper parts in folds (R2.6, rules R3 and R12).
- A part without a run does not teach. OpenGCUA removed its standalone "who decides" grid (the paper's equation as a
  table) and rebuilt the lab as three side-by-side runs, one per decision.
- State what does not change. In OpenGCUA the environment still captures the screen after every step; the mechanism
  changes only what the model receives. Without that sentence the part would contradict the paper (rule R13).

**In OpenGCUA.** Lab "Mechanism in the harness, decision in the model" has one part per decision. `transfer/observe`
plays one illustrative 20-step task twice: under the harness rule the model receives 20 screenshots; when the model
decides, it receives 6. `transfer/todo` (what to record) and `transfer/intent` (what to tell the user) follow.

## 6. Request trace

- **Question it answers:** Where does a failure stop, and what comes back?
- **Use it when** the claim is about an architecture's layers: each layer has one job, catches certain failures and
  returns a specific error, and the caller reacts to that error.
- **Avoid it when** nothing travels between the layers (use Exploded view), there is only one failure type, or the
  error path is in neither the paper nor the source code.
- **Scene at rest:** a vertical stack of layers (caller at the top, the real world at the bottom), each with its job in
  a few words; beside it the cases as in-scene targets, one failure preselected so the first press answers the
  question, and one sentence stating that case's premise.
- **Action:** primary "Send the request"; no options in the bar. After a case has run, its button shows the layer that
  caught it, so trying every case leaves all the answers in one view.
- **What changes:** a dot carries the call down; the catching layer flashes (mark `err` with its name); the error text
  travels back up; the caller's next move appears.
- **Outcome readouts:** "Caught at" (layer name, "layer 3 of 5") · "Error returned" · "Model's next move".
- **Typical folds:** Failure types by layer · Program and receipt · What the paper measured · In real runs.

```js
const LAYERS = ['Model', 'Runtime layer', 'Device SDK', 'Driver', 'Real applications and OS'];
const CASES = {                  // error codes copied from logs or source, never paraphrased
  never: {label: 'Click on a point it never saw', at: 2, err: 'STALE_TARGET', next: 'Capture a screenshot, retry'},
  desktop: {label: 'Input to the whole desktop', at: 3, err: 'INPUT_REFUSED', next: 'Retry with foreground delivery'},
  ok: {label: 'No failure', at: null, err: 'none', next: 'Move on'}};
let cur = 'never';                                      // a failure is preselected: the first press answers q
const P = PM.part(host, { id: 'request', q: PM.L('Which layer catches a failed action, and what does the model read next?'),
  takeaway: PM.L('A detectable failure is reported where it occurs, as an error the model can read.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §4.3.1')}] });
const stack = PM.h('ol', {class: 'trace-stack'}, LAYERS.map(name => PM.h('li', null, name))), dot = PM.h('i', {class: 'trace-dot'});
const picks = Object.entries(CASES).map(([id, c]) => PM.target(PM.h('button', {dataset: {id}}, c.label), {onActivate: () => { cur = id; player.replay(); }}));
P.scene.append(PM.h('div', {class: 'trace-cases'}, picks), stack, dot);
const out = PM.readouts(P.outcome, [{id: 'at', label: PM.L('Caught at')}, {id: 'err', label: PM.L('Error returned')}, {id: 'next', label: PM.L('Model’s next move')}]);
const move = (a, b) => k => { dot.style.transform = `translateY(${PM.lerp(a, b, k) * 64}px)`; };   // 64 px per layer
const player = PM.player(P, { label: PM.t('Send the request', '发送请求'),
  reset() { move(0, 0)(0); [...stack.children].forEach(li => { li.className = ''; }); out.reset();
    picks.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === cur))); },
  async run(ctx) {
    const c = CASES[cur], low = c.at ?? LAYERS.length - 1;
    ctx.narrate(PM.t('The model sends one call down the stack.'), 'agent'); await ctx.tween(450 * low, move(0, low));
    if (c.at != null) { stack.children[c.at].className = 'pm-tone-err is-caught'; out.set('at', LAYERS[c.at], 'err');
      ctx.mark(PM.t(`Caught at the ${LAYERS[c.at]}`), 'err'); }
    ctx.narrate(PM.t(c.at != null ? `${c.err} goes back up to the model.` : 'The receipt goes back up.')); await ctx.tween(450 * low, move(low, 0));
    out.set('err', c.err, c.at != null ? 'err' : 'ok'); out.set('next', c.next);
  } });
```

**Pitfalls.**
- A four-option switch in the bar breaks the control budget (R2.1, rule R4); put the cases in the scene as targets.
- Title the part with the architecture's name: the authors renamed "5-layer" to "Real-device harness architecture"
  (R7.2, rule R11).
- Copy error and receipt texts verbatim from the logs or the source, including a receipt that says a click may have
  done nothing. A failure never seen in the recorded runs is listed as "derived from the source" (rule R13).
- The "No failure" baseline gives contrast but does not answer the question. The kit lights the takeaway after the
  first finished run, so the baseline is never the preselected case.

**In OpenGCUA.** `stack/request` ("Follow one request") sends a glowing dot down the paper's five layers and the result
back up. Its four cases: a click on a point the program never saw (Device SDK, `STALE_TARGET`), a click with no effect
(the Driver's receipt says so), input to the whole desktop (Driver, `INPUT_REFUSED`) and no failure.

## 7. One program, many devices

- **Question it answers:** Can one program drive several devices in one step?
- **Use it when** the claim is about one interface across devices or platforms: handles that bind each call to a
  device, app, window or tab, or one call that returns the same format everywhere.
- **Avoid it when** the targets have no visual identity (headless services; use Request trace), or you cannot say
  honestly which devices the recorded runs used.
- **Scene at rest:** realistic frames side by side (a phone, a browser, a Mac), each tagged with its handle name, and a
  code ribbon showing the lines that create the handles. Readouts read zero.
- **Action:** primary "Run the program". Option: at most one, such as "Smallest scope | Whole device".
- **What changes:** each call lights its line and a beam runs from the handle token to its device; calls on different
  devices light up together; a file flies from the phone to the Mac; only printed or emitted output lands in a "To the
  model" box. Mark the transfer and the single model call.
- **Outcome readouts:** "Devices used: 3" · "File copied and verified: N bytes" · "Model calls: 1".
- **Typical folds:** The full program · How handles stay bound · How calls are scheduled · How this simulation differs.

```js
const P = PM.part(host, { id: 'devices', q: PM.L('Can one program use a phone, a browser and a Mac together?'),
  takeaway: PM.L('Every call names its device through a handle, so one program drives all three.'),
  source: [{kind: 'sim', text: PM.L('Simulation for illustration · Paper §4.2')}] });
const row = P.scene.appendChild(PM.h('div', {class: 'devices'}));
const dev = {
  phone: PM.device.phone(row.appendChild(PM.h('div')), {time: '9:41', app: 'Files'}),
  dash: PM.device.browser(row.appendChild(PM.h('div')), {url: 'dashboard.example.test/kpi', tabs: ['KPI dashboard']}),
  mac: PM.device.mac(row.appendChild(PM.h('div')), {menubar: {app: 'Numbers'}}) };
const SRC = ['phone = mu.device("phone")', 'dash = mu.device("dash")', 'mac = mu.device("mac")', '…',
  'copied = await mu.files.copy(src, dst)', '…', 'await mu.emit({"rows": rows, "bytes": copied.bytes})'].join('\n');
const code = PM.code(P.scene, {src: SRC, lang: 'python', title: 'one model response (one step)', focus: ['phone', 'dash', 'mac']});
const BEATS = [[1, 'phone', 'The program names the phone by its handle.'], [2, 'dash', 'The dashboard tab has its own handle.'],
  [3, 'mac', 'The Mac is the third handle.'], [5, 'mac', 'The file goes from the phone to the Mac.'], [7, null, 'Only the emitted summary goes to the model.']];
const out = PM.readouts(P.outcome, [{id: 'devices', label: PM.L('Devices used')}, {id: 'calls', label: PM.L('Model calls'), tone: 'agent'}]);
PM.player(P, { label: PM.t('Run the program', '运行程序'),
  reset() { code.clear(); Object.values(dev).forEach(d => d.el.classList.remove('is-active')); out.reset(); },
  async run(ctx) { const used = new Set();
    for (const [line, id, say] of BEATS) {
      code.mark(line, 'run'); ctx.narrate(PM.t(say));
      if (id) { dev[id].el.classList.add('is-active'); used.add(id); out.set('devices', used.size); }
      if (line === 5) ctx.mark(PM.t('File copied to the Mac and read back'), 'ok');
      await ctx.sleep(1600);
    }
    out.set('calls', 1, 'agent'); ctx.mark(PM.t('One model call for three devices'), 'agent');
  } });
```

**Pitfalls.**
- Devices must look like devices: a phone with a status bar, a browser with tabs and a URL bar, a Mac with a menu bar.
  Text labels alone did not tell them apart (R4.6, R6.1).
- Put the code into the animation (R4.5). The beam from the handle token to the device makes the binding visible.
- If no recorded run used a device, say so in "How this simulation differs" (rule R13). In OpenGCUA no recorded run used a
  phone, and that fold's teaser says exactly that.
- Keep the simulated screens light, as real screens are, on the dark stage; everything else uses kit tokens.

**In OpenGCUA.** `sdk/devices` plays one 43-line program, one model response, that uses an Android phone app, a
dashboard tab and a Mac, and copies a file from the phone to the Mac with a read-back check. `sdk/platforms` sends one
call, `ui.ax.observe()`, to macOS, Android and a browser tab: one row format everywhere, with native action names.

## 8. Real-run replay

- **Question it answers:** What did the system actually do in the recorded runs?
- **Use it when** the claim rests on recorded material: steps, tokens, programs and screenshots from the runs behind
  the paper's tables, or a case study the paper prints.
- **Avoid it when** the runs are not the ones the tables used, the logs lack the moment you want to show, or you cannot
  remove private data from the material.
- **Scene at rest:** the runs set up but not played: one strip per model with an empty step strip and token bar on a
  shared scale, or two screens that read "waiting for the response". The source line carries the provenance.
- **Action:** primary "Replay the runs" (or "Replay both responses"). Option: one segmented task switch (≤ 3 tasks).
- **What changes:** the strips advance one step at a time together, and each run's end is marked with its count. In a
  case study, mark the moment the evidence arrives (the screenshot that shows the wrong tab in front).
- **Outcome readouts:** recorded values only (per-run steps and output tokens, "Steps: most vs fewest"). Paper tables
  appear in a fold exactly as printed.
- **Typical folds:** Step through a run · What the paper measured · How the runs were recorded (conditions, privacy).

```js
const RUNS = window.RUNS.filter(r => r.task === 'hotels' && r.run === 1);   // written by a script from the logs
const P = PM.part(host, { id: 'explorer', q: PM.L('Same task, same harness: how many steps and tokens did each model use?'),
  takeaway: PM.L('The models differ more in output tokens than in steps.'),
  source: [{kind: 'real', text: PM.L('Real runs · hotel comparison task · run 1 · replay not in real time')}] });
const MAX = Math.max(...RUNS.map(r => r.steps.length)), STEP = 6500 / MAX;   // the longest run takes 6.5 s
const rows = RUNS.map(r => P.scene.appendChild(PM.h('div', {class: 'strip'}, PM.h('b', null, r.model), PM.h('i'), PM.h('span'))));
function show(i) {                                      // i = steps revealed so far on every strip
  RUNS.forEach((r, k) => { const n = Math.min(i, r.steps.length);
    const tok = r.steps.slice(0, n).reduce((s, x) => s + x.out, 0);
    rows[k].style.setProperty('--n', n / MAX); rows[k].lastChild.textContent = `${n} · ${PM.fmt.k(tok)}`; });
}
const ratio = f => (Math.max(...RUNS.map(f)) / Math.min(...RUNS.map(f))).toFixed(1);
const out = PM.readouts(P.outcome, [{id: 'steps', label: PM.L('Steps: most vs fewest')}, {id: 'tok', label: PM.L('Output tokens: most vs fewest')}]);
PM.player(P, { label: PM.t('Replay the runs', '回放运行'),
  reset() { show(0); out.reset(); },
  async run(ctx) {
    ctx.narrate(PM.t('Each box is one recorded step.'));
    let i = 0;
    for (const r of [...RUNS].sort((a, b) => a.steps.length - b.steps.length)) {
      const n = r.steps.length;
      if (n > i) await ctx.tween((n - i) * STEP, k => show(Math.floor(PM.lerp(i, n, k))));
      i = n; ctx.mark(PM.t(`${r.model}: ${n} steps`), 'info');
    }
    out.set('steps', `${ratio(r => r.steps.length)}×`); out.set('tok', `${ratio(r => r.outTotal)}×`);
  } });
```

**Pitfalls.**
- Use the runs the paper's tables used, and the case-study runs for case-study material (R2.7). Drop the models and
  tasks the authors drop (R2.7, R4.7).
- Print numbers exactly as the paper prints them, with no labels the paper does not use. A paper value that differs
  from the runs is a question for the authors, never a note on the page (round R3, rule R13).
- Never place a mean computed from the runs next to the paper's table, and never sum step values into totals the paper
  does not print. Say how the replay maps to time ("not in real time", "7× the recorded model time").
- Crop or blur IP addresses, e-mail addresses, QR codes, account paths and reviewer names; re-check every enlarged crop
  (rule R14).
- A paper revision can renumber figures and rewrite quoted passages. Keep every number and quote in one data file and
  re-run the fidelity check after each revision (see "After the lab" in `review-loop.md`).

**In OpenGCUA.** `traces/explorer` replays run 1 of five models on one task (workbook or hotel comparison) as step
strips with output-token bars. `traces/target` replays a paper case study: two models each need a screenshot of their
shopping page, and one gets the desktop with a login tab in front. `transfer/intent` replays six real steps twice, with
and without the one-line intent.

## 9. Program anatomy

- **Question it answers:** What does one program do in one step?
- **Use it when** the claim is about code the system writes or runs: its structure (loop, branch, verification,
  composition), its stated intent, or one decisive argument.
- **Avoid it when** the code is boilerplate, no visible effect corresponds to its lines, or the excerpt would exceed
  about 40 lines without elision.
- **Scene at rest:** the intent in plain words above the code; the code pane with line numbers (verbatim, elided lines
  as a muted `…`); a small simulated screen beside it; a key for line states. Several programs appear as cards.
- **Action:** primary "Run the program". Options: none; the program cards are in-scene targets.
- **What changes:** lines light one at a time and keep their final state (ran, check passed, skipped); the screen
  reacts to each action. Mark a check that passes, a branch taken, the last iteration of a loop.
- **Outcome readouts:** "Operations in this one step" · "Checks in the program" · optionally "Model calls: 1".
- **Typical folds:** When a check fails · In real runs · What the paper measured · How this simulation differs.

```js
const PROGRAMS = {   // put your verbatim excerpt here; these lines are a stand-in. '…' lines never run
  loop: { intent: 'Fill the Status column for seven orders, then save', focus: ['for', 'assert'], start: 1,
    src: ['shipped = {r[0] for r in csv.reader(open("shipments.csv"))}', 'for i, order in enumerate(ORDERS):',
      '    sheet.cell(f"D{i + 2}").set_text("Shipped" if order in shipped else "On hold")', '…',
      'assert sheet.cell("D8").text != "", "row 8 is empty"', 'sheet.save()'].join('\n'),
    trace: [[1, 'run', 'op'], [2, 'run'], [3, 'run', 'op'], [2, 'run'], [3, 'run', 'op'], [5, 'ok', 'check'], [6, 'run', 'op']] } };
let prog = PROGRAMS.loop;                    // program cards in the scene set prog, then call player.replay()
const P = PM.part(host, { id: 'anatomy', q: PM.L('What do code-execution programs actually do in one step?'),
  takeaway: PM.L('The program acts and checks; the model chooses the procedure and judges the result.'),
  source: [{kind: 'paper', text: PM.L('Program quoted verbatim · Paper §3.1.2')}] });
PM.intent(P.scene, prog.intent);
const code = PM.code(P.scene, {src: prog.src, lang: 'python', start: prog.start, focus: prog.focus});   // start: the original line numbers
const out = PM.readouts(P.outcome, [{id: 'ops', label: PM.L('Operations in this one step')}, {id: 'checks', label: PM.L('Checks in the program'), tone: 'ok'}]);
const player = PM.player(P, { label: PM.t('Run the program', '运行程序'),
  reset() { code.clear(); out.reset(); },
  async run(ctx) {
    ctx.narrate(PM.t('One model call wrote this program; it now runs alone.')); let ops = 0, checks = 0;
    for (const [line, tone, kind] of prog.trace) {
      code.mark(line, tone);
      if (kind === 'op') out.set('ops', ++ops);
      if (kind === 'check') { out.set('checks', ++checks, 'ok'); ctx.mark(PM.t(`Line ${line}: check passed`), 'ok'); }
      await ctx.sleep(600);
    }
    ctx.narrate(PM.t('The output goes back to the model.'), 'agent');
  } });
```

**Pitfalls.**
- Write the intent in plain words above the code, and focus the decisive token in the code itself (R4.3, rule R8).
  Code panes scroll both ways; long lines do not wrap (R6.2).
- Quote programs verbatim. Elided lines appear only as a muted `…`, never as runnable code. An excerpt that starts
  mid-program keeps its original line numbers (`start`). Count only the lines shown, and say so.
- For code execution the code is the content, so it belongs inside the animation (R4.5).
- Add no runtime detail the paper does not state (rule R13). OpenGCUA made no claim about a fresh Python process per
  program, because the paper says the interpreter persists across turns.

**In OpenGCUA.** `program/patterns` shows five cards in the paper's order, from cross-interface composition to
executable verification. "Run the program" lights a verbatim excerpt from the paper's figures line by line while a
small screen reacts; afterwards the button reads "Next pattern", so five presses tour all five. `traces/coverage`
applies the form to two real programs that fill 125 and 85 of the 125 answer cells.

## Beyond agents

The nine forms were first put to work on a computer-use agent, but they are about kinds of claims, not about agents. The PLAYME
homepage's own pattern gallery uses mostly non-agent examples. Common research claims map like this:

| The paper claims… | Pattern | The reader does, then sees |
|---|---|---|
| An algorithm or data structure behaves in a certain way (an eviction policy, a scheduler, a search) | Program anatomy, or Perturbation when the input changes | Steps through the algorithm on a small input; watches the state the paper describes (bits, queue, frontier) change at marked moments |
| A model resists (or breaks under) a small input change | Perturbation | Applies the change; watches one model flip and the other hold |
| Method A beats B and C on a metric | Race | Runs the methods on one clock or one budget; reads one count per lane |
| Training produces an ability at some point | Real-run replay of checkpoints | Scrubs through checkpoints; sees the loss, an example output and the eval score move together |
| A layer, router or early exit decides per token or per request | Decision timeline | Watches decisions pile up under a fixed rule and under the learned one; compares the totals |
| An architecture has parts with distinct jobs | Exploded view (static structure) or Request trace (something flows through it) | Takes the block apart; or sends one input through and sees which part acts |
| One system serves several targets (devices, back ends, languages) | One program, many devices | Runs one program; sees each call land on its target |

**Parts that only show printed numbers.** When the evidence is a table and there are no runs to replay, make a Race
whose lanes grow to the printed values (marked with `PM.F`, labelled "Paper Table N" in the source line), or keep the
numbers in the fold "What the paper measured" of the part that demonstrates the mechanism. Never animate printed
numbers as if they were being measured live: the narration says "The paper reports…", not "Now measuring…".

**Scenes without devices.** Rings, queues, grids, lanes and plots are drawn with plain DOM or SVG inside `P.scene`
(set state absolutely from the story, as in the starter's packet-retry scene). Use `PM.device.*` only when the
mechanism happens on a screen.

## Combining patterns

One pattern leads each part; a second may appear as the scenario, an option or a fold, never as a second primary.

| Lead pattern | Second pattern, and where | OpenGCUA part |
|---|---|---|
| Two worlds | Perturbation, in the scenario itself | `gaps/changing`, `gaps/requests` |
| Race | Perturbation, as the one toggle | `program/paradigms` ("A dialog appears midway") |
| Real-run replay | Two worlds: two recorded runs side by side | `traces/target`, `transfer/intent` |
| Real-run replay | Program anatomy: the code drives the replay | `traces/coverage` |
| Decision timeline | Two worlds: the rule and the model as the two sides | `transfer/observe`, `transfer/todo` |

## Signs that the pattern is wrong

| A first-time reader… | Likely cause | Fix |
|---|---|---|
| reads the whole lead before pressing anything | the scene at rest does not show the setup | label the sides and state the task in the scene |
| asks "what changed?" after the run | the key event happens once, too fast | repeat it, mark it, flash it |
| asks which side is the system | side labels are slogans or colours only | the paper's term plus one plain sentence per side |
| still cannot state the claim after the run | the pattern shows structure where the claim is about flow, or the reverse | re-read the decision table with the claim sentence |
