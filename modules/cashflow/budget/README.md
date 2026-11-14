# Budget  (`cashflow/budget`)

**Status:** usable (phase 4)
**Purpose:** An envelope for each kind of spending: what is spent so far this month, what is left, and whether the pace is right; and, once this month's bank lines are in, how much is safe to spend this week.

## Inputs
Plan sections read (`needs`): `budgets` (`[{ id, category, amount, period: "monthly", rollover }]`), `transactions`, `categories`. Writes: `budgets`, and `whatIfs.safeSpend` (the span chosen for Safe to spend; a choice of view, never counted in the plan).
`compute(plan, { today, month })`. `safeToSpend(plan, { today, span?, spare?, budget? })` also reads `expenses`, `income[].payday`
(and the pay's rhythm) and Irregular expenses; `spare` is Next best action's `spare` (the page passes it through `ctx.computeOf`).

## Outputs
`month`, `label`, `dayOfMonth`, `daysInMonth`, `daysLeft`, `envelopes[]` (`amount`, `rollover`, `carried`, `available`, `spent`, `left`, `share`, `pace`, `expectedByNow`), `totals`, `unbudgeted[]`, `suggestions[]`, `hasBudget`, `hasData`.
`compute()` is unchanged by Safe to spend: its output is byte for byte what it was (the invariance test, gap spec 3.5).
`safeToSpend()` -> `{ drawn: false, why }` or `{ drawn: true, mode, kind, planned, spent, noEnvelope, left, span, spans, nextPayday, days, cut, safe, about, plan | envelopes, words: { headline, second, doubt } }`.
`nextPayday(plan, today)`; `envelopeWords(d, { today, currency })` -> `{ head, more }`.

## Formulas
- Spent = spending-kind transactions of the month in that category (transfers excluded), as positive money out.
- Carried (rollover only) = max(0, last month's amount - last month's spent): unspent money moves forward, overspending does not become a debt.
- Available = amount + carried; left = available - spent.
- Pace: over when spent > available; "ahead" when spent > expected-by-now x 1.1 + 1 where expected-by-now = available x day of month / days in month; else on track.
- Suggestions (2026-11-01) = per spending category without an envelope, the total over those of the last three months that the bank files cover from start to end (`transactions/ledger` `monthCover`), divided by the number of those months (`suggestFrom.length`), so "average of 2 whole months" is the number it was divided by and a month with nothing in a category counts as nothing. Before, a month cut by the file counted as a month (Groceries $500 instead of $675 on a file cut Oct 9) and the label could say "average of 2 months" over a division by 3 ($273 for a $410 car payment). With no whole month in the files, there are no suggestions and the page says what the files cover and to import 90 days.
- `stale`: the files stop more than 3 days (`COVER_SLACK`) before today in the month shown, so "spent so far" is missing days; the page says where they stop.

## Days missing between files, and a card's missing file (2026-11-02)
- Suggestions also skip a month that is whole at both ends but has a hole in any account's files (`monthHoles`, Transactions >
  Ledger): `suggestSkipped: [{ ym, holes }]`, and the page says "August 2026 is left out: Chase checking has no lines from
  7/31 to 8/2." The sample family's November suggestions were averaged over August to October, and August is missing the
  mortgage of Aug 2: "Rent or mortgage $1,320" (two mortgages over three months). Now September and October: $1,980.
- A card whose own file is missing (Ledger `unimportedCardLines`) counts in no category's suggestion: its payments are no
  kind of spending yet. `suggestCards: [{ cardId, name, label, average, months }]` (the total over the same months / their
  number) is said above the list: "Visa card's purchases aren't in these amounts: about $2,795 a month went to it, but its own
  file isn't in, so what it bought isn't sorted into kinds yet. Bring in the Visa file." So "Eating out $94" reads as checking
  only, not as the whole of it.
