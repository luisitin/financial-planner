# Constraints for "simple first, detail on request"

Read at tip `737fb6a` of `claude/creative-build-b531q0` on 2026-11-12, from the read-only copy in `opt/app`. Nothing was
walked in a browser and no file of the repository was edited. Sources are listed in section 5. Where this report says
"quote", the words between quotation marks are copied from the file named.

Two names used throughout, because both are in flight and neither may be duplicated:
- **the retirement request**: the owner's request of 2026-11-11, parts L1 to L8, being fixed in the worktrees
  `rv/b-ret`, `rv/b-scn`, `rv/b-doc`. It applies the new rule to its own pages there.
- **wave 1**: the touch stress test's rebuild of the shell and form kit, in the worktrees under `w1/`.

## 0. What a design most easily gets wrong

1. **Only one sentence of the rule is the owner's.** Everything after "Rule:" in the design log entry of 2026-11-12 is
   the builder's reading, and the entry says so: "(The builder's reading of the owner's sentence; the owner can tighten
   or loosen any part.)" A design may sharpen the reading. It may not undo any earlier entry of the log.
2. **One filled button per view, one way on per page, nothing new pinned to the bottom.** A fold, a toggle or a level
   switch is never a second filled button and never a bar.
3. **The household's view never shows build, computer, AI helper or sync words.** A "show me more" setting is a
   different thing from the build view and may not leak into it.
4. **Builder details are removed from the screen, not folded.** The owner was offered a "For builders" fold and chose
   removal (2026-09-15, coming-soon page).
5. **Some things were chosen to stay visible.** Net worth rows keep both Edit and Delete (the owner declined "Delete
   inside the form"). An empty list keeps its add form open. A zero tile says so in plain words instead of vanishing.
6. **A fold may not change what Save writes.** The guesses rule says a guess is written only "from a box the person
   saw". A form with folded boxes needs one answer to "was a folded box seen?" that does not depend on whether the
   fold happened to be open (section 1.6, item F7).
7. **The kit files are taken.** `core/ui/dom.js`, `core/ui/base.css`, `core/app.js`, `core/router.js`,
   `core/search.js`, `index.html` and `modules/overview/guide/frame.js` belong to wave 1 until it lands. A shared helper
   for optional detail has to be a new file, and rule 6 forbids new global CSS anyway.
8. **161 pages: 126 are free for claude-b now, 11 are in claude-b's own in-flight worktrees, 11 are claimed by
   claude-f, 13 are claude-a's and get a hand-over.** claude-a's last message on the workboard is from 2026-10-30;
   none of the five hand-overs written since has been answered.

---------------------------------------------------------------------------------------------------------------------

## 1. The binding decisions, as a checklist

Each line is something a design passes or fails. "Log" is `docs/DESIGN_LOG.md`; the date is the entry's date. Items
marked **owner** were chosen by the owner in a review round (options were offered and one was picked) or asked for in
the owner's own words. Items marked **rule** are in `AGENTS.md` or `docs/CONVENTIONS.md`. Items marked **reading** are
the builder's interpretation as recorded in the log: the spec may make them more exact, and only the owner may loosen
them.

### 1.1 The rule of 2026-11-12

The owner, verbatim (log 2026-11-12): "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality
of complexity. Default to less is more and allow more complexity or toggles. We want subtle optional complexity".
"Options offered: none; the owner asked for it." "Owner chose: simple by default, with the detail one quiet tap away."

| id | a design passes when | status | quote (log 2026-11-12, repeated in `AGENTS.md` design rules) |
|---|---|---|---|
| R1 | the first view of every page, card and form shows the least a person needs | reading | "the first view of a page, card or form shows the least a person needs: the answer, a few rows, one action" |
| R2 | nothing is removed: everything else is one tap away | reading | "Everything else stays available, one tap away, behind a quiet fold or toggle in plain words ("2 more numbers", "Set my own numbers", "More options")" |
| R3 | the way to more is quiet | reading | "never a second filled button and never a wall of boxes" |
| R4 | a simple choice comes before an exact figure | reading | "A simple choice comes before an exact figure (chips or presets first, "Type my own" opens the box)" |
| R5 | a folded part that holds the person's own figure, or an error, says so | reading | "A folded part never hides something of the person's silently: when it holds a figure they changed, or an error, its summary line says so and an error opens it" |
| R6 | opening or closing writes nothing to the plan | reading | "Opening or closing anything never changes the plan" |
| R7 | deeper pages are linked, not added to the path | reading | "Deeper pages are reached by "Go deeper" links, not placed on the main path" |
| R8 | the retirement pages are not redone here | fact | "the pages follow in their own commits (first the retirement pages of the 2026-11-11 request: "What this rests on", the left-over answer, Assumptions, pay the tax later or now, the pay stub and bank file readers)" |

The workboard line to all builders (2026-11-12 14:55 UTC) adds two things a design must honor: "Apply it to every
screen you touch from now on" and "until that lands use plain `<details class="fold">`". It also announces what is
being designed: "A census of every page's first view and a shared helper (so what a person opened is remembered on
their device, plus one device setting for people who always want the detail)".

Three owner-chosen precedents already do what R5 asks, so the spec can cite them instead of inventing a pattern:
- Ledger (log 2026-09-15, round 18): "filters folded behind a "Showing: all months · all accounts · all categories"
  row that stays open while a filter is set".
- Import (log 2026-09-16, pass 3 round 2): "columns behind "Columns worked out for you. Change them ›", open by itself
  when the date or amount column is missing".
- Settings (log 2026-09-15, round 6): "one fold per topic ("8 of 8 on"), pills only when a page was switched".

### 1.2 Buttons and ways on

| id | a design passes when | status | source and quote |
|---|---|---|---|
| N1 | a view has one filled button; everything else is outlined | owner + rule | `AGENTS.md` design rules: "the primary action as a filled button, secondary actions outlined". Log 2026-09-15 round 17 (Assumptions, "two filled buttons" was the finding): "one filled "Save and mark as reviewed" (saving is reviewing), Reset outlined". Log 2026-11-06: "the one filled button continues the path". Design-review skill: "One primary (filled) button per view; the rest outlined." |
| N2 | every page ends with exactly one way on, and the shell draws it | owner | Log 2026-11-06, Rule: "every page ends with exactly one way on (Next on a step of the path, "Next result" after Your plan, or one quiet "Continue your plan" row), except the Dashboard, Get started, the questions and Your plan, which lead the way themselves." Drawn by `modules/overview/guide/frame.js` (`docs/CONVENTIONS.md`, "Shell hook: frame"). |
| N3 | nothing new is fixed to the bottom of the screen | owner | Log 2026-11-06: "No Next bar is fixed to the bottom of the screen (it rides over the keyboard and covers the page's own buttons); a long page has "Done? Go to Next ↓" at the top instead." The decision names the Next bar; its reason applies to any pinned switch or "show more" bar. What is fixed to the bottom today is only a confirmation that leaves by itself (`.save-echo` in `core/ui/base.css`, `.gb-toast` in `frame.js`). |
| N4 | no second menu, no extra stepper, no new walk | owner | Log 2026-11-06: "Do not add a second menu, a stepper beyond the bar's track, or a new "walk": a new step is a step of the path." Also: "The path says "Step", the setup says "Question"." A level picker that travels with the person across pages would be a second menu. |
| N5 | a page's own links card is never headed "Next" | owner | Log 2026-11-06, "Not yet done in this change: the 44 pages whose own "Next" card should be renamed "More on this" (a scripted heading change, one commit, waits)". At the tip: 37 `view.js` say "More on this", 7 still say `card("Next"` (all in claude-a's folders: `taxes/state`, `taxes/documents`, `debt/student-loans`, `goals/charitable`, `goals/vehicle`, `goals/travel`, `balance/projection`), and no view says "Go deeper". See open point O1. |
| N6 | Your plan is honest about gaps | owner | Log 2026-11-06, review changes: ""Your plan" says "not finished yet" (no check mark, no "ready") while any answer is missing, and holds back "What to do next" and "You're done for now" until the gaps are filled". Simplifying that page may not hide the missing answers. |
| N7 | Get started stays one card and one button on first open | owner | Log 2026-11-06: "first open: "Let's build your plan", one "Let's go", the eight tiles folded behind "Just want one answer?"". |
| N8 | the Dashboard keeps its finished steps as one folded line and its tiles as links | owner | Log 2026-09-15, pass 2 round 1: finding 2, chosen A "one folded line "all 6 steps done ✓"" (not B "hide the card"); finding 3, chosen A "tiles open their pages with a chevron"; finding 1, chosen A "after the first account: "What to do now"" (not B "hide once all steps done"). |
| N9 | the known two-filled-button pages do not grow | rule | `docs/CONVENTIONS.md`, "Two filled buttons": "a few step pages draw a filled button of their own that is not the step's action (Pay off debts' "Add the rates and payments", Emergency fund's "I moved it"), so they show two. The path walk (`qa/flows/path-walk.js`) reports them and does not fail on them. A step with an `ownAction` ("Save plan", "Work it out") draws Next outlined until it is done." |

