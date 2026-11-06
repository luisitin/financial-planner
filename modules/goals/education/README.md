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

## Round 8 (2026-11-06): children already in college (item 18, equity-5)
For a child whose college has begun (`started`), the page led with "0% covered" and its goal button wrote the first bill's
date (2023-08-15), so Goals read "$105,576 needed each month". Now:
- A school year runs from its fall bill (August 15 of its first year) to its spring bill (January 15 of the next): `BILLS`.
  `left` = the school years still to pay: those whose spring bill is still ahead (a year that has begun counts in full,
  since what is paid of it is not known; the page says to take off what is). `stillToPay` = their cost x the share;
  `nextBill` = the spring bill of a year under way, else the next year's fall bill; `nextYearCost` = the first year left x
  the share; `finished` once none is left. These are only on a child whose college has begun.
- The equity household on 2026-11-06: Child 2 (from 2023) has 2026-27 left: $25,850 (the page's 2025-26 price, College
  Board Trends 2025, $11,950 + $13,900; prices start rising from the year after `COST_YEAR` + 1, as before), next bill
  January 15, 2027. Child 1 (from 2025): 2026-27, 2027-28, 2028-29 = 25,850 + 26,884 + 27,959 = $80,693.
- The card leads with "Still to pay" and "Next bill"; the button makes or updates the goal for the next school year
  ("Child 1's college, 2026-27"): its cost (to the $10), dated at its next bill, in that year's dollars (`inflates: false`),
  never a past date; a name this page wrote for an earlier year moves on to the current one.
- The FAFSA (`fafsa`: the next school year still to begin, once its form is open or opens within 12 months): the form for a
  school year must open by October 1 of the year before it (20 U.S.C. 1090(d)(4)(A), read 2026-11-06; the 2027-28 form
  opened September 23, 2026). "The free federal student aid form for 2027-28 is open now at studentaid.gov: it decides grants,
  work-study and federal student loans, and some aid goes to those who file first." (the FAFSA, spelled out on screen)
- The American Opportunity tax credit (`aotc`), only with a student in the first four years of college this school year or
  the next, not on a separate return, and only when the household's AGI (the Federal estimate's) is under the limit: up to
  $2,500 a year per student, for four years, shrinking from $80,000 to $90,000 of modified AGI ($160,000 to $180,000 on a
  joint return), none on a separate return (IRS Publication 970 (2025), chapter 2; IRC 25A(b), (d); read 2026-11-06; the
  ranges are the law's own, not indexed). `status` "full" up to the lower figure, "partial" in the range. The equity
  household's $213,000 AGI is over $180,000: nothing is said.
Tests: module.test.mjs "round 8 item 18".

## Round 8 batch 2 review fixes (2026-11-06)
Tests: module.test.mjs "round 8 review" and the updated item 18 tests.
- **The spring half (money D7).** By the page's own two-bill model (`BILLS`: August 15 and January 15, half a school year on
  each), once a year's fall bill has come due what is left of it is the spring half: its `left` entry is `{ cost: year's cost
  / 2, part: "spring" }`, so `stillToPay`, `nextYearCost` (now "what is left of the first year x share", the next bill's
  amount) and the goal button follow. The page says so: "The August bill for 2026-27 is taken as paid; the spring half, about
  $12,930, is due by January 15, 2027." Equity, 2026-11-06: Child 2 has 25,850 / 2 = $12,925 left (shown $12,930); Child 1
  12,925 + 25,850 x 1.04 + 25,850 x 1.04^2 = $67,768.36. Before the fall bill, the whole year is ahead, due from it.
- **One goal for each child (UX 1).** `generic`: an education goal naming nobody in the household and no child's own (Get
  started's "Education"), not reached. With it, a child in college's card offers `Use "Education" for Child 2` first: that goal
  becomes the child's (its name, the next bill's amount and date; its id, what is set aside and what goes in kept), so college
  is not counted twice; "Add a new goal instead" is the other choice.
- Pre-existing, not changed: a school year is priced at the year before's published price (`COST_YEAR` + 1 is "this year's").
  The 2026-27 year costs the 2025-26 price here; at 4% it would be 25,850 x 1.04 (the owner's call; no golden key covers it).

## Round 8 verify (2026-11-06)
Tests: module.test.mjs "round 8 verify".
- **A goal naming nobody is offered to a child in college only while every child has begun college.** With a younger child
  still to start, "College fund" ($150,000 by 2036, $20,000 saved) is most likely that child's; the filled button
  `Use "College fund" for Child 1` turned it into the older child's spring bill ($12,930 by January 15, 2027) with its saving.
  The equity family (both children in college) still gets the offer.
- **A school year is priced as its own.** `left` (still to pay, the next bill) prices each school year y at
  published x (1 + growth)^max(0, y - COST_YEAR - 1), the same as `costs` for a year still ahead; `costs` priced a year
  already begun at this calendar year's price, so on January 1 the spring half of 2026-27 rose from $12,925 to $13,442 for the
  same January 15 bill. A typed (custom) price is used as typed, as before. `costs`, `total`, `totalToday` and `atStart` are
  unchanged.

## Plain words (path part 3, 2026-11-06)
"Prices have risen faster than inflation" reads "College prices have risen faster than prices in general". No figure changed.

## Which return it reads (round 8, batch 1 follow-up)

**(a) This household's own tax year.** The American Opportunity credit is cut by modified AGI. Source: the same function the Federal estimate uses, `known()` in `modules/taxes/federal/known.js` (through `taxView()`), so this page and that one quote one marginal rate, one AGI and one tax. MAGI is `taxView(...).result.agi`, the Federal estimate's AGI. The landlord household's rent after costs is 154,400, not the 179,600 the rows alone gave, which moves the credit from "partial" to "full".
