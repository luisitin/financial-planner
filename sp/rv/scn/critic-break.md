# Break critic, track scn (L1, d540ebb on fa2026e)

Reviewer: break critic. I served a copy at the track's HEAD from my own worktree `rv/v-scn-break` (detached at d540ebb, removed at
the end), ports 9761-9764, each server stopped by its own script (own child only). Scripts, outputs and plans are in `rv/scn/break/`;
screenshots in `rv/scn/break/shots/` (all paths below are under
`$SP/`). Kit: Chromium with an iPhone user
agent, touch, sandbox. The browser's date is 2026-11-12; node runs use 2026-11-11 unless said.

Only what I saw on screen or got by running code is listed. Severity 5 = a person acts on a wrong screen; 1 = polish. The money and
person critics' findings (M1-M5, P1-P8) are not repeated; where mine sits next to one, it says so.

## What I attacked and what held

- **Every new pure function on odd plans** (`break/odd.mjs`, `odd.txt`): 8 households (Dana & Lee, Jamie, Casey, Robin, Morgan, Sam,
  renterDebt, the family fixture) x 54 changes (no people, one adult, the partner removed with their rows left, no pay, retired, no
  accounts, birth year in the future / 1896 / five digits / year only / blank / last year, pay $1 billion, a $1 trillion 401(k),
  $10 million spending, zero pay / balances / spending, two jobs, the 401(k) turned into an IRA or a Roth, two unnamed 401(k)s, a $3
  401(k), "48,000" as text, contribution amounts null / "" / -100 / "abc", returns 0 / negative / 30%, all bonds, all stocks,
  retirement age "" / 120 / "sixty", plan-to age 50 / 150, an "old" 401(k), a 401(k) owned by a child or by nobody, "no match", "no
  plan at work", typed match tiers, empty tiers, euros, no contributions list, a row for a removed person, pay ended / not started,
  weekly pay, Social Security already claimed) x 4 dates (2026-11-11, 2031-07-01, 2040-01-01, none) = **1,584 runs of
  `goalSeek.compute`, `sensitivity.compute`, `idleWorkPlans` and `usualSaving`: 0 throws, 0 non-finite figures, 0 usual-saving rows
  with a negative, non-finite or over-100% figure, the plan never changed** (frozen JSON compared).
- **Every qa fixture and household** (`break/fx.mjs`, `fx.txt`: 1,433 plans = every `qa/fixtures` builder, every `qa/households`
  variation, the five phone-built households, the empty plan): 0 throws; Goal seek and Sensitivity gate exactly when the projection's
  `savingsUnknown` does (0 mismatches); no plan where the new saving row's high end is below "nothing"; no Goal seek page left with no
  card above the grey line.
- **Double taps on the new button** ("Add what you own ›" on What changes your answer, Sam) at 120, 300, 500 and 700 ms, 390 and 320 px
  (`break/walk2.mjs`, `walk2.txt`): the second tap lands on a figure label on Net worth (`div.stat-sub` / `div.stat-label`); nothing
  opens, the plan is unchanged, no page error. (For comparison, the same button on Will the money last? lands on "Update all balances
  at once" at 390 px and opens that page: not L1's code.)
- **Back, reload and leaving while What changes your answer works** (04-two-parents, CPU slowed 6x): Back, reload and moving to Goal
  seek, then Forward/Back: one page's content each time, never two, no page error.
- **The stored plan after a visit**: Casey, Goal seek then What changes your answer, the measure chip tapped twice: no key of the saved
  plan changed (`walk3.txt`).
- **Odd plans on screen** (320 px, `walk3.txt`): no people, birth year 1896, no accounts: both pages show their "needs the basics"
  hero, no error; no pay and retired-with-no-pay: real pages, no error, no sideways scroll.
- Not applicable to L1 (nothing of theirs in d540ebb): leftover answers, a split and Undo, OFX/QFX/CSV files, pay stubs, account numbers
  after an import. I searched nothing for account numbers because L1 stores nothing (the plan is unchanged after a visit, above).

## Findings

### B1 (severity 4). What changes your answer's headline reads "How much you save: nothing instead of nothing raises it by $0 a month" whenever the new saving row ranks first: 592 plans, 7 of the 13 qa base households

Steps: open What changes your answer (sandbox) with qa household `01-single-adult/base` (`break/plans/01-single-adult.json`), 390 px.

Evidence (`walk1.txt`, `shots/single_sensitivity_390_hero.png`, 320 dark `shots/single_sensitivity_320_dark_hero.png`):
"How much you save moves your plan the most ... How much you save: nothing instead of nothing raises it by $0 a month; 6.0% of pay
raises it by $1,390." A couple (`04-two-parents/base`, `shots/twoParents_sensitivity_390_hero.png`, `twoParents_sensitivity_320.png`):
"How much you save: nothing instead of nothing raises it by $0 a month; the usual share raises it by $2,210." (no share, no dollars).
Also `10-student-and-starter/base`: "... 5.1% of pay raises it by $1,430."

By code (`break/top.mjs`, `top2.txt`, today 2026-11-11): of 1,368 plans with rows, **592** have the new "nothing goes in" row on top,
so their hero says "nothing instead of nothing ... $0": 01-single-adult 83, 02-couple-no-kids 85, 03-single-parent 85, 04-two-parents
84, 05-stay-at-home-parent 82, 06-blended-family 87, 10-student-and-starter 82, 07 and 11 two each; the bases of 01, 02, 03, 04, 05,
06 and 10. The phone-built Casey (rank 3) and Morgan (rank 2) do not hit it, which is why the builder's walk did not.

Cause: `sensitivity/view.js` builds the hero line as `${top.label}: ${top.low.label} instead of ${top.baseLabel} ${verb(...)} ...` and
skips only the high clause when `top.high.label === top.baseLabel`. The new row's low end is the plan as it is (`label: "nothing"`,
`baseLabel: "nothing"`), so the low clause compares the plan with itself.

