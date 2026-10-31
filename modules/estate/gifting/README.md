# Gifting  (`estate/gifting`)

**Status:** usable (phase 8)
**Purpose:** Gifts you plan or have made, against the yearly amount each giver can give each person tax-free; what needs a gift tax return and how much of the lifetime exemption it uses; front-loading a 529 college plan with five years of gifts at once.

## Inputs
`household.people` (the givers: the adults), `estate.gifts`. Writes `estate.gifts[]`: `{ id, to, from (a person id or "both"), amount, year, kind: "cash"|"529"|"other", superfund (529 only), notes }`.

## Outputs
`compute(plan, { today })` -> `{ year, annualExclusion, lifetimeExclusion, givers, couple, gifts[], byYear[], thisYear, lifetimeUsed, lifetimeLeft, superfund: { perGiver, couple }, count, warnings }`; `byYear[].rows: [{ to, giverId, giverName, counted, room, over }]`, `overTotal`, `needs709`.

## Data
`data/transfer-tax.js` (shared with estate/estate-tax), from 2011 (`FIRST_YEAR`; gifts are entered from then): the basic exclusion ($5,000,000 in 2011 ... $11,180,000 in 2018, $12,920,000 in 2023, $13,610,000 for 2024 and $13,990,000 for 2025, each year's revenue procedure and the Instructions for Form 706 (Rev. July 2026) table; $15,000,000 for 2026 under Pub. L. 119-21, the One Big Beautiful Bill Act); the annual exclusion ($13,000 in 2011-2012, $14,000 in 2013-2017, $15,000 in 2018-2021, $16,000 in 2022, $17,000 in 2023, $18,000 for 2024; $19,000 for 2025 and 2026 under Rev. Procs. 2024-40 and 2025-32; all read 2026-10-31); the IRC 2001(c) rate schedule; the five-year 529 election; and the states with an estate or inheritance tax. Later years carry the latest figure forward until the table is updated.

## Formulas
- A gift "from both" is the couple's consent to split gifts for its year (Form 709), and the consent covers every gift either spouse made to someone else that year: in a year with a gift from both, every gift is counted half each (IRC 2513(a)(2): "all such gifts made during the calendar year by either"; 26 CFR 25.2513-1(b)(5); the Form 709 instructions: "you must split all gifts made by you and your spouse to third-party donees"). The page marks those gifts and says why. In other years a gift is the named giver's, or the first adult's.
- 529 gifts: after splitting, one total per giver, child and year (IRC 529(c)(2)(B): "such aggregate amount"). With `superfund` ticked on any of them and the total over that year's exclusion, up to 5 x the exclusion is counted a fifth a year for five years and anything above it in the first year (proposed 26 CFR 1.529-5(b)(2); the Form 709 instructions: "up to $95,000"). At or under the exclusion there is nothing to spread (the statute's "exceeds"): it counts in its own year, and the page says so.
- Per year, per recipient and giver: counted = the sum; room = exclusion - counted; over = counted - exclusion (> 0).
- Lifetime exemption used = the sum of "over" per giver; left = max(0, the exemption - used) (a used-up credit leaves 0, IRC 2505). Gift tax is due only once it is used up (not modelled).
- A gift tax return (Form 709, due April 15 of the next year) is needed in a year with anything over, or with a split gift or a 529 election starting.

## Edge cases
- Gifts to a spouse (unlimited for a US-citizen spouse), tuition and medical bills paid directly (IRC 2503(e)) do not count: the page says so; they are not entered.
- Names are matched case-insensitively per recipient.

## Tests
`module.test.mjs`: the federal figures and carry-forward, the rate schedule's bases, the 529 front-load amounts, gifts against the limit (split, spread, the excess in the first year, the lifetime exemption used, Form 709 years, the over-cap warning). The figures for 2011-2023, a year with a gift from both splitting every gift, 529 totals (at or under the limit, one total, one cap). `tests/golden-estate.test.mjs` checks the page against 1,000 gift plans of an independent answer key (`tools/golden_estate`).

## Ideas / not yet
- Gifts read from the bank files (transfers to family).
- The 709 summary as a printable page.
