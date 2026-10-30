# Vehicle  (`goals/vehicle`)

**Status:** usable (phase 4)
**Purpose:** The next car paid in cash or financed: the saving a month to pay cash by the date, the loan for what is not saved by then, and the 20/4/10 rule of thumb.

## Inputs
`goals` (a goal named for a car, vehicle, truck, SUV or van: price at its date, set aside, monthly), `income` (gross), `expenses` (transport category), `assumptions.returnCash`, `whatIfs.vehicle`. Writes `whatIfs.vehicle = { price, salesTax, tradeIn, date, rate, termMonths, saved, monthly }` and, on "Save $X a month", the car goal's `monthly`.

## Formulas
- Net cost = price x (1 + sales tax and fees) - trade-in. Price: entered, else the car goal's target at its date.
- Months = to the date (12 without one). Cash a month = pmtToReach(cash return / 12, months, net, saved); saved by then = fv(cash return / 12, months, monthly, saved), capped at the net cost; interest earned by saving it all = net - saved - cash a month x months.
- Financing: down = saved by then; loan = net - down; payment = pmt(rate / 12, term, loan); interest = payment x term - loan.
- 20/4/10 (a common rule of thumb): down >= 20% of the price with tax; loan <= 48 months; car costs (the payment + the transport expenses on Expenses) <= 10% of gross monthly income.
- Warning: a loan over 72 months.

## Tests
`module.test.mjs`: the example figures, Bo's car from its goal by hand (cash a month, saved by then, loan, payment, interest), the 20/4/10 checks with a cash purchase and a long loan.
