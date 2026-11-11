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
answer key discloses the numerical contract: one-year midpoint
rectangles, summed until the survival left is negligible (the Gompertz law has
no maximum age; the key evaluates to age 200); expected age is current age plus that remaining-year
sum. It checks that sum a second way using weighted survival decrements plus
the surviving tail. This is a numerical approximation, not an SSA table value.
Probability and decimal-year expectations have six decimal places; ages and
calendar years are integers. No dollar arithmetic occurs here.

Fixed 2026-10-30 (F-030): the searches no longer stop at age 120 or after 70
calendar years. `ageAtSurvival` walks on until the chance falls to the target,
`lifeExpectancy` sums the curve until what is left is negligible, and the couple's
"at least one alive" search runs until it crosses 10%; 300 years is only a guard.
The age200 endpoint used for the unbounded midpoint checks has a tail below half
the last stored decimal, as bounded in the brief.

Review 2026-11-06 (round 7): the suggestion ("(your age)"), the couple card ("At least one of you and your spouse", "Someone still here when you would be 80", "on your clock") and the saved note ("Your details saved.") say you/your for the unnamed first adult ("Me"); typed names read as before (core/words.js). Test: "Review 2026-11-06 (round 7): the couple's age is 'your age' ...".

## Stress test 2026-11-11 (claude-e, wave 2)
- **Choices are used at once** (RC-5): Sex and Health save on change, with the green line; the Save button is gone.
- **The advice as a button** (RC-6): compute's `apply` gives the "Plan to age" values that make the plan run to the suggested year.
  One adult: their own 1 in 10 age. A couple: the year the chance that either is alive drops under 1 in 10; the adult whose age ends
  the plan is set to their age that year, and any other adult ending later comes down to it (the other keeps theirs, so their own
  income is not counted into an age nobody suggested). The button writes `household.people[].lifeExpectancy`, the People page's box;
  "Change ages on People ›" beside it.
- One adult has its own "Change the age on People ›" button beside the suggestion (a review of the above).
