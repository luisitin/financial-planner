# Duplicates  (`transactions/duplicates`)

**Status:** usable (phase 3)
**Purpose:** Find lines that were imported twice and remove the copy.

## Inputs
Plan sections read (`needs`): `transactions`, `accounts`. Writes: `transactions` (delete; and a copy's comment onto the line that stays).

## Outputs
`compute(plan)` -> `{ pairs[] ({ keep, drop, why, accountName }), count, total }`.

## Formulas
`findDuplicates(txs)`: sorted by date; two lines are a pair when same account, same amount to the cent, dates at most one day apart, and descriptions similar: normalised texts equal, one containing the other, or at least two words in common covering 60% of the shorter one. The earlier line is kept; each line is in at most one pair.
Exact repeats (same `txKey`) are refused at import time, so this page only sees near misses such as a pending line that posted a day later with a slightly different text.

`dropCopies(txs, pairs)` -> `{ transactions, moved, lost }`: the list without each pair's copy. A copy's comment (someone in
the household's words, ledger `commentOf`; gap list next 60, item 58) moves to the line that stays when that line has none;
when both carry one, the kept line keeps its own and the copy's words are listed in `lost`. `commentsKept(r, one)` says
it after "Removed ...": "Its comment moved to the one that stays." / "Its comment, “What was this?”, went with it: the
one that stays has its own." ("2 comments moved to the lines that stay." for Remove all); nothing more without comments.

## Edge cases
"Keep both" hides the pair for the session only (a legitimate double purchase). Removing a linked transfer's half also leaves the other half linked; unlink first on the Transfers page.

## Tests
`module.test.mjs`: the sample plan's Amazon pair, similarity rules, account and amount mismatches; `dropCopies` and
`commentsKept` per case (moved, both have one, none, Remove all), and on the page Remove the copy keeping the comment on
the line that stays and saying so.

## Ideas / not yet
- Remember "keep both" decisions in the plan.
