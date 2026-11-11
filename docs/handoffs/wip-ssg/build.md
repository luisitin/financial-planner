# Follow-up lane 2 (claude-b): Social Security for people already retired, and guesses that give the most likely value

Base c804ed0. Tree: <scratch>/wssg (not committed). Patch: <scratch>/ssg/patch.diff (`git diff --cached --binary c804ed0`, 16 files, 1,317 lines; applies cleanly on c804ed0). No CHANGELOG line, as the brief asks. The wording test (`$S/words/wording.test.mjs`) was copied in, run and removed: no hit in any file this change touches (every hit it lists is in a file this change does not touch: c804ed0 predates the wording sweep 79dd6ab, and claude-a's pages are its todo entries). It is not in the patch.

All before/after figures come from `node qa/guess-sanity.mjs` on the base tree and on this tree (2,744 sampled grid households, 20 edge households, the qa fixtures, 1,400 qa/households plans and the 9 one-answer sweeps): $S/ssg/before/sweep/ and $S/ssg/after/sweep/. Probes are in $S/ssg/probes/, their outputs in $S/ssg/before/ and $S/ssg/after/.

## 1. Social Security for someone already retired, amount left blank

BEFORE. Someone aged 62 or older who answered question 3 with "I already get it", "I have my statement figure" or "Not sure" and left the amount blank was planned on $0 of Social Security. Probe (`probes/ssprobe.mjs`, one retired adult at 63, 66 and 72): no full-age amount and no Income line in all 9 cases, so `pt.ss.not-zero-when-retired` failed 9 of 9. Sweep: 273 of 509 checks failed (190 of 371 households). In the tier-B grid, 95 of 271 households failed, 82 of them with a retired adult.

AFTER.
- "I already get it", blank: the average SSA pays retired workers that age (Table 5.B9; the men's or women's row when Longevity gives the sex). It is read on straight lines between the age bands' middles. It is written as a typed amount is: the Income line "Your Social Security" (key `overview/setup:ssPaid`), the age it started (full retirement age once past it, otherwise today's age), and the full-age amount worked back from it (paid / claim factor, key `overview/setup:ss`). Both are marked as our guess. Probe at 63 / 66 / 72: Income line $1,451 / $1,838 / $2,225 a month; full-age amount $1,934.70 / $1,969.30 / $2,225. The verdict on Will the money last moves from short to on track in all three.
- "I have my statement figure" or "Not sure", blank: the full-age amount is what "Estimate it for me" writes. That is the pay on file, or, once work has stopped, the retired average for that age. There is no Income line, because nobody said it is paid. Probe: $1,934 / $1,969 / $1,686 (at 72 the figure is valued at 70 by the Social Security page, so the page shows $2,225). The rule passes; the verdict stays short for these one-adult probes, and the cause is no longer $0.
- From 70: `averageRetiredBenefit` divides by the claim factor at 70. The Social Security page values a benefit not yet claimed at 70, so it now shows the average and not 24% to 32% more. A 72-year-old (born 1954) on "Estimate it for me" was shown $2,225 x 1.32 = $2,937 a month before; now $2,225.
- The box on question 3 shows our figure in gray with "Our guess: what retired workers your age get on average" (getting). For the statement box it says "Our guess: worked out from the pay on file", or "Our guess: worked back from the $X retired workers your age get on average". The value stays blank, so saving the screen again keeps the figure ours. Typing an amount ends both guesses. A line or full-age amount the person typed (on Income or on the Social Security page) is never replaced, and the box then shows no gray figure. Answering anything else removes our line and our start age.
- Our guesses for you lists the line under its own name. The last screen's later list says: "Your Social Security is the average for retired workers your age: type what you get a month to make it exact" (to Income), or "...: the statement at ssa.gov/myaccount is exact" (to the Social Security page).
- Only from 62 (before that a payment is disability or survivor money, not this average). Only for a U.S. plan in dollars (core/estimate `applies`).
- Sweep: 154 of 509 checks fail (103 of 371 households). Tier-B grid: 13 of 271, and 0 households with a retired adult (target met). The 13 left are a partner whose answer on work is "not working" (status none), 62 or older, on "Estimate it for me" with no pay. That is the spousal benefit (`pt.ss.spousal-floor`), not this item. The rest of the 103 (`probes/sssplit.mjs`, $S/ssg/after/sssplit.txt) are 81 qa/households plans built on pages, which never answered question 3 so nothing is guessed, and 9 qa fixtures. The fixtures are hand-built plans with a typed "social" Income line and no `retirement.socialSecurity` record (retiredCouplePlan, guardRetiree, separateCouple, youngerOwnerCouple, taxedDrawRetiree, shortSavingsRetiree, firstRmdPlan, widowPlan), plus fullBracketRetiree ("getting" with nothing else). The Social Security page shows $0 for those because it does not read the Income line: a follow-up for retirement/social-security, listed below. Neither kind goes through question 3's save, so this change does not reach them.

