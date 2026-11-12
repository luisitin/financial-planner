# Place and typing memory: the judged plan (wave 1)

Question: place and typing memory (Back, Forward, Reload; typing kept; a save that keeps the page as it was). Themes
SH-BACK (19 findings), SH-DRAFT (21), SH-REDRAW (12): 52 findings. One root: the shell throws the page away and draws it
again (`core/app.js` `show()`: `root.innerHTML = ""` on every new address, and 50 ms after every `store.update` on the
same page). The shell keeps what a person would lose and puts it back after the page has drawn, so no page changes in
wave 1.

**Verdict: a merge, built on design A ("place").** The two designs measured the same on Back, Forward, Reload and the
ways back (every column equal, 13 of 13 trips at normal and at 4x slower CPU). They differ on six journeys, and each
failure has a design-level cause that the other design does not have. A held 32 of 34 behaviors outside the Back suite;
B held 30 (today 7). A's two failures are fixed by two of B's mechanisms; of B's four failures, three come from B rules
that A does not have (identity, room, note taps) and one is a bug class (a named box shadowing `form.contains`). So the base is A, and these parts come from B:
1. **The save-and-leave rule** (B M4 `usedBy`): a tap that saved the plan and left the page used its form's boxes and every
   box in no form, so their typing is let go. Fixes A's Import failure (D15).
2. **The page-removed-a-typed-form path** (B M4: one `MutationObserver` that is off while the shell clears or draws,
   `busy()` / `idle()` with `takeRecords()`), with the note shown at the moment of the stray tap. Fixes A's silent stray
   tap (E1).
