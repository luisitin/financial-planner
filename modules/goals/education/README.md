# Education (529)  (`goals/education`)

**Status:** usable (phase 4)
**Purpose:** College for each child: what the years of college would cost when they get there, what is already set aside, the monthly 529 saving that covers the share you choose by the first bill, and how much today's saving covers.

## Inputs
`household.people` (children with birth dates), `goals` (a goal whose name matches `EDUCATION_GOAL`, college, university, school, tuition, education or 529, and names the child as a whole word, case-insensitive (`namesPerson`: "Ed's college" and "COLLEGE FOR ED" are Ed's; "Education fund" is not, nor is "University fund" Ty's); with one child, the first such goal that names nobody else in the household as a whole word: not an adult's own ("Jo's night school") nor another dependent's, with or without a birth date ("Mia college")), `accounts` (type `529`: named for the child the same way, else shared equally), `assumptions` and `retirement.stocksNow` (the return, via `planReturn`), `whatIfs.college`. Writes `whatIfs.college = { growth, [childId]: { type: "public"|"private"|"custom", yearly, share, years, startAge } }` and adds or updates the child's goal ("Make it Cy's goal": target = the cost in today's dollars x the share, rounded to $1,000; date August 15 of the first year).

## Data
2025-26 published prices, College Board "Trends in College Pricing and Student Aid 2025": public four-year in-state tuition and fees $11,950 + room and board $13,900 = $25,850; private nonprofit $45,000 + $15,920 = $60,920 (read from reports citing it; collegeboard.org was not opened from the build session). Prices rise `DEFAULT_GROWTH` 4% a year unless set.

## Formulas
- A year's cost now = the published price x (1 + growth)^(this year - 2026) (the 2025-26 price is this year's in 2026).
- College years: from birth year + start age (18), `years` of them; each year's cost = cost now x (1 + growth)^(years from now). Total in those years' dollars; in today's dollars divided by (1 + inflation)^(years from now).
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

## Touch and input stress test (2026-11-11, claude-g)
- "A year's cost today" shows only when the kind of college is "A cost I enter" (p-cashflow-b-goals F10, the Education half; Travel's half is claude-a's).

## The figure Get started uses (smart guesses C5, 2026-11-13)
`educationTarget(plan, { today })` is this page's "Make it a goal" figure for each child with a birth year whose college has
not begun, and their sum: `round(totalToday x share / 1,000) x 1,000` per child (four years at the kind, share and start age
set here; public in-state by default), in today's money. Get started's question 7b writes it, marked as our guess, when the
Education goal's "How much" is left blank (`goals/education:target` in overview/setup's estimators), so Goals and this page
start from one figure. `compute()` is unchanged. Source: this page's own prices (`COSTS`, College Board "Trends in College
Pricing and Student Aid 2025", as described at the top of this file); the rounding is the "Make it a goal" button's (view.js).

