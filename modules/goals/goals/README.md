# Goals  (`goals/goals`)

**Status:** usable (phase 2)
**Purpose:** Tracks each goal's target, date, funding account, priority and progress, and tells you the monthly amount needed.

## Inputs
Plan sections read (`needs`): `goals`, `accounts` (balances of `fundedBy` accounts), `assumptions` (`inflation`, `returnCash`, `returnBonds`).
`compute(plan, { today })`: `today` (ISO) for months left; without it every goal is "no date".

Goal shape: `{ id, name, icon, target, targetDate, priority (1 must, 2 want, 3 nice), saved, fundedBy: [accountId], monthly, rate (fraction or null), inflates }`. The form stores one account in `fundedBy`; the shape allows several.

## Outputs
`goals[]` (each goal plus `priorityLabel`, `monthsLeft`, `yearsLeft`, `rate`, `targetThen`, `funded`, `remaining`, `neededMonthly`, `projected`, `shortfall`, `progress`, `status`, `fundedFrom[]`), `count`, `done`, `totalTarget`, `totalFunded` (capped at each target), `neededMonthly` (open, dated goals), `contributing`, `warnings[]`.

## Formulas
- Months left: `monthsBetween(today, targetDate)` (`core/math/dates.js`).
- Growth rate: `goal.rate` if set; else `assumptions.returnCash` when under 3 years away, `assumptions.returnBonds` from 3 years on. Reason: money needed soon should sit in cash; a longer goal can take some bond-like growth. It is an assumption, shown on screen, and the owner can override it per goal.
- Target then: `inflate(target, inflation, yearsLeft)` when `inflates`, else the target as typed (`core/math/finance.js`).
- Funded: `saved` + sum of the linked accounts' balances (absolute values).
- Needed monthly: `pmtToReach(rate / 12, monthsLeft, targetThen, funded)`; 0 when already funded; the whole remainder when the date is today or past (n = 0).
- Projected at the date: `fv(rate / 12, monthsLeft, monthly, funded)`. On track when projected >= target then.
- Progress: min(1, funded / target then).
- Status order: no amount -> done -> no date -> past due -> on track (monthly > 0 and projected enough) -> behind.

## Edge cases
No date: needed/projected are null, status "no date". Date in the past and not done: "past due" plus a warning. Linked account deleted: ignored in the sum, warning. Negative target: warning. Rate 0: straight-line saving.

## Tests
`module.test.mjs`: cash vs bond rate by horizon, inflation of the target, pmtToReach and fv agreement, linked accounts, done/past due/no amount, totals.

## Ideas / not yet
- Several funding accounts per goal in the form (the data shape already allows it).
- Goal-seek ("what date can I afford?") and priority-based allocation of a fixed monthly amount (phase 9 `scenarios/goal-seek`).
