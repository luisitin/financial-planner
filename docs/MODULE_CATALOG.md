# Module catalog: every page, existing and planned

Status: **usable** (works), **stub** (exists, minimal), **planned** (placeholder page). Phase: the build
phase from `core/phases.js` / `ROADMAP.md` in which the page gets built.
Keys are `group/id`; the folder is `modules/<group>/<id>/`. Adding a page means adding a row
here (`npm run check` insists). "Seeds" points at `docs/RESOURCES.md` / `vendor/`.

When starting a planned page, copy `modules/_template`, then read the seed project first.

## overview
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `overview/dashboard` | Dashboard | usable | 0 | Welcomes you with start-here actions, the setup steps still to do and a look at what is coming next. | - |
| `overview/pages` | All pages | usable | 0 | Lets you search every page in the app and see which ones work today and which build phase the rest belong to. | - |
| `overview/alerts` | Needs attention | usable | 2 | One list of what needs your attention, worst first, each opening the page where it is fixed. | Firefly III bills/rules |
| `overview/next-best-action` | Next best action | usable | 9 | Tells you what to do with your next spare dollar, following the well-known order: employer match, high-interest debt, emergency fund, retirement, then the rest. | r/pf wiki, Bogleheads |
| `overview/benchmarks` | How am I doing | usable | 9 | Your net worth against families of your age, your retirement savings against the usual guideline for your age, and the rules of thumb for saving, cash, housing and debt. | Fed SCF 2025, Fidelity |
| `overview/health-score` | Plan health score | usable | 9 | Your whole plan as one score from 0 to 100: cash cushion, saving, debt, retirement, protection, goals and how complete it is, with where the missing points are. | - |
| `overview/timeline` | Life timeline | usable | 9 | Every moment from today to the end of your plan that changes your money: retiring, Social Security, Medicare, the last mortgage payment, children growing up, and whether the savings last. | - |
| `overview/monthly-review` | Monthly review | usable | 9 | Walks you through the month in ten minutes: fresh balances, the bank files, spending against the budget, the change in net worth, goals and what needs attention, then marks it reviewed with a note. | - |

## household
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `household/people` | People | usable | 2 | You, your partner and anyone who depends on you, with the ages the whole plan is built on. | - |
| `household/life-events` | Life events | planned | 10 | Guides you through marriage, a baby, a job change, a move, an inheritance or divorce and proposes the plan changes each brings. | - |
| `household/documents` | Document vault index | planned | 10 | Keeps track of where your will, insurance policies, deeds and tax returns are kept (the locations, not the files themselves). | - |
| `household/contacts` | Contacts | planned | 10 | Lists your advisor, accountant, attorney and insurers, plus the last four digits of each account number. | - |
| `household/calendar` | Money calendar | planned | 10 | Puts your bills, paydays, tax deadlines, open enrolment, required minimum distribution dates and policy renewals on one calendar. | - |

## balance
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `balance/net-worth` | Net worth | usable | 0 | Shows your accounts and totals, how liquid they are, which tax bucket each sits in and your net worth history. | Maybe |
| `balance/accounts` | Account detail | planned | 3 | Shows each account's balance history, lets you reconcile it against statements and keep notes on it. | Actual |
| `balance/liquidity` | Emergency fund | usable | 2 | How many months of bills your cash covers, and whether your emergency fund is big enough. | - |
| `balance/assets` | Asset register | planned | 10 | Lists your property, vehicles and valuables with what you paid, how they lose value and which policy insures each. | - |
| `balance/liabilities` | Debts | usable | 2 | Every loan and card with its rate and payment: what interest costs you and when each one is gone. | - |
| `balance/projection` | Net worth projection | planned | 5 | Projects your net worth 1 to 40 years ahead from your cash flow, investment returns and debt payoff. | TPAW |
| `balance/statement` | Balance sheet | planned | 9 | Produces a formal, printable balance sheet split by owner and by how quickly each item can be turned into cash. | - |

