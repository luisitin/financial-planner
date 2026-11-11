# Side income  (`career/side-income`)

**Status:** usable, phase 10
**Purpose:** Models irregular income from gigs, freelance work and a small business so your plan can count on it sensibly.

## Inputs
- Each active "Self-employment / business" item on the Income page (`income[]` with `type: "business"`, not one-off):
  its name, holder and monthly amount.
- `whatIfs.sideIncome = { [incomeId]: { months: { "YYYY-MM": amount } } }`: what came in each of the last twelve whole
  months, typed on this page (blank = not known, 0 = nothing came).
- The Self-employment page's tax on the household's business income (`taxes/self-employment`: `businessTax`, `net`),
  and the State tax page's rate (`taxes/state`), worked on a copy of the plan with every side income that has enough
  typed months at its months' average (the share to set aside); and whether the whole return needs quarterly payments,
  what is behind and the next one (`taxes/estimated`: `needsEstimates`, `overdue`, `nextDue`, `harbour`), worked on the
  plan itself, as the Quarterly payments page works it (round 8, freelancer-2).
- Writes `whatIfs.sideIncome`; "Count on ..." saves `income[].countOn` (the careful figure); the Income page's amount stays.

## Outputs
`compute(plan, { today })` -> `{ ready, year, months, items: [{ id, name, personName, monthly, period, typedMonths, stats, enough, countOn, gap, below }], setAside: { rate, yearly, quarter, federal, state, stateKnown, stateAverage, onAverage } | null, estimates: { needed, nextDue, overdue, harbour }, rules, notes }`;
`stats` = `{ n, average, median, low, high, reliable, reached, spread, cushion, deepest, zeros }`.

