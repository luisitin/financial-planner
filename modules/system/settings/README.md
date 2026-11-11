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