Fix (L1's own view): skip the low clause too when `top.low.label === top.baseLabel`, and for the saving row say what the person can do:
"If you put in what people paid like you usually do (6.0% of pay, about $X a month, plus the usual match), the plan could pay about
$1,390 a month more." For a couple, name each share instead of "the usual share" ("Ana 6.4%, Ben 6.0% of pay"). Test: a view-words
test (or a `heroLine` export from compute) on `01-single-adult/base` and `04-two-parents/base`: no "nothing instead of nothing", no
"by $0", a figure for the share.

### B2 (severity 3). Goal seek's new grey line tells a retired couple "Investments growing about -9.2% a year ... would still do ... 15.0 percentage points of room": a figure that is only the search's floor, in negative growth

Steps: Goal seek with the kit's `retiredCouple` (`qa/fixtures/retired-couple-plan.mjs`; `break/plans/retiredCouple.json`), or qa
`08-retired/base`; scroll to the line under the cards.

Evidence (`walk1.txt`, `shots/retiredCouple_goal-seek_390_line.png`, `retiredCouple_goal-seek_320_dark_line.png`,
`retired08_goal-seek_390_line.png`): "Investments growing about -9.2% a year on your mix of stocks and bonds would still do, against the
5.8% you assume: 15.0 percentage points of room for bad luck. Forecasts for the next 10 years: U.S. stocks 4.8%-6.8% a year (Vanguard,
as of September 30, 2026)."

By code (`break/floor.mjs`): the return search starts at -15 points (`smallestWhere(..., -0.15, 0.2, ...)`); this couple's plan lasts at
-15 points (blend -9.2%, end $51,973), at -20 (-14.2%), at -30 (-24.2%) and at -50 (blend **-44.2%**, still `success=true`). Its income
covers the spending, so growth does not matter; "-9.2%" and "15.0 points" are where the search stopped. Across all fixtures (`fx.txt`):
**131 of 1,433** lines print a negative growth, **128** of them at the floor: the retired couple, both widow plans, the two condo plans,
`08-retired` and its variations, every "trillion-balance" and "assumption-retirement-past-end" variation. The lever's value is as at
fa2026e (money critic: base vs head); the words are L1's (`returnWords`, the `room` case) and the line now sits under the cards with
forecasts appended.

Fix (`returnWords`, L1's lane): when the need is at or near the search floor, or at or below 0, print no figure: "Your plan does not
depend on how investments grow: it gets there even if they lost money every year." (floor), "It gets there even with no growth at
all." (need <= 0). Keep the forecasts sentence only where a figure is compared. Tests: the retired couple's line has no "-" figure and
no "15.0"; a plan with a need of -0.1% (`investments-plan.mjs`) says "even with no growth".

### B3 (severity 3). The "raise the return" item survives on Legacy goals, now listed among the changes with "That isn't a choice you can make."

Steps: Jamie (phone-built `noMatch`) with one bequest of $20,000 (`break/plans/jamieLegacy.json`) -> Legacy goals -> "Does the plan
leave it?".

Evidence (`walk1.txt`, `shots/jamieLegacy_legacy_390_levers.png`): the list of five changes reads What you can spend, When Jamie can
retire, What you need to save, **"📈 The return it needs: For the plan to work as it is, investments would have to grow about 10.4% a
year ... That isn't a choice you can make."**, What it is short today. So the page lists a non-choice as the fourth of five changes,
and it pushes the Social Security card out of the five (`slice(0, 5)`). L1's message says it "kills the 'raise the return' trap"; it is
gone from Goal seek only. The builder saw this ("Seen, not changed"); `estate/legacy` is not in any lane L1 must avoid.

Fix: in `estate/legacy/view.js` list `d.levers.filter((l) => !l.info && l.status !== "same")` (or drop `info` levers in
`legacy/compute.js`), and if wanted put the return's `line` in grey under the list as Goal seek does. Test: Legacy goals' list for
Jamie has no `returns` item and shows the claim card.

### B4 (severity 3). With an empty 401(k) on file and "None" going in, What changes your answer says "You haven't told us about retirement savings" and hides the one row it could show

Steps: Casey (phone-built `noContrib`) with the 401(k) balance at $0 (`break/plans/caseyZero401k.json`) -> What changes your answer.

Evidence (`walk3.txt`; `shots/caseyZero401k_sensitivity_390.png`, `caseyZero401k_sensitivity_320_dark.png`): "We don't know yet. You
haven't told us about retirement savings, so we can't say which of your numbers change the answer most. Add what you own first ..."
with "Add what you own ›". The same plan's Net worth lists "Casey's plan at work, 401(k) / 403(b), $0" (`caseyZero401k_net-worth_390.png`)
and Retirement contributions lists "Casey's plan at work, Casey · $0 every month" (`caseyZero401k_contributions_390.png`): Casey did
tell us. By code (`break/gatehide.mjs`): the row the gate hides is exactly the new one, `usualSaving` = 6.6% of pay ($396 a month) into
that 401(k) plus the usual match ($2,880 a year): the plan could pay **$2,690** a month instead of **$220** (it plans $3,090). For Sam
the hidden row is 5.0% of pay: $0 -> $2,520. A new hire who enrolled at $0 and puts nothing in is the person the owner described
("maybe they didn't input how much they contributed"). The gate follows the spec ("as the other two pages are"); the words are the
other pages' too, but untrue here.

Fix (L1's view and compute, inside the spec's gate): keep "We don't know yet" and the one filled "Add what you own ›"; when a 401(k),
IRA or Roth is on file (even at $0) or Get started's saving answer is "None", say the spec's own words for this state, "Nothing is saved
for retirement yet, and nothing goes in.", and add one grey line from `usualSaving`, as the spec's L2 card does with questions: "If Casey
put in 6.6% of pay (about $400 a month) plus the usual match, the plan could pay about $2,690 a month of the $3,090 it plans." Test:
`caseyZero401k` -> gated, no "haven't told us", the line's figure equals a hand-built contribution row run through `buildInputs`.

### B5 (severity 2). A birth year typed in the future gives a "6.3% of pay: $25,490 a month" saving row: `usualSaving` accepts a person aged -54

Steps: Casey with birth date 2080-06-15 instead of 1980-06-15 (`break/plans/caseyBorn2080.json`; the People form has no future-date
check) -> What changes your answer.

Evidence (`walk4.txt`, `shots/caseyBorn2080_sensitivity_390.png`, `caseyBorn2080_sensitivity_320_dark.png`): "How much you save moves
your plan the most ... can pay for about $5,780 a month ... against the $3,090 it plans. How much you save: nothing instead of nothing
raises it by $0 a month; 6.3% of pay raises it by $19,710." Row: "nothing: $5,780 / 6.3% of pay: $25,490". With 2096 (walk3):
"6.3% of pay raises it by $30,820". By code (`break/typo.mjs`): `usualSaving` keeps the person because `age < retireAge` holds for
age -54; a "self" born 2018 (age 8) with pay also gets a row (5.9% of pay). The projection itself accepts the future date ("Retirement
starts in 2145 (Casey at 65)", verdict "on track"): claude-c's lane, pre-existing; the new row multiplies it into the page's headline.

Fix: in `usualSaving` skip anyone under working age (`age < 16`, or the guesses' own floor), and post to claude-c: `buildInputs` should
list a birth date in the future as missing ("Casey's birth date is in the future: check it on the People page"), as `noYears` does for
the past. Test: `usualSaving` on the 2080 plan returns [].

### B6 (severity 1). Goal seek's saving card says a 401(k) "holds $0" when it holds a few dollars

Steps: Casey with the 401(k) at $4 (`break/plans/caseyTiny.json`) -> Goal seek.

Evidence (`walk4.txt`, `shots/caseyTiny_goal-seek_390.png`): "Save about $900 a month. Casey's plan at work holds $0, but nothing goes
into it now (you said so)." `idleWorkPlans` counts balance > 0 and prints `Math.round(total / 10) * 10`; $1-$4 prints $0.

Fix: under $100 print the dollars (`Math.round(total)`), or count a 401(k) as holding money only from $10 (match the rounding).
Test: a $4 balance never reads "$0".

### B7 (severity 1; next to money critic M3). The share on the high end's label is not what the row puts in when the 401(k) limit binds

By code (`break/cap.mjs`): Casey at $450,000 of pay: the bar's label says "7.7% of pay" ($34,650), the row puts in $24,500 (the 2026
limit, 5.4% of pay) plus a $14,400 match. No qa/households plan reaches the cap at work (0 of them), so it shows only for high earners.

Fix: when `own < share x pay`, label the end with what goes in ("the most allowed, $24,500 a year") instead of the share.

## Try on a real iPhone (no WebKit here)

- What changes your answer: the hero for a household where "How much you save" ranks first, once B1 is fixed (one line, no clause
  repeated), at 320 px.
- Goal seek: the grey line for a retired couple after B2's fix (no negative percentage); its wrap at 320 px in dark mode.
- The double tap on "Add what you own ›": Safari's tap delay and its ghost click may differ from Chromium's; check the second tap still
  lands on a label on Net worth and opens nothing.
- Reload while "Nudging each of your numbers..." shows (Safari restores pages from its back-forward cache differently).
