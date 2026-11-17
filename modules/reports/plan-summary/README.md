# Plan summary  (`reports/plan-summary`)

**Status:** usable (phase 9)
**Purpose:** Gives you a printable overview in the style of an advisor's plan: where you stand, goals, protection and next steps.

## Inputs
Through the pages that work each figure out: People, Net worth, Next best action (each month's money), Plan health score, Will the money last?, Chance the money lasts (`SUMMARY_PATHS` = 1,000 paths, seed 1, capped by the PC's `maxPaths`), Stress tests, Goals, Debts with the Pay off debts plan's dates, Life timeline (the next `MILESTONE_YEARS` = 10 years), Social Security, and the assumptions. Writes nothing. `heavy: true`.

## Outputs
`{ ready, missing, today, household, netWorth, cashflow, health, retirement, protection, goals, debts, milestones, nextSteps, assumptions }`: figures only; the view writes the sentences.

## The document
An opening paragraph in plain words (who, when the spending years start, what you own and owe, whether the money lasts and the chance it does, the health score), then: where you stand, each month, retirement, protection (stress tests), goals, debts, the next ten years, next steps (Next best action's next step and the health score's biggest gains), plan health, assumptions, and a dated footnote. `../report-kit.js` draws it as a sheet on screen; "Print or save as PDF" writes the same sheet into a document of its own with a light palette and letter-size page margins, and prints it (the browser's dialog also saves a PDF). No global print styles are needed.

## Edge cases
No people: not ready. No plan basics: the retirement, protection and health sections drop out or say what is missing; the rest still prints. A blocked pop-up: the button says to allow pop-ups.

## Tests
`module.test.mjs`: not ready without people; the family's figures match each page's own; the debt dates agree with the timeline; milestones stop ten years out.

## Both payoff dates (round 4, 2026-11-02)
`debts[].ownPayoffDate`: the Debts page's date (its own payment) when it is later than the payoff plan's `payoffDate`, else null. The sheet notes under the table that the dates are the payoff plan's and gives the own-payment date for those debts.

## Goals waiting their turn (review 2026-11-02)
A goal alerts' `goalsBehind` queues (nothing in yet, its turn on Next best action comes later and it can still be reached
from then) has status `"starts later"` and `startsIn` ("September 2027"); the table shows "starts September 2027" without
amber, as Goals and the Timeline say.

## Each month adds up (review 2026-11-02)
The "Each month" table lists every line of Next best action's spare: income before tax, business costs, federal income
tax (a credit reads "+"), Social Security and Medicare, the state's income tax, spending, retirement saving, saving for
goals, the extra on debts (Pay off debts) and side income above what you count on, after its tax (Side income's "count
on"), each optional line only above $0.50, so the rows add up to "Spare" or "Short". The note under it says how the state
tax is counted (local taxes are not) instead of "State and local income tax is not included", which was wrong once the
state's tax came off the month.

## Ideas / not yet
- The advisor's plan side by side (`scenarios/advisor-plan`), a net-worth chart, a cover page with the household's name; a monthly or yearly copy saved with the date.

## Average markets, said so (round 5, 2026-11-02)
"Can carry a month" reads "You could spend each month if markets do as well as average", and the sentence under it starts "If markets do
as well as average, the plan can carry about $X a month more than it spends ... less in a bad run of years". The Monte Carlo run
passes `careful: false` (the careful figure is not shown here).

## Review 2026-11-06
- **Every report finishes (fix round 6).** The page draws its compute's answer through `settleReport` (report-kit): a
  compute that failed (the shell's `{ error }`), a drawing that throws or a remote call that rejects shows "The plan summary
  could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates
  and the ages on the People page, then reload the page." in place of the loading line. A scan of all 1,406 qa households
  and the fixtures found no other report that hung; for the four "older than 120" households (born 1900) this page's
  compute fails inside the retirement projection, and the page read "It starts from:" with nothing after it. Test: reports/tax "every report finishes
  when its figures cannot be worked out (settleReport)".

Review 2026-11-06 (round 7): the opening ("This plan is for you (36), your spouse (38) and Cy (6)") and the assumptions ("Retirement at 65 for you, 62 for your spouse") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js; view only, no compute change).

## Round 8 review (2026-11-06): the same answers as the score and Goal seek
- Retirement, when the plan cannot carry its spending: the Plan health score's hint (`retirement.hint`: Goal seek's own
  answers for the money lasting, e.g. "To make the money last: save about $240 a month more. Open the Goal seek page to see the amount that just makes it last."), not
  "spend about (planned - what it can carry) a month less", which for an invented renter carrying $0 of $2,040 was all of the
  spending and still did not make it last. Without the score: "the plan needs more saving, a later retirement or less spending:
  Goal seek works out each."
