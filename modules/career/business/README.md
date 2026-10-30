# Small business  (`career/business`)

**Status:** usable, phase 10
**Purpose:** Tracks your small business's profit and loss, what you pay yourself and your self-employed retirement plans.

## Inputs
- The business on the Income page (`income[]` with `type: "business"`; the one chosen, else the largest): its yearly
  amount (what customers pay, unless typed here) and its holder.
- `whatIfs.business = { name, incomeId, revenue, expenses: [{ id, name, category, amount, period }], drawMonthly,
  healthPremiums, homeOfficeSqft, miles, salary, scorpCosts }`. With no expenses typed here, the one figure typed on the
  Self-employment page (`whatIfs.selfEmployment.expenses`) stands in for them, so the two pages show the same profit.
- The household's federal tax (`taxes/federal` `taxInputs`, whose `year` sets the tax year of every figure here), the
  state's rate (`taxes/state`), the wage base, the Self-employment page's 401(k) room, the 401(k) limits.
- Writes `whatIfs.business`. "Use this profit on Income" (shown once revenue or expenses are typed here, with one
  business and a profit) sets the business's Income amount to the profit a month, keeps the revenue here, moves the
  Self-employment page's expenses figure into this page's expenses and sets it there to 0, so the federal estimate, the
  Self-employment page, the budget and the retirement projection all count the same profit.

## Outputs
`compute(plan, { today })` -> `{ ready, year, incomeId, name, person, revenue, revenueFrom, incomeYearly, expenses, typedTotal, notDeducted, homeOffice, miles, expensesTotal, profit, loss, margin, breakEvenMonthly, tax, keepMonthly, drawMonthly, draw, scorp, plans, best, earned, simpleComp, simpleLate, simpleLimit, job401k, qbiLimited, qbiLine, stateRate, notes, seExpenses, typedHere, singleBusiness }`.
Not ready (no business, no revenue): `{ ready: false, year, expenses, typedTotal }`, so expenses typed first still show.

## Formulas
- **Profit** = what customers pay − the typed expenses (each at its period a year; business meals count half, IRC
  274(n)(1); a negative amount counts as 0) − business miles × the year's IRS rate − the home office, simplified: $5 a
  square foot, at most 300 square feet, never more than the profit (Rev. Proc. 2013-13). The year's mileage rate weighs
  each rate by the days it was in force, the miles taken as spread evenly: 2026 = (181 × 72.5¢ + 184 × 76¢) ÷ 365 ≈
  74.26¢ (Notice 2026-10; Announcement 2026-11 from July 1, `side-income/data/rules.js`); 2025 = 70¢. Margin = profit ÷
  revenue; costs a month = (expenses counted + the half of meals not counted) ÷ 12.
- **As a sole proprietor** (`soleTax`): self-employment tax = 92.35% of profit × (12.4% to the wage base after the
  owner's wages + 2.9%), none under $400 (`taxes/self-employment` `seTax`). Half of it, the self-employed health
  insurance (up to the profit less half the tax and the retirement contribution, IRC 162(l)) and any retirement
  contribution come off income. The 20% business deduction = 20% × (profit − those) (IRC 199A; Treas. Reg.
  1.199A-3(b)(1)(vi)), taken after AGI by the federal engine (`qbiDeduction`), at most 20% × (taxable income before it −
  net capital gain, which counts qualified dividends; 199A(a), 1(h)(11)), and from 2026 at least $400 when that
  profit is $1,000 or more (199A(i), P.L. 119-21 section 70105; the business taken as one you work in). Income tax = the
  household's `federalTax` with the profit, less without the business (the Income page's business amount taken out of
  other income and of self-employment earnings). The refundable child tax credit counts profit − half the
  self-employment tax as earned income (IRC 24(d), 32(c)(2)). The 0.9% extra Medicare tax on Medicare wages + 92.35% of
  profit above the filing status's line. The state's rate on profit less half the self-employment tax and the health
  insurance. Keep a month = (profit − the half of meals not counted − all the tax) ÷ 12; what the owner takes out is
  compared with it.
- **A loss** as a sole proprietor comes off the household's other income (no self-employment tax, no 20% deduction):
  the tax figures turn negative, what the loss saves. Loss limits (basis, at-risk, excess business loss) and carrying a
  loss to another year are not modelled.
