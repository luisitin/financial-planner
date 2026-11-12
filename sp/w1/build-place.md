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


---------------------------------------------------------------------------------------------------------------------

# Second session (2026-11-12, 15:00 to 17:00 UTC): acceptance on the build, on "today" and on place + taps; three fixes

Found: the worktree held S1 to S9 as logged above; no patch file; both servers gone; the acceptance run had stopped in
B10 (the browser was closed under it). Servers started again by `$SP/w1/bp/serve.mjs` (9411 the build, 9412 a copy of
ee09f6e) and `$SP/w1/bp/serve2.mjs` (9413: a scratch tree `$SP/w1/bp/combo` = ee09f6e + this track's code + the taps
track's patch `$SP/w1/patch-taps.diff`, applied with `git apply --3way`: exit 0, no conflict). The machine was shared
with other builders the whole time (load average 8 to 15 on 4 cores).

## A1 The 19 acceptance scripts on the build as found
`$SP/w1/bp/runaccept2.sh` (one script after the other): 19 of 19 exit 0 (`$SP/w1/bp/acc2/`).

## A2 The same scripts on "today" (ee09f6e, 9412): are they honest?
`$SP/w1/bp/acc-today/`: B1 0/7, B3 0/4, B4 0/4, B5 0/5, B6 0/3, B7 1/2, B8 0/5, B9 1/6, B10 1/3, B11 1/3, B12 1/2, B13
0/1, B14 1/2, B17, B19 fail; B2, B15, B16, B18 hold (the plan calls B2, B15, B16 guards). Two scripts were not honest and
were rewritten:
- B4 found the ways back by `a[data-back]` (a marker in the code), so on today it stopped with "no way back" instead of
  measuring. It now finds them by their words ("‹ Back to the", "‹ Quick answers", "‹ Back to your plan"), as a person
  does. Today: 1 of 4 (history grows by 1, lands at the top, the phone's Back goes back into the step); build: 4 of 4.
- B18 passed on today with the page at 0 and a drag that moved nothing. It now drags the way the page can move and asks
  that the page follows the finger by about its travel (within 80 px of 400) and stays 3 s; a third journey (a drag 150 ms
  after "Save settings" at 4x slower CPU) covers the redraw its header promised. Build 3 of 3 (-385 px each, held); today
  3 of 3 too (the finger wins there as well: it is a guard; the place is B1's).

## A3 The same scripts on place + taps (9413): the seam check
First run (`$SP/w1/bp/acc-combo/`): 18 of 19; **B9 4 of 6**: Stress tests' "Now" chip threw the chip 2,695 px off the
screen, Chance the money lasts went from 1,048 to 0. Cause, measured (`$SP/w1/bp/own-redraw.mjs`, `own-trace.mjs`,
`anchor-check*.mjs`): the taps track's `ctx.computeRemote` now paints the page's "Working it out..." words before it
works (one frame). A page that draws its own answer again (18 views call `computeRemote(...).then(draw)` after emptying
their host) is therefore one line tall for a frame: the scroll is clamped to the short page (to 1), and when the answer
is drawn Chromium, with `html { overflow-anchor: none }`, throws the screen to the page's END (3,018). No script call
scrolls (traced: only two scroll events).

## F1 Fix: the room stays while the page says it is working (core/place.js, tests/place.test.mjs)
- Test first: `roomDue(sinceGrowth, working, grace = 600)` (failed: no such export; passes after).
- `hold()`: the room is not dropped at the second frame nor 600 ms after the last growth while `#content` says
  `aria-busy="true"` (the taps track sets it around `ctx.computeRemote`); the 8 s cap still ends it.
- `watchPage()`: when the page takes its own content away while `#content` is busy, and no hold runs, the height the
  page last stood at by itself (one ResizeObserver on `#content`, read only when no room is borrowed) is lent as room
  before anything is measured, and the screen is held at its scroll (the page's own scroll call still wins).
- Inert without the taps track (nothing sets `aria-busy` on ee09f6e): on the build alone the log of room and busy
  changes is empty. On place + taps: room 3,805 px from +8 ms, busy off at +81 ms, room gone at +107 ms, no scroll event,
  no room and no grey afterwards; B9 6 of 6.
- Footprint: place.js 700 lines (three block comments folded to make room), router.js 188.

## F2 Fix: `body { overflow-anchor: none }`, not `html` (core/ui/base.css)
Looking for the jump to the page's end showed a defect of the build itself, not of the seam, that no judge journey and
no acceptance script had measured: **with the rule on `html`, Chromium pins the screen to the page's end.** Standing at
the very end of a page, a tap that makes the page longer threw the screen to the new end (`$SP/w1/bp/end-grow.mjs`, real
swipes to the end and a tap at the button's place):

| page, tap | today | build with `html` | build with `body` |
|---|---|---|---|
| Income, "+ Add another income" (page +844 px) | 0 px | **+843 px** | 0 px |
| Net worth, "+ Add another account" (+516) | 0 | **+515** | 0 |
| Goals, "+ Add another goal" (+381) | 0 | **+381** | 0 |
| Credit cards (renter), a section opened (+534) | 0 | **+534** | 0 |

Pictures: `$SP/w1/bp/shots/end-build-cashflow_income.png` (before: the screen shows "Add income / Cancel", the first box
is 800 px above), `end-build2-cashflow_income.png` (after: "Add an income, What is it" opens where the button was).
`$SP/w1/bp/anchor-check4.mjs` on today's tree with the rule set by hand: on `html` anchoring is off in the middle of a
page but at its end the screen follows the end (+514, +500); on `body` (or `#content`) nothing ever moves the scroll by
itself (0, 0, 0), which is what the plan wanted ("Chromium measures what Safari does"). The collapse-and-regrow case
then stays at the top instead of jumping to the end. Safari ignores the property either way.
New acceptance journeys: B11 now has those four taps (today 4 of 4, the build before the fix 0 of 4, after 4 of 4).

## F3 Quieter words (the owner's 2026-11-12 direction: less by default, the extra kept subtle)
- The kept line ("Not saved yet: what you typed in “Add an income”.") has one outlined button, "Open it"; "Undo my
  typing" is the same quiet text button it is beside a form (44 px tall, 123 px wide), no longer a second outlined button.
- `.place-cue` / `.place-hint` asked for amber, but `.help` (declared later, same weight) always won: what every judge
  saw was muted grey, semi-bold. The dead `color: var(--warn)` is gone; the look is unchanged and now on purpose.
- Pictures read: `$SP/w1/bp/shots/v2-income-kept-light.png`, `v2-income-kept-dark.png` (one outlined "Open it", a quiet
  "Undo my typing"), `v2-income-open-light.png`, `v2-income-open-dark.png` ("Not saved yet" under the box and beside
  "Add income", `rgb(107, 114, 128)` light, `rgb(139, 147, 160)` dark, weight 600).
- Not built (outside this track's files; a note for the owner's "optional complexity" request): a Settings switch
  "Keep what I type when I leave a page" (on by default) would need one row in `modules/system/settings` and one check
  in `place.remember()` / `place.refill()`.

## A4 After F1 to F3: every script again, on the build and on place + taps
`$SP/w1/bp/acc3/` (build, 9411) and `$SP/w1/bp/acc-combo2/` (place + taps, 9413), run side by side: **19 of 19 exit 0 on
both** (B1 7/7, B2 3/3, B3 4/4, B4 4/4, B5 5/5, B6 3/3, B7 2/2, B8 5/5, B9 6/6, B10 3/3, B11 7/7, B12 2/2, B13 1/1, B14
2/2, B15 1/1, B16 3/3, B17 3/3, B18 3/3, B19 1/1).

## A5 The judge's journeys once more on the build (after F1 to F3), `$SP/w1/bp/final-*.txt` (the run before: `final-before-fixes/`)
- j-draft D1 to D15, j-save R1 to R10, L1 to L5, X1 to X3, j-recheck (R6 x2, R8 x2, L5 x2, R7), j-extra E1 to E4: the same
  rows as before the fixes (differences of 1 px and of a few ms only; E4 long tasks 103, 0, 111 ms, under 150).
- j-back x1: 13/13 Back, first frame 13, moved 0, grey 2 (the two pages at their real end), folds 4/4, Forward 12/13,
  Back again 13, reload 13 (4/4), errors 0: identical to the run before.
- j-back x4: the same row except **reload 12/13**: "How much to take out" (ruth), left at its very end (605), stood at
  538 after the reload. Traced (`$SP/w1/bp/reload-end.mjs`, five runs at x4): the page fills in its careful figure
  after the first paint (`modules/retirement/careful.js` works it out in 24 ms slices; a reload forgets the answers
  remembered for the visit) and that line makes the page 66 px taller 0.9 to 1.2 s after the page stopped growing, later
  than the hold's 700 ms, so nothing puts the place back. At x1 it arrives after 190 ms and at x2 after 450 to 500 ms
  (605 both). The same with the old rule on `html` set by hand (538, two runs): it is the machine's load today (8 to 15
  on 4 cores, so x4 is slower than it was at night), not F2. Left as it is: a longer hold would run its locator on every
  slice of that search (plan R20); the page-side cure is wave 2 (below).

## Gates on the finished worktree
- `npm run registry`: 161 modules, `modules/registry.js` unchanged.
- `npm test`: 189,318 tests, 188,676 pass, 0 fail, 3 skipped, 639 todo (3 min 30 s; `$SP/w1/bp/out-test4.txt`).
- `node --test tests/place.test.mjs tests/router-replace.test.mjs tests/router.test.mjs`: 24 pass (23 before `roomDue`).
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,873 files.
- Greps: no evidence switch, no `data-kit-moved`, no `role` on the note; `\b(form|f|el)\.(contains|submit|reset|elements)\(`
  over core/place.js and core/app.js: nothing.
- Footprint: core/place.js 700 lines (budget 700), core/router.js 188 (budget 190).

## Deviations from the plan and the seams, and why
1. **`body { overflow-anchor: none }`, not `html`** (plan M10, seams 1.5): F2 above. Same intent, without Chromium
   pinning the screen to the page's end.
2. **Place reads `#content[aria-busy]`** (seams I8 lists it as taps' marker that place's observers must not watch): place
   still watches only childList; it reads the attribute at the moment of a removal and in the hold (F1). Inert on
   ee09f6e alone. To add to the seams: I8 row "read by: place (the room stays while it is true)".
3. **Six `data-back` links**, not eight (seams 1.4: the other two are the taps track's).
4. **The patch holds CHANGELOG.md, docs/CONVENTIONS.md and the guide's README** because the task asks for
   `git diff --cached ee09f6e`; the seams (section 4) want code only at step 2. Both are written:
   `$SP/w1/patch-place.diff` (everything) and `$SP/w1/patch-place-code.diff` (the same without CHANGELOG.md and docs/).
   The TEAM claim row and the PLAN.md section stay with the integrator (seams step 4).
5. **Kept line and cue look** (F3): one outlined button, the rest quiet; no amber.
6. **Acceptance scripts changed in this session**: B4 (ways back found by their words), B18 (measures the finger; third
   journey), B11 (four journeys at a page's very end).
7. **x4 reload 12/13** in the judge's Back suite today (A5): reported, not cured.

## Left for wave 2 (owners as in plan section 3, plus)
- `modules/retirement/withdrawal-strategy` (claude-b's lane): the careful line should hold its height while it waits
  (the page grows 66 px when it fills in), so a slow phone's reload stays at the place; the same check for the other
  pages that call `whenCareful` / `whenWorked`.
- A Settings switch for the typing memory (F3), if the owner wants one.
- The touch-check rules proposed in plan section 1 (D-STILL and the others) should measure what is on the screen (an
  element's top), not the scroll number: a late part above the screen changes one without the other.

## Must be tried on the real iPhone (Safari first, then the home-screen app; always the pretend plan)
The fourteen checks of plan section 5, and:
15. Income: scroll to the very end, tap "+ Add another income": the form opens where the button was (Safari has no
    scroll anchoring, so this should already be so; Chrome on the computer is where F2 mattered).
16. Stress tests: scroll down, open a section, tap the "Now" chip: the screen stays where it was while "Running your
    plan through every shock..." shows, and no grey is left under the page (needs the taps track's build as well).
17. How much to take out: scroll to the very end, pull to reload: does the page come back at its end, or a few lines
    above it (the careful figure arriving late)?
18. The kept line in dark mode: "Open it" outlined, "Undo my typing" readable as a quiet link, both easy to hit.

Servers stopped (`$SP/w1/bp/stop`, `$SP/w1/bp/stop2`); the scratch tree `$SP/w1/bp/combo` removed.
