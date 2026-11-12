# forms2 design: critique from the person's side (a thumb, no patience, the owner's design conscience)

Walked 12 journeys from the seven theme files against design.md section 1 (Behavior) and the prototype, phone 390 x 844, touch,
sandbox, real touch taps at the control's centre, family / blank / renterDebt households. To leave the proto worktree untouched I
served a copy of it (`w1/forms2/critic/srv`; `diff -rq` of `core/` and `modules/` against `w1/forms2/proto`: identical) on
127.0.0.1:9384. Scripts: `w1/forms2/critic/j1.mjs` to `j12.mjs` (helpers `critic/clib.mjs`), pictures in `critic/shots/`.
Paths below are relative to `$SP/w1/forms2/`.

## Blocking

### 1. The Undo note (M10, B11) is a fixed bottom bar that lasts 10 s and replaces the page's own green confirmation
- **Evidence, rules.** AGENTS.md:74 "Every save, add or remove confirms itself with `ui.notice("ok", ...)`"; DESIGN_LOG 2026-09-15
  Settings round 6 Finding 4, "Rule: every save/add/remove confirms with a green notice"; CONVENTIONS.md:51 "every save, add and
  remove still needs its own notice"; DESIGN_LOG 2026-09-16 Pass 3 round 3: the owner chose the in-page green line "Kroger Dayton
  filed under Groceries (2 transactions)." for a category pick, which section 3 swaps for this note; DESIGN_LOG 2026-11-06: "No Next
  bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own buttons)". The design says "the page
  draws no green notice of its own" (2.10), which goes against the first three.
