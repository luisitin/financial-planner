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

## Round 8 (2026-11-06): past-due goals (item 18)
A goal whose date has passed is due now (Goals' `dueNow`), not a month's share: it is left out of the rows and listed in
`pastDue: [{ id, name, icon, dueNow, targetDate }]` (only when there is one), and the page says "Child 2's college: its
date has passed, and $103,000 is due now. Set a new date on Goals, or mark it done." Before, its whole remainder was its
"needed a month" and took the money first. Next best action's dated-goal step gives each goal behind its pace the same
`neededMonthly` this page allocates (round 8 item 3), so both pages say one monthly figure. Test: module.test.mjs "round 8".

## Round 8 batch 2 review fixes (2026-11-06)
A goal whose date has passed reads "Boat: its date has passed, with $8,000 still to go. Set a new date for it on Goals, or lower
its amount if less is needed." ("mark it done" was said where no button does it). Test: module.test.mjs "round 8 review UX 4".

## Touch and input stress test (2026-11-11, claude-g)
- "Use these amounts" asks first, naming the goals and their amounts, keeps the amounts it replaces, and its green line carries
  "Put back my amounts". Once every goal uses the shared-out amount, a sentence replaces the button (x-4).
