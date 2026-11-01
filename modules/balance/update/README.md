# Update my balances  (`balance/update`)

**Status:** usable
**Purpose:** every account on one screen: type today's balances, save once; each is dated today, kept in its account's
history, and today's totals go on the net worth history.

Built for the owner's request (2026-11-01) for the biggest experience improvements. Before this page, bringing ten
balances up to date meant ten trips through Net worth's Edit form, and an edited balance kept its old "as of" date, so
the monthly review still called it stale and Account detail drew no point for it.

## Inputs
Plan sections read (`needs`): `accounts` (name, type, balance, asOf, history), `netWorthHistory`.
Parameters: `today` ("YYYY-MM-DD", the shell passes the local day).

## Outputs
`compute(plan, { today })` ->
- `rows`: one per account, what you own first (biggest first), then what you owe: `{ id, name, typeLabel, debt,
  balance, asOf, days, stale }`. `balance` is as typed on the page: what is owed for a debt (always positive), the
  signed balance for an asset (an overdraft is negative). `days` since `asOf` (null when not dated); `stale` when not
  dated or older than `STALE_DAYS` (31, the monthly review's rhythm).
- `count`, `stale` (how many are stale), `oldest` (earliest `asOf`), `netWorth` (Net worth's figure), `lastSaved` (last
  net worth history point).

`saveAll(draft, typed, today)` -> `{ saved, changed, netWorth, before }`; changes the draft in place.

## Formulas
- Days old = calendar days from `asOf` to today (`core/math/dates.js` `daysBetween`).
- Saving one account is Account detail's `saveBalance` (`balance/accounts/compute.js`): a history point dated today
  (replacing one of the same day), and the balance on file and its `asOf` set to today. A debt keeps the sign it is
  stored with. An `asOf` in the future (a typo) is replaced by today, because the balance typed is today's.
- A balance typed the same as the one on file is still saved: it means "still right today", so its date moves to today
  and it stops being stale. A box left empty leaves that account alone.
- Today's totals = Net worth's own compute (`assets`, `liabilities`, `netWorth`) on the saved plan, written to
  `netWorthHistory` dated today (replacing an earlier save of the same day), as Net worth's "Save today's totals" does.
- "Up/down since" compares with the last history point before today.

No outside code or figures.

## Edge cases
No accounts: a hero with Set up my plan and Net worth. Every box empty: nothing saved, a red notice says to type at least
one. A box that is not an amount holds the form (the money box's own message). Debts can't be typed negative (min 0).

## Tests
`module.test.mjs`: order and staleness, debts shown as owed, an undated account, saving dates everything today and adds
history points, unchanged balances count as still right, empty boxes are left alone, debts keep their stored sign, a
future `asOf`, today's totals replace a same-day point, "before" is the last point before today, a bad date saves nothing.

## Ideas / not yet
- Show each account's last statement balance from imported transactions as a hint under the box.
- A "same as last time" tick per row for accounts that rarely change (the house, the car).
