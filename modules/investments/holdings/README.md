# Holdings  (`investments/holdings`)

**Status:** usable (phase 7)
**Purpose:** What you hold in each investment account, what it is worth and what you paid; type it in or import the brokerage's positions file.

## Inputs
`holdings` (`[{ id, accountId, symbol, name, shares, price, priceAsOf, costBasis, assetClass ("" = worked out), expenseRatio, yield, lots, paysEvery? }]`; `paysEvery`: how often it pays, "How often it pays" under More details, read by Dividends' Month by month, written only when chosen), `accounts` (the invested types: brokerage, 401(k), IRA, Roth, HSA, 529, crypto), `data/funds.js` (about 100 common funds: class, expense ratio, typical yield, the split of balanced funds).

## Outputs
`compute()`: `items[]` (each holding enriched: value = shares x price or the cost when unpriced, class and `mix` (a target-date or balanced fund is split into US/international/bonds), expense ratio, yield, yearly fee and income, gain, account and tax bucket), `total`, `costTotal`, `gain`, `byAccount[]` (value against the Net worth balance), `byClass[]`, `stockShare`, `classifiedShare`, `unknown`, `unpriced`, `warnings`. Also `classify(symbol, name, year, ownClass)`, `targetDateMix(targetYear, thisYear)`, `parsePositions(text)` (Fidelity, Schwab, Vanguard and similar exports: finds the symbol/name/quantity/price/value/cost/account columns, drops totals and pending rows, treats the sweep line as cash), `mergePositions(holdings, rows, accountId)`.

## Formulas
Target-date glide used for a fund named with a year: 90% stocks 25+ years out, gliding to 50% at the year and 30% seven years after; stocks split 60/40 US/international. Bonds are the rest after rounding, so the parts add to 100% (the 2030 fund used to add to 101%, 2026-11-02). Unknown symbols stay "not classified" until the owner picks a class (a warning says so). Vanguard's Target Retirement funds (Investor shares, VTINX and VTWNX to VSVNX) are known by ticker alone: tickers and years from Vanguard's Target Retirement page (investor.vanguard.com/investment-products/mutual-funds/target-retirement-funds), checked 2026-11-02. That page gives no fee or yield, so both stay unknown until typed. The Income fund gets the glide's end mix (30% stocks), the app's own assumption, as for every dated fund.

## The page (simple first: opt spec 6.1, done 2026-11-15 with gap list, next 60, item 8)
- The add form asks five boxes: In which account, Symbol, Shares, Price a share, What you paid in all. Name, Kind of
  investment, Expense ratio and Yield wait under "More details (optional)" (the form kit's fold, `more: true`): what Save
  writes is the same with the fold open or shut (R22; the module test compares the record with 154a597's keys). A holding
  with no kind yet ("pick a class") opens its form with the fold open, so the box it needs is in view.
- "Import a positions file" is one quiet card drawn by `core/ui/more.js` (`part`, kind `own`, `card: true`, status "from
  your brokerage"); its title is pinned in `qa/first-view-lib.mjs` PINNED_TITLES (the opt spec's own words). After an
  import it stays open with its green line at its top, where the thumb is (R17); adding a holding with the form leaves it
  shut (S11 in `module.test.mjs`).
- The first view of the empty list went from 116 words and 9 boxes to 85 words and 5 boxes (the families' worst,
  `node qa/first-view-node.mjs investments/holdings`), so its entry left `tests/first-view.known.json`.

## Your own labels (gap list, next 60, item 44; 2026-11-15)
- The form has "Your own labels" under "More details (optional)" with a chip for each label already used in the plan;
  the rules and the box are Net worth's (`balance/net-worth/labels.js`, `labels-view.js`; README there). Saved as
  `holdings[].labels` only when there are some; an emptied box removes it; the green line says "Labels: kids." or "No
  labels now.".
- Once a holding, or an account that holds one, carries a label, one row of chips ("All holdings", then each label)
  sits above the account cards. A tap lists only the holdings that carry the label or sit in an account that does
  (`byLabel`), hides account cards left empty, and says one line per case: "2 holdings labeled kids: $117,600." (one
  holding: "1 holding labeled ...") for Sam and Lee with BND and VNQ labeled; "1 holding in an account labeled
  retirement: $90,000." when all are listed for their account's label ("in accounts labeled" for two or more); and
  "3 holdings labeled kids: $151,000. 2 of them are listed because their account is labeled kids." when some are
  (Brokerage and VTI labeled kids; critic P1, 2026-11-15: a holding with no pill of its own must not look labeled by
  mistake). `byLabel` gives `own` (how many carry the label themselves) and `accounts` (how many accounts the others
  sit in) for those words. The total at the top stays the whole list's; nothing is written (a module variable for the
  visit; a save that leaves the holding outside the label shown puts the list back to all). A holding's own labels
  show as pills on its row, and an account's labels as pills on its card's line, all labels shown or one.
- `holdingLabels(plan)`: the labels on holdings and on the accounts that hold one (an account with nothing in it offers
  no chip here). `compute()` is unchanged; a holding's `labels` rides along in `items[]` as every field of the record does.

## Edge cases
Prices are whatever was typed or imported (no market data); the page shows when. A holding pointing at an account that is no longer an investment account is flagged. Import updates matching symbols in the chosen account and adds new ones; holdings the file does not list are left alone.

## Tests
`tests/investments.test.mjs` (the three positions fixtures `qa/fixtures/positions-*.csv`, classification, totals), `module.test.mjs` (the five boxes and the fold, the same record open or shut, the importer as a part and S11, How often it pays, the labels: save, removal, words, refusal and its words, the filter, the three cases of its line, the account's pills).

## Ideas / not yet
- Price lookups (would need a market-data service: the app has none by design), lots from the brokerage's cost-basis export, crypto and employer-stock pages.
- A coin changed, moved or removed here keeps its crypto account's balance equal to its coins (shares x price), as the Crypto page does; the last coin removed takes its value off (review of the stress-test fixes: a change reached from Crypto's "Change or remove" left the wallet at its old balance).
- A fund's shares cannot go below the shares in its lots (held with words at the box); a row tap opens its form and only Cancel or Save closes it (a quick second tap shut it).
- A holding whose one lot holds every share (Crypto makes it from the purchase date): fewer shares and a new "What you paid in all" follow into that lot, and the confirmation says so; more shares stay outside it (their purchase date is unknown) and the confirmation says to add them on Tax lots; 0 shares is refused with a pointer to "Remove this holding" (claude-r N1 and its check).
- Fewer shares with the cost left the same keeps the cost (right for a typo); the confirmation adds "If you sold some, lower What you paid in all by what those shares cost" (claude-r N8). More shares than the one lot holds: the confirmation says to add their purchase and cost on Tax lots, which then raises "What you paid in all" (N6).
- More shares on a fund without lots, cost left the same: the confirmation says to add what the new shares cost to "What you paid in all".
