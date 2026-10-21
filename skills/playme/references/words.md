# Words

Load this file before you write any copy: questions, leads, captions, takeaways, fold titles, button labels, source
lines, and the README. It implements rule R11 (words are precise and plain) and the writing rules of the spec.

The OpenGCUA authors put it this way in their second review (round R2.2):

> "Wording must be accurate and fit academic paper writing. 'BENCHMARK HABITS' / 评测习惯 is not accurate. The
> expression must also be very clear and easy to understand."
> 「用词需要准确，符合paper writing和学术用语的准确性……并且表达还需要非常地清晰、容易让人理解」

A reader gives each part about one minute. Every word they stop on costs part of that minute. Every word that differs
from the paper makes them wonder whether it means something else.

## 1. Rules

| # | rule | example |
|---|---|---|
| W1 | One idea per sentence. Split at "and", "while" and "which". | "The click lands in the front window. The user's typing is lost." |
| W2 | Give every sentence an explicit subject: the agent, the harness, the driver, the reader. | "The driver returns a typed error." |
| W3 | Use the paper's terms, exactly as the paper writes them. | "sandbox benchmark", "code execution" |
| W4 | Define a term the first time it appears, in the same sentence or the next. | "The accessibility tree (AX tree) lists the elements an app exposes." |
| W5 | Use one word per concept, everywhere on the page. | "step" throughout; never "turn" or "round" for the same thing |
| W6 | Invent no catchy labels. A phrase the paper does not use is a new term the reader must learn. | A heading phrase the paper itself uses is fine: "Mechanism in the harness, decision in the model" (Paper §3.2). |
| W7 | Titles name the claim or the thing. A count may qualify the thing; it never replaces it. | "Real-device harness architecture", "Five differences between a benchmark and a real Mac" |
| W8 | Put the highlight in the title. The core contribution comes first. | "Code execution: one program instead of many steps" |
| W9 | Question titles have at most 14 words (30 Chinese characters). | "Where does a click land when no window is named?" |
| W10 | Captions have at most 12 words (24 Chinese characters), in the present tense. | "The window moves before the click." |
| W11 | Say what the reader will do and see. | "Press Play: the agent takes the pointer four times." |
| W12 | No em-dash asides, no "not X, but Y", no metaphors used as jargon. | Write two sentences instead. |
| W13 | Write the project's name exactly as the authors write it. | "OpenGCUA" (R7.1); never a shortened form |
| W14 | Write Chinese natively: full-width punctuation, English technical names kept. | 「代码执行：一个程序，代替许多步」 |

Write capital letters only where the language needs them. Let CSS set eyebrows in uppercase. Text typed in capitals
stays in capitals in Chinese and is spelled out letter by letter by some screen readers.

## 2. Build the glossary before you write copy

Wording problems are cheapest before the first sentence. Build the glossary from the paper, have the authors review
it once, then write.

1. Read the abstract, every section heading, every figure and table caption, and every definition in the paper.
2. List each concept the page will name. For each one, record the paper's exact term, the section that defines it,
   and a one-line definition in plain words.
3. Decide the Chinese term once. Prefer the established term of the field (基准测试 for benchmark, 沙盒 for sandbox).
   Use the authors' own Chinese terms when they have slides or a Chinese abstract. Keep a name in English when Chinese
   practice keeps it (Harness, SDK, GUI, CLI, API).
4. Next to each term, write the variants writers drift into ("turn", "round", 「轮次」 for "step").
5. Start the ban list: invented labels, names the paper dropped (models, tasks), configuration words the paper does not
   print, and the project's wrong names.
6. Send the glossary table to the authors before you write copy. They review each term once, instead of every
   sentence later.
7. After each review round, turn every wording comment into a glossary entry or a ban entry the same day (R17).

Keep the glossary in `words.json`. `fidelity.py --words words.json` fails the build on any match of a `ban` pattern
in the rendered text, in either language. `terms` and `avoid` guide the writer; only `ban` is enforced. A
`glossary.md` table made from the same file is the version the authors read.

