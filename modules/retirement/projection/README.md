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
- Strategies: fixed-real (inflation-adjusted constant), percent of portfolio, guardrails (Guyton-Klinger simplified: cut 10% above 1.2x the rate, raise 10% below 0.8x, no inflation raise after a losing year), VPW (the payment over the years left at the real return, taken at the start of the year: the annuity-due amount, so the money lasts exactly to the end). Since Batch 5b (2026-11-06) the three ways other than fixed-real spend guaranteed income on top of their own withdrawal: percent and VPW set the withdrawal, guardrails keeps a spending target (the plan's spending at first) and tests the withdrawal it needs against the rate, raising it back never above the plan's spending grown with prices; spending = income + withdrawal - tax (rules, hand figures and sources in the How much to take out README).
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
`module.test.mjs` (inputs from the fixture couple, the run, fallbacks) and `tests/retirement.test.mjs` (the engine: buckets in order, gross-up, RMD, sequences, strategies, affordable spending); events marked spending paid by income first). Health line (2026-11-02): the couple at 62 year by year against Healthcare before 65 and Medicare, the job's years left out whoever is listed first (and the Medicare page's lifetime = added + `onJob`), a removed premium back while a partner works ($77,116 a year), the box (and `showHealth` saying what it would cost), a Medicare line for a parent (all Medicare stays; an added expense never raises what the plan carries) and for the older of a couple (the younger's share only), Get started's "Insurance and health" row (kept; pays a retired couple's Medicare) and its own spending figure (`retireAuto`: the premium comes out), which lines are health insurance, no recursion whichever page loads first, and the verdict moving the right way.

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

## Health insurance on top of spending (2026-11-02)
Before, the engine had no health line: retirement spending was a typed figure or today's expenses (which leave out cover
paid from pay through work), and the Social Security page asks for the benefit before Medicare is taken out, so Part B was
never paid by anyone. For the family couple stopping at 62 that left out about $39,700 of marketplace cover to 65 (after
$29,700 of credits) and about $180,000 of Medicare, all in today's dollars.
- `buildInputs(plan, { today, health = true })` appends one engine event a year in which cover is priced (from the
  household's retirement year, or earlier for someone who has stopped while nobody works: fourth pass below),
  `{ year, amount, label: "Health insurance", kind: "health", spending: true }`, in today's dollars (the engine multiplies by the
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
- Not twice: `retirement.healthIncluded === true` ("My spending figure already includes health insurance", a box under Health
  cover on this page) adds nothing. Spending carried from today's bills is today's expenses, or Get started's own starting
  figure (`guide.setup.retireAuto === true`: setup's `retireDefault`, today's bills less childcare and loan payments, which
  carries the same lines, worked out live: `setupFigure`, below; review fix 2026-11-02, it was taken as typed and a premium
  in it was counted twice). In carried
  spending (`carriedHealth`, `healthLine`):
  - a "cover" line, one that pays only for cover before Medicare (health or medical insurance or plan, the marketplace,
    COBRA, an insurance or premium line under Health and medical; not dental, vision, life, care or other insurance), comes
    out of the carried figure (`removedMonthly`, capped at the figure), because today's expenses are carried whole into
    retirement (a work premium ending at retirement is not ended there) and the health line pays for cover from retirement
    on. While someone still works, from the household's retirement year on, the premium is put back as health insurance each
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
- Shown: under "What goes into this", "Health insurance: About $400 to $1,470 a month from 2052 until 65 (marketplace, after
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
  the careful figure, "Spending in retirement" and Goal seek's spending answer say "on top of health insurance" (`healthAdded`);
  "Guaranteed income" is against spending and health insurance; the spending help in Retirement settings follows the box
  ("before health insurance (the plan adds it)" or "health insurance included (you said so under Health insurance)"). `compute()`
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
  while the plan's figure is Get started's, is what the plan spends before health insurance (the "Spend 10% less" starter and
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
- Retirement settings' spending box, its help and the fold status show the figure the plan counts before health insurance
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

## Review 2026-11-06 (health insurance, sixth pass: merged with the base, the fifth pass's verify fixed)
The health line was merged with the other-income rules (recheck 2026-11-05 and review 2026-11-06 above) and Financial
independence's work rules, which are newer than it. Both are kept:
- **Other income** is `otherIncome` as above (rent for life, support and other to an end date or while their owner works,
  dividends and own-account withdrawals never, `otherLeft` named on the page). The partner's pay line is `type: "pay"` (the
  base's name; the fifth pass called it `kind: "pay"`): every page, the medicare page's incomes included, tells it from rent
  by type, never by name. A partner Get started says is retired or not working brings no pay in (fifth pass).
- **"Paid by income"** (the base's stat, `coverage` and `coverageFrom`): all the income in the first retirement year against
  that year's spending and health insurance (the health line is spending too), "from" the kinds in it. The fifth pass's
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
  (Alex's pay 126,252 + the gross rent 25,200, flat, against 109,419 of spending and 9,172 of health insurance); now **123%**:
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

## Batch 5b (2026-11-06): the settings list, after the engine change
The owner's answer, 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the page". With guaranteed income counted first, no qa plan has a way held, so "How much to
take out each year" lists all four; the guard stays (a way whose expected run plans spending + health + tax under a year's
guaranteed income is left out, "N ways are left out: on your plan they would leave some of your income unspent (How much to
take out says when)"); with none left out the help reads "How much to take out compares them on your plan". The answer's
"you plan on" names the way's own first-year spending ("you plan on about $64,868 in 2026, with a set share of what is left
each year"), so it agrees with "Paid by income" (78% for the widow on the share way). `careful.js` `RULE_WORDS.guardrails` says
the new rule ("your spending, cut by a tenth after a bad stretch and raised back, never past your plan, after a good one").
Test: `withdrawal-strategy/module.test.mjs` "5b: after 'Use this one' ...".

## Round 8 batch 5b reviews (2026-11-06): the page for a way that moves, one chance in one set of words
Under the owner's answer of 2026-11-06, word for word: "You can do as you please. Just make sure a layman can easily understand
and use the page".
- A plan on a way that moves with markets is said as itself (UX 5): the headline "Your spending moves with markets", then "About
  $6,032 a month this year, about $5,049 at the lowest if markets do as well as average." and, for the years-left way, "Savings
  are spent down to $0 by 2047 on purpose." (not "The money lasts" and "On track" beside "$0 left"). The careful line for it:
  "Spent the same every year instead, about $5,000 a month would last in 9 of 10 markets." The rule is not described twice.
- The chance in the same words as How much to take out and Required withdrawals (UX 7, `careful.js chanceWords`), on its own
  line: "At the $39,600 you plan, it lasts in about half of markets (47%)." Under 6 in 10 the headline says so once the figure
  is in: "Lasts in about half of markets" (it read "It lasts, just" over 47%). The lede no longer repeats the verdict word:
  "If markets do as well as average, it can pay for $41,926 a year on top of health insurance; you plan on $39,600."
- The settings list uses How much to take out's four names, each way judged on its own run (`wayOptions`, review D2); the rate's
  help: 'the share of savings "A share of what is left" and "Trim after bad years" start from' (UX 8).
- The grey paragraph is two short ones, in the normal text colour (UX 17, 18): "Retirement starts in 2026 (...); the plan runs to
  2076." and the notes, with "set your own figure on this page" said as "Spending is today's expenses; change it under
  Retirement settings below." (rewritten in the view; the note's text in `compute.js` is unchanged, other pages show it).
  "Chance the money lasts" (or "How much to take out") is an outlined button beside "What would change it", not a link.

## Batch 5b with path part 3 (merged 2026-11-07)
Batch 5b's two hero lines keep path part 3's plain words: "Even in a bad run of years (only 1 in 10 is worse), the money carries
about $X a year ($Y a month)." and, for a way that moves, "Spent the same every year instead, about $Y a month would last even in
a bad run of years (only 1 in 10 is worse)."; the tile is "Spending that lasts, even in a bad run of years". The chance line is
batch 5b's (`chanceWords`). With nothing saved on file (`savingsUnknown`) the hero says "We don't know yet" and leaves out the
spent-down line, both chance lines and the "Chance the money lasts" button. The "Expected returns, ..." clause (and with it
`plainWay`) left the hero with batch 5b's shorter paragraphs. No figure changed.

## Follow-up 2026-11-07: one plain way of saying the odds
The owner's standing words: "It should feel easy for a layman ... not ... concepts / words too hard to understand." Every page that says how often
the money lasts now uses `modules/retirement/odds.js` (`chanceWords`, re-exported by `careful.js`; `BAD_RUN` = "even in a bad run of years",
`BAD_RUN_NOTE` = "(only 1 in 10 is worse)"). A "pretend future" is one made-up run of good and bad years; the share of pretend futures in which the money lasts is the
chance. The words, after "the money lasts": 100% "in every pretend future we ran"; 90% or more "even in a bad run of years"; 45% to under 60% "about half
the time"; under 10% "in fewer than 1 of 10 pretend futures"; else "in about N of 10 pretend futures" (N rounded down, never 9 under 90%); with the number
"(93 of 100)" after "of 10 pretend futures", else "(93 of 100 pretend futures last)", where it helps. No page says "markets" for a try ("9 of 10 markets", "every market tried", "simulated markets",
"100 markets" are gone; "if markets do as well as average" stays: it means average returns, not a try). The amber pill "fewer than 9 in 10" is
"short in a bad run". Decision (no owner to ask), changed after the UX review of 2026-11-07 (it found "tries" unexplained where it first appears): "pretend futures", which explains itself, over "tries" or "runs".

## Follow-up 2026-11-07 (batch 5b R3, decided here, no owner to ask): a trimmed guardrails target is raised back once income covers it
Decision: the prosperity rule (strictly below 0.8 times the rate: +10%, never above the plan's spending in today's dollars) also applies when the withdrawal the target
needs is $0 because Social Security or a pension pays for all of it. Before, it needed a withdrawal above $0, so a target trimmed while savings paid stayed down for good once
income covered it. Why this reading: the page promises "trimmed by a tenth after bad years and raised back after good ones", and the owner's rule ("make sure a layman can
easily understand and use the page") is not met by a way that never raises back. The cap at the plan keeps it from compounding past what the household said it spends.
- Pat and Jo (`bridgeCouple`, retiring at 62 on a $60,000 plan; health insurance before 65 pushes the withdrawal past 1.2 x the rate): trimmed 2029-2032 to $34,976, held at
  $43,539 while a withdrawal is still needed, then raised back from 2036 and at the full $60,000 from 2041. Before: $38,000 to $43,500 a year for 29 years under the plan
  and $1,273,219 left at the end; now 12 years under the plan and $577,371 left (the cost of spending the plan, told on the page by the end figure).
- Engine: `core/math/retirement.js` drops `trial > 0` from the raise. Oracles: `withdrawal_strategy.py` (both guardrails branches) and `lead_audit.py`; one key row moved
  (`withdrawal-strategy-income-first-063`, cents), explained in `tests/golden/retirement/QUALITY.md`. Test: `tests/retirement-ways.test.mjs` "5b R3".

## Wording follow-up (2026-11-07, claude-b lane B)
- "Retirement money today" lists only the parts that have money ("$3,700, all of it in cash"; "none on file yet"); with nothing saved for retirement and only cash, it says "no retirement savings on file; $3,700 in cash is counted". The amber "short in a bad run" pill follows the full stop with a space.
- Review round 2: "Retirement money today" calls taxable accounts "in regular savings" (as the order words do); someone who said they are retired reads "already retired" in What goes into this.
Review fixes (2026-11-07): the links in a sentence have no stray spaces and end the sentence ("Add what you own on the Net worth page to see."; "(on the What you save for retirement page)"). A person already past their retirement age is "Retirement has already begun (Ruth at 72)", not "starts in 2026". The note "Social Security already paid" reads "Social Security you already get (from the Income page)" (in the view; the compute string is read by the golden keys). `needItem` (core/words.js) words a missing item for the pages that have no box for it (Year by year, Roth conversions, Withdrawal order, Tax year by year, and those that use `needsWords`): "(on the Expenses page, or on the Will the money last? page)".

## Stress test 2026-11-11 (claude-e, wave 2)
- **No verdict before it is known** (HC-2, R-A1, W5). While the bad-run answer can still change the headline (steady spending that
  lasts if markets are average), the h1 reads "Checking your plan against bad years..." (grey, `aria-busy`, two lines held), then the
  one verdict; the two lines stay held so a one-line verdict does not pull the page up. `retirement/careful.js` remembers each answer
  for the visit (`whenWorked`'s `key`, `carefulKey`: a hash of `buildInputs().inputs`, the day and the goal), so a revisit, Back or a
  save elsewhere on the page shows the verdict at once. The grey bars have `max-width: 100%` (x-3, A9: the page was 518 px wide).
- **First open** (R-A5, x-5, x-3): Retirement settings stay folded; the hero has one button per missing thing, the first filled
  ("Add people ›", "Add what you own ›", "Type what you'll spend ↓", which opens the settings at the box); the Social Security notice
  waits until the page has its basics, so it no longer adds a second filled button.
- **No retirement savings on file** (F4): no chart, "What goes into this" folded, one filled "Add what you own ›".
- **The age** (A6): "Change the age ›" beside "Retirement starts in ..." goes to People; the Goal seek button reads "Could you stop
  sooner? What would change it ›". The chart caption no longer uses page titles as nouns (R-A8).
- Not done here (waits for wave 1, the shared shell): Save settings shutting its section and the jump after it (R-A4, x-2),
  Back losing the place, answers off screen.
- Review of the above: Retirement settings open after their own Save, so "Retirement settings saved." is seen; the hero says "It needs this first" (savings are said once the spending is in, as "We don't know yet").

### Review round 1 N3 (2026-11-11, claude-e)
- The chance line ("At the $84,000 you plan, it lasts ...") keeps room for the amber "short in a bad run" pill while it
  waits (an invisible pill of the same size) and holds its exact height when filled: the pill used to arrive on a line of
  its own and push the two buttons down 22 px half a second after the page opened. Both waiting lines now hold their height
  with `getBoundingClientRect` (offsetHeight rounded 67.9 up to 68 and still moved the page 1 px). Measured every 30 ms on
  family, demo, early-retire and retired-couple: no move.
- Breaker on that fix: when no bad-run figure comes back (nothing lasts even at $0, or it could not be worked out) the two
  lines used to be removed, pulling the page up 174 px; they now stay, in words ("Even in a bad run of years ..., the money
  does not last to the end of the plan."), at the placeholder's height. The waiting headline holds its exact height too.

## Loans in retirement spending (2026-11-07, loans lane 1; tests `tests/loans-escrow.test.mjs`)
A loan's payment is part of retirement spending only until the loan is paid off, and as a fixed amount (a fixed-rate payment
does not rise with prices). Before, Get started's retirement figure carried a mortgage's whole payment for life, in today's
dollars, and the guess sanity check failed `sr.verdict.loans-end` on 3 households of 3.
- Payoff: the date Debts shows (balance/liabilities `loanMonths`): `n = nper(rate/12, payment - escrow, owed)` months, where
  `escrow` is the property tax and home insurance inside a mortgage's payment (`loanEscrow`: `debts[].escrowMonthly` first, else
  the usual figure while the payment or balance is our guess). Source: amortization arithmetic (core/math/finance.js `nper`).
- `spendingLoans(plan, carried, { today, skip })`: for each loan payment the spending holds (`setupLoans` for Get started's
  figure, Expenses' `debtsCounted` when spending is today's bills), `{ monthly: payment - escrow, escrow, inBase: 12 x that,
  yearly: 12 x that, untilYear, lastMonths }`, `untilYear` = the year of today + n months and `lastMonths` = the months paid in it.
  A loan paid off before retirement is left out (the figure never held it); a rental's loan is left to the rental's own lines,
  which now end at Debts' payoff too (`rentalLines` reads `loanMonths`).
- The engine (core/math/retirement.js, `inputs.loans`): the yearly spending less `sum(inBase)` is the part that rises with
  prices; in a retired year each loan adds `yearly` (x `lastMonths/12` in its payoff year, nothing after). Only with the
  `fixed-real` and `guardrails` strategies (guardrails: added on top of the target, never trimmed); a share-of-savings strategy
  spends a share of savings, so no loan is added there. No `loans`: the rows are the same to the bit as before.
- The tax and insurance inside a mortgage's payment are not a loan: they stay in spending after payoff, rising with prices
  (overview/setup `escrowAfterPayoff`).
- The page lists the loans it carries under "Spending in retirement": "<name>'s $X a month until <year> (a fixed amount, not
  raised for prices; its $Y of tax and insurance goes on after)".
- Not changed: Financial independence and Goal seek scale the whole spending figure, loans included (claude-a's / a later
  build's to follow); a rental's "loan back" line while it runs is as before.

## Fix round 1 on the loans lane (2026-11-11, claude-c; tests `tests/loans-escrow.test.mjs`, the ones named "fix ...")
- **A typed figure still holds the loans** (money review D1). A figure that was Get started's own and is now the person's, typed
  over or kept, carries `guide.setup.retireHeld`. While it is at least their payments, it holds the loans Get started's figure
  would hold now (`setupLoans`), each until its payoff. Before, every loan was spent for life once the figure was typed, so $100
  a month less gave a worse verdict (53 of 252 households in the sanity sweep; now 1, and that one fails the older "a bill $100
  lower" part too). A figure typed on a plan whose figure was never Get started's holds no loans, as before. Limit: a loan added
  after the figure was typed is taken to be in it when the figure is large enough.
- **A rental's loan** (D4): one the spending carries is now among `loans` (a fixed amount until Debts' payoff, or the year the
  rental is sold: `rentalLines` `soldBy`), not a payment that rose with prices and came back as a rising "loan back" income. On
  the condo fixture that was $7,695 too much in 2045 and $54,557 over 2045 to 2050. `rentalLines` still makes "loan back" when
  called without `fixed`. The words under "Income counted" are the same ("... is free again from 2051").
- **After a typed mortgage is paid off** (D8; estimators/home.js `escrowAfterLoan`). A mortgage on the home whose payment is read
  as all loan because the question was never answered left retirement spending with no property tax or home insurance at all
  after its payoff (642 of the 1,400 qa plans). Now the usual tax and insurance for the home, at most half the payment, stay in
  the spending (`assumed` on the loan), unless the person said they pay them apart or Expenses has a property tax or home
  insurance bill by name. Debts and the payoff date are not touched. Get started's figure counts the same amount for a mortgage
  paid off before work stops (`setupLoanParts` `afterEscrow`, setup's `escrowAfterPayoff`). Decision: the owner would otherwise
  be asked whether to assume them; we assume, say so on the page, and point to Debts for the answer.
- **The year work stops** (D10; `workStopYear`, `runsPastWork`). A loan is in Get started's figure when its payoff falls in a year
  after the one work stops. One that ends in that year is not, and `buildInputs` adds it with `inBase: 0` and `onTop`, so its
  last months are paid on top of the figure. Before, the gate was whole years of age from today: a loan ending eight months after
  work stopped was dropped, one a month longer was in for the whole payment.
- **In words** (`spendingLoanWords`): one sentence for each loan, with the whole payment the other pages show, the part that pays
  the loan, the year it stops "at the payment you make today", and the tax and insurance that carry on; the payoff plan's
  earlier year when there is one (`debt/payoff twoDates`).
- **Other pages** (D11): `core/math/retirement.js` `lifelongSpending` (the figure less the loan parts that end) and
  `spendingRealIn` (one year's spending in today's dollars, as the engine row). Annuities' guaranteed share and the FIRE target use
  them; How much to take out, What matters most and Inheritance still show the figure itself (noted in their READMEs).
- **The engine** ignores a `loans` entry that is not an object (it threw on `null`).

## Fix round 2 on the loans lane (2026-11-11, claude-c; tests in `tests/loans-escrow.test.mjs` named "fix2 ...")
- **"Not sure" with less room in the payment** (estimators/home.js `escrowAfterLoan`, `topped`). Our figure for the tax and
  insurance inside a typed payment is held to what the payment has room for (`escrowCap`), so it shrinks as more is owed. That
  shrunken figure was all that stayed after the payoff, so more owed gave a better verdict or a lower retirement figure in 26
  of 1,120 steps (couple aged 40 in Texas, $1,200 at 5%, "Not sure": $395 kept for life at $150,000 owed, $126 at $200,000). Now,
  when our figure was cut by `escrowCap`, the usual figure for the home (`escrowMonthly`, at most half the payment) is what stays
  after the payoff (`topped`), as for a plan that never answered. The part that ends at the payoff is the payment less that
  figure, a fixed amount; Debts and its payoff date are untouched. The page says "our guess of the usual amount for a home like
  yours, which is more than this payment has room for".
- **An "Insurance" bill on Expenses** (`insuranceMaybeBilled`, `taxOnly`). 634 of the 1,400 qa plans keep the usual tax and
  insurance after payoff and all of them have a bill named just "Insurance" (H-0148: $1,050 a month), which may hold the home's
  insurance already. Decision: a bill in the Insurance category, not one of Get started's own rows, whose name names no other kind
  of cover (health, car, life, renters, dental and so on: `OTHER_COVER`) is taken to hold it, so only the usual property tax is
  kept after payoff, and the page says "Home insurance is not added: the insurance bill on your Expenses may already hold it."
  A bill named for home insurance or property tax keeps nothing extra, as before. H-0826 (a $1,400-a-quarter "Insurance" bill):
  tight, carries $59,633 (was $56,970), $70,095 with health in the figure (was $67,433).
- **A mortgage bill more than 10% off the payment** (cashflow/expenses `debtsCounted`, which only this page reads). With one
  mortgage and a bill for it ($466.15 a week in qa H-0329), $100 a week less on that bill put it outside the 10% match, so the
  bill stopped being the loan's and was spent for life: short at 70 instead of 71. Now, with one mortgage, its bill is that
  loan's at the bill's amount (at most the payment) and ends at the payoff. Two mortgages and one bill for less than both are
  still not read (which loan it is cannot be told).

## A typed leftover is not added to retirement savings (2026-11-07)
When the person typed a leftover (Get started question 6 or Expenses: `guide.setup.spendLeft`, above $0) and is still working, a note says plainly:
"You said about $1,000 a month is left over. That stays in checking and savings and is not added to your retirement savings here; only what you put
into retirement accounts (What you save for retirement) is." Decision (no owner to ask): the owner's words were that the leftover estimate could
calculate how much is saved each year; the year's figure is said once, as cash building up, on Get started, Your plan and the Dashboard (`spare.year`).
Adding it to the projection's contributions as a taxable saving would move every retirement answer, and the frozen retirement key, for money that is
not in any account yet and is free to be spent; a household that wants it counted types it as a contribution. The projection cannot read the month
itself (Next best action imports this page, so reading it back would loop), so the note uses the figure the person typed. No number moved.
Also (task 142, item 5): an Income rent line that **ended** and is a rental's by name (the line's name holds the rental's name, or the other way
round) ends that rental's rent in the plan from the line's last year, when no line going today holds it (`rentalLines`); before, the ended line was
dropped from the match and the rent went on forever. A line that names no rental is not guessed at.

## Left2 merge: items for other builders (2026-11-11, claude-c; tests `tests/left2-merge-items.test.mjs`)
- **B1, a figure typed over today's bills keeps their loans.** Before: with no figure the page reads Expenses, and every loan
  payment those bills hold (expenses `debtsCounted`) leaves the spending at its payoff (`spendingLoans`). Typing that very
  figure (or $100 less) made it a typed figure, which held no loan, so every payment was spent for life and the answer could
  get worse (claude-b's case: $6,430 retyped, tight to short at 77; on the family example 3 loans held, then none). Now
  `saveSpendingFigure` writes `retirement.spendingFrom: "expenses"` when the figure is typed while the page read today's bills
  (not Get started's own, no figure yet, Expenses filled in), and takes it off with the figure. `buildInputs` then holds the
  loans those bills hold, at what they count for each, while their sum is at most the figure (the same rule as Get started's
  `retireHeld`: a figure below the payments cannot hold them). Decision: the mark stays when the figure is retyped later, as the
  figure still started from those bills; it goes only when the figure is cleared.
- **B2, before retirement income pays its own tax.** In working years the run counts no spending and saves no income: the
  month (what is left over each month, after tax) holds both. A partner who works on, or a pension or Social Security already
  paid, is income in the run from this year (`from = Math.max(year, r.from)`, pensions from this year): that is its own start
  as far as the run goes, nothing is dropped. But in brackets mode the run worked out the tax on it and took the whole tax out
  of savings every working year ($3,992 in 2026, $4,114 in 2027 on the family example with Bo working to 75). The engine
  (core/math/retirement.js `fixedWant`) now lets the year's income pay that tax first, as it already paid health cover, and
  savings pay only what it cannot. Retired years and the ways that set a withdrawal are unchanged. Golden suite: no key moved
  (both engines run side by side over all 2,000 engine calls, identical; the new branch never fires there).
  Refuted part: "income paid before the retirement year is dropped". It is not counted as savings on purpose, because the
  leftover already holds it; counting it would count it twice.
- **B3.** The note "You said about $X a month is left over ... is not added" is not said once
  `plan.retirement.leftover.rowId` exists (claude-b's L4 writes the leftover as an ordinary contribution row, which the run
  counts). The field is in docs/DATA_MODEL.md; nothing here writes it.
- **Item (4), one figure for both ways a rental is entered.** The loans lane already gives it: on `qa/fixtures/round8-rental.mjs`
  the condo entered on Net worth holds its $851 loan in the spending until 2050 (`spendingLoans`), and entered only on Rental
  analysis its loan is a negative "Condo's loan payments" income until 2050. Spending less income differs by $21 to $39 a year
  (the figure is rounded to $10 a month, so about $1 a month real times prices), and the verdict is the same ("on track").
  Test: "item 4" in `tests/left2-merge-items.test.mjs` (within $42 a year times the price level). Nothing changed for it.

## Left2 fix round 1 (2026-11-12, claude-c; tests `tests/left2-fix1.test.mjs`)

- **A figure typed over today's bills (B-1, B-3).** `retirement.spendingFrom: "expenses"` (set by `saveSpendingFigure` when the
  page read the Expenses bills) now means: the figure is those bills, scaled to it. `billShare = min(1, figure / Expenses
  total)`; each loan payment the bills hold is held at `payment x billShare` until its payoff, and the health lines the bills
  hold come out of the figure in the same share (`expensesCarried` with `overBills`), so health cover is added only beyond
  them. Before, a figure of at least the loan payments held every loan in full and one dollar under held none: on the invented
  household 12 (`qa/fixtures/retype-households.mjs`), $1,140 ended at $539,020 and $1,138 at $174,315. Now the end balance
  never rises as the typed figure falls (health line left out of the check: losing the marketplace credit under the poverty
  line is a real rule, healthcare README). Retyping the Expenses total gives the answer reading the bills gives (households 12
  and 14; household 14 went from "tight" to "short at 88" because $5,231 a year of cover was added on top). Decision (owner
  question): a typed figure over the bills is read as the bills scaled, and the box shows the figure as typed.
- **An ended rent line (B-2).** It ends a rental only when the names are the same after trim and case, or the line is the
  rental's name plus "rent", "rental" or "rental income" (`bare()`); never because one name is part of the other, and never for
  a rental with no name or a name under 3 characters. "Old condo across town" no longer ends "Condo"; "Garage space" no longer
  ends "A" ($1,714,003 -> $1,886,609 on `condoOnlyRentalPlan`). Fix round 2 (2026-11-12) moved the rule to `property/rental/running.js rentEndedFor` so the month reads it too; no figure here moves.
Source: the app's own rules; no outside figures.

## What this rests on (2026-11-11, owner's request; `modules/retirement/levers.js`, tests `tests/levers.test.mjs`)
The owner asked that a plan short on retirement show what drives the answer, say which figures are the person's and which are
ours, and let each be checked and changed with the effect shown ("sometimes it may just be a bad sequence of inputs"). The page
now has, under the answer:
- **The hero line** (worked out at once, no projections, `levers.js` `restsOnWords`): "This answer rests on 9 numbers: 2 you gave
  us, 2 our guesses, 5 usual figures. 1 thing is not counted yet: the $567 left over each month." and the page's one filled
  button, **"Check the numbers behind this ↓"** (it opens the card, scrolls it to the top and focuses its heading). With nothing
  saved for retirement on file (`savingsUnknown`) "Add what you own ›" stays the filled button and this one is outlined.
- **"Before your change / Now"**: the view remembers the answer and the row values it last drew on this visit (a module-level
  memory, as `careful.js` keeps). When the projection's inputs or a row's value differ when the page is drawn again (a change
  here or on another page), the hero says "Before your change: runs out at 70. Now: runs out at 69. You changed how fast
  investments grow (7% → 6%)." No schema change.
- **The card "What this answer rests on"**, directly under the hero: open under a short or tight answer, a fold under one on
  track. One record per number: the label, the value now, a tag (**Yours**, **Our guess**, **Usual figure**, **Not counted**;
  a plain `pill`, never coloured), one or two effect lines and one action. Five show; the rest fold under "N more numbers"; the
  ones hidden by D-A2 are named in one line ("Also counted, each moving the answer by less than a year: ..."), so the count in
  the hero adds up. The records are drawn grey (fixed height, `aria-busy`) and filled after the first paint a slice at a time
  (`careful.js` `whenWorked` driving `levers.js` `leverSteps`, one projection a step), remembered for the visit by the inputs
  and the row values. Measured (390 and 320, light and dark, every 20 ms for 4 s): nothing on the first screen moves.
- **Go deeper**: one card after it with three outlined links, "What matters most? ›" (Sensitivity), "Try two plans side by side
  ›" (Compare), "What if history repeated? ›" (Historical). The chart's plain sentence naming Chance and History is now two
  outlined links.
- `#/retirement/projection?check=1` lands on the card once per arrival (open, scrolled to, heading focused), as `?type=spending`
  opens the settings: the same route object drawn again after a save is not brought back.
- **Simple first (owner, 2026-11-12; review 2026-11-12, P21).** The hero reads: the headline, the answer's own sentence, then the
  line of what it rests on and the one action, the filled "Check the numbers behind this ↓", then the bad-run lines and when
  retirement starts. At 320 px the filled button was under three paragraphs and off the first screen (y 593 to 679 on a 568 px
  screen); it is on the first screen now at 320 and 390. The two outlined links that sat beside it, "Could you stop sooner? What
  would change it ›" and "Chance the money lasts ›" (or "How much to take out ›"), lead the Go deeper card under "What this
  answer rests on" (the owner's rule: one action under the answer; deeper pages by "Go deeper" links). With nothing saved on file
  the hero keeps "Add what you own ›" and the outlined check of what is not counted. Nothing is removed.
- **Go deeper waits for an answer (P19).** While the answer is "We don't know yet" (nothing saved for retirement on file) the
  Go deeper card is left out: its pages rank levers under a verdict that does not exist yet (Sam saw "When Sam retires moves
  your plan the most" over $0 bars).
- **"More settings" says when it holds a figure not saved yet (the final review F3, 2026-11-13; test `tests/levers.test.mjs`
  "F3 ...").** The fold's line is recounted as a box under it is typed in or picked: "1 to save" (or "2 to save") while boxes
  differ from what the page drew, back to "as usual" or "N changed" (not the usual figure) when they are put back. Before, it
  read "as usual" over an 85 typed in "Share in stocks now", and "Save settings" saved it. "1 to save" rather than "1 changed,
  not saved yet": the fold's line does not wrap (`.fold-status`), and longer words squeeze the title to a word a line at 320 px.

### Decisions (spec rv/spec.md part A; binding)
- **D-A1. Unit.** The age the money runs out, or "lasts to the end (age N)", at average markets, from one `project()` of the
  changed copy. When both runs last, the money left at the end in today's dollars. Never "the most it can pay for"
  (`affordable`: it compares different loan bases). The effect lines never print a verdict word (tight, on track, short); those
  stay the hero's.
- **D-A2. Size and order.** score = (alt lasts ? endAge + 1 : altAge) − (base lasts ? endAge + 1 : baseAge); when both last,
  Δ(end money in today's dollars) ÷ yearly spending in today's dollars. Order: Not counted, Our guess, Usual figure, Yours;
  within each by |score|. Show 5 and fold the rest under "N more numbers". Hide a Yours or Usual row whose |score| < 1 year,
  except the growth and rising-prices rows (the owner named them): always listed, in the fold if need be.
- **D-A3. Tags.** Our guess = `isGuess(plan, path)` (the ledger or the older flags). Usual figure = an Assumptions field equal to
  its default while `reviewedAt` is absent or more than 365 days old. Yours = typed, or confirmed. Not counted = a blank the plan
  treats as zero. No colour on any tag.
- **D-A4. The usual alternatives come from sourced tables only.** Saving at work: `usualShare(plan, pid, today)` (Vanguard *How
  America Saves 2026*, `guesses/estimators/saving.js`). The match: the `contrib.match` guess / `matchTerms()` (median value 4%
  of pay, earned in full at 6% put in), the figure behind Get started's "Not sure (about 4%)". The 50%-up-to-6% tiers
  (`career/benefits/compute.js` `DEFAULT_TIERS`, Next best action's match step) are a second, older convention: not used on the
  card.
- **D-A5. The match with nothing going in.** A match alone adds $0 when nothing goes in, so the two are one row: "6.6% of pay
  plus the usual match". (The engine itself would count a match typed on a $0 row; no alternative ever writes one.)
- **D-A6. Writes from the card.** The card writes only the leftover answer (L4, below). Every other row links to the page that
  owns the figure, landing on the box. The before-and-after is shown when the person comes back; no schema change for it.
- **D-A7. Returns are not a fix.** The growth row's action is "Check ›", never "Raise"; its effect line shows both directions
  ("Careful 6%: runs out at 69. Hopeful 8%: runs out at 71."); under it: "Nobody can choose this. Fix the plan with what you
  control: saving, when you stop, spending."
- **D-D1. No new step.** The check lives on the page the retirement step opens. Going deeper is one card of questions, two
  levels at most (Nielsen 2006).

**Builder's reading of D-A2 (2026-11-11).** A zero the person gave on a plan at work ("None" going in, "No match") is listed with
the Not counted rows when changing it moves the answer by a year or more; its tag still says Yours. The plan counts nothing
there, exactly as for a blank, and these are the owner's own examples ("a 401(k) contribution not entered, a wrong match"):
without this they sat in the fold behind Social Security rows whose change moved nothing. With it, Jamie's card lists the money
left over, then "What Jamie's job adds (the match) · Yours · No match on file (you said so)"; Casey's lists the money left over,
then "What goes into Casey's 401(k) · Yours · nothing (you said so)". The spec's acceptance walks expected these first; they are
second, after the money left over, which moves the answer more (Jamie 70 → 89, Casey 67 → 90).

### Review fixes (2026-11-12, round 1; tests `tests/levers-before.test.mjs`)
- **"Before your change" only after a change (B6).** The line is drawn when the answer's words moved (the age, or with both
  lasting the money left rounded as said), when the headline turned, when a number the person sets changed, or when the tax on
  money at work moved (L6). A balance update, a renamed account or a $20 bill that moves nothing draws none. The money left over
  while not answered is a result of every bill and pay change, never "You changed" (`valuesOf` gives it the compare value "not
  counted"; `changedKeys`).
- **Said as what it is (F5).** The line reads "If markets do as well as average, before your change: runs out at 70. Now: runs out
  at 74." The headline is the bad-run answer ("It lasts in most cases, not all") while the line is the average one, so it says
  so. When the headline itself turned, its own words come first: "Before your change: It lasts in most cases, not all. Now: The
  money lasts." While the new headline is still being checked against bad years, a grey bar as wide as the longest headline holds
  its place and the words fill it when they come (the paragraph keeps its height). A run-out year that moved is not a turned
  headline (the age line says it).
- **Where the person lands (F3).** Arriving back after a change made elsewhere (a link from the card, Back), the same sentence is
  the first thing in the card, as a green notice, and the card scrolls it into view after the first paint unless the hero's own
  line is on the screen. The row that changed is listed first with "You just changed this: none → $2,040 a year.", even when it
  now moves the answer by less than a year. A redraw after a save on this page (the same route object) does not repeat it there.
- **Taps held after the filled button scrolls (B4).** "Check the numbers behind this ↓" scrolls the card under the finger; for one
  second, and while the page still glides plus 0.4 s, a press or tap on the page is let go (capture-phase listeners for click,
  pointerdown and mousedown on the page's root), so the second tap of a double tap never follows a row's link.
- **No pay stub link yet (B8).** The work row's "Read it from a pay stub ›" is left out until the reader reads a "ROTH 401K" line
  apart from the pre-tax one (L7, another track): today's reader would put Roth money on the pay-the-tax-later row.

### The rows (`leverList`; each skipped when it does not apply)
| key | when | value and tag | the change tried | action |
|---|---|---|---|---|
| `work-saving:<pid>` | pay from a job (`jobPayOf`) and a plan at work (`workPlans[pid].plan`, or a 401(k) of their own, not one from a job left) | own money a month and share of pay; nothing going in: Yours if a row says $0 ("None"), Our guess if the amount is our guess, else Not counted | nothing in: `usualShare` × pay a month (to the cent, what typing it as a share on Contributions saves) plus the usual match at that share (none when the person said no match); under 6% with a guessed match: 6% of pay with the usual match at it; else 1% of pay more, match as it is; never past the year's 401(k) limit (`workAlt`) | "Type what goes in ›" (`#/retirement/contributions?add=<pid>`); "Read it from a pay stub ›" waits for L7 (today's reader reads a "ROTH 401K" line as pay-the-tax-later money) |
| `match:<rowId>` | a row at work with own money in | `employerMatch`; Our guess (ledger), Yours (typed, or `workPlans[pid].match === false`), Not counted (0, never asked) | the usual match on the person's own money at work (`usualMatchAt`: the guess's own formula and rounding, Work benefits' typed tiers when there are some); none when it is already that | "Check the match ›" (`?match=<rowId>`) |
| `leftover` | Next best action's `leftOverOf(spare)` ≥ $50 a month and someone still works, or an answer on file | not answered: $X a month, Not counted ("worked out from bills that are partly our guesses" when they are, D-B5); answered: what was said and the row it wrote, Yours; asked again: "You said in March 2026 that $500 a month is invested. Left over each month now: $900. Still right?" | not answered: the amount rounded down to $10 as a monthly row of the lead earner into a new $0 brokerage account (taxable) / savings account (cash rate), written exactly as the answer saves it (`applyLeftover`), plus "As it is, counted as spent"; answered "invest" with more left over: the rest invested too; "bank": the same row invested instead | "Answer" (in place, L4), "Change my answer"; asked again: "Still right", "Answer again" |
| `spending` | always | the figure a month and where it comes from; Our guess (`retirement.spendingMonthly` in the ledger or `retireAuto`), else Yours | 10% less, saved with `saveSpendingFigure` on the copy, as Retirement settings saves it; a smaller figure that comes out worse (gap 8, the loans a typed figure holds) shows no effect line | "Change ›" (`?type=spending`) |
| `stop:<pid>` | the adult still works (`workingNow`) | `retirementAge`; Yours when typed on People, else the Assumptions tag | +2 years, at most 75 | "Change ›" (People) |
| `ss:<pid>` | a Social Security figure on file | monthly at the claim age; Our guess (`guide.setup.ssWrote`), else Yours | claimed at 70 when the claim age is under it and not yet claimed | "Type yours ›" / "When ›" |
| `growth` | always | stocks 7% (bonds 4%); Usual or Yours | Careful 6% and Hopeful 8% for stocks (L5's presets) | "Check ›" (`?show=returnStocks`) |
| `prices` | always | inflation 3%; Usual or Yours | 2.5% and 4% | "Check ›" (`?show=inflation`) |
| `plan-to` | always | each adult's plan-to age; Yours when typed for a person, else the Assumptions tag | +5 years (Assumptions' plan-to age, or each person's when typed) | "Check ›" |
| `mix` | the fold only | stocks 70% now / 50% once retired; Usual at the schema's defaults | once retired ±20 points (Sensitivity's `NUDGE.mix`) | "Change ›" (opens Retirement settings) |
| `nothing-saved` | `savingsUnknown` and no plan at work | "Nothing is saved for retirement yet, and nothing goes in." Not counted | none | "What you save for retirement ›" |

On a `savingsUnknown` plan only the Not counted rows show, said as questions ("If it were invested: it would last to the end
(age 95)."). Every effect is a copy of the plan with that one change, through `buildInputs` and `project` (said = done: the tests
build each copy by hand and compare); the plan given is never changed (deep-frozen in the tests). `levers.js` never imports
Next best action (it imports `savingVerdict`: a loop); the view hands in `spare`, worked out once per plan state.

**Cost.** One projection per change tried: 12 to 18 on the phone-built households, 30 to 400 ms in Node on this machine
(`buildInputs` 8 ms is most of it), sliced into 24 ms steps after the first paint, remembered for the visit. Next best action's
month (about 80 ms) is worked out once per plan state for the hero line.

**Figures on the phone-built households (2026-11-11, engine at fa2026e).** Jamie: runs out at 70; invested leftover 89, in the
bank 81; a usual match (about $2,040 a year on 4.7% of pay) 74; stop at 67: 78; stocks 6% / 8%: 69 / 71. Casey: 67; 6.6% of
pay plus the usual match 88; leftover 90 / 80. Assumptions → stocks 6% → Save → Back: "Before your change: runs out at 70.
Now: runs out at 69." (the spec's "66" was the builder variant's.)

**Where the links land (L3).** "Type what goes in ›" and "Check the match ›" open the row on Contributions on its box
(`workLanding`, `matchLanding` in `levers.js`); a $0 row is filled in with the change the card ran, so saving it gives the
answer the card said (Casey: 88). The notice after the save says "Your retirement answer: now runs out at 88 (was 67)." See
`contributions/README.md` "Landings, the match check, and the answer after a save".

## The money left over each month, answered in place (2026-11-11, owner's request; spec part B, L4; tests `tests/levers.test.mjs` "L4 ...", `tests/leftover-invariance.test.mjs`)
The owner asked whether the money left over each month is invested, and to count it the way the person says. Until now the
projection added the future left-over to no bucket (cash included) and said so nowhere on this page. The card's `leftover`
row now has **Answer**, which opens the question under the row, in place:
- "What happens to the $1,828 left over each month?" with three chips: **Invested for later**, **It stays in the bank**,
  **It gets spent / not sure**.
- Invested or in the bank: "Into which account" (the household's brokerage accounts, or savings accounts for the bank, and "A
  new account: Investments for later" / "Savings for later") and "How much a month", filled with the left-over rounded down
  to $10 and the person's to change (never more than is left over). With the emergency fund below its target
  (`balance/liquidity` `gap`), invested first says "Your emergency fund is $G short. Many people fill that first; count only
  what goes into investments."
- **Save my answer** (the panel's one filled button) writes it with `levers.js` `applyLeftover` through one `store.update`;
  the card then opens on the notice "Saved: $1,820 a month into Investments for later (a new account at $0, on Net worth).
  Your retirement answer: now lasts to the end, ... (was ...)." (`answerChangeWords`, the answer before kept in a
  module-level `leftPending`), scrolled into view and focused.
- Answered, the row reads "$1,820 a month into Investments for later, invested (you said so)" (Yours), with what investing the
  rest would do when more is left over, and "Change my answer". "It gets spent" keeps both effects ("If it's invested ... If it
  piles up in the bank ...").

**Formulas.**
- The left-over is Next best action's `leftOverOf(spare)` (handed in by the view, as for L2). After an "invested" or "bank"
  answer, Next best action's `spare` already takes the new row off (`con.yearly`, all rows), so the left-over the question was
  about is `total = leftOverOf(spare) + the row a month` (`leftoverStanding`): nothing is counted twice, and the Dashboard's
  left-over drops by the amount (test: NBA `spare.monthly` after = before − amount).
- The row: `{ id: "leftover-<n>", accountId, personId: lead earner, amount, period: "monthly", employerMatch: 0 }`; a new
  account `{ id, name, type: "brokerage" | "savings", balance: 0, asOf: today, ownerId: lead earner, history: [] }`. The engine
  adds it while the lead earner works (`core/math/retirement.js` contributions: `personIndex`, stopping at that person's
  retirement age) and raises it with pay like every row; a brokerage row lands in the taxable bucket, a savings row in the cash
  bucket at `returnCash` (tests).
- Said = done: the card's effects are worked out with `applyLeftover` on a copy, exactly as the save writes it; the tests save
  the amount the form offers and compare the verdict with the card's (Dana & Lee, Jamie; invested and in the bank).
- Asking again (D-B6): `on` more than 365 days ago, or `|total − monthly| / monthly > 25%`.

### Review round 2 (2026-11-13, the findings of the review of 2026-11-12 by their ids; tests `tests/levers-leftover.test.mjs`)
- **The left-over is the Dashboard's (M1).** The row, its effect lines, the hero's "not counted yet: the $X left over", the
  panel's amount and its cap all read Next best action's `spare.monthly`: the left-over after the goal saving, with uneven pay at
  what the plan counts on (the Dashboard's "Left over each month"). The spec's table named `leftOverOf(spare)` (the goal saving
  put back, at the month all uneven pay comes in): investing that spent the goal money twice, and the Dashboard then said "More
  goes out than comes in" (Priya & Tom: $5,861 asked about, $4,861 left over, -$999 after). Under $50 there is no row and
  nothing "not counted" (07 and 12 of the qa households, short after their goals). Tested on the 02, 01 and family plans: after
  investing the prefilled amount the month is $0 to $10 ahead and "Spend less than you bring in" stands as it did.
- **In the bank is not saving out of pay (M3).** A row into a checking or savings account stays in checking and savings for
  every page but this one: contributions' `compute` leaves it out of its saving sums (`isBankAccount`; `contributions/README.md`),
  so the Dashboard's "About $6,400 a year builds up in checking and savings", the emergency fund's date and Benchmarks' saving rate
  stay as they were (Morgan, tested); the projection counts it in the cash bucket, as the card said. The left-over the question is
  about is then the month's own (`leftoverStanding`: an invested row is put back, a bank row is not), and the notice says "$530 a
  month stays in Savings for later, counted for later". "Kept in the bank" or "invested" is read from the row's account (B10).
- **More counted than is left over (B3), or an account gone (B7).** When the answered row is more than the month has left over
  now (a bill added since), the row says "You said $1,820 a month is invested; only $1,128 is left over now." with "Lower it to
  $1,120" (to $10) and "Answer again", never "Still right"; with nothing left over, "Stop counting it". When the account the row
  went into was deleted on Net worth, the row says it is still counted and offers "Stop counting it" (`lowerLeftover`, which at
  0 takes the row and the answer out: the answer from before, tested). The effect lines say what each does ("Lowered to $1,120 a
  month: ...", "No longer counted: ...", "As it is counted now: ..."). The panel never starts above what is left over.
- **One value for what the person said (N6).** The row compares by the answer and its amount whatever the card is asking just
  now, so a bill that makes it ask again is not "You changed the money left over ($1,820 a month invested → $1,820 a month)",
  and neither is "Still right"; a value that reads the same before and after is never a change (`changedKeys`; tested in
  `tests/levers-review2.test.mjs` with B5 and M5, which need the tax split).
- **The words after an answer (P6, M7, F6, B11, P16).** An answer that lasts both times is never said with "still" (the headline,
  which also looks at a bad run, may have turned: when it did, its own words come first, "Before: It lasts in most cases, not
  all. Now: The money lasts."); after "We don't know yet" only the new answer is said, never a "was" the page did not say. The
  notice is brought into view in the same drawing, so the shell does not repeat it in a note over the row just answered.
  "Answer" only opens the question (a second tap finds it open); its Cancel closes it. "$167 a month more is left over" is
  followed by "If $160 a month of that were invested too" (one figure, the tried amount in its own words), and "Still right"
  says "when the $X left over changes by a lot".

### Decisions (spec rv/spec.md part B; binding)
- **D-B1. Default unchanged.** Not counted until the person answers. No silent change to anyone's answer, the same choice as
  left2.
- **D-B2. Until answered, show both effects.** For example: "If it's invested: lasts to 90. If it piles up in the bank: lasts to
  79. As it is, counted as spent: runs out at 70."
- **D-B3. Whose row.** The row's `personId` is the lead earner (goal-seek's `leadAdult`; here `workingNow`'s lead), so it stops
  at that person's retirement age. It grows with pay raises, as every row does (`core/math/retirement.js`).
- **D-B4. The cushion first.** If the emergency fund is below its target (`balance/liquidity`), the answer screen adds: "Your
  emergency fund is $G short. Many people fill that first; count only what goes into investments." It is advice, not a formula,
  and the person sets the amount.
- **D-B5. When it rests on our guesses.** If the leftover rests on guessed spending (`guessesTouching(plan, "expenses")`), the row
  says "worked out from bills that are partly our guesses".
- **D-B6. Asking again.** Ask again when the answer is more than a year old, or when the leftover has moved more than 25% from
  the amount answered. The wording: "You said in March that $500 a month is invested. Left over now: $900. Still right?"
  (on screen with the year: "You said in March 2026 ...", and "Left over each month now").
- **D-B7. Contributions' account list.** "Into which account" also lists a checking or savings account that a row already uses,
  so a "stays in the bank" row can be edited. New rows into cash accounts are made only by this answer.

**Builder's choices (2026-11-11).**
- The answer is `retirement.leftover` (optional; `docs/DATA_MODEL.md`); no page's compute reads it for a figure, so a plan
  without it gives the same output on every page as before, and a "spend" answer changes no figure anywhere
  (`tests/leftover-invariance.test.mjs`: every module's compute on every qa fixture, the 14 households and the five phone-built
  ones). An "invested" answer counts only through its ordinary row.
- One reader, in words only (merged with claude-c's left2, 2026-11-12): this page's compute leaves out its note "You said about
  $X a month is left over. That stays in checking and savings and is not added to your retirement savings here" while
  `retirement.leftover.rowId` is set ("Left2 merge", B3 above; `tests/left2-merge-items.test.mjs`). An "invested" or "bank"
  answer writes that row, so the note goes once the person has said where the money goes; a "spend" answer has no row and the
  note stays. No figure moves either way.
- The spending row after the same merge: since left2's B1 a figure typed over today's bills keeps the loans those bills hold,
  so "10% less" no longer comes out worse. Checked on the five phone-built households, the family and the 14 qa households'
  base plans, before the rebase and after: every answer and every other row reads the same; the spending row now shows its
  effect line where it was hidden (5 of the 14, for example "$4,977 a month (10% less): runs out at 73.") and is a year or two
  better on 2 more, which moves it up the list there. The rule that hides a smaller figure that comes out worse stays as a guard.
- An "invested" or "bank" answer whose row was removed (on Contributions, which also removes the answer, or anywhere else) reads
  as never answered: the card asks again and every figure is as before the answer.
- "Still right" dates the answer today and keeps it for the left-over as it is now; "Answer again" opens the same question with
  the row's own account and amount.
- For claude-c (WORKBOARD): left2's note "a typed leftover is not added" must not show once `retirement.leftover.rowId` names a
  row that exists. For claude-a: `balance/projection` reads the retirement projection, so it follows the new rows with no edit.
- Safari: a phone not on the Home Screen loses `github.io` storage after 7 days without a visit (docs/PLAN.md), the answer with
  the plan; nothing here promises it is kept.
- **A fold on the card says what of the person's it holds (the final review F4, 2026-11-13; test `tests/levers-leftover.test.mjs`
  "F4 ...").** "N more numbers" adds how many of its rows are the person's own, in the words of the line under the answer: "6
  more numbers, 2 you gave us" (Jamie with growth 6% and prices 3.5% saved on an earlier visit: both rows folded and the line
  said nothing). The card folded on track says "1 not counted" instead of "12 numbers" when it holds a row not counted yet (the
  family's money left over, "If it's invested: lasts to the end, with about $4,455,000 more left").

## On your hopeful return (2026-11-11, owner's request; spec L5)
With a stock return above Assumptions' Hopeful figure (8%, `system/assumptions` `hopefulReturn`), the hero says so under its
headline: an amber tag **"on your hopeful return"**, "Stocks grow 9% a year in this answer: higher than any forecast we know.",
and "Check it ›" to the stock box on Assumptions. It is drawn with the hero (no movement once drawn; measured). The growth and
prices rows of "What this answer rests on" try Assumptions' own chips (`RETURN_PRESETS`, `INFLATION_PRESETS`), and Assumptions'
Save (`saveAssumptions`) gives the answer each row shows (tested). A return above the middle figure never making another page's
answer better is L10 (2026-11-13, below).

## When the tax is paid, said honestly (2026-11-11, spec part C, D-C3, L6)
The projection does not model tax in working years, so moving money from pay-the-tax-later to a Roth 401(k) always looks better
here than it is. After such a change (the money going into Roth 401(k) rows moved), "Before your change" adds "You changed when
the tax is paid on money at work. This answer does not count the tax that paying later saves you each year, so paying now looks
better here than it is." Retirement contributions shows this year's federal tax and the mix at retirement instead of an answer
(`levers.js` `mixAtRetirement`, `mixWords`). Since L9 (2026-11-13, below) the match on a Roth row counts as pay-the-tax-later.

## Review round 2 and simple first (2026-11-13, the findings of the review of 2026-11-12 by their ids; tests `tests/levers-before.test.mjs`)
- **The card shows three rows (simple first, owner 2026-11-12).** The first view of "What this answer rests on" is its intro in
  one sentence ("The numbers this answer uses, whose each one is, and what one change would do if markets do as well as
  average.") and three rows; the rest are one quiet tap away under "N more numbers". A row that is **not counted yet** (a match
  missed, nothing going in, the money left over: a hint worth money) is never folded, nor a row the person just changed or just
  answered; with more of those than three they all show. The grey placeholders are drawn at that count, so nothing moves.
  "Also counted (the change we tried on each moves the answer by less than a year): ..." names the rows hidden by D-A2 (P15:
  "each moving the answer by less than a year" read as "the match hardly matters").
- **"Before your change" is one sentence (P12).** The hero says the headline's turn in its own words, or the average-market
  answer before and now; what was changed and the note on the tax paid now are one tap away under "What changed". The card's
  notice, where the person lands coming back, still says it all.
- **The settings open in place (N4, P7).** The spending row's "Change ›" is a button that opens Retirement settings on this page
  at the box (never a link to this page's own address, which drew the page again from the top so that a second tap followed
  whatever link passed under the thumb). The settings open on the spending box and "Save settings"; the six others (stocks now
  and once retired, how tax is worked out, its rate, how much to take out, the rate) are under "More settings (stocks, tax, how
  much to take out)", whose line says "as usual" or "N changed" (and "N to save" while a box under it holds a figure not saved
  yet); the mix row's "Change ›" opens that fold too. After "Save settings" the notice says what it did to the answer
  ("Retirement settings saved. Your retirement answer: now runs out at 73 (was 70).") and stays; a plain one goes after 4
  seconds. A save that changes settings under the fold names them first (the final review F3): "Retirement settings saved: share
  in stocks now 70% → 85%; how tax is worked out: the federal brackets on each year's income. Your retirement answer: ...".
- **Taps held only at the spot (N7).** After a tap that scrolls the page under the finger (the filled button, "Change ›", the
  mix), a second tap within the hold is let go only when it lands within 48 px of the first: the person's next tap elsewhere on
  the card goes through.

## The match on a Roth 401(k) row (2026-11-13, L9; spec part C, D-C2; tests `tests/match-roth.test.mjs`)
- **The rule.** A contribution row into a `roth` account that carries an employer match (a Roth 401(k): `limitKind` reads a
  match as the sign of one) gives the engine two rows: the person's own money, `perYear(amount, period)`, into the Roth bucket
  (`free`), and the match, `employerMatch` a year, into the pre-tax bucket (`deferred`), with the same person, name and stop
  (`untilYear`). The match part has required withdrawals like any pre-tax 401(k) money (no `rmdExempt`; only a Roth 401(k)'s
  own Roth money has none from 2024, SECURE 2.0 section 325). Until this date the match went Roth with the row and grew tax-free.
- **Why.** Only what the employee designates is Roth (IRC 402A(a)); an employer match is pre-tax unless the plan offers Roth
  matching and the employee designates it, which SECURE 2.0 section 604 allows for contributions after 2022-12-29, and then
  "a designated Roth matching contribution ... is includible in an individual's gross income for the taxable year in which the
  contribution is allocated" (IRS Notice 2024-2, Q&A L-1 to L-3: the employee's own irrevocable choice, at least once a plan
  year, and only when fully vested). Most plans pay the match pre-tax, so the default is the law's default. Read 2026-11-13:
  Notice 2024-2 (irs.gov/pub/irs-drop/n-24-02.pdf), IRS fact sheet FS-2024-29, Aug. 2024 (irs.gov newsroom, "SECURE 2.0 Act
  impacts how businesses complete Forms W-2"; the title "... changes affect how businesses complete Forms W-2" is the earlier
  FS-2024-18, cited here by mistake until the critic's review of 2026-11-13).
- **`matchRoth: true`** on the row (optional, DATA_MODEL) says the person's plan pays the match as Roth: on a Roth 401(k) row the
  whole row is Roth, as before; on a pre-tax 401(k) row (a `401k` account) the row's own money stays pre-tax and the match goes
  into the Roth bucket, with no required withdrawals. Either way the Federal estimate counts the match as income this year
  (taxes/federal README). The choice is the person's for the match itself: IRC 402A(c)(1) as amended makes a match Roth when
  "the employee designates" it, and Notice 2024-2 section L does not tie that to their own money being Roth (critic-law 5,
  2026-11-13; until then `matchRoth` on a pre-tax row did nothing). `matchRoth` on a row with no match, or on a row into an
  account that is not a plan at work, changes nothing. No page writes it yet (retirement/contributions' question "Your plan
  puts the employer's money in as Roth" is for its owner, D-C2); the engine and the tax already follow it. Worked by hand
  (`tests/match-roth.test.mjs`): the family fixture's Ana puts $470 x 26 = $12,220 a year into her pre-tax 401(k) and gets a
  $3,050 match; with `matchRoth` the engine rows are $12,220 pre-tax and $3,050 Roth (before: one row of $15,270 pre-tax), and
  the federal tax rises by 0.22 x 3,050 = $671 (the family's taxable income stays in the 22% band).
- **The projection still does not count working-year tax** (D-C3): a Roth match's tax this year is on the Federal estimate, not
  in this answer, as for the Roth row itself.
- **Worked by hand** (family fixture, Bo's Roth row at work: $300 a month of his own money and an employer match of $1,800 a
  year): first-year engine rows, own money $300 x 12 = $3,600 Roth and the match $1,800 pre-tax (before: $5,400 Roth); every
  later year both rise with pay (3%). In average markets nothing is spent or taxed before retirement, so the total at
  retirement is the same and only the mix moves: 77% pre-tax and 23% Roth before, 83% and 17% now; the most the plan can pay
  for falls from $8,695 to $8,656 a month (flat tax: the match now pays 15% when it comes out) and the end money from
  $1,021,470 to $1,003,521 in today's dollars. With `matchRoth: true` every figure is as before, and this year's federal tax
  rises by 0.22 x $1,800 = $396 ($14,112 to $14,508).
- **What moved.** No qa household and no qa fixture has a Roth row with a match (`tests/match-roth.test.mjs` checks it), so no
  answer there moved: every module's compute over the fixture, archetype, phone and retype plans, and Will the money last? and
  the Federal estimate over all 1,434 qa plans, are byte-identical to 1cf9f0a. The retirement and federal answer keys
  (`tests/golden/retirement`, `tests/golden/taxes`) have no such row either and pass unchanged.

## A hopeful return never makes the answer better on its own (2026-11-13, L10; spec section 5, risk 1; tests `tests/hopeful-verdict.test.mjs`)
- **The rule.** When the plan's stock return is above our middle figure (`MIDDLE_RETURN`, Assumptions' "Middle 7% (ours)",
  `RETURN_PRESETS`), or its bond or cash return is above the plan's own default (4% and 2%, Assumptions' `def`; they have no
  presets), `middleOf(d)` works out the answer on the middle figures: the same inputs with each return above its middle figure
  put back to it (a return below it stays, the careful side being the person's to choose), one run in average markets and the
  most it can pay for (`affordableSpending`), judged by this page's own rule (short if it runs out, tight under 1.15 times the
  spending, else on track): `{ returns: { stocks, bonds, cash }, raised, verdict, shortYear, shortAge, affordable }`, or null
  at the middle figures or below.
- **Bonds and cash too, and only when asked** (critic-engine F2 and F8, 2026-11-13). The first version looked at stocks alone,
  so a bond return typed at 7% (the same Assumptions page allows up to 20%, with no preset and no warning) turned Robin's "runs
  out at 94" into "lasts, just" and Dana & Lee's "tight" into "on track" on every page; with stocks at 9% and bonds at 9% the
  "middle" answer kept the 9% bonds. Now every return the person can type is held to its middle figure. And it was worked inside
  every `compute` (as `compute().middle`) above 7%, a second run and a second search for the most the plan can pay for, which
  doubled to quadrupled the cost of every page that runs the plan and never reads it (projection compute 26-50 ms became
  105-139 ms on the family plan in brackets mode at 9%); `middleOf` works it once per answer (kept for that answer object) for
  the two readers that need it, `savingVerdict` and this page's sentence, so `compute`'s output and cost are what they were.
- **Who follows.** `savingVerdict` (the plan's answer for other pages) gives the middle figures' answer whenever it is worse
  (`middleWorse`: a lower verdict, or running out at an earlier age), with `heldBack` (what the plan's own returns say, `returns`
  with all three) and `onMiddle` (always, above a middle figure). Its readers: Next best action (the IRA step is no longer "Optional: your plan
  already lasts"), Benchmarks ("By your own plan ..."), the guide's "What would help" step, and `drawingAsPlanned` (a retired
  household living on savings is "the plan working" only if it lasts on the middle figure too). This page keeps the answer on the
  person's own return (L5's tag "on your hopeful return" above 8%) and says the middle figure's answer under it when it is worse
  (`middleWords`): "With stocks at our middle figure, 7% a year, the money lasts, but only just. A higher return alone does not
  make a plan safe." (or "runs out at 82", or "runs out at 89, not 94"), so the pages that go by it point to a page that says it.
  It names what was put back: "With bonds at our middle figure, 4% a year, ..." or "With stocks and bonds at our middle figures
  (7% and 4% a year), ...".
- **Decision (mine, the owner's rule "never stop to ask"): any improvement, not only green.** The request was "never turns an
  answer green"; I hold back every better answer, because `drawingAsPlanned` and Benchmarks treat "tight" as "it lasts" (Robin,
  short at 94 on 7%, reads "lasts, just" on 8%), and an earlier run-out age is the same kind of help from a return nobody can
  choose. Above the middle figure means above 7%, so the Hopeful chip (8%) is held too; L5's amber tag stays above 8% only.
- **Not followed yet (not this lane's files).** The Dashboard, the reveal and Your plan (overview/setup `standing`), Quick
  answers, Health score, Plan summary, the Contributions hero, Goal seek's and What matters most's heroes, the Cash flow, How
  much to take out and the tax report read `compute().verdict` itself, the person's own return. Each can read `savingVerdict`
  (or `middleOf(d)` / `middleWords(d)`) to follow; listed for their owners in the build notes. Changing `compute().verdict` here instead would
  have moved this page's own headline, chart and bad-run lines off the person's return, against L5's tag.
- **Worked by hand** (the phone-built Dana & Lee, `qa/fixtures/phone-households.mjs`, today 2026-11-13): they plan to spend
  $58,680 a year. On 7% the plan can pay for $63,333: 63,333 / 58,680 = 1.079, under 1.15, so tight. On 9% it can pay for
  $67,987: 67,987 / 58,680 = 1.159, so on track on this page. Next best action, Benchmarks and the guide now get "tight" with
  $63,333 (before: on track, $67,987), and the IRA step no longer says the plan already lasts.
- **Worked by hand, bonds** (Robin, phone-built, stocks 7% and bonds 7%): the page says tight ($38,307 a year for $36,120,
  1.06); on 4% bonds the plan runs out at 94 ($35,836), so other pages get "short at 94" and the page adds "With bonds at our
  middle figure, 4% a year, the money runs out at 94."
- **What moved.** No qa household or fixture has stocks above 7%, bonds above 4% or cash above 2% (the defaults; every plan
  keeps them), so no answer there moved: every module's compute over the fixture, archetype, phone and retype plans, and Will the money last?, `savingVerdict`
  and the Federal estimate over all 1,434 qa plans, are byte-identical to the commit before. The retirement answer key has no
  row above 7% with a verdict, and passes unchanged.

## Retyping the spending, and pay before the household retires (2026-11-13, L11; spec gap 8 and defect A; tests `tests/retype-and-pay.test.mjs`)
Both were fixed by claude-c's left2 commit (cb820f2, 2026-11-12: its B1 with fix round 1's B-1 and B-3, and its B2) before this
lane reached them, so L11 first only checked the two rules across the qa plans (left2's own tests read one plan each) and
recorded what was decided; the new tests fail on fe678cb, the code the spec read. The critics' review the same day (rv/eng/
critic-law.md, critic-engine.md) found defect A still there in a working year with a required withdrawal, the required
withdrawal counting money put in that year, a cliff where a typed figure stops holding its loans, and three rules that wait for
the owner (the switches below); those are fixed here, tests in `tests/working-and-retired-years.test.mjs`, each failing first.
- **Gap 8, typing the same spending figure never flips the answer.** A figure typed while the plan reads today's bills is those
  bills scaled to it (`retirement.spendingFrom: "expenses"`, written by `saveSpendingFigure`; the loans and health cover the bills
  hold are held at figure / bills total, at most 1). Worked by hand (Dana & Lee built through Get started, reading bills of
  $6,430 a month): typing $6,430 gives 6,430 / 6,430 = 1, the same loans and cover, so the same answer, tight (1.06); before
  left2 the mortgage was spent for life, short at 77. Typing $5,500 is now on track (it was short at 90). Over the qa plans
  (fixtures, archetypes, phone-built, retype) the bills' total typed keeps every verdict, 10% less is never worse, and Get
  started's own figure saved again changes nothing. Over all 1,434 qa plans (a scratch sweep, too slow for the suite) every
  verdict holds; only 14 plans whose ratio runs to six figures or more (trillion-dollar balances, a retirement age past the
  plan's end) move that ratio in its fifth figure.
- **"retireHeld set consistently".** The two markers are separate and each is written in one place: `guide.setup.retireHeld` for
  a figure typed over Get started's own (written where `retireAuto` goes false, here and in Get started's box), and
  `retirement.spendingFrom` for a figure typed over today's bills; both go when the box is cleared, and `retireHeld` wins when both
  are there (buildInputs). The test pins all three moves. **Left for its owner:** Compare's "Spend in retirement" lever
  (scenarios/compare `LEVERS`) writes a figure into its copy without `spendingFrom`, so on a plan reading today's bills a
  scenario typed at the bills' own total spends the loans for life (family fixture reading its bills: $2,303,256 left at the
  end in today's dollars; the bills' own $5,826 a month typed in a scenario: $1,557,580). Its setter calling `saveSpendingFigure(p, v, null)` gives both
  markers; not this lane's file.
- **Defect A, the tax on pay before the household retires.** In a working year the year's guaranteed income (a partner's pay, a
  pension or Social Security already paid) pays its own tax first, so savings pay no tax on it (left2 B2, core/math/retirement.js
  `fixedWant`). **Also in a year with a required withdrawal** (critic-law 1 and critic-engine F4, 2026-11-13): until then the
  whole year's tax, the income's included, came off the required withdrawal (`surplus = netOut - need - taxes`), so the pension's
  and Social Security's own tax came out of savings after all. Now the month's income pays the tax on it alone (`tMonth`, worked
  with the same tables), and a required withdrawal (or any withdrawal for a one-off) pays only the tax it adds on top
  (`taxes - tInc`); what is left of it goes back into savings. Worked by hand (the family fixture with Ana 61 at work to 65, Bo
  75, retired, with a $3,000 pension and $2,900 of Social Security a month on Income and $300,000 in his old 401(k), brackets
  mode, 2026; critic-law case 3b): Bo's required withdrawal 300,000 x 0.7772 (his share) / 24.6 = $12,195.12; the year's tax
  $3,428.12; the tax on the pension and Social Security alone $1,014.00 (taxable income $10,140 at 10%); so the withdrawal's own
  tax is $2,414.12 and $9,781.00 goes back (it was 12,195.12 - 3,428.12 = $8,767.00). Over all qa plans in their own tax mode and
  in brackets mode, 3 runs have such a year (the "retirement past the plan's end" variants of 04, 06 and 13); with the partner
  pay rule off they move only there (rv/eng/fix.md). Worked by hand (family fixture, Bo working to 75, brackets mode, 2026): his pay $5,200 + $600 a month = $69,600;
  married filing jointly, less the $32,200 standard deduction, $37,400 is taxed: 10% of $24,800 + 12% of $12,600 = $2,480 +
  $1,512 = $3,992, paid from that pay; savings are $223,832 at the end of 2026 in both tax modes (before left2: $3,992 came out of
  savings, $219,760, and the most the plan could pay for fell from $10,658 to $9,571 a month; now $10,331 in brackets mode, the
  rest of the difference being the tax in retired years). Across the qa plans in brackets mode no working year with income draws
  on savings beyond a required withdrawal unless it has health cover or a one-off.
- **Defect A, "pay before the household retires is dropped": decided, no change (mine, the owner's rule "never stop to ask").**
  Before the household's retirement year the engine adds only saving rows: pay, a partner's pay, a pension or Social Security
  paid then are today's month, which also pays today's bills. What is left of that month is counted when the person says where
  it goes (the leftover answer, L4: an ordinary saving row), the owner's default D-B1 ("not counted until the person answers").
  Adding that income to savings as well would count it twice: once through the leftover row and once here, and against no
  spending. Over the 1,434 qa plans every income line paid in a working year is on the Income page (264 plans with a partner's
  pay, 95 with a pension, 95 with Social Security), so the month holds it. **Not in today's month** (critic-law 2 and the engine
  critic's note, 2026-11-13; the sentence here said "the month holds it once it starts", which was not true: the month is
  today's): pay that starts later (05-stay-at-home-parent's "returns to work", $3,200 a month from 2027) and a pension or Social
  Security that starts after today or is on the Pensions or Social Security page only. Pay that starts later stays out (a new
  job changes the month: the person says what is left of it then, and counting its whole pay would be far too rosy). A pension,
  or Social Security for someone who has stopped work, is new money: behind the owner's switch `newIncomeSaved` (SWITCHES,
  below) it goes into savings after the tax it adds once it is paid, before the household retires; Social Security for someone
  still at work stays out (the earnings test holds much of it back before full retirement age). Off until the owner says yes,
  because Financial independence's own test holds the family's $12,000-a-month earliest age at 75 with it left out (72 with it:
  Bo, retired at 65, claims at 67 while Ana works on); no qa household has such a line (rv/eng/fix.md). Worked by hand (critic-law
  case 4: Ana 58 at work to 66, Bo 63 retired at 62 claiming $2,900 a month at full age at 64): $27,840 a year from 2027, $28,675.20
  in 2027 at 3% prices, saved whole in flat mode (and in brackets mode, as $27,840 of Social Security alone is not taxed); with
  the switch on the money runs out in 2055 at Ana's 87, not 2046 at 78, and the most the plan can pay for is $6,373 a month, not
  $5,530 (claiming at 67: 2058 at 90, not 2049 at 81; at 70: tight, not short at 87).
- **A required withdrawal is worked on last year-end's balance** (critic-law 7, 2026-11-13). Each owner's slice of the pre-tax
  bucket took this year's contributions before the year's required withdrawal was worked out, so money put in during the year
  was counted (L9's match on a Roth 401(k) row made it reachable: a 73-year-old still at work had $115 of a $3,050 match taken
  out the year it went in). Now the withdrawal is the slice as it stood at the end of last year over the factor, as the law has
  it: "dividing the prior December 31 balance of that IRA or retirement plan account by a life expectancy factor" (IRS,
  Retirement plan and IRA required minimum distributions FAQs, read 2026-11-13). Worked by hand (`tests/working-and-retired-years`):
  one person of 75 (factor 24.6, Uniform Lifetime Table) with $100,000 pre-tax who puts in $10,000 that year: 100,000 / 24.6 =
  $4,065.04 (was 110,000 / 24.6 = $4,471.54). No qa plan and no answer key has such a year, so nothing else moved. **Not done:**
  the same FAQ lets a person still at work (not a 5% owner) wait with their current job's plan until they retire; the engine
  holds one slice per person, not per account, so it cannot tell that plan from an IRA, and keeps the withdrawal (careful side).
- **A figure typed just above the loans Get started's figure holds** (critic-engine F6, 2026-11-13). A figure typed over Get
  started's own (`retireHeld`) holds the loans in it until their payoff, and one under their payments holds none (fix round 1,
  D1: taken as typed, for life). At the line between them there was a cliff: $1,262 typed over a $1,261 mortgage was $1 a month
  to live on after its payoff, $1,260 was $1,260 for life, so $2 less typed left $2,020 more at the end (qa fixture guessed-plan).
  Now the loans are held only as far as the figure leaves at least their payments to live on once they end: the share
  min(1, (figure - payments) / payments) of each, so all of them from twice their payments up (every figure the rule held before,
  unchanged) and none at the payments themselves. Worked by hand (guessed-plan, $1,261 of mortgage): $1,262 holds 1/1,261 of it,
  which the mortgage's own tax and insurance (they go on after the payoff) take whole, so $1,262 is spent for life as $1,260 is:
  $141,112 and $141,219 at the end in today's dollars, $107 apart for $24 a year less spent. The critic's suggestion, each loan at
  typed / Get started's figure as a figure typed over the bills is, was tried and left: it moves every figure between the payments
  and Get started's own, and spends more in later years for a lower figure (fix round 1's D1 test, $100 less typed: 2044 spending
  $100,090 against $100,072).
- **The owner's switches** (`SWITCHES` in compute.js, all off; a run turns one on with `params.switches`; no page does). Each is a
  change the critics found right that moves figures other answer keys or other pages' own tests hold, so it waits for the owner's
  yes (rv/eng/golden.md, rv/eng/fix.md):
  - `incomePaysTaxFirst` (critic-engine F1): in a retired year with the same spending every year, the year's tax comes on top of
    the gap (`need`, floored at 0), so income above spending never pays it and savings do. On, income pays spending, health
    cover and the tax first, as the ways that set a withdrawal already do (core/math/retirement.js `fixedWant`). The qa
    archetype 08-retired with every kind of account ($67,200 a year coming in: a $18,000 pension, $25,200 of Social Security,
    $24,000 of rent; $34,560 of spending) runs out at 89 in brackets mode, with $0 as the most it can pay for; on, it lasts.
    It moves `table.0.bracketTop` in seven frozen Roth-conversion keys (roth-conversions-irmaa-010 to -100, $211,400 to
    $100,800), as the Chance page's README already said ("Zero"). Over the 1,434 qa plans, each in its own tax mode and in
    brackets mode (2,774 runs), it moves 344 runs, every one for the better, and 18 verdicts or run-out ages.
  - `newIncomeSaved` (critic-law 2): above, "Not in today's month".
  - `partnerPayNet` (critic-law 4): a partner at work after the household retires: their pay line (`ownSaving`) pays their own
    saving rows (`own`: the row's own money, not the match) in the retired years, so it is not also spent; their pre-tax part is
    never taxed; and in brackets mode Social Security and Medicare tax comes off the pay (`payrollRate`: 7.65% of a job's pay,
    6.2% + 1.45%, IRS Topic 751; 15.3% of 92.35% of a business's, IRS Topic 554; both read 2026-11-13; the 2026 wage base of
    $184,500 and the 0.9% over $200,000 are left out, the careful side for most). Worked by hand (the family, Bo at work to 75,
    the household retiring in 2055): his $69,600 of pay ($5,200 a month of wages, $600 of business) is $164,017 in 2055 at 3%
    prices and his own saving $3,600 x 1.03^29 = $8,484; counted $155,533 in flat mode; in brackets mode less 8.32% payroll tax
    ((62,400 x 7.65% + 7,200 x 14.13%) / 69,600), $141,887, and with his saving pre-tax $155,533 of it taxed, not $164,017. The
    most the plan can pay for: $10,658 to $10,621 a month (flat), $10,331 to $10,208 (brackets). Off because Annuities' and the
    projection's batch 6 tests hold a partner's whole pay (Alex's $72,000 x 1.03^19 in 2045), and over the qa plans it moves 32
    of 2,774 runs, every one for the worse, 16 run-out ages earlier by 1 to 10 years in brackets mode (06-blended-family: Kim's $80,600 pays $6,166 a year of payroll tax
    for 21 years: short at 77, not 87).

