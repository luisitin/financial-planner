# Docs  (`system/docs`)

**Status:** usable
**Purpose:** read the project's own documentation (README, AGENTS, PLAN, CONVENTIONS, DATA_MODEL, MODULE_CATALOG, RESOURCES, vendor map, ROADMAP, CHANGELOG) inside the app, e.g. on a phone.

## Inputs
`params.doc` / route `#/system/docs/<id>` selects the document. The Markdown files are fetched
from the PC server as static files, so this page needs a server connection.

## Outputs
`docs[]` (the list in `DOCS`), `current`. `markdownToHtml(md)` is exported for reuse.

## Formulas
None. The Markdown converter handles headings, paragraphs, bullet and numbered lists, pipe
tables, fenced code, inline code, bold, italic and links. Links to other project docs are
rewritten to in-app routes.

## Edge cases
No server: explains why nothing loads. Unknown doc id: shows the README.

## Tests
`module.test.mjs`: converter output for headings, tables, lists, code, links.

## Ideas / not yet
- Show each module's README from the catalog (`docs/<group>/<id>`).
- Search across docs.
