# Wave 1, fix round 1 (fix-1)

The combined build in `w1/integ` is still three commits on 707355c, with every fix squashed into the commit that owns
the code:

| commit | part |
|---|---|
| bd2cc32 | forms: every form speaks in plain words at the box |
| 2e55551 | place: Back returns to the same spot; typing and open sections are kept |
| 7963428 | taps: a second tap does one thing; the menu, its search and the ways back |

The patches are in `w1/integ-patches` (`git format-patch 707355c..HEAD`). The fixes went in as `--fixup` commits and
were squashed with `git rebase -i --autosquash 707355c`. The tree is the same before and after the squash. Two commit
messages were then reworded with `git commit-tree`, keeping the same trees:
- place: the bottom note "lets a tap through" (it used to say "takes taps"); the reopened form, the kept way back and
  erase are added.
- taps: every page opens by its address; the carried check-in line is at the bottom.

**Method.** Each finding was first run with the verifier's own steps against the round-1 build, twice, as a snapshot
on its own port. Only then was it fixed and the same script run against the fixed build (`w1/integ` on 9621). Scripts
and their outputs are in `w1/fix1/` (`*.mjs`, `out/`, `tw/`, `rb/`, `f1/`, `f2/`); for an item, "before" and "after"
name those files. Everything ran in the sandbox at 390 px, with real touches unless it says otherwise.

## Fixed

### Place (commit 2e55551)

1. **A form left open came back shut behind "Open it"** (place.md partly: FF2, x-typed-lost, B1, x-3, x-half-typed-form-lost, CF-2, INV-4). Severity: partly.
   - Reproduced: 2 of 2.
   - Change: on Back, Forward and Reload, `place.reopen()` taps the form's own opener for the person, under
     `router.quietLayers`, so no step is added to Back. The typing goes back into its boxes, with "Not saved yet" and
     "Undo my typing" beside the button. The one line with "Open it" is now only for a form that is still shut.
   - Check: `fix1/reopen.mjs` runs a1 to a5 on all seven journeys: every form is open with its typing on Back, still
     there after Forward and Back again, history 2 to 3, 0 errors (`out/reopen-a5.txt`). The acceptance variant
     `B6-reopen` passes 3 of 3.
2. **Place new problem 1** (severity 4; place.md p-retirement-b/x-1 "worse"). After "Use this one", another option's
   identical button was put under the thumb.
   - Reproduced: Roth (ruth) and withdrawal order (family), 2 of 2. `fix1/pb/out/thumb-before1.txt`: the 12% rate's
     "Use this one" and "Taxable, then pre-tax"'s "Use this order" sat under the thumb from +0.3 s to 7 s.
   - Change: `locate()` never takes a same-named control by its index on the page. Twins (rows alike except for their
     figures) are told apart by their row's words (`pickTwin`) or by their figures (`byFigures`). When the tapped one is
     gone from its own row or card, its row or card is held instead.
   - Check: the `tests/place.test.mjs` test "twins (alike but for their figures)". `pb/out/thumb-after1.txt` to
     `-after6.txt`: plain text is under the thumb on Roth and on withdrawal order, so a re-tap does nothing.
   - Not changed: on How much to take out, the page scrolls its own line into view (`view.js:169`), and the page wins.
     "Put it back" then sits under the thumb. That is page code, listed under page adoption.
3. **Place new problem 2** (severity 3). The bottom note swallowed the tap on whatever it covered.
   - Reproduced: 2 of 2 (`pb/out/newprob-under-before1.txt`, `-before2.txt`: the focus went to the body).
   - Change: the note lets taps through (`pointer-events: none`, except its own ways). A finger put down on it closes it,
     and the tap goes on to the box or button under it.
   - Check: `pb/out/newprob-under-after1.txt` and `-after2.txt`: the tap on "Yearly raise" under the note puts the
     cursor in that box.
