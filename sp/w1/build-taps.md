# Build log: wave 1, track "taps" (builder claude-b)

Owner's request (2026-11-11): stress test every touch and input; easy to know the next step, to go back, to navigate, to
focus. Track "taps": the second-tap guard, a sign of life on slow pages, the menu's search box, the drawer and focus, page
names that fit the bar, an address that names no page, ways back on screen.

- Worktree: `$SP/w1/build-taps`, detached at `ee09f6e`. Nothing committed. `planner.properties` (port 9421) is git-ignored.
- Plan: `$SP/w1/taps/final.md` + `steps.json`. Seams (they win): `$SP/w1/seams.md`.
- Servers I started, and only those: 9421 (`build-taps`, my patch alone: the degraded build), 9422 (`taps-stack`: place's
  first WIP + my patch; stopped by its time limit), 9423 (`taps-stack2`: place's current build + my patch, the build the
  acceptance results below come from), 9424 (`taps-base`: pristine `ee09f6e`, for "fails before").
- Edits were made with exact-once replacers (`$SP/w1/rep.py`, `$SP/w1/taps-build-edits/*_edits.py`) so the seams' line
  regions could be checked hunk by hunk.

## The steps

### T1. The tap guard: a double tap does one thing, meant taps always land
- Files: `core/taps.js` (new), `tests/taps.test.mjs` (new), `core/app.js` (install, `taps.drawn()` explicit calls).
- `verdict({ last, tap, drawnAt, settling, movedAt })` → `stale` (the tap was aimed at a screen that is gone or still
  settling), `new-page`, `changed`, `repeat` (same control within 40 px and 0.8 s; never for a box, picker or text area;
  `data-taps="repeat"` opts out), else `ok`. `fieldText()` gives two unnamed pickers different signatures. Element
  access goes through the prototypes (seams I10: never a property of a form element). `planner:reveal` → `taps.moved()`.
  The swallowed-tap list is kept only in the sandbox.
- Checks: `node --test tests/taps.test.mjs` 16 of 16 (fails before: the module does not exist). B1 28 of 28, B2 14 of 14.
- Saw: Income's "+ Add another income" tapped 2 and 4 times at 150/400/750 ms opens one form; Add tapped twice saves one
  income; the next row's picker re-tapped at 300/600 ms opens normally.

### T2. Find a page: one kept search box
- Files: `core/app.js` (`searchBox`, `buildNav(filter)` rebuilds only `.nav-list`, `enterkeyhint="go"`, Enter opens the
  first row, Escape clears, a new address empties it; `navStale` rebuilds on open on a phone).
- Checks: B4 4 of 4 (typed key by key: "social", "chance", "net worth" stay whole, caret at the end, one box), B5 4 of 4.
- Saw (`shots2/drawer-search-390.png`): "social" in the box, Social Security first under Retirement.

### T3. Ranking by whole words; All pages' Best match by name
- Files: `core/search.js` (`matchScore`, `hasWords`, `aliasHit`, PLAIN additions), `tests/search-words.test.mjs` (new,
  10 tests; fail on the old `search.js`), `modules/overview/pages/view.js` + README (Best match up to 4 pages with
  score < 1; the address keeps the word 400 ms after typing rests, on change and on a result tap; cleanup clears the timer).
- Checks: search-words + search + help + pages tests 26 of 26. B6 9 of 9, B7 3 of 3.
- Saw: "car" → Vehicles first, never Medicare; "will" → Estate documents first. "car" also lists Salary and raises
  ("career" starts with "car", score 0.5), as designed.

### T4. The drawer: hidden when closed, contained, keys and screen readers
- Files: `core/ui/base.css` (lines 41-77 only), `core/app.js` (`paintDrawer`, `openDrawer`, `closeDrawer`, `releaseDrawer`,
  `openFromMenu`, Escape, skip button, `focusQuietly`), `index.html` (skip button, `aria-controls`, `aria-expanded`).
- Closed on a phone: `visibility: hidden` (after the slide), so Tab never walks it. Open: `#content` and `#sync-bar`
  `inert`, `html.drawer-open` stops the page behind it moving, `overscroll-behavior: contain`, the menu is a Back layer
  through place's `router.layer(close)`.
