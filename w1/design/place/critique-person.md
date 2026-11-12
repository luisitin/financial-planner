# Critique of "place" (the person's view): place and typing memory

Critic: a layperson with a thumb and no patience, and the owner's design conscience. I walked 20 journeys from SH-BACK,
SH-DRAFT and SH-REDRAW against design.md section 1 (B1 to B14) and the prototype. Phone 390 x 844, touch, sandbox,
CDP finger drags and taps at screen points, keys one at a time (the design's own `lib.mjs`).

Where: an unchanged copy of `proto/` at `w1/place/crit-person/app` (`diff -rq` against `proto/`: no differences),
served on 127.0.0.1:9324. I copied it so the kit's `planner.properties` write never touches `proto/`.
- Scripts: `crit-person/j.mjs <j01..j20>` (`OFF=1` runs today's shell, `?place=off`), `hold.mjs` to `hold5.mjs`,
  `dbg-undo.mjs`, `dbg-undo2.mjs`, `titles.mjs`.
- Logs are in `crit-person/out/`. Pictures are in `crit-person/shots/`.

## Blocking

### 1. After a save or a Back, the screen can stand on blank space, then jump by itself or at the first touch
B9, B11, B1 and B3 all promise "nothing moves under my thumb". In these cases that promise fails, and the person ends
up worse off than today.

**What `hold.mjs`, `hold2-4.mjs` and `dbg-undo2.mjs` printed:**

| what the person did | after 1.5 s | about 8 s later, untouched | today (`OFF=1`) |
|---|---|---|---|
| Estimated payments: typed Q1, saved "Last year's return" | the page ends at screen y 357, leaving 487 px of blank grey (`shots/fix-hold-estimated-last-year-1500.png`) | jumps 426 px (scroll 1465 to 1039) | moves 57 px at 4 s |
| Income: edited Ana's salary, Save | 269 px blank (`fix-hold-income-edit-save-1500.png`) | jumps 208 px | moves 79 px at 4 s |
| Income: add form open and typed; then Goals, Edit, Save; then Back twice to Income | the whole screen is blank except the note "We kept what you typed in “Add an income”…": the page ends at y -131 (`hold2-place=nolive-after-back.png`, `hold3-save-elsewhere-then-back.png`) | jumps 914 px | no blank screen (typing lost) |
| The same form, then a reload (a tab the phone dropped) | the same blank screen at +1.3 s | at +9.5 s, 1147 to 233 | no blank screen |

**Under a touch it is worse.** Between the save and the 8 s cap, the first touch releases the borrowed height, and the
tap lands on whatever slides under the finger.
- `dbg-undo2.mjs` tapped "Undo my typing", which sat at screen y 152, 0.3 s and 3 s after the save.
- Both times the trace printed `touchstart:place-undo y=1039 … click:INPUT`: the 1st-quarter box took the tap.

**Cause.**
- `hold()` borrows `min-height` whenever `want()` is beyond the page's end (place.js:383).
- It releases that height on the first touchstart, wheel, key or mouse press (391), or at the 8 s cap (392).
- `want()` falls back to the raw `rec.y` on Back and Reload (363).
- After a save it falls back to the section heading held at its old height (326), even when the page below it is now
  shorter.

**Why the measurements missed it.**
- `m-redraw.mjs` reads at +700 ms.
- D-BACK reads "once it has stood still for three frames", and a blank screen stands still.
- D-SCROLL-KEPT measures at settle, and layout shift does not count a scroll clamp.

**Change.**
- Borrow height only while the page is still drawing (until render resolves and the first late growth settles).
- Once the page has drawn, stand at once at `min(want, page end)`.
- Never release borrowed room under a touch or at a timer.
- When the record's spot no longer exists because a form the page folded held kept typing, stand at the page's end
  (the note says why).
- Add a touch rule (D-STILL): within 1 s of any tap or Back, page content reaches the bottom edge of the screen (or
  the page's real end is on screen), and nothing moves for 10 s without a touch.
- Add both cases to section 5's phone list.

### 2. "Undo my typing" does not undo
**What `dbg-undo.mjs` printed.**
- The step: Estimated payments, type 1,000 in the 1st quarter, then save "Last year's return". "Not saved yet. Undo my
  typing" shows beside Save payments.
- A click on "Undo my typing" removes the words and empties the typing memory (`typing` becomes `{}`).
- The box still says "1,000". `j19` shows the same on a kept page: Bo's amount stays "7,777".
- So the person sees the warning go away, a figure that is not saved stays in the box, and nothing tracks it any more.

**Cause.** The capture-phase click handler treats any `type=button` inside `.form-actions` as Cancel and calls
`forget(form)` (place.js:132). The hint sits in `.form-actions`, so `dirty` is cleared before the Undo handler (208)
checks `dirty.has(c)`.

**Change.**
- Leave `.place-undo` out of the Cancel rule, or restore before forgetting.
- Add a node or kit test that the box returns to its drawn value and that a reload shows the saved value.

### 3. The bottom note's "‹ Back to the November check-in" adds a step and lands at the top: the B4 and MR-1 loop is back
**What `j06` printed.**
- The journey: check-in, step 1 "Update the balances", type 4,650, Save all.
- The note carries "‹ Back to the November 2026 check-in" (`shots/fix-j06-after-save.png`).
- Tapping it: history goes from 4 to 5, and the check-in opens at y 0 (it was left at 285).
- The phone's Back then shows Update my balances again.
- The page's own top link on the same journey (`j18`) does it right: history stays at 3 and the check-in comes back
  at 185. The note is where her eye is (MR-1), so its link is the one she taps.

**Cause.** echo() builds a plain copy, `ui.h("a", { href, onClick: go })` (app.js:369). `go` only removes the note, so
the frame's `ctx.back` handler never runs.

**Change.**
- For links as for buttons, the note replays the original control (`way.click()` while it is connected), or calls
  `ctx.back(href, loose)`.
- Add `m-links` trip "note's way back".

### 4. The note lets taps through to controls hidden under it, now for up to 12 s and next to a link that works
**What `j16` printed.**
- After Save all on the check-in step, a thumb tap on the note's words lands on what is hidden under them: "Continue
  your plan: step 2 of 8 › Your month".
- The person leaves the check-in for `#/cashflow/expenses?guide=plan&step=month`. The same box's lower row ("‹ Back
  to the … check-in") goes somewhere else.

**What `j16b` printed.**
- After "Use this one", the 160-character note covers the next option's "Use this one" (`shots/fix-j08-6s.png`).
- A tap on the note at that spot changed the plan's withdrawal method: the notice now reads "Your plan now spends what
  the years left can afford…".
- Today's note also lets taps through, but for 3.6 s and with no working part. Here it stays
  `2.5 s + 70 ms × characters + 2.5 s` (app.js:375): 12 s on both journeys.

**How it sits with the design log.** It also sits over the page's own way on for those 12 s (`j01`, `j06`, `j07`:
the "Continue your plan" row). The owner's 2026-11-06 rule reads: "No Next bar is fixed to the bottom of the screen
(it rides over the keyboard and covers the page's own buttons)".

**Change.**
- The whole note takes taps. A tap on its words closes it; only its link row follows the link (the 700 ms guard
  stays).
- Cap the note at about 6 s (MR-1's own proposal).
- Place it so it never covers the button just tapped (see S3), and say in section 7 that it covers the page's last
  row for that time.

## Should fix

**S1. The "We kept what you typed" note on a new visit points at nothing the person can see, then covers the form
(B6).**
- `j03`: Income, "+ Add another income", type, menu to Dashboard, menu to Income.
- The note appears while "+ Add another income" is below the screen (top 895).
- After she finds it and opens the form, the note is still up and covers the "What is it" box and the kind select.
  The form's "Not saved yet." is at y 1576, off the screen (`shots/fix-j03-income-reopened.png`).
- "It comes back when you open it again" does not say what to open: the form is "Add an income", the button is
  "+ Add another income".
- Change: the note goes as soon as the named form is on the page. Its one way is the opener, recorded from the tap
  that opened the form: "Open “Add an income” ›" presses "+ Add another income". The page still folds its form,
  which keeps the owner's rule.

**S2. Refilled boxes far from their button carry no sign (B3, B5).**
- `j05`: Update my balances, type two balances, reload.
- The screen comes back at the same spot (682) showing "18950" and "3,900", each beside "updated today"
  (`shots/fix-j05-update-reload.png`).
- "Not saved yet." is 145 px below the screen, and nothing on screen says these two figures are not saved. With no
  leave-warning (choice 1), she can leave believing they were saved.
- Change: when the form's button is off the screen, also put the "Not saved yet." line at the top of the form, or a
  small "not saved" under each refilled box.

**S3. The note at the top is not where the eye is (B10).**
- `j14`: Save all tapped at screen y 765. The copy appears under the top bar, 600 px away, over the Ally savings box,
  and its "See net worth ›" row sits on that box for up to 12 s (`shots/fix-j14-top-note.png`).
- A thumb's Save is usually in the lowest 150 px, so this rule fires often.
- Change: when the bottom would cover the tapped button, put the note just above that button instead of under the
  top bar.

**S4. "‹ Your plan" lands differently depending on how far she went.**
- `j10b`: Your plan, left at 670; first result; "Next result"; then "‹ Your plan".
- Your plan opens at y 0 and history grows by 1. From the first result the same words return her to 670.
- Change: a "‹ Back to …" link that cannot step back still opens that page at the spot this tab last recorded for it.
  The words say "Back".

**S5. The note's form names would show figures and the fold's chevron.**
- `titles.mjs`, run on every form drawn on 64 built pages for the family: 60 of 87 titles would be quoted as, for
  example, “Raises and promotions3.0%›” or “Your coverage and your billsjust you, $5,000 a year›”.
- Cause: `querySelector(":scope > summary .fold-title, :scope > summary")` returns the summary first (place.js:160).
- Today such forms stay on the page and are refilled, so the note rarely names them. Any later use would put garbled
  words on screen.
- Change: use `foldTitle(d)`.

**S6. A kept page shows the old confirmation again (`j11`).**
- Net worth, "Save today's totals", menu to Dashboard, Back. "Today's totals saved." is on screen again, because the
  put-back keeps it.
- It is true, but it reads as just happened. Today, Back shows no notice.
- Change: a kept page drops the `.notice.ok` the person has already seen.

**S7. Section 5, the phone list.** Add these checks:
- (a) After Save on Estimated payments' "Last year", and after Back to Income with a typed add form: no grey space,
  no jump at the first touch.
- (b) A tap on the note's words does nothing under it.
- (c) "Undo my typing" puts the saved figure back.

**Touch rules.**
- Blocking 1 and 4 are not caught by the current rules: D-BACK and D-SCROLL-KEPT read a still screen, and T-COVERED is
  static. Add D-STILL (blocking 1) and a "note covers controls" check to D-SEEN.
- With 1 to 4 fixed, the design's claims for D-BACK, D-SCROLL-KEPT and D-SEEN stand as measured.

## What I tried that held up
- **B1 (Back to a kept page).** Expenses left at 570 with "See or change each bill" open; menu to Dashboard, Back:
  570, still open (`j09`).
- **B4 (Quick answers).** "‹ Quick answers" from an answer brings back 855 with history unchanged (`j10`). The
  frame's own check-in link brings back 185 with history unchanged (`j18`).
- **Slow phone.** Will the money last? at CPU x4, redrawn on Back (nolive): drawn by +100 ms, 33 px from where it was
  left, no blank screen (`j17`).
- **B12 (the menu).** Back closes the menu and stays at 570. A menu row then Back returns to the page with its fold
  open. A Forward after that is a harmless no-op (`j09`).
- **B8 (a save elsewhere on the page).**
  - Health: after Save in "Your coverage", the typed plan is still there and "Add plan · Not saved yet. Undo my
    typing" is readable at screen y 92, with "Saved." at the bottom (`shots/fix-j01-health-after.png`).
  - Estimated payments: 1,000 kept and the hint readable (`j02`).
- **B7 (a stray tap on another row).** The stray tap on Bo's row says “Edit Ana's salary” is kept; tapping Ana's row
  shows 9999 (`j04`).
- **B9 (Save settings on Will the money last?).** The fold stays open, the button does not move, and "Retirement
  settings saved." is at the bottom (`j07`).
- **B11 (How much to take out).** The notice stays and "Use this one" does not move over 6 s (`j08`).
- **No false "kept" notes.** None after Add or Cancel on a new visit (`j19`), and none on the Dashboard (`j03`).
- **Get started.** A reload keeps the typed name "Robin" (`j15`).
- **New words on screen.** "Not saved yet." and "Undo my typing" are plain. The app's other "Undo" buttons (the saved
  notices on Update my balances, Guesses, People, Import, Statements) mean "take back the save", and the words "my
  typing" keep the two apart.
- **No conflict with "a page with data folds its add form" (2026-09-15).** The design leaves folding to the page.
