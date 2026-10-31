# Estimated payments  (`taxes/estimated`)

**Status:** usable (phase 6)
**Purpose:** Quarterly estimated payments: the safe-harbour amount, what is due each quarter and when, and where you stand today.

## Inputs
`taxes.estimated.paid` (four amounts, edited here), `taxes.priorYear` (`{ tax, agi }`, edited here), the projected withholding (Withholding check), everything the Federal estimate reads.

## Outputs
`harbour` (required amount and its basis), `toPayByEstimates` (required less withholding), `perQuarter`, `quarters[]` (label, covers, due date, paid, cumulative share, status paid / due / short / upcoming), `paid`, `remaining`, `nextDue`, `balanceAtFiling`, `needsEstimates`, `penaltyRisk`.

## Formulas
`safeHarbour` (Withholding check). Instalments are needed when the balance after withholding is 1,000 or more and withholding alone misses the safe amount; the shortfall splits into four equal payments due April 15, June 15, September 15 and January 15 (the IRS's uneven periods; IRC 6654(c)(2)). A due date on a Saturday, Sunday or legal holiday moves to the next business day (IRC 7503): `dueDay` from the Money calendar (household/calendar), with Martin Luther King Jr. Day, DC Emancipation Day and, in Maine and Massachusetts, Patriots' Day; for example 2027's last payment is due January 18, 2028. A quarter is "short" when the payments to date fall behind the cumulative share after its due date.
- Withholding: what the Withholding check page projects (typed per paycheck, or the year so far); with nothing typed, the Paycheck page's yearly federal withholding (estimated from pay and the W-4 it assumes), with a note to type the pay stubs' figure.
- Behind = the cumulative share of the last quarter already past due, less what is paid (at most what remains); the headline asks for it now. The next payment is the first quarter not yet past: its cumulative share less what is paid, less what is behind.

## Edge cases
The annualised-income method (uneven income through the year) is not modelled; nor is the penalty itself (it runs like interest from each due date).

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- A reminder on the Needs attention page in the week before each due date.
