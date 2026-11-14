# Bills and regular payments  (`cashflow/recurring`)

**Status:** usable (phase 4)
**Purpose:** The payments that come back every week, month or year, when the next one is due, and which look missed.

## Inputs
Plan sections read (`needs`): `transactions`, `expenses`, `income`, `recurringIgnored`, and `debts` with their `accounts` (to
know a loan payment that is already on Debts). Writes: `recurringIgnored` ("Not a bill"), `expenses` ("Add to Expenses":
one row with `payeeKey`; "Use $X on Expenses": the amount of a row that still holds a bill's old price, and its `payeeKey`
when it has none).
`compute(plan, { today })`.

## Outputs
`detected[]` (`key`, `payee`, `accountId`, `category`, `cadence`, `cadenceLabel`, `amount` signed, `count`, `first`, `last`, `next`, `missed`, `spread`, `ids`, `monthly`), `planned[]` (from Income/Expenses), `dueSoon[]` (within 14 days, with `days`), `missed[]`, `monthlyOut`, `monthlyIn`, `dismissed`, `total`, `hidden[]`.
Gap #6 (2026-11-13) adds two keys after these, empty with no bank lines:
- `changes[]`: `{ kind: "up", key, payee, from, to, at, cadence, expenseId?, updatedId? }` (a bill went up; `expenseId` is the
  Expenses row that still holds the old price, `updatedId` the row that already holds the new one) and `{ kind: "new", key,
  payee, amount, at, cadence }` (a new regular charge), newest first.
- `inPlan[]`: `{ key, how: "added" | "name" | "debt" | "amount", expenseId?, debtId? }` for the found bills the plan already holds.
Also exported: `wentUp(charges)`, `inPlanOf(plan, bills, { today })`, `billFrom(r, rise?)`, `addBill(draft, r, id, rise?)`,
`changesOf(plan, detected, { today })`, `RISE`, `NEW_DAYS`, `PERIOD_OF`.

## Formulas
- Grouping: account + normalised payee (`normalizePayee`), transfers excluded.
- Cadence: the median gap in days between occurrences must fall in a band (`CADENCES`: weekly 5-9, every two weeks 12-16, twice a month 13-17, monthly 26-35, quarterly 80-100, yearly 340-390) and at least 60% of the gaps must be in that band.
- Amount: the median; `spread` = median absolute deviation / |median|. Two occurrences only count when the amount is identical (spread < 2%) and the cadence is monthly or longer; a spread over 50% is a shop, not a bill.
- Next: the first cadence step after today (months for monthly/quarterly/yearly, days otherwise). Missed: the first expected date after the last occurrence is more than 5 days in the past.
- Monthly figure: |amount| x occurrences per month (52/12, 26/12, 2, 1, 1/3, 1/12).

### What changed (gap #6, design in the gap spec of 2026-11-13, section 4 #6; map lines K8, K3, K6)
None of these is a published figure: the lines ($1, 5%, three charges, 70 days) are the gap spec's design constants, not a
law or a price, so there is nothing to look up. Read and checked against the spec on 2026-11-13.
- **Went up** (`wentUp`): for one bill's charges, oldest first, let a be the newest and m the median of up to three charges
  before it. A rise when a - m >= max($1, 0.05 x m) (`RISE`; a tolerance of 1e-9 so a rise exactly on the line counts:
  17.99 - 15.49 is 2.4999999999999982 in floating point). Only the newest is compared, so a one-off higher charge between
  two usual ones is not a rise. The month said is the first charge at the new price (the run of charges ending with the
  newest that are all at least m + the line); "from" is the charge right before that run.
  **Builder chose**: the up to three charges before that run must be steady (their highest minus their lowest at most
  the same line), so a power or water bill that moves with the season is not called a rise every time it is higher. A
  bill keeps its line until the new price is the median of the three before the newest (two more charges at it).
