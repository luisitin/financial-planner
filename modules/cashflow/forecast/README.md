# Cash-flow forecast  (`cashflow/forecast`)

**Status:** usable (phase 4)
**Purpose:** Where your everyday cash is heading over the next three months, day by day, and whether a shortfall is coming.

## Inputs
Plan sections read (`needs`): `accounts` (checking, savings, cash), `transactions` (through Bills and regular payments), `expenses`, `income`, `recurringIgnored`.
`compute(plan, { today, days = 90, accountId = "" })`.

## Outputs
`accounts[]`, `start`, `days[]` (`date`, `balance` after that day, `events[]` `{ name, amount, source, beforeTax?, fromDebts? }`), `lowest`, `end`, `shortfallDate`, `income`, `spending`, `events`, `sources` (`found`, `planned`, `skipped`), `hasData`, `takeHome` (typed pay was turned into take-home), `debtFromDebts` (a month).

## Formulas
- Start = today's balances of the everyday accounts (signed).
- Events: (1) every payment found in the transactions, repeated on its cadence from its next date (a missed one from its expected date); (2) bills and pay typed on Expenses/Income, unless a found payment already covers them: shares a word longer than 3 letters, or has the same amount (within 2%) and the same rhythm; typed items land on their start date's day, else the 1st (bills) or the 15th (pay); (3) one-time items with a date inside the window.
- Pay lands as take-home (2026-11-01, round 2 of the owner's experience list). Income is typed before tax and the bank sees pay after tax, so before this the Forecast added every salary in full: on a household the Dashboard calls $630 a month short, it said "No shortfall expected" with cash rising from $15,700 to $23,571. Each typed salary of an adult now lands at amount x that earner's take-home share, `cashflow/paycheck` `takeHome().ratio` (the Paycheck page's take-home over the year / pay over the year: federal tax withheld, Social Security and Medicare, the state's tax, the 401(k), health cover and other deductions taken out). The event keeps the typed figure as `beforeTax` and the page reads "+$2,888 Ana's salary, take-home ($3,900 before tax)". Other kinds of income (side work, rent, a pension) land as typed: nothing is withheld from them. Same household now: $15,522 in 90 days, a little down.
- A found pay deposit covers one typed salary (2026-11-01). A deposit is pay when its bank text has a pay word (`PAY_WORDS`: payroll, salary, direct deposit or dep, dir dep, paycheck, wage(s)) or it is filed under the salary category. Two passes, closest pairs first, each deposit and each salary used once: (1) against each salary's yearly take-home, within `PAY_BAND` = 25%, so a deposit near one earner's take-home is never given to the other earner whose pay before tax happens to be near it; (2) for what is left, against the typed figure, a deposit from half of it to 5% over it (`TYPED_BAND`), for pay typed after tax or pay with no take-home share. Pay deposits are matched only this way: their words ("salary", "payroll") no longer cover every typed salary at once. Before, a typed "Ana's salary" of $3,900 never matched the bank's "ACME CORP PAYROLL" $2,888, so after an import both were counted: the sample family's 90 days ended at $61,513. The bands are my choice: a take-home estimate can miss health cover or a state tax the plan does not know, and a deposit a quarter away from any take-home is more likely something else. Only a salary with a payday inside the window can take a deposit, so an ended job never takes the new job's pay (both were counted).
- Take-home reaches every kind of pay the plan can tax at source (`takeHome().ratio`): a salary that starts later (a new job) takes its earner's share; a salary tied to nobody takes the household's share (all earners' take-home over their pay); a bonus lands after 22% federal (supplemental wages, IRS Publication 15), Social Security and Medicare and the earner's state share. A salary with no share at all (no adult earns anything) lands as typed, reads ", before tax" and the page says how to fix it.
- Loan and card payments kept only on Debts (2026-11-01): when the Expenses page adds them (its `debtFromDebts`: nothing filed under loan and card payments, F-019), each debt still owed with a payment (minimum + extra, `balance/liabilities`) lands on the 1st as "Visa payment" until its payoff month (the Debts page's date), leaving the mortgage out when it is filed under housing, so the Forecast spends what the Expenses page and the Dashboard count. A bank payment covers a debt's line when it names the debt's account or lender ("CHASE CREDIT CRD AUTOPAY" for a Visa from Chase) or has the same amount; the words every loan shares (loan, card, payment, credit, student, auto, mortgage) never count, so the student loan's payment does not pay the car loan. Filed payments are never added again.
- The hero adds "but the everyday accounts end $X lower than today" only when that holds over 90 days too: a 30-day window can end just after the bills on the 1st and before the next pay.
- Balance each day = the day before plus that day's events; lowest and first negative day recorded.

- A payment found in the transactions starts at the first date after its last line when that is today or later (2026-11-01). The recurring list gives the next date after today, so a payday due today was dropped and the 90 days ended a whole paycheck low.
- Pay that still lands before tax (no take-home share) is marked; the note says to tie it to an adult when it is tied to nobody, and that the Paycheck page cannot work it out yet otherwise.

Debts paid from the Debts page (2026-11-02): the debts in Expenses' `fromDebts` each get a payment line of their own,
including when other loan payments are listed on Expenses (before, any listed loan payment stopped them all).

The saved debt plan (2026-11-02): Pay off debts' extra is paid on the 1st each month ("Extra on Visa card (Pay off
debts)") until the last debt it goes to is gone, as Next best action counts it; before, the Forecast left it out.

## Edge cases
No everyday account or no today: no data. A chosen account only counts found payments on that account and all typed items. Horizon at least 7 days.

A salary typed as a yearly (or quarterly) figure, the setup's default, is paid in paychecks, not once a year
(`payRhythm` in core/math/periods.js: the Paycheck page's count for that person, else 26, every two weeks). The Forecast puts each payday in at the take-home share of one paycheck (a $55,000 salary typed "a year" put the whole
year's take-home on one day, then nothing for the rest of the window; 2026-11-02, experience round 4).

## Tests
`module.test.mjs`: planned dates (1st/15th/start/end dates), no data, the 90-day run on the shared fixture (found vs typed, coverage, lowest), a dated shortfall; salaries at take-home and side income as typed; `takeHome` (shares from the Paycheck page, the monthly total, no earner); a payroll deposit covering only the salary it is closest to; a deposit outside the band covering nothing; an ended job not taking the new job's deposit; a payday due today; a later first job at take-home; Debts payments added only when nothing is filed under loan and card payments.

## Ideas / not yet
- Let the person move a typed bill to the right day of month from this page.
- Contributions paid from checking rather than from pay (an IRA, a brokerage account) are not events yet; Next best action takes them out of the left-over, so the Forecast can read a little higher than the Dashboard.
