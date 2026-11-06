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
