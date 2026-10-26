# People  (`household/people`)

**Status:** usable (phase 2)
**Purpose:** Records you, your partner and dependents with birth dates, retirement ages, life expectancy, tax filing status and state.

## Inputs
Plan sections read (`needs`): `household`, `assumptions` (default `retirementAge`, `planEndAge`).
`compute(plan, { today })`: `today` is the ISO day ages are computed on; the view passes `ctx.fmt.today()`. Without it every age is `null`.

## Outputs
`people[]`: each person plus `age`, `retirementAge`, `retirementDate`, `yearsToRetirement`, `retired`, `planEndAge`, `planEndDate`, `yearsLeft`.
`count`, `adults`, `dependents`, `self` (the person with role `self` or null), `filingStatus`, `filingLabel`, `state`, `horizonYears` (years until the last adult reaches their plan-end age), `warnings[]` (plain sentences).

## Formulas
- Age: whole years since the birth date, birthday-aware (`core/math/dates.js` `ageOn`).
- Retirement date: birth date plus the retirement age in years (`dateAtAge`). Years to retirement = max(0, retirement age - age).
- Plan-end date: birth date plus `lifeExpectancy` (per person) or `assumptions.planEndAge`. Years left = max(0, plan-end age - age).
- Horizon: the largest `yearsLeft` among adults. Dependents never set the horizon.
- Constants: `ROLES` (self, partner, dependent), `FILING_STATUSES` (the five federal statuses), `US_STATES` (50 states + DC).

## Edge cases
No people: empty state. Missing birth date: age `null`, shown as "no birth date yet". Birth date in the future or an age over 120: a warning. Retirement age above the plan-end age: a warning. Two adults filing Single: a warning (not an error; the owner decides). More than one "Me": a warning.

## Tests
`module.test.mjs`: defaults, per-person overrides, dependents and horizon, every warning, no-today behaviour.

## Ideas / not yet
- Spouse's Social Security and survivor rules will need `birthDate` of both adults (phase 5).
- A "dependent until age" field for college and child-tax-credit pages (phase 6).
