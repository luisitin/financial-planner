# Scenario compare  (`scenarios/compare`)

**Status:** usable (phase 8)
**Purpose:** Copies of your plan with a few things changed, side by side with the plan itself: does the money last, the chance it lasts over simulated markets, what each could spend, what it holds at retirement and at the end.

## Inputs
The plan (through `retirement/projection` `buildInputs`) and `scenarios`. Writes `scenarios[]`: `{ id, name, changes: { [lever key, or "key:personId"]: value }, createdAt }`. The plan itself is never changed by a version; only "Make this my plan" (below) writes a version's changes into it, on one tap. Heavy: per version one projection, the affordable-spending search and 400 simulated markets.

## Outputs
`compute(plan, { today, paths })` -> `{ ready, missing, base, scenarios: [{ id, name, changes, described, results, missing }], current, adults }`; `results` = `{ success, failYear, failAge, retireYear, atRetirementReal, endReal, affordableMonthly, spendingMonthly, chance }`.
Shared with `scenarios/advisor-plan`: `LEVERS`, `applyChanges(plan, changes, { today })`, `results(inputs, { paths })`, `describe(plan, changes)`.

## Levers
Plan levers (set on a deep copy, then `buildInputs`): retirement age and Social Security claiming age per adult; spending a month in retirement; extra saving a month (a contribution with no account, so into taxable savings, until the first person retires); stock share now and in retirement; stock and bond returns; inflation.
Input levers (applied to the engine's inputs): fees a year (taken off both the stock and the bond return); a one-time sum in a year (money in > 0, out < 0; this year when no year is given).

## Formulas
- Each version: `project` (does it last, the money at the first retirement year and at the end, today's dollars), `affordableSpending` / 12 (the most it could spend a month and still last), and the share of `PATHS` (400) simulated markets in which it lasts (Monte Carlo seed 1: one draw of pretend years shared by the plan and every copy, `drawShocks`, shaped by each version's own expected returns and volatility, `shapeSequences`; see W7 below for what the chance row shows).
- Differences on a phone are each version less the plan.

## Edge cases
- At most `MAX_SCENARIOS` (4) are run.
- A version that cannot be built shows its missing items.
- Empty fields in the editor are not stored: they stay as the plan has them.
- A spending figure typed in a scenario is a typed figure (review fix 2026-11-02): the `spendingMonthly` lever sets
  `guide.setup.retireAuto` false in the copy, so Will the money last?'s health line goes on top of it and a health premium on
  Expenses is not taken out of it, as when the figure is typed on Will the money last? (a $6,000 scenario ran on $5,400
  while the plan's figure was Get started's own). While the plan's figure is Get started's, `current.spendingMonthly` is
  what the plan spends before health cover (`buildInputs` `spendingYearly` / 12), so "Spend 10% less" and the editor's
  "the plan: $4,570" start from the figure a typed one is set against.

## Tests
Gap design #25 in `module.test.mjs`: each new lever against the plan's own field or line; `happeningsOf`; the words of each
lever and each "left out" sentence; `carry` (carried, already there, not carried and why); every sentence of the question,
the green line and the line after putting back; what "Make this my plan" writes, path by path, and the answer after; the
plan restored byte for byte for every invented household; a figure changed since is left alone; the page (the quiet row,
the question, the green line, the row after a redraw, the way back, the form's five boxes and its fold, Save held back with
no year). `tests/scenario-levers-invariance.test.mjs`: nothing moves for a plan that uses none of it.

`module.test.mjs`: the levers read the plan, `applyChanges` copies (the original untouched) and reaches the engine, `results` matches the projection, `describe` in plain words, the family's scenarios (earlier retirement and fees cost, saving gains, the four-scenario cap), a typed scenario figure with Get started's own figure in the plan ($6,000 stays $6,000; "10% less" is less).

## More levers, and "Make this my plan" (gap design #25, 2026-11-14)
**On the page.** Nothing new by default. Each version that holds something the plan can take gets one quiet row, "Make this
my plan" (`core/ui/more.js` `part`, kind `item`; status "3 changes"). Opened, it asks in words ("This changes 3 things in
your plan: ... You can undo it."), lists what is not carried, and has one outlined button. After the tap the row stays open
and says in green how many changes the plan now has and the new answer of Will the money last? (and, when something was
not carried, "That is without what was not carried."); from then on the row is titled "This is your plan now" and holds
"Undo: put my plan back" first, right under the green line, also after a reload. A wide screen has the same rows in one card,
named for their versions. A version with nothing to carry (a fee alone, or only what the plan already has) gets no row.
The version form asks five boxes first (name, retire at, spend, save more); every other lever waits under "More details
(optional)", the new ones last.

**New levers** (stored in `changes` like the others; each is the plan's own field or line set on the version's copy, so its
sum is the plan's own, tested against it):
- `spendingEase` "Spending as you age": `retirement.spendingEase` (the chips of Will the money last?: stays the same, 1% or
  2% less each year; formula and sources in `retirement/projection` README "Spending as you age").
- `strategy` "How money is taken out": `retirement.strategy`, by the names of How much to take out (`DESCRIPTIONS`).
- `homeYear`, `homeBuyFor`, `homeRent` "Year I sell or downsize the home": one line of Things that will happen, kind `home`
  (`modules/retirement/happenings.js`; its sale sum and sources in `retirement/projection` README "Things that will
  happen"). A price means buying, else the rent, else no housing cost after. It takes the place of a home sale the plan
  already has (one home). Offered only when the plan has a home.
- `lessWho`, `lessFrom`, `lessUntil`, `lessShare` "Work less": one line of kind `less` (a share of the usual pay kept; none
  = a break; no last year = one year). Offered only while someone still works.
- Nothing without a year: a price, a rent or a share alone is held back at Save with words.
- `notesOf`: a line the sums cannot count (its year has passed, no home in the plan, years after that person stops work) is
  left out of the version, and the card says so in amber with happenings.js's own reason; so is easing under a way of taking
  money out that sets its own spending.

**Make this my plan** (`carry`, `makeMyPlan`, `putBack`):
- Written: each plan lever through the same `set` that `applyChanges` uses on the version's copy; the home and working-less
  lines; and a one-time sum as a line "money coming in once" / "a big cost once" of its year (this year when none is given),
  in `retirement.happenings`. A change the plan already has is not counted ("3 changes" are three that move something).
- Not carried, each said in words: fees ("fees are set on the Fees page") and extra saving a month (it has no account to go
  to here: "set on the Retirement contributions page"); a line the plan could not count, with the reason.
- The answer after: for everything but the one-time sum the plan then gives exactly the version's projection (tested). A
  one-time sum is an event added after the version's inputs are built; as a line of the plan it is also seen by the health
  line before 65 (help with marketplace insurance follows income), so with an early retirement the plan's answer can differ
  from the version's by a little (under 3% of the money left at the end in the test household). The green line names the
  plan's own new answer (`modules/retirement/levers.js` `answerOf`).
- The same cause, wider (checked 2026-11-14 on the retired pair of `qa/fixtures/retirement-plan.mjs`): any carried line that
  moves a lot of money (a one-time sum, the home, working less) also moves what the health line works out from the plan's
  income, after 65 too. A $40,000 cost in 2030 as a line of the plan starts Medicare's higher premium for higher incomes one
  year later (2053, not 2052), because smaller savings mean smaller taxable withdrawals; the version's own column does not
  see that, so the plan ends with 2,095,682 against the version's 2,090,677 (0.24%), and could spend 9,829 against 9,821 a
  month. A line of $1 or $1,000 moves nothing. This is the health line following the plan as it should; the what-if's
  one-time sum is the simpler sum. The green line always names the plan's own answer, never the version's.
- Extra saving is not carried, so a version with it holds more at retirement than the plan does once it is made the plan
  (the same household: 1,638,082 against 1,588,759 for $500 a month). The row says "Not carried: ..." before the tap and
  the green line ends "That is without what was not carried." after it (tested).
- Safe against a second tap and against stored data edited by hand: `makeMyPlan` on a version that already holds
  `madePlan` writes nothing and keeps the first way back (`already: true`); `putBack` skips entries of the record that
  are not changes; a way of taking money out counts only as one of `STRATEGIES`' own keys; a year of the one-time sum
  that is no year above 0 reads as this year everywhere (`lumpYearOf`).
- The two short lists start with "Same as my plan" (fits 320 px) and say under the box, in one sentence that follows the
  choice, what it does (`choiceHelp`: the plan's own choice by name, or the way's own `short` from How much to take out).
- The way back: `makeMyPlan` keeps on the version what it did, `madePlan: { on, words, changes }` (`core/ui/undo.js`
  `changesOf`: each field with the value it had). `putBack` takes exactly that back with `takeBack`, which never overwrites
  a figure changed again since (it says so), and removes the record. With nothing changed in between the plan is the plan
  of before byte for byte (tested over every invented household). It is kept in the plan, not in a second store, so it
  works on a phone with no computer and after a reload; the computer's own Backups still hold every earlier save. Removing
  the version removes its way back, and Remove says so.
- Builder's choices: the question is asked in the opened row, not in a browser dialog (the row is the confirmation: opening
  it changes nothing, and the one button inside is the one deliberate tap); a version with nothing to carry shows no row
  rather than a row that says "nothing" (a part must be worth a tap); extra saving is not turned into a contribution row,
  because that page asks which account and whose; one commit for both halves of the design, since carrying a version
  needs the new levers' lines.
- Unchanged for a plan that uses none of it: `compute()`'s output was compared byte for byte with the code before this
  design over 33 invented plans on two days (66 runs, 60 of them ready) when it was built, and
  `tests/scenario-levers-invariance.test.mjs` keeps the keys, the blanks and the record from moving anything.

## Ideas / not yet
- More levers: a pension.
- Carry "save more each month" by asking which account, as What you save for retirement does.
Final check (2026-11-07): the list of what the plan still needs uses the words every page uses (`core/words.js` `needItem`: "a birth date on the People page", "what you will spend in retirement (on the Expenses page, or on the Will the money last? page)"). Test in `tests/wording-verify.test.mjs`.

## Stress test 2026-11-11 (claude-e, wave 2)
- **One answer per card** (RC-8): "Chance it lasts" first, then "If markets do as well as average: lasts / runs out in 2071"
  (it read "Does the money last? Yes" over 37%).
- **One chance for one plan** (W7, "Your plan" read 78% here and 80% on Chance the money lasts). Decision by claude-b as
  coordinator, carried out by claude-e:
  - **One shared draw.** `compute` draws the pretend years once (`monte-carlo/compute.js` `drawShocks(PATHS, years, 1)`, as
    long as the longest version) and every version shapes that same luck into its own returns (`shapeSequences`, its own
    means and swings: a fee or lower returns shift every year of the same futures). So a copy that changes nothing scores
    exactly as the plan, and a copy with lower returns can never last in a future where the plan ran out. The split draw is
    the old draw number for number (`drawSequences` = `shapeSequences(drawShocks(...))`), so no answer key moved.
  - **The plan's own figure** (`chanceShown`): when Chance the money lasts has run this very plan on this visit
    (`retirement/careful.js` `rememberChance` / `knownChance`, kept by the projection's inputs and the day, so any change that
    moves the figures is a different plan), "Your plan" shows that page's figure and each copy shows it plus the copy's
    difference from the plan on the shared 400 (kept between 0% and 100%). The difference is the fair part; 400 futures are
    enough for it, not for the level.
  - **Otherwise "about"**: the plan and every copy are rounded to the nearest 5 points ("about 80%"), the line under the
    comparison says why, and "Chance the money lasts ›" is offered for the closer figure. On Compare only.
  - Why not 2,000 futures for every copy: about four seconds on a phone with four copies; and 2,000 for the plan alone skewed
    every copy by up to 4 points (tried and reverted earlier on 2026-11-11).
