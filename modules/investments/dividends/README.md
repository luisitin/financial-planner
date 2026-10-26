# Dividends  (`investments/dividends`)

**Status:** usable (phase 7)
**Purpose:** The dividends and interest your holdings pay each year, by fund and by account, and what they cover of your spending.

## Inputs
Holdings (yields from the fund table or typed), the Expenses page (monthly spending), tax buckets of the accounts.

## Outputs
`total` (a year), `monthly`, `yieldOverall`, `items[]`, `byAccount[]`, `taxable`, `sheltered`, `coversShare`, `qualifiedGuess` (stock funds in taxable accounts), `unknownCount`, `notes`.

## Formulas
Income = value x yield. Yields are typical figures by class for the funds in the table (1.2% broad US, 3% international, 4% bonds and cash, 3.8% REITs) unless the fund's own figure was typed.

## Edge cases
Holdings without a yield are listed as unknown and left out. Reinvested income counts (and is taxed in taxable accounts).

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- A payment calendar by month from the funds' distribution schedules; the actual figures from a 1099-DIV.
