# Roth conversions  (`retirement/roth-conversions`)

**Status:** usable (phase 6)
**Purpose:** Fills a bracket with Roth conversions in the years before required withdrawals and shows what that does to lifetime tax and spending.

## Inputs
Everything the Projection page reads; `retirement.rothConversion` (`{ on, fillRate, untilAge }`, set here; turning it on also switches `retirement.taxMode` to the brackets); `household.filingStatus`.

## Outputs
`options[]` (no conversions, then the 10%, 12%, 22% and 24% brackets filled): `totalConvertedReal`, `taxesReal`, `endBalanceReal`, `endAfterTaxReal`, `rmdReal`, `success`, `failYear`, `chosen`, `best`; `table[]` for the chosen (or best) setting: each year with a conversion, income before it, the conversion, the year's tax, the bracket it ends in, and whether it crosses the Medicare surcharge line (IRMAA, from 63 because of the two-year look-back); `span` (the years conversions are possible), `rmdStartAge`.

## Formulas
The engine's conversion step (`core/math/retirement.js`): in each retirement year before the required-withdrawal age (and the until-age), once the year's spending withdrawals are settled, convert pre-tax money to Roth until taxable income sits at the top of the chosen bracket (`roomUnder`, then trimmed or topped up so the tax on the conversion itself, when it has to come from pre-tax money, is included); the tax is settled from the buckets like any other. Options are ranked by `endAfterTaxReal` (Withdrawal order page). IRMAA first tier 2026: 109,000 single / 218,000 joint, indexed with the plan's inflation.

## Edge cases
Conversions are skipped in a year they would make the plan fail. The marketplace (ACA) subsidy cliff before 65 is text, not a computed flag, because the plan does not know who buys marketplace insurance. The 5-year rule is text.

## Tests
`tests/tax-pages.test.mjs` (a big pre-tax pot is helped; a couple already in the 12% bracket barely is), `tests/retirement.test.mjs` (the engine step), `module.test.mjs`.

## Independent answer key and audited sources

`tests/golden/retirement/roth-conversions.csv` holds 1,000 invented cases,
100 for each of ten rules, each split into 60 grid, 30 edge and 10 extreme
cases. The complete inventory and CSV layout are in
`tests/golden/retirement/briefs/roth-conversions.md`. The independent generators
are `tools/golden_retirement/roth_conversions.py` and `tax_oracle.py`.
They do not import the application. Every tenth row has a second calculation
or conservation check recorded beside its source.

Bracket ceilings and deductions are from [IRS Rev. Proc. 2025-32](https://www.irs.gov/irb/2025-45_IRB).
The temporary age-65 deduction uses [IRC 151(d)(5)(C)](https://www.law.cornell.edu/uscode/text/26/151)
and [IRS Schedule 1-A instructions](https://www.irs.gov/instructions/i1040gi).
Taxable traditional-IRA distributions and conversions are described in
[IRS Publication 590-B](https://www.irs.gov/publications/p590b).
Rates and balances in the fixtures are invented scenario inputs. Source-year
tax amounts remain exact; future indexing is the stated hypothetical planning
assumption, not a prediction of tax law.

For a single person under 65 in 2026, the 12% bracket ends at $50,400 and
the standard deduction is $16,100. With no other income and enough cash
to pay the tax, the target conversion is `50,400 + 16,100 = $66,500`;
its federal tax is `12,400 * .10 + 38,000 * .12 = $5,800`.
The independent solver first fixes the withdrawals already needed for spending,
then solves for the largest conversion that stays under the chosen taxable
income ceiling while the remaining accounts can pay the extra tax. The answer
is found to cent precision, rather than assuming a fixed number of corrections
will converge. Fixed 2026-10-30 (F-030): `roomUnder` and the engine's conversion step
solve to a fraction of a cent (secant steps inside a bracket, `largestAtOrUnder` in
`core/math/tax.js`), the senior deduction follows the law (per person, joint returns
only), and conversions under $1 are no longer skipped: an available $0.01 with no tax
liability converts $0.01.

Required-withdrawal age and an explicitly supplied until-age are both exclusive
conversion boundaries. A failed spending plan converts nothing. The reported
span counts eligible years even if the pre-tax account is empty; the table
contains only years with a positive conversion. Real totals divide each
nominal conversion, tax and required withdrawal by that year's cumulative price
level before summing. The chosen option and best option are separate fields;
ties keep the first listed option.

The $109,000 individual and $218,000 joint 2026 Medicare thresholds and the
two-year lookback follow [SSA POMS HI 01101.031](https://secure.ssa.gov/poms.NSF/lnx/0601101031)
and the [CMS 2026 Medicare fact sheet](https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles).
That POMS table places a surviving spouse with a dependent child in the
individual tier, which is used here. The flag starts at age 63 to look ahead
to age 65, and requires income strictly above the threshold; equality does
not trigger it. Later threshold indexing follows the page's planning assumption.
Money is rounded only for annual federal tax and final CSV answers; rates
are written with six decimal places.

## Ideas / not yet
- Stop at the IRMAA line as a choice; partial-year retirements; state tax on conversions.
