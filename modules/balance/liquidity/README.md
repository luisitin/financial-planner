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

## The next move (2026-11-02)
When Next best action's next step is the starter fund ("Keep one month of bills in cash") or the full fund, the page shows
that move right under the fund card (which stays first, months as the headline: DESIGN_LOG 2026-09-15, round 13, Finding 2;
the first version put the move above it), because the Dashboard's button sends people here: how much more cash (the step's `gap`), where to keep it,
and when the money left over each month after tax, bills and saving (Next best action's `spare`) gets there (the step's
`doneDate`). Under it are balance boxes for the cash accounts (cash, checking, savings) that no goal saves in: money put in
an account a goal claims counts for that goal (F-020), not the cushion. Saving them works as Update my balances does
(`saveAll` from balance/update: each balance dated today, today's totals on Net worth's history), and the confirmation says
whether the move is done and names the next one from the Dashboard's own list (overview/setup `standing().moves[0]`).
When a goal that reads as an emergency fund (the words goals/emergency-fund looks for, or the 🛟 icon) saves in a cash
account and is not yet counted as the cushion, the card offers the same opt-in as goals/emergency-fund ("This goal is my
emergency fund", `goals[].isEmergencyFund`); nothing changes until it is tapped, so F-034's owner decision stays open.
The page's last link goes to Update my balances (all balances on one screen) instead of Net worth.

## Edge cases
No accounts: empty state with links. Accounts but no expenses: tiers shown, a note asks for expenses. No must-pay expenses: target 0, status unknown, a note explains. Negative balances typed by mistake count as positive.

## Tests
`module.test.mjs`: tier sums and ordering, liabilities excluded, runway and target arithmetic, status thresholds, no-must-pay case.

## Enough for now (round 4, 2026-11-02)
When next-best-action's `cushionLater` is set, the fund card's pill reads "enough for now" (amber), the bar is amber instead of red, the sentence says costly debt comes first and when the plan builds the full months, with an outlined "Open my payoff plan" button. The usual "thin" verdict is unchanged when there is no costly debt, or under one month in cash.

## Tax not yet paid (round 4, 2026-11-02)
Usable today = cash, checking and savings - what goals claim (`earmarked`) - `taxOwed`, this year's federal tax on what is already earned and not yet paid (Estimated payments' `taxOwedNow`; 0 unless the household pays its tax itself), never more than the cash left. The tile says "$X more is this year's tax, not paid yet" and the fund card says the amount is left out of the cushion, with the next payment linked to Estimated payments. Before, a freelancer with $16,900 in the bank read "5 months covered" while about $6,500 of it was owed in tax.

## Ideas / not yet
- Count available credit (cards' limits minus balances) as a separate "backstop" line.
- Daily cash forecast (phase 4 `cashflow/forecast`) to show the lowest balance in the next 90 days.
