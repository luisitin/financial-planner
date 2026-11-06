# Education (529)  (`goals/education`)

**Status:** usable (phase 4)
**Purpose:** College for each child: what the years of college would cost when they get there, what is already set aside, the monthly 529 saving that covers the share you choose by the first bill, and how much today's saving covers.

## Inputs
`household.people` (children with birth dates), `goals` (a goal whose name matches `EDUCATION_GOAL`, college, university, school, tuition, education or 529, and names the child as a whole word, case-insensitive (`namesPerson`: "Ed's college" and "COLLEGE FOR ED" are Ed's; "Education fund" is not, nor is "University fund" Ty's); with one child, the first such goal that names nobody else in the household as a whole word: not an adult's own ("Jo's night school") nor another dependent's, with or without a birth date ("Mia college")), `accounts` (type `529`: named for the child the same way, else shared equally), `assumptions` and `retirement.stocksNow` (the return, via `planReturn`), `whatIfs.college`. Writes `whatIfs.college = { growth, [childId]: { type: "public"|"private"|"custom", yearly, share, years, startAge } }` and adds or updates the child's goal ("Make it Cy's goal": target = the cost in today's money x the share, rounded to $1,000; date August 15 of the first year).

## Data
2025-26 published prices, College Board "Trends in College Pricing and Student Aid 2025": public four-year in-state tuition and fees $11,950 + room and board $13,900 = $25,850; private nonprofit $45,000 + $15,920 = $60,920 (read from reports citing it; collegeboard.org was not opened from the build session). Prices rise `DEFAULT_GROWTH` 4% a year unless set.

## Formulas
- A year's cost now = the published price x (1 + growth)^(this year - 2026) (the 2025-26 price is this year's in 2026).
- College years: from birth year + start age (18), `years` of them; each year's cost = cost now x (1 + growth)^(years from now). Total in those years' dollars; in today's money divided by (1 + inflation)^(years from now).
- At the first bill = each year's cost discounted at the plan's return for the years after the first (the money keeps growing while spent).
- Monthly needed = pmtToReach(return / 12, months to August 15 of the first year, at-the-first-bill x share, set aside). Today's saving covers = fv(return / 12, months, the monthly amount, set aside) / at-the-first-bill.

## Shared with other pages
- `EDUCATION_GOAL` (the pattern above) and `namesPerson(text, name)` (the whole-word tie): Life insurance needs reads a goal as an education goal, and as a child's, exactly as this page does.
- `shownAmount(n)`: a figure as this page shows it, to the $10 (the view formats every amount through it); Life insurance needs quotes and counts this page's figure through it ("$120,110").

## Edge cases
- College has begun: no monthly figure. A 529's state tax deduction, financial aid and the 529-to-Roth rollover are mentioned, not modelled.
- A child's name inside a word does not tie a goal (before 2026-11-02 "Education fund" was Ed's and Get started's "Education" was Cat's).
- Fifth pass (2026-11-02): with one child (one dependent with a birth date), the first education goal was the child's even
  when it named someone else: "Mia college" listed first, for a Mia with no birth date, became Child 1's goal (Life insurance
  needs then counted it for Child 1: $80,000 instead of $150,000, and the answer hung on the order of the goals), and "Jo's
  night school" listed first showed under Child 1 with an "Update" button that would have rewritten Jo's goal as a $120,000
  college goal. The one-child fallback now skips any goal naming another person in the household (adults and dependents,
  dated or not) as a whole word; with "Mia college" alone, the child has no goal.

## Tests
`module.test.mjs`: the prices, no children, Cy's years and costs by hand (at the first bill, the monthly needed, the share covered, the goal found), per-child settings (private, half, five years, custom) and 529 accounts without a goal; the whole-word tie ("Education fund" with Ed and Ann, "University fund" with Ty, "Ed's college", a 529 account not named for a child shared), a "Cy 529" goal, `shownAmount`; the one-child fallback skipping a goal that names someone else ("Mia college" with Mia undated, listed first or second, or alone; "Ana's night school" listed first).
