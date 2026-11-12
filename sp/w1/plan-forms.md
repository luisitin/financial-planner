# Wave 1, question "forms": form controls and answers (the judged plan)

Errors at the box, Enter, edit at the row, Undo, live boxes, answers into view, real buttons.

The owner's request (2026-11-11), verbatim: "Be extensive and use tons of agents to stress test every single touch and
input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy
to know next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."

`$SP` = `$SP`.

**Chosen: design A (`$SP/w1/forms/final.md`) as the base, with six small parts taken from design B
(`$SP/w1/forms2/final.md`) and one correction found while judging.** Each borrowed part is named where it lands and
listed in section 9. This file stands alone: a builder needs only it, `plan-forms-steps.json` beside it, and the seven
theme files `$SP/ux/synth/themes/UI-{ERR,ENTER,EDIT,UNDO,LIVE,RESULT,TARGET}.md` (55 findings).

**Base.** Branch `claude/creative-build-b531q0`, tip **ee09f6e**. `core/ui/`, `core/app.js`, `core/router.js` and
`index.html` are byte-identical at d22b718 (B's base), fa2026e (A's base) and ee09f6e (the three commits after fa2026e
touch only `core/estimate/`), so both kits apply unchanged. The builder builds on whatever tip the workflow names and
re-runs every grep named here there.

**Evidence (the judge's own, on ee09f6e).** `$SP/w1/judge-forms/`: `today/` (ee09f6e untouched), `A/` (ee09f6e + A's
kit: `core/ui/dom.js`, `core/ui/checks.js`, `core/ui/undo.js`, `core/ui/base.css`, two node test files), `B/` (ee09f6e +
B's kit: `core/ui/dom.js`, `core/ui/undo.js`, `core/ui/base.css`, two node test files). Both kit trees carry the **same**
three page edits so that the pages measure the kits, not the recipes: net worth's edit under the row (`ui.openUnder`),
rent-vs-buy's answer brought into view (`ui.reveal`), withdrawal-strategy's Undo (`ui.undoable`). Scripts:
`scripts/jlib.mjs` (real touch taps at a control's centre, real finger drags to find it, typing key by key at 70 ms,
450 ms between actions, keyboard journeys with touch off), `scripts/journeys.mjs` (23 journeys), `scripts/cost.mjs`.
Results: `out/all-journeys.jsonl` (90 records), `out/npm-test-{A,B}.log`, pictures in `shots/` (`cmp-J3.png`,
`cmp-J7.png` side by side). Served on 127.0.0.1:9405 (A), 9406 (B), 9407 (today), phone 390 x 844 (and 390 x 664),
Chromium, always `?sandbox=1`; all three servers are stopped.

---------------------------------------------------------------------------------------------------------------------

## 1. Behavior (the acceptance test, in a person's words)

Each item: what I do, what I see, what it closes, and its acceptance check (a kit script the builder writes as
`$SP/w1/accept-forms/B<n>.mjs`; `$SP/w1/judge-forms/scripts/journeys.mjs` already drives each case named in brackets and
is the starting point).

**B1. A Save or Add that cannot go through says why at the box.** I tap Save with a box empty or wrong. The screen brings
that box up under the top bar with its name showing, the cursor is in it, the box has a red edge, and right under it a
red line says what to type: "Fill this in first.", "Type an amount first.", "Use a number from 0% to 100%.", "A symbol is
letters, like ACME." (a page's own words), "Pick a date that is not in the future.". No grey bubble. The line stays until
the box is right and goes the moment it is. When more than one box is wrong, a red line right above the buttons says
"2 boxes need a fix: What are you saving for; Amount needed." and counts again as I fix each one. Nothing I typed is lost.
Closes j-fat-fingers/FF5, p-career-household-system/F3, p-investments/INV-3, p-taxes/T6 (Save half),
p-cashflow-a/CF-7 (words), p-insurance-estate/IE-4 (words). [J1 goals, J2 income 150, J10 update "abc", J11 vehicles,
J12 employer stock: today grey bubbles in all five (label hidden on J10/J11); A and B: words at the box, in view, red,
label shown, cursor in the first wrong box, 0 bubbles]

**B2. Leaving a box I typed wrong says so once my tap has landed; the tap is not lost and the box I am now in does not
move.** I type 150 in a 0-100 box and tap the next box: the next box takes the cursor and stays where it was; then the
red line appears under the box I left. An empty box says nothing until Save. While I type, a page that quietly checks
the box (Pay off debts' preview) draws nothing. Closes p-taxes/T6 (leaving half), p-career-household-system/F3 (leaving
half). [J2: next box moved 0 px, focus on Starts, "Use a number from 0% to 100%." in view; J9 payoff "50..": nothing
while typing, the tap on Order lands (0 px), words under Extra after it; today: no words on leaving]

**B3. When the page itself refuses, its message is right above the button I tapped, once, and the button stays under my
thumb, tap after tap.** "2099 is still ahead. Type the year you bought it, or leave it blank." appears directly above
Save; a second tap does not stack a copy and does not move Save; it stays until my next try (no 6-second timer). Closes
j-fat-fingers/FF1, p-debt-property/DP-2 (the message), p-investments/x-2 (the message). [J3 home, two taps then 7 s:
today the line is 1,577 px above the screen and gone at 7 s; A one copy at 668 px, Save 751 -> 751 -> 751, still there
at 7 s; B Save 751 -> 751 -> **668** (83 px up under the thumb on the second tap). J13 contributions "abc": today Save
662 -> 749 and the line at the top of the form; A and B 662 -> 662 -> 662, line at 579 px]

**B4. Every form speaks the same way, the hand-built ones and boxes in no form too.** Update my balances, Credit cards,
Pay off debts, Calendar, People, Health, Holdings, Tax lots, Employer stock and Crypto answer as in B1 with no change to
those pages. [J9, J10, J12]

**B5. A real figure is taken as typed; an impossible one is stopped at the box.** "1,200", "11,200", "2.555" and "5%"
are taken; a percent box shows "%" inside it; a whole-number box says "Use a whole number, like 12."; "12..5" says
"Type a number, like 12." in every browser; an amount of a billion or more says "That is more than a billion: check for
an extra digit."; a year typed as 0026 says "Check the year: type all four digits, like 2026.". Closes CF-7's 2.555,
IE-4's "%" half, and is the net under R-A10 and IE-2. [J2b: today a bubble "...the two nearest valid values are 2.55
and 2.56"; A saved amount 1200 and raise 0.02555 with "%" in the box; B saved 0.025550000000000003, no "%". J11: A shows
"11,200" as typed and saves 11200]

**B6. In a text, phone or email box, Return goes to the next box I type in; only the last box saves.** The key reads
"next", and "done" in the last box. A choice list or tick box in between is skipped (it already holds a value; a picker
wheel popping up from Return would surprise; and Return does nothing on a choice list, so a keyboard user would be
stuck there); a notes box is not skipped. On an iPhone the number pad has no Return (its "Done" only closes the
keyboard); an Android number pad's Go key behaves as Return. Two quick Returns save once. Closes
p-career-household-system/x-2, p-insurance-estate/x-2, p-taxes/T2, j-first-freelancer/F6 (Android). [J4a contacts:
today saved at the first Return; A and B Name -> Firm -> Phone -> Email -> Notes, nothing saved. J4b gifting: today
saved "Gift to Sam" from the second box; A To -> Amount -> Year -> Notes, nothing saved; B To -> Amount -> Year -> From
and four more Returns stay on "From". J4c net worth add with the keyboard: A Name -> Institution -> Balance -> As of
(done), Return twice adds exactly one account; B stops on "Kind of account" and nothing can be saved by Return]

**B7. Opened with the keyboard, a form has the cursor in its first box; a tap opens no keyboard by itself; a key on a
chip does not hand the cursor to some other form.** Closes j-keyboard-reader/K4 (opening half). [J5a: Enter on "+ Add
another income": today focus on nothing and "Side gig" lost; A and B cursor in "What is it", "Side gig" typed there.
J5b a tap: no focus in all three. J5c Enter on Capital gains' "+$25,000" chip with the sale form open: scroll 0, focus
on the chip, nothing typed into the form, in all three]