```json
{
  "project": { "name": "OpenGCUA" },
  "keep_english": ["README", "PLAYME", "Claude Code", "three.js", "Harness", "SDK", "GUI", "CLI", "API"],
  "terms": [
    { "en": "sandbox benchmark", "zh": "沙盒基准测试", "ref": "§4.1", "avoid": ["benchmark habits", "评测习惯"] },
    { "en": "benchmark assumption", "zh": "基准测试假设", "note": "left side of every gap comparison" },
    { "en": "real-device harness", "zh": "真机 Harness", "note": "right side of every gap comparison" },
    { "en": "step", "zh": "步", "def": "one model response", "avoid": ["turn", "round", "轮次"] },
    { "en": "code execution", "zh": "代码执行", "ref": "§3.1" },
    { "en": "accessibility tree (AX tree)", "zh": "无障碍树（AX 树）" }
  ],
  "ban": [
    { "pattern": "benchmark habits?", "flags": "i", "use": "benchmark assumption", "why": "R2.2: invented label" },
    { "pattern": "评测习惯", "use": "基准测试假设", "why": "R2.2: invented label" },
    { "pattern": "reasoning effort|推理强度", "flags": "i", "why": "R3: a configuration the paper does not print" },
    { "pattern": "\\bGCUA\\b", "use": "OpenGCUA", "why": "R7.1: project name" }
  ]
}
```

## 3. What each piece of copy is for

| piece | budget | form | example |
|---|---|---|---|
| lab title | short noun phrase | the claim or the thing; the highlight first | "Code execution: one program instead of many steps" |
| eyebrow | one line | concept · paper location | "Harness-to-model decision transfer · Paper §3.2" |
| question `.pm-q` | ≤ 14 words / ≤ 30 字 | one plain question the stage answers | "Same task, four ways to act: how many model calls does each need?" |
| lead | one sentence, ≤ 25 words | sets up the scene | "A person keeps typing in Notes while the agent fills a form." |
| caption | ≤ 12 words / ≤ 24 字 | what is on screen now | "The agent takes the pointer again." |
| takeaway | one sentence | the result the reader just saw | "Binding the click to a window keeps it out of the user's way." |
| fold | title + one-line teaser | names the content | "How the code works" · "Intent and code for both sides" |
| button | a verb, one to three words | the action | "Play", "Run all four", "Take it apart" |
| source line | one line | provenance (see `fidelity.md`) | "Simulation for illustration · based on Paper §4.1" |

The question, lead and takeaway share one budget: at most 70 English words or 140 Chinese characters per part.

## 4. Before and after

From the review ledger of the OpenGCUA lab:

| before | after | why |
|---|---|---|
| "BENCHMARK HABITS" / 「评测习惯」 | "Benchmark assumption" / 「基准测试假设」 for the left side of each comparison; "sandbox benchmark" / 「沙盒基准测试」 for the setting | R2.2: an invented label; the paper's terms are precise |
| "One program instead of many steps" | "Code execution: one program instead of many steps" / 「代码执行：一个程序，代替许多步」 | R4.5: the highlight belongs in the title |
| "5-layer" | "Real-device harness architecture" / 「真机 Harness 架构」, eyebrow "Five layers, each with a clear job · Paper §4.3.1" | R7.2: a count is not a name |
| "§4.3.1" / 「第 4.3.1 节」 | "Paper §4.3.1" / 「论文第 4.3.1 节」 | R7.4: tell readers where to look |
| "GCUA" | "OpenGCUA" | R7.1: the project's exact name |
| "Real run · Model A (high reasoning effort) · …" | "Real run · Model A · workbook task · run 1 · step 5" | R3: no configuration the paper does not print |

The sentence the authors flagged in round R2.2:

- Before: "Habits that pass on a benchmark break on a shared, changing, cluttered machine. Each tab runs both
  versions."
- After: "A sandbox benchmark gives the agent a still, freshly reset machine of its own. A real Mac does not. Each tab
  shows one of the five differences: press Run to see the same step under the benchmark assumption and on a real
  device."
