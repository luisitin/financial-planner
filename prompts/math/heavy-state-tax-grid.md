---
id: heavy-state-tax-grid
title: State income tax for every state: an answer key of 40,000 rows (2025, 2026)
category: math
size: XL
effort: A fleet of 51 small workers (one per state and DC), about an hour
destinations: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
---
# State income tax for every state: an answer key of 40,000 rows (2025, 2026)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/state/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/state/module.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/math/tax.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/csv.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/docs/DATA_MODEL.md

## The task

The State tax page (`taxes/state`) is planned; its tables come from the Quick prompt `quick-state-tax-tables`. This job builds, independently of those tables, the answer key the page will be tested against.

**Step 1, the lead.** Fix one CSV layout: `case_id, state, year, filing_status, age_1, age_2, dependents, federal_agi, federal_taxable_income, wages, social_security, pension, lt_gain, state_taxable_income, state_tax_before_credits, state_credits, state_tax, note`. Brief every worker with it and the rules below.

**Step 2, the workers (one per state and DC).** For tax years 2025 and 2026, write about 850 rows:
- 4 filing statuses × 100 income points from $0 to $1,000,000 (denser around the state's bracket edges, and each edge exactly) × 2 households (no dependents and under 65; two dependents);
- 50 retiree rows (65 and over, Social Security and a pension) that exercise the state's retirement-income exclusions.

Rules for every worker:
- Work every row from that state revenue department's own form instructions and rate schedule for that year. Never use an aggregator site, and never the repo's tables or code. Cite the form in a comment line at the top of your shard.
- Where 2026 is not yet published, use 2025 and put `projected` in `note`.
- States with no wage income tax need only a short shard confirming $0, plus their special cases (Washington's capital-gains excise tax; New Hampshire's interest-and-dividends tax for the years it applies).
- Local income taxes (New York City, Yonkers, Maryland counties, Pennsylvania, Ohio and Michigan localities and so on) are out: state tax only.

**Step 3, the workers.** Re-derive every tenth row a second way; fix or flag.

**Step 4, the lead.**
- Re-derive a 2% sample; redo any shard with an error.
- Deliver `tests/golden/taxes/state-<code>.csv` per state and `tests/golden-state.test.mjs`. It runs each row through `modules/taxes/state/compute.js` once that page exists, and until then skips with a message saying so.

## How to hand it back

- **If you can work in the repo** (Codex, Claude Code, Gemini CLI, Jules, Copilot's coding agent, or any tool connected to GitHub): make the changes on a new branch `ai/heavy-state-tax-grid` from `main`, run `npm test` and `npm run check`, commit with `Prompt: heavy-state-tax-grid` on its own line in the message, push the branch and open a pull request against `main`. Its description holds your rationale, the files you touched, the commands you ran and `Prompt: heavy-state-tax-grid` on its own line. Do not merge it. If your tool opens the pull request for the owner (Codex's "Create PR" button), end your last message with `Prompt: heavy-state-tax-grid` so it reaches the description. The owner's board picks the pull request up within the hour; nothing else is needed.
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
