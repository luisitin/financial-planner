# Home  (`property/home`)

**Status:** usable, phase 7
**Purpose:** Your home: what it is worth and what you own of it, what it costs a year to keep, what selling would leave, and value and equity ahead.

## Inputs
- The home: the property account named by a `property[]` entry with `kind: "home"`, else the largest property account
  (its `balance`, `asOf` and `history`).
- That entry's details: `{ purchasePrice, purchaseDate, improvements, propertyTax, insurance, hoaMonthly, maintenance, appreciation, sellCosts, reducedReason }`
  (property tax falls back to `taxes.itemized.propertyTax`).
- The mortgage (`debt/mortgage`: balance, rate, payment, extra, the yearly schedule); the federal estimate's inputs
  (`taxInputs`, `federalTax`) in today's tax year (`todaysReturn`).
- Writes: the home's details; "Update value" sets the account's balance and `asOf`, keeping the old value in `history`.

## Outputs
`{ ready, accountId, name, value, owed, mortgageName, equity, equityShare, ltv, details, bought: { price, date, years, growth, gain } | null, history, costs: { lines, total, monthly, principal }, sale: { costs, basis, gain, cap, capEach, owners, exclusion, excluded, taxable, term, longOn, test: { days, months, meets, from }, reduced, dateMissing, rate, tax, niit, niitLine, incomeTax, year, otherYear, filingStatus, net }, ahead: [{ years, year, value, owed, equity }], appreciation, pmi }`.

## Formulas
- Equity = value − mortgage; loan-to-value = mortgage ÷ value (above 80% lenders usually require mortgage insurance).
- Growth since bought = (value ÷ price)^(12 / months owned) − 1.
- A year: property tax + insurance + dues × 12 + upkeep (default 1% of the value) + the mortgage's interest over the next
  twelve payments (`yearOfPayments`); the principal part is shown apart (it is not a cost).
- Selling today: costs = value × 6% (agent and closing; your own share); gain = value − costs − (price + improvements).
  A loss on your own home is not deductible.
