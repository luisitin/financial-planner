## 1. The numbers at a glance

954 rows: 6 households x 159 usable pages, 390x844, tip 737fb6a, plan date 2026-11-12. 9 pages are not offered in the household's menu in the sandbox (builder pages, pages that need the AI helper or the PC): they are in census.json but not in the rankings. That leaves 150 pages x 6 = 900 rows.

| household | pages over 1 screen | over 2 | over 3 | screens: half / 9 in 10 / longest | first-view load: half / 9 in 10 / top | words on first screen (half / 9 in 10) | figures on first screen (half / 9 in 10) | pages with boxes on first screen | pages with a filled button on first screen: 0 / 1 / 2+ |
|---|---|---|---|---|---|---|---|---|---|
| empty | 54 | 25 | 5 | 1 / 2.4 / 19.8 | 24.3 / 52.3 / 68 | 76 / 143 | 0 / 3 | 33 | 43 / 107 / 0 |
| family | 122 | 75 | 27 | 2 / 3.5 / 19.8 | 46.3 / 64.3 / 75.8 | 113 / 161 | 4 / 15 | 38 | 96 / 54 / 0 |
| renter | 107 | 55 | 15 | 1.8 / 3 / 19.8 | 42.8 / 58.8 / 80.3 | 102 / 158 | 2 / 13 | 37 | 88 / 62 / 0 |
| retired | 105 | 62 | 16 | 1.8 / 3.1 / 19.8 | 43.3 / 57.8 / 71.3 | 104 / 158 | 2 / 13 | 37 | 81 / 69 / 0 |
| freelancer | 80 | 40 | 11 | 1.1 / 2.8 / 19.8 | 36.8 / 57.5 / 67.3 | 87 / 147 | 0 / 11 | 33 | 65 / 82 / 3 |
| midsetup | 71 | 40 | 9 | 1 / 2.7 / 19.8 | 34.3 / 56.8 / 67 | 85 / 148 | 0 / 10 | 28 | 60 / 90 / 0 |

Optional parts found (all 900 rows): 2106 folds (1963 shut, 143 open when the page opens), 103 chip rows on 17 pages, 948 on/off switches on 1 page(s), 116 tick boxes on 20 pages, 54 done / not done buttons, 43 "+ Add ..." openers, 71 rows that open in place, 0 "show more/all" controls, 0 "go deeper/see all" links, 1 "my own" openers.

Pages with no optional part at all for any household with a plan: 73 of 150. Pages with at least one shut fold for some household: 60.

How much is optional today (the five households with a plan, 750 rows): the pages show 66506 load points without a tap and hold 56138 more behind shut folds, so 46% of what the app can show is opt-in (17% leaving out the Glossary, Help, Settings and Our guesses, which are lists of folds). Boxes: 1552 show without a tap, 707 more sit behind folds.

Looking never changed anything: across all 954 rows, opening every fold (1985 of them) and tapping 50 openers left the saved plan and the browser's storage exactly as they were (0 rows changed). 0 rows had a page error; 0 were sent to another page.

## 2. The heaviest first views (what the first 390x844 screen holds, no tap)

Ranked by the worst first view any household with a plan meets (the screenshot is of that household); `half` is the median over the five households with a plan. † = one of claude-a's 13 pages (hand-over, not ours to edit).

| # | page | worst for | load | half | words | figures | boxes | buttons filled+outlined+plain | cards | small-print lines | charts+tables | leads with | screens | shot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | debt/consolidation † (Consolidation) | renter | 80.3 | 20 | 167 | 26 | 0 | 0+0+0 | 3 | 19 | 0 | bare figure: $9,800 | 1.25 | 01-debt-consolidation--renter.png |
| 2 | cashflow/budget-percent (Budget (50/30/20)) | renter | 78.8 | 71.3 | 141 | 33 | 0 | 0+0+0 | 2 | 11 | 1 | bare figure: $2,763 | 1.98 | 02-cashflow-budget-percent--renter.png |
| 3 | career/benefits (Work benefits) | renter | 78.3 | 46.8 | 193 | 18 | 0 | 1+1+0 | 1 | 12 | 1 | none:  | 2.4 | 03-career-benefits--renter.png |
| 4 | debt/credit-cards (Credit cards) | family | 75.8 | 18.5 | 171 | 23 | 0 | 0+2+0 | 2 | 12 | 0 | figure: $6,400 on 1 card | 1.31 | 04-debt-credit-cards--family.png |
| 5 | insurance/disability (Disability) | family | 74.8 | 64.3 | 195 | 14 | 0 | 0+0+0 | 1 | 22 | 0 | bare figure: $8,450 | 2.57 | 05-insurance-disability--family.png |
| 6 | retirement/roth-conversions (Roth conversions) | family | 71 | 20.8 | 190 | 11 | 0 | 0+1+0 | 2 | 13 | 1 | words: Roth conversions | 1.56 | 06-retirement-roth-conversions--family.png |
| 7 | retirement/cash-flow (Year by year) | family | 70 | 57.5 | 126 | 19 | 2 | 0+0+0 | 3 | 11 | 1 | words: Year by year | 5.28 | 07-retirement-cash-flow--family.png |
| 8 | goals/vehicle † (Vehicle) | family | 69 | 55.5 | 144 | 18 | 0 | 0+1+0 | 3 | 22 | 0 | bare figure: $890 | 1.42 | 08-goals-vehicle--family.png |
| 9 | investments/limits (Contribution limits) | retired | 68 | 65.8 | 170 | 15 | 0 | 0+0+0 | 2 | 11 | 1 | words: 2026 contribution limits | 2.82 | 09-investments-limits--retired.png |
| 10 | overview/quick (Quick answers) | family | 67.5 | 61.5 | 186 | 9 | 0 | 0+0+0 | 1 | 22 | 0 | words: Get a quick answer | 2.71 | 10-overview-quick--family.png |
| 11 | goals/charitable † (Giving) | family | 67 | 67 | 174 | 14 | 0 | 0+0+0 | 3 | 13 | 0 | words: Giving | 2.03 | 11-goals-charitable--family.png |
| 12 | overview/alerts (Needs attention) | family | 67 | 47.5 | 180 | 9 | 0 | 0+0+0 | 2 | 22 | 0 | figure: 6 things to look at | 1.66 | 12-overview-alerts--family.png |
| 13 | taxes/capital-gains (Capital gains) | family | 66.3 | 63.5 | 145 | 19 | 0 | 0+0+0 | 3 | 13 | 0 | words: Tax on what you sell | 3 | 13-taxes-capital-gains--family.png |
| 14 | investments/risk (Risk) | family | 65.8 | 65.8 | 165 | 19 | 0 | 0+0+0 | 2 | 7 | 0 | figure: A bad year could take about $22,7… | 2.54 | 14-investments-risk--family.png |
| 15 | retirement/withdrawal-strategy (How much to take out) | family | 65.8 | 45.8 | 183 | 9 | 0 | 0+1+0 | 2 | 10 | 1 | words: How much to take out each year | 1.91 | 15-retirement-withdrawal-strategy--family.png |
| 16 | taxes/estimated (Estimated payments) | family | 64.3 | 56.5 | 177 | 14 | 0 | 1+0+0 | 1 | 8 | 0 | figure: Raise your withholding: about $3,… | 3.19 | 16-taxes-estimated--family.png |
| 17 | retirement/sequence-risk (Order of returns) | family | 64.3 | 55.8 | 161 | 13 | 0 | 0+0+0 | 2 | 12 | 1 | words: Why the order of returns matters | 1.16 | 17-retirement-sequence-risk--family.png |
| 18 | balance/liabilities (Debts) | family | 64.3 | 18.5 | 123 | 20 | 0 | 1+0+0 | 2 | 21 | 0 | bare figure: $285,600 | 1.42 | 18-balance-liabilities--family.png |
| 19 | taxes/federal (Federal estimate) | retired | 64 | 61 | 162 | 15 | 0 | 1+0+0 | 2 | 11 | 0 | figure: About $1,839 of federal tax for 2… | 3.15 | 19-taxes-federal--retired.png |
| 20 | goals/prioritizer (Goal prioritizer) | family | 63.8 | 14 | 131 | 15 | 0 | 1+1+0 | 2 | 24 | 0 | bare figure: $4,834 | 1.43 | 20-goals-prioritizer--family.png |
| 21 | retirement/medicare (Medicare and IRMAA) | renter | 63.5 | 57.5 | 180 | 9 | 0 | 0+0+0 | 2 | 15 | 0 | figure: Medicare at 65 | 3.4 | 21-retirement-medicare--renter.png |
| 22 | goals/house (House down payment) | family | 63 | 62 | 140 | 16 | 0 | 0+0+0 | 3 | 18 | 0 | words: Saving for a home | 3.15 | 22-goals-house--family.png |
| 23 | insurance/life-needs (Life insurance needs) | retired | 62 | 30.5 | 188 | 5 | 0 | 0+1+0 | 3 | 12 | 0 | words: Your family is covered | 1.41 | 23-insurance-life-needs--retired.png |
| 24 | taxes/withholding (Withholding check) | family | 61.8 | 46.8 | 165 | 11 | 0 | 1+1+0 | 2 | 11 | 0 | figure: You would likely owe about $5,253… | 2.61 | 24-taxes-withholding--family.png |
| 25 | debt/payoff (Pay off debts) | renter | 61.8 | 15.3 | 117 | 14 | 2 | 1+0+0 | 3 | 13 | 0 | words: Debt-free by July 2030 | 1.95 | 25-debt-payoff--renter.png |
| 26 | overview/guide (Step by step) | family | 60.8 | 56.3 | 189 | 0 | 0 | 0+0+0 | 1 | 25 | 0 | words: Step-by-step guides | 1.84 | 26-overview-guide--family.png |
| 27 | career/human-capital (Human capital) | family | 60.8 | 52.5 | 127 | 12 | 0 | 0+0+0 | 3 | 14 | 2 | bare figure: 95% | 2.06 | 27-career-human-capital--family.png |
| 28 | property/renovation (Renovation) | family | 59.8 | 57.5 | 157 | 11 | 0 | 0+0+0 | 3 | 13 | 0 | words: A home project | 2.71 | 28-property-renovation--family.png |
| 29 | retirement/social-security (Social Security) | family | 59.5 | 56.8 | 146 | 13 | 0 | 0+0+0 | 2 | 10 | 1 | figure: $66,600 a year from Social Securi… | 2.37 | 29-retirement-social-security--family.png |
| 30 | cashflow/paycheck (Paycheck) | family | 59.5 | 47.3 | 130 | 15 | 0 | 0+0+0 | 1 | 22 | 0 | bare figure: $2,888 | 2.77 | 30-cashflow-paycheck--family.png |
| 31 | goals/education (Education (529)) | midsetup | 59.5 | 22.3 | 134 | 16 | 0 | 0+1+0 | 3 | 12 | 0 | bare figure: $168,990 | 1.91 | 31-goals-education--midsetup.png |
| 32 | estate/estate-tax (Estate tax) | family | 58.8 | 44.5 | 173 | 10 | 0 | 0+0+0 | 3 | 5 | 0 | bare figure: $287,100 | 1.61 | 32-estate-estate-tax--family.png |
| 33 | overview/next-best-action (Next best action) | renter | 58.8 | 43.8 | 145 | 12 | 0 | 1+0+0 | 2 | 15 | 0 | words: A starter emergency fund | 3.17 | 33-overview-next-best-action--renter.png |
| 34 | taxes/self-employment † (Self-employment) | family | 58.8 | 19.3 | 137 | 13 | 0 | 0+2+0 | 2 | 15 | 0 | bare figure: $2,225 | 1.55 | 34-taxes-self-employment--family.png |
| 35 | reports/tax (Tax report) | retired | 58.3 | 57.3 | 137 | 19 | 0 | 1+0+0 | 0 | 2 | 1 | bare words: Tax report, 2026 | 3.06 | 35-reports-tax--retired.png |
| 36 | taxes/brackets (Bracket explorer) | freelancer | 58.3 | 53.5 | 113 | 18 | 0 | 0+0+0 | 3 | 13 | 0 | figure: You are in the 12% bracket | 2.68 | 36-taxes-brackets--freelancer.png |
| 37 | cashflow/income (Income) | family | 58 | 28.3 | 102 | 17 | 0 | 0+0+0 | 3 | 25 | 0 | bare figure: $14,250 | 1.28 | 37-cashflow-income--family.png |
| 38 | investments/backtest (Backtest) | family | 57.8 | 57.8 | 143 | 13 | 0 | 0+0+0 | 2 | 4 | 0 | figure: $10,000 in 1928 became $39,896,57… | 2.88 | 38-investments-backtest--family.png |
| 39 | property/purchase (Big purchase planner) | family | 57.8 | 57.5 | 147 | 11 | 0 | 0+0+0 | 3 | 14 | 0 | words: A big purchase | 2.29 | 39-property-purchase--family.png |
| 40 | property/rent-vs-buy (Rent vs buy) | family | 57.5 | 57.5 | 142 | 9 | 0 | 0+0+0 | 3 | 12 | 1 | words: Rent or buy? | 3.86 | 40-property-rent-vs-buy--family.png |

## 3. The heaviest pages (the whole page as it opens, every scroll, no tap)

`behind folds` is the load that shows only after opening every fold; `optional share` = behind folds / (shown + behind folds). A long page with a low share has nothing a person can leave shut.

| # | page | worst for | screens | load | half | words | figures | boxes | buttons | cards | rows in lists/tables | folds shut/open | behind folds | optional share | screens with all open |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | overview/pages (All pages) | family | 19.84 | 1198.8 | 1198.8 | 3713 | 4 | 1 | 0 | 19 | 0 | 0/0 | 0 | 0% | 19.84 |
| 2 | taxes/projection (Tax, year by year) | retired | 5.56 | 516.5 | 407.5 | 834 | 244 | 1 | 0 | 4 | 29 | 0/0 | 0 | 0% | 5.56 |
| 3 | retirement/cash-flow (Year by year) | family | 5.28 | 516.5 | 57.5 | 920 | 212 | 2 | 0 | 3 | 31 | 0/0 | 0 | 0% | 5.28 |
| 4 | overview/timeline (Life timeline) | family | 8.27 | 380.3 | 144.8 | 1003 | 32 | 0 | 0 | 3 | 0 | 0/0 | 0 | 0% | 8.27 |
| 5 | scenarios/stress-tests (Stress tests) | renter | 7.64 | 316.5 | 52.5 | 806 | 29 | 0 | 10 | 4 | 10 | 1/10 | 60.5 | 16% | 8.74 |
| 6 | retirement/medicare (Medicare and IRMAA) | family | 3.82 | 279.5 | 249.3 | 632 | 61 | 0 | 2 | 7 | 0 | 1/0 | 30.3 | 10% | 4.24 |
| 7 | overview/next-best-action (Next best action) | family | 3.79 | 262.3 | 108.8 | 677 | 37 | 0 | 1 | 4 | 0 | 1/0 | 39 | 13% | 4.44 |
| 8 | reports/plan-summary (Plan summary) | renter | 5.32 | 257.5 | 181.5 | 744 | 41 | 0 | 1 | 0 | 26 | 0/0 | 0 | 0% | 5.32 |
| 9 | reports/retirement (Retirement report) | family | 4.27 | 255.5 | 186.5 | 532 | 74 | 0 | 1 | 0 | 11 | 0/0 | 0 | 0% | 4.27 |
| 10 | career/business (Small business) | freelancer | 4.16 | 254.3 | 77 | 567 | 34 | 6 | 5 | 9 | 3 | 2/1 | 48.2 | 16% | 4.97 |
| 11 | property/rent-vs-buy (Rent vs buy) | family | 3.86 | 204 | 204 | 340 | 20 | 17 | 3 | 6 | 0 | 0/1 | 0 | 0% | 3.86 |
| 12 | taxes/federal (Federal estimate) | family | 3.27 | 203 | 183.8 | 480 | 45 | 0 | 1 | 7 | 14 | 3/0 | 177.5 | 47% | 6.14 |
| 13 | investments/risk (Risk) | family | 2.54 | 202 | 202 | 452 | 61 | 0 | 0 | 4 | 9 | 0/0 | 0 | 0% | 2.54 |
| 14 | career/benefits (Work benefits) | family | 3.31 | 197 | 137 | 496 | 31 | 0 | 5 | 11 | 3 | 6/0 | 151 | 43% | 5.95 |
| 15 | retirement/projection (Will the money last?) | family | 3.3 | 196 | 33.8 | 490 | 30 | 0 | 4 | 5 | 8 | 1/0 | 69.5 | 26% | 4.37 |
| 16 | taxes/capital-gains (Capital gains) | renter | 3.03 | 194.8 | 194.8 | 415 | 36 | 6 | 1 | 5 | 4 | 0/0 | 0 | 0% | 3.03 |
| 17 | debt/mortgage (Mortgage) | family | 3.3 | 194 | 17.8 | 356 | 66 | 2 | 1 | 5 | 0 | 0/0 | 0 | 0% | 3.3 |
| 18 | career/salary (Salary and raises) | family | 3.57 | 193.5 | 139.8 | 440 | 37 | 0 | 3 | 7 | 0 | 5/0 | 236.5 | 55% | 6.55 |
| 19 | taxes/estimated (Estimated payments) | family | 3.19 | 192.8 | 163 | 431 | 30 | 6 | 3 | 4 | 4 | 0/1 | 0 | 0% | 3.19 |
| 20 | balance/statement † (Balance sheet) | family | 2.99 | 191.3 | 122.3 | 419 | 54 | 0 | 1 | 0 | 0 | 0/0 | 0 | 0% | 2.99 |
| 21 | ai/glossary (Glossary) | family | 13.9 | 191 | 184.8 | 650 | 0 | 1 | 0 | 1 | 0 | 221/0 | 5880.8 | 97% | 100.57 |
| 22 | reports/tax (Tax report) | family | 3.2 | 189.5 | 162.5 | 404 | 72 | 0 | 1 | 0 | 20 | 0/0 | 0 | 0% | 3.2 |
| 23 | overview/health-score (Plan health score) | renter | 2.92 | 180.5 | 131 | 494 | 17 | 0 | 0 | 4 | 0 | 1/0 | 47.8 | 21% | 3.68 |
| 24 | career/offer-compare (Job offer compare) | family | 3.43 | 179.5 | 178.8 | 332 | 5 | 18 | 4 | 6 | 0 | 3/0 | 169 | 48% | 6.05 |
| 25 | investments/limits (Contribution limits) | retired | 2.82 | 178.8 | 139 | 437 | 32 | 0 | 2 | 5 | 11 | 0/0 | 0 | 0% | 2.82 |
| 26 | goals/house (House down payment) | renter | 3.27 | 177.5 | 177 | 312 | 25 | 12 | 4 | 6 | 0 | 0/1 | 0 | 0% | 3.27 |
| 27 | retirement/withdrawal-order (Withdrawal order) | retired | 2.71 | 177.5 | 151.5 | 502 | 19 | 0 | 4 | 3 | 8 | 0/0 | 0 | 0% | 2.71 |
| 28 | overview/plan (Your plan) | family | 3.29 | 176.8 | 110.8 | 479 | 23 | 0 | 3 | 8 | 0 | 1/0 | 24.5 | 12% | 3.69 |
| 29 | insurance/disability (Disability) | family | 2.57 | 174.3 | 68.8 | 449 | 30 | 0 | 4 | 3 | 0 | 0/0 | 0 | 0% | 2.57 |
| 30 | taxes/hsa-fsa (HSA and FSA) | family | 2.84 | 169.8 | 150.5 | 429 | 7 | 7 | 1 | 4 | 4 | 0/1 | 0 | 0% | 2.84 |
| 31 | property/renovation (Renovation) | family | 2.71 | 168 | 120.8 | 396 | 31 | 3 | 3 | 7 | 0 | 1/1 | 36.8 | 18% | 3.45 |
| 32 | scenarios/goal-seek (Goal seek) | family | 3.24 | 168 | 22.5 | 398 | 23 | 1 | 7 | 10 | 0 | 1/0 | 59 | 26% | 4.24 |
| 33 | property/home (Home) | family | 3.11 | 167.5 | 17.3 | 312 | 26 | 10 | 3 | 7 | 3 | 1/1 | 13 | 7% | 3.32 |
| 34 | overview/quick (Quick answers) | family | 2.71 | 165.8 | 148.8 | 489 | 12 | 0 | 1 | 3 | 0 | 0/0 | 0 | 0% | 2.71 |
| 35 | taxes/brackets (Bracket explorer) | family | 2.7 | 161.3 | 154.8 | 273 | 60 | 1 | 0 | 4 | 11 | 0/0 | 0 | 0% | 2.7 |
| 36 | cashflow/paycheck (Paycheck) | family | 2.77 | 159.5 | 83.3 | 362 | 30 | 0 | 5 | 5 | 0 | 2/0 | 248 | 61% | 6.7 |
| 37 | taxes/withholding (Withholding check) | family | 2.61 | 157 | 118.3 | 390 | 14 | 4 | 3 | 4 | 3 | 0/1 | 0 | 0% | 2.61 |
| 38 | career/side-income (Side income) | freelancer | 3.07 | 154.5 | 24 | 306 | 8 | 12 | 5 | 5 | 0 | 1/1 | 50.8 | 25% | 3.71 |
| 39 | reports/statements (Financial statements) | family | 3.47 | 150.8 | 126.5 | 325 | 52 | 0 | 1 | 0 | 55 | 0/0 | 0 | 0% | 3.47 |
| 40 | property/rental (Rental analysis) | family | 2.91 | 150.5 | 129 | 230 | 0 | 21 | 1 | 2 | 0 | 0/1 | 0 | 0% | 2.91 |

