# Place and typing memory: wave 1 design (track place2, the second architect)

Starting bias, as asked: the fewer things the shell has to remember and put back, the fewer ways it can go wrong. So I
first tried not throwing the page away at all, then the browser's own machinery, and only then remembering and
restoring. Everything below was prototyped on c385e41 in
`$SP/w1/place2/proto`
(uncommitted edits: `core/place.js` new, `core/app.js`, `modules/overview/guide/frame.js`, two lines of `core/ui/base.css`,
`tests/place.test.mjs`) and measured with the shared kit at phone size (390 x 844, touch, Chromium), with thumb drags
(CDP touch events, about 0.4 s a swipe) and taps at screen points on controls that were on the screen, never tool
scrolling. The prototype has a switch for before/after runs from the same files: `?place=off` is today's shell,
`?keep=off` turns off only the kept page (section 2, M2), `?anchor=off` turns off Chromium's scroll anchoring (as
Safari). Scripts are `e1-back.mjs` ... `e9-chip.mjs` and `dbg-rowhold.mjs` beside this file (`lib.mjs` for the thumb,
`serve.mjs` for port 9351); raw results are in `out/`.

What I learned first, and what shaped everything else:

- **A node-by-node patch of the new drawing into the old one cannot work in this code base.** Every page attaches its
  listeners as closures over the nodes it just built, and the kit's own form reads its boxes through those references
  (`core/ui/dom.js` form(): `readForm(fields, controls)`). Keep the old box on the page and the new Save reads a box
  nobody sees. `e7-morph.mjs`: the screen shows 9,999, Save sends 3900; the reverse (new nodes, typing put into them)
  sends 9999. 84 of the 161 views build forms with `ui.form`; all of them would save stale values. Keeping old nodes
  also keeps old listeners that close over the old plan. So on a save the shell must draw anew and put the person's
  few things back; that part cannot be "by construction".
- **Keeping a page's whole DOM alive across Back and Forward does work**, because the page and all its closures are
  kept together. It is valid only while nothing the page shows can have changed (the plan object is the same, the view
  and what answers are the same, its module has not drawn another page since). Measured hit rate below: most Back and
  Forward presses in reading flows qualify; steps of the path do not (Next writes the plan).
- **The browser's own scroll restoration is the cause, not a help**: with `scrollRestoration = "auto"` it races the
  shell's scrollTo(0) and the asynchronous draw. Today, 6 of 18 Backs land within 100 px at normal speed and **1 of 18**
  with the processor slowed four times (a mid-range phone). Turning it to `"manual"` and putting the place back
  ourselves gives 18 of 18 at both speeds (section 2).
- The **bfcache** never applies (hash navigation stays in one document); `<details name>` is an exclusive accordion and
  keeps nothing open across a redraw; CSS `overflow-anchor` exists in Chromium and Firefox but not in Safari, so any
  "keep what is under the thumb" must be our own code to behave the same on the owner's iPhone. The form's own
  `defaultValue` / `defaultChecked` / `defaultSelected` is the one piece of browser machinery that carries the whole
  draft design: it is exactly "what the page drew from the saved plan".

## 1. Behavior, in a person's words (the acceptance test)

**B1. Back and Forward land where I was.** I scroll down a long page, tap a link, look, press the phone's Back (or swipe
back): the page is where I left it, the line I was reading at the same height on the screen. Forward brings the next page
back where I left it too. A link or a menu row to a page still opens it at the top. Closes: j-first-family/x-1,
j-first-freelancer/x-2, j-first-retiree/x-1, j-heavy-waiting/W1, j-monthly-return/x-back-top, j-navigator/N1,
p-career-household-system/F1, p-cashflow-a/x-1, p-insurance-estate/IE-1, p-overview-home/OV-1, p-retirement-a/R-A2,
p-retirement-b/x-2, p-retirement-c-scenarios/x-back-loses-place, p-taxes/x-1, j-first-renter/x-3.

