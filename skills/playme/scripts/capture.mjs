#!/usr/bin/env node
// capture.mjs — frame-exact capture of one PLAYME part, for GIFs, videos and covers made from the lab itself (R18).
//
//   node capture.mjs --url <page> --part <id> --out frames/ [--mp4 out.mp4] [--gif out.gif]
//     --fps 30            frames per second of the story clock (default 30)
//     --width 1200        viewport width in CSS px (default 1200); --height 900; --dpr 1 (2 for crisp video)
//     --lang en|zh        page language (?lang=…)
//     --from 0 --to <ms>  part of the story to capture (default: all of it, PM.players[id].duration)
//     --hold 1200         keep the last frame on screen this long (ms) so loops can be read (default 1200)
//     --select <css>      element to film, inside the part (default: the part's .pm-stage)
//     --gif-width 800     GIF width in px (default: the frame width, at most 960); --gif-fps 15 (default)
//     --at <ms> --png f   one still frame at that moment instead (covers, social previews)
//     --css "<rules>"     extra CSS for the capture (e.g. hide a cursor hint)
//     --keep-fixed        keep fixed / sticky page chrome (by default it is hidden so it never covers the stage)
//     --root <dir>        server root when <page> is a local file (see lint.mjs)
//
// How: the kit's player runs on a virtual clock. The script calls PM.players[id].setManual(true), seek(0), play(),
// then advance(1000 / fps) before every screenshot, so each frame is the exact story moment t = i / fps, however
// slow the machine is. A player without a manual clock is captured with seek(t) per frame instead (paused).
// Frames: <out>/f00000.png … plus <out>/frames.json; ffmpeg (libx264 yuv420p MP4; palettegen/paletteuse GIF) when
// --mp4 / --gif are given. Exit codes: 0 ok · 1 capture failed · 2 usage error.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch, parseArgs, openTarget, withQuery, collect, settle, c, ensureDir } from './_browser.mjs';

const USAGE = `usage: node capture.mjs --url <page> --part <id> --out frames/ [--fps 30] [--width 1200] [--lang en]
                         [--from ms] [--to ms] [--hold ms] [--mp4 out.mp4] [--gif out.gif] [--gif-width px]
       node capture.mjs --url <page> --part <id> --at <ms> --png still.png`;

const args = parseArgs(process.argv.slice(2), { flags: ['keep-fixed', 'help'] });
if (args.help) { console.log(USAGE); process.exit(0); }
const die = (msg, code = 2) => { console.error(c.red('error: ') + msg); if (code === 2) console.error(USAGE); process.exit(code); };
const input = typeof args.url === 'string' ? args.url : args._[0];
const partId = typeof args.part === 'string' ? args.part : null;
if (!input || !partId) die('give --url <page> and --part <id>');
const still = args.at !== undefined;
if (still && typeof args.png !== 'string') die('--at needs --png <file>');
if (!still && typeof args.out !== 'string') die('give --out <frames dir> (and optionally --mp4 / --gif)');
const num = (v, d) => (v === undefined || v === true ? d : Number(v));
const fps = num(args.fps, 30);
const width = num(args.width, 1200);
const height = num(args.height, 900);
const dpr = num(args.dpr, 1);
const hold = num(args.hold, 1200);
const lang = typeof args.lang === 'string' ? args.lang : 'en';
if (!(fps > 0 && fps <= 120) || !(width > 0) || !(dpr > 0)) die('--fps, --width and --dpr must be positive (fps ≤ 120)');
if ((args.mp4 || args.gif) && !hasFfmpeg()) die('--mp4 / --gif need ffmpeg on PATH (apt install ffmpeg / brew install ffmpeg)');

function hasFfmpeg() { return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0; }
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function ffmpeg(argv) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
}
const human = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);

