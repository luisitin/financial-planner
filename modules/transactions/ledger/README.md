# Ledger  (`transactions/ledger`)

**Status:** usable (phase 3)
**Purpose:** Every transaction in one list you can filter, search and correct.

## Inputs
Plan sections read (`needs`): `transactions`, `accounts`, `categories`. Writes: `transactions` (edit, add by hand, delete).
`compute(plan, { month, accountId, category, q, limit = 100, offset = 0 })`: `category` is a category id, `"none"` for uncategorised, `""` for any. `q` searches payee, the bank's raw text and the note.

## Outputs
`rows[]` (newest first, then largest; each with `categoryLabel`, `icon`, `accountName`, `transfer`), `shown`, `matched`, `matchedIn`, `total`, `in`, `out`, `net` (over the matched set, transfers excluded), `months[]` (`ym`, `label`, `count`), `accounts[]` (`id`, `name`, `count`), `uncategorised`, `uncategorisedAll`, `hasMore`.

## Shared helpers (used by the other transaction pages)
- `txKey(t)` = `accountId|date|amount to 2 dp|normalised payee`: the identity of a bank line; imports refuse a line whose key is already on file.
- `monthOf(date)`, `monthLabel("2026-09")` -> "Sep 2026".
- `isTransfer(t, plan)`: linked (`transferId`), category `transfer`, or any category of kind transfer.

- `coverage(plan)` -> `{ from, to }`: the first and last transaction dates, the days the bank files cover (2026-11-01).
- `monthCover(cov, ym, today)` -> `{ from, to, firstDay, lastDay, days, daysInMonth, full }`: the part of a month the files cover, never past today. `full` when it misses at most `COVER_SLACK` (3) days at either end and the month is over: my choice, so a file cut on the 29th, or a quiet 1st, still counts as the whole month. Where the money goes and Budget use it so a month cut by the file is never read as a whole month.

## Coverage per account and missing card files (2026-11-02)
`coverage()` takes the first and last date over every account, so a month counted as whole when one account reached both
ends: a credit card with no file at all, or the days between two checking files, went unseen (the sample family's Visa
purchases, about $2,700 a month, and the mortgage of Aug 2 were missing from every spending page). `coverage()` stays for
callers that want the whole span; these sit next to it:
- `coverageByAccount(plan)` -> `{ [accountId]: { from, to, holes: [{ from, to, days }], slack, spacing } }`. An account's
  files are its import records (`plan.imports[].from/to`) and, for lines no record covers, runs of lines (a new run after
  more than `max(LINE_GAP_DAYS, slack)` days with nothing). Re-check 4 (2026-11-02): an import record holds its file's first
  and last line dates, not the days the file was downloaded for, so a few quiet days at a file's edge are normal. The `days`
  between two consecutive pieces are a hole only when
  - they lie between two runs of loose lines (no record on either side; more than `max(LINE_GAP_DAYS, slack)` by construction), or
  - `quietTooLong(days, spacing)`: `days > SHORT_DAYS` (7) AND `days > 2 x spacing` (one rule for holes, lines that stop
    early and lines that start late), or
  - one of the account's usual monthly payments (`usualPayments`) is due in them, in a month with none of its lines.
  Otherwise they are a quiet spell. An account with lines on fewer than `RHYTHM_DAYS` (5) days never gets a hole.
  Example: July's lines to 7/30 with no record, a file from 8/3: 3 quiet days, but the paycheck (the 1st) and the mortgage
  (the 2nd) are due in them with no August line of either: hole 7/31 to 8/2. One checking file a month, each record from its
  first to its last line (8/3-8/29, 9/1-9/26, 10/1-10/31): 2 and 4 quiet days, the paycheck and mortgage in their months: no
  hole (the old 3-day slack had made two, and the typical month of $4,205.78 over three months had lost two of them).
  - `slack = max(COVER_SLACK, 2 x spacing)`, `spacing` = the median days between the account's distinct line dates, known once
    it has lines on `RHYTHM_DAYS` (5) days (else `null`, and slack = `LINE_GAP_DAYS`). My choice: a checking account or card
    with a line most days is held to 3 days, as the task asked; a savings account with a line a month (spacing 30, slack 60)
    is not called holed for a month with nothing, and one with two lines cannot be judged. Lines without a record only show
    activity, never where a file stopped, so a quiet week among them is never a hole (the July fixture has 4 to 6 day gaps).
  - Re-check (2026-11-02, rule 5; re-check 4): an account with lines on fewer than 5 days (`lineDays`) gets no hole at all,
    from records or lines: quarterly interest on 7/31 and 10/31, with or without a one-line record each, is not three months
    missing (it had made a household with no card lose Spending's October, bank versus plan and Budget's suggestions).
  - `slack` now only says how far from a month's ends `monthCover` lets an account's own coverage start or stop.
- `quietTooLong(days, spacing)`: the one quiet-spell test above. `SHORT_DAYS` = 7: my choice, a week with nothing on a daily
  account is worth asking about, four days are not.
- `usualPayments(plan, lines)` -> `[{ key, accountId, payee, rawPayee, category, amount, day, dates, first, last }]`: the monthly
  rule of cashflow/recurring's `detectRecurring` (the ledger cannot import it): one account, one cleaned payee, median spacing
  26 to 35 days with 60% of spacings in that band, three or more lines or two of the very same amount (within 2%), amounts no
  more than 50% apart; transfers left out. `day` = the median day of the month, `amount` the median amount. A usual payment
  is due in some days when its day falls in them in a month with none of its lines, within `USUAL_REACH` (35) days of its
  first or last line (a mortgage paid on the 5th one month is not missing).