The path's pages, for R7 and N4 (from `modules/overview/guide/journeys.js` and `compute.js` at the tip): steps
`overview/setup`, `cashflow/expenses`, `debt/payoff`, `balance/liquidity`, `insurance/life-needs`,
`retirement/projection`, `scenarios/goal-seek`, `retirement/withdrawal-strategy`, `retirement/rmd`, `goals/house`,
`goals/education`, `taxes/federal` (each shown only when it applies to the household); Your plan's result rows add
`balance/net-worth` and `goals/goals`. These 14 pages are the nearest thing the app has to the owner's "big picture".
Read that way, every other page is where a person can "delve deeper". That is a reading, not a decision.

### 1.3 The household's view

| id | a design passes when | status | source and quote |
|---|---|---|---|
| H1 | no build, computer, AI helper or sync words on any screen of the default view | owner | Log 2026-11-06: "Do not undo: the household's view never shows build progress, "soon" pages, or PC / AI helper / sync wording; the build view is for whoever builds the app." `docs/CONVENTIONS.md`: "No "soon", phases, ready counts, "PC", "server", "sync" or "AI helper isn't answering" on screen." |
| H2 | only ready pages are listed; builder pages never; pages that need the computer or the AI helper only while it answers | owner | Log 2026-11-06: "Menu, search and All pages list only ready pages ... builder pages (Diagnostics, Docs) are never listed; pages that need the PC or the AI helper are listed only while it answers". Manifest fields `builderOnly: true` (`system/diagnostics`, `system/docs`) and `requires: "pc" \| "ai"` (`system/audit`, `system/backups`, `transactions/statements`; `ai/assistant`, `ai/categorizer`, `ai/critic`, `ai/explain`). |
| H3 | the build view stays where it is and keeps its label | owner | Log 2026-11-06: "The build view comes back with Settings > Advanced > "Show what is still being built", or ?view=build (and ?view=user to leave it)." `tests/user-view.test.mjs` and `qa/user-view.mjs` pin it (the qa script taps "Advanced" and reads the switch's label). |
| H4 | the settled words stay | owner | Log 2026-11-06: the topic is "Helpers", not "AI assistant"; the status pill says "Saved on your computer"; footers say "your own devices"; "the menu's first list says "Start with" until a few pages were opened". |
| H5 | the Dashboard's build phases are not re-proposed | owner | Log 2026-09-15 round 1, finding 3: "Owner chose: C, "leave as is for now, once built it won't exist". Do not re-propose." Since 2026-11-06 the card shows in the build view only, "kept exactly as it was". |
| H6 | builder details are not on screen at all, folded or not | owner + rule | Rule 14: "Builder details go in the README and the catalog's seeds column, never on screen." Log 2026-09-15 round 8, finding 2, a "For the builder" line: options "A) remove it (stays in catalog + README)  B) fold behind "For builders"", "Owner chose: A". |

### 1.4 Technical parts and sources go last and folded

| id | a design passes when | status | source and quote |
|---|---|---|---|
| T1 | connections, providers and developer knobs are the last thing on a page, folded, with a one-line status | owner + rule | `AGENTS.md`: "Technical sections (connections, providers, developer knobs) go last, folded in a `<details class="card fold fold-card">` with a one-line status in the summary." Log 2026-09-15 round 6, finding 2: "Plan basics, Pages, Your data, then "PC connection" and "AI assistant" folded with a one-line status". |
| T2 | the everyday Settings screen stays short | owner | `docs/FEEDBACK.md` F-010: "owner's call (asked directly): collapse the full page on/off list behind an "Advanced" section, so the everyday Settings screen is short". Built as one fold per topic. |
| T3 | sources and method notes are in one fold at the end, not beside each figure | owner | Log 2026-09-15 round 17 (Assumptions): "one plain line + "Default: 3%" per field, all sources in one fold at the end". Log 2026-09-16 pass 4 (How much to take out): "tags into a "Where these methods come from" fold". |
| T4 | a developer message is behind "Show details" | owner | Log 2026-09-15 round 1, finding 1: "plain sentence + "Show details" expander". |

### 1.5 What stays on the first view (may not be folded away)

These follow from decisions already made. A "less is more" pass that hides any of them undoes a decision.

| id | stays visible | status | source and quote |
|---|---|---|---|
| V1 | the answer comes first, as the headline | owner | Log 2026-09-15 round 13 (Emergency fund): "fund card first with "26 months covered" as the headline, tiles after". Log 2026-09-16 pass 3 (Import): "results first". Log 2026-09-15 round 18 (Ledger): "totals first". `AGENTS.md`: "Every page: a short intro or hero when empty, real numbers only when there are numbers". |
| V2 | an empty page says what to do first | rule | Rule 14: "Empty states explain what to do first instead of showing zeros and empty tables." |
| V3 | an empty list keeps its add form open | owner | Log 2026-09-15 round 4 (Net worth), finding 3: "first visit with no accounts keeps the form open; Edit opens it filled in; Cancel folds it". `AGENTS.md`: "the form stays open only while the list is empty". |
| V4 | Net worth rows keep Edit and Delete | owner | Log 2026-09-15 pass 2 round 4, finding 1: options "A) tap the row to edit, Delete inside the form  B) keep both buttons, smaller, right-aligned on the name line". "Owner chose: B (buttons keep the 44 px height with narrow padding; balance moves to the second line)". Tucking row actions away was offered and declined on this page; do not make it the app-wide pattern without asking. |
| V5 | a zero or missing figure is said in words; the tile is not dropped | owner | Log 2026-09-15 round 4, finding 4: chosen "A) plain words at zero, $0 parts hidden otherwise", not "B) hide the tile until something is invested". Round 17: a "not yet" tile became a notice. Pass 2 round 5: ""No accounts or entries yet." until there is something". |
| V6 | every confirmation and every error | owner | Log 2026-09-15 round 6, Rule: "every save/add/remove confirms with a green notice; errors are red and say what to do next." |
| V7 | a warning sits where the eye is and leads to the fix | owner | Log 2026-09-15 round 9 (People), finding 3: ""Change it" becomes a tap that scrolls to the Taxes card". Round 16 (Goals), finding 3: "the goal name in the warning is a tap that opens its form + "Tap it to pick another." + a "check account" pill on the row". |
| V8 | the grey line that says figures rest on our guesses | rule | `docs/CONVENTIONS.md`: a page with `restsOn` gets "one muted row ("Some of this uses our guesses: ... ›") linking to the guesses page", drawn by the shell. |
| V9 | the action a link promised | owner (2026-11-11) | The stress test the owner asked for ("easy to know next step ... to focus correctly"): a page opened from Needs attention or a guide step shows its action on the first screen (`docs/TEAM.md`, claude-f's row: "an action on the first screen when Needs attention opens them"; `frame.js` opens the fold a step names, `opens`). A fold may hold the action only if every address that lands on it opens the fold. |
| V10 | full sentences, not cut-off ones | owner | Log 2026-09-15 round 3 (All pages), finding 1: chosen "A) full sentence", not "B) three lines". Truncating with an ellipsis is not the way to make a row shorter. |

### 1.6 Folds, toggles and forms

| id | a design passes when | status | source and quote |
|---|---|---|---|
| F1 | a page with data folds its add form behind an outlined "+ Add another ..." | owner + rule | `AGENTS.md`: "A page that already has data folds its add form behind an outlined "+ Add another ..." button". Chosen page by page: Net worth, People (""+ Add another person" and the open form live inside the Household card"), Income, Expenses, Goals, Budget ("+ Add another envelope"), Rules ("+ Add a rule"), Categories ("+ Add a category"). |
| F2 | a row is edited where it is | owner | Log 2026-09-15 round 14 (Debts): ""Edit ›" on each row, the form opens inside the list card". Rounds 15 and 16 give Income, Expenses and Goals ""Edit ›" rows". |
| F3 | the part just saved stays open | owner | Log 2026-09-16 pass 4, finding 4 (Social Security): "one fold per person, first open, the one just saved stays open". Wave 1 keeps every section the person opened across a redraw, Back and reload (`w1/plan-place.md`, M6: "the page wins where it now draws a fold differently"). |
| F4 | long repeats are one line; the first group is open, the rest folded | owner | Pass 4 (Year by year): "one collapsed row "2059 to 2085: nothing left; about $73,516 short every year"". Pass 2 round 9 (Forecast): "grouped by month, first month open, others folded". Round 19 (Categories): "count only when used". |
| F5 | chips are few, wrap, and never scroll sideways; many choices are a dropdown | owner | Log 2026-09-15 round 7 (Docs), 14 choices: chosen "A) one "Which document" dropdown with plain names", not "B) chips in one scrolling row". `AGENTS.md`: "Never let a row scroll off the right edge of a 390 px screen." |
| F6 | suggestions step back once the person has started | owner | Log 2026-09-15 pass 2 round 7 (Ask the plan): "intro shrinks to one line, chips fold behind "Suggestions", newest answer scrolled into view". |
| F7 | what Save writes does not depend on whether a fold is open | rule | `docs/CONVENTIONS.md`, Guesses: "**Never create, except from a box the person saw.** Only a save of a box shown blank with our grey figure writes a guess". And: "**Typed wins.** Any figure the person types, equal to ours or not, ends the guess". A box inside a closed fold was not seen. So a form that folds boxes must (a) keep a folded box's stored value untouched, (b) decide once whether a folded blank box may write a guess, and (c) give the same result with the fold open or shut, in the simple view or with a "show everything" setting on. Otherwise opening a fold changes the plan at the next Save, which R6 forbids. |
| F8 | an error inside a fold opens it | reading + fact | R5. Fact: a `required` box inside a closed `<details>` cannot take focus, so the browser stops the save without showing anything. Today one form (`goals/goals`) opens its fold on an `invalid` event (`opt/inventory.md`, fact 2). |
| F9 | changes are saved on Save or on leaving a box, never per keystroke, and only through the store | rule | Rule 4: "`view.js` changes the plan only through `ctx.store.update(draft => ...)`, and commits on save/blur, never per keystroke (the shell re-renders the page after each update)." A fold toggle is not an update. Six views call `store.update(() => {})` only to redraw (`w1/plan-place.md` M6); that trick may not be used for folds. |
| F10 | boxes are at least 16 px; money boxes take "4,500" and "72k" | rule | `docs/CONVENTIONS.md`: "Every box is at least 16px: an iPhone zooms the whole page into a box with smaller text". Money through `ui.form` type `money` or `ui.moneyBox`. Percent fields take fractions in `values`. |
| F11 | a button that cannot act yet looks disabled; file pickers are app buttons | owner | Log 2026-09-15 pass 2 round 8, Rule: "disabled buttons look disabled (base.css does it for every button)". ""Choose a PDF or picture" + "Take a photo" buttons with the file name beside them". |
| F12 | a fold's summary is a 44 px target with plain words and, where it helps, a one-line status | rule | 44 px rule below; T1's "one-line status in the summary". The classes exist: `.fold`, `.folds`, `.fold-card`, `.fold-title`, `.fold-status`, `.fold-chev`, `.toggle-row`, `.chips`, `.chip` in `core/ui/base.css`. |

### 1.7 Lists, tables, figures and charts on a phone

| id | a design passes when | status | source and quote |
|---|---|---|---|
| L1 | a table is a stacked record under 720 px | owner + rule | Log 2026-09-15 round 4, finding 1: chosen "A) stacked record per account under 720 px, table on desktop", not "B) keep the table with a swipe hint". `AGENTS.md`: "render the `ui.table` inside `.only-wide` and a `.records` list (title + value on the first line, details under, actions in `.rec-foot`) inside `.only-narrow`". A "show all columns" option must still be records on a phone. |
| L2 | big figures go through `ui.stat` | owner + rule | Round 4, finding 2: "long figures step down a size and wrap only after a comma". `AGENTS.md`: "do not put raw money in a bare heading". |
| L3 | a page shows about four tiles and says the rest in a sentence | owner | Log 2026-09-16 pass 3 round 1 (Expenses, "six tiles" was the finding): "four tiles + one sentence for next year and one-time costs". The only owner-chosen number for "how many figures at once". |
| L4 | units are words | owner | "amount on top, "a month" / "one time" in small text under it" (rounds 15, 16); "3 years 10 months", "$75 a month required", "Debt-free by July 2030" (pass 2 round 10); "2 transactions" (round 18); "whole numbers for typed amounts (bank amounts keep cents)" (pass 2 round 9). |
| L5 | months are whole months; one decimal only under 2 | owner | Log 2026-09-15 round 13, finding 3. Confirmed 2026-11-12: the reviewer withdrew a finding because "Whole months on that page are the owner's choice" (`docs/WORKBOARD.md` 14:30 UTC). |
| L6 | rows that ended say "ended" or "not yet" | owner | Log 2026-09-16 pass 3 round 1, finding 2. |
| L7 | charts are drawn at phone size, and an empty chart is a sentence | owner | Log 2026-09-16 pass 4, finding 1: "phone-size drawing (labels 11 px), capped at 560 px on desktop, a sentence instead of an empty chart". Forecast (pass 2 round 9): "a balance line with the lowest day marked, month labels, a red band only below zero, touch readout". |

### 1.8 Phone, look and words

| id | a design passes when | status | source and quote |
|---|---|---|---|
| P1 | it is judged on a 390 px phone, from a screenshot | rule | Rule 13: "`node tools/shot.mjs <group>/<id>` ... then Read the PNG in `shots/`. Do this before saying a page is done. The owner reads the app on a phone: 390 px wide, thumbs, no jargon." |
| P2 | every tap target is 44 px, links that act included | owner + rule | Log 2026-09-15 round 5 (all three raised to 44 px); 2026-09-16 pass 4 round 2 (an inline link became an outlined button). `qa/smoke-all.mjs` and `qa.smallTargets(44)` check it. Open: prose links, F-027 (O3). |
| P3 | 15 px base text; pills 12 px text, 20 px tall | owner + rule | `AGENTS.md`; log 2026-09-15 round 10, finding 2. |
| P4 | one accent; green, amber and red only mean good, attention, bad; text on the accent is `var(--on-accent)` | owner + rule | `AGENTS.md`; log 2026-09-15 round 11. A "changed by you" mark may not borrow green, amber or red. |
| P5 | no new global CSS | rule | Rule 6: "Use `core/ui/base.css` classes; scope anything extra inside the module's root element." |
| P6 | every word is plain | owner + rule | Rule 14: "Page titles, labels, purposes and help text are plain words ("what you own", not "assets"; spell out RMD, DTI, IRMAA...)". The owner, 2026-11-06: "Just make sure a layman can easily understand and use the page." More detail means more figures, never harder words. |
| P7 | one name for one thing | skill | Design-review skill: "same words for the same thing everywhere". `opt/inventory.md` counts eight spellings for "this figure is yours" and five markup variants of a fold summary. |
| P8 | it is not slow | skill | Design-review skill: "Nothing is perfect if it is slow". |

### 1.9 Code rules a design has to fit

| id | rule | source |
|---|---|---|
| K1 | Numbers do not depend on what is open. `compute.js` is pure and takes the plan; a view state never reaches it. | Rules 3 and 5; `docs/PLAN.md` principle 2 |
| K2 | Device state is not plan data. Anything added to the plan is an optional field, written into `docs/DATA_MODEL.md` in the same change. | Rule 7; R6 |
| K3 | "A device setting" lives in `modules/system/settings`. | `AGENTS.md` "When the owner asks for something"; `docs/CONVENTIONS.md` "Where things go" |
| K4 | No new place for a token or a secret. | Rule 10 |
| K5 | Defaults work with nothing configured. | `docs/PLAN.md` principle 7: "No properties file, no server, no AI: the HTML still opens and the pages still compute." |
| K6 | Every module keeps its tests; `npm test && npm run check` are green before stopping. | Rule 8; six steps |
| K7 | One change, one CHANGELOG line; the catalog stays true; the module README is updated. | Rules 9 and 12 |
| K8 | Examples use the invented households in `qa/`. | Rule 15 |
| K9 | `main` moves only by `git push` through the gate. | Rule 16; section 4.3 |

### 1.10 Process a build has to follow

| id | what | source |
|---|---|---|
| G1 | Claim every `view.js` in `docs/TEAM.md` "Now editing" before touching it; delete the row when done. "A claim older than a day is stale: ignore it." | `docs/TEAM.md` rule 2 |
| G2 | `view.js` of usable pages is the designer's lane ("the builder leaves layout and wording of existing usable pages to the designer"). A builder works there only on the owner's request and with a claim row that names the files, as every row in the table does today. | `docs/TEAM.md` rule 1 and the table |
| G3 | The design log is "Written by the design-review loop ... and by anyone who changes the look on purpose." Only what the owner chose is written as "Owner chose". A builder's choice is marked as such, as the 2026-11-12 entry does. Wave 1 went further and wrote its own choices in `docs/PLAN.md`, not the log ("`docs/DESIGN_LOG.md` stays the owner's record and gets nothing"). | Log header; `w1/plan-place.md` section 7 |
| G4 | Nothing in the log is undone or offered again: "Do not undo or re-propose anything there." | `AGENTS.md` "Design decisions already made" |
| G5 | Shared files are append-only and re-read before every edit (`CHANGELOG.md`, `docs/MODULE_CATALOG.md`, `AGENTS.md` "Design rules", `docs/TEAM.md`). `modules/registry.js` is generated. | `docs/TEAM.md` rule 3 |
| G6 | "Never leave the app broken." Finish a page before it shows; `node --check` every JS file touched. | `docs/TEAM.md` rule 4 |
| G7 | Anything that writes data in a test runs in the sandbox. | `docs/TEAM.md` rule 6 |
| G8 | Before every push: `npm run registry`, `npm test`, `npm run check`, `node tools/leak-guard.mjs --worktree`, pull with rebase, push. Never force-push, never amend pushed commits. | `docs/WORKBOARD.md` "Before every push" |
| G9 | At the start of every phase: fix builder items in `docs/FEEDBACK.md`, read new log entries, run `node qa/smoke-all.mjs`. | `AGENTS.md` "Start of every phase" |
| G10 | Read `docs/WORKBOARD.md` before every page and after every pull; post a status line every few pages. | `docs/WORKBOARD.md` header |
| G11 | Tests and tools pin some fold titles and words (14 titles, the Settings switch label, guide steps that name a fold in their `ask` and `opens`). A rename is a change to those files too; `modules/overview/guide/journeys.js` is under claude-f's claim. | `opt/inventory.md` section 6; `journeys.js:315-316` |

### 1.11 Open points the spec has to settle (not decided here)

- **O1. "More on this" or "Go deeper".** The log of 2026-11-06 names the pages' own links card "More on this" (37 views
  already say it). The log of 2026-11-12, in the builder's reading, says "Deeper pages are reached by "Go deeper"
  links". Both stand. What is fixed: the card is never "Next", and it is not the page's way on (N2). The spec has to
  say whether "Go deeper" is a second name, a link inside "More on this", or a rename that needs the owner.
- **O2. Does a folded blank box write a guess?** F7. A conventions decision, to be written into `docs/CONVENTIONS.md`.
- **O3. Prose links under 44 px.** F-027 is open for the designer: "prose links are a known exception: decide and note
  the rule". A quiet text link "Show 2 more numbers" is exactly such a link; make it a 44 px row or button.
- **O4. Printing.** F-035 is open: "there are no print styles". A closed `<details>` does not print its content. The
  reports print through their own sheet (`modules/reports/report-kit.js`) and are not affected.
- **O5. Drawing the numbers.** F-024 is open for the designer: a "since last time" line under Net worth, small charts.
  It adds to first views; under the new rule it belongs behind the answer, not before it.
- **O6. The emergency-fund goal.** F-034 is open for the owner (options A, B; C is built as a tick, "This goal is my
  emergency fund"). It is a toggle that changes what is counted, so it is plan data with a confirmation, not a view
  toggle. A design may move the tick but not decide A or B.
- **O7. Pages that land without a filled button.** claude-g, 2026-11-12: "Emergency fund and Goals have no filled
  button on the first screen when Needs attention opens them (their move cards are the action; left for a design
  review)". Open for whoever redesigns those first views.

---------------------------------------------------------------------------------------------------------------------

## 2. Every page, by who may edit it now

`docs/MODULE_CATALOG.md` at the tip lists 161 pages: 159 `usable`, 2 `planned` (`transactions/connect`,
`system/devices`). The catalog has no lane column; lanes come from `docs/WORKBOARD.md` (the three original lanes and the
start lines of the helper sessions) and claims from the table "Now editing" in `docs/TEAM.md`. The manifests agree with
the catalog on every status.

| group | pages | may claude-b edit them now | until when |
|---|---|---|---|
| free (2.5) | 126 | yes, after adding its own claim row | - |
| in claude-b's own in-flight worktrees (2.4) | 11 | not in the optional-detail build; they are being changed elsewhere and would collide | until each part's commit is on the shared branch |
| claimed by claude-f (2.3) | 11 | no | until claude-r's round 8 is clean and claude-f removes its rows; by `docs/TEAM.md` rule 2 the rows are stale from 2026-11-13 02:46 UTC |
| claude-a's (2.2) | 13 | never; hand-over only | until the owner says otherwise |

### 2.1 What the claim table says, row by row (`docs/TEAM.md` at 737fb6a)

| row | who, since | files | state |
|---|---|---|---|
| 1 | claude-b, 2026-11-11 | wave 1: `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`, `modules/overview/guide/frame.js`, "a new small file under `core/`"; "no view.js in this wave" | **Held.** "claim goes when the wave's commits land". Built in three worktrees, not combined or verified (hand-over `STATE.md`, section 3). The worktrees also change `modules/overview/pages/view.js` and its README, add `core/place.js`, `core/address.js`, `core/taps.js`, `core/ui/checks.js`, `core/ui/undo.js`, and edit `tools/check.mjs` and `docs/CONVENTIONS.md`. |
| 2 | claude-b, 2026-11-11 | the retirement request: `modules/retirement/levers.js`, `core/ofx.js`; views of `retirement/projection`, `retirement/contributions`, `scenarios/goal-seek`, `scenarios/sensitivity`, `system/assumptions`, `ai/reader`, `transactions/import`; "also these pages' compute, README and tests"; `cashflow/paycheck/compute.js`, `career/benefits/compute.js`; `docs/DATA_MODEL.md` | **Held.** "each part is released when its commit lands". Built, in fix and re-check rounds, not landed. The worktrees also change `career/benefits/view.js`, all four files of `estate/legacy`, and `transactions/connect/module.js` and README, which the row does not name. |
| 3 | claude-f, 2026-11-11 | `modules/taxes/withholding/**`, `modules/estate/documents/**` | **Unclear, treat as held.** claude-f wrote on 2026-11-12 01:40 UTC "MR-7's landing pages done ... claim row removed", but the row is in the file at the tip, and `estate/documents` is in row 5 too. |
| 4 | claude-c, 2026-11-11 | loans: views of `balance/liabilities`, `overview/setup`, `overview/guesses`, `balance/net-worth`, `debt/mortgage`, `property/home`, `retirement/projection`, `retirement/fire` | **Released in effect.** The row ends "Released when merged." Merged as 658c5b8. The row was not deleted. |
| 5 | claude-f, 2026-11-11 | `modules/overview/{dashboard,plan,start,next-best-action,monthly-review,alerts,health-score,guesses}/**`, `modules/overview/guide/**` except `frame.js`, `modules/estate/documents/**` | **Held.** claude-f, 2026-11-12 02:46 UTC: "Claim rows kept in docs/TEAM.md until a clean round." claude-f is stopped by the weekly usage limit and claude-r owes round 8 (hand-over `STATE.md`, section 5; the week resets 2026-11-19 08:00 UTC). |
| 6 | claude-c, 2026-11-11 | Social Security and guesses: views of `overview/setup`, `retirement/social-security`, `cashflow/income` | **Released in effect.** "Released when merged." Merged as ee09f6e. |
| 7 | claude-c, 2026-11-11 | left over each month: views of `overview/setup`, `cashflow/expenses`, `cashflow/budget-percent`, `retirement/fire`, `overview/dashboard`, `reports/statements` | **Released in effect.** "Released when merged." Merged as cb820f2. |
| 8 | claude-c, 2026-11-11 | the phone link: `system/backups/view.js`, `system/audit/view.js`, `index.html`, `core/app.js`, `core/heal.js`, `core/api.js`, `core/store.js`, `core/schema/migrate.js` | **Released in effect.** Landed as 5614682; the row has no release clause and was not deleted. |

Rows 4, 6, 7 and 8 should be deleted (or replaced) by whoever claims those files next, so the table is true again.
The helper sessions claude-d, claude-e, claude-g and claude-h removed their rows; claude-e and claude-h are idle with
one small item each still owed (see the notes in 2.5).

Shared files, not pages:

| file | who may write it now |
|---|---|
| `core/ui/base.css`, `core/ui/dom.js`, `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `modules/overview/guide/frame.js` | wave 1 only, until it lands |
| `core/view.js`, `core/features.js`, `core/words.js` | not claimed; the builder's lane |
| `modules/overview/guide/journeys.js` | claude-f (row 5) |
| `docs/DATA_MODEL.md`, `docs/MODULE_CATALOG.md`, `docs/CONVENTIONS.md`, `CHANGELOG.md` | everyone, append and keep both sides; the retirement request and wave 1 both have unlanded edits to the first three |
| `docs/DESIGN_LOG.md`, `AGENTS.md` "Design rules" | the designer, and "anyone who changes the look on purpose" |

### 2.2 claude-a's 13 folders: never edited, hand-over only

| page | title | last commit in the folder | own card still headed "Next" |
|---|---|---|---|
| `goals/emergency-fund` | Emergency fund | 2026-10-30 | no |
| `goals/vehicle` | Vehicle | 2026-11-02 | yes |
| `goals/travel` | Travel and events | 2026-10-30 | yes |
| `goals/charitable` | Giving | 2026-10-30 | yes |
| `debt/student-loans` | Student loans | 2026-10-30 | yes |
| `debt/consolidation` | Consolidation | 2026-10-30 | no |
| `taxes/state` | State | 2026-10-30 | yes |
| `taxes/self-employment` | Self-employment | 2026-10-31 | no |
| `taxes/filing-status` | Filing status compare | 2026-10-30 | no |
| `taxes/documents` | Tax documents checklist | 2026-10-30 | yes |
| `balance/projection` | Net worth projection | 2026-10-30 | yes |
| `balance/statement` | Balance sheet | 2026-10-30 | no |
| `cashflow/statement` | Cash-flow statement | 2026-11-02 | no |

Facts a build plan needs about these 13:
- The rule is claude-b's standing instruction and its practice: every change since 2026-11-07 went to claude-a as a
  file in `docs/handoffs/` plus a line in `docs/WORKBOARD.md`. (On 2026-11-02 claude-b made two cross-page compute fixes inside
  `goals/vehicle` and `cashflow/statement`; no view was touched.)
- claude-a's last message on the workboard is dated 2026-10-30 21:00, and its own last commits in these folders are
  from 2026-10-30 and 2026-10-31. Five hand-overs are waiting unanswered: `2026-11-07-wording-claude-a.md` (200
  lines), `2026-11-11-touch-claude-a.md` (37 findings), `2026-11-11-loans-claude-a.md`, `2026-11-11-ssg-claude-a.md`,
  `2026-11-11-left2-claude-a.md`. Seven of the pages still head their links card "Next", which the log of 2026-11-06
  already asked to rename.
- So a hand-over for the new rule will very likely not be applied soon. The plan should say so to the owner, keep
  these 13 out of any count that "may only go down", and not build a shared helper whose benefit depends on them.
- What does reach them with no edit: anything the shell or the kit does for every page (wave 1's place memory keeps a
  native `<details>` open; a device setting read by the shell). What does not: reordering a page, folding a form,
  renaming a summary.
- The hand-over format that exists (`docs/handoffs/2026-11-11-touch-claude-a.md`): per item "To see it", "Seen",
  "Should", "Cause" with file and line, and a proposed fix; a short "How to work through it" on top; one workboard
  line `claude-b -> claude-a` that names the file. `tests/wording.test.mjs` shows how a test can list these folders
  (`CLAUDE_A_LANE`) and report their items as to-do instead of failing.

### 2.3 Claimed by claude-f (11 pages)

| page | title | status | other row on it | role on the path |
|---|---|---|---|---|
| `overview/dashboard` | Dashboard | usable | also a landed claude-c row (left2) | leads the way |
| `overview/plan` | Your plan | usable | - | leads the way (the end of the path) |
| `overview/start` | Get started | usable | - | leads the way |
| `overview/guesses` | Our guesses for you | usable | also a landed claude-c row (loans) | - |
| `overview/guide` | Step by step | usable | - | the guide's own page (no way-on row) |
| `overview/alerts` | Needs attention | usable | - | - |
| `overview/next-best-action` | Next best action | usable | - | - |
| `overview/health-score` | Plan health score | usable | - | - |
| `overview/monthly-review` | Monthly check-in | usable | - | - |
| `taxes/withholding` | Withholding check | usable | - | - |
| `estate/documents` | Estate documents | usable | - | - |


These are the pages a person sees most: the Dashboard, Get started, Your plan and the check-in. They are where "less
is more" shows first, and they are the ones claude-b cannot edit today. The honest options for a plan: wait for the
round to close; write to claude-f and claude-r on the workboard and take the rows over once they are stale (from
2026-11-13 02:46 UTC, one day after 941dedd, the last commit made under them); or have the owner or claude-b, who
started those sessions, close them. `overview/guesses/estimators/*` was outside claude-f's lane when it started, but
row 5 says `guesses/**`.

### 2.4 In claude-b's own in-flight worktrees (11 pages)

| page | title | status | what is being changed, and where | role on the path |
|---|---|---|---|---|
| `overview/pages` | All pages | usable | wave 1: `view.js`, README (its taps part) | - |
| `transactions/import` | Import | usable | the retirement request: compute, view, module.js, README (L8) | - |
| `transactions/connect` | Bank connections | planned | the retirement request: module.js, README (planned page) | placeholder (planned) |
| `retirement/projection` | Will the money last? | usable | the retirement request: view, README (L2, L4, L5); also a landed claude-c row (loans) | path step + result |
| `retirement/contributions` | Retirement contributions | usable | the retirement request: all four files (L3, L6) | - |
| `estate/legacy` | Legacy goals | usable | the retirement request: all four files (built with L1; not named in the claim row) | - |
| `career/benefits` | Work benefits | usable | the retirement request: compute, view, README | - |
| `scenarios/goal-seek` | Goal seek | usable | the retirement request: all four files (L1) | path step + result |
| `scenarios/sensitivity` | Sensitivity | usable | the retirement request: all four files + module.js (L1) | - |
| `ai/reader` | Document reader | usable | the retirement request: all four files (L7) | - |
| `system/assumptions` | Assumptions | usable | the retirement request: all four files (L5) | - |


The retirement request applies the new rule in its own fix rounds (hand-over `STATE.md`: "apply the simple-first rule
(log `optional.md`)"), so its pages are not to be redone; after they land, check their fold words against the spec's
vocabulary. `cashflow/paycheck` is free as a page (only its `compute.js` and README change there).

### 2.5 Free for claude-b now (126 pages)

"Last worked in wave 2 by" names the helper session that fixed touch findings on the page on 2026-11-11 and 12. Those
sessions have released their claims, so the column is for telling them, not for asking. "Stale row to clear" marks a
claude-c row that still names the page in `docs/TEAM.md` although its commit landed.

**overview** (4)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `overview/setup` | Set up my plan | claude-e | claude-c loans, ssg, left2 (landed) | path step 1 (the questions) |
| `overview/quick` | Quick answers | claude-f | - | the guide's own page (no way-on row) |
| `overview/benchmarks` | How am I doing | claude-f | - | - |
| `overview/timeline` | Life timeline | claude-f | - | - |

**household** (5)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `household/people` | People | claude-g | - | - |
| `household/life-events` | Life events | claude-g | - | - |
| `household/documents` | Document vault index | claude-g | - | - |
| `household/contacts` | Contacts | claude-g | - | - |
| `household/calendar` | Money calendar | claude-g | - | - |

**balance** (6)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `balance/net-worth` | Net worth | claude-g | claude-c loans (landed) | result row |
| `balance/update` | Update my balances | claude-g | - | - |
| `balance/accounts` | Account detail | claude-g | - | - |
| `balance/liquidity` | Emergency fund | claude-g | - | path step + result; draws a filled button of its own on a path step (CONVENTIONS, two filled buttons) |
| `balance/assets` | Asset register | claude-g | - | - |
| `balance/liabilities` | Debts | claude-g | claude-c loans (landed) | - |

**cashflow** (11)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `cashflow/income` | Income | claude-g | claude-c ssg (landed) | - |
| `cashflow/expenses` | Expenses | claude-g | claude-c left2 (landed) | path step + result |
| `cashflow/income-statement` | Income statement | claude-g | - | - |
| `cashflow/budget` | Budget | claude-g | - | - |
| `cashflow/budget-percent` | Budget (50/30/20) | claude-g | claude-c left2 (landed) | - |
| `cashflow/recurring` | Bills and regular payments | claude-g | - | - |
| `cashflow/forecast` | Cash-flow forecast | claude-g | - | - |
| `cashflow/sinking-funds` | Irregular expenses | claude-g | - | - |
| `cashflow/paycheck` | Paycheck | claude-g | - | compute.js and README are being changed in the retirement-request worktree (view.js is not) |
| `cashflow/subscriptions` | Subscriptions | claude-g | - | - |
| `cashflow/spending` | Where the money goes | claude-g | - | - |

**transactions** (8)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `transactions/ledger` | Ledger | claude-d | - | - |
| `transactions/rules` | Rules | claude-d | - | - |
| `transactions/categorize` | Categorize | claude-d | - | - |
| `transactions/statements` | Statement reader | claude-d | - | offered only while the computer answers |
| `transactions/reconcile` | Check a statement | claude-d | - | - |
| `transactions/transfers` | Transfers | claude-d | - | - |
| `transactions/categories` | Categories | claude-d | - | - |
| `transactions/duplicates` | Duplicates | claude-d | - | - |

**debt** (5)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `debt/payoff` | Pay off debts | claude-g | - | path step + result; draws a filled button of its own on a path step (CONVENTIONS, two filled buttons) |
| `debt/mortgage` | Mortgage | claude-g | claude-c loans (landed) | - |
| `debt/refinance` | Refinance | claude-g | - | - |
| `debt/credit-cards` | Credit cards | claude-g | - | - |
| `debt/ratios` | What lenders see | claude-g | - | - |

**goals** (4)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `goals/goals` | Goals | claude-g | - | result row |
| `goals/house` | House down payment | claude-g | - | path step + result |
| `goals/education` | Education (529) | claude-g | - | path step + result |
| `goals/prioritizer` | Goal prioritizer | claude-g | - | - |

**retirement** (16)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `retirement/social-security` | Social Security | claude-e | claude-c ssg (landed) | - |
| `retirement/pensions` | Pensions | claude-e | - | - |
| `retirement/annuities` | Annuities | claude-e | - | - |
| `retirement/cash-flow` | Year by year | claude-e | - | - |
| `retirement/withdrawal-strategy` | How much to take out | claude-e | - | path step + result |
| `retirement/withdrawal-order` | Withdrawal order | claude-e | - | - |
| `retirement/roth-conversions` | Roth conversions | claude-e | - | - |
| `retirement/rmd` | Required withdrawals | claude-e | - | path step + result |
| `retirement/monte-carlo` | Chance the money lasts | claude-e | - | - |
| `retirement/historical` | If history repeated | claude-e | - | - |
| `retirement/sequence-risk` | Order of returns | claude-e | - | - |
| `retirement/healthcare` | Healthcare before 65 | claude-e | - | - |
| `retirement/medicare` | Medicare and IRMAA | claude-e | - | - |
| `retirement/longevity` | How long to plan for | claude-e | - | - |
| `retirement/fire` | Financial independence | claude-e | claude-c loans, left2 (landed) | claude-e (idle) still owes one small view fix here (blank band, view.js:112, :129) |
| `retirement/buckets` | Bucket strategy | claude-e | - | - |

**investments** (14)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `investments/holdings` | Holdings | claude-h | - | claude-h (idle) still owes N10/N11 here (view.js:66, :74) |
| `investments/allocation` | Allocation | claude-h | - | - |
| `investments/rebalance` | Rebalance | claude-h | - | - |
| `investments/fees` | Fees | claude-h | - | - |
| `investments/performance` | Performance | claude-h | - | - |
| `investments/dividends` | Dividends | claude-h | - | - |
| `investments/asset-location` | Asset location | claude-h | - | - |
| `investments/glide-path` | Stocks by age | claude-h | - | - |
| `investments/risk` | Risk | claude-h | - | - |
| `investments/backtest` | Backtest | claude-h | - | - |
| `investments/tax-lots` | Tax lots and harvesting | claude-h | - | claude-h (idle) still owes N10 here (compute.js:183-187) |
| `investments/employer-stock` | Employer stock | claude-h | - | - |
| `investments/crypto` | Crypto | claude-h | - | - |
| `investments/limits` | Contribution limits | claude-h | - | - |

**taxes** (6)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `taxes/federal` | Federal estimate | claude-h | - | path step + result |
| `taxes/capital-gains` | Capital gains | claude-h | - | - |
| `taxes/brackets` | Bracket explorer | claude-h | - | - |
| `taxes/estimated` | Estimated payments | claude-h | - | - |
| `taxes/projection` | Tax, year by year | claude-h | - | - |
| `taxes/hsa-fsa` | HSA and FSA | claude-h | - | - |

**insurance** (8)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `insurance/policies` | Policies | claude-h | - | - |
| `insurance/life-needs` | Life insurance needs | claude-h | - | path step + result |
| `insurance/term-vs-permanent` | Term vs permanent | claude-h | - | - |
| `insurance/cash-value` | Cash-value model | claude-h | - | - |
| `insurance/disability` | Disability | claude-h | - | - |
| `insurance/health` | Health plan compare | claude-h | - | - |
| `insurance/ltc` | Long-term care | claude-h | - | - |
| `insurance/property` | Auto, home, umbrella | claude-h | - | - |

**estate** (5)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `estate/beneficiaries` | Beneficiary audit | claude-h | - | - |
| `estate/estate-tax` | Estate tax | claude-h | - | - |
| `estate/gifting` | Gifting | claude-h | - | - |
| `estate/inheritance` | Expected inheritance | claude-h | - | - |
| `estate/digital` | Digital assets | claude-h | - | - |

**property** (6)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `property/home` | Home | claude-g | claude-c loans (landed) | - |
| `property/rent-vs-buy` | Rent vs buy | claude-g | - | - |
| `property/rental` | Rental analysis | claude-g | - | - |
| `property/vehicles` | Vehicles | claude-g | - | - |
| `property/purchase` | Big purchase planner | claude-g | - | - |
| `property/renovation` | Renovation | claude-g | - | - |

**career** (6)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `career/salary` | Salary and raises | claude-d | - | - |
| `career/equity` | Equity compensation | claude-d | - | - |
| `career/side-income` | Side income | claude-d | - | - |
| `career/business` | Small business | claude-d | - | - |
| `career/offer-compare` | Job offer compare | claude-d | - | - |
| `career/human-capital` | Human capital | claude-d | - | - |

**scenarios** (3)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `scenarios/compare` | Scenario compare | claude-e | - | - |
| `scenarios/stress-tests` | Stress tests | claude-e | - | - |
| `scenarios/advisor-plan` | Advisor's plan | claude-e | - | - |

**reports** (6)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `reports/plan-summary` | Plan summary | claude-d | - | - |
| `reports/statements` | Financial statements | claude-d | claude-c left2 (landed) | - |
| `reports/retirement` | Retirement report | claude-d | - | - |
| `reports/tax` | Tax report | claude-d | - | - |
| `reports/annual-review` | Annual review pack | claude-d | - | - |
| `reports/export` | Export | claude-d | - | - |

**ai** (6)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `ai/assistant` | Ask the plan | claude-d | - | offered only while the AI helper answers |
| `ai/explain` | Explain a page | claude-d | - | offered only while the AI helper answers |
| `ai/categorizer` | Categorizer | claude-d | - | offered only while the AI helper answers |
| `ai/critic` | Plan critic | claude-d | - | offered only while the AI helper answers |
| `ai/glossary` | Glossary | claude-d | - | - |
| `ai/notes` | Voice notes | claude-d | - | - |

**system** (7)

| page | title | last worked in wave 2 by | stale row to clear | notes |
|---|---|---|---|---|
| `system/settings` | Settings | claude-d | - | - |
| `system/docs` | Docs | claude-d | - | builder page (never listed in the household's view) |
| `system/backups` | Backups | claude-d | claude-c static2 (landed) | offered only while the computer answers |
| `system/audit` | Change log | claude-d | claude-c static2 (landed) | offered only while the computer answers |
| `system/devices` | Devices | claude-d | - | placeholder (planned) |
| `system/diagnostics` | Diagnostics | claude-d | - | builder page (never listed in the household's view) |
| `system/help` | Help | claude-d | - | - |

Counts by topic, free pages only: overview 4, household 5, balance 6, cashflow 11, transactions 8, debt 5, goals 4,
retirement 16, investments 14, taxes 6, insurance 8, estate 5, property 6, career 6, scenarios 3, reports 6, ai 6,
system 7. Of the 126, two are builder pages that the household's view never lists (`system/diagnostics`,
`system/docs`), one is a placeholder (`system/devices`), and seven are offered only while the computer or the AI
helper answers; on the owner's phone link (GitHub Pages, no computer) those ten are never seen.

A cut that follows these boundaries, for the plan to accept or change:
- **Now, claude-b:** the 126 free pages, by topic folder. The path's free steps come first because they are the nearest
  thing to the owner's "big picture" (`overview/setup`, `cashflow/expenses`, `debt/payoff`, `balance/liquidity`, `insurance/life-needs`,
  `retirement/withdrawal-strategy`, `retirement/rmd`, `goals/house`, `goals/education`, `taxes/federal`, and the
  result rows `balance/net-worth`, `goals/goals`).
- **After the retirement request lands:** check, do not redo, its 10 pages; then `retirement/projection` and
  `scenarios/goal-seek` complete the path.
- **After wave 1 lands:** anything that needs `core/ui/dom.js` or `core/ui/base.css` (a `more` option in `ui.form`,
  one fold helper, shared classes), and `overview/pages`.
- **After claude-f's rows go:** the 11 pages of 2.3, the Dashboard first.
- **Hand-over:** the 13 pages of 2.2, one file, with the caveat above.

---------------------------------------------------------------------------------------------------------------------

## 3. What the owner has said about simplicity, guidance and depth

In date order. Each quote is copied from the file named. "Where" says where it is recorded, so a spec can cite it.

| date | the owner's words | where | what it led to |
|---|---|---|---|
| 2026-09-15 | (no quote kept) The owner printed the first dashboard, "a wall of 153 links, "$0" tiles, a status pill that overflowed the phone screen", and asked for a layperson's design. "Principles the owner has already confirmed by that review: plain words on screen, see the real page before calling it done, fewer things per screen, phone first." | log, "Baseline before the review loop" | the redesign; rules 13 and 14 |
| 2026-09-15 | "leave as is for now, once built it won't exist" | log, Dashboard round 1, finding 3 | the one declined change of the first review: build progress is not worth polishing, it should go away |
| 2026-09-15 | (asked directly; recorded as) "collapse the full page on/off list behind an "Advanced" section, so the everyday Settings screen is short" | `docs/FEEDBACK.md` F-010 | Settings: one fold per topic. The same day the owner chose "Plan basics, Pages, Your data" first and the connection parts folded last (round 6), which replaced F-010's "the server/AI fields are what a person sees first" |
| 2026-10-31 | "Focus on making it user friendly and easy to use. Maybe have a way to start picking an option of what you want to do (calculator / financial plan / etc...) then guide." | `modules/overview/start/README.md` | Get started, Quick answers, Step by step |
| 2026-11-01 | "It does not look INSANELY user friendly and experience focused." | `CHANGELOG.md`; `modules/overview/start/README.md` | Set up my plan: "seven friendly questions, one per screen" |
| by 2026-11-02 | (the request, as the spec records it) "a layperson can open the app and get through it"; "with no inputs, estimate from the population info we have" | the smart-guesses spec (scratchpad `est/design/SPEC.md`); `modules/overview/guesses/README.md` | grey guesses in empty boxes; "Our guesses for you" |
| 2026-11-06 | "You can do as you please. Just make sure a layman can easily understand and use the page" | the old session's `owner-decisions.md`; two module READMEs | How much to take out rewritten in plain words |
| 2026-11-06 | "What is the link for the user-facing screen? ... the link that I use with GitHub takes me into more of a developer screen, where if I go on the top left and click the three lines, it shows what's ready and not. And I want a user-friendly screen where I can just view what is user-facing." | log, 2026-11-06 | the household's view is the default |
| 2026-11-06 | "things like ask a question or connect your device to PC should not be defaulted on a phone that has no connection to a PC or a way to connect to a PC, right? That's not something a layman would understand." | log, 2026-11-06 | pages that need the computer or the AI helper are offered only while it answers |
| 2026-11-06 | "when a layman clicks on something to go navigate it, at the end of it, there should be a way to go to the next part and the next part and the next part, right? It should be very easy to follow a set of steps to go from point A to point B, where point B is the final plan with everything in it and all the result pages." | log, 2026-11-06 | one path, Next at the end of every page, Your plan |
| 2026-11-07 | "often, people know approximately that their checking goes up say $1k each month and they save occasionally when they have too much in checking ... we can use their leftover estimate to calculate how much will be saved each year." | `modules/overview/setup/README.md` | question 6 offers one number a person knows ("what's left over") instead of a list of spending |
| 2026-11-07 | "Does any page have any wording error?" | `docs/handoffs/2026-11-07-wording-claude-a.md` | the wording sweep |
| 2026-11-11 | "Be extensive and use tons of agents to stress test every single touch and input for usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy to know next step, to go back, to navigate and to focus correctly while understanding. Quality over quantity." | `docs/handoffs/2026-11-11-touch-claude-a.md` | waves 1 and 2; "one next step" on the Dashboard (`modules/overview/dashboard/README.md`: The owner's words: "easy to know next step") |
| 2026-11-11 | "When somebody's going through the plan, if they're short on retirement or something, it should say, okay, well, here's the variables that can change, and you're able to adjust them, because sometimes it may just be a bad sequence of inputs. ... Maybe we say, hey, can you check these numbers? ... You show assumptions, defaults, and then, let them change it and how things could change." | hand-over `STATE.md`, "The owner's words, in full" | L1 to L6 of the retirement request |
| 2026-11-11 | "maybe they have the ability to separate their retirement accounts into different buckets. Like a certain portion will go into Roth, a certain portion into traditional, sometimes in different accounts with different people, if they so choose." | same | L6 |
| 2026-11-11 | "After we finish the initial setup of, okay, we're going to do a big picture. Once we're in the big picture, you can delve deeper and get better analytics and your results, etc." | same | "go deeper" |
| 2026-11-11 | "don't implement this yet if it's not possible, if it's not easy, or if it's not well documented ... Do what makes sense, but user experience is key, and it should also provide valuable insights, right? It's got to be valuable." | same | L7 and L8 only; bank connections not built |
| 2026-11-12 | "Continue and be aggressive with OPTIONALITY. Allow a user to have optionality of complexity. Default to less is more and allow more complexity or toggles. We want subtle optional complexity" | log, 2026-11-12; `docs/WORKBOARD.md` 14:55 UTC | this work |

### What "less is more" means in the owner's words

1. **Fewer things on a screen.** The first complaint was "a wall of 153 links"; the confirmed principle is "fewer
   things per screen"; the asked-for Settings is "short". The one number the owner ever chose for it: four tiles and
   a sentence, where a page had grown to six tiles (log 2026-09-16).
2. **Only what a layperson can understand and use.** Said three times on 2026-11-06 ("a layman can easily understand
   and use the page"). A screen fails when a layperson would not know what a thing is ("That's not something a layman
   would understand"), not only when it is long.
3. **Nothing about the making of the app.** "a developer screen ... what's ready and not" is the opposite of what is
   wanted. Build progress "won't exist".
4. **Ask for the number a person actually knows.** One rough figure ("their checking goes up say $1k each month")
   beats a form of categories. This is the owner's own example of a simple choice before an exact one.
5. **The next step is obvious.** "easy to know next step, to go back, to navigate and to focus correctly". Less on the
   screen serves that; it is not a goal by itself.
6. **Less is not empty.** "it should also provide valuable insights ... It's got to be valuable." A first view that
   hides the answer to look calm fails the owner's test as surely as a wall of boxes. "Quality over quantity."
7. **Friendly, not merely short.** "INSANELY user friendly and experience focused" produced one question per screen
   with big tiles, which is longer in screens and lighter in effort.

### What "deeper" means in the owner's words

1. **An order: setup, then the big picture, then depth.** "After we finish the initial setup ... a big picture. Once
   we're in the big picture, you can delve deeper and get better analytics and your results". Depth is offered after
   the answer, from the answer.
2. **The person's choice.** "if they so choose"; "Allow a user to have optionality of complexity"; "allow more
   complexity or toggles". Depth is never the price of getting the answer.
3. **Quiet.** "subtle optional complexity". The way in does not compete with the one filled button.
4. **Checking before changing.** When an answer disappoints, the first depth is the figures it rests on: "here's the
   variables that can change ... can you check these numbers? ... You show assumptions, defaults, and then, let them
   change it and how things could change." This is depth that must be close to the answer, with the effect shown.
5. **Beside the path, not on it.** Point B is "the final plan with everything in it and all the result pages". The
   path already ends there; deeper pages come after Your plan ("Next result") or from a page's own links.
6. **Chosen at the door too.** "start picking an option of what you want to do (calculator / financial plan / etc...)
   then guide": a quick answer and a whole plan are two depths the person picks between at the start.
7. **Everywhere, not timidly.** "Continue and be aggressive": the owner expects the rule on every screen, which is
   why the 24 pages in sections 2.2 and 2.3 need a stated plan and not silence.
8. **Not at any cost.** "don't implement this yet if it's not possible, if it's not easy, or if it's not well
   documented". Said about bank connections; it is the owner's standing preference for the plain mechanism over the
   clever one.

---------------------------------------------------------------------------------------------------------------------

## 4. An app-wide device setting: what it may and may not do

The workboard (2026-11-12 14:55 UTC) announces "one device setting for people who always want the detail". The owner
did not ask for a setting by name; the owner asked for "toggles" and "optionality of complexity". So the setting is a
builder's proposal that has to fit inside every decision above. This section is the fit.

### 4.1 What exists already, so it is not built twice

| what | where it is kept | what it does | decided by |
|---|---|---|---|
| The household's view or the build view | `localStorage["planner.view"]`, `core/view.js`, `ctx.view.build`; `?view=build`, `?view=user` | hides or shows unfinished pages, build progress and builder pages | log 2026-11-06 |
| Pages on or off | `localStorage["planner.features"]`, `core/features.js`; Settings, "Pages" | turns a page off on this device | `docs/PLAN.md` principle 6: "Everything toggleable. Pages can be turned off per device or server-wide." |
| The menu's "Recent" list | the saved nav state in `core/app.js` | "the 8 pages opened last on this device, Dashboard always first" | log 2026-09-15, pass 2 round 2 |
| Open sections, place and typing | wave 1, `core/place.js`, this tab only (`sessionStorage`) | keeps what the person opened across a save, Back and reload | wave 1's own choices: "Only sections the person opened or shut are kept across a save; the page's own folding wins otherwise"; "never in the plan or on the PC, never across a closed tab or a home-screen relaunch" |
| Journey progress, page notes | the plan (`plan.guide`, `plan.pageNotes`) | follows the household to every device | - |

The gap a device setting would fill is narrow: wave 1 forgets an opened section when the tab closes or the
home-screen app is relaunched, and it never opens a section the person has not opened on that page.

### 4.2 It may

1. **Decide which optional parts start open on this device**, on every page, the next time a page is drawn.
2. **Be kept on the device only**, under a `planner.` key in `localStorage`, read in a try/catch with a fall-back in
   memory, like `planner.view` and `planner.features` (`docs/CONVENTIONS.md`: "with storage unavailable the user view
   shows"). It is then added to "Not in the plan" in `docs/DATA_MODEL.md` (which today lists neither `planner.view` nor
   the nav state).
3. **Sit in Settings**, because "device ones go in `modules/system/settings`" (`AGENTS.md`) and "a device setting |
   `modules/system/settings`" (`docs/CONVENTIONS.md`). By the decisions it is not a technical section, so nothing puts
   it inside "Advanced", whose status line reads "Not needed day to day"; the owner's sentence asks for
   "toggles" and for them to be "subtle". Where exactly it sits is for the spec. What is fixed: "Plan basics" stays first, the technical parts stay
   last and folded (T1), and the everyday Settings screen stays short (T2).
4. **Take effect at once**, by the shell drawing the page again on an event, the way `planner:view` does. No reload.
5. **Confirm itself** with a green notice when changed (V6: every save confirms), in plain words that say what
   will be different.
6. **Yield to the person's own hand.** A section the person opened or shut on a page keeps that state (wave 1). The
   setting sets the starting state only.
7. **Be offered quietly near a fold**, once, in words, if the spec wants a way in besides Settings. It is then an
   outlined control or a text row of 44 px, never filled, and not repeated on every card.
8. **Be set from the address for screenshots and checks** (the precedent is `?view=build`), so both states of every
   page can be shot and swept.
9. **Differ between the two phones of one household.** One partner can want less and the other more. That is the
   point of keeping it on the device.

### 4.3 It may not

1. **Change the plan, or any number.** "Opening or closing anything never changes the plan" (R6). No `store.update`,
   nothing under `plan.meta`, nothing sent to the computer, no "Phone only" on the status pill, no sync question
   between two devices because one of them likes detail. `compute.js` never sees it (K1): every figure, verdict,
   count in Needs attention, health score and row of Your plan is the same either way.
2. **Change what Save writes.** F7: with the setting on, boxes that are folded in the simple view are open. If an open
   blank box writes a guess and a folded one does not, the same tap on Save writes different plans on two phones. The
   form rule of O2 has to hold in both states.
3. **Show anything the household's view hides.** No "soon" pages, phases, ready counts, builder pages, computer, AI
   helper or sync words (H1, H2). "More detail" and "what is still being built" are two different switches and stay
   two: the second keeps its place in Settings > Advanced and its label (H3). The setting may not be named, placed or
   coded so that one implies the other.
4. **Bring builder details onto the screen.** Formula sources beyond the folds already chosen, catalog keys, seeds,
   file names: "never on screen" (H6). The owner declined even a "For builders" fold.
5. **Unfold the technical sections.** "Technical sections ... go last, folded" (T1) holds in both states. The
   connection and AI cards of Settings stay folded and last.
6. **Add a filled button, a bar, a menu, a stepper or a walk.** N1, N3, N4. No switch pinned to the bottom or the top
   of every page; no "Simple | Detailed" tabs that travel across pages.
7. **Change the path or the way on.** The steps, their order, Next, "Next result", the continue row and the pages on
   the path are the same in both states (N2, R7). Detail never adds a step.
8. **Be the only way to reach anything.** R2: in the simple state everything is still one tap away, on the page where
   it belongs. A figure or control that exists only with the setting on fails the rule.
9. **Hide what must stay visible when it is off** (section 1.5), or **hide a changed figure or an error** (R5). In the
   simple state a fold that holds the person's own figure still says so, and an error still opens it.
10. **Be asked at the first open, or default to on.** "Default to less is more." With nothing stored, with storage
    blocked, and after the browser has erased its storage, the app shows the simple state (K5). No setup question
    "simple or advanced?".
11. **Use jargon in its name or let detail mean harder words.** Not "Advanced mode", "Expert", "Pro". Rule 14 holds
    in both states: detail is more figures and more choices in the same plain words. "Advanced" exists once, as the
    name of the technical fold in Settings; using it for this would confuse the two.
12. **Break a phone rule when on.** 390 px, tables as records (L1), 44 px targets, no sideways scroll, big figures
    through `ui.stat`, four-ish tiles per card (L3): all hold with everything open. A page that only passes
    `qa/smoke-all.mjs` in the simple state is not done.
13. **Make a page slow.** If an open fold starts heavy work that a closed one puts off, the setting turns that on for
    every page. The design-review checklist says "Nothing is perfect if it is slow"; measure both states.
14. **Turn pages on or off, or change the menu.** That is "Pages" in Settings and the view (4.1). The menu lists the
    same ready pages either way.
15. **Reach claude-a's or claude-f's pages by editing them.** It can reach them only through what the shell and the
    kit do for every page (2.2).
16. **Store anything that matters.** On the owner's phone link the storage belongs to the `github.io` address:
    "Safari deletes it after 7 days without a visit in a Safari tab (not for an app added to the Home Screen), and
    every project site of the same GitHub account shares that storage" (`docs/PLAN.md`, section 11). The setting can
    vanish; losing it must cost nothing but one tap, and its key must not collide with another site's.

### 4.4 What the static host adds to "how", from `docs/PLAN.md` section 11

- **Old and new files never run together, and the gate checks it.** `tools/main-gate.mjs` tries "a new ctx field, a
  new export, a dropped export, a style change, a worker change, a change to `index.html` itself". A setting that
  pages read from `ctx` is one of those shapes. Design it so that a missing value reads as "simple": then even a
  mixed open fails safe.
- **A push that changes `sw.js`, `index.html`, `core/heal.js` or `core/app.js` also runs the stall check** (about 3
  minutes), and wave 1 owns two of those files. A setting that lives in `core/view.js` (not claimed, already on `ctx`
  as `ctx.view`, already redrawn on its event; `opt/inventory.md` fact 8) touches none of them.
- **The 11-minute wait.** A push that changes the app is refused while `main` moved less than 11 minutes ago. Small
  batches to `main` cost that wait each time.
- **No computer on the phone link.** `api.base()` is blank there; a setting may not ask the computer for anything.
- **The single-file copy and a sandboxed frame** have no storage that lasts; the choice then lives for the visit
  (`core/features.js` and `core/view.js` already do this).
- **The sandbox shares the device keys.** `planner.view` is the same key with `?sandbox=1`; a new key will be too.
  Checks must set the state they test.

### 4.5 A setting is optional; the rule is not

Every item of sections 1.1 to 1.8 has to pass with the setting off, because off is the default and is all that
claude-a's pages, a fresh phone and an erased phone will ever show. A design that needs the setting to be on for
anyone to be well served has put the complexity in the wrong place.

---------------------------------------------------------------------------------------------------------------------

## 5. What was read

In the read-only copy `opt/app` at 737fb6a:
- `docs/DESIGN_LOG.md`, all 589 lines (every entry from the baseline of 2026-09-15 to 2026-11-12).
- `docs/FEEDBACK.md`, all 35 items. Open at the tip: F-024 and F-027 and F-035 (designer), F-032 and F-034 (owner).
- `docs/PLAN.md`: sections 2 (principles), 5, 6, 11 (devices, "On a static host", "The saved whole copy", the gate
  before `main` moves), 12, 13 (UI and navigation), 14, 18 (decision log).
- `AGENTS.md`: the sixteen rules and "Design rules".
- `docs/CONVENTIONS.md`, whole: the module contract, `ctx`, the two views, the frame, input schemas, guesses.
- `docs/TEAM.md`, whole: roles, rules 1 to 8, the eight claim rows, the notes.
- `docs/WORKBOARD.md`: the branch, lanes, backlog, claims, and every message from 2026-11-06 to 2026-11-12 14:55 UTC.
- `docs/MODULE_CATALOG.md`: all 161 rows, checked against every `module.js` (status, `builderOnly`, `requires`).
- `CHANGELOG.md`: every line that names the owner or a first view.
- `docs/handoffs/`: the five files for claude-a and the five review files of 2026-11-11.
- `.claude/skills/design-review/SKILL.md`; `tests/user-view.test.mjs`; `core/view.js`, `core/features.js`;
  `modules/overview/guide/journeys.js` and `compute.js` (the path's steps and result rows);
  `modules/system/settings/view.js` (section order); READMEs of `overview/start`, `quick`, `plan`, `dashboard`,
  `setup`, `guesses` for the owner's words.

Outside the repository, in the scratchpad (read only): the hand-over `handover/STATE.md` (the owner's request of
2026-11-11 in full; the state of the helper sessions), `owner-decisions.md`, `state-wt/notes/sessions.md`,
`rv/spec.md`, `w1/plan-place.md` (sections 1 summary, M6, 7), `est/design/SPEC.md` (opening), and the sibling report
`opt/inventory.md` (facts 1 to 8, sections 7 and 8), which this report cites and does not repeat. The file lists of
the in-flight worktrees came from `git diff --name-only` and `git status` in `rv/b-ret`, `rv/b-scn`, `rv/b-doc`,
`w1/build-place`, `w1/build-taps`, `w1/build-forms` and `w1/bp/combo`.

Not checked: whether claude-a, claude-f or claude-r have written anything since 737fb6a; whether any claim was changed
on the remote after this copy was made; anything on a screen.
