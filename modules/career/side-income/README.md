# Side income  (`career/side-income`)

**Status:** usable, phase 10
**Purpose:** Models irregular income from gigs, freelance work and a small business so your plan can count on it sensibly.

## Inputs
- Each active "Self-employment / business" item on the Income page (`income[]` with `type: "business"`, not one-off):
  its name, holder and monthly amount.
- `whatIfs.sideIncome = { [incomeId]: { months: { "YYYY-MM": amount } } }`: what came in each of the last twelve whole
  months, typed on this page (blank = not known, 0 = nothing came).
- The Self-employment page's tax on the household's business income (`taxes/self-employment`: `businessTax`, `net`),
  the State tax page's rate (`taxes/state`), and whether the whole return needs quarterly payments and the next one
  (`taxes/estimated`: `needsEstimates`, `nextDue`), each worked on a copy of the plan with every side income that has
  enough typed months at its months' average.
- Writes `whatIfs.sideIncome`; "Count on ..." sets that income's amount on the Income page (monthly).

## Outputs
`compute(plan, { today })` -> `{ ready, year, months, items: [{ id, name, personName, monthly, period, typedMonths, stats, enough, countOn, gap, below }], setAside: { rate, yearly, quarter, federal, state, stateKnown, stateAverage, onAverage } | null, estimates: { needed, nextDue }, rules, notes }`;
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
- **Quarterly payments**: whether the whole return needs them and the next one come from the Estimated payments page
  (Form 1040-ES 2026: $1,000 or more owed after withholding, the safe harbor); this page does not decide it from the
  side income alone.
- **Forms** (`data/rules.js`, 2026): clients send a 1099-NEC from $2,000 a year (IRC 6041 as amended by P.L. 119-21
  §70433; $600 before 2026; indexed from 2027); payment apps and marketplaces send a 1099-K over $20,000 and more than
  200 payments (IRC 6050W(e) as restored by §70432, third-party settlement organizations only); card processors report
  card sales of any amount. Income tax applies to all of the profit; self-employment tax starts once 92.35% of the
  year's profit reaches $400 (IRC 1402(b), 6017), about $433 of profit. A year past the table shows the latest rules,
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

## Ideas / not yet
- The months read from the ledger: deposits from the same payer into the account it lands in.
- Expenses per side income (mileage logged here feeding the Self-employment page's expenses).
