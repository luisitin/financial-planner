# Math + reasoning (swarm)
For an orchestrator model that can run a team of smaller worker models (Claude Code subagents, ChatGPT agent or Codex tasks, Gemini CLI, a Muse workspace...). Each prompt carries its split plan.

---
id: swarm-audit-all-math
title: Audit every module's math: one worker per topic, merged and cross-checked
size: XL
to: Claude Code, Codex, Gemini CLI, Claude (2nd account)
output: report
read: AGENTS.md, docs/MODULE_CATALOG.md, docs/CONVENTIONS.md, core/math/finance.js, core/math/tax.js, core/math/retirement.js, tests/modules.test.mjs
summary: 13 workers, one per module group; the orchestrator merges, dedupes and cross-checks shared formulas.

You are the **orchestrator**. Your workers are smaller models that each audit one slice; you merge, verify and decide.

**Split plan (one worker each):** `core/math/*` (shared formulas); `balance/*`; `cashflow/*`; `transactions/*`; `debt/*`; `goals/*`; `retirement/*` pages part 1 (projection, cash-flow, contributions, social-security, rmd, longevity); `retirement/*` part 2 (monte-carlo, historical, sequence-risk, withdrawal-strategy, withdrawal-order, roth-conversions, fire); `taxes/*`; `investments/*` part 1 (holdings, allocation, rebalance, fees, performance, dividends); `investments/*` part 2 (asset-location, glide-path, risk, backtest, limits, tax-lots); `overview/*` and `household/*`; `system/assumptions`. Only folders whose catalog status is `usable` have math to audit.

**Worker brief (send each worker this, with its slice):** "Read every `compute.js`, `README.md` and `module.test.mjs` in your slice, and the `core/math` functions they import. For each formula: state it, its source, whether the code matches the source, and one hand-worked check. Report findings in this exact Markdown shape: `### <file>:<line> | severity: wrong-number / edge-case / unsourced / style | <one-line claim>` then `evidence:`, `hand check:`, `fix:` (a unified diff). No finding without a hand check."

**Your job after the workers report:**
1. Re-derive every "wrong-number" finding yourself before accepting it; reject findings whose hand check is wrong, and say so.
2. Cross-check: formulas implemented in more than one place (payment, growth, inflation, tax, ages) must agree; list every disagreement even if each looks plausible alone.
3. Merge duplicates; order by how much a wrong number could change a decision.
4. Deliver: the merged findings, then diffs for every accepted fix with a test that fails before and passes after.

---
id: swarm-state-income-tax
title: Build the State tax page: engine by the orchestrator, data by region workers
size: XL
to: Claude Code, Codex, Gemini CLI, Claude (2nd account)
output: files
read: AGENTS.md, docs/DATA_MODEL.md, core/math/tax.js, modules/taxes/federal/compute.js, modules/taxes/federal/data/federal.js, modules/taxes/state/module.js, modules/taxes/state/README.md, modules/taxes/federal/view.js
summary: A common schema, four regional data workers, one engine, cross-checked against published examples.