## Our guess in an empty "A cost I enter" box (smart guesses C9, 2026-11-14; spec 12.1 "K3 previews")
A child set to "A cost I enter" with the year's cost left empty used to count $0 a year ("Four years would cost $0"). The
box now shows our guess in gray, a public in-state year at published prices grown to this year as the page counts "Public,
in-state" (`publicYearNow`: 25,850 in 2026; x 1.04 a year after, at the plan's college growth), with "Our guess: a year at a
public in-state college, at published prices." under it. The page counts it while the box stays empty; the card says so in
one muted line outside the fold ("The yearly cost is our guess for now: a public in-state year. Put yours in under Type
of college and share to cover."), the stat reads "our guess of the cost", and the row's status reads "our guess". An empty box still
saves `null`: our figure is never written, no `plan.guesses` entry is made, and opening the page writes nothing. Estimator
`goals/education:yearly` (`estimators`, re-exported by `module.js`; basis "yours": the page's own published price, the same
figure `goals/education:target` uses; `dataAsOf` 2026-10-30, when `COSTS` was read). Only a custom cost left empty takes it,
and each child then carries `previewed`.
**`compute` counts it itself** (`previewsOf(plan, { today })`: the estimator through `core/estimate`'s `estimate()`, exactly as the
shell's `ctx.guess` runs it, U.S. figures only, rounded to $50), so every page that quotes this compute counts the same cost:
Your plan's college line, Next best action's college bill, Life insurance needs and Get started's goal amount
(`educationTarget`). Critic e9 F2, 2026-11-14: the page passed its guess and those did not, so the family's Cy cost $175,747
here and "about $0" on Your plan, and Life insurance needs left his college out. `compute(plan, { today, previews: null })` is
the page before C9 ($0; module test, on four households and the custom case); `{ yearly }` is used as given.
The cost box, with its gray figure and its line, shows only while the kind is "A cost I enter": the page hid it with `hidden`,
which the kit's `.field { display: flex }` overrides in a browser, so it showed under Public too (critic e9 F6); it is now also
set to `display: none`. The share box has no "e.g. 7" (F7: gray means counted). The help lines start as sentences, as "Our guess: ..." does ("Left
empty, we count 4% a year."; P8).

The page, simple first: each child's "Type of college and share to cover" is now a row of the helper (`part()`, kind
`item`: one per child, its title as before, status "public, 100%"); "How fast prices rise" is an item row too, its box with
one sentence of what the rate does ("At 4.0% a year, a public in-state year ($25,850 in 2025-26) would cost about $41,390 in
2038, when Cy starts.", `growthExample`, so the row is worth a tap, R14); the row just saved stays open (R17, test "S11"). No
hand-written `<details>` remain. Kept as it was on purpose: the top card's growth sentence (moving it pulled the "Good to know"
list up into the first screen, which the browser check counts) and the row's two-line title (a one-line title did the same). The College Board figures were read from reports citing them (see Data), so the gray figure carries that caveat.

## Your state's tax break (gap list, next 60, item 3; map U4; 2026-11-15)
One quiet row, **"Your state's tax break"** (kind `item`, like "How fast prices rise"), in the card of rows right under the
children's cards (see "The three rows together"), shown while a child is still to start college. Shut, its status says
what it holds (critic q4 P1): "Texas: none" in a state with no income tax on pay (`stateStatus`), "not set yet" while
nothing is typed, "1 set by you" once something is. The first view
gains its four title words and loses fifteen: the bullet "A 529 plan grows tax-free when spent on college, and many states
take contributions off state income tax: check your state's plan first." is now "A 529 plan grows tax-free when spent on
college.", and its clause is inside the row ("Many states take money put into a 529 off state income tax: check your
state's plan first, it says how much."); with no row (every child in college) the bullet keeps it. The family's first view:
190 words to 179 (the counts file's entry lowered to 180), figures 14 as before.

Open, it holds the answer's one sentence, what was counted, that clause, and two boxes with one Save:
- "Taken off your income a year" (`whatIfs.college.stateDeduction`): **the person's own figure only.** No state's figure is
  claimed on this page: states differ (a deduction, a credit, a deduction only for their own plan, or nothing) and none was
  read at a state's own site for this build. The help line gives an example in words, "For example $5,000.", never as a
  gray figure (gray means counted on this app), and `STATE_EXAMPLE` is never counted.
- "Your state's tax rate" (`whatIfs.college.stateRate`): left empty, the State tax page's rate (its `compute()`, imported
  read-only from `modules/taxes/state`): a rate typed there, last year's state tax as a share of income, the state's flat
  rate (13 states, its README's sources: Tax Foundation 2026 and each state's schedule), or 0 in the nine states with no
  income tax on pay; a graduated state with nothing typed there has no rate, so the row asks for one ("for example 5%").
  The help line says what an empty box counts ("Left empty, we count 4.4%: Colorado's flat rate on the State tax page.").

`stateBreak(plan, { today, d?, stateTax? })` (pure; `compute()` is not changed):
- years: each calendar year from this one to the year before the last child still to start begins college (at least one).
- put_y = 12 x the goal's monthly for each such child who has not started by y; counted_y = min(deduction, put_y); when
  nothing goes in at all this year, the deduction itself, said as "if you put it in" (case "assumed").
- yearly = counted (this year) x rate; total = sum over the years of counted_y x rate. Nominal dollars, as the state's
  deduction is; not discounted.
- The year college starts is not counted (saving that year stops in August): a builder's choice, on the careful side.
- The rate is applied to the whole deduction: right for a flat rate; with a graduated state's top rate typed, it is the tax
  on the last dollars, which is what a deduction takes off.

One sentence per case (`stateSentence`, view.js; each has a module test):
| case | when | sentence (the family moved to Colorado, $250 a month going in) |
|---|---|---|
| none | no state income tax on pay, nothing typed here | "Texas has no state income tax on pay, so 529 money brings no state tax break there." |
| ask | no deduction typed | "Type below how much a year your state lets you take off your income for 529 money: we work out what it saves." |
| rate | deduction typed, no rate known | "Type your state's tax rate below to see what that saves." |
| zero | 0 typed for either | "With nothing taken off or a 0% rate, 529 money brings no state tax break." |
| full | what goes in a year is at least the deduction | ($2,000) "About $90 a year less state tax, $1,060 in all by the time Cy starts college in 2038." |
| capped | something goes in, less than the deduction | ($5,000) "About $130 a year less state tax on the $3,000 a year you put in now, $1,580 in all by the time Cy starts college in 2038." |
| assumed | nothing goes in yet | "Nothing goes into a 529 yet. Putting in $5,000 a year would take about $220 a year off your state tax, $2,640 in all by the time Cy starts college in 2038." |

By hand (Colorado 4.4%, $5,000 typed, $3,000 a year going in): 3,000 x 0.044 = $132 a year; x 12 years (2026 to 2037) =
$1,584 (shown to the $10, as this page shows every figure: $130 and $1,580). Two children (Bo from 2034 at $100 a month
and Cy at $250, $4,000 typed): 2026 to 2033 4,000 a year counts, 2034 to 2037 3,000: (32,000 + 12,000) x 0.044 = $1,936.
Save keeps the row open and says, inside it, "Saved." and the new figure in a few words, "Saved. About $130 a year less
state tax." (`stateSaved`; just "Saved." when the case has no figure), with the full sentence right under it, once (R7,
R17, critic q4 P2; test "state break, the page S11").
Figures typed by hand: only a number, or a string that reads as one, is a figure; `true`, `[5000]` or an object stored by
hand reads as not typed (critic q4 M5: `Number(true)` is 1, a 100% rate). This applies to all four fields.
Left as is (critic q4 M3, severity 1): this calendar year counts a full year of what goes in even when only weeks are
left, and the year college starts counts nothing (for the family on 2026-11-13: 144 months counted against 141 left,
about 2% more); the total is said as "about", and a deduction is a whole year's figure.
Tests: module.test.mjs "state break", "critic q4 M5", "critic q4 P1, P2".

## Save or borrow (gap list, next 60, item 4, first half; map U5; 2026-11-15)
One quiet row, **"Save or borrow"** (kind `item`), the first in the card of rows under the children's cards, shown while
a child is still to start college. Shut, its status gives the answer valued today when every child's is the same
(critic q4 P1, `borrowStatus`): "about even", "borrowing costs more", "borrowing costs less" or "nothing to borrow"; once a
loan rate is typed, "set by you". The bullet "Retirement first: there are
loans for college, not for retirement." moved into it (it stays a bullet when there is no row): the family's first view is
173 words now (entry 180), figures 14.

Open, for each child still to start (a small heading per child when there are several): two tiles, "Save each month from
now" (the monthly, and what that is in all by August of the first year) and "Or borrow: each month after college" (the
payment, for 10 years, with what goes in now until then, and what that is in all); the sentence on the totals; the
sentence valued today; one short line of what was counted ("Counted: what is set aside grows 6.1% a year; a loan costs 6% a
year (an example) and is paid back over 10 years after college.", critic q4 P3: the bills and the interest dates are
here in the README, not on screen; a "How this is worked out" inside the row would be a part inside a part, which R11
refuses); the "Retirement first" line; "This compares two ways to pay; it is not advice."; and one box, "Loan rate a
year", with Save.

