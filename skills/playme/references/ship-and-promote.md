# Ship and promote

Read this once the page passes `lint.mjs` and `fidelity.py`. It covers five jobs: ship one file, embed it in an
existing homepage, package it for collaborators, preview it for review, and make promo material from the page itself.
Script paths are relative to the skill folder; `playme/` is the source folder in the user's project. Values in square
brackets are from the OpenGCUA Interactive Lab, built with PLAYME.

## 1 Ship one file

Readers open `PLAYME.html` with a double-click, often on a laptop with no network (R15). The authors asked for exactly
this in round R5: "make the site open on our own computers".

**Build**

```sh
python3 scripts/bundle.py playme/index.html -o PLAYME.html             # three.js loads from the network if needed
python3 scripts/bundle.py playme/index.html -o PLAYME.html --offline   # three.js inlined: works with no network
```

`bundle.py` inlines every local stylesheet, script and image, every CSS `url()` (fonts and images) and every path
passed to `PM.asset('…')`. Those paths become data URIs in `window.PM_ASSETS`. It prints the size of the result.

- Write each asset path as one complete string literal: `PM.asset('assets/run1/s04.webp')`. The bundler finds paths
  by scanning for literals. A path built at runtime (`` `assets/run1/s${i}.webp` ``) is never inlined, and the image
  is missing in the shipped file. List such paths as literals in a data file.
- Use `--offline` whenever a part uses `PM.layers3d`. It inlines three.js r160 from `kit/vendor/` as
  `window.PM_THREE_SRC` (about +0.67 MB). Without it the loader tries `kit/vendor/` next to the page, then jsDelivr,
  then shows the flat CSS stack with a one-line note.
- Keep out of the page what `file://` refuses. Chrome blocks `fetch()` of local files and ES-module imports between
  local files. The kit uses classic scripts for this reason. Keep data in scripts or let `bundle.py` inline it.

**Test the file the way readers open it**

```sh
node scripts/lint.mjs --offline-file PLAYME.html
```

This opens the file through `file://` with every network request blocked. Read its report for console errors and
for requests the page tried to make. Then open the file yourself with the network switched off and check three things:
the headings use the real fonts, the 3D view orbits (no flat-stack note), and the language toggle swaps every part.
Also run the usual `lint.mjs --url` on the served build at 1440 and 400 px in every language.

**Size budget**

Base64 adds a third to every image and font. A wrapper that stores the page as a string (an `<iframe srcdoc>` share
shell) holds every byte about twice. A claude.ai artifact accepts at most 16 MB.

| Item | Budget |
|---|---|
| Fonts, all families | about 50 KB per family; at most 200 KB inlined (latin subsets, woff2) |
| three.js r160 | about 0.67 MB, offline build only |
| Images per part | at most 300 KB: crops, not full screenshots |
| The lab file | target 6 MB, ceiling 8 MB [5.2 MB for 7 labs, offline build] |

- Encode images as WebP at quality 75–80, at most 1600 px wide (960 px for small crops). Crop to the region that
  matters, and crop private data first (R14).
- Draw diagrams and 3D layers with Canvas 2D or SVG. A procedural drawing costs a few KB; a screenshot of it costs
  hundreds.
- Decode large image sets only when their part opens.
- Read the size line after every build. Find the cause of any jump before you continue.

**Fonts**

- Ship each family as one latin-subset woff2 file, with variable weight where the family has it. The OpenGCUA lab
  requested its two families from the Google Fonts css2 API with a current Chrome User-Agent and saved the latin woff2
  files it listed [51 KB raw, 68 KB inlined]. `pyftsubset` from fontTools with `--flavor=woff2` does the same locally.
- Declare each file with `@font-face` and a relative `url()`; `bundle.py` rewrites the URL into a data URI. Keep each
  licence file next to the fonts (the homepage fonts use the SIL OFL) and credit it in the footer.
- Never inline a Chinese font: a full CJK font weighs several megabytes. The kit's font stacks fall back to
  PingFang SC, Noto Sans SC and Microsoft YaHei.

## 2 Embed in an existing homepage

