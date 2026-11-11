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
"Can carry a month" reads "Can carry a month if markets do as well as average", and the sentence under it starts "If markets do
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
  answers for the money lasting, e.g. "To make the money last: save about $240 a month more. Open Goal seek to see it on "Just last"."), not
  "spend about (planned - what it can carry) a month less", which for an invented renter carrying $0 of $2,040 was all of the
  spending and still did not make it last. Without the score: "the plan needs more saving, a later retirement or less spending:
  Goal seek works out each."
- Stress tests: when the cut that would make a shock last is at least the whole planned spending, "even spending nothing would
  not make it last" instead of "about $2,040 a month less spending would make it last".
- Debts: "If you keep paying today's payments, the Visa card runs to ..." (was "On its own payment ...", read as "paying the
  minimum"; Credit cards).
- Test: `module.test.mjs` ("review UX"), failing before the fix.
