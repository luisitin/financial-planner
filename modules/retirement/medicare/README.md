# Medicare and IRMAA  (`retirement/medicare`)

**Status:** usable (phase 5)
**Purpose:** When each of you signs up for Medicare, what it costs over retirement, and the income surcharge (IRMAA) year by year from the plan's own income, Roth conversions and required withdrawals included.

## Inputs
`household` (birth dates, filing status), the plan (run through the federal brackets for this page), `income` and `retirement.contributions` (working-year income), `retirement.medicare`. Writes `retirement.medicare = { partDPremium, supplementPremium }` (a month each).

## Data
`data/medicare.js`: 2026 Part B $202.90 a month and the $283 deductible; the Part D national base premium $38.99; the IRMAA tiers on 2024 income: single (head of household, qualifying surviving spouse) up to $109,000 / $137,000 / $171,000 / $205,000 / under $500,000 / above, joint up to $218,000 / $274,000 / $342,000 / $410,000 / under $750,000 / above, married filing separately up to $109,000 / under $391,000 / above; Part B $202.90 / $284.10 / $405.80 / $527.50 / $649.20 / $689.90 and Part D add-ons $0 / $14.50 / $37.50 / $60.40 / $83.30 / $91.00 (separate filers: $202.90 / $649.20 / $689.90 and $0 / $83.30 / $91.00). Sources, read 2026-10-31: CMS fact sheet "2026 Medicare Parts B Premiums and Deductibles" (November 14, 2025, https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles) for Part B, the deductible, the tiers and the add-ons; CMS's Part D bid fact sheet of July 28, 2025 for the $38.99. The 2027 base premium, $41.33 (CMS fact sheet of July 28, 2026, https://www.cms.gov/newsroom/fact-sheets/medicare-part-d-2027-national-average-monthly-bid-amount-information; the 6% yearly cap), is `PART_D_BASE_NEXT`: the help text shows it, and the page keeps using one year's figures together until CMS publishes 2027's Part B in November. Update each November.

