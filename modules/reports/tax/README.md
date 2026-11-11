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
- **No retirement year: the report finishes and says why (fix round 6).** 17 qa households (H-0008, H-0090, H-0091,
  H-0191, H-0208, H-0290, H-0291, H-0691, H-0891, H-0908, H-0990, H-0991, H-1091, H-1191, H-1308, H-1390, H-1391: a plan
  that runs to an age before retirement, retirement past the plan's end, or a birth date that puts the person past the
  end age) have no retired year in the tax projection, so `retirement.peak` is null; the view read `r.peak.year` inside
  `.then`, threw, and the page stayed on "Putting the tax report together...". `retirement.noYears` (taxes/projection
  `noYearsWhy`) now says why: "There are no retirement years to tax: the plan runs to 60, and Maya retires at 70. Check the
  retirement age and "Plan to age" on the People page." / "Maya is 126, past the age the plan runs to (95). Check the
  birth date on the People page." One retirement year reads "Over 1 retirement year ..." without an average or a peak.
  Test: "a plan with no retirement year finishes the report and says why".
- **Filing separately, the rates and brackets per return (fix round 6).** `thisYear.returns`: each return's ordinary
  taxable income, bracket, room (the top of its own rung less its own ordinary taxable income), next rate, next dollar
  (`nextDollarOf` with that return as the one more income lands on, `separateTo`; the shown one's is the Federal
  estimate's) and its own ladder (`bracketsFor` on the separate schedule; filled = min(ordinary, top) - bottom, tax =
  filled x rate). The opening says "Filing separately, each return has its own brackets: on Rob's return the next dollar
  of ordinary income pays 24%, and $88,275 more taxable income fits in the 24% bracket before 32% starts; on Kim's, the
  next dollar pays 22%, and $41,200 more fits in the 22% bracket before 24% starts" (H-0599), "The rates" has a row a
  return (its next dollar, bracket and room, to the dollar as the opening says it), and "The brackets" one ladder per return. Before, the two returns' combined
  taxable income (178,000 for H-0599; 119,080 for the family filing separately) sat in the walk beside one return's room
  ("$36,370 more taxable income fits in the 22% bracket"), with one ladder headed "Yours in it". Joint and single
  returns: unchanged (`returns` null). Test: "filing separately, the rates and the brackets are each return's own".
- The next dollar keeps the app's one convention, the next 1,000's cost: a return 650 below its bracket's top reads 16%
  (650 at 12% and 350 at 22%), as the Federal estimate would say for it.
- **Every report finishes (fix round 6).** The page draws its compute's answer through `settleReport` (report-kit): a
  compute that failed (the shell's `{ error }`), a drawing that throws or a remote call that rejects shows "The tax report
  could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates
  and the ages on the People page, then reload the page." in place of the loading line. A scan of all 1,406 qa households
  and the fixtures found no other report that hung. For the four "older than 120" households (born 1900) this page's
  compute does not fail (the tax projection says why there is no retirement year); the retirement report, the plan summary
  and the annual review do, inside the retirement projection, and now show the notice. Test: reports/tax "every report finishes
  when its figures cannot be worked out (settleReport)".
- **"The rates" filing separately: a column a return (verifier, fix round 6).** The per-return table had a row a return and
  four columns ("Return", "Next dollar", "Bracket", "Room left in it"): 329 px wide in a 320 px section on a 390 px phone, and
  the page scrolled 4 px sideways at 360 px. It is now a row a figure ("The next dollar", "Bracket", "Room left in it") with a
  column a return ("Ana's", "Bo's"): 290 px at 360, also with long names. Test: "filing separately, the rates and the
  brackets are each return's own".

Review 2026-11-06 (round 7): filing separately, the lead ("on your return ...; on your spouse's, ..."), the rates columns and ladders ("Yours", "Yours in it", "Your return: ..."), and the paying lines ("Your return: a refund ...", "Estimated payments on your return") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js; view only).

## The report's rates are the return its total is worked on (round 8 review, 2026-11-06)
- **Figures:** `thisYear.agi`, `taxableIncome`, `bracketRate`, `roomInBracket`, `nextRate`, `marginal` and `nextDollar` come
  from `known(plan).result` and `known().nextDollar`, the Federal estimate's figures with what the plan knows.
- **The ladder:** it comes from Brackets, which builds on the same inputs.
- **Why.** The widow's report said 35,104 taxable and 22 cents in its walk, and the 10% bracket, 19% and a ladder adding
  up to 536 in "The rates".
- **Paying it:** for a retiree whose tax is on this year's IRA withdrawals (`paying.holdBack`, Estimated payments' figure),
  it leads with having tax held back from a withdrawal before December 31. That counts as paid through the whole year
  (IRC 6654(g)). The quarters come second as "or pay by quarters instead", not "not marked as paid".

## Gains on the same return (round 8 verify, 2026-11-06)
- **What:** "Gains and the HSA" says the 0% room and the tax this year's sales add on the return the walk shows. The
  figures are still the Capital gains page's (`taxOnGains`, `zeroRoom`); that page now works on `known(plan)`'s return (see
  its README), so the report, the page and the walk agree.
- **How:** more long-term gain until taxable income reaches the 0% line (Rev. Proc. 2025-32 sec. 4.03 for 2026: 49,450
  single, 98,900 joint), worked again up to four times because each dollar can pull Social Security into tax (IRC 86); the
  sales' tax is the return with them less the return without them.
- **Why:** the widow's report said "About 27,340 of long-term gains could still be taken this year at 0%" beside its own
  35,104 of taxable income. On that return 11,262 fit (3,628 of gain pulls the last 3,084 of her Social Security into tax,
  then 7,634 more reaches 49,450); selling 27,340 would have added about 3,020. With a 10,000 sale the report says it adds
  370.04 (Social Security taxed 23,460, AGI 72,338, taxable 48,188, all of the gain under the 0% line).

Review fixes (2026-11-07): filing separately says "on Ana's return the next dollar of regular income is taxed at 22%" (never "your" on a spouse's return) and "each of you has your own brackets". When tax is not taken out of pay: "No tax is taken out of your pay. That is about right ($0 to pay at filing)." (not "even so, what you owe is about right"), and a refund with nothing withheld reads "; you can expect a refund". Estimated payments: "$807 of the payments due since April 15, 2026 is not marked as paid". Gains: "You could still take about $17,550 of long-term gains this year and pay 0% tax on them."