3. **Typing filed under the page it was typed on, taken at the first keystroke** (B's `where`), keyed by A's page key.
4. **`showConflict()` cancels a running hold** (B M2) as well as A's "no record while the bar is up".
5. **A place record is written only once the page on screen has finished drawing** (B M2 `drawn`), so a half-drawn
   page that throws (`core/heal.js`'s one reload) never overwrites the record the reload will use.
6. **Storage hygiene** (B M4): places and typing under separate keys, a format version on both, a visit id `v` in
   `history.state`, so a tab opened from a link (which may copy sessionStorage) never mixes records.
7. **The eight `data-back` links of the guide frame and the month rule inside `backSteps`** (B M6), with no extra
   attribute.
8. **`show()` stays a list of calls**: the helpers live in `place.js` as `afterArrive()` and `afterSave()` (B P6).

And one rule that neither design wrote down, from B's Rules-page crash: **the shell never reads a method off a form
element** (`form.contains`, `form.submit`, `form.reset`, `form.elements`...): a box named `contains` shadows it. Use
`Node.prototype.contains.call(form, x)` and friends.

`$SP` = `$SP`.

**Evidence base.** Both prototype patches applied cleanly to the tip **ee09f6e** (the shell files are byte-identical to
c6fb730 and d22b718, where the architects measured; the pages are not):
- `$SP/w1/judge-place/A`: ee09f6e + `$SP/w1/place/final-proto.patch` (6 files, +1,062 -48; diff verified identical).
- `$SP/w1/judge-place/B`: ee09f6e + `$SP/w1/place2/final-proto.patch` (6 files, +887 -41; verified identical).
- `$SP/w1/judge-place/T`: ee09f6e untouched ("today").
- Served on 127.0.0.1:9401 (A), 9402 (B), 9403 (T) by `serve.mjs`; all three stopped.
- Scripts (one thumb for all three; they read only what a person sees: scroll, open sections, the values in the boxes,
  words on the screen and in the note, the address, history length; never a design's own classes or storage):
  `lib.mjs`, `j-back.mjs` (Back suite), `j-draft.mjs` (typing, 15 journeys), `j-save.mjs` (saves, ways back, hazards),
  `j-recheck.mjs` (the journeys where A and B differed, again, with pictures and what each tap hit), `j-extra.mjs`
  (stray-tap words, pictures, cost of a Back). Logs and JSON in `out/`, pictures in `shots/`.
- Phone: 390 x 844, touch, Chromium, always `?sandbox=1`; finger drags are CDP touch events (about 0.4 s a swipe),
  taps land at screen points, keys are typed one at a time at 80 ms, Back is waited on like a person (1.5 s), each
  long-page trip is done at CPU x1 and x4. Households: family, ruth (retiree), renterDebt, patLee, freelancer,
  samMidSetup.
- Both prototypes' own node tests pass on the tip (A 16 of 16, B 19 of 19 with `tests/router.test.mjs`).

---------------------------------------------------------------------------------------------------------------------

## 1. Behavior (the acceptance test)

Each item: what the person does, what they see after the fix, the findings it closes, and the check. "J:" names the
judge's journey (script in `$SP/w1/judge-place`), with what A, B and today showed; the build must show at least what the
better of the two showed.

**B1. Back and Forward put me back where I was.** I scroll down a long page, open a section, tap a link or a menu row,
read a little of the other page and press Back: the first page is there at the same spot from its first frame, the
section I opened is still open, the link I tapped sits where it was on the screen. Forward takes me to the other page at
the spot I left it. However slowly the page draws, the screen never shows empty grey below the page and never moves by
itself afterwards.
Closes: j-first-family/x-1, j-first-freelancer/x-2, j-first-retiree/x-1, j-heavy-waiting/W1, j-monthly-return/x-back-top,
j-navigator/N1 (Back, Forward), p-career-household-system/F1, p-cashflow-a/x-1, p-insurance-estate/IE-1,
p-overview-home/OV-1, p-retirement-a/R-A2, p-retirement-b/x-2, p-retirement-c-scenarios/x-back-loses-place, p-taxes/x-1,
j-first-renter/x-3, j-one-answer/A5, p-overview-path/x-2.
J: `j-back.mjs` 13 trips (family x5, ruth x3, renterDebt x2, patLee x2, freelancer x1; Will the money last?, Your plan,
Federal estimate, All pages, Settings, How much to take out, Pensions, Pay off debts, Credit cards, the retirement guide,
Life timeline, Side income). A and B: Back at the place 13/13 at x1 and x4, first frame already at the place 13/13,
nothing moved by itself in the 4 s after Back, sections kept 4/4, Forward 12/13 (Pensions: the other page drew a line
above), Back again 13/13. Today: Back 6/13, sections 0/4, Forward 8/13, Back again 9/13. Touch rules **D-BACK**, **D-TOP**.

**B2. A new page starts at its top.** A link, a menu row, a search result, Next or "Continue your plan" opens the next
page at its top, even if I was on that page before. A fresh visit draws folds as the page designs them (Get started's
eight tiles stay folded, design log 2026-11-06).
Closes: none (guards today). Check: **D-TOP**; `j-back.mjs` `midAt` column.

**B3. A reload keeps my place, my open sections and my typing.** Pull to refresh, the phone reloads a dropped tab, or the
app mends itself with its one reload: same page, same spot, same open sections, my typing in its boxes with "Not saved
yet" beside the form's button.
Closes: j-navigator/N1 (Reload), j-monthly-return/x-typed-lost (reload), j-navigator/x-2 (reload).
J: `j-back.mjs` reload column: A and B 13/13 at the place, sections 4/4; today 0/13 (every reload at the top).
`j-draft.mjs` D3 (Update my balances, two balances typed, reload): A and B "18950 | 3,900" back at 682 px with the cue;
today the saved "18,000 | 4,200" at 0.

**B4. The page's "‹ Back to ..." links, and the note's, work like the phone's Back.** "‹ Back to the October 2026
check-in", "‹ Quick answers", "‹ Back to your plan" and "‹ Back to the guide: ..." take me back to the page I came from,
at the spot I left it, and add no step: the phone's Back afterwards goes where I was before. From Your plan's "Next
result" walk, "‹ Back to your plan" goes back over the whole walk. When the page they name is not just behind, they open
it as an ordinary link.
Closes: j-monthly-return/x-backlink-history, j-one-answer/x-4, j-navigator/N1 (the on-screen way back).
J: `j-save.mjs` L1 check-in step and back link, L2 Quick answers, L3 Your plan + Next result + back, L4 the note's way
back after "Save all balances" from the check-in. A and B, all four: history +0 after the link (+1 for the step itself,
+2 for the walk), the spot of the tap (0/0, 5/5, 121/121, 0/0), the note gone, then the phone's Back reaches the
Dashboard. Today: history +2 or +3, L2 and L3 land at the top, the phone's Back goes back into the step; the note has no
way back. Proposed rule **D-WAYBACK**.

**B5. What I typed and did not save waits for me.** I type in a form (an add form, an edit form, Update my balances, a tax
figure, a goal) and leave without saving: by the menu, a link, "Continue your plan", a step link, the status pill or the
phone's Back. When I come back (Back, Forward, the same link or the menu again, within a day, in this tab), my typing is
in its boxes with "Not saved yet · Undo my typing" beside the form's button. Save saves it as usual; Cancel throws it away
as today. It does not matter how I reached the page (the check-in's step link and the menu row show the same typing).
Closes: p-taxes/T1 (c), j-monthly-return/x-typed-lost, j-navigator/x-2, p-balance/B1, p-cashflow-b-goals/x-3,
p-debt-property/x-3 (the typing), p-insurance-estate/IE-9, p-retirement-a/x-2, p-retirement-c-scenarios/x-half-typed-form-lost,
p-career-household-system/F2, p-cashflow-a/CF-2, p-investments/INV-4, j-fat-fingers/FF2 (leaving), j-debt-fixer/x-2
(the typing), p-cashflow-a/CF-3 (the typing).
J: `j-draft.mjs` D1 (Income add form, menu, Back), D2 (Update my balances, "Continue your plan", Back), D7 (renter's
Store card form, Back, Forward), D10 (Net worth add form): A and B keep every typed figure (shown formatted: "1200" comes
back as "1,200"); today none.

**B6. If the form is shut when I come back, one line says my typing is kept, where the form lives, with a way to open
it.** The line reads "Not saved yet: what you typed in “Add an income”." with two buttons, **"Open it"** (presses what
opened the form) and **"Undo my typing"**. The same words show once in the bottom note only when that line cannot be read
once the screen has stopped moving after the place was put back.
Closes: the "without a word" part of j-fat-fingers/FF2, p-cashflow-a/CF-2, p-investments/INV-4, p-debt-property/x-3.
J: D1, D7, D10: with A the person gets the typing back with one tap on "Open it" (3/3); with B, whose line has only
"Throw it away" and the words "Open it again to finish it", the person must know which button opened the form (the
script tapped "+ Add another income", "Store card", "+ Add another account"). Picture `shots/AB-E2-return.png`. Fix for
the build: A showed the bottom note too while its line was on the screen (D1, E2): decide the note only after the place
is restored, and never when the line is readable (`seenEnough`).

**B7. A stray tap on another row keeps my typing, says so at once, and never puts it in the other row.** I am changing
Ana's salary; my thumb lands on Bo's row and his form opens. Bo's form shows Bo's figures. A short neutral note says
"Not saved yet: what you typed in “Edit Ana's salary”." with "Open it"; tapping Ana's row again shows my figures with
"Not saved yet". Cancel still throws the typing away.
Closes: j-fat-fingers/FF2 (the row part).
J: D6 (Ana's Amount 4100 and Yearly raise 6, stray tap on Bo, Bo's amount 5400 saved, Ana's row again): A and B: Bo's
form 5,200 / 3 as saved, Bo saved with his own 3% raise, Ana's 4,100 / 6 back with the cue. Today: Ana's typing gone.
E1 (what the screen says in the 3 s after the stray tap, every 250 ms): **B shows the note at once; A shows nothing on
the screen** (its line is drawn in Ana's section above the screen and its note never came). Pictures
`shots/A-E1-stray.png`, `shots/B-E1-stray.png`. The build takes B's same-moment path (M7).

**B8. Saving one part of a page keeps my typing in another part.** I type in one form, then save another form, tap a
month chip or tick a box elsewhere: the confirmation is about what was saved, my other typing is still in its boxes, its
section is open and "Not saved yet" sits beside its button. If the save shut the other form, its typing is kept with
B6's line. A tap that only redraws (a month chip, Show more) saves nothing and lets go of nothing.
Closes: p-insurance-estate/x-1, p-taxes/T1 (a, b, d, e), p-balance/x-1, p-career-household-system/x-1.
J: D4 (Health: "Add a plan" typed, coverage saved), D5 (Estimated: 1st quarter typed, last year saved), R5 (Federal:
wages typed in one section, Save in another), D8 (check-in note on October, November chip, October chip), D10 (Net
worth add form, "Save today's totals"): A and B keep every one (R5: "98,000" kept, its section open, Save did not move);
today none.

**B9. After a save or a choice, the page stays still under my thumb.** The sections I opened stay open, the button I
tapped stays where it was on the screen, the box I was typing in keeps the focus. If the page shuts the section that held
the button, that section's heading stays where the button was, and there is no grey below the page. If the page itself
brings its answer into view (it scrolls, or the form kit says `planner:reveal`), the page wins.
Closes: j-first-freelancer/x-1, j-debt-fixer/x-3, p-retirement-b/RB1 (the section), j-one-answer/x-2 and
p-retirement-a/R-A4 (the section), j-heavy-waiting/W4 (the section), p-retirement-b/x-1 (guard).
J: `j-save.mjs` R1 Retirement settings Save (A, B 0 px, open; today +56), R2 "Save all balances" (A, B -1; today +109),
R3 Buckets years (A, B 0 px, open; today shut, gone), R4 "Use this one" (all: the page brings its line into view, page
wins, no copy), R9 Runs on Chance the money lasts (A, B open, 1,048 kept; today shut, 1,048 to 831), R10 Stress tests
"Now" (A, B 4 of 4 open; today 3). **R8 Withholding's first Save** (the page shuts the section), twice: A puts the
section's heading where Save was, no borrowed room, the page fills the screen; **B stands at the end of the page with
382 px of empty grey under it and `min-height: 2167px` still set 5 s later** (it is released only by a scroll); today
the heading at 192 and a 56 px jump at 5 s. Pictures `shots/A-R8-5s-1.png`, `shots/B-R8-5s-1.png`. Rules
**D-SCROLL-KEPT**, **D-FOCUS-KEPT**; proposed **D-STILL**.

**B10. I can read the confirmation where I am looking.** When the page's green (or red) line is readable (60% of it, or
48 px, between the top bar and the bottom edge, and not in a shut section), that is all. Otherwise a short copy shows at
the bottom of the screen, decided one frame after the draw (a page that brings its line into view wins). It carries at
most two 44 px rows: the line's own button or link ("Undo", "See net worth ›") and, on a page opened from the monthly
check-in, "‹ Back to the October 2026 check-in". **The whole note takes my taps: a tap on its words closes it and hits
nothing under it.** If at the bottom it would cover what I just tapped, it sits just above that. It stays 4 to 10 s by its
length (at least 6 s for an error) and leaves when I go to another page.
Closes: j-monthly-return/MR-1, p-balance/B2, p-taxes/x-5, and the "no saved on screen" part of j-one-answer/x-2,
p-retirement-a/R-A4, p-retirement-b/RB1, j-debt-fixer/x-3.
J: R1, R2, R3, R8: the copy shows (R2 with "See net worth ›"); L4: the copy carries both ways. **L5 (a tap on the note's
words), twice: A's note takes the tap and closes; B's passes the tap to the paragraph under it and stays** (harmless on
that page, a control elsewhere). Today: the copy without ways. Node test `seenEnough` with p-taxes/x-5's 14 px.

**B11. Nothing on the page moves by itself.** A green confirmation a page used to take away after 4 seconds stays until
I act or the page is drawn again, so the rows under it never jump while my thumb is on the way. No borrowed blank under
the page after it has drawn, no late jump after a save or a Back, nothing released under a finger.
Closes: j-first-retiree/x-2, p-transactions-helpers/x-notice-jump, p-retirement-b/x-1 (the second jump).
J: `j-recheck.mjs` R6 (Goals edit Save, a thumb resting on the glass from +3.9 s to +5 s), twice each: A and B 0 px
and the notice still there at +5 s; today the rows move 56 px at +4.1 s and the notice goes. R7 ("Rule added."): A
still there at +6.2 s; today gone; B could not be measured (it threw, see B16). X1 (Back to Expenses after 10 rows were
removed elsewhere): all three stand at 828 from the first frame, 0 px in 6 s, a 120 px drag moves 105 px.

**B12. My typing never lands in someone else's form, and a figure changed elsewhere lets go of that box only.** On a page
with two forms alike (Ana's and Bo's W-4) what I typed in one is never put in the other. If a box's saved figure was
changed elsewhere since I typed, that box shows the new figure, its typing is let go and said once ("Some of what you
typed in “...” was not put back: those figures were changed since."); the other boxes keep their typing.
Closes: none (guards; break K1, K5b).
J: D14 (Paycheck: 120 in Ana's health box, menu away and back, Save Ana's, Save Bo's): A and B: Bo's box empty, the
plan holds only Ana's 120. **D9 (Update my balances: three balances typed, the house's value saved elsewhere, Back),
twice: A shows 395,000 for the house and keeps the three typed balances with the cue; B keeps none of them and shows
"Not saved yet: what you typed in “Update my balances”. Open it again to finish it." over the open form, a promise
nothing can keep (the typing can never come back: B's form identity includes a hash of every drawn value).** Today: all
typing gone. Proposed rule **D-TWIN**.

**B13. "Undo my typing" puts back what the page showed.** Every box of that form goes back to the figure the page drew,
the words go, nothing is kept for it any more.
J: D5: A and B, the 1st quarter box back to its drawn "" after "Undo my typing".

**B14. My typing stays private and apart.** Typing is kept only in this browser tab (sessionStorage; not in the plan,
not on the PC, not in another tab), for a day at most, 20 KB a page at most. Boxes whose name, id, label, aria-label or
placeholder says key, token, password, passcode, passphrase, secret or PIN are never kept, nor anything on a System page.
The pretend plan (`?sandbox=1`) and the real plan keep separate memories.
J: D12 (Settings' "API key (for another service)" typed, menu away, Back): A and B: the box empty, the typed text in no
sessionStorage value. Node tests `secretText`, `neverKept`, `pruneTyping`.

**B15. What a save has used is not offered again as "not saved".** A tap that saved the plan and also took me to another
page (Import's "Import 10 transactions" goes on to Categorize) used its form's boxes and every box in no form: their
typing is let go, so the next visit does not show the imported file again as "Not saved yet".
Closes: none (guard; B's break critic should-fix 4).
J: **D15 (Import: paste a bank file, "Use the pasted text", "Import 10 transactions", later Import again by the menu),
twice: A puts the whole 870-character file back in the box with "Not saved yet" (inviting a second import); B and today
show an empty box.** The build takes B's rule (M7).

**B16. The shell never breaks a page.** No page error and no lost redraw from the shell on any page.
J: **R7 (Rules: add a rule "COFFEE"), twice: B throws `form.contains is not a function` 7 times while the person types
(the Rules form has a box named `contains`, which shadows the method) and the page does not redraw: the rule is saved but
not shown.** A and today: no error, the rule shown. The build never calls a method on a form element (M2 rule) and the
kit's all-pages walk counts page errors (S3, S9).

**B17. The "changed in two places" bar stays where I can see it.** A reload, a Back or a fresh conflict while the place is
being held never scrolls the bar away.
J: X2 (All pages left at 2,310, the bar already up when Back arrives): A and B: the page at 0, the bar at 56 px; today
the bar 2,254 px above the screen. A fresh conflict during a hold is B's `t12c` case: `showConflict()` cancels the hold
(M4).

**B18. My finger always wins.** A drag right after Back, even on a slow phone, goes where the finger takes it and stays
there.
J: X3 (ruth, Will the money last? at x4, a 400 px drag up 300 ms after Back): A and B follow the finger (1,607 to 1,222)
and stay; today the page had already lost the place (0).

**B19. Back closes what opened over the page before it leaves the page**, for things that ask for it: the menu (taps
track) and, page by page in wave 2, an edit form opened from a row. Wave 1 builds the one helper (`router.layer`,
`ctx.layer`) and its checks.
Closes: the Back part of j-debt-fixer/x-2, p-cashflow-a/CF-3 and the form part of j-fat-fingers/x-2 once pages adopt it
(section 3). Check: B's `t-layer` port (a layer opened then Back: the layer closes, address and scroll stay, no redraw;
`release()` steps off its entry; the next Back reaches the Dashboard).

**Touch rules.** Should turn green: D-BACK, D-TOP (stays green; `a[data-back]` and the note's links are checked as Back),
D-SCROLL-KEPT, D-FOCUS-KEPT, D-SEEN. Proposed to the touch-check track: **D-STILL** (within 1 s of a tap or Back the
page reaches the bottom edge or its real end is on screen, and nothing moves for 10 s without a touch), **D-WAYBACK**
(an on-screen way back does not grow `history.length`), **D-DRAFT** (typing comes back after leaving by the menu, by
Back, by reload, and after saving another form), **D-TWIN** (typing in one form never shows in another),
**D-NO-PHANTOM** (no "Not saved yet" on a page where nothing was typed; J: D11, A and B 0 on the Dashboard after Back,
Forward and the menu), **D-SAVED-GONE** (after a save that left the page, the next visit shows no "Not saved yet" for
what it used; J: D15).

---------------------------------------------------------------------------------------------------------------------

## 2. Mechanisms

Ten mechanisms in `core/place.js` (new: pure rules on top, DOM glue below), `core/router.js` (rewritten), small calls in
`core/app.js`, shell selectors in `core/ui/base.css`, and `data-back` in `modules/overview/guide/frame.js`. "[A]" is
design A's prototype as it stands (`$SP/w1/judge-place/A`, patch `$SP/w1/place/final-proto.patch`); "[B]" is borrowed
from design B (`$SP/w1/judge-place/B`, patch `$SP/w1/place2/final-proto.patch`); "[J]" is a change the measurements ask
for. Everything that touches `window`, `document` or storage is inside a function or a `try`, so both files import in
Node.

**One rule for all shell code [J]:** never call a method or read a property that a named control can shadow on a form
element (`form.contains`, `.submit`, `.reset`, `.elements`, `.action`, `.method`, `.id`, `.name`): use
`Node.prototype.contains.call(form, x)`, `HTMLFormElement.prototype.submit.call(form)`, `form.getAttribute(...)`. The
Rules page has a box named `contains` (B16).

### M1. Numbered history entries, a trail, ways back and layers: `core/router.js` [A, with B's visit id]
- Every entry gets `{ ...history.state, v, n }` (and `l` for a layer): `v` is this tab's visit id [B] (random, made once
  per tab, kept in sessionStorage), `n` the entry number. The state is always spread, so Get started's `suFrom` and a
  page's own state stay; a page that calls `replaceState(null, ...)` keeps its number (the router re-stamps it) [A].
- An arrival is `kindOf(first, n, cur)` [A]: a numbered state at the first draw is a **reload**; a smaller number
  **back**, a larger **forward**; a fresh number **new**. A state with another visit's `v` is a new visit [B].
- Trail in sessionStorage `planner.trail(.sandbox)`: entry number -> `{ h: address, p: entry before, via }`, 60 entries;
  a new entry drops the entries Forward can no longer reach (`place.forgetAfter`).
- API (the only history API; taps and pages call these): `parse`, `href`, `go`, `open(href, { via, replace })`,
  `entry()` -> `{ v, n, href, kind, first }`, `first()`, `at(n)` -> `{ href, p, via }`, `touch()`, `back(href)`,
  `layer(close)` -> `release()`, `layersOpen()`, `start(onChange)` with `onChange(route, entry)`.
- `layer(close)`: one more entry at the same address (`l: 1, 2 ...`), no hashchange, no redraw; Back runs the newest
  `close()`; `release()` steps off the entry when it is still on top; an `l` entry reached with nothing open (a reload, a
  Forward) is stepped off; every open layer is forgotten on an address change. A link tapped while a layer is open takes
  that entry's place (`location.replace`).
- `back(href)`: goes Back when the entry just behind shows that page (`sameEntry`: same page, every query key of the link
  equal except `from`; a `month` the entry lacks is the month that page showed by itself [B]), or further back along one
  "Next result" walk (every entry walked over opened with the same `from`), at most 10 steps; else returns false and the
  link is followed.
- `history.scrollRestoration = "manual"` (set in S3, used from S4).
- Pure, node-tested: `parse`, `hashOf`, `sameEntry`, `backSteps`, `kindOf`, `stampOf`.

### M2. The locator and a form's identity: `place.js` `keyOf()`, `locOf()`, `locate()`, `drawn()`, `fkOf()` [A]
- Key: `kind|TAG|words`, the words being label, aria-label, name and text with figures replaced by `#` and chevrons,
  arrows, `.pill`, `.fold-status`, badges dropped (`shape()`). A location adds its section (nearest heading or fold
  title), its index among same-key elements in that section, and its index on the page.
- `locate(root, loc)`: same key in the same section at the same index ("exact"), same key in the section, same key at the
  same page index while the count of same-key elements is unchanged ("order"), the only element with that key;
  otherwise nothing. Never a guess.
- `drawn(el)`: connected, has a layout box, not inside a shut `<details>` other than as its summary (Safari may report a
  zero box inside a shut section; the section itself is checked).
- A form's identity (`fkOf`): its title (legend, fold title, its card's heading or the nearest heading before it, figures
  shaped) § its section § its submit button's words § the keys of its boxes. **No values** (B's hash of drawn values is
  what stranded the typing in D9). Twins (same identity on one page) are given typing only at the same index while their
  count is unchanged (`pickForm`).
- A box's own name comes from its visible label before its `aria-label` [B] (pages rewrite `aria-label` as you type).

### M3. One place record per entry: `place.note()`, `leave()`, `recordOf()`, `forgetAfter()` [A, with B's guard]
- sessionStorage `planner.place(.sandbox)` with `fmt: 1` [B]: entry number -> `{ href, y, folds, tap, top, at }`, 60
  entries. `folds`: only sections the person opened or shut by tapping their summary, with how the page had drawn each.
  `tap`: what was tapped last (the control, then up to two drawn ancestors: its row, card heading or section; for a
  button of an edit form, the row that opened the form second). `top`: what was at the top of the screen, found by
  geometry over the page's own elements, never `elementFromPoint` (an open menu must not hide it) [B].
- Written 200 ms after the scroll stops, on `pagehide`, on `visibilitychange` to hidden, and when leaving (the old page is
  read before it is cleared); **only once the page on screen has finished drawing** [B]. Never per scroll event, never in
  `history.state` (Safari's 100 `replaceState` calls per 30 s).

### M4. Arriving by Back, Forward or Reload: `place.arrive()`, `place.afterArrive()` [A, with B's bar guard]
- `show(route, { entry })` for a new address: `place.leave(from)`, `forgetAfter(n - 1)` on a new entry, `visit(n, key)`,
  then `recordOf(n, location.href)`: **no record while `#sync-bar` is up** [A, B]; `showConflict()` calls
  `place.cancelHold()` before its own `scrollTo(0, 0)` [B]. Room: `#content` `min-height` = record's y + one screen, set
  and scrolled to before the page draws, so the first frame stands at the place (taps' one-frame paint-first wait comes
  after this line and paints at the place).
- After `render`: `afterArrive(root, rec)` puts back the folds (only where the page drew that fold as before), then the
  typing (M7), then holds the place (M5) with the first drawn element of the tap chain, else of the top chain, at its old
  screen top; else the record's y. Folds and typing are put back again when a late part of the page draws.
- A new entry: no record, `min-height` cleared, top of the page (B2); typing refilled and kept typing told (M7).

### M5. The hold: `place.hold(root, want, { pageWins })` [A]
- Stands at `min(want(), page end)` while the page finishes drawing (ResizeObserver and MutationObserver on `#content`).
- **Room is borrowed only while the page draws**: dropped as soon as the page reaches the place by itself, one frame
  after the draw when the page is not growing, or 600 ms after its last growth; never with a finger on the glass (it
  waits for the lift). B's rule (keep it until a scroll) left 382 px of grey on Withholding (R8).
- Anchoring stops at the first `pointerdown`, `touchstart`, wheel or key, at `planner:reveal`, at a new address
  (`routeSeq`), after 700 ms still at the place, or at 8 s; on the save path also at the page's own scroll call (M10).

### M6. The same page drawn again (after a save or a choice): `place.before()`, `place.afterSave()` [A]
- `before(root)` (before clearing): writes the typing down (M7), takes the folds the person set, the focused box and its
  selection when it is outside the form just submitted, and the tap chain (5 s) or the focused box. The submitted form
  is noted by a capture-phase `submit` listener and forgotten when its redraw is drawn, not after a clock [B].
- The page draws. Its own scroll calls, a `planner:reveal`, or the kit's `afterDraw()` saying it moved: the page wins.
- `afterSave(root, snap)`: folds back (the page wins where it now draws a fold differently: the one just saved stays
  open, design log 2026-09-16), typing back, focus and selection back (`preventScroll`), then: the tapped control, if
  drawn, at its screen top; if the page shut its section, that section's summary at the control's screen top; otherwise
  the next drawn element of the chain, never under the top bar; nothing found: nothing moves and the room goes one frame
  after the draw.
- Focus (forms N1): when the focused box went with its form, the shell focuses this save's fresh notice when it is
  readable (`tabindex="-1"`, `preventScroll`). Focus moves only in a redraw (forms N4).
- `ctx.redraw()`: the same keepScroll draw without writing the plan, so no page calls `store.update(() => {})` to
  redraw (6 views do today; wave 2).

### M7. Typing memory: `place.remember()`, `saved()`, `refill()`, `tell()`, `forget()` [A, with three B parts]
- **What is watched**: trusted `input`, `change`, `focusin`, `pointerdown` in capture phase on `#content`. A box's drawn
  value is taken at its first focus or tap; it counts only when its value differs from that.
- **Which boxes**: `input` (not hidden, file, password, submit, button, reset, image), `select`, `textarea`, not inside
  `[data-no-keep]`, never one whose name, id, aria-label, label or placeholder matches key, token, password, passcode,
  passphrase, secret or PIN as a word after camelCase is split; never on `#/system/*`.
- **Filed** [B `where` + A page key]: at its first keystroke a box records the page key it was typed on: the address
  without `from`, `guide`, `step`, `review`, `q`, `add`, `show`, `view`, `sandbox`; other query keys sorted (`month`
  stays). Saves file each box under that key, never under the address being opened. Stored in
  `planner.typing(.sandbox)` with `fmt: 1`, separate from the places [B]; per page: `forms` and `loose` (boxes in no form)
  with their locators, the drawn value `d` and the typed value `v`. A day at most, 20 KB a page (`pruneTyping`).
- **Written** 300 ms after typing stops, at once on `change`, on a tap that may swap the form away, when leaving, on
  `pagehide` and when hidden.
- **Each box on its own** (`boxVerdict(drawn, typed, now)`) [A]: `now === typed` "same" (the page put it back itself:
  Get started, People; no cue), `now === drawn` "fill", else "changed" (the saved figure moved: let go, said once).
- **Saved** (`saved(changed)`, from the store subscription with `planSig(before) !== planSig(after)`, the plan without
  `meta`) [A]: only when the plan really changed, within 1.5 s of the person's last act, inside that act's scope: the
  submitted form; a button's own form; for a button in no form its own card, section, `details` or fieldset.
  **Plus the save-and-leave rule [B `usedBy`]:** when the tap that saved the plan also changed the address (no newer
  touch, within 1.5 s), the typing of its own form and of every box in no form on that page is let go (Import, D15).
  A box that saves itself on `change` counts only inside its own change event.
- **Given back** (`refill`): after every draw and when a form appears. Values written quietly: `.value` (or `checked`),
  then `input` (and `change` for choices), never `reportValidity()` (forms N3). Shut sections holding a filled box are
  opened. "Not saved yet · Undo my typing" goes beside the form's buttons (`.place-hint`); a refilled box far from its
  button gets "Not saved yet" under it (`.place-cue`).
- **A typed form the page takes away** [B]: one `MutationObserver` on `#content` that ignores everything while the shell
  clears or draws (`place.busy()` / `place.idle()`, which calls `takeRecords()`) and before the page is drawn. A typed
  box the page removes (not by its own Cancel, not by its own submit) is kept under the page it was typed on. If the same
  form is drawn again in the same moment (a page redrawing its own section) the typing goes straight back, quietly.
  Otherwise (a stray tap opened another row's form) **the bottom note says at once** "Not saved yet: what you typed in
  “Edit Ana's salary”." with "Open it" (neutral `info` kind, no tick), and the line of B6 is drawn at that form's row.
- **Told** (`tell`, on arrival only): a record whose form is not on the page gets one line where it lives
  (`.notice.info.place-kept`: "Not saved yet: what you typed in “Add an income”." with **"Open it"** (presses the
  control that opened the form, recorded from the tap that made it appear) and **"Undo my typing"**), in the section of
  that control, else at the top of the page. **The bottom note repeats it only when the line is not readable once the
  place is restored and the screen is still** (`whenStill`: 200 ms without a scroll, at most 1.2 s) [J: A showed both
  in D1/E2]. A redraw of the same page (a month chip) keeps unseen typing silently.
- **Forgotten**: Save (above), Cancel (a "Cancel", "Close", "Never mind" or "Discard" button of that form), "Undo my
  typing" (every changed box back to its drawn value with `input`/`change`, then forgotten), a day.

### M8. Confirmations: `app.js echo()`, notices stay [A]
- Readable (`seenEnough(rect, topBar, bottom)`): 60% of the notice or 48 px between the top bar and the bottom edge, not
  in a shut section.
- The keepScroll branch collects this save's fresh `.notice.ok` / `.notice.error` (new text, or the same "Saved."
  again), decides one frame after the draw and again once a scroll the page made has stopped (150 ms quiet, at most 1
  s); it checks `renderSeq` before showing. None readable: the first is copied (`echo(text, kind, ways, near)`).
- Ways (at most two 44 px rows): the notice's own `.notice-action` (the kit's Undo), else its first link or button; and on
  a page opened from the check-in, the frame's `a[data-back]`. A link stays a link with its `data-back`; a button presses
  the page's own button while it is still there.
- **The whole note takes taps** (`pointer-events: auto`): a tap on its words removes it and reaches nothing below (L5).
- Placed at the bottom; when it would cover the tapped control (`place.tappedRect()`), just above that control, never
  under the top bar (`.save-echo.above`). With the keyboard up (`visualViewport` more than 80 px shorter), bottom =
  `innerHeight - (visualViewport.offsetTop + visualViewport.height) + 8 px`.
- Stays `echoStay(chars, ways, bad)` = 2 s + 55 ms a character (+2 s with a way), 4 to 10 s, at least 6 s for an error;
  removed on every address change and when its way back is tapped.
- **Notices stay**: every `.notice.ok` / `.notice.error` in `#content` gets a `remove()` that works only inside a trusted
  event (the person's own close or Undo) or when the node carries `data-moved`, `data-kit-moved` or `data-kit` (the form
  kit moved it). The ~95 page timers then do nothing; the next draw replaces the notice.

### M9. Ways back on the screen: `a[data-back]`, `ctx.back(href)` [A, B's link list]
- The guide frame marks its eight back links `data-back` [B], including "Back to quick answers" and "Back to your plan ›";
  no "‹" text heuristic.
- One bubble-phase listener on `document` (page handlers run first): `a[data-back][href^="#/"]` -> `router.back(href)`;
  when it went back, `preventDefault()` and the note goes. The same for the note's link and taps' named rows.
- `ctx.back(href)`: the same in code; there is no `goBack` / `cameFrom` beside it.

### M10. One wrapper of the scroll calls: `place.wrapScrolls()`, `addScrollHook()`, `busy()`, `scrolls()` [A]
- `window.scrollTo/scrollBy/scroll`, `Element.prototype.scrollTo/scrollBy/scroll/scrollIntoView` and
  `HTMLElement.prototype.focus` (without `preventScroll`) wrapped once; each forwards `this`, every argument and the
  return value. While the shell draws or a hold runs, a call counts as the page scrolling itself; on the save path it ends
  the hold. The shell's own scrolling uses `place.scrollTo`, never counted.
- `addScrollHook(fn)`: the taps track's reduced-motion change of `behavior: "smooth"`; never a second wrapper.
- `html { overflow-anchor: none }` in `base.css`: Chromium measures what Safari does.

**Footprint.** `show()` keeps only calls: `leave/visit/recordOf`, the room line, `afterArrive()` or `before()` +
`afterSave()`, the note decision; about +40 lines (the prototypes added ~55 inside `show()`). Budget for the build:
`place.js` at most 700 lines with comments (A's is 647 before the borrowed parts; the build drops A's `?place=off`,
`__placeLog`, `__place` and B's `__placeLast`), `router.js` at most 190.

---------------------------------------------------------------------------------------------------------------------

## 3. What a page must do (adoption list)

**Wave 1: 0 pages.** Every behavior B1 to B18 comes from the shell. Wave 2 (owners named so nothing falls between tracks;
claude-a's pages, marked *, only through the handoff file):

| # | page(s) | change | finding | owner |
|---|---|---|---|---|
| W1 | the 28 views whose row tap opens an edit form in place (grep `let editing` / `editing =` on ee09f6e): ai/notes; balance/assets, net-worth; career/equity; cashflow/budget, expenses, income; estate/digital, gifting, inheritance, legacy; goals/goals, travel*; household/calendar, contacts, documents, people; insurance/health, policies; investments/employer-stock, holdings; retirement/annuities, contributions, pensions; taxes/capital-gains; transactions/categories, ledger, rules. (balance/liabilities opens its form from the address and needs nothing.) | when the form opens: `const release = ctx.layer(() => { editing = null; ctx.redraw(); })`; `release()` on Save, Cancel and when another row opens. One to three lines a page. | j-debt-fixer/x-2, p-cashflow-a/CF-3, j-fat-fingers/x-2 (the Back part) | the wave-2 owner of each group (claude-g cash, goals, balance, household; claude-h investments, insurance, estate, taxes; claude-d transactions, ai, career; retirement: claude-b); goals/travel in claude-a's handoff |
| W2 | the 6 views that call `store.update(() => {})` only to redraw | `ctx.redraw()` | break S3 (a redraw is not a save) | same owners |
| W3 | balance/net-worth | lift `showForm` to module level so the open add form stays open after a save elsewhere (the typing is already kept: D10) | p-balance/x-1 (the open form) | claude-g |
| W4 | retirement/monte-carlo | after Runs changes: "Now using 10,000 pretend futures." beside it and the focus back on the Runs box (the section and the place are already kept: R9) | j-heavy-waiting/W4 (the words and focus) | claude-b (claude-e released the lane and listed W4 as waiting for wave 1) |
| W5 | retirement/roth-conversions | do not offer stop ages at or before the retirement age | p-retirement-b/RB1 (the Roth part) | claude-b |
| W6 | the 85 views outside claude-a's lane with `setTimeout(() => n.remove(), ...)` on a notice (95 views in all; claude-a's 10 keep theirs, covered by M8) | one scripted change deletes the timer lines, plus a `tools/check.mjs` rule against new ones | j-first-retiree/x-2, p-transactions-helpers/x-notice-jump (cleanup only) | claude-b, after S8 lands |
| W7 | rent-vs-buy, renovation | nothing for the place (M6 keeps a section the person opened open after a save); re-walk claude-g's "sections that shut after a save" with the build | claude-g's wave-1 note | claude-g re-walks |
| W8 | a box that must never be kept but whose words do not say so | `data-no-keep` on the box or its section (none known) | B14 guard | any owner |

Done on the branch, not to be redone: Get started keeps its own drafts (`planner.setup.drafts`); People keeps its open form
and draft; the projection's "saved" is seen (d1973e2). The shell stands aside by rule ("same" verdict, no cue): D13 and
B's `j09` show no false claim.

Conventions (written into `docs/CONVENTIONS.md` in S9): a way back on screen is `<a href data-back>` (or `ctx.back(href)`),
never `history.back()` by hand; a page that redraws its own open/close state calls `ctx.redraw()`; something opened over
the page that Back should close uses `ctx.layer(close)` and calls `release()`; `history.replaceState({ ...history.state,
... }, "", url)`; two forms on one page differ by their title; notices need no timer; pages do not build their own draft
or place keeping.

---------------------------------------------------------------------------------------------------------------------

## 4. Risks (what could be worse than today, and the check that catches it)

| # | risk | guard | check |
|---|---|---|---|
| R1 | Typing put into the wrong form or box | identity without values; twins by index with an unchanged count; per-box verdict; the same-moment path uses the same rule | D6, D14, `t-rowswap` (B's: change every box in row A, tap row B: 0 boxes of B differ, 2/2, 4/4, 3/3); node `pickForm`, `boxVerdict`; D-TWIN |
| R2 | The screen stands on blank room or jumps by itself | room only while drawing; drawn targets only; a shut section's summary stands for its control; never released under a finger | R8 (no `min-height` 1 s after Save, page fills the screen), X1, A's `hold.mjs`, `hold3.mjs`, `shorter-back.mjs`; D-STILL |
| R3 | The hold fights the person | stops at the first touch, wheel, key or mouse press | X3 at x4; B's `t7b` wheel |
| R4 | A new page opens part way down | `visit()` stops any hold; a new entry clears `min-height` | D-TOP; `j-back.mjs` `midAt` |
| R5 | Old typing confuses | a day at most, "Not saved yet" beside it, "Undo my typing" | D5; node `fresh`, `pruneTyping` |
| R6 | A redraw-only tap counted as a save, or a save letting go of typing far from it | plan must really change; scope never wider than one card | D8, D4, R5; node `planSig` |
| R7 | The save-and-leave rule lets go of typing the save did not read | only when one tap saved the plan and changed the address with no newer touch; only its own form and boxes in no form | D15; walk the five views that save and leave in one handler (balance/accounts, cashflow/recurring, overview/setup, transactions/import, transactions/statements): typing in another form survives |
| R8 | A secret kept | words filter after camelCase split, `#/system/*`, `type=password` never | D12; node `secretText` |
| R9 | The note covers a control or lets a tap through | the whole note takes taps; above the tapped control; 4 to 10 s; only when the line is not readable | L5; `tools/shot.mjs balance/update` light and dark with the note up |
| R10 | A way back goes to the wrong month or page | same page, equal query keys, the month rule, one-`from` walks | node `sameEntry`, `backSteps`; L1 to L4; a two-month check-in trip |
| R11 | A page that brings its answer into view is held instead | its scroll calls, `planner:reveal`, the kit's `afterDraw` end the hold | R4 |
| R12 | The wrapper breaks a page | forwards `this`, arguments, return value | node test on a stub; `node qa/smoke-all.mjs`; the all-pages walk's page-error count |
| R13 | **The shell reads a method a named control shadows** (B's Rules crash) | the M2 rule; a grep in S9 for `\b(form|f|el)\.(contains|submit|reset|elements)\(` in `core/place.js` and `core/app.js` | R7 journey: 0 page errors, the rule shown; the all-pages walk with typing in every form (S9) |
| R14 | The redraw replaces the box being typed in on a page that saves on change; the iPhone keyboard may drop | focus and caret put back; no redraw hold in wave 1 | D-FOCUS-KEPT; phone check 10; if it bites, the forms track's `ui.later` is the one wait rule |
| R15 | Records keyed by an old address after a page's `replaceState` | the router keeps the number for `null`; `touch()` moves the trail | A's `replace2.mjs` |
| R16 | sessionStorage full, blocked, or copied into a tab opened from a link | every read and write in `try`; separate keys; 20 KB cap; the visit id `v` | node tests with no `sessionStorage`; the single-file demo in a sandboxed frame (`qa/user-view.mjs`) |
| R17 | Old and new shell files mixed on the phone | `npm run skew` (pre-push `tools/main-gate.mjs`); `sw.js` keeps no file list | `npm run skew` |
| R18 | The note decided late shows on the next page | `renderSeq` check; removed on every address change | L4; a save followed at once by a menu tap: no note on the new page |
| R19 | A layer left open by a page that forgot `release()` | layers forgotten on an address change; a stale `l` entry stepped off | `t-layer` port |
| R20 | Cost on long pages | the observer reads removed subtrees only; locators measured on a few elements | E4 at x4 (Back on All pages: long tasks A 140 ms, B 106 ms, today 0; Will the money last?: 115 / 86 / 80): the build must stay under 150 ms on both |

---------------------------------------------------------------------------------------------------------------------

## 5. iPhone Safari (and the home-screen app)

- **No scroll anchoring** in Safari: `html { overflow-anchor: none }` makes Chromium behave the same; the hold is the only
  anchoring.
- **`scrollRestoration = "manual"`** (Safari 11+): Safari no longer restores at all, so the result does not depend on its
  timing. Hash entries never use the back-forward cache; Back always reaches `popstate`.
- **Edge swipe Back** (Safari tab only): Safari slides a picture of the previous entry, then fires `popstate`; the page
  scrolls to the record's y before it draws, so at most one frame differs.
- **History limits**: Safari throws after 100 `pushState`/`replaceState` calls in 30 s; the router calls `replaceState`
  once per new entry and `pushState` once per layer; places live in sessionStorage. A refused call leaves the entry
  unnumbered: a new visit, as today.
- **The home-screen app** has no Back button and no swipe: the on-screen ways back (B4, the note's way back) and the taps
  track's Back button carry it. When iOS ends the app in the background it starts at `./` with an empty sessionStorage:
  typing from before is gone (as today).
- **A tab Safari dropped** reloads at the same address; sessionStorage normally survives, so B3 applies (to see on the
  phone).
- **`pagehide` is unreliable when switching apps**: places are written 200 ms after the scroll stops and typing 300 ms
  after it stops; `visibilitychange` to hidden writes both.
- **Focus without a tap** does not raise the keyboard: after a save, the caret comes back, the keyboard may not (R14).
- **The note with the keyboard up**: a fixed note sits in the layout viewport and can be behind the keyboard; it is placed
  from `visualViewport` (M8). Not measurable in Chromium.
- **Shut sections** may report a zero box; `drawn()` checks the section itself.
- **Rubber-band overscroll** gives a negative or too large `scrollY`: the hold allows 1 to 2 px and stops at the first
  touch. **`pointerdown`** may fire as a scroll starts: it only ends a hold sooner.
- **Private browsing**: sessionStorage works (iOS 11+); every access guarded.

Phone checks for the owner (Safari first, then the home-screen app; always `?sandbox=1`; today first, then the build):
1. Will the money last?: scroll to the bottom, open a section, tap a link, swipe Back from the left edge: same spot,
   section open, no flash of the top, no grey under the page, nothing moves afterwards. Ten times. Then swipe forward.
2. The same, but tap the link before the page has finished drawing.
3. Income: "+ Add another income", type a name and an amount, menu, Dashboard, Back: the line "Not saved yet: what you
   typed in “Add an income”." with "Open it"; "Open it" shows your typing; the bottom note does not repeat the line.
4. Update my balances: type two balances, switch to the bank app for two minutes, come back; then lock the phone a
   minute and pull to reload: still there, "Not saved yet" beside the button.
5. Estimated payments: type a first-quarter payment, save last year's figures: still in its box; "Undo my typing" puts
   back what was there.
6. Update my balances: type a balance and tap Save with the keyboard still up: the note is above the keyboard and
   readable; a tap on its words closes it and does nothing under it.
7. From the monthly check-in: open a step, save, tap the note's "‹ Back to the ... check-in", then Back once: the
   Dashboard. In the home-screen app, only the on-screen links.
8. Income: open Ana's salary, change the amount, tap Bo's salary by mistake: Bo's form shows Bo's figures and a note says
   your typing for Ana is kept at once; Ana's row shows it again.
9. Withholding check: change a paycheck figure and Save: the section closes, its heading stays where Save was, no grey
   space under the page.
10. In a box that opens the keyboard, after a save elsewhere on the page: is the cursor still in your box, and is the
    keyboard still up?
11. Settings: type in "API key (for another service)", go to the Dashboard and back: the box is empty.
12. Import: paste a bank file and import it; open Import again later: the box is empty, no "Not saved yet".
13. With your computer holding a different copy of the plan (the "changed in two places" bar), reload half way down a
    page: the bar is on screen at the top.
14. Swipe back slowly and watch: does the picture during the swipe match the page that appears?

---------------------------------------------------------------------------------------------------------------------

## 6. Build steps (each small enough to verify alone; the same list as `plan-place-steps.json`)

Base: start from `$SP/w1/judge-place/A` (ee09f6e + `$SP/w1/place/final-proto.patch`, which applies cleanly to the tip);
port the B parts named in each step from `$SP/w1/judge-place/B` (`$SP/w1/place2/final-proto.patch`). Every step: `npm
test && npm run check`, `node tools/leak-guard.mjs --worktree`, one CHANGELOG line (with `Prompt: <id>` when it carries
out a prompt), and the judge's scripts named: copy `$SP/w1/judge-place/{lib,j-back,j-draft,j-save,j-recheck,j-extra,serve}.mjs`
to the builder's scratch and point `BASES` and `J` at the build worktree and a copy of ee09f6e for the "today" column.
Never `modules/registry.js` by hand, never `tests/golden/**`.

| step | files | what | checks |
|---|---|---|---|
| S1 | core/router.js, core/app.js (`router.start((route, entry) => show(route, { entry }))`, `ctx.layer`), tests/place.test.mjs | numbered entries with `v` and `n`, kinds, trail, `entry/first/at/touch/open(via)/layer/back`, the `replaceState` keeper, the month rule in `backSteps`; `scrollRestoration` still "auto" | node `sameEntry`, `backSteps` (one step, month rule, October is not November, a fresh tab is 0, the Next-result walk, a mixed trail), `kindOf`, `stampOf`; `tests/router.test.mjs` unchanged; Get started Back and Forward through its questions (`suFrom` kept); `t-layer` port; D-TOP |
| S2 | core/place.js (pure rules, locator, identity), tests/place.test.mjs | `shape`, `secretText`, `pageKeyOf`, `neverKept`, `boxVerdict`, `pickForm`, `seenEnough`, `echoStay`, `fresh`, `prune`, `pruneTyping`, `planSig`; `keyOf/locOf/locate/drawn/formTitle/fkOf`; the visible-label-first name | node tests (A's 12 plus `stampOf` and the visible-label rule); A's `twins.mjs` (alike forms only on career/salary) |
| S3 | core/place.js (wrapper), core/ui/base.css (`html { overflow-anchor: none }`), core/router.js (`scrollRestoration = "manual"`) | one wrapper of the scroll and focus calls; `addScrollHook`, `busy`, `scrolls`, `scrollTo` | node stub test (this, arguments, return value); `node qa/smoke-all.mjs`; all pages opened and stepped back for family and renterDebt: 0 page errors |
| S4 | core/place.js (records, hold, arrive, leave, visit, `afterArrive`), core/app.js (`show()` new-address calls, scroll/pagehide/visibility notes, `showConflict()` -> `cancelHold()`) | B1, B3 (place half), B17, B18; room only while drawing; records only once drawn | `j-back.mjs` x1 and x4 (13/13 Back, first frame, 0 moves, folds 4/4, Forward 12/13, reload 13/13); X1, X2, X3; B's `t12c` (fresh conflict during a hold); D-BACK, D-TOP, D-STILL |
| S5 | modules/overview/guide/frame.js (`data-back` on the eight links), core/app.js (document listener, `ctx.back`) | B4 | L1, L2, L3 (history, spot, then Back to the Dashboard); D-WAYBACK |
| S6 | core/place.js (`before`, `afterSave`, anchor, shut-section summary rule), core/app.js (keepScroll calls, `ctx.redraw`, N1 focus) | B9 | R1, R2, R3, R4 (page wins), R8 (no `min-height` 1 s after Save, no grey), R9, R10; D-SCROLL-KEPT, D-FOCUS-KEPT |
| S7 | core/place.js (typing memory: filing by `where`, identity, per-box verdict, refill, the observer with `busy/idle`, the stray-tap note, `tell` with "Open it" and "Undo my typing", save-and-leave, Cancel, secrets, caps, `fmt`), core/ui/base.css (`.place-*`), core/app.js (store subscription `planSig` + `saved`) | B5 to B8, B12 to B15 | `j-draft.mjs` D1 to D15 (all 15 hold; D9 3/3 kept with the house's new figure; D15 empty box); E1 (the note within 500 ms of the stray tap); E2 (one line, no repeated note while it is readable); R5; B's `t-rowswap`; R7 (0 page errors); D-DRAFT, D-TWIN, D-NO-PHANTOM, D-SAVED-GONE |
| S8 | core/app.js (`echo()`, the keepScroll decision), core/place.js (notices stay), core/ui/base.css (`.save-echo*`) | B10, B11 | R1, R2, R3, R8 (copy), L4 (both ways), L5 (the note takes the tap and closes), R6 (0 px under a resting thumb, notice kept), R7 ("Rule added." at +6.2 s); D-SEEN; `node tools/shot.mjs balance/update` light and dark with the note up |
| S9 | core/app.js, core/place.js, core/router.js, docs/CONVENTIONS.md, docs/PLAN.md, docs/TEAM.md, CHANGELOG.md | drop `?place=off`, `__placeLog`, `__place`, `__placeLast`; the grep of R13; the footprint budget; CONVENTIONS "What the shell keeps for you"; PLAN "Place and typing" with the choices of section 7; TEAM: `core/place.js` in the wave-1 claim | `npm run build`, `npm run skew`, `node qa/smoke-all.mjs`; every judge script once more on the build (all 34 behaviors of section 9, and the Back suite at x1 and x4); an all-pages walk typing one character in every visible box of the first form: 0 page errors; `node tools/shot.mjs` for the pages of section 5 |

Order: S1 first (taps builds its Back button and drawer on it), then S2, S3, S4, S5; S6 before S7 (S6's checks are only
moves, folds and focus); S8 after S5 (its way back needs `data-back`) and S7 (its kept-typing note); S9 last. Each step
from S4 on can be reverted alone.

---------------------------------------------------------------------------------------------------------------------

## 7. Design log, lanes and seams

**Owner decisions relied on** (`docs/DESIGN_LOG.md`; none undone):
- 2026-09-15: every save confirms with a green notice, errors are red and say what to do next, kept in a module-level
  `pending`. Unchanged; the shell only copies the notice where the eye is and keeps it on screen until the next act.
- 2026-09-15 (Net worth round 4): a page with data folds its add form behind "+ Add another ..."; "Cancel folds it". The
  page's own folding wins; Cancel still throws typing away; the kept line says where the typing is, with "Open it".
- 2026-09-16 (Social Security, finding 4): "the one just saved stays open". M6 keeps a section the person opened open
  after a save on every page, unless the page now draws it differently.
- 2026-11-06 (one path): "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the
  page's own buttons)". The note is not a bar: it shows only when a confirmation cannot be read, carries no Next, takes
  its own taps, sits above what was just tapped and above the keyboard, and leaves within 10 s. It covers the page's last
  row while it shows; said here so the owner can weigh it.
- 2026-11-06 (one path): Get started shows the eight tiles folded; a fresh visit draws folds as the page designs them.
- 2026-11-06 (user view): no build, PC, AI or sync words. New words on screen: "Not saved yet", "Undo my typing", "Open
  it", "Not saved yet: what you typed in “...”.", "Some of what you typed in “...” was not put back: those figures were
  changed since."
- 2026-11-06 review: the setup screens opened from Your plan lead back to it; B4 makes "‹ Back to your plan" a real step
  back along the whole Next-result walk.

**Choices made without the owner** (the conservative option each time; S9 lists them in `docs/PLAN.md`'s "Place and
typing" paragraph for the next design review; `docs/DESIGN_LOG.md` stays the owner's record and gets nothing):
1. Nothing asks before leaving a page with typing: the typing is kept instead.
2. Typing is kept in this tab only (sessionStorage), for a day, never in the plan or on the PC, never across a closed tab
   or a home-screen relaunch.
3. Only sections the person opened or shut are kept across a save; the page's own folding wins otherwise.
4. The note carries at most the notice's own action and the check-in way back; never a Next.
5. A save's green line stays until the next act instead of leaving after 4 s.
6. No kept pages: Back draws the page again and puts the place back (both designs measured the same without them).
7. "Undo my typing", not "Clear" (it puts back the saved figures) and not a bare "Undo" (the kit's, for a change to
   the plan, forms N6).
8. The kept line offers "Open it" and "Undo my typing"; B's "Throw it away" is not used (one name for one act).

**Lanes.** Files this track changes: `core/router.js`; `core/place.js` (new; add it to the wave-1 claim row in `docs/TEAM.md`);
`core/app.js` (`show()`, `echo()`, the `store.subscribe` callback, `boot()`, `showConflict()`'s `cancelHold()`, and
`ctx.back`, `ctx.layer`, `ctx.redraw` in `makeCtx()`); `core/ui/base.css` (shell selectors `html`, `.place-*`,
`.save-echo*`); `modules/overview/guide/frame.js` (`data-back` only); `tests/place.test.mjs`; `docs/CONVENTIONS.md`,
`docs/PLAN.md`, `docs/TEAM.md`, `CHANGELOG.md` (not `docs/DESIGN_LOG.md`). Not touched: `index.html`, `core/ui/dom.js`, any
`view.js` or `compute.js`, any claude-a page, `qa/` (the proposed rules go to the touch-check track).

**Who changes which function** (with the taps track and the forms track):

| file / function | place | taps | forms |
|---|---|---|---|
| `core/router.js` | all of it: numbers, visit id, trail, `layer`, `back`, `open(via)`, the `replaceState` keeper | uses `entry()`, `first()`, `at(n)`, `layer(close)`, `open(href, { via: "menu" })`; no `stampEntry()`, no `planner.firstEntry` | - |
| `core/place.js` | owns | `place.addScrollHook(fn)` for reduced motion | fires `planner:reveal`; marks moved notices `data-moved` |
| `app.js show()` | leave/visit/record and the room before the draw; `afterArrive` or `before` + `afterSave`; the note decision | the address correction first; the paint-first wait after place's room line; `landFocus()` and `updateBack()` after `afterArrive` | `ui.drawStart()` before render; `ui.afterDraw({ keepScroll })` between place's restore and anchor |
| `app.js echo()` | owns | `announce()` reads an "ok" notice only when no `.save-echo` showed | - |
| `app.js` store subscription | `planSig` + `place.saved()`; the 50 ms redraw unchanged | - | `ui.setStore(store)` |
| `app.js boot()` / `showConflict()` | `place.start`, the notes, the `a[data-back]` listener, the wrapper install, `cancelHold()` in `showConflict()` | drawer listeners, the tap guard | kit install |
| `app.js makeCtx()` | `ctx.back`, `ctx.layer`, `ctx.redraw` | no `goBack` / `cameFrom` | - |
| drawer functions | nothing | owns; `const release = router.layer(closeDrawer)`; rows carry `data-via="menu"` | - |
| `frame.js` | `data-back` on the eight links | named rows built with `data-back` | - |
| `base.css` | `html`, `.place-*`, `.save-echo*` | drawer, `#nav-back`, top bar | `.kit-*`, notice blocks |
| `core/ui/dom.js`, `index.html` | nothing | `#nav-back` (index.html) | `dom.js` |

**The order inside `show()`** (all three tracks edit it; this is the contract): (1) taps' address correction; (2) place:
`leave`, `cancelHold`, the note removed, `forgetAfter`, `visit`, `recordOf` (or, on a keepScroll draw, `before()`); (3)
shell cleanup and `replaceChildren()`, `place.busy()`; place sets the room and scrolls; (4) taps' paint-first wait (new
address only); (5) forms `ui.drawStart()`; the page renders; `place.idle()`; (6) place: `afterArrive()` or the restore
half of `afterSave()`; (7) forms `ui.afterDraw({ keepScroll })`; (8) place: the anchor only when the kit and the page did
not move it; (9) place: the note one frame later; (10) taps `landFocus()`, `updateBack()`.

**What each gives the others.** Place gives taps the entry numbers and trail, the layer API, `open(via)`, `data-via`,
`addScrollHook`, and a hold that never moves the page under a finger and draws nothing between `pointerdown` and `click`
(forms G4). Place gives forms: `planner:reveal` and `kitMoved` end the anchoring (G1, N2); `data-moved`, `data-kit-moved`,
`data-kit` notices are the kit's (G2); `.notice-action` is the note's first way (G3); quiet refill (N3), focus moved only
in a redraw (N4), N1 focus, "Undo my typing" (N6). Taps gives place: the drawer as a layer (j-fat-fingers/x-2's menu
part, j-navigator/N3), the Back button for the home-screen app, the double-tap guard. Forms gives place: `ui.reveal`,
`afterDraw`, the markers, and `ui.later` should R14 need it.

**Apply order.** Place S1 lands first (or taps lands the same router API from this plan: one numbering). Then the three
tracks in any order, provided the `show()` order holds; the integration check is the union of their kits: `j-back`,
`j-draft`, `j-save` (place), taps' `t1-dbl`, `m4-menu`, `m6-ways`, forms' `m-result`, `m-err`.

---------------------------------------------------------------------------------------------------------------------

## 8. Coverage (52 findings, on ee09f6e)

States: **W1** closed by wave 1 (the behavior named, measured by the judge's journey); **branch** already closed on the
branch for its main part, wave 1 keeps it closed; **W2** a part left with its owner (section 3); **taps** a part the
taps track closes on the router API.

SH-BACK (19)

| finding | state | measured by |
|---|---|---|
| j-first-family/x-1 | W1: B1 | j-back (family trips) |
| j-first-freelancer/x-2 | W1: B1 | j-back (freelancer, Side income) |
| j-first-retiree/x-1 | W1: B1 | j-back (ruth trips) |
| j-heavy-waiting/W1 | W1: B1 | j-back x4; A's `unmeasured` timeline-back |
| j-monthly-return/x-back-top | W1: B1, B4 | j-back; L1 |
| j-navigator/N1 | W1: B1 (Back, Forward), B3 (Reload), B4 ("‹ Back to your plan") | j-back reload column; L3 |
| p-career-household-system/F1 | W1: B1 | j-back (Settings trip, section kept) |
| p-cashflow-a/x-1 | W1: B1 | j-back; X1 (Expenses) |
| p-insurance-estate/IE-1 | W1: B1 | sweep D-BACK (insurance pages) |
| p-overview-home/OV-1 | W1: B1 (Forward too) | j-back (Your plan, All pages) |
| p-retirement-a/R-A2 | W1: B1 | j-back (Will the money last?, family and ruth) |
| p-retirement-b/x-2 | W1: B1 | j-back (How much to take out, Pensions) |
| p-retirement-c-scenarios/x-back-loses-place | W1: B1 | sweep D-BACK (scenarios pages) |
| p-taxes/x-1 | W1: B1 | j-back (Federal estimate) |
| j-first-renter/x-3 | W1: B1 | j-back (renterDebt trips) |
| j-monthly-return/x-backlink-history | W1: B4 | L1, L4 |
| j-one-answer/A5 | W1: B1, B4 | j-back; L2 |
| j-one-answer/x-4 | W1: B4 | L2 |
| p-overview-path/x-2 | W1: B1 | j-back (patLee's retirement guide) |

SH-DRAFT (21)

| finding | state | measured by |
|---|---|---|
| p-insurance-estate/x-1 | W1: B8 | D4 |
| p-taxes/T1 | W1: B5 (c), B8 (a, b, d, e) | D5, R5 |
| j-debt-fixer/x-2 | W1: B5 (the typing); W2: W1 row (Back closes the form) | D7 |
| j-fat-fingers/FF2 | W1: B5, B6 (leaving), B7 (the stray row) | D1, D6, E1 |
| j-first-family/F2 | branch: Get started's own drafts; W1 stands aside | D13 |
| j-monthly-return/x-typed-lost | W1: B5, B3, B8 (the month chip) | D2, D3, D8 |
| j-navigator/x-2 | W1: B5, B3 | D2, D3 |
| p-balance/B1 | W1: B5 | D2 |
| p-balance/x-1 | W1: B8 (the typing, accounts and Net worth); W2: W3 row (Net worth's form stays open) | R5-like accounts case in A's `m-redraw`; D10 |
| p-career-household-system/x-1 | branch: People keeps its open form and draft; W1: B8 for the rest of the page | A's `people-state.mjs`; D4 |
| p-cashflow-b-goals/x-3 | W1: B5, B6 | A's `unmeasured` goals-typing; D1 (same mechanism) |
| p-debt-property/x-3 | W1: B5, B6 (the typing); W2: the row 32 px under "Add" is page spacing (claude-g, T-TARGET) | D7 |
| p-insurance-estate/IE-9 | W1: B5 | D4 (same page family); A's `drafts.mjs` (Policies) |
| p-retirement-a/x-2 | W1: B5 | R1 (typing in the settings form); A's `drafts.mjs` (Pensions) |
| p-retirement-c-scenarios/x-half-typed-form-lost | W1: B5 | A's `drafts.mjs` (Advisor plan) |
| j-fat-fingers/x-2 | taps: the menu as a layer (j-navigator/N3); W2: W1 row (edit forms) | taps' `m4-menu` |
| p-career-household-system/F2 | W1: B5 | A's `drafts.mjs` (Contacts) |
| p-cashflow-a/CF-2 | W1: B5, B6 | D1 |
| p-cashflow-a/CF-3 | W1: B5 (the typing); W2: W1 row (Back closes the form) | D1, D6 |
| p-investments/INV-4 | W1: B5, B6 | A's `drafts.mjs` (Holdings); D10 (same mechanism) |
| j-first-renter/x-4 | branch: Get started's own drafts; W1 stands aside | D13 |

SH-REDRAW (12)

| finding | state | measured by |
|---|---|---|
| j-first-freelancer/x-1 | W1: B9 | R3, R9, R10 |
| j-monthly-return/MR-1 | W1: B10 | R2, L4 |
| j-one-answer/x-2 | branch: the section kept and "saved" drawn (d1973e2); W1: B9 (0 px), B10 (the copy) | R1 |
| j-debt-fixer/x-3 | branch: Credit cards keeps its section (claude-g); W1: B9 for Consolidation (claude-a's page, shell only), B10 | A's `m-redraw` cards-balance-transfer |
| j-first-retiree/x-2 | W1: B11; W2: W6 row (timer cleanup) | R6 |
| j-heavy-waiting/W4 | W1: B9 (the section and place); W2: W4 row (the words and focus) | R9 |
| p-balance/B2 | W1: B9, B10 | R2 |
| p-retirement-a/R-A4 | branch: as j-one-answer/x-2; W1: B9, B10 | R1 |
| p-retirement-b/RB1 | W1: B9 (sections), B10; W2: W5 row (Roth stop ages) | R3, R10 |
| p-retirement-b/x-1 | branch: the page brings its line into view (claude-e); W1: B11 guard, page wins | R4 |
| p-transactions-helpers/x-notice-jump | W1: B11; W2: W6 row (cleanup) | R7 |
| p-taxes/x-5 | W1: B10 (the seen rule) | node `seenEnough`; R8 (the copy shows) |

Totals: 52 findings. W1 closes all or part of 48; 4 are closed on the branch for their main part (j-first-family/F2,
j-first-renter/x-4, and the section part of j-one-answer/x-2 and p-retirement-a/R-A4), wave 1 keeping them closed; 9
have a W2 part with an owner (j-debt-fixer/x-2, p-cashflow-a/CF-3, j-fat-fingers/x-2, p-balance/x-1, p-debt-property/x-3,
j-first-retiree/x-2, j-heavy-waiting/W4, p-retirement-b/RB1, p-transactions-helpers/x-notice-jump) and one a taps part
(j-fat-fingers/x-2's menu). None is declined.

---------------------------------------------------------------------------------------------------------------------

## 9. Why this one

**What was run.** The same journeys on A, B and today, served side by side from the tip ee09f6e, at a person's pace (real
finger drags, taps at screen points, keys one at a time, Back waited on, each journey in a fresh browser, `?sandbox=1`):
13 long-page Back trips at CPU x1 and x4 on five households (`j-back.mjs`), 15 typing journeys on short forms
(`j-draft.mjs`, family, renterDebt, samMidSetup), 10 save journeys, 5 ways back and 3 hazards (`j-save.mjs`), the six
journeys where the designs parted run again with pictures and what each tap hit (`j-recheck.mjs`, `j-draft.mjs` second
run), and the stray-tap words, pictures and the cost of a Back at x4 (`j-extra.mjs`). Logs: `$SP/w1/judge-place/out`;
pictures: `$SP/w1/judge-place/shots`. One first measurement was mine and wrong (R6 in `j-save.mjs` ended the resting
thumb with a lift, which is a tap on whatever lay under it, a different row in A and B); `j-recheck.mjs` R6 replaces it.

**The Back suite: a tie.** (`out/back-{A,B,T}-{1,4}.log`)

| | today x1 | A x1 | B x1 | A x4 | B x4 |
|---|---|---|---|---|---|
| Back at the place | 6/13 | 13/13 | 13/13 | 13/13 | 13/13 |
| first frame already at the place | 6/13 | 13/13 | 13/13 | 13/13 | 13/13 |
| moved by itself > 10 px in the 4 s after Back | 0 | 0 | 0 | 0 | 0 |
| sections I opened, kept | 0/4 | 4/4 | 4/4 | 4/4 | 4/4 |
| Forward at the place | 8/13 | 12/13 | 12/13 | 12/13 | 12/13 |
| Back again | 9/13 | 13/13 | 13/13 | 13/13 | 13/13 |
| Reload at the place (and its sections) | 0/13 (0/4) | 13/13 (4/4) | 13/13 (4/4) | 13/13 (4/4) | 13/13 (4/4) |

(The two trips with 61 px under the content are How much to take out and the Life timeline at their real end, the same
in all three.)

**Everything else: 34 behaviors.** ✓ holds, ✗ fails; "(n)" = runs that agreed.

| journey | today | A | B |
|---|---|---|---|
| D1 Income add form, menu, Back | ✗ | ✓ "Open it" (line + a repeated note) | ✓ via "+ Add another income" (no way to open on the line) |
| D2 Update my balances, Continue, Back | ✗ | ✓ | ✓ |
| D3 Update my balances, reload | ✗ (top, saved figures) | ✓ 682 kept | ✓ 682 kept |
| D4 Health, save the other form | ✗ | ✓ | ✓ |
| D5 Estimated, save the other form, Undo my typing | ✗ | ✓ | ✓ |
| D6 Income stray row (Bo clean, Ana back) | ✗ | ✓ (2) | ✓ (2) |
| D7 renter's Store card, Back, Forward | ✗ | ✓ | ✓ |
| D8 check-in note across month chips | ✗ | ✓ | ✓ |
| D9 one figure changed elsewhere | ✗ | ✓ 3/3 kept, house 395,000 (2) | **✗ 0/3, a line promising "Open it again" over the open form (2)** |
| D10 Net worth add form, other save | ✗ | ✓ | ✓ |
| D11 no phantom words | ✓ | ✓ | ✓ |
| D12 API key never kept | ✓ | ✓ | ✓ |
| D13 Get started reload, no false claim | ✓ | ✓ | ✓ |
| D14 Paycheck twins | ✓ (typing lost) | ✓ | ✓ |
| D15 Import, then a new visit | ✓ | **✗ the 870-character file back as "Not saved yet" (2)** | ✓ (2) |
| R1 Retirement settings Save | ✗ +56 px | ✓ 0 px, open, copy | ✓ 0 px, open, copy |
| R2 Save all balances | ✗ +109 px | ✓ -1, copy with "See net worth ›" | ✓ the same |
| R3 Buckets years | ✗ shut | ✓ 0 px, open | ✓ 0 px, open |
| R4 Use this one (page wins) | ✓ | ✓ | ✓ |
| R5 Federal, two sections | ✗ typing gone, -2 sections | ✓ 98,000 kept, 0 px | ✓ the same |
| R6 Goals Save, thumb resting | ✗ 56 px at +4.1 s | ✓ 0 px, notice kept (2) | ✓ 0 px, notice kept (2) |
| R7 Rules: add a rule | ✗ "Rule added." gone at +6.2 s | ✓ kept, rows still (2) | **✗ 7 page errors, the rule not shown (2)** |
| R8 Withholding's first Save | ✗ 56 px jump at 5 s | ✓ heading where Save was, no room (2) | **✗ 382 px of grey, `min-height` held 5 s+ (2)** |
| R9 Runs on Chance the money lasts | ✗ section shut | ✓ | ✓ |
| R10 Stress tests "Now" | ✗ a section shut | ✓ | ✓ |
| L1 check-in step and back link | ✗ +2, Back into the step | ✓ | ✓ |
| L2 Quick answers back link | ✗ | ✓ | ✓ |
| L3 Your plan, Next result, back | ✗ top, +3 | ✓ 121 kept, +2 | ✓ the same |
| L4 the note's way back | ✗ no way | ✓ +0, Back to the Dashboard | ✓ the same |
| L5 a tap on the note's words | ✗ goes through | ✓ the note takes it and closes (2) | **✗ goes through to the page, the note stays (2)** |
| X1 Back to a shorter page | ✓ | ✓ | ✓ |
| X2 conflict bar on Back | ✗ bar 2,254 px above | ✓ bar at 56 | ✓ bar at 56 |
| X3 drag right after Back at x4 | ✗ place lost | ✓ follows the finger | ✓ follows the finger |
| E1 words on screen at a stray tap | ✗ | **✗ nothing on the screen for 3 s** | ✓ the note at once |
| **held** | **7 / 34** | **32 / 34** | **30 / 34** |

**Why a merge, and why A is the base.**
- **What a person sees.** A holds more (32 vs 30) and its two failures are narrower: the Import box (a page that saves and
  leaves in one tap; five views do that) and a silent stray tap. B's four failures include two on common pages that the
  owner uses monthly: Update my balances stranding typing behind a dead-end line (D9), and grey space after a save on any
  page that shuts the saved section (R8: Withholding, twice; B's own list of pages that fold a form away after
  the first save, goals/house, insurance/health, investments/fees, taxes/estimated, runs the same rule, not measured
  here). A's line also gives the next step as a button ("Open it"), which is the owner's
  first ask ("easy to know next step"); B's says "Open it again to finish it" without a way to do it (D1, D7, D10).
- **What can go wrong.** Each failure has a design-level cause, so the merge takes the rule, not a patch: B's identity
  hashes every drawn value (D9) -> A's identity without values and per-box verdict; B keeps borrowed room until a scroll
  (R8) -> A's "only while drawing, never under a finger"; B's note passes taps through (L5) -> A's note takes them; A's
  saved-scope misses save-and-leave (D15) -> B's `usedBy` rule; A's stray-tap words wait on a line drawn off screen (E1)
  -> B's same-moment observer path. B's Rules crash (R7) is a bug class, not a design choice (a named control shadows
  `form.contains`); the plan makes it a written rule and a check. Safari: both rely on the same standard parts
  (`scrollRestoration`, sessionStorage, `visualViewport`), so no difference; A's records written 200 ms after the scroll
  stops survive an iOS app switch better than B's "on leave and hidden only"; B's "write only once drawn" guard against
  `heal.js`'s reload is taken.
- **How many pages need an edit.** Equal: none in wave 1; the same wave-2 list (28 row-edit views adopt `ctx.layer`, two
  retirement follow-ups, the timer cleanup).
- **How much code the shell carries.** B is lighter: +887 -41 lines against +1,062 -48; `place.js` 479 lines / 32.5 KB
  against 647 / 45.9 KB; a Back on All pages at x4 costs 106 ms of long tasks against 140 (Will the money last?: 86
  against 115; today 0 and 80). The merge keeps A's mechanisms but takes B's footprint discipline: `show()` holds only
  calls (`afterArrive`, `afterSave`), the measuring switches go, and S9 holds the build to `place.js` <= 700 lines and
  < 150 ms of long tasks on those Backs. The borrowed B parts are small (the save-and-leave rule, the observer's busy/idle,
  `where`, `cancelHold`, the visit id, separate keys), so the merged shell is about A's size, not A's plus B's.
