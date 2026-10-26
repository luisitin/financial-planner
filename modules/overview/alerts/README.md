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
- Warnings the other pages produce (people, income, expenses, assumptions) are repeated here as warn, so one list has everything.
- Sort: bad, warn, info. Ids are stable so a future "dismiss" feature can key on them.

## Edge cases
Empty plan: five setup alerts. Complete healthy plan: all clear. No `today`: no date checks.

## Tests
`module.test.mjs`: empty plan, healthy plan all clear, worst-first ordering and links, level assignment, no-today behaviour.

## Ideas / not yet
- Dismiss or snooze an alert (store ids in the plan).
- Budget overruns and bills due (phase 4), investment drift (phase 7), insurance gaps (phase 8) plug in here.
- A count on the dashboard (designer's call; the compute is ready).