- **As an S corporation** (`scorpTax`): the owner's salary (typed; else 60% of profit, an example, said so) at most the
  profit; the corporation pays the employer's 7.65% on it (6.2% to the wage base + 1.45%), the running costs (typed;
  else $2,000 a year, an example) and the owner's health insurance (in the owner's pay for income tax but not for Social
  Security and Medicare, then taken off as self-employed health insurance up to the salary, the owner's Medicare wages
  from the corporation: Notice 2008-1, IRC 162(l)(2)(A)); the owner pays the employee's
  share (Social Security to the base after other wages, Medicare, the 0.9%). What is left passes through without
  self-employment tax, with the 20% deduction on it; a loss passed through comes off other income. State tax = the
  state's rate × (salary + the premiums − the health insurance taken off + what passes through). Saving = the sole proprietor's taxes − (the S corporation's taxes + its
  running costs). The IRS requires reasonable pay for the owner's work before the rest is taken ("S corporation
  compensation and medical insurance issues", irs.gov).
- **Retirement plans** (IRS Publication 560): earnings = profit − half the self-employment tax. SEP-IRA = 20% of
  earnings, at most the 415(c) limit ($72,000 in 2026, $70,000 in 2025; Notice 2025-67). Solo 401(k) = 20% of earnings
  (the business's part) + the employee's deferral (the 402(g) room left after any 401(k) at a job, at most the earnings
  left after the business's part, IRC 415(c)(3)), together at most the 415(c) limit, + the catch-up on top of that
  limit (from age 50: $8,000; 60 to 63: $11,250 in 2026), also out of the earnings left. A new one can be set up for a
  year until the tax-filing deadline; the owner's own part in its first year by the April deadline (IRC 401(b)(2),
  SECURE 2.0 section 317). SIMPLE IRA: pay = 92.35% of profit before any
  contribution (Schedule SE line 4); deferral = min(pay, the limit + the catch-up, the 402(g) room left + the
  catch-up), with the higher limits of a business with 25 or fewer employees (2026: $18,100 and $3,850 from 50; 2025:
  $17,600 and $3,850; $5,250 from 60 to 63; IRC 408(p)(2)(E)(i)(I), Notice 2025-67); the match = the deferral, at most
  3% of pay; the higher limits need no 401(k) or other qualified plan for the same people in the three years before
  the SIMPLE IRA's first year (408(p)(2)(E)(iv)) and a plan document that allows them, and the 60-to-63 catch-up
  replaces the higher-tier one, never both (Treas. Reg. 1.414(v)-1, TD 10033). Catch-ups go by the age reached by
  December 31. A new SIMPLE IRA must be set up by October 1 for the year:
  after that the row says it is for next year and counts no saving. The tax each saves = the sole proprietor's taxes
  again with the contribution off income, off the health-insurance limit and off the 20% deduction's base, less with.
  "Most room" is named only when one plan has strictly more than the others.
- **The 20% deduction's line**: above $403,500 joint / $201,750 others / $201,775 separate of taxable income before it
  (2026, Rev. Proc. 2025-32 section 4.26; 2025: $394,600 joint / $197,300 others, Rev. Proc. 2024-40) its wage and
  property limits can apply: a note.

## Edge cases
- No business on Income and no revenue typed: an empty state; expenses typed meanwhile are listed and can be removed.
- No expenses: a note that the profit is all revenue. Expenses only on the Self-employment page: one line for them.
- Several businesses: the one chosen (or the largest); the Income button only with one.
- A loss: "Loss" and what it saves; the retirement card says nothing can go in from the business.
- Choices made: the owner is taken to work in the business (the $400 minimum and no passive-loss limits), the higher
  SIMPLE limits apply (a one-person business has fewer than 26 employees; read from 408(p)(2)(E)(i)(I) and Notice 2024-2
  Q&A E-3, since no IRS text speaks of a business with no employees), catch-ups at a job's plan are not counted
  against the solo 401(k)'s.

## Tests
`module.test.mjs` (19): the home office; the year's mileage rate; the profit and loss and a negative amount; meals at
half; the sole proprietor's tax by hand; the state's rate (Pennsylvania) for both forms, with health insurance; the tax
year from the Federal tax page (2025 figures); the wage base and the 0.9%; self-employed health insurance and its limit;
the 20% deduction's limit and its $400 minimum; the refundable child tax credit; a loss; an S corporation by hand and
its examples; a loss passed through and a bigger profit; the retirement plans and the October 1 deadline; plans never
above the earnings, the SIMPLE match never above the deferral, a tie for most room; catch-ups at 55 and 62; a 401(k) at
a job; not ready with expenses kept, the Income page's amount, the Self-employment page's expenses.

## Ideas / not yet
- Expenses read from the ledger (transactions in a business category); a quarter-by-quarter profit and loss.
- The 20% deduction's wage and property limits above the line; the business's own retirement plan deadlines in the calendar.
