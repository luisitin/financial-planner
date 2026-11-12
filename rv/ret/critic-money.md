# Money critic, track "ret" (L2-L6), claude-b's worktree rv/b-ret at 1942862 (base fa2026e)

Second pass, 2026-11-12. Reviewed from a detached copy `rv/v-ret-money` at **1942862** (the five L commits 4284fd5, be77621,
d5b9e86, 0bd4a09, 71ff05a plus `fixup! "What this rests on"`), served on 127.0.0.1:9741 (sandbox, Chromium with an iPhone
user agent, 390 px and 320 px, light and dark). Base for comparisons: `git archive fa2026e` in `rv/ret/money/base`.
Scripts and outputs of this pass: `$SP/rv/ret/money2/`
(`*.mjs`, `out-*.json`, `tests.log`, `npmtest.log`); screenshots in `.../rv/ret/money2/shots/`. The first pass (at 71ff05a) is kept as
`rv/ret/money/critic-money-round1-71ff05a.md`. Only what I confirmed on screen or by running code is listed.
Severity 5 = a wrong figure a person would act on.

**State of the builder's worktree.** `rv/b-ret` has uncommitted work from an interrupted fix round (5 files changed and
`tests/levers-saves.test.mjs`, last touched 02:54). I read that diff: it is about other critics' items (the match box on a landing,
the settings fold's notice, "if markets do as well as average", double taps). It does not touch any finding below:
`levers.js` there still reads the left-over as `leftOverOf(spare)`. M1 to M4 of the first pass are all still open at 1942862.

## Findings

### M1 (severity 5, L4 d5b9e86; the figure comes from L2 4284fd5). "Money left over each month" is not the Dashboard's left-over: it adds back the money that already goes to goals, and uneven pay the plan does not count on
- **What.** `levers.js:470` takes `leftMonthly = leftOverOf(spare)`: Next best action's left-over with the goal saving added back,
  at the month all uneven pay comes in (`core/math/leftover.js`). The row, its three effect lines, the hero's "1 thing is not counted
  yet: the $X left over", the panel's question, its prefilled amount and its "more than is left over" cap all use it. The Dashboard's
  "Left over each month" is `spare.monthly` (after goals, uneven pay at what the plan counts on). Saving the prefilled answer spends
  the goal money twice, and the month goes short. (The spec's own table names `leftOverOf(spare)`; the result is still wrong on screen.)
- **Steps and evidence, Priya & Tom (`qa/households` 02-couple-no-kids base, goals take $1,000 a month), 390 px.**
  1. Dashboard: "You're in good shape. Left over each month $4,861" (`shots/left-02_couple_no_kids_base-invest-390-dash-before.png`).
  2. Will the money last? card: "Money left over each month · Not counted · $5,861 a month · If it's invested: lasts to the end
     (age 95). If it piles up in the bank: lasts to the end (age 95). As it is, counted as spent: runs out at 72."
  3. Answer → Invested for later: the box holds 5,860 (`...-panel.png`). Save my answer: "Saved: $5,860 a month into Brokerage. Your
     retirement answer: now lasts to the end, age 95 (was: runs out at 72)."; the headline turns to "The money lasts" (`...-saved.png`).
  4. Dashboard: "More goes out than comes in each month. Left over each month -$999" (`...-overview-dashboard.png`); Next best
     action: "About $999 a month more goes out than comes in, after tax and saving. Trim spending or pause a goal first."; Your plan:
     "In short: about $999 short each month".
- **A month that is already short (07-multigenerational base, 320 px dark).** Dashboard: "More goes out than comes in each month ·
  Left over each month -$45" (`shots/left-07_multigenerational_base-invest-320-dark-dash-before.png`). Card: "Money left over each
  month · Not counted · $855 a month · If it's invested: runs out at 75 ... As it is, counted as spent: runs out at 70"
  (`...-row.png`); the panel prefills 850 under "Your emergency fund is $45,140 short"; Save: "now runs out at 75 (was 70)"; Next
  best action then: "About $895 a month more goes out than comes in".
- **Uneven pay (Jamie plus a side business of $1,000 a month of which the plan counts on $400; `money2/held-jamie.plan.json`).**
  Next best action's month is $864 (held back after tax: $417). Card: "$1,282 a month", prefill 1,280. Save: "now lasts to the end,
  age 95 (was: runs out at 70)". Dashboard after: "Counting your uneven pay at what you can count on, more goes out than comes in";
  Next best action: "About $416 a month more goes out than comes in"; Your plan: "about $416 short each month".
- **Reach (`money2/goals.mjs`).** 35 of the 63 base plans get a left-over row; in 15 the card's figure is not Next best action's
  (every one saves to goals: the family, demo, card-gap and held fixtures, archetypes 01-07, 09, 10, 12, 14). After investing the
  prefilled amount the month is short by the goal saving in each (01 -$243, 03 -$342, 04 -$493, 05 -$495, 09 -$2,291, 12 -$7,997).
- **Why the tests pass.** `tests/levers.test.mjs` checks "NBA spare.monthly after = before - amount" (true), on households with no goals.
- **Fix.** In `levers.js` take the left-over as the Dashboard's: `leftMonthly = spare ? Number(spare.monthly) : null` (after goals;
  uneven pay at what the plan counts on), for the row, effects, hero line, `leftoverStanding.total`, the prefill and the cap; no row
  under $50 (07 and 12 then get none). Say the change from the spec's table in both READMEs. Tests: (a) 02-couple-no-kids and the
  family fixture: the row's figure equals NBA `spare.monthly`; (b) after saving the prefilled answer NBA `spare.monthly` is
  between $0 and $10 and the Dashboard's verdict is unchanged; (c) 07 and 12: no row and no "not counted yet: the $... left over";
  (d) a plan with `income[].countOn` below its amount: the row equals `spare.monthly`, not `spare.full`.

