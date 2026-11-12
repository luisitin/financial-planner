# Place and typing memory: final design (wave 1, track "place")

Themes: SH-BACK (19 findings), SH-DRAFT (21), SH-REDRAW (12): 52 findings. One root: the shell throws the page away and
draws it again (`core/app.js` `show()`: `root.innerHTML = ""` on every new address, and 50 ms after every
`store.update` on the same page). This design keeps what a person would lose and puts it back after the page has drawn,
in the shell, so almost no page has to change. This file stands alone: a builder needs only it, the patch below and the
three theme files.

`$SP` = `$SP`.

**Evidence base (all re-measured on the branch tip, not on the first design's tree).**
- Tree: `claude/creative-build-b531q0` at **c6fb730**. The task names c385e41. The shell files are byte-identical
  between the two: `git diff c385e41 c6fb730 -- core/app.js core/router.js core/ui index.html
  modules/overview/guide/frame.js` is empty. The pages are not identical (five wave-2 builders worked on them), so every
  "today" figure below is from c6fb730.
- Prototype: `$SP/w1/place/fin`, a `git archive` of c6fb730 (commit "tip c6fb730") with this design as the uncommitted
  diff. The same diff as one file: `$SP/w1/place/final-proto.patch`. It touches 6 files, +1,062 -48: `core/place.js`
  (new, about 650 lines), `core/router.js` (rewritten), `core/app.js`, `core/ui/base.css` (shell selectors only),
  `modules/overview/guide/frame.js` (`data-back` on its "Back to ..." links), `tests/place.test.mjs` (12 node tests).
  `git apply --check` is clean on a c6fb730 archive (`$SP/w1/place/sw-today`). The repo's own `tests/router.test.mjs`
  passes unchanged on the new router (16 of 16 with the new tests).
- Scripts: `$SP/w1/place/f`. `lib.mjs` is the thumb (390 x 844, touch, Chromium, `?sandbox=1` always, real CDP finger
  drags of about 0.4 s, taps at screen points, keys one at a time). It serves the prototype on 127.0.0.1:9327
  (`serve.mjs`); that server is stopped now. `?place=off` on the same files is today's shell (a prototype switch only).
  The critics' own repros are copied in unchanged except for the port: `paycheck-cross2`, `shorter-back`, `phantom`,
  `echo-way`, `checkin-note`, `one-changed`, `secret`, `key-split`, `dbg-undo`, `hold`..`hold5`, `people-state`,
  `twins` (the scope critic's twin-form census), plus the first design's `m-back`, `m-redraw`, `m-draft`, `m-local`,
  `m-links`, `dbg-setup`, and new ones: `echo-back` (the note's way back and a tap on its words), `unmeasured` (the four
  finding pages no script had opened), `wh` (Withholding's save), `stray` (the stray row tap). Logs: `f/out/s1-*.log`, `s2-*` (the Back suite)
  and `s3-*` (the last re-run after the final edits) (final suite), `f/out/fix1-*.log` (the critics' repros on the final prototype), `f/out/base-*.log` (the same repros on
  the first prototype ported to c6fb730), `f/results/*.json`, pictures in `f/out` and `f/shots`.
- Touch sweep: `qa/touch-sweep.mjs` and `qa/touch-rules.json` from `$SP/wtouch`, copied into a c6fb730 archive
  (`$SP/w1/place/sw-today`) and into the prototype; same 18 pages, same three households, same five rules.

**What changed since the first design** (each item answers a critic; section 9 has the evidence):
1. A form is known by its title, its section, its button's words and its boxes' names, never by the figures in it.
   Two forms that are still alike (same title on one page) are told apart only by their order, and only while their
   count is unchanged; otherwise nothing is filled. (break K1)
2. Room under the page is borrowed only while the page is still drawing, never after; only things that are drawn
   (not inside a shut section) can hold the place; nothing is released under a finger. (break K2, K3; person 1)
3. The bottom note acts through the page's own control ("‹ Back to ..." really goes Back), takes every tap on itself,
   sits above what was just tapped instead of over it, and stays 4 to 10 s. (break K4; person 3, 4, should-fix S3)
4. Typing counts as saved only when the plan really changed, and only inside the tapped button's own form or card.
   Each box keeps or lets go of its typing on its own. (break K5a, K5b, S3)
5. Boxes for keys, tokens, passwords, passcodes, secrets and PINs are never kept, nor anything on a System page.
   (break K6)
6. "Undo my typing" puts the box back to what the page showed. (person 2)
7. Typing is kept under the page, not under how it was reached (`?from`, `?guide`, `?step`, `?review`, `?q`, `?add`).
   (break S1, scope 3)
8. Dropped: kept pages (the first design's M3: no measured gain on D-BACK), the redraw that waited while typing in
   another box (M8, B13: closes nothing, D-FOCUS-KEPT is 0 today), and place's own edits to the menu (the menu is the
   taps track's; `router.layer` stays as the API it calls). (scope 1, 5; scope S3)
9. Seams with the taps and forms tracks are written down function by function (section 7). (scope 1, 2)
10. Every figure re-measured on c6fb730; the coverage table has three states. (scope 3, 4)

---------------------------------------------------------------------------------------------------------------------

## 1. Behavior (the acceptance test)

Each item: what the person does, what they see after the fix, the findings it closes, and the check that proves it
(script and scenario in `$SP/w1/place/f`, and the permanent touch rule in `qa/touch-rules.json` it turns green). "Today"
is c6fb730 with the same script (`off`).

**B1. Back and Forward put me back where I was.** I scroll down a long page, open a section, tap a link or a menu row
and read a little of the other page. I press the phone's Back: the first page is there at the same spot, the section I
opened is still open, and the link I tapped sits where it was on the screen. Forward takes me to the other page at the
spot I left it. However slowly the page draws, the screen never shows empty grey below the page and never jumps by
itself afterwards.
Closes: j-first-family/x-1, j-first-freelancer/x-2, j-first-retiree/x-1, j-heavy-waiting/W1,
j-monthly-return/x-back-top, j-navigator/N1 (Back and Forward), p-career-household-system/F1, p-cashflow-a/x-1,
p-insurance-estate/IE-1, p-overview-home/OV-1, p-retirement-a/R-A2, p-retirement-b/x-2,
p-retirement-c-scenarios/x-back-loses-place, p-taxes/x-1, j-first-renter/x-3, j-one-answer/A5, p-overview-path/x-2.
Check: `m-back.mjs fix 1` and `fix 4` (17 trips, CPU x1 and x4) against `m-back.mjs off 1`: Back at the place on 17 of 17 trips at x1 and at x4: by y within 2 px, or (Ruth's Will the money last?, Pat and Lee's
retirement guide) by the tapped link held at its screen spot (738 and 91 px) while a line drawn above on the second visit
moved y by 33 and 22 px; the freelancer trip, whose browser closed in the x1 run, was re-run alone: 1,640 to 1,640. The
sections I opened: 5 of 5 (today 0 of 5). Forward at its spot: 16 of 17 (Ruth: the same 33 px line). Reload at the
place: 14 of 17 within 2 px at x1, 15 of 17 at x4, the rest within 23 px with the top of the screen held (today 0 of 17:
every reload opens at the top). Today on c6fb730 in Chromium, Back alone lands at the same y on 16 of 17 trips (most pages
now draw in one go; Ruth's Will the money last? loses 942 px), but the tapped link moved on two (credit cards 669 to 530,
the guide 91 to 69) and no opened section survives.
`shorter-back.mjs fix` (Back to a list that got 10 rows shorter while I was away): y 828 at once, no borrowed room,
the same 828 for 8.7 s, a 30 px drag then moves 0 (today: 828, the same). `unmeasured.mjs` timeline-back (Life
timeline, 6,983 px, link at 2,975): 2,975 after Back, still 2,975 4 s later (today in Chromium: the same; the finding
was a slow phone). Touch rules **D-BACK**, **D-TOP**.

**B2. A new page starts at its top.** A link, a menu row, a search result, Next or "Continue your plan" opens the next
page at its top, even if I was on that page before (a new visit is not a Back).
Closes: none (guards today's behavior). Check: touch rule **D-TOP**; `m-back.mjs` "midAt" column.

**B3. A reload keeps my place and my typing.** The page reloads (I pull to refresh, the phone dropped the tab and
reloads it, or the app mends itself with its one reload): same page, same spot, same open sections, my typing in its
boxes with "Not saved yet." beside the form's button.
Closes: j-navigator/N1 (Reload), j-monthly-return/x-typed-lost (reload), j-navigator/x-2 (reload).
Check: `m-draft.mjs fix` update-reload: "18950 | 3,900" back at 682 with the hint (today: the saved "18,000 | 4,200"
at 0). `hold3.mjs` reload (Income, add form typed, left at 1,095): the form is shut by the page, so the screen stands at
364 where its line is, "Not saved yet: what you typed in “Add an income”." is on screen, no blank, nothing moves in 9 s.

**B4. The page's "‹ Back to ..." links, and the bottom note's, work like the phone's Back.** "‹ Back to the October
2026 check-in", "‹ Quick answers", "‹ Your plan" and "‹ Back to the guide: ..." take me back to the page I came from, at
the spot I left it, and do not add a step: the phone's Back afterwards goes where I was before that page. From Your
plan's "Next result" walk, "‹ Your plan" goes back over the whole walk. When the page they name is not just behind (I
came from a bookmark or the menu), they open it as an ordinary link.
Closes: j-monthly-return/x-backlink-history, j-one-answer/x-4, j-navigator/N1 (the on-screen "‹ Your plan").
Check: `m-links.mjs fix` (three trips): history grows only by the step itself (1; today 2), the spot after the link
equals the spot at the tap (0/0, 5/5, 121/121; today 0 each time), and the phone's Back then reaches the Dashboard
(today: back into the step or answer). `echo-back.mjs fix` way-back: the note's "‹ Back to the October 2026 check-in"
returns with history +0 to the spot of the tap, the note goes, the phone's Back then shows the Dashboard. Proposed
touch rule **D-WAYBACK**.

**B5. What I typed and did not save waits for me.** I type in a form (an add form, an edit form, Update my balances, a
tax figure, a goal) and leave without saving: by the menu, a link, "Continue your plan", a step link, the status pill or
the phone's Back. When I come back (Back, Forward, the same link or the menu again, within a day, in this tab), my typing
is in its boxes with "Not saved yet. Undo my typing" beside the form's button. Save saves it as usual; Cancel throws it
away as today. It does not matter how I reached the page: the check-in's step link and the menu row show the same typing.
Closes: p-taxes/T1 (c), j-monthly-return/x-typed-lost, j-navigator/x-2, p-balance/B1, p-cashflow-b-goals/x-3,
p-debt-property/x-3 (the typing), p-insurance-estate/IE-9, p-retirement-a/x-2,
p-retirement-c-scenarios/x-half-typed-form-lost, p-career-household-system/F2, p-cashflow-a/CF-2, p-investments/INV-4,
j-fat-fingers/FF2 (leaving), j-debt-fixer/x-2 (the typing), p-cashflow-a/CF-3 (the typing).
Check: `m-draft.mjs fix`: 7 of 7 trips keep the typing (today 0 of 7): income-add-menu-back, update-continue-back
("9,999 | 3,900" after "Continue your plan" and Back), update-reload, health-two-forms, estimated-two-forms,
income-stray-row, debts-form-back-forward ("19.9 | 95" when the form is opened again). `unmeasured.mjs` goals-typing:
"Boat fund | 7500" kept, "Open it" brings both back with the hint (today: gone). `key-split.mjs`: typed from the
check-in's step, shown again from the menu row.

**B6. If the form is shut when I come back, a line says my typing is kept, where the form was.** When my typing belongs
to a form the page does not open by itself (an add form behind "+ Add another ...", a row's edit form), the page shows a
small line where that form lives: "Not saved yet: what you typed in “Add an income”." with two buttons, "Open it"
(presses what opened the form) and "Undo my typing" (forgets it). When that line is off the screen once the page has
stopped moving, the same words show once in the bottom note with "Open it". If a box's saved figure was changed
elsewhere since, that box's typing is let go and the bottom note says so once ("Some of what you typed in “...” was
not put back: those figures were changed since."); the other boxes keep theirs.
Closes: the "without a word" part of j-fat-fingers/FF2, p-cashflow-a/CF-2, p-investments/INV-4, p-debt-property/x-3.
Check: `m-draft.mjs fix` income-add-menu-back (line with "Open it" and "Undo my typing", y 364) and
debts-form-back-forward; `one-changed.mjs` (below, B8).

**B7. A stray tap on another row does not throw my typing away.** I am changing Ana's salary, my thumb lands on Bo's
row and his form opens instead. A note says what I typed in "Edit Ana's salary" is not saved yet, with "Open it";
tapping Ana's row again shows my figure with "Not saved yet.".
Closes: j-fat-fingers/FF2 (the row part). Check: `m-draft.mjs fix` income-stray-row ("9999" back, hint shown; today
"3,900"); `stray.mjs`: at the stray tap the line is drawn in Ana's section (above the screen, the page scrolled to Bo's
form) and the bottom note "Not saved yet: what you typed in “Edit Ana's salary”. Open it" shows.

**B8. Saving one part of a page keeps my typing in another part, and only what I saved counts as saved.** I type in one
form, then save another form, tap a month chip or tick a box elsewhere on the page: the green "Saved." is about what was
saved, my other typing is still in its boxes, its section is open and "Not saved yet." sits beside its button. A tap
that only redraws (a month chip, Show more) saves nothing and lets go of nothing.
Closes: p-insurance-estate/x-1, p-taxes/T1 (a, b, d, e), p-balance/x-1, p-career-household-system/x-1.
Check: `m-redraw.mjs fix` estimated-two-forms ("1,000" kept, hint; today ""), federal-two-folds ("98,000" kept, its
section open, Save did not move; today "" and the page jumped 1,680 px), accounts-note-then-balance (the typed note
kept; today ""); `m-draft.mjs fix` health-two-forms; `checkin-note.mjs fix` (a note typed on October, the November chip,
back to October: the note is there; first prototype and today: gone); `one-changed.mjs` (Update my balances: three
balances typed, the house's value saved elsewhere, Back: 395,000 shown for the house, the three typed balances kept, hint
shown; first prototype: all five let go without a word); `people-state.mjs` (People: Bo's edit form open with 59 typed,
the state select saved elsewhere on the page: form still open with 59, "Saved." on screen, plan keeps Bo 62).

**B9. After a save or a choice, the page stays still under my thumb.** I save inside a section, change a setting that
works the answer out again, tap "Use these numbers" or a chip: the sections I opened stay open, the button I tapped stays
where it was on the screen, and the box I was typing in keeps the focus with the cursor where it was. If the page shuts
the section that held the button, that section's heading stays where the button was. If the page itself brings its
answer into view (it scrolls, or the form kit says `planner:reveal`), the page wins and nothing is held.
Closes: j-first-freelancer/x-1, j-debt-fixer/x-3, p-retirement-b/RB1 (the section), j-one-answer/x-2 and
p-retirement-a/R-A4 (the section), j-heavy-waiting/W4 (the section), p-retirement-b/x-1 (guard).
Check: `m-redraw.mjs fix`: the tapped control moved 0 px in projection-settings, cards-balance-transfer (today -64),
federal-two-folds (today: gone, -1,680), buckets-years (today: gone, -261, section shut), update-balances (-1; today -1),
accounts-note (0; today -1); withdrawal-use-this: the page scrolls to its own line (764 to 112 in both): page wins.
`m-local.mjs fix`: Chance the money lasts, Runs changed: "How this is done" stays open at 1,048 (today: shut, 1,048 to
830); Stress tests chip: every open section stays open (today: one shuts). `wh.mjs fix` (Withholding, the page shuts the
section after its first save): the section's heading stays at 393 where Save was (today: 192). `hold.mjs` (five saves
on Estimated, Income, Debts, Goals, Net worth): moved by itself 0 px between +1.5 s and +9 s, no borrowed room left
(first prototype: jumps of 208 to 914 px). Touch rules **D-SCROLL-KEPT**, **D-FOCUS-KEPT**; proposed **D-STILL**.

**B10. I can read the confirmation where I am looking.** When the page's green (or red) notice is readable on my screen
(60% of it, or 48 px, between the top bar and the bottom edge), that is all. Otherwise a short copy shows at the bottom
of the screen, decided one frame after the page drew (a page that brings its line into view wins). It carries at most
two 44 px rows: the notice's own button or link ("Undo", "See net worth ›") and, on a page opened from the monthly
check-in, "‹ Back to the October 2026 check-in". The whole note takes my taps: a tap on its words closes it and hits
nothing under it. If at the bottom it would cover what I just tapped, it sits just above that instead. It stays 4 to 10
seconds by its length (at least 6 s for an error) and leaves when I go to another page.
Closes: j-monthly-return/MR-1, p-balance/B2, p-taxes/x-5, and the "no saved on screen" part of j-one-answer/x-2,
p-retirement-a/R-A4, p-retirement-b/RB1, j-debt-fixer/x-3.
Check: `m-redraw.mjs fix` echo column: projection-settings bottom (today: nothing, and the notice is not readable),
update-balances bottom with "See net worth ›" (today: nothing), accounts-note bottom, buckets-years bottom,
withdrawal-use-this none (the page's own line is readable); `echo-back.mjs fix` tap-words (address, history and focus
unchanged, the note goes; the critic's j16 tap went through to "Continue your plan"); node test `seenEnough` with
p-taxes/x-5's 14 px. Touch rule **D-SEEN**.

**B11. Nothing on the page moves by itself.** A green confirmation that a page takes away after 4 seconds stays until I
act or the page is drawn again, so the rows under it never jump while my thumb is on the way. No borrowed blank under
the page, no late jump after a save or a Back.
Closes: j-first-retiree/x-2, p-transactions-helpers/x-notice-jump, p-retirement-b/x-1 (the second jump).
Check: `m-redraw.mjs fix` "later" column (update-balances and withdrawal-use-this: 0 px after 5 s, the notice still
there); `hold.mjs`, `hold3.mjs`, `shorter-back.mjs` (above). Proposed touch rule **D-STILL**.

**B12. My typing never lands in someone else's form.** On a page with two forms of the same shape (Ana's and Bo's W-4,
two "Raises and promotions"), what I typed in one is never put into the other.
Closes: none (a guard; break K1). Check: `paycheck-cross2.mjs` (Ana's health 120, menu away and back, Save in Ana's, Save
in Bo's): Bo's box stays empty and has no hint, the plan holds only Ana's 120 (first prototype: Bo got 120 and saved
it). `twins.mjs` census, 159 pages each: family 89 forms, patLee 84, renterDebt 79 forms and none alike: alike forms only on
career/salary ("Raises and promotions" x2), filled only by position while both are there. Proposed touch rule
**D-TWIN**.

**B13. "Undo my typing" puts back what the page showed.** Beside "Not saved yet." the button puts every box of that form
back to the figure the page drew, the words go, and nothing is kept for it any more.
Closes: none (a guard; person 2). Check: `dbg-undo.mjs` on Estimated payments: Q1 "1,000" typed, the other form saved,
"Undo my typing" tapped at its place on screen (the tap reaches the button: `elementFromPoint` is it): the box shows its
drawn "" again, the hint is gone, the kept typing is `{}`.

**B14. My typing stays private and apart.** Typing is kept only in this browser tab (sessionStorage; not in the plan, not
on the PC, not in another tab), for a day at most, 20 KB a page at most. Boxes whose name, label, aria-label or
placeholder says key, token, password, passcode, passphrase, secret or PIN are never kept, nor anything typed on a
System page. The pretend plan (`?sandbox=1`) and the real plan keep separate memories.
Closes: none (a guard; break K6, AGENTS rule 10). Check: `secret.mjs`: Settings' "API key (for another service)" typed,
stored false, no typing keys (first prototype: stored); node tests `secretText`, `neverKept`, `pruneTyping`.

**Touch rules** (`qa/touch-rules.json`; the sweep on 18 finding pages x family, widow, renter):

SWEEP_TABLE

Not this track: D-UNDO, D-TWICE, D-ENTER, T-* rules. Proposed to the touch-check track (section 4): **D-STILL** (within
1 s of a tap or Back the page content reaches the bottom edge or the page's real end is on screen, and nothing moves for
10 s without a touch), **D-WAYBACK** (an on-screen way back, on the page or in the bottom note, does not grow
`history.length`), **D-DRAFT** (typing comes back after leaving by the menu, by Back, by reload and after saving another
form), **D-TWIN** (typing in one form never shows in another).

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

Ten mechanisms. New file `core/place.js` (pure rules on top, then the DOM glue), `core/router.js` rewritten, small
changes to `core/app.js` (`show()`, `echo()`, the store subscription, `boot()`), `core/ui/base.css` (shell selectors) and
`modules/overview/guide/frame.js` (one attribute). No page changes for B1 to B14. Everything in `place.js` and the router
that touches `window`, `document` or storage is inside a function or a `try`, so both import cleanly in Node.

### M1. Numbered history entries and a trail: `core/router.js`
- Every entry gets a number in `history.state.n` (spread: `{ ...history.state, n, l }`, so Get started's `suFrom` and any
  page's own state stay). A numberless entry is numbered with `replaceState` once (a new visit). An arrival is
  `kindOf(first, n, cur)`: a numbered state at the first draw is a **reload**; a smaller number is **back**, a larger
  **forward**; a fresh number is **new**.
- A trail in sessionStorage `planner.trail` (`.sandbox` for the pretend plan): entry number -> `{ h: its address,
  p: the entry before it, via }`, 60 entries. A new entry drops the trail and records beyond it (Forward can no longer
  reach them: `place.forgetAfter`).
- `onChange(route, { kind, n, from: { n, href } | null })` is what `show()` gets.
- API (the only history API in the app; taps and pages call these, nobody else writes entry numbers):
  `router.parse`, `href`, `go`, `open(href, { via, replace })`, `entry()` -> `{ n, href, first }`, `first()`,
  `at(n)` -> `{ href, p, via }`, `touch()` (a page changed its address with `replaceState`: the trail follows),
  `back(href, loose)` (M9), `layer(close)` -> `release()` and `layersOpen()` (something open over the page that the
  phone's Back closes: one more entry at the same address with `l: 1, 2 ...`; Back runs `close()`; `release()` steps
  off the entry when it closes by itself; an `l` entry reached with nothing open is stepped off).
- A link tapped while a layer is open takes that entry's place (`location.replace`), so Back from the new page lands on
  the page, not on a closed menu. A link with `data-via="menu"` gives its new entry `via: "menu"` (taps' named rows).
- `history.scrollRestoration = "manual"`: the browser no longer guesses; M3 and M4 put the place back.
- Pure and node-tested: `parse`, `hashOf`, `sameEntry(want, had, loose)`, `backSteps(trail, n, href, loose)`, `kindOf`.

### M2. The locator: `place.js` `keyOf()`, `locOf()`, `locate()`, `drawn()`
- A key for an element that survives a redraw: `kind|TAG|words` where the words are its label, aria-label, name and
  text with figures replaced by `#` and chevrons and arrows dropped (`shape()`: "Store card $1,201" and "$1,202" are the
  same row; "Raises and promotions 3.0% ›" is "raises and promotions #"). A location adds the section it is in (the
  nearest heading or fold title), its index among same-key elements in that section, and its index on the page.
- `locate(root, loc)` tries, in order: same key in the same section at the same index ("exact"), same key in the
  section ("section"), same key at the same page index when the count of same-key elements is unchanged ("order"), the
  only element with that key ("only"); otherwise nothing ("unsure"). Never a guess.
- `drawn(el)`: connected, has a layout box, and not inside a shut `<details>` other than as its summary. Only drawn
  elements can hold the place (break K2).
- Measured on c6fb730 by the first design's census (same plan drawn again: 0 wrong; after a real change: 0 wrong, the
  rest "unsure") and by `twins.mjs` (forms, M7).

### M3. One place record per entry: `place.note()`, `place.leave()`, `place.recordOf()`, `place.forgetAfter()`
- sessionStorage `planner.place` (`.sandbox`): entry number -> `{ href, y, folds, tap, top, at }`, 60 entries.
  - `folds`: only the sections the person opened or shut by tapping their summary (`foldBy`), never the page's own.
  - `tap`: the chain of what was tapped last (the control, then up to two drawn ancestors: its row, card heading or
    section), each with its screen top; for a button of an edit form, the row that opened the form comes second.
  - `top`: what was at the top of the screen (the first drawn heading, summary, row, label, button, link or paragraph
    below the top bar), with its screen top.
- Written when the scroll stops (200 ms after the last scroll event), on `pagehide` and `visibilitychange` to hidden, and
  when leaving (`leave(n, href)` reads the old page before it is cleared; the tap chain only if the tap was within 3 s).
  Never per scroll event; never in `history.state` (Safari's limit of 100 `replaceState` calls per 30 s).

### M4. Arriving by Back, Forward or Reload: `place.arrive()` and `app.js show()`
- `show(route, { entry })` for a new address: `place.leave(from)`, `place.forgetAfter(n - 1)` on a new entry,
  `place.visit(n, pageKey)`, then the record of this entry (`recordOf(n, location.href)`; none while the "changed in two
  places" bar asks to be seen). Room: `#content` `min-height` = record's y + one screen, set before the page draws, so
  the screen can stand at the place while the page is still drawing.
- After `render` resolves: `arrive(root, rec)` puts back the folds, then the typing (M7), then holds the place (M5)
  with `want()` = the first drawn element of the tap chain, else of the top chain, at its old screen top; else the
  record's y. Folds and typing are put back again whenever a late part of the page draws.
- A new entry (B2): no record, `min-height` cleared, the page starts at 0; typing is refilled (B5) and kept typing is
  told (B6).

### M5. The hold: `place.hold(root, want, { pageWins })`
- Stands at `min(want(), page end)` and stays there while the page finishes drawing (a ResizeObserver and a
  MutationObserver on `#content` call `put()` after each growth).
- **Room is borrowed only while the page draws** (break K3, person 1): it is dropped as soon as the page reaches the
  place by itself, one frame after the draw when the page is not growing, or 600 ms after its last growth. Dropping it
  never happens under a finger: with a finger on the glass it waits for the lift (`pendingDrop`).
- Anchoring stops at the first touch, wheel, key or mouse press, at `planner:reveal`, at a new page, after 700 ms of
  stillness at the place, or at 8 s; on the save path (`pageWins`) also at the page's own scroll call (M10).
- Measured: `hold.mjs` five saves and `hold3.mjs` reload and return, 0 px moved by itself up to +9 s and no borrowed
  room left; `shorter-back.mjs` no room at all (the page was already drawn when the place was asked for).

### M6. The same page drawn again (after a save or a choice): `place.before()`, `place.after()`, `app.js show()` keepScroll
- `before(root)` (the shell, before clearing): writes the typing down (M7), takes the folds the person set, the focused
  box and its selection when it is outside the form just submitted, and the tap chain (5 s) or the focused box.
- The page draws. Its own scrolls during the draw (or a `planner:reveal` from the form kit, or the kit's `afterDraw`
  saying it moved) mean **the page wins**: nothing is anchored.
- `after(root, snap, { scroll })`: folds back, typing back, focus and selection back (`preventScroll`), then:
  - the tapped control, if drawn, stays at its screen top;
  - if the page shut the section that holds it, that section's summary stays at the control's screen top;
  - otherwise the next drawn element of the chain, never put under the top bar;
  - nothing found: nothing moves, the borrowed room goes one frame after the draw.
- `focusLost` (the focused control went with its form): the shell focuses this save's fresh notice when it is readable
  (`tabindex="-1"`, `preventScroll`), the forms track's N1.
- `ctx.redraw()`: the same keepScroll draw without writing the plan (a page's own open/close state), so a page never
  calls `store.update(() => {})` just to redraw (break S3).

### M7. Typing memory: `place.remember()`, `saved()`, `refill()`, `tell()`, `forget()`
- **What is watched**: `input`, `change`, `focusin` and `pointerdown` in capture phase on `#content`. A box's "drawn"
  value is taken at its first focus or tap (`base`). A box counts only when its value differs from that.
- **Which boxes**: `input` (not hidden, file, password, submit, button, reset, image), `select`, `textarea`, not inside
  `[data-no-keep]` or the shell's own `[data-place]` words; never one whose name, id, aria-label, label text or
  placeholder matches `\b(api ?keys?|keys?|tokens?|passwords?|passcodes?|pass ?codes?|passphrases?|secrets?|pins?)\b` after
  camelCase is split ("apiKey" -> "api Key"; "Passport", "Pinned", "Monkey bars" stay ordinary); never on `#/system/*`.
- **Where it is kept**: sessionStorage `planner.typing` (`.sandbox`), keyed by the **page key**: the address without
  `?from`, `?guide`, `?step`, `?review`, `?q`, `?add`, `?show`, `?view`, `?sandbox`, `?place`, other query keys sorted
  (`?month=2026-10` stays: it changes what is drawn). Per page: `forms` (one record per form) and `loose` (boxes in no
  form, e.g. the check-in's note) with their locators.
- **A form's identity** (`fkOf`): its title (`formTitle`: legend, the fold title around it, its card's heading, or the
  nearest heading before it, figures shaped) § its section § its submit button's words § the keys of its boxes. **No
  values.** Two forms with the same identity on one page are twins: a record keeps its index and the twin count, and is
  given back only to the same index while the count is unchanged (`pickForm`); otherwise it is not filled (break K1).
- **Each box on its own** (`boxVerdict(drawn, typed, now)`): `now === typed` -> "same" (already there, e.g. a page that
  restores its own draft: Get started, People), `now === drawn` -> "fill", anything else -> "changed": the saved figure
  moved since, this box's typing is let go and said once (B6). The form's other boxes are filled (break K5b).
- **Written**: 300 ms after typing stops, at once on `change`, on a tap that may swap the form away, when leaving, on
  `pagehide` and when hidden. Capped at a day per record and 20 KB per page (`pruneTyping`).
- **Saved** (`saved(changed)`, called by the store subscription with `planSig(before) !== planSig(after)`, a hash of the
  plan without `meta`): only when the plan really changed (break K5a), within 1.5 s of the person's last act, and only
  inside that act's scope: the submitted form; a button's own form; for a button in no form, its own card, section,
  `details` or fieldset, never wider. A box that saves itself on `change` counts only inside its own change event.
- **Given back** (`refill`): after every draw and when a form appears (a MutationObserver on `#content`). Values are
  written quietly: `.value` (or `checked`), then `input` (and `change` for choices) events, never `reportValidity()`
  (forms N3). A filled box's shut sections are opened. "Not saved yet. Undo my typing" goes beside the form's buttons
  (`.place-hint`); a box in no form gets "Not saved yet" with its own "Undo my typing" (`.place-cue`).
- **Told** (`tell`): a record whose form is not on the page gets one line where it lives (`.notice.info.place-kept`:
  "Not saved yet: what you typed in “Add an income”." with "Open it" and "Undo my typing"), in the section of the control
  that opened the form (recorded from the tap that made the form appear), or at the top of the page. When that line is
  not readable once the screen has stopped moving (`whenStill`: 200 ms without a scroll, at most 1.2 s), the bottom note
  says it once with "Open it".
- **Forgotten**: Save (above), Cancel ("Cancel", "Close", "Never mind", "Discard" buttons of the form), "Undo my typing"
  (puts every changed box back to its drawn value with `input`/`change` events, then forgets: person 2), a day.

### M8. Confirmations: `app.js echo()` and the keepScroll branch; `place.js` notices stay
- **The readable rule** (`seenEnough(rect, topBar, bottom)`): 60% of the notice or 48 px of it between the top bar and
  the bottom edge. Today's rule counted a notice 14 px under the bar as seen (p-taxes/x-5).
- **When**: the keepScroll branch collects this save's fresh notices (new text, or the same "Saved." again), then
  decides one frame after the draw, and again once a scroll the page made has stopped (150 ms quiet, at most 1 s). If
  none is readable, the first one is copied (`echo(text, kind, ways, near)`), its links and buttons left out of the words.
- **Ways** (at most two, 44 px rows): the notice's own `.notice-action` button (the form kit's Undo), else its first
  link or button; and on a page opened from the check-in (`?from=review`), the frame's `a[data-back]`. A link stays a
  link with its `data-back` (M9 sends it Back); a button presses the page's own button while it is still there.
- **Taps**: the whole note takes taps (`pointer-events: auto`); a tap on its words removes it and reaches nothing below.
- **Place**: at the bottom; when it would cover the tapped control (`place.tappedRect()`), just above that control, never
  under the top bar (`.save-echo.above`).
- **Stay**: `echoStay(chars, ways, bad)` = 2 s + 55 ms a character (+2 s with a way), between 4 and 10 s, at least 6 s for
  an error. It is removed when the address changes.
- **Notices stay** (B11): every `.notice.ok` / `.notice.error` added to `#content` gets a `remove()` that works only
  inside a trusted event (the person's own close or Undo) or when the node carries `data-moved`, `data-kit-moved` or
  `data-kit` (the form kit moved it). A page's `setTimeout(() => n.remove(), 4000)` then leaves it; the next draw replaces
  it anyway. (`.leaving` fade classes are the page's own and unaffected.)

### M9. Ways back on screen: `a[data-back]`, `ctx.back(href, loose)`, `frame.js backLink()`
- The guide frame's "‹ Back to ..." links carry `data-back="1"` (and `data-back-loose="month"` on the check-in's,
  whose step links carry the month while the check-in opened without `?month` shows that month).
- One bubble-phase listener on `document` (page handlers run first): for `a[data-back]` with an in-app `href`,
  `router.back(href, loose)`; when it went back, the click's default is prevented and the bottom note goes.
- `router.back` goes Back when the entry just behind shows that page (`sameEntry`: same page and rest; every query key of
  the link equal, except `from`, and a `loose` key the entry lacks), or further back along one "Next result" walk (every
  entry walked over was opened with the same `from`), at most 10 steps; otherwise returns false and the link is followed.
- `ctx.back(href, loose)` is the same in code for a page's own button ("Do something else" on a guide opened from Quick
  answers: `if (!ctx.back("#/overview/quick")) ctx.go(...)`). There is no `goBack`/`cameFrom` beside it.

### M10. One wrapper of the scroll calls: `place.js wrapScrolls()`, `addScrollHook()`, `busy()`, `scrolls()`
- `window.scrollTo/scrollBy/scroll`, `Element.prototype.scrollTo/scrollBy/scroll/scrollIntoView` and
  `HTMLElement.prototype.focus` (without `preventScroll`) are wrapped once. Each forwards `this`, every argument and the
  return value.
- While the shell draws (`busy(+1)` ... `busy(-1)`) or a hold runs, a call counts as the page scrolling itself
  (`scrolls()`); on the save path it ends the hold (the page wins). The shell's own scrolling uses `place.scrollTo`,
  which is never counted.
- `addScrollHook(fn)`: another track's change to the arguments of every call (the taps track turns `behavior: "smooth"`
  into `"instant"` under reduced motion). There is no second wrapper.
- `html { overflow-anchor: none }` in `base.css`: Chromium's scroll anchoring off, so Chromium measures what Safari does
  (Safari has none) and the hold is the only anchoring.

---------------------------------------------------------------------------------------------------------------------

## 3. What a page must do (adoption list)

Short on purpose: B1 to B14 need no page change. **Adoption count: 0 pages for wave 1; 6 items for wave 2.** Owners are
named so nothing falls between the tracks (scope 4). Wave 1's file list has no `view.js`, so every page item is wave 2's;
the "wave-2 batch" names are the batches of the stress-test wave 2 (setup, home, check-in, balance, cash, debt, retire,
scenarios, tax, investments, transactions, plus the claude-a handoff). claude-a's pages (marked *) go only in the
handoff list.

| # | page(s) | change | finding | owner |
|---|---|---|---|---|
| A1 | the 28 views whose row tap opens an edit form in place (`let editing` / `editing =`: cashflow/income, expenses, budget; goals/goals, travel*; balance/net-worth, assets, liabilities; household/people, contacts, calendar, documents; insurance/health, policies; investments/holdings; retirement/annuities, contributions, pensions; career/equity; estate/digital, gifting, inheritance, legacy; taxes/capital-gains; transactions/ledger, categories, rules; ai/notes) | when the edit form opens: `const release = ctx.layer(() => { editing = null; ctx.redraw(); })`; call `release()` on Save, Cancel and when another row opens. The phone's Back then closes the form and stays on the page; the typing is kept anyway (B5). `ctx.redraw()`, not `store.update(() => {})` (break S3). | p-cashflow-a/CF-3, j-debt-fixer/x-2 (Back part), j-fat-fingers/x-2 (form part) | wave-2 batch of each page's group; goals/travel in the claude-a handoff. claude-c's TEAM row for balance/liabilities and balance/net-worth is released first (its lane landed in 658c5b8). |
| A2 | balance/net-worth | lift `showForm` to module level (household/people already did, d1973e2), so the open add form stays open after a save elsewhere on the page (the typing is already kept by B8) | p-balance/x-1 (the open form) | wave-2 balance batch |
| A3 | retirement/monte-carlo | after Runs changes: `ui.notice("ok", "Now using 10,000 pretend futures.")` beside it and the focus back on the Runs box (the section and the place are already kept by B9: `m-local` monte-carlo-runs) | j-heavy-waiting/W4 (the line and focus) | wave-2 retire batch (claude-e released the claim: "Waits for wave 1 ... W4"; wave 1 hands it back with this exact change) |
| A4 | retirement/roth-conversions | do not offer stop ages at or before the retirement age (view.js:242 offers `[60, 62, 63, 65, 67, 70, 72]` whatever the age) | p-retirement-b/RB1 (the Roth part) | wave-2 retire batch (same hand-back) |
| A5 | the ~95 views with `setTimeout(() => n.remove(), 4000)` on a notice (optional; claude-a's own are listed for the handoff) | delete the timer; the notice already stays (M8) | j-first-retiree/x-2, p-transactions-helpers/x-notice-jump (cleanup only) | each wave-2 batch, optional |
| A6 | a page with a box whose words do not say it is secret but must never be kept | `data-no-keep` on the box or its section (none known today: Settings is never kept as a whole, and every key box says "key") | B14 guard | any page owner, when needed |

Done on the branch, not to be redone: Get started keeps its own drafts, chips included (6a65660, `planner.setup.drafts`;
the first design's A7); People keeps its own open form and draft (claude-g; the first design's A2 for People); the
projection's "saved" (d1973e2; the first design's A5). Place stands aside on those boxes by rule, not by a list: a box
whose value is already the typed one is "same" and gets no cue (`dbg-setup.mjs`: "Robin" after a reload, no hint,
Continue saves it; `people-state.mjs`: Bo's 59 still in his open form, no hint added by place, plan unchanged).

Conventions for every page (docs/CONVENTIONS.md, written in step S9):
- A way back on screen is an `<a href data-back>` (or `ctx.back(href, loose)` in code); never `history.back()` by hand.
- A page that redraws because its own open/close state changed calls `ctx.redraw()`.
- Something opened over the page that Back should close uses `ctx.layer(close)` and calls the returned `release()`.
- `history.replaceState` keeps working as it is (the router keeps the entry number even for `null`), but the
  convention is `history.replaceState({ ...history.state, ... }, "", url)`.
- Two forms on one page should differ by their title ("Ana: W-4 ...", "Bo: W-4 ..."); twins are told apart only by
  order.

---------------------------------------------------------------------------------------------------------------------

## 4. Risks (what could be worse than today, and the check that catches it)

| # | risk | the check |
|---|---|---|
| R1 | Typing put into the wrong form (break K1). Identity has no values; twins only by position with an unchanged count; a box whose saved figure moved is let go and said. | `paycheck-cross2.mjs` (Bo stays empty, plan only Ana's); `twins.mjs` census on family, patLee, renterDebt (alike forms: career/salary only); node tests `pickForm`, `boxVerdict`; proposed D-TWIN. |
| R2 | The screen stands on blank room or jumps by itself (break K2, K3; person 1). Room only while drawing, drawn targets only, never released under a finger. | `hold.mjs`, `hold3.mjs`, `shorter-back.mjs`, `phantom.mjs` (where a page shuts the section of the tapped button: `wh.mjs`, the heading stays at the button's place); proposed D-STILL. |
| R3 | The hold fights the person. Anchoring stops at the first touch, wheel, key or mouse press. | kit: a drag 100 ms after Back on Will the money last? at CPU x4 follows the finger (`m-back.mjs` trip 18); `shorter-back.mjs` "after a light 30 px drag: 828 -> 828". |
| R4 | A new page opens part way down (B2 broken by a stale room or hold). `visit()` stops any hold; a new entry clears `min-height`. | D-TOP; `m-back.mjs` midAt column. |
| R5 | Old typing confuses (a figure from yesterday). A day at most, "Not saved yet." beside it, "Undo my typing" puts the shown figure back. | node tests `fresh`, `pruneTyping`; `dbg-undo.mjs`. |
| R6 | A tap that only redraws is taken as a save, or a save lets go of typing far from it (break K5). The plan must really change; scope never wider than one card. | `checkin-note.mjs`, `one-changed.mjs`, `people-state.mjs`; node test `planSig`. |
| R7 | A secret is kept (break K6). | `secret.mjs`; node test `secretText` with Settings' words and look-alikes. |
| R8 | The bottom note covers a control or lets a tap through (person 4; scope S5). The whole note takes taps; above the tapped control; at most 10 s; only after a save whose notice is not readable. | `echo-back.mjs` tap-words; `echo-way.mjs` "what the note covers"; shots of Update my balances light and dark at 390 px; T-COVERED with the note up on the pages where it shows (handed to the touch-check track). |
| R9 | A way back goes Back to the wrong month or page. Same page, equal query keys (only the check-in's `month` may be missing); walk only along one `from`. | node tests `sameEntry`, `backSteps`; `m-links.mjs`; a two-month trip (October's check-in by its chip, a step, "‹ Back to the October check-in" shows October). |
| R10 | A page that brings its answer into view is held in place instead (scope 2). Its scroll calls count (the wrapper), `planner:reveal` and the kit's `afterDraw` result end the hold. | `m-redraw.mjs` withdrawal-use-this (764 to 112, its line readable, no copy); the forms track's `m-result.mjs` on the merged build. |
| R11 | The wrapper breaks a page (a dropped argument or return value). | node test: each wrapped call forwards `this`, arguments and return value on a stub; `node qa/smoke-all.mjs`; the browser sweep's page-error count. |
| R12 | The notice put-back keeps a line a page meant to replace (a "working ..." line). Only `.notice.ok` and `.notice.error` are kept, only against a page's own (untrusted) removal, never against the kit's (`data-moved`, `data-kit-moved`, `data-kit`), and the next draw replaces them. | grep the ~95 timers (each removes a confirmation); kit: document reader and bank import show only the answer. |
| R13 | The shell's redraw replaces the box being typed in on a page that saves on change (M8 dropped): the cursor is put back, but on iPhone the keyboard may drop. | D-FOCUS-KEPT (0 today and in the prototype); phone check 10. If it bites, the forms track's `ui.later` is the one wait rule to reuse, not a second one. |
| R14 | Records keyed by an old address after a page changed it with `replaceState`. The router keeps the entry number even for `null` and the trail follows the new address. | `replace2.mjs` (`replaceState(null, ...)`, leave, Back: same entry, same spot). |
| R15 | sessionStorage full or blocked (private mode, quota). Every read and write is in `try`; the app works as today without it. | node tests run with no `sessionStorage` at all (the module imports and the pure rules run). |
| R16 | Old and new shell files mixed on the phone (`core/place.js` new, `app.js` importing it). | `npm run skew` (the pre-push hook runs `tools/main-gate.mjs`); `sw.js` keeps no file list, so the new file gets the fresh-fetch rule. |
| R17 | The touch check and this design disagree (the first design's R14): D-SCROLL-KEPT counted a button that did not move as moved when a confirmation was drawn above it; D-SEEN wanted the typed box in view after a Save more than a screen below it. The first half has landed in `$SP/wtouch` (`|moved| > 60`). | re-run the sweep (section 1 table); hand the rest to the touch-check track, never "fix" it by moving the page. |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari (and the home-screen app)

Where Safari differs for these mechanisms:
- **Scroll anchoring**: Safari has none. `html { overflow-anchor: none }` makes Chromium measure the same thing; the
  hold is the only anchoring.
- **scrollRestoration = "manual"**: supported since Safari 11. Same-document (hash) entries never use the back-forward
  cache, so Back always reaches the shell's `popstate`.
- **Edge swipe Back** (Safari, not the home-screen app): Safari slides a picture of the previous screen, then fires
  `popstate`; the page then appears at the same spot. A flash of the top would mean the room was not set before the draw.
- **History limits**: Safari throws after 100 `pushState`/`replaceState` calls in 30 s. The router calls `replaceState`
  once per new entry and `pushState` once per layer; places live in sessionStorage. A refused call leaves the entry
  unnumbered (it is then a new visit, as today).
- **The home-screen app** (`display: standalone`): no Back button and no edge swipe, so the on-screen ways back (B4, the
  note's way back) and the taps track's Back button carry all the weight. When iOS ends the app in the background, it
  starts at `./` in a fresh session: sessionStorage is empty, typing from before is gone (as today).
- **A tab Safari dropped** is reloaded at the same address when shown again; sessionStorage normally survives (same
  tab), so B3 applies. To check on the phone.
- **pagehide** is unreliable when switching apps on iOS: records are written 200 ms after the scroll stops and typing
  300 ms after it stops; `visibilitychange` to hidden also writes both.
- **Focus and the keyboard**: iOS opens the keyboard only for a focus inside a tap. Putting the focus back after a redraw
  (B9) keeps the cursor but may not bring the keyboard back (R13).
- **The bottom note and the keyboard**: a fixed note sits in the layout viewport; with the keyboard up it can be behind
  the keyboard. The build places it from `visualViewport` (bottom = `innerHeight - (visualViewport.offsetTop +
  visualViewport.height) + 8 px` when the visual viewport is more than 80 px shorter). Not measurable in Chromium; phone
  check 6.
- **Shut sections**: Safari may report a zero box, not a far one, for content inside a shut `<details>`; `drawn()` checks
  the shut section itself, so both read "not drawn".
- **Rubber-band overscroll** gives a negative or too large `scrollY` during a bounce: the hold compares with 1 to 2 px of
  tolerance and stops at the first touch.
- **Private browsing**: sessionStorage works (iOS 11+); all access is guarded.

Phone checks for the owner (Safari, then the home-screen app, on the pretend plan `?sandbox=1`):
1. Will the money last?: scroll to the bottom, open a section, tap a link, then swipe Back from the left edge: same spot,
   section open, no flash of the top, no grey below the page, nothing moves afterwards.
2. Same, but tap the link before the page has finished drawing.
3. Income: tap "+ Add another income", type a name and an amount, open the menu, tap Dashboard, then Back: the line
   "Not saved yet: what you typed in “Add an income”." with "Open it"; "Open it" shows your typing.
4. Update my balances: type two balances, pull down to reload: still there, "Not saved yet." beside the button.
5. Taxes > Estimated payments: type a first-quarter payment, then save last year's figures: the payment is still in its
   box; "Undo my typing" puts back what was there.
6. Update my balances: type a balance and tap Save while the keyboard is still up: the "saved" note is above the keyboard
   and readable, and a tap on its words does nothing to the page under it.
7. From the monthly check-in: tap a step, save something, use the note's "‹ Back to the ... check-in", then Back once:
   the Dashboard (not the step again). In the home-screen app, use only the on-screen links.
8. Income: open Ana's row, change the amount, tap Bo's row by mistake: a note says your typing for Ana is kept; Ana's row
   shows it again.
9. Type in a box, switch to another app for a minute, come back: the typing is still there.
10. In a box that opens the keyboard, after a save elsewhere on the page: is the cursor still in your box, and is the
    keyboard still up?
11. Settings: type something in "API key (for another service)", go to the Dashboard and back: the box is empty (never
    kept).
12. Withholding: change a paycheck figure and Save: the section closes and its heading stays where Save was; "Paycheck
    figures saved." can be read at the bottom.

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each one small enough to verify alone)

The machine-readable list is `$SP/w1/place/steps.json` (id, title, files, change, checks, closes). Every step: `npm test
&& npm run check`, `npm run leak-guard`, one CHANGELOG line (with `Prompt: <id>` when it carries out a prompt), and the
kit scripts named. The kit scripts live in `$SP/w1/place/f`; copy them to the builder's scratch, point `lib.mjs`'s
`ROOT` and `BASE` at the build worktree, and drop their `?place=off` runs once the switch is gone (step S9 keeps a copy of
today's tree for the "today" column instead). The prototype patch is the reference for every step.

| step | files | what | checks (all on the phone kit, `?sandbox=1`) |
|---|---|---|---|
| S1 | core/router.js, tests/place.test.mjs | numbered entries, kinds, trail, `entry/first/at/touch/open(via)/layer/back`, `data-via`, the `replaceState` keeper; `scrollRestoration` still "auto" | node: `sameEntry`, `backSteps`, `kindOf`; `tests/router.test.mjs` unchanged; kit: Get started Back/Forward through its questions (`suFrom` kept); `replace2.mjs` (entry kept); D-TOP 0 |
| S2 | core/place.js (pure rules, locator, form identity), tests/place.test.mjs | `shape`, `secretText`, `pageKeyOf`, `neverKept`, `boxVerdict`, `pickForm`, `seenEnough`, `echoStay`, `fresh`, `prune`, `pruneTyping`, `planSig`; `keyOf/locOf/locate/drawn/formTitle/fkOf` | node: the 12 tests of the prototype; `twins.mjs` (family, patLee, renterDebt: alike forms only on career/salary); the locator census (0 wrong) |
| S3 | core/place.js (wrapper), core/ui/base.css `html { overflow-anchor: none }`, core/router.js `scrollRestoration = "manual"` | one wrapper of the scroll and focus calls with `addScrollHook`, `busy`, `scrolls`, `scrollTo` | node: each wrapped call forwards `this`, arguments and return value (stub); `node qa/smoke-all.mjs`; all 159 pages opened and stepped back through for family and renterDebt: 0 page errors |
| S4 | core/place.js (records, hold, arrive, leave, visit), core/app.js (`show()` new-address branch, scroll/pagehide/visibility notes, `router.start((route, entry) => show(route, { entry }))`) | Back, Forward and Reload put back the place and the folds the person set; room only while drawing | `m-back.mjs fix 1` and `fix 4` vs `off 1`; `shorter-back.mjs`; `hold3.mjs` (place half); `unmeasured.mjs` timeline-back; D-BACK, D-TOP; proposed D-STILL |
| S5 | modules/overview/guide/frame.js (`backLink`), core/app.js (`a[data-back]` listener, `ctx.back`) | on-screen ways back go Back | `m-links.mjs fix` (history +0 on the link, the spot of the tap, then Back reaches the Dashboard); a two-month check-in trip; proposed D-WAYBACK |
| S6 | core/place.js (`before`, `restore`, `anchor`), core/app.js (`show()` keepScroll branch, `ctx.redraw`, N1 focus) | the same page drawn again keeps folds, focus and the tapped control's place; the page (or the kit) wins when it scrolls | `m-redraw.mjs fix` (moved 0 where the control stays; withdrawal page wins), `m-local.mjs fix`, `hold.mjs` (0 px by itself), `wh.mjs` (the shut section's heading stays); D-SCROLL-KEPT, D-FOCUS-KEPT |
| S7 | core/place.js (typing memory, cues, kept line, Undo), core/ui/base.css (`.place-*`), core/app.js (store subscription `planSig` + `saved`) | B5 to B8, B12 to B14 | `m-draft.mjs fix` (7 of 7), `paycheck-cross2`, `checkin-note`, `one-changed`, `secret`, `dbg-undo`, `key-split`, `stray`, `dbg-setup`, `people-state`, `unmeasured` goals-typing, `m-redraw` estimated-two-forms, federal-two-folds, accounts-note; node tests; proposed D-DRAFT, D-TWIN |
| S8 | core/app.js (`echo()`, the keepScroll decision), core/place.js (notices stay), core/ui/base.css (`.save-echo*`) | B10, B11 | `m-redraw.mjs` echo and later columns, `echo-back.mjs` (way-back and tap-words), `rules.mjs`, `wh.mjs`; D-SEEN; `node tools/shot.mjs balance/update` light and dark at 390 px with the note up |
| S9 | core/app.js, core/place.js, core/router.js, docs/CONVENTIONS.md, docs/PLAN.md, CHANGELOG.md | drop `?place=off`, `window.__placeLog`, `window.__place`; CONVENTIONS "Ways back" (`data-back`, `ctx.back`), `ctx.layer`, `ctx.redraw`, `data-no-keep`, `data-via`, spread `history.state`; PLAN "Place and typing" paragraph | `npm run build`, `npm run skew`, `node qa/smoke-all.mjs`, the touch sweep on the 18 pages (section 1 table), `node tools/shot.mjs` on section 5's pages |

Order: S1 first (the taps track's history work builds on it), then S2, S3, S4, S5; S6 before S7 (S6's checks are only
moves, folds and focus; the typing checks of `m-redraw` move to S7, scope S3); S8 after S5 (its way back needs
`data-back`) and S7 (its "kept" note); S9 last. Each step can be reverted alone after S1-S3.

---------------------------------------------------------------------------------------------------------------------

## 7. Design log, lanes and seams

**Owner decisions this relies on** (`docs/DESIGN_LOG.md`):
- 2026-09-15: "every save/add/remove confirms with a green notice; errors are red and say what to do next", kept across
  the re-render with a module-level `pending`. The bottom note only copies those notices where the eye is; pages keep
  their `pending`. The notice now also stays until the person acts (B11).
- 2026-09-15: "a page with data folds its add form behind "+ Add another ..."". Not undone: the page's own folding wins
  (only sections the person opened or shut are kept); the kept line (B6) says where the typing is, with "Open it".
- 2026-09-16 (Social Security, finding 4): "the one just saved stays open". B9 keeps a section the person opened open
  after a save on every page.
- 2026-11-06: "every page ends with exactly one way on ... No Next bar is fixed to the bottom of the screen (it rides over
  the keyboard and covers the page's own buttons)". The bottom note is not a bar: it shows only after a save whose
  notice cannot be read, carries no Next (only the notice's own action and, from the check-in, the way back), takes every
  tap on itself, sits above what was just tapped, rides above the keyboard, and leaves within 10 s. It does cover the
  page's last row while it shows; that is the cost of a readable confirmation, and it is said here so the owner can
  weigh it.
- 2026-11-06: "the household's view never shows build progress, "soon" pages, or PC / AI helper / sync wording". New
  words on screen: "Not saved yet.", "Undo my typing", "Open it", "Not saved yet: what you typed in “...”.", "Some of
  what you typed in “...” was not put back: those figures were changed since.".
- 2026-11-06 review: "the setup screens opened from a row of Your plan lead back to it ("‹ Your plan", and Save)": B4
  makes "‹ Your plan" a real step back, along the whole Next-result walk.

**Choices made without the owner** (each the conservative option):
1. No "leave this page? your typing will be lost" dialogs: nothing is lost, so nothing to ask.
2. Typing is kept in this tab only (sessionStorage), for a day, never in the plan or on the PC.
3. Only sections the person opened or shut are kept across a save; the page's own folding wins otherwise.
4. The bottom note carries at most the notice's own action and the check-in way back; never a Next.
5. Notices are kept against page timers rather than deleting ~95 timers in wave 1 (deleting them is A5, optional).
6. No kept pages: Back draws the page again and puts the place back (simpler; same measured result).
7. "Undo my typing" stays (the critics offered "Clear what I typed"): the button puts back the saved figures, it does not
   empty the boxes, so "Clear" would promise the wrong thing; "my typing" keeps it apart from the kit's "Undo", which
   takes back a change to the plan (forms N6).
8. The prototype switches are removed in the build (no hidden modes in the household's view).

**Lanes.** Files this track changes: `core/router.js`, `core/place.js` (new: add it to TEAM row 75's claim, with the taps
track's `core/taps.js`), `core/app.js` (only `show()`, `echo()`, the `store.subscribe` callback, `boot()` and three
`ctx` members in `makeCtx()`), `core/ui/base.css` (shell selectors: `.place-*`, `.save-echo*`, `html`),
`modules/overview/guide/frame.js` (`backLink` only), plus the required companions `tests/place.test.mjs` (rule 8),
`docs/CONVENTIONS.md`, `docs/PLAN.md` and `CHANGELOG.md` (rule 12). Not touched: `index.html`, `core/ui/dom.js`, any
`view.js` or `compute.js`, any claude-a page (they get B1 to B14 from the shell), `modules/overview/setup/compute.js`,
`modules/retirement/projection/compute.js`, `modules/overview/guesses/estimators/*`. No new global CSS outside
`base.css`. `docs/DESIGN_LOG.md` is the owner's record: this track adds nothing to it.

**Who changes which function** (with the taps design `$SP/w1/taps/design.md` and its scope critic's split, and the forms
designs `$SP/w1/forms2/final.md` G1-G4, N1-N6 and `$SP/w1/forms/design.md` "Contract with place"):

| file / function | place | taps | forms |
|---|---|---|---|
| `core/router.js` (all of it) | owns: numbers, trail, `layer`, `back`, `open(via)`, `data-via`, the `replaceState` keeper | adds nothing; uses `entry()`, `first()`, `at(n)` (page and `via` of the entry before), `layer(close)`, `open(href, { via: "menu" })`; drops `stampEntry()` and `planner.firstEntry` | - |
| `core/place.js` | owns | `place.addScrollHook(fn)` for reduced motion (no second wrapper) | fires `planner:reveal` (place listens) |
| `app.js show()` | leave/visit/record and the room before the draw; `arrive` or `refill`+`tell` after; keepScroll `before`/`restore`/`anchor`; the note's decision | paint-first yield for a new address, after the room is set; `landFocus()` (with `preventScroll`) and `updateBack()` after place's `arrive` | `ui.drawStart()` before render; `ui.afterDraw({ keepScroll })` between place's `restore` and `anchor` |
| `app.js echo()` | owns (`role="status"`) | `announce()` reads an "ok" notice only when no `.save-echo` showed; errors left to forms' `role=alert` | - |
| `app.js` store subscription | `planSig` + `place.saved()`; the 50 ms redraw unchanged | - | `ui.setStore(store)` |
| `app.js boot()` | `place.start`, place notes, the `a[data-back]` listener, `router.start((route, entry) => show(route, { entry }))` | drawer listeners | kit install |
| `app.js makeCtx()` | `ctx.back`, `ctx.layer`, `ctx.redraw` | no `goBack` / `cameFrom` (use `ctx.back`) | - |
| `toggleDrawer` / `closeDrawer` / `paintDrawer` | nothing | owns: inert, focus, Escape, visibility; `const release = router.layer(closeDrawer)` on open, `release()` when it closes itself; menu rows carry `data-via="menu"` | - |
| `index.html` | nothing | `#nav-back` | - |
| `core/ui/dom.js` | nothing | - | owns |
| `frame.js` | `backLink` (`data-back`, `data-back-loose`) | named rows (`CAME_FROM`, `RESULT_ROWS`) built with `backLink` | - |
| `base.css` | `.place-*`, `.save-echo*`, `html { overflow-anchor: none }` | drawer, `#nav-back` | `.kit-*`, notice link padding |

**The order inside `show()`** (all three tracks edit it; this is the contract):
1. place: `leave(from)`, `forgetAfter`, `visit`, `recordOf` (they read the old page, so before anything is cleared);
   on a keepScroll draw, `before()`.
2. shell: page cleanup, `replaceChildren()`; place sets the room (`min-height`).
3. taps: paint first and yield one frame for a new address (on a Back the blank frame stands at the restored place).
4. forms: `ui.drawStart()`; the page renders (place counts its scroll calls; `planner:reveal` is listened to).
5. place: new address: `arrive(rec)` or `refill()` + `tell()`; keepScroll: `restore()` (folds, typing, focus, N1).
6. forms: `const kitMoved = ui.afterDraw({ keepScroll })`.
7. place: `anchor()` only when `!kitMoved` and the page did not scroll itself; otherwise the room goes one frame later.
8. place: the bottom note is decided one frame later (and after a page scroll stops).
9. taps: `landFocus()` and `updateBack()`.

**What each provides the others.** Place gives taps the entry numbers and trail (`entry`, `first`, `at`), the layer
API, `open(via)`, `data-via`, `addScrollHook`, and a hold that never moves the page under a finger and draws nothing
between `pointerdown` and `click` (G4). Place gives forms: `planner:reveal` and `kitMoved` end the anchoring (G1, N2);
`data-moved`, `data-kit-moved`, `data-kit` notices are the kit's (G2); `.notice-action` is the note's first way (G3);
quiet refill (N3), focus moved only on a redraw (N4), N1 focus to the fresh notice, and a held submit (plan unchanged)
never counts as saved. Taps gives place: the drawer as a layer (B12 of the first design: j-fat-fingers/x-2's menu part
is taps' B8, j-navigator/N3), the Back button for the home-screen app, the double-tap guard (place dropped its own 700 ms
guard). Forms gives place: `ui.reveal`, `afterDraw`, the markers above, and `ui.later` as the one "wait while typing"
rule should R13 need it.

**Apply order.** Place S1 lands first (or taps lands the same router API from this patch: one numbering). Then the three
tracks in any order, provided the `show()` order above holds; the integration check is the union of their kits:
`m-back`, `m-redraw`, `m-links` (place), `t1-dbl`, `m4-menu`, `m6-ways` (taps), `m-result`, `m-err` (forms).

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (52 findings, on c6fb730)

States: **W1** = closed by wave 1 (the behavior named, measured as listed); **branch** = already closed on the branch
(commit or page owner), wave 1 keeps it closed; **W2** = not closed by wave 1, with its owner (section 3). A finding can
carry more than one state for its parts.

SH-BACK (19)

| finding | state | measured by |
|---|---|---|
| j-first-family/x-1 | W1: B1 | m-back |
| j-first-freelancer/x-2 | W1: B1 | m-back |
| j-first-retiree/x-1 | W1: B1 | m-back (ruth trips) |
| j-heavy-waiting/W1 | W1: B1 | m-back x4; unmeasured timeline-back (2,975 kept) |
| j-monthly-return/x-back-top | W1: B1 | m-back, m-links checkin-backlink |
| j-navigator/N1 | W1: B1 (Back, Forward), B3 (Reload), B4 ("‹ Your plan") | m-back reload columns, m-links plan-backlink |
| p-career-household-system/F1 | W1: B1 | m-back (system/settings trip, folds kept) |
| p-cashflow-a/x-1 | W1: B1 | m-back (cashflow trips) |
| p-insurance-estate/IE-1 | W1: B1 | sweep D-BACK (insurance/health) |
| p-overview-home/OV-1 | W1: B1 | m-back (overview trips) |
| p-retirement-a/R-A2 | W1: B1 | m-back (retirement/projection, family and ruth) |
| p-retirement-b/x-2 | W1: B1 | m-back (withdrawal-strategy, pensions) |
| p-retirement-c-scenarios/x-back-loses-place | W1: B1 | m-back (scenarios/advisor-plan) |
| p-taxes/x-1 | W1: B1 | m-back (taxes/federal) |
| j-first-renter/x-3 | W1: B1 | m-back (renterDebt trips) |
| j-monthly-return/x-backlink-history | W1: B4 | m-links checkin-backlink, echo-back way-back |
| j-one-answer/A5 | W1: B1 | m-back, m-links quick-backlink |
| j-one-answer/x-4 | W1: B4 | m-links quick-backlink |
| p-overview-path/x-2 | W1: B1 | m-back (guide trip, patLee) |

SH-DRAFT (21)

| finding | state | measured by |
|---|---|---|
| p-insurance-estate/x-1 | W1: B8 | m-draft health-two-forms |
| p-taxes/T1 | W1: B5 (c), B8 (a, b, d, e) | m-draft estimated-two-forms; m-redraw estimated-two-forms, federal-two-folds |
| j-debt-fixer/x-2 | W1: B5 (the typing); W2: A1 (Back closes the form; debt and balance batch) | m-draft debts-form-back-forward |
| j-fat-fingers/FF2 | W1: B5, B6 (leaving), B7 (the stray row) | m-draft income-stray-row, stray.mjs |
| j-first-family/F2 | branch: Get started's own drafts (6a65660); W1 stands aside (no second cue) | dbg-setup |
| j-monthly-return/x-typed-lost | W1: B5, B3, B8 (the month chip) | m-draft update-continue-back, update-reload; checkin-note |
| j-navigator/x-2 | W1: B5, B3 | m-draft update-continue-back, update-reload |
| p-balance/B1 | W1: B5 | m-draft update-continue-back; key-split |
| p-balance/x-1 | W1: B8 (the typing); W2: A2 (Net worth's add form stays open; balance batch) | m-redraw accounts-note-then-balance |
| p-career-household-system/x-1 | branch: People keeps its open form and draft (d1973e2, claude-g); W1: B8 (the rest of the page) | people-state |
| p-cashflow-b-goals/x-3 | W1: B5, B6 | unmeasured goals-typing |
| p-debt-property/x-3 | W1: B5, B6 (the typing); W2: the row 32 px under "Add" is page spacing (debt batch, checked with the taps track's T-TARGET) | m-draft debts-form-back-forward |
| p-insurance-estate/IE-9 | W1: B5 | m-draft health-two-forms (same page); sweep |
| p-retirement-a/x-2 | W1: B5 | m-redraw projection-settings (typing in the settings form kept); sweep |
| p-retirement-c-scenarios/x-half-typed-form-lost | W1: B5 | sweep (scenarios pages); kit D-DRAFT proposed |
| j-fat-fingers/x-2 | taps: B8 (the menu, j-navigator/N3); W2: A1 (edit forms) | taps m4-menu |
| p-career-household-system/F2 | W1: B5 | people-state; sweep |
| p-cashflow-a/CF-2 | W1: B5, B6 | m-draft income-add-menu-back |
| p-cashflow-a/CF-3 | W1: B5 (the typing); W2: A1 (Back closes the form; cash batch) | m-draft income-add-menu-back |
| p-investments/INV-4 | W1: B5, B6 | m-draft (the same mechanism; investments/holdings in the sweep) |
| j-first-renter/x-4 | branch: Get started's own drafts (6a65660); W1 stands aside | dbg-setup |

SH-REDRAW (12)

| finding | state | measured by |
|---|---|---|
| j-first-freelancer/x-1 | W1: B9 | m-redraw, sweep D-SCROLL-KEPT |
| j-monthly-return/MR-1 | W1: B10 | m-redraw update-balances (today: no confirmation readable, no copy), echo-back |
| j-one-answer/x-2 | branch: the section and the jump (claude-e: today 0 px, open); W1: B10 (the "saved" line: today not readable, no copy) | m-redraw projection-settings |
| j-debt-fixer/x-3 | W1: B9 (today -64 px), B10 | m-redraw cards-balance-transfer |
| j-first-retiree/x-2 | W1: B11; W2: A5 (optional timer cleanup) | m-redraw "later" column |
| j-heavy-waiting/W4 | W1: B9 (the section and place: today shut and 218 px); W2: A3 (the "Now using ..." line and focus; retire batch) | m-local monte-carlo-runs |
| p-balance/B2 | W1: B10 | m-redraw update-balances |
| p-retirement-a/R-A4 | branch: the section and the jump (claude-e); W1: B10 | m-redraw projection-settings |
| p-retirement-b/RB1 | W1: B9 (sections), B10; W2: A4 (Roth stop ages; retire batch) | m-redraw buckets-years (today: shut, -261), m-local |
| p-retirement-b/x-1 | branch: the page brings its line into view and keeps it (claude-e); W1: B11 guard, page wins (B9) | m-redraw withdrawal-use-this (both: 764 to 112, line kept 5 s) |
| p-transactions-helpers/x-notice-jump | W1: B11; W2: A5 (optional cleanup) | rules.mjs ("Rule added." still there at +6.2 s; today gone) |
| p-taxes/x-5 | W1: B10 | node test seenEnough (14 px under the bar is not seen); wh.mjs (Withholding: the line at 15 px, the copy shows) |

Totals: 52 findings; W1 closes all or part of 48; 4 are closed on the branch for their main part (j-first-family/F2,
j-first-renter/x-4, and the place part of j-one-answer/x-2 and p-retirement-a/R-A4); 8 have a W2 part with an owner (A1
x3, A2, A3, A4, A5 x2, plus p-debt-property/x-3's spacing) and one a taps part (j-fat-fingers/x-2's menu). None is
declined.

---------------------------------------------------------------------------------------------------------------------

## 9. Answers to the critics

Every blocking item changed the design; none is refuted. Evidence is from the final prototype on c6fb730 unless it says
"first prototype" (the first design's code ported to c6fb730, `f/out/base-*.log`). Logs are in `$SP/w1/place/f/out`.

### Breaker (`critique-break.md`)

**K1, typing poured into another person's form: changed.** A form's identity is now its title, its section, its submit
button's words and its boxes' keys, with no values at all; two forms that are still alike are given typing only by their
order while their count is unchanged (`fkOf`, `pickForm`; node test with the twin cases). `paycheck-cross2.mjs`
(`fix1-paycheck-cross2.log`): back by the menu, Ana's box shows 120 with "Not saved yet. Undo my typing", Bo's is empty
with no hint; after Save in Ana's the plan is `{p-ana: 120}`; after Save in Bo's it is still `{p-ana: 120}` (first
prototype: Bo got 120 and saved it). Census (`twins.mjs`, 159 pages each): the only alike forms are career/salary's two
"Raises and promotions" (family, patLee); renterDebt has none; the paycheck forms now differ by title. Touch rule
D-TWIN proposed.

**K2, a folded-away button anchored, blank screen then a 1,000 px jump: changed.** Only drawn elements hold the place
(`drawn()`: a layout box and not inside a shut section); a target inside a section the page shut is replaced by that
section's summary, held at the target's place; room is never borrowed after the draw. `phantom.mjs` no longer
reproduces on c6fb730 (Will the money last? no longer opens its settings by itself for samMidSetup), so the rule was
measured where a page does shut the tapped button's section: Withholding's first Save (`wh.mjs`): the shut section's
heading stays at 393 where Save was, no blank, the copy of "Paycheck figures saved." at the bottom (today: the heading
at 192). Estimated payments' "last year" save (`hold.mjs`): y 1,018 at +1.5 s and at +9 s, no `min-height`, 11 px under
the page's end (first prototype: 487 px blank, then a 426 px jump). On Safari a shut section's content may report a zero
box; `drawn()` checks the shut section itself, so it is "not drawn" either way.

**K3, Back to a shorter page: blank for 7.5 s then a jump: changed.** Room is borrowed only while the page is drawing,
dropped one frame after the draw when the page is not growing (600 ms after its last growth otherwise), and never under
a finger. `shorter-back.mjs fix` (`fix1-shorter-back_fix.log`): y 828 from 0 ms to 8.7 s, no `min-height`, the 121 px
under the page are its real end (today: the same 828 and 121); a 30 px drag then: 828 to 828 (first prototype: 368 px
of borrowed blank for 7.1 s, then a 247 px jump).

**K4, the note's "‹ Back to ... check-in" adds a step: changed.** The note's way is the page's own link with its
`data-back`, so the same `router.back` handles it; a button way presses the page's own button. `echo-back.mjs fix`
(`s1-echo-back_fix.log`, `dbg-echo`): after "Save all balances" the note carries "See net worth ›" and "‹ Back to the
October 2026 check-in"; the latter returns with history +0 to the spot of the tap (0, where the step link had been
brought; the critic's "285" was before the kit's `bring` scrolled to the link), the note goes, and the phone's Back then
shows the Dashboard. `m-links.mjs fix`: the frame's links too (history grows only by the step: 1, today 2). D-WAYBACK
proposed.

**K5 (a), a redraw-only tap taken as a save: changed.** The store subscription passes `planSig(before) !== planSig(after)`
(the plan without `meta`); nothing is "saved" when only the stamp changed, and the scope is the act's own form, else its
own card, section, `details` or fieldset, never wider. `checkin-note.mjs fix`: "Car repair 800, plan for it" typed on
October, November chip, back on October: the note is in its box (first prototype and today: empty).
**K5 (b), one changed figure lets go of the whole form: changed.** Each box is judged on its own (`boxVerdict`).
`one-changed.mjs` (`fix1-one-changed.log`): drawn 380,000 | 86,000 | 42,000 | 31,000 | 18,000; typed 91,000, 43,000,
32000; house saved as 395,000 elsewhere; Back: 395,000 | 91,000 | 43,000 | 32,000 | 18,000, hint shown (first prototype:
all five let go, no word). A box let go is said once (B6's line).

**K6, an API key written to sessionStorage: changed.** The filter reads name, id, aria-label, label text and placeholder,
splits camelCase, and matches key, token, password, passcode, passphrase, secret and PIN as words; nothing on
`#/system/*` is kept; values are no longer part of any identity. `secret.mjs` (`fix1-secret.log`): `stored: false`, no
typing key. Node tests: Settings' "API key (for another service)", `apiKey`, "Access token", `bankPin` are secret;
"Transit pass a month", "Monkey bars", "Pinned note", "Keystone fund", "Passport renewal" are not.

Should fix:
- **S1, typing stranded behind presentation keys: taken.** Page key (`pageKeyOf`) drops `from`, `guide`, `step`, `review`,
  `q`, `add`, `show`, `view`. `key-split.mjs`: typed on `#/balance/update?from=review&review=2026-10`, shown from the
  menu's `#/balance/update` (9,999 and 3,900, hint), kept key `#/balance/update`.
- **S2, loose entries never expire: taken.** They carry `at`; `pruneTyping` runs on load, on every write and at every
  refill. Node test.
- **S3, `store.update(() => {})` to close a form: taken.** `ctx.redraw()`; A1 uses it.
- **S4, the saved row off screen after Save: taken.** For a button inside an edit form, the row that opened the form is
  second in the tap chain, before the card heading (`chainOf`). `hold.mjs` income-edit-save and networth-edit-save: the
  screen stays (y 312, 444) and nothing moves by itself.
- **S5, `replaceState(null, ...)` wipes the entry number: taken, in the router.** The router keeps `n`/`l` when a page
  passes `null` or a state without them, and the trail follows the new address. `replace2.mjs`: number kept (1), Back to
  the same spot (233). Pages are still asked to spread the state (CONVENTIONS).
- **S6, opening the menu drops Forward: declined.** Any Back-closable sheet needs a history entry, and a new entry drops
  Forward in every browser; the router steps off a dead `l` entry. The menu is the taps track's (its B8); they own the
  call.
- **S7, census blind to well-formed wrong matches: taken.** The duplicate-identity count per page (`twins.mjs`) and the
  ground-truth trip `paycheck-cross2.mjs`; the locator's position rule ("order") needs an unchanged count.
- **S8, iPhone checks: taken.** Section 5: shut sections' boxes, focus without a tap, the note with the keyboard up
  (now placed from `visualViewport`), the edge-swipe picture, a dropped tab, the home-screen app.
- **S9, touch rules: taken.** D-STILL, D-WAYBACK, D-TWIN proposed (section 1).

### The person (`critique-person.md`)

**1, blank space then a jump after a save or a Back: changed** (with K2, K3). `hold.mjs` five saves: moved by itself 0 px
from +1.5 s to +9 s, no borrowed room (first prototype: blanks of 269 to 487 px, jumps of 208 to 426 px). `hold3.mjs`
reload and "save elsewhere, then Back twice" (`fix1-hold3.log`): y 364, no `min-height`, "Not saved yet: what you typed
in “Add an income”." on screen, 0 px in 9 s (first prototype: the whole screen blank, then 914 px). Under a touch: the
room waits for the finger's lift and anchoring stops at `touchstart`; `dbg-undo.mjs` taps "Undo my typing" at its screen
place and the tap reaches it (`elementFromPoint` is the button; the first prototype's trace hit the Q1 box). D-STILL
proposed.

**2, "Undo my typing" does not undo: changed.** The Cancel rule now needs words ("Cancel", "Close", "Never mind",
"Discard"), and Undo puts each changed box back to its drawn value with `input`/`change` events before forgetting.
`dbg-undo.mjs` (`fix1-dbg-undo.log`): Q1 back to its drawn "", hint gone, kept typing `{}`.

**3, the note's way back adds a step and lands at the top: changed** (K4). Same evidence.

**4, the note lets taps through to controls under it, for 12 s: changed.** The whole note takes taps; a tap on its words
closes it; only its 44 px rows act; it sits above the tapped control when it would cover it; it stays 4 to 10 s.
`echo-back.mjs fix` tap-words: the tap on the note's words (over a paragraph) leaves the address and history unchanged
and closes the note. On c6fb730 the withdrawal page's "Use this one" shows its own line, so no note appears there at all
(`m-redraw` withdrawal-use-this, echo none).

Should fix:
- **S1, the kept note points at nothing, then covers the form: taken.** A line where the form lives, with "Open it" (the
  tap that opened the form) and "Undo my typing"; the bottom note only when that line is off screen once the page stops
  moving; the line goes when the form is filled. `m-draft` income-add-menu-back (line on screen at 364);
  `unmeasured.mjs` goals-typing ("Open it" brings back "Boat fund" and 7500 with the hint); `stray.mjs`.
- **S2, refilled boxes far from their button carry no sign: taken.** Every refilled box gets a small "Not saved yet"
  under it, besides the line by the form's button.
- **S3, the note at the top is not where the eye is: taken.** Above the tapped control instead (`.save-echo.above`).
- **S4, "‹ Your plan" lands differently after Next result: taken.** `backSteps` walks back along entries opened with the
  same `from` (node test: two steps from the second result); `m-links` plan-backlink: the spot of the tap (121).
- **S5, form names with figures and chevrons: taken.** `formTitle` reads the fold's title words, chevrons dropped;
  `twins.mjs` lists every form title: the only figures left are real ones ("Ana, 36", "The four payments for 2026").
- **S6, a kept page shows an old confirmation: moot.** Kept pages are dropped; Back draws afresh and a page's `pending`
  is shown once.
- **S7, phone checks: taken** (section 5, checks 1, 3, 5, 6, 7).
- **Touch rules: taken** (D-STILL; "the note covers controls" goes to the touch-check track as T-COVERED with the note up).

### Scope (`critique-scope.md`)

**1, seams with taps not written: changed.** Section 7's table and `show()` order: the router is place's (taps adds
nothing and uses `entry`, `first`, `at`, `layer`, `open(via)`, `data-via`); the drawer is taps' and calls
`router.layer(close)`; place makes no drawer edit; one way back API (`ctx.back`; no `goBack`/`cameFrom`); one wrapper
(`addScrollHook` for reduced motion); j-fat-fingers/x-2's menu part is marked "taps B8 (j-navigator/N3)".

**2, forms seams missing; the withdrawal answer undone: changed.** `planner:reveal` ends the hold during and after the
draw; a page scroll call during a save's hold ends it (page wins); `afterDraw`'s `kitMoved` skips the anchor; notices
with `data-moved`, `data-kit-moved`, `data-kit` are the kit's; `.notice-action` is the note's first way; N1, N3, N4 as the
forms track specifies. `m-redraw.mjs fix` withdrawal-use-this: 764 to 112 as the page wants, its line readable, no copy
(the critic's run of the first prototype: 764 to 729, not readable).

**3, measured on an old tree: changed.** Everything re-run on c6fb730 (section 1). Rows already fixed on the branch are
marked "branch" (section 8). Get started and People keep their own drafts; place stands aside by rule (a box already
holding the typed value is "same": no fill, no cue): `dbg-setup.mjs` ("Robin" after a reload, no hint, Continue saves
it), `people-state.mjs`. Typing keyed by page (break S1).

**4, findings waved through: changed.** Three states in section 8 with owners. A3 and A4 cannot be wave 1 (this track's
files have no `view.js`): they go back to the wave-2 retire batch with the exact change; A1 is owned per wave-2 batch, and
claude-c's TEAM row is released first; p-debt-property/x-3's spacing goes to the debt batch with T-TARGET. The four
unmeasured pages are now measured: Goals (`unmeasured` goals-typing), the transactions helpers (`rules.mjs`: "Rule
added." still there at +6.2 s; today gone), Withholding (`wh.mjs`), the Life timeline (`unmeasured` timeline-back:
2,975 kept on a 6,983 px page). The SH-DRAFT findings' own pages too (`drafts.mjs`): Policies (IE-9), Pensions
(p-retirement-a/x-2), Advisor plan (x-half-typed-form-lost), Contacts (F2), Holdings (INV-4): typing back 2 of 2 with
the hint on each (today 0 of 2); insurance/property (IE-1): 345 back to 345.

**5, two mechanisms that close nothing: changed.** M8 (the redraw held while typing) and place's drawer edits are
dropped; `router.layer` stays only as the API taps and A1 call.

Should fix:
- **S1, node tests for pure rules: taken.** The pure rules are split at the top of `place.js` and in the router, import in
  Node with no DOM, 12 tests (`tests/place.test.mjs`); the DOM glue is checked by the kit.
- **S2, permanent checks: taken.** Section 1 names the rules and proposes D-DRAFT and D-WAYBACK (and D-STILL, D-TWIN).
- **S3, build order: taken.** S6 (moves) before S7 (typing), with the typing checks moved to S7; S8 after S5 and S7; kept
  pages dropped, so no revertible last step is needed; the kit's `lib.mjs` takes ROOT and BASE; the switch is dropped in
  S9 with a copy of today's tree kept for the "today" column.
- **S4, lanes: taken.** No `tools/check.mjs` rule (it belonged to kept pages); `html { overflow-anchor: none }` is a
  `base.css` shell selector; `core/place.js` and `core/taps.js` to be added to TEAM row 75's claim.
- **S5, the note's stay and covering: taken.** 4 to 10 s, the whole note takes taps, above the tapped control; T-COVERED
  with the note up goes to the touch-check track.
- **S6, "Undo my typing" vs the kit's Undo: declined** (section 7, choice 7): the button puts the saved figures back, so
  "Clear what I typed" would promise empty boxes; "my typing" already keeps it apart from the kit's "Undo".
