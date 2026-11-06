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
