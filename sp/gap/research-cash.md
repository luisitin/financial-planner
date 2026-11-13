# Research: budgeting and cash flow apps (feature merge)
Read 2026-11-13. Researcher: [model] subagent. Limited depth: 8 searches + 3 page fetches (2 of 4 first-party pages failed: Firefly III docs 403, Monarch features 404).

## Evidence legend
- [V] seen in a source this session (URL given). First-party = product's own site/docs.
- [K] from my background knowledge of the product, NOT re-verified this session. Treat as leads to confirm before relying.
- Prices differ between review sites; none confirmed on a first-party pricing page. Do not quote prices into the app without checking.

## Sources actually read
- S1 Actual Budget docs, budgeting: https://actualbudget.org/docs/budgeting/ (first-party, fetched 2026-11-13)
- S2 YNAB glossary: https://support.ynab.com/en_us/ynab-glossary-a-guide-BJd80SORq.md (first-party, fetched 2026-11-13)
- S3 Actual homepage/releases via search: https://actualbudget.org/ , https://actualbudget.org/docs/releases (import formats QIF, OFX, QFX, CAMT.053, CSV; option to turn off de-dup; Formula in rules)
- S4 Lunch Money support: https://support.lunchmoney.app/finances/recurring-items/recurring-transactions , https://support.lunchmoney.app/setup/rules.md , https://support.lunchmoney.app/settings/multicurrency , https://lunchmoney.app/features (first-party, search snippets only)
- S5 Tiller: https://tiller.com/ , https://www.tillerhq.com/features/daily-account-update-email/ (first-party, snippets); review https://robberger.com/tiller-money-review/
- S6 Monarch: reviews only: https://www.thepennyhoarder.com/budgeting/monarch-money-review/ , https://sacra.com/research/monarch-money
- S7 Copilot/Simplifi: https://www.simplifimoney.com (first-party, snippet), https://getfinny.app/blog/copilot-money-vs-quicken-simplifi-2026 , https://www.thepennyhoarder.com/budgeting/budgeting-copilot-money-review/
- S8 Goodbudget/EveryDollar/PocketGuard: https://www.nerdwallet.com/finance/learn/goodbudget-app-review , https://ramseysolutions.com/budgeting/budgeting-apps-comparison , https://pocketguard.com/blog/pocketguard-vs-goodbudget/
- S9 Rocket Money: https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost (first-party)
- S10 Origin: https://www.useorigin.com/resources/blog/new-in-origin-investing-savings-and-ai-tools-make-wealth-building-easy-and ; https://benzinga.com/money/origin-financial-review
- S11 Buckets: https://www.budgetwithbuckets.com (via search; alt listing https://alternativeto.net/software/buckets-budgeting/about)
- S12 GnuCash/Quicken: comparison sites only (softwareadvice, appmus). Weak.
- Not fetched at all: Empower dashboard, Quicken Classic first-party tiers, Firefly III docs (403), GnuCash manual.

