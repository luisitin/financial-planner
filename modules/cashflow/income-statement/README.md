# Income statement  (`cashflow/income-statement`)

**Status:** usable (phase 3)
**Purpose:** What came in, what went out and what you kept, month by month, from your real transactions; next to what the Income and Expenses pages say should happen.

## Inputs
Plan sections read (`needs`): `transactions`, `categories`, `income`, `expenses` (the last two through their computes). Writes nothing.
`compute(plan, { months = 12, today })`.

## Outputs
`rows[]` newest first: `{ ym, label, in, out, net, rate, count, uncategorised, complete }`; `totals` and `average` (complete months only); `planned` (`{ in, takeHomeIn, takeHome, out, net }` per month from the Income/Expenses pages, or null), `inGap`, `inShort`; `byCategory.in[]` / `.out[]`; `hasData`.

## Formulas
- Transfers (`isTransfer`) are excluded.
- A transaction counts as income if its category's kind is income, as spending if the kind is expense; uncategorised lines go by sign (money in = income). A refund filed under a spending category reduces that month's spending.
- Net = in - out; rate = net / in when in > 0.
- `complete` = the month is before the month of `today`; averages use complete months only so the current month does not drag them down.
- Plan versus real, money in (2026-11-01, round 2 of the owner's experience list): the bank sees pay after tax, so the plan's money in is compared at take-home, `takeHomeIn` = `cashflow/paycheck` `takeHome().monthly` (each salary at its earner's take-home share, other income as typed). `inGap` = average money in over complete months - `takeHomeIn`; `inShort` when it is below by more than `IN_BAND` = 10% of `takeHomeIn` (and $50). The band is my choice: pay every two weeks puts two paychecks in most months, 12/13 of the average month (7.7% below), so a tighter band would call ordinary months short. Before, the page compared pay before tax with deposits, showed the sample family "Income page says $14,250 a month; the bank shows $10,318" in red and said "Fix whichever is wrong", which invited typing take-home pay over the salary and breaking tax and retirement everywhere.
- The plan's sentence in the empty state uses Next best action's own figures, so it adds up: "$14,250 a month comes in before tax; about $2,385 goes to tax, $5,426 to spending and $2,268 to saving, so about $4,170 a month is left" (tax = `federalTax + payrollTax`, saving = `retirementSaving + goalSaving`, left = `spare.monthly`, the Dashboard's figure). It names the tax rather than an "after tax" amount ($11,865), which sat next to the Income page's take-home ($11,398, which also takes out the 401(k) and health cover) as a second figure for the same thing. The Paycheck page's take-home is kept for Plan versus real, where it meets the bank's deposits. `planned.net` (before tax) stays in the output for the reports that read it.

## Edge cases
No transactions: empty state, plus the planned figures if entered. Months with only transfers do not appear.

## Tests
`module.test.mjs`: empty and planned, month rows and completeness, uncategorised money in as income, totals/averages, category lists, the `months` cap; money in compared at take-home (exact, 8% below, 20% below).

## Ideas / not yet
- Yearly view and year-over-year; export to CSV; budget lines next to actuals (phase 4).
