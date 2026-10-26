# Contribution limits  (`investments/limits`)

**Status:** usable (phase 7)
**Purpose:** This year's limits for 401(k)s, IRAs, HSAs, FSAs and 529 gifts against what is going in, the room left, the Roth income check and the deadlines.

## Inputs
`modules/retirement/contributions/data/limits.js` (limits per year, catch-ups, the Roth phase-out and the gift exclusion added in Phase 7), the Contributions page (what goes in, per person), `taxes.hsa` (coverage, contribution), the household's filing status and the Federal estimate's AGI.

## Outputs
`people[]` with `rows[]` (401(k), IRA, HSA: limit with catch-up, used, room, over, accounts), `totals`, `fsa`, `gift` (exclusion, five-year superfunding), `roth` (phase-out, MAGI, status ok/partial/over), `deadlines[]`, `notes`.

## Formulas
Per person: the base limit plus the catch-up at 50 (60-63 for the 401(k) super catch-up, 55 for the HSA); family HSA coverage uses the family limit plus the person's own catch-up. IRA use counts traditional and Roth together. Roth status from AGI against the year's phase-out for the filing status.

## Edge cases
No contributions: every limit shows full room, with a note. An HSA contribution typed on the HSA page counts even without a Contributions row.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- 529 state deductions by state; SEP/Solo 401(k) limits for the self-employed.
