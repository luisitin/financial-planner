# Legacy goals  (`estate/legacy`)

**Status:** usable (phase 8)
**Purpose:** What you want to leave and to whom, in today's money; the amount the plan should still have at its end for it; whether it does, and what each lever would have to be if not.

## Inputs
`estate.legacy`, `accounts` (homes), the retirement plan (`buildInputs`, `project`) and Goal seek. Writes `estate.legacy = { bequests: [{ id, to, kind: "person"|"charity", amount, notes }], includeHome }`. Heavy: Goal seek solves several levers.

## Outputs
`compute(plan, { today })` -> `{ bequests[], total, people, charity, home, includeHome, target, ready, missing, endReal, success, meets, gap, endYear, levers }`. `legacyTarget(plan)` -> `{ total, home, target }` is shared: it is the goal Goal seek starts from, and the charity total is a deduction on Estate tax.

## Formulas
- Total = the sum of the bequests (today's money). Home = the property accounts' value when `includeHome` (the home passes as it is, so the savings need not hold it). Target = max(0, total - home).
- The plan leaves `endReal` = the projection's end balance in today's dollars; meets when the plan lasts and endReal >= target; gap = target - endReal.
- Levers: `scenarios/goal-seek` compute with `legacy` = target (the most to spend, the latest retirement, the saving, the return, the lump sum, the claiming age that still leave it).

## Edge cases
- No bequests: nothing to check; Goal seek is not run.
- The plan cannot be built (no birth dates): the bequests are listed, the check waits.
- A home worth more than the bequests: target 0.

## Tests
`module.test.mjs`: the target with and without the home (never below 0), nothing to leave, the family's legacy (shares, kinds, the check, the levers when it is short), not ready.

## Ideas / not yet
- A share of what is left instead of amounts; charities through a donor-advised fund or a charitable remainder trust.
- TPAW-style legacy that trades spending against what is left smoothly (the seed in the catalog).
