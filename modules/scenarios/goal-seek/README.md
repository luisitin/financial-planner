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
| When the first person can retire | the earliest age from this year's (stopping now) to the later of 75 and the planned age that meets it, the plan rebuilt at each age (`earliestRetireAge`, exported: Financial independence leads with the same answer, 2026-11-02); compared with the plan by the year they stop, `max(this year, birth year + age)`, so 64 now and 65 later this year are the same year ("This year, as planned") |
| What you need to save | the smallest change a month to what goes into retirement accounts before retirement: more goes into the bucket of the biggest contribution; less scales every contribution down (to zero at most) |
| The return it needs | stocks and bonds moved by the same amount until it meets the goal; shown as the blend on the plan's mix (the average of the stock share now and in retirement) |
| Room today / short today | the most that could come out of savings now and still meet it, or the least that would have to go in (engine `events`) |
| When to claim Social Security | everyone who has not claimed yet claiming at the same age, from max(62, today's age rounded up) to 70: the age where the most can be spent while meeting the goal. Who already gets it (Income has their Social Security, or setup's answer is "getting") or is 70 or over is not moved, and the sentence says so (round 4, 2026-11-02: before, the lever moved a 76-year-old's claim back to 62) |
`largestWhere` / `smallestWhere` are monotone bisections (tested).

## Edge cases
Not ready without the plan basics. No retirement lever once retired, no saving lever once retired, no claiming lever without Social Security figures. A lever that cannot reach the goal on its own says so ("not on its own").

## Tests
`module.test.mjs`: the search helpers; each answer checked as the edge (it meets the goal there, and a step beyond it does not); a $3 million legacy (out of reach for spending and retiring; the saving, return and lump-sum answers verified by re-running the plan); the claiming curve.

## Review fix 2026-11-02 (claim now)
The claiming lever tries "now" (today's age to the month, the Social Security page's first choice) as well as each whole age to 70, so "claiming at 70 spends the most" is checked against claiming now; ages read "69 and 5 months".

## Ideas / not yet
- Two levers at once ("retire at 60 and spend $8,000: what must I save?"); goal seek on the Monte Carlo chance (90% instead of expected returns); save a solved value into the plan with one tap.

Today's age as a claiming age is in years and months (69.4166...): the card's big figure says "now" and its bar "now";
the sentence says "now (69 and 5 months)" (2026-11-02: the first version printed "age 69.41666666666667").

## Average markets, said so (round 5, 2026-11-02)
The spending lever is markets earning exactly the average every year: its sentence now says "If markets do as well as average,
up to about $9,320 a month...". Under its figure the view adds "In 9 of 10 markets: about $7,500 a month" (with a goal to
leave money, "..., leaving $250,000"): Monte Carlo's careful figure for the same goal (`spendingAtChance(inputs, { legacy })`,
on the Chance page's 2,000 paths), worked out after the first paint as on Will the money last? (`modules/retirement/careful.js`),
so the page that links here and this one say the same. No line when nothing lasts in 9 of 10 markets. The Social Security
lever's "spend the most" figure is the same average-market kind and says so too.
The retire lever's age is the average-market one too and says so ("If markets do as well as average, as early as 58, 7 years
before the plan's 65"); Financial independence leads with the age that lasts in 9 of 10 markets. "Years before" is counted by
the year they stop (`yearsSooner`): someone 64 today who turns the planned 65 in December stops in 2026 either way, so the
lever reads "This year, as planned." at the planned age instead of "1 year before" (review 2026-11-02).
