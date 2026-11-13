# Track ret: skeptic recheck of the final review's F1-F6 (2026-11-13)

Track tip 850ca03 on 707355c (L2 728ccec, L3 e4464ef, L4 42dab5d, L5 01ce3e5, L6 850ca03). The track worktree `rv/b-ret` was only
read; it is still at 850ca03 and clean. My copy: `rv/v-ret-fin2` (detached at 850ca03), served on 127.0.0.1:9711 with the kit,
always the sandbox, real touch taps, Chromium phone emulation. Scripts, logs and pictures: `rv/ret/fin2/` (`f.mjs` walks F1-F6 by
their own steps; `scan.mjs` opens every fold and tries every chip on the track's screens for 9 households; `g.mjs` extra probes;
`shots/`). Widths: 390 light and 320 dark for everything, 320 light and 390 dark for F1, F2, F3, F4, F5 and F6.

**Verdict: all six closed. Nothing open.**

## F1 (sev 3): the word "null" under the tax answers. CLOSED
- Code: `contributions/view.js:794` now `more.append(chips, rule, ...(catchUp ? [p] : []))`.
- Browser, by the steps (Dana, Jamie, Robin rows; Casey's `?add=setup-self` landing; "Change ›"), 390 light, 320 dark, 320 light:
  the opened part's nodes are `[DIV, P]` (was `[DIV, P, TEXT:null]`), no "null/undefined/NaN" on the page, the plan unchanged
  by the tap (f-390.log, f-320d.log, f-320.log; shots F1-dana-390.png, F1-casey-320d.png).
- Suite: `qa/fixtures/fake-dom.mjs` now writes a null handed to append/prepend/before/after as text (as the browser does) and
  `textOf` throws on it; the F1 test in `tests/tax-split.test.mjs` covers the young and the catch-up case. I also ran the
  scenario track's fake-DOM test (b-scn 5c62458, `modules/scenarios/goal-seek/module.test.mjs`) against this stricter fake
  DOM in a throwaway worktree: 32 of 32 pass, so it does not break the other track on merge.

## F2 (sev 3): "over the 2026 limit" right after Work benefits' "Use 31.4%". CLOSED
- By the steps (Some of each 4% + 2%, Save; Work benefits "Use 31.4%"; Contributions), 390 light, 320 dark, 390 dark: rows
  $1,911.66 + $130 a month = $24,499.92; "$24,500 of $24,500", green bar, "$0 of room left", no "over" anywhere
  (shots F2-limit-390.png, F2-limit-390d.png).
- Also the plain row at the most: Dana $2,041.66 (24,499.92), Jamie $2,041.66, Robin (63, the 60-63 catch-up) $2,708.33
  (32,499.96, "$3,250 of room left, including the catch-up allowed from 60 to 63"); no over line on any.
- The limit check stays exact (the answer key's rule, "equality is allowed"); the N1 test is now `own <= limit`.

## F3 (sev 2): a fold holding a figure just typed did not say so. CLOSED
- A (Retirement settings, Jamie, card spending "Change ›"): line "as usual"; 85 typed under "More settings", fold closed:
  "1 to save"; plan unchanged until Save; Save: stocksNow 0.85, notice "Retirement settings saved: share in stocks now 70% →
  85%."; line then "1 changed". 85 then 70 typed back: "as usual" again. 150 typed under the closed fold, Save: the fold opens,
  the browser's "Value must be less than or equal to 100.", plan unchanged (shots F3A-closed-390.png, -320d.png).
- B (Assumptions `?show=returnStocks`): 4% inflation chip under "All the numbers", fold closed: "9 more, 1 to save"; under Save
  "Save keeps this number and what you changed under "All the numbers"."; button "Save"; plan unchanged until Save; Save:
  inflation 0.04, returnStocks 0.07, review date untouched; notice "Saved: prices rising 3% → 4%. Your retirement answer: now
  runs out at 68 (was 70)." (shots F3B-closed-390.png, -320d.png). Shown box and folded box both changed (g.mjs): "Saved:
  stocks growing 7% → 6%, money lasting to age 95 → 100. Your retirement answer: ...".

## F4 (sev 2): the card's folds held the person's own figures silently. CLOSED
- Jamie with growth 6% and prices 3.5% saved earlier: fold "6 more numbers, 3 you gave us" (growth, prices, what goes into the
  401(k)); with the shown match row that is the hero's "4 you gave us" (shots F4-jamie-closed-390.png, -320d.png).
- Family (on track, folded card): "What this answer rests on · 1 not counted" (was "12 numbers"); inside, the Not counted
  left-over row with its Answer button; the hero above names the $3,884 (F4-family-closed-390.png, -320d.png). After the
  left-over is answered the line is "12 numbers", matching the hero's "rests on 12 numbers: 8 you gave us" (g.mjs).
- The builder's words ("you gave us") differ from the suggested "you changed"; they are the hero's own count, so the two read as
  one. Accepted.

## F5 (sev 2): a save on a paired row dropped the retirement answer. CLOSED
- Jamie (match never asked), Pay the tax now, Save ("Saved: $250 a month goes into Roth 401(k) at work, paying the tax now.", no
  answer: the tax answer moved, D-C3); card "Check the match ›" (`?match=` on the Roth row), 2040, Save: "Saved: Jamie's employer
  adds $2,040 a year (on the pay-the-tax-later row). Your retirement answer: now runs out at 75 (was 71)."; the match sits on the
  $0 pay-the-tax-later row; the projection then says "before your change: runs out at 71. Now: runs out at 75"
  (F5-jamie-390.png).
- Dana 270/130 raised to 470: "Saved: $470 a month paying the tax later (with the match), $130 a month paying it now. Your
  retirement answer: lasts to the end, with about $112,000 more left at 97 (today's dollars)." (F5-dana-320d.png).
- Other branches (g.mjs): match alone 2,400 → 3,000: "Saved: Dana's employer adds $3,000 a year. Your retirement answer: ...";
  amount and match together: both said, then the answer.

## F6 (sev 2): Assumptions from the menu was ten boxes. CLOSED
- From the menu, 390 light / 320 light / 320 dark / 390 dark: first view two boxes (inflation, stocks) with their chips, one
  filled "Save", "Reset to defaults" outlined, "All the numbers · 8 more"; page 1,620 px at 390 (was 2,468), 1,812 at 320.
  Opening the fold: all ten boxes, "Save and mark as reviewed", plan unchanged; closing: "Save" again, plan unchanged. A box
  changed under the closed fold: "8 more, 1 to save"; Save keeps it, no review date, notice "Saved: retirement age 65 → 67. Your
  retirement answer: now runs out at 78 (was 70)." (F6-menu-390.png, F6-menu-full-390.png, F6-menu-full-320.png,
  F6-menu-320d.png).

## Regressions
- Fold-and-chip scan (`scan.mjs`, 9 households: Jamie, Casey, Dana, Robin, Morgan, sam, family, renterDebt, Jamie match never
  asked; projection with every fold open and the left-over panel's three answers, settings, contributions and every row's
  "Change ›" with each tax answer, Assumptions both ways, Work benefits, Paycheck): 0 bad lines at 390 light and 320 dark, no
  sideways scroll, no page or console error (scan-390.log, scan-320d.log). Every walk: overflowX false, errors [].
- Whole `npm test` (fin2/npm-test.txt): 189,485 tests, 188,844 pass, 1 fail, 3 skipped, 637 todo. The one failure is the speed
  test "takes well under 1.5 s" (modules/transactions/ledger, 1,814 ms under load); rerun alone it passes.
- The track's tests (tax-split, levers x4, leftover-invariance, contributions, assumptions, benefits, projection, paycheck
  module tests): 231 of 231.
- `npm run registry`: 161 modules, registry unchanged. `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,887
  files. `git diff 707355c HEAD -- tests/golden`: 0 lines.
- Five commits on 707355c, one per L, each ending with exactly Agent / Co-Authored-By Claude / Claude-Session; no older
  Co-Authored-By line. No file in another lane touched (no projection or setup compute, estimators, claude-f's or claude-a's
  folders, wave 1's files, investments/holdings, CHANGELOG.md, TEAM.md, WORKBOARD.md, registry).

## Seen, not a finding of this track
- After the Dana 470 save at 320 dark, the shell's repeat of the notice at the foot of the screen sits over the card under it
  and leaves out the "Your next move" link (F5-dana-320d.png). That is wave 1's shell, not this track.

## Housekeeping
- Server on 9711 stopped by its pid (wrapper 5153, child 5162); port free. Scratch worktrees `rv/v-ret-fin2` and the throwaway
  `rv/v-ret-fin2-x` removed with `git worktree remove` (only the kit's git-ignored planner.properties was there).

## Only Chromium here: try on the real iPhone (Safari)
1. Contributions, a row at work, "Change ›": three answers and the rule of thumb, nothing under them (F1).
2. Retirement settings: type in "Share in stocks now" under "More settings", close it: "1 to save" (Safari's `input` from a number
   box with the keyboard up) (F3 A).
3. Assumptions `?show=returnStocks`: a chip under "All the numbers", close it: "9 more, 1 to save" and the line under Save (F3 B).
4. Assumptions from the menu: Safari's `<details>` toggle turns Save into "Save and mark as reviewed" and back; the keyboard over
   the stock box leaves Save reachable (F6).
5. Work benefits "Use 31.4%" after a split, then Contributions: no amber over-limit line (F2).
6. "Check the match ›" on a Roth 401(k) row, 2,040, Save with the keyboard up: the notice and its answer in view (F5).
7. At 320 px: "6 more numbers, 3 you gave us" and "1 not counted" fit, nothing runs off the right edge (F4).