- **The two-year test** (`twoYearTest`): the gain is tax-free up to $250,000, $500,000 on a joint return (IRC 121(b)(1)-(2)),
  only when the home was owned and lived in as the main home for 2 of the 5 years before the sale (121(a)): "24 full
  months or for 730 days (365 x 2)" (26 CFR 1.121-1(c)(1)), whichever comes first. Days are counted from the day after the
  purchase with the sale day included (Pub. 550 Holding Period; 1.121-1(c)(4) Example 3), which is the plain difference of
  the dates. Full months end on the same day of a later month; a purchase on a month's last day completes a month on each
  later month end, and a day the month lacks falls back to its last day (the answer key's convention L1). So a home bought
  2025-05-16 and sold 2026-11-16 has 549 days and 18 months: no exclusion. The page assumes the home has been the main home
  since it was bought (it says so). `test.from` is the first day the test is met. No purchase date: the test is taken as met
  and the gain as long-term, but the page says so (`dateMissing`): it asks for the date and words the tax-free part "if you
  have owned and lived in it two of the last five years".
- **Selling early for a reason** (`reducedReason`, ticked in the details): a sale before two years because of a change of
  workplace, health or unforeseen circumstances keeps part of the cap (121(c)): cap × the share of the two years owned,
  by days (/ 730) or by full months (/ 24), whichever is larger (26 CFR 1.121-3(g)(1): the period "may be expressed in days
  or months"). Whether a reason qualifies is the owner's call (1.121-3(c)-(e) list the safe harbors); the page does not test it.
- **Short or long** (`term`, `longOn`): long-term when held more than one year, counted from the day after the purchase
  (IRC 1222(3); Pub. 550; Tax lots' `longOn`); a year or less is short-term and taxed like pay.
- **The tax**: the federal estimate's total tax with the taxable gain added (to the qualified income when long-term, to
  ordinary income when short-term, and to the investment income for the 3.8% tax) less the total without, in today's tax
  year. So a long-term gain is stacked on the year's other income through that year's own 0/15/20% bands for the filing
  status (IRC 1(h); Form 1040 Qualified Dividends and Capital Gain Tax Worksheet; Rev. Procs. 2024-40, 2025-32), and the
  3.8% falls on the lesser of the gain and the income over the line for the filing status (`niitLine`, from the engine's
  table: 200,000; 250,000 joint or a qualifying surviving spouse; 125,000 separate; IRC 1411(a)(1), (b)); the excluded part
  is not investment income (26 CFR 1.1411-4(d)(3)(ii) Example 3). `niit` is the 3.8% part, the short-term sentence names it
  too, `incomeTax` the rest, `rate` = tax ÷ taxable gain (shown nowhere: the bands matter). Keep = value − costs − mortgage − tax.
- **Filing separately** (two returns): the home's account in one spouse's name puts the whole gain on their return with
  their own $250,000; in neither name it is half each, each half with its own $250,000 (`owners` 2, `cap` 500,000, `capEach`
  250,000): 26 CFR 1.121-2(a)(2), Joint owners: "If taxpayers jointly own a principal residence but file separate returns,
  each taxpayer may exclude from gross income up to $250,000 of gain that is attributable to each taxpayer's interest in the
  property, if the requirements of section 121 have otherwise been met" (read 2026-10-31; the federal estimate halves income
  in neither name the same way). Each half is added to that spouse's return (`addIncome` in taxes/federal).
- Later on 2026-10-31 a review found: filing separately one $250,000 was set against the whole gain on Me's return; no
  purchase date was assumed met without a word; the short-term sentence hid the 3.8%; the 3.8% line said 200,000 for a
  qualifying surviving spouse. All fixed.
- Until 2026-10-31 the page applied the exclusion whatever the dates, taxed every gain at 15% or 20% using 2025's single
  and joint lines for every year and status, and the 3.8% on the whole gain; the answer key found all four (below).
- Ahead: value × (1 + growth, default 3.5%)^years; owed = the mortgage page's schedule `endBalance` for that year
  (0 once it ends). Not in today's dollars.

## Edge cases
- No property account: a hero pointing to Accounts. No mortgage: all of it is yours.
- No purchase price: growth and the gain are not shown; the exclusion is explained. A price without a date: see above.

## Tests
`module.test.mjs`: growth, not ready, the house by hand, a year of costs (with and without a tax figure), selling under the
exclusion, a large gain above it, the years ahead against the mortgage schedule, the two-year test (a February 29 inside,
month ends), the answer key's worked examples (Pat: 4,110 at 18 months, 6,040 short-term, the reduced exclusion 188,013.70;
Quinn: 87,260 with 16,340 of 3.8%), filing separately (a home in neither name: 179,000 on each return, no tax; in one
name: 108,000 taxed, 18,974 with 2,774 of 3.8%), no purchase date flagged, the 3.8% line for a qualifying surviving spouse. `tests/golden-property.test.mjs`: an independent answer key (`tools/golden_property`,
1,500 home sales for 2025 and 2026 worked from IRC 121, 1222, 1(h) and 1411, 26 CFR 1.121-1, 1.121-3 and 1.1411-4, Pub. 523
and the Rev. Procs., never from this code; `tests/golden/property/RULES.md`). Every row agrees since 2026-10-31, the days,
months, test, term and exclusion included. It found four causes, all fixed: the two-year test, the short-term rate, the
flat rate with 2025's lines, and the 3.8% on the whole gain.

## Ideas / not yet
- Refinance and recast live on Debt > Mortgage; a link from here when rates fall below the mortgage's.
- Property tax appeals: the assessment against the value typed here.

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** The tax on selling the home is the tax it adds to this year's return. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. The gain is stacked on the Federal estimate's return (`taxView()`), so a retiree's Social Security and withdrawals are in the bracket the gain starts from.

## Year you bought it (2026-11-07, owner's request)
The home's details have a "Year you bought it" box beside the exact date. Blank, it shows our guess in grey and in words ("Our guess:
2024. Most owners your age bought in the last few years."); typed, it is saved as the purchase date, July 1 of that year, unless an exact
date in that year is already there (`purchaseDateFrom`, pure and tested). Changing only the year replaces the date; changing the date
wins over the year. The mortgage's years left, balance and payment follow the year on every page. Not a year, or one still ahead: a
message and nothing saved.
