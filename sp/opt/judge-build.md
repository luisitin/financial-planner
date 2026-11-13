# Maintainer judge: which design can be built and kept right across 190 pages, several sessions, no framework

Judged 2026-11-12 and 2026-11-13 against the code, not the drawings. I put each prototype's changes on a copy of wave 1's
integrated tree (`core/place.js`, `core/ui/dom.js`, `core/app.js`, `core/router.js`, `core/taps.js`, `core/ui/checks.js`,
`frame.js` and `base.css` byte-identical to `w1/integ` at f4d8f92; only docs differ, from an earlier base) and walked
them by touch in the sandbox at 390 x 844, ran `npm test` on each, ran each helper's own tests, and read every line of
the three helpers. Servers ran on 9862 to 9864 (and 9881 to 9883 in the first half of the run); every one was stopped
by the script that started it, and nothing answers on 9861 to 9869 or 9881 to 9884 now. Nothing in
`$REPO`, `w1/integ` or the three prototype worktrees was edited (their `git status` is as found).

`$J` = `$SP/opt/judge-build-work`
(scripts, logs, the three copies). Screenshots: `.../scratchpad/opt/judge-build/`.

## 1. Verdict

| design | score | best thing for whoever keeps it | worst thing for whoever keeps it |
|---|---|---|---|
| **inline** (`part()`, remembered per part on the device) | **8** | One file, one ordered list of "why is this open", native `<details>` with the title in `.fold-title` and the status in `.fold-status`, which is exactly how wave 1 names a section. It puts no control into the page, so wave 1's typing memory has nothing of it to replay. On wave 1 every walk passed: redraw after a save, Back, reload, new visit, a guide step's `opens:`, typing kept. Its 11 helper tests pass on the wave 1 tree. | It adds a fourth memory (90 days, per part, on the device) on top of wave 1's three (per history entry, per visit for the form fold, typing per tab). The two that hold folds can disagree on Back, and nothing tests that. Its new landing key `?open=` is not one of wave 1's presentation keys, so typing kept on the page is not found at the landing (measured). Its `moreOptions()` folds form boxes a second way, beside wave 1's `ui.form` `more: true`. |
| **dial** (`part()` + a page row "Show everything on this page" + a Settings card) | **5** | The smallest core (43 + 135 lines) and the cleanest invariant of the three: one markup, two starting states, provable by drawing a view twice and comparing with `open` removed. It lands with `?show=`, the key wave 1 already treats as presentation, and wave 1 already ships the form half of a dial (`ui.setMoreOpen`). | The page row is a tick box inside `#content`. Wave 1 keeps it as unsaved typing and ticks or unticks it again on Back and on the next visit, which fires `change` and rewrites the device's choice. Measured: Settings set to "Everything open", and Federal estimate still opened short because an old untick was replayed. Its helper also crashes the repo's text-only stand-in DOM (`replaceChildren`, `querySelectorAll`), which broke 16 existing tests. And its Settings card promises a state that about 150 unadopted pages will not show. |
| **stages** (a short page, `?deeper=` behind it, "Keep this" ticks, a stage read from the plan) | **4** | The level is in the address, so a redraw, Back, Forward, a reload and printing are right with no memory. The deeper page prints whole and can be searched whole. The designer updated the page's tests: 0 page failures under `npm test`, and its 6 helper tests pass on wave 1. | The most work per page and the most ways to fail without any error: a sentence written for each case; `shows` lists that must name every box a `?show=` landing can ask for; tests that must say which level they read; typing filed under two addresses per page. Its "Keep this" ticks are replayed by wave 1 just like the dial's row (measured: the kept list flips with whichever page was visited last). It calls `location.replace` while drawing, against wave 1's `ctx.replace` rule. Every page depends on the path's `finishedAt` (claude-f's lane) and needs walked-path fixtures. |

**Winner: inline**, with the grafts in section 6. It is the smallest thing a builder can get wrong on one page: list the parts, give each a stable `id` and a `kind`. It is the only design whose mechanism wave 1's typing memory cannot hurt, and all four failures it brought into `npm test` are wording pins of the one page it rewrote. Of the three judges before me it is also the owner's advocate's pick (8). The detail lover's pick, the dial, survives as graft 5: one input to `part()` and one Settings row, never a control inside the page.

## 2. What I ran

### 2.1 The walks, on wave 1 (touch taps, sandbox, the family; logs in `$J`)

| on wave 1 | inline (`walk-inline.log`, `seam-inline.log`) | dial (`walk-dial.log`, `seam-dial*.log`, `seam-keep.log`) | stages (`walk-stages.log`, `seam-keep.log`) |
|---|---|---|---|
| a part opened, then Save in another part (the redraw 50 ms later) | both open, plan unchanged apart from the save (A1, A2, A11) | both open: wave 1 keeps the hand-opened one (B1). Without wave 1 the detail lover's judge saw it shut | Save on the deeper page: same address, the button stayed at y=636 (C1) |
| Dashboard, then Back | same spot (y=542), same parts (A3) | same spot (y=1,799), same parts (B2) | `‹ Federal estimate` (`data-back`) stepped back without adding an entry (C3) |
| reload | same (A4) | same (B2) | same address, same part on top (C4) |
| a new visit by a link | the parts opened before (device memory, A5) | shut again (B2), as designed | the short page (C6) |
| a landing | `?open=figures`: the part opened 68 px under the bar, nothing remembered (A7) | `?show=withheld`: the part opened (B6) | `?show=charitable` is replaced by `?deeper=itemized&show=charitable`, the box gets the focus, Back skips it (C5) |
| a guide step's `opens:` | opened (A8) | opened (B6) | the fold stays on the short page and opened; the door carries the guide's keys (C8) |
| typing left in a part, then away and Back | kept, "Not saved yet · Undo my typing" (A9) | kept (B5) | kept, at that address only (C6) |
| typing, then the same page by its landing address | **lost**: `?open=itemized` showed an empty box (A10) | kept (`show` is a presentation key) | **lost** at `?deeper=1` and at the plain page; kept only at the exact address (C6) |
| a control inside the page that is not plan data | none | **replayed**: see 3.1 | **replayed**: see 3.2 |
| the dial's form fold on a bill landed by `?edit=` (`seam-edit-w1-dial.log`) | - | a tap inside "Optional details", away, Back: the part open, the tick kept, "Undo my typing", the same as the unchanged page (`seam-edit-w1-inline.log`) | - |
| plan bytes after opening, shutting, ticking, keeping | equal (A1, A11) | equal (B3) | equal (C9) |

### 2.2 `npm test` on wave 1 plus each prototype (`$J/npm-test-w1-*.log`, three runs in parallel)

| | failures | what they are |
|---|---|---|
| inline | 7 | 4 wording pins of Federal estimate the designer had named and not yet updated (`module.test.mjs` 1992 and 1996, `wording-left` 189438, `wording-verify` 189448); 2 timing tests that fail under three parallel runs (2138, 2217); 1 that needs a git checkout (188858, my copy has none) |
| dial | 18 | **13 crashes of the helper under the module tests' text-only stand-in**: `host.replaceChildren is not a function` (10 Federal estimate tests) and `form.querySelectorAll is not a function` (3 Expenses tests); 2 wording pins; 2 timing; 1 git |
| stages | 2 | 1 timing, 1 git. The designer moved 7 test reads to the deeper level by hand |

Helper tests on the wave 1 tree: inline 11 of 11 (`$J/inline-more.test.mjs`, a copy of the designer's
`inline-work/more.test.mjs`; it is not in the prototype worktree), stages 6 of 6 (`tests/depth.test.mjs`), dial none
written. A whole `npm test` took 628 s under the parallel load; the first-view counter each design wants adds about 30 s.

### 2.3 Size

| | new core files | per page (Federal estimate) | Settings | other files a page touches |
|---|---|---|---|---|
| inline | `core/ui/more.js` 190 lines (about 25 of them `moreOptions()`, which wave 1's `more: true` replaces) | `view.js` +72 / -37, 4 pins | one line, specified, not built | none |
| dial | `core/detail.js` 43 + `core/ui/more.js` 135 | `view.js` +58 / -26; Expenses +3 | a card, +17 | none; but every page is now two states |
| stages | `core/depth.js` 60 + `core/ui/deeper.js` 183 | `view.js` +85 / -42, `module.test.mjs`, `tests/wording-verify.test.mjs` | a card, +25 | `journeys.js` (step titles), the path fixtures, `tests/short-page.test.mjs` |

## 3. What breaks

### 3.1 Dial: wave 1 replays the page row (measured)

Wave 1 keeps every input in `#content` that is not marked `data-no-keep` and, when it puts typing back, fires
`input` and, on a tick box, `change` (`core/place.js` line 356, `fire`). The row's `change` handler calls
`detail.setPage()`. So:
- Tick the row: the typing store holds `show everything on this page = 1 over 0` (`seam-keep.log` R1).
- Untick it on a page the device draws ticked, then choose Settings > "Everything open": Federal estimate opens with
  one part open and `planner.detail` now holds `"taxes/federal": false`. The replayed untick overrode the setting
  (`walk-dial-trace.log` B7).
- Tick the row, then Settings > "The short view" while the device is already on it: nothing changes, because the
  radio was already chosen, so the page's own choice cannot be cleared from Settings (R4, R5).

The fix is one attribute (`data-no-keep` on the row). But it shows the dial's real cost: a control that is page state
and not plan data, on every adopted page, inside the one area where wave 1 treats every control as the person's typing.

Also measured or read in the code:
- `part()` builds its body with `host.replaceChildren` and `optional()` reads `form.querySelectorAll`. Three test files
  draw views with a text-only stand-in that has neither, and those 13 tests crashed. Inline and stages build with `ui.h`
  and `append` only; they had learned this, and the dial's helper had not.
- Any function body is lazy (built when opened). A builder who writes `body: () => tiles` has, without knowing it,
  taken the text out of find-in-page and out of every Node test that reads the page. Inline is lazy only when asked
  (`lazy: true`).
- With "Everything open" chosen, a page that has not adopted the helper stays shut (B7: Will the money last? 0 of 1
  open). On the day the card ships, 97 views still write their `<details>` by hand.
- `?detail=all` in an address writes the device's choice for good (`load()` saves it), and `detail` is not a wave 1
  presentation key, so the typing is filed apart as well.
- Two states double every first-view check, every screenshot and every smoke run. The no-drift test proves the words
  are the same in both, but not that each state fits the phone.

### 3.2 Stages: wave 1 replays "Keep this" (measured, `seam-keep.log`)

- K1: ticking "Keep this on the Federal estimate page" on `?deeper=how` is filed as typing under that address.
- K3: unticking it on the short page is filed as typing under the short page's address; `planner.depth` is empty.
- K5: Back to the deeper entry. Wave 1 ticks the box again, fires `change`, and the part is kept again, with
  "Undo my typing" beside a tick box that is not in any form.
- K6: a new visit to the short page. Wave 1 unticks it again: the part is put back.

The kept list now follows whichever page the person saw last, not their tick. The fix is the same attribute, on two
ticks.

Also measured or read in the code:
- `deeper` is not a presentation key, so `?deeper=1`, `?deeper=how` and `?deeper=itemized&show=x` file typing under
  three keys. Typing left on one is not found from the others or from the short page (C6). Making `deeper` a
  presentation key would carry typing to a short page where its form does not exist.
- The `?show=` landing is a `location.replace` called inside `deeper()` while the page draws. Wave 1's conventions say
  to use `ctx.replace(href)` so the "‹" stays honest. It worked in the walk; it is still a side effect of drawing.
- A `?show=<key>` finds its part only through the part's `shows` list. Rename a form field and the landing silently
  stays on the short page, where the box is not. No test lists the keys a form really draws.
- `stageOf()` reads `plan.guide.journeys.plan.finishedAt`, which none of the eight invented households has. The stage
  needs new walked-path fixtures, and every page's offer then depends on claude-f's `journeys.js`.
- Tests have to say which level they read (7 reads moved on one page). Every page needs a sentence per case (S3);
  the designer's own first try produced a false one. "Weeks, not days" is the designer's estimate.
- The view returns `dp.page(root)`'s cleanup. A page that already returns its own cleanup has to combine the two by
  hand.

### 3.3 Inline (measured)

- `?open=` is not a presentation key, so typing kept on `#/taxes/federal` is not found at
  `#/taxes/federal?open=itemized` (A10). It also adds a second landing word to an app that already uses `?show=`
  (Assumptions).
- Back to an older entry shows wave 1's record of that screen, not the device's newer choice (S3, S4: shut on entry 3,
  shown open on entry 1, shut again on a new visit). The design's own table says exactly this, and it is consistent
  with "Back returns to the screen as you left it". But two stores now hold fold state and nothing tests how they
  meet; the design leaves that test to its commit 10.
- `KEPT` includes `own`, `figures` and `options`: a form opened once to type one figure is kept open across days. The
  owner's advocate measured the page 2.8 screens long on the next visit. Wave 1 already keeps a form fold for the visit
  (`MORE_OPEN`) and per history entry, which is what a form needs.
- `moreOptions()` moves labels of a built form into a part: a second way to do what `ui.form`'s `more: true` does, with
  a third label ("More options", which the research's own source rules out). The kit's way also gets Return-walking,
  the "N boxes need a fix" line and `setMoreOpen()` for free. (The dial's `optional()` does the same surgery. On an
  `?edit=` landing it was as safe as the unchanged form with wave 1, `seam-edit-*.log`; it is still a second way.)

### 3.4 Shared by all three

- Each adds a key to `localStorage` (`planner.opened`, `planner.detail`, `planner.depth`) that `docs/DATA_MODEL.md`
  "Not in the plan" must list, with `planner.view` and `planner.nav`, which it misses today.
- Each is a new core file that pages import, so it has to be on `main`, through the gate, before or with its first
  page (rule 16).
- Each needs the same first-view counter (proved by inline's `first-view.mjs`, the dial's `feas.mjs` and stages'
  `short-page.mjs`: 141 to 150 of about 159 views draw in Node) with a `KNOWN` list that may only go down. That is not
  what separates them.

## 4. Each design, as the person who keeps it

**Inline: 8.**
- What a builder writes per page: a list of `{ id, kind, says, set, open, body }`, and nothing else.
- What they can get wrong: an unstable `id` (the memory resets for that part, which is harmless); an alarm inside a
  part (S5 catches it); `open: true` left on for good (S11 catches it); a part title that a guide step names, renamed
  (no test yet: graft 6).
- Unadopted pages stay correct, only longer, so nothing promises more than is built.
- A memory that outlives the visit is the one thing here that a maintainer has to explain. Narrowed to the reading
  parts and with the Settings line, it is small.

**Dial: 5.**
- The core is small and the decision order is one table. But a kind chosen wrongly (`how` against `tech`) shows only
  in the state nobody screenshots, so the no-drift test becomes mandatory on every page, not a nice extra.
- The row and the device card are the two places this design touches the person's state, and the row is exactly the
  kind of control wave 1 replays.
- It scores above stages because every one of its failures is a line or two to fix, and its page adoption is as cheap
  as inline's.

**Stages: 4.**
- The address as the state is the most robust idea in the three, and it is the reason this is not lower.
- But every page is restructured into two levels, written per case, tested per level, and kept in step with its form
  keys (`shows`), with the path (`finishedAt`, `journeys.js` titles) and with two typing addresses.
- The failures are quiet ones: a landing that goes nowhere, typing that is not found, a kept part that flips.
- With about 150 pages over budget and several sessions, I would not want this to be the habit each builder must learn.

## 5. The answer to the four questions

| | smallest | hardest to get wrong page by page | testable in `npm test` | safe with redraws, Back, reload, landings, place memory |
|---|---|---|---|---|
| inline | 1 file, 1 list; no Settings code yet | yes: one list per page, mistakes are local and visible | 11 helper tests pass on wave 1; counter proven; 4 pins to update | yes, except `?open=` (typing split) and the untested meeting of two fold memories |
| dial | 2 files, but two states for every page | a wrong `kind` or a function body hides in the second state | no helper tests; the helper breaks 16 tests under the stand-in | redraw, Back, reload and `?show=` yes; **the row is replayed by wave 1** |
| stages | 2 files plus fixtures, a Settings card and per-page restructuring | no: sentences per case, `shows` lists, level-aware tests | 6 tests pass; page tests updated; needs walked-path fixtures | the address is safe; **"Keep this" is replayed by wave 1**; typing split across levels; `location.replace` while drawing |

## 6. Grafts onto inline

1. **Forms use wave 1's `ui.form` `more: true`; delete `moreOptions()`.** One fold for optional boxes app-wide. It
   already opens when a box holds something or fails at Save, keeps the person's choice for the visit, and has
   `setMoreOpen()` for a device choice. The label is the kit's "More details (optional)" until the owner or designer
   says otherwise; not "More options".
2. **`KEPT` = the reading parts only (`more`, `how`).** Parts with boxes (`own`, `figures`) are kept for the visit by
   wave 1 and start shut on the next visit with their "1 set by you" status, as in the dial. This also answers the
   owner's advocate's blocker 2.
3. **Land with `?show=<part id or a key it holds>`** (the dial's `holds`), not `?open=`. `show` is already a wave 1
   presentation key, so typing is found at the landing, and the app keeps one landing word.
4. **From the dial, the no-drift test**: draw every adopted view with the memory empty, then with every part forced
   open (and `setMoreOpen(true)`), and compare the markup with `open` removed. Same words, same figures, same boxes.
   It is cheap under the stand-in and stops any state-only text.
5. **If the owner wants a toggle** (the owner's advocate's blocker 1), give it as one Settings row (Settings is a
   System page; wave 1 never keeps typing there, so nothing replays it). It feeds one line of `part()`'s order (after
   "a reason", before "shut"), opens reading parts only, and calls `ui.setMoreOpen()` for forms. No row inside
   `#content`.
6. **From stages: S3 and S11 as tests.** One written sentence per verdict, each read by a test; and a node test that
   every `opens:` in `modules/overview/guide/journeys.js` names a `summary` the page draws for its household.
7. **A guard for the class of bug that bit both of the others**: a static check that an `input` or `select` a view
   draws outside a form, that saves nothing to the plan (a view or device choice), sits under `data-no-keep`. Wave 1
   gave the attribute; nothing yet makes anyone use it.
8. **The agreement test now, not in commit 10**: `tests/place.test.mjs` gains inline's 2.4 table as cases (open by
   tap, save redraw, Back to an older entry after a later shut, new visit), under the fake DOM that test already uses.
9. **Keep inline's stand-in discipline** (`ui.h`, `append`, every DOM call optional) as a rule in the helper's
   header, and run `tests/more.test.mjs` under both stand-ins.

## 7. Blocking before the first page uses the helper

1. **Wave 1 on the shared branch first.** Every "safe" row above was measured on wave 1. Without it a part opened by
   hand shuts after a save on the dial, and the inline helper is the only memory.
2. **Grafts 1, 2 and 3 in commit 1** (`moreOptions()` out, `KEPT` narrowed, `?show=` in place of `?open=`). Each is a
   measured fault: a second form-fold mechanism, a page 2.8 screens long a day later, typing lost at a landing.
3. **Federal estimate's four pins updated in the same commit as the page** (1992, 1996, 189438, 189448), with the
   judges' page fixes (the child care line stays on the first view; the saved green line says the new headline).
4. **The toggle question goes to the owner before the Settings line ships** (graft 5 or nothing). It is a decision,
   not a build risk: the helper has the one place it would go.

Not blocking: the links card's name, the budget numbers, the part's marker. They are decisions recorded in the designs.

## 8. Not verified

- A real iPhone, VoiceOver, Safari's find-in-page and print.
- Only one page per prototype is built (Federal estimate; the dial also has the bill form). The per-page risks of the
  other pages are argued from the code and the designs.
- `router.sameEntry` accepting a deeper entry for a `data-back` link to the short page (stages 2.4) is argued from
  the code, not walked.
- My copies carry wave 1's code exactly and docs from an earlier base. The four Federal pins and the dial's crashes are
  from that run; the 2 timing failures and 1 git failure come from my setup.
- The stage (`finishedAt`) was not reached by any walk; I read it.

## 9. Files

| what | where |
|---|---|
| this report | `$SP/opt/judge-build.md` |
| walks on wave 1 | `$J/walk-inline.mjs` `.log`, `$J/walk-dial.mjs` `.log`, `$J/walk-dial-trace.mjs` `.log`, `$J/walk-stages.mjs` `.log`, shared `$J/jb-lib.mjs` |
| seams | `$J/seam-inline.log`, `$J/seam-dial.log`, `seam-dial2.log`, `seam-dial3.log`, `$J/seam-keep.mjs` `.log` (the replay of the row and of "Keep this"), `$J/seam-edit.mjs`, `seam-edit-w1-inline.log`, `seam-edit-w1-dial.log` |
| `npm test` | `$J/npm-test-w1-inline.log`, `-dial.log`, `-stages.log` (27 MB each) |
| helper tests | `$J/inline-more.test.mjs` (run with `ROOT=$J/w1-inline`), `$J/w1-stages/tests/depth.test.mjs` |
| screenshots (20) | `$SP/opt/judge-build/` (`inline-w1-*`, `dial-w1-*`, `stages-w1-*`) |
| my copies of wave 1 with each prototype (75 MB each, safe to delete) | `$J/w1-inline`, `$J/w1-dial`, `$J/w1-stages` |
