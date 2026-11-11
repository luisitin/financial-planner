# Where the money goes  (`cashflow/spending`)

**Status:** usable (phase 3)
**Purpose:** Spending by category and by payee for a month, against the month before.

## Inputs
Plan sections read (`needs`): `transactions`, `categories`. Writes nothing. `compute(plan, { month, today })`; `month` defaults to the latest month with spending.

## Outputs
`{ month, label, months[], total, count, previous ({ ym, label, total } | null), change, byCategory[] ({ category, label, icon, total, share, count, previous, change }), topPayees[], biggest[], daily[], hasData }`.

## Formulas
- Spending = transactions in the month whose category kind is expense (uncategorised money out counts too); transfers excluded; amounts as absolute values.
- Share = category total / month total. Change = (this month - last month) / last month per category and overall; null when last month had nothing.
- Top payees by total; biggest five single lines; `daily` totals per day of month (for a future chart).
- Months the bank files only partly cover (2026-11-01). Most people download "the last 90 days" partway through a month, and the page opened on that month as if it were whole: a file cut on Oct 12 said "34% less than last month", "Groceries down 80%" and "$76 a day over the whole month", false good news. Now (coverage from `transactions/ledger` `monthCover`):
  - The page opens on the latest month with spending that the files cover from start to end (at most 3 days missing at either end, and the month over); a partly covered month can still be picked, and the list says "Oct 2026 (to the 9th)".
  - Change: whole months are compared only when the files cover both. Otherwise both months are compared on the days of the month both cover (`sameDays` = from the later first day to the earlier last day, by day number): Oct 1 to 9 against Sep 1 to 9. When they share no days (`noOverlap`) there is no change. Category changes use the same days ("down 50% on the same days of Sep", "none on the same days of Sep").
  - A day on average = month total / days covered when partly covered ("over the 9 days in your bank file"), else / days in the month.
  - One line under the month says what the file covers and what it is compared with, or "So far this month" for the month in progress.

## A card whose file is missing, and days missing between files (2026-11-02)
The sample family's Visa had no lines and its autopays from checking were filed as transfers, so about $2,700 a month of
purchases was missing from this page ("$4,843 spent in October"). Now (from `transactions/ledger`):
- Spending also holds `unimportedCardLines(plan, month)`: one stand-in line per payment to a card with no lines of its own
  that month (`missingCardFiles`), money out, grouped per card as one entry `{ category: "card-unimported", cardId,
  unimported: true, label: "Visa card, details not imported yet", icon: 💳 }`. Total, shares, the change against last month
  (last month gets its own stand-ins) and the daily totals count it; `count`, the payees and the biggest lines are real bank
  lines only. October: $4,843.32 + $2,610.30 = $7,453.62. Once the card has a line in the month the entry is gone and its own
  purchases count instead (the payment stays a transfer).