## Per-product summary (basic to advanced, and how depth is chosen)
- YNAB (paid): zero-based "give every dollar a job" (Ready to Assign), targets per category (spend/save/set aside; monthly, weekly or by-date), reconcile (lock icon on matched), scheduled transactions, flags, memos, credit-card payment category and "float", Income v Expense and Net Worth reports, file import OFX/QFX/QIF/CSV, direct bank import. [V S2] Age of Money, loan planner, shared budgets: mentioned in reviews [K]. Depth: method is fixed; depth is in targets and reports. No investment tracking (review claim).
- Monarch (paid, Core/Plus tiers per reviews [V S6]): rules, splits, tags, custom categories, recurring detection with reminders, forecast (desktop only per one review), net worth, investments, goals, household sharing [K], flex vs category budget [K]. Depth: web app has more control than phone [V S6].
- Copilot Money (paid, Apple-first [V S7]): AI categorization that learns, trends, investments, net worth, category budgets, recurring detection, spending watchlist-like vendor monitoring [V S7 secondary].
- Quicken Simplifi (paid): spending plan = income minus bills minus savings, adjusts as you spend; watchlist (paid only); projected balances forecast; credit score; custom dashboard; auto rules. [V S7]
- Quicken Classic (paid, desktop): bank download, bill pay, investments, tax reports, rental/business property tiers [K, S12 weak].
- Rocket Money: free shows recurring charges; premium adds in-app cancel, Smart Savings, credit score, net worth, unlimited custom categories; bill negotiation for a success fee [V S9 + reviews, sources disagree].
- Tiller (paid): bank feeds into Google Sheets/Excel; Foundation Template, AutoCat rules; you own the sheet [V S5].
- Lunch Money (paid): recurring items with recurring rules, rules engine (not AI), splits and groups, multi-currency with historical rates, crypto, open API [V S4].
- Actual Budget (free, open source, local-first): envelope budgeting, rollover, hold for next month, auto-hold income, overspending carryover or rollover, copy last month, transfers between envelopes; tracking budget option; schedules; rules incl. formula; multi-currency; imports QIF/OFX/QFX/CAMT.053/CSV with column mapping; reports; themes; notifications; experimental features toggle; sync with encryption [V S1, S3 for most]. Depth: a visible "Experimental features" switch and a "tracking budget" alternative to envelopes.
- Firefly III (free, self-hosted): budgets, piggy banks, bills, recurring transactions, rules, tags, splits, reports, multi-currency, webhooks, API, importers [K; docs fetch 403].
- GnuCash (free): double-entry, scheduled transactions, reconciliation (manual), OFX/QIF import, reports, small-business invoices [K + S12 weak].
- Goodbudget (free tier + paid): envelopes, free ~20 envelopes, 1 account set, 2 devices, bank sync only on paid [V S8; sources disagree on caps].
- EveryDollar (free + Premium): free has unlimited budget lines, manual entry; bank sync Premium-only; baby-steps tie-in [V S8].
- PocketGuard (free + Plus): "In My Pocket" safe-to-spend number; Plus adds custom categories, debt payoff, longer history, "Pace" alerts [V S8].
- Empower dashboard (free tools): net worth, cash flow, retirement planner, fee analyzer; tied to advisory sales [K, not fetched].
- Origin: budgeting + investing + CFP advice + tax filing + equity comp + estate docs at extra price; AI advisor [V S10].
- Buckets (desktop envelope app): CSV import, offline, scheduled transactions, borrowing between envelopes, net-worth graph, what-if sandbox [V S11 weak].

## Connection flags (what needs something this app promises never to have)
BANK = needs bank login/aggregator. FEED = paid data feed. ADV = licensed advice. TRADE = trading. SUCCESS = fee service.
The app can offer a file/paste/photo substitute where noted in "Plain-words idea".

## MERGED FEATURE LIST
Columns: # | Feature (plain words) | What it does for a household | Who has it (tier) | Depth | Flags | Evidence

### A. Budget methods
1 | Give every dollar a job (zero-based) | Income minus planned spending equals zero | YNAB(paid), Actual(free), EveryDollar(free), Monarch(paid, flex alt), Buckets | method; "Ready to Assign" turns red if overassigned | none | [V S1,S2]
2 | Envelopes (money set aside per purpose) | Each category holds real money; unspent carries over | Actual, Goodbudget(free capped), YNAB, Buckets | per-envelope balance, borrow between | none | [V S1,S8,S11]
3 | Tracking budget (just watch spending vs plan, no envelope balance) | Simpler for people who dislike assigning | Actual (tracking mode), Monarch, Copilot, Simplifi | monthly category limits | none | [V S1 nav list; K]
4 | Percent split rules (50/30/20 etc) | Budget as percents of income | none of the products natively except templates/guides; apps like Origin guide | preset ratios, editable | none | [K]
5 | Flex budget (one pool for flexible spending, fixed for bills) | Fewer categories to manage | Monarch (flex), Simplifi spending plan | 3 groups: fixed, flexible, non-monthly | none | [K]
6 | Spending plan from income minus bills minus savings | One "left to spend" number | Simplifi(paid), Copilot(paid), PocketGuard "In My Pocket" | auto-updates as you spend | BANK for auto | [V S7,S8]
7 | Safe-to-spend today | Daily/weekly number after bills and goals | PocketGuard, Simplifi, Rocket Money | simple | BANK for auto | [V S8]
8 | Rollover of unspent money | Leftover moves to next month | Actual, YNAB, Goodbudget, Monarch (per category) | on/off per category | none | [V S1]
9 | Overspending handling: pull from another envelope, or carry the deficit | Choose how to cover overspend | Actual (deduct next month or roll negative), YNAB (yellow/red) | per category | none | [V S1,S2]
10 | Hold money for next month / buffer | Put this month's extra aside | Actual (incl. auto-hold 12 months), YNAB (age of money) | multi-month | none | [V S1]
11 | Copy last month's budget; fill from average | One tap start of a month | Actual, YNAB, Monarch | presets | none | [V S1]
12 | Budget templates / goal-driven fill (targets) | Per category "need $X by date / each month" | YNAB targets, Actual templates [K], Monarch goals | monthly, weekly, by date | none | [V S2 partial]
13 | Irregular and yearly expenses (sinking funds) | Spread car insurance or gifts across months | YNAB, Goodbudget annual envelopes, Buckets, Monarch | by date target | none | [V S8; K]
14 | Income-based paycheck budgeting (budget per paycheck) | Plan each pay period | YNAB users, Origin, Tiller templates | per-paycheck view | none | [K]
15 | Rolling/zero-based "restart my budget" | Fresh start without losing history | Actual docs link, YNAB Fresh Start | one action | none | [V S1,S2]
16 | Multiple budgets or "what if" budget copy | Compare scenarios | Buckets sandbox, Actual (separate files) | sandbox | none | [V S11 weak]
17 | Joint-account strategies (his/hers/ours) | Share bills, keep own money | Actual docs, Monarch/Copilot partner access | split contribution rules | none | [V S1 nav; K]

