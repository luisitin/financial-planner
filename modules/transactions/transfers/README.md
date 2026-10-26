# Transfers  (`transactions/transfers`)

**Status:** usable (phase 3)
**Purpose:** Link money moved between your own accounts so it is not counted as spending or income.

## Inputs
Plan sections read (`needs`): `transactions`, `accounts`. Writes: `transactions` (`transferId`, category `transfer`).

## Outputs
`compute(plan)` -> `{ pairs[] (suggested: { out, in, gap, score }), linked[] ({ transferId, out, in, n }), count, suggested, total }`.

## Formulas
`findPairs(txs, { days = 4 })`: for every money-out line not yet linked, money-in lines in a *different* account with the same absolute amount (to the cent) within `days`; score = (days - gap) + 3 x (each side whose text says transfer/payment/autopay/zelle/venmo/deposit/to/from...); best score first; each transaction used at most once.
Linking sets the same `transferId` on both and category `transfer`; unlinking removes both and clears the category. The Ledger, Income statement and Spending pages exclude anything `isTransfer`.

## Edge cases
Same-account pairs (a refund) are never suggested. A credit-card payment (checking -> card) is a transfer, and is the usual first suggestion. If a transfer's two halves land in different months they still pair within the day window.

## Tests
`module.test.mjs`: the sample plan's linked and unlinked pairs, the day window, one use per transaction, wording rank.

## Ideas / not yet
- Suggest a transfer when only one side is on file (the other account not imported yet) and mark it "transfer, other side missing".
