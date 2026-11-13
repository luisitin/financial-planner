# When to start Social Security  (`retirement/claiming`)

**Status:** usable (phase 5; built 2026-11-13, gap design #7, map line E2)
**Purpose:** The ages to start Social Security that pay the most over your lives, for a couple or for one, with what the
one left keeps, the chance of living each year and how much later years count.

## Inputs
Plan sections read (`needs`): `household` (adults, birth dates, `relation`), `retirement.socialSecurity` (each person's
figure or record and claim age, through Social Security's own `compute()`), `retirement.longevity[personId]`
(`{ sex, health }`, How long to plan for's), `income` (a Social Security line that already pays someone), and the new
optional `retirement.claimingRate`.
Writes (`writes`): `retirement.socialSecurity[personId].claimAge` ("Use these ages", nothing else),
`retirement.claimingRate` and `retirement.longevity[personId].health` ("Set my own numbers").
`compute(plan, { today })` takes `today` (an ISO date; the date of the run when absent).

New field, no version bump (`docs/DATA_MODEL.md`, retirement row): `retirement.claimingRate?`, a real rate a year, 0 to
10%; absent or not a number reads as 0, and a figure outside 0 to 10% (an imported plan; the page's box takes no other)
reads as the nearest end (`rateOf`, `RATE_MAX`). Read by this page only.

## Outputs
`compute()` returns `{ state, ready, couple, married, rate, people, pairs, best, plan, gain, apply, survivor, noFigure,
set, yearly, left }`:
- `state`: `noPeople` (no adult with a birth date), `empty` (no Social Security figure), `fixed` (everyone with a figure
  already gets it), `now` (past 70 and not started: start now), `best` (the plan's ages pay the most), `close` (the
  plan's ages within 2% of the best), `gain` (the best pays 2% or more above the plan's ages).
- `people[]`: `{ id, name, ageNow, varies, why (null | claimed | over70 | noFigure), ages (tried), planAge, bestAge,
  monthlyAtBest, health, sex, odds85, odds95, pastAge (the claim age in the plan when the Social Security page says it
  has passed, else null), planMonthly (what the plan counts a month, that page's figure) }`.
- `left[]`: `{ id, name, why: noBirth | third }`, the adults this page leaves out (no birth date; past the first two).
- `pairs[]`: `{ ages: { id: age }, total }`, best first. `best`, `plan` the same shape; `gain` = best less plan.
- `apply`: the ages "Use these ages" writes (each person who can still choose), or null.
- `survivor`: `{ keeps, from }` for a married couple when the one left keeps the other's larger check.
- `words(d, money)`, `nowWords`, `savedWords`, `undoWords`, `retireWords`, `pairName`, `leftWords`: every sentence the
  page and Social Security's "More on this" row say, pure and tested.

## Formulas
Everything is in today's dollars: Social Security rises with prices each year (cost-of-living adjustments), so no price
rise is added or taken off, and the plan's inflation does not move any total.

1. **The ages tried** (`agesFor`). For each person who has a figure and has not started: the whole ages 62 to 70 from
   today's age on; past 62, "now" (today's age rounded up to the month, as the Social Security page offers it) comes
   first; the age in the plan is added when it is none of these and still ahead. An age in the plan gone by without a
   claim (before today's age, less half a month) stays the plan's age, valued as the plan counts it (that age's check
   from today, the Social Security page's figure), and is not tried: it cannot be chosen any more. The pair is the first
   two adults with a birth date, as the Social Security page pairs them; anyone else is left out and said (`left`). A
   person already paid keeps the age they started at; someone past 70 who has not started is valued as starting now at
   the age-70 amount; a partner with no figure is not varied. Every pair is tried (at most 9 x 9 = 81; brute force, about 15 ms warm in Node).
2. **The money, year by year** (`pairYears` in `../social-security/compute.js`, extracted in this commit; the rules are
   that file's own and keep their citations). Year k runs from k to k + 1 years after today, to age 110 of the younger.
   - Own check: PIA x `claimFactor(birth year, age)`, to the dime; paid for the share of year k at or past the claim
     age. Before full retirement age, 5/9 of 1% less for each of the first 36 months early and 5/12 of 1% for each month
     beyond (POMS RS 00615.101, TN 24, read 2026-11-13); after it, 2/3 of 1% more a month, 8% a year, up to 70, for
     anyone born in 1943 or later (POMS RS 00615.692 section D, TN 28, read 2026-11-13). Already paid: what arrives (the
     page's figure, or with none the Income line that pays it).
   - A husband's or wife's top-up while both are alive: max(0, PIA_other / 2 - PIA_own) x `spousalEarlyFactor(birth
     year, start age)`, to the dime, from the later of their own start and the other's start, never before 62; no
     credits for waiting. The spouse's reduction is 25/36 of 1% a month for the first 36 months and 5/12 of 1% beyond
     (POMS RS 00615.201, TN 53, read 2026-11-13), applied to the half (SSA's spouse calculator, cited in the Social
     Security compute). Filing for one's own check is filing for the spouse's too for anyone born on or after
     2 January 1954, "to RIB and AUXSPO benefits (reduced and unreduced) at any age" (POMS GN 00204.035, TN 166,
     read 2026-11-13), so the top-up starts once both have filed. Counted as the Social Security page counts it (`couple().spousalCounted`): only for a person with
     a figure of their own, not when it is already inside a paid Income line, and not for partners Get started was told
     are not married (`relation: "partner"`, as the Social Security page reads it).
   - The widow(er)'s amount on a record, `widow[d]`, when its owner dies in year d (death age = age today + d):
     already paid, the page's `survivor`; died after starting, `survivorAmount(PIA, own check, started early)`, which
     never leaves less than 82.5% of the PIA for an early start (the widow(er)'s limit, POMS RS 00615.320, TN 62,
     effective 2023-12-14, read 2026-11-13); died before starting, PIA x max(1, `claimFactor(birth year, death age)`):
     the full-age amount (POMS RS 00615.301, TN 43: the widow(er)'s original benefit is 100% of the PIA) with the credits
     for waiting earned up to the death (POMS RS 00615.702, TN 24: the credits count when the worker "would have been
     entitled", read 2026-11-13).
   - One left (`alone(id, k, d)`): the larger of their own check and the widow(er)'s amount, the latter paid from their
     own full retirement age. Months in year k: both shares overlap as min(own share, widow share), so the year pays
     12 x (overlap x max(own, widow) + (own share - overlap) x own + (widow share - overlap) x widow).
3. **The odds of living** (`oddsOf`): longevity's `survival(age, toAge, { sex, health })` (its Gompertz fit; How long to
   plan for's README has the curve and why it is an approximation). alive[k] = S(k + 0.5), the chance of being alive
   in the middle of year k; dies[d] = S(d - 0.5) - S(d + 0.5), with S = 1 before today. The two lives are independent.
4. **The total** (`lifetime`): sum over k of (1 + rate)^-(k + 0.5) x
   [ P_a(k) P_b(k) (own_a + own_b + top-up_a + top-up_b)
   + P_a(k) x sum over d <= k of dies_b[d] x alone(a, k, d) + the same for b ].
   One person: P_a(k) x own_a. The sum over d is grouped by the widow(er)'s amount (it takes few values: the full-age
   amount before starting, one step a year from full retirement age to the claim age, then one figure), which gives the
   plain sum to 1e-6 (`lifetimePlain`, tested) and is about five times faster.
5. **The answer**: the best pair is the largest total (ties: the earlier ages). `gain` = best - plan. `best` when the
   gain is at most 0.1% of the best (`SAME`) and every age in the plan can still be chosen, `close` under 2% (`CLOSE`),
   else `gain`. The rate is 0 to 10% (`rateOf`). "about $X" is rounded to $1,000
   from $10,000, $100 from $1,000, else $10 (`roundAbout`).

Open Social Security (Mike Piper) is the method's reference (every pair, weighed by the odds of living, a discount rate);
its licence could not be read on 2026-11-13, so no code was taken from it. ssa.gov's own pages answer 403 to this
session; every rule above was read on secure.ssa.gov's POMS pages, 2026-11-13.

## First view and parts
Simple first (`docs/OPTIONAL.md`), an answer page.
- **Headline** (`h1`) and **one written sentence per case** (`words()`, each tested):
  - couple, both choose (gain): "Ana at 62, Bo at 70" / "Starting Ana's at 62 and Bo's at 70 pays the most over your
    lives: about $73,000 more than the ages in your plan (Ana at 67, Bo at 67)." Each age in the plan is named, so
    ages with months never run together ("68 and 8 months and 66 and 4 months"); "you at 67" for the unnamed first adult.
  - one of a couple chooses (the other already paid): "Start Bo's at 70" / "Starting Bo's at 70 pays the most over your
    lives: about $X more than at 62, the age in your plan."
  - one person: "Start at 70" / "Starting at 70 pays the most over your life: about $8,600 more than at 67, the age in
    your plan."
  - close: the same headline / "... pays the most, but only about $X more than the ages in your plan (Sam at 69, Lee at 62).
    Several pairs come within 2% of each other; any of them is a sound choice." (ages for one person).
  - already the best: "Keep the ages in your plan" / "Starting Sam's at 70 and Lee's at 62, the ages in your plan,
    already pays the most over your lives." (and the one-age forms).
  - nothing to choose: "No age left to choose" / "Riley already gets Social Security, so there is no age left to
    choose." or "You both already get Social Security, so there is no age left to choose."
  - past 70: "Start now" / "Waiting past 70 adds nothing, so starting now pays the most."
  - no figure: "When to start Social Security" / "The best age to start depends on what you would get. Add your Social
    Security figure first, from your ssa.gov account or your statement." with the filled "Add your Social Security
    first ›"; no adult: "First add the adults in your home, with their birth dates." and "Add the people in your home ›".
  - the unnamed first adult reads "you" / "yours" ("Starting yours at 70 and Lee's at 62 ...").
- **The survivor's sentence** (married couple, when it holds): "If Ana outlives Bo, Ana keeps Bo's larger check."
- **Never folded**: a partner with no figure ("Bo's Social Security is not in the plan yet, so only what Bo would get as
  a widow or widower is counted.") with an outlined "Add Bo's Social Security ›"; a claim age in the plan gone by, in the
  Social Security page's own words ("The plan has Ana claiming at 66, which has passed, so it counts $2,484 a month.");
  the adults left out ("Cy is left out here: this page works out the best ages for two people." / "Ana's birth date is
  not in the plan, so Ana is left out here.").
- **One filled button**: "Use these ages" ("Use this age" for one): writes each choosing person's `claimAge`, nothing
  else; the green line where the button was names the new answer and the retirement verdict ("Saved: your plan now
  starts Sam's at 70 and Lee's at 62. Will the money last? now says the money lasts to the end of the plan."), with
  Undo ("Back to the ages you had: Sam at 67, Lee at 67.").

| part | kind and title | holds | status |
|---|---|---|---|
| `pairs` | more, "80 more pairs" / "8 more ages" | every other pair, best first: its total over your lives (to $100), "about $X less than the best", "(your plan)" on the plan's row; built when opened (over 40 rows) | - |
| `own` | own, "Set my own numbers" | chips "Count every year the same (0%)", "1% a year", "2% a year", "Type my own" (`claimingRate`); each person's health "Worse than most", "About average", "Better than most" (`longevity[id].health`, shared with How long to plan for) | "1 set by you" (a rate other than 0 and each health not average), "2% a year" |
| `how` | how, "How this is worked out" | the steps with the person's own odds of reaching 85 and 95, what is left out, the source and read date | "6 steps" (4 for one person) |

A choice in "Set my own numbers" saves at once (a chip; the box on change), the part stays open, and its green line names
the answer now: "Saved: each later year now counts 2% less. The ages that pay the most stay Ana at 62, Bo at 70." (or
"are now ..."). The chip rows sit in a `div.field`, not the kit's `<label>` field: a tap on a label's words presses its
first button.

"More on this": "What would each of us get?" ($ a year in your plan, Social Security), "How long might we live?" (How long
to plan for), "Will the money last?". Social Security's own page gets one row: "When should each of us start?" / "When
should I start?" with `words().link` under it ("Ana at 62, Bo at 70: about $73,000 more over your lives", "The ages in
your plan already pay the most"); no row while there is no age to choose.

Builder chose (the design left these open):
- **Close call** is read as "the plan's ages come within 2% of the best": the design's "top pairs within 2%" would fire
  for almost every household (neighbouring ages are always within 2%), and the sentence then has nothing to temper.
- **The headline** is a short answer ("Ana at 62, Bo at 70") with the design's sentence as the line under it: the
  design's sentence is 30 words, too long for a 390 px heading.
- **The widow(er)'s check is counted from the survivor's full retirement age** (it can start at 60, smaller): the page
  says so under "Left out". The retirement full retirement age stands in for the survivor's (the same 67 for anyone born
  in 1962 or later; up to 4 months later for 1960 and 1961).
- **A partner with no figure yet**: their own check and top-up are left out, as the plan leaves them out; what they
  would keep as a widow(er) on the other's record is counted, said on the first view.
- **The PIA does not change with the age tried** (more working years before a later start are not added), as the Social
  Security page's own list of ages does.
- **Unmarried partners** (Get started's "partner") get no spouse's or widow(er)'s check here; the Social Security page's
  own survivor sentence still shows one for them (HANDOFF in the gap report).
- **A claim age gone by** (critic g16 #1): the plan's age stays what the plan says and counts (the Social Security page
  flags it and counts that age's smaller check from today), so the gain is measured against what the plan counts, and
  the page says so in that page's words. It was shown as today's age, which matched neither page.
- **A third adult** (critic g16 #4; the People page lets a second "Partner" be picked): the page works out two people,
  the first two with a birth date, as Social Security's own `couple()` pairs them, and names whoever it leaves out. The
  third adult's own best age is not worked out here (their own figures are on the Social Security page).

## Edge cases
Empty plan (no adults), adults with no birth date (left out and said), a third adult (left out and said), no figure for
anyone, a record short of 40 credits (no own check), one or both already paid (a fixed age; with no figure, the Income
line), past 70 and not started, a claim age gone by (the plan's age, as the plan counts it, said; at most a close call), a
fractional age in the plan (tried as it is), unmarried partners, a rate of 0 to 10% (outside it: the nearest end).

## Tests
`module.test.mjs`: `agesFor`; `oddsOf` adds up; `roundAbout`; `pairYears`: own check in the claim year, the top-up under
half and not over half and its start, the widow(er)'s amount (70, 67, 62 with the 82.5% floor, death before starting
before and after full age), `alone()`; `pairYears` at the plan's ages equals the Social Security page's monthly figures
and counted top-ups for every qa household and fixture plan; grouped and plain sums agree; the best pair equals an
independent loop; one person at 0% picks 70, worse health at 2% picks 62 or 63; a couple's larger earner waits; someone
already paid keeps their age; inflation moves no total; the close / best / gain thresholds; every sentence case; the
green lines; the page: first view (answer, survivor, one filled button, three shut parts, "More on this"), "Use these
ages" writes two claim ages and nothing else with Undo and the retirement verdict, "Set my own numbers" writes the rate
and health, stays open, names the answer and puts no chip in a label, "How this is worked out" holds the rules and the
odds, the empty states, nothing to choose, one person's "Use this age", the partner with no figure, and Social Security's
row; a claim age gone by (the plan's age, its total, the sentence, named ages, Undo), a rate outside 0 to 10%, and the
adults left out (critic g16 #1, #3, #4).
Invariance (gap spec 3.5): Social Security's figures (the household's year; each person's claim age, monthly check and
widow(er)'s amount; the counted top-ups) for every fixture plan and nine harder samples are the ones recorded on the base
before this page (c5779a2), so a change to that file's `compute()` shows; no other module or core file names
`claimingRate`, and Social Security's compute is the same with it set; this page answers the same with the field absent
as with 0. At the commit (2026-11-13), the whole output of Social Security's `compute()` over every qa plan (1,414) on
2026-11-13, 2026-12-31 and 2027-01-01, and of every other `compute.js` (161) over the fixture plans, the 14 household
bases and the empty plan, was compared with the base's: 8,750 results, byte for byte the same (save-time stamps
masked). The recorded test was seen to fail with Social Security's 82.5% floor changed to 82%.

## Ideas / not yet
- The widow(er)'s check from 60 (reduced to 71.5%) and the switch from it to one's own at 70.
- Divorced spouses, children's checks, the earnings limit while working (gap design #27, commit 5.2).
- A record's PIA growing with years worked before a later start.
- Taxes on the checks, and the effect on Will the money last? of each pair (the page names only the verdict after a save).
