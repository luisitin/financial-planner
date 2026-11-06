# Financial independence  (`retirement/fire`)

**Status:** usable (phase 5)
**Purpose:** The pot that could pay for your life without a paycheck, how far you are, and the years to get there at your pace.

## Inputs
Spending (the retirement figure or today's expenses), invested money (taxable + deferred + free buckets), contributions, income and expenses (what is left over), `assumptions`, `retirement.withdrawalRate`, `retirement.stocksNow`.

## Outputs
`fiNumber`, `invested`, `progress`, `gap`, `savingYearly`, `savingsRate`, `realReturn`, `yearsToFi`, `fiAge`, `fiYear`, `coast` (number, reached), `retireAge`.

## Formulas
- FI number = yearly spending / withdrawal rate (4% -> 25x).
- Saving a year = contributions (own + employer) + max(0, left over each month x 12 - own contributions) so nothing is counted twice.
- Real return = the stock/bond blend at `stocksNow` deflated by inflation. Years to FI: grow the invested pot by the real return plus the yearly saving until it reaches the number (80-year cap).
- Coast number = FI number / (1 + real return)^(years to the retirement age).
- Years from nothing (`yearsFromZero(rate, realReturn, withdrawalRate)`), shown for saving half and a tenth of income: save `rate` of income at each year's end, grow at the real return, until the pot reaches (1 - rate) / withdrawal rate; income drops out (the idea of Mr. Money Mustache's "The Shockingly Simple Math Behind Early Retirement", 2012, worked with the page's own assumptions; at 5% and 4%: 17 and 52 years).

## The answer that counts Social Security (round 5, 2026-11-02)
The guide sends "Could I stop work early?" here, and the 25-times rule alone answered it: it asks for a pot that pays all the
spending for good, so a couple whose Social Security will cover most of it read "not until 65" while Will the money last?
said stopping at 62 works and Goal seek said 61. The page now leads with the projection's own answer and folds the rule
under "The 25-times rule, a quick check".

`withIncome` (new; every other output is unchanged, so `tests/golden/retirement/fire.csv` passes as it was):
- `earliestAge` = `scenarios/goal-seek` `earliestRetireAge(plan, { today, legacy, personId })`: the first whole age, from this
  year's (stopping now) to the later of 75 and the planned age, at which that adult can stop work and the projection
  (`retirement/projection` `buildInputs` run through `core/math/retirement.js` `project`, expected returns every year) lasts
  to the end of the plan and leaves the legacy goal, everyone else stopping as planned. Goal seek's "When you can retire"
  lever calls the same function, so the two pages give one answer. It is the age **if markets do as well as average**: by
  construction the age before it fails, so it leaves little to spare (the family: 58, "It lasts, just" on Will the money
  last?, and in only about 4 of 10 market paths).
- `stopYear` = max(this year, birth year + age), the year the engine stops their work; `plannedStopYear` the same at the
  planned age; `yearsSooner` = `plannedStopYear` - `stopYear`. Ages are compared by stop year: 64 today and 65 in December
  both stop in 2026 ("This year, as planned").
- `atAgeReal` = the projection's total in today's dollars in the stop year: the same row Will the money last? shows as "At
  retirement" (stopping now: this year's row, not today's balance). `atRetirement(plan, today, personId, age)` works it out.
- `ssFrom` / `ssFullFrom`: the first and last claim years of the plan's Social Security incomes (birth year + start age);
  the page says "already being paid" when the first is before this year. `ssYearly` their sum a year in today's dollars;
  `ssShare` = `ssYearly` / retirement spending (at 100% or more the page says "more than the $X a year you plan to spend").
- `otherYearly`: pensions, rent and other income the engine counts after work stops (not anyone's pay, nor support counted
  only while its owner works; never dividends since the recheck of 2026-11-05); `otherKinds` which of those kinds it holds
  (the page names them in one order: pensions, rent, other income). `left`: income not counted after work stops
  (projection `otherLeft`). `ssPaidNow`, `strategy`: see the recheck below.
- null when there is no adult or date. Who it is about: the adult marked self while they still work, else the next adult
  who still works, by exact age today (`ageOn(birthDate, today) < retirement age`, as goal seek searches); with everyone
  stopped the page says whether the money lasts (`retired`, `lasts`, `failYear`).

**The 9-in-10 age** (`carefulAgeSteps` / `carefulAge`, asked for with `compute(plan, { careful: true })` and shown first):
the earliest whole age, from the average-market age up to the same last age, at which the money lasts to the end (leaving
the legacy goal) in at least 1,800 of 2,000 market paths: the paths and seed of Will the money last?'s careful figure
(`monte-carlo` `drawSequences(2000, years, { seed: 1 })`), spending the plan's amount the same every year (as that figure's
planned share, so a plan set to retire at this age shows at least 9 in 10 there). A path that lasts stopping at one age
lasts stopping later, so each later age reruns only the paths that fell short (the family: about 6,800 runs, 58 to 64).
`age` null when even the last age does not reach 9 in 10 (then `share` is what it reaches). The module is `heavy`: the page
is drawn first and asks the PC when connected, else works it out a slice at a time between frames
(`modules/retirement/careful.js`). The hero then reads "Ana could stop work at 64" / "Stopping at 64, the money lasts in 9
of 10 markets, with Bo stopping at 62 as planned. If markets do as well as average, 58 would do, with little to spare." One
sentence when both ages are the same; "Even working to 75, the money may run short" when 9 in 10 is not reached.

