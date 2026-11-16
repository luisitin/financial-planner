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

## Left2 fix round 2 (2026-11-12, claude-c)
`running.js rentEndedFor(plan, r, today)`: the Income rent lines that are this rental's by name and have ended (same name, or
the name and "rent" / "rental income"; never a part of the other; names under three letters never match). Moved here from
Will the money last? (projection `rentalLines`, unchanged in effect) so the month (budget-percent `yearTaxes`) reads the
same rule: a rental ended that way counts no rent, costs or loan in the month. Nothing on this page changes.

## Simple first (opt spec 6.1, property/rental, class B; done here with gap item 20, 2026-11-16, claude-b)
- The page adopts `core/ui/more.js` (the gap spec 3.1: a design on a page whose opt commit has not landed does the
  conversion in the same commit; the opt commit then skips this page). No `<details>` is written by hand any more.
- **Add a rental** asks for five boxes first: Name, What it is worth today, Rent a month, Property tax a year, Insurance a
  year; with a Real estate account to pick, "Its value on Net worth" takes the fifth place and Insurance folds. Every
  required box is among them. The other 15 wait under the form kit's "More details (optional)".
- **The defaults are no longer typed into the boxes.** The form used to open with 5%, 1%, 20% and 3.5% in four boxes, which
  made "More details (optional)" open by itself (the kit opens it for a box that holds something). The boxes now open empty
  and say what an empty box counts ("Left empty, we count 5% of the rent.", "1% of the value a year", "20%", "3.5% a
  year"); an empty box saves null, which every reader counts as the same default (`running.js` `n(v, DEFAULTS.x)`,
  `buildingBasis`, `analyse`). A test adds a rental both ways to every invented household and compares compute().
- Each rental's details open under an outlined **"Change <name>"** in its first card (the vehicles page's pattern: the
  kit's `openUnder`, Cancel puts the focus back on the button); another rental under the outlined **"+ Add another
  rental"**; an empty page keeps "Add a rental" open in its card (R20).
- "More on this" is `links()`: "What is everything you own worth?" (Net worth) and "What do your rentals add to this year's
  tax?" (Federal estimate).
- First view (`node qa/first-view-node.mjs property/rental`; no invented plan household has a rental, so every one draws the
  empty page): with a plan 223 words, 21 boxes, 1 section before; 104 words, 5 boxes, 0 sections after. Empty plan 165 words
  and 20 boxes before; 74 and 5 after. The page is inside the list budget now, so its entry left
  `tests/first-view.known.json`.

## The year's rent and costs: books from your bank lines, laid out like Schedule E (gap list, next 60, item 20; map V1; 2026-11-16, claude-b)
**On screen.** One quiet row after the rentals, "The year's rent and costs", shut, its status the year and how many bank
lines ("2026 · 41 lines"), or "none tied yet". Opened: the case's sentence; chips for the years with lines (only when there
is more than one year to show; a pick is for this visit, never saved); for each rental its lines of the form in the form's
order (only lines with an amount), "Costs in all (line 20)" and "Profit or loss (line 21)"; the depreciation sentence, the
mortgage interest sentence, loan payments "not on the form", the passive-loss line (a loss only), rent tied to no single
rental; "For your tax preparer ... It is not a filing."; outlined "Save as a spreadsheet (CSV)" and "Print this list";
"See Condo's lines on Transactions ›" (`#/transactions/ledger?q=%23condo`); how lines are sorted. Nothing in it writes
the plan; opening or shutting it changes nothing.

**Tying a bank line to a rental: a tag, no new field** (`books.js` `tieOf`). Ledger lines already carry tags (gap #24: the
Tags box under the line's "More details (optional)", `#tag` in the search, a rule can add one). A line is a rental's when it
carries the rental's name as a tag ("condo" for Condo), compared on letters, marks and digits only, in any script (`tagKey`:
"Duplex on Elm", "duplex-on-elm" and "duplexonelm" are one; "アパート" keeps its letters). The tag is the whole name (`rentalTag`):
a "#" or a comma, which Transactions reads as the start of another tag, becomes a space ("Unit #1" is "unit 1", "A,B" is
"a b"); a name with no letter or digit at all ("🏠", none) is "rental". No two rentals share a tag (`rentalTags`): a name that
gives one an earlier rental has gets the first free "<tag> 2", "<tag> 3" that no other rental's name gives ("Condo" and
"condo": "condo" and "condo 2"), and the part shows each tag in quotes. With exactly one rental, the tags "rental" /
"rentals" and the category "Rent you collect" (`income-rental`) tie a line to it too; with two or more they cannot say
which, so such lines, money in or out, are counted as "not tied to one rental" and said (so is rent under Rent you collect
tagged only "unit" when the rentals are "Unit #1" and "Unit #2"). A line of $0.00 (or no number) is not a line: it ties nothing and counts nowhere (review
2026-11-16, F1, F3, F4, F7). Builder's choice (the brief: "find
what exists, and add the smallest optional way ... if none"): a tag exists, so nothing was added to the plan.

