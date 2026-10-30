# Goal seek  (`scenarios/goal-seek`)

**Status:** usable (phase 9)
**Purpose:** Set the goal (the money lasts and leaves what you want to leave) and see what each lever would have to be: what you can spend, when you can retire, what to save, the return it needs, when to claim Social Security.

## Inputs
Everything `retirement/projection` `buildInputs` reads. Params: `today`, `legacy` (today's dollars the plan should still hold at its end; the view's chips and box, kept on the device). Writes nothing. `heavy: true`.

## Outputs
`{ ready, missing, legacy, meets, success, failYear, endReal, spendingMonthly, levers[] }`; each lever `{ id, icon, title, value, current, unit: "month"|"age"|"rate"|"once", status: "room"|"same"|"needs"|"cannot", sentence, go }` (the claiming lever also has `results[]`: what the plan can spend at each age 62-70).

## The goal and the levers
The goal is met when the projection (expected returns) lasts to the end and `endBalanceReal >= legacy`. Each lever is solved alone, everything else as the plan has it:
| lever | search |
|---|---|
| What you can spend | the largest steady, inflation-adjusted monthly spending that meets the goal (`largestWhere`, the ceiling grown until it fails) |
| When the first person can retire | the earliest age from max(next year's age, 45) to 75 that meets it, the plan rebuilt at each age |
| What you need to save | the smallest change a month to what goes into retirement accounts before retirement: more goes into the bucket of the biggest contribution; less scales every contribution down (to zero at most) |
| The return it needs | stocks and bonds moved by the same amount until it meets the goal; shown as the blend on the plan's mix (the average of the stock share now and in retirement) |
| Room today / short today | the most that could come out of savings now and still meet it, or the least that would have to go in (engine `events`) |
| When to claim Social Security | everyone claiming at the same age, 62 to 70: the age where the most can be spent while meeting the goal |
`largestWhere` / `smallestWhere` are monotone bisections (tested).

## Edge cases
Not ready without the plan basics. No retirement lever once retired, no saving lever once retired, no claiming lever without Social Security figures. A lever that cannot reach the goal on its own says so ("not on its own").

## Tests
`module.test.mjs`: the search helpers; each answer checked as the edge (it meets the goal there, and a step beyond it does not); a $3 million legacy (out of reach for spending and retiring; the saving, return and lump-sum answers verified by re-running the plan); the claiming curve.

## Ideas / not yet
- Two levers at once ("retire at 60 and spend $8,000: what must I save?"); goal seek on the Monte Carlo chance (90% instead of expected returns); save a solved value into the plan with one tap.