## Formulas
- **The months** (`lastMonths`): the twelve whole months before today, oldest first.
- **The month to count on** (`monthStats` `reliable`): the largest amount reached in at least 3 months out of 4 of
  those typed (`RELIABLE` 75%): sorted rising, the value at index n − ceil(0.75 n) (with 12 months, the 4th lowest).
  Shown from 3 typed months (`MIN_MONTHS`). The rule follows the Consumer Financial Protection Bureau's advice for
  pay that changes (*Your Money, Your Goals*, 2016: "use the amount you receive in a week when you don't work extra
  hours"; the 2020 toolkit: "estimate your income on a typical month (it's better to estimate lower)"); the 3-in-4
  cut is this page's choice, said on screen.
- Average, median, lowest, highest; spread = standard deviation ÷ average.
- **The cushion**: paying yourself the average every month, the running total of (average − the month) at its
  deepest is the money that would have had to be put by; the month it was deepest is shown.
- **Gap** = the Income page's monthly figure − the month to count on; above 0 (and the month to count on above 0) the
  page offers to count on the lower one. When more than 1 month in 4 brought nothing, there is no amount to count on.
- **The tax**, worked on what comes in on average (the months typed), so that counting on the careful figure does not
  shrink it: this income adds = the Self-employment page's `businessTax` (self-employment tax on 92.35% of profit,
  federal income tax with half of it and the 20% business deduction off, the 0.9% extra Medicare tax) + the state's
  rate × the profit. **Of every payment** = that ÷ what comes in before expenses (so expenses lower it, and the $400
  line cannot make a $100 step look like the rate). A quarter = ÷ 4. The state part is an average when it comes from
  last year's return (a note says so).
- **Quarterly payments**: whether the whole return needs them, what is behind and the next one come from the Estimated
  payments page on the real plan (`computeEstimated(plan)`; Form 1040-ES 2026: $1,000 or more owed after withholding, the
  safe harbor of 90% of this year's tax or 100% / 110% of last year's, IRC 6654(d)(1)(B)); this page does not decide it
  from the side income alone, and its average-based copy is used only for the share to set aside. The set-aside per
  quarter is split "to the IRS" and "to the state" (federal / 4 and state / 4), and the rule is said once: "the safe
  amount is 90% of this year's tax, paid in four parts, and the rest is due in April". Before, the past-due sentence and
  the next payment came from the copy of the plan at the typed months' average (Jo: 4,833 a quarter with an inflated state
  part, against the Quarterly payments page's 3,577); now both pages say 6,731 behind and 3,577 by January 15, 2027, with
  or without the twelve typed months.
- **Forms** (`data/rules.js`, 2026): clients send a 1099-NEC from $2,000 a year (IRC 6041 as amended by P.L. 119-21
  §70433; $600 before 2026; indexed from 2027); payment apps and marketplaces send a 1099-K over $20,000 and more than
  200 payments (IRC 6050W(e) as restored by §70432, third-party settlement organizations only; IRS FS-2025-08 with
  IR-2025-107); card processors report card sales of any amount. Income tax applies to all of the profit;
  self-employment tax starts once 92.35% of the year's profit (IRC 1402(a)(12); Schedule SE line 4a) reaches $400
  (IRC 1402(b), 6017), about $433 of profit. A year past the table shows the latest rules,
  labelled as such.
- **Mileage**: 72.5 cents a business mile from 1 January 2026 (IRS Notice 2026-10), 76 cents from 1 July 2026
  (Announcement 2026-11); 70 cents in 2025 (Notice 2025-5).

## Edge cases
- No side income on Income: an empty state pointing there. Fewer than three typed months: no figures from them.
- Blank months are left out, not counted as 0. A month typed 0 counts (and is reported).
- Without a state rate the share to set aside leaves state tax out, with a note.

## Tests
`module.test.mjs`: the twelve months across a year end, the figures (the 3-in-4 rule, few months, blanks), the
cushion, the family's photography against its Income figure, the tax worked on the average (the state, expenses,
"Count on" not lowering it, the whole return's quarterly payments), no jump at the $400 line, an unknown state rate,
last year's average state rate, no taxable business, too few months, the year's rules (a later year labelled as the
latest known) and mileage dates, not ready.

## Count on, kept apart (round 4, 2026-11-02)
"Count on $X a month" saves `income[].countOn` and leaves the Income page's amount alone. Before, it overwrote the amount, so every tax page dropped with it (a freelancer's next quarterly payment went from $2,800 to $1,687 and the April bill from $9,453 to $2,807) while this page still said the tax was higher. Now the left-over figure, Forecast and the statements plan with the careful figure, tax stays on the amount, and the card says so, with "Count the full $X again" (deletes `countOn`) and "Count on $Y instead" when the months change. `items[].counted` is the figure on file.
Review fixes 2026-11-02: `counted` is income's `countedOn(x)` (null at or above the amount, so the forecast never lands
more than Income counts). The "counts on $X" sentence and "Count the full $X again" show whenever a figure is on file,
also with too few months typed (it used to disappear while still lowering the left-over figure); "Count on $Y instead"
only when $Y is below the amount. The sentence names the tax pages (Quarterly payments, the April bill) as what stays on
the Income amount, since the set-aside card below works on the typed average.

## Ideas / not yet
- The months read from the ledger: deposits from the same payer into the account it lands in.
- Expenses per side income (mileage logged here feeding the Self-employment page's expenses).

## A raise from a later date: one record (review 2026-11-02, round 5)
When the Income page splits a line for a raise from a later date, the new pay `continues` the old one (cashflow/income
`chainId`). Each item has `key` = `chainId(line)`: the months are read from and saved to `whatIfs.sideIncome[key]`
(`saveMonths(draft, item, months)`), and "Count on $X a month" / "Count the full ... again" set or remove `countOn` on every
line of the chain (`setCountOn(draft, item, value)`; a line of the chain that is not repeating business pay keeps none).
Before, the figure was changed only on the line on screen and the months were copied to the ending line, so turning the
figure off before the start date brought it back on the start date, and months typed in between disappeared then.
Test: `module.test.mjs` ("one record for both halves").

## One quarterly answer on the card (round 8 review, 2026-11-06)
- **The tile:** "This income adds" now says the year's tax on this income as a share to set aside each month (`yearly /
  12`), not "a quarter to the IRS".
- **What to pay and when:** that is the Estimated payments page's one answer, said in the sentence under the tile.
- **Why.** The card said "$3,514 a quarter to the IRS" above "$3,577 by January 15".
- **The state part** stays inside the share. It is not said on its own until claude-a's State page works the business at
  its profit (ranked item 15).
- **Page name:** the page is called "Estimated payments" everywhere on this page (it said "Quarterly payments").

## Wording follow-up (2026-11-07, claude-b lane B)
- On screen the buffer for lean months is the "savings buffer" (not "cushion", which is the emergency fund's old name).
