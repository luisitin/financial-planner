# Salary and raises  (`career/salary`)

**Status:** usable, phase 10
**Purpose:** Maps out how your salary could grow with raises and promotions, shown in today's dollars.

## Inputs
- Each active "Pay from a job" item on the Income page (`income[]` with `type: "salary"`, not one-off): its yearly
  amount, its raise (`growth`) and whose it is (`personId`).
- The holder's birth date and retirement age (`household.people[]`, else `assumptions.retirementAge`);
  `assumptions.inflation`, `assumptions.salaryGrowth` (the raise when the Income page has none).
- The household's federal tax (`taxes/federal` `taxInputs`), the state's rate (`taxes/state`), the Social Security wage
  base (`retirement/social-security` `maximumEarnings`).
- Writes `whatIfs.salary = { [incomeId]: { raise, promoEvery, promoBump, levelAge } }` (raise null = the Income page's),
  and, on "Use ... on the Income page", that income's `growth`.

## Outputs
`compute(plan, { today })` -> `{ ready, year, inflation, jobs[], total: { pay, lifetimeReal, lifetimeNominal }, state, benchmarks, warnings }`;
each job: `{ incomeId, name, personId, personName, pay, ageNow, retireAge, retireYear, knownAge, settings, raiseFrom, incomeGrowth, rows: [{ year, age, pay, real, weight, growth, promoted }], atEnd, lifetime: { nominal, real }, avgGrowth, realGrowth, realRaise, extraPercent, raiseNowWorth, nextRaise: { amount, federal, payroll, state, keep, share } }`.

## Formulas
- **The years.** From today to the holder's retirement birthday (birth year + retirement age, on the birth date), or to
  the income's end date on the Income page when that comes first; with no birth date, or pay linked to nobody, 25 years
  (`HORIZON`). Each calendar year's `weight` is the share of it still worked: positions on the
  calendar are year + `yearFraction` (month − 1 + (day − 1) ÷ days in the month) ÷ 12, and weight = min(year + 1, end)
  − max(year, start). This year counts only what is left of it; the retirement year only the months before the birthday.
- **The pay path** (`payPath`). Year 0 is today's yearly pay. Each later calendar year: pay × (1 + raise), and in every
  `promoEvery`-th year also × (1 + promotion raise). From the year the holder reaches `levelAge`, the raise is the
  smaller of the raise and the inflation rate, and promotions stop (pay keeps up with prices, no more; a raise already
  under prices stays as it is). The age needs a birth date. The raise is the one typed here, else the
  Income page's (when above 0), else `assumptions.salaryGrowth`. The promotion raise starts at 10%, only an example
  to change (`data/benchmarks.js`); the form says so.
- **Today's money.** real = pay ÷ (1 + inflation)^t, t = years from now. Real raise = (1 + raise) ÷ (1 + inflation) − 1.
- **Pay still to come** (`lifetime`) = Σ pay × weight (dollars of each year) and Σ real × weight (today's money).
- **Average growth** = (last year's pay ÷ today's pay)^(1 ÷ years between) − 1: the single raise that reaches the same
  pay, offered as the Income page's raise. Real growth = (1 + average) ÷ (1 + inflation) − 1; a real growth under 0
  is warned about. "Use it on the Income page" (`useAverage`) writes the average to that income's `growth` and pins
  this page's own raise, so the promotions are not counted again on top of the new figure.
- **One more percent a year** = the path again at raise + 1%, its pay still to come in today's money, less the plan's.
- **A raise won now** (5%, `RAISE_NOW`) scales every later year: pay still to come (today's money) × 5%, which is the
  same as the whole path again at 105% of today's pay.
- **What the next raise keeps** (`keepOfRaise`), for next year's rise along the path (pay in year 1 − pay now, so a
  promotion next year or a level-off age already reached is in it): federal = the household's `federalTax` with
  wages + the raise, less without (income tax and the credits that phase out, from `core/math/tax.js` and the 2026
  tables), without the engine's 0.9% extra Medicare tax; Social Security 6.2% on the part of the raise under the
  year's wage base ($184,500 in 2026, SSA) after the holder's other pay; Medicare 1.45% on all of it (IRC 3101(b)),
  plus 0.9% on the part of the household's Medicare wages above $250,000 joint / $200,000 single / $125,000 separate
  (IRC 3101(b)(2)), Medicare wages being pay before pre-tax 401(k) saving (IRC 3121(v)(1)(A)), shown with Medicare;
  the state's rate from the State tax page (typed, last year's average rate, or the state's flat rate; 0 in states with
  no wage tax; not counted when unknown; the page says that last year's average understates the tax on a raise in
  states with brackets). Keep = raise − the three.

## Edge cases
- No salary on Income: an empty state pointing there. Bonuses (`type: "bonus"`) are not part of the path (their
  holder's pay still counts toward the Social Security wage base and the household's Medicare wages).
- Already at or past the retirement age: the job shows no years ahead.
- Pay that falls behind prices on average, pay linked to nobody, and a holder without a birth date (shown for 25 years,
  the level-off age unused) are warned about.
- Two salaries for one person are two jobs.

## Tests
`module.test.mjs`: the year fraction, the path (compounding, today's money), promotions, the level-off age, part years
and the pay still to come, what a raise keeps (wage base, state, none, the extra Medicare tax on Medicare wages), the
family by hand, one more percent, a raise won now against the path, average and real growth with promotions by hand,
the next raise along the path, an end date, pay linked to nobody, a holder at retirement age, typed settings, using the
average twice changes nothing, the warnings, not ready.

## Ideas / not yet
- Bonuses grown with the pay; a career break (years of no pay) and a part-time stretch.
- The pay path into Social Security's future earnings and the retirement projection's savings growth.
