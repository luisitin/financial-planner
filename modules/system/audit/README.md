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
`compute(plan)` -> `{ savedAt, by }`. Also exported: `changesBetween(older, newer)`, `entryFor(from, to)`,
`timeline(steps, { prepared })`, `prepare(plan)`, `labelOf(record, plan, section)`, `words(field, section)`,
`firstOf(labels, max)`, `NESTED`, `FIELD_WORDS`, and `whenOf` / `listOf` / `asPlan` (from Backups).

## Rules
- **A save's time**: the time in its copy's name, `plan-YYYY-MM-DDTHH-MM-SS.json`, stamped by the server in UTC just
  before it writes; shown in the browser's own time (with seconds when two saves shown share a minute), grouped by day.
- **Brought up to date first** (`prepare`): each copy, and the plan on the PC now, goes through the app's own
  `core/schema/migrate.js` once (on a clone), so a section or default the app added after a copy was made is no
  change. A missing section and an empty one (no records, details or text) are the same.
- **What one save changed** (`changesBetween`), in the order of the app's sections (Backups' `SECTIONS`; a section
  not named there: its key in words):
  - a list of records (each with an `id`, else `key`, `month` or `date`: monthly reviews and net worth history count
    too): the records added, removed and changed, each by name; a changed one with the details that differ;
  - a section that is an object (household, insurance, retirement…): the details that differ, in words
    (`filingStatus` -> "filing status", or `FIELD_WORDS`, where `<section>.<detail>` comes first: a loan's `rate` is
    its "interest rate", a goal's "growth per year"), and each list of records inside it (people, insurance policies,
    will and estate papers, gifts, annuities…) as an entry of its own, named in `NESTED` (else "<section>, <list>");
  - page notes: the pages whose note changed ("your note on Net worth", named from the app's page titles); the bank
    file layouts the app keeps: "changed", never their keys;
  - anything else (a list without ids, a note): "changed";
  - `meta` counts without its save stamps (`updatedAt`, `createdAt`, `updatedBy`), so a change of the plan's name,
    currency or language shows as "Plan name and currency"; `schemaVersion` never counts.
- **A record's name** (`labelOf`): its own `name`, `payee`, `label`, `title` or `term`; else what its section says it
  is about: a paper's checklist name from household/documents (`PAPERS`, with the person's name; "Papers for <policy>"),
  a will or other legal paper (estate/documents' names, with the person), a budget's category ("Envelope for
  Groceries"), a gift's receiver ("Gift to …"), a tax form, the day shares were bought, the account (a loan's
  details; "Statement for <account>"), the policy (a beneficiary row); else its kind in words, lower case ("a baby or
  adoption"), its month or its day. Never a key the app made up ("policy:k3x9"). A transaction also shows its amount
  and day. At most three names per line and three details per record, then "and N more".
- **The log** (`entryFor`, `timeline`): save *i* (at copy *i*'s time) is copy *i* against copy *i + 1* (the plan now
  for the newest), newest first. A save where nothing you can see changed is left out and counted. A damaged copy
  (422, or not a plan) marks the two saves beside it as "can't show" (the second says "See the save above") instead
  of merging them.
- **How many**: the newest 10 saves, then 10 more per "Show earlier changes" (the list stays on screen with "Loading
  earlier changes…" while they come, so the page keeps its place). Copies are read four at a time. Each save is worked
  out once per visit; a copy's plan is dropped as soon as both its saves are known (the oldest shown is kept for the
  next ones), so a big plan does not fill the phone's memory. When every copy is shown, the page says the PC keeps only
  the most recent copies, so changes before the oldest one's day no longer show.

## Edge cases
- Not connected to the PC: a card saying the record of changes is on the PC, with a filled "Connect to your PC".
- The sandbox: a notice that the changes listed are the real plan's (the copies and `GET /api/plan` are the PC's).
  The store reports "local" in the sandbox, so the page asks the PC anyway there.
- Two saves in the same second: the server names copies to the second and keeps the first copy of a second (it never
  overwrites one; fixed in `server/server.mjs` `writePlan` with this page), so both saves show as one save.
- The list, the plan or a copy cannot be read (no network, another status): a plain error with a filled Try again (the
  technical text under "Show details"); Try again fetches only what is missing. A copy no longer on the PC (404:
  removed as newer copies were made while the page was open): the list is read again.
- No copies yet: says the first change shows after two saves; one save: "Your last save".
- Each visit starts fresh (`render` returns a cleanup the shell runs before every redraw and page: the list, the plan,
  the copies and the saves are forgotten; answers from an earlier visit are ignored); the page never redraws after
  you have left it.

## Tests
`module.test.mjs` (12): records added, removed and changed by name, with their details; object details in words; a
list inside a section as its own entry; section order; records keyed by month or day; a section the plan did not
have; names (a transaction's amount and day, a loan's account, a statement, papers by their checklist name and for a
policy, a beneficiary row, a budget envelope, a will, a gift, a tax form, shares bought, a life event's kind, a blank
name, never a made-up key); field words, by section; an old copy brought up to date shows nothing nobody changed;
missing and empty are the same; the plan's name and currency count, the stamps do not; page notes by page; bank file
layouts as one change; one comma for an unnamed inner list; the log's pairing, newest first, a quiet save, the
device; a damaged copy; too few copies; compute.

## Ideas / not yet
- Which device made a change: `meta.updatedBy`, once `core/store.js` writes it (proposed under Messages); the
  page shows "On <device>" as soon as plans carry it, and says nothing about it until then.
- Before and after values for a detail ("stock returns 7% -> 6%").
- Filter by section, or search a payee across the log.
