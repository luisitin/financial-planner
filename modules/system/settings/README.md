# Settings  (`system/settings`)

**Status:** usable
**Purpose:** connections (PC server URL + token), AI provider settings for this device, page toggles, plan import/export, plan basics (name, currency, locale).

## Inputs
Device settings from localStorage (`planner.connection`, `planner.features`) through `core/api.js` and
`core/features.js`; plan `meta`.

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