- `cards` (the month's `missingCardFiles`) gives the card above the list: "$2,610 went to Visa card from checking in October.
  Its own file isn't in, so that money counts below as one line instead of what you bought." with "Bring in the Visa file"
  (Import, the card picked). Tapping the card's line opens the same.
- `holes` (`monthHoles`): days an account's files miss inside the month. The month list says "Aug 2026 (some days missing)",
  the page names the hole ("Chase checking has no lines from 7/31 to 8/2: ...") with a button to import that account, and a
  month with a hole is never the one opened by default.
- Review (2026-11-02): the stand-ins come from `cardStandIns`, so a payment stands in only on a day the card's own file does
  not cover (two cards at one bank: the payment matched to Freedom's own line is a transfer, only the Sapphire's $800 stands
  in, $6,263.32; money back from the card comes off; money to a 529 or an HSA is never a card's). A card file that starts late
  (a Visa file from 8/20) keeps the 8/14 payment as August's stand-in and adds the 12 days of its own purchases: $3,264.16 +
  $360 + $2,450.22 = $6,074.38. `issues` (Ledger `gapIssues`: holes, accounts whose lines stop early or start late) replace
  the hole note: "Visa card's lines start on 8/20: bring in a file from 8/1. Until then, August's total leaves out whatever
  happened on those days.", and `months[].holes` counts all of them ("some days missing"). The default month is the latest
  `wholeMonth` (Ledger). The card note says "went to the Visa card" (`theCard`).
- Re-check (2026-11-02): a payment stands in only for a month the card has no lines in, or when it is dated before the card's
  first line ever (Ledger `cardPayments`, rule 2), so a Visa file 8/1 to 10/10 gives October its own lines, $5,143.32 (not
  $7,753.62), and a Visa file with a gap 9/11 to 9/19 gives September $6,376.48 (not $9,357.03). A loan or mortgage at the
  card's bank stays a transfer: October $2,453.32 + $2,610.30 = $5,063.62. A stand-in before the card's file starts is said
  so: its line's pill reads "before its file", and the note says "What was paid to the Visa card before its file starts
  ($2,450) counts below as one line in place of what it bought then." The note's buttons are one per account it names, each
  "Bring in the <name> file" (`bringWords`), the Visa's too.
- `issues` and `months[].holes` leave out a late start or short end that is the files' own span (one account whose file
  starts on the 10th is "from the 10th", compared on the same days as before); a hole, or one account starting later or
  stopping sooner than the others, counts.
- `cmpGap: { ym, prev }`: when this month or the one before has such a gap, `change` and every category's `change` are null
  (the difference would be the missing days: September's mortgage read "new this month" against an August missing the 2nd).
  The page shows last month's total with "not compared: Aug's files miss some days", and no "new this month".

- Re-check 4 (2026-11-02): `issues` and `cmpGap` use the Ledger's one quiet-spell rule (`quietTooLong`) for a late start or
  short end against the files' span, so a second account whose file starts 2 days after the first is not a gap. A payment
  counted for neither of two cards at one bank (`unsure`, Ledger `unsureCardPayments`) is in no card's stand-in: the page
  says the one sentence "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought."
  with a "Bring in the <card> file" button per card, the month counts as "some days missing" and `cmpGap.card` is true
  (the change is not shown). A card row in a month before the card's first line reads "Visa card, before its file starts on
  8/1" (`before`, `first`), and the note says "before its file starts on 8/1". The default month falls back to the latest
  month the files' span covers when no month is whole. Own accounts are never cards (Ledger `cardPayments` rule 0): a
  Discover savings transfer, an American Express savings transfer, Apple Cash and a Visa Direct cash-out leave October at
  $7,453.62; Bank of America and American Express cards each get their own payment ($6,043.32); "US BANK PMT XXXX4321" is
  Card 4321's ($7,453.62).

## Opened from the Monthly review (2026-11-02)
`?month=2026-10` opens that month (the review's), until a month is picked here.

## Edge cases
No spending at all: empty state. A month asked for that has no spending falls back to the default (the latest whole month, else the latest). No whole month at all (a file shorter than a month): the latest month, said to be partial.

## Tests
`module.test.mjs`: totals and exclusions, shares and changes on the same days, unfiled bucket, payees and biggest lines, the default month (the latest whole one) and fallback, a file cut mid-month (same days of the month before, per day over the days covered, a cut first month, months with no common days). The card stand-in line appearing ($1,500 + $200 + $640 = $2,340) and going once the card's lines are in ($2,055.50), and the sample family's October ($4,843.32 + $2,610.30, against September's $5,746.48 + $2,980.55) and August's hole (2026-11-02). Re-check (2026-11-02): finding 1 ($5,063.62), finding 2 ($5,143.32 and $6,376.48), finding 6 ($6,263.32), finding 4 (a quiet savings account and no card: opens on October, $4,843.32, no issues), and `cmpGap` (September against a holed August; October compared; a single account's file from the 10th still compared on the same days).

## Ideas / not yet
- A calendar heat map and a 12-month trend line (uPlot, vendored).
- Merchant merging (Amazon Mktpl + Amazon Prime -> Amazon).

## Recheck 2026-11-05
`months[].cardOnly`: the month's only gap is a payment counted for neither card (two cards at one bank, no file for either).
No day is missing, so the month picker says "Oct 2026 (card purchases not all in)" instead of "(some days missing)"; a
month that also misses days (August's 8/1-8/2) still says "(some days missing)". Test: Freedom and Sapphire on plan3, the
compute flags and the picker's words drawn with a stand-in for the UI kit.

## Touch and input stress test (2026-11-11, claude-g)
- A category row opens the Ledger at that month with `?category=<id>` (`none` for unfiled) (p-cashflow-b-goals x-2). The Ledger
  (claude-d's) reading it is asked for on the workboard.
- Its Ledger link also sends `dir: "out"`: the tapped category's money out only (claude-d's N3 hand-off, 2026-11-12).
