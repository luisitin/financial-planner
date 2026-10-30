# Cash-flow statement  (`cashflow/statement`)

**Status:** usable, phase 4
**Purpose:** A year of your money the way a business reports it: living, investing and debts, adding up to what is left in cash.

## Inputs
- `income[]`, `expenses[]` (through `cashflow/income`, `cashflow/expenses`).
- The federal and payroll tax and goal saving from `overview/next-best-action`'s `spare`; the state's tax from `taxes/state`.
- `retirement.contributions[]` (through `retirement/contributions`): your own money and the employer's match.
- Debts with a payment (through `balance/liabilities`).
- `transactions[]` for the bank-file part.

## Outputs
`{ ready, missing, year: { operating, investing, financing (each { lines: [{ label, amount }], total }), net, goals, matched, principal } | null, actual: { months, from, to, operating: { in, out, total }, financing: { total }, net } | null }`; money in positive, out negative.

## Formulas
- **Living (operating)** = each income type's yearly amount − federal income tax − Social Security and Medicare tax
  − state income tax − living costs, where living costs = the year's expenses minus the ones that are loan payments.
- An expense **is a loan payment** when its monthly amount is within a dollar of a debt's payment (or minimum); each
  debt and each expense is matched once. Other expenses in the "Loan and card payments" category are "Other loan
  payments" under debts.
- **Investing** = −(your own contributions to retirement and health accounts) − (contributions to brokerage or crypto
  accounts). The employer's match never passes through your bank: noted, not counted.
- **Debts (financing)**: for each debt with a payment, twelve months of payments that stop once it is paid off:
  interest = Σ balance × rate / 12, paid = Σ min(payment, balance + interest), principal = paid − interest.
  Interest is listed with the debts (the whole cost of borrowing in one place; US business statements usually put it
  under operating; IFRS allows either).
- **Left in cash** = living + investing + debts. Goal saving stays in savings accounts, so it is part of it (noted).
- **Bank files**: the last twelve complete months (this month left out); transfers between your own accounts left out
  (`transactions/ledger` `isTransfer`); income kinds in, the "Loan and card payments" category under debts, every
  other outflow living.

## Edge cases
- Nothing entered: a hero. Only bank files: just that part. Only the plan: just the year.
- A debt with no payment adds nothing; a payment that does not cover the interest pays only interest.

## Tests
`module.test.mjs`: a year of payments by hand, matching, not ready, the family's year line by line against the plan's
spare money, a state tax line, an unmatched loan payment, the bank files' window and classification.

## Ideas / not yet
- Investing from the bank files when transfers into investment accounts are tagged.
- The same statement for last year from the transactions, next to this year's plan.
