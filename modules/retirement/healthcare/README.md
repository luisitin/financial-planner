# Healthcare before 65  (`retirement/healthcare`)

**Status:** usable (phase 5)
**Purpose:** Health insurance between retiring and Medicare at 65: the marketplace (ACA) benchmark plan for the people it covers each year, the premium tax credit on the plan's own income, what is left to pay, and the cliff where the credit stops.

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

## In the plan's verdict (2026-11-02)
`retirement/projection` `buildInputs` adds each marketplace year's `cost` (after the credit) to the plan as a "Health insurance"
engine line in that year, every year listed here (fourth pass below), on top of the spending figure, unless
`retirement.healthIncluded` says the spending figure already includes cover (or, with spending taken from today's expenses,
the health-insurance premium line it carries gives way to this). So Will the money last?, the careful spending figure, Monte
Carlo and Goal seek pay for it. `compute(plan, { today, planIncome })` takes the income run the projection already made (one
run shared with Medicare); called alone it makes its own. The income it prices the credit on is the plan without its own
health line (`buildInputs({ health: false })`): a one-pass approximation, so the premiums' withdrawals do not raise the
income they are priced on, and a Roth conversion fill tried only on the Roth conversions page does not re-price it. The
cliff (`years[].overCliff`, `lostCredit`, `cliff`) is shown there as one line (review fix 2026-11-02, it did not say the
plan is over or that the loss is counted): "In 2053 and 2054 the plan's income is over $86,560 (by as little as $3,710), so
those years get no marketplace credit: about $17,240, already in the cost above. Taking those years' money from Roth or cash
could keep the credit (Healthcare before 65 shows how)." This page's `onWorkPlan` rule (a working partner's job plan covers
the household) is the projection's rule for Medicare too, and a health premium the projection takes out of today's
expenses is put back in those years from the household's retirement on (the plan at work goes on).

Who works (review fix 2026-11-02): the projection's `workRule`, one rule for both pages. Someone works in a year while under
their retirement age, with pay (salary, bonus or business on Income, or the projection's "<name>'s pay") and not "retired"
or "not working now" in Get started. Covered: every adult under 65 who does not work (was: past their retirement age), so a
partner with no job is covered through the other's job while it lasts (`onWorkPlan`) and on the marketplace after it (the
retirement fixture with Lee not working: 2026-2032 on Sam's plan, 2033-2039 Lee on the marketplace, $48,779 after $65,658
of credits). An adult under their retirement age with no pay is covered from today when nobody works; the projection adds
only the years from the household's retirement (before it, today's bills pay today's cover).

Fourth pass (review fix 2026-11-02): the projection prices the same years as this page. Pay is only a salary, bonus or
business line on Income owned by that adult (no owner: the first adult's; a child's never counts); rent, dividends, pensions
and other income never make anyone work (the projection's "<name>'s pay" carried them, so Lee with a rental and no job was
"working" and this page said "everyone works until 65"). A Get started answer of "work" counts as working even with no
Income line; "retired" and "none" mean not working. Covered (`coverRule`): an adult under 65 who does not work and has
stopped: Get started says retired or not working (from today), or past their own retirement age, or the household has
retired (the projection's retirement year) and they have no pay. It was every adult under 65 not working, from today, so the
family with no Income lines and Get started saying both work was priced 2026-2054 at an income of $0 ($741,455); now no
marketplace year (Bo on Ana's plan 2050-2052). The retirement fixture with Lee's salary swapped for a $1,500 a month rental:
2033 $602 and 2034 $4,220 (was none). The health line adds every year listed here, those before the household's retirement
year included.

## Review fixes 2026-11-02 (fifth pass)
- Income: the marketplace's own, AGI plus untaxed Social Security plus tax-exempt interest (26 USC 36B(d)(2)(B); `acaMagiOf`,
  medicare/compute.js `marketplaceIncome`). It used Medicare's (AGI, the taxable part of Social Security only), so the retired
  68/63 couple's 2026 read $15,365, under the poverty line, no credit and $17,324; now $48,012, $3,644 after the credit (2027
  $5,844 -> $7,610), and no Medicaid sentence.
