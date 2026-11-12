# Import  (`transactions/import`)

**Status:** usable (phase 3): CSV, and OFX / QFX / QBO bank and card files (the "Quicken" or "QuickBooks" download, from 2026-11-11). JSON exports and investment statements in OFX are not read yet.
**Purpose:** Bring in the Quicken or QuickBooks file, or a CSV file, from your bank or card; nothing to set up for the first, columns worked out for the second; duplicates skipped, rules applied, the bank's balance offered.

## Inputs
Plan sections read (`needs`): `accounts`, `transactions`, `rules`, `importProfiles`. Writes: `transactions`, `imports`, `importProfiles`, `rules` (hit counts), `accounts` (an OFX file's balance, only when the person takes the offer).
`prepareImport(plan, text, { accountId, mapping?, flipSign?, importId })` does the whole job; `compute(plan)` only lists past imports.

## Outputs
`prepareImport` -> `{ parsed, mapping, headerKey, txs, add, skip, bad, dateFrom, dateTo, inTotal, outTotal, ruled, ruleHits }`.
`compute` -> `{ imports[] (newest first), accounts[] ({ id, name, type, count }), lastImport, total }`.

## How it works
1. `core/csv.js` reads the text (separator detection, quotes, BOM, title lines above the header).
2. `detectMapping(headers, rows)`: column names in several languages plus what the cells look like (dates parse, amounts parse). Debit/credit two-column files and "Type" (DEBIT/CREDIT) columns are recognised; a column of a few repeated words is never taken as the description. Date order (US month/day or day/month) is guessed from any day above 12. A saved profile for the same header row (`plan.importProfiles[headerKey]`) wins over detection.
3. `rowsToTransactions`: `parseDate` (MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY, "Sep 2, 2026", "2 September 2026", 20260902), `parseAmount` ("$1,234.56", "(12.00)", "12,34", "1.234,56", trailing minus), sign: single column as signed, type column flips positives to negative on debit words, `flipSign` reverses everything. Payee: `prettyPayee` (rules module) from the raw text; the raw text is kept in `rawPayee`.
4. Rules run (`applyRules`), then `dedupe` against `plan.transactions` by `txKey` and within the file.
5. On confirm the view appends `add` with fresh ids, records an `imports` entry (`importRecord`; undo removes by `importId`) and saves the mapping under the header fingerprint.
   - A file that names its currency in a Currency column (Währung, Moneda, Devise, Valuta, Divisa, Ccy) of three-letter
     codes keeps it on the record (`fileCurrency`: with several, the first that is not USD; 2026-11-06). The preview says
     "This file is in EUR, and your plan counts in USD. The amounts come in as they are, not converted." when it differs
     from the plan's. A record in another currency means the plan gets no U.S. guesses (core/estimate `applies`; guesses
     spec 4.8), until the file is undone.

- The preview says what the file covers (2026-11-01): "This file covers 8/12/2026 to 9/2/2026. Aug 2026 and Sep 2026 are only partly in it; the spending and budget pages say so." (`fileFrom`/`fileTo`: the first and last day of every row, duplicates included; a month counts as cut when the file starts after the 4th or ends before the 28th). Each import record keeps `from` and `to`.

## The account a file goes to (2026-11-02)
A file laid out like one imported before (`importProfiles[headerKey]`, saved on each import) goes to the account it went
to then, with a line saying so; before, the box always started on the first account, so next month's card file
previewed onto checking. Once the account is picked by hand it stays, and a different account than last time gets an
amber "check the account" notice. `alsoOn` flags a file whose lines (same day, amount and bank description) are already
on another account, 80% of them and at least 3: the same file imported on the wrong account first, which `dedupe()`
(within one account) would let in twice. It only warns: two real lines can match by chance.

