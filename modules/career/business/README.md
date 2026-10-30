# Small business  (`career/business`)

**Status:** usable, phase 10
**Purpose:** Tracks your small business's profit and loss, what you pay yourself and your self-employed retirement plans.

## Inputs
- The business on the Income page (`income[]` with `type: "business"`; the one chosen, else the largest): its yearly
  amount (what customers pay, unless typed here) and its holder.
- `whatIfs.business = { name, incomeId, revenue, expenses: [{ id, name, category, amount, period }], drawMonthly,
  healthPremiums, homeOfficeSqft, miles, salary, scorpCosts }`.
- The household's federal tax (`taxes/federal` `taxInputs`), the state's rate (`taxes/state`), the wage base, the
  Self-employment page's 401(k) room and 415(c) limit (`taxes/self-employment`), the 401(k) limits.
- Writes `whatIfs.business`; "Use these on Income and Self-employment" sets the business's Income amount to what
  customers pay (monthly) and `whatIfs.selfEmployment.expenses` to the year's expenses, so the other pages agree.

## Outputs
`compute(plan, { today })` -> `{ ready, year, incomeId, name, person, revenue, revenueFrom, incomeYearly, expenses, typedTotal, homeOffice, miles, expensesTotal, profit, margin, breakEvenMonthly, tax, keepMonthly, drawMonthly, draw, scorp, plans, earned, qbiLimited, qbiLine, stateRate, notes, singleBusiness }`.

## Formulas
- **Profit** = what customers pay − the typed expenses (each at its period a year) − business miles × the IRS rate on
  the day (`side-income/data/rules.js`: 72.5¢ to June 2026, 76¢ from July 2026) − the home office, simplified: $5 a
  square foot, at most 300 square feet, never more than the profit (Rev. Proc. 2013-13). Margin = profit ÷ revenue;
  costs a month = expenses ÷ 12.
- **As a sole proprietor** (`soleTax`): self-employment tax = 92.35% of profit × (12.4% to the wage base after the
  owner's wages + 2.9%), none under $400 (`taxes/self-employment` `seTax`); half of it, the self-employed health
  insurance (up to the profit less half the tax, IRC 162(l)) and any retirement contribution come off income; the 20%
  business deduction = 20% × (profit − those), at most 20% of taxable income before it (IRC 199A, permanent from 2026);
  income tax = the household's `federalTax` with the profit, less without the business (the Income page's business
  amount taken out); the 0.9% extra Medicare tax on wages + 92.35% of profit above the filing status's line; the
  state's rate on profit less half the self-employment tax and the health insurance. Keep a month = (profit − all of
  it) ÷ 12; what the owner takes out is compared with it.
- **As an S corporation** (`scorpTax`): the owner's salary (typed; else 60% of profit, an example, said so) at most the
  profit; the corporation pays the employer's 7.65% on it (6.2% to the wage base + 1.45%), the owner the employee's
  share (Social Security to the base after other wages, Medicare, the 0.9%); what is left after the salary, the
  employer's share and the running costs (typed; else $2,000 a year, an example) passes through without
  self-employment tax, with the 20% deduction on it; income tax on the salary + what passes through. Saving = the
  sole proprietor's taxes − (the S corporation's taxes + its running costs). The IRS requires reasonable pay for the
  owner's work before the rest is taken ("S corporation compensation and medical insurance issues", irs.gov).
- **Retirement plans** (IRS Publication 560): earnings = profit − half the self-employment tax. SEP-IRA = 20% of
  earnings, at most $72,000 (2026, Notice 2025-67). Solo 401(k) = 20% of earnings + the employee part (the 402(g)
  room left after any 401(k) at a job, at most the earnings), at most $72,000. SIMPLE IRA = min(earnings, $17,000 +
  the catch-up from 50, $4,000, or $5,250 from 60 to 63, the 402(g) room left + the catch-up) + the 3% match on
  earnings (2026, Notice 2025-67). The tax each saves = the sole proprietor's taxes again with the contribution off
  income and off the 20% deduction's base, less with.
- **The 20% deduction's line**: above $403,500 joint / $201,750 others / $201,775 separate of taxable income (2026,
  Rev. Proc. 2025-32 §4.26) its limits can apply: a note.

## Edge cases
- No business on Income and no revenue typed: an empty state. No expenses: a note that the profit is all revenue.
- Several businesses: the one chosen (or the largest); the Income/Self-employment button only with one.
- A small loss passed through an S corporation (the salary and costs above the profit) comes off other income.

## Tests
`module.test.mjs`: the home office, the profit and loss, the sole proprietor's tax by hand, the wage base and the
0.9%, self-employed health insurance, an S corporation by hand (and its example salary and costs), one that pays off
on a bigger profit, the retirement plans, a 401(k) at a job shrinking the solo 401(k) and SIMPLE, the 20% deduction's
line, not ready, the Income page's amount as revenue.

## Ideas / not yet
- Expenses read from the ledger (transactions in a business category); a quarter-by-quarter profit and loss.
- The 20% deduction's wage and property limits above the line; the business's own retirement plan deadlines in the calendar.
