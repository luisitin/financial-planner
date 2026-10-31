# Life insurance needs  (`insurance/life-needs`)

**Status:** usable (phase 8)
**Purpose:** How much life insurance each adult needs if they died this year, three ways, against the cover on the Policies page.

## Inputs
`household` (adults, children's birth dates), `accounts` (savings, debts, the mortgage), `debts`, `income` (pay), `expenses` (what the household spends now), `goals` (education goals: a name with college, university, school, tuition, education or degree), `retirement` (the plan, contributions, Social Security), `assumptions`, `insurance.policies` (life cover in force). Writes nothing. Heavy: the plan is run about thirty times per adult, on the PC when connected.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, people[], children[], startYear, spendingYearly }`; each person:
`{ id, name, age, pay, cover, coverWork, survivorName, plan, dime, lifetime, need, method: "plan"|"dime", gap, spare, gapIfJobEnds, dependants, termUntil }`.
`plan` (couples only): `{ need, gapYears: [{ year, amount, benefits }], firstGap, benefits: { childMonthly, parentMonthly, familyMaxMonthly, childUntil }, withCover: { success, failAge, failYear }, survivorRetireYear, survivorPay }`.

## Formulas
All in today's dollars.

**1. The plan's own answer (a couple).** The survivor's plan is `scenarios/stress-tests` `survivorInputs()`: the one who died loses their pay, retirement saving and Social Security record; their accounts pass to the survivor; spending is `SURVIVOR_SPENDING` (75%) of the couple's; the survivor's Social Security is the larger of their own and the survivor amount; filed single, or head of household with children. Spending is held level in real terms (fixed-real) for the search, whatever the plan's own strategy. On top:
- the funeral, `FUNERAL` ($8,300, NFDA 2023 median), this year;
- each year before the survivor retires, the living costs their pay does not cover: `max(0, expenses a year x 75% - (survivor's pay x TAKE_HOME 75% - survivor's own retirement saving) - family Social Security)`. A year with money left over adds nothing (it is not counted as saved: conservative).
- Family Social Security on the deceased's record (their full-retirement-age amount, PIA, stands in for the survivor computation): each child under 18 gets 75% of the PIA, the parent caring for a child under 16 gets 75% (SSA, "Survivors Benefits", publication 05-10084); the total is capped at the family maximum and shared out pro rata; then the parent's benefit loses $1 for every $2 of pay over `earningsTestExempt(the plan's first year)` ($24,480 in 2026, $25,560 in 2027; a later year holds the newest; ssa.gov/oact/cola/rtea.html, read 2026-10-31). A year's share runs to the month of the 18th / 16th birthday.
- Family maximum = 150% of the PIA up to b1 + 272% from b1 to b2 + 134% from b2 to b3 + 175% above b3, floored to the dime; b1, b2, b3 = $230, $332, $433 x AWI(year of death - 2) / AWI(1977), rounded (Social Security Act 203(a); SSA POMS RS 00615.736 B.1 (TN 57, 12/14/2023); ssa.gov/oact/cola/familymax.html, read 2026-10-31). 2026: $1,643, $2,371, $3,093.
- The need is the smallest lump sum, paid this year into savings, with which the survivor's plan lasts to the end (`goal-seek` `smallestWhere`, to $50, shown rounded up to $1,000). If the plan with both alive already runs short, the survivor's plan must last at least as long as that one.

**2. DIME.** Debts (every liability but mortgages and home-equity lines) + final expenses (`FUNERAL`) + Income (the person's pay x years until the youngest child turns 18; none without children) + Mortgage (owed) + Education (education goals' target - saved; only with children).

**3. Lifetime earnings (human life value).** For each year until the person's retirement age: pay x `TAKE_HOME` x (1 - `OWN_SHARE`), where `OWN_SHARE` = 1 - `SURVIVOR_SPENDING` is what they spent on themself; grown at the real pay growth `(1 + salaryGrowth)/(1 + inflation) - 1` and discounted at the real bond return `(1 + bonds)/(1 + inflation) - 1`, paid at the start of each year.

**Verdict.** `need` = the plan's answer when there is one, else DIME. `gap` = max(0, need - life cover in force on that person); `spare` the other way; `gapIfJobEnds` without the cover marked through work. `termUntil`: the youngest child's 22nd birthday year (`SCHOOL_DONE`), else the survivor's retirement.

## Edge cases
- One adult with no children: no one depends on the income; only the funeral and debts are shown.
- One adult with children: no survivor plan can be built (the plan needs an adult); DIME and lifetime earnings only.
- No Social Security figure for the one who dies: no family benefits are counted.
- A child still in high school at 18 can be paid to 19; not modelled (conservative).

## Tests
`module.test.mjs`: the family maximum at 2026's bend points, the share of a year under an age, the family's benefits (earnings test, the maximum shared out, grown children), lifetime earnings with and without discounting, not ready, the family's three answers, the plan's answer is the smallest that works (a little less fails), cover through work, a single adult.

## Ideas / not yet
- The need year by year (if death came in 5, 10, 15 years) to size a laddered term.
- Stay-at-home parent: the cost of replacing their unpaid work (childcare, housekeeping).
- Child benefits to 19 while in high school; the survivor's widow(er)'s benefit from 60 before retirement.
