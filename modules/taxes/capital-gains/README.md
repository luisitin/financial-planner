# Capital gains  (`taxes/capital-gains`)

**Status:** usable (phase 6)
**Purpose:** Tax on what you sell this year: short against long, the 0/15/20% bands, the loss allowance, and how much gain still fits at 0%.

## Inputs
`taxes.gains` (`[{ id, name, proceeds, basis, held: "short"|"long" }]`, edited on the page), everything the Federal estimate reads; `extra: { amount, held }` (page state: one more hypothetical sale).

## Outputs
`rows[]` (each sale with its gain), `gains` (netted: netShort, netLong, netLoss, lossAllowed, carryForward and `carryover` { short, long, total }: the Capital Loss Carryover Worksheet of Pub. 550, through the Federal estimate's `lossCarryover`, so a year with taxable income below zero carries more than the loss over 3,000), `taxWithout`, `taxWith`, `taxOnGains`, `rateOnGains`, `shortTax`, `niit`, `qualifiedLayers[]`, `zeroRoom` (long-term gain that would still be taxed at 0%), `thresholds`, `extra` (tax and rate on one more sale), `lossSaves`.

## Formulas
`netGains` in `taxes/federal/compute.js` (Schedule D netting); the tax on the gains is the whole return with the sales less the whole return without them (`federalTax`), so the 3.8% surtax and the stacking are included. The 0% room is found by pushing long-term gain until taxable income reaches the first threshold (iterated, because benefits taxation moves with it).

## Edge cases
Losses beyond 3,000 carry forward but the carry-forward is not stored for next year yet. Wash sales, collectibles (28%) and section 1250 gain are not modelled.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Read sales from the brokerage import (Phase 7 tax lots); carry the loss forward into next year's plan.