4. **Place new problem 3** (severity 2). On Scenario compare, the kept typing had no "Open it".
   - Reproduced: family and patLee (`out/compare-family-b.txt`: the buttons were only "Undo my typing").
   - Change: the opener is recorded for that form too.
   - Check: `out/compare-family-a.txt` / `compare-patLee-a.txt` show "Open it" on the line and in the note.
5. **Place new problem 4** (severity 2; R-A4 partly). A message half under the top bar got no bottom note.
   - Reproduced: 2 of 2 (`pb/out/fix2-tick-b1.txt`, `-b2.txt`: the line at 20 to 114, bar to 56, no note).
   - Change: `seenEnough()` counts a notice as read only when its first line is below the bar.
   - Check: the `tests/place.test.mjs` "place NP4" case (62% showing with the first line under the bar is not read).
     `pb/out/fix2-tick-a1.txt` and `-a2.txt` show the bottom note.
5b. **Place new problem 5** (severity 1). A stale "Open it" stayed on the note after the form was open again.
   - Reproduced: `pb/out/newprob-stale-before.txt`.
   - Change: the note goes once the form it names is open.
   - Check: `pb/out/newprob-stale-after1.txt` and `-after2.txt`: the note is gone.
6. **Place new problem 8** (severity 2; the part of j-first-freelancer/x-1 that was left). On Long-term care, Save moved
   23 to 65 px after its own save.
   - Reproduced: family 2 of 2 and ruth 1 of 1. On the snapshot, Save moved from under the thumb at 539 to 603, and the
     thumb was then on the help text (`out/np8-snap-family-1.txt`, `-2.txt`, `np8-snap-ruth-1.txt`).
   - Cause: this page works its answer out after it is drawn (`ctx.computeRemote`, "Running your plan…"). `afterSave()`
     looked for the tapped Save before it existed, found nothing, and held nothing (`out/np8d-w1.txt`: pick null).
   - Change: while `#content` says `aria-busy`, `afterSave()` looks for the tapped thing again as the page grows, and
     opens the sections the person had open as they come.
   - Check: Save stays under the thumb from 100 ms to 5 s, at 550 and 539 with the thumb at 572 and 560. The bottom note
     "Care settings saved." shows (`out/np8-w1-family-1.txt`, `-2.txt`, `np8-w1-ruth-1.txt`).
7. **forms2 new problem 1** (severity 2). A way back after a one-tap change was gone after Back.
   - Reproduced: prioritizer, family, 2 of 2 (`out/np1-snap-1.txt`, `-2.txt`); How much to take out, ruth, 2 of 2;
     Emergency fund, family, 2 of 2 (`out/np1b-snap-*`).
   - Change: `core/app.js` keeps a page's green lines that have their own button (Undo, "Put back my amounts", "Put it
     back: ...") with the history entry, when the person leaves. Back or Forward puts the same line, with the same
     button, back where it was. This happens only while the plan is the same object (`store.get()`), so any save
     since, here or from another device, means it is not offered. The lines are kept in memory only.
     docs/CONVENTIONS.md says this ("Back, Forward, Reload" and the Undo rule).
   - Check: after Dashboard and Back, the line and "Put back my amounts" are there at the same spot (y 366). Tapping it
     puts back 400/300/250/0 (`out/np1-w1-1.txt`, `-2.txt`). "Put it back" and "Undo" do the same
     (`out/np1b-w1-ws-1.txt`, `np1b-w1-lq-1.txt`). After a change on another page, Back shows no line
     (`out/np1b-w1-changed-1.txt`).
8. **forms2 new problem 2** (severity 1, fixed anyway). The window error "ResizeObserver loop completed with undelivered
   notifications".
   - Reproduced: Rent vs buy, family and renterDebt, with the verifier's own script copied to `fix1/f2/`
     (`f2/out/r1-snap1-rvb.txt`).
   - Change: `hold()` scrolls inside the observer, which resizes nothing. It frees the room it lent and reopens the
     sections one frame later.
   - Check: `f2/out/r1-w1a-rvb.txt` and `r1-w1a-reno.txt` show errors [] and the same place as before.
