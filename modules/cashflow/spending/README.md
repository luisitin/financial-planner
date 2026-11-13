# Where the money goes  (`cashflow/spending`)

**Status:** usable (phase 3)
**Purpose:** Spending by category and payee for a month, against the month before and over a year, and what you watch.

## Inputs
Plan sections read (`needs`): `transactions`, `categories`, `spendingWatch` (optional, gap #13). Writes `spendingWatch` only (Watch a shop or category). `compute(plan, { month, today })`; `month` defaults to the latest month with spending.

## Outputs
`{ month, label, months[], total, count, previous ({ ym, label, total } | null), change, byCategory[] ({ category, label, icon, total, share, count, previous, change }), topPayees[], biggest[], daily[], hasData }`, plus, only when there is something to say (so a plan without them gives the result it gave before, byte for byte): `year` (twelve whole months) and `watch` (the watch list). See "A category over twelve months" below.

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
- A calendar heat map and a 12-month chart per category (uPlot, vendored); the figures are in `year` already.
- Merchant merging (Amazon Mktpl + Amazon Prime -> Amazon). Watching a shop already treats "Kroger #22" and "KROGER" as one.
- A target for a watched shop or category ("no more than $300 a month"), as Simplifi's watchlists have.

## Recheck 2026-11-05
`months[].cardOnly`: the month's only gap is a payment counted for neither card (two cards at one bank, no file for either).
No day is missing, so the month picker says "Oct 2026 (card purchases not all in)" instead of "(some days missing)"; a
month that also misses days (August's 8/1-8/2) still says "(some days missing)". Test: Freedom and Sapphire on plan3, the
compute flags and the picker's words drawn with a stand-in for the UI kit.

## Touch and input stress test (2026-11-11, claude-g)
- A category row opens the Ledger at that month with `?category=<id>` (`none` for unfiled) (p-cashflow-b-goals x-2). The Ledger
  (claude-d's) reading it is asked for on the workboard.
- It does not send `dir: "out"` (claude-d's N3 hand-off, tried and taken back 2026-11-12): this page's category total and count are net of refunds filed in that category, so the Ledger must show the refunds too, or the two pages disagree (Groceries "4 transactions, $236" here, "3 transactions, $276 money out" there).

## A category over twelve months; watch one shop or category (gap #13, 2026-11-13, claude-b)
Gap spec design #13 (map lines L3 "spending by category over months" and L5 "watch one payee or category"). Simple first
(docs/OPTIONAL.md): the page was class A (fine), so its first view is as it was, plus at most two amber lines and one line per
watched shop or category; everything else is in two quiet rows of one parts card at the foot of the page.

**What a person sees by default.**
- Nothing new until the bank files hold twelve whole months, or something is watched.
- With twelve whole months, one amber line per category that went up (at most two, the biggest rise in dollars first), right
  under the month's figures and never folded (R9: an amber line is an alarm): "Eating out: $410 a month from Aug to Oct,
  $320 a month over the year (up 28%)."
- Each watched shop or category is one row of "What you watch", under the amber lines: "🏪 Kroger · 2 times in Oct 2026 ·
  $400 a month over the year · $400"; "Nothing in Oct 2026" (a zero in words, value "None"); "nothing over the year"; no
  year's figure without twelve months. The year's figure is the average month, said as such and never as "usually": a $15
  subscription that started in August is "$4 a month over the year", not what it usually costs (critic 2). The month is
  the page's month ("in Nov 2026 so far", "in Oct 2026, Oct 1 to 9 only" for a partly covered one).

**One tap away** (one parts card after "Who got the most" and "Biggest single lines", in the helper's order):
- "N more categories over 12 months · Nov 2025 to Oct 2026" (`year`, kind `more`; lazy only above 40 rows, per
  docs/OPTIONAL.md, so find-in-page and the tests read it): which twelve months, how many months in between were left out and
  why, then every category: its average month, its last 3 months' average with "up 28%" / "down 10%" / "no change" / "none
  before", "going up" on a marked one, and how a category is marked.
- "Watch a shop or category" (`watch`, kind `own`; the design's title, pinned in `qa/first-view-lib.mjs` `PINNED_TITLES` and
  by the tests: it is a pick of a shop or a category, not numbers, so the vocabulary's "Set my own numbers" would be untrue;
  status "N set by you"): one line of words, the watched ones each with an outlined "Stop watching", then one box "What to
  watch" (shops first, "Shop: Kroger", then "Category: Groceries"; what is watched is not offered again) and the filled
  "Watch it". The box is not `required` (a required box is never folded, docs/OPTIONAL.md R9 item 9, and this one is asked
  only by its own optional form): "Watch it" with nothing picked is held at the box with "Pick a shop or a category first."
  (`ui.fieldError`, which also opens the part around it) and saves nothing. At five watched the box gives way to "You watch
  5 things, the most this page shows. Stop watching one to pick another."
- After "Watch it" the green line, inside the part that stays open (R7, R17): "Saved. You now watch Kroger: $400 in Oct
  2026." / "Saved. You now watch Pets: nothing in Oct 2026."; after Stop watching: "Done. You no longer watch Kroger." No other
  part opens or shuts, and the green line is said once (the module test named "S11").

**Plan field.** `spendingWatch?: [{ kind: "payee" | "category", key }]` (optional top-level section, docs/DATA_MODEL.md; no
version bump; absent = nothing watched; Stop watching on the last one removes the section). `key` is a category id, or a shop
as written on its bank lines (the name most of that shop's lines carry). Unusable entries (another kind, a blank key) are
skipped by `watchesOf` and kept in the plan as they are.

**Formulas** (`compute.js`; the rule is the gap spec's own, design #13, 2026-11-13: there is no outside figure in it).
- Whole months (`wholeYear`): from the newest month the bank files reach, back; a month counts when it is over, the files
  cover it end to end (Ledger `monthCover` `full`), no account's files miss days in it (Ledger `monthGaps` `whole`: no hole, no
  account stopping early or starting late, no payment counted for neither card) and no card stands in for its purchases (a
  stand-in line from `unimportedCardLines`: what the card bought is not known by category, and a card file that arrives later
  would make every category it buys from look like a jump). The newest 12 such months are the window; fewer than 12: no `year`.
  `left` = months between the window's first and last that did not count.
- Per category (a month with nothing in it counts $0; refunds filed in it come off, as everywhere on this page; lines not
  filed yet are the category ""): average = the 12 months' total ÷ 12; recent = the newest 3 months' total ÷ 3; before = the
  9 months before those ÷ 9; rise = recent − before; trend = rise ÷ before (null when nothing before); up = recent ÷ average − 1.
- Marked (`jump`): trend ≥ 20% and rise ≥ $50 a month (with 1e-9 of float room, so 250 → 300 is marked); never "".
  `jumps` = the marked rows by rise, at most 2.
- Watched: the month's total = money out minus money back on that month's real bank lines at the shop (`samePayee`: the
  Rules page's `payeeWords`, so "Kroger #22" and "KROGER" are one shop, "Kroger Fuel" another, and "PayPal *Netflix" and
  "PayPal *Spotify" two shops, not one "PayPal") or in the category (the
  same figure as its By category row); `usual` = the same over the twelve whole months ÷ 12.
- `watchChoices(plan)`: the shops of every spending line (money out, not a transfer) grouped by `samePayee`, named as most
  of their lines are, the 40 that took most; the spending categories; less what is watched.
- Worked example (the tests' invented household): eating out $290 a month for 9 months, then $410 in Aug to Oct 2026:
  average (3 × 410 + 9 × 290) ÷ 12 = $320, trend 120 ÷ 290 = 41.4% (marked), up 410 ÷ 320 − 1 = 28.1% (the line's "up 28%").

**Sources** (read 2026-11-13).
- Quicken Simplifi help, "Using Watchlists on the mobile app" (support.simplifi.quicken.com/en/articles/4637231, dated
  2026-09-16): a watchlist follows a payee, a category or a tag and shows this month's spending, an average month over up to
  12 months, the year to date and a projection. A design reference only, no code and no figure taken; Copilot Money's
  trends and Rocket Money's watch lists the same.
- The thresholds (20%, $50, 3 against 9 months, at most two lines) are the gap spec's design choice, not a published figure.

**Builder chose** (where the spec was open; README only, no new pattern for the design log).
1. The line names the year's average month, as the design's example does ("$320 over the year (up 28%)"), and its "up"
   is against that average, so the two figures on the line agree (410 ÷ 320); the mark itself uses the spec's trend against
   the 9 months before (41%). "Lately" became "from Aug to Oct", the months themselves.
2. A month where a card's purchases stand in for its file is not a whole month for this (the spec says "partly covered
   months are left out"; a card that is not in leaves its categories unknown). A household that never brings in its card
   file sees no twelve months: the honest answer.
3. The window is "the last 12 whole months", not 12 calendar months: a month with days missing is skipped and the window
   reaches back, and the part says how many were left out.
4. "N more categories over 12 months" holds every category, the marked ones too (with "going up"), so the year's table is
   whole in one place; N is all of them.
5. "lazy" (the design) is applied as docs/OPTIONAL.md allows it: above 40 rows only.
6. A shop's name is never in the result (`watch[].at` points into `watchesOf(plan)`; the view reads the name from the plan):
   Explain this page (ai/explain) swaps payees on the bank lines of its copy only, so a name read from the watch list would
   reach the AI helper as typed. A test runs Explain's digest on a watched shop.
7. At most five watched (one first-view line each), the parts card at the foot after the payee lists (R4: the parts card
   after the rows), and the watched rows are not tappable (the Ledger has no payee filter yet; By category rows still open it).

**Tests** (`module.test.mjs`, "gap #13", written failing first): 1 partial months left out (the month in progress, a file
starting Nov 20, a gap Mar 1 to Apr 8 reaching back to Sep 2025 with 2 left out, a card's October stand-in); 2 the trend
arithmetic ($320, $410, $290, 41.4%, 28.1%, $0 months, a new category never marked); 3 the thresholds (20% and $50 at the
line, 19.6%, $40, 10%, unfiled, the two biggest of three); 4 a watched shop's month total (two names, a refund, another
month, nothing, the usual month, fewer than twelve months), the category's equal to its row, the choices; 5 no lines gives
nothing, a junk watch list is none; invariance (more than 500 plans: the qa households with every pack and the fixture plans,
on two days: no new key, and an empty watch list changes nothing); the page (the amber line and the watched row outside the
parts, both parts shut with their titles and statuses, the year's words inside; nothing new without twelve months; Watch it
writes one entry, the green line in the open part, the year part shut, Stop watching removes the section; the nothing line;
five is the most); critic 1 (two shops paid through PayPal are two shops: the watch and the box); critic 2 (the row says "a month over
the year", never "usually"); privacy (Explain's digest of a watched shop says "Payee N", never the name). One-off at build: compute()
at the base against this commit over 1,419 plans × 3 days × 3 months: 12,771 of 12,771 byte-identical.