**Which line of the form** (`lineFor`): money in under an income category or none is rent (line 3), and so is money in
under a loan category (rent filed under "Rent or mortgage"); a move between your own accounts and a line left out of the
totals (gap #32) are not counted; every other line goes by the words in its category's name (`WORDS`, first match: interest
with car, auto, vehicle, card or student → 13; interest with mortgage, loan or HELOC ("Mortgage interest", "Loan interest",
"Interest on mortgage", "Home loan interest") → 12, so it is never read as a loan payment (review F2); mortgage, loan → a
loan payment; advertis, listing, marketing → 5; clean, maint, lawn, landscap, garden,
pest, snow → 7; commission → 8; insur → 9; legal, lawyer, attorney, accountant, bookkeep, tax prep, professional → 10;
manag → 11; interest → 13; repair, plumb, electrician, handyman, roof → 14; suppl → 15; tax → 16; utilit, water, sewer,
trash, garbage, electric, internet → 17; travel, mileage, auto, car → 6), then by the built-in id (`BUILT_IN`: Rent or
mortgage and Loan and card payments → a loan payment; Phone and internet → 17; Shopping and clothes → 15; Car, gas,
transit and Travel → 6), else Other (19), with the category names listed beside it. Money back under a cost's category (a
refund) takes off that line. A split purchase counts by its parts (`allLines`), and once in the line count.

**Formulas.**
- Line 3 = the tied money in that is rent, less tied money out under an income category. Each cost line = −(the tied
  amounts filed to it). Line 20 = lines 5 to 19; line 21 = line 3 − line 20.
- Line 18, depreciation: the page's own `depreciation(basis, purchaseDate, year)`, basis = what you paid × (1 − land share,
  20% when empty, kept between 0 and 100%) + improvements; straight line over 27.5 years; the first year (12 − month + 0.5) / 12 of a year (IRS
  Publication 527 (2025), "Residential rental property. You must use the straight line method and a mid-month convention
  for residential rental property" and "Mid-month convention ... you treat all property placed in service ... during any
  month as placed in service ... at the midpoint of that month", https://www.irs.gov/pub/irs-pdf/p527.pdf, read
  2026-11-16). Hand check from Pub 527's own example (Table 2-2d): a $160,000 building placed in service in February,
  160,000 / 27.5 × 10.5 / 12 = $5,090.91, Pub 527 says $5,091. The condo: 168,000 / 27.5 = $6,109.09 a year; 2019 from
  mid-August 4.5 months, $2,290.91; 2047 the $763.64 left; nothing from 2048. **Counted only when "What you paid" and "When
  it was first rented out" are typed**: a preparer needs the cost, not today's value (the Tax card above uses the value when
  no price is typed; builder's choice, said on screen as "not counted: it needs what you paid").