let target;
try { target = await openTarget(input, { root: typeof args.root === 'string' ? args.root : null }); } catch (e) { die(e.message); }
let browser;
try { browser = await launch(); } catch (e) { await target.close(); die(e.message, 1); }
let code = 0;
try {
  const page = await browser.newPage();
  const bucket = collect(page);
  await page.setViewport({ width, height, deviceScaleFactor: dpr });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  await page.evaluateOnNewDocument((l) => { try { localStorage.setItem('pm-lang', l); } catch (_) { /* blocked */ } }, lang);
  await page.goto(withQuery(target.url, { lang }), { waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await page.evaluate((l) => { if (window.PM && PM.setLang && PM.lang && PM.lang() !== l) PM.setLang(l); }, lang).catch(() => {});
  await settle(page, 400);

  // the part, its player, the element to film
  const found = await page.evaluate((id) => {
    const part = document.querySelector(`[data-pm-part="${CSS.escape(id)}"]`) || document.getElementById(id);
    if (!part) return { error: 'part not found' };
    part.scrollIntoView({ block: 'center' });
    return { players: window.PM && PM.players ? Object.keys(PM.players) : null };
  }, partId);
  if (found.error) throw new Error(`no part "${partId}" on the page (looked for [data-pm-part="${partId}"] and #${partId})`);
  try {
    await page.waitForFunction((id) => window.PM && PM.players && PM.players[id] && PM.players[id].duration > 0, { timeout: 10000, polling: 100 }, partId);
  } catch (_) {
    const have = await page.evaluate(() => (window.PM && PM.players ? Object.keys(PM.players) : []));
    throw new Error(`PM.players["${partId}"] has no duration after 10 s (players on the page: ${have.join(', ') || 'none'})`);
  }
  const info = await page.evaluate((id, sel, keepFixed, css) => {
    const part = document.querySelector(`[data-pm-part="${CSS.escape(id)}"]`) || document.getElementById(id);
    const el = sel ? part.querySelector(sel) : part.querySelector('.pm-stage') || part;
    if (!el) return { error: `no element "${sel}" in the part` };
    el.setAttribute('data-pm-capture', '');
    if (!keepFixed) {
      // fixed / sticky chrome outside the part (top bars, toasts) would cover the stage in some frames
      for (const x of document.body.querySelectorAll('*')) {
        if (part.contains(x) || x.contains(part)) continue;
        const pos = getComputedStyle(x).position;
        if (pos === 'fixed' || pos === 'sticky') x.style.setProperty('visibility', 'hidden', 'important');
      }
    }
    // the stage bar is sticky on the page; in a capture it stays at the top of the stage
    document.head.append(Object.assign(document.createElement('style'), { textContent: '.pm .pm-stage > .pm-bar { position: relative !important; top: auto !important; }' }));
    if (css) document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
    const p = PM.players[id];
    return { manual: typeof p.setManual === 'function' && typeof p.advance === 'function', duration: p.duration,
      marks: (p.marks || []).map((m) => ({ t: Math.round(m.t ?? m.time ?? 0), label: String(m.label ?? m.text ?? '') })),
      h: Math.ceil(el.getBoundingClientRect().height) };
  }, partId, typeof args.select === 'string' ? args.select : null, !!args.keepFixed, typeof args.css === 'string' ? args.css : '');
  if (info.error) throw new Error(info.error);
  if (info.h + 40 > height) await page.setViewport({ width, height: info.h + 40, deviceScaleFactor: dpr });
  await page.mouse.move(0, 0);
  await page.evaluate(() => {
    const el = document.querySelector('[data-pm-capture]');
    const r = el.getBoundingClientRect();
    window.scrollBy(0, r.top - Math.max(0, (innerHeight - r.height) / 2));
  });
  await settle(page, 300);
  const el = await page.$('[data-pm-capture]');
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const shoot = async (file) => {
    await page.evaluate(frame);
    await el.screenshot({ path: file });
  };

  const duration = info.duration;
  const from = Math.max(0, num(args.from, 0));
  const to = Math.min(num(args.to, duration), duration);
  if (still) {
    const at = Math.max(0, Math.min(Number(args.at), duration));
    await page.evaluate(async (id, t) => {
      const p = PM.players[id];
      if (p.setManual) p.setManual(true);
      await p.seek(0); await p.play(); await new Promise((r) => setTimeout(r, 0));
      if (p.advance) { for (let x = 0; x < t; x += 50) { await p.advance(Math.min(50, t - x)); await new Promise((r) => setTimeout(r, 0)); } } else { p.pause(); await p.seek(t); }
    }, partId, at);
    ensureDir(path.dirname(path.resolve(args.png)));
    await shoot(path.resolve(args.png));
    const s = pngSize(path.resolve(args.png));
    console.log(`${c.green('still')} ${partId} at ${at} ms → ${args.png} (${s.w}×${s.h})`);
  } else {
    const out = ensureDir(path.resolve(args.out));
    for (const f of fs.readdirSync(out)) if (/^f\d{5}\.png$/.test(f)) fs.unlinkSync(path.join(out, f));
    const dt = 1000 / fps;
    const n = Math.max(1, Math.floor((to - from) / dt) + 1);
    const holdN = Math.round(hold / dt);
    const mode = info.manual ? 'manual clock' : 'seek per frame';
    process.stdout.write(`capturing ${partId}: ${n} frames (${from}–${Math.round(to)} ms at ${fps} fps, ${mode})${holdN ? ` + ${holdN} held` : ''} `);
    if (info.manual) {
      await page.evaluate(async (id, start) => {
        const p = PM.players[id];
        p.setManual(true);
        await p.seek(0); await p.play(); await new Promise((r) => setTimeout(r, 0));
        for (let x = 0; x < start; x += 50) { await p.advance(Math.min(50, start - x)); await new Promise((r) => setTimeout(r, 0)); }
      }, partId, from);
    } else {
      await page.evaluate(async (id) => { const p = PM.players[id]; await p.seek(0); p.pause(); }, partId);
    }
    for (let i = 0; i < n; i++) {
      if (!info.manual) await page.evaluate(async (id, t) => { await PM.players[id].seek(t); }, partId, from + i * dt);
      await shoot(path.join(out, `f${String(i).padStart(5, '0')}.png`));
      if (info.manual && i < n - 1) await page.evaluate(async (id, ms) => { await PM.players[id].advance(ms); await new Promise((r) => setTimeout(r, 0)); }, partId, dt);
      if (i % Math.max(1, Math.round(fps)) === 0) process.stdout.write('.');
    }
    for (let k = 0; k < holdN; k++) fs.copyFileSync(path.join(out, `f${String(n - 1).padStart(5, '0')}.png`), path.join(out, `f${String(n + k).padStart(5, '0')}.png`));
    if (info.manual) await page.evaluate((id) => PM.players[id].setManual(false), partId);
    const total = n + holdN;
    const first = pngSize(path.join(out, 'f00000.png'));
    const last = pngSize(path.join(out, `f${String(total - 1).padStart(5, '0')}.png`));
    console.log(` ${c.green('done')}`);
    if (first.w !== last.w || first.h !== last.h) console.log(c.yellow(`! frame size changed during the run (${first.w}×${first.h} → ${last.w}×${last.h}); the stage height should not move`));
    fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify({ part: partId, lang, fps, from, to: Math.round(to), duration: Math.round(duration),
      frames: total, held: holdN, size: first, dpr, mode, marks: info.marks }, null, 2) + '\n');
    console.log(`frames  ${total} × ${first.w}×${first.h} → ${out}`);
    const pattern = path.join(out, 'f%05d.png');
    if (args.mp4) {
      ensureDir(path.dirname(path.resolve(args.mp4)));
      ffmpeg(['-framerate', String(fps), '-i', pattern, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow',
        '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-movflags', '+faststart', path.resolve(args.mp4)]);
      console.log(`mp4     ${args.mp4} (${human(fs.statSync(args.mp4).size)})`);
    }
    if (args.gif) {
      ensureDir(path.dirname(path.resolve(args.gif)));
      const gw = Math.round(num(args.gifWidth, Math.min(first.w, 960)));
      const gf = num(args.gifFps, Math.min(15, fps));
      ffmpeg(['-framerate', String(fps), '-i', pattern, '-vf',
        `fps=${gf},scale=${gw}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        '-loop', '0', path.resolve(args.gif)]);
      console.log(`gif     ${args.gif} (${human(fs.statSync(args.gif).size)}, ${gw} px wide, ${gf} fps)`);
    }
  }
  const errs = await bucket.take();
  const bad = [...errs.errors, ...errs.pageErrors];
  if (bad.length) {
    console.log(c.yellow(`! ${bad.length} console/page error${bad.length > 1 ? 's' : ''} during the capture:`));
    for (const e of bad.slice(0, 5)) console.log(c.dim('    ' + e.slice(0, 200)));
  }
} catch (e) {
  console.error(c.red('\nerror: ') + e.message);
  code = 1;
} finally {
  await browser.close().catch(() => {});
  await target.close();
}
process.exit(code);
