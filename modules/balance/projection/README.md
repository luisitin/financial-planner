# Net worth projection  (`balance/projection`)

**Status:** usable, phase 5
**Purpose:** Net worth in the years ahead: savings growing and spent in retirement, the home's value, debts paid down, in today's money.

## Inputs
- Everything `retirement/projection` reads (people, accounts, contributions, Social Security, pensions, retirement
  spending, assumptions): its year-end balances are the savings and investments here.
- `accounts[]` of type property, vehicle, 529 and other_asset; every debt account.
- `debts[]` and `debtPlan` (through `debt/payoff`): the month-by-month payoff schedule.
- `whatIfs.netWorth = { years, homeGrowth, vehicleLoss }`, all optional.

## Outputs
`{ ready, missing, notes, settings, now: { netWorth, assets, liabilities, invested, homes, vehicles, college, other, debts }, rows: [{ year, age, retired, invested, homes, vehicles, college, other, debts, mortgage, netWorth, priceLevel, netWorthReal }], milestones: [{ year, kind, label }], peak, retireYear, inTen, atRetirement, last }`.

## Formulas
Each row is the end of a calendar year, like the retirement projection's rows; t = years from today to that
year-end = (months left this year + 12 × row index) / 12.
- Savings and investments = the retirement projection's `rows[i].total` (cash, taxable, pre-tax and tax-free
  buckets: contributions while working, withdrawals and tax after, at the plan's expected returns).
- Homes = today's value × (1 + home growth)^t; default 3.5% a year (long-run prices about inflation plus half a point).
- Cars = today's value × (1 − yearly loss)^t; default 15%.
- 529 plans = today's balance × (1 + the plan's blended return)^t (`planReturn`); other assets stay as they are.
- Debts = the payoff plan's balances after (months left this year + 12 × row index) payments (`payoffPlan`, with the
  chosen order and extra); debts without a rate and payment stay at today's balance.
- Net worth = savings and investments + homes + cars + 529s + other − debts; in today's money ÷ the row's price level.
- Milestones: the first year the mortgage is gone (named "debt-free" too when every debt goes that year), the
  first year with no debt, net worth turning positive, doubling today's figure in today's money, passing a million
  in today's money, retirement, and the highest year in today's money when it is not the last.
- Default horizon: to five years after retirement, at least 10 and at most 40 years; a typed one is kept to 1 to 40.

## Edge cases
- No person with a birth date, or no retirement spending: not ready; the page says what to add.
- The first row has the retirement projection's full year of growth and contributions (its convention), while the
  home and debts move only for the months left; the difference is small and gone from the second row.
- Goal spending, gifts and inheritances are not in it.

## Tests
`module.test.mjs`: not ready, the family's first row by hand (savings, home, debts after two payments), year five,
the horizon, every milestone, cars, 529s and a debt without a plan, turning positive.

## Ideas / not yet
- Goals with dates taken out of savings the year they fall due.
- A band from the Monte Carlo paths instead of one line.
