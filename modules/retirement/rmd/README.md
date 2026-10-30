# Required withdrawals  (`retirement/rmd`)

**Status:** usable (phase 5)
**Purpose:** When the tax rules make you take money out of pre-tax accounts, and how big those withdrawals look.

## Inputs
`household`, `accounts` (401(k), IRA, insurance cash value), the projection (for the sizes).

## Outputs
`people[]` (startAge, startYear, yearsUntil, firstRmd nominal and real), `schedule[]` from the projection (year, age, factor, rmd, rmdReal, taxes, deferredEnd), `totalRmdReal`, `table[]` (ages 72-100), `hasDeferred`.

## Formulas
`core/math/rmd.js`: IRS Publication 590-B Table III (Uniform Lifetime Table, in effect from 2022); start age 70½ for people born before July 1, 1949 (the year they reach it: their 70th for a birthday in January to June, their 71st from July), 72 for July 1949 to 1950, 73 for 1951-1959, 75 from 1960 (SECURE 2.0). Required amount = each owner's prior year-end balance in their own 401(k)s and IRAs / the factor for the age they reach that year; the projection keeps each owner's slice of the pre-tax bucket (`rmd.owners` in the engine), an account with no owner belongs to the first person, and life-insurance cash value (in the same bucket) has none.

## Tests
`tests/retirement.test.mjs` (table, start ages, amounts) and `tests/retirement-pages.test.mjs` (the page).

## Independent answer key and source audit

`tests/golden/retirement/rmd.csv` contains 1,100 invented cases, replayed by
`tests/golden-retirement.test.mjs`. Each of eleven rules has 60 grid, 30 edge,
and 10 extreme cases. The full layout, assumptions, and rule inventory are in
`tests/golden/retirement/briefs/rmd.md`; the independent Python generator is
`tools/golden_retirement/rmd.py`. Monetary answers are calculated without
intermediate rounding and serialized to cents; factors and rates use six decimals.
Every tenth case has a second derivation recorded in its note.

The source for the factors is [IRS Publication 590-B, Appendix B, Table III](https://www.irs.gov/publications/p590b),
read on 2026-10-26. For example, the age-73 factor is 26.5, so an invented
$100,000 prior December 31 balance requires $100,000 / 26.5 = $3,773.58.
The page displays ages 72 through 100, while the published table extends to
age 120 and over. The helper's Infinity below age 72 and completed-age lookup
for fractional inputs are interface conventions, not historical tax rules.

The publication's IRA Owners section requires age 70.5 for birthdays before
July 1, 1949, and age 72 for July 1, 1949 through 1950; the original README's
"72 before" therefore omits an older cohort. Age 73 applies to 1951 through
1959; age 75 for 1960 and later follows
[SECURE 2.0, section 107](https://www.congress.gov/117/plaws/publ328/PLAW-117publ328.pdf).
Birth month determines the calendar year age 70.5 is reached. Fixed
2026-10-30 (F-030): `rmdStartAge` and `rmdStartYear` take the birth date.

The publication calculates an owner's required distribution from that owner's
accounts. A spouse's IRA is not part of that owner's balance: two invented
$100,000 IRAs owned by two age-73 adults each require $3,773.58; the household
total is $7,547.17 before rounding the individual outputs. Fixed 2026-10-30
(F-030): each person's balance and first withdrawal are their own.

Ordinary life-insurance cash value does not by itself become an IRA subject
to required withdrawals. [IRS retirement plan investments FAQs](https://www.irs.gov/retirement-plans/retirement-plan-investments-faqs)
and IRC 408(a)(3) explain the IRA prohibition on investing in life insurance.
The key assumes an ordinary policy, not an insurance product inside a qualified
plan, and retains the page's inclusion as an explicit TODO disagreement.
Table II's younger-spouse exception and inherited IRA rules require information
the page does not model and are not inferred from a partner's age.

Schedule arithmetic follows the projection README's annual model. In the key,
cash pays the invented $12 annual spending so required withdrawals alone
change the pre-tax balance. With growth `g`, inflation `i`, flat tax rate `t`,
and factor `f`, required amount is `B / f`; the following balance is
`(B - B / f) * (1 + g)`. Year `n` real required amount is the nominal amount
divided by `(1 + i)^n`; its modeled tax is `required * t`. Lifetime real sums
add those unrounded annual real amounts. The fixed rates are invented inputs,
not IRS tax rates or forecasts. The second method uses exact rational products
of retained shares to check the decimal annual ledger.
