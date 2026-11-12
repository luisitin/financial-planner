# forms2 design: what breaks (critic)

Prototype copied to `w1/forms2-break/proto` (the original was not edited; my copy differs only by a `?lazy=1` switch for item 5),
served on 127.0.0.1:9381, phone 390 x 844, touch, sandbox, real taps at 450 ms. Scripts `w1/forms2-break/e1..e10*.mjs`,
results `w1/forms2-break/out/`, pictures `w1/forms2-break/shots/`. Line numbers are the prototype's `core/ui/dom.js` unless named.

## Blocking

**1. Undo joins every one-tap change made while its note is up, so one Undo takes back minutes of work (B11, M10, P8).**
- Evidence: `e1-undo.mjs` (ruth + bank lines, Subscriptions): "Not a subscription" on Netflix, Spotify, Hulu, 4 s apart, as a
  person deciding one by one. Note: "Hulu taken off this list (and off Bills). (3 changes)". Undo gave "Put back all 3." and
  `recurringIgnored` went back to `[]`. Cause: dom.js:406 joins any change made while the bar is connected, and every change
  re-arms the bar for 10 s, so a steady pace never ends the chain. Section 3 adopts it on transactions/categorize, where each
  pick files a payee and writes a rule: someone filing payees every few seconds builds one chain, and Undo for the last slip
  undoes all of them. Memory grows with it: `e7-heap.mjs`, 944 KB plan, 12 joined changes 3 s apart: heap 9 -> 26 MB
  (+1.4 MB a change, no cap). It drops back to 10 MB once the note goes.
- Change: join only a change that comes within about 1 s of the previous one (the double tap P8 is about). Otherwise the earlier
  change is final and the new note speaks for the new tap alone. Keep at most 2 plans. The note says what Undo will put back
  ("Undo puts Hulu back.").

**2. The Undo note covers the open menu and takes its taps.**
- Evidence: base.css `.undo-bar` z-index 42, above `#sidebar` (25) and `#scrim` (24). In `e1-undo.mjs (b)` the menu was opened
  4 s after the change. `elementFromPoint` on the right of the note returned the Undo button. `shots/e1-menu-open-under-note.png`
  shows the note over the menu rows between "Cash flow and budget" and "Debt". A thumb reaching for those rows lands on the note,
  and on its right half that is Undo (in that run, 3 changes reverted). B11 says the note "goes when I leave the page". Opening
  the menu is the first step of leaving, but it fires no `hashchange`.
- Change: hide the note when the drawer opens, or put it under the scrim with `pointer-events: none` while the drawer is open.
  Add a CONVENTIONS rule: no tappable fixed note above the menu.

**3. The opener's "twin" picks the wrong row, exactly in the case P1 is for.**
- Evidence: `e2-edit.mjs (A)`: Net worth (family), Edit on Ana's 401(k), balance 12345, Save, then the prototype's own `twin()`
  run on `ui.openerOf(form)`. The save changed the row's words, so the exact-row match failed and dom.js:344 `?? all[0]` returned
  the House row's Edit. At 390 px that is the hidden desktop-table button, so P1 does nothing. At 1280 px it is another visible
  row: P1 would centre and focus House while Ana's row sits at -57. Every edit that changes a figure changes the row's words,
  and the lists sort by amount. A second case is `e10-twins.mjs`: Contacts (Edit and Cancel both redraw the page), two rows
  that read the same, Edit on the second, Cancel. The focus went to the first row and the screen moved 408 -> 0. Today the
  focus goes nowhere and the screen stays at 408.
- Change: never guess. When there is no exact match, return nothing. Key the opener by record, not by words: rows carry
  `data-key` (the record id), and `openerOf` returns `{ key }`. Or hand P1 the place track's locator (figures read as `#`,
  row and section, "unsure: nothing is returned", place/design.md "The locator") and drop `twin()`.

**4. B10's recipe still throws away a half-typed add form: x-halfform is not closed.**
- Evidence: `e2-edit.mjs (B)` on the prototype's own adoption (Net worth `?under=1`): "+ Add another account", type "Credit union
  savings", then tap Edit on the third row. Only the "Save changes" form is left and the typed name is gone. After Cancel there
  is no add form at all (`shots/e2-b10-after-cancel.png`). Section 3's recipe for the 22 list pages is
  `ui.openUnder(row, formHost)`, and `formHost` is the one holder the add and edit forms share (net-worth `drawForm`, income
  `drawForm`, ledger :79-105). Moving it does not separate them.
- Change: `ui.openUnder(row, build)` creates its own holder under the row, calls `build(holder)` for the edit form, leaves the
  page's add host alone, and returns `close()`. Then say in section 8 that x-halfform depends on that API (or on the place
  track's typing memory).

