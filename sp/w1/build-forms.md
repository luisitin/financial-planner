# Build log: wave 1, track "forms" (builder claude-b)

Base ee09f6e, worktree `$SP/w1/build-forms` (detached), plan `$SP/w1/plan-forms.md` + `plan-forms-steps.json`, seams
`$SP/w1/seams.md` (seams win). `$SP` = `$SP`.
Nothing committed. Patch: `$SP/w1/patch-forms.diff` (`git diff --cached --binary ee09f6e`, everything); for the
integrator, also split as seams section 4 asks: `$SP/w1/patch-forms-code.diff` (`-- . ':!CHANGELOG.md' ':!docs'`) and
`$SP/w1/patch-forms-docs.diff` (CHANGELOG line + CONVENTIONS section, for step 4 "docs").

Servers (mine only, `$SP/w1/bf/serve.mjs`): 9431 = the build tree, 9432 = a copy of ee09f6e (`$SP/w1/bf/tip`), both with
the sandbox. Stopped at the end by touching `$SP/w1/bf/stop`.

Measuring kit: the judge's journeys (`$SP/w1/judge-forms/scripts/journeys.mjs`) repointed in `$SP/w1/bf/jlib.mjs` /
`journeys.mjs` (PORT and ROOT only), outputs in `$SP/w1/bf/out/j-{build,tip}-*.json` and `f3..f7-{build,tip}.log`.
Pictures in `$SP/w1/bf/shots/`. Node "fails before" copies in `$SP/w1/bf/before-tests/`.

## Files

| file | what |
|---|---|
| `core/ui/checks.js` (new, 119 lines, pure) | `FLOOR_DATE`, `CEILING`, `readNumber`, `numberText`, `boxWords`, `validityWords`, `summaryWords`, `holdsSomething`, `keyText`, `sameRowIndex`, `keyHint` |
| `core/ui/undo.js` (new, 93 lines, pure) | `changesOf`, `takeBack` (what a store.update changed; put back only what was not changed again since) |
| `core/ui/dom.js` (143 -> 615 lines) | the kit: words at the box, silent checkValidity, finger-down hold, leaving words, `steady`, submit wrapper and refusals above the buttons, count line, kit-read number/percent/money boxes, date floor and today, tel/email, Return walk, keyboard open and Cancel back to the row, `openUnder`, `reveal` + `planner:reveal`, `undoable`, `notice(kind, text, { undo, undone, action })`, `undoneWords`, `fieldError`, `numberBox`, `spanOf`, `wordsFor`; second session: the optional-box fold (`more: true`, `moreLabel`, `moreOpen`), the row brought back on a Save under a row, words that follow the typing, words said aloud after a box is left, `min`/`max` written on kit boxes |
| `core/ui/base.css` (+19, seams regions only) | after line 179: `.field-error`, red edge on `[aria-invalid=true]`, `scroll-margin-top`, `.form-error`, `.unit-in`, `.form-more`, `.rec-form`, `.notice .notice-actions`; end of file: one reduced-motion line. Line 129 and 117-129 untouched. |
| `tools/check.mjs` (+5) | checks.js and undo.js must stay pure (no DOM, no timers) |
| `tests/ui-checks.test.mjs` (new, 11 tests) | every pure function, the plain-words guard over checks.js and dom.js sentences, one fake-DOM ui.form read ("1,200", "2.555", "11,200", the range written on the box), `holdsSomething`, one fake-DOM ui.form with `more: true` boxes |
| `tests/ui-undo.test.mjs` (new, 12 tests) | changesOf / takeBack, undoable / undoneWords with a fake store, one fake-DOM notice with Undo |
| `docs/CONVENTIONS.md` | input-schema lines (`missing`, `whole`, `more`, `tel`, `email`) + section "Forms: asking, checking, answering" |
| `CHANGELOG.md` | one line under Unreleased, "- [builder:claude-b] Forms speak in plain words at the box ..." |