**B8. Cancel takes me back to the row I came from, when the app knows the row for sure.** The row comes to the middle of
the screen if it is off it, and the focus is on its Edit. If the list is drawn differently (re-sorted, renamed, a row
gone), nothing moves: no guess. Closes the Cancel half of p-balance/B3, p-transactions-helpers/T9 and
j-keyboard-reader/K4. [J6a expenses Groceries: today row at -412 px, focus nothing; A and B 408 px, focus on the row.
J6b income: A and B focus on the row; today nothing. J6d Contacts, a page that draws itself again on Edit and on Cancel
and has no record keys, Edit on the eighth contact then Cancel: today and B focus on nothing; A focus on that row's Edit]

**B9. (pages that adopt it, A1) A row's form opens right under the row; Save and Cancel leave me at the row.** If the
form's first box would be under the screen's edge, the screen moves just enough to show the row and that box. A
half-typed add form elsewhere on the page keeps its typing. Closes p-transactions-helpers/T9 and p-balance/B3 with A1.
[J6c net worth with the edit under the row: today row at -486 px after Edit; A and B row 557-668 px and the first box on
screen, Cancel focus on its Edit, after Save "Ally savings saved." in view]

**B10. (pages that adopt it, A2 to A4) A one-tap change can be taken back from its own green line.** The line is drawn
where the button I tapped was, says what changed, and carries an outlined 44 px "Undo" on a line of its own, on my
screen. It stays until my next change or until I leave the page (no timer). Undo puts back exactly what that tap
changed, leaves alone anything changed since, and says so in the page's words ("Back to $7,000 a month, as before.").
Closes p-retirement-b/x-3, p-transactions-helpers/T11, p-transactions-helpers/x-duplicates with A2 to A4. [J7
withdrawal, "Plan on $6,600 a month" swiped to mid-screen, at 390 x 844 and 390 x 664: today no Undo (line removed after
4 s); A and B line at 511 px, Undo 73 x 44 px at 599-643 on screen, still there after 5 s, Undo puts 7,000 back and
"Back to $7,000 a month, as before." is on screen]

**B11. (pages that adopt it, A5) After Compare, Work it out or Add, the answer is on my screen.** The answer card comes
just under the top bar with "Saved." inside it, the figures stay open below it for the next try, and when the answer is
already on screen nothing moves. Closes p-debt-property/DP-1, p-cashflow-b-goals/F6 (rent-vs-buy, renovation),
p-retirement-c-scenarios/RC-11 with A5. [J8 rent-vs-buy, renterDebt, Compare at 350,000 then 420,000: today the card
375 px above the screen and the figures shut; A and B card top 64 px both times, "Saved." inside, figures open]

**B12. Nothing the kit draws moves anything between my finger going down and its click.** (touch rules D-FOCUS-KEPT,
D-SCROLL-KEPT) [J2 next box 0 px, J9 Order 0 px]

**B13. With VoiceOver, the words are read with the box.** A wrong box is marked invalid and its words are its
description; the line above the buttons is read once at the refusal (`role="alert"`); a red notice a page draws on every
redraw is read once per visit, not after every save. Closes the error half of j-keyboard-reader/K5 (taps track's handoff).

**B14. Phone and email boxes bring up the right keyboard** (`type: "tel"` / `"email"` in `ui.form`). F7 is closed on the
branch by Contacts itself; the kit makes it one word for any page.

**B15. Every Remove asks first, naming what goes** (`ui.confirm`, as 46 places do). Rule only; INV-2 and p-taxes/x-4 are
closed on the branch except taxes/documents (claude-a's: handoff line, section 3).

**Touch rules** (`$SP/wtouch/qa/touch-rules.json`) these turn green or keep green: D-WRONG (B1, B3, B4, B5: the sweep
reads `invalid` events, which still fire), D-KIND (B5: "1,200", "$1,200.50", " 300 ", "5%"), D-ENTER (B6), D-TWICE (B6's
Enter half; taps' guard does the taps), T-KEYBOARD (B14), T-CANCEL (B8), D-FOCUS-KEPT and D-SCROLL-KEPT (B2, B3, B12),
D-UNDO (B10 on the adopted pages), D-SEEN (B10, B11 with the adoptions).

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

All in `core/ui/dom.js` plus two pure files: `core/ui/checks.js` (the words and decisions) and `core/ui/undo.js` (a
change and its way back). CSS in the form and notice blocks of `core/ui/base.css`. **Nothing in `core/app.js`,
`core/router.js`, `core/search.js`, `index.html`, `modules/overview/guide/frame.js` or any place/taps file.**

Reference code: `$SP/w1/judge-forms/A/core/ui/{dom,checks,undo}.js` and `A/core/ui/base.css` (identical to
`$SP/w1/forms/fin`). That copy carries an evidence-only `?forms=off` switch (`OFF`, and `ON = DOC && !OFF`): the builder
strips every `OFF` branch (`ON` becomes `DOC`); nothing on the branch reads the address for forms.

Every document listener is installed **once, when dom.js is first imported**, and only when `document.addEventListener`
and `document.documentElement` exist (`DOC`); `data-forms-kit="1"` on `<html>` stops a second copy (a framed copy, a
cache-busted import) from installing twice. The view tests' stand-in document (`qa/fixtures/fake-dom.mjs`) has neither,
so it gets no listeners, but boxes are built and read the same way in Node and on the phone (text boxes, `readNumber`):
the tested path is the phone's path. Size after stripping: `dom.js` 143 -> about 505 lines, `checks.js` 103, `undo.js` 93.

### M1. What a box says: `core/ui/checks.js` (pure; `tests/ui-checks.test.mjs`)
- `readNumber(raw, { percent })`: "1,200", " 300 ", "2.555", "-2" (and "5%" in a percent box); null for "12..5",
  "abc", "72k", "$5", blank. `numberText(raw)`: the plain number a box shows after leaving it ("5,000" -> "5000").
- `boxWords(spec, raw)`: the kit's own words for a box it reads itself (money, number, percent) or "": unreadable
  ("Type an amount in numbers, like 4,500.", "Type a number, like 12.", "Type a number, like 3.5 for 3.5%."), whole
  ("Use a whole number, like 12."), range with the unit ("Use a number from 0% to 100%.", "Use 18 or more.", "Use
  $10,000 or less." with the plan's sign), the money ceiling ("That is more than a billion: check for an extra digit.";
  `max: null` lifts it). Years and ages under 10,000 have no comma. Blank says nothing (left to `required`).
- `validityWords(record)`: the words for a box the browser holds back, from a plain record of its state: the box's own
  message first (the kit's, or a page's `setCustomValidity`), then empty ("Fill this in first.", "Type an amount
  first.", "Choose one first.", "Pick a date first.", "Check this box to go on.", "Type a phone number first.", "Type an
  email address first.", or the field's `missing`), bad input, email, ranges (dates: "Check the year: type all four
  digits, like 2026." below the kit's 1900 floor, "Pick a date that is not in the future." against today), steps ("Use
  a whole number, like 12."; a hand-built coarse step "Round it to the nearest 1000, like 1000."), length, pattern (the
  box's `title`).
- `summaryWords(labels)`: "2 boxes need a fix: A; B." with **semicolons** (62 labels hold a comma), the first four names
  and "and more"; "" for fewer than two.
- `keyText(text)` (a row's words without its figures) and `sameRowIndex(before, now, index)`: the row's index when the
  list reads the same row for row, else -1 (M7).
- `keyHint(index, count)`: "next" / "done".
- **Plain-words guard (taken from B, `tests/ui-words.test.mjs`'s last test):** one test in `tests/ui-checks.test.mjs`
  reads every quoted sentence (starts with a capital, ends with "." or ":") in `core/ui/checks.js` and `core/ui/dom.js`
  and refuses PC, server, AI, sync, build, browser, valid, validation, invalid, input, field, value, required, error. It
  keeps the household's view free of builder and form-check words as the kit grows.
- `tools/check.mjs` adds `core/ui/checks.js` and `core/ui/undo.js` to its purity list (no `document`, `window`, timers).

### M2. The engine: the browser's validity, our words (B1, B4)
- **One capture `invalid` listener on `document`.** `invalid` fires on every box that fails when a submit is held (a tap
  on Save, Return, `requestSubmit`), and on `reportValidity()` of a box or a form, in any form or none. The listener
  calls `preventDefault()` (no bubble), draws `validityWords` under the box (M4's `showError`), and for the first box of
  that pass (the browser fires the events in one task; a `setTimeout(0)` ends the pass) clears the form's old red line
  **inside `steady()`** (buttons kept still), brings the box's field under the top bar and puts the cursor in it
  (`focus({ preventScroll: true })`, inside the tap's own event, so an iPhone raises the keyboard). A kit form then gets
  the count line (M4) when two or more boxes are held. Boxes in a `novalidate` form are left alone (Get started, Goal
  seek and Social Security check themselves).
- **`checkValidity()` stays silent.** It also fires `invalid`, and pages call it quietly on every key (Pay off debts,
  Mortgage). The kit wraps `checkValidity` of `HTMLInputElement`, `HTMLSelectElement`, `HTMLTextAreaElement` and
  `HTMLFormElement` once, counting a depth while the original runs; the listener does nothing at depth > 0. So
  `checkValidity()` means "ask quietly", `reportValidity()` and a held submit mean "tell the person".
- **A finger is down: words wait.** From `pointerdown` until that gesture's `click` (or 400 ms after `pointerup`, or
  `pointercancel`), a box that fails is only noted; its words are drawn once the click has landed, and the cursor is
  left where the tap put it.
- **The words go** at the next `input` / `change` that makes the box valid; a page's own words (`ui.fieldError`) go at
  the next change of the box.
- **The kit's words for boxes it reads itself live in the box's validity** (M3), set on `input` before the page's own
  listeners run, and put back at the start of a submit (a capture `click` on a submit button, which Return's implicit
  submission also fires) **without wiping a page's own words**: the kit clears only words it set itself. So a page that
  clears its own message on `input` (Tax lots, Holdings, People, Calendar) cannot clear the kit's "Type a number".
- **`ui.fieldError(box, words)`** for a page's own "no" about one box: `return ui.fieldError(yearBox, "...")` in an
  `onSubmit` draws the words at that box, brings it into view with the cursor in it and keeps the form. The
  `setCustomValidity` + `reportValidity` + `addEventListener("input", ..., { once: true })` pattern wave 2 wrote four
  times (people, calendar, holdings, tax-lots) keeps working; new code uses `fieldError`.
- **Fit.** A held Save makes no `store.update`, so no shell redraw follows and the place track has nothing to do.
  `mendBlockedForms` (`core/app.js`, framed copies) calls `form.reportValidity()`: it now speaks our words. The guide
  frame, sync bar and heal reload are untouched.

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
- **Why not keep `type="number"` (B):** Chromium drops a typed "%" and comma, WebKit's handling of "12..5" is not the
  same, and docs/CONVENTIONS.md already records that a number box "on an iPhone silently saves nothing" (the reason
  money boxes left it). A text box read by our own `readNumber` behaves the same in every browser and is what `npm test`
  exercises. Measured: J2b (section 10).

### M4. The form's own submit (B1, B3, B6)
`ui.form`'s submit wrapper, on a real page (in Node: today's path):
1. **One submit per 800 ms** after one that went through (Return pressed twice, a bouncing finger: the taps track's
   window).
2. Notes the red notices on the page, calls `onSubmit(values)`.
3. **A page's own refusal is brought to the thumb**: a `.notice.error` the handler put anywhere (`form.prepend`,
   `root.prepend`, the top of the page) is marked `data-moved="kit"`, removed, and its words are drawn once as
   `div.notice.error.form-error[role=alert][data-kit]` right above `.form-actions`; the message and the buttons are
   brought into view together with the least scroll. A second refusal replaces the line in place.
4. **The buttons stay under the thumb**: every line drawn **or removed** above the buttons goes through
   `steady(anchor, change)` (read the anchor's screen top, change, scroll back by the difference; Safari has no scroll
   anchoring). Anchor: the box being typed in when the focus is in the form, else the buttons. The old line is never
   cleared before the handler runs (B does that, and Save rose 83 px on the second tap: J3).
5. With no refusal, the last try's red line goes (steady); `resetAfter` resets only a form that went through.
- **The count line** (`.form-error.kit-count`): `summaryWords` of the held boxes' labels, drawn after the invalid pass
  when two or more are held, counted again as each is fixed, gone below two.
- **Fit.** At ee09f6e the refusals that still prepend out of sight are home :130, rental :168, vehicles :101,
  crypto :136-137, employer-stock :127/:152, career/business :141, contributions :314 (and taxes/documents :72,
  claude-a's, helped with no edit). Equity and budget-percent scroll their own; the kit moves theirs too. The pages' own
  6-second removal timers find their node already gone (no page edit needed).

### M5. Leaving a box (B2, B12)
A capture `focusout`: a box that holds something that cannot be used (bad input, the kit's words, a range; not empty)
gets its words once the tap that left it has landed, drawn with `steady(the box now focused, ...)`, so the box being
typed in does not move. A box in no form with only a step problem says nothing (a what-if box no Save checks).

### M6. Return and the keyboard's key (B6)
- **In a kit form**: Return in a one-line box (text, number, money, percent, date, tel, email) moves to the next box a
  person types in (a one-line box or a notes box) and is stopped there (`preventDefault`); in the last such box the
  browser's implicit submit runs, and M2 with it. Choice lists and tick boxes are skipped. `enterKeyHint` is set when
  the form is built and again on `focusin` (a box shown later): "next" / "done".
- **In a box in no form** inside `#content` (what-if boxes): a `keydown` listener on `document` in the bubble phase, so
  a page's own Enter runs first and is left alone (`e.defaultPrevented`: Ask's send, the ledger's search). A box holding
  something unusable: `reportValidity()` (our words, cursor kept); else the next box of the same `.form` / `.card` /
  `fieldset`; else `blur()` (the keyboard goes down and the page's `change` runs). Search boxes are skipped.
- **Correction found while judging:** the in-no-form Return uses the same test as leaving (M5): a step-only mismatch is
  not "unusable". A's copy calls `reportValidity()` for it, so Return in Capital gains' "Gain" box (step 1000) holding
  1250 would say "Round it to the nearest 1000" while the page already uses 1250. One condition, shared with M5.

### M7. What opened a form: a keyboard open and Cancel (B7, B8)
- **The click note.** One capture `click` listener on `document` notes the control just activated inside `#content`
  (button, link, summary, `[role=button]`, row, `[data-key]`): its words, whether it came from the keyboard
  (`click.detail === 0`), its `data-key` row, its row's place in its list with the list's figure-free keys (`rowNote`,
  lists of up to 300 rows), and the identities of the kit forms already on the page (submit words + section heading +
  first label). It is forgotten at the end of that task.
- **Opened.** A `ui.form` built during that click is "opened by" it only if its identity was not on the page before the
  click, and only the first such form. Opened from the keyboard, its first control gets the cursor; a touch opens no
  keyboard. `ui.form(..., { opener })` lets a page name the opener.
- **Cancel.** The kit runs the page's `onCancel`, then finds the opener: the same node if still on the page; else the
  one control with the same words inside the one row with the same `data-key`; else the row at the same place in a
  list whose rows read the same as at the tap (`sameRowIndex`); otherwise nothing. Found: brought mid-screen when not
  wholly on screen, focused with `preventScroll`. (The third rung is what B lacks: J6d Contacts.)
- **Save brings nothing back by itself.** After a save the place track keeps the place, and pages that adopt
  `ui.openUnder` (A1) keep the row next to the form.

### M8. `ui.reveal(el, { block })` and `planner:reveal` (B9, B10, B11)
- Does nothing when `el` is wholly on screen. The screen is what the person sees: below `max(top bar, visualViewport
  top)` and above the visual viewport's bottom (the keyboard). `start`: its top 8 px under the top bar (an answer, a box
  with its label); `center`: mid-screen (a row); `nearest`: the least scroll (a message with its buttons, a row with its
  form). Instant (a smooth scroll and the iPhone's own scroll to a focused box fight).
- Called while the page draws, before the element is on the page, it waits for it (one animation frame at a time, up to
  about half a second).
- Before it scrolls it dispatches **`planner:reveal`** on `window`: the place track ends any hold and does not anchor
  for this draw.
- `ui.spanOf(a, b)` gives the stretch from `a` to `b` for it.
- `base.css`: `.field :is(input, select, textarea) { scroll-margin-top: 40px }`, so the browser's own scroll to a box
  (the iPhone's arrows) keeps the label below the top bar.

### M9. `ui.openUnder(row, build)`: a row's form in its own holder under the row (B9)
`const close = ui.openUnder(rowEl, (holder) => drawEditForm(holder))`. The kit makes the holder (`li.rec-form` after an
`<li>`, `tr.rec-form > td[colspan]` after a `<tr>`, else `div.rec-form`), puts it right after the row, calls
`build(holder)`, then reveals the stretch from the row's top to the form's first box with `nearest` (nothing moves when
both are on screen); opened from the keyboard, the first box gets the cursor. `close()` removes the holder and puts the
focus on the control that opened it. The page's add form keeps its own host, so its typing is never swapped away. With
the place track's layer API, the phone's Back closes it the same way. **Rule (taken from B M9): call it from the tap's
handler, not while the page draws** (a page that rebuilds its edit form on every redraw would otherwise be scrolled to
it after each save).

### M10. A change one tap can take back: `ui.undoable`, `ui.notice(kind, text, { undo, undone })` (B10)
- `const undo = ui.undoable(ctx.store, (d) => { ... })` makes the change with one `store.update` and works out, **inside
  the update**, the exact changes from the plan as the update found it (`store.get()`, after another tab's save was
  taken in) to the draft, before the store's guesses refresh runs on it (`core/store.js`: the settle runs on a copy
  after the page's function), with the pure `changesOf` (`core/ui/undo.js`). Only the change list is kept. It returns
  `null` when nothing changed (no Undo for a tap that changed nothing), else `undo()`: one `store.update((d) =>
  takeBack(d, changes))` returning `{ done, kept }`. It works once, and only while the same page is open.
- `takeBack` puts back only what still holds the value the change wrote, a removed row only if no row with its id is
  back, an added row only if unchanged since; `meta` is skipped.
- `ui.notice("ok", words, { undo, undone })` draws the words and, on a line of its own under them (`.notice-actions`),
  one outlined 44 px **Undo** (`button.notice-action`). Its tap runs `undo()` then `undone(r)`, where the page sets its
  next `pending`; `ui.undoneWords(r, "Back to $7,000 a month, as before.")` adds "What you changed after that was left as
  it is." when part was kept, or says "Nothing to put back: it was changed again after that.". `{ action: { label, run }
  }` is the same for any one button.
- **A notice with a button brings itself into view** (`reveal(n, { block: "nearest" })` once it is on the page), so the
  way back is never above the screen and the page needs no scroll code of its own (B's recipe needed one per page).
- **Page recipe** (CONVENTIONS): `pending = { text, undo: ui.undoable(ctx.store, (d) => ...), undoText }`; on the next
  render, draw `ui.notice("ok", pending.text, { undo, undone })` **where the tapped control was** (in its slot, or the
  row's place), no `setTimeout` removal; clear `pending` once drawn. A second change gets its own line; the earlier one
  is then final.
- `tests/ui-undo.test.mjs` (11 tests, from B's design, source noted): no change -> null; another tab's account and
  balance kept; Undo twice does nothing; two taps are two Undos.

### M11. Notices, read-outs and CSS
- `ui.notice("error", ...)` gets `role="alert"` the first time its words are drawn on a page visit (a set of address +
  words, cleared on `hashchange`): the error is read at once (K5), and a page that draws the same red line on every
  redraw (Reconcile's "not ready") is not read again after each save. The kit's own lines (`.form-error`) are always
  `role="alert"`: each is a fresh answer to a tap.
- Every node the kit draws carries `data-kit` (`.form-error`, `.field-error`), and a page notice it removed carries
  `data-moved="kit"`.
- CSS, in base.css's form and notice blocks (reference `A/core/ui/base.css`, 14 lines): `.field-error` (red, 600, any
  box, in a kit form or not), `input|select|textarea[aria-invalid="true"]` (red edge), `.form-error` (spans the grid),
  `scroll-margin-top: 40px` on `.field` boxes, `.unit-in` and `.unit` (the "%"), `.rec-form` and `.records
  li.rec-form`, `.notice .notice-actions`, and in the one reduced-motion line `.fold .fold-chev, .scroll-hint::after {
  transition: none }` (taps' HC-5 handoff). Nothing `position: fixed`; no colour outside the tokens.

### M12. Seams with the place and taps tracks
**Ownership.** forms owns `core/ui/dom.js` (every function, old and new), `core/ui/checks.js`, `core/ui/undo.js`,
`tests/ui-checks.test.mjs`, `tests/ui-undo.test.mjs`, the base.css blocks of M11, one line of `tools/check.mjs`, the
CONVENTIONS section "Forms: asking, checking, answering", and the page adoptions A1 to A6. forms changes nothing in
`core/app.js` (no hook in `show()`), `core/router.js`, `core/place.js`, `core/taps.js`, `index.html` or `frame.js`.

| # | forms gives | to | exact interface |
|---|---|---|---|
| G1 | the kit (or a page through `ui.reveal`) scrolled on purpose | place | `window` event `planner:reveal`, dispatched right before the scroll, during a draw or later: during a draw, do not anchor; at any time, end any hold |
| G2 | kit nodes and moved notices | place | `data-kit` on what the kit draws; `data-moved="kit"` on a page notice it removed, in the same task as its line is inserted; place's notice put-back / remove shim leaves both alone |
| G3 | a notice with one button | place | `.notice > .notice-actions > button.notice-action`; place's bottom note may offer it first; never the only way back (M10 self-reveal) |
| G4 | nothing moves between a finger's down and its click | place, taps | no words drawn and nothing inserted from `pointerdown` until that gesture's `click` (or 400 ms after `pointerup` / at `pointercancel`) |
| G5 | Return twice saves once | taps | `ui.form` ignores a submit within 800 ms of one that went through |
| G6 | errors read out | taps | `role="alert"` on the kit's lines always, on `ui.notice("error")` once per text per page visit; taps' `announce()` skips red notices |
| G7 | reduced motion for the chevrons | taps | `.fold .fold-chev, .scroll-hint::after { transition: none }` in the one reduced-motion line, merged with taps' `#sidebar` entry by whoever lands second |
| G8 | the kit's listeners first | taps | installed at import (before `app.js` boots), so they run before the guard's capture listeners; they only note or flush on a click; a gesture the guard swallows at `touchend` gives no click and the 400 ms timer flushes |
| G9 | no stale message | place | `setCustomValidity` only on boxes the kit built, clearing only words it set; a value written by place's typing restore with an `input` event re-checks the box |

| # | forms needs | from | exact behaviour |
|---|---|---|---|
| N1 | focus after a redraw when the focused control is gone (a closed form's Save, a Remove, Undo) | place | after a keepScroll redraw, focus this redraw's fresh `.notice.ok` / `.notice.error` (`tabindex="-1"`, `preventScroll`) if readable; else leave the focus. Closes K4's after-save half |
| N2 | a page (or kit) scroll wins | place | a scroll call during the draw and `planner:reveal` at any time mean the page wins: no anchor, the hold ends |
| N3 | typing put back quietly | place | write `.value`, dispatch `input` (and `change` for choices); never `reportValidity()`; `checkValidity()` is silent and safe |
| N4 | focus moves only in a redraw | place | never move the focus on events that are not a redraw (a held Save puts the cursor in the wrong box on purpose; Cancel's return is the kit's) |
| N5 | a held submit is not a save | place | the plan did not change, so place's "let go of the typing" must not run |
| N6 | one meaning of "Undo" | place | "Undo" is the kit's button for taking back a change to the plan; place's cue for typing says "Undo my typing" |

**Order.** Any; the forms patch shares only `core/ui/base.css` (separate blocks plus the one reduced-motion line),
`docs/CONVENTIONS.md` (its own section) and `CHANGELOG.md` (one line). The page adoptions land after the kit is on
`main` (section 6, the static-site rule).

---------------------------------------------------------------------------------------------------------------------

## 3. Adoption list (what pages must do)

**Nothing for B1 to B8, B12 to B14.** Every page that uses `ui.form`, `ui.moneyBox` or the browser's checks gets them
with no edit, claude-a's included.

**Open findings that need a page edit**, all on claude-b's pages (lanes released: claude-d 22:15, claude-e 23:30,
claude-g 00:30, claude-h 22:40), each left to wave 1 on WORKBOARD (claude-d: "T9, T11, x-duplicates Undo ... UI-EDIT";
claude-e: "p-retirement-b/x-3 ... RC-11 ... the Undo after Social Security's 'Removed'"; claude-g: "B3 ... errors
placed at the box ... folds that shut after a save on rent-vs-buy and renovation"). Built after the kit is on `main`,
each under a claim row naming its files (the wave 1 claim says "no view.js in this wave": each adoption adds its row):

| # | pages | change | closes |
|---|---|---|---|
| A1 | balance/net-worth, cashflow/expenses, transactions/ledger, transactions/categories, transactions/rules | the row's edit form opens with `ui.openUnder(row, build)` from the tap's handler instead of the shared form card + `scrollIntoView`; Cancel and Save call the returned `close()` (Save after its `store.update`); `close` goes to the place track's layer API so Back closes it; rows carry `data-key="<record id>"` | p-transactions-helpers/T9, p-balance/B3 |
| A2 | retirement/withdrawal-strategy; retirement/social-security | "Plan on $X a month" through `ui.undoable`; its notice with `{ undo, undone }` in the slot under the hero where the line is drawn today; no 4 s timer for it. Social Security (taken from B section 3, claude-e's ask): a Save whose result is "Removed: the plan now counts no Social Security for ..." is made with `ui.undoable` and its line carries Undo ("Put back as it was.") | p-retirement-b/x-3 (and claude-e's ask, no finding id) |
| A3 | transactions/categorize | a single pick (and its OK) through `ui.undoable` (the filing, the rename and the rule it writes, in one change); the filed group stays in place for the visit as one done line "Kroger Dayton: filed under Pets (2)." with Undo; no 5 s timer for single picks | p-transactions-helpers/T11 |
| A4 | transactions/duplicates | "Remove the copy" through `ui.undoable`; the pair's place shows "Removed the copy from Oct 7, 2026." with Undo until the person leaves; those lines are drawn above the early "No duplicates" return | p-transactions-helpers/x-duplicates |
| A5 | property/rent-vs-buy, property/renovation, property/home, property/rental, property/vehicles, scenarios/advisor-plan, scenarios/compare, retirement/annuities | the recipe: the submit sets `pending`; the next render draws "Saved." inside the answer card (or the new item's card), draws the figures fold open on the render after its own save, and calls `ui.reveal(card, { block: "start" })` (also inside a late `computeRemote().then(draw)`); no timer. Reference: `$SP/w1/judge-forms/A/modules/property/rent-vs-buy/view.js` | p-debt-property/DP-1, p-cashflow-b-goals/F6, p-retirement-c-scenarios/RC-11 |
| A6 | insurance/ltc | (taken from B section 3) the field `costFactor` reads "Prices where you live, compared with the country", help "100% = the same as the national price; 130% if your state costs 30% more" (still "Costs where you live" at ee09f6e :104); the "%" now shows in the box (M3) | p-insurance-estate/IE-4 (label half) |

**Small follow-ups the kit makes easy (listed, not wave 1's to build):**
- crypto (:136-137), employer-stock (:127/:152), retirement/contributions (:314), career/business (:141), property/rental
  (:168), property/home (:130): a refusal about one box can become `return ui.fieldError(box, words)` so that box is
  outlined and gets the cursor (the kit already brings the words above the button with no edit).
- balance/update (:49) and household/people (:33) restore a whole copy of the plan on Undo (they would take back another
  tab's change made in between): switch to `ui.undoable`.
- Hand-built `type="number"` boxes (capital-gains :54, brackets :51, credit-cards months and fee, estate/beneficiaries
  share, social-security :67): `ui.numberBox`, or drop the coarse step, if phone check H2 shows Safari saving "12..5"
  as nothing.
- A kit-wide `more: true` fold for long forms (claude-g's ask; the sweep's D-KEYBOARD-UP breaks).

**claude-a's pages** (handoff lines only; the kit helps them with no edit): taxes/documents' Remove asks first (INV-2,
p-taxes/x-4: still one tap at ee09f6e :56); goals/vehicle and goals/charitable take the A5 recipe (F6);
taxes/documents' "Write what the document is first." already moves above its button with no edit.

**To the touch sweep's owner** (taken from B M13; a message, not a wave 1 change): (1) a strict D-WRONG: an `invalid`
that was not default-prevented is a break, and "words" include the text of the box's `aria-describedby` element read
after the page settles (today the rule cannot see words drawn when a box in no form is left); (2) a D-UNDO variant for
one-tap overwrites; (3) D-ENTER strict: Return in a box with another box after it must not save.

---------------------------------------------------------------------------------------------------------------------

## 4. Risks (what could be worse than today) and the exact checks

| # | risk | the check |
|---|---|---|
| R1 | The iPhone dispatches `invalid` differently: a bubble still shows, a box is left out of the pass, or the keyboard does not come up on the wrong box. | Phone try-list 1, 2, 4 (H1). Fallback ready: `novalidate` on `ui.form` and the same walk over `form.elements` reading `validity` in the submit wrapper (about 10 lines), the listener kept for hand-built forms. |
| R2 | Wrapping `checkValidity` breaks a caller that expects `invalid` from it. | grep at the tip: no page listens for `invalid` itself; `qa/touch-sweep.mjs` listens in the capture phase and still sees every event. |
| R3 | A page's `input` listener clears a kit box's words and the form goes through with "12..5". | The submit click puts the kit's words back first (M2); a node test with a fake box; D-WRONG on Tax lots. |
| R4 | A page reads a number box by hand and gets NaN from "1,200" or "5%" (tax-lots :84/:93, crypto :66, allocation). | The box writes the plain number back on `change` (registered before the page's) and at submit (M3). grep `Number(.*\.value)` / `elements\.` on kit boxes at the tip; D-KIND on Tax lots and Allocation. |
| R5 | The ceiling or the date floor refuses a real figure. | Every edit form re-sent with its saved values on every qa household (census): never held by a ceiling or a date floor; pages that need more pass `max: null`. |
| R6 | Return skipping choice lists hides a choice a person meant to change. | Each skipped choice holds a sensible default and stays on screen between the boxes; the iPhone's arrows still visit it; a required empty choice holds the form with "Choose one first." (M2). |
| R7 | Cancel brings back the wrong row. | Only the same node, the one same `data-key`, or the same place in a list that reads the same row for row; `tests/ui-checks.test.mjs` (re-sort, rename, a row gone, twins); J6d. |
| R8 | The place track holds the screen after a page's late `ui.reveal`. | `planner:reveal` ends every hold (N2). On the merged build: a late answer (advisor-plan) revealed 1 to 3 s after the save stays on screen 5 s later; J7, J8 re-run. |
| R9 | `npm test` breaks (view tests drive `ui.form` in the stand-in document). | Boxes are built and read the same way there; no document listener is installed. Measured on ee09f6e + A's kit: 189,316 tests, 188,673 pass, 1 fail, 3 skipped, 639 todo; the one failure is `tests/live-check.test.mjs` (runs `git diff`; the evidence copy is not a repository; B's copy fails the same test). `npm run check` OK. |
| R10 | Cost per tap. | The click note reads the page's kit forms and one list's row words (at most 300 rows). Measured on the ledger: 2.46 ms per click today, 2.51 ms with A's kit (2.73 with B's). D-TIME on a 1,000-row ledger before landing. |
| R11 | Static site: a page calling `ui.undoable` / `ui.openUnder` / `ui.reveal` meets the old `dom.js` on the phone. | The kit lands and `main` moves (with `tools/main-gate.mjs`) before any adoption commit; `npm run skew` on the kit's last step. |
| R12 | Undo takes back more than its tap (another tab, the guesses' refresh). | The change list is worked out inside the update, before the settle (M10); node tests: another tab's account and balance kept; Undo twice does nothing; Undo after leaving the page does nothing. |
| R13 | A notice with Undo reveals itself on a redraw that is not the tap's (a sync redraw while `pending` is still set). | `pending` is cleared once drawn, so the notice exists on one draw; `reveal` does nothing when on screen; J7 at two heights. |
| R14 | A desktop keyboard loses the arrow-key stepping of a number box. | Accepted (no finding asks for it); listed in CONVENTIONS. |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari (and the home-screen app)

- **Interactive validation.** Safari shows its own bubble on a form without `novalidate`; `invalid` is cancelable and
  the kit cancels every one. WebKit fires `invalid` on every failing box of a submit and blocks the submit when any box
  is invalid even when every event is cancelled (H1).
- **Focus and the keyboard.** `focus()` raises the keyboard only inside a user gesture. The wrong box is focused inside
  the tap's own `invalid` dispatch (keyboard up: wanted). A keyboard open (B7) is a key event. A touch open focuses
  nothing.
- **Pointer events and the hold.** Safari fires `pointerdown`/`pointerup`, then the mouse events and `click`; the hold
  ends at the click (H6, from B).
- **The keyboard covers about 336 px**, and with it up Safari scrolls the visual viewport inside the layout viewport:
  `ui.reveal` reads `visualViewport.offsetTop` and `height` for "on the screen" (H7, from B).
- **`enterkeyhint`** (iOS 13.4 and later) labels the key "next" / "done"; set when the form is built and again on focus.
  The number pad has no Return: B6 applies to text, phone and email boxes there.
- **`inputmode="decimal"`** shows the decimal pad for money, number and percent boxes, as today: no minus and no "%"
  (the "%" is drawn in the box). Because the kit reads these boxes itself, what WebKit does with "12..5" in a
  `type="number"` box no longer matters for kit forms (it still does for hand-built boxes: H2).
- **Date boxes** open the wheel; Safari ignores `min`/`max` in the wheel, so the floor and "today" are checked at Save.
- **No scroll anchoring**: `steady()` keeps the buttons and the box being typed in still by hand.
- **Home-screen app**: no browser bar; the kit reads `#topbar` and `visualViewport` every time, no fixed numbers.
- **`window.confirm`** works in Safari and in the home-screen app (B15).

**Try-list for the owner** (iPhone, `?sandbox=1`, about ten minutes):
1. Income > "+ Add another income", tap Add income with nothing typed: the "What is it" box is under the top bar, the
   cursor in it, the keyboard up, "Fill this in first." under it, and no grey bubble.
2. Income: type 150 in "Yearly raise", tap Starts: the cursor goes to Starts and stays put; "Use a number from 0% to
   100%." appears under the raise. Type 3 there: it goes.
3. Gifting: type Sam in "To whom", press the keyboard's "next": the cursor goes to Amount and nothing is saved; type
   500 and tap Add gift.
4. Update my balances: type "abc" in a balance, tap Save: words under that box, its label showing, no bubble.
5. Your home: type 2099 in "Year you bought it", tap Save twice: one red line right above Save, still there a minute
   later; Save did not move between the taps. Then press return in the year box: the line and Save show above the
   keyboard.
6. Net worth: Edit an account low on the page, then Cancel: you are back at that account, in the middle of the screen.
7. Pay off debts: type "50.." in "Extra each month": nothing red while typing; tap Save plan: words under the box; your
   saved extra is still there.
8. (After A2) How much to take out: tap "Plan on $X a month" with it in the middle of the screen: the green line and its
   Undo are on the screen; tap Undo: your figure is back.
9. Contacts > Add someone: Phone brings the phone keypad, Email the email keyboard.
10. Repeat 1 and 6 from the home-screen app, once with Reduce Motion on.

**Must be seen on the real phone** (Chromium only here): H1 (no bubble, every box in the pass, the keyboard on the wrong
box: items 1, 2, 4); H2 (a hand-built `type="number"` box holding "12..5": does Safari save nothing? decides the
follow-up in section 3); H3 (the key reads "next" on the first box: item 3); H6 (the hold: item 2); H7 (reveal above the
keyboard: item 5).

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each verifiable alone; the same list as `plan-forms-steps.json`)

Every step: `npm run registry && npm test` (0 new failures; the two speed tests that flake under load are re-run alone),
`npm run check`, `node tools/leak-guard.mjs --worktree`, one CHANGELOG line ("- [builder:claude-b] ..."), CONVENTIONS
updated for what the step adds. Measure each step against two servers from the same tip: the tip, and the tip plus the
step (no switch in the code), with `$SP/w1/judge-forms/scripts/journeys.mjs` pointed at them (edit `PORT` and `ROOT` in
`jlib.mjs`). The touch sweep (`qa/touch-sweep.mjs`, from `$SP/wtouch` until it lands; name its commit in the step's log)
on goals/goals, cashflow/income, household/contacts, estate/gifting, balance/net-worth, property/home, property/vehicles,
debt/payoff x family, renterDebt: no new break.

- **F1** `core/ui/checks.js` + `tests/ui-checks.test.mjs` (with the plain-words guard over checks.js and dom.js);
  `tools/check.mjs` purity list.
- **F2** `core/ui/undo.js` + `tests/ui-undo.test.mjs` (source noted in both headers).
- **F3** The engine (M2, M5, M11's words): the `invalid` listener, the silent `checkValidity`, the finger-down hold,
  leaving words, `steady`, `ui.fieldError`, `reveal` (internal), the base.css form lines. Journeys J1, J2 (150), J9, J10,
  J11, J12.
- **F4** Boxes (M3): `ui.numberBox`, `readForm` with `readNumber`, money ceiling and sign, words in validity with the
  submit-click refresh and the plain number written back, date floor and today, tel/email, `missing`, `.unit-in`.
  Journeys J2b, J11 ("11,200"); D-KIND, T-KEYBOARD; the R4 grep.
- **F5** The submit wrapper (M4): 800 ms, refusals brought above the buttons with the old line cleared inside `steady`,
  the count line, `resetAfter`. Journeys J3 (Save 751 -> 751 -> 751), J13, J14; D-TWICE (Enter half).
- **F6** Return (M6) in kit forms and boxes in no form, with the step-only correction. Journeys J4a, J4b, J4c; D-ENTER.
- **F7** The click note, keyboard open and Cancel (M7) and `ui.openUnder` (M9). Journeys J5a, J5b, J5c, J6a, J6b, J6d;
  T-CANCEL; locate tests.
- **F8** `ui.reveal` exported, `planner:reveal`, `ui.notice(kind, text, { undo | action })`, `role="alert"` once per
  visit, `data-kit`, `ui.undoable`, `ui.undoneWords`, the notice CSS and the reduced-motion line. Node tests; J7 and J8 on
  a throwaway page copy (not committed).
- **F9** docs/CONVENTIONS.md section "Forms: asking, checking, answering"; DESIGN_LOG 2026-11-11 entry with the choices
  of section 7; the TEAM claim row names `core/ui/checks.js`, `core/ui/undo.js`, `tests/ui-*.test.mjs`,
  `tools/check.mjs`, `docs/CONVENTIONS.md`; WORKBOARD message with the seams to place and taps and the three sweep asks.
  `npm run skew`, then `main` moves (pre-push gate).
- **A1 to A6** (after F9 is on `main`; each its own commit and claim row): section 3's table.

**CONVENTIONS gains** (one section, "Forms: asking, checking, answering"): the field options `required`, `missing`,
`whole`, `min`, `max` (`"today"` on a date, `max: null` for money), `type: "tel" | "email"`; `ui.numberBox`,
`ui.fieldError`, `ui.reveal` (+ `planner:reveal`), `ui.openUnder` (from the tap's handler), `ui.undoable`,
`ui.notice(kind, text, { undo, undone, action })`, `ui.undoneWords`; and the rules: `checkValidity()` is silent,
`reportValidity()` and a held submit speak; a form's refusal is a `.notice.error` the kit brings above the buttons (or
`ui.fieldError` for one box), never removed by a timer; Save is never disabled to say "not yet"; a one-tap change that is
not a Remove offers Undo where the control was; every Remove asks first; a way on is a 44 px button that names its place
("Update balances on Net worth"), never a link inside a sentence; number boxes are text boxes the kit reads (no arrow-key
stepping).

---------------------------------------------------------------------------------------------------------------------

## 7. Design log decisions relied on, lanes, and choices made without the owner

Quoted from `docs/DESIGN_LOG.md` (each checked at ee09f6e):
- "Rule: every save/add/remove confirms with a green notice; errors are red and say what to do next." B1 to B4 carry it
  to the box and the button; B10 adds the way back to the green line.
- Debts round 14: "the form opens inside the list card", owner chose A. A1 spreads it with `ui.openUnder`.
- Net worth: first visit with no accounts keeps the form open; Edit opens it filled in; Cancel folds it. Cancel still
  folds the form; the kit only brings the row back.
- Pass 4, round 2: "A) outlined button "Update balances on Net worth"", owner chose A. The CONVENTIONS rule for ways on.
- Pass 4, round 1: "A) one fold per person, first open, the one just saved stays open". A5 keeps the figures open after
  their own save; Undo sits on its own line.
- "Rule: disabled buttons look disabled (base.css does it for every button)." The kit never disables Save to say "not
  yet".
- 2026-11-06: "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own
  buttons)". No error or Undo bar is fixed anywhere.
- 2026-11-06: "Do not undo: the household's view never shows build progress, "soon" pages, or PC / AI helper / sync
  wording". The new words on screen are only M1's sentences, "N boxes need a fix: ...", "Undo", the pages' own "Back to
  ... as before.", "What you changed after that was left as it is." and "Nothing to put back: it was changed again after
  that."; the plain-words guard keeps it so.

**Lanes.** Wave 1 files: `core/ui/dom.js`, `core/ui/base.css` (form and notice blocks, one shared reduced-motion line),
and new small files `core/ui/checks.js`, `core/ui/undo.js`; with them `tests/ui-checks.test.mjs`,
`tests/ui-undo.test.mjs`, one line of `tools/check.mjs`, `docs/CONVENTIONS.md`, `docs/DESIGN_LOG.md`, `docs/TEAM.md`
(claim), `docs/WORKBOARD.md` (message), `CHANGELOG.md`. Then A1 to A6 on claude-b's pages only, each with its claim row.
Not touched: `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `frame.js`, any of claude-a's folders
(goals/emergency-fund, goals/vehicle, goals/travel, goals/charitable, debt/student-loans, debt/consolidation,
taxes/state, taxes/self-employment, taxes/filing-status, taxes/documents, balance/projection, balance/statement,
cashflow/statement), any `compute.js`, `modules/registry.js`, `tests/golden/**`.

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

## 8. Coverage (55 findings in UI-ERR, UI-ENTER, UI-EDIT, UI-UNDO, UI-LIVE, UI-RESULT, UI-TARGET), status at ee09f6e

Closed on the branch = a wave-2 commit closed it in the page (the commit named); the kit still makes those pages speak
the same way. Step = what closes or keeps it in this plan. Measured = the judge's journey that shows it.

| theme | finding | sev | status at ee09f6e | closed by (step) | measured |
|---|---|---|---|---|---|
| UI-ERR | j-fat-fingers/FF1 | 4 | open | F5 | J3, J13 |
| UI-ERR | p-debt-property/DP-2 | 4 | message open (required boxes in f8d44ee) | F3 + F5 | J11, J3 |
| UI-ERR | p-debt-property/x-2 | 4 | closed (f8d44ee: cost and price required) | F3 speaks it | - |
| UI-ERR | p-insurance-estate/IE-2 | 4 | closed (7b96857) | F4 ceiling as the net | node tests |
| UI-ERR | p-investments/x-2 | 4 | message open | F5 (`ui.fieldError` follow-up for the box) | J12 (same engine) |
| UI-ERR | j-debt-fixer/D2 | 3 | closed (33c65fd) | F3 speaks it | J9 |
| UI-ERR | j-fat-fingers/FF5 | 3 | open | F3 | J1 |
| UI-ERR | j-heavy-waiting/W6 | 3 | closed (f8d44ee, 94e186f) | F4 (steps are hints) | J11 "11,200" |
| UI-ERR | p-career-household-system/F3 | 3 | open | F3 (+ F5 count line, M5) | J1, J2 |
| UI-ERR | p-debt-property/DP-4 | 3 | closed (33c65fd) | F3 speaks it | - |
| UI-ERR | p-insurance-estate/IE-4 | 3 | open | F3 words, F4 "%", A6 label | J2, J2b |
| UI-ERR | p-investments/INV-3 | 3 | open | F3 | J10, J12 |
| UI-ERR | p-retirement-c-scenarios/RC-1 | 3 | closed (595acea) | - | J14 |
| UI-ERR | p-retirement-c-scenarios/RC-4 | 3 | closed (94e186f) | F1 coarse-step words if a step returns | node tests |
| UI-ERR | p-retirement-c-scenarios/RC-2 | 3 | closed (595acea) | - | - |
| UI-ERR | p-career-household-system/F7 | 2 | closed (f8d44ee) | F4 `tel`/`email` | - |
| UI-ERR | p-cashflow-a/CF-7 | 2 | open | F3, F4 | J2, J2b |
| UI-ERR | p-investments/INV-10 | 2 | closed (b7cfdd2) | kept by F3 (pages' own words) | J12 |
| UI-ERR | p-retirement-a/R-A10 | 2 | closed (f80661e, 239a719) | F4 ceiling as the net | node tests |
| UI-ERR | p-taxes/T6 | 2 | open | F3 (+ `scroll-margin-top`) | J10, J2 |
| UI-ERR | p-transactions-helpers/T7 | 2 | closed (6b99713) | - | - |
| UI-ENTER | p-career-household-system/x-2 | 3 | open | F6 | J4a |
| UI-ENTER | p-insurance-estate/x-2 | 3 | open | F6 | J4b |
| UI-ENTER | j-first-freelancer/F6 | 2 | open (Android) | F6 | D-ENTER |
| UI-ENTER | p-taxes/T2 | 2 | open | F6 | J4c |
| UI-EDIT | p-transactions-helpers/T9 | 4 | open | A1 (+ F7) | J6c (net worth, same recipe) |
| UI-EDIT | j-keyboard-reader/K4 | 3 | open | F7 (opening, Cancel) + place N1 (after save) + A1 | J5a, J6a, J6b, J6d |
| UI-EDIT | p-balance/B3 | 3 | open | F7 (Cancel) + A1 (open and Save) | J6a, J6c |
| UI-EDIT | p-investments/INV-5 | 3 | closed (b7cfdd2) | - | - |
| UI-EDIT | p-transactions-helpers/x-halfform | 3 | closed (33bda60) | A1 keeps the add form's typing | - |
| UI-UNDO | p-cashflow-b-goals/F3 | 4 | closed (7c5c1d8: asks first, Hidden card) | - | - |
| UI-UNDO | p-investments/INV-2 | 4 | closed except taxes/documents (claude-a, handoff) | rule B15 | - |
| UI-UNDO | p-cashflow-b-goals/x-4 | 3 | closed (f8d44ee: "Put back my amounts") | `ui.undoable` follow-up | - |
| UI-UNDO | p-retirement-b/x-3 | 3 | open | A2 (+ F8) | J7 (both heights) |
| UI-UNDO | p-taxes/x-4 | 3 | closed for capital gains (cf6e101); documents claude-a's | handoff | - |
| UI-UNDO | p-transactions-helpers/T11 | 3 | open | A3 (+ F8) | after A3 |
| UI-UNDO | p-transactions-helpers/x-duplicates | 3 | message closed (8373f97), no way back | A4 (+ F8) | after A4 |
| UI-UNDO | j-first-retiree/R4 | 2 | closed (f80661e; "Put it back") | - | - |
| UI-UNDO | p-balance/x-4 | 2 | closed (f8d44ee) | - | - |
| UI-LIVE | j-keyboard-reader/x-redraw-on-change | 3 | closed (33c65fd, cf6e101) | F3 hold keeps it so | J9 |
| UI-LIVE | p-debt-property/x-1 | 3 | closed (33c65fd) | F3 hold | - |
| UI-LIVE | p-taxes/x-3 | 3 | closed (cf6e101) | F3 hold | - |
| UI-RESULT | j-one-answer/A1 | 4 | closed (cf6e101, f8d44ee, 94e186f) | - | - |
| UI-RESULT | p-debt-property/DP-1 | 4 | open | A5 (+ F8) | J8 |
| UI-RESULT | p-cashflow-b-goals/F6 | 3 | open for rent-vs-buy and renovation (house closed in f8d44ee); vehicle and charitable claude-a's | A5; handoff | J8 |
| UI-RESULT | p-investments/INV-7 | 3 | closed (b7cfdd2) | - | - |
| UI-RESULT | p-retirement-c-scenarios/RC-11 | 3 | open | A5 | after A5 |
| UI-RESULT | p-cashflow-a/x-3 | 2 | closed (7c5c1d8) | - | - |
| UI-TARGET | p-retirement-a/R-A9 | 3 | closed (f80661e) | CONVENTIONS rule | - |
| UI-TARGET | j-fat-fingers/FF8 | 2 | closed (33c65fd, a23d589) | CONVENTIONS rule | - |
| UI-TARGET | p-balance/B8 | 2 | closed (33c65fd) | CONVENTIONS rule | - |
| UI-TARGET | p-career-household-system/F8 | 2 | closed (f8d44ee) | CONVENTIONS rule | - |
| UI-TARGET | p-overview-home/OV-5 | 2 | closed (38bc38f, 5c6246f) | CONVENTIONS rule | - |
| UI-TARGET | p-retirement-b/RB3 | 2 | closed (f80661e) | CONVENTIONS rule | - |
| UI-TARGET | p-retirement-c-scenarios/RC-10 | 2 | closed (94e186f) | CONVENTIONS rule | - |

Open at ee09f6e: 22. Closed by the kit alone (F3 to F7): 13 (FF1, DP-2's message, p-investments/x-2's message, FF5, F3,
INV-3, CF-7, T6, career x-2, insurance x-2, freelancer F6, T2, K4 with place N1) plus B3's Cancel half and IE-4's words
and "%". Closed with A1 to A6: T9, B3, retirement-b x-3, T11, x-duplicates, DP-1, F6, RC-11, IE-4. claude-a handoff:
taxes/documents' Remove, goals/vehicle and goals/charitable (F6).

---------------------------------------------------------------------------------------------------------------------

## 9. What was taken from each design

| part | source | where |
|---|---|---|
| the whole kit: engine (invalid listener, silent `checkValidity`, finger-down hold), words in `checks.js`, text number boxes, submit wrapper with `steady` around every line, Return that skips choices, opener identity and the `sameRowIndex` Cancel, `reveal` that waits for the page, notices with their button on their own line and self-reveal, `role="alert"` once per visit, `undoable` worked out inside the update, A1 to A5, the seams | A (`$SP/w1/forms/final.md`, `$SP/w1/forms/fin`) | M1 to M12, A1 to A5 |
| `core/ui/undo.js` and its 11 tests, `ui.openUnder(row, build)`, the silent-check wrapper, the finger-down hold (A had already taken these from B) | B | M2, M9, M10 |
| the plain-words guard over every quoted sentence | B (`tests/ui-words.test.mjs`) | M1, F1 |
| IE-4's label half on insurance/ltc | B section 3 | A6 |
| Social Security's Undo after "Removed" (claude-e's ask) | B section 3 | A2 |
| "call `openUnder` from the tap's handler" | B M9 | M9, CONVENTIONS |
| the three asks to the touch sweep's owner | B M13 | section 3 |
| iPhone checks H6 (the hold) and H7 (reveal above the keyboard) | B section 5 | section 5 |
| the formless Return treats a step-only mismatch as fine | the judge (both copies had it) | M6, F6 |

Declined from B, with the reason: `type="number"` boxes (J2b, Safari, CONVENTIONS' own note); Return into choice lists
(J4b, J4c: a keyboard stops there and cannot save); clearing the old red line before the handler (J3: Save rose 83 px);
`role="alert"` on every redraw (a red line a page redraws on each save would be read after every save); the Undo button
on the line of the words (`.has-action`; at 390 px it wraps to its own line anyway, and A's own line keeps it so at any
width); `ui.check(boxes)` (no open finding needs it: pages that check boxes in no form already call `reportValidity()`,
which the engine speaks for); `qa/fixtures/kit-forms.html` (the adoptions in the same wave give real-page checks, and a
never-linked page would still be published with the site); the 1 s Return guard (the taps track's window is 800 ms).

---------------------------------------------------------------------------------------------------------------------

## 10. Why this one (the measurements)

**How it was measured.** One script, three servers from the same tip (today ee09f6e, A, B), the same three page edits
in A and B, 23 journeys in 3 households (family; renterDebt; blank; plus family with eight contacts for J6d), short forms
(goals, income, contacts, gifting, net worth add, update my balances, employer stock, vehicles) and long pages that draw
late (withdrawal-strategy with its late "Plan on" button, advisor-plan which is `heavy`, rent-vs-buy 3,256 px,
contributions, home 2,625 px), at a person's pace: a finger drag to find each control, a touch tap at its centre, keys
at 70 ms, 450 ms between actions, two taps at 150 ms + 450 ms on Save, Return walks at 450 ms, Undo after a 5 s wait,
at 390 x 844 and 390 x 664. A journey "holds" when every behavior it names is seen. Raw records:
`$SP/w1/judge-forms/out/all-journeys.jsonl`.

| journey (household) | today | A | B |
|---|---|---|---|
| J1 Goals, Add goal with nothing typed (family) | 2 grey bubbles | words at both boxes in view, red, cursor in box 1, label shown, count line | same as A |
| J2 Income raise 150, tap the next box, then Save (family) | no words on leaving; bubble at Save | next box 0 px, words after the tap; words at Save | same as A |
| J2b Income "1,200", "5%", "2.555" (family) | bubble "two nearest valid values" | saved 1200 and 0.02555; "%" in the box | saved 1200 and 0.025550000000000003; "%" dropped; no "%" in the box |
| J3 Home, year 2099, Save twice, wait 7 s (family) | line 1,577 px above, gone at 7 s | one line at 668, Save 751 -> 751 -> 751, still there | Save 751 -> 751 -> **668**, line moved to 585 |
| J4a Contacts, Return walk (keyboard) | saved at the first Return | Name -> Firm -> Phone -> Email -> Notes, not saved | same as A |
| J4b Gifting, Return walk (keyboard) | saved from the second box | To -> Amount -> Year -> Notes, not saved | **stuck on "From"** after 4 more Returns |
| J4c Net worth add, Return walk and Return twice (keyboard) | saved from Balance at once | ... -> As of (done); exactly 1 account added | **stuck on "Kind of account"**; 0 added |
| J5a "+ Add another income" with Enter | focus nothing, typing lost | cursor in "What is it", "Side gig" typed | same as A |
| J5b the same with a tap | no keyboard | no keyboard | no keyboard |
| J5c Capital gains chip with Enter | no jump, focus kept | same | same |
| J6a Expenses, Groceries, Cancel (family) | row at -412, focus nothing | row at 408, focus on it | same as A |
| J6b Income, a row, Cancel (family) | row in view, focus nothing | focus on the row | same as A |
| J6c Net worth, Edit under the row, Cancel, Save (family) | row at -486 | row and first box on screen; focus on Edit; "saved" in view | same as A |
| J6d Contacts (page redraws, no record keys), Edit, Cancel | focus nothing | **focus on that row's Edit** | focus nothing |
| J7 Withdrawal "Plan on", Undo, at 844 and 664 (family) | no Undo; line gone after 4 s | Undo 73 x 44 on screen, there at 5 s, 7,000 back, words in view | same as A |
| J8 Rent or buy, Compare twice (renterDebt) | card 375 px above, figures shut | card at 64 px, "Saved." inside, figures open, both times | same as A |
| J9 Pay off debts "50..", tap Order, Save plan (renterDebt) | nothing on leaving; bubble at Save | tap lands, words after it; words at Save; plan kept | same as A |
| J10 Update my balances "abc", Save (renterDebt) | bubble | words at the box, red, cursor | same as A |
| J11 Vehicles, name only, "11,200" (family) | bubble, label hidden | "Type an amount first." at the box, label shown; 11200 saved | same as A |
| J12 Employer stock "acme!!" (blank) | bubble | the page's words at the box | same as A |
| J13 Contributions "abc", Add twice (family) | Save 662 -> 749, line at the top | Save 662 -> 662 -> 662, line at 579 | same as A |
| J14 Advisor's plan, Compare empty, wait 4 s (family, heavy) | line in view | line in view, kept | same as A |
| **journeys that hold (of 23)** | 3 | **23** | 18 (J2b partly) |

**What a person sees.** A holds every journey. B fails four, each where the two designs differ: the second tap's Save
moves under the thumb (J3), Return stops on a choice list where a keyboard can neither go on nor save (J4b, J4c), and
Cancel on a page that redraws without record keys leaves the focus nowhere (J6d); and it keeps the float noise and
loses the "%" (J2b). Where both hold, the numbers are the same to the pixel (J7 Undo at 599-643 px; J8 card at 64 px),
because A already carries B's best parts (the engine, `undo.js`, `openUnder`).

**What can go wrong.** A reads its own number boxes, so "12..5", "1,200" and "5%" behave the same in Chromium and
Safari, and the iPhone-only `type="number"` behaviour CONVENTIONS warns about is out of the kit's forms; B depends on
WebKit's number-box handling (H4 in B's own list). A's Undo list is worked out before the guesses' refresh; B's after
it. A reads each red line out once per visit; B on every redraw. A's extra costs: about 150 more lines (103 of them pure
and node-tested in `checks.js`), number boxes lose arrow-key stepping on a desktop (R14), and the click note's row
reading (2.51 ms vs 2.73 ms per click on the ledger: no cost seen).

**How many pages need an edit.** The same for both: none for B1 to B8 and B12 to B14; the open findings that only a
page can close need A1 to A6 (17 pages, all claude-b's). A's notice brings its Undo into view by itself, so A2 to A4 need
no scroll code (B's recipe needed a `requestAnimationFrame` + `scrollIntoView` per page).

**How much the shell carries.** Neither touches `core/app.js`, `core/router.js`, `index.html` or `frame.js`. A: `dom.js`
about +360 lines after the evidence switch is stripped, `checks.js` 103 and `undo.js` 93 (both pure, in the purity
list), base.css +14. B: `dom.js` +349, `undo.js` 93, base.css +10. `npm test` on both copies: 189,316 tests, 1 failure
each (the same environmental `live-check` test); `npm run check` OK on both; the kits' own node tests 18 of 18 on both.
