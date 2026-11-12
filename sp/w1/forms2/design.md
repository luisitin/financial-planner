# Wave 1, track forms2: form controls and answers (second, independent design)

Branch `claude/creative-build-b531q0`, tip c385e41. Prototype worktree: `w1/forms2/proto` (detached at 6fc5299; c385e41 only adds three
docs lines, nothing under `core/` or `modules/`). Every figure below was measured on that prototype served on 127.0.0.1:9371, phone
390 x 844, touch, sandbox, with real finger drags (CDP touchStart/touchMove/touchEnd, the screen moved by the swipe itself) and real
taps (touchscreen.tap at the control's centre, never Playwright's click that scrolls first), 450 ms between actions, typing at 70 ms a
key. The prototype carries a switch for measuring only (`?forms=off` = today's kit, `a` = this design, `b` = the alternative where the
kit takes validation over); the switch, `data-kit`, `data-forms` and `window.__undoMs` are prototype-only and are not part of the design.

Scripts and results (all in `w1/forms2/`): `lib.mjs` (helpers), `m-err.mjs` (held Save, 11 cases x 3 kits), `m-enter.mjs`, `m-edit.mjs`,
`m-undo.mjs`, `m-result.mjs`, `m-loose.mjs`, `m-reach.mjs` (every page x 3 households), `bench-undo.mjs`; `results/*.json|log`,
`shots/*.png`. The touch sweep of the other agent (`wtouch/qa/touch-*`) was copied into the proto (untracked) and run with and without
the kit: `results/sweep-off.*`, `results/sweep-a.*`.

The bias I was asked to start from held up: **keep the browser's own constraint validation as the engine and change only how and
where it speaks**. It reaches every form in the app, hand-built ones included, with about 15 lines that differ from the "kit takes
over" design; the rest of what the kit adds is the same in both. Section 2.1 has the comparison.

---

## 1. Behavior, in a person's words (the acceptance test)

**B1. A Save or Add that cannot go through says why at the box, where I am looking.**
I tap Save with a box empty or wrong. The screen brings that box up under the top bar with its name showing, the cursor is in it
(the keyboard comes up), the box has a red edge, and right under it a red line says what to type in plain words: "Fill this in
first.", "Type an amount first.", "Use a number from 0% to 100%.", "Use 5% or less.", "Type a number, like 12.", "Pick a date that is
not in the future.", "Use 1000 or 2000: this box goes up in steps of 1000." No grey bubble from the browser. The red line stays until
the box is right and goes the moment it is. When more than one box is wrong, a red line right above the buttons says "2 boxes need a
fix: What are you saving for, Amount needed." Nothing I typed is lost.
Closes j-fat-fingers/FF5, p-career-household-system/F3, p-insurance-estate/IE-4 (the words; the label rename is section 3),
p-investments/INV-3, p-cashflow-a/CF-7, p-taxes/T6 (the Save half), j-heavy-waiting/W6 (the words; Goal seek's box is section 3),
p-retirement-c-scenarios/RC-4 (the words, until the page takes a money box).

**B2. Leaving a box I typed wrong says so as soon as my tap has landed, and the tap is not lost.**
I type 12..5 in a money box or 40 in "Value grows each year" (limit 15) and tap the next box or Save: the next box takes the cursor
(or Save does its job), and then the red line appears under the box I left. An empty box says nothing until I tap Save.
Closes p-taxes/T6 (the leaving half), p-career-household-system/F3 (the leaving half).

**B3. When the page itself refuses, its message is right above the button I tapped.**
A page's own check ("Type what the car is worth today.", "Type the year as four digits from 1950 on...") appears directly above the
form's buttons, with the buttons still on screen; one message, not a stack; it stays until my next try (it no longer vanishes after
6 seconds). Pages that name the box (section 3) put the words at the box instead, as in B1.
Closes j-fat-fingers/FF1, p-debt-property/DP-2, p-investments/x-2 (the message is seen; pointing at the box is section 3).

**B4. Every form speaks the same way, including the few that pages built by hand.**
Goal seek's "Or leave at least", Update my balances and the Emergency fund's form answer exactly as in B1 (the app's words at the
box, the cursor in it), with no change to those pages. Boxes that are not in a form at all (Pay off debts' extra, Credit cards' 0%
months and fee) answer the same way once their button asks the kit first (section 3, one line each).
Closes the words half of j-heavy-waiting/W6 and p-retirement-c-scenarios/RC-4; p-taxes/T6 on Update my balances; with section 3,
j-debt-fixer/D2 and p-debt-property/DP-4.

**B5. A real figure is taken as typed.**
11,200 miles, a 40-month loan, 17 years, a raise of 2.555% are accepted; a box asks for a whole number only where a whole number is
meant ("Use a whole number, like 12."). No box answers with "the two nearest valid values".
Closes the Vehicles half of j-heavy-waiting/W6 and the 2.555 case of p-cashflow-a/CF-7.

