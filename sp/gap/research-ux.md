# Research: how the best apps let a person choose depth (read 2026-11-13)

Method: WebSearch (standard) plus WebFetch of product pages. Many product help centers returned 403 (Monarch help), so some rows rest on the vendor marketing page or on third-party reviews; each row says which. "PK" = prior knowledge, not re-verified this session: treat as a lead, not a fact. Prices move; every price is as shown on the cited page on 2026-11-13 and must be re-checked before the app quotes it.

Legend. Tier: F free, P paid, A advisor-only. Flags: BANK = needs bank or brokerage connection; FEED = paid data feed; TRADE = trading; ADV = licensed advice. "Fit" = how it maps to this app (local-only, no bank logins, plain words).

## 1. Sources (read dates all 2026-11-13)
- S1 Monarch dashboard page https://www.monarch.com/features/dashboard (fetched)
- S2 Monarch search summary of help center (customize, mobile widgets, flex vs category) https://help.monarch.com/hc/en-us/articles/[number removed] ; https://help.monarch.com/hc/en-us/articles/[number removed]-Using-Mobile-Widgets (help pages 403 on fetch; seen via search snippets)
- S3 Monarch couples help https://help.monarch.com/hc/en-us/articles/[number removed]-Monarch-for-Couples ; Shared Views https://help.monarch.com/hc/en-us/articles/[number removed]-Shared-Views-in-Monarch (search snippets)
- S4 Monarch AI help https://help.monarch.com/hc/en-us/articles/[number removed]-About-Monarch-s-AI-Features ; https://help.monarch.com/hc/en-us/articles/[number removed]-AI-in-Monarch (search snippets)
- S5 Copilot quick start https://help.copilot.money/en/articles/11157550-quick-start-guide (fetched); pricing https://copilot.money/pricing/ (fetched)
- S6 Rocket Money cost page https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost (fetched)
- S7 Boldin comparison page https://www.boldin.com/retirement/newretirement-vs-best-retirement-planning/ (fetched); Rob Berger review https://robberger.com/?p=5431 (snippet)
- S8 ProjectionLab pricing https://projectionlab.com/pricing (fetched)
- S9 YNAB glossary https://support.ynab.com/en_us/ynab-glossary-a-guide-BJd80SORq.md (fetched); YNAB llms.txt https://www.ynab.com/llms.txt (snippet)
- S10 Quicken Simplifi vs Classic https://support.simplifi.quicken.com/en/articles/6380989 (fetched); Quicken compare https://quicken.com/compare (snippet)
- S11 Actual Budget https://actualbudget.org/docs/ (fetched, landing page only: sections Envelope Budgeting, Tracking Budget, Sync & Data Safety, Switching from Another App, Self-Hosting); feature summary via https://openalternative.co/actual and https://www.linuxlinks.com/actual-budget-fast-privacy-focused-app-manage-finances/ (snippets)
- S12 Tiller https://tiller.com/how-tiller-works/money-feeds/ ; https://help.tiller.com/en/articles/3250724-what-is-the-tiller-foundation-template (snippets)
- S13 Empower fee analyzer https://support-personalwealth.empower.com/hc/en-us/articles/[number removed] ; reviews https://www.financialsamurai.com/personal-capital-retirement-planner-review (snippets)
- S14 Kubera https://www.kubera.com/net-worth-tracker ; https://wellkeptwallet.com/kubera-review/ ; https://cryptovantage.com (snippets)
- S15 Honeydue reviews https://www.experian.com/blogs/ask-experian/honeydue-app-review/ ; https://millennialmoney.com/honeydue-review (snippets)
- S16 MaxiFi https://www.maxifi.com/why-maxifi/economics-based-planning ; https://www.maxifi.com/consumption-smoothing-economics-based-financial-planning (snippets)
- S17 Fidelity methodology https://www.fidelity.com/go/guidance/retirement-methodology ; FAQ https://www.fidelity.com/go/guidance/faqs (snippets)
- S18 Complaints roundups (secondhand, weak): https://bgr.com/2049531/best-budget-apps-replace-mint-according-users ; https://unstar.app/blog/ynab-vs-rocket-money-vs-monarch-budgeting-apps-ranked-2026 ; HN thread https://hn.svelte.technology/item/40108404 ; https://reddit.birdcat.cafe/r/mintuit (mirror)

