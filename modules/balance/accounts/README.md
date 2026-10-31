# Account detail  (`balance/accounts`)

**Status:** usable (phase 3; built by claude-b from codex's idle lane)
**Purpose:** Shows each account's balance history, what goes in and out of it, whether its last statement was checked,
and your notes on it.

Net worth (`balance/net-worth`) stays the list of accounts and the place to add, rename or change one; this page is
the detail of one account (the lane note: "make it a per-account detail page").

## Inputs
Plan sections read (`needs`): `accounts` (balance, `asOf`, `history`, `notes`, `ownerId`), `transactions`,
`reconciliations` (transactions/reconcile), `household` (the owner's name). Writes (`writes`): `accounts` (a balance
point in `history`, `notes`).
Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD), `accountId` (from `#/balance/accounts/<id>`; an
unknown one opens the first account).

## Outputs
`compute(plan, { today, accountId })` -> `{ accounts: [{ id, name, label, liability, balance, lines }], account: { id,
name, type, label, liability, institution, owner, balance, asOf, notes } | null, points, change, flows, recent, lines,
since }`.
Also exported: `points(account)`, `change(points)`, `flows(transactions, today)`, `sinceCheck(plan, account)`,
`addPoint(draft, accountId, date, balance)`, `removePoint(draft, accountId, date)`, `RECENT_DAYS`, `MONTHS`.

## Formulas
- **Balance points** (`points`): one per day, oldest first: the saved `history` points (Net worth's "save today's
  totals", or added here) and the balance on file at its `asOf` date, which wins on that day. A debt's balance (card,
  loan: `isLiability`) is shown as what is owed, kept positive as Net worth counts it.
- **Change** (`change`) = last point − first point; as a share of the first (none when the first is 0); over the days
  between (`core/math/dates.js` `daysBetween`).
- **Money in and out** (`flows`), from the account's transactions as the ledger stores them (money in +, out −;
  transfers between your own accounts count, since they move this account): in = Σ positive amounts, out = Σ negative,
  net = in + out, count; over the 30 days to today (today and the 29 before, `RECENT_DAYS`) and for each of the six
  calendar months to today's (`MONTHS`), newest first. In cents, so sums do not drift.
- **Since the last checked statement** (`sinceCheck`): the latest saved reconciliation's ending balance + the
  account's lines dated after its last day (− for a debt) = what the transactions say the balance is. When the balance
  on file is dated on or after that day, only lines up to that date count and the page shows the difference: balance on
  file − that figure (a transaction may be missing, or the balance on file is out of date).
- **Adding a balance** (`addPoint`): a day (today or earlier) and the balance; the same day again replaces it; the
  balance on file is left alone (it is changed on Net worth). **Removing** takes out the saved point of that day.
- **The line**: the points against time (the gap between two points is the time between them), on about three clean
  axis steps (1, 2, 2.5 or 5 × a power of ten), thousands shown as "K" from 10,000; a 2-pixel line, a 10% wash under it,
  the latest point as a dot with its value. Touching or pointing at the line shows the nearest saved day and its
  balance. One series, so no legend; the colour is the app's accent (a step deeper in dark mode, checked with the
  dataviz palette checker against both surfaces).

## Edge cases
- No accounts: a hero pointing to Net worth.
- Fewer than two balance points: no line, a sentence saying how to get one.
- No transactions for the account: a sentence and a link to Import instead of money in and out.
- No transactions in the last 30 days (an old import): a sentence naming the latest one's day instead of two $0 figures.
- The balance and the change at the top are in whole dollars so they fit side by side on a phone; every other amount has cents.
- A future day typed for a balance: refused with a notice.
- An owner id that is not a person (typed text on Net worth): shown as typed.
- Notes are saved with a button, never on each key; the page warns against passwords and full account numbers.

## Tests
`module.test.mjs` (6): balance points (the day on file wins, bad rows skipped, a debt as owed, no date); the change
(amount, share, days, from 0); money in and out (the 30 days, six months, a window starting mid-month, months across
a new year); since the last check (the latest check, lines to the balance's date, the difference, a card, a balance
older than the check); the page data (picker, chosen account, owner, latest five, an unknown id, no date); adding and
removing points.

## Ideas / not yet
- Mark the checked statements on the line.
- Interest earned or paid, from the account's transactions in the interest category.
