/* Part 'patterns' of the PLAYME homepage: the nine lab patterns as a gallery.
 *
 * Left: nine tiles (in-scene targets), each with a static key-frame drawing and the pattern's name. Right: the detail
 * stage for the selected tile: the pattern's question, a live mini demo with generic content, and one "Use it when"
 * line. One player; its run() dispatches to the selected demo. Selecting a tile rebuilds the demo, then
 * player.reset() returns to rest and re-measures the new story, so the scrubber shows its marks before Play.
 *
 * The demos use generic machine-learning content (a classifier, decoding, a transformer block, early exit, an
 * inference server, training checkpoints, a training loop) plus two computer-use scenes, so readers with any kind of
 * paper see their kind of claim. Tiles whose form another lab on this page already uses link back to it.
 *
 * Every demo is a pure function of the virtual clock: all waits and motion go through ctx.sleep / ctx.tween, and
 * reset() restores every visible state. Positions that depend on layout are read from offsets (never from
 * transforms), and a resize re-renders the current moment. Strings are bilingual ({en, zh} or PM.L).
 * Styles: patterns.css (.pm #patterns / .pm .pmx-patterns-…). */
(function () {
  'use strict';
  if (!window.PM || !window.PMSite) return;

  const X = 'pmx-patterns-';
  const T = (en, zh) => ({ en, zh });
  const { lerp, clamp } = PM;
  const io = PM.ease.inOut;
  const eo = PM.ease.out;
  /** class list: tokens starting with "pm-" are kit classes, everything else gets the part prefix */
  const cx = (s) => String(s).split(/\s+/).filter(Boolean).map((c) => (c.startsWith('pm-') ? c : X + c)).join(' ');
  const el = (tag, c, ...kids) => PM.h(tag, c ? { class: cx(c) } : null, ...kids);
  /** 0 → 1 → 0 envelope for deterministic flashes driven by a tween's k */
  const pulse = (k) => (k <= 0 || k >= 1 ? 0 : k < 0.16 ? k / 0.16 : (1 - k) / 0.84);
  /** a small integer hash in [0, 1): fixed "noise" that is the same on every run */
  const hash = (i) => { let x = Math.imul((i + 1) >>> 0, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };

  /** Layout box of node relative to root (offsets: transforms are ignored, so a moved element keeps its home). */
  function rel(node, root) {
    let x = 0; let y = 0; let n = node;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: node.offsetWidth, h: node.offsetHeight };
  }
  const mid = (r, fx = 0.5, fy = 0.5) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy });

  /** An arrow pointer in the kit's style (.pm-ptr), placed in px inside a positioned parent. */
  const PTR_PATH = 'M2.2 1.6v20.6l5-4.7 3.3 7.8 3.6-1.6-3.3-7.6h6.9z';
  function pointer(kind, label) {
    const glyph = PM.s('svg', { class: 'pm-ptr-glyph', viewBox: '0 0 20 28', width: 20, height: 28, 'aria-hidden': 'true', focusable: 'false' });
    glyph.innerHTML = `<path class="pm-ptr-tip" d="${PTR_PATH}" stroke-width="1.7" stroke-linejoin="round"/>`;
    const lab = PM.h('span', { class: 'pm-ptr-label' });
    const node = PM.h('div', { class: ['pm-ptr', 'is-arrow', `is-${kind}`, `${X}ptr`], 'aria-hidden': 'true' }, PM.h('span', { class: 'pm-ptr-in' }, glyph, lab));
    const api = {
      el: node,
      at(p) { node.style.left = `${p.x.toFixed(1)}px`; node.style.top = `${p.y.toFixed(1)}px`; return api; },
      kind(k) { node.classList.toggle('is-agent', k === 'agent'); node.classList.toggle('is-user', k === 'user'); return api; },
      label(v) { lab.replaceChildren(); if (v) lab.append(PM.L(v)); lab.hidden = !v; return api; },
      show(on) { node.hidden = !on; return api; },
    };
    api.label(label);
    return api;
  }
  /** A click ripple: set(point, k, tone); k outside (0, 1) hides it. */
  function ripple(parent) {
    const r = el('i', 'ring');
    r.hidden = true;
    parent.append(r);
    return {
      set(p, k, tone) {
        if (!(k > 0 && k < 1)) { r.hidden = true; r.removeAttribute('style'); delete r.dataset.tone; return; }
        r.hidden = false;
        r.dataset.tone = tone || 'accent';
        r.style.left = `${p.x}px`;
        r.style.top = `${p.y}px`;
        r.style.transform = `translate(-50%, -50%) scale(${(0.3 + 1.7 * eo(k)).toFixed(3)})`;
        r.style.opacity = (1 - k).toFixed(3);
      },
    };
  }
  /** A full-cover flash layer: set(k, tone) with a pulse envelope. */
  function flashLayer(parent, cls = 'flash') {
    const f = el('i', cls);
    parent.append(f);
    return { el: f, set(k, tone) { f.dataset.tone = tone || 'warn'; f.style.opacity = pulse(k).toFixed(3); } };
  }
  /** "a vs b" for a readout, each side in its tone ("a : b" in Chinese) */
  const vs = (a, ta, b, tb) => PM.h('span', { class: `${X}vs` }, PM.h('b', { class: `${X}is-${ta}` }, a), PM.L(' vs ', ' : ', 'i'), PM.h('b', { class: `${X}is-${tb}` }, b));
  /** window chrome dots */
  const dots = () => [el('i', 'dot'), el('i', 'dot'), el('i', 'dot')];

  /* ================================================================== 01 · Exploded view: a transformer block */

  function demoExploded(box) {
    // front: the block as a paper's figure draws it (paper tone: the presentation side)
    const fig = el('div', 'exp-plane exp-fig',
      el('div', 'fig-flow',
        el('i', 'fig-wire'), el('i', 'fig-skip s1'), el('i', 'fig-skip s2'),
        el('span', 'fig-io c1', 'x'),
        el('span', 'fig-box c3', T('Attention', '注意力')),
        el('span', 'fig-add c4', el('span', null, '+')),
        el('span', 'fig-box c5', el('span', null, 'MLP')),
        el('span', 'fig-add c6', el('span', null, '+')),
        el('span', 'fig-io c7', 'y')),
      el('span', 'fig-cap', T('Figure 1. One transformer block.', '图 1　一个 Transformer 块')));
    // inside "Attention": eight heads, each a 6 × 6 causal attention pattern (query row r looks at key c ≤ r)
    const HEADS = [
      (r, c) => (r === c ? 1 : 0.07),
      (r, c) => (c === r - 1 || (r === 0 && c === 0) ? 1 : 0.06),
      (r, c) => (c === 0 ? 0.9 : 0.1),
      (r) => 0.62 / (r + 1) + 0.14,
      (r, c) => (r - c <= 1 ? 0.8 : 0.07),
      (r, c) => ((r - c) % 2 === 0 ? 0.72 : 0.08),
      (r, c) => (r < 3 ? (r === c ? 0.9 : 0.06) : c === r - 3 ? 1 : 0.07),
      (r, c) => 0.12 + 0.75 * (((r * 7 + c * 3) % 5) / 4),
    ];
    const head = (f) => el('span', 'att-h', ...Array.from({ length: 36 }, (_, i) => {
      const r = Math.floor(i / 6); const c = i % 6;
      const cell = el('i', c > r ? 'att-x' : null);
      if (c <= r) cell.style.setProperty('--v', f(r, c).toFixed(2));
      return cell;
    }));
    const attn = el('div', 'exp-plane exp-attn',
      el('span', 'exp-ph', T('Multi-head attention · 8 heads', '多头注意力 · 8 个头')),
      el('div', 'att-grid', ...HEADS.map(head)));
    // inside "MLP": the token's vector widens fourfold, a few neurons fire, then it narrows back
    const LIT = new Set([3, 9, 14, 22, 27]);
    const fan = (up) => { const s = PM.s('svg', { class: `${X}mlp-fan`, viewBox: '0 0 100 10', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }); s.innerHTML = up ? '<polygon points="0,0 100,0 67,10 33,10"/>' : '<polygon points="33,0 67,0 100,10 0,10"/>'; return s; };
    const mlp = el('div', 'exp-plane exp-mlp',
      el('span', 'exp-ph', 'MLP · d → 4d → d'),
      el('div', 'mlp-net',
        el('div', 'mlp-row is-d', ...Array.from({ length: 8 }, () => el('i'))),
        fan(false),
        el('div', 'mlp-row is-w', ...Array.from({ length: 32 }, (_, i) => el('i', LIT.has(i) ? 'is-lit' : null))),
        fan(true),
        el('div', 'mlp-row is-d', ...Array.from({ length: 8 }, () => el('i')))));
    // behind the "+" signs: the residual stream, one vector that every part reads and adds to
    const RES = Array.from({ length: 16 }, (_, i) => Math.sin(i * 1.7 + 0.6) * 0.55 + Math.cos(i * 0.9) * 0.35);
    const res = el('div', 'exp-plane exp-res',
      el('span', 'exp-ph', T('Residual stream', '残差流')),
      el('div', 'res-band', ...RES.map((v) => {
        const b = el('i');
        b.style.height = `${(Math.min(1, Math.abs(v)) * 46).toFixed(1)}%`;
        b.style[v >= 0 ? 'bottom' : 'top'] = '50%';
        return el('span', 'res-col', b);
      })),
      el('div', 'res-io', el('span', null, T('+ attention adds', '+ 注意力写入')), el('span', null, T('+ MLP adds', '+ MLP 写入'))));
    // back → front (DOM order decides the stacking of coplanar cards at rest)
    const cards = [
      { id: 'res', body: res, tone: 'ok', name: T('Residual stream', '残差流'), tag: T('behind the + signs', '藏在两个“+”背后'),
        cap: T('Behind the + signs: the residual stream every part adds to.', '“+”背后是残差流：每个部分都把结果加进去。'),
        mark: T('Not drawn: the residual stream', '没画出来：残差流') },
      { id: 'mlp', body: mlp, tone: 'info', name: T('MLP neurons', 'MLP 神经元'), tag: T('inside the MLP box', '藏在 MLP 方框里'),
        cap: T('Inside “MLP”: each vector widens fourfold, then narrows back.', '“MLP”里面：每个向量先放宽四倍，再压回原宽度。'),
        mark: T('Not drawn: the MLP neurons', '没画出来：MLP 神经元') },
      { id: 'attn', body: attn, tone: 'agent', name: T('Attention heads', '注意力头'), tag: T('inside the Attention box', '藏在“注意力”方框里'),
        cap: T('Inside “Attention”: eight heads, each watching different tokens.', '“注意力”里面：八个头，各自盯着不同的词元。'),
        mark: T('Not drawn: 8 attention heads', '没画出来：8 个注意力头') },
      { id: 'fig', body: fig, tone: 'accent', name: T('Block diagram', '方块图'), tag: T('what the paper’s figure shows', '论文插图画出的部分') },
    ];
    const stack = el('div', 'exp-stack');
    cards.forEach((c, i) => {
      c.el = PM.h('div', { class: [`${X}exp-card`, `${X}exp-c-${c.id}`, `pm-tone-${c.tone}`], style: { '--zi': i } }, c.body);
      stack.append(c.el);
    });
    const legend = el('ol', 'exp-legend');
    [...cards].reverse().forEach((c) => {
      c.li = PM.h('li', { class: `pm-tone-${c.tone}` }, el('i', 'exp-dot'), el('span', 'exp-name', c.name), el('span', 'exp-tag', c.tag));
      legend.append(c.li);
    });
    box.append(el('div', 'd-exp', el('div', 'exp-view', stack), legend));

    const explode = (k) => stack.style.setProperty('--k', k.toFixed(4));
    const light = (id) => cards.forEach((c) => {
      c.el.classList.toggle(`${X}is-lit`, c.id === id);
      c.el.classList.toggle(`${X}is-dim`, id != null && c.id !== id);
    });
    const hidden = cards.slice(0, 3).reverse();      // tour order: attention, MLP, residual stream
    return {
      reset() { explode(0); light(null); cards.forEach((c) => c.li.classList.remove(`${X}is-on`, `${X}is-found`)); },
      async run(ctx, out) {
        cards[3].li.classList.add(`${X}is-on`);
        ctx.narrate(T('A transformer block, drawn the way most papers draw it.', '一个 Transformer 块，按多数论文的画法画出来。'));
        await ctx.sleep(1600);
        ctx.narrate(T('Take it apart: three parts hide behind the drawing.', '把它拆开：这张图背后还藏着三个部分。'));
        await ctx.tween(1800, (k) => explode(k), io);
        let n = 0;
        for (const c of hidden) {
          light(c.id);
          c.li.classList.add(`${X}is-on`, `${X}is-found`);
          out(++n, 'warn');
          ctx.narrate(c.cap, 'warn');
          ctx.mark(c.mark, 'warn');
          await ctx.sleep(1700);
        }
        light(null);
        await ctx.sleep(500);
      },
    };
  }

  /* ================================================================== 02 · Two worlds (a computer-use agent) */

  function demoTwoWorlds(box) {
    const NOTE = T('Agenda: budget review, hiring plan, launch date and next steps for the team.',
      '议程：预算回顾、招聘计划、发布日期，以及团队接下来的安排。');
    const FILES = ['q3.pdf', 'logo.png', 'notes.txt', 'plan.md'];   // four files: the pointer is taken four times (R6)
    function side(id) {
      const isA = id === 'a';
      const typed = el('span', 'tw-typed');
      const caret = el('i', 'tw-caret');
      const notes = el('div', 'tw-win tw-notes', el('div', 'tw-bar', ...dots(), el('span', 'tw-title', T('Notes', '备忘录'))),
        el('div', 'tw-text', typed, caret));
      const fileEls = FILES.map((n) => el('div', 'tw-file', el('i', 'tw-fic'), el('span', 'tw-fn', n)));
      const fcount = el('b', 'tw-fcount', '0');
      const folder = el('div', 'tw-folder', el('i', 'tw-fold'), el('span', 'tw-fn', T('Archive', '归档')), fcount);
      const files = el('div', 'tw-win tw-files', el('div', 'tw-bar', ...dots(), el('span', 'tw-title', T('Files', '文件'))),
        el('div', 'tw-grid', ...fileEls), folder);
      const scr = PM.h('div', { class: `pm-screen ${X}tw-scr` }, notes, files);
      const ghost = isA ? null : pointer('agent', T('Agent', '智能体'));
      if (ghost) { ghost.el.classList.add(`${X}is-ghost`); scr.append(ghost.el); }
      const trail = PM.s('svg', { class: `${X}tw-trail`, 'aria-hidden': 'true', focusable: 'false' });
      const trailLine = PM.s('line', {});
      const trailDot = PM.s('circle', { r: '3.5' });
      trail.append(trailLine, trailDot);
      const user = pointer('user', T('You', '你'));
      scr.append(trail, user.el);
      const ring = ripple(scr);
      const flash = flashLayer(scr);
      const count = el('b', 'tw-count', '0');
      // the two sides differ in how the agent was built; both run on a real computer that you are using
      const root = el('div', `tw-side tw-${id}`,
        el('p', 'tw-head',
          el('b', 'tw-term', isA ? T('Built for a benchmark', '按基准测试设计') : T('Built for a shared computer', '按共享电脑设计')),
          el('span', 'tw-claim', isA ? T('Moves the pointer as if it were alone.', '移动鼠标时，当作电脑只归它用。') : T('Works in the background.', '在后台操作，不碰你的鼠标。'))),
        scr,
        el('p', 'tw-foot', PM.L('Pointer taken from you: ', '你的鼠标被拿走：'), count));
      return { id, isA, root, scr, notes, typed, caret, fileEls, folder, fcount, user, ghost, ring, flash, count, trail, trailLine, trailDot, frac: 0 };
    }
    const S = [side('a'), side('b')];
    box.append(el('div', 'd-tw', S[0].root, S[1].root));
    const [A, B] = S;

    const typeTo = (s, f) => { s.frac = f; const txt = PM.t(NOTE); s.typed.textContent = txt.slice(0, Math.round(clamp(f, 0, 1) * txt.length)); };
    const home = (s) => { const r = rel(s.notes, s.scr); const j = s.frac * 40; return { x: r.x + r.w * 0.66 + 3 * Math.sin(j), y: r.y + r.h * 0.76 + 2 * Math.cos(j * 0.8) }; };
    const fileAt = (s, i) => mid(rel(s.fileEls[i], s.scr), 0.5, 0.42);
    const folderAt = (s) => mid(rel(s.folder.firstChild, s.scr), 0.5, 0.5);
    const ghostRest = (s) => { const r = rel(s.fileEls[0].parentNode, s.scr); return { x: r.x + r.w * 0.14, y: r.y + r.h + 4 }; };
    const mv = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });
    const take = (s, on) => {
      s.user.kind(on ? 'agent' : 'user').label(on ? T('Agent', '智能体') : T('You', '你'));
      s.notes.classList.toggle(`${X}is-paused`, on);
      s.root.classList.toggle(`${X}is-taken`, on);
    };
    function drag(s, i, k, p) {
      const a = fileAt(s, i); const b = folderAt(s);
      const f = s.fileEls[i];
      f.style.transform = k > 0 ? `translate(${((b.x - a.x) * k).toFixed(1)}px, ${((b.y - a.y) * k).toFixed(1)}px) scale(${(1 - 0.35 * k).toFixed(3)})` : '';
      f.style.opacity = k >= 1 ? '0' : '';
      f.classList.toggle(`${X}is-held`, k > 0 && k < 1);
      if (p) p.at(mv(a, b, k));
    }
    /** trail(s, from, to): "your pointer was here" → where the agent took it (null hides it) */
    const trailTo = (s, a, b) => {
      s.trail.style.display = a ? '' : 'none';
      if (!a) return;
      s.trailLine.setAttribute('x1', a.x.toFixed(1)); s.trailLine.setAttribute('y1', a.y.toFixed(1));
      s.trailLine.setAttribute('x2', b.x.toFixed(1)); s.trailLine.setAttribute('y2', b.y.toFixed(1));
      s.trailDot.setAttribute('cx', a.x.toFixed(1)); s.trailDot.setAttribute('cy', a.y.toFixed(1));
    };
    const off = PM.onLang(() => S.forEach((s) => typeTo(s, s.frac)));

    return {
      destroy: off,
      reset() {
        S.forEach((s) => {
          typeTo(s, 0);
          s.fileEls.forEach((f, i) => drag(s, i, 0, null));
          s.fcount.textContent = '0';
          s.count.textContent = '0';
          take(s, false);
          trailTo(s, null);
          s.user.at(home(s));
          s.ring.set(null, 0);
          s.flash.set(0);
          if (s.ghost) s.ghost.at(ghostRest(s));
        });
      },
      async run(ctx, out) {
        const NF = FILES.length;
        ctx.narrate(T('Same job on both sides: move four files while you type.', '两边做同一件事：你在打字，智能体移动四个文件。'));
        await ctx.tween(1800, (k) => S.forEach((s) => { typeTo(s, 0.2 * k); s.user.at(home(s)); }));
        let fa = 0.2; let fb = 0.2;
        const caps = [
          T('Left: the agent takes your pointer to drag a file.', '左边：智能体拿走你的鼠标去拖文件。'),
          T('Taken again: 2 of 4. Your typing stops each time.', '又被拿走，第 2 次。你每次都得停下打字。'),
          T('3 of 4. On the right, your pointer stays yours.', '第 3 次。右边的鼠标一直在你手里。'),
          T('4 of 4: one take for every file it moves.', '第 4 次：每移一个文件，就拿走一次鼠标。'),
        ];
        // how far the typing gets per file (right: reach, drag, pointer back, pause; left: only the pause), so both
        // notes reach the same length whatever the number of files
        const [rb1, rb2, rb3, rb4] = [0.07, 0.09, 0.04, 0.03].map((v) => (v * 3) / NF);
        const ra = (0.04 * 3) / NF;
        for (let i = 0; i < NF; i++) {
          ctx.narrate(caps[i], 'err');
          take(A, true);
          A.count.textContent = String(i + 1);
          ctx.mark(T(`Left: pointer taken, ${i + 1} of ${NF}`, `左边：鼠标被拿走，第 ${i + 1} 次`), 'err');
          const from = home(A);
          const gFrom = i === 0 ? ghostRest(B) : folderAt(B);
          let b0 = fb;
          await ctx.tween(450, (k) => {
            const e = io(k);
            A.user.at(mv(from, fileAt(A, i), e));
            trailTo(A, from, mv(from, fileAt(A, i), e));
            A.flash.set(k, 'err');
            typeTo(B, b0 + rb1 * k); B.user.at(home(B));
            B.ghost.at(mv(gFrom, fileAt(B, i), e));
          });
          fb = b0 + rb1; b0 = fb;
          await ctx.tween(700, (k) => {
            const e = io(k);
            drag(A, i, e, A.user); drag(B, i, e, B.ghost);
            trailTo(A, from, mv(fileAt(A, i), folderAt(A), e));
            typeTo(B, b0 + rb2 * k); B.user.at(home(B));
          });
          fb = b0 + rb2; b0 = fb;
          A.fcount.textContent = String(i + 1);
          B.fcount.textContent = String(i + 1);
          take(A, false);
          trailTo(A, null);
          const back = folderAt(A);
          await ctx.tween(500, (k) => { A.user.at(mv(back, home(A), io(k))); typeTo(B, b0 + rb3 * k); B.user.at(home(B)); });
          fb = b0 + rb3; b0 = fb;
          const a0 = fa;
          await ctx.tween(350, (k) => { typeTo(A, a0 + ra * k); A.user.at(home(A)); typeTo(B, b0 + rb4 * k); B.user.at(home(B)); });
          fa = a0 + ra; fb = b0 + rb4;
        }
        ctx.narrate(T('Right: files moved in the background. You kept typing.', '右边：文件在后台移好了，你一直在打字。'), 'ok');
        ctx.mark(T('Right: four files moved, pointer never taken', '右边：四个文件已移好，鼠标从未被拿走'), 'ok');
        out(vs(String(NF), 'err', '0', 'ok'));
        const b1 = fb;
        await ctx.tween(1200, (k) => { typeTo(B, b1 + (1 - b1) * k); B.user.at(home(B)); B.flash.set(k, 'ok'); });
        await ctx.sleep(300);
      },
    };
  }

  /* ================================================================== 03 · Race: speculative decoding */

  function demoRace(box) {
    const STEP = 560;                                 // one forward pass of the large model, the same in every lane
    const N = 12;                                     // tokens in the answer
    // chunks: tokens written per pass = drafts accepted + the one token the large model adds itself
    const LANES = [
      { id: 'std', k: 0, chunks: Array(N).fill(1), tone: 'info', name: T('Standard decoding', '标准解码'), sub: T('one token per pass', '每次前向写一个词元') },
      { id: 'd2', k: 2, chunks: [3, 1, 3, 2, 3], tone: 'info', name: T('Speculative, draft of 2', '投机解码，草稿长度 2'), sub: T('drafts 2, checked in one pass', '小模型起草 2 个，一次前向检查') },
      { id: 'd4', k: 4, chunks: [5, 2, 5], tone: 'ok', name: T('Speculative, draft of 4', '投机解码，草稿长度 4'), sub: T('drafts 4, checked in one pass', '小模型起草 4 个，一次前向检查') },
    ];
    const lanes = LANES.map((l) => {
      const cells = Array.from({ length: N }, () => el('i', 'rc-cell', el('b')));
      const count = el('b', 'rc-count', '0');
      const row = el('div', `rc-lane pm-tone-${l.tone}`,
        el('p', 'rc-name', el('b', null, l.name), el('span', null, l.sub)),
        el('div', 'rc-cells', ...cells),
        el('p', 'rc-num', count, el('span', 'rc-unit', T('passes', '次'))));
      return Object.assign({ cells, count, row }, l);
    });
    box.append(el('div', 'd-race',
      el('p', 'rc-head', el('span', 'rc-task', T('Task: the same 12-token answer', '任务：写出同一段 12 个词元的回答')),
        el('span', 'rc-key', el('i', 'rc-k is-tok'), PM.L('token', '词元'), el('i', 'rc-k is-draft'), PM.L('draft', '草稿'), el('i', 'rc-k is-rej'), PM.L('rejected', '被拒'))),
      ...lanes.map((l) => l.row)));

    /** the state of one lane at race time t: each cell is '', 'tok' (written), 'draft' or 'rej' */
    function laneAt(l, t) {
      const x = t / STEP;
      const p = Math.floor(x + 1e-9);
      const f = x - p;
      const P = l.chunks.length;
      const cells = Array.from({ length: N }, () => ({ s: '', pass: 0, fill: 1 }));
      let at = 0;
      for (let q = 0; q < Math.min(p, P); q++) { for (let j = 0; j < l.chunks[q]; j++) cells[at + j] = { s: 'tok', pass: q, fill: 1 }; at += l.chunks[q]; }
      if (p < P && f > 1e-9) {
        const c = l.chunks[p];
        if (!l.k) cells[at] = { s: 'tok', pass: p, fill: clamp(f / 0.8, 0, 1) };
        else if (f < 0.5) { for (let j = 0; j < l.k && at + j < N; j++) if (f >= (j / l.k) * 0.4) cells[at + j] = { s: 'draft', pass: p, fill: 1 }; }
        else {
          for (let j = 0; j < c; j++) cells[at + j] = { s: 'tok', pass: p, fill: 1 };
          for (let j = c; j < l.k && at + j < N; j++) cells[at + j] = { s: 'rej', pass: p, fill: 1 };   // shown until the pass ends
        }
      }
      return { cells, passes: Math.min(P, Math.ceil(x - 1e-9)), done: x >= P - 1e-9 };
    }
    function show(t) {
      for (const l of lanes) {
        const st = laneAt(l, t);
        l.cells.forEach((c, j) => {
          const s = st.cells[j];
          c.className = cx(`rc-cell${s.s ? ` is-${s.s}` : ''}${s.s === 'tok' && s.pass % 2 ? ' is-odd' : ''}`);
          c.firstChild.style.width = s.s === 'tok' ? `${(s.fill * 100).toFixed(1)}%` : '0%';
        });
        l.count.textContent = String(st.passes);
        l.row.classList.toggle(`${X}is-done`, st.done);
      }
    }
    const CAPS = {
      d4: T('Draft of 4: three passes. Rejected drafts are thrown away.', '草稿长度 4：三次前向，被拒的草稿直接丢弃。'),
      std: T('Standard decoding: twelve passes, one token each.', '标准解码：十二次前向，每次一个词元。'),
    };
    const MARKS = {
      d4: T('Draft of 4: done in 3 passes', '草稿长度 4：3 次前向完成'),
      d2: T('Draft of 2: done in 5 passes', '草稿长度 2：5 次前向完成'),
      std: T('Standard decoding: done in 12 passes', '标准解码：12 次前向完成'),
    };
    return {
      reset() { show(0); },
      async run(ctx, out) {
        ctx.narrate(T('Same answer, same clock. One beat is one large-model pass.', '同一段回答，同一时钟。一拍就是大模型的一次前向。'));
        await ctx.sleep(1800);
        ctx.narrate(T('A small model drafts; one large pass checks the whole draft.', '小模型先起草，大模型一次前向检查整段草稿。'));
        let t = 0;
        for (const l of [...lanes].sort((a, b) => a.chunks.length - b.chunks.length)) {
          const t0 = t; const t1 = l.chunks.length * STEP;
          await ctx.tween(t1 - t0, (k) => show(lerp(t0, t1, k)));
          t = t1;
          ctx.mark(MARKS[l.id], l.id === 'd4' ? 'ok' : 'info');
          if (CAPS[l.id]) ctx.narrate(CAPS[l.id], l.id === 'd4' ? 'ok' : 'info');
        }
        out(vs('12', 'info', '3', 'ok'));
        await ctx.sleep(900);
      },
    };
  }

  /* ================================================================== 04 · Perturbation: a small change flips a classifier */

  function demoPerturb(box) {
    const G = 14;
    // a handwritten-looking 7 on a 14 × 14 grid: two pen strokes, anti-aliased by each pixel's distance to the stroke
    const STROKES = [[3.4, 3.2, 11.2, 3.0], [11.2, 3.0, 6.6, 12.3]];
    const dist = (x, y, [x1, y1, x2, y2]) => {
      const dx = x2 - x1; const dy = y2 - y1;
      const t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
    };
    const BASE = Array.from({ length: G * G }, (_, i) => {
      const d = Math.min(...STROKES.map((s) => dist((i % G) + 0.5, Math.floor(i / G) + 0.5, s)));
      return clamp(1.6 - d, 0, 1);
    });
    const SIGN = BASE.map((_, i) => (hash(i * 7 + 3) < 0.5 ? -1 : 1));   // the change: ±EPS per pixel, fixed
    const EPS = 0.03;
    const grey = (v) => { const g = Math.round(clamp(v, 0, 1) * 255); return `rgb(${g},${g},${g})`; };
    function pix(cls) {
      const s = PM.s('svg', { viewBox: `0 0 ${G} ${G}`, class: `${X}pb-img ${X}${cls}`, 'shape-rendering': 'crispEdges', 'aria-hidden': 'true', focusable: 'false' });
      const rects = BASE.map((_, i) => { const r = PM.s('rect', { x: i % G, y: Math.floor(i / G), width: 1.04, height: 1.04 }); s.append(r); return r; });
      return { s, rects };
    }
    const x0 = pix('pb-x');
    const nz = pix('pb-nz');
    const x1 = pix('pb-x1');
    x0.rects.forEach((r, i) => r.setAttribute('fill', grey(BASE[i])));
    nz.rects.forEach((r, i) => r.setAttribute('class', SIGN[i] > 0 ? 'p' : 'n'));
    const nzEmpty = el('span', 'pb-empty', T('none yet', '尚未改动'));
    const nzFrame = el('div', 'pb-frame is-nz', nz.s, nzEmpty);
    const x1Frame = el('div', 'pb-frame', x1.s);
    const flash = flashLayer(x1Frame, 'pb-flash');
    const fig = (frame, label, sub) => el('figure', 'pb-fig', frame, el('figcaption', null, el('b', null, label), sub ? el('span', null, sub) : null));

    // class probabilities 0–9 (illustrative): clean image, then the changed image
    const P = (o) => Array.from({ length: 10 }, (_, d) => o[d] || 0.002);
    const CLEAN = { a: P({ 7: 0.97, 1: 0.016, 9: 0.008 }), b: P({ 7: 0.93, 1: 0.03, 9: 0.02, 2: 0.01 }) };
    const ADV = { a: P({ 3: 0.91, 7: 0.05, 8: 0.02, 5: 0.012 }), b: P({ 7: 0.86, 3: 0.07, 9: 0.04, 1: 0.02 }) };
    const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
    function model(id, name, sub) {
      const bars = Array.from({ length: 10 }, (_, d) => { const fill = el('b'); return { col: el('span', 'pb-col', el('i', 'pb-bar', fill), el('span', 'pb-d', String(d))), fill }; });
      const pred = el('b', 'pb-pred', '7');
      const pct = el('span', 'pb-pct', '');
      const root = el('div', `pb-model pb-${id}`,
        el('p', 'pb-mh', el('b', null, name), el('span', null, sub)),
        el('div', 'pb-mbody',
          el('p', 'pb-top', el('span', 'pb-reads', T('reads', '识别为')), pred, pct),
          el('div', 'pb-bars', ...bars.map((x) => x.col))));
      return {
        root,
        set(p) {
          let top = 0;
          p.forEach((v, d) => { if (v > p[top]) top = d; });
          bars.forEach((x, d) => {
            x.fill.style.height = `${(clamp(p[d], 0, 1) * 100).toFixed(1)}%`;
            x.col.classList.toggle(`${X}is-top`, d === top);
          });
          pred.textContent = String(top);
          pct.textContent = PM.fmt.pct(p[top]);
          root.classList.toggle(`${X}is-wrong`, top !== 7);
        },
      };
    }
    const A = model('a', T('Standard model', '标准模型'), T('trained on clean images', '只用干净图片训练'));
    const B = model('b', T('Robust model', '稳健模型'), T('also trained on such changes', '训练时也见过这类改动'));
    box.append(el('div', 'd-pert',
      el('div', 'pb-eq',
        fig(el('div', 'pb-frame', x0.s), T('Input', '输入')),
        el('span', 'pb-op', '+'),
        fig(nzFrame, T('Change × 0.03', '改动 × 0.03'), T('enlarged to show', '放大显示')),
        el('span', 'pb-op', '='),
        fig(x1Frame, T('New input', '新输入'), T('looks the same', '看起来一样'))),
      el('div', 'pb-models', A.root, B.root)));

    function addChange(k) {
      nz.s.style.opacity = k.toFixed(3);
      nzEmpty.hidden = k > 0;
      x1.rects.forEach((r, i) => r.setAttribute('fill', grey(BASE[i] + EPS * SIGN[i] * k)));
    }
    return {
      reset() { addChange(0); flash.set(0); A.set(CLEAN.a); B.set(CLEAN.b); },
      async run(ctx, out) {
        ctx.narrate(T('Both models read the image as a 7.', '两个模型都把这张图识别为 7。'));
        await ctx.sleep(1500);
        ctx.narrate(T('Add a change too small to see.', '加上一个肉眼看不出的改动。'), 'warn');
        ctx.mark(T('A change of at most 0.03 per pixel', '每个像素最多改动 0.03'), 'warn');
        await ctx.tween(1000, (k) => { addChange(io(k)); flash.set(k, 'warn'); });
        await ctx.sleep(600);
        ctx.narrate(T('The standard model now reads a 3.', '标准模型现在把它认成了 3。'), 'err');
        await ctx.tween(800, (k) => A.set(mix(CLEAN.a, ADV.a, io(k))));
        ctx.mark(T('Standard model flips: 7 → 3', '标准模型翻转：7 → 3'), 'err');
        await ctx.sleep(1000);
        ctx.narrate(T('The robust model still reads a 7.', '稳健模型仍然识别为 7。'), 'ok');
        await ctx.tween(700, (k) => B.set(mix(CLEAN.b, ADV.b, io(k))));
        ctx.mark(T('Robust model still reads 7', '稳健模型仍识别为 7'), 'ok');
        out(vs('3', 'err', '7', 'ok'));
        await ctx.sleep(1500);
      },
    };
  }

  /* ================================================================== 05 · Decision timeline: early exit per token */

  function demoDecision(box) {
    const L = 12;                                     // layers in the model
    const TOK = {
      en: ['The', 'capital', 'of', 'France', 'is', 'Paris', '.', 'Its', 'river', 'is', 'the', 'Seine'],
      zh: ['法国', '的', '首', '都', '是', '巴黎', '。', '它', '的', '河流', '是', '塞纳河'],
    };
    const DEPTH = [3, 4, 2, 5, 3, 11, 2, 4, 5, 4, 2, 10];   // layers each token runs when the model decides
    const N = DEPTH.length;
    const SUM = DEPTH.reduce((a, b) => a + b, 0);
    const tok = (i) => T(TOK.en[i], TOK.zh[i]);
    const STEP = 580;
    const FILL = 0.85;                                // share of a token's slot spent climbing the layers
    const lanes = [
      { id: 'fixed', tone: 'info', depth: () => L, title: T('Fixed rule: every token runs all 12 layers', '固定规则：每个词元都跑完 12 层') },
      { id: 'exit', tone: 'agent', depth: (i) => DEPTH[i], title: T('Model decides: it exits once it is confident', '模型决定：一有把握就提前退出') },
    ].map((l) => {
      const cols = Array.from({ length: N }, (_, i) => {
        const segs = Array.from({ length: L }, () => el('i', 'dc-seg'));
        const cap = el('i', 'dc-exit');
        cap.style.bottom = `calc(${(l.depth(i) / L).toFixed(4)} * (100% - 4px) + 1px)`;
        return { c: el('span', 'dc-col', ...segs, cap), segs, cap };
      });
      const count = el('b', 'dc-tok', '0');
      const row = el('div', `dc-lane pm-tone-${l.tone}`,
        el('p', 'dc-title', el('i', 'dc-dot'), el('span', null, l.title)),
        el('div', 'dc-body', el('div', 'dc-cols', ...cols.map((x) => x.c)),
          el('p', 'dc-tokw', count, el('span', 'dc-k', PM.L('layers run', '已运行层数')))));
      return Object.assign({ cols, count, row }, l);
    });
    const labels = Array.from({ length: N }, (_, i) => el('span', 'dc-lab', tok(i)));
    const words = Array.from({ length: N }, (_, i) => el('span', 'dc-w', tok(i)));
    box.append(el('div', 'd-dec',
      el('p', 'dc-sent', ...words),
      lanes[0].row,
      el('div', 'dc-labs', el('div', 'dc-labs-in', ...labels)),
      lanes[1].row,
      el('p', 'dc-note', PM.L('Illustrative depths: a token exits when its confidence passes a threshold.', '层数为示意：词元的置信度超过阈值时退出。'))));

    /** x in [0, N]: tokens done, plus the progress inside the current one */
    function show(x) {
      const i = Math.floor(x + 1e-9);
      const f = x - i;
      for (const l of lanes) {
        let run = 0;
        l.cols.forEach((col, j) => {
          const d = l.depth(j);
          let n = 0;
          if (j < i) n = d;
          else if (j === i) n = Math.min(d, Math.floor(clamp(f / FILL, 0, 1) * L + 1e-6));
          run += n;
          const exited = d < L && (j < i || (j === i && n >= d && f > 1e-9));
          col.segs.forEach((s, m) => { s.classList.toggle(`${X}is-run`, m < n); s.classList.toggle(`${X}is-skip`, exited && m >= d); });
          col.cap.hidden = !exited;
          col.c.classList.toggle(`${X}is-now`, j === i && f > 1e-9);
        });
        l.count.textContent = String(run);
      }
      [labels, words].forEach((list) => list.forEach((w, j) => {
        w.classList.toggle(`${X}is-now`, j === i && f > 1e-9);
        w.classList.toggle(`${X}is-past`, j < i || (j === i && f >= FILL));
      }));
    }
    const MARK = {};
    [0, 5, 6, 11].forEach((i) => {
      MARK[i] = DEPTH[i] >= 8
        ? T(`“${TOK.en[i]}”: ${DEPTH[i]} of 12 layers`, `“${TOK.zh[i]}”：用了 12 层中的 ${DEPTH[i]} 层`)
        : T(`“${TOK.en[i]}”: exits after ${DEPTH[i]} layers`, `“${TOK.zh[i]}”：${DEPTH[i]} 层后退出`);
    });
    return {
      reset() { show(0); },
      async run(ctx, out) {
        ctx.narrate(T('Same sentence, same 12-layer model. Who decides the depth?', '同一句话，同一个 12 层模型。层数由谁来定？'));
        await ctx.sleep(1500);
        for (let i = 0; i < N; i++) {
          if (i === 0) ctx.narrate(T('Top: a fixed rule runs all 12 layers for every token.', '上面：固定规则让每个词元都跑完 12 层。'), 'info');
          if (i === 3) ctx.narrate(T('Bottom: the model exits as soon as it is confident.', '下面：模型一有把握就提前退出。'), 'agent');
          if (i === 6) ctx.narrate(T(`“${TOK.en[5]}” was hard: the model used ${DEPTH[5]} of 12 layers.`, `“${TOK.zh[5]}”比较难：模型用了 12 层中的 ${DEPTH[5]} 层。`), 'agent');
          if (i === 9) ctx.narrate(T('Easy tokens exit early, and the savings add up.', '容易的词元早早退出，省下的计算不断累积。'), 'agent');
          await ctx.tween(STEP * FILL, (k) => show(i + k * FILL));
          if (MARK[i]) ctx.mark(MARK[i], 'agent');
          await ctx.tween(STEP * (1 - FILL), (k) => show(i + FILL + k * (1 - FILL)));
        }
        ctx.narrate(T(`Layers run: ${N * L} under the rule, ${SUM} when the model decides.`, `运行的层数：固定规则 ${N * L} 层，模型自己决定只要 ${SUM} 层。`), 'agent');
        out(vs(String(N * L), 'info', String(SUM), 'agent'));
        await ctx.sleep(1200);
      },
    };
  }

  /* ================================================================== 06 · Request trace: an inference server */

  function demoTrace(box) {
    const LAYERS = [
      { name: T('API gateway', 'API 网关'), job: T('checks the key and rate limit', '检查密钥和限流') },
      { name: T('Tokenizer', '分词器'), job: T('turns the prompt into tokens', '把提示词切成词元') },
      { name: T('Scheduler', '调度器'), job: T('checks the context limit', '检查上下文长度上限') },
      { name: T('Batcher', '批处理器'), job: T('groups requests for the GPU', '把请求拼成批次送给 GPU') },
      { name: T('GPU worker', 'GPU 工作进程'), job: T('runs the model', '运行模型') },
    ];
    const items = LAYERS.map((l, i) => {
      const state = el('span', 'tr-state');
      const li = el('li', 'tr-layer', el('b', 'tr-n', String(i + 1)), el('span', 'tr-tx', el('b', null, l.name), el('span', null, l.job)), state);
      return { li, state };
    });
    const pkt = el('span', 'tr-pkt', 'generate()');
    const err = el('span', 'tr-err', 'PROMPT_TOO_LONG');
    const wire = el('i', 'tr-wire');
    const catchFx = flashLayer(items[2].li, 'tr-catch');
    const stack = el('div', 'tr-stack', el('ol', 'tr-list', ...items.map((x) => x.li)), wire, pkt, err);
    const LOG = [
      { k: 'out', t: '→ POST /v1/generate' },
      { k: 'err', t: '✗ 400 PROMPT_TOO_LONG' },
      { k: 'mu', t: T('38,912 tokens > 32,768 allowed', '38,912 个词元 > 上限 32,768') },
      { k: 'next', t: T('↻ next: trim the prompt, then retry', '↻ 下一步：截短提示词，再重试') },
    ].map((l) => el('span', `tr-log-l is-${l.k}`, l.t));
    const logNone = el('span', 'tr-log-none', T('Nothing yet', '还没有内容'));
    const log = el('div', 'tr-log', el('p', 'tr-log-h', PM.L('What the client reads', '客户端收到的')), logNone, ...LOG);
    box.append(el('div', 'd-trace', stack, log));

    const STATES = {
      pass: T('passed', '通过'), caught: T('caught here', '在此拦下'), none: T('not reached', '未到达'),
    };
    const setState = (i, s) => {
      const it = items[i];
      it.li.classList.remove(`${X}is-pass`, `${X}is-caught`, `${X}is-none`);
      it.state.replaceChildren();
      if (s) { it.li.classList.add(`${X}is-${s}`); it.state.append(PM.L(STATES[s])); }
    };
    const yAt = (pos) => { const a = rel(items[0].li, stack); const b = rel(items[4].li, stack); return lerp(a.y + a.h / 2, b.y + b.h / 2, pos / 4); };
    const place = (node, pos) => { node.style.top = `${yAt(pos).toFixed(1)}px`; };
    const logTo = (n) => { logNone.hidden = n > 0; LOG.forEach((l, i) => { l.hidden = i >= n; }); };
    return {
      reset() { place(pkt, 0); pkt.hidden = false; err.hidden = true; place(err, 2); items.forEach((_, i) => setState(i, null)); catchFx.set(0); logTo(0); },
      async run(ctx, out) {
        ctx.narrate(T('The client sends one long prompt down the stack.', '客户端把一段很长的提示词沿着各层往下发。'));
        logTo(1);
        await ctx.sleep(900);
        await ctx.tween(1400, (k) => { const p = lerp(0, 2, io(k)); place(pkt, p); setState(0, p >= 0.5 ? 'pass' : null); setState(1, p >= 1.5 ? 'pass' : null); });
        setState(2, 'caught');
        [3, 4].forEach((i) => setState(i, 'none'));
        logTo(2);
        ctx.mark(T('Caught at layer 3: Scheduler', '在第 3 层拦下：调度器'), 'err');
        ctx.narrate(T('The scheduler counts 38,912 tokens, over the 32,768 limit.', '调度器数出 38,912 个词元，超过 32,768 的上限。'), 'err');
        out(T('Layer 3 of 5', '第 3 层，共 5 层'), 'err');
        await ctx.tween(1700, (k) => catchFx.set(k, 'err'));
        ctx.narrate(T('A typed error travels back up to the client.', '一个带类型的错误沿原路返回客户端。'));
        pkt.hidden = true;
        err.hidden = false;
        await ctx.tween(1600, (k) => place(err, lerp(2, 0, io(k))));
        logTo(3);
        ctx.mark(T('The client reads PROMPT_TOO_LONG', '客户端读到 PROMPT_TOO_LONG'), 'info');
        ctx.narrate(T('The client reads the error, trims the prompt and retries.', '客户端读到错误，截短提示词后重试。'));
        logTo(4);
        await ctx.sleep(1800);
      },
    };
  }

  /* ================================================================== 07 · One program, many devices (a computer-use agent) */

  function demoDevices(box) {
    const row = el('div', 'dv-row');
    const cells = {};
    const cell = (id, handle) => {
      const frame = el('div', 'dv-frame');
      const c = el('div', `dv-cell dv-${id}`, frame, el('span', 'dv-handle', handle));
      row.append(c);
      cells[id] = c;
      return frame;
    };
    // phone: a photo grid (light, like a real screen)
    const photos = Array.from({ length: 9 }, (_, i) => el('i', `dv-ph p${i}`));
    const phoneApp = el('div', 'dv-phone-app', el('b', 'dv-app-h', T('Photos', '相册')), el('div', 'dv-photos', ...photos));
    const phone = PM.device.phone(cell('phone', 'phone'), { time: '9:41', content: phoneApp, maxWidth: 999, label: T('Simulated phone', '模拟手机') });
    // browser: a shared album page
    const upl = el('div', 'dv-up', el('i', 'dv-up-thumb'), el('span', 'dv-up-name', 'photo.jpg'), el('span', 'dv-up-ok', T('uploaded', '已上传')));
    const page = el('div', 'dv-page', el('b', 'dv-page-h', T('Shared album', '共享相册')),
      el('div', 'dv-drop', el('span', null, T('Drop photos here', '把照片拖到这里'))), upl);
    const web = PM.device.browser(cell('web', 'web'), { url: 'album.example.test', tabs: [{ title: T('Shared album', '共享相册'), url: 'album.example.test' }], content: page, width: 900, height: 620 });
    // Mac: a Pictures folder
    const saved = el('div', 'dv-fitem dv-saved', el('i', 'dv-fic is-img'), el('span', null, 'photo.jpg'));
    const fgrid = el('div', 'dv-fgrid', ...['report.pdf', 'budget.xlsx'].map((n) => el('div', 'dv-fitem', el('i', 'dv-fic'), el('span', null, n))), saved);
    const mac = PM.device.mac(cell('mac', 'mac'), { menubar: { app: 'Finder' }, dock: false });
    const win = mac.desk.window({ id: 'pics', title: T('Pictures', '图片'), app: 'Finder', x: 150, y: 80, w: 980, h: 600, content: fgrid });
    const SRC = ['phone = device("phone")', 'web = device("browser")', 'mac = device("mac")',
      'photo = phone.photos.latest()', 'web.upload(photo); mac.save(photo)'].join('\n');
    const codeWrap = el('div', 'dv-code');
    const code = PM.code(codeWrap, { src: SRC, lang: 'python', focus: ['phone.', 'web.', 'mac.'], ariaLabel: T('The program', '程序') });
    const beams = PM.s('svg', { class: `${X}dv-beams`, 'aria-hidden': 'true', focusable: 'false' });
    const paths = Array.from({ length: 4 }, () => { const p = PM.s('path', { pathLength: '1' }); beams.append(p); return p; });
    const wrap = el('div', 'd-dev', row, codeWrap, beams);
    box.append(wrap);

    const flashOf = { phone: (k, t) => phone.flash(null, t, k), web: (k, t) => web.flash(null, t, k), mac: (k, t) => mac.desk.flash(win, t, k) };
    const HANDLE = { phone: 'phone', web: 'web', mac: 'mac' };
    /** the on-screen box of the handle name in a code line (a Range over the highlighted text nodes) */
    function handleRect(lc, line, id) {
      const want = HANDLE[id] + (line <= 3 ? ' ' : '.');
      const at = lc.textContent.indexOf(want);
      const len = HANDLE[id].length;
      const walker = document.createTreeWalker(lc, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let off = 0; let started = false;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const L0 = n.nodeValue.length;
        if (!started && at >= 0 && at < off + L0) { range.setStart(n, at - off); started = true; }
        if (started && at + len <= off + L0) { range.setEnd(n, at + len - off); return range.getBoundingClientRect(); }
        off += L0;
      }
      return lc.getBoundingClientRect();
    }
    function beam(i, line, id, k) {
      const p = paths[i];
      if (!(k > 0)) { p.style.opacity = '0'; return; }
      const wr = wrap.getBoundingClientRect();
      const ln = code.el.querySelector(`.pm-cl[data-n="${line}"] .pm-lc`);
      const tag = cells[id].querySelector(`.${X}dv-handle`);
      if (!ln || !tag) return;
      const a = handleRect(ln, line, id); const b = tag.getBoundingClientRect();
      const x0 = a.left + a.width / 2 - wr.left; const y0 = code.el.getBoundingClientRect().top - wr.top;
      const x1 = b.left - wr.left + b.width / 2; const y1 = b.bottom - wr.top + 2;
      const my = (y0 + y1) / 2;
      p.setAttribute('d', `M${x0.toFixed(1)} ${y0.toFixed(1)} C ${x0.toFixed(1)} ${my.toFixed(1)}, ${x1.toFixed(1)} ${my.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`);
      p.style.strokeDasharray = `${clamp(k, 0, 1).toFixed(3)} 1`;
      p.style.opacity = '1';
    }
    const on = (ids) => Object.entries(cells).forEach(([id, c]) => c.classList.toggle(`${X}is-on`, ids.includes(id)));
    const used = (ids) => Object.entries(cells).forEach(([id, c]) => c.classList.toggle(`${X}is-used`, ids.includes(id)));
    const BEATS = [
      { line: 1, ids: ['phone'], cap: T('Each device gets a handle in one line of code.', '每台设备都用一行代码拿到一个句柄。') },
      { line: 2, ids: ['web'] },
      { line: 3, ids: ['mac'] },
      { line: 4, ids: ['phone'], cap: T('The program takes the newest photo from the phone.', '程序从手机里取出最新的一张照片。') },
      { line: 5, ids: ['web', 'mac'], cap: T('One line uploads it and saves a copy on the Mac.', '一行代码上传照片，同时在 Mac 上存一份。') },
    ];
    function clearFx() { phone.clearFx(); web.clearFx(); mac.desk.clearFx(); }
    return {
      reset() {
        code.mark({}); clearFx(); paths.forEach((p) => { p.style.opacity = '0'; });
        on([]); used([]); photos[0].classList.remove(`${X}is-picked`); upl.hidden = true; saved.hidden = true;
        wrap.classList.remove(`${X}is-done`);
      },
      async run(ctx, out) {
        const seen = [];
        for (const b of BEATS) {
          code.mark({ [b.line]: 'run' });
          on(b.ids);
          b.ids.forEach((id) => { if (!seen.includes(id)) seen.push(id); });
          used(seen);
          if (b.cap) ctx.narrate(b.cap, b.line === 5 ? 'ok' : null);
          if (b.line === 4) photos[0].classList.add(`${X}is-picked`);
          if (b.line === 5) { upl.hidden = false; saved.hidden = false; ctx.mark(T('The photo reaches the browser and the Mac', '照片到了浏览器，也到了 Mac'), 'ok'); }
          const tone = b.line === 5 ? 'ok' : 'accent';
          await ctx.tween(650, (k) => {
            paths.forEach((p, i) => { if (i >= b.ids.length) p.style.opacity = '0'; });
            b.ids.forEach((id, i) => { beam(i, b.line, id, io(clamp(k * 1.6, 0, 1))); flashOf[id](k, tone); });
          });
          await ctx.sleep(550);
        }
        paths.forEach((p) => { p.style.opacity = '0'; });
        on([]);
        code.mark({ 5: 'ok' });
        wrap.classList.add(`${X}is-done`);
        ctx.narrate(T('Three devices, one program, one model step.', '三台设备，一个程序，模型只走了一步。'), 'agent');
        ctx.mark(T('One model call for three devices', '三台设备只用一次模型调用'), 'agent');
        out(T('3 · 1', '3 · 1'), 'agent');
        await ctx.sleep(1500);
      },
    };
  }

  /* ================================================================== 08 · Real-run replay: checkpoints of a training run */

  function demoReplay(box) {
    const N = 8;
    const LOSS = [3.1, 2.2, 1.6, 1.25, 0.9, 0.72, 0.63, 0.58];
    const ANS = ['17 25 17 25', '1725', '32', '41', '42', '42', '42', '42'];
    const ACC = [0.02, 0.09, 0.21, 0.38, 0.61, 0.74, 0.81, 0.84];
    const FIRST = ANS.indexOf('42') + 1;              // the checkpoint where the evidence arrives
    const STEPS = [
      T('Repeats the prompt', '重复提示词'),
      T('Digits, wrong form', '写出数字，格式不对'),
      T('A sum, but wrong: 32', '给出和，但错了：32'),
      T('Closer, still wrong: 41', '更接近，仍然错：41'),
      T('First correct answer: 42', '第一次答对：42'),
      T('Correct again', '再次答对'),
      T('Eval accuracy 81%', '评测准确率 81%'),
      T('Final checkpoint: 84%', '最后一个检查点：84%'),
    ];
    const YMAX = 3.4;
    const px = (i) => (i / (N - 1)) * 100;
    const py = (v) => 100 - (v / YMAX) * 100;
    const pts = (n) => LOSS.slice(0, n).map((v, i) => `${px(i).toFixed(2)},${(py(v) * 0.6).toFixed(2)}`).join(' ');
    /** One screen of the run at checkpoint s (1..8), sized in container units so thumbnails are true miniatures. */
    function screen(s) {
      const svg = PM.s('svg', { viewBox: '0 0 100 60', preserveAspectRatio: 'none', class: `${X}rr-svg`, 'aria-hidden': 'true', focusable: 'false' });
      svg.append(PM.s('polyline', { class: 'all', points: pts(N) }), PM.s('polyline', { class: 'now', points: pts(s) }));
      const marks = LOSS.map((v, i) => {
        const d = el('i', `rr-pt${i < s ? ' is-past' : ''}${i === s - 1 ? ' is-cur' : ''}`);
        d.style.left = `${px(i).toFixed(2)}%`;
        d.style.top = `${py(v).toFixed(2)}%`;
        return d;
      });
      const ok = ANS[s - 1] === '42';
      const bar = el('b');
      bar.style.width = `${(ACC[s - 1] * 100).toFixed(1)}%`;
      return PM.h('div', { class: `pm-screen ${X}rr-ck` },
        el('div', 'rr-top', el('b', null, T('train · run 1', 'train · 第 1 次运行')), el('span', null, T(`checkpoint ${s} · step ${s},000`, `检查点 ${s} · 第 ${s},000 步`))),
        el('div', 'rr-body',
          el('div', 'rr-chart', el('span', 'rr-lab', T('training loss', '训练 loss')), el('div', 'rr-plot', svg, ...marks)),
          el('div', 'rr-sample',
            el('span', 'rr-lab', T('Eval prompt', '评测题目')),
            el('span', 'rr-q', '17 + 25 ='),
            el('span', 'rr-lab', T('Model output', '模型输出')),
            el('span', `rr-a ${ok ? 'is-ok' : 'is-bad'}`, ANS[s - 1], ok ? ' ✓' : ' ✗'),
            el('span', 'rr-lab', T('Eval accuracy', '评测准确率')),
            el('span', 'rr-acc', el('i', null, bar), el('em', null, PM.fmt.pct(ACC[s - 1]))))));
    }
    const frames = STEPS.map((_, i) => el('div', 'rr-shot', screen(i + 1)));
    const thumbs = STEPS.map((_, i) => el('i', `rr-thumb${i === FIRST - 1 ? ' is-evidence' : ''}${i === N - 1 ? ' is-final' : ''}`, el('span', 'rr-tframe', screen(i + 1))));
    const head = el('i', 'rr-head');
    const stepNo = el('b', 'rr-stepno', '1');
    // the provenance label a real replay carries on every frame; these frames are invented, so it is shown as an example
    const prov = el('p', 'rr-prov', el('span', 'rr-glyph', '◇'), el('span', 'rr-ex', T('Example label:', '示例标注：')), ' ',
      PM.L('Real run · Model A · run 1 · checkpoint ', '真实运行 · 模型 A · 第 1 次运行 · 检查点 '), stepNo, ' / 8');
    const list = el('ol', 'rr-steps', ...STEPS.map((s, i) => el('li', `${i === FIRST - 1 ? 'is-evidence' : ''}${i === N - 1 ? ' is-final' : ''}`, el('b', null, String(i + 1)), el('span', null, s))));
    box.append(el('div', 'd-replay',
      el('div', 'rr-main', el('div', 'rr-frame', ...frames), prov),
      list,
      el('div', 'rr-strip', el('div', 'rr-thumbs', ...thumbs), el('div', 'rr-track', head))));
    /** p in [1, 8]: the frame shown (crossfade over the first 30% of each step) */
    function show(p) {
      const i = Math.floor(p + 1e-6);
      const f = p - i;
      const k = clamp(f / 0.3, 0, 1);
      frames.forEach((fr, j) => {
        const s = j + 1;
        let a = 0;
        if (s === i) a = 1;
        if (s === i + 1 && f > 0) a = k;
        fr.style.opacity = a.toFixed(3);
        fr.hidden = a <= 0;
      });
      const cur = f > 0.15 ? i + 1 : i;
      stepNo.textContent = String(cur);
      thumbs.forEach((t, j) => { t.classList.toggle(`${X}is-cur`, j + 1 === cur); t.classList.toggle(`${X}is-past`, j + 1 < cur); });
      [...list.children].forEach((li, j) => { li.classList.toggle(`${X}is-cur`, j + 1 === cur); li.classList.toggle(`${X}is-past`, j + 1 < cur); });
      head.style.left = `${(((p - 0.5) / N) * 100).toFixed(2)}%`;
    }
    return {
      reset() { show(1); },
      async run(ctx, out) {
        ctx.narrate(T('Each frame is one saved checkpoint, replayed in order.', '每一帧是一个保存下来的检查点，按顺序回放。'));
        await ctx.sleep(1200);
        for (let s = 2; s <= N; s++) {
          if (s === 3) ctx.narrate(T('The line under the frame names model, run and checkpoint.', '画面下方那行写明模型、运行和检查点。'));
          if (s === FIRST) {
            ctx.narrate(T(`Checkpoint ${s}: the first correct answer, 42.`, `检查点 ${s}：第一次答对，42。`), 'ok');
            ctx.mark(T(`Checkpoint ${s}: first correct answer`, `检查点 ${s}：第一次答对`), 'ok');
          }
          if (s === N) {
            ctx.narrate(T(`Checkpoint ${s}: ${PM.fmt.pct(ACC[N - 1])} on the eval set.`, `检查点 ${s}：评测集准确率 ${PM.fmt.pct(ACC[N - 1])}。`), 'info');
            ctx.mark(T(`Checkpoint ${s}: eval accuracy ${PM.fmt.pct(ACC[N - 1])}`, `检查点 ${s}：评测准确率 ${PM.fmt.pct(ACC[N - 1])}`), 'info');
          }
          await ctx.tween(900, (k) => show(s - 1 + k));
        }
        out(`${N} / ${N}`, 'ok');
        await ctx.sleep(800);
      },
    };
  }

  /* ================================================================== 09 · Program anatomy: a training loop with a check */

  function demoProgram(box) {
    const SRC = ['for step, batch in enumerate(data, 1):', '    loss = model(batch).loss', '    loss.backward()',
      '    norm = clip_grad_norm_(params, 1.0)', '    assert torch.isfinite(norm)', '    opt.step(); opt.zero_grad()'].join('\n');
    const left = el('div', 'pg-left');
    PM.intent(left, T('Take five training steps; clip every gradient and check that it is finite.', '训练五步：每一步都裁剪梯度，并检查它是有限值。'));
    const code = PM.code(left, { src: SRC, lang: 'python', focus: ['clip_grad_norm_(params, 1.0)', 'torch.isfinite(norm)'], ariaLabel: T('The training loop', '训练循环') });
    const LOG = [
      { loss: '2.31', norm: '0.84' }, { loss: '2.07', norm: '1.37', clip: true }, { loss: '1.88', norm: '0.92' },
      { loss: '1.74', norm: '4.61', clip: true }, { loss: '1.62', norm: '0.77' },
    ];
    const rows = LOG.map((r, i) => {
      const loss = el('span', 'pg-c pg-loss', r.loss);
      const norm = el('span', 'pg-c pg-norm', r.norm, r.clip ? el('em', null, ' → 1.00') : null);
      const chk = el('span', 'pg-c pg-chk', '✓');
      return { row: el('div', 'pg-row', el('span', 'pg-step', String(i + 1)), loss, norm, chk), loss, norm, chk, clip: !!r.clip };
    });
    const loopN = el('b', null, '0');
    const checksN = el('b', null, '0');
    const win = PM.h('div', { class: `pm-screen ${X}pg-win` },
      el('div', 'pg-bar', ...dots(), el('span', null, 'train.log')),
      el('div', 'pg-row pg-head', el('span', null, T('step', '步')), el('span', null, 'loss'), el('span', null, T('grad norm', '梯度范数')), el('span', null, T('check', '检查'))),
      el('div', 'pg-rows', ...rows.map((x) => x.row)),
      el('div', 'pg-foot', el('span', 'pg-loop', PM.L('loop ', '循环 '), loopN, ' / 5'), el('span', 'pg-check', PM.L('checks passed ', '检查通过 '), checksN)));
    box.append(el('div', 'd-prog', left, win));
    /** a log row in stages: 1 started, 2 loss, 3 grad norm, 4 check, 5 done */
    const setRow = (i, st) => {
      const r = rows[i];
      r.row.classList.toggle(`${X}is-on`, st >= 1);
      r.row.classList.toggle(`${X}is-now`, st >= 1 && st < 5);
      r.row.classList.toggle(`${X}is-clip`, r.clip && st >= 3);
      r.loss.classList.toggle(`${X}is-on`, st >= 2);
      r.norm.classList.toggle(`${X}is-on`, st >= 3);
      r.chk.classList.toggle(`${X}is-on`, st >= 4);
    };
    return {
      reset() { code.mark({}); rows.forEach((_, i) => setRow(i, 0)); loopN.textContent = '0'; checksN.textContent = '0'; win.classList.remove(`${X}is-verified`); },
      async run(ctx, out) {
        ctx.narrate(T('The intent comes first, in plain words. Then the loop runs.', '先用一句话写明意图，然后循环开始运行。'));
        await ctx.sleep(1300);
        for (let i = 0; i < 5; i++) {
          const r = rows[i];
          if (i === 0) ctx.narrate(T('Each pass: forward, backward, clip, check, update.', '每一轮：前向、反向、裁剪、检查、更新。'));
          code.mark({ 1: 'run' }); loopN.textContent = String(i + 1); setRow(i, 1);
          await ctx.sleep(150);
          code.mark({ 2: 'run' }); setRow(i, 2);
          await ctx.sleep(250);
          code.mark({ 3: 'run' });
          await ctx.sleep(150);
          code.mark({ 4: r.clip ? 'warn' : 'run' }); setRow(i, 3);
          if (i === 3) {
            ctx.narrate(T('Step 4: a gradient spike of 4.61 is clipped to 1.0.', '第 4 步：梯度范数突增到 4.61，被裁剪到 1.0。'), 'warn');
            ctx.mark(T('Step 4: norm 4.61 clipped to 1.0', '第 4 步：范数 4.61 被裁剪到 1.0'), 'warn');
          }
          await ctx.sleep(r.clip ? 450 : 300);
          code.mark({ 5: 'ok' }); setRow(i, 4);
          checksN.textContent = String(i + 1);
          out(`${i + 1} · ${i + 1}`);
          if (i === 0) ctx.mark(T('Line 5: the first check passes', '第 5 行：第一次检查通过'), 'ok');
          await ctx.sleep(250);
          code.mark({ 6: 'run' }); setRow(i, 5);
          await ctx.sleep(150);
        }
        code.mark({ 5: 'ok' });
        win.classList.add(`${X}is-verified`);
        ctx.narrate(T('Five steps, five checks passed. The loop ends.', '五步训练，五次检查全部通过，循环结束。'), 'ok');
        ctx.mark(T('All five checks pass', '五次检查全部通过'), 'ok');
        out('5 · 5', 'ok');
        await ctx.sleep(1500);
      },
    };
  }

  /* ================================================================== the nine patterns */

  const raceArt = () => [Array(12).fill(1), [3, 1, 3, 2, 3], [5, 2, 5]].map((ch, r) => {
    let x = 10; let s = '';
    ch.forEach((n, p) => {
      for (let j = 0; j < n; j++) {
        const c = r === 2 ? 'o' : 'i';
        s += `<rect class="${c}${p % 2 ? '' : ` f${c}`}" x="${x.toFixed(1)}" y="${12 + r * 17}" width="6" height="10" rx="1.6"/>`;
        x += 6 + (j < n - 1 ? 1.2 : 2.8);
      }
    });
    return s;
  }).join('');
  const ART = {
    exploded: '<path class="k" d="M60 46 92 55 60 64 28 55z"/><path class="m" d="M60 30 92 39 60 48 28 39z"/><path class="a fa" d="M60 6 92 15 60 24 28 15z"/>'
      + '<path class="d" d="M28 15v40M92 15v40M60 24v40"/>',
    'two-worlds': '<rect class="k" x="6" y="10" width="50" height="40" rx="5"/><rect class="k" x="64" y="10" width="50" height="40" rx="5"/>'
      + '<path class="e" d="m24 23 14 14m0-14L24 37"/><path class="o" d="m80 31 6 6 12-13"/>'
      + '<path class="u fu" d="M12 54v9l2.4-2.2 1.6 3.6 1.7-.8-1.6-3.5h3.3z"/><path class="u fu" d="M70 54v9l2.4-2.2 1.6 3.6 1.7-.8-1.6-3.5h3.3z"/>',
    race: raceArt(),
    perturbation: '<rect class="k" x="8" y="12" width="36" height="36" rx="4"/><path class="a" d="M17 21h18l-10 19"/>'
      + [[13, 16], [38, 17], [19, 41], [39, 40], [30, 31], [12, 33]].map(([x, y]) => `<rect class="w fw" x="${x}" y="${y}" width="2.6" height="2.6" rx=".6"/>`).join('')
      + '<path class="m" d="M50 30h7m-2.8-2.8L57 30l-2.8 2.8"/><path class="k" d="M62 52h52"/>'
      + Array.from({ length: 10 }, (_, d) => { const h = d === 3 ? 34 : d === 7 ? 6 : 2.4; return `<rect class="${d === 3 ? 'e fe' : 'm'}" x="${(63.4 + d * 5).toFixed(1)}" y="${(52 - h).toFixed(1)}" width="3" height="${h}" rx=".8"/>`; }).join(''),
    decision: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12].map((h, j) => `<rect class="i fi" x="${10 + j * 10.4}" y="${28 - h * 1.5}" width="7" height="${h * 1.5}" rx="1.6"/>`).join('')
      + [3, 4, 2, 5, 3, 11, 2, 4, 5, 10].map((h, j) => `<rect class="g${h >= 8 ? ' fg' : ''}" x="${10 + j * 10.4}" y="${60 - h * 1.5}" width="7" height="${h * 1.5}" rx="1.6"/>`).join(''),
    trace: [0, 1, 2, 3, 4].map((i) => `<rect class="${i === 2 ? 'e' : i > 2 ? 'd' : 'k'}" x="14" y="${5 + i * 12}" width="76" height="8" rx="2"/>`).join('')
      + '<circle class="e fe" cx="52" cy="33" r="3.4"/><path class="e" d="M102 33V11m-4 4 4-4 4 4"/>',
    devices: '<rect class="k" x="10" y="8" width="18" height="34" rx="4"/><rect class="k" x="36" y="8" width="38" height="28" rx="3"/><path class="k" d="M36 15h38"/>'
      + '<rect class="k" x="82" y="10" width="30" height="20" rx="2"/><path class="k" d="M78 34h38"/>'
      + '<path class="a" d="M60 62C60 52 19 52 19 44M60 62c0-12-5-16-5-24M60 62c0-14 37-14 37-26"/><circle class="a fa" cx="60" cy="62" r="2.6"/>',
    replay: '<rect class="k" x="14" y="4" width="92" height="38" rx="4"/><path class="m" d="M22 11v25h78"/>'
      + '<path class="a" d="M24 13c6 10 12 14 20 16s22 2 52 3"/><circle class="o fo" cx="58" cy="30.6" r="2.8"/>'
      + Array.from({ length: 6 }, (_, j) => `<rect class="${j === 3 ? 'o fo' : j < 3 ? 'm' : 'k'}" x="${14 + j * 15.6}" y="48" width="12.4" height="9" rx="2"/>`).join('')
      + '<path class="k" d="M14 63h92"/><path class="a" d="M66 60v6"/>',
    program: '<path class="g" d="M14 18v26"/><path class="g" d="M14 18h4M14 44h4"/>'
      + '<path class="m" d="M10 8h44M24 22h52M24 30h40M24 38h58"/><path class="o" d="M10 54h60"/><circle class="o fo" cx="84" cy="54" r="6"/><path class="bg" d="m81.3 54 1.9 1.9 3.6-3.8"/>',
  };
  const art = (id) => { const s = PM.s('svg', { viewBox: '0 0 120 68', class: `${X}art-svg`, 'aria-hidden': 'true', focusable: 'false' }); s.innerHTML = ART[id]; return s; };

  const SK = (lines) => lines.join('\n');
  const PATTERNS = [
    { id: 'exploded', name: T('Exploded view', '3D 拆解'), make: demoExploded,
      q: T('What lies underneath the surface?', '表面之下还有什么？'),
      use: T('a familiar surface, such as a figure or a screenshot, is really several parts, and the claim is about the hidden ones.',
        '当熟悉的表面（一张插图、一张截图）其实由几部分组成，而结论落在看不见的部分上时。'),
      result: T('Parts the figure does not draw', '插图没有画出的部分'),
      where: T('The first lab takes a real Mac desktop apart in 3D, from the screenshot down to the parts a screenshot never shows.', '第一个实验把一台真实 Mac 的桌面拆成 3D 分层，从截图一直拆到截图里看不到的部分。'),
      code: SK([
        '// Exploded view: the block as papers draw it, taken apart into what it hides',
        "const P = PM.part(host, { id: 'block', q: PM.L('What is inside one transformer block?') });",
        'const view = PM.layers3d(P.scene, { layers: [',
        "  { id: 'fig', label: 'Block diagram', img: PM.asset('assets/block-figure.webp') },",
        "  { id: 'attn', label: 'Attention heads', w: 1200, h: 750, draw: drawHeads },",
        "  { id: 'mlp', label: 'MLP neurons', w: 1200, h: 750, draw: drawMlp },",
        "  { id: 'res', label: 'Residual stream', w: 1200, h: 750, draw: drawStream }] }).view;",
        "const out = PM.readouts(P.outcome, [{ id: 'hidden', label: PM.L('Parts the figure does not draw') }]);",
        "PM.player(P, { label: PM.t('Take it apart', '拆开看看'),",
        '  reset() { view.explode(0, { snap: true }); view.light(null, { snap: true }); out.reset(); },',
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('A transformer block, drawn the way most papers draw it.'));",
        '    await ctx.sleep(1600);',
        '    await ctx.tween(1800, k => view.explode(PM.ease.inOut(k), { snap: true }));',
        "    for (const [i, id] of ['attn', 'mlp', 'res'].entries()) {",
        "      view.light(id, { snap: ctx.seeking }); out.set('hidden', i + 1, 'warn');",
        "      ctx.mark(PM.t('Not drawn: ' + id), 'warn'); await ctx.sleep(1700);",
        '    }',
        '  } });']),
      focus: ['view.explode'] },
    { id: 'two-worlds', name: T('Two worlds', '左右对照'), make: demoTwoWorlds,
      q: T('What breaks when the usual assumption meets the real setting?', '常见的假设碰上真实环境，哪里会出错？'),
      use: T('the same step behaves differently under a common assumption and in the real setting.', '当同一步操作在常见假设下和真实环境中结果不同时。'),
      result: T('Pointer taken · left vs right', '鼠标被拿走次数（左 / 右）'),
      where: T('The benchmark-versus-real-computer lab runs the same step on two desktops, for example while a person keeps typing.', '“基准测试与真实电脑”实验在两个桌面上运行同一步操作，例如有人一直在打字的时候。'),
      code: SK([
        '// Two worlds: the same step by two agents on the same shared computer',
        "const P = PM.part(host, { id: 'sharing', q: PM.L('Who holds the pointer while you type?') });",
        "const A = makeSide(P.scene, 'Built for a benchmark'), B = makeSide(P.scene, 'Built for a shared computer');",
        "const out = PM.readouts(P.outcome, [{ id: 'taken', label: PM.L('Pointer taken · left vs right') }]);",
        "PM.player(P, { label: PM.t('Run both', '同时运行'),",
        '  reset() { A.restore(); B.restore(); out.reset(); },',
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('Same job on both sides: move four files.'));",
        '    for (let i = 1; i <= 4; i++) {                      // repeat the key event (R6)',
        "      ctx.mark(PM.t('Left: pointer taken, ' + i + ' of 4'), 'err');",
        '      await ctx.tween(1150, k => { A.dragWithPointer(i, k); B.dragInBackground(i, k); });',
        '      await ctx.tween(500, k => A.givePointerBack(k));',
        '    }',
        "    out.set('taken', '4 vs 0', 'err');",
        "    ctx.mark(PM.t('Right: the pointer was never taken'), 'ok');",
        '  } });']),
      focus: ['ctx.mark'] },
    { id: 'race', name: T('Race', '竞速'), make: demoRace,
      q: T('Same task, several ways: how much does each one need?', '同一个任务，几种做法：各要花多少？'),
      use: T('three or more methods do the same task and differ in one count: steps, passes or tokens.', '当三种以上的方法做同一件事，差别落在一个计数上（步数、前向次数或 token 数）时。'),
      result: T('Large-model passes · most vs fewest', '大模型前向次数 · 最多与最少'),
      where: T('Four ways for an agent to act, from single GUI actions to code execution, race on one task and one clock.', '智能体的四种操作方式，从单步 GUI 操作到代码执行，在同一任务、同一时钟下竞速。'),
      code: SK([
        '// Race: several decoding methods, one answer, one clock',
        "const LANES = [{ id: 'std', chunks: Array(12).fill(1) },            // tokens written per pass",
        "  { id: 'draft2', chunks: [3, 1, 3, 2, 3] }, { id: 'draft4', chunks: [5, 2, 5] }];",
        "const P = PM.part(host, { id: 'decoding', q: PM.L('How many passes does each method need?'),",
        "  lead: PM.L('A pass is one forward pass of the large model.') });",
        'LANES.forEach(l => { l.view = makeLane(P.scene, l); });',
        'const PASS = 560, draw = t => LANES.forEach(l => l.view.show(t / PASS));',
        "const out = PM.readouts(P.outcome, LANES.map(l => ({ id: l.id, label: PM.L('Passes · ' + l.id) })));",
        "PM.player(P, { label: PM.t('Run all three', '三种方式同时运行'),",
        '  reset() { draw(0); out.reset(); },',
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('Same answer, same clock. One beat is one pass.')); await ctx.sleep(1800);",
        '    let t = 0;',
        '    for (const l of [...LANES].sort((a, b) => a.chunks.length - b.chunks.length)) {',
        '      const t1 = l.chunks.length * PASS;',
        '      await ctx.tween(t1 - t, k => draw(PM.lerp(t, t1, k))); t = t1;   // one clock for every lane',
        "      out.set(l.id, l.chunks.length); ctx.mark(PM.t(l.id + ': done'), 'info');",
        '    }',
        '  } });']),
      focus: ['PM.lerp(t, t1, k)'] },
    { id: 'perturbation', name: T('Perturbation', '扰动'), make: demoPerturb,
      q: T('What happens when the input changes a little?', '输入稍微变一点，会发生什么？'),
      use: T('the claim is robustness: a small change to the input or the world, and which system still holds.', '当结论是“输入或环境稍有变化，系统依然可靠”时。'),
      result: T('After the change · standard vs robust', '改动后识别为 · 标准与稳健'),
      where: T('A result list moves after the agent looked: one agent clicks the old spot, the other is refused, looks again and opens the right item.', '智能体看过之后结果列表移动了：一个点在旧位置上，另一个被拒绝，重新观察后打开了正确的条目。'),
      code: SK([
        '// Perturbation: one small change at a fixed, marked moment; two models react',
        "const P = PM.part(host, { id: 'robust', q: PM.L('Does a change too small to see flip the prediction?') });",
        'const img = makeDigit(P.scene, DIGIT, SIGN);          // fixed arrays: the change is never random',
        "const A = makeBars(P.scene, 'Standard model'), B = makeBars(P.scene, 'Robust model');",
        "const out = PM.readouts(P.outcome, [{ id: 'a', label: PM.L('Standard reads') }, { id: 'b', label: PM.L('Robust reads') }]);",
        "PM.player(P, { label: PM.t('Play', '播放'),",
        '  reset() { img.add(0); A.show(CLEAN.a); B.show(CLEAN.b); out.reset(); },',
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('Both models read the image as a 7.')); await ctx.sleep(1500);",
        '    await ctx.tween(1000, k => img.add(0.03 * k));      // scheduled at a fixed time',
        "    ctx.mark(PM.t('A change of at most 0.03 per pixel'), 'warn');",
        '    await ctx.tween(800, k => A.show(mix(CLEAN.a, CHANGED.a, k)));',
        "    out.set('a', '3', 'err'); ctx.mark(PM.t('Standard model flips: 7 → 3'), 'err');",
        '    await ctx.tween(700, k => B.show(mix(CLEAN.b, CHANGED.b, k)));',
        "    out.set('b', '7', 'ok'); ctx.mark(PM.t('Robust model still reads 7'), 'ok');",
        '  } });']),
      focus: ['img.add(0.03 * k)'] },
    { id: 'decision', name: T('Decision timeline', '决策时间线'), make: demoDecision,
      q: T('Who decides what, and when?', '谁在什么时候决定什么？'),
      use: T('responsibility is split over time, a fixed rule against a choice the model makes, and the effect builds up over many steps.', '当职责随时间划分（固定规则对比模型自己的选择），效果要经过许多步才累积起来时。'),
      result: T('Layers run · rule vs model', '运行的层数 · 规则与模型'),
      where: T('The lab on who decides plays one task twice: under a fixed screenshot rule, and with the model asking when it needs the screen.', '“谁来决定”实验把同一个任务播放两遍：一遍按固定的截图规则，一遍由模型在需要时自己请求截图。'),
      code: SK([
        '// Decision timeline: a fixed rule vs a choice the model makes at every token',
        'const DEPTH = [3, 4, 2, 5, 3, 11, 2, 4, 5, 4, 2, 10];   // layers each token runs (early exit)',
        "const lanes = [{ id: 'fixed', depth: () => 12 }, { id: 'exit', depth: i => DEPTH[i] }];",
        "const P = PM.part(host, { id: 'depth', q: PM.L('Who decides how many layers each token gets?') });",
        'lanes.forEach(l => { l.view = makeLane(P.scene, l, DEPTH.length); });',
        "const out = PM.readouts(P.outcome, lanes.map(l => ({ id: l.id, label: PM.L('Layers run · ' + l.id) })));",
        "PM.player(P, { label: PM.t('Run both', '同时运行'),",
        '  reset() { lanes.forEach(l => l.view.show(0)); out.reset(); },',
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('Same sentence, same 12-layer model.'));",
        '    for (let i = 0; i < DEPTH.length; i++) {',
        '      await ctx.tween(600, k => lanes.forEach(l => l.view.show(i + k)));',
        '      lanes.forEach(l => out.set(l.id, l.view.layersRun()));',
        "      if (DEPTH[i] >= 10) ctx.mark(PM.t('Token ' + (i + 1) + ': the model goes deep'), 'agent');",
        '    }',
        '  } });']),
      focus: ['depth: i => DEPTH[i]'] },
    { id: 'trace', name: T('Request trace', '请求追踪'), make: demoTrace,
      q: T('Where does a failure stop, and what comes back?', '失败停在哪一层，返回了什么？'),
      use: T('a system has layers, and each failure stops at one layer with a specific error.', '当系统分成几层，每种失败都停在某一层并返回特定的错误时。'),
      result: T('Caught at', '拦截位置'),
      where: T('One request travels down the real-device harness architecture, and each failure stops at the layer that catches it, with a typed error.', '一个请求沿着真机 Harness 架构的各层往下走，每种失败都停在拦住它的那一层，并返回类型化错误。'),
      code: SK([
        '// Request trace: one request goes down the layers; a typed error comes back up',
        "const LAYERS = ['API gateway', 'Tokenizer', 'Scheduler', 'Batcher', 'GPU worker'];",
        "const P = PM.part(host, { id: 'serving', q: PM.L('Which layer stops a prompt that is too long?') });",
        "const stack = makeStack(P.scene, LAYERS), dot = stack.packet('generate()');",
        "const out = PM.readouts(P.outcome, [{ id: 'at', label: PM.L('Caught at') }]);",
        "PM.player(P, { label: PM.t('Send the request', '发送请求'),",
        "  reset() { dot.at(0); dot.text('generate()'); stack.clear(); out.reset(); },",
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('The client sends one long prompt down the stack.'));",
        '    await ctx.tween(1400, k => dot.at(PM.lerp(0, 2, PM.ease.inOut(k))));',
        "    stack.caught(2); out.set('at', 'Layer 3 of 5', 'err');",
        "    ctx.mark(PM.t('Caught at layer 3: Scheduler'), 'err');",
        "    dot.text('PROMPT_TOO_LONG');             // copied from the server code, never paraphrased",
        '    await ctx.tween(1400, k => dot.at(PM.lerp(2, 0, PM.ease.inOut(k))));',
        "    ctx.mark(PM.t('The client reads the error'), 'info');",
        '  } });']),
      focus: ["'PROMPT_TOO_LONG'"] },
    { id: 'devices', name: T('One program, many devices', '一个程序，多台设备'), make: demoDevices,
      q: T('Can one program drive several devices in one step?', '一步之内，一个程序能操作几台设备吗？'),
      use: T('one interface reaches several devices, and every call names the device it acts on.', '当一套接口通往多台设备，每次调用都写明作用在哪台设备上时。'),
      result: T('Devices · model calls', '设备 · 模型调用'),
      where: T('One program drives an Android phone, a dashboard tab and a Mac in a single step, and copies a file from the phone to the Mac.', '一个程序在一步之内操作 Android 手机、浏览器里的看板页面和 Mac，并把一个文件从手机复制到 Mac。'),
      code: SK([
        '// One program, many devices: real frames, one handle per device',
        "const P = PM.part(host, { id: 'devices', q: PM.L('Can one program use a phone, a browser and a Mac?') });",
        "const row = P.scene.appendChild(PM.h('div', { class: 'devices' })), add = () => row.appendChild(PM.h('div'));",
        "const dev = { phone: PM.device.phone(add(), { time: '9:41' }),",
        "  web: PM.device.browser(add(), { url: 'album.example.test', width: 900 }),",
        "  mac: PM.device.mac(add(), { menubar: { app: 'Finder' } }).desk };",
        "const code = PM.code(P.scene, { src: SRC, lang: 'python', focus: ['phone.', 'web.', 'mac.'] });",
        "const BEATS = [[1, 'phone'], [2, 'web'], [3, 'mac'], [4, 'phone'], [5, 'web'], [5, 'mac']];",
        "PM.player(P, { label: PM.t('Run the program', '运行程序'),",
        '  reset() { code.mark({}); Object.values(dev).forEach(d => d.clearFx()); },',
        '  async run(ctx) {',
        '    for (const [line, id] of BEATS) {',
        "      code.mark({ [line]: 'run' });",
        "      await ctx.tween(600, k => dev[id].flash(null, 'accent', k));   // deterministic flash",
        '    }',
        "    ctx.mark(PM.t('One model call for three devices'), 'agent');",
        '  } });']),
      focus: ["focus: ['phone.', 'web.', 'mac.']"] },
    { id: 'replay', name: T('Real-run replay', '真实运行回放'), make: demoReplay,
      q: T('What did the recorded run actually do?', '录下的运行里，实际发生了什么？'),
      use: T('the evidence is recorded runs (training, evaluation or agent traces), replayed with provenance on every frame.', '当证据来自录下的运行（训练、评测或智能体轨迹），回放时每一帧都要标明出处时。'),
      result: T('Checkpoints replayed', '已回放的检查点'),
      where: T('Recorded runs replay step by step, with the model, task, run and step named on every frame, using the runs the paper’s tables used.', '录下的运行逐步回放，每一帧都标明模型、任务、运行和步骤，而且只用论文表格所用的那些运行。'),
      code: SK([
        '// Real-run replay: saved checkpoints of one run, provenance on every frame',
        "const RUN = window.RUNS.find(r => r.model === 'Model A' && r.run === 1);   // written by a script from the logs",
        "const P = PM.part(host, { id: 'checkpoints', q: PM.L('When does the model first answer correctly?'),",
        "  source: [{ kind: 'real', text: PM.L('Real run · Model A · run 1') }] });",
        'const film = makeFilmstrip(P.scene, RUN.checkpoints);   // loss curve + the sample answer per checkpoint',
        "const out = PM.readouts(P.outcome, [{ id: 'ckpt', label: PM.L('Checkpoints replayed') }]);",
        "PM.player(P, { label: PM.t('Replay the run', '回放运行'),",
        '  reset() { film.show(1); out.reset(); },',
        '  async run(ctx) {',
        "    ctx.narrate(PM.t('Each frame is one saved checkpoint, replayed in order.'));",
        '    for (let s = 2; s <= RUN.checkpoints.length; s++) {',
        '      await ctx.tween(900, k => film.show(s - 1 + k));                 // crossfade, then hold',
        "      if (s === RUN.firstCorrect) ctx.mark(PM.t('Checkpoint ' + s + ': first correct answer'), 'ok');",
        '    }',
        "    out.set('ckpt', RUN.checkpoints.length + ' / ' + RUN.checkpoints.length);",
        '  } });']),
      focus: ["kind: 'real'"] },
    { id: 'program', name: T('Program anatomy', '程序解剖'), make: demoProgram,
      q: T('What does the code do, line by line?', '这段代码逐行做了什么？'),
      use: T('the claim is about code the system writes or runs: its loops, checks and decisive arguments.', '当结论涉及系统写出或运行的代码（循环、检查、关键参数）时。'),
      result: T('Steps · checks passed', '训练步数 · 通过的检查'),
      where: T('Programs quoted from the paper’s figures run line by line, from combining several interfaces to an executable check at the end.', '从论文插图原样引用的程序逐行运行，从组合多个接口一直到最后的可执行检查。'),
      code: SK([
        '// Program anatomy: intent in plain words, the real loop, lines light as they run',
        "const P = PM.part(host, { id: 'train-step', q: PM.L('What does each line of the training loop do?') });",
        "PM.intent(P.scene, PM.L('Take five training steps; clip every gradient and check that it is finite.'));",
        "const code = PM.code(P.scene, { src: SRC, lang: 'python', focus: ['torch.isfinite(norm)'] });",
        'const log = makeLog(P.scene);                        // step · loss · grad norm · check',
        "const PASS = [[1], [2, 'loss'], [3], [4, 'norm'], [5, 'check'], [6]];   // the lines of one pass",
        "const out = PM.readouts(P.outcome, [{ id: 'steps', label: PM.L('Steps') }, { id: 'checks', label: PM.L('Checks passed') }]);",
        "PM.player(P, { label: PM.t('Run the loop', '运行循环'),",
        '  reset() { code.mark({}); log.clear(); out.reset(); },',
        '  async run(ctx) {',
        '    for (let step = 1; step <= 5; step++) {',
        '      for (const [line, kind] of PASS) {',
        "        code.mark({ [line]: kind === 'check' ? 'ok' : 'run' });",
        '        if (kind) log.show(step, kind);               // the row fills as its line runs',
        "        if (kind === 'check') out.set('checks', step, 'ok');",
        '        await ctx.sleep(200);',
        '      }',
        "      out.set('steps', step);",
        '    }',
        "    ctx.mark(PM.t('All five checks pass'), 'ok');",
        '  } });']),
      focus: ["code.mark({ [line]: kind === 'check' ? 'ok' : 'run' })"] },
  ];
  PATTERNS.forEach((p, i) => { p.n = String(i + 1).padStart(2, '0'); });
  const byId = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

  /* ---- forms that another lab on this page shows on screen: the gallery links there instead of repeating them.
   *  Only labs whose scene plays the form (the case study's screenshot tour shows no recorded run, so Real-run replay
   *  has no tag; its "Where OpenGCUA used it" row says where it was used). */
  const ALSO = {
    'two-worlds': { slot: 'read-or-play', long: (n) => T(`Lab ${n} uses this form`, `实验 ${n} 用的就是这种形式`) },
    exploded: { slot: 'anatomy', long: (n) => T(`Lab ${n} uses this form in 3D`, `实验 ${n} 用的是它的 3D 版`) },
    trace: { slot: 'pipeline', long: (n) => T(`Lab ${n} traces one comment through the stations`, `实验 ${n} 追踪一条意见走过各个环节`) },
  };
  /** the lab number the page's chapter bar gives a slot ("03 Anatomy" → '03'), or null (e.g. the case study) */
  function labNo(slotId) {
    const slot = document.querySelector(`[data-pm-slot="${slotId}"]`);
    const sec = slot && slot.closest('[data-chapter-en]');
    const m = sec && /^(\d+)/.exec(sec.getAttribute('data-chapter-en') || '');
    return m ? m[1] : null;
  }

  /* ================================================================== the part */

  PMSite.register('patterns', function mount(host) {
    let cur = null;
    let demo = null;
    let player = null;
    let codePane = null;
    const played = new Set();

    /** where else on the page a form appears: {short, long, href} for a tile tag and the detail link */
    const also = {};
    Object.entries(ALSO).forEach(([id, { slot: slotId, long: longOf }]) => {
      const n = labNo(slotId);
      const slot = document.querySelector(`[data-pm-slot="${slotId}"]`);
      if (!n || !slot) return;                        // no numbered lab on this page: no tag
      const arrow = slot.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING ? ' ↑' : ' ↓';
      const long = longOf(n);
      also[id] = { short: T(`Lab ${n}`, `实验 ${n}`), long: T(long.en + arrow, long.zh + arrow), href: `#${slotId}` };
    });
    const myNo = labNo('patterns') || '04';

    const codeTeaser = PM.h('span');
    const whereList = el('ol', 'where');
    PATTERNS.forEach((p) => {
      whereList.append(PM.h('li', { dataset: { id: p.id } }, el('b', 'where-name', p.name), el('span', 'where-text', p.where)));
    });

    const P = PM.part(host, {
      id: 'patterns',
      eyebrow: PM.L(`Lab ${myNo} · Patterns`, `实验 ${myNo} · 模式`),
      q: PM.L('Which interactive form fits your claim?', '你的结论适合哪种交互形式？'),
      lead: PM.L('Nine forms, each for one kind of claim. Pick one, then press “Play the demo”.', '九种形式，各对应一类结论。选一个，再按“播放演示”。'),
      takeaway: PM.L('Choose the pattern by the kind of claim you make.', '先看结论是什么，再选交互形式。'),
      source: [
        { kind: 'sim', text: PM.L('Illustrative demos with generic content', '示意演示，内容为通用示例') },
        { kind: 'note', text: PM.L('Patterns catalogue · references/patterns.md', '模式目录 · references/patterns.md') },
      ],
      folds: [
        {
          title: PM.L('Kit code for this pattern', '这个模式的 kit 代码'),
          teaser: codeTeaser,
          render(body) {
            codePane = PM.code(body, { src: cur.code, lang: 'js', title: `sketch · ${cur.id}.js`, focus: cur.focus, maxHeight: 420 });
            body.append(PM.L('A sketch: helpers such as makeSide() or makeLane() stand for scene code you write. Full sketches and pitfalls are in references/patterns.md.',
              '这是示意代码：makeSide()、makeLane() 这类辅助函数代表你自己写的场景代码。完整示意与常见坑见 references/patterns.md。', 'p', { class: `${X}fold-note` }));
          },
        },
        {
          title: PM.L('Where OpenGCUA used it', 'OpenGCUA 在哪里用到它'),
          teaser: PM.L('One sentence per pattern from the case study', '每种模式一句话，取自案例'),
          render(body) { body.append(whereList); },
        },
      ],
    });

    /* ---- scene: tiles + detail */
    const tiles = PATTERNS.map((p) => {
      const sr = PM.h('span', { class: 'pm-sr' }, PM.L(' (played)', '（已播放）'));
      sr.hidden = true;
      const b = PM.h('button', { type: 'button', class: `${X}tile`, dataset: { id: p.id }, 'aria-pressed': 'false' },
        el('span', 'tile-top', el('span', 'tile-num', p.n), also[p.id] ? el('span', 'tile-also', also[p.id].short) : null),
        el('span', 'tile-played', '✓'),
        el('span', 'tile-art', art(p.id)),
        el('span', 'tile-name', p.name), sr);
      b.querySelector(`.${X}tile-played`).setAttribute('aria-hidden', 'true');
      PM.target(b, { onActivate: () => select(p.id) });
      b.srPlayed = sr;
      return b;
    });
    const grid = PM.h('div', { class: `${X}tiles`, role: 'group', 'aria-label': T('Nine patterns', '九种模式') }, ...tiles);
    grid.addEventListener('keydown', (e) => {
      const i = tiles.indexOf(document.activeElement);
      if (i < 0) return;
      // 3 × 3 grid (rows of three) or, on phones, a strip of two-tile columns (grid-auto-flow: column)
      const strip = getComputedStyle(grid).gridAutoFlow.startsWith('column');
      const across = strip ? 2 : 1;                   // ← → move along the rows
      const down = strip ? 1 : 3;                     // ↑ ↓ stay in the tile's column
      const vertical = e.key === 'ArrowDown' || e.key === 'ArrowUp';
      const step = { ArrowRight: across, ArrowLeft: -across, ArrowDown: down, ArrowUp: -down }[e.key];
      if (!step) return;
      if (vertical && strip && (i % 2 === 1) === (step > 0)) return;   // two rows: ↓ from the bottom, ↑ from the top
      if (vertical && (i + step < 0 || i + step >= tiles.length)) return;
      const j = clamp(i + step, 0, tiles.length - 1);
      if (j === i) return;
      e.preventDefault();
      tiles[j].focus({ preventScroll: true });
      if (strip) revealTile(tiles[j], false);
    });

    /** On phones the tiles are a two-row strip that snaps to column edges. Keep the selected tile fully in view by
     *  scrolling the strip only (never the page). At mount the strip stays at its start when the tile fits there
     *  (the default, 04, does), else the column before the tile's sits at the left edge; after a tap or a key, the
     *  strip moves only if the tile is cut off. */
    const STRIP_PAD = 3;                              // the strip's own inline padding (patterns.css)
    function revealTile(b, initial) {
      if (!b || grid.scrollWidth <= grid.clientWidth + 1) return;
      const pos = (t) => t.offsetLeft - grid.offsetLeft - STRIP_PAD;
      const x0 = pos(b);
      const x1 = x0 + b.offsetWidth + 2 * STRIP_PAD;
      const fits = (left) => x0 >= left - 1 && x1 <= left + grid.clientWidth + 1;
      if (!initial && fits(grid.scrollLeft)) return;
      if (initial && fits(0)) { grid.scrollLeft = 0; return; }
      const prev = [...new Set(tiles.map(pos))].sort((a, c) => a - c).filter((l) => l < x0 - 1).pop();
      grid.scrollLeft = Math.max(0, prev != null && fits(prev) ? prev : x0);
    }
    const kicker = el('p', 'kicker');
    const alsoLink = PM.h('a', { class: `${X}also`, href: '#' });
    const dq = el('h4', 'dq');
    const demoBox = el('div', 'demo');
    const useText = el('span', 'use-t');
    const detail = el('div', 'detail',
      el('div', 'dhead', el('div', 'krow', kicker, alsoLink), dq),
      demoBox,
      el('p', 'use', el('span', 'use-k', PM.L('Use it when', '适用场景：')), useText));
    detail.setAttribute('aria-live', 'off');
    P.scene.append(el('div', 'wrap', grid, detail));

    /* ---- readouts */
    const resultLabel = PM.h('span');
    const out = PM.readouts(P.outcome, [
      { id: 'result', label: resultLabel },
      { id: 'played', label: T('Patterns played', '已播放的模式'), value: '0 / 9' },
    ]);
    const setResult = (v, tone) => out.set('result', v == null ? '—' : v, tone || null);

    /* ---- the at-rest hint names the selected pattern */
    const hint = PM.h('span');

    function markPlayed(id) {
      played.add(id);
      tiles.forEach((b) => { const on = played.has(b.dataset.id); b.classList.toggle(`${X}is-played`, on); b.srPlayed.hidden = !on; });
      out.set('played', `${played.size} / 9`, played.size === 9 ? 'ok' : null);
    }

    function select(id, { initial = false } = {}) {
      const p = byId[id];
      if (!p || (cur && cur.id === id && !initial)) return;
      cur = p;
      tiles.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
      revealTile(tiles.find((b) => b.dataset.id === id), initial);
      kicker.replaceChildren(`${p.n} / 09 · `, PM.L(p.name));
      const a = also[p.id];
      alsoLink.hidden = !a;
      if (a) { alsoLink.href = a.href; alsoLink.replaceChildren(PM.L(a.long)); }
      dq.replaceChildren(PM.L(p.q));
      useText.replaceChildren(PM.L(p.use));
      resultLabel.replaceChildren(PM.L(p.result));
      hint.replaceChildren(PM.L(`${p.name.en}: press “Play the demo” to watch it.`, `${p.name.zh}：按“播放演示”观看。`));
      codeTeaser.replaceChildren(PM.L(`${p.name.en}: a ${p.code.split('\n').length}-line sketch with PM.part and PM.player`,
        `${p.name.zh}：用 PM.part 和 PM.player 写的 ${p.code.split('\n').length} 行示意`));
      if (codePane) codePane.set(p.code, { title: `sketch · ${p.id}.js`, focus: p.focus });
      whereList.querySelectorAll('li').forEach((li) => li.classList.toggle(`${X}is-cur`, li.dataset.id === id));
      // the demo: tear down, rebuild, then the player returns to rest and measures the new story
      if (demo && demo.destroy) demo.destroy();
      demoBox.replaceChildren();
      demoBox.dataset.demo = id;
      demo = p.make(demoBox);
      setResult(null);
      if (player) player.reset(); else demo.reset();
    }

    // default: a form no other part of the page uses, with content from outside the case study
    const query = (() => { try { return new URLSearchParams(location.search).get('pattern'); } catch (_) { return null; } })();
    select(byId[query] ? query : 'perturbation', { initial: true });

    player = PM.player(P, {
      label: T('Play the demo', '播放演示'),
      hint,
      reset() { if (demo) demo.reset(); setResult(null); },
      async run(ctx) { if (demo) await demo.run(ctx, setResult); },
      onDone() { if (cur) markPlayed(cur.id); },
    });

    // a new layout moves the things the demos place by measurement: re-render the moment on screen
    let lastW = 0;
    let raf = 0;
    const refresh = () => {
      raf = 0;
      if (!player || !demo) return;
      const st = player.state;
      if (st === 'idle') demo.reset();
      else if (st === 'running') player.seek(player.time, { pause: false });
      else if (st === 'paused') player.seek(player.time, { pause: true });
      else if (st === 'done' && player.duration) player.seek(player.duration, { pause: true });
    };
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        const w = demoBox.clientWidth;
        if (Math.abs(w - lastW) < 1) return;
        const first = lastW === 0;
        lastW = w;
        if (!first && !raf) raf = requestAnimationFrame(refresh);
      }).observe(demoBox);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (player && player.state === 'idle' && demo) demo.reset(); }).catch(() => {});
    // the strip's first position is set once the fonts have settled the layout
    requestAnimationFrame(() => revealTile(tiles.find((b) => b.dataset.id === cur.id), true));
  });
})();