## 2. Per product: features basic to advanced, and how depth is chosen

**Monarch (paid).** Basic: linked accounts, net worth, recent transactions, monthly review you swipe through (S1). Budget in two modes, Flex (default; Fixed, Flexible, Non-monthly buckets) or Category (every category gets a number) (S2, Motley Fool via search). Advanced: reports with saved/custom views, goals, investments, recurring, rules, AI assistant, weekly recap (S4), household sharing, advisor collaboration. Depth is chosen by: a "Customize" button to drag, reorder, hide dashboard widgets on web and phone (S1, S2); a budget-method switch; AI is optional (S4). Weakness noted: no way to hide an account from a partner; sharing is all-or-nothing (S3).

**Copilot Money (paid, Apple-centric).** Basic: accounts, spending by category, "To Review" inbox. Advanced: recurrings calendar, name rules, tags, custom category emoji and color, widgets (iOS), AI categorisation after you review 30 items (S5). Depth: the whole Budgeting feature can be switched off in Settings > Features (S5); Premium+ tier adds an AI assistant (S6-like page: copilot.money/pricing, S5). Web lacks some iOS features (reviews, unverified).

**YNAB (paid).** Basic: Plan tab, Ready to Assign, categories, Targets. Advanced: Scheduled Transactions, Tracking Accounts (non-budget), Income v Expense and Net Worth reports, Age of Money, Fresh Start, Plan Resets, Money Moves, "Wish Farm" (S9). Depth: a method with a steep learning curve; reviews say beginners churn ("too complicated") (S18). Strong glossary and "YNAB Checkup" guided onboarding (S9).

**Actual Budget (free, MIT, local-first).** Envelope budgeting, optional tracking budget, rules, schedules, custom reports, optional end-to-end encrypted sync, self-hosting, import from other apps (S11). Depth: you pick envelope vs tracking budget; bank sync is optional add-on, not required. Closest philosophical match to this app.

**Boldin (free Basic, PlannerPlus $168/yr per Boldin page; third party says $144 to $168, re-check).** Free: Chance of Success score from 1,000 simulated scenarios, financial wellness score of 12 metrics, limited AI questions, change-the-plan-and-retest (S7). Paid: unlimited AI that drafts plan updates for review, Monte Carlo what-if variables, Roth Conversion Explorer (4 strategies incl. IRMAA limit), investments detail (allocation, fees, tax types), Medicare and IRMAA costs (S7). Depth: free headline score, paid levers. Criticism: free tier is a pitch for the upgrade; Roth tool called a rough estimate (Kotlikoff/search snippets).

**ProjectionLab (free Basic $0; Premium $129/yr; Pro $549/yr, S8).** Free: forecasting, planning, Monte Carlo, historical backtesting, flexible modeling. Premium: cash-flow projections, tax optimization, withdrawal strategies, estate planning, what-if scenarios, Compare Mode, Roth conversions, ACA subsidies, downloadable reports, multiple plans, capital gains harvesting, international planning, flexible spending (S8). Pro: client management for advisors. Depth: an "Advanced" tab hides Monte Carlo, Withdrawal Strategy, Cash Flow, Compare, Notes (Rob Berger review via search, unverified).

**Quicken Simplifi (paid, web/mobile) vs Classic (paid, desktop).** Simplifi: automatic Spending Plan from recurring income and bills, recurring bill reminders, CSV import, no reconciliation, no bill pay, tracks only tax-related transactions (S10). Classic: category budgets with different amounts per month, rollover, reconciliation, bill manager, tax export, rental property (S10). Depth is chosen by buying the other product; their files do not convert.

**Rocket Money (free; Premium "pay what you think is fair" about $7 to $14; Premium+ $15; S6 via fetched page).** Free: linked accounts, spending breakdown, bill timeline, category review, credit score, alerts. Premium: real-time sync, net worth, partner sharing, unlimited budgets, goals, custom categories, tags, rules, CSV export, cancel help, watch lists, customizable dashboard, widgets, desktop. Premium+: AI assistant, bill negotiation (a success fee is reported elsewhere: 30 to 60 percent of first-year savings, unverified).

