# Tax report  (`reports/tax`)

**Status:** usable (phase 9)
**Purpose:** Reports your tax picture for this year alongside the multi-year projection.

## Inputs
Through the tax pages' computes: Federal estimate (the steps and totals), Bracket explorer (the ladder), Withholding check, Estimated payments, Capital gains, HSA and FSA, Tax year by year. Writes nothing. `heavy: true` (the year-by-year projection).

## Outputs
`{ ready, missing, today, year, filing, isIndexed, thisYear, ladder, paying, gains, hsa, retirement }`: figures only; the view writes the sentences.

## The document
An opening paragraph (the year's tax, the effective rate, the next dollar's rate and the room left in the bracket), the year step by step (the Federal estimate's walk), the rates, the bracket ladder with the household's income in each, paying it (withholding's verdict; with no withholding on file the report says so and points to the Withholding check instead of asking for estimated payments; the next estimated payment only when the verdict is known and payments are needed), gains and the HSA, and the tax in retirement (total, average, the peak year and why, the years in each bracket, and what the flat setting would charge). Prints through `../report-kit.js`.

## Tests
`module.test.mjs`: not ready without income; the figures and ladder match the pages; the tax fixture's withholding, sales and HSA.

## Ideas / not yet
- State tax (once `taxes/state` exists); last year's return beside this year's; the Roth conversion and withdrawal-order savings (they are in the Retirement report).
