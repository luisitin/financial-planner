# Critique (scope): wave 1, track "place"

I read this as the maintainer. The questions: is this the smallest change, does it stay in its lanes, can it be tested,
does the build order work, and does it cover the findings. `$SP` = `$SP`.
Evidence is in `$SP/w1/place/crit-scope/`:
- `tip/` is `git archive fe678cb` (the branch tip, 99 commits after the design's 6fc5299) with the prototype's diff and
  `core/place.js` applied on top.
- `coverage.mjs` and `coverage.log`: every finding id against section 8.
- `measured.mjs` and `measured.log`: which findings' own pages any architect script opens.
- `node-locator.mjs` and `node-locator.log`: can the locator run in Node.
- `loc-census.mjs` is the architect's census plus a twin-form count.
- `m-redraw.mjs` is the architect's script, unchanged, run on the tip copy.
- `results/` holds the outputs; `npmtest-tip-patched.log` is the full `npm test` run.

I served on 127.0.0.1:9336 and stopped that server.

---------------------------------------------------------------------------------------------------------------------

## Blocking

### 1. The seams with the taps track are not written down, so both tracks build the same history behaviours in the same functions
- **Evidence.**
  - This design's section 7 "Lanes" names neither wave-1 track. The word "taps" appears once (p-debt-property/x-3,
    "declined").
  - The taps design builds the same things:
    - the menu's Back: M5, `history.state.drawer`, `openDrawer`/`closeDrawer`/`paintDrawer`, and `location.replace`
      for a menu row (`taps/design.md` 253-273);
    - entry numbers: M6, `{n, from, via}` plus `sessionStorage planner.firstEntry`, `router.first()` (296-315);
    - back links in `frame.js`: `ctx.goBack()`/`ctx.cameFrom()` and the named rows `CAME_FROM`/`RESULT_ROWS` (step 4).
  - This design builds them too: `{...state, n, l, p}`, `router.layer` plus a document click interceptor in
    `router.start`, edits to `toggleDrawer`/`closeDrawer`, and `ctx.back(href, loose)` with `backLink` in `frame.js`.
  - Both tracks also wrap `scrollIntoView`/`scrollTo` (place R13; taps M9).
  - `build-wf.js` builds the tracks in parallel worktrees from one base, so the two versions first meet at integration.
  - j-fat-fingers/x-2 (menu part) is the same behaviour as taps' j-navigator/N3.
- **Change.** Write the ownership into the design. Use the split the taps scope critic proposed
  (`taps/critique-scope.md` 78-86), so the two critiques agree:
  - **router.js** is place's: numbers, `layer`, `back`. `history.state` also carries taps' `from` and `via` (or
    `router.first()` gives them). Taps adds nothing to `router.js`.
  - **The drawer** is taps': inert, focus, Escape, visibility and `location.replace` on a row. It calls
    `router.layer(close)`. Remove place's drawer edits (`shutDrawer`, `toggleDrawer`, `drawerRelease`) and either the
    router's click interceptor or taps' `location.replace`, so only one remains.
  - **One way back on screen:** `ctx.back(href, loose)`; drop `goBack`.
  - **One scroll/focus wrapper.** It counts the page's own scrolls for place and turns smooth scrolling into instant
    under reduced motion for taps.
  - In section 8, mark j-fat-fingers/x-2's menu part as "with taps B8 (j-navigator/N3)".

### 2. The forms track's seams are missing, and one already bites on the tip: place undoes a page's own "bring the answer into view"
- **Evidence.**
  - `forms2/final.md` 310-325, written after this design, asks place for:
    - G1/N2: end the hold on `planner:reveal`, and count a reveal after the draw as the page scrolling itself;
    - G2: the put-back must skip notices marked `[data-moved]`;
    - G3: the echo takes `.notice-action` first;
    - N1: after a redraw, focus the fresh notice when the focused control is gone;
    - N3/N4: refill quietly, and move the focus only on a redraw;
    - N6: settle the "Undo" wording.
  - None of these is in this design.
  - The self-scroll counter counts only while the shell draws (`place.js:467`, `if (drawing && ...)`). The hold then
    runs for up to 8 s (`place.js:374-392`).
  - On the tip, claude-e's withdrawal-strategy now brings "Put it back" into view one frame after the draw
    (`modules/retirement/withdrawal-strategy/view.js:169`, `requestAnimationFrame(() => n.scrollIntoView(...))`).
  - `m-redraw.mjs`, run on the tip copy with "Use this one":
    ```
    off  withdrawal-use-this  scroll 764>112  readable true   (the page shows its line and its way back: claude-e's fix)
    fix  withdrawal-use-this  scroll 764>729  readable false  echo "bottom +[Put it back: Same spending every year]"
    ```
    With place on, the page's own line and its Undo are off the screen. A copy at the bottom replaces them for a few
    seconds.