**Empower (free dashboard).** Net worth, investment accounts, free retirement planner using linked accounts, Retirement Fee Analyzer (compares fees against a benchmark; S13). Paid wealth management is separate (0.49 to 0.89 percent, sources disagree).

**Tiller (paid spreadsheet).** Daily bank feed into Google Sheets or Excel, Foundation Template (monthly and yearly budget, net worth, debt payoff), AutoCat rules, community templates (S12). Depth: it is a spreadsheet, so the person edits anything.

**Kubera (paid).** Net worth across banks, brokerage, crypto, private investments, real estate, manual accounts; "dead man's switch" that mails a portfolio list to a named beneficiary after inactivity (reported 45 days, configurable; S14).

**Honeydue (free, tips).** Couples app: link accounts, shared spending limits, bill reminders, per-transaction chat, choose what to share (S15). Reviews: basic, weak planning.

**MaxiFi (paid, about $109 to $149/yr per one review).** Consumption smoothing (keep spending level over life, not "probability of ruin"), Social Security claiming optimisation over hundreds of strategies, Roth conversion, Medicare B, life insurance need (S16). Deterministic by design.

**Fidelity Planning & Guidance (free to customers).** Retirement analysis, "what if" modelling, outside accounts via Full View or manual entry, results labelled hypothetical, recalc advised (S17).

## 3. Merged feature list (one row per feature)
Columns: # | feature in plain words | what it does for a household | products (tier) | depth | flags | sources. "Fit" notes in brackets where useful.

### A. Choosing depth (the core of the owner's request)
1. Customize-dashboard button: drag, reorder, hide cards | person decides what the first screen shows | Monarch (P), Rocket Money (P), Copilot (P, widgets) | medium | none | S1, S2, S6
2. Two budget methods behind a switch (Flex vs Category; envelope vs tracking) | simple bucketed budget by default, per-category numbers on request | Monarch (P), Actual (F) | medium | none | S2, S11
3. Budgeting can be switched off entirely | for people who only want to see spending and net worth | Copilot (P) | simple | none | S5
4. Automatic spending plan (no setup; built from recurring income and bills) vs customizable category budget | simple default, deeper in the other product | Simplifi (P) vs Classic (P) | medium | BANK | S10
5. Free headline score, paid levers (Chance of Success, then what-if variables) | one number first, controls second | Boldin (F/P) | medium | none | S7
6. "Advanced" tab holding Monte Carlo, withdrawal strategy, cash flow, compare, notes | advanced tools out of the way | ProjectionLab (F/P) | deep | none | S8, Rob Berger snippet
7. Free tier with core forecasting and Monte Carlo; paid for tax, Roth, estate | depth tied to price | ProjectionLab | deep | none | S8
8. Per-person plan switch between "simple" and "detailed" account entry (PK: Boldin, ProjectionLab "flexible modeling" let you enter one lump or itemize) | one bucket or each account | Boldin, ProjectionLab | medium | none | PK, not verified
9. Guided onboarding checklist ("Getting started guide" card) that disappears when done | tells new people what to do first | Monarch (P) | simple | none | S2 (widget list)
10. YNAB Checkup and structured learning path | teaches the method in steps | YNAB (P) | medium | none | S9
11. Blank canvas / spreadsheet: edit anything | total optionality for experts | Tiller (P), Actual (F) | deep | none (BANK for Tiller feed) | S12
12. Templates (Foundation Template, community templates) | start from a proven layout | Tiller | simple to medium | BANK feed | S12
13. Folded advanced settings with a status line | not seen in any source; PK that Boldin and Monarch use "Settings" pages for this | n/a | n/a | n/a | PK, unverified
14. Presets for assumptions (conservative, middle, optimistic returns) | pick a style instead of a number | Fidelity (market scenarios), Boldin (PK) | simple | none | S17
15. Historical backtest instead of a made-up return | runs the plan against real past years | ProjectionLab (F) | deep | none | S8

