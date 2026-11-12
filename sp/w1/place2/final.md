# Place and typing memory: final design (wave 1, track place2)

Themes: SH-BACK (19 findings), SH-DRAFT (21), SH-REDRAW (12): 52 findings. This file stands alone: a builder needs
only it and the three theme files (`ux/synth/themes/SH-{BACK,DRAFT,REDRAW}.md`).

**Evidence base.** Everything below was rebuilt and measured on the branch tip d22b718, not on c385e41 where the first
draft was measured (scope critic, blocking 1).
- Prototype: `$SP/w1/place2/fin`.
  It is a `git archive` of d22b718 (one commit, "tip") with this design as the uncommitted diff:
  - `core/router.js` (rewritten)
  - `core/place.js` (new)
  - `core/app.js`
  - `core/ui/base.css` (shell selectors only)
  - `modules/overview/guide/frame.js` (eight `data-back` attributes)
  - `tests/place.test.mjs` (15 node tests, all pass)

  The same diff as one file: `.../w1/place2/final-proto.patch` (applies to d22b718 with `git apply`; 6 files, +887 -41).
- Scripts: `.../w1/place2/fv`. They include `lib.mjs` (the thumb), the critics' own repros copied unchanged except for
  the port and storage key, the suites `e1`-`e9`, and new checks (`t-rowswap`, `t-layer`, `t11b-goals-thumb`, `t-nw`,
  `dbg-*`). Raw output is in `fv/out`, pictures in `fv/shots`.
- Served on 127.0.0.1:9367 while measuring; that server is stopped.
- Phone: 390 x 844, touch, Chromium, always `?sandbox=1`. Thumb drags are real (CDP touch events, about 0.4 s a
  swipe), taps land at screen points on controls that are on the screen, and keys are trusted.
- `?place=off` in the prototype is today's shell, so before and after come from the same files. The build removes it.

