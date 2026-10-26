---
id: heavy-federal-tax-grid
title: Federal income tax for 12,000 invented returns (2024 to 2026)
category: math
size: XL
effort: A fleet of about 48 small workers (one per year, filing status and income band), about an hour
destinations: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
---
# Federal income tax for 12,000 invented returns (2024 to 2026)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/math/tax.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/federal/data/federal.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/federal/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/federal/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/tests/tax.test.mjs
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/csv.js

## The task

The federal tax engine (`federalTax(inputs, params)` in `core/math/tax.js`, year tables in `modules/taxes/federal/data/federal.js`) has a few dozen hand-worked tests. Give it twelve thousand.

**Scope: what the engine covers** (the README's "Edge cases" lists what it leaves out; do not test those): tax years 2024, 2025 and 2026; single, married filing jointly, married filing separately, head of household; wages, taxable interest, ordinary and qualified dividends, short- and long-term capital gains and losses (with the $3,000 loss limit), pensions and IRA distributions, Social Security benefits (the taxable-portion worksheet), the standard deduction with the 65+ and blind additions, the 2025 to 2028 senior deduction and its phase-out, itemized deductions (state and local taxes under that year's cap, mortgage interest, charity), the child tax credit and the credit for other dependents with their phase-outs, the 3.8% net investment income tax and the 0.9% additional Medicare tax.

**Step 1, the lead (about 10 minutes).**
- Read the input and output objects of `federalTax` and fix one CSV layout: `case_id, year, filing_status, age_1, age_2, blind_1, blind_2, kids_under_17, other_dependents, wages, interest, ordinary_dividends, qualified_dividends, st_gain, lt_gain, pensions, ira_distributions, social_security, salt_paid, mortgage_interest, charity`, then the expected results `agi, taxable_social_security, deduction, taxable_income, ordinary_tax, capital_gains_tax, credits, niit, additional_medicare, total_tax, marginal_rate`, then `note`.
- Write one rules sheet with each year's figures copied from the IRS's own documents: Rev. Proc. 2023-34 (2024), Rev. Proc. 2024-40 plus the July 2025 law's changes (2025), Rev. Proc. 2025-32 (2026). It covers brackets, standard deductions and additions, capital-gains thresholds, Social Security base amounts, credit amounts and phase-outs, the NIIT and additional Medicare thresholds, the SALT cap and its phase-down, and the senior deduction. Wherever `federal.js` differs from the IRS figure, that difference goes first in your answer.
- Give every worker the layout, the rules sheet and its shard.

**Step 2, the workers (in parallel).** 48 shards: 3 years × 4 filing statuses × 4 income bands (under $50,000; $50,000 to $150,000; $150,000 to $400,000; over $400,000 up to $5,000,000). Each worker writes 250 rows for its shard:
- 100 grid rows, incomes spread evenly through the band, the mix rotating through wages only, wages plus investment income, retirement income (pension, IRA, Social Security) and everything at once;
- 100 edge rows: exactly at, $1 below and $1 above every bracket edge, capital-gains threshold, Social Security base amount, credit phase-out start and end, NIIT threshold, senior-deduction phase-out and SALT phase-down point that falls inside the band;
- 50 random rows, every field drawn at random within the band.

Work each expected value from the rules sheet and the IRS worksheets (Qualified Dividends and Capital Gain Tax Worksheet, Social Security Benefits Worksheet, Schedule 8812, Forms 8960 and 8959). A calculator, or a short script you write yourself from the rules sheet, is fine. **Never run, import or copy the repo's code**: the point is an independent answer key. Use the same rounding in every row (exact cents, or whole dollars as the forms allow) and say which.

**Step 3, the workers.** Re-derive every tenth row a second way (by hand if the first pass was a script, by script if it was by hand). Fix the row, or flag it in `note`.

**Step 4, the lead.**
- Re-derive a 2% sample yourself; redo any shard with an error in it.
- Deliver `tests/golden/taxes/federal-<year>.csv` (one per year) and `tests/golden-federal.test.mjs`. The test reads each CSV with `parseCsv` from `core/csv.js`, maps the columns to `federalTax`'s inputs and asserts every result within $1.
- A row where the engine disagrees stays in the CSV and becomes a `{ todo: "<reason>" }` test. Put those first in your answer with the worked numbers: they are the point of the exercise.

## How to answer

1. Start with a rationale of at most ten lines: what you changed and why.
2. Next, the disagreements between your answer key and the code, each with the worked numbers: they matter most. Then give every CSV file and the test runner whole, each in its own fenced code block whose first line is its path (`# path: tests/golden/...csv`; that line is dropped when the file is saved). If the files add up to more than about 1 MB, attach them instead of pasting: one file each, or one Markdown file holding them all in fenced blocks with their paths.
3. End with the list of files you touched and the commands that verify them (`npm test`, `npm run check`).

Rules:
- Never run, import or copy the repo's code to get an expected value: the answer key must be independent of the code, or it proves nothing. A calculator, or a short script a worker writes itself from the rules in this prompt, is fine.
- Every CSV has a header row, one case per row, money to the cent, rates to six decimals and dates as YYYY-MM-DD.
- Follow the project's rules in `AGENTS.md`: `compute.js` stays pure (no DOM, fetch, storage or timers); money math lives in code, never in an AI model; plain words on screen; every formula gets a test and a written source.
- Never edit `modules/registry.js` (generated by `npm run registry`), `data/` or `planner.properties`.
- Tests use `node:test` and `node:assert/strict`, in the module's `module.test.mjs` or `tests/<topic>.test.mjs`, so that `npm test` and `npm run check` stay green. Say which commands you ran; if you could not run them, say so plainly.
- Every number needs a source (IRS/SSA/CMS publication, statute, paper, or a worked example you show). Put the source next to the number in a comment and in the module README.
- The repo is public: use invented example data only (no real names, addresses, account numbers).
- If something is unclear, state your assumption and carry on; do not stop to ask.
