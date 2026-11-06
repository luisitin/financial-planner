# Job offer compare  (`career/offer-compare`)

**Status:** usable, phase 10
**Purpose:** Compares job offers on total compensation, including benefits and equity, not just salary.

## Inputs
- Whose job (`whatIfs.offers.personId`, else the "self" adult with a salary, else the first adult with one).
- The job now, from the plan: that person's active salaries and bonuses (`income[]`), the employer match on their
  retirement contributions (`retirement.contributions[].employerMatch`, yearly), the employer's HSA money
  (`taxes.hsa.employer`, a household figure, so only for the plan's "self" or its only earner), their raise (the first salary's `growth`, else `assumptions.salaryGrowth`), and the stock
  still to vest at the employer (`equity.grants`, valued by `investments/employer-stock` at its price; grants for this
  person, or for nobody in particular). Every figure can be typed over in `whatIfs.offers.current`.
- Up to three offers (`whatIfs.offers.offers[]`): `{ id, name, salary, bonus, signOn, stockYearly, matchRate,
  matchUpTo, matchYearly?, hsaEmployer, premium, otherYearly, ptoDays, hoursWeek, officeDays, commuteMinutes,
  commuteCost, raise, stateRate, movingCost }`; `years` compared (default 4, the usual vesting).
- The household's federal tax (`taxes/federal` `taxInputs`), the state's rate (`taxes/state`), the Social Security wage
  base (`retirement/social-security` `maximumEarnings`).
- Writes only `whatIfs.offers`.

## Outputs
`compute(plan, { today })` -> `{ ready, person, years, options: [job now, ...offers], best, forfeit, baseFederal, stateNow, notes }`;
each option: `{ id, name, current, inputs, yearly: { salary, bonus, stock, match, hsa, other, premium, total }, signOn, moving,
tax: { federal, payroll, state, total }, afterTax, steadyAfterTax, time: { weeks, work, commuteHours, commuteCost, commuteDays },
perHour, overYears: { gross, afterTax, commute, net }, stockYears, stockShare, ifStockHalves, rows, rank, vsCurrent }`.

## Formulas
- **Retirement match** (`matchFor`) = a typed yearly amount, else match rate × min(the cap (share of pay) ×
  min(salary, $360,000), $24,500), assuming you put in at least the cap (the usual advice: never leave match money
  behind). A plan can figure the match only on pay up to the compensation limit (IRC 401(a)(17): $360,000 in 2026,
  Notice 2025-67, in `career/benefits/data/benefits.js`), and you can put in at most the deferral limit (IRC 402(g):
  $24,500 in 2026, `retirement/contributions/data/limits.js`, through `limitsFor`).
- **Pay and benefits a year** = salary + bonus + stock + match + employer health-account money + other benefits −
  the health premiums you pay.
- **Tax** (`taxYear`), each year: the wages taxed = salary + bonus + stock (+ the sign-on in year one) − premiums (paid
  before tax through the employer's cafeteria plan, IRC 125, so free of income tax and of Social Security and Medicare,
  IRC 3121(a)(5)(G)).
  - The child and dependent care credit's cap is the lower earner's earned income on a joint return (IRC 21(d)(1)(B)): each
    year's tax works it again with this person on the job's pay (`taxYear`'s `careAt`, federal `careInputsWith`), so a
    job for a spouse with no pay counts the credit it unlocks, and the job now counts the credit it keeps (2026-11-02:
    the plan's figure was kept, so the family with Bo earning nothing and a 50,000 offer for Bo showed 1,050 more federal
    tax than the Federal estimate adds with that pay in the plan). The person's earned income is their pay before the child
    care account (after the plan's pre-tax 401(k)) moved by the job's pay against the plan's; the other adult's account
    stays out of income only up to the lower earner's earned income (the account's one rule), and the wages move by
    `careInputsWith`'s `wagesChange` (Bo at no pay, Ana's 5,000 account, a 50,000 offer for Bo: the 5,000 stays out of
    income, as the Federal estimate has it with that pay in the plan; review of 2026-11-02).
  - Federal = the household's `federalTax` with the rest of the household's wages (the plan's wages less this person's
    pay as the Income page has it, so everyone's pre-tax 401(k) saving stays as it is; it may be negative, the sum is
    floored at 0) + this job's, less the same without this job; the engine's own 0.9% extra Medicare figure is left out
    (it is counted with payroll, below). Each later year uses that year's tables (`paramsFor`, indexed with the plan's
    inflation past the last published year) and that year's wage base (SSA: $184,500 in 2026, $192,300 in 2027;
    https://www.ssa.gov/oact/cola/cbb.html, checked 2026-10-31).
  - Payroll = 6.2% Social Security up to the year's wage base ($184,500 in 2026, SSA) + 1.45% Medicare (IRC 3101) +
    0.9% on the household's Medicare wages (pay before 401(k) saving, IRC 3121(v)(1)(A)) above $250,000 joint /
    $200,000 single / $125,000 separate (IRC 3101(b)(2)), less what the rest of the household already pays of it.
  - State = the job's state rate (typed for an offer in another state, else the State tax page's rate) × the wages.
    Counted on this job's pay only, not the rest of the household's.
- **Kept a year** = pay and benefits + sign-on − tax − moving costs (year one); the year card also takes off the
  year's commuting cost, as the verdict does. The match and health-account money are
  not taxed now (the 401(k) is taxed when withdrawn); other benefits are counted untaxed.
