# Staying true to the paper

Load this file before you put a number, a quote, a citation, a real run or a screenshot on the page, and again when
the paper changes. It implements rules R13 (never contradict the paper) and R14 (privacy in real material).

The authors of OpenGCUA, whose Interactive Lab was built with PLAYME, set one rule above all others (round R3):

> "Please make sure nothing on the site contradicts the paper."
> 「请确保网站的信息不会和paper矛盾」

One value computed from the runs on disk differed from the value printed in the paper's table. The page printed the
table's value.

A PLAYME page is read next to the paper. A reader who finds one number that differs from the paper stops trusting
every animation on the page. Run the fidelity checks on every build; a final proofread comes too late.

In short:

- One file (`facts.json`) holds every number, quote and reference. Copy never types them by hand.
- Cite as "Paper §4.3.1" / 「论文第 4.3.1 节」. Label every stage: simulation, real run or paper case study.
- Show the runs the paper used, with the numbers the paper printed. Drop what the paper dropped.
- Problems with the paper go to the authors. They never go on the page.
- Scrub real material. Re-sync, step by step, whenever the paper changes.

## 1. One file holds every fact

Every number, quoted sentence and paper reference on the page comes from one file, `facts.json`. Copy never types a
number or a figure number by hand. When a value changes, you edit one line, and the page follows.

What goes into `facts.json`:

- `paper`: the title and the version you synced against.
- `refs`: every section, figure, table, equation and appendix the page cites, under a **stable id**. The id never
  changes; only the label does. When the paper renumbers its figures, you edit the labels here.
- `facts`: every number, stored as the string the paper prints (`"41.2K"`, `"3.1×"`, `"−18%"`), with its location.
- `quotes`: every sentence quoted from the paper, verbatim in English, with a Chinese rendering written natively.
- `runs`: the display names of the real runs the page shows: model names, task labels and one scope phrase.

What stays out: `facts.json` ships inside `PLAYME.html`. Anything in it is public, even if the page never renders
it. Keep run directories, configuration names, author notes and known paper inconsistencies in `docs/authors.md` (a
file the page never loads). The OpenGCUA lab learned this the hard way. Its facts file held notes for the
authors and run directory names that contained configuration words. The build needed a separate stripping script that
refused to ship while a forbidden word survived, because those notes were visible in the page source.

### Schema

```json
{
  "paper": {
    "title": "<the paper title>",
    "version": "arXiv v2 source, 2026-10-16"
  },
  "refs": {
    "abstract":     { "en": "Abstract", "zh": "摘要",        "anchor": "first words of the abstract" },
    "sec-arch":     { "en": "§4.3.1",   "zh": "第 4.3.1 节", "anchor": "first words of the section heading" },
    "tab-device":   { "en": "Table 5",  "zh": "表 5",        "anchor": "Real-device results on four macOS tasks" },
    "fig-coverage": { "en": "Fig. 11",  "zh": "图 11",       "anchor": "first words of the caption" }
  },
  "facts": {
    "device.a.steps":    { "value": "27.5",  "ref": "tab-device", "loc": "row Model A, column Steps",
                           "unit": "steps per task" },
    "device.ratio":      { "value": "3.1×",  "ref": "abstract",   "loc": "the sentence on reasoning tokens" },
    "coverage.p1.steps": { "value": "12",    "ref": "fig-coverage", "loc": "header of the first panel" }
  },
  "quotes": {
    "arch.runtime": {
      "en": "The runtime keeps one interpreter per task, …",
      "zh": "运行时为每个任务保留一个解释器，……",
      "ref": "sec-arch"
    }
  },
  "runs": {
    "scope":  { "en": "the 12 real-device runs", "zh": "12 次真机运行" },
    "models": { "a": "Model A", "b": "Model B" },
    "tasks":  { "workbook": { "en": "workbook task", "zh": "工作簿任务" } }
  }
}
```

Field rules:

