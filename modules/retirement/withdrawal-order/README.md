# Withdrawal order  (`retirement/withdrawal-order`)

**Status:** usable (phase 6)
**Purpose:** Which account to draw from first (taxable, pre-tax or Roth) and what each order costs in lifetime tax and spending.

## Inputs
Everything the Projection page reads; `retirement.withdrawalOrder` (the plan's order, after cash; set here with one tap). The comparison always runs through the federal brackets so the tax timing shows, whatever the projection's tax setting.

## Outputs
`options[]` (four orders: taxable first; pre-tax first; pre-tax, Roth, taxable; Roth first): `success`, `failYear`, `endBalanceReal`, `endAfterTaxReal`, `endTaxRate`, `taxesReal`, `rmdReal`, `current`, `best`; `best`, `gainVsWorst`, `taxSpread`, `bracketsOn`, `notes`.

## Formulas
`project()` once per order with `withdrawalOrder` and `tax: { mode: "brackets" }`. Orders are ranked by what is left at the end after the tax still owed on pre-tax money (`endAfterTaxReal`: cash + taxable + Roth + pre-tax x (1 - the last year's bracket)); a plan that runs out ranks by how late it does.

## Edge cases
Cash always goes first. When the projection uses the flat rate the order changes nothing there; a note says so. Proportional or bracket-filling mixes are the Roth conversions page's job.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Independent answer key and audited sources

`tests/golden/retirement/withdrawal-order.csv` holds 1,400 invented cases:
100 for each of fourteen rules, split into 60 grid, 30 edge, and 10 extreme
cases. The rule inventory and full column layout are in
`tests/golden/retirement/briefs/withdrawal-order.md`. The generator and its
shared independent tax equations are `tools/golden_retirement/withdrawal_order.py`
and `tools/golden_retirement/tax_oracle.py`. Neither imports application code.
Every tenth case has an alternative derivation recorded in the CSV note.

Ordinary brackets, capital-gain thresholds, standard deductions and additional
age allowances come from [IRS Rev. Proc. 2025-32, sections 4.01, 4.03 and 4.14](https://www.irs.gov/irb/2025-45_IRB).
For example, 2026 single taxable income of $50,400 has ordinary tax
`12,400 * .10 + (50,400 - 12,400) * .12 = $5,800`.
The source-year figures stay exact. Later hypothetical years compound the
plan's inflation, rounding brackets to $25 and deductions and capital-gain
thresholds to $50, as an explicit planning assumption rather than a tax forecast.
The 2025 head-of-household standard deduction is $23,625 under the amended law
and stays exact: a table's own year is never re-rounded (fixed 2026-10-30, F-030).

Social Security taxable income follows [IRS Publication 915, Worksheet 1](https://www.irs.gov/publications/p915).
Single, head-of-household and surviving-spouse thresholds are $25,000 and
$34,000; joint thresholds are $32,000 and $44,000. Married-separate examples
explicitly assume the spouses lived apart for the whole year, because the
model has no field for that fact. Net investment income tax follows the
[IRS NIIT FAQs](https://www.irs.gov/newsroom/questions-and-answers-on-the-net-investment-income-tax):
3.8% of the smaller of investment income and modified adjusted gross income
above $200,000 single/head-of-household, $250,000 joint/surviving-spouse,
or $125,000 married-separate. These thresholds are not indexed.

The temporary senior deduction follows [IRC 151(d)(5)(C)](https://www.law.cornell.edu/uscode/text/26/151)
and [IRS Schedule 1-A instructions](https://www.irs.gov/instructions/i1040gi).
For 2025 through 2028, each eligible person starts with $6,000; that person's
amount falls by 6% of income above $75,000, or $150,000 on a joint return.
Married taxpayers must file jointly to qualify. For two eligible joint filers
at $200,000, the deduction is `2 * (6,000 - .06 * 50,000) = $6,000`, not
`12,000 - .06 * 50,000 = $9,000`. Both rules are in `core/math/tax.js` since
2026-10-30 (F-029, F-030).

Page-level answers solve for the smallest gross withdrawal whose after-tax
proceeds cover spending. An independent bisection allocates each proposed draw
through cash and the selected account order, then evaluates the published tax
equations. Remaining balances grow after withdrawals. Real tax and required
withdrawal totals divide each year by its cumulative price level before
summing; the after-tax estate subtracts the last ordinary marginal rate times
the remaining pre-tax balance. Ties retain the first listed option. Money is
rounded to cents only for federal tax and final CSV outputs; rates have six places.

## Ideas / not yet
- A proportional order; the step-up in basis on taxable money left to heirs.