- **Years compared**: salary, bonus and match grow with the job's raise each year; offers' stock is the same each year;
  the job now's stock is what its grants vest in each 12-month stretch ahead (at today's price; no new grants assumed
  unless a yearly figure is typed). Options count at their spread (price − strike) as they vest, as if bought and taxed
  as pay then (a nonqualified option exercised at once); incentive options are taxed differently (`career/equity`). Net over the years = Σ kept − commuting cost × years. The best is the highest net.
- **Time** (`timeFor`): weeks worked = 52 − days off ÷ 5; hours of work = hours a week × weeks; commuting days = days
  at the workplace a week × weeks; commute hours = days × 2 × minutes ÷ 60; commuting cost = days × the cost a day.
- **An hour of your time** = (a year kept without the sign-on and the move − commuting cost) ÷ (work + commute hours).
- **If the stock halved** = the net over the years again at half the share price (taxed as it would be): offers' stock
  and RSUs halve; the employer's options keep only max(0, half price − strike).
- **Leaving gives up** = the value of every share still to vest at the employer now (RSUs at the price, options at the
  spread), shown as a note; the comparison already counts only what would vest within the years compared.
- Blank days off, hours and raise on an offer are the job now's; for the job now (and office days anywhere) they are
  19 days off (the private-industry average after a year of service for workers who get paid time off: 11 paid
  vacation days, BLS National Compensation Survey, Employee Benefits in the United States, March 2026,
  https://www.bls.gov/ebs/publications/employee-benefits-in-the-united-states-march-2026.htm, and 8 paid holidays in
  2025, BLS The Economics Daily, 10 Feb 2026,
  https://www.bls.gov/opub/ted/2026/paid-sick-leave-was-available-to-80-percent-of-private-industry-workers-in-2025.htm),
  40 hours and 5 days (examples, said so on each form). The form's help quotes what workers paid for health cover in
  2026 ($1,672 alone, $7,471 for a family; KFF Employer Health Benefits Survey 2026) and the average one-way commute
  (27.4 minutes, the mean travel time to work; Census American Community Survey 2025 1-year, Table S0801, released
  29 Oct 2026), all checked 2026-10-30.

## Edge cases
- No pay on Income and nothing typed for the job now, with an offer: the job now is "No job now": no pay, match,
  health-account money, hours or hourly figure unless typed; offers are compared "against having no job".
- A state with brackets and no typed or known rate: state tax is not counted, with a note.
- The match is counted as yours at once; a vesting schedule for it is not modelled (the page says you may have to stay).

## Tests
`module.test.mjs`: the match (typed, by rate, the two legal caps), the time a job takes, a year's tax (federal by the
engine, the wage base, the 0.9% on Medicare wages, the state, other wages below zero), the family's job now against an
offer by hand (year one, later years with their own tables, the commute, per hour, the best), a single earner's
federal tax equal to the Federal page's, each year's wage base, the household's 0.9%, half the stock (offers and the
employer's options), the employer's grants vesting by year and what leaving gives up, no job now, typed figures,
whose job, offers taking the job now's blanks, the HSA money's owner, a state rate per job, not ready.

## Ideas / not yet
- The match's vesting schedule (cliff or graded) against the years you would stay; the pension's value.
- Cost of living in another city (rent and prices), and the household's other earner moving too.
- A refresher grant a year for the job now; stock options' value beyond their spread.

## Child care account and separate returns, fourth pass (2026-11-02)
- `taxYear(pay, { ..., personId, account })`: the person's own child care account leaves the job's pay before Social Security
  and Medicare, all of the election up to a plan's limit (IRC 3121(a)(18); W-2 box 10 instructions), and before the state's tax
  the part that stays out of income (excluded and lost: `off`). Jo with 5,000 (Ohio): the job now keeps 70 more with the
  account (54,684 against 54,614), the 382.50 of payroll and 137.50 of Ohio tax it saves counted, as Benefits says (it kept
  450 less: the federal part only). The other adults' accounts are out of the household's Medicare wages for the 0.9%.
- Filing separately the job's pay is on this person's own return (`separateTo` = the person; IRS Pub. 501), and the 0.9% is
  worked on their own Medicare wages against the separate return's 125,000. Bo in the family filing separately with 3,750
  each: the job now's federal 5,722 (his own return with his pay against without it); it said 9,109.87, his pay taken off
  Ana's return.

## Review 2026-11-06
- **Money the child care account would lose is not kept.** `taxYear` returns `lost`, the account's money beyond the care it
  pays back (`own.forfeited`, Form 2441 line 14, at most the pay): `afterTax = gross - tax - lost - moving`, the steady year
  too. The year's lines show "Child care account money lost". Jo, a 5,000 account: with 900 a month of care she keeps
  54,684; with no care all 5,000 is lost: 49,684 (the page said 54,684, the account looking 1,120 better than none); with
  1,800 of care, 3,200 lost: 51,484.
- **The business on its owner's return.** The year's tax starts from the Federal estimate's inputs with the business at
  its profit, half its self-employment tax and its 20% deduction off (withholding `withBusiness`): Bo's job now, filing
  separately with 3,750 each, 5,500.37 of federal tax (5,722 with the business counted in full); Ana's job now in the
  family's joint test follows the same inputs.
- "1 years" reads "1 year".
- Tests: "the money the child care account would lose is not kept", "filing separately, Bo's job is on his own return
  with his business at its profit and its deductions".
