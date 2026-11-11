# What matters most  (`scenarios/sensitivity`, was "Sensitivity", then "What changes your answer")

**Status:** usable (phase 9)
**Purpose:** Which of your numbers matter most: returns, inflation, when you retire, how much you save, Social Security, each nudged down and up, ranked by how much it moves the answer.

## Inputs
Everything `retirement/projection` `buildInputs` reads. Params: `today`. Writes nothing. `heavy: true` (22 spending searches, about 900 projections).

## Outputs
`{ ready, missing, base: { affordableMonthly, spendingMonthly, endReal, success, runsOutAge, failYear, lastAge }, rows[], measures, measure, runoutCap, biggest, headline, ssMethod, noSavings?, nothingSaved?, usualLine? }` (`noSavings: true` with no rows: nothing saved and nothing going in, 2026-11-11; `headline` the sentence under the page's headline, `nothingSaved` and `usualLine` fix round 1, 2026-11-12; `measures`, `measure`, `runoutCap`, the run-out fields and `biggest` as the widest row that moves `measure`, fix round 2, 2026-11-13); each row `{ id, label, help, more?, baseLabel, low, high, swing, worse, moves }` (`more`: the detail behind the row's "More about this", 2026-11-12; `moves`: `{ spend, end, runout }`, whether it moves each measure, fix round 2) with `low`/`high` = `{ label, affordableMonthly, endReal, success, runsOutAge, failYear, lastAge }`, sorted by `swing` (the monthly spending between the two ends), largest first.

## The nudges (`NUDGE`), one at a time, everything else as the plan has it
| input | low / high |
|---|---|
| Stock return, bond return, inflation, pay raises | 1 percentage point down / up |
| The first person's retirement age (when not yet retired) | 2 years earlier (never before next year) / later; the plan rebuilt, so saving stops and spending starts then |
| How long the plan runs | every adult's plan-end age 5 years shorter / longer |
| Saving into retirement accounts | 25% less / more |
| When Social Security starts | everyone claiming at 62 / at 70 (when the plan has Social Security figures) |
| Social Security paid in full | `SS_PAYABLE_IF_DEPLETED` = 77% of benefits / in full. 2025 Social Security Trustees Report: the retirement (OASI) trust fund runs dry in 2033, after which about 77% of scheduled benefits are payable from incoming taxes. |
| Stocks in retirement | 20 points less / more (kept between 0% and 100%) |
| Flat tax on withdrawals (flat-tax mode only) | 5 points less / more |

The measure is the largest steady, inflation-adjusted spending that lasts to the end (`affordableSpending`, as on Will the money last?), a month; the second measure (chips) is what is left at the end, today's dollars.

## Edge cases
Not ready without the plan basics. "We don't know yet" and no rows with no retirement savings on file and nothing going in (2026-11-11). No retirement-age row once retired; no saving row once retired, and with nothing going in the saving row's high end is the usual share of pay (2026-11-11); no pay-rise row without contributions; no Social Security rows without figures; no flat-tax row in brackets mode.

## Tests
`module.test.mjs`: the eleven rows for the family and their order, one end checked against a hand-made change (stock return, Social Security cut), the direction each input pushes, the rows that drop out.