## Formulas
- Sign-up period (`signup`): the three months before the 65th-birthday month, that month and three after (a birthday on the 1st moves everything a month earlier).
- Income for a year's premiums (MAGI) = the plan's income two years before, in today's dollars: in retirement years, the projection's ordinary income + qualified dividends and gains + taxable Social Security (the brackets' own figures, so conversions and required withdrawals count); in working years (the engine works out no tax), pay of whoever still works less their pre-tax 401(k) and IRA saving, plus the plan's other taxable income that year. Before the plan's first year: its first year.
- Tier = the first line the income is at or under (`tierFor`); premiums per person on Medicare that year = (Part B for the tier + the drug plan + its add-on + any supplement) x 12. Surcharge = (Part B over standard + the add-on) x 12 x people.
- The lower lines rise with prices every year (Social Security Act section 1839(i); 20 CFR 418.1115); the top line ($500,000; $750,000 joint; $391,000 separate, added by the Bipartisan Budget Act of 2018, sec. 53114) is fixed until it starts rising in 2028. The plan keeps them in today's dollars.
- Room = the first line - the income that sets the first Medicare year's premiums.

## Edge cases
- Someone 65 or over: their line says "Medicare age since <month>" instead of a sign-up window; the employer-cover and late-penalty note shows only while someone is under 65 or has no birth date (round 4, 2026-11-02).
- Part A premiums (for people without 40 quarters of work), the Part B deductible beyond its mention, and the SSA-44 appeal for a life-changing event are explained, not modelled.
- A plan on the flat tax rate still gets its income through the brackets here (the page says so).

## Tests
`module.test.mjs`: the tiers (ordering, inclusive lines, separate filers, head of household), sign-up windows, not ready, the family year by year (working-year income, enrollment, lifetime, room), Roth conversions raising the surcharge two years later with plan premiums.

## Ideas / not yet
- Show the surcharge on the Roth conversions page as a cost of each conversion.
- Medigap against Medicare Advantage by expected use.

## In the plan's verdict (2026-11-02)
`retirement/projection` `buildInputs` adds each year's `totalYearly` (Part B, the drug plan, any supplement and the
surcharge, for everyone 65 or over) to the plan as a "Health insurance" engine line, on top of the spending figure, in the years
nobody in the household still works (review fix 2026-11-02, one rule whoever is listed first: while anyone works, a plan
through that job covers the household, as on Healthcare before 65, so those years are not added there and the projection
says which; this page still counts every year from 65, so its lifetime is the projection's Medicare plus those years). Fourth
pass (2026-11-02): a year nobody works is added before the household's retirement year too, and who works is the
projection's `workRule` (a salary, bonus or business line on Income, or "work" in Get started; rent or dividends are not a job).
Left out when `retirement.healthIncluded` is true ("My spending figure already includes health insurance"). When the spending
is carried from today's bills and one of them already pays for Medicare (its name says Medicare, Medigap, Part B or Part D;
or Get started's "Insurance and health" row, for those who have stopped work), that line stays in the spending and pays the
Medicare of the adults 65 or over now; everyone else's is added, per person (each year's `totalYearly` x those left /
`enrolled`: the premium is the same for each person on it). A Medicare line when nobody is 65 yet is someone else's (a
parent's): all of the household's Medicare is added (review fix 2026-11-02: it used to drop all of it). `planIncome` runs `buildInputs(..., { health: false })`, the plan without its own health line: a one-pass
approximation for the income the surcharge is priced on (the premiums' own withdrawals are not in it), and it stops the
recursion (projection -> medicare -> projection). It copies the plan shallowly now (it only reads it). `compute(plan, { today,
planIncome })` takes the run the projection already made (one run shared with Healthcare before 65).

## Two incomes (fifth pass, 2026-11-02)
`planIncome` gives a year's parts (`partsOf(row)`: AGI, tax-exempt interest, untaxed Social Security) and two incomes, one per
law: `magiOf` for this page's surcharge, AGI plus tax-exempt interest (42 USC 1395r(i)(4)(A); 20 CFR 418.1010), and
`acaMagiOf` for the marketplace credit on Healthcare before 65, AGI plus untaxed Social Security plus tax-exempt interest (26 USC
36B(d)(2)(B)). The formulas are `irmaaIncome` and `marketplaceIncome`. Tax-exempt interest is an interest and dividends line on
Income marked untaxed; untaxed Social Security is the benefit less its taxable part (all of it in a working year, whose AGI
leaves Social Security out). Lines are told apart by kind (Social Security, a partner's pay) and Income type, never by name.
This page's figures do not move for any fixture (none holds tax-exempt interest).

## Review 2026-11-06 (sixth pass)
- A partner's pay is told by `type: "pay"` (the base's name for the line; it was `kind: "pay"`).
- In a working year the pay counted is that of whoever works that year by the projection's one work rule (`workRule`): a
  partner Get started says is retired or not working brings none in, whatever Income still holds (it went by age: Lee "retired"
  with her salary on Income added $59,000 to the household's 2030 income).
- An interest and dividends line on Income is never an engine income (the base's other-income rule: the accounts' growth holds
  it, and the brackets count that growth as dividends in AGI), so `exemptInterest` comes to $0 for every plan and nothing is
  added on top of AGI for a muni line (was $3,000 in both incomes in the fifth pass's test). The two formulas stay as they are.

## Review 2026-11-06 (seventh pass: a supplement by default; a husband's or wife's job)
- **Supplement.** `supplementPremium` empty (missing, null or "") is the national average premium for Medigap Plan G, $194 a
  month in 2025 (`MEDIGAP_G = { monthly: 194, year: 2025, read: "2026-11-06" }`): KFF, "Key Facts About Medigap Enrollment and
  Premiums for Medicare Beneficiaries" (October 13, 2026, NAIC data from Mark Farrah Associates), read 2026-11-06; the most common
  supplement, 46% of Medigap policyholders; MedPAC's June 2026 report uses the same series. 0 is no supplement; any other
  figure is taken as typed. It was $0, so Medicare looked cheaper than any cover before 65. Result: `supplement`,
  `supplementDefault`, `supplementYear`. The surcharge is Part B's and the drug plan's alone. Update in October, when KFF
  publishes the next year.
- The page says each person's monthly figure with "(no supplement entered: the national average for Medigap Plan G in 2025;
  yours may differ, below)" and, in one sentence, what is not counted: what you pay at the pharmacy, dental care, glasses,
  hearing aids and long-term care. The fold's help says what an empty box means.
- **Cover through a job.** `spouseYears: [{ year, names, worker }]`: the years someone 65 or over has stopped (by the
  projection's work rule) while a husband or wife still works. A card "Cover through a job" asks it with one tick, "A plan
  through Jo's job covers Rae", saved as `retirement.medicare.jobCoversSpouse` (docs/DATA_MODEL.md); with it the projection's
  health line leaves those years out, without it they are counted. This page's lifetime counts every year either way. Help:
  "Check with the plan first: when the employer has fewer than 20 workers, Medicare usually has to pay first" (Medicare.gov,
  "Who pays first", read 2026-11-06). Saving the drug or supplement figure keeps the tick (the fold merges).
- Working-year income counts each year's own pay (`payOf(id, year)`, the projection's `payYears`).
- Figures: the family's lifetime $179,966 -> $324,302 (+$2,328 a person-year over 62 person-years); the retired couple's
  $148,037 -> $266,765.
- Tests: "seventh pass: no supplement entered counts the national Medigap Plan G average ..." and "seventh pass: spouseYears
  ..."; both failed on the base.
- Verify of the seventh pass (2026-11-06): `spouseYears` leaves out someone whose Medicare a line on Expenses already pays (the
  projection's `expensesCarried`: Will the money last? keeps that line, so the tick changed nothing while its notice said
  "Pat's Medicare is left out"), and `healthIncluded` (the plan's "my spending figure already includes health insurance") hides the
  "Cover through a job" card, or says "Will the money last? adds no health insurance now" while the tick is on: the card said that
  page counted the Medicare it does not add. Test: "verify 2026-11-06: no tick question for someone whose Medicare a line on
  Expenses pays ..." (failed on the seventh pass's patch).

Review 2026-11-06 (round 7): the sign-up lines ("You: sign up between ...") and the "Cover through a job" card ("your spouse is 65 or over while you still work ... a plan through your job covers your spouse") say you/your for the unnamed first adult ("Me"), with the verb to match; typed names read as before (core/words.js). Words only: no figure or rule changed.

## Simple first (2026-11-13)
The first view keeps the answers: when to sign up, what it costs, a job's health cover, and the surcharge's one line (how far
the plan's income is under the first line, or the first year over it). Folded, through `core/ui/more.js`:
- "Year by year" shows six years, then "N more years" with the rest (`rest`, docs/OPTIONAL.md R19). It used to show 12 years
  and "And 21 more years to the end of the plan." with no way to see them; every year is now one tap away.
- One card of quiet rows at the end: "Set my own numbers" (the drug plan and supplement premiums, the form that was the
  hand-written "Your plans' premiums" fold; its status counts what you typed, else "national averages"; open on the draw
  after a save) and "How this is worked out · 6 income lines" (the two-years-before rule, the lines for your return with
  yours marked, and what income counts).
The family's first view went from 625 words and 61 figures to 390 and 23 (`tests/first-view.known.json` lowered to match).
Figures unchanged. Test: `module.test.mjs` "S11".
