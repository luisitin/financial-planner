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