| field | rule |
|---|---|
| `refs.*.anchor` | Words from the heading or caption. They let you find the item again after renumbering. |
| `facts.*.value` | The exact printed string: same rounding, unit suffix, sign and thousands separator. |
| `facts.*.ref` | A key of `refs`. Every fact has a location in the paper. |
| `facts.*.loc` | Row, column, panel or sentence, precise enough for a reviewer to check in ten seconds. |
| `quotes.*.en` | Verbatim from the paper. Use `…` where you cut. Never edit the words. |
| `runs.scope` | A phrase that names the runs without a table number. Table numbers change; this phrase does not. |

### Using facts on the page

The page declares the file once; `PM.boot()` reads it before any part mounts (fetched over http while you develop,
inlined by `bundle.py` in `PLAYME.html`):

```html
<script type="application/json" id="pm-facts" data-src="facts.json"></script>
```

Show numbers and citations through the kit, never as typed strings. `PM.F(key)` renders the printed value inside an
element marked `data-fact`, which `fidelity.py` compares with `facts.json`; `PM.ref(id)` renders "Paper Table 5" /
「论文表 5」 from `refs`, so a renumbered paper is fixed in one place. Mark every quoted sentence with the class
`pm-quote` (or `data-quote="<quote id>"`); `fidelity.py` checks it against the paper.

```js
PM.h('p', null, PM.L('Steps per task: ', '每个任务的步数：'), PM.F('device.a.steps'));   // 27.5, data-fact checked
PM.source(P, [{ kind: 'paper', text: PM.ref('tab-device') }]);                      // "Paper Table 5" / 「论文表 5」
```

A value you computed yourself is not a paper fact. Leave it off the page, or show it as a real-run aggregate with the
scope phrase (Real runs, rule 7). Never label a computed value "Paper".

## 2. Citing the paper on the page

Readers should know where to look in the paper. The authors asked for the word "Paper" in front of every reference
(round R7.4: 「§4.3.1这个符号前面都可加“Paper”更清晰传达可以去论文哪里查看」).

| item | English | Chinese |
|---|---|---|
| section | Paper §4.3.1 | 论文第 4.3.1 节 |
| section range | Paper §4.3.3–4.3.4 | 论文第 4.3.3–4.3.4 节 |
| several sections | Paper §2.3, §3.1 and §3.3 | 论文第 2.3、3.1、3.3 节 |
| figure | Paper Fig. 9 | 论文图 9 |
| table | Paper Table 5 | 论文表 5 |
| equation | Paper Eq. (1) | 论文式 (1) |
| appendix | Paper Appendix B | 论文附录 B |
| mixed | Paper Fig. 4 and Table 2 | 论文图 4 与表 2 |
| in a sentence | … per task (Paper Table 5). | ……（论文表 5）。 |

Rules:

1. Always write "Paper" / 「论文」 before the reference. A bare "§4.3.1" or "Fig. 6" is not enough.
2. Use the numbering of the paper version you synced against. Never cite a page number; pages move between versions.
3. Use one form across the page: "Fig." (never "Figure"), "§" for sections, "Table" in full.
4. Cite where the claim is made: in the part's eyebrow, the source line, or the fold that shows the numbers.
5. Every reference must exist in the paper. `fidelity.py` checks every "Paper §x.y / Fig. N / Table N" it finds.

## 3. Provenance labels

Every stage tells the reader what kind of material it shows. The label is one plain text line under the stage
(`p.pm-source`). It is never a pill, a box or a button (round R2.1: readers took "Simulation" and "Paper Fig. 6" for
buttons).

