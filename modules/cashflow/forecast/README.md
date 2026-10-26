# Cash-flow forecast  (`cashflow/forecast`)

**Status:** usable (phase 4)
**Purpose:** Where your everyday cash is heading over the next three months, day by day, and whether a shortfall is coming.

## Inputs
Plan sections read (`needs`): `accounts` (checking, savings, cash), `transactions` (through Bills and regular payments), `expenses`, `income`, `recurringIgnored`.
`compute(plan, { today, days = 90, accountId = "" })`.

## Outputs
`accounts[]`, `start`, `days[]` (`date`, `balance` after that day, `events[]` `{ name, amount, source }`), `lowest`, `end`, `shortfallDate`, `income`, `spending`, `events`, `sources` (`found`, `planned`, `skipped`), `hasData`.

## Formulas
- Start = today's balances of the everyday accounts (signed).
- Events: (1) every payment found in the transactions, repeated on its cadence from its next date (a missed one from its expected date); (2) bills and pay typed on Expenses/Income, unless a found payment already covers them: shares a word longer than 3 letters, or has the same amount (within 2%) and the same rhythm; typed items land on their start date's day, else the 1st (bills) or the 15th (pay); (3) one-time items with a date inside the window.
- Balance each day = the day before plus that day's events; lowest and first negative day recorded.

## Edge cases
No everyday account or no today: no data. A chosen account only counts found payments on that account and all typed items. Horizon at least 7 days.

## Tests
`module.test.mjs`: planned dates (1st/15th/start/end dates), no data, the 90-day run on the shared fixture (found vs typed, coverage, lowest), a dated shortfall.

## Ideas / not yet
- Let the person move a typed bill to the right day of month from this page.
- Include card autopay from the Debts page as an event.