- **Change.**
  - Add a section "Seams with forms" with each item and its rule.
  - The hold stops on `planner:reveal` and on any page call to scroll or reveal during the hold, not only during the
    draw.
  - The put-back skips `[data-moved]` notices and any notice that holds a `.notice-action`.
  - The echo takes `.notice-action` first. Its way back acts through the original control (break critic K4).
  - N1 focus after a redraw, as forms specifies.
  - Add a kit check: on withdrawal-strategy, "Use this one" leaves "Put it back" readable on screen.

### 3. The design measures a tree that is 99 commits old; at the tip some rows are already fixed and others changed
- **Evidence.**
  - The design is at 6fc5299. The tip is fe678cb: 305 files changed, and five wave-2 builders worked on the pages it
    measures. The shell files are unchanged, and the patch applies cleanly (below). The pages are not unchanged.
  - Rerun of `m-redraw.mjs off` (today's shell) on the tip, against the design's section 2 "today" column:
    - Credit cards, "Use these numbers": the design says 522 px moved and the section shut. The tip gives 0 px, open,
      notice readable. This was already fixed in the page.
    - Will the money last?, "Save settings": the design says 1,232 px and shut. The tip gives 33 px, open (claude-e).
    - Estimated payments and the Federal estimate: the design says "copy at the bottom". On the tip the notice is
      readable on screen and no copy shows.
  - Get started keeps its own drafts, chips included, in `sessionStorage` `planner.setup.drafts` (6a65660,
    `modules/overview/setup/view.js:41-63`). So j-first-family/F2 and j-first-renter/x-4 are closed on the branch, A7 is
    done, and place's refill would be a second restorer on those boxes.
  - People keeps its own form open and its own draft (`household/people/view.js:19, 62, 103-104`, claude-g). It writes
    `.value` after each redraw, which interacts with place's base/identity (`place.js:155-159, 224-236`). This needs a
    re-check.
  - A2 for People and A5 for the projection's "saved" are done (d1973e2).
  - Views that scroll themselves went from 48 to 59. On those, the "page wins" rule turns place's anchor off. Views that
    call `replaceState` with a new address went up by two:
    - `balance/net-worth/view.js:155` strips `?add=`;
    - `overview/pages/view.js:71` writes `?q=` on each keystroke.

    Typing is keyed by the full hash, so both strand it.
  - The forms track re-based its final design on d22b718 and cut sections 3 and 8 to what was still open. This design
    did not.
- **Change.**
  - Re-run sections 1, 3 and 8 on the build tip: m-back, m-draft, m-redraw, m-local, m-links and the sweep.
  - Drop the rows that are already fixed.
  - Add `overview/setup` and `household/people` to the list of pages that restore their own typing. Place must not
    refill them, or must prove it does no harm.
  - Key typing by page plus only the query keys that change what is drawn. That is break critic S1; the `?add=` and
    `?q=` cases above make it more urgent.

### 4. Findings waved through with no real behaviour in wave 1
`coverage.log`: all 52 ids are in section 8 (0 missing). But 13 rows close only with a page change, and the wave-2 owners
of those pages have finished and handed those exact items back to wave 1. Each item below is deferred by both sides:
- **p-retirement-b/RB1, the Roth part (A4).**
  - `retirement/roth-conversions/view.js:242` still offers `[60, 62, 63, 65, 67, 70, 72]` whatever the retirement age.
  - claude-e released its claim and wrote "Waits for wave 1: ... RB1" (WORKBOARD 2026-11-11 21:30 and 23:30).
- **j-heavy-waiting/W4, the Chance the money lasts part (A3).** The finding asks for the "Now using 10,000 pretend
  futures" line and the focus back on Runs. `retirement/monte-carlo/view.js:52` is still
  `root.innerHTML = ""; render(root, ctx)`. claude-e: "Waits for wave 1: ... W4".
- **j-debt-fixer/x-2, j-fat-fingers/x-2 (the form part), p-cashflow-a/CF-3: "Back closes the open edit form".**
  - These close only through A1: 27 views plus balance/liabilities adopting `ctx.layer`.
  - No wave-2 owner is named, and the five wave-2 sessions have released their claims.
  - claude-c's TEAM claim (TEAM.md line 77) still lists `balance/liabilities` and `balance/net-worth`, though its lane
    landed in 658c5b8.
- **p-balance/x-1, the Net worth part (A2: the open add form stays open).** No owner. The People part is done on the
  tip.
- **p-debt-property/x-3, the part "declined" to taps ("the row sits 32 px under Add").** `taps/design.md` has no
  p-debt-property/x-3: 0 hits. It falls between the tracks.

Claimed by mechanism but never run on the finding's own pages (`measured.log`: 4 of 52 have none of their pages
opened):
- p-cashflow-b-goals/x-3 (goals/goals);
- p-transactions-helpers/x-notice-jump (categorize, reader, rules: claude-d changed their notices since);
- p-taxes/x-5 (withholding);
- j-navigator/N1 is listed but is covered by the plan and settings trips.

