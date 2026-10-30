# Balance sheet  (`balance/statement`)

**Status:** usable, phase 9
**Purpose:** Everything you own and owe on one printable page, by how fast it turns into cash and by owner, with the ratios.

## Inputs
- `accounts[]` (balance, type, `ownerId`), `household.people[]` (names, birth dates for 59½).
- `debts[]` through `balance/liabilities` (rate and payment of each loan).
- `expenses[]` through `cashflow/expenses` (monthly spending, for months of cash).
- The federal estimate's top rate (`taxes/federal`) and the state's share of income (`taxes/state`).

## Outputs
`{ ready, today, owners, tiers: [{ id, label, accounts: [{ id, name, type, typeLabel, owner, value, cashIn, note }], total, cashIn }], assets, cashIn, taxRate, debts: [{ id, name, type, typeLabel, owner, owed, dueSoon, dueLater }], liabilities, dueSoon, dueLater, netWorth, netWorthCashed, byOwner, ratios: { monthlySpending, monthsOfCash, quick, debtToAssets, investedShare } }`.

## Formulas
- Tiers: today = checking, savings, cash; a few days = brokerage, crypto; later = 401(k), IRA, Roth, HSA, 529,
  life insurance cash value; months = home, cars and anything else.
- If cashed in: 401(k) and IRA × (1 − tax rate − 10% if the owner is under 59½, IRS Publication 590-B), where the
  tax rate = the federal top rate + the state's tax as a share of income; a home × (1 − 6%) for agent and closing
  costs; everything else at its value (tax on investment gains is left out; Roth, HSA and 529 money comes out free
  for its purpose). 59½ is counted in whole months (714). Joint accounts use the first adult's age.
- Due within a year: a card's whole balance; a loan's principal over the next 12 payments = balance − balance after
  12 payments at its rate (none without a payment). Later = owed − due within a year.
- Months of cash = today's tier ÷ monthly spending. Quick ratio = (today + a few days) ÷ due within a year.
  Debt to assets = owed ÷ owned. Invested share = invested accounts (brokerage, crypto, retirement, HSA, 529) ÷ net worth.
- Net worth if sold today = cashed-in total − everything owed.
The sheet prints through `modules/reports/report-kit.js` (its own light document, no app around it).

## Edge cases
- No accounts: a hero pointing to Accounts. No spending: the months-of-cash line says to add it.
- One owner: no owner column or owner table.

## Tests
`module.test.mjs`: principal within a year, no accounts, the family's tiers and totals, cash-in by hand, 59½ to the
day, a state's rate added, cards and loans due, owners and every ratio.

## Ideas / not yet
- Tax on investment gains from the holdings' cost basis.
- A side-by-side with the balance sheet a year ago from the accounts' history.
