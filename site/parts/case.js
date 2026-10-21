/* Part 'case' of the PLAYME homepage. Pattern: real-run replay, as a filmstrip.
 *
 * Six real screens of the OpenGCUA Interactive Lab in a browser frame, in the page's language (the lab is bilingual,
 * so the Chinese page shows the lab's Chinese screens). Each screen is the lab's scene only: no transport bar and no
 * caption strip, so the picture never shows a second Play button or a second caption under this part's own (R5).
 * One Play runs a guided tour: each screen crossfades in, the camera pans and zooms toward the mechanism the caption
 * names, and a spotlight outlines it (that moment is a mark on the scrubber). The thumbnails are in-scene targets that
 * jump to a lab.
 *
 * The tour is the player's timeline form: render(t) is a pure function of time (and of the view size and language),
 * so Play, the scrubber, the thumbnails, a seek and a frame capture all land on the same picture. No Date, random or
 * CSS transition carries meaning.
 *
 * Screens: the lab's scenes captured at 916 css px, 2x, scaled to 1400 px.
 * Lab 1's painted task material (file names, window titles, web pages) is replaced with placeholders at capture
 * time (no task names before the paper is public). Lab 7 (real runs) is left out: its screens show model names. The source line says both.
 *
 * Naming: this page's own parts are "Lab 01–05", so OpenGCUA's labs are never a bare "Lab N" here: captions and marks
 * use the screen's name, and any number is written "OpenGCUA lab N" (alt text, labels, the source line). */
