# Holdings  (`investments/holdings`)

**Status:** usable (phase 7)
**Purpose:** What you hold in each investment account, what it is worth and what you paid; type it in or import the brokerage's positions file.

## Inputs
`holdings` (`[{ id, accountId, symbol, name, shares, price, priceAsOf, costBasis, assetClass ("" = worked out), expenseRatio, yield, lots }]`), `accounts` (the invested types: brokerage, 401(k), IRA, Roth, HSA, 529, crypto), `data/funds.js` (about 100 common funds: class, expense ratio, typical yield, the split of balanced funds).

## Outputs
`compute()`: `items[]` (each holding enriched: value = shares x price or the cost when unpriced, class and `mix` (a target-date or balanced fund is split into US/international/bonds), expense ratio, yield, yearly fee and income, gain, account and tax bucket), `total`, `costTotal`, `gain`, `byAccount[]` (value against the Net worth balance), `byClass[]`, `stockShare`, `classifiedShare`, `unknown`, `unpriced`, `warnings`. Also `classify(symbol, name, year, ownClass)`, `targetDateMix(targetYear, thisYear)`, `parsePositions(text)` (Fidelity, Schwab, Vanguard and similar exports: finds the symbol/name/quantity/price/value/cost/account columns, drops totals and pending rows, treats the sweep line as cash), `mergePositions(holdings, rows, accountId)`.

## Formulas
Target-date glide used for a fund named with a year: 90% stocks 25+ years out, gliding to 50% at the year and 30% seven years after; stocks split 60/40 US/international. Bonds are the rest after rounding, so the parts add to 100% (the 2030 fund used to add to 101%, 2026-11-02). Unknown symbols stay "not classified" until the owner picks a class (a warning says so). Vanguard's Target Retirement funds (Investor shares, VTINX and VTWNX to VSVNX) are known by ticker alone: tickers and years from Vanguard's Target Retirement page (investor.vanguard.com/investment-products/mutual-funds/target-retirement-funds), checked 2026-11-02. That page gives no fee or yield, so both stay unknown until typed. The Income fund gets the glide's end mix (30% stocks), the app's own assumption, as for every dated fund.

## Edge cases
Prices are whatever was typed or imported (no market data); the page shows when. A holding pointing at an account that is no longer an investment account is flagged. Import updates matching symbols in the chosen account and adds new ones; holdings the file does not list are left alone.

## Tests
`tests/investments.test.mjs` (the three positions fixtures `qa/fixtures/positions-*.csv`, classification, totals), `module.test.mjs`.

## Ideas / not yet
- Price lookups (would need a market-data service: the app has none by design), lots from the brokerage's cost-basis export, crypto and employer-stock pages.
- A coin changed, moved or removed here keeps its crypto account's balance equal to its coins (shares x price), as the Crypto page does; the last coin removed takes its value off (review of the stress-test fixes: a change reached from Crypto's "Change or remove" left the wallet at its old balance).
- A fund's shares cannot go below the shares in its lots (held with words at the box); a row tap opens its form and only Cancel or Save closes it (a quick second tap shut it).
- A holding whose one lot holds every share (Crypto makes it from the purchase date): fewer shares and a new "What you paid in all" follow into that lot, and the confirmation says so; more shares stay outside it (their purchase date is unknown) and the confirmation says to add them on Tax lots; 0 shares is refused with a pointer to "Remove this holding" (claude-r N1 and its check).
- Fewer shares with the cost left the same keeps the cost (right for a typo); the confirmation adds "If you sold some, lower What you paid in all by what those shares cost" (claude-r N8). More shares than the one lot holds: the confirmation says to add their purchase and cost on Tax lots, which then raises "What you paid in all" (N6).
- More shares on a fund without lots, cost left the same: the confirmation says to add what the new shares cost to "What you paid in all".