### B. Explain and teach
16. Glossary of every term in the app | defines Age of Money, Target etc. | YNAB (P) | simple | none | S9
17. "Why this number" drawer showing inputs and formula | not found as a named feature in any product reviewed this session; Fidelity and MaxiFi publish methodology documents only | Fidelity (F), MaxiFi | deep | none | S16, S17
18. Published methodology page (how projections work, limits, "hypothetical") | trust | Fidelity (F), MaxiFi (P) | deep | none | S17, S16
19. Financial wellness score broken into 12 metrics | shows which area drags the score | Boldin (F) | simple to medium | none | S7
20. Education center inside the app | short lessons | Rocket Money (F) | simple | none | S6
21. Live classes, coaching, flat-fee CFP from inside the app | human help | Boldin (paid per session) | n/a | ADV | S7
22. Plain "Chance of Success" with simulation count shown (1,000 scenarios) | makes a probability understandable | Boldin | medium | none | S7
23. Economics-based "how much can I spend each year" instead of success odds | a spending number, not a probability | MaxiFi (P) | deep | none | S16

### C. What-if, scenarios, comparison
24. Change the plan and re-test the score | live what-if | Boldin (F) | simple | none | S7
25. What-if variables you choose in Monte Carlo | pick which assumptions to stress | Boldin (P) | medium | none | S7
26. Compare Mode / side-by-side plans (up to 10 on Boldin per one source) | see two futures together | ProjectionLab (P), Boldin (P) | medium | none | S8, Boldin snippet
27. Multiple plans saved | keep "retire at 62" and "retire at 67" | ProjectionLab (P) | medium | none | S8
28. Roth Conversion Explorer with four strategies (max estate, min lifetime tax, fill tax bracket, stay under IRMAA) | when and how much to convert | Boldin (P), ProjectionLab (P), MaxiFi (P) | deep | ADV-adjacent | S7, S8, S16
29. ACA subsidy modelling | health cover cost before 65 | ProjectionLab (P) | deep | none | S8
30. Capital gains harvesting | tax planning | ProjectionLab (P) | deep | none | S8
31. Withdrawal strategies | order of accounts in retirement | ProjectionLab (P), MaxiFi | deep | none | S8, S16
32. Social Security claiming optimiser | best age for each person | MaxiFi (P) | deep | none (ADV-adjacent) | S16
33. Life-insurance need calculation | cover amount | MaxiFi (P) | medium | none | S16
34. Estate planning module | what heirs receive | ProjectionLab (P) | deep | none | S8
35. International planning | other-country residence | ProjectionLab (P) | deep | none | S8
36. Flexible spending (spend less after bad years) | guardrails | ProjectionLab (P) | deep | none | S8
37. "Ways to improve my plan" suggestions | ranked levers | Fidelity (F) | simple | none | S17 (specific levers not verified)
38. Draft plan updates from AI that you approve before they apply | AI proposes, person applies | Boldin (P) | medium | none | S7
39. Retest after delay: advice to recalc | freshness prompt | Fidelity (F) | simple | none | S17

### D. Budgeting and cash flow
40. Envelope / zero-based plan (Ready to Assign) | every dollar a job | YNAB (P), Actual (F) | medium | none (BANK optional) | S9, S11
41. Monthly rollover of envelopes | carry unspent | YNAB, Actual, Classic | medium | none | S9, S10, S11
42. Targets (savings goals, monthly funding, debt payoff) per category | goal per envelope | YNAB (P) | medium | none | S9
43. Scheduled transactions | known future bills | YNAB (P), Actual (F), Copilot recurrings | simple | none | S9, S11, S5
44. Recurring detector with calendar | finds subscriptions | Copilot, Rocket Money (F view), Simplifi, Monarch | simple | BANK | S5, S6, S10
45. Bill timeline / due-date list and reminders | avoid late fees | Rocket Money (F), Simplifi, Honeydue | simple | BANK (reminders can be manual) | S6, S10, S15
46. Payday and calendar views | cash on a calendar | Rocket Money (P) | medium | none | S6
47. Spending limits per category with alerts | warn before overspend | Honeydue, Rocket Money | simple | BANK | S6, S15
48. Tracking accounts (outside the budget) | keep investments off the budget | YNAB | medium | none | S9
49. Reconcile register to bank statement | check books | Quicken Classic, YNAB | deep | none | S9, S10
50. Fresh Start / Plan Resets | wipe the plan, keep history | YNAB | simple | none | S9
51. Income v Expense report | monthly net | YNAB, Actual | simple | none | S9, S11
52. Age of Money | how old the money you spend is | YNAB | medium | none | S9
53. Money Moves / buffer rules | guidance in the method | YNAB | medium | none | S9
54. Subscription list with cancel help | find and drop | Rocket Money (view F, cancel P) | simple | BANK; cancel is a service | S6
55. Bill negotiation for a fee | lower a bill | Rocket Money (Premium+ per page; success fee reported) | n/a | service, BANK | S6
56. Watch lists | track chosen items | Rocket Money (P) | simple | none | S6
57. Itemized Amazon charges, Venmo detail | split a bank line into items | Copilot (P) | medium | BANK | copilot.money/pricing

