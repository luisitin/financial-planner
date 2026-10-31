# Estimated payments  (`taxes/estimated`)

**Status:** usable (phase 6)
**Purpose:** Quarterly estimated payments: the safe-harbour amount, what is due each quarter and when, and where you stand today.

## Inputs
`taxes.estimated.paid` (four amounts, edited here), `taxes.priorYear` (`{ tax, agi }`, edited here), the projected withholding (Withholding check), everything the Federal estimate reads.

## Outputs
`harbour` (required amount and its basis), `toPayByEstimates` (required less withholding), `perQuarter`, `quarters[]` (label, covers, due date, paid, cumulative share, status paid / due / short / upcoming, `late`), `paid`, `remaining`, `behind`, `overdue`, `nextDue`, `balanceAtFiling`, `lateQuarter`, `needsEstimates`, `penaltyRisk`.

## Formulas
`safeHarbour` (Withholding check). Instalments are needed when the balance after withholding is 1,000 or more and withholding alone misses the safe amount; the shortfall splits into four equal payments due April 15, June 15, September 15 and January 15 (the IRS's uneven periods; IRC 6654(c)(2)). A due date on a Saturday, Sunday or legal holiday moves to the next business day (IRC 7503): `dueDay` from the Money calendar (household/calendar), with Martin Luther King Jr. Day and DC Emancipation Day; for example 2027's last payment is due January 18, 2028. Patriots' Day moves a Maine or Massachusetts resident's return, not an estimated payment (Rev. Rul. 2015-13; Form 1040-ES (2024) printed April 15, 2024 for everyone), so the household's state does not move these. A quarter is "paid" when everything paid so far reaches its cumulative share (a payment counts against the earliest unpaid quarter, IRC 6654(b)(3)), "short" when its due date has passed without that, "due" in the month of its due date, else "upcoming". A quarter is `late` when its own and the earlier boxes were under its share on its due date: the penalty is figured for each due date on its own (Form 2210 instructions), so `penaltyRisk` = estimates needed, the year not yet fully paid, and some quarter late, caught up since or not; the note then names the late quarter.
- Withholding: what the Withholding check page projects (typed per paycheck, or the year so far); with nothing typed, the Paycheck page's yearly federal withholding (estimated from pay and the W-4 it assumes), with a note to type the pay stubs' figure.
- Behind = the cumulative share of the last quarter already past due, less what is paid (at most what remains); the headline asks for it now. The next payment is the first quarter not yet past and not covered: its cumulative share less what is paid, less what is behind (never $0). The overdue date is the first quarter not covered.

## Edge cases
The annualised-income method (uneven income through the year) is not modelled; nor is the penalty itself (it runs like interest from each due date).

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`. `tests/golden-estimated.test.mjs`: an independent answer key (`tools/golden_estimated`, 3,000 households and every due date for 2024 to 2027 worked from IRC 6654 and 7503, the Form 1040-ES and 2210 instructions and Rev. Rul. 2015-13, never from this code; `tests/golden/estimated/RULES.md`) compared with this page and Withholding check. Every row agrees since 2026-10-31; the key found five causes, all fixed (statuses from everything paid, the late-quarter penalty test, Patriots' Day, January after the year, a typed $0 so far).

## Ideas / not yet
- A reminder on the Needs attention page in the week before each due date.
