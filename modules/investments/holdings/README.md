# Holdings  (`investments/holdings`)

**Status:** usable (phase 7)
**Purpose:** What you hold in each investment account, what it is worth and what you paid; type it in or import the brokerage's positions file.

## Inputs
`holdings` (`[{ id, accountId, symbol, name, shares, price, priceAsOf, costBasis, assetClass ("" = worked out), expenseRatio, yield, lots }]`), `accounts` (the invested types: brokerage, 401(k), IRA, Roth, HSA, 529, crypto), `data/funds.js` (about 100 common funds: class, expense ratio, typical yield, the split of balanced funds).

## Outputs
`compute()`: `items[]` (each holding enriched: value = shares x price or the cost when unpriced, class and `mix` (a target-date or balanced fund is split into US/international/bonds), expense ratio, yield, yearly fee and income, gain, account and tax bucket), `total`, `costTotal`, `gain`, `byAccount[]` (value against the Net worth balance), `byClass[]`, `stockShare`, `classifiedShare`, `unknown`, `unpriced`, `warnings`. Also `classify(symbol, name, year, ownClass)`, `targetDateMix(targetYear, thisYear)`, `parsePositions(text)` (Fidelity, Schwab, Vanguard and similar exports: finds the symbol/name/quantity/price/value/cost/account columns, drops totals and pending rows, treats the sweep line as cash), `mergePositions(holdings, rows, accountId)`.

## Formulas
Target-date glide used for a fund named with a year: 90% stocks 25+ years out, gliding to 50% at the year and 30% seven years after; stocks split 60/40 US/international. Unknown symbols stay "not classified" until the owner picks a class (a warning says so).

## Edge cases
Prices are whatever was typed or imported (no market data); the page shows when. A holding pointing at an account that is no longer an investment account is flagged. Import updates matching symbols in the chosen account and adds new ones; holdings the file does not list are left alone.

## Tests
`tests/investments.test.mjs` (the three positions fixtures `qa/fixtures/positions-*.csv`, classification, totals), `module.test.mjs`.

## Ideas / not yet
- Price lookups (would need a market-data service: the app has none by design), lots from the brokerage's cost-basis export, crypto and employer-stock pages.
