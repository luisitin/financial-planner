# Health plan compare  (`insurance/health`)

**Status:** usable (phase 8)
**Purpose:** The health plans you can choose from, on what each really costs a year: premiums plus your share of the bills, less the employer's HSA money and the tax an HSA saves, in a quiet year, your usual year and a bad year; which plan wins at which level of bills, and which can have an HSA.

## Inputs
`insurance.health = { tier: "self"|"family", expected (a usual year's bills, what the plan is charged), plans: [{ id, name, premium (yours, a month), deductible, coinsurance (fraction after the deductible), oopMax, hsa (bool), employerHsa (a year) }] }`, written by the page. The federal tax inputs (`taxes/federal` `taxInputs`) give the marginal rate; `retirement/contributions/data/limits.js` the HSA limit.

## Outputs
`compute(plan, { today })` -> `{ tier, expected, marginal, taxRate, hsaLimit, year (whose HSA rules apply), hdhp ({ minDeductible, maxOop, hsa } for the tier), plans[], best, crossovers[], count, warnings[] }`; each plan `{ id, name, hsa, eligible, premiumsYearly, quiet, usual, bad (each { premiums, employer, oop, taxSaved, total }), worst, best }`; each crossover `{ id, name, ranges: [{ from, to | null }] }`.

## Formulas
- Out of pocket with bills m = min(oopMax, min(m, deductible) + coinsurance x max(0, m - deductible)).
- Tax rate = the federal marginal rate (the tax on $1,000 more of income, from the federal page's inputs) + `FICA` 7.65% (HSA money taken from pay skips payroll tax).
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
