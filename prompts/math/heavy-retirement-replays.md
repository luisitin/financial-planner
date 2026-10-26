---
id: heavy-retirement-replays
title: Every retirement start year since 1871: about 100,000 historical replays
category: math
size: XL
effort: A fleet of 33 small workers (one per stock mix and length of retirement), about an hour
destinations: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
---
# Every retirement start year since 1871: about 100,000 historical replays

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/historical/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/historical/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/historical/data/returns.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/backtest/data/shiller.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/investments/backtest/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/csv.js

## The task

The historical page answers "would my plan have survived every real start year?". This job builds the whole answer table independently, so the page can be checked against it.

**Step 1, the lead.**
- Copy the conventions word for word from `modules/retirement/historical/README.md` into the rules sheet: when in the year the withdrawal happens, how it grows with inflation, yearly rebalancing, which series stand for stocks, bonds and cash, and any fees.
- The data is given, not tested: the yearly series in `modules/retirement/historical/data/returns.js` for 1928 to 2025, and for 1871 to 1927 the yearly series built from `modules/investments/backtest/data/shiller.js` as its README describes.
- CSV layout, with a starting balance of 1,000,000: `start_year, years, withdrawal_rate, stock_share, lasted (0|1), years_lasted, ending_real_balance, lowest_real_balance, lowest_year, note`.

**Step 2, the workers.** One per stock share (0%, 10%, ... 100%) × length of retirement (20, 30, 40 years) = 33 workers. Each replays every start year that has enough data, for withdrawal rates from 2.0% to 8.0% in 0.25% steps (25 rates): about 3,000 rows each. Use your own short script written from the rules sheet, never the repo's code.

**Step 3, the workers.** Recompute 30 random rows year by year by hand, shown, to prove the script.

**Step 4, the lead.**
- Build the success-rate table (the share of start years whose money lasted) for every rate × mix × length.
- Compare it with the Trinity study (1998, updated 2011) and Bengen (1994) where they overlap, and explain the gaps (data, rebalancing, timing, fees).
- Deliver `tests/golden/retirement/replays-<years>.csv` and `tests/golden-historical.test.mjs`, which checks `modules/retirement/historical/compute.js` on a 1% sample of rows (all of them if that runs in under ten seconds). Disagreements become `todo` tests and lead your answer.

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
