# Quick
One focused improvement each. Any chat model can do these in one answer.

---
id: quick-networth-since-line
title: Net worth: "+$X since last time" line and a small history chart
size: S
to: ChatGPT, Gemini, Muse, Claude (2nd account)
output: diff
read: AGENTS.md, docs/FEEDBACK.md, modules/balance/net-worth/view.js, modules/balance/net-worth/compute.js, modules/retirement/charts.js, core/ui/dom.js
summary: Closes the open half of tester item F-024 on the Net worth page.

Tester item F-024 in `docs/FEEDBACK.md` is still open. The Net worth compute already returns `change.sinceLast`, `change.since` and `history[]`, but the page never shows them.

Add, in `modules/balance/net-worth/view.js` only:
- under the Net worth tile, one line such as "+$77,700 since June 1, 2026 (+7.8%)" in green, red for a fall, and nothing at all when there is no earlier saved point;
- a small line chart of the saved history (two or more points), drawn with the shared inline-SVG helper in `modules/retirement/charts.js` at phone size, with a sentence instead of a chart when there is only one point.

Keep the page's existing structure and confirmations. Dates in words ("June 1, 2026"), money through `ctx.fmt.money`.

---
id: quick-doc-link-targets
title: Docs reader: links inside the text are too small to tap
size: S
to: ChatGPT, Gemini, Muse, Copilot
output: diff
read: AGENTS.md, docs/FEEDBACK.md, modules/system/docs/view.js, core/ui/base.css
summary: Closes tester item F-027 for the in-app document reader.

Tester item F-027: links inside the rendered documents (System > Docs) are 17 to 20 px tall; the app's rule is 44 px tap targets. Choose one fix and apply it:
(a) style `.doc a` so each link has a 44 px tall tap area without changing the line spacing of the text around it (for example padding plus a negative margin), or
(b) add a one-line exemption for links in running text to the "Design rules" in AGENTS.md and make links visibly larger and underlined.

Explain your choice in the rationale. Scope any CSS inside the docs page's own selectors (no new global rules), and check it in dark mode too.

---
id: quick-ofx-import
title: Import OFX and QFX bank files
size: M
to: ChatGPT, Gemini, Claude (2nd account), DeepSeek
output: diff
read: core/csv.js, modules/transactions/import/compute.js, modules/transactions/import/README.md, tests/csv.test.mjs, tests/import-banks.test.mjs
summary: A dependency-free OFX/QFX reader feeding the existing import pipeline.

Banks offer OFX/QFX/QBO downloads as well as CSV. Add `core/ofx.js`, dependency-free, that reads both OFX 1.x (SGML, unclosed tags) and OFX 2.x (XML) and returns the same row shape the CSV path hands to `prepareRows` in `modules/transactions/import/compute.js`: date (`YYYY-MM-DD` from `DTPOSTED`, any timezone suffix ignored), amount (`TRNAMT`, keep the sign), payee (`NAME`, else `MEMO`), the bank's own id (`FITID`, used for duplicates), plus the account id and the ledger balance with its date.

Wire it into the import compute so a file that starts with `OFXHEADER` or `<?xml ... <OFX>` goes through it, and say in `modules/transactions/import/README.md` how it works.

Tests in `tests/ofx.test.mjs` with three small invented files (an SGML checking export, an XML credit-card export where charges are negative, and one with two accounts) written inline in the test.

---
id: quick-csv-hardening
title: CSV reader: the formats real banks produce
size: S
to: ChatGPT, DeepSeek, Gemini, Copilot
output: diff
read: core/csv.js, tests/csv.test.mjs, modules/transactions/import/compute.js, tests/import-banks.test.mjs
summary: BOM, semicolons, European decimals, (12.34) negatives, CR/DR suffixes.

Make `core/csv.js` and the amount/date parsing used by `modules/transactions/import/compute.js` handle what bank exports really contain, each with a test in `tests/csv.test.mjs`:
- a UTF-8 byte-order mark; `\r\n`, `\n` and lone `\r` line ends; a quoted field containing line breaks and doubled quotes;
- semicolon and tab delimiters, detected from the header line;
- amounts like `1.234,56` (European), `(12.34)` (accounting negative), `12.34-`, `12.34 CR` / `12.34 DR`, `$1,234.56`, `−12.34` (Unicode minus);
- dates like `2026-09-01`, `09/01/2026`, `01.09.2026` (with the order worked out from the whole column, not one row), `1 Sep 2026`;
- blank trailing lines and a summary line at the end ("Total", "Ending balance").

Do not add a dependency. If a rule could misread a valid file (for example day/month order), explain how the column-wide check prevents it.

---
id: quick-search-aliases
title: Search: let people find pages in their own words
size: S
to: Muse, ChatGPT, Gemini, Grok
output: diff
read: core/search.js, tests/search.test.mjs, docs/MODULE_CATALOG.md, modules/balance/net-worth/module.js, modules/debt/payoff/module.js
summary: Plain-words aliases on every usable page so search hits first-person questions.

