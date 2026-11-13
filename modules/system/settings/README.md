# Settings  (`system/settings`)

**Status:** usable
**Purpose:** connections (PC server URL + token), AI provider settings for this device, page toggles, plan import/export, plan basics (name, currency, locale).

## Inputs
Device settings from localStorage (`planner.connection`, `planner.features`, `planner.more`, `planner.look`) through
`core/api.js`, `core/features.js`, `core/ui/more.js` and `core/look.js`; plan `meta`.

## Outputs
`compute()` reports schema version, size and per-section counts for the Data card.

## Formulas
None.

## Edge cases
The AI card fills in asynchronously (it asks the server for its config first). Its one-line status (2026-11-01) comes from `aiHealth()` (`modules/ai/health.js`, shared with Ask the plan and the Dashboard): "Working", "Not answering", "No model yet", "Model missing" (the model it is set to use is not installed) or "Off" (it read "On, PC settings" while nothing answered); when it does not answer, a plain line says what to do, worded for Ollama or for another service, and an outlined "Try again" asks again. The fold, its place last and its fields are unchanged (design log, Settings round 6). Import replaces the
whole plan after a confirm; the server keeps timestamped backups of every previous save.

## Tests
`module.test.mjs`: section counts.

## Ideas / not yet
- Encryption at rest with a passphrase (see docs/PLAN.md "Security").
- Theme, font size, number rounding preferences.
- Manage devices / revoke tokens once the server supports more than one token.

## Erase and restore (stress test F6, 2026-11-11)
Erase asks with the PC sentence only when a PC holds the plan (`store.backend() === "server"`); otherwise "This is the only
copy and it cannot be undone. Download a copy first...". After the reload Settings says "Your plan was erased from this
device." once (sessionStorage `planner.erased`) with a "Start a new plan" button. Restore names what is replaced (the first
three section counts) and its green notice has Undo (the plan as it was, kept for the visit). A file that is not a plan
copy gets a plain sentence instead of the JSON parser's message.
In the sandbox the question and the notice after the reload both speak of the pretend plan.
A file with `schemaVersion` but the wrong shape is refused before anything is replaced: `planShapeProblem(file, emptyPlan())`
(compute.js) checks every key the file shares with an empty plan, two levels down: a list must be a list and a set of fields a
set of fields (so `household.people: "x"`, `holdings: "oops"`, `meta: "oops"`, `household: null` are refused). Missing keys are
fine (migrate fills them). Before this, `household.people: "x"` restored and then stopped the app from opening at all.
Right after an erase, Plan basics' Save is outlined, so "Start a new plan" is the one filled button on the first screen
(review N5); on a normal visit it is filled again.

## Screen: hide the amounts (2026-11-13, gap design 8)
The third card, a shut row "Screen" drawn by `looks.js` (`lookCard`), holds the tick **"Hide amounts on screen"**. The
same choice is the menu's first row, right under "Find a page": "Hide amounts" / "Show amounts" (`core/app.js`
`hideRow`), two taps from any page with no scrolling. (Built first as the menu's last row; a review on 2026-11-13 found
it under 18 topics, 1,433 px down on a 568 px screen, so it moved up. A test keeps it before the first heading.)
On this phone only: `core/look.js` keeps it in localStorage `planner.look` (`planner.look.sandbox` in the sandbox) as
`{ fmt: 1, hide: 1 }`; nothing is stored while it is off. Never in the plan (`store.update` is never called), never sent
to the computer, never in "Download a copy" (which writes `JSON.stringify(plan)` and nothing else).

