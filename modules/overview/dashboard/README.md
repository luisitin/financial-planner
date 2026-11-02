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

## The month's check-in (2026-11-02, round 3 of the owner's experience list)
From the 1st to the 10th of a month, while the month just ended has no entry in `plan.reviews`, the "where you stand"
card has one row "Your October check-in · Start ›" opening the Monthly review. Its first step is the balances, so the
row takes the stale-balances row's place instead of adding a second one; the owner's three What-to-do-now cards stay.

## When the bank shows more going out (2026-11-02, round 4)
With setup's `standing.bank` (the bank files show clearly more going out than Expenses lists), the left-over row is amber,
says "By your plan. Your bank shows about $5,350 a month more going out" and opens Expenses; the headline and the first
move say the same. A row reading $3,804 in green beside a bank that shows the household short was the round-4 finding.

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

## Ideas / not yet
- Headline cards for cash flow (this month), next bills, goal progress, plan health score.
- Alerts feed (low balance, budget overrun, rebalance drift, stale snapshot).
- "Next best action" from the r/personalfinance flowchart (see docs/RESOURCES.md).
