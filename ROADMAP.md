# Roadmap: phases, in build order

Each phase says what gets built, what it needs from you, and what "done" looks like.
Sessions are rough: one session is an evening with an AI helper. Inside a phase, page order
is free. `docs/MODULE_CATALOG.md` is the full page list; this file says when.

Rules that never change: every formula gets a test and a written source; the catalog and
CHANGELOG stay true; `npm test` and `npm run check` are green at the end of every session.

---

## Phase 0 -- scaffold  (done 2026-09-14)
Shell, module contract, store, router, UI kit, math core, PC server, `planner.properties`,
tests, checker, docs, 26 vendored reference projects.
Pages: Dashboard, Net worth, Settings, Docs, Ask the plan.

## Phase 0.5 -- the visual shell  (done 2026-09-15)
Every page in the catalog exists as a "Coming soon" placeholder with its purpose, its
starting-point source, and a notes box saved into the plan. The sidebar and the dashboard
show the whole layout as a user will see it. Home-screen install (PWA manifest + icons).
Firewall rule and LAN link for the phone. `Start-Planner.bat`.
**Done when:** you have walked every page on the phone and left notes on the ones you
care about. Those notes are the spec for the next phases.

## Phase 1 -- reachable from anywhere, always on  (done 2026-09-15)
- `auth.token` in `planner.properties`; devices enter it once. (done 2026-09-15; the PC itself is trusted)
- Tailscale instead of a router port forward (done 2026-09-15): the PC and the phone are on the tailnet; the link `http://<pc-name>.<tailnet>.ts.net:8787/` works with the token. See `docs/NETWORK.md`.
- `tools/install-autostart.ps1` + `Install-Autostart.bat` (done 2026-09-15): the server starts at logon and restarts if it dies.
- Dynamic DNS: not needed; the Tailscale name is stable.
**Done 2026-09-15:** the phone opened the plan through Tailscale and the status pill said "PC".
Left for later: `-AtStartup` mode (boot before logon) if the PC ever runs without a logon; the LAN-only firewall rule if the plain Wi-Fi link is wanted with Tailscale off.

