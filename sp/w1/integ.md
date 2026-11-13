# Wave 1 integration: forms + place + taps, finished (2026-11-13)

`$SP` = `$SP`. Worktree `$SP/w1/integ`,
detached HEAD **a11f163** on **707355c** (the branch tip). Every run's output is in `$SP/w1/integ-v/`. Patches:
`$SP/w1/integ-patches/0001..0003` (the three commits above). Written with `git format-patch -o ... 707355c..HEAD`:
the task's `format-patch -3 ... 707355c` takes the three commits that END at 707355c (it wrote the tip's own three
documentation commits when tried), so the range form was used.

| # | commit | what |
|---|---|---|
| 1 | cd58a9d | Wave 1, forms: every form speaks in plain words at the box |
| 2 | 8c4d0c7 | Wave 1, place: Back returns to the same spot; typing and open sections are kept |
| 3 | a11f163 | Wave 1, taps: a second tap does one thing; the menu, its search and the ways back |

Each keeps its message and its trailer lines (`Agent: claude-b`, `Co-Authored-By`, `Claude-Session`); the
Co-Authored-By line now names Claude, as this session's attribution asks for the commits it makes. Authors and
author dates are the original commits'.

## What I found when I started
The combining agent was cut off twice. The second run (this same task, 00:24 to 00:44) had already done the rebase onto
707355c and left two `fixup!` commits for forms (`tests/ui-kit-helpers.test.mjs`, a CONVENTIONS line), a full
`npm test`, the gate and the acceptance scripts in `$SP/w1/integ-run/`, but no `integ.md`; the machine had restarted
under it (uptime 5 min at 00:49), so its servers were gone and its place B17 ended on "connection refused". `git
status` was clean. I re-checked everything below myself on this tree; nothing of that run is taken on trust.

## 1. The rebase onto 707355c, and the conflicts
- 707355c = 7297bfb + a58b4fd (main gate words), 737fb6a (design rule "simple first"), 707355c (workboard): 8 files,
  none of them code the three commits touch, except `CHANGELOG.md`.
- Conflicts: `CHANGELOG.md` only, in each of the three commits (each adds its line at the top of Unreleased, where the
  tip added three lines). Settled by keeping both: the commit's line first, the tip's lines under it (newest first)
  (`$SP/w1/resolve-cl.py`).
- Checked: `git range-diff 7297bfb..6764778 707355c..f4d8f92`: the three commits differ only in that CHANGELOG context.

## 2. Checks
On the head before my fixes (6b755d4) and again on the final head (a11f163):

