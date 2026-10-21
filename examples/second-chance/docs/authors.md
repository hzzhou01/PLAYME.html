# Notes for the authors (never loaded by the page)

Per references/fidelity.md §8: what the page would show, where it is in the paper, what the code or runs say, what we
propose. Nothing below appears on the page.

1. "79% of the gap" does not follow from Table 1.
   - Paper §3: "Table 1 shows that SCB closes 79\% of the gap between FIFO and LRU."
   - Table 1: (74.8 - 61.2) / (75.9 - 61.2) = 13.6 / 14.7 = 92.5%. Second chance alone closes 70.1%. Neither is 79%.
   - Page: shows neither number. Propose: correct the sentence, or say which quantity 79% is.

2. Code updates metadata on every hit, paper says 3.1% of hits.
   - Abstract: "updating metadata on only 3.1\% of hits instead of every hit"; §4: "without updating metadata on every
     hit"; Table 1 "Updates per hit" SCB 3.1%.
   - code/scb.py:17 `meta[2] += 1` runs on every hit (a per-object hit counter that the burst test needs).
   - Page: shows evict() only, never get(); prints 3.1% as in Table 1. Propose: say whether the counter is excluded from
     "metadata updates" (and why), or how the burst test is implemented without a per-hit write.

3. "Two bits per object" vs a per-object counter.
   - Abstract "one reference bit and one burst bit per object"; §4 "Two bits per object".
   - code/scb.py:10 keeps [ref_bit, burst_bit, hits_this_sweep]; detecting "more than k=8 times" needs at least a
     4-bit counter per object.
   - Page: says "two bits" only where it quotes the paper. Propose: state the counter's size or how it is shared.

4. Motivation and mechanism of the burst bit point in opposite directions (§2.2).
   - "A plain reference bit keeps such an object alive long after its burst." Then the burst bit gives the object one
     extra pass, i.e. a burst object stays one pass longer than under a plain reference bit, not shorter.
   - Page: quotes only the mechanism sentence ("The hand clears the burst bit first ..."), not the motivation sentence.
     Propose: clarify what the burst bit is compared against (e.g. a counter that keeps the object for as many passes
     as it had hits).

5. "sweep" and "pass" for the hand's round trip.
   - §2.2 "within one sweep of the hand" / "on its next pass" / "one extra pass"; Fig. 1 caption "one pass"; §3
     "Figure 1 illustrates one sweep".
   - Page: uses "pass" in its own words; quotes keep "sweep". Propose: one term, or define both.

6. Run catalogue: which data is Figure 1?
   - Fig. 1 "Eviction hand over eight objects" has no drawing in main.tex. runs/sweep-example.json holds eight objects
     a-h and one eviction ("recorded from code/scb.py on a 20-request toy trace").
   - Page: uses the file's reference bits as the start state of a labelled simulation (part 01), and says where they
     come from; it does not call it Fig. 1. Propose: confirm whether Fig. 1 shows this sweep.

7. Small: code/scb.py `put()` does not check whether the key is already cached (a put of a cached key resets its bits
   and grows nothing). Not shown on the page.

Decisions taken without an answer (the user approved the plan in advance)
- No computed numbers on the page: no gap ratio, no cache size in objects (5% of 2.6 million), no per-1,000-hit counts.
- "Burst: 3,000 hits" in part 02 is an illustrative size ("thousands of times", §2.2); labelled as a simulation.
