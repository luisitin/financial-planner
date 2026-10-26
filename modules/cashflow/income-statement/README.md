# Income statement  (`cashflow/income-statement`)

**Status:** usable (phase 3)
**Purpose:** What came in, what went out and what you kept, month by month, from your real transactions; next to what the Income and Expenses pages say should happen.

## Inputs
Plan sections read (`needs`): `transactions`, `categories`, `income`, `expenses` (the last two through their computes). Writes nothing.
`compute(plan, { months = 12, today })`.

## Outputs
`rows[]` newest first: `{ ym, label, in, out, net, rate, count, uncategorised, complete }`; `totals` and `average` (complete months only); `planned` (`{ in, out, net }` per month from the Income/Expenses pages, or null); `byCategory.in[]` / `.out[]`; `hasData`.

## Formulas
- Transfers (`isTransfer`) are excluded.
- A transaction counts as income if its category's kind is income, as spending if the kind is expense; uncategorised lines go by sign (money in = income). A refund filed under a spending category reduces that month's spending.
- Net = in - out; rate = net / in when in > 0.
- `complete` = the month is before the month of `today`; averages use complete months only so the current month does not drag them down.

## Edge cases
No transactions: empty state, plus the planned figures if entered. Months with only transfers do not appear.

## Tests
`module.test.mjs`: empty and planned, month rows and completeness, uncategorised money in as income, totals/averages, category lists, the `months` cap.

## Ideas / not yet
- Yearly view and year-over-year; export to CSV; budget lines next to actuals (phase 4).
