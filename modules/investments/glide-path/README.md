# Glide path  (`investments/glide-path`)

**Status:** usable (phase 7)
**Purpose:** How much of your money should be in stocks at each age: the plan's path, the rules of thumb, and where you stand today.

## Inputs
The People page (ages, retirement age, plan end), `retirement.stocksNow` / `stocksRetired` (the plan's path), holdings (the stock share held), `investments.glide` (which path to measure against: plan, age, target-date).

## Outputs
`rows[]` by age (`plan`, `age110`, `targetDate` stock shares), `actual`, `suggested`, `gap`, `verdict`, `milestones[]` (every five years plus retirement), `ruleLabel`, `notes`.

## Formulas
The plan's path: stocksNow gliding linearly to stocksRetired by the retirement year, flat after (the same path the retirement engine uses). 110 minus age. The target-date shape from `targetDateMix` (90% to 50% at retirement to 30% seven years after).

## Edge cases
Without a birth date the path starts 20 years before the plan's retirement age. "On path" is within five points.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- A bond-tent path (lower stocks around the retirement date, rising after); TPAW's utility-based path.