Why the rule and the projection differ: the rule counts everything left over each month as saved and invested (the family:
$104,134 a year in all, $85,264 of it left over beyond the $18,870 going into retirement accounts) and leaves out Social
Security, pensions and taxes; the projection adds only the retirement contributions and counts the rest year by year. So it can come out earlier or later than the rule (the
sample family: the rule says 51, the projection 58, chiefly because the rule invests all that is left over). Neither counts
the goals being saved for, nor health cover before Medicare (not in the projection yet: the fold no longer lists it). The
fold says so in one line, and names its figure "invested, not counting cash in the bank" (the hero's is "savings and investments together", at retirement).
`withIncome` costs up to about 40 projection runs, so the Timeline (which reads only the number) asks for `withIncome: false`.

Review fixes (2026-11-02): the search starts at this year's age ("could stop work now"), with no floor at 45, and runs to the
later of 75 and the planned age; it leaves the legacy goal Goal seek starts from (`estate/legacy` `legacyTarget`), so the two
pages give one age; "pensions and other income" leaves out a partner's pay; someone who said they get no Social Security is
not told to add it; the folded rule has no headline of its own and says why it differs; plain words for "withdrawal rate",
"real growth" and "coast". Second review (same day): exact age for who still works; stop years for "years before"; the
9-in-10 age first and the average one named; "at retirement" from the projection's own row; "more than" at 100% or more;
"already being paid"; "leaves" after "the money lasts"; rent and dividends counted after work stops (`retirement/projection`
`incomeOther`, see its README).

## Tests
`tests/retirement-pages.test.mjs`; `module.test.mjs`: the answer is goal seek's earliest age, it works and the age before
does not, Social Security sums and share, the money at the stop year is the projection's "At retirement", the 25-times
fields identical with and without it, null at or past the planned age; exact age (64 today, 65 in December: still working,
"This year, as planned"); the 9-in-10 age against the careful figure's planned share at that age and the age before, a slice
at a time, none by 75; rent, dividends and other income after work stops.

## Ideas / not yet
- Dividends and interest typed on the Income page from outside the plan's accounts (a trust, a private loan) are now left out
  with the rest (recheck 2026-11-05); type those as "other" with an end date to count them.
- Barista variant (part-time income), the full savings-rate-to-years table, a chart of the path.

## Independent answer-key audit

`tests/golden/retirement/fire.csv` supplies 1,800 invented cases across 18 rules,
each with 60 grid, 30 edge and 10 extreme rows. The full formula inventory, exact
CSV header, assumptions and sources are in
[`tests/golden/retirement/briefs/fire.md`](../../../tests/golden/retirement/briefs/fire.md).
The standalone generator `tools/golden_retirement/fire.py` never executes the app
to obtain expectations. Every tenth row has an independent second check, enforced
by the generator. Money is stored to cents and replayed with a 0.005 tolerance;
rates and progress have six decimal places.

The 4% historical context comes from [William Bengen (1994), “Determining Withdrawal
Rates Using Historical Data,” FPA reprint, pp.4–5](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf).
The calculator's division by a selected withdrawal rate is an arithmetic target,
not a promise of safe withdrawals. Default returns (stocks 7%, bonds 4%, inflation
3%), 70% stocks, retirement age 65 and the 80-year search cap are application
assumptions. Fixture balances are invented worked examples, not published data.

For clarity, the annual-saving formula is equivalently
`max(own contributions, max(0, annual income − annual expenses)) + employer`.
The exact real-return formula is `(1 + nominal)/(1 + inflation) − 1`.
The balance after `n` annual periods is
`P(1+r)^n + S((1+r)^n−1)/r`, or `P+nS` when `r=0`; these identities are derived
by summing each end-of-year deposit's future value. The oracle uses the closed
form and checks it against the expanded cash flows, rather than reproducing the
application's loop. The first crossing through year 80 supplies `yearsToFi`;
failure by then gives null, while an already sufficient pot gives zero.

Progress has an upper cap of one; the gap has a floor of zero. Savings rate is
null when annual income is nonpositive and otherwise capped at one. Age is the
age attained during the evaluation year, even before the birthday. Cash, property,
vehicles and 529 accounts do not count toward the invested pot; insurance cash
value is included in the deferred bucket. If the projection inputs are incomplete,
the page uses current recurring expenses as its spending fallback and zero
invested money. Each convention is covered by the answer key.

## Recheck 2026-11-05
- **Income after work stops** (`retirement/projection` README, same date): rent counts for life, support and other only to an
  end date they carry (child support to the child's 18), dividends and interest never. The small line under the answer names
  what is counted ("plus $42,000 a year of pensions and rent") and what is not, with how to keep it (`careful.js`
  `leftWords`); the retired lede names it too ("with Social Security, pensions and rent"). H-1396 (Grace, housing allowance and
  board with no end date): 9 in 10 at 66, as the recheck found with them left out; H-0826: average-market age 66 again.
- **Who still works** (`stillWorks`): an adult under their retirement age by exact age today with pay coming in (salary, bonus
  or business, active today; a line with no owner is the first adult's), a retirement contribution, or "work" answered in Get
  started. A plan with nothing on the Income page and no contribution goes by age alone, as before. The retired couple's Sam
  (69, retirement age 70, salary ended 2025-12-31, no contribution) has stopped, so the page says "The money lasts" instead of
  "Sam could stop work now". The first adult is the exception: see "Second pass" below. A partner under their retirement age
  with no pay is "not working" (a parent at home), and "already retired" only once past it or when they said "retired".
- **"Already being paid"** (`ssPaidNow`): Social Security typed on the Income page that has started is paid now (incomeSocial
  starts it this year, so "first year < this year" missed it and Ruth, paid for years, read "from 2026"); as is any claimed
  before this year. One whose own start date is still to come, even later this year, is not (`startsOn`).
- **One spending rule for both ages**: the average-market age (`earliestRetireAge`) now tests steady spending at the plan's
  amount, as the 9-in-10 age already did; under a set share of what is left, guardrails or years-left spending the family read
  "stopping now would do" at 36 and now reads 58 and 64, as with steady spending. When the plan uses another rule the small line
  says once: "Both ages spend the same every year; your plan uses another rule, a set share of what is left each year, so what
  you spend moves with markets (How much to take out)". `strategy` is the plan's rule.
Tests (`module.test.mjs`, "recheck 2026-11-05"): Sam with no pay is not asked about (with pay, or a contribution, he is), a
plan with no Income still goes by age; Income-page Social Security is paid now and one with a later start is not; the retired
couple's counted income is the pension and rent with the dividends left; help from parents is named, not counted.

### Second pass (verify of the above, same day)
- **The first adult with no pay line is not "stopped" while their planned age is ahead.** The household starts spending from
  savings in the year the first adult reaches their planned age (projection `buildInputs` `retireYear`); before it nothing is
  drawn. "No salary, bonus or business line today" read as "stopped" for that adult (laid off, between jobs, a new job from
  next month, gig pay typed as other income) gave two wrong answers worked out on a plan that still has them working:
  everyone stopped, so "The money lasts. You have stopped work ..." (Alex, 45, laid off with $840k and spending $5,000 a
  month: stopping now the money runs out in 2040; Goal seek on the same plan says 58; H-0494 read "runs out in 2057" against
  2027, H-0021 2063 against 2026), or a working partner asked about and told "could stop work now ... with Priya already
  retired" (with both stopped the money runs out in 2045). Now the first adult works while `I.retireYear > I.startYear`
  unless they said "retired" or "Not working now" in Get started; the "no pay means stopped" rule stays for the other adults,
  whose stopping moves no year. Alex is asked about again ("would need to work until 67" in 9 of 10 markets, average 58 =
  Goal seek 58), and so is the laid-off Priya.
- **Someone who stopped before the age on file stops now in what the page works out** (`stopNow`, `withStops`):
  - everyone stopped: `lasts` and `failYear` come from the plan with each of them stopping this year, not from the age on
    file (Pat, 60, said "retired" with 65 left on file: "runs short in 2052", as stopping now; it read "The money lasts");
  - the first adult said they stopped and a partner works: the partner's age, the money at their stop and the 9-in-10 age
    (`carefulAgeSteps` and `compute`'s careful search take `stopNow`) are worked out with the first adult stopping now. Pat
    (60, "retired", 65 on file) and Tom (58, working): "Tom could stop work now ... with Pat already retired" became 62 (the
    plan spent nothing from savings until Pat's 65).
- **"Not working"**: `others[].notWorking` (under their retirement age, no pay, not said "retired"); the page says "with Elena
  not working" for a parent at home (H-0401), never "already retired".
- What does not move: Will the money last?, Goal seek and Chance (this page's figures only); the retired couple and every
  08-retired Sam plan stay "The money lasts".
Tests (`module.test.mjs`, "second pass"): laid off at 45 is asked about and agrees with Goal seek, stopping now runs short;
the couple asks about the laid-off first adult; "retired" said with 65 on file uses spending from now; the retired couple is
unchanged; a partner with no pay is "not working", one who said "retired" is "already retired"; the first adult said
"retired" and the partner's age, and the 9-in-10 age, are searched with the first adult stopped (`stopNow`); Income-page
Social Security from next month is not "already being paid". Each failed on the first pass as shipped.

## Review 2026-11-06
- **Rent named by its unit is rent** (`retirement/projection` `ownAccountMoney`, see its README): a couple whose only other
  income is "Rent from condo 401B" ($1,800 a month) was told "Dee would need to work until 74" (average 66) with the rent
  dropped as "money out of your own accounts". Now `otherYearly` is $21,600 of rent, nothing is left out, and Dee could stop
  now at 63 (9 in 10 markets and average), as an independent year-by-year model gives.
- **Other income that stops says when** (`otherEnding`: `{ yearly, by, all }` or null): the part of `otherYearly` with an
  end age (an end date, or child support at the child's 18th), the last year any of it is paid (`birthYear + endAge` of its
  owner, the engine counts that year), and whether all of it stops. The page says "plus $14,400 a year of other income until
  2034", or with a pension for life too "plus $26,400 a year of pensions and other income ($14,400 of it only until 2034)".
  It said "plus $14,400 a year of other income" for child support that ends in 2034, while the 9-in-10 age shown is 71.
- **The first adult counted as stopped now, with a later age on file** (`plannedStop`: `{ personId, name, age, plannedAge,
  plannedYear }` or null; set when `stopNow` holds the first adult and the plan's own retirement year is after this year):
  the page says "This counts Pat as stopped from this year. Your plan still has Pat stopping work at 65, so Will the money
  last? starts spending savings only in 2031. If Pat has stopped, set Pat's retirement age to 60 on the People page." Pat
  (60, said "retired", 65 on file) read "The money runs short in 2052 ... Will the money last? shows what would fix it" here
  and "It lasts, just" there, with nothing to say why; the pointer to Will the money last? is dropped in that case.
- Not changed, said here: a partner who works on after the first adult stops brings in their pay before tax (the engine's
  `<name>'s pay` line, with their contributions still added), so for a one-earner household whose first adult is at home the
  age leans a year or two early (Elena at home, Marcus earning $90,000, spending $6,000 a month: 69, where his pay after
  tax gives 70).
Tests (`module.test.mjs`, "review 2026-11-06"): the condo 401B couple (lasts, carries $94,147, $845,656 left; rent $21,600
counted; Dee 63 now, 9 in 10 too); child support to Ben's 18th is `{ 14400, 2034, all }` and with a pension for life not
all, the retired couple's rent and pension `null`; `plannedStop` for Sam (retired branch) and Pat (Tom asked about), null when
the age on file matches, for the sample couple and the retired couple. Each failed before this change.
- **Said "Not working now", not "retired"** (verify of the fix round, same day; `plannedStop.notWorking: true`): a parent at
  home entered first (Elena, 35, "Not working now" in Get started, which keeps 65 on file; Marcus works) read "This counts
  Elena as stopped from this year ... If Elena has stopped, set Elena's retirement age to 35 on the People page", next to "with
  Elena not working". It now reads "This counts Elena as not working from this year on. Your plan still has Elena working
  until 65, so Will the money last? starts spending savings only in 2056. If Elena does not go back to work, set Elena's
  retirement age to 35 on the People page." Someone who said "retired" reads as before. Test (`module.test.mjs`, "review
  2026-11-06 (verify)"): Elena's `plannedStop` is `{ e, Elena, 35, 65, 2056, notWorking: true }`, and has no `notWorking` once
  she says "retired". It failed before this change.
