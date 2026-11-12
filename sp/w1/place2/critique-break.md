# place2: critique (break it)

Prototype copied to `w1/place2/cb/proto` (unchanged), served on 9361. Scripts and outputs in `w1/place2/cb/`
(`lib.mjs` is the architect's with the port changed). Phone 390 x 844, touch, sandbox, real taps; `place=off` is today.

## Blocking

**1. Typing goes into another row's form and gets saved there (B9, M4, M5).** `cb/t1b-strayrow.mjs`, family, Income:
open Ana's salary, type 4,100 and Yearly raise 6, stray tap on Bo's salary, then type Bo's new amount and Save.
Prototype: `after stray tap: {"h":"Edit Bo's salary","amount":"5,200","growth":"6",...,"kept":null}`, saved plan
`Bo's salary: 5400 monthly growth 0.06`. Today: Bo stays at 0.03. Nothing in Bo's form says it was refilled (the
same-moment refill is silent). The toast at the same moment says "Your typing in “Income sources” is kept".
Cause: the edit form's locator is `s:Income sources|f0|INPUT:...` (from `t1-keptpark.mjs`). The "Edit Ana's salary" h2
sits in a plain div beside the form, so it is not in the scope. Every row's edit form therefore has the same key.
The only guard is per box ("same default"), and growth, taxable, type, the dates and notes have the same default on
many rows. Whether a record's heading is in the scope depends on DOM depth: `titleOf` matches `:scope > div > h2`.
That catches legacy's "Change Cy" but misses Income's "Edit Ana's salary".
The e5 "0 wrong of 8,484" redraws the same data, and the risk-1 check (the label words are equal) would pass this case.
Change: refill only into the same form identity. That identity is the heading nearest above the form (the `h2`/`h3`
before it in its card, whatever the depth), plus its submit label, plus every box's default. This is the first design's
same-form rule, with the per-box locator kept inside it. Parked typing never refills silently: the "same moment" path
also requires that identity. Add a test: for every list page with an edit form, change each box in row A, tap row B,
and assert that every box in B's form equals B's saved value.

**2. A save whose redraw closes another form throws its typing away, silently, under "Saved." (B6 is false here).**
In the keepScroll branch, `carried.parked` from `applyPlace` is ignored. The next `saveDrafts()` then keeps only the
items already marked `parked`, so the draft is deleted.
- `cb/t2-people.mjs`, family, People (finding p-career-household-system/x-1 (a)): Bo's form, Retirement age 59, then
  the State select saves. Output: `retAgeBox "(no box)"`, `drafts: {}`, the new visit shows nothing, and the saved age
  stays 62. The design's coverage table says "typing parked, B7 line".
- `cb/t2b-checkin.mjs`, family, check-in (claimed in B6/B7 for j-monthly-return/x-typed-lost): October's note typed,
  November chip, October chip. Output: `note: ""` and `drafts: {}`.

Change: in show()'s keepScroll branch, park every `carry.drafts` item that `apply` could not place (`place.park` or
write it to `mem.drafts` with `parked: true`). Say so with the B9 bottom note naming the form. `saveDrafts` must not
drop parked items.

**3. Typing from page X is parked under the page that Back or Forward reattaches (M2 plus the observer).** In the kept
path, `place.done()` runs synchronously, before the mutation observer delivers the removal of X's nodes. The observer
therefore sees X's typed boxes "taken away by the page" and parks them under the new page's path.
`cb/t1-keptpark.mjs` (Income edit form 9999, then Back to the kept Dashboard):
`drafts {"overview/dashboard":["P s:Income sources|...amount#0 = 9,999"]}`. The toast says "Your typing in “Income
sources” is kept. Open it again to finish it." On every later visit, the Dashboard's top line reads "What you typed in
“Income sources” is kept, not saved yet. Open it again to finish it. Throw it away" (`cb/t1-dashboard-phantom.png`).
This is the most common journey (type something, swipe Back), on the most visited page.
Change: the observer ignores removals until the next frame after a show(). Better, `leave()` disconnects or
`takeRecords()`s the observer before it moves nodes, and records only removals whose `target` is still connected in
`#content`. Park only under the path the boxes were typed on (store the path in `where`).

**4. The bottom copy's "‹ Back to ..." adds a history entry (B11 undoes B4).** The echo lives in `body`, and
`installBackLinks` only looks at `#content a`. `cb/t5-echolink.mjs`, family: check-in, then
retirement/buckets?from=review, then Save. The echo says "Saved. ‹ Back to the November 2026 check-in". Tapping it:
`history grew by 1`, `y 0`, and the echo is still on screen on the next page. The phone's Back then lands on
`#/retirement/buckets...` again: this is finding j-monthly-return/x-backlink-history, back by another door.
It matters most on the owner's home-screen app (`manifest.webmanifest` `"display": "standalone"`). There, iOS gives no
swipe Back, so on-screen back links are the only way back.
Change: route the echo's link through the same back rule (move the listener to `document` for `a[data-back]` anywhere,
and give the echo's copy `data-back`). Remove `.save-echo` on every route show and when its link is tapped.

**5. The hold scrolls the "Your plan was changed in two places" bar away (worse than today).** In `boot()`, `onSync()`
(line 557, which calls `showConflict()` and `scrollTo(0,0)`) runs before `router.start(show)` (576). A reload with a
pending conflict therefore lands at the record and keeps it there for 2.5 s. A conflict found by a resync during a hold
is reverted the same way. The sandbox never has a conflict, so `cb/t12-syncbar.mjs` runs the bar's two lines by hand
400 ms after the return. Reload: `rightAfterBar 0 -> after {"y":2671,"barTop":-2615}`. Back: the same.
The design says the bar "runs later and wins". It does not.
Change: no return hold while `#sync-bar` exists at arrival. `showConflict()` (fresh) cancels any hold
(`place.cancelHold()`) before its `scrollTo(0,0)`.

