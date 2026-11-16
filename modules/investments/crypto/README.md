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
- Writes, when a coin sale is recorded ("Sales for your tax return"): one `taxes.gains` row per purchase taken, each with an
  optional `coin` object (docs/DATA_MODEL.md), and the coins and their cost off the holding and its purchases (a holding
  sold out goes), the crypto account's balance following its coins; Undo and "Remove this sale" put them back.

## Outputs
`{ ready, items: [{ id, symbol, name, kind, account, bucket, shares, value, cost, gain, gainPct, price, priceAsOf, stale, lots }], total, cost, gain, volatile, share, level, netWorth, stress: { drop, loss, share }, tax: { shortGain, longGain, net, addShort, addLong, total, carry, disallowed, lossLimit, returns, why, year, otherYear, marginal, gainsRate }, harvest, harvestSaved, harvestCarry, harvestDisallowed, waitLong, staleCount }`.

`sales.js` (pure, called by the view beside `compute()`, which it does not change): `coinsOf`, `coinOrders`, `methodOf`
and the sentences, below.

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
  the printout. Coin sales dated in another year are counted and named (`elsewhereSentence`).
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

## Ideas / not yet
- Prices fetched by the PC server from a public price feed (needs a network setting and a source).
- Staking income (taxed as income when received).

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** Sales and losses are taxed on this year's return. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. Same helper as Tax-lot harvesting (`taxView()`), with and without the coins sold.
