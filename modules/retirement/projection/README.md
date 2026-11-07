# Will the money last?  (`retirement/projection`)

**Status:** usable (phase 5)
**Purpose:** Your plan run year by year to the end: what you have, add, receive and spend, and whether the money lasts.

## Inputs
Plan sections read (`needs`): `household` (adults with birth dates; retirement and plan-end ages), `accounts` (balances by tax bucket), `expenses` (fallback spending), `income` (a partner's pay after the household retires; pensions), `retirement` (settings, contributions, Social Security, pensions), `assumptions` (inflation, returns, salary growth). Writes: `retirement` settings (spending, stock shares, tax rate, strategy, withdrawal rate).
`buildInputs(plan, { today })` is the one place the plan becomes engine inputs; every other retirement page calls it.

## Outputs
`ready`, `missing[]`, `notes[]`, `inputs`, `result` (the engine run), `rows[]`, `atRetirement`, `atEnd`, `affordable` (real yearly spending that still succeeds, by bisection), `spendingYearly`, `coverage` (all the income that comes in / spending, in the first retirement year), `coverageFrom` (what that income is: "Social Security", "pensions", "a partner's pay", "rent", "other income"), `otherLeft` (income not counted after work stops, see Recheck 2026-11-05), `verdict` (on track / tight / short), `shortYear`, `shortAge`.

## The engine (`core/math/retirement.js`)
Yearly, in nominal dollars with a price level for the real view. Buckets: cash (checking, savings, cash; earns the cash rate), taxable (brokerage, crypto), deferred (401(k), IRA, insurance cash value), free (Roth, HSA). Property, vehicles and 529s are left out.
- Working years: contributions grow with `salaryGrowth` until each person's retirement age. No withdrawals (pay covers life).
- From the household's retirement year (the primary person's retirement age): spending by the chosen strategy; income (Social Security from the claiming age, pensions, a partner's pay until they retire, rent, and support or other income to its end date) offsets it; the gap comes from cash, then taxable, then deferred (grossed up by the tax rate), then free. Required minimum distributions (core/math/rmd.js) force deferred money out from the start age; what is not needed moves to taxable.
- Returns: a stock/bond blend gliding from `stocksNow` to `stocksRetired` by the retirement year; a `sequence` option replaces the expected returns year by year (Monte Carlo, history).
- Success = the buckets cover the gap every year to the last adult's plan-end age. `affordableSpending` finds the largest fixed-real spending that succeeds: the ceiling doubles until it fails, then bisection narrows it to a millionth of a dollar, rounded to the dollar.
- Required withdrawals: each adult's share of the pre-tax bucket (their own 401(k)s and IRAs; life-insurance cash value is no one's) is kept as its own slice and withdrawn at that person's age and start age (`rmd.owners`); rows carry `rmdBy` per person.
- Strategies: fixed-real (inflation-adjusted constant), percent of portfolio, guardrails (Guyton-Klinger simplified: cut 10% above 1.2x the rate, raise 10% below 0.8x, no inflation raise after a losing year), VPW (the payment over the years left at the real return, taken at the start of the year: the annuity-due amount, so the money lasts exactly to the end).
Modelled on the Bogleheads Retiree Portfolio Model and cFIREsim's spending modules (vendored); simplified taxes (one effective rate on deferred withdrawals) until the Phase 6 tax pages.

## Pensions from the Income page
`incomePensions()` turns every Income item of type "pension" into a retirement income, so a pension typed where the app first asks for it counts here (F-028). One already being paid (no start date, or a past one) counts from now, the way the Income page counts it; a future one from the age its owner reaches in the start-date year; an end date stops it after that year. A rise typed on the item (growth above 0) means it keeps up with inflation; none means a fixed amount. Left out: one-off payments (a lump sum is not an income), ended items, and items that repeat a `retirement.pensions` entry for the same person with the same name or the same monthly amount within a dollar.

## Getting to what you can change (2026-11-01)
"(Contributions page)", "(Social Security page)", "(Assumptions page)" and "(Taxes pages)" are links to those pages, and the
hero has an outlined "What would change it ›" to Goal seek, which works out the most you could spend, the earliest age to
stop and what more to save. Before, the page gave a verdict with nothing to tap but a settings fold at the bottom.