Not touched (checked with `git diff --stat ee09f6e`): `core/app.js`, `core/router.js`, `core/search.js`, `index.html`,
`frame.js`, any `modules/**` file, `modules/registry.js` (regenerated: identical), `tests/golden/**`, `qa/**`,
`docs/DESIGN_LOG.md`, `docs/TEAM.md`, `docs/WORKBOARD.md`, `docs/PLAN.md`.

## Steps

Every step: node test first (seen failing against the tip copy in `$SP/w1/bf/before-tests`, then passing), the change,
`npm run registry && npm test`, `npm run check`, `node tools/leak-guard.mjs --worktree`; journeys against 9431 and 9432;
pictures read at 390 px.

### F1 core/ui/checks.js + tests/ui-checks.test.mjs + tools/check.mjs purity
- Files: `core/ui/checks.js`, `tests/ui-checks.test.mjs`, `tools/check.mjs`.
- Before: `node --test tests/ui-checks.test.mjs` on the tip copy: cannot import `../core/ui/checks.js` (fail). After: pass.
- Plain-words guard: 40 sentences found in checks.js + dom.js (>= 20 asked), none with builder words. First run flagged
  template code (`r.value`); the guard now replaces `${...}` with "#" before reading a sentence.
- check.mjs: a test edit putting `setTimeout` into checks.js was refused ("must stay pure"), reverted.

### F2 core/ui/undo.js + tests/ui-undo.test.mjs
- The test file imports `undoable` from dom.js, which F8 adds: at F2 the dom part lived in `$SP/w1/undo-dom-part.mjs`
  (7 pure tests ran: fail before, pass after), re-appended at F8 (12 tests).
- Source noted in both headers (the forms2 design in this repo, MIT).

### F3 the engine (invalid listener, silent checkValidity, hold, leaving words, steady, fieldError, base.css lines)
- Journeys (`out/f3-*.log`): J1 goals empty: tip bubbles ["Please fill out this field." x2], build bubbles [], focus on
  "What are you saving for" with aria-invalid and "Fill this in first." under it, label shown. J2 income 150: build words
  under the raise after tapping Starts, Starts moved 0 px. J9 payoff "50..": nothing red while typing, words after Order,
  Order moved 0. J10 update "abc", J11 vehicles name only, J12 employer stock "acme!!": words at the box, no bubble.
- Seen (`k-income-150*.png`, light and dark): red edge, words in bold red under the box, help line under the words.

### F4 boxes (numberBox, readForm with readNumber, ceiling, date floor and today, tel/email, missing, .unit-in)
- J2b: "5%" stays "5%" with the "%" drawn inside the box (tip: "5", no sign); "1,200" and "2.555" saved as 1200 and
  0.02555. J11: "11,200" miles shown as typed and saved as 11200 (tip: "11200").
- R4 grep (who reads `form.elements[x].value` as a number): only investments/allocation's live tally
  (`Number(form.elements[c].value)`), so a typed "60%" counts 0 there until the box is left; tax-lots reads after the
  kit's change listener; crypto builds its own `type=number` box (unchanged). Logged as a follow-up, no page touched.
- R5 (1,400 household plans in qa/, read as text, nothing regenerated): 28 deliberate trillion/billion "twist" figures
  would be held by the ceiling (intended); no date before 1900.

### F5 the submit wrapper (800 ms, refusals above the buttons, count line, resetAfter)
- J3 property/home "2099" twice: Save 751 -> 751 -> 751, one red line right above Save, still there 7 s later. J13
  contributions: Add 662 -> 662 (tip 662 -> 749). J14 advisor empty Compare: count line.
- Seen (`k-goals-count*.png`): "2 boxes need a fix: What are you saving for; Amount needed." right above Add goal.
- Fix during the step: the count line anchored on the buttons after a tap pushed the focused box up; `formError` takes
  `{ keepBox }` and the count line keeps the box with the cursor still.

### F6 Return (kit forms and boxes in no form)
- J4a contacts: Return walks name -> phone -> email -> ... and saves only from the last; J4b gifting: to -> amount ->
  year -> notes, 0 gifts saved early (tip: 1 saved from "To whom"); J4c net worth Return twice 300 ms apart: 1 account.
