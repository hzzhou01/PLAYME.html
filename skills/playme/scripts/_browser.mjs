// Shared helpers for lint.mjs and capture.mjs: find a browser, launch it, serve local files, collect page errors.
//
// Browser resolution (first match wins):
//   1. the `puppeteer` package (it ships its own Chrome; CHROME_PATH still overrides it), then
//   2. the `puppeteer-core` package + a Chrome/Chromium executable: $CHROME_PATH, $PUPPETEER_EXECUTABLE_PATH, or a
//      common install path (Linux, macOS, Windows).
// Packages are looked up from the current directory, from this script's directory and from $NODE_PATH, so the
// scripts also run straight out of the skill folder:  NODE_PATH=/path/to/node_modules node lint.mjs …
// Nothing is installed automatically; when neither package is found the error says what to run.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));

// WebGL in headless Chrome (three.js layers) needs SwiftShader; these flags are harmless with a real GPU.
export const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--hide-scrollbars'];

const CHROME_PATHS = [
  '/usr/bin/chromium-browser', '/usr/bin/chromium', '/snap/bin/chromium', '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/* ----------------------------------------------------------------------------- puppeteer */

function tryRequire(name) {
  const bases = [path.join(process.cwd(), 'noop.js'), path.join(HERE, 'noop.js'), import.meta.url];
  for (const base of bases) {
    try {
      // a CJS require resolves node_modules upwards from `base` and also honours NODE_PATH (ESM import does not)
      return createRequire(base)(name);
    } catch (err) {
      if (err && err.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  return null;
}

/** loadPuppeteer() → {puppeteer, flavor: 'puppeteer'|'puppeteer-core'}. Throws a readable Error when neither exists. */
export function loadPuppeteer() {
  for (const flavor of ['puppeteer', 'puppeteer-core']) {
    const mod = tryRequire(flavor);
    if (mod) return { puppeteer: mod.default && mod.default.launch ? mod.default : mod, flavor };
  }
  throw new Error('PLAYME scripts need a headless Chrome driver and none was found.\n'
    + '  Install one in your project:   npm i -D puppeteer        (downloads its own Chrome)\n'
    + '  or, with Chrome installed:      npm i -D puppeteer-core   and set CHROME_PATH=/path/to/chrome\n'
    + '  (or point NODE_PATH at a node_modules folder that already has one).');
}

/** chromePath() → an executable path or null: $CHROME_PATH, $PUPPETEER_EXECUTABLE_PATH, then common locations. */
export function chromePath() {
  for (const p of [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH]) if (p) return p;
  return CHROME_PATHS.find((p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } }) || null;
}

/** launch({args?, headless?}) → Browser. Adds --no-sandbox when running as root or in CI (Chrome refuses otherwise). */
export async function launch(opts = {}) {
  const { puppeteer, flavor } = loadPuppeteer();
  const exe = chromePath();
  if (flavor === 'puppeteer-core' && !exe) {
    throw new Error('puppeteer-core is installed but no Chrome/Chromium was found.\n'
      + '  Set CHROME_PATH=/path/to/chrome, or install the full package: npm i -D puppeteer');
  }
  const args = [...LAUNCH_ARGS, ...(opts.args || [])];
  const root = typeof process.getuid === 'function' && process.getuid() === 0;
  if (root || process.env.CI || process.env.PM_NO_SANDBOX) args.push('--no-sandbox');
  const launchOpts = { headless: opts.headless ?? 'new', args };
  if (exe && (flavor === 'puppeteer-core' || process.env.CHROME_PATH)) launchOpts.executablePath = exe;
  return puppeteer.launch(launchOpts);
}

/* ----------------------------------------------------------------------------- args */

/** parseArgs(argv, {flags:[names of boolean options]}) → {_: positional[], key: value}. --a-b → aB; --k=v and --k v. */
export function parseArgs(argv, { flags = [] } = {}) {
  const out = { _: [] };
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
    const key = camel(name);
    if (eq > 0) out[key] = a.slice(eq + 1);
    else if (flags.includes(name) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

export const list = (v, d = []) => (v === undefined || v === true ? d : String(v).split(',').map((s) => s.trim()).filter(Boolean));

/* ----------------------------------------------------------------------------- static server */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
};

/** serveDir(root) → Promise<{base, close()}>. A tiny read-only static server on 127.0.0.1 (random port). */
export function serveDir(root) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); res.end(); return; }
    let file = path.resolve(root, '.' + rel);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (_) { /* 404 below */ }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store' });
      res.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      base: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => server.close(() => r())),
    }));
  });
}

