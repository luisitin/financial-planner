# HSA and FSA  (`taxes/hsa-fsa`)

**Status:** usable (phase 6)
**Purpose:** The health savings account: its limit, the room left, the tax it saves, what it grows into; and the FSA use-it-or-lose-it deadline.

## Inputs
`taxes.hsa` (`{ coverage: "self"|"family", contribution, employer, fsa, fsaSpent }`, edited here), `household` (ages for the 55+ catch-up and the years to 65), `accounts` of type `hsa` (today's balance), `assumptions` and `retirement.stocksNow` (growth rate), everything the Federal estimate reads (for the tax saved).

## Outputs
`hsa` (limit with catch-ups, contribution, employer, total, room, over, taxSaved through the brackets, ficaSaved at 7.65%, marginal, years to 65, growthRate, futureValue of this year's amount repeated, balance grown, atSixtyFive), `fsa` (election, limit, spent, unspent, daysLeft, carryover, taxSaved, over), `notes`.

## Formulas
Limits from `modules/retirement/contributions/data/limits.js` (HSA: Rev. Proc. 2024-32 / 2025-19; FSA: Rev. Proc. 2024-40 / 2025-32; 1,000 catch-up per person 55+, two on family coverage). Tax saved = the return without the contribution less the return with it (it is an adjustment), plus payroll tax when it comes from pay. Growth: the plan's blended expected return, future value of a level yearly amount.

## Edge cases
A general-purpose FSA and an HSA in the same year get a warning (only a limited-purpose FSA is allowed). Over-contributions are flagged (6% excise). The Medicare six-month look-back is text only.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Track receipts paid out of pocket for later tax-free reimbursement.
