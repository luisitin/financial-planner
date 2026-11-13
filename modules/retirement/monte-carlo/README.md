# Chance the money lasts  (`retirement/monte-carlo`)

**Status:** usable (phase 5); `heavy: true` (runs on the PC through `/api/compute/retirement/monte-carlo` when connected)
**Purpose:** The plan run thousands of times with returns drawn at random: the share of runs where the money lasts, and the range.

## Inputs
The projection inputs; `params.paths` (default 2,000; the server caps at `compute.maxPaths`), `params.seed`. From the plan, all
optional (gap #17, 2026-11-13): `assumptions.carefulChance` (how careful the spending that lasts is; 9 in 10 when not set),
`assumptions.goodChance` and `assumptions.okChance` (the person's own lines for strong and fair; 85 and 70 when not set).

## Outputs
`successRate`, `medianEndReal`, `failAges` (p10, p50, count), `bands[]` per year (p10..p90 of real total), `byAge[]` (share still funded), `verdict` (strong >= 85%, fair >= 70%, weak; or the plan's own lines).

## Formulas
`drawSequences`: lognormal yearly simple returns with the plan's arithmetic mean and standard deviation for stocks and bonds. For gross return `G = 1 + R`, set `v = ln(1 + (s / (1 + m))^2)`, `sigma = sqrt(v)`, and `mu = ln(1 + m) - v/2`; then `G = exp(mu + sigma Z)`. The requested `corr` (default 0.1) is the correlation of the sampled simple returns, not the hidden normal draws: the normal correlation is `ln(1 + corr * sqrt((exp(vStocks)-1)(exp(vBonds)-1))) / (sigmaStocks * sigmaBonds)`. With zero volatility, the draw returns the configured mean directly, so deterministic compounding is exact. This is the standard lognormal moment conversion (Aitchison and Brown, *The Lognormal Distribution*, 1957).

The 99.9% checks in `tests/montecarlo-stats.test.mjs` use the two-sided normal quantile 3.290526731 (NIST/SEMATECH e-Handbook, Normal Distribution) and the lognormal skewness `(exp(v)+2)*sqrt(exp(v)-1)` and excess kurtosis `exp(4v)+2exp(3v)+3exp(2v)-6` (Aitchison and Brown, 1957). The standard-error estimate for the sample standard deviation is `s*sqrt((excessKurtosis+2)/(4n))`, the large-sample variance formula for the sample variance followed by the square-root delta method. The correlation check uses Fisher's `atanh(r)`, whose standard error is `1/sqrt(n-3)` (Fisher, “On the probable error of a coefficient of correlation deduced from a small sample,” 1921).

The share of successful runs is a sample proportion `p`; its standard error is `sqrt(p(1-p)/n)` (NIST/SEMATECH e-Handbook, Binomial Distribution). `binomialStandardError(p, n)` in `core/math/montecarlo.js` returns this value. The convergence test compares independent fixed-seed estimates and uses the square root of the sum of their two variance estimates. In the worked statistical tests, all return assumptions and seeds are invented examples; 20,000 draws are used for the distribution checks as requested, and the success-rate comparison uses 5,000 and 20,000 paths.

## No Social Security in the plan (2026-11-01)
When an adult has no Social Security figure and has not said they get none (`overview/setup` `ssMissingFor`, the same check as the
Dashboard's "Retirement: Needs Social Security"), the page opens with a notice from `modules/retirement/ss-notice.js`: "Social
Security is not counted yet, so this page looks worse than it is", a filled "Add Social Security" and an outlined "We won't get
Social Security", which saves the setup's own `guide.setup.ss[personId] = "none"` so it is never asked again. Before, only a
grey sentence at the end of a paragraph said why the plan looked short.

## Tests
`tests/montecarlo-stats.test.mjs`: reproducible seeds, exact zero-volatility compounding, 99.9% mean and standard-deviation intervals, lognormal skew and kurtosis, joint return correlation, success-rate convergence, and the binomial standard-error helper. `tests/retirement-pages.test.mjs`: ordered bands and the server cap.

## Ideas / not yet
- Random inflation; fat tails (historical bootstrap); the chart's touch readout.

## The careful spending figure (round 5, 2026-11-02)
`spendingAtChance(inputs, { chance = 0.9, seed = 1, legacy = 0 })` is the most a year (today's dollars, whole $100s, the same
every year after inflation, as `affordableSpending` does) that still lasts to the end, and leaves at least `legacy` (Goal
seek's goal), in at least 9 of 10 of the market paths drawn around the plan's returns. It returns it with `rate` (the share
that lasts at that figure), `planned` (the share that lasts at the plan's own spending spent the same way: steady spending,
whatever withdrawal rule the plan picked) and `average` (affordableSpending: every year earning exactly the average return).
- **The paths:** the seed's first 2,000 (`drawSequences(2000, years, { seed: 1 })`), the Chance page's own draw, whatever
  `paths` a page asks `compute()` for (it passes its own draw when it holds 2,000 or more). So the figure is the same on
  every page and between visits, and a plan that spends exactly the careful figure lasts in at least 9 of 10 of the paths
  the Chance page counts (review 2026-11-02: the figure was worked on 300 other paths, and $110,100 lasted in only 88% of
  these; it is $109,000 now). For a steady-spending plan `planned` is exactly the Chance page's `successRate`.
- **The search:** a first guess on the first 300 paths (halving the gap between a figure that lasts and one that does not,
  to $100), then settled on all 2,000: a figure a little above the guess (4%, at least $1,000) that falls short, one below
  that lasts, and the gap halved to $100. A path that lasts at some spending lasts at any less, and one that falls short at
  some spending falls short at any more, so each path keeps the most it lasted at and the least it fell short at, and only
  paths whose answer is not known yet run again: about 3,900 to 4,000 runs of the projection on the fixtures (`runs`),
  where the 300-path search alone took about 4,200. Tests check the answer against every path run in full.
- **A slice at a time:** `carefulSteps(inputs, options)` is the same search as a generator that yields every 40 runs and
  returns the same object; `modules/retirement/careful.js` drives it between frames on a phone (or asks the PC), so the page
  is drawn first and never freezes while it works (review 2026-11-02: the page was blocked for about a second).
- On the fixtures the average figure lasts in only about 4 of 10 markets (retirement fixture: $131,224 against $109,000;
  the family: $111,897 against $90,200). `compute()` carries the careful figure as `careful`; `careful: false` leaves it
  out (the Chance page itself and the reports, which do not show it). The projection's verdict and `affordable` are
  unchanged (frozen answer keys).
- **Zero:** when even spending nothing falls short in more than 1 path in 10, the figure is $0 and the pages show no
  careful line. That happens today for a partner's pay with little in savings: `core/math/retirement.js` takes the tax on
  income above spending from savings (`need = max(0, spending - income)`, with the tax on top). Paying that tax from the
  income instead changes seven frozen answer keys (roth-conversions-irmaa-010 to -100, `table.0.bracketTop`), so it waits
  for the owner.

## Follow-up 2026-11-07: one plain way of saying the odds
The owner's standing words: "It should feel easy for a layman ... not ... concepts / words too hard to understand." Every page that says how often
the money lasts now uses `modules/retirement/odds.js` (`chanceWords`, re-exported by `careful.js`; `BAD_RUN` = "even in a bad run of years",
`BAD_RUN_NOTE` = "(only 1 in 10 is worse)"). A "pretend future" is one made-up run of good and bad years; the share of pretend futures in which the money lasts is the
chance. The words, after "the money lasts": 100% "in every pretend future we ran"; 90% or more "even in a bad run of years"; 45% to under 60% "about half
the time"; under 10% "in fewer than 1 of 10 pretend futures"; else "in about N of 10 pretend futures" (N rounded down, never 9 under 90%); with the number
"(93 of 100)" after "of 10 pretend futures", else "(93 of 100 pretend futures last)", where it helps. No page says "markets" for a try ("9 of 10 markets", "every market tried", "simulated markets",
"100 markets" are gone; "if markets do as well as average" stays: it means average returns, not a try). The amber pill "fewer than 9 in 10" is
"short in a bad run". Decision (no owner to ask), changed after the UX review of 2026-11-07 (it found "tries" unexplained where it first appears): "pretend futures", which explains itself, over "tries" or "runs".
This page's "runs" are "tries" (the stat "Chance the money lasts" over "2,000 pretend futures"; "the middle pretend future"; "Trying your plan 2,000 times..."; the picker "1,000 pretend futures (quick)"). Reports > Retirement says "In 93% of 2,000 pretend futures the money lasts"; Advisor plan and Compare say "400 tries of good and bad years", not "400 simulated markets".

Money/UX review follow-up (2026-11-07): the heading is "Chance the money lasts" (the menu name; it said "How often does the money last?"); "Runs on this device." is gone
(only the build view says where it runs); the lede says a pretend future is one made-up run of good and bad years mixed at random; at 100% the verdict says "every pretend
future", not "almost every".
Final check (2026-11-07): a plan that cannot run yet reads "First, the plan needs ..." (`core/words.js` `needsWords`), then the Will the money last? link; it read "The projection needs a few things first: see Will the money last?. Will the money last?" when nothing was listed.

## Stress test 2026-11-11: one chance for one plan on Compare (W7, claude-e)
Compare read 78% for "Your plan" while this page read 80% (its 400 pretend futures against these 2,000). Decision by claude-b as
coordinator: this page's figure is the plan's figure. After a run the view calls `retirement/careful.js` `rememberChance`,
which keeps `successRate` for the visit under the projection's inputs and the day (`chanceKey`: change anything that moves the
figures and it is another plan); Compare reads it with `knownChance` and shows it for the plan, each copy moved by its own
difference on Compare's shared draw. When this page has not run the plan, Compare says "about" and rounds to the nearest 5.
The draw is now two steps, `drawShocks(n, years, seed)` (the standard normal luck of each year, in the order it was always
drawn) and `shapeSequences(shocks, { stocks, bonds, stdevStocks, stdevBonds, corr })`, so several versions of a plan can meet
the same years; `drawSequences` is the two together and returns exactly what it did before (tested).

## Left2 merge 2026-11-11 and fix round 1 (2026-11-12): the careful figure, settled on the plan spending it

The engine lets a working year's pay pay its own tax (projection README, "Left2 merge", B2), so on
`qa/fixtures/retirement-plan.mjs` Medicare's income-related surcharge rises in 2060-2065, and the health line moves with
spending. A search on the plan's own inputs therefore gives a figure that a plan spending it may not quite keep: at $110,100 a
year the first search gives $97,800, and a plan spending $97,800 lasts in 0.8985 of the 2,000 paths. Fix round 1 (M-1, B-8):
`carefulSettled` (used by `compute()` and by `careful.js`, so every page has one answer) runs the plan again with the figure
typed; while that plan lasts in fewer than 9 of 10 paths, its own careful figure is taken and checked the same way: $97,700
(0.899), then $97,600 (0.9005), at most 5 more searches. A figure that already lasts is kept: the fixture's own $78,000 plan
still gets $96,900 (0.9085). Only a typed spending figure is settled this way (not Get started's own figure, not one typed
over today's bills). The test is back to "at least 9 of 10" (it had been loosened to 0.895), on the figure the page shows.
Before/after for the test's own plan: first search $97,800 (0.8985), shown $97,600 (0.9005).
Source: the app's own rules; no outside figures.

## Simple first, and how careful the answer is (opt C14 and gap #17, 2026-11-13)

The owner, 2026-11-12: "Default to less is more and allow more complexity or toggles." 2026-11-13: "it should stay simple by
default. There should be ways for you to upgrade the complexity and the depth of it." The page is drawn with
`core/ui/more.js` (docs/OPTIONAL.md); `view.js` writes no `<details>` by hand.

**What a person sees by default** (an answer page, R3 to R5): the heading "Chance the money lasts", then one `ui.stat` with its
words, "80 of 100 / pretend futures where the money lasts to 2085", then one sentence for the case, then one card of three quiet
rows. While the plan is tried: "Trying your plan 2,000 times...". A plan that cannot run: "First, the plan needs ..." with one
filled way on (`needs.js`). The Social Security notice stays first when it applies (R9).

The sentence per case (`answerFor`, each pinned by a module test):

| case | the stat | the sentence |
|---|---|---|
| every | 100 of 100 | Strong: the money lasted in every pretend future. |
| strong | 93 of 100 | Strong: the money lasted in nearly every pretend future. |
| fair | 80 of 100 | Fair: it lasted in most pretend futures, but not all. A little less spending or a little more saving moves this a lot. |
| weak | 50 of 100 (under 1: "under 1 of 100") | Weak: it ran out in many pretend futures. Look at spending, the retirement age and Social Security timing. |
| none | 0 of 100 | Weak: the money ran out in every pretend future. Look at spending, the retirement age and Social Security timing. |
| strong, own lines | 80 of 100 | Strong: that is at or above the 75 of 100 you call strong. |
| fair, own lines | 86 of 100 | Fair: under the 95 of 100 you call strong, at or above the 80 you call fair. A little less spending or a little more saving moves this a lot. |
| weak, own lines | 75 of 100 | Weak: under the 80 of 100 you call fair. Look at spending, the retirement age and Social Security timing. |

**One tap away** (one card, the helper's order):
- **"N more numbers"** (kind `more`; 2 tiles plus the ages): typical amount left, when it ran out (or "Ran out: never"), the
  range of outcomes chart with its note, and "Still funded at..." for ages 70 to 95, its bars green from the line for strong,
  amber from the line for fair.
- **"Set my own numbers"** (kind `own`, status "9 in 10", or "N set by you"; built when opened, since it works out the careful
  figure): "How careful should the spending that lasts be?", the chips "3 in 4" / "9 in 10 (usual)" / "19 in 20" and "Type my
  own" (one percent box, 60 to 99, whole numbers; shown as "Yours: 4 in 5"), the spending that lasts at that chance in its own
  words ("Even in a bad run of years (only 1 in 20 is worse), the money can pay for about $76,500 a year ($6,300 a month) on
  top of health insurance."), "We call the chance strong from 85 of 100 and fair from 70.", and a form whose two boxes, "When we
  call it strong" and "When we call it fair", wait under "More details (optional)", with their Save: while the line is shut it
  is the last thing in the part and no Save shows (critic of g34, 2026-11-13: a filled Save stood under no boxes, and a tap on
  it only said to open the line). Open (a tap, a box holding a saved line, or Settings' "Show every box in forms"), the boxes
  and the Save.
- **"How this is done"** (kind `how`, the title it had): the lede that was on the first view, the way each pretend future is
  drawn, the lines for strong and fair, and "How many pretend futures to try:" as three chips, "1,000 (quick)" / "2,000" /
  "10,000" ("10,000 (best on your computer)" in the builder's view). They were a drop-down before; a box in the parts card
  outside a form is a control the page keeps for itself (docs/OPTIONAL.md R32, check S15), and a reading part holds no box
  (R30), so the three choices are chips (R23), drawn by `choice()` with no "Type my own". The number is kept for the visit
  only (module state, never the plan); a chip tries the plan again (`ctx.redraw`) and saves nothing, and wave 1 keeps the
  part as the person left it.

**Saves** (R7, R17): a chip saves at once (`store.update`), the part stays open and its green line names the new answer: "Saved.
The spending that lasts now has to last in 19 of 20 pretend futures." "9 in 10 (usual)" takes the field away again: "Saved. The
spending that lasts is back to the usual 9 of 10 pretend futures." The lines' Save says what the plan now reads, from the last
run (the lines never move the chance): "Saved. At 80 of 100, your plan now reads strong." Refused: fair at or over strong ("The
chance you call fair (70 of 100) has to be under the one you call strong (65).", nothing saved). A Save with nothing changed says
"Nothing to save yet: type when you call it strong, fair or both." (or "Nothing changed: ..."). An
empty box removes its field. Every save is inside "Set my own numbers": after one, that part alone opens on the next
draw with its green line, said once (the module test named "S11", docs/OPTIONAL.md R17).

**Formulas** (`compute.js`, pure; every one tested in `module.test.mjs`):
- `asCarefulChance(x)` = `x` when it is a number from 0.5 to 0.99, else `CAREFUL_CHANCE` (0.9); `carefulChanceOf(plan)` =
  `asCarefulChance(assumptions.carefulChance)`. `compute()` passes `params.chance` (read by `asCarefulChance`) to
  `settledAtChance` as `chance`, or `carefulChanceOf(plan)` when no chance is asked for, so the PC and this device work the same
  figure; with nothing set it is the old call, byte for byte (tested; and a one-off run of the old `compute.js` from c5779a2
  against the new one over 1,414 plans, every qa/fixtures plan and every household variation, gave 1,414 identical results, 28
  of them with the careful figure).
- `carefulSteps` already took `chance`: the most whole $100 a year that lasts in at least `ceil(chance x paths)` of the 2,000
  paths. More careful can only lower it: at 19 in 20 it is no more than at 9 in 10, which is no more than at 3 in 4 (tested on
  the retirement and family fixtures: the family's $79,700 at 9 in 10 is $76,500 at 19 in 20).
- `linesOf(plan)` = `{ good: goodChance or 0.85, ok: min(okChance or 0.7, good) }`, each read only from 0.01 to 1.
  `verdictOf(rate, lines)` = strong when `rate >= good`, fair when `rate >= ok`, else weak. compute()'s `verdict` uses it.
- `perHundred(share)` = `floor(share x 100 + 1e-9)`, never 100 unless every one (580 of 2,000 is 29, not the 28 that
  `floor(0.29 x 100)` gives in floating point).
- `inWords(share)` = the smallest whole "N in M", M up to 100 ("19 in 20", "17 in 20", "3 in 4"); `badRunNote(chance)` = "(only
  1 in 20 is worse)" from `inWords(1 - chance)`; at 9 in 10 it is odds.js's `BAD_RUN_NOTE`, "(only 1 in 10 is worse)".
- `retirement/careful.js` re-exports these. `whenCareful(ctx, el, done, { legacy, chance })` works the figure to the chance a
  page asks for, 9 in 10 when it asks for none, here and on the PC alike (the chance goes with the run), and `carefulKey` adds
  the chance to the key when it is not 9 in 10 (the usual key is unchanged). A page asks for the plan's own chance only when it
  says that chance in words (`badRunNote`): today this page's part. Will the money last?, How much to take out, Required
  withdrawals and Goal seek say odds.js's fixed "(only 1 in 10 is worse)", so they ask for none and keep the 9 in 10 figure
  their words describe (critic of g34, 2026-11-13: with 19 in 20 chosen, Will the money last? said "(only 1 in 10 is worse)"
  beside $76,500, the family's figure at 19 in 20; its figure at 9 in 10 is $79,700). Tested: a page that asks for none gets
  the 9 in 10 figure and key for a plan that chose 19 in 20, and the PC is sent that chance; this page's answer equals the PC's
  compute for 19 in 20; a view that asks for the plan's chance says it with `badRunNote` and never `BAD_RUN_NOTE`.

**Sources for the chips and the lines** (read 2026-11-13):
- Fidelity, "About Your Score" (nb.fidelity.com, Planning and Guidance Center): "A significantly below average market is
  defined as the 90% confidence level of estimated future balances", "A below average market is defined as the 75% confidence
  level", and an average market the 50% level. Hence "9 in 10" (the usual, the app's own since round 5) and "3 in 4". 50% is
  the page's "if markets do as well as average" figure already (Will the money last?), so it is no chip.
- T. Rowe Price, "How Monte Carlo analysis could improve your retirement plan" (troweprice.com, Insights): "We guide them to
  aim for a Confidence Zone of 80% to 95%". Hence "19 in 20", its top, for a worrier.
- The lines 85 and 70 are the app's own since phase 5; T. Rowe Price's 80% to 95% zone and the bands calculators use (85% and
  up strong, 70% to 85% moderate, under 70% needing attention, per robberger.com's survey and ryanoconnellfinance.com's
  calculator, both secondary) agree with them. They are conventions, not rules: hence the person's own lines.

**Builder chose** (the spec left these open):
- The heading stays "Chance the money lasts" (`tests/plain-words-followup.test.mjs` pins it: "the heading is the menu name"), so
  the answer is one `ui.stat` with its words (R3 allows either).
- The boxes say "strong" and "fair", the page's own verdict words, not the spec's "good" and "close".
- "Type my own" for the careful chance, 60 to 99 (below 60 is not careful; 100 has no figure); stored only when it is not 9 in 10.
- The careful figure is worked out only when "Set my own numbers" is opened (`lazy`), so the page's first run is no slower.
- "Still funded at" shows each share rounded down (`perHundred`), as the stat does: 99.6% reads 99%, never 100% unless every one.
- System > Assumptions' "Reset to defaults" puts these three back to the usual too (it rewrites the whole section).
- The design's test 5 ("every page that shows the careful figure shows the same one") waits: the other pages that show it say
  "(only 1 in 10 is worse)" in their own files, which this change does not edit, so they keep the 9 in 10 figure until each
  says the chance it is handed (`badRunNote(c.chance)`) and asks for the plan's own (`whenCareful(..., { chance:
  carefulChanceOf(plan) })`). True words first; one figure everywhere after.
