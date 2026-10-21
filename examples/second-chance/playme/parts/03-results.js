/* Part 03 · results — the four rows of Paper Table 1, one lane each, on one 0-100% scale. Pattern: Race over the
 * paper's printed numbers (no simulated counts). Every value comes from facts.json and carries data-fact. */
PM.register('results', (host) => {
  const { h, L, ease } = PM;
  const { paperRef, quote, fact } = window.SCB;
  const F = window.FACTS.facts;
  const pct = (key) => parseFloat(F[key].value);                       // bar length only; the text stays as printed

  const LANES = [
    { id: 'fifo', name: 'FIFO', what: 'keeps no bit' },
    { id: 'sc', name: 'Second chance', what: 'a reference bit' },
    { id: 'scb', name: 'SCB', what: 'a reference bit and a burst bit', ours: true },
    { id: 'lru', name: 'LRU', what: 'moves the object on every hit' },
  ];

  const lead = [L('Paper Table 1: a '), fact('trace.hours'), L(' news-site trace, '), fact('trace.requests'),
    L(' requests over '), fact('trace.objects'), L(' objects, a cache of '), fact('trace.cache'), L(' of the objects.')];
  const takeaway = h('span', null, h('q', { class: 'pm-quote', dataset: { quote: 'concl' } }, window.FACTS.quotes.concl.en),
    L(` (${paperRef('sec-concl')})`));

  const P = PM.part(host, {
    id: 'results',
    eyebrow: L(`Results · ${paperRef('tab-main')}`),
    q: L("How close does SCB come to LRU's hit rate, and at what cost?"),
    lead,
    takeaway,
    source: [{ kind: 'paper', text: L(`Numbers from ${paperRef('tab-main')}`) }],
    folds: [
      {
        title: L('What the paper measured'),
        teaser: L(`${paperRef('tab-main')} as printed, and the trace behind it.`),
        render(el) {
          const row = (name, a, b) => h('tr', null, h('th', { scope: 'row' }, name), h('td', null, a), h('td', null, b));
          el.append(quote('tab.caption'),
            h('div', { class: 'scb-table-wrap' }, h('table', { class: 'scb-table' },
              h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Policy'), h('th', { scope: 'col' }, 'Hit rate'), h('th', { scope: 'col' }, 'Updates per hit'))),
              h('tbody', null,
                row('FIFO', fact('hit.fifo'), fact('upd.fifo')), row('Second chance', fact('hit.sc'), fact('upd.sc')),
                row('SCB (ours)', fact('hit.scb'), fact('upd.scb')), row('LRU', fact('hit.lru'), fact('upd.lru'))))),
            quote('eval.trace'));
        },
      },
      {
        title: L('Why LRU updates on every hit'),
        teaser: L(`${paperRef('sec-intro')}: the cost of tracking recency exactly.`),
        render(el) { el.append(quote('lru.cost')); },
      },
    ],
  });

  /* the scene: a header with the two scales, then one lane per policy */
  const scale = (label) => h('div', { class: 'scb-scale' }, L(label, null, 'span', { class: 'scb-scale-name' }),
    h('span', { class: 'scb-scale-ticks', 'aria-hidden': 'true' }, h('i', null, '0%'), h('i', null, '50%'), h('i', null, '100%')));
  const head = h('div', { class: 'scb-lane scb-lane-head', 'aria-hidden': 'true' }, h('span'), scale('Hit rate'), scale('Updates per hit'));
  const bar = (key, cls) => {
    const fill = h('i', { class: 'scb-fill' });
    const val = h('b', { class: 'scb-val' }, fact(key));
    return { el: h('div', { class: ['scb-bar', cls] }, h('span', { class: 'scb-bar-track' }, fill), val), fill, val, key };
  };
  for (const l of LANES) {
    l.hit = bar(`hit.${l.id}`, 'is-hit');
    l.upd = bar(`upd.${l.id}`, 'is-upd');
    l.el = h('div', { class: ['scb-lane', l.ours && 'is-ours'] },
      h('div', { class: 'scb-lane-name' }, h('b', null, l.name), L(l.what, null, 'span')),
      l.hit.el, l.upd.el);
  }
  P.scene.append(h('div', { class: 'scb-lanes' }, head, ...LANES.map((l) => l.el)));

  const show = (b, k) => { b.fill.style.width = `${(pct(b.key) * k).toFixed(2)}%`; b.val.style.opacity = k >= 1 ? '1' : '0'; };

  const ro = PM.readouts(P, [
    { id: 'scb', label: L('Hit rate · SCB') },
    { id: 'lru', label: L('Hit rate · LRU') },
    { id: 'upd', label: L('Updates per hit · SCB vs LRU') },
  ]);

  PM.player(P, {
    label: L('Show the results'),
    reset() { for (const l of LANES) { show(l.hit, 0); show(l.upd, 0); } ro.reset(); },
    async run(ctx) {
      ctx.narrate(L('Each lane is one row of Paper Table 1.'));
      await ctx.sleep(1500);
      ctx.narrate(L('First the hit rate, all four policies on one scale.'), 'info');
      await ctx.tween(2200, (k) => LANES.forEach((l) => show(l.hit, k)), ease.out);
      ro.set('scb', fact('hit.scb'), 'ok').set('lru', fact('hit.lru'));
      ctx.mark(L(`Hit rate: SCB ${F['hit.scb'].value}, LRU ${F['hit.lru'].value}`), 'ok');
      ctx.narrate(L(`SCB reaches ${F['hit.scb'].value}, close to LRU at ${F['hit.lru'].value}.`), 'ok');
      await ctx.sleep(2400);
      ctx.narrate(L('Then the metadata updates per hit.'), 'warn');
      await ctx.tween(2200, (k) => LANES.forEach((l) => show(l.upd, k)), ease.out);
      ro.set('upd', h('span', null, fact('upd.scb'), ' vs ', fact('upd.lru')), 'warn');
      ctx.mark(L(`Updates per hit: SCB ${F['upd.scb'].value}, LRU ${F['upd.lru'].value}`), 'warn');
      ctx.narrate(L(`LRU updates on every hit; SCB on ${F['upd.scb'].value} of hits.`), 'warn');
      await ctx.sleep(2600);
    },
  });
});
