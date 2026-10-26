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
The AI card fills in asynchronously (it asks the server for its config first). Import replaces the
whole plan after a confirm; the server keeps timestamped backups of every previous save.

## Tests
`module.test.mjs`: section counts.

## Ideas / not yet
- Encryption at rest with a passphrase (see docs/PLAN.md "Security").
- Theme, font size, number rounding preferences.
- Manage devices / revoke tokens once the server supports more than one token.
