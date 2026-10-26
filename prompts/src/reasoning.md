# Deep reasoning
Architecture, data model, flows, methodology and security. Judgement matters more than arithmetic.

---
id: reasoning-architecture-review
title: Architecture review: will this shape hold at 200 pages?
size: L
to: Claude (2nd account), ChatGPT, Gemini, Muse
output: report
read: AGENTS.md, docs/PLAN.md, docs/CONVENTIONS.md, core/app.js, core/store.js, core/router.js, core/api.js, server/server.mjs, tools/gen-registry.mjs
summary: The module contract, store, routing, server compute: what breaks first and the fixes.

The app is built by several AI sessions over months, one page at a time (154 pages, 66 working). Review the architecture as the person who will maintain it for five years:
- the module contract (manifest, pure compute, view) and `ctx`; how pages depend on each other through `ctx.computeOf()` (compute cascades, repeated work, cycles);
- the store: one plan object, full re-render after every `store.update`, the 400 ms debounced save to the PC, localStorage as the offline copy;
- the router and shell (`core/app.js`), lazy loading through the generated registry, error isolation when one page breaks;
- server compute (`POST /api/compute/<group>/<id>` importing the same `compute.js`), the AI proxy;
- what the tooling enforces (`npm run check`) and what it should.

Rank the five problems most likely to hurt as the app grows, with evidence from the code (file and line). For the top three, give the change as diffs, keeping the project's principles (no framework, no bundler in development, `core/` dependency-free). Say what you would deliberately not change.

---
id: reasoning-data-model-v2
title: The plan object, version 2
size: L
to: Claude (2nd account), ChatGPT, Gemini
output: report
read: docs/DATA_MODEL.md, core/schema/migrate.js, core/store.js, modules/transactions/ledger/compute.js, modules/transactions/import/compute.js, modules/balance/net-worth/compute.js
summary: Cents, splits, currencies, history, ids and a migration that cannot lose data.

Review `docs/DATA_MODEL.md` and `core/schema/migrate.js` and design schema version 2 where the current shape will hurt:
- money as floating-point dollars vs integer cents for the ledger and tax pages (say where each belongs and why);
- split transactions (one payment across categories), transfers as linked pairs, pending vs posted;
- accounts in more than one currency (the app offers MXN as well as USD);
- balance history per account vs the separate `netWorthHistory`, and how scenarios overlay the plan;
- stable ids, references that can dangle (a deleted account named by a goal), and how pages should handle them.

Deliver: the proposed shapes (as a diff to DATA_MODEL.md), `migrations[2]` in `migrate.js` that converts any v1 plan with no loss (and a test on the three fixtures in `qa/fixtures/*-plan.mjs` proving a round trip of every number), and a list of pages that must change, in order. Keep v1 plans opening forever.

---
id: reasoning-first-run-flow
title: The first ten minutes for someone who is not a finance person
size: M
to: Muse, Claude (2nd account), ChatGPT, Gemini
output: report
read: AGENTS.md, docs/DESIGN_LOG.md, modules/overview/dashboard/view.js, modules/household/people/view.js, modules/balance/net-worth/view.js, modules/cashflow/income/view.js, modules/cashflow/expenses/view.js
summary: From an empty plan to a dashboard that tells you something true.

Design the first-run experience for a layperson on a phone, from an empty plan to a dashboard that says something true and useful about their money, in about ten minutes. Read `docs/DESIGN_LOG.md` first: decisions already made there are settled and must not be re-proposed.

Deliver:
1. The flow as numbered screens: what each asks, in plain words, what can be skipped, what a rough answer looks like ("about $2,000 a month is fine"), and what the person sees change after each step.
2. Which numbers the dashboard can show honestly after each step, and which must wait (no fake precision).
3. The changes to make it real, as diffs to the dashboard and the pages it sends people to, following the design rules in AGENTS.md.

---
id: reasoning-planning-methodology
title: Is the planning method sound?
size: L
to: Claude (2nd account), ChatGPT, Gemini, Muse
output: report
read: core/math/retirement.js, modules/retirement/projection/README.md, modules/retirement/withdrawal-strategy/README.md, modules/system/assumptions/compute.js, modules/system/assumptions/README.md, modules/investments/glide-path/README.md, modules/retirement/monte-carlo/README.md
summary: Assumptions, inflation, taxes, withdrawals, glide path against current best practice.

