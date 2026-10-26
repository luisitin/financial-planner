---
id: heavy-golden-retirement
title: Answer keys for every formula on the retirement pages (10 pages, thousands of rows)
category: math
size: XL
effort: A fleet of 10 small workers (one per page), about an hour
destinations: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
---
# Answer keys for every formula on the retirement pages (10 pages, thousands of rows)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/csv.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/projection/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/projection/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/contributions/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/contributions/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/cash-flow/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/cash-flow/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/withdrawal-strategy/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/withdrawal-strategy/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/withdrawal-order/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/withdrawal-order/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/roth-conversions/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/roth-conversions/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/rmd/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/rmd/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/sequence-risk/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/sequence-risk/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/longevity/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/longevity/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/fire/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/fire/README.md

## The task

Build an answer key for every formula and rule on these 10 working pages, at volume, as CSV files the tests replay:

- `retirement/projection` (Will the money last?): Your plan run year by year to the end: what you have, add, receive and spend, and whether the money lasts.
- `retirement/contributions` (Retirement contributions): What goes into 401(k)s, IRAs, Roths and HSAs each year, with the employer match and this year's limits.
- `retirement/cash-flow` (Year by year): Every year of the plan in one table: ages, what comes in, what goes out, what is taken from where, what is left.
- `retirement/withdrawal-strategy` (How much to take out): Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history.
- `retirement/withdrawal-order` (Withdrawal order): Which account to draw from first (taxable, pre-tax or Roth) and what each order costs in lifetime tax and spending.
- `retirement/roth-conversions` (Roth conversions): Fills a bracket with Roth conversions in the years before required withdrawals and shows what that does to lifetime tax and spending.
- `retirement/rmd` (Required withdrawals): When the tax rules make you take money out of pre-tax accounts, and how big those withdrawals look.
- `retirement/sequence-risk` (Order of returns): Why bad years early in retirement hurt most: the same years of returns in three orders, on your plan.
- `retirement/longevity` (How long to plan for): The chance of reaching each age, for each of you and for at least one of a couple, and the age the plan should run to.
- `retirement/fire` (Financial independence): The pot that could pay for your life without a paycheck, how far you are, and the years to get there at your pace.

Left out because they have their own prompt: `retirement/social-security` (`heavy-social-security-grid`), `retirement/monte-carlo` (`reasoning-monte-carlo-validation`), `retirement/historical` (`heavy-retirement-replays`).

This is high-volume, mechanical work with no design decisions.

**Step 1, the lead.** For each page, list every formula and rule its `compute.js` applies (including what it imports from `core/math/`), quoting the README's wording, rounding and source. Fix one CSV layout per page: `case_id`, the inputs as columns (a small invented plan or params, flattened), the expected results, then `note`. Put the layout and the quoted rules into that page's worker brief. Where the README is silent, take the rule from the source it cites, not from the code, and say so.

**Step 2, the workers (one per page; split a big page by formula).** Fill the page's CSV with at least 100 rows per formula or rule:
- 60 grid rows across realistic values: one person and a family, small and large amounts, this year and 30 years out;
- 30 edge rows: zero, empty lists, exactly at every threshold the README names and either side of it, the first and last month or year, leap days, and negative amounts where they can occur;
- 10 extreme rows: very large, very small, very long horizons.

Work each expected value from the brief with your own arithmetic, or a short script you write yourself from the brief.

**Step 3, the workers.** Re-derive every tenth row a second way (by hand if the first pass was a script, by script if it was by hand). Fix the row, or flag it in `note`.

**Step 4, the lead.** Re-derive a 2% sample yourself; redo any page with an error. Deliver `tests/golden/retirement/<page>.csv` and one runner, `tests/golden-retirement.test.mjs`. The runner reads each CSV with `parseCsv` from `core/csv.js`, builds the plan or params for each row, calls the page's `compute()` (or the `core/math` function) and compares money within 0.005. A row where the code disagrees stays in the CSV and becomes a `{ todo: "<why>" }` test. Those disagreements lead your answer: they are the point.

## How to hand it back

- **If you can work in the repo** (Codex, Claude Code, Gemini CLI, Jules, Copilot's coding agent, or any tool connected to GitHub): make the changes on a new branch `ai/heavy-golden-retirement` from `main`, run `npm test` and `npm run check`, commit with `Prompt: heavy-golden-retirement` on its own line in the message, push the branch and open a pull request against `main`. Its description holds your rationale, the files you touched, the commands you ran and `Prompt: heavy-golden-retirement` on its own line. Do not merge it. If your tool opens the pull request for the owner (Codex's "Create PR" button), end your last message with `Prompt: heavy-golden-retirement` so it reaches the description. The owner's board picks the pull request up within the hour; nothing else is needed.
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
