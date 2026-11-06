# Capital gains  (`taxes/capital-gains`)

**Status:** usable (phase 6)
**Purpose:** Tax on what you sell this year: short against long, the 0/15/20% bands, the loss allowance, and how much gain still fits at 0%.

## Inputs
`taxes.gains` (`[{ id, name, proceeds, basis, held: "short"|"long" }]`, edited on the page), everything the Federal estimate reads; `extra: { amount, held }` (page state: one more hypothetical sale).

## Outputs
`rows[]` (each sale with its gain), `gains` (netted: netShort, netLong, netLoss, lossAllowed, carryForward and `carryover` { short, long, total }: the Capital Loss Carryover Worksheet of Pub. 550, through the Federal estimate's `lossCarryover`, so a year with taxable income below zero carries more than the loss over 3,000), `taxWithout`, `taxWith`, `taxOnGains`, `rateOnGains`, `shortTax` (the tax with the gains less the tax with the year's net short-term gain taken off; filing separately, each return's own net short-term gain comes off that return, `addIncome`), `niit`, `qualifiedLayers[]`, `zeroRoom` (long-term gain that would still be taxed at 0%), `thresholds`, `extra` (tax and rate on one more sale), `lossSaves`.

## Formulas
`netGains` in `taxes/federal/compute.js` (Schedule D netting); the tax on the gains is the whole return with the sales less the whole return without them (`federalTax`), so the 3.8% surtax and the stacking are included. The 0% room is found by pushing long-term gain until taxable income reaches the first threshold (iterated, because benefits taxation moves with it).

### On the Federal estimate's return (round 8 verify, 2026-11-06)
- **What:** every figure here (the tax the sales add, the room at 0%, the short-term tax, one more sale, the layers and the
  surtax) is worked on the return the Federal estimate shows: `known(plan, { today })` from `taxes/federal/known.js`, which
  puts in this year's IRA and 401(k) withdrawals, stock pay, the business at its profit, the rentals after costs and the IRA
  and student loan limits. "Without the sales" is `known()` of the plan with `taxes.gains` emptied, so a limit the sales move
  (an IRA deduction phased out by the gain) moves too. A household none of those steps change keeps `taxInputs()`' return
  exactly, so the answer keys and `tests/tax-pages.test.mjs` are unchanged. Without `today` the page works as before.
- **Why:** the widow (required withdrawal 16,078, Social Security 27,600, pension 22,800) was told 27,340 of long-term gain
  fit at 0%, beside the Federal estimate's 35,104 of taxable income. On that return 11,262 fit: 3,628 of gain pulls the last
  3,084 of her Social Security into tax (85% of benefits, IRC 86), then 7,634 more reaches the 0% line of 49,450 (Rev. Proc.
  2025-32 sec. 4.03). Selling 27,340 would have added about 3,020. One more 10,000 long-term sale adds 370.04 (Social
  Security taxed 23,460, AGI 72,338, taxable 48,188, all of the gain under the line; ordinary tax 1,240 + 12% x 25,788 =
  4,334.56 against 3,964.52).
- **Tests:** `module.test.mjs` "round 8 verify"; `tests/owner-sales.test.mjs` (Ana's short-term 10,000 on her separate
  return with the family's business in: 73,080 to 83,080 taxable, all at 22%, 2,200).

## Edge cases
Losses beyond 3,000 carry forward but the carry-forward is not stored for next year yet. Wash sales, collectibles (28%) and section 1250 gain are not modelled.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Read sales from the brokerage import (Phase 7 tax lots); carry the loss forward into next year's plan.