**What changed since the first draft**, each for a reason given in section 9:
1. The kept page (old M2, old B13: Back reattaching the old page's nodes) is **cut from wave 1**. It caused the phantom
   "kept" line on the Dashboard, and M1 alone already met every number.
2. **`core/router.js` owns the one numbering of history entries**, the trail, `back(href)` and `layer(close)`. Taps
   builds its Back button and drawer on this API, so there is one implementation, not two.
3. **Typing goes back only into the same form.** Same form means the same heading nearest above it, the same button
   words, and the same values drawn in its boxes. Inside that form, typing is matched box by box.
4. **Typing is filed under the page it was typed on.** The observer never mistakes the shell's own clearing for "the
   page took a form away".
5. **A save whose redraw closes another form keeps that form's typing** and names the form. It never drops it.
6. **One cue for kept typing**, "Not saved yet · Undo my typing", beside the form's buttons. A form that is shut gets
   one line instead. Both are neutral (no green tick) and name the form's own heading ("Edit Ana's salary").
7. **The bottom copy of a confirmation:**
   - its "‹ Back to ..." goes back;
   - it is removed when the address changes;
   - it sits at the top when it would cover the tapped control;
   - it stays 4 to 12 s, by length;
   - it carries the notice's own button (Undo) first;
   - it is decided one frame after the draw, so it never repeats a line the page itself scrolled into view.
8. **A page's timer can no longer remove a save's notice.** Only a person's tap on the notice can.
9. **The return hold:**
   - lasts up to 8 s and ends 700 ms after the page stops moving;
   - ends at the first touch, wheel or key, at another address, at the kit's `planner:reveal`, and never runs while
     the "changed in two places" bar is up;
   - borrows room only until the place is drawn;
   - lands on the kept-typing line when the form that held the typing is gone.
10. **Storage:**
    - secret boxes are never kept;
    - places and typing use separate keys;
    - typing is let go after 24 h, and a page's typing over 20 KB is not kept;
    - records carry a format version.
11. **Back links are found by `data-back` only.** They may walk back along one trail (Your plan's "Next result").
12. **The seams with taps and forms2 are named, with a landing order** (section 7).

---

## 1. Behavior, in a person's words (the acceptance test)

**B1. Back and Forward land where I was.** I scroll down a long page, tap a link, look, then press Back (or swipe
back). The page is where I left it: the line I was reading is at the same height on the screen, from the first frame,
and it stays there while the page finishes working out its numbers. Forward brings the next page back where I left it
too. A link or a menu row to a page still opens it at the top.

**B2. The sections I opened are still open when I come back.** This holds for Back, Forward and Reload. It includes a
fold the page opens by itself that I shut. A fresh visit by a link draws the folds as the page designs them: Get
started's eight tiles stay folded on first open (design log 2026-11-06).

**B3. A reload, or a tab the phone dropped and reopens, comes back** at the same place with the same sections open. A
bar asking me to choose between two versions of my plan always stays at the top where I can see it.

**B4. "‹ Back to ..." on the screen, or in the short note at the bottom, does what the phone's Back does** when the
page it names is just behind me:
- The check-in, Quick answers or Your plan comes back where I was.
- The phone's Back afterwards goes where it would have gone. From a check-in with three steps visited, one press reaches
  the Dashboard.
- From Your plan → a result → "Next result" → another result, "‹ Your plan" goes back two steps along that walk.

Opened any other way (a link from elsewhere, a fresh tab), the link opens the page as today.

**B5. After a save the page stays still.** The section I saved from stays open.
- The button or row I tapped stays under my thumb. If the button itself goes away, its row or section stays where it
  was.
- If the page or the form kit brings the confirmation or the answer into view on purpose, that wins; then the
  confirmation is on the screen.
- The box I was in keeps the focus. If the save closed its form, the focus goes to the green line when it is on the
  screen.

**B6. Saving one part of a page never wipes what I typed in another part.**
- If the other form is still drawn: my typing is still in it, its section stays open, and "Not saved yet · Undo my
  typing" sits beside its buttons, so the green "Saved." above cannot be read as covering it.
- If the save closed the other form (People's state choice, the check-in's month chips, Net worth's add form): my
  typing is kept, and one line where that form was says "Not saved yet: what you typed in “Edit Bo”. Open it again to
  finish it." with "Throw it away".

**B7. What I typed and did not save is still there when I come back.** This holds however I left (a link under the
form, the menu, the status pill, Back, Forward) and however I come back (Back, Forward, or opening the page again),
for the rest of the visit, and at most a day.
- A form drawn when the page opens: the typing is in it, with "Not saved yet · Undo my typing".
- An edit form I had opened from a row: one line at its row or card names it ("Not saved yet: what you typed in “Edit
  Ana's salary”. Open it again to finish it."). Opening that row brings the typing back. If the line is not on the
  screen, the same words show briefly at the bottom.
- Nothing is asked when I leave.
- The words never appear on a page where I did not type.

**B8. A reload or a dropped tab keeps what I typed** in the boxes the page draws when it opens: Update my balances,
the tax pages, the add form of an empty list, the check-in's note. Get started and People keep their own typing; the
shell then stands aside and says nothing, and it never claims more than came back.

**B9. A stray tap that swaps my half-typed form for another row's keeps my typing, and never puts it into that other
row.** Bo's form shows Bo's figures. A short neutral note says "Not saved yet: what you typed in “Edit Ana's salary”.
Open it again to finish it." Tapping Ana's row again shows my typing with "Not saved yet · Undo my typing". Cancel
still throws it away, as today.

**B10. A choice that recalculates part of the page keeps the sections I opened**: Runs on Chance the money lasts, Now /
As you retire on Stress tests.

**B11. I see the confirmation where I am looking, with its way on.** Sometimes the green or red line a save draws is
above or below the screen, inside a shut section, or mostly under the top bar. Then a short copy shows at the bottom
of the screen, or at the top when the bottom would cover the button I just tapped. The copy:
- carries, as 44 px taps, the line's own button (Undo) or link ("See net worth ›"), and the "‹ Back to the November
  check-in" of the page I came from;
- stays 4 to 12 s, by its length;
- goes when I go to another page.

**B12. A confirmation never moves the page when it goes.** The green line a save drew stays until my next action
replaces it. Nothing slides under my thumb four seconds later, even with my thumb resting on the glass.

**B13. Back closes what opened over the page before it leaves the page**, for the things that ask for it: the menu
(taps track) and, page by page, an edit form opened from a row (section 3). Wave 1 builds and measures the one shell
helper; the pages adopt it in wave 2.

**Not in wave 1** (each with its reason in section 9):
- Back reattaching the page exactly as left (an open edit form open again, instantly).
- Holding the save's redraw while the person types in another box.
- Asking before leaving a page with typing (it is kept instead).
- Letting go of kept typing for a row whose saved figures changed meanwhile. This waits for `data-key` on rows; until
  then "Throw it away" and the 24 h limit do it.

---

## 2. Mechanisms

Eight pieces in two files:
- **`core/router.js`**: entries, the trail, back links, layers. 143 lines in the prototype.
- **`core/place.js`** (new): 479 lines in the prototype, a third of them comments and pure rules.

`core/app.js` `show()` calls them at four points: leaving, arriving, after a save's redraw, and after a new address
is drawn. The build moves the prototype's helpers out of `show()` into `place.js` (section 6, P6), so `show()` grows
by about 30 lines, not the prototype's 200 (scope critic, blocking 5). No page code changes.

### M1. One numbering of history entries, a trail, back links and layers (`core/router.js`)

- **Keeps.**
  - In `history.state` of each entry: `{ v, n }`. `v` is this visit (a random id, so a tab opened from a link never
    mixes with its opener's records); `n` is the entry's number (the entry before + 1).
  - Every write spreads the state it found, so Get started's `suFrom` and its own `replaceState(history.state, ...)`
    keep it.
  - In `sessionStorage["planner.trail(.sandbox)"]`: `{ v, first, items: { n: { p: page path, q: query } } }`.
    Entries that Forward can no longer reach are dropped when a new entry is made; at most 60 are kept.
- **Pure parts, node-tested** (`tests/place.test.mjs`, router section):
  - `stampOf(state, prev, fresh)`: an entry with a number is a return; otherwise it gets the previous number + 1 in the
    same visit.
  - `splitHref(href)`.
  - `backSteps(trail, n, href)`: the nearest earlier entry whose page and query match the link wins. `from` is
    ignored, and a `month` the entry lacks is the month that page showed by itself, so "‹ Back to the October
    check-in" never returns to the November one. More than one step is allowed only while every entry in between was
    opened from the same place as this one (its `from`), which is Your plan's "Next result" walk. Otherwise the answer
    is 0: follow the link.
- **API** (taps builds on it; section 7):
  - `router.entry()` returns `{ v, n, kind: "new" | "return", key, first }`.
  - `router.first()` returns the visit's first entry number.
  - `router.at(n)` returns `{ p, q }`.
  - `router.back(href)` calls `history.go(-steps)` and returns true, or returns false (follow the link).
  - `router.layer(close)` pushes `{ ...history.state, layer: id }` at the same address (no hashchange, no redraw) and
    returns `release()`. A popstate with a layer open calls the newest `close()`. `release()` steps off the layer's
    entry when it is still on top. An entry for a layer that is no longer open (a reload with it open, a Forward onto
    it) is stepped off at once.
  - `router.start(onChange)` stamps the entry before calling `onChange(route, entry)`.
  - `ctx.layer(close)` is `router.layer` handed to pages.
- **Weighed.**
  - (a) A key per entry written from `place.js`, the first draft: it left taps with a second numbering (`n/from/via` in
    the state plus `planner.firstEntry`), and the scope critic's merge found the two colliding in `show()`. Lost.
  - (b) Taps' `stampEntry()` in `app.js`: same rule, wrong file; taps' own build step says "core/router.js, one
    numbering for this track and the place track". Merged here.
- **Measured.** `fv/t-layer.mjs` on Income:
  - a layer is opened, then Back: the layer closes, the address and scroll stay, and no redraw happens (`renderSeq`
    unchanged);
  - `release()` on its own steps off the entry;
  - the next Back goes to the Dashboard (`fv/out/reg-t-layer.log`);
  - a layer left open (a page that forgot `release()`), then a link: the layer is closed once as the page is left, and
    one Back returns to Income with nothing closed again.

  The back-link numbers are under M6.

### M2. The place of each entry: Back, Forward, Reload (`core/place.js`, `show()`)

- **Where.**
  - `place.init()` sets `history.scrollRestoration = "manual"` at boot.
  - At the start of `show()` for a new address (not a save's redraw): `place.leave()` records the page being left, a
    running hold is cancelled, and `.save-echo` is removed.
  - After `cleanup()`: `place.arrive(router.entry())` returns the record for a return.
  - Before the page renders: the shell scrolls to the record's `y` at once and holds
    `#content.style.minHeight = max(y + innerHeight, docH) - offsetTop`, so the first frame already stands at the
    place (and taps' one-frame "paint first" wait paints there, not at the top).
  - After the render: `arrived()` applies the folds and calls `holdPlace()`.
- **Keeps.**
  - `sessionStorage["planner.place(.sandbox)"]`: entry key → `{ path, y, docH, anchor, folds, at }`, newest 40.
  - `anchor` is what was at the top of the screen: `topThing()` walks the page's own elements by geometry, from just
    under the top bar, down to the smallest heading, row, label, button, paragraph or card there. It never uses
    `elementFromPoint`, so an open menu over the page does not hide it (break critic, should-fix 2). It is stored as a
    chain of locators (M5) with screen tops: the thing, then its row, form, fold and card.
  - `folds`: the folds the person opened or shut (M4), with how the page had drawn each.
- **When written.**
  - Leaving an entry (another address, Back, Forward; with restoration manual the browser has not moved the page yet,
    so `scrollY` is still the old page's).
  - `visibilitychange` to hidden and `pagehide` (switching apps, locking the phone, a reload).
  - Never on scroll, so Safari's limit of 100 `replaceState` calls per 30 s is never near.
  - Only once the page on screen has finished drawing (`drawn`), so a half-drawn page that throws (`core/heal.js`'s
    one reload) never overwrites the record the reload will use.
- **When used: a return** (an entry with a number: Back, Forward, Reload).
  - The record's folds are applied (only where the page drew that fold as before).
  - `holdPlace()` puts the first drawn link of the anchor chain back at its old screen top, else scrolls to `y`. It
    does this every frame while the page grows (pages that work their answer out after drawing).
  - The hold stops at the first of: 8 s; 700 ms with nothing moving (after at least 1.5 s unless the thing itself was
    found); a `pointerdown`, `touchstart`, `wheel` or `keydown` (break critic, should-fix 3: the wheel was missing);
    another address shown (`routeSeq`); `planner:reveal` (the form kit scrolls on purpose); a fresh conflict
    (`showConflict()` calls `cancelHold()` before its own `scrollTo(0, 0)`).
  - When the conflict bar is up at arrival, the record is not used at all: the bar must be seen (break critic,
    blocking 5).
  - **Room is borrowed only until the place is drawn.** As soon as any link of the chain is on the page, the page's own
    height decides. When only a landmark around the place is drawn (the edit form that held the typing is gone), that
    landmark comes to the top of the screen, or the kept-typing line does (`landOn`). The person sees the row and the
    line, not a screen of empty grey (person critic, blocking 5).
- **A new address** is unchanged: `scrollTo(0)`, as today (touch rule D-TOP).
- **Fits.**
  - `renderSeq`: a newer `show()` wins.
  - The boot-time redraw after `refreshStatus()` keeps the held height.
  - The guide frame and pages that scroll themselves while drawing: on a return the record wins (the person was
    there); on a save the page wins (M3).
  - Get started's `replaceState(history.state, ...)` keeps `{ v, n }`.
- **Weighed.**
  - (a) The browser's own restoration (today): a race with the shell's `scrollTo(0)`, decided in the first 50 ms.
  - (b) A record keyed by address: two entries of one address need two places, and it dies with a reload.
  - (c) Everything in `history.state`: per-scroll writes hit Safari's rate limit.
  - (d) The kept page (old M2): see section 9, scope 4.
- **Measured on d22b718** (`fv/e1-back.mjs`): 22 trips planned on four households (family, ruth, patLee, freelancer),
  17 with a link on the screen; normal speed, 1 run. Results in `fv/out/e1-full-1.log` and `fv/out/e1-off-1.log`.

  | | Back within 100 px | what was at the top, back within 5 px | sections as left | Forward within 100 px | Reload within 100 px | Reload sections |
  |---|---|---|---|---|---|---|
  | today (`place=off`), tip | 5 / 17 (each exact, the rest at 0) | 5 / 17 | 15 / 17 | 8 / 17 | **0 / 17** (every reload at the top) | 15 / 17 |
  | final prototype, tip | **17 / 17** (16 within 5 px) | **17 / 17** | **17 / 17** | **17 / 17** | **17 / 17** | **17 / 17** |
  | today, c385e41 (first draft) | 6 / 18; 1 / 18 at 4x slower CPU | | 16 / 18 | 12 / 18 | 0 / 18 | |

  - "today, tip" is the prototype with `?place=off`: today's shell, browser restoration on, the new router's entry
    stamps still written. The c385e41 row used the untouched router; the two agree (5 of 17 and 6 of 18 in the race,
    no Reload kept).
  - The one Back not within 5 px is ruth's "Will the money last?" at -32 px of scroll, with the line at the top exact:
    the page drew 32 px less above it.
  - Today's Back is a race, decided in the first 50 ms: `e8-backmethod.mjs` found 7 of 16, each exact or at 0 px, with
    no pattern. So "today" differs from run to run; the prototype does not.
  - The hold lets go and the bar wins (break critic, blocking 5, and should-fixes 2 and 3):
    - `t12c`: the conflict bar stays at the top in all three cases.
    - `t14b`: leaving Expenses by the open menu records the row "Eating out", and Back puts it back at the top.
    - `t7b`: 640 px of wheel in the first second after Back is kept (1,200 → 528 px).
  - The critics' Back runs on other households, at 4x slower CPU (`cb/t16-back.mjs`, `cp/j01-back.mjs`), held up on
    the first draft. The return path is unchanged since, except for the earlier release of borrowed room.

### M3. Carry across a save (the same page drawn again)

`store.update` → the shell redraws the page 50 ms later with `keepScroll`. Order inside `show()`:

1. **Before clearing**, `snapshot(root, { anchor, skip })` takes:
   - the folds the person set, with how the page drew each;
   - the typing (M4) in every form except the one whose submit caused this redraw (`skip`: the capture-phase `submit`
     listener notes it; it is forgotten when this redraw is drawn, not after a clock, as break critic should-fix 4
     asks);
   - the focus, with the caret;
   - the anchor: the control the person last pressed (a trusted `pointerdown` or `click` in `#content`, under 20 s
     old), else the focused one. It is kept as a chain of locators (M5) with screen tops: the thing, its row, its form,
     its fold, its card.
2. `#content` keeps its height while the page draws (`minHeight` = its height before).
3. The page renders. The scroll wrapper (M8) counts the page's own scroll calls during the draw.
4. **`apply(root, snap, { focus: true })`:**
   - Folds come back where the page drew them as before. Where the page changed its mind (a form it folds away after
     the first save: goals/house, insurance/health, investments/fees, taxes/estimated's "Last year's return"), the page
     wins. That one rule keeps "the one just saved stays open" (design log, Social Security) without a list of pages.
   - Typing goes back only by M4's rule; `input`, and `change` for choices, are fired so money boxes re-check and pages
     that keep their own model learn it. Values are written quietly: never `reportValidity()` (forms N3).
   - The focus comes back when nothing else has it.
5. **Typing that could not go back because its form is gone is kept** (`place.keep(path, parked)`, marked parked),
   never dropped. The line of B6 goes where that form's host card or row is. Parked typing whose form is drawn again in
   this redraw goes straight back (`refillParked`).
6. "Not saved yet · Undo my typing" goes beside the buttons of each form that got typing back.
7. **The anchor.** Skipped if the page scrolled itself while drawing (M8 count), or the form kit scrolled on purpose
   (forms G1: a `planner:reveal` during this draw); a page that scrolls itself wins. Otherwise the first link of the
   chain still drawn goes back to its old screen top (`holdAnchor`): the button; or its row if the button went away (a
   "Use this one" that becomes "yours"); or its fold or card. A link whose bottom would then be above the top bar plus
   44 px is skipped (a big card whose form went away must not be held off screen: that showed a blank screen on Goals
   in an earlier prototype).
8. **Room.**
   - If a link was held: the borrowed height stays only until the person scrolls to where it is no longer needed
     (`releaseRoom`), so nothing is clamped under the thumb.
   - If none was held: the page's own height decides at once, and the save's fresh notice is brought to the top of
     the screen instead of the page's foot (person critic S8; forms P4).
9. **Focus (forms N1).** If the box that had the focus is not drawn again (its form closed with the Save), the focus
   goes to this save's fresh notice when it is on the screen (`tabindex=-1`, `preventScroll`); otherwise it stays
   where it is. Focus never moves outside a redraw (forms N4).
10. **Confirmations**: M7.

- **Weighed.**
  - (a) A node-by-node morph of the new drawing into the old: fails. Pages close over the nodes they build, and the
    kit's form reads its boxes through those references. `e7-morph.mjs`: the screen shows 9,999 and Save sends 3,900.
  - (b) A draft inside `ui.form` only: misses hand-built boxes (Update my balances, Get started, the check-in note,
    the setup questions), and it is the forms track's file.
  - (c) Holding the redraw while a box has the focus (the first design's M8): declined, section 9.
  - (d) Chromium's own scroll anchoring: Safari has none, and the shell replaces the anchor node anyway. The build sets
    `overflow-anchor: none` on `html` so both browsers behave the same.
- **Measured on d22b718** (`fv/e2-redraw.mjs`, real taps, normal speed; `fv/out/e2-off.log` → `fv/out/e2-full2.log`):

  | flow | section | tapped control moved (+0.5 s / +5 s) | other form's typing | confirmation |
  |---|---|---|---|---|
  | retirement/projection, Retirement settings, Save | open → open (page fix d1973e2) | 33 / -23 → **-1 / -1** | | off screen → **bottom copy** |
  | debt/credit-cards, 0% move, Use these numbers | open → open (page fix, claude-g) | 0 → 0 | | in view → in view |
  | balance/update, Save all balances | | 109 → **-1** | | off screen → **copy with "See net worth ›"** |
  | retirement/withdrawal-strategy, Use this one | | 375 → 375 (the page scrolls its "Put it back" line into view on purpose, R4 review: the page wins) | | in view; **no duplicate copy** (decided one frame later) |
  | career/benefits, Commuting typed, Save | **shut → open** | -204 / -260 → **0 / 0** | "120" **lost → kept** | copy |
  | insurance/health, Add a plan typed, coverage Save | | 0 → 0 | "Silver PPO", "250" **lost → kept** | copy |
  | taxes/estimated, 1st quarter typed, Last year Save | page folds it on purpose: page wins | 317 / 380 → **-1 / -1** | "1,000" **lost → kept** | in view |
  | balance/accounts, note typed, Add this balance | | | note **lost → kept** | copy |
  | retirement/buckets, Save | **shut → open** | 251 → **0** | | copy |
  | retirement/medicare, Save in a fold | **shut → open** | 344 → **0** | | copy |

  Also measured:
  - B10 (`e6-pagedraw.mjs`, first draft, same code path): Runs changed with "How this is done" open → open; Stress
    tests "A crash like 2008" opened, then Now → open.
  - Safari-like runs (`anchor=off`, first draft): the same within 1 px.

### M4. Typing memory: what the person typed, where, and when it goes back

- **What counts as typing.** A control the person changed (a trusted `input` or `change` event) whose value differs
  from what the page drew (`defaultValue` / `defaultChecked` / `defaultSelected`: exactly "what the page drew from the
  saved plan"). Never kept:
  - boxes of type password;
  - boxes named or labelled token, API key, secret, password, pass code, passphrase or PIN;
  - boxes inside `[data-no-keep]`.

  ("Transit pass" is kept; "Access token" is not. AGENTS rule 10.)
- **Where it is filed.** At the first keystroke the box records the page path it was typed on (`where`) and its
  locator, taken while it is on its page. Saves file each box under that path, never under the address being opened.
  A page that replaces its own address (Get started's skipped question) refreshes the current path on the next input
  (break critic, should-fix 6).
- **Kept.**
  - `sessionStorage["planner.drafts(.sandbox)"]`: page path → `{ at, items: [{ k, tag, v, d, f, form, host,
    parked? }] }`.
    - `v`: the value typed; `d`: the value the page drew when it was typed against.
    - `f`: the form's identity (M5).
    - `form`: the words of its heading (for the line).
    - `host`: the locator of its row or card (where the line goes).
  - Separate from the places' key, so a large paste can never stop the place records (break critic, should-fix 7).
  - A page's typing over 20 KB is not kept. Typing older than 24 h is let go at boot (person S7).
  - A format version on both keys: a record of another version is dropped (scope critic, should-fix 2).
- **Written** 0.5 s after typing stops, on leaving the page, on `visibilitychange` hidden and on `pagehide`.
- **Dropped:**
  - for a form when it is submitted;
  - for the boxes a tapped button used when that tap saved the plan (`usedBy`: the button's form or card);
  - when the tap that saved the plan also leaves the page (no newer touch, within 1.5 s): the boxes of its own form and
    every box in no form, which is what it could have read (Import's "Import 10 transactions" goes on to Categorize;
    break critic, should-fix 4);
  - on "Undo my typing" and "Throw it away";
  - by Cancel: the last tap was a non-submit button inside that form.
- **The refill rule** (pure, `refills(draft, box)`): same form identity, the box still shows what the page drew (the
  page did not refill it itself), and what it drew is what it drew when typed against (its saved value did not move:
  the plan wins).
- **The page put it back itself**, so the shell stands aside: `already()` (the box shows the typed value), or
  `shownByPage` (a form with the same heading and button shows the value in one of its boxes). This covers Get started
  (`planner.setup.drafts`) and People (`kept.draft`), which keep their own (scope critic, blocking 1).
- **On every draw of a page** (a new visit, Back, Forward, Reload):
  - typing for a form on the page goes back in, with the cue;
  - typing for a form not on the page is parked, with one line before its row or card (`.notice.info.place-parked`);
  - when that line is not on the screen, the same words show briefly at the bottom.
- **A form the page takes away by itself.** One `MutationObserver` on `#content`:
  - It ignores everything while the shell clears or draws (`place.busy()` / `place.idle()`, which also calls
    `takeRecords()`), and before the page on screen is drawn. This is the fix for the phantom line (break critic,
    blocking 3; person critic, blocking 1).
  - A typed box the page removes is parked under the page it was typed on, unless it was dismissed by its own Cancel or
    sent by its own submit.
  - If the same form is drawn again in the same moment (a page redrawing its own section, Capital gains' "+$25,000"
    chip), the typing goes straight back, quietly.
  - Otherwise (a stray tap opened another row's form) the bottom note names the form, in the neutral style.
  - Folds the person set that a page's own redraw took away come back when the same fold is drawn again within 2 s
    (B10).
- **Weighed.**
  - (a) Asking before leaving: Back cannot be cancelled (popstate fires after the fact), and a dialog on every stray
    tap is noise; the person loses nothing if the typing is kept.
  - (b) A `ui.form` build-time refill hook instead of the observer (scope critic, should-fix 4): it misses hand-built
    forms and pages that redraw a section themselves. The two faults it was meant to avoid (blockings 1 and 3) were
    caused by the locator and by the observer's timing, both fixed and measured. Declined; section 9.
  - (c) `localStorage`: typing never saved should not outlive the visit or leak between tabs.
- **Measured on d22b718** (final prototype; the critics' own repro scripts, copied and pointed at 9367):

  | walk | first draft | final |
  |---|---|---|
  | Income: Ana's form, Amount 4,100 and Yearly raise 6, stray tap on Bo, Bo's amount typed, Save (`t1b-strayrow`) | Bo saved with growth 0.06 (Ana's) | **Bo stays 0.03**; the note names "Edit Ana's salary"; Ana again shows 9,999 with the cue (`j08`); Cancel discards |
  | Row swap census (`t-rowswap`): change every box in row A's form, tap row B | | expenses, liabilities, people: **0** boxes of B not as saved; A's typing back **2/2, 4/4, 3/3** |
  | Income: edit form 9,999, Back to the Dashboard (`t1-keptpark`, `j07 A`) | draft filed under the Dashboard, phantom line on later visits | **no draft under the Dashboard**, no line on Back, Forward or a later visit |
  | People: Bo's form, Retirement age 59, then the State choice saves (`t2-people`) | typing dropped | the page keeps its own form open now and **59 is kept**; a new visit shows the parked line |
  | Check-in: October's note typed, November chip, October chip (`t2b-checkin`) | note "" | November parks it; **October brings it back** |
  | Get started, owe-amounts, three boxes typed, reload (`j09`) | "We kept what you typed" over two guesses | **no false line**; all three come back through the page's own drafts |
  | Income: edit form typed, menu to Update my balances, save there, Back (`j07c-trace`) | blank screen, a 463 px jump at 2.9 s, line at -749 | from the first sampled frame (17 ms) the page stands at 356 px with its own height (1,200 px, no borrowed room) and **nothing moves for 4 s**; the line naming the form is on the screen (211 px from the top in `dbg-fwd`, the same landing reached by Forward) |
  | Import: pasted lines imported, new visit (`t4-import`) | "not saved yet" over imported lines | **empty box, no line** on the next visit: the tap that saved also left the page, so the typing it used is not kept (`reg-t4b`) |
  | Net worth: + Add another account typed, Save today's totals (`t-nw`) | drafts {} | **parked with its line** ("Not saved yet: what you typed in “Add an account”..."); opening the add form again shows "Brokerage two" and 12,000 with the cue (`reg-tnw`) |

### M5. The locator and the form's identity

- `key = scope | own name # n`.
  - **Scope**: the titles of the landmarks around the element, outermost first: a fold (its summary's first part,
    without `.fold-status`, the chevron and badges), a card or section (its `aria-label` or first heading), a list row
    in `.records` / `.page-list` (`.rec-title` / `.t`), and a form as `f:` plus its heading.
  - **Own name**: a control's `name`; else the words of its visible label (`.field-label`; pages rewrite `aria-label`
    as you type, which broke Get started: person critic, blocking 3); else `aria-label`, else placeholder. A fold or
    row is named by its title; anything else by its words.
  - **Titles lose their figures and badges** (`soft()`): "Ana's salary: $3,900" and "Ana's salary: $4,100" are the
    same row; "Trim after bad years" is the same with or without "yours".
  - `n` breaks ties only when the key is not unique; a key with one match is taken whatever its old `n`.
- **A form's identity** (`formIdOf(heading, submit, defaults)`, pure). It is the heading nearest above the form inside
  its card, section, fold or row, whatever its depth (`headingOf`; "Edit Ana's salary", not the card's "Income
  sources"), plus its submit words, both without figures, plus a hash of what each of its boxes drew. Twin forms under
  one card heading differ by what they drew. This is the first design's same-form rule, with the per-box locator kept
  inside it (break critic, blocking 1).
- **Measured.** First draft, `e5-locator.mjs`:
  - 157 pages × 3 households: 8,484 of 8,484 elements found again; 0 wrong after a redraw.
  - Against a changed drawing (a notice added on top and a new first row in every list): 3,093 of 3,093, 0 wrong. A
    position-only locator finds 151 of 3,093.

  The final rule only adds conditions (form identity, visible label first), so it can refuse more, never match more
  wrongly. The row-swap census and `t1b` above are the cases the census could not see.

### M6. "‹ Back to ..." links go back

- **Where.** `core/app.js` `installBackLinks()`: one `click` listener on `document`, bubble phase, so the frame's own
  guard and page handlers run first and can still `preventDefault`. It acts on any `a[data-back][href^="#/"]`: on the
  page, in the frame, in the bottom copy, and on taps' named rows. If `router.back(href)` returns true it calls
  `preventDefault()` and removes the bottom copy; otherwise the link is followed as today.
- `frame.js` marks its eight back links `data-back`, including the two without "‹" ("Back to quick answers", "Back to
  your plan ›"). There is no "‹" text heuristic: no module has such a link today, and a future "‹ Previous month" must
  not become Back (scope critic, should-fix 3).
- **Measured.**
  - Final prototype (`fv/out/reg-e4.log`): from the check-in, three steps, each "‹ Back to the ... check-in" lands where
    the person was (365, 365, 818 px; dy 0) with history +0, and one Back press reaches the Dashboard. Quick answers
    985 → 985 and Your plan 894 → 894, history +0, one Back press to the Dashboard.
  - The echo's "‹ Back to the November 2026 check-in" (`t5-echolink`): **adds no history entry, removes the copy, and
    the next Back reaches the Dashboard** (first draft: history +1, copy still on the next page).
  - Your plan → Life insurance → Next result → Will the money last? → "‹ Your plan" (`j03-plan`): back two steps to
    885 px (left at 885), history still 4 entries; nothing is replayed by the next Back (first draft: y 0, history +1,
    and Back replayed both results).
  - First draft: check-in three steps, 7 Back presses to the Dashboard today against 1 here; Quick answers 985 → 985;
    Your plan 885 → 885.

### M7. Confirmations where the eye is, and still

- **Seen** (pure, `seenEnough`): at least 60% of the notice's height (or 48 px) is between the top bar and the bottom
  edge, and it is not inside a shut fold. Today one pixel anywhere counts, so a line hidden under the top bar
  (p-taxes/x-5: 14 px under a 56 px bar) or inside a shut fold counts as seen.
- **Fresh notices** are the `.notice.ok` / `.notice.error` the redraw produced that were not there before (or that
  repeat the last save's words).
- **The bottom copy (`echo(text, kind, ways, near)`).** It is decided one frame after the draw (`requestAnimationFrame`
  then `setTimeout 0`): a page that scrolls its own line into view in its next frame (withdrawal-strategy's "Put it
  back") is then seen, and no copy is shown.
  - Kinds:
    - `ok`: green tick.
    - `bad`: red, at least 6 s.
    - `info`: no tick. Used for kept typing, because nothing was saved and AGENTS reserves green for good (person
      critic, blocking 2).
  - Up to two ways on, as 44 px taps (`.save-echo-go`, the only part with `pointer-events`):
    - first, the notice's own action: forms G3, `button.notice-action` (Undo), else its first link or button;
    - second, the frame's `a[data-back]` of the page it was opened from (MR-1, person critic S1).

    A link is a real link (with `data-back` when the original has it, so M6 routes it). A button proxies a click to
    the page's own button while that is still on the page.
  - At the top (`.at-top`, under the top bar) when at the bottom it would cover the control just tapped (person
    critic S2).
  - Stays `echoStay(text, ways, bad)`: 1.2 s + 0.28 s a word, + 3 s with a way on, between 4 and 12 s (pure, tested).
  - Removed when the address changes and when its back link is tapped (break critic, blocking 4; person critic S3).
  - It is a short note that leaves, never a fixed bar (design log 2026-11-06).
- **Nothing pulls the page under the thumb.**
  - Each fresh notice of a save gets its own `remove()`. It removes only inside a trusted event dispatch
    (`window.event?.isTrusted`): a person's tap on the notice's own Close or Undo. Page timers
    (`setTimeout(() => n.remove(), 4000)`, 100 lines in 95 views on the tip) never have one. The notice stays until the
    next redraw replaces it.
  - Notices the forms kit moved (`[data-moved]`, forms G2) are left alone.
  - This replaces the first draft's "0.9 s after a touch" exception, which let the timer through exactly while a thumb
    rested on the glass (break critic, should-fix 1; person critic, blocking 4).
- **Measured.**
  - Goals edit Save with a thumb down at +3.9 s (`t11b-goals-thumb`): today the rows move 56 px and the notice goes;
    final: **0 px, the notice stays**.
  - Update my balances from the check-in (`j04`): the copy carries **"See net worth ›" and "‹ Back to the October 2026
    check-in"**. It sits at the top (64-246 px) because at the bottom it would cover Save, and Save stays under the
    thumb.
  - withdrawal-strategy: no duplicate copy once the page scrolls its line into view (table in M3).

### M8. The page's own scroll calls, counted once (`wrapScroll` in `core/place.js`)

- One wrapper for `window.scrollTo`, `scrollBy`, `scroll` and `Element.prototype.scrollIntoView`, `scrollTo`, `scrollBy`
  and `focus`. It passes `this`, every argument and the return value through.
- It has two hooks:
  - place's counter, which counts only while a page draws (`drawingNow`);
  - taps' reduced-motion hook (`behavior: "smooth"` → `"auto"` while the phone asks for reduced motion; taps adds it in
    its step 6).

  One wrapper, two hooks: never two wrappers of the same function (scope critic, blocking 5).
- Why count instead of reading `scrollY`: the browser moves `scrollY` during a redraw by itself (279 px on Will the
  money last? with no call).
- `html { overflow-anchor: none }` in base.css: Chromium then behaves as Safari, so the carry never leans on Chromium's
  anchoring.

---

## 3. What pages must do (wave 2), re-cut on d22b718

Nothing below is needed for B1 to B12. Each row has an owner.

| page(s) | change | owner | finding |
|---|---|---|---|
| the 21 list pages with an edit form opened from a row: cashflow/income, cashflow/expenses, cashflow/budget, goals/goals, balance/liabilities, balance/net-worth, household/people; investments/holdings, investments/tax-lots, insurance/policies, insurance/health, estate/inheritance, estate/digital, estate/gifting, taxes/capital-gains; transactions/ledger, transactions/rules, transactions/categories; retirement/contributions, retirement/pensions; goals/travel | When the form opens: `const release = ctx.layer(() => cancelEdit())`; Save, Cancel and every other close call `release()`. One to three lines per page. Pages adopting forms2's `ui.openUnder` add it in the same edit (the `close` that `openUnder` returns is the `cancelEdit`). | claude-g's lane (cashflow, goals, balance, household); claude-h's (investments, insurance, estate, taxes); claude-d's (transactions); retirement (claude-e released it): claude-b. All released their wave 2 claims, so claude-b assigns the work after P1 lands. goals/travel (claude-a): one line in claude-a's handoff file | j-debt-fixer/x-2, p-cashflow-a/CF-3, j-fat-fingers/x-2 (form half) |
| retirement/monte-carlo | Say "Now using 2,000 pretend futures" beside the choice after a change, and give it the focus back | claude-b wave 2 follow-up (claude-e released `modules/retirement` and listed W4 as waiting for wave 1) | j-heavy-waiting/W4 (the "says nothing" half) |
| retirement/roth-conversions | Leave out stop ages at or before the retirement age, so a change cannot collapse the page (content, not place) | claude-b wave 2 follow-up (same) | p-retirement-b/RB1 (Roth part) |
| the 85 views outside claude-a's lane with `setTimeout(() => n.remove(), ...)` | One scripted change deletes the timer lines (dead once P8 holds), plus a `tools/check.mjs` rule against new ones. claude-a's 10 views keep theirs: the shell's shim covers them. | claude-b, after P8 lands (not wave 1's files) | j-first-retiree/x-2, p-transactions-helpers/x-notice-jump (cleanup) |
| list rows | `data-key="<record id>"` on each row (forms2 asks for it for Cancel's return). With it, the shell can also let go of parked typing whose row's saved figures changed. | page lanes, with forms2's adoption | scope should-fix 2 (later) |
| insurance/health | Optional: put "Your coverage and your bills" above "Add a plan" while there are no plans | claude-h's lane | p-insurance-estate/x-1 (page order) |
| overview/setup, household/people | Nothing. They keep their own drafts (`planner.setup.drafts`, `kept.draft`) and the shell stands aside. CONVENTIONS asks new pages not to build their own. | — | j-first-family/F2, j-first-renter/x-4 (closed by page commits) |

---

## 4. Risks: what could get worse than today, and the check that catches it

1. **Typing put into the wrong form or box.**
   - Guard: same form identity + same box + box at its drawn value + same drawn value.
   - Checks: `t-rowswap` (0 boxes of B changed; must stay 0); `t1b-strayrow` (Bo's growth unchanged); `e5-locator`
     (0 wrong).
   - Touch rule asked: **D-ROW-SWAP**.
2. **A refill fires `input`/`change` and a page that saves as it changes saves the typing without a tap.**
   - Only typing whose drawn value is unchanged is refilled, and a save-on-change control is saved the moment it
     changes, so it is never a draft.
   - Check: in `e3-drafts`, `plan.meta.updatedAt` must not change between arriving and the next tap.
3. **A phantom line** (typing claimed on a page where it was not typed).
   - Guards: `where`-path filing; the observer is off while the shell clears or draws.
   - Checks: `t1-keptpark`, `j07-income`.
   - Touch rule asked: **D-NO-PHANTOM**.
4. **The hold fights the person, or scrolls the wrong page.**
   - It stops at the first touch, wheel or key, at another address, at `planner:reveal`, and after 8 s or 700 ms
     still.
   - Checks: `t7b-wheel-up`, `t14b-menu-anchor`; an `e1` variant that swipes 200 ms after Back must end where the
     swipe took it.
5. **The conflict bar scrolled away.** No hold while `#sync-bar` exists at arrival; `showConflict()` cancels the hold.
   Check: `t12c-syncbar-real` (bar at the top after Reload and after Back, fresh or already up).
6. **Blank room after a save or a return.**
   - Room is borrowed only until the place is drawn, and is released as soon as the page fits.
   - Checks: `j07c-trace`; `tools/shot.mjs` after the projection save and after Goals edit Save, then a swipe up: no
     gap.
7. **History confusion** (Get started's `suFrom`, the drawer's layer, a stale layer entry after a reload).
   - State is always spread; layers carry their own id; stale layers are stepped off.
   - Checks: `qa/flows/path-walk.js`; `t-layer`; taps' `m4-menu.mjs` after taps step 4; a step URL opened in a fresh
     tab must follow "‹ Back to the check-in" as a link.
8. **Storage unavailable or full.**
   - Every read and write is in try/catch, with memory only; separate keys; the 20 KB cap.
   - Check: the single-file demo in a sandboxed frame (`qa/user-view.mjs`).
9. **The notice shim blocks a page's own removal.** Only fresh notices of the last save are covered, and a person's tap
   still removes. Check: grep the build for `.notice` removals that are not timers (none in the views today).
10. **Cost on long pages.**
    - The observer handles removed subtrees only; `topThing` and `holdAnchor` measure a few elements; locating on All
      pages takes 8 ms at 4x CPU (`cb/t15-cost.mjs`).
    - Check: touch rule D-TIME on overview/pages and transactions/ledger.
11. **Privacy.**
    - Typing never saved stays in `sessionStorage` for the visit and at most a day; separate keys in the sandbox; never
      in the plan or `localStorage`; never sent; secrets never kept.
    - Check: node test `secret boxes are never kept`; type in Settings' Access token box, leave, Back: no draft for
      system/settings. The build removes `window.__place` and `__placeLast` (scope critic, should-fix 6).
12. **Focus put back on iPhone may open or close the keyboard.** Focus moves only in a save's redraw: back into the same
    box, or to the green line when the box's form closed. Check on the phone (section 5).
13. **D-TOP in the touch sweep.** A `data-back` link now lands where the person was. The sweep must check
    `a[data-back]` (also `.save-echo a`) with D-BACK's measure, not D-TOP's.
14. **The wrapper drops an argument or a return value.** Check: a node test of `wrapScroll` on a stub object (this,
    arguments, return value, counts only while drawing); `node qa/smoke-all.mjs` page errors unchanged.
15. **The echo decided one frame late is shown on the next page.** It checks `renderSeq` before showing, and every
    address change removes it. Check: `t5-echolink`, and a save immediately followed by a menu tap: no copy on the new
    page.
16. **A layer left open by a page that forgets `release()`.** The next Back would only close a form that is gone.
    Guard: the router forgets every open layer on an address change, and a stale layer entry met by Back is stepped
    off. Check: `t-layer` (a layer left open, then a link: Chromium fires `popstate` before `hashchange`, so the layer's
    `close()` runs once as the page is left; one Back then returns to the page, and nothing is closed twice) plus a
    page-level walk per adopting page (wave 2).
17. **The save-and-leave rule drops typing the save did not read.** It applies only when one tap saved the plan and
    changed the address, with no newer touch. Five views on the tip do both in one handler: balance/accounts,
    cashflow/recurring, overview/setup (which keeps its own drafts), transactions/import, transactions/statements. Check:
    P7 walks each of the five once: typing in another form survives, and every box in no form that the handler did not
    read is listed (expected 0; Import's paste box is read).

---

## 5. iPhone Safari

Where Safari differs for these mechanisms:
- **`history.scrollRestoration` and `history.state`** are supported (Safari 11+); `replaceState` is limited to 100
  calls per 30 s, and we call it once per new entry. With "manual", Safari does not restore at all, so the result no
  longer depends on its timing.
- **No CSS scroll anchoring.** Everything that keeps what is under the thumb is our own code, and Chromium runs with
  `overflow-anchor: none` are a fair stand-in.
- **The swipe-back gesture** shows a picture of the previous entry while the finger moves; on release the redrawn page
  appears at the same place from its first frame (`scrollTo(y)` before the draw), so at most one frame differs.
- **`element.focus()` outside a tap may not raise the keyboard.** Focus is put back only after a save; the caret may be
  there without the keyboard.
- **A home-screen app the system killed** opens fresh at `start_url`: no history, no sessionStorage. B3, B7 and B8 hold
  within a visit, not across a cold start. A tab Safari discards in the background usually comes back with its session,
  but this must be seen on the phone.
- **The home-screen app has no swipe Back**, so on-screen back links are its only way back (break critic, blocking 4).
- **`pointerdown`** may fire as a scroll starts on iPhone. That only ends a return hold sooner (the person took over).
  It no longer matters for notices (trusted-event rule).
- **`visibilitychange` to hidden** fires when switching apps and locking; `pagehide` on reload. We save on both; no
  `unload` listener.

**Phone checks for the owner** (each under a minute; Safari tab unless the check says home-screen app; today first, then
after the build):
1. Your plan (Safari): scroll half way, tap a row, swipe back from the left edge. Is the same row at the same height? Ten
   times. Then swipe forward.
2. Will the money last? (Safari): open "Retirement settings", scroll so it is half way, reload. Same place, still open?
3. Will the money last?: in "Retirement settings" change the spending and tap Save. Then rest your thumb on the screen
   for five seconds. The section stays open, a green line is on the screen (or Save stays under your thumb), and nothing
   moves.
4. Update my balances: type two balances, do not save, switch to your bank app for two minutes and come back. Still
   there, with "Not saved yet · Undo my typing"? Then lock the phone for a minute, then reload: still there?
5. Income: tap Ana's salary, change the amount, then tap Bo's salary by mistake. Bo's form shows Bo's figures, the note
   names "Edit Ana's salary", and tapping Ana's salary again shows your figure.
6. Income: tap a salary, change the amount, swipe back to the Dashboard. No "not saved" line on the Dashboard. Open
   Income from the menu: one line at the salary says what you typed is kept; tap the salary: your figure is back.
7. Check-in, as a home-screen app: open a step from the check-in, save there, and tap "‹ Back to the November check-in"
   in the short note. You are back at the check-in where you were. Then, in Safari, the same and one Back: the
   Dashboard?
8. Keyboard up: type in a box near the bottom of a page with two forms, then tap the other form's Save. Where does the
   short note sit, and does the keyboard close or jump open by itself?
9. Settings: open "Assets and debts", go to the Dashboard from the menu, swipe back. Still open?
10. With your computer holding a different copy of the plan (the "changed in two places" bar): reload a page half way
    down. The bar is at the top on the screen, not scrolled away.
11. Home-screen app: type in a form, close the app from the app switcher, open it again. The typing is not expected to
    survive: say whether that is acceptable.
12. Swipe back slowly and watch: does the picture during the swipe match the page that appears, or does it flash once?

---

## 6. Build steps (each verifiable alone; the same list as `steps.json`)

Landing order with the other tracks is in section 7.

- **P1. `core/router.js`: entries, trail, back, layer** (+ `ctx.layer` in `makeCtx`, `router.start(onChange(route,
  entry))`). Node tests for `stampOf`, `splitHref`, `backSteps` (one step, month rule, fresh tab, trail walk, mixed
  trail). Lands before taps step 4.
- **P2. `wrapScroll` and `overflow-anchor: none`.** `core/place.js` exports `wrapScroll(obj, name, hook)`; `app.js`
  installs it once on window and `Element.prototype` with place's counter hook. base.css: `html { overflow-anchor:
  none }`. Node test on a stub. Lands before taps step 6, which adds its reduced-motion hook to the same wrapper.
- **P3. `core/place.js` pure rules and the locator**, with their node tests: `soft`, `pathOf`, `prune`,
  `secretName`, `fresh`, `DRAFT_MAX`, `foldKeeps`, `refills`, `already`, `formHead`, `formIdOf`, `seenEnough`,
  `echoStay`, `overlaps`; `locate` / `find` / `headingOf` / `topThing` / `snapshot` / `apply` (DOM). No wiring yet.
- **P4. Back, Forward, Reload** (M2): `createPlace` records, `leave` / `arrive` / `drawn`, `holdPlace` (8 s, 700 ms
  quiet stop, touch, wheel, key, `routeSeq`, `planner:reveal`), the room rule, `scrollRestoration = "manual"`, the
  sync-bar guard and `showConflict()` → `cancelHold()`, `visibilitychange` / `pagehide` saving. Wired in `show()`; the
  prototype's `?place=off` switch stays until P9.
- **P5. Back links** (M6): `installBackLinks()` on `document` for `a[data-back]`; `data-back` on frame.js's eight links.
- **P6. Carry across a save** (M3): snapshot, apply, `keep` (parked, never dropped), `refillParked`, cues, `holdAnchor`,
  the room rule, forms N1 focus, `planner:reveal` as "kit moved". The prototype's `show()` helpers (`arrived`,
  `parkedLine`, `releaseRoom`, the keepScroll steps) move into `place.js` as `place.afterArrive(root, arrival, opts)` and
  `place.afterSave(root, carry, opts)`, so `show()` keeps only calls.
- **P7. Typing memory across visits** (M4): drafts per page filed by `where`, the observer with `busy` / `idle`, the
  parked line, Cancel dismissal, the sent form, `usedBy`, secrets, 24 h, 20 KB, the format version, separate keys.
- **P8. Confirmations** (M7): `seen`, fresh notices, the remove shim (trusted events only, skip `[data-moved]`), `echo()`
  kinds, ways, `.at-top`, stay by length, decided one frame later, removed on an address change. base.css:
  `.save-echo.info`, `.save-echo.at-top`, `.save-echo-ways`, `.save-echo .save-echo-go`, `#content .place-cue`.
- **P9. Docs and clean-up.**
  - Remove `?place=off`, `window.__place`, `__placeLast` and every measuring switch.
  - CONVENTIONS: "What the shell keeps for you" (open sections, typing, focus, the place; pages do not build their own
    draft or place keeping; notices need no timer; an edit form over the page calls `ctx.layer`; back links carry
    `data-back`).
  - The DESIGN_LOG entry (section 7) and the CHANGELOG line per step.
  - The touch-sweep rules handed over (below).
  - claude-a's handoff line: their pages need nothing; their timers are covered.

**Touch rules** (`wtouch/qa/touch-rules.json`).
- Should turn green: **D-BACK** (strict, once the race is gone: within 100 px, same sections, Forward too),
  **D-SCROLL-KEPT** (window extended to 5 s after a save and after Back, as the person critic asks), **D-SEEN** (the
  copy counts), **D-FOCUS-KEPT**.
- **D-TOP** must stay green, with the exemption for `a[data-back]` and `.save-echo a`, which are checked as Back.
- New rules asked of the sweep's owner:
  - **D-DRAFT**: type, leave by a link, the menu or Back, return: the typing is there.
  - **D-OTHER-FORM**: type in form A, save form B: A keeps it.
  - **D-FOLD-KEPT**: a fold opened stays open after a save and after Back.
  - **D-STILL**: nothing moves for 6 s after a save, a thumb resting at 4 s.
  - **D-ROW-SWAP**: change every box in row A's form, tap row B: B's form shows B's saved values.
  - **D-NO-PHANTOM**: after any Back or Forward, no `.place-parked` line or `.place-cue` on a page where nothing was
    typed.

---

## 7. Design log, lanes, the seams with taps and forms2

**Decisions relied on** (docs/DESIGN_LOG.md):
- 2026-11-06 (one path): "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the
  page's own buttons)". The bottom copy stays a short note that leaves by itself; it moves to the top rather than cover
  the button just tapped.
- 2026-11-06 (one path): Get started shows "the eight tiles folded behind “Just want one answer?”". A fresh visit draws
  folds as the page designs them; only Back, Forward and Reload bring back what the person opened.
- 2026-09-16 Pass 4 Finding 4 (Social Security): "the one just saved stays open". M3 generalises it: a fold the person
  opened stays open after a save, unless the page now draws it differently.
- 2026-09-15 Net worth round 4: "Cancel folds it". Cancel still throws typing away.
- 2026-09-15 Settings round 6 Finding 4: confirmations in a module-level `pending`, shown by the next render, a green
  notice for every save. Unchanged; the shell only keeps the notice on screen.
- 2026-11-06 (user view): no build, PC, AI or sync words in the household's view. The new words on screen:
  - "Not saved yet"
  - "Undo my typing"
  - "Not saved yet: what you typed in “Edit Ana's salary”. Open it again to finish it."
  - "Throw it away"

  "Undo my typing" is used, not a bare "Undo", which the kit keeps for taking back a change to the plan (forms N6).

**Lanes.**
- Files this track changes:
  - `core/router.js`
  - `core/place.js` (new, the one new file under `core/`)
  - `core/app.js` (`show()`'s place calls, `echo()`, `installBackLinks()`, `makeCtx().layer`, boot wiring,
    `showConflict()`'s `cancelHold()`)
  - `core/ui/base.css` (shell selectors only: `html`, `.save-echo*`, `#content .place-cue`)
  - `modules/overview/guide/frame.js` (`data-back` on eight links)
  - `tests/place.test.mjs`
  - docs: CONVENTIONS, CHANGELOG, DESIGN_LOG, TEAM claim
- Not changed: no view.js, nothing of claude-a's, nothing in setup/compute, projection/compute or the guess
  estimators, nothing in `core/ui/dom.js` (forms).

**The seams** (who changes which function, in what order, what each provides). This answers scope critic, blocking 5.

| # | seam | owner | provides | used by | order |
|---|---|---|---|---|---|
| S1 | one numbering of entries: `router.entry()`, `first()`, `at(n)`, `start(onChange(route, entry))` | place2 (P1) | the numbers and the trail | taps M6 (Back button `n > first`, its name from `router.at(n-1)`, `ctx.cameFrom()`); place2 M2 records | P1 before taps step 4; taps' `stampEntry()` and `planner.firstEntry` are not built |
| S2 | `router.layer(close)` → `release()` | place2 (P1) | Back closes what opened over the page | taps M5 drawer (its open calls `layer`, every close path, including `show()`'s `closeDrawer()`, calls `release()`; a row followed from the open drawer uses `location.replace(href)`); list pages in wave 2 via `ctx.layer` | P1 before taps step 4 |
| S3 | `router.back(href)` and `a[data-back]` | place2 (P1, P5) | a back link that is a Back | frame.js's links (P5); taps' named rows ("‹ Back to Needs attention") are `a[data-back]` with the page's address, so the one document listener handles them; `ctx.goBack()` stays for taps' buttons (`router.back(href) \|\| history.back()`) | P5 before taps' named rows |
| S4 | `via: "menu"` on an entry | taps (step 4) | `router.open(href, { replace, via })`: records `via` in the next entry's trail item | taps' "not via the menu" rule | after P1, in taps' step 4, in `core/router.js` |
| S5 | the top of `show()` | both | order: taps' address correction (M8) → place `leave()` + `cancelHold()` + echo removal (new address only) → `cleanup()` → `current = route` → `place.arrive(router.entry())` → `scrollTo(rec ? rec.y : 0)` and the held height → taps' one-frame paint-first wait (new address only) → render | | taps step 5 lands after P4 and puts its wait after the scroll line, so a return paints at its place, never at the top (scope critic, blocking 5) |
| S6 | the end of `show()` | both | order: a new address: `place.afterArrive()` → taps `landFocus()` (only when the focus is not already in `#content`). A save: `place.afterSave()` (folds, typing, anchor, N1 focus, notice shim; the copy decided one frame later) → taps `announce()` of the same fresh notices (`place.fresh()`) | | either order of landing; the later one adds its line |
| S7 | scroll calls | place2 (P2) | one `wrapScroll(obj, name, hook)` | place's counter; taps' reduced-motion hook | P2 before taps step 6; taps adds a hook, not a wrapper |
| S8 | the kit scrolled on purpose | forms G1 | `planner:reveal` on `window` | place: "kit moved" for this draw (no anchor), and a return's hold ends | any order; without forms the event never fires |
| S9 | a notice the kit moved | forms G2 | `[data-moved="kit"]` | place's notice shim skips it | any order |
| S10 | the notice's one button | forms G3 | `.notice.ok > button.notice-action` (Undo) | place's copy offers it first | any order; without forms the first link or button is used |
| S11 | nothing moves between a finger's down and its click | forms G4, place | the kit inserts nothing then; place's redraw runs after the click's task; the return hold stops at `pointerdown`; the copy is `position: fixed` and covers nothing it was not placed to cover | taps' tap guard (D-TWICE) | |
| S12 | asks from forms of place | place2 | N1 (focus the fresh notice when the focused box's form closed), N2 (page and kit scrolls win), N3 (values put back quietly: `.value` plus `input`/`change`, never `reportValidity`), N4 (focus moves only in a redraw), N6 ("Undo my typing") | forms | built in P6, P8 |
| S13 | one bottom note | place2 | `echo()` is the only bottom note: forms2 dropped `ui.toast` / `.undo-bar` | everyone | |
| S14 | base.css | each its own block | place: `html { overflow-anchor }`, `.save-echo*`, `#content .place-cue`; forms: its form, notice and fold blocks; taps: the drawer, `#nav-back`, the top bar, and one shared reduced-motion line, merged by whoever lands second | | |
| S15 | frame.js | place2 (attributes), taps (named row) | different lines; the named row carries `data-back` | | |

**Who changes which function** (so three builders never edit the same lines):

| file | place2 changes | taps changes | forms2 changes |
|---|---|---|---|
| `core/router.js` | all of it in P1: `stampOf`, `splitHref`, `backSteps`, `entry`, `first`, `at`, `back`, `layer`, `start` | adds `open(href, { replace, via })` in its step 4, after P1 | nothing |
| `core/app.js` `show()` | `leave` / `arrive` / the held height / `scrollTo` at the top; the keepScroll branch; the `afterArrive` call | the address correction before choosing the module; the one-frame wait after place's `scrollTo`; `landFocus()` and `announce()` at the end; `closeDrawer()` | nothing |
| `core/app.js`, other functions | `echo()`, `installBackLinks()`, `makeCtx().layer`, the boot lines (`place.init`, `watch`, the `planner:reveal` listener, `wrapScroll` install), `showConflict()`'s `cancelHold()` | `paintDrawer`, `openFromMenu`, `buildNav`, `searchBox`, `updateBack`, `landFocus`, `announce`, `missingCard`, the tap guard install, its reduced-motion hook on `wrapScroll` | nothing |
| `core/ui/dom.js` | nothing. Place reads what the kit draws (`name`, `.field-label`, `.form-actions`, `button.notice-action`, `[data-moved]`) and listens for `planner:reveal` | nothing | every function |
| `core/place.js` | all (new) | nothing | nothing |
| `modules/overview/guide/frame.js` | `data-back` on the eight back links | the named "‹ Back to <page>" row (with `data-back`) and the check-in trail one page further | nothing |
| `core/ui/base.css` | `html { overflow-anchor }`, `.save-echo*`, `#content .place-cue` | drawer, `#nav-back`, top bar, the shared reduced-motion line | form, notice and fold blocks; the shared reduced-motion line |

**Choices made without asking the owner** (the conservative option each time). P9 records them in docs/DESIGN_LOG.md
under 2026-11-11, as taps does:
1. A save's green line stays until the next action instead of leaving after 4 s.
2. Typing not saved is kept for the visit (sessionStorage), at most 24 h, never across a closed tab or a home-screen app
   relaunch.
3. The short note at the bottom stays 4 to 12 s by length, moves to the top rather than cover the button just tapped,
   and carries at most two ways on.
4. On-screen back links go back only when the page they name is just behind (or behind along one "Next result" walk);
   otherwise they open it as today.
5. Nothing asks before leaving a page with typing; the typing is kept instead. The frame's existing guard on the path's
   Next stays as it is.
6. Back never brings back an edit form open by itself: the line says what is kept and opening the row brings it back.
   (The instant kept page was cut.)

---

## 8. Coverage (52 findings), with status on d22b718

Legend:
- **shell**: closed in full by wave 1.
- **page + shell**: a page commit on the tip closed part, and the shell closes the rest.
- **page**: closed by a page commit on the tip; the shell stands aside.
- **part**: the shell closes what it can, and the rest has a named owner (section 3).

| finding | closed by | status |
|---|---|---|
| SH-BACK j-first-family/x-1 | B1 | shell |
| SH-BACK j-first-freelancer/x-2 | B1 | shell |
| SH-BACK j-first-retiree/x-1 | B1 | shell |
| SH-BACK j-heavy-waiting/W1 | B1, B2 | shell |
| SH-BACK j-monthly-return/x-back-top | B1 | shell |
| SH-BACK j-navigator/N1 | B1, B2, B3, B4 (the '‹ Your plan' walk) | shell |
| SH-BACK p-career-household-system/F1 | B1, B2 | shell |
| SH-BACK p-cashflow-a/x-1 | B1, B2 | shell |
| SH-BACK p-insurance-estate/IE-1 | B1 | shell |
| SH-BACK p-overview-home/OV-1 | B1 (Forward too) | shell |
| SH-BACK p-retirement-a/R-A2 | B1, B2 | shell |
| SH-BACK p-retirement-b/x-2 | B1, B2 | shell |
| SH-BACK p-retirement-c-scenarios/x-back-loses-place | B1, B2 | shell |
| SH-BACK p-taxes/x-1 | B1, B2 | shell |
| SH-BACK j-first-renter/x-3 | B1 | shell |
| SH-BACK j-monthly-return/x-backlink-history | B4 (on the page and in the bottom copy) | shell |
| SH-BACK j-one-answer/A5 | B2 | shell |
| SH-BACK j-one-answer/x-4 | B4 | shell |
| SH-BACK p-overview-path/x-2 | B2 | shell |
| SH-DRAFT p-insurance-estate/x-1 | B6 (health: kept); the page order is optional (claude-h) | shell |
| SH-DRAFT p-taxes/T1 | B6 (a, b, d, e), B7 (c) | shell |
| SH-DRAFT j-debt-fixer/x-2 | typing: B7 (kept, the line names the form); Back closing the form: B13 helper (P1) plus `ctx.layer` adoption on balance/liabilities (claude-g's lane) | part |
| SH-DRAFT j-fat-fingers/FF2 | (1) B9; (2) B7 (kept, reopened from the line); (3) B7 | shell |
| SH-DRAFT j-first-family/F2 | Get started keeps its own drafts (6a65660, 030bebe); the shell stands aside (no false line, `j09`) | page |
| SH-DRAFT j-monthly-return/x-typed-lost | B7, B8; B6 for the check-in note across the month chips (`t2b`) | shell |
| SH-DRAFT j-navigator/x-2 | B7, B8 | shell |
| SH-DRAFT p-balance/B1 | B7 | shell |
| SH-DRAFT p-balance/x-1 | B6 (accounts: kept); Net worth's add form folded by "Save today's totals": parked with its line (`t-nw`) | shell |
| SH-DRAFT p-career-household-system/x-1 | B6 (b, c, d: benefits kept); (a) People keeps its form open and its own draft (e4bc7af), and the shell parks the typing if the form closes (`t2`) | page + shell |
| SH-DRAFT p-cashflow-b-goals/x-3 | B7 | shell |
| SH-DRAFT p-debt-property/x-3 | B7 | shell |
| SH-DRAFT p-insurance-estate/IE-9 | B7 | shell |
| SH-DRAFT p-retirement-a/x-2 | B7 | shell |
| SH-DRAFT p-retirement-c-scenarios/x-half-typed-form-lost | B7 | shell |
| SH-DRAFT j-fat-fingers/x-2 | typing: B7; the menu: taps M5 on `router.layer` (S2); an edit form: `ctx.layer` adoption (section 3) | part |
| SH-DRAFT p-career-household-system/F2 | B7 | shell |
| SH-DRAFT p-cashflow-a/CF-2 | B7 | shell |
| SH-DRAFT p-cashflow-a/CF-3 | typing: B7; Back closing the form: `ctx.layer` adoption on cashflow/income and expenses (claude-g's lane) | part |
| SH-DRAFT p-investments/INV-4 | B7, B2 | shell |
| SH-DRAFT j-first-renter/x-4 | Get started keeps its own drafts (page commits as F2); the shell stands aside | page |
| SH-REDRAW j-first-freelancer/x-1 | B5 (benefits, buckets, medicare: open, 0 px) | shell |
| SH-REDRAW j-monthly-return/MR-1 | B11 (`j04`: the copy carries "See net worth ›" and "‹ Back to the ... check-in") | shell |
| SH-REDRAW j-one-answer/x-2 | d1973e2 keeps the section open and draws "saved"; B5 (-1 px), B11 (copy) | page + shell |
| SH-REDRAW j-debt-fixer/x-3 | Credit cards: claude-g's `keepOpen` (0 px, open); Consolidation (claude-a's page): B5 by the shell | page + shell |
| SH-REDRAW j-first-retiree/x-2 | B12 (trusted-event shim); the timer deletion is wave 2 cleanup (claude-b) | shell |
| SH-REDRAW j-heavy-waiting/W4 | B10 (the sections); "says nothing" and focus: monte-carlo line (claude-b, wave 2) | part |
| SH-REDRAW p-balance/B2 | B5 (109 → -1 px), B11 (the copy with its link) | shell |
| SH-REDRAW p-retirement-a/R-A4 | as j-one-answer/x-2 | page + shell |
| SH-REDRAW p-retirement-b/RB1 | B5 (fold); Roth's stop ages: claude-b, wave 2 | part |
| SH-REDRAW p-retirement-b/x-1 | claude-e's R4 line ("Put it back", no timer, brought into view on purpose); B12 for the timer case; no duplicate copy (M7) | page + shell |
| SH-REDRAW p-transactions-helpers/x-notice-jump | B12; timer deletion in wave 2 | shell |
| SH-REDRAW p-taxes/x-5 | B11's seen rule (node test: 14 px under a 56 px bar is not seen) | shell |

**Totals:** 52 findings.
- 40 shell.
- 5 page + shell (p-career-household-system/x-1, j-one-answer/x-2, j-debt-fixer/x-3, p-retirement-a/R-A4,
  p-retirement-b/x-1).
- 2 page (j-first-family/F2, j-first-renter/x-4).
- 5 part, each with its remaining piece owned in section 3 (j-debt-fixer/x-2, j-fat-fingers/x-2, p-cashflow-a/CF-3,
  j-heavy-waiting/W4, p-retirement-b/RB1).
- None declined.

---

## 9. Answers to the critics

Each blocking item: what I changed, or why it does not hold, with the evidence from the final prototype on d22b718.
Then each should-fix: taken or declined, with the reason.

### Break critic (`critique-break.md`)

**Blocking 1. Typing went into another row's form and was saved there.** *Changed.*
- Typing goes back only into the same form, judged by `formIdOf`: the heading nearest above the form inside its host,
  whatever its depth ("Edit Ana's salary"), its submit words, and what each box drew. The per-box locator works inside
  that. Parked typing never refills silently into another form, because the same-moment path uses the same rule.
- Evidence:
  - `t1b-strayrow`: Bo's growth stays 0.03; the note names "Edit Ana's salary"; Ana's row again shows her typing;
    Cancel discards it.
  - The test the critic asked for (`t-rowswap`): on expenses, liabilities and people, 0 boxes of B's form differ from
    B's saved values, and A's typing comes back 2/2, 4/4 and 3/3.
  - Node test: `refills` refuses another row's form, a box the page refilled, and a changed saved value.

**Blocking 2. A save whose redraw closes another form threw its typing away.** *Changed.*
- In the keepScroll branch, every item `apply` could not place is kept as parked (`place.keep`), and `saveDrafts` keeps
  parked items. The line names the form where it was, and the bottom note says so when the line is off screen.
- Evidence:
  - `t2-people`: People now keeps its own form open (claude-g, e4bc7af) and 59 is kept; a new visit shows the parked
    line when the form is shut.
  - `t2b-checkin`: November parks October's note, and October brings it back.

**Blocking 3. Typing parked under the page Back reattached (phantom line).** *Changed twice over.*
- The kept page is cut (no synchronous reattach at all).
- The observer ignores the shell's own clearing and drawing (`busy` / `idle` with `takeRecords()`), and before the page
  is drawn.
- Every item is filed under the page it was typed on (`where`).
- Evidence (`t1-keptpark`, `j07-income`): no draft under `overview/dashboard`, and no line on Back, Forward or a later
  visit.

**Blocking 4. The bottom copy's "‹ Back to ..." added a history entry.** *Changed.*
- The back-link listener is on `document` for any `a[data-back]`; the copy's link carries `data-back`; the copy is
  removed on every address change and when its link is tapped.
- Evidence (`t5-echolink`): history +0, the copy gone, and the next Back reaches the Dashboard.

**Blocking 5. The hold scrolled the conflict bar away.** *Changed.*
- No record is used while `#sync-bar` exists at arrival, and `showConflict()` calls `cancelHold()` before its
  `scrollTo(0, 0)`.
- Evidence (`t12c-syncbar-real`, `reg-t12c1..3`), three cases: a fresh conflict 300 ms after a Reload; the same after
  a Back; a bar already up when Back arrives. In all three the page is at 0, with the bar at the top (56 px), 2.6 s
  later.
- The critic's own `t12` still shows the hold winning, because it runs the old bar's two lines by hand, without the
  new `cancelHold()`. That is the case the change removes.

**Should-fixes:**
1. Removal only inside a trusted event: **taken** (M7). `t11b-goals-thumb`: 0 px at a thumb down at +3.9 s.
2. Leaving by the menu kept no anchor: **taken**. `topThing` probes the page's own elements by geometry, never
   `elementFromPoint`, so the open drawer cannot hide them. `t14b`: the record of Expenses left by the open menu holds
   the row "Eating out" (first draft: no anchor), and Back lands at 885 px with that row at the top.
3. Wheel and `touchstart` end the hold: **taken**. `t7b` (desktop): Back to 1,200 px, then 640 px of wheel upward in the
   first second: the page ends at 528 px and stays there (the hold let go).
4. "Not saved yet" for something that was saved: **taken**.
   - `usedBy()`: a tapped button whose task saved the plan drops the drafts of the boxes around it.
   - The skipped form is tied to the submit and forgotten when its redraw is drawn, not after a 3 s clock.
   - `t4b`: after "Import 10 transactions" the next visit to Import shows an empty box and no line. The rule: a tap
     that saved the plan and also left the page used the boxes of its own form and every box in no form.
5. Name the form, not the card: **taken** (`headingOf`).
6. A page replacing its own address: **taken** (the path is refreshed on input; filed by `where`).
7. Storage all or nothing: **taken** (separate keys, a 20 KB cap per page, 24 h).
8. The date check in the kept page: **moot** (the kept page is cut).
9. Phone checks: **taken**. Checks 1 and 4 are in a Safari tab; the keyboard-up check (8) and the reload with a
   conflict (10) are added.
- Touch rules D-ROW-SWAP and D-NO-PHANTOM: **asked** of the sweep's owner (section 6).

### Person critic (`critique-person.md`)

**Blocking 1. Phantom "kept" line on the Dashboard.** *Changed*: as break critic, blocking 3, with the same evidence. A
later visit to the Dashboard shows nothing.

**Blocking 2. The words named the wrong thing, behind a green tick.** *Changed.*
- The words name the heading nearest above the form ("Edit Ana's salary").
- The copy for kept typing is the neutral `info` kind with no tick.
- The words say "Not saved yet" first: "Not saved yet: what you typed in “Edit Ana's salary”. Open it again to finish
  it."
- I kept "Open it again" rather than "Tap Ana's salary": the heading is the only name the shell knows for sure, and the
  line sits at that row.

**Blocking 3. Get started claimed "We kept what you typed" while two figures were gone.** *Changed.*
- A box's own name now comes from its visible label before its `aria-label`.
- The shell stands aside when the page put the typing back itself (`already`, `shownByPage`).
- The cue is shown only for boxes the shell itself refilled.
- Evidence (`j09`, reload on owe-amounts): no false line, and all three figures come back through the page's own drafts.

**Blocking 4. A leaving confirmation still moved the page under a resting thumb.** *Changed*: trusted-event rule (break
critic should-fix 1).
- Evidence: Goals edit Save, thumb down at +3.9 s: today 56 px and the notice gone; final 0 px and the notice stays.
- withdrawal-strategy (the critic's page) no longer has a timer when its line carries "Put it back" (claude-e's R4
  change); the shim covers the other 95 views.

**Blocking 5. Back to a page whose open form was gone: blank screen, a later jump, the line off screen.** *Changed.*
- Room is borrowed only until a link of the place is drawn.
- When the form is gone, its row or card, or the line itself (`landOn`), comes to the top.
- The line is said at the bottom too when it is still not seen.
- Evidence (`j07c-trace`, `fv/out/reg-j07c.log`): from 17 ms after Back the page stands at 356 px with its own height
  (1,200 px; the first draft held 1,996 px of borrowed room), and nothing moves in the next 4 s (the first draft jumped
  463 px at 2.9 s). The line naming the form is on the screen (211 px from the top, `dbg-fwd`).

**Should-fixes:**
- S1. The way back to the check-in in the copy: **taken** (the second way on).
- S2. The copy covering the tapped button: **taken** (`.at-top`; `j04`: 64-246 px with Save under the thumb).
- S3. The copy outliving its page: **taken**.
- S4. "‹ Your plan" after "Next result": **taken**. `backSteps` walks back along one `from` trail (node test); the
  "land at that page's newest place when following the link" half is declined, because a link that opens a page must
  open it at its top (D-TOP); a page opened any other way is a new visit. `j03`: back two steps to the same 885 px,
  history unchanged.
- S5. One cue: **taken** ("Not saved yet · Undo my typing" beside the buttons; one line for a shut form; no "Clear it").
- S6. The kept page brought back an old green line: **moot** (cut).
- S7. Kept typing never ends: **taken** (24 h).
- S8. B5's wording: **taken** (B5 now says the page or kit scroll wins and the confirmation is then on screen).
- The touch-check window to 5 s, also after Back: **asked** (D-SCROLL-KEPT, D-STILL).
- Phone checks on `pointerdown` at a scroll start, the copy with the keyboard up, the swipe-back picture: **added**
  (5: 8, 12; Safari notes).

### Scope critic (`critique-scope.md`)

**Blocking 1. Measured on c385e41; wave 2 has since closed or duplicated parts.** *Changed.*
- Rebased on d22b718 and re-measured there: e1 (17/17 on every column), e2 (today and final on the tip, table in M3),
  and the critics' repros.
- Each finding is marked shell, page + shell, page, or part (section 8).
- The shell stands aside on pages that keep their own drafts, without a page edit (`already`, `shownByPage`), so
  Get started's and People's own drafts are neither duplicated on screen nor removed.
- Section 3 is re-cut: the setup row is gone.

**Blocking 2. Findings waved through without a working behaviour.** *Changed.*
- p-balance/x-1 Net worth part and j-monthly-return/x-typed-lost now have one: parked typing is kept on the keepScroll
  path (`t-nw`, `t2b`).
- j-debt-fixer/x-2, p-cashflow-a/CF-3 and the form half of j-fat-fingers/x-2 rest on `ctx.layer`, which P1 builds and
  `t-layer` measures. The page lines have named lane owners, and claude-b assigns them after P1.
- W4's line and RB1's Roth part are owned by claude-b's wave 2 follow-up, since claude-e released the retirement lane
  and wrote that both wait for wave 1.
- FF2's menu half is cited as taps M5 on `router.layer`.
- F2 and x-4 are marked closed by page commits.
- B12's timer leak is closed by the trusted-event rule, with deletion as named cleanup.

**Blocking 3. What will be built was not defined.** *Changed.*
- One list, folded into sections 1, 2 and 6, each item with its check.
- The "take from the first design" list is gone: each item is built (router layer, same-form rule, 24 h, size cap,
  echo at the top, stay by length, 8 s quiet hold, `overflow-anchor: none`, one cue) or declined in this section
  (`forgetAfter` is in the router; the cleanup check rule went with the kept page).
- The echo's own double-tap guard is dropped: taps M1's guard does it.

**Blocking 4. Cut the kept page.** *Taken.*
- M1 alone meets every number on the tip (17/17 on every column).
- The phantom line came from the kept path.
- B13 (instant Back with an open edit form) is listed as "not in wave 1": the line plus one tap brings the typing back.

**Blocking 5. The joins with taps and forms2 were not named.** *Changed.*
- Section 7's seams table: one numbering and `layer`/`back` in `core/router.js` with node tests; the order at the top
  and end of `show()`; one scroll wrapper with two hooks; one bottom note (forms2 has since dropped `ui.toast`); forms2's
  G1-G4 used and N1-N6 answered.
- The prototype's `show()` already scrolls a return to `record.y` before the draw. Taps' wait goes after that line, so
  it paints at the place (S5).
- `show()`'s footprint drops to calls into `place.js` in P6.

**Blocking 6. The permanent tests missed the heart of the design.** *Changed.*
- Every deciding rule is a pure function with a node test, 15 tests in the prototype, all passing: the back-link query
  and trail walk (`backSteps`), the seen geometry, the fold rule, the refill and stand-aside rules, form identity, the
  stay time, the overlap, the entry stamp, secrets and expiry.
- The locator is tested in P3 on a hand-built DOM fixture, and `e5` stays as the census.
- The e-scripts become touch-sweep rules (D-DRAFT, D-OTHER-FORM, D-FOLD-KEPT, D-STILL, D-ROW-SWAP, D-NO-PHANTOM, a
  strict D-BACK, the D-TOP exemption) handed to the sweep's owner in P9. `qa/` is not this track's file.

**Should-fixes:**
1. Delete the timers: **taken as named cleanup** (claude-b, after P8) with a check rule. The bridge allows removal only
   inside a trusted event; claude-a's 10 views keep the bridge.
2. Parked drafts that can never come back: **partly taken** (a format version, 24 h, "Throw it away"). The rule "drop
   when its form identity cannot appear again" is **declined for now**. Without a `data-key` on rows, the shell cannot
   tell "this row's form with new figures" from "another row's form with the same heading", and a wrong guess loses
   typing. It comes with forms2's `data-key` adoption.
3. `data-back` only: **taken**.
4. A `ui.form` hook instead of the observer: **declined**. It misses hand-built forms and pages that redraw their own
   section (Capital gains' chip, Stress tests' Now, the check-in note). The two faults blamed on the observer had other
   causes (the locator, the kept-page timing), both fixed and measured.
5. One cue: **taken**.
6. Remove the prototype-only pieces: **taken** (P9).
7. Owner-facing records: **taken**.
   - The DESIGN_LOG entry (section 7).
   - `tools/shot.mjs` light and dark at 390 px of the parked line, the cue and the copy with its link, as a P8 check.
8. CONVENTIONS on what the shell owns: **taken** (P9).

### Declined in wave 1, with the reason

- **The kept page** (instant Back with the open edit form): scope blocking 4, above.
- **Holding a save's redraw while the person types in another box** (the first design's M8):
  - It keeps stale figures and stale handlers on screen until the box is left.
  - forms2's "nothing moves between a finger's down and its click" (G4) and the shell's focus put-back cover the
    measured cases.
  - On iPhone a replaced box may drop the keyboard; phone check 8 decides whether it is needed, as its own change.
- **A question before leaving a page with typing**: Back cannot be cancelled, and the typing is kept instead.
