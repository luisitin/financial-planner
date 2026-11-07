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
- **A parent at home under 55** (verify of the seventh pass, 2026-11-06; my choice): Will the money last? counts the
  household at work until the earning partner stops (projection README, "Not working now before 55"), so Elena (35, at home)
  with Marcus earning to 65 has `plannedStop` `{ e, Elena, 35, 65, 2054, notWorking: true, by: { Marcus, 65 } }` again. The
  words no longer end "set Elena's retirement age to 35": that would count the household as retired now, at 35. They read
  "This counts Elena as not working now. Will the money last? counts the household as living on Marcus's pay until Marcus
  stops work at 65, so it starts spending savings only in 2054. Who works, and until what age, is on the People page." At 55
  or over the old words stay. Tests: the two "review 2026-11-06" Elena tests.

## Health cover (review 2026-11-02)
The spending figure is `spending.yearly + health.removedMonthly x 12`: Will the money last? takes a health premium out of today's
expenses (its health line pays cover from retirement on, marketplace then Medicare), and this page has no health line, so
the premium goes back in and the FI number is still 25 x all of today's spending (with "Health insurance" $600 a month on
the family's Expenses: $77,116 and $1,927,900, as before the health line; the patch alone gave $69,916 and $1,747,900).

## Fifth pass (review 2026-11-02)
- The fold says again that the rule of thumb leaves out health cover before Medicare, which the answer above counts (the
  projection's health line): "It counts everything left over each month as saved and leaves out Social Security, pensions, taxes
  and health cover before Medicare, which the answer above counts, ..." (`ruleWords`; `healthAdded` on compute's result). With
  "My spending figure already includes health cover" ticked the words are as before.
- Who the answer is about: never an adult Get started says is retired or not working now (they no longer hold the household at
  work; the projection's retirement starts when the last working adult stops). Ana "not working now" with Bo working: the
  answer is about Bo.
- Other income is told from a partner's pay by kind (`kind: "pay"`), never by its name: a rental called "Lee's pay" counts as
  rent.

## Review 2026-11-06 (sixth pass: one work rule with the health line and Goal seek)
- **Who still works** is the projection's one work rule (`workRule` through `workingNow`), the health line's and Goal seek's,
  with this page's exact-age test kept. The recheck's rule above holds with three changes, each where the two rules disagreed
  (projection README, "Review 2026-11-06 (health cover, sixth pass)"): a contribution counts when it goes to a plan at work
  (a 401(k), or one with a match) or nobody else has pay (a spousal IRA does not make Lee work while Sam does); "retired" or
  "Not working now" in Get started wins over pay and saving; and with nothing on Income or Contributions only the first adult
  is presumed at work, no longer everyone under their age.
- **Defect 2 of the health line's fifth-pass verify:** the 68/63 couple with Bo's retirement age 66, no pay and Ana "retired"
  read "Even working to 75, the money runs short ... and Bo works until 75", though Bo's age moves nothing in the plan, while
  Will the money last? starts now, Healthcare prices Bo's marketplace in 2026-2027 and Goal seek has no retirement lever. Now
  "The money runs short in 2030" (the retired answer, as Will the money last?). Lee with rent, her salary taken out and her
  IRA saving kept: "Lee not working" (was "Lee stopping at 67 as planned"), as the health line prices her own cover.
- **Goal seek asks about the same adult on the same plan** (`workingNow`'s `lead` and `stopNow`): the first adult while they
  work, else the first other who does, searched with the first adult stopping now when they stopped before the age on file.
  `stopNow` only when that partner has pay on Income: one who works by an answer or saving alone has no pay the plan can count
  with the first adult stopped, so their age is searched on the plan as it is, where it moves the household's retirement year
  (the family with nothing on Income, Ana "Not working now", Bo saving into his Roth: "Bo at 63" here and on Goal seek, where
  it read "Not by 75", a search over his saving only).
- **The year Will the money last? starts spending, by whose stop it is** (`plannedStop.by`, `plannedStopWords`): with the
  first adult said stopped and a partner stopping before the first adult's own year, the projection lives on the partner's pay
  until then (its household retirement year). Elena "Not working now", Marcus to 65: "This counts Elena as not working from
  this year on. Will the money last? counts the household as living on Marcus's pay until Marcus stops work at 65, so it starts
  spending savings only in 2054. If Elena does not go back to work, set Elena's retirement age to 35 on the People page." (was
  "Your plan still has Elena working until 65 ... only in 2056"). Sam (60, "retired", nobody working): no such words any more,
  as Will the money last? now starts this year too.
- The 9-in-10 age is searched with steady spending in the plan as well (`carefulAgeSteps`), so the health line is priced on the
  same withdrawals as each age (as Goal seek's `earliestRetireAge`).
- The condo 401B couple: with health cover in the spending figure (the box ticked) $94,147 and $845,656 as before; with the
  health line (Medicare for both, $180,579) it lasts and carries $88,504, $558,091 left; Dee still 63, now.
Tests (`module.test.mjs`, "review 2026-11-06"): defect 2 with and without the answer, Lee "not working"; one adult and one age
with Goal seek (Pat and Tom, Sam past his age); a partner with saving alone; `plannedStop.by` and its words. Each failed
without its fix.

## Review 2026-11-06 (seventh pass, fire-ver8b)
- **Other income in steps.** `otherEnding.steps: [{ until, yearly }]`, each last year a part is paid and how much of it stops
  after that year; `otherEndWords` says them: all of it stopping, "$32,400 a year of other income until 2030, then $14,400 until
  2034" (it read "until 2034" for all of it); part of it, "($18,000 of it only until 2030 and $14,400 only until 2034)".
- **Stopping this year.** An adult the plan has at work (pay, an answer) who reaches their planned age this year is
  `stoppingNow`, said "Ray stopping this year, as planned" (it read "already retired").
- **The business-draw rule** (projection `ownAccountMoney`): a name is left out of the household's own accounts only when a
  business is the source; "Draws from company stock account" is the household's own.
- With everyone stopped, an adult whose job starts later (a pay line from next year) keeps their age on file (the plan counts
  that pay).
- What moved with the projection: Medicare now holds the Medigap Plan G default and a spouse's Medicare while the other works
  (projection README, seventh pass), and the household starts spending this year when the first adult has stopped and a partner
  is on pay. The family's "hard" plan: 74 -> 75; the condo couple: carries $88,504 -> $84,000, lasts in 9 of 10 markets from 65
  (63); the family with Bo saving: 63 -> 64; Tom's and Elena's "starts spending only in ..." notes are gone (their pay is income
  from this year). Rae: Jo could stop at 66 -> 71 (66 with no supplement).
- Tests: "seventh pass (fire-ver8b): other income that stops in steps ..." and the condo couple's Ray `stoppingNow`; both failed
  on the base.

## Round 8 batch 6 verify (2026-11-06): a rental's loan payment back is not rent
Will the money last? counts a rental on Rental analysis as its rent after running costs (projection `rentalLines`, part
"rent") and, when the retirement spending holds the rental's loan payment, gives that payment back from the year after the
loan is paid off (part "loan back": spending no longer needed, untaxed). `otherYearly` leaves "loan back" out: it is not
income of any kind. The landlord household (`qa/fixtures/round8-rental.mjs`): 25,200 of rent less 1,260 of empty months and
12,700 of running costs = **$11,240 a year of rent**, whether its loan is on Debts or typed on Rental analysis; with the
loan on Debts the page said "$21,452 a year of rent" (11,240 + the $10,212 loan payment that comes back only from 2051).
Formula source: property/rental README ("Income after running costs"). Test: "round 8 batch 6 verify: a rental's loan
payment ... is not rent".

## Follow-up 2026-11-07: one plain way of saying the odds
The owner's standing words: "It should feel easy for a layman ... not ... concepts / words too hard to understand." Every page that says how often
the money lasts now uses `modules/retirement/odds.js` (`chanceWords`, re-exported by `careful.js`; `BAD_RUN` = "even in a bad run of years",
`BAD_RUN_NOTE` = "(only 1 in 10 is worse)"). A "pretend future" is one made-up run of good and bad years; the share of pretend futures in which the money lasts is the
chance. The words, after "the money lasts": 100% "in every pretend future we ran"; 90% or more "even in a bad run of years"; 45% to under 60% "about half
the time"; under 10% "in fewer than 1 of 10 pretend futures"; else "in about N of 10 pretend futures" (N rounded down, never 9 under 90%); with the number
"(93 of 100)" after "of 10 pretend futures", else "(93 of 100 pretend futures last)", where it helps. No page says "markets" for a try ("9 of 10 markets", "every market tried", "simulated markets",
"100 markets" are gone; "if markets do as well as average" stays: it means average returns, not a try). The amber pill "fewer than 9 in 10" is
"short in a bad run". Decision (no owner to ask), changed after the UX review of 2026-11-07 (it found "tries" unexplained where it first appears): "pretend futures", which explains itself, over "tries" or "runs".
Financial independence says "the money lasts even in a bad run of years" and, when no age reaches it, "the money lasts in about 3 of 10 pretend futures (38 of 100), which does not cover a bad run of years."
