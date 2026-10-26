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
5. On confirm the view appends `add` with fresh ids, records an `imports` entry (undo removes by `importId`) and saves the mapping under the header fingerprint.

## Edge cases
No accounts: the page asks for one first. Unreadable rows are counted and listed (no date / no amount), never imported. A file already fully on file: "nothing to do". Pasted text works like a file.

## Tests
`module.test.mjs` with `qa/fixtures/chase-checking.csv`: date and amount formats, mapping detection (single amount, debit/credit, type column), payee cleaning, keys, bad rows, flipSign, dedupe, rules and hit counts, profile reuse, totals.

## Ideas / not yet
- OFX/QFX (vendor/banking.js as the parser), JSON exports.
- Balance check: the file's running balance against the account's balance.
- Bank connections (SimpleFIN) through the server: `transactions/connect`.
