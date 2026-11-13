# Track ret: last fixes (builder claude-b), 2026-11-13

Worktree rv/b-ret. Findings F1-F6 of rv/ret/final.md (the task names these six; F7 and F8 are severity 1 and not in the task).
Log kept current as the work goes. Scratch for this round: rv/ret/fixf/.

## 0. State found
- HEAD 96682da on 707355c (L2 c42c2e5, L3 b19ebe9, L4 b8aeefe, L5 310f16f, L6 96682da), clean.

## F1 (L6): the word "null" under the tax answers
- Reproduced in the suite: with the fake DOM writing a null as the word (as a browser does), 3 tests of tests/tax-split.test.mjs
  fail at "Change ›" (`the page shows the word "null"`). A probe over all 25 files that use the fake DOM (382 tests) found this one
  call site only (contributions/view.js:777 `open`), so nothing else in the suite hands a null to the DOM.
- Fix: `more.append(chips, rule, ...(catchUp ? [p] : []))`.
- The fake DOM (qa/fixtures/fake-dom.mjs): append / prepend / before / after now write a null or undefined as the word, as the
  browser does, and `textOf` (every page test's `text()`) throws `the page shows the word "null" ...` when it reaches one, so the
  whole suite catches this kind of bug from now on.
- Test: tests/tax-split.test.mjs "F1 (review 2026-11-13) ..." opens "Change ›" for Dana (47, $78,000: no catch-up line, no null,
  no loose text node) and for Dana at 56 paid $160,000 (the catch-up line under the rule of thumb). It fails on the old view.

## F2 (L6): "over the 2026 limit of 24,500" right after Work benefits' own "Use 31.4%"
- Reproduced: the N1 test with the limit tightened to `own <= limit` fails on the old code ("own 24500.04 within the limit
  24500"), and Dana's plain row (no split) after "Use 31.4%" saves $2,041.67 a month (24,500.04), the same bug before the track.
- Fix, at the end that was wrong (Work benefits `use401k`): each payment to the nearest cent unless that puts the person's own
  money a year (both rows) above the choice; then the pay-the-tax-later payments go down to the cent (`floor(x*100 + 1e-6)/100`);
  a Roth part brought down by a smaller choice always goes down. Split: $1,911.66 + $130 = $24,499.92. Plain: $2,041.66. Below
  the limit nothing moves (6% = $390).
- The limit check in Retirement contributions `compute` stays exact (`used > limit` warns, `over = max(0, used - limit)`). A first
  try also let it leave out less than half a dollar over; the whole `npm test` then failed 25 answer-key cases
  (tests/golden-retirement.test.mjs, e.g. contributions-ira-combined-limit-065 "byPerson.0.limits.0.over: expected 0.01, got 0",
  and 401k-base, 401k-catchup, 401k-super-catchup, warning-threshold). The answer key is right and binds: its brief
  (tests/golden/retirement/briefs/contributions.md) says "warning-threshold | excess = max(0, used − cap); warn strictly above;
  equality is allowed", a cent either side of the cap. So that part was taken back out (and "room left" is `limit - used` again,
  as before); a cent over is over, and the fix is that Work benefits never saves one. The golden files were not touched.
- Tests: tests/tax-split.test.mjs N1 tightened (`own <= limit`, no limit warning, `over` 0) and "F2 (review 2026-11-13) ..." (plain
  row at the most: 2,041.66; Use 6%: 390; and the check stays exact: 1,911.67 + 130 is about 4 cents over, 1,911.66 + 130 is not
  and says nothing). The first two parts fail on the old code; the golden test passes again (all 25 cases).
- README: career/benefits "Never over by cents"; retirement/contributions "Work benefits never saves a cent over the limit (F2)",
  which quotes the answer key's rule.

## F5 (L6): a save on a row with a pay-the-tax-now partner drops the retirement answer
- Reproduced with the fake DOM on the old view (the new test fails: the notice is "Saved: $250 a month goes into Roth 401(k) at
  work, paying the tax now; the match stays pay-the-tax-later." with no answer).
- Fix (contributions/view.js `saveTax`): the save is marked as a tax answer (`pending.tax`, which leaves the answer out, D-C3)
  only when the tax answer itself moved: another of the three answers, or "Some of each" with money moved between the parts and
  the total kept. Otherwise the notice says what changed and gets the answer like every other save. The match first when the
  form was opened to ask about it ("Check the match ›") or only the match changed: "Saved: Jamie's employer adds $2,040 a year
  (on the pay-the-tax-later row). Your retirement answer: now ...". Amount and match both changed (no landing): the parts, then
  "Dana's employer adds $X a year."
- Test: tests/tax-split.test.mjs "F5 (review 2026-11-13) ...": (1) B5's steps on Jamie, (2) Dana 270/130 -> 470/130 says both
  parts and the answer, (3) Dana 270/130 -> 200/200 (total kept) says no answer.
- README: retirement/contributions "The final review (2026-11-13: F1, F2, F5)".

## F6 (L5): Assumptions from the menu was all ten boxes. Judged right, fixed.
- Checked against the design log first: round 17 (2026-09-15) chose plain lines, the sources in one fold, the review status as a
  notice and ONE filled "Save and mark as reviewed" (saving is reviewing). The newer entry (2026-11-12, "Simple first") names
  Assumptions among the pages that follow it and says "never a wall of boxes"; the owner's 2026-11-13 words say "simple by
  default". The `?show=` shape the critics already accepted keeps round 17's rule where it applies (one filled button; saving
  with all ten in view marks them reviewed). So F6 is right and nothing of round 17 is undone.
- Fix (assumptions/view.js): opened plainly, the first view is the two the owner named (prices rising, stocks growing) with
  their chips and one filled "Save"; the other eight under "All the numbers · 8 more" (the same fold as `?show=`'s, "9 more"
  there). Opening it turns Save into "Save and mark as reviewed" and the line under it into round 17's. The not-reviewed and
  year-old notices say where the rest are. Saving with the fold closed keeps the review date as it is (as `?show=` already did).
- Test: module.test.mjs "P4 ..." (its last part, which pinned the old all-ten page, now pins the new one: two boxes outside, eight
  in the fold, one "Save", closed save not reviewed, opened "Save and mark as reviewed" and reviewed).

## F3 (L5 and L2): a fold that holds a figure just typed does not say so
- B, Assumptions (L5): the fold's line recounts on `input` / `change` (and on open/close) the boxes under it that differ from what
  the page drew: "9 more, 1 to save" (back to "9 more" when put back); the line under Save: "Save keeps this number and what you
  changed under "All the numbers"."; the notice names every figure that moved: "Saved: prices rising 3% → 4%. Your retirement
  answer: now ...". "1 to save" rather than "1 changed, not saved yet": base.css sets `.fold-status` to `white-space: nowrap`,
  and the longer words would squeeze the title to one word a line at 320 px. Test: module.test.mjs "F3 (review 2026-11-13) ..."
  (fails on the old view).

- A, Retirement settings (L2 for the fold, L6 for the notice): the line under "More settings" recounts on `input` / `change`
  the boxes under it that differ from what the page drew: "1 to save" (2, ...), back to "as usual" / "N changed" when put back.
  The save notice names the settings under the fold it changed: "Retirement settings saved: share in stocks now 70% → 85%; how
  tax is worked out: the federal brackets on each year's income. Your retirement answer: ...". The fold code is L2's (blame:
  c42c2e5) and the notice with the answer is L6's (P7), so each part went to its own L. Tests: tests/levers.test.mjs "F3 (the
  final review ...)" (L2) and the P7 test of tests/levers-before.test.mjs extended (L6); both fail on the old view.

