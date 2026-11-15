# Goals  (`goals/goals`)

**Status:** usable (phase 2)
**Purpose:** Tracks each goal's target, date, funding account, priority and progress, and tells you the monthly amount needed.

## Inputs
Plan sections read (`needs`): `goals`, `accounts` (balances of `fundedBy` accounts), `assumptions` (`inflation`, `returnCash`, `returnBonds`).
`compute(plan, { today })`: `today` (ISO) for months left; without it every goal is "no date".

Goal shape: `{ id, name, icon, target, targetDate, priority (1 must, 2 want, 3 nice), saved, fundedBy: [accountId], monthly, rate (fraction or null), inflates }`. The form stores one account in `fundedBy`; the shape allows several.

## Outputs
`goals[]` (each goal plus `priorityLabel`, `monthsLeft`, `yearsLeft`, `rate`, `targetThen`, `funded`, `remaining`, `neededMonthly`, `projected`, `shortfall`, `progress`, `status`, `fundedFrom[]`), `count`, `done`, `totalTarget`, `totalFunded` (capped at each target), `neededMonthly` (open, dated goals), `contributing`, `warnings[]`.

## Formulas
- Months left: `monthsBetween(today, targetDate)` (`core/math/dates.js`).
- Growth rate: `goal.rate` if set; else `assumptions.returnCash` when under 3 years away, `assumptions.returnBonds` from 3 years on. Reason: money needed soon should sit in cash; a longer goal can take some bond-like growth. It is an assumption, shown on screen, and the owner can override it per goal.
- Target then: `inflate(target, inflation, yearsLeft)` when `inflates`, else the target as typed (`core/math/finance.js`).
- Funded: `saved` + sum of the linked accounts' balances (absolute values).
- Needed monthly: `pmtToReach(rate / 12, monthsLeft, targetThen, funded)`; 0 when already funded; the whole remainder when the date is today or past (n = 0).
- Projected at the date: `fv(rate / 12, monthsLeft, monthly, funded)`. On track when projected >= target then.
- Progress: min(1, funded / target then).
- Status order: no amount -> done -> no date -> past due -> on track (monthly > 0 and projected enough) -> behind.

## Each goal leads to the page that works out its cost (2026-11-02)
A goal used to open only its edit form, and nothing led to Education, Vehicle, House down payment, Emergency fund or
Travel, which give their own (different) figures. `plannerFor(goal)` picks the page by icon or name (🎓 college, 🚗 car,
🏠 house, 🛟 emergency, ✈️ trip). Each goal row has a link: "What it costs: Education ›", or, when that page's figure is 5%
or more away from the goal's amount (`plannerDiffers`), "Education works it out at $117,813 in today's dollars ›". The edit
form then says both figures and offers "Use $117,810 from Education", which sets the goal's amount (today's dollars) and
confirms it. `plannerFigure(goal, row, page, result)` turns the page's result into today's dollars: Education's
`totalToday`; Vehicle's net (price + sales tax - trade-in, in purchase-day dollars) x target / targetThen; Emergency
fund's target; House down payment's cash to close. Vehicle and Which goal first? print dates as 3/1/2029, not 2029-03-01.

Review fixes (2026-11-02, 7 of 8 confirmed): a figure is offered only when it settles and fits the goal.
- Vehicle: only once the Vehicle page has a price of its own (`priceFromGoal`); with none it took the goal's amount and added
  6% sales tax on every tap ($25,000 became $33,740 after four taps).
- Emergency fund: only for the goal ticked as the emergency fund (otherwise its money never counts there; a note says to tick
  it), and the amount is the cushion's target less the other cash that counts, so nothing is saved twice.
- Education: the share chosen there (`totalToday x share`, rounded to $1,000 like Education's own Update button, so the two
  buttons no longer undo each other); for a goal that does not grow, the dollars of those years; only for the goal naming
  the child, or the 🎓 goal naming no adult (Bo's grad school no longer gets Cy's college cost).
- Names: Travel is tested before House, House uses the House page's own `isHouseGoal` (a roof, repairs or an office are not
  a home to buy), and a car loan, insurance or repairs are not a car to buy.
