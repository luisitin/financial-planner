# Track scn, fix round 1 (builder claude-b, 2026-11-12)

Worktree: $SP/rv/b-scn (detached HEAD).
Before this round: 4bc50d5 (L1 on 7297bfb, with the interrupted fix round already folded in by the rebase job, see rebase.md).
After: **972b0b3** (L1 on 7297bfb). Still one commit; `git log 7297bfb..HEAD` lists only it. Nothing pushed.
Scripts, outputs and screenshots of this round: $SP/rv/scn/fix1r/
(all paths below are under $SP/).

## 1. What this round did, in short
- Reproduced all 18 findings on the rebased build by code (`rv/scn/fix1r/repro.mjs`, output `repro-4bc50d5.txt`) and on the
  phone. 15 were already gone at 4bc50d5 (the folded fix round holds on the new base). One was half gone (M5: Goal seek's half
  fixed, the engine's half still there, claude-c's file). One is still there and is not this lane's (P6, core/app.js).
  One open item from the critics that was not in the list (P8, severity 1) is fixed here.
- No finding judged wrong. Two places where the fix does not use a critic's exact words are explained in section 4.
- New in this round, from the owner's request relayed with this run ("Default to less is more and allow more complexity or
  toggles. We want subtle optional complexity") and the design rule it became (docs/DESIGN_LOG.md 2026-11-12, in the main
  repository): the fixes had made the first view long (the grey line ran 9 lines at 390 px, the saving card 6, the saving
  row's note 7, and What matters most listed 10 or 11 rows). They are now simple first, with the detail one quiet tap away.
  No figure, status or amount changed: `repro-final.txt` differs from `repro-4bc50d5.txt` only in sentences.

## 2. Each finding
"Gone" means it does not reproduce on the rebased build; the test named pins it.

| id | sev | on the rebased build (4bc50d5) | now (972b0b3) | evidence |
|---|---|---|---|---|
| M1 | 5 | Gone. Casey's card: $790 into the 401(k); $670 typed there fails in 2070, $790 lasts. "Derek's old 401(k)" is not named. | Same figure. Words shorter (section 3). New in-repo test over every qa base household with such a card: the amounts typed as rows reach the goal, none above the year's 401(k) limit. | `repro-final.txt` "M1/P2"; sweep of 1,423 qa plans on the final code (`fix1r/sweep-{0..3}.json`): 754 such cards, 0 still short when typed as said, 0 above the limit (571 at the limit, 410 with a rest into other savings); tests "fix round 1 (M1/P2) ..." and "fix round 1 (M1): on every qa base household ..." |
| P2 | 5 | Gone (the same place as M1). | Walked on the phone: Goal seek "Put about $790 a month into Casey's plan at work ..." -> "Retirement contributions ›" -> "Edit ›" -> 790 in "Your own money" -> Save ("Contribution saved.") -> Back. Hero: "Your plan works if markets are average ... lasts and leaves about $2,000"; saving card "just right ... Exactly what goes in now, $790 a month."; retirement card "just right, age 65". | `fix1r/walk-said.log`; `fix1r/shots/said_casey_typed.png`, `said_casey_after_top.png`, `said_casey_after_saving.png`, `said_casey_projection.png` |
| M5 | 4 | Goal seek's half gone: with $670 in the 401(k) the card reads "needs a change ... at 66: 1 year later than the plan's 65", never "room" while short; with $790 it reads "at 65 as planned: not a year earlier" (60 and 61 last, 62 to 64 run out). The engine's half is **still there** at 7297bfb: Casey with $670 a month: retiring at 61 lasts, at 62 to 65 runs out (2048, 2055, 2062, 2070), at 66 lasts. claude-c's cb820f2 did not change it. | Unchanged (not this lane's file). Message for claude-c in section 6. | `repro-final.txt` "M5" (the engine by retirement age, 58 to 68, at $0, $670, $790); tests "fix round 1 (M5) ..." (two) |
| M2 | 3 | Gone. High end "$400 a month + $240 match: $2,950"; own money alone $2,720; "still short of the $3,090". | The line is now short and the amounts sit behind the row's "More about this" (section 3). Contributions' "common match" words are L3's (section 6). | `repro-final.txt` "M2/P3"; `fix1r/shots/folds_casey_390_about_open.png`; test "L1: nothing going in ..." |
| M3 | 2 | Gone. Henry (12-high-net-worth): $33,120 goes into a row with no account, nothing into the Roth; Victoria's 401(k) row $20,592, under $32,500. | Same. | `repro-final.txt` "M3"; sweep: 0 usual-saving rows over a limit, 0 Roth rows above the income range; test "L1 + fix round 1 (M3, B5) ..." |
| M4 | 2 | Gone. The need on the mix is set against the forecast on the same mix (4.9%-6.5% on 60% stocks); "Most forecasts ... are lower" above the blended top. | Same comparison, shorter line (section 3). | `repro-final.txt` "M4/P4/B2"; test "L1: the return it needs ..." (the edge at 6.5% / 6.6%) |
| P1 | 4 | Gone. Jamie "not on its own": "... would run out in 2050 (age 68) instead of 2052 (age 70)"; after saving 69 the engine fails in 2050. Robin "needs a change": "claiming at 70 alone makes the money last"; after saving 70 the plan lasts. Morgan "not on its own": "would still run out in 2049 (age 65)". Dana & Lee keep "room to spare". | Same. | `repro-final.txt` "P1"; `fix1r/shots/jamie_goal-seek_320_claim.png`, `robin_goal-seek_390_dark_claim.png`; sweep: 0 cards whose status disagrees with the plan after doing it; test "fix round 1 (P1) ..." |
| P3 | 3 | Gone. The row is in dollars and its line parses. | Shorter line plus "More about this" (section 3). Goal seek and this page now both speak in dollars a month. | `fix1r/shots/folds_casey_390_rest_open.png`, `folds_casey_320_dark_about_open.png` |
| P4 | 3 | Gone. No "you assume": "our usual figures unless you change them", and "you chose" only when typed or reviewed on Assumptions. No "percentage points". | Whose figure it is stays in the line in three words ("we use" / "your own figures give"); what it is made of is in the fold (section 3). | test "L1: the return it needs ..." (reviewed and typed cases) |
| P5 | 2 | Gone. Title "What matters most", whole at 390 px; old names are aliases. | Same. At 320 px in the sandbox the top bar shows "What matters ..." because of the Sandbox pill (the shell's; to try on the real phone, section 7). | `fix1r/shots/casey_sensitivity_390.png`; test "L1 + fix round 1 (P5) ..." |
| P6 | 3 | **Still there**, and not L1's: core/app.js:76 is unchanged at 7297bfb (and at the main repository's tip). Typing "matters" key by key reads "m", "am", "tam", "ttam", "ettam", "rettam", "srettam" and finds nothing. Pasted, "what matters most", "sensitivity", "what changes your answer" and "tornado chart" all find What matters most. | Not fixed here: core/app.js is wave 1's file. Message in section 6. | `fix1r/walk-search.log`; `fix1r/shots/search_typing.png` |
| P7 | 2 | Gone. One outlined link under the grey line. | Renamed "What matters most? ›" (the name of the page it opens; "Which of your numbers matter most? ›" took two lines at 320 px). Tap opens the page, Back returns to Goal seek. | `fix1r/walk-final.log`; `fix1r/shots/final_casey_goal-seek_320_dark_tail.png` |
| B1 | 4 | Gone. 01-single-adult: "If Maya put in 6.0% of pay (about $320 a month) plus the usual match, ... about $1,390 a month more."; 04-two-parents names both shares. | Same. | `repro-final.txt` "B1"; sweep: 0 headlines with "nothing instead of nothing", "by $0" or "the usual share"; `fix1r/shots/twoParents04_sensitivity_390_top.png`; test "fix round 1 (B1) ..." |
| B2 | 3 | Gone. Retired couple and 08-retired: "Your plan does not depend on how investments grow: it gets there even if they lost money every year." | Same. | `repro-final.txt`; sweep: 0 negative growth figures (its 2 hits are a need of exactly 15.0%, a real figure, not the floor); test "fix round 1 (B2) ..." |
| B3 | 3 | Gone. Jamie with a $20,000 legacy lists spending, retire, saving, lump, claim; no return. | Same. | `fix1r/shots/jamieLegacy_legacy_390_levers.png`; test "fix round 1 (B3) ..." |
| B4 | 3 | Gone. Empty 401(k): "Nothing is saved for retirement yet, and nothing goes in ..." and "If Casey put in 6.6% of pay (about $400 a month) plus the usual match, the plan could pay about $2,690 a month of the $3,090 it plans."; Sam keeps "You haven't told us ...". | Same. | `fix1r/shots/caseyZero_sensitivity_320_dark.png`; tests "L1: no retirement savings ..." and "fix round 1 (B4) ..." |
| B5 | 2 | Gone in this lane: `usualSaving` returns [] for a person born 2080 (and for a child); the page shows no saving row. The projection itself still accepts the date (retirement starts in 2145). | Same. Message for claude-c in section 6. | `repro-final.txt` "B5"; `fix1r/born.mjs`; test "L1 + fix round 1 (M3, B5) ..." |
| B6, B7 | 1 | Gone (not in the list; fixed in the folded round): "$4", never "holds $0"; at the 401(k) limit the label is what goes in ("$2,040 a month + $1,200 match"). | Same. | `repro-final.txt` "B6 ... B7" |
| P8 | 1 | Still there (not in the list; rebase.md named it open): an outlined "Assumptions" button under "Read it like this". | Fixed: the one way to the figures we use says "Check the figures we use ›", lands on the stock-growth box (`#/system/assumptions?show=returnStocks`) and sits inside the folded "How to read this". | `fix1r/shots/folds_casey_320_dark_all_open_tailB.png`; test "simple first (owner, 2026-11-12) ..." |

## 3. Simple first, detail on request (the owner's 2026-11-12 rule, applied to what L1 shows)
Nothing here changes a figure or the plan; opening or closing a fold changes nothing.
- **Goal seek, the grey line.** Was (Jamie): "... grow about 10.4% a year on the plan's mix of stocks and bonds, against the 5.8% a
  year it uses now (7% for stocks and 4% for bonds, our usual figures unless you change them). Most forecasts for a mix like this
  over the next 10 years are lower: about 4.9%-6.5% a year (Vanguard, as of September 30, 2026). ..." Now: "For the plan to work as
  it is, investments would have to grow about 10.4% a year, against the 5.8% a year we use. Most forecasts for a mix like the
  plan's are lower: about 4.9%-6.5% a year (Vanguard). That isn't a choice you can make; the cards above are." 5 lines at 390 px
  (was 9), 7 at 320 px (was 11). The detail is in "How it is worked out", the fold right under the cards: "The 5.8% is 7% for
  stocks and 4% for bonds on the plan's mix, about 60% in stocks: our usual figures unless you change them." plus the two ranges
  and the date. The lever carries it as `more`.
- **Goal seek, the saving card with an idle 401(k).** Was six lines; now "Put about $790 a month into Casey's plan at work. Less
  would do if Casey's job adds some. It holds $48,000, but nothing goes into it now (you said so)." The reminder "If some of each
  paycheck does go in, add it on Retirement contributions." shows only when the person has not said that nothing goes in (the
  owner's own example, a contribution not entered).
- **What matters most.** The five numbers that move the plan most, then "N more numbers" ("they move it less") with the rest;
  no fold for a single row. The fold stays open while the measure is switched. The saving row's line is "Nothing goes in now. The
  high end: what people with pay like Casey's usually put in, plus the match most jobs add (Casey's job may differ). Still short
  of the $3,090 a month the plan spends."; "More about this" under it holds "Casey: 6.6% of pay, about $400 a month. The usual
  match: about $240 a month; HR can tell you the real one. With Casey's own money alone, the plan could pay about $2,720 a month."
  "Read it like this" is now the folded card "How to read this". One outlined way on under the list, in Goal seek's own words:
  "What it would take ›" while the money runs out, "How far each change could go ›" while it lasts. The page has no filled button.
