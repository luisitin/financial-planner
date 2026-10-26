---
id: heavy-golden-investments
title: Answer keys for every formula on the investments pages (12 pages, thousands of rows)
category: math
size: XL
effort: A fleet of 12 small workers (one per page), about an hour
destinations: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
---
# Answer keys for every formula on the investments pages (12 pages, thousands of rows)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/csv.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/holdings/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/holdings/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/allocation/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/allocation/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/rebalance/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/rebalance/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/fees/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/fees/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/performance/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/performance/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/dividends/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/dividends/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/asset-location/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/asset-location/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/glide-path/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/glide-path/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/risk/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/risk/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/backtest/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/backtest/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/tax-lots/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/tax-lots/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/limits/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/limits/README.md

## The task

Build an answer key for every formula and rule on these 12 working pages, at volume, as CSV files the tests replay:

- `investments/holdings` (Holdings): What you hold in each investment account, what it is worth and what you paid; type it in or import the brokerage's positions file.
- `investments/allocation` (Allocation): Your mix by asset class across every account against the mix you aim for, and how far each class has drifted.
- `investments/rebalance` (Rebalance): The trades that bring your mix back to its target: new money first, then sells where they cost no tax and buys with the cash freed.
- `investments/fees` (Fees): What your funds and any advisor charge each year and what that costs over a lifetime.
- `investments/performance` (Performance): Your true return from the balance points you save: what the investments earned and what you earned, against the plan and an index mix.
- `investments/dividends` (Dividends): The dividends and interest your holdings pay each year, by fund and by account, and what they cover of your spending.
- `investments/asset-location` (Asset location): Which investments belong in which kind of account to keep the yearly tax bill down, the drag today, and the swaps that fix it.
- `investments/glide-path` (Glide path): How much of your money should be in stocks at each age: the plan's path, the rules of thumb, and where you stand today.
- `investments/risk` (Risk): How rough the ride of your mix is: the worst year and deepest fall history has dealt a mix like yours, in your own dollars.
- `investments/backtest` (Backtest): Any stocks-and-bonds mix run through the years since 1871, side by side with another: growth, the worst years, the deepest fall.
- `investments/tax-lots` (Tax lots and harvesting): The gain or loss on each lot you hold, the losses worth harvesting in taxable accounts, and the order to sell in when you need cash.
- `investments/limits` (Contribution limits): This year's limits for 401(k)s, IRAs, HSAs, FSAs and 529 gifts against what is going in, the room left, the Roth income check and the deadlines.

This is high-volume, mechanical work with no design decisions.

**Step 1, the lead.** For each page, list every formula and rule its `compute.js` applies (including what it imports from `core/math/`), quoting the README's wording, rounding and source. Fix one CSV layout per page: `case_id`, the inputs as columns (a small invented plan or params, flattened), the expected results, then `note`. Put the layout and the quoted rules into that page's worker brief. Where the README is silent, take the rule from the source it cites, not from the code, and say so.

**Step 2, the workers (one per page; split a big page by formula).** Fill the page's CSV with at least 100 rows per formula or rule:
- 60 grid rows across realistic values: one person and a family, small and large amounts, this year and 30 years out;
- 30 edge rows: zero, empty lists, exactly at every threshold the README names and either side of it, the first and last month or year, leap days, and negative amounts where they can occur;
- 10 extreme rows: very large, very small, very long horizons.

Work each expected value from the brief with your own arithmetic, or a short script you write yourself from the brief.

**Step 3, the workers.** Re-derive every tenth row a second way (by hand if the first pass was a script, by script if it was by hand). Fix the row, or flag it in `note`.

**Step 4, the lead.** Re-derive a 2% sample yourself; redo any page with an error. Deliver `tests/golden/investments/<page>.csv` and one runner, `tests/golden-investments.test.mjs`. The runner reads each CSV with `parseCsv` from `core/csv.js`, builds the plan or params for each row, calls the page's `compute()` (or the `core/math` function) and compares money within 0.005. A row where the code disagrees stays in the CSV and becomes a `{ todo: "<why>" }` test. Those disagreements lead your answer: they are the point.

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
