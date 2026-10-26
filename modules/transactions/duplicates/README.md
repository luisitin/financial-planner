# Duplicates  (`transactions/duplicates`)

**Status:** usable (phase 3)
**Purpose:** Find lines that were imported twice and remove the copy.

## Inputs
Plan sections read (`needs`): `transactions`, `accounts`. Writes: `transactions` (delete).

## Outputs
`compute(plan)` -> `{ pairs[] ({ keep, drop, why, accountName }), count, total }`.

## Formulas
`findDuplicates(txs)`: sorted by date; two lines are a pair when same account, same amount to the cent, dates at most one day apart, and descriptions similar: normalised texts equal, one containing the other, or at least two words in common covering 60% of the shorter one. The earlier line is kept; each line is in at most one pair.
Exact repeats (same `txKey`) are refused at import time, so this page only sees near misses such as a pending line that posted a day later with a slightly different text.

## Edge cases
"Keep both" hides the pair for the session only (a legitimate double purchase). Removing a linked transfer's half also leaves the other half linked; unlink first on the Transfers page.

## Tests
`module.test.mjs`: the sample plan's Amazon pair, similarity rules, account and amount mismatches.

## Ideas / not yet
- Remember "keep both" decisions in the plan.
