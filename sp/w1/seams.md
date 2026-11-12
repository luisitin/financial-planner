# Wave 1: the seams between place, taps and forms (on ee09f6e)

`$SP` = `$SP`.
Plans: place = `$SP/w1/plan-place.md` (+ steps S1-S9), taps = `$SP/w1/taps/final.md` (+ T1-T11), forms = `$SP/w1/plan-forms.md`
(+ F1-F9, A1-A6). Line numbers below are **ee09f6e's**. Where a plan text disagrees with this file, this file wins.

Checked at ee09f6e: `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`,
`frame.js` and `modules/overview/pages/view.js` are byte-identical to c6fb730 (taps' base) and d22b718/fa2026e (place's and
forms' bases): every prototype applies. Tests pin some shell lines: keep byte-identical app.js 222, 242, the `showPill`,
`onSync`, `showConflict` strings and all of `mendBlockedForms` 414-432 (`tests/heal`, `user-view`, `wording-left`).

Stale words in the plans, not built: place's `ui.drawStart()`, `ui.afterDraw({ keepScroll })`, `kitMoved`, `data-kit-moved`,
`ui.later` (from the forms design that lost); taps' "taps adds `open`/`replace`/`isReplace` to router.js", `calmScroll` hook,
`wrapScroll(obj, name, hook)`, `finally { taps.drawn() }`; every plan's "one shared reduced-motion line"; forms' and taps'
DESIGN_LOG entries. Their replacements are below.

---------------------------------------------------------------------------------------------------------------------

## 1. Ownership

### 1.1 Files
| file | owner | the others |
|---|---|---|
| `core/router.js` (all of it) | place | taps calls only (I1, I2) |
| `core/place.js` (new) | place | nobody imports it but app.js |
| `core/taps.js`, `core/address.js` (new) | taps | - |
| `core/ui/dom.js`, `core/ui/checks.js`, `core/ui/undo.js` (new) | forms | - |
| `core/search.js`, `index.html`, `modules/overview/pages/view.js` + README | taps | - |
| `core/app.js` | place and taps, by line (1.2, 1.3) | forms: nothing |
| `modules/overview/guide/frame.js` | taps and place, by line (1.4) | forms: nothing |
| `core/ui/base.css` | three regions (1.5) | - |
| `tools/check.mjs` | forms (one purity line) | taps does not add `address.js` there (its node test proves it imports in Node) |
| tests | place: `tests/place.test.mjs`, `tests/router-replace.test.mjs` (moved from taps: the router is place's); taps: `tests/taps.test.mjs`, `search-words`, `ways-back`, `address`; forms: `tests/ui-checks.test.mjs`, `ui-undo` | `tests/router.test.mjs` unchanged by all |
| `qa/shell-*.mjs` (new) | taps (T11) | - |
| `CHANGELOG.md`, `docs/*` | not in the code patches (section 4) | |

### 1.2 `core/app.js` outside `show()`
| ee09f6e lines | what | owner | change |
|---|---|---|---|
| 16 (+ insert after 16) | search import; `./taps.js`, `./address.js` imports | taps | |
| insert after 19 | `import * as place from "./place.js"` | place | 17-19 untouched |
| insert after 26 | `drawnSeq` | place | |
| insert after 33 | `planRev`, `navStale`, `const taps = installTaps(...)` | taps | |
| 71-157 (+ new functions after 157) | `buildNav`, `markActive`, `setToggleIcon`, `closeDrawer`, `openSearch`, `toggleDrawer`; new `paintDrawer`, `openDrawer`, `openFromMenu`, `searchBox`, `updateBack`, `entryNow`, `landFocus`, `focusQuietly`, `missingCard`, `announceFresh` | taps | |
| 164-170 | `announce()` | taps | |
| 171 | `makeCtx(route, seq = renderSeq)` | taps | |
| 177-182 | `computeRemote` | taps | |
| insert after 183 | `ctx.back`, `ctx.layer`, `ctx.redraw` | place | 183 untouched |
| insert after 186 | `ctx.cameFrom`, `ctx.replace` | taps | 184-186 untouched |
| 190-196 | show()'s comment and signature | place | |
| 283-290 | `echo()` (drops `role="status"`, speaks through `announce(text)` for ok/info) | place | |
| 355 | `showConflict()` calls `place.cancelHold()` before `scrollTo(0, 0)` | place | 337-354 untouched |
| 382-384 (+ insert after 384) | menu button, dim side, pill listeners; Escape, skip button, `#nav-back`, `#sidebar` row listener, `store.subscribe(() => { planRev++; })` | taps | |
| 385-388 | the existing subscriber | nobody | untouched |
| insert after 388 | `let sig = place.planSig(store.get()); store.subscribe(...)` (its own subscriber), `place.start`, scroll / pagehide / hidden notes, the `a[data-back]` listener | place | |
| 402 | `follow` | taps | |
| 410 | `router.start((route, entry) => show(route, { entry }))` | place | |
| 414-432 | `mendBlockedForms` | nobody | pinned by tests |

### 1.3 `show()` (196-266), line by line. A blank owner = untouched; it separates the two tracks' hunks.
| line(s) | owner | change |
|---|---|---|
| 196 | place | `{ keepScroll = false, entry = null } = {}` |
| 197-198 | | |
| ins. after 198 | taps | wrong-case correction (`route = ...`; `replaceState({ ...history.state }, ...)`), `const miss = missing(...)` |
| 199-201 | | `current = route`, `m`, the dashboard fallback stay |
| ins. after 201 | place | `place.busy(1)`, the `planner:reveal` listener, `try {` (body **not re-indented**), `before()` or `leave/forgetAfter/visit/recordOf`, the note removed on a new address |
| 202-204 | | |
| 205 | place | `keepY = keepScroll ? scrollY : rec ? rec.y : 0` |
| 206 | | |
| 207 | place | the room (`minHeight`) |
| 208 | | `root.innerHTML = ""` stays |
| 209-210 (+ ins. before 211) | taps | title from `miss`, `#content[aria-label]`, the search word cleared |
| 211-215 (+ ins. after 215) | taps | Recent with `navStale` (a missing page is not recorded); `if (navStale && ...) buildNav(); updateBack();` |
| 216-217 | | `markActive(); if (!keepScroll) closeDrawer();` stay (taps changes the functions, not the calls) |
| 218 | place | may become `place.scrollTo(0, keepY)` |
| 219 | | |
| ins. after 219 | taps | `if (miss) { root.style.minHeight = ""; window.scrollTo(0, 0); root.append(missingCard(miss)); taps.drawn(); landFocus(root); return; }` |
| 220-222 | | 222 pinned |
| 223 (+ ins. after) | taps | `makeCtx(route, seq)`; the "on again" line |
| 224-235 | | |
| 236 | taps | lazy `ctx.derived` + the one-frame wait (new address) |
| 237 | | `let c = null;` |
| ins. after 237 | place | `scrolls0` baseline |
| 238-245 | | 242 pinned |
| ins. after 245 | taps | `taps.drawn(); if (!keepScroll) landFocus(root); updateBack();` |
| 246 | | `frame.after` |
| ins. after 246 | place | `drawnSeq = seq; router.touch(); place.idle()` |
| 247 | | |
| 248-249 | place | `pageScrolled` from `place.scrolls()`/reveal; `place.afterSave(...)` (restore, focus, anchor) |
| 250-258 | | `fresh` stays computed here |
| ins. after 258 | taps | `announceFresh(fresh);` |
| 259 | | |
| 260-265 | place | N1 focus, the note decided one frame later; new-address branch `afterArrive()`, `tell()`, `note(n)` |
| 266 | place | `} finally { place.idle(); removeEventListener("planner:reveal", ...) } }` (`idle()` is idempotent) |

So the sequence is: correction, place leave/record, room, title, Back button, scroll, missing card, wait (new address),
render, `taps.drawn()`, landFocus, place idle, place restore + anchor, read-out, focus/note. The order of the plans' own
lists (place section 7, taps S5/S6) is replaced by this one.

### 1.4 `frame.js`
| lines | owner | change |
|---|---|---|
| after 14, and 18 | taps | `HUBS`, `namedBack()`; `RTRAIL = "planner.reviewTrail"` |
| 167-173 | taps | the check-in trail written and hopped |
| 179-186 (the `!real` branch) | taps | gtrail and quick-trail links get `data-back`; the carried check-in row; named rows top and bottom (all with `data-back`) |
| 187-191 | | |
| 192 (review), 199 and 203 (quick), 210, 213, 214 (plan) | place | `dataset: { back: "" }` on those six links, nothing else |
So the eight back links of B4 are six (place) + two (taps). `data-back` is read by presence; no value, no `data-back-loose`.

### 1.5 `core/ui/base.css`
| region | owner | rules |
|---|---|---|
| 41-77 (modify 41-47, 49-52; insert after 47, 52, 77) | taps | `#topbar`, `#page-title`, `#nav-toggle`, `#nav-back`, `.nav-skip`, `#status`, `#sidebar`, `#scrim`, `.nav-*`, `html.drawer-open`, the 480/375 px blocks, and its own `@media (prefers-reduced-motion: reduce) { #sidebar, .nav-group-head .chev { transition: none !important; } }` |
| 122-129 (insert after 124) | place | `.save-echo*`, `.place-*`, `html { overflow-anchor: none; }`; line 129 is place's alone |
| insert after 179 | forms | its whole block, **including** `.notice .notice-actions` (not after 121: that touches place's region) |
| after 277 (end of file) | forms | `@media (prefers-reduced-motion: reduce) { .fold .fold-chev, .scroll-hint::after { transition: none; } }` |
No shared reduced-motion line: a rule at line 129 loses to the transitions at 137 and 274 (same specificity, later wins), so
forms' reference copy (which edits 129) would not work.

---------------------------------------------------------------------------------------------------------------------

## 2. Shared interfaces (exact names)

**I1. History entries (place gives, taps reads).** `history.state = { ...history.state, v, n }`, plus `l` (1, 2...) on a
layer's entry. Nobody else writes `n`, `v`, `l`, `drawer`, `from` or `via` into the state; pages spread it
(`replaceState({ ...history.state, ... })`); a `replaceState(null, ...)` keeps its number. Router API: `parse`, `hashOf`,
`href`, `go`, `open(href, { via, replace })`, `replace(href)` (the entry keeps its number and `p`), `entry()` ->
`{ v, n, href, kind, first }`, `first()`, `at(n)` -> `{ href, p, via }`, `touch()`, `back(href)` -> boolean,
`layer(close)` -> `release`, `layersOpen()`, `start(onChange)` with `onChange(route, entry)`, `entry.kind` in
`new | back | forward | reload`, `entry.from` = `{ n, href } | null`. The stamp uses taps' pure
`isReplace({ had, mark, traversed, len, lenRef, cap = 50 })`, written by place in router.js with
`tests/router-replace.test.mjs` (link, Back, link -> n 2, 1, 2); `traversed` is set by a popstate onto a numbered or layer
entry and cleared only when a new entry is stamped. The router wraps `History.prototype.replaceState` once: after a call
on the entry on screen it runs `touch()` (All pages' `?q=`, net worth, goal seek rewrite their address without a new entry;
the record of the entry being left must carry that address). Taps' one adapter:
`entryNow()` = `e = router.entry?.()`; `me = router.at(e.n)`; `prev = me?.p != null ? router.at(me.p) : null` ->
`{ n: e.n, first: e.first, prevKey: prev ? key(prev.href) : null, via: me?.via ?? null }`, `key(h)` = `group/id` of
`router.parse(router.hashOf(h))`; `ctx.cameFrom()` = `prev ? { key, menu: me.via === "menu" } : null`. On ee09f6e alone
`router.entry` is missing: `entryNow()` is null and the "‹" stays hidden. Session keys: place `planner.trail`,
`planner.place`, `planner.typing` and its visit id (each `.sandbox` apart); taps `planner.reviewTrail` (frame.js); no
`planner.firstEntry`, no `planner.slowPages`.

**I2. Layers (place gives; taps' drawer and forms' A1 rows use it).** `const release = router.layer(close)` (pages:
`ctx.layer(close)`). `close()` only changes the screen and never touches history; `release()` is called by the closes a
person starts (✕, dim side, Escape, Save, Cancel, another row opened); calling it after the router already closed the layer
does nothing. Back with a layer open: the router calls the newest `close()`, no redraw. An address change closes every
layer. The menu: `router.layer(paintClosed)` only at phone width; a row, the pill and Go call
`router.open(href, { via: "menu" })` with `preventDefault()`; the router replaces the layer's entry itself when a layer is
open (never `replace: true` from taps: on a wide screen that would eat the page's entry). Rows also carry `data-via="menu"`.
A1 rows: `const close = ui.openUnder(row, build); const release = ctx.layer(() => { editing = null; close(); });` and Save /
Cancel / another row call `release(); close();`. dom.js never imports the router.

**I3. Ways back.** A way back on screen is `<a href="#/..." data-back>`; place's one bubble-phase listener on `document`
calls `router.back(href)` and `preventDefault()` when it went back, else the link is followed. `ctx.back(href)` is the
same in code. No `ctx.goBack`. The top bar's "‹" is plain `history.back()` (it closes an open edit-form layer first, like
the phone's Back).

**I4. Which typing is kept.** Kept by default: `input` (not hidden, file, password, submit, button, reset, image,
**search**), `select`, `textarea` inside `#content`. Never: inside `[data-no-keep]`; secret words (key, token, password,
passcode, passphrase, secret, PIN) in name/id/label/aria-label/placeholder; `#/system/*`; `type="search"` (All pages,
Glossary, Ledger, Help keep their own query: a search is not "not saved"). The kit's boxes are ordinary inputs (kept). A
page that keeps its own drafts (Get started, People) needs nothing: the "same" verdict stands aside. Refill writes
`.value` (or `checked`) then dispatches untrusted `input` (+ `change` for choices); never `reportValidity()`.

**I5. Shown, read, copied.**
- To bring something into view a page calls `ui.reveal(el, { block })` (forms), which dispatches `planner:reveal` on
  `window` right before it scrolls. A page calls it only on the draw that shows the answer to the person's own act (its
  `pending`), never on every draw (it would beat Back's restore). A notice with a button (`ui.notice(kind, text, { undo |
  action })`) and the kit's refusal lines bring themselves into view.
- Fresh notices = the existing `fresh` list in `show()` (new text, or the last save's text again).
- Read out: taps' `announce(text)`: one polite `#announce`; words normalised (clone without `a, button,
  .notice-actions`, whitespace collapsed); the same words within 2 s said once; dropped when, at the moment it speaks
  (+60 ms), the focused element already holds those words. `announceFresh(fresh)` reads green ones only. Red: the kit's
  `role="alert"` (first time per words per visit; `.form-error` always). Place's `echo()` calls `announce(text)` for
  ok/info only and has no role.
- Copied at the bottom: place decides (`seenEnough`), one frame after the draw, again after a page scroll stops.
- Focus after a save (forms N1): place focuses the first fresh `.notice.ok` that is readable (`tabindex="-1"`,
  `preventScroll`) when the focused box went with its form; a `.notice.error` only when no green one is fresh.

**I6. The redraw (no public before/after hooks).** `place.before(root)` and `place.afterSave(root, snap)` are place's own,
called only from `show()` (1.3). Others steer it only by: a scroll call by the page or the kit (counted by place's
wrapper), `planner:reveal`, `ctx.redraw()` (a draw without a save), `data-no-keep`. **The page wins** when any of those
scrolls happened during the draw **or after the act that led to it** (the last trusted `pointerdown`/`keydown` before the
`store.update`): no anchor, the room goes when the page stops growing, the note is decided after the scroll stops.
`before()` records the focused element when it is any focusable in `#content` (box, button, link, summary), and
`afterSave` puts the focus back on its located copy with `preventScroll` (so the kit's Cancel focus on a row's Edit
survives a page that redraws after Cancel).

**I7. How the tap guard knows the screen changed.** (a) `taps.drawn()`: after every `show()` draw (the line after 245),
on the missing card, when `computeRemote`'s local answer returns and when the computer's answer arrives; (b) the last tap
carried out; (c) `window` event `planner:reveal` -> `taps.moved()` (restarts the 800 ms window, no `settling`). Place
promises the rest: nothing it does moves the page between a finger's `pointerdown` and its `click` (the hold ends at
`pointerdown`, `touchstart`, wheel, key; its redraw runs after the click's task; the note never sits over the tapped
control). Forms promises the same (G4: words wait for the click; `steady()` keeps the box or the buttons still).

**I8. Markers and events (one meaning each).**
| name | set by | read by |
|---|---|---|
| `a[data-back]` | frame.js (place 6, taps rest), place's note | place's listener |
| `data-via="menu"` | taps' rows | router |
| `data-no-keep` | any page, on a box or its section | place |
| `data-kit` | forms, on what the kit draws | place's notice shim (may remove) |
| `data-moved="kit"` | forms, set **before** it calls `.remove()` on a page notice | place's notice shim |
| `data-taps="repeat"` | a page, on a control that must save on every tap | taps |
| `data-key` | A1 rows | forms (Cancel's row) |
| `button.notice-action` in `.notice-actions` | forms | place's note (first way) |
| `#content[aria-busy]`, `[aria-label]`, `inert`; `html.drawer-open` | taps | place: observers watch childList/subtree only; no place record while `html.drawer-open` is set |
| `#announce` | taps (exists) | everyone through `announce()` / `ctx.announce()` |
| `planner:reveal` (window) | forms (`ui.reveal`) | place (page wins, hold ends), taps (`moved()`) |
| `data-forms-kit` on `<html>` | forms | forms |

**I9. Listener order.** forms' document listeners at dom.js import (first), taps' guard at app.js module start, place's
at `boot()` (`place.start`, the wrapper before `router.start`). The guard's `stopImmediatePropagation` on a swallowed
`click` stops place (capture on `#content`, bubble on `document`) and pages; the kit's click note still sees it and only
notes or flushes (G8). Place records the tapped control on trusted `click`, never on `pointerdown`, so a swallowed tap is
never "the last tap". The kit treats a click as a keyboard open only when `e.isTrusted && e.detail === 0` (place's "Open it"
and the note's buttons call `el.click()`, which must not raise the keyboard).

**I10. One rule for all three: never read a property or call a method on a form element** (`form.contains`, `.elements`,
`.reset`, `.submit`, `.name`, `.id`, `.target`, `.action`, `.method`, `.noValidate`, `.querySelector`): at ee09f6e 32 field lists
name a box `name`, goals/goals one `target`, transactions/rules one `contains`. Use
`Node.prototype.contains.call(f, x)`, `Element.prototype.querySelector.call(f, s)`,
`Element.prototype.hasAttribute.call(f, "novalidate")`, the `HTMLFormElement.prototype` getter for `elements`. Forms'
reference kit (`$SP/w1/judge-forms/A/core/ui/dom.js`) breaks it: `:220` and `:330` (`f.contains`: Rules' refusal line
and a keyboard open would throw), `:211 :244 :344 :475` (`f.elements`), `:489 :495 :507` (`el.form.noValidate`,
`.querySelector`); place's prototype (`$SP/w1/judge-place/A/core/place.js`) at `:148`, `:634`. Exception:
`mendBlockedForms` stays as it is (pinned by a test). The S9 grep runs over `core/place.js core/app.js core/taps.js
core/ui/dom.js`.

---------------------------------------------------------------------------------------------------------------------

## 3. Conflicts and the rule that settles each

C1. **The redraw keeps the place vs an answer brought into view.** The page or kit scroll wins (I6), including a reveal
made in the act's own task before the redraw (forms' Cancel `backTo`, `openUnder`, debt/payoff's `scrollBy`): place does
not anchor that redraw and keeps the scroll it finds.

C2. **The guard vs a deliberate second tap on Up (debt/payoff).** The page keeps the moved row's Up under the thumb, so a
second Up within 800 ms is the guard's `repeat` and is dropped; one 800 ms later moves the debt again. No
`data-taps="repeat"` on Up (there is no Down to undo a doubled move); the line "Visa card moved up to 3rd." says where it
went. Same for the bar's "‹": a double tap goes back one page (B16); two pages need two taps 0.8 s apart.

C3. **Undo notices vs confirmations that leave.** Inside `#content` nothing leaves by a timer any more (place's notice
shim; forms' recipe has none; pages' timers are cleaned in wave 2). A notice lives until the next draw of the page, a
trusted close or Undo, or the kit moving it. An Undo notice is drawn once (`pending` cleared once drawn), so a later redraw
of the page (a chip, a sync) ends it: forms B10's words read "until the page is drawn again or you leave". Only place's
bottom copy leaves by time (4-10 s); its Undo is a copy that presses the page's button while it is there.

C4. **Focus on arrival.** taps' `landFocus` (top of the page) runs first; on an arrival with a place record (Back, Forward,
Reload) `place.afterArrive` then puts the focus on the restored tapped control when it is drawn and on screen
(`preventScroll`) (claude-f's wave-1 ask: Back drops focus to the top). A new address keeps taps' focus.

C5. **Paint first vs the restored place.** The one-frame wait comes after place's room and scroll; the "Working it out…"
line gets a `margin-top` that puts it 24 px under the top bar at the restored place (0 on a page opened at its top), so
Back to a heavy page shows the words where the person looks.

C6. **Router ownership.** Both plans claimed `router.open`; place writes all of router.js, including taps' `replace`,
`isReplace`, `traversed`, `lenRef`, `via` and their test. Taps edits no line of it.

C7. **One scroll wrapper vs taps' reduced motion.** Place's wrapper turns `behavior: "smooth"` into `"auto"` while
`(prefers-reduced-motion: reduce)` matches (pure `calmArgs` tested in `tests/place.test.mjs`); taps builds no `calmScroll`
and no hook. B13's page-scroll half becomes place's; the drawer and chevrons stay taps' CSS.

C8. **frame.js `data-back`.** Split by branch (1.4); nobody touches the other's lines.

C9. **`show()` and `store.subscribe`.** The line map 1.3; two subscribers instead of one edited callback; taps' `drawn()`
as explicit calls instead of a `finally` (place's `finally` cannot hold a taps line on ee09f6e alone).

C10. **base.css reduced motion.** Three own rules (1.5), none on line 129 except place's.

C11. **Double read-outs** (the save's notice, place's copy, N1 focus, the kit's alert). I5's rules: green only, one
normalised text per 2 s, skipped when focus already holds it, the copy never a live region.

C12. **The bottom copy over the open menu** (z-index 41 over the drawer's 25). `openDrawer()` removes `.save-echo` (taps).

C13. **Search boxes kept as "Not saved yet".** Place never keeps `type="search"` (I4).

C14. **"Open it" raising the keyboard.** The kit's keyboard-open test needs `isTrusted` (I9).

C15. **Typing records vs address rewrites.** The router's `replaceState` wrapper calls `touch()` (I1), so Back to All
pages after a typed search finds its place.

C16. **A missing page after place set its room.** taps' missing-card branch clears `minHeight`, scrolls to 0 and calls
`drawn()` and `landFocus()` (1.3).

C17. **Unasked choices.** Place puts its eight in `docs/PLAN.md`; forms (F9) and taps (T11) wanted DESIGN_LOG entries.
Rule: none of the three writes `docs/DESIGN_LOG.md` (the owner's record); all choices go in one `docs/PLAN.md` section
"Wave 1: choices made without the owner" (place, taps, forms lists) for the next design review.

C18. **The form rule I10** binds forms' dom.js too; Rules (`contains`) and Goals (`target`) are in every track's
all-pages walk.

---------------------------------------------------------------------------------------------------------------------

## 4. Must not touch, and the order

**forms must not touch:** `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `frame.js`, `core/place.js`,
`core/taps.js`, `core/address.js`; base.css outside "after 179" and "after 277" (not 117-129, not line 129); any page
before F9 is on `main`; any page not in section 5. No import of the router or app.js from dom.js. No `ui.drawStart`,
`afterDraw`, `kitMoved`.

**place must not touch:** `core/search.js`, `index.html`, `core/ui/*.js`, `core/taps.js`, `core/address.js`; in app.js the
taps rows of 1.2 and 1.3 and the untouched separator lines; frame.js outside its six links; base.css outside 122-129; any
`view.js` or `compute.js`; `qa/`. No `role` on the note; no `data-kit-moved`.

**taps must not touch:** `core/router.js`, `core/place.js`, `core/ui/*.js`; in app.js `echo()`, `showConflict()`, the place
rows of 1.2 and 1.3, the subscriber at 385-388, line 410; frame.js 187-216 (place's six links); base.css outside 41-77;
`history.state` (no `drawer`, `n`, `from`, `via`); no second scroll wrapper; no `stampEntry`, `planner.firstEntry`,
`planner.slowPages`; no `?w1off`, `.w1` or `window.__swallowed` outside the sandbox.

**All three:** no line of `CHANGELOG.md` or `docs/*` in the code patch; no claude-a folder; never `modules/registry.js` or
`tests/golden/**`; no evidence switch (`?forms=off`, `?place=off`, `__placeLog`, `__place`, `__placeLast`) ships; never
re-indent a body you wrap.

**Order** (each patch = `git diff ee09f6e -- . ':!CHANGELOG.md' ':!docs'` of its worktree):
1. **forms** (F1-F8; F9 is step 4). Applies on ee09f6e; it shares only base.css regions.
2. **place** (S1-S8 and S9's code: switches dropped, the I10 grep). Applies on ee09f6e and on 1 (base.css regions apart).
3. **taps** (T1-T10 and T11's `qa/shell-*.mjs`). Applies on ee09f6e (degraded: no "‹", no menu Back, until the router has `entry`) and on 1+2.
4. **docs**: each track's CHANGELOG lines, CONVENTIONS sections ("Forms: asking, checking, answering"; "What the shell keeps
   for you"; the ctx and shell lines), the one TEAM claim row naming all five new core files, the PLAN.md section of C17,
   WORKBOARD lines (taps to claude-f and claude-d): written by the integrator after 1-3 (place S9, taps T11, forms F9).
5. `npm run skew`, then `main` moves (pre-push gate).
6. **page adoptions** (section 5), each its own commit and claim row, only after 5 (a page calling `ui.openUnder`,
   `ui.undoable`, `ui.reveal` or `ctx.layer` must never meet the old shell on the phone).

**Check that each applies.** In a scratch worktree at ee09f6e: `git apply --check <p>`; on the stack:
`git apply --3way <p>` exits 0 with no conflict. Hunks of two tracks are separated by at least one untouched ee09f6e line
(1.2-1.5), which is what `--3way` needs. After 3: `npm test`, `npm run check`, `node tools/leak-guard.mjs --worktree`,
`node qa/smoke-all.mjs`, the union of the kits (place `j-back` x1/x4, `j-draft`, `j-save`, `j-recheck`, `j-extra`; taps
`t1-dbl`, `t2-allowed`, `c2-late`, `c5-select`, `j-taps`, `m3-search`, `j-search2`, `m4-menu`, `m4b-swipes`, `ways`, `bar`,
`rank`, `m6-ways`, `m2-paint`; forms `journeys.mjs` J1-J14), and one all-pages walk that types one key in every visible box
of the first form and taps its Save (Rules and Goals included): 0 page errors.

---------------------------------------------------------------------------------------------------------------------

## 5. Pages the plans ask to change in wave 1

place: none (its W1-W8 list is wave 2). taps: `modules/overview/pages/view.js` and its README (T3; claude-f's former lane,
not claimed now; a WORKBOARD line to claude-f). Its section 3 list is wave 2. forms: A1-A6.

| step | page | status |
|---|---|---|
| A1 | cashflow/expenses, transactions/ledger, transactions/categories, transactions/rules | go (after forms and place are on `main`: needs `ui.openUnder` and `ctx.layer`) |
| A1 | balance/net-worth | **wait**: claimed by claude-c (loans row, "Now editing"); kit and shell only until the row goes |
| A2 | retirement/withdrawal-strategy | go |
| A2 | retirement/social-security ("Removed" Undo) | **wait**: claimed by claude-c (ssg row) |
| A3 | transactions/categorize | go |
| A4 | transactions/duplicates | go |
| A5 | property/rent-vs-buy, property/renovation, property/rental, property/vehicles, scenarios/advisor-plan, scenarios/compare, retirement/annuities | go |
| A5 | property/home | **wait**: claimed by claude-c (loans row) |
| A6 | insurance/ltc | go |

Dropped as claude-a's: none of the lists names one; claude-a's pages get the shell and kit only (handoffs, wave 2:
goals/travel's layer, goals/vehicle and goals/charitable's A5 recipe, taxes/documents' Remove). Checked against "Now
editing" at ee09f6e: claude-b's retirement request (projection, contributions, goal-seek, sensitivity, assumptions,
ai/reader, transactions/import) names none of the "go" pages; claude-f holds `taxes/withholding`, `estate/documents` and
`overview/{dashboard,plan,start,next-best-action,monthly-review,alerts,health-score,guesses}` and `guide/**` except
`frame.js`: none of them. A1 does `ctx.layer` on its five pages now, so place's wave-2 W1 row skips them.
