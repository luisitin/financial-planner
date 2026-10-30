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

## Tests
`module.test.mjs`: weights and bands, an empty plan, the family part by part (total = sum, gains order), and a better plan scoring higher.

## Ideas / not yet
- The score over time (save it with the net-worth points); estate documents and insurance once those pages exist; a benchmark part (How am I doing).
