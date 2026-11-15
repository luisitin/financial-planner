# Risk  (`investments/risk`)

**Status:** usable (phase 7)
**Purpose:** How rough the ride of your mix is: the worst year and deepest fall history has dealt a mix like yours, in your own dollars.

## Inputs
Holdings (the mix held, collapsed to stocks/bonds/cash), the Allocation target, the history 1871-2025 (`investments/backtest`), the Assumptions page's volatility figures, the People page (years to retirement).
The history is Robert Shiller's monthly data (1871-1927) and Aswath Damodaran's yearly returns (1928-2025), bundled
by the Backtest page and free with attribution (the data files' headers; `docs/RESOURCES.md`). It holds stocks (S&P
with dividends), 10-year Treasuries, cash and CPI inflation; the cash column is a true 3-month Treasury bill from 1928
only (before it, the January 10-year yield stands in, "approximate" in its file). No code is taken from anywhere.

## Outputs
`main` (what you hold, or the target when there are no holdings): standard deviation, average, worst year and when, deepest fall (peak, trough, recovery), share of losing years, all also in dollars; `held`, `target`, `plan` (the assumed volatility), `comparison[]` (100/0 to 0/100), `verdict` (rough/moderate/smooth), `notes`.

With `params.stretch` (1, 5 or 10; any other value reads as 10) `compute()` adds `longer`: `{ rolling, sharpe: { main,
stocks, bonds }, together }` (gap list, next 60, item 52). Without it the output is what it was at 81a5288, key for
key and byte for byte (the module test checks every household in `qa/households` and the four fixture plans).
- `rolling(weights, { years, from = 1871, history })`: `{ years, n, from, to, worst: { rate, from, to }, middle, best,
  lost, lostShare, lostReal, lostRealShare }`.
- `sharpe(weights, { from = 1928, history })`: `{ ratio (null when it cannot be worked out: all cash), excess, spread,
  from, to, n }`.
- `correlation(xs, ys)`, `together({ from = 1928, recent = 2000, history })`: the three pairs `{ a, b, r, recentR,
  words, recentWords, from, recent }`; `togetherWords(r)`.

## On the page
First view: the headline ("A bad year could take about $X"), its sentence and the one-line meaning of "a bad year", the
notes, the four tiles, what you hold against your target (when they differ), and the first line of "What to do with
this". Then one card of quiet rows (`core/ui/more.js`; the opt spec's row for this page, C17, done here, so C17 skips
this page):
- **"6 more mixes"** (kind `more`): the standard mixes on your money and their sources line (a card until 2026-11-15).
- **"Ups and downs over longer stretches"** (kind `more`, a pinned title; status "10-year stretches" or "year by year"):
  first the mix it is about, by the headline's name ("for what you hold (90% stocks)", "for your target mix (70%
  stocks)", or "for your plan's mix (70% stocks, from the Will the money last? page, where you can change it)";
  critic P5, 2026-11-15: "a mix like yours (70% stocks)" read as the household's own figure where the plan
  only has the 70% it starts with); the sentences then say "this mix". Chips for 1, 5 or 10 years (10 first); one strip
  from the worst stretch to the best, red below zero, the middle marked ("red is a loss, the mark is the middle" under
  it), with the three figures and their years; one sentence on how many stretches lost money and one after inflation;
  "Return for each unit of ups and downs" (the Sharpe ratio in one sentence that says why it starts in 1928, "when the
  record of 3-month Treasury bills begins", critic P6, with all stocks and all bonds beside it, then "Its usual name is
  the Sharpe ratio"); "How the parts move together" (stocks and bonds, stocks and cash, bonds and cash, each in plain
  words with the figure since 1928 and since 2000; the note under them says in plain words what the figure is before
  its usual name, the correlation, critic P7).
- **"How this is worked out"** (kind `how`): the rest of the hero's small print (since 1970, what the plan assumes) and
  the other two lines of what to do.

The first view went from 445 words and 61 figures to 193 and 15 with a plan, and from 423 and 45 to 169 and 11 on the
empty plan, where the line on what "a bad year" means is not drawn because the headline names none (it is in "How this is worked out"); `tests/first-view.known.json` lowered. The hero's lede stays whole: `tests/wording-left.test.mjs` pins its
first two sentences together (the opt row keeps "one sentence"; that is the owner's or the lead's to change).

