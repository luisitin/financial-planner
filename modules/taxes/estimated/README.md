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

## Nothing typed is not "$0 paid" (review 2026-11-02)
`paidTyped` (also on `taxOwedNow`) is true once the payments are saved on this page (`taxes.estimated.typedAt`, written on
save) or any payment is on file. Until then Needs attention ("Estimated tax: type what you have paid this year"), Next best
action ("Type or pay this year's estimated tax"), Emergency fund's liquidity line and the Forecast say what was due *if none
were made*, instead of "$0 is paid so far" for someone who may have paid every quarter.

## Review 2026-11-06
- **Separate returns, each on its own.** Filing separately, each return has its own tax, withholding, safe amount and
  $1,000 test (withholding `byReturn`: IRC 31(a), Pub. 505 "Separate returns"). `returns` gives each return's figures with its
  own four payments (`schedule`, the household's schedule code taken out into a function): the payments typed here go to
  the return that owes, box by box in the same shares (Pub. 505: the couple divides joint payments as they agree). The
  family filing separately with 3,750 each: the household's figures said "No estimated payments needed" (14,282 of tax,
  14,823 withheld), but Bo's own return has 6,517.70 of tax and 4,858 withheld: it needs 5,866 paid in (90% of its tax), so
  1,007.93 in four payments of 251.98, 755.95 of it behind. The page now leads with "Bo: about $1,008 more withheld this
  year", an "Each return" card, and the four payments on Bo's return. The household's figures (needsEstimates, the
  schedule, balanceAtFiling) stay as the answer key has them (tests/golden/estimated RULES.md section 1).
- **Credits more than the tax.** `creditsBack` (yearTax `back`): the words say "no federal tax, and about $1,700 of credits
  come back on top of the $585 withheld from pay" where they said "about $0 of federal tax, $585 of it withheld".
- Tests: in modules/taxes/withholding/module.test.mjs, "Estimated payments, filing separately" and "credits more than the tax".
- **Verifier: both returns behind.** With both returns needing payments the behind line has no name before it and read
  "... other's bill. payments from the 1st quarter ..."; it now starts "Payments". Test: "Review 2026-11-06 (verifier):
  filing separately, both returns behind" (this folder's module.test.mjs).
- **The 110% line filing separately (follow-up to the verifier).** `safeHarbour` already used 75,000 of last year's income
  for a married person filing separately (IRC 6654(d)(1)(C): "$75,000 in the case of a married individual filing a separate
  return"); the help under last year's income and the fold's words said 150,000 for everyone. They now say 75,000 filing
  separately (compute gives `filingStatus`). Test: "filing separately, the safe-amount words say 75,000".
