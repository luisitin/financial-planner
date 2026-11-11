# Debts  (`balance/liabilities`)

**Status:** usable (phase 2)
**Purpose:** Lists every debt you owe with its interest rate, term, minimum payment and whether anything secures it, plus payoff dates and the debt-to-income ratio.

## Inputs
Plan sections read (`needs`): `accounts` (liability types from `balance/net-worth`), `debts` (detail per account: `{ id, accountId, rate, minPayment, extra, termMonths?, startDate?, securedBy? }`), `income` (for the debt-to-income ratio, through `cashflow/income`).
`compute(plan, { today })`: `today` for payoff dates.

## Outputs
`rows[]` (account fields plus `icon`, `typeLabel`, `owed`, `detail`, `rate`, `minPayment`, `extra`, `payment`, `interestMonthly`, `months`, `payoffDate`, `totalInterest`, `expensive`, `neverPaysOff`, `byGuesses?`), `count`, `withDetail`, `owed`, `minimums`, `payments`, `interestMonthly`, `avgRate`, `income`, `dti`, `highest`, `warnings[]`.

## Formulas
- Interest per month = balance x rate / 12.
- Months to payoff at the current payment (required + extra): `nper(rate / 12, payment, balance)` (`core/math/finance.js`), rounded up. Infinity when the payment does not cover the interest.
- Payoff date = today + months (`core/math/dates.js` `addMonths`).
- Interest still to come: `amortization({ principal, annualRate, payment })` total interest.
- Average rate: weighted by balance over debts that have a rate.
- Debt-to-income = monthly debt payments / monthly gross income (from the Income page). 36% and 43% are the usual lender thresholds shown on screen.
- "Expensive" = rate at or above `HIGH_RATE` (15%) with a balance, unless the debt rests on our guesses alone:
  `byGuesses` (present only when true) = both what is owed (`accounts[<id>].balance`) and the rate
  (`debts[<id>].rate`) are our guesses (core/estimate `isGuess`; a plan with no `guesses` is never looked at). Such a
  debt gets no "expensive" flag, warning or Needs attention alert: a guess never turns a figure amber by itself
  (smart-guesses spec P7; C2 review, 2026-11-06). A typed balance or rate keeps the flag as before.
- Sort: highest rate first (the avalanche order), then largest balance.

Paid off (round 4, 2026-11-02): a debt with its details and nothing owed (`paidOff`) has payment and minPayment 0, so
"Paying each month", debt-to-income, What lenders see and Expenses' check drop it; the row says "paid off" with no
payment. `typedPayment` keeps the payment typed, so Expenses can still find the expense that was its payment.

## Edge cases
No liability accounts: empty state pointing to Net worth. Debt without detail: listed with "needs details", excluded from average rate and payoff. Payment below interest: warning. Balance 0: paid off. Detail whose account was deleted: ignored.

## Tests
`module.test.mjs`: no debts, missing detail, nper agreement and payoff date, expensive flag, weighted rate, DTI, never-pays-off and zero balance; a card whose balance and rate are both our guesses is not flagged (no warning, no alert) while a typed balance or rate still is.

## Both payoff dates (round 4, 2026-11-02)
A debt the payoff plan finishes sooner (debt/payoff `twoDates`) reads "paid off by January 2046 on its own payment, March 2039 on your payoff plan", and a line under the list says why (each debt's payment moves onto the next once it is paid off), with a link to Pay off debts.

## A date holds only at the same payment (round 8, 2026-11-06)
"Paid off by June 2031 on its own payment" read, for a card, as "paying the minimum", but a bank's minimum shrinks with the
balance and takes far longer (Credit cards). Every dated debt now says the payment the date rests on, once: "29.0% · paid
off by June 2031 if you keep paying $150 a month, August 2029 on your payoff plan" (the separate "$150 a month" is dropped
when a date says it). Test: `module.test.mjs` ("round 8"), the page's words on `qa/fixtures/renter-debt-plan.mjs`.

## Debt payments against income: the line for renters (round 8, 2026-11-06)
`DTI_LINES`, `LENDER_DTI`, `rentsHome(plan, rows)` and `lenderWithHousing(share, rent, currency)` live here, so Debts, What
lenders see, How am I doing and the Plan health score grade a renter alike. A renter (no mortgage owed, no Real estate
account) is graded on 20% (rent not counted); the tile reads "over the 20% guideline for renters (rent not counted)" where it
said "under 36%: comfortable" for 21%. Homeowners: as before. Sources: CFPB, Your Money, Your Goals, "Debt-to-income calculator tool" (2018-11,
https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf, read
2026-11-06): homeowners "36 percent or less ... Some lenders will go up to 43 percent or higher. Your home mortgage is
included in this ratio"; renters "15-20 percent or less. Your rent is not included in this ratio." Fannie Mae Selling Guide B3-6-02 "Debt-to-Income Ratios" (updated 2025-04-02,
https://selling-guide.fanniemae.com/sel/b3-6-02/debt-income-ratios, read 2026-11-06): "maximum total DTI ratio is 36%" for
loans checked by hand, up to 45% with the credit score and reserves its matrix asks for; through DU "the maximum allowable DTI
ratio is 50%". Test: `module.test.mjs` ("round 8").

## Ideas / not yet
- Snowball vs avalanche schedules with a fixed extra budget (phase 4 `debt/payoff`).
- Amortisation tables and refinance comparison (phase 4 `debt/mortgage`, `debt/refinance`).

