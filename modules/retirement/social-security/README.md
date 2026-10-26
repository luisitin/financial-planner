# Social Security  (`retirement/social-security`)

**Status:** usable (phase 5)
**Purpose:** Your benefit from your ssa.gov earnings record or your statement, and what claiming at each age pays.

## Inputs
`household` (adults, birth dates, retirement ages), `retirement.socialSecurity[personId]` = `{ claimAge, record: [{ year, earnings }], monthlyAtFRA, futureEarnings: "same"|"none" }`. Writes the same.

## Outputs
`people[]` (`fra`, `claimAge`, `source` record/typed/none, `estimate`, `monthly`, `yearly`, `options[]` at 62/64/FRA/68/70), `householdYearly`, `hasData`.

## Formulas (the SSA's, tables lifted from ssa.tools via `data/ssa.js`)
- Earnings capped at each year's taxable maximum; indexed by the average wage index of the year you turn 60 over the index of the earnings year (years after that count as is; future years use the latest index).
- AIME = the best 35 indexed years / 420, floored to the dollar. Bend points for the year you turn 62 = 180 and 1,085 scaled by the wage index of that year minus two over 1977. PIA = 90% to the first bend, 32% to the second, 15% above, floored to the dime; cost-of-living increases apply from the year you turn 62 (published values).
- Claiming: 5/9 of 1% per month early for the first 36 months, 5/12 of 1% beyond; delayed credits (8% a year for people born 1943 or later) up to 70. Full retirement age from the birth-year table.
- Credits: 4 a year at most, one per the year's earnings-per-credit; 40 needed. Future earnings: the last year repeated until the year before retiring or claiming.

## Edge cases
No birth date: nothing computed. A record with under 40 credits: shown as not yet eligible, benefit 0 in the projection. A typed statement figure is taken as the full-age amount.

## Tests
`module.test.mjs`: FRA table, claim factors (62, 65, 67, 70, born 1955), record parsing, credits, the formula on a synthetic record, future earnings, compute on a couple.

## Ideas / not yet
- Spousal and survivor benefits; the earnings test before full retirement age; taxation of benefits; Medicare premiums.
