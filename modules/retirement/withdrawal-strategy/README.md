# How much to take out  (`retirement/withdrawal-strategy`)

**Status:** usable (phase 5)
**Purpose:** Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history.

## Inputs
The projection inputs; `retirement.strategy` and `retirement.withdrawalRate`. Writes `retirement.strategy` ("Use this one").

## Outputs
`rows[]` per strategy: `name`, `how`, `from`, `expected` and `worst` (`firstYear`, `lowest`, `highest` real spending, `endReal`, `success`, `failAge`); `worstStartYear`, `chosen`.

## Formulas
The engine's four strategies (see the Projection README). `worstWindow`: every start year in the Damodaran data run with fixed-real spending; the one that fails earliest, else ends lowest. Sources: Bengen (1994) and the Trinity study for the 4% rule; Guyton and Klinger (2006) for guardrails; the Bogleheads VPW; the FI Calc guide's definitions (vendored).

## Tests
`tests/retirement-pages.test.mjs`: four rows, percent never fails, fixed-real first year equals the planned spending.
