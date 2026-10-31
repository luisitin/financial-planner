# Financial independence  (`retirement/fire`)

**Status:** usable (phase 5)
**Purpose:** The pot that could pay for your life without a paycheck, how far you are, and the years to get there at your pace.

## Inputs
Spending (the retirement figure or today's expenses), invested money (taxable + deferred + free buckets), contributions, income and expenses (what is left over), `assumptions`, `retirement.withdrawalRate`, `retirement.stocksNow`.

## Outputs
`fiNumber`, `invested`, `progress`, `gap`, `savingYearly`, `savingsRate`, `realReturn`, `yearsToFi`, `fiAge`, `fiYear`, `coast` (number, reached), `retireAge`.

## Formulas
- FI number = yearly spending / withdrawal rate (4% -> 25x).
- Saving a year = contributions (own + employer) + max(0, left over each month x 12 - own contributions) so nothing is counted twice.
- Real return = the stock/bond blend at `stocksNow` deflated by inflation. Years to FI: grow the invested pot by the real return plus the yearly saving until it reaches the number (80-year cap).
- Coast number = FI number / (1 + real return)^(years to the retirement age).
- Years from nothing (`yearsFromZero(rate, realReturn, withdrawalRate)`), shown for saving half and a tenth of income: save `rate` of income at each year's end, grow at the real return, until the pot reaches (1 - rate) / withdrawal rate; income drops out (the idea of Mr. Money Mustache's "The Shockingly Simple Math Behind Early Retirement", 2012, worked with the page's own assumptions; at 5% and 4%: 17 and 52 years).

## Tests
`tests/retirement-pages.test.mjs`.

## Ideas / not yet
- Barista variant (part-time income), the full savings-rate-to-years table, a chart of the path.

## Independent answer-key audit

`tests/golden/retirement/fire.csv` supplies 1,800 invented cases across 18 rules,
each with 60 grid, 30 edge and 10 extreme rows. The full formula inventory, exact
CSV header, assumptions and sources are in
[`tests/golden/retirement/briefs/fire.md`](../../../tests/golden/retirement/briefs/fire.md).
The standalone generator `tools/golden_retirement/fire.py` never executes the app
to obtain expectations. Every tenth row has an independent second check, enforced
by the generator. Money is stored to cents and replayed with a 0.005 tolerance;
rates and progress have six decimal places.

The 4% historical context comes from [William Bengen (1994), “Determining Withdrawal
Rates Using Historical Data,” FPA reprint, pp.4–5](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf).
The calculator's division by a selected withdrawal rate is an arithmetic target,
not a promise of safe withdrawals. Default returns (stocks 7%, bonds 4%, inflation
3%), 70% stocks, retirement age 65 and the 80-year search cap are application
assumptions. Fixture balances are invented worked examples, not published data.

For clarity, the annual-saving formula is equivalently
`max(own contributions, max(0, annual income − annual expenses)) + employer`.
The exact real-return formula is `(1 + nominal)/(1 + inflation) − 1`.
The balance after `n` annual periods is
`P(1+r)^n + S((1+r)^n−1)/r`, or `P+nS` when `r=0`; these identities are derived
by summing each end-of-year deposit's future value. The oracle uses the closed
form and checks it against the expanded cash flows, rather than reproducing the
application's loop. The first crossing through year 80 supplies `yearsToFi`;
failure by then gives null, while an already sufficient pot gives zero.

Progress has an upper cap of one; the gap has a floor of zero. Savings rate is
null when annual income is nonpositive and otherwise capped at one. Age is the
age attained during the evaluation year, even before the birthday. Cash, property,
vehicles and 529 accounts do not count toward the invested pot; insurance cash
value is included in the deferred bucket. If the projection inputs are incomplete,
the page uses current recurring expenses as its spending fallback and zero
invested money. Each convention is covered by the answer key.
