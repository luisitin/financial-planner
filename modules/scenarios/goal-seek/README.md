# Goal seek  (`scenarios/goal-seek`)

**Status:** usable (phase 9)
**Purpose:** Set the goal (the money lasts and leaves what you want to leave) and see what each lever would have to be: what you can spend, when you can retire, what to save, the return it needs, when to claim Social Security.

## Inputs
Everything `retirement/projection` `buildInputs` reads. Params: `today`, `legacy` (today's dollars the plan should still hold at its end; the view's chips and box, kept on the device). Writes nothing. `heavy: true`.

## Outputs
`{ ready, missing, legacy, meets, success, failYear, endReal, spendingMonthly, strategy (the plan's withdrawal rule), levers[] }`; each lever `{ id, icon, title, value, current, unit: "month"|"age"|"rate"|"once", status: "room"|"same"|"needs"|"cannot", sentence, go }` (the claiming lever also has `results[]`: what the plan can spend at each age 62-70).

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

## The spending lever and the careful figure (review 2026-11-05)
When the spending that lasts in 9 of 10 markets is below what the plan spends, the careful line says by how much ("$500 less
than the $8,000 the plan spends") and a green "room to spare" pill turns amber "tight": the average-market figure above it
alone read as room the plan does not have in a bad run of years.

## Review 2026-11-02 (round 5): "now" only when it is now for everyone
Everyone still choosing is moved to the same ages, the first one being the oldest one's age today. The claiming lever
now carries `nowAge` (that first age) and `nowForAll`: true when every person moved is within a month of `nowAge` today.
Only then do the sentence ("claiming now (64 and 6 months)"), the big figure ("now") and the bar ("now") say now.
Otherwise they say "at 64 and 6 months", "age 64 and 6 months", and "64" over "6 mo" under the bar (it fits a 390 px phone). Before,
a couple of 64 and 6 months and 60 and 5 months were both told to claim "now", which is 19 months away for the younger one.
Moving both to the same age is still the design: the younger one's 62 to 64 are not tried, as before.

## Recheck 2026-11-05: the earliest age spends the same every year
`earliestRetireAge` tested each age with the plan's own withdrawal rule. Under "a set share of what is left" (`percent`),
guardrails or years-left spending (VPW) spending shrinks with the money, so the projection never runs short and the family
(Ana, 36, $177,000 invested) read "When Ana can retire: age 36 ... now" while Financial independence's 9-in-10 search (steady
spending) started there and ran 29 ages. Each age is now tested spending the plan's amount the same every year after inflation
(`project({ ...inputs, strategy: "fixed-real" })`), as the spending lever and the 9-in-10 figures already were: the family reads
58 under every rule. When the plan uses another rule the levers card says once: "What you can spend and when you can retire are
worked out spending the same every year; your plan uses another rule, a set share of what is left each year, so what you spend
moves with markets (How much to take out)." The saving, return and lump-sum levers still use the plan's own rule (under the
share rule they read "$0" and "-9.2%", as before; not changed here). Test: `module.test.mjs` "recheck 2026-11-05" (percent,
guardrails and VPW give the steady age on both the function and the lever).

## Health insurance (review 2026-11-02)
The spending answer says what it is measured against, as Will the money last? does: "Up to about $7,440 a month on top of
health insurance, $440 more than the $7,000 the plan spends before health insurance" while the projection adds its health line
(`healthAdded`), and the old words when the spending figure already includes cover (`retirement.healthIncluded`).

## Fifth pass (review 2026-11-02)
"When ... can retire" is about the adult whose stop starts the household's retirement (`leadAdult`, the projection's
`retireBy`): the first adult, unless Get started says they are retired or not working now, then the adult who still works; with
nobody working there is no such lever (retirement is now). `earliestRetireAge` takes the same adult when no `personId` is given.

## Review 2026-11-06 (sixth pass: one work rule with the health line and Financial independence)
- "When ... can retire" is about the adult Financial independence asks about (`leadAdult` and the lever, the projection's
  `workingNow` on its one work rule): the first adult while they still work, else the first other adult who does, else no
  lever. It is searched on the same plan as Financial independence: with the first adult stopping now when they stopped before
  the age on file and the partner has pay on Income (`stopNow`, `withStops`), and the sentence says so: "... This counts Pat as
  stopped from this year." So both pages give one age. The fifth pass took the projection's `retireBy`: Pat (said "retired",
  65 on file) and Tom were searched with Pat working to 65, and with the first adult past their age and a partner at work
  (Sam 68, Lee working) there was no lever while Financial independence asked about Lee.
- `earliestRetireAge` tests each age with steady spending in the plan too, so the health line is priced on the same
  withdrawals: priced on the plan's own rule, a set share of what is left gave the family 61 against 62 (the recheck's test).
- The 68/63 couple with Bo working part-time to 66: "When Bo can retire: Not by 75" with or without Ana's "retired" answer (was
  "at 67" with it and no lever without it; projection README, defect 1).
- Verify of the sixth pass: "How it is worked out" read "Retirement: the first person's earliest age" while the lever is about
  the adult who still works ("When Jo can retire", Jo listed second). The sentence is now `RETIRE_HOW` in compute.js (tested),
  naming the adult who still works and the first person stopped from this year when they have stopped and the other's pay is on
  Income.

## Review 2026-11-06 (round 7): you and your
- Review 2026-11-06 (round 7): the retirement lever's title and sentence and the claiming lever's sentence say you/your for the unnamed first adult and "your spouse" for Get started's partner ("When you can retire", "You and your spouse claiming at 70 ...", "You already get it"), via `core/words.js`; typed names read as before. Test: "review 2026-11-06 (round 7)".

