# Cash-flow forecast  (`cashflow/forecast`)

**Status:** usable (phase 4)
**Purpose:** Where your everyday cash is heading over the next three months, day by day, and whether a shortfall is coming.

## Inputs
Plan sections read (`needs`): `accounts` (checking, savings, cash), `transactions` (through Bills and regular payments, and federal tax payments directly), `expenses`, `income`, `recurringIgnored`, `taxes` (through Estimated payments).
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
`module.test.mjs`: planned dates (1st/15th/start/end dates), no data, the 90-day run on the shared fixture (found vs typed, coverage, lowest), a dated shortfall; salaries at take-home and side income as typed; `takeHome` (shares from the Paycheck page, the monthly total, no earner); a payroll deposit covering only the salary it is closest to; a deposit outside the band covering nothing; an ended job not taking the new job's deposit; a payday due today; a later first job at take-home; Debts payments added only when nothing is filed under loan and card payments; estimated tax
(round 5): no lines when pay withholds most of the tax, only federal bank lines count, bank payments as paid, a typed tax
bill not taken twice, business income active today, January's last-year 4th quarter, a typical year spread after an edit;
(round 5, second pass) which typed bills are the federal estimates, a payment plan, back taxes, a penalty or a state's
tax leaving every quarter in, a typed bill outside the window taking nothing off, last year's April balance counted at
most as the 1st quarter while a catch-up payment counts in full; (round 5, third pass) a payment paying only lines due on
or after its date, quarterly tax bills on the IRS's dates (the qa self-employed household on three more dates), names
that say estimated against the debt words, overpayments after April counted in full, last year's quarters only from
last year's business income.