| check | result |
|---|---|
| `npm run registry` | 161 modules; `modules/registry.js` unchanged both times (nothing to commit) |
| `npm test` (whole) on 6b755d4 | 189,498 tests: 188,858 pass, **0 fail**, 3 skipped, 637 todo (2 min 55 s) |
| `npm test` (whole) on a11f163 | 189,500 tests: 188,858 pass, 2 fail, 3 skipped, 637 todo (9 min 30 s, load 15 to 19 from other agents' suites). The 2 are the two known speed tests: `modules/transactions/ledger/module.test.mjs` "verify 5, C ... well under 1.5 s" and `tests/estimate-perf.test.mjs` "settle ... 200 times in under 600 ms". Rerun alone: **37 of 37 and 2 of 2 pass**. Every other test passes (the 2 new tests are mine, below) |
| `npm run check` | OK both times |
| `node tools/leak-guard.mjs --worktree` | OK, 2,899 files, both times (and the pre-commit guard on every fixup) |
| main gate 737fb6a -> 6b755d4 (`node tools/main-gate.mjs 737fb6a <sha>`, the hook's form) | **OK, main may move**. Runs it named: "the push itself (737fb6a -> 6b755d4, reopened from the home screen)" CHECK PASSED; "every shape that can mix (6b755d4 + a synthetic change)" CHECK PASSED; "the saved copy on a stalled or flaky site (6b755d4)" (app.js and index.html change): PASS unchanged, stalled, transition, old-whole, mid-open, flaky, set-gone, two-tabs, never-back, no-pc. 8 min. `integ-v/gate1.txt` |
| main gate 737fb6a -> a11f163 (the final head) | **OK, main may move**: "the push itself (737fb6a -> a11f163, reopened from the home screen)" CHECK PASSED; "every shape that can mix (a11f163 + a synthetic change)" CHECK PASSED; "the saved copy on a stalled or flaky site (a11f163)": the same ten PASS. 8 min, at load 15 to 20. `integ-v/gate2.txt` |

## 3. Acceptance scripts (each `node <script> <base> $SP/w1/integ`, phone, sandbox)
Servers: `integ-v/serve.mjs` on 9401 to 9405 (the combined tree). First pass on 6b755d4, three suites side by side.

**forms** (`accept-forms/B1..B16`, 9403): **16 of 16 hold**, 92 checks: B1 10/10, B2 8/8, B3 9/9, B4 5/5, B5 8/8,
B6 4/4, B7 3/3, B8 4/4, B9 5/5, B10 6/6, B11 3/3, B12 2/2, B13 5/5, B14 2/2, B15 7/7, B16 11/11 (B9, B10, B11, B16
drive the page copies in `accept-forms/pages/`; no served page calls those kit parts yet).

**taps** (`accept-taps/B1..B17`, 9402): **17 of 17 hold** on 6b755d4: B1 28/28, B2 14/14, B3 10/10, B4 4/4, B5 4/4,
B6 9/9, B7 3/3, B8 1/1, B9 7/7, B10 3/3, B11 4/4, B12 3/3, B13 2/2, B14 18/18, B15 8/8, B16 9/9, B17 6/6.
After the simple-first change (section 6) on the final code: B16 9/9; **B17 2 of 6 by design**: it asks for "‹ Back to
Needs attention" twice (top and bottom) and now gets it once, at the bottom; every other part of those four checks holds
(the bar's "‹" says "Back to Needs attention" / "Back to Pay off debts", the bottom link goes Back, history 3 -> 3).
`integ-v/accept-variants/B17-simple.mjs` (B17 with "once, at the bottom" and the bar's name required): **6 of 6**.

**place** (`accept-place/B1..B19`, 9401): **19 of 19 hold**: B1 7/7, B2 3/3, B3 4/4, B4 4/4, B5 5/5, B6 3/3, B7 2/2,
B8 5/5, B9 6/6, B10 3/3, B11 7/7, B12 2/2, B13 1/1, B14 2/2, B15 1/1, B16 3/3, B17 3/3 (the conflict bar; the run that
was cut off had died here on a dead server), B18 3/3, B19 1/1. After the cue change (section 6), rerun on the final
code: B3 4/4, B5 5/5, B6 3/3, B7 2/2, B8 5/5, B12 2/2, B13 1/1.

**All three suites once more on the final head a11f163** (`integ-v/acc3/`, side by side, load 17 to 28): forms 16 of
16 (B10 first said "no Plan on $X a month button" twice at load 28, the adopted copy's figure arriving after its
fixed 2.5 s wait; alone: 6 of 6), taps 16 of 17 with B17 2 of 6 as above and B17-simple 6 of 6, place 19 of 19.

**Permanent checks in the taps commit** (`qa/shell-*.mjs`, final code, 9402): shell-ways 5/5 (updated for section 6),
shell-taps 6/6, shell-search 7/7, shell-menu 6/6, shell-bar 18/18.

## 4. Journey suites
- **Forms journeys** (`bf/journeys.mjs build` with `jlib.mjs`, copies in `integ-v/bf/` pointing at 9402; 6b755d4):
  J1 to J14 all ran, **0 page errors, 0 browser bubbles**; the same rows as the cut-off run on the same code (J3's
  Save 6 px higher, the button still where it was on all three taps). J6c (Net worth), J7 (How much to take out), J8
  (Rent or buy) measure pages that have not adopted `ui.openUnder` / `ui.undoable` / `ui.reveal` yet (A1, A2, A5: wave
  2, after main), so their "row on screen after Save" / "Undo shown" / "card in view" are the pages' as today.
- **Place judges** (`judge-place/j-*.mjs A`, copies in `integ-v/jp/` with A = 9401, final code):
  j-back x1: 13 trips, Back 13/13, first frame at the place 13, moved 0, grey 2 (two pages at their real end), folds
  4/4, Forward 12/13 (ruth, Pensions), Back again 13, reload 13 (folds 4/4), errors 0: the same as the build's A5 row.
  j-back x4: the same except reload 12/13: ruth, How much to take out, left at its very end (605), back at 538 after the
  reload: the known late "careful figure" line (build-place A5, left for wave 2 in that page's lane).
  j-draft D1 to D15: every value put back (D1, D2 and D10 read "kept: false" only because a money box shows "1,200"
  for a typed "1200"), D11 no phantom words, D12 a key never kept, D15 (rerun with the fixture path the copy lacked):
  imported 10, the paste box empty, no "Not saved yet". j-save R1 to R10, L1 to L5, X1 to X3: buttons stay under the
  thumb (moved 0 except R4, where the page brings its own answer into view, as designed), the note's way back goes
  Back with history +0, X3 the finger wins. j-recheck x2: R6 (Goals Save, thumb resting) the row under the thumb
  stays at 493 px from +0.5 s to +3.8 s in both runs (run 1's +5.0 s sample falls just after the thumb lifts, when the
  1.1 s press is taken as a tap on the goal and its form opens, the same in both runs); R8 Withholding y 690 at 1 s and 5
  s, no grey, a drag follows (185 of 200); L5 a tap on the note's words changes no plan and no address; R7 a rule added, 0
  errors. j-extra: E2 the kept line on return on screen, no note; E3 the note says the save; E4 cost of Back x4: long
  tasks 100, 0, 66 ms (under 150).
- **All-pages walk** (`bf/walk-all.mjs`, family, phone, final code, 9405): 157 pages, 57 forms, 296 boxes typed in, 56
  Save taps, **0 pages with page errors, 0 browser bubbles** (the forms build's numbers exactly).
- **`node qa/smoke-all.mjs`** (every usable page, phone; a copy pointed at 9404 with `--url`, `integ-v/smoke-all.mjs`):
  first run (6b755d4, load 12 to 17): 149 of 159 clean, 0 JS errors, 0 overflow, 0 small targets; 9 "almost no text"
  and 1 driver failure, all drawn fully when opened again (`integ-v/smoke-diag.txt`): fix 1 below. Final head, with
  that fix, load 17 to 28: **157 of 159 clean**, no "almost no text" left; household/contacts and insurance/health
  "DRIVER FAILED: unsettled top-level await at killBrowser()" (the driver's own exit under load, also seen on the first
  run, not a page): both opened again alone, clean (0 errors, 0 overflow, 0 small targets; `integ-v/smoke2-rerun.txt`).

## 5. What I fixed (each as `fixup!` into the commit that owns the code, then `--autosquash`; three commits kept)
1. **taps**: `tools/drive.mjs` `qa.go` waits while `#content` says `aria-busy` (up to 8 s more). The first smoke run
   (6b755d4, load 12 to 17 from other agents' test suites) flagged 9 pages "almost no text" and 1 driver failure; every
   one drew fully when opened again (`integ-v/smoke-diag.txt`): wave 1 paints the page's name first and works the page
   out after, so smoke's fixed 900 ms could read "Working it out…" on a loaded machine (main draws inside the address
   change, so its 900 ms never could). No page was wrong; the tool now waits for the drawn page.
2. **forms**: tests for the kit helpers that had none: `ui.notice(kind, text, { action })` (one outlined button on its
   own line; Undo wins over an action, never two buttons) in `tests/ui-undo.test.mjs`, and `ui.wordsFor` in
   `tests/ui-kit-helpers.test.mjs`. With the cut-off run's `tests/ui-kit-helpers.test.mjs` (`ui.reveal`, `ui.spanOf`,
   `ui.openUnder`, `ui.fieldError`, `ui.numberBox`) every new `ui.*` helper has a node test; the pure parts of place
   (`tests/place.test.mjs`), the router (`router.at/back/layer/replace` in `tests/router-replace.test.mjs`, which is all
   `ctx.cameFrom`, `ctx.back`, `ctx.layer` and `ctx.replace` read), taps (`taps.test`), the address (`address.test`),
   search (`search-words.test`) and `namedBack` (`ways-back.test`) have theirs. `ctx.redraw` and `ctx.announce`'s
   say-once rule live in `core/app.js` (no node test can load it): covered by the browser checks (B12, B19, shell-ways).
3. **Section 6's two changes** (below), with their docs, `qa/shell-ways.mjs` and the ways-back test header.

## 5b. Docs in the commits
- `docs/CONVENTIONS.md`: forms: "Forms: asking, checking, answering" (every `ui.*` helper, the "less first" option
  `more: true` / `moreLabel` / `moreOpen` / `ui.setMoreOpen`, field options) and the input schema; place: "What the
  shell keeps for you" (place memory: Back/Forward/reload, after a save, typing kept, notices, busy pages, scroll
  anchoring, `data-back`, `ctx.back`, `ctx.redraw`, `ctx.layer`) and its three ctx rows; taps: what the shell does
  around `render`, `ctx.derived`, `ctx.cameFrom`, `ctx.replace`, `announce`, frame mode 5b (now "once, at the bottom").
- READMEs the commits change: `modules/overview/guide/README.md` (place: the six `data-back` links; taps: named way
  back, now once at the bottom), `modules/overview/pages/README.md` (taps).
- CHANGELOG: one line per commit under Unreleased, each "- [builder:claude-b] ", rewritten in plain words (no kit
  names, one parenthesis of files at the end). Commit messages updated to match (forms: the new test file; place and
  taps: the simple-first paragraph; taps: drive.mjs).
- Not in these commits (seams step 4 lists them, this task did not): the TEAM claim row, the WORKBOARD lines and the
  `docs/PLAN.md` section "Wave 1: choices made without the owner". The cut-off run drafted the PLAN.md lists in
  `$SP/w1/integ-run/plan-forms.txt`, `plan-place.txt`, `plan-taps.txt`; for the landing step, add one line: "The named
  way back is drawn once, at the bottom; at the top the bar's ‹ is the way back" and "A form put back with typing says
  Not saved yet once by its button and once by the first far box".

## 6. Simple first: what wave 1 shows by default, and what I changed
Looked at every thing wave 1 draws (pictures: `$SP/w1/integ-run/shots/s1..s6`, `integ-v/shots/back-top.png`).
By default, on a page with nothing typed, nothing wrong and no special way in, wave 1 adds only the bar's "‹" (when Back
stays in the app) and, on a heavy page, "Working it out…" until it draws. Everything else appears only when it is
needed: a wrong box (words under it; one count line for two or more), typing left unsaved, a save that cannot be seen
(the bottom note, which leaves by itself), an address that names no page, and the "More details (optional)" fold only
where a page marks fields (none yet). Two places showed more than a person needs; both changed:
1. **The named way back was drawn three times** on a page opened from Needs attention, Next best action or a `?back=`
   link: the bar's "‹", a "‹ Back to Needs attention" card right under it, and the same link at the bottom. The card
   pushed the page's answer down by about 60 px on the first screen and said what the "‹" above it already does (its
   spoken name is "Back to Needs attention"). Now drawn **once, as the quiet line at the bottom** where the person
   finishes; the top is the bar's "‹" (`frame.js`; CONVENTIONS 5b, the guide README, `qa/shell-ways.mjs`, the
   ways-back test header, CHANGELOG and message). The check-in's "‹ Back to the ... check-in" stays at the top, where the
   check-in's own line was before wave 1 (wave 1 carries it one page further in the same place; the same pattern as
   "‹ Your plan" from Your plan, which the design log records).
