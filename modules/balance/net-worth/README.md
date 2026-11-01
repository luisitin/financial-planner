# Net worth  (`balance/net-worth`)

**Status:** usable
**Purpose:** the balance sheet: every account with a balance, totals, liquidity and tax-bucket splits, and a dated history of snapshots.

## Inputs
Plan sections read: `accounts`, `netWorthHistory`, `meta.currency`.
`compute(plan)` takes no parameters.

## Outputs
`assets`, `liabilities`, `netWorth` (= assets - liabilities), `liquid` (cash-like and taxable brokerage),
`investable` (everything with a tax bucket), `byType`, `bySide`, `byTaxBucket` (taxable / deferred / free / none),
`count`, `history` sorted by date, `change` vs the last snapshot or `null`.

## Formulas
Sums. Liability balances are stored as positive amounts owed and subtracted. The type table
`ACCOUNT_TYPES` (this module's compute.js) is the single source of truth for what is an asset,
what is liquid and which tax bucket a type belongs to; other modules import it.

## Whose account
The form's "Whose account" is a choice of the people on the People page, saved as the person's id ("Joint or shared" saves
""), because the tax pages put an account's contributions and sales on its owner's return (`ownerId` in DATA_MODEL). Until
2026-10-31 it was a typed name, which never matched an id; `migrate` (`ownersToIds`) now turns a typed name that matches
exactly one person's name into their id when the plan is opened, and a name that matches no one stays selectable in the
form marked "typed before; choose a person".

## Edge cases
Unknown `type` is treated as `other_asset`. Non-numeric balances count as 0. One snapshot per
calendar day (the later one wins).

Editing an account's balance (2026-11-01): a new balance is dated today unless "Balance as of" was changed in the same
edit, and the old balance stays a point in the account's history on its old date (`keepOnFile` in
`balance/update/compute.js`), so Account detail's chart and the monthly review see the update. Adding, saving and
removing an account each confirm at the top of the Accounts card. "Update all balances at once" opens
`balance/update`, which dates every balance today in one save.

## Tests
`module.test.mjs`: totals, liability handling, tax buckets, change vs last snapshot.

## Ideas / not yet
- Per-account balance history from imported statements (feed from transactions/import).
- Chart of the snapshot history (uPlot).
- Owner filter (each person / joint) and a per-person net worth.
- Benchmarks from the Fed Survey of Consumer Finances (see docs/RESOURCES.md).
