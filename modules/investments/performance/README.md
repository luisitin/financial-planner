# Performance  (`investments/performance`)

**Status:** usable (phase 7)
**Purpose:** Your true return from the balance points you save: what the investments earned and what you earned, against the plan and an index mix.

## Inputs
`accounts[].history` (`[{ date, balance }]`, written by "Save today's totals" on the Net worth page, which now records every account), deposits between points: the ledger's transactions for the account when it has any, else the Contributions page's yearly rate prorated; `assumptions` (the plan's expected return); Damodaran's yearly returns for the index benchmark.

## Outputs
`accounts[]` (`accountPerformance`: points, from/to, start, end, deposits, gain, `twr`, `twrAnnual`, `mwr`, `periods[]`), `overall` (value-weighted yearly time-weighted return, gain, deposits; the money-weighted figure when there is one account), `expected`, `benchmark` (`benchmarkOver`: the plan's stock share against bonds over the whole calendar years inside the span, or null), `notes`, `pointsNeeded`.

## Formulas
`core/math/returns.js`: time-weighted = Modified Dietz within each period, (end - start - flow) / (start + flow / 2), chain-linked, annualised over the span; money-weighted = `xirr` over the start value, each period's deposit at its midpoint, and the end value. Ported in spirit from Portfolio Performance (EPL), not code.

## Edge cases
Fewer than two points: the account is left out with a note. Under half a year of points the yearly figures are flagged as extrapolated. No whole calendar year inside the span: no benchmark.

## Tests
`tests/returns.test.mjs` (the maths), `tests/investments.test.mjs` (the page), `module.test.mjs`.

## Ideas / not yet
- Per-holding returns over a period once a value per holding over time exists (today only what was paid and today's
  value are kept, so "Gain on each holding since you bought it" is since each was bought); a chart of the value line with the deposits marked.
- Benchmark years run to 2025 (the bundled table): a stretch inside 2026 has no whole calendar year to compare with.

## Simple first (2026-11-13, opt C6)
"How this is worked out" (the two methods, Modified Dietz and the internal rate of return) is a part drawn by
`core/ui/more.js` (`part`, kind `how`, a folded card of its own; docs/OPTIONAL.md), title and words unchanged, so the first
view is the same. What changes: Settings > How much to show > "Show how answers are worked out" opens it on this phone, and a
person's own tap on it is kept for 90 days. The page saves nothing (S11 in `module.test.mjs`).

## Periods, your own benchmark, the gain on each holding (2026-11-15, gap list next 60, item 48)

**What a person sees.** The first view is the page as before (hero, tiles, each account, "Reading the two numbers"),
except that "How this is worked out" is now the last row of ONE parts card right under the tiles, with three new quiet
rows above it, all shut (`core/ui/more.js`, the helper's order more, own, own, how):

| row | kind | status | inside |
|---|---|---|---|
| "Gain on each holding since you bought it" (pinned title, `qa/first-view-lib.mjs`; was "Which holdings drove it", which read as what drove the stretch measured: critic P2) | `more` | "5 holdings" | each holding's gain since bought, best first, worst last; also on the page before any saved point (the one real figure it has then); not drawn until a holding has a price and a cost (a row with only a hint in it was left out: critic P6) |
| "Pick the period" | `own` | "every saved point", "1 year", "your own dates" | chips: This year so far, 1 year, 3 years, 5 years, Since the first saved point (on by default), My own dates (two date boxes) |
| "Compare with" | `own` | "plan's 70% stocks" / "set by you" | chips: Your plan's mix, 40%, 60%, 80% stocks, All stocks, Yours, Type my own (stocks, bonds, cash) |
| "How this is worked out" | `how` | | as before |

**Pick the period** changes only what this page measures, for this visit: the chosen stretch lives in the view's module
memory (never in the plan, never on the phone; a reload goes back to every saved point, Back keeps it). A pick redraws
with the row open (R17). Each account is measured from its saved point nearest the asked start to its point nearest the
asked end (the end of a quick period is today), with the same Modified Dietz chain and `xirr` as the whole span. The
sentence under the chips, one per case (`words.js` `periodSentence`, each tested):
- every point: "From 10/31/2021, the first saved point, to 10/31/2026, the last."
- a quick period within 3 days (`NEAR_DAYS`) of both dates asked: "From 11/13/2025 to 11/13/2026."
- moved: "From 10/31/2025 to 10/31/2026: the saved points nearest to a year ago and to today." (ytd: "the start of the year")
- asked back before anything saved: "From 9/16/2025 to 9/16/2026: your saved points go back only to 9/16/2025."
- this year so far, from a point in the year: "From 4/30/2026 to 10/31/2026: your first saved point this year and the one
  nearest to today." "This year so far" never starts more than a month (`YTD_SLACK_DAYS`, 31) before 1 January: a point
  saved in December counts as the start of the year, one from the autumn before does not (the figure would be mostly last
  year's: critic M2). With no point in that window but the last, there is nothing to measure: the red line below.
- own dates: "From 4/30/2023 to 4/30/2025, as you asked." / "You asked for 1/1/2022 to 6/30/2024; the nearest saved points are 10/31/2021 and 4/30/2024, so those are measured."
  Two dates that take in every saved point (the two the boxes start with, or wider) are "Since the first saved point":
  the status stays "every saved point" (critic P6).
- no two points in the stretch: a red line, the row open (`fix: 1`, status "1 to fix"), and the page shows every saved
  point instead: "No two saved points fall in that stretch, so there is nothing to measure in it. The page shows every saved point instead."
An account with points elsewhere but at most one inside the stretch is left out of it with its own note ("... is left out
of this stretch: just one of its saved balances falls in it."), not the one that sends you to Net worth.

**Compare with** keeps an optional `investments.benchmark` = `{ stocks, bonds, bills }` (fractions adding to 1; one
read as absent otherwise, `ownBenchmark`). A chip tap or the form's "Compare with this mix" saves it at once through
`ui.undoable` (the tap is the person's own choice; no modal), and the open row says the new answer in green with Undo
(R7): "Saved. You now compare with 80% stocks and 20% bonds, which made +11.0% a year over 2021-2025.". With no whole
calendar year of the yearly returns in the stretch, the green line says so and why, and the line under the chips is not
drawn (it would say it twice; critic P1: a "Saved" with no figure read as a promise): "Saved: you will compare with all
stocks." and one sentence per case of `compare.why`: "late", the stretch starts after 1 January of the last year of the
returns (2025, `LAST_RETURN_YEAR`), so none can fit: "No figure: the yearly index returns here end with 2025, and the
stretch measured starts after 1/1/2025."; "picked", a stretch picked holds no whole year but every saved point does: "No
figure for the stretch picked, which holds no whole calendar year; since the first saved point there is one."; "short":
"No figure yet: that needs your saved balances to cover a whole calendar year, January to December." The same sentence
stands alone under the chips when nothing was just saved.
The boxes open with a saved mix to a tenth of a percent (a third each is 33.3, which adds to 99.9 and is taken; whole
percents gave 99, refused: critic M4), and take a tenth. The green line after Undo is brought wholly into view
(`ui.reveal`), so the shell never repeats it at the bottom of the screen (critic P5);
the plan's chip removes the field ("Saved. You compare with your plan's mix again: 70% stocks and 30% bonds, ...");
Undo says "Back to comparing with 70% stocks and 30% bonds, as before.". The three boxes must come to 100 ("These add up
to 90%. Make them come to 100%."). A ready-made chip equal to the plan's share is not drawn twice. The hero's clause, one
per case: none / "a plain 70/30 index mix made ..." (as before, `benchmarkOver` untouched) / "your own mix of 80% stocks
and 20% bonds made ...".

**Gain on each holding since you bought it** reads Holdings (`drivers()`): each holding with a price and a cost; the others are named in
one line ("Left out: X (no price typed in), Y (no cost typed in)."). Above ten holdings the best five and the worst five
are shown with "N more in between." (no part inside a part, R11). Intro, one per case: up "Since each was bought, your
holdings are up $39,440 on the $128,000 you paid (+30.8%). Best first, worst last." / down "... are down ..." / none
"Type what you paid for each holding on Holdings, ...". On a page that measures a stretch: "This counts from when each was
bought, not the stretch the page measures: the app keeps no record of each holding's value over time." Each row:
"+40.0% on $30,000 paid · 30% of the whole gain", with "since Nov 2021" or "about +8.7% a year since Nov 2021" from the
Tax lots. Only records count as lots: a null or a stray value in a hand-edited or imported file is left out, as Tax lots
does (it broke the whole page: critic M1), and a lot dated after the price date (a slip such as 2030) gives no "since"
and no yearly rate (critic M4). Share words per case: "N% of the whole gain" / "takes N% off the whole gain" / "N% of the whole loss" / "makes
the whole loss N% smaller".

**Formulas** (each tested in `module.test.mjs`):
- asked start: ytd = 1 January of today's year; N years = the same day N years before today (29 February -> 28 February);
  every point = the first saved point. Nearest point = the fewest days either way, the earlier on a tie (`nearestIndex`).
- own mix, yearly r = s x stocks + b x bonds + c x bills over the whole calendar years inside the stretch, chained:
  total = prod(1 + r) - 1, a year = prod^(1/n) - 1 (`mixOver`). The yearly returns are the bundled table
  `modules/retirement/historical/data/returns.js` (Aswath Damodaran, NYU Stern, "Historical Returns on Stocks, Bonds and
  Bills", S&P 500 with dividends, 10-year US Treasury bond, 3-month Treasury bill, 1928-2025; free with attribution, as
  that file says). No new figure: 80/20 over 2021-2025 is about +11.0% a year from that table (the test's hand chain).
- holding: gain = value - cost (value = shares x price, from Holdings); return = gain / cost; share of the whole = gain /
  sum of gains (adds to 100%; none when the whole gain is 0); contribution = gain / sum of costs (adds to the whole
  return; kept in the output for a later view). With lots that cover the shares (within 0.5%): since = the first lot's
  month; when their cost is the holding's (within 1%) and the first is a year or more before the price date, a year =
  the internal rate of return (`core/math/returns.js` `xirr`) of each lot's cost on its date and the value on the price
  date. Standard return attribution (contribution = weight x return), written from the definition, no code taken.

**Builder's choices** (the brief left them open): the period is module memory, not `whatIfs` or the phone (the brief: "for
this visit"); a chip saves at once with a green line and Undo instead of asking first (low stakes, one tap back); the
own mix offers the three classes the bundled table has (stocks, bonds, cash), not other indexes; a period shorter than a
year keeps the page's own headline rule (a yearly figure, "so far" under 0.9 years, the extrapolation note under half a
year) rather than a second way of saying the return; the drivers list shows every holding up to ten (a cut inside a part
would nest a part).

**Invariance.** With no `period`, no `parts` and no `investments.benchmark`, `compute()` has 81a5288's keys and bytes
(test "invariance" over the four fixture plans, qa/households, and plans with saved points); `parts: true` adds
`period`, `drivers`, `compare` and nothing else moves; the chip "Since the first saved point" is the page as it was.
