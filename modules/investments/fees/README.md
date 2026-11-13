# Fees  (`investments/fees`)

**Status:** usable (phase 7)
**Purpose:** What your funds and any advisor charge each year and what that costs over a lifetime.

## What a person sees
- **By default** (unchanged by gap #34): the headline ("Fees cost you about $205,346 over the plan"), one line with the
  yearly cost and how it splits, the tiles (a year, the average fund fee, over the plan, what index funds would keep), the
  holdings with their fee a year, and one quiet card with one shut row, **"Set my own numbers"** (status "none typed",
  or "3 set by you"). With no holdings: the hero, "Add holdings" (the one filled button) and the same row.
- **On request**, "Set my own numbers" (kind `own`, `core/ui/more.js`) holds one form:
  - "Advisory fee a year" (%), as before (it was its own hand-written fold "Advisory fee": now a `part()`, simple-first
    class A);
  - for each plan at work whose funds are on Holdings, "<account>: the plan's own fee, $ a year" (the first three; more
    plans under "More details (optional)");
  - "Trading and crypto fees this year" ($);
  - under "More details (optional)": "<account>: the plan's own fee as a % a year", for each plan at work.
  Above the form, what is counted now ("Sam's 401(k): $1,096 a year", under it "0.20% of $518,000 plus $60 a year"), and a line
  naming any plan at work with no funds on Holdings yet (its fee cannot be counted until they are there).
- **After a save**, the part stays open (R17) and the green line names the new answer when the headline changed (R7):
  "Saved. Fees now cost you about $626,891 over the plan, $1,615 a year today." With any plan or trading fee typed, the
  line under the headline names each kind of fee ("$519 in fund fees at 0.06% on average and $1,096 charged by your plan
  at work"); with none typed it is word for word what it was.

## Inputs
Holdings (expense ratios from the fund table or typed), `investments.advisoryFee` (a fraction of the portfolio a year),
`investments.planFees` and `investments.tradingFees` (gap #34, optional, below), `assumptions` and
`retirement.stocksNow` (the blended return), the People page (years to the plan's end, years to retirement), the
Contributions page (yearly contributions added until retirement; the employer match on a Roth row, for which Roth
accounts are plans at work).

- `investments.planFees?: { [accountId]: { pct?, dollars? } }`: a plan at work's own yearly fee, from its fee notice:
  `pct` a fraction of what is in the account, `dollars` a year; either or both. An entry is removed when both are blank.
- `investments.tradingFees?: { year, amount }`: trading and crypto fees in that year; removed when blank. Saved again
  unchanged, it keeps the year it was typed for.

## Outputs
`items[]` (fee a year per holding), `fundFees`, `advisoryYearly`, `feesYearly`, `weightedEr`, `allIn`, `years`,
`withFees`, `withoutFees`, `lifetimeCost`, `withCheap`, `cheapSaves` (at 0.05%), `priciest[]`, `unknownCount`,
`notes`, `endAge`; and only when a plan fee or trading fees are typed: `planFees[]` ({ accountId, name, value, pct,
dollars, yearly }), `planYearly`, `tradingYearly`, `tradingYear`, `otherYearly`. With neither typed, `compute()` gives
exactly what it gave before #34 (no new keys; the invariance test).

Pure helpers: `planFeeAccounts(plan, { today })` (the plans at work with funds on Holdings, with what is typed for each,
and the ones still waiting), `isPlanAtWork(plan, account)`, `headlineOf`, `ledeOf`, `savedWords`, `rateText`.

## Formulas
- `growWithFees(start, years, rate, fee, yearly, contribYears, growth)`: the balance grown at rate minus fee,
  contributions added at the end of each working year and growing with pay. The lifetime cost is the end value without
  fees less the end value with them, in the dollars of the end year.
- **Yearly cost** (gap #34) = Σ holding value × its fund's expense ratio + portfolio × advisory fee + Σ over plans at
  work (value of its funds on Holdings × plan % + plan dollars) + trading fees. `allIn` = yearly cost ÷ portfolio.
- **Lifetime cost**: the page's existing method, unchanged: `growWithFees` with fee = `allIn`. A flat dollar fee and
  the trading figure therefore count as their share of today's portfolio, every year.
- **Index funds would keep**: `growWithFees` with fee = 0.05% + plan fees ÷ portfolio (the plan's own fee is charged
  whatever fund you pick inside the plan), less the end value with every fee.
- **A plan at work**: an account of type `401k` (401(k), 403(b), 457, TSP), or a `roth` account that Contributions'
  `limitKind` counts against the 401(k) limit (a match, or a 401(k)/403(b)/457/TSP name). A Roth IRA is not one.
- **Source** (read 2026-11-13): the participant fee disclosure rule, 29 CFR 2550.404a-5 (Cornell LII copy,
  law.cornell.edu/cfr/text/29/2550.404a-5; the eCFR page did not open from here). Paragraph (c)(2)(i)(A): before the
  first investment and at least annually, an explanation of the fees for general plan administrative services and how
  they are allocated to accounts; (c)(2)(ii): at least quarterly, a statement of "the dollar amount of the fees and
  expenses ... that are actually charged (whether by liquidating shares or deducting dollars)" in the preceding quarter;
  (c)(3): fees for individual services (a loan) the same way; (d)(1)(iv)(A): each fund's total annual operating expenses
  as a percent and per $1,000. It is cited for where to find the figure (the help text: "Each quarterly statement shows
  the dollars taken: add up four"); the rule sets no fee, so there is no figure to check. Trading and crypto fees have
  no published figure either: they are the person's own.

## Builder chose (2026-11-13, gap #34; the spec left these open)
1. **One "Set my own numbers" part** holds the advisory fee too: the old "Advisory fee" fold was a hand-written
   `<details>` (R10), and one place for every fee the fund table cannot see is one tap, one Save.
2. **Dollars first, percent folded.** Every plan must show the dollars charged on each quarterly statement (rule above),
   so the dollar box is the one most people can fill; the percent from the yearly notice waits under "More details
   (optional)" and opens by itself once it holds a figure. Up to three plans' dollar boxes are in the first five boxes.
3. **The plan's funds on Holdings are its balance.** The page counts the money on Holdings; a plan at work with a balance
   on Net worth but no funds on Holdings gets no box (its fee would be counted against money the page does not count),
   and a line names it, with a link to Holdings.
4. **Trading fees count every year**, as a typical year, whatever year they were typed for; the help says when the figure
   is from an earlier year. The index-fund line drops them (buy and hold), as it already drops the advisor.
5. **Status "none typed"** when nothing is typed (the spec's own example); otherwise "N set by you".
6. The holdings note under "Each holding" is unchanged ("trading spreads are not counted"): the design leaves the first
   view as it was.

## Edge cases
Holdings with no expense ratio on file are listed as unknown and left out of the average (individual stocks: enter 0).
Loads, 12b-1 fees and spreads are not counted unless typed as trading fees. A plan fee typed for an account that is no
longer a plan at work, or no longer has funds on Holdings, is kept in the plan and not counted.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`: zero is identical (blank, zero and stray entries give `compute()`'s
output byte for byte, no new keys); a percent and a dollar fee and trading fees (the yearly cost, `allIn`, the lifetime
cost by `growWithFees`, the index-fund path keeping the plan fee; a Roth IRA is not a plan at work, a Roth 401(k) is);
the lifetime cost only grows as a plan %, plan dollars or trading fees grow; the plans that get a box and the ones
named as waiting; one sentence per case (nothing typed, word for word as before; a plan fee; trading only; all of them;
two plans; nothing to pay); the green line (R7); invariance over the invented households, the four fixture plans and the
empty plan on three days; the page on the fake DOM (first view unchanged and one shut part, no hand-written fold, the
boxes and the fold, the empty page's one filled button and its waiting line; S11 and R7 after a save, the status after a
reload, clearing every box takes the fields away, a trading figure saved again keeps its year).

## Ideas / not yet
- Fees as a share of expected return; fund alternatives by class.
- A flat plan fee could grow on its own (not as a share of the portfolio) if the page's method ever splits flat and
  percent fees.
