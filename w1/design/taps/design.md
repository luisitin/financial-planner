# Wave 1, track "taps": taps, menu, search, top bar, addresses, ways back

Design for the six shell causes SH-TAP, SH-SEARCH, SH-MENU, SH-TOPBAR, SH-ADDR, SH-WAYBACK (36 verified findings).
Base: branch claude/creative-build-b531q0 at c385e41. Prototype: the worktree `proto/` next to this file (uncommitted
edits, every new behaviour behind a switch `?w1off=taps,paint,search,menu,bar,addr,back,motion`, `all` for the app as it
is today, so each measurement below compares old and new on the same server). Scripts and results: this folder
(`m*.mjs`, `t*.mjs`, `out/`, `shots/`). All measurements: Chromium, phone 390 x 844 with touch (320 x 568 where said),
sandbox, real touches through the browser's touch input (not element.click()), CDP touch drags for swipes, key-by-key
typing. Households: family, empty, sam, ruth, patLee, freelancer, retiredCouple (qa fixtures).

Two tooling artifacts found on the way, so nobody repeats them: Playwright's `locator.tap()` on the sticky menu button
scrolls the page by 428 px before it taps (a raw `touchscreen.tap` at the same spot moves nothing, old and new shell
alike); and a CDP screenshot taken while a page is being worked out waits for the page, so it cannot show what is on
screen during the freeze (the frame logger in `m2-paint.mjs` is the instrument for that).

---------------------------------------------------------------------------------------------------------------------

## 1. Behaviour, in a person's words (the acceptance test)

**Taps that land where they were aimed**

- **B1. A double tap does one thing.** I tap Save, Add, Skip, Continue, "Use this one" or a link twice, by habit or
  because the phone seemed slow (the taps 0.1 to 0.7 s apart, on the same spot). The first tap does its job; the second
  does nothing: I am not sent to another page, no form opens by itself, no answer on the next question is ticked for
  me, nothing is added or saved twice, and the green confirmation of the first tap is still the last thing that
  happened. *Closes j-fat-fingers/x-1, j-first-retiree/R1, p-debt-property/x-4, p-retirement-a/x-1, p-cashflow-a/x-2,
  p-overview-home/x-3, p-overview-path/x-1, p-taxes/x-2, j-hard-conditions/x-3, p-career-household-system/x-5.*
- **B2. Taps I mean always land.** A stepper's + tapped three times counts three; two neighbouring tiles tapped quickly
  both tick; a fold opens and closes; a box tapped twice keeps the cursor; after Add I can tap "+ Add another" a second
  later; a swipe that starts where I just tapped scrolls; the menu button tapped twice opens and closes the menu; a
  page I open takes my first tap on it. (The guard of B1 never delays a tap and never touches a swipe.)
  *Guards B1 against doing harm; touch rule D-ANSWERS.*
- **B3. A slow page answers at once.** I tap a page in the menu (or a link) that takes a while to work out (Chance the
  money lasts, Plan summary, Goal seek, the scenario pages, the Dashboard on a slow phone). Within about a tenth of a
  second the menu is closed and the top bar shows the new page's name; on a page known to be slow a quiet line says
  "Working it out…" (on the page's own words where it has them, e.g. "Trying your plan…"); the answer follows. If I
  tap again while it works, that tap is dropped, not carried out later on whatever the finished page puts under my
  finger. *Closes j-heavy-waiting/W2, j-navigator/x-3 (a); touch rule D-TIME (b).*

**The menu's Find a page**

- **B4. Typing works.** I type "social" one letter at a time: the box says "social", the cursor stays at the end,
  Backspace removes the last letter, the phone's keyboard, autocorrect and suggestions stay up between letters, and the
  list under the box narrows as I type. *Closes j-hard-conditions/HC-1, j-heavy-waiting/x-1, j-keyboard-reader/K1,
  j-navigator/x-1, j-one-answer/x-1, p-overview-path/OP-1, p-retirement-c-scenarios/x-search-backwards.*
- **B5. The keyboard's Go opens the first page listed** and closes the menu; the key says "Go". With nothing found it
  does nothing (the "No page matches" line is already there). *Closes j-navigator/N4.*
- **B6. The plain word finds the page named for it first.** "car" lists Vehicles before the career pages and never
  Medicare; "will" puts the wills page first; "card" puts Credit cards before pages that only mention cards; "who to
  call", "phone", "papers", "reminder", "reset" find Contacts, the papers page, the money calendar and Settings.
  Topics stay grouped and ordered by their best hit, as the owner chose. *Closes j-navigator/N5,
  p-career-household-system/x-3.*
- **B7. All pages keeps my search.** I search All pages for "mortgage", open a result, press Back: the box still says
  "mortgage" and the same short list is there; pages named for the word come before pages that only mention it.
  *Closes p-overview-home/x-2.*

**The menu drawer**

- **B8. Back closes the menu.** With the menu open, the phone's Back (Android's Back, the iPhone's edge swipe in
  Safari) closes the menu and leaves me on the same page, also on the first page of a visit. Closing it with the cross
  or by tapping the dim side, then pressing Back, goes to the page before (no dead Back). After I pick a page in the
  menu, Back from that page returns to the page I opened the menu on. Escape closes it too and puts the focus back on
  the menu button. *Closes j-navigator/N3, j-keyboard-reader/K3 (Escape).*
- **B9. The page behind the open menu stays put.** Swiping on the dim side, or swiping the menu's list past its end,
  does not scroll the page; when I close the menu I see exactly the screen I left. *Closes j-navigator/x-4.*
- **B10. Keys and screen readers meet only what is on screen.** With the menu closed (phone width), Tab never walks
  through the hidden menu: the next Tab after a page change is the page's first control; a "Skip to the page" link is
  the first stop at the top. With the menu open, Tab stays in the menu and the top bar, never on the page behind. The
  menu button says whether the menu is open; the current page's row is marked as the current page; each topic says
  whether it is open. *Closes j-keyboard-reader/K2, j-keyboard-reader/K3 (Tab, aria).*
