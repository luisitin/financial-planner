# Asset location  (`investments/asset-location`)

**Status:** usable (phase 7)
**Purpose:** Which investments belong in which kind of account to keep the yearly tax bill down, the drag today, and the swaps that fix it.

## Inputs
Holdings (class and value per tax bucket: taxable, pre-tax, Roth/HSA), the Federal estimate's inputs (your marginal rate and the rate on qualified dividends), yields.

## Outputs
`buckets[]` (value and class split per bucket), `dragNow`, `dragIdeal`, `saving`, `ideal` (the placement with the same mix and the same account sizes), `swaps[]` (per bucket: sell one class, buy another, the same amount, so the mix is unchanged), `score` (good/fair/poor), `marginal`, `gainsRate`, `notes`.

## Formulas
Yearly tax drag of a taxable holding = income x (ordinary share x marginal rate + qualified share x gains rate), with ordinary shares bonds 100%, cash 100%, REITs 80%, other 60%, international 15%, US stocks 10%. Ideal placement: pre-tax accounts take the least efficient classes first (bonds, cash, REITs, other), Roth takes stocks, taxable gets what is left. Cash (a settlement balance) and unclassified holdings stay where they are.

## Edge cases
One kind of account only: nothing to place, a note says so. The tax on selling in a taxable account to make a swap is not in the saving; the page says to use new money and dividends there.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- The foreign tax credit as a bonus for international funds in taxable; state tax; growth-adjusted (Roth) placement.
