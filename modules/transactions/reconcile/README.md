# Reconcile  (`transactions/reconcile`)

**Status:** usable (phase 3; built by claude-b from codex's idle lane)
**Purpose:** Compares a statement's ending balance with your ledger and helps you find what explains any gap.

## Inputs
Plan sections read (`needs`): `accounts`, `transactions`, `reconciliations`. Writes (`writes`): `reconciliations`
(a record when a statement matches; removing one leaves the transactions alone).
`reconcile(plan, { accountId, from, to, startBalance, endBalance })`: the statement's first and last day and its
starting and ending balance, as printed. What is typed is kept in the page (module state) until it is saved; checking
changes nothing.

## Outputs
`reconcile(...)` -> `{ ready, why ("account"|"dates"|"balances"), account, liability, lines (the account's transactions
from the first to the last day, by date, each with `running`, the balance after it), statementChange, ledgerChange,
gap, fix, matches, hints: [{ kind, text, ids, amount }] }`.
`compute(plan)` -> `{ accounts: [{ id, name, type, label, liability, lines, last }], records (newest first, with the
account's name), ready (an account with transactions) }`.
Also exported: `recordOf(result, input, { id, today })`, `nextStart(plan, accountId)`, `NEAR_DAYS`, `MAX_HINTS`.

## Formulas
All in cents, so sums do not drift.
- **The statement's change** = ending balance − starting balance.
- **The ledger's change** = Σ amounts of the account's transactions dated from the first day to the last, both days
  in. For a debt (a credit card, a loan: `isLiability` in `balance/net-worth`) the balance is what you owe, which moves
  the other way: change = −Σ amounts (spending, stored as money out, raises what you owe).
- **Gap** = statement change − ledger change; it matches when the gap is 0 to the cent. **The line that would close
  it** (`fix`, signed as the ledger stores amounts, money in +) = the gap for an account you own, −gap for a debt.
- **Running balance** = the starting balance, then + each amount in date order (− for a debt).
- **What could explain a gap** (at most 3 of each kind, `MAX_HINTS`), in this order:
  1. *Over the edge*: a line on file dated up to 3 days (`NEAR_DAYS`) after the last day, or before the first, whose
     amount is `fix` (the bank counted it in this statement); or a line inside, in the last or first 3 days, whose
     amount is −`fix` (the bank left it for the next or the last statement). Card and bank posting dates can trail the
     day of the purchase by a few days.
  2. *Entered twice*: a pair from the Duplicates page's finder (`transactions/duplicates` `findDuplicates`: same
     account, same amount, at most a day apart, the same description) whose amount is −`fix`.
  3. *One line of the gap*: a line inside whose amount is −`fix` and not already named above: on file but maybe not
     on the statement (still pending, or another account's).
  4. *The wrong sign*: a line whose amount × −2 is `fix` (money in entered as money out moves the balance by twice
     the amount).
  5. *Two lines* that add up to −`fix`.
  6. *Two digits swapped*: the gap in cents divides by 9. Swapping two neighbouring digits changes a number by 9 ×
     their difference × a power of ten (86.41 typed as 86.14 is 0.27 off), so a gap that divides by 9 points to a
     typed amount; a fact of arithmetic, said as a possibility.
  7. *A missing line* of the gap (money in or out by the sign of `fix`), always last: import the statement or add it.
- **Saved checks**: when it matches, "Mark as reconciled" saves `{ id, accountId, from, to, startBalance, endBalance,
  lines, at }` in `reconciliations` (an optional plan section, `docs/DATA_MODEL.md`). The next statement for that
  account starts the day after the latest saved one's last day, at its ending balance (`nextStart`).

## Edge cases
- No account with transactions: a hero pointing to Import.
- The last day before the first, a date not typed, or a balance missing: a notice says what to fix; a one-day
  statement works.
- An account switched in the form: it fills in where that account's last saved statement ended (or blank).
- A saved check whose account was removed: shown as "An account no longer in the plan" and can be removed.
- A credit balance on a card (it owes you): type it below 0, as the help says.

## Tests
`module.test.mjs` (7): a matching checking statement (change, running balance, both days counted, a shorter period);
a card (what you owe moving the other way, the line that would close a gap); each kind of hint (one line of the gap
and a missing line, entered twice and not offered twice, the wrong sign, two lines, digits swapped and not, the
missing line last); the edge with its 3 days; at most three of a kind; what it needs; the saved record, the next
statement's start and `compute`.

## Ideas / not yet
- Tick lines off as they are matched against the statement, and keep the ticks.
- Read the statement's dates and balances from the Statement reader when a PDF was imported.
- With the account's balance and its date, check the end balance without the starting one.