- `usualInDays(plan, accountId, from, to, add?)` -> `[{ name, day, out, amount }]` (up to 3, money out first, largest first) and
  `usualWords(usual)` ("your mortgage usually goes out on the 2nd and a paycheck on the 1st"): what the hole's words, the
  Import page's warning and the files step name.
- `monthCover(cov, ym, today)` also takes one account's coverage: it then uses that account's slack and `full` is false while
  a hole reaches into the month; it returns `holes` (clipped to the month, each with `whole`, the full hole).
- `monthHoles(plan, ym, today, covBy?)`: every account's holes in the month, with the account's name.
- `isCardAccount(a)`: type `credit`, or `other_liability` named like a card. Money to savings, a loan or an investment is
  never treated as a card's purchases (it is not spending).
- `cardPayments(plan, ym, { today, covBy })` -> `[{ t, cardId, out, matched, standIn, maybe? }]`: money filed as a transfer
  between a non-card account and a card in the month, money out (`out`) or back (a returned autopay, a refund of a credit
  balance). The re-check (2026-11-02) replaced the word scores with these few rules (a loan or mortgage at the card's bank
  had scored as the card: "CHASE HOME LENDING PMT" and "CHASE AUTO PMT" made October $7,453.62 instead of $5,063.62):
  0. Re-check 4: your own accounts are never cards. A transfer line paired with its other side on another known non-card
     account is a transfer between them: "DISCOVER BANK ACH TRANSFER" -$500 with +$500 on the Discover savings file. The
     pairs (`ownPairs`, re-check 5) take transfer lines only, the opposite amount within `OWN_DAYS` (3) days, each line once,
     lines with no card word and naming no card first, then the nearest. A line saying "transfer" or "xfer" with no card word
     that names every word of another non-card account's bank and none of a card's own name words is one too, with or
     without that account's file ("AMERICAN EXPRESS NATIONAL BANK TRANSFER" to an American Express savings account); so is a
     line with no card word, "transfer" or a wallet's words, that names every word of another non-card account's own name
     ("APPLE CASH TRANSFER" with an Apple Cash account, "PAYPAL TRANSFER" with a PayPal account; re-check 5). Wallet words
     (PayPal transfer, Venmo, Cash App, Zelle, Apple Cash, Visa Direct, cash out) are strict, and so are money in and
     "transfer to" when the line has no card word: such a line is a card's only when it names that card's own name words or
     its last four ("VISA DIRECT VENMO CASHOUT" +$150 is no refund on the Visa; "ONLINE TRANSFER TO DISCOVER" is no Discover
     card payment). With a card word they are not: "TRANSFER TO CREDIT CARD" is a payment and "CHASE CREDIT CRD REFUND" a
     refund of a credit balance (re-check 5). One exception keeps a returned autopay: money in of the same amount, on the
     same account, within `MATCH_DAYS` after a payment counted for a card, is that card's money back.
  1. the other side of its `transferId` when that is a card; a `transferId` to a non-card account is never a card's;
  2. else the line must name a card or use a card word. What names a card: its own name's words other than its bank's and
     generic ones (Freedom, Sapphire, the last four digits when the name has them) or its network (visa, mastercard, amex or
     american express, discover, from its name or bank). Card words: card, crd, credit card (and a word ending in "card",
     APPLECARD). A bank's name with "pmt" or "payment" alone is never enough ("CHASE MOBILE PMT", "JPMORGAN CHASE PAYMENT").
     A line with a loan's or another account's word is never a card's: home lending, mortgage, mtg, auto, loan, lending,
     invest..., brokerage, savings, 529, hsa, ira, 401k, retirement ("AUTO PAY" is read as autopay, a payment). A name word
     matches when it is the same, or one starts with the other and both have 5 letters or more; a card's last four match at
     the end of any word after letters only (XXXX4321, *4321, x4321; an ACH id ending in 4321 does not). A bank's name
     counts only as whole words, every one of them (re-check 4: "BANK OF AMERICA" is not "American Express");
  3. the cards it could be: the ones it names, or every card when it uses a card word. The card with its own money-in line
     of the same amount within `MATCH_DAYS` (7) days has it (each line matched once; one the line names first, then the
     nearest). Else a card whose own file covers every day within 7 days of it, up to today, without that line is not the
     one; of the rest, the only one left, else the only one the line names, else (it names none of them) the only one whose
     bank is in the line. My choice for that last step: "CHASE CREDIT CRD AUTOPAY" with a Chase Visa and an Amex is the
     Visa's, as anyone reading the line would say; the bank still never makes a line a card's payment on its own. Otherwise
     it is unsure (`cardId` null, `maybe` the cards it could be) and stands in for none: counted once. Re-check 4: the
     month is then not whole and every page says one sentence, `unsureWords` ("$2,610 went to one of your Chase cards in
     October; bring in the card files to see what it bought"; "the Sapphire file" when only one of them has no lines).
     Finding 6: Freedom (October file) and Sapphire (none), both at Chase, checking's "CHASE CREDIT CRD AUTOPAY" -$800 on
     10/20 and -$2,610.30 on 10/30. Freedom's file covers 10/13 to 10/27 with no +$800, so the $800 is the Sapphire's; the
     10/30 one could be either (Freedom's file ends 10/31, before its card side would post) and names neither: unsure.
     October = $4,843.32 + $620 + $800 = $6,263.32 (it was $8,873.62). The review's case with Freedom's +$2,610.30 on 10/15
     in its file stays $6,263.32.
  - `standIn` (rule 2): the card has no lines of its own in the payment's month, or the payment is dated before the card's
    first line ever (`firstLineOf`). Never in a month the card's file covers in part: the payment paid purchases already
    listed or about to be, and monthGaps leaves the month out of whole-month averages instead (its hole, late start or short
    end, which the files step names). Finding 2: a Visa file 8/1 to 10/10 kept the 10/14 autopay as a stand-in on top of the
    purchases it paid (October $7,753.62); now October is its own lines, $5,143.32, and short. A Visa file with a gap 9/11 to
    9/19: September $6,376.48, not $9,357.03. A Visa file from 8/20 keeps the 8/14 payment (before its first line).
- `cardStandIns(plan, ym, opts)` -> `[{ accountId, name, paid, from, lines, hasLines }]`: per card, the stand-in payments less
  the stand-in money back the same month: money back cancels a payment of the same amount, else comes off the latest
  payments, never below 0. The review's case: -$2,610.30 (10/14), +$2,610.30 back (10/16), -$2,610.30 (10/20): paid
  $2,610.30, not $5,220.60. A $50 refund with nothing paid that month: no stand-in.
- `missingCardFiles(plan, ym, opts)`: the cards in `cardStandIns` with no lines of their own in the month (`paid > 0`). Changed
  in the review: a card with lines last month, none this month and nothing paid is no longer listed (a quiet month is
  normal, and the owner had no way to clear it; a card whose rhythm stops is `monthGaps`' `short`, which "Nothing happened"
  clears). Re-check 4: paid cards only; an unsure payment is `unsureCardPayments(plan, ym, opts)` -> `{ paid, count, lines,
  maybe, cardIds, bank, from } | null` (what went to one of the cards, which cards it may be, their shared bank) and
  `monthGaps().unsure`, said by `unsureWords(plan, u, month, money)` on Spending, the Income statement, Budget, bank versus
  plan, the Annual review and the Monthly review's files step (with a "Bring in the <card> file" link per card).
- `paymentsTo(plan, accountId, from, to, { today })`: the money that went to an account from your other accounts in those
  days (the other side of a `transferId` on it; for a card, every `cardPayments` line to it or that may be to it). The
  Monthly review never offers "Nothing happened" for days with one in them (rule 4; finding 3: pressing it for the Visa's
  8/1 to 8/19 dropped the 8/14 payment and took August from $6,074.38 to $3,624.16).
- `firstLineOf(plan, accountId)`: an account's first line ever (the stand-in rule, and "before its file starts on 8/20").
  `beforeLabel(name, first)` -> "Visa card, before its file starts on 8/1": the stand-in's payee in any month before the
  card's first line (re-check 4: July, with the Visa file from 8/1, had said "details not imported yet" on one page and
  "before its file starts" on another; every page now says the second, with the date).
- `unimportedCardLines(plan, ym, opts)` / `allUnimportedCardLines(plan, opts)`: one stand-in spending line per payment left in
  `cardStandIns`: dated the payment, money out (the amount left after money back), category `card-unimported`
  (`CARD_UNIMPORTED`, not a category in the plan, never stored), payee "<card>, details not imported yet", `cardId`,
  `synthetic: true`, `before` (the card has lines that month: the payment is dated before its first line). Spending, the
  Income statement, Budget, bank versus plan and the Annual review add them; they go once the card has lines in that month
  (its purchases count, the payment stays a transfer), except a payment before its first line ever. A payment usually pays last
  month's purchases: it stands in for the month, it is not the month's own figure.
- `monthGaps(plan, ym, today, covBy?)` -> `{ holes, short, late, cards, unsure, whole }`: what keeps a month's files from being whole.
  `short`: an account whose last day on file is more than 2 x its usual spacing AND more than `SHORT_DAYS` (7) days before the
  month's end (or today) while it had lines that month or the one before, never one with lines on fewer than 5 days (rule 5;
  a second checking account used every few days that went quiet for a week was called short); `late` (review): an account
  whose files start in the month later than a quiet spell after the 1st (`quietTooLong`, re-check 4; it had been its slack, 3
  days for a daily account) (a Visa file from 8/20: "Visa card's lines start on 8/20: bring in a file from 8/1."); both leave
  out the cards in `cards` (their payments stand in). `unsure`: `unsureCardPayments`. `whole` = no hole, no short, no late
  account and no unsure payment.
