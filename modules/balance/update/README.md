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
- `looksLikeSlip(was, now)`: the two whole-dollar figures are one key slip apart, decided on the digits: one digit
  added or dropped anywhere (115,000 for 11,500; 105,000 for 15,000), two zeros added or dropped (100,000 for 1,000), or
  two neighbouring digits swapped with at least 15% between them. Both at least $100. Review 2026-11-02: it used a ratio
  of about 10, which flagged ordinary months (checking from 600 to 5,400) and missed a stray zero inside a figure. Some
  real changes still look like a slip (a card from 6,400 to 640), so "it changed" is always the default answer.
- `slipsIn(plan, typed)`: the boxes that look like slips. The page asks before saving. One box: "It changed" (filled),
  "$115,000 was a mistake" and "Let me fix what I typed" (the slip may be the new figure: it puts the cursor back in that
  box). Several boxes: one answer each ("It changed" chosen, "$X was a mistake" to pick), then one Save, so a real
  paydown is not erased to fix a typo beside it. The Save button hides while the question is open; Enter cannot save past
  it, and editing a box closes it (Save asks again). A save that fixed a mistake offers Undo.
- `markTyped(draft, id, today)` and `accounts[].typedOn`: the day the balance on file was typed. `correctSlip` moves saved
  totals only from that day (a back-dated "as of" no longer shifts totals saved before it was typed), and today's saved
  total is refreshed whenever a balance is typed on Account detail or Net worth, so a total on that day holds it
  (review 2026-11-02: a fake dip and recovery).
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

## Another currency, a part share (gap list, next 60, items 18 and 19; 2026-11-17)
An account in another currency or only partly the household's (balance/net-worth/worked.js) asks its whole, in its own
currency: the box's sign is the code ("EUR"), its spoken name "Paris savings: balance in euros" (", the whole account" for a
share), and the line under it "Savings or money market · in euros at $1.08 a euro" / "· the whole account; your half counts".
`compute()` adds `rows[].own: { code, share, rate, full, words }` and `rates: [{ code, rate, asOf }]` only for such a plan.
With a currency on file, "Currency rates" comes first: one box "1 euro in dollars" per currency, "Your rate of 11/10/2026.
Leave it if it is still right today; every account in euros moves with it." `saveAll(draft, typed, today, { corrections,
rates })` writes each rate first (net-worth/worked.js `setRate`, dated today, as a balance left as it is), then each balance
through `saveBalance(..., { own: true })`; it returns `rated` only when a rate moved, and the green line adds "The euro rate is
now $1.10 (was $1.08)." with the page's Undo. The slip check compares the whole in its own currency (EUR 12,000 on file,
EUR 1,200 typed), and "was a mistake" fixes the history with what that whole counts. A plan without these accounts: as before.
A box left as it is saves the balance to the cent: a whole read back from a balance written in dollars ($100.37 at $1.08
reads EUR 92.94) is not worked out again (EUR 92.94 x 1.08 = $100.38 would be a change nobody made), and a rate box left as
it was moves only the rate's day (net-worth/worked.js `asItStands`, `setRate`; critic F1, 2026-11-17). An account whose
currency has no rate (none on file, none typed: a hand edit or an old backup) is never saved in dollars: with its balance
changed and its rate box empty, the rate box is refused first ("Type what 1 euro is worth in dollars first: Paris savings is
in euros, and its balance counts at that rate."); left as it was, it is passed over and said: `saveAll` returns `noRate:
[{ id, name, code }]`, and the page reads "Nothing was saved. Paris savings is in euros: type what 1 euro is worth in
dollars above it, then save." (or, beside balances that saved, "Left as it was: ..."), never "every box was empty" (critic
F2).
