# Advisor's plan  (`scenarios/advisor-plan`)

**Status:** usable (phase 8)
**Purpose:** An advisor's plan as a scenario: their assumptions and their fee, run through the same engine as your plan; which assumption makes the difference; what the fee costs; their quoted chance of success against the one this app gets with the same assumptions.

## Inputs
`advisor`, the plan. Writes `advisor = { firm, date, fee, quotedChance, notes, changes: { [lever or lever:personId]: value } }`; the levers are `ADVISOR_LEVERS` from `scenarios/compare` `LEVERS` (returns, inflation, stock shares, retirement and claiming ages, spending, extra saving). Heavy: three full runs (400 simulated markets each) and one quick run per assumption.

## Outputs
`compute(plan, { today, paths })` -> `{ ready, missing, entered, firm, date, fee, quotedChance, changes, yours, theirs, theirsNoFee, described, effects: [{ key, text, roomMonthly, endReal }], feeCost: { endReal, affordableMonthly }, chanceGap }` (`results` as in scenarios/compare).

## Formulas
- Theirs = `applyChanges(plan, { ...changes, fee })` then `results` (does it last, the chance over 400 markets, the most it could spend a month, the money left at the end, today's dollars). Their fee comes off both expected returns (the compare page's `fee` lever).
- Each assumption alone: your plan with that one change, no simulation. Its effect is the change in the room a month, (affordable - planned spending), so a spending assumption shows up too; sorted by size.
- Fee cost = their plan without the fee less with it: at the end, and in what could be spent a month.
- Chance gap = their quoted chance - this app's chance with their assumptions; within 5 points is called close.

## Edge cases
- Only the advisor levers are read from `changes`; a stray key is ignored.
- Nothing entered: your plan alone, and the form.

## Tests
`module.test.mjs`: nothing entered, the full comparison (levers kept, the fee's cost, the quote gap, each assumption's sign and the sort, spending's effect equal to the extra spending).

## Ideas / not yet
- Read the advisor's PDF with the AI reader and fill the form (the user clicks apply).
- Their recommended portfolio's own fund costs against an index portfolio.
