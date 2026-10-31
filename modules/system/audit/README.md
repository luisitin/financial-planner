# Change log  (`system/audit`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Shows what changed in your plan at each save, and when, from the copies your PC keeps.

The PC server copies `data/plan.json` to `data/backups/plan-<time>.json` before every save and keeps the newest
`data.backups` (default 50; `server/server.mjs` `writePlan`). A copy is the plan just before a save, so the copy made
at one save and the next copy (or the plan on the PC now, for the newest save) are the plan before and after that save.
Comparing them in order gives a change log with no new storage. Read-only: putting a copy back is on Backups
(`system/backups`), which this page links to.

## Inputs
- `GET /api/plan/backups` (the copies' names, newest first), `GET /api/plan/backups/<name>` (one copy; the route was
  added with `system/backups`), `GET /api/plan` (the plan on the PC now). The page never writes (`writes: []`).
- `meta.updatedBy` on a plan, when it is there: the device that saved it. Nothing writes it yet; proposed under
  Messages in docs/WORKBOARD.md as a small change to `core/store.js` (a device name typed once in Settings). The
  page shows it as soon as plans carry it.

## Outputs
`compute(plan)` -> `{ savedAt, by }`. Also exported: `changesBetween(older, newer)`, `timeline(steps)`,
`labelOf(record, plan, section)`, `words(field)`, `firstOf(labels, max)`, `NESTED`, `FIELD_WORDS`, and `whenOf` /
`listOf` (from Backups).

## Rules
- **A save's time**: the time in its copy's name, `plan-YYYY-MM-DDTHH-MM-SS.json`, stamped by the server in UTC just
  before it writes; shown in the browser's own time, grouped by day.
- **What one save changed** (`changesBetween`), in the order of the app's sections (Backups' `SECTIONS`):
  - a list of records (each with an `id`, else `key`, `month` or `date`: monthly reviews and net worth history count
    too): the records added, removed and changed, each by name;
  - a section that is an object (household, insurance, retirement…): the details that differ, in words
    (`filingStatus` -> "filing status", or `FIELD_WORDS`), and each list of records inside it (people, insurance
    policies, will and estate papers…) as an entry of its own, named in `NESTED`;
  - anything else (a list without ids, a note): "changed";
  - `meta` and `schemaVersion` never count: they differ on every save.
- **A record's name** (`labelOf`): its own `name`, `payee`, `label`, `title` or `term`; else the account it is about (a
  loan's details; "Statement for <account>" for a checked statement); a paper's checklist name from
  household/documents (`PAPERS`, with the person's name, or the policy's name); a life event's or policy's kind in
  words; else its month or day. A transaction also shows its amount and day. At most three names per line, then
  "and N more".
- **The log** (`timeline`): save *i* (at copy *i*'s time) is copy *i* against copy *i + 1*, newest first. A save where
  nothing you can see changed (only `meta`) is left out and counted. A copy that cannot be read (not JSON, 404) marks
  the two saves beside it as "not readable" instead of merging them.
- **How many**: the newest 10 saves, then 10 more per "Show earlier changes"; copies are read four at a time and kept
  for the visit (a copy never changes). When every copy is shown, the page says the oldest copy's day and that
  changes before it are not recorded.

## Edge cases
- Not connected to the PC: a card saying no changes are recorded, with a link to Settings.
- The sandbox: a notice that the changes listed are the real plan's (the copies and `GET /api/plan` are the PC's).
  The store reports "local" in the sandbox, so the page asks the PC anyway there.
- Two saves in the same second share one copy name (the server stamps to the second), so the PC keeps one copy for
  both and the log shows their changes as one save.
- The list or the plan cannot be read: a plain error with "Try again" (the technical text under "Show details").
- No copies yet: says the first change shows after two saves.
- Each visit starts fresh (the shell's cleanup resets the list and the plan; answers from an earlier visit are
  ignored); the page never redraws after you have left it.

## Tests
`module.test.mjs` (7): records added, removed and changed by name; object details in words; a list inside a section
as its own entry; section order; records keyed by month or day; a section the plan did not have; names (a
transaction's amount and day, a loan's account, a statement, papers by their checklist name, a life event's kind, a
blank name); field words; the log's pairing, newest first, a save with no visible change, the device; a copy that
cannot be read; too few copies; compute.

## Ideas / not yet
- Which device made a change: `meta.updatedBy`, once `core/store.js` writes it (proposed under Messages).
- Before and after values for a detail ("stock returns 7% -> 6%").
- Filter by section, or search a payee across the log.
