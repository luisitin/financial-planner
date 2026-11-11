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
  adjustments, which are not split out, so it stays in. The AGI is worked without the Income page's rent (round 8,
  `withoutIncomeRent` from taxes/federal `known.js`): Get started and the Income page list the rent before any cost, and
  the Federal estimate counts this page's result in its place, so the allowance is no longer tested with the gross rent in
  (landlord: 154,400, it was 179,600 with 25,200 of rent; the 1,547 loss is carried either way, the allowance being gone
  at 150,000). `incomeRent` (only when there is some) is the rent taken out. Filing separately (two returns), the rentals' result goes on the
  return the federal estimate puts added income on (the adult marked Me), and the allowance is worked on that return's own
  modified AGI, not the two added up (469(i)(5)(A); Form 8582 is one per return). The page's sentences take the figures in
  use (`rule`: 25,000 / 100,000 / 150,000, or 12,500 / 50,000 / 75,000 filing separately).
- **The tax** (`tax`): the federal estimate's total tax (without the Income page's rent) with the rentals' allowed net result added (a profit as ordinary
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
- If Income also lists the rent, the Federal estimate drops it and counts this page's result instead (round 8; taxes/federal README "What the plan already knows"); this page's tax line is the rental's own result. `rentalsFor(plan, { today, year })` gives the Federal estimate each rental's `analyse` for the tax year.
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

## One set of figures with the Federal estimate (round 8 review, 2026-11-06)
- **Where the figures come from.** The allowance, its modified AGI and the netting are the Federal estimate's own
  (`taxes/federal/known.js` `rentalStep`, read through `known(plan).rental`). The MAGI is worked after this year's
  withdrawals, stock pay and a business at its profit. It leaves out taxable Social Security, the IRA deduction, the
  deductible half of self-employment tax and the student loan interest (IRC 469(i)(3)(E); Form 8582 instructions (2025),
  line 6, read 2026-11-06 at irs.gov/instructions/i8582).
- **What the rentals add:** `tax.federal` and `tax.niit` are `known().total` less `knownWithout(plan, params, fed,
  "rental")`. That is the same steps with the rentals' result left out, and their rent still out of Income. The IRA and
  student loan limits and the 20% business deduction move with it.
- **Why.** The review found this page working MAGI on a business at its gross: 170,000 and an allowance of 0, where the
  Federal estimate said 9,945 and the law 5,000.
- **The marginal rate** shown is the one before the rentals, on the same figures (the keys' return when no step moved it).
- **Unchanged:** the golden rows (typed wages only) give the same figures, and `tests/golden-property` passes unchanged.
- **Only this rental's rent comes out of Income:** only as much as the rentals here collect (see the Federal README,
  "Round 8 review fixes"). A second place's rent that is only on Income stays counted, before its costs.

## Entered once (round 8 batch 6, landlord-2 and landlord-5, 2026-11-06)
- **One running-cost figure** (`running.js`, a leaf that loads no page): `runningOf(r, value)` is the rent less empty
  months and the running costs, before the loan and tax (`noi`, "Income after running costs"). `analyse` reads it, and so
  do Income (`rentAfterCostsOf`) and Will the money last? (`rentalLines`), so all three say the same. The landlord's condo:
  2,100 × 12 = 25,200; less 5% empty months (1,260) = 23,940; less property tax 4,700, insurance 1,200, dues 350 × 12 = 4,200
  and upkeep 1% of 260,000 = 2,600 (12,700 a year, about $1,058 a month) = **11,240 a year, $937 a month**.
- **The match of Income rent lines to rentals** (`matchRent`) moved here from `taxes/federal/known.js`
  `withoutIncomeRent`, which now reads it: by name, then by amount within 2%, then the rest in proportion. The tax figures
  are unchanged (invariance below).
- **Its value on Net worth** ("Its value on Net worth", `accountId`): a Real estate account no other property names. The
  value is read from there (`countedBalance`), as before.
- **"Add it to net worth"** (`addToNetWorth(draft, id, { today, uid })`): a rental only on this page gets a Real estate
  account at its typed value and, with a typed loan and no picked mortgage, a Mortgage account ("<name> mortgage") with a
  Debts row of the typed rate and payment; the rental then names both. The verifier's plan with the condo only here: net
  worth 508,000 → **618,000** (8,000 + 25,000 + 180,000 + 120,000 + 410,000 + 15,000 + 260,000 − 250,000 − 150,000), Debts
  has no "needs details", What you own lists the condo once, insured by its own policy, and the condo's loan is 58% of its
  value (150,000 ÷ 260,000) on Mortgage.
