# Income  (`cashflow/income`)

**Status:** usable (phase 2)
**Purpose:** Records each income source per person with how often it is paid, how it grows, whether it is taxed and when it starts and ends.

## Inputs
Plan sections read (`needs`): `income`, `household` (names for `personId`).
`compute(plan, { today })`: `today` (ISO day) decides which items are active; without it everything counts.

## Outputs
`items[]` (each income plus `typeLabel`, `icon`, `periodLabel`, `personName`, `monthly`, `yearly`, `active`, `upcoming`, `ended`, `nextYear`, `oneTime`), `active[]`, `count`, `monthly`, `yearly`, `nextYear`, `taxableYearly`, `untaxedYearly`, `oneTime`, `byType`, `byPerson[]`, `warnings[]`.

## Formulas
- Yearly = amount x times per year (`core/math/periods.js`: weekly 52, every two weeks 26, twice a month 24, monthly 12, quarterly 4, yearly 1, one time 0). Monthly = yearly / 12, so "every two weeks" gives 26/12 of the amount per month, which is what a budget should assume.
- Active = start date not after today and end date not before today (`activeOn`).
- Next year = sum over active items of yearly x (1 + growth). Growth is a fraction (0.03); the form's percent field converts.
- One-time amounts (`period: "once"`) are summed into `oneTime` and never into monthly or yearly.
- Taxable: `taxable !== false` counts as taxed (older items without the flag are taxed).
- The page's first tile (2026-11-01) is labelled "A month, before tax" and, when an adult has a salary, says "About $X a month reaches the bank after tax" from `cashflow/paycheck` `takeHome().monthly`. Before, "$14,250 Per month" never said before tax, and the Income statement told people to "fix whichever is wrong" when the bank showed less, so some typed take-home pay over their salary.
- Did you mean a year? (2026-11-01): a salary not typed as yearly that comes to more than $480,000 a year (more than $40,000 a month) is asked about before it is saved: "That's $864,000 a year. Did you mean $72,000 a year?" with [Yes, $72,000 a year] and [Keep $72,000 every month]. "How often" starts on "Every month", so a yearly salary typed into it was saved twelve times too big and every page after it (tax, spare money, retirement) was wrong without a word. The $480,000 line is my choice: well above most salaries, so a real monthly figure is rarely asked about, and the question has a one-tap "keep" answer.
- Under every money box followed by a "How often" box, the form shows "That's $864,000 a year ($72,000 a month)." as you type (`core/ui/dom.js`), so the unit mistake is visible before saving.

A raise from a later date (round 4, 2026-11-02, `changeFrom`): editing an income that is going today with a new amount
or how-often and a "Starts" date still to come splits it, as Life events does for a new job's pay: the pay on file runs
until the day before (its own amount and name kept) and the new pay starts that day. Before, the whole income moved to
the later date: the plan showed no pay until then, the Dashboard turned red and the next move became "Spend less than
comes in". The confirmation says both and the change a month before tax: "From 1/1/2027 Ana's salary is $4,200 every
two weeks (+$650 a month before tax). Until then it stays $3,900 every two weeks."
Next year (2026-11-02): what is coming in a year from today. Income going today gets its yearly raise; income that
starts in between counts at its amount; income that has ended by then does not count.

## Edge cases
No people: items are "Household". Unknown `type`: treated as other. Amount 0 or missing: warning. End before start: warning. Growth above 25%: warning (usually a unit mistake). Unknown period: treated as monthly.

