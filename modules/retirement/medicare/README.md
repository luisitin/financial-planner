# Medicare and IRMAA  (`retirement/medicare`)

**Status:** usable (phase 5)
**Purpose:** When each of you signs up for Medicare, what it costs over retirement, and the income surcharge (IRMAA) year by year from the plan's own income, Roth conversions and required withdrawals included.

## Inputs
`household` (birth dates, filing status), the plan (run through the federal brackets for this page), `income` and `retirement.contributions` (working-year income), `retirement.medicare`. Writes `retirement.medicare = { partDPremium, supplementPremium }` (a month each).

## Data
`data/medicare.js`: 2026 Part B $202.90 a month and the $283 deductible; the Part D national base premium $38.99; the IRMAA tiers on 2024 income: single (head of household, qualifying surviving spouse) up to $109,000 / $137,000 / $171,000 / $205,000 / under $500,000 / above, joint up to $218,000 / $274,000 / $342,000 / $410,000 / under $750,000 / above, married filing separately up to $109,000 / under $391,000 / above; Part B $202.90 / $284.10 / $405.80 / $527.50 / $649.20 / $689.90 and Part D add-ons $0 / $14.50 / $37.50 / $60.40 / $83.30 / $91.00 (separate filers: $202.90 / $649.20 / $689.90 and $0 / $83.30 / $91.00). Source: CMS's 2026 fact sheets (November 14, 2025) as reported by SSA and secondary sources that agree; cms.gov was not reachable from the build session. Update each November.

## Formulas
- Sign-up period (`signup`): the three months before the 65th-birthday month, that month and three after (a birthday on the 1st moves everything a month earlier).
- Income for a year's premiums (MAGI) = the plan's income two years before, in today's dollars: in retirement years, the projection's ordinary income + qualified dividends and gains + taxable Social Security (the brackets' own figures, so conversions and required withdrawals count); in working years (the engine works out no tax), pay of whoever still works less their pre-tax 401(k) and IRA saving, plus the plan's other taxable income that year. Before the plan's first year: its first year.
- Tier = the first line the income is at or under (`tierFor`); premiums per person on Medicare that year = (Part B for the tier + the drug plan + its add-on + any supplement) x 12. Surcharge = (Part B over standard + the add-on) x 12 x people.
- The lines rise with prices from 2028; the plan keeps them in today's dollars.
- Room = the first line - the income that sets the first Medicare year's premiums.

## Edge cases
- Part A premiums (for people without 40 quarters of work), the Part B deductible beyond its mention, and the SSA-44 appeal for a life-changing event are explained, not modelled.
- A plan on the flat tax rate still gets its income through the brackets here (the page says so).

## Tests
`module.test.mjs`: the tiers (ordering, inclusive lines, separate filers, head of household), sign-up windows, not ready, the family year by year (working-year income, enrollment, lifetime, room), Roth conversions raising the surcharge two years later with plan premiums.

## Ideas / not yet
- Show the surcharge on the Roth conversions page as a cost of each conversion.
- Medigap against Medicare Advantage by expected use.