## F4 (L4, judged by where the lines are now): the card's folds hold the person's numbers silently
- The tail fold's line now counts the person's own rows in it in the hero line's words: "N more numbers, M you gave us"
  (Jamie with growth 6% and prices 3.5% saved on an earlier visit: growth, prices and what goes into the 401(k), "6 more
  numbers, 3 you gave us" on the phone). The card folded on track says "1 not counted" in place of
  "12 numbers" when it holds a row not counted yet (the family's left-over). Not "you changed": the hero already counts the
  person's rows as "you gave us" ("4 you gave us"), and a row tagged Yours is that, whether typed (Social Security) or moved off
  our usual figure (growth); the fold uses the same words so the two counts read as one.
- Not folded-card-left-open: the leftover row's hint is on screen in the hero for the family ("$3,884 left over ... not counted
  yet"), so naming it in the folded card's line meets rule 4 without making the on-track page longer.
- Which L: the finding names L2, but the tail fold's line was last written by L4 (blame b8aeefe) and the folded card's line is
  L2's unchanged since; one fixup into L4 changes both without a conflict, and L4 is the commit of the Not counted left-over
  row. Test: tests/levers-leftover.test.mjs "F4 ..." (fails on the old view). The P21-era regex in tests/levers-before.test.mjs
  (L6) now allows ", N you gave us".

## Commits
- Fixups made: bb7ea87 (L6: F1, F2, F5), 63916e7 (L5: F6, F3 B), d363072 (L2: F3 A fold), 92c5ef5 (L4: F4), 8397505 (L6: F3 A
  notice, tests); after the whole npm test, one more on L6 (the limit check exact again, the F2 test and README to match), then
  `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash 707355c` again (only L6 changed) and the L6 message's F2 words amended.

## Rebase (one commit per L)
- `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash 707355c` (pre-rebase tip 8397505 saved in rv/ret/fixf/pre-rebase.sha).
  Conflicts, all from tests appended at the end of files that later Ls also append to: tests/levers.test.mjs at L2, L3, L4 and
  L5 (each resolved to that L's own file plus the F3 test at the end), the projection README at L4 and L5 (the F4 bullet, then
  L5's section).
- Found and mended on the way: L5 (310f16f) deleted tests/levers-leftover.test.mjs and L6 added the same 178 lines back (a slip
  of an earlier split: the two copies are byte-identical). L5 now keeps the file (L4's tests pass at L5: 41 of 41 with the
  levers and assumptions tests) and L6 no longer adds it.
- The final tree is byte-identical to the pre-rebase tip (tree hashes equal), and each rebuilt commit's tree equals the
  autosquashed one's.
- Each message gained one paragraph, "The final review (2026-11-13): ..." (L2, L4, L5, L6), above the three trailer lines
  (Agent / Co-Authored-By [model] / Claude-Session), which every commit ends with exactly. rv/ret/L*.msg now hold the messages.
- Chain after the first rebase: L2 728ccec, L3 e4464ef, L4 42dab5d, L5 01ce3e5, L6 3577909 on 707355c. Final chain (L6 redone
  for the exact limit check): L2 728ccec, L3 e4464ef, L4 42dab5d, L5 01ce3e5, L6 850ca03.
- CHANGELOG lines updated: rv/ret/L2.changelog ("which says "1 to save" ..."), L4 (the folds' lines), L5 (Assumptions from the
  menu), L6 (the answer after a change on a row with a pay-the-tax-now partner). L3's is unchanged.

## Checks (final tip 850ca03)
- `npm run registry`: 161 modules, no change to modules/registry.js.
- Touched tests at each commit (every test file the track touched by then plus the module tests of every folder it touched,
  rv/ret/fixf/percommit.sh in a scratch worktree, since removed): L2 728ccec 109/109, L3 e4464ef 134/134, L4 42dab5d 151/151,
  L5 01ce3e5 162/162, L6 850ca03 248/248 (12 files). Logs: rv/ret/fixf/percommit-L2-L5.log, percommit-L6.log.
- tests/tax-split.test.mjs, tests/golden-retirement.test.mjs and the contributions and benefits module tests together: 12,882
  pass, 0 fail.
- The whole `npm test` (rv/ret/fixf/npm-test-final.txt): 189,485 tests, 188,843 pass, 2 fail, 0 cancelled, 3 skipped, 637
  todo (the answer keys' known TODO rows). The 2 are the speed tests ("takes well under 1.5 s",
  modules/transactions/ledger; "200 times in under 600 ms", tests/estimate-perf), each passing when run alone right after. The
  25 golden retirement/contributions failures of the run before (the tolerance, F2 above) are gone.
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,887 files (the commit hook's staged run passed on each
  commit too).
- tests/golden/**: 0 lines changed against 707355c. Nothing in another lane: no change to the projection or setup compute, the
  guess estimators, claude-f's or claude-a's folders, wave 1's files, investments/holdings, CHANGELOG.md, docs/TEAM.md,
  docs/WORKBOARD.md or modules/registry.js.
- Every L is one commit on 707355c and ends with the three trailer lines; rv/ret/L2.msg to L6.msg equal the commit messages.

## On the phone (Chromium, the kit, the sandbox, port 9711; rv/ret/fixf/walk.mjs, logs walk-390.log, walk-320d.log,
## walk-320.log, walk-390d.log; pictures rv/ret/fixf/shots/)
Every finding walked by its own steps at 390 light and 320 dark (and the main ones at 320 light and 390 dark); no sideways
scroll and no page or console error in any run.
- F1: Dana's row and Casey's `?add=` landing, "Change ›": the opened part is [DIV, P] (no text node), no "null" anywhere on
  the page, the plan unchanged by the tap (F1-dana-390.png, F1-dana-320.png, F1-casey-320d.png).
- F2: Some of each 4% + 2%, Work benefits "Use 31.4%": rows $1,911.66 + $130 a month = $24,499.92; Contributions shows
  "$24,500 of $24,500", a green bar, "$0 of room left", no "over" anywhere. Walked again on the final code (exact limit check,
  rewalk-f2.mjs, which starts and stops its own server on 9711) at 390 light and 320 dark: the same rows and words, no sideways
  scroll, no errors (F2-limit-390.png, F2-limit-320d.png; rewalk-f2-390.log, rewalk-f2-320d.log).
- F3 A: "More settings ... as usual", 85 typed, fold closed: "1 to save"; Save: stocksNow 0.85 and "Retirement settings saved:
  share in stocks now 70% → 85%." (F3A-closed-390.png, -320d.png).
- F3 B: `?show=returnStocks`, the 4% chip under "All the numbers", fold closed: "All the numbers 9 more, 1 to save", the line
  under Save "Save keeps this number and what you changed under "All the numbers"."; Save: inflation 0.04, returnStocks 0.07,
  review date untouched, "Saved: prices rising 3% → 4%. Your retirement answer: now runs out at 68 (was 70)." (F3B-closed-390.png,
  -320d.png, F3B-saved-390.png). The plan unchanged until Save.
- F6: from the menu: two boxes outside the fold (inflation, stocks), one filled button "Save", "All the numbers 8 more"; page
  1,620 px at 390 (was 2,468), 1,812 at 320; opening the fold: all ten, "Save and mark as reviewed", plan unchanged; closing:
  "Save" again (F6-menu-390.png, F6-menu-full-390.png, F6-menu-390d.png). On the first screen at 390 the hero, the review
  notice and the two figures' card start: the inflation box is on it, the stock box just under.
- F4: Jamie with 6% and 3.5% on an earlier visit: "6 more numbers, 3 you gave us" (growth, prices and what goes into the
  401(k)); the family: "What this answer rests on · 1 not counted" (F4-jamie-closed-390.png, -320d.png, F4-family-390.png,
  -320d.png).
- F5: Jamie (match never asked), Pay the tax now, then the card's "Check the match ›", 2040, Save: "Saved: Jamie's employer adds
  $2,040 a year (on the pay-the-tax-later row). Your retirement answer: now runs out at 75 (was 71)."; the projection then says
  "before your change: runs out at 71. Now: runs out at 75" (said = done) (F5-jamie-390.png). Dana 270/130 raised to 470:
  "Saved: $470 a month paying the tax later (with the match), $130 a month paying it now. Your retirement answer: lasts to the
  end, with about $112,000 more left at 97 (today's dollars)."
- The server on 9711 stopped by its pid (wrapper 22787, child 22860); nothing else touched.

## Only Chromium: try on the real iPhone (Safari)
1. Contributions, a row at work, "Change ›": the three answers and the rule of thumb, no stray word under them (F1).
2. Retirement settings: type in "Share in stocks now" under "More settings", close the fold: its line reads "1 to save" (the
   `input` event from Safari's number box, F3).
3. Assumptions `?show=returnStocks`: a chip under "All the numbers", close it: "9 more, 1 to save" and the line under Save (F3);
   Safari's own `<details>` toggle event turns Save into "Save and mark as reviewed" and back.
4. Assumptions from the menu at 320 and 390: two numbers, "Save", "All the numbers · 8 more" (F6); the keyboard over the stock
   box keeps Save reachable.
5. Work benefits "Use 31.4%" after a split, then Contributions: no amber over-limit line (F2).
6. "Check the match ›" on a Roth 401(k) row, 2,040, Save with the keyboard up: the notice in view with its answer (F5).
7. The folds' lines at 320 ("1 not counted", "6 more numbers, 3 you gave us"): no line runs off the right edge in Safari.

## Not in this round
- F7 and F8 of final.md (severity 1: "Go deeper" is five links; Some of each's total said only on `change`) are not among the
  six the task names; left as they are.
