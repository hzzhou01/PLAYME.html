/* Shared scene for parts 01 and 02: eight cached objects on a ring, in arrival order, and the eviction hand.
 *
 * SCB.plan() is a line-by-line port of SCBCache.evict() in code/scb.py (lines 29-40). The code keeps a queue: the
 * hand is the front, a skipped object moves to the back, a new object is appended. A ring shows the same order: the
 * new object takes the freed slot, which the hand reaches last. Every setter below is a pure state change, so the
 * players can seek, replay and capture (no CSS transition carries meaning). */
window.SCB = (function () {
  const PM = window.PM;
  const N = 8, VB = 420, C = 210, RAD = 140, T = 64;
  const ang = (i) => (i * 45 - 90) * Math.PI / 180;
  const at = (i, r = RAD) => [C + r * Math.cos(ang(i)), C + r * Math.sin(ang(i))];

  /** Port of evict(): returns {visits, slot}. mode 'fifo' reads no bit, 'sc' only R, 'scb' B then R. */
  function evict(slots, hand, mode) {
    const visits = [];
    for (;;) {
      const o = slots[hand];
      if (mode === 'scb' && o.B) { o.B = 0; o.hits = 0; visits.push({ slot: hand, act: 'B', name: o.name }); }          // a burst buys one extra pass
      else if (mode !== 'fifo' && o.R) { o.R = 0; o.hits = 0; visits.push({ slot: hand, act: 'R', name: o.name }); }    // second chance
      else { visits.push({ slot: hand, act: 'evict', name: o.name, hit: !!o.hit }); return { visits, slot: hand }; }
      hand = (hand + 1) % N;
    }
  }

  /** The misses of a story: each new name evicts one object; the hand ends one slot past the freed slot. */
  function plan(initial, newNames, mode) {
    const slots = initial.map((o) => ({ ...o }));
    let hand = 0, abs = 0;
    return newNames.map((name) => {
      const { visits, slot } = evict(slots, hand, mode);
      const steps = visits.map((v, i) => ({ ...v, abs: abs + i }));           // unwrapped hand position at each visit
      slots[slot] = { name, R: 0, B: 0, hits: 0, isNew: true };
      abs += visits.length; hand = (slot + 1) % N;
      return { name, visits: steps, slot, handAfter: abs };
    });
  }

  const svg = (tag, attrs, ...kids) => PM.s(tag, attrs, ...kids);

  /** ring(parent, {bits: ['R'] | ['R','B'] | ['hit'], label}) → view with pure setters */
  function ring(parent, { bits = ['R'], label, objects }) {
    const tiles = [];
    const root = svg('svg', { class: 'scb-ring', viewBox: `0 0 ${VB} ${VB}`, role: 'img', 'aria-label': label || 'Eight cached objects on a ring and the eviction hand' });
    root.append(svg('circle', { class: 'scb-track', cx: C, cy: C, r: RAD }));
    for (let i = 0; i < N; i++) {                                              // chevrons: the direction of arrival order
      const [x, y] = at(i + 0.5);
      root.append(svg('path', { class: 'scb-chev', d: 'M-4 -6 L3 0 L-4 6', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${i * 45 + 22.5})` }));
    }
    const hand = svg('g', { class: 'scb-hand' },
      svg('path', { class: 'scb-hand-arm', d: `M${C - 4} ${C - 56} L${C} ${C - 104} L${C + 4} ${C - 56} Z` }),
      svg('path', { class: 'scb-hand-tip', d: `M${C - 9} ${C - 96} L${C} ${C - 112} L${C + 9} ${C - 96} Z` }));
    root.append(hand);
    const hub = svg('g', { class: 'scb-hub' }, svg('circle', { cx: C, cy: C, r: 54 }));
    const c1 = svg('text', { class: 'scb-hub-1', x: C, y: C - 6 });
    const c2 = svg('text', { class: 'scb-hub-2', x: C, y: C + 16 });
    hub.append(c1, c2);
    root.append(hub);
    const lampW = bits[0] === 'hit' ? 30 : 19;
    for (let i = 0; i < N; i++) {
      const [x, y] = at(i);
      const glow = svg('rect', { class: 'scb-glow', x: -T / 2 - 6, y: -T / 2 - 6, width: T + 12, height: T + 12, rx: 17 });
      const box = svg('rect', { class: 'scb-box', x: -T / 2, y: -T / 2, width: T, height: T, rx: 13 });
      const name = svg('text', { class: 'scb-name', y: bits.length ? -2 : 8 });
      const lamps = {};
      const lampRow = svg('g', { class: 'scb-lamps', transform: 'translate(0 19)' });
      bits.forEach((b, j) => {
        const dx = (j - (bits.length - 1) / 2) * (lampW + 5);
        const g = svg('g', { class: ['scb-lamp', `scb-lamp-${b}`], transform: `translate(${dx} 0)` },
          svg('rect', { x: -lampW / 2, y: -7, width: lampW, height: 14, rx: 4 }),
          svg('text', { y: 3.6 }, b === 'hit' ? 'hit' : b));
        lamps[b] = g; lampRow.append(g);
      });
      const inner = svg('g', { class: 'scb-in' }, glow, box, name, lampRow);
      const tag = svg('text', { class: 'scb-tag' });
      const g = svg('g', { class: 'scb-slot', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, inner, tag);
      root.append(g);
      tiles.push({ g, inner, glow, box, name, lamps, tag });
    }
    parent.append(root);

    const view = {
      el: root,
      /** set(i, {name, R, B, hit}) — the object in slot i and its lamps */
      set(i, o) {
        const t = tiles[i];
        t.name.textContent = o.name;
        for (const b of bits) t.lamps[b].classList.toggle('is-on', !!o[b === 'hit' ? 'hit' : b]);
        return view;
      },
      lamp(i, b, on) { tiles[i].lamps[b].classList.toggle('is-on', !!on); return view; },
      /** glow(i, tone, a) — a toned outline at opacity a (0..1) */
      glow(i, tone, a) {
        const t = tiles[i];
        t.glow.setAttribute('data-tone', tone || '');
        t.glow.style.opacity = String(PM.clamp(a, 0, 1));
        return view;
      },
      /** pulse(k): fade in, hold, fade out over k = 0..1 */
      pulse(k) { return k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1; },
      /** out(i, k) — the object leaves (k 0..1); in(i, k) — a new object arrives */
      out(i, k) { const t = tiles[i]; t.inner.style.opacity = String(1 - k); t.inner.setAttribute('transform', `scale(${1 - 0.45 * k})`); t.box.classList.toggle('is-evicting', k > 0); return view; },
      in(i, k) { const t = tiles[i]; t.inner.style.opacity = String(k); t.inner.setAttribute('transform', `scale(${0.6 + 0.4 * k})`); t.box.classList.remove('is-evicting'); return view; },
      /** focus(i, tone | null) — a persistent outline for an object the story follows */
      focus(i, tone) { tiles[i].box.setAttribute('data-focus', tone || ''); return view; },
      /** tag(i, text, {dx, dy}) — a small label next to slot i */
      tag(i, text, { dx = 0, dy = -44, tone } = {}) {
        const t = tiles[i].tag;
        t.textContent = text || '';
        t.setAttribute('x', dx); t.setAttribute('y', dy);
        t.setAttribute('data-tone', tone || '');
        return view;
      },
      /** hand(pos) — pos in slots, continuous and unwrapped (8 = one full pass) */
      hand(pos) { hand.setAttribute('transform', `rotate(${(pos * 45).toFixed(2)} ${C} ${C})`); return view; },
      /** atHand(i | null) — the slot the hand points at */
      atHand(i) { tiles.forEach((t, j) => t.box.classList.toggle('is-at', j === i)); return view; },
      hubText(a, b) { c1.textContent = a || ''; c2.textContent = b || ''; return view; },
      reset(objs) {
        objs.forEach((o, i) => { view.set(i, o); view.glow(i, null, 0); view.in(i, 1); view.focus(i, null); view.tag(i, ''); });
        view.hand(0); view.atHand(0);
        return view;
      },
    };
    if (objects) view.reset(objects);
    return view;
  }

  /** The source of evict() in code/scb.py, verbatim (lines 29-40). */
  const EVICT_SRC = [
    'def evict(self):',
    '    while True:',
    '        key, meta = next(iter(self.items.items()))',
    '        if meta[1]:',
    '            meta[1] = 0            # a burst buys one extra pass',
    '        elif meta[0]:',
    '            meta[0] = 0            # second chance',
    '        else:',
    '            del self.items[key]',
    '            return key',
    '        meta[2] = 0',
    '        self.items.move_to_end(key)',
  ].join('\n');

  /** Paper reference label from facts.json: "Paper §2.1". */
  const paperRef = (id) => 'Paper ' + window.FACTS.refs[id].en;
  /** A quote block from facts.json, checked verbatim by fidelity.py (data-quote = quote id). */
  function quote(id) {
    const q = window.FACTS.quotes[id];
    return PM.h('blockquote', { class: 'scb-quote' },
      PM.h('q', { class: 'pm-quote', dataset: { quote: id } }, q.en),
      PM.h('span', { class: 'scb-cite' }, paperRef(q.ref)));
  }
  /** A number from facts.json, marked for fidelity.py. */
  const fact = (key) => PM.h('span', { dataset: { fact: key } }, window.FACTS.facts[key].value);

  return { N, plan, ring, EVICT_SRC, paperRef, quote, fact };
})();
