# Disability  (`insurance/disability`)

**Status:** usable (phase 8)
**Purpose:** If someone who earns could not work: what their disability cover would pay against their pay, whether the household could still pay its must-pay bills, whether the cash lasts until the money starts, and what Social Security disability might add.

## Inputs
`household` (adults, retirement ages), `income` (pay: salary, bonus, business), `expenses` (must-pay bills), `accounts` (usable cash, through Emergency fund), `retirement.socialSecurity` (the PIA), `insurance.policies` (kind `disability`). Writes four optional fields on a disability policy: `waitDays`, `untilAge`, `paidBy` ("employer" | "me"), `offset` (bool).

## Outputs
`compute(plan, { today })` -> `{ earners[], essentialMonthly, cashMonths, count, warnings[] }`; each earner (an adult with pay, younger than their retirement age):
`{ id, name, age, retireAge, payYearly, grossMonthly, takeHomeMonthly, policies[], benefitMonthly, afterTaxMonthly, share, target, extraNeeded, costRange, ssdiMonthly, withSsdiMonthly, household: { essentialMonthly, othersMonthly, shortMonthly, coveredShare }, wait: { days, months, shortMonthly, needed, cash, covered, lastsMonths } }`.

## Formulas
- Take-home = gross pay x `TAKE_HOME` (75%, the stress tests' assumption).
- A benefit is taxed when the employer pays the premium (IRS Publication 525, "Sickness and Injury Benefits"); bought with your own taxed pay it is tax-free. After tax = benefit x `TAKE_HOME` when taxed. Default: employer-paid when the policy is through work.
- Share of pay = benefits / gross pay a month. Target = `TARGET_SHARE` (60%, the usual group long-term disability benefit) x gross; extra needed = target - benefits.
- What closing the gap costs = 1% to 3% (`COST_RANGE`, an industry rule of thumb) of the pay the extra benefit covers (extra x 12 / 60%), a year.
- The household's bills = must-pay expenses a month - the other adults' take-home - the benefits after tax (> 0 = short).
- The wait = the shortest waiting period among the policies (`DEFAULT_WAIT_DAYS` 90 when not given; with no policy, Social Security's `SSDI_WAIT_MONTHS` 5 full months, SSA publication 05-10029), in months of 365.25/12 days. During it the cash must carry max(0, must-pay bills - the others' take-home) a month; covered when usable cash now >= that x the months.
- Social Security disability, if approved: the full-retirement-age amount (PIA) from the Social Security page. Once it pays, a policy with an offset (most group plans) pays only the part above it: together = PIA + after tax(max(0, benefit - PIA)); without an offset they stack.
- Odds: "about 1 in 4 of today's 20-year-olds" will be disabled before full retirement age (SSA, "Disability Benefits" and its fact sheet).

## Warnings
- A policy that stops paying before the person plans to retire (`untilAge` < retirement age; 65 when not given).
- All of a person's cover is through work.

## Edge cases
- No pay, or past the retirement age: not an earner.
- An ended policy (end date passed) does not count.
- The PIA stands in for the disability benefit (SSA works it from the earnings up to the onset, with fewer years averaged); close for steady careers.

## Tests
`module.test.mjs`: tax on the benefit and who pays, an empty plan, the family with Ana's work policy (share, after tax, defaults, the household's bills, the Social Security offset, Bo's target and cost), the wait with and without enough cash, a self-paid policy that stacks and stops early, who counts as an earner.

## Ideas / not yet
- Short-term disability (sick pay) as the bridge across the long-term waiting period.
- "Own occupation" versus "any occupation" definitions; cost-of-living riders.
- Run the "never work again" stress test from here with the policy terms.
