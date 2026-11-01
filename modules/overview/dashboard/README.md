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
3. "What to do now" (Needs attention, Import a bank file, Ask a question), unchanged (the owner's three; when the oldest balance is 25 or more days old a fourth line in "where you stand" says so, "Your balances: the oldest is from 10/1/2026, 31 days ago · Update ›", opening Update my balances, not as a card here).
4. The setup checklist: folded to one line once every step is done, or once "Set up my plan" is finished ("Set up your
   plan: done ✓", with "Change an answer" inside); the assumptions step then stays a to-do on Needs attention. While
   the where-you-stand card shows a move, the checklist's "Do step N" is outlined, so the page keeps one filled button.
5. "What is coming", unchanged (the owner's choice, design log 2026-09-15: "leave as is for now, once built it won't
   exist").

An empty plan: the hero says "Start with a few easy questions. It takes about five minutes."; "Start here" opens with
Set up my plan; the checklist's button is "Do steps 1 to 5 in one go: Set up my plan" (the setup writes the accounts,
people, income, spending and goals those steps ask for). Without the setup page (switched off), the old wording and
"Add your accounts".

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

## Ideas / not yet
- Headline cards for cash flow (this month), next bills, goal progress, plan health score.
- Alerts feed (low balance, budget overrun, rebalance drift, stale snapshot).
- "Next best action" from the r/personalfinance flowchart (see docs/RESOURCES.md).