- Stress tests: when the cut that would make a shock last is at least the whole planned spending, "even spending nothing would
  not make it last" instead of "about $2,040 a month less spending would make it last".
- Debts: "If you keep paying today's payments, the Visa card runs to ..." (was "On its own payment ...", read as "paying the
  minimum"; Credit cards).
- Test: `module.test.mjs` ("review UX"), failing before the fix.

## Wording follow-up (2026-11-07)

- The month's figures follow Next best action's rule (to the dollar, also with uneven pay held back). Goal amounts, the stress cuts and what the plan can carry keep the $10 their own pages show. Net worth, what you own and what you owe are the Net worth page's figures to the dollar ($287,100), not rounded to the thousand; estimates ("leaving about $871,000") keep the thousand.
- The health score is "76 out of 100" in both places and its parts are "2.2 out of 15" (scores are said in words, never "/").

Review fixes (2026-11-07): with no retirement savings entered the summary says "Retirement: not known yet" and shows "Not known yet" in grey (the same words as Will the money last?), not a red "money runs out" and "0% chance"; the sentence says "pretend futures", the words the odds use. The state is spelled out (Texas, not TX). Goal targets, the stress cuts and what the plan can carry keep the $10 their own pages show; the month, net worth and debts are to the dollar.

## Our guesses, marked (smart guesses C8, 2026-11-14; spec 15 C8; tests `tests/guess-reports.test.mjs`)
A printed figure that rests on our guesses says so, so a sheet handed to an advisor never passes a guess off as a fact.
- `modules/reports/guess-marks.js` (pure): `marksOf(plan)` reads the guesses in use (core/estimate `guessesInUse`: the ledger
  and Get started's older flags) into which balances, pay lines, bills, debt rates and payments, goal amounts, retirement
  spending and Social Security figures are ours; `sumMark` marks a sum "guess" (every part ours) or "partly" (some);
  `debtMarks` a debt's owed, rate and payment. Words (`MARK_WORDS`, report-kit `marked`): "(our guess)", "(partly our
  guesses)", "(our estimate)" (a figure worked out where nothing was typed, spec 8.4: retirement spending taken from today's).
- compute: `ours` (`summaryMarks`), only while a printed figure is ours (the "our estimate" mark only with `params.estimates`,
  which the sheet passes), so a plan with no guess computes byte for byte as before: net worth
  and what you own, owe, hold in cash and have invested; the month's income, spending and retirement saving; planned spending
  in retirement, Social Security and the savings by then; each goal's amount; each debt's owed, rate and payment. The
  savings by then are not marked when nothing saved for retirement is on file (`savingsUnknown`) or they come to $0: that
  figure is not one we filled in (critic F3: "$0 Saved by then (our guess)" beside "Retirement: not known yet").
- view: the mark goes after the label of a big figure ("Net worth (partly our guesses)") and after the figure in a table
  ("$4,200 (our guess)"); one line before the foot says what the marks mean and where the real figures are typed.
- With nothing saved for retirement on file (`retirement.unknown`, "Retirement: not known yet"), the Retirement section says
  "Retirement savings: Not entered yet" in place of "$0 Saved by then", and "Protection: the stress tests" says only "The
  stress tests need your retirement savings first. Add what you have saved, and the plan is tried against ten shocks, from a
  market crash to a job loss or a long life." (critic F4: "survives 0 of 10 shocks ... runs out at 65" under "not known
  yet"). The compute is unchanged; the sheet says it.
- The other sheets do the same with their own `ours`: Retirement (planned spending, savings by then, each Social Security
  figure), Statements (each account, each income and spending line, the totals), Annual review (today's net worth), Tax
  (withholding worked out from pay: "(our estimate, worked out from pay)"); Export lists them in a file of their own, "Our
  guesses" (list, name, column, value), while one is in use, so every other file keeps its columns (critic F4: a last column
  that came and went with the guesses broke a sheet built on them); the whole-plan JSON already carries the ledger (`guesses`).
  "If something happens to us" prints no money figures and is unchanged.

## One answer for retirement on the whole sheet (z2, 2026-11-16)
Every invented household was drawn as the shell draws it (the qa fixtures, the 14 base households, the phone-built ones, the
round 8 households, the Get started personas, the demo). The sheet's own retirement answer already used Will the money last?'s
gate (`savingsUnknown` on the same projection run; the page's extra params change no verdict, checked for every household).
What contradicted it was on the same sheet, in the Plan health score's words: for Riley (the renter-debt fixture: 24, an empty
Work 401(k), nothing going in) the lead said "Retirement: not known yet" and the Retirement section "Not known yet", then Next
steps said "Retirement on track. Once you start saving, add it and we can answer." and the health table "Retirement on track 0 out
of 25". The same on the second Riley fixture and for the personas Sam and Jordan, and on no other household.

Only where the sheet's answer is "not known yet" (`retirement.unknown`, Will the money last?'s gate), so every other sheet reads
exactly as before:
- Next steps: the score's retirement step is the sheet's own (`UNKNOWN_STEPS`, `unknownStep`), an action in one sentence per case,
  whatever the score itself waits for: told us nothing is saved, "Start saving for retirement. Once you add what you have saved,
  we can say whether the money will last."; told us nothing, "Add your retirement savings. Once they are on the Net worth page,
  we can say whether the money will last." (fix round, 2026-11-17: the step read "Retirement: not known yet. Once you start
  saving, add it and we can answer.", a label with an "it" that named nothing, critic P1; and for a plan with no Social Security
  entered it asked for Social Security under an opening that says nothing is saved, because the score checks Social Security
  first, critic M1. Social Security is still on the score's own list, "The plan knows enough".)
