# Education (529)  (`goals/education`)

**Status:** usable (phase 4)
**Purpose:** College for each child: what the years of college would cost when they get there, what is already set aside, the monthly 529 saving that covers the share you choose by the first bill, and how much today's saving covers.

## Inputs
`household.people` (children with birth dates), `goals` (a college/school/education/529 goal with the child's name; with one child, any such goal), `accounts` (type `529`: named for the child, else shared equally), `assumptions` and `retirement.stocksNow` (the return, via `planReturn`), `whatIfs.college`. Writes `whatIfs.college = { growth, [childId]: { type: "public"|"private"|"custom", yearly, share, years, startAge } }` and adds or updates the child's goal ("Make it Cy's goal": target = the cost in today's money x the share, rounded to $1,000; date August 15 of the first year).

## Data
2025-26 published prices, College Board "Trends in College Pricing and Student Aid 2025": public four-year in-state tuition and fees $11,950 + room and board $13,900 = $25,850; private nonprofit $45,000 + $15,920 = $60,920 (read from reports citing it; collegeboard.org was not opened from the build session). Prices rise `DEFAULT_GROWTH` 4% a year unless set.

## Formulas
- A year's cost now = the published price x (1 + growth)^(this year - 2026) (the 2025-26 price is this year's in 2026).
- College years: from birth year + start age (18), `years` of them; each year's cost = cost now x (1 + growth)^(years from now). Total in those years' dollars; in today's money divided by (1 + inflation)^(years from now).
- At the first bill = each year's cost discounted at the plan's return for the years after the first (the money keeps growing while spent).
- Monthly needed = pmtToReach(return / 12, months to August 15 of the first year, at-the-first-bill x share, set aside). Today's saving covers = fv(return / 12, months, the monthly amount, set aside) / at-the-first-bill.

## Edge cases
- College has begun: no monthly figure. A 529's state tax deduction, financial aid and the 529-to-Roth rollover are mentioned, not modelled.

## Tests
`module.test.mjs`: the prices, no children, Cy's years and costs by hand (at the first bill, the monthly needed, the share covered, the goal found), per-child settings (private, half, five years, custom) and 529 accounts without a goal.