- Line 12, mortgage interest: tied lines filed under a category named "Mortgage interest" when there are any; otherwise, for
  the year still running only, **about** a year of the page's own loan (`rentalsFor(...).interest`: twelve months of payments
  on today's balance, rate and payment, `core/math/finance.js yearOfPayments`; the condo: $6,677.70), said with "the
  lender's Form 1098 (box 1) has the exact figure"; for a year that is over it is not counted ("copy it from box 1 of the
  lender's Form 1098"), since today's balance would understate that year. Instructions for Schedule E (2025), lines 12 and
  13: "enter on line 12 the amount of interest you paid for 2025 to banks or other financial institutions" and Form 1098
  (https://www.irs.gov/pub/irs-pdf/i1040se.pdf, read 2026-11-16). Loan payments (principal and interest) are listed apart,
  "not on the form".
- The year shown: the year asked, else this year, else last year when nothing is tied to this year and something is to last
  year (a preparer asks for last year in the spring). A year picked is for the visit: a new arrival on the page (Back
  included) or another plan in the tab starts from the year shown by itself, and so does a picked year whose lines are gone
  (module state keyed on the route object and `meta.createdAt`, as Rebalance's "Try a trade"; review F6).
- The months covered (review P1, F5): each rental's `months` are the months of the year with a bank line tied to it; a year
  that is over is `whole` when every month it was rented has one (from its month first rented when that was in the year:
  August to December is the whole of 2025 for a rental first rented in August 2025). The bank lines are what they are, but
  depreciation and the interest worked from the loan are always the whole year's: so the verdict says which months the
  lines cover and that the costs hold all of the year's depreciation and loan interest, and a year that is over with months
  missing is not called a profit or a loss ("Only 2 months of 2025 have bank lines for Condo (November and December), so
  these are not the whole year's books: $4,200 of rent less $6,109 of costs, among them all of 2025's depreciation."). The
  file's line 3 note says the same ("the year so far: bank lines 01/2026 to 10/2026"; "not the whole year: bank lines in 2
  of its months only, 11/2025 to 12/2025"). Builder's choice: nothing is prorated; the form's figure for the year is the
  year's depreciation, and a guess of the missing months' rent would be a figure no bank line holds.
- The passive activity rules are named, not worked out: "A rental loss may not all count this year: the passive activity
  rules (Form 8582) can hold part of it back. The Tax card above works out this year's share; these books do not." (Pub 527:
  "Generally, rental real estate activities are considered passive activities and losses aren't deductible unless you have
  income from other passive activities to offset them"; the Tax card's netting and allowance are above.)
- No current figure (a rate, a limit, a price) is used. The standard mileage rate in the instructions (70 cents a mile for
  2025, line 6) is not used: only actual lines count.
- Line names and numbers: Schedule E (Form 1040) 2025, Part I, lines 3 and 5 to 21, in the form's own words in the file and
  the printout (`LINES`, `TOTALS`), in plain words on the phone ("Rent received", "Car and travel", "Cleaning and upkeep",
  "Legal and tax help", "Property manager") (https://www.irs.gov/pub/irs-pdf/f1040se.pdf, read 2026-11-16). Lines 1 and 2
  (the address, the kind of property, the days rented and used) are not in the plan and the printout says so.
- Repairs and improvements, escrow: "A repair keeps the place as it was; an improvement (a new roof, a remodel) is not
  counted in one year but depreciated" (Instructions, line 14: "Amounts paid to improve your property must generally be
  capitalized and depreciated"; Pub 527, Repairs and Improvements); tax and insurance paid from the loan (escrow) are on the
  lender's year-end statement and belong on lines 9 and 16.

**The file and the printout.** `booksCsv(b)`: "Line", "Schedule E for 2026", a column per rental with lines tied that year,
"Notes"; lines 3, 5 to 19 in the form's words, blank where the form would be empty, 20 and 21 always, two decimals, no $,
a loss with a minus; the notes say how line 12 and line 18 were found and what is under Other. Names go through Tax lots'
`csvText` (a name a spreadsheet would run as a formula gets an apostrophe) and `core/csv.js` `toCsv`, the same helpers Tax
lots' "Sales for your tax return" uses; the download and the printout (`modules/reports/report-kit.js` `reportFrame`,
`rtable`, `printSheet`) are drawn the way that page draws them. File: `rental-books-2026.csv`, made on the phone, sent
nowhere.

**Sentences** (`books.js`, one per case, each with a test): `booksSentence` (no bank lines; none tied: one rental and
several; each says the two steps in the words Transactions shows: add the lines, then type the rental's word in each one's
Tags box), `rentalSentence` (profit, loss, even, for a whole year that is over and "so far" with the months covered and
what is the whole year's; a year that is over with months missing; nothing tied to this one), `untiedSentence` (rent,
costs, both), `depSentence` (a full year, the first year, no price, no date, not yet, written off), `mortgageSentence` (from lines, about
from the loan, no loan on the page, Form 1098, nothing), `loanSentence`, `PASSIVE_LINE`, `booksStatus`.

**Invariance.** `compute.js` and `running.js` are not changed; `books()` only reads (a test checks the plan's bytes). Over
the 14 invented households, the four fixture plans, the empty plan and the round 8 rental plans, compute() and rentalsFor()
are byte-identical before and after books() runs and with every ledger line tagged with each rental's name; a rental saved
with the four boxes left empty counts what one saved with the defaults typed. Against 67dfd25 (a scratch comparison, not in
the repo): the rental page's, the Federal estimate's, Income's, Net worth's and What you own's compute() over 23 plans,
tied and not, 230 outputs, all byte-identical.

**Example (the invented couple Sam and Lee, their Condo, round 8's `landlordPlan` with 2026 bank lines; tests
`module.test.mjs` "books: ...").** January to October: ten rents of $2,100 under Rent you collect (untagged: one rental) and
a $50 late fee tagged condo: line 3 $21,050. Ten loan payments of $851 under Rent or mortgage: $8,510 "not on the form".
Ten HOA dues of $350 under their own category "HOA dues": Other, $3,500. Insurance $1,200 (9); two county bills of $2,350
(16, $4,700); a plumber $480 less $80 back under "Rental repairs" (14, $400); a cleaner $150 (7); $64.50 of hardware and the
$120 part of a split store receipt under Shopping and clothes (15, $184.50); a $300 tax preparer under "Tax prep" (10); $90
of power and the $80 part of the receipt under Utilities (17, $170). Line 12 about $6,678 (the loan), line 18 $6,109.
Costs in all $23,391; **a loss of $2,341 so far** ("Condo's books for 2026 so far (bank lines for January to October) show a
loss of $2,341: $21,050 of rent less $23,391 of costs, among them all of 2026's depreciation and loan interest."). 2025
holds only the November and December rents: "Only 2 months of 2025 have bank lines for Condo (November and December), so
these are not the whole year's books: $4,200 of rent less $6,109 of costs, among them all of 2025's depreciation." 41 bank
lines; a transfer, a line left out and two of their own home's lines are not counted.
