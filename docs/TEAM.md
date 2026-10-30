# Working in parallel: three sessions, one folder

The owner runs up to three Claude Code sessions on this folder at the same time. They share
the files, the running server on port 8787 and the owner's attention, so each one stays in
its lane and leaves notes for the others here. Read this file at the start of every work
block and again before touching anything outside your lane.

| role | job | may write | how it is started |
|---|---|---|---|
| **Builder** | works through `ROADMAP.md` phase by phase: promotes placeholder pages, math, schema, server, tools, tests, docs. Fixes bugs that the tester files for it. | everything that is not in the designer's or tester's list below | the owner's main session (any folder; it uses absolute paths) or a session in this folder told to "build the next phase" |
| **Designer** | the design review loop: screenshots pages, proposes options, applies exactly what the owner picks | `core/ui/base.css`, `core/ui/*.js`, `index.html`, `modules/*/*/view.js` of pages whose catalog status is usable or complete, manifests (`title`, `icon`, `purpose`, `order` only), purposes in `docs/MODULE_CATALOG.md`, `docs/DESIGN_LOG.md`, the "Design rules" section of `AGENTS.md`, `CHANGELOG.md` lines | `Design-Review.bat`, or `/design-review` in a session opened in this folder |
| **Tester** | uses the app like a person would, on a pretend plan, and reports bugs, confusing spots and ideas with concrete suggestions | `docs/FEEDBACK.md` and files under `qa/` only. Never code, never docs, never the plan. | `Tester.bat`, or `/tester` in a session opened in this folder |

## What the builder does at the start of every phase (the owner's standing order)
1. Read every item in `docs/FEEDBACK.md`: fix the ones for the builder, and read the ones the
   designer or tester marked fixed or verified so the next pages are built the way they now work.
2. Read every entry in `docs/DESIGN_LOG.md` since the last phase and build the new pages to
   those decisions from the start (the rules are also summarised in `AGENTS.md` "Design rules").
3. Run `node qa/smoke-all.mjs` (every usable page in the sandbox: errors, overflow, tap targets)
   and file anything it finds. Only then start the phase.

## Rules that keep them from colliding
1. **Stay in your lane.** The table above is the whole rule. If your job needs a file in
   someone else's lane, write it up instead: the designer files a "for: builder" item in
   `docs/FEEDBACK.md` when a design needs new numbers; the builder leaves layout and
   wording of existing usable pages to the designer and only builds new pages; the tester
   never fixes anything, not even a typo.
2. **Claim before you touch a page another role could touch.** Add a line to "Now editing"
   below before you start and delete it when you are done. The builder claims the pages it
   is promoting (they are still placeholders, so the designer skips them). The designer
   claims a `view.js` while it is changing it. A claim older than a day is stale: ignore it.
3. **Shared files are append-only and re-read before every edit:** `CHANGELOG.md` (prefix
   your lines: `- [builder] ...`, `- [design] ...`), `docs/MODULE_CATALOG.md` (builder: the
   rows of pages it promotes; designer: the purpose column of usable pages), `AGENTS.md`
   (designer: "Design rules" only), this file. `modules/registry.js` is generated: anyone
   may run `npm run registry`, nobody edits it.
4. **Never leave the app broken.** The server serves files live and the owner may be
   looking at the phone. Finish a page before `npm run registry` makes it appear; run
   `node --check` on every JS file you touched; run `npm test && npm run check` before you
   stop. If a test fails in a file that is not yours, write it in "Notes for each other"
   and carry on. Do not fix their file.
5. **Only the builder restarts the server** (`server/` is its lane). Designer and tester:
   if `curl -s http://127.0.0.1:8787/api/health` fails, wait 30 s and retry; after two
   minutes, start it with `Start-Process -FilePath "C:\FinancialPlanner\Start-Planner.bat"`.
   Never stop it.
6. **The owner's real plan is not a test fixture.** Anything that adds, edits or deletes
   data runs in the sandbox: open the app with `?sandbox=1`
   (`http://127.0.0.1:8787/?sandbox=1`) and it works on a separate pretend plan kept only in
   that browser; the status pill says "Sandbox". `tools/drive.mjs` uses the sandbox unless
   told `--real`. Screenshots of the real plan (`tools/shot.mjs`) are fine: they change
   nothing. Add sample data to the real plan only when the owner asks, and remove it after.
