# Tax lots and harvesting  (`investments/tax-lots`)

**Status:** usable (phase 7)
**Purpose:** The gain or loss on each lot you hold, the losses worth harvesting in taxable accounts, and the order to sell in when you need cash.

## Inputs
`holdings[].lots` (`[{ id, date, shares, cost }]`, edited here), holdings' prices and cost, the Federal estimate's rates (marginal and qualified-gains).

## Outputs
`holdings[]` with `lots[]` (value, gain, term short/long, days to long-term, `longOn`, an "unassigned" lot for shares no lot covers at the average cost), `harvest[]` (taxable lots with a loss, the tax each saves), `harvestTotal`, `taxSavedTotal`, `shortLosses`, `longLosses`, `sellFirst[]` (taxable lots, lowest gain per share first), `notes`.

## Formulas
Term: long-term once held more than one year, counted by the calendar from the day after the buy (IRS Publication 550 (2025), "Holding Period": "begin counting on the date after the day you acquired the property. The day you disposed of the property is part of your holding period"; read 2026-10-31), so the first long-term day is the day after the first anniversary (`longOn`; a February 29 buy: March 1). Counting days instead ("more than 365") is a day early whenever a February 29 falls in between. Lots without a date count as long. Rates: the federal tax on $1,000 more of short-term gain (`marginal`) or long-term gain (`gainsRate`), each with the 3.8% tax on investment income where it applies (IRC 1411); a true 0% stays 0%. Tax saved by a loss: the loss x the marginal rate (short) or the gains rate (long). Sell-first order: highest cost per share first (specific identification).

## Edge cases
Lots in retirement accounts are shown but do not affect tax (a note on the card). The wash-sale rule is text: buy something similar, not identical, or wait 31 days.

## Tests
`tests/investments.test.mjs`, `module.test.mjs` (the holding period across leap years, the rates with the 3.8% and at 0%).

## Ideas / not yet
- Import lots from the brokerage's cost-basis export; carry harvested losses into next year's Capital gains page.
