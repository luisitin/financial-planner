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

## One next dollar, one rounding (care fourth pass, 2026-11-02)
`thisYear.nextDollar` (and `marginal`, the same) is the Federal estimate's `nextDollar` (over whole steps of the child care
credit), the figure its walk says; the effective rate goes through `ratePct`. Jo at 88,000 with daycare: "the next dollar
of ordinary income pays 14%" and "4.9% of income" (it said 12% from the 1,000 probe and 4.8%).

## Review 2026-11-06
- **Filing separately, each return's own bill or refund (verifier).** `paying.returns` (withholding `byReturn` through the
  estimate, each return's own estimated payments from Estimated payments' `returns`): "Paying it" says the household's tax,
  then each return's own line, as Withholding check, the Federal estimate, Quick answers and Needs attention do. The family
  filing separately with 3,750 each: "Ana's return: a refund of about $2,200 next spring. Bo's return: about $1,660 left to
  pay at filing, enough to risk the underpayment penalty", with Bo's own estimated payments; it said "a refund of about $540
  next spring", the two netted, though one return's refund cannot pay the other's bill. A return with no paycheck figure is
  read by its balance (no pay: nothing withheld). Joint and single returns: unchanged (`returns` null).
- Test: "Review 2026-11-06 (verifier): filing separately, Paying it says each return's own bill or refund".
- The next dollar is the Federal estimate's, so its fix (verifier, E: a bracket's edge inside the child care credit's step
  is not averaged in) reaches "The next dollar of ordinary income pays ...": Pat & Sam read "pays 17%; $2,000 more taxable
  income fits in the 12% bracket", now 12%. Test: federal "a bracket's edge inside the care credit's step".