### E. Categorising and cleaning data
58. Rules: name or text match sets category, tag, notes | auto-organise | Actual (F), Copilot, Rocket Money, Tiller AutoCat | medium | none | S5, S11, S12
59. Split a transaction | one line, several categories | Rocket Money (P), Copilot, Tiller | medium | none | S5, S6, S12
60. Tags and notes | free labels | Rocket Money (P), Copilot | simple | none | S5, S6
61. "To Review" inbox | confirm new items in one place | Copilot | simple | BANK | S5
62. Custom categories with colour and emoji | personalise | Copilot, Rocket Money (P) | simple | none | S5, S6
63. CSV import | no bank login needed | Simplifi, Actual, YNAB (file import) | simple | none | S9, S10, S11
64. CSV export | take data out | Rocket Money (P) | simple | none | S6
65. Import from another app | switch | Actual (F), YNAB | medium | none | S11, S9
66. Exclude category from budget | keep refunds out | Copilot | simple | none | S5

### F. Net worth, accounts, investments
67. Net worth chart with manual accounts | the number people want | Kubera, Empower, Monarch, YNAB tracking | simple | none if manual; BANK if linked | S14, S13
68. Manual entry for outside accounts | no login needed | Fidelity Full View, Kubera | simple | none | S14, S17
69. Retirement fee analyzer | hidden fund fees over decades | Empower (F) | medium | BANK (linked) | S13
70. Investments tab: allocation, fund costs, tax types | portfolio mix | Boldin (P) | medium | none | S7
71. Holdings vs S&P 500 comparison | benchmark | Copilot | simple | BANK, FEED | copilot.money/pricing
72. Credit score and report monitoring | score tracking | Rocket Money, Monarch (widget) | simple | FEED | S6, S2
73. Crypto, private investments, real estate in net worth | everything in one place | Kubera (P) | medium | FEED for some | S14
74. Dead man's switch to a beneficiary | family gets the list | Kubera (P) | medium | none | S14

### G. Sharing, partner, advisor
75. Invite partner, shared view of everything | one household picture | Monarch (P), Copilot (coming), Rocket Money (P) | simple | BANK | S3, copilot pricing page
76. Choose what each partner sees | privacy inside a household | Honeydue (F) | medium | BANK | S15
77. Advisor collaboration seat | share with a planner | Monarch (P) | medium | none | PK; page redirect fetched only partly
78. Client management and advisor dashboard | advisor runs many households | ProjectionLab Pro (A) | deep | ADV | S8
79. Comment or chat on a transaction | resolve questions between partners | Honeydue | simple | BANK | S15
80. Weekly or monthly emailed recap | review without opening the app | Monarch (P), Monarch couples monthly email | simple | none | S4, S3
81. Swipeable monthly review | a ritual | Monarch (P) | simple | none | S1

### H. AI helpers and their limits
82. AI assistant answering questions about your data | Q and A | Monarch (P), Copilot Premium+ (P), Boldin (limited F, P unlimited) | medium | none | S4, S5, S7
83. AI transaction categorisation | saves typing | Monarch (cannot be turned off, per S4), Copilot after 30 reviews | simple | BANK | S4, S5
84. Assistant that "asks approval before acting" | AI proposes, you confirm | Copilot (P) | medium | none | copilot.money/pricing
85. Assistant personalities (supportive, analytical, roast) | tone choice | Copilot (P) | simple | none | copilot.money/pricing
86. AI privacy statement (not trained on, not sold) | trust | Monarch, Copilot | n/a | none | S4, copilot pricing page
87. AI optional switch | opt out of the chatbot | Monarch (P) | simple | none | S4
88. AI limited by question count on free tier | usage cap | Boldin (F) | simple | none | S7

