# Long-term care  (`insurance/ltc`)

**Status:** usable (phase 8)
**Purpose:** The odds you will need care in later life, what it costs, and whether your plan could pay for it itself (self-insure) or a long-term care policy would help.

## Inputs
`household`, `accounts`, `income`, `retirement` (the plan; `retirement.longevity[personId].sex` for the average years and the chance of reaching the age), `assumptions`, `insurance.policies` (kind `ltc`), `insurance.ltc` (the care to plan for). Writes `insurance.ltc = { care, startAge, years, costFactor }` and three optional fields on an ltc policy: `waitDays`, `benefitYears`, `inflationProtected`. Heavy: about twenty plan runs per adult.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, primary, settings, care: { key, label, short, yearly }, base: { success, failAge, endReal }, people[] }`; each adult:
`{ id, name, age, sex, startAge, fromYear, years, reachChance, costYearly, costTotal, self: { success, failAge, failYear, endReal }, maxYears, shortToday, policy, withPolicy }`.

## Data
| care | a year | basis |
|---|---|---|
| Nursing home, private room | $129,575 | $355 a day |
| Nursing home, shared room | $114,975 | $315 a day |
| Assisted living | $74,400 | $6,200 a month, one bedroom |
| Caregiver at home | $80,080 | $35 an hour, 44 hours a week, 52 weeks (the survey's "non-medical caregiver", which now includes home health aides) |
| Adult day care | $24,700 | $95 a day, 5 days a week, 52 weeks |
National medians, CareScout / Genworth Cost of Care Survey 2025 (collected July to November 2025, released March 2, 2026: investor.genworth.com press release 1054, read 2026-10-31). Update `CARE` and `COST_YEAR` each spring.

Odds: "almost 70%" of people turning 65 will need some long-term care; women for 3.7 years on average, men for 2.2 (US Administration for Community Living, "How much care will you need?"; acl.gov was not reachable from the build session, so the figures were read from reports quoting it).

## Formulas
- Settings: care `nursing`, from 85, cost factor 100%; years = the stored value, else the average for the person's sex (3.7 / 2.2), else 3.
- Care starts at max(today's age, min(start age, max(retirement age, plan end age - ceil(years) + 1))), so it fits inside the plan.
- Care events (`careEvents`): each year from the start, cost = yearly cost x cost factor x the share of the year (the last one partial), in today's dollars, out of savings on top of normal spending (the engine's `events`).
- A policy pays after its waiting period (`waitDays`, 90 when not given; the first year loses waitDays / 365), up to the monthly benefit x 12 x the covered share, until its pool (monthly x 12 x `benefitYears`, 3 when not given) is spent. Without `inflationProtected` the benefit is a fixed dollar amount: in today's dollars it is divided by (1 + inflation)^(year - this year), the pool likewise.
- Premiums: the policy's yearly premium, level in dollars, out of savings every year from now until care starts (divided by (1 + inflation)^years in today's dollars). `withPolicy` = the care less what the policy pays, plus the premiums: what keeping the policy does to the plan. `premiumsToStart` is their sum in today's dollars.
- Most years the plan can carry (`maxYears`): the largest years of this care (to 0.05, up to `MAX_YEARS` 15) with which the plan still lasts (goal-seek `largestWhere`); null when the plan fails without care.
- Short today (`shortToday`): when the plan cannot pay for the care, the smallest lump sum added to savings today with which it can (goal-seek `smallestWhere`, rounded up to $1,000).
- Chance of reaching the start age: `retirement/longevity` `survival(age, startAge, { sex, health })`.

## Edge cases
- The plan fails without care: the page says to fix that first; no years or lump sum are worked out.
- Care costs rise faster than prices over time; the plan keeps them level in today's dollars (a known understatement).
- Medicaid (once savings are nearly gone, about $2,000 in most states) and partnership policies are mentioned, not modelled.

## Tests
`module.test.mjs`: the medians, the settings and their defaults, care events with and without a policy (wait, pool, the plan's end), the inflation erosion, not ready, the family (costs, the most years, the policy against its premiums, an inflation rider), care the plan cannot pay for.

## Ideas / not yet
- State costs from the survey's tables; care costs growing faster than inflation.
- Hybrid life / long-term care policies; a couple's shared-care rider.
- Both partners needing care, one after the other.
