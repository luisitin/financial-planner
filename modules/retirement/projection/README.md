# Will the money last?  (`retirement/projection`)

**Status:** usable (phase 5)
**Purpose:** Your plan run year by year to the end: what you have, add, receive and spend, and whether the money lasts.

## Inputs
Plan sections read (`needs`): `household` (adults with birth dates; retirement and plan-end ages), `accounts` (balances by tax bucket), `expenses` (fallback spending), `income` (a partner's pay after the household retires; pensions), `retirement` (settings, contributions, Social Security, pensions), `assumptions` (inflation, returns, salary growth). Writes: `retirement` settings (spending, stock shares, tax rate, strategy, withdrawal rate).
`buildInputs(plan, { today })` is the one place the plan becomes engine inputs; every other retirement page calls it.

## Outputs
`ready`, `missing[]`, `notes[]`, `inputs`, `result` (the engine run), `rows[]`, `atRetirement`, `atEnd`, `affordable` (real yearly spending that still succeeds, by bisection), `spendingYearly`, `coverage` (guaranteed income / spending in the first retirement year), `verdict` (on track / tight / short), `shortYear`, `shortAge`.

## The engine (`core/math/retirement.js`)
Yearly, in nominal dollars with a price level for the real view. Buckets: cash (checking, savings, cash; earns the cash rate), taxable (brokerage, crypto), deferred (401(k), IRA, insurance cash value), free (Roth, HSA). Property, vehicles and 529s are left out.
- Working years: contributions grow with `salaryGrowth` until each person's retirement age. No withdrawals (pay covers life).
- From the household's retirement year (the primary person's retirement age): spending by the chosen strategy; guaranteed income (Social Security from the claiming age, pensions, a partner's pay until they retire) offsets it; the gap comes from cash, then taxable, then deferred (grossed up by the tax rate), then free. Required minimum distributions (core/math/rmd.js) force deferred money out from the start age; what is not needed moves to taxable.
- Returns: a stock/bond blend gliding from `stocksNow` to `stocksRetired` by the retirement year; a `sequence` option replaces the expected returns year by year (Monte Carlo, history).
- Success = the buckets cover the gap every year to the last adult's plan-end age. `affordableSpending` finds the largest fixed-real spending that succeeds: the ceiling doubles until it fails, then bisection narrows it to a millionth of a dollar, rounded to the dollar.
- Required withdrawals: each adult's share of the pre-tax bucket (their own 401(k)s and IRAs; life-insurance cash value is no one's) is kept as its own slice and withdrawn at that person's age and start age (`rmd.owners`); rows carry `rmdBy` per person.
- Strategies: fixed-real (inflation-adjusted constant), percent of portfolio, guardrails (Guyton-Klinger simplified: cut 10% above 1.2x the rate, raise 10% below 0.8x, no inflation raise after a losing year), VPW (the payment over the years left at the real return, taken at the start of the year: the annuity-due amount, so the money lasts exactly to the end).
Modelled on the Bogleheads Retiree Portfolio Model and cFIREsim's spending modules (vendored); simplified taxes (one effective rate on deferred withdrawals) until the Phase 6 tax pages.

## Pensions from the Income page
`incomePensions()` turns every Income item of type "pension" into a retirement income, so a pension typed where the app first asks for it counts here (F-028). One already being paid (no start date, or a past one) counts from now, the way the Income page counts it; a future one from the age its owner reaches in the start-date year; an end date stops it after that year. A rise typed on the item (growth above 0) means it keeps up with inflation; none means a fixed amount. Left out: one-off payments (a lump sum is not an income), ended items, and items that repeat a `retirement.pensions` entry for the same person with the same name or the same monthly amount within a dollar.

## Edge cases
No adult with a birth date, no accounts, or no spending figure: the page lists what is missing and still shows the settings. Already retired: retirement year = this year. A partner retiring after the primary: their pay counts as income until then.

## Tests
`module.test.mjs` (inputs from the fixture couple, the run, fallbacks) and `tests/retirement.test.mjs` (the engine: buckets in order, gross-up, RMD, sequences, strategies, affordable spending).

## Ideas / not yet
- Real tax brackets instead of one rate (Phase 6); Roth conversions; a survivor scenario (one Social Security stops); one-off events (sell the house, an inheritance).

## Independent answer key

`tests/golden/retirement/projection.csv` contains 2,100 invented cases across 21 rules;
`tests/golden-retirement.test.mjs` replays them. The source inventory, exact layout and
rounding policy are in `tests/golden/retirement/briefs/projection.md`. Independent Python
oracles use geometric sums, discounted annuities and cash conservation; every tenth case
has another derivation, and a separate lead audit samples every rule. No expected value
comes from running this module. Money is compared within0.005; rates to six-place precision.

The documented model assumptions above supply timing, bucket, glide and strategy rules.
IRS Publication590-B TableIII supplies the tested RMD factor24.6 at75:
https://www.irs.gov/publications/p590b . Whole-dime typed Social Security amounts claimed
at full retirement age67 isolate the annualization adapter; the SSA benefit formula remains
in its own test scope. Since 2026-10-30 (F-030) every case agrees: the affordable-spending search's ceiling grows until it fails and narrows below a cent.
