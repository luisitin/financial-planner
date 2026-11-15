# Dividends  (`investments/dividends`)

**Status:** usable (phase 7)
**Purpose:** The dividends and interest your holdings pay each year, by fund and by account, and what they cover of your spending.

## Inputs
Holdings (yields from the fund table or typed; `paysEvery`, how often a holding pays, typed on Holdings), the Expenses
page (monthly spending), tax buckets of the accounts, and the ledger's transactions (what came in).

## Outputs
`total` (a year), `monthly`, `yieldOverall`, `items[]`, `byAccount[]`, `taxable`, `sheltered`, `coversShare`, `qualifiedGuess` (stock funds in taxable accounts), `unknownCount`, `notes`.
With `{ calendar: true }` (only the page asks) one key more, `calendar`: `months` (the next twelve, this month first,
`{ ym, amount }`), `shape` ("none", "even", "quarters", "other"), `peak`, `low`, `every`, `quarter`, `other`, `zeroAt`,
`received` (null, or `{ total, months, lines, since, peak }`: the last twelve months by the ledger) and `yields`
(`{ onCost, onValue, income, cost, value, counted, all, case }`). Pure helpers: `paysPerYear`, `PAYS`, `PAY_MONTHS`,
`MONTHLY_KINDS`, `spreadMonths`, `shapeOf`, `receivedOf`, `dividendCategories`, `DIVIDEND_TAGS`, `yieldsOf`,
`calendarOf`, `ymAdd`.

## Formulas
Income = value x yield. Yields are typical figures by class for the funds in the table (1.2% broad US, 3% international, 4% bonds and cash, 3.8% REITs) unless the fund's own figure was typed.

### Month by month (gap list, next 60, item 8; 2026-11-15)
- **How often a holding pays**, n: its own `paysEvery` on Holdings ("month" 12, "quarter" 4, "half" 2, "year" 1),
  else by kind: bond funds and cash 12, every other kind 4. **This is the app's assumption, not a sourced figure**: no
  table of payout dates is bundled, and no fund company's page could be read from the session that built this (only
  irs.gov and the package registries answered). So it is an input with its default said in words on the page.
- **The months it pays in**: 12 = every month; 4 = March, June, September and December; 2 = June and December; 1 =
  December. Also the app's assumption, said on the page ("A fund's own months may differ").
- **Payment** of holding h in month m = income_h / n_h when m is one of its months, else 0. Month m's total is the sum
  over the holdings. The twelve months always add up to the year's total (n_h payments of income_h / n_h each).
  Sam and Lee (`qa/fixtures/investments-plan.mjs`, 2026-11-15): BND $2,044 + SPAXX $516 monthly = $213.33 a month;
  VTIAX $4,320 + FXAIX $3,816 + VNQ $2,527 + VTI $1,044 quarterly = $2,926.75 a quarter; so $3,140.08 in December,
  March, June and September and $213.33 in the other eight: 4 x 3,140.08 + 8 x 213.33 = $14,267.
