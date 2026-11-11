# House down payment  (`goals/house`)

**Status:** usable (phase 4)
**Purpose:** How much home the household's income supports by the lenders' rules, what a home costs a month, the cash needed on the day, and when you will have it; one tap puts the cash target on the Goals page.

## Inputs
`income` (gross monthly), `accounts` and `debts` (other debt payments, not the mortgage), `goals` (the house goal, `findHouseGoal`: a down payment or a home to buy, supplies what is set aside, the monthly amount and the date), `assumptions.returnCash`, `whatIfs.house`. Writes `whatIfs.house = { price, downShare, closingShare, rate, termYears, taxRate, insuranceRate, hoaMonthly, reserveMonths, saved, monthly, targetDate }` and, on "Make it a goal", adds or updates a goal (target = the cash needed, rounded to $100).

## Outputs
`compute(plan, { today })` -> `{ inputs, grossMonthly, otherDebtMonthly, maxFront, maxBack, maxPrice, rule, monthly, parts, frontShare, backShare, cash: { down, closing, reserves, total }, saved, goal, monthlySaving, monthsToGo, readyDate, target, neededMonthly, warnings }`.

## Formulas
- Monthly cost(price) = pmt(rate / 12, term x 12, price x (1 - down)) + price x (property tax + insurance) / 12 + HOA. It is linear in the price, so the price a budget buys = (budget - HOA) / the cost of one dollar of price (`priceFor`).
- Budget = min(28% of gross monthly income (front end), 36% of it less the other debt payments (back end)); the binding one is `rule`.
- Cash = down payment + closing costs (3%) + reserves (2 months of the monthly cost).
- Months to go: set-aside money grown at the cash return each month plus the monthly saving, until it reaches the cash needed (`solveMonths`, up to 100 years). Monthly needed by a date = pmtToReach(cash return / 12, months, cash needed, set aside).
- Warnings: under 20% down (mortgage insurance), a price over what the rules suggest.
- The house goal (`houseGoalRank`, `isHouseGoal`, `findHouseGoal`, exported): saving to buy a home, never a goal for a
  home you already have or for a car. Each goal gets a rank and the highest wins (the first of equals), so a real
  down-payment goal beats "Our home" listed before it, and "Home remodel" is never read or overwritten: 3 a name with
  "down payment" (what "Make it a goal" saves) unless it names a car, boat or the like; 2 the 🏠 icon, or a name for
  buying a home ("Homebuying fund", "Buy a house"); 1 house, home or condo in the name, also run into another word
  ("Townhouse fund", "Farmhouse"); 0 anything else, and any name about work on, paying for or a trip to a home you have
  (repairs, remodel, paint, pay off, mortgage, rent, insurance, office, gym, trip, visit, holiday, housewarming...).
  "Beach house" counts (most likely saving to buy one); "Beach house rental" does not. History: until 2026-10-31 any
  name containing "home" counted, so "Make it a goal" overwrote a "Home repairs" goal; the first fix needed house or
  home as a whole word, which lost "Townhouse fund" and "Homebuying fund" and still took "Pay off the house" (found by
  a third review the same day). The step-by-step guide's "Set down payment goal" step uses the same test.

## Opening on your own goal (2026-11-01, round 2 of the owner's experience list)
- Never saved here (`whatIfs.house` absent) and a house goal with an amount: the page opens on the price that amount buys,
  `priceForCash(target)` = (target - HOA x reserve months) / (down share + closing share + reserve months x monthly cost per
  dollar), rounded to $1,000 ("Your "House down payment" goal of $50,000 buys a home of about $206,000"), and "To have it
  by" quotes the Goals page's own `neededMonthly`, so the two pages agree. Before, it opened on the $400,000 example
  ($97,010 cash, "about $2,620 a month") while Goals said $1,431. The form's boxes show the same figures (the price the goal
  buys, not the example), so "Work it out" without a change saves what the page shows. A goal with no date gives no monthly
  figure (it read "To have it by : about $0 a month").
- The goal button shows only once the figures are the person's own (saved): outlined, naming both amounts, "Change the goal
  from $50,000 to $97,000", or "Make it a goal ($97,000)" when there is none. Before, a filled "Update the goal" applied the
  example's figures in one tap and replaced the person's $50,000 with $105,995. Unsaved and with no goal, a line says to put in
  the home first.
- Dates read as month and year ("November 2029").

## Tests
`module.test.mjs`: the monthly cost and its inverse, months to save, the family's limits, cash and monthly needed, the house goal test (a repairs, pay-off or trip goal is never offered; the clearest of several wins), a house goal supplying the figures, entered figures winning, the warnings, no income.

## Ideas / not yet
- Mortgage insurance in the cost; first-time buyer programs; the down payment drawn from a 401(k) loan or an IRA's first-home exception.

## Touch and input stress test (2026-11-11, claude-g)
- "Work it out" says the answer in its green line ("Saved. A $350,000 home: about $2,410 a month.") and keeps "The figures" open
  for the next try (j-one-answer A1, p-cashflow-b-goals F6). Bringing the answer into view is wave 1's shared helper.