## countOn (round 4, 2026-11-02)
An income with `countOn` lands in the forecast as that figure a month (Side income's careful amount), not the typed amount.

## Business income typed as a year (round 4, 2026-11-02)
Business or freelance income typed as a year (or a quarter) lands a month at a time, not as one deposit on one day (setup asks for a typical year).

## Ideas / not yet
- Let the person move a typed bill to the right day of month from this page.
- Contributions paid from checking rather than from pay (an IRA, a brokerage account) are not events yet; Next best action takes them out of the left-over, so the Forecast can read a little higher than the Dashboard.

## Side income counted carefully
A business line with a careful figure (income's `countedOn`) lands that figure a month; at or above the line's amount, or on
another kind of income, the amount lands as typed (review 2026-11-02).

## Review fixes 2026-11-02 (freelancers)
- **Estimated tax** (`estimatedLines`): business income lands before its tax, so when taxes/estimated says the return needs
  quarterly payments, the forecast takes them out: what is past due on today (named "if not paid yet" when no payment was
  ever typed, `paidTyped`), then each quarter due inside the horizon, the part of its cumulative share not paid and not
  counted before it. Only this tax year's quarters. (Who gets them and what already pays them: see review 2026-11-02,
  round 5, below.)
- **Bank lines cover typed items only going the same way** (an outgoing "Comcast Business" bill never covers "Dee's
  business"), and an income's generic words (business, income, work, freelance, consulting, side, salary...) never match.
- **A year's business income is spread a month at a time only for setup's own record** (`setup-pay-<person>`, where setup
  asks for "a typical year"), or a record marked `typicalYear: true`; a once-a-year payment typed on Income (a retainer,
  a royalty) lands once, on its date.

## Review 2026-11-02, round 5 (freelancers' tax in the forecast)
`estimatedLines(plan, today, to, ahead)`:
- **Who gets the quarters: taxOwedNow's gate** (taxes/estimated). Business or freelance income coming in today (started,
  not ended: one that starts next year no longer brings this year's quarters), the return needs quarterly payments, and
  withholding covers under half of the year's tax. A household whose pay withholds most of the tax gets no lines: its
  gap is the April bill or a W-4 change (Estimated payments leads with "Raise your withholding", Needs attention with the
  April bill), and that withholding is often estimated from pay. Before, the sample family (two salaries, $600 a month of
  photography) had $3,484 "due so far, if not paid yet" taken out today.
- **Only federal payments count against them** (`FEDERAL_TAX_WORDS`: IRS, USATAXPYMT, EFTPS, Treasury tax, 1040-ES). A
  state's tax or fee (a revenue department, the Franchise Tax Board's $800 a year) never pays the federal 1040-ES. Before,
  any such line, or a $250 IRS payment plan, made the forecast drop every federal quarter ($11,200 for the freelancer).
- **What the bank shows paid counts as paid** when nothing is typed on Estimated payments (`taxPaidInBank`): outgoing
  federal lines (not transfers) after last year's 4th-quarter due date (January 15, which pays last year) and on or
  before today. A 1040-ES schedule (April 15, June 15, September 15: 61 and 92 days apart) is no regular rhythm, so the
  Bills list never finds it. Typed payments, when there are any, are the record instead (the bank lines are the same money).
  Lines from January 16 to April 15 count at most as the 1st quarter, later ones in full (third pass, below).
- **Federal payments the bank will make in the window** (found on their rhythm, `ahead`) are already forecast lines, so
  they pay the quarter lines, the latest first, each only the lines due on or after its own date (third pass: money never
  leaves later than it is due). A $250 a month payment plan takes $750 off January's quarter, not everything.
- **A tax bill typed on Expenses is the person's own plan** (`typedIncomeTax`). Before, "Quarterly estimated tax" $2,800
  and "Estimated tax, 4th quarter" $2,800 both went out on January 15. The first pass dropped every quarter line when such
  a bill was typed; the second pass (below) takes off only what the bill pays in the window.
- **January 1 to 15: last year's 4th quarter** (due January 15) stays in, from taxes/estimated run for last year
  ("Estimated tax, 4th quarter of 2026"), with last year's past-due part if any; when the Federal estimate's year is set,
  that year alone. Before, the payment due in ten days left the forecast on January 1.
- Limits: an IRS payment plan for last year's balance looks like an estimated payment in the bank and is counted as one
  (a typed one is not: see the second pass); the paid boxes on Estimated payments carry no year, so on January 15 the new
  year's April quarter reads last year's boxes.

## Review 2026-11-02, round 5, second pass (typed tax bills and last year's balance)
- **A typed tax bill pays the quarter lines with what it pays in the window, and nothing more.** The forecast already has
  the bill on its dates (Expenses), so those amounts (each date between today and the window's end) come off the quarter
  lines the way the bank's own payments do, the latest first (`ahead` entries marked `typedTax`). A bill with no date in
  the window takes nothing off: before, any typed tax bill that had started and not ended dropped every line, so the
  qa self-employed household's "Quarterly estimated taxes" (no date, so on the 1st: February 1, just after the window)
  left 90 days with no tax at all while Estimated payments showed $6,711.45 behind and $2,237.15 due January 15; it then
  showed those two lines (on November 2 only: see the third pass). A dated $4,200 bill on January 15 paid the $2,237.15
  quarter and $1,962.85 of the part past due, which dropped to $4,748.60 "if not paid yet" (the third pass stops that: a
  payment on January 15 cannot pay what is due today, so the line stays at $6,711.45). The bill's dates before today are
  not taken as paid (a typed bill is a plan, not a record; type what was paid on Estimated payments, or import the bank).
- **Which typed bills count** (`typedIncomeTax`):
  - a name that says estimated or quarterly tax ("Quarterly estimated taxes", "Auto-pay estimated tax", "Est. tax",
    "1040-ES");
  - a quarterly bill (the 1040-ES rhythm) to the IRS, or for federal, income or self-employment tax, or just "Taxes";
  - under "Taxes not withheld": a name with estimate, quarter or Q1 to Q4; or one to the IRS or for federal, income or
    self-employment tax, or just "Taxes", on any rhythm but yearly or once ("IRS" $300 a month counts there; the same bill
    under another category does not, since a monthly IRS bill is more often a payment plan). A yearly or one-time
    "Income tax" is the April bill for last year, unless it is dated on a later quarter's due date (third pass).
- **Which never count:**
  - a debt to the tax office: plan, installment, agreement, back taxes, owed, penalty, interest, balance, levy, lien,
    last year's (third pass: plan, installment, owed and balance yield to "estimated"). Before, a typed "IRS payment plan"
    of $250 a month took $11,200 of quarters out (end $29,860; now $18,660);
  - a state's or a city's tax: a state's name, its two-letter code in capitals ("NY", "CA": "in" or "or" in small letters
    is a word), state, FTB, franchise, revenue (third pass: a department of revenue; "revenue" alone yields to
    "estimated"), taxation, comptroller, city, local, county. "Internal Revenue", IRS or federal in the name wins.
    Before, "California estimated tax" $400 a quarter dropped $11,200 of federal quarters;
  - another tax, by the word just before "tax": property, real estate, home, house, school, car, auto, vehicle, road,
    sales, use, excise, payroll, franchise, hotel, occupancy, gift, inheritance ("Quarterly payroll tax" is the business's
    Form 941, not the owner's 1040-ES);
  - a fee: preparer, prep, accountant, CPA, bookkeeping, software, filing, registration, license, permit.
  - The other-tax words now count only next to "tax": before, "auto" or "home" anywhere made "Auto-pay estimated tax"
    $2,800 and "Federal estimated tax (home business)" not count, and the quarter went out twice on January 15.
- **The bank's federal lines count only up to what is due by the next due date** (`taxPaidInBank` with taxes/estimated's
  quarters): in date order, each line counts up to the year's cumulative share due by the next due date on or after it
  (April 15, June 15, September 15, January 15), less what the lines before it counted; the rest is other tax. (Third
  pass: only the lines up to April 15 are capped now; the later ones count in full.)
  - Last year's balance, paid with the return by April 15, so counts at most as the 1st quarter. Before, one $6,000 "IRS
    USATAXPYMT" on April 15 took the "if not paid yet" line from $8,400 to $2,400; now $5,600 (the $2,800 quarter counted).
  - A catch-up (two quarters paid at once in September) still counts in full, up to what was due by September 15.
  - Limits: a balance paid without any 1st-quarter payment still counts as that quarter (the bank cannot tell them apart
    on April 15); paying the whole year at once in April counts only the 1st quarter, so the later quarters show as "if
    not paid yet"; a balance paid after April (an extension, an IRS notice) counted up to the next quarter's share (third
    pass: in full).

