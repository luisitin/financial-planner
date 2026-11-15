# Allocation  (`investments/allocation`)

**Status:** usable (phase 7)
**Purpose:** Your mix by asset class across every account against the mix you aim for, and how far each class has drifted.

## Inputs
Holdings (`investments/holdings`), `investments.target` (`{ us_stocks, intl_stocks, bonds, cash, real_estate, other }` fractions, or null = built from `retirement.stocksNow`: 60/40 US/international, the rest bonds), `investments.band` (0.05).
Optional, written only by this page's row "Regions and sectors" (gap list, next 60, item 49): `holdings[].regions`
(`{ us, rich, emerging }`) and `holdings[].sectors` (`{ tech, health, money, shops, rest }`), fractions adding to 1.

## Outputs
`rows[]` per class: actual and target fractions, drift, dollars held, dollars to move, `flagged` and why; `flaggedCount`, `worst`, `stockShareActual` / `stockShareTarget`, `unknownValue`, `coverage` (holdings against the Net worth balances), `byAccountClass[]`, `notes`. `targetMix(plan)` is shared with the Rebalance, Risk and Backtest pages.
`compute(plan, { today, splits: true })` adds `splits`: `{ stockValue, typed, holdings: [{ id, symbol, name, account,
value, stockValue, table: { us, intl }, regions, sectors }], regions: { rows: [{ key, label, value, share }], typed, table
(symbols still on our table) }, sectors: { rows, typed, split (dollars split so far), notSplit, table } }`. Exported for
the view and the tests: `REGIONS`, `SECTORS`, `stockPart(mix)`, `splitOf(holding, kind)`, `regionMix(item)`,
`checkSplit(kind, typedPercents)`.

## Formulas
The 5/25 rule: a class is flagged when its drift exceeds the band (5 points) or a quarter of its own target. Balanced and target-date funds count by their split. Unclassified holdings are left out of the percentages and named in a note.

## No verdict against a mix nobody chose (2026-11-02)
Until the owner saves a target, the page used to measure the holdings against one built from the Projection's 70% stock
share and say "3 classes have drifted past the band ... trim $69,581" to a 36-year-old holding 92% stocks, mostly in a
2055 target-date fund (which holds about 90%). Now `verdict` is:
- `"pick"` with no target of your own: the hero states the mix ("You hold 92% stocks and 8% bonds and cash"), no class
  is "off target", and `choices` offer one tap: what I hold now, what my target-date fund holds (its year from the largest
  dated fund held; `targetDateMix` in holdings), the plan's mix (`retirement.stocksNow`), or type my own. A choice changes
  only how much is in stocks: inside stocks it keeps the US/international split held, inside the rest the bonds/cash
  split, so picking 90% while holding 92% is "close to the target", not a $48,000 trade between US and international.
  Saving one whose stock share differs from the Projection's by 5 points or more offers "Use 90% stocks on the Projection
  too" (`retirement.stocksNow`), so Projection and Allocation agree.
- `"partial"` when classified holdings are under `KNOWN_ENOUGH` (80%) of the money invested (the larger of the holdings
  and the Net worth balances of investment accounts): "Add what's in your other accounts first".
- `"drift"` / `"ok"` as before, against the owner's own target.

Review fixes (2026-11-02): `"partial"` is checked before `"pick"`, so with most of the money not typed in there is no "What
I hold now" button and no offer to change the Projection's stock share (one bond fund typed out of $177,000 used to offer
"What I hold now: 0% stocks" and then "Use 0% stocks on the Projection too"); with a target of your own, a partial page
shows what is held without add/trim amounts. The one-tap mixes give the stock part to US and international funds in the
split held (60/40 when neither is held), keep REITs and gold/other at no more than what is held, and put the rest in bonds
(in the held bonds/cash split only when bonds are held), so "the plan's mix" is never 70% REITs, 30% gold or 30% cash.
`restWords` names what is held outside stocks ("You hold 75% stocks and 25% gold and other"). "Type my own" starts blank
unless you chose a target, so saving only the band no longer saves the Projection's default as yours. The left-out and
coverage notes say dollars.

## Regions and sectors (gap list, next 60, item 49; 2026-11-15)
Our fund table (`holdings/data/funds.js`; "our rough guide" on screen, critic P6) only tells US stocks from
international ones. A person who wants more copies what the fund's own page on its company's website says (usually under
"Portfolio" or "Composition": the words on screen, not "fact sheet", critic P3), one fund at a time, in the row "Regions
and sectors" (a quiet part, shut on the first view; its status "not set yet" or "2 set by you").

**By region** (three boxes): United States; other rich countries (Europe, Japan, Canada, Australia and the like: the
"developed markets" of a fact sheet); emerging countries (China, India, Brazil and the like: its "emerging markets").
**By kind of business** (five boxes), the eleven sector names a fact sheet prints (the GICS sectors) put in five plain
groups:

| on screen | the fact sheet's sectors |
|---|---|
| Technology and communication | Information Technology, Communication Services |
| Health care | Health Care |
| Banks and insurance | Financials |
| Shops and brands | Consumer Discretionary, Consumer Staples |
| Everything else | Industrials, Energy, Materials, Utilities, Real Estate |

