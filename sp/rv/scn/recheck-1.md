# Track scn, recheck 1 (skeptic, 2026-11-12)

Checked: `rv/b-scn` at **972b0b3** (one commit, L1 with fix round 1 folded in, on 7297bfb). Read-only: nothing in b-scn or in
the main repository was changed. I served my own copy (`rv/v-scn-re1`, same sha) on ports 9771 to 9778; every server was stopped
(curl on 9771-9779 answers nothing) and the worktree is removed.
Scripts, logs and pictures of this recheck: `$SP/rv/scn/re1/`
(c*.mjs by code, sw.mjs my own sweep, w*.mjs on the phone, `shots/` 66 pictures). All phone work was in the sandbox, Chromium with an
iPhone user agent, 390 px and 320 px, light and dark.

## Verdict in one paragraph
15 of the 18 findings are closed and I could not reopen them, by code or on the phone. Two stay open and are not this lane's
files: P6 (the menu search still types backwards, core/app.js) and the engine half of M5 (the run is still not monotone in the
retirement age, projection/compute.js); Goal seek's own half of M5 is closed. M2 is closed on What matters most; its last
sentence (Retirement contributions still calls another match "common") was written for L3 and is still on screen. The whole
`npm test` passes. Looking at the same screens I found one thing the M1 fix left behind on a neighbour page (the Plan health
score still says $670, Goal seek now says $790) and a few small things, listed at the end.

## Each finding, tried again as its steps say

