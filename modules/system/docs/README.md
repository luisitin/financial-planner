# Docs  (`system/docs`)

**Status:** usable
**Purpose:** read the project's own documentation (README, AGENTS, PLAN, CONVENTIONS, DATA_MODEL, MODULE_CATALOG, RESOURCES, vendor map, ROADMAP, CHANGELOG) inside the app, e.g. on a phone.

## Inputs
`params.doc` / route `#/system/docs/<id>` selects the document. The Markdown files are static files next to the app's
own page, read relative to it (`docAddress`): `/README.md` on the PC's server, `/financial-planner/README.md` on GitHub
Pages (the site lives under that subpath; the domain root answers 404). A PC address set on this device (a copy of the
app opened from elsewhere) still wins. GitHub Pages serves the `.md` files as they are because of the `.nojekyll` file
at the root.

## Outputs
`docs[]` (the list in `DOCS`), `current`. `markdownToHtml(md)` is exported for reuse.

## Formulas
None. The Markdown converter handles headings, paragraphs, bullet and numbered lists, pipe
tables, fenced code, inline code, bold, italic and links. Links to other project docs are
rewritten to in-app routes.

## Edge cases
Opened from a file with no PC address: explains why nothing loads. A doc that cannot be read (`docTrouble`): when
the app talks to a PC, "check the PC connection"; otherwise (GitHub Pages, phone only) the PC is never mentioned: a 404
says the document is not part of this copy (`vendor/README.md` is git-ignored, so never on Pages), anything else says to
check the connection and try again. Unknown doc id: shows the README.

## Tests
`module.test.mjs`: converter output for headings, tables, lists, code, links; where a doc is read from (subpath, PC,
PC address set here, a file); which words a failure gets.

## Ideas / not yet
- Show each module's README from the catalog (`docs/<group>/<id>`).
- Search across docs.
