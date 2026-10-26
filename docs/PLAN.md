# PLAN.md -- the blueprint

This is the document a future editor (human or AI) reads to understand why the project is
shaped the way it is. What to do is in `AGENTS.md`; the exact contract is in
`docs/CONVENTIONS.md`; the page list is in `docs/MODULE_CATALOG.md`.

## 1. Vision

A personal financial planning program the owner controls completely: every input, every
assumption, every formula visible and editable; usable from a phone on the couch while the
PC does the heavy math; a local language model for the language work; no cloud, no account,
no vendor with a product to sell. It should be able to reproduce what an advisor's planning
tool shows, and then go further, because the owner can change anything.

It will be built over months by different sessions. So the second goal is that any editor
can open the project cold and know within five minutes where a change goes.

## 2. Principles

1. **One page = one folder.** Nothing is spread across files with clever indirection. If you can name the page, you can find its folder.
2. **Math is code, tested, and documented next to itself.** Every number on screen traces to a function in `compute.js` or `core/math/`, with a test and a written formula. The language model never does arithmetic that lands in the plan.
3. **The plan is one JSON object.** Every page reads and writes the same document. No module has private state that another module cannot see.
4. **Vanilla by default.** No framework, no bundler in development, no build step to run a page. Plain ES modules served by a 300-line Node server. Adding a dependency is a decision, not a habit.
5. **The PC is the source of truth; the browser is a view with an offline copy.** Phones and the PC share `data/plan.json`. Without a server, a browser still works on its own copy.
6. **Everything toggleable.** Pages can be turned off per device or server-wide. A module that is off costs nothing.
7. **Defaults that work with nothing configured.** No properties file, no server, no AI: the HTML still opens and the pages still compute.

## 3. Architecture

```
  phone / tablet / any PC on the LAN                 the owner's PC
  +---------------------------+                      +----------------------------------------+
  |  browser                  |   http://pc:8787     |  server/server.mjs  (Node, no deps)     |
  |  index.html shell         | <------------------> |   - serves the app                      |
  |  core/  (store, router,   |   /api/plan          |   - data/plan.json + backups            |
  |          ui, math, ai)    |   /api/compute/...   |   - runs modules/*/compute.js (heavy)   |
  |  modules/<group>/<id>/    |   /api/ai/...        |   - proxies AI  --> Ollama :11434       |
  |  localStorage offline copy|   /api/config        |   - reads planner.properties            |
  +---------------------------+                      +----------------------------------------+
```

Three tiers, each a strict superset of the previous:

* **Tier 0, the file alone.** `index.html` (or the single-file `dist/planner.html`) opened from anywhere. Math runs in the browser, the plan lives in that browser's localStorage, AI is off unless the device's Settings point at a provider the browser can reach.
* **Tier 1, plus the PC server.** Same HTML, served by `server/server.mjs`. The plan moves to `data/plan.json` (shared by every device), heavy `compute()` calls run on the PC with more paths and more years, the properties file applies.
* **Tier 2, plus AI.** The server proxies to Ollama on the PC (default), or to any OpenAI-compatible endpoint. The phone never talks to the model directly.

Everything the browser needs from the server goes through `core/api.js`; everything the app
needs from a model goes through `core/ai.js`. Modules never call `fetch` themselves.

## 4. Repository layout

See `README.md` for the tree. The rule of thumb: `core/` is shared plumbing and changes rarely;
`modules/` is where the months of work go; `server/` is the PC side; `tools/` are scripts;
`docs/` is prose; `vendor/` is other people's code we learn from or lift from; `data/` is the
owner's money and is never committed.

## 5. The module system

The full contract is in `docs/CONVENTIONS.md`. The decisions behind it:

* **Manifest + compute + view split.** `compute.js` has to run in three places (browser, PC server, tests), so it cannot touch the DOM. `view.js` is the only file allowed to. `module.js` is tiny so the shell can read a module's metadata cheaply.
* **Folder names are the identity.** The registry is generated from folders (`tools/gen-registry.mjs`), so there is no list to keep in sync and no way to register a page in the wrong place.
* **Modules talk through the plan and through `ctx.computeOf()`.** A page that needs net worth calls `ctx.computeOf("balance/net-worth")` instead of importing another module's internals. This keeps modules deletable.
* **`heavy: true`** is how a module says "run me on the PC when you can". `ctx.computeRemote()` does the routing and falls back to local.
* **`needs` / `writes`** are documentation today and the seed of a dependency graph tomorrow (recompute only what changed).
* **`_template/`** is a working module that the registry skips; copying it is the only way to start a page.

