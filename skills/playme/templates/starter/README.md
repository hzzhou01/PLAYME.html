# PLAYME starter

A working page with one part, ready to copy into your project.

```bash
cp -r <skill>/templates/starter  ./playme          # the page
cp -r <skill>/kit                ./playme/kit      # the kit it loads
cd playme && python3 -m http.server 8000           # open http://127.0.0.1:8000/  (?lang=zh for Chinese)
```

| file | what it is |
|---|---|
| `index.html` | the page shell: language toggle, one `<div data-pm-slot="…">` per part in reading order |
| `page.css` | page layout only; the kit styles the parts |
| `parts/01-retry.js` | one complete part: question, Play, one toggle, a scene on the virtual clock, readouts, source line, two folds |
| `parts/01-retry.css` | that part's scene styles, scoped under `.pm` |
| `facts.json` | every paper number and reference the page shows (`PM.F(key)`, `PM.ref(id)`); replace the examples |

Add a part: copy `parts/01-retry.*` to `parts/02-<id>.*`, change the id in `PM.register('<id>', …)`, add a slot
`<div data-pm-slot="<id>"></div>` and the `<link>` / `<script>` lines to `index.html`. Pick the pattern for your claim in
`references/patterns.md`.

English only: delete the Chinese strings you do not need (`PM.L('…')` with one argument is fine), remove the
`PM.langToggle(...)` call and the `<span id="lang">`, set `<html lang="en">` and drop the language lines of the first
`<script>`. Then run the checks with `--langs en`.

Check and ship (from the skill folder):

```bash
node scripts/lint.mjs --url http://127.0.0.1:8000/ --widths 1440,400 --langs en,zh --shots qa/shots
python3 scripts/bundle.py playme/index.html -o PLAYME.html --offline
```

`index.html` loads the core and the device frames. For an exploded 3D view, uncomment the two `playme-3d` lines
(three.js then loads on demand, and `bundle.py --offline` inlines it). Remove `playme-desk.*` if you draw no devices.