`saveOrBorrow(plan, { today, d?, loanRate? })` (pure; `compute()` is not changed). R = the page's own return (`planReturn`,
"growing at 6.1% a year in a 529 plan"); L = the loan rate typed (`whatIfs.college.loanRate`), else **6% a year, an example**:
the federal undergraduate rate for this school year is published at studentaid.gov, which this build's network refused on
2026-11-15, so no rate is quoted; the help line says "Left empty, we count 6% a year, an example: type the rate of the loan
you would take.", never a gray figure. 10 years: the brief's term (a person's loan may run longer).
- Save: M = the page's monthly that covers the share by the first bill (`neededMonthly` = pmtToReach(R/12, months left,
  at the first bill x share, set aside)); saveTotal = M x months left (what is already set aside is the same both ways).
- Borrow: what goes in now (the goal's monthly) keeps going in; pot_0 = fv(R/12, months left, monthly, set aside) at the
  first fall bill; each later school year pot_i = (pot_(i-1) - paid_(i-1)) x (1 + R) (the same yearly growth the page's
  "at the first bill" figure discounts by); bill_i = the year's cost x share; paid_i = min(pot_i, bill_i); borrowed_i =
  bill_i - paid_i. owed = sum of borrowed_i x (1 + L/12)^(12 x (years - i)): interest builds month by month from each fall
  bill to August 15 after the last school year, when payments start (a loan's first payment usually comes a few months
  after school; this is the builder's simple date). payment = pmt(L/12, 120, owed); borrowTotal = monthly x months left +
  payment x 120.
- diff = borrowTotal - saveTotal, in the dollars of the years they are paid (not discounted: what is paid in all).
  Putting in exactly M leaves nothing to borrow (test), so the two sides use one model of the 529.
- **Valued today** (critic q4 M1). The totals add dollars whenever they are paid, and borrowing pays years later: at a
  loan rate equal to the plan's return, borrowing always "costs more" in all ($102,640 for the family), though both ways
  are worth the same. So each way is also valued today, every payment discounted to now at the plan's return, month by
  month (r = R/12): pvSave = M x a(r, months left); pvBorrow = monthly x a(r, months left) + payment x a(r, 120) x (1 +
  r)^-(months left + 12 x years), where a(r, n) = (1 - (1 + r)^-n) / r (n when r = 0): payments at the end of each
  month, the loan's first a month after the August after the last school year. pvDiff = pvBorrow - pvSave; `valued` =
  "same" within 1% of the larger, else "more" or "less"; none when nothing is borrowed or R <= 0 (nothing earned
  meanwhile: the totals already say it). Discounting at the plan's own return is the builder's choice: it is what money
  set aside earns on this page. The family at 6%: $74,617 saving against $74,130 borrowing, about the same; at 3% borrowing
  is about $9,140 less valued today though $71,370 more in all; at 8% about $6,060 more.

One sentence per case (`borrowSentence`, view.js; each has a module test):
| case | when | sentence |
|---|---|---|
| covered | nothing to borrow (what goes in now is at least M) | "What goes in now already covers Cy's college: there is nothing to borrow." (no tiles) |
| more | more paid in all | "Borrowing what is missing means paying about $101,550 more in all than saving it from now, but later." |
| less | less paid in all (money that shrinks while saved, a cheap loan) | "Borrowing what is missing means paying about $X less in all than saving it from now, at these rates." |
| same | within 1% of the larger | "Saving and borrowing come to about the same paid in all, at these rates." (R = 0 and L = 0 give exactly the same) |

Then one sentence valued today (`borrowValued`), when there is one:
| valued | sentence (the family's 6.1%) |
|---|---|
| same | "Valued today, counting what saved money would earn meanwhile at 6.1% a year, the two ways cost about the same." |
| more | "Valued today, counting what saved money would earn meanwhile at 6.1% a year, borrowing still costs about $6,060 more." |
| less | "Valued today, counting what saved money would earn meanwhile at 6.1% a year, borrowing costs about $9,140 less." |

By hand, the family on 2026-11-13 (Cy, college from 2038, $4,000 set aside, $250 a month, 141 months, R = 6.1%, L = 6%):
saving $742.60 a month x 141 = $104,706.23 (shown $740 and $104,710). Borrowing: the 529 holds fv = $59,523.06 at August
2038 and pays 2038-39 ($41,386.68) and $19,242.70 of 2039-40 (the $18,136.38 left, grown a year); borrowed $23,799.45 + $44,763.84 +
$46,554.39 = $115,117.68, owed $128,362.10 by August 2042 with interest, $1,425.08 a month for 120 months; with $250 x 141 =
$35,250 put in before, $206,259.90 in all, $101,553.67 more (shown $1,430, $206,260 and $101,550). Valued today: $742.60 x
a(0.0050833, 141) = $74,616.54 saving; $250 x a(0.0050833, 141) + $1,425.08 x a(0.0050833, 120) / 1.0050833^189 = $74,129.90
borrowing; $486.65 less, under 1%: about the same. Save keeps the row open and says, inside it, the new payment in a few
words, "Saved. At 5% a year: $1,340 a month for 10 years after college." (`borrowSaved`; each child's payment when there
are several; "Saved. Nothing to borrow." when nothing is), with the sentences under it, once (R7, R17, critic q4 P2; test
"save or borrow, the page S11"). Tests: module.test.mjs "save or borrow", "critic q4 M1".

## School before college (gap list, next 60, item 4, second half; map U6; 2026-11-15)
One quiet row, **"School before college"** (kind `item`), the last in the card of rows under the children's cards, shown
while a child still to start college has a school year left before it. Its first line is the brief's "one line": "529 money can also pay up to $20,000 a year of a
child's school before college, kindergarten to 12th grade: tuition, books and tutoring at a public, private or religious
school (from 2026; $10,000 before). That is the federal rule: your state may tax this money differently." (The second
sentence, critic q4 M2: secondary sources read 2026-11-15 say many states do not follow the federal K-12 limit for their own
tax; no state's rule was read at its source, so the line says only that the state may differ.) It sits inside the row rather than as a bullet, the builder's choice: the page's first
view was already over its words budget (179 then), and the row's title says what is inside. Then the question "How much a
year from the 529 for school:" as chips ("None", "$5,000", "$10,000", "$20,000, the most", "Type my own", R23: the old and
the new limit among them), with a gray line above them on which is usual ("None is usual with a public school (no
tuition). Pick an amount for private school or tutoring.", `SCHOOL_HINT`, critic q4 P6: a plain fact, no share of families
claimed), saved at once on a tap (`whatIfs.college.schoolYearly`, one amount a year for each child), and the answer. "Type
my own" opens one box labelled "A year for school, saved when you leave the box" (critic q4 P5: `choice()` commits on the
box's change, and there is no Save to tap).
Shut, it says nothing until an amount is picked, then what was picked ("set by you · $10,000", "set by you · none";
critic q4 P1). The other two rows' statuses use the first view's last four words (180 of its entry's 180, first screen
120 of 120): this row has none before a pick, its title says what it holds.
Once picked it cannot go back to "not picked" (critic q4 M6, left): "None" gives the same answer, and the status says
"set by you", which is true.

**The figure, read at its source.** IRS Topic no. 313, Qualified tuition programs (QTPs),
https://www.irs.gov/taxtopics/tc313 (page "Last Reviewed or Updated: 09-Nov-2026", read 2026-11-15): the expenses for a
child's enrollment or attendance at an elementary or secondary public, private or religious school ("kindergarten through
grade 12": tuition, curriculum and curricular materials, books, tutoring outside the home, test fees, dual enrollment,
therapies for students with disabilities) "are limited up to a total amount of $20,000 per year ($10,000 limit before Dec.
31, 2025) from all of the designated beneficiary's QTPs". Also read the same day, and still at $10,000 because they cover
2025: Publication 970 (2025), chapter 7, https://www.irs.gov/publications/p970 (updated 2026-04-30; its early draft for 2025
returns says the same), and "529 plans: Questions and answers", https://www.irs.gov/newsroom/529-plans-questions-and-answers
(updated 2026-01-30). The law that changed it (the 2025 act) was not read on congress.gov; the IRS page is the source.
Constants: `SCHOOL = { limit: 20000, before: 10000, from: 2026, grades: 13, read, source }` in compute.js; check it each year.

