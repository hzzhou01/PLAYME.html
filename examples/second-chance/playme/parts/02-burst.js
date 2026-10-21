/* Part 02 · burst — object a is hit once, object c is hit in a burst; then misses arrive and the hand sweeps.
 * Pattern: Two worlds inside one ring (one bit vs two bits), with the burst size as the one option.
 * Paper §2.2. The sweep is SCB.plan(), a port of evict() in code/scb.py. */
PM.register('burst', (host) => {
  const { h, L, lerp, ease } = PM;
  const { plan, ring, EVICT_SRC, paperRef, quote } = window.SCB;
  const K = Number(window.FACTS.facts['burst.k'].value);       // a burst: more than k hits within one pass

  const NAMES = 'abcdefgh'.split('');
  const NEW = 'ijklmnopqrstuvwx'.split('');                      // 16 misses: enough for c to leave
  let burst = 12;
  const before = () => NAMES.map((name) => ({ name, R: name === 'a' || name === 'c' ? 1 : 0, B: name === 'c' ? 1 : 0, hits: 0 }));
  const REST = NAMES.map((name) => ({ name, R: 0, B: 0 }));
  const MISSES = plan(before(), NEW, 'scb');                       // the same for every burst size: B is one bit
  const lastMiss = MISSES.findIndex((m) => m.visits.some((v) => v.act === 'evict' && v.name === 'c'));
  const STORY = MISSES.slice(0, lastMiss + 1);

  const P = PM.part(host, {
    id: 'burst',
    eyebrow: L(`Bursts · ${paperRef('sec-burst')}`),
    q: L('Why does a burst get exactly one extra pass of the hand?'),
    lead: L('Object a is hit once. Object c is hit in a burst. Then misses arrive, and the hand sweeps.'),
    takeaway: L('The hand clears one bit per pass, so the burst bit buys exactly one extra pass, however many hits set it.'),
    source: [
      { kind: 'sim', text: L('Simulation for illustration · built from code/scb.py') },
      { kind: 'paper', text: L(`based on ${paperRef('sec-burst')}`) },
    ],
    folds: [
      {
        title: L('How the code works'),
        teaser: L('evict() clears the burst bit before the reference bit, one per visit.'),
        render(el) {
          PM.intent(el, L('At each visit: clear B if it is set, else clear R if it is set, else evict.'));
          PM.code(el, { lang: 'python', title: 'code/scb.py', src: EVICT_SRC, start: 29, focus: ['if meta[1]:', 'meta[1] = 0', 'elif meta[0]:'] });
          el.append(L('meta[1] is the burst bit and meta[0] the reference bit. Each visit clears at most one of them, so two set bits mean two passes survived.', null, 'p'));
        },
      },
      {
        title: L('What the paper says'),
        teaser: L(`${paperRef('sec-burst')}, in the paper's words.`),
        render(el) {
          el.append(quote('burst.def'), quote('burst.k.def'), quote('burst.rule'));
        },
      },
      {
        title: L('About this simulation'),
        teaser: L('What the story leaves out.'),
        render(el) {
          el.append(
            L('Only a and c are hit in this story. Every other object, and every new one, has no bit set, so the hand evicts it as soon as it reaches it. Real traffic hits many objects between misses.', null, 'p'),
            L('The two burst sizes are illustrative. With 12 or 3,000 hits the burst bit is set once, on hit 9, and the hand reaches the same verdicts on the same misses.', null, 'p'),
            L('The ring draws the queue of code/scb.py, as in part 01. Time is not to scale.', null, 'p'));
        },
      },
    ],
  });

  /* the scene: the ring, and the two objects the story follows */
  const ringBox = h('div', { class: 'scb-col' });
  const view = ring(ringBox, { bits: ['R', 'B'], objects: REST, label: 'Eight objects with a reference bit R and a burst bit B, and the eviction hand' });
  ringBox.append(h('ul', { class: 'scb-legend' },
    h('li', null, h('i', { class: 'k-ref' }), L('R: reference bit')), h('li', null, h('i', { class: 'k-burst' }), L('B: burst bit')),
    h('li', null, h('i', { class: 'k-hand' }), L('hand'))));

  const objRow = (k, role, tone) => {
    const bits = { R: h('span', { class: 'scb-bit', dataset: { b: 'R' } }, 'R'), B: h('span', { class: 'scb-bit', dataset: { b: 'B' } }, 'B') };
    const hits = h('b', null, '0');
    const passes = [1, 2, 3].map((n) => h('li', null, h('span', null, `pass ${n}`), h('b', null, '')));
    const el = h('div', { class: 'scb-obj', dataset: { k } },
      h('div', { class: 'scb-obj-head' }, h('span', { class: 'scb-obj-name' }, k), L(role, null, 'span', { class: 'scb-obj-role' })),
      h('div', { class: 'scb-obj-bits' }, bits.R, bits.B, h('span', { class: 'scb-hits' }, L('hits this pass '), hits)),
      h('ol', { class: 'scb-passes' }, passes));
    return { el, bits, hits, passes, tone };
  };
  const A = objRow('a', 'hit once', 'ref');
  const Cc = objRow('c', 'a burst', 'burst');
  const OBJ = { a: A, c: Cc };
  P.scene.append(h('div', { class: 'scb-burst-grid' }, ringBox, h('div', { class: 'scb-track-panel' }, A.el, Cc.el)));

  const showBits = (o, R, B) => { o.bits.R.classList.toggle('is-on', !!R); o.bits.B.classList.toggle('is-on', !!B); };
  const showPass = (o, n, text, tone) => { const li = o.passes[n - 1]; li.lastChild.textContent = text; li.dataset.tone = tone || ''; };

  const ro = PM.readouts(P, [
    { id: 'a', label: L('Passes survived · a (hit once)') },
    { id: 'c', label: L('Passes survived · c (burst)') },
    { id: 'extra', label: L('Extra passes from the burst') },
  ]);

  PM.segmented(P, {
    ariaLabel: 'Burst size',
    options: [{ id: '12', label: L('Burst of 12 hits') }, { id: '3000', label: L('Burst of 3,000 hits') }],
    value: '12',
    onChange(id) { burst = Number(id); player.reset(); },
  });

  const player = PM.player(P, {
    label: L('Play'),
    reset() {
      view.reset(REST);
      view.focus(0, 'ref'); view.focus(2, 'burst');
      view.tag(0, 'hit once', { dy: -44, tone: 'ref' }); view.tag(2, 'burst', { dx: 0, dy: 50, tone: 'burst' });
      view.hubText('before', 'any miss');
      for (const o of [A, Cc]) { showBits(o, 0, 0); o.hits.textContent = '0'; o.passes.forEach((li) => { li.lastChild.textContent = ''; li.dataset.tone = ''; li.classList.remove('is-extra'); }); }
      ro.reset();
    },
    async run(ctx) {
      const fmtN = (n) => PM.fmt.int(n);
      /* the hits */
      ctx.narrate(L('Object a is hit once: its reference bit R is set.'), 'info');
      await ctx.tween(800, (k) => { view.glow(0, 'ref', view.pulse(k)); view.lamp(0, 'R', k >= 0.5); showBits(A, k >= 0.5, 0); A.hits.textContent = k >= 0.5 ? '1' : '0'; });
      await ctx.sleep(900);
      ctx.narrate(L('Object c is hit again and again before the hand returns.'));
      await ctx.tween(1900, (k) => {                                 // hits 1 … k+1 (= 9), one every 210 ms
        const n = Math.floor(lerp(0, K + 1, k) + 1e-9);
        Cc.hits.textContent = fmtN(n); view.lamp(2, 'R', n >= 1); showBits(Cc, n >= 1, 0);
      });
      view.lamp(2, 'B', true); showBits(Cc, 1, 1);
      ctx.mark(L(`Hit ${K + 1}: c's burst bit is set`), 'warn');
      ctx.narrate(L(`Hit ${K + 1} exceeds k = ${K}: c's burst bit B is set.`), 'warn');
      await ctx.tween(1200, (k) => view.glow(2, 'burst', view.pulse(k)));
      if (burst > K + 1) {
        await ctx.tween(burst > 100 ? 1700 : 600, (k) => { Cc.hits.textContent = fmtN(Math.round(lerp(K + 1, burst, ease.in(k)))); });
      }
      ctx.narrate(L(`${fmtN(burst)} hits in all. B is still one bit.`));
      await ctx.sleep(1800);

      /* the sweep */
      ctx.narrate(L('Misses arrive. The hand moves on, in arrival order.'));
      const passOf = {};                                               // visits so far, per followed object
      let survivedA = 0, survivedC = 0;
      for (let m = 0; m < STORY.length; m++) {
        const miss = STORY[m];
        for (const v of miss.visits) {
          const lap = Math.floor(v.abs / 8) + 1;
          view.hubText(`miss ${m + 1}`, `pass ${lap}`);
          view.atHand(v.slot);
          const followed = OBJ[v.name] || null;             // new objects (i … x) never reuse a or c
          if (followed) {
            const n = passOf[v.name] = (passOf[v.name] || 0) + 1;
            if (v.act === 'evict') {
              const extra = v.name === 'c';
              ctx.narrate(L(extra ? `Pass ${n}: c has no bit left. Evicted one pass after a.` : `Pass ${n}: a has no bit left, so a is evicted.`), 'err');
              ctx.mark(L(extra ? `Pass ${n}: c evicted, one pass after a` : `Pass ${n}: a evicted`), 'err');
              showPass(followed, n, 'evicted', 'err');
              await ctx.tween(1500, (k) => { view.glow(v.slot, 'err', view.pulse(k)); view.out(v.slot, k); });
              if (extra) { ro.set('c', survivedC, 'ok'); ro.set('extra', survivedC - survivedA, 'ok'); } else ro.set('a', survivedA);
              view.focus(v.slot, null); view.tag(v.slot, '');
            } else {
              const bit = v.act;                                        // 'B' first, then 'R'
              const what = bit === 'B' ? 'its B first' : 'its R';
              ctx.narrate(L(`Pass ${n}: the hand clears ${v.name}'s ${what}; ${v.name} stays.`), 'ok');
              ctx.mark(L(`Pass ${n}: ${v.name} stays, ${bit} cleared`), 'ok');
              if (v.name === 'a') survivedA += 1; else survivedC += 1;
              showPass(followed, n, `${bit} cleared · stays`, 'ok');
              if (v.name === 'c' && n === 2) followed.passes[1].classList.add('is-extra');
              await ctx.tween(1500, (k) => {
                view.glow(v.slot, 'ok', view.pulse(k)); view.lamp(v.slot, bit, k < 0.5);
                if (k >= 0.5) showBits(followed, bit === 'R' ? 0 : 1, 0); else showBits(followed, 1, bit === 'B' ? 1 : 0);
                if (k >= 0.5) followed.hits.textContent = '0';            // the hand resets the count (meta[2] = 0)
              });
              await ctx.tween(300, (k) => view.hand(lerp(v.abs, v.abs + 1, ease.inOut(k))));
              continue;
            }
          } else {
            await ctx.tween(220, (k) => view.out(v.slot, k));             // an object nobody hit: evicted at once
          }
          /* an eviction: the new object takes the freed slot, the hand moves on */
          view.set(v.slot, { name: miss.name, R: 0, B: 0 });
          await ctx.tween(260, (k) => { view.in(v.slot, k); view.hand(lerp(v.abs, v.abs + 1, ease.inOut(k))); });
        }
      }
      view.atHand(null);
      ctx.narrate(L('Two bits, one cleared per pass: exactly one extra pass.'), 'ok');
      await ctx.sleep(2400);
    },
  });
});