Formulas (plain arithmetic, no outside figure):
- A holding's stock part `S = mix.us_stocks + mix.intl_stocks` (its mix from holdings' `classify`: a target-date or
  balanced fund's stock part only; REITs are real estate here and have no region).
- A region split `{ us, rich, emerging }` re-splits that part: `us_stocks = S x us`, `intl_stocks = S x (rich +
  emerging)`; every other class of the holding is as it was. The class rows, the mix by account and the one-tap mixes
  then add the holdings the same way holdings' `compute()` does (`classesWith`, same loop and order). So a split equal
  to the table (FXAIX at 100% US) gives the same rows, byte for byte. Rebalance reads these rows, so its trades follow;
  it also picks the funds to sell by `regionMix` (a fund counts in a class when over half of it is there), and "Try a
  trade" takes a sale out by that mix, so the class Allocation says is over is the one sold from (critic M3: before,
  the sells used the table's mix, so a fund typed as international was never sold as international).
- The stocks by region: each holding's `value x S` goes to its three regions when it has a split; otherwise to "United
  States" and "Outside the US, not split" by the table. They add up to the stocks (`stockValue`).
- The stocks by kind of business: only over the holdings with a sector split (`split` dollars), each `value x S x share`;
  they add up to `split`. A sector split never changes a class row, a drift or a trade.
- A typed split (percent, a blank box is 0) must come to 100 within half a point (100.4 is accepted, then scaled so the
  saved fractions add to exactly 1; 60 + 30 + 10 is kept as typed, not divided by 0.9999999999999999). Otherwise the box
  says "These add up to 90%. Make them come to 100%, so all of the fund's stocks are counted."; all blank: "Type a share
  in at least one box, or tap Cancel."; a box with something that is not a number: "Type a number in each box, or leave
  it blank." (not "below 0": critic M5). A live line under the boxes says the sum as you type.
- A saved field that does not add to 100% (typed in a downloaded copy, say) is read as no split.

Saving: one fund's form opens under its row ("Split VFFVX by region" / "Change VFFVX's split", outlined; "it" for a
name over 10 letters), comes into view with the cursor in its first empty box (critic P4); chips "By region" / "By kind
of business"; "Save the split" (the form's one filled button), Cancel, and "Use our rough guide again" when that split
exists. By region, a fund with no split of its own opens with the United States share from our rough guide in its box
and one line over the boxes, one per case: "Our rough guide puts 60% of VFFVX's stocks in the United States and 40%
outside it: check the 60 against the fund's page, then split the 40 between the other two." / "... puts all of VTI's
stocks in the United States. Check it against the fund's page." / "... puts all of VTIAX's stocks outside the US: split
the 100 between other rich and emerging countries as the fund's page shows." (critic P3). The other two boxes stay
blank: how a fund's international part divides between rich and emerging countries is not in our table, and no
"typical world fund" preset is offered, because no source for one could be read this session (see the decisions). The save goes through `ui.undoable`: the green line names the new answer ("Saved for VFFVX. Your stocks are now
68% in the United States, 9% in other rich countries, 4% in emerging countries and 20% outside the US, not split yet.")
with Undo ("VFFVX's split is as it was."). The same split again writes nothing ("Nothing to save: VFFVX's split is as it
was."). A green line with no button (after Undo, "Nothing to save") is brought wholly into view, so the shell never
repeats it at the bottom of the screen (critic P5). Under the regions, one line names the funds still on the table
("VTIAX still splits only into US and international, from our rough guide.").

Decisions (the brief left them open):
- No fund's region or sector figures are bundled. They change every month and differ by share class, and the only
  table here has US and international; the person types them from their own fund's fact sheet, so the page needs no
  outside figure. www.msci.com and www.spglobal.com (where the sector and market lists are published) refused this
  session's network on 2026-11-15, so no page of theirs was read: only the sector names, as fact sheets print them, are
  used, and the five groups are this app's own.
- A region split counts on this page (and so on Rebalance, its sells and "Try a trade" too), never on Holdings, whose own US/international figure stays
  the table's: Holdings is another page's, and the field is written only from here.
- The opt spec's C17 had not landed on this page, so this change converts it as well (docs/OPTIONAL.md, R12, R21): the
  two hand-written folds are parts of one card, "Mix by account", "Regions and sectors" and "Your target mix" (both
  titles pinned in `qa/first-view-lib.mjs`). "Your target mix" is shut on every plan, the empty one too (the empty page
  went from 7 boxes and 2 filled buttons to none and one); inside it the four usual kinds and the band come first, real
  estate and other under "More details (optional)".

## Edge cases
No holdings: the target form still works. Accounts without holdings are not in the mix; a note gives the coverage.
No holding with stocks: no "Regions and sectors" row. A holding removed on Holdings takes its split with it.

## Tests
`tests/investments.test.mjs`, `module.test.mjs`: the split must come to 100 (90, 101, blanks, 100.4); a region split
re-splits only that fund's stocks, one equal to the table changes nothing, a sector split no figure; the regions and the
kinds of business add up to the stocks; every sentence, one per case; the page (three parts in order, shut; save writes
only that holding's field; Undo; the live sum; the same split writes nothing; Use our table again); invariance (nothing
typed: 81a5288's keys and bytes, Rebalance unchanged; a sector split on every fund moves no row).

## Ideas / not yet
- Size (large and small companies), a donut chart if the designer wants one. Regions and sectors: done above.
