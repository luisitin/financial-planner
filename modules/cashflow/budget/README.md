# Budget  (`cashflow/budget`)

**Status:** usable (phase 4)
**Purpose:** An envelope for each kind of spending: what is spent so far this month, what is left, and whether the pace is right.

## Inputs
Plan sections read (`needs`): `budgets` (`[{ id, category, amount, period: "monthly", rollover }]`), `transactions`, `categories`. Writes: `budgets`.
`compute(plan, { today, month })`.

## Outputs
`month`, `label`, `dayOfMonth`, `daysInMonth`, `daysLeft`, `envelopes[]` (`amount`, `rollover`, `carried`, `available`, `spent`, `left`, `share`, `pace`, `expectedByNow`), `totals`, `unbudgeted[]`, `suggestions[]`, `hasBudget`, `hasData`.

## Formulas
- Spent = spending-kind transactions of the month in that category (transfers excluded), as positive money out.
- Carried (rollover only) = max(0, last month's amount - last month's spent): unspent money moves forward, overspending does not become a debt.
- Available = amount + carried; left = available - spent.
- Pace: over when spent > available; "ahead" when spent > expected-by-now x 1.1 + 1 where expected-by-now = available x day of month / days in month; else on track.
- Suggestions (2026-11-01) = per spending category without an envelope, the total over those of the last three months that the bank files cover from start to end (`transactions/ledger` `monthCover`), divided by the number of those months (`suggestFrom.length`), so "average of 2 whole months" is the number it was divided by and a month with nothing in a category counts as nothing. Before, a month cut by the file counted as a month (Groceries $500 instead of $675 on a file cut Oct 9) and the label could say "average of 2 months" over a division by 3 ($273 for a $410 car payment). With no whole month in the files, there are no suggestions and the page says what the files cover and to import 90 days.
- `stale`: the files stop more than 3 days (`COVER_SLACK`) before today in the month shown, so "spent so far" is missing days; the page says where they stop.

## A bill paid once a month (2026-11-02)
An envelope whose month so far is one payment of 90% or more of its amount (and not over it) reads "paid", not
"spending fast": the mortgage paid on the 1st is not a fast pace. Two payments, or one under 90%, pace as before.
The month before must look the same (one payment in that category, within 10% of this one), so a single big
grocery trip on the 2nd still reads "spending fast".
Opened from the Monthly review (`?month=2026-10`), the page shows that month until a month is picked here.

## Edge cases
No today and no month: nothing. A past month counts as complete (day = days in month). Adding an envelope for a category that has one updates it instead.

## Tests
`module.test.mjs`: spent/carried/available/left, pace states, unbudgeted list, suggestion averages over whole months only (a cut first month left out), no suggestions without a whole month, stale files, a past month.

## Ideas / not yet
- Yearly envelopes and per-envelope notes; "money to assign" against income.
