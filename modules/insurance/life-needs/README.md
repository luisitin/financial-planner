# Life insurance needs  (`insurance/life-needs`)

**Status:** usable (phase 8)
**Purpose:** How much life insurance each adult needs if they died this year, against the cover on the Policies page: the plan's own answer for a couple, the children's own for a single parent, and two rules of thumb.

## Inputs
`household` (adults, children's birth dates), `accounts` (savings, debts, the mortgage), `debts`, `income` (pay), `expenses` (what the household spends now), `goals` (education goals: the Education page's own pattern, `goals/education` `EDUCATION_GOAL`, a name with college, university, school, tuition, education or 529, or the 🎓 icon; not one naming an adult), `retirement` (the plan, contributions, Social Security), `assumptions`, `insurance.policies` (life cover in force). Writes nothing. Heavy: the plan is run about thirty times per adult, on the PC when connected.

## Outputs
`compute(plan, { today })` -> `{ ready, missing, people[], children[], startYear, spendingYearly, unassignedCover, unplanned[] }`; `unplanned` `[{ id, name, pay, cover, coverWork, birthDate }]` are the adults the plan cannot run for (no birth date): the page shows what is on file for them and what to add. Each person:
`{ id, name, age, pay, cover, coverWork, survivorName, survivorMissing, plan, child, dime, lifetime, need, method: "plan"|"child"|"dime", gap, spare, gapIfJobEnds, jobEnding, dependants, termUntil, endsSoon, endSteps (a couple's or the rule of thumb's `endsSoon` by date, the same day added up; null for a single parent, whose are `child.endSteps`), gapAfterEnd, raise }`; `survivorMissing` `{ id, name, birthDate }` names a second adult whose own plan cannot be built (no birth date).
`plan` (couples only): `{ need, gapYears: [{ year, amount, benefits }], firstGap, benefits: { childMonthly, parentMonthly, familyMaxMonthly, childUntil }, withCover: { success, failAge, failYear }, survivorRetireYear, survivorPay }`.
`child` (a single parent only): `{ children, costs, childcare, share, benefits, benefitsCounted (what of them pays the children's costs and college), benefitsSpare (the rest, kept for the children), kidsShort, benefitMonthly (the first month's), benefitUntil, benefitSteps: [{ monthly, until, who }], familyMaxMonthly, noRecord, college (as counted: discounted, less what is set aside), collegeParts: [{ id, name (null: no goal), from: "goal"|"planner", for, gross (today's dollars), saved, amount (as counted), tied, partial, figures: [{ name, amount, full (as the Education page shows it), share }] }], collegeKids: [{ name, year (turns 18), gross, value }], collegeLeftOut: [{ name, why: "none"|"share" }], collegeOthers: [{ id, name, for, why: "grown"|"nobirth" }], untiedKids, debts, funeral, savings, net (before the floor at 0), total, years, byYear: [{ year, months, childcare, share, benefits, discount }], fromMonth, realDiscount, childcareMonthly, childcareFor, childcareUntil, careSteps: [{ monthly, until, lastYear, who, ended }], childcareLines, restYearly, shareNow, shareSteps: [{ monthly, fraction, until, who }], perChild: [{ name, costs, childcare, share, college, benefits, counted, short, spare }] (each child's own), shown (`shownChild`: the parts as shown, to the $100, sums from the shown parts: { kids: [{ name, costs, college, benefits, counted, short, spare }], costs, college, benefits, counted, short, spare, debts, funeral, savings, rest, net }), need (today's figure, `childFigure`), today (the same), needByYear: [{ year, need, net, total, kidsShort, costs, college, benefits, benefitsCounted, debts, savings, children, priceLevel, dollars (need x priceLevel: that year's dollars), coverInForce (the cover on file that still pays for a death at any time in that year, `coverIn`, review 2026-11-06), coverWorth (coverInForce / priceLevel: today's dollars), short (need - coverWorth, at least 0) }] (the need for a death at the start of each year, now to the children's needs' end), peak: { year, need } (the largest in today's dollars, the earliest year of it), sized: { year, need, real, priceLevel } (the largest in that year's dollars, rounded up to $1,000: the cover to buy, sixth pass), steady (the need never rises from one year to the next), rising (no dip of `SHAPE_TOLERANCE`, 2% of the peak, or more before the peak), needEnds: { year, who, event: "college ends"|"turns 18"|"turn 18" }, and with term life insurance that ends before the need does (`endsSoon`) afterEnd ({ year, need, real, priceLevel, cover, most }: the year after cover ends that is short the most in that year's dollars, its need rounded up to $1,000, the cover still paying then, and whether that need is also the largest of those years), coveredUntilEnd, coverStays (the cover with no end before the need's) }` (`childNeed()`, `childSeries()`; `collegeValue(amount, birthDate, startYear, realDiscount)`; `collegeLeft(year, start, years)`; `collegeWords(child)`: "college", or "Child 1's college" when some child's is not counted). For a single parent `need` is `sized.need` and `termUntil` is `needEnds` ("Child 1's college ends"). `inDollars(s)`: ", in that year's dollars" after a figure for a later year whose prices are above today's.
`termYears(untilYear, startYear)`: the shortest of `TERM_LENGTHS` (10, 15, 20, 25, 30 years, the lengths most companies sell) that lasts until the year, else 30.

## Formulas
All in today's dollars.

**1. The plan's own answer (a couple).** The survivor's plan is `scenarios/stress-tests` `survivorInputs()`: the one who died loses their pay, retirement saving and Social Security record; their accounts pass to the survivor; spending is `SURVIVOR_SPENDING` (75%) of the couple's; the survivor's Social Security is the larger of their own and the survivor amount; filed single, or head of household with children. Spending is held level in real terms (fixed-real) for the search, whatever the plan's own strategy. On top:
- the funeral, `FUNERAL` ($8,300, NFDA 2023 median), this year;
- each year before the survivor retires, the living costs their pay does not cover: `max(0, expenses a year x 75% - (survivor's pay x TAKE_HOME 75% - survivor's own retirement saving) - family Social Security)`. A year with money left over adds nothing (it is not counted as saved: conservative).
- Family Social Security on the deceased's record (their full-retirement-age amount, PIA, stands in for the survivor computation): each child under 18 gets 75% of the PIA, the parent caring for a child under 16 gets 75% (SSA, "Survivors Benefits", publication 05-10084); the total is capped at the family maximum and shared out pro rata; then the parent's benefit loses $1 for every $2 of pay over `earningsTestExempt(the plan's first year)` ($24,480 in 2026, $25,560 in 2027; a later year holds the newest; ssa.gov/oact/cola/rtea.html, read 2026-10-31). A year's share runs to the month of the 18th / 16th birthday.
- Family maximum = 150% of the PIA up to b1 + 272% from b1 to b2 + 134% from b2 to b3 + 175% above b3, floored to the dime; b1, b2, b3 = $230, $332, $433 x AWI(year of death - 2) / AWI(1977), rounded (Social Security Act 203(a); SSA POMS RS 00615.736 B.1 (TN 57, 12/14/2023); ssa.gov/oact/cola/familymax.html, read 2026-10-31). 2026: $1,643, $2,371, $3,093.
- The need is the smallest lump sum, paid this year into savings, with which the survivor's plan lasts to the end (`goal-seek` `smallestWhere`, to $50, shown rounded up to $1,000). If the plan with both alive already runs short, the survivor's plan must last at least as long as that one.

**1b. A single parent (method "child").** For an adult with pay when there is no other adult in the household at all and
at least one dependent under 18. (A second adult whose plan cannot be built, say with no birth date, keeps the rule of
thumb and `survivorMissing` says what to add: the children are not left alone, so their answer would leave that adult out.)
All in today's dollars, counted **month by month from today's month** (`fromMonth`: the months of this year already gone are
spent) and discounted a whole year at a time at the real bond return `(1 + bonds)/(1 + inflation) - 1`. A child counts until
the month before their birthday month (the 18th for costs and Social Security, the 13th for childcare), as `shareUnder` does.
`childNeed()`:
- **Costs until 18** = childcare + share, each month until the youngest is 18:
  - childcare: the Expenses lines whose category is `childcare` ("Childcare and school") or whose name says daycare, childcare,
    child care, nanny or after-school. They are split equally between the children under `CHILDCARE_UNTIL` (13) in the first
    month counted, and each child's part stops the month they turn 13; a line with an end date stops after its month. Per
    month: `sum over lines of line monthly x (children of those still under 13) / (children under 13 at the start)`. The lines
    always come out of the shared spending, so a child of 13 or over has no childcare (an older child never gets a bigger
    answer than a younger one). A child's own part is the line divided by the children under 13 today; a later year of the
    need keeps that split (each child may carry `care`, their part). The page says it from the same months (`careSteps`: each run of one monthly amount, and what
    ends it): "$2,900 a month until the Nanny line on Expenses ends in 2027, then $900 a month until Cal turns 13 in 2028,
    then $600 a month until Ava and Ben turn 13 in 2033", never the full monthly total with a date it does not last to.
  - share: the children's part of the rest of the household's spending, `(spending - childcare) / 12 x n/(n+1)` a month, n the
    children under 18 that month (the parent's own part, 1/(n+1), stops). The page says its steps like childcare's
    (`shareSteps`): "two thirds of it, about $1,947 a month until Child 2 turns 18 in 2037, then half, about $1,460 a month
    until Child 1 turns 18 in 2040".
  - spending is the Expenses total less the payments on the debts the cover pays off (every debt but a mortgage: their payments
    stop with them).
- **less Social Security for the children** on the parent's record, each month `min(75% of the PIA x n, family maximum)` (SSA,
  "Survivors Benefits", publication 05-10084; the family maximum sourced below, for the year of death), month by month so the
  maximum binds only in the months it should; no parent's benefit (no surviving parent is in the plan to care for them);
  discounted alike. `familyBenefits` (the couple's yearly figure) is not used here and is unchanged. `benefitSteps` list the
  amount as it falls when a child turns 18 ("about $3,900 a month until Ava turns 18 in 2034, then about $1,950 a month until
  Ben turns 18 in 2041"); months of the same amount are one step (under the family maximum a child turning 18 can change
  nothing: four children on a $2,430 figure read "about $4,524 a month until Ben turns 18 in 2035, then about $3,645 ...").
  **Each child's Social Security is that child's money**: a representative payee must spend it on the child or save it
  for them (SSA, "A Guide for Representative Payees", publication 05-10076), so it pays only that child's own costs and
  college, never another child's, the parent's debts or the funeral (those fall on the estate, and the funeral is due at
  once). Child by child (`perChild`, fifth pass): their costs (their part of each childcare line, their 1/(n+1) of the rest),
  their college, their benefits (1/n of the month's benefit: each child gets 75%, cut pro rata by the family maximum);
  `short = max(0, costs + college - benefits)`; `kidsShort` = the sum of the children's shorts; `benefitsCounted` = what
  of each child's benefits pays their own costs and college, `benefitsSpare` the rest (kept for each child, not counted).
  Each child's college is their share of each college part (a part's amount less what it has set aside, shared out in
  proportion to what each child's share of it is worth, so the parts add up as before). The page lists the children's own part first (costs, college), then Social
  Security at what it counts, then the debts and the funeral. When Social Security covers more than the costs it says "the
  rest is Child 1's money too, so it goes toward the college above"; when it covers the costs and college too: "That is
  about $672,400 in all, more than the children's costs until 18 and college: those are covered, and the other $146,700 is
  the children's money, kept for them, so it does not go toward the debts or the funeral", and the total line: "Social
  Security covers the children's costs and college; the debts and the funeral still need $12,300, less the $1,900 saved:
  about $10,400, rounded up to the next $1,000". When the children differ (one covered by their own Social Security, one
  still short), it says it child by child: "That is about $431,700 in all, but each child's is that child's own money: it
  pays only that child's costs and college. Child 1's (about $279,100) covers Child 1's costs until 18; Child 1 still needs
  $53,400 for college. Child 2's (about $152,600) covers Child 2, and the other $59,100 is kept for Child 2. One child's money
  never pays another's costs, the debts or the funeral." With no Social Security figure for the parent (no PIA), nothing is
  subtracted (`noRecord`) and the page says to add it.
- **plus college**, once for each child under 18, whatever the order of the goals. The education goals: the Education page's
  own pattern (`EDUCATION_GOAL`, exported by `goals/education`: a name with college, university, school, tuition, education
  or 529; "Child 1 529" is the child's college goal, as the Education page treats it), or the 🎓 icon; not one naming an
  adult (their own degree ends with them; "degree" alone is no longer read as education, as the Education page does not).
  Whose a goal is follows the Education page's tie (`goals/education` compute: the child's name in the goal's name **as a
  whole word, case-insensitive** (`namesPerson`: "Ed's college" is Ed's, "Education fund" is not, nor is "University fund"
  Ty's), or, for a lone dependent, the first education goal that names nobody else in the household, fifth pass).
  - A goal with an amount covers the child under 18 it is tied to; one tied to no one covers the children under 18 no goal
    with an amount is tied to (all of them when each one is: a lone child), its amount shared equally between them.
  - A goal for a dependent who is 18 or over, or has no birth date (tied to them on the Education page, or naming them), and
    for no child under 18, is theirs: it is not counted for the minors and the College line names it ("“Mia college” is not
    counted: it is for Mia, 18 or over, and this answer is for the children under 18"; `collegeOthers`). Only the minors'
    college years are said.
  - Every other child under 18 gets the Education page's figure: `totalToday` in today's dollars **as that page shows it**, to
    the $10 (`shownAmount`, the function the Education page itself formats with: "$120,110"), x the share chosen there (the
    page says both: "$120,110 (50% of it counted, the share you chose there: $60,055)"), less what a goal with no amount tied
    to them has set aside (`saved`; a goal with no amount tied to no one, Get started's one "Education" goal, stands for all
    of them). With no education goal at all the figure still counts: a parent's death does not cancel college. The page
    names it as the Education page's figure, with "Change it on Education".
  - A child the Education page has no figure for (or none of whose college you chose to pay there) is left out and named
    (`collegeLeftOut`); no sentence on the page or the Dashboard says that child's college is covered ("Child 1's college",
    `collegeWords`).
  - Each child's part is **discounted like the costs**: `collegeValue` = amount x (1 + real bond return)^-(the year the child
    turns 18 - the plan's first year), whole years, 0 for a year already reached; what is set aside comes off at face value,
    like savings. "In today's dollars" means today's prices everywhere on the page (the costs, the Education page's figure);
    the total line says once that a cost years away counts for a little less because money set aside now grows that much
    faster than prices ("about 1% a year": 1.04 / 1.03 - 1 = 0.97%).
- **plus debts** (every liability but mortgages and home-equity lines) **and a funeral** (`FUNERAL`).
- **less savings that pass to the child**: cash and taxable investment accounts (`ACCOUNT_TYPES` taxBucket "taxable": checking,
  savings, cash, brokerage, crypto) and 529 plans (already the child's college money). Retirement accounts are left out.
- total = max(0, net), **net = sum over the children of max(0, that child's costs + college - that child's Social Security) +
  debts + funeral - savings** (`net` keeps it before
  the floor: the page says "Social Security and the savings come to about $250,700 more than all of this, so no cover is
  needed", or, when Social Security covers the children's part, "the savings come to about $X more than the debts and the
  funeral", rather than a $0 the parts do not add up to), rounded up to $1,000 as the plan's answer is.
- **Shown parts always add up** (fifth pass, `shownChild`): every part is shown to the nearest $100 (each child's costs,
  college and Social Security; debts, the funeral, savings), and every sum or difference on the page and the Dashboard is
  worked from those shown parts, never rounded again on its own: the counted Social Security is min(shown benefits, shown
  costs + shown college), the spare is shown benefits - shown counted (513,400 - 440,200 = $73,200, not a separately rounded
  $73,100), "about $X" is the shown parts added up. The answer is that sum rounded up to $1,000 (`childFigure`), so the
  page's own arithmetic always lands on its figure (two children whose exact parts add to $437,032.64 show $436,900 and need
  $437,000). The Education page's figure is quoted to the $10 as that page shows it; when nothing is discounted (a child
  turning 18 this year) the College line says why it reads $100 rounder ("That is about $104,900 here, to the nearest $100
  like every part of this answer").
- **The need over time** (fifth pass, `childSeries`, `needByYear`): the same answer worked as if the parent died at the
  start of each year from now until the children's needs end, in today's dollars. Year 0 is today's answer (from today's
  month); each later year counts from January of that year with the children that much older: costs, childcare and Social
  Security only for the months still under 18 (13), the childcare lines split as today's answer splits them (one child's
  part never grows when another turns 13), each child's college discounted from their 18th year to that year and only the
  college years not yet begun (`collegeLeft`: all of it until college starts, then the years still to come: 3/4 in its
  second year), the family maximum for that year of death. The debts are on the payoff plan's schedule (`debt/payoff`, the
  same months as Net worth over time) and the savings that pass are the cash and taxable accounts as the retirement
  projection grows them plus 529 plans as Net worth over time grows them, at the start of that year, divided by the plan's
  price level for the year before (today's dollars); spending, pay, the Social Security figure and the goals are as today. The
  series runs to the last year with anything left for a child: the youngest's last college year (the Education page's
  first year and years of college), or the year a child with no college counted turns 18.
  **The cover to buy** (sixth pass, `sized`): a level term policy pays the same dollars every year while prices rise, so
  a later year's need has to be multiplied back up by prices: cover = max over the years of (that year's need, as listed,
  in today's dollars x the plan's price level for that year, `priceAt`: the same index the series divides by, the retirement
  projection's price level for the year before, 1.03^(year - 2027) at the default 3%), rounded up to $1,000; the earliest
  year of the largest is named. The sample: today's $150,000 is the largest in today's dollars, but 2040's $125,000 is
  125,000 x 1.03^13 = $183,566.71 in 2040's dollars, so $184,000 (a $150,000 policy would be worth about $102,100 then:
  $22,900 short). twoss $184,000 x 1.03^10 = $247,280.61, so $248,000; twossrich $222,000; leftout $184,000; Ed and Ann
  $100,000 x 1.03^12, so $143,000. A need largest today that only falls keeps today's figure. The headline, the card, "How
  to get it", Next best action and Needs attention quote it with its year ("That is the most the children would need, if
  Jo died in 2037, in that year's dollars. Today it would be $11,000"); the year list stays in today's dollars, the year the
  cover is sized to marked with its figure in that year's dollars, and "For how long" says once, plainly: "A policy pays the
  same dollars every year while prices rise, so it is sized to the most in that year's dollars: about $184,000, if Jo died
  in 2040." Cover on file is checked year by year the same way: its payout / that year's price level, in today's dollars,
  against that year's need (`coverWorth`, `short`), counting only the cover still in force that year (`coverInForce`,
  review 2026-11-06); `gap` = need - cover, the level cover still to buy so that every year
  is paid (twoss with $200,000: worth $148,818.78 in 2037 against $184,000, so $48,000 more, not "covered"; with $180,000,
  $68,000, raised on Needs attention, not "close to covered"; with $250,000, covered every year). As for every method, the
  figure is rounded up to $1,000 before the cover is taken off.
  **Cover that ends** (`endsSoon`, sixth pass; review 2026-11-06): for a single parent, every policy that does not last
  until the children's needs end, however far off (a couple: by next year). A policy counts in a year only when it pays for
  a death at any time in it: no end date, or ending on or after December 31 of that year (`lastsYear`, `coverIn`). What is
  needed after it ends is `afterEnd`: the year short the most in that year's dollars (each year's need less the cover still
  in force then), rounded up to $1,000, less only the cover still paying then (`afterEnd.cover`: what stays for good, or a
  later policy not yet ended), so `gapAfterEnd` = afterEnd.need - afterEnd.cover: never "less" a policy that will be gone, and
  never the whole series' figure "from then" when a smaller year follows (a child turning 18 now with $150,000 ending
  6/30/2027: today's $116,000 is covered, after it ends the most is 2027's $89,000). The page says it with its year:
  "Covered until 6/30/2027, when $200,000 of it ends; after that short by up to about $248,000 (the most Child 1 and Child 2
  would need, if Jo died in 2037, in that year's dollars)", and "Covered until" only when the cover pays each year's need
  until it ends (`coveredUntilEnd`).
  `termUntil` (single parent) is when the need ends: the youngest's college ("until about 2044 (Child 1's college ends)"),
  or 18. "For how long" says when the need is largest in today's dollars and when it ends; it says the need gets smaller only
  when it does every year (`steady`), and grows for a while only when it never dips before its largest by
  `SHAPE_TOLERANCE` (2%) of the largest or more (`rising`, sixth pass: three children whose need goes 155,000, 154,000,
  153,000 before 2034's 180,000 grow for a while; twoss, 11,000 down to 7,000 before 184,000, goes down first); every year
  is listed in a fold. When every year is 0 the family is covered.

**2. DIME.** Debts (every liability but mortgages and home-equity lines) + final expenses (`FUNERAL`) + Income (the person's pay x years until the youngest child turns 18; none without children) + Mortgage (owed) + Education (the education goals' target - saved: the Education page's pattern or the 🎓 icon, not a goal naming an adult; only with children). For a single parent it counts the same goals as the children's answer (fifth pass): not a goal that is a grown dependent's (`collegeOthers`), and its note names that goal ("Like the answer above, neither counts “Mia college”: it is for Mia, not the children under 18").

**3. Lifetime earnings (human life value).** For each year until the person's retirement age: pay x `TAKE_HOME` x (1 - `OWN_SHARE`), where `OWN_SHARE` = 1 - `SURVIVOR_SPENDING` is what they spent on themself; grown at the real pay growth `(1 + salaryGrowth)/(1 + inflation) - 1` and discounted at the real bond return `(1 + bonds)/(1 + inflation) - 1`, paid at the start of each year.

**Verdict.** `need` = the plan's answer when there is one, else the single parent's answer (the largest year of it in that year's dollars, `sized`), else DIME (one adult whose
dependents are all 18 or over: a grown child, a parent). `gap` = max(0, need - life cover in force on that person); `spare` the other way (a single parent's with cover that ends: the least of cover - need and afterEnd.cover - afterEnd.need, review 2026-11-06); `gapIfJobEnds` without the cover marked through work (a single parent's year by year: the largest of each year's dollars less the cover in force then that is not through work, `ifJobEnds`, verification of review 2026-11-06; a couple's or the rule of thumb's: need - the cover not through work that does not end soon, `jobEnding` being the part that does, follow-up of review 2026-11-06). `termUntil`: the youngest child's 22nd birthday year (`SCHOOL_DONE`), else the survivor's retirement; for a single parent, when the need over time ends (the youngest's college, fifth pass).

## One answer first, and the gap outside this page (2026-11-02)
The page opens with one answer: "Ana needs about $212,000 more life cover", who would be short, and how long term life insurance
should last, with "Add a policy you have" (filled when someone is short). Each person's card keeps the need against the
cover and says how the plan's answer is worked out; when the plan holds on its own there is no "$0" tile, only the
sentence. The two rules of thumb (debts, pay, mortgage and college added up; lifetime earnings) are folded under "Two
rules of thumb, for comparison": shown at the same weight they read as rival answers up to seven times higher (they
leave out the survivor's pay, Social Security and savings). "DIME" is no longer on screen.

`protectionGaps(plan, { today })` -> `[{ id, name, need, cover, gap, depends, termUntil }]`: the earners whose gap is
`MIN_GAP` ($10,000) or more. It works nothing out unless someone has pay and there is a child or a second adult. Next best
action's protection step and Needs attention's `life-cover-<id>` item read it.

Review fixes (2026-11-02):
- Everyone marked Dependent still counts, a grown child or a parent too: the review proposed counting only children, and
  the verifier refuted it (the role says they depend on the pay).
- `termUntil` is never a year already past (it said "until about 2022" when the youngest was 26); it falls back to the
  survivor's retirement or nothing.
- The rule of thumb is rounded up to $1,000 like the plan's answer, and is worded as a rule of thumb ("a common rule of
  thumb puts what Cy would need at about $1,530,000"), never as "more than the plan holds".
- Term life insurance that ends by next year, before the need ends (`endsSoon`), still raises the step: "Ana's term life insurance ends
  1/15/2027: Bo and Cy would then be about $212,000 short" (`gapAfterEnd`).
- A life policy saved for "Household / everyone" names nobody: `unassignedCover`, a notice here and a sentence in the step
  ("pick who it covers there and it counts"), rather than guessing whose it is.
- Kept although the verifier called them minor or intended (they correct wording, not figures): the rule-of-thumb wording
  above, "income" for a survivor with no pay, and the page's headline using the Dashboard's rule below.
- `raise` is the one rule for the Dashboard, Needs attention and this page's headline (someone lives on the pay, gap of
  `MIN_GAP` or more). A smaller gap, or one with no pay to replace (a retired couple), reads "Close to covered" with the gap
  said plainly. "Sam's pay" says "income" when the survivor has no pay; the fold says "A rule of thumb" when it holds one.
- `protectionGaps` returns the words too (`title`, `sentence`, `who`, `whose`): Next best action, Needs attention and the
  setup's moves show the same sentence, and the setup's default names read "you", "your spouse" ("Get life insurance on
  yourself"), never "Me" or "My spouse" (`sayName`, `sayWhose`).

## Single parent (2026-11-02)
The single parent's page said "a common rule of thumb (debts, Jo's pay until the youngest is 18, the mortgage and college
added up) puts what Child 1 would need at about $862,000": DIME, with no Social Security for the child, college $0 (the
Education goal had no amount) and the mortgage named for a renter. It now works out what the children would actually need
(method "child", above). The sample single parent (Jo, $62,000, renter, Child 1 born July 2022, Social Security $2,430 at
full retirement age, today 2026-11-02): costs until 18 $313,070.51 (childcare $89,494.48: $900 a month November 2026 to June
2035; Child 1's half of the rest $223,576.03: $1,460 a month November 2026 to June 2040) plus college $104,914.03 (the
Education page's $120,110, as it shows it, counted from 2040 when Child 1 turns 18: 120,110 / (1.04/1.03)^14 = 120,110 /
1.144844) less Social Security $279,087.20 ($1,822.50 a month, the same months; it is less than the costs and college, so all
of it counts) = $138,897.34, plus debts $4,000 and a funeral $8,300, less $1,900 saved = $149,297.34, so about $150,000
(DIME: $862,000). The DIME and lifetime-earnings figures stay, folded, as rules of thumb.
- `protectionGaps` says it part by part, only the parts above zero: "No life insurance on Jo: Child 1 would need about
  $150,000" / "If Jo died, Child 1 would need about $150,000: their costs until 18 ($313,100) and college ($104,900) less
  Social Security for Child 1 ($279,100), plus debts ($4,000) and a funeral ($8,300), less the $1,900 Jo has saved. Term life
  cover on Jo until about 2044 (Child 1's college ends) is the usual way to buy it." (parts to the nearest $100; several children:
  "the children's costs until 18", "Social Security for the children", as the page names them; Social Security covering the
  children's part: "Social Security for the children covers their costs until 18 and college; that leaves debts ($4,000) and
  a funeral ($8,300), less the $1,900 Jo has saved"; with cover on file: "Jo's life cover is about $X short").
  Next best action, Needs attention and the setup's move read these words unchanged.
- The rule of thumb's sentence (one adult, grown dependents) names only its parts above zero: no "mortgage" for a renter, no
  "college" with none planned, "a funeral" always; the page's own label for it says the funeral too ("debts and a funeral
  added up", "Debts, pay and a funeral added up").
- The page: the card shows the need against the cover ("costs until 18, college and debts"), "How it is worked out" part by
  part with the Social Security line ("On Jo's record Social Security would pay Child 1 about $1,823 a month until 2040. This
  is in the answer."; several children: each step as one turns 18), the rules of thumb folded. For anyone whose gap is raised,
  a filled "How to get it" in the hero opens a card (a local toggle, nothing saved): a level term policy for the gap that lasts
  until `termUntil`, the term to ask for (`termYears`: "ask for a 20-year term"); check cover through work first, or, with cover
  through work on file, that it is counted but ends with the job and what keeps the children covered after a job change
  (`gapIfJobEnds`: "Buy at least $88,000 now; $150,000 keeps Child 1 covered even after a job change. Jo's $62,000 through
  work is counted, but it ends with the job."); two or three quotes from an independent agent or an online quote site. With a
  child under 18, who to name: a single parent names a trust or a custodian under the state's Uniform Transfers to Minors Act
  (UTMA) and a guardian; a couple names the other parent, with the trust or custodian for the children as the backup ("Name Bo
  as the beneficiary. As the backup for Cy, name a trust or a custodian under your state's Uniform Transfers to Minors Act
  (UTMA): a child under 18 cannot receive the money directly."; the couple's answer is the survivor's money). Links to
  Documents checklist and Beneficiary audit (the titles of the pages they open). "Add a policy you have" is outlined beside it.
- Nobody short: a single parent reads what pays for it ("If Jo died, Social Security for Child 1 and the $401,900 Jo has saved
  would cover Child 1's costs until 18, college, debts and a funeral."; "No extra money needed: Social Security and savings
  cover what Child 1 would need."), not the couple's "the family's plan stays on track if one of you died". When Social
  Security alone covers the children's part, it says which pays what ("Social Security for Child 1 and Child 2 would cover
  their costs until 18 and Child 1's college, and the $40,000 Jo has saved would pay the debts and a funeral. Child 2's
  college is not counted: the Education page has no figure for Child 2 yet.").
- Choices: the mortgage is not added (the home's cost is already in the spending the children share; paying it off too would
  count it twice); retirement accounts are not subtracted (tax comes off on the way out, and leaving them out is the careful
  side); childcare stops at 13, the age of a qualifying child for the child and dependent care credit (IRC 21(b)(1)(A)), and
  only for children under 13 now; no price is shown (no rate table the plan can stand behind); months, not days (a child turning
  18 later this month counts nothing more).
- The couple's answer ("plan") is untouched: compute and `protectionGaps` are identical to before for every couple in the
  fixtures and the `qa/households` cases (2,001 adults in 1,402 plans, the family fixture among them).

Second review (2026-11-02): an older child got a bigger answer than a younger one (the childcare lines stayed in the shared
spending when no child was under 13 on January 1); the first year counted all twelve months on November 2; a household with a
second adult with no birth date got the children's answer; the family maximum was applied to a year's average in the year a
child turned 18; a childcare line with an end date shared by two children was overstated; the Social Security line said the
first amount lasted until the last child turned 18; college dropped out for two children with Get started's one Education
goal (the page could say "covered"); couple's words on a single parent with nothing short; a couple told to name a trust
instead of the spouse; the rule of thumb's label left out the funeral; "How to get it" repeated the work-cover check and gave
no term length or where to ask; its links were labelled unlike the pages they open. All fixed as described above.

Third review (2026-11-02), each fixed as described above:
- College was counted twice for an only child, and the answer hung on the goals' order: a goal with an amount covered no
  child, so Get started's no-amount "Education" goal added the Education page's figure on top ($180,100 instead of $60,000 with
  a "College fund" of $60,000 after it). Now once per child, whatever the order.
- A child with no goal of their own next to a goal tied to a sibling, and a plan with no education goal at all, counted no
  college for that child (the page then said "Work it out on Education" for a figure that page already shows). Now the
  Education page's figure, named, with "Change it on Education"; a child left out is said by name.
- College was the one part not discounted (about $15,000 too much on the sample); now from the year each child turns 18.
- The childcare sentence paired the full monthly total with the last year any childcare is counted when only some lines end
  ("$2,900 a month until 2033, when it ends on Expenses"; only $900 then $600 was counted after 2027). Now each step.
- A child turning 18 this month showed $0 lines ("costs until 18 $0", "Social Security −$0"); now one sentence. The rule of
  thumb said "0 years of pay $3,000"; now "less than a year of pay".
- "Cover needed $0" under parts adding to −$235,500; now it says by how much Social Security and the savings come to more.
- Social Security larger than the costs is now explained (the rest is the child's money and goes toward college and debts);
  repeated amounts are one step; the Dashboard's sentence names the child ("Social Security for Child 1") as the page does.
- The missing birth date note has an "Add it on People" button; the job-change and couple's beneficiary sentences are plain.
- Reported, not changed here (other pages): Needs attention says "Estate documents keeps track of the will and the guardian"
  (overview/alerts); the Beneficiary audit's older "Documents" button opens "Documents checklist".

Fourth review (2026-11-02), each fixed as described above (sample unchanged at $150,000; the couple's figures unchanged):
- The children's Social Security paid the parent's debts and funeral: two children whose benefits came to more than their
  costs and college read "no cover is needed" when $10,400 was. It now nets only against the children's own costs and
  college; the page and the Dashboard say Social Security covers those and the debts and funeral still need the rest.
- A child's name inside a word tied a goal to them ("Education fund" was Ed's, "University fund" Ty's, Get started's
  "Education" Cat's): the tie is a whole word now, fixed in `goals/education` itself (`namesPerson`), so both pages agree.
- A grown dependent's "Mia college" goal was counted and said under Child 1's headline; it is now left out and named.
- A goal named "Child 1 529" was not an education goal here though the Education page used it: one pattern for both.
- The Education page's figure was quoted to the $100 ("$120,100") where that page shows "$120,110": quoted and counted to
  the $10 through that page's own `shownAmount`.
- The headline said a child's college was covered when it was not counted ("Child 2's college is not counted" below it):
  it now names whose college ("Child 1's college") and says what is not counted.
- "How to get it" told a couple with a missing birth date to buy the rule of thumb's $1,530,000 without saying it was one:
  it now says so, says adding the birth date gives the plan's own answer, and shows what is on file for that adult (a card
  for Bo: pay, cover, "Add it on People").
- The children's share of the spending was said only at today's amount; it now steps as each child turns 18.
- The rules-of-thumb note said they leave out Social Security when this answer counted none, and not that they leave out
  college; it now names what each leaves out for this plan, by name ("the $1,900 Jo has saved").
- "Child 1 grows up" for a child turning 18 this month; now only children still growing up are named.

Fifth review (2026-11-02), each fixed as described above (the sample still needs $150,000, now as the largest of its
years; the couple's figures and page are unchanged):
- Social Security was pooled across the children, so one child's spare paid another's college (two children, Child 2's
  college left out: "covered", $11,000, when Child 1 was $53,400 short: $64,000 today). Now child by child, said child by
  child when the children differ.
- The need grows later for a family whose Social Security pays more than the children's costs (the surplus pays college
  later only if the parent lives): "The need is largest now and shrinks" and a policy sized to today's $11,000 were wrong
  (twoss: largest in 2037, $184,000; twossrich: $0 today, $165,000 in 2037, "covered" before). Now the need over time, the
  cover sized to the largest, "For how long" saying when it ends and never "shrinks" unless it does every year ("grows
  for a while" only when it rises every year to the largest; twoss, which dips to $7,000 first, "goes down for a few years,
  then grows"). The rule of thumb's own "For how long" (a second adult with no birth date) no longer says it shrinks "as
  savings grow": it leaves savings out and gets smaller because fewer years of pay are left to count.
- With one child, the Education page tied the first education goal to that child even when it named someone else ("Mia
  college" for an undated Mia: $80,000 instead of $150,000, and the order of the goals mattered; "Jo's night school" with an
  "Update" button that would have overwritten Jo's goal). Fixed in `goals/education`: the one-child fallback skips a goal
  naming anyone else in the household as a whole word.
- The leftover Social Security was rounded on its own ("the other $73,100" under $513,400 and -$440,200); now every sum is
  worked from the shown parts and the answer is their sum rounded up. A child turning 18 this year read "$104,900" next to
  "the Education page's $104,920" with no reason; now the reason is said.
- The rule of thumb counted a grown dependent's college ("education $73,000" with Mia's $26,000) that the answer leaves out;
  now the same goals, and its note names the one left out.
- A second adult with no birth date: the headline gave a firm figure ("Jo needs about $862,000 more life cover") that "How
  to get it" said was not known yet; it now reads "..., by a rule of thumb until Sam's birth date is in".

Sixth pass (2026-11-05), each fixed as described above (the couple's method, figures and page are unchanged: compute,
`protectionGaps` and the page's words are identical on the family fixture and on every qa household without a single
parent, 1,304 plans with the review's cases; the 99 single-parent adults in qa/households all have a need that only falls, so their figures stay):
- A level policy was sized in today's dollars though it pays the same dollars every year: the sample's $150,000 is worth
  about $102,100 in 2040 against $125,000 needed. The cover is now the most of each year's need in that year's dollars
  (sample $184,000 for 2040; twoss $248,000; leftout $184,000; twossrich $222,000; Ed and Ann $143,000), and cover on file
  is checked the same way (twoss with $200,000: $48,000 short, not "covered, $16,000 to spare"; with $180,000: $68,000, not
  "close to covered", and Needs attention raises it).
- Cover ending soon with a later peak: How to get it said "$184,000 (... less the $200,000 on file)" and the hero, the card
  and Needs attention "about $184,000 short from then" when 2027-2031 need $11,000 down to $7,000. Now what is needed after
  it ends, with its year, less only cover that stays.
- "For how long" read a $1,000 dip as going down ("goes down for a few years, then grows" for a need that first rises); it
  now reads the shape with a 2% tolerance.
- Words: leftout said the spare goes to college for a child whose college is not counted (now "kept for that child, Child
  1's toward college"); the rules note said undated Mia was not one of the children under 18 (now "who is not counted as a
  child under 18 because Mia's birth date is missing on People"); twossrich's "Today Social Security and savings would cover
  it" (now "If Jo died today, Social Security and savings would pay for everything the children would need").

## Spending that is mostly our guesses (smart guesses C3 UX review, item 7, 2026-11-06)
The needs are worked out from Expenses' spending. When half or more of it is our guesses (Expenses' `guessedShare`, only
on a plan that holds guesses), `protectionGaps` says the needs, gaps and the single parent's parts to two significant
figures (`twoFigures`: $187,400 -> $190,000, $497,500 -> $500,000) and ends the sentence "That rests on our guesses of
your spending: type what you spend first and it firms up." (`RESTS_ON`, `rough: true`; Next best action says it once
for two people). The move and its order stay: the gap is large
either way. Every plan without guesses says exactly what it said before. Test: setup `module.test.mjs` "C3 UX 7 and 12".

## Review 2026-11-06
Fixes for the verifier's report on the sixth pass (life-verm #1 and #2). The couple's method, figures and words are
unchanged (endsSoon stays "by next year" for them), apart from the figure without the job (follow-ups, below); the
figures that moved are single parents with term life insurance that ends.
- **Cover that ends before the children's need counted in every later year (high).** twoss with $300,000 ending
  12/31/2030 read "Your family is covered", "Covered, with about $52,000 to spare" and "the $300,000 on file would be worth
  about $223,200 in today's dollars" for a death in 2037, when that policy pays nothing from 2031; Needs attention and Next
  best action said nothing. Each year now counts only the cover in force for a death at any time in it (`coverInForce`:
  no end date, or an end on or after December 31 of that year), and every policy that ends before the children's need
  does is cover that ends (`endsSoon`), however far off. Now: "Jo needs about $248,000 more life cover", "Covered until
  12/31/2030, when $300,000 of it ends; after that short by up to about $248,000 (the most Child 1 and Child 2 would need,
  if Jo died in 2037, in that year's dollars)", raised on Needs attention and Next best action. The same for $250,000
  ending 3/31/2028 and for the sample with $200,000 ending 12/31/2035 ($184,000 for 2040).
  - The verifier proposed counting a policy for a death on January 1 of the year. It is counted only when it lasts the
    whole year instead: "if Jo died in 2027" means any day of 2027, and the end year has always been one of the years
    after it ends (a child turning 18 now with $150,000 ending 6/30/2027 still needs $89,000 for 2027).
  - Several policies ending at different times: each year counts what still pays then. $100,000 to 2028 and $300,000 to
    2040: 2037 is paid by the $300,000, 2041 is not, so $147,000 for 2041 ("would be up to about $147,000 short"), not
    $248,000. With $150,000 to 2042 instead: $248,000 for 2037 less the $150,000 still on file then, $98,000. With a
    further $20,000 that never ends: $127,000, said "with the $20,000 that stays on file", never "less" it twice.
  - What is spare counts only the cover still on file in each year: $250,000 with no end beside $300,000 ending 2030 is
    $2,000 to spare, not $302,000, and the page names "the $250,000 of cover still on file in 2037". $245,000 with no end
    beside $50,000 ending 2030 is $3,000 short once it ends: "Close to covered", never "Your family is covered".
  - "Close to covered" also covers someone with no pay whose cover ends (a pension in place of pay): "Once Ana's $236,000
    term policy ends on 3/31/2027, Bo and Cy would be about $235,000 short", never "$0 short" or "Your family is covered"
    beside a card that says "short".
  - "Also covers the most they would need" and the "would be worth" lines use the cover in force in that year, and are
    left out when none is.
- **Two kinds of dollars side by side (low).** "Short by about $68,000" sat over "worth about $133,900 in today's dollars,
  against $184,000 needed then". The worth line now says both: "...: about $50,100 short in today's dollars, which is the
  $68,000 more cover in 2037's dollars (rounded up to the next $1,000)."

### Verification (review 2026-11-06)
- **Cover through work beside term life insurance that ends (high).** "Without it ... would be short about $X" counted every
  policy on file for every year, so a policy ending before the children's need still paid in the later year. twoss with
  $100,000 through work and $150,000 ending 9/30/2029 read "Short by up to about $148,000" with the job and "Without it
  ... short about $98,000" without it; with nothing in force from 2029 it is $248,000 for 2037. A single parent's figure
  without the job is now worked year by year like `afterEnd`: `ifJobEnds` = the year where that year's dollars less (the
  cover in force then less the cover through work in force then) is largest, its need rounded up to $1,000 less that
  cover; `gapIfJobEnds` = ifJobEnds.need - ifJobEnds.cover. With no policy that ends it is the same figure as before
  (need - (cover - cover through work)). The notice says the year ("if Jo died in 2037, in that year's dollars") and
  shows only when it is larger than the headline's figure.
- **Several policies that end (medium).** The page named only the first policy to end: $100,000 and $150,000 both ending
  12/31/2033 read "Covered until 12/31/2033, when $100,000 of it ends"; $10,000 ending 2027 beside $300,000 ending 2041
  read "Jo's term life insurance ends 12/31/2027" and "Covered until 12/31/2027" when every year to 2041 is covered; a ladder
  of $150,000 to 2031 and to 2036 said what to buy "after $150,000 of cover ends". `endSteps` lists the policies not
  paying in afterEnd's year by end date, the same day added up: one date reads "Jo's $250,000 of term life insurance ends on
  12/31/2033" and "when $250,000 of it ends"; several dates read "Jo's term life insurance ends in steps, $10,000 on 12/31/2027
  and $300,000 on 12/31/2041" and "$10,000 of it ends on 12/31/2027 and $300,000 on 12/31/2041; after that short by up
  to about $105,000", never "Covered until" the first date; How to get it says "after $300,000 of cover ends" (all the
  steps); Needs attention's title names every date ("ends 12/31/2027 and 12/31/2041").
- **Follow-up: a couple's figure without the job (low).** The same flaw for a couple (and the rule of thumb), whose cover
  that ends is "by next year": Ana with $100,000 through work and $200,000 ending 6/30/2027 got need - $200,000
  ($35,000, the ending policy counted), so the notice and the job-change size were hidden under a card short $135,000
  from then. `gapIfJobEnds` = need - (cover - cover through work - `jobEnding.benefit`), where `jobEnding` is the term
  cover not through work that ends soon (its total, the last end date, how many policies); that is need - the cover not
  through work that stays. Ana: $235,000, and the notice says when: "Without it the family would be short about
  $235,000 once Ana's $200,000 term policy ends on 6/30/2027"; How to get it: "Buy at least $135,000 now; $235,000
  keeps Bo and Cy covered even after a job change." With no policy that ends, the figure and words are as before.
- **Follow-up: cover that exactly meets the need (low).** "Covered, with about $0 to spare" now reads "Covered, with
  nothing to spare" (twoss with $248,000; Ana with $235,000).
- **Verification 8b: a couple's cover that ends by next year (medium, as it was before this review).** The couple's card
  said "Covered until" the first end date whatever the gap today, and named only the first policy to end with its own
  amount: Ana with $50,000 for good and $150,000 ending 6/30/2027 ($35,000 short today) read "Covered until 6/30/2027";
  $50,000 ending 3/31/2027 beside $150,000 ending 12/31/2027 read "Covered until 3/31/2027, when $50,000 of it ends;
  short by about $85,000 from then", though $300,000 still covers the $235,000 until 12/31/2027; $100,000 and $150,000
  ending the same day read "$100,000 term policy". `endSteps` (a couple's and the rule of thumb's) lists `endsSoon` by
  date, the same day added up, as a single parent's `child.endSteps` does. Short today: "Short by about $35,000 now, and
  by about $185,000 once $150,000 of it ends on 6/30/2027." Several dates: the lede, Needs attention and Next best action
  say "Ana's term life insurance ends in steps, $50,000 on 3/31/2027 and $150,000 on 12/31/2027 ...: once it has ended they would
  be about $85,000 short" (title "ends 3/31/2027 and 12/31/2027"), the card "Covered for now: $50,000 of it ends on
  3/31/2027 and $150,000 on 12/31/2027; once it has ended, short by about $85,000." The same day: "$250,000 of term
  cover". One policy with the gap at 0 today reads as before. No figure moves.
- **Not changed: cover that is not a round $1,000.** What to buy is the need rounded up to $1,000 less the cover, so
  $247,500 on file against 2037's 247,280.61 reads "short by up to about $500" when it is $219 over. Rounding the
  shortfall instead would move many figures; left for a later look.

## Edge cases
- One adult with no children: no one depends on the income; only the funeral and debts are shown.
- One adult with a child under 18: the single parent's answer (no survivor plan can be built: the plan needs an adult).
- Two adults, one with no birth date: the rule of thumb, and the page asks for the birth date (`survivorMissing`).
- A child turning 18 this month: named, but no month of costs or Social Security is left to count (one sentence, no $0
  lines); their college counts in full (the year is reached), and the need over time follows their college years.
- Twins whose needs end together are named together ("until about 2043 (Ed and Ann's college ends)").
- A child whose college is not counted ends the need at 18 ("Child 1 turns 18"); one whose college is all set aside too.
- One adult whose dependents are all 18 or over (a grown child, a parent): DIME and lifetime earnings only.
- A grown dependent next to a child under 18 is not counted in the single parent's answer (only the children under 18 are),
  nor is a college goal that is theirs (`collegeOthers`, named on the College line).
- Two adults, one with no birth date: that adult gets a card with what is on file (pay, cover) and "Add it on People"
  (`unplanned`); the other's rule of thumb says it is one, in the headline and in "How to get it".
- No Social Security figure for the one who dies: no family benefits are counted.
- A child still in high school at 18 can be paid to 19; not modelled (conservative).

## Tests
`module.test.mjs`: the family maximum at 2026's bend points, the share of a year under an age, the family's benefits (earnings test, the maximum shared out, grown children), lifetime earnings with and without discounting, not ready, the family's three answers, the plan's answer is the smallest that works (a little less fails), cover through work, a single adult. The single parent, by hand on an invented plan (Pat and Kit): each part (childcare stopping at 13, the n/(n+1) share month by month, discounting, the child's 75% under the family maximum with no parent's benefit, no PIA, college from the goal and from the Education page, an adult's degree left out, savings outside retirement and the 529 subtracted, the mortgage not added, the floor at 0 and the rounding), the words naming only the parts above zero, and the rule of thumb's words for grown dependents. Second review: an older child never gets more (13 judged from today's month), the first year from today's month for every part, a second adult with no birth date, the family maximum month by month and the benefit steps, a childcare line with an end date shared by two children, Get started's one Education goal with two children, the term to ask for. Third review: college once per child whatever the goals' order (one child, two children, a child's own goal beside Get started's), no education goal (the Education page's figure; a 0% share left out by name), college discounted from the 18th year (`collegeValue` and a 10% real rate by hand), the childcare steps with a line ending and twins, the Social Security steps merged under the family maximum, the floor's `net`. Fourth review, by hand: Social Security netted only against the children's costs and college (92,000 + 10,000 against 138,000 leaves 10,300 for the debts and funeral, not 0; 152,000 against 138,000 leaves 24,300; the whole plan with a $3,000 figure needs $7,000) and the words for both, "Education fund" with Ed and Ann and "University fund" with Ty (shared $50,000 each, total 96,966.67), a grown dependent's goal left out (Kit stays $71,000), "Kit 529" counted (65,300, so $66,000), the Education page's figure to the $10 through its own function (and a 50% share, $56,675), the share's steps as each child turns 18. Fifth review, by hand: each child's own Social Security (Pat with Kit and Lu: Kit 69,666.67 short, Lu's 1,083.33 kept for Lu, $66,000 not the pooled $65,000; leftout $64,000 not $11,000), the shown parts adding up ($73,200; 149,300; $437,000 from parts shown as 436,900), the need over time on the sample (2040 $125,000, 2041 $97,000, 2043 $37,000, the largest today's $150,000, the card on its schedule), twoss and twossrich (2037: 65,000 + 111,800 + 8,300 - 1,800, so $184,000; with $21,900 saved $165,000), leftout ($125,000 in 2040), the childcare split kept for a later year and `collegeLeft`, a goal naming Mia (undated, either order, alone) or Jo never Child 1's, the rule of thumb's goals ($47,000 not $73,000; the couple's $86,000 unchanged), and the page itself through a stand-in DOM (the largest year said once, child-by-child Social Security, never "shrinks", the parts adding to "about $149,300", one college figure at 18, "the other $73,200", the rule-of-thumb headline, the note naming “Mia college”). Sixth pass, by hand: the cover in that year's dollars (sample 125,000 x 1.03^13 = 183,566.71, so $184,000 for 2040; twoss $248,000; twossrich $222,000; leftout $184,000; Ed and Ann $143,000; each year's price level 1.03^(year - 2027); a need that only falls keeps $116,000; the couple's $235,000 and $0), said once on the page and with its year in the hero, the tile, How to get it and Needs attention; cover on file year by year (twoss with $200,000: worth 148,818.78 in 2037, 35,181.22 short then, $48,000 to buy; $180,000: $68,000, raised; $250,000: covered every year); cover ending soon (twossend: $248,000 for 2037 after it ends, never "less the $200,000"; a child turning 18 now with $150,000 ending: $89,000 for 2027; $50,000 staying: $198,000); the shape with a 2% tolerance (three children: grows for a while; twoss still goes down first); the words for leftout's spare, undated Mia's note and twossrich's headline. Review 2026-11-06: cover that ends counts only while in force (twoss with $300,000 ending 12/31/2030 and $250,000 ending 3/31/2028: each year's `coverInForce`, $248,000 for 2037 after it ends, raised on Needs attention and Next best action, never "covered" or "to spare"; the sample with $200,000 ending 2035: $184,000 for 2040); the couple's $300,000 ending 2031 identical to one with no end; several policies ending at different times ($147,000 for 2041; $98,000 with $150,000 still on file in 2037; $127,000 "with the $20,000 that stays on file"; what to buy pays every year and $1,000 less does not); spare and "Close to covered" from the cover still on file ($2,000; $3,000); someone with no pay whose cover ends ("Close to covered", never "$0 short"); the worth line in both kinds of dollars ($50,100 and $68,000; $35,200 and $48,000). Verification: without the job, year by year ($100,000 through work and $150,000 ending 2029: $248,000 for 2037, not $98,000; with no end the same $98,000 as before); several policies named with their dates, the same day added up ($250,000 ending 12/31/2033; $10,000 to 2027 and $300,000 to 2041, $105,000 for 2042; a ladder's "after $300,000 of cover ends"). Follow-ups: a couple's figure without the job leaves out cover ending by next year (Ana: $235,000, not $35,000; the work policy itself ending: $135,000; no end: $35,000 as before); exact cover reads "nothing to spare" ($248,000; $235,000; $249,000 has $1,000 to spare). Verification 8b: a couple's cover that ends by next year (short today: "Short by about $35,000 now, and by about $185,000 once $150,000 of it ends", never "Covered until"; $50,000 to 3/31/2027 and $150,000 to 12/31/2027 named in steps, $85,000 once it has ended, on the page, Needs attention and the job notice; the same day $250,000; one policy as before).

## Ideas / not yet
- The couple's need over time (fifth pass, reported, not shown: the couple keeps its method and figures). The same check
  on the family fixture (a death at the start of each year, everyone that much older, the savings grown bucket by bucket as
  the retirement projection grows them and the debts on the payoff plan, both in today's dollars, pay and spending as today):
  Ana $235,000 now, then $222,000 (2027), $213,000, $205,000, $196,000 (2030), $160,000 (2031, the car loan and the card
  gone), $150,000 ... $96,000 (2037), $84,000 (2038) ... $48,000 (2041): it falls every year, so the couple's "largest now
  and shrinks" holds there. Bo needs $0 every year. Held at today's balances instead (no saving after today), Ana's rises
  every year, to $505,000 by 2042, and Bo's from $6,000 in 2033 to $182,000: the couple's answer leans on the plan's own
  saving, which the page could say.
- A laddered term (two policies ending at different years) sized from `needByYear`.
- Stay-at-home parent: the cost of replacing their unpaid work (childcare, housekeeping).
- Child benefits to 19 while in high school; the survivor's widow(er)'s benefit from 60 before retirement.

Review 2026-11-06 (round 7): `sayName` / `sayWhose` are now core/words.js's `nameIn` / `nameOf` (so "My husband" and "My wife" read "your husband", "your wife's" too), and every sentence on the page that used a raw name says you/your for the unnamed first adult ("Me") and "your spouse" for the setup's "My spouse": the run-out age, "How it is worked out" ("Your savings pass to your spouse", "Before your spouse retires"), the lifetime-earnings rule ("what you would have spent on yourself"), Social Security for the family ("On your record ...", "because your spouse earns"), the survivor's "your pay and your savings" (it read "you's pay"), a couple's ending cover ("Your $300,000 term policy ends"), the missing-birth-date notes, the hero for two people ("You and your spouse need more life cover") and "Name yourself as the beneficiary". Typed names read as before. Words only: no figure or rule changed. Test: "the first adult left unnamed ("Me"): sayName and sayWhose are core/words.js's ...".

## Round 8 (2026-11-06): a plan short either way, and federal student loans (item 14, couple-home-4)
- When the plan with both alive fails anyway, the survivor's plan passes when it lasts as late a calendar year (as before)
  or as many years of retirement, each from its own retirement start: ok(lump) = success, or survivor's failYear >=
  household's failYear, or (survivor's failYear - survivor's retireYear) >= (household's failYear - household's retireYear).
  Either measure is "doing as well", so the change only ever lowers a need (a survivor who retires later than the household,
  as in the qa blended family, is not asked for more). It compared calendar years only: Tom alone retires in 2060, two years before the household's
  plan starts drawing in 2062 (Priya's retirement), so "fail no earlier than 2062" asked $28,000 of cover for two years the
  survivor's plan never had to carry, while every living-cost gap (`gapYears`) was $0 and nobody else depends on them.
- And with no children and every `gapYears` amount at $0, the need is 0 outright: what is short is retirement itself,
  whoever lives (a funeral the survivor's pay absorbs). `plan.eitherWay: true` marks a plan that fails anyway.
- Couple-home (plan-after-setup, 2026-11-06): Priya 28,000 -> 0, Tom 0 -> 0; no protection gap, so Next best action's
  "Protect the people who count on you" is gone and the first move is not life insurance.
- The page never says "on track" next to a plan that runs out: "No life cover needed for this: your plan is short for
  retirement either way, whoever lives.", "With or without cover, Tom's money would run out at about 65, and so would your
  plan together: it is short for retirement either way. Will the money last? shows what fixes it", the headline "No life cover needed now" (not "Your family is covered" when no policy is on
  file) over "Your plan is short for retirement either way, whoever lives, so life cover would not fix it", and "How it is worked out: ... keeps
  Tom's plan going as many years into retirement as your plan together goes".
- The debts a death leaves (the rule of thumb's "debts", and the single parent's answer): a federal student loan is cancelled
  when its borrower dies (34 CFR 685.212(a)(1), read 2026-11-06; a Parent PLUS loan too), so it is left out unless the
  loan is marked private (`debts[].private: true`, optional). Couple-home's rule of thumb: $72,300 -> $8,300 (the funeral).
Tests: module.test.mjs "round 8 item 14".

## Round 8 batch 2 review fixes (2026-11-06)
Tests: module.test.mjs "round 8 review" and the updated item 14 tests.
- **No shortcut to $0 (money D1).** "No children and no living-cost gap, short either way" set the need to 0, but `gapYears`
  stops at the survivor's retirement (empty for a survivor already retired) and never sees the pay, saving or pension the death
  takes after it. The either-way test alone decides: need = the smallest lump sum with ok(lump) = success, or the survivor's
  failYear >= the household's, or the survivor's years of retirement >= the household's. It still gives $0 for the round-8
  couple (both deaths), and keeps qa household 02-couple-no-kids / turns-retirement-age-today ($1,038,000 if Tom dies: Priya
  would run out in 2029, the plan together in 2058) and 08-retired / extra-bigger-than-balance ($225,000 if Sam dies: his
  pension stops and Ruth runs out in 2038, the plan together in 2045). With $0 saved, the funeral alone is a need ($9,000).
- **Only the borrower's own federal loan ends with them (money D4).** 34 CFR 685.212(a)(1) (Cornell LII, read 2026-11-06): "If
  a borrower ... dies, the Secretary discharges the obligation of the borrower"; a spouse's death cancels nothing the survivor
  owes. `keptAtDeath(r, deadId, oneAdult)`: a non-private student loan leaves "the debts a death leaves" only when its account's
  `ownerId` is the person who dies, or it has no owner and the household has one adult; with two adults an unowned loan stays
  for both deaths. DIME's `debts` and the single parent's debts are per death. Couple-home's unowned $64,000: back in both
  rules of thumb ($72,300).
- **Short either way, said plainly (UX 5).** With no cover asked for, the card's verdict is plain text, not a green "good"; the
  warning says "Tom's money would run out at about 65 if Priya died, and so would your plan together: a death does not make it
  run out sooner, so life cover is not the fix" (it said "With or without cover", which is true of no amount of cover but the
  $0 worked out). "No life cover needed now" and "short for retirement either way" only when every person's need is 0.

## Round 8 verify (2026-11-06): the survivor is held to the plan together's calendar year again
Tests: module.test.mjs "round 8 verify" and the updated item 14 / UX 5 tests.
- **The "years of retirement" measure is gone.** need = the smallest lump sum with ok(lump) = the survivor's plan succeeds, or,
  when the plan together runs out too, the survivor's failYear >= the plan together's failYear (the measure before round 8).
  "As many years of retirement, each from its own retirement start" compared different things when the survivor retires
  before the household's retirement year (the first adult's): the years the dead partner's pay would have carried counted as
  retirement the plan together had too. Example (the test): a childless couple, Priya 40 retiring in 2053, Tom 54 retiring at 60
  in 2032, the plan together running out in 2051: if Priya died, the page said "no life cover needed" while Tom alone runs out
  in 2032; the calendar measure asks for the lump sum that keeps him to 2051. On the 1,411 qa plans (2026-11-06) the years
  measure had lowered 367 people's needs, 188 of them by $100,000 or more (largest $1,085,000), 184 in households with
  children. Like for like is the same person running out no earlier.
- **What item 14 asked is kept in words and order, not by a $0.** Couple-home: Priya's need is $28,000 again (Tom alone retires
  in 2060 and runs out then; the plan together runs out in 2062: two years of Tom's retirement Priya's pay would have carried);
  Tom's is $0. `plan.eitherWay` and `plan.jointFailYear` mark a plan that runs out anyway; the card says "would need about
  $28,000 to last as long as your plan together does", "How it is worked out: ... keeps Tom's plan going as long as your plan
  together's, which runs out in 2062 either way", never "on track". protectionGaps marks such a gap `eitherWay` and its sentence
  adds "It keeps Tom's money lasting as long as your plan together's; your plan is short for retirement either way (Will the
  money last?)." Next best action puts that cover after costly debt and the match when no child depends on anyone (see its
  README), so it is not the couple's first move.
- The warning's link reads "Will the money last? ›" (it read "Will the money last? shows what is ›").
Final check (2026-11-07): the list of what the plan still needs uses the words every page uses (`core/words.js` `needItem`: "a birth date on the People page", "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"). Test in `tests/wording-verify.test.mjs`.
