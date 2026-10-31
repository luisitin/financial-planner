# Account detail  (`balance/accounts`)

**Status:** usable (phase 3; built by claude-b from codex's idle lane)
**Purpose:** Shows each account's balance history, what goes in and out of it, whether its last statement was checked,
and your notes on it.

Net worth (`balance/net-worth`) stays the list of accounts and the place to add, rename or change one; this page is
the detail of one account (the lane note: "make it a per-account detail page").

## Inputs
Plan sections read (`needs`): `accounts` (balance, `asOf`, `history`, `notes`, `ownerId`), `transactions`,
`reconciliations` (transactions/reconcile), `household` (the owner's name). Writes (`writes`): `accounts` (a balance
point in `history`, the balance on file and its `asOf` when a balance is added for that day or later, `notes`).
Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD), `accountId` (from `#/balance/accounts/<id>`; an
unknown one opens the first account).

## Outputs
`compute(plan, { today, accountId })` -> `{ accounts: [{ id, name, label, liability, balance, lines }], account: { id,
name, type, label, liability, institution, owner, balance, asOf, notes } | null, points, change, flows, recent, lines,
since }`.
Also exported: `points(account)`, `change(points)`, `flows(transactions, today)`, `sinceCheck(plan, account)`,
`addPoint(draft, accountId, date, balance)`, `saveBalance(draft, accountId, date, balance)`,
`removePoint(draft, accountId, date)`, `ticks(lo, hi)`, `axisUnit(ticks)`, `isDate(text)`, `RECENT_DAYS`, `MONTHS`.

## Formulas
- **Dates**: a real calendar day written YYYY-MM-DD (`isDate`: the shape, and `core/math/dates.js` `isValidDate`, so
  2026-13-01 and 2026-02-30 are not points).
- **Balance points** (`points`): one per day, oldest first, each to the cent: the saved `history` points (Net worth's
  "save today's totals", or added here) and the balance on file at its `asOf` date, which wins on that day. A debt's
  balance (card, loan: `isLiability`), saved or on file, is shown as what is owed, kept positive as Net worth counts
  it.
- **Change** (`change`) = last point − first point; as a share of the first (none when the first is 0); over the days
  between (`core/math/dates.js` `daysBetween`). On screen it is named by its direction (up or down; for a debt, you
  owe less or more) instead of a sign, in cents when under $10, and with both days when the last point is not the
  balance on file's day.
- **Money in and out** (`flows`), from the account's transactions as the ledger stores them (money in +, out −;
  transfers between your own accounts count, since they move this account): in = Σ positive amounts, out = Σ negative,
  net = in + out, count; over the 30 days to today (today and the 29 before, `RECENT_DAYS`) and for each of the six
  calendar months to today's (`MONTHS`), newest first. In cents, so sums do not drift. For a debt, in is shown as
  payments and out as new charges, and the net as what you owe less (or more).
- **Since the last checked statement** (`sinceCheck`): the latest saved reconciliation (by its last day; on a tie the
  one saved later, as records are added at the end) and its ending balance + the account's lines dated after its last
  day (− for a debt) = what the transactions say the balance is. When the balance on file is dated on or after that
  day, only lines up to that date count and the page shows the difference: balance on file − that figure, in green
  when it is 0 and amber when not (a transaction may be missing, or the balance on Net worth is out of date).
- **Adding a balance** (`saveBalance`, through `addPoint`): a day (today or earlier) and the balance; the same day
  again replaces it. When the day is on or after the balance on file's day (or there is no dated balance), the balance
  on file and its date move to it too, so the chart, the top of the page and Net worth agree; a debt keeps the sign it
  is stored with. An earlier day only adds the point. **Removing** takes out the saved point of that day (the balance
  on file is not touched).
- **The line**: the points against time (the gap between two points is the time between them), on about three clean
  axis steps (`ticks`: 1, 2, 2.5 or 5 × a power of ten; a span under 2, or under 2% of the size, is widened around its
  middle, so a flat line gets whole-dollar steps and float noise cannot make a step of nothing), thousands shown as "K"
  from 10,000 with the decimals the step needs (`axisUnit`: $10.5K, $10.25K); a 2-pixel line, a 10% wash under it,
  the latest point as a dot with its value (left out when the line comes down into the dot, where it would sit on the
  line; the tile above shows it). Touching or pointing at the line shows the nearest saved day and its balance; on
  touch it stays until the next tap. Drawn to the card's width, and again when the width changes (a phone turned).
  One series, so no legend; the colour is the app's accent (a step deeper in dark mode, checked with the dataviz
  palette checker against both surfaces).

## Edge cases
- No accounts: a hero pointing to Net worth.
- Fewer than two balance points: no line, a sentence saying how to get one, and the add form open below it.
- No transactions for the account: a sentence and a link to Import instead of money in and out.
- No transactions in the last 30 days (an old import): a sentence naming the latest one's day instead of two $0 figures.
- The balance, the change and the 30-day figures are in whole dollars so they fit side by side on a phone (a change
  under $10 has cents); every other amount has cents.
- A future day typed for a balance: refused with one notice (not one per tap).
- A saved point on the balance on file's day with another amount: its row says Net worth's balance is the one used.
- An owner id that is not a person (typed text on Net worth): shown as typed.
- Notes are saved with a button, never on each key; the page warns against passwords and full account numbers.
- Known, in Net worth's lane: "Save today's totals" stamps today on each account's balance on file (known only as of
  its `asOf`) and saves 0 for an account with no balance; this page cannot tell such a point from a real one.

## Tests
`module.test.mjs` (8): balance points (the day on file wins, bad rows and impossible days skipped, a debt as owed
saved or on file, no date, to the cent); the change (amount, share, days, from 0); money in and out (the 30 days and
its first day, six months, a window starting mid-month, months across a new year); since the last check (the latest
check not first in the list, lines cut at the balance's date, the difference, a card, a tie on the last day, a balance
older than the check); the page data (picker, chosen account, owner, latest five, an unknown id, no date); adding and
removing points; saving a balance (an earlier day, the same day, a later day, a debt's sign, no dated balance); the
chart's side (steps, an overdraft, float noise and flat lines, labels in thousands without repeats).

## Ideas / not yet
- Mark the checked statements on the line.
- Interest earned or paid, from the account's transactions in the interest category.