How it hides (decided against the gap spec's mechanism, and why):
- The spec had `money()` and `signed()` return dots. They do not: the same functions write the questions sent to the AI
  helper, the files a person downloads and the printout, all of which must keep their amounts, and the browser's print
  event leaves no time to draw a page again. Instead `core/look.js` covers what is drawn: every text node under `<body>`
  is passed through `maskAmounts()` (pure, `core/format.js`) as it appears (a MutationObserver, so an answer worked out
  on the computer, a green line and the bottom note are covered before they are painted), and put back while the browser
  prints (`beforeprint` / `afterprint`) or when the tick is undone.
- `maskAmounts(text)`: a number with a currency sign or code beside it becomes `•••`; the sign or code and a plus or
  minus before it stay. It reads every form `money()` writes for the currencies and formats Settings offers (USD, EUR,
  MXN, GBP, CAD in en-US, es-MX, es-ES: "$1,234", "MX$1,234.50", "USD 1,234", "1.234,50 €", "1234 US$"), the short forms
  pages write by hand ("$2.4M", "$450k", "$1.2 million", "$500-900") and a tile's figure with its wrap points. A number
  with no currency beside it is left: "45%", "2026", "age 67", "3 years".
- `maskAxisLabel(text)`: inside a chart (`<text>` / `<tspan>`), a label that is only a short figure ("418k", "1.3M")
  becomes dots; years, ages and percentages stay. The chart keeps its shape.
- The words a screen reader says for a thing, and what a long press shows (`aria-label`, `title`, `aria-description`,
  `aria-valuetext`, `alt`: `SAID_ATTRS`), are covered the same way and put back the same way, so a tile named "Left over
  each month: $3,884" is not read out loud either (review, 2026-11-13: these were left as they were). An address
  (`href`) and the example inside a box (`placeholder`) are never touched.
- Odd forms a hand-written sentence could carry are read too: the sign after the currency sign ("$-50"), a code tight
  against the figure ("USD1,234"), thousands set off by a space before three digits or by an apostrophe ("$ 1 234",
  "$1'234"), and the codes AUD, NZD, CHF and JPY.
- Boxes (`input`, `select`, `textarea`) are skipped: a form opened on purpose shows its own figures.
- `fmt.hidden()` tells a page the amounts are hidden, for one that draws them some other way than as text. None does today.
- `?look=hide` in the address hides for the visit only (screenshots and checks); never stored.

What it does not cover: an amount written with no currency sign and no "k"/"M" in a chart (a bare "1,234" in a table
cell). A sweep of all 161 household pages with the sample family
found 3,474 amounts covered and none of these in a table; the bare figures left were counts ("1,000 pretend futures").

The green lines (one test each, `tests/look.test.mjs` and `module.test.mjs`): on, "Done. Amounts on this phone now read
as dots. "Show amounts" in the menu brings them back."; off, "Done. Amounts show again." The shut row says "amounts
hidden" while they are. The row stays open on the draw after a tick. "Erase the copy on this device" shows them again
(`forgetLook`, before the plan goes).

The row's name is one word, "Screen", because Settings' first view is at its allowed count on the empty plan (200 words
in `tests/first-view.known.json`; 199 before, 200 now; 213 to 214 with a plan). The spec's name, "How this phone looks",
is plainer and would need that count raised to 210. The row is drawn like Settings' other folded cards, not with
`part()`: one part on the page makes the first-view check treat Settings as drawn with parts and refuse its own folds.

Tests: `tests/look.test.mjs` (the masking, every currency and format, percentages never, the screen pass and its undo,
the key, the sandbox key, the plan's bytes, every page's `compute()` byte-identical with hiding on over the fixture plans
and the invented households) and this module's `module.test.mjs` (the row, the tick, erase).

## How much to show (2026-11-13, opt C7; the owner's "toggles", 2026-11-12 and 2026-11-13)
The second card, after Plan basics, drawn by `show.js` (`howMuchCard`): two ticks, both off on a new phone, on this phone
only, never in the plan (`core/ui/more.js` `detail`, localStorage `planner.more`, `planner.more.sandbox` in the sandbox).
- **"Show how answers are worked out"** (`detail.working`): every part of kind `how` and `more` starts open on every page,
  which is every "How this is worked out" in the app (opt C6 drew the last hand-written ones through the helper) and the
  "N more ..." rows the helper draws. Never a part with boxes (`own`, `figures`), an item, the menu or an add form.
- **"Show every box in forms"** (`detail.boxes`): every `ui.form` "More details (optional)" starts open (the kit's
  `setMoreOpen`, which `core/app.js` hands over with `detail.init(ui)` before each page draws).
- Short (simple first): the title, the two ticks with their words as the label, and "On this phone only; your plan stays
  the same." No line under a tick: what a tick opens is said in green when it is ticked ("Done. ..."), and only what is
  true. The forms tick says "Done. Most forms ..." while two forms still draw their own "More details (optional)" (Goals'
  add form, Quick answers); `module.test.mjs` finds them in the sources and fails when the last one is converted, so the
  words lose "Most" then; it also fails if a hand-written "How this is worked out" comes back.
- A tick acts at once (no Save), says so in green under the ticks, and is undone by the same tick. Ticking
  "Show how answers are worked out" either way forgets the rows a person shut against it.
- `core/app.js` calls `detail.init(ui)` in `show()` before each page draws; a test reads that line in the source (the shell
  needs a browser), since without it a saved forms tick would show ticked here and open nothing.
- When this phone keeps rows a person opened by hand: "N rows you opened stay open on this phone. Each shuts by itself if
  its page goes 90 days without a visit." and an outlined "Shut them all".
- "Erase the copy on this device" forgets all of it too (`forgetShown`), before the plan goes.

Why its own file: Settings draws no optional part, it only reads and writes this device's choices. The first-view check
(`qa/first-view-lib.mjs`) counts a view that imports `core/ui/more.js` as drawn with parts and then refuses every fold
written by hand; Settings' folds (the page topics, Advanced) are the owner's (2026-09-15) and stay as they are. The card
can also be drawn in a Node test without the PC connection and the AI helper the rest of the page needs. If the check
learns to tell the part helpers from the device store, the card can move back into `view.js`.

The card adds 24 words to the first view (Settings 189 to 213 with a plan, 175 to 199 on the empty plan): the counts file
allows 220 with a plan and 200 on the empty plan (was 180 and no plan entry), a rise on purpose, said in docs/DESIGN_LOG.md
2026-11-13. A line under each tick would cost about 26 words more; the green line after a tick says it instead.
