# Self-employment  (`taxes/self-employment`)

**Status:** usable (phase 6)
**Purpose:** The tax a business adds (self-employment tax and income tax, after half the self-employment tax and the 20% business deduction), what each extra $100 of profit keeps, what a SEP-IRA or a solo 401(k) could shelter, and the quarterly payments it calls for.

## Inputs
`income` (type `business`, its person), the plan's federal tax inputs (`taxes/federal` `taxInputs`), `retirement.contributions` (401(k) deferrals already made), `whatIfs.selfEmployment.expenses`. Writes `whatIfs.selfEmployment = { expenses }`.

## Formulas
- Profit = the Income page's business amount (taken as profit) less the expenses entered, shared across owners by their business income.
- Self-employment tax (IRC 1401, 1402; Schedule SE): base = 92.35% of profit; Social Security 12.4% of the base up to the year's wage base ($184,500 in 2026, `retirement/social-security` `maximumEarnings`) less the person's wages; Medicare 2.9% of the base; none when the base is under $400. Half of it is an adjustment to income.
- Extra Medicare tax 0.9% on wages + the base over the threshold, less what the wages alone already owe.
- Business deduction (IRC 199A, 20%, permanent from 2026): 20% of (profit - half the SE tax), at most 20% of taxable income before it; applied here as a reduction of income (a simplification: it does not lower AGI on a real return). Above about $200,000 single / $400,000 joint of taxable income it can be limited: warned, not modelled.
- The business's tax = federal tax with the profit (less half the SE tax and the deduction) + SE tax + extra Medicare - federal tax without the profit; keep per $100 = 100 - the same with $100 more profit.
- SEP-IRA room = 20% of (profit - half the SE tax), at most $72,000 (2026, IRC 415(c), Notice 2025-67); solo 401(k) = that + the employee deferral left (the $24,500 limit less 401(k) deferrals at work, at most the earnings), at most $72,000.
- Quarterly payments = the business's tax / 4.

## Tests
`module.test.mjs`: SE tax (base, wage base after wages, the $400 floor), no business, Bo's photography by hand (SE tax, deductions, retirement room, effective rate, quarterly, keep per $100), expenses and the deduction's limit warning.