(function () {
  'use strict';
  if (!window.PM || !window.PMSite) return;

  /* ---------------------------------------------------------------- the six screens
   * Every screen is 1400 px wide. Rects are [x, y, w, h] in the screen's own pixels, per language (the Chinese
   * screens wrap differently):
   *   from   what the camera frames when the screen arrives (the whole screen, or its top 800 px)
   *   to     what it frames when it has settled (the area the caption is about)
   *   spots  what the spotlight outlines once the camera has settled, with a tone (accent / err / ok); kept 24 px
   *          inside the screen's edges, which the slow push-in (DRIFT) crops */
  function frames() {
    return [
      {
        id: 'layers',
        src: { en: PM.asset('assets/case/01-layers.webp'), zh: PM.asset('assets/case/zh/01-layers.webp') },
        name: { en: '3D teardown', zh: '3D 拆解' },
        title: { en: 'What a screenshot leaves out', zh: '截图之外还有什么' },
        cap: { en: 'A real Mac, taken apart in 3D', zh: '把一台真实的 Mac 拆成 3D 图层' },
        geo: {
          en: { h: 801, from: [0, 0, 1400, 801], to: [0, 0, 1400, 801], spots: [[172, 36, 680, 672, 'accent']] },
          zh: { h: 801, from: [0, 0, 1400, 801], to: [0, 0, 1400, 801], spots: [[172, 36, 680, 672, 'accent']] },
        },
      },
      {
        id: 'program',
        src: { en: PM.asset('assets/case/02-code-execution.webp'), zh: PM.asset('assets/case/zh/02-code-execution.webp') },
        name: { en: 'Code execution', zh: '代码执行' },
        title: { en: 'Code execution: one program instead of many steps', zh: '代码执行：一个程序，代替许多步' },
        cap: { en: 'Code execution vs three other ways to act', zh: '代码执行，对比另外三种操作方式' },
        geo: {
          en: { h: 960, from: [0, 0, 1400, 800], to: [0, 120, 1400, 800], spots: [[1040, 136, 334, 764, 'accent']] },
          zh: { h: 934, from: [0, 0, 1400, 800], to: [0, 110, 1400, 800], spots: [[1040, 136, 334, 744, 'accent']] },
        },
      },
      {
        id: 'transfer',
        src: { en: PM.asset('assets/case/03-decision.webp'), zh: PM.asset('assets/case/zh/03-decision.webp') },
        name: { en: 'Mechanism and decision', zh: '机制与决策' },
        title: { en: 'Mechanism in the harness, decision in the model', zh: '机制在 Harness，决策在模型' },
        cap: { en: 'Who decides when to take a screenshot', zh: '由谁决定什么时候截图' },
        geo: {
          en: { h: 790, from: [0, 0, 1400, 790], to: [380, 40, 1020, 700], spots: [[704, 300, 682, 414, 'accent']] },
          zh: { h: 792, from: [0, 0, 1400, 792], to: [380, 40, 1020, 700], spots: [[704, 300, 682, 414, 'accent']] },
        },
      },
      {
        id: 'gaps',
        src: { en: PM.asset('assets/case/04-differences.webp'), zh: PM.asset('assets/case/zh/04-differences.webp') },
        name: { en: 'Five differences', zh: '五项差异' },
        title: { en: 'Five differences between a benchmark and a real Mac', zh: '基准测试与真机的五项差异' },
        cap: { en: 'Benchmark vs real device, side by side', zh: '基准测试与真机，并排对比' },
        geo: {
          en: { h: 882, from: [0, 0, 1400, 800], to: [0, 82, 1400, 800], spots: [[30, 186, 654, 378, 'err'], [716, 186, 654, 378, 'ok']] },
          zh: { h: 818, from: [0, 0, 1400, 800], to: [0, 18, 1400, 800], spots: [[30, 154, 654, 378, 'err'], [716, 154, 654, 378, 'ok']] },
        },
      },
      {
        id: 'stack',
        src: { en: PM.asset('assets/case/05-architecture.webp'), zh: PM.asset('assets/case/zh/05-architecture.webp') },
        name: { en: 'Architecture', zh: '架构' },
        title: { en: 'Real-device harness architecture', zh: '真机 Harness 架构' },
        cap: { en: 'Which layer catches a failure', zh: '失败在哪一层被拦下' },
        geo: {
          en: { h: 801, from: [0, 0, 1400, 801], to: [420, 20, 980, 600], spots: [[458, 238, 884, 86, 'err']] },
          zh: { h: 801, from: [0, 0, 1400, 801], to: [420, 20, 980, 600], spots: [[458, 241, 884, 86, 'err']] },
        },
      },
      {
        id: 'sdk',
        src: { en: PM.asset('assets/case/06-devices.webp'), zh: PM.asset('assets/case/zh/06-devices.webp') },
        name: { en: 'One interface', zh: '一套接口' },
        title: { en: 'One interface for several devices', zh: '一套接口，操作多台设备' },
        cap: { en: 'One program, three devices', zh: '一个程序，操作三台设备' },
        geo: {
          en: { h: 883, from: [0, 0, 1400, 800], to: [0, 83, 1400, 800], spots: [[30, 198, 820, 32, 'accent'], [30, 316, 1340, 512, 'accent']] },
          zh: { h: 883, from: [0, 0, 1400, 800], to: [0, 83, 1400, 800], spots: [[30, 198, 820, 32, 'accent'], [30, 316, 1340, 512, 'accent']] },
        },
      },
    ];
  }
  const SHOT_W = 1400;

  /* ---------------------------------------------------------------- the build, publish by publish (the fold)
   * From references/review-loop.md §4–5 (times UTC). `lab` = the tour screen that shows what that publish changed. */
  const BUILD = [
    { t: '10-14 04:33', name: { en: 'Brief', zh: '需求说明' },
      text: { en: 'The authors ask for features readers can try: a Mac taken apart in 3D, benchmark vs real device, four ways to act, a cross-device SDK.',
        zh: '作者希望读者能亲手体验这些特性：3D 拆解 Mac、基准测试与真机对比、四种操作方式、跨设备 SDK。' } },
    { t: '10-14 08:30', name: { en: 'First preview', zh: '第一版预览' },
      text: { en: 'Seven labs, from a 3D teardown of a Mac to real runs. A light theme and many controls in every part.',
        zh: '七个实验，从 3D 拆解 Mac 到真机运行。浅色主题，每个部件都有很多控件。' } },
    { t: '10-14 16:25', name: { en: 'v2 preview', zh: 'v2 预览' }, lab: 2,
      text: { en: 'Rebuilt after rounds 2 and 3: one part template, one primary action, side-by-side comparisons, folded depth, a dark theme.',
        zh: '按第 2、3 轮意见重做：统一的部件模板、一个主操作、并排对比、深入内容折叠、深色主题。' } },
    { t: '10-15 02:17', name: { en: 'v2', zh: 'v2' },
      text: { en: 'The first complete v2, after a full self-check.', zh: '第一个完整的 v2，发布前做了一遍全面自查。' } },
    { t: '10-15 03:17', name: { en: 'v2.1', zh: 'v2.1' }, lab: 4,
      text: { en: 'Round 4: a progress bar on every player, code inside the animations with the target highlighted, device frames.',
        zh: '第 4 轮：每个播放器都有进度条，动画里放进代码并高亮操作目标，加上设备外框。' } },
    { t: '10-15 03:42', name: { en: 'v2.2', zh: 'v2.2' }, lab: 6,
      text: { en: 'Round 6: phone, browser and Mac frames that look real; code panes that scroll both ways.',
        zh: '第 6 轮：手机、浏览器和 Mac 外框更逼真；代码框可以上下左右滚动。' } },
    { t: '10-15 04:29', name: { en: 'v3', zh: 'v3' }, lab: 5,
      text: { en: 'Round 7: the project name, a new lab order and titles, the AX layer above the screenshot, “Paper §” citations.',
        zh: '第 7 轮：定下项目名，调整实验顺序和标题，AX 图层放到截图上方，引用写成“Paper §”。' } },
    { t: '10-15 05:04', name: { en: 'v4', zh: 'v4' }, lab: 1,
      text: { en: 'Round 8: every 3D layer restored; readers can drag and zoom the teardown at any time.',
        zh: '第 8 轮：补回全部 3D 图层；读者随时可以拖动、缩放 3D 拆解。' } },
    { t: '10-16 03:04', name: { en: 'Final-paper sync', zh: '按论文终稿同步' },
      text: { en: 'The final paper renumbered figures and tables and rewrote quoted passages. The lab was re-synced, and a script re-checked every quote.',
        zh: '论文终稿重新编排了图表编号，也改写了引文。实验室随之同步，并用脚本重新核对了每一段引文。' } },
  ];

  /* ---------------------------------------------------------------- the clock
   * Screen i: crossfade in (FADE, not for the first), camera move (MOVE), spotlight in (SPOT; the mark), hold (HOLD). */
  const FADE = 650;
  const MOVE = 2300;
  const SPOT = 350;
  const HOLD = 1150;
  const TAIL = 700;                       // the last screen stays a little longer
  const BODY = MOVE + SPOT + HOLD;
  const moveAt = (i) => i * (BODY + FADE); // the camera starts moving; screen i is fully in
  const startAt = (i) => (i === 0 ? 0 : moveAt(i) - FADE);
  const markAt = (i) => moveAt(i) + MOVE;
  const settledAt = (i) => markAt(i) + SPOT;

  const DRIFT = 0.035;                    // a slow push-in on top of the framing, so every screen moves a little
  const BOOST = 0.05;                     // zoom-through during a crossfade

  const { clamp, lerp, ease } = PM;
  const fx = (n) => Math.round(n * 100) / 100;
  const langKey = () => (PM.lang() === 'zh' ? 'zh' : 'en');

  PMSite.register('case', function (host) {
    const F = frames();
    const N = F.length;
    const END = moveAt(N - 1) + BODY + TAIL;
    const endAt = (i) => (i === N - 1 ? END : startAt(i + 1));
    let LK = langKey();
    /** The screen's geometry in the current language: {w, h, from, to, spots}. */
    const geo = (f) => Object.assign({ w: SHOT_W }, f.geo[LK]);

    /* ---------------------------------------------------------------- the part */
    const P = PM.part(host, {
      id: 'case',
      q: PM.L('What did the OpenGCUA lab look like?', 'OpenGCUA 交互实验室长什么样？'),
      takeaway: PM.L('Each OpenGCUA lab answers one question in about a minute.', '每个 OpenGCUA 实验用大约一分钟回答一个问题。'),
      source: [
        { kind: 'real', text: PM.L('Screens from the OpenGCUA Interactive Lab (English version)', 'OpenGCUA 交互实验室截图（中文版）') },
        // .pmx-case-nb keeps "OpenGCUA lab 1" / "第 7 个实验" on one line (Chinese would otherwise break inside 实验)
        { kind: 'note', text: PM.LH('In <span class="pmx-case-nb">OpenGCUA lab 1</span>, task content is replaced with placeholders',
          '<span class="pmx-case-nb">OpenGCUA 实验 1</span> 里的任务内容已替换为占位') },
        { kind: 'note', text: PM.LH('The seventh lab (real runs) is not shown: its screens name models',
          '<span class="pmx-case-nb">第 7 个实验</span>（真机运行）未收录：其画面含模型名称') },
      ],
      folds: [{
        title: PM.L('The build, preview by preview', '一版版预览，一轮轮评审'),
        teaser: PM.L('From the brief on 10-14 to the final-paper sync on 10-16', '从 10-14 的需求说明，到 10-16 按论文终稿同步'),
        render: renderBuild,
      }],
    });
    // The Case section of the page already carries id="case"; keep ids unique (the part stays data-pm-part="case").
    if (document.querySelectorAll('[id="case"]').length > 1) P.el.id = 'case-lab';

    /* ---------------------------------------------------------------- the scene: browser + thumbnails */
    const view = PM.h('div', { class: 'pmx-case-view' });
    const shots = F.map((f, i) => {
      const img = PM.h('img', {
        class: 'pmx-case-shot', width: SHOT_W, decoding: 'async', draggable: 'false',
        alt: { en: `OpenGCUA lab ${i + 1}, “${f.title.en}”`, zh: `OpenGCUA 实验 ${i + 1}“${f.title.zh}”` },
      });
      view.append(img);
      return img;
    });
    const SVG = 'http://www.w3.org/2000/svg';
    const spotSvg = document.createElementNS(SVG, 'svg');
    spotSvg.setAttribute('class', 'pmx-case-spot');
    spotSvg.setAttribute('aria-hidden', 'true');
    spotSvg.setAttribute('preserveAspectRatio', 'none');
    const dim = document.createElementNS(SVG, 'path');
    dim.setAttribute('class', 'pmx-case-dim');
    dim.setAttribute('fill-rule', 'evenodd');
    spotSvg.append(dim);
    const rings = [0, 1].map(() => {
      const r = document.createElementNS(SVG, 'rect');
      r.setAttribute('class', 'pmx-case-ring');
      r.setAttribute('rx', '10');
      spotSvg.append(r);
      return r;
    });
    view.append(spotSvg);

    const grid = PM.h('div', { class: 'pmx-case-grid' });
    const wrap = PM.h('div', { class: 'pmx-case-wrap' }, grid);
    P.scene.append(wrap);
    const mainCol = PM.h('div', { class: 'pmx-case-main' });
    grid.append(mainCol);
    const br = PM.device.browser(mainCol, {
      tabs: [{ title: F[0].title, url: 'OpenGCUA Interactive Lab', active: true, icon: { letter: 'O', color: 'linear-gradient(135deg, var(--pm-agent), var(--pm-accent-2))' } }],
      content: view,
      label: { en: 'A browser showing the OpenGCUA Interactive Lab', zh: '浏览器中的 OpenGCUA 交互实验室' },
    });
    br.view.style.height = '';           // the page area keeps a 1400:800 aspect ratio (case.css)

    const rail = PM.h('div', { class: 'pmx-case-rail', role: 'group', 'aria-label': { en: 'OpenGCUA labs', zh: 'OpenGCUA 的实验' } });
    grid.append(rail);
    const thumbs = F.map((f, i) => {
      const bar = PM.h('i');
      const img = PM.h('img', { class: 'pmx-case-thumb-img', alt: '', decoding: 'async', draggable: 'false' });
      const b = PM.h('button', { type: 'button', class: 'pmx-case-thumb' },
        img,
        PM.h('span', { class: 'pmx-case-thumb-cap', 'aria-hidden': 'true' },
          PM.h('span', { class: 'pmx-case-thumb-num' }, String(i + 1).padStart(2, '0')),
          PM.h('span', { class: 'pmx-case-thumb-name' }, PM.L(f.name))),
        PM.h('span', { class: 'pmx-case-thumb-bar', 'aria-hidden': 'true' }, bar));
      PM.target(b, {
        label: { en: `OpenGCUA lab ${i + 1}: ${f.name.en}`, zh: `OpenGCUA 实验 ${i + 1}：${f.name.zh}` },
        onActivate: () => jump(i),
      });
      rail.append(b);
      return { el: b, img, bar, p: -1, cls: '' };
    });

    /** Rect a screen's spots cover (the camera target on narrow screens, where the full screen is too small to read). */
    function spotBox(g) {
      const xs = g.spots.map((s) => s[0]);
      const ys = g.spots.map((s) => s[1]);
      const x0 = Math.min(...xs);
      const y0 = Math.min(...ys);
      const x1 = Math.max(...g.spots.map((s) => s[0] + s[2]));
      const y1 = Math.max(...g.spots.map((s) => s[1] + s[3]));
      const m = 0.06 * Math.max(x1 - x0, y1 - y0);
      return [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
    }
    /** The spots' centre as a CSS transform-origin, so a thumbnail shows the recognisable part of its screen. */
    function focusOrigin(g) {
      const b = spotBox(g);
      const x = clamp((b[0] + b[2] / 2) / g.w, 0.15, 0.85);
      const y = clamp((b[1] + b[3] / 2) / g.h, 0.15, 0.85);
      return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
    }

    /** Load the screens of the current language (only those: the other set is never requested). */
    function loadScreens() {
      F.forEach((f, i) => {
        const g = geo(f);
        const src = f.src[LK];
        if (shots[i].getAttribute('src') !== src) {
          shots[i].setAttribute('height', String(g.h));
          shots[i].src = src;
          if (shots[i].decode) shots[i].decode().catch(() => {});
        }
        const th = thumbs[i].img;
        if (th.getAttribute('src') !== src) th.src = src;
        th.style.transformOrigin = focusOrigin(g);
      });
    }

    /* ---------------------------------------------------------------- camera and paint (pure in t, view size, language) */
    let W = 0;
    let H = 0;
    let lastT = 0;

    function measure() {
      W = view.clientWidth;
      H = view.clientHeight;
      if (W > 0 && H > 0) spotSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }

    /** camera(g, k, extra) → {s, tx, ty}: the screen framed between `from` (k = 0) and `to` (k = 1), never showing
     * past its edges; zoom stays near the screenshot's own resolution. */
    function camera(g, k, extra) {
      const s0 = W / g.w;
      const zMin = Math.max(1, H / (g.h * s0));
      const zMax = Math.max(zMin, Math.min(2.6, (g.w / W) * 1.12));
      const to = W < 560 ? spotBox(g) : g.to;
      const r = [0, 1, 2, 3].map((n) => lerp(g.from[n], to[n], k));
      const fit = Math.min(W / (r[2] * s0), H / (r[3] * s0));
      const z = Math.max(zMin, clamp(fit, zMin, zMax) * (1 + DRIFT * k + extra));
      const s = s0 * z;
      const hw = W / (2 * s);
      const hh = H / (2 * s);
      const cx = g.w <= 2 * hw ? g.w / 2 : clamp(r[0] + r[2] / 2, hw, g.w - hw);
      const cy = g.h <= 2 * hh ? g.h / 2 : clamp(r[1] + r[3] / 2, hh, g.h - hh);
      return { s, tx: W / 2 - cx * s, ty: H / 2 - cy * s };
    }

    const shown = F.map(() => ({ o: -1, key: '' }));
    function place(i, g, cam, opacity) {
      const img = shots[i];
      const st = shown[i];
      const o = fx(opacity);
      if (o !== st.o) {
        img.style.opacity = String(o);
        img.style.visibility = o > 0 ? 'visible' : 'hidden';
        if (o > 0 !== st.o > 0) img.setAttribute('aria-hidden', String(!(o > 0)));
        st.o = o;
      }
      if (!cam || !(o > 0)) return;
      const w = g.w * cam.s;
      const h = g.h * cam.s;
      const key = `${fx(w)}|${fx(h)}|${fx(cam.tx)}|${fx(cam.ty)}`;
      if (key === st.key) return;
      st.key = key;
      img.style.width = `${fx(w)}px`;
      img.style.height = `${fx(h)}px`;
      img.style.transform = `translate3d(${fx(cam.tx)}px, ${fx(cam.ty)}px, 0)`;
    }

    function drawSpots(g, cam, alpha) {
      const a = clamp(alpha, 0, 1);
      if (!(a > 0) || !cam) {
        dim.setAttribute('d', '');
        rings.forEach((r) => { r.style.display = 'none'; });
        return;
      }
      let d = `M0 0H${W}V${H}H0Z`;
      g.spots.forEach((sp, n) => {
        const x = fx(cam.tx + sp[0] * cam.s);
        const y = fx(cam.ty + sp[1] * cam.s);
        const w = fx(sp[2] * cam.s);
        const h = fx(sp[3] * cam.s);
        const rr = Math.min(10, w / 2, h / 2);
        d += `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}`
          + `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
        const ring = rings[n];
        ring.style.display = '';
        ring.setAttribute('x', x);
        ring.setAttribute('y', y);
        ring.setAttribute('width', w);
        ring.setAttribute('height', h);
        ring.setAttribute('rx', rr);
        ring.setAttribute('data-tone', sp[4] || 'accent');
        ring.style.opacity = String(fx(a));
      });
      for (let n = g.spots.length; n < rings.length; n++) rings[n].style.display = 'none';
      dim.setAttribute('d', d);
      dim.style.opacity = String(fx(a));
    }

    let tabFrame = -1;
    function render(t) {
      lastT = t;
      if (!(W > 0)) measure();
      let i = 0;
      for (let j = 1; j < N; j++) if (t >= startAt(j)) i = j;
      const fading = i > 0 && t < moveAt(i);
      const mix = fading ? ease.inOut(clamp((t - startAt(i)) / FADE, 0, 1)) : 1;
      const local = t - moveAt(i);
      const kMove = ease.inOut(clamp(local / MOVE, 0, 1));
      const kSpot = ease.out(clamp((local - MOVE) / SPOT, 0, 1));
      const ready = W > 0 && H > 0;
      const gi = geo(F[i]);
      const gp = i > 0 ? geo(F[i - 1]) : null;

      for (let j = 0; j < N; j++) {
        if (j === i) place(j, gi, ready ? camera(gi, kMove, fading ? BOOST * (1 - mix) : 0) : null, mix);
        else if (fading && j === i - 1) place(j, gp, ready ? camera(gp, 1, BOOST * mix) : null, 1);
        else place(j, null, null, 0);
      }
      // The outgoing screen stays opaque under the incoming one, so the crossfade never shows the ground through.
      if (fading && ready) drawSpots(gp, camera(gp, 1, BOOST * mix), 1 - clamp(mix * 2, 0, 1));
      else drawSpots(gi, ready ? camera(gi, kMove, 0) : null, kSpot);

      thumbs.forEach((th, j) => {
        const p = j < i ? 1 : j > i ? 0 : clamp((t - startAt(i)) / (endAt(i) - startAt(i)), 0, 1);
        const cls = j === i ? 'is-current' : j < i ? 'is-past' : '';
        if (cls !== th.cls) {
          if (th.cls) th.el.classList.remove(th.cls);
          if (cls) th.el.classList.add(cls);
          if (j === i) th.el.setAttribute('aria-current', 'step'); else th.el.removeAttribute('aria-current');
          th.cls = cls;
        }
        const pf = fx(p);
        if (pf !== th.p) { th.bar.style.transform = `scaleX(${pf})`; th.p = pf; }
      });

      if (i !== tabFrame) { br.setTitle(F[i].title); tabFrame = i; }
    }

    function repaint() {
      measure();
      shown.forEach((s) => { s.key = ''; });
      render(lastT);
    }

    loadScreens();
    measure();
    render(0);
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        if (view.clientWidth === W && view.clientHeight === H) return;
        repaint();
      }).observe(view);
    }
    // The page's language picks the screens (the lab is bilingual) and their geometry.
    PM.onLang(() => {
      const next = langKey();
      if (next === LK) return;
      LK = next;
      loadScreens();
      repaint();
    });

    /* ---------------------------------------------------------------- the player */
    const player = PM.player(P, {
      duration: END,
      render,
      captions: F.map((f, i) => ({ t: startAt(i), text: f.cap, tone: 'accent' })),
      marks: F.map((f, i) => ({ t: markAt(i), label: f.name, tone: 'accent' })),
      label: { en: 'Play the tour', zh: '播放导览' },
      hint: { en: 'Press “Play the tour”, or pick a screen.', zh: '按“播放导览”，或直接点选一张截图。' },
    });

    /** A thumbnail: while the tour plays, continue from that lab; otherwise stop on it with its spotlight on. */
    function jump(i) {
      if (player.state === 'running') player.seek(moveAt(i), { pause: false });
      else player.seek(settledAt(i), { pause: true });
    }

    /* ---------------------------------------------------------------- fold: the build, preview by preview */
    function renderBuild(el) {
      el.append(PM.L(
        'One brief, eight publishes of the same preview link, and seven review rounds in between (times in UTC).',
        '一份需求说明，同一个预览链接发布了八版，中间经过七轮评审（时间为 UTC）。', 'p', { class: 'pmx-case-build-intro' }));
      const list = PM.h('ol', { class: 'pmx-case-build' });
      BUILD.forEach((row) => {
        const show = row.lab ? PM.button(null, { en: 'Show in tour', zh: '在导览中看' }, {
          kind: 'ghost', small: true,
          ariaLabel: { en: `Show OpenGCUA lab ${row.lab} (${F[row.lab - 1].name.en}) in the tour above`, zh: `在上方导览中查看 OpenGCUA 实验 ${row.lab}（${F[row.lab - 1].name.zh}）` },
          onClick: () => {
            jump(row.lab - 1);
            P.stage.scrollIntoView({ block: 'start', behavior: PM.reduced() ? 'auto' : 'smooth' });
          },
        }) : null;
        if (show) show.classList.add('pmx-case-show');
        list.append(PM.h('li', { class: ['pmx-case-step', row.lab ? 'has-lab' : null] },
          PM.h('span', { class: 'pmx-case-dot', 'aria-hidden': 'true' }),
          PM.h('span', { class: 'pmx-case-when' }, row.t),
          PM.h('span', { class: 'pmx-case-what' },
            PM.h('b', { class: 'pmx-case-name' }, PM.L(row.name)),
            PM.h('span', { class: 'pmx-case-text' }, PM.L(row.text))),
          show));
      });
      el.append(list);
      el.append(PM.h('p', { class: 'pmx-case-build-more' },
        PM.L('The authors’ comments, and the rule that answers each one, are in ', '作者的每条意见，以及各自对应的规则，见'),
        PM.h('a', { href: 'https://github.com/' + ((window.PMSite && PMSite.repo) || 'hzzhou01/PLAYME.html') + '/blob/main/skills/playme/references/review-loop.md', rel: 'noopener' }, PM.L('the review ledger', '评审记录')),
        PM.L('.', '。')));
      return null;
    }
  });
})();
