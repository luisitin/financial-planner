# Expected inheritance  (`estate/inheritance`)

**Status:** usable (phase 8)
**Purpose:** An inheritance you might receive, as a what-if beside the plan (never inside it): what arrives after tax and costs, what it would change if it came, and if it came half as large or ten years later.

## Inputs
`estate.inheritance`, the retirement plan (`buildInputs`, `project`, `affordableSpending`). Writes `estate.inheritance = { items: [{ id, from, amount (today's money), year, kind: "cash"|"home"|"ira"|"roth", notes }] }`. Heavy: five plan runs, each with the affordable-spending search.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, items[] (with kindLabel, net), total, net, taxRate, base, withIt, half, later, spendingMonthly, extraMonthly, endGain }`; each run `{ success, failYear, endReal, affordableMonthly }`.

## Formulas
- What arrives (`netOf`): cash and Roth money whole; a traditional IRA or 401(k) x (1 - the plan's flat tax rate) (inherited from a non-spouse after 2019 it must be emptied within ten years, SECURE Act, and each withdrawal is income); a house x (1 - 6% selling costs), with no gains tax on the value stepped up at death (IRC 1014).
- Each item enters the plan's engine as money into savings (a negative event) in its year (not before this year; never after the plan's end).
- Runs: without it (the plan), with it, half as much, every item `LATER_YEARS` (10) years later. Extra spending = with it minus without, in the affordable spending a month (the most the plan could spend in retirement and still last).

## Edge cases
- Nothing entered: only the plan's own run.
- The engine treats inherited money as taxable savings from then on; an inherited IRA's ten-year spreading of the tax is not modelled (it is all taxed on arrival, at the flat rate).

## Tests
`module.test.mjs`: what arrives per kind, nothing expected, an inheritance's effect (more left, more to spend, half and later in between), a year in the past.

## Ideas / not yet
- A chance it comes (weighted outcomes); state inheritance tax for the heir's state and relationship.
- The inherited IRA as its own bucket with the ten-year rule and the tax spread.
