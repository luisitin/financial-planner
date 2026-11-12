# Critique of place2 (the person's view): place and typing memory

Critic: a layperson with a thumb and no patience, and the owner's design conscience. I walked 12 journeys taken from
SH-BACK, SH-DRAFT and SH-REDRAW against the design's section 1 (B1 to B13) and the prototype, at 390 x 844 with touch,
in the sandbox. Real thumb drags and taps at screen points (`lib.mjs` from the design), never tool scrolling, and
trusted key presses where a page reacts only to a person (a select changed by script is ignored by `place.js`).

Where: an unchanged copy of the prototype at `.../w1/place2/cp/proto` (`diff -rq` of `core/` and `frame.js` against
`proto/`: identical; copied so the kit's `planner.properties` write never touches `proto/`), served on 127.0.0.1:9364.
Scripts are `.../w1/place2/cp/j01-back.mjs` to `j13-stale.mjs` (helpers in `cp/j.mjs`). Pictures are in `cp/shots/`.
`anchor=off` means Chromium's scroll anchoring is off, as on Safari. `place=off` is today's shell.

## Blocking

### 1. Typing kept on the page you went to: a phantom "kept" line on the Dashboard
- **Steps** (`j07-income.mjs A`, `A2`): Income, tap "Ana's salary", type 9,999 in Amount, press the phone's Back.
- **Seen.** The Dashboard shows a green-tick copy: "Your typing in “Income sources” is kept. Open it again to finish
  it." (`shots/j07-A-1-after-back.png`). `sessionStorage` then holds the draft twice: under `cashflow/income` and under
  `overview/dashboard`. A later fresh visit to the Dashboard (menu, Expenses, menu, Dashboard) opens with
  "What you typed in “Income sources” is kept, not saved yet. Open it again to finish it. [Throw it away]" at its top,
  on a page that has no such form.
- **Cause.**
  - `place.leave()` detaches the page with `r.replaceChildren()` (place.js:361).
  - On a kept return, show() calls `place.done()` synchronously (app.js:279), before the MutationObserver callback runs.
  - The observer then reads that detach as "the page took a form away". It files the typing under the new page:
    `mem.drafts[current.path]` (place.js:291).
- **Change.**
  - leave() discards its own records (`mo.takeRecords()` before and after the detach) or sets a flag the observer
    honours.
  - Park typing under the path where it was typed (keep the path in `where`), never under `current.path`.
  - Test: Back from an open edit form, then check that the Dashboard shows no line.

### 2. The kept-typing words name the wrong thing, behind a green tick
- **Steps** (`j08-stray.mjs`): Ana's salary has 9,999 typed, and a stray tap lands on "Bo's salary".
- **Seen.**
  - The copy reads "✓ Your typing in “Income sources” is kept. Open it again to finish it."
    (`shots/j08-1-stray.png`).
  - On a new visit, the line at the top says the same "Income sources" (`j07-income.mjs C`).
  - "Income sources" is the list's card, which is always open. Nothing tells her to tap Ana's row.
  - The design's own text (B7, B9) promises “Edit Ana's salary”.
- **Cause.**
  - formName() (place.js:141) takes the first heading of the card around the form, which is the list title.
  - The copy is drawn with the save's green tick (`echo()` with `bad = false`). AGENTS.md says: "green/amber/red only
    mean good/attention/bad".
  - "Kept" beside a green tick reads as "saved". That is the misreading B6 exists to prevent.
- **Change.**
  - Name the nearest heading above the form inside its host ("Edit Ana's salary"), else the row's title.
  - Use the neutral (info) style with no tick.
  - Say "not saved" and what to tap: "Ana's salary: what you typed is not saved yet. Tap Ana's salary to finish it."

### 3. Get started says "We kept what you typed" while two of the three figures are gone (B8's headline case)
- **Steps** (`j09-setup.mjs samMidSetup overview/setup/owe-amounts`): on question 5, type 5,200, 12,000 and 90000 in
  the credit card boxes, then reload.
- **Seen.**
  - Only the third box comes back.
  - "Paid a month" and "Still owed" show the grey guesses $50 and $1,600 under the blue line "We kept what you typed
    here. It is not saved yet." (`shots/j09-b-reload-samMidSetup-owe-amounts.png`).
  - Today says nothing. The prototype says something false.
  - Questions 2 and 4 came back whole.
- **Cause.**
  - The setup boxes rewrite their `aria-label` as you type: ", leave blank to use our guess of about $50" is dropped
    (`modules/overview/setup/view.js:843, 1047, 1307, 1333`; the same pattern in `overview/guesses/view.js:300`;
    `dbg-owe.mjs` prints both labels).
  - The locator's own name prefers `aria-label` (place.js:78), so the key saved after typing never matches the newly
    drawn box.
  - The e5 census (8,484 of 8,484) located freshly drawn controls. It never located a box after typing in it.
- **Change.**
  - Take a box's own name from its visible label (`.field-label`), scoped by its section ("Credit cards"), or take the
    locator once, when the box is first drawn.
  - Show the kept line only for boxes actually refilled. Never claim more than came back.
  - Add "type in every box, then locate" to e5.

### 4. A confirmation leaving still moves the page under a resting thumb (B12 fails exactly when a thumb is down)
- **Steps and seen.**
  - `j10-notice.mjs anchor=off 3900`: on How much to take out, tap "Use this one", then rest a thumb on the screen at
    +3.9 s. The rows move from 353/534/843 to 229/410/719 (124 px). The row under the thumb changes from "Trim after
    bad years" to "Spend what the years left can afford".
  - `j10b-tap.mjs anchor=off 3950 450`: a slow tap aimed at "Use this one" (Same spending every year) at +3.95 s lands
    on plain text and chooses nothing. The same tap at +2.5 s chooses it.
  - Today (`place=off`): the same 124 px.
- **Cause.**
  - app.js:359 sets `n.remove = function () { if (place.recentInput()) ...remove... }`.
  - Any `pointerdown` in the last 0.9 s lets the page's 4 s timer remove the notice, which is the moment a thumb is on
    the glass. Starting a scroll on iPhone also fires `pointerdown`.
  - The exception protects a case the design says does not exist (risk 8: "none found in the views today").
- **Change.**
  - A save's fresh notices are never removed by the page; the next redraw replaces them.
  - Have the check watch for 5 s after the tap, with a thumb down at 4 s.

### 5. Back to a page whose open form is gone: blank screen, a 463 px jump by itself, and the kept line off screen
- **Steps** (`j07c-trace.mjs`):
  1. On Income, open Ana's salary (y 827) and type 9,999.
  2. Use the menu to go to Update my balances and save one balance.
  3. Press the phone's Back.
- **Seen.**
  - The screen lands at 827 on a held page of 1,996 px. Under "Continue your plan" there is a screen of empty grey
    (`shots/j07-B-1-after-back.png`).
  - At 2,922 ms, with no touch, scrollY goes from 827 to 364 and the page from 1,996 px to 1,208 px.
  - "What you typed in … is kept" sits at top −749 (later −286), so she never sees it. She sees no form, no 9,999 and
    no line.
  - Today (`place=off`): she lands at 233 at once and nothing moves later.
- **Cause.**
  - The return holds an anchor chain whose first landmark (the edit form) is gone, using borrowed height
    (app.js:288, 413).
  - The borrowed height is released at 2.5 s.
  - The parked line goes before the page (app.js:405).
- **Change.**
  - When the person's anchor is not drawn, borrow no height.
  - Land on the row whose form held the typing; the row title is in the parked locator.
  - Put the kept note beside that row, or in the bottom copy, where the eye is.

## Should fix

- **S1. From the check-in, the copy's link leads out of the check-in.**
  - `j04-update.mjs` (accounts dated 2026-10-09): check-in step 1, Update my balances, Save all balances.
  - The copy carries "See net worth ›". Tapping it opens `#/balance/net-worth` without `from=review`, so that page has no
    way back to the check-in.
  - MR-1's "should" asks for "‹ Back to the November check-in" when the page was opened from the check-in.
  - Change: on a `from=review`, guide or plan page, the copy carries the frame's back link, alone or as the second tap.
- **S2. The copy covers the button just tapped for 7 s.**
  - `j04`: the copy spans y 691 to 828. The tapped "Save all balances" (y 740) is under it: `elementFromPoint` at the tap
    point is the Save button, beneath a copy with `pointer-events: none`.
  - DESIGN_LOG 2026-11-06 gives the reason there is no bottom bar: "it rides over the keyboard and covers the page's own
    buttons".
  - Change: when the bottom copy would cover the tapped control, draw it at the top (as the first design does).
- **S3. The copy outlives its page.** "Balances saved … See net worth ›" still floats over Income after Back (`j07 B`).
  Change: remove it when the address changes.
- **S4. "‹ Your plan" after "Next result" behaves as today.**
  - `j03-plan.mjs`: Your plan at 894, Life insurance, Next result, Will the money last?, then "‹ Your plan".
  - Result: y 0, history +1. The phone's Back then replays Will the money last? and Life insurance.
  - "Next result" is the owner's designed walk (DESIGN_LOG 2026-11-06 rule), so a single step is the rare case.
  - Change: when every entry since the last Your plan is a `from=plan` page, use `history.go(-n)`. Otherwise follow the
    link but land at that path's newest recorded place (a back link is a Back).
- **S5. One cue, in words that cannot be misread.**
  - There are two cues today:
    - "We kept what you typed here. It is not saved yet. [Clear it]": a blue box inserted about 90 px into a form that
      has just opened (`shots/j08-2-ana-again.png`).
    - "Not saved yet" beside the button (`shots/j06-health-after-family.png`).
  - Next to a message, "Clear it" reads as "dismiss this note", and the figures vanish.
  - Change: one cue by the form's button, "Not saved yet · Undo my typing". The architect already leans this way
    (design, "Compared", item 8).
- **S6. A kept page brings back an old green line.**
  - `j13-stale.mjs`: on Goals, edit and Save ("Changes saved."), then the menu to Expenses, then Back. "Changes saved."
    is on screen again (kept page). Today it is gone.
  - Change: strip a save's notices from a page when it goes into the cache.
- **S7. Kept typing never ends.**
  - `sessionStorage` lives as long as the tab, and a home-screen app can keep its session for days. A 9,999 she gave up
    on can come back beside a Save that saves it.
  - Change: take the first design's 24 h expiry.
- **S8. B5's wording promises too much.** On Will the money last? (`j05-projection.mjs`), the fold stays open and
  "Retirement settings saved." is in view. Save itself moves 145 px down, off screen: the page scrolls its notice into
  view, and the page wins. That is the right outcome; write B5 as "the confirmation, or the button, stays in view".
- **Touch check.**
  - From what I saw, D-BACK, D-SEEN and D-FOCUS-KEPT should turn green.
  - D-SCROLL-KEPT turns green as measured right after a tap, but blocking 4 and 5 move the page 2.9 s and 4 s later.
    Extend its window to 5 s, also after Back.
  - D-TOP needs the stated exception for `a[data-back]` and "‹" links.
- **On the iPhone, check:**
  - whether `pointerdown` fires as a scroll starts (it makes blocking 4 more frequent);
  - where the fixed bottom copy sits while the keyboard is up;
  - whether the swipe-back picture matches the kept page.

## What I tried that held up

- **B1** (`j01-back.mjs keep=off 4`, the redraw path, processor 4x slower): All pages (16,745 px), left at 3,720 by
  "Subscriptions", then Back. The place is on screen in the first painted frame: the row at 297 instead of 336, and one
  frame at 207 ms still shows the page being left. Today (`place=off`): at 0 for the whole 3 s.
- **B2 and the design log** (`j02-start.mjs`, empty plan): Get started, "Just want one answer?", tile 7, Back. The fold
  is open at the same scroll position (311); tile 7 moved 57 px. A fresh visit by the menu shows the tiles folded at
  y 0, as chosen on 2026-11-06.
- **B6** (`j06-health.mjs`): "Silver PPO", 250 and 3,000 survive the coverage Save. "Not saved yet" sits beside Add
  plan, the coverage Save stays at y 673, and a bottom "Saved." appears. Today all three boxes are emptied.
- **B13** (`j07 A`): Income edit form, Back, then Forward. The form is open with 9,999, at y 827.
- **B9 and Cancel** (`j08`): the stray tap keeps Ana's typing and gives it back when her row is opened again. Cancel
  throws it away: no line on the next visit.
- **B8 elsewhere** (`j09`): on questions 2 and 4, a reload brings back every typed box.
- **B10** (`j11-runs.mjs`, a trusted key on Runs): "How this is done" stays open. I looked for an invented "kept"
  message because the page replaces the select: none appeared, and nothing was stored.
- **B2 and B3 on Settings** (`j12-settings.mjs`): "Assets and debts" is still open after menu plus Back and after a
  reload. The plan name is kept, with its line, after the reload.
- **B11 double tap** (`j04 same`): a second tap on the Save spot hits Save, not the copy's link (9 px apart).
- **Plain words.** No new word on screen is technical. "Throw it away" is blunt but clear. The problems are the
  wrong names (blocking 2) and "Clear it" (S5), not jargon.
