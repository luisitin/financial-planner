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

## Ideas / not yet
- A proportional order; the step-up in basis on taxable money left to heirs.
