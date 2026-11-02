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

## Removing a person (2026-11-02)
Remove used to drop only the person, so a partner's pay and accounts went on counting as the household's without a word
(and a married filing status stayed on with one adult). Now Remove opens a panel:
- `tiedTo(plan, personId)` lists what is theirs: income (`personId`), accounts (`ownerId`; owed ones say "owed" and link
  to Debts), saving into an account that is not already listed, their Social Security, pensions, annuity quotes, policies
  on them and estate documents in their name. `named` lists accounts and policies whose beneficiary rows still name them
  (by id or by name): only the bank or insurer can change a beneficiary form, so the page says so and never edits them.
- Two choices: **remove them too** or **keep them as the household's** (owner set to ""). A removed account takes its
  loan details (`debts`), the saving into it, its beneficiary row and its place in goals' `fundedBy` with it.
- Either way the records that only mean something with the person go: their Social Security, paycheck and benefits
  settings, human-capital and longevity answers, setup answers, `birth:<id>` paper, scenario levers `lever:<id>`.
- **Filing status.** When removing an adult leaves one adult on a married status, the plan switches to Single. The
  builder's choice: Single is the higher, safer tax estimate; the panel says head of household may apply with children
  at home, and joint filing is still allowed in the year a spouse dies, so it points at the Taxes card below.
  `compute` also warns when one adult is left on a married status, with the "Change it" link.
- **Undo.** The confirmation carries an Undo button that puts the whole plan back as it was, until the next change
  re-draws the page.

## Edge cases
No people: empty state. Missing birth date: age `null`, shown as "no birth date yet". Birth date in the future or an age over 120: a warning. Retirement age above the plan-end age: a warning. Two adults filing Single: a warning (not an error; the owner decides). More than one "Me": a warning.

## Tests
`module.test.mjs`: defaults, per-person overrides, dependents and horizon, every warning, no-today behaviour; what is tied to a person, removing with or without it, the filing switch.

## Ideas / not yet
- Spouse's Social Security and survivor rules will need `birthDate` of both adults (phase 5).
- A "dependent until age" field for college and child-tax-credit pages (phase 6).
