# Financial Planner

A personal financial planning app you own: one HTML shell, one folder per page, the math
in code on your PC, a local model (Ollama) for the language work, and nothing in the cloud.
Open it from your phone on the LAN; the PC holds the plan and does the heavy computing.

This is one household's personal planning app, shared as-is under the [MIT licence](LICENSE).
No real financial data is in the repo: the plan lives in the git-ignored `data/` folder, and
every household, statement and account number under `qa/` and in the tests is invented.
Not financial advice.

* **Editing this with an AI?** Start at [AGENTS.md](AGENTS.md).
* **Why it is built this way:** [docs/PLAN.md](docs/PLAN.md).
* **Every page, existing and planned:** [docs/MODULE_CATALOG.md](docs/MODULE_CATALOG.md).
* **Open-source starting points:** [docs/RESOURCES.md](docs/RESOURCES.md).

## Run
```
cp planner.properties.example planner.properties    # edit: AI model, token if exposing beyond LAN
npm run serve                                        # prints http://<LAN IP>:8787/
```
Open that URL on the PC or any phone on the same network. No install step; Node 20+ only.

Without the server, `index.html` still works when served by anything static, and
`npm run build` produces `dist/planner.html`, a single file you can open from a phone's
files or send to someone. In that mode the plan lives in the browser until you point it
at a PC server in System > Settings.

## Layout
```
index.html            shell (no content)
core/                 app boot, store, router, api + ai clients, ui kit, math, schema
modules/<group>/<id>/ one page: module.js  compute.js  view.js  README.md  module.test.mjs
modules/registry.js   GENERATED (npm run registry)
server/server.mjs     PC server: static + /api/plan + /api/compute + /api/ai
tools/                registry generator, convention checker, single-file build
tests/                core tests + runner for every module's tests
docs/                 PLAN, CONVENTIONS, DATA_MODEL, MODULE_CATALOG, RESOURCES
planner.properties    your server settings (git-ignored; see .example)
data/                 your plan and its backups (git-ignored)
vendor/               cloned reference projects (git-ignored)
```

## Commands
`npm run serve` | `npm test` | `npm run check` | `npm run registry` | `npm run build`

## Contributing and the leak guard
Run `npm run hooks` once after cloning. It points git at `.githooks/`, whose pre-commit and
pre-push hooks run `tools/leak-guard.mjs`: commits carrying emails, phone numbers, SSN or
account-number shapes, IP addresses, user folders, keys, private paths or a personal author
email are refused. `npm run leak-guard` scans the whole folder. Changes from AI tools arrive
as prompts in [`prompts/`](prompts/README.md).
