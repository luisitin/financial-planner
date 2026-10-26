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

## Independent formula answer key

`tests/golden/retirement/longevity.csv` contains800 invented examples, replayed
by `tests/golden-retirement.test.mjs`. Its specification and exact flat CSV
layout are in `tests/golden/retirement/briefs/longevity.md`; reproduce it with
`python tools/golden_retirement/longevity.py`. The generator does not import or
execute application code. Each of eight formula/rule groups has60 grid,30 edge
and10 extreme cases. Every tenth row has a separately asserted derivation.

The model's84/88/86 modal ages,10.5/9.5/10 dispersions and+3/-4 health shifts
come from the modeling assumptions stated above. They are **not published SSA
coefficients**. [SSA's period table](https://www.ssa.gov/oact/STATS/table4c6.html)
explains life expectancy as average remaining years at an exact age; its current
page is2023 data. We preserve the original documented approximate fit rather
than claiming the current table validates its coefficients.

The oracle independently uses cumulative hazard H(t)=exp((t-m)/b) and
S(x,t)=exp(H(x)-H(t)). Solving S=p gives the threshold
`ceil(m+b*ln(exp((x-m)/b)-ln(p)))`. Reached ages have survival one. The couple
rule is inclusion-exclusion, `S_a+S_b-S_a*S_b`, with an independence assumption
and ages labeled on the first adult's clock. Input birthdays use ordinary whole
calendar years; February29 birthdays advance March1 in a nonleap year.

The original README did not specify how its survival "sum" was sampled. The
answer key discloses the existing numerical contract: one-year midpoint
rectangles through age120; expected age is current age plus that remaining-year
sum. It checks that sum a second way using weighted survival decrements plus
the surviving tail. This is a numerical approximation, not an SSA table value.
Probability and decimal-year expectations have six decimal places; ages and
calendar years are integers. No dollar arithmetic occurs here.

Separate rows preserve discrepancies caused by undocumented horizon limits:
the inverse helper stops at120, the remaining-year sum omits survival after120,
and the couple crossing search stops after70 years even while joint survival
exceeds10%. These rows retain uncapped model expectations and a specific TODO
reason. The age200 endpoint used for the unbounded midpoint checks has a tail
below half the last stored decimal, as bounded in the brief. No production
formula was changed by adding this answer key.