### M2 (severity 4, L6 71ff05a). "Some of each" does not keep the person's total: typing only the pay-the-tax-now part adds new money
- **Steps (Dana & Lee, 390 px).** Contributions → "Dana's plan at work" (own money 400, match $2,400) → Some of each. The first box
  ("Pay the tax later: your own money") still holds the whole 400; the second ("Pay the tax now") is empty. Type 2% in the second
  → "Paying it all later would lower this year's federal tax by about $190." (`shots/split-couple2k-some-_2-390-form.png`) → Save changes.
- **Evidence.** Notice: "Saved: $400 a month paying the tax later with the match, and $130 a month into Dana's Roth 401(k) at work,
  paying the tax now. Your money when retirement starts (2044): 90% pay-the-tax-later, 8% already taxed (Roth), 2% regular savings."
  Rows: 400 + 130 = $530 a month (was $400). Hero: "$10,560 a year into retirement accounts · $8,160 of your own money" (was $9,000 and
  $6,600). Nothing says the total rose by $1,560 a year; no retirement answer is given (D-C3), so Will the money last? improves on
  money Dana does not put in: by code (`money2/m2ans.mjs`) from about $261,000 to about $343,000 left at 97, and the month's
  left-over falls from $1,828 to $1,698. Spec risk 3 ("a split keeps the person's total own money") and the commit's claim hold only when both
  boxes are retyped (4% and 2%: 260 + 130; `shots/split-couple2k-some-4_2-320-dark-saved.png`), and there the form says "$190"
  while the notice says "about $200 more than before" for the same change.
- **Fix.** On entering Some of each, keep the total: show it ("Now $400 a month in all") and take the pay-the-tax-now part out of
  the later box when it changes (same unit: dollars, or % of pay); if the person changes both and the sum differs, say so before
  saving ("That is $530 a month in all, $130 more than now."). Work the form's tax line on that total. Fake-DOM test: type only the
  second box; the person's own money a year is unchanged.

