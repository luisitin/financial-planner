# Import  (`transactions/import`)

**Status:** usable (phase 3): CSV. OFX/QFX/JSON are not read yet.
**Purpose:** Bring in a CSV file from your bank or card; columns are worked out, duplicates skipped, rules applied.

## Inputs
Plan sections read (`needs`): `accounts`, `transactions`, `rules`, `importProfiles`. Writes: `transactions`, `imports`, `importProfiles`, `rules` (hit counts).
`prepareImport(plan, text, { accountId, mapping?, flipSign?, importId })` does the whole job; `compute(plan)` only lists past imports.

## Outputs
`prepareImport` -> `{ parsed, mapping, headerKey, txs, add, skip, bad, dateFrom, dateTo, inTotal, outTotal, ruled, ruleHits }`.
`compute` -> `{ imports[] (newest first), accounts[] (with counts), lastImport, total }`.

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

## Edge cases
No accounts: the page asks for one first. Unreadable rows are counted and listed (no date / no amount), never imported. A file already fully on file: "nothing to do". Pasted text works like a file.

## Tests
`module.test.mjs` with `qa/fixtures/chase-checking.csv`: date and amount formats, mapping detection (single amount, debit/credit, type column), payee cleaning, keys, bad rows, flipSign, dedupe, rules and hit counts, profile reuse, totals. The gap warning: a file 5 and 4 days after the last line (with the rent of the 22nd named), 3 days (none), no usual payment (no parenthesis), the last import's `to`, an account with nothing on file; the sample family's 90-day file after July's lines (`qa/fixtures/card-gap-plan.mjs`), word for word (2026-11-02).

## Ideas / not yet
- OFX/QFX (vendor/banking.js as the parser), JSON exports.
- Balance check: the file's running balance against the account's balance.
- Bank connections (SimpleFIN) through the server: `transactions/connect`.

## Stress test fixes (2026-11-11, claude-d)
- After a file is read (or pasted text used) "3. Check and import" comes to the top of the screen, and the Import button sits
  right under the counts, before the sample rows. The same file can be chosen again.
- "Use the pasted text" with an empty box says "Paste the file's text in the box first." at the box and leaves a chosen file alone.
- `looksLikeBankFile(parsed)` (compute.js): a line with a date in one cell and an amount in another, in either date order.
  Text that has none ("hello world") gets one plain error, no column pickers and no tiles of 0; "already on file" is said only
  when lines were read and all matched. Column names nobody recognises still reach the pickers.
- With no account yet: a card with a filled "Add the account" button instead of a 19 px link.
- "Added 10 transactions from x.csv. Now give them a category." on Categorize (its exported `say`), and Undo of an import says what it removed.
