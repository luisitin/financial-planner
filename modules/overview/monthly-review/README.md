# Monthly review  (`overview/monthly-review`)

**Status:** usable (phase 9)
**Purpose:** Walks you through the month in ten minutes: fresh balances, the bank files, spending against the budget, the change in net worth, goals and what needs attention, then marks it reviewed with a note.

## Inputs
`accounts` (balance dates), `netWorthHistory`, `transactions`, `budgets`, `goals`, `reviews`, and through other computes: Net worth, Categorise, Budget, Where the money goes, Goals, Needs attention, Next best action. Params: `today`, `month` ("YYYY-MM"; default `defaultMonth(today)`: the month just ended during the first `LOOK_BACK_DAYS` (10) days, else this month). Writes `reviews` (only through "mark reviewed").

## Outputs
`{ ready, missing, month, label, choices, steps[], done, todo, reviewed, history, streak }`; each step `{ id, title, status: done|todo|info|skip, detail, go }`. `markReviewed(draft, month, today, note)` adds or replaces the month's entry (one per month, kept in month order).

## The steps
1. Update the balances: done when every account's balance was typed in the last `FRESH_DAYS` (20) days. (Until 2026-11-01 a balance dated anywhere in the reviewed month counted, so the October review on Nov 1 ticked balances from Oct 1 as done.) Opens Update my balances while any is older. The saved net-worth point's date is shown in words.
2. Save the month's net worth: done when `netWorthHistory` has a point after the `LOOK_BACK_DAYS`-th (10th) of the month through the 10th of the next month (`monthPoint`), the newest one; the change is against the newest point saved on or before the 10th of the month. So October's review on Nov 2 counts a point saved that day ("$306,074 saved on 11/2/2026: up $10,965 since 10/2/2026"), and a point from Oct 2 alone (October's own start, which was September's review) leaves it to do. (Until 2026-11-02 only a point dated inside the month counted, so a review in early November could never tick October, and the change was against the month's own start; a first fix that day still let October 1-10 count, so the start-of-month point ticked the step and compared with nothing.)
3. Bring in the bank files: done when the month's files are in: the account files cover the whole month (`monthCover(...).full`, from Transactions > Ledger's coverage), or, for the month still running, they start by the `COVER_SLACK`-th day and reach within `COVER_SLACK` days of today. A file that stops on the 1st of the month leaves it to do: "Your files stop on 11/1/2026: import the rest of November 2026." "Optional" (skip) when the plan keeps no transactions. (Until 2026-11-02 one transaction dated in the month ticked it.)
4. File what came in: the month's transactions with no category and no transfer link. While the month's files are not in and nothing is unfiled it waits for them (skip), never "done" (until 2026-11-02 an empty month read "every transaction is filed").
5. Spending against the budget (a thing to look at, not a chore): envelopes over their amount for the month (Budget) give it an amber ring, or a pointer to set envelopes up; it waits (skip) until the month's files are in (it read "$0 spent" and ticked). Since 2026-11-02 an envelope over budget no longer blocks marking the month reviewed: being over is something to see, not a task you can finish.
6. Where the money went (information): the month's spending against the month before in dollars and as a share ("up $60 (5%) on September 2026"; on the same days of it when the file covers part of a month), the biggest category. (It printed the share as dollars: "up $0".)
7. Check the goals, 8. Look at what needs attention, 9. Take the next step: things to look at, shown with how they stand (a goal behind or an alert to fix gives the number an amber ring, `state: "todo"`), never counted: a goal can be behind for a year and the month is still reviewed. (Until 2026-11-02 they were counted, so no household with a goal behind could ever finish.)
`done` / `todo` count only the chores (balances, net worth, bank files, filing).

Each step opens its page with `?from=review&review=YYYY-MM`: the page shows "‹ Back to the October 2026 check-in" (overview/guide's frame, mode "review"), and Budget and Where the money went open on the month under review (`?month=`) until a month is picked there.

The month still running cannot be marked reviewed (`ended` false): its steps can be done, and the card says "November 2026
is still going: mark it reviewed in early December", with a button to the month just ended. Marked on the 2nd, it hid the
real check-in (the Dashboard asks only for a month not yet reviewed) though its files and spending were not in yet (2026-11-02).

Once the month is marked reviewed, the hero says "October 2026 is done ✓" with the month in a line (`summary`: net worth's change since the point before, spending and its change) and the next check-in ("early December, for November 2026", `nextCheck`); the steps fold behind "All steps". Nothing new is stored.

From the 1st to the 10th, while the month just ended is not reviewed, the Dashboard's "where you stand" card has one row "Your October check-in · Start ›" (it takes the stale-balances row's place, since the review starts with the balances).

## A plan made this month (2026-11-02, round 4)
`firstDay(plan)` is the earliest day the plan holds anything for: an account's balance date or history point, a saved
net worth total, a bank line, a review (not `meta.createdAt`: an app opened empty in October and filled in on November 2
has nothing to look back on in October). `checkInDue(plan, today)` is the Dashboard's check-in row: the first ten days,
accounts on file, last month not reviewed, and `firstDay` before the 1st of this month. `defaultMonth(today, plan)` opens
on this month for a plan with nothing older, so a plan made on November 2 is not handed an "October 2026 review"; its
first check-in comes in early December.

## Data
New plan section `reviews: [{ month, at, note }]` (`core/schema/migrate.js`; `migrate()` adds it to older plans, no version bump; `docs/DATA_MODEL.md`).

## Tests
`module.test.mjs`: the month chosen for a date, the section added to old plans, the family's steps, a month with transactions, marking reviewed (replacing, the streak, a gap).

## Ideas / not yet
- A short monthly report to keep (the review's figures frozen with the note); reminders on the Dashboard when the month is not reviewed by the 10th; the Annual review pack built from these.
