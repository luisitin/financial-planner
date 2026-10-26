# Tax, year by year  (`taxes/projection`)

**Status:** usable (phase 6)
**Purpose:** Federal tax in every year of the retirement plan through the real brackets: the totals, the worst years, and how the flat setting compares.

## Inputs
Everything the Projection page reads (`buildInputs`), `household.filingStatus`, `retirement.taxMode`, `retirement.withdrawalOrder`, `retirement.rothConversion`, `retirement.gainShare` / `dividendYield`; `real` (page state: today's dollars or nominal).

## Outputs
`rows[]` for the retirement years (ordinary income, Social Security and the taxable part, gains and dividends, deduction, taxable income, bracket, tax, effective rate, conversion, RMD), `totals`, `average`, `peak` (the biggest year and what drives it), `byBracket`, `flatTaxes` (what the flat setting would charge over the same years), `zeroYears`, `success` / `failYear`.

## Formulas
`core/math/retirement.js` in brackets mode (`taxSettings(plan, { mode: "brackets" })`): each retirement year's ordinary income (pensions, a partner's pay, pre-tax withdrawals, required withdrawals, conversions), qualified income (a share of taxable-account withdrawals as gain plus the dividend yield on the taxable bucket) and Social Security go through `federalTax` with the year's table (`paramsFor`: inflated past the last one). The year's tax is settled from the buckets in the withdrawal order; the loop repeats until the tax on the withdrawals themselves is covered.

## Edge cases
Working years are not taxed by the engine (wages and their tax are outside the projection); the table starts at retirement. State tax is not included. After the money runs out the rows show no tax.

## Tests
`tests/tax-pages.test.mjs`, `tests/retirement.test.mjs` (brackets mode), `module.test.mjs`.

## Ideas / not yet
- Medicare premiums and the IRMAA surcharge as a cost line; state tax.
