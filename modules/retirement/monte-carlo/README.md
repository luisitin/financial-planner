# Chance the money lasts  (`retirement/monte-carlo`)

**Status:** usable (phase 5); `heavy: true` (runs on the PC through `/api/compute/retirement/monte-carlo` when connected)
**Purpose:** The plan run thousands of times with returns drawn at random: the share of runs where the money lasts, and the range.

## Inputs
The projection inputs; `params.paths` (default 2,000; the server caps at `compute.maxPaths`), `params.seed`.

## Outputs
`successRate`, `medianEndReal`, `failAges` (p10, p50, count), `bands[]` per year (p10..p90 of real total), `byAge[]` (share still funded), `verdict` (strong >= 85%, fair >= 70%, weak).

## Formulas
`drawSequences`: lognormal yearly returns with the plan's arithmetic mean and standard deviation for stocks and bonds (mu = ln(1+m) - s^2/2 in log space), a 0.1 correlation, seeded (`core/math/montecarlo.js` mulberry32 + Box-Muller). Inflation is held at the assumption. Each path runs the engine with `sequence`.

## Tests
`tests/retirement-pages.test.mjs`: repeatable seeds, the mean of the draws, ordered bands, the server cap.

## Ideas / not yet
- Random inflation; fat tails (historical bootstrap); the chart's touch readout.