## cashflow
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `cashflow/income` | Income | usable | 2 | Every source of money coming in, on a monthly footing whatever the pay schedule. | - |
| `cashflow/expenses` | Expenses | usable | 2 | Your regular spending by category, split into what you must pay and what is nice to have. | - |
| `cashflow/income-statement` | Income statement | usable | 3 | What came in, what went out and what you kept, month by month, from your real transactions. | Firefly reports |
| `cashflow/budget` | Budget | usable | 4 | An envelope for each kind of spending: what is spent so far this month, what is left, and whether the pace is right. | Actual loot-core |
| `cashflow/budget-percent` | Budget (50/30/20) | planned | 4 | Splits your income into needs, wants and savings using the 50/30/20 rule or your own percentages. | - |
| `cashflow/recurring` | Bills and regular payments | usable | 4 | The payments that come back every week, month or year, when the next one is due, and which look missed. | Actual schedules |
| `cashflow/forecast` | Cash-flow forecast | usable | 4 | Where your everyday cash is heading over the next three months, day by day, and whether a shortfall is coming. | Actual |
| `cashflow/sinking-funds` | Irregular expenses | usable | 4 | Yearly and one-time costs turned into a monthly amount to set aside so the money is there when the bill lands. | - |
| `cashflow/paycheck` | Paycheck | planned | 4 | Follows your paycheck from gross to net: withholding, Social Security and Medicare taxes, pre-tax deductions and employer match. | taxes/* |
| `cashflow/subscriptions` | Subscriptions | usable | 4 | Every charge that renews by itself, what it costs you a year, and the ones to question. | - |
| `cashflow/spending` | Where the money goes | usable | 3 | Spending by category and by payee for a month, against the month before. | - |
| `cashflow/statement` | Cash-flow statement | planned | 4 | Produces a printable cash-flow statement that splits your money movements into operating, investing and financing. | - |

## transactions
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `transactions/ledger` | Ledger | usable | 3 | Every transaction in one list you can filter, search and correct. | Tabulator, Actual |
| `transactions/import` | Import | usable | 3 | Bring in the file your bank or card lets you download (CSV); columns are worked out, duplicates skipped, rules applied. | Papa Parse, banking.js, Actual importers |
| `transactions/rules` | Rules | usable | 3 | The rules that file transactions for you: when the description contains this, give it that category. | Actual rules |
| `transactions/categorize` | Categorise | usable | 3 | File the transactions that have no category yet, one payee at a time, with suggestions. | ai/* |
| `transactions/statements` | Statement reader | usable | 3 | No bank file? Give the plan the statement itself, as a PDF or a picture; the PC reads the rows for you to check. | pdf.js |
| `transactions/reconcile` | Reconcile | planned | 3 | Compares a statement's ending balance with your ledger and helps you find what explains any gap. | - |
| `transactions/transfers` | Transfers | usable | 3 | Link money moved between your own accounts so it is not counted as spending or income. | Actual |
| `transactions/categories` | Categories | usable | 3 | The categories transactions are filed under: rename, hide, or add your own. | - |
| `transactions/duplicates` | Duplicates | usable | 3 | Find lines that were imported twice and remove the copy. | - |
| `transactions/connect` | Bank connections | planned | 3 | Connects your bank accounts through SimpleFIN or Plaid so transactions sync automatically through the server on your PC. | SimpleFIN |

## debt
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `debt/payoff` | Pay off debts | usable | 4 | One plan for every loan and card: the same money each month, highest rate or smallest balance first, and the date each one is gone. | core/math amortization |
| `debt/mortgage` | Mortgage | usable | 4 | Your mortgage's schedule, and what extra payments, paying every two weeks or a recast would save. | - |
| `debt/refinance` | Refinance | usable | 4 | Whether a refinance offer pays: the new payment, when the closing costs are earned back, and the interest either way. | - |
| `debt/student-loans` | Student loans | planned | 4 | Compares standard and income-driven student loan repayment plans and shows when forgiveness could arrive. | - |
| `debt/credit-cards` | Credit cards | usable | 4 | How much of your card limits you use, what paying the minimum really costs, and whether a balance transfer helps. | - |
| `debt/ratios` | What lenders see | usable | 4 | Debt-to-income, housing and card-use ratios with the lines lenders draw, so you know what an application looks like. | - |
| `debt/consolidation` | Consolidation | planned | 4 | Compares taking one consolidation loan against keeping the debts you have now. | - |

## goals
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `goals/goals` | Goals | usable | 2 | What you are saving for, by when, and what to put aside each month to get there. | Firefly piggy banks |
| `goals/emergency-fund` | Emergency fund | planned | 2 | Sets your emergency fund target in months of essential expenses and suggests where to keep the money. | - |
| `goals/house` | House down payment | planned | 4 | Works out your house savings target from the price, down payment percentage and closing costs, and when you will reach it. | property/* |
| `goals/education` | Education (529) | planned | 4 | Plans 529 college plan contributions, allowing for tuition inflation and your state's tax deduction. | - |
| `goals/vehicle` | Vehicle | planned | 4 | Helps you decide whether to save up for your next vehicle or finance it, and on what timeline. | property/vehicles |
| `goals/travel` | Travel and events | planned | 4 | Turns trips, a wedding and other milestones into goals you fund month by month. | - |
| `goals/charitable` | Giving | planned | 4 | Plans your charitable giving, works out the numbers on a donor-advised fund and shows the effect on your taxes. | taxes/* |
| `goals/prioritizer` | Goal prioritiser | planned | 4 | Splits your monthly surplus across your goals according to their priority and deadline. | - |

## retirement
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `retirement/projection` | Will the money last? | usable | 5 | Your plan run year by year to the end: what you have, add, receive and spend, and whether the money lasts. | TPAW |
| `retirement/contributions` | Retirement contributions | usable | 5 | What goes into 401(k)s, IRAs, Roths and HSAs each year, with the employer match and this year's limits. | - |
| `retirement/social-security` | Social Security | usable | 5 | Your benefit from your ssa.gov earnings record or your statement, and what claiming at each age pays. | ssa.tools, Open Social Security |
| `retirement/pensions` | Pensions | usable | 5 | Your pension: what it pays and what inflation does to it, a lump sum against monthly payments, and the survivor option, with your own life expectancy. | - |
| `retirement/annuities` | Annuities | usable | 5 | An annuity quote against your plan: the return it pays like over your likely lifetime, what bonds paying the same would cost, and what buying it does to your plan. | - |
| `retirement/cash-flow` | Year by year | usable | 5 | Every year of the plan in one table: ages, what comes in, what goes out, what is taken from where, what is left. | Bogleheads RPM |
| `retirement/withdrawal-strategy` | How much to take out | usable | 5 | Four ways of deciding what to withdraw each year, compared on your numbers and through the worst stretch of history. | FI Calc |
| `retirement/withdrawal-order` | Withdrawal order | usable | 6 | Which account to draw from first (taxable, pre-tax or Roth) and what each order costs in lifetime tax and spending. | Owl |
| `retirement/roth-conversions` | Roth conversions | usable | 6 | Fills a bracket with Roth conversions in the years before required withdrawals and shows what that does to lifetime tax and spending. | Owl, RPM |
| `retirement/rmd` | Required withdrawals | usable | 5 | When the tax rules make you take money out of pre-tax accounts, and how big those withdrawals look. | IRS Pub 590-B |
| `retirement/monte-carlo` | Chance the money lasts | usable | 5 | The plan run thousands of times with returns drawn at random: the share of runs where the money lasts, and the range. | core/math/montecarlo, TPAW |
| `retirement/historical` | If history repeated | usable | 5 | Your plan replayed from every start year since 1928 with the real returns and inflation of those years. | cFIREsim, Shiller |
| `retirement/sequence-risk` | Order of returns | usable | 5 | Why bad years early in retirement hurt most: the same years of returns in three orders, on your plan. | - |
| `retirement/healthcare` | Healthcare before 65 | usable | 5 | Health cover between retiring and Medicare: the marketplace credit on your plan's own income, what is left to pay, and the cliff where the credit stops. | Rev. Proc. 2025-25 |
| `retirement/medicare` | Medicare and IRMAA | usable | 5 | When to sign up for Medicare, what it costs over retirement, and the income surcharge (IRMAA) year by year from your plan's own income. | CMS 2026 |
| `retirement/longevity` | How long to plan for | usable | 5 | The chance of reaching each age, for each of you and for at least one of a couple, and the age the plan should run to. | SSA life table |
| `retirement/fire` | Financial independence | usable | 5 | The pot that could pay for your life without a paycheck, how far you are, and the years to get there at your pace. | FI Calc |
| `retirement/buckets` | Bucket strategy | usable | 5 | Cash, bond and stock buckets sized in years of your plan's own withdrawals, and the stock share they leave against your plan's. | - |

## investments
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `investments/holdings` | Holdings | usable | 7 | What you hold in each investment account, what it is worth and what you paid; type it in or import the brokerage's positions file. | Ghostfolio, Maybe |
| `investments/allocation` | Allocation | usable | 7 | Your mix by asset class across every account against the mix you aim for, and how far each class has drifted. | Ghostfolio |
| `investments/rebalance` | Rebalance | usable | 7 | The trades that bring your mix back to its target: new money first, then sells where they cost no tax and buys with the cash freed. | - |
| `investments/fees` | Fees | usable | 7 | What your funds and any advisor charge each year and what that costs over a lifetime. | - |
| `investments/performance` | Performance | usable | 7 | Your true return from the balance points you save: what the investments earned and what you earned, against the plan and an index mix. | Portfolio Performance |
| `investments/dividends` | Dividends | usable | 7 | The dividends and interest your holdings pay each year, by fund and by account, and what they cover of your spending. | Ghostfolio |
| `investments/asset-location` | Asset location | usable | 7 | Which investments belong in which kind of account to keep the yearly tax bill down, the drag today, and the swaps that fix it. | Bogleheads wiki |
| `investments/glide-path` | Glide path | usable | 7 | How much of your money should be in stocks at each age: the plan's path, the rules of thumb, and where you stand today. | TPAW |
| `investments/risk` | Risk | usable | 7 | How rough the ride of your mix is: the worst year and deepest fall history has dealt a mix like yours, in your own dollars. | Simba data |
| `investments/backtest` | Backtest | usable | 7 | Any stocks-and-bonds mix run through the years since 1871, side by side with another: growth, the worst years, the deepest fall. | Simba, Shiller |
| `investments/tax-lots` | Tax lots and harvesting | usable | 7 | The gain or loss on each lot you hold, the losses worth harvesting in taxable accounts, and the order to sell in when you need cash. | - |
| `investments/employer-stock` | Employer stock | planned | 7 | Shows how much of your wealth is in your employer's stock, when your employer stock plans vest and the risk that carries. | career/equity |
| `investments/crypto` | Crypto | planned | 7 | Tracks your crypto holdings and what you paid for them, with a clear flag on how volatile they are. | - |
| `investments/limits` | Contribution limits | usable | 7 | This year's limits for 401(k)s, IRAs, HSAs, FSAs and 529 gifts against what is going in, the room left, the Roth income check and the deadlines. | - |

## taxes
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `taxes/federal` | Federal estimate | usable | 6 | This year's federal income tax from what the plan knows and what you type: the bill or refund, your effective and marginal rates. | UsTaxes, PolicyEngine |
| `taxes/state` | State | planned | 6 | Estimates your state income tax, starting with the state you live in. | PolicyEngine |
| `taxes/withholding` | Withholding check | usable | 6 | Whether your paychecks are taking out enough federal tax: the refund or bill in April, and the W-4 change that fixes it. | - |
| `taxes/capital-gains` | Capital gains | usable | 6 | Tax on what you sell this year: short against long, the 0/15/20% bands, the loss allowance, and how much gain still fits at 0%. | - |
| `taxes/brackets` | Bracket explorer | usable | 6 | Which bracket your next dollar lands in, how much room is left before the next rate, and what a raise, bonus or conversion would really cost. | - |
| `taxes/estimated` | Estimated payments | usable | 6 | Quarterly estimated payments: the safe-harbour amount, what is due each quarter and when, and where you stand today. | - |
| `taxes/self-employment` | Self-employment | planned | 6 | Works out self-employment tax, the small-business deduction and other deductions on your side income. | - |
| `taxes/projection` | Tax, year by year | usable | 6 | Federal tax in every year of the retirement plan through the real brackets: the totals, the worst years, and how the flat setting compares. | Owl |
| `taxes/filing-status` | Filing status compare | planned | 6 | Compares filing jointly, filing separately or as head of household to see which costs you least. | - |
| `taxes/documents` | Tax documents checklist | planned | 6 | Lists the tax documents you need to collect each year and where each one comes from. | - |
| `taxes/hsa-fsa` | HSA and FSA | usable | 6 | The health savings account: its limit, the room left, the tax it saves, what it grows into; and the FSA use-it-or-lose-it deadline. | - |

## insurance
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `insurance/policies` | Policies | usable | 8 | Every policy on one list: what it pays, what it costs a year, whom it covers, when it ends or renews, and what deserves a second look. | - |
| `insurance/life-needs` | Life insurance needs | usable | 8 | How much life insurance each of you needs, from your own plan and by the two usual rules of thumb, against the cover you have. | SSA survivors, family maximum, earnings test |
| `insurance/term-vs-permanent` | Term vs permanent | usable | 8 | Whole life against buying term and investing the difference, with the illustration's own numbers: which is ahead, and the return that decides it. | - |
| `insurance/cash-value` | Cash-value model | usable | 8 | A whole or universal life policy you own, as an investment: what it has really earned, what cashing in leaves after tax, and whether to keep it. | IRC 72(e) |
| `insurance/disability` | Disability | usable | 8 | If you could not work: what your cover would pay against your pay, whether the bills would still get paid, and whether your cash lasts until the money starts. | IRS Pub 525, SSA 05-10029 |
| `insurance/health` | Health plan compare | usable | 8 | The health plans you can choose from, on what each really costs a year: premiums plus your share of the bills, less HSA money and tax savings, in a quiet, usual and bad year. | Rev. Proc. 2025-19 |
| `insurance/ltc` | Long-term care | usable | 8 | The odds you will need care in later life, what it costs, and whether your plan could pay for it or a policy would help. | CareScout 2024 medians, ACL odds |
| `insurance/property` | Auto, home, umbrella | usable | 8 | Whether your home, car and umbrella cover is enough for what you own: the cost to rebuild, the liability limits against your net worth, and the deductibles against your cash. | 11 USC 522(n), III umbrella costs |

## estate
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `estate/documents` | Documents checklist | usable | 8 | Your will, powers of attorney and health papers: which are signed, where they are kept, and which to look at again. | - |
| `estate/beneficiaries` | Beneficiary audit | usable | 8 | Who is named on every retirement account, life policy and payable-on-death account, and what to fix: no one named, no backup, a child named directly. | ERISA spousal rule |
| `estate/legacy` | Legacy goals | usable | 8 | What you want to leave and to whom, the amount your plan should keep for it, and what would get it there. | TPAW legacy |
| `estate/estate-tax` | Estate tax | usable | 8 | Whether your estate could owe federal or state estate tax, at each death for a couple and at the end of the plan, and how much of the exemption is left. | IRC 2001, 2010, 2056 |
| `estate/gifting` | Gifting | usable | 8 | Gifts within the yearly tax-free amount, what needs a gift tax return, and front-loading a 529 college plan with five years of gifts at once. | IRC 2001(c), 2503, 529(c) |
| `estate/inheritance` | Expected inheritance | usable | 8 | An inheritance you might receive, as a what-if beside your plan: what it would change if it came, and if it came smaller or later. | scenarios/* |
| `estate/digital` | Digital assets | usable | 8 | Your email, password manager, photos and crypto: who could get into each if something happened to you. Never the passwords themselves. | - |

## property
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `property/home` | Home | planned | 10 | Tracks your home's value, your equity in it, what it costs to keep and how much you expect it to appreciate. | - |
| `property/rent-vs-buy` | Rent vs buy | usable | 10 | Renting against buying the same home: who comes out ahead after the years you stay, the year buying pulls ahead, and the rent at which they are even. | - |
| `property/rental` | Rental analysis | planned | 10 | Works out a rental property's yield, cash return, whether rent covers the loan, vacancy allowance and depreciation. | - |
| `property/vehicles` | Vehicles | planned | 10 | Works out what each vehicle really costs to own and whether to lease, buy or keep the one you have. | - |
| `property/purchase` | Big purchase planner | planned | 10 | Helps you plan any big purchase: whether to save up or finance it, and what it does to your other goals. | - |
| `property/renovation` | Renovation | planned | 10 | Weighs a renovation's cost against the value it adds to your home and how you would pay for it. | - |

## career
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `career/salary` | Salary and raises | planned | 10 | Maps out how your salary could grow with raises and promotions, shown in today's dollars. | - |
| `career/equity` | Equity compensation | planned | 10 | Tracks your employer stock plans: vesting and purchase schedules, the taxes they trigger and how concentrated you are. | - |
| `career/side-income` | Side income | planned | 10 | Models irregular income from gigs, freelance work and a small business so your plan can count on it sensibly. | - |
| `career/business` | Small business | planned | 10 | Tracks your small business's profit and loss, what you pay yourself and your self-employed retirement plans. | taxes/self-employment |
| `career/offer-compare` | Job offer compare | planned | 10 | Compares job offers on total compensation, including benefits and equity, not just salary. | - |
| `career/benefits` | Benefits elections | planned | 10 | Helps you choose at open enrolment: your 401k percentage, health savings account, employer stock plan and insurance picks. | - |
| `career/human-capital` | Human capital | planned | 10 | Puts a value on all the money you are still going to earn, which is what your insurance needs are based on. | - |

## scenarios
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `scenarios/compare` | Scenario compare | usable | 8 | Copies of your plan with a few things changed, side by side: does the money last, the chance it lasts, what you could spend. | - |
| `scenarios/stress-tests` | Stress tests | usable | 9 | Your plan run through a crash the year you retire, a decade of high prices, a job loss, an illness, losing a partner and a long life: which ones it survives and what would fix the rest. | Damodaran history |
| `scenarios/advisor-plan` | Advisor's plan | usable | 8 | Your advisor's assumptions and fee run through the same engine as your plan: which assumption makes the difference, and what the fee costs. | - |
| `scenarios/goal-seek` | Goal seek | usable | 9 | Set the goal (the money lasts and leaves what you want to leave) and see what each lever would have to be: what you can spend, when you can retire, what to save, the return it needs, when to claim Social Security. | - |
| `scenarios/sensitivity` | Sensitivity | usable | 9 | Which of your numbers matter most: returns, inflation, when you retire, how much you save, Social Security, each nudged down and up, ranked by how much it moves what you can spend. | 2025 Trustees Report |

## reports
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `reports/plan-summary` | Plan summary | usable | 9 | Gives you a printable overview in the style of an advisor's plan: where you stand, goals, protection and next steps. | - |
| `reports/statements` | Financial statements | usable | 9 | Bundles your balance sheet, income statement and cash-flow statement into one printable pack. | - |
| `reports/retirement` | Retirement report | usable | 9 | Pulls your retirement projections, Social Security, withdrawal plan and chance of success into one report. | - |
| `reports/tax` | Tax report | usable | 9 | Reports your tax picture for this year alongside the multi-year projection. | - |
| `reports/annual-review` | Annual review pack | usable | 9 | The year in one pack: net worth from start to end, the money in and out, where it went, the months you reviewed and their notes, the goals, and what next year holds. | - |
| `reports/export` | Export | usable | 9 | Any table in the app as a file a spreadsheet opens: accounts, transactions, income, expenses, debts, goals, holdings, the retirement plan and tax year by year, the life timeline. | - |

## ai
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `ai/assistant` | Ask the plan | usable | 0 | Lets you chat with an AI assistant that has a summary of your plan in front of it. | Maybe assistant |
| `ai/explain` | Explain this page | planned | 10 | Adds a button to every page that sends its numbers to the AI and gets back a plain-language explanation. | - |
| `ai/categorizer` | Categoriser | planned | 3 | Categorises transactions in bulk with the AI, shows how confident it is about each and gives you a table to review. | - |
| `ai/reader` | Document reader | usable | 8 | Paste a pay stub, a statement, a Social Security statement or an advisor's plan: the figures it holds and what each would change, accepted one by one. | pdf.js |
| `ai/critic` | Plan critic | planned | 10 | Asks the AI to list the gaps and risks it sees in your plan, each linked to the page where you can fix it. | - |
| `ai/glossary` | Glossary | planned | 10 | Explains every financial term used in the app in plain words, and lets you search for any of them. | - |
| `ai/notes` | Voice notes | planned | 10 | Turns a voice note into text and proposes entries from it for you to confirm. | - |

## system
| key | title | status | phase | purpose | seeds |
|---|---|---|---|---|---|
| `system/settings` | Settings | usable | 0 | Manages your connections, AI settings, which pages are switched on, data import and export, and the basics of your plan. | - |
| `system/docs` | Docs | usable | 0 | Lets you read every project document (plan, catalog, agent notes, vendor map and more) inside the app on your phone. | - |
| `system/assumptions` | Assumptions | usable | 2 | The ten numbers behind every projection: inflation, growth, retirement age, how long the money must last. | Damodaran, Shiller |
| `system/backups` | Backups | planned | 10 | Lists the backups on your server, shows what changed between them and lets you restore any of them. | - |
| `system/audit` | Change log | planned | 10 | Shows what changed in your data, when it changed and which device made the change. | - |
| `system/devices` | Devices | planned | 1 | Manages the devices allowed into the app: name each one, revoke access or limit a device to read-only viewing. | - |
| `system/diagnostics` | Diagnostics | planned | 10 | Shows on one page whether the server and AI are working, the test results and the versions in use. | - |
| `system/help` | Help | planned | 10 | Explains how the app works, with a help section for every page in it. | - |
