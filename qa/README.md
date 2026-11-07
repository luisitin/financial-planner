# qa/

Invented households and checks. No real names, balances or addresses live here (AGENTS.md rule 15).

| Folder or file | What it is |
|---|---|
| `households/` | 1,400 invented plans, one folder per household, and `run.mjs`, which runs the pages over them |
| `fixtures/` | the personas Get started's tests use (`setup-personas.mjs`, `round8-households.mjs`, `familyPlan`) |
| `expected/` | answer keys for pages whose figures are checked by hand |
| `smoke-all.mjs` | every usable page on a phone, for render failures |
| `guess-sanity.mjs`, `guess-sanity-rules.json` | **the sanity check for guesses** (below) |

## Is every guess believable for the household? (guess sanity)

A guess or a default must be one a layperson believes for their own household: age, couple or single, children, owner or
renter, pay, state, and what they typed. A 25-year-old couple must not be told their mortgage has 12 years left; a
retired person must not have no Social Security guess; the cushion Get started sets must match the Emergency fund page.

One command runs the whole sweep (about 10 minutes on 3 cores; writes `qa/results/sweep.md` and `sweep.json`, git-ignored):

```
node qa/guess-sanity.mjs
```

It builds a grid of households through Get started's own apply functions with every other box left to our guesses, adds
the 1,400 plans in `qa/households` and the qa fixtures, and checks every rule in `guess-sanity-rules.json` (what is
checked, the line, why, the published source and its date). Options: `--full` (the whole grid), `--rules ID,ID` (only
these), `--no-qa`, `--workers N`, `--out <dir>`. `sweep.md` lists each failing rule under its owner (the build or lane
that fixes it) with example households.

`npm test` runs the hard rules on a small grid in `tests/guess-sanity.test.mjs`: a rule that fails there is `todo` while
its count does not grow (`KNOWN`), so a fix turns it green on its own and a new failure fails the suite. A new estimator
or default adds its rule to the JSON in the same change (docs/CONVENTIONS.md "Believable for the household").
