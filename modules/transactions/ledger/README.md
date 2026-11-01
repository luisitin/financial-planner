# Ledger  (`transactions/ledger`)

**Status:** usable (phase 3)
**Purpose:** Every transaction in one list you can filter, search and correct.

## Inputs
Plan sections read (`needs`): `transactions`, `accounts`, `categories`. Writes: `transactions` (edit, add by hand, delete).
`compute(plan, { month, accountId, category, q, limit = 100, offset = 0 })`: `category` is a category id, `"none"` for uncategorised, `""` for any. `q` searches payee, the bank's raw text and the note.

## Outputs
`rows[]` (newest first, then largest; each with `categoryLabel`, `icon`, `accountName`, `transfer`), `shown`, `matched`, `total`, `in`, `out`, `net` (over the matched set, transfers excluded), `months[]` (`ym`, `label`, `count`), `accounts[]` (`id`, `name`, `count`), `uncategorised`, `uncategorisedAll`, `hasMore`.

## Shared helpers (used by the other transaction pages)
- `txKey(t)` = `accountId|date|amount to 2 dp|normalised payee`: the identity of a bank line; imports refuse a line whose key is already on file.
- `monthOf(date)`, `monthLabel("2026-09")` -> "Sep 2026".
- `isTransfer(t, plan)`: linked (`transferId`), category `transfer`, or any category of kind transfer.

- `coverage(plan)` -> `{ from, to }`: the first and last transaction dates, the days the bank files cover (2026-11-01).
- `monthCover(cov, ym, today)` -> `{ from, to, firstDay, lastDay, days, daysInMonth, full }`: the part of a month the files cover, never past today. `full` when it misses at most `COVER_SLACK` (3) days at either end and the month is over: my choice, so a file cut on the 29th, or a quiet 1st, still counts as the whole month. Where the money goes and Budget use it so a month cut by the file is never read as a whole month.

## Transaction shape
`{ id, date, amount (+ in, - out), payee, rawPayee (the bank's text), accountId, category ("" = none), tags[], note, transferId?, importId?, key }`.

## Edge cases
No transactions: empty state with links to Import and Net worth. Deep links `#/transactions/ledger/uncategorised`, `/month/2026-09`, `/account/<id>` set the filters once and then the address returns to the bare page. Filter state lives in the module for the session so a save does not reset it.

## Tests
`module.test.mjs`: coverage and whole months (slack, not over yet, not reached, never past today); helpers, empty plan, totals excluding transfers, month/account lists, every filter, paging. Fixture: `qa/fixtures/sample-plan.mjs`.

## Ideas / not yet
- Split a transaction into several categories.
- Bulk edit (select many, set category).
- A running balance per account against the account's `balance` (reconcile page, phase 3 later).