- Who is covered: the first adult with no pay and no Get started answer is presumed at work until the household retires, so a
  partner who stops sooner is on that plan (the page says "No pay is listed for Ana and Get started does not say Ana has
  stopped work, so the plan takes Ana as working until 2055"); no one is priced after the end of their plan (Lee with a plan to
  60: 2033 and 2034 are gone); no year before the household's retirement is priced (the projection's working years).
- No marketplace years: the page names the real reason, person by person (`noBridgeWhy`, `whyNoBridge`): "Ruth and Sam are 65
  or over, so Medicare is the cover: no one in your plan needs the marketplace." for the retired couple seed (it said
  "everyone works until 65, or a partner's job covers the gap"); "In your plan no one needs marketplace coverage: Ana works until
  65 and Bo works until 62, then is on Ana's plan at work until 65." for the family. The Compare what-ifs prompt shows only
  when someone is under 65.

## Review 2026-11-06 (sixth pass)
Who works is the projection's one work rule, now shared with Financial independence and Goal seek (projection README, "Review
2026-11-06 (health insurance, sixth pass)"): a retirement contribution counts as work when it goes to a plan at work (a 401(k), or
one with a match) or nobody else has pay, and the household's retirement year is never after the first adult's own. No
fixture's marketplace years move: Lee with her IRA saving kept and Sam working is still priced 2033-2034 (a spousal IRA is not a
job), and the 68/63 couple's Bo 2026-2027.

## Review 2026-11-06 (seventh pass: no credit on separate returns)
- `creditAllowed(filingStatus)`: false for `married_separate`. A married couple must file jointly to get the premium tax credit
  (26 U.S.C. 36B(c)(1)(C), read 2026-11-06); the exception, a spouse living apart who cannot file jointly because of domestic
  abuse or abandonment (26 CFR 1.36B-2(b)(2)(ii)-(v), eCFR as of 2026-11-04), is said on the page, not assumed.
- Filing separately: every year's credit is $0, its cost the full benchmark, no cliff (`cliffIncome` null, no "years over the
  cliff" stat, no poverty-line notice); `separate: true` in the result. The page leads with a notice: "You file separate
  returns. A married couple filing separately gets no marketplace tax credit, so the full premium is counted here. Only someone
  living apart from a spouse who abused or abandoned them can still get it; the instructions for IRS Form 8962 say how."
- H-1395 (separated, not divorced): credits $15,893 -> $0, the year's cost $1,712 -> $17,606. The 68/63 couple filing
  separately (Lou on the marketplace 2026-2027): $5,036 after $29,893 of credits -> $34,930 (filing jointly: $4,975 as before).
- Test: "seventh pass: married filing separately gets no marketplace credit"; it failed on the base.

Review 2026-11-06 (round 7): "Your spouse can usually join your plan at work", "you work until 65 and your spouse works until 62, then is on your plan at work" and the presumed-at-work note ("you have stopped work") say you/your for the unnamed first adult ("Me"), with the verb to match; typed names read as before (core/words.js). Words only.

## Health costs that rise faster than prices (2026-11-13, gap design #10)
With "Health costs rise" on Assumptions left at "With prices" this page is exactly what it was (`tests/health-growth-invariance.test.mjs`).
Chosen (`assumptions.healthGrowth` = h, read through `healthGrowthOf`):
- benchmark of year t = today's benchmark for the ages covered that year x (1 + h)^(t - this year) (`healthFactor`);
- the credit is worked out on that grown benchmark: credit = max(0, benchmark - expected share x income). Income, the poverty
  line and the cliff do not move, so in a year with a credit the household still pays its expected share and the credit takes
  up the rise; in a year with no credit (over the cliff, under the poverty line, separate returns) the household pays the
  whole grown premium, and "the credit lost by going over" is the one on the grown premium.
- One muted line above "Year by year" says so, with "Change it" to Assumptions (`?show=health`). `compute()` returns
  `healthGrowth` only when chosen.
Source and read date for the rate: `modules/system/assumptions/README.md`. Tests: `module.test.mjs` "#10 ...".
