# Retirement report  (`reports/retirement`)

**Status:** usable (phase 9)
**Purpose:** Pulls your retirement projections, Social Security, withdrawal plan and chance of success into one report.

## Inputs
Through the retirement pages' computes: Will the money last?, Chance the money lasts (`REPORT_PATHS` = 1,000, seed 1, capped by the PC's `maxPaths`), If history repeated (quick mode), Social Security, Withdrawal order, Roth conversions (brackets mode only), Required withdrawals, Year by year, and the Stress tests' market shocks. Writes nothing. `heavy: true`.

## Outputs
`{ ready, missing, today, plan, chance, history, socialSecurity, order, roth, rmd, years, market, hitYear }`: figures only; the view writes the sentences. `years` holds the first year, the retirement year, every `STEP` (5) years and the last.

## The document
An opening paragraph (when the spending years start, whether the money lasts at expected returns, the simulated chance, history's, how much guaranteed income covers), the range-of-outcomes chart (Monte Carlo 10th-90th percentile band and the median), the plan's figures and settings, history's hardest starting years, Social Security (claiming age, the amount, at 62 and at 70, what a survivor keeps), how the money comes out (the best withdrawal order and what it gains, Roth conversions, when required withdrawals start), the plan every five years (records on a phone, a table on paper: `wideTable` in `../report-kit.js`), the market stress tests. Prints through `../report-kit.js`.

## Tests
`module.test.mjs`: not ready without basics; the figures match the pages; the five-year table's years.

## Ideas / not yet
- The advisor's numbers beside these (`scenarios/advisor-plan`); the withdrawal-strategy comparison; a page per person for a couple's Social Security choices.

## Average markets, said so (round 5, 2026-11-02)
"Can carry a month" is the average-market figure: it reads "Can carry a month if markets do as well as average". The Monte
Carlo run here passes `careful: false`: the careful figure (9 of 10 markets) is not shown in the report, so it is not worked out.

## Review 2026-11-06
- **Every report finishes (fix round 6).** The page draws its compute's answer through `settleReport` (report-kit): a
  compute that failed (the shell's `{ error }`), a drawing that throws or a remote call that rejects shows "The retirement report
  could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates
  and the ages on the People page, then reload the page." in place of the loading line. A scan of all 1,406 qa households
  and the fixtures found no other report that hung; for the four "older than 120" households (born 1900) this page's
  compute fails inside the retirement projection, and the page read "It needs:" with nothing after it. Test: reports/tax "every report finishes
  when its figures cannot be worked out (settleReport)".

Review 2026-11-06 (round 7): "Your required withdrawals begin in 2065" and the survivor line ("$2,900 a month (you) or $2,900 a month (your spouse)") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js; view only). The Social Security table's name column is a label and stays.

Round 8 batch 5b review D3 (2026-11-06): `plan.spendingMonthly` is what the plan spends a month in its first retirement year,
today's dollars: the settings figure on the same spending every year, the way's own first-year figure (`spendingReal` of the
retirement year's row) on a way that sets its own withdrawal, the figure `coverage` is worked on; `plan.plannedMonthly` is the
settings figure. The widow on "A share of what is left" read "at $3,000 a month" beside "income covers 78%" of her $64,868;
it reads about $5,406. Test: "batch 5b review D3". The view's wording ("Planned a month") is the designer's (not changed here).

Round 8 batch 5b UX review 8 (2026-11-06): `plan.strategy` is the engine's description of the way (`STRATEGIES` in
core/math/retirement.js). Guardrails now reads "What you plan, trimmed by a tenth after bad years and raised back after good
ones" (the words of How much to take out's "Trim after bad years"), not "Your spending, cut 10% after a bad stretch, back up
after a good one". Test: "batch 5b UX review 8: the report says guardrails in the words the retirement pages use".

Follow-up 2026-11-07: "In 93% of 2,000 pretend futures the money lasts" (was "simulated markets"); "the middle 80% of the pretend futures".
- Verify (2026-11-07): the last two "simulations" on the page (the loading line and the foot) and the chart's label say "pretend futures", as the rest of the page and `modules/retirement/odds.js` do.
Final check (2026-11-07): the list of what the plan still needs uses the words every page uses (`core/words.js` `needItem`: "a birth date on the People page", "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"). Test in `tests/wording-verify.test.mjs`.