Authors often have a project homepage already. The lab then becomes one section of that page, and the host page keeps
control of everything around it. [The OpenGCUA lab went in right after the homepage's overview section.]

**Rules for a lab inside a host page**

- **Scoped classes.** Every kit selector sits under `.pm`, and every kit class starts with `pm-`. Write your part CSS
  the same way. Host rules on bare elements still leak in (`p`, `h3`, `figure`, `table`, `img`, `button`, `details`).
  Reset the ones the host styles under `.pm`, then look at a part inside the host.
- **The host owns the language toggle.** Render no second toggle inside the host. The lab follows `<html lang>`, and
  the host's toggle sets it. If the host translates its page by rewriting text nodes, keep its translator away from
  the lab root (`translate="no"` plus the host's own skip list); the lab swaps its own strings. Never write the host's
  `localStorage` keys.
- **Sticky header offset.** Every sticky element inside the lab uses `top:` equal to the host header's height
  [89 px]. Give every part the same `scroll-margin-top`, so a jump to `#<part-id>` lands below the header.
- **z-index below the host header.** Popovers, tooltips and sticky bars in the lab stay below the header's z-index
  [the host header used z 20, so the lab stayed below 20].
- **No `scrollIntoView()`.** It scrolls every scrollable ancestor, the host page included, and many hosts scroll
  smoothly. Scroll the lab's own containers with `scrollTop` and `scrollLeft`, and call `focus({preventScroll: true})`.
- **The host owns the URL.** Add the lab to the host's navigation and scroll-spy. The lab does not rewrite the hash.
- **Keep the host's own sections.** Insert the lab and leave every host section in place. A restyle of the host page
  is a separate, optional step that the authors approve.

**Insert the lab with a patch script**

Write a small script that reads the original host file and writes new output files. Never edit an output by hand: the
host will change, and the script must apply the same edits again.

- Each edit has an anchor string that must occur exactly once. On zero or several matches, the script stops and names
  the edit. A changed host then fails loudly at the exact spot.
- Typical edits: insert the lab after a chosen section; add a nav link ("Lab" / 「交互实验」) and its translation entry;
  add the lab to the scroll-spy list; optionally add a hero button ("Try the interactive lab").
- Put each optional edit behind its own flag. With every flag off, the output is the host page plus the lab.
- If the host also uses the lab's fonts, move their `@font-face` rules into the host's `<head>` once. The hero above
  the lab then paints in the right font from the start, and the fonts are not duplicated.
- R13 covers the host page too. The OpenGCUA homepage carried older numbers and two superseded figures. The script
  replaced them with exact, anchored edits and then stopped if any superseded value was still present.
- Write every output atomically: a temporary file in the same folder, then a rename.

**Test the lab inside the host**

1. Before you touch the real host, load the lab into a host-like test page: a sticky header with the host's height and
   z-index, the host's stylesheet, and `<html lang>` set by the page. Block the network.
2. Patch the real host and run `lint.mjs --url` on the result at 1440 and 400 px in both languages.
3. Switch the host's language and check that every part swaps, including canvas and SVG text.

**One shared file for reviewers**

Reviewers get the whole homepage with the lab inside, as one file that opens with a double-click [11.2 MB]. Ship the
lab alone next to it [5.2 MB]. If the homepage reaches you inside a wrapper (the OpenGCUA homepage came as an
`<iframe srcdoc>` shell holding its pages as JSON), keep that format. Parse the JSON, patch the page, serialize it the
same way, and stop if the untouched JSON does not round-trip byte for byte. Copy the page's icon into the wrapper's
`<head>`; otherwise the browser asks for `/favicon.ico` and logs a 404.

**Keep internal links out of public builds**

List every URL in a build and review each one before it goes public (namespace and licence URLs are harmless):

```sh
grep -oE "https?://[^\"' )<>]+" PLAYME.html | sort -u
```

The OpenGCUA homepage linked to an internal code repository. Its full-site build therefore circulated internally
only, and the package README said so. Run the privacy check of `fidelity.py` (IP addresses, e-mail addresses, account
paths, key-like tokens, URLs with tokens) on the text of every public build.

## 3 Package for collaborators

Round R5 asked: "Package everything as a project for colleagues." A colleague must be able to view the page in one
minute and change it in one hour. Use this layout:

```
<project>-playme/
  README.md                 view, layout, run, build, test, rules, what is not included
  site/                     built files that open with a double-click
    PLAYME.html             the lab alone
    <project>-full-site.html    the homepage with the lab (only when embedded)
  playme/                   the source: index.html, parts/*.js, kit files, facts.json, words.json, assets/
  scripts/                  bundle.py, lint.mjs, fidelity.py, capture.mjs
  host/                     the original homepage and the patch script (only when embedded)
  qa/package.json           puppeteer-core for the browser checks
  docs/                     plan.md, ledger.md, authors.md (questions and notes for the authors), source notes
```

**The README, in this order**

1. **View.** Which file to double-click, and what it contains. It needs no network and no install. Name the browsers
   it was tested in. Say where the language toggle is and how a player works (one glowing button; the progress bar
   seeks; arrow keys step through the captions).
2. **Layout.** The tree above, one line per folder.
3. **Run.** `cd playme && python3 -m http.server 8000`, then open `http://localhost:8000/`. List the URL parameters:
   `?lang=zh`, `?motion=reduce`, `?part=<id>&t=<ms>`.
4. **Build.** The `bundle.py` command, and the patch-script command with each flag explained.
5. **Test.** `cd qa && npm install`; point `CHROME_PATH` at the local Chrome (on a Mac,
   `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`); then the `lint.mjs` and `fidelity.py` commands.
6. **Rules.** The rules from `ledger.md` that a new contributor would break first: numbers as printed, the runs the
   tables used, simulations labelled, the glossary, the reader budgets, privacy.
7. **Not included.** Raw run data, the paper PDF, development screenshots [about 6 GB] and every key or internal
   address. Say whom to ask for them.
8. **Preview.** The preview link, and who can open it (section 4).

Put the package date and a version line at the top, with what changed since the previous version ("v5: all text
synced to the final paper; figure and table numbers renumbered"). Keep folder and file names stable across versions.
If a name is historical, say so once instead of renaming it.

**The author checklist**

`docs/authors.md` lists what only the authors can settle: places where the paper disagrees with itself or
with the runs, and decisions still open. These notes never reach the page, not even its source (R13). The page
shows what the paper prints; the checklist tells the authors what to fix in the next paper version.

**Zip and test the zip**

```sh
cd .. && zip -rq <project>-playme-<date>.zip <project>-playme -x '*/node_modules/*' '*/.DS_Store'
unzip -l <project>-playme-<date>.zip | tail -n 1
```

Unzip the archive into an empty folder and open `site/PLAYME.html` from there. That copy is the one colleagues get.

## 4 Preview and review

- Publish a private preview link early, the same day as the brief if you can. A claude.ai artifact stays private
  until its owner shares it from the page's share menu; tell reviewers this, or they cannot open the link. The build
  without `--offline` suits an artifact: it is smaller, and three.js loads from jsDelivr.
- Send the single file as well, for reviewers who want the page on their own computer.
- Collect feedback in numbered rounds (R2.1, R2.2, …). Write each comment into `ledger.md`, apply its rule everywhere,
  publish the next version to the same link with a version label, and reply in the reviewers' own numbering.

The protocol, the first-preview checklist and the OpenGCUA ledger are in `references/review-loop.md`.

## 5 Promote from the lab itself (R18)

Every visual in the promo comes from the lab's own players: the GIF, the video, the cover and the long image. The
captures show exactly what a reader gets after clicking the link. The OpenGCUA authors asked for promo images of
higher quality than the earlier AI-generated ones; real captures of the running lab met that request.

**Deterministic captures**

```sh
node scripts/capture.mjs --url http://127.0.0.1:8841/PLAYME.html --part read-or-play --fps 30 --width 1200 \
     --out promo/frames/read-or-play
```

`capture.mjs` seeks the part's player to each frame time with `PM.players[id].seek(t)` and screenshots the stage. No
frame depends on wall-clock time, so every run gives the same frames. (An earlier approach clicked Play and waited
14–32 s of real time per still; it was slow, and the moment it caught depended on timing.) Two rules for captures:

- Anything that moves with a CSS transition, CSS animation or `element.animate()` is not on the player's clock and
  comes out wrong in captures. Move everything through `ctx.tween`.
- Hide hints meant for live readers (the orbit hint, the zoom buttons) before capturing. Capture stills at device
  scale 2.

**GIF for the README and group chats**

```sh
pal="fps=12,scale=540:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p]"
pal="$pal;[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle"
ffmpeg -y -framerate 30 -pattern_type glob -i 'promo/frames/read-or-play/*.png' -vf "$pal" -loop 0 assets/demo.gif
```

A GIF plays by itself in a README and in a group chat. Use one part for about 12 s, at 12 fps and 540 px wide
[OpenGCUA: the 3D teardown, 4.7 MB]. `capture.mjs --gif` and `--mp4` run ffmpeg for you; call ffmpeg yourself when
you need these settings.

**MP4 for social video**

About 30 s in five segments: title card → two or three lab captures → numbers card → end card.

| Segment | Length | Content |
|---|---|---|
| Title card | 2.6 s | project name, one-line claim, a slow push-in |
| Lab captures (2–3) | about 23 s together | each capture overlaid on a card with an eyebrow and a headline |
| Numbers card | 3.2 s | three numbers from the paper, each with a label |
| End card | 3.6 s | what the reader can try in the lab, and the link |

- Sizes: 1080×1440 portrait for WeChat and Channels, 1600×900 for X/Twitter. Build the cards at the final size.
- Cards are HTML pages in the site's tokens, screenshotted to PNG. A still card gets a slow zoom
  (`zoompan=z='1+0.025*on/78':…:d=1:s=1080x1440:fps=30` for 78 frames). A capture goes on top of its looped card
  image (`-loop 1`) with `overlay=…:shortest=1`, so the segment ends with the last frame.
- Join the segments with 0.4 s `xfade` cross-fades. Each offset is the sum of the previous durations minus 0.4 s per
  join. Fade in from black over 0.4 s.
- Encode with `-c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -r 30 -movflags +faststart`. The last flag lets
  the video start playing before it has fully downloaded.
- Check the result without watching it: extract one still per segment
  (`ffmpeg -ss 13 -i promo.mp4 -frames:v 1 chk-13.png`) and look at each one.

**Cover, long image and social preview**

- Build each one as an HTML page at its final size, using the site's tokens and colour roles (`references/visual.md`).
  Screenshot it with headless Chromium at device scale 2.
- **Cover** (1080×1440): wordmark, one headline, a hero capture from the lab, a strip of three numbers, one line that
  invites the reader into the lab. Deliver PNG and JPG.
- **Long image** (1080 px wide): one section per highlight, each with an eyebrow, a headline and one lab capture.
  Chromium captures taller than about 8,192 device pixels can tile or fail, so capture it in parts with `clip`. Chat
  apps downscale very tall images, so the parts also travel better [3 parts at 1.5×].
- Posters may use full local fonts, Chinese included: they ship as pixels, so font size does not matter.
- **GitHub social preview** (1280×640, under 1 MB): set it under Settings → General → Social preview. Keep the text
  inside the central area, because some sites crop the edges.

**Group-chat post**

Write three lengths: a full post for technical and partner groups, a short post (three bullets and the links) as the
first message or for many groups, and one sentence for forwards and Moments. The full post has this structure:

1. **Hook line**: the project name and what it does, in one sentence.
2. **4–6 numbered highlights.** Each has a title that names the mechanism, one plain sentence, and one number from the
   paper.
3. **The interactive-lab line**: how many labs and parts, what the reader does in them (take a Mac apart in 3D, run
   four methods side by side), the languages, and that it opens on a phone.
4. **Links**: paper, lab, code. Use visible placeholders (【链接】) until the real links exist.

Write the Chinese post natively; write the English post for X separately. Never state user counts, stars or anything
the paper and the lab do not show.

**Number provenance**

Add a table under the copy and fill one row for every number in every promo item: the post, the cards, the cover and
the long image.

| Claim in the promo | Number as printed | Source |
|---|---|---|
| mean score gain over the baseline, all models | +X.Y | Abstract; §1; Table 2 |
| labs and playable parts | 7 labs, 18 parts | the lab itself |

Print each number as the paper prints it. When the paper changes, check every row again; the OpenGCUA copy was
rewritten against the final paper version.

**Channel tips**

- **Order in a group chat.** Send the video first (or the cover): a video plays inside the chat and gets the first
  look. Then send the text with its links. Then send the long image as an original (「原图」), so the app does not
  compress it. Send the lab link again when someone asks, with the hint "open it on a computer; drag to rotate the 3D
  view".
- **The lab as an H5 page.** The lab is the strongest promo: a reader can play it at once. Host a fast mirror where
  the audience is (GitHub Pages can be slow in mainland China; add a copy on a domestic CDN or object storage). Give
  the page a link card: `<title>`, `<meta name="description">` and `og:image` with an absolute URL (the cover works).
  Some apps, WeChat among them, show a custom thumbnail only through their own SDK.
- **AI audio explainer.** A five-minute conversation between two voices about the paper (a script of about 1,500
  Chinese characters, voiced with TTS) suits listeners on the move. Post it as audio or as a short video.
- **A quiz question.** Ask one multiple-choice question whose answer is a paper number the lab replays. The answer
  sends readers to the paper; the lab lets them watch it.
- **A live demo.** A 15-minute stream walks through the lab, one lab per paper section, dragging the scrubber and
  rotating the 3D view live. Cut the recording into one-minute clips afterwards.
