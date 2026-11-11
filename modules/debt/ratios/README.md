# What lenders see  (`debt/ratios`)

**Status:** usable (phase 4)
**Purpose:** Debt-to-income, housing and card-use ratios with the lines lenders draw, so you know what an application looks like.

## Inputs
Plan sections read (`needs`): `accounts`, `debts`, `income`, `expenses` (rent when there is no mortgage), through the Debts, Income and Credit cards computes.

## Outputs
`incomeMonthly`, `payments`, `housingPayment`, `dti`, `housingRatio`, `utilisation`, `monthsOfIncomeOwed`, `grades`, `owed`, `hasIncome`, `hasDebts`, `rows[]` (label, value, kind, grade, why).

## Formulas
- Debt-to-income = required debt payments a month / gross monthly income: comfortable to 36%, high to 43%, stretched above. The lines are mortgage underwriting limits: Fannie Mae's manual maximum is 36% (45% with a strong credit score and reserves, 50% through its automated approval; Selling Guide B3-6-02); FHA's manual limit is 43% without compensating factors (47% with one, 50% with two; HUD Handbook 4000.1). The CFPB removed the 43% limit from the General Qualified Mortgage rule in 2021 (a price test replaced it). In FY2025 about 63% of FHA purchase loans were above 43% (HUD, FY2025 Annual Report to Congress on the FHA MMI Fund, Table B-10). All read 2026-10-31.
- Housing ratio = mortgage payment (or housing expenses when there is no mortgage) / gross monthly income: 28% comfortable (the CFPB's homebuying toolkit, "Your home loan toolkit", p. 3), 35% high.
- Card utilisation from the Credit cards page: excellent to 10%, fine to 30%, hurts to 50%, hurts a lot above.
- Months of income owed = everything owed / one month's income.

## Tests
`tests/debt-pages.test.mjs`, `module.test.mjs`.

## Card use: how much less, and when (round 4, 2026-11-02)
Under "Card limits in use", when it is over 30%: Credit cards' `under` answer ("$1,900 less on the cards gets you under 30%: about June 2027 at what you pay now") and a link to the payoff plan. "Debt payments a month" says when it is what you pay and how much of it is required ("what you pay, from the Debts page; $2,580 of it is required"); the ratio itself is unchanged.

## A renter's line (round 8, 2026-11-06)
A renter's 21% (an invented renter: $670 of required payments on $3,250 a month) was "comfortable" against 36%, a line that
for a homeowner includes the mortgage and for a renter never includes the rent. The source: CFPB, Your Money, Your Goals, "Debt-to-income calculator tool" (2018-11,
https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf, read
2026-11-06): homeowners "36 percent or less ... Some lenders will go up to 43 percent or higher. Your home mortgage is
included in this ratio"; renters "15-20 percent or less. Your rent is not included in this ratio."
- Renter = no mortgage owed and no Real estate account (`rentsHome` in `balance/liabilities/compute.js`, shared by Debts,
  How am I doing and the Plan health score). Then `renter: true` and the debt row is graded on `LINES.dtiRenter`: 20% or
  less "within the guideline for renters" (ok), to 36% "over the guideline for renters" (warn), above "stretched" (bad; the
  app's own step: above the homeowners' 36%, which counts a mortgage too, debts alone are stretched).
- `withHousing` = (required debt payments + housing expenses) / gross income, when there is a rent: (670 + 950) / 3,250 =
  49.85%. The row's `note` says it as a home lender would see it (`lenderWithHousing`): "Add a home payment like your $950
  rent and a lender would see 50% of your income going to debts: more than most lenders accept (36%, or up to 45 to 50% only
  with a strong credit score and savings)." A rent that is still our guess reads "the $1,200 rent we guessed for you (type
  yours on Expenses)" (verify, 2026-11-06; `isGuess` on each housing bill's amount). The lines are Fannie Mae Selling Guide B3-6-02 "Debt-to-Income Ratios" (updated 2025-04-02,
https://selling-guide.fanniemae.com/sel/b3-6-02/debt-income-ratios, read 2026-11-06): "maximum total DTI ratio is 36%" for
loans checked by hand, up to 45% with the credit score and reserves its matrix asks for; through DU "the maximum allowable DTI
ratio is 50%".
- A homeowner's figures, grades and words are as before (no `renter` or `withHousing` keys). Test: `module.test.mjs` ("round 8").

## Ideas / not yet
- A "what could I borrow" line from the 36% and 43% lines; credit-score notes.

## Round 8 review fixes (2026-11-06)
- **D3, required payments.** A renter's debt row is `dtiRequired` = required payments / gross income (the Debts page's
  minimums, not any extra chosen on top), and `withHousing` adds the rent to the required payments. An invented renter paying
  $400 extra on a $150-minimum card read 22% ("over") and "51%" with the rent; now 9.8% ("within") and (320 + 950) / 3,250 =
  39%. Source: Fannie Mae Selling Guide B3-6-05, "Monthly Debt Obligations" (dated 2026-08-05,
https://selling-guide.fanniemae.com/sel/b3-6-05/monthly-debt-obligations, read 2026-11-06): revolving accounts are counted at
the payment the credit report shows, with "5% of the outstanding balance" only when it shows no required minimum; nothing in
it counts a payment the borrower chooses on top. `dti` (payments with the extra) is kept for homeowners.
- **D6, today's rent.** With no mortgage payment, housing is the housing expenses running today (Expenses' `active` list,
  monthly, as How am I doing reads it), not every housing expense ever typed: a rent that ended in 2025 was still "your $1,450
  rent".
- **D7, graded at the percent shown.** Debt-to-income and housing grades use `shownShare` (round to the whole percent):
  20.3% shows "20%" and is "within the guideline for renters"; housing 28.3% shows "28%" and is "comfortable". Card use keeps
  its exact share (Credit cards says how much less gets under 30%).
- Tests: `module.test.mjs` ("review D3", "review D6", "review D7"), failing before the fix.

## Touch and input stress test (2026-11-11, claude-g)
- With no income on file the page shows only the hero, a filled "Add your income" and (with no debts) an outlined "Add your
  debts", not $0 tiles and dashes (DP-7). "Add your debts" opens Net worth's add form for a loan or card, with a way back.
- "Open my payoff plan" is its own 44 px button under the card-use sentence (FF8).