**5. Section 2.1's "installed on the first ui.form() / ui.check() call" breaks B4 (and B2, B8, B9, B11) on pages reached without a ui.form.**
- Evidence: the prototype installs the listeners at import, behind the `DOC` guard (dom.js:416, :444), and that is what was
  measured. The text describes a lazy install instead. `e8-lazy.mjs` runs the text on my copy (`?lazy=1`): Update my balances
  opened directly, and opened after Income (renterDebt: Income's form is folded, so no `ui.form` runs), type 12..5, tap Save.
  Result: 0 words and the browser's bubble (`kitSpoke: false`), 2 of 2. With import-time install: "Type an amount in numbers,
  like 4,500.", 2 of 2. balance/update, balance/liquidity, scenarios/goal-seek, overview/dashboard and overview/start call no
  `ui.form` (grep).
- Change: install at import behind the `DOC` guard, as prototyped (it already keeps the stand-in-document view tests at 0
  failures), and correct 2.1 and build step 3.

## Should fix

6. **Return's "next" skips selects** (B7). `e3-keys.mjs (B)`, Income add form: Enter in "What is it" goes to Amount, skipping
   "Kind of income" and "Whose". Enter in Amount goes to "Yearly raise", skipping "How often". The iPhone's own › key visits
   selects, so someone using the return key never sees "How often" and saves "Every month". Change: "next" goes to the next
   focusable control of any kind (select and checkbox included), and "done" goes on the last control.
7. **The words drawn when a box is left move the box being typed in** (B2). `e6-leave.mjs`: Income, 150 in "Yearly raise", then
   the focus moves to "Starts" without a scroll (the › key), with Starts at the keyboard's edge. 350 ms later the words push
   Starts 24 px down, bottom 528 > 508, so half of it is behind the keyboard. This happens with `overflow-anchor` both auto and
   none. Change: when the box that was left is above the focused one, `scrollBy` the height the words add. Or draw them only when
   the focus leaves the form, or on Save.
8. **`reveal()` measures the screen with `window.innerHeight`** (dom.js:270). On an iPhone the keyboard shrinks
   `visualViewport`, not `innerHeight`. B7 makes Return in the last box a Save with the keyboard up, so M3's message and buttons
   (`nearest`) and the count line can count as "in view" while they are behind the keyboard. `start` also ignores
   `visualViewport.offsetTop`. Change: use `visualViewport` (offsetTop, height) when present. Add phone check H7: Home, year
   1900 in the last box, press return. The message and Save must show above the keyboard.
9. **Late answers and the place track's hold** (B13, P2). scenarios/compare:37, retirement/annuities:33 and
   scenarios/advisor-plan:33 draw their answer in `computeRemote(...).then(draw)`, after the render returns. P2 covers only
   scrolls "while drawing". Place M4 holds the tapped button through late growth (place/design.md 201-203, 254-255), so a
   `ui.reveal` in the late draw gets undone. Change in 2.12: a `ui.reveal` at any time ends the hold (the kit announces it,
   for example with an event the place track listens for).
10. **Undo's "before" can be older than another tab's save.** `undoable` takes `before = store.get()` (dom.js:398), and then
    `store.update` runs `otherTab()` first (core/store.js:293). `e5-twotab.mjs` (node, real undo.js): Undo of "Not a
    subscription" also removed the account the other tab added and put back its old balance (`done: 3, kept: 0`). That is the
    opposite of B11's promise. Change (one line, no store edit): `let before; store.update((d) => { before = store.get(); mutate(d); })`.
11. **A tap that changed nothing still gets an Undo that claims it put things back.** `e1-undo.mjs (c)`: on prioritizer, tap "Use
    these amounts" again after the note left. The note reads "Monthly amounts set on 4 goals. Undo"; tapping Undo shows "Your
    goals have their own amounts again.", but the amounts stay 1,189 / 836 / 585 / 673. Cause: dom.js:401 `after === before`
    is never true, because `update` always clones. Change: when `changesOf` is empty, show no note (0.5 to 38 ms, measured). Or
    at least, when Undo gives done 0 and kept 0, say "Nothing to put back: that tap changed nothing."
12. **Bottom notes still overlap when the other one came first.** `.undo-bar ~ .save-echo` only handles the shell's copy arriving
    after the note. `e6-leave.mjs (b)`: a save copy already up (as after a save whose notice was off screen), then "Not a
    subscription". The two overlap by 63 px and the earlier confirmation is hidden. The guide's `.gb-toast` (z-index 40, 9 s on
    a step) also sits under the note, and the retiree's step 5 "Use this one" is a section 3 undoable. Change: `toast()` lifts
    or removes any `.save-echo` / `.gb-toast` already up. Do P3 (one bottom note) now, not later.
13. **The opener is the click that built the form, not the one that opened it.** On the six pages whose Edit and Cancel redraw the
    page (balance/assets, household/contacts, household/life-events, household/calendar, household/documents, estate/documents),
    any other click that redraws while the form is open becomes its opener. With item 3's first-match, Cancel then goes to that
    row. Change: let a page name the opener (`ui.form(..., { opener: key })`) and keep the capture listener as the fallback.

## Held up

- **The opener does not leak to the next page.** `e3-keys.mjs (A)`, blank plan: on Next best action, press Enter on the link to
  Income. The focus is on nothing and scrollY is 0, 5 of 5, in both modes.
- **Drawing a page does not change the plan object** (the lazy diff's premise). `e4-mutate.mjs`: family, ruth and renterDebt ×
  157 pages; 0 pages changed the store's plan object while drawing, 0 errors (`e4-sanity.mjs` confirms the store is the app's own).
- **B1 and B7 held on other pages and households.** `e9-b1.mjs` on contacts, policies and pensions (ruth), expenses (freelancer)
  and people (patLee): 0 bubbles, nothing saved, words at the box, label visible, cursor in the first box. Expenses showed "2
  boxes need a fix: What is it, Amount.". Enter in the first box moved on 5 of 5 and saved nothing.
- **The money ceiling refuses no real figure.** Settings offers USD, EUR, MXN, GBP and CAD only (system/settings/view.js:44), and
  1,000,000,000 MXN is about $55M.
- **M3 loses nothing when it moves a page's message.** It copies text only: `ui.notice` is text-only (dom.js:26), and the one error
  notice with a link (overview/guide/view.js:81) is not drawn inside a `ui.form` handler.
- **No page uses the checks in a way M1 would trip.** No page calls `checkValidity` or `requestSubmit`. `reportValidity` is called
  only by balance/update:85 and app.js:429, and both reach M1 when the listeners are installed at import.
- **The kept plans are freed.** Once the Undo note leaves, the heap goes back to 10 MB (from 26 MB).
