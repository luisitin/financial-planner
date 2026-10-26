# AGENTS.md -- read this first

You are editing a personal financial planning app that the owner will grow over months
with help from several AI sessions. The point of this file is that you never have to
guess where something goes.

## Read in this order
1. this file
2. `docs/PLAN.md` -- the architecture and the decisions behind it (why it is shaped like this)
3. `docs/CONVENTIONS.md` -- the module contract and the `ctx` object, exactly
4. `docs/MODULE_CATALOG.md` -- every page that exists or is planned, with its status
5. `docs/DATA_MODEL.md` -- the plan object, section by section
6. the README.md of any module you are about to touch

## The shape in one paragraph
`index.html` is a shell. Every page is a folder `modules/<group>/<id>/` with four files:
`module.js` (manifest), `compute.js` (pure math, runs in the browser AND on the PC server),
`view.js` (DOM only), `README.md` (purpose, formulas, status). `core/` holds the shared
pieces (store, router, UI kit, math, AI client). `server/server.mjs` serves the app, keeps
the one plan file, runs heavy compute, and proxies AI to Ollama. `planner.properties`
configures the server and is never committed or served.

## Rules
1. **Do not edit `modules/registry.js`.** Run `npm run registry`; it is generated from the folders.
2. **A page = one folder, four files.** Folder name = `id` = kebab-case. Parent folder = `group`, which must exist in `core/groups.js`.
3. **`compute.js` is pure.** No `document`, `window`, `fetch`, `localStorage`, timers. It must import cleanly in Node (`npm test` proves it). Put every formula in the README with its source.
4. **`view.js` changes the plan only through `ctx.store.update(draft => ...)`**, and commits on save/blur, never per keystroke (the shell re-renders the page after each update).
5. **Money math lives in `core/math/` or a module's `compute.js`, never in the AI.** The model categorises, extracts, explains and chats. A number it produces reaches the plan only after the user clicks apply.
6. **No new global CSS.** Use `core/ui/base.css` classes; scope anything extra inside the module's root element.
7. **Schema changes go through `core/schema/migrate.js`.** Adding an optional field needs no version bump; changing meaning or shape does, with a migration. Update `docs/DATA_MODEL.md` in the same change.
8. **Every module has tests** in its `module.test.mjs`; `npm test` runs them all. Add a test for every formula.
9. **Keep `docs/MODULE_CATALOG.md` true.** New page: add its row. Status changes: update the row. `npm run check` fails if a module is missing from it.
10. **Never commit or serve secrets or data.** `planner.properties`, `data/`, `vendor/` and `dist/` are git-ignored on purpose. Do not add another place to store a token.
11. **Lifting code from an open-source project** (see `docs/RESOURCES.md`): note the project, file and licence in the module README. MIT/Apache/BSD: fine. AGPL/GPL: the repo is public under MIT, so never paste their code; use them as references, or take only facts (tax figures, tables) and say so in the README.
12. **One change, one CHANGELOG line** in `CHANGELOG.md` under Unreleased. A commit that carries out a prompt from `prompts/` has a `Prompt: <id>` line in its message (and a pull request in its description), so the owner's prompt board can show what each prompt led to.
13. **Look at what you built.** `node tools/shot.mjs <group>/<id>` screenshots the page at phone
    and desktop widths (full page, real phone emulation; `--dark`, `--eval`, `--max-height`),
    then Read the PNG in `shots/`. Do this before saying a page is done. The owner reads the
    app on a phone: 390 px wide, thumbs, no jargon.
14. **Write for a layperson.** Page titles, labels, purposes and help text are plain words
    ("what you own", not "assets"; spell out RMD, DTI, IRMAA...). Builder details go in the
    README and the catalog's seeds column, never on screen. Empty states explain what to do
    first instead of showing zeros and empty tables.
15. **The repo is public.** Never write a real name, address, employer, balance, account number, machine name or IP into a file. The pre-commit leak guard (`npm run hooks` once per clone) refuses them; examples use the invented households in `qa/`.

## Add a page in six steps
```
cp -r modules/_template modules/<group>/<id>      # 1. copy the template
# 2. edit module.js: id, group, title, icon, order, enabledByDefault, needs, writes, heavy
# 3. write compute.js (pure) and view.js (DOM), fill README.md, write module.test.mjs
npm run registry                                  # 4. regenerate the registry
# 5. add a row to docs/MODULE_CATALOG.md and a line to CHANGELOG.md
npm test && npm run check                         # 6. green before you stop
```

