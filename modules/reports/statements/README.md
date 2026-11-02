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
