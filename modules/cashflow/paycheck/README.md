# Paycheck  (`cashflow/paycheck`)

**Status:** usable, phase 4 (built by claude-b from codex's idle lane)
**Purpose:** Follows your paycheck from pay to take-home: what comes out before tax, the taxes withheld, Social Security
and Medicare, and what your employer adds.

## Inputs
- Every adult with a salary on the Income page (`income[]`, `type: "salary"`, not one-off, linked to the person): the
  pay of all their salaries together, the paychecks a year from the largest one's period (weekly 52, every two weeks 26,
  twice a month 24, monthly 12; a yearly or quarterly figure assumes 26, said so).
- `retirement.contributions[]` of the person: to a `401k` account = the 401(k) before tax; to an `hsa` account = the HSA;
  `employerMatch` (a year) = what the employer adds.
- `whatIfs.benefits[personId]` (career/benefits): `fsaElect`, `dcfsaElect`, `transitMonthly`, `parkingMonthly`,
  `hsaElect`, `hsaEmployer`, `esppOffered`/`esppPct` when nothing is typed here.
- `taxes.withholding[self|partner].perPaycheck` (taxes/withholding) when its period matches; the household's filing
  status (`taxes/federal` `taxInputs`, whose year picks the tables); the state's rate (`taxes/state`).
- `whatIfs.paycheck[personId] = { paychecks, federal, w4Status, step2, credits, otherIncome, deductions, extra, health,
  hsa, fsa, dcfsa, commuter, roth, afterTax, state }`: amounts a paycheck except the W-4's Step 3 and 4(a)/(b) (a year).
- Writes `whatIfs.paycheck`; "Use $X on the Withholding page" writes `taxes.withholding[self|partner] = { perPaycheck, period }`.

## Outputs
`compute(plan, { today })` -> `{ ready, why, year, people: [{ id, name, key, jobName, period, paychecks, paychecksFrom,
gross, pretax, pretaxTotal, wages: { federal, fica, state }, federal: { amount, from, w4, estimate, tableYear, rate }, ss,
medicare, state: { amount, from, rate }, aftertax, aftertaxTotal, taxesTotal, net, monthly, yearly, ssStopsAfter,
extraMedicareFrom, employer: { match, hsa, payroll }, shares, jobs }], notes, stateMethod }`.

## Formulas
- **Pay a paycheck** = the person's salaries a year ÷ paychecks.
- **Before tax**: the 401(k) (the plan's contributions ÷ paychecks); health, dental and vision cover (typed); the HSA,
  the health FSA, the child care FSA and transit/parking (typed here, else the plan's HSA saving or the Benefits page's
  elections, ÷ paychecks).
- **Taxable pay**: for income tax = pay − everything before tax; for Social Security and Medicare = pay − everything
  except the 401(k) (a 401(k) deferral is still wages for them, IRC 3121(v)(1)(A); cafeteria-plan items, IRC 125 and
  3121(a)(5)(G), and commuting, IRC 132(f), are not); for the state = income-tax pay, + the 401(k) in Pennsylvania, + the
  HSA in California and New Jersey (`career/benefits` `K401_TAXED_STATES`, `HSA_TAXED_STATES`).
- **Federal income tax**: the pay stub's figure typed here; else the Withholding page's (same period); else the IRS
  percentage method for automated payroll, W-4 from 2020 or later (Publication 15-T (2026), Worksheet 1A, dated Dec 3,
  2025, checked 2026-10-30): annual = taxable pay × paychecks + Step 4(a); less Step 4(b) and, without the Step 2 box,
  $12,900 married filing jointly / $8,600 otherwise (line 1g); the annual table's base + its rate × the amount over the
  row's start (the Step 2 checkbox tables when ticked; `data/withholding.js`, the published bases kept as printed); ÷
  paychecks; less Step 3 ÷ paychecks (not below 0); + Step 4(c). The W-4 status defaults to the household's: married
  filing jointly (and a qualifying surviving spouse) → married filing jointly, head of household → head of household,
  else single.
- **Social Security** = 6.2% of its taxable pay; it stops once this job's pay reaches the wage base ($184,500 in 2026):
  after paycheck ⌈base ÷ pay⌉ (a second job's excess comes back on the tax return). **Medicare** = 1.45%, + 0.9% on pay
  over $200,000 from one employer in the year (IRC 3101, 3102(f)): from paycheck ⌊200,000 ÷ pay⌋ + 1.
- **State**: typed, else the State tax page's rate × the state's taxable pay (its average rate when worked from last
  year's return, said there); "none in your state" for a state without income tax. Local income taxes are not counted (a note in states
  that have them).
- **After tax**: a Roth 401(k) and other deductions typed here; the stock purchase plan from the Benefits page (its
  percentage of pay).
- **Take-home** = pay − before tax − the taxes − after tax. A month = (take-home × paychecks + the Social Security not
  taken after the wage base − the 0.9% above $200,000) ÷ 12. Of each $100: taxes, saved (401(k), HSA, Roth 401(k)),
  benefits (the rest taken out), take-home.
- **The employer** adds the match (the plan's `employerMatch` ÷ paychecks) and its HSA money, and pays its own 6.2% and
  1.45% on the same pay.

## Edge cases
- No salary: an empty state pointing to Income; a salary linked to no one: says to set Whose there.
- Two earners both "married filing jointly" on the W-4 without Step 2: a note that this usually withholds too little.
- Bonuses: a note (22% flat, 37% above $1 million); they are not in the regular paycheck.
- Choices made: the tables are 2026's (the federal tax year's, falling back to the nearest); a W-4 from 2019 or earlier
  (allowances) is not modelled: type the pay stub's figure. Several salaries for one person are taken as one paycheck.

## Tests
`module.test.mjs` (11): the 2026 tables against their own arithmetic; Worksheet 1A by hand (single), the Step 2 box,
Steps 3, 4(a), 4(b), 4(c), married filing jointly, head of household, under the first row; the W-4 status; the family's
paychecks (the 401(k) before income tax only); cafeteria-plan items and the Benefits page's elections; the wage base and
the 0.9% over the year; the pay stub's and the Withholding page's federal figure, the state at Pennsylvania's rate;
the employer's part; paychecks from the period, typed or assumed, a Roth 401(k); not ready.

## Ideas / not yet
- A W-4 from 2019 or earlier (allowances, $4,300 each in 2026), supplemental pay, local taxes, the year-to-date view
  from a real pay stub, the state's own withholding tables.
