/* Part 04 · pipeline — "What does the skill do between your paper or project and PLAYME.html?"
 * Pattern: Request trace, applied to the skill's own workflow (SKILL.md § Workflow).
 *
 * Eight stations on a rail. A glowing packet carries the project through them; each station lights up, runs (a
 * progress ring), writes its files (mono text with a file glyph, never boxed: rule R5) and prints what Claude runs
 * into a Claude Code transcript. One Run tells a story in two acts on one clock, so the takeaway (a change re-runs
 * only the stations it touches) shows on every run:
 *   act 1     Intake → Facts → Plan → Build → Check → Review → Ship → Promote           (first build: 8 of 8)
 *   then      a mark: the author's comment (or paper v2) arrives; every station keeps its files
 *   act 2     the scenario (segmented, one option) picks the change:
 *     feedback  Review ⟲ Build → Check ⤼ Ship                                          (re-run: 4 of 8)
 *     paper     Intake → Facts ⤼ Check (3 quotes flagged) ⟲ Build → Check ⤼ Ship     (re-run: 5 of 8)
 * Forward skips are drawn as hops over the skipped stations, backward moves as loop arrows.
 *
 * Determinism: every motion is a function of the player's virtual clock (ctx.tween); reset() rebuilds the scene of
 * the chosen scenario; the route geometry is measured from the layout and redrawn on resize / language change, so
 * the same time always shows the same frame. No Date, Math.random, setTimeout or CSS transitions. */