- `wholeMonth(plan, ym, today, { cov, covBy })`: `monthCover(coverage(plan)).full` and `monthGaps().whole`. Spending's default
  month, Budget's suggestions, the Income statement's typical month (re-check rule 6: it had asked `monthGaps().whole` only,
  so a July with one savings line on 7/31 was averaged) and bank versus plan all ask this, so a Visa file from 8/20 or one stopping on 9/19 no longer leaves August or September counted as whole.
- `gapIssues(plan, gaps, ym, money)` -> `[{ accountId, kind, text, why, quiet }]`: `monthGaps` in words, cards first; `why` is
  the short reason (Budget's and the Income statement's "left out"), `quiet` the days that can be marked as nothing happened
  (none for a card money went to).
- `markQuiet(draft, { accountId, from, to, at, id })`: the plan change for "Nothing happened on those days": one
  `plan.imports` entry with no lines (`fileName ""`, rows 0, added 0, from, to), no new field; `isQuietImport(im)` tells it
  apart. Coverage counts it like any file, so a hole, a late start or a short end it covers is closed.
- Words: `holeWords(h, usual?)` ("Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes out on the 2nd and
  a paycheck on the 1st): bring in a file that covers those days, or add them by hand."; hole issues carry `from`/`to`, which
  the files step's links pass on), `cardWords(plan, c, ym, money)` ("Visa card: $2,610 went to it from checking in October, but its own file isn't
  in, so what you bought on it is missing. Bring in the Visa file."), `payerWords`, `theCard` ("the Visa card"),
  `monthsWords` ("July and August", "July to October"), `bringWords`, `fileWord`, `shortDate`.

