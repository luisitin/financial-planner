# Rent vs buy  (`property/rent-vs-buy`)

**Status:** usable (phase 10)
**Purpose:** Renting against buying the same home, as two households that start with the same money: who comes out ahead after the years you stay, the year buying pulls ahead, and the rent at which the two are even.

## Inputs
`whatIfs.rentVsBuy` (the figures; defaults below), the plan's own return (`insurance/term-vs-permanent` `planReturn` less `TAX_DRAG`). Writes `whatIfs.rentVsBuy = { price, downShare, rate, termYears, taxRate, insuranceRate, maintenanceRate, hoaMonthly, buyCosts, sellCosts, appreciation, rentMonthly, rentGrowth, rentersInsurance, investReturn, years, itemize, marginalRate }`. A what-if: nothing in the plan changes.

## Outputs
`compute(plan, { previews? })` -> `{ inputs, monthlyPI, loan, upfront, firstYear: { buyMonthly, rentMonthly }, rows[], atEnd: { year, buyerWealth, renterWealth, ahead, winner }, breakevenYear, rentEven, previewed? }`
(`previews` and `previewed`: "Our guesses in the boxes" below). `inputsOf(plan, previews?)`. Also exported: `estimators`
(re-exported by `module.js`), `PREVIEWED`, `PREVIEW_KEYS`, `typicalRent`, `rentOnFile`.

## Formulas (the "two households" method)
- Loan = price x (1 - down); payment = pmt(rate / 12, term x 12, loan); interest and principal month by month.
- Buyer's yearly cost = interest + principal + property tax + insurance + upkeep (each a share of the home's value that year) + HOA (rising with rent growth) - tax saved (when itemizing: (interest + property tax up to $40,000) x the top rate).
- Renter's yearly cost = rent (rising each year) + renters insurance.
- The renter starts with the deposit and closing costs invested. Each year both pots grow at the investment return, and whoever paid less adds the difference to their own pot.
- Buyer's money if sold = value x (1 - selling costs) - the loan left + the buyer's pot; renter's money = the renter's pot. Ahead = buyer - renter.
- Breakeven year = the first year (up to 40) the buyer is ahead. Rent at which they are even = bisection on the starting rent for the chosen years.
- Defaults: $400,000, 20% down, 6.5% for 30 years, property tax 1.1%, insurance 0.35%, upkeep 1%, closing 3%, selling 6%, home growth 3%, rent $2,200 rising 3%, renters insurance $180, 10 years, no itemizing (22%).