### B. Categories, rules, splits, tags, notes
18 | Custom categories and groups | Rename, nest, reorder, hide | all | groups, emoji/icons, hidden | none | [V S8]
19 | Category free vs paid limit | EveryDollar free unlimited lines; Goodbudget caps | Goodbudget, PocketGuard | cap | none | [V S8]
20 | Auto-categorize by rules (if payee contains X) | Stops repeat work | Monarch, Lunch Money, Actual, Simplifi, Tiller AutoCat, Firefly III | conditions + actions, run on update option | none | [V S3,S4,S5,S6]
21 | AI/learning categorization | Learns from your edits | Copilot, Monarch, Origin | automatic | BANK usually | [V S7]
22 | Rules with formulas / multiple actions | Advanced matching, rename payee, set tags | Actual (formula), Firefly III, Lunch Money | advanced | none | [V S3]
23 | Payee cleanup (normalize "AMZN MKTP") | Clean names | Actual, Monarch, Copilot | rule-based | none | [V S3]
24 | Split one transaction across categories | Grocery trip = food + household | YNAB, Monarch, Lunch Money, Actual, GnuCash, Firefly III | n-way, percents or amounts | none | [V S2,S4,S6]
25 | Split between people (shared bill with a roommate) | Track who owes what | Lunch Money groups, Splitwise-like in Monarch? [K] | group/reimburse | none | [V S4]
26 | Tags | Cross-cut categories (trip, tax-deductible) | Monarch, Lunch Money, Firefly III, Copilot | many per transaction | none | [V S6; K]
27 | Notes and memos on a transaction | Remember why | YNAB memo, Monarch notes, all | free text | none | [K]
28 | Flags / colors / "needs review" | Mark things to revisit | YNAB flags | 6 colors | none | [V S2]
29 | Receipts attached to transactions | Photo for returns and taxes | Monarch (attach), Lunch Money?, Quicken Classic, Simplifi? | file/photo | storage | [K]
30 | Returns and reimbursements handling | Net a refund or work expense | Actual docs, Lunch Money | link-to-original | none | [V S1 nav]
31 | Hide/exclude transactions from reports | Ignore transfers or one-offs | Monarch, Lunch Money, Copilot | toggle | none | [K]
32 | Transfers recognized (not counted as spending) | Accurate totals | all | auto or manual | BANK for auto | [K]

### C. Transactions in: manual, import, bank
33 | Manual entry | Type it | all | form | none | [V]
34 | CSV import with column mapping | Bring a bank's spreadsheet | Actual, YNAB, Tiller (sheet), Firefly III, Lunch Money | map columns, date format | none | [V S2,S3]
35 | OFX/QFX/QIF import | Standard bank files | Actual, YNAB, GnuCash, Quicken Classic | file | none | [V S2,S3]
36 | CAMT.053 (European bank file) | EU banks | Actual | file | none | [V S3]
37 | Duplicate detection on import (can be turned off) | No double rows | Actual (option to disable), YNAB | match by date/amount | none | [V S3]
38 | PDF statement import | Parse a statement | few (Quicken?, AI tools) | extraction | AI | [K weak]
39 | Bank sync via aggregator | Auto daily import | Monarch, Copilot, Simplifi, YNAB, Tiller, Lunch Money, Rocket Money, EveryDollar(Premium), Goodbudget(Premium) | daily | BANK | [V S5,S7,S8]
40 | Pending vs posted handling, editable date | Fix mismatched dates | PocketGuard (Plus), Monarch | toggle | BANK | [V S8]
41 | Reconcile to bank balance (lock matched) | Catch missing items | YNAB (weekly advised), GnuCash (manual), Quicken Classic, Actual | cleared vs bank balance | none (user types balance) | [V S2,S12]
42 | Statement-date reconcile checklist for cards | Match card statement | GnuCash, Quicken Classic | manual | none | [K]
43 | Undo/audit trail of edits | See what changed | Firefly III, Actual | log | none | [K]

