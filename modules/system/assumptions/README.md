# Assumptions  (`system/assumptions`)

**Status:** usable (phase 2)
**Purpose:** Lets you edit every global assumption, see where each default came from and stamp it as reviewed.

## Inputs
Plan sections read (`needs`): `assumptions`. `compute(plan, { today })`: `today` for days since the review.

## Outputs
`rows[]` (`key`, `label`, `kind`, `def`, `value`, `changed`, `source`), `reviewedAt`, `daysSinceReview`, `stale`, `changedCount`, `realStocks`, `realBonds`, `realCash`, `warnings[]`.

## The ten assumptions and their sources
| key | default | source (also shown on screen) |
|---|---|---|
| inflation | 3% | BLS CPI-U long-run average about 3%; Fed target 2% |
| returnStocks | 7% | long-run US large-cap about 10% nominal (Damodaran 1928-, Shiller 1871-); 7% is a common conservative planning figure |
| returnBonds | 4% | 10-year Treasuries about 4.5-5% long run (Damodaran); bond funds 4-5% mid-2020s |
| returnCash | 2% | savings/MMF 4-5% in 2023-2025, near 0 in 2010-2021; long run about inflation |
| stdevStocks | 15% | yearly stdev of US stocks about 15-20% (Damodaran) |
| stdevBonds | 5% | 10-year Treasuries about 5-8% |
| salaryGrowth | 3% | BLS employment cost index roughly 3-4% in the 2010s-2020s |
| retirementAge | 65 | Medicare at 65; full Social Security age 67 for 1960+ births |
| planEndAge | 95 | SSA life tables: about 1 in 5 65-year-olds live past 90 |
| emergencyMonths | 6 | common advice 3-6 months of essential expenses |

The reference data behind Damodaran and Shiller is vendored (see `docs/RESOURCES.md`); the phase 5 historical pages will compute from it directly.

## Formulas
- Real return = (1 + nominal) / (1 + inflation) - 1 (`core/math/finance.js` `realRate`).
- Stale = never reviewed, or reviewed more than 365 days before `today`.
- Warnings: stocks below bonds; stocks more than 8 points above inflation; retirement age at or past the plan end age.

## Edge cases
Missing keys fall back to defaults (older plans). Reset keeps the review date. Percent fields are typed as whole numbers (7) and stored as fractions (0.07) by `ui.form`.

## Tests
`module.test.mjs`: defaults, real returns, changed count and fallback, review staleness, warnings.

## Ideas / not yet
- Per-scenario assumptions (phase 9) instead of one global set.
- A "what my advisor used" column filled by `ai/reader` from the advisor's plan (phase 8).
