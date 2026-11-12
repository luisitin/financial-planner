# Breaker report: the touch-and-input sweep (claude-b), 2026-11-11

Base c385e41 with the builder's patch (scratchpad/touch/patch.diff). Defects were seeded one at a time in two worktree
copies (wtouchb for the Node half, wtouchb2 for the browser half). The fixed harness is in wtouch and in
scratchpad/touch/patch-b.diff. That patch changes tools, tests and docs only: 0 files under modules/, core/ or
index.html, and no CSS. Ports used: 9323 and 9325. Another agent's server held 9325 early on and 9324 later, and the
as-built sweep tested whatever answered on its port, so `serve()` now insists on its own server.

How to read the columns:
- **Node** is `tests/touch-rules.test.mjs`, the static half, run against its KNOWN counts.
- **--fast** is that seed's page for the --fast households (first, family). Every cell starts from a fresh plan, so a
  --fast run of a page is the same set of cells. These figures are taken from the page run, not from a separate run.
- **Page run** is the whole sweep of the seed's page for all six households: `--pages <page>`.
- **n/a** means the rule has no Node half because it needs a browser.
- A figure is the number of breaks that are new against an untouched run of the same harness, labelled with the rule
  that counted them.

## 1. Seeded defects (30 seeds, at least one for each of the 23 rules)

| Seed | Rule | Page | Defect seeded | As built: Node / --fast / page run | Fixed: Node / --fast / page run | Right page and control |
|---|---|---|---|---|---|---|
| S01 | T-TARGET | cashflow/income | "+ Add another income" 30 px high | n/a / 1 / 5 | n/a / 1 / 5 | yes, the button |
| S02 | T-NAME | overview/setup | for= removed in owe-amounts' own spending rows (setup/view.js:1151) | missed / missed / missed | missed / not in --fast / missed | **missed, then and now**: none of the six households reaches that code (owe-amounts only shows the spending rows when something is owed and not yet entered). By hand. |
| S02b | T-NAME | overview/setup/spend | for= removed from the spending question's row labels | missed / missed / missed (only the welcome screen was ever drawn) | **51** / not in --fast / 0 | Node: yes, `label "Rent"` on overview/setup/spend (and owe-amounts, which draws the same rows). The browser half has no label check. |
| S03 | T-NAME | cashflow/income | the form kit's field() label becomes a div | 3017 / 45 / 135 (+T-TARGET 15) | 3017 / 45 / 135 (+T-TARGET 15) | yes, every box |
| S04 | T-KEYBOARD | retirement/social-security | inputmode dropped from a number box | 7 / 2 / 7 | 7 / 2 / 7 | yes |
| S05 | T-KEYBOARD | cashflow/income | the page's boxes at 14 px | n/a / 25 / 75 | n/a / 25 / 75 | yes |
| S06 | T-ONE-WAY | cashflow/income | a second filled button in the form's card | missed (a form is its own unit, by design) / 1 / 1 | the same | yes, browser only |
| S07 | T-LINK | debt/payoff | a link to #/balance/liability | 3 / 1 / 3 | 3 / 1 / 3 | yes |
| S08 | T-LINK | overview/plan | "All N of our guesses" renamed "Click here" | 1 / missed (only the near household) / 1 | 1 / missed / 1 | yes |
| S09 | T-LINK | overview/plan | the same link renamed "Open ›" | **missed / missed / missed** | **1 / missed / 1** | yes (fixed: F7) |
| S10 | T-HEAD | cashflow/income | the add form's h2 becomes h4 | 1 / 2 / 6 | 1 / 3 / 11 | yes |
| S11 | T-CANCEL | cashflow/income | the add form loses Cancel | 5 / **missed / missed** | 5 / **1 / 5** | yes (fixed: F19 kind of part) |
| S12 | T-COVERED | cashflow/income | the button fixed under the top bar | n/a / 1 / 5 | n/a / 1 / 5 | yes |
| S13 | T-WIDE | cashflow/income | a 430 px block | n/a / **missed / missed** (52 D-* side effects) | n/a / **1 / 5** | yes, "the page" (fixed: F14) |
| S14 | D-ANSWERS | cashflow/income | Save returns at once and keeps the form | n/a / D-ENTER 10, D-WRONG 4 / D-ENTER 30, D-WRONG 12 | n/a / D-ENTER 9, D-WRONG 9 / D-ENTER 33, D-WRONG 33 | right page and boxes, **not by D-ANSWERS at Save** (the screenshot pair still differs) |
| S15 | D-ANSWERS | cashflow/income | Save empties the form and saves nothing | n/a / **missed** (D-ENTER, D-WRONG only) | n/a / **D-ANSWERS 2 / 6** | yes, "Add income": "the form emptied and nothing was saved" (fixed: F12) |
| S16 | D-TIME | cashflow/income | a 450 ms busy loop on "+ Add another income" | n/a / missed / 1 (load-dependent) | n/a / 1 / 5 | yes (measured 410 to 430 ms; one household 258 ms is listed as near the line) |
| S17 | D-ERROR | cashflow/income | the button throws after drawing | n/a / 1 / 5 | n/a / 1 / 5 | yes |
| S18 | D-FOCUS-KEPT | taxes/state | the shell blurs after every redraw | missed / not in --fast / missed | missed / not in --fast / missed | **missed**: masked, because the untouched page already loses focus on every redraw (the same break on the same boxes) |
| S19 | D-SCROLL-KEPT | cashflow/income | keepScroll dropped (the redraw goes to the top) | n/a / **missed / missed** | n/a / **2 / 2** | yes, "Add income", "Save changes" (fixed: F11 meant scroll) |
| S20 | D-SEEN | cashflow/income | the shell's bottom copy drawn above the screen | n/a / missed (renter, freelancer only) / 2 | n/a / missed / 2 | yes, the Remove buttons |
| S21 | D-BACK | cashflow/income | history.scrollRestoration = manual | n/a / 1 / 1 (load-dependent) | n/a / **missed / missed** | **masked**: the untouched page already throws the place away on Back (the shell scrolls to the top while Back draws), so this break is now counted every time on the base. The browser's restoring is checked by hand (H-BACK-PLACE). |
| S22 | D-ENTER | cashflow/income | Enter does nothing in the form | n/a / 10 / 30 | n/a / 9 / 33 | yes |
| S23 | D-TWICE | cashflow/income | resetAfter false | n/a / 1 / 1 | n/a / 2 / 6 | yes |
| S24 | D-KEYBOARD-UP | cashflow/income | a 72 px bar pinned to the bottom | n/a / **missed** (T-ONE-WAY 2) / **missed** (T-ONE-WAY 6) | n/a / **12 / 48** | yes, every box (fixed: F13 bar model) |
| S25 | D-TOP | cashflow/income | a new page opens half-way down | n/a / 1 / 2 | n/a / 1 / 2 | yes |
| S26 | D-WRONG | cashflow/income | "What is it" not required; an empty one dropped silently | n/a / **missed / missed** | n/a / **3 / 11** | yes, "What is it": "the form was dropped without a word" (fixed: F27) |
| S27 | D-KIND | cashflow/income | the kit reads money with Number() | n/a / **missed / missed** (NaN passed for a number) | n/a / **3 / 11** | yes, "Amount": "dropped what was typed" (fixed: F9) |
| S28 | D-UNDO | cashflow/income | Remove without asking | n/a / 1 / 5 | n/a / 1 / 5 | yes |
| S30 | D-FOCUS-KEPT | cashflow/income | leaving "What is it" saves a draft (a redraw between two boxes) | not run as built | n/a / 3 / 11 (+D-SCROLL-KEPT, D-SEEN, D-WRONG side effects) | yes, "What is it": "the redraw after the save took the cursor away" |

