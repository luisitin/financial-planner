# Wave 1, track "forms": form controls and answers

The owner's request (2026-11-11): "Be extensive and use tons of agents to stress test every single touch and input for
usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy to know
next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."

This track fixes seven causes once, in the UI kit (`core/ui/dom.js`, the form and notice selectors of
`core/ui/base.css`, `docs/CONVENTIONS.md`), so that the 55 verified findings of the themes UI-ERR (21), UI-ENTER (4),
UI-EDIT (5), UI-UNDO (9), UI-LIVE (3), UI-RESULT (6) and UI-TARGET (7) close either with no page change or with a short
page adoption in wave 2.

- Prototype: the worktree `$SP/w1/forms/proto` at c385e41 (uncommitted edits), served on 127.0.0.1:9313, always with
  `?sandbox=1`. `?forms=off` draws today's kit in the same build (both sides of every measurement come from one server).
- New files: `core/ui/checks.js` (pure: what a box says), `core/ui/undo.js` (pure: a change and its way back; lifted
  from the forms2 design's prototype, same repo, MIT), `tests/ui-checks.test.mjs` (8 tests), `tests/ui-undo.test.mjs`
  (7 tests). Changed: `core/ui/dom.js` (about +550 lines), `core/ui/base.css` (+15 lines, form and notice selectors
  only), `core/app.js` (3 hook lines; the shell lane decides where they finally go, section 2 "Contract with place").
  Page adoptions made only to measure them (wave 2 owns them): goals/prioritizer, cashflow/subscriptions,
  balance/liquidity, debt/payoff, debt/mortgage, taxes/capital-gains, taxes/brackets, household/contacts.
- Measured with real taps (Playwright touchscreen, a 390 x 844 phone, a person's pace: `PACE` between steps, typing
  70 ms per key) on 30 pages across 8 invented households (family, widow, renter, renterDebt, jordan, patLee, blank,
  empty), plus the
  touch sweep (`qa/touch-sweep.mjs`, 10 pages x 3 households, 9 rules) on today's app and on the prototype, plus a
  census that sends every kit form on every page once (138 forms, 2 households). Scripts and pictures:
  `$SP/w1/forms/m-*.mjs`, `out/*.json`, `shots/`.

`$SP` = `$SP`.

---------------------------------------------------------------------------------------------------------------------

## 1. Behavior (the acceptance test, in a person's words)

**B1. When I tap Save with something wrong, the app takes me to the box and says what to type, in plain words.**
The first wrong box comes up just under the top bar with its label showing, the cursor in it, a red edge, and one line
under it: "Type an amount in numbers, like 4,500.", "Use a number from 0% to 100%.", "Check the year: 0026 is not a
year this plan can use.", "Fill this in first.". If more than one box is wrong, or the wrong box was off the screen,
one red line above the buttons counts them: "2 boxes need a fix: What are you saving for, Amount needed." The words stay
until I fix the box; typing a right value takes them away (and the count follows). The grey bubble of the browser
never shows. (UI-ERR: FF5, F3, IE-4, INV-3, CF-7, T6, DP-2 box part, FF1 box part)

**B2. A page's own "no" is said where I tapped.** When a page refuses ("Type what the car is worth today."), the red
line sits just above the button I tapped, once (a second tap does not stack a copy), and it stays until my next try
instead of vanishing after 6 seconds at the top of the page. (FF1, DP-2, p-investments/x-2)

**B3. A button never does nothing.** If Compare or Save would leave the page unchanged because an amount box is empty,
the form stops at that box: "Type an amount first." (p-debt-property/x-2 on Renovation and Big purchase, with no page
edit; T7 and RC-1 with a one-line page adoption)

**B4. Amounts are taken the way I type them, and impossible ones are not saved without a word.** "1,200", "$1,200.50",
" 300 ", "5%", "2.555" and "11,200 miles" are taken. "12..5", "abc", a billion or more ("That is a billion or more:
check for an extra zero."), a year like 0026, a date before 1900, a date in the future where only the past makes sense,
a percent or a number outside its limits: all stop at the box with words. Nobody reads "The two nearest valid values
are 1000 and 2000" again. (W6, RC-4, D2, DP-4, INV-10, R-A10; the blank-amount rows of IE-2 and RC-2 need the page to
say the amount is needed: section 3, A1)

**B5. Return moves me on, it does not save half a form.** The keyboard's key reads "Next" in every box but the last,
and takes me to the next box; in the last box it reads "Done" and saves. In a what-if box that is in no form, Return
closes the keyboard and shows the new answer. One tap or one Return saves once. (UI-ENTER: career-household-system/x-2,
insurance-estate/x-2, F6, T2)

**B6. Phone and email boxes bring up the right keyboard.** (F7, one line per box on Contacts: A9)

**B7. After I edit a row, I am back at that row.** Cancel brings the row back to the middle of the screen with a brief
glow; Save brings me back to the row, which now shows what I saved, with "Saved." in view. With a keyboard (or
VoiceOver) the focus lands on the row's Edit button, never on nothing, and opening a row's form puts the cursor in its
first box. (UI-EDIT: T9, K4, B3, INV-5; the form that still opens far from its row is page placement, A7; a stray tap
on another row keeps the typing through the place track's typing memory: x-halfform)

**B8. A one-tap change says what it did and can be taken back, right there.** "Not a subscription", "Use these
amounts", "Plan on $6,600 a month", "Yes, count it as my emergency fund", "Use this one", "Remove the copy", a payee
filed: the green line says what changed and has an Undo button (44 px) beside it, with no timer. Undo puts back exactly
what that tap changed (and leaves alone anything changed since) and says "Put back as it was." Removes that today
delete in one tap ask first, as the rest of the app does. (UI-UNDO: F3, INV-2, x-4 goals, x-3 retirement-b, x-4 taxes,
T11, x-duplicates, R4, x-4 balance)

**B9. Typing in a what-if box does not swallow my next tap.** I type 250 in "Extra each month", tap "Lump sum": the
cursor is in Lump sum and the keyboard stays up. The figures change once, when I leave the boxes (or press Done). A
chip tapped right after typing lights up on the first tap. (UI-LIVE: x-redraw-on-change, x-1, p-taxes/x-3)

**B10. After Compare, Work it out or Save, the answer is on my screen.** The answer comes just under the top bar; if it
was already on the screen it glows briefly and nothing moves. After Add, the new row is in view. After a plain Save
that leaves my place on the screen, my place is kept and the confirmation is copied at the bottom (place track).
(UI-RESULT: A1, DP-1, F6, RC-11, cashflow-a/x-3; INV-7 with a page adoption, A6)

**B11. Ways on are big and say where they go.** A link inside a notice has a 44 px touch area. "Open the page" and
"Open ›" become "Open Emergency fund ›" (the page's own title), as 44 px outlined buttons on their own line.
(UI-TARGET: FF8, R-A9, RB3 in notices with no page edit; B8, F8, OV-5, RC-10 and links in plain paragraphs with A8)

**B12. Nothing moves under my finger.** Words about a box I just left appear only after my tap on the next box has
landed, and the box I am now typing in stays where it was (the words push the page above it, the screen follows).
(the forms2 breaker's e6; touch rules D-FOCUS-KEPT, D-SCROLL-KEPT)

**B13. With VoiceOver, the words are read with the box.** Each wrong box is marked invalid and its words are its
description; the count above the buttons is announced once (role=alert); a page's red notice is announced once.
(K4, the taps track's ask for role=alert on error notices)

Which touch-sweep rules these turn green (`$SP/wtouch/qa/touch-rules.json`): **D-WRONG** (B1, B2, B4), **D-ENTER**
(B5), **D-UNDO** (B8, with A4), **D-SEEN** (B7, B10), **D-FOCUS-KEPT** (B9, B12), **D-SCROLL-KEPT** (B12, and B7/B10
move only when the place is gone or the button asked a question), **D-KIND** (B4), **T-KEYBOARD** (B6), **T-TARGET**
(B11 for links in notices), **T-CANCEL** (B7: Cancel returns), **D-TWICE** (B5's one submit per 800 ms, with the taps
track's tap guard), **D-ANSWERS** (B3). By hand: **H-WORDS** (B1, B4), **H-REAL-KEYBOARD** (B5, B6), **H-READ-ALOUD**
(B13). The sweep's numbers are in section 2, "What the prototype measured".

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

### M1. What a box says: `core/ui/checks.js` (pure, node-tested)

- `readNumber(raw, { percent })`: takes "1,200", " 300 ", "$1,200.50", "2.555", "-2", "5%" (percent boxes); gives
  null for "12..5", "abc", "72k" and blank. `ui.readForm` uses it for money, number and percent boxes.
- `wordsFor(fd, raw, { today, badDate })`: the one sentence for a box, from its field description: missing ("Type an
  amount first.", "Type a number first.", "Pick a date first.", "Choose one first.", "Type a phone number first.",
  "Type an email address first.", "Check this box to go on.", "Fill this in first.", or the page's own `fd.missing`),
  money (numbers, `min`, `max`, a default ceiling of 1e9 that `max: null` turns off), number and percent (no "nearest
  valid values": a step is only enforced as "a whole number" when `fd.whole` or the step is 1 or more and the value
  has a fraction; ranges as "Use a number from 0% to 100%.", years without commas), date (whole date, year 1900 to
  2200, `min` default 1900-01-01, `max: "today"`), email, phone, `fd.pattern` with `fd.patternWords`.
- `summaryWords(labels)`: "One box needs a fix: Amount." / "2 boxes need a fix: What is it, Amount."
- `keyText(text)`: a figure-free key for finding a row again after a save changed its figures ("Store card $1,201" and
  "Store card $1,202" are the same row; "Ana's 401(k)" and "Bo's 401(k)" are not).
- Keeps nothing. Runs in Node and the browser (AGENTS rule 3 style: no DOM).

### M2. The kit's forms check themselves: `ui.form()` in `core/ui/dom.js`

- `novalidate` on every form the kit builds: the browser never shows its bubble on them.
- Number and percent boxes are text boxes the kit reads (like money boxes already were): `inputmode="decimal"`
  (`"text"` when `min < 0`: the decimal pad has no minus key), `data-kind`, `data-min`, `data-max` for checks and
  tools. A percent box shows a "%" sign at its right edge (`span.unit-in`, the same look as Guesses already uses). Date
  boxes get `min` 1900-01-01 and `max` (today) where asked. `type: "tel"` and `type: "email"` give the right keyboard
  (`inputmode`, `autocomplete`, no auto-capitals).
- The submit wrapper, in order:
  1. one submit per 800 ms (a bouncing finger or Return pressed twice saves once; D-TWICE, with the taps track's guard);
  2. every box is checked (`wordsFor`, the field's own `check(value, values)`, the form's `opts.check(values)`); with
     any wrong, `hold()`: words under each wrong box (`aria-invalid`, `aria-describedby`, red edge), the count above
     the buttons when more than one is wrong or the first is off the screen, the first wrong box brought under the top
     bar (instant `scrollTo`, top bar read from `#topbar` each time, `scroll-margin-top: 30px` so its label shows) and
     focused with `preventScroll`; `onSubmit` is not called and nothing typed is lost;
  3. `onSubmit(values)`; a red `.notice.error` the page put up during it (`form.prepend`, `root.prepend`, anywhere in
     the page) is taken out and its words are said once just above the buttons (`div.notice.error.form-says`,
     `role=alert`, `data-kit`); a second refusal replaces it;
  4. the do-nothing net: when `onSubmit` changed nothing (no store change, no change in the page, no new address) and
     a money, number or percent box (or a needed box) is empty, the form is held at that box with its words;
  5. what is needed after the shell's redraw is noted (`after`): the opener (M5), the name typed in the first text box,
     keyboard or touch, a snapshot of the page's cards and rows (figure-free keys), the button's words and section, and
     whether the button asks a question (`/^(compare|work it out|show|check|see|try)\b/i` or `opts.answer`).
- Cancel (a form's `onCancel`) is wrapped the same way: it returns to the opener (M5).
- Fit: works on every page that uses `ui.form` (the census found 138 kit forms on the pages offered to two households)
  with no page change. `ui.form(..., { check, answer })` and `fd.check`, `fd.missing`, `fd.whole` are new optional
  options; nothing else in the call changes.
- Weighed:
  (a) keep the browser's own checking, with the kit's words through `setCustomValidity` and `reportValidity` (the
  forms2 design). Lost: Safari's bubble goes at the next touch and covers the box's help line; the label slides under
  the top bar (FF5, T6); a `type=number` box refuses "1,200" and "5%" and speaks of "nearest valid values" (W6, RC-4);
  the browser stops at the first wrong box and names only that one (F3). Kept from it: the safety net (M3).
  (b) a helper each page calls (DP-2's `fieldError`): offered (`ui.fieldError`), but alone it needs about 30 page
  edits and misses the next page someone writes.
  (c) a red bar fixed to the bottom or a dialog: against the 2026-11-06 rule (no bar fixed to the bottom: it rides
  over the keyboard), and it hides the button.

### M3. Forms the kit did not build: the safety net (capture `invalid` listener)

- Goal seek, Update my balances, Emergency fund and every `reportValidity()` caller still use the browser's checking.
  The kit listens for `invalid` (capture, installed once at import on a real page): `preventDefault()` (no bubble), the
  same words under the box (`nativeWords` maps the browser's validity to `wordsFor`), and the first wrong box of the
  pass brought up as in M2. Goal seek's "Or leave at least" now says "Use 1,000 or 2,000: this box goes up in steps of
  1,000." (RC-4 is closed fully when the page drops its step: A1).
- `ui.check([boxes])` and `ui.fieldError(box, words)` for pages whose plain button reads boxes outside a form (Pay off
  debts' extra: D2).

### M4. Leaving a box: words after the tap, and the box being typed in stays put

- A capture `focusout` on kit boxes: if what was left in the box is wrong, its words are drawn, but only once the tap
  that left it has landed (a queue flushed on `click`, `pointercancel`, or after 1 s). Drawing them between the
  finger's down and its click pushed the next box from under the finger.
- If the box that now has the focus is below, the screen follows it (`scrollBy` by the height the words took), because
  Safari has no scroll anchoring. An empty box says nothing until Save.
- `input` and `change` take the words away as soon as the box is right.

### M5. Return, the keyboard's key, and where a form came from

- Return in a one-line box goes to the next one-line box of the form (selects are skipped: they open a wheel on
  iPhone); in the last one it submits. `enterKeyHint` is set as the box gets the focus: "next" or "done". A box in no
  form gets "done", and Return there leaves it (the keyboard closes; a what-if waiting in M8 shows its answer).
- Opener: a capture `click` listener notes the tapped row or button in the page (not the top bar or menu) with a
  figure-free locator (its tag, `keyText` of its words, of its row, its section, its index among twins), taken at the
  tap because pages clear and redraw the row away before the form exists. `locate()` finds it again only when the same
  key in the same row and section exists, or the same index when the count of twins did not change; otherwise it does
  not guess.
- Cancel: the opener comes back to the middle of the screen, glows, and gets the focus (`preventScroll`).
- A form opened from the keyboard (`click.detail === 0`) puts the cursor in its first box; from a touch it does not
  (no keyboard jumping up over a form the person is reading).
- Weighed: keeping element references (the redraw replaces them: forms2-break e2 picked a twin row); a timer to re-find
  the row (guesses under load).

### M6. After the shell's redraw: the answer, the row, or the place: `ui.afterDraw({ keepScroll })`

Called by `show()` after the page and the guide frame are drawn, only for the redraw that follows a kit form's submit
(within 4 s, same address). The target, first that exists:
`[data-answer]` > the opener's row > for a question button the first new or changed card > the block holding the
name just typed > the first new block > the first changed card (cards are `section/div/details.card`, rows are
`ul>li`, `ol>li`, `tbody>tr` outside forms, keyed figure-free plus their index).

1. a row's form: the row comes to the middle of the screen (if not wholly seen) and glows;
2. the target is already readable on the screen (80 px or half of it): it glows, nothing moves;
3. the place is gone (the button left with its fold or form) or the button asked a question: the target comes just under
   the top bar and glows;
4. otherwise the place is kept: the shell's echo (place M6) copies the confirmation at the bottom.

A keyboard save moves the focus to the target when it is on the screen (never to something out of sight). `afterDraw`
returns whether it moved the screen; the shell then does not count that as "the page scrolled itself".
Weighed: always scroll to the answer (lost: a plain Save would leave the person's place every time, D-SCROLL-KEPT);
never (today: A1, DP-1, F6); pages scroll themselves (12 already do, each its own way; the rest would need ~60 edits).

### M7. A change and its way back: `ui.change(store, mutate)`, `ui.notice(kind, text, { undo })`, `ui.undoLine`

- `change()` runs `store.update(mutate)` and computes at once, with the pure `changesOf(before, after)`, a ticket of
  exactly what changed (paths and old values; no copy of the plan). `ticket.can()` is true while something changed and
  the same page is open; `ticket.undo()` runs `takeBack`: puts back only what still holds the value this change wrote
  (a later change, here or from another device, is left alone and said: "Put back, except what was changed again
  since."), then says "Put back as it was." through the shell's echo (`ui.setSay`).
- `ui.notice("ok", text, { undo: ticket })` adds a 44 px outlined Undo; `ui.undoLine(ticket, words)` is a done-row the
  page draws where the thing was (a hidden subscription, a removed copy). No timer: it stays until the next change.
- A change that changed nothing has no Undo (forms2-break e1); the page can say "These are already your amounts."
- Weighed: a timed bar at the bottom (forms2): it sat on the echo and left before a slow reader found it; a copy of the
  whole plan per Undo (forms2-break e7: memory grew); confirm() before every one-tap change (adds a question to the
  quick path the owner wants).

### M8. What-if boxes: `ui.later(fn)`

- A page that redraws itself when a box changes passes the redraw through `ui.later(redraw)`: it runs after the tap that
  caused the change has landed and, while the focus is in another text box of the page, when that box is left. One
  redraw per `fn` however many changes came in. The box being typed in is the same element all along, so the iPhone
  keyboard stays up.
- Same rule as the place track's M8 (the shell's redraw waits while the person types in another box); they should share
  one function (section "Contract with place").

### M9. Small parts

- `ui.reveal(el, { block, focus, flash })`: brings an element into view now, or right after the shell's draw when called
  while drawing (`ui.drawStart()`); for answers that come late (heavy pages) and chips (Backtest).
- `ui.goTo(ctx, "group/id", words?)`: "Open <the page's title> ›" as a 44 px outlined button, or null when the page is
  not offered to this household.
- `.notice a:not(.btn) { padding-block: 13px }`: a link inside a notice has a 44 to 45 px touch area without changing
  the line's look.
- `.kit-glow`: an accent ring that fades in 1.8 s (a still outline with reduced motion).

### Where each piece fits

| part of the app | how the kit fits |
|---|---|
| `show()` | `ui.drawStart()` before the page draws (a `ui.reveal` during the draw waits); `ui.afterDraw({ keepScroll })` after `frame.after` and before the keepScroll block; its result is passed on so the echo check still runs ("the kit moved" is not "the page scrolled itself"). A new address clears `after`. |
| keepScroll | `afterDraw` acts only on keepScroll draws within 4 s of a kit submit. It never moves the screen on a plain draw. |
| renderSeq | a draw overtaken by a newer one returns before `afterDraw`; the newer draw runs it. |
| store.subscribe redraw | `ui.setStore(store)` counts store changes, so the submit wrapper knows whether the page saved (M2 steps 3 and 4); the 50 ms redraw is untouched. |
| guide frame | the kit only looks inside `[data-page]`; the frame's bar and next-step card are never a target; the top bar offset is read from `#topbar`. |
| sync bar | a redraw because a newer plan arrived has no `after`: nothing moves. An Undo after a sync puts back only what still holds its value (M7). |
| heal.js reload | the page reloads; tickets and `after` are memory only and go with it; nothing half-applied. |
| sandbox | the kit keeps nothing in storage; `?sandbox=1` behaves the same. |
| late pages | `afterDraw` runs after `await m.render`; an answer that arrives later is brought up by the page with `ui.reveal(el)`, or the page draws its answer card at once ("Working it out...") with `data-answer`. |
| heavy pages | the same: `data-answer` on the card that will hold the server's answer. |
| Node tests (fake DOM) | without a real `document` the kit is in "off" mode: no listeners, `ui.change` is a plain `store.update`. The fake-DOM view tests pass unchanged (one guard added after a test caught `location` in Node). |

### Contract with place (what the helpers need from the place track, and what they must not fight)

The place track (`$SP/w1/place/design.md`) owns the shell's redraw (M4), typing memory (M5), the echo (M6) and the held
redraw (M8). The form kit needs, in `show()`'s keepScroll branch, this order:

1. place puts back folds, typing and focus (focus only outside the form just submitted);
2. `const kitMoved = ui.afterDraw({ keepScroll })`;
3. place's anchor hold runs only when `!kitMoved` (otherwise the kit's move would be undone);
4. the echo check (place M6) runs last, so a confirmation the kit left off the screen is still copied.

What the kit asks of place, and must not be fought:
- **Do not count the kit's scroll as "the page scrolled itself"**: place wraps `scrollTo`/`focus` while a draw is under
  way; the kit's calls in step 2 happen in that window. Pass `kitMoved` instead of counting them (or skip calls made
  from `afterDraw`).
- **Ignore `[data-kit]` nodes** in the notice put-back observer: the kit removes its own words (`.field-error`,
  `.form-says`) when a box is fixed, and removes a page's red notice to say it above the buttons. The kit marks a page
  notice it moves with `data-kit-moved` before removing it; place must not put it back.
- **Do not refill a held form's boxes on the kit's account**: a held form keeps its typing (nothing redraws); place's
  M5 "let go" must keep treating a held submit as not saved (the store did not change, so this holds today).
- **One "wait while typing" rule**: place's M8 (the shell's redraw) and the kit's `ui.later` (a page's own redraw) wait
  for the same thing; one function, `ui.later`, used by both, so the two never wait for different events.
- **The echo stays place's**: rule 4 relies on it. A "Show me" action on the echo is not needed by any finding and is
  not prototyped; if place adds it, it is place's call (its decision 4 allows one link).
- The kit must not fight place: it never restores folds or typing, never anchors, and never moves the screen on a draw
  that did not follow a kit submit, a Cancel, or an explicit `ui.reveal`.

### What the prototype measured

All with real taps on the phone size, today's kit (`?forms=off`) against the prototype, same server, same plans.
`npm test` in the prototype: 188,484 tests pass, 0 fail (the fake-DOM view tests included; one guard added in `ui.change`
after a test caught `location` in Node).

**Refused saves** (`m-err.mjs`, 17 cases on 12 pages, 4 households; `out/err-*-a.json` and `out/err-*-b.json`):

| case | today | prototype |
|---|---|---|
| Goals, Add with nothing typed | two bubbles "Please fill out this field." | "Fill this in first." and "Type an amount first." at the boxes, both in view, cursor in the first, label showing; "2 boxes need a fix: What are you saving for, Amount needed." above the buttons |
| Debts, rate 500 | bubble "Value must be less than or equal to 100." | "Use a number from 0% to 100%." at the box and "One box needs a fix: Interest rate per year." |
| Income, yearly raise 150 | bubble "Value must be less than or equal to 100." | "Use a number from 0% to 100%." at the box |
| Gifting, year 1999 | bubble "Value must be greater than or equal to 2011." | "Use a number from 2011 to 2100." |
| People, retirement age 150 / Long-term care 120,000% | bubbles | "Use a number from 18 to 100." / "Use a number from 10% to 400%." |
| Vehicles, 11,200 miles | bubble "...The two nearest valid values are 11000 and 11500." | taken and saved ("Van added.") |
| Income, raise 2.555% | bubble "...2.55 and 2.56." | taken and saved ("Pay added.") |
| Income, raise "12..5" | saved without a word ("Pay added.") | "Type a number, like 3.5 for 3.5%." at the box |
| Goal seek "Or leave at least" 1,250 (hand-built form) | bubble "...1000 and 2000." | "Use 1,000 or 2,000: this box goes up in steps of 1,000." at the box (net, M3) |
| Update my balances "abc" (the page's reportValidity) | the page's words in a bubble, label under the top bar | the same words under the box, label showing (net) |
| Vehicles, "Add car" with no value | red line 234 px above the screen; a second tap stacks a copy | one red line just above "Add car" (top 662), still there 7 s later |
| Your home, year 1900 | red line 1,577 px above the screen, removed after 6 s | above Save (top 455), still there 7 s later |
| Renovation / Big purchase, Compare with the cost empty | nothing at all | "Type an amount first." at the cost / price box, cursor in it (net) |
| Your home, leaving "Selling costs" at -20% | nothing until Save | "Use a number from -10% to 15%." under the box once the next tap landed |
| Gifting, Add with the amount empty | a $0 gift added | the same until A1 marks the amount needed |

Browser bubbles: today in 10 of 17 cases, prototype in 0. Words on the screen at the box or the button: today 0 of 17
(two cases had words off the screen), prototype 14 of 17 (the other three: two right values now taken, and Gifting's
blank amount, A1).

**Return** (`m-enter.mjs`): today 5 of 5 Returns in a first or middle box saved a half form (Gift to Sam $0, "Dr Lee"
with no firm, "Dee" with no birth date, an HSA with no employer amount, Gifting's last box). Prototype: 4 of 4 moved to
the next box (Amount, Firm or company, Birth date, Employer puts in), and Return in the last box ("done") saved.

**Rows** (`m-edit.mjs`, top of the row on the screen after the action; 56 = just under the top bar):

| | today | prototype |
|---|---|---|
| Net worth, Edit then Cancel | row at -655, focus on nothing | row at 395, focus on its Edit |
| Net worth, Edit then Save | row at -101 | row at 394, "Saved." in view |
| Expenses, Edit then Cancel | row at -412 | row at 408, focus on the row |
| Goals / Income, Edit from the keyboard, type "Side gig" | focus on nothing, typing lost | cursor in the first box, "Side gig" typed in it |
| Opening a row's form (a page placement) | jumps 1,537 / 1,647 px | unchanged until A7 |

**Answers** (`m-result.mjs`, top of the answer on the screen; negative = above the screen):
House "Work it out" -18 -> 390; Vehicle (claude-a's page, not edited) -270 -> 81; Rent vs buy Compare -358 -> 219;
Renovation Compare -483 -> 358; Advisor's plan Compare -405 -> 81; Rental "Add rental" (new item) -1,048 -> 81; Federal
"Save figures" (patLee) the answer seen at 370; Paycheck W-4 Save -2,077 -> 124 (the changed row glows, take-home on
screen); Gifting "Add gift": the new row was already on the screen, so nothing moved (rule 2).

**Undo** (`m-undo.mjs`): Undo 60 x 44 px, on the screen, 5 of 5; the plan after Undo equal to the plan before, 5 of 5
(Prioritizer 400/300/250/0 <-> 1,189/836/585/673; Emergency fund "count it"; Subscriptions "Not a subscription"
(Netflix); an 889 KB plan; two taps 250 ms apart: the second landed on the done-row, harmless). Cost of the ticket:
1.2 ms on a 12 KB plan, 20 ms on 889 KB (the store.update itself: 22 ms).

**What-if boxes** (`m-live.mjs`): Mortgage, 250 in Extra, tap Lump sum, type 20000: today focus on nothing and Lump sum
empty (family and jordan); prototype: cursor in Lump sum holding 20000, the same box element all along, one redraw
after leaving with both figures applied. Capital gains and Brackets: a chip tapped right after typing, today not lit,
prototype lit ("+$25,000").

**Leaving a box with the keyboard up** (`m-leave.mjs`, the breaker's e6): the box now typed in moved 1 px (the screen
followed by 23 px) and stayed above the keyboard's edge.

**A plain button that saves boxes** (`m-check.mjs`, Pay off debts with `ui.check`): "50..", 99,999,999,999 and -50
refused with words at the box and the cursor in it; today 99,999,999,999 was saved under "Plan saved."

**Links in notices** (`m-target.mjs`): 19 px tall today, 45 px with the padding; a thumb 14 px off the line now hits on
Social Security, Chance the money lasts and Required withdrawals. Links in plain paragraphs (Contributions, Roth,
Debts, Mortgage) are not reached by the kit: A8.

**Every kit form sent once as drawn** (`m-net.mjs`, family and blank, every page offered, 138 forms, 0 page errors):
80 saved (forms that start filled), 37 held at a needed box with words, 13 page refusals moved above the buttons
(Equity, Expenses "Save my month", Crypto, Employer stock, Rental, Vehicles, Tax documents: the last is claude-a's page,
helped with no edit), 4 do-nothing nets, all right (Big purchase and Renovation, both households). No form was held
for a saved figure of the household's own plan (no false ceiling or date refusal).

**Touch sweep** (`qa/touch-sweep.mjs`, 10 pages x family, widow, renter, 9 rules; the local copy counts the kit's words
under a box like the browser's own message at the box, and reads `data-min`/`data-max`: what the permanent check must
learn, section 4 R5):

| rule | checked (today / prototype) | breaks today | breaks prototype | what is left |
|---|---|---|---|---|
| D-WRONG | 152 / 158 | 13 (10 saved without a word, 2 no words, 1 words off the screen) | 2 | Mortgage's two what-if boxes (hand-built, `min: 0`, "-1" quietly becomes 0): A10 |
| T-KEYBOARD | 445 / 445 | 6 (Contacts phone and email, 3 households) | 0 | (A9, done in the prototype) |
| D-FOCUS-KEPT | 181 / 181 | 2 (Mortgage) | 0 | |
| D-SEEN | 83 / 83 | 2 (Goals edit, Vehicles) | 0 | |
| D-UNDO | 28 / 28 | 1 | 1 | the same: Goals "Save changes" drops an account the goal is kept in (found on the way, section 3) |
| D-ENTER | 175 / 175 | 0 | 0 | (a first run of the prototype had 2 on Mortgage: Return waited with `ui.later`; fixed by "Return outside a form means Done", M5) |
| D-SCROLL-KEPT | 137 / 137 | 0 | 0 | |
| D-KIND | 183 / 183 | 0 | 0 | |
| D-ERROR | 296 / 296 | 0 | 0 | |
| **all 9** | | **24** | **3** | 4 min 47 s today, 4 min 33 s prototype |

The first prototype run, with the sweep as it was, read 102 breaks: 87 "no words" because it saw neither words under a
box nor a text box's limits, and percent boxes read as money because the first prototype wrapped them in `.money-in`
(now `.unit-in`). That is the R5 risk, measured.

---------------------------------------------------------------------------------------------------------------------

## 3. Adoption list for wave 2 (short)

Most behaviors need no page change. Owners: claude-b's pages in wave 2; claude-a's pages (marked *) go in the claude-a
handoff as suggestions.

| # | pages | change | findings |
|---|---|---|---|
| A1 | estate/gifting, estate/inheritance, estate/legacy, insurance/health, insurance/term-vs-permanent, retirement/annuities, retirement/pensions, scenarios/advisor-plan, property/renovation, property/purchase, property/vehicles, property/rental, ai/reader, scenarios/goal-seek | mark the amount that makes the row mean something `required: true` with `missing: "Type the amount of the gift."` (etc.); Health: `check` that the out-of-pocket maximum is not below the deductible; Goal seek: drop `step: 1000`; the reader's paste box `required` | IE-2, RC-2, RC-1, x-2 (debt-property), DP-2, T7, RC-4, W6 |
| A2 | property/home, debt/mortgage | delete the three 6-second removal timers (home :124, :127; mortgage :76): the kit keeps the words above the button | FF1 |
| A3 | debt/payoff, debt/credit-cards, and every plain button that reads boxes outside a form (grep `Number(…value)` beside `store.update` in views) | `if (!ui.check([box, ...])) return;` before the update | D2, DP-4, INV-10, R-A10 |
| A4 | cashflow/subscriptions, cashflow/recurring, goals/prioritizer, retirement/withdrawal-strategy, retirement/rmd, balance/liquidity, transactions/categorize, transactions/duplicates | one-tap changes through `ui.change`; the page's module-level `pending` gets `{ text, undo }`; `ui.notice("ok", text, { undo })` or `ui.undoLine(ticket, words)` where the thing was; drop the 4 s timer when Undo is shown | F3, x-4 (goals), x-3 (retirement-b), R4, x-4 (balance), T11, x-duplicates |
| A5 | investments/holdings, investments/tax-lots, investments/employer-stock, retirement/contributions, taxes/capital-gains, career/business, taxes/documents* | Remove asks first with `window.confirm("Remove …?")`, as the rest of the app | INV-2, x-4 (taxes) |
| A6 | investments/backtest; taxes/federal, cashflow/paycheck (optional) | Backtest: after a mix or year chip, `ui.reveal(answerCard, { block: "nearest" })`; put `data-answer` on the card that holds the answer where it is not the first changed card | INV-7, A1, x-3 (cashflow-a) |
| A7 | transactions/ledger, transactions/categories, transactions/rules, balance/net-worth, cashflow/expenses, investments/holdings, balance/projection* | the row's edit form opens inside the list card, under its row (the Debts round 14 choice); the kit already brings Save and Cancel back to the row | T9, B3, INV-5 |
| A8 | overview/next-best-action, overview/health-score, scenarios/goal-seek, household/life-events, household/calendar, retirement/social-security, contributions, monte-carlo, historical, rmd, roth-conversions, balance/liabilities, debt/mortgage, debt/ratios | "Open the page" / "Open ›" / a link inside a sentence become `ui.goTo(ctx, key)` on their own line (Pass 4 round 2: an outlined button) | R-A9, FF8, B8, F8, OV-5, RB3, RC-10 |
| A9 | household/contacts | `type: "tel"` on Phone, `type: "email"` on Email (2 lines; done in the prototype) | F7 |
| A10 | debt/mortgage, taxes/capital-gains, taxes/brackets, household/people, retirement/projection, retirement/cash-flow, cashflow/forecast, taxes/documents* | what-if boxes redraw through `ui.later(redraw)` (done in the prototype on the first three); a what-if box with limits checks itself with `ui.check([box])` before it is used | x-redraw-on-change, x-1, p-taxes/x-3 |

Found on the way (not this track's): goals/goals, renter household: "Save changes" on the emergency-fund goal drops one
of the two accounts it is kept in (`goals[setup-goal-cushion].fundedBy` lost 1 row on one tap; the touch sweep's only
D-UNDO break, today and in the prototype). For the wave 2 goals batch.

---------------------------------------------------------------------------------------------------------------------

## 4. Risks (what could be worse than today) and the exact checks

| # | risk | the check |
|---|---|---|
| R1 | The iPhone does not raise the keyboard on the wrong box, or raises it over the box. `toBox` focuses inside the tap's own submit handler (a user gesture), so the keyboard should come up; `afterDraw` runs 50 ms later (not a gesture) and so moves focus only for keyboard users. | Try-list items 1 and 2 on the owner's iPhone; by hand rule H-REAL-KEYBOARD. If the keyboard covers the box, add `visualViewport` to `toBox`'s bottom edge (already used by `revealAll`). |
| R2 | Safari does not fire `invalid` the same way, so the net (M3) misses a hand-built form and the bubble shows. | Run `m-err.mjs` cases goal-seek and update-balances under Playwright WebKit (`--browser webkit`) in the build step; try-list item 4. |
| R3 | The answer rules pick the wrong target or move when they should not (question verbs, the typed name, changed cards). | `m-result.mjs` (9 scenarios) and a census of every kit submit on every page (`m-net.mjs` extended to log `afterDraw`'s rule and target): 0 moves whose target is not inside `[data-page]`, 0 moves on rule 4; touch rules D-SEEN and D-SCROLL-KEPT on the 10 sweep pages. |
| R4 | Order with place: the kit's move undone by place's anchor, or counted as the page scrolling itself, or the echo checked before the kit moved. | On the merged build: `m-result.mjs` (answers in view) and place's `m-redraw.mjs` (place kept) both pass; D-SCROLL-KEPT counts a move as kept when the element that glows (`.kit-glow`) is on the screen. |
| R5 | Checks that read the browser's own validity (the permanent touch check, the tester's scripts) stop seeing errors, or read percent boxes as money. | Teach the permanent check: words under a box marked `aria-invalid` (its `aria-describedby` `.field-error`) count as the box's own message; `data-kind`/`data-min`/`data-max` give a text box's kind and limits. Done in the local copy for this measurement (section 2). |
| R6 | A page reads a kit number box by hand (`Number(form.elements.x.value)`) and now gets NaN from "1,200" or "5%". | grep views for `.elements.` and `querySelector('[name=` reads of `ui.form` boxes; `m-net.mjs` with "1,200" typed in every number box: the plan holds 1200 on every page. |
| R7 | A ceiling or date limit refuses a real figure (money 1e9, years 1900 to 2200, `max: today`). | `m-net.mjs` on all qa households: every edit form re-sent with its saved values is never held by range words (0 today on family and blank); a page that needs more passes `max: null`. |
| R8 | The do-nothing net speaks where the page did act in a way the kit cannot see (outside `[data-page]`, a download, a print). | `m-net.mjs`: 4 nets in 138 forms, all right; re-run on all qa households before landing. The net already stands down when the address changed or the page changed at all; the build adds: when the submit started a download (`a[download]` clicked) or `print()`. |
| R9 | Return-to-next surprises a desktop user who expects Enter to save from any box. | D-ENTER accepts "moves to the next box"; the last box saves; try-list item 3. |
| R10 | Place's notice put-back restores a page notice the kit moved, so the words show twice. | On the merged build, `m-err.mjs` vehicles-addcar and home-year1900: exactly one red line, above the button, 7 s later. |
| R11 | `ui.later` leaves old figures on screen while the box is held (like place's R6). | D-FOCUS-KEPT on Mortgage, Capital gains, Brackets; `m-live.mjs` "afterLeaving" shows both figures applied once. |
| R12 | Cost: a snapshot of cards per kit submit, a diff per one-tap change. | Measured 20 ms for the diff on an 889 KB plan; the touch rule D-TIME (200 ms of work per tap) on the 10 sweep pages before landing. |
| R13 | Two Undos race (Undo after a sync, or a second one-tap change). | `tests/ui-undo.test.mjs` (7 tests: only what still holds the value is put back); `m-undo.mjs` two taps 250 ms apart. |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari (and the home-screen app)

Where Safari differs for these mechanisms:
- **No scroll anchoring.** Chromium moves the screen itself when content is inserted above; Safari does not. The kit
  compensates by hand (M4) and must be checked with anchoring off (place sets `overflow-anchor: none` on `#content`).
- **Focus and the keyboard.** `focus()` raises the keyboard only inside a user gesture. The bad box is focused inside
  the tap's submit (keyboard up: wanted); `afterDraw` after the 50 ms redraw is not a gesture, so it focuses only for
  keyboard users and uses a glow for touch.
- **The keyboard covers about 336 px**, and Safari scrolls the focused box into the visible part itself. The kit reads
  `visualViewport` for "on the screen".
- **`enterkeyhint`** (iOS 13.4 and later) labels the key "next" / "done"; Return fires `keydown` Enter, which the kit
  turns into a move inside the key event, so the keyboard stays up between boxes.
- **`inputmode="decimal"`** shows the decimal pad: no minus, no "%". Boxes that may be negative get the letter keyboard;
  the "%" is drawn beside the box, so nobody has to type it.
- **Date boxes** open the wheel; Safari ignores `min`/`max` in the wheel, so the kit's check on Save is what refuses
  0026 or a future date.
- **Bubbles.** Safari shows its own bubble since iOS 10.3 on a form without `novalidate`; the net's `preventDefault`
  on `invalid` suppresses it (R2 checks it).
- **`window.confirm`** works in Safari and in the home-screen app (A5 relies on it).
- **Tap timing.** With `width=device-width` there is no 300 ms delay; a tap that turns into a scroll fires
  `pointercancel`, which flushes the kit's wait (M4).
- **Home-screen app.** No browser bar: the screen is taller and the top bar sits under the clock; the kit reads
  `#topbar` and `innerHeight` every time, no fixed numbers.
- **Reduce Motion** (Settings > Accessibility > Motion): the glow is a still outline; scrolls are instant anyway.

Try-list for the owner (iPhone, with `?sandbox=1`, about ten minutes):
1. Income > "+ Add another income", tap Save with nothing typed: the "What is it" box is under the top bar, the cursor
   in it, the keyboard up, and "Fill this in first." under it. No grey bubble.
2. Net worth > Edit a row low on the page, type "12..5" as the balance, Save: words under the box. Then Cancel: you are
   back at that row, in the middle of the screen, and it glows.
3. Gifting: type Sam in "To whom", press the keyboard's Next: the cursor goes to Amount and nothing is saved. Type 500,
   press Done: the gift is added and on the screen.
4. Goal seek > "Or leave at least": type 1500, tap the button: words under the box, no grey bubble.
5. Mortgage > What if: type 250 in "Extra each month", tap "One lump sum": the cursor is there and the keyboard stays;
   type 20000, press Done: the figures change once.
6. Renovation: tap Compare with the cost box empty: "Type an amount first." at the cost box.
7. Goals prioritizer: "Use these amounts", then Undo beside the green line: the amounts are as before and "Put back as
   it was." shows at the bottom.
8. House goal: open "The figures", type a price, "Work it out": the answer is just under the top bar.
9. Contacts > Add someone: the Phone box brings the phone keypad, Email the email keyboard.
10. Repeat 1 and 2 from the home-screen app, and once with Reduce Motion on.

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each small enough to verify alone)

Every step: `npm test && npm run check`, `npm run leak-guard`, `node qa/smoke-all.mjs`, the touch sweep on the 10 pages
x family, widow, renter (rules D-WRONG, D-ENTER, D-UNDO, D-SEEN, D-FOCUS-KEPT, D-KIND, T-KEYBOARD, D-SCROLL-KEPT,
D-ERROR) with no new break, one CHANGELOG line, `docs/CONVENTIONS.md` updated for the options added.

1. **S1** `core/ui/checks.js` + `tests/ui-checks.test.mjs` (pure). Check: 8 tests.
2. **S2** `core/ui/undo.js` + `tests/ui-undo.test.mjs` (note the source in the file header). Check: 7 tests.
3. **S3** Words at the box: `showError`/`clearError`/`fieldError`/`check`, `novalidate`, the submit wrapper steps 1 to 2,
   text boxes for number and percent (`data-kind`, `data-min`, `data-max`, `.unit-in`), tel/email, date limits, the
   form selectors in `base.css`. Check: `m-err.mjs`, `m-check.mjs`; the fake-DOM view tests; D-WRONG, D-KIND.
4. **S4** The net for other forms (`invalid` listener) and leaving a box (M4). Check: `m-err.mjs` goalseek-1250,
   update-junk, home-blur; `m-leave.mjs`; D-FOCUS-KEPT.
5. **S5** Return (M5), the 800 ms guard, Return outside a form. Check: `m-enter.mjs`; D-ENTER, D-TWICE.
6. **S6** Page refusals moved above the buttons and the do-nothing net (M2 steps 3 to 4). Check: `m-err.mjs`
   vehicles-addcar, home-year1900, renovation-empty, purchase-empty; `m-net.mjs` on all households.
7. **S7** Opener and Cancel (M5), with the place track's `show()` changes in hand. Check: `m-edit.mjs`; T-CANCEL.
8. **S8** `afterDraw` and `drawStart` with the shell hooks, in the order agreed with place. Check: `m-result.mjs`,
   place's `m-redraw.mjs`; D-SEEN, D-SCROLL-KEPT.
9. **S9** `ui.change`, `notice({ undo })`, `undoLine`, `setSay`. Check: `m-undo.mjs`; D-UNDO on the adopted pages.
10. **S10** `ui.later` (shared with place's M8), `ui.reveal`, `ui.goTo`, the notice-link padding. Check: `m-live.mjs`,
    `m-target.mjs`; T-TARGET.
11. **S11** Remove the `?forms=off` switch and the `window.__kitLog` probe (no hidden modes in the household's view).

Then wave 2 takes section 3 (A1 to A10) page by page.

What `docs/CONVENTIONS.md` gains (one section, "Forms, refusals and answers"): the field options `required`, `missing`,
`check(value, values)`, `whole`, `min`, `max` (`"today"` on a date), `type: "tel" | "email"`; the `ui.form` options
`check(values)` and `answer`; `ui.check`, `ui.fieldError`, `ui.change`, `ui.notice(kind, text, { undo })`,
`ui.undoLine`, `ui.later`, `ui.reveal`, `ui.goTo`, `data-answer`; and three rules: a form's refusal is never put at the
top of the page (return the words or let the kit move them), Save is never disabled to say "not yet" (the kit says why
at the box), a page that redraws itself on a box's change goes through `ui.later`.

---------------------------------------------------------------------------------------------------------------------

## 7. Design log decisions relied on, and choices made without the owner

Quoted from `docs/DESIGN_LOG.md`:
- 2026-09-15, Settings round 6: "Rule: every save/add/remove confirms with a green notice; errors are red and say what
  to do next." B1, B2, B8 are this rule carried to the box and the button.
- 2026-09-15, Debts round 14: "A) "Edit ›" on each row, the form opens inside the list card, green "Saved X." /
  "Cleared X."" (owner chose A). A7 spreads it; B7 returns to the row.
- 2026-09-15, Net worth round 4: "Owner chose: A (first visit with no accounts keeps the form open; Edit opens it filled
  in; Cancel folds it)". Cancel still folds the form; the kit only brings the row back.
- 2026-09-16, Pass 4 round 2: "the last sub-44 px tap target in the app, an inline "Update them there." link" ...
  "A) outlined button "Update balances on Net worth"" (owner chose A). A8 and `ui.goTo` follow it.
- 2026-09-16, Pass 4 round 1: "one fold per person, first open, the one just saved stays open" and "buttons on their
  own line" (owner chose A). The kit never shuts a fold; ways on go on their own line.
- 2026-09-15, Pass 2 round 8: "Rule: disabled buttons look disabled". The kit does not disable Save to say "not yet":
  a disabled button cannot say why (the owner's rule stays for a file not yet picked).
- 2026-11-06: "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own
  buttons)". No error bar or Undo bar is fixed to the bottom; the words are at the box and above the buttons.
- 2026-11-06: "Do not undo: the household's view never shows build progress, "soon" pages, or PC / AI helper / sync
  wording". New words on screen are only the box sentences of M1, "N boxes need a fix: ...", "Undo", "Put back as it
  was." and "Put back, except what was changed again since."

Choices made without the owner (each the conservative one):
1. Removes keep `window.confirm`, as the rest of the app; Undo is added only to one-tap changes that are not removes.
2. Undo sits in the page beside the green line, with no timer; no bar at the bottom.
3. An empty box says nothing until Save (no red while someone is still filling in a form).
4. Scrolls are instant (no smooth scrolling that a thumb can interrupt half way).
5. A money box refuses a billion or more unless the page says otherwise; dates from 1900 to 2200.
6. Only whole-number steps are enforced (12 months, 3 people); other steps are hints, not refusals.
7. The screen moves to an answer only when the place is gone or the button asks a question (Compare, Work it out,
   Show, Check, See, Try); otherwise the place is kept and the confirmation is copied at the bottom.
8. No keyboard pops up when a form is opened with a touch; only from a keyboard.
9. Return outside a form closes the keyboard (Done); it never saves anything by itself.
10. The prototype's `?forms=off` switch and log probe go before landing (S11).

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (55 findings)

Kit = closed by the kit alone (measured where a case is named). Adopt = needs the page change in section 3.

| finding | sev | behavior | closed by | measured |
|---|---|---|---|---|
| j-fat-fingers/FF1 | 4 | B2 | kit (M2 step 3); A2 drops the timers | m-err vehicles, home |
| p-debt-property/DP-2 | 4 | B1, B2 | kit; A1 marks Vehicles' worth needed | m-err vehicles, home; m-net (Rental, Vehicles) |
| p-debt-property/x-2 | 4 | B3 | kit (the net) | m-err renovation, purchase; m-net |
| p-insurance-estate/IE-2 | 4 | B4 | adopt A1 (required + missing words, Health check); kit ceiling 1e9 | m-err gifting blank amount (still a $0 gift until A1); the 1e9 ceiling in m-check and the node tests |
| p-investments/x-2 | 4 | B2 | kit (M2 step 3) | m-net: Crypto, Employer stock, Rental, Vehicles, Tax documents |
| j-debt-fixer/D2 | 3 | B4 | kit `ui.check` + adopt A3 | m-check (payoff) |
| j-fat-fingers/FF5 | 3 | B1 | kit | m-err goals, debts rate 500 |
| j-heavy-waiting/W6 | 3 | B4 | kit (text boxes, no step refusals); A1 for Goal seek's step | m-err vehicles 11,200 |
| p-career-household-system/F3 | 3 | B1 | kit (every wrong box marked, the count) | m-err goals (2 boxes) |
| p-debt-property/DP-4 | 3 | B4 | kit for ui.form boxes; A3 for Credit cards and Pay off debts' own buttons | m-check |
| p-insurance-estate/IE-4 | 3 | B1 | kit | m-err ltc 120000 |
| p-investments/INV-3 | 3 | B1 | kit | m-err (same mechanism as FF5); sweep D-WRONG |
| p-retirement-c-scenarios/RC-1 | 3 | B3 | adopt A1 (needed boxes on Advisor's plan) | not measured |
| p-retirement-c-scenarios/RC-4 | 3 | B4 | kit net (plain words); A1 drops the step | m-err goal-seek |
| p-retirement-c-scenarios/RC-2 | 3 | B4 | adopt A1 | m-net: held only at the empty name; a blank amount still saves until A1 |
| p-career-household-system/F7 | 2 | B6 | kit types + adopt A9 (done in the prototype) | sweep T-KEYBOARD |
| p-cashflow-a/CF-7 | 2 | B1 | kit | m-err income raise 150 (the same percent box Budget percent uses) |
| p-investments/INV-10 | 2 | B4 | kit for ui.form; A3 for hand-read boxes | sweep D-WRONG |
| p-retirement-a/R-A10 | 2 | B4 | kit (ceiling, ranges) + A3 | m-err people age 150 |
| p-taxes/T6 | 2 | B1, B12 | kit (M2, M4) | m-err home (leaving a box), income 2.555 |
| p-transactions-helpers/T7 | 2 | B3 | adopt A1 (the paste box needed) | not measured |
| p-career-household-system/x-2 | 3 | B5 | kit | m-enter (Contacts, People) |
| p-insurance-estate/x-2 | 3 | B5 | kit | m-enter (Gifting) |
| j-first-freelancer/F6 | 2 | B5 | kit | m-enter (HSA, same mechanism); sweep D-ENTER |
| p-taxes/T2 | 2 | B5 | kit | m-enter, m-result federal |
| p-transactions-helpers/T9 | 4 | B7 | kit (back to the row) + A7 (form inside the list) | m-edit (same mechanism on Net worth, Expenses) |
| j-keyboard-reader/K4 | 3 | B7, B13 | kit | m-edit (focus on Edit, keyboard open) |
| p-balance/B3 | 3 | B7 | kit + A7 | m-edit net worth, expenses |
| p-investments/INV-5 | 3 | B7 | kit + A7 | not measured on Holdings (same mechanism) |
| p-transactions-helpers/x-halfform | 3 | B7 | place track M5 (typing kept); the kit adds nothing | place's m-draft |
| p-cashflow-b-goals/F3 | 4 | B8 | kit `ui.change`/`undoLine` + adopt A4 | m-undo subscriptions |
| p-investments/INV-2 | 4 | B8 | adopt A5 (confirm, as the rest of the app) | not measured |
| p-cashflow-b-goals/x-4 | 3 | B8 | kit + adopt A4 (done in the prototype) | m-undo prioritizer |
| p-retirement-b/x-3 | 3 | B8 | kit + adopt A4 | not measured (same mechanism) |
| p-taxes/x-4 | 3 | B8 | adopt A5 | not measured |
| p-transactions-helpers/T11 | 3 | B8 | kit + adopt A4 | not measured (same mechanism) |
| p-transactions-helpers/x-duplicates | 3 | B8 | kit `undoLine` + adopt A4 | not measured (same mechanism) |
| j-first-retiree/R4 | 2 | B8 | kit + adopt A4 (Undo named beside "Use this one") | not measured |
| p-balance/x-4 | 2 | B8 | kit + adopt A4 (done in the prototype) | m-undo liquidity |
| j-keyboard-reader/x-redraw-on-change | 3 | B9 | kit `ui.later` + adopt A10 | m-live mortgage, capital gains, brackets |
| p-debt-property/x-1 | 3 | B9 | kit + A10 (done in the prototype) | m-live mortgage (family, jordan) |
| p-taxes/x-3 | 3 | B9 | kit + A10 (done in the prototype) | m-live chips |
| j-one-answer/A1 | 4 | B10 | kit (rule 3); A6 optional | m-result federal |
| p-debt-property/DP-1 | 4 | B10 | kit | m-result rent-vs-buy, renovation, rental |
| p-cashflow-b-goals/F6 | 3 | B10 | kit (helps claude-a's Vehicle with no edit) | m-result house, vehicle |
| p-investments/INV-7 | 3 | B10 | adopt A6 (`ui.reveal` after a chip) | not measured |
| p-retirement-c-scenarios/RC-11 | 3 | B10 | kit | m-result advisor |
| p-cashflow-a/x-3 | 2 | B10 | kit | m-result paycheck |
| p-retirement-a/R-A9 | 3 | B11 | kit for links in notices; A8 for the rest | m-target social-security, monte-carlo, rmd |
| j-fat-fingers/FF8 | 2 | B11 | A8 (links in plain paragraphs) | m-target (not reached by the kit) |
| p-balance/B8 | 2 | B11 | A8 | m-target liabilities (not reached) |
| p-career-household-system/F8 | 2 | B11 | A8 (`ui.goTo`) | not measured |
| p-overview-home/OV-5 | 2 | B11 | A8 | not measured |
| p-retirement-b/RB3 | 2 | B11 | kit in notices; A8 in paragraphs | m-target rmd (up), roth (not reached) |
| p-retirement-c-scenarios/RC-10 | 2 | B11 | A8 | not measured |

Compared with the forms2 design (same track, other bias): this design takes over the checking instead of steering the
browser's (M2 (a)), puts Undo in the page with no timer instead of a bar at the bottom, keys rows figure-free instead of
by element, installs its listeners at import instead of lazily (forms2-break e8: hand-built forms were missed), and
keeps only a diff per Undo (e7). It reuses forms2's pure `undo.js` and its measuring scripts.
