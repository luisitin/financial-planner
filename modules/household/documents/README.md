# Document vault index  (`household/documents`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Keeps track of where your will, insurance policies, deeds and tax returns are kept (the locations, not the
files themselves).

Only the place goes in the plan: where the paper is, where a copy is, who else knows. Never the paper, a scan, or the
numbers on it (the page says so). The will and the other estate papers keep their place on Estate documents
(`estate/documents`, its `where` field); this page shows the signed ones read-only with a link there, so the place is
written in one spot only.

## Inputs
Plan sections read (`needs`): `household.people` (one row per person or adult), `accounts` and `property` (a home or a
car makes the deed or the car title count), `insurance.policies` (a row per policy), `estate.documents` (through
`estate/documents` compute: the signed ones), `papers`. Writes (`writes`): `papers`.
Parameters accepted by `compute(plan, params)`: `today` (YYYY-MM-DD).

A stored row (`papers`): `{ key ("birth:<personId>", "taxReturns", "policy:<id>", "own:<id>"), where, copy, who, none
(we do not have it), notes, updatedAt, custom?, label? (papers you add) }`.

## Outputs
`compute(plan, { today })` -> `{ groups: [{ key, label, what, rows, placed, total }], placed, total, share, checks:
[{ id, text, go? }], started }`; each row `{ key, paper, label, help, personId, personName, optional, readOnly, go,
where, copy, who, none, notes, updatedAt, placed, done, stale }`.
Also exported: `savePlace`, `addPaper`, `clearPlace`, `rowKey`, `PAPERS`, `GROUPS`, `RECHECK_DAYS`.

## Formulas and rules
- **The checklist** (`PAPERS`), from FEMA's *Emergency Financial First Aid Kit* (FEMA P-2063,
  https://www.ready.gov/emergency-financial-first-aid-kit and its checklists,
  https://www.ready.gov/sites/default/files/2020-03/ready_emergency-financial-first-aid-toolkit-checklists-and-forms.pdf;
  read 2026-10-31): household identification (birth certificate, Social Security card, photo ID, passport or green
  card, marriage license or divorce decree, adoption or custody papers, military discharge record DD 214); financial
  and legal documentation (deed and mortgage papers, car title and registration, insurance policies, statements, loan
  papers, tax returns); medical information (health insurance and Medicare cards, the list of medicines). The home
  inventory row points to Asset register (`balance/assets`).
- **Who gets a row**: birth certificate, Social Security card, health cards and the medicine list for everyone; photo
  ID for each adult (not a dependent); the rest once for the household. No people on file: one row each.
- **Optional rows** (passport, marriage or divorce papers, custody, discharge papers, lease, loan papers; the deed with
  no home on file, the car title with no car) count only once a place is written; they sit under "Only if you have
  them" and can be marked "we do not have this". A row marked so leaves the count.
- **The count**: placed = rows with a place written; total = rows that count (not marked as not had, not optional and
  empty), the signed estate papers included (placed when Estate documents has their place).
- **Tax returns, how long** (the row's help): the IRS can generally assess tax for 3 years after you file; 6 years if
  you left off more than 25% of your gross income; 7 years for records of a loss from worthless securities or a bad
  debt deduction; property records until the period ends for the year you sell it. IRS, *How long should I keep
  records?* (https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records, read
  2026-10-31). The page says "a lot of income" for the 25% rule.
- **Things worth a look**: papers with no place; signed estate papers with no place (link to Estate documents); papers
  with a place but no copy elsewhere, for the ones hard to replace or needed after a disaster (birth certificate,
  Social Security card, passport, deed, car title, policies, home inventory); nobody noted as knowing where any of it
  is; a place written over a year ago (`RECHECK_DAYS` = 365, a reminder to check, the builder's choice). Keep originals
  in a fire- and waterproof place or a safe deposit box and a copy elsewhere: Ready.gov, *Safeguard Critical Documents
  and Valuables* (https://www.ready.gov/sites/default/files/2020-03/fema_safeguard-critical-documents-and-valuables.pdf,
  read 2026-10-31). Replacing vital records through the state's vital records office: the EFFAK checklist's tips.

## First view and parts (simple first, 2026-11-13)
`docs/OPTIONAL.md`; opt spec row: class B. Built with `core/ui/more.js`; no hand-written `<details>`.
- **First view**: "Where your papers are" with a shorter lede (nothing written yet) or "Papers with a place: X of Y"; then
  "Next paper: Birth certificate (Ana)" and the one filled button "Write where it is kept", which opens that paper's
  group and its form (none while a form is open: its Save is the filled button then). "Worth a look" stays in sight.
- **Your papers**: one card, each group a shut `item` row with its count ("Who you are · 0 of 8"; it was open before);
  the will and estate papers say "none signed yet" with the way to Estate documents inside. "Only if you have them" is an
  `item` row inside its group (three or more papers; one or two are listed under a small heading instead). Papers of your
  own: no empty row, one outlined "+ Add a paper of your own" under the card. Row buttons are all outlined.
- **Parts card**: "Good places to keep papers" (`how`, the opt spec's named title; "3 tips").
- **More on this** (once something is written): "Are the will and the other papers signed?" (Estate documents), "What
  would your family need if something happened to you?" (If something happens to us).
- After a save or a clear, the green line, and the group saved stays open; no other row opens or shuts (R17). A group
  opens for its open form or for `?show=papers-<group>`.
- Builder chose: each group's body starts with what it is for and "Tap a paper to write where it is kept, where a copy
  is and who else knows." (so every row is worth a tap); the module-level `opened` set is gone (wave 1 keeps a row the
  person opened by hand).

## Edge cases
- Nothing written yet: a hero explaining why, and the first group open; no zero totals.
- One filled button: the next paper to write down; the others are outlined.
- Saving without a place: refused with a notice (or tick "we do not have this" for an optional paper).
- A policy that is removed takes its row with it; a place stored for it stays in `papers` and comes back if a policy
  with that id returns.
- Papers you add can be renamed, changed and removed; a checklist paper can only be cleared.

## Tests
`module.test.mjs` (4): the checklist rows (per person, per adult, a deed with a home, a title without a car, the
total); policy rows and the read-only signed estate papers with the estate check; counting (a place, "do not have",
optional papers once written) and the checks (missing, copy, who knows, old); papers you add, clearing, the empty plan;
the page on the fake DOM (each group a shut row, every fold a part, one filled way on, the links once started) and S11 (the
way on opens the paper's group and form; after the save the group stays open and nothing else moves).

## Ideas / not yet
- Done 2026-11-13: the printable packet for the person you trust is Reports > If something happens to us (with the
  contacts, accounts, online accounts and first steps).
- Pets' papers (the EFFAK lists them) as an optional row when the plan knows about pets.
