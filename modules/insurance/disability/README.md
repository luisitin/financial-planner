# Disability  (`insurance/disability`)

**Status:** usable (phase 8)
**Purpose:** If someone who earns could not work: what their disability insurance would pay against their pay, whether the household could still pay its must-pay bills, whether the cash lasts until the money starts, and what Social Security disability might add.

## Inputs
`household` (adults, retirement ages), `income` (pay: salary, bonus, business), `expenses` (must-pay bills), `accounts` (usable cash, through Emergency fund), `retirement.socialSecurity` (the PIA), `insurance.policies` (kind `disability`). Writes four optional fields on a disability policy: `waitDays`, `untilAge`, `paidBy` ("employer" | "me"), `offset` (bool).

## Outputs
`compute(plan, { today })` -> `{ earners[], essentialMonthly, cashMonths, count, warnings[] }`; each earner (an adult with pay, younger than their retirement age):
`{ id, name, age, retireAge, payYearly, grossMonthly, takeHomeMonthly, policies[], benefitMonthly, afterTaxMonthly, share, target, extraNeeded, costRange, ssdiMonthly, withSsdiMonthly, household: { essentialMonthly, othersMonthly, shortMonthly, coveredShare }, wait: { days, months, shortMonthly, needed, cash, covered, lastsMonths } }`.

## Formulas
- Take-home = the sum over the person's pay lines today of yearly / 12 x the share that reaches the bank: for a salary or a bonus the
  Paycheck page's own share (`cashflow/paycheck` `takeHomeOf`, from `takeHome().ratio`: federal withholding by IRS Publication 15-T, Social Security
  6.2% and Medicare 1.45%, the 401(k), health cover and the other deductions, as that page's README sets out); for business
  income, for every line when Paycheck cannot work one out (no salary tied to a person), and for every line when no date is given
  (which pay is current needs one; compute never reads the clock), `TAKE_HOME` (75%, the stress tests' planning assumption). The same for the other adults' take-home in the household's bills. (Whole-app sweep x3, 2026-11-16: this
  page said Ana's take-home is "about $6,338" while Paycheck said "$6,257 a month"; now both say $6,257.)
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

Review 2026-11-06 (round 7): the card titles ("If you could not work"), "Nothing would replace your pay" and the warnings ("before you plan to retire", "All of your disability insurance comes with the job") say you/your for the unnamed first adult ("Me") and "your spouse" for the setup's "My spouse", with the verb to match; typed names read as before (core/words.js). Words only: no figure or rule changed. Test: "the first adult left unnamed ("Me"): the warnings say you and your".

## Take-home as Paycheck works it out (whole-app sweep x3, 2026-11-16; tests `module.test.mjs`)
The sweep read the take-home on every page that shows one. For the invented family, this page said Ana's pay of $8,450 a month
is "about $6,338 take-home pay" (75%) and Paycheck said "$6,257 a month". Each salary and bonus now uses Paycheck's own share
(the formula above), so both pages say $6,257; Bo's take-home in the household's bills is his salary as Paycheck has it ($4,542)
plus his $600 of business income at 75% ($450): $4,992, against $4,350 before. That covers the family's $4,768 of must-pay bills
while Ana waits for a benefit, so "the wait" no longer asks the cash for anything there. Business income stays at 75% (Paycheck
does not work out its tax; counting it whole would call the gross pay "take-home"). A household whose pay is all business income
(the round 8 freelancer) reads as before.

Fix round (critics F4, F5; tests `module.test.mjs` "with no date given, compute never reads the clock"):
- With no `today`, Paycheck's own `takeHome` fell back to January 1 of the clock's year (a clock read in a compute that must be pure,
  and a different answer for pay that starts or ends during the year). The shared helper `takeHomeOf` works out no share without a
  date, so every line is at 75% then; the shell always gives the date, so no page moves.
- Paycheck's take-home is net of the payroll 401(k), the HSA and health cover. That is the right figure for the household's bills:
  the others' take-home pays them while they keep working, and their 401(k) and health cover keep coming out of their pay. For the
  person who cannot work it is only said on screen ("about $6,257 take-home pay", as Paycheck says it); their own 401(k) stops with
  their pay and is not counted anywhere here, so nothing is taken off twice.
- The Stress tests' job loss asks the same helper, so the take-home it says missing is six months of this one; Life insurance needs
  keeps 75% of pay as its planning share for a whole working life and a survivor's pay, and says so on screen (its README says why).
