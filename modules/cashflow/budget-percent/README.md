# Budget (50/30/20)  (`cashflow/budget-percent`)

**Status:** usable, phase 4 (built by claude-b from codex's idle lane)
**Purpose:** Splits what you take home after tax into needs, wants and savings, against the 50/30/20 rule or your own
split.

## Inputs
- `income[]` (cashflow/income: the active items a month), `expenses[]` (cashflow/expenses: each item's `essential`,
  "I must pay this", and its amount a month), `retirement.contributions[]` (retirement/contributions: your own money a
  year, not the employer's match), `goals[]` (goals/goals: `monthly` of goals not done).
- The federal estimate (`taxes/federal` `compute`: the year's `totalTax`), the State page (`taxes/state`: `tax`,
  `method`), the wage base (`retirement/social-security` `maximumEarnings`), `taxes/self-employment` `seTax`.
- `whatIfs.budgetPercent = { preset: "50-30-20"|"60-20-20"|"70-20-10"|"own", needs, wants, savings }` (fractions).
- Writes `whatIfs.budgetPercent`, and `expenses[].essential` ("Count as a need" / "Count as a want").

## Outputs
`compute(plan, { today })` -> `{ ready, missing, year, month: { gross, federal, payroll, state, stateKnown, afterTax },
targets: { needs, wants, savings, from, scaled }, buckets: [{ key, label, monthly, share, target, targetMonthly, gap,
status }], needs: [{ id, name, category, monthly }], wants, saving: { retirement, goals, leftover, short, unlisted }, notes }`.

## Formulas
- **The rule**: needs 50%, wants 30%, savings 20% of income after tax (Elizabeth Warren and Amelia Warren Tyagi, "All
  Your Worth: The Ultimate Lifetime Money Plan", Free Press, 2005: the "balanced money formula"; a fact, no text taken).
  Presets 60/20/20 and 70/20/10 for high costs or getting by; own shares are scaled to add up to 100%.
- **Income after tax a month** = (income a year − the federal estimate's tax − Social Security and Medicare − the state's
  tax) ÷ 12. Social Security and Medicare = for each person, 6.2% of their pay (salary and bonus) up to the wage base
  ($184,500 in 2026) + 1.45% of it + self-employment tax on their business income after that pay (`seTax`); untaxed
  income is left out of these. The state's tax is the State page's figure (none where the state has no income tax; not
  counted, with a note, when the State page cannot work it out).
- **Needs** = the expenses marked "I must pay this" (loan payments included when they are on Expenses), a month.
  **Wants** = the other expenses. **Savings** = your own retirement contributions + the monthly amounts going to goals
  not done + what is left over (after tax − needs − wants − those). Spending above income after tax leaves nothing
  over, and the shortfall is said.
- **Share** = the group ÷ income after tax; the target amount = the target share × income after tax; gap = the group −
  the target amount. Needs and wants are "over" above their share + 2 points; savings "under" below theirs − 2 points.
- **Left over above 10% of income after tax** is still counted as saved, with a note that unlisted spending usually
  explains it.

## Edge cases
- No income or no expenses: an empty state naming what is missing, with buttons to the pages.
- No expense marked as a must-pay: everything counts as a want, with a note. Taxes taking all of the income: a note.
- Choices made: savings count your own money only (the employer's match is extra); extra debt payments above the
  minimum are not counted as saving (put them on Expenses or as a goal).

## Tests
`module.test.mjs` (7): the rule, the presets, own shares scaled; income after tax by hand (federal, each person's
Social Security and Medicare, self-employment tax, no state in Texas); needs, wants and savings from the plan with the
shares, targets and gaps; over and under with the slack; spending above income; a state with income tax and no
must-pay expenses; not ready.

## Ideas / not yet
- The month's actual spending from the ledger instead of the Expenses page; extra debt payments counted as saving.
