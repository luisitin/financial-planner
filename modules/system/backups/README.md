# Backups  (`system/backups`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Earlier copies your PC keeps of your plan: see what changed since one and put it back if something went wrong.

The PC server copies `data/plan.json` to `data/backups/plan-<time>.json` before every save and keeps the newest
`data.backups` (default 50; `server/server.mjs` `writePlan`). This page lists them, shows what is different between a
copy and the plan now, and puts a copy back after a confirm.

## Inputs
The whole plan (`needs: ["*"]`, to compare against a copy); a restore replaces it (`writes: ["*"]`).
Server routes: `GET /api/plan/backups` (the names, newest first) and `GET /api/plan/backups/<name>` (one copy; added
with this page: served only when the name is in the backups folder's own list and looks like `plan-…json`, never a
path; 404 otherwise, 422 for a copy that is not valid JSON; `tests/server-backups.test.mjs` runs a copy of the server
in a temporary folder to check it, path tricks and a malformed name included).

## Outputs
`compute(plan)` -> `{ size }`. Also exported: `whenOf(name)`, `listOf(names)`, `diffPlans(older, newer)`,
`diffCopy(copy, plan)`, `asPlan(json)`, `unstamped(plan)`, `sectionLabel(key)`, `sizeOf(plan)`, `changeWords(diff)`,
`SECTIONS`, `STAMPS`. system/audit uses `SECTIONS`, `sectionLabel`, `unstamped`, `whenOf` and `listOf`.

## Rules
- **A copy's time**: from its name, `plan-YYYY-MM-DDTHH-MM-SS.json`, which the server stamps in UTC
  (`new Date().toISOString()` with ":" and "." replaced); shown in the browser's own time, with seconds when two
  copies share a minute. Other names are left out.
- **What is different** (`diffCopy`, copy -> now). The copy is a file as it was saved, perhaps before the app added a
  section or a default, while the plan in the app has been brought up to date by `core/schema/migrate.js`; so the copy
  is brought up to date the same way first (on a clone), and only real changes show. Then `diffPlans`, section by
  section, in the plain names of `SECTIONS` (a section not named there: its key split into words):
  - a list of records with an `id` (or `key`): records added (in now, not in the copy), removed, and changed (same id,
    different content); anything in such a list that is not a record (a null left by a hand edit) counts as one of
    its own, so the comparison never breaks;
  - an object (household, retirement, taxes…): the number of its top-level details that differ;
  - anything else: "changed";
  - a missing section and an empty one (no records, no details, no text) are the same;
  - `meta` counts without its save stamps (`STAMPS`: `updatedAt`, `createdAt`, `updatedBy`), so a change of the
    plan's name, currency or language shows as "Plan name and currency"; `schemaVersion` never counts.
- **A copy the PC sends** (`asPlan`): an object with a `schemaVersion`; anything else (a file holding `null`, a list)
  is treated as damaged, never compared.
- **Putting a copy back**: `store.replace(copy)` after a confirm; the store saves it to the PC 400 ms later, and the
  server copies the plan as it was before writing, so the restore can itself be undone from the list. The list is then
  read every 600 ms (up to 8 times) until a new newest copy appears; the confirmation says the plan from a moment ago
  is the newest copy only when it is there, else that it will show once the PC has saved it.
- A copy identical to the plan now offers no restore.
- **Each visit asks the PC afresh**: `render` returns a cleanup (the shell runs it before every redraw and every new
  page) that forgets the list, the copy opened, "Show all", and any copy that could not be fetched; a damaged copy
  stays known as damaged.

## Edge cases
- Not connected to the PC (the plan is saved on this device only): a card saying so, with a filled Open Settings.
- The sandbox: the store reports "local" there, so the page asks the PC anyway. A notice says the copies are the real
  plan's; the comparison is labelled "This copy of your real plan" and "Your pretend plan now"; the confirm says the
  pretend plan is filled with the copy and the pretend plan you have now is not kept (no copy of it is made).
- The list cannot be read: a plain error with a filled Try again (the technical text under "Show details"); a 401
  (only reachable in the sandbox, which asks the PC anyway) asks for the PC's access code instead.
- A copy cannot be opened: damaged (422, or not a plan): says so, with Close; no longer on the PC (404, removed as
  newer copies were made): Read the list again; not sent (no network, another status): Try again. Each has Close.
- A copy is fetched once while it loads (a redraw does not ask again); the opened copy sits in a tinted box so its
  changes do not look like more copies.
- No copies yet: says the first one is made at the next save.
- More than 10 copies: the newest 10, then "Show all".
- The page never redraws after you have left it (each async step checks the page is still on screen).

## Tests
`module.test.mjs` (7): a copy's time and the list order; what is different (records added, removed and changed;
object details; a value; sections in order; one-sided sections; records keyed by `key`; a section the app does not
name, in words); the plan's name and currency count, the save stamps do not; an old copy brought up to date shows no
change nobody made, and the copy itself is not changed; missing and empty sections are the same; a null in a list of
records never breaks it; every section of a plan has a plain name; what counts as a plan; a plan's size.
`tests/server-backups.test.mjs`: the server routes.

## Ideas / not yet
- Show which records changed (names of accounts or goals), not only how many (the Change log, `system/audit`,
  names them save by save).
- Download one copy as a file (Settings downloads the plan as it is now).
