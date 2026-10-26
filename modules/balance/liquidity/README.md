# Liquidity and runway  (`balance/liquidity`)

**Status:** usable (phase 2)
**Purpose:** Shows how many months of expenses you can cover, if your emergency fund is enough and what is liquid today, within a week, or locked up.

## Inputs
Plan sections read (`needs`): `accounts` (types from `balance/net-worth` `ACCOUNT_TYPES`), `expenses` (through `cashflow/expenses` compute), `assumptions.emergencyMonths`.
`compute(plan, { today })`: `today` is passed through to the expenses compute (active items).

## Outputs
`now`, `week`, `later` (asset totals per tier), `accounts[]` (assets only, with `tier`, `tierLabel`, `typeLabel`, largest first), `expenses` (`{ monthly, essentialMonthly }` or null), `runwayMonths`, `fullRunwayMonths`, `targetMonths`, `target`, `gap`, `fundedShare`, `status` (`ok` / `warn` / `bad` / `unknown`), `warnings[]`.

## Formulas
- Tiers (`TIERS`): now = cash, checking, savings; week = brokerage, crypto; later = everything else that is an asset. Liabilities are ignored here; balances are absolute values.
- Runway months = usable-today cash / must-pay expenses per month. Full runway = usable cash / all expenses per month.
- Target = `emergencyMonths` x must-pay expenses per month. Gap = max(0, target - usable cash). Funded share = min(1, usable cash / target).
- Status: ok at 100% of target, warn from 50%, bad below; unknown when there is no target (no expenses, or none marked must-pay).

## Edge cases
No accounts: empty state with links. Accounts but no expenses: tiers shown, a note asks for expenses. No must-pay expenses: target 0, status unknown, a note explains. Negative balances typed by mistake count as positive.

## Tests
`module.test.mjs`: tier sums and ordering, liabilities excluded, runway and target arithmetic, status thresholds, no-must-pay case.

## Ideas / not yet
- Count available credit (cards' limits minus balances) as a separate "backstop" line.
- Daily cash forecast (phase 4 `cashflow/forecast`) to show the lowest balance in the next 90 days.
