# forms2 design: scope critique (the maintainer's view)

What I ran (all in `w1/forms2/scope/`): `coverage.py` (theme files against section 8), `coverage2.py` -> `coverage2.out`
(what the kit alone changes for each finding, and what the branch did since), `tip/` = `git archive` of origin at ee05ab2
with the prototype's `core/ui/{dom,undo}.js`, `core/ui/base.css` and `tests/ui-undo.test.mjs` dropped in, then
`node tools/run-tests.mjs` (`test-tip-kit.log`) and `node tools/check.mjs`, then `s1-tip.mjs` -> `s1-tip.out.json` and
`s2-silent-check.mjs` -> `s2-silent-check.out` (phone, touch, sandbox, port 9393, stopped). The repo and `ux/app` were not
touched. During this review origin moved again, to 658c5b8; figures below say which tip they come from.

## Blocking

**1. The design is scoped on a base the branch has left, and section 3 now overwrites other agents' fresh work.**
- Evidence: `git rev-list --count c385e41..origin` = 62 commits, 293 files, 100 view.js (658c5b8); `core/ui` unchanged.
  Wave 2 is landing now: `coverage2.out` counts 32 findings whose only closure is a page edit, and 27 of them are
  reported closed on WORKBOARD by claude-d/e/f/g/h, with their own mechanisms (spot-checked in code: renovation and
  purchase `required`; annuities and pensions `required`; `ui.confirm` on holdings, tax lots, capital gains; contacts sets
  `tel`; backtest "Your plan's mix"). Section 3 rows that would now replace that work: subscriptions/recurring
  (`ui.undoable` vs claude-g's ask-first + "Hidden" card, 7c5c1d8), goals/prioritizer (vs its "Put back my amounts"),
  balance/liquidity (vs its Undo on the notice), household/contacts types, the five IE-2 pages, goal-seek's money box
  (now a `ui.moneyBox` in a `noValidate` form, goal-seek/view.js:97,106). Build step 8's first adopter, balance/net-worth,
  is under claude-c's live claim (TEAM.md, loans lane row); step 9's, prioritizer x-4, is already closed.
- Change: re-base on the tip before building; cut section 3 to what is still open (below, item 5) plus the asks wave-2
  owners left for wave 1, each with its owner; pick adopters for steps 8-9 in released lanes after a WORKBOARD message.

**2. The chosen engine (M1-A) rests on two premises the tip no longer holds.**
- (a) Section 2.1 and risk row 4: "No page calls checkValidity today: grep". Tip 658c5b8 has 5: debt/mortgage/view.js:129
  (`readBox`, run on every `input` of both what-if boxes), debt/payoff/view.js:90 (preview on `input`) and :127,
  investments/tax-lots/view.js:81-82 (run on `change`, i.e. on blur, between a tap's down and its click). M1's listener
  acts on any `invalid` from a box that has a form. `s2-silent-check.out`, Goals add form, typing "50" in "target" while
  an `input` listener calls the required "name" box's `checkValidity()`: today (`forms=off`) target = "50", focus kept;
  with the kit the cursor jumped to "name" after the first key and target = "5". Mortgage and payoff are safe only
  because their boxes sit in `div.form`, not `<form>`; tax-lots is inside a ui.form, so the kit's words are drawn
  synchronously during the blur: the design's own 2.2b rule ("never change the layout between a pointer's down and its
  click").
- (b) The A-over-B decision's deciding case is gone: Goal seek "1250" is now a novalidate form (`s1-tip.out.json` B:
  `formNoValidate: true` in both modes), so A skips it as B would. At the same time `reportValidity()` calls went 1 -> 10
  (c385e41 -> 658c5b8); the formless ones (credit-cards:154, payoff:103) still get the grey bubble under A
  (`s1-tip.out.json` C: `invalid` not prevented, 0 kit words). The 2.1 table is a measurement of a tree that no longer
  exists.
- Change: re-run `m-err.mjs`/`m-reach.mjs` A vs B on the tip and decide again. If A stays: the listener speaks and moves
  the cursor only in a pass the person started (a submit, Enter, a button's click, `ui.check`); an `invalid` fired while an
  `input` or `change` is being dispatched draws nothing now and never moves the cursor (a capture `input`/`change`
  flag cleared in a microtask: three lines). And make the CONVENTIONS rule a check, not a grep in a risk table: fail
  `npm run check` (or a test) on `.checkValidity()` in `modules/**/view.js`.

**3. M10 builds a second bottom-note system beside the one the place track is redesigning, while the app already has
an in-page Undo pattern.**
- Evidence: place/design.md M6 (the echo gets `.save-echo.top` and "the notice's own first link or button" as a 44 px
  row) and place2/design.md B11/M7 (the echo carries "its one link or button (... Undo)", `.save-echo .save-echo-go`);
  forms2 adds `.undo-bar` (z-index 42), `.undo-bar ~ .save-echo { bottom: 92px }` and P3 "route echo() through toast()
  later". On the tip six pages already put Undo inside their own green notice (goals/prioritizer, balance/liquidity,
  balance/update, household/people, overview/guesses, retirement/contributions); two of them (people/view.js:33,
  update/view.js:49) put back the whole plan with `structuredClone(was)`, exactly the `store.replace(before)` that 2.10(b)
  rejects for clobbering another device's later change, and design section 3 does not list them. claude-h left for wave 1
  "the bottom toast covering a low button" (WORKBOARD 22:40); the bar is a second one. Rules: AGENTS.md "Every save, add
  or remove confirms itself with `ui.notice("ok", ...)`"; DESIGN_LOG 2026-11-06 "No Next bar is fixed to the bottom of the
  screen (it rides over the keyboard and covers the page's own buttons)". The break critic's items 1, 2, 11 and 12 (Undo
  chains minutes of work, the bar covers the menu, a no-op Undo, notes overlapping) all live in the bar half. `.undo-bar*`
  and `.save-echo` are neither form nor notice selectors (the brief's file list).
- Change: keep `core/ui/undo.js` (`changesOf`/`takeBack`, pure, tested: the part that answers "what undo means with the
  store"), drop `toast()`, `.undo-bar`, the joining, the timers, P3 and P8. `ui.undoable(store, mutate)` returns `undo()`;
  the page draws its usual pending `ui.notice("ok", ...)` with an outlined Undo (one optional argument on `notice`), and
  the place track's echo carries that button when the notice is off screen. Add to section 3 the migration of people,
  update and guesses to `takeBack`.

**4. Hand-offs between the wave-1 tracks have no owner.**
- Evidence: (a) taps/design.md:387 gives forms2 three kit items: `ui.notice("error")` with `role="alert"`
  (j-keyboard-reader/K5), reduced motion for `.fold .fold-chev` and `.scroll-hint::after` (j-hard-conditions/HC-5), and
  "Enter pressed twice on a form is the form's guard (M1 sees only taps)" (touch rule D-TWICE). forms2 names none of
  them, and M7 makes Enter in the last box submit, so a double Enter adds two rows. (b) P1 asks place to centre
  `ui.openerOf(form)`'s twin after a save; neither place design mentions `openerOf` (place/design.md:515-516 and
  place2/design.md:529-531 say dom.js is untouched and ask forms2 for `place.isDirty` and "do not re-fill from their own
  draft store"), so the Save half of p-balance/B3 and p-transactions-helpers/T9 sits with a track that never took it. (c)
  claude-g asked wave 1 for "a kit-wide `more: true` fold" (WORKBOARD 22:30): neither taken nor declined.
- Change: a short table in 2.12, "taken from / asked of the other tracks", each row owned or declined. Take the three
  taps items (one line each plus a submit guard in `ui.form`). Replace P1 with the place track's own locator or say in
  section 8 that the Save half is not closed.

**5. Section 8 says "None declined", but 32 of the 55 findings get no behavior from this track.**
- Evidence: `coverage.py`: 55 ids in the seven theme files, 55 rows in section 8, none missing. `coverage2.out`: kit
  alone 12, kit in part 10, real-phone only 1 (j-first-freelancer/F6, whose "should" is None), page edit only 32. B12 is
  `ui.confirm`, which exists today; B14 has no mechanism; B15 is one CONVENTIONS line; B11 and B13 are helpers a page must
  call. Waved through without a kit behavior (state on the branch in brackets):
  UI-ERR p-debt-property/x-2 [closed g], j-debt-fixer/D2 [closed g], p-debt-property/DP-4 [closed g],
  p-retirement-c-scenarios/RC-1 [closed e], RC-2 [closed e], p-transactions-helpers/T7 [closed d];
  UI-EDIT p-transactions-helpers/x-halfform [closed d; `openUnder` as written moves the shared host, so it would not
  close it anyway];
  UI-UNDO p-cashflow-b-goals/F3 [closed g], p-investments/INV-2 [closed h], p-cashflow-b-goals/x-4 [closed g],
  p-taxes/x-4 [capital gains closed h; taxes/documents is claude-a], p-balance/x-4 [closed g], **p-retirement-b/x-3,
  p-transactions-helpers/T11, p-transactions-helpers/x-duplicates, j-first-retiree/R4 (its Undo half) [open]**;
  UI-LIVE j-keyboard-reader/x-redraw-on-change [mortgage g, capital gains and brackets h], p-debt-property/x-1 [closed g],
  p-taxes/x-3 [closed h];
  UI-RESULT j-one-answer/A1 [closed g, h], **p-debt-property/DP-1 [open, no owner]**, p-cashflow-b-goals/F6 [house closed
  g; vehicle, charitable claude-a; rent-vs-buy, renovation not reported], p-investments/INV-7 [closed h],
  **p-retirement-c-scenarios/RC-11 [open]**, p-cashflow-a/x-3 [closed g];
  UI-TARGET p-retirement-a/R-A9, p-retirement-b/RB3 [closed e in f80661e, landed during this review], j-fat-fingers/FF8,
  p-balance/B8, p-career-household-system/F8 [closed g], p-overview-home/OV-5 [closed f],
  p-retirement-c-scenarios/RC-10 [closed e].
  Five of the six still open have owners who wrote that they wait for wave 1 for it: claude-e (x-3, R4, RC-11, "Waits for
  wave 1", WORKBOARD 23:30) and claude-d (T11, x-duplicates, 22:15). Wave 1 gives them only an API, so as planned both
  sides wait for the other.
- Change: section 8 in three columns (what the kit alone does / page edit and its owner / already closed, commit); a
  WORKBOARD message to claude-d and claude-e naming the helper each open finding needs and the commit it lands in; DP-1
  needs an owner.

## Should fix

6. **Build order.** Wave-2 builders are adding workarounds while they wait: `reportValidity()` 1 -> 10, `checkValidity()`
   0 -> 5, error-notice prepends 15 -> 18 (career/business:141 is new), plain `setCustomValidity` on holdings, tax lots,
   people, calendar, health (c385e41 -> 658c5b8). Land first what they call: words and listener (steps 2-3) with
   `fieldError`/`check` (step 5); then say on WORKBOARD that pages may adopt. Step 1 (`undo.js`) lands code nothing uses
   for seven steps: move it next to step 9.
7. **Steps 8 and 9 cannot be checked alone** without a view.js edit, which claude-b's wave-1 claim row excludes ("no view.js
   in this wave"). Check `openUnder` with a node test on `qa/fixtures/fake-dom.mjs` (it only moves nodes) or a fixture page
   under `qa/`, and adopt on a page in a released lane after a message.
8. **The touch-sweep evidence is narrower than 2.13 says.** `results/sweep-a.log`: 5 rules x 6 pages x 1 household.
   D-SCROLL-KEPT ("stays green and must stay"), D-KEYBOARD-UP, T-COVERED and D-ANSWERS were not run, and each can see a
   kit change (bringTo's scroll, the count line pushing Save, a bottom note over a low button). D-WRONG accepts "the
   browser's own message at that box", so it scores today's bubble and the kit's words alike (sweep-off's 2 breaks were
   only the 0026 dates): UI-ERR's core change has no permanent guard. D-UNDO counts only removes ("makes a list in the plan
   shorter"), so the overwrite one-taps (x-4, x-3, R4, T11) are guarded only by `m-undo.mjs`. Ask the sweep's owner for a
   strict D-WRONG (a held `ui.form` box whose `invalid` was not default-prevented is a break) and a D-UNDO variant for
   overwrites; run every browser rule on at least 3 households over the pages with forms before step 3 lands.
9. **M3 removes page nodes by heuristic and leans on place's timing windows.** place/design.md M6 puts back "a single
   `.notice.ok` / `.notice.error` taken out with nothing put in, not within 120 ms of the person's own input"; place2 M7
   gives fresh notices a `remove()` that only works within 0.9 s of a touch. M3's `n.remove()` survives both only by
   timing. Add P9 ("a notice the kit moved is the kit's: never put back") and a kit check that a Save by Enter on a held
   form leaves exactly one copy. Keep M3 itself: 18 sites, including claude-a's taxes/documents:72, is the right altitude.
10. **One word, two meanings.** Place's "Not saved yet. Undo my typing" sits beside the same form buttons where forms2's
    red line goes, while pages say "Undo" for a plan change. Agree one wording with place before either lands.
11. **Files and claims.** The track adds `core/ui/undo.js`, `tests/ui-undo.test.mjs` and (planned) `tests/ui-words.test.mjs`;
    claude-b's TEAM row names only "a new small file under `core/` for the page's place and typing memory". Name them.
    `tests/ui-words.test.mjs` does not exist in the prototype yet, so no sentence of `wordsFor` is pinned.
12. **M2b (words when a box is left) is the riskiest piece for the least.** It needed the 2.2b fix and still pushes the box
    being typed in under the keyboard (break critic item 7). Keep it only with D-KEYBOARD-UP and D-SCROLL-KEPT run with it
    on; otherwise draw words on Save and `ui.check` only.

## What held up

- **The prototype kit drops onto today's tip with no test failure.** `test-tip-kit.log`: 189,154 tests, 188,509 pass, 641
  todo, 1 fail = tests/live-check.test.mjs:43, which runs `git diff` and my copy is a `git archive` (not a repo).
  `node tools/check.mjs`: "check: OK". (The design's 73-failure trap stays closed with the import-time guard.)
- **Static site.** A new `core/ui/undo.js` needs nothing in sw.js (no file list; one open is decided as a whole), in the
  server's import map (every code file under core/ gets its hash, server.mjs:258-271) or tools/build.mjs (esbuild bundles
  from core/app.js); tools/main-gate.mjs's synthetic run covers a new import. `ctx.ui` is `import * as ui`
  (core/app.js:14), so new exports reach pages with no shell change. Core stays dependency-free; `undo.js` is pure with
  7 node tests.
- **Coverage bookkeeping.** `coverage.py`: the .md and .json theme files agree on 55 ids; section 8 has 55 rows, none
  missing, none extra.
- **Lanes kept where it matters.** No claude-a page, no `overview/setup/compute.js`, `retirement/projection/compute.js` or
  estimator is edited; novalidate Get started is left alone by every listener.
- **M3's reach is real.** The pattern grew while wave 2 ran (15 -> 18 sites), so a kit fix with no page edit is the
  right altitude for FF1, DP-2's message and p-investments/x-2.