- **A Net worth account of the same name** (`twinAccount`): a rental that names no account, and an account no property names
  with its name (letter case aside), is asked about ("Is Condo on Net worth this rental?" → "Yes, it's this one" links it;
  "No, add it as its own" adds it). Nothing links them without the tap.
- **A picked mortgage with no Debts details** (`loanOf`): its balance from Net worth, and the rate and payment typed here
  (they were dropped: no interest, no payment); saving copies them onto a Debts row (`keepLoanDetails`). A row with a payment
  on Debts is never overwritten.
- Outputs added per rental: `accountId`, `twin`, `loanAccountId`, `loanInDebts`, `onNetWorth`.
- Tests (`module.test.mjs`, "batch 6"): the condo's 11,240; the dropped loan (0 → 10,212 of payments); `keepLoanDetails`;
  "Add it to net worth" (618,000, no "needs details", the condo once with "Condo landlord policy"); the twin; `matchRent`.
  Households: `qa/fixtures/round8-rental.mjs`.

## Review fixes (round 8 batch 6, 2026-11-06)
- Never the home you live in (UX 3): `livedIn(plan)` is Get started's home account (`setup-have-home`), any Real estate account
  named "Home" (or My/Our/The home) and any account a Your home entry names. "Its value on Net worth" leaves them out (unless
  already this rental's), and an account picked whose name and value are both more than 10% away from the rental's is asked
  about once before saving.
- Asked, not asserted (UX 2): `candidateAccounts(plan, r)`: for a rental that names no account, the Real estate accounts no
  other entry names that are not the home you live in, those within 10% of its value first (`likely`). With no account of its
  name (`twin`), the card asks "Is one of these on Net worth this rental?" with one button each and "None of these: add
  Condo", and says its value "may not be in your net worth yet".
- "No" says what it would do (UX 1): "No, a different place" first shows "Add Condo as a second home?": Net worth would then
  list two homes named Condo, $520,000 in all, and go from $618,000 to $878,000 (`wouldAdd` = its value, less the loan typed
  here when that is added too; `netWorth`), with "Add a second home" and "Cancel". The buttons read "Yes, the same place" and
  "No, a different place"; a link confirms "Linked: the Condo on Net worth is Condo, counted once." What you own flags two homes
  of one name and value.
- The confirmation of "Add it to net worth" names a rate and payment only when a payment was typed; else "Its loan is on Net
  worth: add its rate and payment on Debts" (money 12).
- Depreciation taken so far (UX 9, item 26's next step): `depreciationTaken(basis, placedInService, asOf)` = each whole tax
  year's depreciation (`depreciation`), then the year of `asOf` to its month by the mid-month rule ((month − 0.5) / 12 of a
  year; (month − first month) / 12 in the first year), never more than the building's cost (`buildingBasis`: price, or value,
  less the land's share, plus improvements). Condo: 168,000 / 27.5 = 6,109.09 a year: 2019 4.5 months 2,290.91, 2020 to 2025
  36,654.55, 2026 to mid-November 5,345.45: 44,290.91. Source: IRS Publication 527 (2025), Decreases to basis, "Depreciation you
  deducted or could have deducted on your tax returns" and "Depreciation reduces your basis for figuring gain or loss on a
  later sale" (read 2026-11-06); IRC 1(h)(1)(E), at most 25% on unrecaptured section 1250 gain. The Tax card says it ("about
  $44,291, since August 2019"); Capital gains reads it for a sale named for the rental.
- `rentAfterCosts` rows carry `parts` (each rental a line holds rent of, and whether it is the only line holding it), and
  `loanPaymentOf(plan, r)` gives a rental's loan payment a month, for Income's line.
- Tests: "batch 6 review" in `module.test.mjs`.

## Follow-up, 2026-11-07 (workflow wfu1; tests `tests/followups-*.test.mjs`)
- "Linked: Condo on Net worth is this rental, counted once." when the account and the rental share a name (`linkedWords` in running.js).

## Touch and input stress test (2026-11-11, claude-g)
- Rent is required at the box, and the value when no home is picked (DP-2's page part; the message placement is wave 1's).
