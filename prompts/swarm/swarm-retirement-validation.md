---
id: swarm-retirement-validation
title: Validate the retirement engine against published results
category: swarm
size: XL
effort: An orchestrator with workers, an hour or more
destinations: Claude Code, Codex, Claude (2nd account), Gemini CLI
output: report
---
# Validate the retirement engine against published results

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/math/retirement.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/math/montecarlo.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/projection/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/historical/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/withdrawal-strategy/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/rmd/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/retirement/social-security/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/tests/retirement.test.mjs

## The task

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

## How to hand it back

- **If you can work in the repo** (Codex, Claude Code, Gemini CLI, Jules, Copilot's coding agent, or any tool connected to GitHub): make the changes on a new branch `ai/swarm-retirement-validation` from `main`, run `npm test` and `npm run check`, commit with `Prompt: swarm-retirement-validation` on its own line in the message, push the branch and open a pull request against `main`. The repo is public, so commit only under the GitHub no-reply identity the commits on `main` use, never under a personal name or email: before your first commit, run `git config user.name "$(git log -1 --format=%an origin/main)"` and `git config user.email "$(git log -1 --format=%ae origin/main)"`. The pull request's description holds your rationale, the files you touched, the commands you ran and `Prompt: swarm-retirement-validation` on its own line. Do not merge it. If your tool opens the pull request for the owner (Codex's "Create PR" button), end your last message with `Prompt: swarm-retirement-validation` so it reaches the description. The owner's board picks the pull request up within the hour; nothing else is needed.
- **If you cannot push** (a chat): put everything in your reply, as below. The owner pastes your reply into their board.

## How to answer

1. Start with a rationale of at most ten lines: what you changed and why.
2. Give a report in Markdown: findings ranked by impact, each with the file and line, why it matters and the fix. Then the changes for the top findings as unified diffs (or whole files for new ones).
3. A whole file goes in its own fenced code block whose first line is a comment with its path (`// path: modules/x/y/compute.js`).
4. End with the list of files you touched and the commands that verify them (`npm test`, `npm run check`).

Rules:
- Follow the project's rules in `AGENTS.md`: `compute.js` stays pure (no DOM, fetch, storage or timers); money math lives in code, never in an AI model; plain words on screen; every formula gets a test and a written source.
- Never edit `modules/registry.js` (generated by `npm run registry`), `data/` or `planner.properties`.
- Tests use `node:test` and `node:assert/strict`, in the module's `module.test.mjs` or `tests/<topic>.test.mjs`, so that `npm test` and `npm run check` stay green. Say which commands you ran; if you could not run them, say so plainly.
- Every number needs a source (IRS/SSA/CMS publication, statute, paper, or a worked example you show). Put the source next to the number in a comment and in the module README.
- The repo is public: use invented example data only (no real names, addresses, account numbers).
- If something is unclear, state your assumption and carry on; do not stop to ask.