**B2. The sections I opened are still open when I come back.** A fold I opened (or one the page opens by itself and I
shut) is the way I left it after Back, Forward or Reload. A fresh visit by a link draws the folds as the page designs
them (Get started's eight tiles stay folded on first open). Closes: j-one-answer/A5, p-overview-path/x-2, and the
"sections shut" half of j-heavy-waiting/W1, j-navigator/N1, p-career-household-system/F1, p-cashflow-a/x-1,
p-retirement-a/R-A2, p-retirement-b/x-2, p-retirement-c-scenarios/x-back-loses-place, p-taxes/x-1.

**B3. A reload, or a tab the phone dropped and reopens, comes back at the same place with the same sections open.**
Closes: the Reload part of j-navigator/N1.

**B4. "‹ Back to ..." on the screen does what the phone's Back does** when the page it names is the one I came from:
the check-in, Quick answers or Your plan comes back where I was, and the phone's Back afterwards goes where it would have
gone (from a check-in with three steps visited, one press reaches the Dashboard, not seven). Opened any other way (a link
from elsewhere, a fresh tab), the link opens the page as today. Closes: j-monthly-return/x-backlink-history,
j-one-answer/x-4, and the '‹ Your plan' part of j-navigator/N1.

**B5. After a save the page stays still.** The section I saved from stays open, the button or row I tapped stays under
my thumb (when the button itself goes away, its row or section stays where it was), and the box I was in keeps the
focus. Closes: j-first-freelancer/x-1, j-debt-fixer/x-3, j-one-answer/x-2 (fold and jump), p-retirement-a/R-A4 (fold and
jump), p-retirement-b/RB1 (fold), p-retirement-b/x-1 (the jump when the line is drawn), p-balance/B2 (the 110 px slip).

**B6. Saving one part of a page never wipes what I typed in another part.** The other form keeps my typing, its section
stays open, and a small "Not saved yet" sits beside its button, so the green "Saved." above cannot be read as covering
it. Closes: p-insurance-estate/x-1 (severity 5), p-taxes/T1 parts (a), (b), (d), (e) (severity 5), p-balance/x-1,
p-career-household-system/x-1.

**B7. What I typed and did not save is still there when I come back**, however I left (a link under the form, the menu,
the status pill, Back, Forward) and however I come back (Back, Forward, or opening the page again), for the rest of the
visit. One quiet line above the form says "We kept what you typed here. It is not saved yet." with a "Clear it" button.
If the form was one I had opened from a row (an edit form) and is shut when I come back, one line at the top says "What
you typed in “Edit Bo's salary” is kept, not saved yet. Open it again to finish it." and opening that row brings the
typing back. Nothing is asked when I leave. Closes: p-taxes/T1 part (c), j-debt-fixer/x-2 (the lost typing),
j-fat-fingers/FF2 parts (2) and (3), j-monthly-return/x-typed-lost, j-navigator/x-2, p-balance/B1,
p-cashflow-b-goals/x-3, p-debt-property/x-3, p-insurance-estate/IE-9, p-retirement-a/x-2,
p-retirement-c-scenarios/x-half-typed-form-lost, p-career-household-system/F2, p-cashflow-a/CF-2, p-investments/INV-4,
the typing half of p-cashflow-a/CF-3, the form half of j-fat-fingers/x-2.

**B8. A reload or a dropped tab keeps what I typed** in the boxes the page draws when it opens (Update my balances, the
tax pages, the add form of an empty list, Get started's amount and debt questions). Closes: j-first-family/F2 for the
boxes; j-first-renter/x-4 for the boxes. The chips on a question (I work, A month) are the page's own state: section 3.

**B9. A stray tap that swaps my half-typed form for another row's keeps my typing.** A short note at the bottom says
"Your typing in “Edit Ana's salary” is kept. Open it again to finish it."; tapping Ana's row again shows the form with my
typing and the "We kept what you typed" line. Cancel still throws it away, as today. Closes: j-fat-fingers/FF2 part (1).

**B10. A choice that recalculates part of the page keeps the sections I opened** (Runs on Chance the money lasts, Now /
As you retire on Stress tests). Closes: j-heavy-waiting/W4 (sections; the "Now using ..." line is the page's, section 3).

**B11. I see the confirmation where I am looking, with its way on.** When the green line a save draws is above or below
the screen, inside a shut section, or mostly under the top bar, the short copy at the bottom shows its words and, as a
44 px tap, its one link or button ("See net worth ›", "Your next move: ... ›", Undo), or else the "‹ Back to the November
check-in" of the page I came from; it stays about 7 seconds. Closes: j-monthly-return/MR-1, p-balance/B2 (the link and
the toast), p-taxes/x-5, j-one-answer/x-2 and p-retirement-a/R-A4 (no confirmation seen).

**B12. A confirmation never moves the page when it goes.** The green line a save drew stays until my next action
replaces it; nothing slides under my thumb four seconds later. Closes: j-first-retiree/x-2,
p-transactions-helpers/x-notice-jump, the second jump of p-retirement-b/x-1.

**B13. Back from a page and Forward again shows the page exactly as I left it, at once,** with an edit form I had open
still open and its typing in it, when nothing in the plan changed meanwhile (reading flows, the menu, a stray Back). No
waiting for a heavy page to work its answer out again. Closes: the Forward half of j-debt-fixer/x-2, j-fat-fingers/FF2
part (2) and p-cashflow-a/CF-3 (form open again on Forward).

Not promised in wave 1 (section 3): Back closing an open edit form before leaving the page (j-debt-fixer/x-2,
p-cashflow-a/CF-3, j-fat-fingers/x-2): it needs one line per list page. Back closing the open menu: SH-MENU N3 (see M8).

## 2. Mechanisms

Seven pieces, two of them small. All but M6 live in one new file, `core/place.js` (393 lines in the prototype, of which
about 90 are comments), called from `core/app.js` show() at three points. The page code is untouched.

### M1. One key per history entry, one record per key (Back, Forward, Reload)

- **Where.** `core/place.js` `createPlace()`: `arrive(route)` at the start of a route show, `leave()` just before the
  shell empties `#content`, `holdPlace()` after the page is drawn. `core/app.js` show() calls them; `arrived()` applies
  the record. `history.scrollRestoration = "manual"` once at boot (`place.init()`).
- **What it keeps.** `history.state.pk`: a short random key, written once per new entry with
  `history.replaceState({ ...history.state, pk }, "")` (it spreads the state, so Get started's `suFrom` and its own
  `replaceState(history.state, ...)` keep it). Under that key, in a Map mirrored to `sessionStorage["planner.place"]`
  (`planner.place.sandbox` in the sandbox): `{ path, prev, y, docH, anchor, folds, at }`. `anchor` is the element at the
  top of the screen (from `elementFromPoint` just under the top bar, lifted to the nearest heading, row, label, button,
  paragraph or card) with its locator and its top; `folds` are the folds the person opened or shut (M4); `prev` is the
  key of the entry the person came from (B4). Pruned to the newest 40 entries. Lives for the tab's session.
- **When it is written.** At the start of show() for a new address, Back or Forward (with `scrollRestoration` manual the
  browser has not moved the page yet, so `scrollY` is still the old page's); on `visibilitychange` to hidden and on
  `pagehide` (a reload, switching apps, locking the phone). Never on scroll, so Safari's limit of 100
  `replaceState` calls per 30 seconds is never near.
- **When it is used.** show() for an entry that already has a key (Back, Forward, Reload): after the page is drawn, the
  record's folds are applied, then `holdPlace()` puts the anchor back at its old screen height (or `scrollTo(y)` when
  the anchor is not drawn), every animation frame for up to 2.5 s while the page settles (pages that work their answer
  out after drawing grow later), and stops at the person's first touch, wheel or key. `#content` keeps
  `min-height = max(y + innerHeight, docH)` for that time so the browser never clamps the place. A new address is
  unchanged: scrollTo(0) as today (D-TOP).
- **Fits the existing flow.** keepScroll redraws do not touch it. `renderSeq`: a newer show() wins; the hold ends when
  another address is shown (a `routeSeq` counter that counts only address shows, so a save's redraw of the same page
  does not cut it short; see "Measured" for the fault this fixed). The boot-time redraw that follows `refreshStatus()` (`planner:live`) used to wipe the held height: the keepScroll
  path now restores the height it found (`heldMin`) instead of "". The one reload of `core/heal.js`: the record is saved
  on `pagehide` only when the page on screen finished drawing (`drawn` flag), so a half-drawn page that throws never
  overwrites the record the reload will use. The sync bar: its own `scrollTo(0, 0)` for a fresh conflict runs later and
  wins, as designed. The guide frame and pages that scroll themselves while drawing: on a return the record wins (it is
  newer: the person was there); on a save the page still wins (unchanged rule).
- **Alternatives weighed.** (a) The browser's own restoration (today): 6 of 18 at normal speed, 1 of 18 at 4x slower,
  0 of 18 on Reload. Lost. (b) A Map keyed by the address: two entries of one address (check-in, step, check-in again)
  need two places, and it dies with a reload. Lost. (c) Everything in `history.state`: per-scroll writes hit Safari's
  rate limit, and a lost write is silent. Kept only the key there. (d) A scroll listener saving as you go: not needed,
  the leaving moment is enough once restoration is manual (one less listener, no throttling).
- **Measured** (`e1-back.mjs`, 22 trips planned, 18 with a link on the screen, families family, ruth, patLee,
  freelancer; trips on overview/plan, retirement/projection x2, overview/dashboard, overview/pages (3,785 px down),
  cashflow/recurring, insurance/property, scenarios/advisor-plan, career/benefits, overview/next-best-action,
  scenarios/stress-tests with a row opened, balance/net-worth, retirement/withdrawal-strategy, taxes/federal,
  overview/quick, overview/guide/retire with "More on this" opened, scenarios/goal-seek, career/side-income):

  | | Back within 100 px | exact | sections as left | Forward within 100 px | Reload within 100 px |
  |---|---|---|---|---|---|
  | today, normal speed | 6 / 18 | 5 | 16 / 18 | 12 / 18 | 0 / 18 |
  | today, processor 4x slower | 1 / 18 | 1 | 16 / 18 | 9 / 18 | 0 / 18 |
  | M1 alone (`?keep=off`) | 18 / 18 | 17 (what was at the top of the screen: 18 of 18 exact) | 18 / 18 | 18 / 18 | 17 / 18 |
  | M1 + M2 (full) | 18 / 18 | 17 (what was at the top: 18 of 18 exact) | 18 / 18 | 18 / 18 (second run 17, fault below, fixed) | 16 / 18 |

  The one "inexact" Back (cashflow/recurring, +60 px of scroll) is the anchor doing its job: the link was the path's
  Next, which writes the plan, so the page came back with the path's bar 60 px tall above it and the line the person was
  reading at the same screen height. A second full run (`out/e1-full2.log`, with the "what was at the top" measure)
  found one real fault: on that same trip Forward came back at 705 px instead of 235, because the 2.5 s hold of the
  page just left was still running and scrolled the next page. Fixed in the prototype (the hold stops as soon as
  another address is shown: `routeSeq`, not `renderSeq`, so the boot-time redraw of the same page does not stop it);
  re-measured 3 of 3 within 44 px (`out/e1-full-recurring.log`).

  Why the two "today" baselines differ (mine 6 of 18, the first architect's 15 of 17): `e8-backmethod.mjs` runs four
  trips four ways each (page opened from its address or from the Dashboard; Back as `history.back()` or as the
  browser's own Back). Today: 7 of 16 kept, every one either exact or at 0 px within the first 50 ms, with no pattern by
  method or entry (`out/e8-off.log`). It is a race between the browser's own restoration and the shell's
  `scrollTo(0, 0)`, decided by what else is loading at that moment; different runs draw different luck. Prototype: 16 of
  16 exact (`out/e8-full.log`). The two Reloads off by about 200 px are retirement/projection, whose page grows a
  518 px wide line while it draws (the phone then zooms out and the layout viewport becomes 1,122 px tall, so no scroll
  can reach the old place); that is a page overflow (theme PHONE), not this mechanism.

### M2. The page kept alive for Back and Forward (no redraw at all)

- **Where.** `place.leave({ keepable })` moves `#content`'s children into a small cache instead of letting the shell
  empty it; `place.takeCached(key, ...)` gives them back; show() puts them in place, sets the title, closes the menu,
  `scrollTo` the exact old place and the old inner scroll offsets, and returns without calling `render`.
- **What it keeps.** The last 4 pages' nodes, with the plan object they were drawn from, the shell's "world" counter
  (bumped by `planner:view`, `planner:live`, `planner:features`, which also empty the cache) and the module that drew
  them. Memory only; a reload empties it.
- **Taken only when nothing it shows can have changed**: `store.get() === plan it was drawn from`, same world counter,
  its module has not drawn another address since (module-level state stays consistent: guide/debt vs guide/retire,
  the setup screens), it returned no cleanup function (system/backups, system/audit, system/diagnostics: never kept),
  and its draw finished (renderSeq). Otherwise M1 does the work. The guide frame's bar and card are drawn afresh on a
  reattach (their one-page "‹ Back to" trails move on while the page is away); the page's own nodes are not touched.
- **Why at all, when M1 already reaches 18 of 18?** Because it brings back what no record can: an edit form the page
  opened from a row (its open state is a variable inside the page's render on 25 pages), typing in it, a half-scrolled
  table, a chart's readout, an expanded "show more", and it is instant on heavy pages (no second Monte Carlo run).
  It is the "not throwing the page away" option the brief asked to weigh first, and it is the only one that holds up
  (see the morph result above).
- **Alternatives weighed.** (a) Keep it alive also for a new visit by a link: would start mid-page and break D-TOP; not
  done. (b) Keep it also when the plan changed and patch the new numbers in: that is the morph, which fails (e7).
  (c) No cache: M1 alone is 18/18 on place and sections, but loses B13 and the open edit forms.
- **Measured.** Hit rate in the Back trips: 14 of 18 kept, 4 redrawn (the link wrote the plan: the path's Next, the
  guide's own links). In the typing walks (e3): Income with Ana's edit form open, Back to the Dashboard, Forward: the
  form is open with 9,999 in it (today: closed, typing gone). Goals' add form, menu to Expenses, Back: open with "New
  roof" and 18,000 (today: folded, gone); same on Income's add form (empty plan), Withholding check, Pensions, Advisor's
  plan. No page error in any run (0 `pageerror` in 120+ page loads with M2 on).

### M3. Carry across a save (the same page drawn again)

- **Where.** show() keepScroll branch: `snapshot(root, { anchor, skipForm })` before `root.innerHTML = ""`,
  `apply(root, snap, { focus: true })` after `await m.render`, then `holdAnchor()` and `releaseRoom()`.
- **What it keeps, for the 50 ms to 2 s of one redraw.** (1) The folds the person opened or shut, with how the page had
  drawn each (M4). Rule: when the page draws that fold the same way as last time, the person's choice wins; when the
  page changed its mind (a form it folds away after the first save: goals/house, insurance/health, investments/fees, the
  estimated-tax "Last year's return"), the page wins. That one rule keeps "the one just saved stays open" (design log,
  Social Security) and the pages that fold on purpose, without a list of pages. (2) The typing: every control the person
  typed in (a trusted `input`/`change` event) whose value differs from its default, except in the form whose submit
  caused this redraw (a capture-phase `submit` listener). Put back only into the same control (M5) and only when its
  default is unchanged (its saved value did not move); then `input` (and `change` for selects and ticks) is fired so
  money boxes re-check and pages that keep their own model (Get started) learn it; a fold around it is opened.
  (3) The focus, with the caret. (4) The anchor: the control the person last pressed (pointerdown in `#content`, under
  20 s old), else the focused one, with its landmarks (row, form, fold, card) and their screen tops.
- **After the draw.** The first landmark of the anchor that is still drawn goes back to its old screen top
  (`holdAnchor`): the button, or its row if the button went away (a "Use this one" that becomes "yours"), or its fold.
  When the page got shorter below the thumb, the held height stays until the person scrolls up to where it is no longer
  needed (`releaseRoom`), so nothing is clamped under the thumb. "Not saved yet" (`small.help.place-unsaved`) goes into
  the `.form-actions` of each other form that got its typing back.
- **Alternatives weighed.** (a) Node-by-node morph: fails (e7). (b) A draft inside `ui.form` (findings T1, x-3): a
  kit-only fix misses hand-built boxes (Update my balances, Get started, the check-in note, the setup questions) and
  still needs the fold and anchor parts; and `core/ui/dom.js` is the forms track's file. The shell carry needs no kit
  change; the forms track can still call `place.isDirty()`. (c) Not redrawing while a box has the focus: the redraw then
  happens on the next tap and swallows it (UI-LIVE). (d) Chromium's own scroll anchoring: absent in Safari, and the
  shell replaces the anchor node anyway.
- **Measured** (`e2-redraw.mjs`, real taps; today -> prototype):

  | flow | section | tapped control moved | other form's typing | confirmation seen |
  |---|---|---|---|---|
  | debt/credit-cards, 0% move, Use these numbers | shut -> **open** | 453 -> **0** px | | no -> **in view** |
  | balance/update, Save all balances | | 109 -> **0** | | no -> **bottom copy with "See net worth ›"** |
  | career/benefits, Commuting typed, Life insurance Save | Commuting shut -> **open** | -204 -> **0** | 120 lost -> **kept** | bottom copy |
  | insurance/health, Add a plan typed, coverage Save | | 64 -> **-1** | lost -> **kept** | bottom copy |
  | taxes/estimated, 1st quarter typed, last year's Save | (page folds it on purpose: page wins) | 380 -> **0** | 1,000 lost -> **kept** | bottom copy |
  | balance/accounts, note typed, Add this balance | | 146 -> **-1** | note lost -> **kept** | bottom copy |
  | retirement/buckets, Save | shut -> **open** | 251 -> **0** | | bottom copy |
  | retirement/medicare, Save in a fold | shut -> **open** | 344 -> **0** | | bottom copy |
  | retirement/withdrawal-strategy, second Use this one | | row moved -97 at +5 s -> **row held, 0 at +5 s** | | in view |
  | retirement/projection, Retirement settings Save | shut -> **open**, notice in view (was inside the shut fold) | 1,220 jump -> 191 (the page's 518 px overflow zooms the screen out mid-draw) | | no -> **in view** |

  `e6-pagedraw.mjs` (B10, a page redrawing itself): Chance the money lasts, Runs changed with "How this is done" open:
  shut today, **open**; Stress tests, "A crash like 2008" opened then Now: shut today, **open**.

  **As Safari would do it.** Chromium's own scroll anchoring was on in the runs above; Safari has none. Re-run with it off
  (`e2-redraw.mjs full "" anchor=off`, `out/e2-full-anchoroff.log`) and with the page's own scrolls counted rather than
  guessed from `scrollY` (taken from the first design, now in the prototype): the same results, 0 or 1 px on every flow
  except projection (239 px, the page's own overflow, see above). How much to take out, checked with the shell's own
  locator (`dbg-rowhold.mjs`, `out/dbg-rowhold.log`): the button goes away, its row is found and stays at 397 px of
  397.7. So the carry does not lean on Chromium's anchoring; the build sets `#content { overflow-anchor: none }` so
  both browsers behave the same.

### M4. Typing and folds the person touched, followed by what they are (the per-page draft)

- **Where.** `core/place.js`: document-level capture listeners (`input`, `change` with `isTrusted`, `click` on a
  `summary`, `pointerdown`, `submit`) mark what the person did, in WeakMaps on the nodes (gone with the nodes): `typed`
  (a control the person changed), `touchedFold` (a fold the person toggled -> how the page had drawn it), `where` and
  `foldWhere` (their locators, taken while they were on the page). One `MutationObserver` on `#content`
  (`place.watch()`).
- **Per page** (`group/id/rest`, without the query), in `sessionStorage`: the typing not saved, `{ k: locator, tag, v,
  d: the default it was typed against, form: the heading of its form }`. Written 0.5 s after typing stops, when the page
  is left, on `visibilitychange` hidden and `pagehide`. Dropped for a form when it is submitted, when "Clear it" or
  "Throw it away" is tapped, and for a control whose saved value changed (its default differs: the plan wins).
- **On every draw of that page** (a new visit, Back, Forward, Reload): typing for controls on the page goes back in (M3's
  rules) with "We kept what you typed here. It is not saved yet. [Clear it]" above its form; typing for a form not on the
  page is "parked" and the line at the top names that form. When the form appears later (the person taps that row), the
  observer puts the typing back and the top line goes.
- **A page taking a form away by itself** (a stray tap on another row swaps the edit form; a page redrawing its own
  section): the observer sees typed controls leave the page without a submit and parks them; if the same form is drawn
  again in the same moment (a page that redraws its own section), they go straight back, silently; otherwise the bottom
  note says it is kept. A form dismissed with its own non-submit button (Cancel, Close: the last tap was a button inside
  that form) is not kept. Folds the person touched that a page's own redraw took away get their state back when the
  same fold is drawn again within 1.5 s (B10).
- **Alternatives weighed.** (a) Ask before leaving (a confirm, or the frame's "first tap warns" guard on every link):
  Back cannot be cancelled (popstate fires after the fact), a dialog on every stray tap is noise, and the person loses
  nothing if the typing is simply kept. Kept the frame's existing guard on the path's own Next (it is the owner's built
  behaviour); added no new question. (b) A draft per `ui.form` (kit): misses hand-built boxes; would duplicate this.
  (c) `localStorage`: would let figures linger on the device after the tab is closed and leak between tabs; the plan
  itself is there but typing the person never saved should not outlive the visit. Chose `sessionStorage` (conservative;
  section 7).
- **Measured** (`e3-drafts.mjs`, today -> prototype, typed with real keys):

  | walk | today | prototype |
  |---|---|---|
  | Update my balances, two typed, "Continue your plan" row, Back | 4,200 / 11,500 (gone) | **3,900 / 9,999 + line** (M1 path: the link wrote the plan) |
  | Update my balances, two typed, Reload | gone | **kept + line** |
  | Withholding check 640, menu, Your plan, Back | empty | **640** (kept page) |
  | Income: Ana's edit form, 9999, Back (Dashboard), Forward | form shut, gone | **open, 9,999** (kept page) |
  | Goals: + Add another goal, two typed, menu, Expenses, Back | folded, gone | **open, both kept** |
  | Income on an empty plan: add form, two typed, menu, Expenses, Back | empty | **both kept** |
  | Pensions: two typed, "How long to plan for" link, Back | empty | **both kept** |
  | Advisor's plan: two typed, "Your assumptions", Back | empty | **both kept** |
  | Policies add form: two typed, "Continue your plan", Back | empty | **both kept + line** |
  | Income: Bo's edit form 7777, menu, Dashboard, menu, Income (a new visit) | gone | form shut, **parked, top line names it** |
  | Income: Ana's edit form 9999, stray tap on Bo's row, Ana's row again | 3,900 (gone, no word) | **9,999 + line**, note at the stray tap |
  | Capital gains: a name typed, then the "+$25,000" chip redraws the form (`e9-chip.mjs`, case from the first design) | empty | **"Index fund" kept, silently** |

### M5. The locator: how the same box, fold, row or button is recognised in a new drawing

- `key = scope | own name # n`. **Scope**: the titles of the landmarks around it, outermost first: a fold (its summary's
  first part, without `.fold-status`, the chevron and badges), a card or section (its `aria-label` or first heading), a
  list row in `.records` / `.page-list` (its `.rec-title` / `.t`), and a form as `f<index in its card>`. **Own name**: a
  control's `name` (ui.form sets it to the field key), else `aria-label`, else its label's words, else its placeholder,
  with its tag and type; a fold by its title; a row or card by its title; anything else by its words. **Titles lose their
  figures** (`soft()`: "Ana's salary: $3,900" and "Ana's salary: $4,100" are the same row) **and their badges** ("Trim
  after bad years" with or without "yours"). `n` is the occurrence of that key on the page, used only when the key is
  not unique; when a key has exactly one match the match is taken whatever its old `n` was.
- **Measured** (`e5-locator.mjs`): every usable page (157) for three households (family, ruth, freelancer): 8,484
  controls, folds, buttons and links. Each locator finds its own element: 8,484 / 8,484. Named without a position:
  7,806 / 8,484 (92.0%); the rest are repeated rows ("Use this one", "Edit ›") told apart by their row's title in the
  scope, and only then by position. After the shell draws each page again: the same element 8,482 / 8,484, a wrong
  element 0, not found 2 (retirement/projection, whose drawing changes shape while it computes). **Against a changed
  drawing** (`e5-locator.mjs family perturb`: each redraw adds a notice at the top of the page and a new first row to
  every list, as a save does): the same element 3,093 / 3,093 (1,966 buttons and links, 391 folds, 736 boxes), wrong 0,
  lost 0; a position-only locator (the path of child indexes, what a naive "restore the n-th box" would use) finds the
  same element for **151 of 3,093** (4.9%). That is the case for naming things rather than counting them.
- **Safety rules on top**: typing goes back only into a control with the same key AND the same default; an anchor that
  is not drawn is skipped for the next landmark; a fold is set only if the page drew it the same way as before.

### M6. "‹ Back to ..." links go back

- **Where.** `core/app.js` `installBackLinks()`: one `click` listener on the document (bubble phase, so the frame's own
  guard and the page's handlers run first and can still `preventDefault`). It acts on `#content a[href^="#/"]` that are
  marked `data-back` or whose words start with "‹". If the entry the person came from (`record.prev`, M1) has the same
  page path as the link and the same query (a `month` that entry lacks is the month it showed by itself; `from` is
  ignored), it calls `history.back()` instead of following the link: "‹ Back to the October check-in" never returns to
  the November one (this query rule is taken from the first design; added to the prototype and re-measured,
  `out/e4-full2.log`, same results). `frame.js` marks its eight back links
  `data-back` (the two without "‹": "Back to quick answers", "Back to your plan ›").
- **Keeps nothing new** (it reads M1's `prev`).
- **Alternatives weighed.** (a) The frame remembers the trail itself (it already has one-page trails in sessionStorage):
  would duplicate M1 and still not know whether that page is the previous history entry. (b) `history.go(-n)` to the
  nearest earlier visit of that page: more reach (Your plan -> A -> Next result B -> "‹ Your plan" would go back two),
  but an extra entry pushed by another track (the menu's own entry, M8) would make the count wrong; kept to one step.
- **Measured** (`e4-backlinks.mjs`): check-in (family), three steps, each time "‹ Back to the November 2026 check-in":
  today lands at the top (365 -> 0, 365 -> 0, 638 -> 0), history grows each time, 7 Back presses to the Dashboard;
  prototype lands exactly (370, 370, 638), history +0, **1** press. Quick answers (patLee) from 985: today top, 3 presses;
  prototype 985, 1 press. Your plan (family) from 885: today top, 3 presses; prototype 885, 1 press.

### M7. Confirmations where the eye is, and still

- **Where.** `core/app.js` show() keepScroll branch and `echo()`; `core/ui/base.css` `.save-echo .save-echo-go`.
- **Seen** = the words are on the screen: not inside a shut fold, and at least 60% of its height (or 48 px) between the
  top bar and the bottom edge (today: one pixel anywhere counts, so a line hidden under the top bar or inside a shut fold
  "counts as seen").
- **The bottom copy keeps a way on**: the fresh notice's first link or button, else the frame's "‹ Back to ..." link of
  the page it was opened from (MR-1), as a 44 px tap target (`pointer-events` only on it); a link is a real link, a
  button proxies a click to the page's own button while it is still on the page. With a way on it stays 7 s (3.2 s
  without, as today). It is still a short note that leaves: no fixed bar (design log 2026-11-06).
- **Nothing pulls the page under the thumb.** The 102 `setTimeout(() => n.remove(), 4000 ... 8000)` in the views are
  neutralised for the fresh notices of a save without touching a page: the shell gives each fresh notice an own
  `remove()` that only removes it when the person touched or typed in the last 0.9 s (so a page that clears its notice on
  the person's next action still can). The notice then stays until the next redraw replaces it. Measured on
  withdrawal-strategy: today the rows move 97 px up 4 s after "Use this one"; prototype 0.
- **Alternatives weighed.** (a) Delete the 102 timers in a scripted wave-2 change: right in the end, but 13 of the
  views are claude-a's and may not be edited, so the shell must cover them anyway; I list the deletion as optional
  cleanup. (b) Move the page's notice next to the tapped button: overrides each page's layout choice ("top of its card is
  fine", CONVENTIONS) and its links' context; the anchor (M3) already keeps the button still when the line is drawn
  above it, and the bottom copy carries the link. (c) Remove an off-screen notice at once and show only the copy
  (finding x-1): the copy then is the only record; with M3 holding the thumb there is no jump to avoid.

### M8. The menu and Back (compatibility; not prototyped)

j-fat-fingers/x-2 (menu part) is also SH-MENU N3. If no other track lands it, the shell does: opening the drawer pushes
`{ ...history.state, drawer: 1 }` (same `pk`, same address, so no hashchange and no redraw); a `popstate` while it is open
closes it; closing it by the cross, the scrim or Escape calls `history.back()` when the top entry is the drawer's; a
link followed from the open drawer uses `location.replace(href)` so the drawer's entry is replaced, not left behind as a
dead Back press. M1 already treats the drawer entry as the page's own (same `pk`). Whoever builds it must keep those two
rules (spread the state, replace on follow); M6 compares paths, so it is not confused by the drawer entry.

## 3. What a page must do (wave 2 adoption list)

Short on purpose: nothing below is needed for B1 to B13.

| page(s) | change | finding |
|---|---|---|
| cashflow/income, cashflow/expenses, cashflow/budget, goals/goals, balance/liabilities, balance/net-worth, household/people, investments/holdings, transactions/ledger (claude-b) | Back closes an open edit form first: call `ctx.place.sheet(close)` in the row's onClick (new shell helper: pushes `{ ...state, sheet: 1 }`, a popstate with the form open calls `close()`, the page's own Cancel; Save and Cancel call `history.back()` to use the entry up). One line per page. | j-debt-fixer/x-2, p-cashflow-a/CF-3, j-fat-fingers/x-2 (form part) |
| the 25 pages whose open-form state lives inside render (list in `out/` notes: balance/liabilities, balance/net-worth, cashflow/budget, cashflow/expenses, cashflow/income, estate/digital, estate/gifting, goals/goals, household/people, insurance/health, insurance/policies, investments/holdings, investments/tax-lots, retirement/contributions, retirement/pensions, taxes/capital-gains, transactions/categories, transactions/ledger, transactions/rules; goals/travel is claude-a's) | Optional: reopen the form by itself when `ctx.place.parked()` names it, instead of the line asking the person to. | p-balance/B1, p-career-household-system/x-1 (a), p-investments/INV-4 |
| overview/setup (view.js only) | Mirror its `drafts` (the chips: I work, A month) to sessionStorage, as j-first-renter/x-4 proposes; the boxes are already kept by M4. | j-first-family/F2, j-first-renter/x-4 |
| retirement/monte-carlo | Say "Now using 2,000 pretend futures" beside the select after a change and give it the focus back. | j-heavy-waiting/W4 |
| retirement/roth-conversions | Leave out stop ages at or before the retirement age (content, not place). | p-retirement-b/RB1 (Roth part) |
| the 89 claude-b views with `setTimeout(() => n.remove(), ...)` | Optional scripted removal of the timer lines (dead code once M7 holds). claude-a's 13 keep theirs. | j-first-retiree/x-2, p-transactions-helpers/x-notice-jump |
| insurance/health | Optional: "Your coverage and your bills" above "Add a plan" while there are no plans (the help text points down to it). | p-insurance-estate/x-1 (page part) |

## 4. Risks: what could get worse than today, and the check that catches it

1. **Typing put into the wrong box** (a collision). Guarded by key + same default + scope titles. Check: `e5-locator.mjs`
   (0 wrong out of 8,484; must stay 0) and a sweep assertion in the build: after every apply, each refilled control's
   label words equal the draft's (`place.js` can log a mismatch in the sandbox; the walk fails on any).
2. **A refill fires `input`/`change` and a page that saves as it changes saves the typing without a tap.** Only typing
   whose default is unchanged is refilled, and a save-on-change control is saved the moment it changes (so it is never
   a draft). Check: in `e3-drafts.mjs`, count `plan.meta.updatedAt` changes between arriving and the next tap: must be 0
   (add to the script in the build step).
3. **A kept page shows something stale.** Validity is the plan object itself, the world counter, the module's last
   address and the absence of a cleanup. Check: a new kit test: change the plan in a second tab (`storage` event ->
   `otherTab()` gives a new plan object) while on page B, Back to A: A must be drawn again (`__placeLast.kind` is
   "return", not "kept"); and a date check (`fmt.today()` stored with the cache entry) so a page kept past midnight is
   drawn again.
4. **The hold fights the person, or scrolls the wrong page.** It stops at the first touch, wheel or key, when another
   address is shown, and after 2.5 s. The second case was a real fault found in measurement (Forward within 2.5 s of a
   Back landed at the old page's place) and is fixed. Check: `e1-back.mjs full 1 3 recurring` (Forward within 100 px)
   and an `e1-back.mjs` variant that swipes 200 ms after Back: the final scroll must be where the swipe took it.
5. **Blank room at the bottom after a save** (M3 `releaseRoom`). It goes when the person scrolls up. Check: a shot after
   the projection save, then a swipe up: no gap left (`tools/shot.mjs` after the build).
6. **History confusion** (Get started's `suFrom`, a drawer entry from SH-MENU). State is always spread; the key is
   written once. Check: `qa/flows/path-walk.js` (Get started's "‹ Back" and Back) and E4 for the back links; a direct
   open of a step URL in a fresh tab: "‹ Back to the check-in" must follow its link (no `prev`).
7. **Storage unavailable** (private mode, a sandboxed frame): every read and write is in try/catch, memory only; nothing
   breaks, a reload just forgets. Check: the single-file demo in a sandboxed frame (`qa/user-view.mjs`).
8. **The notice shim blocks a page's own removal**: only for the fresh notices of the last save, only without recent
   input. Check: grep in the build for `.notice` removals that are not timers (none found in the views today); `npm test`.
9. **Cost on long pages**: the observer works only on removed subtrees and only locates typed controls; the per-frame
   hold measures one element. Check: D-TIME in `qa/touch-sweep.mjs` on overview/pages and transactions/ledger, and the
   kit's long-task figure on a Back to overview/pages (must not exceed today's).
10. **Privacy**: typing never saved stays in `sessionStorage` for the visit, separate key in the sandbox, never in the
    plan or `localStorage`, never sent. Check: the leak guard and a grep for `planner.place` in `localStorage` calls.
11. **Focus put back on iPhone may open or close the keyboard unexpectedly.** Only after a save that removed the focused
    box, never on Back or Forward. Check on the phone (section 5).
12. **D-TOP in the touch sweep**: a "‹ Back to ..." tap now lands where the person was, not at the top. The sweep must
    treat `a[data-back]` and "‹" links with D-BACK's measure. Message for the touch-check agent (below).
13. **A token or key kept in the tab** (AGENTS rule 10: no other place holds a token). Settings has "Access token"
    (`name=token`) and "API key" (`name=apiKey`) as plain text boxes. The first prototype version would have kept a
    half-typed token in `sessionStorage`. Fixed (from the first design): boxes of type password, or named or labelled
    token, API key, secret, password, pass code or PIN, or inside `[data-no-keep]`, are never marked as typed, so never
    kept, parked or refilled. Check: node test `secret boxes are never kept` (in the prototype: "Transit pass" is still
    kept, "Access token" is not) and a kit walk: type in Settings' token box, leave, Back: the box is empty and
    `sessionStorage["planner.place.sandbox"]` holds no draft for system/settings.
14. **Counting the page's own scrolls wraps `scrollTo`, `scrollBy`, `scroll`, `scrollIntoView` and `focus`** (taken
    from the first design; a `scrollY` test was fooled by the browser moving the screen during a redraw). A wrapper that
    lost an argument or a return value would break pages. They pass `this`, every argument and the return value through
    and only count while a page draws. Check: a node test of the wrapper on a stub object, and `node qa/smoke-all.mjs`
    page errors unchanged.

## 5. iPhone Safari

Where Safari differs for these mechanisms:

- `history.scrollRestoration` and `history.state` are supported (Safari 11+); `replaceState` is rate-limited (100 per
  30 s): we call it once per new entry. Safari restores scroll for same-document traversals at a different moment than
  Chromium (the findings' races); with "manual" it does not restore at all, so the result no longer depends on it.
- The swipe-back gesture shows a picture of the previous entry while the finger moves; on release a kept page (M2) is
  identical to that picture; a redrawn one (M1) may flash once while it is drawn.
- No CSS scroll anchoring (`overflow-anchor`): every "keep what is under the thumb" here is our own code, so Chromium
  runs are a fair stand-in; to make them stricter the kit can set `overflow-anchor: none` on `html` (test only).
- `element.focus()` outside a tap may not raise the keyboard: M3 puts the focus back only after a save that removed the
  focused box; on iPhone the caret may be there without the keyboard.
- A home-screen app the system has killed opens at `start_url` ("./") with a fresh session: `sessionStorage` and history
  are gone, so B3, B7 and B8 hold within a visit, not across a cold start. A tab Safari discards in the background
  usually comes back with its session (history state and sessionStorage), but this must be seen on the phone.
- `visibilitychange` to hidden fires when switching apps and locking; `pagehide` on reload. We save on both; no `unload`
  listener is added.

For the owner to try on the phone (each takes under a minute; today's behaviour first, then after the build):

1. Your plan: scroll half way, tap a row, press Back (swipe from the left edge). Same row on the screen? Ten times.
2. Will the money last?: open "Retirement settings", change the spending, Save. The section stays open, Save stays under
   your thumb, a green line is visible.
3. Update my balances: type two balances, do not save, switch to your bank app for two minutes, come back. Still there?
   Then lock the phone for a minute. Still there?
4. Income: tap a salary, change the amount, swipe back, then swipe forward. Form open with your figure?
5. Check-in: open a step, tap "‹ Back to the ... check-in", then press Back once: the Dashboard?
6. Settings: open "Assets and debts", go to the Dashboard from the menu, Back: still open?
7. As a home-screen app: type in a form, close the app from the app switcher, open it again: the typing is not expected to
   survive (say whether that is acceptable).

## 6. Build steps (each small enough to verify alone)

1. **`core/place.js` pure parts + tests.** `soft`, `pathOf`, `prune`, `secretName` and the locator functions;
   `tests/place.test.mjs` (the prototype's four tests, plus locator tests on a hand-built DOM fixture if the build adds
   a tiny DOM shim; else the locator stays covered by `e5`). Checks: `npm test`, `npm run check`.
2. **M1 only** (keys, records, `scrollRestoration`, `holdPlace`, `pagehide`/`visibilitychange`), wired in show() with
   `?place=off` kept for the before/after runs until the end of wave 1. Checks: `e1-back.mjs restore 1` and
   `e1-back.mjs off 4`: Back, Forward and "what was at the top" 18/18; Reload 17/18 or better; D-TOP still 0 breaks on
   the touch sweep.
3. **M6 back links** (`installBackLinks`, `data-back` in frame.js). Checks: `e4-backlinks.mjs full`: dy 0 and history +0
   on all five; one Back press to the Dashboard; `qa/flows/path-walk.js`.
4. **M3 carry** (folds, typing, focus, anchor, releaseRoom, "Not saved yet"). Checks: `e2-redraw.mjs full`: tapped
   control within 60 px on every flow (D-SCROLL-KEPT), folds as in the table, other forms' typing kept; D-FOCUS-KEPT on
   the touch sweep; `e7-morph.mjs` stays as the record of why.
5. **M4 per-page drafts and the observer** (lines, parking, refill, Cancel = discard, folds across a page's own redraw).
   Checks: `e3-drafts.mjs full` all rows "kept"; `e6-pagedraw.mjs full` both open; the new "no save on arrival" count is 0.
6. **M7 confirmations** (`seen`, the copy's way on, the 7 s, the remove shim, `.save-echo-go` in base.css). Checks:
   `e2-redraw.mjs`: a confirmation seen or the copy present on every save; withdrawal-strategy row 0 px at +5 s; D-SEEN.
7. **M2 kept page** last (it only adds fidelity on top of 2 to 6). Checks: `e1-back.mjs full 1` and `full 4` (kept rate
   reported), `e3-drafts.mjs full` (the open edit form on Forward), the stale-plan test of risk 3, a full
   `node qa/smoke-all.mjs` run (no page error).
8. **Docs.** CONVENTIONS.md "render(root, ctx)": the redraw keeps open sections, unsaved typing and focus; a page that
   folds a form away on purpose keeps doing so; notices need no timer. TEAM claim lines; CHANGELOG lines per step.
   Then remove the `?place=off` switch.

Touch-check rules this should turn green (rules in `wtouch/qa/touch-rules.json`): **D-BACK** (scroll within 100 px,
same open sections, Forward), **D-SCROLL-KEPT** (tapped control within 60 px), **D-SEEN** (a confirmation in view, the
copy counts), **D-FOCUS-KEPT** (focus and typing kept across the redraw); **D-TOP** must stay green, with the note that
`a[data-back]` and "‹" links are checked as Back, not as a new page.

## 7. Design log and lanes

Decisions relied on, quoted from docs/DESIGN_LOG.md:

- 2026-11-06 (one path): "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the
  page's own buttons)". The bottom copy stays a short note that leaves by itself; its link is not a bar.
- 2026-11-06 (one path): Get started shows "the eight tiles folded behind “Just want one answer?”". Kept: a fresh visit
  draws folds as the page designs them; only Back, Forward and Reload bring back what the person opened.
- 2026-09-16 Pass 4 Finding 4 (Social Security): "one fold per person, first open, the one just saved stays open". M3
  generalises it: a fold the person opened stays open after a save, unless the page now draws it differently.
- 2026-09-15 Net worth round 4: "first visit with no accounts keeps the form open; Edit opens it filled in; Cancel folds
  it". Cancel still throws typing away (M4's dismiss rule).
- 2026-09-15 Debts round 14: "the form opens inside the list card". Not moved; the sheet helper of section 3 only adds
  Back.
- 2026-09-15 Settings round 6 Finding 4: "a confirmation is kept in a module-level `pending` and shown by the next
  render" and "every save/add/remove confirms with a green notice". Unchanged; the shell only keeps it on screen.
- 2026-09-15 Shell pieces round 10: the pill's words and size. Untouched.
- 2026-11-06 (user view): no build, PC, AI or sync words in the household's view. The new lines: "We kept what you typed
  here. It is not saved yet." "Clear it". "Not saved yet". "What you typed in “...” is kept, not saved yet. Open it again
  to finish it." "Throw it away". "Your typing in “...” is kept. Open it again to finish it."

Lanes: only `core/place.js` (new), `core/app.js`, `core/router.js` (unchanged in the end: hashchange stays the one
trigger), `modules/overview/guide/frame.js` (eight `data-back` attributes), `core/ui/base.css` (two shell selectors:
`.save-echo .save-echo-go`, `#content .place-unsaved`). No view.js, no compute.js, nothing of claude-a's: their pages
(goals/travel, taxes/documents, ...) get B1 to B13 from the shell. Nothing in setup/compute, projection/compute or the
guess estimators. `core/ui/dom.js` (forms track) is not touched; what the forms track's helpers need from this one: keep
building controls with a `name` and a label (the locator's own name), put a form's edit heading inside its card (its
scope), use `place.isDirty(control)` instead of their own dirty test, and let the shell's carry put typing back (do not
re-fill from their own draft store); their "bring the answer into view" must run after the shell's anchor (it does: it
is the page scrolling itself, which wins on a save).

Choices made without asking the owner (the conservative option each time):

1. A save's green line now stays until the next action instead of leaving after 4 s (not a logged decision; the finding
   says so). The conservative alternative would be "fade, do not remove"; staying is simpler and moves nothing.
2. Kept typing lives for the visit (`sessionStorage`), not across a closed tab or a home-screen app relaunch.
3. The bottom copy with a link stays 7 s (3.2 s without, as today).
4. On-screen back links go back only when the page they name is the one just before; otherwise they open it as today.
5. At most 4 pages are kept alive, and never one that returned a cleanup function.
6. Nothing asks before leaving a page with typing (it is kept instead); the frame's existing guard on the path's Next is
   left as it is.

## 8. Coverage

| finding | where |
|---|---|
| SH-BACK j-first-family/x-1 | closed by B1 |
| SH-BACK j-first-freelancer/x-2 | B1 |
| SH-BACK j-first-retiree/x-1 | B1 |
| SH-BACK j-heavy-waiting/W1 | B1, B2 |
| SH-BACK j-monthly-return/x-back-top | B1 |
| SH-BACK j-navigator/N1 | B1, B2, B3, B4 |
| SH-BACK p-career-household-system/F1 | B1, B2 |
| SH-BACK p-cashflow-a/x-1 | B1, B2 |
| SH-BACK p-insurance-estate/IE-1 | B1 |
| SH-BACK p-overview-home/OV-1 | B1 (Forward too) |
| SH-BACK p-retirement-a/R-A2 | B1, B2 |
| SH-BACK p-retirement-b/x-2 | B1, B2 |
| SH-BACK p-retirement-c-scenarios/x-back-loses-place | B1, B2 |
| SH-BACK p-taxes/x-1 | B1, B2 |
| SH-BACK j-first-renter/x-3 | B1 |
| SH-BACK j-monthly-return/x-backlink-history | B4 |
| SH-BACK j-one-answer/A5 | B2 |
| SH-BACK j-one-answer/x-4 | B4 |
| SH-BACK p-overview-path/x-2 | B2 |
| SH-DRAFT p-insurance-estate/x-1 | B6; Health's order optional (section 3) |
| SH-DRAFT p-taxes/T1 | B6 (a, b, d, e), B7 (c) |
| SH-DRAFT j-debt-fixer/x-2 | B7, B13 (typing, Forward); Back closing the form moved to section 3 |
| SH-DRAFT j-fat-fingers/FF2 | B9 (1), B7 + B13 (2), B7 (3) |
| SH-DRAFT j-first-family/F2 | B8 (boxes); chips moved to section 3 |
| SH-DRAFT j-monthly-return/x-typed-lost | B7, B8 (and B6 for the check-in note across the month chips) |
| SH-DRAFT j-navigator/x-2 | B7, B8 |
| SH-DRAFT p-balance/B1 | B7 (auto-reopen of Net worth's forms optional, section 3) |
| SH-DRAFT p-balance/x-1 | B6; Net worth's add form folding after "Save today's totals": typing parked (B7 line), reopen optional |
| SH-DRAFT p-career-household-system/x-1 | B6 (b, c, d); (a) People's edit form: typing parked, B7 line |
| SH-DRAFT p-cashflow-b-goals/x-3 | B7, B13 |
| SH-DRAFT p-debt-property/x-3 | B7 |
| SH-DRAFT p-insurance-estate/IE-9 | B7 |
| SH-DRAFT p-retirement-a/x-2 | B7 |
| SH-DRAFT p-retirement-c-scenarios/x-half-typed-form-lost | B7 |
| SH-DRAFT j-fat-fingers/x-2 | forms: B7, B13; menu: M8 (SH-MENU N3), Back closing a form: section 3 |
| SH-DRAFT p-career-household-system/F2 | B7 |
| SH-DRAFT p-cashflow-a/CF-2 | B7 |
| SH-DRAFT p-cashflow-a/CF-3 | typing B7 + B13; Back closing the form: section 3 |
| SH-DRAFT p-investments/INV-4 | B7, B2 (Allocation's fold reopened around kept typing) |
| SH-DRAFT j-first-renter/x-4 | B8 (boxes); chips: section 3 |
| SH-REDRAW j-first-freelancer/x-1 | B5 |
| SH-REDRAW j-monthly-return/MR-1 | B11 |
| SH-REDRAW j-one-answer/x-2 | B5, B11 |
| SH-REDRAW j-debt-fixer/x-3 | B5 |
| SH-REDRAW j-first-retiree/x-2 | B12 (timer cleanup optional, section 3) |
| SH-REDRAW j-heavy-waiting/W4 | B10; the "Now using ..." line and focus: section 3 |
| SH-REDRAW p-balance/B2 | B5, B11 |
| SH-REDRAW p-retirement-a/R-A4 | B5, B11 |
| SH-REDRAW p-retirement-b/RB1 | B5; Roth's stop ages: section 3 (content) |
| SH-REDRAW p-retirement-b/x-1 | B5, B12 |
| SH-REDRAW p-transactions-helpers/x-notice-jump | B12 |
| SH-REDRAW p-taxes/x-5 | B11 |

52 findings: 47 closed in full by the shell, 5 closed in part with the rest in section 3 (j-debt-fixer/x-2,
p-cashflow-a/CF-3, j-first-family/F2, j-first-renter/x-4, j-heavy-waiting/W4); none declined.

## Compared with the first design

Read after sections 1 to 8 were written (`w1/place/design.md` and its `proto/`, `results/`). It was being finished
while I read it: a few measured cells were still placeholders (`[[D_INC]]`, `[[K_MENU]]` ...), so for those I used its
result files. The two designs were made apart and arrive at the same shape: `scrollRestoration = "manual"` and one
record per history entry in `sessionStorage`; the place put back after the page draws and held while it grows,
stopping at the first touch; up to 4 pages kept alive for Back and Forward while the plan is unchanged, never one that
returned a cleanup; a locator that names things by their words without figures; folds, typing, focus and the tapped
control carried across a save, with the page winning on a fold it closes itself; an observer for pages that redraw
themselves and forms that appear later; back links that call `history.back()` when the entry before is that page; a
bottom copy of the confirmation with its link; notices removed by page timers neutralised. That two independent
designs converge is the best evidence the shape is right. The differences are in the details.

**What this design does better**

1. **Less machinery.** No router rewrite (one `replaceState` per new entry from `place.js`; `core/router.js`
   untouched), no hold of the redraw while a box has the focus (their M8, whose own risk R6 is stale figures and stale
   handlers on screen until the box is left), a hold of 2.5 s instead of 8 s. Fewer things to remember and put back.
2. **Kept pages are also refused when their module drew another address meanwhile.** Module-level state (a list
   page's `editing`, the guide's step, Get started's screen) is shared by every entry of that module. Their check is
   the epoch, the address and 15 minutes, so Back from guide/retire to a kept guide/debt (same module, no plan change)
   reattaches handlers whose module state now belongs to the other page. Here that case is drawn again.
3. **Typing is matched per box**, so a box keeps its typing when only another box of the same form changed its saved
   value. Theirs lets go of the whole form then (their census: 84 of 86, 63 of 64, 76 of 77 forms recognised after a
   real change; the rest dropped on purpose). More typing survives here; see below for why I would still take theirs.
4. **The locator found more after a changed drawing**: 3,093 of 3,093 (0 wrong, 0 lost) against their 90.3 to 95.2% of
   buttons and links (the rest "unsure", by design never a guess); both 0 wrong. The disturbances differ (theirs also
   changed every balance), so this needs a like-for-like run before it is claimed. Rows named by their title without
   badges ("yours") are what keep How much to take out's row under the thumb when its button goes away.
5. **Today's Back measured as what it is**: a race decided in the first 50 ms, all or nothing (`e8-backmethod.mjs`: 7 of
   16, each exact or 0 px; no pattern by how Back is pressed or how the page was opened). Their table shows today at
   15 of 17, which reads as "mostly fine"; my first run showed 6 of 18 and the walkers 15 of 24 at the top. Different
   luck in one race. The prototypes are 16 of 16 and 17 of 17.
6. **More walks with real typing and real saves, in both modes**: 12 typing walks and 10 saves before and after (their
   typing table was still being filled when read).
7. **Back links without touching the links**: any `a[data-back]` or link starting with "‹", page links included, with
   no frame helper; theirs routes the frame's links through `backLink`/`ctx.back` (explicit; a page's own "‹" link must
   opt in). Same results on the three measured hubs: the exact place, one Back press to the Dashboard.
8. **Kept typing on Forward into an edit form** (B13) and the bottom note at a stray tap were both measured here.

**What the first design does better**

1. **Back closes the menu, built and measured** (`router.layer`, their `m-links.mjs` menu-back: closed, a second Back
   reaches the Dashboard), and the same `ctx.layer(close)` offered to the 27 list pages with an edit form. Mine left the
   menu as a compatibility note (M8) and named a similar helper (`ctx.place.sheet`) without building it.
2. **The page's own scrolling is counted, not guessed from `scrollY`.** They found `scrollY` drifting 279 px on Will
   the money last? with no scroll call; my `scrollY` test was fooled the same way. Taken into my prototype (results
   unchanged elsewhere).
3. **Privacy guards**: password boxes and boxes named token, key, secret or pass code are never kept; typing expires
   after 24 h; a 300 KB cap. Mine had none: a half-typed "Access token" in Settings would have been kept in the tab
   (AGENTS rule 10). Taken (risk 13, now in the prototype with a test); expiry and cap still to add.
4. **A form is refilled only when it is the same form** (its boxes, each box's saved value, its button's words). Safer
   when boxes depend on each other (an amount typed for "a month" refilled after "how often" was saved as "a year").
   For figures this is the conservative rule; I would take it and keep my per-box locator inside it.
5. **The bottom copy**: at the top when the bottom would cover the button just tapped, a 700 ms guard so the second tap
   of a double tap does not follow its link, and a stay by length (4 to 12 s). Mine is bottom only, 7 s fixed.
6. **A longer, quieter hold** (up to 8 s, ends 700 ms after the place stands without borrowed height, or at a touch).
   They measured pages still growing after 2.5 s at 4x slower (ruth's Will the money last?, How much to take out); I did
   not run the full prototype at 4x slower.
7. **Reload lands exactly** (17 of 17 within 2 px at normal speed, against my 16 of 18 within 100 px, the two misses
   being projection's overflow).
8. **One cue for kept typing**: "Not saved yet. Undo my typing" beside the form's button, always. Mine has a line above
   the form on arrival and "Not saved yet" by the button only after a save elsewhere: two shapes for one meaning.
9. **The redraw waits while the person types in another box** after a box that saves on change (their M8): on iPhone a
   replaced box loses the keyboard, and my putting the focus back may not bring it back. Narrow (taxes/state,
   life-events, people's selects), with its own risk; I would take it with their R6 check.
10. Records of entries Forward can no longer reach are dropped (`forgetAfter`), and an `npm run check` rule that a view
    starting a timer or a window listener returns a cleanup (what keeps kept pages safe).

**What I would take into one build**

From theirs: `router.layer` / `ctx.layer` (B12/B14 and the edit-form adoption, so `core/router.js` changes after all);
counting the page's own scrolls (done in my prototype); the secret-box filter (done), the 24 h expiry and the size cap;
the same-form rule for refills, with my per-box locator inside a form; the echo's top placement, double-tap guard and
stay by length; the 8 s quiet-stop hold; `#content { overflow-anchor: none }`; the cleanup check rule; `forgetAfter`;
their single "Not saved yet. Undo my typing" cue; their query rule for back links (done in my prototype).
Keep from mine: the "module drew another address" guard on kept pages, the hold that ends when another address is shown
(`routeSeq`; the fault it fixes was real), rows and cards named by title with badges stripped, the `e8` baseline as the
honest "before" for the owner, back links found by `data-back` or "‹" with no helper, and no redraw hold unless a phone
test shows the keyboard problem.
