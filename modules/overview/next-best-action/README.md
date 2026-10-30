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
2. The whole employer match: anyone with pay and a 401(k) but no contribution on file is a "check".
3. Expensive debt: `HIGH_RATE` 10% or more, mortgages aside, highest rate first.
4. A full emergency fund: the plan's target months (Emergency fund page's gap).
5. The HSA (only with an HSA account): this year's room (self-only or family).
6. An IRA for each adult with earned income: this year's room, catch-up at 50.
7. Middling debt: `MODERATE_RATE` 4% up to 10%, mortgages aside.
8. The 401(k) to the limit: this year's room (the employee's own money).
9. Goals that are behind: the extra a month they need.
10. Then a choice: taxable investing, the mortgage, a 529, retiring earlier, giving.

Payroll tax (`FICA`): Social Security 6.2% of pay up to the year's wage base and Medicare 1.45% (IRC §3101), self-employment 15.3% of 92.35% of profit (§1401-1402). State and local income tax is not counted yet.

## The dates
The spare money is run month by month for `HORIZON_MONTHS` (120): each month it fills the steps in order, one-off gaps first (debts and cash), then this year's room in each account a twelfth at a time. A gap's `doneDate` is the month it is filled; an account's `startDate` the first month it gets money. Interest on the debts and next year's new limits are left out, so the dates are about right.

## Edge cases
Not ready without income and expenses. Spare money below zero: the bills are the next step and no dates are given. No 401(k): no match or 401(k) step; no HSA account: no HSA step; no goals: no goals step. Money set aside for goals is not usable cash (F-020), so a goal called "Emergency fund" is not counted toward the emergency fund (F-034 asks the owner).

## Tests
`module.test.mjs`: the spare money line by line, the family's order and next step, the gap dates in order, the IRA and 401(k) room, overspending, a household with no expensive debt, 401(k) or HSA.

## Ideas / not yet
- Per-person match details (the formula, so the step can say "raise to 6%"); state tax; Roth versus traditional by bracket; interest in the debt dates (the payoff engine).
