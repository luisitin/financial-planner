# How much to take out  (`retirement/withdrawal-strategy`)

**Status:** usable (phase 5)
**Purpose:** Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history.

## Inputs
The projection inputs; `retirement.strategy` and `retirement.withdrawalRate`. Writes `retirement.strategy` ("Use this one").

## Outputs
`rows[]` per strategy: `name`, `how`, `from`, `expected` and `worst` (`firstYear`, `lowest`, `highest` real spending, `endReal`, `success`, `failAge`); `worstStartYear`, `chosen`.

## Formulas
The engine's four strategies (see the Projection README). `worstWindow`: every start year in the Damodaran data run with fixed-real spending; the one that fails earliest, else ends lowest. Sources: Bengen (1994) and the Trinity study for the 4% rule; Guyton and Klinger (2006) for guardrails; the Bogleheads VPW; the FI Calc guide's definitions (vendored).

## Tests
`tests/retirement-pages.test.mjs`: four rows, percent never fails, fixed-real first year equals the planned spending.

## Independent answer key and numeric sources

`tests/golden/retirement/withdrawal-strategy.csv` adds 800 invented rows across
the four spending rules, beginning-year payment timing, source-history window
selection, displayed summaries and missing-input defaults. The exact layouts,
quoted contracts, arithmetic and sources are in
`tests/golden/retirement/briefs/withdrawal-strategy.md`. Generate with
`python tools/golden_retirement/withdrawal_strategy.py`; replay with
`tests/golden-retirement.test.mjs`. Every tenth row has a second asserted derivation.

The independent history comes directly from
[Damodaran's NYU workbook](https://www.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls),
frozen in `tests/golden/retirement/sources/damodaran-1928-2025.csv` to six decimal
places. It uses the labeled stock/Treasury/bill columns and FRED CPI percentage
changes. No production return data or executable formulas are used to generate
the answer key. All household amounts and dates are invented worked examples.

The guardrail factors 1.2/0.8 and spending changes of 10% are the simplified
Projection README model. The annuity key exposes a timing issue: ordinary
end-year PMT is withdrawn before earning that year's return. For $100,000 with
one year left and a 3% real return, PMT is $103,000, while a beginning-year
withdrawal can use only $100,000. Separate TODO rows retain the beginning-year
cash-flow identity and its $3,000 difference; other VPW rows preserve the stated
PMT compatibility contract. Sources: the model's Projection README, the
[FPA Bengen reprint](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf),
and [Bogleheads VPW](https://www.bogleheads.org/wiki/Variable_percentage_withdrawal).
