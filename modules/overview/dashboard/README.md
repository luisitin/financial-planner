# Dashboard  (`overview/dashboard`)

**Status:** usable (grows as pages are added)
**Purpose:** the landing page: headline numbers, a setup checklist, and a directory of every enabled page.

## Inputs
Reads the plan sections listed in `needs` only to decide which setup steps are done. Money
numbers come from other modules through `ctx.computeOf("balance/net-worth")` etc.

## Outputs
`steps[]` `{ key, label, done, go: [group, id] }`, `doneCount`, `total`.

## Formulas
None.

## Edge cases
A step whose target page does not exist yet shows a "page not built yet" pill instead of a link.

## Tests
`module.test.mjs`: checklist counts.

## Ideas / not yet
- Headline cards for cash flow (this month), next bills, goal progress, plan health score.
- Alerts feed (low balance, budget overrun, rebalance drift, stale snapshot).
- "Next best action" from the r/personalfinance flowchart (see docs/RESOURCES.md).