### M3 (severity 4, L4 d5b9e86). "It stays in the bank" is then called retirement saving, and the plan stops counting on it for the emergency fund
- **Steps (Morgan, phone-built renter, 390 px).** Dashboard before: "Your month works. Your emergency fund is thin. ... About
  $6,400 a year builds up in checking and savings." Will the money last? → Money left over → Answer → It stays in the bank → Into
  which account: Savings, 530 → Save: "Saved: $530 a month into Savings. Your retirement answer: now runs out at 71 (was 65)."
  (equal to the card's "If it piles up in the bank: runs out at 71").
- **Evidence after the save** (`shots/left-renter-bank-390-*.png`, `money2/bank2.mjs`):
  - Dashboard and Your plan: "Checking and savings stay about level over a year, and $6,400 goes into retirement." (It goes into Savings.)
  - Emergency fund page: "$2,480 more in cash you can use gets you to 6 months ... Keep the $2 left over each month ... in Savings."
  - Next best action: "A full emergency fund (6 months)" had `doneDate` 2027-04-12 at $532 a month; after the answer it has no
    date and "An IRA of your own" loses its start date (2027-03-12). For Jamie (bank $560) "Pay off expensive debt from savings"
    loses 2028-03-12.
  - Benchmarks: "$6,360 a year goes into retirement accounts, employer money included: 11% of pay"; Contributions' hero: "$6,360 a
    year into retirement accounts" (before: nothing went in).
  - Invested instead (Jamie, $560 into a brokerage account): Benchmarks "$9,720 a year goes into retirement accounts ... 15% of
    pay. The usual aim is 15%." (his own $3,000 a year is 4.7% of his $64,000 pay); the money is real saving there, only
    "retirement accounts" is off.
- **Fix.** A row into a cash account (`BUCKET_OF[type] === "cash"`) is money that stays in checking and savings. In this track's
  files: Contributions' hero and share-of-pay line leave such rows out of "into retirement accounts" (say "$X a month stays in
  Savings, counted for later"). Post to claude-f (Next best action, `core/math/leftover.js`): keep such rows out of
  `retirementSaving` (a `bankSaving` part added to `cash` in `yearSaving`, and to the money the emergency-fund and debt steps can
  use); and to Benchmarks' owner: leave cash rows out of the saving rate, and say "saved for later" for brokerage rows. Test:
  Morgan's bank answer leaves the Dashboard's year line at about $6,400 into checking and savings and the emergency-fund date.

### M4 (severity 2, L6 71ff05a). "This year's federal tax" is a whole year's difference said in November, and the state's part is left out
- **Steps.** Dana & Lee → Contributions → Dana's row → Pay the tax now → Save (today 2026-11-12).
- **Evidence.** Notice: "This year's federal tax: about $580 more than before." (`shots/split-couple2k-now-_-390-saved.png`). The
  Federal estimate goes $10,448 → $11,024 (+$576 = $4,800 x 12%; by hand with the 2026 joint figures: $32,200 standard deduction,
  10% to $24,800, 12% to $100,800). That is twelve months of rows; about a seventh of 2026 is left. The month itself falls by
  $63.96 (`money2/nbasplit.mjs`): $48.00 federal and $15.96 state (they live in North Carolina), so a year costs $768, not $580.
  The form's "would lower this year's federal tax by about $190" has the same wording.
- **Fix.** Say it as a yearly figure and give the month: "About $580 a year more in federal income tax (state tax on top): about
  $64 a month less take-home pay." (Next best action's month before and after, as `pending.left` already does for other saves.)

### M5 (severity 3, L2 4284fd5 / L3 be77621). "Enough for the whole usual match" says more than typing it gives; the old guessed match becomes the person's own
- **What.** When the match is our guess and the person puts in under 6% of pay, the work-saving row tries 6% of pay **with the
  usual match at 6%** (`workAlt` kind "full"). Its link lands on Contributions with a note naming only the amount; the match box
  opens grey with the old guess (worked out for the smaller amount). Saved with the box left blank, the old guess is kept and
  becomes "Yours" (`fillBlankFromGuess`), so the answer is not the one the card showed.
- **Steps (Robin, phone-built, with what goes in set to $175 a month, 3% of pay, and the match our guess of $1,440;
  `money2/full-robin.plan.json`, `money2/fullwalk.mjs`, 390 px).**
  1. Card: "What goes into Robin's 401(k) · Yours · $175 a month (3% of pay) · 6% of pay, enough for the whole usual match: runs
     out at 93." (`shots/full-robin-390-card.png`); headline "Runs out in 2054 (age 91)".
  2. Type what goes in ›: "The change we tried on your retirement answer was 6% of pay, enough for the whole usual match: $350 a
     month instead of $175." Amount box 175; match box empty with 1440 grey.
  3. Type 350, Save changes: "Contribution saved. Your retirement answer: now runs out at 92 (was 91)." The row reads "$350
     every month · employer adds $1,440 a year" with no "(our guess)" (`shots/full-robin-390-saved.png`); the ledger entry is gone.
  4. Back on the card: "What Robin's job adds (the match) · Yours · $1,440 a year · If Robin's job matched like most (about
     $2,760 a year): runs out at 93."