- This month's payments to such a card are spending with no envelope: one `unbudgeted` line per card `{ category: "", card:
  true, cardId, label: "Visa card, details not imported yet", spent }`, never an envelope to add. Envelopes never count it.
- Review (2026-11-02): a month is left out unless it is whole account by account (Ledger `monthGaps().whole`: no hole, no
  account whose lines stop early or start late), so a Visa file from 8/20 or one stopping on 9/19 leaves August or September
  out too. `suggestSkipped[].issues` (Ledger `gapIssues`) carry the reason; the page groups months that share one ("July and
  August 2026 are left out: Chase checking has no lines from 7/31 to 8/2."). `suggestCards[]` adds `inMonths` (the months its
  stand-ins were in) and `total`: with the Visa's file in for September only, the note says "Visa card's purchases in October
  aren't in these amounts: $2,610 went to it then, but its October file isn't in..." instead of "about $1,305 a month".
- Re-check 4 (2026-11-02): one rule for the days between files (Ledger `coverageByAccount`: more than a quiet spell of 7
  days and 2 x the account's spacing, or a usual monthly payment due in them). One checking file a month, each record from its
  first to its last line (8/3-8/29, 9/1-9/26, 10/1-10/31): no hole, suggestions from August to October (groceries $997, as
  dc6e73c). A payment counted for neither of two cards at one bank (Ledger `unsureCardPayments`) leaves its month out with the
  one sentence ("$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought"); the
  month's page says it as `unsure` above the envelopes. `suggestCards[]` and the card's line carry `before`/`first`: a payment
  before the card's first line reads "before its file starts on 8/1".

## A bill paid once a month (2026-11-02)
An envelope whose month so far is one payment of 90% or more of its amount (and not over it) reads "paid", not
"spending fast": the mortgage paid on the 1st is not a fast pace. Two payments, or one under 90%, pace as before.
The month before must look the same (one payment in that category, within 10% of this one), so a single big
grocery trip on the 2nd still reads "spending fast".
Opened from the Monthly review (`?month=2026-10`), the page shows that month until a month is picked here.

## Edge cases
No today and no month: nothing. A past month counts as complete (day = days in month). Adding an envelope for a category that has one updates it instead.

## Tests
`module.test.mjs`: spent/carried/available/left, pace states, unbudgeted list, suggestion averages over whole months only (a cut first month left out), no suggestions without a whole month, stale files, a past month. A month with a 4-day hole between two files left out (groceries (310 + 300) / 2 = $305, rent $1,000) and back once the files join; the sample family in November (August left out, mortgage $1,980, eating out $94, the Visa's (2,980.55 + 2,610.30) / 2 = $2,795 apart, October's card payment unbudgeted) (2026-11-02). Re-check: a quiet savings account (interest on 7/31 and 10/31) and no card suggests from August to October with nothing skipped (finding 4); a Visa file stopping on 10/10 leaves October out ("Visa card's lines stop on 10/10") with no card line, since its 10/14 payment no longer stands in (finding 2). Re-check 4: money 1 (one checking file a month: August to October, groceries $997, nothing skipped) and money 4 (a payment for one of two Chase cards: no suggestions, each month's sentence, October's `unsure`).

## Start from your expenses (round 4, 2026-11-02)
With no envelopes and no whole bank month to average, `compute` returns `fromExpenses`: the Expenses page's monthly amount
per kind of spending (its `byCategory`, debt payments included), rounded to the dollar, and `fromExpensesTotal`. The page
shows them in a "Start from your expenses" card with one filled button, "Use these as my budget" (`useExpenses(draft,
rows, newId)` adds one envelope per kind not budgeted yet, in one save), and "Import a bank file instead". It also says
what is left after them, tax and saving, read from Next best action's `spare.monthly` (the Dashboard's figure), so no new
left-over number is made. Before, "Set a budget" (the spending guide's step) opened an empty form and the person retyped
every bill. With envelopes but no bank file yet, the page says spending shows once a file is in, and drops the
"on track" pills and "left" amounts that read $0 spent. The confirmation shows at the top.

## Ideas / not yet
- Yearly envelopes and per-envelope notes; "money to assign" against income.

## Start from your expenses in a lean month (review 2026-11-02, round 5)
The card's last line reads Next best action's spare, as the Dashboard does. When Side income's "count on" holds part of
uneven pay back (`spare.held` above $0.50) and the month is short, it says so: "In a lean month, these, tax and your saving
come to about $X more than comes in, counting uneven pay at what you can count on: the same gap as the Dashboard. A month
that brings the Income page's amount leaves about $Y." (Y = `spare.fullAbout`; "Even a month that brings the Income page's
amount is about $Y short." when below 0). A month with money left adds "counting uneven pay at what you can count on".
Before, a freelancer whose full month leaves money read only "... $770 a month more than comes in". Test: `module.test.mjs`
(the page drawn with a stand-in UI kit, read back as text).

A full month within $5 of $0 (review 2026-11-02, round 5, second review): `spare.fullKind` (cashflow/budget-percent `fullKind`: "ahead", "even" within $5 of $0, "short") decides the words, so it reads "only just about breaks even" instead of "leaves about $0" or "is still about $0 short". The card reads "Even a month that brings the Income page's amount only just about breaks even." Test:
`module.test.mjs`.

## Recheck 2026-11-05
With bank files in but no whole month to suggest from (two cards at one bank, no file for either), "Start from your expenses"
said "Spending against each envelope shows once a bank file is in", which was false. It now says "Your bank files have no
whole month to suggest amounts from yet." and the months left out and why; with no bank file at all the old words stay. A
payment counted for neither card is said by its short reason (`brief`, ledger `unsureBrief`), so the months share one
sentence: "August to October 2026 are left out: money went to your Chase cards, whose files aren't in." Test: the page's
words for Freedom and Sapphire on plan3, and for a plan with no bank file.

## Touch and input stress test (2026-11-11, claude-g)
- Each envelope shows "Edit ›" under its amount, as Income and Expenses rows do (CF-8). With no bank file the lede's "Import a bank
  file" is a button (CF-1).

## Safe to spend (gap #5, 2026-11-13)
**What a person sees.** Nothing new until there is something to measure. Once this month's bank lines are in (they start by the
4th and reach within 3 days of today, the page's `COVER_SLACK`), the page opens with one sentence and what it keeps covered:
"About $310 is free to spend until Sunday." / "That keeps your bills and saving covered to the end of November." Under it, the
chips "Today", "This week" and, only when a payday is known (`income[].payday`, asked on the Calendar page), "Until payday";
two chips never give the same answer, so on a Sunday (this week is today) or the month's last day fewer show, and one alone
shows none. With envelopes, spending in kinds with no envelope comes off their money and the sentence says so: "That keeps your
spending within your envelopes to the end of November, counting the $88 spent with no envelope."
A chip saves `whatIfs.safeSpend = { span }` and the green line names the new answer ("Saved. About $45 is free to spend
today."). At or past zero the headline is the alarm and nothing hides it: "Spending is $140 past this month's plan." with "Unless
more comes in, that $140 comes out of the money for bills and saving." in amber, and no chips. A reason to doubt the figure stays in sight under it: "Some of
the bills it sets aside are our guesses." or "It leaves out the $2,610 that went to Visa card this month: its own file isn't in
yet." One tap away, "How this is worked out" (status "from your plan" or "from envelopes") shows the sum, each figure
a link to the page it comes from, then the span: "$1,350 x 7 / 30 = $315, about $320."

**Formulas.**
- A kind of spending is a bill when the categories list marks it must-pay (`essential`: rent or mortgage, utilities,
  groceries, car, insurance, health, loan and card payments, childcare, phone, taxes not withheld, unless changed there).
- Planned money for the things that are not bills:
  - with envelopes for them: the sum of those envelopes' `available` (amount plus last month's unspent when it rolls over);
  - without: take-home a month - must-pay bills - set aside - saving - the debt plan's extra, where take-home is Next best
    action's after-tax month (the Dashboard's; `spare.monthly + spending + retirementSaving + goalSaving + debtExtra`, which is
    `yearTaxes`' month with uneven pay counted at what you can count on), must-pay bills = Expenses' `byCategory` monthly for
    the must-pay kinds (a yearly bill at a twelfth), set aside = Irregular expenses' monthly figure for its costs that are not
    must-pay kinds and have not ended (yearly and quarterly costs at a twelfth or a third, a one-time cost over the months to
    its date, yearly charges found in the bank lines), saving = retirement from pay + goals' monthly.
- Spent so far = this month's money out (`spendingOf`: transfers between your own accounts left out) in kinds that are not
  bills; money out not sorted into a kind yet counts as spent. A line that pays a set-aside cost is not counted (a typed cost:
  its kind, within 10% of its amount, one line each; a found yearly charge: its payee). With envelopes, `noEnvelope` = the part
  of it in kinds with no envelope (not sorted yet included); it is said in the sentence and on the How part's spent line.
- Left = planned - spent. Safe(span) = max(0, left) x days(span) / days left in the month counting today; days(today) = 1,
  days(week) = the days through Sunday, days(payday) = the days through the day before the next payday; each stops at the
  month's end (the sentence then says "to the end of November"). A span whose days equal an earlier span's (today, this week,
  until payday, in that order) is not offered, and a saved one reads as the span it equals (review 2026-11-13).
- Next payday: from `income[].payday` on the pay's rhythm (a salary typed as a year's pay as the Paycheck page counts it,
  `payRhythm`; a pension or Social Security typed as a year's amount monthly; twice a month on the 15th and the last day,
  as the Calendar counts it), never before the pay starts or after it ends; the soonest of all pays.
- "About": to the dollar under $100, to the $10 above, never $0 while something is left.
- Cases, one written sentence each (docs/OPTIONAL.md R5): ok by span (today; until Sunday; to the end of the month; until payday
  on June 12), with envelopes with and without spending that has no envelope; all spent and over, each in the plan's words
  ("Anything more this month comes out of the money for bills and saving." / "Unless more comes in, that $140 comes out of the
  money for bills and saving.") and the envelopes' ("Your envelopes for spending are used up: anything more comes out of money
  meant for bills or saving." / "Your envelopes for spending don't cover that $140, so it comes out of money meant for bills or
  saving."); and "Nothing is free to spend this month." / "Your bills and saving need more than comes in after tax." when the
  plan's month itself leaves nothing.

**Sources and design references (read 2026-11-13).** No outside figure is used: every number is the plan's own. The shape
follows two apps, as references only: PocketGuard's budget calculator ("how much money is left after covering all necessary
expenses, we call it In My Pocket", pocketguard.com/budget-calculator) and Quicken Simplifi's spending plan ("Available ... the
total amount you have left to spend for the month", with "a daily average", support.simplifi.quicken.com article 4212702;
Quicken's blog: income - bills and subscriptions - planned spending - savings goals - recurring transfers = available to spend).
Neither publishes its exact sum; nothing was copied from either.

**Builder chose** (the spec left these open):
- Envelopes alone are not something to measure: with no bank lines this month the figure would say nothing has been spent,
  so it waits for a file (the page's own "Spending against them shows once a bank file is in" stays).
- Only today's month: a month picked in the Month box (or opened from the Monthly review) shows its envelopes as before.
- Envelopes that are all bills say nothing about the rest: the plan's month is used then.
- A month mostly of our guesses (Next best action's `spare.waits`) gives no figure, as the Dashboard gives no verdict on it;
  some guesses give the figure with "Some of the bills it sets aside are our guesses." beside it.
- A must-pay kind spent past its plan does not come off the free money (a yearly bill landing in its month would read as
  overspending); the envelope's own "over" shows it. A card whose own file is missing is not guessed at: it is said.
- The debt plan's extra (Pay off debts) is spoken for, as on the Dashboard, so it comes off with the saving.
- Default span: this week (the design's headline); a saved "Until payday" with no payday known any more reads as this week.
- The alarm's second sentence is not the design's example ("The bills still to come need what is left."): beside "Left for
  November: -$544" in How it read as money that is not there, and envelopes keep bills out of the figure. It says instead where
  more money comes from, in each mode's words (review 2026-11-13).

**Tests** (`module.test.mjs`, "gap #5"): the week figure on June 1 = left x 7 / 30 with every line of the sum by hand; a bill
paid is not taken twice, a yearly cost paid comes from its set-aside, a found yearly charge; transfers ignored and unsorted
money counted; every case sentence; the card and guesses doubts; envelopes (rollover, bills, spending with no envelope); nothing
drawn without files, with stale or late files, for another month; until payday and its cut at the month's end; the next payday
on each rhythm; the page drawn with the real kit (the headline, chips, the How part shut and its links, a chip saves only
`whatIfs.safeSpend` with the green line naming the new answer, the alarm in amber); the invariance over every household and
fixture plan. Review (2026-11-13, one test each): no second "left" total on the Envelopes card while Safe to spend leads; the
alarm's second sentence in each mode; spending with no envelope said in the sentence and in How; what an envelope is moved to
the first card that offers one; no two chips with the same answer (Sunday, the month's last day, a payday the same as Sunday).

## Simple first (opt C19, 2026-11-13)
- The headline says what happens to you: Safe to spend when it is drawn; else what the envelopes say, one written sentence
  per case (`envelopeWords`: "$1,240 is left in your envelopes." / "Over on Groceries by $40, with 18 days to go."; a past
  month in its own tense; "Your 7 envelopes hold $4,200 a month." before a bank file). With Safe to spend as the headline,
  which envelopes are over leads their card ("Over on Groceries by $40, with 18 days to go."), with no total "left": that total
  counts the envelopes for bills, which Safe to spend leaves out, so two "left" figures disagreed on one screen (review
  2026-11-13). Each envelope still shows its own "left".
- With Safe to spend as the headline and no envelope yet, "Give each kind of spending an envelope: an amount for the month. ..."
  moves from the hero to the first card that offers one (spending with no envelope, the suggestions, Start from your expenses,
  or the form), so the form never shows with nothing saying what an envelope is (review 2026-11-13).
- Envelopes that are over come first; six rows, then "N more envelopes" (an envelope over or spending fast is never hidden).
  "Spent this month with no envelope", the suggestions and "Start from your expenses" show six rows, then "N more ...".
- The Month box shows only once there are envelopes or bank lines; its labels no longer work the month out six times.
- Spending with no envelope and the suggestions say their amount under the name ("$450 so far", "$950 a month, the
  average of 2 whole months"), so at 320 px a name keeps to a line or two beside its button.
- The note on why amounts are suggested moves into the card it explains when Safe to spend is the headline.
- "More on this": where the money went, what the yearly bills need, and the 50/30/20 page.
- After a save the green line names the new answer when the save changed it ("Envelope added. About $290 is free to spend
  until Sunday."); a must-pay envelope changes nothing free, so it says only "Envelope added.".
- "Start from your expenses becomes one outlined button once a budget exists" (opt 6.1): it is offered only before any
  envelope exists, so there is nothing to change.

## Split purchases (gap #24, 2026-11-14)
Spending is read through the Ledger's `allLines`: a purchase split across categories comes off each envelope for its own
part, and the month's spending counts it once (tested here and in `tests/split-tags.test.mjs`).

## Budget your way (gap #37, 2026-11-14)
**By default nothing changes.** A plan with no `budgetPlan` budgets with envelopes, and every figure and word of the page
is what it was (the invariance test compares `compute()`, `safeToSpend()` and `envelopeWords()` over every invented
household and fixture plan; the builder also compared the outputs of the tree before and after, byte for byte). Once
there is an envelope, the page gains one quiet row, "Set my own numbers" (status "Envelopes"). Inside:

- **How you budget** (chips): "Envelopes" / "Every dollar a job" / "Three numbers". A tap saves at once.
- **When an envelope goes over** (chips): "It ends with the month" / "It comes out of next month".
- **Move money between envelopes** (outlined; From, To, Amount; each move listed with Undo).
- **Hold for next month** (chips "Nothing" / "All $X" / "Type my own"), with Every dollar a job only. Never more than is
  left to give: "All" is that amount rounded down to the dollar, the box refuses more, and the help says "You can hold
  up to $X".

The two envelope options show with every way, Three numbers included: they change the envelopes whichever way leads, so
what the row counts as "set by you" can always be seen (and a move undone) inside it.

Stored in the optional section `budgetPlan` (docs/DATA_MODEL.md); `setWay()` writes only what differs from the default and
deletes the section when nothing is left, so going back to "Envelopes" leaves the plan as it was.

### Formulas (ours; no outside figure, rate or table is used)
- **An envelope's money this month** = amount + rolled over + moved in - moved out - (overspending comes out of next
  month ? what it went over by last month : 0). `compute()`: `available = amount + carried + moved - owed`.
  - Last month's money = amount + what was moved in or out last month. Rolled over = max(0, last month's money - last
    month's spending) (rollover envelopes only, as before); went over by = max(0, last month's spending - last month's
    money - what rolled into last month) (every envelope, only with the choice on). What rolled into last month =
    max(0, amount + moves two months back - spending two months back), rollover envelopes only: 450 a month, 420 spent
    in July, 470 in August: August had 480, so nothing is owed in September. The rollover itself looks one month back,
    as it always has; neither is a running balance.
  - Moves net to zero: only a move between two kinds that both have an envelope counts, so the envelopes' total is
    unchanged. Removing an envelope, or giving it another kind of spending, takes the moves to and from the old kind
    out of the plan (`dropOrphanMoves`; the green line says so), so a move never sits hidden and never counts again
    when an envelope for that kind comes back. A stored move with no envelope (a hand-edited file) moves nothing.
  - On a row the reasons share one pair of brackets (`moneyNote`): "($70 rolled over)", or "(after $70 rolled over,
    $40 moved out and $20 over last month)".
  - A move is refused (`moveProblem`) when the two envelopes are the same, the amount is not above 0, or it is more than
    the giving envelope has left; the sentence says what to change.
- **Every dollar a job** (`jobOf`): to give a job = money in after tax this month + held from last month - the
  envelopes' monthly amounts - what the Expenses page holds a month for kinds of spending with no envelope - the saving
  already in the plan (retirement from pay, goals, extra on debts) - held for next month. Money in after tax is the
  month Safe to spend uses (Next best action's `spare`, the Dashboard's figure). The most that can be held =
  floor(to give + held for next month), whole dollars.
  Cases: "$240 still to give a job this month." (0.50 or more) / "Every dollar has a job this month." (within 50 cents)
  / "You have given out $120 more than you have this month." (then "Take $120 out of your envelopes...", or, when
  money held for next month is what tips it, "Hold $120 less for next month, or take it out of your envelopes."). Only
  for today's month. With no pay known, or a month
  mostly of our guesses, the envelopes' own headline stays and one line says what it waits for.
- **Three numbers** (`threeOf`), each against its plan:
  - plan, kind of spending by kind: the envelope's money this month where there is an envelope for that kind, else what
    the Expenses page holds for it a month. Fixed = the must-pay kinds; flexible = the other kinds (for a kind with no
    envelope, less its own yearly and quarterly bills: those are in once a year); once a year = what Irregular expenses
    sets aside a month (the same figure as Safe to spend's "Set aside for yearly and one-time costs"). The line under
    the tiles says where the plans came from (the Expenses page, the envelopes, or both) and what must-pay means.
  - spent, from the month's bank lines (split purchases one line per part, transfers left out): must-pay kinds are
    fixed; a line that pays a set-aside cost is once a year; everything else, not sorted yet included, is flexible.
  - With nothing on the Expenses page the plans are the envelopes alone, and the line under the tiles links to Expenses.
    With no bank file the headline is the plan ("Your plan is $2,800 a month, in three numbers."); with no flexible
    plan at all (only must-pay envelopes) it is the must-pay money ("$600 of your must-pay money is left this month.").
  - The once-a-year tile says what is set aside a month and what was paid, never "over": a yearly bill lands whole in
    one month. The headline is the flexible money ("$350 of your flexible money is left this month." / "Flexible
    spending is $70 past its plan this month."; a past month in its own tense), then the must-pay bills.
- Safe to spend reads the envelopes after moves and the carry, so money moved into a spending envelope is free to spend.
  With another way chosen, that way's sentence is the headline and Safe to spend is the line under it (its alarm stays amber).
  An envelope that is over stays under the headline too, in amber ("Over on Eating out by $30, with 16 days to go."),
  whichever way leads.

### Choices where the design was silent or did not fit the code (noted for the owner)
- "Fixed = Σ essential expenses" uses the category's must-pay mark (the categories list's `essential`), as Safe to
  spend does, not each expense's own tick: bank lines carry a category, not an expense, so spent could not be matched.
- "To assign" also takes off the saving the plan already makes, what is held for next month, and the Expenses page's
  bills for kinds with no envelope. Without the first, money already promised to retirement or a goal would read as
  having no job (envelopes are for kinds of spending only); without the second, held money would count this month and
  next; without the third, a household with its mortgage on Expenses and two small envelopes was told nearly all its
  pay had no job. A kind with an envelope counts at the envelope's amount, never twice.
- "Fixed = Σ essential expenses" and "flexible = the rest" count the person's envelopes first (see Formulas): someone
  who made a $100 Eating out envelope was shown the Expenses page's figure for it and "money left" while that envelope
  was over. An envelope for a kind that also has a yearly bill on Expenses is counted whole in flexible, and the bill
  stays in once a year: the envelope is what the person said that kind gets a month.
- The chip keeps the design's name, "Three numbers"; what the three are is the sentence under the chips once it is on.
- A budgetPlan that is a list, and a move or held amount of a billion or more (a hand-edited file), are read as absent.
- "Hold for next month" is offered with Every dollar a job only: with plain envelopes nothing on the page counts money
  in, so a held amount would change nothing.
- "Move money" is inside "Set my own numbers", not a button on every envelope row: the first view stays as it was, and
  the rows already carry a pill, a bar and Edit at 320 px. The form starts from the envelope with the most left, to the
  one with the least.
- The tick "Overspending comes out of next month" is two chips, so it saves on a tap with no second filled button.
- Monarch's "flex" budgeting is the reference for Three numbers (an idea only; no code or figures taken).
