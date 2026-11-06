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
`module.test.mjs` (inputs from the fixture couple, the run, fallbacks) and `tests/retirement.test.mjs` (the engine: buckets in order, gross-up, RMD, sequences, strategies, affordable spending).

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
- **Rent** (`rental`): for life, or to its end date. Gross: the rental's own costs (property tax, insurance, repairs,
  management) are not taken off, as the Income page and Federal estimate ("before expenses") count it. Netting it against
  the Rental property page's costs is not simple: an Income line and a `property` rental record are not linked, so a
  household with two rentals or one typed twice could not be matched. Type the rent net of its costs if they are not
  already in your spending.
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