## 4. The lightest good examples (simple first, detail on request, already)

A row qualifies when a household with a plan gets ALL of: an answer drawn from the plan in the big first line; at most one filled button and no box on the first screen; a first-screen load of 50 or less; the page as it opens no longer than 2.2 screens; and real depth one tap away (15 or more load points behind shut folds, a chip row, or an opener). One line per page: the household with the most behind the folds.

| page | household | first-view load | screens (all open) | leads with | filled on first screen | words / figures on first screen | one tap away | load behind folds | households that qualify |
|---|---|---|---|---|---|---|---|---|---|
| cashflow/expenses (Expenses) | renter | 22.8 | 1 (2.12) | $2,710 | 0 | 53 / 5 | fold "Set your month in one number" [leftover or spending]; fold "See or change each bill" [7 bills] | 103.5 | renter |
| cashflow/income (Income) | renter | 28.3 | 1 (1) | $3,250 | 0 | 55 / 6 | "+ Add another income" | 0 | renter, retired, freelancer, midsetup |
| scenarios/stress-tests (Stress tests) | retired | 32.8 | 1.76 (10.19) | Your plan survives all 10 shocks | 0 | 107 / 1 | fold "📉 A crash like 2008 Lasts"; fold "🕳️ A lost decade like the 2000s …"; fold "🔥 The 1970s: prices up, markets …"; fold "🏚️ 1929 and the Depression Lasts"; fold "🧊 Stocks and bonds fall toget… | 379.8 | retired |
| taxes/hsa-fsa (HSA and FSA) | retired | 33.5 | 1 (2.07) | Once you're on Medicare you can't add to an HSA | 0 | 88 / 2 | fold "Change what you typed" [not set] | 66.8 | retired |
| retirement/projection (Will the money last?) | renter | 33.8 | 1 (3.16) | We don't know yet | 1 | 103 / 1 | fold "What goes into this"; fold "Retirement settings" [$2,040 a month] | 154 | renter |
| goals/goals (Goals) | renter | 34.3 | 1 (1) | $1,000 | 0 | 83 / 5 | "+ Add another goal" | 0 | renter |
| estate/estate-tax (Estate tax) | freelancer | 35.5 | 1 (1.21) | $17,500 | 0 | 86 / 5 | fold "How the tax is worked out" | 32.5 | freelancer |
| estate/beneficiaries (Beneficiary audit) | family | 38 | 1.25 (1.25) | 0 of 6 | 0 | 90 / 8 |  | 0 | family, renter, retired, freelancer |
| overview/monthly-review (Monthly check-in) | family | 39.3 | 1.97 (1.97) | The October 2026 check-in | 1 | 113 / 1 | chips: November 2026 / October 2026 | 0 | family, renter, retired, freelancer |
| balance/net-worth (Net worth) | renter | 45.8 | 2.09 (2.09) | -$10,800 | 0 | 71 / 8 | "+ Add another account" | 0 | renter, retired, freelancer |
| taxes/state † (State) | retired | 46 | 1.25 (2.9) | $760 | 0 | 114 / 9 | fold "The same income in other states" [$760 less with no incom…]; fold "Your figures" [flat rate] | 85.5 | retired, freelancer |
| cashflow/paycheck (Paycheck) | renter | 47.3 | 1.87 (3.86) | $1,275 | 0 | 113 / 9 | fold "Riley: W-4 and deductions" [from the plan] | 126.3 | renter |
| retirement/fire (Financial independence) | family | 47.5 | 1.04 (2.72) | Ana would need to work until 67 | 1 | 142 / 4 | fold "The 25-times rule, a quick check" [for comparison] | 124 | family, renter |
| retirement/contributions (Retirement contributions) | freelancer | 48.8 | 1.17 (1.17) | $3,000 a year into retirement accounts | 0 | 103 / 9 | "+ Add another contribution" | 0 | freelancer |

14 of 150 pages qualify for at least one household with a plan; 4 qualify for three or more.

## 5. Boxes with no way to leave them shut

A 390x844 screen holds about 9 labelled boxes (label 20 px + box 44 px + gap 17 px, under the 56 px top bar). `optional parts` counts shut folds, chip rows, on/off switches and "+ Add" / "show more" openers on the page.

### 5a. Zero optional parts and 6 or more boxes showing (9+ is more than a screen of boxes)

