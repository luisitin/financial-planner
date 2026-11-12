# Build log: track "place" (wave 1), builder claude-b

Worktree `$SP/w1/build-place` (detached at ee09f6e). Served on 127.0.0.1:9411 (build) and 9412 (a `git archive` copy of
ee09f6e in `$SP/w1/bp/today`, the "today" column) by `$SP/w1/bp/serve.mjs`. Judge scripts copied to `$SP/w1/bp/`
(`lib.mjs` points `A` at the build, `T` at today, households from the today copy). Base: design A's prototype read as a
reference (`$SP/w1/bp/ref/place-A.js`, `router-A.js`), the files rewritten in the seams' line map (`seams.md` 1.2-1.5);
B's parts ported where the plan names them.

## S1 Router: numbered entries with a visit id, the trail, ways back and layers
Files: core/router.js (rewritten), core/app.js (show signature, `ctx.layer`, `router.start((route, entry) => show(route, { entry }))`),
tests/place.test.mjs (router part), tests/router-replace.test.mjs (new).
- Pure and exported: `parse`, `hashOf`, `sameEntry` (B's month rule, no `data-back-loose`), `backSteps`, `kindOf`,
  `isReplace` (taps' safety net, seams I1), `stampOf` (keeps the page's own state; a number after the entry on screen;
  the replaced entry's number; another visit's entry is new with nothing behind it).
- The visit id `v` is kept inside the trail key (`planner.trail(.sandbox)` = `{ fmt: 1, v, e: { n: { h, p, via } } }`).
- New entries are numbered after the entry on screen (seams: "link, Back, link -> n 2, 1, 2"), not after every number
  known (A): no gaps, and the forward entries' records are dropped by `forgetAfter(from.n)`.
- `History.prototype.replaceState` wrapped once (at `router.start`): a state without `n` keeps the entry's numbers
  (`replaceState(null, ...)` of ai/explain, and Get started's spread state), and the trail follows the address (`touch()`).
- `router.open(href, { via, replace })`, `router.replace(href)`; links while a layer is open take the layer's entry.
- `scrollRestoration` stays "auto" in this step (set in S3).
Checks:
- Tests written first: on ee09f6e `tests/place.test.mjs` and `tests/router-replace.test.mjs` fail (the exports do not
  exist); on the build `node --test tests/place.test.mjs tests/router-replace.test.mjs tests/router.test.mjs`: 10 pass, 0 fail
  (`tests/router.test.mjs` unchanged).
- Kit `$SP/w1/bp/s1.mjs` (B's t-layer port) on the build: layer open (len 4, l 1) -> Back: closed 1, address and scroll
  (233) kept, 0 redraws; a second layer released by itself: l 0, close() not called, no redraw; Back again: the
  Dashboard (n 1, kind back); a layer left open then a link: close() called once on leaving, Back returns to Income (n 2).
- Kit `$SP/w1/bp/s1b.mjs` (Get started, samMidSetup): Let's go, Continue, Continue: n 2, 3, 4 with `suFrom` kept
  ("you", "money"); Back, Back, Forward: n 3, 2, 3, suFrom as before; the same addresses and suFrom as today (9412). 0 page errors.

## S2 Pure rules, locator and form identity
Files: core/place.js (pure rules, locator, `fkOf`), tests/place.test.mjs (place part).
- Pure and exported: `shape`, `splitCamel`, `secretText`, `pageKeyOf` (PRESENTATION keys incl. `back`), `neverKept`,
  `boxVerdict`, `pickForm`, `seenEnough`, `echoStay`, `fresh`, `prune`, `pruneTyping`, `planSig`, `usedOnLeave`,
  `calmArgs`, `boxName` (the visible label first, then aria-label, then placeholder).
- Locator: `keyOf/locOf/locate/drawn/inShutFold`; form identity `fkOf` = title, section, submit words, box keys (never values).
- DOM helpers call the prototypes ($$, $1, has, is, up, attr, textOf, parentOf, tagOf, rectOf, conn) so a box named
  `contains`, `target` or `isConnected` cannot shadow a form's own members (seams I10).
Checks: tests written first (fail on ee09f6e: no core/place.js); on the build 17 place tests + 10 router tests pass.

## S3 One scroll wrapper, the manual restore
Files: core/place.js (`wrapScrolls`, `scrolls`, `pageMoved`, `scrollTo`, `busy/idle`), core/router.js
(`history.scrollRestoration = "manual"`), core/ui/base.css (`html { overflow-anchor: none; }` in the 122-129 region).
Checks: node stub test (this, arguments, return value, count) passes; `$SP/w1/bp/walk.mjs` (157 pages x family and
renterDebt, each opened and stepped back, 12 Backs): 0 page errors; `$SP/w1/bp/sanity.mjs` (projection 1440 -> Back
1440, Forward 0, Back 1440, reload 1440); smoke-all on the build (scratch copy pointed at 9411): 158 of 159 clean, the one
left is system/docs' 19 px inline links, the same on ee09f6e (9412: "6 of 7 pages clean; look at: system/docs").

## S4 Records, the hold, arrive and leave
Files: core/place.js (records per entry, `leave`, `visit`, `note`, `forgetAfter`, `hold`, `afterArrive`), core/app.js
(`show()` new-address calls, room before the draw, scroll/pagehide/visibilitychange notes, `showConflict()` ->
`place.cancelHold()`).
Checks: `j-back.mjs A 1`: 13/13 Back, first frame at the place 13, moved by >10 px 0, grey 2 (How much to take out and
Life timeline at their real end: 61 px of the page's own bottom, as on ee09f6e), folds 4/4, Forward 12/13 (Pensions, as
in the judge's run), Back again 13, reload 13, reload folds 4, errors 0. `j-back.mjs A 4` (4x slower CPU): the same row.
B17, B18, B19 scripts hold (below).

## S5 Ways back are the phone's Back
Files: modules/overview/guide/frame.js (`dataset: { back: "" }` on its six links; nothing else), core/app.js (one
document click listener for `a[data-back]` -> `router.back(href)`; `ctx.back`).
Checks: B4 (check-in step and its way back: history 1 then 0, spot 0 -> 0, phone Back then Dashboard; Quick answers
285 -> 285; Your plan after two "Next result" pages: walked 2, 285 -> 285; a way back to a page not behind is a link,
history +1).
Deviation: plan text says "the eight links"; frame.js draws six way-back links today (seams name the six).

## S6 Across a save's redraw
Files: core/place.js (`before`, `afterSave`, anchor and shut-section summary rule), core/app.js (keepScroll path,
`ctx.redraw`, N1 focus on a readable fresh notice when the focused box went with its form).
Checks: B9 6/6 (projection Save settings 0 px, open; Buckets 0 px, open; Withholding first Save shuts its section, its
heading at the button's 393, no room 1 s later, 0 grey; Stress tests "Now" 4 of 4 open, chip 0 px; How much to take out
"Use this one": the page wins, no copy; Chance the money lasts Runs 2000 -> 10000 by a real tap and keys, section open,
1048 -> 1048).

## S7 Typing memory
Files: core/place.js (remember/forget/saved/refill/tell, observer with busy/idle, stray-tap note, save-and-leave,
Cancel, secrets, caps, fmt 1), core/ui/base.css (`.place-cue`, `.place-hint`, `.place-undo`, `.place-kept`), core/app.js
(second store subscriber: `planSig` -> `place.saved`).
Fixes made while running the acceptance scripts (each found by a script failing on the build, fixed, then holding):
- B5 (renter's Store card, reached from All pages, Back, Forward): the rate typed was lost. The focused box's `change`
  fires as the old page is taken away, after `leave()` had written both boxes; `remember()` then rebuilt the form's
  record from that one box. `remember()` now merges: boxes looked at now replace their entries, entries of boxes not
  looked at stay. The two paths that drop a box from the set (a box that saved itself on change; a loose box's "Undo my
  typing") now write first, so they still let their entry go.
- B6 (Income add form, menu, Back): the bottom note came although the line was readable. The kept line was drawn after
  the hold started, so it counted as growth and the borrowed room stayed 600 ms; the note was decided before the room
  went and the page settled. Now the line is drawn before the hold (the room goes one frame after the draw) and the note
  is decided only once the hold has ended (`whenStill` waits for it, at most 2.5 s).
- B8 (Net worth add form typed, "Save today's totals"): the save shut the add form and nothing said the typing was kept.
  `afterSave()` now draws B6's line (no bottom note: after a save the note is the save's own confirmation).
Checks: B5 5/5, B6 3/3 (incl. the out-of-sight line: the bottom note says it and its "Open it" brings the typing back),
B7 2/2, B8 5/5, B12 2/2, B13 1/1, B14 2/2, B15 1/1.

## S8 Confirmations
Files: core/app.js (`echo()`: whole note takes taps and closes, ways as 44 px rows, above the tapped thing or the
keyboard, `announce` for ok/info, `echoStay`; the keepScroll decision one frame later and after page scroll stops),
core/place.js (notices removed only in a trusted event or by the form kit), core/ui/base.css (`.save-echo*`).
Checks: B10 3/3 (Save all balances: own line not readable, note at the bottom with "See net worth ›"; the check-in's
balances step: the note's "‹ Back to the October 2026 check-in" is the phone's Back, history +0; a tap on the note's
words closes it and reaches nothing under it); B11 3/3 (Goals: rows under a resting thumb 0 px; "Rule added." still
there at +6.2 s; Back to Expenses made 10 rows shorter elsewhere: 0 grey, 0 moves, a drag moves 105 px).
Pictures (phone, read): `$SP/w1/bp/shots/update-light.png`, `update-dark.png` (note up, green border, way on, readable
in both), `income-kept-line.png` (the line in Income sources with "Open it" and "Undo my typing"),
`income-open-it.png` (the form with "Not saved yet" under the amount and beside Add income), `networth-note.png` (line
out of sight: the bottom note with "Open it"), `withholding-after-save.png`, `estimated-after-save.png` (1st quarter
kept with "Not saved yet", "Last year's figures saved." readable under its shut section), `import-kept.png`.

## S9 Footprint, docs, gates
- core/router.js 188 lines (budget 190), core/place.js 700 (budget 700): comments shortened, no body re-indented.
- No evidence switches (`?place=off`, `__placeLog`, `__place`, `__placeLast`) exist; no `data-kit-moved`; the note has no
  role. Grep `\b(form|f|el)\.(contains|submit|reset|elements)\(` over core/place.js and core/app.js: nothing. The last
  property reads on forms (`f.isConnected`, `n.nodeType`, `host.append/after/insertBefore`) go through the prototypes.
- docs/CONVENTIONS.md: "What the shell keeps for you", the three ctx rows (`back`, `redraw`, `layer`), the confirmation
  paragraph; CHANGELOG line; modules/overview/guide/README.md: the six `data-back` links.
- Not written here (seams step 4 gives them to the integrator): the TEAM claim row and the PLAN.md section.
Checks: `npm run registry` (161 modules); `npm test` 189317 tests, 188675 pass, 0 fail, 3 skipped, 639 todo; `npm run
check` OK; `node tools/leak-guard.mjs --worktree` OK (2873 files); `npm run build` (esbuild installed in a scratch
folder and linked in for the build only): dist/planner.html 4827 KB; `npm run skew`: CHECK PASSED, main may move.

## Final judge runs on the build (after every fix above), compared with plan section 9 (column A)
Outputs: `$SP/w1/bp/final-*.txt`.
- Back suite x1 and x4: 13/13 Back, first frame 13, moved >10 px 0, grey 2 (the page's own bottom at its real end, as
  on ee09f6e), folds 4/4, Forward 12/13, Back again 13, reload 13 (4/4 folds), 0 errors: both rows as planned.
- j-draft D1-D15: all hold. The judge's `kept` column reads false on D1, D2, D10 and D9 "2/3" only because typed
  figures come back formatted ("1200" -> "1,200", "32000" -> "32,000", which B5 asks for); compared without commas all
  are kept (B12: 3/3, house 395,000). D1, D7, D10 come back through "Open it"; D11 no phantom words; D12 the key never
  kept; D13 Get started stands aside; D14 twins: Ana's 120 only; D15 the paste box empty, no words.
- j-save R1-R10, L1-L5, X1-X3: R1 0 px, open, bottom note; R2 -1 px, note with "See net worth ›"; R3 0 px, open; R4 the
  page wins, no copy; R5 98,000 kept, 0 px; R6 0 px under the thumb, notice kept to +5.8 s; R7 "Rule added." at +6.2 s;
  R8 the section shut, its heading where Save was, no room, no grey; R9 open, 1048 kept; R10 4/4; L1-L3 the phone's
  Back (history +1 then the way back +0; 121 kept on Your plan); L4 the note's way back +0; L5 the note takes the tap;
  X1 828 kept, 0 moves; X2 bar at 56; X3 the drag followed the finger and stayed.
- j-recheck: R6 x2 the same rows under the thumb 0.5-5.0 s (the move at 5.2 s is the judge's own 1.1 s press ending
  as a tap on a goal row, which opens it); R8 x2 y 690, no min-height, no grey, a drag moves 185 px; L5 x2 the note is
  what the tap hit, plan and address unchanged; R7 0 page errors, the rule shown.
- j-extra: E1 the note at once (0 ms) and on screen for 3 s; E2 one line, on screen, no note; E3 the note with its way;
  E4 Back at x4: long tasks 114, 0, 95 ms (< 150), still in 413-453 ms.
