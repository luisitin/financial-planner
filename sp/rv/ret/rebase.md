# Track ret: rebase onto 7297bfb (2026-11-12, builder claude-b)

Worktree: $SP/rv/b-ret (detached HEAD)
Before: 1942862 on fa2026e = L2 4284fd5, L3 be77621, L4 d5b9e86, L5 0bd4a09, L6 71ff05a, plus one commit
`fixup! "What this rests on" on Will the money last?` (1942862, no body, no trailers), plus uncommitted work in 5 files and
one untracked test. After: five commits on 7297bfb, one per L:

| L | before | after | what changed in it |
|---|---|---|---|
| L2 | 4284fd5 | **6ae870e** | README conflict settled (both kept); message as it was |
| L3 | be77621 | **acf339c** | nothing (range-diff "=") |
| L4 | d5b9e86 | **f9d7709** | DATA_MODEL conflict settled (one entry), two README bullets, test header, a merge note in the message |
| L5 | 0bd4a09 | **f109d56** | nothing (range-diff "=") |
| L6 | 71ff05a + 1942862 | **d4f8a01** | the fixup commit folded in, a paragraph for it in the message; no content change |

Tip: **d4f8a01**. `git -C .../rv/b-ret log 7297bfb..HEAD` lists exactly these five.

## 1. The uncommitted work found (an interrupted fix round 1): judged NOT complete, saved, discarded
- `git status` was not clean: `modules/retirement/contributions/view.js`, `contributions/module.test.mjs`,
  `modules/retirement/levers.js`, `modules/retirement/projection/view.js`, `tests/levers.test.mjs` modified (150 insertions,
  39 deletions) and `tests/levers-saves.test.mjs` untracked, last written 02:49 to 02:54. No `rv/ret/fix-1.md` exists.
