# place2 design: scope critique (the maintainer's view)

This critique is written from the view of the person who has to maintain the result.

**What I ran.** All scripts and outputs are in `w1/place2/cs/`.
- `coverage.mjs` checks the three theme files against section 8 (`coverage.out`).
- `tip/` is a `git archive` of the branch tip 658c5b8 with the prototype applied: `place2.patch`, `core/place.js` and `tests/place.test.mjs`.
- On `tip/` I ran:
  - `tools/run-tests.mjs` (`test-tip.log`) and `tools/check.mjs`.
  - The architect's `e2-redraw.mjs`, copied with my port.
  - Four scripts of my own: `t-setup.mjs`, `t-nw.mjs`, `t-oldkey.mjs` and `t-flash.mjs`.
- `merge/` is the tip with place2's patch applied, then the taps prototype's diff applied with `git apply --3way`.
- The browser runs were phone size, touch, sandbox, on port 9391. I stopped that server afterwards.
- The repo, `ux/app` and the architect's `proto/` were not touched.

## Blocking

**1. The design was measured on c385e41. The branch has since moved, and wave 2 has already closed or duplicated parts of this track.**
- Evidence: `git log c385e41..HEAD` shows 62 commits and 267 module files. `core/app.js`, `router.js`, `frame.js` and `base.css` are unchanged, so the patch applies cleanly. The pages, however, are not unchanged. On the tip I ran `e2-redraw.mjs off` (today's shell) and compared it with the architect's `out/e2-off.log` from c385e41:

  | flow | c385e41 | tip |
  |---|---|---|
  | retirement/projection | section shut, jump of 1,121 px | section open (O->O), 33 px |
  | debt/credit-cards | section shut, 453 px | section open (`----O->----O`), 0 px, notice seen |

  So the design's own e2 table now credits the shell with closures that pages made: claude-g's `keepOpen` in credit-cards/view.js and claude-e's d1973e2.
- Two pages now keep their own drafts:
  - Get started keeps drafts in `planner.setup.drafts` (6a65660 / 030bebe). `t-setup.mjs` with `place=off`: "4,321" typed on owe-amounts survives a reload. With the prototype on, both `planner.setup.drafts` and `planner.place` hold it.
  - People keeps `kept.draft` (e4bc7af, people/view.js:103-104) and refills by `.value`.
- Section 3's setup row ("mirror its drafts to sessionStorage") has already been built.
- Change:
  - Rebase onto the tip. Re-run e1, e2, e3 and e5 there.
  - Mark each finding as closed by a page commit, closed by the shell, or open.
  - Say whether the shell stands aside on pages that keep their own drafts (setup, People) or whether those page drafts are removed. A `data-no-keep` on the page root is one way.
  - Re-cut section 3 to what is still open.

**2. Findings waved through without a working behaviour** (coverage: 52 of 52 rows present, every row cites a B#, so the gaps are in the claims, not the table):
- **p-balance/x-1, Net worth part.** Section 8 says "typing parked (B7 line)". `t-nw.mjs` on the tip with the prototype: + Add another account, "Brokerage two" / 12000 typed, then "Save today's totals". The result is `drafts: {}`, no line and no bottom note, and the reopened add form is empty. Today's shell gives the same.
  - This is the break critic's blocking 2 (`carried.parked` is ignored on the keepScroll path), now shown on a finding the coverage table claims.
- **j-monthly-return/x-typed-lost.** The "B6 for the check-in note across the month chips" claim fails the same way: `cb/t2b-checkin.mjs` gives `note: ""` and `drafts: {}`.
- **j-debt-fixer/x-2 and p-cashflow-a/CF-3** (headline: Back with an edit form open leaves the page), **and the form half of j-fat-fingers/x-2.**
  - These rest on `ctx.place.sheet` (section 3), which no build step builds.
  - "Compared" says `ctx.layer` from the first design instead.
  - Taps' step 4 builds `router.layer(close)`.
  - There is no owner and no step, and wave 2 cannot adopt a helper that does not exist.
- **j-heavy-waiting/W4 (the "says nothing" and focus half) and p-retirement-b/RB1 (Roth stop ages).**
  - The design sends both to section 3, which is claude-e's lane.
  - claude-e wrote "Waits for wave 1: ... W4, RB1 ... and every SH-* row on these pages" (WORKBOARD, 21:30) and has released the claim.
  - The two have pushed it to each other, and nobody owns it now.
- **j-fat-fingers/x-2, menu half.** It is cited as M8, "not prototyped". It is taps M5. Cite that instead.
- **j-first-family/F2 and j-first-renter/x-4.** These were closed by page commits (item 1). B8 adds a second copy; it does not close them.
- **j-first-retiree/x-2, p-transactions-helpers/x-notice-jump and the second jump in p-retirement-b/x-1 (B12).** The `remove()` override lets the 4-second timer through while a finger is down (`cb/t11-notice-touch.mjs`: 353 -> 229). Deleting the timers is labelled "optional". claude-d also listed x-notice-jump as "waits for wave 1".
- Change: give each of these a real wave 1 behaviour, or move it explicitly to a named owner with a date, and correct section 8.

**3. What will be built is not defined.**
- Evidence:
  - Section 7 says `core/router.js` is "unchanged in the end".
  - "What I would take into one build" says "so `core/router.js` changes after all".
  - That list adds about eleven items that appear in no behaviour, step or check: `router.layer`/`ctx.layer`, the same-form refill rule, a 24 h expiry and size cap, the echo at the top, the echo's own double-tap guard, stay by length, an 8 s quiet-stop hold, `overflow-anchor: none`, a cleanup check rule, `forgetAfter`, and the single "Not saved yet. Undo my typing" cue.
  - The design itself says those would replace parts of B6, B7, M1 and M7.
- Change:
  - Write one list of what wave 1 builds, folded into sections 1, 2 and 6, each item with its check. Everything else is marked "not in wave 1".
  - Drop the items another track already does. The echo's double-tap guard is taps M1.

**4. Cut M2, the kept page, from wave 1. No finding needs it, and it is the riskiest piece.**
- Evidence:
  - The design's own table shows M1 alone (`?keep=off`) at 18/18 for Back, 18/18 for sections, 18/18 for Forward and 17/18 for Reload. M1+M2 is no better, and Reload is 16/18.
  - B13 is cited for j-debt-fixer/x-2, FF2 (2), CF-3 and p-cashflow-b-goals/x-3. Their "should" asks Back to close the form, to ask, or to keep typing. Only x-3 asks to reopen the add form, and section 3's `parked()` reopen does that on every visit, not only while the plan is unchanged.
  - The break critic's blocking 3 (a phantom "kept" line on the Dashboard, `cb/t1-keptpark.mjs`) happens only on the kept path.
  - M2 needs its own list of conditions: plan identity, a counter bumped by 3 events, the module's last address, no cleanup returned, a drawn flag, and a date check (risk 3, not built). It also needs a frame redraw on reattach and a scroller restore.
  - Both other tracks must special-case it (taps: "`place.unpark` returns before this step").
- Change: remove step 7 and the `?keep` switch from wave 1. Offer B13 later, after a phone soak, as its own change.

**5. The joins with taps and forms2 are not named, and a naive merge breaks a place2 invariant.**
- Evidence: in `merge/`, the taps diff applied over place2 leaves 5 conflicts in `core/app.js` (imports, module globals, the start of `show()`, drawn bookkeeping, the fresh-notice block) and 1 in `frame.js`.
  - **Start of `show()`.** Taps moves `current = route` and `cleanup()` before choosing the module and adds `stampEntry`. place2 runs `place.leave({ keepable: ... && !cleanup })` before `cleanup()`. If taps' order wins, every page counts as keepable, including the ones that return a cleanup (backups, audit, diagnostics).
  - **Two numberings of history entries.** Taps uses `history.state.n/from/via` plus `planner.firstEntry`. place2 uses `history.state.pk` plus `planner.place` entries with `prev`. Taps step 4 expects `router.entry()`, `router.layer` and `router.back(href)` "from the place track", and place2 provides none of them.
  - **Three back-link mechanisms in `frame.js`.** place2 has `data-back` plus a document listener. Taps has `ctx.goBack()` on its named rows. The echo's copy of the link is a third.
  - **Two wrappers of `scrollTo`, `scrollBy` and `scrollIntoView`.** Taps has `honourReducedMotion`. place2 counts self-scrolls and also wraps `focus`. Both are installed from `app.js`.
  - **Two tappable bottom notes.** forms2 has `ui.toast(text, {action})` with `.undo-bar` (10 s). place2 has `echo(..., go)` with `.save-echo-go` (7 s). forms2 2.12 P3 asks that `echo()` go through `ui.toast`.
  - **forms2's asks of this track go unanswered.** P1 (bring the opener's twin into view after a save) and P4 are absent from place2, and there is no rule for which runs first, P1 or `holdAnchor`.
  - **Taps' "paint first" would paint a flash at the top.** On a return, the prototype still calls `window.scrollTo(0, keepY)` with keepY = 0 before the draw. Today no frame is painted there: `t-flash.mjs`, `keep=off`, shows 0 frames under 50 px on projection, plan and recurring. Taps' one-frame wait would paint one. Taps' sentence "the blank frame stands at the restored place" is true only if returns scroll to `record.y` before that wait.
- Change:
  - Add a joins table with a landing order: one entry numbering and `layer`/`back` API in `core/router.js` with a node test; the order leave -> cleanup -> stamp/arrive; one scroll-API wrapper module; one bottom note built on `ui.toast`; who does P1 and in what order relative to the anchor; no `scrollTo(0)` on a return.
  - Keep place2's footprint in `app.js` to a few calls into `place.js`. Today the prototype puts about 196 lines into the busiest function of the file, which three tracks edit.

**6. The permanent tests miss the heart of the design.**
- Evidence:
  - `tests/place.test.mjs` tests `soft`, `pathOf`, `prune` and `secretName`. It passes on the tip; the full run was 188,584 pass, and its 2 failures are environmental: no `.git` in the export, and a timing test while two browsers were running.
  - The rules that decide things are inline and untested:
    - the back-link query match in `installBackLinks`
    - the "seen" geometry (p-taxes/x-5's 22-70 px under a 56 px bar)
    - the fold rule `d.open === f.drawn`
    - the refill rule `defOf(c) !== x.d`
    - `takeCached` validity
  - The locator itself (scope, own name, uniqueness fallback) is checked only by `e5-locator.mjs`, which lives in the scratchpad. Step 1 says "else the locator stays covered by e5".
  - Steps 2-7 are each checked only by e1-e9, which are also scratchpad scripts.
  - The touch rules this design names (D-BACK, D-SCROLL-KEPT, D-SEEN, D-FOCUS-KEPT) cover none of B6, B7, B8, B9, B10 or B12.
  - D-BACK lists a place that is lost only some of the time as "Back sometimes loses the place" and does not count it. So it passes today's race.
- Change:
  - Extract those rules as pure functions over plain data and test them in node. The locator key can be built from a list of descriptors, and that can be tested too.
  - Move the e-scripts that act as checks into `qa/` or the touch sweep at the step that first uses them.
  - Ask the sweep's owner for these rules:
    - D-DRAFT: type, leave by a link, the menu or Back, return.
    - D-OTHER-FORM: type in form A, save form B.
    - D-FOLD-KEPT.
    - D-STILL: nothing moves for 6 s after a save without a touch.
    - The break critic's D-ROW-SWAP and D-NO-PHANTOM.
    - A strict D-BACK once wave 1 removes the race.
    - A D-TOP exemption for `a[data-back]`.

## Should fix

1. **B12: delete the timers.** On the tip, 101 `setTimeout(() => x.remove())` lines sit in 95 view.js files. 10 of those files are claude-a's; the design says 13 files and "102" lines. Delete them in one scripted change and add an `npm run check` rule against new ones. Keep the per-node `remove()` override only as a bridge for claude-a's 10, and allow removal only inside a trusted event (break critic, should 1).
2. **Parked drafts that can never come back stay forever.** `t-oldkey.mjs`: a parked draft whose locator no longer matches (a deploy that changes the key spelling, a label renamed by a wave-2 wording pass, a row deleted in another tab) shows "What you typed in “Your accounts” is kept, not saved yet. Open it again to finish it." on every visit for the rest of the session. Put a version stamp on `planner.place`, and drop a parked item when its form identity cannot appear on the page again.
3. **Use `data-back` only.** No module outside `frame.js` has a "‹" link; the only two are `<button>`s in setup/view.js:454 and :496. The "‹" text heuristic matches nothing today and would turn any future "‹ Previous month" link into `history.back()`.
4. **Weigh a simpler refill than the global MutationObserver.** A `ui.form` build-time hook in forms2's dom.js would refill parked typing for kit forms. The observer's 400 ms and 1.5 s timing guesses and its last-tap-in-form test are where the break critic's blockings 1 and 3 come from. Hand-built boxes are already drawn by `render`, so the arrival and keepScroll apply covers them.
5. **One cue for kept typing.** Today there are four: the line above the form, "Not saved yet" by the button, the parked line at the top, and a bottom note on a stray tap. The design concedes this in "Compared" (point 8).
6. **Remove the prototype-only pieces in the build.** `window.__place` exposes typed figures to any script, and `__placeLast`, `?keep=`, `anchor=off` and `selfscroll=drift` are switches for measuring. Step 8 removes only `?place=off`.
7. **Owner-facing records.**
   - Add a docs/DESIGN_LOG.md entry for the six choices made without asking the owner. Taps does this.
   - Add `node tools/shot.mjs` checks (AGENTS rule 13), light and dark at 390 px, of:
     - the kept line
     - the parked line
     - "Not saved yet"
     - the echo with its 44 px link (`--accent-ink` on `--panel`)
8. **Tell wave 2 in CONVENTIONS which mechanism owns what.** Pages are building their own place and draft keeping: People's `kept.draft`, setup's drafts, payoff's `movedNow.top` with `scrollBy` (b9888d1). CONVENTIONS should say what the shell owns, so later pages stop duplicating it.

## Tried and held up

- **The patch applies cleanly to the tip** (658c5b8): the shell files are unchanged since c385e41. `node --check`, the 4 place tests and `npm run check` all pass on it.
- **The shell still fixes what the pages have not.** `e2-redraw.mjs full` on the tip:

  | flow | today | with the prototype |
  |---|---|---|
  | benefits | section shut, -204 px, "120" lost | open, 0 px, kept |
  | health | "Silver PPO"/"250" lost | kept |
  | estimated | "1,000" lost, 317 px | kept, -1 px |
  | accounts | note lost | kept |
  | buckets, medicare | section shut | open, 0 px |

- **Coverage is complete as a table**: 52 of 52 findings present, no theme mismatch, every row names a behaviour. The gaps are in the claims (blocking 2).
- **Static site.** A new core file needs no change to sw.js or the main gate:
  - The PC's import map is generated from the tree (server.mjs `importMap()`).
  - sw.js keeps no file list.
  - `tools/build.mjs` bundles from core/app.js.
  - `core/place.js` imports nothing, so core stays dependency-free.
- **No flash at the top on a redrawn Back today.** `t-flash.mjs` with `keep=off`: 0 painted frames under 50 px on projection, plan and recurring. Today's shell painted 75 frames at 0 on recurring. This holds until taps' wait is added (blocking 5).
- **M2's plan-identity test is sound if M2 is kept.** `store.update` replaces the plan object (store.js:294, `structuredClone`).
- **Lanes are respected.**
  - No view.js is touched, nothing of claude-a's, and nothing in setup/compute, projection/compute or the estimators.
  - base.css gets only two selectors, both for elements the shell draws.
  - Every file falls under claude-b's wave 1 claim in TEAM.md; `core/place.js` is the "new small file under core/".