- **B11. A page change puts me at the top of the new page.** After any page change the focus is at the top of the new
  page (keyboard: the next Tab is its first control; a screen reader reads the page's name), unless the page put it on
  its own heading (Get started, Your plan, the questions). A save's green confirmation (or red error) that the shell
  redraw produces is read out once. *Closes j-keyboard-reader/K6, j-keyboard-reader/K5 (the confirmation).*
- **B12. Reduce motion is honoured.** With the phone's "reduce motion" on, the menu appears and closes at once, the
  topic chevrons turn at once, and a page that brings a form or a row into view jumps there instead of gliding.
  *Closes j-hard-conditions/HC-5 (with the two kit chevrons handed to the forms track, section 3).*

**The top bar**

- **B13. The page's name is whole.** Every page name shows in full in the top bar at 390 px and at 320 px, with any of
  the pill's wordings ("Sandbox", "Saved on this phone", "Saved on your computer", "Phone only") and with the Back
  button showing: a long name takes two lines (three, in a smaller size, on a 320 px phone); the pill keeps its words
  on two short lines. *Closes j-hard-conditions/x-2, p-taxes/T8.*

**Addresses**

- **B14. An address that names no page says so.** A mistyped address (#/cashflow/incom, #/debt/nonexistent, #/cashflow)
  shows "That page is not here", the pages of that topic when the topic is known, a filled "Find a page" and an
  outlined "Go to the Dashboard"; the top bar says "Page not found". The same address in the wrong case
  (#/cashflow/Income) simply opens the page. A link to a page switched off on this device shows "<Page> is switched
  off" with "Turn it back on" (one tap, then the page opens right there) and "Go to the Dashboard". Nothing silently
  shows the Dashboard under another page's address. *Closes j-navigator/N2.*

**Ways back**

- **B15. There is always a way back on screen.** Whenever the phone's Back would stay inside the app (any page after
  the first of this visit, also after a reload), a "‹" button sits in the top bar next to the menu button; it does what
  the phone's Back does, its spoken name says where ("Back to Needs attention"), and a double tap on it goes back one
  page, not two. It is hidden on the first page of a visit (as a home-screen app opens) and while the menu is open.
  *Closes j-navigator/x-5.*
- **B16. A page opened from a list I work through names the way back.** Opened from Needs attention, Next best action,
  or from an answer (a row of Your plan, Will the money last?, How am I doing, Plan health score, Financial
  independence, Chance the money lasts), the page shows "‹ Back to Needs attention" (or the answer's name) at the top,
  in the same row style as today's "‹ Your plan" and "‹ Back to the check-in"; it returns to that page as the phone's
  Back does. A page picked in the menu does not get this row (only the "‹" button). The bottom of every page still ends
  with exactly one way on. *Closes j-monthly-return/MR-4, j-one-answer/A3 (the way back; see section 3 and 8 for the
  parts left to wave 2 or declined).*

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

Nine mechanisms; M1 and M5 carry most of the weight. File and function names are those of the prototype.

### M1. The tap guard (B1, B2; B3's dropped taps)
- **Where.** New `core/taps.js`: `verdict()` (pure, `tests/taps.test.mjs`) and `install()` (the document listeners).
  Wired in `core/app.js`: `installTaps({ rev, inPage })` at module start (before any page listener), `planRev++` in the
  `store.subscribe` callback, and `show()` wrapped so `taps.drawn()` runs when every draw ends.
- **What it does.** Capture-phase listeners on `document` for `pointerdown`, `pointercancel`, `touchend` (passive:
  false) and `click`. At `pointerdown` the verdict is taken against the last tap that was carried out; a swallowed
  gesture gets `preventDefault()` on `touchend` (no click, no focus, no picker, no keyboard) and, if a click still
  comes, `preventDefault + stopImmediatePropagation` on it. A tap is swallowed only when one of these holds:
  - *stale*: the finger went down before the shell finished drawing the screen it is delivered to (a tap made during a
    frozen draw). Taps on the top bar are exempt, so the menu button and Back always answer.
  - *new-page*: within 40 px of the last tap, less than 700 ms after the screen changed (the later of the last tap and
    the last draw), and the page (the address without its query) is not the one the last tap was made on.
  - *changed*: the same, on the same page, and the control under the finger was not at that place when the last tap was
    made (a control is "the same" by node, or by tag and words within 6 px of the same box).
  - *repeat*: the very control of the last tap, or its copy redrawn in the same place, after that tap changed the plan
    (a second Add or Save, the next row's identical button sliding under the thumb).
  Anything else lands: a tap farther than 40 px, a tap after 700 ms, a second tap on the same control when the plan did
  not change (stepper, fold, box), a click without a finger behind it (Enter or Space on a button, a label passing its
  click to its box: these never update or clear the remembered tap), programmatic `el.click()` (untrusted). Swipes are
  never looked at (`pointercancel` forgets the gesture). Escape hatch: a control with `data-taps="repeat"` is never
  swallowed as *repeat* (no page needs it today: the one stepper, on Get started, saves to a draft, not the plan).
- **What it keeps.** The last tap carried out: time, place, address, plan revision, the control under the finger and
  the controls in a 40 px ring around it (17 hit tests, taken in the capture phase of its click, before the page's own
  handler changes anything). The time the last draw ended. Nothing else; nothing is stored.
- **Fit.** `show()` (new address and keepScroll redraw alike) ends with `drawn()`; the `store.subscribe` redraw (50 ms
  after `store.update`) is a draw like any other; `renderSeq`-abandoned draws still call `drawn()` (harmless).
  `mendBlockedForms` (framed copies) installs its click listener later, so a swallowed click never reaches it. The guide
  frame, the sync bar and the echo note need nothing: the guard looks only at what is under the finger. The heal reload
  and the sandbox are unaffected.
- **Weighed and lost.** (a) A blanket `pointer-events: none` on `#content` for 350 to 500 ms after every redraw (six of
  the findings propose it): it also eats the meant taps of B2 (the stepper, the neighbour tile, the box tapped right
  after typing in the one before, the fold) and does nothing for a tap that comes before the redraw (the no-gap double
  submit of touch rule D-TWICE). (b) A per-page fix (setup's card, the Dashboard's card height): one cause, 30 places.
  (c) Debouncing `ui.form` submits: the forms track may add it for Enter, but it cannot stop a tap landing on a link.
- **Measured** (`t1-dbl.mjs`: 16 real cases in 6 households, each a single tap against a double tap at 150, 300, 500
  and 700 ms on one spot; the end state compared by address, title, scroll, open forms, focus, open folds, a digest of
  the plan, and the menu):
  - old shell: the second tap did something in **64 of 64** double taps (another page in 9 of the 16 cases, an answer
    ticked, a form opened, a box focused, a second button pressed);
  - new shell, first full run: **0 of 64** (it reported 4, all in the rental case, whose set-up never filled the rent
    box so no tap saved; with the set-up fixed the case is 4 of 4 old, 0 of 4 new). Final run on the finished
    prototype (`out/dbl-final.txt`, five browsers at once): **2 of 64**, both at the guard's edge: "Not now" on the
    Dashboard at 700 ms and "Next: Your retirement" at 500 ms; with five browsers sharing the processor the second
    tap reached the page more than 700 ms after the screen had changed, which the rule counts as meant. The same two
    cases one browser at a time (`probe-ok.mjs`, 3 runs each at 500 and 700 ms): **12 of 12** swallowed, the 700 ms
    taps arriving 628 to 649 ms after the redraw (a margin of 50 to 70 ms). CPU 4x slower (`out/dbl-final4.txt`, 7
    cases): **0 of 28**. No gap at all (40 ms, touch rule D-TWICE; Add income, Add account, Use these as my budget,
    Skip this question; 2 runs each): **8 of 8** swallowed (6 as "stale", 2 as "new-page"), one row added each time.
  - Meant taps (`t2-allowed.mjs`, 11 checks: stepper x3 at 200 ms, neighbour tiles 26 px and 300 ms apart, a fold, a
    meant tap 1 s after Continue, a box tapped twice, "+ Add another" 1 s after Add, a swipe from the same spot 250 ms
    after a tap, the next box after typing, the menu button twice, a page's first control 1.1 s after it opened): **0
    of 11** not taken.

### M2. Paint first, then work it out (B3)
- **Where.** `core/app.js` `show()` (named `draw()` inside the guard wrapper) and `makeCtx().computeRemote`.
- **What it does.** For a new address (never for the keepScroll redraw after a save): the title, the closed menu, the
  guide frame's top and an empty page div are put on screen, with one line "Working it out…" (`role=status`) in the
  page div; the shell then waits for one painted frame (`requestAnimationFrame` then `setTimeout 0`), checks
  `renderSeq`, removes the line and renders the page. The line is visible at once for a page whose manifest says
  `heavy` or that took more than 120 ms to draw on this device before (a small `planner.slowPages` record in
  localStorage, written only when a page crosses the line, try/catch, never needed for anything to work); for any other
  page it is transparent and fades in after 180 ms through an opacity animation (`element.animate`), which the browser
  runs even while the page is being worked out, so a quick page never flashes it. Second change: `ctx.derived` becomes
  a getter that runs the page's `compute` on first read (8 of 161 views read it; the rest stopped paying for a hidden
  full calculation: Chance the money lasts lost about three quarters of its freeze). Third: `computeRemote`'s local
  branch waits for one paint before it computes, so a page's own waiting words ("Trying your plan 2,000 times…") are on
  screen first. The taps made during the work are dropped by M1's *stale* verdict.
- **What it keeps.** Per device, the pages that drew slowly (key -> ms, only those over 120 ms).
- **Fit.** The place track's Back to a kept page (`place.unpark`) returns before this step, so Back stays instant; their
  scroll-room `minHeight` is set before it, so the blank frame stands at the restored place. The guide frame is built
  before the frame is painted (its bar is part of the first paint). The heal path, `renderSeq`, cleanup and the frame's
  `after` are unchanged. A store update arriving during the one-frame wait schedules a redraw that supersedes this one
  (`renderSeq`), exactly as a slow render is superseded today.
- **Weighed and lost.** (a) Yield only for heavy or known-slow pages: no blank frame on quick pages, but the first visit
  to the Dashboard on a slow phone (1.7 to 4.4 s at 4x here) would freeze with the menu open, the very case of x-3.
  (b) Keep the old page on screen, dimmed, during the work: a new title over the old page reads as "wrong page" for
  seconds on a slow page. (c) Work out heavy pages in slices or a worker: right in the end, a wave 2 or later speed task
  per page (careful.js already slices); the shell cannot do it for them.
- **Measured** (`m2-paint.mjs`: a real menu tap (search typed key by key) onto 10 slow pages in 3 households; a frame
  logger records every painted frame; then a second tap on the same spot 600 ms later):

  | | new name on screen after the tap | "working" words painted | 2nd tap ends on another page |
  |---|---|---|---|
  | old, normal speed | 184 to 3,372 ms (Chance the money lasts 1.6 to 3.4 s, Plan summary 1.6 s, Dashboard 0.7 s) | never | 6 of 10 (Dashboard) |
  | new, normal speed | 36 to 172 ms | 9 of 10 (all but the Dashboard's first visit) | 0 of 10 |
  | old, CPU 4x slower | 732 to 5,955 ms | never | 7 of 10 (Dashboard 6, Our guesses 1) |
  | new, CPU 4x slower | 47 to 639 ms (8 of 10 under 240 ms) | 9 of 10 | 0 of 10 |

  The page's own work after the first paint is unchanged (Plan summary still computes for 2.9 s at normal speed here):
  the shell makes it visible and safe, not faster. Census (`m8-census.mjs`, every page offered to family, ruth and
  empty: 150 pages each): 0 page errors and 0 error notices (old shell: 0 as well, family); 4 pages over 120 ms on this
  machine in the new shell (Dashboard 330, Pay off debts 174, Your plan 160, Monthly review 138: the wave-2 speed list).
  Not measurable here: whether the 180 ms fade appears during a freeze (a screenshot waits for the page); owner check.

### M3. One search box, kept (B4, B5)
- **Where.** `core/app.js`: `searchBox(side)` makes the `input.nav-search` once (with `enterkeyhint="go"`,
  `autocomplete="off"`, `autocapitalize="none"`; autocorrect left on), and `buildNav(filter)` rebuilds only a
  `div.nav-list` after it (`list.replaceChildren(...)`), setting `search.value` only when it differs. Its `keydown`:
  Enter (not while composing) opens the first `a.nav-link` of the list through `openFromMenu` (M5); Escape with text
  clears it (and stops there; the next Escape closes the menu).
- **What it keeps.** The input element for the life of the document.
- **Fit.** `show()` no longer calls `buildNav()` on a phone: it marks the list stale and the list is rebuilt when the
  menu next opens (on a wide screen, where the menu is always there, it is rebuilt at once). So the list never re-orders
  under a finger while the drawer closes (x-3 (b)), and the focused row survives a page change on a wide screen. The
  `planner:features`, `planner:view`, `planner:live` rebuilds keep the typed word. `ctx.openSearch()` opens the drawer
  and focuses the kept box.
- **Weighed and lost.** Putting the caret back after each rebuild (`setSelectionRange`): letters in order in Chromium,
  but the box is still thrown away at every key, which on an iPhone can drop autocorrect, the suggestion bar and
  dictation and make the keyboard flicker.
- **Measured** (`m3-search.mjs`, key by key at 120 ms a key, and once as inserted text the way a phone keyboard commits
  it): old: "social" -> "laicos", "chance" -> "ecnahc", "net worth" -> "htrow ten", "taxes" -> "sexat", caret 0, a new
  box at every key, Backspace removes nothing, so the heavy-page test above could not even find its pages by typing.
  New: 4 of 4 words in order, caret at the end, the same box, focus kept, two Backspaces leave "soci". Enter after "net
  worth": Net worth opens, menu closed, focus at the top of the page; Back returns to Income (where the menu was opened)
  with the menu closed. Old: Enter does nothing.

### M4. Ranking by whole words (B6, B7)
- **Where.** `core/search.js`: `matchScore()` (new, pure) gives the order inside the existing levels; `matchRank()` keeps
  its contract (-1, 0, 1, 2, 3; the existing tests pass unchanged) as `floor(matchScore)`. Inside a level: the name or
  a phrase that *is* the query 0, a name that holds it as a whole word 0.2, a phrase that does 0.25, the start of a
  longer word 0.5; topic name 1 / 1.5; purpose 2 / 2.5; every word somewhere (stems) 3; a hit inside a word ("car" in
  Medicare) is no hit. Whole words are compared on their stems too ("card" is in "Credit cards"). `hasWords()` (new) is
  the topic tie-break in `buildNav`. `PLAIN` gains four entries (household/contacts, household/documents,
  system/settings, household/calendar). `modules/overview/pages/view.js` sorts by `matchScore` (topics by best hit,
  pages by score, the menu's rule) and keeps the word in the address: `history.replaceState(history.state, "",
  "#/overview/pages?q=<word>")` on input (the state object kept, so the entry numbers of M6 survive), and starts from
  `route.query.q`.
- **Weighed and lost.** A flat "Best match" list on All pages: two different orders for one search in the menu and on
  All pages; the menu's topic grouping is the owner's (2026-09-15).
- **Measured.** `tests/search-words.test.mjs` (6 tests) plus the old `tests/search.test.mjs` (12) pass. In the menu
  (`m3-search.mjs`, 20 words): "car" Salary and raises / Work benefits / Equity compensation first -> **Vehicles**
  first; "will" Will the money last? -> **Estate documents**; "401k" Asset location -> **Retirement contributions**;
  "college" Goals -> **Education (529)**; "reminder" Needs attention -> **Money calendar**; "card": Credit cards ranks
  before Pay off debts after the name-over-phrase rule. All pages "mortgage": old Life timeline first and, after Back,
  an empty box with 150 pages; new Debts, Mortgage, What lenders see, Life timeline, and after Back the box says
  "mortgage" with the same 4 pages.

### M5. The drawer (B8, B9, B10, B12)
- **Where.** `core/app.js` (`paintDrawer`, `openDrawer`, `closeDrawer`, `toggleDrawer`, `openFromMenu`,
  `onDrawerHistory`, one `keydown` and one `popstate` listener, a delegated `click` on `#sidebar`), `index.html`
  (`aria-controls`/`aria-expanded` on the menu button, a "Skip to the page" link), `core/ui/base.css` under
  `max-width: 959px` (`#sidebar` hidden with `visibility` after its slide, `overscroll-behavior: contain`; `#scrim
  touch-action: none`; `html.drawer-open` overflow hidden; `html.drawer-open #topbar touch-action: none`) and a reduced
  motion rule for `#sidebar` and `.nav-group-head .chev`.
- **What it does.** Open (phone width): build the list if stale, show it, `aria-expanded=true`, `inert` on `#content` and
  `#sync-bar`, the class that stops the page scrolling, one history entry at the same address (`history.state.drawer`),
  the focus on the menu itself (a momentary `tabindex=-1`, so the next Tab is Find a page, a screen reader is in the
  menu, and no keyboard pops up). Close (cross, dim side, Escape): the reverse, then `history.back()` off the menu's
  entry (a same-address step: `popstate`, no `hashchange`, so no redraw); the focus goes back to the menu button for the
  cross and Escape. The phone's Back while open: `popstate` without the drawer state closes it. A row, the pill, or
  Enter in Find a page: `location.replace(href)` takes the menu's entry, so Back from the new page returns to the page
  the menu was opened on; a row for the page already shown just closes. A Back the shell started is remembered
  (`stepping`), so a quick re-open waits for it; an entry for a menu that is no longer open (a reload with it open, a
  Forward onto it) is stepped off at once.
- **Fit.** `show()` closes the drawer for every new address (that close finds no entry to step off when the row replaced
  it). The closed drawer at phone width is `visibility: hidden` after its 180 ms slide, so it has no Tab stops and is
  gone for screen readers; at 960 px and over nothing changes. `markActive` adds `aria-current="page"`; topic heads get
  `aria-expanded`. The place track's prototype has the same idea as a general `router.layer(close)`: the build uses one
  implementation (section 6, step 4).
- **Weighed and lost.** (a) No history entry, close on `popstate`: by then the browser has already left the page.
  (b) `history.forward()` back onto the page when Back arrives with the menu open: a full redraw and a flash, and no
  Forward exists after the first page of a visit. (c) Locking the page with `position: fixed` on the body and a stored
  offset: the iPhone-proof classic, but it moves the page under a sticky bar and fights the place track's scroll
  restore; `touch-action` on the dim side and the bar plus `overscroll-behavior` on the list cover every place a finger
  can start a swipe while the menu is open (to check on the phone).
- **Measured** (`m4-menu.mjs`, 14 checks, raw touches; `m4b-swipes.mjs`): old shell **3 of 14** as they should be, new
  **14 of 14**:
  - Back on the first page with the menu open: old leaves the app; new stays on Income, menu closed. Back with the menu
    open on a second page: new stays, the next Back goes to the Dashboard. Row then Back: new returns to Net worth,
    then Dashboard. Cross or dim side, then Back: no dead step (both). Five taps on the menu button 160 ms apart: menu
    open, Back closes it, Back again goes to the Dashboard.
  - Escape: old menu stays open; new closed, focus on the menu button.
  - Tab, menu closed (390 px, keyboard): old 32 Tabs to the page's first control, 28 of them on things off screen; new
    the next Tab after a page change is the page's first control, 0 off screen. Menu open, 45 Tabs: old 5 on the page
    behind; new 0. `aria-expanded` follows; the current row carries `aria-current`.
  - Swipes behind the open menu, from mid-page (3 pages, 3 households): old the page moved 285 to 313 px; new 0 px.
  - Reduce motion: the drawer is never part-way open (0 frames); a goal row on Goals: old 33 scroll positions in a
    glide, new 2 (a jump).

### M6. Entry numbers and the Back button (B15, B16)
- **Where.** Prototype: `stampEntry()` and `updateBack()` in `core/app.js`; build: `core/router.js` (one numbering for
  this track and the place track). `index.html` gets `<button id="nav-back" hidden>‹</button>` after the menu button;
  `base.css` styles it like the menu button (44 x 44, outlined). `ctx.cameFrom()` and `ctx.goBack()` for the frame.
- **What it keeps.** In `history.state` of each entry: `n` (its number), `from` (the page shown when it was opened),
  `via` ("menu" when picked in the menu or the top bar). In sessionStorage `planner.firstEntry`: the lowest number seen
  in this tab (the first entry of the visit). A new address without a number gets the previous entry's number + 1; Back
  and Forward read theirs. `history.state` survives a reload; sessionStorage lives as long as the tab (or the home-screen
  app's process), exactly as the history does.
- **What it does.** The "‹" shows when `n > first` and the menu is closed; tapping it is `history.back()`; its
  `aria-label` and `title` say "Back to <page>" from `from`. A double tap on it goes back once (M1: the second tap on the
  same spot after the address changed is *new-page*). The guide frame's existing one-page trails get a third source:
  when the page was opened from inside a page in `CAME_FROM` (Needs attention, Next best action, How am I doing, Plan
  health score, Financial independence, Chance the money lasts) or from a row page of Your plan (`RESULT_ROWS`), and
  not via the menu, and the page is not one that leads the way itself (Dashboard, Get started, the guides, Quick
  answers, the questions, Your plan), the frame draws "‹ Back to <that page's name>" in its `gb-compact` row; the link
  is `history.back()` (same place on that page, nothing added to the history), and a plain link when the history is not
  there. The bottom row (one way on) is untouched.
- **Fit.** With the place track's router: the same numbers (`router.entry()`), their `router.back(href)` for the frame's
  links, their records for "the page of entry n-1". The All pages `replaceState` keeps the state object; setup's
  `replaceState(history.state, …)` already does; boot's `replaceState(null, …, "#/overview/start")` runs before the first
  entry is numbered.
- **Weighed and lost.** (a) A named "‹ Back to <page>" row at the top of every page instead of a bar button: names the
  way, but scrolls away (the person wants Back after saving at the bottom), costs 60 px at the top of every page, and is
  a second bar of navigation on 150 pages. (b) Only the bar button, no named rows: a sighted person does not see where
  "‹" goes from a list (MR-4 asks for the name). (c) The button only in home-screen mode
  (`display-mode: standalone`): the owner also opens the app in Safari, where the toolbar Back is far from the thumb;
  one rule everywhere is easier. (d) A Back bar fixed at the bottom: the owner's rule of 2026-11-06 forbids it.
- **Measured** (`m6-ways.mjs`, 11 checks; old 1 of 10, new 10 of 11, the one "BAD" a check that read only 70
  characters, the picture `shots/addr-new-typo.png` shows the topic's pages): first page no "‹"; after the Net worth
  tile "Back to Dashboard", tapped -> Dashboard, hidden again; double tap on "‹" (300 ms) goes back one page; after a
  reload the "‹" is still there with its name; hidden while the menu is open; a Needs attention row -> "Back to Needs
  attention", tapped -> Needs attention; Will the money last?'s "People" (empty plan) -> "Back to Will the money
  last?", tapped -> back on the answer; the Dashboard picked in the menu: "‹" ("Back to Update my balances") and no
  named row. Pictures: `shots/back-alert-dest.png`, `shots/back-people-top.png`.

### M7. The top bar fits (B13)
- **Where.** `core/ui/base.css` only, scoped by a class on `#topbar` (not on the pill: `showPill()` rewrites the pill's
  `className`, which is why a first attempt did nothing): the page name may take two lines (`-webkit-line-clamp: 2`,
  `line-height 1.18`, `text-wrap: balance`); under 480 px the pill wraps its words on two lines at 12 px (the pills'
  floor, design log 2026-09-15 round 10) in at most 104 px, 44 px tall as before; under 375 px gaps of 6 px, the name in
  13 px with up to three lines, the pill at most 92 px. The bar stays 56 px.
- **Weighed and lost.** The pill as a dot only, words behind a tap (loses the words the owner chose); the status as a
  second line under the name (loses the pill's 44 px target); shortening page names (designer's lane, and 58 names).
- **Measured** (`m5-bar.mjs`: all 149 names a household is offered, set in the real bar, x 4 pill wordings x 2 widths x
  Back button on/off). Old: at 390 px, 1 cut with "Sandbox", **56** with "Saved on this phone", **86** with "Saved on
  your computer", 5 with "Phone only"; at 320 px 53 / 130 / 146 / 70; with a Back button added to the old bar 35 to
  138 at 390 and up to 149 at 320. New: **0 cut in all 16 combinations**. Pictures: `shots/bar-390-a.png`,
  `shots/bar-320-b.png` (and `-dark`).

### M8. Addresses that name no page (B14)
- **Where.** `core/app.js` `show()`: before choosing the module, an address whose lower-cased group/id is a page is
  corrected with `history.replaceState(history.state, …)`; then `missing(route)` -> `{kind: "off", m}` (switched off on
  this device) or `{kind: "unknown", group}`; the shell draws `missingCard()` instead of a page and the top bar says the
  page's name (switched off) or "Page not found". Build: `missing()` becomes a pure helper with a node test.
- **Weighed and lost.** The Dashboard with a notice on top and the address corrected (the finding's suggestion): the
  person still lands somewhere they did not ask for, and from the Dashboard's own row to a switched-off page it looks
  like nothing happened; the card explains and offers the one tap that fixes it.
- **Measured** (`m6-ways.mjs` A1 to A4): old 0 of 4 (all four show the Dashboard under the wrong address); new: typo ->
  card with the topic's 8 pages; wrong case -> Income at #/cashflow/income; the Dashboard's row to a switched-off
  Emergency fund -> "Emergency fund is switched off", "Turn it back on" -> the page. Pictures `shots/addr-new-*.png`.

### M9. Focus, read-outs, reduce motion (B11, B12)
- **Where.** `core/app.js`: `landFocus(root)` at the end of a new-address draw (focus `#content` with a momentary
  `tabindex=-1` and `preventScroll`, unless the focus is already inside it), `#content`'s `aria-label` set to the page's
  name; `announce()` of the fresh notices after a keepScroll redraw (the green or red line the save produced);
  `honourReducedMotion()` wraps `scrollIntoView`, `scrollTo` and `scrollBy` (window and elements) so a `behavior:
  "smooth"` request becomes `"auto"` while the phone asks for reduced motion (checked at each call).
- **Weighed and lost.** (a) A permanent `tabindex=-1` on `#content`: tried first; every tap on plain text then focused
  the page (measured: the rental case's second tap "focused main"), which can blur a box and confuses the place track's
  focus record; the momentary tabindex removes itself on blur. (b) `#page-title` as an `h1`: two h1s on the pages that
  have a hero heading; the named `main` landmark and the bar are enough (touch rule T-HEAD allows an h2 first).
  (c) A `ui.reveal()` helper adopted by the pages that scroll smoothly: 46 calls in modules and core today, one of them
  in claude-a's lane; the wrapper reaches all of them, including future ones.
- **Measured.** Census: focus after a page change on the body for 148 of 150 pages (old) -> at the top of the page for
  148 of 150, the other 2 on their own heading (new; three households). `m4-menu.mjs` D12: after a menu row by
  keyboard, the next Tab is the page's first control (old: Find a page, the top of the menu). D13: "Side gig added." is
  read out (old: nothing).

**Final runs on the finished prototype**: see the "Final numbers" note at the end of this file.

---------------------------------------------------------------------------------------------------------------------

## 3. What the shell cannot do: the adoption list for wave 2

Short on purpose; everything else above needs no page change.

| page (owner) | change | finding |
|---|---|---|
| modules/overview/guide/view.js (claude-b) | "Do something else" on a guide opened from Quick answers goes back to Quick answers (`ctx.goBack()` when `ctx.cameFrom()` is overview/quick), not to Get started | j-one-answer/A3 |
| modules/balance/net-worth/view.js (claude-b) | only if step 4's frame change (the check-in trail carried one page further) is not taken: keep `from=review` and `month` on the "Update all balances at once" link | j-monthly-return/MR-4 (check-in part) |
| the 4 pages measured over 120 ms on this machine: overview/dashboard, debt/payoff, overview/plan, overview/monthly-review (claude-b), and the heavy pages' own calculations (retirement/monte-carlo, reports/plan-summary, scenarios/*) | speed: work out in slices (as retirement/careful.js does) or cache; the shell now shows a name and "Working it out…" at once, but the page still blocks for its own work | j-heavy-waiting/W2, j-navigator/x-3 (the freeze itself), touch rule D-TIME (a) |
| core/ui/dom.js and the kit part of base.css (forms track, not a page) | `ui.notice("error")` gets `role="alert"`; the reduced-motion rule also covers `.fold .fold-chev` and `.scroll-hint::after`; Enter pressed twice on a form is the form's guard (M1 sees only taps) | j-keyboard-reader/K5 (errors shown without a redraw), j-hard-conditions/HC-5 (kit chevrons) |
| designer (manifests' titles) | optional: the menu names that differ from the page's own heading ("Contacts" / "Who to call", "Document vault index" / "Where your papers are") | p-career-household-system/x-3 (naming part; the search part is closed by M4) |

New pages from now on: nothing to adopt. A control that is meant to be tapped repeatedly *and* saves to the plan on
each tap must carry `data-taps="repeat"` (docs/CONVENTIONS.md gets one line).

---------------------------------------------------------------------------------------------------------------------

## 4. Risks: what could be worse than today, and the check that catches it

| risk | check |
|---|---|
| The guard swallows a tap the person meant (a fast reader taps the new thing within 0.7 s on the same spot) | `t2-allowed.mjs` (0 of 11 not taken) on every change to `core/taps.js`; touch rule D-ANSWERS in `qa/touch-sweep.mjs` (each control's single tap from a fresh plan answers within 1 s: the guard never touches a first tap); the swallowed taps are logged in the sandbox (`window.__swallowed`, prototype only) so a tester can see one. Worst case the person taps again. |
| The guard breaks a control type nobody tried: native select pickers, file inputs, range sliders, long-press, text selection, a label around a checkbox | `t2-allowed.mjs` grows a case per type (select, file, range drag, label checkbox, long-press) before landing; the guard only cancels `touchend`/`click` of a swallowed gesture and never `pointermove`, so drags and selection cannot be affected |
| An All pages search, a guide step or a setup screen changes the address under the same spot and a meant tap there is swallowed as *new-page* | compare the page part of the address only (without its query) for *new-page*; the *changed* verdict still covers a screen that changed; `tests/taps.test.mjs` gains the case |
| Paint first: a blank frame between two quick pages reads as a flicker | `look` by eye on 6 quick pages (Income, Net worth, Settings, Debts, Goals, Expenses) in `tools/shot.mjs`-style video or by the owner (section 5); fallback switch: yield only for heavy or known-slow pages (one line) |
| Paint first: a page that relies on being drawn in the same task as the hash change (or on `ctx.derived` being an own data property) | `m8-census.mjs` on 3 households (150 pages each): 0 page errors, 0 error notices; `npm test`; `qa/smoke-all.mjs`; the 8 views that read `ctx.derived` opened and saved once each |
| The drawer's history entry leaves a dead Back, or Back leaves the app with the menu open | `m4-menu.mjs` D1 to D6 (first page, second page, row then Back, cross then Back, dim side then Back, 5 quick taps); add Forward onto the menu entry and a reload with the menu open |
| The page behind the menu still scrolls on an iPhone (Safari's rules for `overflow: hidden` on the root and `overscroll-behavior` differ) | owner check 3 (section 5); fallback: the body-fixed lock, behind the same class |
| The Back button shows when Back would leave the app (a link opened in a new tab copies sessionStorage), or hides when it should show | `m6-ways.mjs` K1, K3; add: a new tab from a link, the home-screen launch (owner check 6) |
| The Back button and a frame row both on screen confuse (two ways back) | the named row only after an in-page link from a hub or answer, never via the menu, never on a leading page (K7); designer's review of `shots/back-alert-dest.png`; touch rule T-ONE-WAY still counts exactly one way on at the bottom (rows starting with ‹ are not ways on) |
| A page name of three lines at 320 px, or the iPhone's font wider than Chromium's, cuts names again | `m5-bar.mjs` (0 cut of 149 x 16); owner check 4 with the longest names |
| The address card replaces a fallback some flow relied on (an old bookmark, a link to a renamed page) | touch rule T-LINK (every in-app link names a page that exists); `m6-ways.mjs` A1 to A4; boot's empty address still opens Get started or the Dashboard |
| Focus moved to the page after every page change scrolls the page or pops the keyboard | `preventScroll`, `main` is not editable; `m8-census.mjs` reads scroll 0 and focus; owner check 7 with VoiceOver |
| The reduced-motion wrapper changes a page that waits for its smooth scroll to finish | only `behavior: "smooth"` is rewritten and only when the phone asks for reduced motion; `m4-menu.mjs` D11; grep for `scrollend` (none today) |
| Two tracks change `show()`, `router.js` and `frame.js` at once (place track) | build order in section 6: the seams are named (where the yield sits relative to `unpark`, one entry numbering, one layer API, landFocus after `arrive`); `t1-dbl.mjs`, `m4-menu.mjs`, `m6-ways.mjs` re-run after the place track lands |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari

Where Safari differs for these mechanisms:
- **Double tap to zoom.** Safari may treat two quick taps (under about 350 ms) as "double tap to zoom" on a page that
  can be zoomed, instead of sending a second click. Then the 150 to 300 ms double taps of B1 do not reach the page at
  all (the page zooms instead, which is its own surprise), and the 400 to 700 ms impatient second tap is a click as in
  Chromium, handled by M1. If the owner's check 1 shows zooming, add `touch-action: manipulation` on `#app` (pinch zoom
  stays; only double-tap zoom goes).
- **Event times.** Older WebKit stamped events with the date instead of the page clock; `core/taps.js` `clock()` reads
  both.
- **`touchend` must be cancellable.** Safari makes document-level `touchstart`/`touchmove` listeners passive by default,
  not `touchend`; the guard registers `touchend` with `passive: false` explicitly.
- **Paint first.** `requestAnimationFrame` then `setTimeout 0` paints in Safari as in Chromium. Whether Safari runs the
  180 ms opacity fade while the page is being worked out (Core Animation usually does) cannot be seen here.
- **The search box.** Safari would probably have put the caret at the end of a re-made box (so the old bug may have
  shown as dropped letters, a flickering keyboard or lost autocorrect rather than reversed text); the kept box removes
  the cause either way. `enterkeyhint="go"` shows "go" on the iPhone keyboard (Safari 13.1 and later).
- **Back and the menu.** In Safari the edge swipe is Back and fires `popstate` for the menu's entry; in a home-screen
  app there is no Back button, and the edge swipe may not exist: that is why B15's button matters.
- **Scroll lock.** Safari 16 and later honour `overscroll-behavior`; `overflow: hidden` on the root has been honoured
  for touch scrolling only in recent versions; `touch-action: none` on the dim side and the bar is long supported.
- **`inert`** needs Safari 15.5 or later (without it the dim side still covers the page; only Tab and VoiceOver could
  reach the page behind).
- **Fonts.** SF Pro on the iPhone is a little wider than the font measured here: the margin of M7 is two lines for every
  name at 390 px; check the longest.

For the owner to try on the real phone (home-screen app and Safari, about ten minutes):
1. On Income, tap "+ Add another income", fill it, then tap "Add income" twice quickly. One income added, no empty form
   reopened, still on Income. Then once more with a slower, impatient second tap. Did the page ever zoom?
2. Open the menu, type "social" in Find a page one letter at a time: the box says "social", the keyboard stays up and
   suggests words; press Go: Social Security opens.
3. Open the menu on a long page scrolled half way, swipe up and down on the dim side and on the menu; close it: same
   place?
4. Open "Will the money last?", "Bills and regular payments" and "Tax documents checklist": is the whole name in the top
   bar, and does the pill read "Saved on / this phone" on two lines?
5. Open "Chance the money lasts" from the menu: does the name and "Working it out…" show at once? Tap again while it
   works: do you stay on it?
6. From the home-screen icon: Dashboard, tap the Net worth tile: is there a "‹" next to the menu button, and does it
   bring you back? On the Dashboard itself, is there none? Does a swipe from the left edge do anything?
7. With the menu open, swipe from the left edge (Safari) or use Back: the menu closes and you stay on the page.
8. With Settings > Accessibility > Motion > Reduce Motion on: the menu appears without sliding.
9. Open the address #/cashflow/incom: "That page is not here" with the Cash flow pages.

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each small enough to verify alone)

Every step ends with `node --check` on each touched file, `npm test`, `npm run check`, the leak guard, `npm run skew` if
it is pushed, a CHANGELOG line, and `node tools/shot.mjs` of two touched pages. The kit scripts named are in this folder;
copy the ones that become permanent into the touch sweep (step 9).

1. **Tap guard.** Add `core/taps.js` and `tests/taps.test.mjs` from the prototype (verdict, install; compare the page
   part of the address for *new-page*; the `data-taps="repeat"` hatch; drop the `window.__swallowed` log or keep it in
   the sandbox only). In `core/app.js`: install at module start, `planRev` in `store.subscribe`, `show()` wrapped so
   `drawn()` runs in `finally`. Checks: `node --test tests/taps.test.mjs`; `t1-dbl.mjs` (0 of 64; also with CPU 4x on
   A, B, C, G, H, M, O); `t2-allowed.mjs` (0 of 11), plus the new select/file/range/label/long-press cases;
   `m8-census.mjs` (0 errors). Independent of the other tracks; land first.
2. **Search box and ranking.** `core/search.js` (`matchScore`, `hasWords`, whole and start of word on stems, the four
   PLAIN entries), `tests/search-words.test.mjs`; `core/app.js` `searchBox` + `buildNav` rebuilding only `.nav-list`,
   Enter and Escape in the box; `modules/overview/pages/view.js` (the word in the address, ranked order). Checks:
   `node --test tests/search*.test.mjs`; `m3-search.mjs` (4 words typed key by key in order, Enter, the 20-word table,
   All pages across Back); `node qa/user-view.mjs`. Independent; can land with step 1.
3. **Drawer: hidden, contained, quiet.** `base.css` (visibility after the slide, `overscroll-behavior`, `touch-action`,
   `html.drawer-open`, reduced motion for `#sidebar` and `.nav-group-head .chev`); `core/app.js` `paintDrawer` (inert,
   aria-expanded, the class), focus to the menu on open and to the button on Escape or the cross, Escape listener,
   `aria-current`, topic `aria-expanded`, the list rebuilt on open (not in `show()`) on a phone; `index.html` skip link,
   `aria-controls`. Checks: `m4-menu.mjs` D4, D7, D8, D9, D10; `m4b-swipes.mjs` (0 px on 2+ pages).
4. **History: one numbering, the menu's entry, the Back button, named rows.** Coordinate with the place track: if its
   `core/router.js` (entry numbers, `router.layer`, `router.back`) has landed, use it; otherwise land the numbering here
   in `core/router.js` with the same API (`entry()`, `first()`, `layer(close)` returning `release()`), with a node test
   of the pure numbering rule (new entry = previous + 1; Back and Forward keep theirs; the first entry of the visit is
   the lowest seen). Then `openFromMenu` (replace), the drawer as a layer, `#nav-back` in `index.html` and `base.css`,
   `updateBack()` in `show()` and `paintDrawer()`, `ctx.cameFrom()` / `ctx.goBack()`, and in `modules/overview/guide/
   frame.js` the named row (`CAME_FROM`, `RESULT_ROWS`, not via the menu, not on leading pages) plus the check-in trail
   carried one page further (the same `hop()` the quick trail uses). Checks: `m4-menu.mjs` D1, D2, D3, D5, D5b, D6;
   `m6-ways.mjs` K1 to K7; `t1-dbl.mjs` H (menu row double tap); `qa/flows/path-walk.js` (one way on, the path's own
   rows untouched); touch rule D-BACK.
5. **Paint first.** `core/app.js` `show()`: the one-frame wait with "Working it out…" for new addresses (after the place
   track's `unpark` branch if it has landed), lazy `ctx.derived`, `afterPaint` in `computeRemote`'s local branch, the
   `planner.slowPages` record. Checks: `m2-paint.mjs` at CPU 1x and 4x (name on screen under 250 ms at 4x on 9 of 10,
   0 of 10 wrong ends); `m8-census.mjs` on family, ruth, empty (0 errors); the 8 views that read `ctx.derived` opened
   and saved once each; touch rule D-TIME (b).
6. **Focus and read-outs, reduce motion.** `landFocus` (momentary tabindex), `#content` `aria-label`, `announce()` of a
   redraw's fresh notices, `honourReducedMotion()`. Checks: `m4-menu.mjs` D11, D12, D13; census focus counts (148 + 2
   own headings per household).
7. **Top bar.** `base.css` (`#topbar.w1` rules become the plain rules; the class can go). Checks: `m5-bar.mjs` (0 of 149
   cut, 16 combinations); `look-bar.mjs` pictures light and dark at 390 and 320; `tools/shot.mjs` of Retirement
   contributions and Will the money last?.
8. **Addresses.** `missing()` as a pure helper (node test: unknown, unknown with a known topic, switched off, wrong case)
   and `missingCard()` in `core/app.js`. Checks: `m6-ways.mjs` A1 to A4 (read the whole card for A4).
9. **Permanent checks.** Hand `t1-dbl.mjs`, `t2-allowed.mjs`, `m3-search.mjs` (typed part), `m4-menu.mjs` and
   `m5-bar.mjs` to the touch sweep (`qa/touch-sweep.mjs`) as flows; write the design log entry (section 7).

Rules of the touch sweep (`qa/touch-rules.json` in the wtouch worktree) these behaviours should turn green: **D-TWICE**
(two taps in a row = one new row: M1's *repeat*), **D-TIME (b)** (heavy pages say they are working: M2), **D-ANSWERS**
(a menu row onto a heavy page answers within 1 s: M2; no first tap is eaten: M1), **D-BACK** (Back with and after the
menu: M5, M6), **D-TOP** (the new page at the top with its name on screen: M2, M7), **T-HEAD** (the bar shows the menu
name in full: M7), **T-NAME** (the "‹" has a name in words: M6), **T-TARGET** (the "‹" and the pill stay 44 px), and
**T-ONE-WAY** stays green (the named rows start with ‹). Two things the sweep should be told: the skip link sits above
the top edge until it is focused (not a covered control), and a swallowed second tap is the intended result of D-TWICE,
not a "nothing happened" of D-ANSWERS (D-ANSWERS taps once).

---------------------------------------------------------------------------------------------------------------------

## 7. Design log and lanes

Owner decisions this design relies on and keeps (quoted from docs/DESIGN_LOG.md):
- 2026-11-06, one path: "every page ends with exactly one way on (Next on a step of the path, "Next result" after Your
  plan, or one quiet "Continue your plan" row) … No Next bar is fixed to the bottom of the screen … Do not add a second
  menu, a stepper beyond the bar's track, or a new "walk"". The Back button is in the top bar (not a bar at the bottom,
  not a menu, not a way on); the named rows are at the top, in the frame's existing trail style; the bottom keeps its
  one way on. A3's suggested "Back to: Will the money last? ›" button at the bottom is therefore declined.
- 2026-11-06, the household's view: "never shows build progress, "soon" pages, or PC / AI helper / sync wording"; "the
  status pill says "Saved on your computer" (not "Saved on PC") in the household's view". The cards and lines added
  here have none of those words; the pill's words are unchanged.
- 2026-09-15, menu drawer round 2: "rank page-name hits, then topic-name hits, then description hits + a "No page
  matches" line with a link to All pages … (ties break on topic-name match, then number of hits)"; "the menu button
  turns into a cross while open". Kept: M4 refines what counts as a hit inside each level; the cross stays.
- 2026-09-15, pass 2 round 2: ""Recent": the 8 pages opened last on this device, Dashboard always first". Kept; the list
  is redrawn when the menu opens instead of while it closes.
- 2026-09-15, shell pieces round 10: ""Saved on PC" (green) / "Phone only" (orange) / "Sandbox", 44 px" and "12 px text,
  20 px tall everywhere" for pills. Kept: same words, 44 px tall, 12 px on two lines on a phone.
- 2026-09-15, All pages round 3: ""4 pages match "roth"" and a friendlier no-result card". Kept.
- AGENTS.md design rules: one filled button per screen (the address card: "Find a page" filled, the Dashboard outlined;
  the switched-off card: "Turn it back on" filled), plain words, 44 px targets, no new global CSS outside base.css.

Choices made where the owner was not asked (the conservative option each time; each goes into the design log entry
"2026-11-11 wave 1: taps, menu, top bar, ways back" so the owner can reverse it):
1. A "‹" Back button in the top bar, shown only when Back stays in the app; outlined like the menu button; no words in
   it (they would not fit), its name spoken.
2. The pill's words on two short lines under 480 px (12 px), instead of dropping or shortening them.
3. A page name of two lines in the bar (three in 13 px under 375 px) instead of cutting it.
4. "Working it out…" as the waiting words.
5. "That page is not here" and "<Page> is switched off" cards with their buttons.
6. Named "‹ Back to …" rows for pages opened from Needs attention, Next best action and the answers.
7. The guard's limits: 40 px, 0.7 s; a swallowed tap gives no sign (a sign would itself move things under the thumb).
8. Search keeps autocorrect on (it helps "morgage"), and the keyboard key says "Go".

Lanes: every file changed is in this track's list (core/app.js, core/search.js, core/router.js, index.html, base.css
shell selectors, modules/overview/pages, modules/overview/guide/frame.js for the ways back). Two selectors are shell state
rather than the listed ids: `html.drawer-open` (the scroll lock) and `.nav-skip` (named into the `.nav-*` family on
purpose). No claude-a page is edited; their pages get B1 to B16 through the shell. No change to
modules/overview/setup/compute.js, modules/retirement/projection/compute.js or the estimators. `core/ui/dom.js` is left to
the forms track (section 3). The TEAM.md claim of 2026-11-11 for wave 1 covers these files.

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (36 findings)

| finding | theme | outcome |
|---|---|---|
| j-fat-fingers/x-1 | SH-TAP | closed by B1 (M1) |
| j-first-retiree/R1 | SH-TAP | closed by B1 (M1) |
| j-heavy-waiting/W2 | SH-TAP | closed by B3 (M2, M1 stale); the page's own slowness to adoption (section 3) |
| j-navigator/x-3 | SH-TAP | closed by B3 and B1 (M2, M1, M3's list rebuilt on open); the freeze length to adoption |
| p-debt-property/x-4 | SH-TAP | closed by B1 (M1) |
| p-retirement-a/x-1 | SH-TAP | closed by B1 (M1) |
| p-cashflow-a/x-2 | SH-TAP | closed by B1 (M1); the off-screen "12 envelopes added" is the place track's (SH-REDRAW) |
| p-overview-home/x-3 | SH-TAP | closed by B1 (M1); the page-level alternative (confirmation in the card's place) declined: not needed for the wrong landing, and the confirmation's place is the place track's |
| p-overview-path/x-1 | SH-TAP | closed by B1 (M1) |
| p-taxes/x-2 | SH-TAP | closed by B1 (M1) |
| j-hard-conditions/x-3 | SH-TAP | closed by B1 (M1); the setup-only `pointer-events` fix declined as redundant |
| p-career-household-system/x-5 | SH-TAP | closed by B1 (M1) |
| j-hard-conditions/HC-1 | SH-SEARCH | closed by B4 (M3) |
| j-heavy-waiting/x-1 | SH-SEARCH | closed by B4 (M3) |
| j-keyboard-reader/K1 | SH-SEARCH | closed by B4 (M3) |
| j-navigator/x-1 | SH-SEARCH | closed by B4 (M3) |
| j-one-answer/x-1 | SH-SEARCH | closed by B4 and B5 (M3) |
| p-overview-path/OP-1 | SH-SEARCH | closed by B4 (M3) |
| p-retirement-c-scenarios/x-search-backwards | SH-SEARCH | closed by B4 (M3) |
| j-navigator/N4 | SH-SEARCH | closed by B5 (M3) |
| j-navigator/N5 | SH-SEARCH | closed by B6 (M4) |
| p-career-household-system/x-3 | SH-SEARCH | closed by B6 (M4, PLAIN); the menu names vs headings moved to adoption (designer) |
| p-overview-home/x-2 | SH-SEARCH | closed by B7 (M4) |
| j-keyboard-reader/K2 | SH-MENU | closed by B10 (M5, skip link) |
| j-keyboard-reader/K3 | SH-MENU | closed by B8 (Escape) and B10 (M5) |
| j-keyboard-reader/K6 | SH-MENU | closed by B11 (M9) and B10; the `h1` in the bar declined (two h1s; T-HEAD allows h2 first) |
| j-navigator/N3 | SH-MENU | closed by B8 (M5) |
| j-navigator/x-4 | SH-MENU | closed by B9 (M5) |
| j-hard-conditions/HC-5 | SH-MENU | closed by B12 (M5 CSS, M9 wrapper); `.fold-chev` and `.scroll-hint` motion moved to the forms track (section 3) |
| j-keyboard-reader/K5 | SH-MENU | closed by B11 for confirmations and errors drawn by a redraw (M9); `role="alert"` on error notices moved to the forms track (section 3) |
| j-hard-conditions/x-2 | SH-TOPBAR | closed by B13 (M7) |
| p-taxes/T8 | SH-TOPBAR | closed by B13 (M7); the optional rename of taxes/documents declined (claude-a's page, and its name now fits) |
| j-navigator/N2 | SH-ADDR | closed by B14 (M8) |
| j-monthly-return/MR-4 | SH-WAYBACK | closed by B15 and B16 (M6); the check-in trail one page further in step 4 (frame), else adoption on net-worth |
| j-navigator/x-5 | SH-WAYBACK | closed by B15 (M6) |
| j-one-answer/A3 | SH-WAYBACK | closed by B15 and B16 (M6); "Do something else" on guides moved to adoption; the bottom "Back to: <answer> ›" button declined (owner rule 2026-11-06: one way on at the bottom) |

---------------------------------------------------------------------------------------------------------------------

## Final numbers

Last runs on the finished prototype (`proto/`, 2026-11-11; Chromium, phone 390 x 844 with touch, sandbox):

| check | old shell | new shell |
|---|---|---|
| double taps, 16 cases x 4 gaps, 6 households (`t1-dbl.mjs`) | 64 of 64 second taps did something | 2 of 64 with 5 browsers at once (both arrived after the 700 ms edge); the two cases alone 0 of 12 |
| double taps at CPU 4x, 7 cases x 4 gaps | (not run old; 1x old already 64 of 64) | 0 of 28 |
| double taps with no gap (40 ms), 4 cases x 2 | (not run old) | 0 of 8 did something |
| meant taps not taken (`t2-allowed.mjs`, 11 checks) | (n/a) | 0 of 11 |
| heavy pages: name on screen after a menu tap, 10 pages, CPU 1x / 4x | 184-3,372 ms / 732-5,955 ms | 36-172 ms / 47-639 ms |
| heavy pages: a second tap 600 ms later ends on another page | 6 of 10 / 7 of 10 | 0 of 10 / 0 of 10 |
| search: words typed key by key stay in order | 0 of 4 | 4 of 4 |
| menu, Back, Escape, Tab, swipes, reduce motion (`m4-menu.mjs`) | 3 of 14 | 14 of 14 |
| page behind the open menu moved by a swipe | 285-313 px | 0 px |
| page names cut in the top bar, 149 names x 16 combinations | up to 149 of 149 | 0 |
| addresses and ways back (`m6-ways.mjs`) | 1 of 10 | 10 of 10 (+1 script misread) |
| every page (`m8-census.mjs`; new: 3 households, old: family): page errors / where the focus is after a page change | 0 / on the body for 148 of 150 | 0 / at the top of the new page for 148, on its own heading for 2 |
| node tests (taps, search, search-words) | | 24 pass, 0 fail |

The guard's 700 ms window sits close to the slowest impatient second tap (a margin of 50 to 70 ms in the 700 ms case
when the page redraws quickly). Kept at 700 ms on purpose (conservative: it must never eat a meant tap); if the owner's
phone check 1 shows a slow second tap still landing, 800 ms is the next step, re-checked with `t2-allowed.mjs` (its
nearest meant taps are 1,000 ms after the change).