## 6. Data and persistence

* One object, `plan`, shaped by `core/schema/migrate.js` and described in `docs/DATA_MODEL.md`.
* `core/store.js` owns it. Pages mutate through `store.update(draft => ...)`; the store clones, notifies, and saves (localStorage always; the server when connected, 400 ms debounced).
* The server writes `data/plan.json` atomically (tmp + rename) and keeps the last N timestamped backups (`data.backups`, default 50). `GET /api/plan/backups` lists them; a restore page is planned.
* Export/import is plain JSON from System > Settings, so the plan is never locked in.
* **Scenarios** are partial overlays (`scenarios[].overrides`) applied on top of the plan by the scenarios modules; they never fork the whole file.
* **Planned:** IndexedDB instead of localStorage once transactions grow (localStorage caps around 5 MB); optional encryption at rest with a passphrase (AES-GCM via WebCrypto in the browser, so the server only ever sees ciphertext); a change log (`data/audit.log`) of what changed when.

## 7. The compute engine

* Pure functions in `core/math/` (time value of money, amortisation, Monte Carlo, later taxes and dates) and in each module's `compute.js`.
* Deterministic: simulations take a `seed`, so a result can be reproduced and a test can assert on it.
* Server compute: `POST /api/compute/<group>/<id>` imports that module's `compute.js` and runs it against the server's copy of the plan (or a plan in the request body). The server adds `params.maxPaths` from the properties file so heavy modules can size themselves. The identical code runs in the browser when there is no server, with fewer paths.
* Precision: plain doubles are fine for projections. Ledger-grade cents (transactions, taxes) will use integer cents or `decimal.js` (vendored) when those modules land.
* Cross-checks: tests compare `core/math` against vendored `formulajs` / `financejs` results and against published figures (a 30-year mortgage payment, a Trinity-study success rate).

## 8. AI policy and integration

What the model is for: categorising transactions, reading statements and plan PDFs into
structured data, explaining a page in plain words, answering questions over a summary of
the plan, suggesting scenarios, drafting a review. What it is not for: any arithmetic whose
result is stored.

Mechanics:
* `core/ai.js` is the only caller. Provider abstraction: `ollama` (default), `openai` (any compatible endpoint), `none`.
* Through the server when connected (`/api/ai/chat`, `/api/ai/models`), so phones need no direct access and keys stay in `planner.properties`. Direct browser calls are the fallback (Ollama then needs `OLLAMA_ORIGINS=*`).
* Prompts live in the module that uses them (`compute.js`, so they are testable and reviewable). The assistant's system prompt forbids inventing numbers and tells the model to point at the page that computes things.
* Context is a compact summary built by `compute()`, never the raw plan. Every field added to a summary is a decision about what a model gets to see.
* **Planned:** structured outputs / tool calling so the model can *ask* a module for a number and quote it; a categorisation pipeline (rules first, then the model on the leftovers, with the user confirming before anything is written); statement extraction (pdf.js text, then the model returns JSON, then a review table); an "explain this page" button on every page; local embeddings (`nomic-embed-text` is already installed) for searching notes and documents.

## 9. Configuration: `planner.properties`

