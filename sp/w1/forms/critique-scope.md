# Critique (scope) of the forms design, wave 1

Reviewer: the maintainer who has to live with it. Scope, lanes, AGENTS rules, testability, build order, coverage.
`$SP` = `$SP`. My scripts and
outputs are in `$SP/w1/forms/crit-scope/`:
- `coverage.mjs` and `coverage2.mjs` check section 8 against the theme files and against the branch tip.
- `s1-wave2-checks.mjs` and `s1b-health.mjs` run the prototype kit on the tip.
- `s2-fakedom.mjs` runs the kit under the view tests' stand-in DOM.
- `app/` is the tip c6fb730 with the prototype's `core/ui/{dom,checks,undo}.js`, `base.css` and `app.js` copied in.
  It was served on 127.0.0.1:9361, now stopped. `?forms=off` gives today's kit from the same server.
- `shots/` holds the screenshots.

The prototype worktree and the repo were not touched. The breaker's critique (`critique-break.md`) covers the
behaviour bugs; I do not repeat them here.

## Blocking

### 1. The design is planned against c385e41; wave 2 has since closed 33 of its 55 findings in the pages
- **Evidence:** `git log c385e41..HEAD` shows 108 commits, with 100 view.js files changed (+2,706 −782). These are
  wave 2's page batches (claude-d, e, f, g, h). `node coverage2.mjs $SP` printed:
  `closed in a page by wave 2 since c385e41: 33; still open for wave 1: 22`.
  - All of UI-LIVE and all of UI-TARGET are closed.
  - In UI-UNDO, only retirement-b/x-3, T11 and x-duplicates are still open.
  - Mechanisms left with no open finding: the do-nothing net (M2 step 4: 0 of 3 still open), `ui.later` (0 of 3),
    `ui.goTo` (0 of 7), `ui.reveal` (0 of 1), `ui.check` (0 of 4).
  - `ui.change`, `undo.js` and `undoLine` serve 3 open findings, and each of those needs a page edit anyway.
- **Evidence (collisions):** all 8 prototype page edits collide with landed commits:
  - liquidity: f8d44ee, 33c65fd
  - subscriptions: 7c5c1d8
  - mortgage: 33c65fd
  - payoff: 33c65fd
  - prioritizer: f8d44ee
  - contacts: f8d44ee
  - brackets and capital-gains: cf6e101

  So the Undo, what-if, `ui.check` and T-KEYBOARD measurements in section 2 measure page code that will not land.
  Wave 2 also chose differently from this design on some pages: "Not a subscription" now asks first and has a Hidden
  card (7c5c1d8), whereas design choice 1 and adoption A4 add Undo there.
- **Change:**
  - Rebase the prototype on the tip and redo sections 2, 3 and 8 there.
  - Cut what no open finding needs: M2 step 4 (and its MutationObserver), M7, M8, `goTo`, `reveal` and `check`, along
    with S2, S9 and S10.
  - What is left: M1, M2 steps 1 to 3, M3, M4, M5, a narrowed M6, tel/email, and the base.css form and notice lines.
    It closes all 22 open findings except the UI-UNDO three (see 5).

### 2. `novalidate` undoes wave 2's own checks, and the safety net skips kit forms
- **Evidence:** `node s1-wave2-checks.mjs` on the tip. Today's kit is the left result, the prototype the right.
  - Employer stock, symbol `acme!!`: today it is refused ("A symbol is letters, like ACME."). The prototype saves
    `"ACME!!"` with "Saved.".
  - Crypto, bought 2099-01-01: today it is refused. The prototype saves `lots ["2099-01-01"]` with "BTC added.".
  - This is p-investments/INV-10, which b7cfdd2 closed, coming back.
- **Evidence:** `node s1b-health.mjs` (Health, out-of-pocket maximum below the deductible). With the prototype, the
  page's `reportValidity()` fires `invalid` with `prevented:false`, so the bubble shows and no words appear at the box.