2. **"Not saved yet" under every box put back** that was far from its button, plus the line by the button: a long form
   with four refilled boxes showed five. Now **once by the button and once under the first far box** (`core/place.js`
   refill; still 700 lines).
Left as they are, and why: the kept-typing line on a shut form (one line where the form lives, one outlined "Open it",
a quiet "Undo my typing": the person's own typing would otherwise be invisible; B6 asks for it); its bottom note only
when that line is out of sight; the count line only for two or more wrong boxes; "Page not found" lists the topic's
pages (a rare page, and the list is the way out).

## 7. Must be tried on the real iPhone (Safari, then the home-screen app; the sandbox)
The three build logs' lists stand (forms H1 to H11, place 1 to 18, taps' B-list). New from this integration:
- Needs attention > any row: the top shows the answer under the bar's "‹" (no "‹ Back to" card); at the very bottom
  "‹ Back to Needs attention" above "Continue your plan"; tapping it returns to the list at the row you left.
- VoiceOver on the same page: the bar's "‹" is read "Back to Needs attention".
- Income: type in Add an income and two later boxes, leave by the menu, come back by Back: "Not saved yet" once by
  Add income and once under the first far box, not under each.

## 8. Servers and leftovers
Servers 9401 to 9405 (pids in `integ-v/servers.pid`) stopped by `integ-v/stop` (only the servers that script started).
The temporary worktree used for the rebase (`integ-v/rb`) was removed with `git worktree remove`. No other worktree was
touched; nothing pushed; `$REPO` not edited.