- Saved first, whole, as `rv/ret/interrupted.diff` (441 lines, 6 files, the untracked test included; byte for byte the tracked
  part equals the critics' `rv/ret/person2-wip.diff`). The test alone is also at `rv/ret/interrupted-levers-saves.test.mjs`.
  Then `git checkout -- .` and the untracked test removed. Nothing was stashed (the one stash in the shared repository,
  "WIP on (no branch): 9e7d1c0 tmp", is not this track's and was not touched).
- Why not complete (so not committed into an L commit):
  - It holds a defect the break critic measured on that very copy and marked "Fix before it is committed" (critic-break.md N8,
    severity 3): `holdTaps()` on a tapped row of Contributions lets the next chip tap and Save go for 1 to 2 s; Save then keeps
    the old answer. HEAD does not do this.
  - F2 is half done (critic-person.md P2: the match is kept as our guess, the note is still off screen, the $396 still
    becomes "Yours" in one tap). F5's `turned` option is written and tested in levers.js but no view calls it.
  - No README line, no CHANGELOG line and no commit message for any of it (AGENTS rule 3 and the track's rule: every
    decision in the README); the last file written is a test, one minute after a probe script (`fix1/t-spend.mjs`).
- What the round-2 critics ask to keep from it (for the fix round; all still in `interrupted.diff`):
  `matchTakesBackNo` and the `answered` filter (F4 / P9), Casey's match asked and kept as our guess (F2 / P2), Retirement
  settings' save notice with the answer before and after (F3 / P7), the average-market words in `answerChangeWords` (F5).
  Not to keep as written: `holdTaps` on Contributions (N8).
- `git apply --check rv/ret/interrupted.diff` passes on the new tip d4f8a01 (checked, not applied), so the fix round can
  take hunks from it as they are.

## 2. The fixup commit: folded into L6
- `fixup! "What this rests on"` (1942862: levers.js, projection/README.md, projection/view.js, new
  tests/levers-before.test.mjs; 272 insertions, 31 deletions) names L2. Folding it there (`rebase -i --autosquash`) was tried
  on the old base and stopped with conflicts in levers.js and projection/view.js (7 regions): the fix was written on top of
  L6 and edits the left-over row L4 built and the tax line L6 built. A hand split across five commits would rewrite each of
  them for no change in the result, and a partial fold leaves L2 importing names that do not exist yet. Aborted.
- So it is folded into the tip, L6, where it applies as written: `git reset --soft 71ff05a`, `git commit --amend`.
  The tree is the same before and after the fold (4a425ed). L2 to L5 stay the commits their builder tested.
- L6's message has a new paragraph "Review round 1 (2026-11-12), kept in this commit because it reads the left-over row and
  the tax line the steps before it built" (B6, F5, F3, B4, B8, the test file, the README section).

## 3. The rebase: `git rebase --onto 7297bfb fa2026e`
Upstream fa2026e..7297bfb touches two files this track touches: `docs/DATA_MODEL.md` and
`modules/retirement/projection/README.md` (cb820f2 left2, ee09f6e, 5614682). Two conflicts, both settled by keeping both sides.

1. **L2, `modules/retirement/projection/README.md`.** Both sides added text at the end of the file: claude-c's "A typed
   leftover is not added", "Left2 merge" and "Left2 fix round" sections (59 lines), this track's "What this rests on" (89
   lines). Kept both, claude-c's first (it landed first), one blank line between. Checked: against 7297bfb the file has 0
   removed lines, and the added lines are exactly L2's.
2. **L4, `docs/DATA_MODEL.md`**, the `retirement` row (one long line). claude-c had added `spendingFrom?` and
   `leftover?: { rowId }` ("read by left2 merge B3, not written yet"); L4 added `leftover?: { answer, on, monthly, rowId? }`.
   Now **one** `leftover?` entry, at claude-c's place in the line, with L4's full shape and both builders' facts: written by
   Will the money last?'s card (`levers.js applyLeftover`), and "the one reader is retirement/projection's compute: while
   `rowId` is set, Will the money last? no longer says that a typed leftover is not added (left2 merge B3, claude-c)".
   claude-c's `spendingFrom?` entry and the rest of the line are untouched (replacing the merged entry by claude-c's old one
   gives 7297bfb's line back, asserted in the script).
3. **Merge in meaning, same commit (L4).** L4 said "no page's compute reads it". That is no longer true in words:
   - projection/README.md "Builder's choices": "reads it for a figure", plus a bullet for the one reader (an "invested" or
     "bank" answer writes the row, so claude-c's note goes; a "spend" answer has no row and the note stays; no figure moves),
     plus a bullet for the spending row (item 5 below);
   - the header of `tests/leftover-invariance.test.mjs` says the same and names claude-c's test; its assertions are unchanged
     and pass (2 of 2, 112 s);
   - L4's message: the bullet now reads "for a figure" and a paragraph "Merged with claude-c's left2 on the rebase".
   `modules/retirement/projection/compute.js` (claude-c's) is not edited.
4. L3, L5 and L6 applied without conflict.
5. **What moved on screen because of the merge** (run before and after on the five phone-built households, the family and
   the 14 qa households' base plans: `rebase/said.mjs`, `said-pre.txt`, `said-post.txt`, 481 lines each):
   - every retirement answer is the same on all 20; every row of the card is the same except **Spending in retirement** on 7
     of the 14 qa households. Since claude-c's B1 a figure typed over today's bills keeps the loans those bills hold, so
     "10% less" no longer comes out worse: the effect line shows where it was hidden (02, 04, 05, 09, 12; for example
     "$4,977 a month (10% less): runs out at 73.") and is a year or two better on 07 and 11, which moves the row up there
     (hidden to folded, hidden to shown). No spending row is without its effect line now (5 before). The hide rule stays as
     a guard. The five phone-built households and the family read the same line for line.
   - on the phone (section 5): 38 of 40 screens have the same text before and after; the two that differ gain one line,
     claude-c's new note "You said about $500 a month is left over. That stays in checking and savings and is not added ...",
     on a Jamie with a typed left-over. After the left-over is answered "Invested for later" on the card the note is gone
     (B3 with L4's row, seen on screen).
- Same 23 files as before the rebase; `tests/golden/**` unchanged (`git diff --stat 7297bfb HEAD -- tests/golden`: empty).
- `git range-diff fa2026e..7de7ab0 7297bfb..HEAD`: L3, L5, L6 "="; L2 differs in the README hunk's context only; L4 by
  the edits of items 2 and 3.

## 4. Tests on the rebased commits
- `npm run registry`: 161 modules, nothing to commit (at every one of the five commits).
- Touched modules' tests (tests/levers, levers-before, tax-split; retirement/contributions, retirement/projection,
  system/assumptions, career/benefits, cashflow/paycheck), run at each commit: L2 165 of 165, L3 173 of 173, L4 178 of 178,
  L5 182 of 182, L6 198 of 198 pass (`rebase/touched-*.txt`). `tests/leftover-invariance.test.mjs` 2 of 2.
- Whole `npm test` on d4f8a01: **189,454 tests, 188,814 pass, 0 fail**, 0 cancelled, 3 skipped, 637 todo (the answer keys'
  open items), exit 0, 271 s. Neither speed test flaked ("takes well under 1.5 s" ok, "200 times in under 600 ms" ok).
  Output: `rv/ret/rebase-npm-test.txt`.
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (2,885 files). `--commits 7297bfb..HEAD`: OK (42 files).
  The pre-commit hook runs in this checkout since the rebase (upstream made it executable) and passed on L4's amends.

## 5. Phone walk after the merge (kit, sandbox, 390 px; one screen at 320 px dark)
Script `rv/ret/rebase/walk.mjs`; the rebased worktree on port 9773 (`rebase/shots-post/`, `walk-post.log`) and, for comparison,
the tree before the rebase (a `git archive` of 1942862 in `rebase/pre`) on port 9774 (`rebase/shots-pre/`). Both servers
stopped by the kit; nothing answers on either port. `planner.properties` in the worktree (git-ignored) is back at port 9771.
40 screens, no step failed:
- Will the money last?, the hero and then the card open: Jamie, Casey, Dana & Lee, Robin, Morgan (phone-built), Sam, the
  renter with debt, the family.
- Jamie: "Check the match ›" lands on "Employer adds, a year" (focused, the note right over it); 2,040 saved: "Contribution
  saved. Your retirement answer: now runs out at 74 (was 70)."; Back: the card's green notice "If markets do as well as
  average, before your change: runs out at 70. Now: runs out at 74. You changed the match at Jamie's job (none → $2,040 a
  year)." and the row first with "You just changed this".
- Casey: "Type what goes in ›" opens the row filled in; saved: "now runs out at 88 (was 67)"; Back says it.
- Jamie with a typed left-over of $500: the Dashboard reads $567 left over; the card's "Answer", "Invested for later", $560,
  "Save my answer": "Saved: $560 a month into Investments for later (a new account at $0, on Net worth). Your retirement
  answer: now runs out at 89 (was 70)."; What you save for retirement lists the row; the Dashboard then reads $7 with
  claude-c's sentence "About $80 a year builds up in checking and savings, and $9,700 more goes into retirement."
- Dana & Lee: the row at work, "Some of each", 2% now: two rows saved ($400 with the $2,400 match, $130 into "Dana's Roth
  401(k) at work"), the notice with the mix (90% pay-the-tax-later, 8% Roth, 2% regular savings); Paycheck and Work benefits
  open after it; Will the money last? after it.
- Jamie: Assumptions, "Careful 6%", "Save and mark as reviewed": "now runs out at 69 (was 70)"; Back: "Before your change"
  with "You changed how fast investments grow (7% → 6%)".
- Casey at 320 px dark: the hero and the card.
Every screen: no page error, no console error, nothing wider than the screen, no NaN/undefined/null in the text, none of
the words build, PC, AI, sync, server. Looked at (PNG): Jamie's hero, the match landing, Back after the match, the
left-over question open, Dana's split saved, Back from Assumptions, Casey 320 dark.
Seen, not merge effects (the same before the rebase):
- the kit's census flags a control "covered by the page title / under the top bar" on 13 screens: after the page was
  scrolled a link or box sits under the fixed top bar; nothing is covered where a thumb is. The same flags, notices and
  filled buttons on every screen before and after the rebase (`report.json` of both runs compared: 0 records differ).
- "Your next move: Get life insurance on Dana and Lee ›" on Contributions is 42 px high (not this track's link).
- after "Save and mark as reviewed" the hero counts "6 you gave us" (the critics' open P14).
- on my Jamie with a typed left-over, claude-c's note says "$500" and this track's line under it says "the $567 left over":
  that is my test plan (I set the typed figure without moving the bills). But the two lines do sit one over the other and
  both speak of the left-over; worth a look by the person critic once both builders' work is on one branch.

## 6. For the orchestrator
- **Not done here, on purpose** (this job was the rebase only): no critic finding of round 2 was fixed. critic-person.md,
  critic-money.md and critic-break.md were written against 1942862, whose content is the new tip's but for section 3; they
  all stand. Their "uncommitted work copy" columns refer to `interrupted.diff`, which is no longer in the worktree.
- **Trailers.** L2, L3, L5 keep exactly "Agent: claude-b", "Co-Authored-By: Claude", "Claude-Session". L4 and L6,
  the two commits this session made with `git commit --amend` (the merge note, the fold), have one more line,
  "Co-Authored-By: Claude <noreply@anthropic.com>", just above Claude-Session, as this session's attribution rule
  asks and as track scn did. To have exactly three lines, drop that line with an amend (the trees do not change).
- **Messages and CHANGELOG lines.** `rv/ret/L4.msg` and `L6.msg` are now the messages as committed (the old ones:
  `rebase/L4.orig.msg`, `rebase/L6.orig.msg`). The five `L<n>.changelog` lines are unchanged and still true. L6's line does
  not mention the review-round fixes folded into it (they refine what L2's line already says: "coming back after a change
  says Before your change ... Now ...").
- **The branch moved again**: its tip is 707355c (a58b4fd, 737fb6a, 707355c after 7297bfb). Those three touch none of this
  track's 23 files and a trial merge of d4f8a01 with 707355c has no conflict; I rebased onto 7297bfb as told.
- One thing for claude-c, not edited (his lane): projection/compute.js hides the typed-leftover note on
  `retirement.leftover.rowId` alone. L4 removes the answer with the row on Contributions; a row lost another way (its
  account removed) would leave `rowId` behind and the note hidden. levers.js `leftoverAnswer` already reads such an answer
  as never answered; the note could use the same test.

## Try on a real iPhone (no Safari here)
- Will the money last?: tap "Check the numbers behind this ↓" twice quickly; the second tap must follow no link (taps are
  let go for a second), and a tap after that second must work.
- Back from Contributions after a saved match: the green notice in the card is in view and the page does not jump.
- Contributions from "Check the match ›": the keyboard comes up with "Employer adds, a year" and its note still on screen.
- The left-over question on the card: the three chips wrap without clipping at 320 px; "Save my answer" stays above the
  keyboard.
- The split's notice with the mix (seven lines at 390 px): readable, and it does not cover the row it is about for long.
- Will the money last? at 320 px: the title is cut to "Will the mone..." in the sandbox only because of the Sandbox pill.
