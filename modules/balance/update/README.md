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

A loan or card saved at $0 whose payment is still on Expenses (Expenses' `ended`): a green line under the saved notice
says it is paid off and links to Expenses to stop the payment (2026-11-02).

## Typing slips (2026-11-02)
Fixing an old typo used to be recorded as a real change: 115,000 typed for 11,500 last month, corrected today, kept the
wrong figure as a point and put "-$103,500 since 10/2/2026" on the Dashboard for good.
- `looksLikeSlip(was, now)`: the new figure looks like the one on file with a key slipped. A digit added or dropped (the
  ratio is 8 to 12.5, or 80 to 125) or two neighbouring digits swapped with at least 15% between them. Both at least $100.
  An ordinary big change (a card paid off to $0, a 20% move) is not asked about. The thresholds are the builder's choice,
  set so a stray or missing zero is always caught and normal months never are.
- `slipsIn(plan, typed)`: the boxes that look like slips. The page asks before saving: "$115,000 was a mistake",
  "Both are right: it changed", or "Let me fix what I typed" (the slip may be the new figure: it puts the cursor back in
  that box). The Save button hides while the question is open.
- `correctSlip(draft, id, value)`: the account's points carrying the wrong figure, from the day it stood (the balance on
  file's date, or the earliest of the run of equal points that ends the history), take the right one; Net worth's saved
  totals from that day move by the difference (what is owed, for a debt). `saveAll(..., { corrections })` runs it first and
  does not keep the wrong figure as a point; `corrected` counts them and the message says "1 typing mistake fixed in the history".
- A move under 50 cents reads "the same as on <date>" (and "No change since" on Net worth and the Dashboard), not "up $0".

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