- After, Chinese: 「沙盒基准测试为智能体提供一台静止、已重置、由它独占的机器，而真实的 Mac 并非如此。每个标签页展示五项差异之一：点击运行，对比同一步操作在基准测试假设下和在真机上的结果。」

The first version packed three metaphors ("habits", "cluttered", "both versions") into two sentences. The rewrite
names the setting with the paper's term, says what it provides, and tells the reader what to press and what to compare.

General patterns:

| before | after | rule |
|---|---|---|
| Title: "The secret sauce" | Title: "Prompt caching" | W6, W7: name the thing |
| "It's not a screenshot, it's a tree." | "The agent reads the accessibility tree. The screenshot shows only pixels." | W12, W1 |
| "Errors are surfaced early." | "The driver returns a typed error before the model's next step." | W2 |
| "The harness, which runs on the device and talks to the OS through drivers, keeps state across calls." | "The harness runs on the device. It keeps state across calls." | W1, W12 |
| Caption: "Here you can watch what happens when the agent clicks a window that has moved since it last looked." | Caption: "The window moves. The click hits the old spot." | W10 |
| 「每个标签运行两个版本。」 (translated word by word) | 「每个标签页对比同一步操作的两种结果。」 | W14 |

## 5. Bilingual conventions

English is the source language. Chinese is written from the meaning, by someone who reads it as a native speaker. The
OpenGCUA review build opened in Chinese, so the authors read the Chinese first. Give both languages the same care.

Mechanics:

- Write both strings at the same call site: `PM.L('Take it apart', '拆开看看')` for nodes, `PM.t(en, zh)` for
  computed text. Attributes (`aria-label`, `title`) need both languages too.
- Canvas and SVG text re-render on `PM.onLang`.
- Never translate code, API names, error codes, file paths, model names, product names or quoted model output.
- Keep these names in English in Chinese copy: README, PLAYME, Claude Code, three.js, GUI, CLI, SDK, API, and the
  terms the authors keep (`keep_english`).
- On first use in Chinese, give a mechanism name in English with a Chinese gloss: `Micro-compaction（微压缩）`.
- Model output written in Chinese stays verbatim in the Chinese page. The English page shows an English gloss and
  keeps the original one click away.

Typography in Chinese:

- Full-width punctuation: ，。：；？！（）. Pick one quotation style per page: “…” or 「…」. The ellipsis is ……
- One half-width space between Chinese and Latin letters or digits: 「真机 Harness」「第 4.3.1 节」「第 5 步」.
  No space next to full-width punctuation.
- Ranges use an en dash: 「第 31–34 步」. Lists use 、: 「论文第 2.3、3.1、3.3 节」.
- Source lines join parts with " · ". After a full-width closing bracket, drop the space before the dot:
  「论文案例研究（图 10）· 第 6 步」.
- Counters: run 1 → 第 1 次运行; step 5 → 第 5 步; steps 31–34 → 第 31–34 步.
- Paper references: Paper §4.3.1 → 论文第 4.3.1 节; Paper Fig. 9 → 论文图 9; Paper Table 5 → 论文表 5 (full table
  in `fidelity.md`).
- No uppercase and no letter-spacing on Chinese labels. The kit switches them off under `html[lang^=zh]`.

Budgets in Chinese: question ≤ 30 characters, prose ≤ 140 characters per part, captions ≤ 24 characters.
`lint.mjs --langs en,zh` measures both languages.

## 6. Before you send a preview

- [ ] The glossary exists, and the authors have seen it
- [ ] Every title names a claim or a thing; the highlight comes first
- [ ] Every question fits 14 words / 30 字; every caption fits 12 words / 24 字
- [ ] Every term matches the glossary in both languages; no term has two names
- [ ] No invented labels, no metaphors as jargon, no em-dash asides, no "not X, but Y"
- [ ] Every paper reference starts with "Paper" / 「论文」
- [ ] `fidelity.py --words words.json` passes in English and Chinese
- [ ] Someone read the Chinese page as Chinese, without the English beside it
