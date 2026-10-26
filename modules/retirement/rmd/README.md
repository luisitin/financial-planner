# Required withdrawals  (`retirement/rmd`)

**Status:** usable (phase 5)
**Purpose:** When the tax rules make you take money out of pre-tax accounts, and how big those withdrawals look.

## Inputs
`household`, `accounts` (401(k), IRA, insurance cash value), the projection (for the sizes).

## Outputs
`people[]` (startAge, startYear, yearsUntil, firstRmd nominal and real), `schedule[]` from the projection (year, age, factor, rmd, rmdReal, taxes, deferredEnd), `totalRmdReal`, `table[]` (ages 72-100), `hasDeferred`.

## Formulas
`core/math/rmd.js`: IRS Publication 590-B Table III (Uniform Lifetime Table, in effect from 2022); start age 73 for people born 1951-1959, 75 from 1960 (SECURE 2.0), 72 before. Required amount = prior year-end pre-tax balance / factor for the age reached that year.

## Tests
`tests/retirement.test.mjs` (table, start ages, amounts) and `tests/retirement-pages.test.mjs` (the page).
