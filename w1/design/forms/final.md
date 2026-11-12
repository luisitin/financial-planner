# Wave 1, track "forms": form controls and answers (final design)

The owner's request (2026-11-11), verbatim: "Be extensive and use tons of agents to stress test every single touch and
input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy
to know next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."

This file stands alone: a builder needs only it and the seven theme files
(`$SP/ux/synth/themes/UI-{ERR,ENTER,EDIT,UNDO,LIVE,RESULT,TARGET}.md`, 55 findings).
`$SP` = `$SP`.

**Base.** The branch tip is **fa2026e** (124 commits after c385e41, where the first draft was measured). `core/ui/`,
`core/app.js` and `index.html` did not change in between, so the kit lands as designed; but wave 2's page builders closed
33 of the 55 findings in their pages and standardised on the browser's own checks (`setCustomValidity` /
`reportValidity` in 10 views). Everything below was rebuilt and measured on fa2026e. The builder builds on whatever tip
the workflow names and re-runs every grep named here there.

**Evidence.**
- `$SP/w1/forms/fin`: `git archive fa2026e` (one commit, "tip") with this design as the uncommitted diff:
  `core/ui/dom.js`, `core/ui/checks.js` (new, pure), `core/ui/undo.js` (new, pure, from forms2), `core/ui/base.css`
  (form and notice blocks), `tests/ui-checks.test.mjs` (7 tests), `tests/ui-undo.test.mjs` (11 tests), and two
  page edits made only to measure the two page recipes (`retirement/withdrawal-strategy`: Undo; `property/rent-vs-buy`:
  the answer brought into view). `git -C $SP/w1/forms/fin diff` is the whole change.
- `?forms=off` in the address draws today's kit from the same files (evidence only: never on the branch).
- Scripts (in `$SP/w1/forms/`): `flib.mjs` (helpers: real touch taps at a control's centre, real finger drags, typing
  70 ms a key, 450 ms between actions), `x1-engine.mjs`, `x2-opener.mjs` (with X3), `x5-undo.mjs`, `x6-answer.mjs`,
  `x7-more.mjs`. Output in `out/x*.json|log`, pictures in `shots/x*.png`.
- Served on 127.0.0.1:9329 while measuring (stopped). Phone 390 x 844 (and 390 x 664, what Safari shows between its
  bars), touch, Chromium, always `?sandbox=1`. Households: family, blank, renterDebt.

**What changed since the first design (`design.md`)**, each for a reason given in section 9:
1. **The browser's validity stays the engine** (scope critic, blocking 2). The kit no longer sets `novalidate`; one
   capture `invalid` listener turns every report (a held submit, Return, `reportValidity()`, in kit forms and hand-built
   ones) into our words at the box. Wave 2's own page checks keep working with no page edit.
2. **Number and percent boxes become text boxes the kit reads** (kept from the first design: no "nearest valid values",
   "1,200" and "5%" taken, one behaviour on Safari and Chromium), but their words live in the box's own validity, so the
   engine and the touch sweep see them.
3. **Cut**: `ui.afterDraw` / `drawStart` / `setStore` and every rule that guessed a target after a redraw (the wrong-row
   glow, the question-verb regex, `[data-answer]`), the do-nothing net, `ui.later`, `ui.goTo`, the notice-link padding,
   `ui.check`, `ui.change` / `undoLine`, `.kit-glow`, `fd.check` / `opts.check` / `opts.answer`, the `?forms=off`
   switch and `window.__kitLog`. Forms now changes **nothing in `core/app.js`**.
4. **Cancel returns to the row only when the app knows the row for sure** (break critic, blocking 1): the same node, or
   the row with the same `data-key`, or the same place in a list that reads the same row for row. A Save brings nothing
   back by itself (the place track keeps the place; pages that adopt `ui.openUnder` keep the row on screen).
5. **A key press opens a form only when the form is new** (break critic, blocking 3).
6. **Undo is drawn where the tapped control was, on its own line, and brings itself into view** (person critic,
   blocking 1).
7. **Return walks the boxes a person types in, notes boxes included**, and skips choices and tick boxes (person critic,
   should-fix 5; our own measurement of the key path).
8. **The five findings no one owned get an owner and a step** (scope critic, blocking 5): page adoptions A1 to A5 on
   claude-b's pages, built after the kit is on `main`.
9. **The seams are written as named events, attributes and calls** that both place designs already listen to (scope
   critic, blocking 6; break critic, blocking 4).

---------------------------------------------------------------------------------------------------------------------

## 1. Behavior (the acceptance test, in a person's words)

Each item: what I do, what I see, what it closes, and its acceptance check (a kit script the builder writes as
`$SP/w1/accept-forms/B<n>.mjs`; the measured run that already shows it is in brackets).

**B1. A Save or Add that cannot go through says why at the box.** I tap Save with a box empty or wrong. The screen brings
that box up under the top bar with its name showing, the cursor is in it, the box has a red edge, and right under it a
red line says what to type: "Fill this in first.", "Type an amount first.", "Use a number from 0% to 100%.", "A symbol is
letters, like ACME." (a page's own words), "Pick a date that is not in the future.". No grey bubble. The line stays until
the box is right and goes the moment it is. When more than one box is wrong, a red line right above the buttons says
"2 boxes need a fix: What are you saving for; Amount needed." and counts again as I fix each one. Nothing I typed is lost.
Closes j-fat-fingers/FF5, p-career-household-system/F3 (Save half), p-insurance-estate/IE-4, p-investments/INV-3,
p-cashflow-a/CF-7, p-taxes/T6 (Save half). [X1/X7: 9 refusals on 9 pages: grey bubbles today 14 (one Health tap
showed 5), final 0; words at the box today 0, final 9 of 9, all in view, label shown, red 600 weight, red edge; the
cursor in the first wrong box 9 of 9]

