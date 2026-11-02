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

## Ideas / not yet
- Pay-stub detail (pre-tax deductions, 401(k) match) for the tax and retirement pages.
- Irregular income smoothing (average of the last 12 months of transactions) once phase 3 lands.
