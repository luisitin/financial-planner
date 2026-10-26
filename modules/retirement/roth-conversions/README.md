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

## Ideas / not yet
- Stop at the IRMAA line as a choice; partial-year retirements; state tax on conversions.
