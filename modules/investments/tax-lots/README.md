# Tax lots and harvesting  (`investments/tax-lots`)

**Status:** usable (phase 7)
**Purpose:** The gain or loss on each lot you hold, the losses worth harvesting in taxable accounts, and the order to sell in when you need cash.

## Inputs
`holdings[].lots` (`[{ id, date, shares, cost }]`, edited here), holdings' prices and cost, the Federal estimate's rates (marginal and qualified-gains).

## Outputs
`holdings[]` with `lots[]` (value, gain, term short/long, days to long-term, an "unassigned" lot for shares no lot covers at the average cost), `harvest[]` (taxable lots with a loss, the tax each saves), `harvestTotal`, `taxSavedTotal`, `shortLosses`, `longLosses`, `sellFirst[]` (taxable lots, lowest gain per share first), `notes`.

## Formulas
Term: more than 365 days held = long-term; lots without a date count as long. Tax saved by a loss: the loss x the marginal rate (short) or the gains rate (long). Sell-first order: highest cost per share first (specific identification).

## Edge cases
Lots in retirement accounts are shown but do not affect tax (a note on the card). The wash-sale rule is text: buy something similar, not identical, or wait 31 days.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Import lots from the brokerage's cost-basis export; carry harvested losses into next year's Capital gains page.