j-heavy-waiting/W1's worst page, the Life timeline (6,960 px, lost 7 of 12), is not among m-back's 17 trips.

**Change.**
- Section 8 gets three states: "closed by wave 1", "closed on the branch", and "not closed: <owner, by when>".
- Either take A3 and A4 into wave 1 (two small edits on claude-b pages; amend TEAM row 75, which says "no view.js in
  this wave"), or name an owner in WORKBOARD.
- Name A1's owner and ask claude-c to release row 77.
- Add the four unmeasured pages and the timeline trip to the acceptance scripts.

### 5. Two mechanisms close no finding and add risk
- **M8 (B13, S9): the redraw held while typing in another box.**
  - B13 "supports p-balance/x-1". The fix for x-1 is the keepScroll carry, which is B8.
  - D-FOCUS-KEPT already has 0 breaks today: the design's own sweep shows 187 checked, 0 broken
    (`results/sweep-today.log` line 7).
  - Its risk R6 puts stale figures and stale closures on screen until the box loses focus.
  - place2 has no such hold.
- **place's own drawer layer: B12, S8, and `router.layer` used for the menu.** The behaviour is taps' (blocking 1).
  place2 M8 says the same: "if no other track lands it".
- **Change.** Drop S9 and M8. Drop S8 and leave the drawer to taps. Keep `router.layer` only as the API taps calls and
  A1 will use.

---------------------------------------------------------------------------------------------------------------------

## Should fix

- **S1. "Every pure function gets a node test" cannot be met as written.**
  - The prototype has no test file (`proto/tests` has no place test).
  - The locator is DOM code. On the repo's stand-in DOM (`qa/fixtures/fake-dom.mjs`, which matches only `.class`,
    `[a=b]` and a bare tag) `node-locator.log` shows:
    - `locOf(...)` → `{"s":"","i":-1,...}`
    - `locate(root, locOf(...))` → `false`
    - `foldTitle` → empty
  - Split the pure rules into their own module and test them on plain records:
    - figure shaping (`shape`, `norm`);
    - match ranking over `{k,s,r,i,of,gi,gof}` (exact, section, order, only, unsure);
    - form identity on field lists, including the K1 twin rule;
    - record pruning (60 entries, `forgetAfter`);
    - typing expiry, the 300 KB cap, and the secret-name filter with Settings' `apiKey` (break critic K6);
    - `echoStay`;
    - the router's `kind` and `sameEntry`.
  - Keep the DOM glue for the kit.
- **S2. Permanent checks.** The touch rules this track turns green:
  - D-BACK and D-TOP (B1, B2, B4);
  - D-SCROLL-KEPT (B9, B11);
  - D-SEEN (B10);
  - D-FOCUS-KEPT stays at 0;
  - on the phone, by hand: H-SWIPE and H-RESUME (the 21 SH-DRAFT findings have no automatic rule).

  Propose two rules to the touch-check track:
  - D-DRAFT: type in a form, then leave by the menu, by Back, by reload, and by saving another form on the same page.
    The value comes back, or the "kept" note shows.
  - D-WAYBACK: an on-screen "‹ Back to ..." link or the echo's way does not make `history.length` grow (K4).

  The first half of R14 has already landed: `wtouch/qa/touch-sweep.mjs:331` now also needs `|moved| > 60`. Re-run the
  sweep before asking the touch-check track for more.
