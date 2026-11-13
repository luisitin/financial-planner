// tests/first-view.kinds.mjs -- the first-view check's one table (docs/OPTIONAL.md "First-view budgets"): every usable
// page's kind and the shard that draws it, the budget of each kind, and the few lists the rule needs. Not in the page
// manifests, so no other lane's folder is touched to give a page its kind. Tightening a budget is a one-line change here.
//
// Kinds (docs/OPTIONAL.md "Words used"):
//   answer    a verdict worked out from the plan
//   list      things the person keeps
//   form      a page whose job is to ask
//   settings  things to switch or look up (Settings, Help, Get started, Our guesses, Step by step, Quick answers, Glossary)
//   report    made to be read whole or printed (reports/*, the long year tables, All pages, Docs, Diagnostics)
// The kinds are the spec's (claude-b, 2026-11-13: $SP/opt/spec.md section 6, read page by page); the shards split the
// pages by topic so that each of tests/first-view/1..6.test.mjs takes about the same time (measured: qa/first-view-node.mjs).
//
// The rule, per page (qa/first-view-lib.mjs judge): the worst of the three plan households and, apart, the empty plan
// meet the kind's budget, or stay at or under the page's entry in tests/first-view.known.json (words rounded up to the
// next ten). A count may only go down; one below its entry prints "lower me" and never fails.

/** The budget of each kind, per first view (R1). null: not counted for that kind. Where the numbers come from:
 * four tiles and "one sentence" are the owner's (design log 2026-09-16); 160 words and 8 figures is the Dashboard, the
 * page the walks call the model; five boxes fit one phone screen with Save in sight; the rest are the spec's sizes. */
export const BUDGETS = {
  answer: { words: 160, figs: 8, boxes: 1, tiles: 4, filled: 1, parts: 5 },
  // a list with rows asks for nothing on its first view; an empty list keeps its add form open (owner, 2026-09-15)
  list: { words: 240, figs: 16, boxes: 0, boxesEmptyList: 5, tiles: 4, filled: 1, parts: 5 },
  // every required box among the five; one "More details (optional)" per form (counted apart, never a part)
  form: { words: 200, figs: 4, boxes: 5, tiles: 0, filled: 1, parts: 1 },
  // one section per card, technical ones last: a structure the screenshot checks, not a number
  settings: { words: 200, figs: 2, boxes: 3, tiles: 0, filled: 1, parts: null },
  report: { words: null, figs: null, boxes: 2, tiles: 4, filled: 1, parts: 5 },
};
/** The first screen at 390 x 844 (R1's last column), measured in a browser by qa/first-view.mjs: an answer page shows at
 * most 110 words and 8 figures above the bottom edge. The rest of that column are structure checks there: the headline
 * (and on an answer or form page the first filled button) wholly above the edge, a settings page's first card whole. */
export const FIRST_SCREEN = { answer: { words: 110, figs: 8 } };
/** Any kind on the empty plan: one sentence on what to do first and one filled way to start. */
export const EMPTY_BUDGET = { words: 100, figs: 1, boxes: 5, tiles: 0, filled: 1, parts: null };

/** claude-a's 13 folders (as tests/wording.test.mjs lists them): measured and printed as to-do lines, never failed, never
 * in the counts file. Their hand-over is the spec's commit C11. */
export const CLAUDE_A_LANE = [
  "balance/projection", "balance/statement", "cashflow/statement", "debt/consolidation", "debt/student-loans",
  "goals/charitable", "goals/emergency-fund", "goals/travel", "goals/vehicle", "taxes/documents",
  "taxes/filing-status", "taxes/self-employment", "taxes/state",
];

/** Notices a page keeps inside one of its parts on purpose, by the words they start with, each with its reason
 * (check S5). Empty: no page has moved one. */
export const MOVED_NOTICES = {};

