# Goal seek  (`scenarios/goal-seek`)

**Status:** usable (phase 9)
**Purpose:** Set the goal (the money lasts and leaves what you want to leave) and see what each change would have to be: what you can spend, when you can retire, what to save, when to claim Social Security.

## Inputs
Everything `retirement/projection` `buildInputs` reads. Params: `today`, `legacy` (today's dollars the plan should still hold at its end; the view's chips and box, kept on the device). Writes nothing. `heavy: true`.

## Outputs
`{ ready, missing, legacy, meets, success, failYear, endReal, spendingMonthly, strategy (the plan's withdrawal rule), levers[] }`; each lever `{ id, icon, title, value, current, unit: "month"|"age"|"rate"|"once", status: "room"|"same"|"needs"|"cannot", sentence, go }` (the claiming lever also has `results[]`: what the plan can spend at each age 62-70, and on a short plan `atBest`, the run at the best age; the return lever `info: true`, `line`, the page's grey line, and `more`, its detail for the fold; the saving lever `idle`, the 401(k) account ids it names, and `into`/`rest`, what to type into each and into other savings; 2026-11-11 and fix round 1, 2026-11-12). `noSavings` (gated) and then `nothingSaved` (the person told us there is nothing). Params also `savingInto` ("work" | "taxable"; see fix round 1). `ages: true` (gap #21) adds `ages`, a row for each retirement age (below); without it the result is what it was.

## The goal and the levers
The goal is met when the projection (expected returns) lasts to the end and `endBalanceReal >= legacy`. Each lever is solved alone, everything else as the plan has it:
| lever | search |
|---|---|
| What you can spend | the largest steady, inflation-adjusted monthly spending that meets the goal (`largestWhere`, the ceiling grown until it fails) |
| When the first person can retire | the earliest age from this year's (stopping now; from the planned age while the plan as it stands falls short, fix round 1) to the later of 75 and the planned age that meets it, the plan rebuilt at each age (`earliestRetireAge`, exported: Financial independence leads with the same answer, 2026-11-02); compared with the plan by the year they stop, `max(this year, birth year + age)`, so 64 now and 65 later this year are the same year ("This year, as planned") |
| What you need to save | the smallest change a month to what goes into retirement accounts before retirement: more goes into the bucket of the biggest contribution; less scales every contribution down (to zero at most). With nothing going in and a 401(k) at work sitting idle: into that 401(k), up to the year's limit, the rest into other savings (`idleSaving`, fix round 1) |
| The return it needs (information only since 2026-11-11: a grey line under the cards, never a card) | stocks and bonds moved by the same amount (from `RETURN_FLOOR`, 15 points below, to 20 above) until it meets the goal; shown as the blend on the plan's mix (the average of the stock share now and in retirement), against the forecasts on the same mix (fix round 1) |
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

## Stress test 2026-11-11 (claude-e, wave 2)
- **No pill or headline before the bad-run figure is in** (W5): "Checking your plan against bad years..." and a grey "checking"
  pill, then "Your plan works if markets are average" with "tight" (the bad-run spending is under the plan's) or "Your plan works,
  with room to spare". `tightOf` is the same test the careful line makes. A remembered answer (careful.js) shows at once.
- **No retirement savings on file** (F4): the hero alone, with one filled "Add what you own ›"; no exact answers under "we can't say".
- **Leave at least** (RC-4, W6): a money box (`ui.moneyBox`), any amount with or without commas; a wrong one is refused in a sentence.
- **Each lever's button names its page** (RC-10): `GO_WORDS` ("Change the age on People", "Retirement contributions", ...).

## Owner's request 2026-11-11 (L1): a higher return is never offered as a fix
The owner asked that a plan short on retirement show what drives the answer and what the person can change. Goal seek listed
"The return it needs: 10.4%" among the changes, with an "Assumptions ›" button (Jamie, phone walk 2026-11-11): the "fix it by
raising the return" trap. The rule this follows (spec decision D-A7, written for the lever list on Will the money last?):
"Returns are not a fix. The growth row's action is 'Check ›', never 'Raise'. ... Nobody can choose this. Fix the plan with what
you control: saving, when you stop, spending."
- **The return it needs is information.** The lever is still worked out the same way and stays in `levers` (the Plan health
  score's test lists the six ids; Legacy goals lists the levers), now with `info: true`. The page draws five cards and, under
  them, one grey line (`line`), with no button:
  - the words as first built (2026-11-11) set the need on the plan's mix against a range for U.S. stocks alone and called our
    usual figures "the 5.8% you assume"; fix round 1 (below) changed both, and the room case's "percentage points".
  - `sentence` is the same without "; the cards above are" (it stands on its own; Legacy goals leaves the lever out since fix
    round 1). `more` (2026-11-12) is the line's detail, shown in the fold "How it is worked out".
  - Source: Vanguard, 10-year return forecasts from the Vanguard Capital Markets Model, U.S. equities 4.8%-6.8% a year, as of
    2026-09-30 (page of 2026-10-21; read and confirmed 2026-11-11, review notes verify-web). `RETURN_FORECAST` in compute.js;
    nothing is worked out from it. Why: FP Canada's projection guidelines say it is "not prudent to increase return assumptions
    to 'force' a projection" (confirmed in the same review); most forecasters expect less than the app's 7% for stocks.
- **Not "room to spare" on a short plan.** The Social Security card was "room to spare" whenever the best age differed from the
  one on file (Jamie, Morgan, Robin); `room` now only while the plan reaches the goal. (L1 first said a grey "helps" on a short
  plan; fix round 1 replaced it with "needs a change" / "not on its own", below.)
- **The saving card names a 401(k) that holds money with nothing going in** (`idleWorkPlans`): a `401k` account with a balance,
  at a job its owner still has (salary or bonus on Income today), not marked `formerJob`, with no contribution row putting money
  or a match into it. "Save about $670 a month. Casey's plan at work holds $48,000, but nothing goes into it now (you said so).
  If some of each paycheck does go in, add it on Retirement contributions." "(you said so)" when every one has a row typed as 0
  that is not our guess, or Get started's "None" chip (`guide.setup.saving[id].pct === 0`). Two or more read "hold $X between
  them". Before: "You save nothing toward this today." (the owner's "maybe they didn't input how much they contributed"). L1 kept
  the figure of the extra going into savings (taxable); fix round 1 works it out going into the 401(k) it names (below).
- The hero's "needs the basics" line lists the changes without "the return it needs"; the fold "How it is worked out" says where
  the forecasts come from.
- Tests: `module.test.mjs` "L1: ..." (three tests: the line, its edge and its source; the pill on a short and a lasting plan; the
  saving words, not idle when a 401(k) is from a job left, empty, or has money going in, two together); "D4" now checks the new
  words.
- Seen at L1 and done in fix round 1: Legacy goals listed the return among its changes; the saving figure was the run into
  savings while the words named the 401(k).

## Fix round 1 of the owner's request 2026-11-11 (2026-11-12): what the cards say is what doing it gives
The critics walked L1 on the phone and by code (findings M1, M4, M5, P1, P2, P4, P7, B2, B4, B6).
- **The saving card's amount goes into the 401(k) it names** (`idleSaving`, `idleSavingWords`; M1/P2). L1 named Casey's idle
  401(k) but solved the extra into savings: $670 typed into the 401(k) still ran out in 2070, in 758 of 758 qa plans with such a
  card, and 260 cards asked for more than the year's 401(k) limit. Now, with nothing going in and an idle 401(k) at a job the
  owner still has, the plan is copied with a monthly row into that 401(k) with no match, exactly what the Contributions form writes,
  and run through the projection's own `buildInputs` (the deferred bucket, the owner, stopping with the owner's last pay):
  - one 401(k) per owner, the lead adult's first, each at most the owner's 401(k) limit for the year (`deferralLimit`, IRS Notice
    2025-67: $24,500 in 2026, $8,000 more from 50, $11,250 more at 60 to 63), shown rounded down to $10 when it binds ("the most
    allowed in 2026"); then the rest in a row with no account ("other savings, such as a brokerage account", counted as taxable);
  - a need rounds up to $10; the answer is checked by building the plan with the amounts shown, and moved by $10 until it is the
    edge (the search itself runs on one build with the rows put in at $1 a month: the spending figure can move with pre-tax
    saving when it is our estimate, so the check is on the plan as typed);
  - words (short on purpose, simple first, below): "Put about $790 a month into Casey's plan at work. Less would do if Casey's
    job adds some. It holds $48,000, but nothing goes into it now (you said so)." When the person has not said that nothing goes
    in, it ends "... nothing goes into it now. If some of each paycheck does go in, add it on Retirement contributions." (the
    owner's "maybe they didn't input how much they contributed"). At the limit (qa household 03-single-parent): "Put about $2,040 a month into the
    Hospital 403(b), the most allowed in 2026, and $1,290 more into other savings, such as a brokerage account." (the row with
    no account is invested, so the words name where). No "less would do" sentence when the person said the job adds nothing.
  - said = done on every qa plan with such a card (754): the parts typed as rows reach the goal; no 401(k) part above the limit.
  - `savingInto` ("work" | "taxable"): the default is "work", or "taxable" when the caller asks for `only` some levers (the Plan
    health score's hint, claude-f's file, whose words name no account and whose test pins the figure into savings); the page and
    Legacy goals get "work". Handed to claude-f in the fix log: pass `savingInto: "work"` when the hint names the 401(k).
  - `idleWorkPlans` leaves out a 401(k) named old, former, previous, prior or rollover (Retirement contributions' own rule:
    "Derek's old 401(k)" was named); a balance under $100 prints to the dollar (a $4 balance read "holds $0").
- **The claiming card on a short plan says what that age does to the headline** (P1). L1's grey "helps" sat on a change that made
  Jamie's money run out two years sooner, on Robin's one change that works on its own, and on Morgan's that changes nothing. The
  plan is now run at the best age with its own spending (one more `project()` on the input the search built), `atBest`:
  - it reaches the goal: `needs` (amber "needs a change", like the other working changes): "Robin claiming at 70 alone makes the
    money last: about $3,150 a month can be spent if markets do as well as average, $170 more than claiming at 67.";
  - it does not: `cannot` ("not on its own"), in the headline's terms: "Jamie claiming at 69 lets the plan pay about $110 a month
    more, steady, if markets do as well as average. At the $3,220 a month the plan spends, though, the money would run out in
    2050 (age 68) instead of 2052 (age 70): waiting means drawing more from savings until it starts." ("would still run out in
    2049 (age 65)" for Morgan; "later, but still before the plan ends"; with a legacy, what it leaves).
  - a plan that reaches the goal keeps "room to spare". The age is the first adult's, as Will the money last? says it.
- **The retirement card is never "room to spare" while the plan as it stands falls short** (M5, Goal seek's part). The search starts
  at the planned age then (`earliestRetireAge`'s new `from`): Casey with $670 a month in the 401(k) read "room to spare: as early as
  61" under "the money runs out in 2070", because the engine lasted retiring at 61 and ran out at 62 to 65 (the spending figure
  moves with the year work stops: claude-c's `projection/compute.js`, handed over in the fix log). Now: "at 66: 1 year later than
  the plan's 65". And "as early as" holds for every later age: the year-by-year scan checks each age from the one found up to the
  planned age and, on a gap, takes the first age after it that lasts (Casey with the card's $790: 60 and 61 last, 62 to 64 run
  out, so the card says "at 65 as planned", not "as early as 60"). About one build more per year between the two ages; the
  score's halving search is unchanged. The engine fix (the spending figure not depending on the stop year, and a monotonicity
  test) is claude-c's.
- **The grey line compares like with like and says whose figures they are** (M4, P4, B2; `returnWords`, `forecastFor`,
  `RETURN_FLOOR`):
  - the need on the plan's mix is set against Vanguard's forecasts on the same mix: each end of the U.S. stocks range (4.8%-6.8%)
    and the U.S. aggregate bonds range (5.1%-6.1%, the same page, as of 2026-09-30; confirmed in the review notes verify-web) blended
    on the plan's average stock share: 4.9%-6.5% on 60% stocks. "Most forecasts ... are lower" only when the need shown is above
    the top of that range as shown (a need of 6.6% on 60/40; Robin's 6.0% is inside it). Stocks alone would mislead the other way:
    the bond forecasts are above the 4% the app uses, so Robin's 6.0% needs stocks at 7.2% but the mix at the forecasts' top lasts.
  - whose: "against the 5.8% a year we use", and "the 5.8% a year your own figures give" only when a return was typed (differs
    from the default) or Assumptions was reviewed within its 365 days (`system/assumptions` `compute`, read-only). Spec D-A3:
    "Usual figure = an Assumptions field equal to its default while `reviewedAt` is absent or stale ... Yours = typed, or
    confirmed." What the 5.8% is made of is the lever's `more`, shown in the fold (simple first, below): "The 5.8% is 7% for
    stocks and 4% for bonds on the plan's mix, about 60% in stocks: our usual figures unless you change them." ("the figures you
    chose" when typed or reviewed).
  - no "percentage points"; the room case reads "Investments growing about 4.3% a year would still do, against the 5.8% a year we
    use. Forecasts for a mix like the plan's: about 4.9%-6.5% a year (Vanguard)."
  - no figure when the plan does not need growth: "Your plan does not depend on how investments grow: it gets there even if they
    lost money every year." (at the search's floor with every return below zero there: the retired couple read "-9.2% ... 15.0
    percentage points of room", the floor, on 131 qa plans), "... even with no growth at all." (a need at or below 0).
  - the fold says how: both moved by the same amount, put together on the plan's mix, what the plan's own figure is made of
    and whose (`more`), the stocks and bonds ranges, and the forecasts' date.
- **"What matters most? ›"** (P7): one outlined link under the grey line to What matters most
  (`#/scenarios/sensitivity`); the page keeps no filled button. It carries the name of the page it opens (the spec's own words
  for the link, section 2A), and fits one line at 390 px ("Which of your numbers matter most? ›" took two at 320 px).
- **Gated with nothing saved said** (B4): with an empty 401(k), IRA or Roth on file, or Get started's "None", the gated hero says
  "Nothing is saved for retirement yet, and nothing goes in, so we can't say what it would take yet. That is common; once something
  is saved or goes in each paycheck, add it and come back." (`nothingSaved`); "You haven't told us ..." only when we were not told.
- **Simple first, detail on request** (owner, 2026-11-12: "Default to less is more and allow more complexity or toggles. We
  want subtle optional complexity"; done with this fix round). The fixes above had made the first view long: the grey line ran
  nine lines at 390 px and the saving card six. Now:
  - the grey line is the need, what the plan uses and whose that is, and the forecasts' range with their source's name: "For
    the plan to work as it is, investments would have to grow about 10.4% a year, against the 5.8% a year we use. Most forecasts
    for a mix like the plan's are lower: about 4.9%-6.5% a year (Vanguard). That isn't a choice you can make; the cards above
    are." (Jamie). What the 5.8% is made of, whose its parts are, the two ranges and the date ("as of September 30, 2026") are
    one tap away in "How it is worked out", the fold right under the cards (`more`; nothing when no figure is shown);
  - the saving card says what to put where, the one caveat and what we know (words above); the reminder to add what goes in
    shows only when the person has not said that nothing does;
  - nothing here changes a figure, a status or the plan; opening the fold changes nothing.
- Tests (`module.test.mjs`, "L1: ..." and "fix round 1 (...)"): the return line's words, its length, its detail in the fold, its
  blended range and edge, "your own figures", said = done on every qa base household with such a card (the amounts typed as rows
  reach the goal, none above the year's 401(k) limit),
  the floor and no-growth words on the retired couple, the outlined link; the claiming card for Jamie-, Robin- and Morgan-like
  households (said = done on the headline), Dana-like "room"; `from`, no "room" on short plans, and "as early as" over the engine's
  gap on the phone-built Casey (inlined, invented); the saving card's 401(k) amount
  typed on the row (and $10 less short), the limit and the rest, the plain search for `only`, old names, $4; the gated words.

## Fix round 2 (2026-11-13): simple first, tighter (owner, 2026-11-12 and 2026-11-13), and the cards at 320 px (N4)
The owner, 2026-11-13: "There should be complete optionality ... it should stay simple by default. There should be ways for you to
upgrade the complexity and the depth of it, and it should also flow fluid and easy to understand for a human user." The page's
first view (Casey, 390 px) held five change cards, five chips, a box with its own button and seven buttons, 3 screens long (5.5
at 320 px). Each choice:
- **Three change cards first** (`firstLevers`, `FIRST_CARDS` = 3, pure, exported), the rest under "N more changes" with their
  names in the fold's line ("2 more changes: retiring, Social Security"). Order for the first view: first what is worth money to
  the person, never folded (rule 7): the Social Security card while that age gets there on its own or adds room ("needs a change",
  "room to spare") and the saving card that names a 401(k) with nothing going in, whether saving gets there or not on its own
  ("Less would do if Casey's job adds some": a match they may be missing; final fix below); then the changes that get there on
  their own ("needs"), those with room, "just
  right", "not on its own" last, in the page's order within each. Both lists keep the page's order (spending, retiring, saving,
  today, Social Security). The return it needs is never a card (`info`; the grey line). Legacy goals lists the same order.
- **The goal: chips first.** "Just last" and the three amounts stay; room for bad luck and an amount of your own ("Or leave at
  least" and "Use this") are one quiet tap away in "More options". Its line says "bad luck, your own amount" until one is in use,
  then what is on: "room for bad luck is on; leaving $150,000" (rule 4). A typed amount that cannot be read opens the fold and says
  what to do under the box; the fold stays open while the page redraws after a chip or an amount (a module-level flag, never the
  plan). Opening or closing changes nothing.
- **Social Security's bars by age** are under the card's quiet "See each age" (the card's sentence already names the age that
  spends the most and how much).
- **The note about another spending rule** ("What you can spend and when you can retire are worked out spending the same every
  year; your plan uses another rule ...", with its link to How much to take out) moved from under the cards' heading to the top
  of "How it is worked out".
- On a phone (480 px and under) a fold's line goes under its title ("More options" / "bad luck, your own amount"): "More options"
  and "2 more changes" were cut in two at 320 px. Scoped to the page's root.
- **N4** (re-check 1, severity 2: at 320 px each card's title sat in a 52 to 62 px column, "What / you / need / to / save" on five
  lines, next to its pill): the top row wraps (`flex-wrap: wrap`) and the title keeps at least 8.5em (`flex: 1 1 8.5em`), so at 320
  px the title is one line and the pill goes under it; at 390 px the pill stays beside short titles.
- Kept: the hero, the grey line and its fold detail, "What matters most? ›", every card's own outlined button, "How it is worked
  out". No filled button (the gate's "Add what you own ›" aside). Nothing a person could do before was removed.
- **N2 is not changed here** (re-check 1, severity 3: the Plan health score's hint says "save about $670 a month more" while this
  page says $790 into Casey's 401(k)). The score asks for `only` some levers and so gets the plain search into savings by default;
  its own test pins that figure ($170 for its household; $190 with the 401(k) answer). The switch is one argument in claude-f's
  file (`savingInto: "work"` in `overview/health-score/compute.js`) and their test's figure; the test "fix round 2 (N2, for
  claude-f's Plan health score)" pins what that call returns (the page's $790, which typed into the 401(k) reaches the goal).
- Tests (`module.test.mjs`, "simple first (... fix round 2) ..." and "fix round 2 (...)"): `firstLevers`' order on four made-up
  lists; Casey's page (three cards first, "2 more changes: retiring, Social Security", the goal's four chips outside and "Room for
  bad luck", the box and "Use this" inside "More options", its line after an own amount and with room for bad luck, an error
  opening it, "See each age" closed, nothing saved); another rule's note inside "How it is worked out"; the 320 px rule in the
  style; the `savingInto: "work"` call with `only`.

## Final fix (2026-11-13): the idle 401(k) is never folded (rule 7)
The final skeptic (scn-final-1, severity 2): when saving alone cannot get there, the saving card that names a 401(k) with nothing
going in went behind "1 more change", while a "not on its own" card with nothing to act on stayed in view. qa
`02-couple-no-kids/expenses/spending-above-income`, 390 px: the first view was "What you can spend", "When Priya can retire / not
on its own" and "What it is short today"; the fold held "No amount of saving gets there before retirement. Priya's 401(k) holds
$92,000, but nothing goes into it now. If some of each paycheck does go in, add it on Retirement contributions." (210 of 4,092
first views on the qa plans with Just last, room for bad luck and leave $250,000).
- `firstLevers` now keeps the saving card in the first view whenever it names an idle 401(k) (`idle`) and is "needs a change" or
  "not on its own"; with "room to spare" or "just right" it says nothing of the 401(k) and ranks as before. At most two cards are
  kept this way (Social Security and saving), so the first view stays three cards. On that plan: spending, saving, short today;
  "1 more change / retiring". Legacy goals lists the same order through `listedLevers`.
- What goes under the fold instead (every qa plan, the same three goals): 304 of 4,092 first views change. The card that moves is
  "What it is short today" when spending and retiring both get there on their own (176, as 12-high-net-worth with room for bad
  luck) or a "not on its own" retiring card (128). Either is named in the fold's line. A folded card that names a match, an idle
  401(k) or a Social Security age that gets there: 0 of 4,092 (210 before).
- Tests: "final fix (rule 7) ..." here (made-up lists; the qa plan with the three goals, by code and on the page, nothing saved)
  and in Legacy goals (the same plan leaving $50,000: the saving change among the first three).

## A row for each retirement age (gap #21, 2026-11-13)
Gap spec design #21 (map line G12; batch 4, commit 4.2). Other planners show what retiring at each age would give; here it is one
quiet row, and the page's simple-first conversion (opt spec 6.2: class C, "How it is worked out" becomes "How this is worked out")
is done in the same commit.

**By default: nothing new.** The hero, the goal, the change cards with "When you can retire: age 62" stay first and as they were.
Under the cards, one parts card holds two shut rows: "16 more ages · retiring at 55 to 70" (kind `more`) and "How this is worked
out" (kind `how`, the old fold card's list, unchanged).

**On request** ("16 more ages", built when opened and when the page prints, never before):
- the words, one sentence each: "Each line is your plan with you stopping work at that age and everything else as it is, if markets
  do as well as average every year." / "\"Could spend\" is the most a month, steady, in today's dollars, that still gets there[, on
  top of health insurance]." / with an amount to leave: "\"Lasts\" here means it also leaves $500,000 in today's dollars." / with
  room for bad luck: "Room for bad luck is on: every line is worked out for 15% more spending than you plan." / a couple: "Only
  Ana's age changes: Bo still stops work at 62." (or "...: your spouse's plan stays as it is.", "...: everyone else's plan stays
  as it is.");
- then one line per age, worked out on the computer when it is connected (`ctx.computeRemote`, this device otherwise), with the
  goal and room for bad luck the cards were worked out for: "55: runs out at 70" / "62: lasts to 95 · could spend $7,090 a month"
  (the card's own age in bold) / "65, as planned: lasts to 95 · could spend $8,430 a month" / with an amount to leave, "61: lasts
  to 95, but leaves less than $500,000".

**Formulas** (`compute.js`: `ageSpan`, `agesFor`, `retireAgeRows`, `ageLine`, `agesWords`; all pure):
- The ages: from the later of today's age and 55 to the later of 70 and the planned age (`AGES_FROM`, `AGES_TO`, the design's
  range), widened to take in the card's own age when it lies outside (a plan that works at 48 starts at 48; one that needs 72 ends
  at 72; the card looks up to the later of 75 and the planned age). n = to - from + 1, the title's count and the number of lines.
- The person: the adult the "When ... can retire" card is about (the projection's `workingNow` lead: the first adult while they
  work, else the partner who does). With the first adult stopped before their age and a partner at work, the first adult counts as
  stopped from this year (`withStops`), as on the card. Nobody at work, or past the planned age: no card, no part.
- Each line: the plan with only that person's `retirementAge` set to the age (the change Scenario compare's "Retire at age" lever
  makes; a partner keeps their own age), rebuilt by the projection's `buildInputs`, spending set to the same amount every year
  after inflation (strategy `fixed-real`, times 1.15 with room for bad luck), run once by `project()` at the plan's expected
  returns. Lasts = `success` and `endBalanceReal >= legacy - 0.5`: the test `earliestRetireAge` makes at each age, so the first
  age that lasts is the card's answer (tested over the qa plans, three goals). Runs out at = the run's `failYear` minus the
  person's birth year; lasts to = the plan's `endYear` minus the birth year; stop year = max(this year, birth year + age).
- Could spend (lines that last): `affordableSpending` (`core/math/retirement.js`, exported already, unchanged) when the goal is
  just to last: the largest steady real yearly spending that succeeds, to the dollar; with an amount to leave, the spending card's
  own search (`largestWhere`, $1 a year) of the largest steady spending that lasts and leaves it. Shown a month, in the plan's
  terms (÷ 1.15 with room for bad luck, as the spending card), rounded down to $10 (a limit), so spending it still works.
- Sources: no outside figure is used. Read 2026-11-13 for the range's two ends (context, not math): 70 is when a delayed Social
  Security benefit stops growing ("The benefit increase stops when you reach age 70", SSA, Delayed Retirement Credits,
  ssa.gov/benefits/retirement/planner/delayret.html, via search, the page refused a direct read); 55 is the age after which leaving
  a job lets its plan pay out without the 10% early tax ("Distributions made to you after you separated from service with your
  employer after attainment of age 55", IRS Topic 558, irs.gov/taxtopics/tc558). Returns, inflation and Social Security are the
  plan's own (Assumptions and Social Security, sourced there).
- Speed: the rows for one goal take 0.1 to 0.6 s on the qa plans (one build and one run per age, about 25 more runs per age that
  lasts); never worked out unless the part is opened or printed.

**Tests** (`module.test.mjs`, "gap #21 ..." and "S11 ...", failing first: all eight fail on the base files):
1. the first age that lasts is the card's age, and every later age lasts, over the qa plans (fixtures, Casey, 14 households) with
   Just last, leave $500,000 and room for bad luck; each family line rebuilt by hand;
2. the ages and the count: `ageSpan` cases (55 to 70, from today's age, an answer before 55 or after 70, a planned age past 70),
   the title's count equal to the lines on every qa plan with a card;
3. a couple: only Ana's age moves (each line equals the run with Bo at 62; moving Bo too changes the run), the plan untouched, the
   sentence;
4. lazy: shut and empty on the first view with no ages asked for; opened, one call `{ today, legacy, only: [], ages: true }`, the
   words at once, 16 lines after, the card's age in bold, "65, as planned"; opened again, no new call; printing (`openAll`) builds
   and works it out; room for bad luck passes `spendingScale`; no part for the retired couple or the empty plan;
- could spend: equal to `affordableSpending` / 12, the shown figure lasts and $2 a month more does not; with $500,000 to leave, the
  card's search; with room for bad luck, ÷ 1.15;
- one sentence per case (R5): the three lines, "as planned", the words above the lines in each case;
- invariance (gap spec 3.5): over the four fixture plans, Casey and the 14 households, `compute()` without `ages` has no `ages`
  key, and with it everything else is byte-identical. One-off sweep, base `compute.js` against this one: see the report.
- S11: after "Use this" and the bad-luck chip only "Set my own numbers" changes (it stays open), the ages the person opened stay
  open and follow the new goal, nothing else opens or shuts, nothing is saved; a new visit shuts the part with boxes.

**The page's simple-first conversion** (docs/OPTIONAL.md; no hand-written `<details>` left):
- "More options" (a title R24 forbids) is "Set my own numbers" (kind `own`, `id: "goal"`, `holds: ["legacy"]`): its status is
  "bad luck, own amount" until one is in use, then "1 set by you" / "2 set by you" (R26; the old line "room for bad luck is on;
  leaving $150,000" ran past 20 characters). It stays open for the visit while the page works its answers out again after a chip
  or "Use this" (R17), and shuts on a new visit (3.11: a part with boxes is kept for the visit only; it was kept until the app was
  closed).
- "N more changes" is a part (kind `more`, `id: "changes"`); its status names what is inside only when that fits in 20 characters
  ("retiring", "retiring, saving"; "retiring, Social Security" is left out). The person's tap on it is kept on this phone (core/ui/
  more.js), as for every reading part.
- "See each age" (Social Security's bars) is a part of kind `item` (`id: "claim-ages"`), the card's own row, so it may sit inside
  "N more changes" (R11).
- "How it is worked out" is "How this is worked out" (kind `how`, `id: "how"`), a row of the parts card instead of a card of its
  own. Its list is unchanged.
- The phone rule that put a fold's line under its title (fix round 2) is gone: the helper's summary is a flex row and every status
  is at most 20 characters.
- Builder chose: (1) the rows' person is the card's (the lead adult), not always the first adult, so the first age that lasts is
  the card's answer for a couple where the first adult has stopped; (2) n counts every line, the card's age among them ("10 more
  ages" for 61 to 70, as the design's example); (3) the status "retiring at 55 to 70" says what the ages are; (4) the range widens
  to take in the card's age; (5) "could spend" only on lines that last (the design's example), and with an amount to leave, the
  spending card's search instead of `affordableSpending`, which knows no amount to leave; (6) the planned age reads ", as
  planned", the card's age is in bold; (7) a line that cannot be built (no inputs) is left out; none on the qa plans.
