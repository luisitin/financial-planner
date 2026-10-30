# Crypto  (`investments/crypto`)

**Status:** usable, phase 7
**Purpose:** Your crypto and the funds that hold it: value against what you paid, the share of net worth, how far it could fall, and the tax if sold.

## Inputs
- `holdings[]` (through `investments/holdings`): in a `crypto` account a holding is a coin (a stablecoin if USDC, USDT,
  DAI, PYUSD); anywhere else a holding is crypto only if its symbol is a bitcoin or ether fund (`FUNDS`).
- `accounts[]` of type `crypto`: a balance above its listed coins shows as "the rest of the balance".
- Net worth (`balance/net-worth`); the federal estimate's inputs (`taxes/federal` `taxInputs`) for the tax rates.
- Writes: a new holding (and a "Crypto wallet" account if there is none), a coin's price; a crypto account's balance
  is kept equal to its coins (shares × price) whenever they change here.

## Outputs
`{ ready, items: [{ id, symbol, name, kind, account, bucket, shares, value, cost, gain, gainPct, price, priceAsOf, stale, lots }], total, cost, gain, volatile, share, level, netWorth, stress: { drop, loss, share }, tax: { shortGain, longGain, short, long, total, marginal, gainsRate }, harvest, harvestSaved, waitLong, staleCount }`.

## Formulas
- Value = shares × price (cost when there is no price); gain = value − what was paid.
- Share = crypto ÷ net worth; small up to 5% (a common planner's ceiling for crypto), large above 20%.
- Swing: a fall of 75% on everything but stablecoins, between bitcoin's two deepest recent falls (about 84% from
  December 2017 to December 2018, about 77% from November 2021 to November 2022, peak to low on daily closes).
- Lots (`investments/tax-lots` `lotsOf`): held more than 365 days is long-term (IRS Publication 550). Tax if sold
  today, taxable accounts only = max(0, net short gain) × the top rate on pay + max(0, net long gain) × the rate on
  the next $1,000 of long-term gains (both from the federal estimate, as Tax lots does).
- A lot with a loss can be sold to bank the loss: saved = loss × its rate. Coins are property, not securities, so the
  wash-sale rule (IRC §1091) does not apply to them as of 2026; it does to the funds.
- A short-term lot with a gain that turns long-term within 90 days: wait until the day after its first year;
  saved = gain × (top rate − gains rate).
- A price older than 7 days is flagged (stablecoins aside).
- 1099-DA (Treasury final regulations, 2024): brokers report gross proceeds on sales from 2025 and cost for coins
  bought from 2026.

## Edge cases
- No crypto anywhere: a hero and the add form, open.
- Funds in a 401(k) or IRA count toward the total but never toward tax.
- A coin with no lots: its whole cost is one long-term lot ("unassigned", as on Tax lots).

## Tests
`module.test.mjs`: kinds, not ready, totals and share and swing, stale prices, tax by lot with the loss and the wait,
a fund in an IRA, account balances beyond the coins.

## Ideas / not yet
- Prices fetched by the PC server from a public price feed (needs a network setting and a source).
- Staking income (taxed as income when received).
