# Withholding check  (`taxes/withholding`)

**Status:** usable (phase 6)
**Purpose:** Whether your paychecks are taking out enough federal tax: the refund or bill in April, and the W-4 change that fixes it.

## Inputs
`taxes.withholding` (`{ self: { perPaycheck, period }, partner: { perPaycheck, period } }`), `taxes.thisYear.withheld` (so far this year, typed on the Federal estimate page; `withheldTyped` true when it was saved with a figure, so a typed 0 counts as typed), `taxes.estimated.paid`, `taxes.priorYear`, everything the Federal estimate reads.

## Outputs
`withholding` (`projectedWithholding`: so far + per paycheck x paychecks left; the whole year at the per-paycheck rate when "so far" is blank; per person), `totalTax`, `balance` (+ owe, - refund), `verdict` (about right / owe / refund / unknown), `harbour` (`safeHarbour`), `penaltyRisk`, `suggestion` (add X per paycheck on W-4 Step 4(c); or the Step 3 / 4(b) amount that ends a big refund).

## Formulas
Paychecks left = floor(days left in the year / 365.25 x paychecks a year); a whole year before the year starts, none once it is over (paychecks in the January after count for the next year: IRC 31(a)(2)). Safe harbour: no penalty when withholding plus instalments reach 90% of this year's tax or 100% of last year's (110% when last year's income was over 150,000; 75,000 filing separately), or when this year's tax less withholding (not estimated payments) is under 1,000 (IRC 6654(e)(1); Form 2210 line 6). `penaltyRisk` = withholding figures typed, tax less withholding 1,000 or more, and withholding plus estimated payments under the safe amount (year totals; the Estimated payments page also checks each due date). `tests/golden-estimated.test.mjs` checks this page and Estimated payments against 3,000 households worked from IRC 6654 and 7503 (`tools/golden_estimated`).

## Edge cases
"About right" is within 500 either way. Without a paycheck figure the verdict is unknown. The paychecks-left count is by calendar days, not the employer's actual pay dates.

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`.

## Ideas / not yet
- Read the withholding line from an imported paystub; state withholding.