- **Fix.** When the row's match is our guess and the box is left blank, the save re-estimates it at the new amount
  (`usualMatchAt(plan, pid, today, own after the save)`) and keeps it a guess (`markGuess`, key `contrib.match`); the landing's
  note says both parts ("... $350 a month, and the usual match at that, about $2,760 a year, our guess until you type the real
  one"). The uncommitted F2 work in `rv/b-ret` does this for the "usual" landing only (`matchGuess: fill ? alt.match : 0`):
  extend it to "full". Test: the answer after that save equals `tryChange(applyWorkAlt)` and the match is still `isGuess`.

### M6 (severity 3, L5 0bd4a09). The J.P. Morgan figure on Assumptions is last year's edition: the one out since 2026-10-19 says 7.5%, not 6.7%
- **Steps.** Assumptions → Stocks grow each year (390 px, and 320 px dark: `shots/forecast-320-dark.png`).
- **Evidence.** On screen: "Most forecasts for the next 10 years: 4.8%-6.8% a year for U.S. stocks (Vanguard, as of 2026-09-30);
  6.7% (J.P. Morgan 2026)."; in the fold: "J.P. Morgan's figure is for U.S. large companies, from its 2026 long-term capital
  market assumptions (2025-10-20)." Opened today: J.P. Morgan Asset Management's release "J.P. Morgan releases 2027 Long-Term
  Capital Market Assumptions" (2026-10-19): "U.S. large cap equities are expected to return 7.5%, increasing from 6.7%"; a 60/40
  portfolio 7.0%; the horizon is "10-15-year". So the newer forecast is above the plan's own middle figure (7%), and the line's
  "most forecasts ... 6.7%" is no longer true. The Vanguard figure is current (page of 2026-10-21, "as of September 30, 2026",
  U.S. equities 4.8%-6.8%).
- **Fix.** `FORECAST_LINE`: "Forecasts for the next 10 years or so differ: 4.8%-6.8% a year for U.S. stocks (Vanguard, as of
  2026-09-30); 7.5% (J.P. Morgan, October 2026)." The fold: "... from its 2027 long-term capital market assumptions (2026-10-19;
  10 to 15 years; the edition before said 6.7%)". Update `system/assumptions/README.md` lines 55 and 73 and the comment at
  `levers.js:40`. The chips can stay: 7.5% is under the Hopeful 8%, so "Higher than any forecast we know" (above 8%) still holds.
  Keep the figures and their dates in one constant with a "read on" date so the next edition is one edit.

### M7 (severity 2, L4 d5b9e86 with the fixup's hero line). After "We don't know yet" the notice says "(was: runs out at 65)"
- **Steps (Sam, kit household, nothing saved for retirement, 390 px).** Will the money last? says "We don't know yet" and the card
  asks "If it were invested: it would last to the end (age 95)". Answer → Invested for later → 740 → Save.
