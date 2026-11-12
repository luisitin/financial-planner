# Track "doc": the two L commits moved onto 7297bfb

Worktree: `$SP/rv/b-doc` (detached HEAD, nothing pushed).

## Before

- `git status`: clean. No `rv/doc/fix-1.md`, no interrupted work, nothing stashed or discarded.
- On fa2026e: L7 `aaed872` (Document reader: a pay stub fills and checks the 401(k), Roth part and match) and
  L8 `6ce1c29` (Import: the bank's Quicken or QuickBooks file). Backups of both as patches in `rv/doc/rb/pre/`.
- Files both sides changed since fa2026e: only `docs/DATA_MODEL.md` (115 files changed upstream, 15 by this track).

## The rebase: `git rebase --onto 7297bfb fa2026e`

| L | old sha | new sha | result |
|---|---|---|---|
| L7 | aaed872 | **d2ade9e** | one conflict, settled by hand (below) |
| L8 | 6ce1c29 | **72299e5** | applied clean (its `transactions` and `imports` rows of DATA_MODEL.md merged by git) |

One commit per L, messages and trailers unchanged (`Agent: claude-b`, `Co-Authored-By`, `Claude-Session`; L8 keeps
`Prompt: quick-ofx-import` just above `Agent:`). `git range-diff` shows L8 identical and L7 differing only in the one
DATA_MODEL.md row. Diff size against the base is the same before and after: 15 files, +1256 -76.

### The one conflict: `docs/DATA_MODEL.md`, the `retirement` row (line 47, one 5,000-character line)

- The tip's side (claude-c, cb820f2): adds `spendingFrom?: "expenses"` and `leftover?: { rowId }` to the row.
- L7's side: two phrases inside the `employerPlans` / `workPlans` text of the same row:
  "..., and the Document reader when a pay stub's employer match is used, 2026-11-11" and "the Document reader also
  writes true when a pay stub's 401(k) or Roth 401(k) money going in is used, 2026-11-11".
- Settled by keeping BOTH: the tip's row, with L7's two phrases put in at the same two places
  (`rv/doc/rb/resolve47.mjs`; the script first proves that those two edits are all of L7's change to the row, and that
  each anchor occurs exactly once in the tip's row). Lengths: base 4,789, tip 5,850, L7 4,980, merged 6,041
  (= 5,850 + 191). `leftover?: { rowId }` is in the row once: claude-c's entry stands as it is; this track adds no
  second one.

No other file conflicted. No code of another builder was changed or dropped. Nothing upstream touches
`modules/ai/reader`, `modules/transactions/import`, `modules/transactions/connect`, `core/ofx.js`,
`tests/ofx.test.mjs`, `docs/MODULE_CATALOG.md` or `docs/RESOURCES.md` (all identical to before the rebase).
Upstream changes the track's code leans on were read: `core/schema/migrate.js` (adds `tooNew`, nothing removed),
`core/store.js`, `tools/check.mjs` (hook modes), `sw.js` (no file list to add `core/ofx.js` to).

## After

- `npm run registry`: 161 modules, no change to commit.
- Touched modules' tests: `modules/ai/reader` 15/15, `modules/transactions/import` 14/14, `tests/ofx.test.mjs` 14/14
  (`transactions/connect` has no test file of its own).
- WHOLE `npm test`: **189,430 tests, 188,790 pass, 0 fail**, 3 skipped, 637 todo, 225 s (log:
  `rv/doc/rb/npmtest.txt`). The two speed tests did not flake. The 3 skips (two sweep cases "not reached by these
  households", esbuild not installed) and the 637 todo (other lanes' slips, claude-a's) are not this track's.
  Before the rebase, on fa2026e: 189,285 tests, 188,643 pass, 0 fail.
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,881 files.
- `tests/golden/**`: unchanged (same tree hash as 7297bfb, `git diff --quiet 7297bfb HEAD -- tests/golden`).
- Working tree clean after all of it.

## Phone walk, 390 px, sandbox (`rv/doc/rb/walk.mjs`, pictures and log in `rv/doc/rb/shots/`)

Nothing broke in the merge. No page error, no console error, no sideways scroll on any screen; the results match the
walk from before the rebase line for line.

- L7, Casey (light): Document reader landing (one filled "Read it") -> pay stub pasted: 9 of 9 found, five proposals,
  one filled "Use it" at a time, each "Use it" confirms on screen ("... saved. What you save for retirement shows
  it."; "1 of our guesses moved with it"). Plan after: 401(k) $110.77 every two weeks with $2,880 match, a new Roth
  401(k) account at $0 with $55.38 every two weeks, `workPlans` plan and match true, account number 6789 nowhere.
  Same stub again: 0 "Use it", all "Already on file". Then on the new tip's pages: What you save for retirement
  "$7,200 a year ($4,320 of your own money and $2,880 from employers)"; Will the money last? (claude-c's new code)
  draws with "Added each year until retirement $7,200"; Dashboard draws.
- L7, Lee of Dana & Lee (dark): "Whose" lands on Lee, 8 of 9 found, Roth-only stub offers "401(k), pay the tax later:
  none on this stub", four "Use it" each confirmed; Will the money last? draws; 4321 nowhere.
- L8, family (light): Import start (no filled button before a file) -> the checking `.qfx`: "No columns to check. The
  account number is not kept.", Chase checking picked, filled "Import 10 transactions", balance tick -> lands on
  Categorize with the notice; 10 lines with the bank's ids, balance $4,512.36 as of 11/12/2026, file name stored as
  `PrairieXXXX_Activity.qfx`, no account number kept. Same file again: "Everything in this file is already on file",
  no Import button. Two-account file: both offered, one at a time. Connect page and Transactions draw.
- L8, card `.qbo` (dark): Visa card picked, filled "Import 5 transactions".
- The census note "Use the pasted text: covered by span#page-title; under the top bar" appears after a file is picked,
  exactly as in the walk before the rebase (the page has scrolled to step 3, so that button sits under the sticky top
  bar at that scroll position; not from the merge).

Servers started on ports 9741 and 9742 were stopped by the scripts; nothing was killed by pattern.

## Not done here (unchanged from the build)

Only Chromium is installed. Still to try on the real iPhone: the file picker for `.qfx` / `.qbo` / `.ofx` from the
Files app and from a bank's site in Safari (the file chooser's accepted types), "Pick a text file" on the Document
reader, and pasting a pay stub copied from a PDF in Safari.

## Note for the integrator

While this ran, the shared checkout moved three commits past 7297bfb (a58b4fd, 737fb6a, 707355c: main gate wording,
a design rule, workboard). None of them touches a file of this track, so a later move onto that tip should apply clean.
The CHANGELOG lines are unchanged: `rv/doc/L7.changelog`, `rv/doc/L8.changelog`.
