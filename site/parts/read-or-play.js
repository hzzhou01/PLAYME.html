/* Part 01 · read-or-play — the hero lab of the PLAYME homepage (pattern: Two worlds).
 *
 * One claim, written two ways, side by side in one scene:
 *   left   README.md    a rendered markdown section on paper: a heading, three sentences, a static figure;
 *   right  PLAYME.html  a live Mac desktop (PM.device.mac): you type in Chrome in front, Report.xlsx waits behind.
 * One Play runs the same click twice on one clock. A names no window, so it lands on Chrome's Pay now; B names
 * Report.xlsx, so Save is pressed behind Chrome while you keep typing. At each moment the README sentence that states
 * it gets a marker sweep, so the text and the mechanism are read together.
 * Deterministic: every wait and motion goes through ctx.sleep / ctx.tween, state is set absolutely, and reset()
 * restores everything. Geometry is in the desktop's logical pixels (1152 × 720), the numbers the code pane shows.
 * Styles: read-or-play.css (every selector under .pm #read-or-play). */
(function () {
  'use strict';

  const PM = window.PM;
  if (!PM || !PM.device || !window.PMSite) { console.error('[read-or-play] needs playme.js, playme-desk.js and site.js'); return; }
  const { h, L } = PM;
  const D = PM.device;
  const bi = (en, zh) => ({ en, zh });

  /* ------------------------------------------------------------------ geometry (logical desktop pixels) */
  const W = 1152;
  const H = 720;
  const CLICK = [612, 404];                              // both calls use these coordinates
  const REPORT = { x: 36, y: 322, w: 640, h: 322 };      // back window: its Save button is centred on CLICK
  const CHROME = { x: 400, y: 58, w: 712, h: 532 };      // front window: its Pay now button is centred on CLICK
  const SAVE = { x: 570, y: 389, w: 84, h: 30 };         // Save, in desktop coordinates (behind Chrome)
  const AGENT0 = [324, 524];                             // the agent rests on the spreadsheet
  const YOU0 = [944, 486];                               // you start on the fare summary …
  const YOU1 = [702, 276];                               // … and type in the "To" field
  const KNOCK = [806, 346];                              // where the untargeted click shoves your pointer
  const WORD = 'Tokyo';
  const BEFORE = 3;                                      // letters typed before the click ("Tok")

  /* ------------------------------------------------------------------ words */
  const CAP = {
    book: bi('You are booking a flight in Chrome.', '你正在 Chrome 里订机票。'),
    goal: bi('The agent wants to press Save in the spreadsheet behind it.', '智能体想按下后面那张表格里的“保存”。'),
    runA: bi('Run A: the click names no window.', 'A：这次点击没有指定窗口。'),
    hitA: bi('It lands on Pay now in Chrome, the front window.', '点击落到最前面的 Chrome 上，按下了“立即支付”。'),
    again: bi('Same click, now with a target.', '同样的点击，这次指定目标窗口。'),
    hitB: bi('Save reaches Report.xlsx. Chrome and your typing are untouched.', '“保存”送到了 Report.xlsx，Chrome 和你的输入都没被打扰。'),
  };
  const MARK = {
    a: bi('Click lands in the front window', '点击落在前台窗口'),
    b: bi('Delivered to Report.xlsx', '送达 Report.xlsx'),
  };
  const MD = {
    title: bi('Every action names its target', '每个操作都指明目标'),
    s: [
      bi('A computer-use agent shares the computer with its user.', '操作电脑的智能体，和用户共用同一台电脑。'),
      bi('A click that names no window goes to whichever window is in front, which may not be the window the agent looked at.',
        '没有指定窗口的点击，会落到当时最前面的窗口上，而那未必是智能体看着的窗口。'),
      bi('So each action names its target window, and the click reaches the right application without disturbing the user.',
        '所以每个操作都指明目标窗口：点击送到正确的应用，也不会打扰用户。'),
    ],
    fig: bi('Figure 1. Untargeted vs targeted click.', '图 1　未指定目标与指定目标的点击'),
  };
  const CALLS = ['click(612, 404)', 'click(612, 404, window="Report.xlsx")'];
  const NOTES = { en: ['# A: no target', '# B: names its window'], zh: ['# A：未指定窗口', '# B：指定了窗口'] };
  const FOCUS = 'window="Report.xlsx"';
  /** The two calls with trailing comments; on a phone each comment sits on its own unnumbered line above its call, so the
   * decisive token stays in view without scrolling. Line numbers 1 and 2 are always the two calls. */
  function codeSource(narrow) {
    const [a, b] = NOTES[PM.lang()];
    if (narrow) return { src: [a, CALLS[0], b, CALLS[1]].join('\n'), lineMap: [null, 1, null, 2] };
    return { src: [CALLS[0].padEnd(40) + a, CALLS[1].padEnd(40) + b].join('\n'), lineMap: null };
  }

  /* the excerpt shown in the fold "How this part is built": copied from this file (… marks elided lines) */
  const EXCERPT = `const P = PM.part(host, {
  id: 'read-or-play',
  eyebrow: L('Lab 01 · Presentation vs experience', '实验 01 · 呈现与体验'),
  q: L('Read it, or play it?', '读一遍，还是玩一遍？'),
  …
});
…
PM.player(P, {
  reset,
  async run(ctx) {
    ctx.narrate(CAP.book);
    md.now(0);
    await ctx.tween(900, (k) => { md.sweep(0, k); glide(you, YOU0, YOU1, k); }, PM.ease.inOut);
    …
    ctx.narrate(CAP.runA, 'agent');
    runs.set('a', 'live');
    code.mark(1, 'run');
    await ctx.sleep(400);
    await ctx.tween(1200, (k) => glide(agent, AGENT0, CLICK, k), PM.ease.inOut);
    const hit = desk.windowAt(...CLICK);                // the front window at (612, 404)
    ctx.mark(MARK.a, 'err');
    ctx.narrate(CAP.hitA, 'err');
    …
    await ctx.tween(800, (k) => {
      agent.ripple(k, 'err'); hold(chromeWin, 'err', k); md.sweep(1, k); knock(k);
      …
    });
    …
    ctx.narrate(CAP.again);
    await ctx.tween(600, (k) => rewind(k));
    …
    await ctx.tween(1200, (k) => glide(agent, AGENT0, CLICK, k), PM.ease.inOut);
    const target = desk.win('report');                  // named, so the window's place in the stack does not matter
    ctx.mark(MARK.b, 'ok');
    ctx.narrate(CAP.hitB, 'ok');
    …
    await ctx.tween(800, (k) => { agent.ripple(k, 'ok'); deliver(k); md.sweep(2, k); glow('ok', 0.5 + 0.5 * k); });
    …
  },
});`;

  /* ------------------------------------------------------------------ small drawings */
  function glyph(path, size = 16, cls) {
    const svg = h('svg', { class: ['rp-gl', cls], viewBox: '0 0 16 16', width: size, height: size, fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
    svg.innerHTML = path;
    return svg;
  }
  const G = {
    file: '<path d="M3.5 1.8h6l3 3v9.4h-9z"/><path d="M9.5 1.8v3h3M5.6 8h4.8M5.6 10.6h4.8"/>',
    disk: '<path d="M2.6 2.6h8.3l2.5 2.5v8.3H2.6z"/><path d="M5 2.6v3.2h5V2.6M4.8 13.4V9.4h6.4v4"/>',
    play: '<path d="M4.5 2.8v10.4L13 8z" fill="currentColor" stroke="none"/>',
    redo: '<path d="M12.5 6.2H6a3.3 3.3 0 0 0 0 6.6h2.5"/><path d="M10 3.6l2.6 2.6L10 8.8"/>',
    undo: '<path d="M3.5 6.2H10a3.3 3.3 0 0 1 0 6.6H7.5"/><path d="M6 3.6 3.4 6.2 6 8.8"/>',
    paste: '<path d="M5.5 2.8h5v2h-5z"/><path d="M5.5 3.8H3.6v10h8.8v-10h-1.9"/>',
    fill: '<path d="M3 9.2 7.4 4.8l3.8 3.8L6.8 13z"/><path d="M12.6 10.2s1.2 1.5 1.2 2.3a1.2 1.2 0 0 1-2.4 0c0-.8 1.2-2.3 1.2-2.3z"/><path d="M2.5 15h11"/>',
    alignL: '<path d="M2.5 3.5h11M2.5 6.5h7M2.5 9.5h11M2.5 12.5h7"/>',
    alignC: '<path d="M2.5 3.5h11M4.5 6.5h7M2.5 9.5h11M4.5 12.5h7"/>',
    sum: '<path d="M12 3H4l4.5 5L4 13h8"/>',
    chevD: '<path d="M4.5 6.5 8 10l3.5-3.5"/>',
    lock: '<rect x="3.6" y="7" width="8.8" height="6.4" rx="1.4"/><path d="M5.6 7V5.3a2.4 2.4 0 0 1 4.8 0V7"/>',
    plane: '<path d="M14 2 2.3 6.7l4.6 1.6L14 2 8.9 13.6l-2-5.3"/>',
    check: '<path d="m3.2 8.4 3 3 6.6-6.8"/>',
    rewind: '<path d="M3.3 8.7A4.9 4.9 0 1 0 4.7 4.5"/><path d="M4.5 1.8v2.9h2.9"/>',
  };

  /** Figure 1 of the README: two small ink diagrams, (a) untargeted and (b) targeted. Static on purpose. */
  function figure() {
    const panel = (ox, targeted) => `<g transform="translate(${ox} 0)">
      <rect class="f-back" x="12" y="20" width="112" height="72" rx="5"/>
      <path class="f-line" d="M12 32h112"/>
      <path class="f-thin" d="M12 48h112M12 62h112M12 76h112M44 32v60M78 32v60"/>
      <circle class="f-dot" cx="19" cy="26" r="1.7"/><circle class="f-dot" cx="25" cy="26" r="1.7"/><circle class="f-dot" cx="31" cy="26" r="1.7"/>
      <rect class="f-front" x="54" y="46" width="116" height="72" rx="5"/>
      <rect class="f-hatch" x="54" y="58" width="116" height="60" rx="0"/>
      <path class="f-line" d="M54 58h116"/>
      <circle class="f-dot" cx="61" cy="52" r="1.7"/><circle class="f-dot" cx="67" cy="52" r="1.7"/><circle class="f-dot" cx="73" cy="52" r="1.7"/>
      ${targeted
        ? `<rect class="f-xray" x="86" y="68" width="34" height="13" rx="2"/>
           <path class="f-arrow f-dash" d="M164 4C150 10 120 26 105 66"/><path class="f-head" d="M100.6 60.8 104.6 67.6 109.6 61.6"/>
           <path class="f-mark" d="M128 92l4 4 8-9"/>`
        : `<rect class="f-btn" x="86" y="68" width="34" height="13" rx="2"/>
           <path class="f-arrow" d="M164 4C150 10 120 26 105 66"/><path class="f-head" d="M100.6 60.8 104.6 67.6 109.6 61.6"/>
           <path class="f-mark" d="M129 87l9 9M138 87l-9 9"/>`}
    </g>`;
    const svg = h('svg', { class: 'rp-fig-svg', viewBox: '0 0 360 142', role: 'img',
      'aria-label': bi('Two overlapping windows. (a) An untargeted click hits the front window. (b) A targeted click reaches the window behind.',
        '两个重叠的窗口。(a) 未指定目标的点击落在前面的窗口上；(b) 指定目标的点击送到后面的窗口。') });
    svg.innerHTML = `<defs><pattern id="rp-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <path d="M0 0v5" class="f-hatch-line"/></pattern></defs>${panel(4, false)}${panel(184, true)}`;
    svg.append(
      L('(a) no target', '(a) 未指定目标', 'text', { class: 'f-label', x: 94, y: 138, 'text-anchor': 'middle' }),
      L('(b) target named', '(b) 指定目标窗口', 'text', { class: 'f-label', x: 274, y: 138, 'text-anchor': 'middle' }));
    return svg;
  }

  /* ------------------------------------------------------------------ the part */
  function mount(host) {
    const P = PM.part(host, {
      id: 'read-or-play',
      eyebrow: L('Lab 01 · Presentation vs experience', '实验 01 · 呈现与体验'),
      q: L('Read it, or play it?', '读一遍，还是玩一遍？'),
      lead: L('One claim, two ways: how a README presents it, and how a PLAYME lets you watch it happen.',
        '同一个结论，两种写法：README 的呈现方式，和 PLAYME 让你亲眼看到它发生。'),
      takeaway: L('Reading states the rule. Playing shows why it matters.', '读到的是规则，玩过才知道它为什么重要。'),
      source: [{ kind: 'sim', text: L('Simulation for illustration · adapted from the OpenGCUA case study', '示意模拟 · 改编自 OpenGCUA 案例') }],
      folds: [
        { title: L('How this part is built', '这个部件是怎么做的'), teaser: L('The story script, excerpted from the part’s source', '故事脚本，摘自部件源码'), render: buildFold },
        { title: L('Why a click needs a target', '为什么点击要指明目标'), teaser: L('Background windows on a real computer', '真实电脑上的后台窗口'), render: whyFold },
      ],
    });
    P.scene.classList.add('rp-scene');

    /* ---------------- README pane (paper) */
    const sents = MD.s.map((s, i) => L(s.en, s.zh, 'span', { class: ['rp-s', `rp-s${i + 1}`] }));
    const sp = () => L(' ', '\u200b', 'span', { class: 'rp-sp' });   // between sentences: a space in English, none in Chinese
    // footnote-style markers tie sentence 2 to run A and sentence 3 to run B (as in the PLAYME header and the code)
    const refs = [null, h('sup', { class: 'rp-ref is-a', 'aria-hidden': 'true' }, 'A'), h('sup', { class: 'rp-ref is-b', 'aria-hidden': 'true' }, 'B')];
    // below 640 px the sheet shows one sentence at a time (the one the scene is at); the three share one grid cell, so
    // the sheet keeps the height of the longest and the desktop under it never moves
    const wraps = sents.map((s, i) => h('span', { class: ['rp-sw', `rp-sw${i + 1}`] }, s, refs[i]));
    // the README's code fence; a narrow sheet shows it wrapped after the comma, as a formatter would
    const fence = h('pre', { class: 'rp-md-pre' },
      h('code', { class: 'is-one' }, 'click(612, 404, window=', h('span', null, '"Report.xlsx"'), ')'),
      h('code', { class: 'is-two', 'aria-hidden': 'true' }, 'click(612, 404,\n      window=', h('span', null, '"Report.xlsx"'), ')'));
    const readme = h('div', { class: 'rp-readme', dataset: { at: '0' } },
      h('div', { class: 'rp-tabbar', 'aria-hidden': 'true' },
        h('span', { class: 'rp-tab' }, glyph(G.file, 14), 'README.md')),
      h('article', { class: 'rp-paper', 'aria-label': bi('README.md, as a reader sees it', 'README.md：读者看到的样子') },
        L(MD.title.en, MD.title.zh, 'h4', { class: 'rp-md-h' }),
        h('p', { class: 'rp-md-p' }, wraps[0], sp(), wraps[1], sp(), wraps[2]),
        fence,
        h('figure', { class: 'rp-fig' }, figure(), L(MD.fig.en, MD.fig.zh, 'figcaption'))));

    /** The README's marker: one sentence is "now" (full colour, sweeping in), earlier ones stay lightly marked. */
    const md = {
      now(i) {
        readme.classList.add('is-live');
        readme.dataset.at = String(i);
        sents.forEach((s, j) => { s.classList.toggle('is-now', j === i); s.classList.toggle('is-past', j < i); });
        fence.classList.toggle('is-now', i === 2);
        refs.forEach((r, j) => { if (r) r.classList.toggle('is-on', j <= i); });
      },
      sweep(i, k) { sents[i].style.setProperty('--k', PM.clamp(k, 0, 1).toFixed(4)); },
      reset() {
        readme.classList.remove('is-live');
        readme.dataset.at = '0';
        sents.forEach((s) => { s.classList.remove('is-now', 'is-past'); s.style.setProperty('--k', '0'); });
        fence.classList.remove('is-now');
        refs.forEach((r) => { if (r) r.classList.remove('is-on'); });
      },
    };

    /* ---------------- PLAYME pane: header, Mac, code */
    const runEl = (id, en, zh) => h('span', { class: 'rp-run', dataset: { run: id, state: 'idle' } },
      h('b', null, id.toUpperCase()), L(en, zh, 'span', { class: 'rp-run-t' }));
    const runA = runEl('a', 'no target', '未指定窗口');
    const runB = runEl('b', 'names its window', '指定窗口');
    const runs = { set(id, state) { (id === 'a' ? runA : runB).dataset.state = state; } };
    const macHost = h('div', { class: 'rp-mac' });
    const codeHost = h('div', { class: 'rp-code' });
    const play = h('div', { class: 'rp-play' },
      h('div', { class: 'rp-head' },
        h('span', { class: 'rp-file' }, h('i', { class: 'rp-live', 'aria-hidden': 'true' }), 'PLAYME.html'),
        h('span', { class: 'rp-runs' }, runA, runB)),
      macHost, codeHost);
    P.scene.append(h('div', { class: 'rp' }, readme, play));

    /* the desktop */
    const mac = D.mac(macHost, {
      width: W, height: H,
      menubar: { app: 'Chrome', clock: 'Tue 9:41 AM' },
      dock: ['Finder', 'Chrome', 'Excel', 'Mail', 'Notes', 'Terminal'],
      icons: [{ name: 'Trips', kind: 'folder', x: 20, y: 42 }, { name: 'Itinerary.pdf', x: 20, y: 140 }],
      crop: { x: 150, y: 0, w: 990, h: 660, below: 560 },
      label: bi('Simulated Mac desktop: Chrome in front, Report.xlsx behind it', '模拟 Mac 桌面：前面是 Chrome，后面是 Report.xlsx'),
    });
    const desk = mac.desk;

    /* back window: Report.xlsx (a spreadsheet with a Save button and a status bar) */
    const sheet = D.sheet({
      cols: [bi('Region', '地区'), 'Q1', 'Q2', 'Q3', 'Q4'],
      rows: [[bi('North', '北区'), 12840, 13210, 14100, 14980], [bi('South', '南区'), 9800, 10450, 11020, 11730],
        [bi('East', '东区'), 15320, 14980, 16210, 16840], [bi('West', '西区'), 8720, 9130, 9640, 10120],
        [bi('Total', '合计'), 46680, 47770, 50970, 53670]],
      colWidths: [112, 92, 92, 92, 92],
      title: bi('Q4 report', 'Q4 报表'),
      selected: 'E2',
      minRows: 7,
    });
    const tool = (g) => h('span', { class: 'rp-xl-t' }, glyph(g, 15));
    const saveBtn = h('span', { class: 'rp-xl-save' }, glyph(G.disk, 15), L('Save', '保存'));
    const toolbar = h('div', { class: 'rp-xl-tools' },
      tool(G.paste), tool(G.undo), tool(G.redo), h('i', { class: 'rp-xl-sep' }),
      h('span', { class: 'rp-xl-sel is-wide' }, 'Aptos', glyph(G.chevD, 10)), h('span', { class: 'rp-xl-sel' }, '12', glyph(G.chevD, 10)),
      h('b', { class: 'rp-xl-t' }, 'B'), h('i', { class: 'rp-xl-t is-i' }, 'I'), h('u', { class: 'rp-xl-t' }, 'U'), h('i', { class: 'rp-xl-sep' }),
      tool(G.fill), tool(G.alignL),
      h('span', { class: 'rp-xl-share' }, L('Share', '共享')), saveBtn);
    const stUnsaved = h('span', { class: 'rp-xl-st is-unsaved' }, h('i'), L('Unsaved changes', '有未保存的更改'));
    const stSaved = h('span', { class: 'rp-xl-st is-saved', hidden: true }, glyph(G.check, 13), L('Saved', '已保存'));
    const status = h('div', { class: 'rp-xl-status' }, L('Ready', '就绪', 'span', { class: 'rp-xl-ready' }), stUnsaved, stSaved, h('span', { class: 'rp-xl-zoom' }, '100%'));
    sheet.el.querySelector('.pm-app-ribbon').after(toolbar);
    sheet.el.append(status);
    toolbar.setAttribute('aria-hidden', 'true');
    const reportWin = desk.window({ id: 'report', app: 'Excel', title: 'Report.xlsx', ...REPORT, content: sheet });

    /* front window: Chrome on a flight-booking page */
    const typed = h('span', { class: 'rp-typed' });
    const lost = h('span', { class: 'rp-lost', 'aria-hidden': 'true' }, h('i', null, 'y'), h('i', null, 'o'));
    const field = (label, value, cls) => h('div', { class: ['rp-field', cls] }, L(label[0], label[1], 'small'), h('span', { class: 'rp-field-v' }, value));
    const toField = h('div', { class: 'rp-field is-to' }, L('To', '目的地', 'small'),
      h('span', { class: 'rp-field-v' }, L('City or airport', '城市或机场', 'span', { class: 'rp-ph' }), typed, h('span', { class: 'rp-caret' }), lost));
    const pay = h('div', { class: 'rp-pay' },
      h('span', { class: 'rp-pay-idle' }, glyph(G.lock, 15), L('Pay now', '立即支付'), h('b', null, '€842')),
      h('span', { class: 'rp-pay-busy' }, h('i', { class: 'rp-spin' }), L('Paying €842…', '正在支付 €842…')));
    const line = (a, b, cls) => h('div', { class: ['rp-line', cls] }, L(a[0], a[1]), h('b', null, b));
    const site = h('div', { class: 'rp-site' },
      h('div', { class: 'rp-site-head' },
        h('span', { class: 'rp-logo' }, glyph(G.plane, 18), h('span', null, 'sky', h('b', null, 'fare'))),
        h('span', { class: 'rp-nav' }, L('Flights', '机票'), L('Hotels', '酒店'), L('My trips', '我的行程')),
        h('span', { class: 'rp-avatar' })),
      h('div', { class: 'rp-site-body' },
        h('div', { class: 'rp-form' },
          L('Book your flight', '预订航班', 'div', { class: 'rp-h' }),
          h('div', { class: 'rp-row' }, field(['From', '出发地'], 'Berlin (BER)'), toField),
          h('div', { class: 'rp-row' }, field(['Depart', '出发日期'], L('Fri, 14 Nov', '11月14日 周五')), field(['Travellers', '乘客'], L('1 adult', '1 位成人'))),
          h('div', { class: 'rp-total' }, L('Total, taxes included', '总价（含税）'), h('b', null, '€842')),
          pay,
          h('div', { class: 'rp-secure' }, glyph(G.lock, 12), L('Secure payment · Visa •••• 4242', '安全支付 · Visa •••• 4242'))),
        h('div', { class: 'rp-side' },
          L('Your flight', '你的航班', 'div', { class: 'rp-side-h' }),
          h('div', { class: 'rp-trip' }, h('b', null, 'BER'), h('i'), h('b', { class: 'rp-trip-to' }, '···')),
          L('Fri, 14 Nov · 07:05 · 1 stop', '11月14日 周五 · 07:05 · 经停 1 次', 'div', { class: 'rp-trip-sub' }),
          line(['Fare', '票价'], '€790'), line(['Taxes and fees', '税费'], '€52'), line(['Total', '总价'], '€842', 'is-total'),
          L('Free cancellation for 24 hours', '24 小时内免费取消', 'div', { class: 'rp-free' }))));
    const chromeWin = desk.window({
      id: 'chrome', kind: 'browser', app: 'Chrome', ...CHROME,
      tabs: [{ title: bi('Book a flight · skyfare', '预订航班 · skyfare'), url: 'https://skyfare.example/book', active: true, content: site, icon: { letter: 's', color: '#1a6be0' } },
        { title: bi('Inbox (2)', '收件箱 (2)'), url: 'https://mail.example/inbox', icon: { letter: 'M', color: '#d9573b' } }],
    });

    /* pointers, and an effects layer of this part above the windows (x-ray outlines, tags, the rewind veil) */
    const agent = desk.pointer('agent');
    const you = desk.pointer('user');
    agent.set(...AGENT0);
    you.set(...YOU0);
    const s0 = desk.snapshot();
    /** a short label anchored at (x, y) of the desktop that keeps a legible size at any scale */
    const tag = (cls, text, x, y, icon) => h('div', { class: ['rp-tag', ...cls], style: { left: `${x}px`, top: `${y}px` } },
      h('span', null, icon || null, L(text.en, text.zh)));
    const xwin = h('div', { class: 'rp-xwin', style: { left: `${REPORT.x}px`, top: `${REPORT.y}px`, width: `${REPORT.w}px`, height: `${REPORT.h}px` } });
    const xsave = h('div', { class: 'rp-xsave', style: { left: `${SAVE.x}px`, top: `${SAVE.y}px`, width: `${SAVE.w}px`, height: `${SAVE.h}px` } },
      glyph(G.disk, 15), L('Save', '保存'));
    const tagSave = tag(['is-agent'], bi('Save, hidden behind Chrome', '“保存”被 Chrome 挡住了'), SAVE.x + SAVE.w + 12, CLICK[1]);
    const STATUS_Y = REPORT.y + REPORT.h - 12;            // the middle of Report.xlsx's status bar, where "Saved" appears
    const SAVED = bi('Saved in Report.xlsx', '已保存到 Report.xlsx');
    const tagSaved = tag(['is-ok', 'is-left'], SAVED, REPORT.x + REPORT.w + 12, STATUS_Y);
    const badge = tag(['is-ok', 'is-badge'], SAVED, 162, STATUS_Y - 18, glyph(G.check, 15));   // phones only (CSS)
    const veil = h('div', { class: 'rp-veil' }, h('span', null, glyph(G.rewind, 40)));
    const fx = h('div', { class: 'rp-fx', 'aria-hidden': 'true' }, xwin, xsave, tagSave, tagSaved, badge, veil);
    mac.screen.append(fx);

    /* the code both runs execute */
    const phone = typeof matchMedia === 'function' ? matchMedia('(max-width: 560px)') : null;
    const code = PM.code(codeHost, { ...codeSource(phone && phone.matches), lang: 'python', focus: [FOCUS], ariaLabel: bi('The two clicks', '两次点击') });
    const recode = () => code.set(codeSource(phone && phone.matches));
    PM.onLang(recode);
    if (phone && phone.addEventListener) phone.addEventListener('change', recode);

    /* outcome */
    const out = PM.readouts(P.outcome, [
      { id: 'a', label: bi('Untargeted click', '未指定窗口的点击') },
      { id: 'b', label: bi('Targeted click', '指定窗口的点击') },
      { id: 'u', label: bi('User interrupted', '用户被打断') },
    ]);

    /* ---------------- scene state: every function sets state absolutely, so any frame can be rebuilt */
    const lerp = PM.lerp;
    const fade = (el, a) => { el.style.opacity = String(PM.clamp(a, 0, 1)); };
    const glide = (p, a, b, k) => p.set(lerp(a[0], b[0], k), lerp(a[1], b[1], k));
    /** a kit flash that fades in and then stays on (k of the flash held at 0.6) */
    const hold = (target, tone, k) => desk.flash(target, tone, 0.001 + 0.599 * PM.clamp(k, 0, 1));
    const glow = (tone, a) => { play.dataset.glow = tone; play.style.setProperty('--rp-ga', String(PM.clamp(a, 0, 1))); };
    const page = {
      type(n) {
        typed.textContent = WORD.slice(0, n);
        toField.classList.toggle('has-text', n > 0);
      },
      focus(on) { toField.classList.toggle('is-focus', on); },
      lost(k) {
        lost.hidden = !(k > 0 && k < 1);
        [...lost.children].forEach((ch, i) => {
          const kk = PM.clamp((k - i * 0.35) / 0.65, 0, 1);
          ch.style.opacity = String(kk > 0 && kk < 1 ? 1 - kk : 0);
          ch.style.transform = `translate(${i * 8 + kk * 10}px, ${-kk * 30}px) rotate(${kk * (i ? 16 : -12)}deg)`;
        });
      },
      paid(on) { pay.classList.toggle('is-pressed', on); },
    };
    const report = {
      saved(on) { stUnsaved.hidden = on; stSaved.hidden = !on; status.classList.toggle('is-saved', on); },
      aim(tone) {
        reportWin.el.classList.toggle('rp-aim', !!tone);
        reportWin.el.dataset.tone = tone || '';
      },
    };
    /** the target behind Chrome: the window outline (k) and Save (ks), seen through Chrome (x-ray), in a tone */
    function xray(k, tone, ks = k) {
      xwin.dataset.tone = tone;
      xsave.dataset.tone = tone;
      fade(xwin, k * (tone === 'ok' ? 0.9 : 0.75));
      fade(xsave, ks);
    }
    /** the untargeted click shoves your pointer away and takes the focus out of the field */
    function knock(k) {
      const e = PM.ease.out(PM.clamp(k / 0.45, 0, 1));
      glide(you, YOU1, KNOCK, e);
      you.el.classList.toggle('rp-knocked', k > 0);
      you.el.style.setProperty('--rp-rot', `${(Math.sin(k * Math.PI * 3) * 26 * (1 - k)).toFixed(2)}deg`);
      you.ripple(k, 'err');
      if (k > 0) { page.focus(false); you.label(bi('You · interrupted', '你 · 被打断')); }
    }
    /** a quick rewind between the runs: the veil peaks at k = 0.5, where the desktop goes back to the moment before A */
    function rewind(k) {
      fade(veil, Math.sin(Math.PI * PM.clamp(k, 0, 1)));
      veil.firstChild.style.transform = `scale(var(--pm-ui)) rotate(${(-300 * k).toFixed(1)}deg)`;
      if (k < 0.5) return;
      desk.clearFx();
      page.paid(false); page.lost(0); page.type(BEFORE); page.focus(true);
      you.set(...YOU1).label(bi('You', '你'));
      you.el.classList.remove('rp-knocked');
      agent.set(...AGENT0);
      xray(1, 'agent'); fade(tagSave, 0);
      glow('accent', 0.5);
    }
    /** run B: the agent's click is a background event for Report.xlsx (the pointer is drawn as a ghost) */
    function aim(on) {
      agent.el.classList.toggle('rp-ghost', on);
      agent.label(on ? bi('Agent → Report.xlsx', '智能体 → Report.xlsx') : bi('Agent', '智能体'));
      mac.el.classList.toggle('is-b', on);
      codeHost.classList.toggle('is-b', on);
      report.aim(on ? 'agent' : null);
    }
    /** run B lands: Save shows through Chrome in green, Report.xlsx flashes green (600 ms), its status bar turns green and
     * a tag at the status bar says it (a badge on a phone) */
    function deliver(k) {
      xray(1, 'ok');
      xsave.style.transform = `scale(${(1 + 0.14 * Math.sin(Math.PI * PM.clamp(k / 0.6, 0, 1))).toFixed(4)})`;
      report.aim('ok');
      desk.flash(reportWin, 'ok', k / 0.75);
      hold(status, 'ok', k);
      fade(tagSaved, k * 3);
      fade(badge, k * 3);
    }

    function reset() {
      desk.restore(s0);                                   // windows, pointers, kit flashes and ripples
      aim(false);
      you.label(bi('You', '你'));
      you.el.classList.remove('rp-knocked');
      you.el.style.removeProperty('--rp-rot');
      page.type(0); page.focus(false); page.lost(0); page.paid(false);
      report.saved(false);
      xray(0, 'agent'); xsave.style.transform = '';
      fade(tagSave, 0); fade(tagSaved, 0); fade(badge, 0); fade(veil, 0); veil.firstChild.style.transform = '';
      md.reset();
      code.mark({});
      runs.set('a', 'idle'); runs.set('b', 'idle');
      glow('accent', 0.5);
      out.reset();
    }

    const player = PM.player(P, {
      reset,
      async run(ctx) {
        // 1 · you type in Chrome (README sentence 1)
        ctx.narrate(CAP.book);
        md.now(0);
        await ctx.tween(900, (k) => { md.sweep(0, k); glide(you, YOU0, YOU1, k); }, PM.ease.inOut);
        page.focus(true);
        await ctx.tween(300, (k) => you.ripple(k, 'user'));
        for (let n = 1; n <= BEFORE; n++) { await ctx.sleep(220); page.type(n); }
        await ctx.sleep(460);
        // 2 · the agent's goal: Save in Report.xlsx, behind Chrome at (612, 404)
        ctx.narrate(CAP.goal, 'agent');
        await ctx.tween(900, (k) => { xray(k, 'agent'); fade(tagSave, k); glow('agent', 0.5 + 0.3 * k); });
        await ctx.sleep(900);
        // 3 · run A: the click names no window, so it goes to the front window at (612, 404)
        ctx.narrate(CAP.runA, 'agent');
        runs.set('a', 'live');
        code.mark(1, 'run');
        await ctx.sleep(400);
        await ctx.tween(1200, (k) => glide(agent, AGENT0, CLICK, k), PM.ease.inOut);
        const hit = desk.windowAt(...CLICK);                // the front window at (612, 404)
        ctx.mark(MARK.a, 'err');
        ctx.narrate(CAP.hitA, 'err');
        md.now(1); page.paid(true); code.mark(1, 'err'); runs.set('a', 'bad'); fade(tagSave, 0);
        out.set('a', `${hit ? hit.app : '—'} ✗`, 'err');
        await ctx.tween(800, (k) => {
          agent.ripple(k, 'err'); hold(chromeWin, 'err', k); md.sweep(1, k); knock(k);
          xray(1 - 0.8 * PM.clamp(k * 3, 0, 1), 'agent', 1 - k * 8); glow('err', 0.5 + 0.5 * k);
        });
        await ctx.tween(700, (k) => page.lost(k));          // the rest of "Tokyo" goes nowhere
        out.set('u', 1, 'err');
        await ctx.sleep(1300);
        // 4 · rewind to the moment before A, then run B: the same click names Report.xlsx
        ctx.narrate(CAP.again);
        await ctx.tween(600, (k) => rewind(k));
        runs.set('b', 'live');
        code.mark(2, 'run');
        aim(true);
        await ctx.tween(400, (k) => glow('agent', 0.5 + 0.3 * k));
        await ctx.tween(1200, (k) => glide(agent, AGENT0, CLICK, k), PM.ease.inOut);
        const target = desk.win('report');                  // named, so the window's place in the stack does not matter
        ctx.mark(MARK.b, 'ok');
        ctx.narrate(CAP.hitB, 'ok');
        md.now(2); report.saved(true); code.mark(2, 'ok'); runs.set('b', 'good');
        out.set('b', `${target.title} ✓`, 'ok');
        await ctx.tween(800, (k) => { agent.ripple(k, 'ok'); deliver(k); md.sweep(2, k); glow('ok', 0.5 + 0.5 * k); });
        for (let n = BEFORE + 1; n <= WORD.length; n++) { await ctx.sleep(220); page.type(n); }
        out.set('u', '1 → 0', 'ok');
        await ctx.sleep(2300);
      },
    });

    /* ---------------- Play brings the scene into view (stacked layouts: phones and tablets)
     * Stacked, this part is one tall column: the README sheet, then the desktop, the code and the caption. A reader who
     * taps Play with the question near the top would watch the README while the click, the "Saved" badge and the
     * caption play below the window. So Play scrolls first, measuring the bar against the page header it sticks under:
     *   the stage fits  → it comes fully into view with the least scroll; the bar stays in place, nothing is covered;
     *   it does not     → the stage's top goes above the header line, so the bar sticks (a compact row on a phone),
     *                     and the desktop, the code and the caption are in view; the README's top may pass under the bar.
     * Then the run starts. Side by side (≥ 900 px) the kit frames the stage. */
    const stackedMq = typeof matchMedia === 'function' ? matchMedia('(max-width: 899px)') : null;
    const EDGE = 8;                                      // px kept clear above the window's bottom
    /** the stage's height, the bar's height and the desktop's top (from the stage's top), with the bar stuck or not */
    function stageBox(stuck) {
      const st = P.stage;
      const was = st.classList.contains('is-stuck');
      st.classList.toggle('is-stuck', stuck);
      const r = st.getBoundingClientRect();
      const box = { h: r.height, bar: P.bar.getBoundingClientRect().height, mac: macHost.getBoundingClientRect().top - r.top };
      st.classList.toggle('is-stuck', was);
      return box;
    }
    const viewH = () => window.innerHeight || document.documentElement.clientHeight;
    const headH = () => parseFloat(getComputedStyle(P.bar).top) || 0;   // the page header the bar sticks under
    const narrBottom = () => P.narration.getBoundingClientRect().bottom;
    /** where the stage's top should be (viewport y), or null when the scene is already in view */
    function frameTarget() {
      const vh = viewH();
      const head = headH();
      const top = P.stage.getBoundingClientRect().top;
      const full = stageBox(false);
      if (full.h <= vh - head - 2) {
        if (top >= head && top + full.h <= vh) return null;
        return top < head ? head + 1 : Math.max(head + 1, vh - EDGE - full.h);
      }
      if (top < head && narrBottom() <= vh && macHost.getBoundingClientRect().top >= P.bar.getBoundingClientRect().bottom) return null;
      const c = stageBox(true);
      const fit = vh - EDGE - c.h;                       // the caption's bottom just above the window's bottom
      const macFirst = head + c.bar + 4 - c.mac;         // never push the desktop's top under the bar
      return Math.min(Math.max(fit, macFirst), head - 1);
    }
    function scrollBy(dy) {
      if (Math.abs(dy) < 2) return Promise.resolve();
      const smooth = !PM.reduced();
      window.scrollTo({ top: Math.max(0, window.scrollY + dy), behavior: smooth ? 'smooth' : 'auto' });
      if (!smooth) return Promise.resolve();
      return new Promise((done) => {
        let last = window.scrollY, still = 0, n = 0;
        const tick = () => {
          n++;
          if (Math.abs(window.scrollY - last) < 1) still++; else still = 0;
          last = window.scrollY;
          if (still >= 3 || n > 90) done(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    async function frameScene() {
      const to = frameTarget();
      if (to == null) return;
      await scrollBy(P.stage.getBoundingClientRect().top - to);
      // a bar that did not turn compact leaves the caption cut: scroll on, keeping the desktop's top clear of the bar
      const cut = narrBottom() - (viewH() - EDGE);
      const room = macHost.getBoundingClientRect().top - (P.bar.getBoundingClientRect().bottom + 4);
      if (cut > 2 && room > 2) await scrollBy(Math.min(cut, room));
    }
    let framing = false;
    P.bar.addEventListener('click', (ev) => {
      if (!stackedMq || !stackedMq.matches || ev.target.closest('.pm-primary') !== player.primary) return;
      if (player.state === 'running') return;            // Pause: the kit's own handler
      ev.stopPropagation();
      if (framing) return;
      framing = true;
      frameScene().catch(() => {})
        .then(() => { framing = false; return player.play(); })
        // reduced motion: Play shows the end at once, with the last captions listed (a taller stage): frame that
        .then(() => { if (PM.reduced()) return frameScene(); })
        .catch((err) => console.error('[read-or-play] Play failed', err));
    }, true);

    /* ---------------- folds */
    function buildFold(el) {
      el.append(L('The story is one async function on the kit’s virtual clock. The kit builds Play, the progress bar, seeking and the marks from it. Most of the file’s 600 or so lines draw the scene: the README sheet, the spreadsheet and the booking page.',
        '整个故事是一个运行在 kit 虚拟时钟上的 async 函数，播放、进度条、拖动跳转和标记都由 kit 据此生成。这个文件约 600 行，大部分用来画场景：README、表格和订票页面。', 'p'));
      PM.code(el, { src: EXCERPT, lang: 'js', title: 'site/parts/read-or-play.js', focus: ['ctx.mark'], maxHeight: 420 });
    }
    function whyFold(el) {
      el.append(
        L('On a real computer the agent and the person share one screen, one pointer and one keyboard focus. A click sent to a screen position goes to whatever window is drawn there at that moment.',
          '在真实的电脑上，智能体和人共用一块屏幕、一个指针和同一个键盘焦点。发往某个屏幕坐标的点击，会落到那一刻画在那里的窗口上。', 'p'),
        L('Windows move between the moment the agent looks and the moment it acts. A notification, a new tab or the person’s own work can bring another window to the front, and the same coordinates then reach a different application.',
          '从智能体看屏幕到它动手，窗口可能已经变了。一条通知、一个新标签页，或者人自己的操作，都可能把另一个窗口提到最前；同样的坐标，就落到了别的应用里。', 'p'),
        L('When the action names its target window, the system delivers the event to that window directly, even when another window covers it, and the person’s pointer and typing stay where they were. This lab adapts an example from the OpenGCUA case study, where a benchmark click names no target and a click on a real device must.',
          '如果操作指明了目标窗口，系统会把事件直接送到那个窗口，即使它被别的窗口挡住；人的指针和输入都保持原样。这个实验改编自 OpenGCUA 案例：在基准测试里，点击不指明目标；在真实设备上，点击必须指明目标。', 'p'));
    }
  }

  PMSite.register('read-or-play', mount);
})();
