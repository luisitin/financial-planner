
- Review round 1 (claude-r, 2026-11-12): a salary typed as a year's (or quarter's) pay is paid in paychecks, the Paycheck page's count or every two weeks (`core/math/periods.js` `payRhythm`), each payday its share before tax; the card says so. It used to book the whole year on one day and export it (N1, severity 5). An income that has ended is neither asked about nor listed (N2).
- Re-check (2026-11-12): a pension or Social Security typed as a year's (or quarter's) amount is paid monthly, each a twelfth; pension and Social Security are asked a recent payday too; twice a month needs no payday (the 15th and the last day, said as a guess); the calendar file's titles carry the amount ("Sam's pay +$1,846.15"); changing a payday says "now counted from".
- Review round 2 (2026-11-12): only a payday box the person changed is checked against the last year; a stored one left as it is never blocks the save (N4). A pension or Social Security paid twice a month guesses "the payer's" days (N5).
- Re-check of round 2 (2026-11-12): a stored payday dated after today keeps no latest-date limit on its box; emptying a stored payday is refused at the box ("can be changed but not removed"); the W-2 reminder comes only for a year in which a salary was paid.

## Lines left out of the totals (gap #32, 2026-11-14)
The bills found in the bank lines come from the lines that are not left out of the totals on the Transactions page
(ledger `counted(plan)`, as on Recurring). With none marked the lines read are the plan's own list
(`tests/left-out.test.mjs`).

## One filled button (whole-app sweep x3, 2026-11-16; tests `tests/sweep-x3.test.mjs`)
With a salary that has no payday yet, the "To show your paydays" card's "Show my paydays" is the page's filled button; the empty
"Your reminders" form, whose "Add it" was a second filled button on the same first view (the invented family, the retired
couple, the renter), now waits behind an outlined "+ Add a reminder" (its Cancel folds it back). With nothing to ask, the empty
form stays open as before. The first view of the family went from 7 boxes and 2 filled buttons to 2 and 1 (counts file lowered).
