---
id: quick-state-tax-tables
title: Every state's income tax as data (2025, 2026)
category: quick
size: M
effort: One agent, about 15 minutes (or 26 small helpers, two states each, in a couple of minutes)
destinations: ChatGPT, Gemini, Perplexity, Claude (2nd account), Claude Code
output: data
---
# Every state's income tax as data (2025, 2026)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/docs/DATA_MODEL.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/state/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/state/module.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/math/tax.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/taxes/federal/data/federal.js

## The task

The planned State tax page (`taxes/state`) needs each state's personal income tax as data. Produce `modules/taxes/state/data/states.js` for all 50 states and the District of Columbia, tax years 2025 and 2026, in exactly this shape:

```js
export const STATES = {
  CA: {
    2025: {
      kind: "brackets",            // "brackets" | "flat" | "none" | "interest-dividends-only" | "capital-gains-only"
      brackets: { single: [[0, 0.01], [10756, 0.02]], married_joint: [...], married_separate: [...], head_of_household: [...] },
      standard: { single: 5540, married_joint: 11080, married_separate: 5540, head_of_household: 11080 },   // 0 if none
      exemption: { personal: 149, dependent: 461, kind: "credit" },   // "deduction" or "credit"
      startsFrom: "federal-agi",   // "federal-agi" | "federal-taxable" | "own"
      retirement: { socialSecurityTaxed: false, pensionExclusion: null },   // the state's retirement-income rules, with limits
      notes: ["mental health services tax: 1% over $1,000,000"],   // anything the simple model leaves out
      source: "https://... (the revenue department's own rate schedule or form instructions)",
    },
    2026: { ... },
  },
  TX: { 2025: { kind: "none", source: "..." }, 2026: { kind: "none", source: "..." } },
};
```

Rules:
- Every number comes from the state's revenue department (rate schedule or form instructions), never an aggregator. Where 2026 is not yet published, carry 2025 forward and add `"projected: not yet published"` to `notes`.
- States that cut rates on a schedule or a revenue trigger (for example Arkansas, Georgia, Indiana, Iowa, Kentucky, Louisiana, Mississippi, Missouri, Nebraska, North Carolina, Ohio, Oklahoma, South Carolina, West Virginia): note the schedule and the trigger.
- Local income taxes (New York City, Yonkers, Maryland counties, Pennsylvania and Ohio localities, Michigan cities, Indiana counties, Kansas City and St. Louis) go in `notes`; they are not modelled.
- Washington's capital-gains excise tax and New Hampshire's interest-and-dividends tax (for the years it applies) get their own `kind`.

Then add `tests/state-tax-data.test.mjs`: the shape for every state and year, brackets ascending, rates between 0 and 15%, and one hand-worked return per state that has an income tax. If your tool can run helpers, give each two states; one agent alone is fine too.

## How to hand it back

- **If you can work in the repo** (Codex, Claude Code, Gemini CLI, Jules, Copilot's coding agent, or any tool connected to GitHub): make the changes on a new branch `ai/quick-state-tax-tables` from `main`, run `npm test` and `npm run check`, commit with `Prompt: quick-state-tax-tables` on its own line in the message, push the branch and open a pull request against `main`. Its description holds your rationale, the files you touched, the commands you ran and `Prompt: quick-state-tax-tables` on its own line. Do not merge it. If your tool opens the pull request for the owner (Codex's "Create PR" button), end your last message with `Prompt: quick-state-tax-tables` so it reaches the description. The owner's board picks the pull request up within the hour; nothing else is needed.
- **If you cannot push** (a chat): put everything in your reply, as below. The owner pastes your reply into their board.

## How to answer

1. Start with a rationale of at most ten lines: what you changed and why.
2. Give the data as a whole JavaScript module (`export const ...`), each figure with a source comment, in a fenced block whose first line is `// path: <where it goes>`; then the tests that use it, as a unified diff or whole file.
3. A whole file goes in its own fenced code block whose first line is a comment with its path (`// path: modules/x/y/compute.js`).
4. End with the list of files you touched and the commands that verify them (`npm test`, `npm run check`).

Rules:
- Follow the project's rules in `AGENTS.md`: `compute.js` stays pure (no DOM, fetch, storage or timers); money math lives in code, never in an AI model; plain words on screen; every formula gets a test and a written source.
- Never edit `modules/registry.js` (generated by `npm run registry`), `data/` or `planner.properties`.
- Tests use `node:test` and `node:assert/strict`, in the module's `module.test.mjs` or `tests/<topic>.test.mjs`, so that `npm test` and `npm run check` stay green. Say which commands you ran; if you could not run them, say so plainly.
- Every number needs a source (IRS/SSA/CMS publication, statute, paper, or a worked example you show). Put the source next to the number in a comment and in the module README.
- The repo is public: use invented example data only (no real names, addresses, account numbers).
- If something is unclear, state your assumption and carry on; do not stop to ask.
