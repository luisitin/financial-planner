# Tax lots and harvesting  (`investments/tax-lots`)

**Status:** usable (phase 7)
**Purpose:** The gain or loss on each lot you hold, the losses worth harvesting in taxable accounts (what selling them saves this year, what carries to next year, what a recent purchase cancels), and the order to sell in when you need cash.

## Inputs
`holdings[].lots` (`[{ id, date, shares, cost }]`, edited here), holdings' prices and cost, the Federal estimate (`taxInputs`, `federalTax`) for the year's tax with and without the harvest and its two rates.

## Outputs
`holdings[]` with `lots[]` (value, gain, term short/long, days to long-term, `longOn`, an "unassigned" lot for shares no lot covers), `harvest[]` (taxable lots with a loss: `loss`, `allowed`, `disallowed`, `washedBy[]`, and `taxSaved`, the loss at its rate, which only orders the list), `harvestTotal`, `disallowedTotal`, `allowedTotal`, `taxSavedTotal`, `carry` and `carryAdded` (`{ short, long, total }`), `capLimit`, `shortLosses`, `longLosses`, `marginal`, `gainsRate`, `sellFirst[]` (taxable lots, lowest gain per share first), `notes`.

## Formulas
- **Term** (`longOn`): the holding period starts the day after the buy and the day sold counts (IRS Publication 550 (2025), "Holding Period": "begin counting on the date after the day you acquired the property. The day you disposed of the property is part of your holding period"; read 2026-10-31), and a lot is long-term when held "more than 1 year" (IRC 1222(3)). So the first long-term day is one year after the first day of the holding period. A buy on February 29, 2024 starts March 1 and is long-term on March 1, 2025. A buy on February 28, 2023 also starts March 1, and its year runs to February 29, 2024, so it is long-term on March 1, 2024, not February 29. Rev. Rul. 66-7 gives the same for a buy on a month's last day: long-term on the first day of the 13th month. Counting days instead ("more than 365") is a day early whenever a February 29 falls in between. Lots without a date count as long-term.
- **Unassigned lot**: shares no typed lot covers form one long-term lot whose cost is what the typed lots leave of the holding's cost (at least 0). That is not the average cost when the typed lots cost more or less than the average.
- **Rates** (shown, and used to order the list): the federal tax on $1,000 more of short-term gain (`marginal`) or long-term gain (`gainsRate`), with the 3.8% tax on investment income where it applies (IRC 1411); a true 0% stays 0%. Each federal total is in cents, so a rate is a multiple of 0.00001.
- **Wash sales** (`washSales`): every candidate is taken as sold today. A loss is not allowed on the shares matched by the same security bought from 30 days before the sale (IRC 1091(a): "within a period beginning 30 days before the date of such sale ... the taxpayer has acquired ... substantially identical stock or securities, then no deduction shall be allowed"). Replacement shares are lots of the same ticker, in any of the household's accounts, an IRA too ("Acquire substantially identical stock for your individual retirement arrangement (IRA) or Roth IRA", Pub. 550), dated from today - 30 days to today, not sold in the same harvest, and with a date. The sold lots of a ticker take them in order of their own purchase, undated lots first (26 CFR 1.1091-1(b)). Replacement shares are used in order of purchase, share for share, each share once (1.1091-1(c)-(e)). Disallowed = the lot's loss per share x matched shares. In a taxable account the disallowed loss is added to the replacement's cost (1091(d)). In an IRA it is lost for good (Rev. Rul. 2008-5: "A's basis in the individual retirement account or Roth IRA is not increased"). Conventions, from the answer key (W1-W4): the same ticker is "substantially identical" and another ticker is not, though the law looks at "all the facts and circumstances"; a lot sold in the same harvest is never a replacement; an undated lot is never a replacement. A purchase in the 30 days after the sale also counts; the page cannot know about it yet, so the note says so.
- **What the harvest saves this year** (`taxSavedTotal`): the Federal estimate's total tax now, less its total with every candidate sold today, each candidate's allowed loss added to the year's sales as short- or long-term by its term. The engine nets them the way Schedule D does (short against short, long against long, then across) and lets a net loss take at most $3,000 off other income, $1,500 filing separately (IRC 1211(b): losses "shall be allowed only to the extent of the gains from such sales or exchanges, plus ... the lower of (1) $3,000 ($1,500 in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains"). A loss cancelling a long-term gain saves that gain's rate, whatever the lot's own term. Until 2026-10-31 the page priced each loss at its rate instead, which could show hundreds of thousands of dollars of tax saved where the law saves nothing this year.
- **The tax year** (`todaysReturn`, `year`, `otherYear`): a sale today falls in today's tax year. When the Federal estimate is set to another year (last year's return, say), the page works today's year without the sales typed on Capital gains, which belong to the set year, and says so in a note; the typed pay and dividends stay as the best guess at today's year.
- **Whose return**: filing separately, each lot's allowed loss goes on the return of its account's owner (`personId`; IRS Pub. 501: each spouse reports their own income), one sale row per term and owner; a joint account's is split in half, each half with its own $1,500 limit. The page says the limit is $1,500 on each return ($3,000 between them; a loss in one spouse's account only uses that spouse's), `returns` = 2 (until a review on 2026-10-31 it said "up to $1,500" for the household).
- **Carryover** (`carryover`, `carry`): the loss not used this year carries to next year, keeping its term (IRC 1212(b)(1)), worked by the Capital Loss Carryover Worksheet (Pub. 550 Worksheet 4-1). Line 1 is taxable income, negative when it would be. Line 2 is the loss allowed this year. Line 3 = line 1 + line 2, at least 0 (1212(b)(2)'s "adjusted taxable income"). Line 4 = the smaller of lines 2 and 3. The short-term carryover is the short-term loss less (line 4 + the long-term gain). The long-term carryover is the long-term loss less (the short-term gain + what line 4 has left after the short-term loss). Each is at least 0. With taxable income below zero, more than the loss over $3,000 carries. Filing separately, each spouse's return is worked on its own and the two are added. `carryAdded` is the carryover with the harvest less the one without it (the year's own sales can carry a loss too). The hero shows `carryAdded`.
- **Sell-first order**: every lot in a taxable account, smallest gain per share first (the biggest losses at the top), the first eight; ties keep the order typed. Choosing the lot is "specific identification" (26 CFR 1.1012-1(c)). No source decides which lot to sell for cash; this order raises the cash with the least gain per share.

## Edge cases
Lots in retirement accounts are shown and are never taxed on a sale, but an IRA purchase can wash a loss (above). The page assumes every candidate is sold together today. A spouse's purchase in their own account counts for the wash-sale rule (Pub. 550) and is caught when that holding is on the plan.

## Tests
`tests/investments.test.mjs`, `module.test.mjs` (the holding period across leap years and February 28, the rates with the 3.8% and at 0%, the tax saved and carryover of the answer key's worked examples, the carryover worksheet, wash sales in an IRA, outside the window and with an undated lot, the tax year when the Federal estimate is set to last year, filing separately by owner). `tests/golden-tax-lots.test.mjs`: an independent answer key (`tools/golden_tax_lots`, 2,000 households and 3,000 lots for 2025 and 2026 worked from IRC 1222, 1211(b), 1212(b), 1091 and 1411, 26 CFR 1.1091-1 and 1.1411-4, Pub. 550, Rev. Ruls. 66-7 and 2008-5 and the Rev. Procs., never from this code; `tests/golden/tax-lots/RULES.md`). Every row agrees since 2026-10-31. The key found three causes, all fixed: the February 28 holding period, the tax a harvest saves this year (netting, the $3,000 limit, the carryover), and wash sales against purchases on file.

## Ideas / not yet
- Import lots from the brokerage's cost-basis export; carry harvested losses into next year's Capital gains page.
- Mark a sale on the lots: "I sold these" from "Compare ways to sell part of a fund" would shrink the lots and the holding and add the
  year's sale rows with the day bought and sold (Form 8949's columns b and c). It needs the real sale price and day (not the
  price on file) and says what happens to the cash in the account (Holdings compares the funds with the account's balance).
- Order "sell first" by the tax per dollar raised (short-term gains at the pay rate) instead of the gain per share.

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** "What selling the losers saves", the rate on a short-term and a long-term dollar and the carry-over all depend on where this year's income sits. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. The return with the sales (`harvest-*` rows added to `taxes.gains`) is worked the same way, so the saving is the difference of two Federal-estimate returns (retirement withdrawals and Social Security taxed, the business at its profit, the rentals after costs). `payRate` is the Federal estimate's headline next dollar, so the two pages say one figure: the cost of the next dollar of pay (known()'s `nextDollar`, whole child care credit steps included), or, with a business and no pay, what the next dollar the business makes costs in income and self-employment tax (`fullSteps().se.nextDollar`, the Federal estimate's "On the next dollar ... of business profit"; `payIs: "business"`, freelancer: 23 cents, not 9.6). `shortRate` is what a short-term gain costs: it raises income like that dollar of pay (no self-employment tax: it is not business profit), so `nextDollar`, plus the 3.8% when it is investment income past the line (IRC 1411(a)(1), 1411(c)(1)(A)(iii)); equity household 24% + 3.8% = 27.8%, the family in the child care credit's phase-down 22.75%, the same as its pay (a bare 1,000 probe said 22%: Verify b1f). `marginal` (the 1,000 probe) still orders the lots.
- The first screen splits the losses into what counts this year and what carries to later years (`carryAdded`), so it never says more counts this year than the $3,000 limit allows.
- `costAfterLot(holding, lot)`: one cost for a holding (claude-r N6). After a lot is added, when the lots hold every share the holding's "What you paid in all" is the lots' total cost; otherwise it is the larger of the typed total and the lots' cost, so a lot carved out of a total typed on Holdings leaves it alone and a lot for shares that had no cost raises it. The confirmation names the new total.
- `shareText(n)`: share counts as people write them, at most six decimals (0.1 + 0.2 reads "0.3", claude-r N7).
- A lot that changed "What you paid in all" when added keeps `costWas` and `costSet`; removing it puts the old total back while nothing else has changed it, and both confirmations name the figures ("is now $90 (was $9,000)", "is back to $9,000").
- `costFromLots(holding)`: when two or more lots hold every share, the holding's cost is their total; Holdings then refuses any other "What you paid in all" at the box (judged on the shares as typed; the lots' total is always accepted) and says to remove a purchase on Tax lots and add it again with the right cost. One lot follows a change on Holdings instead; shares outside the lots keep the typed rest (claude-r N9).

## Simple first (2026-11-13, opt C6)
"How this is worked out" (the losses in all, short and long term, the rates) is a part drawn by `core/ui/more.js` (`part`,
kind `how`, a folded card of its own; docs/OPTIONAL.md), title and words unchanged, so the first view is the same. Settings >
How much to show > "Show how answers are worked out" opens it on this phone, and a person's own tap on it is kept for 90
days. Adding or removing a lot moves no part (S11 in `module.test.mjs`).

## Which shares to sell first: "Compare ways to sell part of a fund" (2026-11-14, gap list item 54; `sell.js`)
**What a person sees.** The first view keeps today's answer (the harvest, "If you need cash, sell these first", the lots).
"How this is worked out" now sits in one quiet card after "If you need cash", with a second row, **"Compare ways to sell
part of a fund"** (named apart from the card "If you need cash, sell these first", which does another job; status "2 ways",
"set by you · 2 ways" once worked out, "3 ways" once purchases are checked). It is shown only when a fund in a taxable account,
with a price above 0 and shares (cash funds left out), has two or more purchases (`hasChoice`: its lots with shares, the
shares no lot covers counting as one): with one purchase every way sells the same shares, and the page's note already
carries "Add the lots for ...". Opened: one line on what it does, a form (Fund when there are two or more, starting on the
first that has a choice; Sell "a number of shares" or "a dollar amount", Amount; the fund's purchases to check folded under
"Pick the purchases yourself (optional)"), and "Work it out" (the form's own Save). The answer comes under it: the green line
names it (R7), then one row per way ("Oldest first", "Highest cost first", and "The ones you pick" only once purchases are
checked: before that it would be an instruction, not an answer) with what the sale does to this year's federal tax against
not selling ("$1,500 of tax", "saves $450 of tax", "no tax") and its gain under it, a line when a recent purchase cancels
part of a loss, the money it brings in at the price on file, and two notes: tell the broker which shares before the sale,
and a mutual fund may be on average cost. A fund of one purchase can still be chosen beside one with two; its two rows are
the same and a line says to add its purchases to compare them. The question is saved in `whatIfs.taxLots` (a what-if, never counted in the plan); choosing another fund
redraws the form with what was typed, and saves nothing.

Example (Sam and Lee, `qa/fixtures/investments-plan.mjs`, married filing jointly, 2026): VTI at $290, 200 shares bought
March 10, 2021 for $38,000 and 100 bought May 2, 2026 for $32,000; the year already holds $8,000 of long-term gain and a
$5,000 short-term loss. Selling 100 shares: oldest first is a $10,000 long-term gain, "$1,500 of tax" (15%); highest cost
first is a $3,000 short-term loss, "saves $450 of tax" (it cancels $3,000 of the year's long-term gain taxed at 15%); "Selling the
shares that cost the most first costs least: about $1,950 less federal tax than the oldest first."

**Formulas and sources** (IRS Publication 550 (2025), irs.gov/publications/p550, read 2026-11-14):
- **Oldest first** (`orderLots(lots, "oldest")`): "If you buy and sell securities at various times in varying quantities and
  you cannot adequately identify the shares you sell, the basis of the securities you sell is the basis of the securities
  you acquired first." (Pub. 550, "Identification not possible"; for funds, "FIFO": "the oldest shares you own are considered
  sold first"). The test works Pub. 550's own example: 50 left of 100 bought in 2010 at $10, 200 in January 2011 at $11, 100
  in December 2013 at $9; 130 sold: 50 x $10 + 80 x $11 = $1,380. A lot with no date, and the shares no lot covers, count
  as bought first (the page already counts them long-term); the same date keeps the order typed.
- **Highest cost first** (`"cost"`): the most paid per share first, the same cost per share oldest first. It gives the
  smallest gain (or the biggest loss) on the shares sold; it is usually, not always, the least tax (a short-term loss can
  save less than a long-term one), which is why the page works each way out and says which costs least.
- **The ones you pick** (`"picked"`): the checked purchases, oldest first among them; too few shares in them is said
  ("The ones you checked hold 100 shares: check more, or sell fewer.").
- **Telling the broker** (the note): "Tell your broker or other agent the particular stock to be sold or transferred at the
  time of the sale or transfer, and Receive a written confirmation of this from your broker or other agent within a
  reasonable time." (Pub. 550, "Adequate identification", "Broker holds stock"; the same for fund shares under "Specific
  share identification").
- **Average cost** (the note): "Average basis is determined by averaging the basis of all shares of identical stock in an
  account regardless of how long you have held the stock", for mutual fund shares and some reinvestment plans; for the
  holding period "the shares disposed of are considered to be those acquired first" (Pub. 550, "Average Basis"). The page
  does not work average cost out; it says the broker's cost-basis page shows how each fund is set.
- **Each piece** (`takeShares`): shares taken from the lots in that order; cost = the lot's cost per share x shares (the whole
  lot's cost when all of it goes), proceeds = the price on file x shares, gain = proceeds - cost (Pub. 550, "Gain": "If the
  amount you realize from a sale or trade is more than the adjusted basis ..., the difference is a gain"); cents. The term is
  the lot's (`longOn`, above). Fees are not counted; the price is the one on Holdings.
- **The tax** (`saleTax`): the Federal estimate's own return for the tax year a sale today falls in (`todaysReturn`, with that
  year's other sales), with the sale's rows added (one per term, the allowed loss only, on the account owner's return when
  filing separately), less without: `taxView` worked twice, so the netting with the year's sales, the 0/15/20% bands, the
  3.8% and the $3,000 limit are the engine's; no rate table here. `carry` is what the sale adds to next year's carryover
  (`lossCarryover`). Federal only; the page says state tax is not counted.
- **Wash sales** (`washPieces`): this page's `washSales` (above) on the pieces sold at a loss: the same fund bought in the 30
  days before today, in any account (an IRA too), not sold in this sale, cancels the loss on as many shares; in a taxable
  account it is put off and added to those shares' cost, in a retirement account it is lost for good (Rev. Rul. 2008-5). The
  disallowed part is left out of the loss the tax is worked on. Convention (no source read says it either way): the rest of a
  purchase that is partly sold is not counted as a replacement for the part sold.
- **Which costs least** (`least`, `saving`): the smallest tax change; a tie (under 50 cents) goes to the oldest first, then the
  highest cost (the default needs no word to the broker). `saving` = the oldest first's tax - the least.

**Sentences** (R5, one per case, each in `module.test.mjs`): `leastSentence` (the same tax, adds / takes off / none; highest
cost least; picked least; oldest least by a margin; oldest least in a tie; too many shares), `orderValue`, `orderLine` (no gain,
one term, both terms, a carryover, nothing checked, too few checked), `washLine` (a taxable purchase, a retirement account's,
both).

**Not built**: average cost worked out as a fourth way; a lot sold today marked as sold (Ideas, above).

**Tests**: "which shares: ...", "S11: Compare ways to sell part of a fund ..." and "Compare ways to sell part of a fund: only
offered when a fund has two or more purchases ..." in `module.test.mjs`; the invariance test (a saved
`whatIfs.taxLots` changes no page's figures, over the fixtures and every archetype; nothing outside this folder reads it).

## Sales for your tax return (2026-11-14, gap list item 7; `sell.js`)
**What a person sees.** The third row of the same card, **"Sales for your tax return"** (status "2 in 2026", "none in 2026";
shown when the page has a taxable fund or the year has a sale; with no holdings at all, under the hero when a sale is typed).
Opened, with sales: the year's short-term and long-term totals (two tiles, before netting), one sentence on what the Federal
estimate counts after netting, the sales as rows (what · gain or loss; "sold for $30,000, cost $22,000 · long-term"), the
line on dates, then two outlined buttons, "Save as a spreadsheet (CSV)" (green line: "sales-2026.csv is downloading. Open it
with Excel, Numbers or Google Sheets, or send it to your tax preparer.") and "Print this list" (the report kit's sheet,
drawn on the tap and shown only by the printer: title, the totals and the sentence, a table, the note on dates and Form
8949's two parts), and "Add or change a sale on Capital gains ›". With no sale: what to do first and "Add a sale on Capital
gains ›". Nothing here changes the plan.

**Where the sales come from.** The plan records a sale only as a row of `taxes.gains` (typed on Capital gains, or added by the
Document reader from a 1099-B): name, proceeds, cost, short or long, whose. Lots are never marked sold (the brief's "lots
marked sold" does not exist in the plan), and the rows carry no dates. So the year's sales are those rows, read through
Capital gains' own compute (`yearSales`), and the dates are left to the broker's Form 1099-B. Marking a lot sold from this
page (shrinking the lot and the holding, with the real sale price and day, and the cash it leaves in the account) is a larger
change that touches Holdings' balance check; it is not built (Ideas).

**Formulas and sources**:
- **Totals** (`yearSales`): `shortTotal`, `longTotal` = the sum of each kind's gains (proceeds - cost) before netting; `netShort`,
  `netLong`, `netLoss`, `lossAllowed` = Schedule D's netting and the $3,000 limit ($1,500 filing separately; IRC 1211(b)) as
  `netGains` in `taxes/federal/compute.js` does it; `carry` = the Capital Loss Carryover Worksheet (Pub. 550 Worksheet 4-1,
  `lossCarryover`). All of them from Capital gains' compute, so this list, Capital gains and the Federal estimate (its gains
  and the "Short-term gains", "Long-term gains" and "Capital loss allowed" lines of its sources) say the same figures; a test
  checks that over the fixtures and all fourteen archetypes, as they are and with two sales added.
- **The year** (`salesYear`): the Federal estimate's (`taxes.year`), else today's, as `taxInputs` reads it.
- **The file** (`salesCsv`, through `core/csv.js` `toCsv`): one row per sale with Form 8949's columns that the plan holds, in
  the form's order and in plain words, without its letters: "What was sold" (a), "Sold for" (d), "Cost" (e), "Gain or loss"
  (h), then "Short or long term" (and "Whose" filing separately when a sale names its owner; "both" for one in neither name).
  Money as plain numbers with two decimals. No date columns: the plan does not keep the dates bought and sold (b and c), and
  two empty columns made the file look unfinished to a preparer; the list on screen and the printout say the dates are on
  the broker's Form 1099-B. A name that a spreadsheet would run as a formula (it starts with = + - @, a tab or a return, as a
  typed or imported name could) is written with an apostrophe in front, so Excel and Google Sheets show it as text
  (`csvText`; the usual guard against "CSV injection", as OWASP's page of that name describes it: a convention, not re-read
  for this change); the money columns are numbers and are not touched. Source: Instructions for Form 8949
  (2025), irs.gov/instructions/i8949, read 2026-11-14: "Column (a)—Description of Property ... For stock, include the number of
  shares", "Column (b)—Date Acquired", "Column (c)—Date Sold or Disposed Of", "Column (d)—Proceeds (Sales Price)", "Column
  (e)—Cost or Other Basis", "Column (h)—Gain (or Loss)"; "Report short-term gains and losses on Part I. Report long-term gains
  and losses on Part II."; "box 1b on Form 1099-B ... may help you determine when you acquired the property", "box 1c on Form
  1099-B ... when you sold".
- **The printout**: `reportFrame`, `rtable` and `printSheet` from `modules/reports/report-kit.js` (imported, not changed), the
  sheet in an element scoped by this page's own class `.tl-print` (hidden on the screen, shown in print), as Debt payoff does;
  no global CSS. Each sale's gain or loss is signed as on the screen ("+$8,000", "−$5,000"); the two totals as on the tiles.

**Sentences** (R5, `salesSentence`, one per case, each tested): none yet (the empty text); break even; short- and long-term gain;
short-term only ("taxed like pay"); long-term only ("at the lower rates for gains"); a net loss all used this year; a net loss
with a carryover ("$3,000 comes off your other income and $7,000 carries to next year").

**Tests**: "this year's sales: ..." and "Sales for your tax return: ..." in `module.test.mjs`.

## A blank entry in the sales list (smart guesses C11, 2026-11-15)
The row's status counts the year's sales with taxes/federal `salesOf`, the list the figures are worked from, so a blank entry
(a null or an empty object in a hand-edited file) no longer reads "2 in 2026" for one sale. Test: taxes/federal module.test.mjs
"C11 gains" (the page as without the blank, the count included).
