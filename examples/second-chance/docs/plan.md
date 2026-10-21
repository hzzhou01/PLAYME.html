# PLAYME plan: Second Chance with Bursts (SCB)

Sources: paper/main.tex (single version, no arXiv id), code/scb.py, runs/sweep-example.json.  Languages: en.
Audience: systems readers who know what a cache is and have seen FIFO and LRU.
Highlights named by the authors: (1) how the eviction hand gives objects a second chance; (2) why a burst gets
exactly one extra pass.
Must not appear: anything not in the paper (no CLOCK / LFU naming, no computed gap ratio, no derived cache size),
author notes (they live in docs/authors.md), absolute file paths.

Workflow
- [x] 1 Intake    sources read in full; highlights given by the user; English only; nothing private in the run file
- [x] 2 Facts     facts.json, words.json, run catalogue (below), privacy scan (run file: letters and bits only)
- [x] 3 Plan      this file; the user approved in advance ("assume I approve your plan")
- [x] 4 Build     starter + kit (core only, no desk, no 3D), one part per file; facts.json read by PM.boot (inlined by bundle.py)
- [x] 5 Check     lint.mjs PASS (1440, 400; reduced), fidelity.py PASS (1 warning inside a verbatim quote), screenshots in qa/
- [x] 6 Review    no author round in this run; open questions in docs/authors.md, decisions in docs/ledger.md
- [x] 7 Ship      bundle.py --offline -> PLAYME.html (315 KB); lint --offline-file PASS
- [ ] 8 Promote   skipped (optional)

Run catalogue
- runs/sweep-example.json: one eviction recorded from code/scb.py on a 20-request toy trace (eight objects a-h, their
  reference and burst bits, evicted b). It backs no table. Paper Fig. 1 ("Eviction hand over eight objects") has no
  drawn content in the .tex, so the file cannot be confirmed as the figure's data (asked in docs/authors.md).
  Use: the starting reference bits of part 01, named as recorded in the simulation fold. Never called a "real run" of
  the paper's evaluation.
- The 24-hour news trace (Paper §3, Table 1): no runs on disk. Its numbers appear only as printed in Table 1.

## Parts, in reading order (familiar -> core contribution -> architecture -> evidence)

### 01 second-chance - Second chance (Paper §2.1)
- Claim (with location): "An object whose bit is set gets a second chance: the hand clears the bit and moves on. The
  first object found with a clear bit is evicted." (Paper §2.1); FIFO "evicts popular objects that happened to arrive
  early" (Paper Abstract)
- Pattern: Two worlds (FIFO = the familiar baseline, left; second chance, right), same objects, same misses, one clock
- Question: The cache is full. Which object does the eviction hand remove? (11 words)
- Scene at rest: two rings of the same eight objects a-h in arrival order, hand at a. Objects a, c, e, h carry a lit
  reference bit (hit since they arrived; bits as recorded). Left label "FIFO: evicts the object at the hand"; right
  label "Second chance: skips a set bit once". Three new objects i, j, k wait in a queue.
- Primary action: "Run both"; options: none
- What changes: three misses. Left evicts a, b, c (a and c had been hit: flash err). Right skips a (clears its bit,
  flash ok), evicts b; skips c, evicts d; skips e, evicts f. Marks: each second chance (ok), each hit object FIFO
  evicts (err).
- Code shown with the animation: in the fold, evict() verbatim from code/scb.py (lines 29-40); decisive token
  `elif meta[0]:` / `meta[0] = 0`; burst lines dimmed (next part)
- Outcome readouts: "Hit objects evicted · FIFO" (2, err) · "Hit objects evicted · second chance" (0, ok) ·
  "Second chances given" (3)
- Takeaway: The hand skips an object whose bit is set and clears the bit. FIFO evicts the oldest object, hit or not.
- Folds: How the code works · What the paper says · About this simulation
- Source line: Simulation for illustration · built from code/scb.py · based on Paper §2.1
- Facts used: refs sec-sc, abstract, fig-hand; quotes sc.rule, fifo.abstract

### 02 burst - Bursts (Paper §2.2), the core contribution
- Claim: "The hand clears the burst bit first and the reference bit on its next pass, so a burst buys exactly one
  extra pass." (Paper §2.2)
- Pattern: Two worlds inside one ring (object a hit once vs object c hit in a burst), with the hand sweeping several
  passes; the option is a second burst size that must give the same answer
- Question: Why does a burst get exactly one extra pass of the hand? (11 words)
- Scene at rest: one ring of eight objects a-h, hand at a. Each object shows two bit lamps: R (reference) and B
  (burst). In-scene notes: "a: hit once", "c: a burst". A hit counter for c reads 0.
- Primary action: "Play"; option (1): segmented "Burst: 12 hits | 3,000 hits"
- What changes: c's hit counter runs up; at hit 9 (more than k = 8) its B lamp lights. Then misses arrive and the hand
  sweeps. Marks: pass 1 clears a's R (a survives) and c's B (c survives); pass 2 evicts a, clears c's R; pass 3
  evicts c. With 3,000 hits the marks fall on the same misses.
- Code: fold, evict() verbatim; decisive token `if meta[1]:` / `meta[1] = 0`
- Outcome readouts: "Passes survived · a (hit once)" 1 · "Passes survived · c (burst)" 2 · "Misses until c leaves" 16
- Takeaway: The hand clears one bit per pass, so a burst buys exactly one extra pass, however many hits it had.
- Folds: How the code works · What the paper says · About this simulation
- Source line: Simulation for illustration · built from code/scb.py · based on Paper §2.2
- Facts used: burst.k; refs sec-burst; quotes burst.rule, burst.def

### 03 results - What the paper measured (Paper Table 1), the evidence
- Claim: SCB raises the hit rate from 61.2% (FIFO) to 74.8%, close to LRU (75.9%), while updating metadata on only
  3.1% of hits (Paper Abstract, Table 1)
- Pattern: Race over the paper's printed numbers (four policies, one lane each, two bars). No simulated counts.
- Question: How close does SCB come to LRU's hit rate, and at what cost? (12 words)
- Scene at rest: four lanes in Table 1 order (FIFO, Second chance, SCB, LRU), empty bars on one 0-100% scale for
  "Hit rate" and "Updates per hit"
- Primary action: "Show the results"; options: none
- What changes: each lane fills to its printed values; marks on SCB (hit rate) and LRU (updates per hit 100%)
- Outcome readouts: "Hit rate · SCB" 74.8% · "Hit rate · LRU" 75.9% · "Updates per hit · SCB" 3.1% (data-fact)
- Takeaway (quote, Paper §4): "Two bits per object recover most of LRU's hit rate on bursty traffic without updating
  metadata on every hit."
- Folds: What the paper measured (Table 1 as printed, trace setup) · Why LRU updates on every hit
- Source line: Numbers from Paper Table 1
- Facts used: hit.*, upd.*, trace.*

## Open questions for the authors
- See docs/authors.md (not shipped). Decisions taken without an answer are listed there too.
