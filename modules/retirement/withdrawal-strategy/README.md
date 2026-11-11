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
- need = spending + one-time costs + the year's tax - guaranteed income (Social Security, pensions, other income), floor 0.
- from savings = everything the engine takes out that year, the required withdrawal included; extra = from savings - need.
- where from: cash first, then the plan's withdrawal order, each named by its accounts.
Three sentences: nothing needs to come out; or income covers the spending but the law still requires a withdrawal (how much, from which account, the tax on it, and where the rest can go, with a link to Required withdrawals); or take about $X, starting with these accounts, which with the guaranteed income pays for the spending and its tax. Then the most the plan can carry (Will the money last?'s `affordable`, to the $100), or where it runs out.
Before, the page showed four "first year" spending figures and no amount to take out. A range whose two ends are equal now reads "spending stays at $X".
Changed in Batch 5b (2026-11-06, the last section): the share-of-savings, years-left and guardrail rules used to set total spending from the savings alone, so for a household with large guaranteed income they could quote spending below it. The owner said yes to the engine change; they now spend guaranteed income on top of their own withdrawal.

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

## Health insurance in the first-year answer (2026-11-02)
`firstYear` returns `health` (the projection's health insurance that year, today's dollars), and the answer says it with the spending: "That pays for the $84,000 you plan to spend, $4,800 of health insurance and about $9,000 of tax." `need` already had it (it is among the year's one-time costs, `eventOut`). `healthAdded` (the plan adds cover in some year) makes the two spending figures say "on top of health insurance".
Review fix 2026-11-02: with no tax that year the two take one "and" ("pays for the $78,000 you plan to spend and $4,051 of
health insurance"); it read "..., $4,051 of health insurance." with the "and" missing.

## Round 8 (2026-11-06): what each way takes and spends, and a guard on "Use this one" (widow-1)
(Superseded by Batch 5b, the last section: the engine changed, `"below-spending"` is gone, and the guard is only a safety net.)
A widow, 74, with $50,400 a year of pension and Social Security, $12,000 in checking and $410,000 in an IRA, spending $36,000. The
engine (`core/math/retirement.js`, frozen by `tests/golden/retirement/withdrawal-strategy.csv`) takes the share-of-savings figure,
4% x $422,000 = $16,880, as all of the year's spending and only then counts income against it; "Use this one" set it, and Will the
money last? read "you plan on $36,000" next to "Paid by income 299%" (50,400 / 16,880). Guardrails, starting at $36,000 against a
$422,000 pot (8.5%, over its 4.8% line), cut her spending to $20,986 while her income alone covers it. The engine is not changed
here (the key is frozen; the owner's question is below). What changed:
- Each way's first retirement year, in today's dollars, from its own run with the plan's expected returns (`first`):
  - same spending every year, guardrails (`rule: "spend"`): spend = the year's spending + health insurance; take = everything taken
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
  the row's own spending (the figure beside "you spend" is never the spending plus health insurance), `health`, `other` (one-time
  costs), `tax`, `take` (all taken from savings), `short` (the engine's shortfall), `back` = take - need - tax, the part of a
  required withdrawal the engine puts back (core/math/retirement.js: `surplus = netOut - need - taxes`). Words: "take about $48,507
  from savings; with your $24,000 of income, that pays for the $60,000 you spend, $5,231 of health insurance and about $7,276 of tax"
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

## Batch 5b (2026-11-06): guaranteed income first, the owner's answer, and a page a layman can use
The owner's answer to the batch 5 question (change the engine and regenerate the frozen answer key), word for word, 2026-11-06:
**"You can do as you please. Just make sure a layman can easily understand and use the page"**. So: yes to the engine change and
to regenerating `tests/golden/retirement/withdrawal-strategy.csv`, on the condition that the pages are easy for a layman.

**The rule (`core/math/retirement.js`, every retired year of a way other than the same spending every year).** In today's dollars
scaled by the year's price level; `total` is savings at the start of the year, `income` the year's guaranteed income (Social
Security, pensions, other income), `health` and `one-offs` the year's health insurance and one-time costs, `tax` the year's tax before
any Roth conversion (a conversion's own tax comes from savings on top and cuts nobody's spending):
- A share of what is left: withdrawal = max(0, total x rate). Years left: withdrawal = max(0, PMT_due(real return, years left,
  total)), the annuity-due payment (unchanged).
- Guardrails: a spending target G, the plan's spending in the first retired year. Each later year the withdrawal G needs is
  worked out (trial year at last year's G: max(0, G + health + one-offs + tax - income), gross of the tax on it); its rate =
  that withdrawal / total. Over 1.2 x the starting rate: G x 0.9 (capital preservation). Under 0.8 x and something is drawn:
  G = min(G x 1.1, the plan's spending grown with prices) (prosperity, never above the plan). Else, after a year whose real
  return was not negative: G x (1 + inflation). A year income pays for everything draws $0 and is never cut.
- Savings pay: max(withdrawal, G + health + one-offs + tax - income) for the year, plus the conversion tax. Spending =
  max(G, income + withdrawal - tax - health - one-offs). A required withdrawal above that still comes out; what is not spent
  goes back into savings (the taxable account), as before. The same spending every year is unchanged, bit for bit.
- Sources: Bengen (1994) and the Trinity study treat the rate as what leaves the portfolio, with Social Security and pensions
  on top; Guyton and Klinger (2006), "Decision Rules and Maximum Initial Withdrawal Rates", Journal of Financial Planning: the
  capital preservation and prosperity rules act on the current withdrawal rate against the initial one (simplified here);
  Bogleheads, "Variable percentage withdrawal": the VPW amount is the portfolio withdrawal, pensions and Social Security added.

**The widow (qa/fixtures/widow-plan.mjs), by hand.** $50,400 of pension and Social Security, $12,000 + $410,000 saved, $36,000
planned, flat 15% tax. A share of what is left: 4% x 422,000 = $16,880 taken (the law's $16,078.43 is inside it); before tax
$16,880 + $50,400 = $67,280; tax 15% x 16,078.43 = $2,411.76, so $64,868.24 to spend (was $16,880 of "spending", not offered).
Years left: $24,391.28 taken, $72,379.52 to spend. Guardrails: her income pays for the $36,000 and the tax, so nothing is drawn
for spending, nothing is cut, she spends $47,988.24 (50,400 - 2,411.76) and the whole $16,078.43 goes back into savings (was
cut to $20,986). The same spending every year: $36,000, unchanged. After "Use this one" on the share way, Will the money last?
reads "you plan on about $64,868 in 2026" and "Paid by income 78%" (50,400 / 64,868.24); it read $36,000 beside 299%.

**The guard stays, as a safety net.** `guardOf` holds a way only when, in some retired year of its expected run, spending +
health + tax is under that year's guaranteed income (`"below-income"`); `"below-spending"` is gone. On every qa fixture plan no
way is held and every way the engine runs is offered (test "5b: on every qa plan ..."). If one ever is, its row in "How this
is worked out" says why in one line and the Projection page's list leaves it out with the same reason.

**What else follows the rule.** Withdrawal order and Roth conversions compare their options on the same spending every year
(`strategy: "fixed-real"`): with a draw way the tax a choice saves would be spent, not kept, so "left at the end" would miss it.
Monte Carlo, History, Sequence risk, Financial independence, Scenarios, Reports and Timeline run the plan's own way through the
engine and so follow it.

**The page, for a layman.** The first screen answers in plain sentences with the real figures: "This year, take about $16,078
from Ruth's retirement account: the law requires it. Your $50,400 of Social Security and pension already pays for the $36,000
you spend." and the 9-in-10-markets line ("You could spend up to about $5,000 a month and the money lasts in about 9 of 10
markets", a grey bar until it is worked out). Then "Ways to decide how much to take": each way one record, its name, "about $X a
month" (its first year), one short line ("A set share of savings each year on top of your income, so it moves with markets. Can
fall to about $4,052 a month; lasts to 95.") and one outlined "Use this one". Method names, the 1.2 / 0.8 tests, the start rate,
each way's first year in full, the ranges, the worst stretch of history and the sources are under "How this is worked out", one
short line each. "Not offered:" walls are gone. Account names read as accounts ("Ruth's retirement account":
`careful.js` `accountName`).

**Tests** (each failed before its change; failing output kept with the batch): `tests/retirement-ways.test.mjs` (the engine: share
with a pension, with tax, years left, guardrails' start and its cut / raise-back sequence, a small draw that must not compound,
no income left unspent, a required withdrawal above the draw, health and one-offs, the same spending every year unchanged);
`module.test.mjs` "5b ..." (the widow's figures, the qa census, Rae, the safety net, each first year adding up for the three
laypeople, the first screens of the widow, the couple retiring at 62 and the early retiree, a short year, and the projection
agreeing after "Use this one"); `withdrawal-order` and `roth-conversions` "5b: ..." (their comparisons do not move with the way).
The answer key: `tools/golden_retirement/withdrawal_strategy.py` (rule above, plus a new `income-first` group of 100 rows) and
`projection.py` (the guardrails raise), regenerated; every moved row and why is listed with the batch.

## Batch 5b reviews (2026-11-06): what the money and layman reviews changed
Still under the owner's answer of 2026-11-06, word for word: "You can do as you please. Just make sure a layman can easily
understand and use the page".

**The rule, corrected (`core/math/retirement.js`).** The share and years-left ways:
- savings pay `share + max(0, tax + health - income)` + one-offs (+ a conversion's own tax);
- spending = `share + max(0, income - tax - health)`.
So guaranteed income pays the year's tax and health insurance first, and savings pay whatever of them it cannot, on top of the share.
In every year savings can pay, spending + health insurance + tax = income + everything taken out (review D1: with no income the
share was cut by its own tax and health insurance; 453 qa plans planned $0 to live on in their first retired year, where bc7f3ca
spent the share. With no income the figures now equal bc7f3ca to the cent: $1,000,000 pre-tax at 20%, 4%: $40,000 spent,
$50,000 taken, $10,000 tax). Guardrails unchanged by this.
Guardrails' target G (review D4): after a losing year G does not rise with prices but still falls with them
(`G x min(1, 1 + inflation)`), and G is never above the plan's spending at the year's prices (a 10% cut in a 1930s year when prices
fell by more than 10% left spending above the plan in today's dollars). The years-left payment (UX review 14) is priced at the
plan's expected real return of the retired mix, `(1 + stocks x s + bonds x (1 - s)) / (1 + inflation) - 1` with the expected
returns and inflation, even in a market sequence (Monte Carlo, History, the worst stretch here): the replayed year's own
return swung Kim's 1966 stretch between $0 and $100,142 a year. Source: Bogleheads, "Variable percentage withdrawal" (a set
return per allocation, not the year's market). The expected run is unchanged. The draw ways settle each year's tax to $0.000001
(the same spending every year keeps its own $0.0005, bit for bit): a gross-up is now routine and a looser stop compounded to
$0.014 over 28 years.

**Each way on its own run (review D2).** `inputsByWay(plan)` builds each way's inputs from the plan with that way saved: health
cover before 65 is priced on the plan's own income, which moves with the way (Pat and Jo's share way: $3,450 of health insurance
when priced on the saved way's income, $33,721 on its own, since its income falls under the line where the help stops). The
figure beside "Use this one", the worst stretch, the guard and the Projection page's list all use it; it equals Will the money
last? with that way saved (test "5b review D2").

**The page (UX review).**
- Each way's line names the bad stretch of history on the worse of the two runs (UX 1): "In a bad stretch like 1966 it runs out
  at 93", "In a bad stretch like 1973 it falls to about $1,339 a month", "Lasts to 95, even in a bad stretch like 1960".
- After "Use this one" the confirmation says what the plan now spends and how it moves (UX 5): "Your plan now spends what the
  years left can afford: about $6,032 a month this year (it was $3,000), rising and falling with markets. Savings are spent
  down to $0 by 2047 on purpose." A way that moves is answered as itself: "This way spends about $6,032 a month this year; in a
  bad stretch like 1960 it falls to about $4,048."
- "How much you could spend: four ways" (UX 6), with one line that answers "which one?" once the 9-in-10 figure is in, and an
  outlined "Plan on $4,600 a month" under the advice; it saves Retirement settings' spending figure
  (`projection/compute.js saveSpendingFigure`) and confirms "Your plan now spends $4,600 a month on top of health insurance (it was
  $5,000). It lasts in 9 of 10 markets." (checked on the phone: Will the money last? then reads 93%).
- The chance in the same words as Will the money last? and Required withdrawals (UX 7, `careful.js chanceWords`): "9 of 10
  markets" at 90% or more, "about half of markets" from 45% to under 60%, else "about N of 10 markets" rounded down (never 9
  under 90%), with the percent: "about half of markets (47%)".
- One name for guardrails everywhere: "Trim after bad years" (UX 8); the Projection list uses these four names.
- One tax figure each (UX 9): the hero gives what is left of the required withdrawal after its real tax ("About $12,650 of it is
  left after tax": 16,078 - 3,429); the fold names the plan's flat 15% as such beside the real $3,429.
- Small lines on the hero tint in the normal text colour (grey was 4.39:1, UX 17); no links inside sentences.
- No blank line under the 9-in-10 sentence (batch 5b, last pass): the line keeps its placeholder's height only when nothing
  follows it. Under the plan, the chance line and "Plan on ..." follow, and the held height had left 27 px of blank on the couple's
  and Kim's first screen (measured on the phone, `min-height` 68 px over two lines of words; now none).

## Batch 5b verify (2026-11-07)
Under the owner's answer of 2026-11-06 ("You can do as you please. Just make sure a layman can easily understand and use the page"):
- R1 (engine): guardrails' target is held after a losing year (`G x min(1, 1 + inflation)`) only while it needs a withdrawal
  (`max(0, G + health insurance + tax - income) > 0`); while income pays for all of it, G follows prices (`G x (1 + inflation)`, still
  never above the plan at the year's prices). Frozen with nothing drawn, the target sank below the plan unseen and, never drawn
  on, was never raised back: the widow through the 1960 window spent $32,946 in today's dollars on a $36,000 plan in 2047 with
  $470,928 of savings untouched ("Nothing is trimmed while income pays for everything" said otherwise); now $36,000. Test:
  `tests/retirement-ways.test.mjs` "verify R1" (a $60,000 pension with no raise for prices, three losing years at 10%
  inflation: 2028 spends $60,500 = $50,000 in today's dollars, was $60,000 = $49,587).
- R2 (page): when a required withdrawal is due in a year that takes more than it, the answer says the required part comes from the
  pre-tax account and where the rest comes from ("About $16,078 of it must come from Ruth's retirement account: the law requires
  it. The rest from Checking."). It said "Take it from Checking first, then Ruth's retirement account", which, read in that order,
  takes $12,000 from Checking and only $4,880 from the account, $11,198 short of the law (the engine takes the required amount
  first). With nothing else to take from: "The rest comes from there too." Test: "verify R2".
- `chanceWords(1)` is "every market tried (100%)", not "9 of 10 markets (100%)".

## Follow-up 2026-11-07: one plain way of saying the odds
The owner's standing words: "It should feel easy for a layman ... not ... concepts / words too hard to understand." Every page that says how often
the money lasts now uses `modules/retirement/odds.js` (`chanceWords`, re-exported by `careful.js`; `BAD_RUN` = "even in a bad run of years",
`BAD_RUN_NOTE` = "(only 1 in 10 is worse)"). A "pretend future" is one made-up run of good and bad years; the share of pretend futures in which the money lasts is the
chance. The words, after "the money lasts": 100% "in every pretend future we ran"; 90% or more "even in a bad run of years"; 45% to under 60% "about half
the time"; under 10% "in fewer than 1 of 10 pretend futures"; else "in about N of 10 pretend futures" (N rounded down, never 9 under 90%); with the number
"(93 of 100)" after "of 10 pretend futures", else "(93 of 100 pretend futures last)", where it helps. No page says "markets" for a try ("9 of 10 markets", "every market tried", "simulated markets",
"100 markets" are gone; "if markets do as well as average" stays: it means average returns, not a try). The amber pill "fewer than 9 in 10" is
"short in a bad run". Decision (no owner to ask), changed after the UX review of 2026-11-07 (it found "tries" unexplained where it first appears): "pretend futures", which explains itself, over "tries" or "runs".
- The old line above (`chanceWords(1)` is "every market tried (100%)") now reads "in every pretend future we ran"; "You could spend up to about $X a month and the money lasts even in a bad run of years (only 1 in 10 is worse)."; "Yours already lasts even in a bad run of years."

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

Money review M1 (2026-11-07): the raise at a $0 draw waits until savings could pay what the raised target needs without a trim (the withdrawal it would need is $0, or at most
1.2 x the rate of savings); else the target follows prices. Without it a retiree with little or no savings was raised on money that was not there, came up short, was trimmed and
raised again: on 230 sampled qa plans (3,926 runs) 373 short years that start from empty savings on 18 plans, and runs that ran out up to 10 years sooner. With it: 0 such years,
Pat and Jo unchanged ($577,371, 12 years under the plan), key row `income-first-063` unchanged. The cost that remains, said plainly: raising back spends nearer the plan, so less
is left when pay stops; on 3 of 230 sampled plans that run out anyway, they run out 1 to 8 years sooner. Engine `core/math/retirement.js` (`raisedFits`); oracles
`withdrawal_strategy.py` (income-first) and `lead_audit.py`; test `tests/retirement-ways.test.mjs` "money review M1". The first screen also says "You plan $X a month." beside
the figure it could spend, so the plan's own "yours" line below is no surprise. "A bad stretch like the 1970s" (the decade, not 1973).

## Stress test 2026-11-11 (claude-e, retirement leftovers)
"Use this one" names the way back: the green line carries "Put it back: <the earlier way>" and stays until the next change, and it is scrolled into view when it would sit under the top bar (R4; the review found the line off screen).
