# Next best action  (`overview/next-best-action`)

**Status:** usable (phase 9)
**Purpose:** Tells you what to do with your next spare dollar, following the well-known order: employer match, high-interest debt, emergency fund, retirement, then the rest.

## Inputs
`income`, `expenses`, `accounts`, `debts`, `goals`, `retirement.contributions`, `taxes` (through the Federal page), `assumptions.emergencyMonths`, `household`. Writes nothing.

## Outputs
`{ ready, missing, spare, steps[], next }`. `spare` (all a month): `gross`, `federalTax` (`taxes/federal` total / 12), `payrollTax`, `spending` (the Expenses page's monthly total), `retirementSaving` (own contributions, not the match), `goalSaving` (open goals' monthly), `monthly` = gross minus the rest. Each step: `{ id, n, title, why, status: done|now|later|check, detail, gap, roomYearly, doneDate, startDate, monthly, go }`; `next` is the first step not done.

## The order
The r/personalfinance wiki's "How to handle $" (the prime directive) and the Bogleheads wiki's "Prioritizing investments":
0. Spend less than comes in (spare >= 0).
1. A starter emergency fund: usable cash (Emergency fund page) of one month of must-pay bills.
1b. Protect the people who count on you (2026-11-02): an earner whose death would leave a partner or children short by
   `MIN_GAP` ($10,000) or more, by Life insurance needs' own answer (`protectionGaps` in insurance/life-needs: the lump sum
   that keeps the survivor's plan whole, less the cover on Policies). Status "now" with no gap (buying a policy is an
   action, not a sum the spare money fills); `people: [{ personId, name, gap, cover, until, depends }]`. Done (left out)
   once the cover reaches the need. Placed right after the starter cushion: the round-3 walk-through found the family's
   biggest risk (Bo and Cy $212,000 short if Ana died) worked out on a page nobody opened, and term cover is cheap next
   to the loss it covers. Our own choice of place, noted per the builder instructions; the two wikis above put insurance
   among the basics rather than at a numbered step.
