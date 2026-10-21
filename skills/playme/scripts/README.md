# PLAYME scripts

Four tools that keep a PLAYME page honest, readable and shippable. Run them from anywhere; paths are your own.

| script | needs | does |
|---|---|---|
| `bundle.py` | Python 3 | turns `index.html` + its files into one `PLAYME.html` that opens offline |
| `lint.mjs` | Node 18+, puppeteer | checks every part against the reader budgets in a real browser; dumps the page text |
| `fidelity.py` | Python 3 (`pdftotext` for a PDF) | checks quotes, references, facts, words and privacy against the paper |
| `capture.mjs` | Node 18+, puppeteer, ffmpeg | films one part frame by frame for GIFs, videos and covers |

The usual loop:

```bash
S=path/to/skills/playme/scripts
node $S/lint.mjs --url index.html --dump text.json            # reader budgets, 1440/400 px, EN/ZH
python3 $S/fidelity.py --dump text.json --paper paper.tex \
        --facts facts.json --words words.json                 # says what the paper says, leaks nothing
python3 $S/bundle.py index.html -o PLAYME.html --offline      # one file
node $S/lint.mjs --offline-file PLAYME.html                   # ...that really opens with no network
node $S/capture.mjs --url index.html --part read-or-play \
        --out frames/ --gif demo.gif --mp4 demo.mp4           # the promo comes from the lab itself
```

Every tool prints a readable report and exits `0` when everything passes, `1` when a check fails, and `2` on a usage
error, so they can gate a CI job.

## Installing the browser driver

`lint.mjs` and `capture.mjs` drive headless Chrome. They use whichever of these they find (in the current
directory, next to the scripts, or on `NODE_PATH`):

```bash
npm i -D puppeteer                    # downloads its own Chrome; nothing else to set
npm i -D puppeteer-core               # uses your Chrome: set CHROME_PATH=/path/to/chrome if it is not found
```

Without a package they stop with that instruction. Running as root or with `CI` set adds `--no-sandbox`.
`ffmpeg` is needed only for `capture.mjs --mp4/--gif`; `pdftotext` (poppler) only for `fidelity.py --paper x.pdf`.

## bundle.py

```bash
python3 bundle.py index.html -o PLAYME.html [--offline] [--assets DIR] [--three PATH] [--root DIR] [--strict] [--quiet]
```

- Inlines every local `<link rel=stylesheet>` (in place, `@import` followed, `media` kept), `<script src>`,
  `<img src/srcset>`, `<source>`, `<video poster/src>`, `<audio>`, SVG `<image href>`, `<link rel=icon>`, CSS
  `url()` (fonts, images) and `style="…url()…"`. SVG becomes a percent-encoded `data:` URI, everything else base64.
- `PM.asset('img/a.png')` string literals in any script become `window.PM_ASSETS = {"img/a.png": "data:…"}`,
  injected right after `playme.js` (one copy per file). Paths built at runtime (`PM.asset(\`img/${x}.png\`)`) are
  reported with file:line: write them as complete literals or pass `--assets img`. Path literals written without
  `PM.asset()` are mapped too (kit APIs such as `PM.layers3d` route image paths through `PM.asset`), with a note.