| kind | English | Chinese | where it goes |
|---|---|---|---|
| `sim` | Simulation for illustration · based on Paper §4.1 | 示意模拟 · 依据论文第 4.1 节 | source line of the stage |
| `sim` | Simulation for illustration · built from the SDK source (`ui.ax`) | 示意模拟 · 依据 SDK 源代码（`ui.ax`） | source line of the stage |
| `paper` | Numbers from Paper Table 5 | 数据来自论文表 5 | source line of the part or fold that shows them |
| `paper` | Paper case study, Fig. 10 | 论文案例研究（图 10） | source line of a case-study part |
| `real` | Real run · Model A · workbook task · run 1 · step 5 | 真实运行 · Model A · 工作簿任务 · 第 1 次运行 · 第 5 步 | heading of the fold that shows the real moment |
| `real` | Real run · Model B · hotels task · run 1 · steps 31–34 | 真实运行 · Model B · 酒店任务 · 第 1 次运行 · 第 31–34 步 | same; ranges use an en dash |
| `note` | Recorded with network access disabled | 录制时禁用了网络访问 | inside the "In real runs" fold |
| `note` | Illustrative example adapted from the OpenGCUA case study | 改编自 OpenGCUA 案例研究的示意例子 | source line of a teaching example |

Where each goes:

- The **source line** describes the stage as a whole. A simulated stage says "Simulation for illustration" and names
  what it is based on. A stage that replays a case study says "Paper case study, Fig. N".
- A **real-run label** goes on the fold that shows the real moment (the screenshot, the real code, the real error
  text). It goes on the source line only when the whole stage replays one real run.
- A label names model, task, run and step. It never names a configuration the paper does not print (Real runs,
  rule 4).

```js
PM.source(P, [
  { kind: 'sim',   text: PM.L('Simulation for illustration', '示意模拟') },
  { kind: 'paper', text: PM.L('based on Paper §4.1 and Appendix B', '依据论文第 4.1 节与附录 B') },
]);
```

## 4. Real runs

Real trajectories make a page convincing. They also carry the most risk, because the runs on disk are never exactly
what the paper printed.

1. **Use the runs the paper's tables used.** Same configuration, same run index. Ask the authors which runs those are
   when the paper does not say (round R2.7). Confirm the choice privately: recompute the table's means from the
   candidate runs. Never write "matches Table 5" or "reproduces Table 5" on the page.
2. **Case-study material uses exactly the case-study runs.** Show the figure's numbers, code and counts as printed
   (for example panel headers such as "12 steps / 4,210" and "19 steps / 31,077"). Do not add the run totals of those
   runs, and do not add a footnote about where the figure's numbers come from.
3. **Show numbers exactly as printed.** If the table prints 41.2K, the page prints 41.2K, even when the run on disk
   gives a different value. Keep the paper's rounding: if the figure says −18%, do not write −17.6%.
4. **Print no configuration the paper does not print.** The runs on disk carry settings such as a reasoning effort.
   If the paper's tables do not name them, the page does not either (R3: no reasoning-effort labels for any model).
   A label reads "Real run · Model A · workbook task · run 1 · step 5", with nothing in brackets.
5. **Never show a note that the paper and the runs differ**, or that the paper disagrees with itself. Write it in
   `docs/authors.md` and report it to the authors (see *What to escalate*). The page shows the paper.
6. **Drop what the paper dropped.** Models, rows, tasks and statistics the paper (or the authors) removed disappear
   from the page, from the data and from the page source. Add each dropped name to the ban list in `words.json` so
   the check catches any leftover. In the OpenGCUA lab the authors removed one model from all material (R2.7), one
   model and one task statistic from the real-run view (R4.7), and the final paper dropped a table row.
7. **Aggregates over the runs are allowed when they add detail without contradicting the paper.** Phrase them with
   the scope phrase: "5 of the 12 real-device runs show the dialog" / 「12 次真机运行中有 5 次出现该对话框」. Never put
   a computed mean next to a printed table.
8. **Avoid a clash with a case study.** If a case study uses one run of a task, leave that task out of other real-run
   views. The OpenGCUA lab showed three real-run tasks instead of four for this reason (R3).