## No Social Security in the plan (2026-11-01)
When an adult has no Social Security figure and has not said they get none (`overview/setup` `ssMissingFor`, the same check as the
Dashboard's "Retirement: Needs Social Security"), the page opens with a notice from `modules/retirement/ss-notice.js`: "Social
Security is not counted yet, so this page looks worse than it is", a filled "Add Social Security" and an outlined "We won't get
Social Security", which saves the setup's own `guide.setup.ss[personId] = "none"` so it is never asked again, and confirms in
green on the next render ("Saved: no Social Security for Sam and Lee. Change it on the Social Security page."). When one figure
of two adults is missing, the notice and button name that person ("Bo won't get Social Security"), so "I won't" never marks the
other. A figure typed later wins over the "none" (Set up my plan's ages screen shows and keeps it). Before, only a grey sentence
at the end of a paragraph said why the plan looked short.

## One answer to "are we saving enough?" (2026-11-02)
`retirementKnown(plan)`: every adult has a birth date and Social Security (a figure or a record) or said in Get started
that they get none; until then no page calls retirement short or on track (moved here from overview/setup, which
re-exports it, so every page uses one rule). `savingVerdict(plan, { today })` -> `{ verdict, shortAge, affordable,
spendingYearly }` or null: this page's verdict for other pages. The round-3 walk-through found four answers for one
household: Retirement contributions said nothing, How am I doing? two amber "behind" rows, this page "On track", Next
best action "max out the IRA and the 401(k)". Now Retirement contributions says the share of pay and this verdict, How am
I doing? reads its two rules of thumb against it, and Next best action marks the IRA and 401(k) steps optional when the
plan already lasts.

## Retired households (2026-11-02, experience round 4)
- `incomeSocial(plan, people, ssPeople, today)`: Social Security already paid and typed on the Income page (type
  "social", recurring, not ended) counts as Social Security, from now (or its start date), rising with inflation, for an
  adult with no figure or record on the Social Security page (a figure there wins: nothing counts twice). A note names it.
  `ssOnIncome(plan, id, today)` makes `retirementKnown` (and the setup's `ssKnown`, the health score, the retirement guide)
  count it, so a retiree who typed it there is not told "Social Security is not counted yet" and the Dashboard stops
  asking for it.
- `householdRetired(plan, { today })`: every adult said "retired" in the setup, or is past their retirement age with no
  salary, bonus or business income. `drawingAsPlanned(plan, { today })` -> `{ verdict, spendingMonthly, affordableMonthly }`
  when such a household's plan lasts (on track or tight): drawing from savings each month is the plan working. Next best
  action, Needs attention, Expenses and the health score read it instead of "spend less than comes in".

## Edge cases
No adult with a birth date, no accounts, or no spending figure: the page lists what is missing and still shows the settings. Already retired: retirement year = this year. A partner retiring after the primary: their pay counts as income until then.

## Tests
`module.test.mjs` (inputs from the fixture couple, the run, fallbacks) and `tests/retirement.test.mjs` (the engine: buckets in order, gross-up, RMD, sequences, strategies, affordable spending); events marked spending paid by income first). Health line (2026-11-02): the couple at 62 year by year against Healthcare before 65 and Medicare, the job's years left out whoever is listed first (and the Medicare page's lifetime = added + `onJob`), a removed premium back while a partner works ($77,116 a year), the box (and `showHealth` saying what it would cost), a Medicare line for a parent (all Medicare stays; an added expense never raises what the plan carries) and for the older of a couple (the younger's share only), Get started's "Insurance and health" row (kept; pays a retired couple's Medicare) and its own spending figure (`retireAuto`: the premium comes out), which lines are health cover, no recursion whichever page loads first, and the verdict moving the right way.

## Review fixes 2026-11-02
- `householdRetired`: a retirement age left blank is the plan's own (Assumptions, 65 by default), as the projection uses it, so a retired couple added on People with the age blank counts as retired.
- Social Security already paid before the claim age on file (the Social Security page's `startedEarly`) counts from today's age.

## Ideas / not yet
- Real tax brackets instead of one rate (Phase 6); Roth conversions; a survivor scenario (one Social Security stops); one-off events (sell the house, an inheritance).

## Independent answer key

`tests/golden/retirement/projection.csv` contains 2,100 invented cases across 21 rules;
`tests/golden-retirement.test.mjs` replays them. The source inventory, exact layout and
rounding policy are in `tests/golden/retirement/briefs/projection.md`. Independent Python
oracles use geometric sums, discounted annuities and cash conservation; every tenth case
has another derivation, and a separate lead audit samples every rule. No expected value
comes from running this module. Money is compared within0.005; rates to six-place precision.

The documented model assumptions above supply timing, bucket, glide and strategy rules.
IRS Publication590-B TableIII supplies the tested RMD factor24.6 at75:
https://www.irs.gov/publications/p590b . Whole-dime typed Social Security amounts claimed
at full retirement age67 isolate the annualization adapter; the SSA benefit formula remains
in its own test scope. Since 2026-10-30 (F-030) every case agrees: the affordable-spending search's ceiling grows until it fails and narrows below a cent.

## Average markets, said so (round 5, 2026-11-02)
The verdict and "carries $X a year" are markets earning exactly the average every year, and now say so ("On track if markets
do as well as average"; short: "If markets do as well as average, $168,000 a year runs out in 2050 (age 82), and the most
the plan carries is about $131,224 a year"). Under them the careful line (Monte Carlo's `careful`, see its README): "In 9 of
10 markets the money carries about $90,200 a year ($7,500 a month). At the $84,000 you plan, it lasts in 98% of them", and
the stat reads "Spending that lasts in 9 of 10 markets" with the average figure under it. The rule for on track / tight /
short is unchanged. Review fixes, 2026-11-02:
- **Another withdrawal rule:** the share quoted is `careful.planned` (steady spending at the plan's amount, on the same
  2,000 paths), never the rule's own chance. When the plan's rule is not steady spending, the second sentence names it in
  plain words instead ("Your plan uses another rule, a set share of what is left each year, so what you spend moves with
  markets"), linking How much to take out.
- **"It lasts, just":** the headline when the verdict is on track but the careful figure is below the planned spending (the
  plan lasts in fewer than 9 of 10 markets). View only: the verdict keys are unchanged.
- **The month:** whole $100s rounded down (`careful.js` `monthlyOf`), so $110,100 a year is $9,100 a month, never more than
  the year.
- **$0:** no careful line; the stat goes back to "Spending it can carry", named "if markets do as well as average".
- **No jump, no freeze:** the line is drawn first with grey bars where its figures go (the same words, so the same height) and
  filled after the first paint, on the PC when connected or here a slice at a time (`careful.js`).

## Rent, dividends and other income after work stops (round 5 review, 2026-11-02)
`incomeOther(plan, people, retireYear, today)`: rent, dividends and interest, support and other income typed on the Income page
(types `rental`, `investment`, `support`, `other`; anyone's, or the household's, which belongs to the first adult) are engine
incomes that do not stop when work does. Each counts from the household's first retirement year (or its own later start
date) to its end date, rising with inflation when the item has a raise, taxed unless marked untaxed; one-offs and ended
items are left out. Before, a partner's came in only inside "<name>'s pay" and stopped when they stopped work, and the first
adult's and the household's never counted (the retired couple's $24,000 of rent stopped in 2026 and its $4,800 of dividends
never counted: what the plan carries went from $62,191 to $88,824 a year). "<name>'s pay" is now salary, bonus and business
only (`PAY_TYPES`). They start at retirement because before it the plan's saving is what goes into the accounts (income in
those years changes nothing but, in the brackets setting, a tax taken from savings: see monte-carlo's README, "Zero").
No frozen answer key has rent or dividends (`tests/golden` plans hold salaries only), so every key passes as it was.
Superseded by the recheck below: dividends were counted twice, and support and other income for the rest of the plan.

## One verdict word (review 2026-11-05)
The headline stays the average-market verdict ("The money lasts" / "It lasts, just" / "Runs out in ...") that the Dashboard,
Quick answers, Timeline and Goal seek also show; it no longer changes to "It lasts, just" after the careful figure arrives
(that fired for withdrawal rules that never run out, and made this page disagree with every other one). When the planned
spending lasts in fewer than 9 of 10 markets, the careful line says so with an amber "fewer than 9 in 10" pill, its share
rounded down (89.8% never reads "90%"). With nothing lasting even at $0 there is no careful search and no placeholder; the
average figure is named as such from the start. When the PC does not answer, the search runs here in slices (careful.js),
never in one block; a screen reader hears "Working out ..." while the grey bars stand in for the figures.

## Recheck 2026-11-05
- **Social Security already paid counts what Income says, for life.** The Social Security page's figure for someone paid
  by a Social Security line on Income is that line at every date (retirement/social-security, "Recheck 2026-11-05"); it
  used to switch to the claim age's figure once that age passed (Ruth: $2,100 a month for life against the $1,950 Income
  says). Each person's own line starts at the page's `fromAge` (today's age for a benefit started before the claim age on
  file, else the claim age), the same rule as before, now read from the page.
- **A spouse's top-up is counted** (it never was): one more `kind: "social"` income per person with a counted top-up
  (`couple.spousalCounted` on the Social Security page), named "<name>'s spouse's benefit", yearly = 12 x the top-up, from
  `couple.spousalFromAge` (the later of the two people's own start years, never before 62: never before the worker has
  claimed), rising with inflation, taxed like the rest of Social Security. It comes after each person's own line, so the
  stress tests' "a person's first Social Security line" is still their own. Not counted when the person has no figure of
  their own, or when their Income line already holds it. Formula and sources (SSA Handbook 724, 725, 734;
  https://www.ssa.gov/oact/quickcalc/spouse.html) in the Social Security README. `ssYearly` (the page's `householdYearly`)
  includes it, as the projection's social incomes do.
- No answer key changed: no row of tests/golden/retirement/*.csv has a couple with a Social Security figure (checked: the
  700 projection rows, 1,800 FIRE rows and every other page's plan rows), and the 12,710 golden retirement tests pass.

### Income that is not pay, after work stops
Round 5's `incomeOther` counted every "support", "other" and "dividends and interest" line for the rest of the plan when it
had no end date: help from parents to 95 (H-0826 went from short to "It lasts, just"), child support 30 years after the
children were grown (H-0201), a housing allowance after service (H-1396: $762,051 left became $1,605,770), "IRA withdrawals"
on top of the IRA (H-0796) and dividends on top of the brokerage that pays them. `otherIncome(plan, people, retireYear,
today) -> { counted, left }` (`incomeOther` is now `.counted`) counts, from the household's first retirement year (or the
item's later start date):
- **Rent** (`rental`): for life, or to its end date. Rent for a place on Rental analysis is no longer counted here: since
  round 8 batch 6 it is `rentalLines`' (after its running costs, below), matched to the Income line as the Federal estimate
  matches it (property/rental `running.js` `matchRent`). Only the rest of a line, rent for a place not on that page, is
  counted here, gross ("(before its costs)").
- **Support and other**: up to an end date they carry. Without one they stop when their owner stops work, as before round 5
  (a partner who works on after the household retires keeps it until then, as inside "<name>'s pay"; the first adult's and
  the household's never count after retirement), and are listed in `left` with `why: "work"`. The line counted while the
  owner works carries `whileWorking: true`, so Financial independence does not call it income after work.
- **Child support** (a support or other line whose name has "child", "children" or "kid") with no end date ends in the year
  the child it names turns 18 ("Child support for Zoe": Zoe), else the youngest dependent with a birth date (most US states
  end support at 18; `CHILD_SUPPORT_UNTIL`). With no dependent it is like any other support.
- **Dividends and interest** (`investment`): never; the accounts' growth (the plan's return on the taxable bucket) already
  holds them, and in the brackets setting the engine already taxes `taxable x dividendYield` for them. Listed in `left`
  with `why: "growth"`.
- An unknown type is "other", as on the Income page; an item that ends before retirement is left out.
`buildInputs` returns `otherLeft` (the `left` list); engine incomes carry `type` (`"pension"`, `"pay"`, or the Income type).

On the page: the hero's small line says what is not counted and how to keep it ("$4,800 a year of other income is not counted
after work stops: Monthly help from parents. Give it an end date on the Income page if it carries on." / "Dividends and
interest, $4,800 a year, are not added: your accounts' growth already includes them."; `careful.js` `leftWords`, shared with
Financial independence). "What goes into this" names every income counted with its ages ("Rental duplex: $24,000 a year
from 69 (before its costs)") and a "Not counted" row. The stat "Guaranteed income ... Social Security, pensions, a partner's
pay" is now "Paid by income", `coverage` = all income in the first retirement year / that year's spending, "from" the kinds
active that year (`coverageFrom`, `incomeIn` mirrors the engine's age and year test): the retired couple of the seed
(qa/flows/seed-retired-couple.js) and H-0796 read "190% ... from Social Security, pensions and rent"; the Node fixture
`qa/fixtures/retired-couple-plan.mjs` leaves out the seed's Gifts and credit card minimum, so it spends $33,360 a year (the
seed $35,460) and reads 201%.

Figures (today 2026-11-02): H-0826 short in 2059, carries $59,612 (round 5: tight, $62,605); H-0796 and the retired couple
carry $85,416 (rent alone; round 5: $109,974 and $88,824); H-0201 $4,189 ($7,915); H-1396 $56,333 and $762,051 left. All 1,400
qa/households plans against the rule before round 5: 1,111 the same, 206 with figures moved, every one from rent counted for
life (12-high-net-worth, 08-retired: the seven 08-retired verdict changes round 5 made all hold), child support ending at 18
instead of with a partner's pay (06-blended-family), and child support or unemployment counted to its end for a household
retiring this year. Tests: `module.test.mjs` "recheck 2026-11-05" (H-0826, H-0796, H-0201 and H-0501 from qa/households, the
retired couple in `qa/fixtures/retired-couple-plan.mjs`, a partner's support).

### Second pass (verify of the above, same day)
- **Withdrawals from the household's own accounts are never added** (`ownAccountMoney(name)`): a support or other line whose
  name says it is money out of the plan's own accounts (IRA, RMD, TSP, HSA in capitals; 401(k), 403(b), 457, Roth, "required
  minimum"; withdrawals or draws from savings, a brokerage, a portfolio, investments or accounts; not a trust's or an
  annuity's payout, not "Help from Ira") is listed in `left` with `why: "accounts"` and never counted, end date or not. The
  plan already draws on those accounts; following "give it an end date if it carries on" for H-0796's "IRA withdrawals"
  (to 2055) took it from $85,416 a year to $106,606, the IRA counted twice. The words say instead: "IRA withdrawals,
  $30,000 a year, is not added: it comes out of your own accounts, which the plan already draws on. If an account is
  missing, add it on Net worth." (`careful.js` `leftWords`); the "Not counted" row says "taken from your own accounts, which
  the plan already draws on" (`leftWhy`, shared by the three reasons).
- **Dividends and interest from outside the accounts**: the sentence adds "If some of it comes from outside your accounts (a
  loan you made, a trust), type that part as other income with an end date on the Income page." (interest on a note from
  selling a shop is in no account; typed as other with its end date it counts to that date).
- **Only child support is child support**: a name with "support" and "child", "children", "kid(s)" or a dependent's first
  name ("Support for Leo"), or a support line with one of those words. "Children's book royalties" typed as other was
  counted to a grandchild's 18th (+$2,817 a year carried for the retired couple); it now stops with work, as other income
  with no end date. Every child-support line in qa/households ("Child support received", "Child support for Zoe") is a
  support line named "Child support ...", so none moves.
- `incomeSocial` items carry `startsOn` (the Income line's own start date, only when it is after today): the line still
  starts this calendar year in the plan, and Financial independence no longer calls it "already being paid".
- What moved (all 1,408 plans of qa/households and qa/fixtures, today 2026-11-05, against the first pass): no projection
  figure, income line, Goal seek lever or Chance; H-0796's `left` reason only ("work" to "accounts").
Tests (`module.test.mjs`, "second pass"): H-0796 with an end date on its IRA withdrawals is the same as without them, with
the names `ownAccountMoney` takes and leaves; royalties are not child support, "Support for Leo" ends at Leo's 18th; the
words for own-account money, for dividends from outside, and the "Not counted" reasons. Each failed on the first pass.

## Review 2026-11-06
- **Rent is never "money out of your own accounts"**: the `ownAccountMoney` name check now applies to support and other
  lines only. It read rent named by its address or unit as a retirement account ("457 Elm St duplex" as a 457 plan, "Rent
  from condo 401B" as a 401 plan), dropped it and said "it comes out of your own accounts, which the plan already draws on".
  The retired couple with its rent called "457 Elm St duplex" carried $61,416 a year instead of $85,416 ("Paid by income"
  129%, its $43,200 of Social Security and pension over $33,360, instead of 201%). A couple whose only other income is
  "Rent from condo 401B" ($1,800 a month) read "Runs out in 2049" where the plan lasts (it carries $94,147 against the
  $78,000 it spends), and Financial independence asked the first adult to work to 74 where 63 lasts in 9 of 10 markets
  (both checked against an independent year-by-year model).
- **The plan names only, not look-alikes**: 401(k), 403(b) and 457(b) are matched as the plans ("401k", "401(k)", "403b",
  "457(b)", "457 plan"), not any 401, 403 or 457 followed by a letter; "Roth" only next to an account or a withdrawal word
  ("Roth IRA withdrawals", "Roth distributions", "Draws from my Roth account"), so "Help from Grandma Roth" is support like
  any other, counted to its end date.
- Moved: nothing in qa/households or qa/fixtures (no income line there has such a name; all 1,408 plans give the same
  projection, Goal seek, Chance and Financial independence answers as the second pass).
Test (`module.test.mjs`, "review 2026-11-06"): the retired couple's figures are the same whatever its rent is called
("457 Elm St duplex", "Rent from condo 401B", "Unit 403 B rent", "Rent from the Roth house"), help from Grandma Roth to 2030
counts 2026 to 2030, and the names the check takes and leaves. It failed on the second pass (carries $61,416, not $85,416).
- **A draw from a business or against pay is not one** (same day, a follow-up): a name with "business", "company", "firm",
  "LLC", "partnership", "owner's", "commission" or "bonus" is not read as a withdrawal from savings or an account ("Owner's
  draw from business account", "Account manager bonus draws"), unless it names an IRA, a 401(k), 403(b), 457(b), TSP, HSA,
  RMD or a Roth account. Typed as other income with an end date it now counts to that date. Nothing in qa/ has such a name.
- Not changed: a pension typed on the Income page is never checked by name ("IRA distributions" typed as a pension still
  counts on top of the IRA). The type is the household's own choice, and a name check there could drop a real pension
  ("FERS pension and TSP"), the kind of mistake this review fixed for rent.
Test (`module.test.mjs`, "review 2026-11-06: a draw from a business"): the names it takes and leaves; "Owner's draw from
business account" to 2029 counts 2026 to 2029 and nothing is left out as "accounts". It failed before the change.

## Health cover on top of spending (2026-11-02)
Before, the engine had no health line: retirement spending was a typed figure or today's expenses (which leave out cover
paid from pay through work), and the Social Security page asks for the benefit before Medicare is taken out, so Part B was
never paid by anyone. For the family couple stopping at 62 that left out about $39,700 of marketplace cover to 65 (after
$29,700 of credits) and about $180,000 of Medicare, all in today's dollars.
- `buildInputs(plan, { today, health = true })` appends one engine event a year in which cover is priced (from the
  household's retirement year, or earlier for someone who has stopped while nobody works: fourth pass below),
  `{ year, amount, label: "Health cover", kind: "health", spending: true }`, in today's dollars (the engine multiplies by the
  year's price level): the marketplace cost after any credit (`retirement/healthcare` `years[].cost`: a year in which nobody
  still works and someone who has stopped is under 65) plus Medicare (`retirement/medicare` `years[].totalYearly`: Part B, the drug
  plan, any supplement and the income surcharge for everyone 65 or over). Appended to the events the inputs carry, never
  replacing them; every what-if and market path built on the inputs reuses them.
- The engine (`core/math/retirement.js`): an event with `spending: true` counts with the year's spending, so guaranteed
  income pays it first and only the rest comes out of savings: need = max(0, spending + marked events - income) + other
  events. Without the flag a household whose pension and Social Security cover everything would have paid its Medicare from
  savings. Rows carry `eventSpending` (that part of `eventOut`).
- One rule for every person and year, whoever is listed first (review fix 2026-11-02; it was "from the household's
  retirement year", which made the answer depend on who is "self"): while anyone in the household still works, a plan
  through that job covers the household, as Healthcare before 65 leaves those years to the job's plan (`onWorkPlan`), so no
  marketplace and no Medicare is added that year, the working person's own Medicare included. `health.onJob` names those
  Medicare years and the page says so ("In 2053 and 2054 Bo is 65 or over while Ana still works: a plan through Ana's job
  can cover Bo, so Medicare those years is not added (the Medicare page counts them)"). The Medicare page's lifetime is the
  added years plus `onJob.total`. Who works, and the years before the household's retirement year: see "Review fixes
  2026-11-02 (third pass)" and "(fourth pass)" below.
- One pass for income: both pages price cover on `medicare` `planIncome`, the plan run through the brackets by
  `buildInputs({ health: false })`, worked out once per `buildInputs` and handed to both (`params.planIncome`). The premiums'
  own withdrawals therefore do not raise the income they are priced on, and a what-if that changes income afterwards (a
  Roth conversion fill on Roth conversions, different returns on Goal seek) does not re-price them; one that rebuilds the
  plan (another retirement age on Goal seek, a survivor on Stress tests and Life cover) does. `planIncome` takes a shallow
  copy of the plan (it only reads it), so a plan with years of bank transactions is not copied each time.
- Not twice: `retirement.healthIncluded === true` ("My spending figure already includes health cover", a box under Health
  cover on this page) adds nothing. Spending carried from today's bills is today's expenses, or Get started's own starting
  figure (`guide.setup.retireAuto === true`: setup's `retireDefault`, today's bills less childcare and loan payments, which
  carries the same lines, worked out live: `setupFigure`, below; review fix 2026-11-02, it was taken as typed and a premium
  in it was counted twice). In carried
  spending (`carriedHealth`, `healthLine`):
  - a "cover" line, one that pays only for cover before Medicare (health or medical insurance or plan, the marketplace,
    COBRA, an insurance or premium line under Health and medical; not dental, vision, life, care or other insurance), comes
    out of the carried figure (`removedMonthly`, capped at the figure), because today's expenses are carried whole into
    retirement (a work premium ending at retirement is not ended there) and the health line pays for cover from retirement
    on. While someone still works, from the household's retirement year on, the premium is put back as health cover each
    year (`jobPlan`: the plan at work goes on, and so does what it costs; review fix 2026-11-02, those years had no cover);
  - a "medicare" line (`MEDICARE_LINE`: Medicare, Medigap, Part B or Part D) stays and pays the Medicare of the adults 65 or
    over this year (`paidBy`); everyone else's Medicare is added from 65, per person: a year's `totalYearly` x those left /
    enrolled (the premium is the same for each person on it). When nobody is 65 yet the line is someone else's (a parent's)
    and all of the household's Medicare is added (`otherLine`; review fix 2026-11-02: one such line dropped all of it, so
    adding an expense raised what the plan carries);
  - a "mixed" line, cover held with other things (Get started's own "Insurance and health" row, `setup-x-insurance`:
    "premiums you pay yourself, medicine"; or a name that joins cover to something else, "Health insurance & prescriptions")
    is never taken out (review fix 2026-11-02: the row was taken out whole); it pays the Medicare of those 65 or over this
    year who have stopped work, so a retired couple over 65 who answered Get started gets no Medicare on top of the row.
  A figure typed on this page is taken as it is: the health line goes on top unless the box is ticked. Saving a new figure
  in Retirement settings turns `guide.setup.retireAuto` off (the figure is then the household's own).
- Pages that use the spending figure without the health line put the removed premium back: FIRE's FI number is on
  `spending.yearly + removedMonthly x 12` (today's whole spending, as before); Annuities' "Guaranteed income covers" is
  against the first retirement year's spending and its health events, as this page's "Guaranteed income" is.
- Shown: under "What goes into this", "Health cover: About $400 to $1,470 a month from 2052 until 65 (marketplace, after
  the credit), then Medicare about $240 a month for Bo from 2053 and about $480 a month for the two of you from 2055" (only
  the parts that apply; a range when the months differ by more than a quarter; the Medicare range is over the years the
  most are on it, the surcharge moving it, with ", including an income surcharge in 21 of those years (Medicare page)" when
  there is one; years after a death at the plan's end are left out of the words), the total, then what is left out and why
  (a Medicare line, the job's years, a premium taken out or kept), the cliff ("In 2053 and 2054 the plan's income is over
  $86,560 (by as little as $3,710), so those years get no marketplace credit: about $17,240, already in the cost above.
  Taking those years' money from Roth or cash could keep the credit (Healthcare before 65 shows how)."), two outlined
  44 px buttons to both pages and the box, which saves on change and confirms on the next render. Ticked, the record still
  says what cover would cost ("Without that, the plan would add ..."): `compute(plan, { showHealth: true })`, the page's own
  call, works it out for the words only (`health.shown`); `buildInputs`, Monte Carlo and Goal seek never do. The verdict,
  the careful figure, "Spending in retirement" and Goal seek's spending answer say "on top of health cover" (`healthAdded`);
  "Guaranteed income" is against spending and health cover; the spending help in Retirement settings follows the box
  ("before health cover (the plan adds it)" or "health cover included (you said so under Health cover)"). `compute()`
  returns `health`: `{ included, total, bridge: { fromYear, untilYear, years, total, credit, monthlyFirst, monthlyLow,
  monthlyHigh, cliff: { income, year, lost, lostTotal, years, yearsList, overBy } | null } | null, medicare: { fromYear,
  untilYear, monthlyFirst, monthlyAll, allFromYear, allNames, monthlyLow, monthlyHigh, early, joins, enrolled, people, total,
  surcharge, surchargeYears } | null, onJob, jobPlan, coverLines, removedMonthly, fromSetup, paidBy, medicareLine, otherLine,
  shown? }`.
- What moved (2026-11-02, on today's date): the family fixture, Medicare from 2055 about $484 a month for both, $174,161 in
  all; the plan carries $106,221 a year on top of it (was $111,897), lasts in 91% of markets (was 98%), careful $84,400 (was
  $90,000), still on track. The couple at 62: marketplace 2052-2054 $39,729 after $29,666 of credits (2053 and 2054 over the
  cliff), Medicare from 2053, $219,695 in all; carries $89,261 (was $96,105), 53% of markets (was 76%), careful $72,400
  (was $79,300), still tight. The review's one rule leaves both as they were; the retirement fixture (Sam stops in 2033, Lee
  works to 2037) adds Medicare from 2037 for both, $250,160 in all, its 2033-2036 left to Lee's job: carries $124,326, 100%
  of markets, careful $102,600, on track.
- Cost: `buildInputs` runs `planIncome` once (one brackets run of the plan: `buildInputs` went from about 0.1 ms to 1.4 ms
  on the family fixture); the projection, Monte Carlo (with its 9-in-10-markets figure) and the other heavy pages call
  `buildInputs` once and reuse its inputs for every path. The engine now indexes the events by year once per run (a health
  event in every retirement year made the old scan of all events each year cost Monte Carlo about a tenth more). Pages that
  rebuild the plan per candidate (Goal seek's retirement ages and claiming ages) pay it per candidate, as they should: the
  bridge years move with the age. Medians on 2026-11-02: projection compute 2.0 -> 2.7 ms, Monte Carlo 373 -> 431 ms, Goal
  seek 29 -> 70 ms (family fixture). After the review fixes (a busy machine, medians): `buildInputs` 0.3 -> 1.2-2.6 ms,
  projection compute 1.7-4.8 -> 3-6 ms, Monte Carlo about 400 ms either way (370-440), Goal seek 33-47 -> 67-97 ms; with the
  box ticked everything is as before the health line, and only the page's own call (`showHealth`) pays one income run for
  the words.
- Not modelled: a survivor's lower cost when a what-if drops a person without rebuilding the plan; the Medicare Part B
  deductible; out-of-pocket care (a line on Expenses stays in the spending).

## Review fixes 2026-11-02 (third pass)
- Who works (`workRule(plan, people, { today, incomes })`, one rule for the health line and Healthcare before 65): someone
  works in a year while they are under their retirement age and alive, have pay (salary, bonus or business on the Income
  page, pay with no owner counting as the first adult's, or the engine's "<name>'s pay" line for a partner) and did not
  answer "retired" or "not working now" in Get started (`guide.setup.status` "retired" or "none"). It was the age alone, so
  a partner with no job counted as working: the retirement fixture with Lee's salary taken out and Lee "not working now"
  (born 1975, the plan's 65) left Sam's Medicare in 2033-2039 to "Lee's job" (health line $199,841 against the Medicare
  page's $220,160) and never priced Lee's own cover. Now Sam's Medicare is added from 2033 ($220,160, the Medicare page's
  lifetime) and Lee's marketplace cover 2033-2039 ($48,779, Healthcare before 65's total, which now covers Lee too); Lee is
  on Sam's plan at work 2026-2032.
- Get started's own figure is worked out live from today's bills while `retireAuto` is true (`setupFigure(plan, today)`,
  the same parts as setup's `retireDefault`, which module.test.mjs checks it equals; worked out here because importing Get
  started's compute pulls its page graph into every retirement page, and a module in that loop, Life cover, reads Stress
  tests' constant at load). The saved `spendingMonthly` kept the bills of the day it was saved, so a premium added on
  Expenses afterwards was taken out of a figure that never had it (family: $4,570 saved, a $600 premium added later, the
  plan spent $3,970 a month, $7,200 a year short). Storing the premium with the figure would need Get started to write it;
  the live figure needs nothing stored and also follows a premium that changes. Now: $5,170 from today's bills less the
  $600, $4,570; changed to $800, still $4,570. `buildInputs` and `compute` return `setupMonthly` (the live figure, or
  null); Retirement settings shows it and its fold status says it, and saving a different figure there turns `retireAuto`
  off as before. A live figure of 0 falls back to the saved one.
- With everyone 65 or over and retired this year (no one works by `workRule`), a cover line on Expenses is their cover
  alongside Medicare (a supplement, an Advantage or a retiree plan): it stays in spending and pays their Medicare, as a
  mixed line does (`paidBy.era`). It was taken out as cover before 65: a couple born 1958 and 1959 with "Supplemental
  insurance" $300 and "Medicare premiums" $490 spent $3,076 a month (was $3,376 before the health line), and with one
  "Health insurance" $900 line $3,070 with Medicare (was $3,486). Now $3,376 and $3,486, nothing added. The page says
  "Your expenses list "Health insurance": with Ana and Bo 65 or over and retired, that counts as their Medicare and any
  supplement, so it stays in your spending and Medicare is not added again." A mixed line pays the Medicare of those 65 or
  over who do not work (`workRule`, was the age alone).
- One reason a year: a Medicare year left to a job's plan (`onJob`) names only those whose Medicare no line on Expenses
  pays, at their share of the year; a year with nobody left is not listed. The retired couple seed (Ruth 72, Sam 69 with
  "Sam's pay" to 70, "Medicare premiums" on Expenses) said both "Medicare for Ruth and Sam is already in your spending" and
  "In 2026 Ruth is 65 or over while Sam still works"; now only the first. "those years" is "that year" for one year.
- Words: "(marketplace, after the credit)" only when the marketplace years have a credit (`bridge.credit`), else
  "(marketplace, no credit)"; years under the poverty line (`bridge.underLine`) get "In 2026 and 2027 the plan's income is
  under the poverty line, where the marketplace gives no credit: Medicaid may cover people with that income instead (your
  state's marketplace site will say)", as Healthcare before 65 says. The total names what it holds ("About $219,700 in all
  for the marketplace and Medicare") and leaves out a work premium kept while a partner works, which its own sentence
  prices (`jobPlan.total`: "While Bo still works (2050 to 2054), the $600 a month stays in, for the plan at work: about
  $36,000 more over those years"); it read "$210,160 in all" with the $36,000 inside it.
- A spending figure typed in a scenario (Compare, Advisor's plan) is a typed figure: the lever turns `retireAuto` off in
  the copy, so the premium is not taken out of it (a $6,000 scenario ran on $5,400). Compare's `current.spendingMonthly`,
  while the plan's figure is Get started's, is what the plan spends before health cover (the "Spend 10% less" starter and
  the editor's "the plan: $4,570"), and Advisor's plan says "yours" from the plan's own run.
- What moved: none of the fixtures (family, couple at 62, the retirement fixture, the retired couple seed) and no golden
  case; only plans with a partner without pay, a Get started figure saved before a premium changed, a couple all over 65
  with a health insurance line, or a Medicare line next to a working 65-year-old.

## Review fixes 2026-11-02 (fourth pass)
- Pay is a job or a business. `workRule(plan, people, { today })` counts only salary, bonus and business lines on the Income
  page (`PAY_TYPES`) owned by that adult; a line with no owner (or an owner no longer in the household) is the first adult's,
  and a line owned by a child, or by an adult with no birth date, never makes anyone work. The engine's "<name>'s pay" no
  longer counts: it is built from every Income line a partner owns that is not Social Security or a pension, so rent,
  dividends and other income made the partner "work". The retirement fixture with Lee's salary swapped for a $1,500 a month
  rental (nothing said in Get started): the health line was $246,687, Medicare only from 2037 and 2033-2036 "a plan through
  Lee's job can cover Sam and Lee", and Healthcare before 65 said "everyone works until 65". Now $268,924: Sam's and Lee's
  Medicare from 2033, $264,103 (the Medicare page's lifetime), plus Lee's marketplace 2033-2034, $4,821 (2033 $602, 2034
  $4,220, after the credit). $400 a month of dividends owned by Lee: Medicare $257,157 from 2033 (was $239,741 from 2037),
  plus her marketplace. The retired couple seed's "Rental duplex" (Sam's salary ended 2025) no longer has Sam "still
  working" in 2026: with no Medicare line both are priced from 2026.
- A Get started answer of "work" counts as working even with no Income line (Get started takes "work" with the pay box
  blank); "retired" and "none" mean not working, whatever Income holds; no answer: pay decides.
- The Healthcare page and the health line price the same years (`coverRule(plan, people, { today, retireYear })`, which
  Healthcare before 65 uses for who is covered): someone under 65 is on the marketplace in a year when they do not work and
  have stopped: Get started says retired or not working (from today), or they are past their own retirement age, or the
  household has retired (the projection's `retireYear`) and they have no pay. Someone who works is on a job's plan until
  their retirement year. A year in which anyone works is left to that job's plan, as before. It was "anyone not working,
  from today", so the family with no Income lines and Get started saying both work was priced 29 marketplace years
  2026-2054 for Ana, Bo and Cy at an income of $0 ($741,455), none of them in the projection. Now no marketplace year
  (Bo on Ana's plan 2050-2052, as with their salaries), and the same health line as the family's ($174,161). The health line
  now takes every year Healthcare before 65 prices, and Medicare in every year nobody works, before the household's
  retirement year too (it took only years from it): Ana "not working now" with no pay and Bo working to 62 puts the
  marketplace at 2050-2054 and Bo's Medicare at 2053-2054 on both pages, where the line began in 2055. Lee with no pay and
  nothing said in Get started is on the marketplace from the household's retirement (2033), and no longer listed as on
  Sam's plan 2026-2032 (she had not stopped; the figures are the same).
- Retirement settings' spending box, its help and the fold status show the figure the plan counts before health cover
  (`figureMonthly`, from `buildInputs` and `compute`, to the cent): a typed figure as it is, or Get started's own less the
  health insurance among today's bills that the health line replaces. It showed Get started's figure with the premium still
  in it ($5,170 against the $4,570 the plan counts), so typing $5,000 to spend less raised spending to $5,000. Saving goes
  through `saveSpendingFigure(draft, typed, shown)`: the figure shown, saved again, keeps it Get started's (it goes on
  following the bills; the saved figure is untouched); any other figure is taken as typed and turns `retireAuto` off ($5,000
  saves $5,000, $4,000 saves $4,000). The help adds "Get started's figure from today's bills, less $600 a month of health
  insurance" when a premium came out.
- "After the credit" only over a range in which every year has a credit (`bridge.creditYears`, `creditWords`): "(marketplace,
  after the credit)" when all do, "(marketplace, no credit)" when none does, "(marketplace; with the credit in the years it
  applies)" when some do. It checked the credit summed over the years, so the 68/63 couple (2026 under the poverty line),
  Lee with no job (2033 under it) and the couple at 62 (2053 and 2054 over the cliff) read "after the credit" over a range
  whose top was a year with none. The sentences after it still name the years without one.

## Review fixes 2026-11-02 (fifth pass)
- Who is covered by whose plan. While anyone works, an adult who does not work is on that worker's plan: no marketplace is
  priced for them. The first adult with no pay and no Get started answer is presumed at work until the household retires
  (`workRule(..., { retireYear }).presumed`): the engine already counts those years as working years (no spending, no
  withdrawals), so a partner's cover goes on that plan as it would with pay on Income. A partner with no pay and no answer is
  not presumed to work; that plan covers them until the household retires, the marketplace after. The marketplace is priced
  only in years nobody works, from then to each person's 65th birthday year, and only while the person is alive in the plan
  (`coverRule` takes `workRule`'s end-age check). The family with Ana's salary taken out (Cy's summer job, or no Income lines
  and nothing said): $231,756 with Bo's marketplace 2050-2052 at an income of $0 and nothing for Ana, now $174,161, the
  family's own (Bo on Ana's plan 2050-2052, Bo's Medicare 2053-2054 left to it; Healthcare before 65 says "No pay is listed for
  Ana and Get started does not say Ana has stopped work, so the plan takes Ana as working until 2055"). Lee with a plan to 60
  and no pay: 2033 $394 and 2034 $3,828 of marketplace after her plan ended, now none ($115,275, Sam's Medicare alone).
- The household's retirement year (`householdRetireYear`): the first adult's own, as before, unless Get started says they are
  retired or not working now; then the year the last adult who works today stops, or this year when nobody works. Ana "not
  working now" with Bo stopping at 62 had 2050-2054 with no spending and no withdrawals and the marketplace priced on an income
  of $0 ("under the poverty line ... Medicaid may cover"); now retirement starts in 2050 ("Retirement starts in 2050 (when Bo
  stops work at 62)", `retireBy`), the five years' $84,000 a year are spent, the marketplace is priced on the plan's own
  withdrawals (2050 $4,941, 2051 $33,815 and 2052 $34,466 over the cliff, 2053 $1,624, and 2054 $17,606 under the poverty line,
  the year the plan lives on Roth money: a real one, with spending), health line $315,964 -> $272,417, what the plan carries
  $73,609 -> $60,196 (short either way). A partner Get started says is retired or not working brings no pay in, whatever Income
  still holds (it came in as "<name>'s pay" to their retirement age). No frozen key moved: the answer keys hold no Get started
  answers, and every `tests/golden` case passes as it was. Healthcare before 65 never prices a year before the household's
  retirement (the engine's working years), as a safety net. Goal seek's "When ... can retire" and Financial independence ask
  about the adult whose stop starts retirement (`leadAdult`), never one who has said they do not work; with nobody working
  there is no age to find.
- Rent, dividends and other income by their own names. `workRule` counts salary, bonus and business only (fourth pass); the
  partner's pay line carries `kind: "pay"`, and every page tells it from rent by kind, never by name (a rental called "Lee's
  pay" is rent). "What goes into this" says each line by its own name and, for a line not named for a person, the year it
  starts (`incomeWords`): "Rental condo: $18,000 a year from 2033" (it said "from 63", Lee's age), "Dividends: $4,800 a year
  from now"; the Guaranteed income stat lists the kinds the plan holds (`incomeKinds`: "Social Security, pensions and rent").
- The marketplace's own income (medicare/compute.js `marketplaceIncome`): AGI plus untaxed Social Security plus tax-exempt
  interest (26 USC 36B(d)(2)(B)); Medicare's surcharge stays AGI plus tax-exempt interest (`irmaaIncome`). The retired 68/63
  couple: 2026 read income $15,365, under the poverty line, no credit, $17,324 ("Medicaid may cover people with that income
  instead"); now $48,012 with Ana's untaxed Social Security, $3,644 after the credit, 2027 $5,844 -> $7,610; health line
  $113,151 -> $101,237; no poverty sentence.
- The words name the person and the years for each part (`healthSummary`, `bridgeParts`: the marketplace years in runs of the
  same people): "Bo: about $300 to $630 a month, 2026 and 2027 (marketplace, after the credit). Bo: Medicare, about $240 a
  month from 2028." and, for the couple at 62, "Ana and Bo: about $400 a month, 2052 (marketplace, after the credit). Ana:
  about $1,440 a month, 2053 and 2054 (marketplace, no credit). Bo: Medicare, about $240 a month from 2053. Ana: Medicare from
  2055 (about $480 a month for the two of you)." No "then" joins parts that overlap.
- Merged with the FIRE answer (rent for life, `incomeOther`): Lee with $1,500 a month of rent keeps it after 2033 instead of to
  her 66 inside "Lee's pay", so her income is $18,000 higher every year and Medicare's surcharge applies in 21 years
  (2045-2065): Medicare $264,103 -> $295,353, the marketplace 2033 $602 -> $588 and 2034 $4,220 -> $4,227, the health line
  $268,924 -> $300,168. The family ($174,161), the couple at 62 ($219,695), the retirement fixture ($250,160) and the retired
  couple seed ($0 with its Medicare line, $148,037 without) are as the checkers expected.

## Review 2026-11-06 (health cover, sixth pass: merged with the base, the fifth pass's verify fixed)
The health line was merged with the other-income rules (recheck 2026-11-05 and review 2026-11-06 above) and Financial
independence's work rules, which are newer than it. Both are kept:
- **Other income** is `otherIncome` as above (rent for life, support and other to an end date or while their owner works,
  dividends and own-account withdrawals never, `otherLeft` named on the page). The partner's pay line is `type: "pay"` (the
  base's name; the fifth pass called it `kind: "pay"`): every page, the medicare page's incomes included, tells it from rent
  by type, never by name. A partner Get started says is retired or not working brings no pay in (fifth pass).
- **"Paid by income"** (the base's stat, `coverage` and `coverageFrom`): all the income in the first retirement year against
  that year's spending and health cover (the health line is spending too), "from" the kinds in it. The fifth pass's
  `incomeKinds` (every kind the plan holds) is gone: it did not match the share shown.
- **"Income counted"** says each line by its own name with its ages, or its years for a line not named for a person
  (`incomeWords`: "Rental condo: $18,000 a year from 2033 (before its costs)", "Lee's pay: $66,000 a year from 56 to 66"),
  then "Not counted". The health record sits under "Spending in retirement" by its name (it was the fifth record by place,
  so "Not counted" would have pushed it under the wrong row).

**One work rule** (`workRule`, used by the health line, Healthcare before 65, the household's retirement year, Medicare's
working-year income, Financial independence and Goal seek through `workingNow`). Where the two disagreed about who still works:
- *A retirement contribution:* Financial independence counted any contribution as work; the health line none (its tests keep
  Lee's IRA saving with her salary taken out, and Lee does not work). Now a contribution to a plan at work (a 401(k) account, or
  one with an employer match) is work; any other (an IRA, a Roth, an HSA, a brokerage) only when nobody else in the plan has
  pay, since a husband's or wife's pay can fund it (a spousal IRA). The retired couple's Sam with a Roth contribution and
  nobody's pay still works (the base's test); Lee with her IRA while Sam works does not (the fifth pass's tests).
- *Nothing typed:* Financial independence had everyone under their age working when nothing was on Income or Contributions.
  Now only the first adult is presumed at work, while the household's retirement year is ahead (decision 1, and the base's own
  "second pass" rule for the first adult); a partner with no pay, saving or answer is not. That is defect 2 below.
- *An answer against pay:* Financial independence let pay or saving win over "retired" or "Not working now" in Get started; now
  the answer wins everywhere (the engine already drops such a partner's pay).
- *A child's pay* makes no adult work (the fifth pass); Financial independence gave it to the first adult.
- Support and other income with no end date of an owner the rule has stopped, and of the first adult, never count from the
  household's retirement on (the first adult's always stopped there; the household's year can now come before their own).
- Medicare's and the marketplace's income in a working year counts the pay of whoever works that year by the rule (it went by
  age: Lee "retired" with her salary still on Income had $59,000 in the household's 2030 income).

**Defect 1 (HIGH, the fifth pass's verify): the household's year is capped at the first adult's own** (`householdRetireYear`:
`max(this year, min(their own year, the last working adult's stop))` when Get started says they stopped). The 68/63 couple
(Ana 68, past her 60; Bo working to 66 for $1,500 a month) read "Retirement starts in 2029 (when Bo stops work at 66)" with Ana
saying "retired": 2026-2028 had no spending, nothing drawn and Ana's Social Security dropped, "Runs out in 2054", carries
$71,564. Now 2026 with or without the answer: Bo's pay comes in as "Bo's pay" ($18,000), "Runs out in 2041 (age 83)", carries
$68,896, health line $87,080 for both. `retireStarter` names the first adult when the year is their own (or this year once it
has passed), else the adult who stops in it, else nobody. Ana "not working now" at 40 with Bo stopping at 62 keeps 2050 (her
own year is 2055), and nobody working keeps this year, as the fifth pass had them.

**Defect 3 ("null" in the hero):** already gone in the base (the careful line filters nulls before `replaceChildren`); the
page text of every phone shot was checked for it.

Figures (hand-derived again, `scratchpad/h6/mine.mjs`, my own reading of the rules above, every year matching the engine's
health events): the family $174,161, the couple at 62 $219,695, the retirement fixture $250,160, Lee with rent $300,168, Lee
not working $273,750, the 68/63 couple $101,237, the seed $0 ($148,037 without its Medicare line), Ana not working $272,417:
as the fifth pass. Lee with $400 a month of dividends $284,478 -> $273,750: dividends are never added (the base's rule), so
she is Lee with no job. All 1,371 runnable qa/households and fixture plans with the health line off are exactly the base's;
with it on, 1,254 move by the health line alone (77 short -> tight where a premium on Expenses gives way to cheaper Medicare
or marketplace cover, 5 tight -> short, 2 on track -> tight).
Tests (`module.test.mjs`, "review 2026-11-06"): the part-time couple with and without the answer (defect 1); the cap and
`retireStarter`; the contribution rule; support of a stopped owner; Medicare's working-year pay. Each failed without its fix.
- Verify of the sixth pass: the Medicare years left to a job's plan (`health.onJob`) are now also in runs of the same worker
  (`onJob.parts`), and `onJobWords` words each run. One sentence named the first year's worker for the whole span: Ana working
  to 65 (2031) and Bo to 70 (2033) read "In 2028 to 2032 Bo is 65 or over while Ana still works: a plan through Ana's job can
  cover Bo and Ana", Ana's job named for 2031 and 2032 after she stopped. It now reads "In 2028 to 2030 Bo is 65 or over while
  Ana still works: a plan through Ana's job can cover Bo, ..." and "In 2031 and 2032 Ana is 65 or over while Bo still works: a
  plan through Bo's job can cover Ana and Bo, ...". No figure moves (no Medicare is added while either works; both from 2033).

## Review 2026-11-06 (seventh pass: money items in the health line and the work rule)
Six defects, in order of harm. Every figure below is today's dollars, the plan as of 2026-11-06.

**1. Married filing separately got the marketplace credit.** A married couple must file a joint return to get the premium
tax credit (26 U.S.C. 36B(c)(1)(C), read 2026-11-06 at uscode.house.gov and law.cornell.edu); the one exception is a spouse who
lives apart and cannot file jointly because of domestic abuse or abandonment (26 CFR 1.36B-2(b)(2)(ii)-(v), eCFR as of
2026-11-04, at most three years running). Healthcare before 65 (`creditAllowed`) now gives `filingStatus: "married_separate"`
no credit in any year, the full benchmark as the cost and no cliff; the health line's marketplace parts carry `separate`, and
`creditWords` says "marketplace, no credit on separate returns". The page and Will the money last? say so in one sentence
with the exception and the law. H-1395 (separated, not divorced): credits $15,893 -> $0, marketplace $1,712 -> $17,606.

**2. Medicare held nothing beyond Part B and the drug plan.** With no supplement entered the Medicare page (and so the health
line) now counts the national average premium for Medigap Plan G, the most common supplement (46% of Medigap policyholders):
$194 a month in 2025 (`MEDIGAP_G`, modules/retirement/medicare/data/medicare.js). Source: KFF, "Key Facts About Medigap
Enrollment and Premiums for Medicare Beneficiaries" (Freed, Ochieng and Cubanski, published October 13, 2026, from NAIC filings
compiled by Mark Farrah Associates), read 2026-11-06; MedPAC's June 2026 Report to the Congress, chapter 2, uses the same
series ($164 for Plan G in 2023). It varies by state ($164 in New Mexico to $257 in New York), age and insurer, so the Medicare
page asks for your own figure; 0 means none. Per person on Medicare a year: (202.90 + 38.99 + 194) x 12 = $5,230.68, so each
person-year adds 194 x 12 = $2,328. Will the money last? says what Medicare holds and, in one sentence, what is not counted:
what you pay at the pharmacy, dental care, glasses, hearing aids and long-term care.

**3. A partner's job was taken to cover a husband or wife 65 or over.** The years someone 65 or over has stopped while the
other still works (`spouseYears`, by the one work rule) were left out of the health line as "on the job's plan". Now their
Medicare is counted (`health.spouseOnJob`: `{ total, fromYear, untilYear, names, parts: [{ fromYear, untilYear, years, names,
worker, presumedUntil }] }`, said by `spouseWords`) unless the Medicare page's tick says a plan through that job covers them
(`retirement.medicare.jobCoversSpouse`, docs/DATA_MODEL.md). With the tick they are left out as before and said so
(`onJob.parts[].byTick`: "you said a plan through Jo's job covers Rae (Medicare page)"). A worker 65 or over on their own job's
plan is still left out (their own years: `onJob`). The tick's help says to check with the plan first: with fewer than 20
workers at the employer, Medicare usually pays first (Medicare.gov, "Who pays first", read 2026-11-06).

**4. The work rule and a partner's pay ignored the pay line's dates.** `payYears(line, today)` gives the years a salary, bonus
or business line is paid: this year when it is paid today; a later year when it is paid for more than half of it (so a raise
split at 2027-03-01 by cashflow/income counts once); none for a one-off, an ended line or a stint shorter than half of any year.
`workRule` takes a person with pay as working only in those years, and the partner's pay after the household retires runs
over them (Jo's job ending 2027-06-30: works and is paid 2026 only, was to 2029; one starting 2027-01-01: 2027-2029, was never).
Medicare's working-year income (`planIncome`) counts each year's own pay (a raise from 2027 counted from 2027).

**5. A first adult who had stopped, with a partner on pay, started retirement at their own later age.** Rae, 62, "Not working
now", 67 on file, Jo part-time $2,200 a month to 66: retirement started in 2030 (`min(Rae's 2031, Jo's stop)`), nothing was drawn
2026-2029 and Jo's $26,400 was taken to cover $55,200 of spending. `householdRetireYear` no longer holds the household for a
partner whose pay is on Income (their pay comes in as income instead): Rae's plan starts in 2026, with the same figures as with
her age set to 62. `retireStarter` returns `{ first: true, stopped: true, notWorking, working: [{ name, stopAge, untilYear }] }`
and the page says "Rae is not working; Jo's pay comes in until 2029". A partner with no pay and no answer still holds it (the
presumed worker, fifth pass).

**6. fire-ver8b (Financial independence's words, the business-draw rule).** `ownAccountMoney` leaves a name out of the
household's own accounts only when a business is the source ("Owner's draw", "Draw from the business", "LLC distributions",
"Commission"); "Withdrawals from my brokerage firm account", "Draws from company stock account" and "Savings account draws for
the business" are the household's own accounts, which the plan already draws on.

Before and after (base 1d1037e against this change, `scratchpad/r6/sweep.mjs` and `cmp.mjs`): of 1,410 qa/households and
fixture plans, 1,372 run; 395 are unchanged (111 have no Medicare years, 284 were already at $0 carried with nothing left at
the end); 977 move, every one explained: the supplement alone 521, the supplement and a spouse's Medicare while the other works
447, the spouse's Medicare alone 7, H-0493 (a new job from 2027-01-05 now counted: her pay after Marcus stops, her job's cover,
no marketplace years) and H-1395 (no credit on separate returns). Verdicts: tight -> short 78 (74 by the supplement, 4 by the
spouse's years), on track -> tight 4 (the supplement). Every health line rise from the supplement is a whole number of $2,328
person-years (1,261 plans); every rise from the spouse's years is exactly `spouseOnJob.total` (454 plans). The family: carries
$106,221 -> $101,203, ends with $1,116,236 -> $871,107, health line $174,161 -> $324,302 (+$139,680 supplement over 60
person-years, +$10,461 Bo's 2053-2054 while Ana works). Rae: tight, carries $58,144, starting 2030 -> short in 2051, carries
$48,748, starting 2026 (tight, $52,853, without the supplement and with the tick: as with her age set to 62).
Tests (`module.test.mjs`, "seventh pass"): payYears; the work rule and pay with dates; Rae; the spouse's Medicare and the tick;
the supplement in the health line and the words; the business-draw names. Each failed on the base.
- **Verify of the seventh pass (2026-11-06).** (1) A contribution to a plan at work (a 401(k) or 403(b) account, or one with
  an employer match: the work rule's test) stops with its owner's last pay line on Income when every one of their pay lines has
  an end date (`contributions[].untilYear`, the engine's own bound): Sam's job ending 2028-03-31 stopped his pay after 2027 but
  his $400 a month and the $1,800 match went on to 2032, short in 2049 instead of 2046. A line with no end date, and saving that
  is not at work (an IRA), keep going to the retirement age, as before. (2) `expensesCarried(plan, people, today, works, ex?)`:
  the health lines among the carried bills (carriedHealth, when spending comes from Expenses or Get started's own figure),
  shared with the Medicare page. Tests: "verify 2026-11-06: a contribution to a plan at work stops ..." (failed on the seventh
  pass's patch).

### Not working now before 55 (verify of the seventh pass, 2026-11-06; my choice)
- Starting retirement this year when the first adult has stopped and a partner is on pay (seventh pass, follow-up 5) applies
  when the first adult said "retired" (any age), is past their own retirement age, or said "not working now" at 55 or over
  (`STOP_NOW_FROM_AGE`). Rae, 62, "not working now" with 67 on file and Jo part-time: retirement starts now, Jo's pay as income.
- A parent at home under 55 is a one-earner family, not a retired one: the partner's work holds the household at work until the
  earlier of the first adult's own year and the partner's stop, as the fifth pass had it. Elena (35, "not working now") with
  Marcus on $90,000: starting now moved the savings to the retired investment mix for 28 years and drew the tax on Marcus's pay
  from savings (short in 2062 instead of 2072); the family fixture with Ana at home at 36 read short in 2045, now 2054 (Bo's
  stop, 2050, as before the seventh pass). 55 is the age a 401(k) can pay out without the 10% penalty after leaving a job
  (IRC 72(t)(2)(A)(v)), a common line for an early retirement; under it, "not working now" is read as at home.
- Saying "retired" at any age still starts retirement now: someone who has truly retired early draws from savings.

## Round 7 (2026-11-06): no year left to plan
- **Everyone past the age the plan runs to** (a birth year typed 1926 for 1962, or 1900): the run had no rows, and fourteen
  pages that read its last row failed with "This page failed to render" (this page, the Timeline, Chance the money lasts,
  Market history, Required withdrawals, the reports, Financial independence and more). `buildInputs` now returns no inputs
  with `noYears` = `noYearsWhy(people, year)` (moved here from Tax, year by year, which re-exports it) when the last
  person's end year is before this year, and adds "Ana is 126, past the age the plan runs to (95): check the birth date on
  the People page" to `missing`; `compute` passes `noYears` on. Every page that runs the plan already waits on `missing`.
  One of a couple past the end age still runs on the other's years. Test: "round 7 (2026-11-06): everyone past the plan's
  end age ...", which runs seventeen pages' computes on that plan; each one that read the run threw before this change.

Review 2026-11-06 (round 7): the page says you/your for the unnamed first adult ("Me") and "your spouse" for "My spouse", with the verb to match (core/words.js): the income names built here ("your Social Security", "your spouse's pay", `spousalName`: "your benefit as a spouse"), incomeWords, healthSummary ("You: Medicare from 2055"), onJobWords and spouseWords ("while you still work: your spouse's Medicare is counted"), noYearsWhy ("you are 126"), "Retirement starts in 2055 (you at 65)" and "You: retire at 65". Typed names read exactly as before; stored income names are untouched. Test: "Review 2026-11-06 (round 7): the unnamed first adult reads 'you' and 'your' ...".

## A retirement figure our guesses keep (smart guesses C3, 2026-11-06)
While `guide.setup.retireAuto` is true and `retirement.spendingMonthly` is a guess in the ledger (`plan.guesses`,
estimator `overview/setup:retireSpend`), the saved figure is used as it is instead of being worked out again from
today's bills: settle already refreshes it whenever the bills change, and from 50 it is the 7.F figure (spending as people
65-74 spend it, with home costs and loans then), not today's bills. Plans without the ledger entry are unchanged.
Test: `module.test.mjs` "C3 a retirement figure in the guesses' ledger".

After the C3 money review (est/c3/c3-fix.md):
- `expensesCarried`: our figure from 50 leaves Insurance and health out (spec 7.F), so Get started's `setup-x-insurance`
  row pays nobody's Medicare: it is not among the lines `carriedHealth` reads while the figure is our ledgered guess and
  the oldest adult is 50 or over (the setup's own test). A retired spouse's Medicare was priced nowhere (D2). The
  Medicare page reads the same function.
- `saveSpendingFigure`: a figure typed here is the household's own, even when it equals our guess: the guess is cleared
  (spec S2), so a later settle never moves it (D8).
Tests: setup `module.test.mjs` "C3 review D2", "C3 review D8".

## Round 8 review (2026-11-06): the ways the settings list
"How much to take out each year" set any of the four ways, so a household could pick here what How much to take out holds
back (a share of savings or guardrails worked out as if its income were not there). The list is now that page's own
(`withdrawal-strategy/compute.js` `wayOptionsFor(d.inputs, chosen)`: the ways whose expected run never plans on less than the
plan's spending in the first year or than the year's guaranteed income in any year, plus the one in use), with a line saying
how many are left out and where to read why. Test: `withdrawal-strategy/module.test.mjs` (UX 7).

## Plain words on the first screen (path part 3, 2026-11-06)
"In 9 of 10 markets" reads "Even in a bad run of years (only 1 in 10 is worse)"; the stat is "Spending that lasts, even in a bad run of
years"; "adjusted for inflation" (the engine's label, core/math/retirement.js, untouched) is shown as "in today's dollars";
"(Contributions page)" is "(What you save for retirement)", "(Assumptions page)" is "(Numbers we assume)", and, in the view only (a golden file pins the compute text), the missing-input line
"your accounts on the Net worth page" is "what you own (add your accounts)". The inline links are 44 px (`.pj-link`). No figure changed.

## Path part 3, review fixes
- `savingsUnknown(d)` (compute.js): nothing saved for retirement on file (no first-year balance, nothing being added) and the verdict is not "on track". The page then heads "We don't know yet" with a link to What you own, and the careful line is not run. Quick answers' retire answer (`verdict: "unknown"`) and Your plan's row ("Not known yet", calm, not a gap) follow. No figure changes.

## A rental after its running costs (round 8 batch 6, landlord-5, 2026-11-06; review fixes the same day)
`rentalLines(plan, people, retireYear, today, { inSpending })`, added to the engine's incomes by `buildInputs`, type `rental`,
`source: "rental"`, `afterCosts: true`, `rental` (its name) and `part`, for each rental on Rental analysis, from the
household's first retirement year (to the last end date of the Income rent lines that are its rent, when each has one: the
year it is sold):
- **"rent"**, "<name>'s rent after its running costs": `runningOf` (property/rental `running.js`): rent × 12 less empty months
  less property tax, insurance, dues, upkeep, a manager, utilities and other costs (`noi`), in today's money, rising with
  inflation (`cola`), taxed as the rest of the income.
- **"short"**, when the running costs are more than the rent: "<name>'s running costs beyond its rent", `noi` (negative),
  rising with inflation, untaxed (no tax saving is counted for the loss). Review money 5: such a rental added no line at all.
- **Its loan** (`loanOf`), paid until it is paid off (today + `nper(rate / 12, payment, balance)` months; Condo: 150,000 at 4.5%
  and 851 a month, 289 months from November 2026, last payment December 2050, `loanEnds: "2050-12"`) or the place is sold,
  whichever is first (`ends`). `inSpending(loan)` is the monthly amount the retirement spending holds for it:
  - Get started's own figure holds the loans still being paid when work stops, at their minimum (`setupLoans` → `pay`);
  - today's bills on Expenses hold what they count for each Debts row (cashflow/expenses `debtsCounted`: a bill matched to it at
    the bill's amount, any other row at its payment; no mortgage when a housing bill stands for the mortgage, unless those
    bills add up to all of them, since a bill for one of two mortgages drops both from Debts);
  - a figure typed on this page holds none.
  Then:
  - **"loan back"** (held): "<name>'s loan payment, back once the loan is paid off", the held amount × 12, rising with inflation as
    the spending holding it does, untaxed (spending no longer needed, not income), from the year after `ends` (or the first
    retirement year, when that is later). Review money 1: from Expenses it came back even when no bill held it (21,382 in 2051,
    for life); money 2: at the payment with its extra (13,812 a year) where the figure held the minimum (10,212); money 3: it
    was taxed (2051 tax 5,097 on the brackets, 243 untaxed).
  - **"loan rest"** (held in part): the part of the payment the spending does not hold (an extra paid on Debts), negative, a
    fixed amount, untaxed, until `ends`.
  - **"loan"** (not held): "<name>'s loan payments", −payment × 12, a fixed amount as the payment is, untaxed, until `ends`.
    Review money 4: this was one fixed line, noi − payment × 12 (1,028 a year), which kept the rent from rising with
    inflation while the loan ran: 2045 counted 1,028 where 19,709 − 10,212 = 9,497 comes in. The engine adds a negative line
    to the year's income (`core/math/retirement.js` step 2, `income += amt`, then `need = max(0, spending − income)`).
- The landlord (qa/fixtures/round8-rental.mjs `condoOnNetWorthPlan`): the first retirement year, 2045, was 128% paid by income
  (Alex's pay 126,252 + the gross rent 25,200, flat, against 109,419 of spending and 9,172 of health cover); now **123%**:
  126,252 + 11,240 × 1.03^19 (19,709) = 145,962 against 118,591. The tester's "about 110%" also took the 851 off the rent,
  but Get started's figure (5,200 = 4,350 + the condo's 851, still owed in 2045) already pays it, so that would count it
  twice. From 2051 the 10,212 comes back. The condo only on Rental analysis (`condoOnlyRentalPlan`, the loan not among the
  bills, spending 4,350): 19,709 − 10,212 in 2045 to 22,849 − 10,212 in 2050, then 23,534 rising: 2045 at **135%** (it was
  150% with the gross rent, and 126% with the fixed 1,028).
- Other pages reading the incomes: Annuities' guaranteed share now keeps a line's calendar years (`incomeIn`), so "loan back"
  from 2051 is not counted in 2045. FIRE's "other income a year" leaves out negative lines (`yearly > 0`). Batch 5b's
  guaranteed-income-first engine should count negative lines (they lower what income covers), not drop them.
- The month's own figure (the left-over on Next best action, Dashboard and Budget) still leaves the condo's running costs out:
  that work is in flight elsewhere (handed over in the batch report).
- **Words** (review UX 7): "Income counted" says one unit, the calendar year with the age it is said for: a line named for a
  person "from 2047 (age 67)", any other "from 2045 (Sam is 65)", or "from now"; an end " to 2050"; rent for a place not on
  Rental analysis "Rental condo (before its costs): ...". A rental's own lines say what they are: "Condo's rent after its
  running costs: $11,240 a year from 2045 (Sam is 65)", "Condo's loan payments, $851 a month, come off from 2045 (Sam is 65)
  until the loan ends in December 2050", "Condo's loan ends in December 2050: the $851 a month for it in your spending is
  free again from 2051 ($10,212 a year)", "Condo costs $160 a year more to run than its rent brings in, paid from savings
  from 2045". "Spending in retirement" names a loan it holds ("which holds Condo's $851 a month loan payment until 2050"), and
  the "Paid by income" tile says "rent after its running costs" for these lines (`INCOME_WORDS.rentAfter`; a loan given back
  is not named as income).
- Tests: "batch 6" in `module.test.mjs`: the two plans above; the review's repros (a housing bill for the home's mortgage
  alone, an extra of 300 on the condo's loan, the brackets, rent of 1,100, a sale in 2047, a loan paid off before retirement);
  rent for a place not on Rental analysis unchanged.