| id | sev | verdict | what I did and saw |
|---|---|---|---|
| M1 | 5 | **closed** | Casey by code (`c1.txt`): card "Put about $790 a month into Casey's plan at work ..."; $670 and $780 typed into that 401(k) still run out (2070, 2075), $790 lasts and the card then reads "just right". My own sweep of 1,423 qa plans on today's date (`sw.mjs`, limits typed from Notice 2025-67, "lasts" = project() on the plan as the Contributions form leaves it): 754 such cards, 0 still short when typed as said, 0 above the 401(k) limit for the owner's age, 0 that ask $10 more than needed, 0 that name an old-job 401(k), 0 whose words lack an amount. Also true for "Leave $250,000", "Room for bad luck" and both together (then "$2,040 ..., the most allowed in 2026, and $70 more into other savings": typed, it gets there). 13-in-crisis names no account. |
| P2 | 5 | **closed** | On the phone (`w1.txt`): Goal seek -> "Retirement contributions ›" -> "Edit ›" -> 790 in "Your own money" -> "Save changes" ("Contribution saved.") -> Back. Stored row {amount 790, monthly, match 0}. Goal seek: "Your plan works if markets are average ... lasts and leaves about $2,000"; saving card "just right ... Exactly what goes in now, $790 a month."; Will the money last?: "Lasts in about 4 of 10 pretend futures" (no longer "Runs out"). Pictures `shots/w1_casey_*`. |
| M5 | 4 | **Goal seek's half closed; the engine's half open (claude-c's file)** | `c2.txt`: with $670 a month the engine still says 61 lasts, 62 to 65 run out (2048, 2055, 2062, 2070), 66 lasts; with $790: 60 and 61 last, 62 to 64 run out. Goal seek no longer shows it: $670 -> "needs a change ... at 66: 1 year later than the plan's 65"; $790 -> "just right ... at 65 as planned". Sweep: 0 retirement cards "room to spare" on a short plan; 0 "as early as N" with a later age that fails. Financial independence gives the same age (same function). Where a person can still see the engine's jump: What matters most, Dana & Lee, row "When Dana retires": "age 67: $5,460" and "age 63: $6,620" against the plan's $5,280 (retiring two years earlier "pays" $1,340 a month more; by code 61 to 64 pay $6,440 to $6,720, 65 pays $5,280; `c8.txt`, `shots/w3_dana_sensitivity_320.png`). 5 of 1,217 qa plans with that row show the same. |
| M2 | 3 | **closed on this page; one sentence left for L3** | Row: "nothing: $2,340" to "$400 a month + $240 match: $2,950"; line "Nothing goes in now. The high end: what people with pay like Casey's usually put in, plus the match most jobs add (Casey's job may differ). Still short of the $3,090 a month the plan spends."; behind "More about this": "Casey: 6.6% of pay, about $400 a month. The usual match: about $240 a month; HR can tell you the real one. With Casey's own money alone, the plan could pay about $2,720 a month." By hand (`c4.txt`): 6.6% x $72,000 = $396 a month; match 4% x pay = $240 a month; typed on the form: $2,945 with the match, $2,715 without. Still on screen next door (Retirement contributions, `contributions/view.js:172, 207`): "A common match, 50% of what you put in up to 6% of pay" ($2,160 a year for Casey) against this page's $2,880. The finding's own fix put that in L3. |
| M3 | 2 | **closed** | 12-high-net-worth: Henry's $33,120 goes into a row with no account, nothing into the Roth; Victoria's 401(k) row $20,592 (limit $32,500 at 52), match $10,560. Sweep: 0 usual rows above the 401(k) or IRA limit, 0 Roth IRA rows above the income range, 0 rows into a missing account; own money and match equal share x pay and 4% x min(1, share/6%) x pay on every plan; the high end equals those rows typed and run through buildInputs. |
| M4 | 2 | **closed** | Robin: "... grow about 6.0% a year, against the 5.8% a year we use. Forecasts for a mix like the plan's: about 4.9%-6.5% a year (Vanguard)." Mix 60%: 0.6 x 4.8 + 0.4 x 5.1 = 4.92, 0.6 x 6.8 + 0.4 x 6.1 = 6.52. "Most forecasts ... are lower" starts at a need shown as 6.6% (6.5% does not switch). Sweep: the switch agrees with the two printed figures on every plan. The fold gives both ranges and the date. |
| P1 | 4 | **closed** | On the phone (`w2.txt`, `w2b.txt`). Jamie: pill "not on its own", "... would run out in 2050 (age 68) instead of 2052 (age 70)"; after saving 69 on Social Security, Will the money last? says "Runs out in 2050 ... (age 68)": what the card said beforehand. Robin: "needs a change", "claiming at 70 alone makes the money last"; after saving 70: "It lasts in most cases, not all", Goal seek "Your plan works if markets are average". Morgan: "not on its own", "would still run out in 2049 (age 65)"; after saving 66: "Runs out in 2049 (age 65)". Dana & Lee keep "room to spare". Fuzz by code (`c3.txt`: 8 households x spending x claim age x goal x bad luck, 576 cards): 0 pills that disagree with the plan after doing it, 0 wrong years in the words. |
| P3 | 3 | **closed** | The row is in dollars and reads as sentences (above), at 390 and 320 dark (`shots/w3_casey_sensitivity_*.png`). Goal seek and this page both speak in dollars a month. The third figure of the finding is still there on a page outside this lane: see N2. |
| P4 | 3 | **closed** | No "you assume", no "percentage points", no "shown as the blend on your mix". "we use" for untouched defaults and after a stale review; "your own figures give" after a typed 8% or a review within the year (`c4.txt`). The builder kept the mix-against-mix comparison (M4) rather than P4's stocks-against-stocks; like with like, so I count it closed. |
| P5 | 2 | **closed** | Title "What matters most": whole at 390, 375 and 360 px (box 207 / 192 / 177, needs 158). At 320 it is cut only in the sandbox (box 137); with the Sandbox pill taken out the box is 242 px (`w6.txt`). Old names still find it when pasted. |
| P6 | 3 | **open, not this lane (core/app.js, wave 1)** | Jamie, 390: typing m, a, t, t, e, r, s gives "m", "am", "tam", "ttam", "ettam", "rettam", "srettam", caret at 0 after each key; "No page matches "srettam"". Pasted, all four names list What matters most (`w4.txt`, `shots/w4_search_typed.png`). |
| P7 | 2 | **closed** (see N3 for Back) | One outlined "What matters most? ›" under the grey line, one line at 320 dark, 161 x 44 px; the tap opens the page; "What it would take ›" leads back (`w4.txt`, `shots/w4_link_320_dark.png`). |
| B1 | 4 | **closed** | 01: "If Maya put in 6.0% of pay (about $320 a month) plus the usual match, as people with pay like Maya's usually do, the plan could pay about $1,390 a month more."; 04 names both shares and dollars; 10 the same shape; 390 and 320 dark. Sweep: 0 headlines with "nothing instead of nothing", "by $0", "the usual share", "X instead of X", "less". |
| B2 | 3 | **closed** | Retired couple and 08-retired, 390 and 320 dark: "Your plan does not depend on how investments grow: it gets there even if they lost money every year." Sweep: 0 lines with a negative figure. |
| B3 | 3 | **closed** | Jamie with a $20,000 legacy, 390 and 320 dark: spending, retire, saving, short today, Social Security; no return. Sweep: 0 Legacy lists with the return. |
| B4 | 3 | **closed** | Empty 401(k): "We don't know yet. Nothing is saved for retirement yet, and nothing goes in, ..." and the grey "If Casey put in 6.6% of pay (about $400 a month) plus the usual match, the plan could pay about $2,690 a month of the $3,090 it plans."; the same row typed on the form gives $2,689. One filled "Add what you own ›". Sam keeps "You haven't told us ...". Goal seek uses the same words. Sweep: the two pages gate the same 20 plans. |
| B5 | 2 | **closed in this lane** | Born 2080 and born 2018: `usualSaving` returns [], no saving row. The projection still takes the future date (the page then reads "Inflation: 2.0% instead of 3.0% raises it by $9,830 a month"): claude-c's, as the finding said. |

## Regressions looked for
- **Whole `npm test`** on my copy: 189,422 tests, 188,782 pass, **0 fail**, 3 skipped, 637 todo, exit 0 (188 s; neither speed test
  flaked; `re1/npm-test.txt`). The 15 tests of this track are in it and pass. `git status` after it: clean (registry unchanged).
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (2,879 files); `--commits 7297bfb..HEAD`: OK (14 files).
- The commit touches 14 files, all in goal-seek, sensitivity, estate/legacy and the catalog row; none of the forbidden files.
- My sweep (1,423 plans, today 2026-11-12): 0 throws in Goal seek, What matters most or Legacy goals, the plan never changed, no
  status outside the four pills, no NaN / undefined / null in any sentence.
- 38 screens (`w3.txt`): no sideways scroll, no page or console error, no control under 44 px, no bar labels touching, none of
  the words build, PC, AI, sync, server. Folds: each opens, the plan is byte-identical after opening all of them and switching
  the measure. "Check the figures we use ›" lands on the stock-growth box.
- After the rebase: claude-c's left-over row is not written by any page yet; when L4 writes one next to an idle 401(k), Goal
  seek's card goes back to "About $670 a month, $370 more than the $300 going in now" with no account named, and the $370 typed
  into the 401(k) runs out in 2072 while added to the left-over row it lasts (`c7.txt`). Not a defect today; a test for L4.

## Still open or new (the structured list)
1. **M5 (engine half), sev 3, claude-c.** As above. Until the engine is fixed, What matters most can show retiring earlier as
   paying more (Dana & Lee).
2. **P6, sev 3, wave 1.** As above.
3. **N2, sev 3, new, claude-f's page.** Casey's Plan health score says "To make the money last: save about $670 a month more or
   spend about $760 a month less. Open the Goal seek page to see the amounts that just make each last." "Open Goal seek" then
   shows "$790 a month ... into Casey's plan at work". $670 typed into that 401(k), the only row on Retirement contributions,
   still runs out in 2070 (`w5.txt`, `shots/w5_casey_score_hint_390.png`, `shots/w5_casey_goal-seek_after_score_390.png`). It
   is the old M1 path through another door; the builder left `savingInto` at "taxable" for the score so its pinned test holds.
4. **M2's last sentence, sev 2, L3.** Two pages, two "usual" matches ($2,160 and $2,880 a year for Casey).
5. **N1, sev 2, new, this lane.** What matters most still lists numbers that move nothing as the ones that matter most. qa
   01-single-adult/base and 10-student/base: row 1 is the saving row, rows 2 to 5 read "6.0%: $0 / 8.0%: $0" and so on, then
   "3 more numbers - they move it less"; under "What is left at the end" every bar is $0. 176 plans have only the saving row
   moving; 567 of 1,364 show at least one dead row in the first five; on 131 the headline itself is false: "How much stocks
   earn moves your plan the most" over a $0 bar (`c6.txt`, `w5.txt`, `shots/w3_01-single-adult_sensitivity_320_dark.png`,
   `shots/w5_zeroTop_sensitivity_390.png`).
