# Emergency fund  (`goals/emergency-fund`)

**Status:** usable (phase 2)
**Purpose:** How big the emergency fund should be for this household, how far along it is, when it is full, and where to keep it; the emergency goal can be marked as the fund itself (F-034).

## Inputs
`balance/liquidity` (usable cash, must-pay bills, the target in months: `assumptions.emergencyMonths`), `income` (earners and pay that varies), `household` (children), `goals` (a goal named emergency / rainy day / cushion, or with the 🛟 icon), `accounts` (checking), `assumptions.returnCash`. Writes `assumptions.emergencyMonths` ("Aim for N months") and `goals[].isEmergencyFund` (the opt-in tick).

## Outputs
`compute(plan, { today })` -> `{ essentialMonthly, now, months, suggested: { months, reasons }, target, gap, runwayMonths, status, goal, monthly, monthsToGo, readyDate, checking: { balance, oneMonth, spare }, cashRate, spareInterest, warnings, adults }`.

## Formulas
- Suggested months (`suggestedMonths`): 3 with two or more people on salary, 6 with one or none; 3 more when any income is business, commission or bonus; at most 12. The common 3-to-6-months advice, longer for one income or pay that varies.
- Target = must-pay bills a month x the months set (Assumptions, 6 by default); gap = target - usable cash.
- Months to full: usable cash growing at the cash return plus the emergency goal's monthly amount (`goals/house` `solveMonths`).
- Spare in checking = checking balances - one month of all spending; what it would earn a year in savings = spare x the cash return.

## F-034
`balance/liquidity` sets money earmarked by goals aside from usable cash (F-020). A goal with `isEmergencyFund: true` is now skipped there: its money counts as the cushion. Nothing changes until the owner ticks it, so the owner's decision on F-034 stays open (this is its option C).

## Tests
`module.test.mjs`: the suggested months, an empty plan, the family (cushion, target, the goal's pace, the warning), the F-034 tick on both pages, spare checking money.
