# Tax, year by year  (`taxes/projection`)

**Status:** usable (phase 6)
**Purpose:** Federal tax in every year of the retirement plan through the real brackets: the totals, the worst years, and how the flat setting compares; and the state's income tax in those years where the app has the state's rules.

## Inputs
Everything the Projection page reads (`buildInputs`), `household.filingStatus`, `retirement.taxMode`, `retirement.withdrawalOrder`, `retirement.rothConversion`, `retirement.gainShare` / `dividendYield`; `real` (page state: today's dollars or nominal).

## Outputs
For a state with rules in `core/math/state-tax.js` (gap #40) also `rows[].state`, `totals.state` and `state: { code, name,
none, total, average, zeroYears, rules, yearWords, indexed, local }`; for any other state these keys are absent and the
output is byte for byte what it was (`compute(plan, { stateBrackets: false })` is the old code, tests/state-tax-invariance.test.mjs).
`rows[]` for the retirement years (ordinary income, Social Security and the taxable part, gains and dividends, deduction, taxable income, bracket, tax, effective rate, conversion, RMD), `totals`, `average`, `peak` (the biggest year and what drives it), `byBracket`, `flatTaxes` (what the flat setting would charge over the same years), `zeroYears`, `success` / `failYear`.

## Formulas
`core/math/retirement.js` in brackets mode (`taxSettings(plan, { mode: "brackets" })`): each retirement year's ordinary income (pensions, a partner's pay, pre-tax withdrawals, required withdrawals, conversions), qualified income (a share of taxable-account withdrawals as gain plus the dividend yield on the taxable bucket) and Social Security go through `federalTax` with the year's table (`paramsFor`: inflated past the last one). The year's tax is settled from the buckets in the withdrawal order; the loop repeats until the tax on the withdrawals themselves is covered.

## Edge cases
Working years are not taxed by the engine (wages and their tax are outside the projection); the table starts at retirement. State tax is counted only for a state with rules in the app (below); for any other state the page names it: "Massachusetts income tax is not counted yet." (no state chosen: "State tax is not included."). After the money runs out the rows show no tax.

## Tests
`tests/tax-pages.test.mjs`, `tests/retirement.test.mjs` (brackets mode), `module.test.mjs`.

## Ideas / not yet
- Medicare premiums and the IRMAA surcharge as a cost line.
- The state tax in the projection's own spending (Will the money last?): today it is shown here only, next to the federal
  tax the engine pays; putting it into the engine would move every projection answer and is its own design.

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

## State income tax by brackets, stage 2: Georgia, North Carolina, New Jersey, Virginia (2026-11-14)
Four more blocks in `STATES`, the engine as stage 1 left it, with two optional inputs two of the states need:
`investment` (interest, dividends and gains inside AGI) and `earned` (pay and business profit inside AGI). The other states
ignore them, so no California, New York or Illinois figure moves. Georgia and North Carolina are flat-rate states: one rate.
`children` (dependents under 17) is North Carolina's child deduction; not given, it is the dependents.

Every figure below was read on the state's own revenue department on 2026-11-14.

| state | figure | value used | source |
|---|---|---|---|
| Georgia | rate | 2026: 4.99% flat (HB 463, back to January 1, 2026; it was 5.19%) | Georgia DOR, "2026 Employers Tax Guide" (updated September 2026), "What's new for tax year 2026", PDF page 3, https://dor.georgia.gov/document/document/2026-employers-tax-guide-updated-september-2026/download ; "Important Tax Updates", "2026 Income Tax Changes", https://dor.georgia.gov/taxes/important-tax-updates |
| Georgia | standard deduction; dependents | 2026: $15,000 single, head of household, separately (and a surviving spouse, who had the single amount in 2025); $30,000 joint; $5,000 a dependent (was $4,000) | same guide, PDF page 3 and Table E (PDF page 51); Form G-4P (Rev. 06/03/26), https://dor.georgia.gov/document/form/withholdingcertificateforpensionorannuitypaymentsg-4ppdf/download |
| Georgia | worked example | married, spouse not working, one child, $2,000 semi-monthly: 2,000 − 1,250 − 208.33 = 541.67 × 0.0499 = $27.03 | same guide, "Percentage method for employee withholding", PDF page 51 |
| Georgia | Social Security; retirement income | Social Security left out (Schedule 1, subtraction 5). The retirement income exclusion: $35,000 a person 62 to 64, $65,000 from 65, each on their own; it covers interest, dividends, gains, IRA money (conversions too: Georgia follows the federal rules on them), pensions, rents and up to $5,000 of pay (**2025**: the 2026 booklet is not out yet) | IT-511 Individual Income Tax Booklet (2025), PDF pages 12, 21, 22 and 24 and Form 500 Schedule 1 page 2 (PDF page 48), https://dor.georgia.gov/document/document/2025-it-511-individual-income-tax-booklet/download |
| North Carolina | rate | 2026: 3.99% flat (Session Law 2023-134; "additional rate changes may apply to tax years beginning with 2027 based on certain rate reduction triggers": not counted) | NCDOR, "Tax Rate Schedules", https://www.ncdor.gov/taxes-forms/tax-rate-schedules ; Form NC-40 instructions, worksheet "For Tax Years Beginning on or after January 1, 2026", https://www.ncdor.gov/individual-estimated-income-tax/open |
| North Carolina | standard deduction | 2026: $12,750 single and separately, $19,125 head of household, $25,500 joint and surviving spouse | NC-40 (above) |
| North Carolina | child deduction | per child under 17 with the federal child tax credit: $3,000 up to $40,000 of federal AGI joint ($30,000 head of household, $20,000 single or separately), $500 less over each step of $20,000 joint ($15,000, $10,000), $0 over $140,000 ($105,000, $70,000) | Form NC-4 (Web 10-25), Schedule 2, https://www.ncdor.gov/employees-withholding-allowance-certificate-0/open ; D-401 instructions (2025), line 10, https://www.ncdor.gov/2025-d-401-individual-income-tax-instructions/open |
| North Carolina | worked example | NC-30 (2026), annualized method: $450 a week × 52 = $23,400 − $12,750 − 2 × $2,500 = $5,650 × 4.09% (the tables' rate: 3.99% plus 0.1%) = $231.09; the test checks the engine's rate and deduction give it | NC-30, "2026 Income Tax Withholding Tables and Instructions for Employers", PDF page 20 (printed page 19; the 0.1% on PDF pages 17 to 19), https://www.ncdor.gov/income-tax-withholding-tables-and-instructions-employers/open |
| North Carolina | Social Security; retirement income | Social Security left out (Schedule S line 19); pensions and IRA money taxed like pay, except the Bailey settlement's government pensions (vested by August 12, 1989), which the plan cannot tell apart: not applied | D-401 (2025), Schedule S lines 19 and 20 |
| New Jersey | rates | 2026: Table A (single, separately) 1.4% to 10.75% in seven brackets; Table B (joint, head of household, surviving spouse) in eight, e.g. B: over $150,000, × .0637 − $4,042.50. Kept as printed ("multiply, subtract"): the joint $70,000 row's subtract amount gives 50 cents more than the sum of the brackets below, as the state's own table does | NJ Division of Taxation, Form NJ-1040-ES (2026) instructions, PDF page 3, https://www.nj.gov/treasury/taxation/pdf/current/1040esi.pdf ; Tax Rate Schedules 2020 and after, https://www.nj.gov/treasury/taxation/pdf/current/njtaxratesch.pdf |
| New Jersey | exemptions | 2026: $1,000 a filer, $1,000 more each 65 or older, $1,500 a dependent (blind, veteran and college-student amounts not known to the plan: left out) | NJ-1040-ES (2026), "Exemptions", PDF page 2 |
| New Jersey | worked example | the tax table's own rows: taxable $40,000 to $40,050, $719 single and $630 joint | NJ-1040 instructions (2025), Tax Table, PDF page 60 (the 2026 rates are the same), https://www.nj.gov/treasury/taxation/pdf/current/1040i.pdf |
| New Jersey | Social Security; retirement income | Social Security not taxed. From 62, pensions, annuities and IRA money (line 20a, conversions included) left out up to $100,000 joint, $75,000 single, head of household or surviving spouse, $50,000 separately, when income (line 27) is $100,000 or less; 50% / 37.5% / 25% of them up to $125,000; 25% / 18.75% / 12.5% up to $150,000; none above (line 28a). The rest of that maximum comes off other income when pay and business income are $3,000 or less (line 28b, Worksheet D; pay not known: not used). Income (line 29) of $20,000 or less ($10,000 single or separately) pays nothing (the filing threshold). The 2026 NJ-1040-ES confirms the exclusions "only apply for taxpayers with income up to $150,000"; their amounts are **2025**'s: the 2026 instructions are not out yet | NJ-1040 instructions (2025), line 20a (PDF page 15), lines 28a to 29 and Worksheet D (PDF pages 22 and 23); NJ-1040-ES (2026), PDF page 2 |
| Virginia | rates | 2026: 2% to $3,000, 3% to $5,000, 5% to $17,000, 5.75% above ($720 + 5.75% over $17,000) | Virginia Tax, Form 760ES (2026, Rev. 09/25), Tax Rate Schedule, https://www.tax.virginia.gov/sites/default/files/taxforms/individual-income-tax/2025/760es-2026-2025.pdf |
| Virginia | exemptions; filing threshold | 2026: $930 a filer and a dependent, $800 more each 65 or older; no tax when Virginia AGI is under $11,950 single or separately, $23,900 joint | 760ES (2026), worksheet line 4 and Section I |
| Virginia | standard deduction | $8,750, $17,500 joint, "for Taxable Years 2025 and 2026"; the 2026 Appropriation Act (House Bill 30, Special Session I, Chapter 1, third enactment clause) raises it to $9,200 and $18,400 for 2027 and to $9,300 and $18,600 for 2028 and 2029, "scheduled to sunset after Taxable Year 2029 and revert to the standard deduction amounts that applied prior to Taxable Year 2019, $3,000 for single filers and $6,000 for married filers filing jointly" (used for 2030 on; all four said on screen). Head of household files as single in Virginia; a surviving spouse is taken as single too | Form 760 instructions (2025), "Increase in Standard Deduction" and Line 11, PDF pages 7 and 17, https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf ; Virginia Tax, 2026 Legislative Summary (document 26-82, issued 2026-07-06, read 2026-11-14), "Standard Deduction Extended and Increased", https://www.tax.virginia.gov/laws-rules-decisions/legislative-summaries/26-82 |
| Virginia | worked examples | taxable $90,000: $720 + 0.0575 × $73,000 = $4,917.50 (rounded to $4,918); the Smiths, $47,000 joint: $2,445, or $2,225 with the spouse tax adjustment of $220 | Tax Rate Schedule example, https://www.tax.virginia.gov/sites/default/files/vatax-pdf/tax-table-2025.pdf ; 760 instructions (2025), Line 17, PDF page 19 |
| Virginia | Social Security; age deduction | Social Security left out (line 5). From 65, $12,000 a person, cut by $1 for each $1 of federal AGI less taxed Social Security over $50,000 single or $75,000 married (married couples on their joint figure); the full $12,000 for those born on or before January 1, 1939 (**2025**: the 2026 instructions are not out yet) | 760 instructions (2025), Line 4 and the Age 65 and Older Deduction Worksheet, PDF pages 15 and 16; https://www.tax.virginia.gov/subtractions |

**Builder's choices (stage 2).**
- A couple's retirement income is counted together against the two people's limits (Georgia's $35,000 and $65,000 each,
  New Jersey's exclusion when one of them is 62): the plan does not say whose pension or account each dollar is. Where
  one spouse has all of it and only the other qualifies, the figure is a little low. New York does the same since stage 1.
- What Georgia's exclusion covers is what the plan can tell apart: pensions, money out of pre-tax accounts, conversions,
  investment income (the Income page's investment lines; the projection's gains and dividends), rent (Form 500 Schedule 1
  page 2, line 13, "Rental, Royalty, Partnership, S Corp, etc. Income (Losses)"; the `rental` input: the Income page's
  rent lines, or with a place on Rental analysis its result after costs, interest and depreciation as the federal AGI has
  it; in the projection the rent lines paid that year as the engine taxes them; a loss counts against the rest, never below
  0) and $5,000 of pay a person who qualifies (fix round 1, 2026-11-14: rent was left out, so a retired Georgia landlord's
  figure was too high: archetype 08 in Georgia paid $6,386 over its retirement, now $0). Royalties have no line of their
  own in the plan; typed as other income they stay taxed. New Jersey's second exclusion is used only when the pay is
  known to be $3,000 or less.
- New Jersey's and Virginia's income is federal AGI less Social Security. New Jersey starts from its own gross income,
  which does not let IRA, HSA or student loan deductions off and taxes IRA withdrawals less the contributions already
  taxed; for most households the two are close. New Jersey's property tax deduction or credit (up to $15,000 of
  property tax, or 18% of rent) is not counted, and "How this is worked out" says so.
- Virginia's spouse tax adjustment (up to $259 less for a couple who both have income) is not counted: the plan does not
  split a couple's income. Filing separately, Virginia's age deduction is worked on that return's income, not the couple's.
- Virginia's standard deduction by year as enacted (fix round 1, 2026-11-14: the first build used $3,000 / $6,000 from 2027,
  before reading the 2026 budget, which put a Virginia retiree's later years about $356 a person a year high): $9,200 /
  $18,400 in 2027, $9,300 / $18,600 in 2028 and 2029, then $3,000 / $6,000 as the law stands; all four said under "How this
  is worked out". If Virginia extends the higher one again, the years from 2030 here are a few hundred dollars high.
- Georgia, North Carolina, New Jersey and Virginia write their figures in law (none is raised with prices), so later years
  keep them, as New York's. North Carolina's possible later rate cuts depend on its revenue and are not counted.
- Not counted: Georgia's low-income and other credits, military retirement and the overtime and tips subtractions; North
  Carolina's Bailey exclusion; New Jersey's veteran, blind and college-student exemptions, its Special Exclusion and its
  credits; Virginia's low-income and earned income credits.

**Could not be read on 2026-11-14 (stage 2), so not in the table.** Michigan: every page and PDF on www.michigan.gov,
including robots.txt, answers an automated read with "Access Denied" from its edge network (HTTP 403); no other identity
was tried. Pennsylvania and Ohio were tried again: www.revenue.pa.gov still forwards to www.pa.gov, which this session's
network refuses, and tax.ohio.gov still answers with an error page. The three keep the State page's flat rule, so their
answers are exactly today's (tests/state-tax-invariance.test.mjs moves every invented household to each of them).
Tried again in fix round 1 (2026-11-14): pa.gov and Ohio's form PDFs (dam.assets.ohio.gov) are refused by this session's
network; www.michigan.gov answers a request that names itself as a browser, so Michigan can be read next time. "How this is
worked out" says plainly that Pennsylvania, Ohio and Michigan come next, and a household there reads "Pennsylvania income
tax is not counted yet."

## The state line and the page simple first (gap design #40, part 3, 2026-11-14)
**First view** (opt spec C12's line for this page: "the headline and the chart"): the hero as before; its last line now
ends with the state's one sentence (R5, `stateLine`, a test per case): "State tax is not included." (no state chosen),
"Massachusetts income tax is not counted yet." (a state the app has no rules for, named from the State tax page's list,
`stateNameOf`; fix round 1: the bare sentence told a reader there nothing), "Texas has no state income tax.", Washington's (its tax on large gains is
named, not counted), "Illinois takes no income tax from this retirement income." (under $1 in all), or "New York income
tax adds about $27,287 over the same years, $941 a year on average." ("... that year." for one year). With a state tax
the tiles are "Federal tax" (over the plan) and "New York tax" ($27,287 over the plan, $941 a year) in place of "Over
the plan" and "A year" (the hero already gives the federal yearly average), so four tiles stay the budget (fix round 1:
the state's total was only in a small muted sentence). The chart has the state's tax as a second, dashed, muted line when
there is any, and a key under it shows a short solid and dashed sample beside "Federal tax" and "New York income tax". The year list shows six years, then "N more years" (`rest()`); each record ends with
"$404 New York tax"; the wide table has a state column.

**Parts.** "N more years" (kind more, in the year card) and "How this is worked out" (kind how, a card of its own; status:
the state's name): what each year taxes, then the state's rules, one plain line each ("New York:" then "Social Security is
not taxed.", "Pensions and money taken out of retirement accounts: the first $20,000 a person is not taxed from age 59½.",
"A standard deduction comes off first."; no "IRA" or other shorthand on screen), the year of its figures when
some are older ("2026 brackets; the standard deduction and credits are 2025's: the 2026 ones are not out yet"), how later
years move (raised with the plan's inflation, or "stay as written in its law"), the local taxes left out, that the state's
tax is shown here only ("New York's tax is shown here only: Will the money last? does not take it out of your savings
yet."), and where the figures come from. For a state without rules it says the State tax page works this year's out; with no state, to pick
one. Then "More on this": the State tax page, Roth conversions, Will the money last?. Nothing here writes the plan (the
S11 test checks it).

**The formula, each year** (`stateYear`): federal AGI = the year's ordinary income (pensions, a partner's pay, pre-tax
withdrawals, conversions) + its gains and dividends + the taxed part of Social Security, as `core/math/retirement.js` taxes
them; pensions = the projection's pension lines paid that year (age window and years, raised with prices only when the
line has raises, as the engine pays them); withdrawals = the pre-tax money taken out (required withdrawals included);
conversions; the pay lines paid that year as `earned` and the year's gains and dividends as `investment` (stage 2: Georgia's
and New Jersey's exclusions read them); the first two people's ages; no dependents in retirement years. `stateIncomeTax` does the rest (formulas and
sources above). A state that raises its figures with prices (California, Illinois) has them times this year's price level
÷ the price level of the figures' year (2026); New York keeps its figures. In today's dollars every amount is divided by
the year's price level, as the federal rows are.

**Builder's choices.** The state's tax is shown beside the federal tax and is not paid out of the plan's savings (the
federal one is): adding it to the engine would move every Will the money last? answer, which this design does not ask
for; How this is worked out says so, and `success` / `failYear` are the engine's without it. A rate or last year's figure
typed on the State tax page is for this year's income, so it is not used here: a retirement year's income is another
mix (the month's taxes, Budget's `yearTaxes`, do use it). Retirement years count no dependents. Government pensions are not told apart from others (the plan does not say), so New York's full exclusion for them is
not applied: the figure may be a little high for a New York or federal retiree. A person counts as 59½ from the year they
turn 60. Roth conversions are not counted toward New York's $20,000 (not read at the source); Illinois leaves them out (its
Line 5 names Form 1040 line 4b, where conversions are reported).
