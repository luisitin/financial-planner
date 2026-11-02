# Annual review pack  (`reports/annual-review`)

**Status:** usable (phase 9)
**Purpose:** The year in one pack: net worth from start to end, the money in and out, where it went, the months you reviewed and their notes, the goals, and what next year holds.

## Inputs
`reviews` (Monthly review), `netWorthHistory`, `transactions` (through Income statement and Where the money goes), Goals, Plan health score, Life timeline, Next best action. Params: `today`, `year` (default `defaultYear`: last year in January and February, else this year so far). Writes nothing. `heavy: true` (the health score runs the stress tests).

## Outputs
`{ ready, missing, year, today, partial, reviews, netWorth, money, categories, goals, health, ahead }`.

## The pack
An opening (the net-worth change, money in and out with the share kept, months reviewed, the health score), net worth (from the last point saved before the year, or the year's first, to its last; a chart from three points), money in and out by month from the bank files and the year's spending by category (the top ten), the months reviewed with their notes, goals reached and open, and what next year holds (the timeline's moments dated next year, the next steps from Next best action and the health score's biggest gains). Prints through `../report-kit.js`.

## Net worth through the year (2026-11-02, round 4)
The year so far ends at today's balances (balance/net-worth `compute`, the Dashboard's figure), dated today and labelled
"Today": "from $257,000 on January 1, 2026 to $287,100 today: up $30,100". It used to end at the last saved total, which
for most people (who never press "Save today's totals") was the start point itself: "up $0". The start is the last total
saved before the year, else the year's first. A year that is over ends at its last saved total and says when that was if
it is not from December (`lastSaved`). With no saved total at all, the review gives today's figure and no change.

## Tests
`module.test.mjs`: the default year; the net-worth start from the point before the year, the year's reviews, next year's moments; the bank files' months and category shares.

## Ideas / not yet
- Last year's pack frozen and kept (so a later edit does not rewrite history); the year's tax return beside the estimate; investment returns for the year (Performance).
