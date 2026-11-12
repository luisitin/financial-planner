# Critique (breaker) of the forms design, wave 1

Prototype: a byte copy of `w1/forms/proto` (c385e41 plus its uncommitted edits; `diff -rq core` identical), served from
`w1/forms/crit-break/app` on 127.0.0.1:9324, always `?sandbox=1`. The proto worktree itself was not touched (9323 and
9325 were already taken by other agents). Scripts and outputs: `w1/forms/crit-break/e*.mjs`, `out/`, `shots/`
(`$SP` = the scratchpad). Phone size 390 x 844, real touch taps at a person's pace (`PACE` 450 ms, 70 ms per key),
households the architect did not use for these steps (family with a lake cabin added, family with 3,000 bank lines).

## Blocking

### 1. The row locator guesses, and the guess glows the wrong account (B7, M5 `locate`)
- Run: `node e1-reorder.mjs` (Net worth, family). Edit "Chase checking", rename it "Chase everyday" and change the
  balance to 52,000 (the list is sorted by size, so it moves from 7th to 3rd), Save.
- Printed (`out/e1-reorder.json`): touch: `"glowed":["Ally savings"]`, kit log `target:"row" ... "Ally savings"`, rule 1,
  screen moved. Keyboard save: `"focus":"BUTTON Edit in Ally savings"`. Rename only, or move only: the right row
  (`Chase everyday`, `Chase checking`), so the wrong one comes only from the index fallback.
- Cause: `dom.js:504-509` `locate()`: when no row with the old figure-free text exists (it was renamed),
  `same.length === loc.count && same[loc.nth]` returns the nth "Edit" button of the page, which after the re-sort is
  another account. The design says it "does not guess" (M5); this is a guess, and the glow tells the person "this is
  what you saved". Today the person is left at the form: lost, but not misled. Same mechanism: a goal whose priority
  pill changes, a holding moved to another account card, twin rows ("Coffee" and "Coffee") whose amounts re-sort them.
