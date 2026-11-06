# Year by year  (`retirement/cash-flow`)

**Status:** usable (phase 5)
**Purpose:** Every year of the plan in one table: ages, what comes in, what goes out, what is taken from where, what is left.

## Inputs
Everything the projection uses (through `retirement/projection` compute). `compute(plan, { today, real = true })`.

## Outputs
`rows[]` per year: `in` (contributions, income, lines), `out` (spending, taxes), `from` (cash, taxable, deferred, free), `rmd`, `end` buckets and total, `shortfall`; `totals`, `retireYear`, `people`, `verdict`, `shortYear`. Real (today's dollars) by default: nominal values divided by that year's price level.

## Tests
`tests/retirement-pages.test.mjs`: real vs nominal, totals.

## Ideas / not yet
- Export the table to CSV (Reports phase); columns for each income line.

## Independent answer key

`tests/golden/retirement/cash-flow.csv` has 1,000 invented cases across ten rules, replayed
by `tests/golden-retirement.test.mjs`. Its brief is `tests/golden/retirement/briefs/cash-flow.md`.
Nominal ledgers are independently reconciled; every real amount is divided by cumulative
price level. The key includes nonzero contributions, income lines, all four withdrawal
buckets, taxes and required withdrawals. The source for the latter is IRS Publication590-B,
TableIII (age74 factor25.5, age75 factor24.6): https://www.irs.gov/publications/p590b .
The projection README supplies annual timing and flat-tax assumptions, not a tax-law claim.
Expected money is rounded only when writing cents. Every tenth case has another derivation;
the lead separately audits2%. Exact cent inputs are used before deriving the answer;
the covered ledger cases agree with the code within the requested half-cent tolerance.

## Health cover (2026-11-02)
`out.spending` is all of the year's spending: the plan's spending and its health cover (the projection's "Health cover" line, marketplace to 65 then Medicare, the engine's `eventSpending`); `out.health` is that part, and each year's record says it ("$89,805 spent ($5,805 health cover)"). Buckets reads it, so the years it sets aside include cover.

Review 2026-11-06 (round 7): each year's income lines (named by the projection) say "your Social Security" and "your spouse's Social Security" for the unnamed first adult ("Me") and "My spouse", never "Me's Social Security"; this page says you/your for the unnamed first adult. Test: "Review 2026-11-06 (round 7): the year's income lines say 'your Social Security' ...".
