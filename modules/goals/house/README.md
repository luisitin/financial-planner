# House down payment  (`goals/house`)

**Status:** usable (phase 4)
**Purpose:** How much home the household's income supports by the lenders' rules, what a home costs a month, the cash needed on the day, and when you will have it; one tap puts the cash target on the Goals page.

## Inputs
`income` (gross monthly), `accounts` and `debts` (other debt payments, not the mortgage), `goals` (a goal named for a house, home or down payment supplies what is set aside, the monthly amount and the date), `assumptions.returnCash`, `whatIfs.house`. Writes `whatIfs.house = { price, downShare, closingShare, rate, termYears, taxRate, insuranceRate, hoaMonthly, reserveMonths, saved, monthly, targetDate }` and, on "Make it a goal", adds or updates a goal (target = the cash needed, rounded to $100).

## Outputs
`compute(plan, { today })` -> `{ inputs, grossMonthly, otherDebtMonthly, maxFront, maxBack, maxPrice, rule, monthly, parts, frontShare, backShare, cash: { down, closing, reserves, total }, saved, goal, monthlySaving, monthsToGo, readyDate, target, neededMonthly, warnings }`.

## Formulas
- Monthly cost(price) = pmt(rate / 12, term x 12, price x (1 - down)) + price x (property tax + insurance) / 12 + HOA. It is linear in the price, so the price a budget buys = (budget - HOA) / the cost of one dollar of price (`priceFor`).
- Budget = min(28% of gross monthly income (front end), 36% of it less the other debt payments (back end)); the binding one is `rule`.
- Cash = down payment + closing costs (3%) + reserves (2 months of the monthly cost).
- Months to go: set-aside money grown at the cash return each month plus the monthly saving, until it reaches the cash needed (`solveMonths`, up to 100 years). Monthly needed by a date = pmtToReach(cash return / 12, months, cash needed, set aside).
- Warnings: under 20% down (mortgage insurance), a price over what the rules suggest.

## Tests
`module.test.mjs`: the monthly cost and its inverse, months to save, the family's limits, cash and monthly needed, a house goal supplying the figures, entered figures winning, the warnings, no income.

## Ideas / not yet
- Mortgage insurance in the cost; first-time buyer programs; the down payment drawn from a 401(k) loan or an IRA's first-home exception.
