# Check a statement  (`transactions/reconcile`)

**Status:** usable (phase 3; built by claude-b from codex's idle lane)
**Purpose:** Compares a statement's ending balance with your ledger and helps you find what explains any gap.

## Inputs
Plan sections read (`needs`): `accounts`, `transactions`, `reconciliations`. Writes (`writes`): `reconciliations`
(a record when a statement matches; removing one leaves the transactions alone).
`reconcile(plan, { accountId, from, to, startBalance, endBalance })`: the statement's first and last day and its
starting and ending balance, as printed. What is typed is kept in the page (module state) until it is saved; checking
changes nothing.

## Outputs
`reconcile(...)` -> `{ ready, why ("account"|"dates"|"balances"), account, liability, startBalance, endBalance (as
read), minus (a debt's balances typed with a minus sign, read as what is owed), lines (the account's transactions
from the first to the last day, by date, each with `running`, the balance after it, and `dayEnd`, true on the last
line of its day), statementChange, ledgerChange, gap, fix, matches, newest (the account's latest transaction date, or
null), overlaps (this account's saved checks sharing a day with the statement, each with `same` when it has the same
dates), hints: [{ kind, text, ids, amount }] }`.
`compute(plan)` -> `{ accounts: [{ id, name, type, label, liability, lines, last }], records (latest last day first,
with the account's name and `liability`), ready (an account with transactions) }`.
Also exported: `recordOf(result, input, { id, today })`, `saveRecord(list, record)`, `nextStart(plan, accountId)`,
`digitSwaps(cents)`, `NEAR_DAYS`, `MAX_HINTS`.

## Formulas
All in cents, so sums do not drift.
- **The statement's change** = ending balance − starting balance.
- **A debt typed with a minus sign**: for a credit card or a loan, when both balances are typed at or below 0 (one
  below), they are read as what is owed (`Math.abs`, as Net worth's `countedBalance` reads a debt), unless the
  numbers as typed already agree with the transactions (a card in credit at both ends). A credit at one end only is
  read as typed.
- **The ledger's change** = Σ amounts of the account's transactions dated from the first day to the last, both days
  in. For a debt (a credit card, a loan: `isLiability` in `balance/net-worth`) the balance is what you owe, which moves
  the other way: change = −Σ amounts (spending, stored as money out, raises what you owe).
- **Gap** = statement change − ledger change; it matches when the gap is 0 to the cent. **The line that would close
  it** (`fix`, signed as the ledger stores amounts, money in +) = the gap for an account you own, −gap for a debt.
- **Running balance** = the starting balance, then + each amount in date order (− for a debt); lines of one day keep
  the order they are on file. The order inside a day is not the bank's, so the page shows the balance only at the end
  of each day (`dayEnd`), which does not depend on it.
- **What could explain a gap** (at most 3 of each kind, `MAX_HINTS`; a line named by one kind is not offered again by
  a later one, and only when its hint was shown), in this order:
  1. *Entered twice*: a pair from the Duplicates page's finder (`transactions/duplicates` `findDuplicates`: same
     account, same amount, at most a day apart, the same description) whose copy is dated in the statement and whose
     amount is −`fix`. The finder also sees the day before the first day, for a pending line that posted again.
  2. *Over the edge*: a line on file dated up to 3 days (`NEAR_DAYS`) after the last day, or before the first, whose
     amount is `fix` (the bank counted it in this statement); or a line inside, in the last or first 3 days, whose
     amount is −`fix` (the bank put it on the next or the previous statement). Card and bank posting dates can trail
     the day of the purchase by a few days. Days inside another statement of the account already saved as matching
     are left out: their lines were counted there.
  3. *One line of the difference*: a line inside whose amount is −`fix`: on file but maybe not on the statement
     (still pending, or another account's).
  4. *Under another account*: a line of another account (not a transfer between your own) dated in the statement
     whose amount is `fix`: it may belong to this one. Its account is named.
  5. *The wrong sign*: a line whose amount × −2 is `fix` (money in entered as money out moves the balance by twice
     the amount).
  6. *Two lines* that add up to −`fix` (a line of 0, such as a card check, is no part of a pair).
  7. *Two digits swapped*: swapping two different digits of a number changes it by a multiple of 9, so only a gap
     that divides by 9 (in cents) is looked at. Then a line is named when one of its amounts with two digits the
     other way round (`digitSwaps`: any two digits, never a new leading 0) closes the gap: Kroger typed 86.04 for the
     statement's 86.40. The two balances typed on the page are checked the same way (2130.77 typed for 2103.77).
     A fact of arithmetic, said as a possibility; a gap that merely divides by 9 says nothing.
  8. *The starting balance*: the statement starts the day after the last saved check, and the starting balance typed
     differs from that check's ending balance by exactly the gap.
  9. *A missing line* of the gap (money in or out by the sign of `fix`), always last: import the statement or add it.
  Each hint links to the page that fixes it (Duplicates; the account's Ledger; Import), except *over the edge* (the
  bank's dates) and *the starting balance* (the form above).
- **Saved checks**: when it matches, "Save as checked" saves `{ id, accountId, from, to, startBalance, endBalance,
  lines, at }` in `reconciliations` (an optional plan section, `docs/DATA_MODEL.md`), with the balances as read (a
  debt as what is owed). A saved check of the same account and dates is replaced (`saveRecord`); one that shares only
  some days is kept, and the page says so before saving. The next statement for that account starts the day after the
  latest saved one's last day, at its ending balance (`nextStart`); on a tie for the last day the one saved later
  wins.

## Edge cases
- No account with transactions: a hero pointing to Import.
- The last day before the first, a date not typed, or a balance missing: a notice says what to fix; a one-day
  statement works.
- No transactions in the app for the statement's days and a difference: a notice to bring in the statement first,
  instead of a list of ideas. Transactions that stop before the last day: a line names the newest one.
- After Check the page scrolls to the answer (or to the error), just under the top bar.
- An account switched in the form: it fills in where that account's last saved statement ended (or blank).
- Removing the latest saved check of the account in the form, before anything was checked: the form fills in again
  without it.
- A saved check whose account was removed: shown as "An account no longer in the plan" and can be removed.
- A credit balance on a card (it owes you): type it below 0, as the help says. The balance fields have no decimal
  keypad on a phone, because that keypad has no minus key.

## Tests
`module.test.mjs` (14): a matching checking statement (change, running balance, both days counted, a shorter period);
the balance at each day's end (the order on file, the same end either way); a card (what you owe moving the other way,
the line that would close a gap, the double charge first and named once); a card typed with minus signs (read as owed,
kept as typed when it agrees, a credit at one end, an overdraft); each kind of hint (one line of the gap and a missing
line, entered twice and neither copy offered again, a pending copy from the day before, the wrong sign, two lines, a
line of 0, the missing line last); two digits swapped (the swaps of a number, a line, a card line, a typed balance, and
no hint for gaps that only divide by 9); the edges and their 3 days on both sides; a saved statement's days left out;
another account's line and the starting balance; at most three of a kind and a line the cap left out; the newest
transaction; what it needs; the saved record, the next statement's start, the newest saved on a tie and `compute`;
saving again (replace, keep, overlaps).

## Ideas / not yet
- Tick lines off as they are matched against the statement, and keep the ticks.
- Read the statement's dates and balances from the Statement reader when a PDF was imported.
- With the account's balance and its date, check the end balance without the starting one.
- Keep which transactions a saved check covered (or the ledger's change), so a later edit inside a checked statement
  can be flagged.
