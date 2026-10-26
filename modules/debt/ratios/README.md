# What lenders see  (`debt/ratios`)

**Status:** usable (phase 4)
**Purpose:** Debt-to-income, housing and card-use ratios with the lines lenders draw, so you know what an application looks like.

## Inputs
Plan sections read (`needs`): `accounts`, `debts`, `income`, `expenses` (rent when there is no mortgage), through the Debts, Income and Credit cards computes.

## Outputs
`incomeMonthly`, `payments`, `housingPayment`, `dti`, `housingRatio`, `utilisation`, `monthsOfIncomeOwed`, `grades`, `owed`, `hasIncome`, `hasDebts`, `rows[]` (label, value, kind, grade, why).

## Formulas
- Debt-to-income = required debt payments a month / gross monthly income: comfortable to 36%, high to 43%, stretched above (the usual US mortgage lines).
- Housing ratio = mortgage payment (or housing expenses when there is no mortgage) / gross monthly income: 28% comfortable, 35% high.
- Card utilisation from the Credit cards page: excellent to 10%, fine to 30%, hurts to 50%, hurts a lot above.
- Months of income owed = everything owed / one month's income.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- A "what could I borrow" line from the 43% cap; credit-score notes.
