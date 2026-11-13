# Track ret: fix round 2 (builder claude-b), 2026-11-13

Worktree rv/b-ret. Log written as the work goes (earlier attempts at this round were cut off with no log: this one is kept current).

## 0. State found (00:48)
- HEAD d4f8a01 (L2 6ae870e, L3 acf339c, L4 f9d7709, L5 f109d56, L6 d4f8a01) on 7297bfb.
- Unsaved: 17 files changed (+1,440 / -305) and one untracked test `tests/levers-fix1.test.mjs`. Two earlier sessions wrote them
  with no log: 2026-11-12 18:28-18:53 (edit scripts in `rv/ret/f1/e-*.py`; 8 files, saved by the next one as
  `rv/ret/fix2/wip-start.diff`) and 2026-11-13 00:25-00:44 (`rv/ret/fix2/`: hunks.mjs, firstview.mjs, fv-before/, fv-after/; READMEs,
  tests, the simple-first cut of the card). Saved whole as `rv/ret/fix2/wip-now.diff` before anything else.
- The track's touched tests on that state (levers, levers-before, levers-fix1, tax-split, contributions, assumptions, projection,
  benefits, paycheck): 223 of 223 pass (`rv/ret/fix3/touched-start.txt`).

## 1. Findings of severity 2 or more (the reports named in the task), with the L they belong to
| id | sev | L | finding (short) |
|---|---|---|---|
| M1 | 5 | L4 (figure from L2) | the card's left-over is NBA's with the goal saving put back, not the Dashboard's |
| M2 | 4 | L6 | Some of each does not keep the person's total |
| M3 | 4 | L4 | "It stays in the bank" counted as retirement saving (Dashboard, NBA, Benchmarks, Contributions) |
| M4 | 2 | L6 | "This year's federal tax": a whole year said in November; state left out |
| M5 | 3 | L2/L3 | "enough for the whole usual match": the old guessed match becomes the person's own |
| M6 | 3 | L5 | J.P. Morgan figure is the 2026 edition (6.7%); the 2027 one (2026-10-19) says 7.5% |
| M7 | 2 | L4 | after "We don't know yet" the notice says "(was: runs out at 65)" |
| M8 | 2 | L6 | Work benefits: "because less tax comes out" for Roth money |
| P1 (=F1) | 3 | L6 | Some of each: Save tapped from the Roth box saves nothing (the tax line pushes Save 43 px) |
| P2 (=F2) | 3 | L3 | Casey's one tap saves our 6.6% and our $2,880 match as hers; the note is off screen |
| P3 | 2 | L6 | the split's 50-word toast leaves in 3.5 s; the page's notice is off screen |
| P4 | 2 | L5 | Assumptions: a tapped chip looks applied, Save 1.5 screens down |
| P5 (=B4b) | 2 (B4b 3) | L3 | "It matches" puts Cancel under the thumb; a second tap closes the form |
| P6 (=F5) | 2 | L4 | the verdict turns and the notice says "still" |
| P7 (=F3 rest) | 2 | L2 | spending "Change ›": seven boxes, Save 950 px down, after Save only "Retirement settings saved." |
| P8 | 2 | L3 | Casey types 0 for the match as told and is asked "No match on file. Is that right?" |
| P9 (=F4) | 2 | L3 | "No match at Jamie's job" over "employer adds $2,040 a year" |
| P10 | 2 | L6 | every edit of a row at work opens with the tax question; Save off the first screen |
| F6 (=P13) | 2 in round 1 (1 in round 2) | L4 | the left-over notice shows twice; the toast covers the row |
| B1 | 4 | L6 | two jobs: one job's row takes over the other's Roth 401(k) |
| B2 | 4 | L6 | a split taken back loses the pay-the-tax-now part (4% + $130) |
| B3 | 4 | L4 | "Still right" keeps more invested than is left over |
| B5 | 3 | L3/L6 | "Check the match ›" puts the employer's money on the Roth 401(k) |
| B7 | 2 | L4 | deleting "Investments for later" leaves the $1,820 a month counted |
| N1 | 3 | L6 | Work benefits "Use 31.4%" after a split: $1,560 over the year's limit |
| N2 | 3 | L6 | a Roth 401(k) known only by its match stops being one when the split moves the match |
| N3 | 3 | L6 | a changed tax answer with an empty box deletes the row and says "Saved: $0 a month" |
| N4 | 3 | L2 | double tap on the card's spending "Change ›" opens another page |
| N5 | 2 | L6 | after a split, "Into which account" and "Whose" are ignored and the page says Saved |
| N6 | 2 | L2/L4 | "You just changed this: $1,820 a month invested → $1,820 a month" |
| N8 | 3 | (uncommitted round-1 copy only) | holdTaps on Contributions let the chip tap and Save go |
| recheck M2 | 2 | L3 | Contributions calls another match "common" (50% up to 6%, $2,160 for Casey) |
Severity 1 items fixed on the way are named in section 4 (P11, P12, P16, P19, P21, N7, B11, P15).