## Formulas
`runMix` over 1871-2025 and 1970-2025, `seriesStats`, `maxDrawdown` (`core/math/returns.js`). A "bad year" is one standard deviation below zero. The plan's own volatility is the root of the summed squared stock and bond terms (no correlation term).

**Stretches (rolling returns).** `R_t` is the mix's return in year t, rebalanced each year (`w_s s_t + w_b b_t + w_c
c_t`). For every start year `s` from 1871 with `k` years of history after it, the stretch's yearly rate is
`g = ((1 + R_s)(1 + R_{s+1}) ... (1 + R_{s+k-1}))^(1/k) - 1`; it lost money when `g < 0`. After inflation the same
with `r_t = (1 + R_t) / (1 + i_t) - 1`, `i_t` the year's CPI change: it lost buying power when that `g < 0`. Worst and
best are the lowest and highest `g`, middle the median (the mean of the two middle ones when the count is even). Since
1871 there are 155 single years, 151 five-year and 146 ten-year stretches.

**Return for each unit of ups and downs (the Sharpe ratio).** W. F. Sharpe, "The Sharpe Ratio", *Journal of Portfolio
Management* 21(1), Fall 1994, pp. 49-58, its ex-post form: the average of the "differential return" over its standard
deviation. Here `D_t = R_t - c_t`, the mix's year less the 3-month Treasury bill's that year, and
`S = mean(D) / stdev(D)` with the sample standard deviation (n - 1), on yearly figures. It starts in 1928, the first year
with a true bill record (before it the bundled cash is a long-bond yield standing in, which would flatter or punish the
ratio for no reason). The paper was not read online this session (this session's network reaches only www.irs.gov and
the package registries); the definition is the standard one and is written out here so the arithmetic can be checked.
No current figure depends on it. A mix with no ups and downs above the bills (all cash) has no ratio, and says so.

**How the parts move together (correlation).** Pearson's correlation of two classes' yearly returns:
`r = sum((x - mean x)(y - mean y)) / sqrt(sum((x - mean x)^2) sum((y - mean y)^2))`, over 1928-2025 (cash is the bill
series, so all three pairs use the same years) and again over 2000-2025, because the stocks-and-bonds link changed sign
around 2000 (0.02 since 1928, -0.36 since 2000). Plain words, the builder's bands, with the cut-offs at 0.2, 0.5 and 0.8
either way:

| correlation | words |
|---|---|
| 0.8 or more | move closely together |
| 0.5 up to 0.8 | often move together |
| 0.2 up to 0.5 | move a little together |
| above -0.2, under 0.2 | barely move together |
| -0.5 up to -0.2 | move a little in opposite directions |
| -0.8 up to -0.5 | often move in opposite directions |
| -0.8 or less | move closely in opposite directions |

Example (the family household in `qa/fixtures/family-plan.mjs`, its plan's mix of 70% stocks): over the 146 ten-year
stretches since 1871 it never lost money, from 1.1% a year (1929-1938) to 16.5% (1989-1998), 7.3% in the middle; after
inflation 16 of them (11%) lost buying power. Year by year it lost money in 36 of the 155 years. Since 1928 it earned
6.3% a year more than bills on average with ups and downs of 14.1% around that: 0.45 for each unit (all stocks 0.43,
all bonds 0.18). Stocks and bonds barely move together; bonds and cash a little.

## Edge cases
With no target chosen on Allocation, the comparison mix is the Projection's stock share and is called "The Projection's
mix", not "Your target mix" (2026-11-02).
International stocks, REITs and other assets are run as US stocks (the only series as long). Within five years of retirement and over 70% stocks a warning names the worst fall.
The stretch chosen is kept for the visit only, a choice of view (never in the plan, never stored); the page draws
itself again with the shell's `ctx.redraw()`, so the open row and the scroll stay.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`: on a made-up four-year history by hand, the 1-, 2- and 3-year stretches
(rates, years, the median for an even and an odd count, the losses before and after inflation), the Sharpe ratio, the
correlations (+1, -1, 0.8 and the made-up stocks and bonds), every band's words at its edges; every sentence; the drawn
rows (S11: the chips change the stretch and nothing is saved); invariance over every household.

## Ideas / not yet
- A Monte Carlo fan for the portfolio alone (the retirement pages have one for the plan); the efficient frontier (the
  map's O36), which needs more asset classes than three to say anything a person could act on.
