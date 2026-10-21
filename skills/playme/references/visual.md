# Visual identity

The authors' comment that started this file (R2.8): "The interactions are very cool, but the plain palette makes them
look plain at first glance." A PLAYME needs a visual identity as confident as its mechanisms. This file explains the
default look of the kit and how to make a page-specific identity on top of it.

## Contents

1. Principles
2. The default: a dark bench with light devices
3. Colour roles
4. Type
5. Affordance: what looks interactive
6. Motion
7. 3D
8. Phones
9. Embedding in a light homepage
10. Checklist

## 1 Principles

- **Derive the look from the subject.** Use the materials of the project's world: screens and windows for a
  computer-use agent, cells and plates for biology, waveforms for audio. A detail only this subject would have (real
  units, real coordinates, real file names) is worth more than any ornament.
- **Contrast between the page and the stage.** The page is quiet; the stage, where the mechanism runs, is the
  brightest thing on screen.
- **Colour carries meaning.** Each hue names a role (the agent, the person, the harness, success, error) and keeps that
  role on every part.
- **Avoid the generic AI-site look**: purple-to-blue gradient heroes on white, everything centred, emoji as section
  markers, identical rounded cards with shadows, a lone acid-green accent on black. Choose deliberately.

## 2 The default: a dark bench with light devices

The kit's default theme is a dark "lab bench": near-black blue backgrounds, faint dot grid, glass panels with hairline
borders. Devices on the bench (Mac desktops, browsers, phones, spreadsheets) keep their real light appearance, so they
glow like real screens on a dark desk. This contrast does three jobs: it makes the stage the focal point, it makes the
simulated screens recognisable, and it lets semantic colours (violet agent, amber person, cyan harness) read clearly.

Override the look through tokens on `.pm` (`--pm-bg`, `--pm-accent`, fonts, radii). Do not restyle components with
literal colours.

## 3 Colour roles

| Token | Default | Role |
|---|---|---|
| `--pm-accent` | cyan `#5EEAFF` | live state, focus ring, scrubber fill, the harness |
| `--pm-play` | near-white `#F3F4FA` | the primary button (brightest object, dark text, cyan glow) |
| `--pm-agent` | violet `#A98BFF` | the model / agent and its pointer |
| `--pm-user` | amber `#FFB454` | the person at the computer and their pointer |
| `--pm-ok` | green `#45E3A2` | confirmed effect |
| `--pm-err` | coral `#FF6378` | wrong effect, error |
| `--pm-warn` | yellow `#FFD25E` | the moment something changes |
| `--pm-paper` | warm off-white `#ECE5D4` | static "presentation" material (a README, a paper figure) |

Keep semantic colours separate from the accent. A green button that means "Play" next to a green tick that means
"confirmed" confuses both.

## 4 Type

- A characterful display face for part questions and the page title, used large and tight.
- A plain, highly legible sans for body text (about 16 px, line height 1.6, measure about 65 characters).
- A monospace face for code, labels, timecodes and numbers; `font-variant-numeric: tabular-nums` wherever digits change.
- Chinese: keep the same scale, fall back to PingFang SC / Noto Sans SC / Microsoft YaHei, turn off uppercase and
  letter-spacing on labels, use full-width punctuation.
- Inline subset fonts (woff2, data URI) so the offline file looks the same everywhere.

## 5 Affordance: what looks interactive

The reader must be able to tell controls from labels at a glance (R5).

| Element | Looks like |
|---|---|
| Primary action | a bright pill with a play glyph and a soft glow; one per part |
| Options (segmented, toggle) | clearly bordered controls with a visible selected state |
| In-scene targets (a layer, a window, a tile) | hover glow, pointer cursor, focus ring; a one-line hint near the scene |
| Folds | a chevron in a ring + title + teaser; the whole row is the target |
| Source line, provenance, status, model names | flat text with at most a small glyph, never a box |

## 6 Motion

- Motion explains: a pointer travels, a packet moves down a stack, a counter ticks, the moment of change flashes.
- Every meaningful motion runs on the player's virtual clock (`ctx.tween`), so it can be scrubbed, captured and skipped
  under reduced motion. CSS transitions are polish only; the kit disables them while seeking.
- Hold the key frame. After an important event, pause 600-1200 ms with the narration on screen.
- Respect `prefers-reduced-motion`: Play jumps to the end state and the narration becomes a list.

## 7 3D

Use 3D only when depth carries meaning: layers that sit on top of each other (a screen and its accessibility tree, a
page and its data), or a stack of components. Then:

- Let readers orbit freely by dragging; zoom with pinch or Ctrl/⌘ + wheel so normal scrolling still scrolls the page.
- Provide a reset-view control in a corner of the scene once the camera has moved.
- Physical order and reveal order can differ: in OpenGCUA the translucent accessibility layer sits above the
  screenshot so the screenshot shows through, while the guided tour still starts at the screenshot (R7.3).
- Every layer stays visible and labelled in every view (R8).
- Provide a 2D fallback with the same content when WebGL is unavailable.

## 8 Phones

At 400 px: the bar wraps (primary first, scrubber on its own full-width row), side-by-side comparisons become 2x2 or
stacked with the same clock, code panes keep both-axis scrolling, 3D scenes keep touch orbit with vertical swipes
scrolling the page. No horizontal page overflow. Never put `word-break: keep-all` on Chinese headings: a heading
without spaces then cannot wrap and pushes the page sideways on a phone; use `line-break: strict` instead. Grid
and flex children that hold code or long words need `min-width: 0`.

## 9 Embedding in a light homepage

A dark lab can sit inside a light homepage as a full-bleed band. Keep the host's header, fonts and language toggle;
scope every kit selector under `.pm`; keep popovers below the host's sticky header. See `ship-and-promote.md`.

## 10 Checklist

- [ ] The first screen shows a live stage, not a wall of text.
- [ ] One hue per role, the same on every part.
- [ ] The primary button is the brightest object in each part.
- [ ] Nothing non-interactive has a border, fill or pill shape.
- [ ] Devices look like real devices.
- [ ] Fonts are inlined; Chinese text has a proper fallback.
- [ ] Reduced motion works; no meaning depends on a CSS transition.
