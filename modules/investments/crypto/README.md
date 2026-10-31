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
`{ ready, items: [{ id, symbol, name, kind, account, bucket, shares, value, cost, gain, gainPct, price, priceAsOf, stale, lots }], total, cost, gain, volatile, share, level, netWorth, stress: { drop, loss, share }, tax: { shortGain, longGain, net, addShort, addLong, total, carry, disallowed, lossLimit, why, year, otherYear, marginal, gainsRate }, harvest, harvestSaved, harvestCarry, harvestDisallowed, waitLong, staleCount }`.

## Formulas
- Kind (`cryptoKind`): a bitcoin or ether fund (`FUNDS`) is a fund wherever it is held, a crypto account included; any other
  holding in a crypto account is a coin, or a stablecoin if USDC, USDT, DAI or PYUSD.
- Value = shares × price (cost when there is no price); gain = value − what was paid.
- Share = crypto ÷ net worth; small up to 5% (a common planner's ceiling for crypto), large above 20%.
- Swing: a fall of 75% on everything but stablecoins, between bitcoin's two deepest recent falls (about 84% from
  December 2017 to December 2018, about 77% from November 2021 to November 2022, peak to low on daily closes).
- Lots (`investments/tax-lots` `lotsOf`): long-term when held more than one year, counted from the day after the buy
  (IRS Publication 550; IRC 1222(3)); a February 29 or a February 28 before a leap year is long-term from March 1. A lot
  held a year or less shows its first long-term day (`longOn`).
- **The tax year**: a sale today falls in today's tax year. When the Federal estimate is set to another year, the page
  works today's year without the sales typed on Capital gains, which belong to the set year (`todaysReturn` in Tax lots);
  the typed pay and dividends stay as the best guess at today's year, and the page says so (`year`, `otherYear`).
- **Whose return**: filing separately, each lot is on the return of its account's owner (IRS Pub. 501: each spouse reports
  their own income), through the sale's `personId`; a lot in a joint account or one with no owner is split in half, so each
  return has its own $1,500 loss limit (IRC 1211(b)).
- **Tax if sold today**, taxable accounts only: the Federal estimate's total tax with every crypto lot sold today (each
  lot's gain or loss added to the year's sales, short or long by its term) less the total without. The engine nets them
  with the year's other sales the way Schedule D does (short against short, long against long, then across), stacks
  long-term gains on top at 0/15/20% (IRC 1(h)), adds the 3.8% on investment income over its line (IRC 1411) and lets a
  net loss take at most $3,000 off other income, $1,500 filing separately (`lossLimit`, IRC 1211(b)). Below 0 the sale
  lowers this year's tax. `addShort` and `addLong` are what the sale adds to the year's net short- and long-term gains
  after that netting (below 0: other gains it cancels); `net` is the lots' gains less their losses that count.
  Until 2026-10-31 this was the net short gain x the rate on pay + the net long gain x the rate on long-term gains, which
  missed the netting across terms, the 0% band and the $3,000 limit.
- **Wash sales when everything is sold**: a fund is a security, so the same fund bought in the 30 days before today cancels
  the loss on that many shares (IRC 1091(a); Tax lots' `washSales`, 26 CFR 1.1091-1). With every taxable lot sold, only a
  purchase outside taxable accounts (an IRA's) can replace a loss (a lot sold the same day is never a replacement: the
  answer key's convention W3), and that part of the loss is lost for good (Rev. Rul. 2008-5): `disallowed`, and the lot
  counts only its allowed loss.
- **Carryover** (`tax.carry`, `harvestCarry`): the loss not used this year carries to next year (IRC 1212(b)), worked by
  the Capital Loss Carryover Worksheet (`lossCarryover`, Pub. 550 Worksheet 4-1), each spouse's return on its own when
  filing separately. Shown: the whole carryover with the sale less the one without, at least 0. Comparing the whole
  carryover matters: a gain in one term can use up a carried loss in the other (single, $10,000 short-term loss on other
  sales; coins +$5,000 short, −$6,000 long: 8,000 carries against 7,000, so 1,000 more, not the 6,000 rise in the
  long-term part). Until 2026-10-31 the page added each term's rise.
- **Why nothing changes** (`why`, when the tax moves by 50 cents or less): `none` nothing gained or lost; `even` the gains
  and losses cancel; with a net gain, `carry` it uses up a loss from other sales that would carry (the carryover falls),
  else `zero` it is taxed at 0% (under the deductions or in the 0% band); with a net loss, `limit` the year's other sales
  already take the whole $3,000 (each return's $1,500 filing separately), `under` taxable income is already 0 or less,
  else `zero` it only cancels other gains taxed at 0%.
- The rates shown (`marginal`, `gainsRate`): the federal tax on $1,000 more pay-like income or long-term gain, with the 3.8%
  where it applies, as Tax lots works them (no 10% floor any more). Shown when the sale adds tax or a gain could wait for
  long-term; in a net-loss year the next dollar's rate says little.
- **A loss to bank**: a lot with a loss over $1. Saved (`saved`, that lot sold on its own, with its own wash-sale match;
  `harvestSaved`, all of them together) = the federal tax now less the tax with the lots sold, so a loss first cancels this
  year's gains and then at most $3,000 of other income; `harvestCarry` carries to next year. Only the losing lots are sold,
  so a fund's other lots anywhere (a taxable lot bought in the last 30 days too) can replace them; the page names each
  purchase and says whether the cancelled loss is added to its cost (taxable account) or lost for good (IRA). Coins are
  property, not securities, so the wash-sale rule (IRC 1091) does not apply to them as of 2026; the sentence on screen
  follows what is in the list (coins, funds or both).
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
`module.test.mjs`: kinds (a fund in a crypto account), not ready, totals and share and swing, stale prices, the tax if sold
with the loss and the wait (hand-worked for the family example), a big loss against the $3,000 limit with its carryover, the
carryover across terms (1,000), selling everything with a fund washed by an IRA purchase (1,428.80), a fund washed by an IRA
purchase when banking, a lot's own wash match, a gain at 0% and nothing gained, the tax year, filing separately by owner
(3,500 against 2,000 carried), a fund in an IRA, account balances beyond the coins. The figures in the new tests are the
independent review's hand-worked ones (2026-10-31).

## Ideas / not yet
- Prices fetched by the PC server from a public price feed (needs a network setting and a source).
- Staking income (taxed as income when received).
