# Wave 1, track "taps": final design (taps, menu, search, top bar, addresses, ways back)

The six shell causes SH-TAP, SH-SEARCH, SH-MENU, SH-TOPBAR, SH-ADDR, SH-WAYBACK: 36 verified findings. This file stands
alone: a builder needs only it and the six theme files (`ux/synth/themes/SH-{TAP,SEARCH,MENU,TOPBAR,ADDR,WAYBACK}.md`).
`$SP` below is `$SP`.

**Base.** The branch moved while the first draft was being written: the tip is now **c6fb730** (108 commits after c385e41,
the first draft's base). Of this track's files only `modules/overview/pages/view.js` changed (claude-f, 6378c08: the search
kept in the address with `?q=`, and a "Best match" card); `core/app.js`, `core/router.js`, `core/search.js`, `index.html`,
`core/ui/base.css` and `modules/overview/guide/frame.js` are byte-identical to c385e41. Every figure marked **[fin]** below
was measured on the final prototype: `$SP/w1/taps/fin`, a `git archive` of c6fb730 (one commit, "tip c6fb730") with this
design as the uncommitted diff (`git -C $SP/w1/taps/fin diff`), served on 127.0.0.1:9328 (stopped). Figures marked
**[proto]** come from the first draft's prototype on c385e41 (`$SP/w1/taps/proto`, its scripts and `out/` beside
`design.md`) for mechanisms that did not change. Scripts of this version: `$SP/w1/taps/fs/` (`flib.mjs`, `bar.mjs`,
`wordbreak.mjs`, `rank.mjs`, `ways.mjs`, `dbg-setup.mjs`), the architect's suites re-pointed at fin in `fs/run/`
(`t1-dbl.mjs`, `t2-allowed.mjs`, `cases.mjs`, ...), the critics' repros re-pointed at fin in `fs/break/` and `fs/person/`
(unchanged except the port and root; `c6b-replace.mjs` is new). Raw output: `fs/out/`, `fs/out-*.txt`. Chromium, phone
390 x 844 with touch (320 x 568 where said), sandbox, real touches (`touchscreen.tap` at a point; CDP touch drags for
swipes), key-by-key typing. The prototype keeps the first draft's `?w1off=` switch (`all` = the app as it is today) for
before/after runs; the build has no switch.

**What changed since the first draft** (section 9 gives the reason for each):
1. The guard's window is **800 ms** (was 700), a thumb that keeps tapping one spot is **one gesture until it rests**, a box
   or a picker is **never a "repeat"**, anything the person does between two taps (a pick in a picker, a key, typing)
   **ends the pair**, and a tap handed over in the moment between a frozen draw and the next painted frame is **stale**
   whatever its time stamp says.
2. A page's own calculation (`computeRemote`) **ends the draw** for the guard, sets `#content[aria-busy]` while it works,
   and is not worked out for a page that was left during the one-frame wait.