## Review 2026-11-02, round 5, third pass (dates of tax payments, names, overpayments)
- **A payment pays only the quarter lines due on or after its own date** (`estimatedLines`): each payment ahead, the
  bank's or a typed bill's, takes off the lines dated on or after its own day, the latest first, starting with the latest
  payment (it has the fewest lines it may pay). Before, the credit took amounts off the latest lines with no date check:
  from November 3 on, the qa self-employed household's undated "Quarterly estimated taxes" fell on February 1 (the 1st,
  moving with today) and removed January 15's quarter, and the "due so far, if not paid yet" line read $4,748.60 while
  Estimated payments said $6,711.45 behind. A payment on January 15 now pays January's quarter and nothing due today: the
  line past due is what Estimated payments says, and the rest of a bigger bill pays a later quarter outside the window.
- **The person's own quarterly bill for the federal estimates is paid on the IRS's dates** when it has no date, or is
  dated on a due date: January 15, April 15, June 15 and September 15 (taxes/estimated's `QUARTERS`, moved off weekends and
  holidays; `irsDates`), from its start date until its end date. A quarterly bill on Expenses is otherwise every three
  months from its date (or the 1st), so "from January 15" fell on July 15 and October 15 and an undated one on the 1st;
  its payments then missed the lines they pay. My choices: only a quarterly bill moves (a monthly one stays on the 1st,
  a yearly or one-time one on its date), and a quarterly bill dated another day (February 1) keeps its own days: it is
  what the person typed, and the date check above then leaves the quarter it is late for in the forecast.
  - The qa self-employed household on November 20, January 5 and September 15, dated or not: its $4,200 is on January 15
    (or September 15) and pays that quarter; the line past due stays $6,711.45 (on January 5: for 2026). On September 15,
    with the 3rd quarter due that day, the $4,200 paid today pays it and $1,991.87 of what is past due.
  - The freelancer with three quarters paid and an undated "Quarterly estimated tax" of $2,800, on January 5: one
    payment on January 15, the typed bill (before, it fell on April 1 and January's quarter went out as well).
- **Names** (`typedIncomeTax`): a name that says estimated, estimate or 1040-ES (`SAYS_ESTIMATE`) wins over the softer
  debt words (plan, installment, owe or owed, balance) and over "revenue" when no state is named: "Estimated tax
  installments" (installment is the IRS's own word for these payments), "Quarterly installment - estimated tax",
  "Estimated taxes owed", "Estimated tax on revenue" and "Estimated tax plan" count again (the second pass took them for
  debts, and January's quarter went out twice: "paid" ended at $24,640 instead of $27,440). Agreement, back taxes,
  penalty, interest, lien, levy, debt, arrears and last year's always exclude ("Estimated tax incl. interest" does not
  count). A department of revenue is always a state's.
  - A yearly or one-time bill to the IRS, or for federal, income or self-employment tax, counts when it is dated on the
    2nd, 3rd or 4th quarter's due date (June 15, September 15, January 15; `irsDueDay`): "IRS Q4 payment", "Federal tax"
    or "IRS payment" on January 15 is that quarter. Not on April 15, which may be last year's balance with the return. My
    choice: yearly bills too, as a yearly bill on January 15 is the same payment every year.
  - A quarter word ("quarterly", "Q1") wins over the softer debt word "owe": "Taxes I owe each quarter" and "Quarterly
    tax I owe" are the estimates (recheck: they were taken for a debt and January's quarter went out twice). "NYS" and
    "School district" are a state's or a local tax, never the federal quarters.
- **Bank payments: only January 16 to April 15 are capped** (`taxPaidInBank`), when last year's balance is paid with the
  return: together they count up to the 1st quarter's share. Later payments count in full, so paying more than the minimum
  each quarter is kept: three $3,500 payments count $10,500 and leave $700 on January 15, as the same three typed on
  Estimated payments do (the second pass capped every quarter: $8,400, and $2,800 on January 15; end $27,440, now $29,540).
  - My choice, so that the April payment of someone who pays more than the minimum is not cut: the cap is the larger of
    the 1st quarter's share and the person's own quarterly payment, the smallest total paid in a later quarter whose due
    date has passed (April 16 to June 15, June 16 to September 15, September 16 to January 15). Three $3,500 payments: the
    cap is $3,500, so April counts in full. A $6,000 balance in April with nothing else (or with a September catch-up and
    nothing in June) still counts $2,800: a later quarter with nothing paid is no sign of a bigger regular payment.
  - Limits: a big later payment that is not an estimate (an IRS notice in August) counts in full; until June 15 has passed
    the April cap is the 1st quarter's share, so for someone who pays $3,500 a quarter June's line reads $700 more than
    Estimated payments would with the $3,500 typed ($2,800 instead of $2,100).
- **Last year's 4th quarter comes only from business income in that tax year** (January 1 to 15): the retirees'
  consulting that starts January 1, 2027 made their 2026 quarters appear on January 5 ($3,023.96 past due and $1,007.99
  on January 15) though they had no business income in 2026; now none. This year's quarters still need business income
  coming in today. Limit: Estimated payments counts only income still coming in, so a business that ended on December 31
  brings no 2026 lines on January 5 (its tax is 0 there too).
- Tests (third pass): a February 1 payment leaves January's quarter; the qa self-employed household on November 20,
  January 5 and September 15, dated and undated; the freelancer's undated bill on January 5; every name above; three
  $3,500 bank payments against the same typed; consulting from January 1 bringing no 2026 lines.

## Recheck 2026-11-05 (which quarter a payment pays)
- **Each payment pays the earliest quarter it may**, one dated on or after the payment, and the line past due last. Before,
  it took the latest line in the window: from about March 17 to April 15 both April 15 and June 15 are in the 90 days, and
  "1040-ES Q1" typed for April 1 paid June's quarter, so April 15 still showed "Estimated tax, 1st quarter" (the balance
  read $2,800 low for up to 61 days, and someone who had just paid was told it was due). Payments are still taken latest
  first; the lines each may pay are nested, so the total paid off, and every end balance, is unchanged (the recheck swept
  5,644 runs: no end balance moved).

## Links that open the form they promise (2026-11-11, claude-g)
Its "Add ..." / "Update this balance" button opens Net worth with that form open and a way back (`?add=`, `?edit=`, `?back=`; see balance/net-worth README). DP-3, B4.
