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
Saving: the share is worked on the careful month on both sides (after-tax income less `spare.held`, the part of uneven pay
not counted on), so counting side income carefully on Side income never marks a saver down.
Goals: a goal waiting its turn on Next best action (alerts' `goalsBehind(...).queued`: nothing in yet, still reachable
from the month the goals step starts) counts as on track, as Goals, the Timeline, Needs attention and the Dashboard say;
the detail adds "counting one waiting its turn", and the fix for the others names when the waiting ones start.
The retirement and protection parts name what is missing with setup's `retirementGap`: a missing birth date says "Add Bo's birth date on People" and links to People; a missing Social Security figure names whose, and links to the Social Security page, which now has the "won't get it" answer.

## Short on the careful month (review 2026-11-02)
When less than nothing is saved and Side income's "count on" holds part of uneven pay back (`spare.held` above $0.50), the
saving part's detail adds ", counting uneven pay at what you can count on (Side income); a month that brings the Income
page's amount leaves about $X" (X = spare + held; "is still about $X short" below 0). The score is unchanged. Test:
`module.test.mjs` ("short on the careful month").

## The retirement hint is Goal seek's answer (round 8, 2026-11-06)
The hint said "about (1.15 x planned yearly spending - what the plan can carry) / 12 a month less spending, or the same in
more saving or later retirement": a yearly gap in retirement spending put as a monthly cut and as a saving. For an invented
renter of 24 (`qa/fixtures/renter-debt-plan.mjs`: the plan can carry $0 against $2,040 a month) it said "$2,350 a month
less spending", more than all the planned spending, while Goal seek, which it links to, said $240 a month more saving.
`retirementHint(plan, { today, ratio, money })` now quotes `scenarios/goal-seek` itself, for the target it names:
- Short of lasting (ratio < 1): the money lasting, leaving nothing (Goal seek's "Just last"), then "Full marks need some room
  for bad luck on top of that." Lasting but under 115% (`FULL_RETIREMENT`): every lever solved for 115% of the
  planned spending (goal seek's `spendingScale: 1.15`).
- Ways, each only when Goal seek gets there with it: "save about $X a month more" (the saving lever's value less what goes
  in now), "retire at 67" (the retirement lever, when later than planned; with two adults, whose), "spend about $Y a month
  less" with Y = planned - (the most it can spend) / target, the cut that makes what it can carry the target share of the
  spending (never as much as the planned spending; dropped when spending alone cannot get there). Example: with $100,000 in
  the 401(k) the renter's plan carries $26,222 a year against $24,480 (107%); 115% needs 2,040 - 26,222 / 12 / 1.15 = $139.9,
  "about $140 a month less", where the old formula said (1.15 x 24,480 - 26,222) / 12 = $161.
- Speed: Goal seek works only those three levers (`only`) and finds the age by halving (`retireSearch: "bisect"`, the same
  age as its year-by-year scan whenever stopping later never hurts; tested on four fixtures), so the score stays about as
  fast as before (the renter: about 0.1 s warm, against 0.6 s with the scan).
- Tests: `module.test.mjs` ("round 8"), and `scenarios/goal-seek/module.test.mjs` for the new arguments.

## A renter's debt payments (round 8, 2026-11-06)
The debt part's third for payments grades a renter (`rentsHome`: no mortgage owed, no Real estate account) on the renters'
line, rent not counted: full to 20%, half to 36%, none above (homeowners: 36% and 43% as before). Detail: "Required payments
take 21% of gross income; for renters the guideline is 20% or less (rent not counted)." Source: CFPB, Your Money, Your Goals, "Debt-to-income calculator tool" (2018-11,
https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf, read
2026-11-06): homeowners "36 percent or less ... Some lenders will go up to 43 percent or higher. Your home mortgage is
included in this ratio"; renters "15-20 percent or less. Your rent is not included in this ratio." The invented renter's
debt part goes from 5 to 2.5 points (no points for $9,800 of card debt against a quarter of a $39,000 year, and half of the
third for 21%). The page's "How it is scored" line says the renters' line too. Test: `module.test.mjs` ("round 8").

## Ideas / not yet
- The score over time (save it with the net-worth points); estate documents and insurance once those pages exist; a benchmark part (How am I doing).

## Review 2026-11-02, round 5
The full-month figure in the saving part's detail is Next best action's `spare.full`, said as `spare.fullAbout` (to the
nearest $10), the one number every page shows for it. Test: `module.test.mjs`.

A full month within $5 of $0 (review 2026-11-02, round 5, second review): `spare.fullKind` (cashflow/budget-percent `fullKind`: "ahead", "even" within $5 of $0, "short") decides the words, so it reads "only just about breaks even" instead of "leaves about $0" or "is still about $0 short". Test: `module.test.mjs`.

## Round 8 review fixes (2026-11-06)
- **Debt part, D3 and D7.** A renter's third for payments is graded on the required payments (liabilities `dtiRequired`), not
  an extra chosen on top: $400 extra on a $150-minimum card cost 2.5 points for paying debt down faster. Source: Fannie Mae Selling Guide B3-6-05, "Monthly Debt Obligations" (dated 2026-08-05,
https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations, read 2026-11-06): revolving accounts are counted at
the payment the credit report shows, with "5% of the outstanding balance" only when it shows no required minimum; nothing in
it counts a payment the borrower chooses on top. Every
  share is graded at the whole percent the detail shows (`shownShare`): 20.3% reads "20%" and earns the full third (a
  homeowner at 36.0% to 36.49% likewise).
- **D5: on steady spending.** `retirementWays` asks Goal seek on a copy of the plan with `retirement.strategy = "fixed-real"`,
  the score's own measure (projection `affordableSpending`): under a share of what is left, guardrails or years-left spending
  the money never runs out, so Goal seek's saving lever said "Nothing more" (or $10) and the hint dropped the saving that lifts
  the score. The lead then says "To carry the planned spending every year".
- **D4: the target, named, and the link opens it.** Short of lasting, on steady spending: 'Open Goal seek to see it (each) on "Just last".', and the
  part carries `query: { target: "last" }`, which the page's links add (`#/scenarios/goal-seek?target=last`); Goal seek opens
  on "Just last" whatever Legacy goals holds. At 115% the hint says 'Open Goal seek to see it with "Room for bad luck" on.' and the link is
  `?target=badluck` (2026-11-07). Otherwise (the plan's own rule for saving) the page has no such figures, so the hint says
  "Worked out as Goal seek does, spending the same every year." instead of pointing at them.
- **A cut of more than half the planned spending is left out** when another way gets there (a couple short only in the two
  years before Social Security read "save about $70 a month more ... or spend about $2,040 a month less"); kept when it is the
  only way. Goal seek still shows it.
- The part also carries `hint` (the ways without "Full marks need some room ..."), which Plan summary uses for "how to make
  the money last".
- "How the score is worked out" says the debt part plainly: "Debt: most points for no card-type debt (10% interest or more);
  the rest for payments under 36% of pay before tax, or 20% if you rent." (the thresholds are above).
- Tests: `module.test.mjs` ("review D3 and D7", "review D5", "review D4", "review UX" x2), failing before the fix.

- **Round 8 batch 4 follow-up (2026-11-07):** the hint's "save about $X a month more" and "spend about $Y a month less" round up
  (a need or a cut that always works), as Goal seek's now do: $243.53 reads $250 (was $240, which fell short). The saving-rate
  hint "about $X a month more" rounds up too.

## Saving share, one yearly figure (2026-11-07)
The saving part reads `core/math/leftover.js` `yearSaving(spare).total / 12` (retirement saving + goal saving + debt extra + what is left over), the same total as before, so Your plan, the Dashboard and the reveal say the same yearly saving.

## Wording follow-up (2026-11-07, claude-b lane B)
- The retirement hint at 115% now says 'Open Goal seek to see it with "Room for bad luck" on.' and links to `#/scenarios/goal-seek?target=badluck` (it said "Worked out as Goal seek does, for 15% more spending" with no link, before the page had the chip). Spending that is not steady keeps the old words and no link.
- Review round 2: the retirement hint ends "Open Goal seek to see it (each) on \"Just last\"" or "... with \"Room for bad luck\" on" (the whole row opens Goal seek, as every row of the score does, so the words say where it goes); the debt row names debts as a sentence does ("the Visa card, the Store card and the Mastercard").