Review the retirement and investment method as a fee-only planner who knows the research (Bengen, Trinity, Pfau, Kitces, Blanchett, ERN, Morningstar's safe-withdrawal-rate work, Bogleheads):
- the default assumptions and their sources (returns, volatility, inflation, salary growth, retirement and plan-end ages);
- real vs nominal handling, taxes (flat vs brackets), required withdrawals, Social Security timing;
- the four withdrawal strategies and guardrails; the glide path; sequence risk; Monte Carlo vs historical replay and what each can and cannot say;
- what a careful planner would add next (spending smile, long-term care, healthcare before 65, annuitisation, longevity risk) and in what order.

Rank the gaps by how much they could change a decision the owner makes. For each of the top three, give the change as diffs with tests and sources. Where reasonable experts disagree, say so and pick a default with the reason.

---
id: reasoning-security-review
title: Security review of the PC server and the AI paths
size: L
to: Claude (2nd account), ChatGPT, Gemini
output: report
read: server/server.mjs, server/statements.mjs, core/api.js, core/ai.js, docs/NETWORK.md, planner.properties.example, modules/ai/assistant/compute.js
summary: LAN server, token, CORS, uploads, AI proxy, prompt injection from statements.

The PC server serves the app and the plan to phones on the home network and over Tailscale. Review it as an attacker on the same Wi-Fi, a malicious web page open in the owner's browser, and a booby-trapped bank statement:
- static file serving and its deny list (already hardened against `a%5cb`, `name::$DATA`, 8.3 short names and trailing dots: try to break it anyway); path traversal; symlinks;
- the token: comparison, where it is stored, the `auth.trustLocal` exemption (now only for loopback Host and same-origin requests: check that rule), DNS rebinding, CORS `*`, and what an empty token (the default) exposes on a LAN;
- request size and rate limits, the statement upload path (PDF parsing with pdf.js and a canvas library), resource exhaustion;
- the AI proxy: SSRF through `ai.baseUrl`, keys in `planner.properties`, what plan data reaches the model;
- prompt injection: a statement or a page note that tells the model to do something; what the assistant can and cannot do with that.

Rank findings by realistic risk for one household. For each high or medium finding, give the fix as a diff and a test (see the server-test approach in prompts/quick/quick-server-tests.md if useful).

---
id: reasoning-live-sync
title: Two phones and a PC editing the same plan
size: L
to: Claude (2nd account), ChatGPT, Gemini
output: diff
read: core/store.js, core/api.js, server/server.mjs, docs/PLAN.md, docs/DATA_MODEL.md
summary: Change detection, conflicts, offline edits, without a database.

Today the last save wins: two devices editing at once can silently overwrite each other (the backups are the only safety net). Design and build the smallest sync that is safe for one household:
- detect a stale write (a version or `updatedAt` precondition on `PUT /api/plan`, `409` when stale) and tell the person in plain words;
- pull changes made elsewhere (poll or server-sent events; justify the choice for phones that sleep);
- merge rules per plan section (lists of items with ids can merge item by item; say which sections cannot) and what the screen says when a merge is not possible;
- edits made offline on a phone, then reconnecting.

Give the design in ten lines, then the code as diffs with tests (store logic in Node; server behaviour through the server's routes).

---
id: reasoning-encryption-at-rest
title: Encrypt the plan with a passphrase
size: L
to: Claude (2nd account), ChatGPT, Gemini
output: diff
read: core/store.js, core/api.js, server/server.mjs, docs/PLAN.md, modules/system/settings/view.js
summary: WebCrypto AES-GCM in the browser; the PC only ever stores ciphertext.

`docs/PLAN.md` plans optional encryption at rest. Design and build it:
- key derivation from a passphrase (PBKDF2-SHA256 with WebCrypto, iteration count justified for a phone; say whether Argon2 is worth a dependency), a random salt, AES-GCM with a fresh nonce per save;
- what is encrypted (the plan, backups) and what cannot be (server-side heavy compute needs plaintext: say how heavy pages behave when the plan is encrypted);
- unlocking on each device, remembering the key for a session, changing the passphrase, and what happens if it is forgotten (say it plainly on screen: the data is gone);
- the file format with a version byte so it can change later.

Diffs with tests for the crypto envelope (Node 20 has `globalThis.crypto.subtle`).

---
id: reasoning-ai-guardrails
title: Guardrails for the AI features
size: M
to: Claude (2nd account), ChatGPT, Gemini, Muse
output: report
read: core/ai.js, modules/ai/assistant/compute.js, modules/ai/assistant/view.js, modules/transactions/categorize/compute.js, server/statements.mjs, docs/PLAN.md
summary: Numbers the model must not invent, data it must not see, instructions it must not follow.

The rule is "math in code, AI for language". Review how well the code enforces it:
- the assistant's system prompt and the plan summary it gets: what could the model state as a number that no page computed? How can the answer be checked against computed values before it is shown?
- statement reading: model output parsed into transactions; what stops a hallucinated or injected row from reaching the plan without the person seeing it?
- categorisation suggestions: confidence, and when a suggestion becomes a rule;
- what plan data each feature sends, and whether it could send less.

Propose concrete guardrails (structured output with validation, a numbers-must-match check, a review step) and implement the two most valuable as diffs with tests that use canned model outputs (no live model in tests).

---
id: reasoning-next-best-action
title: "What should I do with my next dollar?" as code
size: M
to: Muse, ChatGPT, Claude (2nd account), Gemini
output: diff
read: modules/overview/next-best-action/README.md, modules/overview/alerts/compute.js, modules/balance/liquidity/compute.js, modules/balance/liabilities/compute.js, modules/retirement/contributions/compute.js, docs/RESOURCES.md
summary: The well-known priority order as a pure, explainable function.

Build the compute for the planned page `overview/next-best-action`: given the plan, return the next one to three steps in the commonly taught order (cover essentials, a starter emergency fund, the full employer match, high-interest debt, a full emergency fund, tax-advantaged retirement saving, other goals and debts, taxable investing), each with the reason in plain words and the page to open.

Decide and document every threshold ("high interest" above what rate and why; starter fund of how many months), handle households with no employer plan, irregular income, or debt already being paid off. Write it as a pure function in `modules/overview/next-best-action/compute.js` that reuses other pages through their computes, with twenty tests of invented households, and a README that shows the decision table. The view can stay a placeholder unless you have room.

---
id: reasoning-scenarios-engine
title: What-if scenarios that every page understands
size: L
to: Claude (2nd account), ChatGPT, Gemini
output: diff
read: docs/DATA_MODEL.md, docs/PLAN.md, core/store.js, core/app.js, modules/scenarios/compare/README.md, core/math/retirement.js
summary: Overlays on the plan, computed side by side, without forking the data.

Scenarios are planned as partial overlays (`scenarios[].overrides`) applied on top of the plan. Design and build the core:
- the overlay format (deep-merge rules, how list items are added, changed or removed by id), and `applyScenario(plan, scenario)` in `core/` with exhaustive tests;
- how a page computes under a scenario (`ctx.computeOf(key, { scenario })` or a scenario-aware context) without each page knowing about scenarios;
- the compare page's core numbers (net worth in 10 and 20 years, retirement success, lifetime tax, debt-free date) computed for the base plan and each scenario;
- the edge cases: an override pointing at an item that no longer exists, a scenario older than the schema.

Diffs with tests; the compare view can be minimal.

---
id: reasoning-large-plans
title: Fifty thousand transactions on a phone
size: M
to: Claude (2nd account), ChatGPT, Gemini, DeepSeek
output: diff
read: core/store.js, modules/transactions/ledger/compute.js, modules/transactions/ledger/view.js, modules/cashflow/spending/compute.js, ROADMAP.md, docs/PLAN.md
summary: Storage, compute and rendering limits, and the fixes in order.

The roadmap expects the browser copy to outgrow localStorage (about 5 MB) once a plan holds a few thousand transactions. Measure and fix:
1. Write a generator for an invented plan with 50,000 transactions over ten years and time (in Node) the computes of the transaction and cash-flow pages, and the JSON size.
2. Move the browser copy to IndexedDB behind the same `store` interface (keep localStorage as a fallback for small plans and private windows), with a migration on first load.
3. Fix the two slowest computes (indexes by month or account computed once, not per page) and make the ledger render the visible rows only.

Report the before and after numbers. Diffs with tests.