- Capital gains (box in no form, step 1000): "1250" + Return gives words, not a silent round.

### F7 click note, keyboard open, Cancel back to the row, openUnder
- J5a Enter on "+ Add another income": cursor in "What is it" (tip: nothing). J5b touch open: no cursor, no keyboard.
  J5c Enter on a "+$25,000" chip: no scroll, focus stays on the chip.
- J6a expenses Groceries -> Cancel: the row back on screen (row at 408 px), focus on its Edit; J6b income; J6d contacts
  (page redraws itself): focus on Edit of the same row via `data-key` / same row index.
- Keyboard open is told by `isTrusted && detail === 0` on the click (a synthetic click from a page is not a key).

### F8 reveal, planner:reveal, notice with Undo, role=alert once per visit, undoable, undoneWords, CSS
- Node: 12 undo tests; notice test: one "Undo" button in `.notice-actions`, outlined, the click undoes; a plain notice
  has none.
- Throwaway copies (not in the patch): `$SP/w1/accept-forms/pages/{net-worth,withdrawal-strategy,rent-vs-buy}.view.js`,
  served in place of the page's view.js by Playwright `page.route` only when the served view.js lacks the marker.
- Seen (`k-undo*.png`): green line "Your plan now spends $6,600 a month ... (it was $7,000)." with a 44 px outlined Undo
  on its own line, right under the answer card; dark mode reads well. `k-under*.png`: Edit on Ally savings opens
  "Edit Ally savings" right under that row in the list.

### F9 (docs part only, see Deviations)
- `docs/CONVENTIONS.md` section "Forms: asking, checking, answering" + input-schema lines; CHANGELOG line.

### F10 (second session, 2026-11-12): what the acceptance run and the owner's new ask added
Picked up from the first session's worktree (F1 to F8 done, the docs half of F9 written, B1 to B15 scripts written,
nothing run to the end). Servers started again (`bf/serve.mjs`: 9431 the build, 9432 the tip copy).
- **B9 did not hold on the forms build alone** (`B9-save-row`: after Save in a row's form the row sat at -81..30 px, under
  the top bar; the first session had left that half to the place track). Fixed in the kit, no page code: `openUnder`
  remembers its row (`UNDER`), and a `ui.form` inside a `.rec-form` holder that goes through brings that row on screen
  (`reveal(row, { block: "nearest" })`) in the tap's own task, 50 ms before the shell's redraw (seams C1: a reveal in
  the act's own task wins over the place track's anchor). Seen (`shots/m-under-saved.png`): the row "Ally savings
  $9,100" just under the top bar, "Ally savings saved." on the same screen. B9: 5 of 5 (row at 64-175 px).
- **The owner's ask of 2026-11-12** ("be aggressive with optionality ... default to less is more and allow more
  complexity or toggles ... subtle optional complexity"), for this track: the plan's listed follow-up "a kit-wide
  `more: true` fold" (claude-g asked for it twice on WORKBOARD) is built now, as the reviewed Goals fold made one
  word for any page. `more: true` on a field puts its box under one line "More details (optional)" right above the
  buttons (`opts.moreLabel`, `opts.moreOpen`). Closed on a first visit; opens in place; opens by itself when one of
  its boxes holds something (`holdsSomething`, pure: a typed box not blank, an amount / number / percent not 0, a choice
  not the list's first, a tick box never), when one of them is held at Save (words at the box, cursor in it), and when
  the person opened this form's line earlier on this visit (kept in memory only, per page + line + button words; shut
  by hand: shut from then on). A `required` box ignores `more`. Return walks only the boxes on screen. No page is
  changed: nothing folds until a page marks a field (an old kit on the phone simply shows every box, so no skew risk).
  - Node tests first: `holdsSomething` and the fake-DOM fold test failed before (no export; no `.form-more`), pass after.
  - Seen at 390 px, light and dark (`shots/m-more-closed.png`, `m-more-open.png`, `m-more-held.png`, `*-dark.png`), on a
    throwaway copy of Income with Yearly raise, Starts and Ends marked (`accept-forms/pages/income.view.js`, never in the
    patch): the add form is 593 px tall instead of 920, Add income is on the first screen under the six boxes every
    income needs; the line is the app's own fold look (44 px, chevron turns); a raise of 150 typed, the line shut by
    hand, Add tapped: the line opens, "Use a number from 0% to 100%." under the box, cursor in it.
  - First rule tried and dropped: a tick box that is ticked, and a 0, counted as "holds something": Income's add form
    starts with "Income tax applies to it" ticked and every saved income stores a raise of 0, so the line would have
    opened on every add and every edit. Now: a tick box never opens it by itself, 0 is nothing.