## Should fix

1. **B12 lets the page's 4 s timer through exactly when a thumb is on the glass.** The shim allows `remove()` if any
   pointerdown happened in the last 0.9 s. `cb/t11-notice-touch.mjs`, withdrawal-strategy, "Use this one", a finger
   down at +3.6 s, as Safari (`anchor=off`): the row under the finger moves `353 -> 229` and the notice count goes
   `1 -> 0`. With no touch it stays (353). Change: allow the removal only inside a trusted event dispatch
   (`window.event?.isTrusted`). Timers never have one; a tap on Close or Undo does.
2. **Leaving by the menu keeps no anchor.** The open drawer covers `elementFromPoint(195, top+24)`. `cb/t14-menu-anchor.mjs`:
   leaving by the menu gives `anchor: null`, while leaving by an address gives `LI:Eating out`. Menu > page > Back is the
   findings' commonest trip, and with no anchor it falls back to `y`, which drifts when the plan changed. Change: use
   `document.elementsFromPoint` and take the first element inside `#content`, or record the entry when the drawer opens.
3. **The hold ignores the wheel and trackpad** (the design says "touch, wheel or key"; `place.js:239-241` has no
   `wheel`). `cb/t7-wheel.mjs`, desktop, `keep=off`: the person scrolled 640 px within the first second and ended at
   1200, where they left. Add passive `wheel` and `touchstart` listeners.
4. **"Not saved yet" for something that was saved.** A box read by a non-submit button keeps its draft. In
   `cb/t4-import.mjs`, the pasted CSV is imported (10 transactions) and the page moves to Categorize. A new visit to
   Import shows the whole CSV again with "We kept what you typed here. It is not saved yet." This time the page's own
   duplicate check catches it ("already on file"). A page without one would double up. The same 3 s `lastSubmit`
   window lets a form that asked "Did you mean a year?" for longer than 3 s be refilled. Change: when a store.update and
   a route change come from the same tap, drop that page's drafts. Tie skipForm to the submit event's task (the next
   store.update after a submit), not to a clock.
5. **The kept and parked lines name the card, not the form.** They say "Income sources", not "Edit Ana's salary":
   `formName` takes the closest section or card heading. Use the heading nearest above the form, which is also the
   identity in blocking 1.
6. **Addresses replaced without a hashchange make the path stale.** At `setup/view.js:285` a skipped question replaces
   `/owe-amounts` with `/spend`, but `current.path` stays the old one. Typing is then filed under the old path, so B8
   after a reload misses it. Read `pathOf(location.hash)` when saving, not at `arrive`.
7. **Storage is all or nothing.** `persist()` writes entries and drafts under one key, has no size cap and no expiry.
   One large paste (a year of bank CSV, a document in the reader) that exceeds the quota stops every place record (B3)
   for the visit, silently. Use separate keys for entries and drafts, cap each draft (for example 20 KB, larger ones
   are not kept), and add the 24 h expiry the design lists as "still to add".
8. **Risk 3's date check is not in `takeCached`.** Add `fmt.today()` to the cache entry before calling M2 safe past
   midnight.
9. **Phone checks.** Steps 1 and 4 of section 5 need a Safari tab: the home-screen app has no swipe Back. Add: leave a
   page with the keyboard up (the probe uses layout coordinates while the visual viewport is shifted), and a reload
   while the PC has a conflicting copy (blocking 5).

## Tried and held up

- **B1, on households and pages the architect did not use, processor 4x slower** (`cb/t16-back.mjs`). retiredCouple, kept
  path: debt/payoff, expenses at 1137, social-security, life-needs and people all came back to the same scroll and the
  same words at the top, Back and again. renterDebt, `keep=off` (the redraw path): the same words at the top on 5 of 5.
  The scroll is +60 where Next wrote the plan and the path bar grew, which is the anchor doing its job.
- **B6 on estate/legacy (severity 5, not walked by the architect)**, `cb/t17-legacy.mjs`: "Cy" and 50,000 are kept with
  "Not saved yet". Today both are wiped.
- **The return's held room is released**, after a Reload and after a hand-fired `planner:live` redraw during the hold
  (`cb/t6-room.mjs`, `cb/t6b-room-live.mjs`): `min ""` by +5 s, with 61 px of natural space below the last card.
- **Cost**: locate, snapshot or find on All pages (150 rows) takes 8 ms at 4x CPU (`cb/t15-cost.mjs`).
- **A double tap on Save at the bottom** re-saves; the echo's link overlaps the button by only 13 px (`cb/t5b-doubletap.mjs`).
- **The redraw path's observer is safe.** The `await m.render` delivers the removals while `drawn` is false; only the
  synchronous kept path leaks (blocking 3).
- **Secret boxes** (Settings `token`, `apiKey`) are never noted. The guess note survives the kept page's frame redraw
  (it is `ul.page-list`). Monte Carlo's runs select is drawn from module state, so it is never a draft and never
  re-fired on arrival.
- **Touch rules (`wtouch/qa/touch-rules.json`).** No rule there catches blockings 1 to 3 today:
  - D-FOCUS-KEPT only types into two boxes of one form.
  - D-WRONG is about invalid values.

  Two rules should be added:
  - **D-ROW-SWAP**: change every box in row A's form, tap row B; B's form equals B's saved values.
  - **D-NO-PHANTOM**: after any Back or Forward, no `.place-parked` or `.place-kept` line on a page whose path differs
    from where the typing happened.

  Blocking 4 needs D-BACK applied to `.save-echo a` links, which the sweep does not tap today.