- **Evidence, measured.** `critic/j10.mjs`, `j10c.mjs` (prioritizer, family). "Use these amounts": 400/300/250/0 become
  1,189/836/585/673. No green line in the page (`in-page ok notices []`; today the page draws "Monthly amounts set on your goals." in
  view, finding x-4). The note sits at y 766 to 828 over "More on this" (`shots/j10c-expenses-under-note.png`). Four taps on
  "Expenses" under it, at 4, 8, 12 and 17 s, each landed on the note and kept it up ("note still up true" four times; `pointerdown`
  re-arms the 10 s). Left alone, it goes after 10 s, and then nothing on the page shows the old amounts or a way back ("any Undo or
  old amount on the page: false"), while "Use these amounts" is still offered as the filled button.
- **Evidence, findings.** All seven Undo findings asked for a line in the page that stays: T11 "The filed row stays in place for
  that visit as one quiet line: 'Kroger Dayton: filed under Pets. Undo'... Nothing is inserted above the list"; F3 "a quiet last row
  'Hidden: Netflix. Put back'"; x-duplicates "the pair stays as one line ... until the person leaves the page"; x-3 "an outlined
  'Undo: back to $7,000 a month' until the page is left"; x-4 and balance/x-4 "The green line carries Undo". SH-REDRAW
  j-first-retiree/x-2: "A confirmation stays until her next tap; nothing moves by itself." The app already does Undo this way in five
  places (modules/overview/guesses/view.js:53-58, balance/update/view.js:49, household/people/view.js:29, transactions/import/view.js:173,
  the guide frame's "Undo" at frame.js:261), so the note would be a second, different kind of Undo.
- **Change.** Keep the pure part (`core/ui/undo.js`: `changesOf`, `takeBack`, the lazy diff, `settle` on Undo). Replace the bar with
  an in-page helper, for example `ui.undoLine(text, onUndo)` = the green `ui.notice("ok", ...)` with an outlined 44 px "Undo" inside it.
  The page draws it through its module-level `pending`, where the change happened (the row's own slot, so the next row does not slide
  up under the thumb; or the top of the card), and keeps it until the page is left or the next change. No `position: fixed`, no timer,
  no `.undo-bar ~ .save-echo` stacking. The shell's echo already copies an off-screen green line.

### 2. One Undo takes back separate, deliberate taps (M10 "joins it")
- **Evidence.** `critic/j9.mjs` (subscriptions, family with bank lines). Netflix hidden on purpose, Spotify hidden 4 s later. The
  note reads "Spotify taken off this list (and off Bills). (2 changes)". Undo: `hidden now []`, "Put back all 2.", so Netflix is back
  too, which the note never named. Three hides 3 s apart: "Hulu taken off this list (and off Bills). (3 changes)", and one Undo put all
  three back. Every new change restarts the 10 s, so on Categorize (section 3), filing row after row at a normal pace builds one Undo
  that unfiles the whole run. "(2 changes)" and "Put back all 2." are not plain either.
- **Change.** Undo takes back exactly the change its line names, nothing earlier. A new change gets its own line, and the earlier one
  is final (or stays undoable in its own row, see 1). Two taps from one bounce are the double-tap guard's job (track "taps", P8): drop
  the stacking.

### 3. `ui.openUnder` (M9, B10) opens the form below the screen when the row is in the thumb's half of the screen
- **Evidence.** `critic/j7b.mjs` (Net worth `?under=1`, family, the third account). Edit at y 700: scrolled 0, form top 824, controls of
  the form on screen 0. Edit at y 730: form top 854, 0 controls (`shots/j7b-under-770.png`: only a cut-off heading at the bottom
  edge). This is the "the button looks dead" problem that UI-ERR and UI-EDIT are about, and section 3 rolls the helper out to 22
  list pages. Opening a row in the upper half works (`j7.mjs`: row 619, first box 767 to 811 on screen).
- **Change.** `openUnder` (or the page right after it) calls `ui.reveal` on the span from the row to the form's first box (label
  and box), with `block: "nearest"`: it does nothing when they are already on screen and scrolls the least when they are not, so the
  row stays on screen. Keep "nothing scrolls" only for when they are already on screen, and say so in B10.

## Should fix

1. **The count line goes stale.** `critic/j1.mjs` (Goals, Add goal with nothing typed): after "Roof" is typed in the first box,
   its words go but the line still says "2 boxes need a fix: What are you saving for, Amount needed." (`shots/j1-goals-after-fix1.png`).
   Count again on every `clearError`. Below 2, remove the line.
2. **A page's refusal pushes the button from under the thumb.** `critic/j4b.mjs`: on Vehicles, "Add car" moves from centre y 684 to
   745, and on Rental "Add rental" from 684 to 767. A second tap on the same spot lands on the red line
   (`DIV.notice.error.form-error`) and the focus goes to nothing. With today's kit in Chromium the button stays put. The
   D-SCROLL-KEPT rule excuses a confirmation drawn above the control, so the sweep will not catch this. Change: after drawing the line
   above `.form-actions`, scroll by its height so the buttons stay where the finger is (Safari has no scroll anchoring, so the kit
   must do this itself). The line is then just above them, still in view.
3. **The return key says "done" before the form is done.** `critic/j6.mjs` (Gifting, family): next, next, then "done" in "Year"
   adds "Gift to Sam added." while "From", "What", the 529 box and "Notes" are never reached. For a couple, "From" decides whose gift
   it is (estate/gifting/view.js:66-69). Change: "done" (and the save) only on a box with nothing left to fill after it. Otherwise
   "next" moves to the next control of any kind, a choice list included.
4. **Step words for money, and the step itself.** `critic/j12.mjs` (Goal seek): 1250 gives "Use 1000 or 2000: this box goes up in
   steps of 1000."; 750500 gives "Use 750,000 or 751,000..."; "1.5m" (the box keeps 1.5) gives "Use 0 or 1000...". This is B5's "two
   nearest valid values" in plainer words, and for 1.5m it points the wrong way. Change: write money with $ and commas ($1,000) in
   every range and step sentence. Make Goal seek's `ui.moneyBox` (section 3, one line) the first wave-2 adoption, and do not count W6
   or RC-4 as closed by wave 1.
5. **The B13 recipe must say "no timer".** `critic/j11.mjs` (goals/house `?adopt=1`): the answer heading is at 81 px with "Saved."
   inside it, which is good. But "Saved." is still removed at 4 s (house view.js `setTimeout(() => n.remove(), 4000)`, kept in the
   prototype), and the card below moves 57 px (CLS 0.053). That brings back SH-REDRAW j-first-retiree/x-2. Change: in section 3, the
   saved notice stays until the next draw, on every B13 page.
6. **Undo words.** "Put back, except what was changed again since." and "Nothing to put back: it was changed again since." are not
   plain. Change: name the thing, as the pages already do ("Netflix is back on the list."). For the rare partial case: "Undone. A part
   you changed since was left as you changed it."
7. **Focus after Undo.** `critic/j9.mjs`: after Undo the focus is on nothing (the button is removed). Change: put it on the control
   that made the change, or its twin. The opener lookup (`twin`) already exists.
8. **The ceiling sentence.** "Use 1,000,000,000 or less." reads as permission to type up to a billion. Change: for the default money
   ceiling, say what probably happened: "That is over a billion dollars: check for extra digits." A page's own tighter `max` keeps
   "Use 10,000 or less."
9. **After Save on an edit form, the confirmation is not beside the row.** `critic/j7.mjs`: with `openUnder`, the row stays on
   screen (top 532), but the only confirmation is the 3 s bottom copy, and the focus is on nothing. Without the page change, the row
   is 101 px above the screen (place track P1). T9 asked for "the confirmation beside it". Change: in section 3's openUnder row, the
   page draws its green line in that row's card (its existing `said(card)`). In the P1 ask, say that wave 1's B9 covers Cancel only.

## What held up

- **B1** (`j1`, Goals, nothing typed): no grey bubble. "Fill this in first." and "Type an amount first." under the two red boxes. The
  label shows (box at 89 px). The cursor is in the first box. A second Add goes to the remaining box. **B1** (`j2`, Debts, rate 500):
  "Use a number from 0% to 100%.", the label shows, Save is still on screen.
- **B2 and 2.2b** (`j3`, Income, raise 150, then Add income tapped straight away): the tap lands (1 `invalid`, the cursor goes to the
  raise box), and the words are under it. Typing 3 clears them. The next Add says "Pay added.".
- **B3** (`j4`, `j5`): the page's own message is above the buttons, in view, one copy after a second tap, still there after 7 s.
  On Home the year box is just above the screen and the message names it.
- **B9** (`j7` kit-cancel): Cancel brings the person back 1,537 px from the form, with the row in the middle of the screen (top 395)
  and the focus on its Edit.
- **ui.check** (`j12`, Pay off debts "50.."): the saved $50 is kept. "Type an amount in numbers, like 4,500." shows under the box,
  the label shows and the cursor is in the box.
- **The Undo mechanics** (`j9`): the plan comes back exactly. The lazy diff stays.
- **B13** (`j11`, family and blank): the answer is under the top bar, "Saved." is inside it, and the figures stay open below.
- **The new sentences** have no build, computer, AI or sync words. The words at the boxes are short, plain and say what to type.
  Disabled-looking Save is not used (DESIGN_LOG Pass 2 round 8 rule respected). Removes still ask first through `ui.confirm`, as 43
  places do.
