/* Part 01 · retry — the PLAYME part template in one file.
 * One question, one primary action (the player's button), one option (a toggle), a scene that moves on the player's
 * virtual clock, readouts filled when the run ends, a flat source line and two closed folds.
 * Replace the scene and the story with your project's mechanism; keep the shape.
 * Numbers from the paper come from facts.json, never typed here:
 *   PM.F('main.gain')        → <span data-fact="main.gain">+12.4</span>  (fidelity.py checks it against the paper)
 *   PM.ref('tab-main')       → "Paper Table 2" / 「论文表 2」              (relabelled in one place when the paper renumbers) */
function buildRetry(PM, host) {
  const { h, s, L, lerp, ease } = PM;
  let retry = false;
  let senderCode = null;

  const P = PM.part(host, {
    id: 'retry',
    eyebrow: L('Part 01 · Template', '部件 01 · 模板'),
    q: L('What does one retry change for a lost packet?', '一次重试能为丢失的数据包带来什么？'),
    lead: L('Send one packet over a noisy link, with and without a retry.', '让一个数据包穿过有噪声的链路，比较重试与不重试。'),
    takeaway: L('Without a retry the packet is gone; one retry delivers it at the cost of a second trip.',
      '不重试，数据包就丢了；重试一次能送达，代价是多跑一趟。'),
    source: [
      { kind: 'sim', text: L('Simulation with illustrative timings', '模拟，时长仅作示意') },
    ],
    folds: [
      {
        title: L('How the sender works', '发送方怎么写'),
        teaser: L('Ten lines of Python; the retries argument decides it.', '十行 Python，决定结果的是 retries 参数。'),
        render(el) {
          PM.intent(el, L('Send the packet; if the link drops it, try again.', '发送数据包；如果链路丢了它，就再试一次。'));
          senderCode = PM.code(el, {
            lang: 'python', title: 'sender.py',
            src: [
              'def send(packet, retries=0):',
              '    for attempt in range(1 + retries):',
              '        if link.transmit(packet):',
              '            return attempt + 1          # delivered',
              '        log.warning("lost", attempt=attempt)',
              '…',
              '    raise Dropped(packet)',
              '',
              'send(packet)              # no retry: one attempt',
              'send(packet, retries=3)   # retry on loss',
            ].join('\n'),
            focus: ['retries=3'],
            marks: { [retry ? 9 : 8]: 'run' },
          });
        },
      },
      {
        title: L('Why a retry is not free', '为什么重试有代价'),
        teaser: L('Each retry adds a round trip and can duplicate a packet.', '每次重试多一次往返，还可能产生重复包。'),
        render(el) {
          el.append(
            L('A retry costs one more trip over the link, so delivery takes longer. When only the acknowledgement is lost, the receiver gets the same packet twice.',
              '每次重试都要再走一遍链路，送达因此变慢。如果丢的只是确认消息，接收方会收到两份同样的数据包。', 'p'),
            L('Real protocols number their packets, so the receiver can drop the duplicate.',
              '真实的协议会给数据包编号，让接收方丢弃重复的那一份。', 'p'));
        },
      },
    ],
  });

  /* the scene: logical positions in % of the scene width, set as a pure function of the script's progress */
  const glyph = (d) => s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, s('path', { d }));
  const node = (cls, x, name, d) => h('div', { class: ['rt-node', cls], style: { left: `${x}%` } }, h('div', { class: 'rt-disc' }, glyph(d)), h('span', { class: 'rt-name' }, name));
  const sender = node('rt-send', 10, L('Sender', '发送方'), 'M12 19V5M6 11l6-6 6 6');
  const link = node('rt-link', 50, L('Noisy link', '噪声链路'), 'M13 2 4 14h7l-1 8 9-12h-7z');
  const recv = node('rt-recv', 90, L('Receiver', '接收方'), 'M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z');
  const packet = h('div', { class: 'rt-packet' });
  const burst = h('div', { class: 'rt-burst' });
  const tries = h('b', null, '0');
  const noise = s('svg', { class: 'rt-noise', viewBox: '0 0 120 26', preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('path', { d: 'M0 13 L10 4 L20 22 L30 4 L40 22 L50 4 L60 22 L70 4 L80 22 L90 4 L100 22 L110 4 L120 13', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }));
  P.scene.append(h('div', { class: 'rt' },
    h('span', { class: 'rt-tries' }, L('attempts ', '尝试次数 '), tries),
    h('div', { class: 'rt-wire' }), noise, sender, link, recv, burst, packet));

  const at = (x) => { packet.style.left = `${x}%`; };
  const lost = (k) => {                    // the packet drops off the wire while a ring bursts at the link
    packet.classList.toggle('is-lost', k > 0);
    packet.style.transform = `translateY(${k * 38}px) scale(${1 - k * 0.4})`;
    packet.style.opacity = String(1 - k);
    burst.style.opacity = String(k < 1 ? 1 - k : 0);
    burst.style.transform = `scale(${1 + k * 2.2})`;
  };
  const relaunch = (n) => { lost(0); burst.style.opacity = '0'; at(10); tries.textContent = String(n); };

  const ro = PM.readouts(P, [
    { id: 'tries', label: L('Attempts', '尝试次数') },
    { id: 'got', label: L('Delivered', '是否送达') },
    { id: 'time', label: L('Time', '耗时'), unit: 's' },
  ]);

  PM.toggle(P, {
    label: L('Retry on loss', '丢失后重试'),
    onChange(v) {
      retry = v;
      if (senderCode) senderCode.mark({ [v ? 9 : 8]: 'run' });
      player.reset();                      // the story changed: back to rest, re-measure the marks
    },
  });

  const player = PM.player(P, {
    label: L('Send packet', '发送数据包'),
    reset() {
      relaunch(0);
      recv.classList.remove('is-got', 'is-missing');
      ro.reset();
    },
    async run(ctx) {
      relaunch(1);
      ctx.narrate(L('The sender sends packet #1 toward the receiver.', '发送方把 1 号数据包发往接收方。'));
      await ctx.tween(1300, (k) => at(lerp(10, 50, k)), ease.inOut);
      ctx.mark(L('Packet lost on the link', '数据包在链路上丢失'), 'err');
      ctx.narrate(L('The noisy link drops it.', '噪声链路把它丢掉了。'), 'err');
      await ctx.tween(800, lost, ease.out);
      await ctx.sleep(500);
      if (!retry) {
        recv.classList.add('is-missing');
        ctx.mark(L('Sender gives up', '发送方放弃'), 'warn');
        ctx.narrate(L('No retry, so the receiver never gets it.', '没有重试，接收方永远收不到。'), 'warn');
        await ctx.sleep(1800);
        return;
      }
      relaunch(2);
      ctx.narrate(L('Retry: the sender sends the same packet again.', '重试：发送方再发一次同一个数据包。'), 'agent');
      await ctx.tween(1300, (k) => at(lerp(10, 50, k)), ease.inOut);
      ctx.narrate(L('This time it passes the link.', '这一次它通过了链路。'));
      await ctx.tween(1100, (k) => at(lerp(50, 90, k)), ease.inOut);
      recv.classList.add('is-got');
      ctx.mark(L('Delivered on attempt 2', '第 2 次尝试送达'), 'ok');
      ctx.narrate(L('Delivered on the second attempt.', '第二次尝试送达。'), 'ok');
      await ctx.sleep(1500);
    },
    onDone() {
      ro.set('tries', retry ? 2 : 1);
      ro.set('got', retry ? L('Yes', '是') : L('No', '否'), retry ? 'ok' : 'err');
      ro.set('time', PM.fmt.num(player.duration / 1000, 1));
    },
  });
  return P;
}

PM.register('retry', (host) => buildRetry(PM, host));