**B2. Leaving a box I typed wrong says so once my tap has landed; the tap is not lost and the box I am now in does not
move.** I type 12..5 and tap the next box: the next box takes the cursor and stays where it was; then the red line
appears under the box I left. An empty box says nothing until Save. While I type, a page that quietly checks the box
(Pay off debts' preview) draws nothing. Closes p-taxes/T6 (leaving half), p-career-household-system/F3 (leaving half).
[X1 payoff: no words while "50.." was typed, the words at the box after Save plan, the saved $50 kept; forms2's
measured hold, same code: the next box 649 -> 650 px]

**B3. When the page itself refuses, its message is right above the button I tapped, once, and the button stays under
my thumb.** "2099 is still ahead. Type the year you bought it, or leave it blank." appears directly above Save; a second
tap does not stack a copy; it stays until my next try (no 6-second timer). Closes j-fat-fingers/FF1,
p-debt-property/DP-2 (the message), p-investments/x-2 (the message). [X7 home, two taps on Save then 7 s: today
nothing on screen at +7 s (the page put its line at the top and its 6 s timer removed it); final one copy at 668 px,
right above Save, still there at +7 s; Save 751 -> 751 -> 751 over the two taps]

**B4. Every form speaks the same way, the hand-built ones too.** Update my balances, Credit cards, Pay off debts,
Calendar, People, Health, Holdings, Tax lots, Employer stock and Crypto answer as in B1 with no change to those pages.
[X1: update "abc" (label hidden under the bar today, shown final), health (5 bubbles today, 1 line at the maximum box
final), employer-stock "acme!!" and crypto 2099 held with the pages' own words, not saved, in both kits]

**B5. A real figure is taken as typed; an impossible one is stopped at the box.** "1,200", "2.555", "11,200" and "5%"
are taken; a whole-number box says "Use a whole number, like 12."; a percent box shows "%" inside it; an amount of a
billion or more says "That is more than a billion: check for an extra digit."; a year typed as 0026 says "Check the
year: type all four digits, like 2026.". Closes CF-7's 2.555 and the box half of R-A10 and IE-2's ceiling. [X1 income
2.555: today a bubble "...nearest valid values are 2.55 and 2.56", final saved 0.02555; node tests]

**B6. In a text, phone or email box, Return goes to the next box I type in; only the last box saves.** The key reads
"next", and "done" in the last box. A choice list or tick box in between is skipped (it already holds a value, and a
picker wheel popping up from Return would surprise); a notes box is not. On an iPhone the number pad has no Return (its
"Done" only closes the keyboard); an Android number pad's Go key behaves as Return. Two quick Returns save once. Closes
p-career-household-system/x-2, p-insurance-estate/x-2, p-taxes/T2, j-first-freelancer/F6 (Android).
[X7: contacts and net worth, see section 2 M6]

**B7. Opened with the keyboard, a form has the cursor in its first box; a tap opens no keyboard by itself; a key on a
chip does not hand the cursor to some other form.** Closes j-keyboard-reader/K4 (opening half). [X2: Enter on
"+ Add another income": today focus on nothing and "Side gig" lost, final the cursor in "What is it" holding "Side gig";
a tap: no focus; Enter on Capital gains' "+$25,000" chip: final scroll 0, focus stays on the chip, nothing typed into the
sale form (the first design: 586 px jump and "5" typed into it)]

**B8. Cancel takes me back to the row I came from, when the app knows the row for sure.** The row comes to the middle of
the screen if it is off it, and the focus is on its Edit. If the list is drawn differently (re-sorted, renamed, a row
gone), nothing moves: no guess. Closes the Cancel half of p-balance/B3, p-transactions-helpers/T9 and
j-keyboard-reader/K4. [X3 net worth Ally savings: today the row at -211 px and focus on nothing, final at 395 with the
focus on its Edit; Car loan: 122 in both, final focus on its Edit; X7 expenses Groceries: today -412 px and focus on
nothing, final 408 px with the focus on the row]

**B9. (pages that adopt it, A1) A row's form opens right under the row; Save and Cancel leave me at the row.** If the
form's first box would be under the screen's edge, the screen moves just enough to show the row and that box. A
half-typed add form elsewhere on the page keeps its typing. Closes p-transactions-helpers/T9 and p-balance/B3 with A1.

**B10. (pages that adopt it, A2 to A4) A one-tap change can be taken back from its own green line.** The line is drawn
where the button I tapped was, says what changed, and carries an outlined 44 px "Undo" on a line of its own, on my
screen. It stays until my next change or until I leave the page (no timer). Undo puts back exactly what that tap
changed, leaves alone anything changed since, and says so in the page's words ("Back to $7,000 a month, as before.").
Closes p-retirement-b/x-3, p-transactions-helpers/T11, p-transactions-helpers/x-duplicates with A2 to A4. [X5: see
M10]

**B11. (pages that adopt it, A5) After Compare, Work it out or Add, the answer is on my screen.** The answer card comes
just under the top bar with "Saved." inside it, the figures stay open below it for the next try, and when the answer is
already on my screen nothing moves. Closes p-debt-property/DP-1, p-cashflow-b-goals/F6 (rent-vs-buy, renovation),
p-retirement-c-scenarios/RC-11 with A5. [X6 rent-vs-buy, Compare, and again with a second price: without the
reveal the answer card is 2,216 px above the screen; with it 8 px under the top bar both times, "Saved." inside it, the
figures open; the tip also folds the figures shut after a save (:81)]

**B12. Nothing the kit draws moves anything between my finger going down and its click.** (G4; touch rules
D-FOCUS-KEPT, D-SCROLL-KEPT.)

**B13. With VoiceOver, the words are read with the box.** A wrong box is marked invalid and its words are its
description; the line above the buttons is read once at the refusal (`role="alert"`); a red notice a page draws on every
redraw is read once per visit, not after every save. Closes the error half of j-keyboard-reader/K5 (taps track's
handoff).

**B14. Phone and email boxes bring up the right keyboard** (`type: "tel"` / `"email"` in `ui.form`). F7 is closed on the
branch by Contacts itself; the kit makes it one word for any page.

**B15. Every Remove asks first, naming what goes** (`ui.confirm`, as 46 places do). Rule only; INV-2 and p-taxes/x-4 are
closed on the branch except taxes/documents (claude-a's: handoff line, section 3).

**Touch rules** (`$SP/wtouch/qa/touch-rules.json`) these turn green or keep green: **D-WRONG** (B1, B3, B4, B5: the
sweep reads `invalid` events, which still fire), **D-KIND** (B5: "1,200", "$1,200.50", " 300 ", "5%"), **D-ENTER**
(B6), **D-TWICE** (B6's Enter half; taps' guard does the taps), **T-KEYBOARD** (B14), **T-CANCEL** (B8 helps; the rule
asks for a Cancel, which every kit form with `onCancel` has), **D-FOCUS-KEPT** and **D-SCROLL-KEPT** (B2, B3, B12),
**D-UNDO** (B10 on the adopted pages), **D-SEEN** (B10, B11 with the adoptions). The sweep needs no adapter: it reads
the browser's `invalid` events and our words are in the box's own validity.

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

All in `core/ui/dom.js` plus two pure files: `core/ui/checks.js` (the words and decisions) and `core/ui/undo.js` (a
change and its way back, from the forms2 design, same repo, MIT). CSS in the form and notice blocks of
`core/ui/base.css`. Nothing in `core/app.js`, `core/router.js`, `index.html` or any place/taps file.

Every document listener is installed **once, when dom.js is first imported**, and only when `document.addEventListener`
and `document.documentElement` exist; `data-forms-kit="1"` on `<html>` stops a second copy (a framed copy, a
cache-busted import) from installing twice. The view tests' stand-in document (`qa/fixtures/fake-dom.mjs`) has neither,
so it gets no listeners, but **boxes are built and read the same way in Node and on the phone** (text boxes,
`readNumber`): the tested path is the phone's path (scope critic, blocking 3). `dom.js` grows from 143 to about 520
lines; `checks.js` 103, `undo.js` 93.

### M1. What a box says: `core/ui/checks.js` (pure; `tests/ui-checks.test.mjs`)
- `readNumber(raw, { percent })`: "1,200", " 300 ", "2.555", "-2" (and "5%" in a percent box); null for "12..5",
  "abc", "72k", "$5", blank. `numberText(raw)`: the plain number a box shows after leaving it ("5,000" -> "5000").
- `boxWords(spec, raw)`: the kit's own words for a box it reads itself (money, number, percent) or "": unreadable
  ("Type an amount in numbers, like 4,500.", "Type a number, like 12.", "Type a number, like 3.5 for 3.5%."), whole
  ("Use a whole number, like 12."), range with the unit ("Use a number from 0% to 100%.", "Use 18 or more.", "Use
  $10,000 or less." with the plan's sign), the money ceiling ("That is more than a billion: check for an extra digit.";
  `max: null` lifts it). Years and ages under 10,000 have no comma. Blank says nothing (left to `required`).
- `validityWords(record)`: the words for a box the browser holds back, from a plain record of its state (forms2's
  `wordsFor`, made pure): the box's own message first (the kit's, or a page's `setCustomValidity`), then empty ("Fill
  this in first.", "Type an amount first.", "Choose one first.", "Pick a date first.", "Check this box to go on.", "Type
  a phone number first.", "Type an email address first.", or the field's `missing`), bad input, email, ranges (dates:
  "Check the year: type all four digits, like 2026." below the kit's 1900 floor, "Pick a date that is not in the
  future." against today), steps ("Use a whole number, like 12."; a hand-built coarse step "Round it to the nearest
  1000, like 1000."), length, pattern (the box's `title`).
- `summaryWords(labels)`: "2 boxes need a fix: A; B." with **semicolons** (62 labels hold a comma), the first four names
  and "and more"; "" for fewer than two.
- `keyText(text)` (a row's words without its figures) and `sameRowIndex(before, now, index)`: the row's index when the
  list reads the same row for row, else -1 (M7).
- `keyHint(index, count)`: "next" / "done".
- `tools/check.mjs` adds `core/ui/checks.js` and `core/ui/undo.js` to its purity list (no `document`, `window`, timers).

### M2. The engine: the browser's validity, our words (B1, B4)
- **One capture `invalid` listener on `document`.** `invalid` fires on every box that fails when a submit is held
  (a tap on Save, Return, `requestSubmit`), and on `reportValidity()` of a box or a form, in any form or none. The
  listener calls `preventDefault()` (no bubble), draws `validityWords` under the box (M4), and for the first box of
  that pass (the browser fires the events in one task; a `setTimeout(0)` ends the pass) clears the form's old red line
  with the buttons kept still, brings the box's field under the top bar and puts the cursor in it
  (`focus({ preventScroll: true })`, inside the tap's own event, so an iPhone raises the keyboard). A kit form then
  gets the count line (M4) when two or more boxes are held. Boxes in a `novalidate` form are left alone (Get started,
  Goal seek and Social Security check themselves).
- **`checkValidity()` stays silent.** It also fires `invalid`, and pages call it quietly on every key (Pay off debts,
  Mortgage). The kit wraps `checkValidity` of `HTMLInputElement`, `HTMLSelectElement`, `HTMLTextAreaElement` and
  `HTMLFormElement` once, counting a depth while the original runs; the listener does nothing at depth > 0. So
  `checkValidity()` means "ask quietly", `reportValidity()` and a held submit mean "tell the person". (forms2's
  wrapper.)
- **A finger is down: words wait.** From `pointerdown` until that gesture's `click` (or 400 ms after `pointerup`, or
  `pointercancel`), a box that fails is only noted; its words are drawn once the click has landed, and the cursor is
  left where the tap put it (G4).
- **The words go** at the next `input` / `change` that makes the box valid; a page's own words (`ui.fieldError`) go at
  the next change of the box.
- **The kit's words for boxes it reads itself live in the box's validity** (M3), set on `input` before the page's own
  listeners run, and put back at the start of a submit (a capture `click` on a submit button, which Return's implicit
  submission also fires) **without wiping a page's own words**: the kit clears only words it set itself. So a page that
  clears its own message on `input` (Tax lots, Holdings, People, Calendar) can no longer clear the kit's "Type a number"
  by accident.
- **`ui.fieldError(box, words)`** for a page's own "no" about one box: `return ui.fieldError(yearBox, "...")` in an
  `onSubmit` draws the words at that box, brings it into view with the cursor in it and keeps the form. It replaces the
  `setCustomValidity` + `reportValidity` + `addEventListener("input", ..., { once: true })` dance wave 2 wrote four
  times (people, calendar, holdings, tax-lots): those keep working; new code uses `fieldError`.
- **Fit.** A held Save makes no `store.update`, so no shell redraw follows and the place track has nothing to do.
  `mendBlockedForms` (`core/app.js`, framed copies) calls `form.reportValidity()`: it now speaks our words. The guide
  frame, sync bar and heal reload are untouched.
- **Measured** (X1, today vs final, same server; `out/x1-engine.json`):

  | case (household) | today | final |
  |---|---|---|
  | Goals, Add goal with nothing typed (family) | 2 bubbles "Please fill out this field." | "Fill this in first." and "Type an amount first." at the boxes, in view, cursor in the first, label shown; "2 boxes need a fix: What are you saving for; Amount needed." above the buttons |
  | Income, yearly raise 150 (family) | bubble "Value must be less than or equal to 100." | "Use a number from 0% to 100%." at the box, cursor, label |
  | Income, raise 2.555, amount "1,200" | bubble "...nearest valid values are 2.55 and 2.56." | saved: amount 1200, raise 0.02555 |
  | Employer stock, symbol "acme!!" (blank) | bubble "A symbol is letters, like ACME.", not saved | the same words at the box, not saved (INV-10 kept) |
  | Crypto, bought 2099-01-01 (blank) | bubble, not saved | "A purchase date cannot be in the future." at the box, not saved |
  | Health, maximum below the deductible (family) | 5 bubbles (4 empty boxes, then the page's) | one line at the maximum box, cursor in it |
  | Pay off debts, "50.." typed then Save plan (renterDebt) | nothing while typing; bubble at Save | nothing while typing; words at the box at Save; the saved $50 kept |
  | Update my balances, "abc", Save (family) | bubble, label hidden under the top bar | words at the box, label shown, red |
  | Vehicles, Add car with only a name (family) | bubble "Please fill out this field." | "Type an amount first." at "What it is worth today", cursor |
  | Renovation, Compare with the cost empty (family) | bubble | "Type an amount first." at the cost box, cursor |

  Words outside a kit form are red and the box has a red edge (break critic, should-fix 1): every row above, color
  `rgb(185, 28, 28)`, weight 600, border red. `npm test` on the evidence tree: see section 4, R9.
- **Weighed.** (a) The kit takes checking over (`novalidate`, the first design): it reaches only `ui.form`, so the ten
  `reportValidity()` callers and Update my balances keep the grey bubble, and the pages' own `setCustomValidity` checks
  are skipped (scope critic measured INV-10 coming back). Its one advantage, independence from how a browser dispatches
  `invalid`, is kept as the fallback (H1 in section 5). (b) A helper each page calls, alone: about 30 page edits and the
  next page forgets it. (c) A bar fixed to the bottom: against the 2026-11-06 rule.

### M3. Boxes the kit reads itself (B5, B14)
- **Money** (`moneyBox`, unchanged look): `data-kind="money"`; the default ceiling under a billion when the caller gives
  no `max` (hand-built money boxes too; `max: null` for none); words with the plan's sign ("Use $0 or more.").
- **Number and percent** (`ui.numberBox({ name, value, min, max, whole, percent, required, missing })`, used by
  `ui.form` for `type: "number" | "percent"`): a text box with `inputmode="decimal"` (the same number pad as today; an
  iPhone's has no minus key, as today), `data-kind`, read by `readNumber`. A percent box shows "%" inside its right edge
  (`.unit-in`), its placeholder is "e.g. 7". Leaving it writes the plain number back ("5,000" -> "5000", "7%" -> "7"),
  and so does the start of a submit, so a page that reads `Number(box.value)` (Tax lots' room check, Allocation's
  tally) keeps working. `whole: true`, or a field `step` of 1 or more, means whole numbers; any other step is a hint,
  never a refusal (11,200 miles at step 500 is taken). `readForm` divides a percent by 100 to 12 significant digits
  (2.555 -> 0.02555, not 0.025550000000000003).
- **Date**: `min` defaults to 1900-01-01; `max: "today"` is a token for today.
- **`type: "tel"` / `"email"`**: the type, `inputmode`, `autocomplete`, and for email `autocapitalize="off"`,
  `spellcheck="false"`.
- **`missing: "Type the amount of the gift."`**: the words for an empty `required` box (`data-missing`).
- **Weighed.** Keeping `type="number"` (forms2): Chromium refuses "1,200" and "5%" as they are typed, and on an iPhone
  a number box holding "12..5" may read as empty and valid (break critic, should-fix 8; CONVENTIONS already says "a
  number box ... on an iPhone silently saves nothing" about money). A text box read by our own `readNumber` behaves the
  same in every browser. The cost is the hand reads (R6), handled by writing the plain number back.

### M4. The form's own submit (B1, B3, B6)
`ui.form`'s submit wrapper, on a real page (in Node: today's path):
1. **One submit per 800 ms** after one that went through (Return pressed twice, a bouncing finger: taps' window).
2. Notes the red notices on the page, calls `onSubmit(values)`.
3. **A page's own refusal is brought to the thumb**: a `.notice.error` the handler put anywhere (`form.prepend`,
   `root.prepend`, the top of the page) is marked `data-moved="kit"`, removed, and its words are drawn once as
   `div.notice.error.form-error[role=alert][data-kit]` right above `.form-actions`; the message and the buttons are
   brought into view together with the least scroll. A second refusal replaces the line in place.
4. **The buttons stay under the thumb**: every line drawn or removed above the buttons goes through `steady(anchor, ...)`
   (read the anchor's screen top, change, scroll back by the difference; Safari has no scroll anchoring). Anchor: the
   box being typed in when the focus is in the form, else the buttons.
5. With no refusal, the last try's red line goes (steady); `resetAfter` resets only a form that went through.
- **The count line** (`.form-error.kit-count`): `summaryWords` of the held boxes' labels, drawn after the invalid pass
  when two or more are held, counted again as each is fixed, gone below two.
- **Fit.** At fa2026e the refusals that still prepend out of sight are home :130, rental :168, vehicles :101,
  crypto :136-137, employer-stock :127/:152, career/business :141, contributions :314 (and taxes/documents :72,
  claude-a's, helped with no edit). Equity and budget-percent scroll their own; the kit moves theirs too (same words,
  above the buttons). The page's 6-second removal timers find their node already gone (no page edit needed).
- **Measured** (X7 home, family, year 2099, two taps on Save, then 7 s): today the line goes to the page's top and is
  removed after 6 s (nothing on screen at +7 s); final one copy at 668 px right above Save, still there at +7 s, Save at
  751 -> 751 -> 751. (A first version cleared the old line before the handler ran and Save rose 83 px on the second
  tap: fixed by clearing inside `steady`.)

### M5. Leaving a box (B2, B12)
A capture `focusout`: a box that holds something that cannot be used (bad input, the kit's words, a range; not empty)
gets its words once the tap that left it has landed, drawn with `steady(the box now focused, ...)`, so the box being
typed in does not move. A box in no form with only a step problem says nothing (a what-if box no Save checks).

### M6. Return and the keyboard's key (B6)
- **In a kit form**: Return in a one-line box (text, number, money, percent, date, tel, email) moves to the next box a
  person types in (a one-line box or a notes box) and is stopped there (`preventDefault`); in the last such box the
  browser's implicit submit runs, and M2 with it. Choice lists and tick boxes are skipped: they hold a value, and on an
  iPhone a picker wheel opened by Return would surprise. `enterKeyHint` is set when the form is built and again on
  `focusin` (a box shown later): "next" / "done".
- **In a box in no form** inside `#content` (what-if boxes): a `keydown` listener on `document` in the bubble phase, so
  a page's own Enter runs first and is left alone (Ask's send, a search). A box holding something unusable:
  `reportValidity()` (our words, cursor kept); else the next box of the same card; else `blur()` (the keyboard goes
  down and the page's `change` runs). Search boxes are skipped.
- **Measured** (X7, keyboard): Contacts > Add someone, "Dr Lee" in Name then Return: today saved at once with no
  firm, phone or email; final the cursor walks Name (next) -> Firm (next) -> Phone (next) -> Email (next) -> Notes,
  nothing saved until Add. Net worth, Edit "Chase checking", "Chase everyday" and 52000, then Return from Balance: today
  saved at once from Balance; final Balance (next) -> As of (done) -> saved "Chase everyday: 52,000", and no row
  focused or glowed after the re-sort (it moved to 3rd).
- **Weighed.** Moving into choice lists too (forms2): the first key run stopped on the owner `<select>`, where Return
  does nothing, so the keyboard user could not save without the mouse (`out/x2-x3.json` nw-rename-move-save key: focus
  on the select, "Chase checking: 4,200" unchanged).

### M7. What opened a form: a keyboard open and Cancel (B7, B8)
- **The click note.** One capture `click` listener on `document` notes the control just activated inside `#content`
  (button, link, summary, `[role=button]`, row, `[data-key]`): its words, whether it came from the keyboard
  (`click.detail === 0`), its `data-key` row, its row's place in its list with the list's figure-free keys
  (`rowNote`, lists of up to 300 rows), and **the identities of the kit forms already on the page** (submit words +
  section heading + first label). It is forgotten at the end of that task.
- **Opened.** A `ui.form` built during that click is "opened by" it only if its identity was not on the page before
  the click, and only the first such form. Opened from the keyboard, its first control gets the cursor; a touch opens
  no keyboard. `ui.form(..., { opener })` lets a page name the opener.
- **Cancel.** The kit runs the page's `onCancel`, then finds the opener: the same node if still on the page; else the
  one control with the same words inside the one row with the same `data-key`; else the row at the same place in a
  list whose rows read the same as at the tap (`sameRowIndex`); otherwise nothing. Found: brought mid-screen when not
  wholly on screen, focused with `preventScroll`.
- **Save brings nothing back by itself.** After a save the place track keeps the place (both designs anchor on the
  tapped control's chain), and pages that adopt `ui.openUnder` (A1) keep the row next to the form.
- **Measured** (X2/X3/X7, today vs final): Enter on "+ Add another income": focus on nothing and "Side gig" lost ->
  cursor in "What is it" holding "Side gig". A tap on it: no focus in both. Enter on Capital gains' "+$25,000" chip
  with the sale form open: scroll 0 and focus on the chip in both (the first design: 586 px and "5" typed into the
  sale form). Net worth, Edit on Ally savings then Cancel: row at -211 px, focus nothing -> row at 395, focus on its
  Edit. Car loan: 122 in both, focus nothing -> its Edit. Net worth, Edit Chase checking, rename to "Chase everyday" and
  52,000 (it moves from 7th to 3rd), Save by touch: no row is glowed or focused in either kit (the first design glowed
  "Ally savings"). Expenses (rows are `li[role=button]`), Groceries then Cancel: today row at -412 px, focus nothing;
  final row at 408 px, focus on the Groceries row.

### M8. `ui.reveal(el, { block })` and `planner:reveal` (B9, B10, B11)
- Does nothing when `el` is wholly on screen. The screen is what the person sees: below `max(top bar, visualViewport
  top)` and above the visual viewport's bottom (the keyboard). `start`: its top 8 px under the top bar (an answer, a box
  with its label); `center`: mid-screen (a row); `nearest`: the least scroll (a message with its buttons, a row with
  its form). Instant (a smooth scroll and the iPhone's own scroll to a focused box fight).
- Called while the page draws, before the element is on the page, it waits for it (one animation frame at a time, up
  to about half a second).
- Before it scrolls it dispatches **`planner:reveal`** on `window`: the place track ends any hold and does not anchor
  for this draw (G1).
- `ui.spanOf(a, b)` gives the stretch from `a` to `b` for it.
- `base.css`: `.field :is(input, select, textarea) { scroll-margin-top: 40px }`, so the browser's own scroll to a box
  (the iPhone's arrows) keeps the label below the top bar.

### M9. `ui.openUnder(row, build)`: a row's form in its own holder under the row (B9)
`const close = ui.openUnder(rowEl, (holder) => holder.append(editForm))`. The kit makes the holder (`li.rec-form` after
an `<li>`, `tr.rec-form > td[colspan]` after a `<tr>`, else `div.rec-form`), puts it right after the row, calls
`build(holder)`, then reveals the stretch from the row's top to the form's first box with `nearest` (nothing moves when
both are on screen); opened from the keyboard, the first box gets the cursor. `close()` removes the holder and puts the
focus on the control that opened it. The page's add form keeps its own host, so its typing is never swapped away. With
the place track's layer API (`ctx.layer(close)` in place2, `router.layer` in place), the phone's Back closes it the same
way (break critic, should-fix 12). (forms2's helper, measured there on Net worth: row and first box on screen, Cancel
focus on Edit.)

### M10. A change one tap can take back: `ui.undoable`, `ui.notice(kind, text, { undo, undone })` (B10)
- `const undo = ui.undoable(ctx.store, (d) => { ... })` makes the change with one `store.update` and works out, **inside
  the update**, the exact changes from the plan as the update found it (`store.get()`, after another tab's save was
  taken in) to the draft (before the guesses' refresh), with the pure `changesOf` (`core/ui/undo.js`). Only the change
  list is kept. It returns `null` when nothing changed (no Undo for a tap that changed nothing), else `undo()`: one
  `store.update((d) => takeBack(d, changes))` returning `{ done, kept }`. It works once, and only while the same page is
  open (break critic, should-fixes 2 and 3).
- `takeBack` puts back only what still holds the value the change wrote, a removed row only if no row with its id is
  back, an added row only if unchanged since; `meta` is skipped.
- `ui.notice("ok", words, { undo, undone })` draws the words and, on a line of its own under them
  (`.notice-actions`), one outlined 44 px **Undo** (`button.notice-action`). Its tap runs `undo()` then `undone(r)`,
  where the page sets its next `pending`; `ui.undoneWords(r, "Back to $7,000 a month, as before.")` adds "What you
  changed after that was left as it is." when part was kept, or says "Nothing to put back: it was changed again after
  that.". `{ action: { label, run } }` is the same for any one button.
- **A notice with a button brings itself into view** (`reveal(n, { block: "nearest" })` once it is on the page), so the
  way back is never above the screen.
- **Page recipe** (CONVENTIONS): `pending = { text, undo: ui.undoable(ctx.store, (d) => ...), undoText }`; on the next
  render, draw `ui.notice("ok", pending.text, { undo, undone })` **where the tapped control was** (in its slot, or the
  row's place), no `setTimeout` removal; clear `pending` once drawn. A second change gets its own line; the earlier one
  is then final.
- **Measured** (X5, withdrawal-strategy with the A2 recipe, family, "Plan on $6,600 a month" swiped to mid-screen at
  510 px on a 390 x 664 and a 390 x 844 screen, one tap): the green line is drawn at 511 px, where the button was; Undo
  is 44 x 73 px at 599 to 643 px, on its own line, on the screen at both heights; still there after 5 s; its tap puts the
  plan back from 6,600 to 7,000 and "Back to $7,000 a month, as before." is on the screen. Today (fa2026e :166): no Undo,
  and the line is removed after 4 s. Node: `tests/ui-undo.test.mjs` 11 of 11 (no change -> null; another tab's account
  and balance kept; Undo twice does nothing).
- **Weighed.** A timed bar at the bottom (forms2's first draft): it sat on the place track's note and left before a
  slow reader found it. A copy of the whole plan per Undo (wave 2's people and update pages do this today: they would
  also take back another tab's change): memory grows and later changes are lost; listed in section 3 as a later
  clean-up. A `confirm()` before every one-tap change: adds a question to the quick path the owner wants.

### M11. Notices, read-outs and CSS
- `ui.notice("error", ...)` gets `role="alert"` the first time its words are drawn on a page visit (a set of
  address + words, cleared on `hashchange`): the error is read at once (K5), and a page that draws the same red line on
  every redraw (Reconcile's "not ready") is not read again after each save (break critic, should-fix 11). The kit's own
  lines (`.form-error`) are always `role="alert"`: each is a fresh answer to a tap.
- Every node the kit draws carries `data-kit` (`.form-error`, `.field-error`), and a page notice it removed carries
  `data-moved="kit"`.
- CSS, in base.css's form and notice blocks: `.field-error` (red, 600, any box, in a kit form or not),
  `input|select|textarea[aria-invalid="true"]` (red edge), `.form-error` (spans the grid), `scroll-margin-top: 40px` on
  `.field` boxes, `.unit-in` and `.unit` (the "%"), `.rec-form` and `.records li.rec-form`, `.notice .notice-actions`,
  and in the one reduced-motion line `.fold .fold-chev, .scroll-hint::after { transition: none }` (taps' HC-5
  handoff). Nothing `position: fixed`; no colour outside the tokens.

### M12. Seams with the place and taps tracks (who changes what, in which order, what each gives the other)

**Ownership.** forms owns `core/ui/dom.js` (every function, old and new), `core/ui/checks.js`, `core/ui/undo.js`,
`tests/ui-checks.test.mjs`, `tests/ui-undo.test.mjs`, the base.css blocks of M11, one line of `tools/check.mjs` (the
purity list), the CONVENTIONS section "Forms: asking, checking, answering", and the page adoptions A1 to A5. forms
changes **nothing** in `core/app.js` (no hook in `show()`: the first design's `drawStart`/`afterDraw`/`setStore` are
gone), `core/router.js`, `core/place.js`, `core/taps.js`, `index.html` or `frame.js`.

What forms gives (both place designs already listen for these names):

| # | forms gives | to | exact interface |
|---|---|---|---|
| G1 | the kit (or a page through `ui.reveal`) scrolled on purpose | place | `window` event `planner:reveal`, dispatched by `ui.reveal` right before it scrolls, during a draw or later. Place: during a draw, do not anchor; at any time, end any hold (the return hold, place's re-pin on mutations) |
| G2 | kit nodes and moved notices | place | nodes the kit draws carry `data-kit`; a page notice the kit removed carries `data-moved="kit"` and is removed in the same task the kit's line is inserted. Place's notice put-back / remove shim leaves both alone |
| G3 | a notice with one button | place | `.notice > .notice-actions > button.notice-action` (Undo, or a page's one action). Place's bottom note may offer it first; it is never the only way back, because the notice brings itself into view (M10) |
| G4 | nothing moves between a finger's down and its click | place, taps | the kit draws no words and inserts nothing from `pointerdown` until that gesture's `click` (or 400 ms after `pointerup` / at `pointercancel`) |
| G5 | Return twice saves once | taps | `ui.form` ignores a submit within 800 ms of one that went through (D-TWICE, Enter half; taps' guard does the taps) |
| G6 | errors read out | taps | `role="alert"` on the kit's lines always, on `ui.notice("error")` once per text per page visit; taps' `announce()` skips red notices |
| G7 | reduced motion for the kit's chevrons | taps | `.fold .fold-chev, .scroll-hint::after { transition: none }` in the one reduced-motion line (HC-5), merged by whoever lands second |
| G8 | the kit's listeners first | taps | installed when `core/ui/dom.js` is imported (before `app.js` boots), so they run before the guard's capture listeners; they only note or flush on a click, so a swallowed tap is harmless; a gesture the guard swallows at `touchend` gives no click and the kit's 400 ms timer flushes |
| G9 | no stale message | place | the kit calls `setCustomValidity` only on boxes it built and clears only words it set; a value written by place's typing restore with an `input` event re-checks the box |

What forms needs:

| # | forms needs | from | exact behaviour |
|---|---|---|---|
| N1 | focus after a redraw when the focused control is gone (a closed form's Save, a Remove, Undo) | place | after a keepScroll redraw, when the control that had the focus inside `#content` is not drawn again, focus this redraw's fresh `.notice.ok` / `.notice.error` (`tabindex="-1"`, `preventScroll`) if it is readable; else leave the focus. Closes K4's after-save half. Both place designs have it (place M6 `focusLost`, place2 M3 step 9) |
| N2 | a page (or kit) scroll wins | place | a scroll call during the draw (place counts them with its one wrapper) and `planner:reveal` at any time mean the page wins: no anchor, the hold ends (break critic, blocking 4). Both designs have it |
| N3 | typing put back quietly | place | write `.value`, dispatch `input` (and `change` for choices); never `reportValidity()` (it would speak and move the cursor); `checkValidity()` is silent and safe |
| N4 | focus moves only in a redraw | place | never move the focus on events that are not a redraw (a held Save puts the cursor in the wrong box on purpose; Cancel's return is the kit's) |
| N5 | a held submit is not a save | place | the plan did not change, so place's "let go of the typing" must not run; the form keeps what was typed |
| N6 | one meaning of "Undo" | place | "Undo" is the kit's button for taking back a change to the plan; place's cue for typing says "Undo my typing" (both designs do) |

**Order.** Forms does not touch `show()`. In place's `show()` order (its section 7), the two forms lines (`ui.drawStart()`
before render, `ui.afterDraw()` after restore) are simply dropped; place's anchor condition becomes "the page (or the
kit) did not scroll during the draw and no `planner:reveal` came". With place2 nothing changes (it never called them).
**Apply order:** any; the forms patch shares only `core/ui/base.css` (separate blocks, plus the one reduced-motion line),
`docs/CONVENTIONS.md` (its own section) and `CHANGELOG.md` (one line). The page adoptions (A1 to A5) land after the kit
is on `main` (section 6, the static-site rule).

**Taken from the other tracks.** taps: G5, G6, G7, G8 as asked. place: N1 to N6 as offered. claude-g's kit-wide
`tel`/`email` types (WORKBOARD 22:30): M3. Declined: claude-g's kit-wide `more: true` fold: no finding of these seven
causes needs it; it is the answer to the sweep's D-KEYBOARD-UP breaks (a form's button far below the box) and is listed
for a later kit change (section 3).

---------------------------------------------------------------------------------------------------------------------

## 3. Adoption list (what pages must do)

**Nothing for B1 to B8, B12 to B14.** Every page that uses `ui.form`, `ui.moneyBox` or the browser's checks gets them
with no edit.

**Open findings that need a page edit**, all on claude-b's pages; the page builders who owned them closed their batches
and left them to wave 1 (WORKBOARD: claude-d 19:00 "edit form at its row, Undo ... I leave for wave 1"; claude-g 22:30
and 00:30 "B3 ... folds that shut after a save on rent-vs-buy and renovation"; claude-e 23:30 released PG-RETIRE). They
are wave 1's last steps (A1 to A5 in section 6), built by the forms builder under a claim row naming each file, after
the kit is on `main`:

| # | pages | change | closes |
|---|---|---|---|
| A1 | balance/net-worth, cashflow/expenses, transactions/ledger, transactions/categories, transactions/rules | the row's edit form opens with `ui.openUnder(row, build)` instead of the shared form card + `scrollIntoView`; Cancel and Save call the returned `close()` (Save after its `store.update`; the redraw then draws the list with the row in place); pass `close` to the place track's layer API so Back closes it; rows carry `data-key="<record id>"` | p-transactions-helpers/T9, p-balance/B3 (opening, Cancel, Save), K4 (row half) |
| A2 | retirement/withdrawal-strategy | "Plan on $X a month" through `ui.undoable`; its notice with `{ undo, undone }` in the slot under the hero where the line is drawn today; no 4 s timer for it (done in the evidence tree) | p-retirement-b/x-3 |
| A3 | transactions/categorize | a single pick (and its OK) through `ui.undoable` (the filing, the rename and the rule it writes, in one change); the filed group stays in place for the visit as one done line "Kroger Dayton: filed under Pets (2)." with Undo; no top-of-page line for single picks | p-transactions-helpers/T11 |
| A4 | transactions/duplicates | "Remove the copy" through `ui.undoable`; the pair's place shows "Removed the copy from Oct 7, 2026." with Undo until the person leaves; those lines are drawn above the early "No duplicates" return | p-transactions-helpers/x-duplicates |
| A5 | property/rent-vs-buy, property/renovation (F6, DP-1); property/home, property/rental, property/vehicles (DP-1); scenarios/advisor-plan, scenarios/compare, retirement/annuities (RC-11) | the recipe: the submit sets `pending`; the next render draws "Saved." inside the answer card (or the new item's card), draws the figures fold open on the render that follows its own save, and calls `ui.reveal(card, { block: "start" })`; no timer (done for rent-vs-buy in the evidence tree) | p-debt-property/DP-1, p-cashflow-b-goals/F6, p-retirement-c-scenarios/RC-11 |

**Small follow-ups the kit makes easy (listed, not wave 1's to build):**
- crypto (:136-137), employer-stock (:127/:152), retirement/contributions (:314), career/business (:141), property/rental
  (:168): a refusal about one box can become `return ui.fieldError(box, words)` so that box is outlined and gets the
  cursor (person critic, should-fix 3; the kit already brings the words above the button with no edit).
- balance/update and household/people restore a whole copy of the plan on Undo (they would take back another tab's
  change made in between): switch to `ui.undoable`.
- Hand-built `type="number"` what-if boxes (capital-gains :54, brackets :51, credit-cards months and fee,
  estate/beneficiaries share): `ui.numberBox` if the phone check H2 shows Safari saving "12..5" as nothing.
- A kit-wide `more: true` fold for long forms (claude-g's ask; D-KEYBOARD-UP).

**claude-a's pages** (handoff lines only; a shell or kit fix helps them, a page edit may not): taxes/documents' Remove
asks first (INV-2, p-taxes/x-4: still one tap at fa2026e :56); goals/vehicle and goals/charitable take the A5 recipe
(F6); taxes/documents' "Write what the document is first." already moves above its button with no edit.

---------------------------------------------------------------------------------------------------------------------

## 4. Risks (what could be worse than today) and the exact checks

| # | risk | the check |
|---|---|---|
| R1 | The iPhone dispatches `invalid` differently: a bubble still shows, or a box is left out of the pass, or the keyboard does not come up on the wrong box. The focus is called inside the tap's own event (the `invalid` dispatch happens during the click's activation), so the keyboard should come up. | Phone try-list items 1, 2, 4 (section 5). If a bubble shows or a submit goes through, the fallback is ready: `novalidate` on `ui.form` and the same walk over `form.elements` reading `validity` in the submit wrapper (about 10 lines, the first design's M2), the listener kept for hand-built forms. |
| R2 | `checkValidity()` wrapping breaks a caller that expects `invalid` from it. | grep at the tip: no page listens for `invalid` itself; `qa/touch-sweep.mjs` listens in the capture phase and still sees every event (the wrapper only stops the kit's drawing). |
| R3 | A page's `input` listener clears a kit box's words and the form goes through with "12..5". | The submit click puts the kit's words back first (M2); X1 health and tax-lots patterns; a node test with a fake box; D-WRONG on Tax lots. |
| R4 | A page reads a number box by hand and gets NaN from "1,200" or "5%" (tax-lots :84/:93, allocation :96). | The box writes the plain number back on `change` and at submit (M3). grep `Number(.*\.value)` / `elements\.` on kit boxes at the tip; D-KIND on Tax lots and Allocation ("1,200" saved as 1200). |
| R5 | The ceiling or the date floor refuses a real figure. | Every edit form re-sent with its saved values on every qa household (`m-net`-style census): never held by a ceiling or a date floor; pages that need more pass `max: null` (crypto 1e10, health 1e6 already pass their own). |
| R6 | Return skipping choice lists surprises a desktop user who wants to save from a box above a required choice. | The engine then holds the form at the choice with "Choose one first." (M2); D-ENTER accepts "moved on or saved". |
| R7 | The Cancel return brings back the wrong row. | It returns only to the same node, the one same `data-key`, or the same place in a list that reads the same row for row; `tests/ui-checks.test.mjs` (re-sort, rename, a row gone, twins); X3 (rename and re-sort: nothing moved). |
| R8 | The place track holds the screen after a page's late `ui.reveal` (break critic, blocking 4). | `planner:reveal` ends every hold (N2, both designs). On the merged build: a save whose answer is drawn 1 to 3 s later and revealed (Monte Carlo, Advisor's plan) stays on screen 5 s later; X5 and X6 re-run on the merged build. |
| R9 | `npm test` breaks (view tests drive `ui.form` in the stand-in document). | Boxes are built and read the same way there; no document listener is installed. The evidence tree's full `npm test` (`out/fin-npm-test.log`): 189,280 tests, 188,637 pass, 1 fail, 3 skipped, 639 todo (the tip's own known-gap markers). The one failure is the ledger speed test ("well under 1.5 s"), run while browsers were measuring; alone it passes, 37 of 37. |
| R10 | Cost per tap. | The click note reads the page's kit forms (a handful) and one list's row words (at most 300 rows, else no note). D-TIME on the ledger (1,000 rows) before landing. |
| R11 | Static site: a new page calling `ui.undoable` / `ui.openUnder` / `ui.reveal` meets the old `dom.js` on the phone. | The kit lands, and `main` moves (with `tools/main-gate.mjs`), before any adoption commit; `npm run skew` on the kit step. |
| R12 | Undo takes back more than its tap (another tab, the guesses' refresh). | The change list is worked out inside the update (M10); node tests: another tab's account and balance kept; Undo twice does nothing; Undo after leaving the page does nothing. |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari (and the home-screen app)

- **Interactive validation.** Safari shows its own bubble since iOS 10.3 on a form without `novalidate`; `invalid`
  is cancelable and the kit cancels every one. WebKit fires `invalid` on every failing box of a submit, then reports
  the first uncancelled one; with all cancelled it reports none and does not submit (H1).
- **Focus and the keyboard.** `focus()` raises the keyboard only inside a user gesture. The wrong box is focused inside
  the tap's own `invalid` dispatch (keyboard up: wanted). A keyboard open (B7) is a key event (a gesture). A touch open
  focuses nothing.
- **The keyboard covers about 336 px**, and with it up Safari scrolls the visual viewport inside the layout viewport:
  `ui.reveal` reads `visualViewport.offsetTop` and `height` for "on the screen".
- **`enterkeyhint`** (iOS 13.4 and later) labels the key "next" / "done"; set when the form is built and again on focus.
  The number pad has no Return: B6 applies to text, phone and email boxes there.
- **`inputmode="decimal"`** shows the decimal pad: no minus and no "%" (as today); the "%" is drawn in the box.
- **Date boxes** open the wheel; Safari ignores `min`/`max` in the wheel, so the floor and "today" are checked by the
  engine at Save.
- **No scroll anchoring**: `steady()` keeps the buttons and the box being typed in still by hand.
- **Home-screen app**: no browser bar; the kit reads `#topbar` and `visualViewport` every time, no fixed numbers.
- **`window.confirm`** works in Safari and in the home-screen app (B15).

**Try-list for the owner** (iPhone, `?sandbox=1`, about ten minutes):
1. Income > "+ Add another income", tap Add income with nothing typed: the "What is it" box is under the top bar, the
   cursor in it, the keyboard up, "Fill this in first." under it, and no grey bubble.
2. Income: type 150 in "Yearly raise", tap Add income: "Use a number from 0% to 100%." under the box; type 3: it goes.
3. Gifting: type Sam in "To whom", press the keyboard's "next": the cursor goes to Amount and nothing is saved; type
   500 and tap Add gift.
4. Update my balances: type "abc" in a balance, tap Save: words under that box, its label showing, no bubble.
5. Your home: type 2099 in "Year you bought it", tap Save twice: one red line right above Save, still there a minute
   later; Save did not move.
6. Net worth: Edit an account low on the page, then Cancel: you are back at that account, in the middle of the screen.
7. Pay off debts: type "50.." in "Extra each month" (two dots): nothing red while typing; tap Save plan: words under the
   box; your saved extra is still there.
8. (After A2) How much to take out: tap "Plan on $X a month" with it in the middle of the screen: the green line and its
   Undo are on the screen; tap Undo: your figure is back.
9. Contacts > Add someone: Phone brings the phone keypad, Email the email keyboard.
10. Repeat 1 and 6 from the home-screen app, once with Reduce Motion on.

**Must be seen on the real phone** (Chromium only here): H1 (no bubble, every box in the pass, the keyboard on the
wrong box: items 1, 2, 4); H2 (a hand-built `type="number"` box holding "12..5": does Safari save nothing? decides the
`ui.numberBox` follow-up); H3 (the key reads "next" on the first box: item 3).

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each verifiable alone; the same list as `steps.json`)

Every step: `npm run registry && npm test` (0 failures; the two speed tests that flake under load are re-run alone),
`npm run check`, `node tools/leak-guard.mjs --worktree`, one CHANGELOG line ("- [builder:claude-b] ..."), CONVENTIONS
updated for what the step adds. Measure each step against two servers from the same tip: the tip, and the tip plus the
step (no switch in the code). The touch sweep (`qa/touch-sweep.mjs`, from `$SP/wtouch` until it lands; name its commit
in the step's log) on goals/goals, cashflow/income, household/contacts, estate/gifting, balance/net-worth,
property/home, property/vehicles, debt/payoff x family, renter: no new break.

- **F1** `core/ui/checks.js` + `tests/ui-checks.test.mjs`; `tools/check.mjs` purity list. Check: the 7 tests (fail
  before, pass after).
- **F2** `core/ui/undo.js` + `tests/ui-undo.test.mjs` (source noted in both headers). Check: the 11 tests.
- **F3** The engine (M2, M5, M11's words): the `invalid` listener, the silent `checkValidity`, the finger-down hold,
  leaving words, `steady`, `ui.fieldError`, `reveal` (internal), the base.css form lines. Check: X1 goals, income 150,
  employer-stock, crypto, health, update, payoff; D-WRONG, D-FOCUS-KEPT.
- **F4** Boxes (M3): `ui.numberBox`, `readForm` with `readNumber`, money ceiling and sign, the words in validity with
  the submit-click refresh and the plain number written back, date floor and today, tel/email, `missing`, `.unit-in`.
  Check: X1 income 2.555 and 1,200; D-KIND, T-KEYBOARD; the R4 grep at the tip; a fake-DOM view test that types "1,200"
  in a number box and reads 1200.
- **F5** The submit wrapper (M4): 800 ms, refusals brought above the buttons, the count line, `resetAfter`. Check: X7
  home twice, vehicles, renovation; D-TWICE (Enter half).
- **F6** Return (M6) in kit forms and boxes in no form. Check: X7 contacts and net worth key walk; gifting; D-ENTER.
- **F7** The click note, keyboard open and Cancel (M7) and `ui.openUnder` (M9). Check: X2/X3/X7; T-CANCEL;
  `tests/ui-checks.test.mjs` locate cases.
- **F8** `ui.reveal` exported, `planner:reveal`, `ui.notice(kind, text, { undo | action })`, `role="alert"` once per
  visit, `data-kit`, `ui.undoable`, `ui.undoneWords`, the notice CSS and the reduced-motion line. Check: node undo tests;
  a fake-DOM test that `notice("ok", t, { undo })` draws one "Undo" button; X5 on a page copy.
- **F9** docs/CONVENTIONS.md section "Forms: asking, checking, answering"; the TEAM claim row names `core/ui/checks.js`,
  `core/ui/undo.js`, `tests/ui-*.test.mjs`, `tools/check.mjs`. `npm run skew`, then `main` moves (pre-push gate).
- **A1 to A5** (after F9 is on `main`; each its own commit and claim row): section 3's table. Checks: A1 `m-edit`-style
  run on the five pages (row on screen after Edit, Cancel and Save; add form typing kept), T9's ledger with 150 rows;
  A2 X5; A3 and A4 a tap then Undo restores the plan exactly (node test on the page's compute of the change); A5 X6 on
  each page, D-SEEN.

**CONVENTIONS gains** (one section, "Forms: asking, checking, answering"): the field options `required`, `missing`,
`whole`, `min`, `max` (`"today"` on a date, `max: null` for money), `type: "tel" | "email"`; `ui.numberBox`,
`ui.fieldError`, `ui.reveal` (+ `planner:reveal`), `ui.openUnder`, `ui.undoable`, `ui.notice(kind, text, { undo,
undone, action })`, `ui.undoneWords`; and the rules: `checkValidity()` is silent, `reportValidity()` and a held submit
speak; a form's refusal is a `.notice.error` the kit brings above the buttons (or `ui.fieldError` for one box), never
removed by a timer; Save is never disabled to say "not yet"; a one-tap change that is not a Remove offers Undo where the
control was; every Remove asks first; a way on is a 44 px button that names its place ("Update balances on Net worth"),
never a link inside a sentence.

---------------------------------------------------------------------------------------------------------------------

## 7. Design log decisions relied on, lanes, and choices made without the owner

Quoted from `docs/DESIGN_LOG.md`:
- 2026-09-15 (Settings): "Rule: every save/add/remove confirms with a green notice; errors are red and say what to do
  next." B1 to B4 carry it to the box and the button; B10 adds the way back to the green line.
- 2026-09-15, Debts round 14: "A) "Edit ›" on each row, the form opens inside the list card, green "Saved X." /
  "Cleared X."" Owner chose A. A1 spreads it with `ui.openUnder`.
- 2026-09-15, Net worth: "Owner chose: A (first visit with no accounts keeps the form open; Edit opens it filled in;
  Cancel folds it)". Cancel still folds the form; the kit only brings the row back.
- 2026-09-16, Pass 4, round 2: "the last sub-44 px tap target in the app, an inline "Update them there." link" ...
  "A) outlined button "Update balances on Net worth"", owner chose A. The CONVENTIONS rule for ways on follows it (the
  first design's 13 px link padding is dropped: it kept a 19 px word in a sentence).
- 2026-09-16, Pass 4, round 1: "buttons on their own line" and "one fold per person, first open, the one just saved
  stays open". Undo sits on its own line; A5 keeps the figures open after their own save.
- 2026-09-15: "Rule: disabled buttons look disabled". The kit never disables Save to say "not yet".
- 2026-11-06: "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own
  buttons)". No error or Undo bar is fixed anywhere.
- 2026-11-06: "Do not undo: the household's view never shows build progress, "soon" pages, or PC / AI helper / sync
  wording". The new words on screen are only M1's sentences, "N boxes need a fix: ...", "Undo", "Back to ... as
  before." (the page's own), "What you changed after that was left as it is." and "Nothing to put back: it was changed
  again after that.".

**Lanes.** Files: `core/ui/dom.js`, `core/ui/checks.js` (new), `core/ui/undo.js` (new), `core/ui/base.css` (form and
notice blocks, one shared reduced-motion line), `tests/ui-checks.test.mjs`, `tests/ui-undo.test.mjs`, one line of
`tools/check.mjs`, `docs/CONVENTIONS.md`, `docs/TEAM.md` (claim), `CHANGELOG.md`. Then A1 to A5 on claude-b's pages
only. Not touched: `core/app.js`, `core/router.js`, `index.html`, `frame.js`, any of claude-a's folders,
`modules/overview/setup/compute.js`, `modules/retirement/projection/compute.js`, `modules/overview/guesses/estimators/*`.
None of A1 to A5 is in claude-b's retirement-request claim (projection, contributions, goal-seek, sensitivity,
assumptions, reader, import views).

**Choices made without the owner** (each the conservative one; F9 records them in DESIGN_LOG under 2026-11-11):
1. Removes keep asking first (`window.confirm`); Undo is offered only for one-tap changes that are not removes.
2. Undo sits in the page where the control was, on its own line, with no timer; no bar.
3. An empty box says nothing until Save (no red while someone is still filling in a form).
4. Scrolls are instant.
5. A money box refuses a billion or more unless the page says otherwise; dates from 1900.
6. Only whole-number steps are enforced; other steps are hints.
7. Return walks the boxes one types in and skips choice lists and tick boxes; it never saves from a box with another
   box after it.
8. No keyboard pops up when a form is opened with a touch.
9. Number boxes keep the decimal pad (as today): a negative cannot be typed on an iPhone (as today).
10. Nothing moves to the "answer" by itself after a save: a page asks for it (`ui.reveal`) on the pages that answer a
    question (A5); the place track keeps the place everywhere else.

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (55 findings), with status on fa2026e

Closed on the branch = a wave-2 commit closed it in the page (commit named); the kit still makes those pages speak the
same way. Kit = this design alone, no page edit (measured where a case is named). Adopt = needs A1 to A5 (section 3).

| finding | sev | status on fa2026e | closed by | measured |
|---|---|---|---|---|
| j-fat-fingers/FF1 | 4 | open | kit (M4) | X1/X7 home |
| p-debt-property/DP-2 | 4 | message open (required boxes in f8d44ee) | kit (M4, M2) | X7 vehicles; home |
| p-debt-property/x-2 | 4 | closed (f8d44ee: cost and price required) | kit speaks it (M2) | X1 renovation |
| p-insurance-estate/IE-2 | 4 | closed (7b96857) | kit ceiling (M3) as the net | node tests |
| p-investments/x-2 | 4 | message open | kit (M4); `ui.fieldError` follow-up for the box | X1 (employer-stock path), section 2 M4 list |
| j-debt-fixer/D2 | 3 | closed (33c65fd) | kit speaks it (M2) | X1 payoff |
| j-fat-fingers/FF5 | 3 | open | kit (M2) | X1 goals |
| j-heavy-waiting/W6 | 3 | closed (f8d44ee, 94e186f) | kit: steps are hints (M3) | node tests |
| p-career-household-system/F3 | 3 | open | kit (M2, M4 count, M5) | X1 goals (2 boxes) |
| p-debt-property/DP-4 | 3 | closed (33c65fd) | kit speaks it (M2) | section 2 M2 |
| p-insurance-estate/IE-4 | 3 | open | kit (M2 words, M3 "%") | X1 income 150 (same box kind) |
| p-investments/INV-3 | 3 | open | kit (M2) | X1 |
| p-retirement-c-scenarios/RC-1 | 3 | closed (595acea) | - | - |
| p-retirement-c-scenarios/RC-4 | 3 | closed (94e186f) | kit: coarse-step words if a step returns (M1) | node tests |
| p-retirement-c-scenarios/RC-2 | 3 | closed (595acea) | - | - |
| p-career-household-system/F7 | 2 | closed (f8d44ee) | kit `tel`/`email` (M3) | - |
| p-cashflow-a/CF-7 | 2 | open | kit (M2, M3) | X1 income 150, 2.555 |
| p-investments/INV-10 | 2 | closed (b7cfdd2) | kept by the engine (M2) | X1 employer-stock, crypto |
| p-retirement-a/R-A10 | 2 | closed (f80661e, 239a719) | kit ceiling as the net | node tests |
| p-taxes/T6 | 2 | open | kit (M2, M5, `scroll-margin-top`) | X1 update (label shown) |
| p-transactions-helpers/T7 | 2 | closed (6b99713) | - | - |
| p-career-household-system/x-2 | 3 | open | kit (M6) | X7 contacts |
| p-insurance-estate/x-2 | 3 | open | kit (M6) | gifting (try-list 3) |
| j-first-freelancer/F6 | 2 | open (Android) | kit (M6) | D-ENTER |
| p-taxes/T2 | 2 | open | kit (M6) | X7 net worth key walk (same mechanism) |
| p-transactions-helpers/T9 | 4 | open | A1 (+ kit M7, M9) | after A1 |
| j-keyboard-reader/K4 | 3 | open | kit (M7 open and Cancel) + place N1 (after save) | X2, X3 |
| p-balance/B3 | 3 | open | kit (M7 Cancel) + A1 (open and Save) | X3 |
| p-investments/INV-5 | 3 | closed (b7cfdd2) | - | - |
| p-transactions-helpers/x-halfform | 3 | closed (33bda60) | A1 keeps the add form's typing | - |
| p-cashflow-b-goals/F3 | 4 | closed (7c5c1d8: asks first, Hidden card) | - | - |
| p-investments/INV-2 | 4 | closed except taxes/documents (claude-a, handoff) | rule B15 | - |
| p-cashflow-b-goals/x-4 | 3 | closed (f8d44ee: "Put back my amounts") | `ui.undoable` follow-up | - |
| p-retirement-b/x-3 | 3 | open | A2 (+ kit M10) | X5 |
| p-taxes/x-4 | 3 | closed for capital gains (cf6e101); documents claude-a's | handoff | - |
| p-transactions-helpers/T11 | 3 | open | A3 (+ kit M10) | after A3 |
| p-transactions-helpers/x-duplicates | 3 | message closed (8373f97), no way back | A4 (+ kit M10) | after A4 |
| j-first-retiree/R4 | 2 | closed (f80661e) | - | - |
| p-balance/x-4 | 2 | closed (f8d44ee) | - | - |
| j-keyboard-reader/x-redraw-on-change | 3 | closed (33c65fd, cf6e101) | kit G4 keeps it so | - |
| p-debt-property/x-1 | 3 | closed (33c65fd) | - | - |
| p-taxes/x-3 | 3 | closed (cf6e101) | - | - |
| j-one-answer/A1 | 4 | closed (cf6e101, f8d44ee, 94e186f) | - | - |
| p-debt-property/DP-1 | 4 | open | A5 (+ kit M8) | X6 (rent-vs-buy) |
| p-cashflow-b-goals/F6 | 3 | open for rent-vs-buy and renovation (house closed in f8d44ee); vehicle and charitable claude-a's | A5; handoff | X6 |
| p-investments/INV-7 | 3 | closed (b7cfdd2) | - | - |
| p-retirement-c-scenarios/RC-11 | 3 | open | A5 | after A5 |
| p-cashflow-a/x-3 | 2 | closed (7c5c1d8) | - | - |
| p-retirement-a/R-A9 | 3 | closed (f80661e) | CONVENTIONS rule | - |
| j-fat-fingers/FF8 | 2 | closed (33c65fd, a23d589) | - | - |
| p-balance/B8 | 2 | closed (33c65fd) | - | - |
| p-career-household-system/F8 | 2 | closed (f8d44ee) | - | - |
| p-overview-home/OV-5 | 2 | closed (38bc38f, 5c6246f) | - | - |
| p-retirement-b/RB3 | 2 | closed (f80661e) | - | - |
| p-retirement-c-scenarios/RC-10 | 2 | closed (94e186f) | - | - |

Open on fa2026e: 22 (with DP-2 and p-investments/x-2's message parts and x-duplicates' way back). Closed by the kit
alone: 15 (FF1, DP-2, p-investments/x-2, FF5, F3, IE-4, INV-3, CF-7, T6, career x-2, insurance x-2, F6 freelancer, T2,
K4 with place N1, and B3's Cancel half). Closed with A1 to A5: T9, B3, x-3, T11, x-duplicates, DP-1, F6, RC-11.
claude-a handoff: taxes/documents' Remove, goals/vehicle and goals/charitable (F6).

---------------------------------------------------------------------------------------------------------------------

## 9. Answers to the critics

### Break critic (`critique-break.md`)

**Blocking 1, the row locator guesses and glows the wrong account: changed.** The glow and every return after a Save
are gone (M7). Cancel returns only to the same node, the one same `data-key`, or the same place in a list that reads the
same row for row (`sameRowIndex`, pure, tested with a re-sort, a rename, a removed row and twins). Evidence: X3 net
worth, "Chase checking" renamed "Chase everyday" at 52,000 (7th -> 3rd), Save by touch: no row glowed or focused
(`out/x2-x3.json`); Cancel on Ally savings returns the right row (395, focus on its Edit). Pages that adopt A1 put
`data-key` on rows and keep the row next to its form, which is what the Save half needed.

**Blocking 2, the do-nothing net blames an optional box after a confirm answered No: changed (cut).** The net's three
findings are closed in the pages (renovation/purchase mark their amounts `required` in f8d44ee; RC-1 595acea; T7
6b99713), so the net has nothing left to do, and the engine now speaks for those required boxes (X1 renovation: "Type an
amount first." at the cost box). With no net, Rental's "is Lake cabin really this rental?" answered No leaves the form as
it is, as today.

**Blocking 3, a keyboard press on a chip hands the cursor to another form: changed.** A form is "opened" by a click only
if its identity (submit words, section heading, first label) was not on the page before the click, and only the first
such form (M7). X2: Enter on "+$25,000" with the sale form open: scroll 0, focus on the chip, nothing typed into the form
(was 586 px and "5" typed in); Enter on "+ Add another income" still puts the cursor in "What is it" ("Side gig" typed).

**Blocking 4, place's hold puts the screen back after a late `ui.reveal`: changed (contract) and checked on paper
against both place finals.** `ui.reveal` always dispatches `planner:reveal` before it scrolls; N2 asks that it end every
hold at any time, and that a scroll call during a draw means the page wins. Place's final M5 ("Anchoring stops at ...
`planner:reveal`") and place2's final M2 (the hold "ends ... at the kit's `planner:reveal`") both do. The kit makes no
other move outside a tap's own event (the wrong box) or Cancel (both trusted events that end place's hold anyway). R8
re-runs X5/X6 and a late-answer page on the merged build.

Should-fix, taken: 1 (words red and boxes outlined outside a `.field`: X1 update, red 600 and red edge); 2 (Undo works
once and only on the same page; the page draws it once); 3 (the change list is worked out inside the update: another
tab's save and the guesses' refresh are not in it); 4 (the snapshot clones are gone with `afterDraw`; the click note
reads at most one list of 300 rows); 5, 6, 10, 13, 14, 15 (moot: `afterDraw`, `after`, `[data-answer]`, the keyboard-
save guess and the `app.js` hooks are gone; answers are asked for by the page, A5); 7 (`visualViewport.offsetTop` is the
top edge in `reveal`; try-list adds the keyboard-up case through H1); 8 (`ui.numberBox` exported; the hand-built boxes
are a follow-up gated on phone check H2); 9 (moot: `ui.later` is cut, its three findings are closed in pages); 11 (red
notices read once per visit; the kit's lines always); 12 (`ui.openUnder`'s `close` goes to the place track's layer API
in A1).

### Person critic (`critique-person.md`)

**Blocking 1, Undo out of sight after the tap and dropped by the bottom note: changed.** A notice carrying Undo brings
itself into view with the least scroll once it is on the page (M10), the recipe draws it where the tapped control was,
and the Undo is on its own line, never inside a sentence beside another link (`.notice-actions`); the link padding that
covered it is dropped. The bottom note may carry it (G3, both place designs proxy it) but is never the only way back.
The two pages measured in the first draft (prioritizer, liquidity) were redone by wave 2 (f8d44ee); measured instead on
withdrawal-strategy (A2), with the button swiped to the middle of a 390 x 664 and a 390 x 844 screen: `out/x5-undo.json`
and section 2 M10.

Should-fix, taken: 1 (the double tap: the Undo sits under the words, on its own line, not under the tapped spot; taps'
guard swallows a second tap within 40 px and 800 ms after a change: dependency named in G8); 3 (the refusal is above the
button with no edit; outlining the box is the `ui.fieldError` follow-up in section 3); 4 (B6 says text, phone and email
boxes; try-list 3 taps Add gift; `enterkeyhint` is set when the form is built); 5 (Return walks into the notes box and
never skips to a box gated by a tick box: X7 contacts); 6 (the padding is dropped, `ui.goTo` too; the rule follows the
owner's "action + place" pattern); 7 (semicolons); 9 (the question-verb regex is cut); 10 (A5 draws "Saved." inside the
answer card, X6).
Declined: 2 (what-if answers stale while the next box is open): the three what-if pages now redraw only their answer
holder on each change (33c65fd, cf6e101), as the critic asked; `ui.later` is cut. 8 (the letter keyboard on "Value grows
each year"): taken the other way: number boxes keep the decimal pad, so nothing gets worse than today; the missing minus
is listed as choice 9.

### Scope critic (`critique-scope.md`)

**Blocking 1, planned against c385e41 while wave 2 closed 33 of 55: changed.** Rebuilt and measured on fa2026e (`fin`);
sections 2, 3 and 8 are cut to what is open there (22 findings). Cut with no open finding to serve: the do-nothing net,
`ui.later`, `ui.goTo`, the notice-link padding, `ui.check`, `afterDraw`'s target rules. Kept and why: `ui.undoable` and
`undo.js` serve three open findings (x-3, T11, x-duplicates), each a one-tap change whose hand-written undo would repeat
the whole-plan-copy pattern wave 2 already used twice (and which loses another tab's change); `ui.reveal` serves DP-1,
F6 and RC-11 and gives the place track one event to stand down on; `ui.openUnder` serves T9 and B3.

**Blocking 2, `novalidate` undoes wave 2's own checks: changed (the engine is the browser's validity).** X1: employer-stock
"acme!!" and crypto 2099 are held with the pages' own words at the box, not saved; Health's `reportValidity()` gives one
line at the box and no bubble. The critic's reason against the first design's rejection holds: one submit fires `invalid`
on every failing box (X1 goals: 2 events, 2 lines; health: 5 events, 1 line where the page's own check was the last).

**Blocking 3, `npm test` never runs the phone's kit: changed.** Boxes are built and read the same way in Node: number
and percent boxes are text boxes read by `readNumber` there too ("1,200" reaches `onSubmit` as 1200 in a fake-DOM test,
F4's check); only document listeners are absent. The decisions are pure in `checks.js` with node tests
(`validityWords`, `boxWords`, `readNumber`, `summaryWords`, `sameRowIndex`, `keyHint`), and `undo.js` likewise.

**Blocking 4, no step's gate can run: changed.** With the browser's validity as the engine the touch sweep needs no
adapter (it reads `invalid` events, which still fire; the R5 adapter of the first design is dropped). Each step names
the sweep copy and commit it runs (section 6), and kit steps are gated by kit-only checks (X1, X2, X7, node tests); the
page recipes are gated in A1 to A5.

**Blocking 5, five findings with no owner: changed.** T9 (A1), T11 (A3), x-duplicates (A4), retirement-b/x-3 (A2) and
F6's "the figures stay open" half (A5, with DP-1 and RC-11) are wave 1's last steps on claude-b's pages, under claim
rows, after the kit is on `main`; the WORKBOARD lines that left them to wave 1 are quoted in section 3.

**Blocking 6, the contract with place is one-sided and for one place design: changed.** M12 names the seams as events,
attributes and calls (`planner:reveal`, `data-kit`, `data-moved="kit"`, `.notice-action`, N1 to N6) that both place
finals already list (place final section 7 "Place gives forms"; place2 final S8 to S12). Forms no longer touches
`show()`, so the order question disappears: place's two forms lines in `show()` are dropped and its anchor condition
reads the scroll calls and `planner:reveal`. `ui.later` is cut, so place's own rule is the only "wait while typing" rule.

Should-fix, taken: 1 (claim names the new files and `tools/check.mjs`; `.kit-glow` is gone; A2 of the first design,
dropping the home and mortgage timers, is dropped: the mover takes the node first, X7 home); 2 (no switch or probe on
the branch; each step measured with two servers); 3 (moot: `afterDraw` is gone; a page that scrolls itself still wins);
4 (kit steps gated by kit checks); 5 (the plain number written back on `change` and at submit; the R4 grep; D-KIND on Tax
lots and Allocation); 6 (`tools/check.mjs` purity list); 7 (the hidden expected value is gone: `ui-checks.test.mjs`
writes its strings plainly); 8 (R2 moves to the phone try-list as H1); 9 (taps' HC-5 reduced-motion line taken, G7;
claude-g's `more: true` declined with the reason, M12); 10 (every `file:line` refreshed at fa2026e); 11 (forms adds no
`app.js` hook; adoption commits land after the kit is on `main`, `npm run skew` on F9); 12 (A1 and cashflow-a/x-3 are
closed in pages; no kit claim; DP-1, F6, RC-11 move to A5 and are re-measured with place merged, R8).
