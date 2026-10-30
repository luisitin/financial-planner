# State  (`taxes/state`)

**Status:** usable, phase 6
**Purpose:** This year's state income tax: from last year's return, your state's flat rate or your own; what it saves on the federal return, and the same income in other states.

## Inputs
- `household.state` (two-letter code; chosen here or on People).
- The federal estimate (`taxes/federal` compute): adjusted gross income, filing status, the deduction used.
- `taxes.state = { priorTax, priorAgi, rate, deduction, withheld }`, all optional.
- `taxes.itemized.stateTax` (what Federal counts now).

## Outputs
`{ year, code, name, method, agi, rate, allowance, tax, monthly, effective, note, local, withheld, balance, federal: { counted, itemizes, saving, cap }, others: [{ code, name, tax }] }`.

## Formulas
The first source that applies:
1. **Your rate** (`rate`): rate × max(0, AGI − `deduction`).
2. **No tax on wages** (AK, FL, NV, NH, SD, TN, TX, WA, WY): 0. Washington's capital gains tax is named, not computed.
3. **Last year's return**: (state tax ÷ federal AGI, both last year's) × this year's AGI. Graduated rates make the
   share rise a little with income; the error is small for a year-to-year change.
4. **Flat rate** (13 states, 2026): rate × max(0, AGI − allowance − zero band), where the allowance is the state's
   usual deduction and exemptions (table `FLAT`): Arizona the federal standard deduction; Colorado and Iowa
   start from federal taxable income; Kentucky, Louisiana, North Carolina a standard deduction; Illinois,
   Indiana, Michigan per person; Massachusetts per adult and per dependent; Mississippi its first $10,000 and
   Ohio its first $26,050 at nothing. Credits and phase-outs are left out on purpose.
5. Otherwise (graduated states without your figures): no estimate; the page asks for last year's return.

- Monthly = tax / 12. Effective = tax / AGI. Balance = tax − withheld.
- **Federal saving**: the federal estimate run again with `itemized.stateTax` = this tax (the SALT cap and the
  standard-versus-itemized choice applied by `taxes/federal`), minus the federal tax now. "Use on Federal"
  writes the rounded tax to `taxes.itemized.stateTax` after a click.
- **Other states**: the no-tax states at 0 and every flat state's rule on the same AGI and household.

Sources: rates from the Tax Foundation's "State Individual Income Tax Rates and Brackets, 2026" and the states'
enacted schedules (Indiana 2.95%, Kentucky 3.5%, Mississippi 4.0%, North Carolina 3.99%, Ohio's flat 2.75%);
deductions from each state's 2025 instructions. Facts only; no code from PolicyEngine (AGPL), the catalog's seed.
The rates and allowances are in `FLAT` in `compute.js`: check them each January.

## Edge cases
- No state chosen: a hero with the state picker.
- A typed rate wins even in a no-tax state (a city tax, or a move).
- Local income taxes (cities, counties, school districts) in AL, DE, IA, IN, KY, MD, MI, MO, NY, OH, OR, PA:
  noted; add them to your rate.

## Tests
`module.test.mjs`: the state lists, no state, Texas, Illinois by hand, each flat rule by hand, California from
last year's return, the order of sources, withholding, the federal saving and "already counted", the
other-states list.

## Ideas / not yet
- Graduated brackets for the largest states (CA, NY, NJ, GA, VA, MN, OR), each with its source.
- State tax on retirement income and Social Security for the retirement projection.