- READMEs: a "Simple first, detail on request" part in `modules/scenarios/goal-seek/README.md` (inside fix round 1) and a section
  of that name in `modules/scenarios/sensitivity/README.md`.

## 4. Where the fix differs from a critic's words, and why
- **M4 against P4** (two fixes for the same line). P4 asked for the stock figure against the stocks range; M4 for the blend
  against the blended range. Kept M4's: one figure against one range on the same mix. Stocks alone would mislead the other
  way: the bond forecasts (5.1%-6.1%) are above the 4% the app uses, so Robin's 6.0% needs stocks at 7.2% when both move
  together, yet the mix at the top of the forecasts (6.5%) lasts. P4's other asks are met (whose figures, no "percentage points").
- **M2 and P3** asked for the match's amount in the line under the row. The dollars are on the bar's own label ("$400 a month +
  $240 match") and the line says the match is the usual one, not the job's ("Casey's job may differ"); the amount, "HR can tell
  you the real one" and the own-money figure are one tap away. This is the owner's newer rule; say if the next round wants them back.

## 5. Checks on 972b0b3
- `npm run registry`: 161 modules, nothing changed. `npm run check`: OK.
- `node tools/leak-guard.mjs --worktree`: OK (2,879 files). `--commits 7297bfb..HEAD`: OK (14 files, message and identity).
- Touched modules (goal-seek, sensitivity, legacy): 47 tests, 47 pass (45 before; two new: the qa base households typed as said,
  and the simple-first view). With the neighbours (health score, the wording tests, pages-followup-b, followups-fix1, Financial
  independence): 170 tests, 0 fail (12 "todo" lines are claude-a's, as before).
- Whole `npm test`, twice: on the final code before the commit and again on 972b0b3: **189,422 tests, 188,782 pass, 0 fail**,
  3 skipped, 637 todo, exit 0 (207 s and 288 s). Neither speed test flaked. Output: `rv/scn/fix1r/npm-test-full.txt` and
  `rv/scn/fix1r/npm-test-final-972b0b3.txt`.
- `tests/golden/**`, `modules/registry.js`, CHANGELOG.md, docs/TEAM.md and docs/WORKBOARD.md: not touched
  (`git diff --stat 7297bfb HEAD` on them is empty). The commit touches the same 14 files as before.
- Sweep of every qa plan (1,423: every fixture builder, every households variation, the five phone-built households, the
  personas, the empty plan) on the final code: 0 throws, the plan never changed, and the zeros listed in section 2.
- Phone (kit, sandbox, Chromium with an iPhone user agent, own server on port 9771, stopped after each run; `curl` confirms it is
  down): 31 screens at 390 px and 320 px, light and dark (Goal seek 12, What matters most 16, Legacy goals 3), then the folds,
  Casey's "said = done" walk and the menu search. Every screen: no sideways scroll, no page or console error, no control under
  44 px, none of the words build, PC, AI, sync, server, NaN or undefined. The only filled controls are the goal and measure chips
  and, on the gated pages, "Add what you own ›". Screenshots read: Casey's Goal seek (390 light, 320 dark), Jamie's and Robin's
  claim cards, What matters most for Casey (rows, the row's detail open, "5 more numbers" open, every fold open at 320 dark),
  the two-parent household's headline, the family at 320 px, the empty-401(k) gate at 320 dark, Jamie's Legacy goals.
  Logs: `rv/scn/fix1r/walk-screens.log`, `walk-screens2.log`, `walk-said.log`, `walk-search.log`, `walk-final.log`.
  The 31 screens were taken on the final code just before the commit; the first 15 predate the link's new name, so Casey's two
  Goal seek screens, every fold and both link taps were walked again on 972b0b3 (`walk-final.log`): same result. The first try
  of the screen walk stopped at screen 16 on my own script (it tried to photograph a row inside a closed fold); its server was
  stopped by the script's `finally`, and the walk was resumed from there.

## 6. For other lanes (I may not edit docs/WORKBOARD.md: please post these)
- **claude-c, `retirement/projection/compute.js` (M5, severity 4, still there at 7297bfb).** The run is not monotone in the
  retirement age. Phone-built Casey (`rv/walk/out/gs/noContrib.real.plan.json`) with $670 a month into the 401(k): retiring at 60
  fails in 2046, **61 lasts**, 62 to 65 fail (2048, 2055, 2062, 2070), 66 lasts. With $790: 60 and 61 last, 62 to 64 fail (2051,
  2059, 2067), 65 lasts. The money critic's reading: the mortgage part inside today's spending leaves the spending at its payoff
  only when the payoff falls after the year work stops (`setupLoanParts` / `workStopYear`). Asked for: the figure not depending
  on the stop year that way, and a test that if retiring at age A lasts, retiring at A+1 lasts too. Repro: `rv/scn/fix1r/repro.mjs`
  (section "M5"), output `rv/scn/fix1r/repro-final.txt`. Goal seek now guards against it on its own card.
- **claude-c, `buildInputs` (B5).** A birth date in the future is accepted: Casey born 2080-06-15 gives "retirement starts in
  2145" and no `missing` entry (`rv/scn/fix1r/born.mjs`). Asked for: list it as missing ("Casey's birth date is in the future:
  check it on the People page"), as `noYears` does for the past.
- **wave 1, `core/app.js:76` (P6, severity 3).** The menu's search box is rebuilt on every key and the new box is focused with
  the caret at the start, so typed letters come out backwards ("matters" -> "srettam"). Fix: keep the box and rebuild only the
  list, or `setSelectionRange(value.length, value.length)` before `focus()`; a kit test that types key by key.
- **claude-f, the Plan health score's hint.** `goal-seek` `compute` now takes `savingInto` ("work" | "taxable"). With `only`
  given it defaults to "taxable", so the score's pinned figure is unchanged. If the hint ever names the 401(k), pass
  `savingInto: "work"`: the amount is then the one that works typed into that account.
- **L3 (mine, later).** Retirement contributions still calls a different match "common" (50% up to 6%); switch its words to
  `matchTerms` (spec D-A4) so both pages name the same match (M2's last sentence).

## 7. To try on a real iPhone (no Safari here; only Chromium is installed)
Nothing new depends on newer JavaScript: the folds are plain `<details>` with a `toggle` listener, as other pages use.
- Goal seek: the grey line's wrap and contrast at 390 and 320 px in dark mode; "What matters most? ›" on one line; Back from it.
- What matters most: tapping "5 more numbers", "More about this" and "How to read this" opens each without the page jumping;
  the chevrons turn; the fold stays open after switching the measure; the bar labels "nothing: $2,340" and
  "$400 a month + $240 match: $2,950" do not touch at 320 px.
- The top bar's title at 320 px without the Sandbox pill.
- The menu search typed key by key (P6) once wave 1 has fixed it.

## 8. For the orchestrator
- The commit message is `rv/scn/L1.msg` as committed; the CHANGELOG line is `rv/scn/L1.changelog` (updated: the short grey
  line, five numbers first). The line before this round is kept as `rv/scn/fix1r/L1.changelog.before`.
- Trailers: "Agent: claude-b", "Co-Authored-By: Claude", "Claude-Session", and, as the rebase job left it, one more line
  "Co-Authored-By: Claude <noreply@anthropic.com>" above Claude-Session (this session's attribution rule asks for it).
  If the workflow wants exactly three trailer lines, drop that one with `git commit --amend`; the tree does not change.
- This round did more than the 18 findings: the simple-first pass of section 3 and P8. It is all inside L1's own files.