**B6. Impossible figures are stopped at the box.**
An amount of a billion or more ("Use 1,000,000,000 or less."), a date before 1900 (a year typed as 0026) are refused with words at
the box, on every money box and every date box. A page that knows a tighter limit says so the same way ("Pick a date that is not in
the future.", "Use 10,000 or less." for a monthly Social Security amount).
Closes the ceiling part of p-insurance-estate/IE-2 and p-retirement-a/R-A10's billion-sized slips; the dates of p-investments/INV-10
and the tighter limits are section 3.

**B7. The keyboard's return key goes to the next box; only the last box saves.**
In any box but the last, the key reads "next" and takes me to the next box; nothing is saved and nothing closes. In the last box it
reads "done" and saves (and if a box above is empty or wrong, B1 takes me there).
Closes p-career-household-system/x-2, p-insurance-estate/x-2, p-taxes/T2, j-first-freelancer/F6 (Android's number pad; an iPhone's
pad has no return key).

**B8. Opened with the keyboard, a form has the cursor in its first box.**
Enter or Space on "+ Add another income" opens the form with the cursor in "What is it", so what I type lands there. A tap with a
finger opens the form and leaves the keyboard down until I tap a box.
Closes j-keyboard-reader/K4 (the opening half).

**B9. Cancel takes me back to the row I came from.**
I tap a row (or its Edit), look at the form, tap Cancel: the screen comes back to that row, in the middle of the screen, and the
focus is on its Edit button (or on the row), not on nothing.
Closes the Cancel half of p-balance/B3, p-transactions-helpers/T9, p-investments/INV-5 and j-keyboard-reader/K4.

**B10. A row's form opens under the row (pages that adopt it, section 3).**
I tap a row: its form opens right under it and nothing scrolls. After Save the row is where my thumb was, showing its new figure,
and the confirmation is on screen. A half-typed "New transaction" form elsewhere on the page is left as it is.
Closes p-transactions-helpers/T9, p-balance/B3, p-investments/INV-5, p-transactions-helpers/x-halfform (with section 3).

**B11. A one-tap change can be taken back.**
I tap "Use these amounts", "Not a subscription", "Yes, count it as my emergency fund", "Plan on $6,600 a month", "Remove the copy" or
pick a category: a note at the bottom of the screen says what happened ("Monthly amounts set on 4 goals.") with an Undo button. For
10 seconds (longer while my finger or the focus is on it; it goes when I leave the page) Undo puts back exactly what that tap changed
and says so ("Your goals have their own amounts again."). If something was changed again since (another device), Undo leaves that
alone and says "Put back, except what was changed again since." Two quick taps that hid two rows are both put back by one Undo.
Closes, with section 3: p-cashflow-b-goals/F3, p-cashflow-b-goals/x-4, p-retirement-b/x-3, p-transactions-helpers/T11,
p-transactions-helpers/x-duplicates, j-first-retiree/R4 (the "no named way back" half), p-balance/x-4.

**B12. Every Remove asks first, naming what goes.**
"Remove BND and its 2 lots?", "Remove Index fund from this year's sales?", in the browser's own question box, as the 43 other removes
in the app already do. Closes, with section 3: p-investments/INV-2, p-taxes/x-4.

**B13. After Work it out, Compare or Save, the answer is on the screen.**
The screen shows the answer card just under the top bar with "Saved." inside it, and the figures stay open below it for the next
try. When the answer is already on screen nothing moves. Closes, with section 3 (and the shell rule in 2.12):
j-one-answer/A1, p-debt-property/DP-1, p-cashflow-b-goals/F6, p-retirement-c-scenarios/RC-11, p-cashflow-a/x-3, p-investments/INV-7.

**B14. A tap after typing in a what-if box lands.** I type an extra payment, tap the lump-sum box: it takes the cursor. I type a
gain, tap a chip: the chip lights. (Section 3 for the three pages; the keyboard half is the place track.)
Closes, with section 3: j-keyboard-reader/x-redraw-on-change, p-debt-property/x-1, p-taxes/x-3.

**B15. The way on is a 44 px button that says where it goes.** "Add the people", "Open my payoff plan", "Change it on People",
"Open Emergency fund ›". (Section 3; the kit only documents the rule.)
Closes, with section 3: p-retirement-a/R-A9, j-fat-fingers/FF8, p-balance/B8, p-career-household-system/F8, p-overview-home/OV-5,
p-retirement-b/RB3, p-retirement-c-scenarios/RC-10.

**B16. Phone and email boxes bring up the right keyboard.** Phone: the number pad; email: the @ keyboard, no capital first letter.
Closes p-career-household-system/F7 (the kit types; Contacts passes them, section 3).

---

## 2. Mechanisms

Eleven pieces, all in `core/ui/dom.js` (plus `core/ui/undo.js`, pure, and a dozen lines of `core/ui/base.css`). Nothing runs at
import: the listeners are installed on the first `ui.form()` / `ui.check()` call and only when `document.addEventListener` and
`document.documentElement` exist, so the view tests' stand-in document (`qa/fixtures/fake-dom.mjs`) sees exactly today's kit
(measured: with import-time listeners 73 view tests failed, e.g. `modules/balance/liabilities/module.test.mjs` 4 of 14; with the
guard 0).

### 2.1 M1. The browser's checks stay the engine; the kit only speaks (B1, B4)
- **Where.** One capture listener for `invalid` on `document` (dom.js, installed once). `invalid` does not bubble, so it must be
  capture. For a box in a form that is not `novalidate`: `preventDefault()` (no bubble), draw the words (2.2), and for the first box
  of the pass (a `setTimeout(0)` marks the pass: the browser fires the events in tree order inside one task, with microtasks between
  them, so a microtask cannot mark it) bring its label and box into view and put the cursor in it (2.4). On a `ui.form` with two or
  more boxes held, the count line above the buttons (2.3).
- **What it keeps.** Nothing between taps: each box's words live in one `<small class="help field-error">` under it, tied by
  `aria-describedby`, with `aria-invalid="true"` on the box. The words go on the next `input` that makes the box valid.
- **Fit.** A held Save makes no `store.update`, so no shell redraw follows: nothing to fight with `show()`, `keepScroll`, `renderSeq`
  or the place track. Forms marked `novalidate` (Get started, `modules/overview/setup/view.js:393`) are skipped: they check
  themselves. `mendBlockedForms` (core/app.js:420, the sandboxed single-file build) calls `form.reportValidity()`, which fires the
  same events, so it speaks the same words with no change. Pages that call `form.reportValidity()` themselves (balance/update,
  balance/liquidity) are reached the same way. The guide frame, the sync bar and the heal reload are untouched (the frame's own
  forms, if any, get the same words). A page that draws late or redraws itself is fine: the listener is on `document`.
- **Rule it adds (CONVENTIONS).** `el.checkValidity()` / `form.reportValidity()` now speak (words at the box, the cursor moves);
  a silent check reads `el.validity.valid`. (No page calls `checkValidity` today: grep.)
- **Alternative weighed: the kit takes validation over (`novalidate` on every `ui.form`, the kit's submit handler reads each box's
  `validity` and speaks).** Built as `?forms=b` in the prototype. The words, the drawing, the focus and the count line are the
  same code; the difference is who starts the check. Measured on 11 cases (results/err.log):

  | case (household) | today (off) | A: browser checks, kit speaks | B: kit checks |
  |---|---|---|---|
  | Goals, Add goal, nothing typed (family) | 2 grey bubbles "Please fill out this field.", label under the top bar, nothing left after | no bubble, words at both boxes, label shown, cursor in box 1, "2 boxes need a fix" above the buttons | same as A |
  | Debts, rate 500 (family) | bubble "Value must be less than or equal to 100.", label hidden | "Use a number from 0% to 100%.", label shown, cursor in box | same as A |
  | Income, raise 150 (blank plan) | bubble | words, cursor in the raise box | same as A |
  | Gifting, year 1999 (family) | bubble "Value must be greater than or equal to 2011." | "Use a number from 2011 to 2100." | same as A |
  | Home, value grows 40, tap next box (family) | nothing at all | words under the box, the next box has the cursor | same as A |
  | **Goal seek, 1250 (hand-built form)** | bubble "...two nearest valid values are 1000 and 2000." | words at the box, cursor in it | **bubble, as today** |
  | **Update my balances, 12..5 (renterDebt; form.reportValidity)** | bubble, label hidden | words at the box, label shown | **bubble, label hidden** |
  | Vehicles, miles 11,200 (family) | bubble "...11000 and 11500" | taken (2.5) | taken |

  Reach without a page edit (`m-reach.mjs`: 157 pages x family, blank, renterDebt = 471 page visits): 212 `ui.form` forms with 1,022
  boxes that carry a check (A and B both); **6 hand-built forms with 23 such boxes on 3 pages (balance/liquidity, balance/update,
  scenarios/goal-seek): A only**; 3 `novalidate` forms (Get started: neither, on purpose); 95 boxes outside any form, 17 with a
  limit, on 6 pages (debt/credit-cards, debt/mortgage, debt/payoff, retirement/social-security, taxes/brackets, taxes/capital-gains):
  neither (nothing refuses them; 2.6 `ui.check` is the one-line adoption where a button saves them).
  Size: the A-only code is 14 lines (the listener), the B-only code 10 lines (`novalidate` + `kitCheck`). B's one advantage is that
  it does not depend on how a browser dispatches `invalid` (iPhone check H1, section 5); A's is reach and one voice everywhere.
  **Chosen: A.** If H1 failed on the owner's phone, B is a 10-line switch inside `form()` and the rest stands.
- **Which pages' own hand-made checks each approach reaches without a page edit.** The checks pages wrote by hand fall in three kinds:
  (1) a red notice drawn inside a `ui.form` handler (22 sites, e.g. vehicles:99, rental:167, home:124/127, mortgage:76, crypto:133-134,
  employer-stock:124/142, contributions:306, taxes/documents:72, plus the `formError` helpers of career/equity:39 and
  cashflow/budget-percent:94): both A and B reach them through 2.3; (2) browser constraints on hand-built forms (goal-seek, balance/update,
  balance/liquidity): A only; (3) checks in plain-button handlers or silent `return`s (payoff:88, credit-cards:143, renovation:61,
  purchase:71, ai/reader:63, advisor-plan:77): neither; section 3.

### 2.2 M2. The words, from each box's own state (B1, B5, B6)
- **Where.** `wordsFor(el)` (dom.js), exported for tests. Order: the box's own custom message first (money boxes already set plain
  sentences: "Type an amount in numbers, like 4,500.", "Use 0 or more."), then `valueMissing` ("Fill this in first.", "Type an amount
  first.", "Choose one first.", "Pick a date first.", "Check this box to go on.", or the field's own `missing` words), `badInput`,
  `typeMismatch` (email), range ("Use a number from 0% to 100%.", "Use 5% or less.", dates: "Pick a date on or after January 1, 1900.",
  "Pick a date that is not in the future." when the limit is today), `stepMismatch` ("Use a whole number, like 12." / "Use 1000 or 2000:
  this box goes up in steps of 1000."), length, pattern (the box's `title`). Numbers under 10,000 are written without a comma (years).
  Percent boxes carry `data-kind="percent"` from `ui.form`, so their limits read with a %.
- **Fit.** The words never set `setCustomValidity` on boxes the kit did not build (a stale custom message would block a later Save
  after the page or the place track writes a value without an input event). So the browser's own `validationMessage` stays the
  browser's sentence; only what is on the screen is ours. The touch sweep reads `validationMessage` (see 2.13).
- **Alternative weighed:** keeping every box's `setCustomValidity` in step on each `input` (as `moneyBox` does), so the bubble itself
  would speak plainly if it ever showed. Lost: any value written without an `input` event (page code, the place track's typed-value
  restore) leaves a stale message that blocks the next Save with wrong words.

### 2.3 M3. The line above the buttons, and pages' own red notices brought there (B1 count, B3)
- **Where.** `ui.form`'s submit wrapper: it notes the `.notice.error` elements on the page before calling the page's handler; any
  that are new afterwards are removed and their text is drawn once, as `div.notice.error.form-error[role=alert]` right above
  `.form-actions`. Then the message and the buttons under it are brought on screen together (`reveal(span(message, buttons),
  "nearest")`). A new error also means "keep what was typed" (no `resetAfter`). The count line (M1) uses the same slot; each try
  clears it first.
- **Keeps.** The line until the next try. The page's original node is gone, so home's and mortgage's 6-second timers remove nothing.
- **Fit.** Same task as the tap, no store update, no redraw. If the page redrew itself inside its handler (the form is no longer on
  the page) the kit leaves its notice where the page put it.
- **Measured.** Vehicles "Add car" with only "Which car" typed: today the message is 234 px above the screen and a second tap stacks a
  second copy; with M3 it is above the button, in view, one copy, still there after 7 s. Home, year 1900: today 1,564 px above the
  screen and gone after 6 s; with M3 above Save, Save still on screen (first version put Save 20 px under the edge: fixed by
  revealing message and buttons together), still there after 7 s.
- **Alternative weighed:** asking every page to call a helper (`ui.formError`). Needed anyway to point at the box (2.6), but M3 makes
  the 24 existing sites right today with no page edit.

### 2.4 M4. `ui.reveal(el, { block })`: bring something into view only when it is not wholly on screen (B1, B3, B9, B13)
- **Where.** dom.js. If the element is wholly between the top bar and the bottom edge it does nothing (no jump for something you can
  see). Otherwise `start` puts its top 8 px under the top bar (a box with its label, an answer card), `center` mid-screen (a row),
  `nearest` scrolls the least (a message with its buttons). Instant, not smooth: a smooth scroll and the iPhone's own scroll to a
  focused box fight. The kit scrolls the `.field` (label and box), then focuses with `preventScroll`. For the browser's own scrolls
  (the iPhone's ‹ › keys between boxes) base.css adds `scroll-margin-top: 40px` on `.field` boxes, so the label shows (today the
  browser lands the box 12 px under the bar and its label behind it: measured hidden on Goals and Debts).
- **Fit.** Pages call it while drawing the redraw after their own save (B13); the shell already lets a page that scrolls itself
  while drawing win (core/app.js:248 `pageScrolled`). That rule must stay (2.12).
- **Measured.** goals/house, "Work it out" with 500,000 (family and empty plans): today the answer's heading ends 18 px above the screen
  and the figures fold shut; with the page adopting (keep the figures open, `ui.reveal(answerCard)`, "Saved." inside the card) the
  heading sits at 81 px, just under the top bar, "Saved." under it, the figures open below (shots/result-*.png).

### 2.5 M5. What `ui.form` and `ui.moneyBox` put on each box (B5, B6, B16)
- `number`/`percent`: `step="1"` when the field asks for a whole step of 1 or more (12 months, 500 miles, 5 years), `"any"` otherwise
  (percent's 0.01 refused 2.555). The page rounds if its maths needs to. Nothing else changes in `readForm`.
- `date`: `min` defaults to 1900-01-01 (a year typed 0026 is refused; today Debts "Started" and Goals "By when" save it without a word:
  touch sweep D-WRONG, 2 breaks today, 0 with the kit); `max: "today"` is a token for today's date.
- money: `moneyBox` defaults `max` to 1,000,000,000 when the caller gives none (also hand-built money boxes: Pay off debts' extra took
  99,999,999,999 today; "Use 1,000,000,000 or less." with the kit, m-loose.mjs).
- `tel` and `email` types: `type`, `inputmode`, `autocomplete`, and for email `autocapitalize="off"`, `spellcheck="false"`.
- `missing: "Type the amount of the gift."` on a field: the words for its empty box.
- **Alternative weighed:** a per-field `say: {low, high, missing}` object. Lost: the generic words read well in every case measured;
  one optional `missing` covers the case the generic words cannot (naming the figure).

### 2.6 M6. `ui.fieldError(box, text)` and `ui.check(boxes)`: the same answer for checks pages make themselves (B3, B4)
- `return ui.fieldError(yearBox, "Type the year as four digits from 1950 on, like 2019, or leave it blank.")` inside a `ui.form`
  handler: the words at that box, label and box into view, cursor in it, the form kept (it returns false). The words go when the box
  is next changed.
- `if (!ui.check([extraIn])) return;` before a plain button saves boxes that are in no form: each wrong box gets its words, the first
  gets the cursor, nothing is saved. Measured on debt/payoff (prototype adoption, renterDebt): 50.., -50 and 99,999,999,999 are no
  longer saved over the $50 (today: saved as $0, $0 and 99,999,999,999 under "Plan saved."); words at the box, cursor in it.

### 2.7 M7. Return: the key says next or done (B7)
- **Where.** `ui.form` only (hand-built forms keep their own behaviour; Get started already has next/done). Every one-line box
  (text, number, email, tel, date) that is shown (not in a closed fold) gets `enterkeyhint="next"`, the last one `"done"`, refreshed on
  `focusin` (folds change which one is last). `keydown` Enter in a box that is not the last: `preventDefault()` and focus the next
  shown box. In the last box nothing is intercepted: the browser's implicit submit runs, and with it M1.
- **Measured** (m-enter.mjs, family). Today Enter in the first box saved a half-filled form 4 times out of 4: "Gift to Sam added."
  ($0), "Dr Lee added." (no phone), "Dee added." (no birth date), HSA "Saved." (section shut). With M7: 4 of 4 moved to the next box
  ("Amount", "Firm or company", "Birth date", "Employer puts in"), nothing saved; Enter in the last box still saves.
- **Alternative weighed:** `enterkeyhint` only (the key says Next but still saves). Lost: the label would then lie.

### 2.8 M8. The form remembers what opened it (B8, B9, and the shell after a save)
- **Where.** One capture `click` listener on `document` notes the control just activated (a button, link, summary, row) and whether it
  came from the keyboard (`detail === 0`), and forgets it at the end of that task (`setTimeout(0)`). A `ui.form` built during that
  click (the page's handler draws it synchronously) records it as its opener; forms drawn later (the shell's redraw 50 ms after a
  store update, async pages) record none.
- **B8:** opened from the keyboard, the first shown box gets the cursor once the form is on the page; a touch open does nothing (the
  phone keyboard never pops up by itself). Measured (Goals, Income, keyboard): today focus on nothing and the typed "Side gig" lost;
  with M8 the cursor is in the first box and "Side gig" lands, 2 of 2.
- **B9:** the kit's Cancel runs the page's `onCancel`, then brings the opener (or, if the page redrew its list, the same control with
  the same words in the same row) to the middle of the screen when it is not on screen, and focuses it. Measured: Net worth, second
  account's Edit, Cancel: today the row is 655 px above the screen and focus on nothing; with M8 the row is mid-screen (top 395) with
  focus on its Edit. Expenses, Groceries, Cancel: today 412 px above, focus nothing; with M8 in view, focus on the row.
- **For the shell:** `ui.openerOf(form)` returns `{ tag, text, row }` (2.12, P1).
- **Alternative weighed:** having the kit itself move the form under the row or scroll after the shell's redraw (a MutationObserver
  on #content). Lost: the first fights the page's layout, the second fights the place track's scroll restore.

### 2.9 M9. `ui.openUnder(row, host)`: a row's form opens under the row (B10)
- **Where.** dom.js; pages call it instead of `formHost.scrollIntoView()`. It moves the form's holder right after the row (inside a
  `li.rec-form` in a list, a `tr > td[colspan]` in a table) and returns the function that puts it back (Cancel calls it; a save's
  redraw draws the page afresh anyway).
- **Measured** (Net worth adopted behind `?under=1`): opening scrolls 0 px (today 1,537 px); after Save the row is on screen (top 538,
  today 101 px above the screen) with its confirmation in view; after Cancel the row is on screen with focus on its Edit.
- **Alternative weighed:** remember the row and scroll back to it after Save/Cancel (B3's suggestion). Lost: still a screen-and-a-half
  jump to open, still a shared form that a stray tap swaps (x-halfform).

### 2.10 M10. `ui.undoable(store, change, { said, undone })` and `ui.toast(text, { action })` (B11)
- **Where.** dom.js, with the pure part in `core/ui/undo.js` (`changesOf(before, after)`, `takeBack(draft, changes)`, node tests in
  `tests/ui-undo.test.mjs`, 7 tests). `store.update()` works on a copy, so the plan before the change and the plan after it are two
  objects nobody changes again: `undoable` keeps the two and works out the difference only if Undo is tapped. Lists whose rows carry
  an `id` are compared row by row (a removed row remembers the row before it); other fields value by value; `meta` is skipped; the
  guesses ledger is just another section, so a removed account's guess entry comes back with it.
- **Undo** is one `store.update(d => takeBack(d, changes))`: it puts back only what still holds the value the change wrote, a removed row
  only if no row with its id is back, an added row only if unchanged since; the rest is counted and said ("Put back, except what was
  changed again since."). So an Undo never overwrites another device's or tab's later change, and `settle` runs on it like any update.
- **The note.** `div.undo-bar[role=status]` outside `#content` (it survives every redraw), bottom of the screen above the safe area,
  green edge like the shell's copy, text plus one outlined 44 px "Undo". It takes taps (the shell's copy does not). It leaves after
  10 s, re-armed while a finger is on it or the focus is in it; on `hashchange`; when the next note comes. A second `undoable` while
  the note is up joins it ("(2 changes)") and one Undo takes back both, last first. The note is that tap's confirmation: the page draws
  no green notice of its own for it.
- **Fit.** Outside `#content`, so the shell's redraw, `renderSeq` and the place track's typed-value memory never see it. The shell's
  copy (`.save-echo`, appended later) stacks above it by CSS (`.undo-bar ~ .save-echo { bottom: 92px }`) instead of covering it; the
  shell's `echo()` removes only `.save-echo`, so it never removes the Undo.
- **Measured** (m-undo.mjs, pages adopted in the prototype): goals/prioritizer "Use these amounts" (400, 300, 250, 0 became 1,189, 836,
  585, 673; Undo gave back 400, 300, 250, 0), balance/liquidity "Yes, count it as my emergency fund" (back to not counted),
  cashflow/subscriptions "Not a subscription" (Netflix back), two taps 250 ms apart (Netflix and Spotify hidden; one Undo put both
  back): the note in view 5 of 5, the plan exactly as before 5 of 5. Working out the changes: 0.5 to 0.8 ms on 7 to 12 KB plans,
  38 ms on an 889 KB plan with 5,152 bank lines (Chromium, this machine); in Node 33.5 ms on a 2 MB plan with 20,000 lines, about one
  `structuredClone` of the plan (31.7 ms), which `store.update` already pays on every save. Hence the lazy diff: nothing at the tap.
- **Alternatives weighed.** (a) Each page writes its own inverse (keep the old amounts, put them back): more code per page and easy to
  get half right (prioritizer, categorize's rule, duplicates' line). (b) Undo = `store.replace(before)`: throws away anything saved
  since (another device's change, the guesses `settle` moved) and skips `settle`. (c) `window.confirm` before every one-tap change:
  heavy for a category pick; kept for removes (B12), which is what the rest of the app does.

### 2.11 M11. CSS (core/ui/base.css, form and notice selectors only)
`.field-error` (red, 600), the red edge on `[aria-invalid="true"]` boxes, `.form-error` spanning the form grid, `scroll-margin-top`
on `.field` boxes, `li.rec-form`, `.undo-bar` (+ `.quiet`, reduced motion), `.undo-bar ~ .save-echo`.

### 2.12 What the kit needs from the shell (track "place"), and what they must not fight
- **P1 (save from a form far from its row).** After the `keepScroll` redraw that follows a submit of a `ui.form` that no longer exists,
  when neither the fresh notice nor the opener's twin is on screen: bring `ui.openerOf(form)`'s twin to the middle of the screen and
  focus it with `preventScroll`. (Pages that adopt `openUnder` do not need it; the 22 that have not yet do.) Measured need: Net worth
  Save without adoption leaves the row 101 px above the screen in both today's kit and A.
- **P2.** Keep "a page that scrolls itself while drawing wins" (`ui.reveal` during render, B13).
- **P3.** `echo()` must leave `.undo-bar` alone (it does today) and keep being appended after it (the CSS stacks it). Better, later:
  route `echo()` through `ui.toast()` so there is one bottom note.
- **P4 (DP-1).** When the kept position is clamped by a shorter page, go to this save's fresh notice (under the top bar) instead of
  the page's foot. Pages that put their "Saved." inside the revealed answer card (B13 recipe) are fine without it.
- **P5.** Focus restore after a redraw: leave the focus alone when it is outside `#content` (the Undo button) and never move it on
  events that are not a redraw (a held Save moves the cursor to the bad box on purpose; Cancel's return is a page-local redraw).
- **P6.** Restoring typed values: write `.value` without calling `checkValidity`/`reportValidity` (they would draw words and move the
  cursor). Dispatching `input` is harmless (the kit only clears words that became right).
- **P7.** A redraw while a form is held (sync, another tab) drops the red words; the next Save draws them again. Accepted.
- **P8.** The double-tap guard (track "taps", core/taps.js in its prototype) and `undoable` agree: two taps that land are two changes,
  and one Undo takes back both.

### 2.13 The touch check (wtouch qa/touch-rules.json): which rules these behaviours turn green
Run on six pages (estate/gifting, goals/goals, household/contacts, goals/prioritizer, property/vehicles, balance/liabilities), family,
rules D-WRONG, D-ENTER, D-UNDO, D-SEEN, D-FOCUS-KEPT: today 3 breaks (D-WRONG 2: a 0026 date saved without a word on Debts and Goals;
D-SEEN 1), with A 1 break (D-SEEN on Goals "Save changes": the saved row is off screen, P1). D-FOCUS-KEPT stays 41 of 41 with A,
which matters: the first version of M2b drew the leaving-a-box words synchronously and lost the tap (2.2b below).
- Turns green: **D-WRONG** (B1, B3, B6; plus section 3 for the silent `return`s and empty amounts), **D-UNDO** (B11/B12 with section 3),
  **D-SEEN** for undoable taps (the note is a `role=status` notice in view) and for B13 pages, **T-KEYBOARD** (B16 with Contacts).
- Stays green and must stay: **D-FOCUS-KEPT**, **D-SCROLL-KEPT** (the reveal is "the page scrolled there itself, to something then on
  the screen"), **D-ENTER**.
- Two changes I ask of the sweep: (1) its `said` is read in a capture listener that runs before the kit's, so with A it records the
  browser's sentence ("Please fill out this field.", "Value must be 01/01/1900 or later.") while the screen says "Fill this in
  first." / "Pick a date on or after January 1, 1900."; read the words from the box's `aria-describedby` element after the page
  settles (H-WORDS reads `said`). (2) D-ENTER counts "Enter saved a half-filled form" as fine; a stricter variant, "Enter in a box that
  is not the form's last one-line box does not save", is what the owner's findings ask and what M7 makes green (4 of 4).

### 2.2b A defect the prototype found: words drawn when a box is left moved the button from under the finger
The first version drew the leaving-a-box words in `focusout`. A tap on "Add income" right after typing 150 in "Yearly raise": the
browser fires `mousedown` (focus leaves the box, the words are inserted, the button moves down about 22 px), then `mouseup` lands on
the form's background, the click's target is the FORM, and Add income does nothing (0 `invalid` events, focus left on the button;
also on Gifting). Fixed by drawing those words after that tap's `click` (a `setTimeout(0)` from a capture `click` listener), or after
350 ms when the box was left without a click (Tab, the iPhone's ‹ › keys). After the fix the tap lands and the cursor goes to the bad
box, both cases. Rule for every helper in this track: **never change the layout between a pointer's down and its click.**

---

## 3. What a page must do (wave 2 adoption list)

Kept to what the kit cannot do. "claude-a" rows go to the claude-a handoff (their lane); the kit already improves those pages without
an edit (B1 to B9). Each change is one to five lines.

| page | change | finding |
|---|---|---|
| property/renovation, property/purchase | `required: true` on the cost / price field; drop the silent `return` (keep the 0 guard as `ui.fieldError`) | p-debt-property/x-2 |
| estate/gifting, estate/inheritance, estate/legacy, insurance/health, insurance/term-vs-permanent | `required: true` and `min` above 0 on the defining amount (`missing: "Type the amount of the gift."`); Health: `return ui.fieldError(oopMaxBox, "The most you would pay in a year cannot be lower than the deductible.")` | p-insurance-estate/IE-2 |
| retirement/annuities, retirement/pensions | `required: true` on the amounts | p-retirement-c-scenarios/RC-2 |
| property/vehicles, property/rental | `required: true` on "What it is worth today" / worth and rent (the page check then never fires) | p-debt-property/DP-2, j-fat-fingers/FF1 |
| property/home, debt/mortgage | `return ui.fieldError(yearBox, ...)` instead of `root.prepend` + 6 s timer | j-fat-fingers/FF1, p-debt-property/DP-2 |
| investments/crypto, investments/employer-stock, retirement/contributions, cashflow/budget-percent, career/equity | `ui.fieldError(box, ...)` for the box named in the message (M3 already shows it by the button) | p-investments/x-2 |
| taxes/documents (claude-a) | same; and `ui.confirm` before Remove | j-fat-fingers/FF1, p-investments/INV-2, p-taxes/x-4 |
| debt/payoff | `if (!ui.check(extraIn)) return;` before Save plan; the preview reads an empty box as $0 | j-debt-fixer/D2, p-debt-property/DP-4 |
| debt/credit-cards | `if (!ui.check([monthsIn, feeIn])) return;`; drop `|| 15` | p-debt-property/DP-4, j-debt-fixer/D2 |
| scenarios/goal-seek | `ui.moneyBox({ min: 0, label: "Leave at least" })` read with `ui.moneyValue`; a lit "Leave $750,000" chip and a line under the box after Use this; name each lever's button ("Change it on People") | j-heavy-waiting/W6, p-retirement-c-scenarios/RC-4, RC-10 |
| scenarios/advisor-plan | no figures typed: `return ui.fieldError(firstBox, "Type at least one figure from their report...")`; plan not ready: the missing items as buttons, no form | p-retirement-c-scenarios/RC-1 |
| ai/reader | empty box: `ui.fieldError(box, "Paste the document's text in the box first.")` | p-transactions-helpers/T7 |
| household/contacts | `type: "tel"` and `type: "email"` | p-career-household-system/F7 |
| investments/employer-stock, investments/crypto, investments/tax-lots | `max: "today"` on purchase dates; tax lots: `ui.fieldError` when shares exceed the holding's | p-investments/INV-10 |
| retirement/projection (view.js only), retirement/contributions, retirement/social-security | `max` on spending (100,000 a month), a contribution (100,000), the monthly benefit (10,000, with `ui.check` on its plain box) | p-retirement-a/R-A10 |
| insurance/ltc | label "Prices where you live, compared with the country", help "100 = the national price" | p-insurance-estate/IE-4 |
| 22 list pages: transactions/ledger, transactions/categories, transactions/rules, cashflow/expenses, cashflow/income, cashflow/budget, balance/net-worth, balance/liabilities, household/people, goals/goals, insurance/policies, insurance/health, estate/inheritance, estate/digital, estate/legacy, estate/gifting, retirement/contributions, retirement/annuities, retirement/pensions, investments/holdings, taxes/capital-gains; goals/travel (claude-a) | `const back = ui.openUnder(row, formHost)` instead of `formHost.scrollIntoView()`; `back()` in `onCancel` | p-transactions-helpers/T9, p-balance/B3, p-investments/INV-5, p-transactions-helpers/x-halfform |
| cashflow/subscriptions, cashflow/recurring | `ui.undoable(store, ..., { said: "Netflix taken off this list (and off Bills)." })`; a quiet "Hidden: Netflix. Put back" row | p-cashflow-b-goals/F3 |
| goals/prioritizer | `ui.undoable`; the button gives way to "Your goals already use these amounts" when they match | p-cashflow-b-goals/x-4 |
| retirement/withdrawal-strategy | `ui.undoable` on "Plan on $6,600 a month" and "Use this one" (keep "Use this one" on its own line) | p-retirement-b/x-3, j-first-retiree/R4 |
| retirement/rmd | "I've taken it" outlined on a step of the path; "Not yet" reads "Undo: not taken yet" | j-first-retiree/R4 |
| transactions/categorize | `ui.undoable` for a single pick (it files, renames and writes the rule in one change, so one Undo takes all back) | p-transactions-helpers/T11 |
| transactions/duplicates | `ui.undoable` on "Remove the copy"; the empty state drawn after it | p-transactions-helpers/x-duplicates |
| balance/liquidity | `ui.undoable` on "Yes, count it as my emergency fund" | p-balance/x-4 |
| investments/holdings, investments/tax-lots, investments/employer-stock, retirement/contributions, taxes/capital-gains, career/business | `if (!ui.confirm("Remove BND and its 2 lots?")) return;` | p-investments/INV-2, p-taxes/x-4 |
| debt/mortgage, taxes/capital-gains, taxes/brackets | redraw only the results holder on change, not the boxes and chips | j-keyboard-reader/x-redraw-on-change, p-debt-property/x-1, p-taxes/x-3 |
| taxes/federal, goals/house, property/rent-vs-buy, property/renovation, property/home, scenarios/advisor-plan, scenarios/compare, retirement/annuities; goals/vehicle, goals/charitable (claude-a) | B13 recipe: a module-level `justSaved`; draw the figures fold open on that draw; put the "Saved." notice in the answer card and `ui.reveal(answerCard)`; Federal also names the new tax in the notice | j-one-answer/A1, p-cashflow-b-goals/F6, p-retirement-c-scenarios/RC-11, p-debt-property/DP-1 |
| property/rental, property/vehicles | after an add, `ui.reveal(newCard)` with its notice in it | p-debt-property/DP-1 |
| cashflow/paycheck | the notice names the result: "take-home is now $2,832 a paycheck (was $2,888)" | p-cashflow-a/x-3 |
| investments/backtest | one live result line under the chips; first chip "Your plan's mix (70% stocks)" | p-investments/INV-7 |
| retirement/social-security, retirement/contributions, retirement/monte-carlo, retirement/historical, retirement/rmd, retirement/roth-conversions, balance/liabilities, debt/mortgage, debt/ratios | inline `<a>` out of the sentence: `ui.row(ui.h("a", { class: "btn secondary", href }, "Add the people"))` (filled on an empty state) | p-retirement-a/R-A9, p-retirement-b/RB3, j-fat-fingers/FF8, p-balance/B8 |
| household/life-events, household/calendar, overview/next-best-action, overview/health-score | the link names its page from `ctx.modules.get(key).title` ("Open Emergency fund ›") | p-career-household-system/F8, p-overview-home/OV-5 |

---

## 4. Risks: what could be worse than today, and the check that catches it

| risk | check |
|---|---|
| A message drawn between a pointer's down and its click moves the button and the tap is lost (seen in the prototype, 2.2b) | `m-err.mjs a income-raise150,gifting-year,home-blur`: focus ends in the bad box / the next box; touch sweep D-FOCUS-KEPT 41/41 on the six pages |
| The kit's listeners run in the view tests' stand-in document and break 70+ view tests (seen) | `npm test` with 0 new failures; the kit installs nothing when `document.addEventListener` or `documentElement` is missing. Measured on the prototype after the guard: 189,120 tests, 2 failed: the wording test caught "Tick this to go on." (fixed: "Check this box to go on."; `tests/wording.test.mjs` 8 of 8) and the ledger's 1.5 s timing test took 1,714 ms under the full run's load (alone: 35 of 35) |
| A new sentence of the kit is not US English or not plain | `tests/wording.test.mjs` scans `core/ui/dom.js` like every view; `tests/ui-words.test.mjs` (step 2) pins every sentence |
| `checkValidity()` called by a page for a silent test now draws words and moves the cursor | `grep -rn "checkValidity" modules core` = 0 outside dom.js; CONVENTIONS says to read `validity.valid` |
| A page relied on the browser's own focus+bubble (a hand-built form whose checks are now cancelled but nobody focuses) | M1 focuses the first box of every pass; `m-err.mjs a goalseek-1250,update-junk`: cursor in the box, words in view |
| Safari does not block the submit when every `invalid` is cancelled, so a held form saves | iPhone check H1; spec and WebKit's `validateInteractively` both return false when any control is invalid; fallback: switch `ui.form` to B (10 lines) |
| Enter moves to a box hidden in a closed fold, or never saves a one-box form | `lineBoxes` skips boxes not shown; a form whose only shown box is the last saves; `m-enter.mjs` gifting-last saves |
| The step policy accepts a figure a page's maths cannot take (a 40-month loan, a 17-year refinance) | node test per page that had a coarse step: compute with 40 / 17 / 11,200 gives finite figures (consolidation, vehicle, renovation, vehicles, ltc) |
| The 1,000,000,000 money ceiling or the 1900 date floor refuses a real figure | `node qa/guess-sanity.mjs` and the qa plans: no stored amount at or above 1e9, no date before 1900 (one-off scan in the build step) |
| Undo puts back a change another device made since, or doubles a row | `tests/ui-undo.test.mjs` (changed-since fields kept, a row back only once, removed rows back in place); m-undo.mjs on three pages |
| Undo after a compute mutated the plan in place (the kept "after" object changed) | a dev check: in the sandbox, `Object.freeze` deep on the plan the store hands out, run `qa/smoke-all.mjs`; any page that writes into `ctx.plan` throws |
| The Undo note covers the page's own button at the bottom for 10 s | it re-arms only while touched; leaves on navigation; the touch sweep's T-COVERED with the note up on prioritizer (manual run) |
| Two bottom notes overlap (the guide frame's `.gb-toast`, the shell's copy, the Undo note) | screenshot after "Not a subscription" on a page opened from the guide path (`?guide=plan&step=...`) |
| Relocating a page's red notice removes an unrelated error (a failed import, an AI error) | only `.notice.error` created during the `ui.form` handler call are moved; `m-err.mjs a vehicles-addcar,home-year1900` and a manual Import failure |
| Cancel's return scrolls when the row is already on screen | `reveal` does nothing for an element wholly on screen; m-edit a+under: Cancel with the row in view moves 0 px when the swipe did not move it |

---

## 5. iPhone Safari

Where it differs from Chromium for these mechanisms:
- **`invalid` and its cancel.** WebKit fires `invalid` (cancelable, not bubbling) for each control and reports only the uncancelled
  ones, as Chromium does; it has blocked invalid submits since Safari 10.1. A document capture listener sees them. (H1)
- **The keyboard from a focus.** iOS raises the keyboard for `focus()` only inside a user gesture. The kit focuses the bad box inside
  the `invalid` event, which runs inside the tap's click (the submit's validation step), so it should come up; a focus deferred to a
  timer would not. (H2)
- **iOS scrolls a focused box itself** when the keyboard would cover it. The kit puts the field just under the top bar first, so iOS
  should have nothing to move; if it does, the label must still show. (H2)
- **Number pad.** `inputmode="decimal"` shows a pad with no return key; the bar above it has ‹ › and Done, which move between boxes
  natively (M7 is for text keyboards and Android). `enterkeyhint` labels the return key on text keyboards (iOS 13.4+). (H3)
- **`badInput` on a number box** ("12..5"): WebKit's number input reports it; if it reads the box as empty instead, the words are
  "Fill this in first." on a required box or nothing on an optional one. (H4)
- **Date wheels** ignore `min`/`max` while scrolling; the words come on Save. (H5)
- **`position: fixed` at the bottom** with the keyboard up: the note can sit behind the keyboard. The Undo note follows button taps,
  when the keyboard is normally down. (H6)
- **Mouse events after a touch** arrive after `touchend`; the kit draws leaving-a-box words only after the `click`, so the order does
  not matter.

For the owner to try on the phone (sandbox, `?sandbox=1`):
1. H1/H2: Goals, "+ Add another goal", tap Add goal with nothing typed. Expect: no grey bubble; red "Fill this in first." under "What
   are you saving for", its name visible under the top bar, the keyboard up with the cursor in it.
2. H3: Contacts, Add someone, type a name: the return key says "next" and moves to the next box; nothing is added. In the last box it
   says "done" and adds.
3. H4: Income, "+ Add another income", type 12..5 in "Yearly raise" and tap Add income: "Type a number, like 3.5 for 3.5%." under it.
4. Debts, tap a debt, type 500 in the rate, tap Save: "Use a number from 0% to 100%." under it, label showing.
5. H5: Goals, "By when": pick a date, then try Save with a year far in the past if the wheel allows it.
6. H6: Subscriptions (with bank lines): "Not a subscription": the note with Undo sits above the home bar in the home-screen app; Undo
   brings the row back.
7. Net worth: Edit on the second account, Cancel: back at that account, mid-screen.

---

## 6. Build steps (each one checked alone)

1. **`core/ui/undo.js` + `tests/ui-undo.test.mjs`** (pure). Check: `node --test tests/ui-undo.test.mjs` (7 pass), `npm run check`.
2. **Words and drawing, no listeners yet:** `wordsFor`, `showError`/`clearError`, `reveal`, `bringTo` in dom.js; base.css
   `.field-error`, `[aria-invalid]`, `.form-error`, `scroll-margin-top`. Node test `tests/ui-words.test.mjs` with plain objects standing in
   for boxes (validity flags, min, max, step, dataset) for every sentence. Check: `npm test` (the view tests see no change).
3. **The listeners, installed on first use with the real-DOM guard:** `invalid` (M1), the count line, the deferred leaving-a-box words
   (2.2b), `input` clearing. Check: `node m-err.mjs a` (0 bubbles in 11, label shown and cursor in the bad box in 8 of 8 box cases, words
   still there at 7 s), `node m-err.mjs a income-raise150,gifting-year` (the tap lands), `npm test`, the touch sweep's D-WRONG and
   D-FOCUS-KEPT on the six pages.
4. **`ui.form` / `ui.moneyBox` attributes (M5):** step policy, date `min` and `"today"`, money ceiling, `tel`/`email`, `missing`,
   `data-kind`. Check: `m-err.mjs a vehicles-miles` saves 11,200; D-WRONG 0026 dates; `m-loose.mjs` with the ceiling; the qa-plan scan
   in section 4; node tests on the coarse-step pages' computes.
5. **Page errors by the button and the two helpers (M3, M6):** submit wrapper, `fieldError`, `check`. Check: `m-err.mjs a
   vehicles-addcar,home-year1900` (in view, buttons on screen, one copy after two taps, there at 7 s); a node test that `resetAfter`
   does not reset when the handler drew an error.
6. **Return keys (M7).** Check: `m-enter.mjs off,a` (4 of 4 move on; the last box saves), D-ENTER.
7. **Opener (M8):** keyboard-open focus, Cancel return, `openerOf`. Check: `m-edit.mjs off,a` (Net worth and Expenses Cancel back on
   screen with focus; Goals and Income typed text lands).
8. **`ui.openUnder` (M9).** Check: adopt on Net worth first (wave 2's first page), `m-edit.mjs a+under` (0 px on open, row on screen after
   Save and Cancel).
9. **`ui.undoable` + `ui.toast` + CSS (M10).** Check: adopt on goals/prioritizer first, `m-undo.mjs prioritizer,prioritizer-big`,
   `bench-undo.mjs`, D-UNDO and D-SEEN on that page.
10. **`docs/CONVENTIONS.md`**, a section "Answers in forms": the words and where they show; `checkValidity` speaks, `validity.valid` is
    the silent check; no step coarser than a whole number; `missing`; `fieldError` / `check`; Enter's next/done; `openUnder`;
    `reveal` and the B13 recipe ("Saved." inside the revealed card); `undoable` for one-tap changes, `ui.confirm` for removes; one
    Undo note at a time; never change the layout between a pointer's down and its click. Update the `ctx.ui` row in the ctx table.
    Remove every prototype-only line (`MODE`, `?forms=`, `data-kit`, `data-forms`, `window.__undoMs`).
11. Ask the place track for P1 to P7 (2.12), and the sweep's owner for the two changes in 2.13.

---

## 7. Design log and lanes

Owner decisions this design relies on, and does not undo:
- 2026-09-15 Settings, round 6, Finding 4: "Rule: every save/add/remove confirms with a green notice; errors are red and say what to
  do next." B1 to B6 keep errors red and saying what to type; B11's note is green-edged and says what happened.
- AGENTS.md design rules (from the 2026-09-15 session): "Every save, add or remove confirms itself with `ui.notice("ok", ...)`; errors are
  `ui.notice("error", ...)` and say what to do next." Page errors still are `.notice.error` (moved, not restyled).
- 2026-09-15 Debts, round 14, Finding 1: "the form opens inside the list card" (chosen A). `openUnder` makes that the pattern for every
  list (INV-5 cites it).
- 2026-09-15 Net worth, round 4, Finding 3: "first visit with no accounts keeps the form open; Edit opens it filled in; Cancel folds it".
  Kept. Pass 2 round 4: Net worth keeps Edit and Delete on the rows (B): kept; `openUnder` opens the form under that row.
- 2026-09-16 Pass 4, round 2: an inline link was "the last sub-44 px tap target" and became an outlined button ("Update balances on Net
  worth"). B15 extends the same rule.
- 2026-09-16 Pass 4, round 1, Finding 4 (Social Security): "the one just saved stays open". B13 keeps the figures open after Work it
  out. Finding 3: "buttons on their own line" for "Use this one": kept.
- 2026-09-16 Pass 2, round 8, Finding 3: "Rule: disabled buttons look disabled." Save is never disabled for a wrong box: it stays tappable
  and answers.
- 2026-11-06 "One path": "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own
  buttons)". The Undo note is not a Next bar; it follows a button tap (keyboard down), stays at most 10 s unless touched, and leaves on
  navigation. Flagged in section 4 (covering) and H6.
- 2026-11-06 household's view: no build, PC, AI or sync words on screen. None of the kit's sentences has any.

Choices made where the owner was not asked (the conservative option each time):
- Empty boxes say nothing until Save; only a wrong value is named when a box is left.
- Removes keep asking first (window.confirm), as 43 places already do; Undo is for one-tap changes that are not removes.
- A one-tap change made through `ui.undoable` confirms with the bottom note (green edge, words, Undo) instead of an in-page green
  notice: still a green confirmation in view, one instead of two.
- Undo lasts 10 s (held while touched or focused) and ends when the page is left.
- A touch never pops the keyboard by itself; only a keyboard open puts the cursor in the first box.
- Scrolling to a wrong box is instant, not smooth.
- Default limits: money below 1,000,000,000; dates from 1900. Whole-number steps stay; coarser steps (12, 500, 1000) are not enforced.

Lanes: files changed are `core/ui/dom.js`, `core/ui/base.css` (form and notice selectors), `docs/CONVENTIONS.md`, plus one new
`core/ui/undo.js` and its test. That is one file beyond the listed set; it is in `core/ui/` (the designer's lane in docs/TEAM.md) and
keeps dom.js's diff readable; it can be folded into dom.js if the file list is strict. No claude-a page is edited (their rows in
section 3 are for the handoff). Nothing touches `modules/overview/setup/compute.js`, `modules/retirement/projection/compute.js` or the
estimators; `novalidate` Get started is left alone by every listener. The prototype's page edits (prioritizer, liquidity,
subscriptions, net-worth, house, payoff) exist only to measure the helpers; wave 2 makes them for real.

---

## 8. Coverage (55 findings in the seven theme files)

| finding | where |
|---|---|
| j-fat-fingers/FF1 | B3 (kit); section 3 for the box itself (home, mortgage, documents to claude-a) |
| p-debt-property/DP-2 | B3, B1 (kit); section 3 (`required` on vehicles, rental; home year via fieldError) |
| p-debt-property/x-2 | section 3 (renovation, purchase `required`) |
| p-insurance-estate/IE-2 | B6 ceiling (kit); section 3 (`required`, Health cross-check) |
| p-investments/x-2 | B3 (kit); section 3 (fieldError) |
| j-debt-fixer/D2 | B4 with section 3 (payoff `ui.check`, credit-cards) |
| j-fat-fingers/FF5 | B1 |
| j-heavy-waiting/W6 | B5 (Vehicles), B1 words (Goal seek); section 3 (Goal seek money box, confirmation line) |
| p-career-household-system/F3 | B1, B2 (the count line replaces the one-at-a-time jumps) |
| p-debt-property/DP-4 | B4 with section 3 (credit-cards, payoff `ui.check`) |
| p-insurance-estate/IE-4 | B1 words; section 3 (LTC label) |
| p-investments/INV-3 | B1 |
| p-retirement-c-scenarios/RC-1 | section 3 (advisor-plan) |
| p-retirement-c-scenarios/RC-4 | B1/B4 words; section 3 (money box) |
| p-retirement-c-scenarios/RC-2 | section 3 (`required`) |
| p-career-household-system/F7 | B16 (kit types); section 3 (Contacts) |
| p-cashflow-a/CF-7 | B1, B5 |
| p-investments/INV-10 | B6 date floor (kit); section 3 (`max: "today"`, tax-lots check, symbol) |
| p-retirement-a/R-A10 | B6 ceiling (kit); section 3 (tighter `max`) |
| p-taxes/T6 | B1, B2 |
| p-transactions-helpers/T7 | section 3 (reader) |
| p-career-household-system/x-2 | B7 |
| p-insurance-estate/x-2 | B7 |
| j-first-freelancer/F6 | B7 (Android); iPhone has no return key on the pad (nothing to do there) |
| p-taxes/T2 | B7 |
| p-transactions-helpers/T9 | B9 Cancel (kit); B10 with section 3 (openUnder) |
| j-keyboard-reader/K4 | B8 and B9 (kit); the focus after a save is P1/P5 (place) |
| p-balance/B3 | B9 Cancel (kit); B10 with section 3; P1 for pages not yet adopted |
| p-investments/INV-5 | B9 (kit); B10 with section 3 |
| p-transactions-helpers/x-halfform | B10 with section 3 (ledger's edit form gets its own holder under the row) |
| p-cashflow-b-goals/F3 | B11 with section 3 (subscriptions, recurring; the double tap is merged by M10 and guarded by track taps) |
| p-investments/INV-2 | B12 with section 3 (`ui.confirm`) |
| p-cashflow-b-goals/x-4 | B11 with section 3 |
| p-retirement-b/x-3 | B11 with section 3 |
| p-taxes/x-4 | B12 with section 3 (capital-gains; documents to claude-a) |
| p-transactions-helpers/T11 | B11 with section 3 (the rule goes with the pick in one change) |
| p-transactions-helpers/x-duplicates | B11 with section 3 |
| j-first-retiree/R4 | B11 with section 3 (withdrawal-strategy), rmd's second filled button in section 3 |
| p-balance/x-4 | B11 with section 3 (measured in the prototype) |
| j-keyboard-reader/x-redraw-on-change | B14: section 3 for the three what-if pages; the keyboard half (choices that save) is the place track's focus restore |
| p-debt-property/x-1 | B14, section 3 |
| p-taxes/x-3 | B14, section 3 |
| j-one-answer/A1 | B13, section 3 (federal, house) |
| p-debt-property/DP-1 | B13, section 3 (reveal); P4 (place) for the clamp |
| p-cashflow-b-goals/F6 | B13, section 3 (house, rent-vs-buy, renovation; vehicle, charitable to claude-a) |
| p-investments/INV-7 | section 3 (live line) |
| p-retirement-c-scenarios/RC-11 | B13, section 3 |
| p-cashflow-a/x-3 | section 3 (paycheck message) |
| p-retirement-a/R-A9 | B15, section 3 |
| j-fat-fingers/FF8 | B15, section 3 |
| p-balance/B8 | B15, section 3 |
| p-career-household-system/F8 | B15, section 3 |
| p-overview-home/OV-5 | B15, section 3 |
| p-retirement-b/RB3 | B15, section 3 |
| p-retirement-c-scenarios/RC-10 | B15, section 3 (goal-seek lever names) |

None declined.

---

## 9. Compared with the first design

The first architect's folder (`w1/forms/`) did not exist when this design was finished (checked at the end of the session), so there is
nothing to compare yet. The brief's starting points match this design except one: the brief leans to the kit taking validation over
(`novalidate`); this design keeps the browser's checks because, measured, that reaches the three hand-built forms and the two
`reportValidity` callers with no page edit, for the same words and the same drawing (2.1).
