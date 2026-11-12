# Wave 1, track forms2: form controls and answers (final design)

Base: branch `claude/creative-build-b531q0`. The design was written against c385e41 and is now re-based on the branch tip
**d22b718** (75 commits later; `core/ui/` and `core/app.js` unchanged in between, so the kit lands as designed, but six wave-2
builders closed or worked around many findings in their pages meanwhile: sections 3 and 8 are cut to what is still open on
d22b718). The builder builds on whatever tip the workflow names; every grep below must be re-run there.

Evidence for this final version (all under `w1/forms2/final/`): `tip/` is `git archive d22b718` with the changed kit in
`core/ui/dom.js`, `core/ui/undo.js`, `core/ui/base.css`, the two node test files, and two page edits made only to measure
helpers that need a page (`retirement/withdrawal-strategy`: Undo; `balance/net-worth`: edit under the row); `base/` is the
untouched tip. Served on 127.0.0.1:9387 (`?forms=off` in the address gives today's kit on the same server; evidence only,
not part of the design). Phone 390 x 844, touch, sandbox, real touch taps at the control's centre, real finger drags,
typing key by key, 450 ms between actions. Scripts: `flib.mjs` (helpers), `e-engine.mjs` (14 cases x 2 kits), `e-undo-edit.mjs`
(its Undo half; the edit half is re-run in `edit.log`), `e-enter.mjs`, `e-misc.mjs`, `e-payoff-leave.mjs`; results in `out/`
(`engine-off.log`, `engine-new.log`, `engine-new-recheck.json`, `undo-edit.log`, `edit.log`, `enter.log`, `misc.log`,
`leave-debt-payoff.json`, `leave-debt-mortgage.json`, `npm-test.log`, `npm-test2.log`, `sweep-base.*`, `sweep-new.*`,
`sweep-new2.*`), pictures in `shots/`. The first round's prototype and measurements
(`w1/forms2/proto`, `m-*.mjs`, `results/`) stay valid where this file does not say otherwise.

---

## 1. Behavior, in a person's words (the acceptance test)

Each item: what I do, what I see, what it closes, and the acceptance check (a kit script the builder writes as
`accept-forms/B<n>.mjs`; the measured run that already shows it is named in brackets).

**B1. A Save or Add that cannot go through says why at the box.** I tap Save with a box empty or wrong. The screen brings
that box up under the top bar with its name showing, the cursor is in it, the box has a red edge, and right under it a red
line says what to type: "Fill this in first.", "Type an amount first.", "Use a number from 0% to 100%.", "Type a number,
like 12.", "Pick a date that is not in the future.". No grey bubble. The line stays until the box is right and goes the moment
it is. When more than one box is wrong, a red line right above the buttons says "2 boxes need a fix: What are you saving for,
Amount needed."; it counts again as I fix each one and goes when one is left. Nothing I typed is lost.
Closes j-fat-fingers/FF5, p-career-household-system/F3, p-investments/INV-3, p-cashflow-a/CF-7, p-taxes/T6 (Save half),
p-insurance-estate/IE-4 (the words). [engine-new: goals-empty, debts-rate500, income-raise150, vehicles-addcar; misc: count]

