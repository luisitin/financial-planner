# qa/

Invented households and checks. No real names, balances or addresses live here (AGENTS.md rule 15).

| Folder or file | What it is |
|---|---|
| `households/` | 1,400 invented plans, one folder per household, and `run.mjs`, which runs the pages over them |
| `fixtures/` | the personas Get started's tests use (`setup-personas.mjs`, `round8-households.mjs`, `familyPlan`) |
| `expected/` | answer keys for pages whose figures are checked by hand |
| `smoke-all.mjs` | every usable page on a phone, for render failures |
| `guess-sanity.mjs`, `guess-sanity-rules.json` | **the sanity check for guesses** (below) |
| `first-view-lib.mjs`, `first-view-node.mjs` | **what each page shows before a tap**, counted in Node (below; `npm test` runs it as `tests/first-view/1..6.test.mjs`) |
| `first-view.mjs`, `first-view.known.json` | the same in a browser: the first screen, taps, the memory, `?more=all` (below) |

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

## Does each page open simple? (the first view)

docs/OPTIONAL.md sets a budget per kind of page for what a person meets before any tap: words, money and % figures,
boxes, tiles, filled buttons, sections that open. Two checks hold every usable page to it, for the invented households
`family`, `renterDebt`, `retiredCouple` and the empty plan, with the clock held at 2026-11-13:

```
node qa/first-view-node.mjs              every page drawn in Node (about 20 s): a table, the totals; --write rewrites
                                         tests/first-view.known.json; `npm test` runs the same as six shards
node qa/first-view.mjs                   every page in a browser on a phone (several minutes; needs the app running,
                                         npm run serve, or --url): the first screen, every section tapped, the memory's
                                         round trip, the path's Next, 320 px and ?more=all; --write rewrites
                                         qa/first-view.known.json; --json and --compare give a before and after table
```

A page over its budget today has its counts in the known file; a count there may only go down, a lower one prints
"lower me". The builder runs the browser check at the start of every phase beside `smoke-all.mjs`, and before a push
that touches a view. Neither check can judge meaning: the 390 px screenshot is still read by eye (AGENTS.md rule 13).
