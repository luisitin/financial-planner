# Pay off debts  (`debt/payoff`)

**Status:** usable (phase 4)
**Purpose:** One plan for every loan and card: the same money each month, highest rate or smallest balance first, and the date each one is gone.

## Inputs
Plan sections read (`needs`): `accounts` and `debts` (through the Debts page compute: a debt needs a rate and a required payment), `debtPlan` (`{ extra, order, customOrder }`). Writes: `debtPlan`.
`compute(plan, { today })`.

## Outputs
`debts[]`, `missing[]`, `extra`, `order`, `budget`, `plans` (`avalanche`, `snowball`, `custom`: `months`, `endDate`, `totalInterest`, `totalPaid`, `debts[]` with `endDate`, `timeline`), `chosen`, `best`, `plus100`, `baseline`, `hasData`.

## Formulas
`core/math/payoff.js` `payoffPlan`: each month interest is added (rate / 12 on the opening balance), every debt gets its required payment, and everything left of the budget (required payments + extra, plus payments freed by finished debts) goes to the target debts in order. Avalanche = highest rate first (least interest), snowball = smallest balance first, custom = the owner's order. `plus100` = the chosen order with 100 more a month. Baseline = required payments only.

## Edge cases
Debts without a rate or payment are listed as missing and left out. A plan whose payments do not cover the interest reports "never" and the debts concerned. Dates need `today`.

## Tests
`tests/payoff.test.mjs` (the math against nper), `tests/debt-pages.test.mjs` and `module.test.mjs` (the page on the shared household).

## Ideas / not yet
- A payoff timeline drawing (designer), one-off lump sums, pausing a debt (0% promo).
