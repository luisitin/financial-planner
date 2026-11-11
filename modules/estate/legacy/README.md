# Legacy goals  (`estate/legacy`)

**Status:** usable (phase 8)
**Purpose:** What you want to leave and to whom, in today's dollars; the amount the plan should still have at its end for it; whether it does, and what each lever would have to be if not.

## Inputs
`estate.legacy`, `accounts` (homes), the retirement plan (`buildInputs`, `project`) and Goal seek. Writes `estate.legacy = { bequests: [{ id, to, kind: "person"|"charity", amount, notes }], includeHome }`. Heavy: Goal seek solves several levers.

## Outputs
`compute(plan, { today })` -> `{ bequests[], total, people, charity, home, includeHome, target, ready, missing, endReal, success, meets, gap, endYear, levers }`. `legacyTarget(plan)` -> `{ total, home, target }` is shared: it is the goal Goal seek starts from, and the charity total is a deduction on Estate tax.

## Formulas
- Total = the sum of the bequests (today's dollars). Home = the property accounts' value when `includeHome` (the home passes as it is, so the savings need not hold it). Target = max(0, total - home).
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

## Stress test 2026-11-11 (touch and input)

- The amount is required (1 to 1,000,000,000): an empty Add was saved as $0 and said "added" (IE-2).
- The home's tick box saves the moment it is ticked, with a green line, instead of its own filled Save beside the add form's Add: one filled button per screen (IE-7).

## Fix round 1 of the owner's request 2026-11-11 (2026-11-12, B3)
"Does the plan leave it?" lists Goal seek's changes through `listedLevers` (compute.js): not `info` levers (the return it needs is
information on Goal seek, never a change: it read "The return it needs ... That isn't a choice you can make." as the fourth of five
changes and pushed the Social Security card out), not "same", at most five. Test: a Jamie-like short household leaving $20,000
lists no return and does list the claiming age.

## Fix round 2 (2026-11-13): simple first (owner, 2026-11-12 and 2026-11-13)
- "Does the plan leave it?" shows the first three changes and folds the rest under "N more changes" (their names in the fold's
  line). `listedLevers` now keeps Goal seek's first-view order (`firstLevers`: what is worth money first, then the changes that get
  there on their own, those with room, "not on its own" last), at most five, still without the return it needs or a "just right".
  The saving change that names a 401(k) with nothing going in is among the first three even when saving alone cannot get there
  (final fix, 2026-11-13; Goal seek's README; test "final fix (rule 7) ...").
- The add form shows three boxes (to whom, who, the amount); the optional note is one quiet tap away under "Add a note". When the
  one being changed has a note, the fold is open and its line says "has one" (nothing of the person's is hidden). The note is read
  from inside the fold when saving; opening it changes nothing. On a phone a fold's line goes under its title.
- Kept: everything else on the page, the outlined "Goal seek" link, the folded "+ Add someone" once someone is listed.
- Test: "simple first (fix round 2) ..." (the order equals `firstLevers`, three first and the rest folded, the note folded and
  closed for a new entry, open with "has one" when changing one with a note, the note saved from inside the fold, nothing saved by
  opening).