### D. Recurring bills, subscriptions, calendar
44 | Scheduled/recurring transactions | Auto-expected bills and paychecks | Actual schedules, YNAB, Lunch Money recurring items, Firefly III, GnuCash, Buckets | by day, weekday, weekend shift | none | [V S1 nav,S4]
45 | Auto-detect recurring charges | Finds subscriptions | Monarch, Rocket Money, Lunch Money suggestions, Simplifi | detection | BANK | [V S4,S6,S9]
46 | Link transactions to recurring item by rule | Matches actual to expected | Lunch Money, Actual | rule | none | [V S4]
47 | Upcoming bills list / calendar | See what hits when | Monarch, Simplifi, Rocket Money, Copilot, Lunch Money | list+calendar | BANK for auto | [V S6,S7]
48 | Subscription cancel in-app | Stops unwanted plan | Rocket Money Premium | concierge | BANK, paid | [V S9]
49 | Bill negotiation | Haggle bills for you | Rocket Money (success fee) | ~30-60% of savings (reviews) | SUCCESS | [V S9 + reviews]
50 | Bill pay from the app | Pay bills | Quicken Classic [K], others no | payments | BANK, money movement | [K]
51 | Price-hike and new-charge alerts | Spot changes | Rocket Money, Monarch | alerts | BANK | [K]
52 | Paycheck/income detection | Plans around pay | Simplifi, Copilot, Monarch (weaker) | pay schedule | BANK | [V S6]

### E. Cash flow forecast
53 | Projected balance by day (forecast) | See if you dip below zero | Simplifi, Monarch (desktop), Quicken Classic, YNAB scheduled | 30/60/90 days | BANK for live balances | [V S6,S7]
54 | Low-balance warning | Avoid overdraft | Simplifi, Rocket Money, PocketGuard | threshold | BANK | [K]
55 | Income vs expense (cash flow) report | In and out per month | YNAB, Monarch, Actual, all | chart + table | none | [V S2]
56 | Sankey/flow diagram | Visual flow of income to categories | Monarch, Actual? | chart | none | [K]
57 | Cash flow by account / by person | Who spends | Monarch, Simplifi | filter | none | [K]

### F. Reports and insights
58 | Spending by category over time | Trends | all | filters, date range | none | [V S7]
59 | Net worth over time | Assets minus debts history | YNAB, Monarch, Copilot, Rocket Money(premium), Empower (free), Buckets, Origin | graph, per account | manual or BANK | [V S2,S9,S11]
60 | Custom reports with saved filters | Own views | Actual, Lunch Money, Monarch, Firefly III | filters, group, save | none | [V S3; K]
61 | Year-in-review / annual summary | Taxes and reflection | Monarch, Copilot, Quicken | yearly | none | [K]
62 | Custom dashboard layout (widgets) | Show what matters | Simplifi, Actual, Monarch | rearrange | none | [V S7]
63 | Age of money | How long money sits before spent | YNAB | single number | none | [V search + K]
64 | Spending watchlist (vendors/categories) | Keep an eye on one thing | Simplifi (paid), Copilot | per item | BANK | [V S7]
65 | "Pace" alerts (spending vs expected by day) | Early warning | PocketGuard Plus | alert | BANK | [V S8]
66 | AI chat about your money | Ask questions | Origin, Monarch AI?, Copilot | chat | AI | [V S10; K]
67 | Peer/benchmark comparison | Compare to others | few | skip | none | [K]

### G. Goals and savings targets
68 | Savings goals with target date | Track progress to a number | Monarch, YNAB targets, Simplifi, Rocket Money, Goodbudget | amount+date | none | [V S6]
69 | Goal tied to accounts or envelopes | Money truly set aside | Monarch goals, YNAB | allocate | none | [K]
70 | Savings "piggy banks" | Named pots | Firefly III | pots | none | [K]
71 | Debt payoff plan (snowball/avalanche) | Order of payoff | PocketGuard Plus, YNAB loan planner, Monarch? | method, extra payment | none | [V S8; K]
72 | Round-up / auto-transfer savings | Automatic saving | Origin, Rocket Money (Smart Savings) | moves money | BANK, money movement | [V S9,S10]
73 | Baby Steps method guide | Step-by-step order | EveryDollar | guided | none | [V S8 K]

