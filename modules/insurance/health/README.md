# Health plan compare  (`insurance/health`)

**Status:** usable (phase 8)
**Purpose:** The health plans you can choose from, on what each really costs a year: premiums plus your share of the bills, less the employer's HSA money and the tax an HSA saves, in a quiet year, your usual year and a bad year; which plan wins at which level of bills, and which can have an HSA.

## Inputs
`insurance.health = { tier: "self"|"family", expected (a usual year's bills, what the plan is charged), plans: [{ id, name, premium (yours, a month), deductible, coinsurance (fraction after the deductible), oopMax, hsa (bool), employerHsa (a year) }] }`, written by the page. The federal tax inputs (`taxes/federal` `taxInputs`) give the marginal rate; `retirement/contributions/data/limits.js` the HSA limit.

## Outputs
`compute(plan, { today })` -> `{ tier, expected, marginal, taxRate, hsaLimit, year, plans[], best, crossovers[], count, warnings[] }`; each plan `{ id, name, hsa, eligible, premiumsYearly, quiet, usual, bad (each { premiums, employer, oop, taxSaved, total }), worst, best }`; each crossover `{ id, name, ranges: [{ from, to | null }] }`.

## Formulas
- Out of pocket with bills m = min(oopMax, min(m, deductible) + coinsurance x max(0, m - deductible)).
- Tax rate = the federal marginal rate (the tax on $1,000 more of income, from the federal page's inputs) + `FICA` 7.65% (HSA money taken from pay skips payroll tax).
- Tax saved (HSA plans) = min(out of pocket, HSA limit - employer's HSA money) x tax rate: the care paid through the account with pre-tax money.
- A year's cost = premium x 12 - employer HSA money + out of pocket - tax saved. Quiet year `QUIET` $1,000 of bills; usual year: entered (5,000 when not); bad year `BAD` $100,000 (every plan at its maximum).
- Best = the lowest cost in the usual year. Crossovers: on a $250 grid from $0 to $200,000 of bills, the ranges where another plan costs less than the best (by more than 50 cents).
- HSA eligibility (2026, IRS Rev. Proc. 2025-19): a deductible of at least $1,700 (self-only) / $3,400 (family) and an out-of-pocket maximum of at most $8,500 / $17,000 (`HDHP`). A plan ticked as HSA outside these is warned.

## Edge cases
- No out-of-pocket maximum entered: no cap.
- Employer HSA money counts only on HSA plans.
- Not modelled: copays outside the deductible, networks (in or out), an FSA beside a non-HSA plan, and from 2026 bronze and catastrophic marketplace plans counting as HSA-eligible (One Big Beautiful Bill Act).

## Tests
`module.test.mjs`: out of pocket at each stage, a year's cost with the HSA's employer money and tax saved (and its cap), no plans, the family's three plans (best, the three years, crossovers), the HSA eligibility warning.

## Ideas / not yet
- Copays per visit and prescription tiers; the family's own last-year bills from the bank files.
- A Monte Carlo of the year's bills instead of three fixed years.
