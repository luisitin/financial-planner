# Backups  (`system/backups`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Lists the backups on your server, shows what changed between them and lets you restore any of them.

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
`sizeOf(plan)`, `changeWords(diff)`, `SECTIONS`.

## Rules
- **A copy's time**: from its name, `plan-YYYY-MM-DDTHH-MM-SS.json`, which the server stamps in UTC
  (`new Date().toISOString()` with ":" and "." replaced); shown in the browser's own time. Other names are left out.
- **What is different** (`diffPlans`, copy -> now), section by section, in the plain names of `SECTIONS`:
  - a list of records with an `id` (or `key`): records added (in now, not in the copy), removed, and changed (same id,
    different content);
  - an object (household, retirement, taxes…): the number of its top-level details that differ;
  - anything else: "changed";
  - `meta` and `schemaVersion` are never counted (they differ on every save).
- **Putting a copy back**: `store.replace(copy)` after a confirm; the store saves it to the PC 400 ms later, and the
  server copies the plan as it was before writing, so the restore can itself be undone from the list. The list is read
  again 1.2 s after a restore (`SAVE_WAIT`) so that copy shows.
- A copy identical to the plan now offers no restore.

## Edge cases
- Not connected to the PC (the plan is saved in the browser only): a card saying so, with a link to Settings.
- The sandbox: a notice that the copies are the real plan's and that putting one back changes only the pretend plan
  (the store keeps the sandbox plan apart).
- The list or a copy cannot be read: a plain error with "Try again" (the technical text under "Show details"), or
  "This copy is damaged and cannot be read."
- No copies yet: says the first one is made at the next save.
- More than 10 copies: the newest 10, then "Show all".
- The page never redraws after you have left it (each async step checks the page is still on screen).

## Tests
`module.test.mjs` (3): a copy's time and the list order; what is different (records added, removed and changed;
object details; a value; `meta` ignored; sections in order; one-sided sections; records keyed by `key`; a section the
app does not name); a plan's size. `tests/server-backups.test.mjs`: the server routes.

## Ideas / not yet
- Show which records changed (names of accounts or goals), not only how many.
- Download a copy as a file.
