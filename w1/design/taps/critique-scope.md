# Critique (scope, the maintainer's view): wave 1, track "taps"

Read: design.md, the six theme files, AGENTS.md, docs/CONVENTIONS.md, docs/DESIGN_LOG.md, docs/TEAM.md, docs/WORKBOARD.md
(to line 697), sw.js, tools/main-gate.mjs, the place / place2 / forms designs, build-wf.js, the wtouch rules and sweep.
My scripts and outputs are in `cs/` beside this file. `cs/tip` is `git archive d22b718` (the branch tip now) with the
prototype's shell files applied (`cs/proto-shell.diff`: app.js, search.js, base.css, index.html, frame.js, plus
core/taps.js and the two new tests). It applied cleanly: app.js and frame.js have not changed since c385e41.

## Blocking

### 1. The design was measured at c385e41, but the branch is now at d22b718 (75 commits later). Its All pages part no longer applies, and N5 is back on All pages
- **Evidence.** `git diff --stat c385e41..d22b718` shows `modules/overview/pages/view.js +20` (claude-f, 6378c08: the
  search is kept in the address with `?q=`, plus a "Best match" card that uses `title.toLowerCase().includes(q)`).
  `git apply --check cs/proto-pages.diff` on the tip fails with "patch does not apply". `cs/s3-allpages.mjs` types words
  key by key into All pages at the tip:
  - "car": Best match is Credit cards, Long-term care, Healthcare before 65, Medicare and IRMAA. This is N5's own
    defect, now in the top card.
  - "tax": Estate tax comes first.
  - "will": Will the money last? (N5 wants the wills page first).

  M4's "Weighed and lost: a flat Best match list" is now on the branch anyway.
