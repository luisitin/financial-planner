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
- Lots (`investments/tax-lots` `lotsOf`): long-term when held more than one year, counted from the day after the buy
  (IRS Publication 550; IRC 1222(3)); a February 29 or a February 28 before a leap year is long-term from March 1.
- **Tax if sold today**, taxable accounts only: the Federal estimate's total tax with every crypto lot sold today (each
  lot's gain or loss added to the year's sales, short or long by its term) less the total without. The engine nets them
  with the year's other sales the way Schedule D does (short against short, long against long, then across), stacks
  long-term gains on top at 0/15/20% (IRC 1(h)), adds the 3.8% on investment income over its line (IRC 1411) and lets a
  net loss take at most $3,000 off other income, $1,500 filing separately (IRC 1211(b)); what is left carries to next year
  (`lossCarryover`, Pub. 550 Worksheet 4-1; `tax.carry` is the part the sale adds). Below 0 the sale lowers this year's tax.
  Until 2026-10-31 this was the net short gain x the rate on pay + the net long gain x the rate on long-term gains, which
  missed the netting across terms, the 0% band and the $3,000 limit.
- The rates shown (`marginal`, `gainsRate`): the federal tax on $1,000 more pay-like income or long-term gain, with the 3.8%
  where it applies, as Tax lots works them (no 10% floor any more).
- **A loss to bank**: a lot with a loss over $1. Saved (`saved`, that lot alone; `harvestSaved`, all of them together) = the
  federal tax now less the tax with the lot sold, so a loss first cancels this year's gains and then at most $3,000 of
  other income; `harvestCarry` carries to next year. Coins are property, not securities, so the wash-sale rule (IRC §1091)
  does not apply to them as of 2026. A fund is a security: the same fund bought in the 30 days before today, in any account
  (an IRA too: Pub. 550; Rev. Rul. 2008-5), cancels the loss on that many shares, matched share for share (Tax lots'
  `washSales`, 26 CFR 1.1091-1); the page names the purchase and says whether the cancelled loss is added to its cost
  (taxable account) or lost for good (IRA).
- **A short-term lot with a gain that turns long-term within 90 days**: wait until its first long-term day; saved = the
  federal tax with the gain sold short-term less with it sold long-term.
- A price older than 7 days is flagged (stablecoins aside).
- 1099-DA (Treasury final regulations, 2024): brokers report gross proceeds on sales from 2025 and cost for coins
  bought from 2026.

## Edge cases
- No crypto anywhere: a hero and the add form, open.
- Funds in a 401(k) or IRA count toward the total but never toward tax.
- A coin with no lots: its whole cost is one long-term lot ("unassigned", as on Tax lots).

## Tests
`module.test.mjs`: kinds, not ready, totals and share and swing, stale prices, the tax if sold with the loss and the wait
(hand-worked for the family example), a big loss against the $3,000 limit with its carryover, a fund washed by an IRA purchase,
a fund in an IRA, account balances beyond the coins.

## Ideas / not yet
- Prices fetched by the PC server from a public price feed (needs a network setting and a source).
- Staking income (taxed as income when received).
