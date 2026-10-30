# Home  (`property/home`)

**Status:** usable, phase 7
**Purpose:** Your home: what it is worth and what you own of it, what it costs a year to keep, what selling would leave, and value and equity ahead.

## Inputs
- The home: the property account named by a `property[]` entry with `kind: "home"`, else the largest property account
  (its `balance`, `asOf` and `history`).
- That entry's details: `{ purchasePrice, purchaseDate, improvements, propertyTax, insurance, hoaMonthly, maintenance, appreciation, sellCosts }`
  (property tax falls back to `taxes.itemized.propertyTax`).
- The mortgage (`debt/mortgage`: balance, rate, payment, extra, the yearly schedule); filing status, taxable income and
  AGI from the federal estimate.
- Writes: the home's details; "Update value" sets the account's balance and `asOf`, keeping the old value in `history`.

## Outputs
`{ ready, accountId, name, value, owed, mortgageName, equity, equityShare, ltv, details, bought: { price, date, years, growth, gain } | null, history, costs: { lines, total, monthly, principal }, sale: { costs, basis, gain, exclusion, taxable, rate, tax, net }, ahead: [{ years, year, value, owed, equity }], appreciation, pmi }`.

## Formulas
- Equity = value − mortgage; loan-to-value = mortgage ÷ value (above 80% lenders usually require mortgage insurance).
- Growth since bought = (value ÷ price)^(12 / months owned) − 1.
- A year: property tax + insurance + dues × 12 + upkeep (default 1% of the value) + the mortgage's interest over the next
  twelve payments (`yearOfPayments`); the principal part is shown apart (it is not a cost).
- Selling today: costs = value × 6% (agent and closing; your own share); gain = value − costs − (price + improvements);
  tax-free up to $250,000, $500,000 married filing jointly, on a main home lived in two of the last five years (IRC §121);
  the rest at 15% (20% when taxable income passes $533,400 single / $600,050 joint, 2025 thresholds) plus 3.8% net
  investment income tax above $200,000 / $250,000 of AGI. Keep = value − costs − mortgage − tax.
- Ahead: value × (1 + growth, default 3.5%)^years; owed = the mortgage page's schedule `endBalance` for that year
  (0 once it ends). Not in today's money.

## Edge cases
- No property account: a hero pointing to Accounts. No mortgage: all of it is yours.
- No purchase price: growth and the gain are not shown; the exclusion is explained.

## Tests
`module.test.mjs`: growth, not ready, the house by hand, a year of costs (with and without a tax figure), selling under the
exclusion, a large gain above it, the years ahead against the mortgage schedule.

## Ideas / not yet
- Refinance and recast live on Debt > Mortgage; a link from here when rates fall below the mortgage's.
- Property tax appeals: the assessment against the value typed here.
