# Rebalance  (`investments/rebalance`)

**Status:** usable (phase 7)
**Purpose:** The trades that bring your mix back to its target: new money first, then sells where they cost no tax and buys with the cash freed.

## Inputs
Allocation (rows, band), holdings (per-account values, gains, tax buckets), `investments.newMoney`.

## Outputs
`newMoneyBuys[]` (new money into the most underweight classes first, then by target weights), `afterNewMoney`, `newMoneyEnough`, `trades[]` (`sell` rows: account, symbol, class, amount, tax note; `buy` rows: account, class, amount), `taxableSells`, `gainRealised`, `leftover[]`, `notes`.

## Formulas
Sells for an overweight class come from holdings mostly of that class, in the order: pre-tax accounts, then Roth/HSA, then taxable; inside taxable, the smallest gain per dollar first (losses before gains). Buys of underweight classes use the cash freed in the same account (largest first), so nothing moves between accounts; what cannot be placed is listed as leftover.

## When it trades, and what it never sells (2026-11-02)
No trades while Allocation's `verdict` is `"pick"` (no target of your own) or `"partial"` (under 80% of the money
classified): `waiting` says which, and the page says what to do first instead of "Time to rebalance". A balanced or
target-date fund (`cls: "balanced"`) is never a sell candidate: it holds several classes and rebalances itself, and the
old rule (any holding more than half in a class) sold a whole 2055 fund as "US stocks". When a class is over only because
of such funds, `overOnlyBlended` lists it and a note says the fund keeps its own mix (send new money elsewhere, or pick a
target that matches the fund). `blended` lists those funds. The full list of trades shows only when a rebalance is due.

