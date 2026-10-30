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
- `taxes.hsa` (taxes/hsa-fsa, "HSA and FSA"): `contribution`, `fsa` and `employer`, counted for the first adult.
- The Benefits elections page (`career/benefits` `compute`, run for each person): its HSA, health FSA, child care FSA,
  transit and parking and stock-purchase-plan figures, already capped by its limits, only when its plan year is the
  paycheck's year (from October it plans next year's, and a note says they are left out).
- `taxes.withholding[self|partner].perPaycheck` (taxes/withholding, "Withholding check") when its period has the same
  number of paychecks; the household's filing status (`taxes/federal` `taxInputs`, whose year picks the tables); the
  State page (`taxes/state`: `tax`, `agi`, `method`).
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
- **Before tax**: the 401(k) (the plan's contributions ÷ paychecks); health, dental and vision cover (typed); the HSA
  (typed, else the HSA and FSA page's, else the plan's HSA saving, else Benefits elections), the health FSA (typed, else
  the HSA and FSA page's, else Benefits elections), the child care FSA and transit/parking (typed, else Benefits
  elections), each a year ÷ paychecks.
- **Taxable pay**: for income tax = pay − everything before tax; for Social Security and Medicare = pay − everything
  except the 401(k) (a 401(k) deferral is still wages for them, IRC 3121(v)(1)(A); cafeteria-plan items, IRC 125 and
  3121(a)(5)(G), and commuting, IRC 132(f), are not); for the state = income-tax pay, + the 401(k) in Pennsylvania, + the
  HSA in California and New Jersey (`career/benefits` `K401_TAXED_STATES`, `HSA_TAXED_STATES`).
- **Federal income tax**: the pay stub's figure typed here; else, when no W-4 choice is typed here, the Withholding
  check page's figure if it is for the same number of paychecks; else the IRS
  percentage method for automated payroll, W-4 from 2020 or later (Publication 15-T (2026), Worksheet 1A, dated Dec 3,
  2025, checked 2026-10-30): annual = taxable pay × paychecks + Step 4(a); less Step 4(b) and, without the Step 2 box,
  $12,900 married filing jointly / $8,600 otherwise (line 1g), the result (line 1i) to the cent (Pub 15-T p.9 allows
  rounding; it stops a sum such as 415.03 × 260 + 1,030.20 landing a floating-point hair below a row's start); the
  annual table's base + its rate × the amount over the
  row's start (the Step 2 checkbox tables when ticked; `data/withholding.js`, the published bases kept as printed); ÷
  paychecks; less Step 3 ÷ paychecks (not below 0); + Step 4(c). The W-4 status defaults to the household's: married
  filing jointly (and a qualifying surviving spouse) → married filing jointly, head of household → head of household,
  else single.
- **Social Security** = 6.2% of its taxable pay; each employer stops at the wage base ($184,500 in 2026) of its own
  pay (IRC 3121(a)(1)): with one job, after paycheck ⌈base ÷ pay⌉, the paycheck in which the year's pay reaches the base
  (a year landing exactly on it at its last paycheck gives that paycheck; the page mentions it only when it comes before
  the last); with several, each job's share of the pay counted
  separately (the excess over one base comes back on the tax return). **Medicare** = 1.45%, + 0.9% on pay over
  $200,000 from one employer in the year (IRC 3101, 3102(f); IRS Publication 15 (2026)): from paycheck
  ⌊200,000 ÷ pay⌋ + 1, per job (exactly $200,000 is not above it).
- **State**: typed, else the State page's tax ÷ its income (the household's average after its allowances and
  deductions, not the top rate) × the state's taxable pay; "none in your state" for a state without income tax. Local income taxes are not counted (a note in states
  that have them).
- **After tax**: a Roth 401(k) and other deductions typed here; the stock purchase plan from the Benefits page (its
  percentage of pay).
- **Take-home** = pay − before tax − the taxes − after tax. A month = (take-home × paychecks + the Social Security not
  taken after the wage base − the 0.9% above $200,000) ÷ 12. Of each $100: taxes, saved (401(k), HSA, Roth 401(k), the
  stock purchase plan), benefits (the rest taken out), take-home, in whole dollars that add up to 100 (`hundred`: each
  part's floor, the largest remainders take what is left).
- **The employer** adds the match (the plan's `employerMatch` ÷ paychecks) and its HSA money, and pays its own 6.2% and
  1.45% on the same pay.

## Edge cases
- No salary: an empty state pointing to Income; a salary linked to no one: says to set Whose there.
- Two earners both "married filing jointly" on the W-4 without Step 2: a note that this usually withholds too little
  (worded as an assumption until the W-4s are typed). A yearly or quarterly salary: 26 paychecks assumed, in a note and
  on the card. Pay linked to no adult (household pay, a removed person, a child): the empty state says to set Whose.
- Bonuses: a note (22% flat, 37% above $1 million); they are not in the regular paycheck.
- Choices made: the tables are 2026's (the federal tax year's, falling back to the nearest); a W-4 from 2019 or earlier
  (allowances) is not modelled: type the pay stub's figure. Several salaries for one person are taken as one paycheck.

## Tests
`module.test.mjs` (16): the 2026 tables against their own arithmetic and the 2026 standard deductions; Worksheet 1A by
hand (single), the Step 2 box, Steps 3, 4(a), 4(b), 4(c), married filing jointly, head of household, under the first
row, a row's start reached exactly; the wage base reached at the last paycheck, $200,000 reached exactly; the W-4 status; the family's paychecks (the 401(k) before income tax only, the shares, the W-4 note assumed or
typed); `hundred`; cafeteria-plan items, Benefits elections capped and only for this year; the HSA and FSA page's
figures, an HSA as state pay in California; two jobs; the Withholding check page's figure only for the same paychecks
and without a typed W-4; the state's share of income (Colorado), typed state figures; the pay stub's figure and
Pennsylvania's 401(k); the employer's part; paychecks from the period, typed or assumed, a Roth 401(k); not ready,
pay linked to a child.

## Answer key
`tests/golden-paycheck.test.mjs` checks `withholdFederal` against 3,000 rows of Publication 15-T (2026) Worksheet 1A
(every table row's start, a cent below and above, for each status and both Step 2 choices; 1 to 260 paychecks) and
`compute`'s Social Security, Medicare, the paycheck the wage base is reached and the first with the 0.9% against 1,500
one-job years, all worked independently from Publications 15-T and 15 (`tools/golden_paycheck`,
`tests/golden/paycheck/RULES.md`) and recomputed to the cent by a separate audit. It found the floating-point edge at a
row's start and the year landing exactly on the wage base, both fixed above. The printed single, Step 2 checkbox table
is not continuous (the IRS rounded two row starts and one base: −$0.12 at 108,938, +$0.18 at 328,350); the page and
the key both follow the printed table, as payroll software does.

## Ideas / not yet
- A W-4 from 2019 or earlier (allowances, $4,300 each in 2026), supplemental pay, local taxes, the year-to-date view
  from a real pay stub, the state's own withholding tables.