Modeled on a Bedrock `server.properties`: `key=value`, `#` comments, read at startup and
re-read on every `GET /api/config`. Lives in the project root, git-ignored, never served
(the static handler's deny list). `planner.properties.example` documents every key.

| key | default | meaning |
|---|---|---|
| `server.port` | 8787 | port the app and API are served on |
| `server.bind` | 0.0.0.0 | interface; `127.0.0.1` restricts to this PC |
| `server.hosts` | (empty) | extra names for the PC, comma-separated, accepted without a token (IP addresses, one-word names and `.local` `.lan` `.home.arpa` `.internal` `.ts.net` names always are) |
| `auth.token` | (empty) | when set, every `/api` call except health/config needs header `X-Planner-Token`; when empty, `/api` answers only the server's own pages at a network name (no foreign `Origin`, no public `Host`) |
| `data.dir` | data | where `plan.json` and `backups/` live |
| `data.backups` | 50 | backups to keep |
| `ai.provider` | ollama | `ollama` / `openai` / `none` |
| `ai.host`, `ai.port` | 127.0.0.1, 11434 | Ollama location |
| `ai.model` | (first listed) | model name |
| `ai.baseUrl`, `ai.apiKey` | | for `openai` |
| `ai.timeoutMs` | 180000 | request timeout |
| `compute.maxPaths` | 20000 | cap on simulation paths a module may request from the PC |
| `feature.<group>/<id>` | | `false` hides a page for every device using this server |

**Resolution order** for anything configurable, highest first: the server's properties file
(`/api/config`) -> this device's Settings page (localStorage) -> built-in defaults. This is
what makes sharing the folder without the `.properties` file work: the recipient's app runs
on defaults, and their Settings page is where they type their own Ollama address, port and
model, or point at their own server.

## 10. Server API

| route | purpose |
|---|---|
| `GET /api/health` | `{ ok, version, plan: bool, ai: { provider, reachable }, authRequired }` |
| `GET /api/config` | public view of the properties (never `auth.*` or `ai.apiKey`), plus `source` |
| `GET /api/plan` / `PUT /api/plan` | the shared plan; PUT backs up the previous file first |
| `GET /api/plan/backups` | list of backup files |
| `POST /api/compute/<group>/<id>` | run that module's `compute(plan, params)` on the PC; body `{ params, plan? }` |
| `GET /api/ai/models` | models the configured provider offers |
| `POST /api/ai/chat` | `{ messages, model?, options? }` -> `{ content, model, provider }` |
| everything else | static files from the project root, minus the deny list |

Verified 2026-09-14 on this PC: health, config fallback with no properties file, plan round
trip, server-side net-worth compute, Ollama model list, static serving, and the deny list
(403 for `planner.properties` and `data/`).

## 11. Devices and networking

* On the LAN, the phone opens `http://<PC IP>:8787/`. The server prints its URLs at startup.
* The app is a hash-routed single page, so a deep link like `#/retirement/monte-carlo` works and survives reloads.
* **Planned:** PWA manifest + service worker so the phone installs it and works offline against its local copy; live sync between devices (a WebSocket or polling `updatedAt`) so two open browsers do not overwrite each other; a conflict rule (last write wins, with the backup as the safety net).
* Beyond the LAN: only through a tunnel (playit.gg, Tailscale) **and** `auth.token`. HTTPS is a Tailscale/tunnel concern, not the server's.

## 12. Security and privacy

* Financial data never leaves the PC unless the owner points the app at a remote AI provider.
* `planner.properties`, `data/`, `vendor/` and `dist/` are git-ignored and `planner.properties` and `data/` are never served.
* A token is the only auth today: one shared secret, entered once per device. Planned: per-device tokens with names, revocation, and a read-only viewer role for a partner.
* Without a token the server still refuses other web sites: a request whose `Origin` is not the server itself, or whose `Host` is a public name (DNS rebinding), gets 401. A copy of the app opened from a file or another site therefore needs a token.
* The single-file build embeds no secrets; a copy given to someone contains only code.
* AI context is a summary; the raw plan is never sent.

## 13. UI and navigation

Redesigned 2026-09-15 after the owner printed the first dashboard and found it unusable for a
layperson (a wall of 153 links). What replaced it:
* **Sidebar:** a search box, a "Ready now" list of built pages, then every topic as a
  collapsible group with a count ("18 soon" / "2 ready"). A footer toggle hides unbuilt pages.
  On the phone it is a drawer with a scrim.
* **Dashboard:** a welcome hero with a progress bar (pages ready / total) while the plan is
  empty and money tiles once accounts exist; three "Start here" action cards; the six setup
  steps as a numbered list with the next one highlighted; the build phases with per-phase
  counts, each linking to the All-pages browser filtered by phase. No page directory here.
* **All pages** (`overview/pages`): the directory, searchable, with Ready / Coming soon chips
  and a phase dropdown; every row has a plain-language purpose and a status pill.
* **Placeholders:** group icon, "Coming in phase N", the purpose as a sentence, a notes box
  saved to `plan.pageNotes`, links back and to the phase's other pages.
* **Screenshots are part of the workflow:** `tools/shot.mjs` drives Chrome through the
  DevTools protocol (real 390 px phone emulation, full page, dark mode, `--eval` to open the
  drawer). Windows Chrome refuses windows under 500 px and Edge swallows screenshots after the
  first, which is why it is CDP and not `--screenshot`.

* The shell: top bar (menu, page title, status pill "PC | AI on"), a sidebar grouped by `core/groups.js` order, a content area. Mobile: the sidebar is a drawer.
* Every page is reachable at `#/<group>/<id>`; the dashboard lists every enabled page; Settings toggles them.
* The UI kit (`core/ui/dom.js`) is deliberately small: cards, stats, tables, forms from an input schema. Charts come later via vendored uPlot, added per module.
* Locale and currency are plan settings (`meta.locale`, `meta.currency`); formatting goes through `core/format.js` so a Spanish locale is one setting. Full string translation is planned as `core/i18n.js` with per-module string tables.
* Dark mode follows the system.

## 14. Testing and quality gates

* `npm test`: regenerates the registry, runs `tests/*.test.mjs` (core math, structure checks) and every `modules/**/module.test.mjs`.
* `npm run check`: the conventions, enforced (four files per module, id/group match, pure compute, listed in the catalog).
* Golden values: mortgage payment, FV/PV inversions, Monte Carlo with zero volatility equals compound growth. Future modules add published figures (IRS examples, SSA examples, Trinity/Bengen results) as tests.
* The PC server is smoke-tested with curl (section 10).

## 15. Build and distribution

* Development needs nothing: `npm run serve`.
* `npm run build` produces `dist/planner.html` with esbuild (the one dev dependency, installed on demand). That file is the "share it" form and the "open it from the phone's files" form.
* Vendored code is used by copying the specific functions into a module (with the source noted in its README) or by loading a built file from `vendor/` with a `<script>` tag inside a module's view. `core/` stays dependency-free.

## 16. Vendored sources

`vendor/sources.json` lists every reference project and data file; `tools/fetch-vendor.mjs`
clones and downloads them and records exact commits in `vendor/MANIFEST.json`;
`vendor/README.md` says where the interesting code is inside each. `docs/RESOURCES.md` is
the annotated reading list. The repo is public under MIT, so code is lifted only from
MIT/Apache/BSD projects; AGPL/GPL projects are references, or sources of facts such as tax figures.

## 17. Phases

Detail in `ROADMAP.md`. In one line each: scaffold (done) -> household, income, expenses, goals, assumptions -> transactions with import, rules and AI categorisation -> debt and cash-flow forecasting -> retirement projections, Social Security, Monte Carlo on the PC -> taxes -> investments -> insurance, estate, the advisor-plan comparison -> scenarios and reports -> PWA, sync, encryption, Spanish.

## 18. Decision log

| decision | why | revisit when |
|---|---|---|
| No framework, plain ES modules | zero build in dev, any editor can read it, longevity over months | a page's view logic becomes unmanageable; then Preact via a vendored script, still per module |
| Hash routing | works from `file://`, from any static host and from the server without rewrite rules | never, probably |
| One plan object instead of a database | trivially exportable, diffable, backup = copy a file, every module sees everything | transactions exceed ~100k rows; then SQLite on the server behind the same API |
| Math in code, AI for language | correctness; a model cannot be trusted with arithmetic that lands in a plan | never |
| `planner.properties` file, not env vars or a UI | the owner already thinks in server.properties; easy to exclude when sharing | never |
| localStorage fallback | Tier 0 must work with nothing | it fills up; move to IndexedDB |
| Server compute through dynamic import of the same `compute.js` | one implementation, no drift between phone and PC | never |
| Shared token, not accounts | one owner, a partner at most; simplicity over ceremony | more than two people or a public tunnel |
| Folder = page, four files | discoverability for future editors is the whole point | never |

## 19. Glossary

* **plan** -- the single JSON document holding everything about the household's money.
* **module / page** -- one folder under `modules/`, one entry in the sidebar.
* **derived** -- the output of a module's `compute()`; never stored, always recomputed.
* **scenario** -- a named set of overrides applied on top of the plan for comparison.
* **heavy** -- a module whose compute should run on the PC when one is connected.
* **properties** -- `planner.properties`, the server's configuration.
* **Tier 0/1/2** -- file only / plus server / plus AI (section 3).
