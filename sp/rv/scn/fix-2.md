# Track scn, fix round 2 (builder claude-b, 2026-11-13)

Worktree: $SP/rv/b-scn (detached HEAD).
Before this round: 972b0b3 (L1 on 7297bfb). An earlier, interrupted run of this round had already rebased L1 onto 707355c
(707b12e, message with the three trailers) and left unsaved edits in eight files; this run judged them (section 2), finished them,
and folded everything into L1. After: **L1 = a8e0763** on **707355c**; `git log 707355c..HEAD` lists only it. Nothing pushed.
Scripts, outputs and pictures: $SP/rv/scn/fix2/
(`out/` the text outputs, `before/` and `after/` the 68-screen walks, `after-open/` the tap walk, `re/` the recheck's phone walks
re-pointed at this worktree). The "before" build for every comparison is `fix2/before-app`, a plain copy of 707b12e (its L1 files
compare byte-equal to `git show 707b12e:<file>`).

## 1. The confirmed findings of severity 2 or more (from fix-1.md's eighteen and re-check 1's new ones)

| id | sev | where it belongs | state at 707b12e (rebased) | this round |
|---|---|---|---|---|
| M1 | 5 | L1 | closed (re-check 1) | still closed: `out/c1-after.txt` = `re-c1.txt` (707b12e) byte for byte: $670 typed into Casey's 401(k) runs out in 2070, $790 lasts, the card then reads "just right" |
| P2 | 5 | L1 | closed | still closed (same output; said = done) |
| M5 | 4 | Goal seek's half L1, engine's half claude-c | L1's half closed; **engine half open** | L1's half unchanged (`out/c2-after.txt` = `re-c2.txt`). Engine half reproduced: Casey with $670 a month, retiring at 61 lasts, 62 to 65 run out, 66 lasts; What matters most still shows Dana & Lee "age 63: $6,618" against the plan's $5,278 (`out/c8-after.txt` = `out/c8-before.txt`). claude-c's `projection/compute.js`: not touched. |
| P1 | 4 | L1 | closed | still closed (`out/c3-after.txt` = `re-c3.txt`: 576 cards, 0 bad) |
| B1 | 4 | L1 | closed | still closed (the N1 sweep: 0 headlines with "$0", "by $0" or "nothing instead of nothing") |
| M2 | 3 | L1, last sentence L3 | closed here; Contributions' "common match" open | L1's half still closed (`out/c4-after.txt`). The sentence on Retirement contributions is L3's (ret track): not touched. |
| P3, P4 | 3 | L1 | closed | still closed (`out/c4-after.txt`) |
| B2, B3, B4 | 3 | L1 | closed | still closed (`out/c4-after.txt`; B3 now also in Goal seek's order, section 3) |
| P6 | 3 | wave 1, core/app.js | open | reproduced on this build (`re/w4-after.txt`): typing m-a-t-t-e-r-s gives "srettam", caret at 0 after each key. Not this lane. |
| N2 | 3 | claude-f (`overview/health-score`) | open | reproduced (`out/n2-after.txt`): the score says "save about $670 a month more", Goal seek "$790 ... into Casey's plan at work". **Not changed here, on purpose** (section 2). |
| M3, M4, P5, P7, B5 | 2 | L1 | closed | still closed (`out/c4-after.txt`; P7's link walked in `re/w4-after.txt`) |
| N1 | 2 | L1 | open | **fixed** (section 3) |
| N3 | 2 | wave 1 (the shell) | open | reproduced (`re/w8` output below): Back after "What matters most? ›" lands at the top in 7 of 10 tries. Not this lane. |
| N4 | 2 | L1 | open | **fixed** (section 3) |
| M2's last sentence | 2 | L3 | open | L3's (the ret track). |

Severity 1, also handled: N5 (fixed: module.js `purpose` and the catalog rows), N6 (fixed), N7 (fixed by the earlier interrupted
run's rebase: the message ends in exactly the three trailers; checked on a8e0763).

## 2. The unsaved edits found in the worktree, file by file
The earlier run stopped mid-round with edits in eight files (mtimes 00:33 to 00:44, after its rebase at 00:25 and its repro outputs
at 00:31). Each was read and judged:

| file | judged | why |
|---|---|---|
| `scenarios/sensitivity/compute.js` (N1: `MOVES`, `MEASURES`, `valueOn`, `moveOn`, `swingOn`, run-out fields, `measures`, `measure`, `runoutLine`) | **kept** | finished and right: the measures come from the run already made per setting; tested by hand and on every qa base household |
| `scenarios/sensitivity/view.js` (N1 rows, N6 `aboutOpen`, `SHOWN` 3) | **kept, completed** | the measure chips were still in the first view and the hero still opened with the method sentence; completed with the "Measure it another way" fold, the short hero, "to 66" labels, no repeated line (section 3) |
| `scenarios/sensitivity/module.test.mjs` | **kept, completed** | added the measure fold test, the hero and label checks |
| `scenarios/goal-seek/compute.js`: `firstLevers`, `FIRST_CARDS` | **kept** | finished; pure; tested |
| `scenarios/goal-seek/compute.js`: `savingInto` default "work" for every caller (N2) | **dropped** | it fails claude-f's pinned test `overview/health-score/module.test.mjs:228` ("save about $170 a month more" becomes $190: `fix2/t-neigh-0.txt`, run before the drop, 1 fail of 175). That test and the score's call are claude-f's files. The fix is one argument there (`savingInto: "work"`) plus their test's figure; a test here pins what that call returns. |
| `scenarios/goal-seek/module.test.mjs` | **kept, corrected** | the simple-first and N4 tests kept; the M1/P2 test's lines restored as they were; the N2 test rewritten to pin the opt-in call instead of the score |
| `scenarios/goal-seek/view.js` (More options, three cards, See each age, another rule's note moved, N4 CSS) | **kept, completed** | at 320 px "More options" and "2 more changes" were cut in two next to their lines: on a phone the line now goes under the title |
| `estate/legacy/compute.js` + `view.js` (Goal seek's order, three first, fold) | **kept, completed** | completed with the add form's note fold and a view test |

## 3. Fixed here (in L1; the commit's own files)

**N1 (severity 2): What matters most listed numbers that move nothing among those that matter most.**
- Reproduced at 707b12e with the recheck's own script (`re1/c6.mjs` with ROOT = before-app, output `out/c6-before-707b12e.txt`): of
  1,364 qa plans with rows, 567 show at least one row that moves nothing in the first view, 131 have a headline "X moves your plan
  the most" over a top row that moves it by under $5 a month, 176 have only the saving row moving (82 of them qa 01, 81 qa 10).
- Change: each row says which of three measures it moves (what can be spent a month, what is left at the end, how long the money
  lasts: the engine's own `failAge`), from the same `project()` run. The page lists only the rows that move the measure shown; the
  others are in the fold, "6.0% or 8.0%: no change here", with no bar. The page's measure is spending when anything moves it, else
  how long it lasts; a measure nothing moves is not offered; the headline names only a row that moves the measure ("None of these
  numbers changes the answer" when nothing does). A plan that can pay for no steady spending says when the money runs out ("As it
  stands the money runs out in 2048 (age 70), and the plan can't yet pay for any of the $3,035 a month it plans.") instead of
  "about $0 a month".
- After, on every qa plan (`fix2/n1sweep.mjs`, `out/n1sweep-after.txt`, today 2026-11-13): 1,423 plans, 1,364 with rows, **0**
  first views with a row that moves nothing, **0** headlines over a row that moves nothing or with "$0", **0** measures offered
  that move nothing, 0 throws, the plan never changed. Measures shown: spending 1,254, how long it lasts 106, the end 4; 21 plans
  where nothing moves anything.
- Tests: "fix round 2 (N1): a plan that pays $0 at every setting ..." (qa 01: one row first, seven "no change here", the chips,
  `moves` by hand, the engine's run-out age, the hero's words, the "How long it lasts" rows, caption and "to N" labels; qa "turns
  retirement age today": nothing moves, said once; `runoutLine`'s four cases), "fix round 2 (N1): on every qa base household ...".
- On the phone (`fix2/after/single01_*`, `zeroTop_*`, 390 and 320, light and dark): one row and "7 more numbers: they change
  nothing here"; nothing moving: the hero and the fold, no repeated line.

**N4 (severity 2): at 320 px every Goal seek card title sat in a 52 to 62 px column ("What / you / need / to / save").**
- Reproduced at 707b12e: `fix2/before/casey_goal-seek_320.png` (the titles on four or five lines beside the pills).
- Change: the card's top row wraps and the title keeps at least 8.5em; at 320 px the title is one line and the pill goes under
  it; at 390 px the pill stays beside a short title (`fix2/after/dana_goal-seek_390_dark.png`).
- After: the tap walk measures every card title at 320 px dark, all folds open: none under 100 px (`after-open/interact.log`).
- Test: "fix round 2 (N4) ..." (the rule in the page's style); the phone walk is the real check.

**N6 (severity 1):** a row's "More about this" stays open when the measure is switched (a module-level set of row ids, never the
plan). Test "fix round 2 (N6) ..."; on the phone: open, switch to "How long it lasts", still open (`after-open/interact.log`).

**N5 (severity 1):** Goal seek's `purpose` and catalog row no longer list "the return it needs" (and say "change", not "lever");
What matters most's say "ranked by how much it moves the answer" (it can now measure how long the money lasts).

## 4. Not fixed here, with evidence (other lanes' files)
- **N2, claude-f.** `out/n2-after.txt`: score hint "save about $670 a month more"; `compute(plan, { only: [...], savingInto:
  "work" })` gives $790 into the 401(k) in 26 ms (the taxable search 16 ms), the page's own figure; typed there it reaches the
  goal, $670 does not (test "fix round 2 (N2, for claude-f's Plan health score)"). Ask for claude-f: pass `savingInto: "work"` in
  `overview/health-score/compute.js:221` and move their pinned "$170" (module.test.mjs:234) to the new figure ($190 there).
- **M5's engine half, claude-c.** As in re-check 1; unchanged (`out/c2-after.txt`, `out/c8-after.txt`).
- **P6, wave 1.** `re/w4-after.txt` line 2.
- **N3, wave 1.** `re/w8.mjs` on this build: 390 px, 600 ms on the page: 1124 -> 0, 1124 -> 0; 2,500 ms: same place twice; 320 px,
  600 ms: lost twice; 2,500 ms: lost once; 390 px, 6 s: lost twice (7 of 10 lost). The shell starts a new address at the top
  (`core/app.js` `show`, `keepY = 0`) and Goal seek draws after its answer arrives, so the browser's own restore finds a short
  page. A page cannot tell Back from a fresh tap without the shell; wave 1's place memory is the fix.
- **M2's last sentence, L3.** Retirement contributions' "A common match, 50% of what you put in up to 6% of pay".

## 5. Checks on a8e0763
- `npm run registry`: 161 modules, `modules/registry.js` unchanged. `npm run check`: OK.
- Touched modules and their neighbours (goal-seek, sensitivity, legacy, health score, Financial independence, projection, the two
  insurance pages, followups-fix1, wording-left, wording-verify, pages-followup-b): 318 tests, 318 pass (`out/t-touched-final.txt`).
- Whole `npm test` on the final tree: **189,430 tests, 188,790 pass, 0 fail**, 3 skipped, 637 todo, exit 0 (437 s;
  `out/npm-test-full.txt`). Neither speed test flaked. Eight more tests than re-check 1's 189,422: the ones named in section 3 and
  the simple-first tests of `optional.md`. `git status` after it: clean.
- `node tools/leak-guard.mjs --worktree`: OK (2,879 files); `--commits 707355c..HEAD`: OK (15 files).
- `git diff --stat 707355c HEAD` on tests/golden, modules/registry.js, CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md, core/,
  index.html, `retirement/projection/compute.js`, `modules/overview/**`, `investments/**`: empty. The commit touches 15 files: the
  catalog, goal-seek, sensitivity and estate/legacy (fix round 1's 14 plus Legacy goals' README).
- Money unchanged where it should be: the recheck's c1, c2, c3 and c7 give byte-equal output on 707b12e and on a8e0763; c4 differs
  only in Legacy goals' order (now Goal seek's first-view order) and the new run-out fields on `base`; c8 equal.
- The N1 sweep over every qa plan (section 3): 0 of each defect, 0 throws, the plan never changed.
- Phone, sandbox, Chromium with an iPhone user agent, 390 and 320 px, light and dark, own servers on 9701 to 9708, each stopped by
  its script (`finally`; `curl` on 9701-9709 answers nothing): the 68-screen walk (`fix2/after/`, `measure.json`): no sideways
  scroll, no page or console error, no control under 44 px, none of the words build, PC, AI, sync, server, NaN, undefined; the only
  filled buttons are "Add what you own ›" on the gated pages and Legacy goals' "Add" on its empty form. The tap walk
  (`fix2/after-open/interact.log`, 12 screens with every fold open): every fold opens, the lines say what was changed, the typo
  opens "More options" with its red line, the plan in the sandbox is byte-identical after every open, close, chip and switch, and
  the Legacy note is saved from inside its fold. Pictures read: Casey's Goal seek at 320 (closed and with every fold open, dark),
  Dana's at 390 dark, What matters most for Casey (320, and every fold open at 320 dark), the single adult at 390 dark, the
  nothing-moves plan at 390, Dana at 320 dark, Jamie's Legacy goals at 320, the empty Legacy goals at 320 dark.
- The commit message is `rv/scn/L1.msg` (copied to `L1.msg.new`), ending in exactly "Agent: claude-b", "Co-Authored-By: Claude
  [model] <noreply@anthropic.com>", "Claude-Session: ..."; the CHANGELOG line is `rv/scn/L1.changelog` (updated for what the person
  now sees; the earlier ones are kept in `fix2/out/`).

## 6. To try on the real iPhone (only Chromium here)
- Goal seek: tap "More options", "2 more changes" and "See each age"; each opens without the page jumping and the chevron turns;
  the line under "More options" changes after "Room for bad luck" and after "Use this"; a typo ("lots") opens the fold with the red
  line under the box, and the keyboard does not cover it.
- What matters most: "Measure it another way", "How long it lasts", then the line says "showing how long it lasts"; "More about
  this" stays open across the switch; the bar labels "age 63: to 65" at 320 px.
- Legacy goals: "+ Add someone", "Add a note", type a note, "Add", then tap the person: the note fold is open with "has one".
- On a phone narrower than 480 px the folds' lines sit under their titles (a scoped media rule): check at 390 and in landscape
  (844 px: the line goes back beside the title).
- The menu search typed key by key (P6) and Back after "What matters most? ›" (N3) once wave 1 has fixed them.