## Review fix 2026-11-02 (who can still claim)
"When Social Security starts" moves only who has not claimed and is under 70 (the Social Security page's `claimed`, as Goal seek does), from now (to the month, never before 62) to 70; the row says when the others already get it, and is left out when nobody can still choose.

## Review 2026-11-02 (round 5)
- "Social Security paid in full" (the 77% trust-fund row) has its own condition again: any Social Security in the
  projection, paid already or still to come. The previous fix had put it behind "someone can still choose a claiming
  age", so a retired couple who both get it lost it and was told "How long the plan runs" mattered most, while the
  method note still described the 77% row.
- People left out of "When Social Security starts" are named by reason: "Lee only: Sam already gets it" or "Lee only: Sam
  is 70 or over, when waiting adds nothing" (before, "the others already get it" also covered someone 76 who never claimed).
- When the trust-fund row is the biggest, the headline leaves out its "in full" end, which is the plan as it stands
  ("77% instead of in full cuts it by $1,040 a month", not "...; in full raises it by $0").
- The low end reads "now (64 and 6 months)" only when that age is within a month of everyone moved (`nowForAll`, as on
  Goal seek); a couple of 64 and 60 reads "at 64 and 6 months", since it is 19 months away for the younger one.

## Review 2026-11-02, round 5 (second pass)
The method note ("How it is worked out") said "whoever has not claimed yet and is under 70 claiming as soon as they
can (62, or their age today) or at 70", but everyone moved claims at the same age, the oldest one's age today: a
couple of 64 and 60 both move to 64 and 6 months, not 62 for the younger one. The sentence is now built in compute
(`ssMethodNote`, returned as `ssMethod`) from the rows as they were made: "Social Security: Sam and Lee claiming at the
same age, the older one's age today (62 at the earliest), or both at 70; and the 77% that would be payable...", "Sam
claiming at today's age (62 at the earliest) or at 70" for one person, and only the trust-fund part when nobody can
still choose.

## Ideas / not yet
- Nudges sized by each input's real uncertainty (a standard deviation) instead of round steps; two inputs at once (a heat map); the Monte Carlo chance as a third measure.

## Review 2026-11-06 (round 7): you and your
- Review 2026-11-06 (round 7): the retirement row's label, the claiming row's note and `ssMethodNote` say you/your for the unnamed first adult and "your spouse" for Get started's partner ("When you retire", "your spouse only: you already get it", "Social Security: you and your spouse claiming ..."), via `core/words.js`; typed names read as before. Test: "review 2026-11-06 (round 7)".
Final check (2026-11-07): the list of what the plan still needs uses the words every page uses (`core/words.js` `needItem`: "a birth date on the People page", "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"). Test in `tests/wording-verify.test.mjs`.
The sentence above the bars says the month planned to the dollar ("against the $7,000 it plans"); what the plan can pay for stays at $10.

## Loans in the spending figure (2026-11-11, loans lane fix round 1, money review D11)
The runs on this page spend a loan the figure holds only until its payoff, as Will the money last? does (they use the same
engine inputs). The one figure this page prints as "spending" is the figure itself, loans included; it is not lowered for the
years after a payoff. Left as it is: What matters most compares runs, and each run has the payoff in it.

## Owner's request 2026-11-11 (L1): gated, the saving row when nothing goes in, a plain title
- **Title "What changes your answer"** (module.js and docs/MODULE_CATALOG.md; "Sensitivity" was jargon, AGENTS rule 14), then
  "What matters most" in fix round 1 (below). The manifest's `aliases` keep the old names for search.
- **Gated like Will the money last? and Goal seek.** With no retirement savings on file and nothing going in, the projection's own
  rule (`savingsUnknown`) says "we don't know yet"; this page now says the same: "We don't know yet", one line, and one filled
  "Add what you own ›" (Net worth). Before, Sam's page read "When Sam retires moves your plan the most" over 7 of 9 rows of
  "$0 / $0" (review notes ux F3). compute returns `{ ready: true, noSavings: true, rows: [] }` and works out no rows (the
  projection is run only when the cheap half of the rule holds: no invested balance and no contribution in the engine inputs).
- **The saving row when nothing goes in** (`usualSaving`; it was left out exactly for Casey and Morgan, where it matters most).
  The row reads "How much you save: now nothing"; low end "nothing" (the plan as it is); high end, for each adult who still works
  for pay (job pay on Income today, retirement ahead, not "retired" or "not working" on Get started) and has nothing going in, a
  contribution row on a copy of the plan, run through the projection's own `buildInputs` (as if typed on Retirement
  contributions):
  - own money a year = `usualShare(plan, id, today)` x job pay: Vanguard, *How America Saves 2026*, the median share of pay put
    in by pay and age (the figure Get started's "Not sure" guess uses; `overview/guesses/estimators/saving.js`); at a plan at work
    at most the year's 401(k) limit (`deferralLimit`, IRS Notice 2025-67: $24,500 in 2026 under 50);
  - the match, only at a plan at work (a `401k` the person owns, or Get started's "plan at work: Yes") and not when the person said
    there is none (`workPlans[id].match === false`): a formula typed on Work benefits on the pay a plan counts (`compLimit`,
    $360,000 in 2026), else the usual match, `matchTerms().value x min(1, share / matchTerms().needed) x pay` (Vanguard's median
    match is worth 4% of pay and takes 6% put in to get all of it; the `contrib.match` estimator's own formula);
  - into the person's own 401(k), else their IRA or Roth IRA, else no account (taxable savings).
  The label and the line under it were first "6.6% of pay" / "the usual share" and "nothing goes in now; the high end is what people
  paid about the same usually put in ..."; fix round 1 (below) put them in money and in sentences. No pay-raise row while nothing
  goes in. Casey (invented, phone walk): $2,336 a month now, $2,945 at 6.6% of pay with the match;
  Morgan: $751 now, $2,047 at 5.4% into the IRA.
  Rules followed (spec decisions D-A4 and D-A5, written for the lever list on Will the money last?): "The 'usual' alternatives
  come from sourced tables only. Saving at work: `usualShare` ... The match: the `contrib.match` estimator / `matchTerms()`
  (median value 4% of pay, earned in full at 6% put in) ... The 50%-up-to-6% tiers (`career/benefits/compute.js:24`) are a
  second, older convention ... do not use it"; "A match alone adds $0 when nothing goes in, so the two are one row".
- Tests (`module.test.mjs`, "L1: ..."): the gate on the renter household (no rows, the same rule as the projection and Goal seek,
  one filled button, no "$0"); the usual share and match against the estimators' figures and a hand-typed row (said = done); the
  IRA case with no match, "No match" kept, the 401(k) limit at high pay, nobody added when something goes in or there is no pay;
  the title.
- Not done here: a plan with some savings that can pay almost nothing still shows small or $0 ends (the review's idea: switch the
  measure under 10% of the plan); regrouping into "Things you decide" / "Things nobody knows" (five rows first came on 2026-11-12, below); a link to this page
  from Will the money last? (the "Go deeper" card, L2).

## Fix round 1 of the owner's request 2026-11-11 (2026-11-12): money a person can act on, limits, a true headline
The critics walked L1 on the phone and by code (findings M2, M3, P3, P5, B1, B4, B5).
- **Title "What matters most"** (P5): "What changes your answer" was cut in the top bar at 390 px ("What changes your an…", one of
  two usable titles cut); "What matters most" fits and is the spec's own name for the Go deeper link (section 2A). Aliases:
  "sensitivity", "what changes your answer", "which numbers matter most", "tornado chart". Catalog row updated.
- **The saving row when nothing goes in, in money** (M2, P3, B7): the high end reads "$400 a month + $240 match" (own money a
  month, the match a month; couples summed). Under it, one line (`help`) says what the high end is, that the match is the usual
  one and not the job's own, and "still short" when even the high end is under the plan's spending:
  "Nothing goes in now. The high end: what people with pay like Casey's usually put in, plus the match most jobs add (Casey's job
  may differ). Still short of the $3,090 a month the plan spends."
  The rest is one tap away, behind the row's quiet "More about this" (`more`; simple first, below): each person's share and
  dollars and where they go, the match's amount, and the plan's figure with the person's own money alone (one more
  `affordableSpending` on the rows typed with no match): "Casey: 6.6% of pay, about $400 a month. The usual match: about $240 a
  month; HR can tell you the real one. With Casey's own money alone, the plan could pay about $2,720 a month."
  At the 401(k) limit the line reads "the most allowed in a 401(k) in 2026, plus the match most jobs add (...)" and the detail
  "Casey: the most allowed in a 401(k) in 2026, about $2,040 a month (people with pay like Casey's usually put in 7.7% of pay)".
  The match is `matchTerms` (spec D-A4, quoted above); Retirement contributions' "common match" words are L3's.
- **Limits outside a plan at work** (M3): an IRA up to the year's IRA limit for the age (`limitsFor(year).kinds.ira`, $7,500 in
  2026, plus `catchUpFor` $1,100 from 50; IRS Notice 2025-67, `retirement/contributions/data/limits.js`); a Roth IRA (a `roth`
  account `limitKind` reads as an IRA) only while household pay (joint returns: both adults' pay) is under the top of the Roth IRA
  income range for the filing status (`rothPhaseOut`, $168,000 single, $252,000 joint in 2026), a share of the limit inside the
  range; the rest of the usual share in a row with no account (other savings, taxable). Pay stands in for the income the range is
  read on. The high-earner qa household's Henry now puts his usual share into other savings, not "Henry's Roth".
- **Working age only** (B5): `usualSaving` skips anyone under `WORK_AGE` (16): a birth year typed in the future (2080 for 1980)
  made a person aged -54 a "$25,490 a month" row and the headline. The projection's acceptance of a future birth date is claude-c's
  (handed over in the fix log).
- **The headline never compares the plan with itself** (B1; `heroLine`, pure, exported): an end that is the plan as it is, or that
  moves it by under $5 a month, is left out ("nothing instead of nothing raises it by $0 a month" showed on 592 of 1,368 qa plans,
  7 of the 13 base households). The saving row says what to do: "If Maya put in 6.0% of pay (about $320 a month) plus the usual
  match, as people with pay like Maya's usually do, the plan could pay about $1,390 a month more."; two people "If Carlos put in
  7.5% of pay (about $750 a month) and Jen 5.2% (about $200 a month), plus the usual match, ...". No sentence when nothing moves.
- **Gated with nothing saved said** (B4): with a 401(k), IRA or Roth on file (even at $0) or Get started's "None" (goal-seek's
  `nothingSaved`), the hero says "Nothing is saved for retirement yet, and nothing goes in, so we can't say which of your numbers
  change the answer most. That is common; once something is saved or goes in each paycheck, add it and come back." and one grey
  line from the usual saving, run as typed rows (`usualLine`): "If Riley put in 4.7% of pay (about $150 a month) plus the usual
  match, the plan could pay about $1,940 a month of the $2,040 it plans." The gate and its one filled "Add what you own ›" stay.
