# How much to take out  (`retirement/withdrawal-strategy`)

**Status:** usable (phase 5)
**Purpose:** Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history.

## Inputs
The projection inputs; `retirement.strategy` and `retirement.withdrawalRate`. Writes `retirement.strategy` ("Use this one").

## Outputs
`rows[]` per strategy: `name`, `how`, `from`, `expected` and `worst` (`firstYear`, `lowest`, `highest` real spending, `endReal`, `success`, `failAge`), `first` (the first retirement year: `year`, `rule`, `take`, `spend`, `health`, `other`, `tax`, `short`, `back`, `need`, `income`, `required`, `beforeTax`; said "This year: take about $X from savings; with your $G of income, that pays for ..."), `held` (`null`, `"below-spending"` or `"below-income"`), `under` (the first year below income) and `offer` ("Use this one" is shown); `worstStartYear`, `chosen`, `chosenHeld`. `firstYear(plan)` adds `requiredTax`, `other`, `short`. `guardOf`, `heldWays(inputs)`, `wayOptions(plan)` / `wayOptionsFor(inputs, chosen)` (the ways the Projection page's settings list).

## Formulas
The engine's four strategies (see the Projection README). `worstWindow`: every start year in the Damodaran data run with fixed-real spending; the one that fails earliest, else ends lowest. Sources: Bengen (1994) and the Trinity study for the 4% rule; Guyton and Klinger (2006) for guardrails; the Bogleheads VPW; the FI Calc guide's definitions (vendored).

## No Social Security in the plan (2026-11-01)
When an adult has no Social Security figure and has not said they get none (`overview/setup` `ssMissingFor`, the same check as the
Dashboard's "Retirement: Needs Social Security"), the page opens with a notice from `modules/retirement/ss-notice.js`: "Social
Security is not counted yet, so this page looks worse than it is", a filled "Add Social Security" and an outlined "We won't get
Social Security", which saves the setup's own `guide.setup.ss[personId] = "none"` so it is never asked again. Before, only a
grey sentence at the end of a paragraph said why the plan looked short.

## The answer first: how much to take out (round 4, 2026-11-02)
The hero answers "how much do we take out, and from where?" for the first year of retirement (this year, for a household already retired), from Will the money last?'s own engine with the chosen way of spending (`firstYear`, today's dollars):
- need = spending + one-off costs + the year's tax - guaranteed income (Social Security, pensions, other income), floor 0.
- from savings = everything the engine takes out that year, the required withdrawal included; extra = from savings - need.
- where from: cash first, then the plan's withdrawal order, each named by its accounts.
Three sentences: nothing needs to come out; or income covers the spending but the law still requires a withdrawal (how much, from which account, the tax on it, and where the rest can go, with a link to Required withdrawals); or take about $X, starting with these accounts, which with the guaranteed income pays for the spending and its tax. Then the most the plan can carry (Will the money last?'s `affordable`, to the $100), or where it runs out.
Before, the page showed four "first year" spending figures and no amount to take out. A range whose two ends are equal now reads "spending stays at $X".
Not changed (my choice): the share-of-savings, years-left and guardrail rules still set total spending from the savings alone, as the frozen answer keys in tools/golden_retirement define them, so for a couple with large guaranteed income they can quote spending below it; the hero's figure is the one to act on. Round 8 (below) guards "Use this one" against it; changing the engine is the owner's question.

## Tests
`tests/retirement-pages.test.mjs`: four rows, percent never fails, fixed-real first year equals the planned spending.

## Independent answer key and numeric sources

`tests/golden/retirement/withdrawal-strategy.csv` adds 800 invented rows across
the four spending rules, beginning-year payment timing, source-history window
selection, displayed summaries and missing-input defaults. The exact layouts,
quoted contracts, arithmetic and sources are in
`tests/golden/retirement/briefs/withdrawal-strategy.md`. Generate with
`python tools/golden_retirement/withdrawal_strategy.py`; replay with
`tests/golden-retirement.test.mjs`. Every tenth row has a second asserted derivation.

The independent history comes directly from
[Damodaran's NYU workbook](https://www.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls),
frozen in `tests/golden/retirement/sources/damodaran-1928-2025.csv` to six decimal
places. It uses the labeled stock/Treasury/bill columns and FRED CPI percentage
changes. No production return data or executable formulas are used to generate
the answer key. All household amounts and dates are invented worked examples.

The guardrail factors 1.2/0.8 and spending changes of 10% are the simplified
Projection README model. VPW is withdrawn at the start of the year, before
that year's return, so its payment is the annuity-due amount (ordinary PMT divided
by 1 + the real return): for $100,000 with one year left and a 3% real return it is
$100,000, not $103,000, and the money lasts exactly to the end instead of failing
in the last year (fixed 2026-10-30, F-030; the key's `vpw` rule follows the same timing). Sources: the model's Projection README, the
[FPA Bengen reprint](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf),
and [Bogleheads VPW](https://www.bogleheads.org/wiki/Variable_percentage_withdrawal).

## The most you can spend, carefully (round 5, 2026-11-02)
The answer's last line was "The most you could spend and still have the money last: $X", the average-market figure, which
lasts in about 4 of 10 markets. It now reads "You can spend about $7,800 a month ($93,600 a year) and the money lasts in
about 9 of 10 markets. If markets do as well as average, up to about $100,800 a year" (Monte Carlo's careful figure, filled
in once worked out; until then the average one, named as such).
Review fixes, 2026-11-02: the month is whole $100s rounded down (never more than the year); the sentence is drawn first with grey
bars where its figures go and filled after the first paint (`modules/retirement/careful.js`: on the PC, or here a slice at a
time), so nothing jumps or freezes; with a rule other than steady spending it says "the same every year"; when nothing lasts in
9 of 10 markets it keeps the average-market sentence. The figure is settled on the Chance page's 2,000 paths, the same as on
Will the money last?.

## Health cover in the first-year answer (2026-11-02)
`firstYear` returns `health` (the projection's health cover that year, today's dollars), and the answer says it with the spending: "That pays for the $84,000 you plan to spend, $4,800 of health cover and about $9,000 of tax." `need` already had it (it is among the year's one-off costs, `eventOut`). `healthAdded` (the plan adds cover in some year) makes the two spending figures say "on top of health cover".
Review fix 2026-11-02: with no tax that year the two take one "and" ("pays for the $78,000 you plan to spend and $4,051 of
health cover"); it read "..., $4,051 of health cover." with the "and" missing.

## Round 8 (2026-11-06): what each way takes and spends, and a guard on "Use this one" (widow-1)
A widow, 74, with $50,400 a year of pension and Social Security, $12,000 in checking and $410,000 in an IRA, spending $36,000. The
engine (`core/math/retirement.js`, frozen by `tests/golden/retirement/withdrawal-strategy.csv`) takes the share-of-savings figure,
4% x $422,000 = $16,880, as all of the year's spending and only then counts income against it; "Use this one" set it, and Will the
money last? read "you plan on $36,000" next to "Paid by income 299%" (50,400 / 16,880). Guardrails, starting at $36,000 against a
$422,000 pot (8.5%, over its 4.8% line), cut her spending to $20,986 while her income alone covers it. The engine is not changed
here (the key is frozen; the owner's question is below). What changed:
- Each way's first retirement year, in today's dollars, from its own run with the plan's expected returns (`first`):
  - same spending every year, guardrails (`rule: "spend"`): spend = the year's spending + health cover; take = everything taken
    out of savings that year (a required withdrawal included: "the least the law allows; the rest goes back into savings").
  - share of what is left, years-left (`rule: "share"`), when held: the way's amount read as the withdrawal it is: take =
    max(the way's amount, the required withdrawal), spend = take + income, before tax. The widow: take $16,880 (4.0% of what you
    have saved), with $50,400 of income about $67,280 to spend, before tax. Offered, a share way reads like the spend ways.
- `held`: a way other than the same spending every year is not offered when its first-year spending is under the plan's
  spending figure (`"below-spending"`: percent $16,880 and years-left $24,391 against $36,000) or under that year's guaranteed
  income (`"below-income"`: guardrails, $36,000 against $50,400). The row says why in plain words; a held share way whose
  figures leave the income out does not draw its spending range (it would contradict the line above). When the plan already
  uses a held way, a notice at the top says so and "Same spending every year" offers the way back.
- On the 1,372 qa plans that can run, percent is held on 1,253 (1,246 below spending, 7 below income), years-left on 1,175
  and guardrails on 114 (2026-11-06): 4% of savings is under what most households spend. The engine change below would
  let most of them back.
- Owner's question (the key): read the rate as the withdrawal, not the spending: withdrawal = total x rate (percent), pmt(total)
  (years left), guardrails on withdrawal / total starting from max(0, planned spending + tax - income); spending = income +
  withdrawal - tax. It rewrites `tests/golden/retirement/withdrawal-strategy.csv` (`tools/golden_retirement/withdrawal_strategy.py`).

## Round 8 (2026-11-06): the tax on the required withdrawal (widow-2)
"The law still requires about $16,078 ...; after about $2,412 of tax on it" was the plan's quick flat 15%. `firstYear` now gives
`requiredTax`, what the withdrawal adds to that year's federal tax at the brackets, Social Security worksheet included
(`modules/retirement/rmd/compute.js` `addedTax`, the formula and its sources are in that README): $3,429 for the widow, since it
also makes $13,666 more of her Social Security taxable. The take-out sentence ("take about $X ... pays for ... and about $T of
tax") keeps the engine's own tax, so its sums still add up.

## Round 8 reviews (2026-11-06)
- **The guard looks at every year (review D2, UX 8).** It looked at the first retirement year only, so guardrails stayed offered
  where its own run later planned spending far below guaranteed income: Rae (qa/fixtures/retiree-cases.mjs `guardRetiree`: $45,000
  of income, $50,000 of spending, a $500,000 IRA, a real draw of about 1%) was cut from 2027, $43,689 against $44,563 of income and
  down to $25,468; a qa household to $859 a year under $56,208 of income; 119 qa plans in all. `guardOf`: a way other than the
  same spending every year is held when its first-year spending is under the plan's (`"below-spending"`), or when in any retired
  year of its expected run it plans on less than that year's guaranteed income (`"below-income"`, with `under` = that year, its
  spending and income). The row says it as the planner's limit: "Not offered yet: the planner works this way out as if your income
  were not there, so in 2027 it plans on $43,689 of spending, less than your $44,563 of income, and as low as $25,468. "Same spending
  every year" plans on what you really spend." Only the expected run decides (it is what "Use this one" plans on).
- **Each first line adds up (review D6, D7, UX 1).** The parts of the year, in today's dollars, from the way's own run: `spend` =
  the row's own spending (the figure beside "you spend" is never the spending plus health cover), `health`, `other` (one-off
  costs), `tax`, `take` (all taken from savings), `short` (the engine's shortfall), `back` = take - need - tax, the part of a
  required withdrawal the engine puts back (core/math/retirement.js: `surplus = netOut - need - taxes`). Words: "take about $48,507
  from savings; with your $24,000 of income, that pays for the $60,000 you spend, $5,231 of health cover and about $7,276 of tax"
  (48,507 + 24,000 = 60,000 + 5,231 + 7,276); a year savings run short: "savings have only about $7,286 left; with your $29,808 of
  income that covers about $37,094 of the $57,861 the year needs"; a required withdrawal beyond the need: "your $50,400 of income
  already pays for the $36,000 you spend, so the withdrawal, less its tax, goes back into savings" (no figure: the plan's tax is
  its flat 15%, the answer above prices it at the brackets). The answer at the top says the same short year the same way.
- **One kind of figure beside every way (UX 2).** Each way shows what it takes from savings in the first year ("$16,078 from
  savings", "$16,880 from savings"...), and the hero says so; the ways not offered fold under "Ways that don't fit your plan yet (3)".
- **A held way already chosen (UX 6).** The answer is worked on the plan's spending, the same every year, and the notice says
  "The answer below is for the $36,000 you spend"; the careful (9 in 10 markets) line waits for that choice.
- **The Projection page's list (UX 7).** "How much to take out each year" lists the ways this page offers plus the one in use
  (`wayOptionsFor`, three engine runs, about 1-16 ms on the round 8 plans), with "N ways are left out: on your plan they would plan
  on less than you spend or than your income (How much to take out says why)".
- Tests: `module.test.mjs` (fixtures `qa/fixtures/retiree-cases.mjs`; the qa check now covers every retired year of every
  offered way on twelve fixture files), each failing before its fix.

## Tests (round 8)
`module.test.mjs`: the widow's required tax (against core/math/tax.js by hand), each way's take and spend, held and offered,
the notice and the way back for a plan already on percent, and on every qa fixture: a way offered never plans on less than the
plan's spending or its first-year income (after "Use this one", "you plan on" and "Paid by income" agree). Fixture
`qa/fixtures/widow-plan.mjs`.

## Verify (2026-11-06): this year's pay
`firstYear`'s `requiredTax` (the hero's "after about $X of tax on it") is priced, for a first retirement year that is this year,
on top of the first adult's own pay drawn earlier this year (`rmd/compute.js` `payThisYear`; formula, hand figures and sources in
the Required withdrawals README), the same figure as that page's card. Test: `rmd/module.test.mjs` "verify: ...".
