# Alerts  (`overview/alerts`)

**Status:** usable (phase 2)
**Purpose:** Warns you of stale data, a thin emergency fund, spending above income, expensive or never-ending debt and goals that slipped, each opening its page.

## Inputs
Plan sections read (`needs`): everything the underlying computes read: `household`, `accounts`, `netWorthHistory`, `income`, `expenses`, `debts`, `goals`, `assumptions`. It imports the `compute()` of `balance/net-worth`, `household/people`, `cashflow/income`, `cashflow/expenses`, `goals/goals`, `balance/liquidity`, `balance/liabilities`, `system/assumptions` (all pure).
`compute(plan, { today })`: without `today` the date-based checks (stale balances, history, goal dates, review age) are skipped.

## Outputs
`alerts[]` (`id`, `level` bad/warn/info, `title`, `detail`, `go: [group, id]`), `counts`, `total`, `allClear`.

## Rules (id: level)
- Setup: `no-people`, `no-accounts`, `no-income`, `no-expenses`: info.
- `assumptions-yearly` (C5 hand-off N3, 2026-11-13): a chore, "Once a year: look over the assumptions", due 365 days after the
  last look (`assumptions.reviewedAt`) or, never looked at, 365 days after the plan was made (`meta.createdAt`). It replaced
  `assumptions-unreviewed` (a chore on every new plan) and `assumptions-stale` (a counted "check"): the checklist's last step
  is now "Look over our guesses", and Our guesses for you holds the assumptions one tap away, so a new plan had two "look over"
  asks for different things. The assumptions are planning choices, not facts about the person: once a year is enough.
- `stale-balances`: warn when any account's `asOf` is missing or older than `STALE_BALANCE_DAYS` (90). `history`: info when no net-worth point in `STALE_HISTORY_DAYS` (35).
- `overspend`: bad when expenses exceed income (from `cashflow/expenses`).
- `emergency-bad` / `emergency-warn`: from `balance/liquidity` status.
- `debt-never-<id>`: bad when a payment does not cover interest; `debt-expensive-<id>`: warn at or above 15%, left out while a saved debt plan pays it off (Next best action's debt step "under way", 2026-11-02); `bank-over`: warn when the bank files show clearly more going out than Expenses lists (income-statement `bankVsPlan`, 2026-11-02); `debt-paid-<id>`: warn when a loan is paid off but its payment is still on Expenses (Expenses' `ended`, 2026-11-02); `debt-details`: info when a debt has no rate; `dti`: warn above 43%.
- `goal-late-<id>`: warn when a dated goal is past due; `goal-behind-<id>`: info when contributions are below what is needed.
- `goals-behind` (2026-11-01, round 2 of the owner's experience list): two or more goals behind are one info alert, "4 goals are behind: Japan trip, Emergency fund, Replace Bo's car and Cy's college need about $2,242 more a month in all; nothing is going in to Japan trip yet. You have about $4,170 left over each month." The sum is each goal's `neededMonthly - monthly` (not below 0); goals with nothing going in are named first, so F-015 (such a goal must show, first among the goals) still holds; the left-over is Next best action's `spare.monthly`. One goal behind keeps its own `goal-behind-<id>`. Before, the sample family read "9 things to look at", four of them "X is behind". The goals with nothing going in are named ("nothing is going in to Japan trip or House down payment yet"; "either of them" or "any of them" when it is all of them). `goalsBehind(gl)` works the sum and is exported, so the Dashboard's Goals tile says the same; a goal past its date is counted apart (its whole remaining amount is not a monthly figure), and its Goals-page warning ("...date has passed") is not listed again beside its own `goal-late-<id>` alert.
- Chores (2026-11-01): `assumptions-yearly` (was `assumptions-unreviewed`) and `history` ("Save today's totals") carry `chore: true`. They are listed last, left out of `counts`, `total` and `allClear` (`chores` counts them), and the page folds them under "Housekeeping" (also under "All clear"). The Dashboard's "Needs attention: N things" and Monthly review count what needs a look, not housekeeping.
- Warnings the other pages produce (people, income, expenses, assumptions) are repeated here as warn, so one list has everything.
- Sort: bad, warn, info. Ids are stable so a future "dismiss" feature can key on them.

- `tax-bill`: warn. The paychecks look $1,000 or more short of the year's federal tax (`taxAnswer` in taxes/withholding:
  typed withholding, else estimated from pay, and the estimated payments), opening Withholding check (2026-11-02).
  The year's tax counts self-employment tax on business income (`yearTax`), and the line says how much of it that is.