## Round 8 review fixes (2026-11-06)
- **A renter's share is of the required payments.** `dtiRequired` = minimums / gross monthly income (additive; `dti` = all
  payments, with any extra chosen on the Debts page, stays for the homeowners' line, which has always used it). A renter paying
  $400 a month extra on a card read 22%, "over the guideline", and lost score points for paying debt down faster; a lender
  counts the required $320: 9.8%. Source: Fannie Mae Selling Guide B3-6-05, "Monthly Debt Obligations" (dated 2026-08-05,
https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations, read 2026-11-06): revolving accounts are counted at
the payment the credit report shows, with "5% of the outstanding balance" only when it shows no required minimum; nothing in
it counts a payment the borrower chooses on top.
- **Graded at the percent shown.** `shownShare(x)` = round(x x 100) / 100; `renterLevel(share)` -> "fine" (15% or less),
  "within" (to 20%), "over" (to 36%), "stretched", on it. 20.3% read "20%" and "over the 20% guideline"; it is now within, as
  it reads. The tile grades a homeowner's share on it too (36.0% to 36.49% now reads "under 36%: comfortable", as it shows).
  Verify (2026-11-06): x x 100 is first taken to 12 significant digits, as core/format.js `pct` prints a percent: 0.285 is
  stored as 0.28499999999999998, so round(x x 100) gave 28 while the page printed "29%" (housing of exactly 28.5% read "29%
  comfortable" on What lenders see). Only exact half percents stored just under the half move (in a sweep of whole-dollar
  payments on incomes of $500 to $30,000: 14.5%, 28.5%, 56.5% and 57.5%).
- **The tile** for a renter: the required share, "within the 20% guideline for renters", with "required payments: " in front
  when an extra is paid on top (so it is not read against the "Paying each month" tile beside it).
- **The home lender's sentence has a verdict** (`lenderWithHousing`, at the percent shown): "Add a home payment like your $950
  rent and a lender would see 50% of your income going to debts: more than most lenders accept (36%, or up to 45 to 50% only
  with a strong credit score and savings)." 36% or less: "within the 36% most lenders want"; to 45%: "more than the 36% most
  lenders like; some go to 45% with a strong credit score and savings" (Fannie Mae B3-6-02, above).
  Verify (2026-11-06): `lenderWithHousing(..., { guessed })`: when some of the rent is still our guess (a housing bill whose
  amount is in the guesses ledger, core/estimate `isGuess`; Get started's spending guesses fill the rent in), it is not "your
  rent": "Add a home payment like the $1,200 rent we guessed for you (type yours on Expenses) and a lender would see 58% ...".
- Tests: `module.test.mjs` ("review D3", "review UX"), failing before the fix.
- **One "first".** The expensive-debt notices (rows highest rate first) say "Paying it down first saves the most" only for the
  first; each later one "Pay it down once the Visa card is paid off" (the one before it). Three amber notices each said
  "first". Test: "only one expensive debt is 'first'", failing before the fix.

- **Notices follow the saved payoff order (2026-11-07).** With a saved smallest-balance-first or own order (`debtPlan.order`,
  `customOrder`) the expensive-debt notices are ranked as Pay off debts pays them: each says "Pay it down once the X is paid off"
  for the expensive debt before it in that order, and the first says "Your payoff plan pays it down first of these." (not
  "saves the most", which is only true highest-rate-first). Highest rate first, or nothing saved: as before. Test "F2".

## Notices follow a saved order (review D3, 2026-11-07)
With a saved smallest-first or own order, "Pay it down once the X is paid off" names the debt Pay off debts pays just before it, counting every
debt it pays (a cheaper car loan or medical bill between two cards included). The note under the list says which order the plan uses.
- Verify (2026-11-07): "Paying the highest interest rate first would save more in interest" under the list is said only when Pay off
  debts (`debt/payoff` compute, `plans[order].totalInterest - plans.avalanche.totalInterest` of $0.50 or more) finds it does; an own
  order that is already highest rate first costs the same and no longer reads that. Test "verify: the order note".

## Touch and input stress test (2026-11-11, claude-g)
- **One costly notice** (D7): two or more expensive debts are one amber notice with what they cost together and the order the
  payoff plan pays them ("3 debts cost about $220 a month in interest. Pay them down in this order: Visa card first (29%), then
  Store card, then Mastercard.") and the filled "See my payoff plan". `compute` returns `costly: { count, interestMonthly,
  order }` and `stuck` (the "never pays off" lines, still one each). One costly debt keeps its own sentence.
- **A form for the kind** (D3): a card's form has rate, required payment, extra and credit limit; a loan's has no credit limit.
  Boxes not shown keep what is on file. The form's heading takes the focus (without scrolling), so a screen reader lands on it.
- **A way to add** (D1): "+ Add a loan or card" under the list opens Net worth's add form for a loan or card; after the save the
  green line's button opens the new debt's rate and payment here. "Open my payoff plan" is a 44 px button (B8, FF8).
- **Opened at one debt** (`#/balance/liabilities/<id>`): that form opens once, in view; the redraw after its save closes it.
- **`?back=<group/id>`** (2026-11-11): opened from Mortgage, Refinance, Credit cards or Pay off debts to give a debt its rate, the
  green line after the save carries "Back to <that page> ›" and stays. Under an own order that pays a cheaper debt first, the
  costly notice names it ("the Car loan first, then Mastercard, ..."; `costly.before`). "Secured by" reads "What it is borrowed
  against".
- One costly debt also gets the filled "See my payoff plan" in its notice (Needs attention opens this page; MR-7's other half).