## Phase 2 -- the plan's inputs  (pages built 2026-09-15; needs your numbers)
Pages: `household/people`, `cashflow/income`, `cashflow/expenses`, `goals/goals`,
`system/assumptions`, `balance/liquidity`, `balance/liabilities`, `overview/alerts` (first alerts:
stale snapshot, no emergency fund, missing people). All eight are usable.
Also: `system/assumptions` shows the source of every default (Damodaran, Shiller) and a
"reviewed" stamp; the dashboard checklist becomes completable. Shared math added:
`core/math/periods.js` (pay periods) and `core/math/dates.js` (ages, months between).
**Needs from you:** the people, current balances, income, and a rough expense list; the
assumptions your advisor used (they are in the advisor's plan document).
**Done when:** the dashboard checklist is 6 of 6 and net worth, income and expenses are real.

## Phase 3 -- transactions  (pages built 2026-09-15; needs your bank files)
Pages: `transactions/ledger`, `transactions/import` (CSV, then OFX/QFX), `transactions/rules`,
`transactions/categories`, `transactions/transfers`, `transactions/duplicates`,
`transactions/categorize` with `ai/categorizer` (model proposes, you confirm, confirmed rows
become rules), `cashflow/income-statement`, `cashflow/spending`.
Done 2026-09-15: all nine pages above plus `transactions/statements` (PDF/picture reader: text
layer first, then the text model, then a vision model for scans and photos) except `ai/categorizer`
(its job lives inside Categorise: "Ask the AI to suggest"). Left for a later session: OFX/QFX,
`transactions/reconcile`, `transactions/connect`, and moving the browser copy from localStorage
to IndexedDB once a plan passes a few thousand transactions (the PC copy is the real one; the
browser copy is a cache). Tabulator and Papa Parse were not needed: plain lists and `core/csv.js`.
**Needs from you:** CSV exports from your bank and cards (3 months is enough to start).
**Done when:** a month of real transactions imports cleanly, 90%+ auto-categorised, and the
income statement matches what you know you spent.

## Phase 4 -- cash flow and debt  (pages built 2026-09-15; needs real transactions to prove the forecast)
Pages: `cashflow/recurring`, `cashflow/forecast` (daily balance 90 days ahead),
`cashflow/budget`, `cashflow/sinking-funds`, `cashflow/subscriptions`, `debt/payoff`,
`debt/mortgage`, `debt/credit-cards`, `debt/ratios`, `debt/refinance`. All ten usable.
Shared math: `core/math/payoff.js` (snowball/avalanche), `core/math/shares.js`.
Left: `debt/student-loans`, `debt/consolidation` (catalogued, still placeholders).
**Done when:** the forecast predicts next month's checking balance within a few percent,
and the payoff page shows the date each debt ends under snowball and avalanche (the second is
true; the first needs three months of the owner's real transactions to check).

## Phase 5 -- retirement  (pages built 2026-09-16; needs your ssa.gov record and real balances)
Pages: `retirement/projection`, `retirement/contributions`, `retirement/social-security`
(lifted from ssa.tools; paste your ssa.gov record), `retirement/cash-flow` (the year-by-year
table, modelled on the Bogleheads RPM), `retirement/withdrawal-strategy` (from the FI Calc
guide's definitions + cFIREsim's spending module), `retirement/monte-carlo` (heavy: runs on
the PC, 10-20k paths), `retirement/historical` (Shiller data, every start year since 1871),
`retirement/rmd` (IRS 590-B tables, already in vendor/owl), `retirement/longevity`,
`retirement/fire`, `retirement/sequence-risk`.
Done 2026-09-16: all eleven pages usable. The engine is `core/math/retirement.js`; Social Security tables come from ssa.tools (`tools/extract-ssa.mjs`), history from Damodaran 1928-2025 (`tools/extract-history.py`; Shiller's 1871 data is a later extension). Charts are inline SVG (`modules/retirement/charts.js`), not uPlot. Taxes are one effective rate until Phase 6.
**Needs from you:** ssa.gov earnings record, retirement accounts' balances and
contributions, target retirement age and spending.
**Done when:** the plan shows a probability of success and a year-by-year cash-flow table
that you can compare against the advisor's plan's numbers.

## Phase 6 -- taxes  (2-3 sessions)
Pages: `taxes/federal` (engine lifted from UsTaxes `data/federal.ts` per year),
`taxes/brackets`, `taxes/capital-gains`, `taxes/withholding`, `taxes/estimated`,
`taxes/hsa-fsa`, `taxes/projection`, then `retirement/withdrawal-order` and
`retirement/roth-conversions` (Owl as the reference optimiser; PolicyEngine as an optional
local service for state tax).
**Needs from you:** last year's return (for withholding and bracket checks), your state.
**Done when:** this year's federal estimate is within a few hundred dollars of your actual
return's method, and the conversion page shows the bracket room each year.

Done 2026-09-16: all nine pages usable (`taxes/federal`, `brackets`, `capital-gains`, `withholding`, `estimated`, `hsa-fsa`, `projection`, `retirement/withdrawal-order`, `retirement/roth-conversions`). The engine is `core/math/tax.js` (parameter-driven; tables per year in `modules/taxes/federal/data/federal.js`, 2024-2025 from the vendored UsTaxes by `tools/extract-tax.mjs`, 2026 typed from Rev. Proc. 2025-32; later years inflated). The retirement projection can run through the brackets (`retirement.taxMode`), in a chosen withdrawal order, with Roth conversions filling a bracket. Left for later: state tax (PolicyEngine), self-employment tax and QBI, AMT, `taxes/filing-status`, `taxes/documents`; the IRMAA line is a flag, not a stop.

## Phase 7 -- investments  (2-3 sessions)
Pages: `investments/holdings`, `allocation`, `rebalance`, `fees`, `performance` (TTWR/IRR
ported from Portfolio Performance), `dividends`, `asset-location`, `glide-path`, `risk`,
`backtest` (Simba/Shiller data), `limits`, `tax-lots`.
**Needs from you:** positions per account (a brokerage CSV export).
**Done when:** allocation across every account is one chart, drift is flagged, and the fee
page shows the lifetime cost of what you hold.

Done 2026-09-16: all twelve pages usable. Holdings come from a typed list or a brokerage positions export (`parsePositions`); `core/math/returns.js` holds the return maths; history reaches back to 1871 with Shiller's data (`modules/investments/backtest/data/shiller.js`). No market data by design: prices are what the owner types or imports. Left for later: `investments/employer-stock`, `investments/crypto`, lots from the brokerage's cost-basis export, more asset classes in the backtest (Simba's sheet), price lookups.

## Phase 8 -- protection, estate, and the advisor comparison  (2-3 sessions)
Pages: `insurance/policies`, `life-needs`, `term-vs-permanent`, `cash-value`, `disability`,
`health`, `property`; `estate/documents`, `beneficiaries`, `legacy`, `gifting`;
`scenarios/advisor-plan` (enter the advisor's assumptions and recommendations as a scenario),
`scenarios/compare`.
`ai/reader` reads the advisor's plan PDF into proposals for the advisor-plan scenario.
**Needs from you:** the advisor's plan PDF, policy statements (benefit, premium, cash value).
**Done when:** the advisor's plan sits next to yours with the same pages and the
differences are explained by named assumptions.

## Phase 9 -- scenarios, stress tests, reports  (2 sessions)
Pages: `scenarios/stress-tests`, `goal-seek`, `sensitivity`; `reports/plan-summary`,
`statements`, `retirement`, `tax`, `annual-review`, `export`; `overview/health-score`,
`overview/next-best-action`, `overview/benchmarks`, `overview/monthly-review`.
**Done when:** a printable plan summary exists and the monthly review takes ten minutes.

Done 2026-10-30: all fifteen pages usable. Overview: Life timeline (every moment to the end of the plan), Next best action (the money left each month and the order to use it in), Plan health score (seven parts from the pages that work them out), How am I doing (the Fed's 2025 Survey of Consumer Finances, Fidelity's savings multiples, the lenders' ratios), Monthly review (nine steps, then marked reviewed with a note; new plan section `reviews`). Scenarios: Stress tests (five real market crises as you retire or now, lower returns, a job loss, never working again, a death, a long life, a care home), Sensitivity (the tornado), Goal seek (six levers solved for a goal). Reports: Plan summary, Retirement, Tax, Financial statements, Annual review, Export (eleven tables as CSV); `modules/reports/report-kit.js` prints a report as a document of its own. The retirement engine gained what-if hooks (`events`, `spendingChanges`, calendar bounds) and `copyInputs`. The phase started by clearing F-028 to F-031: every answer key now agrees (12,000 tax returns, 12,700 retirement cases, 66,000 Social Security rows; 0 to-do tests). Left for later: `scenarios/compare` and `scenarios/advisor-plan` (Phase 8), print styles for the other pages (F-035), the emergency-fund goal question (F-034).

## Phase 10 -- polish and daily life  (ongoing)
Offline service worker; live sync between devices; encryption at rest; per-device tokens;
Spanish strings; `ai/explain` on every page; `ai/notes` (voice memo to entries);
`system/backups` restore; `system/audit`; `household/calendar`; `career/*` and
`property/*` pages as they become relevant; charts everywhere.

---

## How a session goes
1. Open `AGENTS.md`, then the placeholder page's README and `plan.pageNotes` for that page.
2. Copy `modules/_template` over the placeholder (keep id/group/title), build compute first
   with tests, then the view.
3. Update the catalog row's status, add a CHANGELOG line, run `npm test && npm run check`.
4. Look at it on the phone.