## Design rules (the shell already follows them; keep it that way)
- One accent colour; green/amber/red only mean good/attention/bad. Calm, lots of space.
  Text on a filled accent element is `var(--on-accent)` (white in light mode, near-black in
  dark mode); never hard-code `#fff` on the accent.
- 44 px tap targets, 15 px base text, cards with `--radius`. No new global CSS: use the
  classes in `core/ui/base.css` (card, row, grid, stat, steps, action, page-list, chips,
  pill, notice, form) and scope anything extra inside your module's root element.
- Every page: a short intro or hero when empty, real numbers only when there are numbers,
  the primary action as a filled button, secondary actions outlined.
- Placeholders come from the catalog (`status: "planned"`, phase number, plain purpose).
- Tables become stacked records on a phone: render the `ui.table` inside `.only-wide` and a
  `.records` list (title + value on the first line, details under, actions in `.rec-foot`)
  inside `.only-narrow`. Never let a row scroll off the right edge of a 390 px screen.
- Big figures go through `ui.stat`, which steps long values down a size and wraps only at a
  comma; do not put raw money in a bare heading.
- A page that already has data folds its add form behind an outlined "+ Add another ..."
  button; the form stays open only while the list is empty.
- Every save, add or remove confirms itself with `ui.notice("ok", ...)`; errors are
  `ui.notice("error", ...)` and say what to do next. The shell re-renders after
  `store.update`, so keep the message in a module-level `pending` and show it on the next
  render (see `modules/system/settings/view.js`).
- Technical sections (connections, providers, developer knobs) go last, folded in a
  `<details class="card fold fold-card">` with a one-line status in the summary.

## Design decisions already made
`docs/DESIGN_LOG.md` records what the owner chose during design reviews. Do not undo or
re-propose anything there. To run a review yourself: `Design-Review.bat` (or `/design-review`
in a Claude Code session opened in this folder).

## Three sessions at once: builder, designer, tester
The owner may have three Claude Code sessions open on this folder. `docs/TEAM.md` says
which files each role may write, how to claim a page, and how findings travel
(`docs/FEEDBACK.md`). Read it before editing anything, and read `docs/FEEDBACK.md` at the
start of every work block: items marked for your role are yours to fix. Anything that
writes data during a test runs in the sandbox (`?sandbox=1` in the address, or
`node tools/drive.mjs`), never on the owner's real plan.

## Start of every phase (builder)
Before building a phase: fix every `docs/FEEDBACK.md` item for the builder, read what the designer
and tester changed or verified since the last phase, read the new `docs/DESIGN_LOG.md` entries and
apply their rules to the new pages, and run `node qa/smoke-all.mjs` (every usable page, phone).
The owner asked for this at the start of every phase.

## Promote a placeholder
Most pages already exist as placeholders generated from the catalog (`status: "planned"`,
`placeholder: true`, a shared "Coming soon" view). To build one:
1. Read its `README.md` and the owner's notes: `plan.pageNotes["<group>/<id>"]` (System > Settings > Export shows the plan; or `data/plan.json` on the PC).
2. Copy `modules/_template/compute.js`, `view.js`, `module.test.mjs` over the placeholder's files; keep `module.js`'s `id`, `group`, `title`, `icon`, `order`.
3. In `module.js`: set `status` to `"stub"` or `"usable"`, delete `placeholder`, `purpose` and `seeds` (or keep `purpose`), fill `needs` / `writes` / `heavy`, set `version: 1`.
4. Rewrite `README.md` from the template; update the catalog row's status; CHANGELOG line; `npm test && npm run check`.
New pages that are not in the catalog: add the catalog row first, then `node tools/scaffold-from-catalog.mjs` creates the placeholder, then promote it.

## Run it
```
npm run serve           # http://localhost:8787  (LAN IPs are printed)
npm test                # registry + all tests
npm run check           # conventions
npm run build           # dist/planner.html single file (needs: npm i -D esbuild)
```
There is no framework and no bundler in dev. Plain ES modules, served by the Node server.

## When the owner asks for something
- A new page: follow the six steps. Prefer many small pages over one big one.
- A new number on an existing page: add it to that module's `compute()`, test it, document the formula, then show it in `view.js`.
- A new setting: server-wide ones go in `planner.properties.example` + `server/server.mjs` DEFAULTS + `publicConfig()`; device ones go in `modules/system/settings`.
- Anything that needs a library: add it under `vendor/` or via `<script src>` from cdnjs/jsdelivr, note it in the module README. Keep `core/` dependency-free.
