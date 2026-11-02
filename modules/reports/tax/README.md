# Tax report  (`reports/tax`)

**Status:** usable (phase 9)
**Purpose:** Reports your tax picture for this year alongside the multi-year projection.

## Inputs
Through the tax pages' computes: Federal estimate (the steps and totals), Bracket explorer (the ladder), Withholding check, Estimated payments, Capital gains, HSA and FSA, Tax year by year. Writes nothing. `heavy: true` (the year-by-year projection).

## Outputs
`{ ready, missing, today, year, filing, isIndexed, thisYear, ladder, paying, gains, hsa, retirement }`: figures only; the view writes the sentences.

## The document
An opening paragraph (the year's tax, the effective rate, the next dollar's rate and the room left in the bracket), the year step by step (the Federal estimate's walk), the rates, the bracket ladder with the household's income in each, paying it (withholding's verdict; with no withholding on file the report says so and points to the Withholding check instead of asking for estimated payments; the next estimated payment only when the verdict is known and payments are needed), gains and the HSA, and the tax in retirement (total, average, the peak year and why, the years in each bracket, and what the flat setting would charge). Prints through `../report-kit.js`.

## The same answer as the tax pages (2026-11-02, round 4)
"This year" is the whole federal tax with self-employment tax (withholding `fullSteps`), and its walk has the business
rows. "Paying it" uses the same estimate as Withholding check (typed figures, else withholding estimated from pay; no
pay at all means nothing withheld): "About $15,683 of tax. Paychecks take out about $9,470 by December (estimated from
pay): about $6,213 left to pay at filing", where it used to say "No withholding is on file" to anyone without a typed stub.

## Tests
`module.test.mjs`: not ready without income; the figures and ladder match the pages; the tax fixture's withholding, sales and HSA.

## Ideas / not yet
- State tax (once `taxes/state` exists); last year's return beside this year's; the Roth conversion and withdrawal-order savings (they are in the Retirement report).
