# Backtest  (`investments/backtest`)

**Status:** usable (phase 7)
**Purpose:** Any stocks-and-bonds mix run through the years since 1871, side by side with another: growth, the worst years, the deepest fall.

## Inputs
`data/shiller.js` (1871-1927 from Robert Shiller's monthly data via `tools/extract-shiller.py`: S&P price plus dividends, a 10-year bond bought at January's yield and sold a year later, the January long yield as a stand-in for cash, CPI) and `modules/retirement/historical/data/returns.js` (Damodaran 1928-2025); page state: the two mixes (your target, what you hold, or presets 100/0 to 0/100), the start year, real or nominal.
Both sources are free with attribution (the data files' headers; `docs/RESOURCES.md`); no code is taken from anywhere.

For "Add or take out money each year" (below): the Contributions page's yearly total (`retirement/contributions`
`compute().totalYearly`, the employer's match included), the spending in retirement Will the money last? counts
(`buildInputs().spendingYearly`, before its health line; the typed monthly figure times 12 when the plan cannot run
yet), and what is invested (the holdings' value, else the balances of brokerage, 401(k), IRA, Roth, HSA, 529 and crypto
accounts: the Risk page's rule).

## Outputs
`runMix(weights, { from, to, start, real })`: `values[]` (growth of 10,000), `cagr`, `stats`, `worstYear`, `bestYear`, `drawdown` (depth, peak, trough, recovery years), `bestTen`, `worstTen`, `lossShare`; `compute()` returns runs `a` and `b`, the mixes, presets, start years, notes. `HISTORY` and `toHistoryWeights` are shared with the Risk page.

`withFlows(weights, { from, start, yearly, dir, years, history })` (gap list, next 60, item 52): every stretch of
`years` consecutive years from `from`, `{ n, starts: [{ start, end, ranOut, lasted }], ranOut, worst, middle, best,
minLasted, maxLasted, history }`, or null for a way other than "in" or "out"; an amount or start that is not a finite
number counts as 0. `flowChoices(plan)`: `{ saving, spending, healthOnTop, invested }` (null where the plan has none;
`healthOnTop` is true when Will the money last? adds a health line on top of that spending).
`compute(plan, { ..., flow: { dir, yearly, start, years } })` adds `flow: { a, b }` (only for `dir` "in" or "out");
without `flow` its output is what
it was at 81a5288, key for key and byte for byte (the module test checks every household in `qa/households` and the
four fixture plans).

## On the page
First view: the headline, the notes, the mix chips with their one-line answer, the growth chart. Then one card of quiet
rows (`core/ui/more.js`):
- **"9 more numbers"** (kind `more`): the two mixes side by side and the sources line (the "Side by side" card until
  2026-11-15; the opt spec's row for this page, C17, done here, so C17 skips this page). Seven to nine rows: the ten-year
  stretches show only when the history holds ten years.
- **"Add or take out money each year"** (kind `own`, a pinned title): "Put money in" or "Take money out", and the answer
  right under those two chips: one written sentence for the first mix, what it leaves out when money comes out
  ("This leaves out Social Security, pensions, pay and the health insurance your plan adds on top: ..."), one
  sentence for the second mix, and the link "If history repeated runs your whole plan ›" (a 44 px row). Then how much a
  year (the plan's own figure for that way, "Your yearly saving: $18,870" or "Your retirement spending: $84,000", or
  "Type my own", which opens on the figure the chip shows); what there is at the start ("What you have invested:
  $177,000", "Nothing", or "Type my own"); for 10, 20 or 30 years (30 first); a line picture of what is left after each
  start year. "Clear" starts over ("Cleared. Nothing was saved."). The row says the amount and its way when shut
  ("$84,000 out a year").

The first view went from 335 words and 33 figures to 220 and 17 (`tests/first-view.known.json` lowered).

## Formulas
Yearly rebalancing: the mix's return each year is the weighted sum of the classes' returns. Real returns divide by (1 + inflation). Ten-year stretches are compound rates over every ten consecutive years.

**Money in or out each year.** With `R_t` the mix's return in year t (rebalanced, as above) and `i_t` that year's CPI
change (both data files carry it), the year's return in today's dollars is `r_t = (1 + R_t) / (1 + i_t) - 1`. The
amount `F` is in today's dollars and moves at the **start** of each year, raised with prices (so in today's dollars it
is the same figure every year). With `V` at the start of year t:
- put in: `V <- (V + F)(1 + r_t)`;
- take out: if `V >= F`, `V <- (V - F)(1 + r_t)`; otherwise the money **ran out** in year t: it paid the full amount
  for `lasted = t` years and `V = 0` after (a part payment is not counted as lasting).

This is the same as running in each year's dollars with the amount raised by each earlier year's inflation and the end
divided by the prices' rise since the start (the module test checks both ways by hand). A stretch is `years`
consecutive years from each start year `s` from `from` to `last - years + 1`, so there are `last - from - years + 2`
(69 thirty-year stretches from 1928 to 2025). **Worst start**: when some ran out, the one that ran out soonest (a tie:
the lower end); otherwise the lowest end. **Middle**: the median end (the mean of the two middle ends when the count is
even). Best: the highest end.

Example (the family household in `qa/fixtures/family-plan.mjs`, its plan's mix of 70% stocks, from 1928): putting in its
$18,870 a year on top of its $177,000 for 30 years ended with between $1,233,779 (the 1952 start) and $4,187,105 (the
1970 start) in today's dollars, $2,796,845 in the middle; taking out its $84,000 of retirement spending from the same
$177,000 ran out in all 69 stretches within one or two years. $40,000 a year from $1,000,000 ran out in 4 of the 69
(the worst start, 1966, in 1992).

## Edge cases
The first mix is your target when you chose one on Allocation, else what you hold (`defaultA`); with no target the chip
reads "The Projection's mix", not "Your target" (2026-11-02).
Before 1928 the cash figure is approximate (a note). No fees, no taxes, one rebalance a year. The chart is log-scaled (a `log` option added to `modules/retirement/charts.js`).

Money in or out (builder's choices, 2026-11-15, nothing asked of the owner):
- The amount goes in or out at the start of each year (not monthly, not at the end): the history is yearly, and money
  that is there for the year earns that year's return.
- Always in today's dollars, whatever the "Dollars of each year" chip says: a nominal end after 1928-1957 and one after
  1996-2025 cannot be compared. The stretches start from the "Starting in" chip's year, so the 1871-1927 data is used
  only when the person picks 1871.
- Taking out the retirement spending takes all of it from this money: Social Security, pensions and pay are not counted,
  and the figure is the one Will the money last? spends before the health insurance it adds on top (`healthOnTop`; none
  when "My spending figure already includes health insurance" is ticked). The answer's second line says so, and the row links If
  history repeated, which runs the whole plan (critics M1 and P3, 2026-11-15: the verdict read alone, "ran out in all
  69", was scary and the list of what is left out had no health insurance). A typed amount gets the line without the
  health insurance (the person chose the figure). The default stays the plan's whole spending over 30 years: a figure
  less Social Security and pensions would need their start ages, which differ from the retirement year.
- The answer sits under the two chips of the way, above the amount, the start and the stretch (critic P2: under all
  four rows it was 488 px below the tapped chip, off an 844 px screen). After a pick inside the row the answer is
  scrolled into sight, the least distance, when it and the chips just tapped fit on the screen together (`bothInSight`,
  80 px kept for the top bar), as Rebalance does its trade's answer; otherwise the page stays, so the thumb's chips never
  leave the screen (a 320 px phone with typed figures). A chip above the row and Clear move nothing. The labels sit on
  their chips (one block each), which keeps the open row under the 1,300 px of R15 at 390 px (1,207 to 1,288 px).
- The chips carry figures, not words (critic P1: "Type my own" opened its box on "plan"); the plan's own figure is
  kept as "plan" or "invested" so a typed amount and the plan's are told apart when the way changes.
- An amount paid out exactly in the last year "lasted ... with nothing left" (critic M2), never "ended with $0". The
  money boxes keep the kit's ceiling (under a billion: "That is more than a billion: check for an extra digit.").
- The start defaults to what is invested; "Nothing" is offered (saving from scratch); taking out from nothing, or from
  less than one year's amount, says so in its own sentence instead of 69 stretches that ran out at once.
- A history shorter than the stretch (from 2010, 30 years) says so and offers a shorter stretch or an earlier start.
- Kept in the page's own memory, beside the mix chips, until the app is closed or the page reloaded (the row's first line
  says so: "Nothing is saved: a reload or closing the app starts this over", critic P4); another plan loaded in the
  same tab starts it over. While a way is picked the row is drawn open, so a tap on a mix chip above keeps its answer in sight;
  a person who shuts it keeps it shut (the shell puts back a row shut by hand).
  Never in the plan, never in the browser's storage, so no `docs/DATA_MODEL.md` field.
- The page now draws itself again with the shell's `ctx.redraw()` (open rows, the scroll and the tapped chip stay); its
  own wipe-and-draw is the fallback where the shell gives none.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`: the made-up three-year history by hand (in, out, ran out part way,
paid down to nothing exactly, inflation raising the amount, the median, a stretch longer than the history), the plan's
figures, every sentence case, the drawn rows (S11: one tap, typed figures, Clear, nothing saved, only this row changes)
and the invariance over every household; the critics' findings (2026-11-15) each have a test: the box opens on the
figure, the answer's place, the left-out line with and without the health insurance, the 44 px link, "nothing left", a way
that is neither in nor out.

## Ideas / not yet
- More asset classes if a long series (Simba's sheet) is added; money in or out each month (the history is yearly).