- **S3. Build order.**
  - S3's checks (estimated-two-forms, federal-two-folds, accounts-note) need S5's typing, so S5 must come first or S3
    must drop those checks.
  - S4's echo way back needs S7's `ctx.back` (K4).
  - S6 (kept pages) should be the last step and revertible on its own: its measured gain on D-BACK is 0. The design's
    own table has M2 alone at 16/17 against 17/17, and the one difference keeps the anchor within D-BACK's 100 px. It
    also brings a new contract for every page (return a cleanup), the throwaway `gm.frame(ctx, div)` call, and module
    state shared across entries (place2, "Compared", point 2).
  - S10 removes the `?place=` switches and `window.__placeLog`. `lib.mjs` `placeLog()` reads that log and m-back and
    m-redraw use it, and `m-back`, `m-draft` and `m-redraw` import a fixed `./lib.mjs` (only m-links and m-local take a
    lib argument). Rewrite them as `accept-place/B<n>.mjs <base> <root>`, as build-wf asks.
- **S4. Lanes.**
  - S6's proposed `npm run check` rule changes `tools/check.mjs`, which is not in this track's file list. Drop it or hand
    it to the tools owner.
  - `#content { overflow-anchor: none }` should be a shell selector in `base.css`, not an inline style set from app.js.
  - TEAM row 75 calls for "a new small file under core/". `place.js` is about 470 lines before the fixes, and taps adds
    `core/taps.js`. Add both to the claim.
- **S5. Echo.** The tappable 44 px row can stay at the bottom for 12 s. For MR-1's 100-character notice the formula
  gives `2.5 + 7 + 2.5`, which the cap sets to 12 s. Design log 2026-11-06 says "No Next bar is fixed to the bottom
  ... covers the page's own buttons". So far only Update my balances has been checked for covering.
  - Run T-COVERED with the echo showing on every page where it appears.
  - Or shorten the stay when the echo covers a control.
- **S6. Wording.** "Undo my typing" sits next to forms' Undo, which takes back a change to the plan (forms N6). Pick one
  with forms; "Clear what I typed" is the plainer choice.

---------------------------------------------------------------------------------------------------------------------

## Tried and held up

- **The prototype applies on the tip.**
  - `git apply --check` is clean on fe678cb: the shell files have not changed since c385e41.
  - `node --check` passes on app, router, place and frame.
  - The shell tests pass: router, heal, static-skew, user-view, sw and the guide module (105 of 105).
  - `npm run check` reports OK.
  - Full `npm test`: 189,245 tests, 2 failures. Neither is from the patch: the Income statement speed test failed
    under load, and live-check needs a git repo while my copy is an archive.
- **The locator holds on the tip** (`results/census-family*.log`, family, 159 built pages).
  - Same plan drawn again: sections 393/393, boxes 734/734, buttons and links 2,402/2,402, 0 wrong; forms 89/89.
  - A real change: sections 394/394, boxes 747/747, buttons 2,403/2,658 found (90.4%, 255 unsure, 0 wrong on the 154
    pages whose counts did not change), forms 86/88.
  - The new twin-form count finds 2 pages: career/salary and cashflow/paycheck. These are break critic K1's two pages,
    and the only places where identity alone is unsafe.
- **The static site needs nothing new.**
  - `sw.js` has no file list and no Cache Storage, so a new `core/place.js` gets the fresh-fetch rule.
  - static-skew's synthetic anchor `    openSearch,\n` is still in the patched app.js exactly once.
  - main-gate's pair run covers the new import.
  - core stays dependency-free.
- **The redraw behaviour still pays on the tip.** The tapped button stays put (0 px) where today it moves:
  - projection: today 33 px;
  - Update my balances: today 109 px;
  - Accounts: today 146 px.

  Typing is kept where today it is lost: Estimated payments' Q1 "1,000", Federal's "98,000", and the Accounts note.
  Buckets and Federal keep their sections open where today they shut.
- **CSS.** Only shell and `.place-*` selectors are added, all in `base.css`. No claude-a file is edited, and A6 lists
  claude-a's 10 timer files for the handoff.