- Tests (`module.test.mjs`, "L1 ..." and "fix round 1 (...)"): the gated words and line (said = done on a hand-typed row), the
  untold words; the row's label, line, detail and own-money figure against hand-typed rows; the IRA limit with and without the
  catch-up, the Roth range, the high-earner household, the future birth date and a child; the headline on the single-adult and
  two-parent qa households and `heroLine`'s rules; the title and aliases.

## Simple first, detail on request (owner, 2026-11-12; done with fix round 1)
The owner: "Default to less is more and allow more complexity or toggles. We want subtle optional complexity." The page showed
ten or eleven rows, a seven-line note under the saving row and an open card of reading help. Now the first view is the answer,
five rows and one way on; everything else is still there, one quiet tap away. Nothing here changes a figure or the plan.
- **Five numbers first** (`SHOWN` in view.js): the five that move the plan most, then a fold "N more numbers" ("they move it
  less") with the rest, ranked on in the same list. No fold when it would hide a single row (six rows show all six). The fold
  stays open while the measure is switched ("What you can spend" / "What is left at the end"); that is remembered while the app
  stays open (a module-level flag, like the measure), never in the plan. Both folds are `fold` rows of `core/ui/base.css` (44 px). The growth and rising-prices rows the owner named are always on the page, in
  the fold when they move the plan least (spec D-A2: "always listed, in the fold if need be").
- **"More about this"** under a row that has more to say (`more`; today the saving row when nothing goes in): the shares, the
  match's amount, the own money alone. Rows with nothing more have no fold.
- **"How to read this"** is a folded card (it was the open card "Read it like this"). Inside it, the one way to the figures we
  use says "Check the figures we use ›" and lands on the stock-growth box (`#/system/assumptions?show=returnStocks`). Fix round 1,
  P8: an outlined "Assumptions" button sat under a green "8.0%" bar, the one place on the two pages that still invited changing a
  return (spec D-A7: "The growth row's action is 'Check ›', never 'Raise'").
- **One way on**, outlined, under the list, in Goal seek's own words for this plan: "What it would take ›" while the money runs
  out, "How far each change could go ›" while it lasts. The page has no filled button (the gate's "Add what you own ›" aside).
- Test: "simple first (owner, 2026-11-12) ..." (every row on the page, five outside the fold, the fold's count, the saving row's
  detail, one "check" link, the way on, no fold for six rows).

## Fix round 2 (2026-11-13): a number that moves nothing is not "what matters most" (N1), and simple first, tighter
Re-check 1 found (N1): on qa 01-single-adult and 10-student the page listed "6.0%: $0 / 8.0%: $0" rows among the five that
matter most, every bar under "What is left at the end" read $0, and on 131 of 1,364 qa plans the headline said "How much stocks
earn moves your plan the most" over a $0 bar. The plan there can pay for no steady spending with any setting.
- **What a row moves** (`compute`, pure). Three measures, all from the one `project()` run per setting the page already makes:
  `spend` (`affordableSpending` / 12, the steady spending a month), `end` (`endBalanceReal`, today's dollars) and `runout` (how
  long the money lasts: the engine's own `failAge`, the first adult's age in the year the money runs out; a side that lasts counts
  as `runoutCap` = one more than the latest last age of any run, shown "lasts"). `valueOn(side, m, cap)`, `moveOn(row, base, m,
  cap)` = the larger of |low - base| and |high - base| on that measure, `swingOn(row, m, cap)` = |high - low| (the bars' order).
  A row moves a measure when `moveOn >= MOVES[m]`: $5 a month (the same edge `heroLine` uses, under the $10 the page rounds to),
  $500 at the end (under the $1,000 it rounds to), one year of age. Each row carries `moves = { spend, end, runout }`.
- `measures` = the measures some row moves; `measure` = "spend" when it is among them, else "runout", else the first; `biggest` =
  the row with the widest swing on `measure` among those that move it (null when none does); `headline` = `heroLine` on "spend",
  `runoutLine` on "runout" ("How much stocks earn: at 6.0% instead of 7.0%, the money lasts to age 74 instead of 77; at 8.0%, to
  age 81."; an end at the plan's own age is left out; "lasts to the end" when it does), none on "end".
- **The page** lists only the rows that move the measure shown, widest first. The rest go in the fold, after the ones that move it
  less, each as its name and settings with "no change here" and no bar; the fold's line says "they change nothing here" (or "they
  move it less, or not at all"). With no row moving anything: "None of these numbers changes the answer", the run-out year, and
  "More saved, or less going out, would: see what it would take". A measure nothing moves is not offered.
- **"More about this" stays open** while the measure is switched (N6: it closed itself; a module-level set of row ids, never the
  plan).
- **Simple first, tighter** (owner, 2026-11-13: "it should stay simple by default. There should be ways for you to upgrade the
  complexity and the depth of it"; the workflow's reading: the answer, at most three rows, one action). Choices:
  - **three numbers first** (`SHOWN` = 3, was five), then "N more numbers" with all the rest, even a single one (the rule allows
    three rows before any tap). Every row is still on the page. Spec D-A2's "5 rows" is for L2's lever list on Will the money last?;
    this page follows the owner's newer word.
  - **the measure chips are folded** under "Measure it another way" (after the rows). Its line names the other measures ("what is
    left at the end, how long it lasts"), and once the person picks one it says "showing how long it lasts" (rule 4: a folded part
    holding something the person changed says so). It stays open while they switch; the caption above the bars always says what
    the bars show. No fold, and no chips, when only one measure moves anything.
  - **the hero is the answer**: "As it stands the plan can pay for about $2,340 a month of spending, after inflation, against the
    $3,090 it plans." and the headline sentence. How the numbers were nudged ("Each of your plan's numbers is nudged down and up,
    one at a time ...") is the first line of "How to read this". A plan that can pay for no steady spending says when the money
    runs out instead of "about $0 a month": "As it stands the money runs out in 2048 (age 70), and the plan can't yet pay for any of
    the $3,035 a month it plans."
  - on a phone (480 px and under) a fold's line goes under its title ("7 more numbers" / "they move it less"): the title was cut in
    two next to a long line at 320 px. Scoped to this page's root.
  - on "How long it lasts" the bars' ends read "6.0%: to 74" ("lasts" when it reaches the end) and the caption "The line is your
    plan as it is: to age 77" ("age 63: age 65" read like two ages). With nothing moving anything, the hero says it once and the
    card does not repeat it.
  - nothing here changes a figure or the plan; opening, closing or switching changes nothing (tested).
  - kept as it was: the "More about this" fold under the saving row, "How to read this" and "How it is worked out" folded, the one
    outlined way on, no filled button. Nothing a person could do before was removed.
- Tests (`module.test.mjs`, "fix round 2 (...)" and "simple first (...)"): the qa single adult (only the saving row moves: one row
  first, seven "no change here" in the fold, the chips are the two measures that move, "How long it lasts" lists the rows that
  change the run-out age, `moves` checked by hand, the run-out age is the engine's), the qa household that turns its retirement age
  today (nothing moves: no headline, the words), `runoutLine`'s four cases, every qa base household (the headline's row moves the
  measure shown, every measure offered moves a row), "More about this" kept open, three rows first, the measure fold and its line,
  the hero without the method sentence.