## 2. The family-spending floor, then a fit to take-home

BEFORE. The floor (a family never gets a row smaller than the same adults without a child) went on top of the envelope with no check. On its own it pushed the guessed leftover below zero. g74 (Texas couple of 20 with a baby, childcare "no"): leftover -$140 a month. g340: -$194. Families with a guessed leftover below zero: 486 of 1,595.

AFTER (spend.js `fitFloor`). The rows are worked out without the floor and with it. The room is take-home (income tax off) less payroll tax (7.65% of pay; 15.3% of 92.35% of business pay), less retirement saving out of pay (typed, or our guess at the figure its own estimator gives), less bills typed and loan payments, less the rows without the floor. The floor's extra is added only as far as the room allows: first rent, utilities and groceries, then the other rows, each group in one share. Where the rows without the floor already spend more than the room, no floor is added. g74: -$140 to +$20. g340: -$194 to +$226. Families below zero: 448 of 1,610. 53 families were fixed, and 15 retired families became measurable (Social Security now counts as income). The 448 left are short before any floor: there the fit adds none. For example g63, a Mississippi couple of 20 with a baby and four debts, goes from -$240 to -$100 with the floor's whole extra removed. ("Families" are grid households with a child and nothing typed, `probes/floor.mjs`.)
- Sweep: SF-LEFTOVER-DEFAULT 716/2,667 to 672/2,768; SF-SPEND-FOOD 295 to 256; sr.leftover.saving 832 to 796.
- Medicare floor (the insurance row is at least Part B and Part D for someone on Medicare): it is now a fixed part of the row that the envelope's k does not scale down. SF-HEALTH-AGE 23/893 to 3/1,003 (the 3 left are "b: under 35", unchanged).
- Trade-off (documented): SF-SPEND-CHILD-MONO 0/180 to 9/180. These are the same couple at $60,000 with a child, spending less on rent than without one. In Ohio and Texas it is 10% to 13% less while the leftover stays above zero. In California the couple without a child is already about $900 a month short. The fit and the rule cannot both hold there.

## 3. A rent guess above the 95th percentile (g77)

BEFORE. g77, a California couple of 20 on $188,000 renting with a baby: rent $3,550 a month, 22.7% of income. That is above the 21.5% that 95 in 100 renters in the top income fifth pay. SF-SPEND-RENT 1/379.

AFTER (spend.js `rentCap`). The model's figure stands and the fifth's 95th percentile is its ceiling. The ceiling never falls as income rises. g77: $3,350 (21.4%). SF-SPEND-RENT 0/408. Why the cap and not the median: see Decisions.

## 4. The home value: the most likely value, not the p95 cap (g3)

BEFORE. Above the age group's 95th percentile of value over income, the guess was that cap. Ohio, owner of 30 on $12,000: $85,000 (the cap). g3 (New York, 20, $20,000, mortgage): $140,000 (the cap). HD-HOME-VALUE-INCOME 1/1,548.