- **Causes:**
  - `dom.js:174` sets `f.noValidate = true`.
  - `wordsOf` (`dom.js:273-281`) reads only the kit's SPEC, never `validity.customError`.
  - `dom.js:648` has `if (c.form?.noValidate && !c.form._kitAsked) return;`, and `_kitAsked` is set nowhere (grep of
    the proto).
  - At the tip, 10 views use `setCustomValidity`/`reportValidity` (1 at c385e41): health, tax-lots, holdings, people,
    calendar, crypto, employer-stock, payoff, credit-cards and update.
  - So B1 ("the grey bubble never shows") is false on 5 pages, and INV-10 regresses on 2.
- **Change, smallest version:** keep the box's validity as the engine. This is forms2's option (a), which section 2
  M2 rejected.
  - Number and percent boxes become text boxes that set their words with `setCustomValidity`, as `moneyBox` already
    does.
  - A capture `invalid` listener calls `preventDefault()`, puts words under each box, brings the first box up and
    puts the cursor in it.
  - Drop `novalidate`.
- **Why the design's reason for rejecting (a) does not hold:** M2 (a) says "the browser stops at the first wrong box
  and names only that one". That is true of the bubble, not of the events. In `s1-wave2-checks.mjs`, one submit of
  Health's form with today's kit fired `invalid` on all four empty boxes (name, premium, deductible, oopMax).
- **This also removes R5:** the permanent touch sweep reads `invalid` events (see 4).
- **If `novalidate` stays:** `wordsOf` must return `c.validationMessage` when `c.validity.customError`, and the net
  must cover kit forms (delete the `_kitAsked` guard). Both must land in S3; S3 alone regresses INV-10.

### 3. `npm test` never runs the kit the phone runs
- **Evidence:** `node s2-fakedom.mjs` printed
  `{"mode":"off","novalidate":false,"numberBoxType":"number","dataKind":null,"onSubmitGot":{"n":null,"p":null}}`.
  - "1,200" reaches `onSubmit` as `NaN` (printed as null). The phone gets 1200 and 5.
  - The cause is `dom.js:11-13`: the fake document (`qa/fixtures/fake-dom.mjs:40`) has no `addEventListener` or
    `documentElement`, so DOC is false and MODE is "off".
  - 22 test files use the fake DOM.
  - S11 removes `?forms=off`, but the `!ON` branches have to stay so those tests pass. That leaves two kits in one
    file, and the tested one is the old one.