2. The whole employer match: anyone with pay and a 401(k) but no contribution on file is a "check".
3. Expensive debt: `HIGH_RATE` 10% or more, mortgages aside, highest rate first.
4. A full emergency fund: the plan's target months (Emergency fund page's gap).
5. The HSA (only with an HSA account, and not when the HSA page says there is no high-deductible plan: then nobody may put money in, IRC 223(c)(1)): this year's room (self-only or family).
6. An IRA for each adult with earned income: this year's room, catch-up at 50.
7. Middling debt: `MODERATE_RATE` 4% up to 10%, mortgages aside.
8. The 401(k) to the limit: this year's room (the employee's own money).
   The IRA and 401(k) steps carry `optional: true` and start "Optional: your plan already lasts (Will the money last?);
   more saving buys an earlier retirement or more to spend." when `savingVerdict` (retirement/projection) is "on track"
   (2026-11-02). The IRA step mentions the backdoor route only when the household's income is in or over the Roth limit
   range (Contribution limits' `roth.status` "partial" or "over"); it used to say it to everyone.
9. Goals that are behind: the extra a month they need.
10. Then a choice: taxable investing, the mortgage, a 529, retiring earlier, giving.

Payroll tax (`FICA`): Social Security 6.2% of pay up to the year's wage base and Medicare 1.45% (IRC §3101), self-employment 15.3% of 92.35% of profit (§1401-1402). State and local income tax is not counted yet.

   Retired households (2026-11-02): when `drawingAsPlanned` (retirement/projection) says a retired household lives on its
   savings as the plan intends, step 0 is done, "Spend within what the plan can carry" ("About $4,180 a month comes from
   savings, as planned..."), the result carries `drawing`, and the money card says "From savings each month, as planned"
   (not a red "Short"). The 401(k) step counts only adults with pay: a retired household gets no "fill the 401(k)".

## The match step's question (2026-11-02)
A 401(k) marked `formerJob` (from a job left) takes no new money, and a person whose job has no plan or no match
(`retirement.workPlans[id].match === false`) has nothing to check, so neither makes the match step "check". The step lists
who to ask in `ask: [{ personId, name, accounts }]`, which retirement/contributions turns into its question card.
The match tiers typed on Work benefits (`whatIfs.benefits[id].matchTiers`) answer it too: tiers with no rate mean no
match, any tier with a rate means there is one to check. A cash gap under half a dollar counts as filled (the
balances are typed to the dollar, so 4,578 against 4,577.60 is done, not "$0 to go").

A paid adult whose every 401(k) is marked `formerJob` stays in the step (unless they said there is no match): the job
they have now may have a plan. Their ask entry is `{ personId, name, accounts: [], newJob: true, old: [the old 401(k)s] }`
and Retirement contributions asks "Does Bo's job now have a retirement plan with a match?" (2026-11-02: before, marking the
only 401(k) as old dropped the question for good).

## One tax for the month (2026-11-02)
`spare` takes its tax from Budget (50/30/20)'s `yearTaxes`, the app's one tax for the month: federal income tax with half
the self-employment tax and the 20% business deduction off (as the return does), Social Security and Medicare
(self-employment tax and the extra 0.9% included, the Paycheck page's pre-tax benefits off first), and the state's income
tax at the State page's rate on federal AGI (a flat-rate state's own rate, a no-tax state 0, a graduated state once its
rate is typed there: `stateKnown`). Business costs typed on the Self-employment page come off too.
`spare.monthly` = gross - business costs - federal - payroll - state - spending - retirement saving - goal saving - the
saved debt plan's extra. Before, the federal estimate's total and a simple payroll reckoning were used and the state's
tax was left out, so the left-over figure read about $405 a month high for this family in Pennsylvania, and Budget and
the Cash-flow statement each showed a different month (round-4 finding). The simple reckoning is kept only for a plan
the tax cannot be worked out for. Each month's money lists "State income tax" and "Business costs" when there are any.

## Costly debt from savings (2026-11-02)
When usable cash, after one-off costs coming up, is more than the full cushion (Emergency fund's `nowAfterOneOffs` -
`target`), the expensive-debt step pays from it today: `fromSavings` = that surplus, up to the expensive debts' balance,
down to $10; the step's gap is the rest (for the spare money, as before) and `doneDate` is today when it covers all. The
title reads "Pay off expensive debt from savings" and the detail says what cash stays: "Pay the Visa card's $6,400 from
savings now: you would still have 7.9 months of must-pay bills in cash (the plan aims for 6). Paying it is a sure 23.9%
return." Paying a 20%-plus card from cash above a full cushion is the standard first move; before, the card was
scheduled from the monthly left-over over months even when savings could clear it (round-4 challenge). Under $100 above
the cushion, nothing is said. The Dashboard's move reads "Pay off the cards from your savings"; Pay off debts shows the
same card first, with "I moved it: update my balances".

## A saved debt plan (2026-11-02)
An extra a month saved on Pay off debts (`plan.debtPlan.extra`, its `extra` as that page's compute returns it: 0 once
every debt it was aimed at is paid off) is money already spoken for, like what goes to retirement and goals:
`spare.debtExtra` = that extra, and `spare.monthly` = pay - federal tax - payroll tax - spending - retirement saving -
goal saving - `debtExtra`. Before, the money promised to the cards still showed as left over, so doing the next move
changed nothing and the step asked for the same money again (round-4 finding).
- `debtPlan` = `{ extra, ids, names, until, months }`: the debts the extra goes to (`debtPlan.targets` still owed, or every
  debt in the payoff plan when it is aimed at none: it rolls from one to the next) and the month the last of them is gone
  (Pay off debts' own `chosen.debts[].endDate`; null when one never pays off).
- A debt step (expensive, middling) whose every debt the extra reaches, each with a payoff month, is `status: "underway"`,
  `gap: 0`, with `underway: { extra, names, until }` and the detail "Under way. $410 a month extra already goes to Visa
  card (Pay off debts), on top of the required payments: it is gone by about July 2027." It is never the next step, gets
  no spare money in the run below, and the setup's moves and the Dashboard leave it out. A debt the extra does not reach
  stays to do, with only its own balance as the gap.
- The page lists the extra under Each month's money ("Extra on Visa card (Pay off debts)", a striped key, not a colour
  that means good or bad), with a pill "under way" on the step.
- Elsewhere: the Dashboard's and the setup's "Left over each month" say "after tax, bills, saving and $410 extra on Visa
  card"; Needs attention drops "Visa card is expensive debt" while the plan pays it off; the health score's saving part
  counts the extra as saving (paying down debt adds to what you are worth as surely), so saving the plan never lowers the
  score; Expenses' Close-the-gap card says lowering the extra is a way out when it tips the month over.

The IRA step reads "An IRA of your own" for a household with one earner ("for each of you" only with two or more), 2026-11-02.

## The dates
The spare money is run month by month for `HORIZON_MONTHS` (120): each month it fills the steps in order, one-off gaps first (debts and cash), then this year's room in each account a twelfth at a time. A gap's `doneDate` is the month it is filled; an account's `startDate` the first month it gets money, and its `capacity` the spare money that reaches it then (the larger of that month and the next, since the first month can be the crumbs of a step finishing; alerts' `goalsBehind` uses the goals step's to say whether a goal can wait its turn). A saved debt plan's extra joins the spare money from the month its last debt is gone (`debtPlan.months`), and a date reached with it says "with the $410 a month that frees up after July 2027". Interest on the debts and next year's new limits are left out, so the dates are about right.

## Display
- A federal tax below zero (refundable credits, such as the child tax credit's refundable part, paying back more than the tax) reads "+ $80" on a line "Federal income tax: credits pay back more than the tax" (2026-11-01); it read "- -$80". Its bar segment is 0 wide.

## Edge cases
Not ready without income and expenses. Spare money below zero: the bills are the next step and no dates are given. No 401(k): no match or 401(k) step; no HSA account, or no high-deductible plan: no HSA step; no goals: no goals step. Money set aside for goals is not usable cash (F-020), so a goal called "Emergency fund" is not counted toward the emergency fund (F-034 asks the owner).

## Tests
`module.test.mjs`: the spare money line by line, the family's order and next step, the gap dates in order, the IRA and 401(k) room, overspending, a household with no expensive debt, 401(k) or HSA.

## One cushion verdict (round 4, 2026-11-02)
`cushionLater(nba)` -> `{ until } | null`: the starter month of must-pay bills is done, costly debt (10%+) is not yet paid, and the full fund is not done. The order here pays costly debt before the full fund, so other pages must not call the cushion red "thin" at the same time. `until` is the date the spare money clears the costly debt (`high-debt.doneDate`), or Pay off debts' own date when a saved debt plan is on it (`debtPlan.until`). Used by Needs attention (`emergency-later`), Emergency fund ("enough for now") and the Dashboard's Safety cushion line (via setup `standing().cushionLater`). Test: "one cushion verdict".

## Review fixes 2026-11-02 (paying from savings)
- Cash for the from-savings move is `min(now, nowAfterOneOffs)`: one-off costs coming lower it, one-off income never raises it (it may already be in the balances).
- No must-pay bills marked (cushion target 0): nothing is offered from savings, so it never says "a full cushion" while emptying the account.
- Savings that cover the whole balance pay it exactly (`fromSavings = owed`, said to the dollar); only a partial amount is rounded down to $10.
- A saved debt plan aimed at the card no longer hides the move when the cash is there: the debts it reaches are paid from savings too.
- The IRA step carries `people` (earners with room); "each" only when more than one, and setup's reveal words follow it.

## Uneven pay counted carefully (round 4, 2026-11-02)
`spare.heldGross` is income's `heldMonthly`; `spare.held` is that less the tax set aside from it, worked as the difference between `yearTaxes` on the plan and on the plan with each `countOn` as the amount. `spare.monthly` takes off `held`, so the month equals typing the careful figure as the income, while `federalTax`, `payrollTax` and `stateTax` stay the whole year's, as every tax page says them.

## A household that pays its own tax (round 4, 2026-11-02)
After the bills, a step `tax` when Liquidity keeps tax out of the cushion (`liq.tax`, Estimated payments' `taxOwedNow`):
- An estimated payment past due: "Pay the estimated tax that is past due", status now, before any cushion or debt. Its gap is the past-due amount less the cash already kept apart for tax (usually 0: paid today from that cash, `doneDate` today); any rest waits for the money left each month.
- Otherwise: "This year's tax, kept apart", done, saying how much of the cash is tax, what to put aside a month ((the year's tax - withholding) / 12) and the next payment.
The cushion steps then use the cash less the tax. Before, the Dashboard said "Pay down the cards first" to a freelancer with $8,400 of estimated tax past due, and the full cushion looked $6,480 closer than it was. `dayWords("2027-01-15")` = "January 15, 2027".

## A retirement plan through the business (round 4, 2026-11-02)
After the 401(k) step, `business-plan`: Small business's best plan (career/business `plans` / `best`: a solo 401(k), a SEP-IRA or a SIMPLE IRA) with its room for the year and the tax it saves at the limit, and when a new one can still be set up (solo 401(k): until the April filing deadline, SECURE 2.0 section 317; SEP-IRA: until the filing deadline with extensions; a SIMPLE IRA too late for the year is not offered). Only while nothing goes into a 401(k) for the owner (then the 401(k) step covers it) and only when the plan allows more than an IRA does (the family's weekend photography allows $6,690 against $7,500: the IRA step is the answer there). Its room takes the spare money after the IRA. Before, a freelancer with a $37,900 solo 401(k) on the Small business page was offered only an IRA.

## One date for costly debt (round 4, 2026-11-02)
When costly debt is first in line for the spare money (no earlier step still filling a gap, nothing paid from savings), its date is Pay off debts' own: `offer(plan, { amount: the spare a month, stepId: "high-debt" }).soon`, which pays the required payments as well and charges each debt's interest month by month. The schedule then gives that step the spare money until that month, so the steps after it start when it is really done. Before, this page paid the balance from the spare money alone and read later than Pay off debts for the same amount (a renter: September 2028 here, March 2028 there). Otherwise (another step first, or a part paid from savings) the step keeps this page's own reckoning.

## Ideas / not yet
- Per-person match details (the formula, so the step can say "raise to 6%"); state tax; Roth versus traditional by bracket; interest in the debt dates (the payoff engine).

## Side income counted carefully (review 2026-11-02)
"Each month's money" lists `spare.held` (side income above what you count on, after its tax) as its own line, so the lines
add up to "Spare each month"; the note under it says it is a bonus to save when it comes, and the left-over step's detail
adds "counting uneven pay at what you can count on".

## The tax step when nothing is typed (review 2026-11-02)
With estimated tax past due and no payments ever typed (taxes/estimated `paidTyped` false), the step is "Type or pay this
year's estimated tax": what was due if none were made, and to type what was paid. Paid from the cash already kept apart for
tax, its line reads "From the cash kept apart for tax, today." instead of a month at the spare money's pace.

## Average markets, said so (round 5, 2026-11-02)
Retired and drawing as planned: "If markets do as well as average, the plan can carry about $X a month of spending and the money
lasts; less in a bad run of years (Will the money last? shows how much less)". The figure is the projection's average-market one.
