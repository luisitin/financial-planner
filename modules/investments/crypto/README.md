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
- Optional (gap list, next 60, item 46): `investments.cryptoMethod` (the way the exchange counts which coins a sale takes)
  and `whatIfs.crypto` (the question in "Which coins count as sold"); both read only by `sales.js`.
- Optional (gap list, next 60, item 45): `investments.staking` (the rewards from staking recorded here; read by `staking.js`
  and, for the year's income, by the Federal estimate's `stakingStep` in `taxes/federal/known.js`).
- Writes, when a staking reward is recorded ("Rewards from staking"): the reward on `investments.staking`, a purchase on its
  coin at the reward's worth, the coin's coins and cost, and the crypto account's balance; Undo and "Remove this reward" put
  them back.
- Writes, when a coin sale is recorded ("Sales for your tax return"): one `taxes.gains` row per purchase taken, each with an
  optional `coin` object (docs/DATA_MODEL.md), and the coins and their cost off the holding and its purchases (a holding
  sold out goes), the crypto account's balance following its coins; Undo and "Remove this sale" put them back.

## Outputs
`{ ready, items: [{ id, symbol, name, kind, account, bucket, shares, value, cost, gain, gainPct, price, priceAsOf, stale, lots }], total, cost, gain, volatile, share, level, netWorth, stress: { drop, loss, share }, tax: { shortGain, longGain, net, addShort, addLong, total, carry, disallowed, lossLimit, returns, why, year, otherYear, marginal, gainsRate }, harvest, harvestSaved, harvestCarry, harvestDisallowed, waitLong, staleCount, staking? }` (`staking` only when a reward is on file:
`stakingIn` for the Federal estimate's year).

`sales.js` (pure, called by the view beside `compute()`, which it does not change): `coinsOf`, `coinOrders`, `methodOf`
and the sentences, below. `txf.js` (pure, the same): the year's coin sales as a file for tax software, "A file for tax
software (TXF)" below.

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
  Filing separately as two returns, the gains the sale adds (`addShort`, `addLong`) are each return's own netting added up
  (the Federal estimate's `gains.byReturn`), and the page says the loss limit is $1,500 on each return ($3,000 between them;
  a loss in one spouse's account only uses that spouse's), `returns` = 2. An account's owner is a person's id since Net worth
  offers the people to choose from (2026-10-31); before that a typed name never matched, so every lot was halved.
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
  already take the whole $3,000 (each return's $1,500 filing separately), `under` taxable income is already 0 or less
  (filing separately, both judged on the returns the sold lots land on: a lot in neither name is half on each; until a review
  on 2026-10-31 the household's income was used, so a loss on a spouse with no income was said to fall on 0% gains),
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
Which coins count as sold (2026-11-16): each way's purchases, gain and tax against the hand check above, dollars to coins,
too many, nothing or too few picked, the question kept or dropped, every sentence case, the wash-sale note at a loss only
(and no match for a coin bought again), the coins offered, the way read with its default and its words; the page on the fake
DOM (S11: Work it out keeps its part open and moves nothing else; the chips ask first, save, Undo; no coins, one purchase,
"+ Add another coin" and Cancel; "More on this"); invariance with both new fields saved, every page, every household.
Sales for your tax return (2026-11-16): the purchases each way takes against the hand check, a purchase after the sale day,
a year and a day, cents adding up, one purchase with "The ones I pick", every refusal, recording then taking back (exactly
as before; a coin sold out goes and comes back), the Federal estimate's $1,079, the lines grouped by sale with every
sentence case, the CSV (columns, dates, eight places, "Whose"); the page (S11: Record the sale keeps its part open and moves
no other; Undo; a refusal saves nothing; Remove this sale asked first; the CSV's green line; the printout; "+ Record another
sale" and Cancel; every coin sold; two coins); invariance: the `coin` object changes no figure on any page.

## First view and the parts (simple first; docs/OPTIONAL.md, opt spec C17's crypto row, done in this page's gap commit)

- First view, as before: the two tiles, how far it can fall, what you hold, if you sold everything today, worth knowing.
  The add form is a card open while there are no coins ("Add a coin"), else behind one outlined "+ Add another coin" at
  the foot of the coin list that opens the form in its place under a hairline (Cancel puts the button back, with the
  focus on it); it was a hand-written fold, which a page that uses
  `core/ui/more.js` may not draw (S10). "More on this" goes through `links()`, each row a question.
- One card of quiet rows (`parts()`): "Which coins count as sold" (kind `item`), only when a coin in a crypto account has
  two or more purchases (with one, every way sells the same coins). Its status is the way that counts ("oldest first"),
  or "set by you" once a way is chosen with a chip; a question worked out is not a way chosen, so it leaves "oldest first"
  (the question is kept inside). After its own save it stays open (R17), with the green line.
  "Sales for your tax return" (kind `item`), when there is a coin to sell or a coin sale recorded this year (also with
  every coin sold, under the hero); its status "1 in 2026" or "none in 2026". The form "Record a sale" is open in it while
  no sale is recorded, else behind an outlined "+ Record another sale". Inside, the only filled buttons are each form's
  own (Work it out, Record the sale); Undo, Remove this sale, the CSV and the printout are outlined. After a record, Undo
  or a removal the list above the tapped button changes, so the green line is brought under the top bar (`ui.reveal`).

## Which coins count as sold (gap list, next 60, item 46; `sales.js`)

What the person gets: a sale of some of one coin worked three ways, each with the tax of that sale, and the way their
exchange counts saved for the sales they record here.

- **The coins offered** (`coinsOf`): holdings in a crypto account (kinds coin and stable; a bitcoin fund is Tax lots',
  where the wash-sale match is worked), with a price above 0 and coins left. Lots as Tax lots draws them (`lotsOf`: coins no
  typed purchase covers are one undated purchase, keyed `rest:<holding id>`). Wallet by wallet: a holding is one coin in
  one account, so a sale only ever takes purchases of the account it is sold from, as the IRS asks from 2025 (below).
- **The three ways** (Tax lots' `orderLots`, imported): oldest first = by purchase date, undated first, the same day in the
  order typed; highest cost first = by cost per coin, the most first, ties oldest first; the ones you pick = the checked
  purchases, oldest first.
- **The pieces** (Tax lots' `takeShares`): coins taken from the purchases in that order; a piece's cost is its purchase's
  cost per coin × the coins taken (the whole purchase's cost when all of it goes), its proceeds the price on file × the
  coins, both in cents; gain = proceeds − cost; short- or long-term as the purchase stands today (`lotsOf`: long-term when
  held more than a year, counted from the day after the purchase; Pub. 550, IRC 1222).
- **The tax of each way** (Tax lots' `saleRows` and `saleTax`): the Federal estimate's total tax for today's tax year
  (`todaysReturn`), this year's other sales included, with one sale row per term added (the account owner's return when
  filing separately), less the total without. So a way's figure nets against the year's gains, stacks long-term gains at
  0/15/20%, adds the 3.8% where it applies and lets a loss take at most $3,000 off other income, exactly as the Federal
  estimate would. `least` = the cheapest way (a tie goes to the oldest first, then the highest cost); `saving` = the oldest
  first's tax less the least's.
- **Hand check** (module test): single, pay $100,000 in 2026 (22% on the next dollar, 15% on a long-term gain); BTC at
  $100,000, purchases 0.1 for $2,500 (Mar 2023), 0.1 for $9,000 (Dec 2025), 0.05 for $5,500 (Jun 2026). Selling 0.1:
  oldest first takes the 2023 purchase, +$7,500 long-term × 15% = $1,125; highest cost first takes the 0.05 at a $500 loss
  and half the Dec 2025 purchase at a $500 gain, both short-term: no tax; the Dec 2025 purchase picked: +$1,000 × 22% =
  $220. "Highest cost first costs least: about $1,125 less federal tax than oldest first."
- **The wash-sale note** (`washNote`), only where a way sells at a loss: "Coins are property, not securities: as of 2026
  the wash-sale rule does not stop you buying the same coin back at once, so a loss counts in full." IRC 1091(a) reaches
  "stock or securities"; the Instructions for Form 8949 (2025) say "A digital asset is treated as property" (read
  2026-11-16, https://www.irs.gov/instructions/i8949); the Instructions for Form 1099-DA (2026) put a tokenized security
  under 1091 (read 2026-11-16, https://www.irs.gov/instructions/i1099da), which this page never offers. No wash-sale match
  is worked for coins.
- **The way your exchange counts** (`methodOf`, `investments.cryptoMethod`): three chips; a tap saves at once (no browser
  question: the choice is undone in one tap, and the line on the exchange sits under the chips), says so in green
  (`methodSaid`, which for highest cost first and the ones you pick adds "Set your exchange the same way before you sell" /
  "Pick the same ones on the exchange when you sell") with an outlined Undo (`methodUndone`; none saved before: the field
  goes). Absent = oldest first. The chip that is on is the saved way, else oldest first (tapping the chip already on does nothing). The
  saved way is marked "yours" among the three, and the sales recorded on this page take purchases in that order.
- **One sentence per case** (`waysSentence`, nine cases, each tested): too many coins; the same tax every way (adds, takes
  off, none); oldest first least (as little as another, or by how much); highest cost first least; the ones picked least;
  no question. Under each way, `wayLine`: Tax lots' line, except that a short- or long-term part that comes to $0 is not
  named ("A gain of $6,500, all of it long-term, from 2 purchases.", not "(+$0 short-term, +$6,500 long-term)"). Coins are
  counted in words as "1 coin", "0.5 coins" (`coinsText`).

**What the IRS says** (the IRS's "Frequently asked questions on digital asset transactions", Part II, for sales from
January 1, 2025, https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-digital-asset-transactions,
read 2026-11-16, and read again the same day after a review to check the FAQ numbers: FAQs 82 to 92 and 93 are the ones
"added Dec. 15, 2025", quoted below):
- FAQ 82 (your own wallet): "no later than the date and time of the sale ... you must identify the particular units to be
  sold ... on your books and records".
- FAQ 85 (at a broker, after December 31, 2025): you must "specify to the broker having custody of the units, no later than
  the date and time of sale ... the particular units", using "the identifiers designated by your broker".
- FAQ 88: after 2025 a standing order is allowed when "you have the standing order or instruction in place with the
  custodial broker no later than the date and time of the sale". For 2025 only, Notice 2025-7 let it be kept on your own
  books (https://www.irs.gov/pub/irs-drop/n-25-07.pdf, read 2026-11-16).
- FAQ 89: a broker that offers only one method: "such method is treated as a standing order or instruction, and you may not
  use any other method".
- FAQ 86, 87, 92: without a specific identification, the units count "in order of time from the earliest date on which
  units of the same digital asset in this wallet were acquired" (oldest first). Before 2025, Part I FAQ 41
  (https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-virtual-currency-transactions,
  read 2026-11-16) said the same: "first in, first out (FIFO)".
- Wallet by wallet: FAQs 86 and 87 count "in this wallet", FAQ 92 "held in the custody of a broker", and FAQ 93 describes
  the "universal" or "multi-wallet" way used before 2025 as the one that ends; the final regulations' § 1.1012-1(j) apply
  the ordering rules within one wallet or account (Notice 2025-7, section 2; Rev. Proc. 2024-28 lets unused basis be allocated to each wallet as of January 1, 2025,
  https://www.irs.gov/pub/irs-drop/rp-24-28.pdf, read 2026-11-16). The regulation itself on ecfr.gov and the Federal
  Register could not be read here (both refuse automated reads); it is quoted through the IRS's own notice.
- Form 1099-DA: brokers "must report gross proceeds for transactions effected on or after Jan. 1, 2025" and "basis on
  certain transactions effected on or after Jan. 1, 2026" (https://www.irs.gov/filing/digital-assets, read 2026-11-16); the
  basis is required for a "covered security", a digital asset "acquired after 2025 ... in an account for which the broker
  provided custodial services" and held there (Instructions for Form 1099-DA (2026)).
- So the one plain line on screen (made plainer after a review): "Your exchange reports your sales to the IRS, so set the
  same way there before you sell (its settings may call it the cost-basis method) and keep the confirmation. A sale only
  counts the purchases in the wallet or account it is sold from."

Builder's choices (where the brief left it open): one way for the household, not one per wallet (a household with two
exchanges set two ways is rare; the IRS rule that matters per wallet, which purchases a sale can take, holds anyway);
"The ones I pick" saved means the purchases are checked at each sale; the question in the row is asked first (as on Tax
lots), not worked for a made-up amount.

## Sales for your tax return (gap list, next 60, item 46; `sales.js`)

What the person gets: when they sell coins, they record the sale here once (coin, how many, the day, what they got); the
page takes the purchases by their way (or the ones they check), takes those coins off their list, puts the sale on
Capital gains where the Federal estimate counts it, and lays the year's coin sales out as Form 8949 lines, as a CSV and a
printout for a tax preparer. Information for a preparer, not a filing.

Where the brief was wrong about the code: it asked for "the year's coin sales", but the page recorded none, and the sales
typed on Capital gains carry no dates or units (Form 8949 needs both). Recording a sale here is the smallest thing that
gives the list its lines, and it keeps one place for each sale: the rows are Capital gains' own, with a `coin` object.

- **Which purchases a recorded sale takes** (`planSale`): those of that coin in that account bought on or before the sale
  day (a purchase made after it cannot have been sold; undated ones count as bought first, as both pages count them), in
  the order of the purchases checked, else the saved way (`methodOf`; absent: oldest first, IRS FAQs 86, 87, 92). With
  "The ones I pick" saved and a coin of one purchase, that purchase. Wallet by wallet: only that account's purchases.
- **Short or long at the sale day**: `lotsOf` on the sale day: long-term when held more than a year, counted from the day
  after the purchase (Pub. 550, as Tax lots quotes it: "begin counting on the date after the day you acquired the
  property"; IRC 1222); bought
  Oct 3, 2025 and sold Oct 3, 2026 is short-term, sold Oct 4 long-term (tested).
- **The money** (cents): what was got is shared out by coins, each piece's proceeds = what was got x its coins / the coins
  sold, rounded to the cent, the last piece taking the rest so the pieces add up (100.00 over three equal purchases: 33.33,
  33.33, 33.34); a piece's cost = its purchase's cost per coin x its coins (the whole purchase's cost when all of it goes;
  Tax lots' `takeShares`); gain = proceeds - cost. "What you got for them" is after the exchange's fee: the Instructions
  for Form 8949 (2025) ask for "the net proceeds" when no 1099 was received, and when one was, for "the proceeds shown on
  the form" in column (d), with code "E" and an adjustment in column (g) only for "digital asset transaction costs that
  aren't reflected on the form" (read 2026-11-16, https://www.irs.gov/instructions/i8949); the Instructions for Form
  1099-DA (2026), box 1f, tell the exchange "You must reduce the proceeds by digital asset transaction costs" (read
  2026-11-16, https://www.irs.gov/instructions/i1099da). So the printout says the 1099-DA's proceeds normally already have
  the fee out, and to adjust only for a fee it leaves out (a review found the earlier wording, "your preparer enters the
  form's amount and the fee as an adjustment", wrong for that normal case).
- **A cost not on file** (`onFile`, `noCost`): Holdings reads a cost left blank as $0, and so does Tax lots; this page
  counts it at $0 too (the plan has nothing else) but says so: above the sale's form and under the ways (`costMissing`:
  "What you paid for this ETH is not on file, so a sale of it counts as all gain: add it on Holdings first, if you know
  it."), under the green line after a sale (`costNote`, with "tap Undo, add it on Holdings, then record the sale again"),
  on each line ("cost not on file (counted as $0)"), on the printout ("not on file ($0)") and in the file (a "Note" column,
  only when a line needs it). Blank = null, undefined, "" or not a number; a 0 typed is a cost. A purchase's own cost when
  it is typed, else the holding's for the coins no purchase covers. Recording and taking back keep a blank cost blank (it
  had become $0).
- **Hand check** (module test, the single adult above): 0.15 BTC sold Oct 3, 2026 for $14,100, oldest first: the 2023
  purchase (0.1: $9,400 - $2,500 = +$6,900, long-term) and half the Dec 2025 one (0.05: $4,700 - $4,500 = +$200,
  short-term); the Federal estimate then counts $6,900 x 15% + $200 x 22% = $1,079 more. Highest cost first instead: the
  0.05 at $110,000 (-$800) and the 0.1 at $90,000 (+$400), a $400 short-term loss.
- **Refusals** (one sentence each, tested): no coin; no coins; fewer than 0.00000001 of a coin (`MIN_UNITS`, one satoshi:
  the pieces stop at a billionth of a coin, so a smaller sale took the coins off the list and wrote no row, and Undo could
  not put them back); no day; a day not on the calendar (2026-02-31; the date box prevents it, a typed or pasted plan may
  not); a day to come; a day outside the Federal estimate's year (the rows are that year's sales); nothing typed for what
  was got (0 is a sale); more coins than were held that day (with "the rest was bought after that day" when purchases came
  later); "The ones I pick" with nothing checked; the checked purchases too few. The coins a sale records are the pieces'
  sum, so what comes off the list is exactly what Undo puts back; `applySale` writes nothing for a sale with no rows.
- **Writing it** (`applySale`): each purchase taken loses its coins and cost (an emptied one goes), the holding loses the
  coins and their cost (a holding sold out goes), the rows go on `taxes.gains` (ids `<sale>-1` ...), and the account's
  balance follows its coins (shares x price). The money got is not put in any account (the person may have left it at the
  exchange or moved it to the bank): the green line says to add it where it went.
- **Taking it back** (`removeSale`: Undo, and "Remove this sale", asked first): the rows go and their coins and cost go
  back to their purchase (put back in date order when it had gone) and holding (made again, at the sale's price on its
  day, when it had gone); tested to give back the holdings and the year's sales exactly.
- **The lines** (`coinSales`): the rows with a `coin` sold in the Federal estimate's year, one line each (Form 8949 asks for
  each transaction on its own row, and short- and long-term on separate Parts even when one sale took both); the figures
  are the rows' as they stand on Capital gains. Grouped by sale on screen, newest first; one line per row in the CSV and
  the printout. Coin sales dated in another year are counted and named (`elsewhereSentence`). A hand-edited row is read
  safely (gap item 51's review, 2026-11-16): a coin with no symbol, or a blank one, reads "coin" ("0.1 coin", never "0.1
  undefined"), and a day bought that has the shape of a day but is not on the calendar (2026-13-45; `realDay`) is a day not
  on file, as on the screen ("bought on a day not on file"), in the spreadsheet ("unknown") and in the file for tax software
  (a bare D). Test: "TXF, a hand-edited plan (F1, F3) ...".
- **Form 8949's columns** (Instructions for Form 8949 (2025), read 2026-11-16): (a) "For a digital asset, include the full
  name or an abbreviated symbol of the digital asset and the exact units sold" = "0.1 BTC" (units to eight places); (b) the
  date acquired; (c) the date sold; (d) proceeds; (e) cost; (h) gain or loss; short-term on Part I, long-term on Part II;
  "Do not use box C to report digital asset transactions. Use box I" (and box L, not F, for long-term): the boxes are G to
  L, chosen from the 1099-DA's "Applicable checkbox", which the person has and the plan does not, so the list names the
  boxes and leaves the choice to the form. The CSV's columns are those, in that order, in plain words ("What was sold",
  "Date bought", "Date sold", "Sold for", "Cost", "Gain or loss", "Short or long term", and "Whose" when filing separately);
  dates as the form writes them (MM/DD/YYYY, "unknown" when the purchase has no date); money with two decimals, no $ sign
  (core/csv.js, and Tax lots' `csvText` guarding the text columns). The 1099-DA's "Applicable Checkbox on Form 8949" holds
  "Code G", "H", "J" or "K" (Instructions for Form 1099-DA (2026), read again 2026-11-16 after a review; boxes I and L are
  for a sale with no 1099-DA, Instructions for Form 8949 (2025)).
- **The words** (each tested): `coinSalesSentence` (five cases: none yet; short and long; short only; long only; even),
  `recordedSentence` (both terms, one term, both with one at $0 = "all of it long-term", a loss, nothing gained or lost),
  `moneyNote`, `costNote` and `costMissing` (all or part of the coins), `lineText` ("no gain or loss" for a line at $0),
  `recordWay` (three ways), `removeAsk`, `removedSaid`, `UNDONE_SALE`, `FORM_SCREEN`, `FORM_NOTE`, `elsewhereSentence` (one,
  several, none). On the phone after a review: no form words ("Part I", boxes, adjustments) on screen: the sentence names
  short- and long-term only, the line above the buttons says "For your tax preparer: print this list (the printout also
  says where each line goes on the form) or save it as a spreadsheet. It is not a filing." (`FORM_SCREEN`), and the
  preparer's note (`FORM_NOTE`) is on the printout. (A quiet fold for it would be a part inside a part, which R11 refuses.)
  The green line ends "It is now in this year's gains for your tax estimate." "Sold on" starts on today when today is in
  the year (the green line names the day, so a thumb that only confirms sees it).
- **The file and the printout** are made on the phone; nothing is sent anywhere. The printout is the report kit's sheet
  (`reportFrame`, `rtable`, `printSheet`), hidden on screen and shown by the printer, as Tax lots does.

After a reload the parts come back shut, the status saying what they hold ("1 in 2026"): a part with boxes is kept open
for the visit by wave 1 only while the person's own tap is on the screen, and after a save the page draws the part open
itself (R17), so the tap is not kept past that draw. Every page with an item part works this way (Tax lots' "Compare ways
to sell part of a fund" too); it is core/place.js's to change, not this page's.

Builder's choices: one row per purchase taken (not "VARIOUS"), so each line has its own date and term and the preparer can
match the 1099-DA; a coin sale is recorded for the Federal estimate's year only (its rows are that year's sales); the money
from a sale is left to the person to put in an account, since the page cannot know where it went; a bitcoin fund's sale is
not recorded here (its broker sends a 1099-B and it goes on Capital gains, with Tax lots' list).

## A file for tax software (TXF) (gap list, next 60, item 51; `txf.js`)

What the person gets: inside "Sales for your tax return", beside "Save as a spreadsheet (CSV)" and "Print this list", a third
outlined button, **"Save for tax software"**: the same Form 8949 lines (`coinSales`) as a file some tax programs bring in,
so the coin sales need not be typed again. The sentence above the buttons names all three ways (`TXF_FORM_SCREEN`: "For
your tax preparer or your tax program: print this list (...) or save it as a spreadsheet or as a file for tax software. It is
not a filing."; filing separately with no file, the list's own `FORM_SCREEN`). Under the buttons, one short sentence
(`TXF_SCREEN`), the one thing to know before the tap: if the program already has these sales from the yearly form the
exchange sends (Form 1099-DA), skip the file, or each sale counts twice. The rest is said where it is done, in the green line
after the tap (`txfSaid`), which lands right under the buttons (they do not move under the thumb): the file's name, "Import
it into your tax program, then check that each sale is filed as crypto, not as stocks." (the format has no place for coins),
then what is left to type there (a purchase date, a cost not on file). The format's name stays off the button; which programs are known to read the file is
here, not on the phone (simple first: the person who has the program finds its import). Nothing changes in the plan (no
field, no save); the file is made on the phone. Crypto's first view is unchanged (the part is shut by default; `node
qa/first-view-node.mjs investments/crypto`: 104/0/6/0/1/0 before and after).

Worked example (module test "TXF: the exact bytes ..."): the single adult above sells 0.1 BTC (the Mar 1, 2023 purchase,
cost $2,500) for $9,400 on Oct 3, 2026, and 0.05 BTC (from the Dec 1, 2025 purchase, cost $4,500) for $4,000 on Nov 2, 2026.
The file, each line ending in a carriage return and a line feed:
```
V042 / APlanner / D11/16/2026 / ^
TD / N714 / C1 / L1 / P0.1 BTC / D03/01/2023 / D10/03/2026 / $2500.00 / $9400.00 / ^
TD / N712 / C1 / L1 / P0.05 BTC / D12/01/2025 / D11/02/2026 / $4500.00 / $4000.00 / ^
```
(the long-term gain of $6,900 and the short-term loss of $500 are for the program to work out: the record carries the cost and
what was got, as Form 8949's columns (e) and (d)).

**The format, and where it was read (2026-11-16).** Intuit's own description of version 042 ("TXF042.jsp" on
turbotax.intuit.com, "TXF Spec of 11/30/11") could not be read: the host refuses this session's network, and GnuCash's
source calls the link dead. What was read instead, all public, none of it code taken into this app:
1. GnuCash, `libgnucash/tax/us/txf.scm`, stable branch (raw.githubusercontent.com/Gnucash/gnucash/stable/...; GPL, so a
   reference for facts only): "Updated Jan 2019 to include codes for version 42"; N321 / N711 / N712 "Short Term gain/loss -
   security" on "Form 8949 Copy A / B / C", N323 / N713 / N714 the long-term ones, each record format 5.
2. GnuCash, `gnucash/report/reports/locale-specific/us/taxtxf.scm` (same; GPL, facts only): "exports TXF files for use by
   TaxCut, TurboTax, etc."; "Based on TXF Spec of 11/30/11, V 042 ... the fields by format": format 5, a detail record: T, N,
   C, L, P, D, D, $, $, $ (GnuCash marks it "Spec unclear, unverified" and does not write it); the header "V042", "A" and the
   program, "D" and today as %m/%d/%Y, "^"; dates %m/%d/%Y; "C" and the copy (1); "L" 1 (counted only for format 3's payers);
   "^" ends a record; each line ends CR LF ("TurboTax seems to want these"); for a date acquired it does not have, its format
   4 record writes a bare "D".
3. txf-generator 1.0.0 on npm (registry.npmjs.org; MIT, 2018): its README points to "TurboTax TXF 042" and says its file is
   "uploaded as a supporting tax document to TurboTax"; its `sample-data/example.txf` writes, per sale, TD / N712 or N714 /
   C / L1 / P<units> <symbol> / D<bought, mm/dd/yyyy> / D<sold> / $<cost> / $<proceeds> / ^.
4. csv2txf (github.com/mbrukman/csv2txf, `csv2txf.py`, main branch, read 2026-11-16 via raw.githubusercontent.com; Apache
   2.0; nothing copied, facts only): it writes the broker sales codes N321 / N323 (record format 5 in source 1, like N712 /
   N714) as TD / N / C1 / L1 / P / D bought / D sold / $ cost / $ proceeds, and a third "$" only when the sale has an
   adjustment ("if txn.adjustment"), then ^; the header V042 / A<program> / D<today, MM/DD/YYYY> / ^.
Sources 2, 3 and 4 agree on the record's order (the description, the day bought, the day sold, the cost, the proceeds). The
third "$" of format 5 (a wash sale's disallowed loss; GnuCash lists it, "Spec unclear, unverified") is left out: the
wash-sale rule does not reach coins (above), and the two writers that do write format 5 (3 and 4) add it only for an
adjustment. Whether a given program accepts the file could not be tried here (no tax program in this session): the page
says to check each sale after the import, and the spreadsheet and printout are beside the button. (Gap item 51's review,
2026-11-16, round 2: the record's two "$" fields were questioned against source 2's list; source 4 was read to settle it.)

**The rules this file follows** (`txf.js`):
- **Header**: `V042`, `APlanner` (the app's name), `D` + today as MM/DD/YYYY, `^`.
- **One record per Form 8949 line** (`txfRecord`), in the list's order (by the day sold): `TD`, the code, `C1`, `L1`,
  `P` + what was sold ("0.1 BTC", units to eight places, as column (a) asks), `D` + the day bought (a bare `D` when the
  purchase has no date on file), `D` + the day sold, `$` + the cost, `$` + what was got, `^`. A line is never left out.
- **Days** (`txfDay`): MM/DD/YYYY, and only a day on the calendar (`realDay`): a day sold that is not one (2026-02-31, only
  in a hand-edited plan) is a bare `D` too, never "02/31/2026", and the green line says to type the right one.
- **A purchase with no date: a bare `D`** (gap item 51's review, 2026-11-16: no program could be tried here, so this is
  the reasoning). The format's own list of codes, as GnuCash keeps it (`txf-help.scm`), describes code N673 as "for use
  when only the date sold and net sales amount are available and the date acquired and cost basis information is not
  available and will be separately added in the tax software", and GnuCash writes that record with a bare `D` for the date
  acquired (`taxtxf.scm`, format 4, "Spec clear, unverified"): an empty date acquired, left for the program, is the format's
  own way. Leaving the line out instead would make the file "clean" but could leave a sale off the return, which is worse
  than a blank the program shows and asks for; so the line stays, with every other field (test "TXF (F2): ... one record
  per spreadsheet row"), and the green line says to type the date there. A program that refused the file would say so on
  import, and the spreadsheet and printout are beside the button.
- **Code by term**: short-term N712, long-term N714 (`TXF_CODES`): the Copy C codes, Form 8949 box C (Part I) and box F (Part
  II), "no form from a broker". Instructions for Form 8949 (2025), irs.gov/pub/irs-pdf/i8949.pdf, read 2026-11-16: "Do not use
  box C to report short-term digital asset transactions" ... "Use box I" (and L, not F, long-term) when no Form 1099-DA came;
  G, H, J or K from the 1099-DA's "Applicable checkbox" when one did. Version 042 (2011) has no code for boxes G to L, so the
  nearest is used (txf-generator's choice for coins too) and the page says to check the program files them as crypto. A
  person whose exchange sent a 1099-DA will usually bring that in instead: the page says not to bring in both.
- **Money**: `$`, dollars to the cent, two decimals, no thousands commas (`txfMoney`: "$9400.00"); the line's own figures,
  exactly as the spreadsheet has them. A cost not on file is $0.00, as the spreadsheet counts it, and the green line says so.
- **Text**: one line of plain ASCII (`txfText`): accents dropped, a line break or a control character as a space (a typed
  symbol could otherwise end the line), any other character outside ASCII dropped, spaces squeezed. A symbol with nothing
  left once that is done ("₿", or a name in another script) reads "coin" in the file (`txfWhat`: "P0.1 coin", never a bare
  "P0.1"), as a line with no symbol does; the screen and the spreadsheet keep the symbol as typed.
- **Lines** end CR LF; the file is ASCII; its name is `coin-sales-<year>.txf`; it is downloaded as
  `application/octet-stream`, so a phone saves it rather than showing it.
- **When it is offered** (`txfOffer`): with at least one line; filing separately, only when every line is one person's (a
  file goes into one return, and a sale in neither name is split between the two returns, which a line cannot say); else the
  sentence `TXF_SEPARATE` takes the button's place: split the sales between you from the spreadsheet or the printout. It does
  not promise a "Whose" column: the spreadsheet has one only when a line names its owner (a joint wallet's sales name
  none).

**Programs.** Known to read TXF: TurboTax (GnuCash's taxtxf.scm and txf-generator's README, above) and TaxCut (GnuCash), the
old name of H&R Block's tax program (that name change is general knowledge, not re-read this session). No list of which
current versions accept it could be read, so the page names none and says "look for import (it may say TXF)": a program
without it has no such menu, and the spreadsheet is beside the button.

**The words** (each tested): `TXF_FORM_SCREEN` (the list's `FORM_SCREEN` naming the file too, and nothing else changed in
it), `TXF_SCREEN` (one sentence, at most 30 words: the double count, the form placed in plain words before its number),
`TXF_SEPARATE`, `txfSaid` (the file, import it and the check for crypto, at most 22 words; + one or several lines with no
purchase date; + one or several with a day sold not on the calendar; + one or several with no cost on file), `txfFailed`
(the spreadsheet's own error words).

**Tests** (module.test.mjs, "TXF: ..."): the exact bytes of a two-sale file (a long-term gain, a short-term loss) against a
hand-written one; a sale of each term and its code; a loss written as it is; a purchase with no date (a bare `D`) and a cost
not on file ($0.00); one record per spreadsheet row, the no-date line kept (F2); a hand-edited plan: days not on the
calendar and a coin with no symbol (F1, F3); the text and the money; when it is offered; filing separately, the sentence true
with and without a "Whose" column (P1); the words, the one before the tap at most 30 words (P2); the page (three outlined
buttons, the tap's file read back from the Blob, its name, the green line right under the buttons (P5), nothing saved;
filing separately with two owners, the sentence and no button; no sale, no word of it); round 2: the sentence above the
buttons names the file only when it is offered (P1), "the yearly form" (P2), the shorter green line (P3), a symbol with
nothing the format carries reads "coin" (F4). **Invariance** ("invariance: the file for tax software ...", digests in `invariance.json`
written at a491122 before the change, `PRINT=1` writes them again on old code only): over every qa fixture plan, the fourteen
invented households, the phone households, the empty plan and five coin plans (two sales; a purchase with no date; a cost not
on file; filing separately; none sold), Crypto's `compute`, `coinSales`, the spreadsheet (`form8949Csv`), `coinOrders`, Tax
lots' `compute`, `yearSales` and its spreadsheet (`salesCsv`), and both pages as drawn for every plan with no coin sale: all
equal.

Builder's choices: the file is on Crypto only (Tax lots' typed sales keep no dates; its part links here when the year has a
coin sale, and says nothing of a file otherwise); one record per Form 8949 line, as the spreadsheet; no box choice on screen
(the format cannot say G to L, and a person with a 1099-DA brings that in instead); the header's program is "Planner"; no
fold inside the part for the checks (parts never nest, docs/OPTIONAL.md R11): the one sentence before the tap, the rest in
the green line after it.

Not done: the wash-sale field (coins are not reached); a file per spouse when filing separately; the digital-asset boxes,
which version 042 cannot write.

## Rewards from staking (gap list, next 60, item 45; `staking.js`)

**What a person sees.** Nothing new above the parts card. One more quiet row there (kind `item`), drawn when there is a coin
on the list or a reward recorded: **"Rewards from staking"**, status "$412 in 2026", "none in 2026" once a reward of another
year is on file, or "only if you stake" with none at all (most people never stake; the row says it is not one to fill in) (the
Federal estimate's year, as "Sales for your tax return"). Inside: the green line and Undo after a change (the row stays open, R17); one sentence
(three cases, below); with rewards this year, a muted line that the Federal estimate adds them, so they are not typed there
too; the year's rewards, newest first ("0.012 ETH · Oct 31, 2026" / "$41", "on your list at a cost of $41"), each with an
outlined "Remove this reward" that asks first (at most 12 drawn, then "and N earlier ones, counted in the total above."); the
form "Record a reward", open while the year has none, else behind an outlined "+ Record another reward" (R20): Coin (only
with two or more), "How many coins you received", "Received on" (today to start; no later), "What they were worth that day"
(its help: a month's rewards can go on one line, on the month's last day; more than $0, or it is refused at the box: "Type
what they were worth that day, more than $0."), and under it one quiet chip, "Estimate it at the price on your list", for a
person without the statement at hand: it fills the box with the coins typed x the coin's price on the list (`estimateWorth`,
to the cent; "Type how many coins you received first." when the coins box is empty), an estimate the person can change, and
saves nothing; its "Record the reward" is the row's one filled button. Last, a muted line with the rule.

**The rule and its sources** (read 2026-11-16):
- Rev. Rul. 2023-14, Internal Revenue Bulletin 2023-33 (https://www.irs.gov/irb/2023-33_IRB): "If a cash-method taxpayer
  stakes cryptocurrency native to a proof-of-stake blockchain and receives additional units of cryptocurrency as rewards when
  validation occurs, the fair market value of the validation rewards received is included in the taxpayer's gross income in
  the taxable year in which the taxpayer gains dominion and control over the validation rewards. The fair market value is
  determined as of the date and time the taxpayer gains dominion and control over the validation rewards." And "The same is
  true if a taxpayer stakes cryptocurrency ... through a cryptocurrency exchange". Dominion and control: the day the person
  can "sell, exchange, or otherwise dispose of" the units. The page asks for that day and that day's worth.
- Instructions for Form 1040 (2025), line 8v (https://www.irs.gov/instructions/i1040gi, page reviewed 07-May-2026): "If, in
  2025, you received ordinary income in connection with digital assets that isn't reported elsewhere on your return (for
  example, digital assets, such as income from forks, staking, or mining, which aren't wages ...), report this income on line
  8v." Schedule 1 (2025), line 8v "Digital assets received as ordinary income not reported elsewhere"
  (https://www.irs.gov/pub/irs-pdf/f1040s1.pdf).
- Frequently asked questions on digital asset transactions (https://www.irs.gov/individuals/international-taxpayers/frequently-asked-questions-on-digital-asset-transactions,
  page reviewed 29-Jun-2026): the cost of digital assets received as income is the fair market value included in income
  (FAQ 59: "your basis in the digital assets is the fair market value of the digital assets, measured in U.S. dollars, when
  received, provided that you include the fair market value of the digital assets in income"; FAQ 107 for a hard fork: "equal
  to the amount you included in income"); the holding period "begins the day after they are received" (FAQ 74, for an
  exchange; the page counts a reward's purchase the same way, through Tax lots' `lotsOf`); FAQ 110: "Individuals must report
  non-business ordinary income from digital assets on Form 1040 ... or Form 1040, Schedule 1". The FAQs do not name staking.

**Formulas.**
- The year's staking income = the sum of the worth typed for each reward whose day falls in the Federal estimate's year
  (`stakingIn(plan, year).total`, to the cent). A reward of another year is that year's income: it does not move this year's
  estimate (tested to the byte), and its coins still cost what they were worth.
- A reward recorded = one purchase on its coin: `{ id: the reward's id, date: day, shares: units, cost: value }` in date order;
  the coin's coins + units and its cost on file + value (a cost left blank stays blank). The crypto account's balance moves by
  what its coins on file moved (`walletFollows`): new balance = the coins' worth now (coins x their prices) + the part of the
  balance that was not listed coins before (the "rest of the balance", money typed on the account), so a reward of 0.01 ETH
  at a price of $3,200 adds $32 to a balance of $5,000 that holds 1.5 ETH ($4,800): $5,032, and net worth rises $32 (setting
  the balance to coins x price, as a coin sale does, gave $4,832; critic F1, tested). A balance within a cent of its coins
  becomes their worth, as of today, as before; one with more (or less) in it keeps its own day. A balance left blank (`blankBalance`:
  none typed, null or only spaces; $0 typed is a balance) stays blank, day and all, as a blank cost does: there is no typed figure
  to follow, and Net worth counts nothing for it before or after (recheck leftover y2 (d), 2026-11-16: it read $32 after the
  record, because a blank was read as $0 and the listed coins as minus their worth, and $0 after the removal). Removing does the
  same the other way. Selling later counts it like any purchase (oldest first, highest cost first, or picked), its gain = what it
  sells for - its worth that day.
- Taken back: the purchase, its coins and its cost come off and the reward leaves the list (the list itself goes when empty),
  so record then remove leaves the plan as it was, byte for byte (tested). Refused, in red, when a sale took some of its coins
  since (the purchase is no longer whole): "remove that sale first".
- The Federal estimate (`taxes/federal/known.js` `stakingStep`, after stock pay and before the business, so the IRA,
  student loan and 20% deduction limits and the minimum tax all see it): the year's total as other ordinary income; filing
  separately, each account's rewards on its owner's return, half on each for an account in neither name (as `taxInputs` puts
  income in neither name). Its line in the sources: "Crypto staking rewards", "Crypto page: 1 reward received in 2026, at
  what it was worth the day you got it (Schedule 1, line 8v)"; the walk's Income line names it ("crypto staking rewards
  $412"). With no reward this year the step hands back the very inputs it was given and no line: `known()` is byte-identical
  (digests over 50 plans).
- Worked example (tests): one adult filing single, pay $100,000 (taxable income $83,900, in the 22% bracket): a reward worth
  $412 adds $412 x 22% = $90.64 of federal tax, and nothing else moves.

**Builder's choices** (where the sources are silent):
- Not added to the 3.8% tax's investment income: the Instructions for Form 8960 (2025) (https://www.irs.gov/instructions/i8960,
  reviewed 30-Apr-2026) say only that "Income derived from transactions involving digital assets may be subject to" it, and
  nothing read says staking rewards are; under the 3.8% tax's line ($200,000 single, $250,000 joint) it changes nothing
  either way. A person above that line should ask a preparer.
- Staking run as a business (a validator as a trade) is self-employment income (FAQ 60 for services): not modelled here; the
  Self-employment page takes a business's income.
- A reward on a coin not on the list cannot be recorded (add the coin first); a coin in a brokerage account (a fund) is not
  one staking pays.
- The rewards of a month may share one line, dated the month's last day (the page says so): an exchange's statement gives a
  month's total; the purchase's holding period then starts a few days late at most.
- A worth of $0 is refused (critic P1): a box left at nothing would record coins at no cost and no income. Coins that truly
  had no market value that day are income of $0 and need no line.
- The estimate chip uses the coin's price on the list, not the day's own price (the page never looks prices up); for a reward
  received today it is that day's worth, for an older one it is only an estimate, and the box's help still points to the
  exchange's statement.
- The Federal estimate adds the rewards; a person who typed them under its Other income is asked, in the row, to take them out
  there (the plan cannot tell).

**Tests** (`module.test.mjs`, "staking"): the year's total and other years kept apart, the purchases in date order, the
cost per coin and the term; Crypto's `staking` only with a reward; every refusal's sentence ($0 included); the wallet's
balance keeping a part that is not listed coins (5,000 -> 5,032 -> 5,000; a balance below its coins; one equal to them);
the estimate (`estimateWorth`, `estimateText`) and its chip, which fills the box and saves nothing; record then remove gives the
plan back byte for byte, refused after a sale took part of it; the Federal estimate: +$90.64 on $412 at 22%, the line, the
walk, two rewards, a 2025 reward byte-identical for 2026 and counted when the estimate is set to 2025, filing separately on
the owner's return or half each; every sentence case and green line; the page: the row, its sentence and form, one filled
button, Record writes and says the new total in green, stays open, Undo, Remove asks first with Undo, a refused removal in
red; invariance against dca545e (Crypto's compute, `known()`, the page's words without the new row, 50 plans; the older
file-for-tax-software digests leave the new row out too).

## Ideas / not yet
- Prices fetched by the PC server from a public price feed (needs a network setting and a source).

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** Sales and losses are taxed on this year's return. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. Same helper as Tax-lot harvesting (`taxView()`), with and without the coins sold.

## A balance left blank stays blank (recheck leftover y2 (d), 2026-11-16)
A crypto account whose balance was left blank read $32 after a staking reward of 0.01 ETH (at $3,200) was recorded, and $0 after
it was removed or the record undone: `walletFollows` read the blank as $0 (`Number(null)` is 0), so the part "not listed coins" came
to minus the coins' worth. Rule now: `blankBalance(a.balance)` (null, missing, or a string of spaces) -> the reward still goes on
and off the coin and the income, and the account (balance and day) is left exactly as it was. A typed balance, $0 included, moves
as before (balance after = coins' worth after + (typed - coins' worth before)). Tests: null, "" and a missing balance through record,
remove, Undo of the record and Undo of the removal (core/ui/undo.js `changesOf`/`takeBack`, what the page's Undo runs), net worth
unchanged; $0 typed moving to $32 and back; and `y2-invariance.json` (written with `PRINT_Y2=1` on 398a01e): on every invented
household with a wallet added at $5,000, $4,800, $4,000 and $0 typed, recording and removing a reward write what they wrote at
398a01e. No new field.
