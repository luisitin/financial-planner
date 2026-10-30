# Goal prioritiser  (`goals/prioritizer`)

**Status:** usable (phase 4)
**Purpose:** The money left each month for goals, shared out by priority and date: what each goal gets against what it needs and gets now, which arrive on time, how late the rest would be; one tap sets those amounts on the Goals page.

## Inputs
`goals` (through goals/goals compute: what each needs a month to arrive on time), the money left each month (overview/next-best-action `spare`: gross pay less tax, spending and retirement saving, plus what already goes to goals), `whatIfs.prioritizer.available` (an amount you set instead). Writes `whatIfs.prioritizer = { available }` and, on "Use these amounts", each goal's `monthly`.

## Outputs
`compute(plan, { today })` -> `{ ready, available, fromPlan, override, rows: [{ id, name, icon, priority, targetDate, needed, current, allocated, onTime, finishMonths, slipMonths, noDate }], neededTotal, allocatedTotal, leftover, short, count }`.

## Formulas
- Available = the amount set, else max(0, spare + goal saving now).
- Open goals (not done, something left) sorted by priority (must have, want, nice to have), then by date (no date last).
- Pass 1: each dated goal gets min(what is left, what it needs a month to arrive on time).
- Pass 2: what is left goes to undated goals in order, each up to a twelfth of what it still needs.
- Late by = months to finish at the amount it gets (set-aside money growing at the goal's rate plus the monthly amount, `goals/house` `solveMonths`) - months to its date. A goal that gets nothing is "nothing left for it".

## Tests
`module.test.mjs`: no goals, the family all on time (order, amounts equal to need, leftover), too little money (who waits and how long, the shortfall), an undated goal getting what is left.
