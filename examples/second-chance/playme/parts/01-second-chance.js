/* Part 01 · second-chance — FIFO (left, the familiar baseline) and second chance (right) on the same eight objects,
 * the same three misses, one clock. Pattern: Two worlds. Paper §2.1; FIFO from the Abstract.
 * Start state: the eight objects a-h and their reference bits from one eviction recorded from code/scb.py on a
 * 20-request toy trace (runs/sweep-example.json, bits_before[*][0]). The first miss reproduces that recording. */
PM.register('second-chance', (host) => {
  const { h, L, lerp, ease } = PM;
  const { plan, ring, EVICT_SRC, paperRef, quote } = window.SCB;

  const START = [['a', 1], ['b', 0], ['c', 1], ['d', 0], ['e', 1], ['f', 0], ['g', 0], ['h', 1]]
    .map(([name, r]) => ({ name, R: r, hit: r }));
  const NEW = ['i', 'j', 'k'];
  const FIFO = plan(START, NEW, 'fifo');
  const SC = plan(START, NEW, 'sc');

  const P = PM.part(host, {
    id: 'second-chance',
    eyebrow: L(`Second chance · ${paperRef('sec-sc')}`),
    q: L('The cache is full. Which object does the eviction hand remove?'),
    lead: L('Same eight objects, same three misses. Marked objects were hit after they arrived.'),
    takeaway: L('The hand skips an object whose bit is set and clears the bit. FIFO evicts the oldest object, hit or not.'),
    source: [
      { kind: 'sim', text: L('Simulation for illustration · built from code/scb.py') },
      { kind: 'paper', text: L(`based on ${paperRef('sec-sc')}`) },
    ],
    folds: [
      {
        title: L('How the code works'),
        teaser: L('evict() in code/scb.py: a set bit is cleared, not evicted.'),
        render(el) {
          PM.intent(el, L('When the cache is full: clear each set bit on the way, evict the first object with a clear bit.'));
          PM.code(el, {
            lang: 'python', title: 'code/scb.py', src: EVICT_SRC, start: 29,
            focus: ['elif meta[0]:', 'meta[0] = 0'], marks: { 32: 'dim', 33: 'dim' },
          });
          el.append(L('meta[0] is the reference bit. The dimmed lines handle the burst bit; part 02 plays them.', null, 'p'));
        },
      },
      {
        title: L('What the paper says'),
        teaser: L(`${paperRef('sec-sc')} and ${paperRef('fig-hand')}, in the paper's words.`),
        render(el) { el.append(quote('sc.rule'), quote('fig.caption'), quote('fifo.abstract')); },
      },
      {
        title: L('About this simulation'),
        teaser: L('Where the starting bits come from, and what the ring stands for.'),
        render(el) {
          el.append(
            L(`The eight objects and their reference bits come from ${window.FACTS.runs.scope.en}. In that recording the hand passed a and evicted b, as on the first miss here. The next two misses use the same code.`, null, 'p'),
            L('code/scb.py keeps the objects in a queue. The hand is the front of the queue; a skipped object moves to the back, behind the newest one. The ring draws the same order: a new object takes the freed slot, which the hand reaches last.', null, 'p'),
            L('FIFO keeps no bit. On the left, the hit marks only show which objects were hit; FIFO never reads them. Time is not to scale.', null, 'p'));
        },
      },
    ],
  });

  /* the scene: two columns, one ring each */
  const col = (label, rule, bits) => {
    const c = h('div', { class: 'scb-col' }, L(label, null, 'p', { class: 'scb-side-label' }), L(rule, null, 'p', { class: 'scb-side-rule' }));
    const view = ring(c, { bits, objects: START, label: `${label}: eight objects on a ring and the eviction hand` });
    return { c, view };
  };
  const left = col('FIFO', 'Evicts the object at the hand: the oldest.', ['hit']);
  const right = col('Second chance', 'Skips an object whose bit is set, once.', ['R']);
  left.c.append(h('ul', { class: 'scb-legend' },
    h('li', null, h('i', { class: 'k-hit' }), L('hit (FIFO keeps no bit)')), h('li', null, h('i', { class: 'k-hand' }), L('hand'))));
  right.c.append(h('ul', { class: 'scb-legend' },
    h('li', null, h('i', { class: 'k-ref' }), L('R: reference bit, set by a hit')), h('li', null, h('i', { class: 'k-hand' }), L('hand'))));
  P.scene.append(h('div', { class: 'scb-two' }, left.c, right.c));

  const ro = PM.readouts(P, [
    { id: 'fifo', label: L('Hit objects evicted · FIFO') },
    { id: 'sc', label: L('Hit objects evicted · second chance') },
    { id: 'chances', label: L('Second chances given') },
  ]);

  const hubAt = (view, n, name) => view.hubText(n ? `miss ${n}` : 'full', n ? `${name} arrives` : '8 of 8');

  PM.player(P, {
    label: L('Run both'),
    reset() {
      for (const s of [left, right]) { s.view.reset(START); hubAt(s.view, 0); }
      ro.reset();
    },
    async run(ctx) {
      let fifoHits = 0, chances = 0;
      ctx.narrate(L('Both caches are full. Each miss needs a free slot.'));
      await ctx.sleep(1900);
      for (let m = 0; m < NEW.length; m++) {
        const pace = m === 0 ? 1 : 0.72;                       // the first miss slowly, the next two a little faster
        const name = NEW[m];
        hubAt(left.view, m + 1, name); hubAt(right.view, m + 1, name);
        ctx.narrate(L(`Miss ${m + 1}: object ${name} needs a slot.`));
        await ctx.sleep(1100 * pace);

        /* left: FIFO evicts the object at the hand, whatever it is */
        const f = FIFO[m].visits[0];
        if (f.hit) {
          fifoHits += 1;
          ctx.narrate(L(`FIFO evicts ${f.name}, the oldest, though ${f.name} was hit.`), 'err');
          ctx.mark(L(`FIFO evicts ${f.name}, a hit object`), 'err');
        } else {
          ctx.narrate(L(`FIFO evicts ${f.name}, the oldest object.`));
        }
        await ctx.tween(1000 * pace, (k) => { left.view.glow(f.slot, f.hit ? 'err' : null, left.view.pulse(k)); left.view.out(f.slot, k); });
        ro.set('fifo', fifoHits, fifoHits ? 'err' : null);
        left.view.set(f.slot, { name, hit: 0 });
        await ctx.tween(520 * pace, (k) => { left.view.in(f.slot, k); left.view.hand(lerp(f.abs, f.abs + 1, ease.inOut(k))); });
        left.view.atHand((f.slot + 1) % 8);
        await ctx.sleep(500 * pace);

        /* right: second chance clears set bits on the way, evicts the first clear one */
        for (const v of SC[m].visits) {
          right.view.atHand(v.slot);
          if (v.act === 'R') {
            chances += 1;
            ctx.narrate(L(`${v.name}'s reference bit is set: the hand clears it, moves on.`), 'ok');
            ctx.mark(L(`Second chance for ${v.name}`), 'ok');
            await ctx.tween(1300 * pace, (k) => { right.view.glow(v.slot, 'ok', right.view.pulse(k)); right.view.lamp(v.slot, 'R', k < 0.5); });
            ro.set('chances', chances);
            await ctx.tween(480 * pace, (k) => right.view.hand(lerp(v.abs, v.abs + 1, ease.inOut(k))));
          } else {
            ctx.narrate(L(`${v.name}'s bit is clear, so the hand evicts ${v.name}.`));
            await ctx.tween(1000 * pace, (k) => right.view.out(v.slot, k));
            right.view.set(v.slot, { name, R: 0 });
            ro.set('sc', 0, 'ok');
            await ctx.tween(520 * pace, (k) => { right.view.in(v.slot, k); right.view.hand(lerp(v.abs, v.abs + 1, ease.inOut(k))); });
            right.view.atHand((v.slot + 1) % 8);
          }
        }
        await ctx.sleep(700 * pace);
      }
      ctx.narrate(L('FIFO evicted two hit objects. Second chance evicted none.'), 'ok');
      await ctx.sleep(2200);
    },
  });
});