## Transaction shape
`{ id, date, amount (+ in, - out), payee, rawPayee (the bank's text), accountId, category ("" = none), tags[], note, transferId?, importId?, key, splits?: [{ category, amount }], reimb?, exclude?, flag?, refundOf? }` (`splits`: gap #24, below; the last four: gap #32, at the end).

## Money in, money out, kept (re-check 4)
The page's totals follow the Income statement's rule, so the Ledger, the Income statement and the Annual review give the same
figures: transfers left out; a line is money in when its category is an income category, else money out (a refund lowers
money out); and with no category filter, the stand-in lines of cards whose own file isn't in (`allUnimportedCardLines`, in
the month, account or search shown) are money out too (`cardsOut`, said under Money out). plan3: $44,234 in, $26,131.54 out,
$18,102.46 kept on all three.

## A line typed by hand: which way, never a sign (stress test, 2026-11-11)
The add and edit forms ask "Which way": Money out (I paid) / Money in (I received), starting on Money out, and the Amount
box takes the size only (an iPhone's number pad has no minus key, so "4.50" was saved as money in). `signedAmount(dir, n)`
in compute.js: `-|n|` for out, `+|n|` for in, and a typed minus is always money out; 0 stays 0; blank is null.
`directionOf(amount)` sets the choice when a line is edited. Tests: "a line typed by hand ...".
Review round 1 (claude-r, 2026-11-11): the Amount box has no minimum, so an existing $0.00 line saves its category (N1) and a
typed or pasted minus reaches `signedAmount` and is saved as money out, confirmed as "$45.20 out" (N2). A new line of $0 or
blank is refused at the form: "Type how much it was, more than $0.", focus back on Amount.

## Money out only, money in only (review N3)
`?dir=out` or `?dir=in` on a Ledger link keeps only that direction: `compute(plan, { dir })` keeps a line when
`(dir !== "out" || amount < 0) && (dir !== "in" || amount > 0)`; any other value is ignored. The page then says "Showing money out
only." with an outlined "Show money in and out". Like every filter a link sets, it is
cleared by the next link that does not set it. `matchedIn` / `matchedOut` = how many of the matched lines are
above / below $0 (a $0.00 line is neither); with `?category=none`, no direction and `matchedOut < matched`, a muted line says
"N lines, M of them money going out. Where the money goes counts only those M." so the count agrees with that page. A new
line's "$0" error sits right above the Amount box and goes when typing starts; a $0.00 save says "$0.00", with no way.

Also from the stress test (2026-11-11, claude-d): the Search box refreshes only the totals, the "Showing" line and the
list, never itself, so the cursor and the phone's keyboard stay while typing; a link that sets the filters
(`/month/<ym>`, `/account/<id>`, `/uncategorised`, and now `?category=<id>|none`) clears the filters it does not set,
replaces the address (one Back returns to the page the link was on) and brings the list to the top of the screen; every
add, save and delete says so in green where the form was; a tap on a row while a new line is half typed asks to finish
or cancel it first; with no account yet the first step is the filled "Add your checking account or card" and the
by-hand form is not offered.

## Edge cases
No transactions: empty state with links to Import and Net worth. Deep links `#/transactions/ledger/uncategorised`, `/month/2026-09`, `/account/<id>` set the filters once and then the address returns to the bare page. Filter state lives in the module for the session so a save does not reset it.
`/account/<id>?month=2026-08&add=2026-08-01` (the Monthly review's "Add Chase checking's lines by hand"; `from=review` kept)
opens that account and month with the add form open and its date set to the first missing day. On a phone the
"Show" fold's summary wraps inside the 390 px screen (scoped `.lg-show` style).

## Tests
`module.test.mjs`: coverage and whole months (slack, not over yet, not reached, never past today); helpers, empty plan, totals excluding transfers, month/account lists, every filter, paging. Fixture: `qa/fixtures/sample-plan.mjs`.
Per account (2026-11-02): holes between import records at the slack edges (5, 4 and 3 days), between loose lines and a file,
a month with nothing among loose lines (32 and 31 days), a sparse savings account and a two-line account, `monthCover` on one
account, holes clipped across two months, `cardPayments` matching (bank name, card name, no name, savings, zelle, a loan, a
debt-filed payment, a `transferId` pair), `missingCardFiles` paid sums ($500 + $75 = $575) and the month after a file stops,
the stand-in lines appearing and going, `monthGaps` short accounts, and the sample family back after three months
(`qa/fixtures/card-gap-plan.mjs`: Chase's hole 7/31 to 8/2, August not whole for Chase, the Visa's $640.22, $2,450.22,
$2,980.55 and $2,610.30).
Review (2026-11-02): two cards at one bank told apart by the card's own line ($800, not $3,410.30), the MATCH_DAYS edge,
other accounts' payments (529, student loan, car loan, HSA, mortgage servicer) never a card's, a card paid from savings,
money back from the card ($2,610.30 net; a $50 refund off the latest; never below 0), a card file that starts late (8/20) or
stops early (9/19): `late`/`short`, `wholeMonth`, the words (`monthsWords`, `theCard`).
Re-check (2026-11-02): the 23 lines of the 529/loan test (a bank with "pmt" never enough, loan and account words, AUTO PAY,
a network), the late Visa's 8/14 stand-in kept (before its first line) and `paymentsTo` over its quiet days, a card with one
line never short and a daily one short and cleared by `markQuiet`, `SHORT_DAYS` at 7 and 8 days, finding 1 (loan and
mortgage at Chase: only the $2,610.30 is the Visa's), finding 6 (the unsure 10/30 payment, $800 standing in, the unsure
card's words), finding 4 and rule 5 (quarterly interest: no hole from lines, a hole only between two records), and a guard
over ten households with no card file to miss and no real gap: `wholeMonth` equals the old `monthCover(coverage).full` for
every month, with no gap and no stand-in (the re-check's field-by-field comparison with dc6e73c).

## Recheck 2026-11-05
The re-check of the card patch (round 4) found four regressions against round 3; the rules above now read:
- **"transfer to ... card" is a card's payment again.** Round 4 made "transfer to" a wallet's words, so a line had to name the
  card's own name words or last four. Many banks and credit unions word paying their own card that way, and the card's name
  ("Visa card", "Citi card") has neither: every page lost about $2,610 a month, said "done" and "Your month works". Now
  "transfer to" is strict only with no card word. A transfer naming a non-card account's bank yields to a card word too
  ("ONLINE TRANSFER ... TO WELLS FARGO VISA CARD XXXX1234" with a Wells Fargo mortgage). plan3 with each of "TRANSFER TO
  CREDIT CARD" (Navy Federal), "ONLINE TRANSFER REF #IBE7Q2 TO WELLS FARGO VISA CARD XXXXXXXXXXXX1234" (Wells Fargo),
  "ONLINE TRANSFER TO CITI CARD" (Citi card) and "Online Banking transfer to CRD 1234" (Bank of America): October $7,453.62
  (was $4,843.32), the Visa's $2,610.30 standing in.
- **The other side on your own account comes from transfer lines only, card-worded lines last** (`ownPairs`). Round 4 took
  any line on another account (a $3,000 paycheck the day after a $3,000 card payment made it a transfer: October $5,043.32,
  now $8,043.32) and gave it to whichever line sorted first (a $500 autopay took the other side of a $500 savings transfer
  the same day about half the time: $4,843.32, now $5,343.32 in either order).
- **A refund of a credit balance counts again.** Money in with a card word ("CHASE CREDIT CRD REFUND" +$200) comes off what
  went to the card: October $7,253.62 (was $7,453.62); September with +$300 $8,427.03 (was $8,727.03). Money in with no card
  word still needs the card's own name ("ZELLE FROM ANA" is none).
- **A wallet account named in the line is that account**, even without its file: Apple Card with an Apple Cash account and
  +$100 "APPLE CASH TRANSFER": $7,453.62 (was $7,353.62, a refund from the Apple Card); PayPal Mastercard with a PayPal
  account and -$200 "PAYPAL TRANSFER": $7,453.62 (was $7,653.62). "PAYPAL CREDIT PAYMENT" (no transfer word) is still the
  card's.
- `gapIssues`' unsure issue carries `brief` (`unsureBrief`: "money went to your Chase cards, whose files aren't in"), so a
  note naming several months says it once (Budget).
Not changed: a quiet spell of 8 to 10 days at a file's edge is still called a hole when the store line runs on half the days
or fewer (sweep of 40 households, one file a month: 0 of 40 at 70%, 1 at 50%, 5 at 35%; "Nothing happened" clears them), and
a card's first file starting on the 6th makes its month whole (the first 5 days of purchases are not asked about).
Tests: the four wordings and the last-four one, "ONLINE TRANSFER TO DISCOVER" still not a payment, the paycheck and
same-day savings cases in both id orders, a card-worded line pairing with an "other debt" account, the refunds in October and
September, Apple Cash and PayPal without their files; the round-4 test of "CHASE CARD REFUND" now expects it to count
($2,560.30 left).
Verification of the re-check (same date):
- **Money in from a card is a refund only when it says so** (refund, return, reversal). "TRANSFER FROM CREDIT CARD",
  "Online Banking transfer from CRD 1234" and "CHASE CREDIT CRD CASH ADVANCE" are money borrowed on the card: plan3 with
  +$1,000 of any of them on 10/20 is $7,453.62 in October (was $6,453.62, and the files step said "$1,610 went to it").
- **"transfer to" naming the card by its Visa or Mastercard network is its payment** ("TRANSFER TO VISA 1234", "ONLINE XFER
  TO VISA", "ONLINE TRANSFER TO VISA SIGNATURE X1234" with a card called "Visa card" or "Visa": $7,453.62, was $4,843.32
  with the files step "done"). Amex and Discover are banks with savings accounts too, so they still need the card's own name.
- **Speed:** `ownPairs` looks the categories up once per call, not once per line (`categoryById` builds and sorts the list on
  every call). Three years of daily lines (5,804) and three cards: Dashboard 2.9 s to 0.4 s of CPU, Spending 2.7 s to 0.3 s,
  Annual review 19 s to 2.7 s.

## Ideas / not yet
- Split a transaction into several categories.
- Bulk edit (select many, set category).
- A running balance per account against the account's `balance` (reconcile page, phase 3 later).

## Split a purchase across categories; tags that do something (gap #24, 2026-11-14, claude-b)
**By default nothing new.** The edit form's first boxes are the ones it had (date, who, which way, amount, account,
category). Note and Tags moved under the form's own "More details (optional)" line (it opens by itself when a line already
has a note, a tag or a split), and that is also where "Split this across categories" sits, as an outlined button. The one
filled button is still Save changes; opening or closing anything writes nothing.

**Split this.** Each part taken out is a category and an amount; the form's Category box keeps the rest, and one line says
so as it is typed ("Groceries keeps the rest: $60.00."; with no category picked above, "Pick a category above: it keeps
the rest ($56.38).", which is what Save would refuse: `restWords`). A part is "This part is for" + "Its amount", under one
line, "Take part of this out into another category." Stored as `transactions[].splits: [{ category, amount }]`, the
parts in the order typed and the rest last, signed as the purchase. Our own design; Firefly III and GnuCash model splits as
separate journal lines and were looked at as references only (no code taken; AGPL / GPL).

Formulas (all in cents, so the parts add up to the purchase exactly; `../splits.js` and `compute.js`):
- `rest = |amount| - sum(parts typed)`; `splits = [...parts, { category: the Category box, amount: rest }]` (`makeSplit`).
  Parts in one category are added together; a part in the Category box's own category goes back to the rest; no part left
  means no split.
- `splitsOf(t)`: the parts count only when there are two or more, none is $0, each goes the same way as the purchase and
  they add up to it to the cent, and the line is not a transfer. Otherwise the purchase counts whole.
- `linesOf(t)` = one line per usable part `{ ...t, category, amount, splitOf: t.id, splitIndex }`, else `[t]`; so
  `sum(linesOf(t).amount) = t.amount` always. `allLines(plan)` = every transaction's lines; with no split anywhere it is
  `plan.transactions` itself (the same array), which is why nothing changes for a plan without splits.
- `mainCategory(splits)` = the biggest part's category (of equals, the one that took the rest). The transaction's own
  `category` carries it, so a page that reads whole transactions sees one filed purchase, counted once.
- A category's totals on this page with a split: the purchase is in a category when one of its parts is, and then only
  that part counts in Money in / Money out. With no category picked it counts whole.
- The duplicate key (`txKey`) stays the whole purchase's. Transfers are never split (the form refuses; linking a pair on
  Transfers drops the parts and its green line says so, `unsplitWords`). A category removed on Categories takes the split
  off: the purchase waits for a category again; the question before it and the green line after say so (`splitsUsing`,
  `splitLossWords`, `splitBackWords`).
- Counting: a purchase counts once whichever of its parts a page keeps (`countOnce`, `wholeCount`: by the purchase's id,
  never by which part came first; the split picker offers income categories, so the first part may be one a spending page
  leaves out).

Decisions where the gap spec was silent or did not fit the code:
- The spec stored `category: ""` on a split purchase. Here it keeps its biggest part's category instead: about ten pages
  read `!t.category` as "not filed yet" (Categorize, Rules, the AI helper, the Monthly check-in, the Cash-flow statement),
  and with "" each would have asked the person to file a purchase they had just split.
- "The last line takes the rest" is the form's own Category box, so a split is one tap and two boxes, never a second
  amount to make add up.
- No note per part (the spec had it as optional): the purchase's own note is enough for now.
- Every part needs a category: nothing in a split purchase is ever "uncategorized".

Refusals, each said at its box (`makeSplit`, one test each): "Type the amount first, then split it." · "Type how much of it
was <category>, or remove that part." · "Type how much the other part was, or remove it." · "Pick a category for the
$30.00 part." · "Pick a category above for the rest ($270.00)." · "The parts add up to $320.00, more than the $300.00
paid. Lower one of them." · "The parts take the whole $300.00, so nothing is left for <category>. Lower one of them, or
remove one." · "Money moved between your own accounts is not spending, so it cannot be split. ..."

After a save the green line names the parts: "Saved Kroger: $86.40 out, split: Shopping and clothes $26.40, Groceries
$60.00."; with the parts removed: "Saved Kroger: $86.40 out, Groceries, no longer split." A split purchase is one row,
"split: Shopping and clothes + Groceries" (three or more: "Shopping and clothes + 2 more"). A part left with both boxes
empty is not saved, and the green line says "(the empty part was left out)".

**Tags.** Kept lower case without "#" (`cleanTags`: "trip, kids" or "#trip #kids"); a row shows them as "#trip". Search
reads them: "#trip" finds a tag that starts with trip, a plain word looks inside tags as well as payee and note. A link
`#/transactions/ledger/month/2026-07?q=%23trip` (from Where the money goes) sets the search once;
`#/transactions/ledger/all?q=%23trip` is the same over every month. Both land on the lines with "Showing" shut (its one
line already reads "Jul 2026 · all accounts · all categories · “#trip”"); it opens as before on a tap. A list of tags is
read entry by entry, so "x, y" kept as one entry is two tags.

**Who reads the parts** (each counts a purchase once; `tests/split-tags.test.mjs` proves it over the 14 households and four
fixture plans with invented bank lines, `qa/fixtures/bank-lines.mjs`): this page, Where the money goes, Budget, Income
statement (and through them the Annual review, Financial statements and the Monthly check-in), Categories, Export.
**Who reads whole transactions** (byte-identical output for a split purchase, tested): Cash-flow statement, Categorize,
Rules, Transfers, Check a statement, Recurring, Subscriptions, Forecast, the AI categorizer and notes, the spending guesses.
The Monthly check-in does not add up transactions by itself (it counts lines and reads Where the money goes).
Known difference: the Cash-flow statement (`cashflow/statement`, another builder's page) puts a purchase under everyday
money or debt payments by its own category, so a split purchase with a "Loan and card payments" part goes there whole,
under its biggest part's kind. Its totals are right; only that one classification differs from Where the money goes and
the Income statement. Converting it is one line (`allLines(plan)` in place of `plan.transactions`) for that page's builder.
Not yet: the AI categorizer, asked to re-file every line of a payee, changes a split purchase's own category but not its
parts. Rules never do: see the Rules README.

Tests: `module.test.mjs` "gap #24 ..." (the formulas, every refusal, the form read back, removing the split, the category
totals, tags and search, the page: what is folded, a save, the green lines, the link) and "gap #24 fix ..." (the review
of 2026-11-14: counting once, the line under the parts, the empty part, the warnings); `tests/split-tags.test.mjs`.

## Paid back later, left out of reports, flagged, a refund of a purchase (gap #32, 2026-11-14, claude-b)
**By default nothing new.** The edit form's first boxes and its "More details (optional)" line are as they were. Under
that line, after Note, Tags and "Split this across categories", there are two more things, and nothing else:

- **How this counts**, one choice box. Money out: "As usual", "This will be paid back", "Leave out of reports". Money
  in: "As usual", "This is a refund of…" (only when there is spending at the same payee to pick), "That's the money
  back" (only when a purchase is waiting to be paid back), "Leave out of reports". The choices are short so that none
  is cut off in the box at 320 px; the sentence under the box says what each is for and what it will do (`markHelp`:
  "For money that work or a friend will pay back…", "For a one-time thing…"). A second box appears only for the two
  choices that name another line: "What was bought" / "The purchase it pays back". Money moved between your own
  accounts has no choice: it is in no total already.
- **Flag to look at later**, a tick box. Categorize lists the flagged lines; a flag changes no figure.

The line opens with "More details (optional)" open when it carries a mark or a flag. Save is still the form's one filled
button; opening, closing or picking writes nothing. Every save says what the mark did (`markSaid`, one sentence a case).
A row in the list says its mark in a pill ("to be paid back", "paid back", "money back", "left out", "flagged") and a
refund names its purchase ("refund of Hardware Store, 10/10"). When any line shown is left out, the totals card has one
outlined button under the three figures, "2 not counted (paid back or left out)" (`notCounted`); a tap lists just those
lines (`compute(plan, { only: "left" })`), says so ("Showing only the lines not counted in your spending or income: paid
back, or left out.") and offers "Show every line". The choice is kept with the page's other filters, never in the plan.

**On screen the words are "not counted"** ("Not counted in your spending or income."), never "in no total" or "money in
and money out" (review, 2026-11-14): the green line after a save is one short sentence, with a second one only when the
money back and the purchase differ. That difference is also said under "The purchase it pays back" as soon as a purchase
is picked, before Save (`backGap`: "This line is $640.22; the purchase was $48.00. Is this the same purchase?"; it follows
the Amount box as it is typed).

**A link can open one line**: `#/transactions/ledger/month/2026-10?edit=<id>` shows that month with the line's own form
open (Categorize's "Open it" on a flagged line); an id that is gone opens nothing.

**One path for the money back** (design log: one path only). The purchase is marked "This will be paid back" first; when
the money comes in, that line is opened and "That's the money back" picks the purchase. The purchase's own form then names
the money back. Setting either line back to "As usual", or deleting one, takes the pair apart: the purchase waits again,
the money back counts as money in again (`applyMark`, `unlinkGone`).

**Data** (all optional, read with a default, no version bump; `docs/DATA_MODEL.md`):
- `reimb`: `true` on a purchase that will be paid back; once linked, the id of the other line of the pair, on both lines.
- `exclude`: `true`, left out of reports.
- `flag`: `true`, to look at later.
- `refundOf`: on money in, the id of the purchase it is a refund of. For display only.

**Formulas** (`../splits.js`, `compute.js`):
- `leftOut(t)`: `t.exclude === true`, or `t.reimb === true`, or `t.reimb` a non-empty id. Only the values the app writes
  count; anything else kept in those fields (a plan edited by hand: `"no"`, `1`) leaves nothing out.
- `leftOutIn(transactions)` is what the pages read: `leftOut(t)`, except money in whose `reimb` names a line that is no
  longer in the list (an import undone, a plan edited by hand). With no purchase to pay back it counts as money in again;
  a purchase whose money back is gone waits again (still out, "to be paid back", and offered to "That's the money back").
  These are the same two outcomes as deleting the other line here (`unlinkGone`). `counted(plan)` is the whole
  transactions that are not left out, for a page that reads them whole.
- `linesOf(t) = leftOut(t) ? [] : partsOf(t)`; `partsOf(t)` is what `linesOf` was (the line, or one line per part of a
  split purchase). `allLines(plan)` drops the lines left out; with no split and no mark it is still `plan.transactions`
  itself. So every page that totals through `allLines` / `linesOf` leaves the line out: Where the money goes, Budget, the
  Income statement (and the Annual review and Statements, which read it), and this page's own Money in / Money out, which
  skip the same lines directly. `everyLine(plan)` keeps every line (Reports > Export, which adds a column "counts" saying
  "no: left out", "no: to be paid back", "no: paid back" or "no: money back", only when a line is left out).
- A paid-back pair: both lines carry `reimb`, so both are out: money out loses the purchase, money in loses the money
  back, and nothing is netted or counted twice. A purchase and its money back often fall in different months; leaving both
  out keeps each month's spending what it really was (this is why they are not netted in the category).
- A refund is not left out: a positive line in a spending category already comes off that category (the rule under "Money
  in, money out, kept" above; `cashflow/spending` does the same). `refundOf` only names the purchase. Picking the purchase
  sets the form's Category box to the purchase's category (it can still be changed before Save), so the refund comes off
  the same spending.
- `markChoices(plan, line)`: the purchases offered to "That's the money back" are those with `reimb === true` (and the one
  already linked to this line), newest first; the purchases offered to a refund are money out at the same payee (the same
  cleaned name, or the same first word of the bank's text), not a transfer, dated on the refund's day or up to
  `REFUND_DAYS` = 120 days before, newest first, `PICK_MAX` = 12 at most. Both limits are our choice (most shops take
  returns within 30 to 90 days; 120 leaves room for the refund to post), not a rule from anywhere.
- When the money back is less than the purchase, both lines are still left out whole. The form says so before Save
  (`backGap`: "This line is $80.00; the purchase was $120.00. The other $40.00 will not be counted as spending either.")
  and the green line after it ("Only $80.00 of the $120.00 came back; the other $40.00 is not counted either."). When the
  rest was the person's own share, the way to count it is to set both lines back to "As usual" and file the money back
  under the purchase's category, so it comes off that spending (kept here, not on screen: one sentence a case). More
  coming back than was paid asks "Is this really the same purchase?".
- A payment to a card whose own file is missing stands in for nothing once it is left out (`standInsOf`).
- A line left out waits for no category: it is not in `uncategorised` / `uncategorisedAll`, nor in Categorize's list.

**What still reads every line, on purpose:** the account's own pages (balance check, Reconcile, files' coverage,
duplicates, transfers, import): the money did move. The Categories page's "used by" counts (a line left out still carries
its category; `partsOf`).

**Also reading `counted(plan)` / `leftOutIn`** (review, 2026-11-14): the monthly check-in's count of lines with no
category (`overview/monthly-review`, so it agrees with Categorize), bills that come back (`cashflow/recurring` and the
calendar: a bill that is paid back is no bill to expect) and the month list of Where the money goes.

**Not done here (another builder's page; it reads `plan.transactions` directly):**
- `cashflow/statement` (`compute.js` line 101, "the bank files: the last twelve complete months"): read
  `counted(plan)` there instead of `plan.transactions`, or add `!leftOut(t)` next to `!isTransfer(t, plan)`.
Until then its bank-file figures count a left-out line as before. `tests/left-out.test.mjs` does not cover it.
`cashflow/forecast` (tax payments found in the bank lines), `ai/categorizer` and `transactions/rules` (counts of lines
with no category) also still read every line.

**Limits.** One money back per purchase (several friends paying back one dinner: file each under the dinner's category
instead, which nets it). A line removed by another page (an import undone, a duplicate removed) leaves the other half
of a pair naming a line that is gone: it is read as if the pair had come apart (`leftOutIn`, above), and the next save of
that line writes it so.

Our own design. Firefly III, GnuCash and Actual were looked at as references for the idea only (no code taken).

**Tests** (`module.test.mjs`, "gap #32"): `leftOut` / `linesOf`; an excluded line in no total (spec test 1); a paid-back
pair out of both sides (2); the refund link on the row (4); `markOf`, `markChoices` (the 120 days, the 12), `applyMark`
(each kind, each pair coming apart), `unlinkGone`; every sentence of `markPill`, `markHelp`, `markSaid`, `backGap`; the
stand-in; junk values and a pair whose other line is gone; `only: "left"`; on the page: the fold, each save and its green
line, the difference said before Save, the "not counted" button and its list, a link with `?edit=`, delete. `tests/left-out.test.mjs`: over the 14 households and four
fixture plans, invariance (spec test 5: no mark, same lines, same output from all the modules that read transactions),
every total on every page losing exactly the lines left out, and a flag or refund link changing no figure; the monthly
check-in, bills that come back, the calendar and the spending page's months leaving the same lines out. The flag in
the inbox (3) is in `../categorize/module.test.mjs`.