- **Change:**
  - "Off" should mean only "no document listeners". `form`, `readForm`, `moneyBox` and the number and percent boxes
    should build and read the same way in Node: give fake-dom `addEventListener` and `documentElement` stubs, and
    check `tagName`/`type` instead of `instanceof HTMLInputElement`.
  - Move the heuristics into pure functions on plain records in `checks.js`, with node tests. These are afterDraw's
    rule and target choice, `locate`, `nativeWords`' step words, and the question-verb rule. The breaker found its
    wrong-row glow (#1) in exactly this untested code.

### 4. No step's gate can run as written
- **Problem:** every step's gate is "the touch sweep on the 10 pages … with no new break". The permanent sweep is not
  on the branch, and the copy that will land does not understand the kit.
- **Evidence:**
  - The copy that will land is wtouch, uncommitted on c385e41. It reads browser `invalid` events at
    `touch-page.mjs:59` and `touch-sweep.mjs:309, 483, 492, 501, 598, 635-686` (D-WRONG, D-ENTER, D-ANSWERS, and the
    "filling was refused" skip).
  - The R5 adapter exists only in the forms proto's stale copy (`touch-lib.mjs:144`: `data-min`/`data-max`/`kitKind`),
    and wtouch has moved on since (diff of the two copies).
  - The design's own first run read 102 breaks, 87 of them false.
- **Change:**
  - Either take 2's engine (no adapter is needed), or hand the adapter to the wtouch agent as a patch on its current
    tree and land it before S3.
  - In section 6, name which sweep copy, at which commit, each step runs.

### 5. Five findings are left with no owner and no behaviour after both waves
- **Evidence:**
  - The UI-UNDO three (T11, x-duplicates, retirement-b/x-3) are still open at the tip, per `coverage2.mjs` (block 1).
  - **T9 (sev 4):** the jump on tapping a row (8,075 px on the ledger) is listed as A7, a wave 2 job. But claude-d,
    who owns ledger, categories and rules, wrote "Shared causes (Back, typing kept, Undo, edit form at its row) I
    leave for wave 1" (WORKBOARD 2026-11-11 19:00) and then closed PG-TXN (22:15). The kit only brings the row back
    after Cancel or Save.
  - **T11 and the Undo half of x-duplicates:** same owner, same note. A4 has no taker.
  - **retirement-b/x-3 ("Plan on $6,600 a month"):** `withdrawal-strategy/view.js:132-134` still writes with no way
    back. claude-e closed PG-RETIRE and released the claim (23:30).
  - **F6 (sev 3), the "The figures stays open below for the next try" half:** claude-g left "sections that shut after
    a save on rent-vs-buy and renovation" to the shell (WORKBOARD 22:30). Place's choice 3 lets the page fold them,
    and the kit does not reopen them.
- **Change:** section 8 names an owner and a step for each. Either:
  - wave 1 makes five small page edits under an extended claim, using the undo pattern wave 2 already uses
    (`withdrawal-strategy/view.js:162` "Put it back", recurring's Hidden card); or
  - they go on a named wave-3 list and the owner is told.

### 6. The contract with place is one-sided, and written for only one of the two place designs
- **Evidence:**
  - grep finds none of `data-kit`, `afterDraw`, `ui.later` or `halfform` in either `w1/place/design.md` or
    `w1/place2/design.md`.
  - place says "core/ui/dom.js (form kit) is not touched" (`design.md:541-542`). So "one function, `ui.later`, used by
    both" has no taker.
  - place2 asks for the opposite order: the forms track's "bring the answer into view must run after the shell's
    anchor" (`design.md:529-533`). This design says place's anchor runs only when `!kitMoved`.
  - The build workflow picks place or place2 and plans the seams in `app.js` and `dom.js` (`build-wf.js:5, 46`).
- **Change:**
  - Write the contract as names the seams planner can check against either design: the `afterDraw` signature and
    result, `kitMoved`, `data-kit-moved`, and place's let-go.
  - Decide the order once.
  - Drop `ui.later` (no open finding), so the one "wait while typing" rule is place's M8 alone.

## Should fix

1. **Claim and lanes.**
   - TEAM.md:75 (wave 1) names `dom.js`, `base.css`, `app.js` and "a new small file under core/ for the page's place".
     It does not cover `core/ui/checks.js`, `core/ui/undo.js` or `tests/ui-*.test.mjs`, and core/ui/* is the
     designer's lane per the TEAM table. Add them before S1.
   - The `app.js` hook lines are the seams planner's call.
   - `.kit-glow`, `@keyframes kit-glow` and its reduced-motion rule are not form or notice selectors, which is all the
     track was given in base.css. Name them in the claim.
   - claude-c's claim row (TEAM.md:77) still lists mortgage and home. A2 would touch them, but A2 is unnecessary once
     the mover exists: it removes the page's own node before the page's timer would remove it. Drop A2.
2. **No hidden mode or probe on the branch.** S11 runs last, so the commits for S3 to S10 carry `?forms=off` and an
   unbounded `window.__kitLog` (`dom.js:15`), and main can move in between. Keep both in the prototype only. Measure
   each step with two servers: the tip, and the tip plus the step.
3. **afterDraw ignores a page that scrolled itself.** CONVENTIONS: "a page that scrolls itself while drawing still
   wins".
   - `afterDraw({ keepScroll })` never receives `keepY` (`dom.js:461-467`), and the proto `app.js` computes
     `pageScrolled` only afterwards.
   - At the tip, 51 views scroll themselves, against 38 at c385e41. Wave 2 added row and answer scrolls on Holdings,
     Tax lots, Term vs permanent, Refinance and Liquidity.
   - Change: pass `keepY` and stand down when `|scrollY − keepY| > 2`.
4. **Checks that need page edits cannot be wave 1 gates.** S3's `m-check` (payoff), S9's `m-undo` and S10's `m-live`
   all depend on prototype page edits that collide (see 1). They go with the cut.
5. **Hand reads of number boxes at the tip (R6).** `tax-lots/view.js:84` and `:93` compute `Number(sharesBox.value)`.
   With a text box, "5,000" makes that NaN, so the room check never fires, while the kit reads 5000. A lot bigger than
   the holding gets saved. `credit-cards/view.js:155` reads its two boxes outside a form. Run the R6 grep on the tip.
   Give pages a `ui.numberValue(box)`, or have them use `onSubmit`'s values.
6. **`npm run check` purity.** `tools/check.mjs:50` greps only `core/estimate` and `core/math`. Add `core/ui/checks.js`
   (and `undo.js` if it stays), since both are documented as pure.
7. **A test line that hides its intent.** In `tests/ui-checks.test.mjs`, the expected value is written as
   `"Use a whole number, like 12.".length ? "" : ""`. Write `""`.
8. **R2's check cannot run here.** It needs Playwright WebKit, which reports `webkit … false` (not installed). Move it
   to the phone try-list, or install WebKit in the build environment.
9. **Handoffs to this track are unanswered.**
   - taps hands this track the reduced-motion rule for `.fold .fold-chev` and `.scroll-hint::after` (j-hard-conditions/
     HC-5, taps `design.md:387, 595`). It is not in this design.
   - claude-g asks for a kit-wide `more: true` fold (WORKBOARD 22:30).
   - Accept or decline each in writing.
10. **Stale line references.** A2's home `:124/:127` are now `:127/:130`, and mortgage `:76` is now `:83`. Refresh
    every `file:line` in sections 3 and 8 at the tip.
11. **Static site.** Keep the `?.` on the `app.js` hooks (`ui.drawStart?.()`, `ui.afterDraw?.()`, `ui.setStore?.()`).
    Then an old `dom.js` under a new `app.js` on the phone still draws. Land the kit, and move main, before any page
    calls a new `ui.*` function; otherwise that page throws and triggers the heal reload. Run `npm run skew` on the kit
    step.
12. **Answers measured without place (breaker #15), from the scope side.** A1 and cashflow-a/x-3 are counted "kit" in
    section 8. `m-result.mjs:17-18` opened their folds with a tap, so with place merged rule 4 would apply and nothing
    would move. Both are now closed in pages (cf6e101, 7c5c1d8): drop the kit claim. Re-measure DP-1, F6 and RC-11 on
    the merged build.

## Tried and held up

- **Coverage on paper:** `node coverage.mjs $SP` found 55 findings in the theme files and 55 rows in section 8, with
  none missing, none extra and no severity mismatch.
- **The refusal mover (M2 step 3) is still needed, and it is the smallest fix.** At the tip, 7 refusals still prepend
  off screen: home:127/130, mortgage:83, crypto:136-137, employer-stock:127/152, rental:168, vehicles:101, and
  documents:72 (claude-a's, helped with no edit). claude-g left them to the shell, and the theme proposes the same
  fix.
- **Return (M5) and tel/email** have no wave-2 collision: no wave-2 commit names the four UI-ENTER findings, and
  claude-g asked for tel/email in the kit.
- **The 1e9 money ceiling** respects the explicit `max` that wave-2 pages set (crypto 1e10, health 1e6).
- **sw.js** keeps no file list, so new core files need no sw.js change. main-gate's two static-skew runs do not depend
  on which files exist, and `tools/live-check.mjs` already lists base.css in `ALWAYS`.
- **mendBlockedForms** respects `form.noValidate` (`app.js:429`), so the framed single-file build is unaffected by
  either engine.
- **AGENTS rules:** core stays dependency-free (`dom.js` imports only `../format.js`, `../math/periods.js` and the new
  pure files), CSS goes only in base.css, no view.js lands in wave 1, and the words on screen are plain.
- **Tests for the pure files:** every export of `checks.js` (4) and `undo.js` (3) has a node test, and `npm test`
  (`tools/run-tests.mjs`) picks them up.