Manifests may carry `aliases: [...]`: phrases a person might type, matched by `core/search.js`. Most pages have none.

For every page whose status is `usable` in `docs/MODULE_CATALOG.md`, add three to six aliases in plain first-person words ("how much do I owe", "when can I retire", "am I saving enough", "what is my tax bill"), no jargon, no duplicates of the title. Edit only the `aliases` field of each `module.js`.

Add tests to `tests/search.test.mjs` for twenty realistic questions and the page each should rank first.

---
id: quick-alerts-milestones
title: Needs attention: age milestones in the next twelve months
size: S
to: ChatGPT, Gemini, Claude (2nd account), Muse
output: diff
read: modules/overview/alerts/compute.js, modules/overview/alerts/module.test.mjs, modules/overview/alerts/README.md, core/math/dates.js, core/math/rmd.js, modules/household/people/compute.js
summary: 59½, 62, 65 Medicare window, full retirement age, required withdrawals.

Needs attention already flags "retires in about a year". Add an "info" item for each adult in the plan who reaches one of these within the next twelve months, with the date and the page to open:
- 59½: withdrawals from retirement accounts without the 10% early penalty (Retirement contributions);
- 62: earliest Social Security (Social Security);
- the three months before turning 65: the Medicare sign-up window opens (Healthcare page is planned; point to Social Security for now);
- full retirement age for Social Security by birth year (66 and 2 months ... 67);
- the year required minimum distributions start (73, or 75 for those born in 1960 or later; use `core/math/rmd.js`).

Plain words on screen ("You can start Social Security in March 2027"), never the abbreviation alone. Tests with invented people around each boundary (the day before, the day of, twelve months and a day).

---
id: quick-dates-edge-tests
title: Dates and pay periods: the edge cases
size: S
to: DeepSeek, ChatGPT, Gemini, Copilot
output: diff
read: core/math/dates.js, core/math/periods.js, tests/periods-dates.test.mjs
summary: Leap-day birthdays, month-end arithmetic, 27-paycheck years.

Add tests to `tests/periods-dates.test.mjs`, and fix the code if a test shows a bug:
- a February 29 birthday: age on February 28 and March 1 of non-leap years;
- adding months from January 31, August 31 and February 29;
- months between two dates when the end day is shorter than the start day;
- a biweekly schedule that has 27 paydays in a year (2026 has one for some start dates), and what `periods.js` assumes per year (26 vs 26.0893);
- semimonthly paydays when the 15th or the last day falls on a weekend (only if the code models it; otherwise document that it does not);
- dates parsed as local days in a timezone west of UTC (the app had a one-day-early bug there).

---
id: quick-format-locales
title: Number and money formatting: locales and odd values
size: S
to: Muse, ChatGPT, Copilot, Le Chat
output: diff
read: core/format.js, tests/format.test.mjs, modules/system/settings/view.js
summary: es-MX and MXN, negative zero, half-cent rounding, huge and tiny values.

`core/format.js` formats every number on screen. Add tests, and fix what they expose:
- `money` in `en-US`/USD and `es-MX`/MXN (the Settings page offers both): grouping, the currency sign's position, negatives;
- `-0` and values that round to zero: never show "-$0";
- half-cent values (1.005, 2.675): say which rounding the app uses and keep it consistent;
- 1e12 and 1e15 (the stat tiles must still wrap only at commas), 0.0001 as a percentage, `NaN`, `null`, `undefined`, `Infinity`: a dash, never "NaN";
- `signed` for gains and losses.

---
id: quick-form-accessibility
title: Forms and notices that screen readers can follow
size: S
to: ChatGPT, Gemini, Claude (2nd account), Copilot
output: diff
read: AGENTS.md, core/ui/dom.js, core/ui/base.css, modules/cashflow/income/view.js
summary: Labels tied to inputs, help text announced, errors and confirmations spoken.

In `core/ui/dom.js` (`field`, `input`, `select`, `form`, `notice`, `stat`):
- every input has a `<label for>` tied to its `id`; help text is linked with `aria-describedby`;
- a field that fails validation gets `aria-invalid="true"` and its message is linked too;
- `ui.notice("ok" | "error", ...)` renders with `role="status"` (ok) or `role="alert"` (error) so the green and red confirmations are announced;
- stat tiles read as "Net worth: $1,234" to a screen reader, not as two unrelated texts;
- focus moves to the first invalid field when a form is refused.

No visual change. Keep the API of `ui.*` unchanged so no page needs editing.

---
id: quick-shares-property-tests
title: Percentages that add up to 100: property tests
size: S
to: DeepSeek, ChatGPT, Qwen, Gemini
output: diff
read: core/math/shares.js, tests/feedback-fixes.test.mjs, modules/cashflow/expenses/compute.js
summary: Largest-remainder rounding checked on thousands of random inputs.

