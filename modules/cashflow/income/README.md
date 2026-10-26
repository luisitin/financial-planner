# Income  (`cashflow/income`)

**Status:** usable (phase 2)
**Purpose:** Records each income source per person with how often it is paid, how it grows, whether it is taxed and when it starts and ends.

## Inputs
Plan sections read (`needs`): `income`, `household` (names for `personId`).
`compute(plan, { today })`: `today` (ISO day) decides which items are active; without it everything counts.

## Outputs
`items[]` (each income plus `typeLabel`, `icon`, `periodLabel`, `personName`, `monthly`, `yearly`, `active`, `upcoming`, `ended`, `nextYear`, `oneTime`), `active[]`, `count`, `monthly`, `yearly`, `nextYear`, `taxableYearly`, `untaxedYearly`, `oneTime`, `byType`, `byPerson[]`, `warnings[]`.

## Formulas
- Yearly = amount x times per year (`core/math/periods.js`: weekly 52, every two weeks 26, twice a month 24, monthly 12, quarterly 4, yearly 1, one time 0). Monthly = yearly / 12, so "every two weeks" gives 26/12 of the amount per month, which is what a budget should assume.
- Active = start date not after today and end date not before today (`activeOn`).
- Next year = sum over active items of yearly x (1 + growth). Growth is a fraction (0.03); the form's percent field converts.
- One-time amounts (`period: "once"`) are summed into `oneTime` and never into monthly or yearly.
- Taxable: `taxable !== false` counts as taxed (older items without the flag are taxed).

## Edge cases
No people: items are "Household". Unknown `type`: treated as other. Amount 0 or missing: warning. End before start: warning. Growth above 25%: warning (usually a unit mistake). Unknown period: treated as monthly.

## Tests
`module.test.mjs`: empty plan, bi-weekly normalisation, next-year raise, start/end/one-off handling, warnings, byType.

## Ideas / not yet
- Pay-stub detail (pre-tax deductions, 401(k) match) for the tax and retirement pages.
- Irregular income smoothing (average of the last 12 months of transactions) once phase 3 lands.
