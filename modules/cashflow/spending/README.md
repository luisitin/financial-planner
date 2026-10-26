# Where the money goes  (`cashflow/spending`)

**Status:** usable (phase 3)
**Purpose:** Spending by category and by payee for a month, against the month before.

## Inputs
Plan sections read (`needs`): `transactions`, `categories`. Writes nothing. `compute(plan, { month, today })`; `month` defaults to the latest month with spending.

## Outputs
`{ month, label, months[], total, count, previous ({ ym, label, total } | null), change, byCategory[] ({ category, label, icon, total, share, count, previous, change }), topPayees[], biggest[], daily[], hasData }`.

## Formulas
- Spending = transactions in the month whose category kind is expense (uncategorised money out counts too); transfers excluded; amounts as absolute values.
- Share = category total / month total. Change = (this month - last month) / last month per category and overall; null when last month had nothing.
- Top payees by total; biggest five single lines; `daily` totals per day of month (for a future chart).

## Edge cases
No spending at all: empty state. A month asked for that has no spending falls back to the latest.

## Tests
`module.test.mjs`: default month, totals and exclusions, shares and changes, unfiled bucket, payees and biggest lines, month choice and fallback.

## Ideas / not yet
- A calendar heat map and a 12-month trend line (uPlot, vendored).
- Merchant merging (Amazon Mktpl + Amazon Prime -> Amazon).
