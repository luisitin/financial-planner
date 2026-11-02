# Plan health score  (`overview/health-score`)

**Status:** usable (phase 9)
**Purpose:** Your whole plan as one score from 0 to 100: cash cushion, saving, debt, retirement, protection, goals and how complete it is, with where the missing points are.

## Inputs
Through other pages' computes: Emergency fund (`balance/liquidity`), Next best action (the spare money), Debts (`balance/liabilities`), Will the money last? (`retirement/projection`), Stress tests, Goals; and the plan's people, accounts, Social Security, retirement spending and assumptions for the completeness check. Writes nothing. `heavy: true` (it runs the stress tests).

## Outputs
`{ ready, missing, score, band, parts[], gains[] }`; each part `{ id, title, points, max, share, status: ok|warn|bad|unknown, detail, fix, go }`; `gains` = parts missing half a point or more, largest gap first.

## The parts (`PARTS`, out of 100)
| part | points | full marks when | share |
|---|---|---|---|
| Cash cushion | 15 | usable cash covers the plan's target months of must-pay bills | runway months / target months |
| Saving | 15 | 20% of income after federal and payroll tax is saved (retirement, goals, spare) | rate / 0.20 (`SAVING_TARGET`; the 20 of 50/30/20) |
| Debt | 15 | no debt at 10% or more, payments under 36% of gross income | two thirds: 1 - expensive debt / (a quarter of a year's gross income); one third: 1 at 36% or less, 0.5 to 43% (`DTI`, the qualified-mortgage line), 0 above |
| Retirement on track | 25 | the plan can carry 115% of its planned spending | (affordable / planned - 0.6) / 0.55 |
| Protection | 15 | the money lasts through every life shock in the stress tests | shocks survived / life shocks |
| Goals | 5 | every dated goal done or on track | share on track |
| The plan knows enough | 10 | seven things filled in and current: adults' birth dates, accounts, balances within 90 days, income and expenses, Social Security for every adult, retirement spending, assumptions looked over in the last year | share present |
Bands (`BANDS`): Strong from 85, Good from 70, Fair from 50, Needs work below. A part the plan cannot judge yet scores 0 ("unknown") and says what to add.

Income after tax (2026-11-02) takes off the state's income tax and business costs too, as Next best action's month does.

A saved debt plan (2026-11-02): the extra a month on Pay off debts counts as saved (saved = retirement + goals + extra on
debts + spare), since Next best action no longer counts it as spare: saving the plan never lowers the score.

Retired households (2026-11-02): the saving part gets full marks when Next best action says the household draws from
savings as its plan intends (the 20% rule is for working years), "what you will spend in retirement" counts as known for a
retired household, and Social Security typed on the Income page counts as a figure.

Not scored before Social Security (round 4, 2026-11-02): the retirement and protection parts are "unknown" (0 points,
fix "Add Social Security for each adult...") until projection's `retirementKnown` holds, the Dashboard's rule. Before,
the plan ran without Social Security and the score said "runs out in 2067" and that full marks needed about $3,040 a
month less spending; now the biggest gain is adding Social Security.

## Tests
`module.test.mjs`: weights and bands, an empty plan, the family part by part (total = sum, gains order), and a better plan scoring higher.

## Review fixes 2026-11-02
Goals: a goal waiting its turn on Next best action (alerts' `goalsBehind(...).queued`: nothing in yet, still reachable
from the month the goals step starts) counts as on track, as Goals, the Timeline, Needs attention and the Dashboard say;
the detail adds "counting one waiting its turn", and the fix for the others names when the waiting ones start.
The retirement and protection parts name what is missing with setup's `retirementGap`: a missing birth date says "Add Bo's birth date on People" and links to People; a missing Social Security figure names whose, and links to the Social Security page, which now has the "won't get it" answer.

## Ideas / not yet
- The score over time (save it with the net-worth points); estate documents and insurance once those pages exist; a benchmark part (How am I doing).
