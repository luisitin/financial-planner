# Rebalance  (`investments/rebalance`)

**Status:** usable (phase 7)
**Purpose:** The trades that bring your mix back to its target: new money first, then sells where they cost no tax and buys with the cash freed.

## Inputs
Allocation (rows, band), holdings (per-account values, gains, tax buckets), `investments.newMoney`.

## Outputs
`newMoneyBuys[]` (new money into the most underweight classes first, then by target weights), `afterNewMoney`, `newMoneyEnough`, `trades[]` (`sell` rows: account, symbol, class, amount, tax note; `buy` rows: account, class, amount), `taxableSells`, `gainRealised`, `leftover[]`, `notes`.

## Formulas
Sells for an overweight class come from holdings mostly of that class, in the order: pre-tax accounts, then Roth/HSA, then taxable; inside taxable, the smallest gain per dollar first (losses before gains). Buys of underweight classes use the cash freed in the same account (largest first), so nothing moves between accounts; what cannot be placed is listed as leftover.

## When it trades, and what it never sells (2026-11-02)
No trades while Allocation's `verdict` is `"pick"` (no target of your own) or `"partial"` (under 80% of the money
classified): `waiting` says which, and the page says what to do first instead of "Time to rebalance". A balanced or
target-date fund (`cls: "balanced"`) is never a sell candidate: it holds several classes and rebalances itself, and the
old rule (any holding more than half in a class) sold a whole 2055 fund as "US stocks". When a class is over only because
of such funds, `overOnlyBlended` lists it and a note says the fund keeps its own mix (send new money elsewhere, or pick a
target that matches the fund). `blended` lists those funds. The full list of trades shows only when a rebalance is due.

Review fixes (2026-11-02): `overOnlyBlended` and the "could not be placed" note only when a rebalance is due (picking the
fund's own mix used to say "No rebalance needed" next to "pick a target that matches the fund"). When a rebalance is due but
everything over sits inside balanced or target-date funds, so nothing can be sold, `onlyInFund` (`{ funds, short, taxFree }`)
replaces the empty trade list with "The fund sets this mix" and the three ways to move it: exchange part of the fund inside
the account (no tax in a 401(k), IRA or Roth), send new money to a fund of the short class, or keep the fund's mix.

## Edge cases
When no class is flagged the page still shows where new money should go. Nothing is ever traded automatically; the plan is not changed by this page except for the new-money amount.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Whole-share rounding, minimum trade sizes, naming a specific fund to buy per class per account.
