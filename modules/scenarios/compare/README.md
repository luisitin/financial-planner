# Scenario compare  (`scenarios/compare`)

**Status:** usable (phase 8)
**Purpose:** Copies of your plan with a few things changed, side by side with the plan itself: does the money last, the chance it lasts over simulated markets, what each could spend, what it holds at retirement and at the end.

## Inputs
The plan (through `retirement/projection` `buildInputs`) and `scenarios`. Writes `scenarios[]`: `{ id, name, changes: { [lever key, or "key:personId"]: value }, createdAt }`. The plan itself is never changed. Heavy: per version one projection, the affordable-spending search and 400 simulated markets.

## Outputs
`compute(plan, { today, paths })` -> `{ ready, missing, base, scenarios: [{ id, name, changes, described, results, missing }], current, adults }`; `results` = `{ success, failYear, failAge, retireYear, atRetirementReal, endReal, affordableMonthly, spendingMonthly, chance }`.
Shared with `scenarios/advisor-plan`: `LEVERS`, `applyChanges(plan, changes, { today })`, `results(inputs, { paths })`, `describe(plan, changes)`.

## Levers
Plan levers (set on a deep copy, then `buildInputs`): retirement age and Social Security claiming age per adult; spending a month in retirement; extra saving a month (a contribution with no account, so into taxable savings, until the first person retires); stock share now and in retirement; stock and bond returns; inflation.
Input levers (applied to the engine's inputs): fees a year (taken off both the stock and the bond return); a one-off sum in a year (money in > 0, out < 0; this year when no year is given).

## Formulas
- Each version: `project` (does it last, the money at the first retirement year and at the end, today's dollars), `affordableSpending` / 12 (the most it could spend a month and still last), and the share of `PATHS` (400) simulated markets in which it lasts (Monte Carlo `drawSequences` with seed 1, the version's own expected returns and volatility).
- Differences on a phone are each version less the plan.

## Edge cases
- At most `MAX_SCENARIOS` (4) are run.
- A version that cannot be built shows its missing items.
- Empty fields in the editor are not stored: they stay as the plan has them.

## Tests
`module.test.mjs`: the levers read the plan, `applyChanges` copies (the original untouched) and reaches the engine, `results` matches the projection, `describe` in plain words, the family's scenarios (earlier retirement and fees cost, saving gains, the four-scenario cap).

## Ideas / not yet
- More levers: selling the house, a part-time job, a pension, the withdrawal strategy.
- Make a scenario the plan (with the user's click), keeping the old plan as a scenario.
