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

## Review 2026-11-06
- **No retirement year in the plan (fix round 6).** `noYears` = `noYearsWhy(people, year)` when `rows` is empty, else
  null: everyone past the end age (this year - birth year >= end age): "Maya is 126, past the age the plan runs to (95)",
  check "the birth date"; everyone's end age at or before their retirement age: "the plan runs to 60, and Maya retires at
  70" (one end age and one retirement age; else "the plan ends before A and B retire"), check the retirement age and
  "Plan to age"; else "the plan has no years after work stops". The page shows that in its hero, where it threw on
  `d.rows[0].year` ("This page failed to render") for the same 17 qa households the Tax report hung on; the Tax report
  says the same words. Test: module.test.mjs "no retirement year in the plan says why".
- **One retirement year (verifier, fix round 6).** The hero read "1 years from 2026 to 2026, in today's dollars: $813 a year
  on average ... The biggest year is 2026 at $813"; it reads "1 year, 2026, in today's dollars, filing single." with no
  average and no biggest year, as the Tax report now says it. Test: "no retirement year in the plan says why".

## Round 7 (2026-11-06)
- `noYearsWhy` moved to `retirement/projection/compute.js` (buildInputs uses it) and is re-exported here. With everyone past
  the plan's end age `buildInputs` returns no inputs, so `compute` returns `ready: false` with `noYears`; the page and the
  Tax report still say "There are no retirement years to tax: Ana is 126, past the age the plan runs to (95). Check the
  birth date on the People page".