| page | boxes showing (most) | households | must-fill boxes | already filled | forms (boxes each) | screens | the boxes |
|---|---|---|---|---|---|---|---|
| property/rental (Rental analysis) | 21 | family 21, retired 21, empty 20, renter 20, freelancer 20, midsetup 20 | 1 | 4 | 21 | 2.91 | Name · What it is worth today$ · Its value on Net worth · What you paid$ · When it was first rented out · Rent a month$ · Allowance for empty months … |
| property/rent-vs-buy (Rent vs buy) | 17 | empty 17, family 17, renter 17, retired 17, freelancer 17, midsetup 17 | 0 | 16 | 17 | 3.86 | Home price$ · Down payment · Mortgage rate a year · Mortgage length (years) · Property tax a year, share of value · Home insurance a year, share of v… |
| scenarios/advisor-plan (Advisor's plan) | 16 | family 16, retired 16, renter 14 | 0 | 0 | 16 | 2.98 | Advisor or firm · Date of the plan · Ana: retire at age · Bo: retire at age · Ana: start Social Security at · Bo: start Social Security at · Spend in… |
| goals/house (House down payment) | 12 | empty 12, family 12, renter 12, retired 12, freelancer 12, midsetup 12 | 0 | 9 | 12 | 2.96 | Home price$ · Down payment · Closing costs, share of price · Mortgage rate a year · Mortgage length (years) · Property tax a year, share of value · H… |
| insurance/policies (Policies) | 11 | empty 11, family 11, renter 11, retired 11, freelancer 11, midsetup 11 | 1 | 0 | 11 | 2.14 | What is it · Kind of policy · Who it covers · Insurer · What it pays$ · Premium$ · How often · Ends · Renews · Cash value$ · Through an employer (end… |
| balance/update (Update my balances) | 10 | family 10, renter 8, retired 6 | 0 | 10 | 10 | 2.13 | House: balance · Ana's 401(k): balance · Bo's old 401(k): balance · Bo's Roth IRA: balance · Brokerage: balance · Ally savings: balance · Chase check… |
| property/vehicles (Vehicles) | 10 | empty 10, family 10, retired 10, freelancer 10, midsetup 10 | 1 | 7 | 10 | 1.67 | Which car · What it is worth today$ · Miles a year · Miles per gallon · Fuel price a gallon$ · Insurance a year$ · Upkeep and repairs a year$ · Regis… |
| cashflow/income (Income) | 8 | empty 8 | 2 | 0 | 8 | 1.65 | What is it · Kind of income · Whose · Amount$ · How often · Yearly raise · Starts · Ends · Income tax applies to it |
| goals/vehicle † (Vehicle) | 8 | empty 8, renter 8, retired 8, freelancer 8, midsetup 8 | 0 | 4 | 8 | 2.52 | Price$ · Sales tax and fees · Trade-in or sale of the old car$ · Buy by · Loan rate a year · Loan length (months) · Saved so far$ · Saved toward it a… |
| insurance/health (Health plan compare) | 8 | empty 8, family 8, renter 8, retired 8, freelancer 8, midsetup 8 | 4 | 1 | 2, 6 | 2.31 | Coverage for · Medical bills in a usual year$ · Plan name · Your premium a month$ · Deductible a year$ · Your share after the deductible · Out-of-poc… |
| property/purchase (Big purchase planner) | 8 | empty 8, family 8, renter 8, retired 8, freelancer 8, midsetup 8 | 1 | 5 | 8 | 2.29 | What it is · Price$ · Sales tax · When you want it · Already set aside for it$ · The payment plan's rate · Payment plan length (months) · Months at 0… |
| retirement/pensions (Pensions) | 8 | empty 8, family 8, renter 8, retired 8, freelancer 8, midsetup 8 | 2 | 1 | 8 | 1.91 | Pension · Whose · Monthly amount$ · Starts at age · Rises with prices each year (a cost-of-l · Stops at age (optional) · Lump sum offered instead (op… |
| household/people (People) | 7 | empty 7 | 1 | 0 | 5 | 1.57 | Name · Who is this · Birth date · Retirement age · Plan to age |
| insurance/term-vs-permanent (Term vs permanent) | 7 | empty 7, family 7, renter 7, retired 7, freelancer 7, midsetup 7 | 4 | 1 | 7 | 2.02 | Death benefit$ · Whole-life premium a year$ · Term premium a year for the same coverag · Length of the term (years) · Illustrated cash value at the e… |
| investments/allocation (Allocation) | 7 | empty 7, family 7, renter 7, retired 7, freelancer 7, midsetup 7 | 0 | 1 | 7 | 1.7 | US stocks · International stocks · Bonds · Cash · Real estate (REITs) · Other (gold, commodities, crypto) · How far a kind of investment can drift |
| taxes/hsa-fsa (HSA and FSA) | 7 | family 7 | 0 | 0 | 7 | 2.84 | Health plan for the HSA · Who the plan covers · You put in this year$ · Employer puts in$ · Ana's FSA election this year$ · Bo's FSA election this ye… |
| balance/net-worth (Net worth) | 6 | empty 6, midsetup 6 | 2 | 1 | 6 | 1.3 | Account name · Type · Bank or firm · Current balance$ · Balance as of · Whose account |
| cashflow/expenses (Expenses) | 6 | empty 6 | 2 | 0 | 6 | 1.45 | What is it · Category · Amount$ · How often · I must pay this (not optional) · Goes up with prices over the years · Starts · Ends |
| estate/gifting (Gifting) | 6 | empty 6, family 6, renter 6, retired 6, freelancer 6, midsetup 6 | 2 | 1 | 6 | 1.67 | To whom · Amount$ · Year · From · What · 529 only: spread it over 5 years (front- · Notes |
| investments/crypto (Crypto) | 6 | empty 6, family 6, renter 6, retired 6, freelancer 6, midsetup 6 | 2 | 0 | 6 | 1.34 | Coin · Its symbol, if another · How many coins · Price of one coin today$ · What you paid for them, in all$ · When you bought them |
| retirement/annuities (Annuities) | 6 | family 6, renter 6, retired 6 | 3 | 1 | 6 | 1.94 | Quote · Insurer · On whose life · You pay$ · It pays a month$ · From age · Keeps paying while either of us lives (j · Rises with prices each year |
| taxes/estimated (Estimated payments) | 6 | family 6, renter 6, retired 6, freelancer 6, midsetup 6 | 0 | 0 | 4, 2 | 3.19 | 1st quarter (due 4/15/2026)$ · 2nd quarter (due 6/15/2026)$ · 3rd quarter (due 9/15/2026)$ · 4th quarter (due 1/15/2027)$ · Last year's total tax$ · … |

### 5b. The most boxes showing without a tap, any page (whole page as it opens)

| page | boxes showing (most) | for | on first screen | must-fill | already filled | more boxes behind folds | optional parts (shut folds / chips / openers) | forms open (boxes each) |
|---|---|---|---|---|---|---|---|---|
| property/rental (Rental analysis) | 21 | family | 5 | 1 | 4 | 0 | 0 / 0 / 0 | 21 |
| career/offer-compare (Job offer compare) | 18 | empty | 4 | 1 | 0 | 15 | 2 / 0 / 0 | 18 |
| property/rent-vs-buy (Rent vs buy) | 17 | empty | 0 | 0 | 16 | 0 | 0 / 0 / 0 | 17 |
| scenarios/advisor-plan (Advisor's plan) | 16 | family | 4 | 0 | 0 | 0 | 0 / 0 / 0 | 16 |
| goals/house (House down payment) | 12 | empty | 0 | 0 | 9 | 0 | 0 / 0 / 0 | 12 |
| career/equity (Equity compensation) | 12 | family | 3 | 2 | 3 | 7 | 1 / 0 / 0 | 3, 9 |
| career/side-income (Side income) | 12 | family | 3 | 0 | 0 | 0 | 1 / 0 / 0 | 12 |
| insurance/policies (Policies) | 11 | empty | 5 | 1 | 0 | 0 | 0 / 0 / 0 | 11 |
| system/assumptions (Assumptions) | 10 | empty | 2 | 0 | 10 | 0 | 1 / 0 / 0 | 10 |
| balance/assets (Asset register) | 10 | family | 0 | 1 | 1 | 0 | 1 / 0 / 0 | 10 |
| property/vehicles (Vehicles) | 10 | empty | 5 | 1 | 7 | 0 | 0 / 0 / 0 | 10 |
| balance/update (Update my balances) | 10 | family | 4 | 0 | 10 | 0 | 0 / 0 / 0 | 10 |
| property/home (Home) | 10 | family | 0 | 0 | 3 | 1 | 1 / 0 / 0 | 10 |
| investments/holdings (Holdings) | 9 | family | 6 | 3 | 0 | 1 | 1 / 0 / 0 | 9 |
| goals/travel † (Travel and events) | 9 | empty | 5 | 1 | 2 | 0 | 0 / 1 / 0 | 9 |
| goals/vehicle † (Vehicle) | 8 | empty | 0 | 0 | 4 | 0 | 0 / 0 / 0 | 8 |
| insurance/health (Health plan compare) | 8 | empty | 2 | 4 | 1 | 0 | 0 / 0 / 0 | 2, 6 |
| property/purchase (Big purchase planner) | 8 | empty | 0 | 1 | 5 | 0 | 0 / 0 / 0 | 8 |
| retirement/pensions (Pensions) | 8 | empty | 4 | 2 | 1 | 0 | 0 / 0 / 0 | 8 |
| cashflow/income (Income) | 8 | empty | 5 | 2 | 0 | 0 | 0 / 0 / 0 | 8 |
| taxes/hsa-fsa (HSA and FSA) | 7 | family | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 7 |
| insurance/term-vs-permanent (Term vs permanent) | 7 | empty | 3 | 4 | 1 | 0 | 0 / 0 / 0 | 7 |
| household/calendar (Money calendar) | 7 | family | 2 | 2 | 1 | 0 | 1 / 1 / 0 | 2, 5 |
| investments/allocation (Allocation) | 7 | empty | 3 | 0 | 1 | 0 | 0 / 0 / 0 | 7 |
| household/people (People) | 7 | empty | 5 | 1 | 0 | 0 | 0 / 0 / 0 | 5 |
| taxes/capital-gains (Capital gains) | 6 | family | 0 | 3 | 1 | 0 | 0 / 1 / 0 | 4 |
| taxes/estimated (Estimated payments) | 6 | family | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 4, 2 |
| cashflow/expenses (Expenses) | 6 | empty | 4 | 2 | 0 | 0 | 0 / 0 / 0 | 6 |
| balance/net-worth (Net worth) | 6 | empty | 6 | 2 | 1 | 0 | 0 / 0 / 0 | 6 |
| retirement/annuities (Annuities) | 6 | family | 5 | 3 | 1 | 0 | 0 / 0 / 0 | 6 |
| career/business (Small business) | 6 | empty | 4 | 0 | 0 | 4 | 1 / 0 / 0 | 6 |
| estate/gifting (Gifting) | 6 | empty | 4 | 2 | 1 | 0 | 0 / 0 / 0 | 6 |
| investments/crypto (Crypto) | 6 | empty | 5 | 2 | 0 | 0 | 0 / 0 / 0 | 6 |

### 5c. Boxes on the first screen for a household that already has data (4 or more)

| page | boxes on first screen | households | leads with | first form's button |
|---|---|---|---|---|
| balance/net-worth (Net worth) | 6 | midsetup 6 | Net worth | Add account |
| investments/holdings (Holdings) | 6 | family 6, renter 6, retired 6, freelancer 6 | What you hold | Add holding |
| estate/inheritance (Expected inheritance) | 5 | family 5, renter 5, retired 5, freelancer 5, midsetup 5 | An inheritance you might receive | Add |
| goals/travel † (Travel and events) | 5 | family 5, renter 5, retired 5, freelancer 5, midsetup 5 | Trips and big days | Add |
| insurance/policies (Policies) | 5 | family 5, renter 5, retired 5, freelancer 5, midsetup 5 | What protects you? | Add policy |
| investments/crypto (Crypto) | 5 | family 5, renter 5, retired 5, freelancer 5, midsetup 5 | Crypto | Add coin |
| property/rental (Rental analysis) | 5 | family 5, renter 5, retired 5, freelancer 5, midsetup 5 | Rental property | Add rental |
| property/vehicles (Vehicles) | 5 | family 5, retired 5, freelancer 5, midsetup 5 | What your cars cost | Add car |
| retirement/annuities (Annuities) | 5 | family 5, renter 5, retired 5 | An income for life | Add quote |
| retirement/contributions (Retirement contributions) | 5 | retired 5 | Retirement contributions | Add contribution |
| transactions/rules (Rules) | 5 | family 5, renter 5, retired 5, freelancer 5, midsetup 5 | Rules | Add rule |
| balance/update (Update my balances) | 4 | family 4, renter 4, retired 4 | Update my balances | Save all balances |
| career/business (Small business) | 4 | renter 4, retired 4, midsetup 4 | Your small business | Save |
| career/offer-compare (Job offer compare) | 4 | retired 4, freelancer 4 | Compare a job offer | Add the offer |
| debt/refinance (Refinance) | 4 | family 4 | Refinance | Compare |
| estate/gifting (Gifting) | 4 | family 4, renter 4, retired 4, freelancer 4, midsetup 4 | Giving while you are alive | Add gift |
| estate/legacy (Legacy goals) | 4 | family 4, renter 4, retired 4, freelancer 4, midsetup 4 | What you want to leave | Add |
| retirement/pensions (Pensions) | 4 | family 4, renter 4, freelancer 4, midsetup 4 | A pension | Add pension |
| scenarios/advisor-plan (Advisor's plan) | 4 | family 4, renter 4, retired 4 | Check an advisor's plan | Compare |

### 5d. Open forms on a page that already has data: how much of each form is must-fill

| page | form (its button) | boxes | must-fill | already filled | help lines | px tall | households | labels |
|---|---|---|---|---|---|---|---|---|
| property/rental | Add rental | 21 | 1 | 4 | 5 | 1923 | family, renter, retired, freelancer, midsetup | Name · What it is worth today$ · Its value on Net worth · What you paid$ · When it was first rented out · Rent a month$ · Allowan… |
| career/offer-compare | Add the offer | 18 | 1 | 0 | 12 | 1883 | family, renter, retired, freelancer, midsetup | Who is offering · Salary a year$ · Bonus a year (what you expect)$ · Sign-on bonus (once)$ · Stock a year$ · Retirement match: fo… |
| property/rent-vs-buy | Compare | 17 | 0 | 16 | 7 | 1693 | family, renter, retired, freelancer, midsetup | Home price$ · Down payment · Mortgage rate a year · Mortgage length (years) · Property tax a year, share of value · Home insuranc… |
| scenarios/advisor-plan | Compare | 16 | 0 | 0 | 12 | 1693 | family, renter, retired | Advisor or firm · Date of the plan · Ana: retire at age · Bo: retire at age · Ana: start Social Security at · Bo: start Social Se… |
| career/side-income | Save the months | 12 | 0 | 0 | 0 | 1010 | family, freelancer | November 2025$ · December 2025$ · January 2026$ · February 2026$ · March 2026$ · April 2026$ · May 2026$ · June 2026$ · July 2026… |
| goals/house | Work it out | 12 | 0 | 9 | 4 | 1103 | family, renter, retired, freelancer, midsetup | Home price$ · Down payment · Closing costs, share of price · Mortgage rate a year · Mortgage length (years) · Property tax a year… |
| insurance/policies | Add policy | 11 | 1 | 0 | 6 | 1253 | family, renter, retired, freelancer, midsetup | What is it · Kind of policy · Who it covers · Insurer · What it pays$ · Premium$ · How often · Ends · Renews · Cash value$ · Thro… |
| balance/assets | Add it | 10 | 1 | 1 | 4 | 1041 | family, renter, retired | What it is · Kind · Where it is · Day you bought it · What you paid$ · Years it lasts · What it is worth now (optional)$ · Insura… |
| balance/update | Save all balances | 10 | 0 | 10 | 0 | 1421 | family, renter, retired | House: balance · Ana's 401(k): balance · Bo's old 401(k): balance · Bo's Roth IRA: balance · Brokerage: balance · Ally savings: b… |
| property/home | Save | 10 | 0 | 3 | 2 | 932 | family, retired | What you paid$ · Year you bought it · The exact date, if you know it · Improvements since (a new roof, an addit · Property tax a … |
| property/vehicles | Add car | 10 | 1 | 7 | 1 | 872 | family, retired, freelancer, midsetup | Which car · What it is worth today$ · Miles a year · Miles per gallon · Fuel price a gallon$ · Insurance a year$ · Upkeep and rep… |
| system/assumptions | Save and mark as reviewed | 10 | 0 | 10 | 10 | 1226 | family, renter, retired, freelancer, midsetup | Inflation each year · Stocks grow each year · Bonds grow each year · Cash and savings earn each year · How much stocks swing (a t… |
| career/equity | Add the grant | 9 | 2 | 3 | 4 | 934 | family, renter, retired, freelancer, midsetup | Kind · Name · Units or options granted · Options: the price you pay per share$ · Grant date · Vesting starts · Vests over (months… |
| goals/travel † | Add | 9 | 1 | 2 | 0 | 769 | family, renter, retired, freelancer, midsetup | What · When · People · Nights · Flights per person (return)$ · Lodging a night$ · Food per person a day$ · Activities and tickets… |
| investments/holdings | Add holding | 9 | 3 | 0 | 4 | 898 | family, renter, retired, freelancer | In which account · Symbol · Name · Shares · Price a share$ · What you paid in all$ · Kind of investment (US stocks, bonds ... · E… |
| goals/vehicle † | Work it out | 8 | 0 | 4 | 2 | 734 | renter, retired, freelancer, midsetup | Price$ · Sales tax and fees · Trade-in or sale of the old car$ · Buy by · Loan rate a year · Loan length (months) · Saved so far$… |
| property/purchase | Compare | 8 | 1 | 5 | 1 | 711 | family, renter, retired, freelancer, midsetup | What it is · Price$ · Sales tax · When you want it · Already set aside for it$ · The payment plan's rate · Payment plan length (m… |
| retirement/pensions | Add pension | 8 | 2 | 1 | 3 | 838 | family, renter, retired, freelancer, midsetup | Pension · Whose · Monthly amount$ · Starts at age · Rises with prices each year (a cost-of-l · Stops at age (optional) · Lump sum… |
| insurance/term-vs-permanent | Compare | 7 | 4 | 1 | 5 | 854 | family, renter, retired, freelancer, midsetup | Death benefit$ · Whole-life premium a year$ · Term premium a year for the same coverag · Length of the term (years) · Illustrated… |
| investments/allocation | Save target | 7 | 0 | 1 | 2 | 708 | family, renter, retired, freelancer, midsetup | US stocks · International stocks · Bonds · Cash · Real estate (REITs) · Other (gold, commodities, crypto) · How far a kind of inv… |
| taxes/hsa-fsa | Save | 7 | 0 | 0 | 6 | 819 | family, renter, freelancer, midsetup | Health plan for the HSA · Who the plan covers · You put in this year$ · Employer puts in$ · Ana's FSA election this year$ · Bo's … |
| balance/net-worth | Add account | 6 | 2 | 1 | 1 | 550 | midsetup | Account name · Type · Bank or firm · Current balance$ · Balance as of · Whose account |
| career/business | Save | 6 | 0 | 0 | 4 | 693 | family, renter, retired, freelancer, midsetup | Name of the business · What customers pay a year$ · What you take out for yourself a month$ · Health insurance you pay for yourse… |
| cashflow/expenses | Add expense | 6 | 2 | 0 | 3 | 727 | freelancer, midsetup | What is it · Category · Amount$ · How often · I must pay this (not optional) · Goes up with prices over the years · Starts · Ends |
| estate/gifting | Add gift | 6 | 2 | 1 | 2 | 716 | family, renter, retired, freelancer, midsetup | To whom · Amount$ · Year · From · What · 529 only: spread it over 5 years (front- · Notes |
| insurance/health | Add plan | 6 | 4 | 1 | 5 | 778 | family, renter, retired, freelancer, midsetup | Plan name · Your premium a month$ · Deductible a year$ · Your share after the deductible · Out-of-pocket maximum a year$ · Can ha… |
| investments/crypto | Add coin | 6 | 2 | 0 | 2 | 573 | family, renter, retired, freelancer, midsetup | Coin · Its symbol, if another · How many coins · Price of one coin today$ · What you paid for them, in all$ · When you bought them |
| retirement/annuities | Add quote | 6 | 3 | 1 | 1 | 675 | family, renter, retired | Quote · Insurer · On whose life · You pay$ · It pays a month$ · From age · Keeps paying while either of us lives (j · Rises with … |
| estate/digital | Add | 5 | 1 | 0 | 1 | 514 | family, renter, retired, freelancer, midsetup | What kind · Which one · How someone could get in · Who · Notes (never a password) |
| estate/inheritance | Add | 5 | 1 | 1 | 0 | 447 | family, renter, retired, freelancer, midsetup | From · About how much, in today's dollars$ · About when (year) · In what form · Notes |
| household/calendar | Add it | 5 | 2 | 1 | 0 | 447 | family, renter, retired, freelancer, midsetup | What · Day · Repeats · Amount (optional)$ · Note (optional) |
| retirement/contributions | Add contribution | 5 | 1 | 0 | 2 | 529 | renter, retired | Into which account · Whose · Your own money · How often · Employer adds, a year$ |
| transactions/rules | Add rule | 5 | 2 | 0 | 0 | 447 | family, renter, retired, freelancer, midsetup | When the bank description contains · Give it the category · And show the payee as · Only for · Only in this account |

## 6. Folds that open open

143 folds (of 2106) are open when the page opens, on 27 pages. Each one is a fold that hides nothing by default: either it should be shut, or it is not a fold.

| page | fold (summary) | its status line | kind | households | on first screen | holds: boxes / figures / words / px |
|---|---|---|---|---|---|---|
| balance/accounts | Balances by day | 0 saved | card | family, renter, retired, freelancer | yes | 2 / 0 / 28 / 342 |
| career/business | The business | not set | card | empty, family, renter, retired, freelancer, midsetup | yes | 6 / 0 / 72 / 712 |
| career/equity | The company | not set yet | card | empty, family, renter, retired, freelancer, midsetup | yes | 2 / 0 / 9 / 243 |
| career/equity | Grants | none yet | card | empty, family, renter, retired, freelancer, midsetup | yes | 9 / 0 / 88 / 972 |
| career/side-income | The last 12 months | none typed | row | family, freelancer | yes | 12 / 0 / 52 / 1077 |
| cashflow/expenses | See or change each bill | 13 bills | row | family, retired | yes | 0 / 27 / 252 / 1419 |
| cashflow/forecast | November 2026 | ends at $25,957 | row | family, renter, retired, freelancer |  | 0 / 13 / 36 / 317 |
| debt/credit-cards | Move this balance to a 0% card |  | row | family | yes | 0 / 3 / 17 / 65 |
| goals/charitable † | The figures | $3,000 a year | card | empty, family, renter, retired, freelancer, midsetup |  | 3 / 2 / 35 / 393 |
| goals/house | The figures | $400,000 | card | empty, family, renter, retired, freelancer, midsetup |  | 12 / 3 / 81 / 1141 |
| goals/vehicle † | The figures | $30,000 | card | empty, renter, retired, freelancer, midsetup |  | 8 / 0 / 44 / 772 |
| household/contacts | From your accounts and policies | 8 to add | card | family | yes | 0 / 0 / 92 / 1056 |
| household/documents | Who you are | 0 of 3 | card | empty, family, renter, retired, freelancer, midsetup | yes | 0 / 0 / 97 / 886 |
| insurance/health | Your coverage and your bills | just you, $5,000 a year | card | empty, family, renter, retired, freelancer, midsetup | yes | 2 / 3 / 58 / 379 |
| investments/allocation | Your target mix | not chosen yet | card | empty, family, renter, retired, freelancer, midsetup | yes | 7 / 2 / 110 / 902 |
| investments/crypto | Add a coin |  | card | empty, family, renter, retired, freelancer, midsetup | yes | 6 / 0 / 45 / 611 |
| investments/employer-stock | The company | symbol and price | card | empty, family, renter, retired, freelancer, midsetup | yes | 3 / 0 / 20 / 347 |
| property/home | The home's details | what you paid | card | family, retired |  | 10 / 0 / 84 / 970 |
| property/purchase | The purchase | what and when | card | empty, family, renter, retired, freelancer, midsetup |  | 8 / 3 / 36 / 749 |
| property/renovation | The project | $30,000 | card | empty, family, renter, retired, freelancer, midsetup |  | 3 / 0 / 41 / 383 |
| property/rent-vs-buy | The figures | $400,000, $2,200 rent | card | empty, family, renter, retired, freelancer, midsetup |  | 17 / 4 / 136 / 1731 |
| property/rental | Add a rental |  | card | empty, family, renter, retired, freelancer, midsetup | yes | 20 / 0 / 112 / 1757 |
| property/vehicles | Add a car |  | card | empty, family, retired, freelancer, midsetup | yes | 10 / 0 / 44 / 910 |
| retirement/social-security | Ana, 36 | $2,650 a month at 67 | card | family | yes | 4 / 14 / 136 / 1066 |
| retirement/social-security | Riley, 24 | $1,817 a month at 67 | card | renter | yes | 4 / 12 / 118 / 991 |
| retirement/social-security | Ruth, 72 | $2,100 a month now | card | retired | yes | 2 / 1 / 52 / 545 |
| retirement/social-security | Jo, 31 | nothing yet | card | freelancer | yes | 4 / 1 / 64 / 713 |
| retirement/social-security | Jordan, 41 | $2,324 a month at 67 | card | midsetup | yes | 4 / 12 / 118 / 991 |
| scenarios/stress-tests | 🐢 Returns 2 percentage points lower, for good Runs out at … |  | row | family, renter |  | 0 / 5 / 52 / 454 |
| scenarios/stress-tests | 🦽 Ana can never work again Runs out at 66 |  | row | family |  | 0 / 2 / 58 / 470 |
| scenarios/stress-tests | 🕯️ If Ana died this year Runs out at 69 |  | row | family |  | 0 / 4 / 107 / 605 |
| scenarios/stress-tests | 📉 A crash like 2008 Runs out at 65 |  | row | renter |  | 0 / 2 / 49 / 425 |
| scenarios/stress-tests | 🕳️ A lost decade like the 2000s Runs out at 65 |  | row | renter |  | 0 / 3 / 49 / 425 |
| scenarios/stress-tests | 🔥 The 1970s: prices up, markets down Runs out at 65 |  | row | renter |  | 0 / 4 / 60 / 470 |
| scenarios/stress-tests | 🏚️ 1929 and the Depression Runs out at 65 |  | row | renter |  | 0 / 2 / 49 / 425 |
| scenarios/stress-tests | 🧊 Stocks and bonds fall together, like 2022 Runs out at 65 |  | row | renter |  | 0 / 4 / 45 / 425 |
| scenarios/stress-tests | 📦 Riley is out of work for 6 months Runs out at 24 |  | row | renter |  | 0 / 4 / 60 / 470 |
| scenarios/stress-tests | 🦽 Riley can never work again Runs out at 25 |  | row | renter |  | 0 / 2 / 58 / 470 |
| scenarios/stress-tests | 🎂 Living to 100 Runs out at 65 |  | row | renter |  | 0 / 1 / 59 / 425 |
| scenarios/stress-tests | 🏥 Three years in a care home Runs out at 65 |  | row | renter |  | 0 / 2 / 57 / 469 |
| taxes/estimated | Last year's return | not entered | card | family, renter, retired, freelancer, midsetup |  | 2 / 6 / 91 / 464 |
| taxes/hsa-fsa | This year's figures | not set | card | empty, family, renter, freelancer, midsetup | yes | 5 / 0 / 92 / 692 |
| taxes/withholding | What a paycheck withholds | not set | card | family, renter, retired, freelancer, midsetup |  | 4 / 0 / 69 / 553 |

## 7. Every fold: what the shut ones hold

By kind: 1548 fold rows inside a card, 512 folded cards, 46 bare <details>. Of the 1963 shut folds: 192 hold boxes (787 boxes in all), 10 of those say nothing in a status line, 54 hold a box that already has a value, 144 hold 150 words or more, 54 hold under 15 words and nothing else, 31 sit inside another fold.

Three pages are lists of folds (Glossary 221 words, Help 25 topics, Settings 22 topics) and hold 1608 of the 2106. Everywhere else: 498 folds on 71 pages (355 shut, 143 open at load); 174 of the shut ones hold boxes (739 boxes), 109 have no status line, 60 hold 150 words or more, 0 hold under 15 words and nothing else. Per household with a plan that is 90.2 folds across 147 pages.

### 7a. Folds per page (pages with 3 or more shut folds; the richest household)

| page | shut folds | open | for | boxes behind them | words behind them | summaries |
|---|---|---|---|---|---|---|
| ai/glossary (Glossary) | 221 | 0 | empty | 0 | 17031 | 401(k) · 403(b) · 457(b) · 50/30/20 rule · 529 plan · Additional Medicare tax · Adjusted gross income · Alternative minimum tax · Amortization · Annual exclusion · Annual percentage rate (APR) · Annual percentage yield … |
| system/help (Help) | 25 | 0 | empty | 0 | 3889 | 🏠 Overview · 👪 Household · ⚖️ Assets and debts · 💵 Cash flow and budget · 🧾 Transactions · 💳 Debt · 🎯 Goals · 🌴 Retirement · 📈 Investments · 🧮 Taxes · 🛡️ Insurance and risk · 📜 Estate and legacy · 🏡 Home, ca… |
| system/settings (Settings) | 22 | 0 | empty | 8 | 506 | 🏠 Overview · 👪 Household · ⚖️ Assets and debts · 💵 Cash flow and budget · 🧾 Transactions · 💳 Debt · 🎯 Goals · 🌴 Retirement · 📈 Investments · 🧮 Taxes · 🛡️ Insurance and risk · 📜 Estate and legacy · 🏡 Home, ca… |
| scenarios/stress-tests (Stress tests) | 11 | 0 | retired | 0 | 991 | 📉 A crash like 2008 Lasts · 🕳️ A lost decade like the 2000s Lasts · 🔥 The 1970s: prices up, markets down Lasts · 🏚️ 1929 and the Depression Lasts · 🧊 Stocks and bonds fall together, like 2022 Lasts · 🐢 Returns 2 p… |
| career/benefits (Work benefits) | 6 | 0 | family | 18 | 200 | Your employer's match · Health accounts · Commuting · Stock purchase plan · Life insurance through work · Whose benefits |
| career/salary (Salary and raises) | 5 | 0 | family | 8 | 506 | Years ahead · Raises and promotions · Years ahead · Raises and promotions · What raises usually are |
| debt/credit-cards (Credit cards) | 5 | 0 | renter | 2 | 308 | Pay more, or move this balance to a 0% card · Pay more, or move this balance to a 0% card · Pay more, or move this balance to a 0% card · If payments are too much · Moving a balance to a 0% card |
| household/documents (Document vault index) | 5 | 1 | empty | 0 | 305 | Only if you have them · Money, home and insurance · Only if you have them · Health · Good places to keep papers |
| career/offer-compare (Job offer compare) | 3 | 0 | family | 16 | 290 | Your job now: the first year · Your job now: the figures · How it compares |
| cashflow/budget-percent (Budget (50/30/20)) | 3 | 0 | family | 4 | 209 | Needs: the bills you must pay · Wants: everything else · The split to aim for |
| cashflow/forecast (Cash-flow forecast) | 3 | 1 | family | 0 | 215 | December 2026 · January 2027 · February 2027 |
| goals/education (Education (529)) | 3 | 0 | midsetup | 9 | 42 | Type of college and share to cover · Type of college and share to cover · How fast prices rise |
| overview/guesses (Our guesses for you) | 3 | 0 | midsetup | 0 | 3126 | How it adds up · What the plan assumes about prices and markets · Where our guesses come from |
| property/vehicles (Vehicles) | 3 | 0 | renter | 30 | 121 | Change its details · The new car and the lease · + Add another car |
| retirement/roth-conversions (Roth conversions) | 3 | 0 | family | 1 | 498 | Other choices: each ends with less than not converting (2) · How this is worked out · Conversion settings |
| taxes/federal (Federal estimate) | 3 | 0 | empty | 19 | 290 | Figures the plan cannot see · Itemized deductions · Year and people |

### 7b. The folds that hold the most boxes (a form one tap away)

| page | fold (summary) | status line | boxes | must-fill | already filled | words | px when open | households |
|---|---|---|---|---|---|---|---|---|
| cashflow/paycheck | Ana: W-4 and deductions | from the plan | 15 | 0 | 0 | 206 | 1682 | family |
| cashflow/paycheck | Bo: W-4 and deductions | from the plan | 15 | 0 | 0 | 206 | 1682 | family |
| cashflow/paycheck | Riley: W-4 and deductions | from the plan | 15 | 0 | 0 | 213 | 1700 | renter |
| cashflow/paycheck | Jordan: W-4 and deductions | from the plan | 15 | 0 | 0 | 213 | 1700 | midsetup |
| career/offer-compare | Your job now: the figures | not set | 14 | 0 | 0 | 225 | 1703 | empty, family, renter, retired, freelancer, midsetup |
| property/vehicles | The new car and the lease | $35,000, lease $450 | 12 | 0 | 12 | 46 | 1048 | renter |
| property/vehicles | + Add another car |  | 10 | 1 | 7 | 44 | 910 | renter |
| taxes/federal | Figures the plan cannot see | none typed | 9 | 0 | 0 | 174 | 1256 | empty, family, renter, retired, freelancer, midsetup |
| debt/consolidation † | The offers | rates and fees | 8 | 0 | 8 | 27 | 726 | family, renter |
| goals/vehicle † | The figures | $26,720 | 8 | 0 | 4 | 54 | 814 | family |
| property/vehicles | Change its details |  | 8 | 0 | 7 | 31 | 688 | renter |
| system/settings | Advanced | Not needed day to day | 8 | 0 | 0 | 186 | 1614 | empty, family, renter, retired, freelancer, midsetup |
| career/equity | Purchase-plan shares | none | 7 | 6 | 1 | 45 | 716 | empty, family, renter, retired, freelancer, midsetup |
| property/renovation | The offers | rates and terms | 7 | 0 | 7 | 23 | 646 | empty, family, renter, retired, freelancer, midsetup |
| retirement/projection | Retirement settings | spending not set yet | 7 | 0 | 4 | 136 | 936 | empty, family, renter, retired, freelancer, midsetup |
| taxes/hsa-fsa | Change what you typed | not set | 7 | 0 | 0 | 125 | 936 | retired |
| career/benefits | Your employer's match | assumed: 50% up to 6% | 6 | 0 | 3 | 82 | 692 | family, renter, midsetup |
| goals/goals | More details (optional) |  | 6 | 0 | 0 | 71 | 691 | empty, retired, freelancer, midsetup |
| system/settings | AI assistant | Not answering | 6 | 0 | 0 | 84 | 880 | empty, family, renter, retired, freelancer, midsetup |
| taxes/federal | Itemized deductions | standard $16,100 is better | 6 | 0 | 0 | 61 | 713 | empty, family, renter, retired, freelancer, midsetup |
| taxes/state † | Your figures | no wage tax | 6 | 0 | 0 | 80 | 724 | family, renter, retired, freelancer, midsetup |
| career/benefits | Health accounts | no HSA | 5 | 0 | 0 | 43 | 608 | family, renter, midsetup |
| career/business | Expenses | none yet | 4 | 1 | 0 | 10 | 409 | empty, family, renter, retired, freelancer, midsetup |
| career/salary | Raises and promotions | 3.0% | 4 | 0 | 1 | 72 | 495 | family, renter, midsetup |
| cashflow/budget-percent | The split to aim for | 50 / 30 / 20 | 4 | 0 | 0 | 51 | 510 | family, renter, retired |
| goals/education | Type of college and share to cover | public, in-state, 100% | 4 | 0 | 3 | 15 | 470 | family, midsetup |
| insurance/ltc | The care to plan for | a nursing home, from 85 | 4 | 0 | 1 | 52 | 528 | family, renter, retired |
| retirement/social-security | Bo, 38 | $2,900 a month at 67 | 4 | 0 | 1 | 133 | 1044 | family |
| retirement/social-security | Sam, 69 | nothing yet | 4 | 0 | 0 | 64 | 714 | retired |
| taxes/federal | Year and people | 2026 | 4 | 0 | 0 | 55 | 533 | empty, family, renter, retired, freelancer, midsetup |
| balance/projection † | Assumptions | 35 years, homes +3.5% | 3 | 0 | 2 | 53 | 428 | family, renter, retired |

### 7c. The folds that hold the most words (a wall one tap away)

| page | fold (summary) | words | figures | boxes | tables | px when open (screens) | folds inside | households |
|---|---|---|---|---|---|---|---|---|
| overview/guesses | Where our guesses come from | 3066 | 8 | 0 | 1 | 16789 (19.9) | 0 | empty, family, renter, retired, freelancer, midsetup |
| retirement/rmd | How this is worked out | 523 | 24 | 0 | 1 | 2087 (2.5) | 0 | family, retired |
| retirement/withdrawal-strategy | How this is worked out | 473 | 44 | 0 | 1 | 1476 (1.7) | 0 | family, renter, retired |
| system/help | 🌴 Retirement | 462 | 0 | 0 | 0 | 1834 (2.2) | 0 | empty, family, renter, retired, freelancer, midsetup |
| retirement/roth-conversions | How this is worked out | 457 | 43 | 0 | 2 | 1920 (2.3) | 0 | family, retired |
| system/help | 📈 Investments | 365 | 0 | 0 | 0 | 1465 (1.7) | 0 | empty, family, renter, retired, freelancer, midsetup |
| retirement/fire | The 25-times rule, a quick check | 346 | 17 | 0 | 1 | 1449 (1.7) | 0 | family, renter, retired |
| system/help | 🏠 Overview | 342 | 0 | 0 | 0 | 1426 (1.7) | 0 | empty, family, renter, retired, freelancer, midsetup |
| system/assumptions | Where these numbers come from | 318 | 18 | 0 | 0 | 961 (1.1) | 0 | empty, family, renter, retired, freelancer, midsetup |
| system/help | 🧮 Taxes | 293 | 3 | 0 | 0 | 1198 (1.4) | 0 | empty, family, renter, retired, freelancer, midsetup |
| overview/health-score | The seven parts it will score | 266 | 0 | 0 | 0 | 1252 (1.5) | 0 | empty, midsetup |
| system/help | 💵 Cash flow and budget | 252 | 0 | 0 | 0 | 1183 (1.4) | 0 | empty, family, renter, retired, freelancer, midsetup |
| career/salary | What raises usually are | 241 | 13 | 0 | 1 | 824 (1) | 0 | family, renter, midsetup |
| system/help | 🛡️ Insurance and risk | 241 | 0 | 0 | 0 | 912 (1.1) | 0 | empty, family, renter, retired, freelancer, midsetup |
| scenarios/goal-seek | How it is worked out | 236 | 0 | 0 | 0 | 868 (1) | 0 | family, retired |
| scenarios/stress-tests | How these are worked out | 226 | 4 | 0 | 0 | 958 (1.1) | 0 | family, renter, retired |
| career/offer-compare | Your job now: the figures | 225 | 2 | 14 | 0 | 1703 (2) | 0 | empty, family, renter, retired, freelancer, midsetup |
| cashflow/paycheck | Riley: W-4 and deductions | 213 | 2 | 15 | 0 | 1700 (2) | 0 | renter |
| cashflow/paycheck | Jordan: W-4 and deductions | 213 | 2 | 15 | 0 | 1700 (2) | 0 | midsetup |
| cashflow/paycheck | Ana: W-4 and deductions | 206 | 1 | 15 | 0 | 1682 (2) | 0 | family |
| cashflow/paycheck | Bo: W-4 and deductions | 206 | 1 | 15 | 0 | 1682 (2) | 0 | family |
| retirement/projection | What goes into this | 202 | 12 | 0 | 1 | 1034 (1.2) | 0 | renter |
| system/help | 🎯 Goals | 198 | 0 | 0 | 0 | 834 (1) | 0 | empty, family, renter, retired, freelancer, midsetup |
| system/settings | Advanced | 186 | 0 | 8 | 0 | 1614 (1.9) | 3 | empty, family, renter, retired, freelancer, midsetup |
| system/help | 📜 Estate and legacy | 183 | 0 | 0 | 0 | 771 (0.9) | 0 | empty, family, renter, retired, freelancer, midsetup |
| household/documents | Money, home and insurance | 178 | 0 | 0 | 2 | 1096 (1.3) | 1 | empty, family, renter, retired, freelancer, midsetup |
| system/help | ⚖️ Assets and debts | 176 | 0 | 0 | 0 | 795 (0.9) | 0 | empty, family, renter, retired, freelancer, midsetup |
| taxes/federal | Figures the plan cannot see | 174 | 0 | 9 | 0 | 1256 (1.5) | 0 | empty, family, renter, retired, freelancer, midsetup |
| overview/health-score | How the score is worked out | 167 | 6 | 0 | 0 | 665 (0.8) | 0 | family, renter, retired, freelancer |
| system/help | 🏡 Home, cars, big buys | 167 | 0 | 0 | 0 | 649 (0.8) | 0 | empty, family, renter, retired, freelancer, midsetup |
| system/help | 🔀 What-if scenarios | 167 | 0 | 0 | 0 | 625 (0.7) | 0 | empty, family, renter, retired, freelancer, midsetup |
| system/help | 💳 Debt | 158 | 1 | 0 | 0 | 732 (0.9) | 0 | empty, family, renter, retired, freelancer, midsetup |
| cashflow/expenses | See or change each bill | 154 | 16 | 0 | 0 | 900 (1.1) | 0 | renter |
| system/help | 💼 Career and income | 151 | 0 | 0 | 0 | 712 (0.8) | 0 | empty, family, renter, retired, freelancer, midsetup |

### 7d. What the summaries say (the most used wordings, numbers folded to N; Glossary, Help and Settings left out)

| summary | times | pages | open at load |
|---|---|---|---|
| The figures | 24 | 4 | 23 |
| How this is worked out | 9 | 3 | 0 |
| The company | 12 | 2 | 12 |
| The offers | 8 | 2 | 0 |
| How it is worked out | 5 | 2 | 0 |
| How it adds up | 4 | 2 | 0 |
| Only if you have them | 12 | 1 | 0 |
| Notes you kept | 6 | 1 | 0 |
| The business | 6 | 1 | 6 |
| Expenses | 6 | 1 | 0 |
| Grants | 6 | 1 | 6 |
| Purchase-plan shares | 6 | 1 | 0 |
| Your job now: the figures | 6 | 1 | 0 |
| How it compares | 6 | 1 | 0 |
| Forms and records | 6 | 1 | 0 |
| How the tax is worked out | 6 | 1 | 0 |
| Where the dates come from | 6 | 1 | 0 |
| Who you are | 6 | 1 | 6 |
| Money, home and insurance | 6 | 1 | 0 |
| Health | 6 | 1 | 0 |
| Good places to keep papers | 6 | 1 | 0 |
| Where the deadlines come from | 6 | 1 | 0 |
| Your coverage and your bills | 6 | 1 | 6 |
| Your target mix | 6 | 1 | 6 |
| Add a coin | 6 | 1 | 6 |
| Advisory fee | 6 | 1 | 0 |
| Which path to measure against | 6 | 1 | 0 |
| Housekeeping | 6 | 1 | 0 |
| Where our guesses come from | 6 | 1 | 0 |
| The purchase | 6 | 1 | 6 |
| The project | 6 | 1 | 6 |
| Add a rental | 6 | 1 | 6 |
| Retirement settings | 6 | 1 | 0 |
| Where these numbers come from | 6 | 1 | 0 |
| Add a document of your own | 6 | 1 | 0 |
| Last year's return | 6 | 1 | 5 |
| Figures the plan cannot see | 6 | 1 | 0 |
| Itemized deductions | 6 | 1 | 0 |
| Year and people | 6 | 1 | 0 |
| What a paycheck withholds | 6 | 1 | 5 |

## 8. Chip rows, switches, openers: the opt-in controls that exist today

### 8a. Chip rows (the choice before the exact box)

| page | what it is for | chips (on) | n | on first screen | inside a fold | households |
|---|---|---|---|---|---|---|
| ai/glossary | Topic | **All** · Taxes · Retirement · Investing · Borrowing and home · Everyday money · Insurance and estate | 7 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| ai/glossary | Words for your plan | 401(k) · Roth IRA · Cost basis · Capital gain · Annual percentage rate (APR) · Credit utilization · Amortization · Escrow account · Self-employment t… | 10 | yes |  | family |
| ai/glossary | Words for your plan | 401(k) · Annual percentage rate (APR) · Credit utilization · Amortization | 4 | yes |  | renter |
| ai/glossary | Words for your plan | IRA · Roth IRA · Cost basis · Capital gain · Self-employment tax · Catch-up contribution · Medicare · Full retirement age · Required minimum distribu… | 9 | yes |  | retired |
| ai/glossary | Words for your plan | IRA · Self-employment tax | 2 | yes |  | freelancer |
| ai/glossary | Words for your plan | Child tax credit | 1 | yes |  | midsetup |
| cashflow/expenses | What do you know? | **I know what's left over** · I know what I spend | 2 | yes | Set your month in one number … | family, renter, retired, freelancer, midsetup |
| cashflow/expenses | How do you get health insurance? | Through work · On my own or the Marketplace · Medicaid or Medicare · Not sure | 4 |  |  | freelancer, midsetup |
| cashflow/expenses | Do you pay for childcare or after-school care? | Yes · No · Not sure | 3 |  |  | midsetup |
| goals/travel † | Kind of event | **✈️ A trip** · 💍 A wedding · 🎁 Something else | 3 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| household/calendar | How far ahead | Next month · **3 months** · A year | 3 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| household/calendar | Which dates | **All (8)** · Paydays (6) · Taxes (1) · Health and Medicare (1) | 4 | yes |  | retired |
| household/life-events | Big changes, step by step | 💍 Getting married · 👶 A baby or adoption · 💼 A new job · 🚚 Moving · 🕊️ An inheritance · 🧾 A divorce | 6 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| investments/backtest | First mix | **Your plan's mix** · All stocks · 80 / 20 · 60 / 40 · 40 / 60 · 20 / 80 · All bonds | 7 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| investments/backtest | Compared with | Your plan's mix · All stocks · 80 / 20 · **60 / 40** · 40 / 60 · 20 / 80 · All bonds | 7 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| investments/backtest | Starting in | 1871 · **1928** · 1950 · 1970 · 1990 · 2000 · 2010 | 7 |  |  | empty, family, renter, retired, freelancer, midsetup |
| investments/backtest | Which mixes | **Dollars of each year** · Today's dollars | 2 |  |  | empty, family, renter, retired, freelancer, midsetup |
| overview/dashboard | How do you get health insurance? | Through work · On my own or the Marketplace · Medicaid or Medicare · Not sure | 4 | yes |  | freelancer |
| overview/guesses | How do you get health insurance? | Through work · On my own or the Marketplace · Medicaid or Medicare · Not sure | 4 | yes |  | freelancer, midsetup |
| overview/guesses | Do you pay for childcare or after-school care? | Yes · No · Not sure | 3 | yes |  | midsetup |
| overview/monthly-review | Month | November 2026 · **October 2026** | 2 | yes |  | family, renter, retired, freelancer |
| overview/timeline | Show | **Everything 33** · Money 18 · Work 2 · Family 3 · Health 2 · Tax rules 8 | 6 |  |  | family |
| overview/timeline | Show | **Everything 15** · Money 9 · Work 1 · Health 1 · Tax rules 4 | 5 |  |  | renter, freelancer |
| overview/timeline | Show | **Everything 6** · Money 4 · Work 1 · Tax rules 1 | 4 |  |  | retired |
| overview/timeline | Show | **Everything 11** · Money 3 · Work 1 · Family 6 · Health 1 | 5 | yes |  | midsetup |
| reports/annual-review | Year | **2026 so far** · 2025 | 2 | yes |  | empty, family, renter, retired, freelancer, midsetup |
| scenarios/compare | Start from one of these, or make your own bel… | + Retire 3 years earlier · + Spend 10% less · + Save $500 more a month · + Returns 1 percentage point lower · + Pay a 1% advisor fee | 5 | yes |  | family, renter |
| scenarios/compare | Start from one of these, or make your own bel… | + Retire 3 years earlier · + Save $500 more a month · + Returns 1 percentage point lower · + Pay a 1% advisor fee | 4 | yes |  | retired |
| scenarios/goal-seek | Leave at least | **Just last** · Leave $250,000 · Leave $500,000 · Leave $1,000,000 | 4 | yes |  | family, retired |
| scenarios/goal-seek | Room for bad luck | Room for bad luck | 1 | yes |  | family, retired |
| scenarios/sensitivity | Measure | **What you can spend** · What is left at the end | 2 | yes |  | family, renter, retired |
| scenarios/stress-tests | When markets fall | **As you retire (2055)** · Now | 2 | yes |  | family, renter |
| taxes/brackets | What more income would cost | +$5,000 · **+$10,000** · +$25,000 · +$50,000 · +$100,000 | 5 | yes |  | family, renter, retired, freelancer, midsetup |
| taxes/capital-gains | The gain on it (sale price less cost), on top… | +$5,000 · **+$10,000** · +$25,000 · +$50,000 | 4 | yes |  | family, renter, retired, freelancer, midsetup |

### 8b. On/off switches and tick boxes

| page | kind | count (all households) | of them inside a shut fold | labels |
|---|---|---|---|---|
| balance/assets | tick box | 3 | 0 | Listed by name on the policy |
| career/benefits | tick box | 9 | 9 | My health plan comes with a health savings account (HSA) · My employer offers a stock purchase plan · The price is the lower of the price at the start of the offering an… |
| cashflow/budget | tick box | 3 | 0 | Unspent money rolls into next month |
| cashflow/expenses | tick box | 6 | 0 | I must pay this (not optional) · Goes up with prices over the years |
| cashflow/income | tick box | 1 | 0 | Income tax applies to it |
| cashflow/paycheck | tick box | 4 | 4 | W-4: the two-jobs box in Step 2 is checked |
| debt/consolidation † | tick box | 6 | 6 | Visa card · Car loan · Store card · Mastercard |
| estate/documents | done / not done button | 54 | 0 | Mark Will: You signed · Mark Financial power of attorney: You signed · Mark Health care power of attorney: You signed · Mark Living will: You signed · Mark HIPAA release… |
| estate/gifting | tick box | 6 | 0 | 529 only: spread it over 5 years (front-load) |
| estate/legacy | tick box | 2 | 0 | The home is part of what we leave (the plan does not need to keep its value in s |
| goals/emergency-fund † | tick box | 2 | 0 | This goal is my emergency fund |
| goals/goals | tick box | 4 | 4 | Grow the amount with inflation until then |
| insurance/health | tick box | 6 | 0 | Can have a health savings account (HSA) |
| insurance/policies | tick box | 6 | 0 | Through an employer (ends with the job) |
| insurance/term-vs-permanent | tick box | 6 | 0 | The difference goes into an ordinary investment account (taxed along the way) |
| property/rent-vs-buy | tick box | 6 | 0 | We itemize deductions (mortgage interest lowers our tax) |
| retirement/annuities | tick box | 5 | 0 | Keeps paying while either of us lives (joint life) · Rises with prices each year |
| retirement/medicare | tick box | 1 | 0 | A plan through Ana's job covers Bo |
| retirement/pensions | tick box | 6 | 0 | Rises with prices each year (a cost-of-living raise) |
| retirement/projection | tick box | 3 | 1 | My spending figure already includes health insurance |
| system/settings | on/off row | 948 | 948 | 🏠 Dashboard · 🧭 Your plan · 🗂️ All pages · 👋 Get started · 🌱 Set up my plan · 🧮 Our guesses for you · ⚡ Quick answers · 👣 Step by step · 🔔 Needs attention · 🧭 N… |
| taxes/documents † | tick box | 31 | 0 | Last year's return from your files · Property tax bill from the county · W-2 from Ana's salary · W-2 from Bo's salary · 1099-NEC or 1099-K from Weekend photography · 109… |

### 8c. Openers ("+ Add ...", rows that open in place, "show more") and what one tap added

| page | kind | control | tag | times | one tap added | households |
|---|---|---|---|---|---|---|
| balance/liabilities | add | + Add a loan or card | link to #/balance/net-worth?add=debt&back=balan… | 2 | (goes to another page) | family, renter |
| balance/net-worth | add | + Add another account | button | 4 | 516 px, 6 boxes, 25 words, 0 figures, 1 filled button | family, renter, retired, freelancer |
| cashflow/budget | add | + Add an envelope by hand | button | 3 | 245 px, 2 boxes, 10 words, 0 figures, 1 filled button | family, renter, retired |
| cashflow/expenses | add | + Add another expense | button | 3 | 704 px, 6 boxes, 44 words, 0 figures, 1 filled button | family, renter, retired |
| cashflow/income | add | + Add another income | button | 5 | 844 px, 8 boxes, 71 words, 1 figures, 1 filled button | family, renter, retired, freelancer, midsetup |
| debt/credit-cards | add | + Add another card | link to #/balance/net-worth?add=credit&back=deb… | 2 | (goes to another page) | family, renter |
| estate/beneficiaries | expander | 16 rows such as "⬜ Chase checking Checking: payable-on-d…" | button | 16 | 437 px, 1 boxes, 42 words, 0 figures, 1 filled button | family, renter, retired, freelancer |
| estate/documents | expander | 54 rows such as "Will: You Says who gets what you own an…" | button | 54 | 447 px, 4 boxes, 21 words, 0 figures | empty, family, renter, retired, freelancer, midsetup |
| goals/goals | add | + Add another goal | button | 2 | 381 px, 3 boxes, 25 words, 0 figures, 1 filled button | family, renter |
| household/documents | add | + Add a paper | button | 6 | 338 px, 4 boxes, 8 words, 0 figures, 1 filled button | empty, family, renter, retired, freelancer, midsetup |
| household/people | add | + Add another person | button | 5 | 494 px, 5 boxes, 38 words, 0 figures, 1 filled button | family, renter, retired, freelancer, midsetup |
| insurance/life-needs | expander | 1 rows such as "How to get it" | button | 1 | 545 px, 0 boxes, 121 words, 1 figures | family |
| retirement/contributions | add | + Add another contribution | button | 2 | 507 px, 5 boxes, 43 words, 1 figures, 1 filled button | family, freelancer |
| retirement/contributions | own | Type my own amount | button | 1 | 47 px, 0 boxes, 14 words, 2 figures | renter |
| scenarios/compare | add | + Make your own | button | 3 | 1656 px, 15 boxes, 123 words, 7 figures, 1 filled button | family, renter, retired |
| transactions/categories | add | + Add a category | button | 6 | 348 px, 3 boxes, 17 words, 0 figures, 1 filled button | empty, family, renter, retired, freelancer, midsetup |

### 8d. What the buttons say (outlined and filled, outside forms, numbers and names folded)

| button | pages | times |
|---|---|---|
| filled: Add what you own | 13 | 15 |
| outlined: Add what you own | 11 | 11 |
| filled: Add people | 10 | 10 |
| filled: Type what you'll spend | 10 | 10 |
| outlined: Type what you'll spend | 9 | 18 |
| filled: Import a bank file | 7 | 39 |
| filled: Print or save as PDF | 7 | 33 |
| filled: Will the money last? | 7 | 21 |
| filled: People | 7 | 14 |
| filled: Set up my plan | 7 | 13 |
| outlined: Goals | 6 | 28 |
| filled: Add holdings | 5 | 30 |
| filled: Add your income | 5 | 5 |
| outlined: Your policies | 4 | 19 |
| outlined: Import a bank file | 4 | 11 |
| outlined: Will the money last? | 4 | 11 |
| outlined: Assumptions | 4 | 10 |
| outlined: Expenses | 4 | 9 |
| filled: Add Social Security | 4 | 7 |
| outlined: Sam won't get Social Security | 4 | 4 |
| outlined: Beneficiaries | 3 | 18 |
| outlined: Estate tax | 3 | 18 |
| outlined: Legacy goals | 3 | 16 |
| outlined: Mortgage | 3 | 14 |
| outlined: Estimated payments | 3 | 10 |
| outlined: How long to plan for | 3 | 10 |
| outlined: Emergency fund | 3 | 9 |
| filled: Income | 3 | 7 |
| outlined: Change these on Expenses | 3 | 6 |
| filled: Continue your plan: Your month | 3 | 6 |
| outlined: Open my payoff plan | 3 | 5 |
| filled: Continue your plan: Set your first goal | 3 | 3 |
| filled: Continue your plan: Enter what goes out | 3 | 3 |
| outlined: I won't get Social Security | 3 | 3 |
| outlined: Use this one | 2 | 13 |
| outlined: Employer stock | 2 | 12 |
| outlined: Work benefits | 2 | 12 |
| outlined: Federal tax estimate | 2 | 11 |
| filled: Add the mortgage | 2 | 10 |
| outlined: Estate documents | 2 | 10 |
| outlined: Change what comes in | 2 | 9 |
| outlined: Which goal first? | 2 | 9 |
| filled: Accounts | 2 | 8 |
| filled: Add it on Income | 2 | 8 |
| outlined: Federal estimate | 2 | 8 |

## 9. A hero answer and one filled action

`leads with`: figure = the page's first accent card carries a figure in big type; words = a hero card whose big line has no figure (a verdict in words, or a title); bare = big text but no hero card; none = neither on the first screen.

`answer from the plan`: the big first line is a figure, or differs from the line the empty plan gets on the same page (which is the page's title or its start-here line). `answer and one filled` is the rule's first view: both on the first screen.

| household | answer from the plan | answer and exactly one filled button | hero with a figure | hero in words | bare figure | bare words | none | filled on first screen: 0 | exactly 1 | 2+ | filled on whole page: 0 | 1 | 2 | 3+ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| empty |  |  | 3 | 140 | 0 | 3 | 4 | 43 | 107 | 0 | 18 | 128 | 4 | 0 |
| family | 57 | 18 | 21 | 91 | 23 | 9 | 6 | 96 | 54 | 0 | 63 | 82 | 4 | 1 |
| renter | 48 | 16 | 13 | 101 | 19 | 9 | 8 | 88 | 62 | 0 | 59 | 84 | 7 | 0 |
| retired | 41 | 12 | 13 | 109 | 11 | 10 | 7 | 81 | 69 | 0 | 52 | 92 | 6 | 0 |
| freelancer | 31 | 10 | 13 | 113 | 10 | 8 | 6 | 65 | 82 | 3 | 36 | 106 | 8 | 0 |
| midsetup | 22 | 6 | 9 | 122 | 7 | 7 | 5 | 60 | 90 | 0 | 33 | 110 | 7 | 0 |

### 9e. Pages that have numbers but lead with their title (5 or more figures on the page, the big first line is not an answer; two or more households)

| page | households | the big first line | figures on the page (most) | screens (most) |
|---|---|---|---|---|
| investments/glide-path (Stocks by age) | family, renter, retired, freelancer, midsetup | How much in stocks, at each age | 50 | 2.59 |
| taxes/capital-gains (Capital gains) | family, renter, retired, freelancer, midsetup | Tax on what you sell | 36 | 3.03 |
| property/renovation (Renovation) | family, renter, retired, freelancer, midsetup | A home project | 31 | 2.71 |
| goals/house (House down payment) | family, renter, retired, freelancer, midsetup | Saving for a home | 25 | 3.27 |
| cashflow/statement † (Cash-flow statement) | family, renter, retired, freelancer, midsetup | Cash-flow statement | 20 | 1.93 |
| property/rent-vs-buy (Rent vs buy) | family, renter, retired, freelancer, midsetup | Rent or buy? | 20 | 3.86 |
| goals/charitable † (Giving) | family, renter, retired, freelancer, midsetup | Giving | 18 | 2.05 |
| debt/ratios (What lenders see) | family, renter, retired, freelancer, midsetup | What lenders see | 16 | 1.82 |
| retirement/longevity (How long to plan for) | family, renter, retired, freelancer, midsetup | How long might the money need to last? | 15 | 2.95 |
| property/purchase (Big purchase planner) | family, renter, retired, freelancer, midsetup | A big purchase | 14 | 2.29 |
| system/assumptions (Assumptions) | family, renter, retired, freelancer, midsetup | Assumptions | 11 | 2.63 |
| insurance/health (Health plan compare) | family, renter, retired, freelancer, midsetup | Which health plan? | 5 | 2.31 |
| balance/statement † (Balance sheet) | family, renter, retired, freelancer | Balance sheet | 54 | 2.99 |
| reports/statements (Financial statements) | family, renter, retired, freelancer | Financial statements | 52 | 3.47 |
| goals/vehicle † (Vehicle) | renter, retired, freelancer, midsetup | The next car | 18 | 2.54 |
| overview/quick (Quick answers) | family, renter, freelancer, midsetup | Get a quick answer | 12 | 2.71 |
| taxes/hsa-fsa (HSA and FSA) | family, renter, freelancer, midsetup | Health savings and flexible spending accounts | 7 | 2.84 |
| retirement/cash-flow (Year by year) | family, renter, retired | Year by year | 212 | 5.28 |
| reports/retirement (Retirement report) | family, renter, retired | Retirement report | 74 | 4.27 |
| career/salary (Salary and raises) | family, renter, midsetup | Your pay ahead | 37 | 3.57 |
| investments/limits (Contribution limits) | renter, retired, midsetup | 2026 contribution limits | 32 | 2.82 |
| career/benefits (Work benefits) | family, renter, midsetup | Open enrollment | 31 | 3.31 |
| cashflow/recurring (Bills and regular payments) | family, renter, retired | Bills and regular payments | 30 | 2.29 |
| cashflow/forecast (Cash-flow forecast) | family, renter, retired | Cash-flow forecast | 23 | 2.31 |
| retirement/buckets (Bucket strategy) | family, renter, retired | Three buckets | 20 | 2.7 |
| cashflow/budget (Budget) | family, renter, retired | Budget | 14 | 1.96 |
| retirement/sequence-risk (Order of returns) | family, renter, retired | Why the order of returns matters | 13 | 1.16 |
| retirement/withdrawal-strategy (How much to take out) | family, renter, retired | How much to take out each year | 13 | 2.05 |
| insurance/ltc (Long-term care) | family, renter, retired | Care in later life | 11 | 2.16 |
| retirement/monte-carlo (Chance the money lasts) | family, renter, retired | Chance the money lasts | 9 | 2.18 |
| scenarios/advisor-plan (Advisor's plan) | family, renter, retired | Check an advisor's plan | 6 | 2.98 |
| career/offer-compare (Job offer compare) | family, renter, midsetup | Compare a job offer | 5 | 3.43 |
| insurance/property (Auto, home, umbrella) | family, retired, freelancer | Your home, your car, a lawsuit | 5 | 1.43 |
| investments/risk (Risk) | renter, midsetup | How rough is the ride? | 45 | 2.47 |
| career/business (Small business) | family, freelancer | Your small business | 34 | 4.16 |
| retirement/roth-conversions (Roth conversions) | family, retired | Roth conversions | 22 | 2.04 |
| retirement/historical (If history repeated) | family, retired | If history repeated itself | 14 | 2.17 |
| estate/estate-tax (Estate tax) | renter, retired | (none) In 2026 the federal estate tax only reaches estates … | 11 | 1.61 |
| reports/annual-review (Annual review pack) | family, renter | 2026 in review | 9 | 1.94 |
| career/side-income (Side income) | family, freelancer | Side income | 8 | 3.07 |
| taxes/filing-status † (Filing status compare) | family, retired | (none) Married filing jointly Cheapest saves $960 a year Ma… | 7 | 1.25 |
| cashflow/income-statement (Income statement) | family, renter | Income statement | 5 | 1 |
| estate/gifting (Gifting) | family, retired | Giving while you are alive | 5 | 1.77 |

### 9a. More than one filled button showing (whole page as it opens)

| page | filled (most) | on first screen | households | the filled buttons |
|---|---|---|---|---|
| taxes/estimated (Estimated payments) | 3 | 1 | family 3, renter 2, retired 2, freelancer 2, midsetup 2 | Work out the W-4 change · Save payments (form) · Save (form) |
| career/business (Small business) | 2 | 1 | empty 2, renter 2, retired 2, midsetup 2 | Add it on Income · Save (form) |
| career/equity (Equity compensation) | 2 | 1 | empty 2, family 2, renter 2, retired 2, freelancer 2, midsetup 2 | Save (form) · Add the grant (form) |
| cashflow/expenses (Expenses) | 2 | 0 | freelancer 2, midsetup 2 | Use these guesses · Add expense (form) |
| household/calendar (Money calendar) | 2 | 1 | family 2, renter 2, retired 2, midsetup 2 | Show my paydays (form) · Add it (form) |
| investments/allocation (Allocation) | 2 | 1 | empty 2, family 2, renter 2, retired 2, freelancer 2, midsetup 2 | Add holdings · Save target (form) |
| retirement/contributions (Retirement contributions) | 2 | 1 | renter 2 | Start it at 3% · Add contribution (form) |
| retirement/historical (If history repeated) | 2 | 2 | freelancer 2 | Add Social Security · Type what you'll spend |
| retirement/monte-carlo (Chance the money lasts) | 2 | 2 | freelancer 2 | Add Social Security · Type what you'll spend |
| retirement/withdrawal-strategy (How much to take out) | 2 | 2 | freelancer 2 | Add Social Security · Type what you'll spend |
| taxes/capital-gains (Capital gains) | 2 | 1 | empty 2 | Add your income · Add sale (form) |
| taxes/withholding (Withholding check) | 2 | 1 | family 2, renter 2, retired 2, freelancer 2, midsetup 2 | Get a new W-4 form · Save (form) |

### 9b. No filled button anywhere, for a household with a plan (the page has no primary action)

47 pages show no filled button to at least three of the five households with a plan: ai/glossary (5), balance/projection † (3), career/human-capital (4), career/salary (3), cashflow/budget-percent (3), cashflow/forecast (4), cashflow/income (5), cashflow/paycheck (3), debt/ratios (5), estate/beneficiaries (4), estate/estate-tax (4), household/life-events (5), household/people (5), insurance/disability (4), insurance/ltc (3), investments/backtest (5), investments/limits (5), investments/risk (5), overview/alerts (5), overview/benchmarks (5), overview/guesses (3), overview/guide (5), overview/health-score (4), overview/pages (5), overview/quick (5), overview/timeline (5), reports/export (5), retirement/buckets (3), retirement/cash-flow (3), retirement/healthcare (5), retirement/longevity (5), retirement/medicare (5), retirement/rmd (4), retirement/sequence-risk (3), scenarios/compare (3), scenarios/sensitivity (3), scenarios/stress-tests (3), system/help (5), taxes/brackets (5), taxes/documents † (5), taxes/filing-status † (5), taxes/projection (3), taxes/state † (5), transactions/categories (5), transactions/duplicates (5), transactions/import (4), transactions/transfers (5).

### 9c. No hero and no big line on the first screen

| page | households | the first words instead |
|---|---|---|
| ai/glossary (Glossary) | empty, family, renter, retired, freelancer, midsetup | Money words, in plain English 221 money words the app uses, each explained in a sentence or two of plain Engl… |
| balance/liquidity (Emergency fund) | freelancer | $0 Usable today cash, checking, savings; $3,500 more is this year's tax, not paid yet $0 Sellable within a we… |
| balance/projection † (Net worth projection) | retired | $1,063,000 Net worth now $1,063,000 owned, $0 owed $1,215,390 In 2035 in today's money $1,092,503 At retireme… |
| career/benefits (Work benefits) | renter | The 2027 limits for the 401(k), the flexible spending accounts and commuting are not in the app yet, so 2026'… |
| estate/estate-tax (Estate tax) | renter, retired | In 2026 the federal estate tax only reaches estates over $15,000,000 a person. Above that, the tax is 40%. Li… |
| goals/prioritizer (Goal prioritizer) | renter | $3 For goals each month left after tax, spending and retirement saving $0 Left over every dated goal on time … |
| household/calendar (Money calendar) | empty, family, renter, retired, freelancer, midsetup | Bills and paydays come from the payments that repeat in your bank files. Tax, Medicare and insurance dates co… |
| overview/pages (All pages) | empty, family, renter, retired, freelancer, midsetup | 150 pages across 18 topics. 🏠 Overview 🏠 Dashboard Where you stand today and what to do next. 🧭 Your plan … |
| system/settings (Settings) | empty, family, renter, retired, freelancer, midsetup | Plan basics Plan name Currency USD EUR MXN GBP CAD Number and date format English (US) Español (México) Españ… |
| taxes/filing-status † (Filing status compare) | family, renter, retired, freelancer, midsetup | Married filing jointly Cheapest saves $960 a year Married filing jointly You file now already the cheapest Fe… |
| taxes/state † (State) | family | $0 Texas income tax, 2026 no tax on wages $0 A month nothing to set aside How it is worked out Texas has no i… |

### 9d. Heavy heroes: the answer card itself is a screenful

| page | hero px tall | words | figures | boxes | buttons filled+outlined | leads with | households |
|---|---|---|---|---|---|---|---|
| overview/quick (Quick answers) | 1691 | 410 | 12 | 0 | 0+0 | Get a quick answer | family, renter, retired, freelancer, midsetup |
| overview/guide (Step by step) | 1075 | 252 | 0 | 0 | 0+0 | Step-by-step guides | family, renter, retired, freelancer, midsetup |
| scenarios/stress-tests (Stress tests) | 840 | 132 | 0 | 0 | 0+0 | Your plan survives 0 of 10 shocks | renter |
| taxes/withholding (Withholding check) | 723 | 180 | 8 | 0 | 1+1 | You would likely get about $4,400 back | family, midsetup |
| retirement/projection (Will the money last?) | 671 | 155 | 7 | 0 | 0+2 | The money lasts | family, retired, midsetup |
| overview/dashboard (Dashboard) | 588 | 83 | 3 | 0 | 1+0 | Hi Ana. | family, renter, retired, freelancer |
| retirement/fire (Financial independence) | 586 | 127 | 4 | 0 | 1+1 | Ana would need to work until 67 | family, retired |
| taxes/estimated (Estimated payments) | 583 | 133 | 13 | 0 | 1+0 | Raise your withholding: about $3,781 more t… | family, retired, freelancer |
| taxes/federal (Federal estimate) | 555 | 134 | 9 | 0 | 1+0 | About $15,898 of federal tax for 2026 | family, renter, retired, freelancer, midsetup |
| retirement/withdrawal-order (Withdrawal order) | 530 | 116 | 5 | 0 | 1+0 | "Pre-tax, then taxable, then Roth" works be… | family |
| retirement/withdrawal-strategy (How much to take out) | 501 | 108 | 8 | 0 | 0+1 | How much to take out each year | family |
| retirement/medicare (Medicare and IRMAA) | 494 | 110 | 3 | 0 | 0+0 | Medicare at 65 | family |
| investments/risk (Risk) | 440 | 116 | 15 | 0 | 0+0 | A bad year could take about $22,752 | family, renter, retired, freelancer, midsetup |
| investments/limits (Contribution limits) | 421 | 118 | 7 | 0 | 0+0 | 2026 contribution limits | renter, retired, midsetup |
| debt/credit-cards (Credit cards) | 378 | 72 | 8 | 0 | 0+1 | $9,800 on 3 cards | family, renter |
| taxes/capital-gains (Capital gains) | 376 | 103 | 12 | 0 | 0+0 | Tax on what you sell | family, renter, retired, freelancer, midsetup |
| investments/backtest (Backtest) | 331 | 73 | 13 | 0 | 0+0 | $10,000 in 1928 became $39,896,571 by 2025 | family, renter, retired, freelancer, midsetup |
| scenarios/sensitivity (Sensitivity) | 311 | 62 | 7 | 0 | 0+0 | Inflation moves your plan the most | family, retired |

## 10. The empty plan (first open): what each page shows before anything is typed

| # | page | first-view load | screens | boxes on first screen | boxes on page | figures | filled | leads with |
|---|---|---|---|---|---|---|---|---|
| 1 | taxes/capital-gains (Capital gains) | 68 | 2.04 | 3 | 4 | 20 | 2 | Tax on what you sell |
| 2 | investments/limits (Contribution limits) | 67 | 1.77 | 0 | 0 | 11 | 0 | 2026 contribution limits |
| 3 | goals/charitable † (Giving) | 61.5 | 1.96 | 0 | 3 | 14 | 1 | Giving |
| 4 | investments/risk (Risk) | 61.3 | 2.47 | 0 | 0 | 45 | 0 | How rough is the ride? |
| 5 | investments/backtest (Backtest) | 57.8 | 2.88 | 0 | 0 | 33 | 0 | $10,000 in 1928 became $39,896,571 by 2025 |
| 6 | property/purchase (Big purchase planner) | 57.5 | 2.29 | 0 | 8 | 12 | 1 | A big purchase |
| 7 | property/renovation (Renovation) | 57.5 | 2.31 | 0 | 3 | 14 | 1 | A home project |
| 8 | property/rent-vs-buy (Rent vs buy) | 57.5 | 3.86 | 0 | 17 | 20 | 1 | Rent or buy? |
| 9 | overview/quick (Quick answers) | 57.3 | 2.35 | 0 | 0 | 0 | 0 | Get a quick answer |
| 10 | insurance/health (Health plan compare) | 56.8 | 2.31 | 2 | 8 | 5 | 1 | Which health plan? |
| 11 | goals/vehicle † (Vehicle) | 55.5 | 2.52 | 0 | 8 | 16 | 1 | The next car |
| 12 | taxes/withholding (Withholding check) | 54.3 | 1.16 | 0 | 0 | 1 | 1 | Is enough tax taken out of your pay? |
| 13 | overview/guide (Step by step) | 53.8 | 1.59 | 0 | 0 | 0 | 0 | Step-by-step guides |
| 14 | taxes/hsa-fsa (HSA and FSA) | 52.8 | 2.53 | 0 | 5 | 7 | 1 | Health savings and flexible spending accoun… |
| 15 | overview/pages (All pages) | 52.3 | 19.84 | 1 | 1 | 4 | 0 |  |
| 16 | taxes/federal (Federal estimate) | 50.5 | 1.34 | 1 | 1 | 1 | 1 | Federal tax for 2026 |
| 17 | taxes/brackets (Bracket explorer) | 49.5 | 1.39 | 0 | 0 | 20 | 1 | Which bracket are you in? |
| 18 | estate/gifting (Gifting) | 49 | 1.67 | 4 | 6 | 3 | 1 | Giving while you are alive |
| 19 | insurance/policies (Policies) | 49 | 2.14 | 5 | 11 | 0 | 1 | What protects you? |
| 20 | investments/allocation (Allocation) | 48.8 | 1.7 | 3 | 7 | 2 | 2 | Your mix against your target |
| 21 | system/help (Help) | 48.5 | 3.74 | 0 | 1 | 0 | 0 | How this app works |
| 22 | retirement/pensions (Pensions) | 48 | 1.91 | 4 | 8 | 0 | 1 | A pension |
| 23 | insurance/term-vs-permanent (Term vs permanent) | 47.5 | 2.02 | 3 | 7 | 2 | 1 | Whole life, or term and invest the rest? |
| 24 | goals/house (House down payment) | 47.3 | 2.96 | 0 | 12 | 15 | 1 | Saving for a home |
| 25 | career/business (Small business) | 46.8 | 1.76 | 4 | 6 | 0 | 2 | Your small business |

Empty plan: 33 pages open with boxes on the first screen, 22 with 6 or more boxes on the page, 15 show 5 or more money or percent figures before anything is typed, 18 have no filled button, 96 fit one screen.

## 11. By topic

| topic | pages | screens (half, with a plan) | first-view load (half) | whole-page load (half) | longest page | shut folds per page | pages with no optional part | boxes showing per page |
|---|---|---|---|---|---|---|---|---|
| taxes | 11 | 2.5 | 52.8 | 147.8 | taxes/projection 5.56 | 0.6 | 4 | 1.9 |
| reports | 6 | 2.8 | 40.4 | 121.2 | reports/plan-summary 5.32 | 0 | 5 | 0 |
| property | 6 | 2.3 | 55.5 | 119.3 | property/rent-vs-buy 3.86 | 0.3 | 3 | 10.1 |
| system | 3 | 2.6 | 42.8 | 115.5 | system/help 3.79 | 16 | 0 | 4.7 |
| career | 7 | 2.4 | 43.3 | 106.3 | career/business 4.16 | 1.7 | 0 | 5.7 |
| overview | 14 | 1.8 | 42.4 | 94 | overview/pages 19.84 | 0.4 | 6 | 0.1 |
| insurance | 8 | 1.7 | 47.5 | 84.3 | insurance/disability 2.57 | 0.2 | 6 | 3.3 |
| estate | 7 | 1.7 | 44.8 | 72.3 | estate/documents 2.84 | 0.1 | 4 | 2.9 |
| balance | 8 | 1.7 | 41.3 | 71.2 | balance/statement 2.99 | 0.2 | 4 | 2 |
| goals | 8 | 1.7 | 49.4 | 69.1 | goals/house 3.27 | 0.3 | 3 | 4 |
| retirement | 18 | 1.2 | 42.8 | 54.8 | retirement/cash-flow 5.28 | 0.4 | 7 | 1.2 |
| ai | 3 | 1.1 | 34.8 | 43 | ai/glossary 13.9 | 74 | 1 | 1 |
| household | 5 | 1.3 | 35.3 | 42.3 | household/calendar 3 | 1.4 | 1 | 1.6 |
| investments | 14 | 1 | 41.3 | 41.3 | investments/backtest 2.88 | 0.2 | 10 | 1.7 |
| cashflow | 12 | 1 | 34.1 | 39.4 | cashflow/paycheck 2.77 | 0.5 | 6 | 0.5 |
| scenarios | 5 | 1 | 32.8 | 36 | scenarios/stress-tests 7.64 | 1.1 | 1 | 1.9 |
| debt | 7 | 1 | 19 | 19 | debt/mortgage 3.3 | 0.3 | 5 | 0.3 |
| transactions | 8 | 1 | 15.4 | 15.4 | transactions/categories 2.83 | 0 | 7 | 0.8 |

## 12. Is the ranking an accident of the weights?

| other way to score | rank agreement with the load score, first views (Spearman, 1 = same order) | whole pages | of the top 40 first views, how many stay in the top 40 |
|---|---|---|---|
| every item counts 1 (words / 10) | 0.93 | 0.98 | 35 |
| words only | 0.90 | 0.97 | 24 |
| no words (controls, figures, blocks) | 0.83 | 0.95 | 24 |
| boxes weigh double | 0.92 | 0.99 | 25 |
| figures weigh triple | 0.96 | 0.99 | 35 |

## 13. Every page (households with a plan: half = median of the five; e = the empty plan)

| page | screens half / most / e | first-view load half / most / e | page load half / most | all-open load (most) | boxes: first screen / page / all open (most) | figures first screen (half) | words first screen (half) | folds shut / open (most) | chips | openers | leads with (richest) | filled on first screen (households 0 / 1 / 2+) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ai/glossary | 13.7 / 13.9 / 13.43 | 34.8 / 39 / 28.3 | 184.8 / 191 | 6071.8 | 1 / 1 / 1 | 0 | 83 | 221 / 0 | 2 | 0 | none:  | 5 / 0 / 0 |
| ai/notes | 1.1 / 1.05 / 1.05 | 43 / 43 / 42.3 | 43 / 43 | 54.5 | 1 / 1 / 2 | 0 | 122 | 1 / 0 | 0 | 0 | words: Voice notes | 0 / 5 / 0 |
| ai/reader | 1 / 1 / 1 | 23 / 23 / 22.3 | 23 / 23 | 23 | 1 / 1 / 1 | 0 | 60 | 0 / 0 | 0 | 0 | words: Read a document | 0 / 5 / 0 |
| balance/accounts | 1.8 / 1.76 / 1 | 36.8 / 37.3 / 13.5 | 62 / 62.5 | 62.5 | 3 / 4 / 4 | 1 | 65 | 0 / 1 | 0 | 0 | bare figure: $4,200 | 3 / 2 / 0 |
| balance/assets | 2.4 / 2.46 / 1 | 41.3 / 42.8 / 19 | 109.5 / 112 | 150 | 1 / 10 / 10 | 2 | 89 | 1 / 0 | 0 | 0 | bare figure: $380,000 | 3 / 2 / 0 |
| balance/liabilities | 1 / 1.62 / 1 | 18.5 / 64.3 / 17.8 | 18.5 / 107 | 107 | 0 / 0 / 0 | 0 | 64 | 0 / 0 | 0 | 1 | bare figure: $23,800 | 0 / 5 / 0 |
| balance/liquidity | 2 / 2.78 / 1 | 46.5 / 53.3 / 15.3 | 81.8 / 128.5 | 128.5 | 2 / 2 / 2 | 5 | 116 | 0 / 0 | 0 | 0 | bare figure: 0.9 months covered | 3 / 2 / 0 |
| balance/net-worth | 1.8 / 2.5 / 1.3 | 46.8 / 50.3 / 45.8 | 84 / 123.3 | 123.3 | 6 / 6 / 6 | 8 | 73 | 0 / 0 | 0 | 1 | bare figure: $287,100 | 5 / 0 / 0 |
| balance/projection † | 1.7 / 2.54 / 1 | 42 / 48.8 / 23.8 | 80.8 / 129 | 157.8 | 0 / 0 / 3 | 10 | 79 | 1 / 0 | 0 | 0 | bare figure: $287,100 | 3 / 2 / 0 |
| balance/statement † | 2.1 / 2.99 / 1 | 45.8 / 48.8 / 13.5 | 122.3 / 191.3 | 191.3 | 0 / 0 / 0 | 12 | 95 | 0 / 0 | 0 | 0 | bare words: Balance sheet | 0 / 5 / 0 |
| balance/update | 1.6 / 2.13 / 1 | 38.8 / 42.8 / 17.3 | 64.3 / 85 | 85 | 4 / 10 / 10 | 0 | 78 | 0 / 0 | 0 | 0 | words: Update my balances | 3 / 2 / 0 |
| career/benefits | 2.4 / 3.31 / 1 | 46.8 / 78.3 / 19.3 | 137 / 197 | 348 | 0 / 0 / 18 | 2 | 165 | 6 / 0 | 0 | 0 | words: Open enrollment | 1 / 4 / 0 |
| career/business | 1.8 / 4.16 / 1.76 | 46.8 / 46.8 / 46.8 | 77 / 254.3 | 302.5 | 4 / 6 / 12 | 0 | 99 | 2 / 1 | 0 | 0 | words: Your small business | 2 / 3 / 0 |
| career/equity | 2.4 / 2.53 / 2.44 | 43.3 / 43.3 / 43.3 | 106.3 / 111 | 154.8 | 3 / 12 / 19 | 0 | 99 | 1 / 2 | 0 | 0 | words: Stock from work | 0 / 5 / 0 |
| career/human-capital | 1.8 / 2.06 / 1 | 52.5 / 60.8 / 19.3 | 86.3 / 106 | 126.5 | 0 / 0 / 2 | 8 | 116 | 1 / 0 | 0 | 0 | bare figure: 95% | 4 / 1 / 0 |
| career/offer-compare | 3.4 / 3.43 / 3.36 | 42.8 / 43 / 43 | 178.8 / 179.5 | 348.5 | 4 / 18 / 34 | 1 | 99 | 3 / 0 | 0 | 0 | words: Compare a job offer | 5 / 0 / 0 |
| career/salary | 2.7 / 3.57 / 1 | 43.3 / 45 / 19.3 | 139.8 / 193.5 | 430 | 0 / 0 / 8 | 4 | 109 | 5 / 0 | 0 | 0 | words: Your pay ahead | 3 / 2 / 0 |
| career/side-income | 1 / 3.07 / 1 | 24 / 48.5 / 23.3 | 24 / 154.5 | 205.3 | 3 / 12 / 12 | 0 | 78 | 1 / 1 | 0 | 0 | words: Side income | 2 / 3 / 0 |
| cashflow/budget | 1.6 / 1.96 / 1.12 | 44 / 45.3 / 37.5 | 58.3 / 68 | 68 | 3 / 3 / 3 | 4 | 114 | 0 / 0 | 0 | 1 | words: Budget | 0 / 5 / 0 |
| cashflow/budget-percent | 2 / 2.04 / 1 | 71.3 / 78.8 / 22 | 125.5 / 128.8 | 236.3 | 0 / 0 / 4 | 28 | 125 | 3 / 0 | 0 | 0 | bare figure: $11,979 | 3 / 2 / 0 |
| cashflow/expenses | 2.3 / 2.4 / 1.45 | 52.5 / 56.5 / 42.8 | 114.3 / 140.5 | 171 | 0 / 6 / 7 | 5 | 120 | 2 / 1 | 3 | 1 | bare figure: $5,826 | 4 / 1 / 0 |
| cashflow/forecast | 2.1 / 2.31 / 1 | 34.3 / 34.8 / 17 | 91.5 / 107 | 261.3 | 2 / 2 / 2 | 6 | 43 | 3 / 1 | 0 | 0 | words: Cash-flow forecast | 4 / 1 / 0 |
| cashflow/income | 1 / 1.8 / 1.65 | 28.3 / 58 / 44 | 28.3 / 90 | 90 | 0 / 0 / 0 | 6 | 55 | 0 / 0 | 0 | 1 | bare figure: $6,000 | 5 / 0 / 0 |
| cashflow/income-statement | 1 / 1 / 1 | 26 / 28.3 / 12 | 26 / 28.3 | 28.3 | 0 / 0 / 0 | 4 | 70 | 0 / 0 | 0 | 0 | words: Income statement | 0 / 5 / 0 |
| cashflow/paycheck | 1.7 / 2.77 / 1 | 47.3 / 59.5 / 18 | 83.3 / 159.5 | 407.5 | 0 / 0 / 30 | 9 | 113 | 2 / 0 | 0 | 0 | bare figure: $2,888 | 3 / 2 / 0 |
| cashflow/recurring | 1.6 / 2.29 / 1 | 42.8 / 43 / 15.8 | 73 / 112 | 112 | 0 / 0 / 0 | 10 | 89 | 0 / 0 | 0 | 0 | words: Bills and regular payments | 0 / 5 / 0 |
| cashflow/sinking-funds | 1 / 1 / 1 | 25.3 / 48.3 / 24.5 | 25.3 / 48.3 | 48.3 | 0 / 0 / 0 | 0 | 83 | 0 / 0 | 0 | 0 | figure: Set aside $1,300 a month | 2 / 3 / 0 |
| cashflow/spending | 1 / 1 / 1 | 11.8 / 11.8 / 11 | 11.8 / 11.8 | 11.8 | 0 / 0 / 0 | 0 | 37 | 0 / 0 | 0 | 0 | words: Where the money goes | 0 / 5 / 0 |
| cashflow/statement † | 1.4 / 1.93 / 1 | 40.8 / 43 / 18.5 | 54 / 86.5 | 86.5 | 0 / 0 / 0 | 12 | 83 | 0 / 0 | 0 | 0 | bare words: Cash-flow statement | 0 / 5 / 0 |
| cashflow/subscriptions | 1 / 1 / 1 | 22.8 / 26.5 / 22 | 22.8 / 26.5 | 26.5 | 0 / 0 / 0 | 0 | 69 | 0 / 0 | 0 | 0 | figure: $576 a year | 1 / 4 / 0 |
| debt/consolidation † | 1 / 1.25 / 1 | 20 / 80.3 / 19.3 | 20 / 84.8 | 147.8 | 0 / 0 / 8 | 1 | 62 | 2 / 0 | 0 | 0 | bare figure: $9,800 | 2 / 3 / 0 |
| debt/credit-cards | 1 / 1.84 / 1 | 18.5 / 75.8 / 17.8 | 18.5 / 121.8 | 253.8 | 0 / 0 / 2 | 0 | 64 | 5 / 1 | 0 | 1 | figure: $9,800 on 3 cards | 2 / 3 / 0 |
| debt/mortgage | 1 / 3.3 / 1 | 17.8 / 46.5 / 17 | 17.8 / 194 | 194 | 2 / 2 / 2 | 0 | 61 | 0 / 0 | 0 | 0 | words: Mortgage | 1 / 4 / 0 |
| debt/payoff | 1 / 2.03 / 1 | 15.3 / 61.8 / 14.5 | 15.3 / 119 | 119 | 2 / 2 / 2 | 0 | 51 | 0 / 0 | 0 | 0 | words: Debt-free by March 2039 | 0 / 5 / 0 |
| debt/ratios | 1.7 / 1.82 / 1 | 47.5 / 50 / 17.8 | 88.5 / 108.8 | 108.8 | 0 / 0 / 0 | 6 | 132 | 0 / 0 | 0 | 0 | words: What lenders see | 5 / 0 / 0 |
| debt/refinance | 1 / 1 / 1 | 18.3 / 41.5 / 17.5 | 18.3 / 41.5 | 41.5 | 4 / 4 / 4 | 0 | 63 | 0 / 0 | 0 | 0 | words: Refinance | 0 / 5 / 0 |
| debt/student-loans † | 1 / 1 / 1 | 19 / 19 / 18.3 | 19 / 19 | 19 | 0 / 0 / 0 | 0 | 60 | 0 / 0 | 0 | 0 | words: Student loans | 0 / 5 / 0 |
| estate/beneficiaries | 1 / 1.25 / 1 | 34 / 39 / 20.8 | 34 / 45 | 45 | 0 / 0 / 0 | 5 | 78 | 0 / 0 | 0 | 6 | bare figure: 0 of 6 | 4 / 1 / 0 |
| estate/digital | 1.9 / 1.9 / 1.9 | 46.3 / 46.3 / 46.3 | 80.5 / 80.5 | 80.5 | 0 / 5 / 5 | 0 | 161 | 0 / 0 | 0 | 0 | words: Your digital life | 5 / 0 / 0 |
| estate/documents | 2.4 / 2.84 / 2.11 | 45.5 / 47.3 / 45.3 | 112 / 137.8 | 137.8 | 0 / 0 / 0 | 0 | 136 | 0 / 0 | 0 | 13 | words: The papers that protect your … | 0 / 5 / 0 |
| estate/estate-tax | 1.2 / 1.61 / 1 | 44.5 / 58.8 / 25.8 | 49.5 / 74.5 | 107 | 0 / 0 / 0 | 7 | 120 | 1 / 0 | 0 | 0 | bare figure: $287,100 | 4 / 1 / 0 |
| estate/gifting | 1.7 / 1.77 / 1.67 | 49 / 53 / 49 | 69.8 / 80.8 | 80.8 | 4 / 6 / 6 | 3 | 104 | 0 / 0 | 0 | 0 | words: Giving while you are alive | 5 / 0 / 0 |
| estate/inheritance | 1.7 / 1.69 / 1.69 | 44.5 / 44.5 / 44.5 | 72.3 / 72.3 | 72.3 | 5 / 5 / 5 | 0 | 86 | 0 / 0 | 0 | 0 | words: An inheritance you might rece… | 5 / 0 / 0 |
| estate/legacy | 1.2 / 1.36 / 1.18 | 43.5 / 44.8 / 43.5 | 45.8 / 54 | 54 | 4 / 4 / 4 | 0 | 82 | 0 / 0 | 0 | 0 | words: What you want to leave | 0 / 5 / 0 |
| goals/charitable † | 2 / 2.05 / 1.96 | 67 / 67 / 61.5 | 117.3 / 118.8 | 118.8 | 0 / 3 / 3 | 14 | 174 | 0 / 1 | 0 | 0 | words: Giving | 5 / 0 / 0 |
| goals/education | 1 / 1.91 / 1 | 22.3 / 59.5 / 21.5 | 22.3 / 103.3 | 158.3 | 0 / 0 / 9 | 3 | 65 | 3 / 0 | 0 | 0 | bare figure: $168,990 | 2 / 3 / 0 |
| goals/emergency-fund † | 1.2 / 1.75 / 1 | 42.3 / 49.8 / 18.5 | 53.8 / 73.8 | 73.8 | 0 / 0 / 0 | 4 | 109 | 0 / 0 | 0 | 0 | bare figure: $4,200 | 2 / 3 / 0 |
| goals/goals | 1.1 / 1.55 / 1.11 | 39.3 / 55.5 / 39.3 | 41.5 / 83 | 88.3 | 3 / 3 / 9 | 0 | 89 | 1 / 0 | 0 | 1 | words: What are you saving for? | 2 / 3 / 0 |
| goals/house | 3.3 / 3.27 / 2.96 | 62 / 63 / 47.3 | 177 / 177.5 | 177.5 | 0 / 12 / 12 | 14 | 148 | 0 / 1 | 0 | 0 | words: Saving for a home | 5 / 0 / 0 |
| goals/prioritizer | 1 / 1.43 / 1 | 14 / 63.8 / 13.3 | 14 / 76 | 87.8 | 0 / 0 / 1 | 0 | 46 | 1 / 0 | 0 | 0 | bare figure: $4,834 | 0 / 5 / 0 |
| goals/travel † | 1.7 / 1.73 / 1.73 | 38 / 38 / 38 | 64.3 / 64.3 | 64.3 | 5 / 9 / 9 | 0 | 58 | 0 / 0 | 1 | 0 | words: Trips and big days | 5 / 0 / 0 |
| goals/vehicle † | 2.5 / 2.54 / 2.52 | 55.5 / 69 / 55.5 | 132 / 132 | 132 | 0 / 8 / 8 | 12 | 140 | 1 / 1 | 0 | 0 | words: The next car | 5 / 0 / 0 |
| household/calendar | 2 / 3 / 1.39 | 49.3 / 51.8 / 46.8 | 91.5 / 143 | 163.8 | 2 / 7 / 7 | 0 | 129 | 1 / 0 | 2 | 0 | none:  | 1 / 4 / 0 |
| household/contacts | 1 / 1.95 / 1 | 18.5 / 36.5 / 17.8 | 18.5 / 61 | 61 | 0 / 0 / 0 | 0 | 60 | 0 / 1 | 0 | 0 | words: Who to call | 0 / 5 / 0 |
| household/documents | 2.3 / 2.51 / 1.92 | 38.5 / 39.8 / 39 | 78.5 / 84.3 | 233.8 | 0 / 0 / 0 | 0 | 114 | 5 / 1 | 0 | 1 | words: Where your papers are | 0 / 5 / 0 |
| household/life-events | 1 / 1 / 1 | 23.3 / 23.3 / 22.5 | 23.3 / 23.3 | 51.8 | 0 / 0 / 0 | 0 | 71 | 1 / 0 | 1 | 0 | words: Big changes, step by step | 5 / 0 / 0 |
| household/people | 1.2 / 1.28 / 1.57 | 35.3 / 36 / 46.8 | 39.8 / 43.5 | 43.5 | 2 / 2 / 2 | 0 | 76 | 0 / 0 | 0 | 1 | bare figure: 29 | 5 / 0 / 0 |
| insurance/cash-value | 1 / 1 / 1 | 22.5 / 22.5 / 21.8 | 22.5 / 22.5 | 22.5 | 0 / 0 / 0 | 0 | 72 | 0 / 0 | 0 | 0 | words: A policy with a cash value | 0 / 5 / 0 |
| insurance/disability | 1.2 / 2.57 / 1 | 64.3 / 74.8 / 21.3 | 68.8 / 174.3 | 174.3 | 0 / 0 / 0 | 10 | 167 | 0 / 0 | 0 | 0 | bare figure: $8,450 | 4 / 1 / 0 |
| insurance/health | 2.3 / 2.31 / 2.31 | 56.8 / 56.8 / 56.8 | 121.8 / 121.8 | 121.8 | 2 / 8 / 8 | 4 | 147 | 0 / 1 | 0 | 0 | words: Which health plan? | 5 / 0 / 0 |
| insurance/life-needs | 1 / 2.38 / 1 | 30.5 / 62 / 25 | 30.5 / 130.5 | 205 | 0 / 0 / 0 | 1 | 92 | 2 / 0 | 0 | 1 | figure: Ana needs about $312,000 more… | 2 / 3 / 0 |
| insurance/ltc | 1.7 / 2.16 / 1 | 42.8 / 42.8 / 34.5 | 73.5 / 105 | 141 | 0 / 0 / 4 | 5 | 129 | 1 / 0 | 0 | 0 | words: Care in later life | 3 / 2 / 0 |
| insurance/policies | 2.1 / 2.14 / 2.14 | 49 / 49 / 49 | 100.8 / 100.8 | 100.8 | 5 / 11 / 11 | 0 | 98 | 0 / 0 | 0 | 0 | words: What protects you? | 5 / 0 / 0 |
| insurance/property | 1.3 / 1.43 / 1.09 | 43.3 / 48.8 / 36.8 | 55 / 62.5 | 62.5 | 0 / 0 / 0 | 1 | 136 | 0 / 0 | 0 | 0 | words: Your home, your car, a lawsuit | 0 / 5 / 0 |
| insurance/term-vs-permanent | 2 / 2.02 / 2.02 | 47.5 / 47.5 / 47.5 | 95.8 / 95.8 | 95.8 | 3 / 7 / 7 | 0 | 124 | 0 / 0 | 0 | 0 | words: Whole life, or term and inves… | 5 / 0 / 0 |
| investments/allocation | 1.7 / 1.7 / 1.7 | 48.8 / 48.8 / 48.8 | 81.8 / 81.8 | 81.8 | 3 / 7 / 7 | 2 | 111 | 0 / 1 | 0 | 0 | words: Your mix against your target | 0 / 5 / 0 |
| investments/asset-location | 1 / 1 / 1 | 18.8 / 18.8 / 18 | 18.8 / 18.8 | 18.8 | 0 / 0 / 0 | 0 | 65 | 0 / 0 | 0 | 0 | words: Which investments belong in w… | 0 / 5 / 0 |
| investments/backtest | 2.9 / 2.88 / 2.88 | 57.8 / 57.8 / 57.8 | 149.3 / 149.3 | 149.3 | 0 / 0 / 0 | 13 | 143 | 0 / 0 | 4 | 0 | figure: $10,000 in 1928 became $39,89… | 5 / 0 / 0 |
| investments/crypto | 1.3 / 1.34 / 1.34 | 46 / 46 / 46 | 57.8 / 57.8 | 57.8 | 5 / 6 / 6 | 0 | 88 | 0 / 1 | 0 | 0 | words: Crypto | 5 / 0 / 0 |
| investments/dividends | 1 / 1 / 1 | 11.8 / 11.8 / 11 | 11.8 / 11.8 | 11.8 | 0 / 0 / 0 | 0 | 37 | 0 / 0 | 0 | 0 | words: Dividends and interest | 0 / 5 / 0 |
| investments/employer-stock | 1 / 1.02 / 1.02 | 41.3 / 41.3 / 40.5 | 41.3 / 41.3 | 41.3 | 3 / 3 / 3 | 0 | 95 | 0 / 1 | 0 | 0 | words: Your employer's stock | 0 / 5 / 0 |
| investments/fees | 1 / 1 / 1 | 19.3 / 19.3 / 18.5 | 19.3 / 19.3 | 47.8 | 0 / 0 / 1 | 1 | 59 | 1 / 0 | 0 | 0 | words: What your investments cost | 0 / 5 / 0 |
| investments/glide-path | 2.4 / 2.59 / 2.31 | 43.3 / 43.3 / 40.5 | 131 / 149 | 168 | 0 / 0 / 1 | 2 | 121 | 1 / 0 | 0 | 0 | words: How much in stocks, at each a… | 0 / 5 / 0 |
| investments/holdings | 1.8 / 1.75 / 1 | 42.8 / 42.8 / 19.5 | 74.3 / 74.3 | 94.3 | 6 / 9 / 10 | 0 | 65 | 1 / 0 | 0 | 0 | words: What you hold | 4 / 1 / 0 |
| investments/limits | 2.2 / 2.82 / 1.77 | 65.8 / 68 / 67 | 139 / 178.8 | 178.8 | 0 / 0 / 0 | 15 | 164 | 0 / 0 | 0 | 0 | words: 2026 contribution limits | 5 / 0 / 0 |
| investments/performance | 1 / 1 / 1 | 26 / 26 / 19.3 | 26 / 26 | 26 | 0 / 0 / 0 | 0 | 94 | 0 / 0 | 0 | 0 | words: How your investments have done | 0 / 5 / 0 |
| investments/rebalance | 1 / 1 / 1 | 14 / 14 / 13.3 | 14 / 14 | 14 | 0 / 0 / 0 | 0 | 42 | 0 / 0 | 0 | 0 | words: Rebalance | 0 / 5 / 0 |
| investments/risk | 2.5 / 2.54 / 2.47 | 65.8 / 65.8 / 61.3 | 202 / 202 | 202 | 0 / 0 / 0 | 19 | 165 | 0 / 0 | 0 | 0 | figure: A bad year could take about $… | 5 / 0 / 0 |
| investments/tax-lots | 1 / 1 / 1 | 13.8 / 13.8 / 13 | 13.8 / 13.8 | 13.8 | 0 / 0 / 0 | 0 | 45 | 0 / 0 | 0 | 0 | words: Tax lots and harvesting | 0 / 5 / 0 |
| overview/alerts | 1 / 1.66 / 1.07 | 47.5 / 67 / 41.5 | 47.5 / 100 | 113.5 | 0 / 0 / 0 | 2 | 138 | 1 / 0 | 0 | 0 | figure: 6 things to look at | 5 / 0 / 0 |
| overview/benchmarks | 1.6 / 2.27 / 1 | 43.3 / 49 / 14.3 | 77 / 126 | 126 | 0 / 0 / 0 | 4 | 133 | 0 / 0 | 0 | 0 | figure: Ahead on 0 of 6 | 5 / 0 / 0 |
| overview/dashboard | 1.7 / 2.64 / 1.03 | 41.8 / 45.8 / 24.8 | 65.3 / 97.5 | 97.5 | 0 / 0 / 0 | 6 | 103 | 1 / 0 | 1 | 0 | words: Hi Ruth. | 0 / 5 / 0 |
| overview/guesses | 1 / 2.16 / 1 | 24 / 48.8 / 28.3 | 24 / 96.5 | 1188.5 | 0 / 1 / 1 | 0 | 78 | 3 / 0 | 2 | 0 | words: Our guesses for you | 4 / 1 / 0 |
| overview/guide | 1.8 / 1.84 / 1.59 | 56.3 / 60.8 / 53.8 | 97 / 102.5 | 102.5 | 0 / 0 / 0 | 0 | 175 | 0 / 0 | 0 | 0 | words: Step-by-step guides | 5 / 0 / 0 |
| overview/health-score | 2.7 / 2.92 / 1 | 43.8 / 51.8 / 13.8 | 131 / 180.5 | 228.3 | 0 / 0 / 0 | 0 | 121 | 1 / 0 | 0 | 0 | figure: Needs work: 14 out of 100 | 4 / 1 / 0 |
| overview/monthly-review | 1.8 / 1.97 / 1 | 39.3 / 42.5 / 13.3 | 72.8 / 82.8 | 82.8 | 0 / 1 / 1 | 1 | 113 | 0 / 0 | 1 | 0 | words: The October 2026 check-in | 0 / 5 / 0 |
| overview/next-best-action | 2 / 3.79 / 1 | 43.8 / 58.8 / 21.8 | 108.8 / 262.3 | 301.3 | 0 / 0 / 0 | 9 | 97 | 1 / 0 | 0 | 0 | words: A starter emergency fund | 1 / 4 / 0 |
| overview/pages | 19.8 / 19.84 / 19.84 | 52.3 / 52.3 / 52.3 | 1198.8 / 1198.8 | 1198.8 | 1 / 1 / 1 | 0 | 149 | 0 / 0 | 0 | 0 | none:  | 5 / 0 / 0 |
| overview/plan | 2.5 / 3.29 / 1 | 51.8 / 52.8 / 9 | 110.8 / 176.8 | 201.3 | 0 / 0 / 0 | 8 | 131 | 1 / 0 | 0 | 0 | words: Your plan so far | 0 / 5 / 0 |
| overview/quick | 2.6 / 2.71 / 2.35 | 61.5 / 67.5 / 57.3 | 148.8 / 165.8 | 165.8 | 0 / 0 / 0 | 6 | 185 | 0 / 0 | 0 | 0 | words: Get a quick answer | 5 / 0 / 0 |
| overview/setup | 1 / 1.09 / 1 | 23.3 / 31.8 / 23 | 23.3 / 33.3 | 33.3 | 0 / 0 / 0 | 0 | 85 | 0 / 0 | 0 | 0 | bare words: Your plan is set up | 0 / 5 / 0 |
| overview/start | 1.6 / 1.64 / 1 | 33.3 / 35.8 / 23.3 | 57.5 / 60.8 | 60.8 | 0 / 0 / 0 | 0 | 103 | 0 / 0 | 0 | 0 | bare words: Hi Jordan. What would you lik… | 0 / 5 / 0 |
| overview/timeline | 3.7 / 8.27 / 1 | 31.5 / 34.3 / 16.5 | 144.8 / 380.3 | 380.3 | 0 / 0 / 0 | 1 | 82 | 0 / 0 | 1 | 0 | figure: Your next 59 years | 5 / 0 / 0 |
| property/home | 1 / 3.11 / 1 | 17.3 / 54.5 / 16.5 | 17.3 / 167.5 | 180.5 | 0 / 10 / 11 | 0 | 55 | 1 / 1 | 0 | 0 | bare figure: $380,000 | 2 / 3 / 0 |
| property/purchase | 2.3 / 2.29 / 2.29 | 57.5 / 57.8 / 57.5 | 114.8 / 115 | 115 | 0 / 8 / 8 | 9 | 154 | 0 / 1 | 0 | 0 | words: A big purchase | 5 / 0 / 0 |
| property/renovation | 2.3 / 2.71 / 2.31 | 57.5 / 59.8 / 57.5 | 120.8 / 168 | 204.8 | 0 / 3 / 10 | 11 | 150 | 1 / 1 | 0 | 0 | words: A home project | 5 / 0 / 0 |
| property/rent-vs-buy | 3.9 / 3.86 / 3.86 | 57.5 / 57.5 / 57.5 | 204 / 204 | 204 | 0 / 17 / 17 | 9 | 142 | 0 / 1 | 0 | 0 | words: Rent or buy? | 5 / 0 / 0 |
| property/rental | 2.7 / 2.91 / 2.67 | 44.5 / 49.8 / 44.5 | 129 / 150.5 | 150.5 | 5 / 21 / 21 | 0 | 82 | 0 / 1 | 0 | 0 | words: Rental property | 5 / 0 / 0 |
| property/vehicles | 1.7 / 1.91 / 1.67 | 44 / 52.3 / 44 | 72 / 104.3 | 262 | 5 / 10 / 30 | 0 | 82 | 3 / 1 | 0 | 0 | bare figure: $5,540 | 5 / 0 / 0 |
| reports/annual-review | 1.8 / 1.94 / 1.45 | 31.5 / 35.8 / 36.3 | 61.8 / 74.3 | 74.3 | 0 / 0 / 0 | 2 | 98 | 0 / 0 | 1 | 0 | bare words: 2026 in review | 0 / 5 / 0 |
| reports/export | 2.8 / 2.77 / 2.84 | 41 / 41 / 38.8 | 118 / 121.8 | 121.8 | 0 / 0 / 0 | 0 | 116 | 0 / 0 | 0 | 0 | words: Export | 5 / 0 / 0 |
| reports/plan-summary | 4 / 5.32 / 1 | 40.8 / 46.8 / 13 | 181.5 / 257.5 | 257.5 | 0 / 0 / 0 | 11 | 97 | 0 / 0 | 0 | 0 | bare words: Financial plan summary | 0 / 5 / 0 |
| reports/retirement | 3.4 / 4.27 / 1 | 41.5 / 42.8 / 21.5 | 186.5 / 255.5 | 255.5 | 0 / 0 / 0 | 6 | 110 | 0 / 0 | 0 | 0 | bare words: Retirement report | 0 / 5 / 0 |
| reports/statements | 3.1 / 3.47 / 1 | 31.8 / 38.5 / 16.8 | 126.5 / 150.8 | 150.8 | 0 / 0 / 0 | 10 | 66 | 0 / 0 | 0 | 0 | bare words: Financial statements | 0 / 5 / 0 |
| reports/tax | 2.8 / 3.2 / 1 | 57.3 / 58.3 / 17 | 162.5 / 189.5 | 189.5 | 0 / 0 / 0 | 19 | 127 | 0 / 0 | 0 | 0 | bare words: Tax report, 2026 | 0 / 5 / 0 |
| retirement/annuities | 1.9 / 1.94 / 1 | 45.3 / 45.3 / 38.8 | 83.8 / 88 | 88 | 5 / 6 / 6 | 0 | 87 | 0 / 0 | 0 | 0 | words: An income for life | 3 / 2 / 0 |
| retirement/buckets | 2.6 / 2.7 / 1 | 50.8 / 55.8 / 34.8 | 107.3 / 114.3 | 129 | 0 / 0 / 2 | 9 | 133 | 1 / 0 | 0 | 0 | words: Three buckets | 3 / 2 / 0 |
| retirement/cash-flow | 1.1 / 5.28 / 1 | 57.5 / 70 / 26 | 57.5 / 516.5 | 516.5 | 2 / 2 / 2 | 12 | 108 | 0 / 0 | 0 | 0 | words: Year by year | 3 / 2 / 0 |
| retirement/contributions | 1.2 / 1.86 / 1 | 48.8 / 56.8 / 14.5 | 51 / 94.3 | 94.3 | 5 / 5 / 5 | 4 | 103 | 0 / 0 | 0 | 1 | figure: $18,870 a year into retiremen… | 1 / 4 / 0 |
| retirement/fire | 1 / 1.04 / 1 | 40 / 52.8 / 14.5 | 40 / 52.8 | 171.5 | 0 / 0 / 0 | 3 | 118 | 1 / 0 | 0 | 0 | figure: Ana would need to work until … | 0 / 5 / 0 |
| retirement/healthcare | 1 / 1.23 / 1 | 39 / 45 / 40 | 39 / 50.5 | 81 | 0 / 0 / 2 | 1 | 120 | 1 / 0 | 0 | 0 | words: Before Medicare | 5 / 0 / 0 |
| retirement/historical | 1.7 / 2.17 / 1 | 39.8 / 40.5 / 29.5 | 75.8 / 94.5 | 94.5 | 0 / 0 / 0 | 4 | 111 | 0 / 0 | 0 | 0 | words: If history repeated itself | 2 / 2 / 1 |
| retirement/longevity | 1.4 / 2.95 / 1 | 38.5 / 40 / 26.8 | 54.3 / 118.5 | 118.5 | 0 / 4 / 4 | 5 | 98 | 0 / 0 | 0 | 0 | words: How long might the money need… | 5 / 0 / 0 |
| retirement/medicare | 3.4 / 3.82 / 1 | 57.5 / 63.5 / 36.5 | 249.3 / 279.5 | 309.8 | 0 / 0 / 2 | 8 | 168 | 1 / 0 | 0 | 0 | figure: Medicare at 65 | 5 / 0 / 0 |
| retirement/monte-carlo | 2 / 2.18 / 1 | 37 / 44.5 / 29.5 | 74.3 / 75.5 | 99.8 | 0 / 0 / 1 | 2 | 111 | 1 / 0 | 0 | 0 | words: Chance the money lasts | 2 / 2 / 1 |
| retirement/pensions | 1.9 / 1.99 / 1.91 | 48 / 49.3 / 48 | 84 / 91.3 | 91.3 | 4 / 8 / 8 | 0 | 108 | 0 / 0 | 0 | 0 | words: A pension | 5 / 0 / 0 |
| retirement/projection | 1 / 3.61 / 1 | 33.8 / 54.5 / 31.5 | 33.8 / 196 | 266.8 | 0 / 0 / 7 | 1 | 103 | 2 / 0 | 0 | 0 | words: The money lasts | 1 / 4 / 0 |
| retirement/rmd | 1 / 1 / 1 | 23.3 / 38.3 / 19 | 23.3 / 38.3 | 220.5 | 0 / 0 / 0 | 0 | 75 | 1 / 0 | 0 | 0 | words: Required withdrawals | 4 / 1 / 0 |
| retirement/roth-conversions | 1 / 2.04 / 1 | 20.8 / 71 / 24 | 20.8 / 121.5 | 306 | 0 / 0 / 1 | 0 | 69 | 3 / 0 | 0 | 0 | words: Roth conversions | 2 / 3 / 0 |
| retirement/sequence-risk | 1.1 / 1.16 / 1 | 55.8 / 64.3 / 18.5 | 58 / 66.5 | 66.5 | 0 / 0 / 0 | 5 | 161 | 0 / 0 | 0 | 0 | words: Why the order of returns matt… | 3 / 2 / 0 |
| retirement/social-security | 2 / 2.37 / 1 | 56.8 / 59.5 / 29 | 110.8 / 141.5 | 215.8 | 2 / 4 / 8 | 13 | 133 | 2 / 1 | 0 | 0 | figure: $66,600 a year from Social Se… | 5 / 0 / 0 |
| retirement/withdrawal-order | 2.6 / 2.71 / 1 | 50.8 / 56.3 / 24.3 | 151.5 / 177.5 | 177.5 | 0 / 0 / 0 | 2 | 159 | 0 / 0 | 0 | 0 | words: Your order is the best one fo… | 2 / 3 / 0 |
| retirement/withdrawal-strategy | 1.7 / 2.05 / 1 | 45.8 / 65.8 / 24.3 | 89.5 / 111.5 | 307.8 | 0 / 0 / 0 | 4 | 139 | 1 / 0 | 0 | 0 | words: How much to take out each year | 2 / 2 / 1 |
| scenarios/advisor-plan | 2.7 / 2.98 / 1 | 46.8 / 47 / 43 | 125.8 / 138 | 138 | 4 / 16 / 16 | 0 | 106 | 0 / 0 | 0 | 0 | words: Check an advisor's plan | 3 / 2 / 0 |
| scenarios/compare | 1 / 1.01 / 1 | 30 / 32.3 / 19 | 30 / 32.3 | 32.3 | 0 / 0 / 0 | 2 | 76 | 0 / 0 | 1 | 1 | words: Compare what-ifs | 3 / 2 / 0 |
| scenarios/goal-seek | 1 / 3.24 / 1 | 22.5 / 51.3 / 24.3 | 22.5 / 168 | 227 | 1 / 1 / 1 | 0 | 80 | 1 / 0 | 2 | 0 | words: Your plan works if markets ar… | 2 / 3 / 0 |
| scenarios/sensitivity | 2.5 / 2.99 / 1 | 45.5 / 49.3 / 23 | 109 / 128.5 | 157.5 | 0 / 0 / 0 | 5 | 132 | 1 / 0 | 1 | 0 | words: Inflation moves your plan the… | 3 / 2 / 0 |
| scenarios/stress-tests | 1.8 / 7.64 / 1 | 32.8 / 39.5 / 22.8 | 52.5 / 316.5 | 496.5 | 0 / 0 / 0 | 0 | 107 | 11 / 10 | 1 | 0 | figure: Your plan survives 9 of 12 sh… | 3 / 2 / 0 |
| system/assumptions | 2.6 / 2.63 / 2.63 | 42.8 / 42.8 / 42.8 | 143.3 / 143.3 | 262.3 | 2 / 10 / 10 | 5 | 93 | 1 / 0 | 0 | 0 | words: Assumptions | 5 / 0 / 0 |
| system/help | 3.8 / 3.79 / 3.74 | 47 / 48.5 / 48.5 | 115.5 / 116 | 1312.8 | 0 / 1 / 1 | 0 | 146 | 25 / 0 | 0 | 0 | words: How this app works | 5 / 0 / 0 |
| system/settings | 2.3 / 2.28 / 2.23 | 32.5 / 32.5 / 32.5 | 70.8 / 73 | 564 | 3 / 3 / 11 | 0 | 66 | 22 / 0 | 0 | 0 | none:  | 0 / 5 / 0 |
| taxes/brackets | 2.7 / 2.72 / 1.39 | 53.5 / 58.3 / 49.5 | 154.8 / 161.3 | 161.3 | 0 / 1 / 1 | 15 | 113 | 0 / 0 | 1 | 0 | figure: You are in the 22% bracket | 5 / 0 / 0 |
| taxes/capital-gains | 3 / 3.03 / 2.04 | 63.5 / 66.3 / 68 | 194.8 / 194.8 | 194.8 | 0 / 6 / 6 | 17 | 148 | 0 / 0 | 1 | 0 | words: Tax on what you sell | 5 / 0 / 0 |
| taxes/documents † | 1.9 / 2.56 / 1.5 | 43.8 / 44.3 / 43.8 | 81.3 / 114.5 | 125.3 | 0 / 0 / 2 | 0 | 124 | 1 / 0 | 0 | 0 | words: Tax papers for 2026 | 5 / 0 / 0 |
| taxes/estimated | 2.8 / 3.19 / 1 | 56.5 / 64.3 / 16.5 | 163 / 192.8 | 192.8 | 0 / 6 / 6 | 14 | 132 | 0 / 1 | 0 | 0 | figure: Raise your withholding: about… | 4 / 1 / 0 |
| taxes/federal | 3.2 / 3.27 / 1.34 | 61 / 64 / 50.5 | 183.8 / 203 | 380.5 | 0 / 0 / 19 | 14 | 154 | 3 / 0 | 0 | 0 | figure: About $14,723 of federal tax … | 2 / 3 / 0 |
| taxes/filing-status † | 1 / 1.25 / 1 | 38.3 / 49.8 / 11 | 38.3 / 56 | 56 | 0 / 0 / 0 | 3 | 105 | 0 / 0 | 0 | 0 | none:  | 5 / 0 / 0 |
| taxes/hsa-fsa | 2.5 / 2.84 / 2.53 | 52.8 / 53.8 / 52.8 | 150.5 / 169.8 | 169.8 | 0 / 7 / 7 | 7 | 151 | 1 / 1 | 0 | 0 | words: Health savings and flexible s… | 5 / 0 / 0 |
| taxes/projection | 4.9 / 5.56 / 1 | 50 / 54.3 / 20.8 | 407.5 / 516.5 | 516.5 | 0 / 1 / 1 | 8 | 143 | 0 / 0 | 0 | 0 | figure: About $105,083 of federal tax… | 3 / 2 / 0 |
| taxes/self-employment † | 1 / 1.58 / 1 | 19.3 / 58.8 / 18.5 | 19.3 / 89.8 | 101 | 0 / 0 / 1 | 0 | 63 | 1 / 0 | 0 | 0 | bare figure: $15,898 | 2 / 3 / 0 |
| taxes/state † | 1.3 / 1.32 / 1 | 46 / 53.5 / 13.8 | 52.5 / 60 | 145.5 | 0 / 0 / 6 | 9 | 114 | 2 / 0 | 0 | 0 | bare figure: $356 | 5 / 0 / 0 |
| taxes/withholding | 2.2 / 2.61 / 1.16 | 46.8 / 61.8 / 54.3 | 118.3 / 157 | 157 | 0 / 4 / 4 | 7 | 141 | 0 / 1 | 0 | 0 | figure: You would likely owe about $5… | 0 / 5 / 0 |
| transactions/categories | 2.8 / 2.83 / 2.83 | 25.8 / 25.8 / 25.8 | 62.5 / 62.5 | 62.5 | 0 / 0 / 0 | 0 | 77 | 0 / 0 | 0 | 1 | words: Categories | 5 / 0 / 0 |
| transactions/categorize | 1 / 1 / 1 | 11.8 / 11.8 / 11 | 11.8 / 11.8 | 11.8 | 0 / 0 / 0 | 0 | 37 | 0 / 0 | 0 | 0 | words: Categorize | 0 / 5 / 0 |
| transactions/duplicates | 1 / 1 / 1 | 6 / 6 / 5.3 | 6 / 6 | 6 | 0 / 0 / 0 | 0 | 18 | 0 / 0 | 0 | 0 | words: No duplicates | 5 / 0 / 0 |
| transactions/import | 1.2 / 1.24 / 1 | 36.3 / 36.3 / 32 | 42.8 / 42.8 | 42.8 | 2 / 2 / 2 | 0 | 85 | 0 / 0 | 0 | 0 | words: Import a bank file | 4 / 1 / 0 |
| transactions/ledger | 1 / 1 / 1 | 18 / 18 / 15.5 | 18 / 18 | 18 | 0 / 0 / 0 | 0 | 54 | 0 / 0 | 0 | 0 | words: Your transactions | 0 / 5 / 0 |
| transactions/reconcile | 1 / 1 / 1 | 15.3 / 15.3 / 14.5 | 15.3 / 15.3 | 15.3 | 0 / 0 / 0 | 0 | 51 | 0 / 0 | 0 | 0 | words: Check a statement | 0 / 5 / 0 |
| transactions/rules | 1.1 / 1.14 / 1.14 | 41 / 41 / 41 | 43.3 / 43.3 | 43.3 | 5 / 5 / 5 | 0 | 72 | 0 / 0 | 0 | 0 | words: Rules | 0 / 5 / 0 |
| transactions/transfers | 1 / 1 / 1 | 14.5 / 14.5 / 13.8 | 14.5 / 14.5 | 14.5 | 0 / 0 / 0 | 0 | 48 | 0 / 0 | 0 | 0 | words: Transfers | 5 / 0 / 0 |

## 14. claude-a's 13 pages (not ours to edit: these lines are for the hand-over)

| page | first-view load (most, for) | page load (most) | screens (most) | boxes showing (most) | folds shut / open (most) | chip rows | openers | filled on first screen (households 0 / 1 / 2+) | leads with (richest) | in the lists above |
|---|---|---|---|---|---|---|---|---|---|---|
| goals/emergency-fund | 49.8 (retired) | 73.8 | 1.75 | 0 | 0 / 0 | 0 | 0 | 2 / 3 / 0 | bare figure: $4,200 |  |
| goals/vehicle | 69 (family) | 132 | 2.54 | 8 | 1 / 1 | 0 | 0 | 5 / 0 / 0 | words: The next car | first views #8; opens a fold open; boxes, no optional part |
| goals/travel | 38 (family) | 64.3 | 1.73 | 9 | 0 / 0 | 1 | 0 | 5 / 0 / 0 | words: Trips and big days |  |
| goals/charitable | 67 (family) | 118.8 | 2.05 | 3 | 0 / 1 | 0 | 0 | 5 / 0 / 0 | words: Giving | first views #11; opens a fold open |
| debt/student-loans | 19 (family) | 19 | 1 | 0 | 0 / 0 | 0 | 0 | 0 / 5 / 0 | words: Student loans |  |
| debt/consolidation | 80.3 (renter) | 84.8 | 1.25 | 0 | 2 / 0 | 0 | 0 | 2 / 3 / 0 | bare figure: $9,800 | first views #1 |
| taxes/state | 53.5 (renter) | 60 | 1.32 | 0 | 2 / 0 | 0 | 0 | 5 / 0 / 0 | bare figure: $356 |  |
| taxes/self-employment | 58.8 (family) | 89.8 | 1.58 | 0 | 1 / 0 | 0 | 0 | 2 / 3 / 0 | bare figure: $15,898 | first views #34 |
| taxes/filing-status | 49.8 (family) | 56 | 1.25 | 0 | 0 / 0 | 0 | 0 | 5 / 0 / 0 | none:  |  |
| taxes/documents | 44.3 (renter) | 114.5 | 2.56 | 0 | 1 / 0 | 0 | 0 | 5 / 0 / 0 | words: Tax papers for 2026 |  |
| balance/projection | 48.8 (retired) | 129 | 2.54 | 0 | 1 / 0 | 0 | 0 | 3 / 2 / 0 | bare figure: $287,100 |  |
| balance/statement | 48.8 (renter) | 191.3 | 2.99 | 0 | 0 / 0 | 0 | 0 | 0 / 5 / 0 | bare words: Balance sheet | pages #20 |
| cashflow/statement | 43 (midsetup) | 86.5 | 1.93 | 0 | 0 / 0 | 0 | 0 | 0 / 5 / 0 | bare words: Cash-flow statement |  |

## 15. The 40 screenshots (the first screen, 390x844 at 2x, of the heaviest first views)

Folder: $SP/opt/shots

| # | file | page | household | first-view load |
|---|---|---|---|---|
| 1 | 01-debt-consolidation--renter.png | debt/consolidation (Consolidation) | renter | 80.3 |
| 2 | 02-cashflow-budget-percent--renter.png | cashflow/budget-percent (Budget (50/30/20)) | renter | 78.8 |
| 3 | 03-career-benefits--renter.png | career/benefits (Work benefits) | renter | 78.3 |
| 4 | 04-debt-credit-cards--family.png | debt/credit-cards (Credit cards) | family | 75.8 |
| 5 | 05-insurance-disability--family.png | insurance/disability (Disability) | family | 74.8 |
| 6 | 06-retirement-roth-conversions--family.png | retirement/roth-conversions (Roth conversions) | family | 71 |
| 7 | 07-retirement-cash-flow--family.png | retirement/cash-flow (Year by year) | family | 70 |
| 8 | 08-goals-vehicle--family.png | goals/vehicle (Vehicle) | family | 69 |
| 9 | 09-investments-limits--retired.png | investments/limits (Contribution limits) | retired | 68 |
| 10 | 10-overview-quick--family.png | overview/quick (Quick answers) | family | 67.5 |
| 11 | 11-goals-charitable--family.png | goals/charitable (Giving) | family | 67 |
| 12 | 12-overview-alerts--family.png | overview/alerts (Needs attention) | family | 67 |
| 13 | 13-taxes-capital-gains--family.png | taxes/capital-gains (Capital gains) | family | 66.3 |
| 14 | 14-investments-risk--family.png | investments/risk (Risk) | family | 65.8 |
| 15 | 15-retirement-withdrawal-strategy--family.png | retirement/withdrawal-strategy (How much to take out) | family | 65.8 |
| 16 | 16-taxes-estimated--family.png | taxes/estimated (Estimated payments) | family | 64.3 |
| 17 | 17-retirement-sequence-risk--family.png | retirement/sequence-risk (Order of returns) | family | 64.3 |
| 18 | 18-balance-liabilities--family.png | balance/liabilities (Debts) | family | 64.3 |
| 19 | 19-taxes-federal--retired.png | taxes/federal (Federal estimate) | retired | 64 |
| 20 | 20-goals-prioritizer--family.png | goals/prioritizer (Goal prioritizer) | family | 63.8 |
| 21 | 21-retirement-medicare--renter.png | retirement/medicare (Medicare and IRMAA) | renter | 63.5 |
| 22 | 22-goals-house--family.png | goals/house (House down payment) | family | 63 |
| 23 | 23-insurance-life-needs--retired.png | insurance/life-needs (Life insurance needs) | retired | 62 |
| 24 | 24-taxes-withholding--family.png | taxes/withholding (Withholding check) | family | 61.8 |
| 25 | 25-debt-payoff--renter.png | debt/payoff (Pay off debts) | renter | 61.8 |
| 26 | 26-overview-guide--family.png | overview/guide (Step by step) | family | 60.8 |
| 27 | 27-career-human-capital--family.png | career/human-capital (Human capital) | family | 60.8 |
| 28 | 28-property-renovation--family.png | property/renovation (Renovation) | family | 59.8 |
| 29 | 29-retirement-social-security--family.png | retirement/social-security (Social Security) | family | 59.5 |
| 30 | 30-cashflow-paycheck--family.png | cashflow/paycheck (Paycheck) | family | 59.5 |
| 31 | 31-goals-education--midsetup.png | goals/education (Education (529)) | midsetup | 59.5 |
| 32 | 32-estate-estate-tax--family.png | estate/estate-tax (Estate tax) | family | 58.8 |
| 33 | 33-overview-next-best-action--renter.png | overview/next-best-action (Next best action) | renter | 58.8 |
| 34 | 34-taxes-self-employment--family.png | taxes/self-employment (Self-employment) | family | 58.8 |
| 35 | 35-reports-tax--retired.png | reports/tax (Tax report) | retired | 58.3 |
| 36 | 36-taxes-brackets--freelancer.png | taxes/brackets (Bracket explorer) | freelancer | 58.3 |
| 37 | 37-cashflow-income--family.png | cashflow/income (Income) | family | 58 |
| 38 | 38-investments-backtest--family.png | investments/backtest (Backtest) | family | 57.8 |
| 39 | 39-property-purchase--family.png | property/purchase (Big purchase planner) | family | 57.8 |
| 40 | 40-property-rent-vs-buy--family.png | property/rent-vs-buy (Rent vs buy) | family | 57.5 |
