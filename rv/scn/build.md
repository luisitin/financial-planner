# Track scn, builder claude-b: build log

Worktree: $SP/rv/b-scn (detached, base fa2026e).
Ports used: 9701 (look.mjs), 9702 (look2.mjs); both servers stopped by the kit's `srv.stop()` (own child pid only).
Scripts (scratch): rv/scn/probe.mjs (compute on the households), rv/scn/casey-try.mjs, rv/scn/look.mjs and look2.mjs (phone),
rv/scn/sweep.mjs (every qa fixture and household). Outputs: rv/scn/probe-before.txt, probe-after.txt, npm-test-full.txt, shots/.

## L1: Goal seek and Sensitivity stop treating a higher return as a fix

### Files
- modules/scenarios/goal-seek/compute.js: the return lever keeps its search and stays in `levers` (the Plan health score's test,
  claude-f's lane, asserts the six ids; Legacy goals lists the levers) with `info: true`, a standalone `sentence` and Goal seek's
  `line`; new exports `RETURN_FORECAST` (Vanguard VCMM 10-year U.S. equities 4.8%-6.8%, as of 2026-09-30, confirmed in
  verify-web), `returnWords`, `idleWorkPlans`; the claim lever's status `helps` when another age spends more while the plan
  falls short (`room` only while it reaches the goal); the saving lever names an idle 401(k) (`idle` ids).
- modules/scenarios/goal-seek/view.js: cards are the non-info levers (5); the info lever is one `p.muted.small.gs-info` under the
  grid, no button; `PILL.helps = ["", "helps"]` (no colour); GO_WORDS loses `returns`; the not-ready lede no longer lists "the
  return it needs" as a change; the fold names the forecast's source; scoped `.gs-root .gs-info { margin-top: 16px }`.
- modules/scenarios/sensitivity/compute.js: the gate (`noSavings`, the projection's `savingsUnknown`, run only when no invested
  balance and no contribution); `usualSaving(plan, today)` and the saving row when nothing goes in (high end = usualShare x job
  pay, capped at the 401(k) limit at work, plus the usual match at work unless "no match"; into the 401(k), else IRA/Roth IRA,
  else taxable; built as a contribution row on a plan copy through `buildInputs`, so said = done).
- modules/scenarios/sensitivity/view.js: "We don't know yet" hero with one filled "Add what you own ›"; not-ready h1 "What
  changes your answer".
- modules/scenarios/sensitivity/module.js: title "What changes your answer"; `aliases` ["sensitivity", "what matters most",
  "which numbers matter most", "tornado chart"].
- docs/MODULE_CATALOG.md: the sensitivity row's title only.
- READMEs of both modules: an "Owner's request 2026-11-11 (L1)" section each, with formulas, sources, the decisions followed
  (D-A4, D-A5, D-A7 quoted) and what was seen but not changed; output lines updated.
- module.test.mjs of both: 3 + 4 new tests; goal seek "D4" updated to the new words.

### Numbers (rv/scn/probe-after.txt, today 2026-11-11, phone-built households)
- Jamie: grey line "For the plan to work as it is, investments would have to grow about 10.4% a year on your mix of stocks and
  bonds, against the 5.8% you assume. Most forecasts for the next 10 years are lower (U.S. stocks 4.8%-6.8% a year, Vanguard, as
  of September 30, 2026). That isn't a choice you can make; the cards above are." Claim card "helps" (69).
- Casey: saving card "Save about $670 a month. Casey's plan at work holds $48,000, but nothing goes into it now (you said so). If
  some of each paycheck does go in, add it on Retirement contributions." Sensitivity saving row: nothing $2,336 -> 6.6% of pay
  (with the usual 4% match) $2,945 a month; rank 3 of 10. Return line 11.2%.
- Morgan: claim card "helps" (66); Sensitivity saving row nothing $751 -> 5.4% of pay into the IRA, no match, $2,047.
- Robin: return line 6.0% "Forecasts for the next 10 years: U.S. stocks 4.8%-6.8% a year (Vanguard, ...)" (not "lower": inside
  the range); claim "helps" (70).
- Dana & Lee, family: on track; claim "room to spare" as before; return line with "room for bad luck" and the forecasts.
- Sam, renterDebt: Sensitivity gated ("We don't know yet"), as Goal seek and Will the money last? are.
- Every other row and figure is unchanged (probe-before vs probe-after: only the return words, the claim status on short plans,
  Casey's saving words and the new saving rows differ).

### Tests and their output
- `node --test modules/scenarios/goal-seek/module.test.mjs modules/scenarios/sensitivity/module.test.mjs
  modules/overview/health-score/module.test.mjs tests/wording.test.mjs tests/wording-verify.test.mjs tests/wording-left.test.mjs
  tests/pages-followup-b.test.mjs tests/followups-fix1.test.mjs modules/estate/legacy/module.test.mjs
  modules/retirement/fire/module.test.mjs`: pass 149, fail 0 (12 "todo" lines are claude-a's wording slips, pre-existing).
- goal seek alone: pass 23, fail 0; sensitivity alone: pass 12, fail 0.
- `npm run registry`: 161 modules (registry.js unchanged). `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (no
  private scrub list on this machine: generic rules only).
- Whole `npm test` (on the final code, before the commit): tests 189,269, pass 188,627, fail 0, skipped 3, todo 639
  (698 s; rv/scn/npm-test-full.txt). The two speed tests did not flake.
- Crash sweep (rv/scn/sweep.mjs, today 2026-11-11, all 1,414 plans: every qa/fixtures *Plan builder and every qa/households
  variation, plus the empty plan; rv/scn/sweep2.txt): no throw, no NaN/undefined in any figure or sentence, the plan never
  changed (frozen JSON compared), the return lever always `info`. 18 plans gated, 1,156 get the "nothing goes in" saving row,
  971 saving cards name an idle 401(k), 2 claim cards read "helps". 127 plans that have some savings still show every row at $0
  both ends (they can pay nothing at any nudge: in-crisis, all pay ended, retiring today...): the floor effect the gate does not
  cover; left as the README's "Not done here" (switching the measure is the review's idea, not this commit).

### What I saw on the phone (kit, sandbox, Chromium with an iPhone user agent)
Shots in rv/scn/shots/: {jamie,casey,morgan,robin,dana,sam}_{goal-seek,sensitivity}_{390,390_dark,320}.png (full page; Read
through the part_*.png crops) and jamie_gs_line_{390,320}{,_dark}.png (the grey line in view). report.json has the census.
- No horizontal scroll on any of the 36 shots; no page errors; no control under 44 px on the page (census "bad" empty).
- Goal seek: five cards, then the grey line inside the same card, 16 px under the last card; 13 px text, contrast 4.83:1 (light,
  #6b7280 on white) and 5.52:1 (dark); 9 lines at 320 px. No Assumptions button anywhere. The claim pill "helps" is grey in
  light and dark (morgan_goal-seek_390_dark). Casey's saving card names "Casey's plan at work" and its $48,000.
- Sensitivity: Sam's page is the hero alone, "We don't know yet", one filled "Add what you own ›" (390 and 320, light and dark).
  Casey's list has "How much you save, now nothing" with one green bar "6.6% of pay: $2,950" (casey_sensitivity_320 part 1).
- The top bar truncates the new title at 390 ("What changes your an...") and 320 ("What changes..."): the shell's own ellipsis
  (wave 1's file, not this lane); the page's own heading says it in full when there is no verdict to lead with.
- The kit lists the goal chips and the measure chips as "filled" (it counts any non-transparent background); they are chips, as
  before; the only filled button is "Add what you own ›" where the gate shows.

### Deviations from the spec, and why
- The return lever stays in `levers` (with `info: true`) instead of leaving the list: claude-f's health-score test asserts the six
  lever ids, and Legacy goals reads the list. Its `sentence` changed too, so Legacy goals' list (estate/legacy/view.js, not my
  file) now reads "... That isn't a choice you can make." instead of "About 10.4% a year on your mix, 4.6 points more ...".
- The date is "as of September 30, 2026" on screen (the spec drafted "as of 2026-09-30"): plain words for the phone.
- "Most forecasts ... are lower" only when the shown need is above 6.8%; otherwise the range is quoted neutrally ("Forecasts for
  the next 10 years: ..."), so the sentence is never false (Robin needs 6.0%, inside the range).
- Sensitivity's high end includes the usual match at a plan at work (the spec's row says "high end = usualShare"): D-A5 makes
  saving and match one alternative when nothing goes in, the row's own line says "employer money included", and L2's work row
  will be the same figure. The line under the row says so ("plus the match most jobs add").
- The gate is the projection's `savingsUnknown` only; the review's other idea (switch the measure when the plan can pay under
  10% of what it plans) is not built (README "Not done here").

### Seen, not changed (other lanes or later commits)
- Legacy goals (estate/legacy/view.js) lists every lever not "same", the return among them; it could leave out `info` levers.
- Goal seek's "Save about $670" still models the extra going into taxable savings, while the words point at the 401(k); the
  engine taxes 401(k) money on the way out and does not model the tax it saves at work (spec C, engine bias). L2 runs the 401(k)
  row itself.
- Nothing links to "What changes your answer" yet (L2's Go deeper card).

### Try on a real iPhone (no WebKit here)
- Goal seek at 320/390: the grey line's wrapping and contrast in Safari; that the claim pill "helps" sits on the title's line.
- What changes your answer: the top bar's ellipsis on the long title; the "We don't know yet" hero with Sam; the SVG bar labels
  "nothing: $2,340" and "6.6% of pay: $2,950" do not collide at 320 px (they scale with the bar).
- Nothing new depends on newer JavaScript (no `requestIdleCallback`, `Promise.withResolvers`, `Array.fromAsync`, Set methods).

### Commit
- d540ebb "Goal seek and Sensitivity stop treating a higher return as a fix" (one local commit on fa2026e; message in rv/scn/L1.msg; CHANGELOG line in rv/scn/L1.changelog). Leak guard on the commit and its message: OK. The repo pre-commit hook was skipped by git (not executable in this checkout); the leak guard was run by hand on the staged files first.
