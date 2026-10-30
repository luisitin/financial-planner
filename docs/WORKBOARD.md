# WORKBOARD -- three builders, one branch

Three AI builders work on this repo at the same time, each in its own machine or session:
**claude-a** (the owner's first Claude Code session), **claude-b** (a second Claude Code session)
and **codex** (OpenAI Codex). They share nothing but git, so this file is how they talk.
`docs/TEAM.md` (builder / designer / tester on the owner's PC) still applies on top of it.

Read this whole file before every page you start. Re-read it after every `git pull`.

## The branch
Everyone works on **`claude/creative-build-b531q0`** in `luisitin/financial-planner` (the owner
authorised all three to push there). Never force-push, never rebase or amend commits that are
already pushed, never delete another agent's work.

```
git fetch origin claude/creative-build-b531q0 && git checkout claude/creative-build-b531q0
git pull --rebase origin claude/creative-build-b531q0      # before every claim and every commit
```
If your environment cannot push to it, work on your own branch, merge
`claude/creative-build-b531q0` into it before every page, and open one pull request per page
with that branch as the base; say so under Messages. claude-a merges pull requests that pass
the checks below.

## Before every push (all must pass)
```
npm run registry            # never edit modules/registry.js by hand
npm test                    # 0 failures, 0 todo
npm run check               # "check: OK" (compute.js may not even mention document/window/fetch/localStorage)
node tools/leak-guard.mjs --worktree
git pull --rebase origin claude/creative-build-b531q0 && npm test && git push origin HEAD:claude/creative-build-b531q0
```
Do not pipe the checks into `tail` or anything else that hides their exit code. A rejected push
means someone pushed first: pull with rebase, re-run the tests, push again.

## Merge conflicts (they will happen; resolve them, never discard the other side)
| file | how |
|---|---|
| `modules/registry.js` | take either side, then `npm run registry` and `git add` it |
| `CHANGELOG.md` | keep both lines (each agent inserts its line at the top of Unreleased) |
| `docs/MODULE_CATALOG.md`, `docs/DATA_MODEL.md` | keep both edits; one row or sentence each |
| `docs/WORKBOARD.md` | keep both; claims and messages are lines, so order does not matter |
| anything else | it is in someone's lane: keep theirs, re-apply yours, and say so under Messages |

## Lanes (each agent's own placeholder pages; nobody else touches them)
Build them in the order listed. A lane is a claim: no need to claim these one by one.

| agent | pages |
|---|---|
| **claude-a** | goals/emergency-fund, goals/vehicle, goals/travel, goals/charitable, debt/student-loans, debt/consolidation, taxes/state, taxes/self-employment, taxes/filing-status, taxes/documents, balance/projection, balance/statement, cashflow/statement |
| **claude-b** | career/salary, career/offer-compare, career/benefits, career/equity, career/side-income, career/business, career/human-capital, property/home, property/vehicles, property/purchase, property/renovation, property/rental, investments/employer-stock, investments/crypto |
| **codex** | household/life-events, household/calendar, household/contacts, household/documents, balance/assets, balance/accounts (check first: may duplicate balance/net-worth; if so make it a per-account detail page), cashflow/paycheck, cashflow/budget-percent, transactions/reconcile, transactions/connect, ai/glossary, ai/explain, ai/critic, ai/categorizer, ai/notes, system/diagnostics, system/backups, system/audit, system/devices, system/help |

Every page must be finished the way `AGENTS.md` says: compute.js pure with every formula in
the README with its source; view.js through `ctx.store.update`; module.test.mjs with a test per
formula; README; catalog row set to `usable`; one `CHANGELOG.md` line `- [builder] ...` at the
top of Unreleased (sign it: `- [builder:codex] ...`); a screenshot read at 390 px
(`node tools/drive.mjs <group>/<id> --script qa/flows/seed-family.js --shot <name>`, then open
`shots/qa-<name>-phone.png`). Plain words on screen; numbers sourced; no real names or data.

## When your lane is done: the shared backlog (claim a line before you start it)
1. Items in `docs/FEEDBACK.md` marked `for: builder`.
2. Answer keys: an independent check of a usable page's formulas (a script under `tools/`
   that recomputes rows by its own route, and a test that compares; see `tests/golden-*`).
3. Desktop screenshots (`node tools/shot.mjs <group>/<id>`) of pages built since Phase 8: fix
   overflow and layout in pages from your own lane; report others' under Messages.
4. Cross-review: read another agent's last pushed page (diff and screenshot), post concrete
   findings under Messages for its owner. Do not edit their files.
5. Speed: `node qa/smoke-all.mjs` and the heavy pages' timings; propose fixes under Messages.

## Shared pieces worth reusing (do not rewrite them)
- `scenarios/compare/compute.js`: `LEVERS`, `applyChanges(plan, changes)`, `results(inputs)` (does
  it last, chance over simulated markets, affordable spending, end money) for any what-if.
- `retirement/medicare/compute.js` `planIncome` (the plan's income each year for means tests);
  `scenarios/stress-tests/compute.js` `survivorInputs`; `core/math/finance.js` `rateFor`, `pmt`,
  `fv`, `pmtToReach`; `goals/house/compute.js` `solveMonths`; `insurance/term-vs-permanent`
  `planReturn`, `TAX_DRAG`; `estate/gifting/data/transfer-tax.js`; `retirement/charts.js` `lineChart`;
  `modules/reports/report-kit.js` for printable pages.
- Plan sections for calculator inputs: `whatIfs.<page>` (never counted in the plan). New fields:
  optional ones need no schema bump; write them into `docs/DATA_MODEL.md`.
- Sandbox seeds: `qa/fixtures/family-plan.mjs` (Ana, Bo, Cy) and `qa/flows/seed-*.js`.

## Claims (backlog work and anything outside your lane; delete your line when done)
| who | since | what |
|---|---|---|

## Done (newest first: page, agent, commit)
- taxes/self-employment, claude-a
- goals/charitable, claude-a
- goals/travel, claude-a
- goals/vehicle, claude-a
- goals/emergency-fund, claude-a, 59fffd2
- goals/prioritizer, claude-a, e470868
- goals/education, claude-a, fa8619e
- goals/house, claude-a, f1538a5
- property/rent-vs-buy, claude-a, ef16fda

## Messages (append at the bottom: `- YYYY-MM-DD HH:MM from -> to: text`)
- 2026-10-30 15:00 claude-a -> all: board opened. Lanes above. I keep merging nothing of yours
  unless you open a pull request; if you push to the branch directly, just pull often. Phases 8 and 9
  are done; the remaining 47 placeholders are split three ways.
