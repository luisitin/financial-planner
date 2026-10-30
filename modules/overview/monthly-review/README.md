# Monthly review  (`overview/monthly-review`)

**Status:** usable (phase 9)
**Purpose:** Walks you through the month in ten minutes: fresh balances, the bank files, spending against the budget, the change in net worth, goals and what needs attention, then marks it reviewed with a note.

## Inputs
`accounts` (balance dates), `netWorthHistory`, `transactions`, `budgets`, `goals`, `reviews`, and through other computes: Net worth, Categorise, Budget, Where the money goes, Goals, Needs attention, Next best action. Params: `today`, `month` ("YYYY-MM"; default `defaultMonth(today)`: the month just ended during the first `LOOK_BACK_DAYS` (10) days, else this month). Writes `reviews` (only through "mark reviewed").

## Outputs
`{ ready, missing, month, label, choices, steps[], done, todo, reviewed, history, streak }`; each step `{ id, title, status: done|todo|info|skip, detail, go }`. `markReviewed(draft, month, today, note)` adds or replaces the month's entry (one per month, kept in month order).

## The steps
1. Update the balances: done when every account's balance is dated in the month or later (or within 20 days of today).
2. Save the month's net worth: done when `netWorthHistory` has a point in the month; says the change since the last earlier point.
3. Bring in the bank files: done when transactions are dated in the month; "optional" (skip) when the plan keeps no transactions.
4. File what came in: the month's transactions with no category and no transfer link.
5. Spending against the budget: envelopes over their amount for the month (Budget), or a pointer to set envelopes up.
6. Where the money went (information): the month's spending against the month before, the biggest category.
7. Check the goals: behind or past due.
8. Clear what needs attention: Needs attention's counts and the first item.
9. Take the next step: Next best action's next step.
`done` / `todo` count only the steps that can be done or to do (not information or optional ones).

## Data
New plan section `reviews: [{ month, at, note }]` (`core/schema/migrate.js`; `migrate()` adds it to older plans, no version bump; `docs/DATA_MODEL.md`).

## Tests
`module.test.mjs`: the month chosen for a date, the section added to old plans, the family's steps, a month with transactions, marking reviewed (replacing, the streak, a gap).

## Ideas / not yet
- A short monthly report to keep (the review's figures frozen with the note); reminders on the Dashboard when the month is not reviewed by the 10th; the Annual review pack built from these.
