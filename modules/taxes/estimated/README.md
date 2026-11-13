# Estimated payments  (`taxes/estimated`)

**Status:** usable (phase 6)
**Purpose:** Quarterly estimated payments: the safe-harbor amount, what is due each quarter and when, and where you stand today.

## What a person sees (simple first, opt C12; 2026-11-13)
**First view:** the headline (what to pay and by when, what is behind, or that nothing is needed; "All four payments for
2026 are in" once they are, where it said only "Estimated payments"), the sentences under it as before, the one action of
the case ("Work out the W-4 change" when pay can take more tax out, "Add your income" with nothing earned), the info
notices, and the payments card with the next payment's row. A quarter that is behind or due now stays in sight (a deadline
is never folded); the others wait under "3 more payments".

**One tap away**, as rows of one card after the payments (`core/ui/more.js`):
- "4 more numbers" (`more`): Safe amount, Withholding covers, By estimates, At filing time (each return's balance when
  filing separately: "2 more numbers").
- "What you paid" (`own`, status "$6,300 paid" or "not set yet"): the four payment boxes and "Save payments". It opens by
  itself when a payment is behind, nothing is typed yet and the fix is paying by quarter: Needs attention and Next best
  action send people here to "type what you paid", so the boxes and the one filled button are in sight on arrival
  (docs/OPTIONAL.md R9 item 2).
- "Last year's return" (`own`, status "tax $11,200" or "not set yet"): the safe-harbor words and last year's two boxes.
  It was open whenever last year's figures were missing; now it is a row (the info notice still asks for them).
- "What paying late costs" (`how`), below.

After a save the part saved stays open (R17) and the green line at the foot names the new answer when the headline changed
("Payments saved. All four payments for 2026 are in."; "Last year's figures saved. $1,700 due by 1/15/2027."), or the new
safe amount after last year's figures change it, else just "Payments saved." (R7).

**Builder chose** (no owner input):
1. The payment boxes moved into "What you paid", so the first view has no box and at most one filled button; for someone who
   pays by quarter with nothing behind, the first view has no filled button at all (paying happens at irs.gov, and typing it
   is one tap away). The opt plan's row kept "one filled button"; this page's action in that case is outside the app.
2. Rows kept on the first view: behind, due now, and the next payment; when all four are paid, all four rows show (a short
   list of "paid" pills is the confirmation). `rest()` never hides fewer than three rows, so with two behind all four show.
3. With no estimates needed the payments card is not drawn (it listed four $0 rows); the boxes stay in "What you paid".
4. The part's status says the person's state in plain words ("not set yet") where the opt plan wrote "not entered" (R26).

