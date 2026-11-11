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

## Health cover (review 2026-11-02)
"Guaranteed income covers" (`floorBefore`, `floorAfter`) is guaranteed income in the first retirement year over that year's
spending plus its health cover (the projection's "Health cover" events, marked `spending`, in today's dollars), the same
share as Will the money last?'s "Guaranteed income"; it read the spending alone. Tested against the projection's `coverage`.

Review 2026-11-06 (round 7): each quote's words ("a month from your 65, for as long as you or your spouse lives", "over the lifetime you are likely to have") say you/your for the unnamed first adult ("Me"), with the verb to match; typed names read as before (core/words.js). Words only.

## Calendar years (round 8 batch 6 review, 2026-11-06)
A guaranteed income line counts in the first retirement year only when it is paid that year by both its ages and its calendar
years (`fromYear`, `untilYear`), the engine's own test (projection `incomeIn`). A rented-out condo's loan payment that comes
back only once the loan is paid off (from 2051 on the landlord plan) was counted from 2045, so the share read 138% against the
projection's 123%. Tested on `qa/fixtures/round8-rental.mjs`.

## Stress test 2026-11-11 (claude-e, wave 2)
- **Not ready**: the missing basics as buttons and no form (a quote added then was "added" and shown nowhere). Saved quotes wait.
- **A quote dearer than the savings on file** (RC-9): `tooBig` (premium over cash + taxable + pre-tax + Roth on file, which is what
  the model takes in the first year); the card says so instead of 0% and $0. Both amounts are required (RC-2).

## Loans that end (2026-11-11, loans lane fix round 1, money review D11)
The guaranteed share is against the first retirement year's own spending (`core/math/retirement.js spendingRealIn`): a loan the
figure holds is in it as its fixed payment in that year's prices, as Will the money last?'s coverage has it. A rental's loan the
spending holds is no longer an income from the year after its payoff ("loan back").
