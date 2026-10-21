/* The review ledger of the OpenGCUA Interactive Lab: every author request and the PLAYME rule that answers it.
   EN: translation; ZH: the authors' wording, shortened. Mirrors skills/playme/references/review-loop.md. */
window.PMSiteLedger = {
  rules: {
    R1: { en: 'Experience, not presentation', zh: '体验，而不是呈现' },
    R2: { en: 'Design for the one-minute reader', zh: '为一分钟读者设计' },
    R3: { en: 'Familiar first, then the highlight, then depth', zh: '先讲熟悉的，再讲亮点，最后讲深层' },
    R4: { en: 'One primary action, at most two options', zh: '一个主操作，最多两个选项' },
    R5: { en: 'Only interactive things look interactive', zh: '能点的才做成能点的样子' },
    R6: { en: 'Make the key event unmistakable', zh: '让关键事件一眼可见' },
    R7: { en: 'Every player has a progress bar', zh: '每个播放器都有进度条' },
    R8: { en: 'Show the code; highlight the decisive token', zh: '展示代码，高亮关键参数' },
    R9: { en: 'Comparisons fit one view', zh: '对比放在同一视野里' },
    R10: { en: 'Devices look like devices', zh: '设备要像设备' },
    R11: { en: 'Precise, plain words', zh: '用词准确、平实' },
    R12: { en: 'Fold the depth', zh: '深入内容默认折叠' },
    R13: { en: 'Never contradict the paper', zh: '绝不与论文矛盾' },
    R14: { en: 'Scrub private data', zh: '清除隐私数据' },
    R15: { en: 'Ship one offline file', zh: '交付一个离线文件' },
    R16: { en: 'Look as good as it plays', zh: '视觉要配得上交互' },
    R17: { en: 'Turn each comment into a rule', zh: '每条意见都变成规则' },
    R18: { en: 'The lab is the promo', zh: '实验室本身就是宣传素材' },
  },
  rounds: [
    { id: 'R1', date: '10-14', items: [
      { id: 'R1', rules: ['R1'], en: 'Being able to experience the features interactively will be the biggest highlight of a project site.', zh: '对于项目网站，“可以交互地体验特性”将是项目网站最大的亮点。' },
    ] },
    { id: 'R2', date: '10-14', items: [
      { id: 'R2.1', rules: ['R4', 'R5'], en: 'Too many icons and too much text; the main line is unclear. I thought "Simulation" and "Paper Fig. 6" were clickable.', zh: '需要操作的 icon 较多、需要理解的文字太多，主线不够清晰；一开始还以为“示意模拟”“论文图 6”也可以交互。' },
      { id: 'R2.2', rules: ['R11'], en: '"BENCHMARK HABITS" is not accurate, and "Habits that pass on a benchmark break on a shared, changing, cluttered machine" is very hard to understand.', zh: '“BENCHMARK HABITS”和“评测习惯”这个词很不准确；“Habits that pass on a benchmark break on a shared, changing, cluttered machine”非常难以理解。' },
      { id: 'R2.3', rules: ['R6'], en: 'The mouse-grab example is very good, but it grabs only once, so it is hard to see what happened. Grab several times.', zh: '抢夺鼠标的例子非常好，但现在只抢一次，不太能一下子看明白发生了什么，建议多次抢夺。' },
      { id: 'R2.4', rules: ['R12'], en: 'There is a lot of knowledge content. Fold part of it by default, and keep it clear.', zh: '知识性内容很多，建议筛选部分优先折叠，用户可以选择性展开；这些内容也要表达清晰。' },
      { id: 'R2.5', rules: ['R9', 'R2'], en: 'The four-way comparison is a great topic, but it runs off the page, and so much comes before it that it took me a long time to understand.', zh: '四种方式的对比 topic 很好，但排列超出页面，无法看到对比；对比之前内容太多，我费了半天劲才理解。' },
      { id: 'R2.6', rules: ['R3', 'R12'], en: 'Put the most intuitive part first; readers who want more can explore the folded depth step by step.', zh: '把最容易理解、最直观的放在最前面；后面逐渐深入的内容用折叠，感兴趣的读者再逐步探索。' },
      { id: 'R2.7', rules: ['R13'], en: 'Use the runs the paper’s tables used; case-study material keeps the case-study runs.', zh: '真机轨迹请与论文表格统计所用的运行一致；案例分析中用到的保持案例的轨迹。' },
      { id: 'R2.8', rules: ['R16'], en: 'The interactions are very cool, but the plain palette makes them look plain at first glance.', zh: '交互功能其实非常酷炫，但整体风格配色比较平实，第一眼也看起来比较平实。' },
    ] },
    { id: 'R3', date: '10-14', items: [
      { id: 'R3.1', rules: ['R13'], en: 'Nothing on the site may contradict the paper: print each number exactly as the table prints it.', zh: '请确保网站的信息不会和 paper 矛盾，数字按论文表格原样写。' },
      { id: 'R3.2', rules: ['R13'], en: 'Do not label any model with its reasoning effort.', zh: '其他模型也都不需要写推理强度。' },
      { id: 'R3.3', rules: ['R13'], en: 'If necessary, show three real-device tasks instead of four.', zh: '如果必要的话，可以放 3 个真机 task 而不是 4 个。' },
    ] },
    { id: 'R4', date: '10-15', items: [
      { id: 'R4.1', rules: ['R1'], en: 'How is background execution done: a virtual display or another technique? Is it covered?', zh: '后台执行是通过虚拟屏还是其他技术手段实现的？这个部分有被包括在内吗？' },
      { id: 'R4.2', rules: ['R7'], en: 'Give every player a progress bar so readers see and control progress.', zh: '请在每个播放界面提供一个进度条，方便读者了解进度以及进行控制。' },
      { id: 'R4.3', rules: ['R8'], en: 'A benchmark click names no target; a real-device click must. Show concise code with the animation and highlight the target.', zh: 'benchmark 不需要指定 click 目标，真机的代码需要指定，因此在动画下方或动画里提供简洁代码并 highlight 操作目标很有价值。' },
      { id: 'R4.4', rules: ['R6'], en: 'Highlight the moment the screen changes.', zh: '屏幕发生变化的时刻可以 highlight 一下。' },
      { id: 'R4.5', rules: ['R11', 'R8'], en: 'Retitle it "Code execution" so the highlight is in the title, and put the code into the animation.', zh: '把标题换成 code execution，在标题里就突出核心亮点；并在动画里插入对应操作的代码。' },
      { id: 'R4.6', rules: ['R10'], en: 'Put the cross-device UI in phone, browser and Mac frames; now only text tells them apart.', zh: '跨端的 UI 能否套个手机/浏览器/Mac 外框，现在主要是靠文字区分。' },
      { id: 'R4.7', rules: ['R13'], en: 'In the real-run views, remove one task statistic and one model that the final paper does not report.', zh: '真机轨迹部分，去掉论文没有报告的一项任务统计和一个模型。' },
    ] },
    { id: 'R5', date: '10-15', items: [
      { id: 'R5.1', rules: ['R15'], en: 'Package all the files as one project, to send to colleagues who will help develop it.', zh: '把所有的文件打包成一个项目，发给同事协助开发。' },
      { id: 'R5.2', rules: ['R15'], en: 'Make the site open on our own computers.', zh: '让我和同事都能够在电脑上打开并查看网站。' },
    ] },
    { id: 'R6', date: '10-15', items: [
      { id: 'R6.1', rules: ['R10'], en: 'Make the frames look more like a real computer, browser and phone.', zh: '请做得更像电脑、浏览器、手机的 UI 形状和外观。' },
      { id: 'R6.2', rules: ['R8'], en: 'Code panes must scroll horizontally too, to show the full code.', zh: '代码除了上下滑动也请加入左右滑动，这样能查看完整代码。' },
    ] },
    { id: 'R7', date: '10-15', items: [
      { id: 'R7.1', rules: ['R11'], en: 'The project is called OpenGCUA.', zh: '我们的项目名叫 OpenGCUA。' },
      { id: 'R7.2', rules: ['R3', 'R11'], en: 'Reorder the labs, and rename "5-layer" to "Real-device harness architecture" as the main title.', zh: '调整顺序；5-layer 这部分改名成 real-device harness architecture 作为主标题。' },
      { id: 'R7.3', rules: ['R3'], en: 'Put the AX layer above the screenshot, translucent, but start the tour from the screenshot everyone knows.', zh: '把 AX 放在 screenshot 图层之上，通过透明度隐约看出截图；但展示顺序还是从 screenshot 开始。' },
      { id: 'R7.4', rules: ['R13'], en: 'Write "Paper §4.3.1" so readers know where to look.', zh: '§4.3.1 前面加 “Paper”，更清晰地传达可以去论文哪里查看。' },
    ] },
    { id: 'R8', date: '10-15', items: [
      { id: 'R8.1', rules: ['R1'], en: 'Is the AX tree 3D view missing some layers?', zh: 'AX tree 的 3D 视图是不是少了几层？' },
      { id: 'R8.2', rules: ['R1'], en: 'Let readers drag the whole 3D Mac teardown with the mouse at any time.', zh: '方便读者随时通过鼠标拖拽，查看整个 Mac 3D 拆解。' },
    ] },
  ],
};