## 2. The unsaved edits: judged, kept, split (01:05)
- Read whole (levers.js, contributions compute and view, projection view, assumptions compute and view, benefits view,
  DATA_MODEL, the READMEs' new sections, the test names). Every change is a finished fix with its README line and a test, and
  the touched tests pass (223 of 223). Nothing half done to complete, nothing to drop. N8 (the round-1 `holdTaps` on
  Contributions) is not in it: "It matches" is now answered in place (P5) and Contributions holds no taps.
- Two cleanups before committing: the new test file `tests/levers-fix1.test.mjs` split in two by the commit its code is in
  (`tests/levers-leftover.test.mjs`: M1, M3, B3, B7, P6/M7, for L4; `tests/levers-review2.test.mjs`: N6, B5, M5, for L6), and
  the READMEs' "findings in rv/ret/critic-*.md" (a scratch path in the public repo) put in words.
- Split by finding into fixup commits (`rv/ret/fix3/split.mjs` + `assign.mjs`: every U0 hunk of the diff, its owner by `git blame`,
  then the rule below; trees HEAD + hunks of L <= k): L2 817e3aa (7 hunks), L4 a249fd1 (54 hunks + the new L4 test), L5 ba8cdc0
  (19 hunks), L6 d8b8e0d (149 hunks + the new L6 test). Full diff before the split: `rv/ret/fix3/wip-before-split.diff`.
- The rule: a fix goes into the L whose finding it answers, unless the code it changes or calls was (re)written by a later L,
  then into that later L. So:
  - L2: the hero's order (P21), no Go deeper while "We don't know yet" (P19), "More settings" fold in Retirement settings (P7's
    first view), the card's one-sentence intro and three rows (simple first).
  - L4: M1, M3 (contributions compute's sums, DATA_MODEL, the card's and Contributions' bank words), B3, B7, P6 and M7 in
    `answerChangeWords`, the left-over notice in view in the same drawing (F6), "Answer" only opens (B11), P16's words.
  - L5: M6 (FORECASTS), P4 (?show= opens one number).
  - L6: everything that rewrites the Contributions form and its save (L6 rebuilt it for the tax question): P2, M5, P5, P8, P9
    and the Contributions half of P6 are there, not in L3 (their lines in L3's shape do not exist after L6; written in L3 they
    would be written twice); B1, B2, B5, M2, M4, M8, N1, N2, N3, N5, P1, P3, P10; and what uses the round-1 "Before your change"
    machinery that was folded into L6 at the rebase (P12, N4, N6's `changedKeys`, N7, P7's notice, the left-over notice's turn).

## 3. Commits and the rebase onto 707355c (01:20)
- `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash 707355c`: 8 conflict blocks, all at the spots the split's adjacency report named
  (`rv/ret/fix3/plan.txt`): `SHOWN_ROWS` (L2 fixup, L4 replay), the levers.js header and LEFTOVER_MIN comment (L4 fixup, L5
  replay), the projection view's import line (L4: `lowerLeftover` added to L4's own line), contributions README (L4: the two M3
  bullets only, not L6's section that followed in the fixup's context); the L6 replay's three files set to the final ones.
  The track's 25 files at the tip equal the split's final tree (`git diff d8b8e0d HEAD` shows only 707355c's own 8 files).
- Each commit's touched tests (`rv/ret/fix3/percommit.sh`): L2 to L5 failed 3-4 each, all one cause: the More-settings and
  ?show= folds use `Element.before/after`, which the fake DOM got only in L6. Moved those 3 fake-DOM lines into L2 (an `edit`
  stop; L6's replay merged clean). Then L2 165/165, L3 173/173, L4 187/187, L5 183/183, L6 223/223.

## 4. Each finding reproduced on the build before this round, and the fix
Method: this round's tests (`levers-leftover`, `levers-review2`, `levers-before`, `tax-split`, the contributions, assumptions and
benefits module tests, `levers.test`) copied onto a `git archive` of the pre-round tip d4f8a01 (`rv/ret/fix3/before-app`) and run
there (`rv/ret/fix3/repro-before.txt`): 35 fail, each naming its finding; all pass on the new tip. The phone-only ones were also
walked (section 5).

Phone walks (`rv/ret/fix3/walk.mjs`: kit, sandbox, real touch taps; the new tip on 9713, the pre-round tree on 9714; 390 light and
320 dark; logs `walk-{new,old}-{390,320d}.log`, pictures `rv/ret/fix3/shots/`).

| id | L | reproduced on the pre-round build | the change | test |
|---|---|---|---|---|
| M1 | L4 | yes, by code (3 tests fail) | the row, effects, hero line, prefill and cap read NBA `spare.monthly` (after goals, uneven pay at what is counted on); no row under $50 | levers-leftover "M1: ..." x3 |
| M2 | L6 | yes: walk P3 old, later box stays 400, rows 400 + 130 (total up $130 a month); test fails | "Now $400 a month in all."; the now part typed comes out of the later box; a sum that differs is said before saving | tax-split "Some of each keeps the person's total" |
| M3 | L4 | yes: walk M3 old, Dashboard "Checking and savings stay about level ... $6,400 goes into retirement. $2", Contributions "$6,360 a year into retirement accounts ... 11% of your pay"; tests fail | contributions compute leaves rows into checking/savings out of its saving sums (`bankYearly` beside them); new: Dashboard keeps "$6,400 a year builds up in checking and savings. $532", Contributions says "$530 a month stays in Savings, counted for later" | levers-leftover "M3: ..." x2 |
| M4 | L6 | yes (test fails) | "About $190 a year more in federal income tax than paying it all later (state tax on top): about $21 a month less take-home pay." on the form and in the fold | tax-split (the form test) |
| M5 | L6 (code L6 rewrote) | yes (test fails) | the "full" change names the usual match it counts; the landing asks it; left blank it stays our guess, worked out again at the amount saved | levers-review2 "M5" |
| M6 | L5 | yes (assumptions test file fails: no FORECASTS) | `FORECASTS` (one edit per edition, read on 2026-11-12): "7.5% (J.P. Morgan, October 2026)"; the fold names the 2027 edition and says the one before said 6.7% | assumptions "L5 presets" |
| M7 | L4 | yes (test fails) | after "We don't know yet" only the new answer, no "was" | levers-leftover "P6, M7" |
| M8 | L6 | yes (test fails) | `costWords`: all Roth "goes in after tax, so your take-home pay drops by the same $180"; part; none | benefits "M8" |
| P1 | L6 | yes: walk P1 old 390, Save tapped at y 606 from the now box, rows unchanged (400, no Roth row) | the sum and tax lines keep their room from the first draw (a hidden longest sentence behind them) | walk P1 new 390 and 320 dark: saved, 260 later + 130 now |
| P2 | L6 (code L6 rewrote) | yes: walk P2 old, one tap saved [396, 2880] and no guess | nothing of ours typed in: empty box with 396 grey, chip "Use the usual 6.6% ($396 a month)", match asked; Save with the box empty is refused in words (now brought into view, a new fix of this round: it was drawn above the screen) | contributions "L3: ?add=..."; walk P2 new: nothing saved |
| P3 | L6 | yes: walk P3 old, 50-word toast | one sentence, in view, no toast; tax and mix in the fold "When the tax is paid" under the rows | tax-split form test; walk P3 new: no echo |
| P4 | L5 | yes: walk P4 old, Save at y 1562 ("Save and mark as reviewed") | `?show=` opens that number alone, its own "Save" right under (y 623 at 390, 494 at 320), the other nine under "All the numbers 9 more"; a Save there does not mark the rest reviewed | assumptions "P4"; walk P4 new |
| P5 | L6 (uses applyMatchAtWork) | yes: walk P5 old, page scrolled 0 → 1381, Cancel under the thumb, the second tap closed the form | "It matches" opens one box with its own "Save the match" in the card; nothing moves | contributions "L3: the match check"; walk P5 new: saved 2,040, "now runs out at 74 (was 70)" |
| P6 | L4 (words) + L6 (notice turn) | yes (test fails) | never "still" over an answer that lasts; a turned headline is said first, before and now | levers-leftover "P6, M7" |
| P7 | L2 (fold) + L6 (notice) | yes: walk P7 old, Save at y 979 under 7 boxes, toast "Retirement settings saved." only | the spending box and Save first, the six others under "More settings (stocks, tax, how much to take out)" with "as usual"/"N changed"; the save says "now runs out at 73 (was 70)" and stays | levers-before "P7"; walk P7 new |
| P8 | L6 (code L6 rewrote) | yes (test fails) | a 0 typed on a landing that asked is "no match at this job" | contributions "L3: ..." |
| P9 | L6 (code L6 rewrote) | yes (test fails) | a match saved takes back "no match" (`matchTakesBackNo`); the "No match" card hides while a row carries one | contributions "L3: ..." |
| P10 | L6 | yes: walk P10 old, Save at y 830 of 844 (390) | one quiet line "Tax on this money: paid later, the usual. Change ›"; Save at y 606 (390), 591 (320, one thumb-scroll) | tax-split "P10"; walk P10 new |
| F6/P13 | L4 | yes at 320 dark: walk F6 old, the echo "✓ Saved: $400 a month into Savings ..." over the row | the card's notice is scrolled into view in the same drawing | walk F6 new 320 dark: no echo |
| B1 | L6 | yes (test fails) | one job, one pair (`pairOf`) | tax-split "B1" |
| B2 | L6 | yes (test fails) | leaving Some of each adds both parts in dollars when they are not both shares; a part that cannot be read stops the change with words | tax-split |
| B3 | L4 | yes (tests fail) | a row above what is left over: "Lower it to $X", never "Still right"; nothing left: "Stop counting it" | levers-leftover "B3" x2 |
| B5 | L6 | yes (test fails) | `applyMatchAtWork`: a match for a Roth 401(k) row goes on a pay-the-tax-later row of the same job | levers-review2 "B5" |
| B7 | L4 | yes (test fails) | the account gone: said, "Stop counting it" | levers-leftover "B7" |
| N1 | L6 | yes (test fails) | `use401k` keeps the Roth rows in dollars, later rows take the rest | benefits "N1" |
| N2 | L6 | yes (test fails) | the Roth account is renamed "... (Roth 401(k))" when the match leaves it | tax-split "N2" |
| N3 | L6 | yes (tests fail) | empty box refused; a typed 0 keeps the row at $0 | tax-split "N3" x2 |
| N4 | L6 (holdTaps) | yes: walk N4 old, the double tap reloads the page at `?type=spending` (focus lost); the test now fails there too (it passed vacuously before: Jamie's spending row is hidden, and the fake DOM has no comma selectors; rewritten to check every phone-built household and to need one) | a button that opens the settings in place, focused | levers-before "N4"; walk N4 new: stays, box focused, at 200/300/500 ms |
| N5 | L6 | yes (test fails) | the account changed with the tax answer moves the row when of its kind, else refused in words | tax-split "N3, N5 on the form" |
| N6 | L4 (`cmp`) + L6 (`changedKeys`) | yes (test fails) | one value for what the person said | levers-review2 "N6" |
| N8 | - | not in any commit: it was in the round-1 copy only; "It matches" now answers in place and Contributions holds no taps | - | - |
| recheck M2 | L3 | judged already fixed in L3: the recheck read the shared branch, which does not have L3. On this track Contributions says "Most employers that match add about 4% of pay when you put in 6% (Vanguard, How America Saves 2026): about $2,880 a year for Casey" (`usualMatchWords`, `usualMatchAt`), the same table as the card; walk P2 new shows "$2,880" | nothing to change | contributions "L3: the match check" |

## 5. Phone walks on the final tree (01:44)
`rv/ret/fix3/walk.mjs` rerun on the final tip (`walk-final-390.log`, `walk-final-320d.log`, pictures `rv/ret/fix3/shots/*-new-*`),
against the pre-round walks (`walk-old-*.log`). Every step: no sideways scroll, no page or console error (12 of 12 per width).
- P1: Save tapped from the now box saves 260 + 130 (Roth row added), the job's $2,400 kept; no echo.
- P5: "It matches" leaves the page where it was (scroll 0 → 0); one box and "Save the match"; saved [250, 2040].
- F6/P13 and P3: no echo over the row at 0.7 s; Dana's rows [270 monthly + $2,400 match, 130 monthly].
- N4: a second tap 200, 300 or 500 ms after "Change ›" keeps the route and the spending box focused.
- P2: Casey's landing shows an empty box with 396 grey and the chip "Use the usual 6.6% ($396 a month)"; one tap on Save
  saves nothing and says "Type what goes in each time, like 396, or tap the button under the box to use that." in view.
- P7: the spending box and Save, the six others under "More settings ... as usual"; after Save "Retirement settings saved. Your
  retirement answer: now runs out at 73 (was 70)."
- P4: ?show= opens one number, its Save on the first screen, "All the numbers 9 more".
- P10: one quiet tax line with "Change ›", "More options Dana's plan at work" (Remove inside it), Save on the first screen
  (y 606 to 662 of 844, by where the page lands).

## 6. Simple first
Before/after counts per screen: `rv/ret/optional.md`. Re-measured on the final tree (`rv/ret/fix3/fv-final/`, `fv-final.log`):
the same as `fv-after2` except Jamie's whole page at 320 (671 → 668 words, the date line).

## 7. The last fix, the final rebase, the checks (01:20 to 01:55)
- The whole `npm test` on the rebased tip found 2 failures in `modules/retirement/withdrawal-strategy/module.test.mjs`
  ("5b: after 'Use this one' ..." and "5b UX review 18 ..."): their stand-in `ui.form` has no `querySelector`, and the new
  "More settings" fold called it. The fold is now built only when the form has its Save row (`actions?.before`); a real form is
  unchanged. Fixup into L2.
- `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash 707355c`: clean (5 fixups: 3 into L6, 2 into L2); the tip's tree is the same
  before and after (46168171). Messages then set from `rv/ret/fix3/msg/L{2..6}.msg` by `git commit-tree` on the same trees and
  authors; each ends with exactly Agent / Co-Authored-By / Claude-Session (checked: one of each).
- Each commit's touched tests (`percommit2.sh`: every test file the track touched by then, the tests of every module folder it
  touched, and withdrawal-strategy): L2 108/108, L3 133/133, L4 149/149, L5 150/150, L6 242/242.
- `npm run registry`: 161 modules, no change. Whole `npm test` (`npm-test-2.txt`): 189,479 tests, 188,839 pass, 0 fail, 3
  skipped, 637 todo (the speed tests passed in the run). `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,887
  files. `git diff 707355c HEAD -- tests/golden`: empty.
- Servers stopped by pid (9713, 9714 and their wrappers; first-view's own 9715 closed itself); the scratch worktree
  `rv/ret/fix3/wt` removed.

## 8. Final commits (on 707355c, detached HEAD in rv/b-ret)
| L | sha | subject |
|---|---|---|
| L2 | c42c2e5 | "What this rests on" on Will the money last? |
| L3 | b19ebe9 | Contributions: the card's links land on the box, the match check, the answer after a save |
| L4 | b8aeefe | Will the money last?: say what happens to the money left over, and count it that way |
| L5 | 310f16f | Assumptions: careful, middle and hopeful, and what a change does to the retirement answer |
| L6 | 96682da | Pay the tax later or now, per row at work: the split, this year's tax, the mix at retirement |
CHANGELOG lines: `rv/ret/L{2..6}.changelog` (rewritten to what the person now sees).

## 9. Only Chromium was used: to try on the real iPhone (Safari)
1. P1: Save tapped straight from the Roth (now) box with the keyboard up: the sum line must not jump and the tap must land on Save.
2. "It matches" (P5): one tap opens the box in place; the page must not scroll under the thumb.
3. N4/N7: a quick double tap on "Change ›" and on a card row (touch-action and the tap hold): no reload, no lost focus.
4. Landings from the card ("Type what goes in ›", "Check the match ›"): the box is in view without the keyboard jumping up.
5. Assumptions chips (careful / middle / hopeful) and the ?show= Save with the keyboard open.
6. The tax line's "Change ›" and its chips with the keyboard up; the "Some of each" sum line.
7. Notices: the saved and refused notices in view (formFail scrolls to centre; Safari's smooth scroll and the bottom bar).
8. The folds (`<details class="fold">`): summary tap target 44 px, the chevron, and a refused box opening its fold.
9. Safari's 7-day storage limit for the sandbox and the plan (not this round's code, but every save above rests on it).
