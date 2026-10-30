# Auto, home, umbrella  (`insurance/property`)

**Status:** usable (phase 8)
**Purpose:** Whether the home, car and umbrella cover is enough for what you own: the home insured for the cost to rebuild, the liability limits against the net worth a lawsuit could reach, an umbrella when it makes sense, and the deductibles against the cash.

## Inputs
`accounts` (net worth, retirement accounts, homes: type `property`, cars: type `vehicle` or a loan named for a car), `insurance.policies` (kinds `home`, `auto`, `umbrella`). Writes three optional fields on a home policy (`rebuildCost`, `liability`, `deductible`) and `deductible` on an auto policy. A home policy may carry `accountId` to pair it with a home when there are several.

## Outputs
`compute(plan, { today })` -> `{ netWorth, exposed, shielded, ownsHome, homes[], auto, homeLiability, homeLiabilityKnown, umbrella, inCar, atHome, suggestedUmbrella, umbrellaCost, deductibles, checks[], hasAny }`; each check `{ id, ok: true|false|null, title, text, go }`.

## Formulas
- Shielded = 401(k) balances (ERISA plans are out of creditors' reach) + min(IRA and Roth balances, `IRA_LIMIT` $1,711,975: the bankruptcy cap for IRAs, 11 U.S.C. 522(n), adjusted April 1, 2025). Exposed = max(0, net worth - shielded). Homestead exemptions (state law) are not counted.
- Home: dwelling cover / rebuild cost; "ok" from 100%, "low" from `COINSURANCE` 80% (the coinsurance clause: below it most policies also cut partial-loss payments), "under" below. Without a rebuild cost the page explains that the sale price includes land.
- Car: liability per accident (the policy's benefit) against `AUTO_MIN` $300,000 (the common 100/300/100 advice).
- Liability: in a car accident = car limit + umbrella; at home = home liability (`HOME_LIABILITY_DEFAULT` $100,000 when not entered) + umbrella. Protected when the weaker of the two >= exposed.
- Umbrella suggested when there is none and exposed > the higher underlying limit: rounded up to `UMBRELLA_STEP` $1,000,000; cost $150 to $300 a year per million (Insurance Information Institute). An umbrella on file is checked against what insurers usually require underneath (`UMBRELLA_UNDER`: $500,000 per accident on cars, $300,000 on the home).
- Deductibles: the sum of the home and car deductibles entered against usable cash (Emergency fund's "now"); with three times that in cash, a higher deductible is suggested.

## Edge cases
- No home and no home policy: renters insurance is suggested.
- Several homes: paired with home policies by `accountId`, else one to one when the counts match.
- A car is recognised from a `vehicle` account or a loan whose name mentions a car.

## Tests
`module.test.mjs`: an empty plan, the shielded and exposed amounts (with the IRA cap), the family's checks, the rebuild statuses, the umbrella suggestion and its price, the car checks, the deductibles.

## Ideas / not yet
- State minimum car limits and uninsured-motorist cover; flood and earthquake (not in standard home policies).
- Homestead exemptions by state; renters' contents value against the belongings.