## Inputs
`taxes.estimated.paid` (four amounts, edited here), `taxes.priorYear` (`{ tax, agi }`, edited here), the projected withholding (Withholding check), everything the Federal estimate reads.
No new plan field for what paying late costs (gap #15): it is worked from these.

## Outputs
`harbour` (required amount and its basis), `toPayByEstimates` (required less withholding), `perQuarter`, `quarters[]` (label, covers, due date, paid, cumulative share, status paid / due / short / upcoming, `late`), `paid`, `remaining`, `behind`, `overdue`, `nextDue`, `balanceAtFiling`, `lateQuarter`, `needsEstimates`, `penaltyRisk`.

## Formulas
`safeHarbour` (Withholding check). Installments are needed when the balance after withholding is 1,000 or more and withholding alone misses the safe amount; the shortfall splits into four equal payments due April 15, June 15, September 15 and January 15 (the IRS's uneven periods; IRC 6654(c)(2)). A due date on a Saturday, Sunday or legal holiday moves to the next business day (IRC 7503): `dueDay` from the Money calendar (household/calendar), with Martin Luther King Jr. Day and DC Emancipation Day; for example 2027's last payment is due January 18, 2028. Patriots' Day moves a Maine or Massachusetts resident's return, not an estimated payment (Rev. Rul. 2015-13; Form 1040-ES (2024) printed April 15, 2024 for everyone), so the household's state does not move these. A quarter is "paid" when everything paid so far reaches its cumulative share (a payment counts against the earliest unpaid quarter, IRC 6654(b)(3)), "short" when its due date has passed without that, "due" in the month of its due date, else "upcoming". A quarter is `late` when its own and the earlier boxes were under its share on its due date: the penalty is figured for each due date on its own (Form 2210 instructions), so `penaltyRisk` = estimates needed, the year not yet fully paid, and some quarter late, caught up since or not; the note then names the late quarter.
- Withholding: what the Withholding check page projects (typed per paycheck, or the year so far); with nothing typed, the Paycheck page's yearly federal withholding (estimated from pay and the W-4 it assumes), with a note to type the pay stubs' figure.
- Behind = the cumulative share of the last quarter already past due, less what is paid (at most what remains); the headline asks for it now. The next payment is the first quarter not yet past and not covered: its cumulative share less what is paid, less what is behind (never $0). The overdue date is the first quarter not covered.

## Withholding, and the easier fix (2026-11-02)
Withholding comes from `withholdingEstimate` in taxes/withholding (the same fallback to the Paycheck page's estimate as
before, now shared, so every tax page has one answer). When pay has tax taken out and estimates are needed, the page
leads with raising withholding: tax withheld counts as paid evenly through the year (IRC 6654(g)(1)), so more withheld
before December covers the earlier quarters too, and it says the penalty-free amount (`remaining`) and the amount that
clears the April bill (`balanceAtFiling`). "Behind: pay it now" stays for income with no withholding. With withholding
as the fix the quarters read "not paid" in a neutral pill, not "short" in red, and the penalty sentence is left out:
raising withholding before December covers them. When one earner's pay stub figure is typed and another's is not,
the estimate is "mixed" (the typed figure for one, the Paycheck page's estimate for the other) and says "partly estimated".
The year's tax includes self-employment tax on business income (`yearTax` in taxes/withholding; Form 2210 counts it), so the
safe-harbor amount and the quarters do too (2026-11-02).

## Tax owed on what is already earned (`taxOwedNow`, round 4, 2026-11-02)
For a household that pays its tax itself, part of the cash in the bank is this year's tax on money already earned. `taxOwedNow(plan, { today })` says how much, so Emergency fund and Next best action leave it out of the cushion:
- earnedShare = whole months gone this year / 12 (on November 2: 10/12).
- owedNow = (the year's tax, self-employment tax included, - projected withholding) x earnedShare - estimated payments made, never below 0. The months still to come carry their own tax, which every monthly figure (Next best action's left-over month, Budget, Income statement) already takes off.
- monthly = (the year's tax - withholding) / 12: what to put aside a month.
- With it: the year, the year's tax, withholding, payments made, `overdue` and `nextDue` (this page's own), and what is left at filing.

My choices (no owner input): it applies only when the plan has income from the household's own business or freelance work that is going today, estimates are needed (this page's `needsEstimates`), and withholding covers under half of the year's tax. A household whose paychecks withhold most of the tax is left to Withholding check, because its withholding is often estimated from pay. Only federal tax counts: the State page has a rate, not payments. In January to April last year's balance is not in it (the plan holds one tax year).

## Tax held back from an IRA withdrawal (round 8)
The year's tax is the Federal estimate's figures (`yearTax`, taxes/withholding: this year's required withdrawal, stock
pay, a business at its profit, rentals after costs, the IRA and student loan deductions as the law allows them). For a
retiree whose tax comes from this year's IRA or 401(k) withdrawals, tax held back from a withdrawal counts as paid evenly
through the year (IRC 6654(g)(1); Pub. 505 chapter 4: withholding "is considered paid ... in four equal amounts"), so the
page leads with asking the firm to hold back what is still short from a withdrawal before December 31 instead of paying
the quarters already past: `holdBack` = `{ amount: min(remaining rounded up to 100, the withdrawal), short, withdrawal,
required, people }` when estimates are needed, something is still to pay, it is today's tax year, the withdrawal comes
from the plan (not typed) and part of it is not yet marked taken (or the projection draws for spending). Ruth (widow
household, 2026): tax 3,964.52 (536 before: the 16,078 required withdrawal was not counted), safe amount 90% = 3,568.07,
nothing withheld or paid: "Have about $3,600 of tax held back from your IRA withdrawal"; the quarters read "not paid" in a
neutral pill, with the quarterly route (2,676.05 now, 892.02 by January 15, 2027) as the alternative, and a note to type
what was held back under "Federal tax withheld so far" (Form 1099-R box 4) once it is. Item 6's other half (the tax on the
withdrawal on Required withdrawals and How much to take out as the engine's difference) is Batch 5.

## What paying late costs (gap #15, 2026-11-13)
`lateCosts(e, { today, via })` (compute.js, pure) and the part "What paying late costs" (kind `how`, shut). Sources, read
2026-11-13:
- IRC 6654(a): the addition is "the underpayment rate established under section 6621" applied "to the amount of the
  underpayment" "for the period of the underpayment"; 6654(b)(2): the period runs from the installment's due date to the
  earlier of "the 15th day of the 4th month following the close of the taxable year" and "the date on which such portion is
  paid" (law.cornell.edu/uscode/text/26/6654).
- IRC 6621(a)(2): the underpayment rate is the federal short-term rate plus 3 percentage points, set each calendar quarter.
- Form 2210 instructions (2025), penalty worksheet: "Underpayment on line 1a x Number of days on line 3 / 365 x 0.07", per
  rate period, the days "from the date on line 2 to the date the amount on line 1a was paid"; "Your payments are applied
  first to any underpayment balance on an earlier installment" (irs.gov/instructions/i2210). The 2024 instructions divide a
  leap year's days by 366 ("$2,000 x (61 / 366) x 0.08", irs.gov/pub/irs-prior/i2210--2024.pdf).
- The rates: `data/rates.js` (IRS "Quarterly interest rates", the underpayment row: 2024 8% every quarter; 2025 7%; 2026 7%,
  6%, 7%, 7%; IR-2026-98 and Rev. Rul. 2026-15 for October to December 2026). The first quarter of 2027 was not published on
  2026-11-13: a later day takes the newest rate, said as "7%, the rate through 12/31/2026".

Formulas:
- `rateOn(day)`: the rate of the newest quarter in the table on or before the day's quarter (`known` when it is that quarter).
- `lateCharge(amount, from, to)` = sum over the days from `from` (the due date) up to `to` (the day paid, not counted) of
  amount x the rate of that day's quarter / the days in that day's year (365, or 366), worked in pieces where the quarter or
  the year changes. $2,100 one month late from January 15, 2027: 2,100 x 7% x 31 / 365 = 12.48, "about $12".
- `lateCosts`, the first case that applies, one written sentence each (view.js `lateWords`):
  - no estimates needed: null, no part;
  - `withheld` (the page's fix is more tax withheld from pay, or held back from an IRA withdrawal, before December 31,
    which counts as paid evenly through the year, IRC 6654(g)(1)): "No penalty if the extra is taken from pay before
    December 31: ..." / "... held back from your IRA withdrawal ...";
  - `behind`: "Paying late has cost about $202 since 4/15/2026, and the $8,400 behind adds about $48 for each month it
    waits." So far = the amount late on each day (each quarter's share from its due date, less every box typed, each counted
    as paid on its own quarter's due date or today for a box whose date has not come) x that day's rate / the year's days, to
    today. "Since" is the day the charge began (`from`): the first quarter short on its own due date, which can be a quarter
    paid since (`earlier`), so the cost is said of paying late, not of the amount behind now. A month more = lateCharge(the
    amount behind, today, a month on). Critic F1 (2026-11-13): the invented freelancer's 1,333.33, 1,333.33 and 1,333.34
    against about 3,577.15 a quarter: the 1st quarter is paid now but was 2,243.82 short from April 15 (2,243.82 x 6% x
    61 / 365 = 22.50 to June 15, then part of the larger amount late until September 15), so "about $176 since 4/15/2026",
    not "since 6/15/2026", and the line under it: "The 1st quarter is paid now, but it was $2,244 short on 4/15/2026: the
    days until later payments covered it count too.";
  - `after` (behind, and April 15 of the next year has passed): "Paying late cost about $X up to 4/15/2027; after that,
    unpaid tax costs interest and a late-payment charge instead." (with the same line for a quarter paid since);
  - `late` (a quarter was short on its due date and is covered since): "The 1st quarter's payment came after 4/15/2026:
    about $2 for each month it was late." = lateCharge(what was missing on that date, its due date, a month on);
  - `next`: "Paying the $2,100 due 1/15/2027 one month late costs about $12.";
  - `met` (the year's payments all in, none late): "No penalty: you paid in 100% of last year's tax in time." (110% above
    $150,000 of last year's income; "90% of this year's tax" when this year's is the smaller safe amount).
  A quarter's row says "paid late" when it is covered now but its own and the earlier boxes were short on its due date
  (`late`); on the pay or withdrawal route it says "paid" (the extra withheld counts as paid evenly through the year, IRC
  6654(g)(1)).
  Under the sentence: a quarter paid since but short on its date (behind, after), the next payment's sentence (behind,
  late), how the charge works, the sum with the person's figures ("$2,100 × 7% × 31 days ÷ 365 = $12.48"), the assumption
  behind "so far", the rate and where it comes from.
- Builder chose: the spec's sentence "No penalty: you paid enough last year's way" is written "No penalty: you paid in 100%
  of last year's tax in time" (it names what was paid); dates are written as the rest of this page writes them (1/15/2027);
  the boxes hold no dates, so "so far" counts each box as paid on its own quarter's due date and says so; a typed box for a
  quarter not yet due counts from today.
- Also: the Money calendar's file (household/calendar `toIcs`) gives every tax date a reminder a week before
  (`BEGIN:VALARM`, `ACTION:DISPLAY`, `DESCRIPTION:In a week: <title>`, `TRIGGER:-P7D`; RFC 5545, its sections on alarms and on the trigger, read
  2026-11-13), tax dates only.

Tests (module.test.mjs, "gap #15"): the rate table and the newest-on-or-before lookup (a gap, before the table, after it);
2,100 x 7% x 31 / 365 = 12.48; a change of rate inside the month (17 days at 7% and 14 at 6%), a leap year (/366) and a year
end; no part without estimates; each case's sentence (next, behind with the so-far worked by hand to 201.75, less than $1,
after, late, met by last year's 100% and 110% and this year's 90%, withheld by pay and by a withdrawal); every case's words
fill the part (40 words or more) and its status fits 20 characters; the page drawn with the real kit (first view, parts,
statuses, one filled button, no box; "3 more payments"; the boxes open when behind with nothing typed; the green lines and
the saved part open; no estimates; nothing earned; the family and the widow); invariance (compute() keeps its keys over the
14 invented households and the four fixture plans, and lateCosts writes nothing). household/calendar/module.test.mjs: the
reminder on tax dates only, and the calendar's list unchanged.

## Edge cases
The annualised-income method (uneven income through the year) is not modelled. What paying late costs is the regular
method's charge on the plan's figures, with each payment dated on its quarter's due date: an estimate, said as "about".

## Tests
`tests/tax-pages.test.mjs`, `module.test.mjs`. `tests/golden-estimated.test.mjs`: an independent answer key (`tools/golden_estimated`, 3,000 households and every due date for 2024 to 2027 worked from IRC 6654 and 7503, the Form 1040-ES and 2210 instructions and Rev. Rul. 2015-13, never from this code; `tests/golden/estimated/RULES.md`) compared with this page and Withholding check. Every row agrees since 2026-10-31; the key found five causes, all fixed (statuses from everything paid, the late-quarter penalty test, Patriots' Day, January after the year, a typed $0 so far).

## Ideas / not yet
- A reminder on the Needs attention page in the week before each due date (gap spec F2, overview's lane; the calendar file
  has the reminder since 2026-11-13).
- A date for each payment typed, so "so far" counts the day it was really paid.

## Nothing typed is not "$0 paid" (review 2026-11-02)
`paidTyped` (also on `taxOwedNow`) is true once the payments are saved on this page (`taxes.estimated.typedAt`, written on
save) or any payment is on file. Until then Needs attention ("Estimated tax: type what you have paid this year"), Next best
action ("Type or pay this year's estimated tax"), Emergency fund's liquidity line and the Forecast say what was due *if none
were made*, instead of "$0 is paid so far" for someone who may have paid every quarter.

## Review 2026-11-06
- **Separate returns, each on its own.** Filing separately, each return has its own tax, withholding, safe amount and
  $1,000 test (withholding `byReturn`: IRC 31(a), Pub. 505 "Separate returns"). `returns` gives each return's figures with its
  own four payments (`schedule`, the household's schedule code taken out into a function): the payments typed here go to
  the return that owes, box by box in the same shares (Pub. 505: the couple divides joint payments as they agree). The
  family filing separately with 3,750 each: the household's figures said "No estimated payments needed" (14,282 of tax,
  14,823 withheld), but Bo's own return has 6,517.70 of tax and 4,858 withheld: it needs 5,866 paid in (90% of its tax), so
  1,007.93 in four payments of 251.98, 755.95 of it behind. The page now leads with "Bo: about $1,008 more withheld this
  year", an "Each return" card, and the four payments on Bo's return. The household's figures (needsEstimates, the
  schedule, balanceAtFiling) stay as the answer key has them (tests/golden/estimated RULES.md section 1).
- **Credits more than the tax.** `creditsBack` (yearTax `back`): the words say "no federal tax, and about $1,700 of credits
  come back on top of the $585 withheld from pay" where they said "about $0 of federal tax, $585 of it withheld".
- Tests: in modules/taxes/withholding/module.test.mjs, "Estimated payments, filing separately" and "credits more than the tax".
- **Verifier: both returns behind.** With both returns needing payments the behind line has no name before it and read
  "... other's bill. payments from the 1st quarter ..."; it now starts "Payments". Test: "Review 2026-11-06 (verifier):
  filing separately, both returns behind" (this folder's module.test.mjs).
- **The 110% line filing separately (follow-up to the verifier).** `safeHarbour` already used 75,000 of last year's income
  for a married person filing separately (IRC 6654(d)(1)(C): "$75,000 in the case of a married individual filing a separate
  return"); the help under last year's income and the fold's words said 150,000 for everyone. They now say 75,000 filing
  separately (compute gives `filingStatus`). Test: "filing separately, the safe-amount words say 75,000".

## Round 8 review (2026-11-06)
- **Income on file:** `hasIncome` counts this year's IRA withdrawals the plan knows of (`known().hasIncome`). The year's
  tax includes the extra 10% on a draw before 59½ (IRC 72(t); Form 2210 counts Schedule 2's other taxes).
- **The hold-back:** `holdBack.whole` is the whole balance at filing, rounded up to 100 and at most the withdrawal. It is
  what to hold back to owe nothing in April, beside `amount`, which only keeps the penalty away (90% of the year's tax).
  The widow: 3,600 against 4,000.
- **The button:** it says "Your IRA withdrawals" (How much to take out) when no withdrawal is required yet.

Money review note (2026-11-07): the hold-back is capped at the part of this year's withdrawal still to come (the whole year's withdrawal less the required amounts marked taken),
not the whole year's: the widow who had taken her required $16,078 and spends more was shown a hold-back her remaining $3,686 could not carry. Test in `module.test.mjs`.

## Stress test 2026-11-11 (touch and input)

- With nothing earned on file: a filled "Add your income"; no $0 tiles or $0 quarters (T3).
- A save's green line is drawn at the foot of the page (the shell repeats it at the bottom of the screen): drawn above the form it moved "Save payments" 76 px under the thumb (T4, its estimated part).
- With nothing earned on file the form below is folded, so "Add your income" is the one filled button.