## A file that starts after a gap (2026-11-02)
`gapBefore(plan, { accountId, fileFrom, fileTo, add })` (in every `prepareImport` / `prepareRows` result as `gap`): the
account's last day on file before this file (its latest line or import record `to` before `fileFrom`), then the hole
Transactions > Ledger `coverageByAccount` would see once this file is in (the plan with these lines and an import record
`fileFrom`..`fileTo`): the hole ending the day before `fileFrom`. So the rule is the ledger's: more than the account's slack
(3 days, `COVER_SLACK`, for an account with a line most days; wider for a sparse savings account) between the last day and the
file's first. `usual`: the account's monthly payments (cashflow/recurring `detectRecurring` over its lines and this file's)
whose usual day of the month (the median day of their dates) falls in the hole, money out first, then the largest, at most 3;
a mortgage or rent by its words or category, a salary as "a paycheck", anything else by its payee. Weekly and every-two-weeks
payments have no usual day of the month and are left out. Shown in the preview as an amber notice before the import button:
"Your last Chase checking lines end 7/30; this file starts 8/3. Anything on 7/31 to 8/2 is missing (your mortgage usually goes
out on the 2nd and a paycheck on the 1st). Bring in a file from 7/31, or add those by hand." (no parenthesis when nothing
usual falls in it; the "only partly in it" months line is left off then, the notice says it better).

Re-check 4 (2026-11-02): one rule for the pages and this warning. `gapBefore` warns only when the days before the file are a
hole by Ledger `coverageByAccount`'s rule (more than a quiet spell, `quietTooLong`: more than 7 days and more than 2 x the
account's usual spacing; or a usual monthly payment due in them with none of it that month; never for an account with lines
on fewer than 5 days). The usual payments now come from Ledger `usualPayments` / `usualInDays` (the monthly rule of
`detectRecurring`, moved there so both say the same; this module re-exports `usualInDays`). So "a gap within the slack
with a usual payment in it" is now simply a hole (`hole: true`), and 4 quiet days with nothing usual in them say nothing.

Opened with `?accountId=<id>` (the Monthly review's "Bring in the Visa file", Spending and Budget's card buttons), the page
starts on that account as if picked by hand, so a file laid out like another account's warns rather than switching it.
With `&need=2026-07-31..2026-08-02` (the Monthly review's "Bring in the Chase checking file" for a hole) step 1 says the days
the file must cover: "Bring in a Chase checking file that covers 7/31 to 8/2. On your bank's site pick those dates (or a
span around them): a "last 90 days" file starts on 8/4, too late." (the 90 days counted back from today).

Review (2026-11-02):
- `usualInDays(plan, accountId, from, to, add)`: the usual payments as above, now only those with none of their lines on file
  in the month their day falls in (a mortgage paid late, on the 5th, is not missing). `gapBefore` uses it, and also speaks for
  a gap within the slack when such a payment falls in it (`hole: false`): a Chase file from 11/4 after lines to 11/1 says
  "Anything on 11/2 to 11/3 is missing (your mortgage usually goes out on the 2nd and Ymca Afterschool Dayton on the 3rd)".
  The pages do not call those days missing (within the slack), so this is the one place it is said. The Monthly review uses
  it too, to not offer "Nothing happened" for days that hold a usual payment.
- The preview's "only partly in it" line keeps the month the file stops in when there is a gap warning (only the start month
  is left to the warning).
- `uncoveredDays(plan, accountId, from, to)` -> `[{ from, to, days }]`, in the result as `fills`: the file's days the account's
  files did not cover (before its first day, after its last, in a hole). A file with nothing new that spans them says
  "Everything in this file is already on file. It covers 9/1 to 9/30, including 9/11 to 9/19, which your Visa card files were
  missing: so nothing happened on those days." with "Count 9/11 to 9/19 as checked": an import record with no lines added
  (rows, skipped, from, to as for any file), so the gap closes. Past imports shows the Monthly review's "Nothing happened"
  entries (no file name, no rows) as "Nothing happened 8/1 to 8/19 · marked by you"; Undo asks "Forget that ... were checked?".
- Re-check 4 (page finding 9): such a file shows one message only. The "This file covers ... is only partly in it" line is left
  off (it sat next to "nothing happened"), and the message reads "Everything in this file is already on file. It covers 7/30
  to 8/3, so it shows nothing happened on 7/31 to 8/2, the days your Chase checking files were missing."