`core/math/shares.js` rounds category shares with the largest-remainder method so they add up to exactly 100 (tester item F-009). Add property-style tests in `tests/shares.test.mjs` driven by a small seeded random generator written in the test (no dependency): for a few thousand random lists of 1 to 40 positive amounts, the rounded shares sum to 100, each is within 1 of its exact value, larger amounts never get a smaller share than smaller ones, and the result does not depend on the input order beyond ties (state the tie rule). Also: all zeros, one item, negative or `NaN` entries (decide and document what happens).

---
id: quick-empty-plan-sweep
title: Every page's compute on an empty and a full plan
size: S
to: ChatGPT, Claude (2nd account), Gemini, Codex
output: diff
read: tests/modules.test.mjs, core/schema/migrate.js, qa/fixtures/sample-plan.mjs, qa/fixtures/retirement-plan.mjs, modules/registry.js
summary: One test that runs all 154 computes against edge plans and checks the output is sane.

Add `tests/compute-sweep.test.mjs`: for every module in `modules/registry.js`, import its `compute.js` and run `compute(plan, {})` against (1) `emptyPlan()` from `core/schema/migrate.js`, (2) `qa/fixtures/sample-plan.mjs`, (3) `qa/fixtures/retirement-plan.mjs`, (4) a plan with every list holding one item whose numbers are 0, negative, 1e12 or missing.

Each run must not throw, must return a plain JSON-serialisable object (round-trip through `JSON.stringify`), and must contain no `NaN` or `Infinity` anywhere in the output (walk it). Report which modules fail in your answer and fix the ones whose fix is a one-line guard; list the rest.

---
id: quick-payee-cleanup
title: Clean payee names for thirty common bank descriptors
size: S
to: Muse, ChatGPT, Grok, Gemini
output: diff
read: modules/transactions/rules/compute.js, modules/transactions/rules/module.test.mjs, qa/fixtures/chase-checking.csv, qa/fixtures/bofa-checking.csv
summary: SQ *, TST*, PAYPAL *, AMZN Mktp, POS DEBIT and friends.

`normalizePayee` and `prettyPayee` in `modules/transactions/rules/compute.js` turn bank text into a readable payee. Extend them for at least thirty common US descriptor shapes, each with a test: card processors (`SQ *`, `TST*`, `SP *`, `PAYPAL *`, `PP*`, `IC*`), marketplaces (`AMZN Mktp US*2K3AB1`, `Amazon.com*`), `POS DEBIT`, `CHECKCARD 0901`, `ACH DEBIT`, `ZELLE TO`, `VENMO PAYMENT`, `APPLE.COM/BILL`, `GOOGLE *`, store numbers (`#0421`, `00012345`), city and state endings, reference numbers and dates. Invented store numbers and cities only. Never strip a word that would merge two different merchants; add a test that proves it for two look-alikes.

---
id: quick-recurring-cadences
title: Bills page: every real billing rhythm
size: S
to: ChatGPT, Gemini, DeepSeek, Claude (2nd account)
output: diff
read: modules/cashflow/recurring/compute.js, modules/cashflow/recurring/module.test.mjs, modules/cashflow/recurring/README.md, core/math/periods.js
summary: Semimonthly, quarterly, yearly, month-end and weekend-shifted bills.

Make the recurring-payment detection in `modules/cashflow/recurring/compute.js` find, from transactions, bills that arrive:
twice a month (1st and 15th), every four weeks vs monthly, quarterly, once a year (with only two occurrences), on the last day of the month (28 to 31), and shifted to the next business day when the date falls on a weekend; and keep rejecting shops visited often with uneven amounts.

Each rhythm gets a test with invented transactions, including ±3 days of jitter and one missed occurrence. State the detection rule in the README with the thresholds.

---
id: quick-server-tests
title: Tests for the PC server: deny list, token, plan round trip
size: M
to: Claude (2nd account), ChatGPT, Codex, Gemini
output: diff
read: server/server.mjs, docs/PLAN.md, planner.properties.example, tests/modules.test.mjs
summary: Start the server on a spare port in a temporary folder and prove its rules.

The server (`server/server.mjs`) has no tests. Add environment overrides `PLANNER_PORT`, `PLANNER_BIND` and `PLANNER_DATA_DIR` (documented in `planner.properties.example`, taking priority over the file), then `tests/server.test.mjs` that starts it as a child process on a free port with a temporary data folder and checks:
- `GET /api/health` and `/api/config` (no secrets in it);
- the plan round trip (`PUT` then `GET /api/plan`) and that a backup file appears;
- static files are served, and these are refused with 403: `planner.properties`, `data/...`, `private/...`, `.git/config`, `a%5cb` paths, `name::$DATA`, 8.3 short names (`PLANNE~1.PRO`), trailing dots and spaces;
- with a token set: a request without it gets 401; a request from 127.0.0.1 without it passes only when the Host is loopback and there is no foreign `Origin` header.

The child process must be killed in `after()` even when a test fails.