- `life-cover-<personId>`: warn. An earner others depend on is short of life cover by $10,000 or more (Life insurance
  needs' answer, through Next best action's protection step): "No life insurance on Ana: Bo and Cy would be about
  $212,000 short", or "Ana's life cover is about $112,000 short" with some cover on file (2026-11-02).
- `guardian`: info. A child under 18 and no guardian marked done on Estate documents: "No one is named to raise Cy if you
  both died", opening Estate documents (2026-11-02).
- `estimates-behind`: warn. No pay is on file (a retiree, the self-employed) and Estimated payments has a payment past due
  (`behind` > 0): "About $1,552 of estimated tax is past due", opening Estimated payments. Without pay there is no April-bill
  alert, so before this nothing said the quarters were missed (2026-11-02).

## A goal waiting its turn (2026-11-02, round 4)
`goalsBehind(gl, { nba, today })`: a goal with nothing going in (`monthly` 0), when Next best action's goals step starts
getting money in a later month (`startDate`, after the cards and the cushion), is `queued`, not behind: no "is behind"
alert, not in the monthly need, and the Dashboard's Goals tile says "starts in April 2028". `turn` is that start date.
A goal with some money going in that is short stays behind (its own choice of amount is short).
Only a goal that can still be reached from its turn waits (review 2026-11-02): from `turn` to its date, `n` months,
it would need `pmtToReach(rate / 12, n, targetThen, funded)` a month (core/math/finance.js). Waiting goals are taken in
date order while those amounts add up to no more than the goals step's `capacity` (the spare money that reaches it once
it starts; `roomYearly / 12` when there is none). A trip due a month after the turn ($6,800 in one month) is behind now,
in amber, everywhere; college due years later still waits. Health score, Plan summary and the Timeline read the same set.

## Edge cases
Empty plan: five setup alerts. Complete healthy plan: all clear. No `today`: no date checks.