A salary typed as a yearly (or quarterly) figure, the setup's default, is paid in paychecks, not once a year
(`payRhythm` in core/math/periods.js: the Paycheck page's count for that person, else 26, every two weeks). Income lists it as "$55,000 a year, paid every two weeks" instead of "once a year" (2026-11-02).

## Tests
`module.test.mjs`: empty plan, bi-weekly normalisation, next-year raise, start/end/one-off handling, warnings, byType.

## countOn (round 4, 2026-11-02)
`income[].countOn` (a month, optional; set on Side income) is the careful figure for uneven pay. `monthly`/`yearly` keep the full amount, which every tax page uses. Each item gets `heldMonthly` (amount a month minus countOn, never below 0) and the result `heldMonthly` (active items). The Income list says "the plan counts on $X a month (Side income)".
`countedOn(x)` is the one rule every page reads it through (Income, Next best action's careful taxes, Forecast, Side income;
review 2026-11-02): a figure counts only on a "Self-employment / business" line that repeats, and only when it is below the
line's amount a month; otherwise null (the amount counts). Saving a line as another kind or as one time deletes `countOn`.

A raise saved from a later date (`changeFrom` split), review 2026-11-02, round 5 (replaces the first pass, which moved
the id to the new pay and copied what was filed under it):
- The pay that ends keeps its **id** (so the setup's own pay line, `setup-pay-<person>`, stays today's pay for Get
  started's pay question until the start date) and everything on it.
- The new pay gets a new id from the page and **`continues: <id>`**: the first line of the chain (`chainId(x)` =
  `x.continues ?? x.id`), so a second raise on the new pay still points at the first line.
- It carries the careful figure (`countOn`; dropped when the new pay is not repeating business pay, and `countedOn` ignores
  it at or above a lower new amount) and `typicalYear: true` when the line is a setup pay line or already has it, so the
  Forecast still spreads "a typical year" without the setup's id.
- Every page that keeps something by income reads and writes it by `chainId`: Side income's typed months and careful figure
  (`whatIfs.sideIncome[key]`; "Count on" and "Count the full ... again" change `countOn` on every line of the chain) and
  Salary's raises (`whatIfs.salary[key]`). Nothing is copied, so a figure turned off before the start date stays off after
  it, and months typed before it are still there (the first pass kept two copies, which went apart).
Tests: `module.test.mjs` ("one chain"), `career/side-income` and `career/salary` module tests (both sides of the start date),
`overview/setup` (the pay question before and after it).
Second review of round 5 (2026-11-02): Small business finds the business chosen by its chain (`career/business`), and Get
started reads and writes the chain's line in force today (`overview/setup` `lineNow`), also once the half that ended is
removed here; Life events' new job does not carry `continues` (it is a pay of its own, `household/life-events`).

## Ideas / not yet
- Pay-stub detail (pre-tax deductions, 401(k) match) for the tax and retirement pages.
- Irregular income smoothing (average of the last 12 months of transactions) once phase 3 lands.

## Business income and "reaches the bank" (review 2026-11-02)
The totals card's take-home sentence names business income apart: pay reaches the bank after its tax, business income
before its tax (paid in four estimated payments), so the figure is not read as after tax when it is not.

## Rent after the place's running costs (round 8 batch 6, landlord-5, 2026-11-06)
`rentAfterCostsOf(plan, { today })` -> Map(income id -> { monthly, afterCosts, rentals, beforeCosts, onPage }) for each rent
line going today. The line keeps the rent as typed (tax and the totals read it). Matched to the rentals on Rental analysis as
the Federal estimate matches them (property/rental `running.js` `matchRent`: name, then amount within 2%, then in proportion),
each rental's rent less empty months and running costs (`runningOf`) is shared over the lines that hold its rent. The page
says "$937 a month after Condo's running costs (Rental analysis)": (25,200 − 1,260 − 12,700) ÷ 12 = 936.67. Rent for a place
not on Rental analysis says "Before the place's running costs (tax, insurance, upkeep): add it on Rental analysis to count
them". The month's left-over figure (Next best action, Dashboard, Budget) does not read this yet: that work is in flight
elsewhere. Test: "batch 6" in `module.test.mjs`.

## Review fixes (round 8 batch 6, 2026-11-06)
- A line that is one rental's whole rent (the only line holding it) shows that rental's own figure, as Rental analysis and the
  retirement plan do (money 10: $2,000 here against $2,100 there read $892, the figure scaled by 24,000 / 25,200; now $937), and
  `rentalRent` (the rent there, a month) when the two differ: "Rental analysis has the rent at $2,100 a month: change one so
  they match".
- Its loan (UX 5, "$937 or $86?"): `loanMonthly` (property/rental running.js `loanPaymentOf`: the Mortgage account's payment and
  extra on Debts, or the payment typed on Rental analysis) and `afterLoan` = afterCosts − loanMonthly: "$937 a month after
  Condo's running costs (Rental analysis); $86 after its $851 loan payment too (the loan is on Debts)." A line shared by
  several rentals says no single loan, as before.
- Tests: "batch 6 review" in `module.test.mjs`.
