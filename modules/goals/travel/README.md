# Travel and events  (`goals/travel`)

**Status:** usable (phase 4)
**Purpose:** Trips, a wedding and other big days priced from their parts, with what to put aside each month to pay for each in cash by its date; each can become a goal on the Goals page.

## Inputs
`events` (new optional plan section), `goals` (a linked goal's money), `assumptions.returnCash`. Writes `events[]`: `{ id, name, kind: "trip"|"wedding"|"other", date, goalId?, saved?, ...the kind's parts }` and, on "Make it a goal", a goal (priority nice to have, target = the total, monthly = what it needs) linked by `goalId`.

## Formulas
- A trip = people (at least 1) x flights per person + nights x lodging a night + people x (nights + 1) days x food per person a day + activities + other.
- A wedding = guests x food and drink per guest + venue + clothes + photos + rings + other. Something else = its budget.
- Put aside a month = pmtToReach(cash return / 12, months to the date, the total, set aside); set aside = the linked goal's money, else `saved`.
- The monthly total counts upcoming events only; the next event is the nearest dated one.

## Tests
`module.test.mjs`: a trip's parts (and one person at least), a wedding and a budget, no events, ordering, the monthly by hand, past events, a linked goal.
