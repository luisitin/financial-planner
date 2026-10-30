# Human capital  (`career/human-capital`)

**Status:** usable, phase 10
**Purpose:** What all the pay you are still going to earn is worth today, against your savings over the years, and what it means for insurance and investing.

## Inputs
- Adults with a birth date and retirement age (`household.people`); their salary, bonus and business income (`cashflow/income`, active today).
- `assumptions`: inflation, salary growth, bond and stock returns.
- `whatIfs.humanCapital = { [personId]: "steady" | "average" | "volatile" }` (default average).
- The federal and payroll tax share of pay (`overview/next-best-action` `spare`); life policies naming each earner
  (`insurance.policies`, kinds term, whole, universal, life); investable savings (`balance/net-worth`); the retirement
  projection's year-end balances in today's money.

## Outputs
`{ ready, people: [{ id, name, age, retireAge, years, pay, risk, rate, realRate, value, afterTax, cover, coverShare }], total, totalAfterTax, takeHome, financial, share, path: [{ year, human, financial }], crossYear, real, raiseGain }`.

## Formulas
- Everything in today's money: real growth g = (1 + salary growth) / (1 + inflation) − 1; real discount r likewise.
- Discount by how steady the pay is (after Ibbotson, Milevsky and Chen, "Lifetime Financial Advice", CFA Institute
  Research Foundation, 2007: human capital is valued at a rate that reflects the job's risk): steady = the bond return,
  average = bond return + 2 points, volatile = the stock return.
- Value = Σ_{k=1..years} pay × (1 + g)^k / (1 + r)^k, years = retirement age − age (pay at each year's end).
- After tax = value × (1 − (federal + payroll tax) ÷ gross pay), the household's share today.
- Path: at year t, the pay still to come = Σ over earners of the same sum from t (pay grown t years); savings = the
  retirement projection's `totalReal` at the end of the year before (today: investable savings). The cross year is the
  first where savings ≥ pay still to come.
- Raise gain = Σ earners Σ_k pay × ((1 + g + 1%)^k − (1 + g)^k): the extra pay from raises one point bigger, undiscounted.
- Share = value ÷ (value + investable savings). Life cover share = cover ÷ after-tax value.

## Edge cases
- No earner with pay and a birth date: a hero. An earner past retirement age: 0 years, left out of the path.
- Survival to retirement is assumed (no mortality weighting).

## Tests
`module.test.mjs`: the present value by hand, not ready, the family by hand (rate, after tax, share), steadiness, the
path falling to zero against the projection with a cross year, life cover and the raise gain.

## Ideas / not yet
- Weight each year by the chance of being alive and working (the longevity tables).
- Feed the after-tax value to Life needs as an alternative to its income-replacement method.