**B2. Leaving a box I typed wrong says so once my tap has landed; the tap is not lost and the box I am now in does not move.**
I type 12..5 or 40% where 15% is the most and tap the next box (or use the keyboard's arrows): the next box takes the cursor
and stays where it was on the screen; then the red line appears under the box I left. An empty box says nothing until Save.
Closes p-taxes/T6 (leaving half), p-career-household-system/F3 (leaving half). [engine-new: home-blur (next box 649 -> 650),
payoff-junk-typing, mortgage-junk-next (lump box 702 -> 702, 20000 typed into it); misc: tab (470 -> 470)]

**B3. When the page itself refuses, its message is right above the button I tapped, and the button stays under my thumb.**
"Type the year as four digits from 1950 on..." appears directly above the form's buttons; the buttons do not move; one
message, not a stack; it stays until my next try. Closes j-fat-fingers/FF1, p-debt-property/DP-2 (message), p-investments/x-2
(message). [engine-new: home-year1900: Save 751 -> 751, 1 copy after 2 taps, in view; engine-off: 2 copies, 1,661 px above]

**B4. Every form speaks the same way, including hand-built forms and boxes outside any form whose button asks the browser.**
Update my balances, Goal seek, Credit cards' "0% months", Pay off debts' "Extra each month", Calendar, People, Health,
Holdings and Tax lots answer as in B1, with no change to those pages. Closes the bubble half of j-debt-fixer/D2 and
p-debt-property/DP-4 (the boxes are already held by claude-g's `reportValidity()`; now in our words), and the bubble on the
reportValidity() workarounds wave 2 added. [engine-new: update-direct, cc-months-empty, payoff-junk-save]

**B5. A real figure is taken as typed.** 11,200 miles, a 40-month loan, a raise of 2.555% are accepted; a whole-number box says
"Use a whole number, like 12."; nothing says "the two nearest valid values". Closes the step half of j-heavy-waiting/W6 and
CF-7's 2.555 (pages: already closed for Goal seek and Vehicles).

**B6. Impossible figures are stopped at the box.** An amount of a billion or more: "That is more than a billion: check for an
extra digit."; a year typed as 0026: "Check the year: type all four digits, like 2026."; on every money box and every
`ui.form` date box. Pages with a tighter limit say it the same way ("Use $10,000 or less."). Closes the billion-sized slips of
p-retirement-a/R-A10 and p-insurance-estate/IE-2, the date floor of p-investments/INV-10.

**B7. The keyboard's return key goes to the next box or choice; only a box with nothing after it saves.** In any box but the
last control it reads "next" and moves on, to a choice list too ("Kind of income", "From"); nothing is saved and nothing
closes. Only in a box with no control after it does it read "done" and save. In a what-if box that is in no form (Pay off
debts' "Extra each month", Mortgage's "Lump sum") return says what is wrong with what I typed, or goes to the next box of
that card, or with none puts the keyboard away; it never does nothing. Closes p-career-household-system/x-2,
p-insurance-estate/x-2, p-taxes/T2, j-first-freelancer/F6 (Android; an iPhone's number pad has no return key).
[enter: gifting today saves "Gift to Sam added." from the third box; new: to -> amount -> year -> From, nothing saved;
contacts today saves "Dr Lee" from the name box; new: name -> firm -> phone; sweep D-ENTER: 2 breaks (Pay off debts,
"Enter does nothing") -> 0 on 9 pages]

**B8. Opened with the keyboard, a form has the cursor in its first box.** Enter on "+ Add another income" puts the cursor in
"What is it"; a finger tap leaves the keyboard down. Closes j-keyboard-reader/K4 (opening half). [first round m-edit: 2 of 2]

**B9. Cancel takes me back to the row I came from, when the app knows the row for sure.** The row is mid-screen if it was off
screen, the focus is on its Edit. If the page drew the list again and two rows read the same, nothing moves (no guess).
Closes the Cancel half of p-balance/B3, p-transactions-helpers/T9, j-keyboard-reader/K4. [edit: Cancel focus on Edit, row on
screen; twins: today and new both stay at 408 with no wrong row]

**B10. A row's form opens under the row (pages that adopt it).** I tap Edit: the form opens right under that row; if its first
box would be under the screen's edge the screen moves just enough to show the row and that box; after Save the row is on
the screen with its new figure and the confirmation; Cancel closes it in place with the focus on Edit; a half-typed add form
elsewhere on the page is left as typed. Closes p-transactions-helpers/T9, p-balance/B3 (opening and Cancel), with section 3.
[edit-first-new: row at 700 -> scrolled 64, row at 624 and first box 768-836 on screen; today's page 0 px and the first box
at 832-900, under the edge; Cancel: today the focus is on nothing and the row moves to 83 px, final focus on Edit and the
row at 395; after Save both kits show the row (today 252, final 247) with "Ana's 401(k) saved." in view: the shell's
keepScroll already keeps that half on Net worth; addTypingKept: "Credit union savings" still in the add form after Edit on
another row]

**B11. A one-tap change can be taken back from its own green line.** I tap "Plan on $6,600 a month", pick a category, "Remove
the copy": the page's green line says what happened and carries an outlined 44 px "Undo". It stays until my next change or
until I leave the page (no timer). Undo puts back exactly what that tap changed and the line says so in the page's words
("Back to $7,000 a month, as before."). A second, separate change gets its own line; the earlier one is then final. Nothing
sits fixed over the page or the menu. If part of it was changed again since (another device), Undo leaves that part and
says "What you changed after that was left as it is.". Closes, with section 3, p-retirement-b/x-3,
p-transactions-helpers/T11, p-transactions-helpers/x-duplicates. [undo: 7,000 -> 6,600 -> Undo -> 7,000; line in view at
511-656; still there at 12 s; menu rows hit the menu; a later "Use this one" left 6,600 alone; no fixed element on screen]

**B12. Every Remove asks first, naming what goes** (window.confirm through `ui.confirm`, as 46 places do on the tip). Rule
only; closed on the branch for p-investments/INV-2 and p-taxes/x-4 (capital gains); taxes/documents is claude-a's.

**B13. After Work it out, Compare or Save the answer is on the screen** (pages that adopt the recipe): the answer card is just
under the top bar with "Saved." inside it, the figures stay open below it, nothing goes away by a timer, and when the answer
is already on screen nothing moves. Closes, with section 3, p-retirement-c-scenarios/RC-11, p-debt-property/DP-1,
p-cashflow-b-goals/F6 (rent-vs-buy, renovation).

**B14. A tap after typing in a what-if box lands.** Nothing the kit draws moves anything between my finger going down and its
click. [engine-new: mortgage-junk-next, report-on-change: today the tap is pulled back to the box the page reported and
"Roof" lands in it ("12..5Roof"); new: the tap lands, "Roof" in the box I tapped, the words under the other box]

**B15. The way on is a 44 px button that says where it goes.** Rule in CONVENTIONS; the findings are closed on the branch.

**B16. Phone and email boxes bring up the right keyboard** (`type: "tel"` / `"email"` in `ui.form`). Closed on the branch for
Contacts by the page itself; the kit makes it one word for any page.

**B17. Typing is never interrupted by a check I did not ask for.** A page that quietly checks a box while I type (Pay off
debts' preview, Mortgage's what-if) does not move my cursor or draw words; the words wait until I leave the box.
[engine-new: silent-input-check: cursor stays in "target", "50" typed whole; the first design moved the cursor to "name" after
one key and kept "5"; silent-click-check: no words, focus stays on the tapped button]

**B18. Enter twice saves once.** Two quick returns in the last box add one row, not two (touch rule D-TWICE, Enter half).

---

## 2. Mechanisms

All in `core/ui/dom.js` (one new pure file, `core/ui/undo.js`) and a dozen lines of `core/ui/base.css`. Every listener is
installed **once, when dom.js is first imported**, and only when `document.addEventListener` and `document.documentElement`
exist (the view tests' stand-in document, `qa/fixtures/fake-dom.mjs`, has neither, so view tests see exactly today's kit);
`data-forms-kit="1"` on `<html>` stops a second copy of the module (a framed copy, a cache-busted import) from installing twice. Every kit path that touches `document` inside
`form()`'s submit wrapper keeps today's path when there is no real document (the evidence run found one: `document.querySelectorAll`
in the wrapper failed `modules/retirement/contributions/module.test.mjs`; fixed by the guard, 17 of 17 pass).

### M1. The engine: the browser's checks stay the engine; a report speaks in our words; a silent check stays silent (B1, B4, B17)
- **Where.** (a) One capture listener for `invalid` on `document`. `invalid` fires when a submit is held, on Enter, and on
  `reportValidity()` (`form.` or box), in every form and for boxes in no form. The listener calls `preventDefault()` (no
  bubble), draws the words (M2) and, for the first box of that pass (a `setTimeout(0)` marks the pass; the browser fires the
  events in one task), brings its label and box under the top bar and puts the cursor in it (M4). Boxes in a `novalidate`
  form are left alone (Get started, Goal seek and Social Security check themselves). (b) `checkValidity()` is the platform's
  silent check: `HTMLInputElement`, `HTMLSelectElement`, `HTMLTextAreaElement` and `HTMLFormElement.prototype.checkValidity`
  are wrapped once to count a depth while the original runs, and the listener does nothing while that depth is above 0. So
  `checkValidity()` keeps its meaning (silent), `reportValidity()` keeps its meaning (tell the person), and only the way the
  report looks changes. (c) While a finger or mouse is down (capture `pointerdown` until that gesture's `click`, or 400 ms
  after `pointerup` / at `pointercancel` when no click comes) the listener only notes the box and draws its words once the
  click has landed, without moving the cursor (the person tapped somewhere on purpose).
- **Keeps.** Nothing between taps: each box's words live in one `<small class="help field-error">` under it, tied by
  `aria-describedby`, with `aria-invalid="true"` on the box; they go at the next `input`/`change` that makes the box valid.
- **Fit.** A held Save makes no `store.update`, so no shell redraw follows. `mendBlockedForms` (core/app.js, framed copies)
  calls `form.reportValidity()`: it now speaks our words, unchanged. The guide frame, sync bar and heal reload are untouched.
- **Measured on d22b718** (`out/engine-off.log` vs `out/engine-new.log`, 14 cases, 4 households):

  | case | today | final |
  |---|---|---|
  | Goals, Add goal, nothing typed (family) | 2 grey bubbles "Please fill out this field." | words at both boxes, cursor in box 1, label shown, "2 boxes need a fix" |
  | Debts, rate 500 | bubble "Value must be less than or equal to 100." | "Use a number from 0% to 100%.", cursor, label |
  | Update my balances opened directly (renterDebt; no `ui.form` drawn first) | bubble, label hidden | "Type an amount in numbers, like 4,500.", cursor, label |
  | Credit cards, 0% months 60 (formless, `reportValidity`) | bubble "Value must be less than or equal to 36." | "Use a number from 1 to 36." at the box |
  | Pay off debts, 50.. then Save plan (formless, `reportValidity`) | bubble | words at the box, cursor, not saved |
  | Pay off debts, 50.. typed (silent `checkValidity` on every key), then tap Order | nothing while typing | nothing while typing; words after the tap landed, focus on Order |
  | Mortgage, 50.. typed (silent check), tap the Lump sum box, type 20000 | lump box focused, 20000 in it | same, box did not move (702 -> 702), words under Extra |
  | `input` listener calling `checkValidity()` on a required box (the scope critic's s2) | cursor kept, "50" | cursor kept, "50" (the first design: cursor jumped, "5") |
  | click handler calling `checkValidity()` (Pay off debts' Up pattern) | silent | silent, focus on the tapped button |
  | `change` listener calling `reportValidity()` (Tax lots' pattern), then tap the next box | bubble; focus pulled back; "12..5Roof" | tap lands, "Roof" in the tapped box, words under the other |
  | Home, value grows 40, tap Selling costs | nothing | words; Selling costs focused and still (649 -> 650) |
  | Income, raise 150, Add income | bubble | words, cursor in the raise box |
  | Home, year 1900, Save twice | 2 copies of the message 1,600 px above | 1 copy above Save, Save did not move |
  | Vehicles, Add car with only a name | bubble "Please fill out this field." | "Type an amount first." at "What it is worth today" |

  `npm test` on the evidence copy with the final kit (`out/npm-test2.log`): 189,247 tests, 188,604 pass, 639 to-do (the
  student-loan key's known items), 1 failure: `tests/live-check.test.mjs` "what the site should serve", which runs `git diff`
  and the copy is not a repository. Before the guard fix there was a second one, `retirement/contributions` "stress test: rows
  say Edit" (`out/npm-test.log`); it passes now.
- **Alternative weighed again (scope critic 2): the kit takes validation over (`novalidate` on every `ui.form`, the kit reads
  each box's `validity` on submit).** On d22b718 it reaches only `ui.form`; the ten `reportValidity()` callers wave 2 added
  (four of them on boxes in no form) would keep the grey bubble, and Update my balances' hand-built form would too. Its one
  advantage is independence from how a browser dispatches `invalid` (iPhone check H1); the spec and WebKit both block a
  submit when any box is invalid even when every `invalid` is cancelled. Kept as the fallback: 10 lines inside `form()` if
  H1 fails. **Chosen: the browser engine, with the silent-check wrapper and the finger-down hold**, because it is the only
  one that speaks for every report on the tip without a page edit.
- **Rule it adds (CONVENTIONS).** `reportValidity()` and a held submit speak (words at the box, the cursor moves);
  `checkValidity()` and `el.validity.valid` are silent. Prefer `ui.check(boxes)` for boxes outside a form.

### M2. The words, from each box's own state (B1, B5, B6)
`wordsFor(el)` (exported, pure over `el.validity`, `el.dataset`, `type`, `min`, `max`, `step`, `value`, `validationMessage`;
node tests with plain objects in `tests/ui-words.test.mjs`). Order: the box's own custom message (money boxes, a page's own
`setCustomValidity`), then empty ("Fill this in first.", "Type an amount first.", "Choose one first.", "Pick a date first.",
"Check this box to go on.", or the field's `missing` words), unreadable ("Type a number, like 12.", "Type a number, like 3.5
for 3.5%.", "Type the whole date: month, day and year."), email ("Type an email address, like name@example.com."), range
("Use a number from 0% to 100%.", "Use 5 or less."; dates: "Check the year: type all four digits, like 2026." below the kit's
1900 floor, "Pick a date that is not in the future." when the limit is today, else "Pick a date on or after <date>."), step
("Use a whole number, like 12."; a hand-built coarse step: "Round it to the nearest 1000, like 12000."), length, pattern (the
box's `title`). Numbers under 10,000 have no comma (years). Money words come from `moneyBox` itself and carry the sign:
"Type an amount in numbers, like 4,500.", "Use $0 or more.", "Use $10,000 or less.", and for the default ceiling "That is more
than a billion: check for an extra digit.". The kit never calls `setCustomValidity` on a box it did not build (a stale
message would block a later Save after a value is written without an `input` event, e.g. by the place track's typing restore).

### M3. The line above the buttons, and pages' own red notices brought there (B1 count, B3)
- **Where.** `ui.form`'s submit wrapper notes the `.notice.error` nodes on the page before calling the page's handler; any new
  one afterwards is marked `data-moved="kit"`, removed, and its text drawn once as `div.notice.error.form-error[role=alert]`
  right above `.form-actions`; then message and buttons are revealed together with the least scroll. The count line (M1) uses
  the same slot (`.kit-count`) and is recounted every time a box's words go; below 2 it goes. Each try clears the slot first.
  A new error also means "keep what was typed" (no `resetAfter`).
- **Steady.** Drawing that line (or a box's leaving words) must not move what the person is touching: `steady(anchor, draw)`
  reads the anchor's screen top, draws, and scrolls by the difference (Safari has no scroll anchoring). Anchor: the focused
  box when the focus is in the form, else the form's buttons. Measured: Save 751 -> 751; the box being typed in 470 -> 470.
- **Fit.** Same task as the tap; no store update, no redraw. If the page redrew itself inside its handler (the form is gone),
  the kit leaves the page's notice where it is. The 22 sites on the tip (home :127/:130, mortgage :83, vehicles :101, rental
  :168, crypto :135-136, employer-stock :127/:152, contributions, budget-percent, equity, taxes/documents (claude-a), ...) are
  right with no page edit.

### M4. `ui.reveal(el, { block })` (B1, B3, B9, B10, B13)
Does nothing when `el` is wholly on screen. The screen is what the person sees: below the top bar and above the keyboard
(`visualViewport.offsetTop`/`height` when present, else `innerHeight`). `start` puts its top 8 px under the top bar (a box with
its label, an answer card), `center` mid-screen (a row), `nearest` the least scroll (a message with its buttons, a row with its
form). Instant (a smooth scroll and the iPhone's own scroll to a focused box fight). Before it scrolls it dispatches
`planner:reveal` on `window` so the place track stops holding the place it kept (late answers drawn after `computeRemote`).
`ui.spanOf(a, b)` gives the stretch from `a` to `b` for it. base.css adds `scroll-margin-top: 40px` on `.field` boxes so the
browser's own scroll to a box (the iPhone's arrows) keeps the label below the top bar.

### M5. What `ui.form` and `ui.moneyBox` put on each box (B5, B6, B16)
`number`/`percent`: `step="1"` when the field's step is a whole number of 1 or more, `"any"` otherwise; `data-kind="number" |
"percent"`. `date`: `min` defaults to `1900-01-01`, `max: "today"` is a token for today. Money: `moneyBox` sets
`data-kind="money"` and defaults `max` to 1,000,000,000 when the caller gives none (hand-built money boxes too). `tel`/`email`:
`type`, `inputmode`, `autocomplete`, and for email `autocapitalize="off"`, `spellcheck="false"`. `missing: "Type the amount of
the gift."`: the words for an empty box. Nothing else in `readForm` changes.

### M6. `ui.fieldError(box, text)` and `ui.check(boxes)` (B3, B4)
`return ui.fieldError(yearBox, "Type the year as four digits from 1950 on...")` in a `ui.form` handler: the words at that box,
label and box in view, cursor in it, the form kept; the words go at the box's next change. `if (!ui.check([extraIn])) return;`
before a plain button saves boxes that are in no form: each wrong box gets its words, the first gets the cursor, it returns
false. Both draw nothing in the stand-in document.

### M7. Return: next, done, and once (B7, B18)
`ui.form` only (hand-built forms keep theirs; Get started already does next/done). On `focusin`, a one-line box (text, number,
email, tel, date) gets `enterkeyhint="next"` when a shown, enabled control of any kind (box, choice list, tick box, text area)
follows it in the form, else `"done"`. `keydown` Enter in a one-line box with a control after it: `preventDefault()` and focus
that control. With nothing after it the browser's implicit submit runs, and with it M1. A form whose last submit went through
(handler did not return false, no words drawn) ignores another submit for 1 s (Enter twice; a bounce).

Boxes in no form inside `#content` (what-if boxes: Pay off debts, Mortgage, Credit cards' promo, the guesses): one `keydown`
listener on `document` in the **bubble** phase, so a page's own Enter on a box in no form runs first and is left alone
(`e.defaultPrevented`): on d22b718 those are Ask's send and the ledger's search, and both call `preventDefault()`; Update my
balances and Get started are forms and keep their own Return (the other `"Enter"` handlers on the tip are rows with
`role="button"`, not boxes). Search boxes are skipped. A box that holds something unusable: `el.reportValidity()` (our words through M1, cursor kept); otherwise the
next shown control in the same `.form` / `.card` / `fieldset`, else `blur()` (the keyboard goes down; the page's `change`
runs). `enterkeyhint` next/done the same way on `focusin`.

### M8. What opened a form (B8, B9)
One capture `click` listener on `document` notes the control just activated (button, link, summary, row, `[data-key]` element),
whether it came from the keyboard (`detail === 0`), the record key of its row (`closest("[data-key]")`) and its words; it is
forgotten at the end of that task. A `ui.form` built during that click records it as its opener; `ui.form(..., { opener })`
lets a page name it. Opened from the keyboard, the first shown control gets the cursor; a touch opens nothing by itself. The
kit's Cancel runs the page's `onCancel`, then finds the opener: the same node if it is still on the page, else the one control
with the same words inside the one element with the same `data-key`; otherwise nothing (never a guess by words alone), and
brings it mid-screen when it is not on screen and focuses it with `preventScroll`.

### M9. `ui.openUnder(row, build)`: a row's form in its own holder under the row (B10)
`const close = ui.openUnder(rowEl, (holder) => drawEditForm(holder))`. The kit makes the holder (`li.rec-form` after an `<li>`,
`tr.rec-form > td[colspan]` after a `<tr>`, else `div.rec-form`), puts it right after the row, calls `build(holder)`, then
reveals the span from the row's top to the bottom of the form's first control's field with `nearest` (nothing moves when both
are on screen); opened from the keyboard, the first control gets the cursor. `close()` removes the holder and puts the focus on
the control that opened it. The page's add form keeps its own host, so its typing is never swapped away. Called from the
tap's handler; a page that draws its edit form during render may call it there (then it does not scroll: the row is not on the
page yet). A stray tap on another row: the page closes the open holder and opens the new one; the typing in the closed one is
the place track's typing memory ("We kept what you typed in ...").

### M10. `ui.undoable(store, mutate)` and the Undo in the green line (B11)
- `ui.undoable(store, mutate)` makes the change with one `store.update`, taking `before = store.get()` inside the update
  callback (after the store has taken another tab's save, `core/store.js` update()), and works out the changes at once with
  `changesOf(before, after)` (`core/ui/undo.js`, pure). It returns `null` when nothing changed (no Undo for a tap that changed
  nothing), else `undo()`: one `store.update((d) => takeBack(d, changes))` returning `{ done, kept }`; a second call does
  nothing. Only the change list is kept (the two plans are dropped at once), so memory does not grow with the plan.
- `takeBack` puts back only what still holds the value the change wrote, a removed row only if no row with its id is back, an
  added row only if unchanged since; `meta` is skipped; the guesses ledger is a plain section (a removed account's guess comes
  back with it); `settle` runs on the Undo like on any update.
- `ui.notice("ok", words, { undo, undone })` draws the green line with one outlined 44 px "Undo" (`button.notice-action`); its
  tap runs `undo()` and then `undone(r)`, where the page sets its next `pending` (`ui.undoneWords(r, "Back to $7,000 a month,
  as before.")` adds "What you changed after that was left as it is." when part was kept, or says "Nothing to put back: it was
  changed again after that."). `notice(kind, words, { action: { label, run } })` is the same for any single button.
- Page recipe: `pending = { text, undo: ui.undoable(ctx.store, (d) => ...) }`; on render, if `pending.undo`, draw the notice
  with `{ undo, undone }` where the change happened (the row's slot, or the top of its card), no `setTimeout` removal. It goes
  with the next draw that is not this one (the next change, leaving the page): one Undo at a time, for the change it names.
- Measured on withdrawal-strategy (evidence edit, family): 7,000 -> "Plan on $6,600 a month" -> 6,600; the line with Undo at
  511-656 in view, no fixed element, still there 12 s later; the menu opened over it hits the menu at 300/500/700 px; Undo ->
  7,000 and "Back to $7,000 a month, as before." in view; then a second "Plan on" (6,600) and a separate "Use this one" (the way
  of taking money out changed from a fixed amount to a percentage): 6,600 stayed, and no Undo from the earlier change was left
  on the page. Node: `tests/ui-undo.test.mjs` 11 of 11 (no change -> null; another tab's account and balance kept; Undo twice
  does nothing; two taps are two Undos).

### M11. Notices (K5) and CSS (core/ui/base.css, form, notice and fold selectors)
`ui.notice("error", ...)` gets `role="alert"` (taps handoff, j-keyboard-reader/K5). CSS: `.field-error` (red, 600),
`[aria-invalid="true"]` boxes (red edge), `.form-error` spanning the grid, `scroll-margin-top: 40px` on `.field` boxes,
`.rec-form` (and its record-list border), `.notice.has-action` (text and button on one line, wrapping on a phone),
`.notice .notice-action`, and in the existing reduced-motion block `.fold .fold-chev, .scroll-hint::after { transition: none }`
(taps handoff, j-hard-conditions/HC-5). No new global CSS outside base.css; nothing `position: fixed`.

### M12. Seams with the other two wave-1 tracks (who changes what, in which order, what each gives the other)

Ownership. **forms** owns `core/ui/dom.js` (every function, old and new), `core/ui/undo.js`, the base.css blocks above, the
CONVENTIONS section "Answers in forms", `tests/ui-undo.test.mjs`, `tests/ui-words.test.mjs`, `qa/fixtures/kit-forms.html` and
`qa/fixtures/kit-forms.js`. forms changes **nothing** in `core/app.js`, `core/router.js`, `core/place.js`, `core/taps.js`,
`index.html` or `frame.js`. **place** owns `show()`'s keepScroll branch, `echo()`, `core/place.js` and `.save-echo*` /
`.place-*` CSS. **taps** owns the tap guard, drawer, search, top bar and their CSS. Apply order: any; the forms patch touches
no file the others touch except base.css (separate blocks: forms appends after `.form-actions` and after `.notice.info`, and
edits the one reduced-motion line, which taps also wants: taps adds its `#sidebar`/`.nav-group-head .chev` there, so the two
edits must be merged into one line by whoever applies second), CONVENTIONS.md (separate sections) and CHANGELOG.md (one line each).

| # | forms gives | to | exact interface |
|---|---|---|---|
| G1 | the kit scrolled on purpose | place | `window` event `planner:reveal` fired by `ui.reveal` before it scrolls (during render or later): place ends its hold / anchor restore for this draw and counts it as "the page scrolled itself" |
| G2 | a page notice the kit moved | place | the removed node carries `data-moved="kit"` and is removed in the same task as the kit's `.form-error` is inserted; place's notice put-back (MutationObserver) or remove-shim must skip `[data-moved]` |
| G3 | a notice with one button | place | `.notice.ok > button.notice-action` (Undo, or a page's single action): the echo's "one way on" takes this button first |
| G4 | nothing moves between a finger's down and its click | place, taps | the kit draws no words and inserts nothing from `pointerdown` until that gesture's `click` (or 400 ms after `pointerup`/`pointercancel`) |
| G5 | Enter twice saves once | taps | `ui.form` ignores a submit within 1 s of one that went through (D-TWICE for Enter; taps' guard covers taps) |
| G6 | errors read out | taps | `role="alert"` on `ui.notice("error")` and on `.form-error` (K5) |
| G7 | reduced motion for the kit's chevrons | taps | `.fold .fold-chev, .scroll-hint::after { transition: none }` in the reduced-motion block (HC-5) |

| # | forms needs | from | exact behavior |
|---|---|---|---|
| N1 | focus after a redraw when the focused control is gone (Save of a closed form, Undo, "Use this one" replaced) | place | after a keepScroll redraw, when the control that had the focus inside `#content` is not drawn again, focus this redraw's fresh `.notice.ok`/`.notice.error` (`tabindex="-1"`, `preventScroll`) if it is on screen; otherwise leave the focus. Closes K4's after-save half and the person critic's "focus after Undo" (today: on nothing) |
| N2 | a page that scrolls itself wins | place | keep core/app.js's "a page that scrolls itself while drawing wins", and treat `planner:reveal` after the draw the same way (G1) |
| N3 | typed values put back quietly | place | write `.value` and dispatch `input` (and `change` for choices); never call `reportValidity()` (would speak); `checkValidity()` is silent now and safe |
| N4 | focus moves only on a redraw | place | never move the focus on events that are not a redraw (a held Save puts the cursor in the bad box on purpose; Cancel's return is the kit's) |
| N5 | the kit's listeners see every click | taps | the kit's capture listeners are installed when dom.js is imported, before app.js boots, so they run before the guard's; the kit only records the opener and flushes held words on a click, which is harmless for a swallowed one. A gesture the guard swallows at `touchend` gives no click: the kit's 400 ms timer flushes |
| N6 | one wording for "Undo" | place | in the kit "Undo" means "take back that change to the plan" and appears only inside the green line that names the change; place's button beside a form's buttons should not be a bare "Undo" ("Undo my typing" is fine; "Clear what I typed" is clearer: place decides) |

Taken from the other tracks: taps' three handoffs (G5, G6, G7). Declined: claude-g's "kit-wide `more: true` fold" (WORKBOARD
22:30): no finding of these seven causes needs it and goals/goals already folds its optional boxes itself; it is the natural
answer to the sweep's D-KEYBOARD-UP breaks (11 on 9 pages, "the form's button is far below the box", unchanged by this
design), so it is listed for a later kit change. Dropped from the first design: P1 (place to centre "the opener's twin" after
a save): it guessed by words and picked the wrong row (break critic 3). The Save half is already kept by the shell's
keepScroll where the page redraws in place (Net worth measured: the row on screen after Save in both kits); where a page's
shared form sits far from the list, `openUnder` adoption closes it (section 3), and until then it stays open (section 8).

### M13. The touch sweep (wtouch `qa/touch-rules.json`)
Run with real touch on d22b718 and on the evidence copy: goals/goals, estate/gifting, household/contacts, balance/liabilities,
property/vehicles, property/home, debt/payoff, cashflow/income (and debt/mortgage on the final run) x family, renter; rules
D-WRONG, D-ENTER, D-UNDO, D-SEEN, D-FOCUS-KEPT, D-SCROLL-KEPT, D-KEYBOARD-UP, T-COVERED (`out/sweep-base.*`, `out/sweep-new.*`
before the formless Return, `out/sweep-new2.*` final).

| rule | checked (final) | today | final | what changed |
|---|---|---|---|---|
| D-WRONG | 146 | 13 (10 "saved without a word": a year typed 0026 in Started, Starts, By when, the exact date; 2 "no words"; 1 "off the screen") | 2 on the same 8 pages (+2 on Mortgage), all "no words" on boxes in no form (Pay off debts' and Mortgage's what-if boxes) whose words ARE drawn and in view (`out/leave-debt-payoff.json`, `out/leave-debt-mortgage.json`: "Type an amount in numbers, like 4,500." under the box; today nothing); the sweep counts only `invalid` events and `.notice`s | B6 date floor, B1, M1 leaving words |
| D-ENTER | 152 | 2 ("Enter does nothing", Pay off debts) | 0 | M7 formless Return |
| D-FOCUS-KEPT | 156 | 0 | 0 | stays green (the hold) |
| T-COVERED | 431 | 0 | 0 | stays green (nothing fixed added) |
| D-SCROLL-KEPT | 81 | 4 | 4, the same | not the kit: Home's Save scrolls -436 px, Vehicles' Add car and Compare -435/-929 px, Income's Remove -90 px (page scrolls; place's "page scroll wins" + B13 recipe, section 3) |
| D-SEEN | 50 | 3 | 3, the same | UI-RESULT pages (goals Save changes, Home Save, Vehicles Save): B13 recipe / openUnder adoption, section 3 |
| D-KEYBOARD-UP | 156 | 11 | 11, the same | long forms (Goals, Contacts, Home, Vehicles): not one of the seven causes; claude-g's `more: true` fold is the later answer |
| D-UNDO | 10 | 1 | 1, the same | Goals "Save changes" on the emergency-fund goal (renter) drops one of its funding rows (`fundedBy`) with no question: a goals page item outside the 55; the landing session files it in docs/FEEDBACK.md for the goals lane (claude-g) |

Totals: 34 breaks today -> 21 final on the same 8 pages (Mortgage adds only its 2 unread words). Rules turned
green by the kit on these pages: D-ENTER; D-WRONG once the sweep reads the box's words (ask 1). Staying green: D-FOCUS-KEPT,
T-COVERED. Turned green by section 3 adoptions with place: D-SEEN, D-SCROLL-KEPT (by page). Also T-KEYBOARD (B16) and
D-TWICE's Enter half (B18), not in this run.

Asked of the sweep's owner: (1) a strict D-WRONG: an `invalid` that was not default-prevented is a break, and "words" include
the text of the box's `aria-describedby` element read after the page settles (today's rule counts the browser's own sentence
as words, records it before the kit's listener, and cannot see words drawn when a box in no form is left); (2) a D-UNDO
variant for one-tap overwrites (a tap that changes a typed figure with no form must ask or offer Undo); (3) D-ENTER's stricter
variant: Enter in a box that has a control after it must not save.

---

## 3. What a page must do (wave 2 adoption, still open on d22b718)

The kit alone already fixes B1-B9, B14, B17, B18 on every page, claude-a's included. These are the page edits that remain,
each one to five lines, with the lane that owns the page (WORKBOARD, TEAM.md "Now editing" on d22b718). Rows marked (a) go
to the claude-a handoff. A page is edited only after its owner's claim allows it.

| page (owner) | change | finding |
|---|---|---|
| transactions/ledger, transactions/categories, transactions/rules (claude-d's lane, released; "waits for wave 1") | edit form via `ui.openUnder(row, build)`; `onCancel: close`; the save's green line in the row's card | p-transactions-helpers/T9, j-keyboard-reader/K4 |
| balance/net-worth (claude-g, claimed for review N3 until claude-r's clean round), cashflow/expenses (claude-g) | same (measured on Net worth in the evidence copy) | p-balance/B3 |
| the other list pages that still scroll to a shared form: cashflow/income, cashflow/budget, household/people, goals/goals, insurance/policies, insurance/health, estate/inheritance, estate/digital, estate/legacy, estate/gifting, retirement/contributions, retirement/annuities, retirement/pensions, taxes/capital-gains, investments/holdings (claude-g, claude-h, claude-e lanes); goals/travel (a) | same; pages whose Edit redraws the page put `data-key="<record id>"` on each row so Cancel finds it | j-keyboard-reader/K4 (Save focus with place N1) |
| retirement/withdrawal-strategy (claude-e, released) | "Plan on $X a month": `pending = { text, undo: ui.undoable(...) }`, notice with `{ undo, undone }`, no 4 s timer (the evidence edit, 6 lines) | p-retirement-b/x-3 |
| transactions/categorize (claude-d) | a single pick through `ui.undoable` (files, renames and writes the rule in one change, so one Undo takes all back); its line stays (drop the 5 s timer) | p-transactions-helpers/T11 |
| transactions/duplicates (claude-d) | "Remove the copy" through `ui.undoable`; the line with Undo drawn before the "No duplicates" early return | p-transactions-helpers/x-duplicates |
| retirement/social-security (claude-e) | the Undo after "Removed" through `ui.undoable` (claude-e's ask) | claude-e's wave-1 note |
| household/people, balance/update (claude-g) | their Undo puts back the whole plan (`structuredClone(was)`), which also undoes another device's later save: switch to `ui.undoable` | scope critic 3 |
| scenarios/advisor-plan, scenarios/compare, retirement/annuities (claude-e) | B13 recipe: module-level `justSaved`; draw the figures open on that draw; "Saved." inside the answer card (no timer); `ui.reveal(answerCard)` (also inside a late `computeRemote().then(draw)`) | p-retirement-c-scenarios/RC-11 |
| property/rent-vs-buy, property/renovation, property/home (claude-g; "left for wave 1" by claude-r) | B13 recipe | p-cashflow-b-goals/F6, p-debt-property/DP-1 |
| property/rental, property/vehicles (claude-g) | after an add, the new card's heading `ui.reveal`ed with its notice in it | p-debt-property/DP-1 |
| goals/vehicle, goals/charitable (a) | B13 recipe | p-cashflow-b-goals/F6 |
| property/home, debt/mortgage (year), property/vehicles, property/rental, investments/crypto, investments/employer-stock (claude-g, claude-h); taxes/documents (a) | optional: `return ui.fieldError(box, ...)` instead of `prepend`, so the words sit at the box (M3 already shows them above the buttons) | j-fat-fingers/FF1, p-investments/x-2 |
| taxes/capital-gains :54, taxes/brackets :51 (claude-h), retirement/social-security :67 (claude-e) | drop the coarse `step` ("1000", "10") on the hand-built boxes | j-heavy-waiting/W6 (rule) |
| retirement/projection view (claude-e; not compute.js) | spending's `max` is already `SPEND_MONTHLY_CEILING`: nothing; contributions closed in f80661e | p-retirement-a/R-A10 |
| insurance/ltc (claude-h) | label "Prices where you live, compared with the country", help "100 = the national price" (still "Costs where you live" on d22b718) | p-insurance-estate/IE-4 (label half) |

WORKBOARD message for the landing session to post (wave 1 itself does not commit):
"claude-b -> claude-d, claude-e, claude-g, claude-h, claude-a (handoff): wave 1's form kit is on the branch (<commit>). Waiting
items are now one to six lines each: `ui.undoable` + `ui.notice("ok", text, { undo, undone })` for T11 (categorize),
x-duplicates (duplicates), x-3 (withdrawal-strategy "Plan on"), Social Security's "Removed", and to replace the whole-plan
Undo on People and Update my balances; `ui.openUnder(row, build)` for T9 (ledger, categories, rules) and B3 (net worth,
expenses); `ui.reveal(answerCard)` with the B13 recipe in docs/CONVENTIONS.md "Answers in forms" for RC-11 (advisor-plan,
compare, annuities) and DP-1/F6 (rent-vs-buy, renovation, home, rental, vehicles). Nothing to do for the red messages,
the grey bubbles, Enter, or the reportValidity() workarounds: the kit speaks for them now."

---

## 4. Risks: what could be worse than today, and the check that catches it

| risk | check |
|---|---|
| A word drawn between a finger's down and its click moves the target and the tap is lost | the hold (M1 c); `accept-forms/B2.mjs`, `B14.mjs` (home-blur, mortgage-junk-next, report-on-change); touch rule D-FOCUS-KEPT |
| The kit's listeners run in the view tests' stand-in document | DOC guard on install and in the submit wrapper (one place found and fixed); `npm test` 0 new failures |
| Wrapping `checkValidity` changes its result or misses a caller | the wrapper only counts a depth around the original; `accept-forms/B17.mjs` (input and click handlers); `grep -rn "checkValidity" modules core` listed in the build log |
| `reportValidity()` callers that relied on the browser focusing the box | the kit focuses the first box of a pass, as the browser did (except while a finger is down, where the browser's focus stole the tap) |
| Safari does not block a submit when every `invalid` is cancelled (a held form saves) | phone check H1; fallback: `novalidate` + the kit's own check inside `form()` (10 lines) |
| The 1e9 ceiling or 1900 floor refuses a real figure | settings offer USD, EUR, MXN, GBP, CAD (1e9 MXN is about $55M); one-off scan of the qa plans: no stored amount >= 1e9, no date < 1900 |
| Return now never saves forms whose last control is a choice or tick box | intended (the person critic's "done only when nothing is left"); the Save button saves; `B7.mjs` |
| Steady scrolls when the person is scrolling | it only runs in the same task as the kit's own drawing, after a click or a key; D-SCROLL-KEPT |
| An Undo puts back another device's later change | `takeBack` keeps changed-since values; `tests/ui-undo.test.mjs` (another tab's save before the tap) |
| A page draws its Undo line with a timer and it vanishes | CONVENTIONS recipe: no timer; place's remove-shim also stops page timers |
| openUnder used during render scrolls the page | reveal does nothing for an element not on the page; recipe says call it from the tap |
| The sweep cannot see the fix (it reads the browser's sentence) | ask in M13 (strict D-WRONG) |
| Two copies of dom.js install listeners twice | one install flag on `document` |

| Return in a box in no form takes over a page's own Enter | bubble phase + `e.defaultPrevented`; the two such handlers on the tip (Ask, the ledger's search) call `preventDefault()`; search boxes skipped; sweep D-ENTER 0 breaks, D-FOCUS-KEPT 0 |

Touch sweep: 34 breaks today -> 21 with the final kit on the same 8 pages, no rule worse anywhere; D-ENTER 2 -> 0, D-WRONG
13 -> 2 (and those 2 are words the sweep cannot read yet), the rest unchanged and owned by pages or place (M13 table).

---

## 5. iPhone Safari

Where it differs from Chromium for these mechanisms, and what the owner checks on the phone (sandbox, `?sandbox=1`):
- **H1 `invalid` and its cancel.** WebKit fires a cancelable `invalid` per box and blocks the submit when any box is invalid
  even if every event is cancelled (`validateInteractively`), since Safari 10.1. Check: Goals, "+ Add another goal", Add goal
  with nothing typed: no grey bubble; red "Fill this in first." under "What are you saving for", its name under the top bar.
- **H2 the keyboard from a focus.** iOS raises the keyboard for `focus()` only inside a user gesture; the kit focuses inside
  the `invalid` event of the tap's click, so it should come up. Same check: the keyboard is up with the cursor in the box.
- **H3 Return.** The number pad has no return key (its bar has ‹ › and Done, which already move between boxes); M7 is for the
  letter keyboard and Android. Check: Contacts, Add someone, type a name: the key says "next" and moves on; nothing is added.
  Money boxes use the decimal pad, which has no return key either, so the formless Return (Pay off debts) is for Android and a
  computer keyboard; on the iPhone, Done on the pad's bar leaves the box and B2's words come.
- **H4 `badInput`.** If WebKit reads "12..5" in a number box as empty, the words are "Fill this in first." on a required box.
  Check: Income, "+ Add another income", 12..5 in "Yearly raise", Add income.
- **H5 date wheels** ignore min/max while turning; the words come at Save.
- **H6 pointer events and the hold.** Safari fires `pointerdown`/`pointerup` then the mouse events and `click`; the hold ends at
  the click. Check: Income, 150 in "Yearly raise", tap "Starts": the cursor goes to Starts, the words appear under the raise.
- **H7 the keyboard and `reveal`.** `visualViewport` is what is above the keyboard. Check: Home, 1900 in "Year you bought it",
  press return in that box: the message and Save show above the keyboard.
- **H8 the Undo line.** Withdrawal page (after the page adopts it): "Plan on ...", then Undo: the figure is back and the line
  says so; nothing covers the menu.
- **H9 Net worth (after adoption):** Edit on the lowest account: the form's first box is above the keyboard edge; Cancel: the
  focus is on that Edit.

---

## 6. Build steps (each checked alone; details in steps.json)

1. Words and drawing, no listeners: `wordsFor`, `stepOf`, `FLOOR_DATE`, `showError`/`clearError`, `steady`, `reveal`, `spanOf`,
   `bringTo`, `fieldError`, `check`; base.css form selectors; `tests/ui-words.test.mjs`.
2. The engine: install-once listeners at import with the DOC guard (`invalid`, the checkValidity wrapper, the finger-down hold,
   `input`/`change` clearing, leaving words with steady); the count line with recount. Acceptance B1, B2, B4, B14, B17.
3. `ui.form`/`moneyBox` attributes (M5) and the submit wrapper (M3: page errors above the buttons, resetAfter kept, the
   stand-in-document path). Acceptance B3, B5, B6, B16.
4. Return keys in `ui.form`, Return in boxes in no form (bubble phase, `defaultPrevented` respected), and the 1 s submit guard
   (M7). Acceptance B7, B18; sweep D-ENTER 0 on the 9 pages.
5. Opener (M8): keyboard open, Cancel return by node or `data-key`, `opts.opener`. Acceptance B8, B9.
6. `core/ui/undo.js` + `ui.undoable`, `ui.undoneWords`, `ui.notice(kind, text, { undo, undone, action })`, `role="alert"`,
   notice CSS, reduced-motion line. `tests/ui-undo.test.mjs`. Acceptance B11 on the fixture.
7. `ui.openUnder` + `.rec-form` CSS; `qa/fixtures/kit-forms.html` + `.js` (a list with Edit-under-row and an add form, a
   one-tap Undo, a Work-it-out card, on a stand-in store with core/store.js's update order and a 50 ms redraw). Acceptance B10,
   B11, B13 on the fixture.
8. docs/CONVENTIONS.md "Answers in forms" + the `ctx.ui` row; CHANGELOG line; TEAM claim row names the new files; remove the
   evidence-only `?forms=off` switch if it was carried over. Then hand the seams (M12) to the place and taps builders and the
   three sweep asks (M13) to the sweep's owner.

---

## 7. Design log and lanes

Owner decisions relied on and not undone:
- 2026-09-15 Settings round 6 Finding 4 and AGENTS.md: "every save/add/remove confirms with a green notice; errors are red and
  say what to do next". The Undo lives inside the page's own green notice (the first design's bottom bar replaced it: dropped).
  Errors stay `.notice.error` red and say what to type.
- 2026-09-16 Pass 3 round 3: Categorize's in-page green line "Kroger Dayton filed under Groceries (2 transactions)." stays; the
  Undo is added inside it.
- 2026-11-06 "One path": "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own
  buttons)". This design adds nothing fixed (the first design's `.undo-bar` is gone).
- 2026-09-15 Debts round 14 Finding 1: "the form opens inside the list card". `openUnder` makes it the pattern.
- 2026-09-15 Net worth round 4 Finding 3: first visit with no accounts keeps the form open; Edit opens it filled in; Cancel
  folds it. Kept. Pass 2 round 4: Edit and Delete stay on the rows. Kept.
- 2026-09-16 Pass 4 round 2: an inline link became an outlined button. B15's rule extends it.
- 2026-09-16 Pass 4 round 1 Finding 4: "the one just saved stays open". B13 keeps the figures open after Work it out.
- 2026-09-16 Pass 2 round 8 Finding 3: "disabled buttons look disabled". Save is never disabled for a wrong box.
- 2026-11-06 household's view: no build, PC, AI or sync words. None of the kit's sentences has any: `tests/ui-words.test.mjs`
  reads every quoted sentence in dom.js and refuses PC, server, AI, sync, build, browser, valid/invalid, input, field, value,
  required, error (7 of 7 pass on the evidence copy).

Choices made where the owner was not asked (the conservative option each time): empty boxes say nothing until Save; removes
keep asking first; Undo is for one-tap changes and lasts until the next change or leaving the page; a touch never pops the
keyboard by itself; scrolling to a wrong box is instant; money below a billion, dates from 1900; Return never saves while a
control is left after the box.

Lanes: `core/ui/dom.js`, `core/ui/undo.js` (new), `core/ui/base.css` (form, notice, fold reduced-motion), `docs/CONVENTIONS.md`,
`tests/ui-undo.test.mjs`, `tests/ui-words.test.mjs`, `qa/fixtures/kit-forms.html` and `.js` (new; a test page, never linked),
CHANGELOG.md, the TEAM claim row (to name the new files: scope critic 11). No `view.js` (the TEAM claim says "no view.js in
this wave"); no claude-a page; nothing in `overview/setup/compute.js`, `retirement/projection/compute.js` or the estimators;
Get started's `novalidate` form is left alone by every listener.

---

## 8. Coverage (55 findings): kit alone / page edit still open (owner) / closed on the branch

"Kit" = what wave 1 does with no page edit. "Open" = a section 3 row. "Branch" = closed by a wave-2 builder before d22b718.

| finding | kit alone (wave 1) | page edit still open | closed on the branch |
|---|---|---|---|
| j-fat-fingers/FF1 | B3 (M3: message above the buttons, one copy, no timer, buttons still) | optional `fieldError` (g, h; documents: a) | - |
| p-debt-property/DP-2 | B1 words on the required boxes; B3 for home's year | optional `fieldError` | required boxes (g) |
| p-debt-property/x-2 | B1 words | - | required cost/price (g) |
| p-insurance-estate/IE-2 | B6 ceiling | - | required amounts, Health's check (h) |
| p-investments/x-2 | B3 | optional `fieldError` (h) | - |
| j-debt-fixer/D2 | B4 (our words instead of the bubble) | - | held by `reportValidity` (g) |
| j-fat-fingers/FF5 | B1 | - | - |
| j-heavy-waiting/W6 | B5 | drop coarse steps (h, e) | Goal seek money box (e), Vehicles (g) |
| p-career-household-system/F3 | B1, B2, count line | - | - |
| p-debt-property/DP-4 | B4 | - | held (g) |
| p-insurance-estate/IE-4 | B1 words | LTC label (h) | - |
| p-investments/INV-3 | B1 | - | - |
| p-retirement-c-scenarios/RC-1 | - | - | e |
| p-retirement-c-scenarios/RC-4 | B1 words | - | e |
| p-retirement-c-scenarios/RC-2 | B1 words | - | e |
| p-career-household-system/F7 | B16 types | (Contacts may switch to the kit's types) | g |
| p-cashflow-a/CF-7 | B1, B5 | - | - |
| p-investments/INV-10 | B6 date floor | - | h |
| p-retirement-a/R-A10 | B6 ceiling | - | e (Social Security), f80661e (contributions); projection has its ceiling |
| p-taxes/T6 | B1, B2 | - | - |
| p-transactions-helpers/T7 | - | - | d |
| p-career-household-system/x-2 | B7 | - | - |
| p-insurance-estate/x-2 | B7 | - | - |
| j-first-freelancer/F6 | B7 (Android); iPhone pad has no return key (H3) | - | - |
| p-taxes/T2 | B7 | - | - |
| p-transactions-helpers/T9 | B9 Cancel where the row is still drawn | `openUnder` (d) | - |
| j-keyboard-reader/K4 | B8, B9; after-save focus = place N1 | `openUnder` on list pages | - |
| p-balance/B3 | B9 Cancel | `openUnder` (g) | - |
| p-investments/INV-5 | B9 | - | h |
| p-transactions-helpers/x-halfform | (openUnder's own holder keeps it closed on every page that adopts) | - | d |
| p-cashflow-b-goals/F3 | - | - | g (asks first, Hidden list) |
| p-investments/INV-2 | - | - | h |
| p-cashflow-b-goals/x-4 | - | - | g |
| p-retirement-b/x-3 | `ui.undoable` (measured) | withdrawal-strategy (e) | - |
| p-taxes/x-4 | - | taxes/documents `ui.confirm` (a) | capital gains (h) |
| p-transactions-helpers/T11 | `ui.undoable` | categorize (d) | - |
| p-transactions-helpers/x-duplicates | `ui.undoable` | duplicates (d) | confirmation added (d) |
| j-first-retiree/R4 | - | - | rmd button (f80661e), "Put it back" (e) |
| p-balance/x-4 | - | - | g |
| j-keyboard-reader/x-redraw-on-change | B14 hold; keyboard half = place's focus restore | - | mortgage (g), capital gains, brackets (h) |
| p-debt-property/x-1 | B14 | - | g |
| p-taxes/x-3 | B14 | - | h |
| j-one-answer/A1 | - | - | g (house), h (federal) |
| p-debt-property/DP-1 | `ui.reveal`, G1 | B13 recipe (g); place's clamp hold | - |
| p-cashflow-b-goals/F6 | `ui.reveal` | rent-vs-buy, renovation (g); vehicle, charitable (a) | house (g) |
| p-investments/INV-7 | - | - | h |
| p-retirement-c-scenarios/RC-11 | `ui.reveal`, G1 | advisor-plan, compare, annuities (e) | - |
| p-cashflow-a/x-3 | - | - | g |
| p-retirement-a/R-A9 | rule (B15) | - | e (f80661e) |
| j-fat-fingers/FF8 | rule | - | g, e |
| p-balance/B8 | rule | - | g |
| p-career-household-system/F8 | rule | - | g |
| p-overview-home/OV-5 | rule | - | f |
| p-retirement-b/RB3 | rule | - | e (f80661e) |
| p-retirement-c-scenarios/RC-10 | rule | - | e |

Summary: closed by the kit alone, 16 (FF1, DP-2's message, x-2 inv, D2's words, FF5, F3, DP-4's words, IE-4's words, INV-3, CF-7,
T6, career x-2, IE x-2, T2, F6 Android, W6's step); in part by the kit, waiting for one page edit, 9 (T9, K4, B3, x-3, T11,
x-duplicates, DP-1, F6, RC-11); closed on the branch by page edits, 30; claude-a handoff, 3 rows. Declined: none of the 55; the
first design's claim "None declined" is replaced by this table.

---

## 9. Answers to the critics

### Blocking items

**Break 1 / Person 2: one Undo took back minutes of separate taps (the bar joined every change while it was up).** Changed. No
joining at all: each `undoable` returns its own `undo()` for exactly that change, drawn in that change's green line; the next
change's line replaces it and the earlier change is final. Two taps from one bounce are the taps guard's job (G5 for Enter).
Memory: only the change list is kept, not two plans. Evidence: `out/undo-edit.log` (a second "Plan on" then "Use this one":
the first change stayed), `tests/ui-undo.test.mjs` "two separate taps are two Undos".

**Break 2: the Undo bar covered the open menu and took its taps.** Changed: there is no fixed note. The Undo is inside the page
(`#content`), under the drawer and its scrim. Evidence: `elementFromPoint` at 300/500/700 px with the menu open over the line:
"menu" three times; no fixed element on screen (`out/undo-edit.log`).

**Break 3: the opener's "twin" by words picked the wrong row (Net worth after a save; Contacts' twin rows).** Changed: never
guess. The opener is the same node, or the single control with the same words inside the single element with the same
`data-key`; else nothing. P1 (centre the twin after a save) is dropped. Evidence: `out/edit.log` "twins" (Contacts, two
rows that read the same, Cancel after the page redrew): today and final both stay at 408 with the focus on nothing, where the
first design's word guess moved to the other row; Net worth with `openUnder`: Cancel puts the focus on the row's own Edit
(today: on nothing), and after Save the edited row is on screen (247; today 252, kept by the shell) with "Ana's 401(k)
saved." in view.

**Break 4: `openUnder(row, formHost)` moved the shared host, so a half-typed add form was still thrown away.** Changed:
`openUnder(row, build)` makes the edit form's own holder and leaves the page's add host alone. Evidence: Net worth, "+ Add
another account", "Credit union savings" typed, Edit on another row: the add form still holds it (`addTypingKept`).

**Break 5: "installed on the first ui.form() call" left pages without a ui.form unanswered.** Changed: installed at import,
behind the real-document guard (as the prototype measured). Evidence: Update my balances opened directly (renterDebt): our words
at the box, cursor in it, label shown (`engine-new: update-direct`).

**Person 1 / Scope 3: the fixed 10 s bottom bar replaced the page's own green line and was a second bottom-note system.**
Changed: the bar, `ui.toast`, the joining, the timers, `.undo-bar ~ .save-echo` and P3/P8 are dropped. The Undo is a button in
the page's own `ui.notice("ok", ...)` (`{ undo, undone }`), drawn through the page's `pending` where the change happened, kept
until the next change or leaving the page (no timer), and the place track's echo carries that one button when the line is off
screen (G3). The pure part (`changesOf`/`takeBack`) stays; People's and Update my balances' whole-plan Undo are listed for
migration (section 3). Evidence: withdrawal page, line in view, still there at 12 s, Undo restores 7,000.

**Person 3: `openUnder` opened the form below the screen when the row was in the thumb's half.** Changed: after building, the
kit reveals the span from the row to the first control's field with the least scroll. Evidence (`out/enter.log`
"edit-first"): row at 700: today 0 px and the first box at 832-900 (under the edge); final scrolls 64 px, row at 624, first box
768-836 on screen; row at 730: 94 px, same; row at 380: 0 px (already on screen).

**Scope 1: the design was scoped on a base the branch has left; section 3 would overwrite others' work.** Changed: re-based on
d22b718 (`core/ui` and `core/app.js` unchanged since c385e41, so the kit lands as designed); section 3 lists only what is still
open there, each with its lane, and drops every row a wave-2 builder already closed (subscriptions/recurring, prioritizer,
liquidity, contacts' types, the five IE-2 pages, goal-seek's money box, the confirms, the TARGET rows). The first adopters are
in released lanes (claude-d, claude-e) and Net worth waits for claude-g's claim. Evidence: section 8's "branch" column with the
builder per finding; greps on d22b718 for the still-open ones (duplicates and categorize have no Undo; withdrawal's "Plan on"
removes its line after 4 s; LTC's label unchanged).

**Scope 2: the engine rested on premises the tip no longer holds (5 `checkValidity` callers, 10 `reportValidity` callers, Goal
seek now `novalidate`).** Re-measured on d22b718 and changed: `checkValidity()` is kept silent by a wrapper (platform meaning),
`reportValidity()` speaks our words everywhere, including boxes in no form, and nothing is drawn while a finger is down. The
A-versus-B decision was taken again on the tip: B (novalidate) reaches only `ui.form` and leaves the ten wave-2 `reportValidity`
callers on the grey bubble; the browser engine with the wrapper reaches all of them. Evidence: `out/engine-new.log`
silent-input-check (cursor kept, "50" whole; the first design lost the "0"), silent-click-check, payoff-junk-typing,
mortgage-junk-next, report-on-change (today the tap is lost and "Roof" lands in the wrong box; final lands),
cc-months-empty and payoff-junk-save (formless, our words). The CONVENTIONS rule is kept as guidance; the wrapper makes it safe
without a page change or a check in `npm run check`.

**Scope 4: hand-offs between tracks had no owner.** Changed: M12 is the table (seven things forms gives, six it needs, each with
its exact interface), taps' three items are taken (G5-G7), claude-g's `more: true` fold is declined with the reason, P1 is
dropped (the Save half is kept by the shell's keepScroll where the page redraws in place, measured on Net worth, and by
`openUnder` adoption elsewhere; section 8 says which stay open), and place's `place.isDirty` is not needed (openUnder no
longer decides by dirtiness; the page closes the holder and place keeps the typing).

**Scope 5: "None declined" while 32 of 55 got no behaviour from this track.** Changed: section 8 has three columns (kit alone,
page edit still open with its owner, closed on the branch with the builder) and a summary count; the WORKBOARD message in
section 3 tells each waiting builder the helper and the line to write.

### Should-fix items

Taken:
- Break 6, Person should-fix 3 (Return skipped choice lists; "done" before the form was done): M7 goes to the next control of any
  kind and says "done" only when nothing follows. Evidence: Gifting to -> amount -> year -> From, nothing saved (today saved
  "Gift to Sam added."); Income name -> "Kind of income".
- Break 7 (leaving words pushed the focused box under the keyboard): `steady`. Evidence: Tab from "Yearly raise": Starts 470 ->
  470 with the words drawn above it; a tap: 649 -> 650.
- Break 8 (`reveal` ignored the keyboard): `visualViewport` (phone check H7).
- Break 9 (late answers vs the place hold): `planner:reveal` (G1, N2).
- Break 10 (`before` older than another tab's save): `before` taken inside the update callback; node test.
- Break 11 (a no-op tap got an Undo): `undoable` returns null when `changesOf` is empty; node test.
- Break 12 (notes overlapping): moot, no bar.
- Break 13 (the opener is the click that built the form): `ui.form(..., { opener })` and the `data-key` lookup.
- Person should-fix 1 (stale count line): recounted on every cleared box, removed below 2. Evidence `out/misc.log`.
- Person should-fix 2 (a page's refusal pushed the button from under the thumb): `steady` on the buttons. Evidence: Save 751 -> 751.
- Person should-fix 4 (money words without $, coarse step words): money words carry the sign; `ui.form` never sets a coarse
  step; a hand-built coarse step reads "Round it to the nearest 1000, like 12000."; the coarse steps left on three pages are in
  section 3. W6 and RC-4 are counted as closed by their pages, not by wave 1.
- Person should-fix 5 (B13 must say no timer): in the recipe.
- Person should-fix 6 (Undo words): the page names the thing ("Back to $7,000 a month, as before."); the kit only adds "What
  you changed after that was left as it is." for the rare partial case.
- Person should-fix 7 (focus after Undo): asked of place (N1); measured today: focus on nothing.
- Person should-fix 8 (ceiling sentence): "That is more than a billion: check for an extra digit."
- Person should-fix 9 (confirmation beside the row after Save): in the openUnder recipe (the page draws its line in the row's
  card); measured: the confirmation is in view after Save on Net worth.
- Scope 6 (build order): words, engine and the helpers pages call first (steps 1-3), `undo.js` lands with `undoable` (step 6).
- Scope 7 (steps 8-9 not checkable alone without a view.js): a test page under `qa/fixtures/` and node tests check them.
- Scope 8 (sweep evidence narrower than claimed): run with real touch on 8 pages (9 on the final run) x 2 households x 8
  rules including D-SCROLL-KEPT, D-KEYBOARD-UP and T-COVERED, today and final: 34 -> 21 breaks, no rule worse; D-ENTER 2 -> 0
  after the run showed "Enter does nothing" on Pay off debts' what-if box (the design changed: M7's formless Return);
  D-WRONG 13 -> 2, the 2 being words the sweep cannot read. The strict D-WRONG and the overwrite D-UNDO are asked of the
  sweep's owner (M13).
- Scope 9 (M3 removes page nodes by timing): `data-moved="kit"` and the skip rule (G2).
- Scope 10 (one word, two meanings): N6.
- Scope 11 (files and claims): section 7 lists every file; the TEAM row must name them.
- Scope 12 (M2b the riskiest piece): kept, now with the finger-down hold and `steady`, and measured with the sweep's
  D-FOCUS-KEPT, D-SCROLL-KEPT and D-KEYBOARD-UP on.

Declined:
- Scope 2's "fail `npm run check` on `.checkValidity(` in views": not needed once `checkValidity` keeps its platform meaning; a
  check would push five pages in other lanes to change working code.
- Person 1's "no echo for Undo": the place track's echo carrying the line's one button (G3) is kept, so an Undo line drawn above
  the screen is still reachable.
- Claude-g's kit-wide `more: true` fold: outside these seven causes (M12); named as the later answer to D-KEYBOARD-UP.
- The inline-link padding CSS some page findings asked for: the owner already ruled for outlined buttons (Pass 4 round 2), so
  B15 stays a rule and no link CSS is added.