- "Use $X from ..." puts the figure in the form's Amount needed box: Save changes keeps it with anything else typed (it used
  to save the amount alone and drop the rest). The notice says "in the dollars of its date" for a goal that does not grow.
- Refuted, not changed: the link's 32 px height and Enter on it (a phone tap opens the page; a near miss opens the form).

## How a row reads (2026-11-02, round 4)
The amount as typed comes first, then what rising prices make it by the date: "$0 of $30,000 · about $32,800 by
11/2/2029 with rising prices" (it used to read "$0 of $32,782", a figure nobody typed). A goal waiting its turn
(`goalsBehind` in overview/alerts: nothing going in, Next best action funds goals from a later month) gets a neutral
"starts later" pill and "its turn comes in April 2028, after the steps before it on Next best action", not an orange "behind".

## Edge cases
No date: needed/projected are null, status "no date". Date in the past and not done: "past due" plus a warning. Linked account deleted: ignored in the sum, warning. Negative target: warning. Rate 0: straight-line saving.

## Tests
`module.test.mjs`: cash vs bond rate by horizon, inflation of the target, pmtToReach and fv agreement, linked accounts, done/past due/no amount, totals.

## Ideas / not yet
- Several funding accounts per goal in the form (the data shape already allows it).
- Goal-seek ("what date can I afford?") and priority-based allocation of a fixed monthly amount (phase 9 `scenarios/goal-seek`).

## Round 8 (2026-11-06): a date that has passed is due now (item 18, equity-5)
A goal whose date has passed (`status: "past due"`) has `neededMonthly: null` and `dueNow` = what it still needs
(`remaining`), and is left out of the total `neededMonthly` ("Needed each month"); the result carries `dueNow` (their sum)
only when there is one, so a plan without one reads exactly as before. Before, n = 0 months made the whole remainder a
month's saving: one college goal dated 2023-08-15 with $103,000 left read "$105,576 needed each month" (2,576 for the
goals still ahead + 103,000). The goal's line says "due now: $103,000" and the stat "for the goals still ahead; $103,000 is
due now on goals whose date has passed". Goal prioritizer leaves it out of the sharing and lists it apart; Next best
action's goals step says it apart. A goal due this month (0 months left) keeps its whole remainder as this month's figure.
Test: module.test.mjs "past due, no amount, own rate, and totals".

## Round 8 batch 2 review fixes (2026-11-06)
Tests: module.test.mjs "round 8 review".
- A passed date's warning: "The date for Child 2's college has passed. Set a new date, or lower its amount to what is still
  needed." (it said "Child 2's college's date ... or mark it done", and no button marks a goal done).
- Education's figure for a child already in college (`plannerFigure`): the next bill, as Education's Update button writes it
  (its `nextYearCost` to the $10, "for its next bill (the spring half of 2026-27, January 15, 2027)"), not four years in the
  dollars of those years ($103,000 beside a $25,850 goal).
- The page reads Next best action's goals step `fromCash` (bills due within 3 months that the month cannot save for and the
  cash covers): those goals are out of "Needed each month" (it subtracts their `neededMonthly`; the stat's line says the bills
  come from savings), and their row says "paid from savings when it is due (Next best action)" with a "from savings" pill.

## Round 8 verify (2026-11-06)
- The rest of review UX 4: a goal whose date has passed and whose own page has a figure for it (Education's next bill for a
  child in college) is not said as its whole amount due now ("$103,000 is due now" in the header, "due now: $103,000" on the
  row, next to the row's own "Education works it out at $12,930 for its next bill"). The header says "a goal's date has passed
  (below)"; other passed goals keep "$X is due now". Test: module.test.mjs "round 8 verify".

## Touch and input stress test (2026-11-11, claude-g)
- The link to a goal's costing page ("What it costs: Vehicle ›") is the row's last line, under the progress bar with 8 px above
  it: a tap in the middle of the row opens the goal (F4).
- A new goal shows name, amount and date, then "More details (optional)" folded above "Add goal" (icon, importance, set aside,
  account, monthly, growth, inflation); open when editing; a refused box inside opens it. Growth's help says 0 to 50 (F5).
  Since 2026-11-15 (opt spec 6.1, its C15 row) the line is the form kit's own (`more: true` on those seven fields and
  `moreOpen: editing ? true : undefined`), not a fold the page drew: the same markup, words and memory as every other form,
  and "Show every box in forms" opens it. Builder's choice: "How important" lists its default first (Want, Must have, Nice
  to have), because the kit opens the line by itself for a choice that is not its list's first, and a new goal's "Want"
  was second.
