# What lenders see  (`debt/ratios`)

**Status:** usable (phase 4)
**Purpose:** Debt-to-income, housing and card-use ratios with the lines lenders draw, so you know what an application looks like.

## Inputs
Plan sections read (`needs`): `accounts`, `debts`, `income`, `expenses` (rent when there is no mortgage), through the Debts, Income and Credit cards computes.

## Outputs
`incomeMonthly`, `payments`, `housingPayment`, `dti`, `housingRatio`, `utilisation`, `monthsOfIncomeOwed`, `grades`, `owed`, `hasIncome`, `hasDebts`, `rows[]` (label, value, kind, grade, why).

## Formulas
- Debt-to-income = required debt payments a month / gross monthly income: comfortable to 36%, high to 43%, stretched above. The lines are mortgage underwriting limits: Fannie Mae's manual maximum is 36% (45% with a strong credit score and reserves, 50% through its automated approval; Selling Guide B3-6-02); FHA's manual limit is 43% without compensating factors (47% with one, 50% with two; HUD Handbook 4000.1). The CFPB removed the 43% limit from the General Qualified Mortgage rule in 2021 (a price test replaced it). In FY2025 about 63% of FHA purchase loans were above 43% (HUD, FY2025 Annual Report to Congress on the FHA MMI Fund, Table B-10). All read 2026-10-31.
- Housing ratio = mortgage payment (or housing expenses when there is no mortgage) / gross monthly income: 28% comfortable (the CFPB's homebuying toolkit, "Your home loan toolkit", p. 3), 35% high.
- Card utilisation from the Credit cards page: excellent to 10%, fine to 30%, hurts to 50%, hurts a lot above.
- Months of income owed = everything owed / one month's income.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- A "what could I borrow" line from the 36% and 43% lines; credit-score notes.