- **Evidence.** Notice: "Saved: $740 a month into Investments for later ... Your retirement answer: now lasts to the end, age 95
  (was: runs out at 65)." Hero: "Before your change: We don't know yet. Now: The money lasts. If markets do as well as average,
  before your change: runs out at 65. Now: lasts to the end (age 95)." The page never gave Sam "runs out at 65" (it withholds a
  verdict when no savings are on file), and one sentence says both "We don't know yet" and "runs out at 65". The after figure is
  right (said = done).
- **Fix.** Carry `unknown` with the answer kept before a save (`leftPending.before`, `lastDrawn`); when it was unknown, say only
  the new answer ("Your retirement answer: now lasts to the end (age 95).") and leave the average-market "before" out of the hero line.

### M8 (severity 2, L6 71ff05a, `career/benefits`). With all of it paid now, Work benefits says "because less tax comes out, your take-home pay drops by only $180" for $180 put in
- **Steps.** Dana & Lee → Contributions → Dana's row → Pay the tax now → Save → Work benefits.
- **Evidence.** "Puts $180 a paycheck into the 401(k); because less tax comes out, your take-home pay drops by only $180; your
  employer adds $2,340 a year. $4,680 of it goes in after tax (Roth)." The figures are right (the stat reads "on $0 put in before
  tax", tax saved $0); the sentence gives a reason that is not true for Roth money (`career/benefits/view.js:83`, whose `roth` the
  commit now fills from the Roth 401(k) rows).
- **Fix.** When `o.roth` is the whole of it: "it goes in after tax, so your take-home pay drops by the same $180"; when part:
  "less tax comes out on the part that goes in before tax, so your take-home pay drops by $161".

## Checked and found right (code run or screen)
- **Said = done, on screen (Jamie unless named; `money2/sd1.mjs`, `sd2.mjs`, `left.mjs`).** Each card line against the same change
  made by hand on the page it links to, then the notice and the hero: the match typed as 2,040 → "now runs out at 74 (was 70)" =
  card 74; 1% of pay more (303) → 71 = 71; left-over invested (560) → 89 = 89; Careful 6% → 69, Hopeful 8% → 71; prices 2.5% →
  71, 4% → 68; plan to 100 → still 70; stop at 67 (People) → 78; Social Security at 70 → 68; spending 2,898 → 73; stocks once
  retired 30% → 70, 70% → 71; Casey's 6.6% plus the usual match (form saved as it opens) → 88 = 88; Morgan in the bank → 71 = 71;
  Dana & Lee invested (320 px dark) → "about $1,165,000 more left at 97" = the card; Sam invested → "lasts to the end (age 95)".
- **The left-over on every plan (`money2/leftsd.mjs`).** 35 plans x 2 answers: the card's effect (a new $0 account) equals the answer
  after the panel's own default save (the first account of that kind on file, else a new one) in all 70; Next best action's month
  falls by exactly the amount saved in all 70 (the arithmetic of "nothing counted twice"; M1 is about which figure is asked about).
- **Asking again (D-B6, `money2/again.mjs`).** No question at 364 days, asked at 367; spending up $140 (24.7%) not asked, up $150
  (26.5%) asked ("You said in November 2026 that $560 a month is invested. Left over each month now: $417. Still right?"); the row
  removed on Contributions puts everything back (runs out at 70, row "Not counted" again). D-B5's words appear when a bill is our
  guess (`money2/partly2.mjs`); none of the phone-built households has one.
- **Invariance (`money2/run-all.mjs`, `two.mjs`).** Every module's compute on 63 plans (qa fixtures, the four finished personas, 14
  archetype bases, the five phone-built households), fa2026e against 1942862: only `career/benefits` (`total.rothYearly: 0` added),
  `system/assumptions` (`hopeful: false` added) and the timestamps of `system/audit` and `system/backups` differ; with those keys
  removed, 0 differences. No `compute.js`, `core/` or `qa/` file changed between 71ff05a and 1942862 (`git diff --stat`), so the
  first pass's sweep of all 1,449 pack variants (outputs on disk, re-diffed now: the same four modules) still stands.
  `tests/leftover-invariance.test.mjs` passes.
