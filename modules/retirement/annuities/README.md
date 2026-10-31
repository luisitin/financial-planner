# Annuities  (`retirement/annuities`)

**Status:** usable (phase 5)
**Purpose:** An income annuity quote against your plan: the payout rate, the return it pays like over the lifetime you are likely to have, what a ladder of bonds paying the same until the plan's end would cost instead, and what buying it does to the plan.

## Inputs
`retirement.annuities` (quotes), the plan (`buildInputs`), `retirement.longevity` (survival). Writes `retirement.annuities[]`: `{ id, name, insurer, personId, premium, monthly, startAge, joint, cola }`. A quote is a what-if: the plan counts an annuity only once bought (entered as a pension). Heavy: per quote one plan run with 300 simulated markets and the affordable-spending search.

## Outputs
`compute(plan, { today, paths })` -> `{ ready, missing, base, quotes[], bondRate, inflation }`; each quote `{ ..., ageNow, payoutRate, rate, ladderCost, ladderSaving, endAge, withIt, floorBefore, floorAfter }` (`base` and `withIt` are scenarios/compare `results`).

## Formulas
- Payout rate = monthly x 12 / premium.
- Payments by year from now: 0 before the start age, then monthly x 12 (x (1 + inflation)^(years since the start) with a cost-of-living rider). Paying with probability S(person) for single life, 1 - (1 - S_a)(1 - S_b) for joint life (How long to plan for's survival curves).
- Return it pays like = pensions' `impliedRate(premium, payments, paying)`: the rate at which the expected payments equal the premium.
- Bond ladder = the payments until the plan's end age discounted at the plan's bond return (no mortality pooling, nothing after). Ladder - premium > 0: the annuity is cheaper for the plan's horizon; the annuity also pays beyond it.
- With it: the plan's inputs with the premium out of savings this year (an `events` entry) and the payment as guaranteed income from the start age (`cola: false` keeps it fixed in dollars), through scenarios/compare `results` (does it last, the chance over simulated markets, the most it could spend a month, at the end).
- Guaranteed income covers = Social Security, pensions and annuities in the first retirement year, fixed-dollar ones in today's dollars, / that year's spending.

## Edge cases
- The whole payment is taxed (as from an IRA); bought with taxed savings part of it would be a return of principal (the exclusion ratio): the page says so.
- State guaranty limits are mentioned, not modelled: usually $250,000 of an annuity's present value per person, per failed insurer, with an overall cap; some states go higher (up to $500,000) (NOLHGA, "How You're Protected", state table based on information as of June 1, 2025; read 2026-10-31).

## Tests
`module.test.mjs`: not ready, no quotes, a quote (payout rate, the implied return by hand, the ladder by hand, savings and the guaranteed share with it), joint life against single and a later start.

## Ideas / not yet
- Live quotes; a qualified longevity annuity contract (QLAC) inside an IRA, which also lowers required withdrawals.
- Buy with a share of savings: the floor that covers essential spending (from Expenses).
