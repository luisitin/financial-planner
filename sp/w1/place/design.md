# Wave 1, track "place": place and typing memory

Themes: SH-BACK (19 findings), SH-DRAFT (21), SH-REDRAW (12). One root: the shell throws the page away and draws it
again (core/app.js show(): `root.innerHTML = ""` on every address change and, 50 ms after every store.update, on the
same page). This design keeps what a person would lose and puts it back after the page has drawn, in the shell, so
almost no page has to change.

Prototype: worktree `proto/` (at 6fc5299, detached; differs from c385e41 only in docs), uncommitted:
`core/place.js` (new, about 470 lines), `core/router.js`, `core/app.js`, `core/ui/base.css` (shell selectors only),
`modules/overview/guide/frame.js`. Prototype switches in the address: `?place=off` (today's app), `?place=nolive`
(no kept pages), `?place=nodefer`, `?place=anchor` (browser scroll anchoring left on). `window.__placeLog` is a
measurement probe; the build drops both (step S10).

Measurement scripts (this folder; each opens a fresh phone-sized Chromium per scenario, 390 x 844, touch, real drags
with `touchscreen` swipes and taps at screen coordinates, keys one at a time; `?sandbox=1` always):
`m-back.mjs <fix|nolive|off> <cpu slowdown>`, `m-redraw.mjs`, `m-draft.mjs`, `m-local.mjs`, `m-links.mjs`,
`loc-census-dbg.mjs <household> [perturb]`, `dbg-setup.mjs`, `dbg-change.mjs`, `dbg-buckets.mjs`. They read the app
through `lib.mjs` (the prototype served by `node serve.mjs` on 127.0.0.1:9311) or `lib-dbg.mjs` (a scratch copy,
`dbgapp/`, on 9318); both servers are stopped now, start them again to re-run. Results in `results/`: the final runs
are `final.log` (Back suite, links, local) and `final2.log` (typing, redraw and local again after the last fix to the
save rule), the json files beside them, the touch sweep in `sweep-today.*` and `sweep-proto.*`; earlier runs in
`results/v2/`. Households: family, ruth (retired widow), renterDebt, freelancer, patLee (couple near retirement),
empty and samMidSetup (the touch sweep's own: family, widow, renter).

---------------------------------------------------------------------------------------------------------------------

## 1. Behavior (the acceptance test)

Each item: what the person does, what they see after the fix, the findings it closes, and the check that proves it
(script and scenario, and the permanent touch rule in `$SP/wtouch/qa/touch-rules.json` it turns green).

The permanent touch check, run on today's app (c385e41) and on the prototype with the same pages and households
(`qa/touch-sweep.mjs` copied from `$SP/wtouch` into `today-sweep/` and `proto-sweep/`; 18 pages named in the findings x
family, widow, renter; rules D-BACK, D-SCROLL-KEPT, D-SEEN, D-FOCUS-KEPT, D-TOP; `results/sweep-*.log|json`):

| rule | today: checked, breaks | prototype: checked, breaks |
|---|---|---|
| D-BACK | 240, 29 (23 place lost, 6 section shut) | 240, **0** |
| D-SCROLL-KEPT | 214, 16 (13 moved under the finger, 3 jumped away) | 227, 6 (see below) |
| D-SEEN | 114, 4 (3 no confirmation, 1 off screen) | 121, 7 (see below) |
| D-FOCUS-KEPT | 187, 0 | 187, 0 |
| D-TOP | 240, 0 | 240, 0 |

The 6 D-SCROLL-KEPT left are the rule's arithmetic, not a move: each reads "after the tap it sits **0 px** higher
(110 to 155 px of that is the confirmation above it)"; the rule subtracts the room of a confirmation drawn above the
button even when the button did not move (`touch-sweep.mjs` line 305, `Math.abs(moved - room) > 60`). The 7 D-SEEN
left are Save settings (Will the money last?) and Save figures / Save deductions (Federal estimate) with every section
open: the box typed in sits more than a screen above its Save button, the button stays under the finger (D-SCROLL-KEPT)
and the confirmation is read at the bottom, so the rule's "what was typed is in view" and "the button did not move"
cannot both hold. Both go to the touch-check track (section 4, R14). Every built page (159) was also opened and
stepped back through with the prototype for family and renterDebt: 0 page errors (`all-pages.mjs`).

**B1. Back and Forward put me back where I was.** I scroll down a long page, open a section, tap a link (or a menu
row) and read a little of the other page. I press the phone's Back: the first page is there at the same spot, the
section I opened is still open, and the link I tapped sits under my thumb where it was. Forward takes me to the other
page at the spot I left it. Pressing Back twice and Forward again behaves the same every time, however slowly the
page draws.
Closes: j-first-family/x-1, j-first-freelancer/x-2, j-first-retiree/x-1, j-heavy-waiting/W1,
j-monthly-return/x-back-top, j-navigator/N1 (Back and Forward), p-career-household-system/F1, p-cashflow-a/x-1,
p-insurance-estate/IE-1, p-overview-home/OV-1, p-retirement-a/R-A2, p-retirement-b/x-2,
p-retirement-c-scenarios/x-back-loses-place, p-taxes/x-1, j-first-renter/x-3, j-one-answer/A5, p-overview-path/x-2.
Check: `m-back.mjs fix 1` and `m-back.mjs fix 4`: Back at the same spot (within 2 px) on every trip that left the
page, the opened section open 5/5, Forward at its spot; touch rule **D-BACK**.

**B2. A new page starts at its top.** A link, a menu row, a search result, Next or "Continue your plan" opens the
next page at its top with its title in the bar, even if I was on that page before (a new visit is not a Back).
Closes: none (guards today's right behavior). Check: touch rule **D-TOP**; `m-back.mjs` "midAt" column (185 = the
reading swipe from 0).

**B3. A reload keeps my place and my typing.** The page reloads (I pull to refresh, the phone dropped the tab and
reloads it when I come back, or the app repairs itself with its one reload): same page, same spot, same open sections,
and the boxes I had typed in hold what I typed with "Not saved yet. Undo my typing" beside the form's button. On a
Get started question the boxes I typed are refilled and Continue saves them.
Closes: j-navigator/N1 (Reload), j-first-family/F2, j-first-renter/x-4, j-monthly-return/x-typed-lost (reload),
j-navigator/x-2 (reload). Check: `m-back.mjs` reload columns; `m-draft.mjs` "update-reload"; `dbg-setup.mjs`.

**B4. The page's own "Back to ..." links work like the phone's Back.** "‹ Back to the November check-in", "‹ Quick
answers" / "Back to quick answers", "‹ Your plan" / "Back to your plan", "‹ Back to the guide: ..." and "‹ Back to:
<answer>" take me back to the page I came from at the spot I left it, and do not add a step: the phone's Back after
them goes to where I was before that page, not into the page I just left. When the page they name is not the one I
came from (I opened the page from a bookmark or the menu), they open it as an ordinary link.
Closes: j-monthly-return/x-backlink-history, j-one-answer/x-4, j-navigator/N1 (the on-screen "‹ Your plan").
Check: `m-links.mjs fix`: history does not grow, the spot after the link equals the spot at the tap, the phone's Back
then reaches the Dashboard.

**B5. What I typed and did not save waits for me.** I type in a form (an add form, an edit form, Update my balances,
a tax figure) and leave without saving: by the menu, a link, "Continue your plan", a step link, the status pill or
the phone's Back. When I come back (Back, Forward, the same link or the menu again, within a day, in this tab) the
form is open with my typing in it and "Not saved yet. Undo my typing" beside its button. Save saves it as usual and
the words go; "Undo my typing" puts back what the page had and the words go; Cancel throws it away as today.
Closes: p-taxes/T1 (c), j-monthly-return/x-typed-lost, j-navigator/x-2, p-balance/B1, p-cashflow-b-goals/x-3,
p-debt-property/x-3 (the typing), p-insurance-estate/IE-9, p-retirement-a/x-2,
p-retirement-c-scenarios/x-half-typed-form-lost, p-career-household-system/F2, p-cashflow-a/CF-2,
p-investments/INV-4, j-fat-fingers/FF2 (leaving), j-debt-fixer/x-2 (the typing).
Check: `m-draft.mjs fix` and `m-draft.mjs nolive`: income-add-menu-back, update-continue-back,
debts-form-back-forward.

**B6. If the form is shut when I come back, I am told my typing is kept.** When my typing belongs to a form the page
does not open by itself (an edit form opened by tapping a row, an add form behind "+ Add another ..."), a short note
appears at the bottom once: "We kept what you typed in “Add an income”. It is not saved yet: it comes back when you
open it again." Opening the form brings the typing back with "Not saved yet.". If the saved figures of that form
changed in the meantime (I saved the same row elsewhere), the old typing is let go instead of being poured into new
figures.
Closes: the "without a word" part of j-fat-fingers/FF2, p-cashflow-a/CF-2, p-investments/INV-4,
p-debt-property/x-3. Check: `m-draft.mjs nolive` income-add-menu-back (cue, then refill on reopening).

**B7. A stray tap on another row does not throw my typing away.** I am changing Ana's salary, my thumb lands on Bo's
row and his form opens instead: a note says my typing in Ana's form is kept; tapping Ana's row again shows my figure.
Closes: j-fat-fingers/FF2 (the row part). Check: `m-draft.mjs` income-stray-row.

**B8. Saving one part of a page keeps my typing in another part.** I type in one form, then save another form or
tick a box elsewhere on the page: the green "Saved." is about what was saved, my other typing is still in its boxes,
its section is open and "Not saved yet." sits beside its button.
Closes: p-insurance-estate/x-1, p-taxes/T1 (a, b, d, e), p-balance/x-1, p-career-household-system/x-1.
Check: `m-draft.mjs` health-two-forms, estimated-two-forms; `m-redraw.mjs` estimated-two-forms, federal-two-folds,
accounts-note-then-balance; `m-local.mjs` capital-gains-chip.

**B9. After a save or a choice, the page stays still under my thumb.** I save inside a section, change a setting
that works the answer out again, tap "Use this one" or a chip: the sections I opened stay open, the button I tapped
stays where it was on the screen (or, if it went away with its form, the heading of its section does), and the box I
was typing in keeps the focus with the cursor where it was. This holds whether the shell redraws the page or the page
redraws itself (Chance the money lasts, Stress tests, Capital gains chips).
Closes: j-first-freelancer/x-1, j-debt-fixer/x-3, p-retirement-b/RB1 (the fold), j-one-answer/x-2 and
p-retirement-a/R-A4 (the fold and the 1,200 px jump), j-heavy-waiting/W4 (the fold), p-retirement-b/x-1 (the first
jump). Check: `m-redraw.mjs fix` (the tapped button moved 0 to 2 px in the 7 saves that keep it; in the 8th the page folds its section away and the section heading stays put), `m-local.mjs fix`; touch rules
**D-SCROLL-KEPT** and **D-FOCUS-KEPT**.

**B10. I can read the confirmation where I am looking, with one way on.** When the page's green (or red) notice is
on my screen and readable, that is all. When it is above the screen, under the top bar or inside a section that is
shut, a short copy appears at the bottom of the screen (at the top when the bottom would cover what I just tapped),
with the notice's own link as a 44 px row ("See net worth ›"); on a page I opened from the monthly check-in the link
is "‹ Back to the November check-in". It stays 4 to 12 seconds depending on its length, does not move the page, and a
second tap of a double tap does not follow its link.
Closes: j-monthly-return/MR-1, p-balance/B2, p-taxes/x-5, and the "no saved on screen" part of j-one-answer/x-2,
p-retirement-a/R-A4, p-retirement-b/RB1. Check: `m-redraw.mjs` "echo" column; touch rule **D-SEEN**.

**B11. Nothing on the page moves by itself.** A green confirmation that a page takes away after 4 seconds stays until
I leave or the page is drawn again, so the rows under it never jump while my thumb is on the way.
Closes: j-first-retiree/x-2, p-transactions-helpers/x-notice-jump, p-retirement-b/x-1 (the second jump).
Check: `m-redraw.mjs` withdrawal-use-this "later" column (0 px after 5 s, notice put back).

**B12. The phone's Back closes the menu.** With the menu open, Back closes it and leaves me on the page at my spot; a
second Back goes to the page before.
Closes: j-fat-fingers/x-2 (the menu). The edit-form part of j-fat-fingers/x-2, j-debt-fixer/x-2 and p-cashflow-a/CF-3
needs each list page to say "this form is open" (section 3, A1). Check: `m-links.mjs` menu-back.

**B13. The page waits while I type.** A box that saves when I leave it (and I leave it by tapping the next box) does
not redraw the page under the box I am now typing in; the page is brought up to date when I leave that box too.
Closes: supports p-balance/x-1 and D-FOCUS-KEPT on the few pages that save on blur. Check: touch rule **D-FOCUS-KEPT**.

**B14. My typing stays private and apart.** Typing is kept only in this browser tab (not in the plan, not on the PC,
not in another tab), for a day at most; boxes for passwords, keys and tokens are never kept; the pretend plan
(`?sandbox=1`) and the real plan keep separate memories. Closes: none (a guard). Check: section 6, S5 node tests.

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

Eight mechanisms in one new file (`core/place.js`) plus small changes to `core/router.js`, `core/app.js`,
`core/ui/base.css` (shell selectors) and `modules/overview/guide/frame.js`. No page changes for B1 to B11 and B13.

### The locator (the heart of it): `core/place.js` keyOf(), locOf(), locate()

How the same section, box or button is found again in a page drawn from scratch.
- A key per element, free of figures: a section (`details`) is its title (`.fold-title`, or the summary without its
  status words, pills and figures); a box is tag + type + name + its label; a button, link, row or heading is its
  tag + its words with every figure replaced by `#` (so "Store card $1,201" and "Store card $1,202" are the same).
- Where it sits: the nearest section or card heading around it (`sectOf`) and the list row it is in (`rowOf`, words
  without figures).
- Which one among equals: its index among elements with the same key, section and row, and among all with the key.
- Finding it again, most certain first: same key + section + row and the same count ("exact"); the only one with
  that key in that section ("section"); same index among all with the key when the count is unchanged ("order");
  the only one in the page ("only"); otherwise **unsure: nothing is returned**, and the caller falls back to the next
  locator it holds (the tap anchor keeps a chain of three: the button, its row or section, the card heading) and
  finally to the plain scroll position. It never guesses.

Measured (`loc-census-dbg.mjs`, every built page at this tip: 159, builder-only and PC pages included; the rest of
the app's 161 are placeholders. Each page drawn, every section/box/button located, then the page drawn again; ground
truth: with equal counts element i before is element i after):

| run | sections found, wrong | boxes found, wrong | buttons/links/rows found, unsure, wrong | same form recognised |
|---|---|---|---|---|
| family, same plan redrawn | 392/392, 0 | 731/731, 0 | 2,367/2,367, 0, 0 | 87/87 |
| family, a real change* | 392/392, 0 | 744/744, 0 | 2,367/2,622 (90.3%), 255, 0 | 84/86 |
| ruth, a real change* | 357/357, 0 | 600/600, 0 | 2,143/2,251 (95.2%), 108, 0 | 63/64 |
| renterDebt, a real change* | 381/381, 0 | 686/686, 0 | 2,264/2,422 (93.5%), 158, 0 | 76/77 |

\* every balance +1 and one more row in incomes, expenses, accounts, debts and goals: figures in titles and rows
change and lists grow, so order alone would point at the wrong element. "Wrong" counts the 154 to 158 pages per run
whose counts did not change; on the 1 to 5 pages where a list grew, 11 of 2,604 found anchors read differently after
(a figure in their words changed, or a wrong pick): at most 0.2%. The ruth and renterDebt "same plan" runs from the
first census (150 pages, older locator) were also 100% with 0 wrong. The 4 forms not recognised after a real change
are forms whose saved figures changed: by design their old typing is not poured into new figures (B6).

### M1. Numbered history entries: `core/router.js` sync(), entry(), back(), layer()

- Keeps: `history.state = { ...state, n, l, p }` on every entry: n = entry number in this tab, p = the entry before
  it, l = 1 for an entry that only stands for something open on top (the menu). Spreads the existing state, so Get
  started's `suFrom` is kept. Numbers continue after a reload from the highest number in the place records.
- Tells the shell what happened: `nav = { kind: "new" | "back" | "forward" | "reload", n, from: { n, href } }` (back
  and forward from comparing n; reload when the first draw finds a numbered state).
- Sets `history.scrollRestoration = "manual"` (the shell restores; the browser's own restore raced the page's drawing:
  the walkers' 15 of 24 "lands at the top").
- `router.back(href, prevHref, loose)`: when the entry just before this one is the page `href` names (same page, and
  every query key of the link equal, except keys in `loose` that the entry before lacks), it calls `history.back()`
  and returns true; otherwise false and the link is followed. The check-in link passes `loose = ["month"]`: the
  check-in opened without `?month` shows the month the person was on, which is the month the step link carried.
- `router.layer(close)`: pushes an `l: 1` entry; the phone's Back pops it and calls close(); closing by hand steps off
  the entry quietly. Used for the menu (B12); offered to pages as `ctx.layer` (section 3, A1).
- Fit: show(route) gets `nav`; heal.js's one reload keeps `history.state`, so it arrives as kind "reload"; the sandbox
  changes nothing here. Safari limits `replaceState` to 100 calls per 30 s: the router calls it once per new entry
  only, never on scroll (the scroll lives in sessionStorage, M2).
- Weighed: keying the memory by address alone (no numbers). Lost: the same address visited twice in a row (Dashboard,
  page, Dashboard) and "Back" vs "a new link to the same page" cannot be told apart, so B2 and B1 conflict.
- Measured: no Back, Forward or Reload in the final runs was drawn as a new visit (that would land at 0); every miss
  in M3's table is explained there.

### M2. A place record per entry, put back after the page has drawn: `place.note/leave/arrive/hold`, app.js drawPage()

- Keeps, per entry n: `{ href, y, folds the person opened or shut, tap: [up to 3 locators + where each sat on the
  screen] }`. Written when the page is left (start of the next drawPage, with the address it had), 150 ms after the
  scroll stops, on `pagehide`; mirrored to `sessionStorage["planner.place"]` (`.sandbox` for the pretend plan), at
  most 60 entries, entries after a new one are dropped (they can no longer be reached by Forward).
- Back, Forward, Reload: before drawing, #content gets `min-height = y + screen height` so the spot exists; after the
  page renders, the folds are reopened, typing refilled (M5), and the screen placed so the tapped link sits where it
  sat (else at y). Then **hold**: while the page keeps growing (late answers, the PC, charts: ResizeObserver and
  MutationObserver), the spot is put back again; the hold stops at the person's first touch, wheel, key or mouse
  press, when the page has been quiet 700 ms at the spot with no borrowed height, or after 8 s. One hold at a time;
  a new visit stops it.
- New entries start at 0 (B2) and get no hold, so a page that scrolls itself on a new visit to a part it means to
  show still does. On Back, Forward and Reload the record wins: it is where the person was.
- Fit: drawPage's existing order (title, markActive, closeDrawer, scrollTo) is kept; renderSeq guards every late step
  (a newer page takes over: the hold is stopped by visit()). Late-drawing and heavy pages are what the hold is for.
- Weighed: (a) the browser's own restoration (today): lost, it races the drawing (Chromium here: 15/17 at x1 and x4,
  never the sections, never on reload; the walkers saw 15/24 at the top). (b) the opened sections in history.state
  (A5's proposal): lost to sessionStorage keyed by n because Safari's replaceState limit and because a reload of a
  dropped tab must find them too.
- Measured: see M3 (the "nolive" rows are M2 alone).

### M3. Kept pages for Back and Forward: `place.park/unpark/stale`, app.js drawPage()

- Keeps: the page's own nodes (detached, not drawn again) for the entry being left, when the page had finished
  drawing (`settledSeq === renderSeq`), returned no cleanup function (no timers or window listeners to restart), and
  no module failed to load. At most 4 pages, 15 minutes each, only while nothing it shows may have changed: an
  "epoch" goes up on every store.update and on `planner:view`, `planner:live`, `planner:features`,
  `planner:connection`, and a kept page from an older epoch is thrown away (M2 draws it instead).
- Back/Forward (not Reload) to a kept page: its nodes go back in, the scroll to its record, typing in it still there
  with "Not saved yet." (markKept), and the guide frame's bookkeeping runs as on a redraw. Heavy pages come back
  instantly (no compute).
- Weighed: always draw again (M2 alone, measured as "nolive"). It is the fallback, and it is what a reload or a plan
  change gets; kept pages win on slow phones and late-drawing pages (below).
- Measured (`m-back.mjs`, 17 trips over 16 pages in 5 households, menu and in-page links, 5 trips with a section
  opened first; same spot = within 2 px):

| mode, CPU | Back same spot | section kept | Forward | Back again | Reload same spot | Reload sections |
|---|---|---|---|---|---|---|
| today (off), x1 | 15/17 | 0/5 | 17/17 | 15/17 | 0/17 | 0/5 |
| today (off), x4 | 15/17 | 0/4 | 16/17 | 15/17 | 0/17 | 0/4 |
| M2 only (nolive), x1 | 16/17 | 5/5 | 17/17 | 16/17 | 16/17 | 5/5 |
| M2 only (nolive), x4 | 15/17 | 5/5 | 17/17 | 15/17 | 15/17 | 5/5 |
| M2 + M3 (fix), x1 | 17/17 | 5/5 | 17/17 | 17/17 | 17/17 | 5/5 |
| M2 + M3 (fix), x4 | 16/17 | 5/5 | 16/17 | 16/17 | 16/17 | 5/5 |

The one miss in every x4 row (family, Will the money last?) is the test, not the page: at 4x the "person's" tap on
"What you save for retirement" landed while the page was still flinging and Chromium took it as "stop scrolling", so
the trip never left the page (the address stayed the same; today's app shows the same row). On every trip that left
the page, fix x4 put the screen back exactly. M2 alone (nolive) has one real miss at x1 and at x4: patLee's
retirement guide, 335 -> 313, with the tapped link exactly where it was on the screen (the redrawn page is 22 px
shorter above it; the anchor wins over the raw scroll position, as B1 promises, and D-BACK allows 100 px). An earlier
nolive x4 run on the prototype before the shared hold loop also missed ruth's Will the money last? (1567 -> 1589) and
How much to take out (605 -> 539): pages that keep growing after a 2.5 s restore window, which the hold (8 s, stops at
a touch) now covers.

### M4. The same page drawn again: `place.before/after`, app.js drawPage() keepScroll branch, `place.start` observer

- Before the shell's redraw (store.subscribe -> show(current, { keepScroll: true })): the folds the person opened or
  shut, the box with the focus and its cursor (unless it is in the form just submitted), and the tap chain of the
  button just used with where each part sat on the screen. #content keeps its height while it is empty.
- After the render: folds put back, typing refilled (M5, so a section holding typing opens), focus put back with
  `preventScroll`, then the button tapped is held at its screen position by the same hold as M2 (stops at a touch).
  When the page scrolled itself while drawing (a page that brings its result or notice into view) the page wins and
  there is no anchor: `place.js` counts the page's calls to scrollTo/scrollBy/scroll/scrollIntoView and focus without
  `preventScroll` while a draw is under way. Comparing `scrollY` before and after was not usable: on Will the money
  last? scrollY drifted by 279 px during the render with no scroll call and with anchoring off.
  When the button went away with its form or row (an edit form that closes on Save), the part of the page around it
  (its row, its section) is held where it was, but never above the screen: it is brought just under the top bar, so
  the row or summary that shows what was saved is in view (the touch sweep's D-SEEN on household/people went from 3
  breaks to 0 with this).
  A section the **page** opened and now closes (a page with data folds its add form) is the page's to close: only
  sections the person opened or shut are kept, plus sections holding typing not yet saved.
- Pages that redraw themselves (Chance the money lasts: `root.innerHTML = ""; render()`, Stress tests, Capital gains
  chips, Documents ticks): a MutationObserver on #content (started once by app.js) puts the person's folds back on
  sections that appear again and refills forms that appear, outside the shell's own draws.
- `#content { overflow-anchor: none }` (set from app.js): Chromium's scroll anchoring moved the screen during redraws;
  Safari has none; with it off the shell's anchor decides the same way in both.
- Weighed: (a) morph the new page into the old nodes (keep nodes, patch differences): lost: the pages' listeners are
  closures added by `ui.h` with the old ctx and plan; old nodes would keep stale closures and new ones would be
  thrown away. (b) the per-page `openFold` pattern (12 pages have it): kept as the pages' own choice, but it needs
  ~140 page edits and does not cover focus, typing or the anchor. (c) fold titles only (x-3's proposal): the locator
  is that, generalised to boxes and buttons.
- Measured (`m-redraw.mjs`, 8 saves on 7 pages in 3 households; "moved" = the tapped button's screen position after
  minus before):

| scenario | today: moved, sections | fix: moved, sections, typing |
|---|---|---|
| Will the money last? Save settings (family) | 1,232 px down, shut | 0 px, open, "saved" copy at the bottom |
| Credit cards, Use these numbers (renterDebt) | 522 px, shut | 0 px, open, the page's own notice readable (no copy needed) |
| How much to take out, Use this one (ruth) | -79 px, then -57 px when the notice left | 0 px, and 0 px 5 s later (the notice put back) |
| Estimated payments, Save last year (family) | gone, typing lost | the button went with its section, which the page folds once last year is saved (the page's choice, kept); the section heading stayed put; Q1's 1,000 kept with "Not saved yet."; copy at the bottom |
| Federal estimate, Save in Year and people (family) | gone, shut, typing lost | 0 px, both sections open, 98,000 kept with "Not saved yet." |
| Update my balances, Save all (family) | 109 px | 0 px, copy at the bottom with "See net worth ›" |
| Accounts, note typed then Add this balance (family) | 146 px, note lost | 0 px, the note kept with "Not saved yet." |
| Buckets, Save years (family) | gone, shut | 2 px, open, copy at the bottom |

  Pages that redraw themselves (`m-local.mjs`): Chance the money lasts, Runs changed inside "How this is done":
  today the section shuts and the screen moves 1,048 -> 831; fix: the section stays open and the screen stays at
  1,048 (the focus is not put back on Runs: A3). Stress tests, the "Now" chip: today "A crash like 2008" shuts; fix:
  the four rows that were open stay open, scroll unchanged. Capital gains, a sale half typed, then a "+$25,000" chip:
  today wiped; fix: "Index fund" is still in its box with "Not saved yet.".

### M5. Typing memory: `place.remember/refill/hint/tell/saved/forget`

- Keeps: per page address (the full hash, so `?month=` and `?from=` pages are apart), per form: the form's identity
  (its boxes' keys, each box's saved value as the page drew it, and its button's words), the title of the form and
  the changed boxes `{ key, index, value }`; boxes outside any form by locator with their drawn value. Written 200 ms
  after typing stops, at once when a tap could swap the form away, and when the page is left. In
  `sessionStorage["planner.typing"]` (`.sandbox` apart), dropped after 24 h, never above 300 KB, never boxes that are
  password/file or named token/password/passcode/secret, never inside `[data-no-keep]`. It is never written to the
  plan: AGENTS rule 4 (commit on save) holds.
- Put back: into the same form only (same identity, so a form whose saved figures changed is not filled with old
  typing), on every draw, on kept pages, and when a form appears later (a row tapped open, "+ Add another"). Each
  refilled box fires `input` so pages that keep their own drafts (Get started) see it. "Not saved yet. Undo my typing"
  is added beside the form's buttons (`.place-hint`, `.place-undo`, 44 px).
- Let go: the form that was submitted, or the part of the page a plain Save button sits in, when the store changes
  within 4 s of that submit or tap (`saved()`); Cancel / Close / Clear in a form's buttons; "Undo my typing"; a form
  with the same title and boxes but other saved values on the page (`tell()`); a box outside a form that is drawn
  again holding the typed value (it saved itself on change). A change event is never taken as a save by itself: the
  measurement found a store change 2 ms after a money box's change that was not its save (the "Continue your plan"
  row notes the path's progress as it is tapped), and the first prototype dropped that box's typing on the redraw
  path; what the page draws next now decides.
- Told: kept typing whose form is not on the page is announced once per visit (B6) through the echo (M6, "info").
- Fit: the store.subscribe redraw (M4), every address change (M2/M3), a reload (B3: the record is in sessionStorage),
  heal.js's reload (same), the sandbox (own key), the sync redraw after a newer plan arrives (identity check: typing
  for a changed form is dropped, as for any changed saved figure).
- Weighed: (a) a draft Map inside `ui.form()` (T1's proposal, core/ui/dom.js): lost as the only home: it misses boxes
  outside ui.form (Update my balances grid, notes, Get started questions), reloads, and dom.js is the form-kit
  track's file; the identity rule here is what such a Map would need anyway. (b) memory only (x-3's proposal): lost,
  a reload or a dropped tab empties it (F2, x-4). (c) localStorage: lost, it outlives the tab and the day, on a phone
  that may be shared.
- Measured (`m-draft.mjs`, 7 scenarios, real typing; today loses all 7):

| scenario | today | fix | M2 only (nolive) |
|---|---|---|---|
| Income: + Add another, type, menu to Dashboard, Back | lost | kept: the form open with Weekend tutoring, 1,200 and "Not saved yet." (the kept page) | the form is shut (the page opens it from its button); the note "We kept what you typed in “Add an income”..."; opening it refills (as measured on Debts) |
| Update my balances: type 2, Continue row, Back | lost (11,500/4,200 shown) | kept: 9,999 and 3,900 with "Not saved yet." | kept, same (the first run lost the 9,999: see M5, "Let go") |
| Update my balances: type 2, reload | lost | kept: 18950 and 3,900, same spot (682), "Not saved yet." | same |
| Health: type a plan, Save "Your coverage" | lost under "Saved." | kept: Silver PPO, 250, 3,000 with "Not saved yet." under the other form's "Saved." | same |
| Estimated payments: type Q1, Save last year | lost, paid [0,0,0,0] | kept: 1,000 with "Not saved yet."; "Last year's figures saved." shown | same |
| Income: change Ana's salary, stray tap on Bo's | lost | at the stray tap: "We kept what you typed in “Edit Ana's salary”..."; Ana's row again: 9999 with "Not saved yet." | same |
| Debts: Store card form, type, Back, Forward | lost | Back with the form open leaves the app here (the test opened the page first; A1 makes Back close the form); Forward starts the app again: the note "We kept what you typed in “Store card: rate and payments”...", and tapping Store card shows 19.9 and 95 | same |

  Get started (`dbg-setup.mjs`, empty and samMidSetup): type the first name, reload: the box holds it with "Not saved
  yet.", and Continue saved it into the plan (both households).

### M6. Confirmations: app.js echo() and the keepScroll branch, `place.start` notice watcher

- Seen means readable: drawn (not inside a shut section, unless in its summary) and wholly between the top bar and
  the bottom edge. Only then is the page's own notice enough (fixes p-taxes/x-5's "counted as seen").
- Otherwise the echo: a copy of the notice's words at the bottom (`.save-echo`), at the top (`.save-echo.top`) when
  the tapped button sits in the lowest 150 px; with one way on as a 44 px row: on a page opened from the check-in
  (`?from=review`) the frame's "‹ Back to the ... check-in", else the notice's own first link or button. A tap within
  700 ms of it appearing is ignored (double tap). Stays `min(12 s, max(4 s, 2.5 s + 70 ms per character + 2.5 s with
  a link))`, 6 s minimum for an error. When the page scrolls itself to its notice, the echo looks again after 450 ms.
- Notices a page removes with its own timer (`setTimeout(() => n.remove(), 4000)` in about 95 view files) are put
  back where they were by a MutationObserver: a single `.notice.ok` / `.notice.error` taken out with nothing put in,
  not within 120 ms of the person's own input (a close button). They go with the next draw.
- Weighed: (a) scroll the notice into view: lost, it moves the page under the thumb (D-SCROLL-KEPT). (b) remove the 95
  timers: right in the end but a page change in ~95 files over two lanes; the put-back makes it optional (A6).
- Measured (`m-redraw.mjs`): Will the money last? Save settings: a copy at the bottom (its notice sits inside the
  section, not readable); Credit cards: no copy (the page's own notice is readable on screen); Update my balances: a
  copy at the bottom with "See net worth ›"; Estimated payments, Federal estimate, Accounts, Buckets: a copy at the
  bottom; How much to take out "Use this one": the notice still there and the list not moved 5 s later (put back).

### M7. Ways back: router.layer for the menu, router.back for the frame's links (`frame.js` backLink, `ctx.back`)

- frame.js builds every "‹ Back to ..." link with `backLink(href, label, attrs, loose)`: its click calls
  `ctx.back(href, loose)`, which goes Back when the entry before is that page (M1) and otherwise lets the link work.
- The menu (drawer) opens a layer on a phone; Back closes it (B12). `ctx.layer(close)` returns `release()` for pages.
- Weighed: always `history.back()` from those links: lost, wrong when the page was opened from a bookmark, a new tab
  or the menu (then Back leaves the app or goes elsewhere). `history.go(-k)` to the last entry of that page: lost,
  k is unknown after reloads and jumps over pages the person wants to step back through.
- Measured (`m-links.mjs`; spot = scrollY at the tap and after):
  check-in "‹ Back to the November check-in": today a new entry (history +2), spot 13 -> 0, the phone's Back then
  goes into the step again; fix: goes Back (history +1: the step, kept for Forward), 13 -> 13, the phone's Back then
  reaches the Dashboard. "‹ Quick answers": today +2, 5 -> 0, Back goes into the answer; fix: +1, 5 -> 5, Back reaches
  the Dashboard. "‹ Your plan": today +2, 121 -> 0; fix: +1, 121 -> 121, Back reaches the Dashboard. Menu open, then
  the phone's Back: today the app leaves for the Dashboard (0); fix: the menu closes, the page stays at 233, a second
  Back reaches the Dashboard.

### M8. The redraw waits while the person types in another box: app.js store.subscribe redraw()

- When the last change came from a box that saves on change and the focus is now in another text box on the page, the
  redraw is held until that box loses the focus (then 150 ms). Saves themselves are not held: only the redraw.
- Fit: rare (taxes/state selects, life-events date, people's Taxes selects); without it the box being typed in would
  be replaced and, on iPhone, the keyboard would drop.
- Risk: while held, the page shows figures from before the save (section 4, R6).

---------------------------------------------------------------------------------------------------------------------

## 3. What a page must do (adoption list for wave 2)

Short on purpose: B1 to B11 and B13 need no page change. Owners: claude-b's pages in wave 2; claude-a's pages
(marked *) go in the claude-a handoff.

| # | page | change | finding |
|---|---|---|---|
| A1 | the list pages whose row tap opens an edit form in place: the 27 views that keep an `editing` id (cashflow/income, expenses, budget; goals/goals; balance/net-worth, assets; household/people, contacts, calendar, documents; insurance/health, policies; investments/holdings; retirement/annuities, contributions, pensions; career/equity; estate/digital, gifting, inheritance, legacy; taxes/capital-gains; transactions/ledger, categories, rules; ai/notes; goals/travel*) and balance/liabilities | when the edit form opens: `const release = ctx.layer(() => { editing = null; store.update(() => {}) })`; call `release()` on Save, Cancel and when another row opens. The phone's Back then closes the form and stays on the page (the typing is kept anyway, M5). | p-cashflow-a/CF-3, j-debt-fixer/x-2 (Back part), j-fat-fingers/x-2 (form part) |
| A2 | household/people, balance/net-worth | lift `editing` / `showForm` to module level (as household/contacts does), so an edit form open before a save elsewhere is still open after it (today the shell keeps the typing and says so; this keeps the form open too) | p-career-household-system/x-1, p-balance/x-1 |
| A3 | retirement/monte-carlo | after Runs changes: one line beside it, `ui.notice("ok", "Now using 10,000 pretend futures.")`, and focus back on the Runs box (the section and the scroll are already kept by M4) | j-heavy-waiting/W4 |
| A4 | retirement/roth-conversions | do not offer stop ages at or before the retirement age (or say "(before you retire: nothing to convert)") | p-retirement-b/RB1 (Roth) |
| A5 | retirement/projection (optional) | draw the pending "Retirement settings saved." above the fold, not inside it (the echo already shows it) | p-retirement-a/R-A4, j-one-answer/x-2 |
| A6 | the ~95 views with `setTimeout(() => n.remove(), 4000)` (optional cleanup; * claude-a's own) | delete the timer; the notice stays until the next draw (the shell's put-back already does this) | j-first-retiree/x-2, p-transactions-helpers/x-notice-jump |
| A7 | overview/setup view.js (optional; not compute.js) | mirror `drafts` (the chips and tiles chosen on a question, which are not boxes) to sessionStorage so a reload keeps them too; the boxes are already kept by M5 | j-first-family/F2, j-first-renter/x-4 (chips) |

---------------------------------------------------------------------------------------------------------------------

## 4. Risks (what could be worse than today, and the check that catches it)

| # | risk | the check |
|---|---|---|
| R1 | A kept page shows something out of date (a figure that depends on today, the PC answering, the view). The epoch covers the plan, view, live, features and connection events; 15 min covers the date. A page that keeps live state outside the plan (a timer, a fetch) returns a cleanup and is never kept. | `m-back.mjs fix 1`: Back after a save on another page must redraw (log "back" not "live"); add a trip "save on page B, Back to A" and compare A's words with a fresh draw of A. grep: every page that starts a timer or listener returns a cleanup (`npm run check` rule proposed in S6). |
| R2 | Typing put back into the wrong box. Identity includes every box's saved value and the button's words, so a changed form is never filled; a form that is the same shape for another row (Ana's vs Bo's) differs by saved values. | census "same form recognised" (0 false matches: a form is filled only on an exact identity); `m-draft.mjs` income-stray-row (Bo's form is not filled with Ana's figure). |
| R3 | Old typing confuses: a figure typed yesterday reappears. 24 h limit, "Not saved yet. Undo my typing" beside it, the cue says it is not saved. | node test of the expiry (S5); `m-draft.mjs` hint column (every refilled form shows the words). |
| R4 | The hold fights the person: the screen jumps back while they scroll. The hold stops at the first touchstart, wheel, key or mouse press, after 700 ms quiet, or at 8 s. | kit: start a swipe 100 ms after Back on a late page (Will the money last? x4): scrollY must follow the finger (add to `m-back.mjs` as trip 18). |
| R5 | B2 broken: a new page opening part way down (a stale min-height, a hold not stopped). visit() stops the hold; min-height is reset on every new page. | touch rule **D-TOP**; `m-back.mjs` midAt column (185 = 0 + the reading swipe). |
| R6 | The held redraw (M8) leaves stale figures and stale closures on screen until the box loses the focus; a tap on an old button acts on the current plan through `store.update(draft => ...)` but with figures read at the old draw. | touch rule D-FOCUS-KEPT on taxes/state and household/life-events; a kit trip: change the select, type in the next box, tap the page's Save without leaving the box: the saved plan must hold both values. |
| R7 | The notice put-back keeps a notice a page meant to take away (a "working" line replaced by the answer). Only a `.notice.ok` or `.notice.error` taken out on its own (nothing put in by the same change, the shape of the timer) more than 120 ms after the person's input is put back, and it goes with the next draw. | grep the 95 timers: each removes an ok/info confirmation, not a progress line; kit: a page that swaps a progress notice for its answer (the document reader, bank file import) must show the answer only. |
| R8 | The echo's link is wrong or doubled: "one way on" breaks the design-log rule (exactly one). The echo carries only the notice's own link or the check-in way back, never a Next; it goes when the page's notice is readable. | `m-redraw.mjs` echo column; D-SEEN; shot of balance/update after Save from the check-in. |
| R9 | sessionStorage full or blocked (private mode, quota): every read and write is in try/catch; the app works as today without it. | node test with a throwing storage stub (S2, S5). |
| R10 | router.back goes Back to the wrong month or page. It requires the same page and equal query keys; only the check-in's `month` may be missing, and the check-in without `?month` shows the month the person was on. | `m-links.mjs fix` checkin-backlink, plus a trip with two months: open October's check-in by its chip, a step, "‹ Back to the October check-in" must show October. |
| R11 | Old and new shell files mixed on the phone (core/place.js new, app.js importing it). | `npm run skew` (tools/main-gate.mjs) before the push; the pre-push hook runs it. |
| R12 | A page that relies on starting at the top after its own save (scrolls to a result) is held in place instead. Self-scrolls are counted and the page wins. | `m-redraw.mjs` update-balances (the page scrolls to its notice: moved 0, echo looks again after 450 ms); grep `scrollIntoView` in views and walk each in the kit once. |
| R13 | place.js wraps `window.scrollTo/scrollBy/scroll`, `Element.prototype.scrollTo/scrollBy/scroll/scrollIntoView` and `HTMLElement.prototype.focus` to count the page's own scrolling while it draws. A wrapper that dropped an argument or a return value would break a page. They forward `this`, every argument and the return value, and count only while a draw is under way. | node test: each wrapper forwards arguments and return value on a stub object; `node qa/smoke-all.mjs` and the browser sweep's page-error count unchanged. |
| R14 | The permanent touch check and this design disagree in two places (section 1): D-SCROLL-KEPT counts a button that did not move as moved when a confirmation was drawn above it, and D-SEEN wants the typed box in view after a Save that sits more than a screen below it. If the check is "fixed" by moving the page, B9 is undone. | touch-check track: count `0 <= moved <= room + 60` (or `abs(moved) <= 60`) as kept; for D-SEEN's typed-box part, accept when the box was already off the screen when Save was tapped. Re-run `sweep.sh`: expect 0 breaks of the five rules on these 18 pages. |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari (and the home-screen app)

Where Safari differs for these mechanisms:
- **Scroll anchoring**: Safari has none (`overflow-anchor` unsupported). The prototype turns it off in Chromium too, so
  what was measured here is what Safari does; the shell's own hold (M2, M4) is the only anchoring.
- **scrollRestoration = "manual"**: supported since Safari 11. Same-document (hash) entries never use the back-forward
  cache, so Back always reaches the shell's popstate; leaving the app for another site and coming back may restore the
  whole document from the cache (nothing to do: `pageshow` with `persisted`).
- **Edge swipe Back** (Safari, not the home-screen app): Safari animates a snapshot of the previous screen, then fires
  popstate; the page then appears at the same spot. Check that the snapshot and the drawn page match (no flash of the
  top).
- **History limits**: Safari throws after 100 `pushState`/`replaceState` calls in 30 s. The router calls replaceState
  once per new entry and pushState once per layer; scroll and folds live in sessionStorage, never in history.state.
- **The home-screen app** (`display: standalone`, `start_url: "./"`): there is no Back button and no edge swipe, so
  the on-screen ways back (B4) carry all the weight. When iOS ends the app in the background and it is opened again,
  it starts at `./` in a fresh session: sessionStorage is empty, so typing from before is gone (as today) and the
  place starts fresh. When iOS only suspends it, everything is as it was.
- **A tab Safari dropped**: Safari reloads it at the same address when it is shown again; sessionStorage normally
  survives this (same tab), so B3 applies. To check on the phone.
- **pagehide** is unreliable when switching apps on iOS: nothing depends on it (records are written 150 ms after the
  scroll stops, typing 200 ms after it stops). The build adds the same note on `visibilitychange` to "hidden".
- **Focus and the keyboard**: iOS opens the keyboard only for a focus inside a tap. Putting the focus back after a
  redraw (B9) keeps the cursor but may not reopen the keyboard; M8 avoids the case that matters (the box being typed
  in is not replaced). Selects open a picker wheel; `change` fires on Done; the redraw follows as in Chromium.
- **Rubber-band overscroll** gives negative or too-large scrollY during a bounce: the hold compares with a 1 to 2 px
  tolerance and borrows height (min-height) before scrolling, so a bounce does not fight it; to check.
- **Private browsing**: sessionStorage works (iOS 11+); all access is guarded.

For the owner to try on the iPhone (Safari, then the home-screen app), on the pretend plan (`?sandbox=1`):
1. Will the money last?: scroll to the bottom, open a section, tap a link, then Back (swipe from the left edge in
   Safari): same spot, section open, no flash of the top.
2. Same, but tap the link before the page has finished drawing (right after opening it).
3. Income: tap "+ Add another income", type a name and an amount, open the menu, tap Dashboard, then Back: the form is
   open with your typing and "Not saved yet.".
4. Update my balances: type two balances, pull down to reload: still there.
5. Taxes > Estimated payments: type a first-quarter payment, then save last year's figures: the payment is still in
   its box.
6. Credit cards (a plan with a card): open "Moving a balance to a 0% card", change the months, tap "Use these
   numbers": the section stays open and the button stays under your thumb; a short "saved" can be read.
7. From the monthly check-in: tap a step, save something, use the bottom note's "‹ Back to the ... check-in", then
   Back once: Dashboard (not the step again). In the home-screen app, use the on-screen links only.
8. With the menu open, swipe Back: the menu closes, the page stays.
9. Type in a box, switch to another app for a minute, come back: the typing is still there.
10. In a box that opens the keyboard, after a save elsewhere: is the cursor still in your box (keyboard may need a
    tap)?

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each one small enough to verify alone)

Every step: `npm test && npm run check`, `npm run leak-guard`, one CHANGELOG line, and the kit scripts named. The kit
scripts take a lib argument for the port (`node m-links.mjs fix ./lib.mjs`); copy them to the builder's scratch and
point `lib.mjs` ROOT at the build worktree. Pure parts of `core/place.js` and `core/router.js` are exported and import
cleanly in Node (all storage and window access inside functions or try), tested in `tests/place.test.mjs`.

| step | files | change | checks |
|---|---|---|---|
| S1 | core/router.js | entry numbers in history.state (spread, so `suFrom` stays), nav kinds, `router.entry()`, `router.touch()`; `scrollRestoration` stays auto in this step | node: `tests/place.test.mjs` sameEntry(link, before, loose) and kind(prev, now) cases; kit: Get started Back/forward through questions unchanged (`suFrom`); D-TOP |
| S2 | core/place.js (locator, records, hold, self-scroll count), core/app.js drawPage | records per entry, leave/note, arrive + hold, `scrollRestoration = "manual"`, `overflow-anchor: none`, pagehide + visibilitychange note | node: locator key/shape functions (figures to `#`, status words dropped), record pruning (forgetAfter, 60 cap), storage stub that throws; kit: `m-back.mjs nolive 1` and `4` (B1, B3 without kept pages), D-BACK, D-TOP, R4 swipe trip |
| S3 | core/place.js before/after, start observer; core/app.js keepScroll branch | snapshot and put back folds, focus, anchor; page-local redraws | kit: `m-redraw.mjs fix` (moved at most 2 px where the button stays), `m-local.mjs fix`; D-SCROLL-KEPT, D-FOCUS-KEPT |
| S4 | core/app.js echo + keepScroll branch; core/place.js notice put-back; core/ui/base.css `.save-echo.top`, `.save-echo-words`, `.save-echo-way`, `.save-echo.info` | readable rule, one way on, stay by length, top placement, double-tap guard, put-back | node: echoStay(text, bad, way) table; kit: `m-redraw.mjs` echo and later columns; D-SEEN; shots of balance/update at 390 px, light and dark |
| S5 | core/place.js typing; core/ui/base.css `.place-hint`, `.place-undo` | remember/refill/hint/tell/saved/forget, sessionStorage with expiry, size cap, secret names skipped | node: identity and field matching on plain objects, expiry, 300 KB cap, secret-name filter; kit: `m-draft.mjs fix` and `nolive` (7/7, update-continue-back in nolive is the save-rule case), `dbg-setup.mjs`, `dbg-change.mjs` (a select that saves itself leaves no "Not saved yet."), `m-local.mjs` capital-gains |
| S6 | core/place.js park/unpark/stale; core/app.js | kept pages for Back/Forward, epoch on store.update and the four planner events | kit: `m-back.mjs fix 1` and `4`; R1 trip (save elsewhere, Back redraws); `npm run check` rule: a view that calls setInterval/addEventListener on window returns a cleanup |
| S7 | modules/overview/guide/frame.js, core/app.js ctx.back | backLink for every "‹ Back to ..." link, `loose: ["month"]` on the check-in link | kit: `m-links.mjs fix` (history does not grow, spot kept, Back then reaches Dashboard); R10 two-month trip |
| S8 | core/router.js layer, core/app.js drawer, ctx.layer | the menu as a layer on phones; ctx.layer documented in docs/CONVENTIONS.md | kit: `m-links.mjs` menu-back; desktop (960 px) unchanged |
| S9 | core/app.js redraw | M8 hold of the redraw while typing in another box | D-FOCUS-KEPT; R6 trip |
| S10 | core/app.js, core/place.js, docs | drop `?place=` switches (keep `?place=off` only if the owner wants a kill switch; conservative: drop) and `window.__placeLog`; docs/PLAN.md "Place and typing" paragraph; docs/CONVENTIONS.md ctx.back/ctx.layer and "kept pages must return a cleanup if they start timers" | `npm run build`, `npm run skew`, `node qa/smoke-all.mjs`, `node tools/shot.mjs` on the pages of section 5's list, `all-pages.mjs` (0 page errors), and `sweep.sh` (the touch sweep on the 18 pages: D-BACK 0, D-FOCUS-KEPT 0, D-TOP 0; D-SCROLL-KEPT and D-SEEN as in section 1 until R14 is settled), then the full `qa/touch-sweep.mjs` once it lands |

Wave 2 then takes section 3 (A1 to A7) page by page.

---------------------------------------------------------------------------------------------------------------------

## 7. Design log and lanes

Owner decisions this relies on (quoted from docs/DESIGN_LOG.md):
- 2026-09-16, Social Security, finding 4: "one fold per person, first open, the one just saved stays open; green
  Saved (already there)" (owner chose A). B9 keeps a section the person opened open after a save on every page.
- 2026-09-15: "every save/add/remove confirms with a green notice; errors are red and say what to do next", "kept
  across the shell re-render via a module-level `pending`". The echo (B10) only copies those notices where the eye
  is; pages keep their `pending`.
- 2026-09-15 rules: "a page with data folds its add form behind "+ Add another ..."". Not undone: a section the
  page opened and closes after the first save is closed (M4 keeps only sections the person opened or shut, and
  sections holding unsaved typing); the cue (B6) says the typing is kept.
- 2026-11-06: "every page ends with exactly one way on ... No Next bar is fixed to the bottom of the screen (it rides
  over the keyboard and covers the page's own buttons)". The echo is a short note that leaves by itself, carries no
  Next, and only the notice's own link or the check-in way back (one way on); it moves to the top when the bottom
  would cover the button just tapped.
- 2026-11-06: "Do not undo: the household's view never shows build progress, "soon" pages, or PC / AI helper / sync
  wording". New words on screen are only "Not saved yet.", "Undo my typing" and "We kept what you typed in ...".
- 2026-11-06 review: "the setup screens opened from a row of Your plan lead back to it ("‹ Your plan", and Save)":
  B4 makes "‹ Your plan" a real step back.

Lanes: no claude-a page is edited (their pages get B1 to B11 from the shell; A6 lists their timers for the handoff).
No edit to modules/overview/setup/compute.js, modules/retirement/projection/compute.js or the estimators. core/ui/dom.js
(form kit) is not touched: M5 works on any form, including ui.form's.

Choices made without the owner (each the conservative option):
1. No "leave this page? your typing will be lost" dialogs: nothing is lost, so nothing to ask.
2. Typing is kept in this tab only (sessionStorage), for 24 h, never in the plan or on the PC.
3. Only sections the person opened or shut are kept across a save; the page's own folding wins otherwise.
4. The echo carries at most one link, the check-in way back first; it never adds a Next.
5. Notices removed by page timers are put back rather than the 95 timers deleted in wave 1 (deleting is A6, optional).
6. Kept pages are dropped on any plan change and after 15 minutes; a reload always draws afresh.
7. The guide frame keeps its "Back to ..." words and places; only what the tap does changes.
8. The prototype switches (`?place=off` etc.) are removed in the build (no hidden modes in the household's view).

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (52 findings)

SH-BACK (19)

| finding | closed by |
|---|---|
| j-first-family/x-1 | B1 |
| j-first-freelancer/x-2 | B1 |
| j-first-retiree/x-1 | B1 |
| j-heavy-waiting/W1 | B1 |
| j-monthly-return/x-back-top | B1 |
| j-navigator/N1 | B1 (Back, Forward), B3 (Reload), B4 ("‹ Your plan") |
| p-career-household-system/F1 | B1 |
| p-cashflow-a/x-1 | B1 |
| p-insurance-estate/IE-1 | B1 |
| p-overview-home/OV-1 | B1 |
| p-retirement-a/R-A2 | B1 |
| p-retirement-b/x-2 | B1 |
| p-retirement-c-scenarios/x-back-loses-place | B1 |
| p-taxes/x-1 | B1 |
| j-first-renter/x-3 | B1 |
| j-monthly-return/x-backlink-history | B4 |
| j-one-answer/A5 | B1 |
| j-one-answer/x-4 | B4 |
| p-overview-path/x-2 | B1 |

SH-DRAFT (21)

| finding | closed by |
|---|---|
| p-insurance-estate/x-1 | B8 |
| p-taxes/T1 | B5 (c), B8 (a, b, d, e) |
| j-debt-fixer/x-2 | B5 (the typing); A1 (Back closes the form) |
| j-fat-fingers/FF2 | B5, B6 (leaving), B7 (the stray row tap) |
| j-first-family/F2 | B3 (boxes); A7 optional (chips) |
| j-monthly-return/x-typed-lost | B5, B3 |
| j-navigator/x-2 | B5, B3 |
| p-balance/B1 | B5 |
| p-balance/x-1 | B8, B13; A2 (net worth's add form stays open) |
| p-career-household-system/x-1 | B8, B6; A2 (people's edit form stays open) |
| p-cashflow-b-goals/x-3 | B5 |
| p-debt-property/x-3 | B5, B6 (the typing). Declined here: "the row sits 32 px under Add" is tap spacing, the taps track's cause, not place |
| p-insurance-estate/IE-9 | B5 |
| p-retirement-a/x-2 | B5 |
| p-retirement-c-scenarios/x-half-typed-form-lost | B5 |
| j-fat-fingers/x-2 | B12 (the menu); A1 (edit forms) |
| p-career-household-system/F2 | B5 |
| p-cashflow-a/CF-2 | B5, B6 |
| p-cashflow-a/CF-3 | B5 (the typing); A1 (Back closes the form) |
| p-investments/INV-4 | B5, B6 |
| j-first-renter/x-4 | B3 (boxes); A7 optional (chips) |

SH-REDRAW (12)

| finding | closed by |
|---|---|
| j-first-freelancer/x-1 | B9 |
| j-monthly-return/MR-1 | B10 |
| j-one-answer/x-2 | B9, B10; A5 optional |
| j-debt-fixer/x-3 | B9, B10 |
| j-first-retiree/x-2 | B11; A6 optional |
| j-heavy-waiting/W4 | B9 (the sections, both pages); A3 (the "Now using ..." line and focus on Chance the money lasts) |
| p-balance/B2 | B10, B9 |
| p-retirement-a/R-A4 | B9, B10; A5 optional |
| p-retirement-b/RB1 | B9, B10 (the section, the notice); A4 (Roth stop ages) |
| p-retirement-b/x-1 | B9 (first jump), B11 (second jump) |
| p-transactions-helpers/x-notice-jump | B11; A6 optional |
| p-taxes/x-5 | B10 |

Touch rules this turns green (qa/touch-rules.json in `$SP/wtouch`), measured with the sweep on 18 pages x 3 households:
D-BACK (B1, B3, B4) 29 breaks -> 0; D-SCROLL-KEPT (B9, B11) 16 -> 6, all six "0 px moved" counted by the rule's
arithmetic (R14); D-SEEN (B10) 4 -> 7: the "no confirmation" breaks are gone, the 7 left are the rule asking for a typed
box a screen above its Save (R14); D-FOCUS-KEPT (B9, B13) and D-TOP (B2) stay at 0. Not this track: D-UNDO, D-TWICE,
D-ENTER.