- **Words that stay true while typing** (found reading the engine): a box whose words say "Use a number from 0% to
  100%." and is then typed into "150o" kept the old words until it was left. Now the words under a box that is still
  wrong follow what is typed ("Type a number, like 3.5 for 3.5%."); a box emptied on the way to retyping says nothing
  new. B2-words-follow.
- **A try that marks no box clears the page's words from the try before** (found reading the submit wrapper): the
  wrapper took any `[aria-invalid]` box in the form as "this try was refused", so a page's `ui.fieldError` on box B
  put right by changing box A left the words under B, skipped `resetAfter` and never started the 800 ms guard. Now
  the wrapper counts the words drawn during this try (`errSeq`), and a try that goes through takes the page's old
  words away with the buttons kept still. B3-fieldError-other-box (a form built by the served kit inside Goals: no
  page calls `ui.fieldError` yet).
- **Words drawn after a box is left are said aloud** (`role="alert"` on that `.field-error`, taken off when the cursor
  comes back to the box): a screen-reader user who has moved on would otherwise never hear them; at Save the box has
  the cursor and the words are its description, not said twice. B13-left-box.
- **A kit box carries its range**: number, percent and money boxes write `min` / `max` as attributes (a text box does
  not check them; the kit does), so tools and tests can read the range (the touch sweep typed " 300 " into a 0-15%
  box and called the kit's true words a break).
- **I10** once more over dom.js: `formId` asked `closest(...)`'s result for `.querySelector` (the form itself when a
  page gives its form the class `card`); now through the prototype, and `.card:not(form)`.