### I. Alerts, reminders, mobile
89. Balance alerts and notifications | low-balance warning | Rocket Money (F), Copilot | simple | BANK | S6, copilot pricing page
90. Home-screen widgets | glance without opening | Monarch, Copilot (iOS), Rocket Money | simple | none | S2, S5
91. Mobile and web parity | use anywhere | Monarch, Copilot (iPhone, iPad, Mac, Web), Simplifi | simple | none | S5, S10
92. Real-time sync as a paid perk | up-to-date numbers | Rocket Money (P) | n/a | BANK | S6

### J. Privacy, data ownership, export
93. Local-first data, optional encrypted sync | data stays on your device | Actual (F) | simple | none | S11
94. Self-hosting | own server | Actual (F) | deep | none | S11
95. Open source / MIT | inspect it | Actual | n/a | none | S11
96. Spreadsheet you own | data is yours | Tiller | medium | BANK feed | S12
97. Encrypted at rest and in transit statement | trust | Copilot | n/a | none | copilot pricing page
98. Works without bank linking | what many users ask for | gap in most products (S18) | n/a | none | S18
99. Downloadable reports | printing, sharing with advisor | ProjectionLab (P) | medium | none | S8
100. Custom reports engine | build own charts | Actual (F), Monarch (P), Classic (P) | deep | none | S11, S2, S10

### K. Accessibility and language
101. Custom text size, dark mode, screen reader labels, high contrast | not documented in any source read; PK only that most apps offer dark mode | all | n/a | none | gap, unverified
102. Multi-currency | non-USD households | Actual (PK), Kubera (PK) | medium | none | PK, unverified

## 4. What users say they miss or find too complex (secondhand, weak sources)
- Too complicated at first; people who do not grasp the method in week one leave (YNAB-type) (S18 unstar.app).
- Logging that needs too many steps; people stop after two weeks (S18).
- Feature bloat: "too many bells and whistles" (r/mintuit mirror, S18); HN thread says apps fall short of needs (S18).
- Price shock vs Mint ($60 to $180 a year) (S18).
- Bank-sync reliability (S18).
- Want apps that work without bank linking, and simple tracking over full budgeting (S18).
- All-or-nothing partner visibility in Monarch (S3).
- Free planner used as a pitch for the paid tier; Roth tool a rough estimate (Boldin criticism via search snippets).
- Platform gaps: Copilot web lacks some iPhone features (review claim, unverified).
- Simplifi cannot reconcile; Classic and Simplifi files do not convert (S10).
Caveat: these are blog or mirror summaries, not direct threads. The "hundreds of one-star reviews" style numbers were not verified and are not used.

## 5. What this means for this app (short)
1. The strongest pattern: one headline number first, levers behind a clear control (Boldin free score, ProjectionLab Advanced tab, Monarch Customize). This app already does this; the gaps are named below.
2. Not found anywhere in the sources, so a chance to be first: a real "why this number" drawer on every figure; preset assumption styles with plain names; a per-page "simple / detailed" switch that never changes the plan (this matches DESIGN_LOG).
3. Features that need a bank login, a paid feed, trading or licensed advice and are out of scope here: items 44 (detection from linked data), 47, 54 cancel, 55, 57, 61, 69 (linked), 71, 72, 73 (feeds), 78 advisor dashboard, 92. Their local equivalents: manual recurring list, CSV or pasted statement import, manual balances.
4. Cheap wins to check against the catalog: partner-visibility choices per account (item 76), beneficiary or "if something happens" list (74, probably already in household/documents), weekly or monthly recap page to print (80, 81), saved comparison of plans (26, 27), fee analyzer from manual fund costs (69), consumption-smoothing spending figure (23), historical backtest (15), assumption presets (14), custom reports (100), accessibility options list (101, verify what the app has).
5. Unverified items to re-check before quoting on screen or in docs: all prices; item 8, 13, 77, 101, 102 (prior knowledge only).
