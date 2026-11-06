# Debts  (`balance/liabilities`)

**Status:** usable (phase 2)
**Purpose:** Lists every debt you owe with its interest rate, term, minimum payment and whether anything secures it, plus payoff dates and the debt-to-income ratio.

## Inputs
Plan sections read (`needs`): `accounts` (liability types from `balance/net-worth`), `debts` (detail per account: `{ id, accountId, rate, minPayment, extra, termMonths?, startDate?, securedBy? }`), `income` (for the debt-to-income ratio, through `cashflow/income`).
`compute(plan, { today })`: `today` for payoff dates.

## Outputs
`rows[]` (account fields plus `icon`, `typeLabel`, `owed`, `detail`, `rate`, `minPayment`, `extra`, `payment`, `interestMonthly`, `months`, `payoffDate`, `totalInterest`, `expensive`, `neverPaysOff`, `byGuesses?`), `count`, `withDetail`, `owed`, `minimums`, `payments`, `interestMonthly`, `avgRate`, `income`, `dti`, `highest`, `warnings[]`.

## Formulas
- Interest per month = balance x rate / 12.
- Months to payoff at the current payment (required + extra): `nper(rate / 12, payment, balance)` (`core/math/finance.js`), rounded up. Infinity when the payment does not cover the interest.
- Payoff date = today + months (`core/math/dates.js` `addMonths`).
- Interest still to come: `amortization({ principal, annualRate, payment })` total interest.
- Average rate: weighted by balance over debts that have a rate.
- Debt-to-income = monthly debt payments / monthly gross income (from the Income page). 36% and 43% are the usual lender thresholds shown on screen.
- "Expensive" = rate at or above `HIGH_RATE` (15%) with a balance, unless the debt rests on our guesses alone:
  `byGuesses` (present only when true) = both what is owed (`accounts[<id>].balance`) and the rate
  (`debts[<id>].rate`) are our guesses (core/estimate `isGuess`; a plan with no `guesses` is never looked at). Such a
  debt gets no "expensive" flag, warning or Needs attention alert: a guess never turns a figure amber by itself
  (smart-guesses spec P7; C2 review, 2026-11-06). A typed balance or rate keeps the flag as before.
- Sort: highest rate first (the avalanche order), then largest balance.

Paid off (round 4, 2026-11-02): a debt with its details and nothing owed (`paidOff`) has payment and minPayment 0, so
"Paying each month", debt-to-income, What lenders see and Expenses' check drop it; the row says "paid off" with no
payment. `typedPayment` keeps the payment typed, so Expenses can still find the expense that was its payment.

## Edge cases
No liability accounts: empty state pointing to Net worth. Debt without detail: listed with "needs details", excluded from average rate and payoff. Payment below interest: warning. Balance 0: paid off. Detail whose account was deleted: ignored.

## Tests
`module.test.mjs`: no debts, missing detail, nper agreement and payoff date, expensive flag, weighted rate, DTI, never-pays-off and zero balance; a card whose balance and rate are both our guesses is not flagged (no warning, no alert) while a typed balance or rate still is.

## Both payoff dates (round 4, 2026-11-02)
A debt the payoff plan finishes sooner (debt/payoff `twoDates`) reads "paid off by January 2046 on its own payment, March 2039 on your payoff plan", and a line under the list says why (each debt's payment moves onto the next once it is paid off), with a link to Pay off debts.

## Ideas / not yet
- Snowball vs avalanche schedules with a fixed extra budget (phase 4 `debt/payoff`).
- Amortisation tables and refinance comparison (phase 4 `debt/mortgage`, `debt/refinance`).