## OFX, QFX and QBO files (2026-11-11, `Prompt: quick-ofx-import`)
Most U.S. banks and card sites offer a "Quicken" (QFX) or "QuickBooks" (QBO) download beside CSV; both are OFX. Owner's request
of 2026-11-11 (connect accounts or upload statements, only where it is possible, easy and documented): the file needs no
column guessing at all, carries the bank's own id for each line and the bank's balance, and works on the phone with no PC.
- **Reader:** `core/ofx.js`, this app's own (no dependency, no copied code; written from the element names of the OFX 2.1.1
  specification, section 11). ofx-js (github.com/bradenmacdonald/ofx-js, MIT, "Copyright 2012-2017 Apps Attic Ltd.") was
  the library candidate and is not used. ofxtools is GPL-3 and was never opened.
  - OFX 1.x SGML (leaf tags never closed) and OFX 2.x XML read by one tree builder: a tag with text is a leaf; a tag with
    none is a box when it is a statement aggregate or the file closes it somewhere, else an empty leaf (`<MEMO>` alone).
  - **Detection by content**, never by the file's name (`isOfx`: an `OFXHEADER:` line, `<?OFX`, or `<OFX>` in the first
    4 KB). The picker's `accept` is broad (`.csv,.txt,.tsv,.ofx,.qfx,.qbo,text/csv,text/plain,application/x-ofx,
    application/vnd.intu.qfx`) because iOS greys out kinds it does not know; whatever comes in is decided by content.
  - **Characters:** the file is read as bytes and decoded by its header's `CHARSET` (`ofxCharset`: 1252 or ISO-8859-1 ->
    "windows-1252", else UTF-8; an XML `encoding=` wins). Bytes 0x80-0x9F are mapped by the WHATWG Encoding Standard's
    index-windows-1252 (encoding.spec.whatwg.org), because Node's TextDecoder reads "windows-1252" as ISO-8859-1.
  - **Dates:** `YYYYMMDD[HHMMSS[.XXX]][[-5:EST]]` -> the first 8 digits as `YYYY-MM-DD`; the time and the zone are ignored
    (the day the bank printed). DTPOSTED, else DTUSER. A day that does not exist is no date.
  - **Amounts:** TRNAMT keeps its sign (money out negative, card charges negative: the plan's own convention, so no flip).
    A thousands comma ("1,250.00") and a decimal comma ("12,50") are both read.
  - **Text:** `&amp; &lt; &gt; &quot; &apos; &nbsp;` and numeric references are decoded; a raw "AT&T" stays.
  - **Payee:** EXTDNAME when it is the longer text (NAME stops at 32 characters: OFX 2.1.1 `GenericNameType`), else NAME,
    else PAYEE's NAME, else MEMO; cleaned by `prettyPayee` like a CSV's, the bank's text kept in `rawPayee`. CDATA
    sections are read as text (their `<`, `>` and `&` are not tags).
  - **A file cut short** (`complete: false`: it does not end with `</OFX>`): a last line that was never closed is dropped
    (its amount may stop in the middle: "-14" of "-1450.00"), and the page says "This file looks cut short ... Download
    it again". A file that closes nothing at all is read the same way, as far as it is whole.
  - **Lines that cannot be read** (no date, no amount: "(1450.00)", "1.234,56", a day that does not exist) are left out and
    counted (`bad: [{ row, why }]`); the page shows them ("Could not read") and does not tick the balance.
  - **Accounts:** one per bank (STMTRS) or card (CCSTMTRS) statement: kind (checking, savings, card, credit line), last 4,
    CURDEF, LEDGERBAL (balance and its date), DTSTART/DTEND. Investment statements (INVSTMTRS) are said and not read.
- **Account numbers are never stored.** `parseOfx` returns only the last 4 (shown once, "Checking ending 7351", to help
  pick the account; never saved). Changed on 2026-11-12 (round-1 review B5, N5):
  - a line's id leaves the reader only as `lineId(FITID)`, a short one-way id (two 32-bit FNV-1a sums in base 36; FNV is
    public domain), because banks build FITIDs from the account number in ways no rule about digits catches
    (account 0040-2899-64 and the day, 20261104, written together as one id). The same FITID always gives the same id, so duplicates still match;
  - every account number of the file (each ACCTID, as written, as its letters and digits, without leading zeros, and
    written with dashes, dots or spaces) is taken out of NAME and MEMO ("..."), and so is a run of 6 or more digits right
    after acct, account, a/c, chk, checking, sav, savings, card, to or from (the other account of a transfer:
    "XFER FROM CHK ..."). Store numbers and check numbers stay (`scrubNumbers`);
  - the file name in the import record loses every run of 6 or more digits (dashes, dots and spaces between them
    included) and the account's last 4 (`safeFileName`: "0040-2899-64_activity.qfx" -> "XXXX_activity.qfx").
  The start screen's promise "No bank logins or account numbers, ever" holds.
- **Into the import:** `prepareImport` sends a file `isOfx` says yes to through `prepareOfx`, which feeds the chosen
  account's lines to `prepareRows` (rules, duplicates, totals, `gapBefore`, `uncoveredDays`, `alsoOn`), so the gap check and
  "count as checked" work as for a CSV. No column step and no saved layout (`importProfiles`) for OFX.
- **Which plan account** (`guessOfxAccount`, without the number; rewritten on 2026-11-12, round-1 review M1, P1, B2, N1,
  M4, B1, B3). **Decision: a file never goes to an account of another kind, and never to "the first account in the
  list".** A bank file may go to checking, savings or cash; a card file to a card; a credit line to a card or loan
  (`OFX_TYPES`, `ofxFits`). A 401(k), an IRA, a loan, a mortgage and a home are never offered for a bank or card file.
  Among the accounts the file may go to (`options`):
  - "holds": the one already holding at least half of the file's lines (the same day, amount and bank text, or the same
    line id with the same day and amount; an id alone proves nothing: two accounts' ids can repeat);
  - "kind": the only account of the file's own kind (a checking file and one checking account), unless the file holds two
    accounts of that kind, or the plan's account names another bank (the file says Prairie Bank, the account is "Chase
    checking" or at Chase): then nothing is picked and the page asks "This file is from Prairie Bank; Chase checking is
    at Chase. Is it this account?";
  - "name": among several of that kind, the one whose name or bank names the file's bank (`FI/ORG`);
  - else nothing is picked: "Which of your accounts is Card ending 8642?" with one chip per account it may go to and
    "It is not on my plan yet"; nothing is brought in until one is tapped. No account of that kind on the plan: "You have
    no card on your plan yet." and "Add this card".
  The page opened for one account (`?accountId=`, the "Bring in the Visa file" links) uses it only when the file's kind
  may go there; else "This file is from a checking account (ending 7351). Visa card is not a checking account. Pick the
  account it belongs to.", and behind a fold named "It is my Visa card file after all" (worded as the person's choice,
  not the page's verdict: final review F5) one outlined "Bring it in to Visa card anyway" (`force`: the lines, never the
  balance). A bank file brought in to another kind of bank account by hand (a checking file on Savings) is said
  (`otherKind`) and gets no balance offer. A new file or new pasted text starts the choice over.
  The page always says "This goes to <account>" with its reason above the Import button.
- **Several accounts in one file:** a box "This file holds 2 accounts. Bring in" (each with its line count); the first with
  lines not on file yet is offered; one at a time.
- **Duplicates** (`dedupe`; the id rules changed on 2026-11-12, round-1 review M8, M9, M10, B1). A line with the bank's id
  (`transactions[].extId`, `lineId` of the FITID) goes through three checks, each line on file standing for one incoming
  line at most:
  1. the id, within its account: the same id with the same amount and a day within 5 days is the same line (posted a few
     days after pending). The same id with another amount or day is not (a bank that gives every line the id "0", or
     builds ids from the day): the line comes in and its id is not kept.
  2. the key, as a count: the plan already holds a line with this key that no incoming line has claimed (the same lines
     downloaded again with new ids; a CSV of the same days). Two $4.50 coffees in one file both come in when the plan
     holds none, and one when it holds one.
  3. a cut name: a line on file in that account with the same day and amount whose bank text starts with this one's, or
     the other way round, 6 characters or more (an OFX NAME stops at 32 characters, a CSV's does not).
  A CSV line is checked by key as before, and by 3 against OFX lines on file. The same file twice adds 0.
- **The days a file covers** (M15): `fileFrom` / `fileTo` (and the import record's `from` / `to`) are the file's own
  DTSTART and DTEND when they are real dates that contain its lines, DTEND not after today; else its first and last
  line. A quiet week at a file's edge is then not read as missing days ("your last lines end 9/27; this file starts
  10/9" for two monthly files that say 9/1-9/30 and 10/1-10/31).
- **The balance** (`balanceOffer`, `setBalanceFromFile`): the file's LEDGERBAL, "Also set the balance of Prairie checking
  to $4,210.55, the bank's figure on 11/3/2026 (on file: $3,900.00)". With lines to add it is a box above the Import button
  (one tap does both); with nothing new it is its own button. A card's balance is what is owed, |BALAMT| (card files send
  it negative), and keeps the sign the account is stored with (balance/accounts `saveBalance`). The figure on file is kept
  as a point of its own day (Update my balances' `keepOnFile`), and a guess on that balance is dropped.
  Rules (2026-11-12, round-1 review M1, P1, N1, M4, M11, N6, N7):
  - **Never across kinds:** offered only when the plan account's type is the file's own kind (`ofxOwn`: a checking file
    and a checking account, a card file and a card). A card's -6,522.17 is never a checking or 401(k) balance; a checking
    4,512.36 is never "owed" on a card or held in savings.
  - **Ticked for you only when the account is sure**: the guess is "holds" or "name", every line was read, the file is
    whole, the account is not Get started's one "Credit cards" line for every card (`isCardLump`: one card's file is not
    all the cards' balance), and the figure needs no question. Otherwise the box is there, unticked.
  - **A card in credit:** a card file whose charges are negative (half its lines or more, or no lines to tell by: a file
    with one charge and one payment is asked too, fix round 2) and whose BALAMT is positive may be a credit, or an
    issuer that writes what is owed as a positive figure; the sign cannot be trusted, so the page asks "The file says
    $25.17 ... Is that what you owe, or a credit (the card owes you)?" ("I owe $25.17" / "It is a credit": saved as $0
    owed, since the plan counts a card as what is owed).
  - **Its date:** not after today. A date one day ahead (an evening download stamped in GMT) is today's; further ahead is
    not offered. Not offered when the plan's balance is dated after the file's, or the same figure is on file for that day.
- **Undo puts the balance back** (M1, P5, B4): an import that set a balance keeps what it replaced on its record
  (`imports[].balance: { was, wasAsOf, set, setAsOf, point?, kept?, guess? }`). Undo (`canUndoBalance`, `undoBalance`)
  restores the balance, its date, that day's earlier point, removes the point `keepOnFile` added and brings back a
  dropped guess, while the account still holds exactly what the import set; its question and its confirmation say so
  ("... and put Checking's balance back to $6,000.00 (11/11/2026)?"). A balance changed since is left alone, and said.
- **On the page** (P15, simple first): one filled "Choose the file" and the line "If your bank offers "Quicken" or
  "QuickBooks" (.qfx, .qbo), take that one: nothing to set up. Otherwise take CSV."; pasting sits behind "More options";
  the account is asked after the file and only when the file cannot tell (a CSV always asks, bank and card accounts first,
  never a home or a car unless lines are on it).
- **Simple first** (the owner, 2026-11-12 and 2026-11-13; fix round 2). The preview's first view is the answer and one
  action: which account the lines go to (and why), the bank's balance as one box above the button, and the filled
  "Import N transactions". The counts ("Will be added", "Already on file", "Filed by your rules"), the days the file
  covers, the money in and out and the first rows wait behind "See the lines", whose summary says how many are new, how
  many are already on file and how many could not be read (rows that could not be read open it on a CSV, and are said in
  a notice above for a Quicken file). A CSV's "Columns found" line sits inside its columns fold. "Past imports" (with
  Undo) is a folded card whose summary says how many files. Warnings (a gap, a file cut short, another kind of account,
  another bank, another currency) are never folded. A fold opened on this visit stays open when the preview or the page
  is drawn again (kept in the page's memory, never saved): "More options", the columns, "Not this account? Change it",
  "It is my ... file after all", "See the lines" and "Past imports". A new file or new pasted text starts the preview's
  folds closed again (and forgets an "Amounts look backwards" tick made for the file before).
- **A summary with a status** ("See the lines" with "1 new · 1 already on file · 4 could not be read", the columns with
  what was changed) keeps its title on one line and lets the status wrap at the right, inside the card, so nothing runs
  off a 320 px screen and the page never scrolls sideways (fix round 3, F2; the rule is in the page's own style, since
  `core/ui/base.css` keeps a status on one line).
- **Columns changed by hand** (a CSV; fix round 3, F4). `prepareImport` keeps what the file works out with nothing
  changed (`auto`: the columns, the sign, and how many rows they leave unread; a layout saved from an earlier import is
  what it works out), and `columnChanges` says what differs. The columns fold then reads "Columns: changed by you" with
  the change as its status ("dates day/month/year", "amounts turned around", "description column: none", or "2
  changes"; the "Amounts look backwards" box counts only when ticked or unticked by hand, since left alone it follows
  the columns chosen), and stays open while the person works in it. A change that leaves more rows unreadable than the app's own
  choices opens it with an amber "With this change, 6 rows could not be read; the app's own choices read every row." and
  an outlined "Put back what the app worked out", and the Import button steps back to outlined until it is fixed (one
  filled button at most; a caution is never it).

## Edge cases
No accounts: the page asks for one first. Unreadable rows are counted and listed (no date / no amount), never imported. A file already fully on file: "nothing to do". Pasted text works like a file.

## Tests
`tests/ofx.test.mjs` (invented files inline: an SGML checking export, an XML card export with charges negative, a file with
two accounts, a CHARSET 1252 file, dates with zones): detection by content; dates, amounts and entities; each file's
accounts, last 4 only, balances and lines; a missing `</STMTTRN>`; 1252 bytes; the import (no column step, the account
guessed, prepareRows, the balance offered) and the gap check; duplicates by FITID (the same file twice adds 0, a renamed
line), by key with no FITID, against a CSV line; two accounts in one file; the account guess; the balance offer and its
point; no account digits (full or last 4) anywhere in the plan after import, and the file name masked. Round-1 review
(2026-11-12), named by finding: M1/P1/B2 (a card file with no card on the plan: no account, no offer, the 401(k)
untouched; by hand on checking, the 401(k), the loan: a mismatch; "anyway" brings lines and no balance), P1c/N1 (a
checking file on Savings or the Visa card), M4 (another bank's file; ticked only for "holds" or "name"), P1d (the cards
lump), B3 (two checking accounts in one file), B1/M10 (ids that repeat), M8/M9 (a CSV then the bank's file with names cut
at 32; new ids; EXTDNAME), M11 (a card in credit), M15 (four monthly files, no gap), N7 (a balance dated tomorrow, next
year), B6/N6 (a cut file, unreadable lines, CDATA, no closing tags), B5/N5 (no account number in text, id or file name),
M1/P5/B4 (Undo restores the balance: same day, an older date with its kept point, a guess, a card's sign, a balance
changed since).
`module.test.mjs` with `qa/fixtures/chase-checking.csv`: date and amount formats, mapping detection (single amount, debit/credit, type column), payee cleaning, keys, bad rows, flipSign, dedupe, rules and hit counts, profile reuse, totals. The gap warning: a file 5 and 4 days after the last line (with the rent of the 22nd named), 3 days (none), no usual payment (no parenthesis), the last import's `to`, an account with nothing on file; the sample family's 90-day file after July's lines (`qa/fixtures/card-gap-plan.mjs`), word for word (2026-11-02). F4 (fix round 3): `columnChanges` empty with nothing changed, the date order, the sign (ticked, and a card file's own tick taken off), the money columns as one change (also on a card file whose sign then follows them), a column set to none, and a saved layout counted as the app's own; `auto.bad` beside the rows a change leaves unread.

## Ideas / not yet
- Positions from OFX investment statements (INVPOSLIST + SECLIST) on Holdings, with the same reader, after claude-h's review
  rounds there. JSON exports.
- Balance check: the file's running balance against the account's balance.
- Bank connections (SimpleFIN) through the server: `transactions/connect`.

## Stress test fixes (2026-11-11, claude-d)
- After a file is read (or pasted text used) "3. Check and import" comes to the top of the screen, and the Import button sits
  right under the counts, before the sample rows. The same file can be chosen again.
- "Use the pasted text" with an empty box says "Paste the file's text in the box first." at the box and leaves a chosen file alone.
- `looksLikeBankFile(parsed)` (compute.js): a line with a date in one cell and an amount in another, in either date order.
  When it says no but `parsePositions` (investments/holdings/compute.js) finds rows, the file is a brokerage positions file:
  the page says so and links to Holdings instead of the "not a bank file" error.
- The Import button (it carries the count) sits before the three tiles, so it is on the first screen at 320 px too.
  Text that has none ("hello world") gets one plain error, no column pickers and no tiles of 0; "already on file" is said only
  when lines were read and all matched. Column names nobody recognises still reach the pickers.
- With no account yet: a card with a filled "Add the account" button instead of a 19 px link It comes first in the card and opens
  `#/balance/net-worth?add=checking&from=import`, so Net worth opens its add form on checking and, after the save, offers
  "Now import the bank file ›" back here (review N4); the card says to tap it.
- "Added 10 transactions from x.csv. Now give them a category." on Categorize (its exported `say`), and Undo of an import says what it removed.
