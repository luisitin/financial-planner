# Consolidation  (`debt/consolidation`)

**Status:** usable (phase 4)
**Purpose:** High-rate debts rolled into one (a personal loan, a 0% balance-transfer card, a home-equity line) against paying them as now: the payment, when you are debt-free, the interest and fees.

## Inputs
`accounts` and `debts` (through `balance/liabilities`: balances, rates, payments; mortgages and student loans left out), `whatIfs.consolidation`. Writes `whatIfs.consolidation = { include: [accountId], loanRate, loanMonths, loanFee, btFee, btMonths, btApr, helocRate, helocMonths }`.

## Formulas
- Debts rolled together: the ones chosen, else every one at `HIGH` (10%) or more.
- As now: `core/math/payoff.js` `payoffPlan` with the current payments, highest rate first.
- Personal loan: the fee is taken from the loan, so the loan = owed / (1 - fee); payment = pmt(rate / 12, months, loan); interest = payment x months - loan; fees = loan - owed. Defaults 12%, 36 months, 5%.
- Balance transfer: balance = owed x (1 + fee); paid at the same total payment as now; 0% for the free months, then the card's rate (`payDown`); flagged when it outlasts the free months, with the payment that would clear it in time. Defaults 4% fee, 18 months, 24%.
- Home-equity line: payment = pmt(rate / 12, months, owed); the risk to the home is stated. Defaults 8.5%, 60 months.
- Cost = interest + fees; the cheapest is the lowest.

## Tests
`module.test.mjs`: `payDown` (a free stretch, ordinary, never), no debts, the family's card by hand (as now, loan, transfer, home equity, the cheapest), chosen debts and the transfer outlasting its free months.
