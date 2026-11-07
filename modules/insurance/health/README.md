# Health plan compare  (`insurance/health`)

**Status:** usable (phase 8)
**Purpose:** The health plans you can choose from, on what each really costs a year: premiums plus your share of the bills, less the employer's HSA money and the tax an HSA saves, in a quiet year, your usual year and a bad year; which plan wins at which level of bills, and which can have an HSA.

## Inputs
`insurance.health = { tier: "self"|"family", expected (a usual year's bills, what the plan is charged), plans: [{ id, name, premium (yours, a month), deductible, coinsurance (fraction after the deductible), oopMax, hsa (bool), employerHsa (a year) }] }`, written by the page. The federal tax inputs (`taxes/federal` `taxInputs`) give the marginal rate; `retirement/contributions/data/limits.js` the HSA limit.

## Outputs
`compute(plan, { today })` -> `{ tier, expected, marginal, taxRate, hsaLimit, year (whose HSA rules apply), hdhp ({ minDeductible, maxOop, hsa } for the tier), plans[], best, crossovers[], count, warnings[] }`; each plan `{ id, name, hsa, eligible, premiumsYearly, quiet, usual, bad (each { premiums, employer, oop, taxSaved, total }), worst, best }`; each crossover `{ id, name, ranges: [{ from, to | null }] }`.

## Formulas
- Out of pocket with bills m = min(oopMax, min(m, deductible) + coinsurance x max(0, m - deductible)).
- Tax rate = the federal marginal rate (the federal tax the year's HSA limit taken off income saves, per dollar, from the federal page's inputs) + `FICA` 7.65% (HSA money taken from pay skips payroll tax). Worked over the HSA limit since 2026-11-02 (before: over $1,000): the child and dependent care credit falls one point per $4,000 of joint income over $150,000 (IRC 21(a)(2)), so a $1,000 probe could land on a step and take 3 points too many, or none. The family fixture: 22% + $60 of credit over $8,750, 22.7%.
- Tax saved (HSA plans) = min(out of pocket, HSA limit - employer's HSA money) x tax rate: the care paid through the account with pre-tax money.
- A year's cost = premium x 12 - employer HSA money + out of pocket - tax saved. Quiet year `QUIET` $1,000 of bills; usual year: entered (5,000 when not); bad year `BAD` $100,000 (every plan at its maximum).
- Best = the lowest cost in the usual year. Crossovers: on a $250 grid from $0 to $200,000 of bills, the ranges where another plan costs less than the best (by more than 50 cents).
- HSA eligibility (26 U.S.C. 223(c)(2), `hsaEligible(plan, rules)`): a deductible of at least the year's minimum and a most-out-of-pocket of at most the year's maximum, both lines inclusive (`HDHP_BY_YEAR`). 2026, IRS Rev. Proc. 2025-19 section 2.01: $1,700 / $3,400 (self-only / family) and $8,500 / $17,000. 2027, Rev. Proc. 2026-24 section 3.01: $1,750 / $3,500 and $8,700 / $17,400 (both read 2026-10-31). The year is today's; a year after the newest holds the newest. A plan ticked as HSA outside these is warned.
- The most out of pocket: the maximum entered; with none entered, the deductible when there is no share after it, and unknown when there is one (the law limits what the member can be made to pay, so a plan with no cap cannot pass). Unknown counts as not eligible, and the page asks for the maximum.
- HSA limit: the contributions page's table (`LIMITS`) for the year when it has it, else the year's own figure here: 2026 $4,400 / $8,750, 2027 $4,500 / $9,000 (Rev. Proc. 2026-24).

## Edge cases
- No out-of-pocket maximum entered: no cap in the cost; for the HSA test, see Formulas.
- Employer HSA money counts only on HSA plans.
- Not modelled: copays outside the deductible, networks (in or out), an FSA beside a non-HSA plan, and from 2026 bronze and catastrophic marketplace plans counting as HSA-eligible (One Big Beautiful Bill Act).

## Tests
`module.test.mjs`: out of pocket at each stage, a year's cost with the HSA's employer money and tax saved (and its cap), no plans, the family's three plans (best, the three years, crossovers), the HSA eligibility warning, the 2027 lines and limits, a blank maximum with and without a share. `tests/golden-health.test.mjs` checks out of pocket and HSA eligibility on 1,000 rows of an independent answer key (`tools/golden_health`).

## Ideas / not yet
- Copays per visit and prescription tiers; the family's own last-year bills from the bank files.
- A Monte Carlo of the year's bills instead of three fixed years.

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** The HSA plan's saving is a marginal rate on this household's income. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. The rate is the tax a year's HSA limit takes off the Federal estimate's return, per dollar, plus 7.65% payroll tax (a freelancer pays self-employment tax instead; not changed here). Round 8 follow-up: the rate works `known()` again with the HSA limit as an adjustment (not a static probe on the final inputs), as the HSA page does, so a rental loss the lower AGI frees (IRC 469(i)(3)(F): the HSA deduction is not added back) is in it (the landlord: 25.9 cents, not 22). The payroll part is the holder's own: 6.2% only under the Social Security base, 1.45% Medicare, and none for someone self-employed with no pay (Schedule SE is not lowered by the HSA deduction). Not in it: the 0.9% extra Medicare tax the HSA money would take off (the HSA page counts it), and the HSA page's IRA deduction (the Health page keeps the IRA as the plan assumes).

## Round 8 follow-up: Medicare and wages (decided 2026-11-07)
- **Medicare**: for the adult the plan covers (self-only: the HSA page's "Who the plan covers" choice, else the adult marked "Me"; Medicare months are worked for the return's year) or while any adult is not yet on it (family), someone 65 or older receiving Social Security is on Medicare Part A, so the HSA limit used for the tax saved is 0 from the month it starts (IRC 223(b)(7); Pub. 969, read 2026-11-06), 1/12 for each month before in the year they turn 65. A warning says so in plain words: on Medicare all year, an HSA plan saves no tax on what is paid out of pocket; part of the year, only the prorated limit can go in ("From July you are on Medicare, so this year only $2,200 can go in"), never "saves no tax" while some still does. See the HSA page README for the rule and sources.
- **No wages**: with no pay for anyone and other income on the Income page, the payroll part of the rate is 0 (only cafeteria-plan pay avoids payroll tax; Pub. 15-B); wages typed on the Federal estimate count as pay.
- **Q1**: the Health page already works the Federal estimate's steps (known()) with the HSA limit as an adjustment, IRA deduction limits included; the HSA page now does the same (it no longer forces the assumed IRA): decided, the HSA page and this one both show the whole saving, IRA deduction freed included (the owner may change it). The 0.9% extra Medicare tax is still left out of this page's rate.

## Follow-up 2026-11-07 (HSA verify R3)
The line under the plans' totals names the limit and the rate only when money can go in: "HSA tax savings count your care paid through the account, up to the $4,400
self-only limit, at 12% (income tax)" ("plus payroll tax" only when the payroll part is over 0: the result's `payrollRate`); on Medicare all year (limit 0) it says
"No HSA tax savings are counted: once you're on Medicare you can't add to an HSA. Money already in the account can still pay for care, tax-free."

Money review M7 (2026-11-07): `hsaLimit` is the HSA page's own limit (`taxView(...).hsa.picture`): the covered adult's limit on self-only cover, the household's on family cover,
catch-up from 55 and the months before Medicare included. It read $4,400 where the HSA page said $5,400 (66, working), "only $2,200 can go in" for $2,700 (turning 65 in July) and
$8,750 for $9,750 (couple). Test: `tests/hsa-medicare-d.test.mjs`.
