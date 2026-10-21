# Example: Second Chance (built blind)

A test of the skill on a project it had never seen. `paper/`, `code/` and `runs/` are a small toy research project
written for the test (a cache eviction policy). A fresh agent was given only the skill's `SKILL.md` and the request
"turn this project into a PLAYME; readers should try how the eviction hand gives objects a second chance and why
bursts get exactly one extra pass". In about 20 minutes it planned, built and checked this page.

| file | what it is |
|---|---|
| `PLAYME.html` | the page, one offline file (double-click it) |
| `playme/` | its source: three parts, `facts.json`, `words.json`, the kit |
| `docs/plan.md` | the plan the agent wrote before building |
| `docs/authors.md` | what it would ask the authors; it is never loaded by the page |
| `paper/main.tex`, `code/scb.py`, `runs/` | the toy project |

The toy paper contains a deliberate inconsistency: §3 says SCB "closes 79% of the gap" between FIFO and LRU, while
Table 1 gives (74.8 − 61.2) / (75.9 − 61.2) ≈ 93%. The agent did not put either figure on the page; it listed the
mismatch in `docs/authors.md`, as `references/fidelity.md` asks. It also flagged that `code/scb.py` updates a counter
on every hit, which disagrees with the abstract.

After the test, the example was moved onto the released kit (fonts, `facts.json` loading) and one caption was
shortened to the 12-word budget.
