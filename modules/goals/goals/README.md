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

## Each goal leads to the page that works out its cost (2026-11-02)
A goal used to open only its edit form, and nothing led to Education, Vehicle, House down payment, Emergency fund or
Travel, which give their own (different) figures. `plannerFor(goal)` picks the page by icon or name (🎓 college, 🚗 car,
🏠 house, 🛟 emergency, ✈️ trip). Each goal row has a link: "What it costs: Education ›", or, when that page's figure is 5%
or more away from the goal's amount (`plannerDiffers`), "Education works it out at $117,813 in today's money ›". The edit
form then says both figures and offers "Use $117,810 from Education", which sets the goal's amount (today's dollars) and
confirms it. `plannerFigure(goal, row, page, result)` turns the page's result into today's dollars: Education's
`totalToday`; Vehicle's net (price + sales tax - trade-in, in purchase-day dollars) x target / targetThen; Emergency
fund's target; House down payment's cash to close. Vehicle and Which goal first? print dates as 3/1/2029, not 2029-03-01.

Review fixes (2026-11-02, 7 of 8 confirmed): a figure is offered only when it settles and fits the goal.
- Vehicle: only once the Vehicle page has a price of its own (`priceFromGoal`); with none it took the goal's amount and added
  6% sales tax on every tap ($25,000 became $33,740 after four taps).
- Emergency fund: only for the goal ticked as the emergency fund (otherwise its money never counts there; a note says to tick
  it), and the amount is the cushion's target less the other cash that counts, so nothing is saved twice.
- Education: the share chosen there (`totalToday x share`, rounded to $1,000 like Education's own Update button, so the two
  buttons no longer undo each other); for a goal that does not grow, the dollars of those years; only for the goal naming
  the child, or the 🎓 goal naming no adult (Bo's grad school no longer gets Cy's college cost).
- Names: Travel is tested before House, House uses the House page's own `isHouseGoal` (a roof, repairs or an office are not
  a home to buy), and a car loan, insurance or repairs are not a car to buy.
- "Use $X from ..." puts the figure in the form's Amount needed box: Save changes keeps it with anything else typed (it used
  to save the amount alone and drop the rest). The notice says "in the dollars of its date" for a goal that does not grow.
- Refuted, not changed: the link's 32 px height and Enter on it (a phone tap opens the page; a near miss opens the form).

## How a row reads (2026-11-02, round 4)
The amount as typed comes first, then what rising prices make it by the date: "$0 of $30,000 · about $32,800 by
11/2/2029 with rising prices" (it used to read "$0 of $32,782", a figure nobody typed). A goal waiting its turn
(`goalsBehind` in overview/alerts: nothing going in, Next best action funds goals from a later month) gets a neutral
"starts later" pill and "its turn comes in April 2028, after the steps before it on Next best action", not an orange "behind".

## Edge cases
No date: needed/projected are null, status "no date". Date in the past and not done: "past due" plus a warning. Linked account deleted: ignored in the sum, warning. Negative target: warning. Rate 0: straight-line saving.

## Tests
`module.test.mjs`: cash vs bond rate by horizon, inflation of the target, pmtToReach and fv agreement, linked accounts, done/past due/no amount, totals.

## Ideas / not yet
- Several funding accounts per goal in the form (the data shape already allows it).
- Goal-seek ("what date can I afford?") and priority-based allocation of a fixed monthly amount (phase 9 `scenarios/goal-seek`).