AFTER (`homeCellValue` in common.js; home.js `home.value`). Over the cap, the guess is the SCF 2025 age x income cell's median value, at the state's prices (ACS state median over national). Cell values never fall as income rises (pool-adjacent-violators, weighted by households). They are read on straight lines of the log between group middles and across age-group middles, and held flat below the lowest group's middle. Ohio, 30, $12,000: $80,000. g3: the cell's $135,359 at New York's prices, which rounds to $140,000. The survey says that is the likely figure there too, not only the edge. HD-HOME-VALUE-INCOME 0/1,573. Checked with `probes/homefine.mjs`: no fall as pay rises in $1,000 steps from $5,000 to $80,000 at seven ages in four states. The largest step is x1.32, where the cell meets the formula (Ohio, 20, $13,000 to $14,000).
- The floor side (below the 5th percentile) is unchanged. Swapping in the cell there made the guess fall a sixth and rise again as pay went up (Mississippi, 45, $245,000 to $250,000).

## 5. The $350 home insurance floor on cheap homes

BEFORE. $350 a year for any home; on a $10,000 home that is 3.5% of the value. The sanity check's line is "1.61% or source minimum".

AFTER (home.js `insuranceYear`, `INSURANCE_SHARE_CHEAP = 0.0255`). The floor is min($350, 2.55% of value). A $10,000 home: $255. From $13,700 the $350 stands. Rising in value throughout. HD-HOMEINS stays 0/3,364. Why 2.55% and not 1.61%: see Decisions.

## 6. tests/guess-sanity.test.mjs

- Every hard rule's test now reports a count below its KNOWN entry as a `t.diagnostic` line ("lower KNOWN[...] to n"), never a failure. A new test, "KNOWN: counts that fell are reported so the entry can be lowered", lists every entry below its count in one place, or "every KNOWN count is current". Checked by temporarily setting HD-ESCROW-ONCE to 10: the diagnostic printed and the suite passed.
- KNOWN changes: none. On the four persona households and fixtures that test runs, every count is equal to its entry (the new test printed "every KNOWN count is current" in the full run). No entry rose. HD-* entries stay absent (0).

## Other sweep movements (honest list, base to after)

