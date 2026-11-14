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

## State income tax by brackets (gap design #40, stage 1, 2026-11-14)
The shared table is `core/math/state-tax.js` (pure; its tests are `tests/state-tax.test.mjs`). It holds, per state, the
brackets by filing status, the standard deduction or exemption, whether Social Security is taxed, the main
retirement-income rule, and whether the state raises its figures with prices (`indexed`). `stateIncomeTax(code, income)`
returns the year's tax, or `null` for a state it has no rules for: every caller then keeps the answer it had before.

**Formula.** State taxable income = federal AGI − the state's adjustments below − its deduction and exemptions.
Graduated tax = the state's own table: the tax at the start of the bracket the taxable income falls in + the bracket's
rate × (taxable income − the bracket's start). The start amounts are Σ rate × (min(income, top) − bottom) over the
brackets below, as the state rounds them (the test checks every one: California to the cent, New York to its whole
dollars). Flat-rate states are one rate. The states with no income tax give 0.

| state | figure | value used | source (read 2026-11-14) |
|---|---|---|---|
| California | brackets, Schedules X (single, separate), Y (joint, surviving spouse), Z (head of household) | 2026: 1% to 12.3% in nine brackets, e.g. Y: 8% over $118,996 on $4,109.92 | FTB, "2026 California Tax Rate Schedules", https://www.ftb.ca.gov/forms/2026/2026-540-tax-rate-schedules.pdf (posted October 2026); worked example: Chris and Pat Smith, joint, $125,000 taxable: $4,590 |
| California | standard deduction | $5,706 single or separate; $11,412 joint, head of household, surviving spouse (**2025**: the 2026 ones are not out yet; the 2026 estimated tax worksheet itself says to use them) | https://www.ftb.ca.gov/file/personal/deductions/index.html ; https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.pdf (worksheet line 2b, line 6a) |
| California | exemption credits | $153 a filer (two on a joint or surviving-spouse return), $153 more each 65 or older, $475 a dependent (**2025**); cut by $6 per credit for each $2,500 ($1,250 separate) of federal AGI over $252,203 single or separate, $504,411 joint or surviving spouse, $378,310 head of household | Form 540 (2025) lines 7-11, https://www.ftb.ca.gov/forms/2025/2025-540.pdf ; booklet line 32, https://www.ftb.ca.gov/forms/2025/2025-540-booklet.html |
| California | Social Security; retirement income | Social Security left out (the taxed part comes off AGI); pensions and IRA or 401(k) withdrawals taxed like pay; gains taxed as ordinary income | Schedule CA (540) instructions 2025, lines 6 and 7, https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html |
| California | the 1% over $1 million | Behavioral Health Services Tax: 1% of taxable income over $1,000,000 | https://www.ftb.ca.gov/forms/2026/2026-540-es-instructions.pdf (section E) |
| New York | rates by filing status | 2026: 3.9% to 10.9%, e.g. single 5.40% over $13,900 on $586 | NYS, IT-2105-I (2026), "New York State tax rates", https://www.tax.ny.gov/pdf/2026/inc/it2105i_2026.pdf (page 10) |
| New York | the benefit taken back above $107,650 of New York AGI | tax computation worksheets 1 to 16 (recapture base and incremental benefit amounts, e.g. single over $215,400: $567 and $2,047) | same, pages 4 to 8 |
| New York | standard deduction; dependents | $8,000 single and separate, $16,050 joint and surviving spouse, $11,200 head of household; $1,000 a dependent (2026) | same, page 3 (line 2) and line 4 |
| New York | Social Security; retirement income | Social Security left out (IT-201 line 27); pension and annuity income, IRA payments included, up to $20,000 a person 59½ or older left out (line 29; counted here from the year a person turns 60, and not for Roth conversions); state, local and federal government pensions are wholly left out by law (line 26), but the plan does not say which pension is one, so they are counted under the $20,000 | IT-201 (2025), https://www.tax.ny.gov/pdf/2025/inc/it201_2025_fill_in.pdf ; IT-201-I (2025), https://www.tax.ny.gov/pdf/2025/inc/it201i_2025.pdf |
| New York | not raised with prices | the figures stay as written in law in later years | - |
| New York | after 2026 | the law cuts the five lower rates (up to $215,400 of taxable income, $323,200 joint) by 0.2 point over 2026 and 2027, "fully phased in by tax year 2027 and ... permanent"; the 2026 half is in the rates above, the 2027 half is **not counted** (its tables and worksheets are not out), so years from 2027 are about $1 a year high for each $1,000 of taxable income in those brackets, and the page says later years are a little high. The top rates of 9.65%, 10.3% and 10.9% run "through 2032" and fall back to 8.82% from 2033: not counted (taxable income over $1,077,550 only) | NYS, "Annual Report on New York State Tax Expenditures, fiscal year 2027", Personal income tax, https://www.tax.ny.gov/data/stats/ter/fiscal-year27/personal-income-tax.htm (read 2026-11-14) |
| Illinois | rate and exemption | 2026: 4.95% flat; $2,925 a filer and a dependent (two filers on a joint return; a surviving spouse files alone) | Booklet IL-700-T (2026), effective January 1, 2026, https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf ; worked example: Alice, $800 a week, two allowances of $2,925 and two of $1,000: $32.13 a week; IL-1040-ES (2026) line 4: 4.95% |
| Illinois | 65 or older; the income limit | $1,000 more each filer 65 or older (not raised with prices); no exemption above $250,000 of federal AGI ($500,000 joint) | IL-1040 instructions (2025), Line 10, https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-instr.pdf |
| Illinois | Social Security; retirement income | Social Security, pensions and IRA, 401(k) and other qualified plan money (Form 1040 lines 4b and 5b, so Roth conversions too) come off | same, Line 5 |
| AK FL NH NV SD TN TX WA WY | no income tax | 0; Washington's 7% tax on long-term gains above about $270,000 is not counted (named on screen) | Tax Foundation, "State Individual Income Tax Rates and Brackets, 2026", https://taxfoundation.org/data/all/state/state-income-tax-rates-2026/ (published 2026-02-17) |

**Could not be read this session, so not in the table yet.** Pennsylvania: www.revenue.pa.gov now forwards every page
to www.pa.gov, which this session's network refuses. Ohio: tax.ohio.gov answers every automated read with an error page
(no other identity was tried). The Tax Foundation's 2026 table shows Pennsylvania 3.07% on all income with no deduction
or exemption, and Ohio 2.75% above $26,050 with an exemption of $2,400, $2,150 or $1,900 by income (none above
$500,000); their retirement-income rules (Pennsylvania leaves retirement income out; Ohio leaves Social Security out)
were not read at the source. Both states keep the State page's flat rule, so their answers are exactly today's; adding
them is one block each in `STATES` once their pages can be read.

**Left out on purpose.** Credits other than California's exemption credits (renter's, child, earned income, household
credits), itemized deductions, local income taxes (New York City and Yonkers are named under "How this is worked out"),
New York's tax on a lump-sum distribution, California's adjustments other than Social Security (it taxes HSA money
federal law does not). A filer's age is the tax year less the birth year.
