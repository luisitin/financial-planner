---
id: build-overview-timeline
title: Build "Life timeline" (overview/timeline)
category: build
size: L
effort: One coding agent with the repo, under an hour
destinations: Claude Code, Codex, Gemini CLI, Claude (2nd account), ChatGPT
output: files
---
# Build "Life timeline" (overview/timeline)

You are improving **Financial Planner**, an open-source personal finance app: https://github.com/luisitin/financial-planner (branch `main`, MIT licence).
Plain ES modules, Node 20, no framework, no bundler. One page = one folder `modules/<group>/<id>/` holding `module.js` (manifest),
`compute.js` (pure math: runs in the browser, on the PC server and in tests), `view.js` (DOM only), `README.md` (purpose,
formulas with sources) and `module.test.mjs` (node:test). Shared math lives in `core/math/`. The plan is one JSON object
(`docs/DATA_MODEL.md`). The owner reads the app on a 390 px phone and is not a finance professional: words on screen are plain.

**Read these first** (raw files you can fetch directly; the whole repo is at https://github.com/luisitin/financial-planner):
- https://raw.githubusercontent.com/luisitin/financial-planner/main/AGENTS.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/docs/CONVENTIONS.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/docs/DATA_MODEL.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/overview/timeline/module.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/overview/timeline/README.md
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/_template/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/_template/view.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/_template/module.test.mjs
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/overview/dashboard/compute.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/modules/overview/dashboard/view.js
- https://raw.githubusercontent.com/luisitin/financial-planner/main/core/ui/dom.js

## The task

Promote the placeholder page `overview/timeline` (build phase 9) to a working page.

**What it is for** (the catalog's words, shown to the owner): Shows your ages, retirement, goals, mortgage payoff, Medicare and required minimum distributions on one timeline.
**Starting points named in the catalog:** none; use first principles and cite your sources.

Do this:
1. `compute.js`: a pure `compute(plan, params)` that returns everything the page shows, read from the plan sections it needs (docs/DATA_MODEL.md). Reuse `core/math/` and other pages' results by importing their `compute` (as `modules/overview/alerts/compute.js` does) instead of re-deriving them. If the page needs new plan fields, add them as optional fields with defaults (no schema bump) and document them in `docs/DATA_MODEL.md`.
2. `view.js`: follow the "Design rules" in AGENTS.md: a short plain-words intro and an empty state that says what to do first; big figures through `ui.stat`; on a phone, tables become `.records` lists (`.only-wide` / `.only-narrow`); the add form folds behind "+ Add another ..." once there is data; every save confirms with `ui.notice("ok", ...)` kept in a module-level `pending`; changes go through `ctx.store.update(draft => ...)` on save, never per keystroke. No new global CSS. Spell out every abbreviation on screen.
3. `module.js`: keep `id`, `group`, `title`, `icon`, `order`; set `status: "usable"`, `version: 1`, fill `needs`, `writes`, `heavy`; drop `placeholder` and `seeds` (keep `purpose`).
4. `README.md`: purpose, inputs, outputs, every formula with its source, edge cases, what is left for later.
5. `module.test.mjs`: a test for every formula, worked by hand in a comment, plus empty-plan and edge cases.
6. The catalog row in `docs/MODULE_CATALOG.md`: status `usable`. One line under "Unreleased" in `CHANGELOG.md`: `- [builder] ...`.

Use `modules/overview/dashboard` as the example of a finished page in this project.

## How to hand it back

- **If you can work in the repo** (Codex, Claude Code, Gemini CLI, Jules, Copilot's coding agent, or any tool connected to GitHub): make the changes on a new branch `ai/build-overview-timeline` from `main`, run `npm test` and `npm run check`, commit with `Prompt: build-overview-timeline` on its own line in the message, push the branch and open a pull request against `main`. Its description holds your rationale, the files you touched, the commands you ran and `Prompt: build-overview-timeline` on its own line. Do not merge it. If your tool opens the pull request for the owner (Codex's "Create PR" button), end your last message with `Prompt: build-overview-timeline` so it reaches the description. The owner's board picks the pull request up within the hour; nothing else is needed.
- **If you cannot push** (a chat): put everything in your reply, as below. The owner pastes your reply into their board.

## How to answer

1. Start with a rationale of at most ten lines: what you changed and why.
2. Give every new or changed file whole, each in its own fenced code block whose first line is a comment with its path (`// path: modules/x/y/compute.js`, `<!-- path: modules/x/y/README.md -->`, `# path: ...`).
3. End with the list of files you touched and the commands that verify them (`npm test`, `npm run check`).

Rules:
- Follow the project's rules in `AGENTS.md`: `compute.js` stays pure (no DOM, fetch, storage or timers); money math lives in code, never in an AI model; plain words on screen; every formula gets a test and a written source.
- Never edit `modules/registry.js` (generated by `npm run registry`), `data/` or `planner.properties`.
- Tests use `node:test` and `node:assert/strict`, in the module's `module.test.mjs` or `tests/<topic>.test.mjs`, so that `npm test` and `npm run check` stay green. Say which commands you ran; if you could not run them, say so plainly.
- Every number needs a source (IRS/SSA/CMS publication, statute, paper, or a worked example you show). Put the source next to the number in a comment and in the module README.
- The repo is public: use invented example data only (no real names, addresses, account numbers).
- If something is unclear, state your assumption and carry on; do not stop to ask.
