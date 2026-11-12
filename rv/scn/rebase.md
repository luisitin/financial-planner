# Track scn: rebase onto 7297bfb (2026-11-12, builder claude-b)

Worktree: $SP/rv/b-scn (detached HEAD)
Before: d540ebb (L1) on fa2026e, with uncommitted work in 14 files. After: **4bc50d5** (L1) on 7297bfb. One commit, as before.

## 1. The uncommitted work found (an interrupted fix round 1)
- `git status` was not clean: 14 modified files (910 insertions, 185 deletions) in scenarios/goal-seek, scenarios/sensitivity,
  estate/legacy and the Sensitivity row of docs/MODULE_CATALOG.md. No `rv/scn/fix-1.md` existed (the report was never written).
- A copy is saved as `rv/scn/interrupted.diff` (1,618 lines) whatever was decided.
- Judged **complete**, and folded into L1 (one commit per L), on this evidence:
  - the fix builder had already rewritten `rv/scn/L1.msg` and `rv/scn/L1.changelog` (02:52) to describe the folded commit;
  - its own sweep over 1,423 qa plans finished one minute later (`rv/scn/fix1/sweep-{0..3}.log`: all four shards "done") with
    0 throws, 0 "typed as said and still short", 0 over the 401(k) limit, 0 claim-card mismatches, 0 "room to spare" on a
    short plan, 0 bad headlines, 0 usual-saving rows over a limit or for a person under 16, 0 return items on Legacy goals;
  - every critic finding in this lane has a test named after it (P1, P5, M1/P2, M3, M5 twice, B1, B2, B3, B4, B5) and the
    READMEs record M2, M4, P3, P4, P7, B6, B7; no TODO/FIXME left in the diff; the seven touched .js files parse;
  - before folding: the three touched modules' tests 45 of 45 pass, `npm run registry` leaves nothing changed,
    `npm run check` OK, `node tools/leak-guard.mjs --worktree` OK.
- What the fix round had NOT done, now done here: the commit itself, the whole `npm test`, the phone walk (sections 3, 4).
- Out of this lane and left alone, as the critics filed them: P6 (typing in "Find a page" enters letters backwards:
  core/app.js, wave 1), the engine half of M5 (spending depends on the stop year: claude-c).
- Still open from the critics, in this lane: P8 (severity 1): What matters most still ends with an outlined "Assumptions"
  button under "Read it like this". The fix round did not record it; it is not built here either (this job was the rebase only).

## 2. The rebase: `git rebase --onto 7297bfb fa2026e`
- **No conflict.** None of the 18 commits fa2026e..7297bfb touches a file this track touches (checked with
  `git diff --stat fa2026e 7297bfb -- docs/MODULE_CATALOG.md modules/estate/legacy modules/scenarios/goal-seek
  modules/scenarios/sensitivity`: empty). Nothing of claude-c's, claude-e's, claude-f's or claude-h's was dropped or edited.
- docs/DATA_MODEL.md: not touched by this track (L1 has no schema change), so claude-c's `retirement.leftover.rowId` entry
  stands alone, as it is.
- The commit touches the same 14 files as before; `tests/golden/**` unchanged (`git diff --stat 7297bfb HEAD -- tests/golden`: empty).
- Merge in meaning, checked by running what the three pages say on the five phone-built households, three break plans and the
  family, before the rebase (fcb31bb, the folded commit on fa2026e) and after (`rv/scn/rebase/said-pre.txt`, `said-post.txt`,
  318 lines each): **one line differs**. Dana & Lee's "what could come out of savings today" reads $88,850 where it read
  $79,700. The same change shows between the two bases without this track's commit (`lump-base-old.txt` vs `lump-base-new.txt`),
  so it is claude-c's engine work arriving (cb820f2), not this track. Every figure quoted in the commit message and the READMEs
  (Jamie 10.4% against 5.8%, forecasts 4.9%-6.5%; Casey $790 a month, $2,690 of $3,090, "$400 a month + $240 match: $2,950",
  $2,720; Jamie's claim card 2050 against 2052) is unchanged.

## 3. Tests on the rebased commit
- `npm run registry`: 161 modules, nothing to commit.
- Touched modules (goal-seek, sensitivity, legacy): 45 tests, 45 pass, 0 fail.
- Whole `npm test`: **189,420 tests, 188,780 pass, 0 fail**, 0 cancelled, 3 skipped, 637 todo (the answer keys' open items, not
  this track's), exit 0, 413 s. Neither speed test flaked. Output: `rv/scn/rebase-npm-test.txt`. Run on 315081b; the final
  4bc50d5 is the same tree (e83c728) with one trailer line added.
  (Before the rebase, on fa2026e: 189,269 tests, 0 fail; the 151 more are the other builders' new tests.)
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (2,879 files). `--commits 7297bfb..HEAD` (files, message,
  identity): OK. The pre-commit hook now runs in this checkout (upstream made it executable) and passed.

## 4. Phone walk after the merge (kit, sandbox, own server on port 9963, stopped; 9741 belonged to someone else and was left alone)
Script `rv/scn/rebase/walk.mjs`, shots and page text in `rv/scn/rebase/shots/`, results in `shots/report.json`. 20 screens:
- Goal seek at 390 px: Casey, Jamie, Robin, Dana & Lee, Morgan, the retired couple, Sam, the renter with debt, the family;
  Casey again at 320 px dark.
- What matters most at 390 px: Casey, Morgan, Dana & Lee, Sam, Casey with an empty 401(k), the renter with debt, the family;
  Casey again at 320 px dark.
- Legacy goals at 390 px: Jamie with a $20,000 legacy, the family.
Every screen: no page error, no console error, nothing off the side, no control under 44 px, no NaN/undefined, none of the
words build, PC, AI, sync or server. Taps: "Which of your numbers matter most? ›" opens What matters most and Back returns to
Goal seek (8 households); "Add what you own ›" on the gate opens Net worth and Back returns (3). Looked at: Casey's Goal seek
(grey return line, $790 into Casey's plan at work, the link under it), Casey's What matters most (saving row in dollars),
Jamie's Legacy goals (five changes, no return item), Sam's gate ("We don't know yet", one filled button).
Seen, not a merge effect: at 320 px in the sandbox the top bar shows "What matters ..." (the Sandbox pill takes the room; the
fix round's own report had the same). To try on the real iPhone, where there is no pill.

## 5. For the orchestrator
- Trailers: the commit keeps "Agent: claude-b", "Co-Authored-By: Claude Opus 5.5" and the Claude-Session line, and has one
  more line, "Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>", just above Claude-Session: this session's attribution
  rule asks for it on commits made from here on, and this session folded the fix round into the commit. If the workflow
  wants exactly three trailer lines, drop that one line with `git commit --amend` (the tree does not change).
- `rv/scn/L1.msg` is the commit's message as committed; `rv/scn/L1.changelog` is its CHANGELOG line (the fix round's text,
  still right).
- A stash exists in the shared repository ("WIP on (no branch): 9e7d1c0 tmp"); it is not this track's and was not touched.

## Try on a real iPhone (no Safari here)
- What matters most at 320 px: does the whole title fit in the top bar without the Sandbox pill.
- Goal seek: the grey return line's wrapping and contrast; the outlined "Which of your numbers matter most? ›" under it.
- What matters most: the bar labels "nothing: $2,340" and "$400 a month + $240 match: $2,950" at 320 px.
