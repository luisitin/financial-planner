# Healthcare before 65  (`retirement/healthcare`)

**Status:** usable (phase 5)
**Purpose:** Health cover between retiring and Medicare at 65: the marketplace (ACA) benchmark plan for the people it covers each year, the premium tax credit on the plan's own income, what is left to pay, and the cliff where the credit stops.

## Inputs
`household` (ages, children), the plan's income through `retirement/medicare` `planIncome` (the brackets in retired years, pay less pre-tax saving in working years), `retirement.aca`. Writes `retirement.aca = { benchmarkMonthly (the household's benchmark today), rules: "law"|"enhanced" }`.

## Data
`data/aca.js` (sources read 2026-10-31): by coverage year, the poverty line of the year before (26 U.S.C. 36B(d)(3)(B): the guidelines published by the first day of open enrollment): 2026 coverage $15,650 for one and $5,500 each more (HHS 2025, 90 FR 5917), 2027 coverage $15,960 and $5,680 (HHS 2026, 91 FR 1797); the applicable percentages, 2026 (IRS Rev. Proc. 2025-25 section 3.01: 2.10% under 133% of the line, 3.14%-4.19%, 4.19%-6.60%, 6.60%-8.44%, 8.44%-9.96%, 9.96% from 300% to 400%) and 2027 (Rev. Proc. 2026-26 section 3.01: 2.15%, 3.23%-4.30%, 4.30%-6.78%, 6.78%-8.66%, 8.66%-10.22%, 10.22%); a year after the newest published holds the newest, in today's dollars. The 2021-2025 enhanced schedule (0% under 150%, rising to 8.5% from 400% with no cliff) for the "if the larger credits come back" choice; the federal default standard age curve, one factor for each age (CMS bulletin of December 16, 2016, Appendix I: 0.765 for 0-14, 0.833 at 15 ... 1.278 at 40, 1.444 at 45 ... 3.000 from 64; 45 CFR 147.102(d)); a rough national benchmark for a 40-year-old ($625 a month: KFF's 2025 average of about $497 plus the 26% average 2026 rise). The enhanced credits ended December 31, 2025: 36B(b)(3)(A)(iii) and (c)(1)(E) still end "before January 1, 2026" in the Code current through Pub. L. 119-136 (October 22, 2026); the House's three-year extension (H.R. 1834) has been on the Senate calendar since February 10, 2026.

## Formulas
- Marketplace years: a year in which someone has retired and is under 65 and no one in the household still works (while a partner works, the retired one can usually join that job's plan: listed apart as `onWorkPlan`). Covered: those adults, and children under 26.
- Benchmark a year = 12 x (benchmark for a 40-year-old) / 1.278 x the sum of the covered people's age factors. With `benchmarkMonthly` entered for the adults today, the 40-year-old figure is solved from it.
- Benchmark ages: every adult and child 21 to 25, and only the three oldest children under 21 (45 CFR 147.102(c)(1)); each age's factor from the curve's table, no straight lines between ages.
- Household size: adults alive in the plan + children under 19. Income as a multiple of the poverty line for that coverage year; expected share straight-line inside its band ("at least" its start, "less than" its end, so exactly 133% is the upper band; 400% is inside), rounded to the nearest one-hundredth of one percent (26 CFR 1.36B-3(g)(1)); contribution = share x income; credit = max(0, benchmark - contribution), none under 100% of the poverty line (36B(c)(1)(A), both rule sets) and none over the cliff (over 4x the line, law rules); cost = benchmark - credit.
- Checked against `tools/golden_health` (`tests/golden-health.test.mjs`): 2,000 households worked from the statute, the regulations and the revenue procedures without reading this code.
- Over the cliff: `lostCredit` = the credit at an income exactly at the cliff, lost by going over it. Room = cliff - income.

## Edge cases
- Alaska and Hawaii poverty lines, Medicaid (under 138% in expansion states; the page says so for a year under the poverty line), the six states and DC with their own age curves (Alabama, Massachusetts, Minnesota, Mississippi, Oregon, Utah) and New York and Vermont, which do not rate by age (CMS state-specific age curve variations, per the answer key's RULES.md), and the employer-plan affordability test are not modelled.
- Money in today's dollars; the poverty line and the benchmark are kept level in real terms.

## Tests
`module.test.mjs`: the age curve, poverty line, expected share and cliff (both rules), the credit (floor, cliff, enhanced), the family as planned (no marketplace years, the work-plan years), both retiring at 58 (years, the national benchmark by age, the cliff, the larger credits and an entered benchmark).

## Ideas / not yet
- Plan the withdrawals to stay under the cliff (draw from Roth, cash and taxable first in those years), and show its saving on Withdrawal order.
- The state's own subsidies and Medicaid.