Not seeded: T-ONE-WAY's (b) way-on check (the Node half counts 54 on the base) and D-ERROR on typing; S29 was
written but not run. Summary:
- **As built**, all three halves missed 10 seeds (S02, S02b, S09, S13, S15, S18, S19, S24, S26, S27). S11 was caught
  only by the Node half. S14 was caught only by other rules. S16 and S21 were caught only by chance of the machine's load.
- **After the fixes**, three seeds are missed: S02 (code no household reaches), S18 (masked by the same break on the
  untouched page) and S21 (masked by the deterministic Back break). S14 is caught by D-ENTER and D-WRONG on the right
  page and boxes, but not at Save.

## 2. Forty sampled breaks: false alarms per rule

The sample was 40 breaks from the builder's full run (touch/sweep-first.json), spread over the 19 rules that had any
breaks. Each one was reproduced and screenshotted (touchb/shots/*.png), then judged. "After" is the same 39 cells
(household x page) run again with the final harness, from the untouched tree.

| Rule | Sampled | False before | Why false | After: false still counted |
|---|---|---|---|---|
| T-TARGET | 2 | 0 | (a link inside a sentence is real by the owner's 44 px rule; WCAG would excuse it) | 0 |
| T-KEYBOARD | 2 | 0 | | 0 |
| T-ONE-WAY | 2 | 0 | | 0 |
| T-LINK | 3 | 0 | | 0 |
| T-HEAD | 2 | 0 | (two pages called "Emergency fund": real) | 0 |
| T-CANCEL | 2 | 1 | Travel's "Something else" chip redraws the open trip form with one more box | 0 (F19) |
| D-ANSWERS | 2 | 0 | (Fees' Save does nothing; Dashboard in the menu on Dashboard leaves the menu open) | 0 |
| D-TIME | 2 | 0 | | 0: on this pass, at a lower load, both measured under the 200 ms line (D-TIME is a measurement, F26) |
| D-FOCUS-KEPT | 2 | 0 | (menu search loses letters, Chromium; Safari not checked) | 0 |
| D-SCROLL-KEPT | 2 | 2 | the control moved 34 and 12 px while a 130 and an 87 px confirmation opened above it | 0 (F15) |
| D-SEEN | 2 | 1 | "what was saved is off the screen" while the confirmation shows | 0, listed (F20) |
| D-BACK | 3 | 0 | | 0 (two now read "the page scrolls itself to the top", F2) |
| D-ENTER | 2 | 1 | Enter in a date box: a phone's picker has no Enter | 0 (F17) |
| D-TWICE | 2 | 0 | (Rental has no resetAfter; Compare) | 0 |
| D-KEYBOARD-UP | 3 | 0 | (by the owner's two-screen line) | 0 |
| D-TOP | 2 | 2 | document.title did not change because both pages are called "Emergency fund" | 0 (F16) |
| D-WRONG | 3 | 2 | the year 0026 in a date box, which a phone's picker cannot make | 0, listed (F18) |
| D-UNDO | 2 | 0 | (Goals' edit Save drops the account a goal draws on: real data loss, but it was named a remove) | 0 |
| **All** | **40** | **9 (22.5 %)** | | **0 of the 9; 29 of the 31 real ones still counted, 2 under the line this time (D-TIME)** |

There were no breaks to sample for T-NAME, T-COVERED, T-WIDE, D-KIND or D-ERROR: the as-built run counted none of
them.

The same cells, run again, also show breaks the as-built run did not count. I judged them by kind:
- **D-BACK "the page scrolls itself to the top when Back draws it again"**: 106, real by the rule. The page's own
  scrollTo is recorded.
- **T-LINK on links of small words only**: 7, real ("Open the page", "What would change it").
- **D-SCROLL-KEPT, D-SEEN, D-TWICE, D-KEYBOARD-UP, T-HEAD**: 1 each, real. These are Categories' add with no
  confirmation, Goals' edit Save twice, Goals' far button, and FIRE's h1 to h3.
- **D-WRONG "the form was dropped without a word"**: 2, both false (Fees' one-box form, Goal seek's calculator). The
  final change, F27, removed them, which a check run confirmed.
- **Get started's screens**: 2 false patterns, cut before they were counted:
  - Its money boxes refuse letters as they are typed.
  - Its Continue takes guesses for blank boxes.
- **Settings' connection forms**: 7 false patterns, cut before they were counted. They save to the device, not to the
  plan.

## 3. Determinism (the sweep run twice on the untouched tree)

- **As built:**
  - `--fast` gave 74 breaks for the builder on a quiet machine, and 322 for me at a load of 15 to 20. My run had
    69 D-ANSWERS, 89 D-FOCUS-KEPT, 68 D-BACK, 54 D-WRONG and 14 D-ENTER.
  - Cause 1: a tap's click arrives a moment after the finger lifts, and the sweep read the screen before it.
  - Cause 2: Back raced the browser's own scroll restoring against the page's redraw.
- **Fixed harness, two `--fast` runs back to back:**
  - At loads 4.2 and 6.6: **129 and 129 breaks, one for one** (rule, household, page, state, control, kind).
  - The things checked, the 26 listed and the "not checked" list are identical. No tap lost its click (on the six
    sample reruns, 3 taps of about 2,000 lost theirs. Each is counted in the report's stats line, but the sweep still
    judges what the screen shows. A "nothing changed" verdict is confirmed by a second tap with two screenshots. The
    sampled verdicts on those cells matched the other runs).
  - The runs took 190 s and 202 s.
- **One harness step earlier** (before F27's last refinement), at loads 5.1 and 6.4: 144 and 144, also one for one.
  - At loads 12 to 14, the pair before the D-TIME band differed only in D-TIME: 1 against 3. Family's
    withdrawal-strategy measured 271 to 316 ms of processor time.
  - That is why D-TIME now counts from twice its line.
- **Get started's 12 screens x 6 households**, run twice (the untouched base and S02, whose code nothing reaches):
  identical, rule for rule and page for page.

## 4. What I changed (all in wtouch: qa/, tests/touch-rules.test.mjs, qa/README.md, docs/CONVENTIONS.md)

Each change is also stated in its rule's `check` in qa/touch-rules.json ("Breaker, 2026-11-11"), with sources and dates.

**Flakes**
- **F1:** every tap waits until its click reaches the page (`armTap`/`tapLanded`). The report counts taps whose click
  never came (0 in both final --fast runs; 3 of about 2,000 on the six sample reruns).
- **F2:** D-BACK is judged by the page's own scroll to the top while Back draws it again. It is counted every time,
  and no longer retried against the browser's timing. Whether a phone restores the place is H-BACK-PLACE, by hand.
- **F26:** D-TIME counts from twice its line (400 ms, or 2 s with no word that it is working). Between the line and
  twice it, a measurement is listed, and H-SPEED times those by hand.
- **`serve()` refuses a port it does not own.** It needs its own server's start line, and stops on EADDRINUSE.

**Misses**
- **F7 (T-LINK):** words made only of small words name no page. The test's "Open ›" assertion was changed to expect
  this.
- **F9 (D-KIND):** NaN, nothing, or 0 for a non-zero amount count as "dropped what was typed".
- **F11 (D-SCROLL-KEPT):** a "meant" scroll needs the page's own confirmation in view.
- **F12 (D-ANSWERS):** "the form emptied and nothing was saved".
- **F13 (D-KEYBOARD-UP):** a bar pinned to the bottom rides up with the keyboard.
- **F14 (T-WIDE):** measured against 390 px, because a phone widens innerWidth with the page.
- **D-TWICE:** filled-form saves are tried twice too, and every list is compared.
- **T-CANCEL:** the kind of a part includes its submit name, so the add form is no longer skipped as "the same" as the
  edit form.
- **F21 to F24, F28:**
  - The Node half draws every screen a page links to: the guide's seven journeys.
  - Both halves sweep the screens listed under `screens` in the rules file: Get started's 11 questions,
    `screenList()`.
  - The Node half reads a page's scoped `<style>` for outlined buttons.
  - The Node half flags a `<label>` tied to no box.
- **F27 (D-WRONG):** an optional box is left empty with the rest filled in. If the same form saves when full, but saves
  nothing and says nothing when that box is empty, it is "the form was dropped without a word".

**False alarms**
- **F15:** the control itself must move more than 60 px.
- **F16:** document.title is judged against the new page's name.
- **F17:** no Enter test on date boxes.
- **F18:** the year 0026 is listed.
- **F19:** T-CANCEL is not counted for a form that is drawn again.
- **F20:** "what was saved is off the screen" is listed.
- **F25:** a page that got shorter under the screen, with a confirmation showing, is not a jump.
- **Focus rings** are hidden in D-ANSWERS' screenshot pair.
- **Element following:**
  - The next box is followed as an element, because its words, and so its key, change once the first box has a
    figure.
  - A box that refuses letters as they are typed has answered.
  - Rows a step button fills with the page's own figures are listed.

**Tests and docs**
- **KNOWN** is now T-ONE-WAY 54 (+42 for the journeys, each ending like Step by step) and T-LINK 195 (+48 small-words
  links, +62 on the journeys, mostly "Do something else", which opens Get started). The reasons are in the test.
- **The rules file** has a new `screens` entry and two new by-hand rules: H-BACK-PLACE and H-SPEED (10 in all).
- **qa/README.md** covers screens, the new kinds, the timing band, determinism and how the sweep was broken.
- **docs/CONVENTIONS.md** has one new paragraph: a page with button-driven screens lists them under `screens`.
- **Checks:** `npm test` passed (189,125 tests, 0 failing, 646 todo). `npm run check` passed. The leak guard
  (`--worktree`) passed.

## 5. Real app findings met on the way (for the page owners, not fixed here)

- **Goals:** editing a goal and saving drops the account it draws on.
- **Double taps:** two fast taps on Save in an edit form add the row again (Income, Goals). Rental's add form has no
  resetAfter.
- **Travel:** prints "null".
- **Menu:** opening Dashboard from the menu while on Dashboard leaves the menu open.
- **Fees:** Save does nothing.
- **Categories:** add and save confirm nothing, and the screen jumps.
- **Budget:** "+ Add an envelope by hand" opens a form with no Cancel while there are no envelopes.
- **Shared name:** two pages are called "Emergency fund".
- **Back:** the shell scrolls every page back to the top when Back redraws it (80 D-BACK in `--fast`).
- **Get started:**
  - The spending screen's Continue sits 900 to 1,500 px below its boxes (D-KEYBOARD-UP).
  - "$1,200.50" is saved as 1200.

## 6. Left open

- **S02:** the code is reached by no invented household. A household that owes something not yet entered would reach
  it.
- **S14:** a Save that does nothing is still not caught at Save by D-ANSWERS. It is caught through D-ENTER and D-WRONG
  on its boxes.
- **S18:** masked.
- **S21:** masked, and checked by hand.
- **The browser half** has no unattached-label check (the Node half has).
- **The full sweep** grows by Get started's 11 screens x 6 households: about 6.5 min of browser time at 2 workers.