6. **N3, sev 2, shell (wave 1).** Back after "What matters most? ›" returns to Goal seek, but in 5 of 10 tries at the top of the
   page instead of where the person was (`w8.txt`); Back from Retirement contributions the same. Goal seek draws after a wait,
   so the place is lost. Not from L1's files.
7. **N4, sev 2, pre-existing, this lane's view.** At 320 px every Goal seek card title sits in a 52 to 62 px column next to its
   pill: "What / you / need / to / save" on five lines (`w7.txt`, `shots/w3_04-two-parents_goal-seek_320.png`). Same CSS at 7297bfb.
8. **N5, sev 1, this lane.** All pages still describes Goal seek as "see what each lever would have to be: ... what to save, the
   return it needs, when to claim Social Security" (module.js `purpose` and the catalog row).
9. **N6, sev 1, this lane.** "More about this" folds itself when the measure chip is tapped; "5 more numbers" stays open.
10. **N7, sev 1, process.** The commit has four trailer lines (a second Co-Authored-By) where the workflow asked for exactly three.

## Messages that still need posting (the builder may not edit WORKBOARD)
claude-c: M5's engine half and a birth date in the future (B5). wave 1: P6 and N3. claude-f: N2. They are in fix-1.md section 6
(N2 and N3 are new here).

## To try on a real iPhone (only Chromium here)
- The three kinds of fold on What matters most ("More about this", "N more numbers", "How to read this"): open and close
  without the page jumping; the chevron turns.
- The bar labels of the saving row at 320 px ("nothing: $2,340" and "$400 a month + $240 match: $2,950"): about 8 px tall there.
- Back after "What matters most? ›" (N3) and the menu search typed key by key (P6): Safari may behave differently.
- The top bar's title at 320 px without the Sandbox pill.
- Goal seek's grey line and the red "not on its own" pill in dark mode.
