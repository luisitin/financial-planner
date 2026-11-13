# Performance  (`investments/performance`)

**Status:** usable (phase 7)
**Purpose:** Your true return from the balance points you save: what the investments earned and what you earned, against the plan and an index mix.

## Inputs
`accounts[].history` (`[{ date, balance }]`, written by "Save today's totals" on the Net worth page, which now records every account), deposits between points: the ledger's transactions for the account when it has any, else the Contributions page's yearly rate prorated; `assumptions` (the plan's expected return); Damodaran's yearly returns for the index benchmark.

## Outputs
`accounts[]` (`accountPerformance`: points, from/to, start, end, deposits, gain, `twr`, `twrAnnual`, `mwr`, `periods[]`), `overall` (value-weighted yearly time-weighted return, gain, deposits; the money-weighted figure when there is one account), `expected`, `benchmark` (`benchmarkOver`: the plan's stock share against bonds over the whole calendar years inside the span, or null), `notes`, `pointsNeeded`.

## Formulas
`core/math/returns.js`: time-weighted = Modified Dietz within each period, (end - start - flow) / (start + flow / 2), chain-linked, annualised over the span; money-weighted = `xirr` over the start value, each period's deposit at its midpoint, and the end value. Ported in spirit from Portfolio Performance (EPL), not code.

## Edge cases
Fewer than two points: the account is left out with a note. Under half a year of points the yearly figures are flagged as extrapolated. No whole calendar year inside the span: no benchmark.

## Tests
`tests/returns.test.mjs` (the maths), `tests/investments.test.mjs` (the page), `module.test.mjs`.

## Ideas / not yet
- Per-holding returns once transactions per holding exist; a chart of the value line with the deposits marked.

## Simple first (2026-11-13, opt C6)
"How this is worked out" (the two methods, Modified Dietz and the internal rate of return) is a part drawn by
`core/ui/more.js` (`part`, kind `how`, a folded card of its own; docs/OPTIONAL.md), title and words unchanged, so the first
view is the same. What changes: Settings > How much to show > "Show how answers are worked out" opens it on this phone, and a
person's own tap on it is kept for 90 days. The page saves nothing (S11 in `module.test.mjs`).
