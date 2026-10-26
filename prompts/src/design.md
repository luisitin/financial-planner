# Design and words
Plain words, empty states, help text, charts and Spanish. The settled decisions in docs/DESIGN_LOG.md are not up for debate.

---
id: design-plain-words
title: Plain words everywhere: a jargon sweep
size: M
to: Muse, ChatGPT, Claude (2nd account), Gemini
output: diff
read: AGENTS.md, docs/DESIGN_LOG.md, docs/MODULE_CATALOG.md, modules/system/assumptions/view.js, modules/taxes/federal/view.js, modules/retirement/withdrawal-strategy/view.js, modules/investments/allocation/view.js
summary: Every label, help line and purpose a layperson would stumble on, rewritten.

Rule 14 in AGENTS.md: titles, labels, purposes and help text are plain words; abbreviations (RMD, DTI, IRMAA, AGI, MAGI, ETF, TWR, IRR, SWR...) are spelled out or replaced. Scan every usable page's `view.js` and `module.js` (`purpose`) and the purposes in `docs/MODULE_CATALOG.md` for:
- abbreviations and finance or developer terms on screen;
- sentences longer than about 20 words, passive voice, and labels that describe the system instead of what the person does.

Deliver a table (file, current text, proposed text) and the diffs. Keep meaning exact: a plain rewrite that changes what a number means is worse than jargon. Do not touch anything `docs/DESIGN_LOG.md` records as decided.

---
id: design-chart-kit
title: One small chart kit for every page
size: M
to: Claude (2nd account), ChatGPT, Gemini, Muse
output: diff
read: AGENTS.md, docs/FEEDBACK.md, docs/DESIGN_LOG.md, modules/retirement/charts.js, modules/cashflow/forecast/view.js, modules/investments/allocation/view.js, core/ui/base.css
summary: Promote the retirement chart helper to core/ui: line, bars, progress, with the settled look.

Charts exist in three places with three styles (`modules/retirement/charts.js`, the forecast's balance line, the allocation bars). Tester item F-024 asks for history lines, share bars, goal progress and a debt payoff timeline.

Make `core/ui/chart.js` (inline SVG, no library, dependency-free like the rest of `core/`) with `line`, `bars` and `progress`, carrying the look the design log settled (phone-size labels of 11 px, an accent line with a soft fill, a marked low or end point, gridlines that hug the data, a sentence instead of an empty chart, colours from the CSS tokens so dark mode works, a text alternative). Move the retirement pages onto it without visual change, then use it on Net worth (history), Expenses (shares), Goals (progress) and Debts (payoff timeline). Diffs, with Node tests of the pure scale and tick functions.

---
id: design-established-dashboard
title: The dashboard once the plan is set up
size: M
to: Muse, Claude (2nd account), ChatGPT, Gemini
output: diff
read: AGENTS.md, docs/DESIGN_LOG.md, modules/overview/dashboard/view.js, modules/overview/dashboard/compute.js, modules/overview/alerts/compute.js, core/phases.js
summary: What someone with a finished plan should see first each time they open the app.

The dashboard was designed around setup. For a household whose plan is complete, design what it shows each visit: the three or four numbers that matter (net worth and its change, this month's spending against plan, the retirement verdict, the next action), Needs attention with its count, and what changed since the last visit. The design log records that the build-phase list stays "for now": keep it, folded, below everything else.

Describe the layout in a short text wireframe for a 390 px phone, then implement it in `modules/overview/dashboard/view.js` (and its compute, if a number is missing) following the design rules. Diffs.

---
id: design-empty-states
title: Empty states that say what to do first
size: M
to: Muse, ChatGPT, Gemini, Claude (2nd account)
output: diff
read: AGENTS.md, docs/DESIGN_LOG.md, modules/cashflow/budget/view.js, modules/investments/holdings/view.js, modules/debt/mortgage/view.js, modules/retirement/social-security/view.js
summary: Every usable page, opened on an empty plan, explains itself and offers the first step.

AGENTS.md: "Empty states explain what to do first instead of showing zeros and empty tables." For each usable page, work out what it shows on an empty plan (read its view and compute) and write the empty state: one sentence on what the page will tell you, what it needs, and one filled button that goes there (or opens the form). Example tone: "Add your accounts and this page will show how long your cash would last. It takes about two minutes."

Deliver a table (page, what it shows now, proposed text and button) and the diffs. Follow the existing `ui` helpers; no new global CSS.

---
id: design-help-content
title: Help text for every page, in plain words
size: L
to: Muse, ChatGPT, Claude (2nd account), Gemini
output: data
read: docs/MODULE_CATALOG.md, modules/system/help/README.md, modules/system/help/module.js, AGENTS.md
summary: A data file the planned Help page and a "?" on each page can read.

Write the content for the planned `system/help` page as `modules/system/help/data/help.js`: for every page in `docs/MODULE_CATALOG.md` (usable ones first), an entry `{ key: "group/id", what: "...", howToRead: ["..."], whereNumbersComeFrom: "...", commonQuestions: [{ q, a }] }` in plain words for a non-specialist, accurate to what the page actually computes (read its compute and README; never promise what it does not do). Planned pages get only `what`. Add a test that every catalog key has an entry and no entry uses an abbreviation without spelling it out.

---
id: design-glossary
title: A plain-words glossary of every term the app uses
size: M
to: Muse, ChatGPT, Gemini, Le Chat
output: data
read: modules/ai/glossary/README.md, modules/ai/glossary/module.js, docs/MODULE_CATALOG.md
summary: Definitions a teenager would understand, linked to the page that uses each term.

The planned page `ai/glossary` needs content. Collect every financial term the app's pages and catalog use (start from the catalog purposes and the usable pages' views) and write `modules/ai/glossary/data/terms.js`: `{ term, aka: [...], plain: "one or two sentences a 15-year-old would understand", example: "a short worked example with invented numbers", pages: ["group/id", ...] }`. At least 120 terms, accurate (US rules), no circular definitions. Add a test that every page key named exists in the catalog.

---
id: design-spanish
title: Spanish (Mexico) for the whole interface
size: L
to: Muse, ChatGPT, Gemini, Le Chat, Qwen
output: diff
read: docs/PLAN.md, core/format.js, core/app.js, core/ui/dom.js, modules/system/settings/view.js, modules/overview/dashboard/view.js
summary: A tiny i18n layer and the shell and core strings in es-MX.

`docs/PLAN.md` plans Spanish strings through `core/i18n.js` with per-module string tables; number formatting already follows `meta.locale`. Build the mechanism and the first tables:
- `core/i18n.js`: `t(key, vars)` with English as the fallback, plural forms, and the locale from the plan (`meta.locale`), dependency-free;
- `core/i18n/es-MX.js` with every string in the shell (`index.html`, `core/app.js`, `core/ui/*`) and on the dashboard and Settings pages, written as a Mexican Spanish speaker would say them about money (natural, not literal; "tu" form), with US-specific terms (401(k), IRA, Social Security) kept and explained once;
- the dashboard and Settings converted to `t()`, as the pattern other pages will follow.

Diffs, with tests that every key used exists in both languages.
