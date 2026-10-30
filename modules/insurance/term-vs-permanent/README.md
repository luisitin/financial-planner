# Term vs permanent  (`insurance/term-vs-permanent`)

**Status:** usable (phase 8)
**Purpose:** Whole (or universal) life against "buy term and invest the difference", with the whole-life illustration's own numbers: which is ahead at the end of the term, what the family gets along the way, and the return that decides it.

## Inputs
`insurance.compare` (the figures, set on the page), `insurance.policies` (a whole-life policy fills in the death benefit and premium when none are entered), `assumptions.returnStocks` / `returnBonds`, `retirement.stocksNow` (the default return). Writes `insurance.compare = { deathBenefit, wholePremium, termPremium, termYears, cashValue, cashValueGuaranteed, taxed, returnRate }`.

## Outputs
`compute(plan)` -> `{ ready, missing, scenario, difference, rows: [{ year, sideFund, deathTerm, deathWhole }], atEnd: { sideFund, cashValue, cashValueGuaranteed, ahead }, breakeven, breakevenGuaranteed, wholeReturn, wholeReturnGuaranteed, verdict: "term"|"whole"|"close" }`.

## Formulas
Premiums are paid at the start of each year; the difference is invested the same day (annuity due).
- Difference = whole-life premium - term premium, a year.
- Side fund after t years = fv(r, t, difference, 0, due) (`core/math/finance.js`).
- Return r: entered, else the plan's mix now (stocksNow x returnStocks + (1 - stocksNow) x returnBonds), less `TAX_DRAG` 0.5% a year when the difference goes into an ordinary (taxed) account (an assumption for a broad index fund).
- Breakeven = the rate at which the side fund after the term equals the illustrated cash value: rateFor(cashValue, N, difference, 0, due). Whole life is ahead when r is below it; within `CLOSE` (0.25 points) the two are called close. The same against the guaranteed cash value.
- Whole life's own return = rateFor(cashValue, N, whole-life premium, 0, due): every premium as an investment, the cost of the insurance inside it.
- Along the way: term and invest = death benefit + side fund (while the term lasts); whole life = the death benefit.

## Edge cases
- A term premium at or above the whole-life premium: not compared (asks for a real term quote).
- An illustrated cash value below what the difference would be at -99%: any return wins for term; breakeven is null.
- Taxes on the way out and paid-up additions are not modelled (listed on the page).

## Tests
`module.test.mjs`: missing figures, the default return with and without the tax drag, a policy on file filling the figures, the side fund / breakeven / whole-life return against fv, the verdict either side of the breakeven, a term premium above the whole-life premium.

## Ideas / not yet
- Read the illustration (PDF or photo) with the AI and fill the form (the user clicks apply).
- Year-by-year cash values from the illustration to chart both lines; surrender charges in the early years.
