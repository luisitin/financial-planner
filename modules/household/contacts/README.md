# Contacts  (`household/contacts`)

**Status:** usable (phase 10; built by claude-b from codex's idle lane)
**Purpose:** Lists your advisor, accountant, attorney and insurers, plus the last four digits of each account number.

The people and firms to call about your money, and the person to call in an emergency (the "household contacts" part
of FEMA's Emergency Financial First Aid Kit; the papers are on `household/documents`). Each contact can be tied to the
accounts and insurance policies it handles, with only the last four digits of each number.

## Inputs
Plan sections read (`needs`): `accounts` (name, type, institution), `insurance.policies` (name, kind, insurer),
`contacts`. Writes (`writes`): `contacts`.
A contact: `{ id, role (ROLES), name, firm, phone, email, notes, accountIds: [id], policyIds: [id], last4: { [account or
policy id]: "1234" } }`.

## Outputs
`compute(plan)` -> `{ contacts: [{ ...contact, roleLabel, links: [{ kind, id, name, what, last4 }] }], byRole: [{ role,
label, contacts }], suggestions: [{ key, role, firm, accountIds, policyIds, what }], checks: [{ id, text }], empty }`.
Also exported: `saveContact`, `removeContact`, `lastFour`, `ROLES`, `NO_FIRM`.

## Rules
- **Last four digits only** (`lastFour`): exactly four digits after spaces and dashes are removed; anything longer is
  refused (never cut down to four, so a full number typed by mistake is not half-kept); the form says so.
- **Suggestions**: every account institution and every policy insurer, grouped by name (capitals and punctuation
  ignored), that no contact handles yet and no contact is named after; "Add" makes a contact of the firm with those
  accounts and policies tied to it and opens it for the phone number.
- **Order**: by role as `ROLES` lists them (the emergency contact first), then by name.
- **Things worth a look**: nobody to call in an emergency; contacts with no phone or email (named when three or fewer);
  accounts and policies with no firm named and no contact tying them (`NO_FIRM`: a house, a car, cash and other assets
  have no firm and are never counted, and are not offered in the form).
No formulas: nothing is calculated from money here.

## First view and parts (simple first, 2026-11-13)
`docs/OPTIONAL.md`; opt spec row: class A (a mechanical change). "From your accounts and policies" is a `part()` (kind
`item`, its own card, "8 to add"), open while no one is listed, while it holds three or fewer, and after a firm is added
from it (R17); one or two suggestions are simply shown in a card (a fold is worth a tap only with three rows or more).
"More on this": "What would your family need if something happened to you?" (If something happens to us, which prints
these contacts with only the last four digits), once someone is listed; while no one is, the page keeps to its one way
to start (no busier than before, critic F3, 2026-11-13).

## Edge cases
- No contacts: a hero with "Add someone"; the suggestions show open below it.
- More than three suggestions with contacts on file: folded with a count.
- A contact needs a name or a firm; the save is refused with a notice otherwise.
- An account or policy that was removed drops out of a contact's list; its id stays in the stored contact.
- Phone numbers are tap-to-call links (`tel:` with only digits and +), emails `mailto:` links; both 44 px tall.

## Tests
`module.test.mjs` (4): last four digits; suggestions (grouping by name, taken away by a contact of that firm or one
that handles the account, a firm still offered for an account no one handles); contacts (cleaning, links with last
four digits, a removed account, role order, replacing by id, removing); checks (emergency, no way to reach, accounts
tied to no one, `NO_FIRM`, the empty plan); the page on the fake DOM: the suggestions as one part, open while short or
while no one is listed, one or two simply shown, More on this once someone is listed; S11 (a firm added from the suggestions; they stay open).

## Ideas / not yet
- Done 2026-11-13: the printable sheet for the person you trust is Reports > If something happens to us.
- Tie the executor and guardian here to the people named on Estate documents.

## Touch and input stress test (2026-11-11, claude-g)
- Phone brings up the number pad (type tel); Email the @ keyboard with no capital first letter (F7). Set on the boxes after
  `ui.form` builds them; a kit-wide tel/email type is wave 1's to add.