(function () {
  'use strict';
  if (!window.PM || !window.PMSite) return;

  PMSite.register('pipeline', function mount(host) {
    const { h, s, L, clamp, lerp, ease } = PM;
    const f1 = (v) => Math.round(v * 10) / 10;

    /* ------------------------------------------------------------------ data */

    const ICON = {
      intake:'M7.5 3.5h7l4 4V17h-11z M14.5 3.5v4h4 M4.5 7v13.5h11',
      facts: 'M9 4H8a2 2 0 0 0-2 2v3.6a2 2 0 0 1-2 2.4 2 2 0 0 1 2 2.4V18a2 2 0 0 0 2 2h1 M15 4h1a2 2 0 0 1 2 2v3.6a2 2 0 0 0 2 2.4 2 2 0 0 0-2 2.4V18a2 2 0 0 1-2 2h-1',
      plan: 'M10 6.5h10 M10 12h10 M10 17.5h10 M4 6.5l1.3 1.3L7.8 5 M4 12l1.3 1.3L7.8 10.5 M4.5 17.5h2',
      build: 'M8 7.5 3.5 12 8 16.5 M16 7.5l4.5 4.5-4.5 4.5 M13.6 4.5l-3.2 15',
      check: 'M12 3.2 19 6v5.4c0 4.3-2.9 7.9-7 9.4-4.1-1.5-7-5.1-7-9.4V6z M8.6 12l2.4 2.4 4.4-4.6',
      review: 'M4.5 5h15v10.5H10l-5.5 4.2z M8.5 9h7 M8.5 12h4.5',
      ship: 'M12 3.2l8 4.4v8.8L12 20.8l-8-4.4V7.6z M4.3 7.8 12 12l7.7-4.2 M12 12v8.6',
      promote: 'M3.8 5.5h16.4v13H3.8z M10.2 9.2v5.6l4.8-2.8z',
    };
    const GLYPH = {
      file: 'M3 1.5h5.2L11 4.3v8.2H3z M8 1.5v3h3',
      in: 'M3 1.5h5.2L11 4.3v8.2H3z M8 1.5v3h3 M7 6.3v4.2 M5.3 8.9 7 10.6l1.7-1.7',
      dir: 'M1.5 3.5h4l1.3 1.4h5.7v7.6h-11z',
      check: 'M2.2 7.4l3 3 6.4-6.8',
      flag: 'M3.5 13V2 M3.5 2.4h7.4L9.3 5l1.6 2.6H3.5',
      eye: 'M1.2 7S3.4 3.2 7 3.2 12.8 7 12.8 7 10.6 10.8 7 10.8 1.2 7 1.2 7z M7 5.4a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 1 0 0-3.2',
    };

    // kind: in (read, not written) · file (written: counted) · check (a check that runs) · eye (a preview)
    // Station names follow the checklist in SKILL.md § Workflow (1 Intake … 8 Promote).
    const STATIONS = [
      { id: 'intake', name: ['Intake', '收集材料'], role: ['reads paper, code, logs', '读取论文、代码和日志'],
        files: [{ id: 'paper', kind: 'in', text: 'paper.tex' }, { id: 'repo', kind: 'dir', text: 'repo/' }, { id: 'runs', kind: 'dir', text: 'runs/' }] },
      { id: 'facts', name: ['Facts', '事实'], role: ['pulls every number and term', '摘出每个数字和术语'],
        files: [{ id: 'facts', kind: 'file', text: 'facts.json' }, { id: 'words', kind: 'file', text: 'words.json' }] },
      { id: 'plan', name: ['Plan', '规划'], role: ['one claim, one part', '一个结论，一个部件'],
        files: [{ id: 'plan', kind: 'file', text: 'plan.md' }] },
      { id: 'build', name: ['Build', '构建'], role: ['one part per file', '一个部件一个文件'],
        files: [{ id: 'parts', kind: 'file', text: 'parts/*.js' }] },
      { id: 'check', name: ['Check', '检查'], role: ['word/control budgets, quotes vs paper', '核对字数、控件预算和引文'],
        files: [{ id: 'lint', kind: 'check', text: 'lint' }, { id: 'fid', kind: 'check', text: 'fidelity' }] },
      { id: 'review', name: ['Review', '评审'], role: ['each comment becomes a rule', '每条意见变成一条规则'],
        files: [{ id: 'preview', kind: 'eye', text: ['preview v1', '预览 v1'] }, { id: 'ledger', kind: 'file', text: 'ledger.md' }] },
      { id: 'ship', name: ['Ship', '交付'], role: ['one offline file', '一个离线文件'],
        files: [{ id: 'html', kind: 'file', text: 'PLAYME.html' }] },
      { id: 'promote', name: ['Promote', '推广'], role: ['GIF and video from the page itself', '直接从页面录制 GIF 和视频'],
        files: [{ id: 'gif', kind: 'file', text: 'demo.gif' }, { id: 'mp4', kind: 'file', text: 'teaser.mp4' }, { id: 'cover', kind: 'file', text: 'cover.png' }] },
    ];
    const FILES_WRITTEN = STATIONS.reduce((n, st) => n + st.files.filter((f) => f.kind === 'file').length, 0);   // 9
    const IDX = Object.fromEntries(STATIONS.map((st, i) => [st.id, i]));

    // Tags written next to a file when the act-2 re-run changes it (one or two variants: the second replaces the first).
    const TAGS = {
      feedback: {
        'review.ledger': [['+R6', '+R6', 'user']],
        'build.parts': [['R6 everywhere', 'R6 全部应用', 'user']],
        'ship.html': [['preview v2', '预览 v2', 'accent']],
      },
      paper: {
        'intake.paper': [['v2', 'v2', 'info']],
        'facts.facts': [['Fig. 2→4', '图 2→4', 'info']],
        'check.fid': [['3 quotes changed', '3 处引文已变', 'warn'], ['all match', '全部一致', 'ok']],
        'build.parts': [['3 quotes', '3 处引文', 'ok']],
        'ship.html': [['paper v2', '论文 v2', 'info']],
      },
    };

    const PROMPT = {
      first: ['> Use the playme skill to turn ./paper, ./code and ./runs into a PLAYME.',
        '> 用 playme skill 把 ./paper、./code 和 ./runs 做成一个 PLAYME。'],
      feedback: ['> Author on preview v1: “It grabs only once. Grab several times.”',
        '> 作者对预览 v1 的意见：“现在只抢一次……建议多次抢夺。”'],
      paper: ['> The authors posted paper v2 in ./paper-v2. Please re-sync.',
        '> 作者在 ./paper-v2 发布了论文 v2，请重新同步。'],
    };
    const HINT = {
      feedback: ['Press Run: a first build, then an author comment arrives.', '按“运行”：先完成首次构建，再收到一条作者意见。'],
      paper: ['Press Run: a first build, then the authors post paper v2.', '按“运行”：先完成首次构建，再收到作者发布的论文 v2。'],
    };

    const CMD = {
      lint: 'node scripts/lint.mjs --url playme/index.html --widths 1440,400 --dump text.json',
      fid: 'python3 scripts/fidelity.py --dump text.json --paper paper/main.tex',
      fid2: 'python3 scripts/fidelity.py --dump text.json --paper paper-v2/main.tex',
      bundle: 'python3 scripts/bundle.py playme/index.html -o PLAYME.html --offline',
      capture: 'node scripts/capture.mjs --url PLAYME.html --part read-or-play --out frames/ --gif demo.gif',
    };
    const OUT = {
      lintOk: ['every part within the reader budgets', '每个部件都在读者负担预算之内'],
      fidOk: ['quotes, references and facts match the paper', '引文、引用位置和数字都与论文一致'],
    };

    /* The story. A visit: caption, duration, which chips change when (ms after arrival), what Claude runs, marks.
     * A move: from → to, duration, tone. An end: the closing caption of an act. A turn: the change that starts act 2.
     * Durations never depend on the layout, so the timeline is the same at every width. */
    const FIRST = [
      { visit: 'intake', dur: 900, cap: ['Claude reads the paper or docs, the code and the run logs.', 'Claude 通读论文、代码和运行记录。'],
        chips: [['paper', 220], ['repo', 340], ['runs', 460]],
        term: [['Read', 'paper/main.tex, repo/, runs/', ['read as data; nothing is executed', '只当作数据读取，不执行任何代码'], 'dim']] },
      { move: ['intake', 'facts'], ms: 400 },
      { visit: 'facts', dur: 850, cap: ['Every number and term is noted with its place in the paper.', '每个数字和术语都记下它在论文中的位置。'],
        chips: [['facts', 260], ['words', 400]],
        term: [['Write', 'facts.json, words.json', ['each number keeps its printed form and location', '每个数字都保留论文里的写法和位置'], 'dim']] },
      { move: ['facts', 'plan'], ms: 400 },
      { visit: 'plan', dur: 750, cap: ['Each claim becomes one part: one question, one action.', '每个结论变成一个部件：一个问题，一个操作。'],
        chips: [['plan', 280]],
        term: [['Write', 'plan.md', ['one row per claim; the authors approve it first', '每个结论一行；先请作者确认'], 'dim']] },
      { move: ['plan', 'build'], ms: 400 },
      { visit: 'build', dur: 850, cap: ['Claude builds one part per file on the same kit.', 'Claude 用同一套组件库，一个文件做一个部件。'],
        chips: [['parts', 300]],
        term: [['Write', 'parts/*.js', ['one PM.part per file, familiar parts first', '每个文件一个 PM.part，读者熟悉的先做'], 'dim']] },
      { move: ['build', 'check'], ms: 400 },
      { visit: 'check', dur: 1300, cap: ['Lint measures word and control budgets; fidelity checks quotes.', 'lint 测字数和控件预算，fidelity 逐条对照论文核查引文。'],
        chips: [['lint', 460], ['fid', 1090]],
        term: [['Bash', CMD.lint, OUT.lintOk, 'ok', 0], ['Bash', CMD.fid, OUT.fidOk, 'ok', 560]],
        marks: [[1100, ['Checks pass', '检查通过'], 'ok']] },
      { move: ['check', 'review'], ms: 400 },
      { visit: 'review', dur: 1000, cap: ['The authors review preview v1; each comment becomes a rule.', '作者评审预览 v1，每条意见都记成一条规则。'],
        chips: [['preview', 240], ['ledger', 600]],
        term: [['Write', 'ledger.md', ['preview v1 sent; every comment is logged with its rule', '预览 v1 已发出；每条意见连同规则记入评审记录'], 'dim']],
        marks: [[260, ['Preview v1 to the authors', '预览 v1 发给作者'], 'info']] },
      { move: ['review', 'ship'], ms: 400 },
      { visit: 'ship', dur: 900, cap: ['The bundler packs everything into one offline file.', '打包脚本把所有内容装进一个离线文件。'],
        chips: [['html', 480]],
        term: [['Bash', CMD.bundle, ['PLAYME.html: one file that opens offline', 'PLAYME.html：一个可离线打开的文件'], 'ok']] },
      { move: ['ship', 'promote'], ms: 400 },
      { visit: 'promote', dur: 1000, cap: ['GIF, video and cover are recorded from the page itself.', 'GIF、视频和封面都直接从页面录制。'],
        chips: [['gif', 440], ['mp4', 580], ['cover', 720]],
        term: [['Bash', CMD.capture, ['frames recorded from the part’s own player', '逐帧录制自部件自己的播放器'], 'dim']] },
      { end: true, dur: 1000, cap: ['First build: all eight stations ran.', '首次构建：八个环节全部运行。'], tone: 'ok' },
    ];
    const SECOND = {
      feedback: [
        { turn: 'review', dur: 1200, tone: 'user', cap: ['An author comments on preview v1.', '一位作者对预览 v1 提了意见。'],
          mark: ['Author comment arrives', '收到作者意见'] },
        { visit: 'review', dur: 1400, tone: 'user',
          cap: ['“Grab the pointer several times” becomes rule R6 in the ledger.', '意见“多抢几次鼠标”写进评审记录，成为规则 R6。'],
          chips: [['ledger', 560]],
          term: [['Edit', 'ledger.md', ['Round 2 · comment 3 → rule R6: make the key event unmistakable', '第 2 轮 · 第 3 条 → 规则 R6：让关键事件一眼可见'], 'user']],
          marks: [[600, ['Comment → rule R6', '意见 → 规则 R6'], 'user']] },
        { move: ['review', 'build'], ms: 900, tone: 'user' },
        { visit: 'build', dur: 1200, cap: ['Build applies R6 to every part, not only the one named.', '构建把 R6 用到所有部件，不只是被点名的那一个。'],
          chips: [['parts', 420]],
          term: [['Edit', 'parts/*.js', ['R6 applied to every part with a key event', 'R6 用到了每个有关键事件的部件'], 'dim']] },
        { move: ['build', 'check'], ms: 420 },
        { visit: 'check', dur: 1350, cap: ['Lint and fidelity run again on the changed page.', 'lint 和 fidelity 对改过的页面重新检查。'],
          chips: [['lint', 460], ['fid', 1090]],
          term: [['Bash', CMD.lint, OUT.lintOk, 'ok', 0], ['Bash', CMD.fid, OUT.fidOk, 'ok', 560]] },
        { move: ['check', 'ship'], ms: 760 },
        { visit: 'ship', dur: 1050, cap: ['Ship bundles the fixed page as preview v2.', '交付把改好的页面打包成预览 v2。'],
          chips: [['html', 480]],
          term: [['Bash', CMD.bundle, ['PLAYME.html goes to the authors as preview v2', 'PLAYME.html 作为预览 v2 发给作者'], 'ok']] },
        { end: true, dur: 1500, cap: ['Four of eight stations re-ran; the others kept their files.', '八个环节只重跑了四个，其余环节的文件原封不动。'], tone: 'ok',
          mark: [['Only 4 of 8 stations re-ran', '8 个环节只重跑了 4 个'], 'ok'] },
      ],
      paper: [
        { turn: 'intake', dur: 1200, tone: 'info', cap: ['The authors post paper v2.', '作者发布了论文 v2。'],
          mark: ['Paper v2 arrives', '收到论文 v2'] },
        { visit: 'intake', dur: 1000, tone: 'info', cap: ['Only the paper changed; the code and the runs did not.', '只有论文变了，代码和运行记录都没变。'],
          chips: [['paper', 400]],
          term: [['Read', 'paper-v2/main.tex', ['new version; repo/ and runs/ unchanged', '新版本；repo/ 和 runs/ 没有变化'], 'info']] },
        { move: ['intake', 'facts'], ms: 420, tone: 'info' },
        { visit: 'facts', dur: 1100, cap: ['Facts match each figure by its caption, then renumber it.', '事实表按图注匹配每张图，再重新编号。'],
          chips: [['facts', 440]],
          term: [['Edit', 'facts.json', ['figures matched by caption, then renumbered: Fig. 2→4', '按图注匹配后重新编号：图 2→4'], 'info']] },
        { move: ['facts', 'check'], ms: 820, tone: 'info' },
        { visit: 'check', dur: 1500, end: 'flag', cap: ['Fidelity flags three quotes that paper v2 rewrote.', 'fidelity 标出三处被 v2 改写的引文。'], tone: 'warn',
          chips: [['lint', 460], ['fid', 1090, 'flag', 0]],
          term: [['Bash', CMD.lint, OUT.lintOk, 'ok', 0], ['Bash', CMD.fid2, ['3 quotes no longer verbatim: §3.2, §4.1, Fig. 4 caption', '3 处引文不再逐字一致：§3.2、§4.1、图 4 图注'], 'warn', 560]],
          marks: [[1100, ['3 quotes changed', '3 处引文已变'], 'warn']] },
        { move: ['check', 'build'], ms: 760, tone: 'warn' },
        { visit: 'build', dur: 1150, cap: ['Claude rewrites the three quotes from the new text.', 'Claude 按新版原文重写这三处引文。'],
          chips: [['parts', 420]],
          term: [['Edit', 'parts/*.js', ['3 quotes rewritten from paper v2, English and Chinese together', '按论文 v2 重写 3 处引文，中英文一起改'], 'dim']] },
        { move: ['build', 'check'], ms: 420 },
        { visit: 'check', dur: 1400, cap: ['Fidelity runs again: every quote matches paper v2.', '再跑一次 fidelity：所有引文都与 v2 一致。'], tone: 'ok',
          chips: [['lint', 460], ['fid', 1090, 'done', 1]],
          term: [['Bash', CMD.lint, OUT.lintOk, 'ok', 0], ['Bash', CMD.fid2, ['quotes, references and facts match paper v2', '引文、引用位置和数字都与论文 v2 一致'], 'ok', 560]],
          marks: [[1100, ['All quotes match', '引文全部一致'], 'ok']] },
        { move: ['check', 'ship'], ms: 760 },
        { visit: 'ship', dur: 1050, cap: ['Ship bundles PLAYME.html again for paper v2.', '交付为论文 v2 重新打包 PLAYME.html。'],
          chips: [['html', 480]],
          term: [['Bash', CMD.bundle, ['PLAYME.html now matches paper v2', 'PLAYME.html 已与论文 v2 同步'], 'ok']] },
        { end: true, dur: 1500, cap: ['Five of eight stations re-ran; Plan, Review and Promote did not.', '八个环节重跑了五个；规划、评审和推广都没有跑。'], tone: 'ok',
          mark: [['Only 5 of 8 stations re-ran', '8 个环节只重跑了 5 个'], 'ok'] },
      ],
    };
    const STORIES = { feedback: [...FIRST, ...SECOND.feedback], paper: [...FIRST, ...SECOND.paper] };

    /* ------------------------------------------------------------------ part */

    let scenario = 'feedback';
    let act = 1;   // which act the clock is in (set by reset() and by the turn)

    const P = PM.part(host, {
      id: 'pipeline',
      eyebrow: L('Lab 04 · Workflow', '实验 04 · 流程'),
      q: L('What does the skill do between your paper or project and PLAYME.html?', '从论文/项目到 PLAYME.html，这个 skill 做了什么？'),
      takeaway: L('Feedback and new paper versions re-run only the stations they touch.', '作者反馈或论文更新时，只重跑受影响的环节。'),
      source: [
        { kind: 'sim', text: L('Illustration of the workflow', '流程示意') },
        { kind: 'note', text: L('SKILL.md workflow · scripts/ bundle.py, lint.mjs, fidelity.py, capture.mjs', 'SKILL.md 工作流程 · scripts/ 中的 bundle.py、lint.mjs、fidelity.py、capture.mjs') },
      ],
      folds: [
        { title: L('What each check catches', '每项检查能发现什么'),
          teaser: L('Reader budgets in lint.mjs, paper fidelity in fidelity.py', 'lint.mjs 管读者负担，fidelity.py 管与论文一致'),
          render: renderChecksFold },
        { title: L('The files the skill writes', 'skill 生成的文件'),
          teaser: L('One row per station: the file and what goes into it', '每个环节一行：生成什么文件，里面装什么'),
          render: renderFilesFold },
      ],
    });
    P.el.classList.add('pmx-pipeline-part');

    /* ------------------------------------------------------------------ scene */

    const pathIcon = (d, cls, box = 24) => s('svg', { class: cls, viewBox: `0 0 ${box} ${box}`, fill: 'none', stroke: 'currentColor', 'stroke-width': box === 24 ? 1.6 : 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' }, s('path', { d }));

    const svg = s('svg', { class: 'pmx-pipeline-svg', 'aria-hidden': 'true', focusable: 'false' });
    const blurId = PM.uid('pmx-pipe-blur');
    const defs = s('defs', null, s('filter', { id: blurId, x: '-100%', y: '-100%', width: '300%', height: '300%' }, s('feGaussianBlur', { stdDeviation: '3.2' })));
    const railG = s('g', { class: 'pmx-pipeline-rail' });
    const routeG = s('g', { class: 'pmx-pipeline-routes' });
    const TRAIL = 20;
    const trail = Array.from({ length: TRAIL }, () => s('circle', { class: 'pmx-pipeline-trail', r: 2 }));
    const halo = s('circle', { class: 'pmx-pipeline-halo', r: 13, filter: `url(#${blurId})` });
    const core = s('circle', { class: 'pmx-pipeline-core', r: 5 });
    const coreHi = s('circle', { class: 'pmx-pipeline-core-hi', r: 2.2 });
    const pk = s('g', { class: 'pmx-pipeline-packet' }, ...trail.slice().reverse(), halo, core, coreHi);
    svg.append(defs, railG, routeG, pk);
    const spot = h('div', { class: 'pmx-pipeline-spot', 'aria-hidden': 'true' });

    const stations = STATIONS.map((def, i) => {
      const ring = s('circle', { class: 'pmx-pipeline-ring-c', cx: 30, cy: 30, r: 28, pathLength: 100 });
      const ripple = h('span', { class: 'pmx-pipeline-ripple', 'aria-hidden': 'true' });
      const node = h('span', { class: 'pmx-pipeline-node', 'aria-hidden': 'true' },
        ripple,
        h('span', { class: 'pmx-pipeline-disc' }, pathIcon(ICON[def.id], 'pmx-pipeline-ico'),
          s('svg', { class: 'pmx-pipeline-ring', viewBox: '0 0 60 60', 'aria-hidden': 'true' }, s('circle', { class: 'pmx-pipeline-ring-bg', cx: 30, cy: 30, r: 28 }), ring)),
        h('span', { class: 'pmx-pipeline-led' }));
      const chips = def.files.map((fd) => {
        const glyphs = fd.kind === 'check'
          ? [pathIcon(GLYPH.check, 'pmx-pipeline-g is-check', 14), pathIcon(GLYPH.flag, 'pmx-pipeline-g is-flag', 14)]
          : [pathIcon(GLYPH[fd.kind] || GLYPH.file, 'pmx-pipeline-g', 14)];
        const tag = h('span', { class: 'pmx-pipeline-tag' });
        const el = h('li', { class: 'pmx-pipeline-file', dataset: { kind: fd.kind, state: 'hidden' } },
          h('span', { class: 'pmx-pipeline-gs' }, glyphs),
          h('span', { class: 'pmx-pipeline-fbody' }, h('span', { class: 'pmx-pipeline-fname' }, Array.isArray(fd.text) ? L(fd.text[0], fd.text[1]) : fd.text), tag));
        return { def: fd, el, tag, key: `${def.id}.${fd.id}`, variants: [] };
      });
      const status = h('span', { class: 'pm-sr' });
      const el = h('li', { class: 'pmx-pipeline-st', dataset: { st: def.id, state: 'idle' } },
        node,
        h('span', { class: 'pmx-pipeline-txt' },
          h('span', { class: 'pmx-pipeline-name' }, h('span', { class: 'pmx-pipeline-num' }, String(i + 1).padStart(2, '0')), L(def.name[0], def.name[1]), status),
          h('span', { class: 'pmx-pipeline-role' }, L(def.role[0], def.role[1])),
          h('ul', { class: 'pmx-pipeline-files', 'aria-label': { en: 'Files', zh: '文件' } }, chips.map((c) => c.el))));
      return { def, i, el, node, ripple, ring, chips, status, state: '' };
    });
    const list = h('ol', { class: 'pmx-pipeline-stations', 'aria-label': { en: 'The eight stations of the workflow', zh: '流程的八个环节' } }, stations.map((st) => st.el));
    const map = h('div', { class: 'pmx-pipeline-map' }, spot, svg, list);
    const termHost = h('div', { class: 'pmx-pipeline-term' });
    const root = h('div', { class: 'pmx-pipeline' }, map, termHost);
    P.scene.append(root);
    const term = PM.device.terminal(termHost, { title: 'Claude Code · my-project', prompt: '', rows: 4, label: { en: 'Claude Code transcript (simulated)', zh: 'Claude Code 记录（示意）' } });

    /* ------------------------------------------------------------------ readouts, option */

    // act 1 fills "First build"; act 2 fills "Re-run" and "Files changed" (of the files the first build wrote)
    const ro = PM.readouts(P, [
      { id: 'first', label: L('First build', '首次构建'), unit: L('/ 8 stations', '/ 8 个环节') },
      { id: 're', label: L('Re-run', '重跑'), unit: L('/ 8 stations', '/ 8 个环节') },
      { id: 'files', label: L('Files changed', '改动的文件'), unit: `/ ${FILES_WRITTEN}` },
    ]);

    const segLabel = (long, short) => h('span', { class: 'pmx-pipeline-seglab' },
      h('span', { class: 'pmx-pipeline-long' }, L(long[0], long[1])), h('span', { class: 'pmx-pipeline-short', 'aria-hidden': 'true' }, L(short[0], short[1])));
    PM.segmented(P, {
      ariaLabel: { en: 'What arrives after the first build', zh: '首次构建之后收到什么' },
      value: scenario,
      options: [
        { id: 'feedback', label: segLabel(['Author feedback', '作者反馈'], ['Feedback', '作者反馈']) },
        { id: 'paper', label: segLabel(['New paper version', '论文新版本'], ['Paper v2', '论文 v2']) },
      ],
      onChange(id) { scenario = id; player.reset(); },
    });

    /* ------------------------------------------------------------------ geometry: measured from the layout */

    let G = null;
    function measureGeo() {
      const box = map.getBoundingClientRect();
      const lr = list.getBoundingClientRect();
      const pts = stations.map((st) => {
        const r = st.node.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, R: r.width / 2, row: 0 };
      });
      const rows = [];
      pts.forEach((p, i) => {
        let row = rows.find((rw) => Math.abs(rw.y - p.y) < 4);
        if (!row) { row = { y: p.y, first: i, last: i }; rows.push(row); }
        row.last = i;
        p.row = rows.indexOf(row);
      });
      const vertical = rows.length === pts.length && Math.abs(pts[0].x - pts[pts.length - 1].x) < 4;
      return { ok: box.width > 0 && box.height > 0, pts, rows, vertical, R: pts[0].R, xR: lr.right - box.left + 9 };
    }
    const geo = () => (G && G.ok ? G : (G = measureGeo()));

    // lanes, in px above a disc's top edge (rows) or left of its centre (vertical list)
    const LANE = { hop: 16, loop: 32, cross: 48, vHop: 13, vLoop: 27 };

    function rounded(pts, r) {
      const q = pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
      let d = `M${f1(q[0][0])},${f1(q[0][1])}`;
      for (let i = 1; i < q.length - 1; i++) {
        const [x0, y0] = q[i - 1]; const [x1, y1] = q[i]; const [x2, y2] = q[i + 1];
        const l1 = Math.hypot(x1 - x0, y1 - y0); const l2 = Math.hypot(x2 - x1, y2 - y1);
        const rr = Math.min(r, l1 / 2, l2 / 2);
        d += `L${f1(x1 - ((x1 - x0) / l1) * rr)},${f1(y1 - ((y1 - y0) / l1) * rr)}`
          + `Q${f1(x1)},${f1(y1)} ${f1(x1 + ((x2 - x1) / l2) * rr)},${f1(y1 + ((y2 - y1) / l2) * rr)}`;
      }
      const z = q[q.length - 1];
      return `${d}L${f1(z[0])},${f1(z[1])}`;
    }

    /** The route from station a to b as SVG path data: straight to the next station, a hop over skipped stations, a
     * loop back for a backward move; between the two rows of the 4 × 2 grid, through the gap and the right margin. */
    function routeD(g, a, b) {
      const A = g.pts[a]; const B = g.pts[b];
      if (g.vertical) {
        if (b === a + 1) return `M${f1(A.x)},${f1(A.y)}L${f1(B.x)},${f1(B.y)}`;
        const c = A.x - ((b > a ? LANE.vHop : LANE.vLoop) + A.R) * (4 / 3);
        return `M${f1(A.x)},${f1(A.y)}C${f1(c)},${f1(A.y)} ${f1(c)},${f1(B.y)} ${f1(B.x)},${f1(B.y)}`;
      }
      if (A.row === B.row) {
        if (b === a + 1) return `M${f1(A.x)},${f1(A.y)}L${f1(B.x)},${f1(B.y)}`;
        const cy = A.y - ((b > a ? LANE.hop : LANE.loop) + A.R) * (4 / 3);
        return `M${f1(A.x)},${f1(A.y)}C${f1(A.x)},${f1(cy)} ${f1(B.x)},${f1(cy)} ${f1(B.x)},${f1(B.y)}`;
      }
      if (B.row > A.row) {
        const lane = B.y - B.R - LANE.cross;
        const pts = [[A.x, A.y]];
        if (a === g.rows[A.row].last) pts.push([g.xR, A.y]);
        else { const up = A.y - A.R - LANE.hop; pts.push([A.x, up], [g.xR, up]); }
        pts.push([g.xR, lane], [B.x, lane], [B.x, B.y]);
        return rounded(pts, 12);
      }
      const la = A.y - A.R - LANE.loop; const lb = B.y - B.R - LANE.loop; const x = g.xR + 9;
      return rounded([[A.x, A.y], [A.x, la], [x, la], [x, lb], [B.x, lb], [B.x, B.y]], 12);
    }

    function drawRail() {
      const g = geo();
      railG.textContent = '';
      if (!g.ok) return;
      for (let i = 0; i < stations.length - 1; i++) railG.append(s('path', { d: routeD(g, i, i + 1) }));
    }

    /* ------------------------------------------------------------------ routes travelled, packet */

    let segs = [];
    function addSeg(a, b, tone) {
      const glow = s('path', { class: 'pmx-pipeline-seg-glow' });
      const line = s('path', { class: 'pmx-pipeline-seg-line' });
      const arrow = b < a ? s('path', { class: 'pmx-pipeline-arrow', d: 'M1.5,0 L-10,-6 L-6.8,0 L-10,6 Z' }) : null;
      const gEl = s('g', { class: ['pmx-pipeline-seg', `pm-tone-${tone}`, b < a && 'is-loop', b > a + 1 && 'is-hop'] }, glow, line, arrow);
      routeG.append(gEl);
      const seg = { a, b, tone, k: 0, g: gEl, glow, line, arrow, d: '', len: 0 };
      segs.push(seg);
      return seg;
    }
    function drawSeg(seg) {
      const g = geo();
      if (!g.ok) return;
      const d = routeD(g, seg.a, seg.b);
      if (d !== seg.d) {
        seg.d = d;
        seg.line.setAttribute('d', d);
        seg.glow.setAttribute('d', d);
        seg.len = seg.line.getTotalLength() || 1;
        for (const p of [seg.line, seg.glow]) p.style.strokeDasharray = `${f1(seg.len)} ${f1(seg.len + 2)}`;
        if (seg.arrow) {
          const at = Math.max(0, seg.len - (g.R + 3));
          const p = seg.line.getPointAtLength(at);
          const q = seg.line.getPointAtLength(Math.max(0, at - 3));
          seg.arrow.setAttribute('transform', `translate(${f1(p.x)},${f1(p.y)}) rotate(${f1((Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI)})`);
        }
      }
      const off = f1(seg.len * (1 - seg.k));
      seg.line.style.strokeDashoffset = String(off);
      seg.glow.style.strokeDashoffset = String(off);
      if (seg.arrow) seg.arrow.style.opacity = String(clamp((seg.k - 0.86) / 0.14, 0, 1));
    }

    // packet: {seg, k} while it travels, {at} while a station holds it (hidden under the disc), null at rest
    let pkState = null;
    let spotK = 0;
    function drawPacket() {
      const g = geo();
      if (!pkState || !g.ok) { pk.style.opacity = '0'; spot.style.opacity = '0'; return; }
      pk.setAttribute('class', `pmx-pipeline-packet pm-tone-${pkState.tone || 'accent'}`);
      spot.dataset.tone = pkState.tone || 'accent';
      let head;
      if (pkState.seg) {
        const seg = pkState.seg;
        const at = seg.len * pkState.k;
        head = seg.line.getPointAtLength(at);
        const tl = 84 * Math.min(1, (1 - pkState.k) * 4);
        trail.forEach((c, i) => {
          const d = at - ((i + 1) * tl) / TRAIL;
          const p = seg.line.getPointAtLength(Math.max(0, d));
          c.setAttribute('cx', f1(p.x));
          c.setAttribute('cy', f1(p.y));
          c.setAttribute('r', f1(3.6 * (1 - i / TRAIL) + 0.6));
          c.style.opacity = d <= 0 || tl < 2 ? '0' : String(f1((1 - (i + 1) / (TRAIL + 1)) * 0.62 * 100) / 100);
        });
      } else {
        head = g.pts[pkState.at];
        trail.forEach((c) => { c.style.opacity = '0'; });
      }
      for (const c of [halo, core, coreHi]) { c.setAttribute('cx', f1(head.x)); c.setAttribute('cy', f1(head.y)); }
      pk.style.opacity = '1';
      spot.style.transform = `translate(${f1(head.x)}px, ${f1(head.y)}px)`;
      spot.style.opacity = String(f1(spotK * 100) / 100);
    }

    function redraw() { G = null; drawRail(); segs.forEach(drawSeg); drawPacket(); }

    /* ------------------------------------------------------------------ station and file states */

    const STATUS = {
      idle: ['not run yet', '尚未运行'], old: ['built earlier', '之前已完成'], run: ['running', '运行中'],
      done: ['ran', '已运行'], flag: ['found a problem', '发现问题'], skip: ['not re-run, files kept', '没有重跑，文件保留'],
    };
    function setSt(st, state, k) {
      if (st.state !== state) {
        st.state = state;
        st.el.dataset.state = state;
        st.status.textContent = `, ${PM.t(STATUS[state][0], STATUS[state][1])}`;
      }
      st.ring.style.strokeDashoffset = String(f1(100 * (1 - clamp(k, 0, 1))));
    }
    function setRipple(st, k) {
      const on = k > 0 && k < 1;
      st.ripple.style.opacity = on ? String(f1((1 - k) * 90) / 100) : '0';
      st.ripple.style.transform = `scale(${f1((1 + k * 0.85) * 100) / 100})`;
    }
    function setChip(c, state, vis, tagIdx, tagVis, flash) {
      c.el.dataset.state = state;
      c.el.style.opacity = String(f1(vis * 100) / 100);
      c.el.style.transform = vis >= 1 ? '' : `translateX(${f1(-7 * (1 - vis))}px)`;
      c.el.style.setProperty('--pmx-flash', String(f1(clamp(flash, 0, 1) * 100) / 100));
      c.variants.forEach((v, i) => { v.style.visibility = i === tagIdx ? '' : 'hidden'; });   // all stay in the layout
      c.tag.style.opacity = tagIdx >= 0 ? String(f1(tagVis * 100) / 100) : '0';
      c.cur = { state, tagIdx };
    }

    // Tag variants of the current scenario (rendered once per scenario so the layout is stable during a run).
    let tagsFor = null;
    function applyTags() {
      if (tagsFor === scenario) return;
      tagsFor = scenario;
      const table = TAGS[scenario];
      for (const st of stations) for (const c of st.chips) {
        c.tag.textContent = '';
        c.variants = (table[c.key] || []).map(([en, zh, tone]) => h('span', { class: ['pmx-pipeline-tagv', `pm-tone-${tone}`] }, L(en, zh)));
        c.tag.append(...c.variants);
      }
      G = null;
    }

    /* ------------------------------------------------------------------ terminal lines (typed from the clock) */

    function cmdNode(tool, args, n) {
      const full = `${tool}(${args})`;
      const vis = full.slice(0, n);
      return h('span', { class: 'pmx-pipeline-tl' },
        h('span', { class: 'pmx-pipeline-tdot' }, '● '),
        h('b', null, vis.slice(0, tool.length)), vis.slice(tool.length),
        n < full.length ? h('span', { class: 'pmx-pipeline-caret' }) : null);
    }
    const outNode = (txt) => h('span', { class: 'pmx-pipeline-tl' }, h('span', { class: 'pmx-pipeline-tsub' }, '  └ '), L(txt[0], txt[1]));
    const typeMs = (tool, args) => clamp((tool.length + args.length + 2) * 6, 160, 440);

    /* ------------------------------------------------------------------ the story */

    // stations run and files written in the current act (act 1 fills "First build", act 2 "Re-run" and "Files changed")
    let count = { st: new Set(), files: 0 };

    function reset() {
      segs.forEach((sg) => sg.g.remove());
      segs = [];
      pkState = null;
      spotK = 0;
      act = 1;
      applyTags();
      for (const st of stations) {
        setSt(st, 'idle', 0);
        setRipple(st, 0);
        for (const c of st.chips) setChip(c, 'hidden', 0, -1, 0, 0);
      }
      term.clear();
      term.print(L(PROMPT.first[0], PROMPT.first[1]), 'user');
      ro.reset();
      count = { st: new Set(), files: 0 };
      G = null;
      drawRail();
      drawPacket();
    }

    function renderVisit(st, v, t, base, lines, before) {
      const running = t < v.dur;
      setSt(st, running ? 'run' : (v.end || 'done'), t / v.dur);
      setRipple(st, t / 640);
      let files = 0;
      for (const [cid, at, state, tagIdx] of v.chips || []) {
        if (t < at) continue;
        const c = st.chips.find((x) => x.def.id === cid);
        const kc = clamp((t - at) / 280, 0, 1);
        const was = before.get(c) !== 'hidden';
        // tags mark what the act-2 change did to a file; the first build writes plain files
        const ti = act === 1 ? -1 : tagIdx != null ? tagIdx : (c.variants.length ? 0 : -1);
        const fin = state === 'flag' ? 'flag' : running ? 'fresh' : 'done';
        setChip(c, fin, was ? 1 : kc, ti, kc, 1 - clamp((t - at) / 900, 0, 1));
        if (c.def.kind === 'file') files += 1;
      }
      const ran = base.st + (running || base.has ? 0 : 1);
      if (act === 1) ro.set('first', ran);
      else { ro.set('re', ran); ro.set('files', base.files + files); }
      // a command starts only after the previous command's output is printed, so lines keep their order at any frame rate
      (v.term || []).forEach(([tool, args, out, kind, at = 0], j) => {
        if (t < at || (j > 0 && !(lines[j - 1] && lines[j - 1].out))) return;
        const ln = lines[j] || (lines[j] = { n: -1, cmd: term.print('', 'cmd'), out: null });
        const tm = typeMs(tool, args);
        const n = Math.round((tool.length + args.length + 2) * clamp((t - at) / tm, 0, 1));
        if (n !== ln.n) { ln.n = n; ln.cmd.set(cmdNode(tool, args, n)); }
        if (!ln.out && t >= at + tm + 90) ln.out = term.print(outNode(out), kind || 'dim');
      });
      return files;
    }

    async function visit(ctx, v) {
      const st = stations[IDX[v.visit]];
      ctx.narrate(L(v.cap[0], v.cap[1]), v.tone);
      const base = { files: count.files, st: count.st.size, has: count.st.has(st.i) };
      const lines = [];
      const before = new Map(st.chips.map((c) => [c, c.cur ? c.cur.state : 'hidden']));
      let last = 0;
      const fn = (a, b) => (k) => { last = renderVisit(st, v, lerp(a, b, k), base, lines, before); };
      let t0 = 0;
      for (const [at, label, tone] of v.marks || []) {
        await ctx.tween(at - t0, fn(t0, at));
        t0 = at;
        ctx.mark(L(label[0], label[1]), tone);
      }
      await ctx.tween(v.dur - t0, fn(t0, v.dur));
      count.files += last;
      count.st.add(st.i);
    }

    async function move(ctx, v) {
      const a = IDX[v.move[0]];
      const b = IDX[v.move[1]];
      const seg = addSeg(a, b, v.tone || 'accent');
      await ctx.tween(v.ms, (k) => {
        seg.k = k;
        drawSeg(seg);
        pkState = { seg, k, tone: v.tone || 'accent' };
        spotK = 1;
        drawPacket();
      }, ease.inOut);
      pkState = { at: b, tone: v.tone || 'accent' };
    }

    // The close of an act. After the re-run, the stations it did not touch say so (their files stay as they were).
    async function finish(ctx, v) {
      ctx.narrate(L(v.cap[0], v.cap[1]), v.tone);
      if (v.mark) ctx.mark(L(v.mark[0][0], v.mark[0][1]), v.mark[1]);
      const untouched = act === 2 ? stations.filter((st) => !count.st.has(st.i)) : [];
      await ctx.tween(v.dur, (k) => {
        untouched.forEach((st) => setSt(st, 'skip', 1));
        spotK = 1 - clamp(k / 0.6, 0, 1);
        drawPacket();
      });
    }

    // Act 2 begins: the comment (or paper v2) arrives at its station. Every station keeps what the first build made,
    // the first build's routes fade, and the counters start again for the re-run.
    async function turn(ctx, v) {
      act = 2;
      const st = stations[IDX[v.turn]];
      ctx.mark(L(v.mark[0], v.mark[1]), v.tone);
      ctx.narrate(L(v.cap[0], v.cap[1]), v.tone);
      for (const x of stations) {
        setSt(x, 'old', 1);
        setRipple(x, 0);
        for (const c of x.chips) setChip(c, 'old', 1, -1, 0, 0);
      }
      term.print(L(PROMPT[scenario][0], PROMPT[scenario][1]), 'user');
      count = { st: new Set(), files: 0 };
      ro.set('re', 0);
      ro.set('files', 0);
      const fading = segs;
      pkState = { at: st.i, tone: v.tone };
      await ctx.tween(v.dur, (k) => {
        const o = String(f1((1 - clamp(k / 0.55, 0, 1)) * 100) / 100);
        fading.forEach((sg) => { sg.g.style.opacity = o; });
        spotK = clamp(k / 0.35, 0, 1);
        setRipple(st, (k * v.dur) / 700);
        drawPacket();
      });
      fading.forEach((sg) => sg.g.remove());
      segs = segs.filter((sg) => !fading.includes(sg));
    }

    const player = PM.player(P, {
      label: L('Run', '运行'),
      hint: () => L(HINT[scenario][0], HINT[scenario][1]),
      reset,
      async run(ctx) {
        for (const step of STORIES[scenario]) {
          if (step.turn) await turn(ctx, step);
          else if (step.visit) {
            if (!pkState) { pkState = { at: IDX[step.visit], tone: 'accent' }; spotK = 1; drawPacket(); }
            await visit(ctx, step);
          } else if (step.move) await move(ctx, step);
          else if (step.end) await finish(ctx, step);
        }
      },
    });

    /* ------------------------------------------------------------------ layout changes */

    if (typeof ResizeObserver === 'function') {
      let lastW = 0;
      let lastH = 0;
      new ResizeObserver(() => {
        const r = map.getBoundingClientRect();
        if (Math.abs(r.width - lastW) < 0.5 && Math.abs(r.height - lastH) < 0.5) return;
        lastW = r.width;
        lastH = r.height;
        redraw();
      }).observe(map);
    }
    PM.onLang(() => {
      for (const st of stations) if (st.state) st.status.textContent = `, ${PM.t(STATUS[st.state][0], STATUS[st.state][1])}`;
      redraw();
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw).catch(() => {});
    reset();

    /* ------------------------------------------------------------------ folds */

    function table(head, rows, cls) {
      return h('div', { class: ['pmx-pipeline-tablewrap', cls] },
        h('table', { class: 'pmx-pipeline-table' },
          h('thead', null, h('tr', null, head.map((c) => h('th', { scope: 'col' }, L(c[0], c[1]))))),
          h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => (i === 0 ? h('th', { scope: 'row' }, c) : h('td', null, c))))))));
    }
    const mono = (txt) => h('code', null, txt);

    function renderChecksFold(el) {
      el.append(
        h('p', null, mono('lint.mjs'), ' ', L('opens the page in headless Chromium at each width and language, and measures every part at rest.',
          '在无头 Chromium 中按每种宽度和语言打开页面，测量每个部件在打开页面、未操作时的状态。')),
        table([['Check', '检查项'], ['Budget', '预算']], [
          [L('Question', '问题'), L('at most 14 words', '不超过 30 个字')],
          [L('Question, lead and takeaway together', '问题、导语和要点合计'), L('at most 70 words', '不超过 140 个字')],
          [L('Primary buttons', '主按钮'), L('exactly 1', '恰好 1 个')],
          [L('Visible controls outside the scene', '场景之外的可见控件'), L('at most 4', '不超过 4 个')],
          [L('Folds', '折叠区'), L('at most 4, all closed', '不超过 4 个，全部收起')],
          [L('Boxed labels that are not controls', '带框却不能点的标签'), L('none', '没有')],
          [L('Part height at 1440 px', '1440 px 下的部件高度'), L('at most 1250 px', '不超过 1250 px')],
          [L('Overflow at 400 px, console errors', '400 px 下横向溢出、控制台报错'), L('none', '没有')],
          [L('Players without a progress bar', '没有进度条的播放器'), L('none', '没有')],
          [L('Captions while a story plays', '播放时的字幕'), L('at most 12 words (a warning)', '不超过 24 个字（只提示）')],
        ]),
        h('p', null, mono('fidelity.py'), ' ', L('reads the text of every part, played to the end with every fold open, and compares it with the paper.',
          '读取每个部件播放到最后、展开所有折叠后的文字，与论文逐项对照。')),
        table([['Check', '检查项'], ['Passes when', '通过的条件']], [
          [L('Quotes', '引文'), L('every quoted passage appears word for word in the paper', '每段引文都能在论文中逐字找到')],
          [L('References', '引用位置'), L('every “Paper §x.y”, “Fig. N” and “Table N” exists', '每个“论文第 x.y 节”“图 N”“表 N”都真实存在')],
          [L('Facts', '数字'), L('every number on the page equals its value in facts.json', '页面上的每个数字都等于 facts.json 中的值')],
          [L('Words', '用词'), L('no term from the ban list in words.json', '没有 words.json 禁用表中的说法')],
          [L('Privacy', '隐私'), L('no IP address, e-mail address, home-folder path or key-like token', '没有 IP 地址、邮箱、用户目录路径或疑似密钥的字符串')],
        ]));
    }

    function renderFilesFold(el) {
      const files = (...names) => names.map((n, i) => [i ? ' · ' : null, mono(n)]);
      el.append(table([['Station', '环节'], ['File', '文件'], ['What goes into it', '里面装什么']], [
        [L('Intake', '收集材料'), files('paper.tex', 'repo/', 'runs/'), L('your material, read as data and never executed', '你的原始材料，只当作数据读取，从不执行')],
        [L('Facts', '事实'), files('facts.json'), L('every number the page shows, as printed, with its place in the paper', '页面上的每个数字、它在论文中的写法和位置')],
        [L('Facts', '事实'), files('words.json'), L('the paper’s terms in each language, and labels to avoid', '论文术语的中英文写法，以及要避免的说法')],
        [L('Plan', '规划'), files('plan.md'), L('one row per claim: mechanism, reader action, what changes, takeaway', '每个结论一行：机制、读者操作、画面变化、要点')],
        [L('Build', '构建'), files('parts/*.js'), L('one part per file, built on the kit', '每个部件一个文件，基于 kit 搭建')],
        [L('Check', '检查'), L('reports only', '只生成报告'), L('the lint table and the fidelity findings; nothing ships until both pass', 'lint 表格和 fidelity 结果；两项都通过才交付')],
        [L('Review', '评审'), files('ledger.md'), L('each author comment, its round and the rule it became', '每条作者意见、所在轮次和由此得出的规则')],
        [L('Ship', '交付'), files('PLAYME.html'), L('the whole page in one file that opens offline', '整个页面装进一个可离线打开的文件')],
        [L('Promote', '推广'), files('demo.gif', 'teaser.mp4', 'cover.png'), L('recorded frame by frame from the page’s own players', '从页面自己的播放器逐帧录制')],
      ], 'is-files'));
    }
  });
})();