## Arguments for the Plan health score (round 8, 2026-11-06)
`compute(plan, { today, legacy, spendingScale, only, retireSearch })`: the page passes none of the three new ones and works
exactly as before. The score passes them to quote Goal seek's own answers in its retirement hint:
- `spendingScale` (default 1): every lever solved for the plan spending that many times its amount in retirement (1.15 is
  the score's "room for bad luck"); `spendingMonthly` and each lever's `current` are then the scaled amount;
  `earliestRetireAge(..., { spendingScale })` tests each age the same way.
- `only`: lever ids to work (the score asks for spending, retire and saving; Social Security is not even read without
  "claim").
- `retireSearch: "bisect"` / `earliestRetireAge(..., { search: "bisect" })`: try the last age first (none: null at once),
  then halve the range, about 7 projections instead of one per year of age; the same age as the scan whenever stopping
  later never makes the plan worse (`module.test.mjs`, four fixtures, with and without the scale).

## Opened on "Just last" from the score (round 8 review, 2026-11-06)
`#/scenarios/goal-seek?target=last` (the Plan health score's retirement link, when its hint was worked out for the money
lasting on steady spending) opens the page with the goal set to leave nothing ("Just last"), whatever Legacy goals holds; the
page then shows the hint's own figures. Opened any other way, it starts from Legacy goals' amount as before. The score's
115% line is the page's "Room for bad luck" chip: the score links to `?target=badluck` (2026-11-07), which opens Just last with the
chip on. Test: `module.test.mjs` ("review D4"), failing before the fix.
- Seen, not changed here: under a spending rule that never runs out (a share of what is left, guardrails, years left) the page's
  saving lever is tested on that rule and says "Nothing more", while its spending and retirement-age levers are worked on steady
  spending; the score now asks on steady spending throughout. Making the page's saving lever steady too would change the page
  for those plans; left for its owner to decide.

## Plain words on the first screen (path part 3, 2026-11-06)
"lever" is "change" on screen (the compute still calls them `levers`); "In 9 of 10 markets:" is "Even in a bad run of years:". No figure changed.

## Path part 3, review fixes
- The goal card opens with "Do you want money left over at the end? Most people choose Just last", not "for heirs".

## Round 8 batch 4 follow-ups (2026-11-07)
- **A need rounds up, a limit rounds down.** What you must reach (save at least, a lump sum that is short, the return it needs)
  shows rounded UP to the shown $10 (a tenth of a percent for a return); a limit (what you can spend, room today, what claiming
  lets you spend) rounds DOWN, and "how much less" than the plan rounds up, so doing what the words say always works. `shownValue(lever)`
  (exported) is the number printed; each lever's `value` stays unrounded. Renter: needs $243.53 a month more, shown $250 (it was
  $240, which left $2,028 of $2,040); $250 lasts, tested by running the engine at $250 and at $240. The Plan health score's
  "save about $X a month more" and "spend about $Y a month less" use the same rounding (`roundUp`), as does its "about $X a month
  more earns full marks" saving hint.
- **Room for bad luck (115%).** A chip in the goal card asks compute for `spendingScale` 1.15 (`BAD_LUCK`, the score's full marks
  line); one line says "Plans for spending 15% more than you expect", and while it is on, the card says the spending every figure
  is worked for. It combines with the Leave chips.
- **`?target=last` is read once** (the score's link): the view takes it into `legacy = 0`, scale 1, then clears it from the address
  (`history.replaceState`); a redraw by the shell with the same route does not read it again, so a chip chosen afterwards stays. A
  new visit to the link is a new route and starts from "Just last" again.
- Tests: `module.test.mjs` ("F1", "F4 and F5").

## Review of the follow-ups (2026-11-07)
- Under "Room for bad luck" the engine spends 1.15 times the plan, so the most that lasts is in those larger dollars. What you can spend,
  the claiming "can be spent" figure and the careful line are shown in the plan's terms: the spending that lasts divided by `scale`
  (the result's `scale`), rounded down; "less than" is against the plan's own spending (spending / scale), rounded up. Planning that
  many dollars and then spending 15% more lasts, and the cut equals the Plan health score's 115% hint. `value` and `current` stay unrounded.
- The careful line shows the plan's own spending to the nearest $10, as before; only the cut rounds up.
- The return lever says "just what you assume" only when the plan already meets the goal; a plan just short reads "needs".
- Saving from nothing reads "Save about $250 a month. You save nothing toward this today."
- Verify (2026-11-07): with "Room for bad luck" on, the hero says "With 15% more spending than you plan, the money ..." instead of
  "As it stands the money ...", since the result is worked for the larger spending (a family whose money lasts read "As it stands the
  money runs out in 2082"). Test "verify: with Room for bad luck on".

## Wording follow-up (2026-11-07, claude-b lane B)
- `?target=badluck` opens with the Room for bad luck chip on and Just last (the Plan health score's 115% hint links there). Taking `target` out of the address keeps the other keys (`guide`, `step`). The sentence under the chip follows the answer on screen (`d.scale`).
- Review round 2: the sentence under the bad-luck chip divides by the answer's own scale (`d.scale`); "Also plan for bad luck:" labels the chip; the hero reads "Your plan works, with room to spare".

Final check (2026-11-07): the list of what the plan still needs uses the words every page uses (`core/words.js` `needItem`: "a birth date on the People page", "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"). Test in `tests/wording-verify.test.mjs`.