- Checks: B9 7 of 7, B10 3 of 3, B11 4 of 4, B13 2 of 2 (+ info line).
- Saw (`shots2/drawer-dark-390.png`): the dark drawer, the current page marked, no "‹" on a first page.

### T5. History: the menu as a Back layer, the bar's "‹"
- `core/router.js` and `tests/router-replace.test.mjs` are the place track's (seams C6/S1); I did not touch them.
- Files: `core/app.js` (`entryNow()` adapter over `router.entry()`/`router.at()`, `updateBack()`, `OWN_BACK`, `ctx.cameFrom`,
  `ctx.replace`, menu rows `data-via="menu"` → `router.open(href, { via: "menu" })`), `index.html` (`#nav-back`),
  `base.css` (`#nav-back`, `.covered`).
- On `ee09f6e` alone (no `router.entry`): no "‹" and no menu Back layer; nothing breaks (checked on 9421: no page errors,
  the menu opens and closes, typing and Go work).
- Checks: B16 9 of 9 on the stack.

### T6. Named ways back at the top and above the one way on
- Files: `modules/overview/guide/frame.js` (`HUBS`, `namedBack`, the named rows top and `nav.gb-compact.gb-foot-back`,
  `planner.reviewTrail` one page further, `data-back` on every "‹ Back to ..." it draws except the review row at line
  192, which is place's), `tests/ways-back.test.mjs` (new, 4), guide README.
- Checks: ways-back + guide tests 59 of 59. B17 6 of 6 on the current stack. On the first stack (place's earlier WIP,
  without its `a[data-back]` listener) the bottom link grew the history (3 → 4): the "goes Back" half is place's
  listener; with it, 3 → 3.
- Saw (`shots2/alert-row-bottom-390.png`): "‹ Back to Needs attention" just above "Continue your plan: step 2 of 8 ›".

### T7. Paint first
- Files: `core/app.js` (`afterPaint`, `busy`, `paintFirst`: one painted frame before the work on a new address; heavy
  pages show "Working it out…" with `role="status"`, light ones a quiet placeholder after 180 ms; `#content[aria-busy]`;
  lazy `ctx.derived`; `computeRemote` waits a painted frame and never settles for a page that is gone).
- Checks: B3 10 of 10 (name on screen and menu closed 16-23 ms at CPU 1x, 43-70 ms at 4x; "Working it out…" with it;
  a late second tap on Goal seek lands on Goal seek, plan unchanged), B8 1 of 1.

### T8. Focus at the top, each thing said once
- Files: `core/app.js` (`landFocus`, `focusQuietly`, `announce` with the 2 s and focus rules, `announceFresh` green only).
  Reduced motion for page scrolls is the place track's (seams C7: no `calmScroll` here).
- Checks: B12 3 of 3. With place's current build the save's green line is said by place focusing the notice (forms N1)
  and my `announce` drops its copy because the focus holds those words: one read-out, as I5 says.

### T9. The top bar
- Files: `core/ui/base.css` (2-line name, the pill at most 124 px on two lines under 480 px, three smaller lines under
  375 px, `#nav-back` 44 x 44).
- Checks: B14 18 of 18 (150 names x 4 pill wordings x "‹" on/off x 390/320: 0 cut, pill at most 2 lines, no sideways
  scroll). Saw (`shots2/bar-long-320.png`, `-dark`): "Bills and regular payments" on two lines next to "‹" and the pill.

### T10. Addresses that name no page
- Files: `core/address.js` (new: `missing`, `fixCase`), `tests/address.test.mjs` (new, 7), `core/app.js` (`missingCard`,
  the "on again" line).
- Checks: B15 8 of 8 (typo, the topic's address, wrong case, `#/system/devices` and `#/ai/critic` in the household's view,
  switched off → "Turn it back on" → "Income is on again." read once). Switched off on the computer: node test only.
- Saw (`shots2/missing-390.png`, `shots2/off-390.png`).

### T11. Docs and permanent checks
- `qa/shell-lib.mjs`, `qa/shell-taps.mjs`, `qa/shell-search.mjs`, `qa/shell-menu.mjs`, `qa/shell-bar.mjs`,
  `qa/shell-ways.mjs` (each takes a base URL; Playwright; the sandbox; the invented family of `qa/fixtures`).
- `docs/CONVENTIONS.md` (what the shell does around `render`; `ctx.derived`, `ctx.cameFrom`, `ctx.replace`, `announce`;
  named way back in the frame list), `CHANGELOG.md` (one line), guide and All pages READMEs.
- Not written (seams C17 and "4. docs"): `docs/DESIGN_LOG.md`, `docs/TEAM.md`, `docs/WORKBOARD.md`, `docs/PLAN.md`.

## For the integrator: choices for the one docs/PLAN.md section (C17)
1. A tap within 40 px and 0.8 s of the last one on the same control is the same tap; a burst stays one tap for 4 s; a
   box, picker or text area is never held back; `data-taps="repeat"` opts a control out.
2. A tap aimed at a screen that was redrawn after the finger went down is dropped (stale), not delivered to what is now
   under it.
3. On a new address the page draws one painted frame after its name; heavy pages say "Working it out…".
4. The menu's search box is kept between draws; Go (Enter) opens the first row; a new page empties it.
5. Whole words rank first (name, then the plain phrases, then the topic, then the purpose); a word start counts after.
6. The closed menu is hidden from keys; the open menu makes the page behind it inert and still; it is a Back layer.
7. The "‹" in the bar: only when Back stays in the app, never on the first page or Get started's questions, covered
   (not moved) while the menu is open; its spoken name is the page's own "Back to ..." row only when that row leads to
   the page just behind, else "Back to <title>".
8. Named ways back: from `?back=` or the two hubs (not from a menu pick), at the top and above the continue row; the
   check-in's line is carried one page further, never onto the check-in itself or a menu pick.
9. An address that names no page shows a card, never the Dashboard under the wrong address; the household's view treats
   a page it does not offer as not found.

## Final checks (my worktree)
- `npm run registry`: 161 modules, `modules/registry.js` unchanged.
- `npm test`: 189,335 tests, 188,693 pass, **0 fail**, 3 skipped, 639 todo.
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK (2,882 files).
- `node --check` on every touched file: OK.

## Acceptance (`$SP/w1/accept-taps/B<n>.mjs <base> <root>`)
Stack = place's current build (`build-place`, copied as it stood) + this patch with `git apply --3way` (9423).
Base = pristine `ee09f6e` (9424). Outputs: `taps-build-edits/final-stack/B<n>.txt`, `taps-build-edits/final-base/B<n>.txt`.

| B | behavior | stack (after) | base (before) |
|---|---|---|---|
| B1 | a double tap does one thing | 28 of 28 | 9 of 28 (Debts' save re-opens Net worth; a second income form; contributions twice; Continue twice; budget twice) |
| B2 | taps I mean always land (no regression) | 14 of 14 | 14 of 14 (a guard: must hold before and after) |
| B3 | a slow page answers at once | 10 of 10 | 2 of 10 (the menu row cannot be reached by typing in the old box; the late Goal seek tap holds) |
| B4 | typing works in Find a page | 4 of 4 | 0 of 4 |
| B5 | Go opens the first page listed | 4 of 4 | 1 of 4 |
| B6 | the plain word finds its page first | 9 of 9 | 0 of 9 |
| B7 | All pages keeps the search | 3 of 3 | 0 of 3 |
| B8 | a new page starts the menu afresh | 1 of 1 | 0 of 1 |
| B9 | Back closes the menu | 7 of 7 | 2 of 7 (Back with the menu open leaves the app; Escape does nothing; cross and dim side hold) |
| B10 | the page behind the open menu stays put | 3 of 3 | 0 of 3 (page jumps to 1070, 0 ...; back at 0 after closing) |
| B11 | keys meet only what is on screen | 4 of 4 | 0 of 4 (Tab walks the hidden menu; 5 of 45 Tabs reach the page behind; no aria-expanded) |
| B12 | the top of a new page; said once | 3 of 3 | 0 of 3 |
| B13 | reduce motion (menu, chevrons) | 2 of 2 | 0 of 2 (10 frames part-way; 0.15 s / 0.18 s) |
| B14 | the page's name is whole | 18 of 18 | 2 of 18 (up to 88 of 150 names cut at 390 and 147 at 320) |
| B15 | an address that names no page says so | 8 of 8 | 0 of 8 |
| B16 | a way back on screen ("‹") | 9 of 9 | 1 of 7 (no "‹") |
| B17 | the named way back, top and bottom | 6 of 6 | 0 of 6 |

My patch alone on `ee09f6e` (9421, the degraded build): B12 3 of 3; the permanent checks `qa/shell-taps` 6 of 6,
`shell-search` 7 of 7, `shell-bar` 18 of 18; `shell-menu` 5 of 6 (Back with the menu open on the first page still
leaves the app: the Back layer is place's router) and `shell-ways` 2 of 5 (no "‹", no hub row: both read place's entry
numbers). On the stack all five are green: 6/6, 7/7, 6/6, 18/18, 5/5 (`taps-build-edits/qa-shell/`).

## Deviations and why
1. **Router additions are the place track's** (seams C6/S1): `core/router.js` and `tests/router-replace.test.mjs` are not
   in this patch; taps reads them through `entryNow()` only. On `ee09f6e` alone there is no "‹" and no menu Back layer.
2. **No `calmScroll`** (seams C7): the page's own glides with reduce motion are place's; B13 measures the menu and the
   chevrons and prints the page glide as information only (32 positions on Goals: place's to fix).
3. **`taps.drawn()` as explicit calls** after each draw and the missing card, not in a `finally` (seams C9).
4. **Read-outs per I5**: `announce` drops words the focus already holds; with place's N1 the green line is said once by
   the focus, without it once by `#announce` (both measured, B12).
5. **No DESIGN_LOG, TEAM, WORKBOARD or PLAN writes** (seams C17 and "4. docs"); the nine choices are listed above for
   the integrator's PLAN.md section. CONVENTIONS, CHANGELOG and the two READMEs are in the patch (outside the
   integration diff).
6. **The check-in row at line 192 of frame.js** has no `data-back` from me (place's line, seams 1.4); every other
   "‹ Back to ..." the frame draws carries it.
7. **The "‹"'s spoken name** uses the page's own "Back to ..." row only when that row leads to the page just behind;
   else "Back to <title of the page behind>".
8. **The check-in trail** is carried one page further but never onto the check-in itself and never onto a page picked
   in the menu.
9. **`.nav-search` is 44 px high** (it was 40): the box is a tap target on a phone.
10. **B2 P13 adapted**: Categorize scrolls to its own notice after filing, so the next picker is not under the finger;
    P13 taps the nearest other picker (touch at 1000 ms; keyboard pick + mouse at 400 ms). The page's own scroll is its
    lane's.
11. **Best match includes word starts** (score 0.5): "car" lists Salary and raises ("career"), as designed; "Medicare"
    never comes first.
12. **The seam "ins. after 258"**: `announceFresh(fresh)` sits between `const fresh = ...` and `lastFresh = ...` (my
    first draft put it after `lastFresh`, which conflicted with place's lines 260-265 under `--3way`; now it applies
    cleanly on place's current build).
13. **Not tried with the forms track**: no forms build existed to stack on; the patch touches no `core/ui/*.js`.
14. **Acceptance scripts set-up**: B15 switches a page off by writing `planner.features` (what Settings › Pages
    writes) and reloading; the "switched off on the computer" card is node-tested only (the stack server has none).

## Wrap-up
- Patch: `$SP/w1/patch-taps.diff` (22 files, +1,173 / -79; `git apply --check` clean on `ee09f6e`; `git apply --3way` clean
  on place's current build). `planner.properties` and `modules/registry.js` are not in it.
- Servers stopped: 9421, 9423, 9424 (9422 had already ended at its time limit). The scratch worktrees `taps-stack`,
  `taps-stack2`, `taps-stack3` and `taps-base` were removed (`git worktree remove`); to re-run the acceptance scripts,
  stack place's build and this patch again and pass that folder as the second argument.
- Pictures read: `taps-build-edits/shots2/` (drawer with "social", Page not found, switched off, "Bills and regular
  payments" at 320 light and dark, Needs attention's way back at the top and bottom, the dark drawer, Plan health score).
