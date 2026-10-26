# Mortgage  (`debt/mortgage`)

**Status:** usable (phase 4)
**Purpose:** Your mortgage's schedule, and what extra payments, paying every two weeks or a recast would save.

## Inputs
Plan sections read (`needs`): `accounts` (the mortgage account; a Real estate account gives the home value), `debts` (rate, required payment, extra, term), `debtPlan.mortgageAccountId` (optional choice when there are several).
`compute(plan, { today, extra, lump })`.

## Outputs
`mortgage`, `home`, `base` (months, endDate, totalInterest, payment), `withExtra` (monthsSaved, interestSaved), `biweekly`, `recast` (newPayment, monthlySaving), `pmi` (ltv, dropAtBalance, monthsUntilDrop, dateDrop), `schedule[]` per year, `hasData`.

## Formulas
- Months left at a payment: `nper(rate/12, payment, balance)`; interest to come from `amortization` at that payment.
- Extra each month: the same with payment + extra. Every two weeks: half a payment 26 times a year = 13 payments a year = payment x 13/12 each month.
- Recast: the payment that amortises (balance - lump) over the months left at the current pace (`pmt`).
- Mortgage insurance: usually removable when the balance falls to 80% of the home's value; months until then simulated at the current payment plus extra.

## Edge cases
No mortgage account, or no rate/payment: empty state pointing to the right page. No home value: no insurance figure and a note.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Points and rate buydown; ARM resets; property tax and insurance escrow lines.
