# Alerts  (`overview/alerts`)

**Status:** usable (phase 2)
**Purpose:** Warns you of stale data, a thin emergency fund, spending above income, expensive or never-ending debt and goals that slipped, each opening its page.

## Inputs
Plan sections read (`needs`): everything the underlying computes read: `household`, `accounts`, `netWorthHistory`, `income`, `expenses`, `debts`, `goals`, `assumptions`. It imports the `compute()` of `balance/net-worth`, `household/people`, `cashflow/income`, `cashflow/expenses`, `goals/goals`, `balance/liquidity`, `balance/liabilities`, `system/assumptions` (all pure).
`compute(plan, { today })`: without `today` the date-based checks (stale balances, history, goal dates, review age) are skipped.

## Outputs
`alerts[]` (`id`, `level` bad/warn/info, `title`, `detail`, `go: [group, id]`), `counts`, `total`, `allClear`.

## Rules (id: level)
- Setup: `no-people`, `no-accounts`, `no-income`, `no-expenses`, `assumptions-unreviewed`: info. `assumptions-stale` (reviewed over 365 days ago): warn.
- `stale-balances`: warn when any account's `asOf` is missing or older than `STALE_BALANCE_DAYS` (90). `history`: info when no net-worth point in `STALE_HISTORY_DAYS` (35).
- `overspend`: bad when expenses exceed income (from `cashflow/expenses`).
- `emergency-bad` / `emergency-warn`: from `balance/liquidity` status.
- `debt-never-<id>`: bad when a payment does not cover interest; `debt-expensive-<id>`: warn at or above 15%; `debt-details`: info when a debt has no rate; `dti`: warn above 43%.
- `goal-late-<id>`: warn when a dated goal is past due; `goal-behind-<id>`: info when contributions are below what is needed.
- `goals-behind` (2026-11-01, round 2 of the owner's experience list): two or more goals behind are one info alert, "4 goals are behind: Japan trip, Emergency fund, Replace Bo's car and Cy's college need about $2,242 more a month in all; nothing is going in to Japan trip yet. You have about $4,170 left over each month." The sum is each goal's `neededMonthly - monthly` (not below 0); goals with nothing going in are named first, so F-015 (such a goal must show, first among the goals) still holds; the left-over is Next best action's `spare.monthly`. One goal behind keeps its own `goal-behind-<id>`. Before, the sample family read "9 things to look at", four of them "X is behind". The goals with nothing going in are named ("nothing is going in to Japan trip or House down payment yet"; "either of them" or "any of them" when it is all of them). `goalsBehind(gl)` works the sum and is exported, so the Dashboard's Goals tile says the same; a goal past its date is counted apart (its whole remaining amount is not a monthly figure), and its Goals-page warning ("...date has passed") is not listed again beside its own `goal-late-<id>` alert.
- Chores (2026-11-01): `assumptions-unreviewed` and `history` ("Save today's totals") carry `chore: true`. They are listed last, left out of `counts`, `total` and `allClear` (`chores` counts them), and the page folds them under "Housekeeping" (also under "All clear"). The Dashboard's "Needs attention: N things" and Monthly review count what needs a look, not housekeeping.
- Warnings the other pages produce (people, income, expenses, assumptions) are repeated here as warn, so one list has everything.
- Sort: bad, warn, info. Ids are stable so a future "dismiss" feature can key on them.

- `tax-bill`: warn. The paychecks look $1,000 or more short of the year's federal tax (`taxAnswer` in taxes/withholding:
  typed withholding, else estimated from pay, and the estimated payments), opening Withholding check (2026-11-02).

## Edge cases
Empty plan: five setup alerts. Complete healthy plan: all clear. No `today`: no date checks.

## Tests
`module.test.mjs`: empty plan, healthy plan all clear, worst-first ordering and links, level assignment, no-today behaviour.

## Ideas / not yet
- Dismiss or snooze an alert (store ids in the plan).
- Budget overruns and bills due (phase 4), investment drift (phase 7), insurance gaps (phase 8) plug in here.
- A count on the dashboard (designer's call; the compute is ready).