- **New**: a bill going out whose first charge is at most `NEW_DAYS` = 70 days before today, that the plan does not hold
  (`inPlan`) and that is not hidden. **Builder chose**: the bank file of its account must go back at least one gap of its
  cadence (the band's low end, e.g. 26 days for monthly) before that first charge; otherwise the first import of a file
  would make every bill look new. A bill that is new is not also said to have gone up.
- **In the plan** (`inPlanOf`, builder's rules: the spec asks only that the button not show twice), in this order:
  `payeeKey` equal to the bill's key ("added"); a live Expenses row of the same kind sharing a name word of three letters
  or more, words every bill shares left out ("name"); a debt on Debts whose account name shares a word, else, for a line
  filed as a loan payment or not filed, the debt whose payment (the minimum, or minimum + extra) is closest within 10% a
  month, as Expenses' own `matchDebts` does ("debt"); a live Expenses row of the same kind costing the same a month within
  max($1, 5%), the closest pairs first, each row once ("amount": typed "Rent $1,500" is the $1,500 to the landlord).
  "Of the same kind": the bank line's category is the row's, or the line is not filed under one of Expenses' kinds (the
  "home" of "Car and home insurance" is not the mortgage to Wells Fargo Home: a test on the card-gap household).
- **Add to Expenses** (`billFrom`, `addBill`): `{ id, name: payee, category, amount, period, essential, inflates: true,
  payeeKey }`, where amount is the median charge (to the cent), **builder chose** the newest price when the bill went up
  (the median still holds the old one); period is the cadence's own key (`PERIOD_OF`, the same keys as core/math/periods.js);
  category is the bank line's when it is one of Expenses' kinds, else "other"; **builder chose** `essential` from that
  kind's must-pay default, as Expenses' own add does (the spec wrote `essential: false`: it is false for subscriptions,
  fun and "other", the kinds a new charge usually has, and true for insurance or utilities, which are must-pay).
- **Use $X on Expenses** (builder's addition): offered on a "went up" line when the row found by key or name has the same
  period and an amount within 50 cents of the old price (`expenseId`); it writes the new price to that row, with Undo.
  **Builder chose** (the critic of 2026-11-13, F1): the tap also writes the bill's key to the row's `payeeKey` when it has
  none, since the tap said this row is that bill; from then on the row is known by its key ("added"), whatever its name or
  price, and Undo takes the key off again with the price.
- **Done** (critic F4, builder's rule, 2026-11-13): a "went up" line whose row (found by key or name, same period) already
  holds the new price within 50 cents (`updatedId`) says "Expenses already says $17.99 for it." instead of offering the
  tap. The line itself stays while the rise is news (above). Both sub-lines name the row's own amount, not the bank's:
  a row typed at $15.30 is "Expenses still says $15.30 for it.", and its Undo puts back $15.30.

## First view and parts
Simple first (`docs/OPTIONAL.md`; class C in the simple-first spec, row `cashflow/recurring`: "$X a month in regular bills and
payments" + the six biggest, "N more bills").

First view, top to bottom:
1. The answer: "$1,604 a month in regular bills and payments" (bank files: the found bills' monthly figures added; no bank
   file: the typed bills'), or "No regular bills found yet". One sentence per case (`sentenceOf`): nothing typed and no
   bank file; bills typed, no bank file; one or several bills found, with money coming in or not; none found, with typed
   bills to show or not.
2. The one filled button, only while there is no bank file (or nothing found and nothing typed): "Import a bank file".
3. "What changed" (never folded, R9 item 3): an amber dot per line, one written sentence per kind (`changeSentence`):
   "Netflix went up from $15.49 to $17.99 in October." (with "Expenses still says $15.49 for it." and "Use $17.99 on
   Expenses" when it applies, or "Expenses already says $17.99 for it." once it has the new price), "New: Gym Co, $39 a month since October 3. A new bill?" with "Add to Expenses" and
   "Not a bill" (outlined), "Gym Membership looks missed: it was expected August 20." with "Not a bill". Missed lines
   first (they may be a payment that failed), then the rest newest first; after three, "N more changes" (`rest`, kind
   more); a missed line is never cut. When a bill went up, "How to ask for a lower price" (outlined, `data-worth`, never
   folded) opens that part on Subscriptions (`?show=lower`).
4. "Biggest first": the six biggest bills by their monthly figure (found ones: cadence and when the next is due, "due in
   3 days" within two weeks; typed ones: tap opens its form on Expenses), then "N more bills" (`rest`). This replaces the
   old "Due in the next two weeks" card. Under typed bills: ended and not-yet-started ones ("Not counted: ...", F-026) and
   "Change these on Expenses".

One tap away (`parts()`, one card):

| part | kind and title | holds | status |
|---|---|---|---|
| `each` | own, "See or change each bill" (pinned) | every found payment (records: amount, cadence, last date, times so far, kind; where it is in the plan: "On Expenses as Netflix ›", "Looks like Rent on Expenses ›", "Paid on Debts: Car loan", 'Maybe part of "Streaming" on Expenses', "Maybe counted under Subscriptions on Expenses", "Not on Expenses yet"; "Add to Expenses" and "Not a bill" / "Not regular"), then the bills and pay typed on Expenses and Income | "3 not on Expenses" or "14 found" |
| `how` | how, "How this is worked out" | the monthly sums, how a bill is found, the rules for went up, new, looks missed and on Expenses, what is hidden | - |
| `hidden` | item, "Payees you hid" (shared with Subscriptions) | each hidden payee with "Put back" | "2 payees" |

"More on this": "What renews by itself, and what does it cost a year?" (Subscriptions, with its yearly figure), "Will my
checking account run low before payday?" (Forecast), "What do I spend each month?" (Expenses).

Confirmations (R7, R9 item 8, R17): said in the card or part the tap was in (that part opens on the next draw; no other
part changes), else under the answer. "Added Gym Co to Expenses: $39 a month, under Fun and hobbies. Change it there any
time." (`addedWords`: when Expenses already has bills of that kind typed by hand, it names the one to lower if it already
counted this one), with Undo ("Gym Co is off Expenses again."). "Netflix on Expenses is now $17.99 a month." with Undo.
Each Add and Use keeps its Undo for the visit (critic F3: Use, then Add, lost the Use's Undo): the green line holds the
latest tap's; once a later tap has taken the green line, an earlier one's outlined "Undo" is where its bill is: a Use's on
its "went up" line (done), an Add's on the bill's row in "See or change each bill", where its "Add to Expenses" was (its
label says what it does: "Undo: put Netflix back to $15.49 on Expenses", "Undo: take Gym Co off Expenses"). An Undo works
once (`ui.undoable`); a visit is one route object (the redraw after a save keeps it), so another arrival on the page
shows none.

Builder's choices (beyond the formulas above): missed lines moved into "What changed" (one amber card, not two); found
pay is not in "Biggest first" (the page answers "Which bills come every month?"); its sum is in the sentence and in "How
this is worked out", each paycheck in "See or change each bill" with "Not regular". Found bills are read-only on the first
view; "Add to Expenses" and "Not a bill" on every row are one tap away, as the spec's "On request" says. The rows show each
bill's median charge, as the headline sums them; a bill that went up says its new price in its line.

## Edge cases
No transactions: the typed items still list, and nothing about changes is drawn. A dismissed key stays out until "Put
back" (Payees you hid). A payee whose gaps change cadence (weekly then monthly) is dropped rather than guessed. With no
today, nothing is new. A bill already on Expenses under a typed group ("Streaming $48") cannot be told from a new one;
the row says 'Maybe part of "Streaming" on Expenses' (the typed name in quotes: "Electric, water, gas" is one row) and the
green line after an add names the row to lower.

A salary typed as a yearly (or quarterly) figure, the setup's default, is paid in paychecks, not once a year
(`payRhythm` in core/math/periods.js: the Paycheck page's count for that person, else 26, every two weeks). Bills and regular payments labels it "A year, paid every two weeks" instead of "once a year" (2026-11-02).

## Tests
`module.test.mjs`: date helpers, monthly/biweekly/yearly detection, a shop and transfers excluded, a missed gym, totals,
dismissals, empty plan. The fixture `recurringPlan()` is shared with Forecast, Irregular expenses and Subscriptions; the
gap #6 tests run only when this file is the one under test (`OWN`), so those files do not run them again.
Gap #6: went up (2% no; 5% and $1 yes; 5% under $1 no; a one-off higher charge no; the month of the rise; a seasonal bill
no), changes on an invented household (`changesPlan()`: Netflix up in October, Gym Co new, a 2% phone rise, typed rent),
new (a file that only starts there, 102 days old, added, hidden, no today), in the plan (key, name, debt, amount, a second
row of the same amount, the card-gap household's mortgage, car loan and water), Add to Expenses' row; the sentences per
case for the answer, the change lines and the green line; on the page (real UI kit on qa/fixtures/fake-dom.mjs): the first
view (no hand-written fold, no filled button with a bank file, one Add and one Not a bill outside the parts), Add to
Expenses writes one row and the line and button go, Not a bill hides the line, Use $17.99 on Expenses, the saved part
stays open alone and a save outside every part opens none (S11, R17: Add inside See or change each bill, Add on the
What changed line, Put back under Payees you hid), no bank lines draws nothing about changes. The critic of 2026-11-13, each failing first:
`updatedId` (the old price, the new one, 50 cents off, another price, another period); Use ties the row by its key and
the line then says "Expenses already says $17.99 for it." on this and the next visit, as for a row typed at the new
price; a row at $15.30 is said and put back as $15.30; and, on one visit run as the shell runs it (one route, one store,
a redraw after each tap): Use, Add, then the Netflix line's own Undo puts back Netflix alone; Add, Use, then Gym Co's Undo
on its row; an Undo used in the green line is not offered again; another visit shows none. Invariance (gap spec 3.5): with no `payeeKey`, the old
keys of compute() are byte-identical to c5779a2's over every qa/fixtures plan, recurringPlan, the empty plan and the 1,400
qa/households plans (digests in the test); and with `payeeKey` on every bill, every page that reads the bills or the bank
lines (cashflow, transactions, household, balance, debt) works out the same figures.

## Ideas / not yet
- A quiet "A bill went up" item on Needs attention (gap spec F2, claude-f's page).
- Subscriptions counts a bill added or updated here as typed and found once only when their names share a word of four
  letters and the amounts are within 50 cents: after "Use $17.99 on Expenses" it counts Netflix twice ($15.49 found and
  $17.99 typed), and a short name ("HBO", "Max") twice (critic F1). Hand-over, in subscriptions/compute.js (not in this
  change's files): match a typed row by `e.payeeKey === i.key`, and by name at the found bill's new price after a rise.
  Its two tests wait in subscriptions/module.test.mjs as `todo`.
- The usual charge is the median of every charge in the bank files (before gap #6, frozen by the invariance test): after a
  rise it stays the old price until the new one is most of the charges (nine at $15.49, then $17.99: ten months), while
  the "went up" line and "now $17.99" go after three. Taking the median of the newest charges would move Forecast,
  Subscriptions and the other readers: a figure change for its own commit.

## Touch and input stress test (2026-11-11, claude-g)
- "Not a bill" asks first, naming the payee, and says what it did (p-cashflow-b-goals F3: one tap hid it from two pages with no
  word, and a second quick tap hid the next row). The hidden payees are listed at the bottom with "Put back" (removes the key
  from `plan.recurringIgnored`); since gap #6 they are the part "Payees you hid" (`hiddenPart`, shared with Subscriptions;
  `hiddenCard` draws it as a folded card of its own).
- With no bank file the hero says these are the bills you typed and keeps the filled "Import a bank file" (CF-5). Each typed bill
  opens its own form on Expenses (`#/cashflow/expenses?edit=<id>&back=cashflow/recurring`), with "Change these on Expenses" and
  "Change what comes in" (CF-5, F2).
- Typed income rows are not tappable (Income has no one-row address); "Change what comes in" goes there (tester 2026-11-11).

## Lines left out of the totals (gap #32, 2026-11-14)
A transaction the person left out of the totals on the Transactions page (a purchase to be paid back, the money back, a
one-time thing left out of reports) is not read when looking for bills that repeat (`compute` passes ledger
`counted(plan)` to `detectRecurring`): a bill that is paid back is no bill to expect. With none marked the lines read are
the plan's own list (`tests/left-out.test.mjs`).