7. **Read `docs/FEEDBACK.md` at the start of every work block.** Fix the items addressed to
   your role, mark them `fixed (date, role)` in place, and add a CHANGELOG line. Declined
   items get `declined (why)`; the owner decides ties.
8. **Talk to the owner, not to each other.** Each session reports to the owner in its own
   window. This file and `docs/FEEDBACK.md` are the only channels between sessions.

Builders working from other machines at the same time (claude-a, claude-b, codex) split the
builder's work by lanes in `docs/WORKBOARD.md`; the roles above still apply to each of them.

## Now editing (claims)
| who | since | files or pages | what |
|---|---|---|---|

## Handoffs
- Builder finished a page -> its catalog status says `usable`, its claim is gone, a
  CHANGELOG line names it. The designer adds it to its queue.
- Designer needs new numbers or data -> `docs/FEEDBACK.md` item with `for: builder`.
- Tester found something -> `docs/FEEDBACK.md` item with `for: builder`, `for: designer`
  or `for: owner` (a decision, not a bug).
- Anyone changed how the app is run (ports, scripts, launchers) -> a line under
  "Notes for each other" below, dated.

## Notes for each other
- 2026-10-30 builder: Phase 9 pages are usable and unclaimed (Life timeline, Next best action, Plan health score, How am I doing, Monthly review, Stress tests, Sensitivity, Goal seek, Plan summary, Retirement report, Tax report, Financial statements, Annual review pack, Export). Designer: the reports are drawn as a sheet by `modules/reports/report-kit.js` (`reportFrame`, `figs`, `rtable`, `wideTable`, `section`, `list`) and print through their own button as a document of their own; app-wide print styles are F-035. The Life timeline, Stress tests, Sensitivity and Health score scope their own styles in a wrapper div (`.tl-root`, `.st-root`, `.sn-root`, `.hs-root`). Tester: `qa/fixtures/family-plan.mjs` is the sample family made whole (retirement saving, Social Security, loan details) and `qa/flows/seed-family.js` puts it in the sandbox; the stress tests, sensitivity, goal seek, health score and the reports are `heavy` (they run on the PC when connected, a few hundred ms here). `tools/shot.mjs` and `tools/drive.mjs` also find Chromium on Linux.
- 2026-10-30 builder: Phase 8 pages are usable and unclaimed (Policies, Life insurance needs, Term vs permanent, Cash-value model, Disability, Health plan compare, Long-term care, Auto/home/umbrella; Documents, Beneficiary audit, Legacy goals, Estate tax, Gifting, Expected inheritance, Digital assets; Scenario compare, Advisor's plan; Document reader). Designer: each page scopes its styles in its own wrapper (`.ln-root`, `.di-root`, `.ltc-root`, `.pr-root`, `.tp-root`, `.cv-root`, `.hp-root`, `.ed-root`, `.eb-root`, `.gf-root`, `.lg-root`, `.ih-root`, `.dg-root`, `.sc-root`, `.ap-root`, `.rd-root`); the per-policy terms the Policies form does not ask sit in folds on the page that needs them. Tester: new sandbox seeds in `qa/flows/` (seed-policies, seed-ltc, seed-whole-life, seed-health, seed-beneficiaries, seed-gifts, seed-legacy, seed-inheritance, seed-digital, seed-scenarios, seed-advisor), all after seed-family.js; Life insurance needs, Long-term care, Legacy goals, Expected inheritance, Scenario compare and Advisor's plan are `heavy`. The Document reader's PDF route needs `npm install` on the PC (pdfjs-dist); pasted text works everywhere.
- 2026-09-16 builder: Phase 7 pages are usable and unclaimed (Holdings, Allocation, Rebalance, Fees, Performance, Dividends, Asset location, Glide path, Risk, Backtest, Contribution limits, Tax lots). Designer: Allocation draws two stacked bars with inline colours (`COLORS` at the top of its view.js) and a chip legend; Backtest and Glide path use the shared line chart (Backtest with the new `log` option). Tester: `qa/fixtures/investments-plan.mjs` and `qa/flows/seed-holdings.js` (the smoke run now seeds holdings after the sample); the Holdings importer reads `qa/fixtures/positions-fidelity.csv`, `-schwab.csv`, `-vanguard.csv` (paste them into "Or paste"). Net worth's "Save today's totals" now also writes a balance point per account (Performance needs two).
- 2026-09-16 builder: Phase 6 pages are usable and unclaimed (Federal estimate, Bracket explorer, Capital gains, Withholding check, Estimated payments, HSA and FSA, Tax year by year, Withdrawal order, Roth conversions). Designer: the Federal estimate's forms sit in three folds under the results; the two retirement pages rank options by "left at the end after tax" and a "Use this" button per row. Tester: `qa/fixtures/tax-plan.mjs` is the tax fixture; flows `qa/flows/tax-figures.js`, `tax-sale.js`, `tax-order.js` (run after `seed-sample.js` with `--profile`); the Projection page's settings now have "How tax is worked out" (flat or brackets) and the retirement pages change with it. Labels to know: the Capital gains page has "Holding period" (the what-if) and "How long you held it" (the sale form).
- 2026-09-16 03:00 builder: Phase 5 pages are usable and unclaimed (Will the money last?, Retirement
  contributions, Social Security, Year by year, How much to take out, Chance the money lasts, If history
  repeated, Order of returns, Required withdrawals, How long to plan for, Financial independence).
  Designer: yours to review; they follow the settled rules (folded forms, records, pending confirmations,
  no abbreviations). Tester: `qa/fixtures/retirement-plan.mjs` is a couple with everything filled in; the
  sample seed has no contributions or Social Security, so the sample plan "runs out in 2058" on purpose.
- 2026-09-15 23:30 builder: Phase 4 pages are usable and unclaimed (Bills and regular payments, Cash-flow
  forecast, Budget, Irregular expenses, Subscriptions, Pay off debts, Mortgage, Credit cards, What lenders
  see, Refinance) and Ask the plan (`ai/assistant`) is usable: designer, all yours to review. Twelve tester
  items are marked fixed in FEEDBACK.md; tester, please re-check them. I touched one line each in
  `expenses/view.js` (Next year / One-time tiles, whole percentages), `liquidity/view.js` (set-aside and
  one-time tiles), `goals/view.js` ("shared with") and added a credit-limit field on `liabilities/view.js`.
- 2026-09-15 21:10 builder: server restarted twice for the statement reader (`/api/statement/read`);
  `pdfjs-dist` and `@napi-rs/canvas` are now real npm dependencies (`npm install` after pulling).
  Reading a picture takes about 1-2 minutes on this PC (qwen3.5:9b); the page says so.
- 2026-09-15 designer: `ui.form` now shows percent fields as percentages when prefilled (stored 0.07 -> input 7). Pass fractions in `values`; do not multiply by 100 in a view (Assumptions was changed accordingly).
- 2026-09-15 19:30 builder: Phase 3 pages are usable and unclaimed (Ledger, Import, Categorise,
  Rules, Categories, Transfers, Duplicates, Income statement, Where the money goes). Test them
  in the sandbox with `qa/flows/seed-sample.js` then `qa/flows/import-csv.js` (uses
  `qa/fixtures/chase-checking.csv`); a real file from the owner's bank has not been tried yet.
- 2026-09-15 16:30 builder: the server now also starts by itself at logon (Task Scheduler
  job "Financial Planner server", minimised window). If you ever find two server windows,
  the second one just failed to bind 8787 and exited; nothing to do.
- 2026-09-15 15:40 builder: server restarted with `auth.token` set (Phase 1). Nothing changes
  for tools and browsers on this PC (`auth.trustLocal=true`); phones and other PCs enter the
  token once in Settings (`Show-Token.bat` prints it). `curl` from a LAN address gets 401
  without the `X-Planner-Token` header: that is correct, not a bug.
- 2026-09-15 15:20 builder: Phase 2 pages are usable and unclaimed (People, Income, Expenses,
  Goals, Assumptions, Emergency fund, Debts, Needs attention): designer, they are yours to
  review. They use `.page-list` rows you tap to edit and one form per page.
- 2026-09-15 builder: `core/search.js` is the one search matcher (sidebar + All pages);
  manifests may carry `aliases: [...]` in the owner's words.
- 2026-09-15 builder: the npm `claude` on this PC is a broken stub; the launchers use
  `tools\run-claude.bat`, which finds the VS Code extension's binary. `claude --version`
  from a plain terminal will fail until the official installer is run.
- 2026-09-15 builder: `core/format.js` now parses `YYYY-MM-DD` as a local day (dates
  showed one day early in the Americas). No page change needed.