Hard:
- HD-AMORT-IDENTITY 426 to 441 (249 to 255 households): retirees with a mortgage. Their escrow now follows the home value and the Social Security income. Owner: bought + leftover (lane 1's escrow work).
- HD-MORT-START 25 to 27 (13 to 14 households) and HD-HOME-BUY-AGE 12 to 13. g166 (California, 22, $94,000, typed payment $1,180): the home is now the $630,000 cell, not the $670,000 cap, so the loan behind the typed payment runs 394 months.
- pt.tax.partners-two-returns 413 to 415 (g2067, g2071: an unmarried retired partner who now has Social Security income).
- sr.verdict.loans-end 513 to 516 (g2292, g2319, g2460; now measurable).
- sr.saving.from-take-home 1,108/1,385 to 1,116/1,421, and SF-SAVING-ONE-FIGURE 1,379/1,385 to 1,387/1,421. These are 36 more households checked (retirees now have income). No new failure among the old ones.
- Fell: HD-DEBT-PAY-INCOME-MAX 360 to 329, pt.ss.spousal-floor 309 to 274, sr.verdict.monotone 3 to 2.

Soft:
- pt.withholding.default-follows-w4 1,504 to 1,540: Social Security has no withholding by default, so more retirees owe at tax time.
- sr.retire.like-you 34 to 39: retired couples at 62 whose guessed balance ($220,000) is now judged against a lower-income cell.
- Fell: HD-DEBT-PAY-INCOME 146 to 128, HD-MORT-START-AGE 93 to 91, HD-MORT-YEARS-LEFT 301 to 298, HD-MORT-LTV 44 to 43, HD-MORT-RATE-VINTAGE 928 to 927, pt.bought.payment-vs-pay 87 to 86. HD-HOME-YEARS-IN rose 59 to 60 (g166).

## Applying on main (79dd6ab, the wording sweep)

`git apply --3way` on 79dd6ab: 13 files apply cleanly. Three conflict, each only on a line next to one the wording sweep changed:
- docs/TEAM.md: two claim rows added at the same place. Keep both.
- modules/overview/guesses/estimators/spend.js: main's Medicare `put("insurance", ...)` line ("health insurance and medicine"), then this change's three lines after it (the comment and `if (floor > 0) { ... rows.insurance.fixed = fl; ... }`).
- modules/overview/setup/view.js: main's "Estimate it for me" line ("in today's dollars"), then this change's statement and getting blocks as they are.

The second after-sweep on the final tree ($S/ssg/after/sweep2/, after the last code edit) matches the first on every rule.

## Sources (each with its date)

- SSA, Annual Statistical Supplement 2026, Table 5.B9, "Number of retired-worker beneficiaries, percentage distribution by monthly benefit, and average monthly benefit, by age: By sex, December 2025": https://www.ssa.gov/policy/docs/statcomps/supplement/2026/5b.html#table5.b9. Already bundled (guesses/data/retire.js, read 2026-11-02). The page was read again 2026-11-07; the average row agrees: all $2,071.30; 62-64 $1,450.74; 65-69 $1,967.07; 70-74 $2,225.12; 75-79 $2,153.59; 80-84 $2,101.73; 85-89 $2,018.02; 90+ $1,897.00. December benefits carry the 2.8% raise for 2026, so they are what is paid through 2026.
- SSA, 2026 COLA fact sheet: https://www.ssa.gov/cola/factsheets/2026.html (the average retired worker $2,071 after the raise, the same as Table 5.B9's total; read 2026-11-07).
- Federal Reserve, Survey of Consumer Finances 2025: the summary extract (https://www.federalreserve.gov/econres/files/scfp2025excel.zip: RENT x 12 over INCOME among renters, weights WGT, by income fifth; INCCAT) and the full public data (x716 home value, x5729 income, the oldest adult's age from x14 and x19). Weighted medians and 95th percentiles per implicate, averaged. Computed 2026-11-07 ($S/ssg/scripts/rent2.py, homecells2.py, lowinc.py; outputs in $S/ssg/src/).
- Census, American Community Survey 2025, state median value of owner-occupied homes (already bundled in home.js).
- Census, American Housing Survey 2023 national PUF v1.1, household.csv (INSURAMT x 12 over MARKETVAL, TENURE 1, WEIGHT): https://www2.census.gov/programs-surveys/ahs/2023/AHS%202023%20National%20PUF%20v1.1%20CSV.zip. Computed 2026-11-07 ($S/ssg/scripts/ahsins2.py, $S/ssg/src/ahs-ins-by-value.txt).

## Decisions (also in modules/overview/guesses/README.md "Most likely, not the edge" and modules/overview/setup/README.md)

1. Social Security blank, "I already get it": the age average from Table 5.B9, not $0 and not an estimate from pay. Reasons: the person said it is paid; pay is often not on file once retired; and the average for retired workers that age is the most likely figure. Sex is used only when Longevity has it. The start age is full retirement age once past it, else today's age, so the worked-back full-age amount matches what the page shows.
2. "Statement" and "Not sure" blank: the "Estimate it for me" figure, with no Income line, because nobody said it is paid. It follows the existing `guide.setup.ssWrote` route, so no new ledger field is needed for it.
3. A full-age amount the person typed (on the Social Security page) wins over our paid guess. Without that rule Ruth (a typed $2,400 full-age amount) got our paid line beside it, and modules/retirement/social-security/module.test.mjs failed; it passes with the rule, and tests/guess-likely.test.mjs checks it.
4. From 70 the retired average is divided by the claim factor at 70, because the SS page values an unclaimed benefit at 70. One answer everywhere: Get started and the SS page now show the same $2,225.
5. Floor fit: needs first (rent, utilities, groceries), each group in one share, so rows move smoothly as pay moves. No floor where the household is already short. The SF-SPEND-CHILD-MONO trade-off is accepted and documented. The next step, if the owner wants the rule to hold, is to take the floor's cost from the family's own rows.
6. Rent: the 95th percentile as a ceiling, not the median in place of the model. The model carries the state and the household type, which the survey's national fifths do not. The top fifth's median (11.7%) would put g77 at $1,830, under California's median rent for all renters. Ceilings: 123%, 56.8%, 47.5%, 29.2%, 21.5% of income for fifths starting at $0, $35,946, $63,676, $102,703, $174,595. Each ceiling is held to the next fifths' share at their lowest income, so it never falls as income rises.
7. Home value: over the cap, the cell median at state prices. Under the floor, unchanged (no saw-tooth). Flat below the lowest group's middle, because SCF 2025 shows home values do not fall with income there ($173,000 under $10,000; $176,000 at $10,000-$15,000; $186,000 at $15,000-$20,000; all ages).
8. Insurance: the floor is min($350, 2.55% of value), not 1.61%. The AHS 2023 data contradict 1.61% for cheap homes. 1.61% is the 95th percentile over all owners, mostly in dear homes. Owners of homes under $30,000 pay a median 2.55% of the value (25th percentile 1.68%, 314 homes). On homes of $15,000 to $30,000 the median premium is $600 a year and 72% pay $350 or more. The rule HD-HOMEINS should judge homes under $30,000 against their own range (tester's file, listed below).
9. Medicare floor fixed, not scaled by k: a premium does not shrink with the envelope.

## Files (15 changed, 1 new)

- modules/overview/setup/compute.js: `averagePaidBenefit`, `SSA_BAND_MID`, `sexOf`, `ssPaidGuess`, `ssBlankGuess`; `averageRetiredBenefit` and `estimateSocialSecurity` take sex; `applyAges` writes and marks the paid guess, or drops it; `valuesFor` shows our guesses as blank boxes; `standing()` ss-estimate wording; estimators `overview/setup:ssPaid` (tier 4, order 2.5, new) and `overview/setup:ss` (reads ssPaid and works back from the line).
- modules/overview/setup/view.js (DESIGNER LANE; claim row added in docs/TEAM.md, dated 2026-11-07): the statement and getting boxes show `ssBlankGuess`'s gray placeholder, the "Our guess: ..." help line and an aria label. No layout change, no new CSS.
- modules/overview/guesses/compute.js: the label for an `overview/setup:ssPaid` row is the Income line's name.
- modules/overview/guesses/coverage.js: the SS statement row is now `guess:overview/setup:ss` (was "ask").
- modules/overview/guesses/data/cells.js: home cell medians and counts (`p50:<group>`, `n:<group>`); new table `scf2025_rent_to_income_by_income_fifth` (70 tables now).
- modules/overview/guesses/estimators/common.js: `incomeAt`, `HOME_GROUPS`, `homeCellValue`.
- modules/overview/guesses/estimators/home.js: the cell over the cap; `INSURANCE_SHARE_CHEAP`, `INSURANCE_FLOOR`, `insuranceYear`; `statePriceLevel`.
- modules/overview/guesses/estimators/spend.js: `fitFloor`, `savingOutOfPay`, `payrollOf`, `rentCap` (exported), the `{ floor }` option, and the fixed Medicare floor.
- modules/overview/guesses/README.md, modules/overview/setup/README.md: formulas, sources and the decisions above.
- docs/DATA_MODEL.md: the `overview/setup:ssPaid` ledger key (optional; no version bump).
- docs/TEAM.md: the claude-b claim row for setup/view.js.
- modules/overview/guesses/module.test.mjs, tests/guess-sanity-fixes.test.mjs, tests/guess-sanity.test.mjs: updated. tests/guess-likely.test.mjs: new.
- Not touched: modules/registry.js, tests/golden/**, claude-a's lane, CHANGELOG.md.

## Tests

- tests/guess-likely.test.mjs (new, 13 tests, failing first). At c804ed0, 12 of 13 fail; the 13th (a retiree's Medicare floor) passes there only because base writes no Social Security line. They cover:
  - Social Security at 63, 66 and 72 for each blank answer.
  - Table 5.B9 bands and the sex rows, with ssBlankGuess's texts.
  - A couple.
  - A typed answer winning (including a full-age amount typed on the SS page), going through the screen again, and the gray figure.
  - Switching answers; under 62; outside the U.S.
  - The later list's label.
  - The value at 70.
  - The Medicare floor.
  - The floor fit on g74 and the settle fixed point.
  - Room to spare.
  - Rent on g77, with rentCap rising with income.
  - Home value: Ohio 30 at $12,000 about $80,000; g3; homeCellValue rising; flat below the first middle.
  - Insurance: Mississippi $10,000 gives $255, $15,000 gives $350, rising.
- modules/overview/guesses/module.test.mjs: 70 tables, the ssPaid key and its paths, and a new PLANS case "retired, Social Security left blank".
- tests/guess-sanity-fixes.test.mjs: the SS case checks the amount shown (claim factor), `averageRetiredBenefit(72, 1954) === Math.round(2225.12 / 1.32)`.
- Whole suite (the files `npm test` runs, through `node --test` with the spec reporter writing to a file, because `npm test`'s TAP stream ran past the 30-minute limit on this loaded machine; load average 14 to 18 on 4 cores, with other agents' suites running): 189,044 tests, 188,410 pass, 629 todo, 3 skipped, 2 fail. The 2 failures are timing limits only: tests/estimate-perf.test.mjs "settle: the largest qa plan... under 600 ms" (4,349 ms) and modules/transactions/ledger "three years of daily lines... well under 1.5 s" (2,005 ms). Both pass when run again on their own (37 of 37 in the two files; the ledger render took 926 ms). The files this change touches, run again after the last edit (guess-likely, guess-sanity-fixes, overview/guesses, overview/setup, retirement/social-security): 295 of 295 pass. tests/guess-sanity.test.mjs printed "every KNOWN count is current".

## Checks

- `npm run registry`: 161 module(s); modules/registry.js unchanged.
- `npm run check`: "guess coverage: 61 of 191 unknown inputs handled (130 later)", "guess estimators: 40 from 2 module(s)", "check: OK".
- `node tools/leak-guard.mjs --worktree`: "leak-guard: OK, 2853 files (worktree)".

## Shots (390 x 844, isMobile, deviceScaleFactor 2, ?sandbox=1; every PNG read)

Kept in <scratch>/ssg/shots/. All 12 taken are in $S/ssg/shots-all/; plans from `probes/mkplans.mjs` in $S/ssg/plans/.
- ages-getting.png, ages-getting-dark.png: question 3 for a retired 72-year-old renter in Ohio on "I already get it", left blank. The box shows $2,225 in gray with "Our guess: what retired workers your age get on average".
- ages-statement-dark.png: a retired couple (70 and 64, Texas, owners) on "I have my statement figure", left blank. Each box shows its gray figure and "Our guess: worked back from the $... retired workers ... age get on average".
- guesses-getting.png: Our guesses for you, for the same person: the Social Security line is listed as our guess, with its source.
- expenses-rent.png: the California couple of 20 with a baby, renting. Rent is held under the top fifth's ceiling.
- networth-home.png: the Ohio owner of 30 on $12,000. The home is $80,000.

## For claude-a's pages (not edited; their lane)

- cashflow/statement and balance/statement: show "Your Social Security" (Income line `setup-ss-<personId>`) as our guess while `plan.guesses["income[setup-ss-<id>].amount"].k === "overview/setup:ssPaid"`, as other pages do for a guessed figure.
- taxes/state: check that a "social" type Income line stays untaxed in states that exempt Social Security. More retirees now have one.
- taxes/filing-status: g2067 and g2071 (an unmarried retired partner with Social Security) now fail pt.tax.partners-two-returns. The partner's return should be worked out on its own.
- taxes/documents: list the SSA-1099 when a "social" Income line exists.
- goals/emergency-fund: count Social Security as steady income for a retiree's months of spending.
- balance/projection: check that the guessed Social Security line is counted once, beside retirement/projection's own benefit.

## Follow-ups (not done here)

- retirement/social-security: read a typed "social" Income line as the benefit already paid when there is no record. 9 qa fixtures show $0 there today; this predates the change. Also say on the page that its $2,225 is our guess while the ledger marks it.
- "on our pay guess" wording appears for retirees on a few pages; it should say "on the average for retired workers your age".
- `account.retire.balance` could read Social Security income for retirees (sr.retire.like-you +5).
- The spousal benefit for a non-working partner of 62 or more (the 13 grid households left, pt.ss.spousal-floor).
- HD-HOMEINS (tester's file, qa/guess-sanity-rules.json): judge homes under $30,000 against AHS's own range (median 2.55%) instead of 1.61%.
- SF-SPEND-CHILD-MONO: take the floor's cost from the family's own rows, if the owner wants the rule to hold where the fit trims rent.
