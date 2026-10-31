# Budget (50/30/20)  (`cashflow/budget-percent`)

**Status:** usable, phase 4 (built by claude-b from codex's idle lane)
**Purpose:** Splits what you take home after tax into needs, wants and savings, against the 50/30/20 rule or your own
split.

## Inputs
- `income[]` (cashflow/income: the active items a year), `expenses[]` (cashflow/expenses: each item's `essential`,
  "I must pay this", its amount a month, and `debtFromDebts`, the Debts page's minimum payments when Expenses lists no
  loan payments), `retirement.contributions[]` (retirement/contributions: your own money a year, not the employer's
  match), `goals[]` (goals/goals: `monthly` of goals not done).
- The Federal estimate's household (`taxes/federal` `taxInputs`: filing status, people, deductions, contributions; its
  income is replaced by the Income page's), the State page (`taxes/state`: `tax`, `agi`, `rate`, `method`), the Paycheck
  page (`cashflow/paycheck`: each earner's pay before and after the pre-tax benefits Social Security skips), the wage base
  (`retirement/social-security` `maximumEarnings`), `taxes/self-employment` `seTax` and the business expenses typed
  there (`whatIfs.selfEmployment.expenses`), the 20% deduction's 2026 minimum (`career/business` `QBI_MINIMUM`).
- `whatIfs.budgetPercent = { preset: "50-30-20"|"60-20-20"|"70-20-10"|"own", needs, wants, savings }` (fractions).
- Writes `whatIfs.budgetPercent`, and `expenses[].essential` ("Count as a need" / "Count as a want").

## Outputs
`compute(plan, { today })` -> `{ ready, missing, year, month: { gross, federal, payroll, state, stateKnown, afterTax,
bizExpenses }, targets: { needs, wants, savings, from, scaled }, buckets: [{ key, label, monthly, share, target,
targetMonthly, gap, status }], needs: [{ id, name, category, monthly }], wants, saving: { retirement, goals, leftover,
short, unlisted }, taxesListed, notes }`. `yearTaxes(plan, { today })` -> the year's `{ gross, federal, ss, medicare, se,
extraMedicare, payroll, state, stateKnown, afterTax, business: { gross, expenses, profit }, agi, otherIncomeOnFederal }`.

## Formulas
- **The rule**: needs 50%, wants 30%, savings 20% of income after tax (Elizabeth Warren and Amelia Warren Tyagi, "All
  Your Worth: The Ultimate Lifetime Money Plan", Free Press, 2005: the "balanced money formula"; a fact, no text taken).
  One departure from the book: it counts paying down debt beyond the minimum as saving; this page counts minimum loan
  payments as needs and leaves extra payments out of savings (see Choices made). The presets 60/20/20 and 70/20/10
  are the app's own example splits for high costs or getting by, not the book's; own shares, once all three are
  typed, are scaled to add up to 100%.
- **Income** = the Income page's items a year − the business expenses typed on the Self-employment page.
- **Social Security and Medicare** = for each earner, 6.2% of their pay (salary and bonus, less the pre-tax benefits the
  Paycheck page takes out before these taxes: HSA, health, FSA, commuter; IRC 3121(a)(5)(G), 125) up to the wage base
  ($184,500 in 2026) + 1.45% of it. Pay linked to no one counts as its own earner (its employer withholds to the base).
- **Self-employment tax** on each owner's profit (business income less their share of the expenses, by gross) after
  their pay (`seTax`: 92.35%, 12.4% to the base after wages, 2.9%; IRC 1401, 1402); business with no one is the first
  adult's, as on the Self-employment page.
- **The 0.9% extra Medicare tax** = 0.9% × (pay for Medicare + self-employment earnings − the filing status's line,
  $250,000 joint, $125,000 separate, $200,000 others), never below 0 (Form 8959 Parts I and II; IRC 3101(b)(2), 1401(b)(2)).
- **Federal income tax** (`core/math/tax.js` `federalTax`) on the Income page's income only: pay less pre-tax 401(k)
  contributions, rent, pensions, dividends and interest (as ordinary), other income and the profit; Social Security
  benefits; half the self-employment tax off income (IRC 164(f)); the 20% business deduction = 20% × (profit − half the
  tax), at least $400 from 2026 when that is $1,000 or more (IRC 199A(a), (i)); the minimum is for a business you
  materially participate in (an "active" one, IRC 199A(i) and 469(h)), which the page assumes for a side business you
  run yourself; at most 20% of taxable income; after
  credits, so the refundable child tax credit can make it negative (a credit). Sales of investments and amounts typed on
  the Federal tax page are left out with a note: that money is not part of the month. The 0.9% is counted above.
- **The state** = the State page's tax ÷ its income × this income's AGI (as the Paycheck page does); 0 where the state
  has no income tax; not counted, with a note, when the State page cannot work it out.
- **Income after tax a month** = (income − federal − Social Security, Medicare and self-employment tax − state) ÷ 12.
- **Needs** = the expenses marked "I must pay this" (loan payments included, from the Debts page when Expenses lists
  none), a month. **Wants** = the other expenses. Taxes listed on Expenses are left out (they come off income already),
  with a note. **Savings** = your own retirement contributions + the monthly amounts going to goals not done + what is
  left over (after tax − needs − wants − those). Spending above income after tax leaves nothing over; the shortfall is
  said first, in amber, and the page never says "within your split" then.
- **Share** = the group ÷ income after tax; the target amount = the target share × income after tax; gap = the group −
  the target amount. Needs and wants are "over" above their share + 2 points; savings "under" below theirs − 2 points.
  With nothing left after tax there are no shares: the amounts only.
- **Left over above 10% of income after tax** is still counted as saved, with a note that unlisted spending usually
  explains it.

## Edge cases
- No income, or no regular spending (one-off and ended expenses, and taxes, do not count): an empty state naming what
  is missing, with buttons to the pages.
- No expense marked as a must-pay: everything counts as a want, with a note. Taxes taking all of the income: a note.
- Choices made: savings count your own money only (the employer's match is extra); extra debt payments above the
  minimum are not counted as saving (put them on Expenses or as a goal); self-employed health insurance and retirement
  plans are not taken off the business's tax here (the Small business page does that); the state's share is an average
  rate, not its brackets.

## Tests
`module.test.mjs` (12): the rule, the presets, own shares scaled (and the rule until all three are typed), the plan's
preset; income after tax by hand (each person's Social Security and Medicare, self-employment tax, federal tax equal to
the Self-employment page's, no state in Texas); the wage base, pay linked to no one, the Paycheck page's pre-tax
benefits; business expenses, the 0.9% on self-employment earnings, a refundable child tax credit; one-off income on the
Federal page left out; needs, wants and savings with the shares, targets and gaps, a goal reached; taxes on Expenses
left out, the Debts page's payments as needs; over and under, and the 2-point slack at 51% and 53%; spending above
income; a state with income tax and no must-pay expenses; a state that cannot be worked out; not ready, one-offs only.

## Ideas / not yet
- The month's actual spending from the ledger instead of the Expenses page; extra debt payments counted as saving.