`schoolFirst(plan, { today, d?, yearly? })` (pure; `compute()` is not changed), for each child still to start:
- school years: y from max(first, startYear - 13) to startYear - 1. `first` is this calendar year's school year while its
  August 15 is still ahead, else next year's (the page's own fall bill, `BILLS.fall`); 13 = kindergarten to 12th grade.
- A = min(the amount picked, $20,000). lost = sum over those years of A_y x (1 + R/12)^(12 x (startYear - y)): each
  payment, made August 15 of its school year, and what it would have grown to by the first college bill at the plan's
  return R. A_y = min(the amount picked, the limit of tax year y): $20,000 from 2026, $10,000 for a school year paid in 2025
  (critic q4 M4; reached only with a date before 2026).
- newMonthly = pmtToReach(R/12, months left, at the first bill x share + lost, set aside): the monthly that still covers
  college as planned with those payments out (the same formula as the card's own monthly, with the payments added).
- empty: nothing set aside for the child and nothing going in. Then there is no 529 money to pay school from yet, and "less
  for college" would read oddly beside "$0 set aside" (critic q4 P6): the sentence says how much to put in for both.
- Not modelled: whether the 529 holds the money when a school bill comes (an early year can ask for more than is in it);
  a state's own rules on 529 money for school (some states tax it); the extra the person pays above $20,000 (counted as
  $20,000, and the row says "The most that counts is $20,000 a year").

