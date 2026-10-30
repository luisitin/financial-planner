# Pensions  (`retirement/pensions`)

**Status:** usable (phase 5)
**Purpose:** Each pension: what it pays and what inflation does to it, what it is worth over the lifetime it is likely to pay for, a lump sum against the monthly payments, and the survivor option against single life, with your own life expectancy.

## Inputs
`household.people`, `retirement.pensions`, `retirement.longevity` (sex and health for the survival curve), `assumptions.inflation` and `returnBonds`, `income` (pensions entered there are listed, edited on Income). Writes `retirement.pensions[]`: `{ id, name, personId, monthly, startAge, cola, endAge, lumpSum, jointMonthly, survivorShare }` (the projection already counts `monthly`, `startAge`, `endAge`, `cola`).

## Outputs
`compute(plan, { today })` -> `{ items[], fromIncome[], realRate, nominalRate, inflation, totalMonthly }`; each item `{ id, name, personId, personName, monthly, startAge, cola, ageNow, startYear, endAge, atEightyFive, lifetime, lump, survivor }`.

## Formulas
- Payments in today's dollars (`realPayment`), as the projection treats a pension: level with a cost-of-living raise; without one, fixed in dollars from today, so divided by (1 + inflation)^(years from now). At 85: the monthly amount that way.
- Lifetime value at the start = sum over years t from the start age to the stop age (or `TO_AGE` 115) of payment_t x S(start, start + t) / (1 + real bond return)^t; S is How long to plan for's Gompertz survival for the person's sex and health, given alive at the start. Real bond return = (1 + returnBonds) / (1 + inflation) - 1.
- Lump sum: the nominal payments (rising with inflation under a COLA) weighted by survival; `impliedRate` = the rate at which their expected value equals the lump sum (bisection between -50% and 100%; +/- Infinity outside). Monthly is better when that rate is over the bond return by 0.5 point, the lump sum when under by 0.5, else close. Breakeven age = the first age at which the undiscounted payments add up to the lump sum; the chance of reaching it from the start.
- Survivor option: single life = sum of payment x S_person; joint = sum of (joint payment x S_person + joint payment x share x (1 - S_person) x S_partner) x discount, S_partner from today (the partner may die first). Better when 2% apart, else close.

## Edge cases
- No birth date: age 60 is assumed for the arithmetic.
- A pension on Income (type "pension") is counted by the projection already; it is listed, not analysed, unless added here too (the projection skips the duplicate).

## Tests
`module.test.mjs`: real payments, expected value, the implied rate (and both infinities), Income's pensions listed, the county pension by hand (lifetime, breakeven age, the survivor option), a COLA pension with a stop age, a survivor option needing both figures.

## Ideas / not yet
- Pension maximisation: single life plus life insurance against the survivor option.
- The lump sum rolled into the plan as an IRA rollover (a scenario).
