# Gifting  (`estate/gifting`)

**Status:** usable (phase 8)
**Purpose:** Gifts you plan or have made, against the yearly amount each giver can give each person tax-free; what needs a gift tax return and how much of the lifetime exemption it uses; front-loading a 529 college plan with five years of gifts at once.

## Inputs
`household.people` (the givers: the adults), `estate.gifts`. Writes `estate.gifts[]`: `{ id, to, from (a person id or "both"), amount, year, kind: "cash"|"529"|"other", superfund (529 only), notes }`.

## Outputs
`compute(plan, { today })` -> `{ year, annualExclusion, lifetimeExclusion, givers, couple, gifts[], byYear[], thisYear, lifetimeUsed, lifetimeLeft, superfund: { perGiver, couple }, count, warnings }`; `byYear[].rows: [{ to, giverId, giverName, counted, room, over }]`, `overTotal`, `needs709`.

## Data
`data/transfer-tax.js` (shared with estate/estate-tax): the basic exclusion ($13,610,000 for 2024 and $13,990,000 for 2025 under Rev. Procs. 2023-34 and 2024-40; $15,000,000 for 2026 under Pub. L. 119-21, the One Big Beautiful Bill Act); the annual exclusion ($18,000 for 2024; $19,000 for 2025 and 2026 under Rev. Procs. 2024-40 and 2025-32); the IRC 2001(c) rate schedule; the five-year 529 election; and the states with an estate or inheritance tax. Later years carry the latest figure forward until the table is updated.

## Formulas
- A gift "from both" is split half each (gift splitting, elected on Form 709). Otherwise it is the named giver's, or the first adult's.
- A 529 gift with `superfund`: per giver, up to 5 x that year's exclusion is counted a fifth a year for five years (IRC 529(c)(2)(B)); anything above it counts in the first year.
- Per year, per recipient and giver: counted = the sum; room = exclusion - counted; over = counted - exclusion (> 0).
- Lifetime exemption used = the sum of "over" per giver; left = the exemption - used. Gift tax is due only once it is used up (not modelled).
- A gift tax return (Form 709, due April 15 of the next year) is needed in a year with anything over, or with a split gift or a 529 election starting.

## Edge cases
- Gifts to a spouse (unlimited for a US-citizen spouse), tuition and medical bills paid directly (IRC 2503(e)) do not count: the page says so; they are not entered.
- Names are matched case-insensitively per recipient.

## Tests
`module.test.mjs`: the federal figures and carry-forward, the rate schedule's bases, the 529 front-load amounts, gifts against the limit (split, spread, the excess in the first year, the lifetime exemption used, Form 709 years, the over-cap warning).

## Ideas / not yet
- Gifts read from the bank files (transfers to family).
- The 709 summary as a printable page.
