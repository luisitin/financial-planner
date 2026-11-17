# Import  (`transactions/import`)

**Status:** usable (phase 3): CSV, and OFX / QFX / QBO bank and card files (the "Quicken" or "QuickBooks" download, from 2026-11-11), the history YNAB, Monarch and Mint let you download (from 2026-11-14), and older Quicken QIF files and European banks' CAMT.053 statements (from 2026-11-14, gap list item 43). JSON exports and investment statements in OFX or QIF are not read yet.
**Purpose:** Bring in the Quicken or QuickBooks file, or a CSV file, from your bank or card; nothing to set up for the first, columns worked out for the second; duplicates skipped, rules applied, the bank's balance offered.

## Inputs
Plan sections read (`needs`): `accounts`, `transactions`, `rules`, `importProfiles`. Writes: `transactions`, `imports`, `importProfiles`, `rules` (hit counts), `accounts` (an OFX file's balance, only when the person takes the offer).
`prepareImport(plan, text, { accountId, mapping?, flipSign?, importId, fileAccount?, categories?, formats? })` does the whole job; `compute(plan)` only lists past imports. Another app's file (gap #33) also reads and writes the optional `importProfiles[].accounts` and `.categories`, writes `imports[].categories` and may add to `categories`.

## Outputs
`prepareImport` -> `{ parsed, mapping, headerKey, txs, add, skip, bad, dateFrom, dateTo, inTotal, outTotal, ruled, ruleHits }`.
`compute` -> `{ imports[] (newest first), accounts[] ({ id, name, type, count }), lastImport, total }`.

## How it works
1. `core/csv.js` reads the text (separator detection, quotes, BOM, title lines above the header).
2. `detectMapping(headers, rows)`: column names in several languages plus what the cells look like (dates parse, amounts parse). Debit/credit two-column files and "Type" (DEBIT/CREDIT) columns are recognised; a column of a few repeated words is never taken as the description. Date order (US month/day or day/month) is guessed from any day above 12. A saved profile for the same header row (`plan.importProfiles[headerKey]`) wins over detection.
3. `rowsToTransactions`: `parseDate` (MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY, "Sep 2, 2026", "2 September 2026", 20260902), `parseAmount` ("$1,234.56", "(12.00)", "12,34", "1.234,56", trailing minus; since 2026-11-14 commas every three digits with no point, "1,234" or "$12,500", are thousands: money has two decimals, so a comma before three digits is never the cents), sign: single column as signed, type column flips positives to negative on debit words, `flipSign` reverses everything. Payee: `prettyPayee` (rules module) from the raw text; the raw text is kept in `rawPayee`.
4. Rules run (`applyRules`), then `dedupe` against `plan.transactions` by `txKey`, as a count: each line on file stands
   for one line of the file, so two identical purchases on one day both come in (2026-11-14; before, the second was dropped).
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

## Another app's history: YNAB, Monarch, Mint (2026-11-14, gap #33)
A person moving from another budgeting app brings years of lines already sorted. Three of those apps let you download them
as a CSV: YNAB (its register), Monarch (its transactions) and Mint (closed in 2024; old exports are still around).
- **What the page shows.** Nothing new until a file is chosen. For one of the three, the columns fold's title says whose
  file it is: "This looks like a YNAB file. Columns worked out for you. Change them". Inside it, as today, the column
  boxes, and under them "YNAB's categories" (below). A file whose account column names its accounts asks, above it, which
  of yours each one is (below). Everything else is the CSV preview as it was: the Import button, the warnings, "See the lines".
- **Header sets** (`formats.js FORMATS`), from public descriptions of these exports (the gap spec's, read 2026-11-13 from
  third-party converters and parsers), **not from a real export**: the sites of the three apps could not be opened from
  the build session on 2026-11-14. So the matching is tolerant: case, spacing and punctuation of a column name, the order of
  the columns and extra columns do not matter; a file is one app's only when its header names every column that app must
  have, each once, and no other app's (`matchHeaders`); and with those columns at least 9 rows in 10 must read a date and
  an amount (`readFormat`). Otherwise the file is read as any bank file, exactly as before (`formats: false` is that path;
  `tests/import-formats-invariance.test.mjs` compares the two on every bank file the qa folder holds, on every account of
  every invented household).
  | app | must have | also read |
  |---|---|---|
  | YNAB | Account, Date, Payee, Outflow, Inflow | Category (or YNAB 4's Sub Category: the leaf), Category Group (or Master Category), Memo |
  | Monarch | Date, Merchant, Category, Account, Original Statement, Amount | Notes, Tags |
  | Mint | Date, Description, Original Description, Amount, Transaction Type, Category, Account Name | Labels, Notes |
- **The lines** (`formatRows`, beside the CSV's `rowsToTransactions`, which is untouched):
  - amount: YNAB `Inflow - Outflow` (both positive; "$0.00" when unused); Monarch's Amount as signed in the file; Mint's
    Amount with "debit" in Transaction Type made money out (the CSV's own type rule). Read by `appAmount`: parseAmount,
    except that commas every three digits with no point ("1,234", "$12,500") are thousands (parseAmount alone reads
    "1,234" as 1.234, a comma before the cents; these apps are American and write two decimals; a comma before one or two
    digits, "12,5" or "12,34", is still the cents). Since 2026-11-14 parseAmount itself reads them so, for every file;
  - the sign is the app's, on every account: nothing is turned around for the person. Each app writes money out as money
    out on a card too (YNAB's Outflow, Mint's "debit", Monarch's minus sign), so `suggestFlip`'s card rule (a card file
    with mostly positive amounts lists charges as positive) does not apply: a card's month with more payments than
    purchases is not backwards (critic M1, 2026-11-14). "Amounts look backwards" still turns them by hand. A file with
    account names never uses the sign saved for its layout (a tick for the card would turn checking around too); one
    without uses it, as any file;
  - payee: the app's clean name (YNAB's Payee, Monarch's Merchant, Mint's Description) as written; `rawPayee`: the bank's
    text (Original Statement, Original Description; YNAB has none, so its payee). While a person changes the description
    or money columns under "Change them", those are read as any bank file's;
  - `note`: Memo or Notes; `tags`: Tags or Labels through `splits.js cleanTags` (comma separated, lower case);
  - YNAB's "Starting Balance" rows (its opening figure for an account) are left out and said in "See the lines": they are
    not money in;
  - YNAB writes a purchase split across categories as one row per part, memo "(Split 1/3) ..." (public descriptions). A
    whole run 1 to n of one day and payee becomes one transaction with `splits` (splits.js; its category the biggest
    part's, `mainCategory`), so its key is the purchase's own and a bank file's line for it is a duplicate; anything else
    stays rows. YNAB's flags (colours) are not read.
- **One import per account name** (`fileAccounts`, `fileAccount`). The file's names in the order they first appear, each
  with its rows. The plan account for a name is the person's pick; the page picks only (`formats.js pickAccount`) the one its
  lines went to last time (`importProfiles[headerKey].accounts`, keyed by a one-way `accountKey`: an app's account name
  can carry its last digits, "Checking (...6789)", so the plan never keeps the name), or the only plan account with the
  same name (letters and digits, a masked number at the end aside). Else "Which of your accounts is "Rainy day savings"?"
  starts on "Pick one" and nothing comes in until one is picked: the Import button is there all the same (the one filled
  button of the step) and, tapped, says at the box "Pick which of your accounts these lines go to first, or tap "It is not
  on my plan yet"." (`pickFirstWords`). The box offers bank and card accounts (`APP_ACCOUNT_TYPES`: checking, savings,
  cash, credit), and another kind only when the page picked it, was opened for it, or it holds lines already: a budgeting
  app's history is spending, never a 401(k) or a home's lines (critic P5). "It is not on my plan yet" (an outlined button,
  shown while nothing is picked) opens Net worth's add form (credit, savings or checking by the name's words) with the
  file's name for it (`?name=`, its masked number left off and capitals put in ordinary case), where the balance may be left
  empty (Net worth's README, "Opened to do one thing"); the file waits here (below), and back on this page the one account
  added meanwhile is picked for that name ("Picked for you: the account you just added for it."), whatever it was called.
  The first name brought in by default is the first that has no account picked yet or lines not on file yet. Each import is
  its own record (Undo per account), `rows` counting that account's rows (`rowsIn`). A name written in capitals (Mint's
  "CHECKING") is shown in ordinary case ("Checking", `tidyName`); the box over the names reads "This file has 3 accounts.
  Choose the one to bring in now" (`fileAccountsWords`).
- **The file stays for the next account.** After an import with names left, the page stays on the file with the next one
  ("Added 9 transactions from register.csv to Chase checking. 5 of them kept their YNAB category. Next in this file:
  "Visa card" (5 lines). If you leave this page, choose the file again for the rest.") instead of going to Categorize;
  after the last it goes there as always. The file, the names brought in and the choices made are kept in the page's
  memory only (`held`: never saved, never sent), for 30 minutes, and used by the next drawing of the page: also when the
  person comes back from adding an account on Net worth. Leaving the page otherwise, or reloading it, drops it, and the
  green line says so (critic P3); chosen again, the file opens on the first account with lines not on file yet.
  "Choose another file" forgets it. Decision: one at a time (as the OFX file with several accounts), so the account
  question is one box, not one per account.
- **Categories** (`formats.js fileCategories`), before the rules (a line with a category is left alone by `applyRules`; the
  rules file what is left). The file's category on each line is **mapped by name** (`categoryByName`): the same name as a
  category of the plan's list, its id, or a part of its label split at commas, slashes, "and" and "or" ("Rent" and
  "Mortgage" are "Rent or mortgage", "Interest" is "Dividends and interest", "Gas" is "Car, gas, transit"), compared by
  `catKey` (letters and digits, "&" and "and" alike, a plural dropped). Two hits: the one of the lines' kind (money in is
  income). A transfer's own names ("Transfer", "Credit Card Payment", "Balance Adjustments") and YNAB's payee
  "Transfer : Savings" with no category are "Transfer between my accounts", so a card payment is never spending twice.
  YNAB's "Ready to Assign" ("To be Budgeted", its Inflow group) and "Uncategorized" are no category: those lines wait on
  Categorize, as any bank line. Hidden categories are never picked. No list of other words is used: a name that is not on
  the plan's list is never guessed.
  **On request**, inside "Change them": "YNAB's categories", one sentence (`categoryLine`, one per case), the names that
  match ("Same name on your list: Groceries, Mortgage."), and one box per name that does not: "Leave its lines for Categorize"
  (the default), "Add it as a new category", or any of the plan's. A new one gets a free id (`slug`, "-2" when taken) and
  the kind of its lines (half or more money in: income, else spending), and is added only when a line to add uses it.
  "Add it as a new category" for a name the list already has (by its label, `catKey`) is that category: the choices carry
  on from one of the file's accounts to the next, so the second account's lines join the "Coffee Shops" the first one
  added instead of a second "Coffee Shops" (critic M2). The
  choices made are kept for the layout (`importProfiles[headerKey].categories`: only those that differ from the name
  match, a new one by its id), so next month's file maps itself. The import record keeps the categories it added
  (`imports[].categories`); Undo takes off those nothing uses any more (no line or split part, rule or budget:
  `undoCategories`), and its question and green line say so (`undoCategoryWords`, `goneWords`).
  Decision: the names that match come with the lines by default and nothing else is guessed, so the page looks as before
  and a wrong guess is never made; the person who wants their old app's categories opens "Change them".
- **Duplicates**: the importer's own key (`txKey`: account, day, amount, payee text), counted (`dedupe` with `counted`:
  each line on file stands for one line of the file). The same file twice adds nothing; a longer export adds only its new
  days; a bank's own file of the same day, amount and payee text is the same line. Two identical lines on one day in an
  app's file are two purchases (two $4.50 coffees): an app's history is its ledger, line by line (critic M3); the plan
  holding one of them, one comes in. Since 2026-11-14 every file's lines without a bank id are counted the same way (before,
  a bank CSV dropped a second identical line in the same file: two $2.90 subway fares on one day came in as one).
  A YNAB file brought in as any bank file before this (before 2026-11-14) holds a split purchase as its parts: a merged
  purchase whose parts' keys are all on file is on file (`mergeSplits` `partKeys`, `finish` `alsoOnFile`), so it is never
  counted twice (critic M4). That older import's "Starting Balance" line stays on the plan as money in: undo that import
  under Past imports and bring the file in again for a clean start.
- **The words.** The green line after each import (`formatSaid`, one sentence per case: how many kept the app's category,
  none, all or some; the next account, or how many still need a category); "See the lines" adds the "Filed for you" tile
  ("7 by YNAB's categories, 2 will need one") and `formatNotes` (starting balances left out, split purchases put together).
- **Not in the plan**: the file itself, its account names, the page's memory of it.

## QIF and CAMT.053 files (2026-11-14, gap list "next 60", item 43; map J3, J4)
Two more files that need no column step, read like an OFX file: **QIF**, the Quicken Interchange Format text file older
Quicken, Microsoft Money and many banks still write, and **CAMT.053**, the ISO 20022 "bank to customer statement" XML
European banks give (camt.052, the day report, and camt.054, the notice, hold the same entries and are read the same way).
- **What the page shows.** Nothing new until a file is chosen, but for the line that names the files the page reads
  ("... Otherwise take CSV. Files from older Quicken (.qif), European banks (.xml), YNAB, Monarch or Mint work too.", no
  more words than before; fix round P2: no format name a bank's download page does not show). The picker also takes `.qif`
  and `.xml`. A QIF or CAMT file then gets the Quicken preview
  exactly as an OFX file does (the code is the same: `prepareParsed`, below): which account it goes to and why, or the
  account chips; for CAMT the bank's closing balance as the one box above the button, only when the file counts in the
  plan's currency; another currency said in one line ("This file is in EUR, and your plan counts in USD. The amounts come
  in as they are, not converted, and the bank's balance is left alone.", the last clause when the file has a balance), and
  the file's lines, totals and first rows shown in the file's own currency ("-€45.50"; fix round P1); a
  file cut short said; the filled "Import N transactions"; and inside "See the lines" the notes below (`notes`, one
  sentence per case), each first row's note under it ("10/12/2026 · bank wrote: City Power · Check 1042", fix round P4).
  The one new reason is "This goes to Joint checking, the account with the same name." A QIF with
  only an investment account gets the existing "This file is for an investment account ..." with "Go to Holdings".
  The "Filed by your rules" tile reads "Filed for you" for a QIF file (its lines also bring their Quicken category).
  A QIF file whose dates do not settle their order asks, above the account: "In this file, is 11/1/2026 November 1 or
  January 11?" with two chips, the order read pressed (no example date when none reads two ways: "Which comes first in
  this file's dates?" "The month" / "The day"). Tapping one reads the file again that way; nothing is saved until Import,
  and the question stays so the answer can be changed back (fix round F1, F2). The "Not Joint checking? Add the account it
  belongs to" link is 44 px tall (fix round P3).
- **Code.** `qif.js` (`isQif`, `qifDate`, `qifDateOrder`, `qifDateCheck`, `qifAmount`, `qifDecimalMark`,
  `qifCategoryName`, `parseQif`) and `camt.js`
  (`isCamt`, `readXml`, `parseCamt`), both pure and dependency-free but for core/ofx.js's `decodeEntities`, `lineId` and
  `scrubNumbers`; no DOMParser (it does not exist in Node). Both return parseOfx's shape (`{ ok, complete, org, accounts:
  [{ kind, last4, currency, balance, balanceDate, from, to, rows, bad }], investment }`). `compute.js`: `prepareOfx` keeps
  its exact output and its body became `prepareParsed(plan, parsed, kind, opts)`, shared by `prepareQif` and
  `prepareCamt` (`kind` "qif" / "camt" on the result); `prepareStatement` picks one of the three by what the file holds;
  `isStatement`; `decodeFile` (below); `prepareImport` sends a QIF or CAMT file the same way (`statements: false` is the old
  path, for the invariance test); `ofxRows` carries a QIF or CAMT line's `shown` payee, `note`, `category` and `splits`
  into `prepareRows`, which keeps them (an OFX line has none of them, so it reads exactly as before). New file kinds in
  `OFX_TYPES` / `OFX_OWN`: "bank" (QIF's Bank: checking, savings or cash; its own kind checking or savings, so with one
  checking and one savings account on the plan the page asks), "cash" (cash only), "other asset" (Quicken's Oth A:
  something else you own) and "other debt" (Oth L, and a CAMT LOAN account: a loan, mortgage, student loan or other debt).
  `guessOfxAccount` has one more reason, "same": a file that names its account (QIF's `!Account`) and exactly one plan
  account of a kind it may go to with that name (letters and digits, case and a masked number at the end aside, as
  formats.js `pickAccount`), checked after "holds". `importRecord` masks every statement file's name as an OFX file's
  (`STATEMENT_KINDS`; "camt053_DE...4821_20261031.xml" -> "camt053_DEXXXX_XXXX.xml").
- **Where the formats were checked (2026-11-14).** No current figure (a rate, a cost, a limit) is involved: these are file
  layouts. intuit.com/quicken.com and iso20022.org could not be opened from the build session (its network allows
  irs.gov and the package registries only). So:
  - CAMT's element names come from the ISO 20022 schema files themselves, `camt.053.001.02.xsd`, `.08.xsd` and `.13.xsd`,
    shipped in the package camt-parser 2.1.0 (MIT; registry.npmjs.org, read 2026-11-14): `ReportEntry2` / `10` / `15`
    (`NtryRef`, `Amt` with `Ccy`, `CdtDbtInd`, `RvslInd`, `Sts`, `BookgDt`, `ValDt`, `AcctSvcrRef`, `NtryDtls`,
    `AddtlNtryInf`), `EntryTransaction2` / `10` (`Refs`, `AmtDtls/TxAmt/Amt` in .02, `Amt` and `CdtDbtInd` from .08 on,
    `RltdPties`, `RmtInf`, `AddtlTxInf`), `TransactionParty2` (`Dbtr`, `UltmtDbtr`, `Cdtr`, `UltmtCdtr` with `Nm`) and
    `TransactionParties6` (`Party40Choice`: `Pty/Nm`), `EntryStatus2Code` (BOOK, PDNG, INFO) and `EntryStatus1Choice`
    (`Cd`), `CashBalance3` (`Tp/CdOrPrtry/Cd`, `Amt`, `CdtDbtInd`, `Dt`) with `BalanceType12Code` (CLBD closing booked,
    among OPBD, ITBD, CLAV ...), `AccountStatement2` (`FrToDt`, `Acct`, `Bal`, `Ntry`), `CashAccount20` (`Id/IBAN` or
    `Id/Othr/Id`, `Tp/Cd`, `Ccy`, `Svcr/FinInstnId/Nm`), `CreditDebitCode` (CRDT, DBIT) and the amount type (a decimal, 0
    or more). The account type codes (SVGS, LLSV, ONDP, MOMA savings; LOAN; CACC and the rest current) are ISO's external
    code list as known to the builder; it is not in the schema and could not be read this session.
  - QIF's field codes and layout are Intuit's published description as known to the builder, checked against the package
    qif2json 0.4.0 (MIT; registry.npmjs.org, read 2026-11-14): its README ("dates are normalised ... `/`, `'` become `-` and
    spaces are removed"), its parser's codes (D, T, U "a legacy repeat of T", N, M, A, P, L, C, S, E, $) and its test
    files (`normalTransactions.qif`: "D6/ 1/94", "L[linda]", a split with S and $ lines; `investments.qif`: !Type:Invst;
    `windows-1252.qif`: a file in that code page). No code from either package was copied; they are MIT all the same.
  The tests read invented files only (`tests/qif-camt.test.mjs`); no real export was seen. The README says so, the readers
  are tolerant, and a file that does not read says so instead of guessing.
- **QIF, the rules.**
  - Detection: the first line is a header (`!Type:`, `!Account`, `!Option:`, `!Clear:`), never the file's name.
  - Sections: `!Type:Bank`, `CCard`, `Cash`, `Oth A`, `Oth L` hold lines (kinds bank, card, cash, other asset, other debt;
    a Bank account named for savings is savings). `!Type:Invst` is counted (`investment`) and never read: it is not
    spending. `!Type:Cat`, `Class`, `Memorized`, `Prices`, `Security` and the `!Option:AutoSwitch` account list are passed
    over. An `!Account` block's N names the next line section (Quicken's whole-file export); a section of the same type
    with no new `!Account` carries on the account before it.
  - Records: one per "^". D date, T amount (else U, else the sum of the split amounts), P payee, M memo, L category, N
    number, S / E / $ a split's category, memo and amount; C, A, F and the rest are not used. A record still open at the
    end of the file is dropped and the file is called cut short (`complete: false`): its amount may stop in the middle.
  - Date: spaces dropped first (Quicken pads with them: " 6/ 1/94", "1/ 5' 6"); day and month, then "/", "-", "." or "'",
    then the year: four digits as written; one or two after "'" are the 2000s (Quicken's mark: 1/15'26 is 2026); two after
    another separator are 19xx from 70 up, else 20xx (6/1/94 is 1994, 1/15/26 is 2026). Also 2026-01-15 and 20260115. A
    day that does not exist is no date.
  - Day first, from the file (`qifDateCheck`): a date whose first number is above 12 can only be day first, one whose
    second number is above 12 only month first; the order more of them show is read (fix round F1: before, the first such
    date decided, so one stray "13/6/2026" among "11/1/2026" lines turned every date round); when none tells, or as many
    each way, dots ("15.01.26", Europe's way) mean day first, else month first (Quicken's U.S. default). The file settles
    it (`sure`) when no date reads two ways, or two or more dates can be read only that way and none the other. Decision:
    two, so that one stray date (a line typed by hand, a typo) never decides a whole file unasked. Otherwise the page asks
    (`dateAsk`, above), with the first date that reads two ways as the example (Quicken's padding spaces dropped and the
    year in full: "10/ 1'26" is asked as "10/1/2026"), and `opts.dateOrder` (the answer) is used
    from then on, on the preview and on Import. Said when settled and day first: "This file writes the day before the
    month, and its dates are read that way."
  - Amount: "-1,234.56" and "1,234" (thousands commas), "-1.234,56" (dots between thousands, a decimal comma), "12,50", a
    "$" anywhere. A first group of "0" is never thousands: "0,500" is 0.50 (fix round F3). The file's own decimal mark
    (`qifDecimalMark`: "," when some amount ends in a comma and one or two digits and none in a dot and one or two; "."
    the other way round) settles the rest: in a file of decimal commas "1.234" is 1,234.00; in any other file it is 1.234,
    as before. The sign as Quicken writes it: money out negative, a card's charges too (the plan's own convention).
  - A line for 0.00 (rounded to the cent: a voided check, Quicken's "**VOID**", a note; "-0.004" too) is left out and said:
    "1 line for 0.00 was left out: it moves no money." (fix round F4; it is never brought in as 0 or -0).
  - Payee: P as written when it has small letters (a name kept in Quicken: "Dr. Lee Dental", "McDonald's", which
    prettyPayee would cut), else prettyPayee ("CORNER COFFEE #12" -> "Corner Coffee"); rawPayee: P. No P: "Check 1042" for a
    check number, else the memo. Entities some programs write ("AT&amp;T") are decoded; a run of 6 or more digits after
    "to", "from", "account" ... is taken out (core/ofx `scrubNumbers`).
  - Note: the memo, "Check 1042" (a check number beside a payee) and the split note, joined by "; ".
  - Category (`qifCategory`): the class after "/" dropped; "[Savings]" is a transfer between your own accounts
    (`transfer`: neither spending nor income); "Auto:Fuel" is looked up whole, then by its last part, then its first, by the
    plan's own names only (formats.js `categoryByName`, the YNAB reader's: the same name as a category's label, its id, or a
    part of its label, a plural dropped). A name the plan does not have ("Salary" is "Pay from a job" there) and
    "--Split--" give none: the line waits on Categorize, as any bank line. Decision: nothing else is guessed, and there is
    no QIF category box (YNAB's "Change them" has one): rules file what is left, as for an OFX file.
  - Splits: one line of the record's total. `splits` ([{ category, amount }], splits.js) when every part has one of the
    plan's categories, there are two or more of them and the parts add up (`splitsOf`), with `category` the biggest part's
    (`mainCategory`), as a YNAB split purchase; else the parts' one category (or none) and the parts in the note
    ("Split: Groceries -40.00; Household -22.40"; a transfer part "Rainy day savings (transfer) -5.00"). Split memos (E) are
    not kept.
  - "Opening Balance" (Quicken's starting figure for an account, L "[the account itself]") is left out and said.
  - No bank id and no balance: duplicates by the key as a count (`dedupe`; the same file twice adds 0), no balance offer.
  - Characters (`decodeFile`): UTF-8 when the bytes are valid UTF-8, else windows-1252 (Quicken for Windows writes the
    computer's own code page; 0x80-0x9F by the WHATWG index-windows-1252, as core/ofx does).
- **CAMT, the rules.**
  - Detection: `BkToCstmrStmt`, `BkToCstmrAcctRpt` or `BkToCstmrDbtCdtNtfctn` (any prefix), or the namespace
    `urn:iso:std:iso:20022:tech:xsd:camt.05[234].`, in the first 4 KB; an OFX file is checked first.
  - The reader (`readXml`): one regular expression over tags and text; prefixes on elements and attributes dropped;
    entities decoded (core/ofx `decodeEntities`); CDATA read as text; comments, `<?...?>` and a DOCTYPE passed over; a
    closing tag pops back to the open element it names; `<x/>` is empty; `complete` when every element was closed.
  - Statements: every `Stmt` (a report's `Rpt`, a notice's `Ntfctn`). Statements of one account (the same IBAN or other
    id, compared in memory and never returned: a month's file often holds one statement a day) are one file account:
    kind (`Acct/Tp/Cd`: SVGS, LLSV, ONDP, MOMA savings; LOAN other debt; CARD card; else checking), last 4 of the id
    (shown once: "Checking ending 4821"), currency (`Acct/Ccy`, else the entries'), bank (`Svcr/FinInstnId/Nm`), the days
    (earliest `FrDtTm` to latest `ToDtTm`), and the balance: the latest closing booked balance (`Bal` of type CLBD; minus
    when its `CdtDbtInd` is DBIT). The holder's name (`Ownr`) is never read.
  - An entry (`Ntry`) is one line. Amount: `Amt`, minus for DBIT, plus for CRDT (a reversal's own `CdtDbtInd` already says
    which way its money went); anything but a decimal, or no CRDT / DBIT, is "no amount". Date: `BookgDt` (`Dt`, or the day
    of `DtTm`), else `ValDt`; else "no date". Not booked (`Sts`, or `Sts/Cd`, other than BOOK: PDNG, INFO) is left out and
    said: "1 line your bank has not booked yet was left out: it comes in with a later file."
  - Bank id (`extId`): `lineId` of the reference and the booking day, the reference being `AcctSvcrRef`, else `NtryRef`,
    else the only `TxDtls`'s `Refs/AcctSvcrRef`. Decision: the day is part of it because a `NtryRef` can be a running number
    within one day's statement ("1" every day): two days' "1" are two lines, and the same entry downloaded again matches.
    The second entry of one statement with the same reference and day gets "|2" before `lineId`, the third "|3" (fix round
    F5: two real 7.00 payments with one reference on one day were read as one); counted per statement, so the same entry
    in a day's report and in the statement of one file is still one line. Then `dedupe`'s three checks, as for an OFX
    line. An entry for 0.00 is left out and said, as a QIF line for 0.00.
  - The other party, the payee: money out `Cdtr`, else `UltmtCdtr`; money in `Dbtr`, else `UltmtDbtr`; `Nm` (.02) or
    `Pty/Nm` (.08 on); never the other side (that is the holder). As written when it has small letters (shownName), else
    prettyPayee. No party: the words are the bank's text and go through prettyPayee ("KARTENZAHLUNG BAECKEREI KORN").
  - The words, the note: `RmtInf/Ustrd` lines joined, else `RmtInf/Strd/CdtrRefInf/Ref`, else `AddtlTxInf`, else
    `AddtlNtryInf`. An IBAN in them (the other party's) becomes "...", and so does any account number of the file.
  - Several `TxDtls` (a collective debit, a batch): one line of the entry's amount; payee the one name, else
    `AddtlNtryInf`, else the first three names; note "3 payments: Stadtwerke Lindenau 40.00, Radio Abo 17.50, Sportverein
    Lindenau 17.50." (10 at most, then "and N more"); said: "1 bank line holds several payments; it comes in as one line,
    with each payment in its note." A batch with only `Btch/NbOfTxs` notes "A batch of N payments."
  - A file cut short: an entry never closed is dropped, the file is called cut short, and the balance is not ticked.
  - Currency: kept on the import record (`currency`, as an OFX file's CURDEF); another than the plan's is said and never
    converted, and the plan then gets no U.S. guesses (core/estimate `applies`). The bank's balance is then not offered
    (`balanceOffer` with `otherCurrency`: a euro figure is never saved as a dollar balance; fix round P1/F6, 2026-11-15,
    which holds for an OFX file in another currency too), and the preview shows the file's figures with its own currency.
  - Characters (`decodeFile`): the XML declaration's encoding (ISO-8859-1 read as windows-1252, as browsers do), else UTF-8.
- **Invariance.** No CSV in qa/fixtures is a QIF or CAMT file, and on every account of every invented plan `prepareImport`
  reads each exactly as with `statements: false`; an OFX file's rows carry no note, category or splits and its accounts no
  label of their own (`tests/qif-camt.test.mjs`). On 2026-11-14 a scratch run compared this build with 6ffb433 byte for
  byte (JSON) over 33 invented plans, the 14 CSV fixtures, the 28 OFX texts of `tests/ofx.test.mjs`, `prepareImport`,
  `prepareOfx`, `prepareRows`, `importRecord`, `guessOfxAccount`, `compute` and the page's decoding of each file:
  19,245 comparisons, none differed. No plan field was added.
- **Not done.** Investment lines (QIF `!Type:Invst`, CAMT securities) are not read. A QIF line downloaded again by
  the bank as OFX with another payee text is not always known as the same line (QIF has no bank id; `dedupe`'s cut-name
  check catches "Kroger" against "KROGER #412"). QIF's category list (`!Type:Cat`, income or expense) is not used.

## A balance for an account in another currency or only partly yours (gap list, next 60, items 18 and 19; 2026-11-17)
A bank file's balance is the whole account, in its own currency. For an account in euros (balance/net-worth/worked.js), a file
that names EUR, or no currency, now offers its balance ("set the balance of Paris savings to EUR 12,500.00, the bank's figure
on ... (on file: EUR 12,000.00). That counts $13,500 in your plan, at $1.08 a euro."), compared with the whole on file; a
file in another currency than its account's is still never offered, nor one for a currency with no rate yet. For an account
only partly the household's, the file's figure is the whole and only the share counts ("..., your half of it"). The offer
gains `own: { code, share, rate, dollars }` only for such an account; `setBalanceFromFile` saves through `saveBalance(..., {
own: true })` and keeps `wasFull` on the import record, so Undo puts the whole back too. The file's lines still come in as
they are, not converted (said above the preview as before; for an account in that currency, "the bank's balance is worked out
at your rate"). Every other account: as before.

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

Gap #33 (2026-11-14), `module.test.mjs` "#33" with the invented `qa/fixtures/ynab-register.csv`, `monarch-transactions.csv` and
`mint-transactions.csv`: the headers (each app's, in any order and case; none, two or a must-have column twice: no app's; rows
that do not read: no app's); every older bank fixture no app's and read exactly as with `formats: false`; per app the rows,
signs, payees, the bank's text, notes, tags, YNAB's starting balances, transfers and split purchase; several accounts (by
name, by last time, none, the masked number, the next account by default, `rows` of the record); duplicates (twice, a
longer file, another account, a bank file's line); categories by name (label, id, part, plural, transfer names, kind,
hidden), the order of choices, a new category's id and kind, what the layout keeps, Undo; split runs; a card's sign in a
file of several accounts; every sentence. Fix round (2026-11-14, two critics): no sign turned around for an app's file
(M1); "Add it as a new category" once for two accounts (M2); two identical lines both in, counted (M3); an older YNAB
import's split purchase not added again (M4); `appAmount` thousands (M5); a broken `categories` or `accounts` (M6); on the
page (stand-in DOM): bank and card accounts only, names in ordinary case, the Import button before an account is picked,
the name carried to Net worth and the added account picked on the way back (P2, P4, P5, P6). `tests/import-formats-invariance.test.mjs`: the three new fields absent from
every invented plan and changing no module's compute; every bank fixture read as before on every account of every plan.

`tests/qif-camt.test.mjs` (item 43, 2026-11-14; invented files inline, account numbers built from 4-digit groups at run time):
QIF detection, every date spelling and the day-first rule, amounts, lines (payee, memo, check, category, class, transfer,
split, opening balance, U), lines that cannot be read and a cut file, the kinds and investments, a whole Quicken file with
the AutoSwitch list, the import (account by name, by kind, asked; categories by the plan's names; splits kept or noted;
duplicates), qifCategory, 1252 bytes; CAMT detection (namespace, prefix, 052, 054; never a CSV, OFX or QIF), the XML
reader, entries (in, out, booking day as date or date-time, value day, party, words, batch, pending, references with the
day, lines that cannot be read), .08 with prefixes, Sts/Cd, Pty/Nm and a savings account, several statements (one account
merged, two accounts), the import (payee, note, balance, currency, no account number in the plan, the file name masked,
duplicates by reference), a cut file and a camt.052 report, encodings; every sentence; the page (a stand-in DOM): the
words, the picker's kinds, a pasted QIF and CAMT file previewed and imported; invariance (above). Fix round (2026-11-15),
by finding: F1/F2 (a stray day-first date, dates that never pass the 12th, dots, dates that disagree: asked with the
file's own date, the answer used on the preview and on Import, the question on the page and its chips), F3 ("0,500",
the file's decimal mark), F4 (lines for 0.00 left out and said, never -0), F5 (twin entries of one statement are two
lines; the same entry in two statements of one file is one), P1/F6 (a EUR file in a USD plan: no balance offered, said
in the currency line, the figures in euros; offered in a EUR plan), P2 (the words line), P3 (the add link's 44 px), P4
(a check number under its row).

## Ideas / not yet
- Positions from OFX investment statements (INVPOSLIST + SECLIST) on Holdings, with the same reader, after claude-h's review
  rounds there. JSON exports.
- Balance check: the file's running balance against the account's balance.
- Bank connections (SimpleFIN) through the server: `transactions/connect`.
- Another app's file (gap #33): check the header sets against a real export of each app when one can be seen; YNAB's flags as
  tags; Monarch's and Mint's budgets. (Bank files now count identical lines and read thousands too: done 2026-11-14.)

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
