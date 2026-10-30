# Rental analysis  (`property/rental`)

**Status:** usable, phase 7
**Purpose:** What a rental really earns: rent less empty months and costs, the loan and tax, the checks a lender makes, and what it adds to your wealth.

## Inputs
- `property[]` entries with `kind: "rental"`: `{ id, name, value, accountId?, purchasePrice, purchaseDate, rentMonthly, vacancy, propertyTax, insurance, hoaMonthly, maintenance, management, utilitiesMonthly, otherMonthly, cashIn, loanAccountId?, loanBalance, loanRate, loanPayment, landShare, improvements, appreciation }`.
- A linked property account (value) and mortgage account (balance, with the rate and payment from Debts) when named.
- The federal estimate (top rate, AGI as the modified AGI, filing status) and the state's share of income.

## Outputs
`{ ready, year, rentals: [{ rent, vacancy, income, costs, opex, noi, capRate, debtService, interest, principal, cashFlow, cashIn, cashOnCash, dscr, breakEven, onePercent, basis, depreciation, taxable, lossUsable, lossCarried, tax, afterTax, loan, equity, growth, totalReturn, returnOnEquity }], totals, rates, lossRoom }`.

## Formulas
- Income = rent × 12 × (1 − vacancy, default 5%). Running costs = property tax + insurance + dues + upkeep
  (default 1% of value a year) + manager (share of income) + utilities + other.
- Net operating income (NOI) = income − running costs. Cap rate = NOI ÷ value.
- Loan payments: twelve months on its balance, rate and payment (`cashflow/statement` `yearOfPayments`), split into
  interest and principal. Cash flow = NOI − payments. Cash-on-cash = cash flow ÷ cash put in.
- Debt-service coverage = NOI ÷ payments; lenders usually want 1.25 or more. Break-even occupancy =
  (running costs + payments) ÷ full rent. The "1% rule" = monthly rent ÷ price paid.
- Depreciation (IRS Publication 527): basis = price × (1 − land share, default 20%) + improvements, straight-line over
  27.5 years from the month first rented, mid-month in the first year: (12 − month + 0.5) / 12 of a year; it stops
  once the basis is used up.
- Taxable = income − running costs − interest − depreciation; tax = taxable × (federal top rate + state share).
- A loss: up to the special allowance for active participation (IRC §469(i)): $25,000 less half of modified AGI above
  $100,000 (gone at $150,000; half that on a separate return), shared by all rentals in order; the rest is carried
  forward. The AGI stands in for modified AGI.
- What it adds = cash flow + principal paid + value × appreciation (default 3.5%); on equity = value − loan.

## Edge cases
- No loan: no coverage ratio; cash flow = NOI. No rent or value: the form asks for them first.
- If Income also lists the rent, the federal estimate counts it there; this page's tax line is the rental's own result.
- Real-estate professionals and short-term rentals follow other rules: not modelled.

## Tests
`module.test.mjs`: depreciation (first year, full years, the end), the allowance, not ready, the duplex by hand, a loss
shared by two rentals, linked accounts, no loan.

## Ideas / not yet
- A ten-year hold with the sale: depreciation recapture at up to 25%, gains tax, the return over the hold.
- The rental's rent and costs flowing into Income and the federal estimate's Schedule E line.
