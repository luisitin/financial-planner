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
* **No change is lost or overwritten silently (2026-11-01; reviewed twice by adversarial agents, 38 scenarios in `tests/store-sync.test.mjs` and `tests/server-plan-base.test.mjs`).** Every change is written to the device and marked waiting (`planner.plan.sync`: base, pending, mine, since, sent) the moment it is made; only the send to the PC is debounced, and it also goes when the app is hidden or closed. A waiting change goes to the PC as soon as it answers (every 30 s, when the tab comes back, when the network returns, on the next open, after the first screen). Each save names the PC copy it was built on (`X-Planner-Base`: the copy's `meta.rev`, new on every change, or `meta.updatedAt` for older plans; "none" when the device knows of none); when another device saved in between, the server answers 409 with its copy instead of overwriting, and a bar above the page asks which version to keep (the PC keeps a backup of whatever it replaces). A PC copy that is one of this device's own earlier sends (an answer lost on the way) is not a conflict; whether someone else saved is decided by version names, never by clocks. When nothing waits on the device, the PC's copy is the plan. A sync record counts only for the copy it names, so an erased or too-big-to-store copy never passes for one the PC has. The status pill reads "Saved on PC" only when the PC has the latest change (a change waiting more than 4 s, in any tab, reads "Phone only"). `/api/health` never waits more than 1.5 s for the AI, so a slow AI host cannot make a reachable PC look out of reach.
* The server writes `data/plan.json` atomically (tmp + rename) and keeps the last N timestamped backups (`data.backups`, default 50). `GET /api/plan/backups` lists them and `GET /api/plan/backups/<name>` returns one; System > Backups compares and restores them.
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
| `GET /api/plan/backups/<name>` | one backup's plan, for system/backups; only a name in the backups folder's own list |
| `POST /api/compute/<group>/<id>` | run that module's `compute(plan, params)` on the PC; body `{ params, plan? }` |
| `GET /api/ai/models` | models the configured provider offers |
| `POST /api/ai/chat` | `{ messages, model?, options? }` -> `{ content, model, provider }` |
| everything else | static files from the project root, minus the deny list |

Verified 2026-09-14 on this PC: health, config fallback with no properties file, plan round
trip, server-side net-worth compute, Ollama model list, static serving, and the deny list
(403 for `planner.properties` and `data/`).

## 11. Devices and networking

* On the LAN, the phone opens `http://<PC IP>:8787/`. The server prints its URLs at startup.
* **Quick to open (2026-11-01).** The app is ~530 plain ES-module files with no bundler, so the server does the caching work: when it serves `index.html` it adds an import map giving every code file under `core/` and `modules/` an address with its content hash (`?v=<hash>`), served with `Cache-Control: immutable`; every other address is `no-cache` with an ETag (304 when unchanged), and text is gzipped. An open after the first fetches only `index.html` (0.7 s instead of 4.4 s on a phone over home Wi-Fi at 40 ms a request; 1 KB instead of 3.4 MB); an edited file gets a new address on the next open, so a reload never mixes old and new code. A service worker only works on a secure page: HTTPS, or `http://localhost` / `127.0.0.1` on the PC itself. A phone that opens the PC by its LAN address (plain http) cannot have one, so on the LAN the import map is all there is; on the PC itself `sw.js` is registered but leaves every hashed address alone (it answered 1 of 565 requests on an open, `index.html`, and warm opens timed the same with and without it). `tests/server-static.test.mjs` holds the rules (`sw.js` is always `no-cache`).
* **On a static host (GitHub Pages) (2026-11-07).** GitHub Pages serves the same files with no import map: every file `Cache-Control: max-age=600` on its own, and its CDN's `Age` header makes files fetched together expire at different times, so a phone that had opened the old version ran an old `core/app.js` with new pages for up to ten minutes after a deploy ("99 pages could not load", "undefined is not an object (evaluating 'ctx.view.build')"); a reload did not help. What prevents it now:
  * `sw.js`, a small service worker (Cache Storage only for the saved whole copy below), asks the site about every same-site file on every open (`cache: "no-cache"`: a 304 when unchanged) and hands each to the page as `Cache-Control: no-cache` (without `Content-Encoding`/`Content-Length`: the body is already decoded), so neither the HTTP cache nor the browser's in-memory cache can run an old copy (Chromium did reuse one from memory until the worker said so). One open is decided as a whole: a page that came from the site takes every file from the site, and a file that fails fails (one reload, then plain words), never an older copy next to new files; a page that came from the browser's copy (no signal) takes every file from that copy, so an open without signal still works when the last one did. This needs `FetchEvent.resultingClientId` (Safari 16+); an older Safari falls back per file. It leaves `/api/` at the domain root (or in the app's own folder), other sites, other methods and `?v=` addresses alone, and answers a redirected page with a fresh redirect (a redirected response is refused for a navigation). It never calls `clients.claim()`: a claim took over the first open after the worker shipped halfway through and mixed it (2 of 2 runs); a page that started without the worker finishes without it, and the next open has it.
  * The opening guard in `index.html` registers it (scope `./`, so it works under `/financial-planner/`; never in the single-file build, which leaves the guard out) and, when `core/app.js` itself cannot start (a link error, a file that did not load, or one of the app's files throwing while it starts), reloads once instead of showing "Opening your plan..." for ever, then shows plain words and hides the "Connecting..." pill.
  * `core/heal.js`: when pages fail to load or a page throws, the shell reloads once (never twice in two minutes, never in the sandbox) before saying anything; after that the words are plain, with one Reload button per screen, and the PC is mentioned only when the app's files come from it. A deploy landing in the middle of an open is mended by that one reload. `.nojekyll` makes Pages serve every file as it is.
  * **Never delete `sw.js`.** A phone keeps a worker whose `sw.js` cannot be fetched (a failed update keeps the old one). To retire it, stop registering it in `index.html`, replace `sw.js` with the two-line unregistering worker written in its header (`tests/sw.test.mjs` runs it), and keep that file for months.
  * The price, and how it was paid back (2026-11-07). One-version-at-a-time first meant every open asked the site about each of the ~566 files (304s), where an open within ten minutes of the last used to ask about none: second open 4.7-5.6 s instead of 1.4-1.9 s on a local HTTP/1.1 copy at 40 ms a request, and on a stalled network "Opening your plan..." until the network answered. A timeout that falls back to the browser's own copy does not help (Chromium's cache lock made the open slower), so the fix is the saved whole copy below.
  * **The saved whole copy** (`sw.js`, "The saved whole copy"; Cache Storage). After an open that drew without a problem, the worker keeps that open's files as one set. GitHub Pages gives every file of one deploy the same `Last-Modified` (and the same ETag prefix), and a new deploy a new one (checked 2026-11-07 on the live site: `index.html`, `sw.js`, `core/app.js`, `core/math/tax.js`, `modules/registry.js`, `core/ui/base.css` and a page `view.js` all `Sat, 07 Nov 2026 07:43:39 GMT`, ETags `6aeed6ab-<size>`), so that header is the deploy stamp. The next open asks the site for the page alone, for 4 seconds at most: the same stamp means nothing changed, so the whole open comes from the saved set (one request instead of ~570; 1.5 s measured, 2 requests); another stamp is a new deploy, so the open comes from the site as before and becomes the new saved set once the page says it drew (`core/heal.js` `announceOpened`, after the worker re-asks the page's stamp once more); no answer in time, or no network, means the open comes from the saved set, whole (5.4 s measured with the site silent). Why it cannot mix: every file of a page that came from the saved set comes from that one set (the page's set is remembered in memory and in Cache Storage, so a worker restarted mid-open still serves the same set); a file the set lacks is asked of the site and kept only when it carries the set's stamp, otherwise code gets a 404 (an honest failure, then the one self-heal reload) and data files pass; a page that came from the site never takes a file from the set; a set is saved only from one open whose every file had the same stamp, that holds the shell and every page module the registry names, and whose stamp still matched after the page drew. When it cannot be sure it does what it did before: no stamp, a stamp that is not within 90 days before the open (a host with a fixed date would otherwise serve a stale set for ever), no Cache Storage (a private window, Safari out of space), or a set older than 24 hours (the next open checks every file again and saves a new set). Trade-off: on a slow or stalled connection the owner sees the previous version rather than waiting, and the next good open brings the new one. A deploy that landed on a stalled connection is therefore not seen until the connection answers. The guard in `index.html` adds a watchdog: still on "Opening your plan..." with no file arriving for 15 seconds (the page was answered, then a file never came; it counts Resource Timing entries, and falls back to 30 seconds from the start where it cannot), it reloads once (same rule and key as the self-heal), and that reload opens the saved set; an open that is slow but still bringing files is never reloaded (a 46-second open on a connection 450 ms late per request used to be thrown away at 30 seconds, and with a saved set the phone then never took the new version). After 8 seconds the screen adds "This is taking longer than usual. Still trying..."; when the one reload is used up it says "The connection is not answering. Check your signal, then tap Reload." with a Reload button. `tests/sw-copy.test.mjs` holds the rules, and `node qa/flows/static-stall.mjs --out <dir>` proves them in Chromium (unchanged, stalled, transition, old-whole, mid-open, flaky, set-gone, two-tabs, never-back, no-pc); the gate runs it when a push changes `sw.js`, `index.html`, `core/heal.js` or `core/app.js`.
  * **The saved whole copy: rules added by the review of 2026-11-11.** (1) *Never back a version.* The page tells the worker "running" the moment its code starts (`core/heal.js` `announceOpened`); when that page came from the site and is another deploy than the saved set, the saved set is forgotten at once. If the new open is then never saved (the app closed within a second or two, the site silent just then, a red notice), the phone has no set and waits for the site as it did before the set existed; it does not open the older version after the newer one ran. Separately, `core/schema/migrate.js` `tooNew` + `core/store.js`: a plan whose `schemaVersion` is above the code's is never edited (update throws; the shell shows "Your plan was last saved by a newer version of this app..." with Reload instead of a page). (2) *A record without its files* (evicted by the browser, or deleted): the open comes from the site and the record is dropped; the site's answer is only discarded once the set's page is in hand (it used to be cancelled first, and every open ended on the browser's error page for up to 24 hours). The tidy-up deletes nothing when it cannot read the record. (3) *Two tabs at once:* sets are saved one at a time and a set stays protected until it is the saved one or deleted (each tab used to delete the other's set). (4) *Only where the stamp is verified:* a set is kept on `*.github.io` and on this machine (`localhost`, `127.0.0.1`: the test harness) and nowhere else, because a host that sends one fixed `Last-Modified` for every deploy would make two deploys look like one (a custom domain therefore gets no saved set: it works as before the set existed). (5) *Off switch:* `COPY_ON = false` in `sw.js` makes the worker do exactly what it did before the set existed. (6) *Decisions:* a deploy that drops a file still shows the honest red notice although an older whole set is on the phone (a page from the site never falls back to the set; one more worker state was judged worse than a notice that a later Reload clears); the 4-second wait for the site before the set opens stays (no network at all is answered at once). (7) *Not verified:* WebKit. Only Chromium runs here, and the phone is an iPhone. The design rests on the page's files arriving under the id the navigation announced (`resultingClientId`); a browser where they never match never saves a set (tested), so it behaves as before. (8) *Ids that do not match: fail closed (final check, 2026-11-11; widened in its third round).* A browser where the ids match on one open (a set is saved) and not on a later one used to get the old page from the set and its files fresh from the site: after a deploy, a mix. Now a page opened from the set holds a refusal for as long as it lives (`clients.get` finds it under its own id) and, from its open, for 60 seconds even when the browser does not list it yet; while any page holds it, a code file (`.js`, `.mjs`, `.css`, `.html`, `.json`; not the manifest) asked for under an id the worker does not know, or under none, is answered with the same 404 as "missing from the set", never by the site. That covers every file of the page, not only its first: a page module loaded on demand under another id would be the 2026-11-07 crash (an old `core/app.js` with new pages). Each refusal forgets the saved set, writes the id down as refused for as long as that page lives (`planner-ids-1`), and refuses no-id code until no page from the set lives; the page's one self-heal reload then opens from the site. Refusals on two different opens are the proof that ids do not match here: no set is kept again in that browser for 30 days counted from the first of them (the record `planner-current-1` key `ids`, `{ strikes, at }`); one refusal alone is not, because a worker restarted at the wrong moment can cause one, so the next good open saves a set again. What the person sees: the opening screen, the one self-heal reload, then the app from the site. *Chosen over answering that request from the set:* the request might belong to a page that came from the site, and a file of the set's version there would be the same mix the other way round; a 404 is never a mix. *Chosen over "use the set only after one open proved the ids match":* a set exists only after such an open (50 files of one open under the page's own id), so that proof is already required, and it says nothing about the next open. *Pages from the site are left alone:* the worker knows every page it opened (written to Cache Storage before the page is answered, so a restart right after still knows), every page that existed when it started (the pages of the previous `sw.js`: the transition; not listed while an open from the set still waits for its first file), and every page that asked for a file while no page from the set lived; the very first open is not controlled at all. Measured in Chromium (2026-11-11): ordinary opens, opens from the set with six pages loaded on demand, reloads, back and forward, worker stops, two tabs, a stale open and the transition from the previous `sw.js` gave no refusal, no 404 and no `ids` record. *Not covered, honestly:* (a) WebKit is not verified at all: Safari on the iPhone may send files under another id, in which case the worst case is refused files, one reload and, after two such opens, no saved set (never a mix in the unit tests); (b) a browser whose `clients.get` does not find a live page under the id its navigation announced, after that page's first minute: a second tab from the set could then take the site's code (a mix); (c) a browser that hands a new page the id of an older one; (d) a page from the site whose "known" mark was pushed out by 256 newer ones and that asks for its first code file while a page from the set lives gets a wrong 404 (Reload mends it); (e) in a browser where ids really never match, a reload within the minute after a refusal is refused again (Reload a minute later works). (f) a page from the set that stays open while 64 newer opens happen loses its pin, and a code file it then asks for under an unknown id would come from the site; today's app imports every page at start, so no such late request exists (if pages ever load on demand, trim pins of gone pages first). *After the push, on the phone:* open the link twice, switch to airplane mode, open again (about 5 seconds), open three or four pages; then switch airplane mode off, open once more. Any "could not load" that Reload does not mend: set `COPY_ON = false` in `sw.js` (the off switch, item 5) and push; the worker then does exactly what it did before the set existed. (9) *Sets being saved do not pile up:* at most 3 are in progress, and one whose page is gone (`clients.get`) is deleted at the next open (three quick opens used to leave 5 sets of about 12 MB until the worker stopped); a set being saved is never deleted under it. The check on the phone after the push that ships this, and the off switch: item 8.
  * **No PC, no `/api/` requests (2026-11-07).** `api.base()` was the page's own origin, so the phone asked `https://<user>.github.io/api/health` and `/api/config` at every open (and `/api/health` at every sync): 2 per open on the live site at c804ed0, each a 404. Now `api.base()` is the typed PC address, else the page's own origin only when the PC served the page (its import map is in `index.html`; a static host, a file and the single-file copy have none), else blank, and every PC call throws "This needs your computer. Connect to it in Settings first" instead of going to the site. `tools/live-check.mjs` and `qa/flows/static-skew.mjs --check` now count any request for the domain-root `/api/` as a problem.
  * **The gate before `main` moves** (`main` follows the working branch after every push, and Pages serves it): `tools/main-gate.mjs`, run by `.githooks/pre-push` for every push to `main` (`npm run hooks` once per clone) and by hand as `npm run skew`. It runs `qa/flows/static-skew.mjs --check` twice in a phone-sized Chromium: the real pair (what `main` is now, then what is pushed, reopened from the home screen, served the way the 2026-11-07 deploy reached the phone), and the pushed tree against itself plus a synthetic change of every shape that can mix (a new ctx field, a new export, a dropped export, a style change, a worker change, a change to `index.html` itself). Either failing refuses the push; never skip it with `--no-verify`. **The wait:** before the checks it refuses a push that changes the app while `main` last moved less than 11 minutes ago (Pages tells a phone to keep a file 10 minutes, so a phone that opened the site just before the last push can still hold some of its files). The time that counts is when the app on `main` last changed: the time this clone last pushed an app change to `main` (the time of that "update by push" entry in the reflog of `origin/main`, read with `--date=unix`; the first version read `%ct`, which is the commit's own date, so a commit made an hour before it was pushed started no wait), or, for a push from another clone, the date of the newest commit on `main` that changed an app file. A push that changed only notes, tests or tools neither waits nor starts the wait again, and neither does `npm run skew` by hand. It says how many minutes are left and when to push, in this machine's time and UTC. To push anyway, when you know no phone opened the site in between: `PLANNER_MAIN_WAIT=skip git push` in Git Bash, macOS or Linux; `$env:PLANNER_MAIN_WAIT="skip"; git push; $env:PLANNER_MAIN_WAIT=""` in PowerShell; `set PLANNER_MAIN_WAIT=skip& git push& set PLANNER_MAIN_WAIT=` in the Command Prompt (the refusal prints all three; `node tools/main-gate.mjs --no-wait <from> <to>` runs the check alone). When the push changes `sw.js`, `index.html`, `core/heal.js` or `core/app.js` the gate also runs `qa/flows/static-stall.mjs` (about 3 minutes). **The hooks must be executable** (mode 100755 in the repository, or git skips them with one easily missed line: they were 100644, so the gate never ran); `npm run hooks` sets the path and the mode and says if git still cannot run them, and `npm run check` fails on a hook recorded as anything else, on a missing `pre-push`, and when this clone does not point git at `.githooks` (a fresh clone runs no hook until `npm run hooks`). With `--no-sw` the synthetic check fails, which proves it catches the bug; with `--a a2b9adc --b 5fb5363` the real pair fails with the owner's screens. By hand, `--flaky core/app.js` (the site stops answering that file after the deploy, a phone on one bar) checks that a file that fails never brings an older copy next to new ones: it passes with the worker and fails with a worker that falls back file by file. Without Playwright it says so loudly and lets the push through. Around the push, `node tools/live-check.mjs --profile <dir outside the repo> --prime` right before it and `node tools/live-check.mjs --profile <same dir> --from <what main was>` after it wait until the live site serves the pushed bytes and open every page there, in that kept profile and a fresh one, and check the worker answers a reload. `--prime` opens the version that is live before the push, so requests for a PC address made by that version are counted and said, not failed (the push that stops them could otherwise never be primed); after the push they are problems.
  * The one push that ships `sw.js` cannot protect itself: the phone's cached files came without the worker, so that open can still mix. The gate lets the old shell (`index.html`, `core/app.js`) run from the cache with a warning, and refuses the push when any other file ran old next to new ones, red notice or not: 5fb5363 -> the working branch with `sw.js` ran old `core/math/tax.js` and `retirement.js` under new pages on all 161 pages without one red notice (old numbers, said nowhere). So ship it alone: commit it on top of what `main` is now (a branch from `origin/main`), push that to `main`, push nothing else for ten minutes after it is live, then merge `main` into the working branch and move `main` as before; from the next push on the worker covers every open. The same holds for the first open after Safari deletes a site's data (7 days without a visit in a Safari tab; not for a Home Screen app).
  * Phone only on GitHub Pages, the plan itself lives in the browser's storage for the `github.io` address. Safari deletes it after 7 days without a visit in a Safari tab (not for an app added to the Home Screen), and every project site of the same GitHub account shares that storage. Add the app to the Home Screen and keep an exported copy; a custom domain would give it storage of its own.
* The app is a hash-routed single page, so a deep link like `#/retirement/monte-carlo` works and survives reloads.
* **Planned:** live sync between devices (a WebSocket) so an open page shows another device's change at once (today it is picked up when the tab comes back into view, and a save on stale data asks instead of overwriting).
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
* Every page is reachable at `#/<group>/<id>` (plus an optional `?key=value` query inside the hash, e.g. a step-by-step guide's `?guide=debt&step=rates`); the dashboard lists every enabled page; Settings toggles them.
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
| Guesses are ordinary values plus a ledger (`plan.guesses`), refreshed only inside the person's own change (`settle` in `store.update`), never on load; the older Get started flags are read as frozen guesses (2026-11-02) | every page keeps reading plain numbers and needs no change; a typed figure always wins and nothing moves on its own when the app opens or another phone syncs; population figures live in sourced tables (modules/overview/guesses/data), never in the AI | the older flags have no reader left (fold them into the ledger with a schema v2 migration), or a guess must follow something outside the plan |

## 19. Glossary

* **plan** -- the single JSON document holding everything about the household's money.
* **module / page** -- one folder under `modules/`, one entry in the sidebar.
* **derived** -- the output of a module's `compute()`; never stored, always recomputed.
* **scenario** -- a named set of overrides applied on top of the plan for comparison.
* **heavy** -- a module whose compute should run on the PC when one is connected.
* **properties** -- `planner.properties`, the server's configuration.
* **Tier 0/1/2** -- file only / plus server / plus AI (section 3).
