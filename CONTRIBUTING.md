# Contributing to PLAYME

Thanks for helping. PLAYME has three kinds of content, and each has its own bar.

## 1. Rules and references (`skills/playme/SKILL.md`, `references/`)

A new rule needs evidence: a real review comment, a reader study, or a before/after where the change made a part
easier to understand. Add the evidence to `references/review-loop.md` (or link it) in the same pull request.
Write in plain English: one idea per sentence, no slogans (see `references/words.md`). Keep `SKILL.md` under 500 lines;
put detail into a reference file.

## 2. The kit (`skills/playme/kit/`)

- Plain classic scripts on `window.PM`, no build step, no runtime dependencies (three.js is loaded on demand).
- Every animation goes through the player's virtual clock (`ctx.sleep`, `ctx.tween`), so seeking, reduced motion and
  frame capture keep working.
- Selectors stay under `.pm`; class names start with `pm-`.
- Update `references/kit.md` and the matching `kit/demo*.html` with every API change.

## 3. Patterns and examples

A new pattern needs: the claim type it serves, a working demo built with the kit, and a section in
`references/patterns.md` (question, scene at rest, the one action, marks, outcome, folds, pitfalls, kit sketch).

## Before you open a pull request

```bash
python3 -m http.server 8000                                  # from the repository root
node skills/playme/scripts/lint.mjs --url http://127.0.0.1:8000/site/index.html --langs en,zh
python3 skills/playme/scripts/bundle.py site/index.html -o /tmp/playme.html --offline
```

`lint.mjs` must pass (reader budgets, no overflow, no console errors). The browser checks need `puppeteer`
(`npm i -D puppeteer`) or `puppeteer-core` with `CHROME_PATH` set.

## Code of conduct

Be kind and specific. Review the work, not the person.