- **What came in** in month m = the sum of the ledger's lines in m (ledger `allLines`: a split purchase as its parts,
  no line marked to leave out of the totals or paid back) that are money in (amount above 0), not a transfer, and filed
  as "Dividends and interest" (`income-investment`), or under an income category of the person's own whose name holds
  "dividend", or tagged `dividend` or `dividends`. The window is this month and the eleven before it; `since` is the
  month of the ledger's first line when that is later than the window's start (the sentence then says "since August
  2026" instead of "in the last 12 months"). The category also holds bank interest, so the words say "dividends and
  interest", as the page's title does.
- **Yield on what you paid** = the yearly dividends of the holdings with what you paid on file (cost basis above 0) /
  what was paid for them. **Yield on today's value** = the same dividends / what those holdings are worth today. Both
  are worked out over the same holdings so the two can be read side by side; with every cost on file the second is the
  page's own "yield on" figure (total / portfolio). With no cost anywhere: on what you paid is "not known yet" and on
  today's value is the page's figure. Sam and Lee: 14,267 / 738,900 = 1.93% beside 14,267 / 969,500 = 1.47%.
  The case sentence: "same" when the two differ by less than 0.05 percentage points; "grown" when on-what-you-paid is
  the higher (they cost less than they are worth now); "fallen" otherwise; "noCost".
- Both yields use the dividends the plan expects (value x yield), not the ledger's: the ledger's "Dividends and
  interest" lines include bank interest and are not tied to a holding, so dividing them by the holdings' cost would mix
  two things. No current figure (a rate, a limit, a price) enters these formulas.

## The page
- First view: the hero, the notes, the four tiles; then one quiet row "Month by month" (kind `more`, a reading part:
  kept open or shut on this phone, opened by "Show how answers are worked out"); then By holding and By account.
- Holdings worth $0 (no price and no what-you-paid on any of them): no zeros; the hero says the one next step,
  `priceFirst` ("Add the price of VTI (or what you paid for it) on Holdings, and this page works out what it pays each
  year."; two named; three or more "your 3 holdings") with "Open Holdings" as the filled button, and the row only when
  something came in (critic P4, 2026-11-15).
  Status: "most in December", "the same each month", or "$710 came in" (no holdings, but dividends in the ledger).
  No row when nothing is expected and nothing came in, so the first view of a plan without holdings is unchanged.
- Inside: "This month and the next 11" (its sentence, the twelve months, the assumption in words; the heading says
  this month is counted, as a payment this month may have come in already); "What came in" (only with dividend lines;
  its sentence and its twelve months, December 2025 to November 2026 on 2026-11-15, or only the months since the
  ledger's first line when that is later, so no month before the records start reads "nothing"); "Yield" (what a
  yield is, in one line: "The yield is what the holdings pay in a year, as a share of the money in them."; two rows;
  the case sentence; "Counted: the 7 of 8 holdings with what you paid on file." when some have no cost).
- One sentence per case (R5, each in `module.test.mjs`): months `monthsFor` (even, quarters, quartersOnly, other,
  otherGaps); what came in `receivedFor` (year, since); yields `yieldsFor(y, pct)` (grown, fallen, same: whole
  sentences with both figures, "You get 1.93% a year on what you paid, but only 1.47% on what the holdings are worth
  today, because they have grown since you bought them."; noCost); worth $0 `priceFirst` (one, two, more).
- The months are a small calendar, three to a row (so March, June, September and December share a column): each cell
  writes its month, its amount ("nothing" for none) and a bar for its size beside the biggest month, so every figure
  is read without a hover or a tap (critics P2, 2026-11-15; design log 2026-09-16, no unlabeled bars). The first cell
  and each January carry the year ("Nov 2026", "Jan 2027"; `cellName`), so the two calendars, which cover different
  months, are told apart. No chart library: a list styled as a grid, colours from the page's CSS variables (dark mode
  follows), inline styles on the page's own elements (no new global CSS). The list's `aria-label` names it.
- The title is pinned in `qa/first-view-lib.mjs` PINNED_TITLES (the brief's own words, a calendar a person looks for
  by name). The page saves nothing (S11 in `module.test.mjs`).

## The tax note in the app's money format (fix round r2, claude-b, 2026-11-15)
An earlier critic found the note printing amounts with no currency sign. Reproduced on Sam and Lee
(`qa/fixtures/investments-plan.mjs`): "3,604 of it lands in taxable accounts ... (about 1,044 looks qualified)"; and on the
held plan, with nothing qualified, "(about 0 looks qualified)". Without the sign the figures read as counts, and Hide
amounts (`core/format.js maskAmounts`, which needs the sign) left them showing.
- `taxNote(taxable, qualified, currency)` in compute.js writes the note with `core/format.js money` in the plan's currency
  (as `cashflow/expenses` does), one sentence per case, in plain words (a person critic of the fix found "the qualified part"
  still jargon on the first view, so the note says the kind and names the Federal estimate page's two boxes as that page
  labels them, in quotes): "$3,604 of it lands in taxable accounts and is taxed every year, even when reinvested. About
  $1,044 looks like the kind taxed at a lower rate: on the Federal estimate page, type that under “Qualified dividends” and
  the rest under “Other income taxed at regular rates”." and, under 50 cents taxed lower, "$346 of it lands ... None of it
  looks like the kind taxed at a lower rate: on the Federal estimate page, type it under “Other income taxed at regular
  rates”." A test reads the two labels from `taxes/federal/view.js`, so a renamed box is caught.
- Under 50 cents in taxable accounts there is no note: the money format rounds it to "$0" (a money critic's M4; before, the
  same rounding printed "0").
- Every other sentence on the page already used `fmt.money`; a module test opens every part and finds no figure with a
  thousands comma that lacks its sign.
- Invariance: every key of the output but `notes` is unchanged; the note says the same two figures, rounded as before
  (module test "r2 invariance", and a scratch run against ab3bdde over every household in the builder's log).

## Invariance
`compute(plan, { today })` without `calendar` gives byte for byte what it gave at 154a597 (the module test checks the
keys and that `calendar: true` adds only `calendar`; a scratch run compared every household and fixture plan with a
154a597 checkout, see the builder's log). `paysEvery` moves only the months, never the year.

## Edge cases
Holdings without a yield are listed as unknown and left out. Reinvested income counts (and is taxed in taxable accounts).
A holding's `paysEvery` that is not one of the four words reads as not said. A month with nothing says "nothing" and has an empty bar.

## Tests
`tests/investments.test.mjs`, `module.test.mjs` (the spread, `paysPerYear`, the shapes, what came in, both yields,
every sentence, the invariance, the row drawn shut, every month's amount and the year in its cells, the worth-$0 page,
S11).

## Ideas / not yet
- The actual figures from a 1099-DIV (the reader reads one for the tax pages; not tied to holdings).
- A fund's own payout months, once a sourced table of them can be bundled.
