# Rent vs buy  (`property/rent-vs-buy`)

**Status:** usable (phase 10)
**Purpose:** Renting against buying the same home, as two households that start with the same money: who comes out ahead after the years you stay, the year buying pulls ahead, and the rent at which the two are even.

## Inputs
`whatIfs.rentVsBuy` (the figures; defaults below), the plan's own return (`insurance/term-vs-permanent` `planReturn` less `TAX_DRAG`). Writes `whatIfs.rentVsBuy = { price, downShare, rate, termYears, taxRate, insuranceRate, maintenanceRate, hoaMonthly, buyCosts, sellCosts, appreciation, rentMonthly, rentGrowth, rentersInsurance, investReturn, years, itemize, marginalRate }`. A what-if: nothing in the plan changes.

## Outputs
`compute(plan)` -> `{ inputs, monthlyPI, loan, upfront, firstYear: { buyMonthly, rentMonthly }, rows[], atEnd: { year, buyerWealth, renterWealth, ahead, winner }, breakevenYear, rentEven }`.

## Formulas (the "two households" method)
- Loan = price x (1 - down); payment = pmt(rate / 12, term x 12, loan); interest and principal month by month.
- Buyer's yearly cost = interest + principal + property tax + insurance + upkeep (each a share of the home's value that year) + HOA (rising with rent growth) - tax saved (when itemizing: (interest + property tax up to $40,000) x the top rate).
- Renter's yearly cost = rent (rising each year) + renters insurance.
- The renter starts with the deposit and closing costs invested. Each year both pots grow at the investment return, and whoever paid less adds the difference to their own pot.
- Buyer's money if sold = value x (1 - selling costs) - the loan left + the buyer's pot; renter's money = the renter's pot. Ahead = buyer - renter.
- Breakeven year = the first year (up to 40) the buyer is ahead. Rent at which they are even = bisection on the starting rent for the chosen years.
- Defaults: $400,000, 20% down, 6.5% for 30 years, property tax 1.1%, insurance 0.35%, upkeep 1%, closing 3%, selling 6%, home growth 3%, rent $2,200 rising 3%, renters insurance $180, 10 years, no itemizing (22%).

## Edge cases
- Dollars of each year (both sides alike, so the comparison holds without inflation adjustment).
- Mortgage insurance under 20% down, capital gains on the sale (usually excluded up to $250,000 / $500,000) and moving costs are not modelled.

## Tests
`module.test.mjs`: the inputs and defaults, one year by hand, the itemized saving, the defaults' breakeven and the even rent, cheap and dear rents.

## Ideas / not yet
- Prefill from the home on Accounts and the rent on Expenses; mortgage insurance; a Monte Carlo of home prices.
