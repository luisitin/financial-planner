# Annual review pack  (`reports/annual-review`)

**Status:** usable (phase 9)
**Purpose:** The year in one pack: net worth from start to end, the money in and out, where it went, the months you reviewed and their notes, the goals, and what next year holds.

## Inputs
`reviews` (Monthly review), `netWorthHistory`, `transactions` (through Income statement and Where the money goes), Goals, Plan health score, Life timeline, Next best action. Params: `today`, `year` (default `defaultYear`: last year in January and February, else this year so far). Writes nothing. `heavy: true` (the health score runs the stress tests).

## Outputs
`{ ready, missing, year, today, partial, reviews, netWorth, money, categories, goals, health, ahead }`.

## The pack
An opening (the net-worth change, money in and out with the share kept, months reviewed, the health score), net worth (from the last point saved before the year, or the year's first, to its last; a chart from three points), money in and out by month from the bank files and the year's spending by category (the top ten), the months reviewed with their notes, goals reached and open, and what next year holds (the timeline's moments dated next year, the next steps from Next best action and the health score's biggest gains). Prints through `../report-kit.js`.

## Net worth through the year (2026-11-02, round 4)
The year so far ends at today's balances (balance/net-worth `compute`, the Dashboard's figure), dated today and labelled
"Today": "from $257,000 on January 1, 2026 to $287,100 today: up $30,100". It used to end at the last saved total, which
for most people (who never press "Save today's totals") was the start point itself: "up $0". The start is the last total
saved before the year, else the year's first. A year that is over ends at its last saved total and says when that was if
it is not from December (`lastSaved`). With no saved total at all, the review gives today's figure and no change.

## A card whose file is missing (2026-11-02)
The money in and out comes from the Income statement and where it went from Where the money goes, so a card with no lines
of its own that money went to (Transactions > Ledger `missingCardFiles`) counts here as its payments, the line "Visa card,
details not imported yet", the same as on those pages. `money.cards` is that part of what went out; the opening says "$8,681
of what went out was paid to a card whose own file isn't in, so it counts as one line until that file is imported." The
sample family's year: out $26,132 (was $17,450), 41% kept (was 61%).
Review (2026-11-02): `money.cardMonths: [{ cardId, name, total, months }]` (from the Income statement's `rows[].cardsBy`), so
the opening names the card and the months: after the Visa's file is in from August, "$640 of what went out in July went to
the Visa card; its July file isn't in, so it counts as one line until you import it." (several months: "from July to October
... its files for those months aren't in").

## Re-check (2026-11-02)
- `cardMonths[].first`: the card's first line ever (null with none). When every month a card stood in for is on or before
  that line's month, the page says the payments went to it "before its file starts on 8/20; it counts as one line a month
  until you import the days before" (it said "its files for those months aren't in" of an August whose file is in from the
  20th). Under the re-check's rule 2 a payment stands in only for a month the card has no lines in, or before its first line,
  so a September whose file misses 9/11 to 9/19 no longer counts its autopay on top: the Visa file 8/1 to 10/10 gives a year
  of $20,220.47 out with only July's $640.22 standing in (it was $22,830.77 with $3,250.52).
- `money.gaps: [{ why, yms }]`: the Income statement's `missing` reasons for the year's months, grouped. The page adds "Chase
  checking has no lines from 7/31 to 8/2, so July and August leave out what happened then." (up to two).
- Re-check 4 (2026-11-02): `money.gaps[].unsure` marks a month left out because a payment went to one of two cards and
  neither file is in; the page says the sentence ("$2,610 went to one of your Chase cards in October; bring in the card files
  to see what it bought"). Such a payment is in no card's total: Freedom and Sapphire at Chase on plan3 give $17,450.25 out
  (the lines alone), not $26,131.54. Money out and kept are the Income statement's and the Ledger's (plan3: $44,234 in,
  $26,131.54 out, $18,102.46 kept on all three; Ledger test "pages 3"). A Discover savings transfer is never the Discover
  card's: $26,131.54 out, $8,681.29 to the card.

## Tests
`module.test.mjs`: the default year; the net-worth start from the point before the year, the year's reviews, next year's moments; the bank files' months and category shares. The sample family's Visa: `money.cards` = $640.22 + $2,450.22 + $2,980.55 + $2,610.30, the same in where it went, which adds up to what went out (2026-11-02). Re-check: finding 2 ($20,220.47 with $640.22 standing in; the file with a gap, $20,580.47), the year's gaps on plan3 and with a Visa file from 8/20 (July and August, $3,090.44, first line 8/20). Re-check 4: money 2 (a Discover savings transfer: $26,131.54, $8,681.29) and money 4 ($17,450.25, the four months' sentences).

## Ideas / not yet
- Last year's pack frozen and kept (so a later edit does not rewrite history); the year's tax return beside the estimate; investment returns for the year (Performance).

## Review 2026-11-06
- **Every report finishes (fix round 6).** The page draws its compute's answer through `settleReport` (report-kit): a
  compute that failed (the shell's `{ error }`), a drawing that throws or a remote call that rejects shows "The year in review
  could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates
  and the ages on the People page, then reload the page." in place of the loading line. A scan of all 1,406 qa households
  and the fixtures found no other report that hung; for the four "older than 120" households (born 1900) this page's
  compute fails inside the retirement projection, and the page read "The review needs .". Test: reports/tax "every report finishes
  when its figures cannot be worked out (settleReport)".
