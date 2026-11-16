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

## A line that is our guess (fix round 1 on the Social Security lane, 2026-11-11, claude-c; ssg-L-6)

Each item carries `guessed: true` when its amount is our guess in the ledger (core/estimate `isGuess` on
`income[<id>].amount`; Get started writes "Your Social Security" so when the amount was left blank). The list says "Our
guess for now: tap to type what arrives" under it. No figure changes.

## One figure or item by item (gap list, next 60, item 11; 2026-11-16) -- `one-figure.js`

A person can keep a kind of income as **one figure** (typed and changed in one place) or list it **item by item**, as
before (research Ux8). Net worth has the same choice for accounts (its README says how the two agree).

- **What a "kind" is (a section).** One kind of income of one person: Bo's business income; Dividends and interest (the
  household's); Kim's support or gifts; Bo's bonus; Other income. Key: `type|personId` (`sectionKey`). Inside a kind, a
  line goes together with the one kept only when it is paid alike: the same schedule, raise, start and end dates, tax
  mark, payday and "typical year" mark (`alikeWhy`). So the sum is the same at every page that reads lines: Income's own
  figures, Next year, the Forecast and the paydays, the tax pages, and the retirement plan (pay by person and dates, other
  income by person and its end).
- **Never one figure (builder's choices, where the brief was wrong about the code):**
  - **Pay from a job.** Two salary lines of one person are two employers: Paycheck takes Social Security and the 0.9%
    extra Medicare from each employer's pay on its own (each up to the wage base), so one line for two jobs changes
    take-home pay above the wage base. Seen on the invented high-earning household (12-high-net-worth): its take-home moved
    from $47,247 to $46,884 a month when one salary was split in two lines. The brief's "pay" kind is the bonus and
    business income here.
  - **Rent, a pension, Social Security** (Rental analysis matches rent to its place by name and amount; Pensions match by
    amount; Social Security is read by person) and **one-time amounts**.
  - **A support or other line whose name the retirement plan reads** (`nameRead`, the plan's own rules in
    retirement/projection `otherIncome`): child support (it stops when the child it names, or the youngest, turns 18:
    "support" with "child", "children", "kids" or a dependent's first name), money named as coming out of your own
    accounts (`ownAccountMoney`: "IRA withdrawals" is never added on top of the accounts), and a pension or Social
    Security named in words (How much to take out lists those by name). Seen on the invented blended family: its "Child
    support for Zoe" line, renamed, was counted in a retirement year instead of stopping when Zoe turns 18.
- **First view: nothing new** unless a kind can change (two or more lines that can go together, or one figure now). Then
  one quiet row at the foot of the Income sources card, above "+ Add another income": the part "One figure or item by
  item" (kind `own`, title pinned in `qa/first-view-lib.mjs`), shut, status "1 can be one figure" / "1 as one figure". None
  of the invented households has such a kind, so no first view moved.
- **One tap away**: "Keep a kind of income as one figure, typed and changed in one place, or list each source on its own.
  Either way what comes in counts the same, and so does every plan that reads it." Then per kind: its name, "3 sources,
  $190 a month in all", or, when some lines stay on their own, what one figure would bring in: "2 of 3 sources can be one
  figure, $150 a month" (review 2026-11-16 P1); one figure: "One figure: $150 a month", "...with 1 more on its own". Then
  the two chips (`choice()`) **One figure** / **Item by item**, and one muted sentence for each line that stays on its own.
- **One figure** asks first, in place, with two outlined buttons: "Replace Index fund dividends and Savings interest with
  one line, Dividends and interest: $150 a month? Bond interest stays on its own. What comes in stays $14,440 a month."
  While it asks, the One figure chip is the one lit (review 2026-11-16 P2); Keep them as they are, or a tap on Item by
  item, takes the question away. Replace is one `store.update` (`ui.undoable`); the part stays open with "Dividends and
  interest is one figure now: $150 a month, in place of 2 sources. Bond interest stays on its own. What comes in is still
  $14,440 a month." and Undo ("Put back: Index fund dividends and Savings interest. ..."). One line alone is only marked.
  Back after a look at another page shows the green line again while the plan is unchanged: the shell keeps every Undo
  line with its page (docs/CONVENTIONS.md "Back, Forward"), so the way back is not lost.
- **Item by item** keeps the one line as the first of the list: "Dividends and interest is item by item now. List each
  one: tap its line to rename it, then + Add another income." (short for a phone: review 2026-11-16 P4)
- **In the list** the line says "One figure for your dividends and interest". **Adding** another line of that kind and
  person here takes the mark off ("Bank bonus added. Dividends and interest is item by item again: each source is on the
  list."). A raise from a later date (`changeFrom`) does not copy the mark to the new pay.

**Which line holds the figure, and which stay on their own** (`sectionsOf`): the line marked, else Get started's own
(`setup-other`, so its question shows the total), else the biggest a month. A line stays on its own, one sentence each
(`<name> stays on its own: <why>.`), when another page keeps something under its id (`pointedAt`: a scan of the plan,
values anywhere and keys under `whatIfs`): Salary keeps its raises under it / Side income keeps its months under it /
Small business works from it / another page keeps something about it; or Side income plans with a careful figure for it
(`countOn`); it is part of a raise from a later date (`continues`, either side); its amount is our guess for now: type the
real one first; it is an answer in Get started (a second Get started line); the three name cases above; or, against the
line kept, it is paid on another schedule / it has a raise of its own / it has dates of its own / income tax applies to it
differently / it has its own payday / it is a typical year of uneven pay; or the app cannot tell it apart from another
income on your list (its id is missing or shared: review 2026-11-16 F3, two lines with the id "x" put together removed
both). Lines are removed by which line they are, never by id.

**Formula** (arithmetic on the person's own figures; no outside figure, so nothing here has a source to date): for the
lines L put together into the kept line k, all on the same schedule p, amount(k) = Σ amount(l), l ∈ L, to the cent, at
p. So yearly(k) = Σ yearly(l) and monthly(k) = Σ monthly(l) (yearly = amount × times a year, monthly = yearly / 12,
core/math/periods.js). Example: dividends $300 and interest $150.50, each every three months: one line of $450.50 every
three months, $150.17 a month. The name is the kind's ("Dividends and interest", "Bo's business income"); nothing else of
k changes; the others are removed.

**The put-together name is never one the retirement plan reads** (`sectionName`, review 2026-11-16 F1). The kind's name
with the person's ("Sofia's support or gifts") can itself be a name the plan reads: "support" with a dependent's first
name is child support there, which stops the year Sofia turns 18, so two support lines of a dependent (Board $300 and Gift
$200 a month) put together were dropped from the retirement plan's count. The name is the first of these that `nameRead`
says nothing about: "<Person>'s support or gifts", "<Person>'s gifts and help" (support only), "Support or gifts", "Gifts
and help" ("Other income" for other). So the two lines become "Sofia's gifts and help", $500 a month, read as before.
Tested: `module.test.mjs` ("F1", the two-parent household's `otherIncome` before and after) and
`tests/one-figure-totals.test.mjs`, which now also compares the income the retirement plan leaves out after work, by kind,
person and why (the blended household's "Eli's board", split and put back together, was dropped from it).

**Data**: `income[].oneFigure` (optional, `true`; docs/DATA_MODEL.md). No total reads it.

**Tests**: `module.test.mjs` ("one figure: ..."): the kinds and names, the line kept, every hold sentence, the sum, Item
by item, the mark taken off on an add, every message, Income's figures, take-home pay, each paycheck, the Federal
estimate and the retirement plan the same after One figure and after Item by item again, and the page (S11: only this part
changes, it stays open, Undo puts every line back). `tests/one-figure-totals.test.mjs`: every invented household with each
free line split in two and put back together, to the cent. `tests/one-figure-invariance.test.mjs`: with no mark, every
figure and this page's words are those of a491122.
