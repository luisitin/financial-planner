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
- Suggestions = average over the last three months that have any spending, per spending category without an envelope.

## Edge cases
No today and no month: nothing. A past month counts as complete (day = days in month). Adding an envelope for a category that has one updates it instead.

## Tests
`module.test.mjs`: spent/carried/available/left, pace states, unbudgeted list, suggestion averages, a past month.

## Ideas / not yet
- Yearly envelopes and per-envelope notes; "money to assign" against income.