- **Change.**
  - Rebase M4's All pages part on 6378c08. Keep claude-f's `?q=` and the card (claude-f's lane and README). Replace the
    card's `includes` with `matchScore(...) < 1` (about two lines). Drop the design's own `replaceState` and
    `route.query.q` code, which is already there.
  - Post a WORKBOARD line to claude-f, who wrote on 2026-11-12 01:40 that they are "stopping until wave 1's helpers
    land".
  - Count B7, N5 and x-2 again on the tip.

### 2. M6's named "‹ Back to …" row duplicates the `?back=` back links that wave 2 put on the pages
- **Evidence.** `cs/s1-backseam.mjs` (tip plus prototype shell; family household with the car loan's details removed).
  Pay off debts, then "Add Car loan's rate and payment", opens `#/balance/liabilities/a-car?back=debt/payoff`:
  - Before the save there are 2 ways back to the same page: the top bar's "‹" ("Back to Pay off debts") and the frame's
    row "‹ Back to Pay off debts".
  - After the save there are 3: the save notice adds a filled "Back to Pay off debts ›", which is a forward `href` and
    adds a history entry. Picture: `cs/shots/backseam.png`.
  - With `?w1off=all` there are 0 before the save and 1 after.

  The named row fires because `debt/payoff` is a `RESULT_ROWS` page. Taking 19 source pages (CAME_FROM plus
  RESULT_ROWS), I found at least 34 target pages by a static count of view.js links that would draw the row. That
  comes close to option (a) in M6, which the design itself rejected: "a second bar of navigation".

  Meanwhile the branch uses `?back=<group/id>`: Net worth, Debts, Expenses and Pay off debts (claude-g); the README in
  balance/net-worth. claude-h's WORKBOARD entry (2026-11-11 22:40) waits on "A3's `?back=` for insurance/life-needs,
  once frame.js honours it".
- **Change.**
  - Use one signal for the named row. When the address carries `?back=`, the frame draws the row from it (this is A3's
    own proposed fix, and the pages already pass it). Otherwise it uses history `from`, only for the two hubs MR-4
    names (alerts, next-best-action).
  - Drop RESULT_ROWS as an implicit source, or at least never draw the row when the address carries `?back=`.
  - Make the decision a pure `namedBack({ came, page, query, via })` in guide/compute.js with node tests.
  - Use the place track's `backLink` for the row, so both kinds of link behave the same.

### 3. The design leaves history, back links, scroll wrappers and read-outs to "whoever lands first", but build-wf.js builds all three tracks at the same time from one base
- **Evidence.** Step 4 says "if its core/router.js ... has landed, use it; otherwise land the numbering here ... with
  the same API". build-wf.js runs `parallel(TRACKS.map(...))`, one worktree per track from `${BASE}`, then integrates.
  So nothing will have landed when the taps builder starts, and two implementations will meet at integration.

  Overlaps:

  | what | place track | taps track |
  |---|---|---|
  | history entry numbers | `{...state, n, l, p}` in router.js | `{n, from, via}`, plus sessionStorage `planner.firstEntry` |
  | the menu's history entry | `router.layer` (S8) | `history.state.drawer` |
  | back links | `ctx.back` / `backLink` (S7) | `ctx.goBack` / `ctx.cameFrom` |
  | scroll function wrappers | wraps `scrollTo`, `scrollBy`, `scroll`, `scrollIntoView` (R13, counting) | wraps the same ones (M9, smooth becomes instant) |
  | second tap on the bottom copy | ignores it for 700 ms (place line 372) | M1 guard |

  Read-outs are also doubled:
  - The forms track gives red notices `role=alert` (forms/design.md lines 94-95). M9's `announce()` also reads the
    fresh red notice into `#announce`, so it is read twice.
  - `.save-echo` already has `role: "status"` (core/app.js:286). When the bottom copy shows, M9 reads the confirmation
    a second time.

  The 14 of 14 measured in `m4-menu.mjs` and the 10 of 11 in `m6-ways.mjs` were taken on code the integration will
  replace.
- **Change.** Write the ownership into the design now, so seams.md can copy it:
  - The place track owns router.js (numbers, `layer`, `back`) and the one scroll wrapper. That wrapper also turns smooth
    into instant under reduced motion.
  - Taps adds nothing to router.js. It consumes `router.entry()`, and needs the page key of the entry before plus a
    `via: "menu"` flag (ask place to carry it).
  - Taps uses `router.layer(close)` for the drawer and keeps its own inert, focus, Escape, visibility and the
    `location.replace` on a row.
  - The ctx has one back API, `ctx.back`; drop `goBack`.
  - `announce()` reads only "ok" notices, and only when no `.save-echo` was shown; errors are left to forms'
    `role=alert`. Drop place's 700 ms echo ignore, since M1 covers it.
  - Run `m4-menu.mjs` and `m6-ways.mjs` again on the merged code.

### 4. `npm test` fails with the prototype: the Help page's search order changed
- **Evidence.** Full `npm test` on `cs/tip` (`cs/tip-npmtest.log`): 189,247 tests, 2 failures.
  - One is `live-check.test.mjs`, which needs git; that is my archive tree, not the design.
  - The real one is `modules/system/help/module.test.mjs` test 7, "directory with a query: matches only, best first":
    for "cards" it expected `[consolidation, payoff]` and got `[payoff, consolidation]`. It fails on `proto/` too.
    The tip alone passes 8 of 8.

  The cause is M4's `aliasHit`: a one-word query found as a word inside a multi-word alias ("card paid off") gets 0.25,
  which rounds down to 0 (the name level), above a hit in the page's description. system/help (its own search box) is
  a third user of core/search.js. It appears nowhere in the design's file list or measurements. The design's table
  reports "24 pass" for three test files only, and step 2's checks are `node --test tests/search*.test.mjs`.
- **Change.** Either keep the old rule (a single word matches inside a multi-word alias only at the alias's start), or
  accept the new order and update the help test. The second needs that file added to the lane list and a CHANGELOG
  line. Add Help's `directory()` to M4's measured surfaces, and make step 2 end with `npm test`.

## Should fix

**S1. Coverage.** `cs/coverage.mjs` finds all 36 ids in section 8, each under the right theme. 12 rows are partial or
deferred. These findings are waved through without a real behaviour:
- **j-first-retiree/R1.** "Use this one" was reported at 300, 500 and **800** ms. `SEE_MS` is 700, and `cases.mjs`
  tries only 150 to 700 ms. So the 800 ms case, a saved change that reverses the person's choice, stays open by design.
  Either go to 800 ms (the design's own fallback), checked again with `t2-allowed.mjs`, or say in the row that 800 ms
  is not closed.
- **j-hard-conditions/HC-5.** `.fold .fold-chev` (base.css:137) and `.scroll-hint::after` (base.css:274) were handed to
  the forms track. forms/design.md never takes them: its only reduced-motion item is `.kit-glow`. Fold chevrons appear
  on most pages. Add both selectors to the track's own reduced-motion line (one line).
- **j-monthly-return/MR-4, the check-in part.** "The check-in trail carried one page further" is neither prototyped
  (the prototype's frame.js diff has only the named row) nor measured (`m6-ways.mjs` K1 to K7). Its fallback is an edit
  to `balance/net-worth/view.js`, which claude-g claims right now (TEAM.md, 2026-11-12). In the prototype, Update my
  balances opened from Net worth gets "‹ Back to Net worth", not the check-in.
- **p-overview-home/x-2 and the All pages half of j-navigator/N5.** See blocking 1.
- **j-one-answer/A3, the bottom button.** It is declined under the 2026-11-06 rule. Since then wave 2 has added "Back
  to … ›" buttons inside save notices, and T-ONE-WAY does not count back links as ways on. Restate the reason against
  the branch, or use `?back=` (blocking 2), which gives the save line free on the pages that honour it.
- **j-fat-fingers/x-1.** Its second "should" sentence (the confirmation in view after a save) belongs to the place
  track (SH-REDRAW). The row says only "closed by B1 (M1)".
- **j-keyboard-reader/K6.** "The page's name is read out" relies on a labelled `main` taking the focus. No
  screen-reader output was measured; only owner check 7 covers it.

**S2. "Working it out…" is in the page on every page change, transparent, with `role=status`.**
- **Evidence.** `cs/s2-working.mjs` (tip plus prototype; Income to Net worth, Settings, Expenses, Goals, Pay off debts,
  Chance the money lasts): 6 of 6 changes add a `role=status` "Working it out…" line, at opacity 0 on the 5 quick pages.
  - The sweep's D-TIME (b) detector counts any added node whose words match its "working" pattern, without checking
    visibility (qa/touch-page.mjs:39 and :48). So D-TIME (b) turns green on every page opening, which proves nothing.
  - Screen readers ignore opacity, so the line competes with the page's name (B11).
- **Change.**
  - The transparent line gets `aria-hidden="true"` and no role. `role=status` only when the line shows at once.
  - Ask the sweep's owner to require opacity above 0 at the first painted frame.
  - Consider dropping `planner.slowPages`: the fade already covers quick pages and `heavy` marks the slow ones. That is
    one fewer thing kept in localStorage.

**S3. Permanent checks: step 9 has no place to land, and two of the touch-sweep rules it names cannot see these
behaviours.**
- `qa/touch-sweep.mjs` runs fixed page-by-household cells plus one menu cell, and has no hook for flows.
- T-HEAD compares the top bar's `textContent` with the menu name (touch-sweep.mjs:283, touch-page.mjs:225), so a cut
  title passes, before and after M7. The sandbox pill also says "Sandbox", where 1 of 159 names is cut.
- D-TIME (b) proves nothing (S2).
- **Change.**
  - Land `t1-dbl`, `t2-allowed`, the typed part of `m3-search`, `m4-menu` and `m5-bar` as repo scripts (`qa/flows/`
    or `qa/shell-*.mjs`, taking a base URL). `m5-bar` must set the real pill words.
  - Claim only D-TWICE, D-BACK, D-TOP, T-TARGET and T-NAME as turned green.
  - Give the named-row rule (blocking 2) a node test.

**S4. Lanes and docs.**
- `core/taps.js` is a new core file. The TEAM.md claim names only one new core file, the place track's. Add it.
- Name `modules/system/help/module.test.mjs` (blocking 4).
- docs/CONVENTIONS.md needs: the back API, `derived` worked out on first read, `data-taps="repeat"`, the page drawn
  one frame after the title, and the address card.
- WORKBOARD hand-offs to wave 1 that the design does not answer:
  - claude-f, 2026-11-12 01:00: "retire" ranking. Held up: the prototype puts Will the money last? first, where the
    tip puts Year by year first.
  - claude-f: "retire at". `cs/rank.mjs` finds "retire at 62" gives Social Security only, old and new alike. Not
    addressed.
  - claude-f: the step name in the frame bar (optional).
  - claude-d: guard `household.people` with `Array.isArray` in buildNav. That is one line in the code M3 rewrites.

**S5. M8's wording.** "You switched this page off on this phone" can be untrue. `features.sourceOf(m)` may be
"properties" (the computer's planner.properties), and the device may be a computer. Choose the words from
`sourceOf`.

**S6. The skip link depends on its click handler.** `href="#content"` read by the router is group "content", and after
M8 that address shows "That page is not here". Make it a `<button>`, or keep the handler and cover it in `missing()`'s
node test.

**S7. Owner checks to add.**
- On Quick answers, "Not here? Search by a word" brings up the keyboard in Safari. The focus must stay in the tap's own
  task; the `stepping` wait in M5 would break that.
- Debts opened from Pay off debts shows exactly one way back.

## What I tried that held up
- **Coverage bookkeeping.** All 36 finding ids have a row in section 8, in the right theme, and no extras.
- **Static site.**
  - sw.js keeps no list of files, so a new core file needs no edit there.
  - The server's import map walks `core/` (server.mjs:276-285), and the single-file build bundles it.
  - The prototype's app.js survives an old index.html without `#nav-back` (`updateBack` returns early; the listener
    uses `?.`).
  - Every `pushState`, `replaceState` and `location.replace` is wrapped in try/catch, so the sandboxed single file
    keeps working.
  - Nothing here should change what main-gate.mjs checks.
- **The prototype's shell on the tip.** It applies cleanly on d22b718.
  - `npm run check` is OK, and the taps, search and search-words tests pass (24).
  - "car" lists Vehicles first, and "retire" lists Will the money last? first.
  - "who to call", "lawyer", "reset" and "paperwork" each find their page. "language" finds nothing, which is right:
    the app has no language setting.
- **M1 is close to the smallest guard that closes the setup findings.** The Get started questions redraw inside the
  page (setup/view.js forward()), with no shell draw. A guard that only watches `renderSeq` (R1's proposal) would
  miss x-3 and p-overview-path/x-1, so the "changed" verdict is needed.
- **`ctx.derived` worked out on first read.** The same 8 views read it at d22b718 as at c385e41. The two views that
  spread ctx (categorizer, backups) trigger it once, as today.
- **CSS.** No new global CSS outside base.css. The selectors are `#topbar`, `#sidebar`, `#scrim`, `.nav-*` and
  `html.drawer-open`.
- **The reduced-motion wrapper rather than `ui.reveal`.** The tip has 50 smooth-scroll calls across about 40 modules,
  one in claude-a's goals/travel, so a wrapper is the reasonable reach. It should be one wrapper shared with the place
  track (blocking 3).
