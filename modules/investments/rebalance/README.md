# Rebalance  (`investments/rebalance`)

**Status:** usable (phase 7)
**Purpose:** The trades that bring your mix back to its target: new money first, then sells where they cost no tax and buys with the cash freed.

## Inputs
Allocation (rows, band), holdings (per-account values, gains, tax buckets), `investments.newMoney`.

## Outputs
`newMoneyBuys[]` (new money into the most underweight classes first, then by target weights), `afterNewMoney`, `newMoneyEnough`, `trades[]` (`sell` rows: account, symbol, class, amount, tax note; `buy` rows: account, class, amount), `taxableSells`, `gainRealised`, `leftover[]`, `notes`.

## Formulas
Sells for an overweight class come from holdings mostly of that class, in the order: pre-tax accounts, then Roth/HSA, then taxable; inside taxable, the smallest gain per dollar first (losses before gains). Buys of underweight classes use the cash freed in the same account (largest first), so nothing moves between accounts; what cannot be placed is listed as leftover.

## Edge cases
When no class is flagged the page still shows where new money should go. Nothing is ever traded automatically; the plan is not changed by this page except for the new-money amount.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Whole-share rounding, minimum trade sizes, naming a specific fund to buy per class per account.
