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

## Edge cases
No spending at all: empty state. A month asked for that has no spending falls back to the default (the latest whole month, else the latest). No whole month at all (a file shorter than a month): the latest month, said to be partial.

## Tests
`module.test.mjs`: totals and exclusions, shares and changes on the same days, unfiled bucket, payees and biggest lines, the default month (the latest whole one) and fallback, a file cut mid-month (same days of the month before, per day over the days covered, a cut first month, months with no common days).

## Ideas / not yet
- A calendar heat map and a 12-month trend line (uPlot, vendored).
- Merchant merging (Amazon Mktpl + Amazon Prime -> Amazon).