- Plan health table: that part's row is `UNKNOWN_PART`, "Retirement", and the parts that wait for the same answer
  (`NOT_KNOWN_PARTS`: retirement, and protection, whose stress tests "need what you own first, like the retirement part") read
  "not known yet" (the Plan health page's own words, `notKnown` on the part) instead of "0 out of 25". Every other part keeps its
  points, as on every other sheet: Goals with no dated goal reads "0 out of 5" here as everywhere (fix round, critic M2 and P4:
  it read "not known yet" only on these sheets, beside Riley's listed emergency fund goal).
- The lead and the Retirement section say Will the money last?'s words for its two cases (retirement/projection `unknownParts`,
  `nothingSaved`, the new `retirement.nothingSaved`): Riley "Retirement: not known yet. Nothing is saved for retirement, so we
  can't say whether the money will last yet." with "Retirement savings: Nothing saved yet"; Sam "Retirement: not known yet. You
  haven't told us about retirement savings, so we can't say whether the money will last yet." with "Not entered yet" (as before).

Not changed (the score's own gate, and another track's): a household whose score is not judged for want of Social Security while
Will the money last? answers (the 14 base households, the retired couple, Fi of round 8) still shows "Retirement on track 0 out of
25" under an answer such as "The money lasts to 2054"; making the score answer without the missing Social Security belongs to
the Plan health score and the lead's track on that answer (z1), and doing it here would move twenty sheets.

Tests (`module.test.mjs`): compute gives the gate's two cases and words the step and titles the row only there (the family keeps
the score's titles, with no new field); the step is the sheet's own where the score waits for Social Security (a 24-year-old with
an empty 401(k), and with cash only); only retirement and protection carry `notKnown`, Goals keeps its points; Riley's and Sam's sheets drawn: no "Retirement on track" and no "0 out of 25" anywhere, the
lead, the step, the rows and the savings figure word for word, no "runs out"; the family's sheet keeps "Retirement on track 25 out
of 25". Invariance against e223a42 over every invented household (`z2-invariance.json`, 200 paths): byte for byte, and for the
four gated households byte for byte once the score's retirement step and titles are put back and `retirement.nothingSaved` and
`notKnown` are taken off.

## The Goals row says why it has no points (ha (b), 2026-11-17)
Riley (the renter-debt fixture: 24, an Emergency fund goal of $14,500 with no date) reads his goal in the Goals section, then
"Goals 0 out of 5" in the Plan health table with no reason. The Plan health score says why for that part, in its own words (its
`detail`): "No goals with a date yet." The row now says it too, under the part's name in the sheet's small grey line (as a guess
mark sits under a figure), and keeps its points, so the table still adds up to the score and the row never reads "not known yet"
beside a goal the sheet lists (the z2 fix round's M2 and P4 stand):

    Goals
    No goals with a date yet. Add what you   0 out of 5
    are saving for, with a date, on the
    Goals page.

- compute: a part in `WHY_PARTS` (only `"goals"`) whose status is `"unknown"` carries `why`, the score's part's `detail`, read from
  overview/health-score's compute and never copied, so the row follows the score's words if they change. The score decides when
  it could not judge Goals (no goal with both a date and an amount), and what it says.
- With it, `step`: the score's own next step for that part (its `fix`, "Add what you are saving for, with a date, on the Goals
  page."), unless the sheet's Next steps already hold it (Ruth, 72, no goals: it is her first step), so the sheet says it once
  (fix round, critic P1: the row gave the reason and not what to do).
- Only while the reason reads true beside the sheet (`whyHolds.goals`: no goal listed with a date; fix round, critic F1). The score
  counts a goal as dated only with an amount too, so a goal with a date and no amount ($0, or below $0) is listed as "Jan 2028, no
  amount" while the score says "No goals with a date yet."; then the row reads as at 452408a ("0 out of 5", nothing under it) and the
  goal's own line says what is missing. Decided here and not in the score: the score's words are its own page's (another change is
  open on that page), and the sheet only chooses when to quote them.
- view: the Part cell is the title with `why` (and `step`, after it) under it in one small grey line; the Points cell as before.
- Not changed: every other part the score could not judge keeps "0 out of N" with no line under it (the emergency fund with no
  bills marked, saving with no income, and retirement or protection waiting for Social Security on the 14 base households). Saying
  why there too is the same one-line change to `WHY_PARTS`, left for a design that looks at those sheets (it would move about
  thirty of them).
- Tests (`module.test.mjs`, "ha (b)"): Riley's Goals part carries the score's own detail and fix, 0 out of 5, and only it; a dated
  goal and the family carry no `why`; no goals at all says the same as the score; Riley's drawn sheet reads "Goals No goals with a
  date yet. Add what you are saving for, with a date, on the Goals page. 0 out of 5" under the goal it speaks of, the family's row
  its points only. Fix round: a goal with a date and $0 or -$5 gets no line (F1); Sam, Jordan and the freelancer get the step,
  Ruth (whose Next steps say it) the reason only, and the step is said once on every sheet (P1). Invariance: the z2 test over every
  invented household takes `why` and `step` off and still matches its e223a42 digests (which 452408a matches), and checks they are
  on exactly the households whose score could not judge Goals and whose sheet lists no goal with a date, in the score's words, the
  step only where Next steps do not hold it; tests/chance-draws-invariance.test.mjs takes them off the same way.