9. **regress-person 1** (severity 5). A correction was undone: one Backspace after a pause put the stray key back.
   - Reproduced: 2 of 2.
   - Change: a box the person is typing in is never written into, nor let go (`refillVerdict` "same" mid-typing).
   - Check: the `tests/place.test.mjs` test "a box the person is typing in now is never written into". `out/r2-w1-runfix.txt`:
     "3,9000", Backspace, stays "3,900". `out/r4-w1-debt_mortgage-run1fix.txt`: the second Backspace empties the box.
10. **regress-person 2** (severity 3). A false "Some of what you typed ... was not put back" showed on the next page.
    - Reproduced: 2 of 2 (`out/r3-w1-run1.txt`, `-run2.txt`).
    - Change: the same rule as item 9 (`refillVerdict`). A box typed in on the page shown holds a value that is
      neither the kept one nor the drawn one; it was judged "changed since". It is now "same", so the note is not
      said.
    - Check: `out/r3-w1-run1fix.txt` and `-run2fix.txt`: no such note on the Dashboard, and Back shows the line with
      "Open it".
11. **regress-person 3** (severity 2). The check-in's way back disappeared after a look at another page and Back.
    - Reproduced: 2 of 2 (`out/r9-menu-runb1.txt`, `-runb2.txt`: ways [] after the Dashboard and Back).
    - Change: the carried trail is kept in `history.state.ciTrail` for that entry (frame.js, in the taps commit).
    - Check: `out/r9-menu-runa1.txt` and `-runa2.txt` show the line again after the Dashboard and Back.
12. **regress-person 4(a)** and **topways new problem 2** (severity 2 and 3). There were two "‹" at the top of Update my
    balances, going to different pages, and the carried check-in link went forward and lost the place.
    - Reproduced: 2 of 2 each (`out/r5-runb1-390.txt`).
    - Change: the carried check-in line is no longer at the top. It is a second quiet line at the bottom, under the
      named way back to the page just behind. It carries `data-back="1"`, and `router.back(href, over)` goes back two
      entries when the check-in is two behind.
    - Check: `out/r5-runa1-390.txt` and `r5-runa2-320.txt` show only the bar's "‹" at the top. `tw/out/ways5.log`: check-in > Needs
      attention > Visa > "‹ Back to the October 2026 check-in" returns to the check-in at y 673, where it was left,
      with history 6 to 6. The `tests/place.test.mjs` `backSteps` cases cover the month and over rules.
13. **MR-4, the part that can be fixed**: "Needs attention" was named nowhere on a row opened from check-in step 7.
    - Change: the named way back is drawn even when the check-in trail is (frame.js).
    - Check: `tw/out/ways5.log` shows "‹ Back to Needs attention" and then "‹ Back to the October 2026 check-in" at the
      bottom.
14. **regress-break 1** (severity 3). Forward, and the next Back, drew nothing: the address said one page and the screen
    showed another.
    - Reproduced: 2 of 2.
    - Change: router entries keep their own numbers when storage throws, and on the first open after the upgrade.
    - Check: the `tests/router-replace.test.mjs` cases ("Forward draws the page of its address"); `rb/out/p1-storage.txt`
      and `p2-upgrade.txt` show every Back and Forward drawing its address.
15. **regress-break 3** (severity 2). After "Erase the copy on this device", the erased plan's typing came back.
    - Reproduced: 2 of 2.
    - Change: `store.eraseDevice()` and the Settings restore send `planner:erased`, and `place.forgetAll()` drops the
      typing and the places kept. A record whose form is now drawn another way is dropped, and the person is told once.
    - Check: the `tests/store-sync.test.mjs` erase-event test (it fails on the old code); `rb/out/p7-erase.txt` shows no
      lines after the erase in 2 of 2 runs.
