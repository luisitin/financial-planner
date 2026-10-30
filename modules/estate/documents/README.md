# Documents checklist  (`estate/documents`)

**Status:** usable (phase 8)
**Purpose:** The papers that protect the family (a will, powers of attorney for money and health care, a living will, a HIPAA release, a guardian for the children), which are signed, where the originals are kept, and which to look at again.

## Inputs
`household.people` (adults; children under 18 need a guardian), `estate.documents`. Writes `estate.documents[]`: `{ id, kind, personId ("" for household papers), status: "done"|"started"|"none", done (kept in step with status, for older readers), updatedAt, where, notes }`.

## Outputs
`compute(plan, { today })` -> `{ items[], required, done, share, minors[], warnings[] }`; each item `{ key, kind, label, what, personId, personName, optional, status, updatedAt, where, notes, stale, reasons[], id }`.

## The list
Per adult: will, financial power of attorney, health care power of attorney, living will, HIPAA release. For the household: a guardian for the children (only with a child under 18), and, worth having, a living trust and a letter of instruction. The usual estate-planning starting set; names and signing rules differ by state (the page says it is a reminder, not legal advice).

## Rules
- Required = every non-optional item; done = those with status "done" (or the older `done: true`).
- Look at it again (`stale`) when signed `REVIEW_YEARS` (5) or more years ago (whole years, `ageOn`), or, for a will, guardian or trust, when someone in the household was born after it was signed.
- Warning: a child under 18 and no guardian signed.

## Tests
`module.test.mjs`: an empty plan, the family's list and the guardian warning, signed papers counted and flagged (old, a child born since), the older `done` flag, a grown child.

## Ideas / not yet
- Life events that call for a review (marriage, divorce, a move to another state) from the household's history.
- Where each is kept, as a printable sheet for the executor (Reports).
