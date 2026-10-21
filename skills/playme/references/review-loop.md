# Review loop

How to run author review rounds, and the complete ledger of a real build: the OpenGCUA Interactive Lab, made with
PLAYME.

## Contents

1. Why rounds
2. The protocol
3. First-preview checklist (check before the first preview)
4. The OpenGCUA ledger: 7 rounds, 28 requests
5. How the lab changed between previews

## 1 Why rounds

Authors know which features matter and which words are correct; a builder knows how to make a mechanism visible.
Neither side can judge the result from a plan alone. A preview link turns opinions into concrete comments ("I thought
'Paper Fig. 6' was clickable"). Each round tends to expose one class of problem: first comprehension and control
load, then technical depth and fidelity, then naming, order and polish.

Every comment is evidence about how a reader will experience the page. Treat it as a rule, not as a one-off fix.

## 2 The protocol

**Before the first preview**

- Build the parts the authors called highlights first, and the most familiar part first (R3).
- Run `lint.mjs` and `fidelity.py`; go through the checklist in section 3.
- Publish a private preview (an artifact link, a staging URL, or the single file). Name the version
  ("v3: progress bars on every player").

**What to send with a preview**

- One paragraph: what is new, what to look at first, what is still missing.
- For each item of the previous round: done, partly done (why), or not done (why).
- Decisions you made on ambiguous comments, so the authors can overrule them.
- Questions only where the answer changes the work.

**Reading feedback**

- Screenshots point at the exact element. Find it in the code before deciding what the comment means.
- Read for the reason behind the request. "Grab the mouse several times" means "the reader missed the event"; the
  rule is R6, and it also applies to every other key event on the page.
- Comments written by voice input contain recognition errors. In OpenGCUA, 「请也在电话里说插入对应操作的代码」 meant
  「在动画里」 ("in the animation"); the context (a request about code in the animation) made it clear.
- Comments may conflict with earlier ones ("show the run numbers" vs "nothing may contradict the paper"). The later,
  more specific decision wins; record both in the ledger.

**Applying a round**

1. Add each request to `ledger.md` (template in `templates/ledger.md`): round, the author's words, the rule, where it
   applies, status.
2. Apply the rule everywhere it applies. A request about one part is almost always about the whole page.
3. Re-run the checks once. The OpenGCUA authors asked explicitly for no "unnecessary or wasteful repeated
   verification": one light check per change, then publish.
4. Publish the next preview to the same link, with a version label.

**Replying**

Answer in the authors' language. Lead with what changed, item by item, in the authors' own numbering. Put decisions
and open questions after that. Keep it short; the preview shows the rest.

## 3 First-preview checklist

These ten problems appeared in the first OpenGCUA preview. Most first previews have several of them.

| # | Check | Rule |
|---|---|---|
| 1 | Each part has exactly one primary button and at most two options (a segmented control counts as one); at most four visible controls in total. | R4 |
| 2 | No label, source line, tag or status looks like a button (no border, fill or pill shape). | R5 |
| 3 | Headings and labels use the paper's terms; no invented catchy labels; every sentence is plain. | R11 |
| 4 | The key event happens several times or is held long enough, is marked on the scrubber, and flashes on screen. | R6 |
| 5 | Knowledge text is in closed folds; at rest each part shows at most 70 words of prose. | R12 |
| 6 | Every side-by-side comparison fits the viewport at 1440 px and becomes 2x2 or stacked at 400 px. | R9 |
| 7 | Nothing important comes before the demo; the question sits directly above the stage. | R2 |
| 8 | Every player has a scrubbable progress bar with marks and a timecode. | R7 |
| 9 | Code is visible with the animation, with the decisive token highlighted, and scrolls both ways. | R8 |
| 10 | Devices are drawn as devices (Mac window, browser, phone), not boxes with labels. | R10 |

`lint.mjs` checks 1, 2, 5, 6 (overflow), 8 and the budgets automatically. Check 3, 4, 7, 9 and 10 by looking.

## 4 The OpenGCUA ledger

The OpenGCUA Interactive Lab (seven labs, 18 playable parts, English and Chinese, one offline HTML file) was built with
PLAYME in one Claude Code session from 2026-10-14 to 2026-10-16. The authors' comments below are translated from Chinese and
shortened; the rule column names the PLAYME rule that answers each comment.

### R1 · The brief (2026-10-14)

| Request | Rule |
|---|---|
| "Being able to experience the features interactively will be the biggest highlight of a project site." The goal is to experience the project's design interactively and close to reality. | R1 |
| Take a Mac apart in 3D with three.js (main screen, AX tree, background windows as layers) so readers see that a real device has many layers, not just the front screenshot a benchmark uses. | Exploded view |
| Show the gaps between benchmark and real device, e.g. a click that names no window lands in the foreground window; the screen changes because the user is working, so an action that was right for the old observation fails. Express each with code and intent: the code professional, the intent easy to understand. | Two worlds, Perturbation, R8 |
| Let readers explore code execution and harness-to-model decision transfer; compare GUI-only, GUI+CLI and code execution side by side. | Race, Decision timeline |
| Make the cross-device SDK (phone and computer) understandable interactively. | One program, many devices |

### R2 · First preview (2026-10-14)

| # | Request | Rule |
|---|---|---|
| 2.1 | Too many icons to operate and too much text; the main line is unclear. Some visuals made it hard to tell what is interactive: "Simulation" and "Paper Fig. 6" looked clickable. Reduce the number of controls. | R4, R5 |
| 2.2 | Words must be accurate in the sense of academic writing. "BENCHMARK HABITS" / 「评测习惯」 is not accurate. "Habits that pass on a benchmark break on a shared, changing, cluttered machine. Each tab runs both versions." is very hard to understand. | R11 |
| 2.3 | The pointer-grabbing example is very good, but it grabs only once, so it is hard to see what happened. Grab control several times. | R6 |
| 2.4 | There is a lot of knowledge content. Fold part of it by default; the folded text must itself be clear. | R12 |
| 2.5 | The GUI / GUI+batch / GUI+CLI / code execution comparison is a very good topic, but the lanes run past the page so the comparison cannot be seen, and there is so much content before it that it took a long time to understand what it was about. | R9, R2 |
| 2.6 | "Mechanism in the harness, decision in the model" is valuable but hard to grasp. Presenting all information at once makes it hard to understand. Put the most intuitive part first; readers who want more can explore the folded depth step by step. | R3, R12 |
| 2.7 | Real-device trajectories: case-study material keeps the case-study runs; everything else uses the runs the tables used (run 1 of the configuration in the table). One model can be removed from the real-run views. | R13 |
| 2.8 | The interactions are very cool, but the plain palette makes them look plain at first glance. Make the style cooler; use the reference site critically. | R16 |

### R3 · Paper consistency (2026-10-14)

| Request | Rule |
|---|---|
| Nothing on the site may contradict the paper: print the table's value exactly as printed even where a run gives a different value; no run-configuration labels (such as reasoning effort) on any model; showing three real-device tasks instead of four is fine. | R13 |

### R4 · Second preview (2026-10-15)

| # | Request | Rule |
|---|---|---|
| 4.1 | Some agents operate apps in the background. Is that done with a virtual display or another technique, and is it covered? | R1: cover the mechanism readers will ask about |
| 4.2 | Give every player a progress bar so readers see and control progress. | R7 |
| 4.3 | Add more code for technical depth. A benchmark click names no target; a real-device click must. Show concise code under or in the animation and highlight the target. | R8 |
| 4.4 | In "the screen keeps changing", highlight the moment the screen changes. | R6 |
| 4.5 | Retitle "One program instead of many steps" to "Code execution" so the core highlight is in the title; fix the garbled text; put the program into the animation (use an ellipsis if space is short), because what matters here is the code the agent writes. | R11, R8 |
| 4.6 | Put the cross-device UI in phone, browser and Mac frames; today only text tells them apart. | R10 |
| 4.7 | In the real-run views, remove one task statistic and one model that the final paper does not report. | R13 |

### R5 · Packaging (2026-10-15)

| Request | Rule |
|---|---|
| Package all files as a project for colleagues to continue; make the site open on our own computers. | R15 |

### R6 · Third preview (2026-10-15)

| # | Request | Rule |
|---|---|---|
| 6.1 | Make the frames look more like a real computer, browser and phone. | R10 |
| 6.2 | Code panes must scroll horizontally as well as vertically, to show the full program. | R8 |

### R7 · Fourth preview (2026-10-15)

| # | Request | Rule |
|---|---|---|
| 7.1 | The project is called OpenGCUA. | R11 |
| 7.2 | Order: what a screenshot leaves out, code execution, decision transfer, the five differences, architecture, SDK, real runs. Rename "5-layer" to "Real-device harness architecture" as the main title. | R3, R11 |
| 7.3 | Put the AX layer above the screenshot layer, translucent, so the screenshot shows through; keep the tour starting from the screenshot, the view everyone knows. | R3 |
| 7.4 | Write "Paper §4.3.1" instead of "§4.3.1" so readers know where to look. | R13 |

### R8 · Fifth preview (2026-10-15)

| Request | Rule |
|---|---|
| Is the AX 3D view missing layers? Let readers drag to view the whole 3D teardown at any time. | Exploded view: free orbit, every layer visible |

### After the lab

| Request | Rule |
|---|---|
| Logo options that communicate clearly and look technical. | - |
| WeChat promo copy, cover, long image, short video, GIF, plus better ways to promote; the lab is one of the highlights. | R18 |
| The final paper renumbered figures and tables, removed a table row and rewrote about 45 quoted passages; the lab was re-synced and every quote re-checked by script. | R13 |

## 5 How the lab changed between previews

Eight publishes of the same private preview link:

| Publish (UTC) | Label | Main change |
|---|---|---|
| 10-14 08:30 | WIP preview | Seven labs from a 3D exploded Mac to real runs; light theme; many controls per part |
| 10-14 16:25 | v2 preview | Redesign after R2 and R3: part template, one primary action, side-by-side comparisons, folds, dark theme |
| 10-15 02:17 | v2 | First complete v2 build after an audit pass |
| 10-15 03:17 | v2.1 | R4: seekable progress bar on every player, code inside the animations with the target highlighted, device frames |
| 10-15 03:42 | v2.2 | R6: realistic platform frames, code panes that scroll both ways |
| 10-15 04:29 | v3 | R7: project name, new lab order and titles, translucent AX layer above the screenshot, "Paper §" citations |
| 10-15 05:04 | v4 | R8: every 3D layer restored, free drag and zoom with reset |
| 10-16 03:04 | Synced to final arXiv paper | Renumbered references, rewritten quotes and removed table rows from the final paper |