// Local paths a page refers to (src / href, plus url() in its local stylesheets), so the server root can include
// "../kit/playme.js"-style references. Returns absolute paths.
function localRefs(htmlFile) {
  const dir = path.dirname(htmlFile);
  const refs = [];
  // root-relative paths ("/img/a.png") depend on the site root, which only --root can tell; they are skipped here
  const isLocal = (u) => u && !/^([a-z][\w+.-]*:|\/|#)/i.test(u);
  let html = '';
  try { html = fs.readFileSync(htmlFile, 'utf8'); } catch (_) { return refs; }
  for (const m of html.matchAll(/\b(?:src|href)\s*=\s*(["'])([^"']+)\1/gi)) {
    const u = m[2].split(/[?#]/)[0];
    if (!isLocal(u)) continue;
    const abs = path.resolve(dir, u);
    refs.push(abs);
    if (abs.endsWith('.css')) {
      try {
        for (const c of fs.readFileSync(abs, 'utf8').matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
          if (isLocal(c[2])) refs.push(path.resolve(path.dirname(abs), c[2].split(/[?#]/)[0]));
        }
      } catch (_) { /* missing stylesheet: the page will report it */ }
    }
  }
  return refs;
}

function commonDir(paths) {
  let parts = path.resolve(paths[0]).split(path.sep);
  for (const p of paths.slice(1)) {
    const q = path.resolve(p).split(path.sep);
    let i = 0;
    while (i < parts.length && i < q.length && parts[i] === q[i]) i++;
    parts = parts.slice(0, i);
  }
  return parts.join(path.sep) || path.sep;
}

/**
 * openTarget(input, {root?, file?: boolean}) → Promise<{url, close(), served: root|null, file: path|null}>
 * input: an http(s) URL, a file:// URL or a local path. A local path is served over http from the smallest directory
 * that holds the page and every local file it refers to (or `root`), unless `file` is true (then a file:// URL).
 */
export async function openTarget(input, { root = null, file = false } = {}) {
  if (/^https?:\/\//i.test(input)) return { url: input, close: async () => {}, served: null, file: null };
  const abs = path.resolve(input.startsWith('file://') ? fileURLToPath(input) : input);
  if (!fs.existsSync(abs)) throw new Error(`page not found: ${abs}`);
  const page = fs.statSync(abs).isDirectory() ? path.join(abs, 'index.html') : abs;
  if (file) return { url: pathToFileURL(page).href, close: async () => {}, served: null, file: page };
  const serveRoot = root ? path.resolve(root) : commonDir([path.dirname(page), ...localRefs(page).map((p) => path.dirname(p))]);
  const srv = await serveDir(serveRoot);
  const rel = path.relative(serveRoot, page).split(path.sep).map(encodeURIComponent).join('/');
  return { url: `${srv.base}/${rel}`, close: srv.close, served: serveRoot, file: page };
}

/** withQuery(url, {k: v}) → url with the query parameters set (keeps the hash). */
export function withQuery(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.href;
}

/* ----------------------------------------------------------------------------- collectors */

const IGNORED = /\/favicon\.ico(\?|$)/i;

/** collect(page) → {take(), peek()}: console errors / warnings, page errors and failed requests since the last
 * take(). take() is async: console messages that carry objects (console.error('x', err)) are formatted first. */
export function collect(page) {
  const fresh = () => ({ errors: [], warnings: [], pageErrors: [], failedRequests: [] });
  let bucket = fresh();
  let pending = [];
  page.on('console', (m) => {
    const type = m.type();
    if (!['error', 'assert', 'warning', 'warn'].includes(type)) return;
    const loc = m.location && m.location();
    if (loc && loc.url && IGNORED.test(loc.url)) return;
    const where = loc && loc.url ? `  (${short(loc.url)}${loc.lineNumber != null ? ':' + (loc.lineNumber + 1) : ''})` : '';
    const list = type === 'error' || type === 'assert' ? bucket.errors : bucket.warnings;
    const i = list.push(m.text() + where) - 1;
    if (m.text().includes('JSHandle@')) {
      // "JSHandle@error" says nothing: ask the page for the message of each object argument
      pending.push(Promise.all(m.args().map((a) => a.evaluate((v) => (v instanceof Error ? `${v.name}: ${v.message}` : typeof v === 'object' ? JSON.stringify(v) : String(v))).catch(() => '?')))
        .then((parts) => { list[i] = parts.join(' ') + where; }).catch(() => {}));
    }
  });
  page.on('pageerror', (e) => bucket.pageErrors.push(String(e && e.message ? e.message : e)));
  page.on('requestfailed', (r) => {
    if (IGNORED.test(r.url())) return;
    bucket.failedRequests.push(`${short(r.url())} ${(r.failure() && r.failure().errorText) || ''}`.trim());
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED.test(r.url())) bucket.failedRequests.push(`${short(r.url())} HTTP ${r.status()}`);
  });
  return {
    async take() { await Promise.all(pending); pending = []; const b = bucket; bucket = fresh(); return b; },
    peek: () => bucket,
  };
}

export function short(u) {
  if (u.startsWith('data:')) return 'data:…';
  if (u.startsWith('blob:')) return 'blob:…';
  try {
    const x = new URL(u);
    if (x.protocol === 'file:') return path.basename(x.pathname);
    return x.hostname === '127.0.0.1' || x.hostname === 'localhost' ? x.pathname + x.search : x.href;
  } catch (_) { return u; }
}

/** Wait for fonts, pending (non-lazy) images and two animation frames; then `settle` ms. */
export async function settle(page, ms = 400) {
  try {
    await page.evaluate(async () => {
      const deadline = performance.now() + 4000;
      const imgs = [...document.images].filter((i) => !i.complete && i.loading !== 'lazy');
      await Promise.race([
        Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))),
        new Promise((r) => setTimeout(r, Math.max(0, deadline - performance.now()))),
      ]);
      if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
  } catch (_) { /* navigation in progress */ }
  await sleep(ms);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------------------- output */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = { red: paint('31'), green: paint('32'), yellow: paint('33'), dim: paint('2'), bold: paint('1'), cyan: paint('36') };

/** table(rows, {color?: (cell, rowIndex, colIndex) → string}) → string. rows[0] is the header. */
export function table(rows, { color } = {}) {
  const strip = (s) => String(s ?? '');
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => strip(r[i]).length)));
  const fmt = (r, ri) => r.map((v, i) => {
    const s = strip(v);
    const padded = i === r.length - 1 ? s : s.padEnd(widths[i]);
    return color ? color(padded, ri, i, s) : padded;
  }).join('  ').trimEnd();
  return [fmt(rows[0], 0), c.dim(widths.map((w) => '─'.repeat(w)).join('  ')), ...rows.slice(1).map((r, i) => fmt(r, i + 1))].join('\n');
}

export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }

export function writeJson(file, data) {
  ensureDir(path.dirname(path.resolve(file)));
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
