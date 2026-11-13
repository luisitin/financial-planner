# Dashboard  (`overview/dashboard`)

**Status:** usable (grows as pages are added)
**Purpose:** the landing page: where you stand and your next move, headline numbers, a setup checklist, and what is
coming.

## The page, top to bottom (with money in the plan)
1. **Where you stand** (added 2026-11-01, the owner: "biggest possible impacts ... experience-based"): "Hi Ana.", one
   plain sentence (overview/setup's `standing().headline`), three status lines (left over each month, safety cushion,
   retirement: a dot, the figure and a few words; one not known yet says "Add ›" and opens the setup question that
   fills it, `?back=done`), the page's one filled button "Your next move: <first move> ›" and "See all your moves ›"
   (the setup's end screen). It is the setup's end screen kept up to date, so every return starts with it. A nine-agent
   phone walk-through ranked its absence first: the setup said "More goes out than comes in" and the Dashboard said
   nothing about it.
2. The owner's four tiles (Net worth, You own, You owe, Goals; design log 2026-09-15 pass 2), unchanged except that
   their figures step down a size from 8 characters (`ui.stat(..., { link: true })`), so "$572,700" no longer splits
   into "$572," and "700" in a two-across tile.
3. "What to do now" (Needs attention, Import a bank file, Ask a question), unchanged (the owner's three; when the AI helper is off or not answering, `aiHealth()` (modules/ai/health.js, the same check as Ask the plan and Settings) asked at most once a minute and never waited for, the "Ask a question" tile says "The AI helper is off right now, so this opens your plan's own answers" and opens Quick answers instead of a chat that cannot answer; when the oldest balance is 25 or more days old a fourth line in "where you stand" says so, "Your balances: the oldest is from 10/1/2026, 31 days ago · Update ›", opening Update my balances, not as a card here).
4. The setup checklist: folded to one line once every step is done, or once "Set up my plan" is finished ("Set up your
   plan: done ✓", with "Change an answer" inside); the assumptions step then stays a to-do on Needs attention. While
   the where-you-stand card shows a move, the checklist's "Do step N" is outlined, so the page keeps one filled button.
5. "What is coming", unchanged (the owner's choice, design log 2026-09-15: "leave as is for now, once built it won't
   exist").

An empty plan: the hero says "Start with a few easy questions. It takes about five minutes."; "Start here" opens with
Set up my plan; the checklist's button is "Do steps 1 to 5 in one go: Set up my plan" (the setup writes the accounts,
people, income, spending and goals those steps ask for). Without the setup page (switched off), the old wording and
"Add your accounts".

## Counts that tell the truth (2026-11-01, round 2 of the owner's experience list)
- The Goals tile says how far behind in money: "4 behind, about $2,242 more a month, 1 past its date" (overview/alerts `goalsBehind`: each goal behind its pace adds `neededMonthly - monthly`, the sum Needs attention gives; a goal past its date is counted apart, because its whole remaining amount is not a monthly figure); it read "4 behind".
- "Needs attention: N things" counts what needs a look; housekeeping chores are left out (overview/alerts `total`).
- Once Set up my plan is finished, the folded steps line reads "Set up your plan: 5 of 6 done" while a step is open; "all 6 steps done ✓" only when every step is. It read "done ✓" with a step still open.

## One next step, one count (stress test 2026-11-11, claude-f)
The owner's words: "easy to know next step". The page has exactly one filled button, chosen by `homeNext()` in compute.js
(tested for every kind of household), so the Dashboard, Get started and Your plan name the same next thing with the same count:

| household | the one filled button | count shown |
|---|---|---|
| nothing answered | "Set up my plan" in the hero, on the first screen; the six basics listed with no row marked next | none |
| part way through the questions (with or without an account) | "Continue your plan: question 3 of 7" (the welcome screen counts as question 1) | the question only |
| questions done, no account ticked | "Continue your plan: Your month" in the hero, "See your plan so far" under it; tile "Change an answer" | "step 2 of 4" in the sentence |
| a plan in use, path under way | "Continue your plan: <step>" | "Your plan: step N of M" |
| a plan built by hand, the questions never opened | "Continue your plan: Set your first goal" (the path's first step is done by the five basics) | none; the basics list stays open |
| path complete | "Your next move: <move>", else "See your plan" | none |
| the questions turned off on this device | "Do step N: ..." under the six basics (design log 2026-09-15, round 1) | the basics' |

While a filled button above already says the next thing, the six basics never add a second next thing or a second count with
the word "step": they fold to "What's in your plan: N of 6 basics" (the folded form of 2026-09-15 pass 2), and the guesses
cards draw their first button outlined (`quiet`). The where-you-stand sentence is setup's `standing().headline`, trimmed by
`calmHeadline()`: no "the moves below" (nothing below is a list of moves) and, while the path is under way, no "X is next"
beside a button that continues the path. Words only; no figure changes. Rows: "Left over each month" says only what is
missing (pay, spending); "Retirement" says "Needs what you spend each month" when Social Security and the ages are known and
only the spending is missing, and the retirement-savings row opens "What do you have?" (where the tick is), not the amounts
screen. Months of cash use `monthsNear()` (core/words.js): 2.8 of 3 is "2.8 months", never "3 months" beside "Aim for 3".
On a phone under 360 px each row's explanation goes under its figure, so the filled button is at the first screen's edge.

The check-in row (`checkInDue`) shows all month while the month just ended is not checked in on, and opens that month
(`?month=`); once checked in it says "October check-in done ✓ · Next: early December, to look back at November" (not while
the balances row is due). The six basics' fold no longer carrying its own filled button is a consequence of the 2026-11-06
rule (one filled button continues the path), not a new decision; noted for the design log on the workboard.

## The month's check-in (2026-11-02, round 3 of the owner's experience list)
(Since 2026-11-11: all month, see "One next step, one count" above.) While the month just ended has no entry in `plan.reviews`, the "where you stand"
card has one row "Your October check-in · Start ›" opening the Monthly review. Its first step is the balances, so the
row takes the stale-balances row's place instead of adding a second one; the owner's three What-to-do-now cards stay.

## When the bank shows more going out (2026-11-02, round 4)
With setup's `standing.bank` (the bank files show clearly more going out than Expenses lists), the left-over row is amber,
says "By your plan. Your bank shows about $5,350 a month more going out" and opens Expenses; the headline and the first
move say the same. A row reading $3,804 in green beside a bank that shows the household short was the round-4 finding.

## Our guesses' cards (smart guesses C7, 2026-11-06; spec 11.3)
With a day (and the guesses registry merged from every manifest, `registryOf`), `compute(plan, { today, estimators,
tables })` adds `guesses` (overview/guesses `guessCards`) only while one applies: `{ fill, missing, upgrade, first }`.
The shell's own `compute(plan)` (no day) has no such key, so every other reader of `ctx.derived` is as before. The view
shows one card, `first`, only with money in the plan: "Fill in what you skipped" (blanks a plan made before the guesses
has: a debt picked with no balance, or no spending at all; compact, no rows fold; question 6's open questions as
chips; a line of what else the tap changes) or "Is something missing?" (a typed list far below what households like
this spend) right under "where you stand" (C7 UX review 2: a green "Left over" with the card a screen below read as
money to spare), else "Better guesses are ready" (the older Get started figures, its first two changes with their
why-lines, "Plus one small change of under 2%.", "See all on Our guesses for you ›") after the money tiles. While fill
or missing is up, the rows of "where you stand" that it decides wait on it and lead to it (one way to fill in
spending, UX review 4): "Left over each month" ("Depends on your spending: not counted yet", "...: your list may be
missing about $2,460 a month", or with a debt alone "Depends on what you owe: not all counted yet"), "Safety cushion"
when it is open and the spending is not counted ("Needs your spending"), and "Retirement" whatever its verdict
("Depends on the figures below"): no coloured dot, "See below ›", `#/overview/guesses`, and a tap scrolls to the card.
(The headline and the next move are overview/setup's `standing` and Next best action's, another batch's files.) Each
card lists what its filled button writes; nothing is written before a tap; "Not now", "That's everything" and "Keep the
old ones" write only the answer. The green line a tap leaves is kept in a module-level `pending` and shown where the
card was on the next render, with an outlined "Undo" after a tap that wrote figures (overview/guesses `sayNotice`). The
cards are drawn by overview/guesses `fillCard`, `missingCard` and `upgradeCard`; "What is coming" is not touched
(DESIGN_LOG 2026-09-15). Not changed (designer-lane words outside the cards): "You owe ... loans, cards, mortgage"
lists every kind whatever is on file (C7 UX review 12).

## The first day (2026-11-02, round 4)
- Set up my plan stopped part way: the start-here tile says "Question 3 of 7. Next: your ages. Pick up where you left off"
  and links to that screen (start/compute.js `setupCard`, the same card Get started shows). With money in the plan the
  six-step card becomes one card, "Set up my plan: question 4 of 7", with "Pick up at question 4"; the old six-step list
  and its "Do step 1: Add your accounts" (the raw form the questions replaced) no longer show beside it.
- Finished with only the assumptions look left (also on Needs attention), the folded line reads "Set up my plan: done ✓",
  not "5 of 6 done" right after "You did it".
- The check-in row uses monthly-review's `checkInDue`: a plan made this month is not asked about last month.
- The Goals tile counts a goal waiting its turn apart: "1 starts in April 2028" (alerts' `goalsBehind`).

## Inputs
Reads the plan sections listed in `needs` only to decide which setup steps are done. Money
numbers come from other modules through `ctx.computeOf("balance/net-worth")` etc.; where you stand from
`ctx.computeOf("overview/setup", { today, screen: "done" }).standing` (about 14 ms for the family fixture).

## Outputs
`steps[]` `{ key, label, done, go: [group, id] }`, `doneCount`, `total`, `next`, `setupFinished`
(`plan.guide.setup.finishedAt` is set), `hasMoney`, `noteCount`.

## Formulas
None.

## Edge cases
A step whose target page does not exist yet shows a "page not built yet" pill instead of a link.

## Tests
`module.test.mjs`: checklist counts; a finished setup folds the checklist while it still knows what is open.

## Safety cushion while costly debt comes first (round 4, 2026-11-02)
The "Where you stand" Safety cushion line uses setup `standing().cushionLater`: amber dot and "Enough for now; N months after the costly debt" instead of a red dot and "Aim for N months" when the plan pays costly debt before the full fund.

## Review fixes 2026-11-02 (setup resume)
The "pick up at question N" card shows only while a step of the plan is still to do (the assumptions look aside). A plan built on its own pages after the first question keeps its "N of 6 done" checklist or the folded "done" line.

## Short on the careful month (review 2026-11-02)
When the left-over figure is below 0 only because Side income's "count on" holds part of uneven pay back (no bank gap, not
drawing in retirement, Next best action's `spare.held` above $0.50), the "Left over each month" row reads "In a lean
month. When all your uneven pay comes in, $X is left" (X = spare + held; "it is still $X short" when that is below 0),
and the sentence above the rows is setup's own. Review 2026-11-02, round 5: the sentence and the figure come from setup's
`standing()` (`headline`, `lean: { full, about }`), so the setup's done screen and this card say the same; the card no
longer works out a held amount or a sentence of its own. The row's figure is `lean.about` ("about $X is left"), to the
nearest $10 as every page says it. Test: `module.test.mjs`. A full month within $5 of $0 (second review of round 5):
`lean.kind` "even" (Next best action's `spare.fullKind`) reads "In a lean month. When all your uneven pay comes in, it only
just about breaks even", never "about $0" (test: `overview/setup` `module.test.mjs`).

## Ideas / not yet
- Headline cards for cash flow (this month), next bills, goal progress, plan health score.
- Alerts feed (low balance, budget overrun, rebalance drift, stale snapshot).
- "Next best action" from the r/personalfinance flowchart (see docs/RESOURCES.md).

## One first step (review 2026-11-11, claude-r round 1, claude-f)
`firstStep(plan)` says the path's first step one way for the Dashboard (homeNext), Your plan, Get started and the quiet row at the bottom of every page: `questions` (started, not finished: "question q of 7"), `start` (never opened and no accounts yet, even with pay or people in: "Set up my plan", as Next best action says it), or `basics` (never opened, accounts in: the first missing basic), else null (N4, N5 and their attack). On a phone under 360 px wide the check-in row goes under the filled button, so the button stays on a 568 px first screen (N10).

## Left2 merge (2026-11-11, claude-c)
Get started's where-you-stand sentence no longer says "the moves below" at the source (setup README, W b); `calmHeadline`
still trims the old words and now also drops the new "Your next move starts there." while the path is under way.

## Left2 fix round 1 (2026-11-12, claude-c; tests `tests/left2-fix1.test.mjs`)

The month's row reads "Short each month" with the amount as a plain figure when the month runs short (never "-$550 Left over
each month"), and with a typed leftover below zero and goals it says what the goals add (L-3). While the month waits on our
guesses the row keeps the name "Left over each month".

## "Look over our guesses" (smart guesses C5 B7, 2026-11-13)
The checklist's sixth step was "Check the assumptions (inflation, returns, retirement age)", done by Assumptions' own
`reviewedAt`. It is now **"Look over our guesses"** (short label the same), linking to Our guesses for you
(`overview/guesses`), and done once "These look fine" was tapped there (`guide.guessesLookedAt`), or when no big guess is in
use in a plan that holds something (`bigGuessInUse(plan, estimators)`: any ledger entry or older flag whose estimator weight is
"big", or whose key no module defines any more; the weights come from the registry the view passes, else the guesses' and
setup's own estimators merged). The key stays `assumptions`, so every reader of it (the one next step, Get started's path, the
checklist fold) keeps its place; the next step is the same either way (a test runs it on the fixture plans). The market
assumptions are planning choices, one tap away in that page's fold.

## Each waiting figure says what it waits for (C5 follow-ups, 2026-11-13; hand-off rows H3, C1, N7, C3)
- **A figure that cannot be worked out** (left over, emergency fund, retirement) says setup's `standing().tileWhy`, the reason Get
  started's summary gives on the same tile ("Needs your savings", "Needs what comes in" for a household where nobody works), its
  period dropped; the retirement row opens the question `standing().tileAt.retire` names ("What do you have?" when the savings
  are what it waits for). "Needs a few more of your figures" still opens Will the money last?, which lists them.
- **The left-over while it waits on our guesses** says what it waits for, by `standing().spareWaitsOn` (spending, pay or both;
  critic M1), in the summary tile's own words (`SPARE_WAITS`, the same strings as setup/view.js: a test reads both): "Depends on
  your pay. With our pay guess, about $1,370 spare" with "Type your pay ›" to the pay question; "Depends on your spending. With
  our spending guesses, ..." with "Type yours ›" to the spending question; both: "Depends on your pay and spending. With our
  guesses, ..." (the tile's two lines are one sentence here, so the pay and spending are named once; `spareWaitsRow(st, money)`).
- **Goal amounts left blank** (`guessCards().first === "goals"`: a card that holds only a home or education goal's amount) never
  put the month or retirement rows in the waiting state (`gc.waitsMonth` decides that, not `gc.first`): the card shows after the
  money tiles, its button outlined, and its tap writes the goal amounts alone (`fillCard(..., { only: "goal", quiet: true })`).
- **The Goals tile** is Your plan's goals line (`goalsWords` and `guessedGoals` from overview/plan/words.js, said once): a goal
  whose amount was left blank is "1 needs an amount", never "all on track", and one behind on our guess of its amount says so
  in the short form (`short: true`; critic F5: the full line ran to four lines at 320 px), the need worked out from our amount
  left to Goals and Your plan: "1 goal behind by our guess of its amount; 1 needs an amount" (hand-off H1, N1).
- **Retirement, short or tight:** "Small changes help" only when they would (plan/words.js `smallChangesHelp`: the plan carries
  85% or more of the yearly spending, from `computeOf("retirement/projection")`); else "Check the numbers first", which opens
  Will the money last? at "What this answer rests on" (`?check=1`; retirement spec D1, L12: Morgan, whose plan carries a quarter
  of the spending, read "Small changes help").

## Inside a pretend family (gap design #20, 2026-11-13, by claude-b)
While a pretend family is on screen (`ctx.store.demo()`, `core/demo/README.md`) the page's one filled button goes through
`lookNext()` (`core/demo/names.js`): "Continue your plan: Your month ›" reads **"Look at: Your month ›"**, and the
"Your plan: step 2 of 8" line above it is left out. Same link, same kind; any other label ("See your plan", a next move)
is unchanged. `homeNext()` and every figure are untouched, so the person's own Dashboard is exactly as before.
Test: `tests/demo.test.mjs` ("the Dashboard's button inside a pretend family").