One sentence per case (`schoolSentence`, `schoolChild`, view.js; each has a module test):
| case | sentence |
|---|---|
| ask (nothing picked) | "Pick an amount a year to see how much less that leaves for college." |
| none ("None") | "Nothing taken out for school: college keeps all of it." |
| one child | "Paying $10,000 a year of Cy's school from the 529, 11 school years from 2027-28 to 2037-38, leaves about $161,420 less for college in 2038, at the plan's 6.1% a year. To pay for both, put in about $1,530 a month instead of $740." |
| one child, nothing set aside or going in | "Nothing is set aside for Cy yet. To pay $10,000 a year of school from a 529, 11 school years from 2027-28 to 2037-38, and still cover college, put in about $1,570 a month instead of $780." |
| several | "Paying $10,000 a year of each child's school from the 529, at the plan's 6.1% a year:" and a line each, "Bo: 7 school years from 2027-28 to 2033-34, about $89,950 less for college in 2034; for school and college, $1,920 a month instead of $1,160." (with nothing set aside or going in: "Cy: nothing set aside yet; to pay 11 school years from 2027-28 to 2037-38 and college, $1,570 a month instead of $780.") |
A single school year reads "the 2026-27 school year".

By hand, the family on 2026-11-13 ($10,000 a year, 2027-28 to 2037-38, R = 6.1%): sum of 10,000 x (1.0050833)^(12 x
(2038 - y)) for y = 2027 to 2037 = $161,417.62 (shown $161,420); the monthly that still covers college: pmtToReach(0.0050833,
141, $160,696.35 + $161,417.62, $4,000) = $1,528.52 (shown $1,530) instead of $742.60 ($740). A chip tap keeps the row open
and says, inside it, the new monthly in a few words, "Saved. $10,000 a year for school: put in about $1,530 a month to pay
for both." (`schoolSaved`; each child's monthly when there are several; "Saved. Nothing taken out for school." for None),
with the full sentence under the chips, once (R7, R17, critic q4 P2; test "school before college, the page S11"). Tests:
module.test.mjs "school before college", "critic q4 M4", "critic q4 P6".

