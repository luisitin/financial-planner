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

## Review fixes 2026-11-02 (removing a person)
- Their Social Security and their own papers (a will, a power of attorney: `per: "adult"` kinds) go with them either way. `tiedTo` marks them `always`; the panel lists them apart ("These go with Bo either way"), the keep button counts only what can be kept, and the message names what went. A kept will used to lose its owner and show nowhere.
- Removing their accounts also removes the holdings, bank lines and sorting rules in them, and clears a home or car loan link and debt-plan targets that pointed at them.

## Ideas / not yet
- Spouse's Social Security and survivor rules will need `birthDate` of both adults (phase 5).
- A "dependent until age" field for college and child-tax-credit pages (phase 6).

Review 2026-11-06 (round 7): the retirement tile ("Years until you retire", "You are retired"), the warnings ("You have a birth date in the future", "Your retirement age (70) is past ..."), the remove panel ("Remove yourself from the plan?", "These are yours in the plan", "Remove your spouse and these 3") and the Social Security line named at compute time ("Your Social Security", "Your spouse's Social Security"; a person with no name reads "Their Social Security", was "Their's") say you/your for the unnamed first adult ("Me") and "your spouse" for the setup's "My spouse"; typed names read as before, and the list and the Me role pill keep the names as labels (core/words.js). Words only: no stored field changed. Test: "the first adult left unnamed ("Me") and "My spouse": warnings and Social Security say you ...".

## Wording follow-up (2026-11-07, claude-b lane B)
- A person Get started recorded as retired (guide.setup.status) shows "retired" under People even when the retirement age on file is still ahead of their age.
- Verify (2026-11-07): the tile "Ruth is retired / now" leaves out "at 71, in 2027" when the age on file is still ahead (it read as a future date under "is retired"); someone past their retirement age keeps "at 65, in 2021".
- Review round 2: `compute()` sets `retired` (and `yearsToRetirement` 0) for someone Get started recorded as retired, even with a later retirement age on file, so the tile, the list, Timeline and Next best action agree. Will the money last? says "already retired" for them too.

## Touch and input stress test (2026-11-11, claude-g)
- Impossible ages are refused at the box: a "Plan to age" at or below today's age, or not above the retirement age; a retirement
  age below today's age (changed) asks "Is Bo already retired?" first (F4).
- The open add or edit form is kept across a save elsewhere on the page (the Taxes choices save at once); a new address starts
  closed (p-career-household-system x-1, the page's part; keeping what was typed is wave 1's).
