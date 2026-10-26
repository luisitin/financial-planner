---
id: heavy-golden-taxes
title: Answer keys for every formula on the tax pages (6 pages, thousands of rows)
category: math
size: XL
effort: A fleet of 6 small workers (one per page), about an hour
destinations: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
---
# Answer keys for every formula on the tax pages (6 pages, thousands of rows)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/csv.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/withholding/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/withholding/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/capital-gains/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/capital-gains/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/brackets/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/brackets/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/estimated/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/estimated/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/projection/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/projection/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/hsa-fsa/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/hsa-fsa/README.md

## The task

Build an answer key for every formula and rule on these 6 working pages, at volume, as CSV files the tests replay:

- `taxes/withholding` (Withholding check): Whether your paychecks are taking out enough federal tax: the refund or bill in April, and the W-4 change that fixes it.
- `taxes/capital-gains` (Capital gains): Tax on what you sell this year: short against long, the 0/15/20% bands, the loss allowance, and how much gain still fits at 0%.
- `taxes/brackets` (Bracket explorer): Which bracket your next dollar lands in, how much room is left before the next rate, and what a raise, bonus or conversion would really cost.
- `taxes/estimated` (Estimated payments): Quarterly estimated payments: the safe-harbour amount, what is due each quarter and when, and where you stand today.
- `taxes/projection` (Tax, year by year): Federal tax in every year of the retirement plan through the real brackets: the totals, the worst years, and how the flat setting compares.
- `taxes/hsa-fsa` (HSA and FSA): The health savings account: its limit, the room left, the tax it saves, what it grows into; and the FSA use-it-or-lose-it deadline.

Left out because they have their own prompt: `taxes/federal` (`heavy-federal-tax-grid`).

This is high-volume, mechanical work with no design decisions.

**Step 1, the lead.** For each page, list every formula and rule its `compute.js` applies (including what it imports from `core/math/`), quoting the README's wording, rounding and source. Fix one CSV layout per page: `case_id`, the inputs as columns (a small invented plan or params, flattened), the expected results, then `note`. Put the layout and the quoted rules into that page's worker brief. Where the README is silent, take the rule from the source it cites, not from the code, and say so.

**Step 2, the workers (one per page; split a big page by formula).** Fill the page's CSV with at least 100 rows per formula or rule:
- 60 grid rows across realistic values: one person and a family, small and large amounts, this year and 30 years out;
- 30 edge rows: zero, empty lists, exactly at every threshold the README names and either side of it, the first and last month or year, leap days, and negative amounts where they can occur;
- 10 extreme rows: very large, very small, very long horizons.

Work each expected value from the brief with your own arithmetic, or a short script you write yourself from the brief.

**Step 3, the workers.** Re-derive every tenth row a second way (by hand if the first pass was a script, by script if it was by hand). Fix the row, or flag it in `note`.

**Step 4, the lead.** Re-derive a 2% sample yourself; redo any page with an error. Deliver `tests/golden/taxes/<page>.csv` and one runner, `tests/golden-taxes.test.mjs`. The runner reads each CSV with `parseCsv` from `core/csv.js`, builds the plan or params for each row, calls the page's `compute()` (or the `core/math` function) and compares money within 0.005. A row where the code disagrees stays in the CSV and becomes a `{ todo: "<why>" }` test. Those disagreements lead your answer: they are the point.

## How to hand it back

- **If you can work in the repo** (Codex, Claude Code, Gemini CLI, Jules, Copilot's coding agent, or any tool connected to GitHub): make the changes on a new branch `ai/heavy-golden-taxes` from `main`, run `npm test` and `npm run check`, commit with `Prompt: heavy-golden-taxes` on its own line in the message, push the branch and open a pull request against `main`. Its description holds your rationale, the files you touched, the commands you ran and `Prompt: heavy-golden-taxes` on its own line. Do not merge it. If your tool opens the pull request for the owner (Codex's "Create PR" button), end your last message with `Prompt: heavy-golden-taxes` so it reaches the description. The owner's board picks the pull request up within the hour; nothing else is needed.
- **If you cannot push** (a chat): put everything in your reply, as below. The owner pastes your reply into their board.

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