No "You spend more than comes in" item for a retired household drawing from savings as its plan intends (Next best
action's `drawing`, 2026-11-02).

## Tests
`module.test.mjs`: empty plan, healthy plan all clear, worst-first ordering and links, level assignment, no-today behaviour; `goalsBehind` month by month (a catch-up only until its own date, a goal due in the turn's first month, two waiting goals in date order, the family Wedding and Boat, the qa households H-0777 and H-0177).

## Emergency fund while costly debt comes first (round 4, 2026-11-02)
When next-best-action's `cushionLater` is set (starter month in cash, costly debt paid before the full fund), the red "Emergency fund is thin" / amber "getting there" item is replaced by `emergency-later` (info): "Emergency fund: enough for now", the months covered (whole months, one decimal under 2, as on Emergency fund) and the month the debt is paid off. Before, the list said "fix" for a cushion the plan's own order deliberately builds later.

## Review fixes 2026-11-02 (goals waiting their turn)
`goalsBehind` queues a goal ("starts later") only when it is dated after the turn Next best action gives the goals step, and never an emergency-fund goal (Next best action fills the cushion in its own earlier steps). A goal due sooner stays behind and counts in the monthly need, so a December gift goal can no longer pass its date with no alert.

## Review 2026-11-02 (round 5): the other behind goals share the same step
The goals step's money after the turn also catches up the goals that already get something and are still behind. Before
any waiting goal is tested, `used` starts at their extra a month: the sum of `max(0, neededMonthly - monthly)` over the
behind goals with `monthly > 0` dated after the turn, never the emergency fund (the same measure as Next best action's
`goalExtra`). Only what is left can carry a waiting goal. Before, a $36,000 Wedding (about $1,500 a month from December
2027) read "starts later" against $1,831 a month, while the car ($536 more) and college ($335 more) needed $871 of it.

## Review 2026-11-02, round 5 (second pass): one measure, from the turn
- The other behind goals' extra is now measured from the turn, as the waiting goal is: what they will have by then,
  `fv(rate / 12, months from today to the turn, monthly, funded)` (core/math/finance.js), carried to the target over
  the months left after the turn, `pmtToReach(rate / 12, monthsBetween(turn, date), targetThen, that)`, less what
  already goes in. Waiting goals use the same start (their funded grown by interest to the turn). A goal given without
  `targetThen`/`funded` keeps today's `neededMonthly - monthly`. On the family plan without the trip, the car needs
  $1,044 more and college $382 more from December 2027, $1,426 of the $1,831; a Wedding of $12,000 to $20,000 due
  December 2029 ($503 to $838 a month from then) no longer reads "Saving for it starts in December 2027": it is behind,
  on Needs attention, Health and the Timeline. Before, today's $536 + $335 left room for it.
- A waiting goal the step could work on (due a month or more after the turn) that does not fit keeps all that is left
  of the step (`used = room`), so a later one is not queued on room it will use: with a $36,000 Wedding and a $6,000
  Boat due 2035, the Boat is behind too, not "starts in December 2027". A goal due within the turn's first month can
  take nothing from the step, so it leaves the room to the others (college still waits behind a trip due that month).
- (Replaced by the third pass, below: one level figure per goal made the $12,000 Wedding, and two qa households' shared
  goals, read "behind" although they can be reached.)

## Review 2026-11-02, round 5 (third pass): month by month from the turn
`goalsBehind` now checks each waiting goal month by month from the turn, the goals step's money (`capacity`, a month)
in each month:
- **Goals already getting something** (behind, dated after the turn, never the emergency fund) take their extra first,
  `pmtToReach(rate / 12, n, targetThen, fv(rate / 12, months to the turn, monthly, funded)) - monthly` with `n` =
  `monthsBetween(turn, date)`, **only in their own `n` months**; one due within the turn's first month (`n` = 0) draws
  nothing (second pass: its need was infinite, so every later waiting goal read behind). Without `targetThen`/`funded`
  the extra is today's `neededMonthly - monthly`, still only until its date.
- **Waiting goals**, sooner date first, start from what they hold at the turn (`fv` of `funded`) and each month take
  what is left of the step until they are reached (`have = have x (1 + rate / 12) + draw`); a goal waits its turn when
  it is reached by its date (to 50 cents a month, `fv(rate / 12, n, 0.5)`). Filling the sooner goal first is the order
  that lets the most goals be reached (earliest date first). Its draws come off what later goals see.
- **Decision (the review left it open): a waiting goal that cannot be reached holds the step.** It is still short at its
  date, and whether it moves, shrinks or gets more money is the household's choice, so no later goal is said to "start
  in December 2027" on that money: the later waiting goals count as behind until it is fixed (the $36,000 Wedding and the
  2035 Boat both read behind, as the brief asked). A waiting goal due within the turn's first month gets nothing and holds
  nothing.
- Results: H-0777 (retired): the trip's $1,486 extra lasts 4 months, so Share B ($15,000 to go in 11 months) has
  $842.82 x 4 + $2,328.44 x 7, about $19,670, of the step (it draws about $14,650 of it, reaching $30,000 with
  interest) and waits its turn (second pass: "2 goals are behind", $2,106 needed; now the trip
  alone, $989, as at dc6e73c). H-0177 (couple): the baby fund's extra ends after 5 months, so Share A waits and Share B
  ($30,000 from nothing) is behind. Family plan without the trip: a Wedding due December 2029 gets about $405 a month
  for 15 months (until the car's date) and $1,449 for 9, about $19,100: a $12,000 Wedding waits its turn again (the
  second pass's test said "behind" because it counted the car's extra until December 2029, which the review showed was
  wrong), a $20,000 one is behind. A $3,000 Holiday getting $100 a month, due three days after the turn, leaves the Boat
  waiting.

## Recheck 2026-11-05
- The third pass's H-0777 figures are the code's: the goals step has $2,328.44 a month from January 2027
  (`capacity`); the trip holds $4,010.84 at the turn and needs `pmtToReach(0.02 / 12, 4, 12000, 4010.84)` = $1,985.62 a
  month for its 4 months, $1,485.62 more than its $500, which leaves $842.82; Share B ($15,050.04 at the turn, 11
  months) then has $842.82 x 4 + $2,328.44 x 7, about $19,670 (to the dollar, $843 x 4 + $2,328 x 7 = $19,668). The
  note said "$828 x 4 + $2,328 x 7 = $19,608", the unit test's rounded case at a 0% rate ($2,000 - $500 = $1,500 extra),
  not the household's 2% rate. No code changed.

## Estimated tax with nothing typed (review 2026-11-02)
`estimates-behind` asks first when no payments were ever typed (taxes/estimated `paidTyped` false): "Estimated tax: type
what you have paid this year", with what was due if none were made; typed (even all zero), it says what is past due.

## Ideas / not yet
- Dismiss or snooze an alert (store ids in the plan).
- Budget overruns and bills due (phase 4), investment drift (phase 7), insurance gaps (phase 8) plug in here.
- A count on the dashboard (designer's call; the compute is ready).

## Overspend in a lean month (review 2026-11-02, round 5)
`overspend` reads Next best action's careful month. With Side income's "count on" holding part of uneven pay back
(`spare.held` above $0.50), the detail adds "counting uneven pay at what you can count on (Side income); a month that brings
the Income page's amount leaves about $X" (X = `spare.fullAbout`, to the nearest $10, the figure every page says) or "is
still about $X short". When that full month leaves money (`spare.full` >= 0) the alert is **amber** (`warn`), titled "Lean
months run short", with "Good months make up for lean ones; keep a cash cushion for the months in between, or spend
less."; otherwise it stays red (`bad`), "You spend more than comes in". Before, a lean month was red, sorted with real
overspending, while its own text said good months make up for it. Test: `module.test.mjs` ("amber, not red").

A full month within $5 of $0 (review 2026-11-02, round 5, second review): `spare.fullKind` (cashflow/budget-percent `fullKind`: "ahead", "even" within $5 of $0, "short") decides the words, so it reads "only just about breaks even" instead of "leaves about $0" or "is still about $0 short". Such a month is red ("You spend more than comes in"), not amber: good months do not make up for lean
ones then. Amber needs `fullKind` "ahead". Test: `module.test.mjs`.

## Recheck 2026-11-05
The `bank-card` alert names the months looked at from `cardFile` ("over the last 2 months" when they are whole but for
payments counted for neither card; "2 whole months" for one card as before) and says "their own files aren't in" for
several cards: two Chase cards with no files now get "Bring in the card files" (they got nothing). Test in
`cashflow/income-statement/module.test.mjs`.

## Review 2026-11-06
- **The tax bill, filing separately.** Each return settles on its own (withholding `byReturn` through `taxAnswer` `returns`):
  a return that owes 1,000 or more is an alert, "About $1,660 of tax to pay in April on Bo's return", even when the two
  returns added up come to a refund (the family filing separately with 3,750 each: Ana 2,200 back, Bo owes 1,659.70; the
  alert said nothing). Filing jointly, nothing changes.
- **The self-employment tax said is the tax itself** (`taxAnswer` `seOwn`, the Federal estimate's figure): "$1,017 of it
  self-employment tax" for the family, where it said $581 (the business's whole effect, its deductions taken off).
- **The goals test's figures moved** with the child and dependent care credit, which now counts in the spare money (the
  family's $960 a year): the goals step gets 1,910.89 a month (1,830.89 before), so the largest December 2029 wedding the
  family can reach is about $21,100 (about $19,100 before), and the goals step starts on December 2, 2027 (January 2, 2028
  before). The test checks $21,000 waits and $22,000 cannot be reached, and the holiday due 3 days after the turn is now
  due December 5, 2027.
- Test: "the tax bill alert reads each separate return".

Review 2026-11-06 (round 7): "You retire this year", "Your required withdrawal: ..." and the separate-return tax bill ("on your spouse's return", "Your spouse's return has ... your spouse's pay takes out") say you/your for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js). Test: "Review 2026-11-06 (round 7): the unnamed first adult ..."

## Spending that is mostly our guesses (smart guesses C3, 2026-11-06)
- `spend-guessed` (info): Next best action's `spare.waits` (half or more of the month's spending is our guesses). Replaces
  the over-spending alerts: "Most of the spending in your plan is our guesses for now; with them, about $X more would go
  out each month than comes in. Your real figures decide whether your month works." Goes to Expenses.
- `emergency-guessed` (info): Emergency fund's `waits` with a thin or getting-there cushion. Replaces `emergency-bad`,
  `emergency-warn` and `emergency-later`: "By our guesses of your must-pay bills, usable cash covers N months; the plan
  aims for 3. Type your real bills to know for sure."
No red or amber verdict rests mostly on guesses (spec 8.1). Tests: `module.test.mjs` "C3 spending that is mostly our guesses", "C3 a thin cushion measured against guessed must-pay bills".
After the C3 UX review (item 12): `spend-guessed` says the shortfall to the $10, as the Dashboard and the done screen say
it, and `emergency-guessed` says the months as "about" (whole months, one decimal under 2, as Emergency fund says them). The life-cover alerts take Life insurance
needs' words, which are rough while the spending is mostly ours (see that README).
Our pay guess (C5 follow-ups, critic F3, 2026-11-13): when half or more of what comes in is our pay guess (`payWaits(plan, {
today, monthly })`, Get started's own rule from setup's `standing()`, said again here; a test holds the two equal), the calm
line names it and asks for the pay first, as the Dashboard's left-over row and Your plan do: "Type your pay and what you really
spend" (`spend-guessed`, the spending ours too: "Your pay and most of your spending are our guesses for now; ...") or "Type your
pay" (`pay-guessed`: "Your pay is our guess for now; with it, about $X more would go out each month than comes in. Your real pay
decides whether your month works."). Both open the pay question (`go: ["overview", "setup"]`, `rest: ["money"]`, `query: {
back: "done" }`, act "Type your pay"). A short month on our pay guess is never the red "You spend more than comes in". An alert
may carry `rest`, the screen inside its page (the view passes it to `ctx.go`). Test: "C5 follow-ups F3".

## Round 8 (2026-11-06)
- Order (item 40, widow-4): chores last, then by level, and within a level an alert with a date (`due`, ISO) first, the
  nearest first; the others keep their order. Only the required withdrawal has a date so far (`due`: December 31, or April
  1 of the next year in the first year), so a retiree in November sees "Ruth's required withdrawal: at least $16,078 by
  December 31" before "Emergency fund is getting there" (both "check").
- Goals waiting their turn (item 3): Next best action's goals step now comes right after costly debt, before the full
  cushion, and starts this month when there is no costly debt. `goalsBehind` is unchanged, but the turn it reads is
  earlier and the step's capacity bigger: on the family plan the turn is December 2026 with $3,884 a month (was December
  2027 with $1,911), so the Japan trip waits a one-month turn instead of being behind, and the most a wedding by December
  2029 can reach is about $115,900 (was about $21,100). In a household with no costly debt nothing waits a turn: each goal
  behind is behind, and Next best action says what it needs from now.

## Round 8 batch 2 review fixes (2026-11-06)
Tests: module.test.mjs "round 8 review".
- Required withdrawal (money D5): from Next best action's `rmdNow`: someone still working has the 401(k)s at that job left out
  (IRC 401(a)(9)(C)), the amount is the rest's (balance / Uniform Lifetime factor), and the alert names the 401(k) that can wait;
  with only that 401(k), no alert. Account names read as Next best action says them ("Ruth's retirement account").
- Goals waiting their turn (money D6): only the goal ticked as the emergency fund (`isEmergencyFund`) stays out of the turn, as
  Next best action and Liquidity read it; the family's untagged "Emergency fund" goal now catches up with the dated goals, so
  the largest wedding by December 2029 that can wait is about $109,800 (was about $115,900).
- Bills paid from savings (UX 1): a goal in Next best action's goals step `fromCash` is not in `goalsBehind` (so not in "N goals
  are behind ... a month", nor the Dashboard's goals tile); one info alert, "Pay N goals from savings", names each with its
  amount and date. `goalsBehind` returns `fromCash`.
- A past-due college goal (UX 4): Education's next bill, in Next best action's words (`collegeBills`, `collegeWords`), going to
  Education. The Goals page's warning now reads "The date for X has passed", so the check that drops it beside its own alert
  looks for the name anywhere in it.

## Tax held back from a withdrawal (round 8 batch 1, 2026-11-06)
With batch 1 the year's federal tax counts this year's IRA and 401(k) withdrawals (`known()` in taxes/federal). When
Estimated payments offers `holdBack` (estimates needed, something still short, a withdrawal not yet taken this year), the
alert is `estimates-holdback` (warn, `due` December 31): "Have about $3,600 of tax held back from your IRA withdrawal by
December 31", with the year's tax, that a hold-back counts as paid through the whole year, the quarters already past
included (IRC 6654(g)), and what leaves nothing to pay in April. It replaces `estimates-behind` there, so the person is
never told both to have tax held back and to "pay the past-due part" (verify item 4). It is added after the required
withdrawal's alert, so on the same date it follows it. Test: "round 8 batch 1: a withdrawal's tax is held back from it".

## A rental left out of net worth (round 8 batch 6 review, 2026-11-06, UX 10)
A rental on Rental analysis that names no Net worth account (and has a value) is a housekeeping item (`chore`), to Rental
analysis: "Condo is not in your net worth yet. It is worth $260,000 and owes $150,000 on Rental analysis. Add it there in one
tap." When Net worth may already list it (an account of its name, or others that are not the home you live in: property/rental
running.js `twinAccount`, `candidateAccounts`) it says "Net worth may already list it: say which there." Chores are not
counted in the Dashboard's figure. Test: "batch 6 review" in `module.test.mjs`.
Verify (same day): when Net worth may already list it, the title asks instead of asserting: "Is Condo on Net worth
already?" (it read "Condo is not in your net worth yet" over a Net worth that listed Condo at $260,000). Test: "round 8
batch 6 verify: a rental Net worth may already list is asked about, not called missing".

## The words on each row (stress test 2026-11-11, MR-7)
Each alert carries `act`, the thing the person does on the page it opens (`actFor`: by the alert's id, else by its page), shown
under the detail ("Plan the payoff ›"); an alert with none says "Open <page title> ›". Expensive debt opens Pay off debts, where
the payoff is planned. `fine: true` (the cushion while costly debt comes first: "enough for now") is listed apart in a folded
"Fine for now" and is left out of `counts`, `total` and `allClear`, like the chores.