9. **Runs that back no table** (a short trace you recorded from the authors' code, an example in the repository) may
   seed a simulation. The scene is then a simulation: its source line says so and names the run ("Simulation · seeded
   from a run of code/scb.py on a toy trace"). It never shows the run's numbers as results.
10. **Missing data is not zero.** A cell with no valid trajectory reads "no valid recording" / 「无有效记录」.
11. **Use the paper's metrics only.** An internal verifier score is not "success". Show neither unless the paper
    reports it for that claim.
12. **Show the conditions of the runs** when a claim depends on them, in the "In real runs" fold. For example: if every
    run had a setting that disabled a feature, no real run can show that feature. Conditions are facts about the
    runs and contradict nothing; inconsistencies are notes for the authors.

### Things never observed

Keep a list in `docs/authors.md` of events the runs never contain: error types that never fired, dialogs nobody answered,
devices that were never connected. Before you write "in real runs", check the event against the list. A scene built on
an unobserved event is a simulation. It says so on its source line, and it never appears in an "In real runs" fold.

## 5. Simulations

Most stages are simulations. That is fine, as long as each one says what it is and what it is built from.

- A simulation built from the source code says so: "Simulation for illustration · built from the driver source".
  Name the module the behaviour comes from. API names, error codes and message texts come from that source verbatim.
- A simulation built from the paper's description cites the section: "· based on Paper §4.3.2".
- Code shown inside a simulation uses the scene's own coordinates. `click(612, 404)` must land at (612, 404) in the
  scene, so the reader can check the code against the picture.
- Real code is verbatim. Mark cut lines with `…`. Never "tidy" a model's program or translate its comments.
- When the real system differs from the simulation in a way a careful reader would notice, write one sentence about it
  in a fold ("How this simulation differs").

## 6. Privacy checklist for real material

Run this list on every screenshot, crop, trace, log line, GIF frame and code excerpt that comes from a real machine.
`fidelity.py` scans the rendered text for the patterns marked (auto). Images, video frames and canvas text need your
eyes.

- [ ] IP addresses, internal hostnames, ports on hosts (auto: IPv4)
- [ ] E-mail addresses; write the role instead ("Accounting") (auto)
- [ ] Account paths: `/Users/<name>`, `/home/<name>`, `C:\Users\<name>`; write `~/…` (auto: `/Users/`)
- [ ] API keys, tokens, cookies, signed URLs, URLs with session parameters (auto: key-like tokens, URLs with tokens)
- [ ] QR codes and barcodes; they encode links and tokens
- [ ] Passport, ID card, phone, order and account numbers
- [ ] Synthetic identities from test tasks; a fake passport still looks real when cropped out of context
- [ ] Names and faces of real people: reviewers, colleagues, chat windows, notification banners, the menu-bar user
- [ ] Other work on screen: browser tabs, bookmarks bar, recent files, window titles
- [ ] Internal paths of your own build: run directories, server paths, scratch folders, also in comments and data
- [ ] Every enlarged crop, checked again at the size it is shown; small text becomes readable when enlarged
- [ ] Image metadata (EXIF) and asset file names

## 7. When the paper changes: the sync procedure

Papers change after the page is built. The final OpenGCUA paper renumbered seven figures and one table, rewrote about
45 passages the lab quoted, dropped a table row and changed its title. The lab was re-synced in one pass with the steps
below. Do them in order.

1. **Make a restore point.** Copy the page sources and data to a dated backup. Every remap runs from this copy.
2. **Get the new text.** Prefer the LaTeX source. Expand the paper's name macros (`\projshort{}` → `OpenGCUA`), drop
   `\cite`, `\ref` and `\label`, and unwrap `\emph`, `\textbf` and `\texttt`. Text inside figures (code listings,
   panel headers) is not in the `.tex`; extract it into text files next to the paper, or every figure quote will look
   stale.
3. **Diff the numbering.** Match sections, figures and tables between versions by heading or caption (the `anchor`
   field), never by number. Write the old → new map down, for example `Fig. 1→3, 2→4, … 7→11; Table 6→5`.
4. **Remap references.** Change the labels in `facts.json` `refs`. Then find references typed into copy: English
   ("Fig. 6", "Figs. 3–4", "Table 6") and Chinese (「图 6」「表 6」). Apply the map in one pass, from the restore point,
   with a dry run first that prints the count of changes per file. Never run a number-to-number map twice: with
   `1→3` and `3→5` in the same map, a second run turns Fig. 1 into Fig. 5. Rewrite phrases that bake a number into
   prose ("the runs behind Table 6") into the scope phrase.
5. **Re-check every quote.**
   `python3 scripts/fidelity.py --dump qa/text.json --paper new/main.tex --facts facts.json --words words.json`
   lists every quote that is no longer verbatim. Also look for paraphrases: compare five-word sequences of each long
   string against the old and the new text, and review strings that share much with the old version and little with
   the new one.
6. **Rewrite stale quotes from the new text.** Replace English and Chinese together, as a pair. Apply each
   replacement as an exact old → new pair that must match exactly once; stop if any pair matches zero or several
   times.
7. **Re-check every fact value** against the new tables and figures. Values move even when numbering does not.
8. **Remove what the new version dropped**: rows, models, tasks, claims. Add the names to the ban list.
9. **Review your notes.** Some notes for the authors become obsolete (the dropped row resolved one). Mark them so.
10. **Rebuild and re-check everything.** Bundle, then
    `node scripts/lint.mjs --url <page> --langs en,zh --dump qa/text.json`, then `fidelity.py` again on the fresh
    dump. Diff the old and new text dumps and read every changed line.
11. **Report to the authors**: the numbering map, the quotes you rewrote, the rows you removed and the open
    questions.

## 8. What to escalate to the authors

The page never explains a problem with the paper. The authors fix the paper, or they tell you how to show it. Send
these to them, in a short list, before the page goes public:

- A printed number that disagrees with the runs, with another table, or with the text. Example: a ratio printed in
  the abstract differs slightly from the ratio of the rounded table values. The page keeps the printed ratio.
- A caption that disagrees with its table (a caption says a trajectory is missing; the table reports it).
- Code that disagrees with a claim (the paper says metadata changes on few hits; the code updates a counter on every
  hit). Show the code only where it does not expose the disagreement, or wait for the authors' answer.
- Which runs and which configuration the tables used, when the paper does not say.
- A term the paper uses under two names, or never defines.
- A mechanism readers will ask about that the paper does not describe (R4.1: "How does background execution work?").
  Ask, then build it from the source code as a labelled simulation.
- Real material you cannot scrub without losing its point.
- The exact project and component names (R7.1: the project is "OpenGCUA").

For each item write: what the page would show, where it is in the paper, what the runs or the code say, and what you
propose. Keep the list in `docs/authors.md`. Nothing from it appears on the page.

## 9. Checks before every share

```bash
python3 scripts/bundle.py index.html -o PLAYME.html --offline
python3 -m http.server 8801 --bind 127.0.0.1 &          # serve the folder that holds PLAYME.html
node scripts/lint.mjs --url http://127.0.0.1:8801/PLAYME.html --langs en,zh --dump qa/text.json
python3 scripts/fidelity.py --dump qa/text.json --paper paper/main.tex --facts facts.json --words words.json
```

`fidelity.py` checks quotes against the English dump. Chinese quotes are renderings, so update both languages together.

- [ ] `fidelity.py` passes: quotes verbatim, references exist, `data-fact` values equal `facts.json`, no banned
      term, no privacy pattern
- [ ] Every stage has a source line; every real moment has a real-run label
- [ ] No configuration wording, no "matches the paper", no run-versus-paper note anywhere, page source included
- [ ] Dropped models, rows and tasks are absent from the page, the data and the page source
- [ ] Every image passed the privacy checklist at its displayed size
- [ ] The notes for the authors are in `docs/authors.md`, and the page does not load it
