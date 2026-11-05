# Will the money last?  (`retirement/projection`)

**Status:** usable (phase 5)
**Purpose:** Your plan run year by year to the end: what you have, add, receive and spend, and whether the money lasts.

## Inputs
Plan sections read (`needs`): `household` (adults with birth dates; retirement and plan-end ages), `accounts` (balances by tax bucket), `expenses` (fallback spending), `income` (a partner's pay after the household retires; pensions), `retirement` (settings, contributions, Social Security, pensions), `assumptions` (inflation, returns, salary growth). Writes: `retirement` settings (spending, stock shares, tax rate, strategy, withdrawal rate).
`buildInputs(plan, { today })` is the one place the plan becomes engine inputs; every other retirement page calls it.

## Outputs
`ready`, `missing[]`, `notes[]`, `inputs`, `result` (the engine run), `rows[]`, `atRetirement`, `atEnd`, `affordable` (real yearly spending that still succeeds, by bisection), `spendingYearly`, `coverage` (guaranteed income / spending in the first retirement year), `verdict` (on track / tight / short), `shortYear`, `shortAge`.

## The engine (`core/math/retirement.js`)
Yearly, in nominal dollars with a price level for the real view. Buckets: cash (checking, savings, cash; earns the cash rate), taxable (brokerage, crypto), deferred (401(k), IRA, insurance cash value), free (Roth, HSA). Property, vehicles and 529s are left out.
- Working years: contributions grow with `salaryGrowth` until each person's retirement age. No withdrawals (pay covers life).
- From the household's retirement year (the primary person's retirement age): spending by the chosen strategy; guaranteed income (Social Security from the claiming age, pensions, a partner's pay until they retire) offsets it; the gap comes from cash, then taxable, then deferred (grossed up by the tax rate), then free. Required minimum distributions (core/math/rmd.js) force deferred money out from the start age; what is not needed moves to taxable.
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
Not yet: dividends from an account already in the plan are also inside that account's growth (counted twice).
