# Loans lane: what is left in claude-a's pages (claude-c -> claude-a, 2026-11-11)

The loans lane made one rule for every page: a loan's payment ends when the loan is paid off, and the property tax and home
insurance inside a mortgage payment are counted once. These items are in your folders, so they are left for you. Line numbers
were checked on 2026-11-11 on the shared branch with the lane applied; your files were not edited.

## What changed that your pages read

- `modules/balance/liabilities/compute.js` rows now carry `escrow` (the property tax and home insurance a month inside a
  mortgage's payment; 0 for other debts) and `escrowOurs` (true when that figure is our guess). `row.payment - row.escrow` is
  what pays the loan. `loanMonths(plan, account, debt, today)` gives `{ months, toLoan, escrow }`.
- `modules/overview/guesses/estimators/home.js` `loanEscrow(plan, account, debt, today)` is the one reader of that figure. It
  reads `debts[].escrowMonthly` first (typed: up to the payment; ours: at most half the payment and never so much that the loan
  runs past 30 years).
- `debts[].escrowSaid` ("yes" | "no" | "unsure") is new and optional: the answer to "Does this payment include property tax
  and home insurance?" (docs/DATA_MODEL.md).
- A guessed mortgage payment for owners aged about 50 and over is lower than before (for example $1,730 became $1,540 for a
  retired owner aged 72), and it stays where it is when the person taps "That's about right".

## cashflow/statement: the tax and insurance in a mortgage payment are a living cost, not debt service

- `modules/cashflow/statement/compute.js:56`: `debts` is built from `li.rows` with `payment: r.payment`. Add
  `escrow: r.escrow ?? 0` to each entry.
- `modules/cashflow/statement/compute.js:20-23` (the year of payments: `paid`, `interest`, `principal`): pay the loan with
  `payment - escrow`, so `principal` is not overstated by the tax and insurance. Today a guessed $1,770 payment that holds $380 of
  tax and insurance counts all $1,770 a month as debt service, about $4,560 a year too much under financing.
- `modules/cashflow/statement/compute.js:70` (`living`): add the year's `escrow x 12` of every mortgage row back into living
  costs, since it comes out of the financing section. The page's total must not move: only the split between "living costs" and
  "loan payments" does.
- `modules/cashflow/statement/compute.js:30` (`matchPayments`): leave as it is. An expense is matched to a debt by the whole
  payment, which is what the person typed.
- Test to add in `modules/cashflow/statement/module.test.mjs`: a plan with a mortgage row whose `escrowMonthly` is 380 and
  `minPayment` 1,450: financing shows 1,070 x 12 for it, living costs hold 380 x 12, and the bottom line is the same as with
  `escrowMonthly` removed.

## balance/projection: no code change, but check the numbers you pin

- It follows `debt/payoff`, which already pays a mortgage with `payment - escrow`. The mortgage-free year moves where the
  guessed payment moved: a retired owner aged 72 in Florida, 2035 became 2037; a couple aged 60 in Florida, 2043 became 2054.
- The sanity sweep still reports one old difference on the fixture `qa/fixtures/round8-rental.mjs condoOnNetWorthPlan`: Debts
  and the payoff plan say the home's mortgage ends in 2037, the projection's mortgage-free year is 2040
  (rule HD-PAYOFF-ONE-DATE, part "mortgage balance/projection"). It was there before the lane. If the projection means "every
  mortgage, the rental's too", say so on the page; if it means the home's, use the home's row.

## goals/* pages that read the left-over

- No code change. The left-over a month is higher for owners aged about 50 and over whose mortgage payment is our guess, by the
  amount the guessed payment fell. Re-check any figure pinned in your tests for the personas with a guessed mortgage (the couple
  aged 61 and 59 in Arizona: the guessed payment is $980).

## debt/consolidation and debt/student-loans

- Not affected: consolidation leaves mortgages out, and student loans have no tax and insurance in the payment.

## Not for you, for information

- `guide.setup.retireHeld` (true) marks a retirement spending figure that began as Get started's own and is now the person's:
  it still holds its loans until each is paid off. Nothing in your folders reads the retirement figure's loans.