- `--offline` puts `window.PM_THREE_SRC = "<three.js r160 module>"` first, when the page uses 3D
  (`playme-3d.js`, or code that reads `PM_THREE_SRC`). The kit imports it from a `blob:` URL, so the exploded view
  works from `file://` with no network. The module comes from `kit/vendor/` (next to `playme.js`, else the
  skill's own copy) or `--three PATH`.
- A `defer` script moves to the end of `<body>` (same order), so it still runs after the document is parsed.
- `</script` and `<!--` inside inlined code are escaped without changing what the code means.
- Network URLs (Google Fonts, a CDN script) stay as they are and are reported: the page needs a connection for them.
  So are `<iframe>` sources, external SVG sprites and `fetch()` of local files (it fails from `file://`).
- The output is deterministic (no timestamps), carries a one-line build comment with a source hash, and is rewritten
  only when it changes. The report splits the size into markup / css / js / images / fonts / media / three.js and
  lists the largest assets and every local reference still left in the output.

## lint.mjs

```bash
node lint.mjs --url <page> [--widths 1440,400] [--langs en,zh] [--reduced] [--parts id,id]
              [--dump text.json] [--shots dir] [--json report.json] [--root dir]
node lint.mjs --offline-file PLAYME.html [same options]
```

`<page>` is a URL, or a local file that is served from a built-in static server (rooted at the smallest folder
holding the page and every local file it links; `--root` overrides). Each width × language is a fresh page:
`?lang=…`, `localStorage pm-lang` and `PM.setLang` set the language; `--reduced` emulates reduced motion. Every part
is scrolled into view once (the kit measures players then) before anything is measured.

Per part (`section.pm-part` / `[data-pm-part]`), at rest, outside closed folds:

| check | budget |
|---|---|
| `q` words in `.pm-q` | ≤ 14 EN words / ≤ 30 ZH characters |
| `prose` visible text outside the stage, eyebrow, source line, outcome and folds (q + lead + takeaway + any other paragraph) | ≤ 70 EN words / ≤ 140 ZH characters |
| `primary` visible `.pm-primary` | exactly 1 |
| `ctrls` buttons, links, inputs, tabs, switches outside `.pm-scene` (the scrubber and fold summaries do not count) | ≤ 4 |
| `folds` `details` in `.pm-deeper` | ≤ 4, none open |
| `chips` boxed labels that are not controls: background + border + radius ≥ 4 px + ≤ 4 words, outside `.pm-scene` ("fake buttons") | 0 |
| `scrub` every `.pm-stage` with a `.pm-primary` has a `.pm-scrub` | — |
| `height` at widths ≥ 1200 px | ≤ 1250 px |

Per page: console errors, page errors, failed requests, horizontal overflow (the elements past the edge and the
parent each one breaks out of), duplicate part ids. Words: EN = whitespace-separated tokens with a letter or digit;
ZH = CJK characters + Latin/number tokens.

`--offline-file` opens the file from `file://` with every http(s) request blocked. Blocked requests, other local
files the page loads (not inlined), and the errors they cause fail the run; when the kit's 3D loader is present it
must load three.js from inside the file (the report prints the revision).

`--dump text.json` (first width, every language) records for each part: the text at rest, the captions of a full
play-through on the player's manual clock, the text after the end (`PM.players[id].seek(duration)`), the text after
each option in the bar, every fold opened (title, teaser, text), the quotes (`.pm-quote`, `[data-quote]`), the facts
(`[data-fact]`), the marks and `title`/`aria-label`/`alt` texts; plus the whole page text. It is the input of
`fidelity.py`. `--shots dir` saves the page and every part at rest (and, with `--dump`, every part at its end).

## fidelity.py

```bash
python3 fidelity.py --dump text.json [--paper paper.tex|.pdf|.txt|.md …] [--facts facts.json] [--words words.json]
                    [--text README.md …] [--paper-lang en] [--allow REGEX …] [--json report.json] [--strict]
```

- **Quotes** must appear verbatim in the paper after normalisation (Unicode quotes, dashes, ellipsis, ligatures,
  whitespace; LaTeX markup, `~`, `\%`, `--`, ``` ``…'' ```, `\ref{}` resolved to its number, `\cite{}` dropped,
  `\input` followed). `…` in a quote skips text. A miss prints the closest passage and a word diff. A translated
  quote is checked when it carries the original: `<q class="pm-quote" data-quote="Background execution keeps…">后台执行…</q>`.
- **References**: `Paper §4.3.1`, `§4.3`, `Section 4`, `Fig. 6`, `Figs. 2–3`, `Table 2`, `Appendix B` and
  `论文第 4.3 节`, `图 6`, `表 2`, `附录 B`: each must exist. From `.tex` the numbering is computed as LaTeX does
  (sections, starred ones skipped, `\appendix`, captions in figure/table floats, subfigures not counted); from a
  PDF or text, from `Figure N:` / `Table N:` captions and numbered headings. Each reference is listed with the
  title it resolves to, so you can see that "Fig. 6" points at the figure you meant.
- **Facts**: every `[data-fact=key]` text equals `facts.json`:

  ```json
  { "refs":  { "tab-main": { "en": "Table 2", "zh": "表 2", "anchor": "first words of the caption" } },
    "facts": { "main.gain": { "value": "+12.4", "ref": "tab-main", "loc": "row Mean, column Δ" },
               "out.tokens": { "value": "41.2K", "zh": "4.12 万", "aliases": ["41.2 K"], "ref": "tab-main" } } }
  ```

  The schema is the one in `references/fidelity.md` (a flat `{"key": "41.2K"}` map also works). `PM.F(key)` renders a
  checked value on the page. Keys on the page that facts.json lacks fail too; facts never shown are listed. Each
  `refs` label is checked against the paper, and its `anchor` against the title it resolves to.
- **Quote ids**: `data-quote="<id>"` points at `facts.json` `quotes.<id>`: the English is checked verbatim and the
  element may show the Chinese rendering.
- **Words** (quoted passages are exempt: they are the paper's words): `words.json`:

  ```json
  { "ban": ["benchmark habits", "/reasoning effort/i",
           { "pattern": "评测习惯", "use": "基准测试假设", "why": "an invented label" }],
    "prefer": { "5-layer": "Real-device harness architecture" },
    "allow": ["team@example\\.org"] }
  ```

  `ban` and `prefer` may also be `{"en": […], "zh": […]}`. Banned terms fail; `prefer` hits warn (`--strict`: fail).
- **Privacy**: IPv4 addresses, e-mails, account paths (`/Users/<name>`, `/home/<name>`, `C:\Users\<name>`,
  `/root/…`), key-like tokens (`sk-…`, `ghp_…`, `AKIA…`, JWTs, private keys, `api_key=…`), URLs carrying tokens or
  passwords; long random strings warn. `allow` patterns and `--allow` skip known-public hits. Images are not
  scanned: check screenshots by eye.
- `--text FILE` checks any text (README, promo copy) for references, words and privacy too.

## capture.mjs

```bash
node capture.mjs --url <page> --part <id> --out frames/ [--mp4 out.mp4] [--gif out.gif]
                 [--fps 30] [--width 1200] [--height 900] [--dpr 1] [--lang en] [--from ms] [--to ms] [--hold 1200]
                 [--select css] [--gif-width 800] [--gif-fps 15] [--css "rules"] [--keep-fixed] [--root dir]
node capture.mjs --url <page> --part <id> --at <ms> --png cover.png [--dpr 2]
```

The player runs on a virtual clock, so capture never depends on how fast the machine is:
`PM.players[id].setManual(true)`, `seek(0)`, `play()`, then `advance(1000 / fps)` before each screenshot of the
part's `.pm-stage` (or `--select`). Frame *i* is exactly story time `from + i / fps`. A player without a manual clock
is filmed with `seek(t)` per frame. Fixed and sticky page chrome is hidden so it never covers the stage
(`--keep-fixed` keeps it). The last frame is held for `--hold` ms so a looping GIF can be read.

Output: `frames/f00000.png …`, `frames/frames.json` (fps, duration, size, marks), an H.264 `yuv420p` MP4 and a
palette-optimised GIF. `--at 3200 --png cover.png` writes one still at that moment (covers, social previews).
