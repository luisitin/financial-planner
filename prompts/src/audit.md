# Audit
Fresh eyes on what the builders cannot see in their own work.

---
id: audit-accessibility
title: Accessibility audit (WCAG 2.2 AA) of the shell and ten pages
size: M
to: Claude (2nd account), ChatGPT, Gemini, Copilot
output: report
read: index.html, core/app.js, core/ui/dom.js, core/ui/base.css, modules/overview/dashboard/view.js, modules/balance/net-worth/view.js, modules/cashflow/forecast/view.js, modules/retirement/charts.js
summary: Contrast in both themes, keyboard paths, screen-reader names, charts, motion.

Audit against WCAG 2.2 AA, reading the code (you cannot run it): colour contrast of every token pair in `core/ui/base.css` in light and dark mode (compute the ratios), focus visibility and order, the menu drawer as a keyboard and screen-reader user, form labels and errors, the status pill, the stat tiles, the inline-SVG charts (text alternative, data available as text), touch target sizes, and reduced motion.

Rank findings by how many pages they affect. Fix the shared ones (`core/ui/*`, `base.css`) as diffs; list page-level ones with the file and line. Keep the design: the visual result should not change except where contrast fails.

---
id: audit-licences
title: Licence and attribution audit for a public MIT repo
size: M
to: Claude (2nd account), ChatGPT, Gemini, Perplexity
output: report
read: LICENSE, docs/RESOURCES.md, tools/extract-tax.mjs, tools/extract-ssa.mjs, tools/extract-history.py, tools/extract-shiller.py, modules/taxes/federal/README.md, modules/retirement/social-security/README.md, package.json
summary: Every lifted table and dependency checked; a NOTICE file with the attributions.

The repo is now public under MIT. Check everything that came from somewhere else: the data tables under `modules/*/*/data/` (tax figures extracted from UsTaxes, Social Security tables from ssa.tools, Damodaran and Shiller return data, the fund list), the npm dependencies and their licences (`pdfjs-dist`, `@napi-rs/canvas`, `esbuild`), and any code a README says was lifted.

For each: the source, its licence or terms, whether including it in an MIT repo is fine (facts and government data vs creative expression; data-set terms of use), and the attribution it needs. Deliver a `NOTICE.md` with the attributions, README edits where a module's source note is incomplete, and a list of anything that should be removed or replaced, with the reason.

---
id: audit-privacy
title: Fresh-eyes privacy check of the public repo
size: M
to: Claude (2nd account), ChatGPT, Gemini
output: report
read: tools/leak-guard.mjs, .leakguard-allow, .gitignore, README.md, docs/NETWORK.md, qa/households/README.md, qa/fixtures/sample-plan.mjs, docs/FEEDBACK.md
summary: Look for anything personal that slipped through, and holes in the leak guard.

This repo was scrubbed of the owner's personal details before it went public, and a pre-commit leak guard (`tools/leak-guard.mjs`, rules plus a private scrub list that is not in the repo) now refuses emails, phone numbers, SSN and account-number shapes, IPs, user folders, keys and private paths.

1. Read the repo as someone trying to learn who owns it and what they have: names, places, employer, family, health, balances, the advisor, the machine. Anything that narrows it down, even indirectly (a consistent city in test data, a distinctive amount repeated across fixtures, a product name), is a finding.
2. Attack the guard: list text that would slip past its rules (formatting tricks, Unicode look-alikes, numbers split by spaces, base64, images), and propose rule changes with tests (`tests/leak-guard.test.mjs` running the guard on temporary git repositories).

Do not include any real person's data in your answer; describe a finding by file and line.

---
id: audit-test-gaps
title: Which formulas have no test?
size: M
to: ChatGPT, Gemini, Claude (2nd account), DeepSeek
output: diff
read: AGENTS.md, tests/modules.test.mjs, core/math/finance.js, core/math/retirement.js, core/math/tax.js, docs/MODULE_CATALOG.md
summary: A coverage map of exported functions and branches, then tests for the worst gaps.

AGENTS.md requires a test for every formula. Find where that is not true:
1. Using Node's built-in coverage (`node --test --experimental-test-coverage`), or by reading if you cannot run it, list the exported functions in `core/math/*` and the usable pages' `compute.js` files with no test, and the branches never taken (zero balances, missing dates, negative inputs, empty lists).
2. Rank them by the size of the number they affect on screen.
3. Write the tests for the top twenty, worked by hand in comments, as diffs. Mark any that expose a bug as `todo` and lead with those.

Also propose a small `npm run coverage` script and a threshold that would not block today's code.

---
id: audit-performance
title: Performance on a mid-range phone
size: M
to: Claude (2nd account), ChatGPT, Gemini
output: report
read: core/app.js, core/store.js, core/router.js, index.html, modules/registry.js, modules/retirement/projection/compute.js, modules/retirement/monte-carlo/compute.js
summary: First load, page switches, re-render on every save, heavy computes.

Reading the code (and timing in Node where you can), find what makes the app slow on a mid-range phone:
- first load: how many module files load before the dashboard shows, and whether the registry or the shell pulls in pages it does not need;
- page switches and the full re-render after every `store.update`;
- computes that call other pages' computes repeatedly (the dashboard and Needs attention fan out), and the heavy retirement simulations when the PC is not reachable.

Give measurements or estimates with the method, then the three changes with the biggest gain as diffs (memoising computes per plan version is one candidate: check it against the store's update model).

---
id: audit-dependencies
title: Dependencies and the supply chain
size: S
to: ChatGPT, Claude (2nd account), Gemini, Copilot
output: report
read: package.json, package-lock.json, server/statements.mjs, tools/build.mjs, tools/fetch-vendor.mjs
summary: What each dependency can do on the PC, pinning, and safer defaults.

The app has two runtime dependencies on the PC server (`pdfjs-dist` for reading statements and `@napi-rs/canvas` for rendering scanned pages) and `esbuild` for the single-file build, plus vendored reference projects fetched by `tools/fetch-vendor.mjs`.

Check: known advisories for the locked versions; native code and install scripts; what a malicious PDF can reach through pdf.js in Node (scripting, fonts, memory); whether the vendor fetcher pins commits and verifies what it downloads; and whether `npm ci` with `--ignore-scripts` would still work. Deliver findings ranked by risk and the fixes as diffs (pinning, pdf.js options that disable scripting and limit work, a documented update routine).