16. **regress-break 4** (severity 2). A thumb down while a save redraws left a long blank space.
    - Reproduced: 4 of 4.
    - Change: the touch count follows `e.touches.length`. The borrowed room waits for the last finger to lift, and the
      cap lets it go whatever the fingers say.
    - Check: `rb/out/p17b-room.txt` shows min-height "" and 60 px under the page (the page's own padding) in 2 of 2
      runs, and the same in 4 of 4 for p17.
17. **forms1 new problem 1** and **tapmenu new problem 3** (severity 2). "Pay added." and "Dr Lee added." were said twice.
    - Reproduced: 2 of 2 each (`out/twice-both-b1.txt`, `twice-contacts-b2.txt`).
    - Change: the bottom note goes as soon as the page's own line comes into view.
    - Check: `out/twice-income-a1.txt` and `twice-contacts-a3.txt` show the line once and no note.
18. **forms1 K4** (partly) and **forms1 new problem 2** (severity 2). After a keyboard save whose line is off screen,
    the focus went to the top of the app.
    - Reproduced: 2 of 2.
    - Change: the focus goes to this save's green line, even off screen (the bottom note says its words).
    - Check: `f1/out/k4.txt` shows the focus on "Side gig added." after the Return walk.

### Taps (commit 7963428)

19. **tapmenu new problem 1** (severity 3; j-navigator/x-4 partly). The menu opened on a scrolled page hid the top bar,
    so the cross could not be tapped.
    - Reproduced: 3 of 4 pages (`out/t1-w1-before1.txt`, `-before2.txt`; the page at y 0 was fine).
    - Change: the menu lock is `html.drawer-open { overflow: hidden; }` only. There is no `position: fixed` on the body,
      so the page keeps its scroll and the bar stays at the top.
    - Check: `out/t1-w1-after1.txt` shows the bar top at 0 and the cross closing the menu on all four pages.
20. **tapmenu new problem 2** (severity 2). A blank page flashed between every two pages (148 to 289 ms).
    - Reproduced: 3 of 3 runs on Dashboard > Your plan and Back (`out/t2-snap-before1..3.txt`: a blank frame there and
      back, 16 to 289 ms). On Income > Expenses: 1 blank frame on Back in run 3. The ruth case did not reach its link in
      either build (a script locator time-out).
    - Change: a page not known to be slow keeps the page before on the screen, inert and hidden from screen readers,
      until the new page draws. A heavy page clears at once and says "Working it out…".
    - Check: `out/t2-w1-after1..3.txt` show 0 blank frames there and back, on both pages that were reached.
21. **K5** (partly) and **tapmenu new problem 4** (severity 2). Assumptions' save was read out twice.
    - Reproduced: family and ruth, 2 of 2 (`out/k5-snap-before*.txt`).
    - Change: words already read in the last 2 s are not read again.
    - Check: `out/k5-w1-after1.txt` shows them read once.
22. **tapmenu new problem 5** and **p-career-household-system/x-3** (partly). Searching "debt payoff" ranked Net worth
    projection first, and "language" found nothing.
    - Reproduced: family and ruth, 2 of 2 (`out/smenu-snap-before*.txt`).
    - Change: `core/search.js` PLAIN words: "debt payoff" and "payoff" for Pay off debts, "language" for Settings.
    - Check: the `tests/search-words.test.mjs` test (it fails on the old code); `out/smenu-w1-after2.txt` shows Pay off
      debts first and Settings for "language".
23. **topways new problem 1** (severity 3). The helper's pages (Ask the plan, Explain, Categorizer, Plan critic) said
    "Page not found".
    - Reproduced: 2 of 2 (`out/ai-snap-before*.txt`).
    - Change: `core/address.js` `missing()` is "unknown" only when no such page exists. `waitsForComputer` covers
      `requires` "ai".
    - Check: `out/ai-w1-after1.txt` shows all four open with their names, and the `tests/address.test.mjs` cases.
24. **regress-break 6** (severity 2). Back to a page hidden by the view switch said "Page not found ... not in the app".
    - Reproduced: 2 of 2 (`out/hidden-snap-snap*.txt`).
    - Change: the same `missing()` rule. Any page in the app opens by its address; a "soon" page shows its placeholder.
    - Check: `out/hidden-w1-after1.txt` shows Diagnostics drawn after the view switch and Back, and the test "still opens
      by its address (regress-break 6)".
25. **topways j-navigator/x-5** (partly). The first screen of Set up my plan had no way back.
    - Reproduced: family, samMidSetup and empty, 2 of 2 (`out/setupback-snap-before*.txt`).
    - Change: `ownBack()` hides the bar's "‹" only on the question screens (`route.rest`), not on the intro.
    - Check: `out/setupback-w1-after1.txt` shows the intro with "‹ Back to Income", and the questions keep their own "‹".
26. **topways j-hard-conditions/x-2** (partly). At 375 to 389 px, page names were cut in the top bar.
    - Reproduced: `tw/out/bar3-before.log`, 3 names cut at 375 px.
    - Change: at ≤480 px the pill is 116 px wide, with tighter padding ("Saved on your computer" on two lines). The
      three-line rule starts at `max-width: 389px`.
    - Check: `tw/out/bar3-after2.log` shows 0 cut from 375 to 430 px with normal letter spacing. Only at an extra 0.06em
      is one name cut at 390 to 393 px. `tw/out/bar1-after2.log` shows 0 cut at 320 px.
27. **regress-break 2** (severity 3). A second tap on the top bar's "‹" was dropped for 0.8 s.
    - Reproduced: 2 of 2.
    - Change: on the top bar only a true double tap (two taps within `DOUBLE_MS` 250 ms, on the same spot) counts once.
    - Check: the `tests/taps.test.mjs` test; `rb/out/p4b-backbtn-light.txt` shows two taps at 800, 1000 and 1300 ms
      going two pages back.

### Forms (commit bd2cc32)

28. **forms1 K4** (partly) and **forms1 new problem 2** (severity 2). A row opened with the keyboard was not treated as
    a keyboard open, so the cursor was not put in its form.
    - Reproduced: Income, Goals, Expenses and People, 2 of 2 (`out/k4-snap-before1.txt`: 2 to 13 Tabs to the first
      box; Expenses focus off screen).
    - Change: `core/ui/dom.js` marks Enter and Space on a row as a key open, so `act` gets the key-open flag.
    - Check: `out/k4-w1-after1.txt` shows 0 Tabs on all four, with the cursor in the form's first box.

## Not reproduced

None. Every finding I took up came back on the first two runs.

## Left, with reasons

- **regress-person 4(b)** (two "‹" on a quick answer, going to the same place). The quick-answer line at the top goes
  where the bar's "‹" goes. The rule that the bar's "‹" shows on every page that has one (taps B16) keeps both. Hiding
  one is an owner's choice; nothing goes to a wrong place.
- **MR-4, named line at the bottom only.** integ.md section 6 put the named way back at the bottom on purpose ("simple
  first"). The verifier says this trade is the owner's to confirm.
- **F3** (forms1 partly). The kit takes the cursor to the first wrong box (plan-forms B1, also asked by FF5 and DP-2).
  F3 asks for Save to stay put. The two conflict, so this is the owner's call.
- **Severity 1, not done in this round:**
  - regress-break 5: "‹" on the oldest entry the browser kept.
  - regress-person 5: "Undo my typing" says nothing.
  - regress-person 6: only the first changed box says "Not saved yet". That rule was chosen in integ.md section 6;
    marking every box is for the owner.
  - place NP7: commas after a reload.
  - tapmenu NP6: a dropped tap gives no sign. This is by design.

## Page adoption (not mine: the page's own code)

- forms1:
  - FF1, DP-2, investments x-2, IE-4, T9, B3.
  - W6: goal seek, where nothing near the box says the amount was used.
  - forms1 NP3: Allocation focus, `modules/investments/allocation/view.js:90`.
  - forms1 NP4: Budget 50/30/20 `form.scrollIntoView`, `modules/cashflow/budget-percent/view.js:98`.
- forms2:
  - INV-2, retirement-b x-3, taxes x-4, T11, x-duplicates.
  - x-redraw-on-change: the cash-flow and forecast views.
  - INV-7: backtest.
  - DP-1, F6, RC-11.
  - forms2 NP3: Home goal raw figure, `modules/goals/house/compute.js:113`.
  - forms2 NP4: two touching buttons on Required withdrawals.
- place:
  - CF-3, insurance-estate x-1, debt-fixer x-2, balance x-1, fat-fingers x-2.
  - one-answer x-2, W4, RB1.
  - place NP6: taxes/estimated shuts the section just saved.
  - withdrawal-strategy self-scroll, `view.js:169`.
- topways: A3.

## Must be tried on the real iPhone (Safari, then the home-screen app)

- The menu lock with `html { overflow: hidden }` only. The page behind must not scroll under the open menu, and the bar
  and its cross must stay at the top on a scrolled page.
- The page before stays on the screen until the new one draws (no blank flash). Check there is no flash of the old page
  under the new name on a slow phone.
- The pill and page names at 375 and 390 px, with the real Safari font, in both "Saved on ..." wordings.
- VoiceOver: a save's green line is read once, the focus lands on the save's line after a keyboard save, and the bottom
  note is read.
- Back onto a page with a form left open: the form opens again with the typing. Check there is no keyboard pop-up and
  no extra Back step.
- Back onto a page after a one-tap change: the line with "Put back my amounts" or "Undo" is there and works.
- Settings > Erase the copy on this device, then Income: no "Not saved yet" from the erased plan.
- A thumb resting on the screen while a save redraws, with two fingers too: the blank room goes when the last finger
  lifts.
- The check-in's carried line at the bottom, "‹ Back to the ... check-in", returns to the check-in at its spot without
  growing the history (Safari's history may differ).

## Checks on the combined build (after the squash, tree unchanged)

- `npm run registry`: no change.
- `npm test`: 189,505 tests, 188,863 pass, 2 fail, 3 skipped, 637 todo. The 2 failures are the two known speed tests
  ("takes well under 1.5 s", "200 times in under 600 ms"). Rerun alone, both files pass: ledger 37 of 37 and
  estimate-perf 2 of 2. The first full run hit "no space left on device" while writing its output; the disk had
  about 0.3 to 0.6 GB free all session. The run was repeated with its output filtered.
- `npm run check`: OK.
- `node tools/leak-guard.mjs --worktree`: OK, 2,899 files.
- Acceptance (`fix1/final-acc.sh`, one script at a time against 9621, outputs in `fix1/acc/final/`, list in
  `summary.txt`):
  - **forms B1 to B16:** all hold. B8 failed once with "Target crashed": the browser tab died while the disk had
    45 MB free. It was rerun alone twice and passed 4 of 4 both times (`forms/B8-rerun1.txt`, `-rerun2.txt`).
  - **place B1 to B19:** all hold except B6 (0 of 3), which fails by design. B6 expects a shut form with an "Open it"
    line; fix-1 opens the form again (item 1). Its replacement, `B6-reopen`, holds 3 of 3.
  - **taps B1 to B17:** all hold except two, both by design:
    - B15 (6 of 8): it expects "Page not found" for a page the view does not offer (Devices, Plan critic). fix-1 opens
      every page in the app by its address (items 23 and 24). The replacement `B15-open` holds 9 of 9.
    - B17 (2 of 6): it expects the named way back at the top and the bottom. integ.md section 6 keeps only the bottom
      line ("simple first"). The replacement `B17-simple` holds 6 of 6.
  - **qa/shell-bar, shell-menu, shell-search, shell-taps, shell-ways:** 18 of 18, 6 of 6, 7 of 7, 6 of 6 and 5 of 5.
- Servers: the comparison servers on 9622 and 9623 were stopped by their stop files. Their copies in `fix1/` were then
  removed to free disk. The combined build's server on 9621 was stopped the same way, and integ's `planner.properties`
  is back to port 9451.
