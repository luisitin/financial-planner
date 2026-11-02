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

## Withholding, and the easier fix (2026-11-02)
Withholding comes from `withholdingEstimate` in taxes/withholding (the same fallback to the Paycheck page's estimate as
before, now shared, so every tax page has one answer). When pay has tax taken out and estimates are needed, the page
leads with raising withholding: tax withheld counts as paid evenly through the year (IRC 6654(g)(1)), so more withheld
before December covers the earlier quarters too, and it says the penalty-free amount (`remaining`) and the amount that
clears the April bill (`balanceAtFiling`). "Behind: pay it now" stays for income with no withholding. With withholding
as the fix the quarters read "not paid" in a neutral pill, not "short" in red, and the penalty sentence is left out:
raising withholding before December covers them. When one earner's pay stub figure is typed and another's is not,
the estimate is "mixed" (the typed figure for one, the Paycheck page's estimate for the other) and says "partly estimated".
The year's tax includes self-employment tax on business income (`yearTax` in taxes/withholding; Form 2210 counts it), so the
safe-harbour amount and the quarters do too (2026-11-02).

## Tax owed on what is already earned (`taxOwedNow`, round 4, 2026-11-02)
For a household that pays its tax itself, part of the cash in the bank is this year's tax on money already earned. `taxOwedNow(plan, { today })` says how much, so Emergency fund and Next best action leave it out of the cushion:
- earnedShare = whole months gone this year / 12 (on November 2: 10/12).
- owedNow = (the year's tax, self-employment tax included, - projected withholding) x earnedShare - estimated payments made, never below 0. The months still to come carry their own tax, which every monthly figure (Next best action's left-over month, Budget, Income statement) already takes off.
- monthly = (the year's tax - withholding) / 12: what to put aside a month.
- With it: the year, the year's tax, withholding, payments made, `overdue` and `nextDue` (this page's own), and what is left at filing.

My choices (no owner input): it applies only when the plan has income from the household's own business or freelance work that is going today, estimates are needed (this page's `needsEstimates`), and withholding covers under half of the year's tax. A household whose paychecks withhold most of the tax is left to Withholding check, because its withholding is often estimated from pay. Only federal tax counts: the State page has a rate, not payments. In January to April last year's balance is not in it (the plan holds one tax year).

## Edge cases
The annualised-income method (uneven income through the year) is not modelled; nor is the penalty itself (it runs like interest from each due date).

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`. `tests/golden-estimated.test.mjs`: an independent answer key (`tools/golden_estimated`, 3,000 households and every due date for 2024 to 2027 worked from IRC 6654 and 7503, the Form 1040-ES and 2210 instructions and Rev. Rul. 2015-13, never from this code; `tests/golden/estimated/RULES.md`) compared with this page and Withholding check. Every row agrees since 2026-10-31; the key found five causes, all fixed (statuses from everything paid, the late-quarter penalty test, Patriots' Day, January after the year, a typed $0 so far).

## Ideas / not yet
- A reminder on the Needs attention page in the week before each due date.
