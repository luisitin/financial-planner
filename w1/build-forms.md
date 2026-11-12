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

## Final checks (on the finished worktree)
FINAL_CHECKS

## Acceptance (`$SP/w1/accept-forms/B1..B15.mjs <base> <root>`, exit 0 = holds)
ACCEPTANCE

## Touch sweep (qa/touch-sweep.mjs, 8 pages x family, renter; rules D-WRONG, D-KIND, D-ENTER, D-TWICE, T-KEYBOARD, T-CANCEL, D-FOCUS-KEPT, D-SCROLL-KEPT)
SWEEP

## Deviations and why
DEVIATIONS

## Must be tried on the real iPhone
PHONE