export const SHARDS = 6;
/** Every usable page: [kind, shard]. A usable page missing here fails shard 1. */
export const KINDS = {
  // shard 1: the start, the household and what you own and owe (27 pages)
  "balance/accounts": ["list", 1], "balance/assets": ["list", 1], "balance/liabilities": ["list", 1],
  "balance/liquidity": ["answer", 1], "balance/net-worth": ["list", 1], "balance/projection": ["answer", 1],
  "balance/statement": ["report", 1], "balance/update": ["form", 1], "household/calendar": ["list", 1],
  "household/contacts": ["list", 1], "household/documents": ["list", 1], "household/life-events": ["list", 1],
  "household/people": ["list", 1], "overview/alerts": ["list", 1], "overview/benchmarks": ["answer", 1],
  "overview/dashboard": ["answer", 1], "overview/guesses": ["settings", 1], "overview/guide": ["settings", 1],
  "overview/health-score": ["answer", 1], "overview/monthly-review": ["form", 1],
  "overview/next-best-action": ["answer", 1], "overview/pages": ["report", 1], "overview/plan": ["answer", 1],
  "overview/quick": ["settings", 1], "overview/setup": ["form", 1], "overview/start": ["settings", 1],
  "overview/timeline": ["report", 1],
  // shard 2: retirement: will the money last (9 pages)
  "retirement/buckets": ["answer", 2], "retirement/cash-flow": ["report", 2], "retirement/fire": ["answer", 2],
  "retirement/historical": ["answer", 2], "retirement/longevity": ["answer", 2],
  "retirement/monte-carlo": ["answer", 2], "retirement/projection": ["answer", 2],
  "retirement/sequence-risk": ["answer", 2], "retirement/social-security": ["answer", 2],
  // shard 3: retirement: taking money out, its rules and costs; taxes; debts (28 pages)
  // Your credit score keeps the scores a person saw (rest() of the older ones, "+ Add a newer score" once there is one): a list
  "debt/consolidation": ["answer", 3], "debt/credit-cards": ["answer", 3], "debt/credit-score": ["list", 3], "debt/mortgage": ["answer", 3],
  "debt/payoff": ["answer", 3], "debt/ratios": ["answer", 3], "debt/refinance": ["answer", 3],
  "debt/student-loans": ["answer", 3], "retirement/annuities": ["list", 3], "retirement/contributions": ["list", 3],
  "retirement/healthcare": ["answer", 3], "retirement/medicare": ["answer", 3], "retirement/pensions": ["list", 3],
  "retirement/rmd": ["answer", 3], "retirement/roth-conversions": ["answer", 3],
  "retirement/withdrawal-order": ["answer", 3], "retirement/withdrawal-strategy": ["answer", 3],
  "taxes/brackets": ["answer", 3], "taxes/capital-gains": ["answer", 3], "taxes/documents": ["list", 3],
  "taxes/estimated": ["answer", 3], "taxes/federal": ["answer", 3], "taxes/filing-status": ["answer", 3],
  "taxes/hsa-fsa": ["answer", 3], "taxes/projection": ["report", 3], "taxes/self-employment": ["answer", 3],
  "taxes/state": ["answer", 3], "taxes/withholding": ["answer", 3],
  // shard 4: money in and out, bank lines; the app itself and its AI helper (35 pages)
  "ai/assistant": ["form", 4], "ai/categorizer": ["form", 4], "ai/critic": ["form", 4], "ai/explain": ["form", 4],
  "ai/glossary": ["settings", 4], "ai/notes": ["form", 4], "ai/reader": ["form", 4], "cashflow/budget": ["list", 4],
  "cashflow/budget-percent": ["answer", 4], "cashflow/expenses": ["list", 4], "cashflow/forecast": ["answer", 4],
  "cashflow/income": ["list", 4], "cashflow/income-statement": ["report", 4], "cashflow/paycheck": ["answer", 4],
  "cashflow/recurring": ["list", 4], "cashflow/sinking-funds": ["list", 4], "cashflow/spending": ["answer", 4],
  "cashflow/statement": ["report", 4], "cashflow/subscriptions": ["list", 4], "system/assumptions": ["answer", 4],
  "system/audit": ["list", 4], "system/backups": ["list", 4], "system/diagnostics": ["report", 4],
  "system/docs": ["report", 4], "system/help": ["settings", 4], "system/settings": ["settings", 4],
  "transactions/categories": ["list", 4], "transactions/categorize": ["form", 4],
  "transactions/duplicates": ["list", 4], "transactions/import": ["form", 4], "transactions/ledger": ["list", 4],
  "transactions/reconcile": ["form", 4], "transactions/rules": ["list", 4], "transactions/statements": ["form", 4],
  "transactions/transfers": ["list", 4],
  // shard 5: reports, goals, property (21 pages)
  "goals/charitable": ["answer", 5], "goals/education": ["answer", 5], "goals/emergency-fund": ["answer", 5],
  "goals/goals": ["list", 5], "goals/house": ["answer", 5], "goals/prioritizer": ["answer", 5],
  "goals/travel": ["list", 5], "goals/vehicle": ["answer", 5], "property/home": ["answer", 5],
  "property/purchase": ["answer", 5], "property/renovation": ["answer", 5], "property/rent-vs-buy": ["answer", 5],
  "property/rental": ["list", 5], "property/vehicles": ["list", 5], "reports/annual-review": ["report", 5],
  "reports/export": ["report", 5], "reports/if-something-happens": ["report", 5], "reports/plan-summary": ["report", 5],
  "reports/retirement": ["report", 5], "reports/statements": ["report", 5], "reports/tax": ["report", 5],
  // shard 6: the what-ifs, investments, insurance, estate, career (41 pages)
  "career/benefits": ["answer", 6], "career/business": ["answer", 6], "career/equity": ["list", 6],
  "career/human-capital": ["answer", 6], "career/offer-compare": ["answer", 6], "career/salary": ["answer", 6],
  "career/side-income": ["list", 6], "estate/beneficiaries": ["list", 6], "estate/digital": ["list", 6],
  "estate/documents": ["list", 6], "estate/estate-tax": ["answer", 6], "estate/gifting": ["list", 6],
  "estate/inheritance": ["list", 6], "estate/legacy": ["answer", 6], "insurance/cash-value": ["answer", 6],
  "insurance/disability": ["answer", 6], "insurance/health": ["answer", 6], "insurance/life-needs": ["answer", 6],
  "insurance/ltc": ["answer", 6], "insurance/policies": ["list", 6], "insurance/property": ["answer", 6],
  "insurance/term-vs-permanent": ["answer", 6], "investments/allocation": ["answer", 6],
  "investments/asset-location": ["answer", 6], "investments/backtest": ["answer", 6],
  "investments/crypto": ["list", 6], "investments/dividends": ["answer", 6],
  "investments/employer-stock": ["list", 6], "investments/fees": ["answer", 6],
  "investments/glide-path": ["answer", 6], "investments/holdings": ["list", 6], "investments/limits": ["answer", 6],
  "investments/performance": ["answer", 6], "investments/rebalance": ["answer", 6],
  "investments/risk": ["answer", 6], "investments/tax-lots": ["list", 6], "scenarios/advisor-plan": ["answer", 6],
  "scenarios/compare": ["answer", 6], "scenarios/goal-seek": ["answer", 6], "scenarios/sensitivity": ["answer", 6],
  "scenarios/stress-tests": ["answer", 6],
};