- **Golden keys.** `tests/golden/**` untouched (`git diff --stat fa2026e..HEAD -- tests/golden` is empty). Track and golden tests
  on my copy (levers, levers-before, tax-split, leftover-invariance, guesses-invariance, the contributions, assumptions, projection,
  paycheck and benefits module tests, golden retirement, paycheck, career, federal, limits): 52,871 pass, 0 fail (`money2/tests.log`).
  Whole `npm test` on my copy at 1942862: 189,309 tests, 188,667 pass, 0 fail, 3 skipped, 639 todo (502 s under load;
  `money2/npmtest.log`).
- **The match rule (IRC 402(a), 402A).** After "Pay the tax now" the match stays on a $0 pay-the-tax-later row ("Dana's plan at
  work · $0 every month · employer adds $2,400 a year"), after "Some of each" it is only on the later row; the Roth 401(k) row
  counts against the 401(k) limit ("Dana: 401(k) / 403(b) $4,800 of $24,500"; `limitKind` "401k" for all three rows); Robin at 63
  reads "$35,750" ($24,500 + $11,250).
- **The federal tax difference.** $576 for $4,800 moved to Roth (hand check above); 260/140 split: $10,649.60, +$201.60 = $1,680 x
  12%. Paycheck shows "Roth 401(k), after tax" from the row; Work benefits "on $0 / $3,120 put in before tax".
- **The mix at retirement.** From the projection's 2044 row: before 97 / 0 / 3; all now 70 / 27 / 3 (deferred $514,607, Roth
  $200,803, cash $18,539); 260/130: 88 / 9 / 3. Each adds to 100. No "which is better" answer is shown (D-C3); the engine does
  favour Roth ($261,000 → $287,000 left), and the hero's "Before your change" line says so.
- **SECURE 2.0 catch-up line (IRC 414(v)(7)).** On screen for Robin (63) with pay of $150,012, not at $150,000; by code: none at
  49, none for 2025. Vanguard's *How America Saves 2026* (PDF opened today): "Starting in January 2026, participants age 50 or
  older who earned more than $150,000 in the previous year may make catch-up contributions only to Roth." IRS Notice 2025-67
  ($150,000, 2025 FICA wages) read only through law-firm summaries in a search result, not the notice itself.
- **Sources opened today.** Vanguard forecasts page (above). *How America Saves 2026*: "The average value of the promised match
  was 4.7% of pay, and the median was 4.0%" (Figure 7); "The average employee-elective deferral required to maximize the match
  was 6.4% of pay, and the median was 6.0%"; "The median participant deferral rate was 6.6%" (Figure 29): the card's "about 4% of
  pay when you put in 6%" and `matchTerms()` (0.04, 0.06) agree. J.P. Morgan 2026 edition 6.7% (release 2025-10-20) and 2027
  edition 7.5% (M6). Brown, Cederburg and O'Doherty, "Tax uncertainty and retirement savings diversification", *Journal of
  Financial Economics* 126(3), 2017, 689-712 (RePEc listing and press summaries: diversify between the two; not the full text).
  The inflation chips' reasons match what I know of BLS CPI-U (7.0%, 6.5%, 3.4% for 2021-2023; about 3% a year over a century);
  not re-opened today.
- **OFX fields.** Not in this track (L8 is the doc track).

## Housekeeping
The server on 9741 is stopped and the review worktree `rv/v-ret-money` is removed. `rv/b-ret` was only read. Scripts, plans and
screenshots stay in `rv/ret/money2/`; the downloaded Vanguard PDF is in `rv/ret/money2/dl-has/` (read with `pdftotext` only).
To run a script again: `ROOT=<a copy of the app at 1942862> node rv/ret/money2/<script>.mjs` (the code scripts), or serve that copy
on 9741 for the walks (`srv.mjs <root> 9741`).

## Not walked
Safari/WebKit (only Chromium is installed). On a real iPhone: the left-over panel's amount box ($ prefix, 16 px), the Some of each
boxes' `change` on blur (the tax line), the chips' pressed state, and the match box's grey guess after a landing.
