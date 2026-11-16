# Withdrawal order  (`retirement/withdrawal-order`)

**Status:** usable (phase 6)
**Purpose:** Which account to draw from first (taxable, pre-tax or Roth) and what each order costs in lifetime tax and spending.

## Inputs
Everything the Projection page reads; `retirement.withdrawalOrder` (the plan's order, after cash; set here with one tap); `retirement.withdrawalSplit` ("proportional": a share from every account, the fifth order; set here with one tap, taken off by any other order's). The comparison always runs through the federal brackets so the tax timing shows, whatever the projection's tax setting.

## Outputs
`options[]` (four orders: taxable first; pre-tax first; pre-tax, Roth, taxable; Roth first): `success`, `failYear`, `endBalanceReal`, `endAfterTaxReal`, `endTaxRate`, `taxesReal`, `rmdReal`, `current`, `best`; `best`, `gainVsWorst`, `taxSpread`, `bracketsOn`, `notes` (the four's, as the golden key holds them); `share` (the fifth order, the same figures, `key`/`split` "proportional"); `five: { best, gainVsWorst, taxSpread, allFail }` (the ranking over all five, which the page shows). `chooseOrder(draft, option, { withRates })` is what "Use this order" writes.

## Formulas
`project()` once per order with `withdrawalOrder` and `tax: { mode: "brackets" }`, and once more with `withdrawalSplit: "proportional"`. Orders are ranked by what is left at the end after the tax still owed on pre-tax money (`endAfterTaxReal`: cash + taxable + Roth + pre-tax x (1 - the last year's bracket)); a plan that runs out ranks by how late it does; a tie goes to the first listed, so the share is "best" only when it leaves more than all four.

A share from every account (`core/math/retirement.js`, `withdrawalSplit`): at the start of each year w_b = balance_b / (taxable + pre-tax + Roth). After everyday cash and any required withdrawal, each draw A the year needs (spending, health cover, one-off costs and the tax, grossed up in the same loop as for an order) is split take_b = min(balance_b, A x w_b / the sum of w over the accounts that still hold money); what an emptied account could not pay is shared again among the others by the same weights (at most three rounds), and an account that held nothing at the start of the year (money that came in during it, a home sold) pays last, in the plan's own order. Example (module test): $600,000 taxable, $300,000 pre-tax, $100,000 Roth and $50,000 to take, no tax: $30,000, $15,000 and $5,000; with a flat 20% on pre-tax money, W = 50,000 / (1 - 0.2 x 0.3) = $53,191.49, split 60/30/10. Source: the arithmetic of a split in proportion; no outside figure is used, so nothing here needs a source with a date. ProjectionLab and RightCapital offer the same kind of order (the gap map, C8); their documentation could not be read this session (the network reaches www.irs.gov and the package registries only).

## Edge cases
Cash always goes first, also for the share. When the projection uses the flat rate the order changes nothing there; a note says so. Bracket-filling mixes are the Roth conversions page's job.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Independent answer key and audited sources

`tests/golden/retirement/withdrawal-order.csv` holds 1,400 invented cases:
100 for each of fourteen rules, split into 60 grid, 30 edge, and 10 extreme
cases. The rule inventory and full column layout are in
`tests/golden/retirement/briefs/withdrawal-order.md`. The generator and its
shared independent tax equations are `tools/golden_retirement/withdrawal_order.py`
and `tools/golden_retirement/tax_oracle.py`. Neither imports application code.
Every tenth case has an alternative derivation recorded in the CSV note.

Ordinary brackets, capital-gain thresholds, standard deductions and additional
age allowances come from [IRS Rev. Proc. 2025-32, sections 4.01, 4.03 and 4.14](https://www.irs.gov/irb/2025-45_IRB).
For example, 2026 single taxable income of $50,400 has ordinary tax
`12,400 * .10 + (50,400 - 12,400) * .12 = $5,800`.
The source-year figures stay exact. Later hypothetical years compound the
plan's inflation, rounding brackets to $25 and deductions and capital-gain
thresholds to $50, as an explicit planning assumption rather than a tax forecast.
The 2025 head-of-household standard deduction is $23,625 under the amended law
and stays exact: a table's own year is never re-rounded (fixed 2026-10-30, F-030).

Social Security taxable income follows [IRS Publication 915, Worksheet 1](https://www.irs.gov/publications/p915).
Single, head-of-household and surviving-spouse thresholds are $25,000 and
$34,000; joint thresholds are $32,000 and $44,000. Married-separate examples
explicitly assume the spouses lived apart for the whole year, because the
model has no field for that fact. Net investment income tax follows the
[IRS NIIT FAQs](https://www.irs.gov/newsroom/questions-and-answers-on-the-net-investment-income-tax):
3.8% of the smaller of investment income and modified adjusted gross income
above $200,000 single/head-of-household, $250,000 joint/surviving-spouse,
or $125,000 married-separate. These thresholds are not indexed.

The temporary senior deduction follows [IRC 151(d)(5)(C)](https://www.law.cornell.edu/uscode/text/26/151)
and [IRS Schedule 1-A instructions](https://www.irs.gov/instructions/i1040gi).
For 2025 through 2028, each eligible person starts with $6,000; that person's
amount falls by 6% of income above $75,000, or $150,000 on a joint return.
Married taxpayers must file jointly to qualify. For two eligible joint filers
at $200,000, the deduction is `2 * (6,000 - .06 * 50,000) = $6,000`, not
`12,000 - .06 * 50,000 = $9,000`. Both rules are in `core/math/tax.js` since
2026-10-30 (F-029, F-030).

Page-level answers solve for the smallest gross withdrawal whose after-tax
proceeds cover spending. An independent bisection allocates each proposed draw
through cash and the selected account order, then evaluates the published tax
equations. Remaining balances grow after withdrawals. Real tax and required
withdrawal totals divide each year by its cumulative price level before
summing; the after-tax estate subtracts the last ordinary marginal rate times
the remaining pre-tax balance. Ties retain the first listed option. Money is
rounded to cents only for federal tax and final CSV outputs; rates have six places.

## When every order runs out (fix round r2, claude-b, 2026-11-15)
An earlier critic found the headline "Your order is the best one for this plan" above "The money runs out under every
order". Reproduced on the invented renter (`qa/fixtures/renter-debt-plan.mjs`: Riley, born 2002, tax at one flat rate):
"Your order is the best one at the real tax rates", then "... "Taxable, then pre-tax, then Roth" lasts longest, to 2067",
while all five orders run out in 2067, a tie. Fifteen of the invented households run out under every order; in all but one
every order runs out the same year.
- **The alarm is the headline** (docs/OPTIONAL.md R3): "The money runs out under every order", or on a flat-rate plan "At
  the real tax rates, the money runs out under every order" (the orders are always compared at the real rates; P1's rule).
- **The lede, one sentence per case** (`allFailWords`, each in `module.test.mjs`):
  - all the same year: "All five orders run out in 2067, when you are 65. Fix that first on the page called Will the money
    last?" (the headline already says every order runs out. Short: the renter's first view has 132 words, 142 before)
  - yours lasts longest (or as long as any): "Yours lasts longest: the money runs out in 2065, when Priya is 73 and Tom is
    76. Fix that first ..." (the couple of `qa/households` 02 once it takes a share from every account)
  - another lasts longer: ""A share from every account" lasts longest: the money runs out in 2065, when Priya is 73 and Tom
    is 76; under yours it runs out in 2064. ..." (the same couple on taxable first)
  - yours is none of the five: ""..." lasts longest: the money runs out in 2065, ...".
- **When, in words** (`whenWords`): "in 2067, when you are 65" for one person; "when Priya is 73 and Tom is 76" for two
  named people; "at age 73" when the first has no name; the year alone without a birth year. The age is the engine's own:
  year less birth year (`core/math/retirement.js`, whose `failAge` is the first person's), from `agesIn(year, people)` in
  compute.js, which `compute()` does not call.
- **No button that changes nothing.** When the plan's own order runs out the same year as the longest, it is the one marked
  best (the ranking gives a tie to the first listed, which put "Use ..." on an order no better than the plan's). When all
  five run out the same year no row carries "best", nor the best row's tint. On a flat-rate plan the notice's second sentence follows the case
  (`flatWords`): when every order runs out it does not say again what the hero says ("Working tax out at the real rates
  changes the figures on every retirement page." when all run out the same year, "... makes it count, and changes ..." when
  one lasts longer); otherwise "this order is the best one" (as before).
- **The page to fix it on is a link.** Every case of the lede ends "Fix that first on the page called Will the money last?",
  and the page's name is drawn as its link (`ledeNodes`, to `#/retirement/projection`). A person critic of the fix found
  "Will the money last? is the place to fix that first." naming a page in bare text, its question mark mid-sentence, and the
  notice repeating "every order runs out the same year" under the hero's "All five orders run out in 2067".
- The flat-rate headline keeps "At the real tax rates, ...": the orders are compared at the real rates, and at one flat rate
  the plan itself can last where every order runs out at the real rates (2 of 1,076 such invented plans, a scratch survey of
  every fixture plan and household variant, 2026-11-15), so the bare alarm would not be true for them.
- **Invariance**: `compute()` is not changed (`tests/withdrawal-ways-invariance.test.mjs` digests it against 154a597; the
  module test checks it does not call `agesIn`); every page whose best order lasts reads as before.

## Ideas / not yet
- The step-up in basis on taxable money left to heirs.
- Gains taken at the 0% rate as a third axis of the search below: it needs the engine to keep a cost basis for taxable money
  (today a fixed share of every sale is profit), which is an engine change of its own.
- The Roth conversions page's 24% rate and its "Stop sooner" lines as more axes of the search (each multiplies the runs).

## One search over the order and Roth conversions (2026-11-16, gap list next 60, item 23)
`mix.js` (pure; `compute()` does not call it, so the page's answer is what it was). The plan's own engine
(`core/math/retirement.js` `project`) is run on a small, stated grid and the runs are ranked:

- **The grid.** The five orders (the four of `WITHDRAWAL_ORDERS`, then a share from every account) x no Roth conversions, or
  conversions that fill the 10%, 12% or 22% rate (`MIX_RATES`) until age 63, until 70 (`MIX_STOPS`) or until required
  withdrawals begin. A stop age `a` is tried only when it changes a year: `startAge < a < min(rmdStartAge, lastAge + 1)`, where
  `startAge` is the first person's age in the first retired year (the engine converts by the first person's age, in retired years
  before their required withdrawals), `rmdStartAge` the plan's start age as Roth conversions reads it (`inputs.rmd.startAge`, 75
  when absent) and `lastAge` the first person's age in the plan's last year. Runs = 5 x (1 + 3 x stops): 35 for the invented family
  (Ana, 65 in her first retired year 2055: 70 and "until required withdrawals begin"), 50 when she retires at 62 (63 too), 20 for
  the invented retired couple (Ruth, 72, required withdrawals at 73: only "until required withdrawals begin"); one more when the
  plan's own setting is none of them (the 24% rate, say). With no 401(k) or IRA money, or no retired year before required
  withdrawals, the grid is the five orders alone (`convert: false`) and the page draws no part: the five orders are above.
- **One run.** `runMix(plan, mix)` = `project({ ...buildInputs(planWith(plan, mix)).inputs, strategy: "fixed-real" })`, where
  `planWith` is the plan with that mix saved: `taxMode: "brackets"`, the order (or `withdrawalSplit`, keeping the plan's own order
  for money that comes in during a year), `rothConversion: { ...rc, on, fillRate, untilAge }`. This is what Roth conversions runs
  for each setting (one `buildInputs` per setting, so the health line, the marketplace credit and Medicare's surcharge, is priced on
  that mix's own income) and what Withdrawal order runs for each order (the same spending every year, the real rates). For the
  plan's own order each rate equals Roth conversions' option, and the plan as it is equals this page's row for its order (module
  tests "x2 ranking"). Another order with nothing moved equals this page's row only where health cover does not move with the
  order: this page builds its inputs once and prices that cover on the plan's own order (`compute.js`, not touched: the golden key
  and the tax pages' tests hold its figures), the search on each mix's own income, as Roth conversions does. For the family and the
  retired couple they are equal to the cent; for the stay-at-home parent of qa/households 05, "Roth, then taxable, then pre-tax" with
  nothing moved runs out in 2058 here and 2059 on this page, and for the high-net-worth household (12) the tax over the plan of two
  orders differs by a few hundred dollars (test "x2 F1", critic of x2 F1). No invented plan lists such a row in the part (in both
  every mix runs out, and only rows that last longer are listed); "How this is worked out" says the cover is priced on each mix's
  own income.
- **The plan's own setting** (`savedConv`): its conversions as the engine runs them once the real rates are on. Off, a rate that is
  none of the brackets' (the engine finds no top and converts nothing) or a stop that is not a number (never reached) is read as
  nothing moved, so the plan as it is stays the engine's own run and no row reads "the NaN% rate" (test "x2 F3", critic of x2 F3;
  hand-edited or damaged data only). Numbers saved as text are read as numbers, as `buildInputs` reads them.
- **The figures.** Left at the end `E = endAfterTaxReal` (savings at the plan's end less the tax still owed on pre-tax money, in
  today's dollars: the engine's own); tax over the plan `T = sum over years of taxes_y / priceLevel_y`; converted
  `C = sum of conversion_y / priceLevel_y`. Both pages sum them the same way.
- **The ranking** (`better`): lasts before runs out; then more `round(E)` (when both run out, the later year); then less
  `round(T)`; then fewer changes from the plan as it is (0 to 2: the order, the conversions); then the grid's order. Runs that are
  the same in effect (`sameInEffect`: the same ending, and within $1 the same E, T and C) are one entry, shown as the simplest
  (the plan as it is stands for its group): for the retired couple the five orders give the same with conversions, so the best is
  their own order with conversions at the 22% rate, once.
- **What is shown** (`rankMixes`): the plan as it is and the best three other entries, each with its difference; when every run
  runs out, only those that last longer (a row that runs out the same year says nothing the first sentence does not). "Use this
  mix" only on an entry that does more: it lasts and the plan does not, leaves $1 or more more at the end, or, both running out,
  runs out later. "About as much": $500 or less more (the page's own line for the orders).
- **What "Use this mix" saves** (`chooseMix`), through the two pages' own paths and nothing else: the order through this page's
  `chooseOrder` (and `taxMode: "brackets"` on a flat-rate plan, as its first button does, since the figures are worked out at the
  real rates); conversions on: Roth conversions' "Use this" (`{ ...rc, on: true, fillRate }`, `taxMode: "brackets"`) and its
  "Convert until" box (`untilAge`, a number or null, only when it differs); conversions off: its "Turn conversions off"
  (`{ ...rc, on: false }`), only when they were on.

What the person sees (view.js `mixPart`; the simple-first rules of docs/OPTIONAL.md):
- **First view**: one quiet row, "Try Roth conversions too" (kind `own`: it holds "Use this mix" and no box; the title is pinned in
  `qa/first-view-lib.mjs` `PINNED_TITLES`, two to four words, R24; "Try" says there is something to gain by opening it, critic of
  x2 P6), first in the parts card, before "How this is worked out". No
  row when there is nothing to convert. To keep the page's first view at its count (180 words, 10 figures for the family, the
  `tests/first-view.known.json` entry), each order's row no longer ends "Today's dollars." while the headline says "in today's
  dollars" (every case but "every order runs out", where the rows keep it): the family's first view is 180 words before and after,
  the retired couple's 158 then 160.
- **One tap**: nothing is worked out until the row is opened. Then what a Roth conversion is, in one sentence (`ROTH_WORDS`, the
  Roth conversions page's own), and "Trying 35 mixes of order and Roth conversions..." while the runs are worked out a slice at a
  time (`SLICE_MS`, 25 ms, then the phone gets a turn): on a desktop the family's 35 runs take about 0.3 s; with the processor
  slowed four times (a phone) 1.3 s, and no stretch over 90 ms where a tap would wait. Then the first sentence (`leadWords`, one
  per case), one more when no mix moves money ("At these rates your other income already fills the room, ..."), the plan as it is
  ("your plan") and the best three, each with its figure and its line (`rowWords`: "Money moved to a Roth each year up to the 12%
  tax rate, until age 75, when required withdrawals begin", the age the first person's required withdrawals begin at; a mix that
  leaves more for more tax says "Pays $7,790 more tax over the plan, yet leaves $18,261 more at the end, after tax"), and "Use this
  mix" (outlined) on those that do more. The first row's pill, when it does more, says what it is best at (`bestWords`: "best with
  conversions", or "best mix" when it moves nothing): the hero's "works best" is the best order alone, worked out without the search
  (the search runs only once the row is opened), so a plain second "best" read as a second answer to one question (critic of x2,
  P1). On a flat-rate plan with Roth conversions saved, one line before the rows (`FLAT_CONV_WORDS`): the five orders above leave
  them out (the engine runs conversions only at the real rates), "your plan" here has them, so the two figures differ ($836,544 and
  $842,697 for the family with 12% conversions saved; critic of x2, F2).
- **Under "How this is worked out"** (`mixHow`; critic of x2, P5: three paragraphs of method sat between the rows and the next part):
  what was tried (`triedWords`, with the count and the health clause), why gains at 0% are not in it with a link to "Gains you
  could take tax-free" on Tax, year by year (`?show=gains`), and on a flat-rate plan with nothing moved that the figures use the real
  rates (`FLAT_MIX_WORDS`).
- **The five orders' note**: the order marked best for the plan never says "the usual worst" beside its "best" (`noteWords`: "Spends
  the tax-free money first: usually the worst order, but the best for this plan"; critic of x2, P2, seen after "Use this mix"). The
  note itself is `WITHDRAWAL_ORDERS` in retirement/projection, which the golden key holds; only this row's words change.
- **Use this mix** asks first (`confirmMixWords`), then one change through `chooseMix`; the green line (`savedMixWords`) names the new
  answer, sits just above the parts card (outside the parts, as this page's other lines), and has Undo (the kit's `undoable`: only
  what the tap changed, `backMixWords` after). The part stays open on the next draw and the others are as they were (R17).
- **Kept for the visit**: the runs are kept in memory for one plan (`searchKey`: the plan without the order, the conversions, the
  tax setting and its stamp, which every run sets itself), so after "Use this mix" and Undo the answer comes back without running
  the 35 again (only a share from every account's runs are made again when the plan's own order changed). Nothing is stored.

Results for the invented households (2026-11-15): the family as it is leaves $836,544 after tax (no conversions, taxable first);
the best of 35 mixes is "Roth, then taxable, then pre-tax" with conversions at the 12% rate until required withdrawals begin,
$874,277, $37,733 more, with $37,674 less tax over the plan ($136,990 against $174,664). The retired couple: $888,771 as it is;
conversions at the 22% rate leave $907,032, $18,261 more for $7,790 more tax. The couple of qa/households 02: every mix runs out;
a share from every account lasts to 2065 instead of 2064. The near-retirement household (09): a share with conversions at the 10%
rate until 70, $31,483 more.

Builder's choices (the brief's grid where the code says otherwise):
- **Gains at 0% are not an axis.** The engine keeps no cost basis: `tax.gainShare` (half, unless the plan says) of every sale from
  taxable money is profit. Selling and buying back in a low year raises the basis, so the gain on later sales is smaller; with a
  fixed share it is not smaller, so the engine cannot see it, and the brief says not to change the engine. Tax, year by year shows
  each year's room under the 0% line (`gainsRoom`, which never enters the engine); "How this is worked out" says so in one sentence
  with a link. (The gap list's item reads "withdrawal order, conversions and gain harvesting together": this is a stated narrowing,
  for the lead to accept or to schedule the engine change; critic of x2 F4.)
- **63 instead of 75.** Required withdrawals begin at 73 for people born 1951 to 1959 and 75 from 1960 (`core/math/rmd.js`:
  SECURE 2.0 s.107, 26 CFR 1.401(a)(9)-2(b)(2); the IRS "Retirement plan and IRA required minimum distributions FAQs",
  https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs, read 2026-11-16, says 73 for
  today's retirees). So "until 75" is always the same as "until required withdrawals begin". 63 is the stop Roth conversions
  already offers and explains: Medicare's surcharge is set by income two years earlier (that page's README, CMS fact sheet read
  2026-11-14; not read again here). "Until retirement" in the brief cannot be a stop: the engine converts only in retired years.
- The 24% rate and the "Stop sooner" lines are left out to keep the grid small; the plan's own "Stop sooner" choice
  (`conversionCeiling`) is kept in every run, as Roth conversions keeps it.
- No new figure: the rates are the federal table's own brackets, read through `core/math/tax.js` (Roth conversions README has
  their source); the ages are choices, not limits.
- Each run is on the same spending every year, whatever way the plan uses (Batch 5b below): the same as both pages.
Tests (`module.test.mjs`, "x2 ..."): the grid's size for four plans and the stops kept; every run against the engine run by hand
for the family and the retired couple, and the ranking; the runs against Roth conversions' options and this page's rows; ties;
plans that run out; health cover priced on each mix's own income (05, "x2 F1"); a saved setting the engine cannot run ("x2 F3");
`chooseMix` through both pages' paths; every sentence; and invariance: Withdrawal order's and Roth
conversions' `compute()` over 44 invented plans give the digests written from ce79d70 before the search existed
(`invariance.json`; `PRINT=1` writes them again after a deliberate change). The page: no part with nothing to convert; the row
shut and nothing run before a tap; the slices; the answer; asked first ("no" saves nothing); "Use this mix" writes the order, the
conversions and the real rates and nothing else; the green line outside the parts, the part open (S11); Undo puts the plan back
byte for byte; on a plan already on the real rates, the share and its Undo; the method under "How this is worked out", not in the
part; the retired couple's best that pays more tax; a flat-rate plan with conversions saved; the order marked best never called
"the usual worst"; opening, shutting and searching never save.

## A share from every account (2026-11-15, gap list next 60, item 22)
A fifth order beside the four: after cash, every account pays its share of what the year needs, by what it held at the start
of the year, so pre-tax, taxable and Roth money go down together (formula above). For the family plan (`qa/fixtures/family-plan.mjs`)
it leaves $840,251 after tax, $1,203 more than pre-tax first ($839,048), with $174,093 of tax over the plan; for the near-retirement
household (qa/households 09) it pays $41,853 of tax over the plan against $57,950 for pre-tax first, and leaves $762 less.

What the page shows (the simple-first conversion of this page, opt spec C14, done here as the gap spec's section 3.1 asks; C14
skips this page):
- First: the headline, ranked over five orders, one sentence (`heroWords`, one per case; module test "the hero") and the one
  filled button. The sentence names the order once (in the headline) and says what it leaves against yours: "This order leaves
  about $840,251 at the end, after tax and in today's dollars: $3,707 more than yours." (the two figures as shown, so the
  difference checks by hand); "Your order leaves ... The worst order leaves $18,123 less." when yours is the best; "...; yours
  runs out in 2061." when yours runs out. The tax over the plan and the figure before tax are in each row (critics of 2026-11-15,
  P2: the hero said the order's name twice and four figures). The flat-rate notice as before. Card "The five orders": the best
  order's row and yours (when they differ), then "3 more orders" (`rest()`, kind "more"; "4 more orders" when yours is the best).
  The best order's row has no "Use this order": the hero's button is its one way in (P4: it was offered twice).
- A plan already on the best order with the flat tax rate: the headline is "Your order is the best one at the real tax rates"
  (the order changes nothing yet), and "Work out tax at the real rates" is the page's one filled button; beside the hero's own
  "Use ..." it stays outlined (P1: after choosing the best order, the page said "the best one for this plan" and had no filled
  button left).
- "How this is worked out" (the parts card): the hero's line on the method (moved word for word), one paragraph on the share
  order, and "Why it matters" (moved word for word). First view: 495 words and 21 figures before, 180 and 10 after (the family).
- Every "Use ..." confirms itself in green and offers "Put it back" (the kit's `ui.undoable`: only what that tap changed comes
  back, with `undoneWords` when something was changed since); the line stays until the next change. Before this, the green line
  went after four seconds and there was no way back: the brief asked for "confirm and Undo" on the page's existing button, which
  had none, so the way back is now on every choice here.

Builder's choices:
- Not a fifth entry of `WITHDRAWAL_ORDERS` (its four are what the golden key, the tax pages' tests and `orderKey` read): a field of
  its own, `retirement.withdrawalSplit`, so a plan without it is the very same plan. The order in `withdrawalOrder` is kept with
  the share: it is the order for money that comes in during a year to an account that held nothing at its start, and what a later
  tap on another order replaces. The share's figures here are run with the plan's own order for that, so they are what the plan
  runs once it is saved.
- The weights are the balances at the start of the year (the brief's words), not at the moment money comes out: a required
  withdrawal comes out of pre-tax money first, as in every order (the law requires it), and the rest is shared by those weights.
- Ties go to the four, so the headline never moves to the share for a plan where it makes no difference (the retired couple).
- The rows' notes start with a capital now (they began in lower case under the order's name).
Readers that name the order say it: Will the money last?'s "What goes into this" and Plan summary through `orderLabel`
("A share from every account"); Cash flow in retirement ("Money comes out of cash first, then a share from every account, by what
each holds."); How much to take out's first-year answer ("Take it from Checking first, then a share from each of Brokerage,
Ana's 401(k) and Bo's Roth IRA.").
Tests: `module.test.mjs` (the split, cash first, the tax gross-up, an account that runs dry, money in to an empty account, a
required withdrawal first; the five-way ranking and its tie; the tap and Put it back; each sentence; S11), and
`tests/withdrawal-ways-invariance.test.mjs` (every figure of a plan without the field is byte for byte what 154a597 gave, over 44
invented plans).

## Batch 5b (2026-11-06): compared on the same spending every year
The owner's answer, 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the page". The share, years-left and guardrail ways now spend guaranteed income on top of their
withdrawal (How much to take out README), so with them the tax an order saves would be spent rather than kept. `compute` runs
every order with `strategy: "fixed-real"`, so the ranking is the same whichever way the plan uses. Test "5b: ..." in
`module.test.mjs` (failed before).

## Stress test 2026-11-11 (claude-e, wave 2)
- **The best order on the first screen** (x-4): a filled `Use "<order>"` in the first card when it is not yours. The flat-rate note
  is the page's own notice in plain words with "Work out tax at the real rates" (it was builder words in `notes`; compute reports
  `bracketsOn`). My choice after review: choosing an order never switches the tax setting by itself, since the real rates move every
  retirement figure, often more than the order does; the green line says the order changes nothing until they are on. On a flat-rate
  plan the first card's filled button names both changes (`Use "<order>" with the real tax rates`) and its green line says every
  retirement page's figures change and how to go back; the rows' buttons set the order only.
