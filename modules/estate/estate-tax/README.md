# Estate tax  (`estate/estate-tax`)

**Status:** usable (phase 8)
**Purpose:** Whether the estate could owe federal (or state) estate tax: today, at each death for a couple, and at the end of the plan, and how much of the exemption is left.

## Inputs
`household` (adults, `state`), `accounts` (owners), `insurance.policies` (life cover in force), `estate.gifts` (through estate/gifting: lifetime taxable gifts), `estate.legacy.bequests` (kind `charity`), `estate.stateTax`, the retirement plan (its end balance). Writes `estate.stateTax = { exemption, rate }`.

## Outputs
`compute(plan, { today })` -> `{ year, exclusion, couple, people[], estateToday, lifeCover, charity, single, pair, end, headroom, state, warnings }` (see the JSDoc in compute.js).

## Formulas
- Estate today = net worth + the death benefit of every life policy in force (assumed owned by the insured, so in their estate). Per person: the accounts they own, an equal share of accounts with no owner, the life cover on them.
- Federal tax (`estateTax`) = tentativeTax(taxable estate + lifetime taxable gifts) - tentativeTax(exemption), floored at 0 (IRC 2001(b), 2010); tentativeTax is the IRC 2001(c) schedule (`estate/gifting/data/transfer-tax.js`). Taxable estate = estate - charitable bequests. Exemption: $15,000,000 in 2026.
- One person: that tax on today's estate.
- A couple: the first death owes nothing (the unlimited marital deduction, IRC 2056, for a US-citizen spouse); the unused exemption (DSUE = exemption - that person's taxable gifts) can pass to the survivor if a return is filed (portability, IRC 2010(c)(4)-(5)). Second death: the whole estate against exemption + the smaller DSUE (with portability) or the exemption alone (without), the larger of the two people's gifts added back (conservative).
- End of the plan: the projection's end balance (today's dollars) + homes, vehicles and other assets it does not spend + whole-life death benefits, against one or two exemptions (no gifts, charity off). The exemption is indexed for inflation from 2027, so today's dollars compare like with like.
- State: the household's state in `STATE_ESTATE_TAX` or `STATE_INHERITANCE_TAX` (2026). With an exemption and top rate entered: at most rate x (estate - charity - exemption), flagged as an upper bound (states use graduated rates; most have no portability).
- Warning (couples): when the headroom is less than one exemption, file Form 706 at the first death to keep the unused exemption.

## Edge cases
- Life insurance held in an irrevocable trust is outside the estate: the page mentions it, it is not modelled.
- Non-citizen spouses (no unlimited marital deduction), state portability and the state tables themselves are not modelled.

## Tests
`module.test.mjs`: the tax at and over the exemption with gifts, an empty plan, the family (shares, life cover, both deaths, the end of the plan), a large estate with and without portability and with gifts, charity and a state with its own tax, an inheritance-tax state.

## Ideas / not yet
- State tables (exemptions and graduated rates) once a reliable yearly source is in reach.
- The estate year by year along the plan, with the exemption growing.
