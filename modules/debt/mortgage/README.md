# Mortgage  (`debt/mortgage`)

**Status:** usable (phase 4)
**Purpose:** Your mortgage's schedule, and what extra payments, paying every two weeks or a recast would save.

## Inputs
Plan sections read (`needs`): `accounts` (the mortgage account; a Real estate account gives the home value), `debts` (rate, required payment, extra, term), `debtPlan.mortgageAccountId` (optional choice when there are several).
`compute(plan, { today, extra, lump })`.

## Outputs
`mortgage`, `home`, `base` (months, endDate, totalInterest, payment), `withExtra` (monthsSaved, interestSaved), `biweekly`, `recast` (newPayment, monthlySaving), `pmi` (ltv, dropAtBalance, monthsUntilDrop, dateDrop), `schedule[]` per year, `hasData`.

## Formulas
- Months left at a payment: `nper(rate/12, payment, balance)`; interest to come from `amortization` at that payment.
- Extra each month: the same with payment + extra. Every two weeks: half a payment 26 times a year = 13 payments a year = payment x 13/12 each month.
- Recast: the payment that amortises (balance - lump) over the months left at the current pace (`pmt`).
- Mortgage insurance (Homeowners Protection Act, 12 U.S.C. 4901(2), (12), (18) and 4902; Fannie Mae Servicing Guide B-8.1-04; read 2026-10-31): you can ask to cancel it when the balance reaches 80% of the home's original value (the price paid, from the Home page's `plan.property` entry for the account), months simulated at the current payment plus extra; it ends by itself at 78% of the original value on the original schedule, simulated at the required payment. With no price entered, today's value stands in and the page asks for the price (lenders may also drop it on a new appraisal under their own rules, not modelled).

## Edge cases
No mortgage account, or no rate/payment: empty state pointing to the right page. No home value: no insurance figure and a note.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## The payoff plan's date (round 4, 2026-11-02)
When the payoff plan finishes the mortgage sooner (debt/payoff `twoDates`), the hero adds: "On your payoff plan it ends in March 2039 instead: once the Visa card and Car loan are paid off, their payments move onto the mortgage", with a link. The Timeline and the Plan summary show that date; this page's own figures stay on the mortgage's own payment.

## Ideas / not yet
- Points and rate buydown; ARM resets; property tax and insurance escrow lines.

## Each loan against its own home (round 8 batch 6, landlord-2, 2026-11-06)
- **Which mortgage**: `params.accountId`, else `debtPlan.mortgageAccountId`, else the first mortgage owed that no rental on
  Rental analysis names (the home you live in), else the first owed. The rows are highest rate first, so the condo's 4.5%
  loan came before the home's 3.5% one and was measured against the home (37% of 410,000); Your home read the condo's loan
  as its own. `others` lists the rest; the page links each ("Also on file: Condo mortgage").
- **Its home** (`homeOf(plan, loanId)`): the property entry that names the loan (`loanAccountId`) with its Net worth account
  (or the account of its name), else its own value; otherwise the first Real estate account with a value that no other
  loan's property claims (as before when no rental names a loan).
- **A rental's loan**: what is owed against its value today only (`pmi.rental`: 150,000 ÷ 260,000 = **58%**). The Homeowners
  Protection Act's 80% / 78% dates are for "a single-family dwelling that is the principal residence of the mortgagor"
  (12 U.S.C. 4901(14), (15), read 2026-11-06 at law.cornell.edu), so the page says the lender's own rules decide.
- Tests: "batch 6" in `module.test.mjs`; `tests/debt-pages.test.mjs` and the debt answer key pass unchanged.

## Review fixes (round 8 batch 6, 2026-11-06)
- `homeOf` (money 9): the home's mortgage is measured against the first Real estate account that is neither another loan's home
  nor any rental's (linked, or the account of its name it probably is), with or without a loan: a condo owned outright,
  listed first, was taken as the home's (96% of 260,000 instead of 61% of 410,000).
