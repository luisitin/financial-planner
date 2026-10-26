# Quick
Minutes of work for one agent (or a few small helpers): one focused fix, one table, one small dataset. Any chat model can do these in one answer.

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
- with a token set: a request without it gets 401; a request from 127.0.0.1 without it passes only when the Host is loopback and there is no foreign `Origin` header;
- with no token: a request with a foreign or `null` `Origin`, or with a public `Host` name (DNS rebinding), gets 401; IP addresses, one-word names, `.local`/`.lan`/`.home.arpa`/`.internal`/`.ts.net` names and names listed in `server.hosts` pass.

The child process must be killed in `after()` even when a test fails.

---
id: quick-state-tax-tables
title: Every state's income tax as data (2025, 2026)
size: M
effort: One agent, about 15 minutes (or 26 small helpers, two states each, in a couple of minutes)
to: ChatGPT, Gemini, Perplexity, Claude (2nd account), Claude Code
output: data
read: docs/DATA_MODEL.md, modules/taxes/state/README.md, modules/taxes/state/module.js, core/math/tax.js, modules/taxes/federal/data/federal.js
summary: All 50 states and DC in one data file, every figure from the state's own revenue department.

The planned State tax page (`taxes/state`) needs each state's personal income tax as data. Produce `modules/taxes/state/data/states.js` for all 50 states and the District of Columbia, tax years 2025 and 2026, in exactly this shape:

```js
export const STATES = {
  CA: {
    2025: {
      kind: "brackets",            // "brackets" | "flat" | "none" | "interest-dividends-only" | "capital-gains-only"
      brackets: { single: [[0, 0.01], [10756, 0.02]], married_joint: [...], married_separate: [...], head_of_household: [...] },
      standard: { single: 5540, married_joint: 11080, married_separate: 5540, head_of_household: 11080 },   // 0 if none
      exemption: { personal: 149, dependent: 461, kind: "credit" },   // "deduction" or "credit"
      startsFrom: "federal-agi",   // "federal-agi" | "federal-taxable" | "own"
      retirement: { socialSecurityTaxed: false, pensionExclusion: null },   // the state's retirement-income rules, with limits
      notes: ["mental health services tax: 1% over $1,000,000"],   // anything the simple model leaves out
      source: "https://... (the revenue department's own rate schedule or form instructions)",
    },
    2026: { ... },
  },
  TX: { 2025: { kind: "none", source: "..." }, 2026: { kind: "none", source: "..." } },
};
```

Rules:
- Every number comes from the state's revenue department (rate schedule or form instructions), never an aggregator. Where 2026 is not yet published, carry 2025 forward and add `"projected: not yet published"` to `notes`.
- States that cut rates on a schedule or a revenue trigger (for example Arkansas, Georgia, Indiana, Iowa, Kentucky, Louisiana, Mississippi, Missouri, Nebraska, North Carolina, Ohio, Oklahoma, South Carolina, West Virginia): note the schedule and the trigger.
- Local income taxes (New York City, Yonkers, Maryland counties, Pennsylvania and Ohio localities, Michigan cities, Indiana counties, Kansas City and St. Louis) go in `notes`; they are not modelled.
- Washington's capital-gains excise tax and New Hampshire's interest-and-dividends tax (for the years it applies) get their own `kind`.

Then add `tests/state-tax-data.test.mjs`: the shape for every state and year, brackets ascending, rates between 0 and 15%, and one hand-worked return per state that has an income tax. If your tool can run helpers, give each two states; one agent alone is fine too.

---
id: quick-contribution-limits
title: Contribution limits, 2015 to 2027, every account type
size: M
effort: One agent, about 15 minutes
to: ChatGPT, Perplexity, Gemini, DeepSeek
output: data
read: modules/retirement/contributions/data/limits.js, modules/investments/limits/compute.js, modules/investments/limits/README.md, modules/retirement/contributions/compute.js
summary: 401(k)/403(b)/457, IRA, Roth phase-outs, HSA, FSA, SIMPLE, SEP, catch-ups, the 60-63 super catch-up.

Extend `modules/retirement/contributions/data/limits.js` so it holds every year from 2015 to 2027. Keep its current shape; add fields if needed, and update the two computes that read it. Cover:
- the elective deferral limit (401(k), 403(b), governmental 457(b)), the catch-up at 50+, the SECURE 2.0 super catch-up for ages 60 to 63 (from 2025), and the 2026 rule that catch-ups for wages over the threshold must be Roth;
- the total annual additions limit (415(c)); the SIMPLE IRA limit and its catch-ups; the SEP percentage and dollar cap;
- the IRA and Roth IRA limit and catch-up; the Roth income phase-out ranges and the deductible-IRA phase-outs, by filing status;
- the HSA self and family limits and the 55+ catch-up; the health FSA limit and carryover; the dependent-care FSA;
- the annual gift exclusion (for front-loading a 529).

