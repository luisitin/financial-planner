# Rental analysis  (`property/rental`)

**Status:** usable, phase 7
**Purpose:** What a rental really earns: rent less empty months and costs, the loan and tax, the checks a lender makes, and what it adds to your wealth.

## Inputs
- `property[]` entries with `kind: "rental"`: `{ id, name, value, accountId?, purchasePrice, purchaseDate, rentMonthly, vacancy, propertyTax, insurance, hoaMonthly, maintenance, management, utilitiesMonthly, otherMonthly, cashIn, loanAccountId?, loanBalance, loanRate, loanPayment, landShare, improvements, appreciation }`.
- A linked property account (value) and mortgage account (balance, with the rate and payment from Debts) when named.
- The federal estimate (its inputs and tax, AGI, taxable Social Security, the IRA deduction, filing status, `taxes.livedApart`)
  and the state's share of income.

## Outputs
`{ ready, year, rentals: [{ rent, vacancy, income, costs, opex, noi, capRate, debtService, interest, principal, cashFlow, cashIn, cashOnCash, dscr, breakEven, onePercent, basis, depreciation, taxable, lossUsable, lossCarried, tax, afterTax, loan, equity, growth, totalReturn, returnOnEquity }], totals, rates, lossRoom, passive: { profits, losses, netLoss, againstOther, allowed, suspended, net, shares }, separateTogether, tax: { federal, niit, state, total } }`.

## Formulas
- Income = rent × 12 × (1 − vacancy, default 5%). Running costs = property tax + insurance + dues + upkeep
  (default 1% of value a year) + manager (share of income) + utilities + other.
- Net operating income (NOI) = income − running costs. Cap rate = NOI ÷ value.
- Loan payments: twelve months on its balance, rate and payment (`cashflow/statement` `yearOfPayments`), split into
  interest and principal. Cash flow = NOI − payments. Cash-on-cash = cash flow ÷ cash put in.
- Debt-service coverage = NOI ÷ payments; lenders usually want 1.25 or more. Break-even occupancy =
  (running costs + payments) ÷ full rent. The "1% rule" = monthly rent ÷ price paid.
- Depreciation (IRS Publication 527): basis = price × (1 − land share, default 20%) + improvements, straight-line over
  27.5 years from the month first rented, mid-month in the first year: (12 − month + 0.5) / 12 of a year; it stops
  once the basis is used up.
- Taxable = income − running costs − interest − depreciation.
- **Losses** (`passiveLosses`; IRC 469, Form 8582), each rental its own activity with active participation and nothing
  carried in from earlier years: rentals with a profit absorb the others' losses first (469(d)(1): the passive activity
  loss is "the aggregate losses from all passive activities ... exceed ... the aggregate income"); the special allowance
  then takes at most that net loss off other income (469(i)(1)); what counts and what waits is spread over the losing
  rentals by the size of each loss (469(j)(4): "allocated ... on a pro rata basis"; 26 CFR 1.469-1T(f)(2); Form 8582 Parts
  VI-VII). A loss that waits is used in a year with rental profit, or when that rental is sold (469(b), (g)).
- **The allowance** (`lossRoom`): $25,000 less half of modified AGI above $100,000, gone at $150,000 (469(i)(2), (3)(A));
  filing separately $12,500 less half above $50,000, but only when the spouses lived apart all year (`taxes.livedApart`,
  ticked on the Federal estimate); filing separately otherwise, none at all (469(i)(5)(B): it "shall not apply to a
  taxpayer who ... is a married individual filing a separate return ... and ... does not live apart from his spouse at all
  times during such taxable year"; P925). Modified AGI = AGI without the taxable Social Security and the IRA deduction, at
  least 0 (469(i)(3)(E): "without regard to (i) any amount includible in gross income under section 86, ... (iii) the
  amounts allowable as a deduction under sections 219, 221, and 250, and (iv) any passive activity loss"; Form 8582 line 6;
  quoted from the answer key's RULES.md, read 2026-10-31). The student loan interest deduction (221) is in the typed
  adjustments, which are not split out, so it stays in. Filing separately (two returns), the rentals' result goes on the
  return the federal estimate puts added income on (the adult marked Me), and the allowance is worked on that return's own
  modified AGI, not the two added up (469(i)(5)(A); Form 8582 is one per return). The page's sentences take the figures in
  use (`rule`: 25,000 / 100,000 / 150,000, or 12,500 / 50,000 / 75,000 filing separately).
- **The tax** (`tax`): the federal estimate's total tax with the rentals' allowed net result added (a profit as ordinary
  income and as investment income for the 3.8% tax, IRC 1411(c)(1)(A)(i), Form 8960 line 4a; a loss off income) less the
  total without, so it crosses brackets and the standard deduction and adds the 3.8% on the lesser of the net rent and the
  income over the line for the filing status (`rates.niitLine`, the engine's table: 250,000 for a qualifying surviving spouse
  too); plus the state's share at its effective rate. **Each rental's line**: the profits' side is the estimate with the
  profits alone added less without, shared by the size of each profit; the losses' side is the rest of the household's
  change, shared by each rental's allowed loss; the state's share goes the same way. The two sides add up to the change and
  stay steady when profits and losses nearly cancel (+8,000 and -8,000 at 24%: 1,920 and -1,920; until a review on
  2026-10-31 each line was the change × its part ÷ the net result, which jumped near a net of 0: -1,920 each way at a net of
  +1, and -10,224 on an 8,000 profit when a child-credit step moved the change by 63.90 on a net of 50).
- Until 2026-10-31 the page set each loss against the allowance alone in the order typed, gave the allowance to a couple
  filing separately who lived together, and priced the result at one marginal rate without the 3.8%; the answer key found
  all five (below).
- What it adds = cash flow + principal paid + value × appreciation (default 3.5%); on equity = value − loan.

## Edge cases
- No loan: no coverage ratio; cash flow = NOI. No rent or value: the form asks for them first.
- If Income also lists the rent, the federal estimate counts it there; this page's tax line is the rental's own result.
- Real-estate professionals and short-term rentals follow other rules: not modelled.

## Tests
`module.test.mjs`: depreciation (first year, full years, the end), the allowance, not ready, the duplex by hand, a loss
shared by two rentals, linked accounts, no loan, the netting and the pro-rata split, the answer key's worked examples (Jun's
two rentals: -4,840 at 90,000 and 12,000 waiting with -2,364 at 130,000; Kit filing separately: nothing counts living
together, -900 living apart; the 3.8% of 329.05 on Ivo's duplex), the IRA deduction left out of modified AGI, two adults
filing separately and living apart (the allowance on Me's 45,000: -1,200), the lines steady at a net of 0 and +1, the 3.8%
line for a qualifying surviving spouse.
`tests/golden-property.test.mjs`: an independent answer key (`tools/golden_property`, 1,500 depreciation rows and 2,000
households with 3,489 rentals for 2025 and 2026 worked from IRC 168, 469 and 1411, 26 CFR 1.469-1T, Pubs. 527, 925 and 946,
Form 8582 and the Rev. Procs., never from this code; `tests/golden/property/RULES.md`). Every row agrees since 2026-10-31,
the netting, the allowance and the 3.8% included. It found five causes, all fixed (above). Depreciation follows the formula;
the IRS's Table A-6 differs by up to $19 in a year, both lawful (Pub. 946).

## Ideas / not yet
- A ten-year hold with the sale: depreciation recapture at up to 25%, gains tax, the return over the hold.
- The rental's rent and costs flowing into Income and the federal estimate's Schedule E line.
