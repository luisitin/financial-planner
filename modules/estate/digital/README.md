# Digital assets  (`estate/digital`)

**Status:** usable (phase 8)
**Purpose:** The online accounts that matter (email, the password manager, phones, photos, online finance, crypto, social media, domains) and how someone you trust could get into each if something happened to you. Never the passwords themselves.

## Inputs
`estate.digital`, `accounts` (crypto balances). Writes `estate.digital[]`: `{ id, kind, name, access: "manager"|"legacy"|"written"|"none", contact, notes }`.

## Outputs
`compute(plan)` -> `{ items[] (with kindLabel, icon, accessLabel, planned, secret), count, planned, missing[] (key kinds without a plan), cryptoHeld, warnings[] }`.

## Rules
- Planned = a way in: in the password manager with emergency access, a legacy contact on the account, or written down in a safe place with a person named who knows where.
- Key kinds: email (it resets every other password) and the password manager always; crypto when Accounts holds any (without the recovery phrase it is lost for good).
- `looksSecret`: notes (or names, or the contact) that look like a recovery phrase (12 to 24 short lowercase words) or a password note (`password:`, `pin =`, `seed:` ...) are flagged with a warning to remove them: the plan is a file on disk and in backups.
- The page names the providers' own legacy features (Google's Inactive Account Manager, Apple's Legacy Contact) as plain facts.

## Tests
`module.test.mjs`: `looksSecret`, nothing listed, what counts as planned (and unknown kinds and access), crypto held with and without a plan.

## Ideas / not yet
- A printable list for the executor (no secrets), with the letter of instruction from Documents.
