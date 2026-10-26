# How long to plan for  (`retirement/longevity`)

**Status:** usable (phase 5)
**Purpose:** The chance of reaching each age, for each of you and for at least one of a couple, and the age the plan should run to.

## Inputs
`household` (adults, birth dates), `retirement.longevity[personId]` = `{ sex, health }`. Writes the same.

## Outputs
`people[]` (age, expectancy, chances at 80/85/90/95/100, `planTo` = the age where the chance drops under 10%, `currentPlanEnd`), `either` (a couple: the chance at least one is alive; `planTo`), `suggestion`.

## Formulas
A Gompertz mortality law S(t | x) = exp(-e^((x-m)/b) (e^((t-x)/b) - 1)) with modal age m and dispersion b fitted to approximate the Social Security Administration's 2021 period life tables: men m = 84, b = 10.5; women m = 88, b = 9.5; unsaid m = 86, b = 10. "Better" health shifts m by +3 years, "worse" by -4. Life expectancy = the sum of the survival curve. Couple: 1 - (1 - S_a)(1 - S_b), on the first person's age clock. An approximation: the exact SSA table (vendor fetch failed with a 403) is a planned improvement.

## Tests
`tests/retirement-pages.test.mjs`: monotonic curve, sex and health shifts, expectancy and 90th-percentile ages in the expected ranges, the couple.