- The fold's summary is short enough for 320 px and the boxes inside keep the form's spacing (tester 2026-11-11).

## Our amount, or none (C5 follow-ups, 2026-11-13; hand-off rows N2, H6)
- A goal whose amount is our guess (Get started's home or education goal left blank: `goals[<id>].target` in the ledger) says
  so first, in the words Expenses and Income use for a row of ours: "Our guess for now: tap to type yours · $0 of about $43,000".
  Behind or past its date on our amount, its pill is gray ("behind", "date passed"), never amber (P7: our own blank never turns
  anything amber). The person's own amount, behind, is amber as before.
- A goal with no amount: the pill is a calm "add an amount" and the line says "No amount yet: tap to add one" (it said "$0 of
  $0" with an amber "no amount").
- Test: `module.test.mjs` "N2/H6" (drawn with qa/fixtures/fake-dom.mjs).

## The chance of reaching each goal (2026-11-15, gap list next 60 item 12; map G7)
Each goal said "on track" or "behind", worked out as if the money grew by exactly the plan's rate every month. Real money
goes up and down, so a goal "on track" by a few dollars can easily miss, and one "behind" may still make it. `chances(plan,
{ today })` says, for each goal, how often it has its amount by its date, with the money set aside for it and what goes in
each month, when the returns are drawn at random around the plan's own growth figures for that goal's money.

`compute()` is not touched: `chances()` reads its rows (`params.rows` reuses them) and adds nothing, so every page that reads
`compute()` sees the same bytes (test "chance invariance"). Nothing new is typed: no plan field, no what-if, no device key.

### The math (`compute.js`: `CHANCE`, `goalMix`, `drawLuck`, `walker`, `monthAtLeast`, `chances`, `chanceWords`)
- **The goal's mix.** A goal has no mix in the plan, so the page's own rule is its mix (Formulas above): with no growth
  figure of its own, a goal under 36 months away is cash (`returnCash`, no swing at all: "a goal held in cash gets no
  swing") and one 36 months or more away is bonds (`returnBonds`, swinging by `stdevBonds` in a typical year). A goal with
  its own growth figure r is read as the cash, bond and stock mix that grows at r: at or under cash, no swing; between cash
  and bonds a share w = (r - cash) / (bonds - cash) in bonds, swing w x stdevBonds (cash does not swing); between bonds and
  stocks a share w = (r - bonds) / (stocks - bonds) in stocks, swing sqrt((w sS)^2 + ((1 - w) sB)^2 + 2 w (1 - w) 0.1 sS sB),
  the variance of a two-asset mix (Markowitz, "Portfolio Selection", Journal of Finance 7(1), 1952) with stocks and bonds
  moving together at 0.1, as Chance the money lasts draws them; above the stock return, the stock swing (no riskier mix is
  made up). The rate is always the page's own `rate` for the goal, so the steady case is the page's own sum.
- **The luck.** 1,000 pretend futures (`CHANCE.runs`), one standard normal draw per pretend year (Box-Muller from the
  seeded mulberry32 stream of `core/math/montecarlo.js`, seed 1). Drawn year by year (`drawLuck`), so a goal's answer never
  depends on the other goals or how far they look (test "the seed is fixed"), and the same plan gives the same answer on
  every visit.
- **A month's growth.** In pretend year y every month grows by F = (1 + r/12) exp(sqrt(v) z / 12 - v / 24), with
  v = ln(1 + (swing / (1 + r))^2) (the lognormal moment match of Chance the money lasts: Aitchison and Brown, *The Lognormal
  Distribution*, 1957). The twelve months of a year multiply to a lognormal with mean (1 + r/12)^12, the page's own monthly
  compounding, and log spread sqrt(v); with no swing F = 1 + r/12 exactly. One draw per year spread evenly over its months
  (not twelve draws): the year's spread is the plan's, and 12 times fewer draws keep the page quick on a phone.
- **The money.** B_t = B_(t-1) F_t + monthly from B_0 = funded (a month's money goes in at its end, as `fv`), carried as
  B_t = funded P_t + monthly A_t with P_t = P_(t-1) F_t and A_t = A_(t-1) F_t + 1 (`walker`, walked only as far as asked).
- **The amount needed** at month t: the page's `targetThen` at the goal's date; elsewhere target x (1 + inflation)^(t/12)
  for a goal that grows with prices (inflation is the plan's own, not drawn at random), else the target.
- **The chance:** the share of the pretend futures with B_n >= targetThen - 0.5 at the goal's date n (the page's own
  on-track tolerance). With no swing it is worked out in closed form with the page's `fv`, so "On pace" is exactly the
  page's "on track" (test "On pace is exactly the page's on track"), except for a goal with nothing going in that growth
  alone gets there: the page's row calls it "behind" (its "on track" needs money going in) with "needs $0 a month", and
  the chance says "with nothing more put in" (test "critic M1"; `compute()` is not touched).
- **What would make it 9 in 10** (`CHANCE.aim`), only when it is under 9 in 10:
  - a monthly figure: per pretend future the monthly that just gets there, M_p = max(0, (targetThen - 0.5 - funded P_n) /
    A_n); the 900th smallest of the 1,000 (so 900 of them get there with it), rounded up to $10 ("about $1,050 a month").
    With no swing it is the page's own "needs" figure, to the dollar. A growth figure that is not a number (a rate stored
    as text) gives no figure (`aimMonthly` null), and no line is said.
  - a later date at today's monthly: the first month t after the date, at most 10 years later (`CHANCE.laterMonths`), at
    which 9 in 10 get there, each month counted with the mix the page would give a goal t months away (a cash goal moved 3
    or more years out is counted as bonds there, and its line then says "be 9 in 10"); said as the first calendar month
    whose first day is at least t months from today (`monthAtLeast`), so a date typed in that month gives the page at least
    t months.
- **The cases** (`kind`): reached (status done), no amount, no date, date passed, due now (0 months left), too far (more
  than 80 years away, `CHANCE.farMonths`: a date typed as 9999 would walk 8,000 years of months on every draw, 0.75 s; at
  80 years a goal takes at most about 50 ms), run.
- **Which goal is which:** each row of `compute()` is read with the plan's goal at the same place, so two goals that
  share an id (a copy pasted in by hand) each keep their own growth figure.

No current figure is used: the growth, swing and inflation figures are the plan's own Assumptions (their defaults and
sources are in `modules/system/assumptions/README.md`); the 3-year rule is this page's own; 0.1 is Chance the money lasts's.
The 1,000 runs, the seed, 9 in 10, 10 years and the $10 rounding are the builder's choices (below). Nothing was fetched.

### Builder's choices (claude-b, 2026-11-15)
- A goal's chance is the chance at today's pace, with nothing assumed about later raises; a goal waiting its turn on Next
  best action ("starts later", nothing going in yet) is worked out at $0 a month, and its second line says the monthly
  that would make it 9 in 10. A goal Next best action pays from savings when it is due ("from savings") is said as one,
  with no chance worked out.
- The chance in tenths is rounded down, as `modules/retirement/odds.js` does for every other chance in the app ("never 9
  under 90%"): 0.73 reads "About 7 in 10", and 0.28 "About 2 in 10" (a review asked for nearest; kept, so "N in 10" means
  the same on every page); from 0.9 "At least 9 in 10"; every run "10 in 10 ... in all 1,000 pretend futures we tried";
  under 1 in 10 "Unlikely at this pace", and none "Very unlikely at this pace" (a review found "in none of the 1,000
  pretend futures" alarming for a goal twelve years off).
- One scale for the short answer: "On pace" / "Not at this pace" for money with no ups and downs (where the answer is
  yes or no), "N in 10" for money with them ("Sure", "Short", "Every time" and "0 in 10" read as four scales).
- A linked account's own holdings are not read: the page does not read them for its own figures either, and the two must
  agree (a 529 invested in stocks with no growth figure on its goal is counted as the page counts it).
- 1,000 runs: a share good to about 1.6 points (the standard error of a share near 1 in 2 over 1,000 runs), enough for
  tenths, and about 5 ms for four goals once the page has run once.
