# Healthcare before 65  (`retirement/healthcare`)

**Status:** usable (phase 5)
**Purpose:** Health cover between retiring and Medicare at 65: the marketplace (ACA) benchmark plan for the people it covers each year, the premium tax credit on the plan's own income, what is left to pay, and the cliff where the credit stops.

## Inputs
`household` (ages, children), the plan's income through `retirement/medicare` `planIncome` (the brackets in retired years, pay less pre-tax saving in working years), `retirement.aca`. Writes `retirement.aca = { benchmarkMonthly (the household's benchmark today), rules: "law"|"enhanced" }`.

## Data
`data/aca.js`: the 2025 poverty guidelines used for 2026 coverage ($15,650 for one, $5,500 each more; 48 states and DC); the 2026 applicable percentages (IRS Rev. Proc. 2025-25: 2.10% under 133% of the line, 3.14%-4.19%, 4.19%-6.60%, 6.60%-8.44%, 8.44%-9.96%, 9.96% from 300% to 400%, no credit over 400%); the 2021-2025 enhanced schedule (0% under 150%, rising to 8.5% from 400% with no cliff) for the "if the larger credits come back" choice; the federal default age curve (0.765 under 15 to 3.0 from 64); a rough national benchmark for a 40-year-old ($625 a month: KFF's 2025 average of about $497 plus the 26% average 2026 rise). The enhanced credits ended December 31, 2025; the House passed a three-year extension in January 2026 but no enactment was found from the build session.

## Formulas
- Marketplace years: a year in which someone has retired and is under 65 and no one in the household still works (while a partner works, the retired one can usually join that job's plan: listed apart as `onWorkPlan`). Covered: those adults, and children under 26.
- Benchmark a year = 12 x (benchmark for a 40-year-old) / 1.278 x the sum of the covered people's age factors. With `benchmarkMonthly` entered for the adults today, the 40-year-old figure is solved from it.
- Household size: adults alive in the plan + children under 19. Income as a multiple of the poverty line; expected share straight-line inside its band; contribution = share x income; credit = max(0, benchmark - contribution), none over the cliff (4x the line, law rules); cost = benchmark - credit.
- Over the cliff: `lostCredit` = the credit at an income exactly at the cliff, lost by going over it. Room = cliff - income.

## Edge cases
- Alaska and Hawaii poverty lines, Medicaid under 138% in expansion states, and the employer-plan affordability test are not modelled.
- Money in today's dollars; the poverty line and the benchmark are kept level in real terms.

## Tests
`module.test.mjs`: the age curve, poverty line, expected share and cliff (both rules), the credit (floor, cliff, enhanced), the family as planned (no marketplace years, the work-plan years), both retiring at 58 (years, the national benchmark by age, the cliff, the larger credits and an entered benchmark).

## Ideas / not yet
- Plan the withdrawals to stay under the cliff (draw from Roth, cash and taxable first in those years), and show its saving on Withdrawal order.
- The state's own subsidies and Medicaid.