- (money 10) A rental's loan is measured against its Net worth account only once the rental names it (`accountId`); until then
  against the value typed on Rental analysis, as Rental analysis does (an unlinked Condo at 270,000 gave 56%, not 58%).
- The page (UX 6): the loan shown rides in the address (`#/debt/mortgage?loan=<id>`), so Back returns to the other loan and the
  menu opens the home's; the other loans are outlined 44 px buttons ("See Condo mortgage ›"); the hero names the home ("On
  Condo, which you rent out"); the payoff sentence says "onto this loan" when there are several; a rental's tile is "Owed
  against its value: 58% of Condo's $260,000 today" (the README keeps why the law's dates are not given).
- Tests: "batch 6 review" in `module.test.mjs`.

## How the years left were worked out (2026-11-07, owner's request)
`compute(...).start` = `{ year, date, via: "typed" | "tap" | "guess" | "stale", monthsLeft, yearsLeft, worked, pageMonths, apart?, stale? }`: when the loan began (the
year the home was bought as typed on Home, Get started or here; a refinance answered on Get started's tap; else the usual year for an
owner of this age, `home.boughtYear`), and `worked`: the balance or payment on file is our guess, so the start is what they were worked
from. `stale`: a year typed so long ago that a 30-year loan from it would be nearly paid off; the loan is then counted from our guessed
year for the age instead (`year`, `date`), and the page asks "When did you last refinance?" (four buttons that write the tap Get started
keeps, `setMortgageStart`). `pageMonths` is the page's own months at the payment (`base.months`): the line says those years, so it
agrees with the top card, Debts and Your plan (verify 2026-11-07). `apart`: they are more than 36 months off the loan's own (a typed
payment far above the usual one, the balance held at the home's value): the line then says "At $4,000 a month, the $230,000 we have for
this loan is paid off in about 7 years. A usual 30-year loan from 2024 would have about 28 years left." and asks for what is still owed
(or, when the balance is the person's and the payment ours, for the payment: `owedGuess`).
The fold's label and box show the year typed for the home (also when a refinance answered is what the loan is counted from), else
"2024, our guess".
The page shows one plain line ("About 28 years are left on a usual 30-year loan, counted from the year we guess you bought, 2024.") and
a fold "Change the year you bought it" (a box; blank goes back to our guess) -- only for a loan whose own home is clear (`loanHome`:
its rental, or the home account when it is the only mortgage or Get started's), so a second loan never writes to the main home.
Balance and payment both typed: "The years left come from the balance and payment you gave us." and no box.
**The payment** (`mortgage.payment`) is the whole payment; `mortgage.toLoan` is what pays the loan and `mortgage.escrow` the tax and
insurance in it (balance/liabilities `loanEscrow`, overview/guesses README): the schedule, the end date, the extra-payment, biweekly and
recast figures and the mortgage-insurance dates all run on `toLoan`, so the page's years left are the loan's (tested against Debts,
Pay off debts and the Timeline for every age). Source and formulas: overview/guesses README "When the home was bought". Tests:
tests/home-purchase.test.mjs.

## Follow-up, 2026-11-07 (workflow wfu1; tests `tests/followups-*.test.mjs`)
- The button to another loan reads "See the loan ›" when that loan's own name is a generic one ("Mortgage", "Loan"); else "See Condo loan ›" (`seeLoanWords`).

## Wording follow-up (2026-11-07)

Words, not abbreviations: "2 years 7 months sooner", "1 year sooner", "$1,980 a month" (`yearsMonthsWords` in `core/format.js`), as the other debt pages say it.

## Touch and input stress test (2026-11-11, claude-g)
- The What if boxes are the kit's money boxes ($ in front, commas) and change only the answer cards under them, on every key (x-1,
  x-4, j-keyboard-reader x-redraw-on-change): the page used to rebuild itself when a box was left, so the tap on the next box was
  lost and the keyboard closed. A box that cannot be read keeps the last answer; an empty one is $0.
- Dates in the tiles are month and year ("ends October 2041", "around May 2027"), as on the other debt pages (x-5).
- "Open my payoff plan" and "Type what you pay" are their own 44 px buttons (FF8); "Type what you pay" opens this loan's form.
- With no mortgage, "Add the mortgage" opens Net worth's add form set to Mortgage with "Back to Mortgage" after the save; with a
  mortgage but no rate, "Add the rate and payment" opens its own form on Debts (DP-3).
- Follow-ups (2026-11-11): its links to Debts carry `?back=debt/mortgage`; the extra box is empty with a grey 0 at $0; the
  mortgage-insurance hint without a home has "Add your home".

## Loans lane 1 (2026-11-07; tests `tests/loans-escrow.test.mjs`)
- Mortgage insurance is shown only while the loan is above 80% of the home's value (`pmi.applies`): below that no mortgage
  insurance is charged on a conventional loan, and by law it is cancelled on request at 80% of the original value and ends by
  itself at 78% (Homeowners Protection Act of 1998, 12 U.S.C. 4901-4902, read 2026-11-07). A loan at 33% owed had shown dates
  for an insurance it never had.
- The refinance question offers only the spans the oldest adult was about 20 or older in (`startChoices`, overview/guesses
  `mortgageAsk`). A start typed on Debts (`startDate`, `termMonths`) is read first ("you took it out in ...", a 15-year term
  said as such). When the payment is ours and the loan would run more than a year past what is usual for the age (a payment at the
  purchase loan's own principal and interest on a balance of ours above that loan's, overview/guesses README), the page says
  owners that age have often refinanced since (`longer`), and that is not called "far off" (`apart`); a payment of ours that pays
  off far sooner than the loan's years (a small balance typed) still is.

## Fix round 1 on the loans lane (2026-11-11, claude-c; tests `tests/loans-escrow.test.mjs`)
- The first line says the split: "$1,450 a month, of which $380 is property tax and home insurance; the other $1,070 pays the
  loan" ("(our guess)" when it is ours).
- The tax and insurance are Debts' own figure (`row.escrow`); this page no longer cuts a typed figure to half the payment again.
- "Mortgage insurance" shows only when the share printed is above 80% (`pmi.applies`: above 80% and rounding above 80), so
  80.0003% no longer reads "you owe 80% now" under a line that says it ends at 80%. Source: Homeowners Protection Act of 1998,
  12 U.S.C. 4901-4902, https://www.law.cornell.edu/uscode/text/12/4902 (read 2026-11-07).
- A guessed loan that runs longer than the purchase loan's years says by how much: "At this payment about 30 years are left: 14
  more than a 30-year loan from 2012 would have". It said "a little longer" and "counted from 2012". `longer` is also set once the
  payment or the balance is kept or typed (the other figure is worked over the same months); never for a start typed on Debts.
  `apart` is now only a payoff far sooner than the loan's years.

## Plain words (spec 13.1, C10, 2026-11-13)
Words only: every figure (the recast's new payment and saving, the schedule, the dates) is as before.
- The lump-sum box: "Pay a lump sum to lower the monthly payment" (was "One lump sum (for a recast)"), its help line "the
  lender works out a lower payment with the same end date (a "recast"); lenders charge a small fee" (the lender's word kept
  in the help, for asking the lender); the answer tile "After a $20,000 lump sum" (was "Recast with $20,000").
- The empty page: "... paying every two weeks or a lump sum that lowers the monthly payment would do."
- The first line: "$265,000 left at 6.25% interest, ..." (the rate said as interest).
- "a new appraisal" (spec 13.1) is not on the page: it was only in a code comment, now "a new valuation of the home". The
  module's `purpose` ("... or a recast would save") stays, as it is the catalog row's text (docs/MODULE_CATALOG.md, not in
  this lane) and search reads it.
Test: `module.test.mjs` ("C10 plain words").

