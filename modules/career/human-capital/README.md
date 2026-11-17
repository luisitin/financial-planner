# Human capital  (`career/human-capital`)

**Status:** usable, phase 10
**Purpose:** What all the pay you are still going to earn is worth today, against your savings over the years, and what it means for insurance and investing.

## Inputs
- Adults with a birth date and retirement age (`household.people`); their salary, bonus and business income (`cashflow/income`, active today).
- `assumptions`: inflation, salary growth, bond and stock returns.
- `whatIfs.humanCapital = { [personId]: "steady" | "average" | "volatile" }` (default average).
- The federal and payroll tax share of pay (`overview/next-best-action` `spare`); life policies naming each earner
  (`insurance.policies`, kinds term, whole, universal, life); investable savings (`balance/net-worth`); the retirement
  projection's year-end balances in today's dollars.

## Outputs
`{ ready, people: [{ id, name, age, retireAge, years, pay, risk, rate, realRate, value, afterTax, cover, coverShare }], total, totalAfterTax, takeHome, financial, share, path: [{ year, human, financial }], crossYear, real, raiseGain }`.

## Formulas
- Everything in today's dollars: real growth g = (1 + salary growth) / (1 + inflation) − 1; real discount r likewise.
- Discount by how steady the pay is (after Ibbotson, Milevsky and Chen, "Lifetime Financial Advice", CFA Institute
  Research Foundation, 2007: human capital is valued at a rate that reflects the job's risk): steady = the bond return,
  average = bond return + 2 points, volatile = the stock return.
- Value = Σ_{k=1..years} pay × (1 + g)^k / (1 + r)^k, years = retirement age − age (pay at each year's end).
- After tax = value × (1 − (federal + payroll tax) ÷ gross pay), the household's share today.
- Path: at year t, the pay still to come = Σ over earners of the same sum from t (pay grown t years); savings = the
  retirement projection's `totalReal` at the end of the year before (today: investable savings). The cross year is the
  first where savings ≥ pay still to come.
- Raise gain = Σ earners Σ_k pay × ((1 + g + 1%)^k − (1 + g)^k): the extra pay from raises one point bigger, undiscounted.
- Share = value ÷ (value + investable savings). Life cover share = cover ÷ after-tax value.

## Edge cases
- No earner with pay and a birth date: a hero. An earner past retirement age: 0 years, left out of the path.
- Survival to retirement is assumed (no mortality weighting).

## Tests
After tax (2026-11-02): the household's federal, payroll and state income tax as a share of pay, from Next best action's month.

`module.test.mjs`: the present value by hand, not ready, the family by hand (rate, after tax, share), steadiness, the
path falling to zero against the projection with a cross year, life cover and the raise gain.

## Ideas / not yet
- Weight each year by the chance of being alive and working (the longevity tables).
- Feed the after-tax value to Life needs as an alternative to its income-replacement method.

Review 2026-11-06 (round 7): "No life insurance on you: the household would lose this pay if you died" says you for the unnamed first adult ("Me") and "your spouse" for the unnamed partner; typed names read as before (core/words.js; view only).

## The steadiness line in plain words (hb1 smoke fix, 2026-11-17, claude-b; test: module.test.mjs "hb1")

The whole-app phone smoke showed the shut "How steady is each job?" row with the status "average, average" (the stored choices
joined). `steadinessWords(people)` now says it the way a person would: one earner "average"; everyone the same "both average" or
"all average"; otherwise each by name, "Ana: steady, Bo: average"; the volatile choice reads "uneven". For the sample family Ana
and Bo, nothing chosen: "both average". Words only: `compute()` is unchanged, no figure moves, and opening the row changes nothing.

Names (critic M1): a typed name as the page's sentences say it ("My spouse" is "Your spouse", core/words.js `NameIn`); the first
person left unnamed ("Me", or no name) is "You", and any later unnamed one "Person 2", "Person 3" by its place among the earners,
so a couple with a blank second name reads "You: average, Person 2: steady", never "You: average, You: steady".

One word for each kind of job (critic F3): the status said "uneven" while the choice inside read "Volatile (commission, a
start-up, your own business)". The choices now read "Steady (...)", "Average" and "Uneven (commission, a start-up, your own
business)", each starting with its status word (`STEADY_WORDS`, a test ties the two), and each earner's line and "What it means"
say "an uneven job" and "Uneven pay behaves like a stock". The stored key stays `volatile` (no data change).
