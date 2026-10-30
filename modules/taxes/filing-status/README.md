# Filing status compare  (`taxes/filing-status`)

**Status:** usable (phase 6)
**Purpose:** Which way to file: a married couple jointly or separately, a single parent as head of household or single, with this year's federal tax each way and what filing separately gives up.

## Inputs
The plan through `taxes/federal` `taxInputs` and `federalTax` (each option is a full return). Writes nothing.

## Formulas
- Jointly, single, head of household: the plan with that filing status.
- Separately (`separatePlan`): two returns, each with the one spouse as the only adult (filing married separately), their own income lines plus half of the lines with no person, their own retirement contributions, half of every typed tax figure and itemized deduction, half of each sale; the children (and their credits) on the return of the spouse with the larger yearly pay. The total is the two taxes added.
- Cheapest = the lowest tax (ties keep the first, jointly); saving = the status filed now less the cheapest.
- Separate filers lose the student loan interest deduction and the education and dependent-care credits, the Roth IRA closes above $10,000 of income, and both must itemize if one does (IRS Publication 501 and the forms' instructions); an income-driven student loan payment can fall. Listed, not modelled.

## Edge cases
- One adult with no children: one way only. Head of household needs the person to qualify (paying more than half a home's costs for a qualifying person); the page explains it.
- Community-property states split income differently for separate returns: not modelled.

## Tests
`module.test.mjs`: a separate return's contents, the couple each way against returns by hand (the children on the higher yearly earner), a single parent (head of household saves), one adult and nobody.
