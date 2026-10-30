# Bucket strategy  (`retirement/buckets`)

**Status:** usable (phase 5)
**Purpose:** Cash, bond and stock buckets for retirement, sized in years of the plan's own withdrawals, and the stock share they leave against the plan's.

## Inputs
The plan through `retirement/cash-flow` (today's dollars), `retirement.stocksRetired`, `assumptions.returnBonds` and `inflation`, `retirement.buckets`. Writes `retirement.buckets = { cashYears, bondYears }`.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, retireYear, savings, cashYears, bondYears, draws: [{ year, age, draw }], buckets: [{ key, label, from, to, amount, share }], impliedStocks, planStocks, short, bondRealRate, warnings }`.

## Formulas
- Withdrawal each retirement year = spending + tax - guaranteed income (Social Security, pensions, a partner's pay), floored at 0.
- Savings at retirement = the plan's total at the end of the year before the first retirement year.
- Cash = the first `cashYears` (2) withdrawals; bonds = the next `bondYears` (8), each discounted at the real bond return ((1 + bonds) / (1 + inflation) - 1) for the years until it is needed; stocks = savings - cash - bonds (not below 0).
- Implied stock share = stocks / (cash + bonds + stocks), set against `stocksRetired`; more than 5 points apart is called out.
- Short: savings below cash + bonds.

## Edge cases
- No retirement years: a warning. Buckets inside retirement accounts are labels only (no tax to move between them): the page says so.

## Tests
`module.test.mjs`: not ready, the family's buckets by hand (savings, cash, discounted bonds, stocks, shares, years), more years in the safe buckets, a plan too small to fill them.

## Ideas / not yet
- Replay the buckets through history (If history repeated) against a fixed mix.
