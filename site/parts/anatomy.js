/* Part 'anatomy' (Lab 03) of the PLAYME homepage: what is inside one PLAYME part?
 *
 * The scene is an exploded 3D view (PM.layers3d) of this page's own Lab 01, frozen at 0:07, split into the eight layers
 * of the part template. Each layer is drawn on a canvas in its place on one shared frame, so the stack at rest
 * (explode 0) is the assembled part. The player's story runs on the kit's virtual clock: "Take it apart" separates the
 * stack (an explode tween snapped every frame, so it scrubs), then lifts one layer at a time (view.focus) with one
 * caption and one mark each, and ends on a tighter stack where the two layers that run the mechanism stay bright. The
 * option swaps in a classic project page (six layers) built the same way; no layer of it runs the mechanism. Picking a
 * layer (sheet, label or number key) fills the inspector line under the view: rule, budget and the author comment that
 * produced it. This part is Lab 03 on the page. */
(function () {
  'use strict';
  const PM = window.PM;
  if (!PM || !window.PMSite || typeof PM.layers3d !== 'function') return;

  const B = (en, zh) => ({ en, zh });
  const FW = 1280;   // the shared frame of every layer, logical px
  const FH = 800;

  /* ================================================================ colours and fonts: the kit tokens, read once */

  let TK = null;
  function readTokens(el) {
    const cs = getComputedStyle(el);
    const g = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    return {
      bg: g('--pm-bg', '#07080E'), bg2: g('--pm-bg-2', '#0C0E18'), panel2: g('--pm-panel-2', 'rgba(28,32,52,.92)'),
      line: g('--pm-line', 'rgba(150,162,230,.14)'), line2: g('--pm-line-2', 'rgba(150,162,230,.28)'),
      hi: g('--pm-hi', '#F3F4FA'), tx: g('--pm-tx', '#B3B8CC'), mu: g('--pm-mu', '#767C93'),
      accent: g('--pm-accent', '#5EEAFF'), accent2: g('--pm-accent-2', '#2BB8FF'), play: g('--pm-play', '#F3F4FA'),
      agent: g('--pm-agent', '#A98BFF'), user: g('--pm-user', '#FFB454'), ok: g('--pm-ok', '#45E3A2'), err: g('--pm-err', '#FF6378'),
      paper: g('--pm-paper', '#ECE5D4'), ink: g('--pm-paper-ink', '#2A2620'),
      codeBg: g('--pm-code-bg', '#0A0C15'), codeInk: g('--pm-code-ink', '#D8DCEB'), codeLn: g('--pm-code-ln', '#61677F'),
      tkStr: g('--pm-tk-str', '#8FE3B4'), tkNum: g('--pm-tk-num', '#FFC27A'), tkFn: g('--pm-tk-fn', '#7FC8FF'),
      tkCom: g('--pm-tk-com', '#6D7390'), tkKey: g('--pm-tk-key', '#A9B0CC'),
      display: g('--pm-display', 'system-ui, sans-serif'), sans: g('--pm-sans', 'system-ui, sans-serif'),
      mono: g('--pm-mono', 'ui-monospace, monospace'),
    };
  }
  // A printed page wants a book face; the kit has none, so the project page uses the system serif.
  const SERIF = "Georgia, 'Times New Roman', 'Noto Serif CJK SC', 'Songti SC', serif";

  /** '#rrggbb' | 'rgb(…)' | 'rgba(…)' → [r, g, b, a] */
  function rgbOf(c) {
    const s = String(c).trim();
    let m = s.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let x = m[1];
      if (x.length <= 4) x = x.split('').map((d) => d + d).join('');
      const n = parseInt(x.slice(0, 6), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, x.length === 8 ? parseInt(x.slice(6), 16) / 255 : 1];
    }
    m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    return [128, 128, 128, 1];
  }
  /** a token colour at alpha a (multiplied with its own alpha) */
  const A = (c, a) => { const [r, g, b, a0] = rgbOf(c); return `rgba(${r},${g},${b},${+(a0 * a).toFixed(3)})`; };

  /* ================================================================ canvas helpers (logical px) */

  const zh = () => PM.lang() === 'zh';
  const tr = (en, cn) => PM.t(en, cn);

  function rr(c, x, y, w, h, r) {
    const R = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + R, y);
    c.arcTo(x + w, y, x + w, y + h, R);
    c.arcTo(x + w, y + h, x, y + h, R);
    c.arcTo(x, y + h, x, y, R);
    c.arcTo(x, y, x + w, y, R);
    c.closePath();
  }
  function setFont(c, o, size) {
    c.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${o.fam}`;
    if ('letterSpacing' in c) c.letterSpacing = o.ls ? `${o.ls}px` : '0px';
  }
  /** text(c, s, x, y, {size, weight, fam, color, align, max, min, ls, glow, blur, italic}) → width drawn */
  function text(c, s, x, y, o) {
    let size = o.size;
    c.textAlign = o.align || 'left';
    c.textBaseline = 'alphabetic';
    setFont(c, o, size);
    if (o.max) while (size > (o.min || 9) && c.measureText(s).width > o.max) { size -= 1; setFont(c, o, size); }
    c.fillStyle = o.color;
    if (o.glow) { c.save(); c.shadowColor = o.glow; c.shadowBlur = o.blur || 14; c.fillText(s, x, y); c.restore(); } else c.fillText(s, x, y);
    const w = c.measureText(s).width;
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    return w;
  }
  const CJK = /[⺀-鿿豈-﫿＀-￯]/;
  const NO_START = /^[，。、；：！？）」』》,.;:!?)\]]/;
  /** greedy line breaking with the current c.font; CJK breaks between characters, never before closing punctuation */
  function wrap(c, s, maxW) {
    const units = CJK.test(s) ? (s.match(/[A-Za-z0-9][\w.\-'’@/]*|\s+|[\s\S]/g) || []) : s.split(/(\s+)/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const u of units) {
      const next = cur + u;
      if (cur.trim() && !/^\s+$/.test(u) && !NO_START.test(u) && c.measureText(next.trimEnd()).width > maxW) {
        lines.push(cur.trimEnd());
        cur = u.trimStart();
      } else cur = next;
    }
    if (cur.trim()) lines.push(cur.trimEnd());
    return lines;
  }
  /** a wrapped paragraph; returns the baseline of its last line */
  function para(c, s, x, y, o) {
    setFont(c, o, o.size);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = o.color;
    const lines = wrap(c, s, o.w).slice(0, o.maxLines || 99);
    lines.forEach((ln, i) => c.fillText(ln, x, y + i * o.lh));
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    return y + (lines.length - 1) * o.lh;
  }
  /** a wrapped paragraph of styled runs [{s, color, mark?}] in one font: each run keeps its colour, a run with a mark gets
   * a marker highlight behind its text; returns the baseline of the last line */
  function richPara(c, segs, x, y, o) {
    setFont(c, o, o.size);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    const units = [];
    segs.forEach((sg, si) => {
      const us = CJK.test(sg.s) ? (sg.s.match(/[A-Za-z0-9][\w.\-'’@/]*|\s+|[\s\S]/g) || []) : sg.s.split(/(\s+)/).filter(Boolean);
      us.forEach((u) => units.push({ u, si }));
    });
    const blank = (q) => /^\s+$/.test(q.u);
    const widthOf = (arr) => c.measureText(arr.map((q) => q.u).join('').trimEnd()).width;
    const lines = [];
    let cur = [];
    for (const q of units) {
      if (cur.some((p) => !blank(p)) && !blank(q) && !NO_START.test(q.u) && widthOf(cur.concat(q)) > o.w) { lines.push(cur); cur = [q]; } else cur.push(q);
    }
    if (cur.length) lines.push(cur);
    lines.forEach((ln, i) => {
      while (ln.length && blank(ln[0])) ln.shift();
      while (ln.length && blank(ln[ln.length - 1])) ln.pop();
      const ly = y + i * o.lh;
      let px = x;
      for (let j = 0; j < ln.length;) {
        let k = j;
        let s = '';
        while (k < ln.length && ln[k].si === ln[j].si) { s += ln[k].u; k += 1; }
        const sg = segs[ln[j].si];
        const sw = c.measureText(s).width;
        if (sg.mark) { c.fillStyle = sg.mark; c.fillRect(px - 1, ly - o.size * 0.9, sw + 2, o.size * 1.25); }
        c.fillStyle = sg.color;
        c.fillText(s, px, ly);
        px += sw;
        j = k;
      }
    });
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    return y + (lines.length - 1) * o.lh;
  }
  function hline(c, x0, x1, y, color, w) { c.fillStyle = color; c.fillRect(x0, y, x1 - x0, w || 1); }
  function arrowPointer(c, x, y, fill, stroke, s) {
    c.save();
    c.translate(x, y);
    c.scale(s || 1, s || 1);
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0, 26); c.lineTo(6.6, 20); c.lineTo(11.4, 31); c.lineTo(16.4, 28.8); c.lineTo(11.8, 18.4); c.lineTo(20.5, 18.4);
    c.closePath();
    c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    c.fillStyle = fill; c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = 1.8; c.strokeStyle = stroke; c.stroke();
    c.restore();
  }
  function tag(c, s, x, y, fill, ink, size) {
    const z = size || 13;
    c.font = `700 ${z}px ${TK.sans}`;
    const w = c.measureText(s).width + z * 1.1;
    rr(c, x, y, w, z * 1.7, z * 0.45); c.fillStyle = fill; c.fill();
    text(c, s, x + z * 0.55, y + z * 1.2, { size: z, weight: 700, fam: TK.sans, color: ink });
  }
  function chevron(c, cx, cy, color) {
    c.beginPath(); c.moveTo(cx - 3, cy - 6); c.lineTo(cx + 3.5, cy); c.lineTo(cx - 3, cy + 6);
    c.lineWidth = 2.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = color; c.stroke();
  }
  /** a light macOS-style window (a simulated screen, so it may use real light-UI colours) */
  function macWindow(c, x, y, w, h, title, bar) {
    c.save();
    c.shadowColor = 'rgba(8,10,30,.45)'; c.shadowBlur = 26; c.shadowOffsetY = 10;
    rr(c, x, y, w, h, 10); c.fillStyle = '#FFFFFF'; c.fill();
    c.restore();
    c.save();
    rr(c, x, y, w, h, 10); c.clip();
    c.fillStyle = bar || '#ECECEF'; c.fillRect(x, y, w, 30);
    hline(c, x, x + w, y + 30, '#D3D4DA');
    [['#FF5F57', 0], ['#FEBC2E', 1], ['#28C840', 2]].forEach(([col, i]) => { c.beginPath(); c.arc(x + 16 + i * 18, y + 15, 5.5, 0, Math.PI * 2); c.fillStyle = col; c.fill(); });
    if (title) text(c, title, x + w / 2, y + 20, { size: 14, weight: 600, fam: TK.sans, color: '#3A3A3F', align: 'center' });
    c.restore();
    rr(c, x + 0.5, y + 0.5, w - 1, h - 1, 10); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.stroke();
  }

  /* ================================================================ the eight layers of a PLAYME part: Lab 01, taken apart
   * The part drawn is this page's own Lab 01 (read-or-play), frozen at 0:07, the moment its untargeted click lands. Its
   * words come from Lab 01's own bilingual DOM when Lab 01 is on the page, so the two cannot drift apart; the copies
   * here are the fallback. One frame (1280 × 800). Left: question, stage (bar, a scene with the README and PLAYME panes,
   * narration), source line. Right: outcome (readouts, takeaway), then folds. The progress bar and the code pane are their
   * own layers, under holes in the stage; the facts card lies under the stage, so the assembled part hides it. */

  const LAB = 'read-or-play';
  const AT = 7000;   // the frozen moment of Lab 01's story, ms
  /** a text of Lab 01: the i-th match of sel inside its part (data-l-en / data-l-zh), else the copy given here */
  function lab(sel, i, en, cn) {
    const root = document.getElementById(LAB);
    const el = root ? root.querySelectorAll(sel)[i] : null;
    const src = el && (el.hasAttribute('data-l-en') ? el : el.querySelector('[data-l-en]'));
    if (src) { const e = src.getAttribute('data-l-en'); return tr(e, src.getAttribute('data-l-zh') ?? e); }
    return tr(en, cn);
  }
  /** Lab 01's timeline as fractions of its duration: from its player once measured, else the values measured for this */
  function labTimeline() {
    const p = PM.players && PM.players[LAB];
    const d = p && p.duration > 0 ? p.duration : 0;
    if (d && p.marks && p.marks.length) {
      return { d, marks: p.marks.map((m) => [m.t / d, m.tone]), beats: (p.beats || []).map((b) => b.t / d).filter((k) => k > 0 && k < 1) };
    }
    return { d: 14260, marks: [[0.401, 'err'], [0.752, 'ok']], beats: [0.153, 0.316, 0.373, 0.401, 0.587, 0.629, 0.752] };
  }

  const L_X = 32;
  const ST = { x: L_X, y: 146, w: 852, h: 566, bar: 64, narr: 56 };   // the stage: bar, scene, narration
  const SLOT = { x: 196, y: 159, w: 672, h: 38 };                    // the bar's slot the progress bar fills
  const RM = { x: 52, y: 222, w: 272, h: 420 };                      // README pane: tab, then the paper sheet
  const PANE = { x: 344, w: 520 };                                   // PLAYME pane: header, laptop, code
  const SCR = { x: 360, y: 244, w: 488 };                            // the laptop screen (the 1152 × 720 desktop)
  const CODE = { x: 344, y: 574, w: 520, h: 70 };                    // the code pane (its own layer)
  const R_X = 912;
  const R_W = 336;

  function drawQuestion(c) {
    c.fillStyle = A(TK.accent, 0.7);
    c.fillRect(L_X, 39, 22, 1.6);
    const eb = lab(':scope > .pm-eyebrow', 0, 'Lab 01 · Presentation vs experience', '实验 01 · 呈现与体验');
    text(c, zh() ? eb : eb.toUpperCase(), L_X + 34, 46, { size: 15, weight: 600, fam: zh() ? TK.sans : TK.mono, color: TK.accent, ls: zh() ? 1 : 2.2, max: 760 });
    text(c, lab(':scope > .pm-q', 0, 'Read it, or play it?', '读一遍，还是玩一遍？'), L_X - 1, 97,
      { size: 46, weight: 700, fam: TK.display, color: TK.hi, max: FW - 2 * L_X });
    text(c, lab(':scope > .pm-lead', 0, 'One claim, two ways: how a README presents it, and how a PLAYME lets you watch it happen.',
      '同一个结论，两种写法：README 的呈现方式，和 PLAYME 让你亲眼看到它发生。'), L_X, 128,
    { size: 18, weight: 400, fam: TK.sans, color: TK.tx, max: FW - 2 * L_X, min: 12 });
  }

  function drawStage(c) {
    const { x, y, w, h, bar, narr } = ST;
    const sceneY = y + bar;
    const narrY = y + h - narr;
    // the panel is opaque, so it hides the facts card under it
    c.save();
    rr(c, x, y, w, h, 18);
    c.fillStyle = TK.bg2; c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, A(TK.panel2, 1)); g.addColorStop(1, A(TK.panel2, 0.3));
    c.fillStyle = g; c.fill();
    c.clip();
    c.fillStyle = A(TK.bg, 0.6); c.fillRect(x, sceneY, w, narrY - sceneY);
    c.fillStyle = A(TK.line2, 0.5);
    for (let gx = x + 10; gx < x + w; gx += 20) for (let gy = sceneY + 10; gy < narrY; gy += 20) c.fillRect(gx, gy, 1.2, 1.2);
    // holes for the progress bar and the code pane: the layers under this one show through them
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';   // opaque, so the holes are fully cut (the erase uses the fill's alpha)
    rr(c, SLOT.x, SLOT.y, SLOT.w, SLOT.h, 10); c.fill();
    rr(c, CODE.x, CODE.y, CODE.w, CODE.h, 10); c.fill();
    c.globalCompositeOperation = 'source-over';
    c.restore();
    rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 18); c.strokeStyle = TK.line2; c.lineWidth = 1.5; c.stroke();
    hline(c, x, x + w, sceneY, TK.line);
    hline(c, x, x + w, narrY, TK.line);

    // the one primary button: mid-run it reads Pause
    const label = tr('Pause', '暂停');
    c.font = `600 18px ${TK.sans}`;
    const px = x + 20;
    const py = y + 12;
    const pw = Math.round(c.measureText(label).width + 66);
    const ph = 40;
    rr(c, px - 4, py - 4, pw + 8, ph + 8, 24); c.strokeStyle = A(TK.accent, 0.32); c.lineWidth = 3.5; c.stroke();
    c.save(); c.shadowColor = A(TK.accent, 0.7); c.shadowBlur = 26;
    rr(c, px, py, pw, ph, 20); c.fillStyle = TK.play; c.fill();
    c.restore();
    c.beginPath(); c.arc(px + 21, py + 20, 13.5, 0, Math.PI * 2); c.fillStyle = TK.bg; c.fill();
    c.fillStyle = TK.play; c.fillRect(px + 15.5, py + 13.5, 4, 13); c.fillRect(px + 22.5, py + 13.5, 4, 13);
    text(c, label, px + 44, py + 26.5, { size: 18, weight: 600, fam: TK.sans, color: TK.bg });

    drawReadme(c);
    drawPlaymePane(c);

    // narration: one caption at a time (Lab 01's caption at 0:07)
    c.save(); c.shadowColor = TK.err; c.shadowBlur = 12;
    c.beginPath(); c.arc(x + 26, narrY + 28, 5.5, 0, Math.PI * 2); c.fillStyle = TK.err; c.fill();
    c.restore();
    c.beginPath(); c.arc(x + 26, narrY + 28, 10, 0, Math.PI * 2); c.fillStyle = A(TK.err, 0.18); c.fill();
    text(c, tr('It lands on Pay now in Chrome, the front window.', '点击落到最前面的 Chrome 上，按下了“立即支付”。'), x + 46, narrY + 35,
      { size: 19, weight: 500, fam: TK.sans, color: TK.hi, max: w - 70 });
  }

  /** README.md on paper: the heading, three sentences (the one the run is at is marked), the code fence, Figure 1 */
  function drawReadme(c) {
    const { x, y, w, h } = RM;
    const sy = y + 22;
    const sh = h - 22;
    // the file tab
    c.font = `600 11.5px ${TK.mono}`;
    const tw = Math.round(c.measureText('README.md').width + 40);
    rr(c, x, y, tw, 34, 7); c.fillStyle = A(TK.paper, 0.86); c.fill();
    c.strokeStyle = A(TK.ink, 0.6); c.lineWidth = 1.2; c.strokeRect(x + 11.5, y + 6.5, 8, 10);
    text(c, 'README.md', x + 26, y + 16, { size: 11.5, weight: 600, fam: TK.mono, color: TK.ink });
    c.save(); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
    rr(c, x, sy, w, sh, 8); c.fillStyle = TK.paper; c.fill();
    c.restore();
    const px = x + 16;
    const pw = w - 32;
    text(c, '#', px - 3, sy + 33, { size: 15, weight: 500, fam: TK.mono, color: A(TK.ink, 0.35) });
    text(c, lab('.rp-md-h', 0, 'Every action names its target', '每个操作都指明目标'), px + 10, sy + 33,
      { size: 16.5, weight: 700, fam: TK.sans, color: TK.ink, max: pw - 10, min: 11 });
    hline(c, px, px + pw, sy + 45, A(TK.ink, 0.18));
    // at 0:07 sentence 1 is behind the run (lightly marked), sentence 2 is the one it shows, sentence 3 is still ahead
    const sp = zh() ? '' : ' ';
    const s = [
      lab('.rp-s1', 0, 'A computer-use agent shares the computer with its user.', '操作电脑的智能体，和用户共用同一台电脑。'),
      lab('.rp-s2', 0, 'A click that names no window goes to whichever window is in front, which may not be the window the agent looked at.',
        '没有指定窗口的点击，会落到当时最前面的窗口上，而那未必是智能体看着的窗口。'),
      lab('.rp-s3', 0, 'So each action names its target window, and the click reaches the right application without disturbing the user.',
        '所以每个操作都指明目标窗口：点击送到正确的应用，也不会打扰用户。'),
    ];
    const end = richPara(c, [
      { s: s[0] + sp, color: TK.ink, mark: A(TK.warn, 0.34) },
      { s: s[1] + sp, color: TK.ink, mark: A(TK.err, 0.3) },
      { s: s[2], color: A(TK.ink, 0.45) },
    ], px, sy + 68, { size: 12, weight: 400, fam: TK.sans, lh: 19, w: pw });

    // Figure 1 at the foot of the sheet: (a) the click lands in the front window, (b) it reaches the named one
    const bottom = sy + sh - 12;
    const fy = bottom - 92;
    const mini = (ox, named) => {
      c.fillStyle = '#EFE9DC'; c.fillRect(ox, fy, 66, 40);
      c.strokeStyle = A(TK.ink, 0.6); c.lineWidth = 1.2; c.strokeRect(ox + 0.5, fy + 0.5, 66, 40);
      c.fillStyle = A(TK.ink, 0.12); c.fillRect(ox, fy, 66, 8);
      c.fillStyle = '#FFFFFF'; c.fillRect(ox + 26, fy + 16, 72, 42);
      c.strokeStyle = A(TK.ink, 0.75); c.strokeRect(ox + 26.5, fy + 16.5, 72, 42);
      c.fillStyle = A(TK.ink, 0.12); c.fillRect(ox + 26, fy + 16, 72, 8);
      c.strokeStyle = A(TK.ink, 0.8); c.lineWidth = 1.2;
      if (named) c.setLineDash([3, 3]);
      c.beginPath(); c.moveTo(ox + 96, fy - 10); c.quadraticCurveTo(ox + 66, fy - 6, ox + 54, fy + 30); c.stroke();
      if (named) { c.strokeRect(ox + 44.5, fy + 30.5, 22, 9); c.setLineDash([]); } else { c.fillStyle = A(TK.ink, 0.25); c.fillRect(ox + 44, fy + 30, 22, 9); }
      c.strokeStyle = A(TK.ink, 0.85); c.lineWidth = 1.6;
      c.beginPath();
      if (named) { c.moveTo(ox + 74, fy + 44); c.lineTo(ox + 78, fy + 48); c.lineTo(ox + 86, fy + 38); } else { c.moveTo(ox + 74, fy + 38); c.lineTo(ox + 84, fy + 48); c.moveTo(ox + 84, fy + 38); c.lineTo(ox + 74, fy + 48); }
      c.stroke();
    };
    mini(px + 2, false);
    mini(px + 124, true);
    text(c, tr('(a) no target', '(a) 未指定目标'), px + 52, bottom - 22, { size: 9.5, weight: 400, italic: true, fam: TK.sans, color: A(TK.ink, 0.75), align: 'center' });
    text(c, tr('(b) target named', '(b) 指定目标窗口'), px + 174, bottom - 22, { size: 9.5, weight: 400, italic: true, fam: TK.sans, color: A(TK.ink, 0.75), align: 'center' });
    text(c, lab('.rp-fig figcaption', 0, 'Figure 1. Untargeted vs targeted click.', '图 1　未指定目标与指定目标的点击'), px + pw / 2, bottom - 4,
      { size: 10.5, weight: 400, italic: true, fam: TK.sans, color: A(TK.ink, 0.72), align: 'center', max: pw });

    // the code fence, when the paragraph leaves room for it
    const top = end + 14;
    if (fy - 20 - top >= 40) {
      rr(c, px, top, pw, 40, 4); c.fillStyle = A(TK.ink, 0.06); c.fill();
      c.strokeStyle = A(TK.ink, 0.16); c.lineWidth = 1; c.stroke();
      let cx = px + 10;
      cx += text(c, 'click(612, 404,', cx, top + 16, { size: 10.5, weight: 500, fam: TK.mono, color: TK.ink });
      cx = px + 10 + 6 * 6.3;
      cx += text(c, 'window=', cx, top + 31, { size: 10.5, weight: 500, fam: TK.mono, color: TK.ink });
      cx += text(c, '"Report.xlsx"', cx, top + 31, { size: 10.5, weight: 500, fam: TK.mono, color: '#A0322A' });
      text(c, ')', cx, top + 31, { size: 10.5, weight: 500, fam: TK.mono, color: TK.ink });
    }
  }

  /** PLAYME.html: the pane's header, the laptop with Lab 01's desktop at 0:07 */
  function drawPlaymePane(c) {
    const x = PANE.x;
    const w = PANE.w;
    const hy = 229;
    c.save(); c.shadowColor = TK.accent; c.shadowBlur = 8;
    c.beginPath(); c.arc(x + 5, hy - 4.5, 3.6, 0, Math.PI * 2); c.fillStyle = TK.accent; c.fill();
    c.restore();
    text(c, 'PLAYME.html', x + 15, hy, { size: 12.5, weight: 600, fam: TK.mono, color: TK.hi });
    // the two runs, right-aligned: A has just failed, B is still to come
    const o = { size: 11.5, weight: 500, fam: TK.mono };
    const bText = tr(' names its window', ' 指定了窗口');
    const aText = tr(' no target ✗', ' 未指定目标 ✗');
    c.font = `500 11.5px ${TK.mono}`;
    const wB = c.measureText('B' + bText).width;
    const wA = c.measureText('A' + aText).width;
    let rx = x + w - wB - 18 - wA;
    rx += text(c, 'A', rx, hy, { ...o, weight: 700, color: TK.err });
    text(c, aText, rx, hy, { ...o, color: TK.err });
    rx = x + w - wB;
    rx += text(c, 'B', rx, hy, { ...o, weight: 700, color: TK.tx });
    text(c, bText, rx, hy, { ...o, color: TK.mu });

    // the laptop: a dark bezel in a silver rim, the screen, the base
    const sw = SCR.w;
    const sh = 720 * sw / 1152;
    rr(c, SCR.x - 9, SCR.y - 9, sw + 18, sh + 15, 12); c.fillStyle = '#B9BDC6'; c.fill();
    rr(c, SCR.x - 7.5, SCR.y - 7.5, sw + 15, sh + 12, 10.5); c.fillStyle = '#0D0E13'; c.fill();
    c.beginPath(); c.arc(SCR.x + sw / 2, SCR.y - 4, 1.4, 0, Math.PI * 2); c.fillStyle = '#2A2C36'; c.fill();
    drawDesk(c, SCR.x, SCR.y, sw);
    const by = SCR.y + sh + 6;
    const bg = c.createLinearGradient(0, by, 0, by + 9);
    bg.addColorStop(0, '#E2E5EB'); bg.addColorStop(1, '#8F95A1');
    c.beginPath(); c.moveTo(SCR.x - 28, by); c.lineTo(SCR.x + sw + 28, by); c.lineTo(SCR.x + sw + 20, by + 8); c.lineTo(SCR.x - 20, by + 8); c.closePath();
    c.fillStyle = bg; c.fill();
    rr(c, SCR.x + sw / 2 - 34, by, 68, 3.5, 1.75); c.fillStyle = 'rgba(60,64,74,.35)'; c.fill();
  }

  /* Lab 01's desktop, in its own logical pixels (1152 × 720): the geometry and the words of read-or-play.js */
  const DW = 1152;
  const DH = 720;
  const REPORT = { x: 36, y: 322, w: 640, h: 322 };
  const CHROME = { x: 400, y: 58, w: 712, h: 532 };
  const CLICK = [612, 404];
  const KNOCK = [806, 346];
  const UI_ZH = { File: '文件', Edit: '编辑', View: '显示', History: '历史记录', Bookmarks: '书签', Profiles: '个人资料', Tab: '标签页', Window: '窗口', Help: '帮助',
    Home: '开始', Insert: '插入', Draw: '绘图', 'Page Layout': '页面布局', Formulas: '公式', Data: '数据' };
  const ui = (w) => (zh() && UI_ZH[w] ? UI_ZH[w] : w);
  const SF = "-apple-system, 'Segoe UI', 'Instrument Sans', 'PingFang SC', 'Noto Sans SC', sans-serif";   // a simulated screen's UI face

  function drawDesk(c, X, Y, W) {
    const s = W / DW;
    c.save();
    rr(c, X, Y, W, DH * s, 3); c.clip();
    c.translate(X, Y);
    c.scale(s, s);
    let g = c.createLinearGradient(0, 0, DW, DH);
    g.addColorStop(0, '#18286F'); g.addColorStop(0.55, '#4A3B9C'); g.addColorStop(1, '#C45E9F');
    c.fillStyle = g; c.fillRect(0, 0, DW, DH);
    g = c.createRadialGradient(DW * 0.85, DH * 0.9, 20, DW * 0.85, DH * 0.9, DW * 0.55);
    g.addColorStop(0, 'rgba(255,175,225,.5)'); g.addColorStop(1, 'rgba(255,175,225,0)');
    c.fillStyle = g; c.fillRect(0, 0, DW, DH);
    // menu bar: Chrome is the front app
    c.fillStyle = 'rgba(243,244,250,.88)'; c.fillRect(0, 0, DW, 28);
    let mx = 20;
    mx += text(c, 'Chrome', mx, 19.5, { size: 15, weight: 700, fam: SF, color: '#1D1D1F' }) + 20;
    for (const m of ['File', 'Edit', 'View', 'History', 'Bookmarks', 'Profiles', 'Tab', 'Window', 'Help']) mx += text(c, ui(m), mx, 19.5, { size: 15, weight: 400, fam: SF, color: '#1D1D1F' }) + 17;
    text(c, tr('Tue 9:41 AM', '周二 上午9:41'), DW - 16, 19.5, { size: 15, weight: 500, fam: SF, color: '#1D1D1F', align: 'right' });
    // desktop icons
    rr(c, 38, 52, 56, 42, 6); c.fillStyle = '#5AA8F2'; c.fill();
    rr(c, 38, 46, 24, 10, 3); c.fillStyle = '#4B97E0'; c.fill();
    text(c, tr('Trips', '行程'), 66, 116, { size: 14, weight: 500, fam: SF, color: '#FFFFFF', align: 'center' });
    rr(c, 46, 136, 40, 50, 4); c.fillStyle = '#FFFFFF'; c.fill();
    c.fillStyle = '#E2403A'; c.fillRect(46, 166, 40, 12);
    text(c, 'Itinerary.pdf', 66, 206, { size: 14, weight: 500, fam: SF, color: '#FFFFFF', align: 'center' });

    drawSheet(c);
    drawChrome(c);

    // the agent's click lands on Pay now: coral ripples; your pointer is knocked aside and your typing is cut off
    [[22, 0.95, 4], [40, 0.6, 3.5], [60, 0.32, 3]].forEach(([r, a, lw]) => { c.beginPath(); c.arc(CLICK[0], CLICK[1], r, 0, Math.PI * 2); c.strokeStyle = A(TK.err, a); c.lineWidth = lw; c.stroke(); });
    arrowPointer(c, CLICK[0], CLICK[1], TK.agent, '#FFFFFF', 1.5);
    tag(c, tr('Agent', '智能体'), CLICK[0] + 22, CLICK[1] + 38, TK.agent, '#FFFFFF', 19);
    c.save();
    c.translate(KNOCK[0], KNOCK[1]); c.rotate(-0.35);
    arrowPointer(c, 0, 0, TK.user, '#2A1A04', 1.4);
    c.restore();
    tag(c, tr('You · interrupted', '你 · 被打断'), KNOCK[0] + 22, KNOCK[1] + 28, TK.user, '#2A1A04', 19);

    // the dock
    const icons = ['#3D8BFF', '#4C8DF6', '#1F9D55', '#3A7BEA', '#F2C230', '#25262B'];
    const dw = icons.length * 50 + 18;
    const dx = DW / 2 - dw / 2;
    rr(c, dx, 660, dw, 54, 16); c.fillStyle = 'rgba(255,255,255,.28)'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.stroke();
    icons.forEach((col, i) => { rr(c, dx + 13 + i * 50, 667, 40, 40, 10); c.fillStyle = col; c.fill(); });
    c.restore();
  }

  /** Report.xlsx, the back window: its Save button sits under Chrome, at the coordinates both clicks use */
  function drawSheet(c) {
    const { x, y, w, h } = REPORT;
    macWindow(c, x, y, w, h, 'Report.xlsx');
    c.save(); rr(c, x, y, w, h, 10); c.clip();
    const ry = y + 31;
    c.fillStyle = '#F6F6F8'; c.fillRect(x, ry, w, 60);
    let tx = x + 16;
    ['Home', 'Insert', 'Draw', 'Page Layout', 'Formulas', 'Data'].forEach((t, i) => {
      const tw = text(c, ui(t), tx, ry + 19, { size: 13.5, weight: i ? 400 : 600, fam: SF, color: i ? '#3A3D45' : '#1E7B4F' });
      if (!i) { c.fillStyle = '#1E7B4F'; c.fillRect(tx, ry + 25, tw, 2.5); }
      tx += tw + 20;
    });
    const ty = ry + 34;
    [0, 1, 2].forEach((i) => { rr(c, x + 14 + i * 26, ty + 2, 18, 16, 3); c.fillStyle = '#D6D9E0'; c.fill(); });
    rr(c, x + 96, ty, 80, 21, 4); c.strokeStyle = '#C6C9D1'; c.lineWidth = 1; c.stroke();
    text(c, 'Aptos', x + 104, ty + 15, { size: 13, weight: 400, fam: SF, color: '#30333A' });
    rr(c, x + 182, ty, 34, 21, 4); c.stroke();
    text(c, '12', x + 190, ty + 15, { size: 13, weight: 400, fam: SF, color: '#30333A' });
    text(c, 'B', x + 232, ty + 15, { size: 14, weight: 700, fam: SF, color: '#30333A' });
    text(c, 'I', x + 254, ty + 15, { size: 14, weight: 400, italic: true, fam: 'Georgia, serif', color: '#30333A' });
    text(c, 'U', x + 272, ty + 15, { size: 14, weight: 400, fam: SF, color: '#30333A' });
    hline(c, x + 270, x + 283, ty + 17, '#30333A', 1.2);
    rr(c, 570, 389, 84, 30, 6); c.fillStyle = '#1E7B4F'; c.fill();   // Save, hidden behind Chrome
    text(c, tr('Save', '保存'), 612, 409, { size: 14, weight: 700, fam: SF, color: '#FFFFFF', align: 'center' });
    const fy = ry + 62;
    c.fillStyle = '#FFFFFF'; c.fillRect(x, fy, w, 26);
    hline(c, x, x + w, fy, '#DADCE2'); hline(c, x, x + w, fy + 26, '#DADCE2');
    text(c, 'E2', x + 14, fy + 18, { size: 13, weight: 500, fam: SF, color: '#30333A' });
    text(c, 'fx', x + 60, fy + 18, { size: 13, weight: 400, italic: true, fam: 'Georgia, serif', color: '#8A8F9C' });
    text(c, '14,980', x + 88, fy + 18, { size: 13, weight: 400, fam: SF, color: '#30333A' });
    const gy = fy + 30;
    const cols = [x, x + 30, x + 150, x + 260, x + 370, x + w];
    c.fillStyle = '#EEF0F3'; c.fillRect(x, gy, w, 20); c.fillRect(x, gy, 30, 130);
    ['A', 'B', 'C', 'D'].forEach((L, i) => text(c, L, (cols[i + 1] + cols[i + 2]) / 2, gy + 14.5, { size: 12, weight: 600, fam: SF, color: '#6B7080', align: 'center' }));
    const rows = zh()
      ? [['区域', '第一季度', '第二季度', '第三季度'], ['北区', '12,840', '13,210', '13,940'], ['南区', '9,800', '10,450', '10,960'], ['东区', '15,320', '14,980', '15,700'], ['西区', '8,720', '9,130', '9,480']]
      : [['Region', 'Q1', 'Q2', 'Q3'], ['North', '12,840', '13,210', '13,940'], ['South', '9,800', '10,450', '10,960'], ['East', '15,320', '14,980', '15,700'], ['West', '8,720', '9,130', '9,480']];
    rows.forEach((r, i) => {
      const yy = gy + 20 + i * 22;
      hline(c, x, x + w, yy + 22, '#E3E5EA');
      text(c, String(i + 1), x + 15, yy + 15.5, { size: 11.5, weight: 500, fam: SF, color: '#8A8F9C', align: 'center' });
      r.forEach((v, j) => text(c, v, j ? cols[j + 2] - 10 : cols[1] + 8, yy + 15.5, { size: 13, weight: i ? 400 : 700, fam: SF, color: '#262A33', align: j ? 'right' : 'left' }));
    });
    cols.slice(1, 5).forEach((cx) => { c.fillStyle = '#E3E5EA'; c.fillRect(cx, gy, 1, 130); });
    // sheet tab and status bar: the changes are not saved yet
    c.fillStyle = '#F2F2F5'; c.fillRect(x, y + h - 50, w, 26);
    rr(c, x + 34, y + h - 50, 92, 22, 4); c.fillStyle = '#FFFFFF'; c.fill();
    text(c, tr('Q4 report', '第四季度报表'), x + 80, y + h - 34, { size: 12.5, weight: 600, fam: SF, color: '#1E7B4F', align: 'center' });
    c.fillStyle = '#F7F7F9'; c.fillRect(x, y + h - 24, w, 24);
    hline(c, x, x + w, y + h - 24, '#E0E2E7');
    text(c, tr('Ready', '就绪'), x + 14, y + h - 7.5, { size: 12, weight: 400, fam: SF, color: '#6B7080' });
    c.beginPath(); c.arc(x + w - 196, y + h - 12, 4.5, 0, Math.PI * 2); c.fillStyle = '#E08A00'; c.fill();
    text(c, tr('Unsaved changes', '有未保存的更改'), x + w - 186, y + h - 7.5, { size: 12.5, weight: 600, fam: SF, color: '#9A5B00' });
    text(c, '100%', x + w - 14, y + h - 7.5, { size: 12, weight: 400, fam: SF, color: '#6B7080', align: 'right' });
    c.restore();
  }

  /** Chrome, the front window: the flight you are booking; the untargeted click has just pressed Pay now */
  function drawChrome(c) {
    const { x, y, w, h } = CHROME;
    c.save(); c.shadowColor = 'rgba(8,10,30,.5)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
    rr(c, x, y, w, h, 12); c.fillStyle = '#FFFFFF'; c.fill();
    c.restore();
    c.save(); rr(c, x, y, w, h, 12); c.clip();
    // tab strip
    c.fillStyle = '#DFE3EA'; c.fillRect(x, y, w, 40);
    [['#FF5F57', 0], ['#FEBC2E', 1], ['#28C840', 2]].forEach(([col, i]) => { c.beginPath(); c.arc(x + 20 + i * 20, y + 20, 6, 0, Math.PI * 2); c.fillStyle = col; c.fill(); });
    c.beginPath(); c.moveTo(x + 86, y + 40); c.lineTo(x + 92, y + 8); c.lineTo(x + 300, y + 8); c.lineTo(x + 306, y + 40); c.closePath(); c.fillStyle = '#FFFFFF'; c.fill();
    c.beginPath(); c.arc(x + 110, y + 24, 7, 0, Math.PI * 2); c.fillStyle = '#1A6BE0'; c.fill();
    text(c, tr('Book a flight · skyfare', '预订航班 · skyfare'), x + 124, y + 29, { size: 13.5, weight: 500, fam: SF, color: '#30333A', max: 160 });
    c.beginPath(); c.arc(x + 332, y + 24, 7, 0, Math.PI * 2); c.fillStyle = '#D9573B'; c.fill();
    text(c, tr('Inbox (2)', '收件箱 (2)'), x + 346, y + 29, { size: 13.5, weight: 400, fam: SF, color: '#4A4D55' });
    // toolbar
    c.fillStyle = '#FFFFFF'; c.fillRect(x, y + 40, w, 38);
    text(c, '←   →   ↻', x + 18, y + 64, { size: 15, weight: 500, fam: SF, color: '#5F6368' });
    rr(c, x + 112, y + 46, w - 210, 26, 13); c.fillStyle = '#F1F3F4'; c.fill();
    text(c, 'skyfare.example/book', x + 134, y + 64, { size: 13.5, weight: 400, fam: SF, color: '#3C4043' });
    hline(c, x, x + w, y + 78, '#E2E4E8');
    // the page
    const py = y + 78;
    c.beginPath(); c.moveTo(x + 22, py + 30); c.lineTo(x + 38, py + 22); c.lineTo(x + 30, py + 36); c.closePath(); c.fillStyle = '#1A6BE0'; c.fill();
    text(c, 'skyfare', x + 42, py + 33, { size: 19, weight: 800, fam: SF, color: '#1A6BE0' });
    let nx = x + w - 52;
    for (const n of zh() ? ['我的行程', '酒店', '机票'] : ['My trips', 'Hotels', 'Flights']) nx -= text(c, n, nx, py + 31, { size: 13, weight: 500, fam: SF, color: '#3C4043', align: 'right' }) + 18;
    c.beginPath(); c.arc(x + w - 28, py + 26, 10, 0, Math.PI * 2); c.fillStyle = '#F2735E'; c.fill();
    hline(c, x, x + w, py + 48, '#EEF0F3');
    text(c, tr('Book your flight', '预订航班'), x + 23, py + 92, { size: 21, weight: 700, fam: SF, color: '#202124' });
    const field = (fx, fy, label, value, active) => {
      rr(c, fx, fy, 182, 44, 7); c.fillStyle = '#FFFFFF'; c.fill();
      c.strokeStyle = active ? A(TK.err, 0.8) : '#DADCE0'; c.lineWidth = active ? 1.6 : 1; c.stroke();
      text(c, label, fx + 10, fy + 15, { size: 10.5, weight: 500, fam: SF, color: '#80868B' });
      return text(c, value, fx + 10, fy + 34, { size: 14.5, weight: 600, fam: SF, color: '#202124' });
    };
    const fx0 = x + 23;
    field(fx0, py + 108, tr('From', '出发地'), tr('Berlin (BER)', '柏林 (BER)'));
    const tw = field(fx0 + 192, py + 108, tr('To', '目的地'), 'Tok', true);
    c.fillStyle = A(TK.err, 0.85); c.fillRect(fx0 + 192 + 12 + tw, py + 128, 2, 18);   // your typing stops here
    field(fx0, py + 160, tr('Depart', '出发日期'), tr('Fri, 14 Nov', '11月14日 周五'));
    field(fx0 + 192, py + 160, tr('Travellers', '乘客'), tr('1 adult', '1 位成人'));
    text(c, tr('Total, taxes included', '总价（含税）'), fx0, py + 230, { size: 12.5, weight: 400, fam: SF, color: '#5F6368' });
    text(c, '€842', fx0 + 374, py + 230, { size: 14, weight: 700, fam: SF, color: '#202124', align: 'right' });
    // Pay now, centred on (612, 404): the untargeted click pressed it, so it is paying
    rr(c, CLICK[0] - 194, CLICK[1] - 18, 388, 36, 8); c.fillStyle = '#1B3D8F'; c.fill();
    c.beginPath(); c.arc(CLICK[0] - 62, CLICK[1], 7, -0.4, Math.PI * 1.3); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.2; c.stroke();
    text(c, tr('Paying €842…', '正在支付 €842…'), CLICK[0] - 46, CLICK[1] + 5.5, { size: 15, weight: 700, fam: SF, color: '#FFFFFF' });
    text(c, tr('Secure payment · Visa •••• 4242', '安全支付 · Visa •••• 4242'), fx0, CLICK[1] + 40, { size: 11.5, weight: 400, fam: SF, color: '#80868B' });
    // the trip summary
    const kx = x + 430;
    const kw = w - 448;
    rr(c, kx, py + 64, kw, 214, 10); c.fillStyle = '#FFFFFF'; c.fill(); c.strokeStyle = '#E3E5E8'; c.lineWidth = 1; c.stroke();
    text(c, tr('YOUR FLIGHT', '你的航班'), kx + 16, py + 90, { size: 11, weight: 700, fam: SF, color: '#80868B', ls: zh() ? 0 : 1 });
    text(c, 'BER', kx + 16, py + 118, { size: 19, weight: 800, fam: SF, color: '#202124' });
    c.setLineDash([3, 4]); c.strokeStyle = '#B8BCC4'; c.beginPath(); c.moveTo(kx + 66, py + 112); c.lineTo(kx + kw - 46, py + 112); c.stroke(); c.setLineDash([]);
    text(c, '···', kx + kw - 16, py + 117, { size: 16, weight: 700, fam: SF, color: '#5F6368', align: 'right' });
    text(c, tr('Fri, 14 Nov · 07:05 · 1 stop', '11月14日 周五 · 07:05 · 经停 1 次'), kx + 16, py + 138, { size: 11, weight: 400, fam: SF, color: '#80868B', max: kw - 32 });
    [[tr('Fare', '票价'), '€790', 400], [tr('Taxes and fees', '税费'), '€52', 400], [tr('Total', '总价'), '€842', 700]].forEach(([k, v, wt], i) => {
      const ly = py + 172 + i * 26;
      text(c, k, kx + 16, ly, { size: 12.5, weight: wt, fam: SF, color: '#3C4043' });
      text(c, v, kx + kw - 16, ly, { size: 12.5, weight: wt, fam: SF, color: '#202124', align: 'right' });
    });
    text(c, tr('Free cancellation for 24 hours', '24 小时内免费取消'), kx + 16, py + 262, { size: 11.5, weight: 600, fam: SF, color: '#188038', max: kw - 32 });
    // the click landed in this window: Lab 01 holds it in the error tone
    c.fillStyle = A(TK.err, 0.1); c.fillRect(x, y, w, h);
    c.restore();
    c.save(); c.shadowColor = TK.err; c.shadowBlur = 18;
    rr(c, x + 1.5, y + 1.5, w - 3, h - 3, 11); c.strokeStyle = A(TK.err, 0.9); c.lineWidth = 3; c.stroke();
    c.restore();
  }

  function drawTransport(c) {
    const { x, y, w, h } = SLOT;
    rr(c, x, y, w, h, 10);
    c.fillStyle = TK.bg2; c.fill();
    c.fillStyle = A(TK.panel2, 0.97); c.fill();
    c.strokeStyle = TK.line; c.lineWidth = 1; c.stroke();
    const tl = labTimeline();
    const now = Math.min(1, AT / tl.d);
    // the timecode sits at the right end of the slot; the track ends where it starts, so the time is never cut off
    const tA = PM.fmt.time(AT);
    const tB = ` / ${PM.fmt.time(tl.d)}`;
    c.font = `600 18px ${TK.mono}`;
    const wA = c.measureText(tA).width;
    c.font = `500 18px ${TK.mono}`;
    const wT = wA + c.measureText(tB).width;
    const x0 = x + 18;
    const x1 = x + w - 18 - wT - 22;
    const yc = y + h / 2;
    const at = (k) => x0 + (x1 - x0) * k;
    rr(c, x0, yc - 2.5, x1 - x0, 5, 2.5); c.fillStyle = TK.line2; c.fill();
    const g = c.createLinearGradient(x0, 0, at(now), 0);
    g.addColorStop(0, TK.accent2); g.addColorStop(1, TK.accent);
    c.save(); c.shadowColor = A(TK.accent, 0.8); c.shadowBlur = 10;
    rr(c, x0, yc - 2.5, at(now) - x0, 5, 2.5); c.fillStyle = g; c.fill();
    c.restore();
    // caption beats: hairline gaps in the track; marks: toned ticks
    tl.beats.forEach((k) => { c.fillStyle = TK.bg2; c.fillRect(at(k) - 1, yc - 3, 2, 6); });
    const tone = { err: TK.err, ok: TK.ok, warn: TK.warn, agent: TK.agent, user: TK.user, accent: TK.accent };
    tl.marks.forEach(([k, tn]) => {
      const col = tone[tn] || TK.warn;
      rr(c, at(k) - 4.5, yc - 12.5, 9, 25, 3); c.fillStyle = TK.bg2; c.fill();
      c.save(); c.shadowColor = col; c.shadowBlur = 12;
      rr(c, at(k) - 3, yc - 11, 6, 22, 3); c.fillStyle = col; c.fill();
      c.restore();
    });
    c.beginPath(); c.arc(at(now), yc, 13, 0, Math.PI * 2); c.fillStyle = A(TK.accent, 0.22); c.fill();
    c.save(); c.shadowColor = TK.accent; c.shadowBlur = 14;
    c.beginPath(); c.arc(at(now), yc, 8, 0, Math.PI * 2); c.fillStyle = TK.hi; c.fill();
    c.restore();
    const tx = x1 + 22;
    const w1 = text(c, tA, tx, yc + 6.5, { size: 18, weight: 600, fam: TK.mono, color: TK.hi });
    text(c, tB, tx + w1, yc + 6.5, { size: 18, weight: 500, fam: TK.mono, color: TK.mu });
  }

  /** the code pane under the laptop: the two calls with their plain-words comments; line 1 has just failed */
  function drawCode(c) {
    const { x, y, w, h } = CODE;
    rr(c, x, y, w, h, 10); c.fillStyle = TK.codeBg; c.fill();
    rr(c, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 10); c.strokeStyle = TK.line2; c.lineWidth = 1.2; c.stroke();
    const notes = zh() ? ['# A：未指定窗口', '# B：指定了窗口'] : ['# A: no target', '# B: names its window'];
    const LINES = [
      [['click', TK.tkFn], ['(', TK.codeInk], ['612', TK.tkNum], [', ', TK.codeInk], ['404', TK.tkNum], [')', TK.codeInk]],
      [['click', TK.tkFn], ['(', TK.codeInk], ['612', TK.tkNum], [', ', TK.codeInk], ['404', TK.tkNum], [', ', TK.codeInk],
        ['window', TK.tkKey, 'f'], ['=', TK.codeInk, 'f'], ['"Report.xlsx"', TK.tkStr, 'f'], [')', TK.codeInk]],
    ];
    const gut = 34;
    const lineW = (parts, size) => { c.font = `500 ${size}px ${TK.mono}`; return parts.reduce((s2, p) => s2 + c.measureText(p[0]).width, 0); };
    let size = 15;
    const fits = (sz) => {
      const cw = Math.max(...LINES.map((p) => lineW(p, sz)));
      c.font = `italic 400 ${sz}px ${TK.mono}`;
      return gut + 14 + cw + 26 + Math.max(...notes.map((n) => c.measureText(n).width)) <= w - 12;
    };
    while (size > 10 && !fits(size)) size -= 0.5;
    const codeW = Math.max(...LINES.map((p) => lineW(p, size)));
    const cx0 = x + gut + 14;
    const nx = cx0 + codeW + 26;
    const lh = (h - 10) / 2;
    LINES.forEach((parts, i) => {
      const ly = y + 5 + i * lh;
      const base = ly + lh / 2 + size * 0.36;
      if (i === 0) {
        c.fillStyle = A(TK.err, 0.13); c.fillRect(x + 1, ly, w - 2, lh);
        c.fillStyle = TK.err; c.fillRect(x + 1, ly, 3, lh);
      }
      text(c, String(i + 1), x + gut - 6, base, { size: size - 1, weight: 600, fam: TK.mono, color: i === 0 ? TK.err : TK.codeLn, align: 'right' });
      c.font = `500 ${size}px ${TK.mono}`;
      const fs = parts.filter((p) => p[2] === 'f');
      if (fs.length) {
        let fx = cx0;
        for (const p of parts) { if (p[2] === 'f') break; fx += c.measureText(p[0]).width; }
        const fwid = fs.reduce((s2, p) => s2 + c.measureText(p[0]).width, 0);
        const bh = size + 9;
        c.save(); c.shadowColor = A(TK.accent, 0.9); c.shadowBlur = 14;
        rr(c, fx - 4, base - size * 0.82 - 4, fwid + 8, bh, 5); c.fillStyle = A(TK.accent, 0.14); c.fill();
        c.restore();
        rr(c, fx - 4, base - size * 0.82 - 4, fwid + 8, bh, 5); c.strokeStyle = A(TK.accent, 0.9); c.lineWidth = 1.4; c.stroke();
      }
      let px = cx0;
      for (const [s2, col, f] of parts) {
        c.font = `500 ${size}px ${TK.mono}`;
        c.fillStyle = f && col !== TK.tkStr ? TK.hi : col;
        c.textAlign = 'left';
        c.fillText(s2, px, base);
        px += c.measureText(s2).width;
      }
      text(c, notes[i], nx, base, { size, weight: 400, italic: true, fam: TK.mono, color: TK.tkCom });
    });
  }

  /** the outcome at 0:07: one readout has filled, two wait for the rest of the run; the takeaway is still muted */
  function drawOutcome(c) {
    const x = R_X;
    const w = R_W;
    const y = ST.y;
    hline(c, x, x + w, y, TK.line2);
    const rows = [
      [lab('.pm-outcome .pm-ro-label', 0, 'Untargeted click', '未指定窗口的点击'), 'Chrome ✗', TK.err],
      [lab('.pm-outcome .pm-ro-label', 1, 'Targeted click', '指定窗口的点击'), null, null],
      [lab('.pm-outcome .pm-ro-label', 2, 'User interrupted', '用户被打断'), null, null],
    ];
    rows.forEach(([label, val, col], i) => {
      const yy = y + i * 80;
      text(c, zh() ? label : label.toUpperCase(), x, yy + 28, { size: 13, weight: 600, fam: zh() ? TK.sans : TK.mono, color: TK.mu, ls: zh() ? 0.5 : 1.6, max: w });
      if (val) text(c, val, x, yy + 66, { size: 33, weight: 700, fam: TK.display, color: col, glow: A(col, 0.45), blur: 18, max: w });
      else { c.fillStyle = A(TK.mu, 0.55); c.fillRect(x, yy + 56, 24, 2); }   // "no result yet"
      hline(c, x, x + w, yy + 80, TK.line);
    });
    const ty = y + 3 * 80 + 44;
    c.fillStyle = TK.line2; c.fillRect(x, ty - 18, 2.5, 50);
    para(c, lab(':scope > .pm-takeaway', 0, 'Reading states the rule. Playing shows why it matters.', '读到的是规则，玩过才知道它为什么重要。'), x + 16, ty,
      { size: 17.5, weight: 500, fam: TK.sans, color: A(TK.tx, 0.85), lh: 25, w: w - 18, maxLines: 2 });
  }

  function drawFolds(c) {
    const x = R_X;
    const w = R_W;
    const y0 = 538;
    text(c, tr('GO DEEPER', '深入了解'), x, y0, { size: 13, weight: 600, fam: zh() ? TK.sans : TK.mono, color: TK.mu, ls: zh() ? 0.5 : 2.2 });
    [0, 1].forEach((i) => {
      const yy = y0 + 12 + i * 64;
      hline(c, x, x + w, yy, TK.line);
      c.beginPath(); c.arc(x + 15, yy + 32, 12.5, 0, Math.PI * 2); c.strokeStyle = TK.line2; c.lineWidth = 1.5; c.stroke();
      chevron(c, x + 15.5, yy + 32, TK.accent);
      const titles = [['How this part is built', '这个部件是怎么做的'], ['Why a click needs a target', '为什么点击要指明目标']];
      const teasers = [['The story script, excerpted from the part’s source', '故事脚本，摘自部件源码'], ['Background windows on a real computer', '真实电脑上的后台窗口']];
      text(c, lab('.pm-fold-title', i, ...titles[i]), x + 40, yy + 28, { size: 16.5, weight: 600, fam: TK.sans, color: TK.hi, max: w - 44, min: 11 });
      text(c, lab('.pm-fold-teaser', i, ...teasers[i]), x + 40, yy + 50, { size: 13, weight: 400, fam: TK.sans, color: TK.mu, max: w - 44, min: 9 });
    });
    hline(c, x, x + w, y0 + 12 + 128, TK.line);
  }

  function drawSource(c) {
    const y = ST.y + ST.h + 40;
    let x = L_X + 2;
    const o = { size: 19, weight: 500, fam: TK.sans, color: TK.tx };
    x += text(c, '◇', x, y, { ...o, color: TK.hi }) + 9;
    text(c, lab(':scope > .pm-source [data-l-en]', 0, 'Simulation for illustration · adapted from the OpenGCUA case study', '示意模拟 · 改编自 OpenGCUA 案例'), x, y, { ...o, max: 800 });
  }

  /** the data layer: the values the part shows, kept in facts.json and checked by script */
  function drawFacts(c) {
    const x = 92;
    const y = 238;
    const w = 640;
    const h = 384;
    rr(c, x, y, w, h, 14); c.fillStyle = TK.codeBg; c.fill();
    rr(c, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); c.strokeStyle = TK.line2; c.lineWidth = 1.5; c.stroke();
    text(c, 'facts.json', x + 22, y + 30, { size: 16, weight: 600, fam: TK.mono, color: TK.hi });
    text(c, 'fidelity.py ✓', x + w - 20, y + 30, { size: 15, weight: 600, fam: TK.mono, color: TK.ok, align: 'right' });
    hline(c, x, x + w, y + 46, TK.line);
    const P = TK.codeInk;
    const rows = [
      [['{', P]],
      [['  "click.at"', TK.tkKey], [': ', P], ['"612, 404"', TK.tkStr], [',', P]],
      [['  "click.target"', TK.tkKey], [': ', P], ['"Report.xlsx"', TK.tkStr], [',', P]],
      [['  "fare"', TK.tkKey], [': ', P], ['"€842"', TK.tkStr]],
      [['}', P]],
    ];
    rows.forEach((parts, i) => {
      const ly = y + 96 + i * 42;
      text(c, String(i + 1), x + 40, ly, { size: 16, weight: 500, fam: TK.mono, color: TK.codeLn, align: 'right' });
      let px = x + 58;
      for (const [s, col] of parts) px += text(c, s, px, ly, { size: 21, weight: 500, fam: TK.mono, color: col });
    });
    text(c, tr('Values shown with data-fact must equal this file.', '页面上标了 data-fact 的数值，必须与这个文件一致。'), x + 22, y + h - 26,
      { size: 16, weight: 500, fam: TK.sans, color: TK.mu, max: w - 44 });
  }

  /* ================================================================ the six layers of a classic project page
   * The same frame, printed on paper. Every piece is a paper card; the BibTeX layer at the bottom also lays the page
   * ground, so the assembled stack reads as one continuous page. */

  function paperCard(c, x, y, w, h) { c.fillStyle = TK.paper; c.fillRect(x, y, w, h); }
  const INK = () => TK.ink;
  const INK2 = () => A(TK.ink, 0.72);
  const LINK = '#1F5FA8';   // a printed page's link blue (simulated page)

  function drawPTitle(c) {
    paperCard(c, 24, 14, FW - 48, 196);
    text(c, tr('Targeted Clicks for Computer-Use Agents', '计算机使用智能体的定向点击'), FW / 2, 80,
      { size: 42, weight: 700, fam: SERIF, color: INK(), align: 'center', max: FW - 120 });
    text(c, 'A. Author¹    B. Author¹    C. Author²', FW / 2, 122, { size: 21, weight: 400, fam: TK.sans, color: LINK, align: 'center' });
    text(c, tr('¹ University of Somewhere    ² Example Lab', '¹ 某某大学    ² 示例实验室'), FW / 2, 152, { size: 17, weight: 400, fam: TK.sans, color: INK2(), align: 'center' });
    const btns = ['Paper', 'Code', 'Video', 'arXiv'];
    const bw = 112;
    const gap = 14;
    let bx = FW / 2 - (btns.length * bw + (btns.length - 1) * gap) / 2;
    btns.forEach((s) => {
      rr(c, bx, 168, bw, 34, 17); c.fillStyle = '#363636'; c.fill();
      text(c, s, bx + bw / 2, 190.5, { size: 15, weight: 600, fam: TK.sans, color: '#F5F5F5', align: 'center' });
      bx += bw + gap;
    });
  }
  function drawPAbstract(c) {
    const x = 664;
    const w = 560;
    paperCard(c, x - 20, 222, w + 40, 280);
    text(c, tr('Abstract', '摘要'), x + w / 2, 256, { size: 27, weight: 700, fam: SERIF, color: INK(), align: 'center' });
    para(c, tr(
      'A computer-use agent shares the computer with its user. A click that names no window goes to whichever window is in front, which may not be the window the agent looked at. We let each action name its target window, so the click reaches the right application without disturbing the user.',
      '计算机使用智能体与用户共用同一台电脑。没有指定窗口的点击会落到最前面的窗口，而它未必是智能体刚才看到的那个窗口。因此我们让每个操作都写明目标窗口，点击就能到达正确的应用，也不会打扰用户。'),
    x, 292, { size: 17, weight: 400, fam: TK.sans, color: INK(), lh: 26, w, maxLines: 8 });
  }
  function drawPTeaser(c) {
    const x = 56;
    const w = 568;
    paperCard(c, x - 20, 222, w + 40, 280);
    const fy = 232;
    const fh = 222;
    c.fillStyle = '#FBF8F1'; c.fillRect(x, fy, w, fh);
    c.strokeStyle = A(TK.ink, 0.2); c.lineWidth = 1; c.strokeRect(x + 0.5, fy + 0.5, w - 1, fh - 1);
    // Figure 1: two overlapping windows, and the click going to the front one
    const win = (wx, wy, ww, wh, label, front) => {
      c.fillStyle = front ? '#FFFFFF' : '#EFEAE0'; c.fillRect(wx, wy, ww, wh);
      c.strokeStyle = A(TK.ink, front ? 0.75 : 0.45); c.lineWidth = 2; c.strokeRect(wx, wy, ww, wh);
      c.fillStyle = A(TK.ink, front ? 0.12 : 0.08); c.fillRect(wx, wy, ww, 26);
      text(c, label, wx + 12, wy + 18.5, { size: 15, weight: 600, fam: TK.sans, color: A(TK.ink, front ? 0.9 : 0.6) });
    };
    win(x + 60, fy + 26, 270, 160, 'Report.xlsx', false);
    win(x + 220, fy + 62, 290, 142, 'Chrome', true);
    // the cursor, the click, the cross
    c.strokeStyle = A(TK.ink, 0.8); c.lineWidth = 2; c.setLineDash([7, 6]);
    c.beginPath(); c.moveTo(x + 120, fy + 200); c.quadraticCurveTo(x + 220, fy + 150, x + 300, fy + 132); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.moveTo(x + 300, fy + 132); c.lineTo(x + 286, fy + 124); c.lineTo(x + 289, fy + 139); c.closePath(); c.fillStyle = A(TK.ink, 0.8); c.fill();
    c.strokeStyle = '#B03A2E'; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(x + 314, fy + 118); c.lineTo(x + 332, fy + 136); c.moveTo(x + 332, fy + 118); c.lineTo(x + 314, fy + 136); c.stroke();
    para(c, tr('Figure 1. An untargeted click lands in the front window.', '图 1：未指定目标的点击，落进了最前面的窗口。'), x, fy + fh + 28,
      { size: 16, weight: 400, italic: true, fam: SERIF, color: INK2(), lh: 22, w, maxLines: 1 });
  }
  function drawPResults(c) {
    const x = 664;
    const w = 560;
    paperCard(c, x - 20, 512, w + 40, 156);
    text(c, tr('Results', '结果'), x + w / 2, 542, { size: 25, weight: 700, fam: SERIF, color: INK(), align: 'center' });
    const cols = [x + 6, x + 196, x + 392];
    const head = zh() ? ['点击', '送达窗口', '打扰用户'] : ['Click', 'Delivered to', 'User interrupted'];
    const body = zh() ? [['未指定目标', 'Chrome', '是'], ['指定目标窗口', 'Report.xlsx', '否']] : [['Untargeted', 'Chrome', 'Yes'], ['Targeted', 'Report.xlsx', 'No']];
    hline(c, x, x + w, 558, INK(), 2);
    head.forEach((s, i) => text(c, s, cols[i], 582, { size: 16, weight: 700, fam: TK.sans, color: INK() }));
    hline(c, x, x + w, 592, A(TK.ink, 0.6), 1);
    body.forEach((r, j) => r.forEach((s, i) => text(c, s, cols[i], 620 + j * 30, { size: 16, weight: 400, fam: TK.sans, color: INK() })));
    hline(c, x, x + w, 660, INK(), 2);
  }
  function drawPVideo(c) {
    const x = 56;
    const w = 568;
    paperCard(c, x - 20, 512, w + 40, 280);
    text(c, tr('Video', '视频'), x + w / 2, 542, { size: 25, weight: 700, fam: SERIF, color: INK(), align: 'center' });
    const vw = 400;
    const vh = 225;
    const vx = x + (w - vw) / 2;
    const vy = 556;
    c.fillStyle = '#111317'; c.fillRect(vx, vy, vw, vh);
    const g = c.createLinearGradient(vx, vy, vx + vw, vy + vh);
    g.addColorStop(0, 'rgba(60,70,150,.55)'); g.addColorStop(1, 'rgba(170,80,140,.4)');
    c.fillStyle = g; c.fillRect(vx, vy, vw, vh - 34);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(vx + 40, vy + 34, 150, 96); c.fillRect(vx + 150, vy + 60, 190, 104);
    c.beginPath(); c.arc(vx + vw / 2, vy + (vh - 34) / 2, 34, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.92)'; c.fill();
    c.beginPath(); c.moveTo(vx + vw / 2 - 10, vy + (vh - 34) / 2 - 15); c.lineTo(vx + vw / 2 + 16, vy + (vh - 34) / 2); c.lineTo(vx + vw / 2 - 10, vy + (vh - 34) / 2 + 15); c.closePath();
    c.fillStyle = '#111317'; c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(vx + 14, vy + vh - 18, vw - 120, 3);
    text(c, '0:00 / 1:32', vx + vw - 14, vy + vh - 11, { size: 13, weight: 500, fam: TK.mono, color: 'rgba(255,255,255,.85)', align: 'right' });
  }
  function drawPBib(c) {
    // the page ground: the whole page is one printed sheet
    c.fillStyle = TK.paper; c.fillRect(-FW, -FH, 3 * FW, 3 * FH);
    const x = 664;
    const w = 560;
    text(c, 'BibTeX', x, 702, { size: 22, weight: 700, fam: SERIF, color: INK() });
    c.fillStyle = A(TK.ink, 0.07); c.fillRect(x, 714, w, 74);
    c.strokeStyle = A(TK.ink, 0.14); c.lineWidth = 1; c.strokeRect(x + 0.5, 714.5, w - 1, 73);
    ['@inproceedings{author2026targets,', '  title = {Targeted Clicks for Computer-Use Agents},', '  year  = {2026} }'].forEach((s, i) =>
      text(c, s, x + 14, 736 + i * 21, { size: 14, weight: 500, fam: TK.mono, color: INK(), max: w - 28 }));
  }

  /* ================================================================ the two stacks: layers, captions, cards */

  /* Every layer is a full-frame sheet, so the stack reads as layers of one part and the leader lines never cross. While
   * a layer is focused, its sheet is repainted with its piece magnified to fill the sheet (ZOOM: the piece's bounds on
   * the frame), so the close-up is readable; it returns to its place when the focus leaves. */
  const ZOOM = {
    stage: [32, 146, 852, 566], transport: [196, 159, 672, 38], code: [344, 574, 520, 70], outcome: [904, 140, 352, 330],
    folds: [904, 516, 352, 166], source: () => [28, 728, zh() ? 440 : 820, 34], facts: [92, 238, 640, 384],
    'p-abstract': [644, 222, 600, 280], 'p-teaser': [36, 222, 608, 280], 'p-results': [644, 512, 600, 156],
    'p-video': [36, 512, 608, 280], 'p-bib': [664, 680, 560, 110],
  };
  function zoomInto(c, id) {
    const z = typeof ZOOM[id] === 'function' ? ZOOM[id]() : ZOOM[id];   // a function: the box depends on the language
    if (!z) return;
    const [x, y, w, h] = z;
    const k = Math.min((FW - 120) / w, (FH - 120) / h, 2.4);
    c.translate(FW / 2 - (x + w / 2) * k, FH / 2 - (y + h / 2) * k);
    c.scale(k, k);
  }
  const OPERABLE = 'accent';
  const STATIC = 'var(--pm-paper)';

  /* What counts as cyan, in both stacks alike: the layer runs the mechanism (Play runs it, the progress bar moves it to
   * any moment). Everything else is read, opened, watched or copied: paper tone. A video plays, but it replays a
   * recording; the mechanism itself never runs on a project page. */
  const STACKS = {
    playme: {
      intro: B('This is Lab 01 above, as a reader sees it.', '这是上面的实验 01，读者看到的样子。'),
      apart: B('Take it apart: the eight layers of the part template.', '拆开它：部件模板的八个图层。'),
      end: B('Two layers run the mechanism; the other six explain it.', '两个图层让机制运行，其余六个负责解释。'),
      endTone: 'accent', operateTone: 'accent', checks: '9', checksTone: 'accent',
      layers: [
        { id: 'question', draw: drawQuestion, op: false, label: B('Question', '问题'), sub: B('read', '阅读'),
          cap: B('Question: one plain question, at most 14 words.', '问题：一句平实的提问，中文不超过 30 字。'),
          rule: 'R11', budget: B('≤ 14 words · ≤ 30 Chinese characters', '英文 ≤ 14 词 · 中文 ≤ 30 字'),
          round: 'R2.2', ask: B('"BENCHMARK HABITS" is not accurate', '“BENCHMARK HABITS”和“评测习惯”这个词很不准确') },
        { id: 'stage', draw: drawStage, op: true, label: B('Stage', '舞台'), sub: B('press Play', '按下播放'),
          cap: B('Stage: press Play and the mechanism runs.', '舞台：按下播放，机制就运行起来。'),
          rule: 'R1', budget: B('1 primary button · ≤ 2 options', '1 个主按钮 · 最多 2 个选项'), round: 'R1' },
        { id: 'transport', draw: drawTransport, op: true, label: B('Progress bar', '进度条'), sub: B('scrub', '拖动'),
          cap: B('Progress bar: scrub to any moment; marks show the key events.', '进度条：拖到任意时刻，标记指出关键事件。'),
          rule: 'R7', budget: B('every player · marks on key moments', '每个播放器都有 · 关键时刻有标记'), round: 'R4.2' },
        { id: 'code', draw: drawCode, op: false, label: B('Code + intent', '代码 + 意图'), sub: B('read', '阅读'),
          cap: B('Code: each line says what it does; one token outlined.', '代码：每行写明用意，关键参数加框。'),
          rule: 'R8', budget: B('plain words per line · one token outlined · scrolls both ways', '每行写明用意 · 一个关键参数 · 可横竖滚动'), round: 'R4.3' },
        { id: 'outcome', draw: drawOutcome, op: false, label: B('Outcome', '结果'), sub: B('read', '阅读'),
          cap: B('Outcome: readouts fill during the run, then one sentence.', '结果：读数随运行填入，最后是一句结论。'),
          rule: 'R2', budget: B('readouts fill during the run · one takeaway', '读数随运行填入 · 一句结论'),
          round: 'R2.5', ask: B('so much comes before it that it took me a long time to understand', '对比之前内容太多，我费了半天劲才理解') },
        { id: 'folds', draw: drawFolds, op: false, label: B('Go deeper', '深入了解'), sub: B('open', '展开'),
          cap: B('Go deeper: knowledge waits in at most four closed folds.', '深入了解：知识收进最多四个折叠区。'),
          rule: 'R12', budget: B('≤ 4 folds · all closed at rest', '最多 4 个折叠区 · 未操作时全部收起'), round: 'R2.4' },
        { id: 'source', draw: drawSource, op: false, label: B('Source line', '来源行'), sub: B('read', '阅读'),
          cap: B('Source line: flat text, never shaped like a button.', '来源行：纯文字，绝不做成按钮的样子。'),
          rule: 'R5', budget: B('0 labels that look clickable', '0 个看似可点的标签'),
          round: 'R2.1', ask: B('I thought "Simulation" and "Paper Fig. 6" were clickable.', '一开始还以为“示意模拟”“论文图 6”也可以交互') },
        { id: 'facts', draw: drawFacts, op: false, label: B('Facts', '事实数据'), sub: B('checked by script', '脚本核对'),
          cap: B('Facts: the numbers live in facts.json; a script checks them.', '事实数据：数字都存在 facts.json 里，由脚本核对。'),
          rule: 'R13', budget: B('numbers equal facts.json · quotes match the paper', '数字与 facts.json 一致 · 引文与论文一致'),
          round: 'R3.1', ask: B('Nothing on the site may contradict the paper', '请确保网站的信息不会和 paper 矛盾') },
      ],
    },
    page: {
      intro: B('A classic project page, as the reader sees it.', '这是传统项目主页，读者看到的样子。'),
      apart: B('Take it apart: six layers, all printed like paper.', '拆开它：六个图层，全都像印在纸上。'),
      end: B('No layer runs the mechanism; the video replays a recording.', '没有一个图层能运行机制，视频也只是回放录像。'),
      endTone: 'err', operateTone: 'err', checks: '0', checksTone: 'err',
      layers: [
        { id: 'p-title', draw: drawPTitle, label: B('Title & authors', '标题与作者'), sub: B('read', '阅读'),
          cap: B('Title and authors: read once, then scroll on.', '标题与作者：读一遍，接着往下翻。'),
          does: B('reads the title, then scrolls on', '读完标题，继续往下翻'), becomes: B('Question: one plain question right above the stage', '问题：一句平实的提问，紧贴在舞台上方'), rule: 'R11' },
        { id: 'p-abstract', draw: drawPAbstract, label: B('Abstract', '摘要'), sub: B('read', '阅读'),
          cap: B('Abstract: the claim, told in one paragraph.', '摘要：用一段文字讲出结论。'),
          does: B('reads a paragraph about the mechanism', '读一段描述机制的文字'), becomes: B('Stage: press Play and watch the mechanism work', '舞台：按下播放，看着机制运行'), rule: 'R1' },
        { id: 'p-teaser', draw: drawPTeaser, label: B('Teaser figure', '预告图'), sub: B('look', '看图'),
          cap: B('Teaser figure: one frozen moment of the mechanism.', '预告图：机制被定格在一个瞬间。'),
          does: B('looks at one frozen moment', '看一个被定格的瞬间'), becomes: B('Progress bar: scrub to any moment of the run', '进度条：拖到运行中的任意时刻'), rule: 'R7' },
        { id: 'p-results', draw: drawPResults, label: B('Results table', '结果表'), sub: B('read', '阅读'),
          cap: B('Results table: numbers to read, with nothing to try.', '结果表：数字只能读，没法亲手试。'),
          does: B('reads numbers it cannot try', '读数字，但没法亲手试'), becomes: B('Outcome: readouts that fill as the run happens', '结果：读数随运行逐个填入'), rule: 'R2' },
        { id: 'p-video', draw: drawPVideo, label: B('Video', '视频'), sub: B('watch a recording', '看录像'),
          cap: B('Video: it plays, but it is a recording; the mechanism never runs.', '视频：能播放，但只是录像，机制本身没有运行。'),
          does: B('watches a recording; nothing else on the page follows it', '看一段录像，页面上别的内容都不跟着变'),
          becomes: B('Code + intent: the line that runs is marked as the scene moves', '代码 + 意图：场景动到哪一步，就标出正在执行的那行代码'), rule: 'R8' },
        { id: 'p-bib', draw: drawPBib, label: B('BibTeX', 'BibTeX'), sub: B('copy', '复制'),
          cap: B('BibTeX: a citation block to copy.', 'BibTeX：一段供复制的引用。'),
          does: B('copies a citation', '复制一段引用'), becomes: B('Source line: says simulation, real run or paper', '来源行：写明是模拟、真实运行还是论文'), rule: 'R13' },
      ],
    },
  };

  /* ---------------------------------------------------------------- the review ledger (site/data/ledger.js) */

  const LEDGER = window.PMSiteLedger || { rules: {}, rounds: [] };
  function ruleName(id) { const r = LEDGER.rules && LEDGER.rules[id]; return r ? B(r.en, r.zh) : B(id, id); }
  /** {it, round} for a ledger id ('R2.5', or 'R1' for the brief), or null */
  function ledgerItem(id) {
    for (const round of LEDGER.rounds || []) for (const it of round.items || []) if (it.id === id) return { it, round };
    return null;
  }
  /** A ledger id written as 'Round 2 · comment 5 · 10-14': the bare 'R' is kept for rules. */
  function roundName(id, round) {
    const m = /^R(\d+)(?:\.(\d+))?$/.exec(id) || [];
    const r = m[1] || '?';
    const d = round && round.date ? ` · ${round.date}` : '';
    if (m[2]) return B(`Round ${r} · comment ${m[2]}${d}`, `第 ${r} 轮评审 · 第 ${m[2]} 条${d}`);
    if (r === '1') return B(`Round 1 · the brief${d}`, `第 1 轮 · 需求说明${d}`);
    return B(`Round ${r}${d}`, `第 ${r} 轮${d}`);
  }
  /** The author's words behind a layer: the excerpt the layer names (only if it really is part of the comment, with
   * elision marks where the comment goes on), else the whole comment. */
  function quoteOf(it, ask) {
    const cut = (full, ex) => {
      const at = ex ? full.indexOf(ex) : -1;
      // a cut is marked only where words are left out (not a lone closing full stop)
      return at < 0 ? { s: full, pre: false, post: false } : { s: ex, pre: at > 0, post: /[\p{L}\p{N}]/u.test(full.slice(at + ex.length)) };
    };
    const en = cut(it.en, ask && ask.en);
    const cn = cut(it.zh || it.en, ask && ask.zh);
    const inner = (t) => String(t).replace(/"([^"]*)"/g, '‘$1’');   // quotes inside a quote become single quotes
    return PM.L(`“${en.pre ? '… ' : ''}${inner(en.s)}${en.post ? ' …' : ''}”`, `「${cn.pre ? '……' : ''}${cn.s}${cn.post ? '……' : ''}」`,
      'span', { class: 'pmx-anatomy-quote' });
  }
  const END_EXPLODE = 0.5;   // the end frame: closer sheets, so the camera comes nearer and the stage is legible

  /* ================================================================ mount */

  PMSite.register('anatomy', function mount(host) {
    const P = PM.part(host, {
      id: 'anatomy',
      eyebrow: PM.L('Lab 03 · Anatomy', '实验 03 · 解剖'),
      q: PM.L('What is inside one PLAYME part?', '一个 PLAYME 部件里有什么？'),
      lead: PM.L('Take Lab 01 apart, layer by layer. Then do the same with a classic project page.', '把实验 01 一层层拆开，再用同样的方法拆一张传统项目主页。'),
      takeaway: PM.L('Eight layers: two run the mechanism, six explain it. A project page only explains.', '八个图层：两个让机制运行，六个负责解释。传统项目主页只有解释。'),
      source: [{ kind: 'note', text: PM.L('Part template of the PLAYME kit · SKILL.md', 'PLAYME 组件库的部件模板 · SKILL.md') }],
      flush: true,
      folds: [
        { title: PM.L('The budgets', '读者负担预算'), teaser: PM.L('How lint.mjs measures every part, at rest', 'lint.mjs 如何测量未操作时的每个部件'), render: foldBudgets },
        { title: PM.L('Why a fixed template', '为什么用固定模板'), teaser: PM.L('Readers learn it once; one PM.part() call builds it', '读者学一次就会；一次 PM.part() 调用就能搭好'), render: foldWhy },
      ],
    });
    TK = readTokens(P.el);

    /* ---- scene: the 3D view, then the inspector line under it */
    const wrap = PM.h('div', { class: 'pmx-anatomy-view' });
    const legend = PM.h('p', { class: 'pmx-anatomy-legend' },
      PM.h('span', { class: 'pmx-anatomy-key is-op' }, PM.L('Glows cyan: the reader runs the mechanism here', '青色发光：读者在这里运行机制')),
      PM.h('span', { class: 'pmx-anatomy-key is-static' }, PM.L('Paper tone: the reader reads or watches', '纸张色：读者只能读或看')),
      PM.h('span', { class: 'pmx-anatomy-key is-hint' }, PM.L('Click a layer for its rule', '点击图层，查看它来自哪条规则')));
    const card = PM.h('div', { class: 'pmx-anatomy-card', hidden: true });
    const info = PM.h('div', { class: 'pmx-anatomy-info', 'aria-live': 'polite' }, legend, card);
    P.scene.append(wrap, info);

    let kind = 'playme';
    let cur = null;          // {host, view, ready, stack}
    let cardFor = null;      // id shown in the card, or null
    let byReader = false;    // the card was opened by the reader (not by the guided pass)

    function layersOf(stack) {
      return stack.layers.map((Ly) => ({
        id: Ly.id, label: Ly.label, sub: Ly.sub, w: FW, h: FH,
        draw: (c) => { if (zoomPainted === Ly.id) zoomInto(c, Ly.id); Ly.draw(c); },
        tint: stack === STACKS.playme ? (Ly.op ? OPERABLE : STATIC) : STATIC,
      }));
    }
    /* the focused layer is painted magnified; repaints are batched to one per frame and only touch layers whose state
     * changed, so an instant seek through eight stops costs at most two repaints */
    let zoomWant = null;
    let zoomPainted = null;
    let zoomRaf = 0;
    function setZoom(id) {
      zoomWant = id && ZOOM[id] ? id : null;
      if (!zoomRaf) zoomRaf = requestAnimationFrame(flushZoom);
    }
    function flushZoom() {
      zoomRaf = 0;
      if (zoomWant === zoomPainted || !cur) return;
      const ids = [zoomPainted, zoomWant].filter(Boolean);
      zoomPainted = zoomWant;
      cur.view.redraw(ids);
    }
    // texels per layer px: a focused piece is magnified up to ~1.5×, so paint sharper than the kit's default
    function texScale() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      return (document.documentElement.clientWidth || 1440) < 700 ? Math.min(1.6, Math.max(1.1, dpr * 0.8)) : Math.min(2.2, Math.max(1.6, dpr * 1.1));
    }
    function build(k) {
      const stack = STACKS[k];
      zoomWant = null;
      zoomPainted = null;
      const hostEl = PM.h('div', { class: ['pmx-anatomy-stack', 'is-flat'], dataset: { stack: k } });
      wrap.append(hostEl);
      const ready = PM.layers3d(hostEl, {
        layers: layersOf(stack),
        tilt: { x: -0.42, y: 0.5 },
        height: 'var(--pmx-anatomy-h, 520px)',
        labelWidth: 230,
        textureScale: texScale(),
        labelsTitle: k === 'playme' ? B('Layers of a PLAYME part', 'PLAYME 部件的图层') : B('Layers of a classic project page', '传统项目主页的图层'),
        ariaLabel: k === 'playme'
          ? B('Exploded view of the eight layers of a PLAYME part. Keys 1 to 8 pick a layer; arrow keys turn the view.', 'PLAYME 部件八个图层的拆解视图。数字键 1 到 8 选择图层，方向键旋转视角。')
          : B('Exploded view of the six layers of a classic project page. Keys 1 to 6 pick a layer; arrow keys turn the view.', '传统项目主页六个图层的拆解视图。数字键 1 到 6 选择图层，方向键旋转视角。'),
        // a pick or a camera move opens a flat stack (the kit explodes it), so the leader lines come back
        onPick(id) { setFlat(false); openCard(id, true); if (player.state === 'running') player.pause(); },
        onFocus(id) { setZoom(id); if (id == null && byReader) closeCard(); },
        onUserCam() { setFlat(false); if (player.state === 'running') player.pause(); },
      });
      ready.catch((err) => console.warn('[anatomy] the 3D view did not start', err));
      return { host: hostEl, view: ready.view, ready, stack, kind: k, alpha: {} };
    }
    /* Flat (explode 0) every sheet lies in one plane, so a leader line from a label means nothing: hide the lines (a
     * hovered label keeps its own) until the stack comes apart. */
    function setFlat(b) { if (cur) cur.host.classList.toggle('is-flat', !!b); }
    /** a layer's opacity, set only when it changes (each change repaints the flat composite) */
    function fade(id, a, o) {
      if ((cur.alpha[id] ?? 1) === a) return;
      cur.alpha[id] = a;
      cur.view.setOpacity(id, a, o);
    }
    cur = build(kind);
    const view = () => cur.view;

    // canvas text uses the page's web fonts; repaint once the faces the layers use are in (the kit repaints too)
    if (document.fonts && document.fonts.load) {
      Promise.all([`700 45px ${TK.display}`, `500 20px ${TK.mono}`, `600 18px ${TK.sans}`].map((f) => document.fonts.load(f).catch(() => null)))
        .then(() => { if (cur) cur.view.redraw(); });
    }

    /* ---- swap the stack: a new view under the old one, then the old one fades away */
    function swap(k) {
      if (k === kind || !STACKS[k]) return;
      kind = k;
      if (seg && seg.value !== k) seg.set(k, { silent: true });
      const old = cur;
      cur = build(k);
      closeCard();
      player.reset();
      if (!old) return;
      old.host.classList.add('is-leaving');
      wrap.append(old.host);   // keep the leaving view on top
      const drop = () => { if (!old.host.isConnected) return; try { old.view.dispose(); } catch (_) { /* ignore */ } old.host.remove(); };
      if (PM.reduced()) { drop(); return; }
      cur.ready.then(() => {
        requestAnimationFrame(() => {
          old.host.classList.add('is-gone');
          old.host.addEventListener('transitionend', drop, { once: true });
          setTimeout(drop, 700);   // cleanup only: the fade is polish, the new view is already in place
        });
      }, drop);
    }

    /* ---- the inspector line */
    /** the card's content for layer i of a stack: its head, then rule, budget and the review comment behind it (a PLAYME
     * layer), or what the reader does and what it becomes in a PLAYME part (a project-page layer) */
    function cardParts(stack, i) {
      const Ly = stack.layers[i];
      const head = PM.h('div', { class: 'pmx-anatomy-card-head' },
        PM.h('span', { class: 'pmx-anatomy-badge', 'aria-hidden': 'true' }, String(i + 1)),
        PM.h('span', { class: 'pmx-anatomy-card-name' }, PM.L(Ly.label)),
        PM.h('span', { class: 'pmx-anatomy-card-kind' }, PM.L(Ly.sub)));   // the same verb as in the label column
      const rows = PM.h('dl', { class: 'pmx-anatomy-card-rows' });
      const row = (k2, v) => rows.append(PM.h('div', null, PM.h('dt', null, k2), ' ', PM.h('dd', null, v)));
      if (stack === STACKS.playme) {
        row(PM.L('Rule', '规则'), [PM.h('b', null, Ly.rule), ' ', PM.L(ruleName(Ly.rule))]);
        row(PM.L('Budget', '预算'), PM.L(Ly.budget));
        const at = ledgerItem(Ly.round);
        row(PM.L('Asked for in', '出自'), [PM.L(roundName(Ly.round, at && at.round), 'span', { class: 'pmx-anatomy-round' }), ' ', at ? quoteOf(at.it, Ly.ask) : null]);
      } else {
        row(PM.L('The reader', '读者'), PM.L(Ly.does));
        row(PM.L('In a PLAYME part', '在 PLAYME 部件里'), PM.L(Ly.becomes));
        row(PM.L('Rule', '规则'), [PM.h('b', null, Ly.rule), ' ', PM.L(ruleName(Ly.rule))]);
      }
      return [head, rows];
    }
    function openCard(id, reader) {
      const stack = cur.stack;
      const i = stack.layers.findIndex((x) => x.id === id);
      if (i < 0) { closeCard(); return; }
      const Ly = stack.layers[i];
      cardFor = id;
      byReader = !!reader;
      // the narration already speaks during the guided pass; the card is announced only when the reader asked for it
      info.setAttribute('aria-live', byReader ? 'polite' : 'off');
      const op = stack === STACKS.playme && Ly.op;
      card.textContent = '';
      card.classList.toggle('is-op', op);
      const x = PM.h('button', { type: 'button', class: 'pmx-anatomy-x', 'aria-label': B('Close the layer card', '关闭图层卡片'), onClick: () => { closeCard(); view().focus(null); } }, PM.icon('close'));
      card.append(...cardParts(stack, i), x);
      card.style.setProperty('--pmx-c', op ? 'var(--pm-accent)' : 'var(--pm-paper)');
      card.hidden = false;
      legend.hidden = true;
      sizeInfo();
    }
    function closeCard() {
      cardFor = null;
      byReader = false;
      card.hidden = true;
      card.textContent = '';
      legend.hidden = false;
      sizeInfo();
    }

    /* Phones: the inspector line is as tall as what it holds. At rest that is the two-line legend; during the guided pass
     * it is the tallest card of the stack, so the line grows once when the pass reaches its first layer and keeps its
     * height from layer to layer; a card the reader picks takes its own height. Wider screens keep the fixed height set in
     * anatomy.css. */
    const phoneMQ = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
    let tallKey = '';
    let tallH = 0;
    function tallestCard() {
      const key = `${kind}|${PM.lang()}|${info.clientWidth}`;
      if (key === tallKey) return tallH;
      const probe = PM.h('div', { class: ['pmx-anatomy-card', 'is-probe'], 'aria-hidden': 'true' });
      info.append(probe);
      let mx = 0;
      cur.stack.layers.forEach((_, i) => { probe.textContent = ''; probe.append(...cardParts(cur.stack, i)); mx = Math.max(mx, probe.offsetHeight); });
      probe.remove();
      tallKey = key;
      tallH = mx;
      return mx;
    }
    function sizeInfo() {
      if (!phoneMQ || !phoneMQ.matches || !cur) { info.style.removeProperty('--pmx-info-h'); return; }
      const cs = getComputedStyle(info);
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      // a card the reader picked takes its own height; during the guided pass every card gets the tallest one's
      const inner = card.hidden ? legend.offsetHeight : byReader ? card.offsetHeight : tallestCard();
      info.style.setProperty('--pmx-info-h', `${Math.ceil(inner + pad)}px`);
    }
    let sizeRaf = 0;
    const sizeSoon = () => { if (!sizeRaf) sizeRaf = requestAnimationFrame(() => { sizeRaf = 0; sizeInfo(); }); };
    if (phoneMQ) { if (phoneMQ.addEventListener) phoneMQ.addEventListener('change', sizeSoon); else if (phoneMQ.addListener) phoneMQ.addListener(sizeSoon); }
    window.addEventListener('resize', sizeSoon, { passive: true });
    PM.onLang(sizeSoon);
    P.el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cardFor && byReader) { closeCard(); view().focus(null); } });
    document.addEventListener('pointerdown', (e) => {
      if (!cardFor || !byReader) return;
      if (wrap.contains(e.target) || info.contains(e.target)) return;
      closeCard();
      view().focus(null);
    }, { passive: true });

    /* ---- bar: the option (the player puts its primary first and the transport last) */
    const seg = PM.segmented(P, {
      options: [{ id: 'page', label: PM.L('Project page', '项目主页') }, { id: 'playme', label: PM.L('PLAYME part', 'PLAYME 部件') }],
      value: 'playme',
      ariaLabel: B('Which page to take apart', '拆开哪一种页面'),
      onChange: swap,
    });

    /* ---- outcome */
    const out = PM.readouts(P.outcome, [
      { id: 'layers', label: PM.L('Layers', '图层') },
      { id: 'operate', label: PM.L('Run the mechanism', '运行机制的图层') },
      { id: 'checks', label: PM.L('Budgets lint checks', '受检预算项') },
    ]);

    /* ---- the story */
    const player = PM.player(P, {
      label: B('Take it apart', '拆开看看'),
      hint: B('Press “Take it apart”, or click any layer.', '按“拆开看看”，或直接点击任意图层。'),
      reset() {
        closeCard();
        const v = view();
        v.light(null);
        v.reset({ snap: true });
        v.explode(0, { snap: true });
        Object.keys(cur.alpha).forEach((id) => fade(id, 1, { snap: true }));
        setFlat(true);
        out.reset();
      },
      async run(ctx) {
        const v = view();
        const stack = cur.stack;
        const N = stack.layers.length;
        const snap = () => ({ snap: ctx.seeking });
        ctx.narrate(stack.intro);
        await ctx.sleep(1600);
        ctx.narrate(stack.apart);
        // linear k: the kit already eases the separation and the camera swing (smoothstep)
        await ctx.tween(2300, (k) => { v.explode(k, { snap: true }); setFlat(k < 0.02); });
        await ctx.sleep(300);
        let operable = 0;
        for (let i = 0; i < N; i++) {
          const Ly = stack.layers[i];
          const op = stack === STACKS.playme && Ly.op;
          v.focus(Ly.id, snap());
          openCard(Ly.id, false);
          ctx.narrate(Ly.cap, op ? 'accent' : 'neutral');
          ctx.mark(Ly.label, op ? 'accent' : 'neutral');
          if (op) operable += 1;
          out.set('layers', `${i + 1}`);
          out.set('operate', `${operable} / ${N}`, operable ? stack.operateTone : null);
          await ctx.sleep(2000);
        }
        v.focus(null, snap());
        closeCard();
        // the payoff frame: a tighter, larger stack; the layers that run the mechanism stay bright, the others fade back
        v.explode(END_EXPLODE, snap());
        // (the facts card, deepest, fades further: it would show through the stage's code hole)
        if (stack === STACKS.playme) stack.layers.forEach((Ly) => fade(Ly.id, Ly.op ? 1 : Ly.id === 'facts' ? 0.18 : 0.42, snap()));
        out.set('operate', `${operable} / ${N}`, stack.operateTone);
        out.set('checks', stack.checks, stack.checksTone);
        ctx.narrate(stack.end, stack.endTone);
        await ctx.sleep(1900);
      },
    });

    /* ================================================================ folds */

    /* The budget table lives in one place on the page, the Workflow lab's fold on the checks; this fold says how the budgets are
     * measured and links there, so the page never shows two versions of the same table. */
    const CHECKS_PART = 'pipeline';
    /** the lab number the chapter bar gives a slot ('05 Workflow' → '05'), or null */
    function labNo(slotId) {
      const slot = document.querySelector(`[data-pm-slot="${slotId}"]`);
      const sec = slot && slot.closest('[data-chapter-en]');
      const m = sec && /^(\d+)/.exec(sec.getAttribute('data-chapter-en') || '');
      return m ? m[1] : null;
    }
    /** the fold of the checks part that holds the budget table (its title names the checks), else its first fold */
    function checksFold() {
      const part = document.getElementById(CHECKS_PART);
      const folds = part ? [...part.querySelectorAll('details.pm-fold')] : [];
      const titled = folds.find((d) => {
        const t = d.querySelector('.pm-fold-title [data-l-en], .pm-fold-title');
        return /check/i.test((t && (t.getAttribute('data-l-en') || t.textContent)) || '');
      });
      return titled || folds[0] || null;
    }
    function goToChecks(e) {
      const det = checksFold();
      if (!det) return;   // no such part on this page: the plain #anchor still works
      e.preventDefault();
      det.open = true;
      const sum = det.querySelector('summary') || det;
      const target = () => {
        const bar = document.querySelector('.topbar');
        return Math.max(0, Math.round(sum.getBoundingClientRect().top + window.scrollY - ((bar && bar.offsetHeight) || 0) - 24));
      };
      const smooth = !PM.reduced();
      window.scrollTo({ top: target(), behavior: smooth ? 'smooth' : 'auto' });
      if (smooth) {
        // the page can change height on the way (a stage's sticky bar turns compact on phones): land on the fold at the end
        let settled = false;
        const settle = () => {
          if (settled) return;
          settled = true;
          window.removeEventListener('scrollend', settle);
          const t = target();
          if (Math.abs(t - window.scrollY) > 4) window.scrollTo({ top: t, behavior: 'auto' });
        };
        window.addEventListener('scrollend', settle);
        setTimeout(settle, 1500);
      }
      try { sum.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    }
    function foldBudgets(el) {
      el.append(PM.L('lint.mjs opens the page in a headless browser and measures every part at rest, at each width and in each language. One broken budget fails the check.',
        'lint.mjs 用无头浏览器打开页面，在每种宽度、每种语言下，测量每个部件未操作时的状态。任何一项超出预算，检查就不通过。', 'p', { class: 'pmx-anatomy-p' }));
      el.append(PM.L('Each layer card above names the budget its layer must meet: the question’s length, one primary button, the number of controls and folds, and no labels that look clickable.',
        '上面每张图层卡片都写着该图层要守的预算：问题的长度、唯一的主按钮、控件和折叠区的数量，以及不能有看起来可点击的标签。', 'p', { class: 'pmx-anatomy-p' }));
      if (document.getElementById(CHECKS_PART)) {
        const n = labNo(CHECKS_PART) || '04';
        el.append(PM.h('p', { class: 'pmx-anatomy-p' },
          PM.h('a', { class: 'pmx-anatomy-jump', href: `#${CHECKS_PART}`, onClick: goToChecks },
            PM.L(`All budgets, and what each check catches, in Lab ${n} ↓`, `全部预算及每项检查能发现什么，见实验 ${n} ↓`))));
      }
      PM.code(el, { src: 'node scripts/lint.mjs --url PLAYME.html --widths 1440,400 --langs en,zh', lang: 'bash', lineNumbers: false, title: PM.L('Run it', '运行') });
    }

    function foldWhy(el) {
      [
        B('A reader who has played one part knows where every other part keeps its question, its button, its progress bar and its result. The second part takes less effort than the first.',
          '玩过一个部件的读者，就知道其他部件的问题、按钮、进度条和结果分别在哪里。第二个部件读起来比第一个更省力。'),
        B('The template also guards the budgets. Every part gets the same slots: a question, a stage whose player always has a progress bar, a source line and closed folds. lint.mjs then checks the budgets at both widths and in both languages.',
          '模板也守住了预算：每个部件都有同样的位置，放问题、舞台（播放器一定带进度条）、来源行和收起的折叠区。lint.mjs 再在两种宽度、两种语言下检查各项预算。'),
        B('Each layer answers a real author request. In the review of the OpenGCUA lab, built with PLAYME, round 4 asked for progress bars, round 2 for closed folds and round 7 for “Paper §” references.',
          '每个图层都回应了作者的一条真实意见。在用 PLAYME 构建的 OpenGCUA 实验室的评审中，第 4 轮要求加进度条，第 2 轮要求默认收起折叠区，第 7 轮要求“Paper §”式的引用写法。'),
      ].forEach((b) => el.append(PM.L(b, 'p', { class: 'pmx-anatomy-p' })));
      el.append(PM.intent(null, PM.L('Lab 01 declares its part once; the kit builds the layers from it', '实验 01 只声明一次部件，组件库据此搭出各个图层')));
      PM.code(el, {
        lang: 'js',
        title: 'parts/read-or-play.js',
        focus: ['PM.part', 'PM.player'],
        src: [
          'const P = PM.part(host, {',
          "  q: L('Read it, or play it?', '读一遍，还是玩一遍？'),                                // 1 Question",
          "  takeaway: L('Reading states the rule. Playing shows why it matters.', …),        // 5 Outcome",
          "  source: [{ kind: 'sim', text: L('Simulation for illustration · adapted from the OpenGCUA case study', …) }],  // 7 Source line",
          "  folds: [{ title: L('How this part is built', …), teaser: L(…), render: buildFold }, …],  // 6 Go deeper",
          '});',
          "const code = PM.code(codeHost, { src, lang: 'python', focus: ['window=\"Report.xlsx\"'] });  // 4 Code + intent",
          "const out = PM.readouts(P.outcome, [{ id: 'a', label: bi('Untargeted click', …) }, …]);   // 5 Outcome",
          'PM.player(P, {                                                      // 2 Stage + 3 Progress bar',
          '  reset,',
          '  async run(ctx) {',
          '    …',
          '    await ctx.tween(1200, (k) => glide(agent, AGENT0, CLICK, k), PM.ease.inOut);',
          '    const hit = desk.windowAt(...CLICK);                // the front window at (612, 404)',
          "    ctx.mark(MARK.a, 'err');",
          "    out.set('a', `${hit ? hit.app : '—'} ✗`, 'err');",
          '    …',
          '  },',
          '});',
          '// 8 Facts: values shown with data-fact="key" are checked against facts.json;',
          '//   "Paper §x.y" references are checked against the paper (fidelity.py)',
        ].join('\n'),
      });
    }

    sizeSoon();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { tallKey = ''; sizeSoon(); }).catch(() => {});

    // QA hooks (read-only use in tests)
    P.el.pmxAnatomy = { view, swap, kind: () => kind, card: () => cardFor };
  });
})();
