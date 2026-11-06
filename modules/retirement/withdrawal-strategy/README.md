# How much to take out  (`retirement/withdrawal-strategy`)

**Status:** usable (phase 5)
**Purpose:** Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history.

## Inputs
The projection inputs; `retirement.strategy` and `retirement.withdrawalRate`. Writes `retirement.strategy` ("Use this one").

## Outputs
`rows[]` per strategy: `name`, `how`, `from`, `expected` and `worst` (`firstYear`, `lowest`, `highest` real spending, `endReal`, `success`, `failAge`); `worstStartYear`, `chosen`.

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
Not changed (my choice): the share-of-savings, years-left and guardrail rules still set total spending from the savings alone, as the frozen answer keys in tools/golden_retirement define them, so for a couple with large guaranteed income they can quote spending below it; the hero's figure is the one to act on.

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