- **Acceptance scripts**: B15 rewritten (it skipped 6 of its 8 pages: their Remove is inside the form a row opens; now 6
  pages are driven to a named row's Remove, one "yes" is followed to the green line, and a page's own on-screen
  question counts: People's "Remove Cy from the plan?"); B16 new (the fold, 10 checks); B2 +1, B3 +3, B13 +1.

## Final checks (on the finished worktree)
- `npm run registry`: 161 modules; `modules/registry.js` unchanged (`git status` after it lists only this patch's files).
- `npm test` on the finished tree: **189,321 tests: 188,677 pass, 2 fail, 3 skipped, 639 todo.** The two are speed
  tests, run while the machine's load average was 13 to 25 on 4 cores (other sessions' sweeps): `tests/estimate-perf.test.mjs`
  "settle ... 200 times in under 600 ms" and `modules/transactions/ledger/module.test.mjs` "verify 5, C ... well under
  1.5 s" (37 months took 2,524 ms). Each rerun alone: 2 of 2 and 37 of 37 pass. A full run earlier in the session:
  188,678 pass, 1 fail (the settle speed test). Logs: `bf/out/npm-test-final3.log`, `npm-test-final2.log`.
- The kit's own: `node --test tests/ui-checks.test.mjs tests/ui-undo.test.mjs`: 23 of 23 (11 + 12).
- `npm run check`: OK. `node tools/leak-guard.mjs --worktree`: OK, 2,874 files.
- **The patch applies**: `git apply --check` on a plain copy of ee09f6e (`bf/tip`) for `patch-forms.diff`,
  `patch-forms-code.diff` and `patch-forms-docs.diff`. On top of `patch-taps.diff`, forms' two base.css hunks apply
  (`bf/overlap`); the CHANGELOG line meets taps' line at the same place (both insert under "## Unreleased": the
  integrator's docs step, or `--3way`).
- **All-pages walk** (seams section 4; `bf/walk-all.mjs`, family, phone, touch): 157 pages, 57 forms (53 pages have
  one; Rules and Goals among them), 296 boxes typed in, 56 taps on Save or Add: **0 page errors, 0 browser bubbles**.
- **Cost per tap** (R10; `bf/cost.mjs`, 40 clicks on a row of a 1,000-line ledger): tip 5.0 / 8.3 / 12.7 ms, build 3.7 /
  4.2 / 9.8 ms over three runs at load 10 to 25: nothing above the noise (the judge's quiet figures: 2.46 and 2.51 ms).
- **Pictures read at 390 px** (`bf/shots/`, light and dark): `k-income-150` (red edge, bold red words under the box, help
  line under them), `k-goals-count` ("2 boxes need a fix: What are you saving for; Amount needed." right above Add goal),
  `k-undo` (green line under the answer card, outlined Undo on its own line; dark reads well), `k-under` and
  `m-under-saved` (the form under its row; after Save the row with its new balance and the green line on one screen),
  `m-more-closed`, `m-more-open`, `m-more-held` (the optional line shut, open, and opened by a wrong box).
- Not committed. `git add -A` only (the task's patch step). Servers stopped (`bf/stop`).

## Acceptance (`$SP/w1/accept-forms/B1..B16.mjs <base> <root>`, exit 0 = holds)
Run on the finished build (9431) and on a copy of ee09f6e (9432), one after another, phone 390 x 844 (B10 also
390 x 664), touch at a control's centre after real finger drags, keys at 70 ms, about 450 ms between actions; keyboard
journeys with touch off. Outputs: `bf/accept-final/B<n>.txt`, `bf/accept-tip2/B<n>.txt`.

| script | behavior | forms build | ee09f6e |
|---|---|---|---|
| B1 | errors at the box | exit 0: 10 of 10 | exit 1: 3 of 10 |
| B2 | leaving a box | exit 0: 8 of 8 | exit 1: 4 of 8 |
| B3 | the page's refusal at the thumb | exit 0: 9 of 9 | exit 1: 3 of 10 |
| B4 | every form speaks the same way | exit 0: 5 of 5 | exit 1: 0 of 5 |
| B5 | figures as typed | exit 0: 8 of 8 | exit 1: 1 of 8 |
| B6 | Return walks the boxes | exit 0: 4 of 4 | exit 1: 0 of 4 |
| B7 | a keyboard open | exit 0: 3 of 3 | exit 1: 2 of 3 |
| B8 | Cancel goes back to the row | exit 0: 4 of 4 | exit 1: 1 of 4 |
| B9 | a row's form under the row | exit 0: 5 of 5 | exit 1: 0 of 2 |
| B10 | Undo after a one-tap change | exit 0: 6 of 6 | exit 1: 0 of 4 |
| B11 | the answer on screen | exit 0: 3 of 3 | exit 1: 0 of 1 |
| B12 | nothing moves under a finger | exit 0: 2 of 2 | exit 1: 0 of 2 |
| B13 | read with the box | exit 0: 5 of 5 | exit 1: 0 of 5 |
| B14 | the right keyboard | exit 0: 2 of 2 | exit 1: 1 of 2 |
| B15 | every Remove asks first | exit 0: 7 of 7 | exit 0: 7 of 7 |
| B16 | a long form opens short | exit 0: 11 of 11 | exit 1: 0 of 3 |

92 checks hold on the build. On the tip only B15 holds (the rule is already closed on the branch, taxes/documents
aside). B9, B10, B11 and B16 say in their first line which page they drive: the served page when it already calls the
kit (`ui.openUnder`, `ui.undoable`, `ui.reveal`, `more: true`), else the adopted copy in `accept-forms/pages/` (today:
always the copy). B3's `ui.fieldError` checks and B14-kit and B16-every-box build a form with the served kit inside the
running app (no page calls those yet). On the combined build: B9-save-row no longer needs the place track; B2's "Starts
moved 1 px" is half a CSS pixel of rounding at 2x (the script allows 1).

## Touch sweep (qa/touch-sweep.mjs, 8 pages x family, renter; rules D-WRONG, D-KIND, D-ENTER, D-TWICE, T-KEYBOARD, T-CANCEL, D-FOCUS-KEPT, D-SCROLL-KEPT)
`qa/touch-sweep.mjs` from `$SP/wtouch` (c385e41 plus the sweep's staged files), 8 pages (goals/goals, cashflow/income,
household/contacts, estate/gifting, balance/net-worth, property/home, property/vehicles, debt/payoff) x family, renter,
2 browsers, logs in `bf/sweep/`:

| rule | checked (build) | breaks ee09f6e (`tip-2`) | breaks build mid-session (`build-2`) | breaks finished build (`build-final`) |
|---|---|---|---|---|
| T-KEYBOARD | 312 | 0 | 0 | 0 |
| T-CANCEL | 18 | 0 | 0 | 0 |
| D-FOCUS-KEPT | 158 | 0 | 0 | 0 |
| D-SCROLL-KEPT | 105 | 0 | 0 | 0 |
| D-ENTER | 133 | 2 (debt/payoff: Enter does nothing) | 0 | 0 |
| D-TWICE | 28 | 9 (two taps made two rows: vehicles 3, net-worth 2, income 2, ...) | 0 | 0 |
| D-WRONG | 233 | 2 (debt/payoff "abc": no words) | 2 (the same two) | 0 |
| D-KIND | 168 | 0 | 1 (property/home) | 0 |
| **all** | | **13** | 3 | **0** |

The three mid-session breaks were the rule's reading, not the screen: the words were under the box (B2, B4), but the
sweep reads only `invalid` events, notices and `role="alert"` (now the words drawn after a box is left carry it); and
it typed " 300 " into "Selling costs, as a share of the price", a 0 to 15% box whose range it could not read (now on
the box as `min` / `max`), so the kit's true "Use a number from 0% to 15%." counted as a refusal. Both are in the
handoff to the sweep's owner.

## Deviations and why
1. **F9's other docs are not written here** (seams section 4 and C17 win over the plan): no `docs/DESIGN_LOG.md` entry
   (the owner's record), no TEAM claim row, no WORKBOARD message, no `docs/PLAN.md` section; the integrator writes them
   after the three code patches. This patch carries only the CHANGELOG line and the CONVENTIONS section the task asks
   for; the split patches (`patch-forms-code.diff`, `patch-forms-docs.diff`) let the integrator land code first. The
   forms list for PLAN.md's "Wave 1: choices made without the owner" is under Handoffs below.
2. **A1 to A6 are not built** (plan section 6 and seams section 5: only after the kit is on `main`, each its own commit
   and claim row; net-worth, social-security and home wait for claude-c). B9, B10, B11 and B16 run on throwaway page
   copies in `accept-forms/pages/` (served by Playwright only when the served page lacks the kit call), never in the patch.
3. **The `more: true` fold is built now** (the plan lists it under "small follow-ups, not wave 1's to build"): the owner's
   request that started this run asks for optional complexity, simple first. Kit only; no page marks a field yet. With
   it, `ui.setMoreOpen(true)`: one switch that opens every such line, for a device setting ("show every box") the shell
   can add later; nothing calls it yet.
4. **A Save inside `ui.openUnder`'s holder brings the row on screen** (plan M7: "Save brings nothing back by itself").
   M7 still holds for every ordinary form. Under a row the kit knows the row for sure and it is still on the page when
   the Save goes through, and B9 says "Save and Cancel leave me at the row"; without it B9 failed on the forms build
   alone and leaned on the place track.
5. **Three small engine changes beyond the plan**, each found while re-reading the kit against the behaviors: words under a
   still-wrong box follow the typing; a try that marks no box clears a page's words from the try before (and resets and
   starts the 800 ms guard as a save should); words drawn after a box is left are `role="alert"` until the cursor
   returns. And kit boxes write `min` / `max` as attributes for tools.
6. **Keyboard open is `isTrusted && detail === 0`** (seam I9), not the plan's `detail === 0`. **No form element is asked
   for a property or method by name** (seam I10): the reference kit's eight places go through the prototypes. **The
   evidence switch `?forms=off` is stripped** (`ON` is `DOC`).
7. **base.css**: the reduced-motion rule is its own rule at the end of the file (seams 1.5), not on line 129; the notice
   rule sits in the forms block after line 179, not after 121.
8. **Counts**: `tests/ui-undo.test.mjs` has 12 tests (plan: 11), `tests/ui-checks.test.mjs` 11; dom.js is 615 lines
   (plan: about 505) with the fold, the row save and the comments.
9. **B14 on Contacts**: the page's own Email box is `type=text` with `inputmode=email` (wave 2 closed F7 that way); the
   script takes either `type` or `inputmode`; the kit's `type: "email"` gives a real email box (B14-kit).
10. **The touch sweep is not on the branch**: it was run from `$SP/wtouch` (worktree at c385e41 with the sweep's files
    staged, not committed), copied over a copy of each tree (`bf/sweep/tip`, `bf/sweep/build`).

## Must be tried on the real iPhone
The plan's try-list (section 5, items 1 to 10) stands as written. Only Chromium ran here, so these were not seen:
- **H1** no grey bubble in Safari, every wrong box in the pass gets its words, and the keyboard comes up on the wrong
  box (Income: Add income with nothing typed; Update my balances: "abc", Save).
- **H2** a hand-built `type="number"` box holding "12..5" (Capital gains, Bracket explorer, Credit cards' months): does
  Safari save nothing? Decides the `ui.numberBox` follow-up.
- **H3** the keyboard's key reads "next" in a first box and "done" in the last (Gifting: To whom).
- **H6** the hold: Income, 150 in Yearly raise, tap Starts: the cursor goes to Starts and Starts does not move; the red
  words appear under the raise only after the finger is up.
- **H7** `ui.reveal` above the keyboard: Your home, 2099, press return in the year box: the red line and Save are above
  the keyboard.
- **H8 (new)** the optional line, once a page marks its boxes (Goals has the same fold today, built in the page): tap
  "More details (optional)": the boxes open under it and the line stays under the thumb; a second tap shuts it; with
  the keyboard up, the line and the buttons stay reachable.
- **H9 (new)** a percent box shows "%" at its right edge, clear of the typed digits, at the largest text size in
  Settings > Display (Dynamic Type), and "5%" pasted in is taken.
- **H10 (new)** VoiceOver: leave a box holding 150 in a 0-100 box by swiping to the next one: "Use a number from 0% to
  100%." is spoken once; at Save the wrong box is focused and its words are read with its name, not twice.
- **H11 (new, after A1)** Net worth: Edit an account low on the list, change the balance, Save changes from the bottom
  of the form: the account's row is on the screen with the new balance and the green line.
- The home-screen app, once with Reduce Motion on: items 1 and 6 of the try-list.

## Handoffs

**To the integrator (docs step, seams section 4.4).** For `docs/PLAN.md` "Wave 1: choices made without the owner", the
forms list: the ten of plan section 7, and four more from this build: (11) optional boxes fold under "More details
(optional)", shut on a first visit, open by themselves for a saved value or a wrong box, and stay as the person left
them for the visit (in memory only, never stored); (12) a Save in a row's form under the row brings the row back on
screen; (13) the words under a wrong box follow what is typed, and an emptied box says nothing new until Save; (14)
words drawn after a box is left are read out once. The TEAM claim row names `core/ui/checks.js`, `core/ui/undo.js`,
`tests/ui-checks.test.mjs`, `tests/ui-undo.test.mjs`, `tools/check.mjs`.

**To the place track.** G1 to G9 as in the plan. New: the kit dispatches `planner:reveal` and scrolls in a through-save's
own task when the form sits in `ui.openUnder`'s holder (before the 50 ms redraw): that redraw must not anchor (C1
already says so). `details.form-more` is an ordinary `<details>` in `#content` (the kit keeps a person's open choice per
form for the visit; place keeping the same fold open across a redraw agrees with it). `.field-error[role=alert]` is a
kit node (`data-kit`), not a notice.

**To the taps track.** G5 to G8 as in the plan. The fold's line is a `<summary>`: a second tap on it changes no plan, so
the guard lets it land (shut again).

**To the touch sweep's owner** (`$SP/wtouch/qa`): (1) D-WRONG reads `invalid` events and `.notice` / `[role=alert]`
only; words the kit draws under a box when it is left are `small.field-error` named by the box's `aria-describedby`
(they are `role="alert"` now, which the sweep does see). (2) Kit number and percent boxes are `type="text"` with
`inputmode="decimal"`, `data-kind="number" | "percent" | "money"` and `min` / `max` attributes: D-WRONG's "more than its
largest value" case keys on `type === "number"` and no longer reaches them; read `data-kind`. (3) D-KIND guesses "money"
from a label like "Selling costs, as a share of the price" (a 0 to 15% box): `data-kind="percent"` says what it is.
(4) The plan's three asks: a strict D-WRONG (an `invalid` not default-prevented is a break), a D-UNDO variant for
one-tap overwrites, D-ENTER strict (Return in a box with another box after it must not save).

**To claude-a** (pages get the kit with no edit): taxes/documents' Remove still goes in one tap (ask first:
`ui.confirm`); goals/vehicle and goals/charitable can take the A5 recipe (`ui.reveal` on the draw that answers);
goals/vehicle (8 boxes) and debt/consolidation (8 boxes) can open short with `more: true`.

**For the optional-complexity work (the owner's 2026-11-12 ask), once the kit is on `main`.** One word per field, no
other page code. Forms of seven or more boxes at ee09f6e, with how many must be filled in (a static count of field
lists; hand-built forms such as Get started are not in it): career/offer-compare 24 (1), property/vehicles 23 (0),
career/benefits 21 (0), property/rental 21 (1), taxes/federal 20 (0), career/equity 19 (8), cashflow/paycheck 16 (0),
career/business 13 (1), insurance/policies 13 (1), property/home 12 (0), household/life-events 11 (3),
investments/employer-stock 11 (2), system/settings 11 (0), goals/goals 10 (2; its page-built fold can become
`more: true` + `moreOpen: !!editing`), property/renovation 10 (1), balance/liabilities 9 (2), cashflow/income 9 (2;
the copy in `accept-forms/pages/income.view.js` marks Yearly raise, Starts, Ends: 920 px becomes 593), insurance/health
9 (4), investments/holdings 9 (3), retirement/pensions 9 (2), cashflow/expenses 8 (2), insurance/term-vs-permanent 8
(4), property/purchase 8 (1), retirement/annuities 8 (3), transactions/ledger 8 (3), balance/assets 7, estate/gifting 7
(2), goals/house 7, insurance/ltc 7, investments/crypto 7 (2), property/rent-vs-buy 7, retirement/projection 7,
taxes/hsa-fsa 7, transactions/reconcile 7 (4); claude-a's: debt/consolidation 8, goals/vehicle 8. A page whose add form
starts a choice list off its first choice, or stores a default in an optional typed box, passes `moreOpen: !!editing`
(or `false`). A device setting "Show every box" would call `ui.setMoreOpen(true)` from the shell (`core/app.js`, not a
forms file) and belongs with System > Settings.

**Seen on the way, page-level, not touched**: goals/goals builds its own "More details (optional)" fold and opens it on
any held box of the form (its capture `invalid` listener), so an empty Add goal opens the seven optional boxes although
the two wrong boxes are above them (`bf/shots/k-goals-count.png`); with the kit's `more: true` the line opens only for
a box inside it.

**Small follow-ups the kit makes easy** (unchanged from plan section 3): `ui.fieldError` for the one-box refusals on
crypto, employer-stock, contributions, career/business, rental, home; `ui.undoable` for balance/update and
household/people's whole-plan Undo; `ui.numberBox` for hand-built `type="number"` boxes if H2 shows the need;
investments/allocation's live tally reads `Number(box.value)` while typing, so a typed "60%" counts 0 until the box is
left (read it with `ui.readNumber(box.value, { percent: true })`).