- Change: use the index fallback only for Cancel (nothing re-sorts) or when the page's sequence of row keys is
  unchanged; for a Save, try first the row that holds the name typed in the form (`after.typed`, already captured);
  let pages put `data-key="<record id>"` on rows (A7 pages in wave 2) and have `locOf/locate` use it before any text;
  otherwise return null (rule 1 is skipped, the later rules or place's hold decide).

### 2. The do-nothing net speaks for a box that has nothing to do with it (B3, M2 step 4)
- Run: `node e2-net-decline.mjs` (Rental, family plus a "Lake cabin" property account). Type Flat, 150,000, pick Lake
  cabin as its value, rent 1,200, tap "Add rental". The page asks "Lake cabin is worth $300,000 and Flat $150,000: is
  Lake cabin really this rental?"; the person taps Cancel (no).
- Printed: today `fieldErrors: []`, nothing happens (right: the person said no). Prototype: kit log `silent-net`;
  "Type an amount first." under "What you paid" (an optional box), the cursor in it, red edge, and "One box needs a fix:
  What you paid." above the buttons (`shots/e2-on.png`). Typing an amount there and saving asks the same question again.
- Cause: `dom.js:159-163`: "nothing changed" is read as "a box was left empty", and the first blank money box is
  blamed. Any `confirm()` answered No inside a submit (Rental line 172, and every future "are you sure" in a save)
  looks the same. The m-net census could not see it: it sends forms as drawn and its confirm stub answers yes.
- Change: `ui.confirm` (the kit's) notes that a question was asked during the submit, and the net stands down when it
  was (wrap `window.confirm` too while the submit runs). Speak only for a blank box that is `required` or has
  `missing` (A1 marks Renovation's and Big purchase's costs needed anyway); with no such box, say nothing, or one
  neutral line above the button ("Nothing was saved."), never a guess at a box.

### 3. A keyboard press on a chip hands the cursor to an unrelated form and jumps 586 px (B7 "opened from the keyboard")
- Run: `node e3-keychip.mjs` (Capital gains, family, no sales yet, so the "A sale in 2026" form is open). Focus the
  "+$25,000" chip, press Enter (or Space).
- Printed: today `scrollBy 0`, focus nothing, the chip lit. Prototype: `scrollBy 586`, focus `INPUT name` of the sale
  form; the next key typed went into it (`typedInto: ["name=5"]`). Same with Space.
- Cause: `dom.js:121` + `233`: every `ui.form` built while a click is being handled takes that click as its opener,
  and `click.detail === 0` (Enter/Space, or a page's own `currentTarget.click()`) means "opened from the keyboard". The
  chip's handler redraws the whole page (capital gains `redraw()`), so the sale form that was already there is
  "opened". This makes it worse than today for the keyboard and switch users B7 is meant to help (K4).
- Change: a form is "opened" by a click only when no form with its identity (submit words + section, `sectKey`) was
  on the page before the click (note the identities at the capture `click`), and only the first such form; every other
  form built during the click gets no opener, no first-box focus.

### 4. The contract with place leaves out place's hold, which puts back the screen after a late `ui.reveal`
- Evidence: place proto `core/place.js:376-393`: `hold()` re-pins `scrollY` on every childList mutation or resize in
  `#content` for up to 8 s, and stops only on touchstart, wheel, keydown, mousedown, 700 ms quiet or the cap. This
  design relies on `ui.reveal(el)` for answers that arrive after the draw ("late pages" and "heavy pages" rows of the
  fit table; M9). On the merged build a keepScroll draw where the kit did not move (rule 2 or 4, or a plain "Run"
  button) starts place's hold; the answer's insertion fires the hold's observer one microtask after the page's
  `ui.reveal` scrolled, and the hold scrolls back. The contract only says the anchor runs when `!kitMoved` at draw time.
- Change: add to "Contract with place": every move the kit makes outside `afterDraw` (`reveal`, `comeBack`, `toBox`,
  the M4 `scrollBy`, the Undo's "Put back") first calls `place.letGo()`; `drawStart`/`afterDraw` and place's
  `before/after` agree on one "a move is under way" flag. Check on the merged build: Monte Carlo or Advisor's plan,
  a save whose answer arrives 1 to 3 s later and is revealed: the answer stays on screen.

## Should fix

1. **Words in forms the kit did not build are grey and the box has no red edge** (`node e5-netstyle.mjs`, Update my
   balances, "abc" in House, Save all balances): `color rgb(107,114,128)`, weight 400, border the focus blue,
   `inField: false`, the same look as the help line "Real estate" under it (`shots/e5-update.png`); kit forms: red, 600,
   red edge. Cause: `base.css` `.field .field-error` and `.field.has-error input` need a `.field`. Change: style
   `.field-error` and `[aria-invalid="true"]` without the `.field` ancestor (still form/notice selectors).
2. **Undo outlives the visit and later saves** (`node e4-undo-visit.mjs`, Subscriptions with bank lines): "Not a
   subscription" on Netflix, then Budget, then "Use these amounts" on the prioritizer, 5 s, then the menu back to
   Subscriptions: `afterReturn: "Netflix taken off this list (and off Bills). Undo"` at its old index, and Undo still
   worked. The design says it stays "until the next change". Cause: `ticket.can()` compares only the address
   (`dom.js:545`); pages keep `pending` in module state. Change: a ticket dies on leaving the page (a visit counter
   bumped on every address change) and when any later change is made (`storeRev` at issue vs now).
3. **The Undo ticket can include another tab's save.** `ui.change` takes `before = store.get()` (`dom.js:534`) and then
   calls `store.update`, which first adopts a newer copy written by another tab (`store.js:293-294`, `otherTab()` inside
   `update`; outside the sandbox only, so not runnable here). `changesOf(before, after)` then lists that tab's changes
   too, and Undo takes them back. It also lists what the guesses' settle moved. Change: diff inside the mutator
   (`store.update((d) => { const b = structuredClone(d); mutate(d); ticket = changesOf(b, d); })`).
4. **Cost on long pages breaks D-TIME.** `node e7-cost.mjs` (ledger, 1,012 rows shown, CPU x4, edit one row, Save
   changes), two runs: the tap's long task 76 -> 184 ms and 208 -> 238 ms; the redraw's 1,350 -> 1,914 ms and
   1,629 -> 1,919 ms. `snap()`/`blocksOf()` clone every card and row (`cloneNode(true)`, and each card holds all its
   rows again) before the submit and after the draw. Change: key rows by `textContent` length plus a short hash, no
   clones; skip rows of lists over ~200; time it in D-TIME on the ledger before landing.
5. **`after` is set when the submit changed no plan** (`dom.js:165-171`): Reconcile "Check" redraws itself and saves
   nothing, so `after` (asks: true) waits up to 4 s and is spent on the next unrelated save's redraw ("Save as
   checked"), which then moves the screen by the Check's rules. Change: set `after` only when `storeRev` moved or the
   handler returned a Promise; clear it at the next tick otherwise.
6. **`[data-answer]` is page-wide** (`dom.js:440-441`): once A6 puts it on Federal's or Paycheck's answer card, every
   form on that page (six sections on Federal) targets that card. Change: the nearest `[data-answer]` in the form's own
   card, or only for forms with `answer: true`.
7. **iPhone, keyboard up: the top edge ignores `visualViewport.offsetTop`** (`dom.js:256-257` and every `inView`,
   `wholly`, `seen`, `revealAll`): with the keyboard up Safari scrolls the visual viewport inside the layout viewport,
   the sticky top bar's rect stays at the layout top, so a box at layout y 60 to 150 counts as "seen" while it is above
   what the person sees. Change: top edge = `max(topBar(), visualViewport.offsetTop)`; add to the try
   list: a held Save with the keyboard up on a long form (Rental), and Return on the last box of Income.
8. **iPhone: hand-built number boxes** (Mortgage, Capital gains, Brackets what-ifs) go through `nativeWords` for A10's
   `ui.check`; on Safari a `type=number` box holding "12..5" may read as empty and valid, so 0 is used without a word.
   Change: offer `ui.numberBox({ min, max, percent })` (a text box read by `readNumber`, like `moneyBox`) and make A10
   and A3 use it instead of native number boxes; until then put this on the phone try list.
9. **`ui.later` can strand its function** (`dom.js:570-586`, `654`): `waiting` is never cleared when the box is removed
   without a `focusout` (a Back swipe, a sync redraw) or when `hashchange` empties `tapQueue`; a page that passes a
   module-level function would never redraw again until reload; today's pages leak a closure each time. Clear `waiting`
   with `tapQueue`, and run (or drop) a waiter whose box is no longer connected.
10. **"From the keyboard" for a save is guessed from any Space or Enter in the last 600 ms** (`dom.js:170`, `607`): a
    name typed with a space just before tapping Save counts as a keyboard save, and `afterDraw` then puts the focus on a
    card (`tabindex=-1` added). Use the submit's own event (`e.submitter` click `detail`, or the form's Enter keydown).
11. **`role=alert` on every red notice** (`dom.js:42`): notices a page draws on every render (Reconcile's "not ready"
    line) are announced again after each save's redraw; the guide frame's WARN is in two slots and also sent to
    `ctx.announce`, so it is read three times. Make `alert` only for `.form-says` and the refusal the kit moved.
12. **B7 holds for Cancel only.** Place's A1 lets the phone's Back close an edit form (`router.layer` close); that path
    runs no `comeBack`, so the person stays at the closed form. Export `ui.comeBack(form)` for the layer's close, and
    list it in A1/A7.
13. **Ask-then-save pages lose the return to the row.** Net worth's "Did it change, or was it a typing slip?" (`return
    false`, then the plain "It changed" button saves) and Update my balances never set `after`, so B7 and B10 do not
    apply on the path a slip takes. Give pages `ui.saved(form)` (or treat a store change within 4 s from a button inside
    a held form's host as that form's save).
14. **`afterDraw` is not guarded in `app.js`**: a throw in `changesFor` (any page's odd DOM) skips the keepScroll block,
    so `root.style.minHeight` stays and the echo never runs. Wrap it: `try { kitMoved = ui.afterDraw(...) } catch {}`.
15. **Rule 3 numbers come from a build without place.** Paycheck W-4 -2,077 -> 124, House, Rental: in those runs the
    fold closed, so `placeKept` was false. On the merged build place reopens folds the person opened, `placeKept` turns
    true and rule 4 applies (no move, the echo). Mark the section 2 "Answers" table as provisional until R4's merged run,
    and say which wins for a Save inside a person-opened fold whose changed figure sits 2,000 px above.

## Tried and held up

- Links in notices: `node e6-linkpad.mjs` scanned every notice link's padded area on 14 pages (Liquidity, Social
  Security, Chance the money lasts, Required withdrawals, Dashboard, Expenses, Pay off debts, Next best action, Goals,
  Net worth, Federal, Income, Contributions, Holdings) x family, renterDebt, ruth, screen by screen: 0 places where the
  13 px padding covers a button, box or other link.
- Net worth, Edit then Save with a balance that re-sorts the list, and with a rename that does not: the right row glows
  and gets the keyboard focus (e1 "move only", "rename only").
- Goals "+ Add another goal", Save with nothing typed: two red lines at the boxes, red edges (e5, kit form).
- Update my balances, "abc": no browser bubble (1 `invalid` event, prevented), the words at the box, the label under
  the top bar, the cursor in the box (e5); only the colour is wrong (should-fix 1).
- Undo's data: after a visit away and another save, Undo put back exactly Netflix (`recurringIgnored` [] again) and
  said "Netflix is back on the list." (e4).
- Double taps across the 50 ms redraw: no kit form stays open and empty after its save (tax lots, gifting and the
  folding add forms reopen as the "+ Add another" button), so the per-instance 800 ms guard has no case to miss today;
  keep D-TWICE on the taps track's guard.
- The 1e9 money ceiling: the currencies on offer (USD, EUR, MXN, GBP, CAD) leave no household figure near it.