## The three rows together (gap list, next 60, items 3 and 4)
- Where: one card of three quiet rows, no heading, right under the children's cards and before "Good to know" (Save or
  borrow, Your state's tax break, School before college); "How fast prices rise" stays in "Good to know". They were first
  built as rows of "Good to know"; the browser check (qa/first-view.mjs) then found the first screen at 143 words and 13
  figures against its entry of 140 and 12 (the base measured 138 and 12): the shortened first bullet pulled the list,
  with its "$35,000" line, up into the first 844 px. In their own card above it the first screen is 116 words and 12
  figures (entry lowered to 120), and the what-ifs sit next to the answer they change. All are kind `item` like the row
  that was there, so they are not counted against R12's five parts (the first-view check's S2 leaves items out); with one
  child the page has five rows in all, each further child adds its own row in its own card.
- Each saves only its own fields and keeps only itself open after a save (R17); its green line is inside it, where the
  Save or the chip was tapped, and names the new answer in a few words, the full sentence staying under it (R7; critic q4
  P2: the green line had repeated the whole answer, nine lines for two children, right above the same words). The other
  saves on the page (a child's college, the growth row) still say theirs at the top, as before.
- Shut, each says what it holds where it can (critic q4 P1): "Save or borrow · about even", "Your state's tax break ·
  Texas: none" for the family. Those four words are all the first view had left (Node 180 of its entry's 180; the first
  phone screen 120 of 120), so School before college says nothing until an amount is picked.
- Their Saves are outlined (critic q4 P4): two rows open at once had two filled Saves on one screen. The page's older rows
  (a child's "Type of college and share to cover", "How fast prices rise") keep their filled Save, as before this work.
- Invariance: `compute()` and `educationTarget()` give the same bytes with the four new fields set or absent, over the
  fixtures, the round-8 household in college and every `qa/households` archetype, at two dates (module test
  "invariance"); and the same bytes as at 81a5288, the commit this work started from (a one-off comparison of 54 plans
  and dates, in the builder's log).
- First view: 190 words before (the counts file's entry), 180 after (entry 180; 176 before the two statuses), figures 14
  before and after; no box, tile or filled button added. In a browser at 390 x 844 (family): the first screen 138 words and 12 figures at 81a5288,
  120 and 12 now (116 before the two statuses); every row taps open and shut with 0 px moved, 44 px tall, the tallest open
  row 713 px (Save or borrow),
  nothing stored changes, nothing wider than 320 px.
