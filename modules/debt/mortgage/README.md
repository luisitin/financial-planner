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
