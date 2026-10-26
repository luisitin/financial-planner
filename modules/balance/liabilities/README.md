# Debts  (`balance/liabilities`)

**Status:** usable (phase 2)
**Purpose:** Lists every debt you owe with its interest rate, term, minimum payment and whether anything secures it, plus payoff dates and the debt-to-income ratio.

## Inputs
Plan sections read (`needs`): `accounts` (liability types from `balance/net-worth`), `debts` (detail per account: `{ id, accountId, rate, minPayment, extra, termMonths?, startDate?, securedBy? }`), `income` (for the debt-to-income ratio, through `cashflow/income`).
`compute(plan, { today })`: `today` for payoff dates.

## Outputs
`rows[]` (account fields plus `icon`, `typeLabel`, `owed`, `detail`, `rate`, `minPayment`, `extra`, `payment`, `interestMonthly`, `months`, `payoffDate`, `totalInterest`, `expensive`, `neverPaysOff`), `count`, `withDetail`, `owed`, `minimums`, `payments`, `interestMonthly`, `avgRate`, `income`, `dti`, `highest`, `warnings[]`.

## Formulas
- Interest per month = balance x rate / 12.
- Months to payoff at the current payment (required + extra): `nper(rate / 12, payment, balance)` (`core/math/finance.js`), rounded up. Infinity when the payment does not cover the interest.
- Payoff date = today + months (`core/math/dates.js` `addMonths`).
- Interest still to come: `amortization({ principal, annualRate, payment })` total interest.
- Average rate: weighted by balance over debts that have a rate.
- Debt-to-income = monthly debt payments / monthly gross income (from the Income page). 36% and 43% are the usual lender thresholds shown on screen.
- "Expensive" = rate at or above `HIGH_RATE` (15%) with a balance.
- Sort: highest rate first (the avalanche order), then largest balance.

## Edge cases
No liability accounts: empty state pointing to Net worth. Debt without detail: listed with "needs details", excluded from average rate and payoff. Payment below interest: warning. Balance 0: paid off. Detail whose account was deleted: ignored.

## Tests
`module.test.mjs`: no debts, missing detail, nper agreement and payoff date, expensive flag, weighted rate, DTI, never-pays-off and zero balance.

## Ideas / not yet
- Snowball vs avalanche schedules with a fixed extra budget (phase 4 `debt/payoff`).
- Amortisation tables and refinance comparison (phase 4 `debt/mortgage`, `debt/refinance`).