Cite each year's IRS notice or revenue procedure. A 2027 figure not yet announced on the day you answer is marked projected, with how you projected it. Tests: the table's shape, rising where the law says so, and five hand-checked "room left" cases.

---
id: quick-rmd-tables
title: Required minimum distributions: tables, start ages, worked cases
size: S
effort: One agent, about 10 minutes
to: ChatGPT, Gemini, DeepSeek, Perplexity
output: diff
read: core/math/rmd.js, modules/retirement/rmd/compute.js, modules/retirement/rmd/README.md, modules/retirement/rmd/module.test.mjs
summary: Uniform Lifetime, Joint and Last Survivor, Single Life; the SECURE 2.0 start ages.

Check and extend `core/math/rmd.js` against IRS Publication 590-B (the tables in effect from 2022):
- the full Uniform Lifetime Table (ages 72 to 120+); the Joint and Last Survivor table for a spouse more than ten years younger (at least the rows the app needs, and how to look up the rest); the Single Life table for inherited accounts;
- the start age by birth date: 70½ (born before July 1, 1949), 72 (born July 1, 1949 to 1950), 73 (born 1951 to 1959), 75 (born 1960 or later); the first-year deadline of April 1 of the following year, and the double withdrawal that deadline creates;
- the 10-year rule for most non-spouse beneficiaries, and the yearly withdrawals still required when the owner had already started.

Twenty worked cases as tests: the balance on December 31 of the prior year, the age, the divisor and the required withdrawal to the cent.

---
id: quick-health-cost-tables
title: Health cost tables: marketplace subsidies and Medicare income surcharges
size: M
effort: One agent with web search, about 15 minutes
to: ChatGPT, Perplexity, Gemini, Claude (2nd account)
output: data
read: modules/retirement/healthcare/README.md, modules/retirement/medicare/README.md, docs/DATA_MODEL.md, core/math/tax.js
summary: Federal poverty guidelines, the subsidy percentages, and the Medicare surcharge (IRMAA) brackets and premiums.

Two planned pages need tables. Produce both as data modules with sources, plus tests that use them:
1. `modules/retirement/healthcare/data/aca.js`: the federal poverty guidelines (48 states, Alaska, Hawaii) for coverage years 2024 to 2027; the applicable-percentage table for each coverage year (say plainly what happened to the enhanced subsidies after 2025 and to the 400% cliff, with the law and the date); and the income the subsidy counts (modified AGI, which adds back untaxed Social Security and tax-exempt interest).
2. `modules/retirement/medicare/data/medicare.js`: the Part B standard premium and deductible, the Part D base premium, and the income-related surcharge (IRMAA) brackets for single and joint filers with the two-year look-back on income, for 2024 to 2027. 2027 figures not yet announced are marked projected.

Tests: a 63-year-old couple's subsidy at 150%, 300%, 400% and 450% of the poverty line for a second-lowest-cost silver premium you state, and five surcharge lookups at bracket edges.

---
id: quick-life-tables
title: Life tables for "How long to plan for"
size: S
effort: One agent, about 10 minutes
to: ChatGPT, Gemini, DeepSeek, Perplexity
output: data
read: modules/retirement/longevity/compute.js, modules/retirement/longevity/README.md, modules/retirement/longevity/module.test.mjs
summary: The SSA period life table as data, survival for one person and a couple, and how far the page's curve fit drifts from the table.

The longevity page fits a Gompertz curve. Add the real table and measure the fit:
1. `modules/retirement/longevity/data/ssa-life-table.js`: the latest SSA period life table (from the Trustees Report actuarial tables): the probability of death q(x) at every single age from 0 to 119, male and female, with the table year and the source link.
2. Survival from any age to every later age, for one person and for a couple (at least one alive), from the table.
3. For ages 50, 60, 65, 70 and 80: the age with a 50%, 25% and 10% chance of being reached, from the table and from the code's Gompertz fit, and the difference.

Tests from step 3 (the table's values), and a note in the README on when the fit is good enough.

---
id: quick-glossary
title: A plain-words glossary of every term the app uses
size: M
effort: One agent, about 20 minutes
to: Muse, ChatGPT, Gemini, Le Chat
output: data
read: modules/ai/glossary/README.md, modules/ai/glossary/module.js, docs/MODULE_CATALOG.md
summary: Definitions a teenager would understand, each linked to the pages that use the term.

The planned page `ai/glossary` needs content. Collect every financial term the app's pages and catalog use (start from the catalog purposes and the usable pages' views) and write `modules/ai/glossary/data/terms.js`: `{ term, aka: [...], plain: "one or two sentences a 15-year-old would understand", example: "a short worked example with invented numbers", pages: ["group/id", ...] }`. At least 120 terms, accurate for US rules, with no circular definitions. Add a test that every page key it names exists in the catalog.
