# Withholding check  (`taxes/withholding`)

**Status:** usable (phase 6)
**Purpose:** Whether your paychecks are taking out enough federal tax: the refund or bill in April, and the W-4 change that fixes it.

## Inputs
`taxes.withholding` (`{ self: { perPaycheck, period }, partner: { perPaycheck, period } }`), `taxes.thisYear.withheld` (so far this year, typed on the Federal estimate page; `withheldTyped` true when it was saved with a figure, so a typed 0 counts as typed), `taxes.estimated.paid`, `taxes.priorYear`, everything the Federal estimate reads.

## Outputs
`withholding` (`projectedWithholding`: so far + per paycheck x paychecks left; the whole year at the per-paycheck rate when "so far" is blank; per person), `totalTax`, `balance` (+ owe, - refund), `verdict` (about right / owe / refund / unknown), `harbour` (`safeHarbour`), `penaltyRisk`, `suggestion` (add X per paycheck on W-4 Step 4(c); or the Step 3 / 4(b) amount that ends a big refund). With an amount so far but no paycheck figure and a bill ahead, it says the paycheck figure is missing ("No paycheck figure is typed yet...") and points to the paycheck form or, for pay with no tax taken, Estimated payments; until 2026-10-31 it said "Nothing is withheld from a paycheck", which the person never said (found by the step-by-step guides' third review).

## Formulas
Paychecks left = floor(days left in the year / 365.25 x paychecks a year); a whole year before the year starts, none once it is over (paychecks in the January after count for the next year: IRC 31(a)(2)). Safe harbour: no penalty when withholding plus instalments reach 90% of this year's tax or 100% of last year's (110% when last year's income was over 150,000; 75,000 filing separately), or when this year's tax less withholding (not estimated payments) is under 1,000 (IRC 6654(e)(1); Form 2210 line 6). `penaltyRisk` = withholding figures typed, tax less withholding 1,000 or more, and withholding plus estimated payments under the safe amount (year totals; the Estimated payments page also checks each due date). `tests/golden-estimated.test.mjs` checks this page and Estimated payments against 3,000 households worked from IRC 6654 and 7503 (`tools/golden_estimated`).

## One answer to "refund or owe" (2026-11-02)
`withholdingEstimate(plan, { today })` is the one figure for what the paychecks take out this year: the figures typed here
and the year so far when there are any (`projectedWithholding`, unchanged); else the Paycheck page's federal withholding,
worked out from pay the way payroll does (IRS Pub. 15-T percentage method), for the whole year; else none. `taxAnswer`
puts it against the year's tax and the estimated payments made: Estimated payments, the Federal estimate, Quick answers
and Needs attention (an alert when $1,000 or more is left to pay in April after withholding and what is already paid) all read it,
so the family plan says "about $5,602 in April" on every page (before, $15,072 on Quick answers, "owe $7,072" on the
Federal estimate with only the year so far counted, nothing here until a stub was typed, and $9,470 withheld on Estimated
payments). `compute()`'s `balance` and `verdict` still count the typed figures only (the estimated-payments answer key
checks them); the page leads with `estimate` (that plus `balance`, `verdict`) and says when it is estimated, never
"$0 withheld". Earner by earner (review, 2026-11-02): a typed per-paycheck figure for whoever has one, the estimate from
pay for the others (`from: "mixed"`), and with only the year so far typed, the estimated earners' paychecks left added to
it; other payments typed on the Federal estimate (`taxes.thisYear.paid`) count as paid. The W-4 change on the estimate is
per paycheck, on the main earner's paychecks left (`estimate.suggestion`). Each "paid how often" box starts on that person's salary period on Income (it was always every two weeks,
so a monthly earner's stub figure was counted 26 times).

## Self-employment tax in the year's tax (2026-11-02)
`yearTax(plan, fed, { today })` -> `{ total, income, se }`. `income` is the Federal estimate's total, which counts business
income as ordinary income and leaves out the self-employment tax. With business income on the Income page, `total` is the
Self-employment page's figure (`taxWith`): the same income tax less what half the self-employment tax (IRC 164(f)) and the
20% business deduction (IRC 199A) save, plus the 15.3% self-employment tax (IRC 1401, on 92.35% of profit) and any
Additional Medicare Tax. `se` is the difference ($611 for the sample family's $7,200 of photography profit: $1,017 of
self-employment tax less about $406 of income tax the deductions save). This page, Estimated payments, the Federal
estimate's answer, Quick answers and Needs attention all use `total`: the safe-harbour amount and Form 2210 count
self-employment tax as part of the year's tax (the Form 1040-ES estimated tax worksheet adds it to income tax; Schedule 2 carries it to the 1040's total tax). Before, the April bill left it out
($5,602 instead of $6,213 for the family). A plan with no business income is unchanged (the answer key has none).

## The walk that ends at the whole tax (2026-11-02)
`fullSteps(plan, fed, params)` returns the Federal estimate's walk with the business rows inserted before "Federal tax"
when there is self-employment income: the change in income tax from counting the business at its profit with half the
self-employment tax and the 20% deduction off income (taxes/self-employment `taxWith − seTotal − addlMedicare` against
the engine's `totalTax`), then the self-employment tax; "Federal tax" becomes `yearTax`'s total. The Federal estimate and
the Tax report both show it.

## Edge cases
"About right" is within 500 either way. Without a paycheck figure the verdict is unknown. The paychecks-left count is by calendar days, not the employer's actual pay dates.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Read the withholding line from an imported paystub; state withholding.