3. The quiet "Working it out…" line is **silent** (`aria-hidden`) unless the page is heavy; `planner.slowPages` is dropped.
4. **A new page empties Find a page** (the word is kept only while the menu stays open).
5. Ranking: a page **named exactly** for the word beats a page whose phrase is the word ("budget": Budget, then Expenses); a
   word of a phrase found only by its stem is not a name-level hit (Help's own test passes unchanged); "health care" and
   "retire at" are added. All pages keeps claude-f's `?q=` and "Best match" card; the card now ranks by whole words and the
   address is written when typing rests, not on every key.
6. Ways back: the named "‹ Back to …" row comes from `?back=<group/id>` or from **the two lists people work down** (Needs
   attention, Next best action) only; the same link also sits **at the bottom, beside the one way on**; the check-in's
   "‹ Back to the … check-in" is carried one page further. Your plan's rows and the other answers are no longer a source.
7. The top bar's "‹": hidden on Get started's questions (they draw their own), kept in place (not removed) while the menu
   is open, never offered when the history has one entry, named by the page's own row when there is one.
8. History: an address **replaced** by a page (`location.replace`) keeps its entry number; the menu's row is marked as a
   new entry; the first link after a Back is a new entry. All of it lives in `core/router.js` on top of the place track's numbering (seam S1), not in `app.js`.
9. The pill is wide enough for "your computer" on one line: "Saved on / your computer", two lines everywhere.
10. Addresses: one name ("Page not found") in the bar and on the card; a page the household's view does not offer is "not
    found" too; the switched-off card says where it was switched off and confirms "<Page> is on again."
11. One voice for read-outs: `announce()` says each thing once (deduplicated), reads only green confirmations (red ones are
    the kit's `role="alert"`), and the bottom copy speaks through it instead of being a live region of its own.
12. The seams with the place and forms tracks are written out (section 7), with one owner per function.

---------------------------------------------------------------------------------------------------------------------

## 1. Behaviour, in a person's words (the acceptance test)

**Taps that land where they were aimed**

- **B1. A double tap does one thing.** I tap Save, Add, Skip, Continue, "Use this one" or a link twice, by habit or because
  the phone seemed slow (0.1 to 0.8 s apart, on the same spot), or I keep tapping it three or four times. The first tap
  does its job; the others do nothing: I am not sent to another page, no form opens by itself, no answer on the next
  question is ticked for me, nothing is added or saved twice, and the green confirmation of the first tap is still the
  last thing that happened. *Closes j-fat-fingers/x-1, j-first-retiree/R1, p-debt-property/x-4, p-retirement-a/x-1,
  p-cashflow-a/x-2, p-overview-home/x-3, p-overview-path/x-1, p-taxes/x-2, j-hard-conditions/x-3,
  p-career-household-system/x-5.*
- **B2. Taps I mean always land.** A stepper's + tapped three times counts three; two neighbouring tiles tapped quickly
  both tick; a fold opens and closes; a box tapped twice keeps the cursor; after Add I can tap "+ Add another" a second
  later; a swipe that starts where I just tapped scrolls; the menu button tapped twice opens and closes the menu; a page I
  open takes my first tap on it; a picker I just changed opens again at once when I tap it to fix my choice; the next row's
  picker that slid up after I chose a category opens. The guard never delays a tap and never touches a swipe.
- **B3. A slow page answers at once.** I tap a page in the menu (or a link) that takes a while to work out. Within about a
  tenth of a second the menu is closed and the top bar shows the new page's name; on a page known to be slow the words
  "Working it out…" show (or the page's own: "Trying your plan…"). If I tap again while it works, that tap is dropped, not
  carried out later on whatever the finished page puts under my finger, also on pages whose answer is worked out after
  they first draw (Goal seek, Plan health score, Chance the money lasts, the reports). *Closes j-heavy-waiting/W2,
  j-navigator/x-3 (the freeze's length is wave 2's).*

**The menu's Find a page**

- **B4. Typing works.** I type "social" one letter at a time: the box says "social", the cursor stays at the end, Backspace
  removes the last letter, the keyboard and its suggestions stay up between letters, and the list narrows as I type.
  *Closes j-hard-conditions/HC-1, j-heavy-waiting/x-1, j-keyboard-reader/K1, j-navigator/x-1, j-one-answer/x-1,
  p-overview-path/OP-1, p-retirement-c-scenarios/x-search-backwards.*
- **B5. The keyboard's Go opens the first page listed** and closes the menu; the key says "Go". With nothing found it does
  nothing (the "No page matches" line is there). *Closes j-navigator/N4.*
- **B6. The plain word finds the page named for it first.** "budget" lists Budget first; "car" lists Vehicles first and
  never Medicare; "will" puts the wills page first; "card" puts Credit cards first; "who to call", "phone", "papers",
  "reminder", "reset" find Contacts, the papers page, the money calendar and Settings. Topics stay grouped and ordered by
  their best hit (the owner's rule). *Closes j-navigator/N5, p-career-household-system/x-3.*
- **B7. All pages keeps my search and puts the page named for the word first.** I search All pages for "mortgage", open a
  result, press Back: the box still says "mortgage" with the same list; the "Best match" card at the top holds the pages
  named for the word (Mortgage, Debts), never a page that only has the letters inside another word. *Closes
  p-overview-home/x-2 (its address half landed on the branch in 6378c08; the order half is this design's).*
- **B8. A new page starts the menu afresh.** After I found Social Security by typing "social", the next time I open the menu
  the box is empty and Recent, the Dashboard and the topics are there.

**The menu drawer**

- **B9. Back closes the menu.** With the menu open, the phone's Back closes it and leaves me on the same page, also on the
  first page of a visit. Closing it with the cross or the dim side, then Back, goes to the page before (no dead Back).
  After I pick a page in the menu, Back from that page returns to the page I opened the menu on. Escape closes it and puts
  the focus back on the menu button. *Closes j-navigator/N3, j-keyboard-reader/K3 (Escape).*
- **B10. The page behind the open menu stays put.** Swiping on the dim side, or past the end of the menu's list, does not
  scroll the page; when I close the menu I see the screen I left. *Closes j-navigator/x-4.*
- **B11. Keys and screen readers meet only what is on screen.** With the menu closed (phone width) Tab never walks the
  hidden menu; "Skip to the page" is the first stop. With it open, Tab stays in the menu and the top bar. The menu button
  says whether the menu is open; the current page's row is marked current; each topic says whether it is open. *Closes
  j-keyboard-reader/K2, j-keyboard-reader/K3 (Tab, aria).*
- **B12. A page change puts me at the top of the new page, and things are said once.** After a page change the next Tab is
  the page's first control and a screen reader is at the page, named (unless the page put the focus on its own heading).
  A save's green line is read out once; a red one is read by the kit (`role="alert"`, forms track). *Closes
  j-keyboard-reader/K6, j-keyboard-reader/K5.*
- **B13. Reduce motion is honoured.** The menu appears and closes at once, the chevrons turn at once, a page that brings a
  form into view jumps instead of gliding. *Closes j-hard-conditions/HC-5 (the kit's two chevrons: forms track, G7).*

**The top bar**

- **B14. The page's name is whole.** Every page name shows in full at 390 and 320 px with any pill wording and with the
  "‹" showing: two lines (three smaller lines at 320 px). The pill keeps its words on at most two lines: "Saved on / your
  computer", "Saved on / this phone". *Closes j-hard-conditions/x-2, p-taxes/T8.*

**Addresses**

- **B15. An address that names no page says so.** A mistyped address shows "Page not found", the pages of that topic when
  the topic is known, a filled "Find a page" and an outlined "Go to the Dashboard"; the bar says "Page not found". The
  same address in the wrong case simply opens the page. A page the household's view does not offer (a "soon" page, a
  builder's page, one that needs the computer or the helper when they do not answer) is "not found" too. A link to a page
  switched off in Settings › Pages shows "<Page> is switched off", "It is switched off in Settings › Pages, so it is not in
  the menu.", a filled "Turn it back on" (then the page opens with "<Page> is on again.") and "Go to the Dashboard"; a page
  switched off on the computer says so and offers only the Dashboard. *Closes j-navigator/N2.*

**Ways back**

- **B16. There is always a way back on screen.** Whenever the phone's Back would stay inside the app, a "‹" sits in the top
  bar next to the menu button, always on screen (the bar is sticky). It does what the phone's Back does; its spoken name
  says where ("Back to Needs attention"); a double tap on it goes back one page. It is not there on the first page of a
  visit (as a home-screen app opens), not on Get started's questions (they draw their own "‹"), and while the menu is open
  it stays in its place but cannot be tapped. *Closes j-navigator/x-5.*
- **B17. A page opened to fix one thing names the way back, at the top and where I finish.** Opened from Needs attention or
  Next best action, or by a link that says where it came from (`?back=`, which Pay off debts, Credit cards, Mortgage and
  other pages already pass), the page shows "‹ Back to Needs attention" at the top in the trail style of "‹ Your plan",
  and the same quiet link at the bottom just above the one way on. It returns to that page as the phone's Back does (same
  place, nothing added to the history). A page opened from a check-in step carries "‹ Back to the monthly check-in"
  one page further (Net worth > "Update all balances at once"). A page picked in the menu gets only the bar's "‹". *Closes
  j-monthly-return/MR-4; j-one-answer/A3 for every answer that passes `?back=` (the six needs-first cards adopt it in wave
  2, section 3; until then the bar's "‹" is their way back).*

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

Ten mechanisms. File and function names are those of the build; where a name belongs to another track it says so.

### M1. The tap guard (B1, B2; B3's dropped taps) — `core/taps.js` (new), wired in `core/app.js`

- **verdict({ last, tap, drawnAt, settling })**, pure, `tests/taps.test.mjs`. A tap (taken at `pointerdown`) is swallowed
  only when one of these holds:
  - *stale*: it is in the page (not the top bar) and either its time is before the shell finished drawing the screen it is
    delivered to (`tap.t < drawnAt`) or it is handed over while `settling` is true: from the end of a draw until the next
    painted frame plus one task, which is when a browser hands over the taps it queued during a frozen draw. The second
    test does not depend on how the browser stamps event times (breaker S6).
  - *new-page*: within `NEAR_PX` 40 px of the last tap that was carried out, less than `SEE_MS` **800 ms** after the screen
    changed, and the page part of the address (without its `?query`) is not the one the last tap was made on.
  - *changed*: the same, on the same page, and the control under the finger was not at that place when the last tap was
    made (same node, or same tag and words within 6 px of the same box).
  - *repeat*: the very control of the last tap, or its copy redrawn in its place, after that tap changed the plan; **never
    for an input, select or textarea** (tapping a box or a picker again is how it is used; breaker X2).
  The window runs from the latest of: the last tap carried out, the last draw after it, and **the last tap swallowed in
  this burst** (person critic P3): a thumb that keeps tapping one spot is one gesture until it rests for 800 ms. Anything
  else lands: a tap farther than 40 px, a tap after the window, a second tap on the same control when the plan did not
  change (stepper, fold, box), a click with no finger behind it (Enter or Space, a label passing its click to its box), an
  untrusted `el.click()`. `SPAN_MS` 4 s caps a burst. Hatch: `data-taps="repeat"` on a control that must save on every
  tap (none today).
- **install({ rev, inPage })** listens in the capture phase on `document`: `pointerdown` (takes the verdict; on a
  swallow also records the burst), `pointercancel` (a swipe: forgets the gesture), `touchend` (`passive: false`;
  `preventDefault` on a swallowed gesture, so no click, focus, picker or keyboard follows), `mousedown`, `click` (a
  swallowed one gets `preventDefault` and `stopImmediatePropagation`; a delivered one records the last tap: time, place,
  page, plan revision, the control under the finger and the controls in a 40 px ring, 17 hit tests, read in the capture
  phase before the page's handler changes anything), and `change`, `input`, `keydown`: **a trusted one more than 150 ms
  after the last tap forgets that tap** (something happened between the two taps, so the next is not a double tap; the
  box's own change that a tap on a tick box causes comes within those 150 ms and does not count; the blur `change` of the
  box being typed in fires before the click of the Add it was left for, so D-TWICE still holds). A field's signature
  includes its `id` and `aria-label` (two unnamed selects are no longer "the same control"). Nothing kept holds a node.
  `drawn()` sets `drawnAt` and `settling` (cleared one frame and one task later).
- **Wiring** (`core/app.js`): `installTaps({ rev: () => planRev, inPage: (el) => !el.closest("#topbar") })` at module start;
  `planRev++` first thing in the `store.subscribe` callback; `show()` is `try { return await draw(route, opts) } finally {
  taps.drawn() }`; `computeRemote` calls `taps.drawn()` when its local calculation returns and when the computer's answer
  arrives (M2), so a tap made while a page's own answer was worked out is *stale* (breaker X1).
- **Fit.** The forms kit's capture listeners are installed when `core/ui/dom.js` is imported, before the guard's, and only
  record or flush on a click (forms seam N5); a swallowed gesture gives them no click and their 400 ms timer flushes.
  `mendBlockedForms` installs later, so a swallowed click never reaches it. The forms kit's own submit guard (one submit a
  second) covers Enter pressed twice (G5); the guard looks only at taps.
- **Weighed and lost.** A blanket `pointer-events: none` for 350 to 500 ms after a redraw (six findings propose it): eats
  the meant taps of B2 and does nothing for a tap before the redraw. A per-page fix: one cause, 30 places.
- **Measured.**
  - Double taps (`fs/run/t1-dbl.mjs`, 16 cases from the findings x 5 gaps: 150, 300, 500, 700, 800 ms; 6 households;
    Save, Add, Skip, Continue, "Use this one", a menu row, "Use these as my budget", "Next: Your retirement ›" ...)
    **[fin]: the second tap did something in 0 of 80** (swallowed as *changed*, *new-page* or *repeat*; on Get started's
    Continue the second tap meets nothing). Old shell [proto]: 64 of 64 at the first draft's four gaps.
  - Late second tap during a page's own calculation (breaker X1, `fs/break/c2-late.mjs`, Will the money last? > "What would
    change it" > Goal seek, CPU 8x, second tap 800 / 1,000 / 1,150 ms later): first draft **0 of 3** swallowed (delivered
    after the answer, on whatever it drew) → **[fin] 3 of 3 swallowed as stale**, still on Goal seek.
  - A picker changed and tapped again to fix it (breaker X2, `fs/break/c5-select.mjs`, People > State you live in, second
    tap 300 / 400 / 600 ms after the change): first draft swallowed **2 of 2** ("repeat(select-one||)", focus on the body)
    → **[fin] 0 of 3 swallowed**, the picker takes the focus each time.
  - Four taps on one spot (person critic P3, `fs/person/j-taps.mjs`): Income at 0/350/700/1050 and 0/450/900/1350 ms,
    Retirement contributions at 0/400/800/1200 ms: first draft the fourth tap landed (empty Add form open again; on
    Contributions the person ended on Expenses) → **[fin] 3 of 3 later taps swallowed in each run, one income added, no form
    open, still on Contributions with "Contribution added." in view**. Old shell: tap 2 opened the form, taps 3 and 4 put
    the cursor in it.
  - Meant taps (`fs/run/t2-allowed.mjs`, 11 checks; with the 800 ms window) **[fin]: 0 of 11 not taken** (stepper x3 at
    200 ms, neighbour tiles 26 px and 300 ms apart, a fold, a meant tap 1 s after Continue, a box tapped twice, "+ Add
    another" 1 s after Add, a swipe from the same spot 250 ms after a tap, the next box after typing, the menu button twice,
    a page's first control 1.1 s after it opened). The tiles check needed a set-up fix for the tip's longer question 1 (its
    Continue sits at y 953, below the screen; the script now scrolls to it).

### M2. Paint first, then work it out (B3) — `core/app.js` `show()` and `makeCtx().computeRemote`

- **A new address** (never the redraw after a save): the title, the closed menu, the frame's top row and an empty page div
  holding one line are put on screen; `#content` gets `aria-busy="true"`; the shell waits for one painted frame
  (`afterPaint()`: `requestAnimationFrame` then `setTimeout 0`), clears `aria-busy`, checks `renderSeq`, removes the line
  and renders. The line on a page whose manifest says `heavy` is visible at once with `role="status"` ("Working it out…");
  on any other page it is `aria-hidden="true"`, transparent, and fades in after 180 ms through `element.animate` (the
  browser runs it on its own while the page is being worked out), so a quick page never flashes it and a screen reader
  never hears it over the page's name (scope critic S2). `planner.slowPages` is not built (one less thing kept).
- **`ctx.derived` is worked out on first read** (`Object.defineProperty` getter, settable): 8 views read it; the other 153
  stop paying for a hidden full calculation (Chance the money lasts lost about three quarters of its freeze [proto]).
- **`computeRemote(key, params)`**: `busy(+1)` (`#content[aria-busy]` while any is pending); the computer's branch as
  today, then `taps.drawn()` on its answer; the local branch waits `afterPaint()` (the page's own "Trying your plan…" is
  painted first), then **if the page was left or drawn again meanwhile (`seq !== renderSeq`) returns a promise that never
  settles** (nothing waits for it; breaker S3), else computes, calls `taps.drawn()`, returns; `busy(-1)` in `finally`.
  `makeCtx(route, seq)` receives the draw's `seq`.
- **Fit.** The wait sits after the place track's arrival and scroll (seam S5), so Back paints at the restored place, never
  at the top. A store update during the wait schedules a redraw that supersedes this one (`renderSeq`), as a slow render is
  superseded today. Touch rule D-TIME (b) accepts `aria-busy` as "says it is working".
- **Weighed and lost.** Yield only for heavy pages: the Dashboard's first visit on a slow phone (1.7 to 4.4 s at 4x) froze
  with the menu open. Keep the old page dimmed during the work: a new title over the old page reads as the wrong page.
  Slices or a worker for heavy pages: right, but per page (wave 2+).
- **Measured** [proto] (`m2-paint.mjs`, 10 slow pages, 3 households, a frame logger): the new name on screen 36 to 172 ms
  after the tap at normal speed and 47 to 639 ms at CPU 4x (old 184 to 3,372 and 732 to 5,955); a second tap 600 ms later
  ended on another page 0 of 10 (old 6 and 7 of 10). Person critic, on the same prototype: name and words 43 to 137 ms
  after the tap; the Dashboard's first visit at 4x shows the drawer sliding away and the words fading in at 426 ms.

### M3. One search box, kept (B4, B5, B8) — `core/app.js` `searchBox()`, `buildNav()`

- `searchBox(side)` makes `input.nav-search` once (`enterkeyhint="go"`, `autocomplete="off"`, `autocapitalize="none"`;
  autocorrect left on). `buildNav(filter)` rebuilds only `div.nav-list` after it (`list.replaceChildren(...)`) and sets the
  box's value only when it differs. Keys in the box: Enter (not while composing) opens the first `a.nav-link` listed
  through `openFromMenu` (M5); Escape with text clears it and stops there (the next Escape closes the menu).
- **A new address empties the box** (`show()`, new address: `value = ""`, list marked stale). On a phone the list is
  rebuilt when the menu next opens, never while it closes under the finger; on a wide screen at once. The view and
  "what answers" rebuilds keep the word (no address change). `ctx.openSearch()` opens the drawer and focuses the box.
- One line asked by claude-d (WORKBOARD): `household.people` read with `Array.isArray` in `buildNav`.
- **Measured.** [proto] `m3-search.mjs`: old "social" → "laicos", "chance" → "ecnahc", "net worth" → "htrow ten", caret 0,
  a new box every key; new: 4 of 4 words in order, caret at the end, the same box; Enter after "net worth" opens it, menu
  closed, focus on the page; Back returns to the page the menu was opened on. **[fin]** `fs/person/j-search2.mjs`: after
  searching "social" on Income and opening a page, the menu opened on Net worth says `""` with Recent, Dashboard, Net worth,
  Social Security (first draft: still "social" with only its results; person critic P2).

### M4. Ranking by whole words (B6, B7) — `core/search.js`, `modules/overview/pages/view.js`

- `matchScore(m, topic, query)` (new, pure) orders inside the existing levels; `matchRank` keeps its contract (-1, 0, 1, 2,
  3) as `floor(matchScore)`, so every caller (the menu, All pages, Help's `directory()`) keeps working.
  - Level 0, the page's name or one of its phrases: the name **is** the query 0; a phrase **is** the query 0.1; the name
    holds it as whole words (compared on stems: "card" is in "Credit cards") 0.2; a phrase holds it **as typed**, as whole
    words, or a longer question holds a whole phrase of two or more words, 0.25; the name or a phrase starts with what is
    typed so far 0.5.
  - Level 1 topic name, 1 whole word / 1.5 word start; level 2 purpose, 2 / 2.5; level 3 every word somewhere (stems,
    word starts). A hit inside a word ("car" in Medicare) is no hit. A word of a phrase found only by its stem ("cards" in
    "card paid off") is not a level-0 hit: the page is still found at level 3 (scope critic blocking 4: Help's test 7 keeps
    `[consolidation, payoff]` for "cards").
  - `hasWords(text, query)` (word or word start) is the topic tie-break in `buildNav`.
  - `PLAIN` gains: household/contacts, household/documents, system/settings, household/calendar (the four of x-3); "health
    care" on retirement/medicare and retirement/healthcare (breaker S5); "retire at", "when can I stop working" on
    retirement/projection (claude-f's WORKBOARD ask: "retire at 62" found only Social Security).
- **All pages** (`modules/overview/pages/view.js`, rebased on 6378c08; claude-f's `?q=` reading, the box's `value` and the
  "Best match" card are kept): the card lists up to four pages with `matchScore < 1` (named for the word), best first,
  instead of `title.includes(q)`; the topic lists below are filtered by `matches()` as today (whole words now). The word is
  written into the address (`history.replaceState(history.state, …)`) 400 ms after typing rests, on `change`, and at once
  when a result is tapped (capture listener on the list); the page's cleanup clears a pending write. Safari allows 100
  address changes in 30 s; a write per key could use them up and break the menu's Back (breaker S4).
- **Measured** **[fin]** (`fs/rank.mjs`, the menu's order for the household view; tip first):
  - "budget": Expenses, Budget (50/30/20), Budget → **Budget, Expenses, Budget (50/30/20)**;
  - "car": Salary and raises, Work benefits, Equity compensation… (Vehicles 8th) → **Vehicles first**, no Medicare;
  - "will": Will the money last? first → **Estate documents first**; "card": Pay off debts → **Credit cards first**;
  - "401k": Asset location → **Retirement contributions**; "reminder": Needs attention → **Money calendar**;
  - "who to call" / "papers" / "reset": nothing → **Contacts / Document vault index / Settings**;
  - "retire": Will the money last? stays first; "mortgage": Mortgage, What lenders see, Debts, Life timeline (unchanged).
  - Node: `tests/search.test.mjs` (12), `tests/search-words.test.mjs` (6) and `modules/system/help/module.test.mjs` (8)
    pass **[fin]** (the first draft failed Help's test 7).

### M5. The drawer (B9, B10, B11, B13) — `core/app.js`, `index.html`, `core/ui/base.css`

- **Open** (phone width): build the list if stale; `#sidebar.open`, `#scrim.show`, the ✕; `aria-expanded="true"` on the
  menu button; `inert` on `#content` and `#sync-bar`; `html.drawer-open` (the page cannot scroll); one history entry at the
  same address through **`router.layer(close)`** (place track, seam S2), keeping its `release`; the focus on the menu itself
  (a momentary `tabindex=-1`: the next Tab is Find a page, a screen reader is in the menu, no keyboard pops up).
- **Close** (✕, dim side, Escape): the reverse, then `release()` (steps off the layer's entry: a same-address step, no
  redraw); the focus back on the menu button for ✕ and Escape. **The phone's Back while open**: the router calls `close`.
- **A row, the pill, or Go in Find a page**: `openFromMenu(href)` → `router.open(href, { replace: true, via: "menu" })`
  (taps adds `open` to the router, seam S4): the menu's entry is replaced by the new page's (a new entry number), so Back
  from it returns to the page the menu was opened on; a row for the page already shown just closes. One delegated click
  listener on `#sidebar` sends rows there.
- **CSS** (`base.css`, under `max-width: 959px`): `#sidebar { visibility: hidden; overscroll-behavior: contain;
  transition: transform .18s ease, visibility 0s linear .18s }`, `#sidebar.open { visibility: visible; transition-delay:
  0s }`, `#scrim { touch-action: none }`, `html.drawer-open, html.drawer-open body { overflow: hidden }`,
  `html.drawer-open #topbar { touch-action: none }`; at 960 px and over nothing changes. Reduced motion: `#sidebar,
  .nav-group-head .chev { transition: none }` in the one reduced-motion line (shared with forms' `.fold .fold-chev,
  .scroll-hint::after`, seam S9).
- **Markup**: `index.html` gets `aria-controls="sidebar" aria-expanded="false" type="button"` on the menu button and
  `<button class="nav-skip" type="button">Skip to the page</button>` first in the top bar (a button, not `href="#content"`,
  which the router would read as a page called "content": scope critic S6); it focuses `#content` quietly. `.nav-skip`
  sits above the top edge until focused (44 px tall, accent border).
- `markActive()` sets `aria-current="page"`; topic heads carry `aria-expanded`.
- **Measured** [proto] (`m4-menu.mjs`, 14 checks, raw touches): old 3 of 14, new 14 of 14 (Back on the first page and on a
  second page, row then Back, cross then Back, dim side then Back, five taps on the menu button 160 ms apart, Escape, Tab
  closed and open, `aria-expanded`, `aria-current`, swipes behind the menu old 285 to 313 px → 0 px, reduced motion 0
  part-way frames). Breaker: a reload with the menu open boots closed with its entry stepped off (12 of 12 in its loop),
  Forward onto the menu's old entry steps off; two hangs in the first 8 reloads were not reproduced (S7, section 4).

### M6. The "‹" button and history (B16) — `core/router.js` (on the place track's numbering), `core/app.js`, `index.html`

- **Entry numbers come from the place track** (seam S1): each entry carries a number; the visit's first number is known;
  the page of the entry before is known. Taps reads them through one adapter in `app.js`, `entryNow()` → `{ n, first,
  prevKey, via }`, so only that function changes if the chosen place plan names them differently (place2:
  `router.entry()`, `router.first()`, `router.at(n - 1).p`; place: `history.state.{n, p}`).
- **Taps adds to `core/router.js`** (after the place track's P1, seam S4), pure parts node-tested in `tests/router-replace.test.mjs`:
  - `router.open(href, { replace, via })`: marks the next stamp (`mark: "new"`, `via`) and navigates (`location.replace`
    when `replace`, else `location.hash`). The trail item of the new entry records `via`.
  - `router.replace(href)`: marks the next stamp `"replace"` and calls `location.replace(href)`: the entry keeps its number
    and its `from`; its trail item is overwritten. Pages that replace their own address adopt it in wave 2 (section 3).
  - **`isReplace({ had, mark, traversed, len, lenRef, cap = 50 })`**, pure, the safety net for pages that call
    `location.replace` themselves (breaker X3): an unnumbered entry is a replace when a mark says so, or when no Back or
    Forward happened since the last entry (`traversed`: a `popstate` onto a numbered or layer entry), the history's length
    equals the length after the last entry or the shell's own push (`lenRef`), and the length is under 50 (Chromium's
    cap, where a push stops growing it). Otherwise it is a new entry. After a Back the length cannot tell a push from a
    replace, so the rule falls back to "new" there; the explicit `router.replace()` covers those pages.
  - **`traversed` is set by a Back or Forward and cleared only when a new entry is stamped**, never by arriving on a
    numbered entry (the arrival's own stamp would otherwise clear it, and the next link after a Back, which drops the
    entries ahead and keeps the length, would be read as a replace). Found by `ways.mjs` W1 on fin: after a hub's bottom
    link went Back, the next row opened with no "‹" and no named row; with the rule, all three rows in a row are named.
    `tests/router-replace.test.mjs` walks it: link, Back, link → n 2, 1, 2.
- **`#nav-back`** in `index.html` after the menu button: `<button id="nav-back" type="button" aria-label="Back" title="Back"
  hidden><span aria-hidden="true">&#8249;</span></button>`, 44 x 44, outlined like the menu button. `updateBack()` (called
  in `show()` before the page draws and again after, and from `paintDrawer`):
  - shown when `n > first`, `history.length > 1` (a fresh home-screen launch can never go back), and the page is not one
    that draws its own "‹" at the top (`OWN_BACK = new Set(["overview/setup"])`, breaker S1, person critic agreed);
  - while the menu is open: `.covered` (`visibility: hidden`), so the page's name does not jump 52 px (person critic S7);
  - its `aria-label` and `title`: the words of the page's own named row when it draws one ("Back to the monthly
    check-in"), else "Back to <title of the page before>", else "Back"; never "Back to" the page on screen (person S6);
  - a tap is `history.back()`; a double tap goes back one page (M1: the second tap after the address changed is
    *new-page*).
- `ctx.cameFrom()` → `{ key, menu }` of the entry before (null on the first entry). There is **one back API**: the place
  track's back links (`a[data-back]` with `router.back(href)` in place2, `ctx.back` in place); taps has no `ctx.goBack`.
- **Measured.**
  - **[fin]** `fs/break/c6b-replace.mjs` (family and ruth; the first page of a visit is a Get started question; its own ‹
    replaces the address): entry stays **n=1**, bar ‹ hidden (first draft: n=2, ‹ shown "Back to Set up my plan", tapped →
    about:blank); then a link to Net worth: n=2, "Back to Set up my plan"; tapped → the question, n=1, ‹ hidden.
  - **[fin]** `fs/ways.mjs` W5 (family; the Dashboard opened first, its Net worth tile, then "‹" tapped twice 300 ms
    apart): no "‹" on the Dashboard; on Net worth "Back to Dashboard"; the double tap → the Dashboard (n 1), "‹" hidden.
    W3 (Find a page "emergency" + Go from Income): the bar's "Back to Income", no named row.
  - [proto] `m6-ways.mjs`: first page no "‹"; after a reload the "‹" is still there with its name; hidden while the menu is
    open.

### M7. Named ways back (B17) — `modules/overview/guide/frame.js`

- **`namedBack({ page, query, came, offered })`**, pure, exported from `frame.js` (it imports cleanly in Node),
  `tests/ways-back.test.mjs`: returns `{ key, href }` or null.
  1. `query.back` matching `group/id` or `group/id/<id>` (net-worth's `balance/accounts/<id>`), not this page, offered in
     this view: that page, with the link's own address.
  2. else the entry before is one of `HUBS = ["overview/alerts", "overview/next-best-action"]`, not reached through the menu
     (`came.menu` false), not this page: that hub.
  3. else null. Your plan's rows and the other answers are no longer sources (scope critic blocking 2: 34 target pages);
     Your plan has its own trail already.
- **Drawn** only in the frame's non-step branch, after the guide trail, the quick answers' trail and the check-in trail
  (which win, as today): the top row `nav.gb-compact` "‹ Back to <title>", and at the bottom **the same link in its own
  quiet row just above the continue row** (`nav.gb-compact.gb-foot-back`, person critic P1). It is not a way on (it starts
  with ‹, as "‹ Back to your plan" under Next result does), so touch rule T-ONE-WAY stays green; the page still ends with
  exactly one way on (design log 2026-11-06).
- **Every "‹ Back to …" the frame draws carries `data-back`** (the place track's one document listener goes Back when that
  page is just behind, else the link is followed; seam S3): the guide trail, the quick trail, the check-in row, the
  carried check-in row and the named rows.
- **The check-in's trail one page further** (MR-4's third part): in review mode the frame writes `planner.reviewTrail`
  (`{ page, month }`, sessionStorage); on the next page that is not a step and not resting it draws "‹ Back to the
  monthly check-in" (the check-in row's own words) once (the same `hop()` rule the quick and guide trails use), then clears it.
- **One screen holds at most two ways back**: the bar's "‹" and one named link (top row on arrival, bottom link at the
  end; a page's own "Back to X ›" in its save line, where it has one, sits by the form).
- **Measured** **[fin]** `fs/ways.mjs` (family, real taps; `fs/out/ways.txt`):
  - W1 Needs attention, rows 1, 2, 3 in turn (Emergency fund → Usable cash, tax from pay, life insurance): each page shows
    "‹ Back to Needs attention" at the top and at the bottom, the bar's "‹" says "Back to Needs attention"; the bottom link
    returns to the list as Back does (history length unchanged: 3 → 3). Picture: `fs/shots/ways-alert-bottom.png`.
  - W2 Pay off debts → `#/balance/liabilities/a-visa?back=debt/payoff` (the address its "Add …'s rate and payment ›"
    button uses): "‹ Back to Pay off debts" top and bottom; the bottom link → Pay off debts, n 2 → 1, length unchanged.
  - W3 the same kind of page picked in the menu: no named row (only the bar's "‹").
  - W4 Net worth opened from the check-in (`from=review`): "‹ Back to the monthly check-in"; its "Update all balances at
    once" → Update balances still shows "‹ Back to the monthly check-in" (carried one page; the words are the frame's
    existing check-in row).
  - Node: `tests/ways-back.test.mjs` 4 of 4.

### M8. The top bar fits (B14) — `core/ui/base.css` (`#topbar`, `#page-title`, `#status`, `#nav-back`, `.nav-skip`)

- `#topbar #page-title`: up to two lines (`white-space: normal; display: -webkit-box; -webkit-box-orient: vertical;
  -webkit-line-clamp: 2; line-height: 1.18; text-wrap: balance; overflow-wrap: anywhere`). The bar stays 56 px.
- Under 480 px: bar gap 8 px, padding 0 10 px; `#status` wraps (`white-space: normal; line-height: 1.15; font-size: 12px;
  text-align: left`), **at most 124 px**, enough for "your computer" on one line (85 px of text in Chromium's font; SF Pro
  is a little wider: owner check 4).
- Under 375 px: gap 4 px, padding 0 8 px; the name 13 px on up to three lines (`line-clamp: 3`, line-height 1.12); the pill
  at most 112 px with 7 px padding.
- The rules are written plainly on `#topbar` (no `.w1` class; the first attempt on the pill's own class failed because
  `showPill()` rewrites `className`).
- **Measured** **[fin]** (`fs/bar.mjs`: all 149 names a household is offered, in the real bar, x 4 pill wordings x 390/320
  x "‹" on/off; `fs/out/bar.txt`): **0 cut in all 16 combinations; the pill on at most 2 lines in all 16** (first draft:
  "Saved on your computer" on 3 lines at 390 and 320, "Saved on this phone" on 3 at 320). Name box with "‹" and the
  longest pill: 134 px at 390 (17 px), 92 px at 320 (13 px). `fs/wordbreak.mjs`: no name is broken inside a word (only
  "Self-employment" at its hyphen). Old: up to 56 / 86 names cut at 390 and 130 / 146 at 320 with the real pill words.

### M9. Addresses that name no page (B15) — `core/app.js` `missing()`, `missingCard()`

- Before choosing the module: an address whose lower-cased group/id is a page is that page (`history.replaceState(
  history.state, …)` with the corrected address).
- `missing(route, { modules, enabled, offered, userView, sourceOf, groups })`, pure (exported from a small new
  `core/address.js`, node test `tests/address.test.mjs`): `{ kind: "off", key, by: "device" | "properties" }` for a page
  switched off; `{ kind: "unknown", group }` for no such page, **and for a page the household's view does not offer**
  (breaker S2; a page opened by its address used to always work, which showed "soon" placeholders and AI wording in the
  household's view, against the design log of 2026-11-06); null otherwise.
- `missingCard()` draws instead of a page; the bar and `document.title` say "Page not found" or the page's name:
  - unknown: h1 "Page not found", "This link leads to a page that is not in the app.", "Pages about <topic>:" with up to 8
    rows when the topic is known, a filled "Find a page" (opens the menu's search) and an outlined "Go to the Dashboard";
  - off on this device: h1 "<Page> is switched off", "It is switched off in Settings › Pages, so it is not in the menu.",
    filled "Turn it back on" (sets it, redraws the address, the page opens with the green "<Page> is on again.", read
    once), outlined "Go to the Dashboard";
  - off on the computer (`planner.properties`): "It is switched off in the settings on your computer, so it is not in the
    menu.", one filled "Go to the Dashboard" (person S4, scope S5). "your computer" is the pill's own wording (2026-11-06).
- **Measured** [proto] (`m6-ways.mjs` A1 to A4): old 0 of 4 (the Dashboard under the wrong address); new: typo → card with
  the topic's pages; wrong case → Income at `#/cashflow/income`; the Dashboard's row to a switched-off Emergency fund →
  the card, "Turn it back on" → the page. The words and the not-offered rule were changed after; the build re-runs A1 to A4
  and adds `#/system/devices` and `#/ai/critic` in the household's view (breaker S2).

### M10. Focus, read-outs, reduced motion (B12, B13) — `core/app.js`

- `landFocus(root)` at the end of a new-address draw: focus `#content` with a momentary `tabindex=-1` and `preventScroll`,
  unless the focus is already inside it (Get started, Your plan and the questions focus their heading). `#content` gets
  `aria-label` = the page's name (a named `main`). A permanent `tabindex` on `#content` was tried and lost: every tap on
  plain text then focused the page.
- **`announce(text)`**: one live region (`#announce`, polite) for the whole shell; **the same words within 2 s are said
  once**. After a save's redraw it reads this save's fresh **green** notices only (red ones are read by the kit's
  `role="alert"`, forms G6). The bottom copy (`echo()`, the place track's) **is not a live region**: it says its words
  through `announce()` (scope critic blocking 3: no double read-out).
- **Reduced motion for the pages' own scrolls**: one hook, `calmScroll(args)` (pure, exported from `core/taps.js`: a
  `behavior: "smooth"` option becomes `"auto"` while `matchMedia("(prefers-reduced-motion: reduce)")` matches, checked at
  each call), registered on **the place track's one scroll wrapper** (`wrapScroll(obj, name, hook)`, seam S7) for
  `scrollIntoView`, `scrollTo`, `scrollBy` (window and elements). Never a second wrapper: if the chosen place plan has none,
  taps installs the single wrapper itself in step T8 and place adds its counter to it.
- **Measured** [proto]: census of 150 pages x 3 households, focus after a page change on the body for 148 of 150 (old) →
  at the top of the page for 148, on its own heading for 2; after a menu row by keyboard the next Tab is the page's first
  control (old: Find a page); "Side gig added." read out (old: nothing); a goal row on Goals with reduce motion: 33 scroll
  positions (a glide) → 2 (a jump).

---------------------------------------------------------------------------------------------------------------------

## 3. What the shell cannot do: the adoption list for wave 2

Every behaviour above needs no page change. These finish findings the shell can only start.

| page (lane, today) | change | finding |
|---|---|---|
| the six "needs first" cards: `retirement/projection/view.js` (People, Accounts; claude-e released `retirement/**`, so claude-b; view only, not its compute.js), `insurance/life-needs` (claude-h), `overview/benchmarks` (claude-f), `retirement/fire` (claude-b), `goals/house` (claude-g), `debt/payoff` (already passes `?back=` to Debts) | add `?back=<this page>` to the link (one attribute each); the frame then names the way back at the top and bottom | j-one-answer/A3 |
| `overview/guide/view.js` (claude-f) | "Do something else" on a guide opened from Quick answers: `href="#/overview/quick"` with `data-back` when `ctx.cameFrom()?.key === "overview/quick"` | j-one-answer/A3 (guide part) |
| `overview/setup/view.js` :463 and :1763 (claimed by claude-c's loans lane until it lands), `transactions/ledger/view.js` :60 (claude-d, released) | `location.replace(x)` → `ctx.replace(x)` (the router's `replace`), so the entry keeps its number after a Back too | breaker X3 (beyond the safety net) |
| `ai/explain/view.js` :80 | `history.replaceState(null, …)` → `history.replaceState(history.state, …)` (it wipes the entry's number) | breaker X3 |
| `overview/dashboard`, `debt/payoff`, `overview/plan`, `overview/monthly-review` (over 120 ms here), and the heavy pages' own work (`retirement/monte-carlo`, `reports/*`, `scenarios/*`) | speed: work out in slices (as `retirement/careful.js` does) or cache; the shell now answers at once, but the page still blocks for its own work | j-heavy-waiting/W2, j-navigator/x-3 (the freeze's length) |
| designer | optional: menu names that differ from the page's heading ("Contacts" / "Who to call", "Document vault index" / "Where your papers are"); the two pages both titled "Emergency fund" (`balance/liquidity`, `goals/emergency-fund`: claude-a), which T-HEAD forbids | p-career-household-system/x-3 (naming); person S2 |

Taken by the forms track (both designs say so): `role="alert"` on `ui.notice("error")` (K5), `.fold .fold-chev` and
`.scroll-hint::after` in the reduced-motion line (HC-5), one submit a second for Enter twice (D-TWICE, Enter half).

New pages from now on: nothing to adopt. A control that saves to the plan on every tap and is meant to be tapped quickly
again carries `data-taps="repeat"`; a page that replaces its own address uses `ctx.replace(href)`; a link that sends a
person to fix something and should lead back passes `?back=<its page>` (docs/CONVENTIONS.md gets the three lines).

---------------------------------------------------------------------------------------------------------------------

## 4. Risks: what could be worse than today, and the check that catches it

| risk | check |
|---|---|
| The guard swallows a meant tap (a fast reader taps the new thing within 0.8 s on the same spot; a burst that never rests) | `t2-allowed.mjs` 0 of 11 (its nearest meant taps are 1.0 to 1.1 s after the change) on every change to `core/taps.js`, plus the picker re-tap (`c5-select.mjs`) and a transactions/categorize row re-pick; D-ANSWERS taps once, so no first tap is ever eaten. Worst case: the person taps again after a pause. |
| The 150 ms "something happened" rule forgets a tap too early (a page that fires a trusted `input` long after a tap) or too late | `t1-dbl.mjs` (every case types before it taps twice) and the node tests; trusted `input`/`change` come only from the person's own typing and picking |
| *stale* by `settling` swallows a tap made in the very frame after a quick redraw | the window is one frame and one task (about 16 ms) after a draw ends; `t2-allowed.mjs` P11 (a tap 1.1 s after a draw lands) |
| The guard breaks a control type nobody tried (native pickers, file inputs, range sliders, long-press, text selection) | `t2-allowed.mjs` grows a case per type before landing; the guard cancels only `touchend` and `click` of a swallowed gesture, never `pointermove` |
| Paint first: a blank frame between two quick pages reads as a flicker | by eye on Income, Net worth, Settings, Debts, Goals, Expenses (`tools/shot.mjs` sequence) and owner check 5; fallback: yield only for `heavy` pages (one line) |
| A page relies on `ctx.derived` being a data property, or on drawing in the same task as the hash change | census of every page in 3 households (0 page errors, 0 red notices), `npm test`, `qa/smoke-all.mjs`; the 8 views that read `ctx.derived` opened and saved once each |
| `computeRemote`'s never-settling promise holds memory | only for a page left within one frame of asking; nothing references it once the page is gone; the 200-page memory walk of the break regression hunter |
| The drawer's layer leaves a dead Back, or Back leaves the app with the menu open | `m4-menu.mjs` D1 to D6, Forward onto the menu's entry, a reload with the menu open (20 times with network latency: breaker S7's two unexplained hangs; if one repeats, step off the stale entry after the first draw instead of at boot) |
| The replace rule calls a push a replace (the history at its cap; Safari's own cap; the first link after a Back) or misses a replace after a Back | `isReplace` is used only under 50 entries and never after a traversal (`traversed` kept until a new entry; `ways.mjs` W1 opens three hub rows in a row); node tests for the first entry, after a Back, at the cap, the menu's layer; the explicit `ctx.replace` for the pages that replace |
| The "‹" shows when Back would leave the app (a tab opened from a link copies sessionStorage) | the place track's visit id (a new tab starts a new visit), `history.length > 1`; `m6-ways.mjs` K1, K3; owner check 6 |
| Two ways back confuse (the bar's ‹ and a named row; a page's own "Back to X ›") | named rows only from `?back=` or the two hubs, never via the menu, never on a page that leads the way; at most two on one screen; designer's look at `fs/shots/ways-alert-bottom.png`; T-ONE-WAY still counts one way on |
| A name of three lines at 320 px, or SF Pro wider than Chromium's font, cuts names or puts the pill on three lines again | `fs/bar.mjs` (0 of 149 x 16, pill ≤ 2 lines); owner check 4 with the longest names and "Saved on your computer" |
| The address card replaces a fallback a flow relied on (an old bookmark, a renamed page, a link to a page the household's view hides) | touch rule T-LINK (every in-app link names an offered page); `m6-ways.mjs` A1 to A4 plus `#/system/devices` and `#/ai/critic`; boot's empty address still opens Get started or the Dashboard; the AI/computer answer arriving late redraws the page (`planner:live`) |
| Focus moved to the page scrolls it or pops the keyboard | `preventScroll`; `main` is not editable; the census reads scroll 0; owner check 7 with VoiceOver |
| The reduced-motion hook changes a page that waits for its smooth scroll to finish | only `behavior: "smooth"`, only while reduce motion is on; no `scrollend` listener in the code today |
| Three tracks change `show()`, `router.js`, `frame.js` and `base.css` at once | section 7's ownership and order; the acceptance scripts of all three tracks re-run on the merged build |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari

- **Double tap to zoom.** Safari may treat two taps under about 350 ms as a zoom on a zoomable page instead of a second
  click: then the quick double taps of B1 never reach the page (the page zooms, its own surprise), and the 0.4 to 0.8 s
  impatient taps are clicks as in Chromium. If owner check 1 shows zooming, add `touch-action: manipulation` on `#app`
  (pinch zoom stays).
- **Event times.** Older WebKit stamped events with the date; `clock()` reads both. If WebKit stamps a touch when it is
  dispatched rather than when the finger went down, `tap.t < drawnAt` never holds for a tap queued during a freeze; the
  `settling` test catches it anyway (owner check 5 is the gate).
- **`touchend` must be cancellable**: registered with `passive: false` explicitly (Safari makes document `touchstart` and
  `touchmove` passive by default).
- **Paint first.** `requestAnimationFrame` then `setTimeout 0` paints in Safari too. Whether Core Animation runs the 180 ms
  fade during a freeze cannot be seen here.
- **The search box.** Safari probably put the caret at the end of a re-made box (so the old bug may have shown as dropped
  letters, a flickering keyboard or lost autocorrect); the kept box removes the cause either way. `enterkeyhint="go"` needs
  Safari 13.1+. Whether iOS commits an autocorrection ("morgage" → "mortgage") before Enter is read: owner check 2.
- **Back and the menu.** In Safari the edge swipe is Back and fires `popstate` for the menu's entry; a home-screen app may
  have no edge swipe: that is why the "‹" matters. Safari limits `pushState`/`replaceState` to 100 calls in 30 s: the menu
  uses one per open, the router one per new entry, All pages one per rest in typing.
- **`history.length`.** WebKit caps the back list (about 100); the replace safety net is used only under 50.
- **Scroll lock.** `overscroll-behavior` (Safari 16+), `overflow: hidden` on the root for touch (recent versions only),
  `touch-action: none` on the dim side and the bar (long supported). Fallback if check 3 fails: the body-fixed lock behind
  the same class.
- **`inert`** needs Safari 15.5+ (without it the dim side still covers the page; only Tab and VoiceOver could reach it).
- **Fonts.** SF Pro is a little wider than the font measured here: the pill's 124 px and the names' two lines have some
  margin; check the longest.
- **`element.focus()`** outside a tap does not raise the keyboard; the shell only focuses `main` and the menu (not boxes).

Owner checks (home-screen app and Safari, about twelve minutes):
1. Income: "+ Add another income", fill it, tap "Add income" twice quickly; then three or four times. One income, no empty
   form reopened, still on Income. Did the page ever zoom?
2. Menu, type "social" in Find a page one letter at a time: the box says "social", the keyboard stays up with
   suggestions; Go opens Social Security. Then type "morgage" and press Go: Mortgage?
3. Open the menu on a long page scrolled half way, swipe on the dim side and on the menu, tap Find a page (keyboard up),
   close: the same place?
4. "Will the money last?", "Bills and regular payments", "Tax documents checklist": the whole name in the bar? The pill
   reads "Saved on / this phone" (or "Saved on / your computer") on two lines?
5. Plan health score from the menu: the name and "Working it out…" at once? Tap the empty area several times while it
   works: nothing opens, you stay on it.
6. From the home-screen icon: Dashboard, tap the Net worth tile: a "‹" next to the menu button that brings you back? None
   on the Dashboard itself? Is the "‹" easy to reach next to the menu button, or does the thumb take the menu?
7. With the menu open, Back (edge swipe in Safari): the menu closes, the page stays. With VoiceOver: after a page change
   the page's name is read; after a save "… added." is read once.
8. Reduce Motion on: the menu appears without sliding.
9. `#/cashflow/incom` in the address: "Page not found" with the Cash flow pages.
10. Needs attention, tap a row, scroll to the bottom: "‹ Back to Needs attention" above "Continue your plan"; it returns to
    the list.

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each verifiable alone; the same list as `steps.json`)

Every step ends with `node --check` on each touched file, `npm test` (0 failures apart from the two known speed flakes,
re-run alone), `npm run check`, `node tools/leak-guard.mjs --worktree`, a CHANGELOG line ("- [builder:claude-b] ..."), and
`node tools/shot.mjs` of two touched pages, read. The scripts named are in `$SP/w1/taps/fs/` (re-pointed copies of the
architect's and critics' scripts); the build passes them its own base URL and root.

- **T1. Tap guard.** `core/taps.js` (`verdict`, `same`, `calmScroll`, `install`, the constants) and `tests/taps.test.mjs`
  (the 14 tests of fin plus: a field signature with id/aria-label; `calmScroll`); `core/app.js`: install at module start,
  `planRev` in `store.subscribe`, `show()` wrapped so `drawn()` runs in `finally`, `taps.drawn()` after `computeRemote`'s
  local compute and on the computer's answer. No `window.__swallowed` outside the sandbox (keep it only when
  `store.sandbox()`). Checks: node test; `fs/run/t1-dbl.mjs` (0 of 80, also CPU 4x on A, B, C, G, H, M, O);
  `fs/run/t2-allowed.mjs` (0 of 11) plus a select, file, range drag, label checkbox, long-press case;
  `fs/break/c5-select.mjs` (0 swallowed); `fs/person/j-taps.mjs` (four-tap runs stay); D-TWICE.
- **T2. The search box.** `core/app.js` `searchBox()`, `buildNav()` rebuilding `.nav-list` only, Enter and Escape in the
  box, the word cleared on a new address, the list rebuilt on open on a phone, `Array.isArray` on people. Checks:
  `fs/run/m3-search.mjs` (4 words typed key by key in order, Enter); `fs/person/j-search2.mjs` (box empty after a page
  change); `node qa/user-view.mjs`.
- **T3. Ranking and All pages.** `core/search.js` (`matchScore`, `aliasHit`, `hasWords`, PLAIN additions),
  `tests/search-words.test.mjs` (+ "budget", "cards", "care", "retire at 62" cases); `core/app.js` uses `matchScore` and
  `hasWords` in `buildNav`; `modules/overview/pages/view.js` (the card by `matchScore < 1`, the address written on rest,
  change and result tap, cleanup) and its README. Checks: `node --test tests/search*.test.mjs
  modules/system/help/module.test.mjs`; `fs/rank.mjs` (table of section 2 M4); All pages "mortgage", open the second
  result, Back: same word, same list; type and correct 40 letters: the address written at most a handful of times.
- **T4. The drawer: hidden, contained, quiet.** `base.css` drawer block and reduced-motion line; `core/app.js`
  `paintDrawer` (inert, `aria-expanded`, `html.drawer-open`), focus on open and back to the button on Escape or ✕, the
  Escape listener, `aria-current`, topic `aria-expanded`; `index.html` skip button and `aria-controls`. Back still plain
  (no history entry yet). Checks: `fs/run/m4-menu.mjs` D4, D7 to D11; `fs/run/m4b-swipes.mjs` (0 px on 2+ pages).
- **T5. History: replace rule, the menu's entry, the "‹".** After the place track's router step (P1): in `core/router.js`
  `open(href, { replace, via })`, `replace(href)`, `isReplace()` and the stamp using it, `tests/router-replace.test.mjs`;
  `core/app.js` `entryNow()`, the drawer through `router.layer`, `openFromMenu`, `#nav-back` and `updateBack()`
  (`OWN_BACK`, `.covered`, `history.length`), `ctx.cameFrom()`, `ctx.replace`; `index.html` `#nav-back`; `base.css`
  `#nav-back`; `traversed` kept until a new entry is stamped. Checks: node test (first entry, replace, link-Back-link
  → n 2, 1, 2, the cap, the menu's layer); `fs/run/m4-menu.mjs` D1, D2, D3, D5, D5b, D6; `fs/break/c6b-replace.mjs`
  (n stays 1); `fs/ways.mjs` W3 and W5 (and W1's three rows in a row once T6 lands); `fs/run/t1-dbl.mjs` H; D-BACK.
- **T6. Named ways back.** `modules/overview/guide/frame.js`: `namedBack`, `HUBS`, the top row and the bottom row, the
  check-in trail one page further, `data-back` on every "‹ Back to" link; `tests/ways-back.test.mjs`. Checks: node test;
  `fs/ways.mjs` W1 to W4; `qa/flows/path-walk.js` (one way on, the path's own rows untouched); T-ONE-WAY.
- **T7. Paint first.** `core/app.js` `show()`: the one-frame wait (after the place track's scroll, seam S5) with the
  heavy/quiet line and `aria-busy`; lazy `ctx.derived`; `computeRemote`'s `afterPaint`, `renderSeq` check and `busy`.
  Checks: `fs/run/m2-paint.mjs` at CPU 1x and 4x (name under 250 ms at 4x on 9 of 10, 0 of 10 wrong ends);
  `fs/break/c2-late.mjs` at CPU 8x (3 of 3 stale); census of every page in family, ruth, empty (0 errors); the 8 views that
  read `ctx.derived` opened and saved once; D-TIME (b).
- **T8. Focus, read-outs, reduced motion.** `landFocus`, `#content` `aria-label`, `announce()` dedupe and green-only,
  `calmScroll` on the place track's wrapper (or the single wrapper, if none). Checks: `fs/run/m4-menu.mjs` D11 to D13;
  census focus counts; a save's words in `#announce` once.
- **T9. The top bar.** `base.css` `#topbar` rules of M8. Checks: `fs/bar.mjs` (0 of 149 cut in 16 combinations, pill ≤ 2
  lines); `fs/wordbreak.mjs`; shots light and dark at 390 and 320 of Retirement contributions and Will the money last?.
- **T10. Addresses.** `core/address.js` (`missing`), `tests/address.test.mjs` (unknown, unknown with a known topic, wrong
  case, off on the device, off on the computer, not offered in the household's view, offered in the build view);
  `missingCard()` and the "on again" line in `core/app.js`. Checks: node test; `fs/run/m6-ways.mjs` A1 to A4 (read the
  whole card), plus `#/system/devices` and `#/ai/critic` in the household's view.
- **T11. Docs and permanent checks.** docs/CONVENTIONS.md ("The ctx object": `derived` worked out on first read,
  `cameFrom`, `replace`, `announce` once; "Shell": the page drawn one frame after its title, the address card,
  `data-taps="repeat"`, `?back=`); docs/DESIGN_LOG.md entry (section 7); docs/TEAM.md claim row gains `core/taps.js` and
  `core/address.js`; WORKBOARD lines to claude-f (All pages, "retire at", the guide's "Do something else") and claude-d
  (people guard done). Land `t1-dbl`, `t2-allowed`, the typed part of `m3-search`, `m4-menu`, `bar.mjs` and `ways.mjs` as
  `qa/shell-*.mjs` taking a base URL (the touch sweep has no flow hook yet).

Touch rules (`qa/touch-rules.json`) these turn green: **D-TWICE** (M1 *repeat* and *changed*, the forms kit's submit
guard for Enter), **D-TIME (b)** for pages that work after they draw (`aria-busy`), **D-ANSWERS** (no first tap is
eaten; a menu row answers at once), **D-BACK** for the address (the scroll part is the place track's), **D-TOP**, **T-NAME**
(the "‹" and the skip button have names in words), **T-TARGET** (44 px "‹", pill, skip button). **T-ONE-WAY** stays green
(named rows start with ‹). **T-HEAD** is not claimed: it compares `textContent`, so a cut title passed before and after;
the sweep's owner is asked to compare `scrollHeight`/`clientHeight` and to set the real pill words (scope S3). Two notes
for the sweep: the skip button sits above the top edge until focused (not a covered control), and D-TIME (b) should count
a "working" line only when it is visible at the first painted frame (the quiet line is transparent and `aria-hidden`).

---------------------------------------------------------------------------------------------------------------------

## 7. Design log, lanes and the seams with the place and forms tracks

**Owner decisions relied on and kept** (docs/DESIGN_LOG.md):
- 2026-11-06, one path: "every page ends with exactly one way on … No Next bar is fixed to the bottom of the screen … Do not
  add a second menu, a stepper beyond the bar's track, or a new 'walk'". The "‹" is in the top bar (not a bar at the
  bottom, not a menu, not a way on); the named links start with ‹ and sit in the frame's existing trail style, at the top
  and just above the one way on, as "‹ Back to your plan" already does under "Next result".
- 2026-11-06, the household's view: never "soon" pages, PC / AI helper / sync wording; the pill says "Saved on your
  computer". Kept: the address card hides pages the view does not offer; "your computer" is the pill's own word.
- 2026-09-15, menu drawer round 2: page-name hits, then topic-name hits, then description hits, topics by best hit, "No
  page matches" with a link to All pages; the menu button turns into a cross. Kept; M4 refines hits inside each level.
- 2026-09-15, pass 2 round 2: "Recent", Dashboard always first. Kept; redrawn when the menu opens.
- 2026-09-15, shell pieces round 10: the pill's words, 44 px, 12 px text. Kept: same words, 44 px tall, 12 px on two lines.
- 2026-09-15, All pages round 3: "4 pages match 'roth'" and a friendlier no-result card. Kept.
- AGENTS.md: one filled button per screen (the cards: "Find a page" or "Turn it back on" filled), every save confirms
  itself (the "on again" line), plain words, 44 px, no new global CSS outside base.css.

**Choices made where the owner was not asked** (the conservative option each time), for the entry "2026-11-11 wave 1:
taps, menu, top bar, ways back":
1. A "‹" button in the top bar, only when Back stays in the app; none on Get started's questions; no words in it.
2. The pill's words on two short lines under 480 px.
3. A page name of two lines in the bar (three smaller ones under 375 px).
4. "Working it out…" as the waiting words, shown at once only on pages marked heavy.
5. "Page not found" and "<Page> is switched off" cards with their buttons.
6. Named "‹ Back to …" links at the top and above the one way on, for pages opened from Needs attention, Next best action
   or a link with `?back=`; the check-in's back link carried one page further.
7. The guard's limits: 40 px, 0.8 s, a burst ends after 0.8 s of rest; a swallowed tap gives no sign.
8. Find a page keeps autocorrect; the keyboard says "Go"; a new page empties it.
9. Pages not offered in the household's view are "not found" when opened by address.

**Lanes.** Files: `core/taps.js` (new), `core/address.js` (new), `core/app.js`, `core/search.js`, `core/router.js` (the
additions of S4 only), `index.html`, `core/ui/base.css` (`#topbar`, `#page-title`, `#status`, `#nav-back`, `#sidebar`,
`#scrim`, `.nav-*`, `html.drawer-open`, the shared reduced-motion line), `modules/overview/pages/view.js` and README,
`modules/overview/guide/frame.js`, tests (`taps`, `search-words`, `router-replace`, `ways-back`, `address`). No claude-a
page; no `overview/setup/compute.js`, `retirement/projection/compute.js` or estimators; nothing in `core/ui/dom.js`. The
TEAM.md claim of 2026-11-11 names the files; T11 adds the two new core files to it.

**The seams.** Two place designs and two forms designs were written; a judge picks one of each. The table names what this
track needs and gives in both cases (place2 = `w1/place2/final.md`, place = `w1/place/design.md`; forms2 =
`w1/forms2/final.md`, forms = `w1/forms/design.md`).

| # | seam | owner | exact interface | taps uses it for | order |
|---|---|---|---|---|---|
| S1 | entry numbers | place (P1 / S1) | place2: `router.entry()` → `{ v, n, kind, key, first }`, `router.first()`, `router.at(n)` → `{ p, q, via? }`, `router.start(onChange(route, entry))`; place: `history.state.{ n, p }`, `router.entry()` | `entryNow()` → `{ n, first, prevKey, via }`, the only adapter; the "‹" (n > first), its name (prevKey), `ctx.cameFrom()` | place P1 before T5. taps builds no numbering of its own (no `stampEntry`, no `planner.firstEntry`). In a parallel build the taps worktree applies the chosen plan's P1 router verbatim as its starting point and diffs its own work on top, so the integration applies place first and taps cleanly. |
| S2 | layers | place | `router.layer(close)` → `release()`; Back with a layer open calls `close()`; a stale layer entry is stepped off; an address change forgets open layers | the drawer: open calls `layer`, every close path calls `release()`; a row uses S4 | place P1 before T5 |
| S3 | back links | place | place2: one bubble-phase `click` listener for `a[data-back][href^="#/"]` calling `router.back(href)` (Back when that page is just behind, else follow); place: `ctx.back(href, loose)` / frame `backLink` | every "‹ Back to …" the frame draws carries `data-back` (T6); no `ctx.goBack` | place's listener before T6's checks; T6 can land first (links still work as links) |
| S4 | the next entry's kind | taps (T5) | in `core/router.js`: `open(href, { replace, via })`, `replace(href)`, `isReplace(...)` used by the stamp; `via` stored in the trail item | the menu's row (a new entry that replaces the layer), pages that replace their address, "not via the menu" | after P1, in T5 |
| S5 | the top of `show()` | both | order: taps' wrong-case correction → place `leave()` (+ `cancelHold`, echo removal; new address) → `cleanup()` → `current = route` → taps: title, `aria-label`, the search word cleared, Recent, `markActive`, `closeDrawer()` (its `release`), `updateBack()` → place `arrive(entry)` + `scrollTo(rec ? rec.y : 0)` + held height → taps' `missing` card (return) → frame top, guess note, page div → **taps' one-frame wait (new address only)** → forms (design 1 only) `ui.drawStart()` → render | | T7 lands after place's arrival step (P4 in place2), so a return paints at its place, never at the top |
| S6 | the end of `show()` | both | `seq` check → `frame.after` → forms (design 1 only) `ui.afterDraw({ keepScroll })` → new address: place `afterArrive()` → taps `landFocus()` (only when the focus is not already in `#content`) → taps `updateBack()`; a save: place `afterSave()` (its copy decided a frame later) → taps `announce()` of the fresh green notices; `finally { taps.drawn() }` | | either order of landing; the later one adds its lines |
| S7 | scroll calls | place | place2: `wrapScroll(obj, name, hook)` in `core/place.js` (one wrapper of `scrollTo`, `scrollBy`, `scroll`, `scrollIntoView` on window and elements); place: the same wrappers (R13) | `calmScroll` registered as a hook (T8); never a second wrapper | place's wrapper before T8; if the chosen plan has none, T8 installs the single wrapper and place adds its counter to it |
| S8 | read-outs | taps | `announce(text)`: one polite region, the same words within 2 s said once; after a save reads the fresh `.notice.ok` only | place: `echo()` says its words through `announce()` and is not itself a live region (drop `role="status"`, one line in place's `echo()`); forms: red notices are `role="alert"` (G6), so `announce()` skips them | any order |
| S9 | base.css | each its own block | taps: `#topbar`, `#page-title`, `#status`, `#nav-back`, `.nav-skip`, `#sidebar`, `#scrim`, `.nav-*`, `html.drawer-open`; place: `html { overflow-anchor }`, `.save-echo*`, `.place-*`; forms: form, notice, fold blocks. One reduced-motion line `@media (prefers-reduced-motion: reduce) { .save-echo { … } #sidebar, .nav-group-head .chev, .fold .fold-chev, .scroll-hint::after { transition: none } }`, merged by whoever lands second | | |
| S10 | frame.js | taps (named rows, check-in trail, `data-back` on every back link); place2 also adds `data-back` to the same eight links | the same attribute: whoever lands second keeps one | | |
| S11 | nothing moves between a finger's down and its click | forms (G4), place | the kit inserts nothing from `pointerdown` until that gesture's click (or 400 ms); place's redraw runs after the click's task; the copy is `position: fixed` and covers nothing it was not placed to cover | the guard's verdict is taken at `pointerdown` against what was there; place's own "ignore the copy's second tap for 700 ms" is redundant with M1 and may go | |
| S12 | Enter twice; errors read out; kit chevrons | forms (G5, G6, G7) | `ui.form` ignores a submit within 1 s (forms2) or 800 ms (forms) of one that went through; `role="alert"` on `ui.notice("error")` and `.form-error`; the reduced-motion line | D-TWICE's Enter half; K5's errors; HC-5's chevrons | any order |
| S13 | the kit's listeners first | forms (N5) | installed when `core/ui/dom.js` is imported (before `app.js` runs) | the guard's capture listeners come after; a swallowed tap gives the kit no click | |

**Who changes which function** (so three builders never edit the same lines):

| file | taps changes | place changes | forms changes |
|---|---|---|---|
| `core/app.js` | `buildNav`, `searchBox`, `markActive`, `setToggleIcon`, `paintDrawer`, `openDrawer`, `closeDrawer`, `toggleDrawer`, `openFromMenu`, `openSearch`, `updateBack`, `entryNow`, `missingCard`, `landFocus`, `focusQuietly`, `announce`, `busy`, `afterPaint`, `makeCtx` (`computeRemote`, `derived`, `cameFrom`, `replace`), the guard install, boot wiring of the menu, Escape, skip and "‹"; in `show()` the lines of S5/S6 marked taps | `show()`'s leave/arrive/scroll/held height/keepScroll branch/afterArrive/afterSave, `echo()` (and its one-line S8 change), `installBackLinks()`, `makeCtx().layer`, `showConflict()`'s `cancelHold()`, place boot lines | nothing (forms design 1: the `drawStart`/`afterDraw` calls of S5/S6) |
| `core/router.js` | `open`, `replace`, `isReplace` and its call in the stamp (S4) | everything else | nothing |
| `core/taps.js`, `core/address.js` | all (new) | nothing | nothing |
| `core/search.js` | `matchScore`, `aliasHit`, `hasWords`, PLAIN additions | nothing | nothing |
| `core/ui/dom.js` | nothing | nothing | everything |
| `modules/overview/guide/frame.js` | `namedBack`, `HUBS`, the named rows, the check-in trail, `data-back` | `data-back` (same attribute) | nothing |
| `modules/overview/pages/view.js` | the card's ranking, the address write | nothing | nothing |
| `index.html` | the top bar's buttons | nothing | nothing |

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (36 findings)

| finding | theme | outcome |
|---|---|---|
| j-fat-fingers/x-1 | SH-TAP | closed by B1 (M1); "the confirmation in view after a save" is the place track's (SH-REDRAW) |
| j-first-retiree/R1 | SH-TAP | closed by B1 (M1), including the 800 ms "Use this one" case (window 800 ms, case I of `t1-dbl` at 800 ms) |
| j-heavy-waiting/W2 | SH-TAP | closed by B3 (M2, M1 stale incl. `computeRemote`); the freeze's length to wave 2 (section 3) |
| j-navigator/x-3 | SH-TAP | closed by B3 and B1 (M2, M1, M3's list rebuilt on open); the freeze's length to wave 2 |
| p-debt-property/x-4 | SH-TAP | closed by B1 (M1) |
| p-retirement-a/x-1 | SH-TAP | closed by B1 (M1), also for three and four taps (burst) |
| p-cashflow-a/x-2 | SH-TAP | closed by B1 (M1); "12 envelopes added" out of view is the place track's |
| p-overview-home/x-3 | SH-TAP | closed by B1 (M1); the page-level confirmation-in-place declined (not needed for the wrong landing) |
| p-overview-path/x-1 | SH-TAP | closed by B1 (M1) |
| p-taxes/x-2 | SH-TAP | closed by B1 (M1) |
| j-hard-conditions/x-3 | SH-TAP | closed by B1 (M1); the setup-only `pointer-events` fix declined as redundant |
| p-career-household-system/x-5 | SH-TAP | closed by B1 (M1) |
| j-hard-conditions/HC-1 | SH-SEARCH | closed by B4 (M3) |
| j-heavy-waiting/x-1 | SH-SEARCH | closed by B4 (M3) |
| j-keyboard-reader/K1 | SH-SEARCH | closed by B4 (M3) |
| j-navigator/x-1 | SH-SEARCH | closed by B4 (M3) |
| j-one-answer/x-1 | SH-SEARCH | closed by B4 and B5 (M3); "retire" lists Will the money last? first (M4) |
| p-overview-path/OP-1 | SH-SEARCH | closed by B4 (M3) |
| p-retirement-c-scenarios/x-search-backwards | SH-SEARCH | closed by B4 (M3) |
| j-navigator/N4 | SH-SEARCH | closed by B5 (M3) |
| j-navigator/N5 | SH-SEARCH | closed by B6 (menu) and B7 (All pages' "Best match" card) (M4) |
| p-career-household-system/x-3 | SH-SEARCH | closed by B6 (PLAIN); menu names vs headings to the designer (section 3) |
| p-overview-home/x-2 | SH-SEARCH | closed by B7: the address half on the branch (6378c08), the order half by M4 |
| j-keyboard-reader/K2 | SH-MENU | closed by B11 (M5, skip button) |
| j-keyboard-reader/K3 | SH-MENU | closed by B9 (Escape) and B11 (M5) |
| j-keyboard-reader/K6 | SH-MENU | closed by B12 (M10) and B11; the bar as an `h1` declined (two h1s on hero pages; T-HEAD allows h2 first); the name read by a real screen reader is owner check 7 |
| j-navigator/N3 | SH-MENU | closed by B9 (M5 with the place track's layer) |
| j-navigator/x-4 | SH-MENU | closed by B10 (M5) |
| j-hard-conditions/HC-5 | SH-MENU | closed by B13 (M5 CSS, M10 hook); the kit's chevrons by the forms track (G7) |
| j-keyboard-reader/K5 | SH-MENU | closed by B12: green lines by `announce()` (M10), red ones by the kit's `role="alert"` (G6) |
| j-hard-conditions/x-2 | SH-TOPBAR | closed by B14 (M8) |
| p-taxes/T8 | SH-TOPBAR | closed by B14 (M8); the rename of taxes/documents declined (claude-a's page, and its name now fits) |
| j-navigator/N2 | SH-ADDR | closed by B15 (M9) |
| j-monthly-return/MR-4 | SH-WAYBACK | closed by B16 and B17 (M6, M7): the hubs' named rows top and bottom, and the check-in trail one page further |
| j-navigator/x-5 | SH-WAYBACK | closed by B16 (M6) |
| j-one-answer/A3 | SH-WAYBACK | partly in wave 1: the bar's "‹" named "Back to <answer>" on every page; the named rows top and bottom once the six cards pass `?back=` (section 3, one attribute each); "Do something else" on guides to wave 2 |

---------------------------------------------------------------------------------------------------------------------

## 9. Answers to the critics

### Break critic (`critique-break.md`)

- **X1 (blocking). Paint-first turned the guard off on the heaviest pages.** *Changed.* `computeRemote` calls
  `taps.drawn()` when its local calculation returns (and when the computer answers), sets `#content[aria-busy]` while it
  works, and a tap handed over in the frame after a frozen draw is *stale* whatever its time (`settling`). Evidence
  **[fin]** `fs/break/c2-late.mjs` at CPU 8x, gaps 800 / 1,000 / 1,150 ms: 3 of 3 swallowed as stale (first draft 0 of 3).
  Owner check 5 is now Plan health score, tapping the empty area while it works.
- **X2 (blocking). A picker that saves on change could not be tapped again.** *Changed.* A box or picker is never a
  "repeat"; a trusted `change`, `input` or `keydown` more than 150 ms after a tap forgets it; a field's signature carries
  its `id` and `aria-label`. Evidence **[fin]** `fs/break/c5-select.mjs` at 300, 400, 600 ms: 0 of 3 swallowed, the picker
  takes the focus (first draft 2 of 2 swallowed). The same rules cover the categorize rows; `t2-allowed` gains the case.
- **X3 (blocking). The "‹" showed on the first page after an address replace.** *Changed.* `router.replace()` for pages
  (wave 2 adoption), `router.open()` for the menu, and the pure safety net `isReplace()` in the stamp. Evidence **[fin]**
  `fs/break/c6b-replace.mjs` (family, ruth): n stays 1 after the question's own ‹, the "‹" stays hidden; after a link,
  "Back to Set up my plan" goes back to the question, where the "‹" is hidden. Also: no "‹" on Get started's questions
  (S1) and none when the history has one entry.
- **S1. Two "‹" on every question.** *Taken*: `OWN_BACK` hides the bar's on `overview/setup`.
- **S2. The household's view still opened "soon", builder and AI pages by address.** *Taken* (M9): "Page not found".
- **S3. A yield computed pages already gone.** *Taken*: `computeRemote` returns a never-settling promise when `seq` moved.
- **S4. All pages wrote the address on every key.** *Taken*: written after 400 ms of rest, on `change`, and on a result
  tap; the timer is cleared when the page is left.
- **S5. "budget" listed Expenses before Budget; "care" lost Medicare.** *Taken*: a name that is the query 0, a phrase that
  is the query 0.1; "health care" in PLAIN. **[fin]** "budget": Budget, Expenses, Budget (50/30/20).
- **S6. *stale* trusts `event.timeStamp`.** *Taken*: the `settling` test does not depend on it; owner check 5 is the gate.
- **S7. Two hangs on reload with the menu open.** Not reproduced by the critic afterwards (0 of 12) nor with the menu off
  (0 of 7). *Kept as a risk* with a check (20 reloads with network latency before landing) and a named fallback (step off
  the stale entry after the first draw).
- **S8. Owner checks.** *Taken*: "morgage" then Go (check 2); keyboard up then close (check 3). Pull to refresh with the
  menu open: declined as a check (a home-screen app has none; in Safari it reloads, which S7's check covers).
- Held up: two removals with a confirm in between; Get started walked by Continue; the menu's entry; addresses. *Memory*:
  no node kept in the remembered tap now; `window.__swallowed` only in the sandbox.

### Person critic (`critique-person.md`)

- **P1 (blocking). The way back was only at the top.** *Changed.* The named link is drawn again at the bottom, in its own
  quiet row just above the one way on, wherever a named row is drawn (hubs and `?back=`). This follows the frame's own
  "‹ Back to your plan" under "Next result" and T-ONE-WAY's rule that ‹ links are not ways on; the first draft's reading
  that the 2026-11-06 rule forbids it was wrong. The bar's "‹" is also always on screen (the bar is sticky). Evidence
  **[fin]** `fs/ways.mjs` W1 and `fs/shots/ways-alert-bottom.png`. A3's own walk (Will the money last? > People) gets the
  rows once its card passes `?back=` (section 3).
- **P2 (blocking). The menu kept an old search word.** *Changed*: a new address empties it. **[fin]**
  `fs/person/j-search2.mjs`: the box is empty with Recent first.
- **P3 (blocking). A thumb that kept tapping ended on another page.** *Changed*: a swallowed tap restarts the window.
  **[fin]** `fs/person/j-taps.mjs`: four taps at 350 and 450 ms on Income, at 400 ms on Contributions: three swallowed
  each, one row, no form, the page kept.
- **S1. "Saved on your computer" on three lines.** *Taken*: the pill up to 124 px (112 at 320). **[fin]** `fs/bar.mjs`: at
  most 2 lines in all 16 combinations, 0 names cut.
- **S2. Go on "budget" opened Expenses.** *Taken* (as breaker S5). The two "Emergency fund" pages: to the designer.
- **S3. Back lands at the top of the list.** *Taken by the seam*: the scroll is the place track's (D-BACK's scroll part);
  the claim "same place on that page" is made only for the merged build and checked there by `ways.mjs` W1 with its
  scroll reading.
- **S4. Switched-off card wording and confirmation.** *Taken*: words by where it was switched off, "<Page> is on again.".
- **S5. One name for a missing page.** *Taken*: "Page not found" in the bar and on the card; "This link leads to a page that
  is not in the app."
- **S6. The "‹"'s spoken name.** *Taken*: the page's own row's words first; never "Back to" the page on screen.
- **S7. The title jumped when the menu opened.** *Taken*: the "‹" is kept in place, `visibility: hidden`.
- **S8a. Corner reach.** *Kept, with a check*: the menu button keeps the corner the owner's thumb has used for two months;
  a near miss on it only opens the menu (Back closes it), while a near miss on "‹" in a home-screen app cannot be undone.
  Owner check 6 asks. **S8b**: in check 4.

### Scope critic (`critique-scope.md`)

- **1 (blocking). Measured on c385e41; All pages had changed.** *Changed.* The final prototype is a `git archive` of the
  tip c6fb730, the All pages part rebased on 6378c08 (claude-f's `?q=` and card kept; the card ranked by `matchScore`; the
  first draft's own `replaceState`/`route.query.q` dropped). **[fin]** `fs/rank.mjs` table; a WORKBOARD line to claude-f
  is part of T11.
- **2 (blocking). The named row duplicated `?back=` and drew on 34 pages.** *Changed*: `?back=` is the first source, the
  two hubs MR-4 names the second, Your plan's rows and the other answers none; `namedBack()` is pure and node-tested; the
  links carry `data-back` for the place track's one listener. The helper lives in `frame.js` (claude-f holds
  `guide/**` except `frame.js`), which imports cleanly in Node.
- **3 (blocking). History, back links, scroll wrappers and read-outs left to whoever lands first.** *Changed*: section 7
  names one owner per function: place owns the numbering, layers, back links and the one scroll wrapper; taps adds only
  `open`/`replace`/`isReplace` to the router, consumes the numbering through one adapter, hooks the wrapper, owns
  `announce()` (deduplicated, green only) and asks place's `echo()` not to be a live region; forms reads red notices; one
  back API (no `ctx.goBack`). The parallel build applies the chosen place plan's P1 as the taps worktree's start.
- **4 (blocking). `npm test` failed: Help's search order.** *Changed*: a phrase word found only by its stem is not a
  name-level hit. **[fin]** `modules/system/help/module.test.mjs` 8 of 8 unchanged, `search` 12 and `search-words` 6 pass;
  T3 ends with `npm test` and lists Help's test among its checks.
- **S1. Coverage.** R1's 800 ms case: *taken* (window 800 ms; `t2-allowed` 0 of 11 with it). HC-5's kit chevrons: forms2
  takes them (G7) and so does forms (its reduced-motion item); the shared line is in seam S9. MR-4's check-in part: built
  and measured (W4). x-2 and N5 on All pages: rebased (above). A3's bottom: built (P1 above); A3 is marked "partly" until
  the cards pass `?back=`. x-1's "confirmation in view": the row now says it is the place track's. K6's read-out: owner
  check 7.
- **S2. "Working it out…" on every page with `role=status`.** *Taken*: silent and `aria-hidden` unless heavy;
  `planner.slowPages` dropped; the sweep asked to require visibility.
- **S3. Permanent checks.** *Taken*: T11 lands the scripts as `qa/shell-*.mjs`; only D-TWICE, D-BACK (address), D-TOP,
  T-TARGET, T-NAME, D-TIME (b) via `aria-busy` and D-ANSWERS are claimed; T-HEAD is not.
- **S4. Lanes and docs.** *Taken*: TEAM claim gains `core/taps.js` and `core/address.js`; CONVENTIONS lines listed in T11;
  claude-d's people guard in T2; claude-f's "retire" (held), "retire at" (PLAIN) answered; the step name in the frame's bar
  is declined here (optional, and the step card already says it).
- **S5. Switched-off wording.** *Taken* (by `sourceOf`).
- **S6. The skip link read as an address.** *Taken*: a button.
- **S7. Owner checks.** Quick answers' "Not here? Search by a word" raising the keyboard: `openSearch()` focuses the box in
  the tap's own task; the menu's entry no longer makes a re-open wait (the layer is the router's), so the focus stays in the
  gesture; added to check 2's run. "Debts opened from Pay off debts shows exactly one way back": W2 counts it; one named
  link plus the bar's "‹" is the design (section 2 M7).

---------------------------------------------------------------------------------------------------------------------

## Final numbers

Everything below was measured on fin (c6fb730 + this design), Chromium, 390 x 844 touch, sandbox, before the server
was stopped. Raw output in `$SP/w1/taps/fs/out*` and `$SP/w1/taps/fs/out/`.

| check | before (tip or first draft) | final prototype |
|---|---|---|
| double taps, 16 cases x 5 gaps up to 800 ms (`t1-dbl`) | old shell 64 of 64 did something (four gaps) | **0 of 80** |
| meant taps (`t2-allowed`, 11 checks, 800 ms window) | first draft 0 of 11 lost (700 ms) | **0 of 11 lost** |
| late tap during a page's own calculation, CPU 8x (`c2-late`, breaker X1) | first draft 0 of 3 swallowed | **3 of 3 swallowed (stale)**, still on Goal seek |
| picker changed then tapped again (`c5-select`, breaker X2) | first draft 2 of 2 swallowed | **0 of 3 swallowed**, picker focused |
| four taps on one spot (`j-taps`, person P3) | first draft: 4th tap landed, form reopened / left the page | **3 of 3 later taps swallowed**, one row, page kept |
| replace on the first page (`c6b-replace`, breaker X3) | first draft n=2, "‹" to about:blank | **n stays 1, "‹" hidden**; after a link, "‹" returns to the question |
| menu word after a new page (`j-search2`, person P2) | first draft "social" kept | **box empty**, Recent first |
| menu ranking (`rank.mjs`) | "budget" Expenses first, "car" Vehicles 8th, "retire at 62" Social Security only | **Budget, Vehicles, Will the money last? first**; "health care" finds both health pages |
| top bar (`bar.mjs`, 149 names x 16 combinations) | first draft: "Saved on your computer" on 3 lines | **0 names cut, pill ≤ 2 lines in all 16** |
| ways back (`ways.mjs` W1 to W5) | tip: no "‹", no named row at the bottom | **named top and bottom on the hubs and `?back=`; bottom link = Back; menu page bar-only; check-in row carried; double tap on "‹" = one page** |
| a Back, then the next link (found by W1 during this run) | rows 2 and 3 opened with no "‹" | **fixed** (`traversed` kept until a new entry) |
| node: taps, ways-back, search, search-words, Help, All pages | Help test 7 failed on the first draft | **40 of 40 pass** |
| `npm test` on fin | | **0 failed**, 188,633 passed, 639 todo, 3 skipped |

Not re-measured on fin (mechanism unchanged since the first draft, [proto] figures stand): paint first (`m2-paint`), the
drawer (`m4-menu`, `m4b-swipes`), the addresses (`m6-ways` A1 to A4; the words and the not-offered rule changed, so T10
re-runs them), focus and read-outs (census). The build re-runs every one of them (section 6).
