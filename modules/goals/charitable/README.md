# Giving  (`goals/charitable`)

**Status:** usable (phase 4)
**Purpose:** What a year's giving saves in federal tax and really costs, and three ways to give the same and pay less: bunching several years of gifts into one, giving shares that have grown instead of cash, and giving straight from an IRA after 70 1/2.

## Inputs
The plan's federal tax inputs (`taxes/federal` `taxInputs`, run again with different gifts), `taxes.itemized.charitable` (the default gift), `household` (ages), `accounts` (an IRA or 401(k)), `whatIfs.charitable`. Writes `whatIfs.charitable = { yearly, bunchYears, gainShare }`.

## Formulas
- `taxWith(plan, { gift, gains })`: the plan with `taxes.itemized.charitable` = gift (the itemized path, with the 0.5% floor from 2026) and `charitableCash` = gift (the non-itemizer deduction from 2026: up to $1,000, $2,000 joint, IRC 170(p)), plus any extra long-term gains, through `federalTax`.
- Saved = tax without gifts - tax with the year's gift; real cost = gift - saved.
- Bunching N years (2 to 5, 3 by default): giving the same every year costs N x tax(gift); bunching costs tax(N x gift) + (N - 1) x tax(0); saving = the difference (negative when bunching costs more, as when the standard deduction wins either way).
- Shares that have grown: capital gains tax avoided = tax(gift, plus gift x growth share of long-term gains) - tax(gift).
- IRA gifts (qualified charitable distributions, IRC 408(d)(8)): an adult aged 70 1/2 or more this year with an IRA or 401(k); up to about $108,000 a year (2025, indexed).

## Tests
`module.test.mjs`: a standard-deduction household (the $2,000 cap at 22%, bunching that costs more, the totals by hand), an itemizing household (bunching saves), shares that have grown (15% on the gain) and the plan's own gift replaced, IRA gifts after 70 1/2.