### H. Net worth and accounts
74 | Manual accounts (home, car, cash) | Track non-bank items | most | value over time | none | [K]
75 | Investments and holdings | Positions and return | Monarch, Copilot, Simplifi (light), Empower, Origin, Quicken Classic | holdings | BANK/FEED | [V S7,S10]
76 | Crypto balances | Coins in net worth | Lunch Money, Monarch, Copilot | wallets/exchanges | FEED | [V S4]
77 | Home value estimate | Auto valuation | Monarch (Zillow data) [K], Simplifi car value [V S7] | estimate | FEED | [V S7]
78 | Credit score view | Free score | Simplifi, Rocket Money Premium, Origin | score | FEED | [V S7,S9]
79 | Multi-currency with daily rates | Foreign accounts | Lunch Money, Actual, Firefly III, GnuCash | home-currency view | FEED for rates | [V S4]
80 | Asset allocation / fee analyzer | Fees and mix | Empower | read-only | BANK | [K]

### I. Household and sharing
81 | Invite partner (shared view) | Both see everything | Monarch, Copilot, Simplifi, YNAB (share), Goodbudget (sync devices) | roles/permissions | cloud | [V S8; K]
82 | Per-person view (mine, yours, ours) | Privacy within household | Monarch (owner tags) | filter | none | [K]
83 | Kids/allowance tracking | Teach money | Greenlight-type apps | mostly out of scope | n/a | [K]
84 | Advisor / accountant access | Share read-only | Monarch, Tiller sheet sharing, Quicken | link | cloud | [K]
85 | Offline / local-only with optional sync | Privacy | Actual (end-to-end encrypted sync), GnuCash, Buckets, Firefly III (self-host) | choose | none | [V S1 nav "Sync & Data Safety"]

### J. Alerts and automation
86 | Notifications (bill due, budget limit, large charge) | Timely nudges | Monarch, Simplifi, Rocket Money, Actual | per type toggles | BANK | [V S1 nav]
87 | Email digest (daily/weekly) | Passive check-in | Tiller daily email, Rocket Money | schedule | cloud | [V S5]
88 | Webhooks and API | Power users | Firefly III, Lunch Money, Actual API | developer | none | [V S4; K]
89 | Spreadsheet export/own your data | Leave any time | Tiller (is a sheet), Actual, GnuCash, Firefly III | CSV/JSON | none | [V S5]
90 | Reminders/to-do around money tasks | Do reconcile weekly | YNAB advice | prompt | none | [V S2]

### K. Depth and personalization (how products let you choose complexity)
91 | Experimental/advanced features toggle | Opt in to beta features | Actual (Experimental Features) | single switch | none | [V S1 nav]
92 | Switch budget type (envelope vs tracking) | Pick simpler or deeper model | Actual | per file | none | [V S1 nav]
93 | Dashboard widgets and themes | Visual choice | Actual (custom themes), Simplifi | themes | none | [V S1,S7]
94 | Free vs paid depth gating | Basic tracking free, advanced paid | PocketGuard, EveryDollar, Goodbudget, Rocket Money | tiers | n/a | [V S8,S9]
95 | Web has more controls than phone | Advanced lives on desktop | Monarch | split | n/a | [V S6]
96 | Add-on advice services | Humans on top | Origin CFP, estate documents | extra cost | ADV | [V S10]
97 | Guided setup then expert mode | Onboard simply | YNAB, Origin AI budget builder | wizard | none | [V S10 K]

## Gaps and notes for the build team
- Rows tagged ADV, TRADE, SUCCESS (49, 48 concierge, 66 chat advice, 72 money movement, 96) should be "link out" or skipped; the app never logs into banks (all BANK rows have a file/paste/manual substitute: CSV/OFX/QIF import, balance update screen).
- Strongest free, no-login precedents to copy for "complete optionality": Actual Budget (envelope or tracking switch, hold for next month, rollover choices, formula rules, many import formats, de-dup toggle, experimental switch, themes) [V S1,S3]. Lunch Money for recurring rules and multi-currency [V S4]. YNAB for reconcile and target types [V S2].
- Thin or unverified: Firefly III, GnuCash, Quicken Classic tiers, Empower, Monarch first-party feature list, Copilot first-party list, EveryDollar/Goodbudget first-party, Origin first-party. Rerun with first-party pages (support.monarch.com, help.copilot.money, support.ynab.com target docs, docs.firefly-iii.org via a different fetch tool) before treating [K] rows as facts.
- Prices intentionally not recorded as facts; reviews conflict (e.g. Monarch $99.99/yr vs other figures; Copilot/Simplifi ranges).
