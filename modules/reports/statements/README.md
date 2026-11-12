# Financial statements  (`reports/statements`)

**Status:** usable (phase 9)
**Purpose:** Bundles your balance sheet, income statement and cash-flow statement into one printable pack.

## Inputs
`accounts`, `household` (owners), and through other computes: Net worth, Income, Expenses, Debts, Next best action (the year's money), Income statement (the bank files). Writes nothing.

## Outputs
`{ ready, missing, today, balance, income, actual, cashflow }`.

## The statements
- **Balance sheet** (today): assets in `ASSET_GROUPS` order, most liquid first (cash; investments; retirement accounts; health and education accounts; home, property and vehicles; other), each account with its owner; liabilities split into owed within a year (`SHORT_TERM_DEBT`: cards) and over years (loans); totals and net worth; a by-owner table (an account with no owner is "Joint").
- **Income statement** (a year, from the plan): income by type (Income page), federal income tax (Federal estimate) and payroll tax (Next best action's `FICA`), spending by category (Expenses page), saving for retirement (own contributions) and goals, what is left. When there are transactions, the last twelve complete months from the bank files beside it (Income statement page; transfers left out).
- **Cash-flow statement** (a year): cash from living (income less taxes and spending, loan payments counted as typed on the Expenses page), money put to work (retirement accounts, goals), left in cash; a memo splitting the Debts page's loan and card payments into interest and principal; and how much net worth grows a year from saving and paying down debt, before investment returns.
Amounts in brackets are owed or going out. Prints through `../report-kit.js`.

## Tests
`module.test.mjs`: the balance sheet adds up (groups, short and long debt, owners); the income and cash-flow statements close; the bank files use complete months only.

## The statements add up (round 4, 2026-11-02)
The income statement and cash-flow statement show every line Next best action takes off the month: state income tax, business costs, the saved debt extra and uneven pay not counted on (after its tax). Before, their "Left over" and "Left in cash" (Next best action's month) did not follow from the lines printed above them, and the note said state tax was left out.

## Ideas / not yet
- Last year's balance sheet beside this year's (from the net-worth history); the statements over the bank files' categories (operating, investing, financing) once transfers to investment accounts are tagged.

## Review 2026-11-06
- **Every report finishes (fix round 6).** The page draws its compute's answer through `settleReport` (report-kit): a
  compute that failed (the shell's `{ error }`), a drawing that throws or a remote call that rejects shows "The financial statements
  could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates
  and the ages on the People page, then reload the page." in place of the loading line. A scan of all 1,406 qa households
  and the fixtures found no other report that hung. For the four "older than 120" households (born 1900) this page's
  compute does not fail and the page reads a full report; the retirement report, the plan summary and the annual review
  fail inside the retirement projection and now show the notice. Test: reports/tax "every report finishes
  when its figures cannot be worked out (settleReport)".

## Net worth grows or shrinks (2026-11-07)
`netWorthGrowth` is the month as it reads (left-over after goals, below zero too) plus retirement and goal saving, x 12, plus the debt principal paid; it is no longer clamped at zero, so a household that spends more than it takes in is told net worth shrinks (one answer with Next best action `spare.year`). The saved debt plan's extra (Pay off debts) pays debt down too and is counted, so the figure is `spare.year.total` plus the principal of the Debts page's payments, exactly (verify 2026-11-07; before, the two renter fixtures with a saved plan were $600 a year short).

## Rentals and the child care account on the statements (left2 fix round 3, 2026-11-12)
Since the left2 lane, Next best action's month (the statements' "Left over" and "Left in cash") also takes off a rental's
empty months and running costs (`spare.rentCosts`, Rental analysis), a rental loan typed only on Rental analysis (`spare.rentLoan`:
no Debts row holds it, so it is not in Spending), and brings in the rent of a rental no Income line holds (`spare.rentOwn`, in
`spare.gross`). The statements now print each of them, with Next best action's labels, so the lines add up again:
- Income statement: "Rent (Rental analysis)" among the income lines when `rentOwn` is above zero (the income lines sum to Total income);
  "Child care account money it would lose", "Rental running costs (Rental analysis)" and "Rental loan payment (Rental analysis)"
  after Total income, beside Business costs (not under the Taxes heading: they are not taxes), each only when above $0.50 a year.
- Cash-flow statement: the same three lines under "Everyday money"; `fromLiving` = income - taxes - spending - business costs -
  uneven pay held - care account money lost - rental running costs - rental loan, and `fromLiving - retirement - goals - debt extra = net`.
The child care account's lost money (Form 2441 line 14, `careLost`) was already in Next best action's month and missing here.
Before (final check round 2, on qa/fixtures/round8-rental.mjs, today 2026-11-06): the lines gave $58,505 (condo on Net worth) and
$68,717 (condo only on Rental analysis) against a Left in cash of $44,545; with no Income rent line the income lines summed to
$167,000 against a Total income of $192,200. Now every line adds up on the four condo plans and a care-account plan (test
tests/left2-fix1.test.mjs "NEW-1").
Decision: `netWorthGrowth` stays `spare.year.total` plus the Debts page's principal. A rental loan typed only on Rental analysis is
not a Debts row and not on the balance sheet, so the part of its payment that pays the loan down is not counted as net worth
growth here (the balance sheet does not hold that loan either).