Review fixes (2026-11-02): `overOnlyBlended` and the "could not be placed" note only when a rebalance is due (picking the
fund's own mix used to say "No rebalance needed" next to "pick a target that matches the fund"). When a rebalance is due but
everything over sits inside balanced or target-date funds, so nothing can be sold, `onlyInFund` (`{ funds, short, taxFree }`)
replaces the empty trade list with "The fund sets this mix" and the three ways to move it: exchange part of the fund inside
the account (no tax in a 401(k), IRA or Roth), send new money to a fund of the short class, or keep the fund's mix.

## Try a trade (gap list, next 60, item 50; map O22)
One quiet row, **"Try a trade"** (`own`, a pinned title in `qa/first-view-lib.mjs`: a sale and a buy tried and never
saved), in one parts card after the trade cards and before "Rules of thumb". It is drawn whenever the page has holdings
with a value and the mix is not a guess: in the usual states and while no target is chosen (`waiting: "pick"`, where it
shows the mix only), never on `"partial"` or without holdings. The first view of the three plan households is unchanged
(they hold nothing; 35 words). Shut, the row says what it is for: "see the new mix" (review o3, P6); with a trade tried,
the sale ("$29,000 of VTI").

Inside: a form, "Sell" (every holding with a value, "VTI · Brokerage · $87,000"; under it the picked fund's name and kind,
"Vanguard Total Stock Market ETF: US stocks.", or "Acme Robotics: no kind set on Holdings, so it is not in your mix."
(`sellNote`; review o3, P6: the list read as bare tickers; the names stay out of the list itself so it is not cut at 390
px)), "How much" (money), "Sell all of it" (a tick beside its words on one line, the box first; review o3, P4: it sat
alone under its label), "Buy with it" (the same account's other holdings, "BND · Bonds", then something new of each class: "A US stocks
fund", "An international stocks fund", "A bond fund", "Keep it as cash", "A real estate fund (REITs)", "Gold,
commodities or crypto"), and "Try this trade". The money from a sale stays in its account, so the buy list is that
account's ("In Sam's 401(k): the money from a sale stays in its account."); choosing another holding to sell draws the
form again with its account's list and keeps what was typed. "Try this trade" is outlined: the page's one filled button
is its own ("Use this amount", or "Pick a mix on Allocation" while no mix is chosen; review o3, P1). Once tried, the
answer comes first, above the form, under the heading "What this trade does", and is brought into view once (`ui.reveal`;
review o3, P3: it sat under the form with the eye on the button): "If you sell $29,000 of VTI and buy BND with it:", one
row per class ("US stocks 58% → 55%", "target 50%" under it when a target of your own is set), one sentence on
the mix, when an unclassified holding is sold one more ("ACME is not in your mix (no kind is set for it on Holdings), so
selling it adds $90,000 to the mix."; review o3, M3: the shares of the other classes fell with no word why), one on the
gain or loss, and the lines under a gain worked from the purchases. "Clear" (outlined) starts over ("Cleared. Nothing was
saved."). Nothing is written: the trade is a module variable for the visit (`trial`), `compute()` is not changed, and
the module test shows `store.update` is never called by the part. An amount that shows as $0 (under 50 cents: the page's
money is whole dollars) is nothing asked (`nothingAsked`; review o3, M4: 0.001 read "If you sell $0 of BND").

**Formulas** (`trade.js`, pure):
- The new mix: each class's money v_c = Σ holding value × the holding's mix (Holdings' `mix`: a target-date fund split by
  its glide, e.g. the 2055 fund 29 years out 54% US, 36% international, 10% bonds). A sale of A from holding s into b:
  v'_c = v_c − A·mix_s,c + A·mix_b,c, each at least 0; share = v'_c / Σ v' over the six classes. An unclassified holding
  stays out of the mix, as Allocation counts it (selling one into bonds adds to the money counted).
- Off target: ½ Σ |share_c − target_c| over the six classes (a dollar too many in one class is a dollar too few in another,
  so each is counted once). Closer, further, or "about as far" when both round to the same whole percent; "the same" when
  the sold and bought holdings have the same mix.
- A row's figures: whole percents, or one decimal when the trade moves a class by less than whole percents show
  ("24.6% → 25.1%").
- The gain: inside a 401(k), IRA, Roth or HSA there is nothing to count ("The rules in this publication do not apply to
  investments held in individual retirement arrangements (IRAs), section 401(k) plans, and other qualified retirement
  plans", IRS Publication 550 (2025), irs.gov/publications/p550, read 2026-11-15). In a taxable account with purchases
  (lots) on file: shares = A / price (all of them for "All of it"), taken oldest first ("If you buy and sell securities at
  various times in varying quantities and you cannot adequately identify the shares you sell, the basis of the securities
  you sell is the basis of the securities you acquired first", Pub. 550, "Identification not possible"; for fund shares
  "the oldest shares you own are considered sold first", same read), by Tax lots' `orderLots(lots, "oldest")` and
  `takeShares`; each piece's term by Tax lots' `longOn` (long-term when held more than 1 year; "begin counting on the date
  after the day you acquired the property", Pub. 550 "Holding Period", same read); gain = price × shares − the cost of
  those shares; the wash-sale rule by Tax lots' `washPieces` (IRC 1091(a), sourced in Tax lots' README). The sentence is
  the page's own (`lotsSentence`; review o3, P5: Tax lots' "A gain of $6,897, all long-term, from one purchase." was
  unclear on its own): "Selling this makes a taxable gain of $10,000 (held over a year, so it is taxed at the lower
  long-term rate)." / "... (held a year or less, so it is taxed like your pay)." / "Selling this makes a loss of $4,000,
  which can lower your tax (held over a year: a long-term loss)." / both kinds: "Selling this makes a taxable gain of
  $17,000: +$20,000 on shares held over a year (taxed at the lower long-term rate) and −$3,000 on shares held a year or
  less." (a kind with no gain or loss is not named) / "No gain or loss on this sale.". Source for the words: IRS Topic no.
  409, Capital gains and losses (irs.gov/taxtopics/tc409, "Page Last Reviewed or Updated: 09-Nov-2026", read
  2026-11-15): "if you hold the asset for more than one year ... your capital gain or loss is long-term. If you hold it one
  year or less, your capital gain or loss is short-term"; "a lower tax rate may apply to the gain than the tax rate that
  applies to your ordinary income"; "Net short-term capital gains are subject to taxation as ordinary income at graduated
  tax rates" ("taxed like your pay"); "the amount of the excess loss that you can claim to lower your income" ("can lower
  your tax"; no limit figure is shown). The wash-sale line is Tax lots' `washLine`. Without purchases on file: A × (value
  − cost) / value, with no term ("Selling this makes a taxable gain of about $2,172, from what the whole holding cost;
  ..."). No cost on file, no price, cash, or a holding in no investment account: one sentence each, no figure. Purchases
  are read as records only: a null or a stray value among them (an imported or hand-edited file) is left out, and a list
  this page still cannot read falls back to the whole holding's cost (review o3, M2: a null purchase threw).
- Worked by hand in the module test on the investments fixture (Sam and Lee): money in the six classes $879,500; sell
  $29,000 of VTI into BND: US stocks 513,000 → 484,000 (58% → 55%), bonds 71,100 → 100,100 (8% → 11%); off target 20%
  → 17%; the 100 shares come from the 2021 purchase at $190 a share: a $10,000 long-term gain. All 300 shares: +$20,000
  long-term, −$3,000 short-term (the May 2026 purchase at $320), $17,000 in all.

Builder's choices: no tax figure on the trade (Tax lots works that out, from the Federal estimate, for a sale of part of a
fund); the buy list is limited to the sale's own account (a sale in a 401(k) cannot buy in a brokerage account); a cash
holding can be "sold" (spent on the buy); a balanced or target-date fund can be sold here (it is the person's own trade,
unlike the full rebalance, which never sells one), and its mix comes out class by class. The trade is kept for the visit
only, tied to the address drawn and the plan's `meta.createdAt`: the redraw after "Use this amount" keeps it; leaving and
coming back (a link, the menu, Back), a reload, or another plan loaded in the same tab starts with nothing (review o3,
M1: a trade outlived the visit and could be tried on another household's holding of the same id). Shares without a purchase date count as long-term, as on Tax lots, and the
part says so. A holding in the buy list names its class in short words so the drop-down is not cut at 390 px
("VFFVX · Stocks and bonds" for a target-date fund). A tap on "Clear" less than 800 ms after "Try this trade", on the
same spot, is swallowed by the shell's tap guard (core/taps.js), as for any control: at a person's pace it clears.

## Edge cases
When no class is flagged the page still shows where new money should go. Nothing is ever traded automatically; the plan is not changed by this page except for the new-money amount (Try a trade writes nothing).

## Tests
`tests/investments.test.mjs`, `module.test.mjs` (Try a trade: what can be sold and bought; the new mix worked by hand; all of it, a target-date fund bought, something new, an unclassified holding sold and its sentence; the same class, too much, nothing asked (and amounts that show as $0), a buy outside the account; no target; every gain sentence, the wash-sale rule and shares without a date; stray entries among the purchases; a row's figures; trying never changes the plan or compute(); the page: the row and its status, the boxes, the fund's name under Sell, the tick on one line, the outlined "Try this trade", another holding to sell, nothing typed, a trade tried with its answer above the form, the new-money save keeping the part as it was (S11), Clear, a redraw keeping the trade and a new visit or another plan dropping it, the states without the part).

## Ideas / not yet
- Whole-share rounding, minimum trade sizes, naming a specific fund to buy per class per account.
- Rebalanced against buy and hold over history (the other half of gap next-60 #50, O23): Backtest's page, not this one.
