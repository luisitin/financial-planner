# Expenses  (`cashflow/expenses`)

**Status:** usable (phase 2)
**Purpose:** Records your expenses by category, amount and frequency, whether each is essential and whether it rises with inflation.

## Inputs
Plan sections read (`needs`): `expenses`, `income` (for "left over"), `household` (through the income compute).
`compute(plan, { today })`: `today` decides which expenses are active.

## Outputs
`items[]` (each expense plus `categoryLabel`, `icon`, `periodLabel`, `monthly`, `yearly`, `active`, `upcoming`, `ended`, `essential`, `inflates`, `oneTime`), `active[]`, `count`, `monthly`, `yearly`, `essentialMonthly`, `optionalMonthly`, `inflatingMonthly`, `oneTime`, `byCategory[]` (`category`, `label`, `icon`, `monthly`, `share`), `income` (`{ monthly, yearly }` or null), `leftOver`, `savingsRate`, `warnings[]`.

## Formulas
- Monthly and yearly amounts: `core/math/periods.js` (`perMonth`, `perYear`); one-offs count only in `oneTime`.
- Essential: the expense's own flag, else the category default in `CATEGORIES` (housing, utilities, groceries, transport, insurance, health, debt, childcare, phone, taxes are must-pay by default).
- Inflates: `inflates !== false` (older items default to rising with prices).
- Category share = category monthly / total monthly.
- Left over = income monthly (from `cashflow/income` compute, same `today`) - expenses monthly. Savings rate = left over / income monthly. Both null without income. This is pay **before tax** minus spending.
- The page's "Left over" tile (2026-11-01, one left-over figure across the app) shows Next best action's `spare.monthly` instead: pay minus federal and payroll tax, spending, retirement saving and goal saving, the same figure as the Dashboard and Set up my plan. Before, the tile showed the before-tax figure as "Left over ... 62% of income", about twice the real amount for the sample family ($8,824 against $4,170). When the tax cannot be worked out yet, the tile is labelled "Before tax" and says tax and saving are not taken out. The next-year sentence no longer adds the before-tax "leaving ..." amount. Needs attention's overspending alert uses the same after-tax figure.

## Edge cases
No income entered: the income comparison is hidden (null), never shown as 100% savings. Spending above income: a warning sentence. Unknown category: "Other". Amount 0 or missing: warning. End before start: warning.

## Tests
`module.test.mjs`: totals and split, category shares and override of the essential default, income comparison and shortfall warning, upcoming/ended/one-off handling.

## Ideas / not yet
- Fill amounts from imported transactions (phase 3): average of the last 3 months per category.
- Per-person expenses for the survivor scenario (phase 8).