## Our guesses in the boxes (smart guesses C9, 2026-11-14; spec 12.1 "K3 previews")
An empty **Home price**, **Rent for a similar home**, **Mortgage rate**, **Property tax** or **Home insurance** box shows our
guess in gray with one line under it ("Our guess: typical rent before utilities in Ohio."). The answer counts it while the
box stays empty, on this page only; an empty box saves `null`, never the figure, and no `plan.guesses` entry is made; opening
the page writes nothing. While nothing is saved the card at the top says the answer is an example, first ("An example: a
typical Ohio home of $250,000, 20% down, against renting a similar one for ..."; "Put in yours below: an empty box counts the
gray figure."), the answer reads "Example: renting ahead by", and the even-rent sentence says "this rent" for our typical rent
("your rent" only for a rent typed here or on Expenses; critic e9 P1, 2026-11-14: the empty plan read "Renting ahead by
$101,610" as if it were about the person). Once saved the card names the guesses still in use ("Our guesses for now: the price, the rent, the rate, property tax and
insurance.", House down payment's `guessedWords`); "The figures" says "5 our guesses" while shut. Without `params.previews`
`compute` is exactly as before (module test; checked against the code before this change on nine invented households).

| box | estimator | formula and table |
|---|---|---|
| price, rate, property tax, insurance | `goals/house:price`, `:rate`, `:taxRate`, `:insuranceRate` | House down payment's README, "Our guesses in the boxes": the state's median home value (ACS 2025), Freddie Mac's 2026 average 30-year rate, the state's median tax over median value (ACS 2025), the state's HO-3 premium scaled to the price (NAIC 2023 x CPI) |
| rent | `property/rent-vs-buy:rent` | **A household that rents** (no home, no mortgage: the guesses module's `profileOf`) **with its rent on Expenses**: every housing row running today, a month, to the cent ("what you pay now, as on your Expenses page"; "our guess of your rent, ..." when every such row is our guess from Get started). Riley: **$950**. A housing row named for a mortgage ("Mortgage payment", "mtg", as cashflow/expenses reads one) means the household owns,
whatever Accounts holds: no rent on file (critic e9 F3: a $2,400 mortgage was taken for the rent). **Otherwise** the state's median gross rent x 0.897 (rent before utilities: the CE 2025 renters' rented dwellings over rent plus utilities without phones, `DERIVED.contractShare`), to $50 (R11): Ohio 1,155 x 0.897 = 1,036 -> **$1,050**; U.S. 1,557 x 0.897 -> **$1,400**. Tables `acs2025_median_gross_rent_by_state` (ACS 2025, B25064; read 2026-11-02), `ce2025_spend_by_housingTenure` (BLS Consumer Expenditure Survey 2025) |

Choices made here:
- **The rent is a typical rental, the price a typical owned home.** Rented homes are smaller on average than owned ones, so the
  two typical figures lean toward renting; the person's own rent, when the plan has it, is used first. Said here; no bedroom
  count is assumed (spec 16).
- **No gray figure without a sourced table**: down payment (20% stays in its box, as before, with "We start at 20%, which avoids
  mortgage insurance." under it while nobody typed it; critic e9 P2), years you would stay (10, "We start at 10 years."), the loan's
  length, upkeep (1% of the value, the usual rule), closing and selling costs, home and rent growth, renters insurance and the top
  tax rate open empty under "More details (optional)" with their help saying what an empty box counts ("Left empty, we count 6%:
  agent and fees."); HOA empty is none; the return keeps the plan's own mix.
- **The form asks for five boxes first** (price, rent, down payment, rate, years), the other thirteen under "More details
  (optional)" (docs/OPTIONAL.md R21); the line at the top names the gray tax and insurance figures folded there.

## The page, simple first (2026-11-14)
First view: the card with the comparison sentence (and the gray-figure line while nothing is saved, the guesses line after), the answer after the
years, the chart, the first year a month, then "The figures" (a part: open with its five boxes until saved, then shut with
"$400,000, $2,200 rent" or "5 our guesses" as its status; after "Compare" it stays open, R17), then "More on this" (`links()`:
"How much home can we afford?", "What is left on our mortgage?"). No hand-written `<details>` remain.

## Edge cases
- Dollars of each year (both sides alike, so the comparison holds without inflation adjustment).
- Help lines start as sentences ("Left empty, we use your plan's own mix, less tax along the way."; critic e9 P8). To fit the
  first-view count with the example words, the sentence under the answer says the same in fewer words ("If the home were sold
  that year: the buyer has its value less selling costs and the loan, plus investments; the renter, the investments.").
- Mortgage insurance under 20% down, capital gains on the sale (usually excluded up to $250,000 / $500,000) and moving costs are not modelled.

## Tests
`module.test.mjs`: the inputs and defaults, one year by hand, the itemized saving, the defaults' breakeven and the even rent, cheap and dear rents.
C9: the rent estimator (what a renter pays now, our guess there, an owner's state figure, no state, another currency), the
contract of all five keys, invariance (no previews: no new key, the same output), previews only in empty boxes, and the page
drawn: gray figures, the answer and the line counting them, opening writes nothing, "Compare" with empty boxes saves no figure
and no guess, S11, no guesses for another country or without `ctx.guess`; a housing row named for a mortgage is never the rent
(F3); the empty plan's answer said as an example, "this rent" for ours (P1); the help lines (P2, P8).

## Ideas / not yet
- Prefill from the home on Accounts and the rent on Expenses; mortgage insurance; a Monte Carlo of home prices.