You are the **orchestrator** for building the planned page `taxes/state` (estimate the household's state income tax for the state in `plan.household.state`).

**Step 1 (you):** fix the data schema every worker must follow: per state and year, `kind` (`brackets` / `flat` / `none` / `interest-dividends-only` / `capital-gains-only`), brackets per filing status, standard deduction, exemptions (deduction or credit), starting point (federal AGI, federal taxable income or the state's own), retirement-income exclusions, notes for what the model leaves out, and the source URL. Write it as a JSDoc typedef in `modules/taxes/state/data/schema.js`.

**Step 2 (four workers in parallel):** Northeast + DC; Midwest; South; West (the same state lists as the four `math-state-tax-*` prompts in this library). Brief: "Using only the state revenue departments' own rate schedules and form instructions, fill the schema for tax years 2025 and 2026 for your states; mark unpublished 2026 values `projected`; for each state include three worked returns (income, filing status, the state tax) that you computed from the official instructions. Output: one JS module `modules/taxes/state/data/<region>.js` and a Markdown list of the worked returns."

**Step 3 (you):** write the engine in `modules/taxes/state/compute.js` (pure; reuses `core/math/tax.js` bracket helpers and the federal page's AGI and taxable income through `ctx`-free imports), run every worker's worked returns through it as tests, and investigate every mismatch: wrong data, wrong engine, or a rule the schema cannot express (then extend the schema and tell the workers what changed).

**Step 4 (you):** the view (plain words: "Your state income tax this year: about $X"; states with no income tax say so in one line), README with sources, catalog row to `usable`, CHANGELOG line. Deliver every file whole.

---
id: swarm-retirement-validation
title: Validate the retirement engine against published results
size: XL
to: Claude Code, Codex, Claude (2nd account), Gemini CLI
output: report
read: core/math/retirement.js, core/math/montecarlo.js, modules/retirement/projection/compute.js, modules/retirement/historical/compute.js, modules/retirement/withdrawal-strategy/compute.js, modules/retirement/rmd/compute.js, modules/retirement/social-security/compute.js, tests/retirement.test.mjs
summary: Six workers each reproduce one famous result; the orchestrator reconciles every gap.

You are the **orchestrator**. The question: does `core/math/retirement.js` and the pages built on it reproduce results that experts trust?

**Workers (in parallel), each reproducing one benchmark with this engine and by an independent method:**
1. Bengen (1994): the highest safe initial withdrawal over 30 years with a 50/50 mix, on the engine's historical data.
2. The Trinity study (1998, updated 2011): success-rate table for 3% to 7% withdrawals, 15 to 30 years, 50/50 and 75/25.
3. Guyton-Klinger guardrails and percent-of-portfolio rules: the spending paths for a 1966 retiree (worst historical start) as published by the FI Calc guide or ERN.
4. Required minimum distributions: a 20-year schedule for a $1,000,000 pre-tax balance from age 73 at 5% growth, against IRS tables.
5. Social Security: the benefit at 62, 67 and 70 for three earnings histories, against the SSA's own calculators or published examples.
6. Monte Carlo: success rate of a simple plan under the engine's return assumptions vs a closed-form or textbook result (for example zero volatility, and the lognormal median path).

Brief each worker: "Report the published figure with its exact source, the engine's figure, your independent figure, and a diagnosis of any gap larger than 1 percentage point or $100 (data, rebalancing, timing within the year, fees, rounding, or a bug with file and line)."

**Your job:** reconcile. A gap explained by a documented modelling choice is fine (say so in the README); a bug gets a fix as a diff and a test pinned to the published figure. Deliver the reconciliation table first.

---
id: swarm-households-verify
title: Verify the 1,400 pretend households: one worker per household type
size: XL
to: Claude Code, Codex, Gemini CLI
output: report
read: qa/households/README.md, qa/households/INDEX.md, qa/households/lib/catalog.mjs, qa/households/lib/expect.mjs, qa/households/run.mjs, qa/households/01-single-adult/base/H-0001-base.md
summary: 14 workers recompute key figures by hand; the orchestrator fixes the expectations or files the bugs.

`qa/households/` holds 1,400 invented households (14 types x 100 variations) and `lib/expect.mjs`, the tester's own math for what each page should show; `run.mjs` compares the app against it. Some cases fail. You are the **orchestrator**.

**Split plan:** one worker per type folder (`01-single-adult` ... `14-unusual-structures`). Brief: "For your folder, take the base case and every case whose INDEX.md status is `fail`, plus ten random passing cases. For each, recompute by hand the figures the case file lists (net worth, monthly income and spending, emergency-fund months, debt payoff dates, goal status). Decide for every disagreement which side is right: the app (then `expect.mjs` is wrong), `expect.mjs` (then the app has a bug), or the case itself (it asks for something undefined). Report: case id, figure, app value, expect value, your value, verdict, one-line reason."

**Your job:** group the verdicts by root cause (one bug usually explains many cases); for each app bug give a diff to the page's compute with a test; for each wrong expectation a diff to `lib/expect.mjs`; for undefined cases, a decision written into the case catalog. Deliver the root-cause table first. Note: the cases' `results/` folder is not in the repo; reason from the case files and the code.

---
id: swarm-tax-vs-irs-worksheets
title: The federal tax engine against the IRS's own worksheets
size: XL
to: Claude Code, Codex, Claude (2nd account), Gemini CLI
output: report
read: core/math/tax.js, modules/taxes/federal/compute.js, modules/taxes/federal/data/federal.js, modules/taxes/federal/README.md, tests/tax.test.mjs, tests/tax-pages.test.mjs
summary: One worker per worksheet; the orchestrator turns agreement into tests and gaps into fixes.

You are the **orchestrator**. Each worker owns one piece of Form 1040 for tax years 2024, 2025 and 2026 and builds ten worked examples straight from the IRS instructions, then runs them through `core/math/tax.js`:
1. Tax rate schedules and the standard deduction, including 65+/blind additions and dependents' limited standard deduction.
2. The Qualified Dividends and Capital Gain Tax Worksheet, and Schedule D netting with the $3,000 loss limit and carryover.
3. The Social Security Benefits Worksheet (provisional income, 50% and 85% tiers).
4. The child tax credit and credit for other dependents (Schedule 8812), with phase-outs.
5. Net investment income tax (Form 8960) and additional Medicare tax (Form 8959).
6. The 2025 to 2028 changes from the 2025 tax law: the senior deduction, the SALT cap and its phase-down, the deductions for tips and overtime, and car-loan interest (say which the app models and which it ignores, and what ignoring costs a typical household).

Brief: "Cite the instruction line for every step. Output a table: case, inputs, your result line by line, the engine's result, and the gap."

**Your job:** every agreeing case becomes a test; every gap gets a diagnosis (data, rule, rounding, or out of scope) and a fix as a diff with the test. Put a short "what the engine covers" table in the federal page README.

---
id: swarm-phase8-protection-estate
title: Build Phase 8 (insurance and estate) with a team
size: XL
to: Claude Code, Codex, Gemini CLI
output: files
read: AGENTS.md, ROADMAP.md, docs/MODULE_CATALOG.md, docs/DATA_MODEL.md, docs/DESIGN_LOG.md, modules/_template/compute.js, modules/_template/view.js, modules/balance/liabilities/view.js
summary: The orchestrator fixes the shared data shapes; workers build pages in parallel; the orchestrator integrates.

Phase 8 builds insurance and estate pages (see ROADMAP.md and the catalog rows with phase 8). You are the **orchestrator**.

**Step 1 (you):** settle the shared data: `insurance.policies[]` (already sketched in DATA_MODEL.md: check it covers term, whole/universal, disability, long-term care, auto, home, umbrella, health) and `estate.documents[]`, `estate.beneficiaries[]`, `estate.legacy`. Write the shapes into `docs/DATA_MODEL.md` and helper functions that every page uses (e.g. `policiesOf(plan, kind)`) in one shared file. Freeze them before the workers start.

**Step 2 (workers in parallel, one page each):** `insurance/policies`, `insurance/life-needs` (two methods: income replacement and needs-based, with the household's debts and goals), `insurance/term-vs-permanent`, `insurance/cash-value`, `insurance/disability`, `estate/documents`, `estate/beneficiaries`, `estate/legacy`, `estate/gifting`. Brief: "Build this page following AGENTS.md, using only the frozen shapes and helpers. Deliver module.js, compute.js, view.js, README.md (formulas with sources) and module.test.mjs, whole."

**Step 3 (you):** check every page against the design rules and the shared shapes, make the life-needs page use the same debts and goals the rest of the app shows, update the catalog rows and add CHANGELOG lines. Deliver every file whole, with a short integration note.
