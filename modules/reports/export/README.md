# Export  (`reports/export`)

**Status:** usable (phase 9)
**Purpose:** Any table in the app as a file a spreadsheet opens: accounts, transactions, income, expenses, debts, goals, holdings, the retirement plan and tax year by year, the life timeline.

## Inputs
The plan's lists (`accounts`, `transactions`, `income`, `expenses`, `debts`, `goals`, `holdings`, `netWorthHistory`) and, for the worked-out tables, the pages that make them: `retirement/cash-flow` (year by year, today's dollars), `taxes/projection`, `overview/timeline`. Writes nothing. Files are made in the browser (a Blob); nothing leaves the device.

## Outputs
`compute(plan, { today })` -> `{ datasets: [{ id, title, what, kind: "typed"|"worked", rows, columns }], total }`. `datasetCsv(plan, id, today)` -> the CSV text (`core/csv.js` `toCsv`: a header line, CRLF line ends, fields quoted when they hold a comma, quote or line break). `DATASETS` lists each dataset's columns and how its rows are built.

## The files
Money rounded to the cent; rates as percentages (`rate_pct` 23.9 for 23.9%); dates `YYYY-MM-DD`. Names of people and accounts instead of their ids. File names `planner-<dataset>-<date>.csv`; the whole plan as `plan-<date>.json` (the same file Settings saves and loads).

## Tests
`module.test.mjs`: every dataset on an empty plan and on the family, a CSV read back (headers, rows, numbers, owners), quoting of commas and quotes, an unknown dataset.

## Ideas / not yet
- One workbook with a sheet per table (needs a spreadsheet library in `vendor/`); a date range for transactions; the Monte Carlo bands and the stress tests.

## Split purchases (gap #24, 2026-11-14)
In the Transactions file a purchase split across categories is one row per part (its own category and amount) with a last
column `part_of` ("1 of 2 of -300"), so the amount column still adds up to the transactions. The column is there only when
something is split: without a split the file is byte for byte what it was.

## Lines left out of the totals (gap #32, 2026-11-14)
The Transactions file is a copy of the data: it keeps every line, the ones left out of the totals too (ledger `everyLine`,
not `allLines`). When a line is left out, a last column `counts` says so: "no: left out", "no: to be paid back", "no: paid
back", "no: money back"; empty for a line that counts. With no such line the file has the columns it had.

## Our guesses, marked (smart guesses C8, 2026-11-14; tests `tests/guess-reports.test.mjs`)
A figure this report prints that rests on our guesses is marked "(our guess)", "(partly our guesses)" or "(our estimate)"
(`../guess-marks.js`, report-kit `marked`; the rules and words are in reports/plan-summary/README.md, "Our guesses, marked").
Here that is a file of its own, "Our guesses" (`GUESS_DATASET`, with the worked-out files): one row per figure in the lists
that is our guess, `list,name,column,value` ("income,Jo's pay,amount,66000", "debts,Mortgage,rate_pct,4.6"), listed only
while a guess is in use. Every other file keeps the columns it had whether or not a guess is in use (critic F4: a last column
`our_guess` that came and went with the guesses broke a sheet or an import built on the columns), so a plan with no guess
exports exactly as before.
