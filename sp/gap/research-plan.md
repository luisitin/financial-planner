# Research: retirement and long-term planning products, merged feature list
Read 2026-11-13. Researcher: web only (no repo edits). Dollar figures change often; re-check before quoting on screen.

## Source key (all read 2026-11-13 unless noted)
- B1 Boldin pricing: https://www.boldin.com/retirement/pricing/ (vendor)
- B2 Boldin release notes (Jul-Oct 2026): https://www.boldin.com/retirement/release-notes/ (vendor)
- B3 Boldin comparison table: https://www.boldin.com/retirement/newretirement-vs-best-retirement-planning/ (COMPETITOR-written, treat as biased; used for prices of others)
- P1 ProjectionLab home: https://projectionlab.com (vendor)
- P2 ProjectionLab changelog: https://projectionlab.com/changelog (vendor, dated versions)
- M1 MaxiFi how it works: https://www.maxifi.com/how-it-works ; M2 MaxiFi pricing: https://www.maxifi.com/pricing (vendor)
- PR Pralana: https://www.pralanaretirementcalculator.com (vendor; prices not on page, see B3)
- FC FIRECalc: https://www.firecalc.com (vendor; data through 1/1/2026, page dated 2026-04-17)
- FI FI Calc: https://ficalc.app (vendor)
- RBD Rich Broke or Dead: https://engaging-data.com/will-money-last/ (vendor; page read only first 100k of 127k chars)
- OSS Open Social Security: https://opensocialsecurity.com (vendor, inputs only) ; review: https://robberger.com/tools/open-social-security/ (search snippet)
- FRP Flexible Retirement Planner: https://www.flexibleretirementplanner.com (vendor marketing page; docs list not opened)
- F1 Fidelity methodology: https://www.fidelity.com/go/guidance/retirement-methodology (vendor; read first 100k of 141k chars)
- K1 Kitces on RightCapital: https://www.kitces.com/blog/rightcapital-financial-planning-software-review-tax-sensitive-decumulation-planning-and-a-collaborative-planning-interface/ (independent, date not checked, may be older)
- IL Income Lab comparison: https://incomelaboratory.com/compare-retirement-income-software/ (COMPETITOR-written)
- S* search-snippet only, NOT opened (lower confidence): cFIREsim https://alistair-marshall.github.io/cFIREsim-open/faq.html ; WealthTrace https://www.thewealthmosaic.com/vendors/wealthtrace ; Empower reviews https://www.financialsamurai.com/personal-capital-retirement-planner-review ; Vanguard https://investor.vanguard.com/calculator-tools/retirement-income-calculator ; T. Rowe (via B3/boldin list); BC CRR on Vanguard calc https://crr.bc.edu/squared-away/how-long-will-retirement-savings-last/

## Not verified / gaps (be honest)
- Vanguard, T. Rowe Price, Empower, WealthTrace, cFIREsim, MoneyGuidePro, eMoney, Holistiplan: I did not open their own feature pages; rows citing them rest on search summaries or competitor pages. Conflicting claims: whether Empower has Monte Carlo (reviews say yes, 1,000 runs and a Recession Simulator; Boldin's page says no), whether Vanguard's calculator is Monte Carlo. Boldin price: $168/yr or $14/mo on its own pricing page (B1); older sources say $144. ProjectionLab Premium: $129/yr per reviews, $109 per one; own page lists no figure. MaxiFi: $149/yr after 14-day trial (M2, vendor). Pralana Gold about $99/yr, Online $129 first year then $99 (B3, competitor).
- Engaging Data: I did not find a "Social Security" calculator there; Open Social Security is a separate free open-source tool (Mike Piper per a review). Engaging Data's tools found: Rich Broke or Dead, FIRE calculator.
- Holistiplan: only known as an advisor tax-return analyzer that reads uploaded tax returns (S* IL pages); not opened.

## How each product lets a person choose depth
- Boldin: free "Basic" then paid PlannerPlus; "Planner Score" nudges completeness; 100+ inputs free vs 250+ paid; adjustable assumptions are paid (B1, B2).
- ProjectionLab: simple milestone-based plan first; advanced editor for changes over time, Advanced Simulation, Tax Analytics, custom plots as opt-in modes (P1, P2).
- MaxiFi: one sustainable-spending number first; optimizers (Roth, Social Security, withdrawal) and Monte Carlo are unlocked extras (M2).
- Pralana: all variables exposed, big manual, "steep learning curve" (B3, competitor); Online adds Metric MRI to show how numbers were derived (PR).
- FIRECalc: three required boxes, everything else under optional headings "Other Income/Spending", "Not Retired?", "Spending Models", "Your Portfolio", "Portfolio Changes", "Investigate" (FC). Best example of simple-by-default, depth-on-request.
- FI Calc: pick a strategy from 13; summary metrics first, then table of every simulation (FI).
- Rich Broke or Dead: 5 core boxes, then optional mortality table, tax, fees, flexibility, extra income/expenses (RBD).
- Open Social Security: 5 questions, then an optional "additional situations" fold (disability, working, mortality, children, discount rate, benefit cuts) (OSS).
- Fidelity: Retirement Score in minutes; fuller analysis lets you change ages, expenses (estimated or by category), income, asset mix, confidence level (F1, B3).
- RightCapital: adjustable "levers" update results live; client can adjust without saving (K1).

## Merged feature list
Tier legend: Free, Free+account, Paid (consumer subscription), One-time (paid once), Adv (advisor-only or via advisor). Depth: 1 = a single box or toggle, 2 = a few options, 3 = deep modeling.
Flags: [LOGIN] needs bank or brokerage connection; [ADVICE] licensed advice or advisor service; [FEED] paid data feed; [TRADE] trading. Everything unflagged can be done with typed-in numbers and no connection.

### A. Getting started, depth control, plan building
| # | Feature (plain words) | What it does for a household | Products (tier) | Depth | Sources |
|---|---|---|---|---|---|
| 1 | Quick "am I on track" score from a few answers | Gives a first answer in minutes, no detail needed | Fidelity Retirement Score (Free); T. Rowe, Vanguard calculators (Free) | 1 | F1, B3, S* |
| 2 | Three-box calculator (spending, savings, years) | Tests one idea fast with defaults for everything else | FIRECalc (Free); Rich Broke or Dead (Free) | 1 | FC, RBD |
| 3 | Sliders for years of income, savings, spending, stock/bond mix | One-screen what-if | Vanguard (Free) | 1 | S* (BC CRR) |
| 4 | Optional sections that open on request | Same page serves beginner and expert | FIRECalc (Free) | 2 | FC |
| 5 | Plan completeness score with next steps | Tells the person what to add next | Boldin Planner Score (all new users) | 1 | B2 |
| 6 | Life milestones (retire, part-time, travel break, buy home, rental income) as building blocks | Plan is a timeline of events not a form | ProjectionLab (Free basics) | 2 | P1 |
| 7 | Milestones with conditions (decision-tree style, "when X happens") | Retire when savings hit a number, not a date | ProjectionLab (Free/Premium split unclear) | 3 | P1, P2 |
| 8 | Own definition of financial independence and target date | Goal set by the household, not a fixed 4% | ProjectionLab | 2 | P1 |
| 9 | Year-by-year editable values for every input | Lets power users shape any year | Flexible Retirement Planner (free tool, pricing unconfirmed); ProjectionLab advanced editor; FIRECalc partly | 3 | FRP, P2, FC |
| 10 | Monthly time ranges and calendar-year alignment | Precision for part-year events | ProjectionLab v4.3.0 | 3 | P2 |
| 11 | Couples planning (two people, two ages, two incomes) | Both people's timelines in one plan | ProjectionLab, Boldin, MaxiFi, Pralana, OSS | 2 | P1, B1, M1, PR, OSS |
| 12 | Partner life-expectancy milestone | Models survivor years | ProjectionLab v4.2.3 | 2 | P2 |
| 13 | Several saved alternative plans (profiles) | Compare "retire at 60 vs 65" | MaxiFi (3 on trial, 25 paid); Boldin multiple scenarios (Paid); ProjectionLab sandbox and Compare mode | 2 | M2, B1, P2 |
| 14 | Side-by-side scenario compare | See two or three futures in one view | Pralana (3 scenarios), ProjectionLab Compare, RightCapital side-by-side (Adv), Boldin | 2 | PR, P2, K1, B1 |
| 15 | Templates / sandbox starting points | Start from an example household | ProjectionLab | 1 | P2 |
| 16 | "Plan works without linking accounts" | Privacy-first entry | ProjectionLab ("no need to link accounts") | 1 | P1 |
| 17 | Link accounts to auto-fill balances [LOGIN] | Saves typing | Boldin PlannerPlus; Empower (Free); WealthTrace; RightCapital Premium+ (Adv, Yodlee) | 1 | B1, S*, K1 |
| 18 | Ask-the-planner AI that answers or edits the plan | Plain-language what-ifs | Boldin AI (limited free, unlimited Paid); OnTrajectory | 2 | B1, B2, B3 |
| 19 | Encrypted document vault the AI can read | Keep statements with the plan | Boldin PlannerPlus (Sept 2026) | 1 | B2 |
| 20 | Full-plan "document view" with charts, tables, insights | Printable summary of the whole plan | Boldin View Full Plan (Jul 2026) | 1 | B2 |
| 21 | Shareable and printable reports; PDF, CSV, JSON export | Take to a spouse or advisor | Boldin Paid; ProjectionLab (Oct 2025); MaxiFi PDF/Excel (Paid); RBD CSV+PNG; FI export | 1 | B1, P2, M2, RBD, FI |
| 22 | Share a link that re-creates the inputs | Send a scenario with no account | OSS, RBD, FI ("Share") | 1 | OSS, RBD, FI |
| 23 | Invite spouse, advisor or trusted contact with own login | Joint planning | Boldin (coming); MaxiFi advisor sharing (Paid, advisor needs PRO); RightCapital portal (Adv) | 2 | B2, M2, K1 |
| 24 | Client portal with read-only / adjust-without-saving / adjust-and-save access | Safe exploration by the family | RightCapital (Adv) | 2 | K1 |
| 25 | Progress tracking against original projection | Shows whether reality matches the plan | ProjectionLab | 2 | P1 |
| 26 | Annual and budget tracking | Compare actual year to plan | MaxiFi (Paid) | 2 | M2 |
| 27 | Plugins / simultaneous editing across devices | Power-user extension; same plan on phone and PC | ProjectionLab | 2 | P2 |
| 28 | Live classes, Q&A, courses, newsletter | Education | Boldin | 1 | B1 |
| 29 | Human coaching tiers | Walk-through help | MaxiFi Flight Check, Co-Pilot, Concierge [ADVICE]; Boldin Advisors checkup $3,200 flat [ADVICE] | - | M1, B1 |

### B. Answer styles: how "will it work" is shown
| 30 | Chance of success from many random runs (Monte Carlo) | Single percent, plus range | Boldin (Paid, 1,000 runs); ProjectionLab (up to 2,000, free basics); Fidelity; T. Rowe (1,000, Free); Empower (per reviews, conflicting); Pralana; MaxiFi "Living Standard Monte Carlo" (Paid); MoneyGuidePro, RightCapital (Adv) | 2 | B1, P2, F1, M2, PR, K1, S* |
| 31 | Past-market replay (every starting year since 1871) | Real sequences, no assumptions about returns | FIRECalc, cFIREsim, FI Calc, Rich Broke or Dead (Free); ProjectionLab; Pralana | 2 | FC, FI, RBD, P2, PR, S* |
| 32 | Block bootstrap sampling, adjustable block length | Random but keeps market streaks | ProjectionLab v4.4.1 | 3 | P2 |
| 33 | Historical without looping / loop back to first year | Controls what happens when data runs short | ProjectionLab; FI Calc | 3 | P2, FI |
| 34 | Fixed random seed for repeatable runs | Same answer every time | ProjectionLab v3.5.1 | 3 | P2 |
| 35 | Random mode with own mean return, spread, inflation; or steady growth | Dial the assumptions | FIRECalc | 2 | FC |
| 36 | Fan chart / probability bands per year | See spread, not one line | ProjectionLab (Apr 2026); RBD | 2 | P2, RBD |
| 37 | Outcome histogram; milestone completion table | Where runs end up | ProjectionLab | 2 | P2 |
| 38 | Table of every single simulation | Inspect worst and best cases | FI Calc; RBD CSV of every cycle | 3 | FI, RBD |
| 39 | Rich / Broke / Dead view with chance of dying each year | Merges longevity with money | Rich Broke or Dead | 2 | RBD |
| 40 | Confidence level choice (50 / 75 / 90%) | Pick how cautious to be | Fidelity | 2 | F1 |
| 41 | Chance-of-success colors and thresholds editable | Personal meaning of "good" | ProjectionLab | 2 | P2 |
| 42 | Spending range with upper and lower guardrails instead of a percent | Answer = amount you can spend now, adjust if markets move | Income Lab (Adv); RightCapital guardrails (Adv); ProjectionLab Flex Spending; cFIREsim ceiling/floor | 3 | IL, K1, P2, S* |
| 43 | Maximum steady spending (consumption smoothing) | One safe-to-spend number across life | MaxiFi (Paid) | 3 | M1 |
| 44 | Stress tests: market crash, black swan | Shows fragility | ProjectionLab; Boldin PlannerPlus; Empower "Recession Simulator" (per reviews) | 2 | P1, B1, S* |
| 45 | Account-level success treatment (Auto or Fixed) | Which accounts count toward success | ProjectionLab v4.2.2 | 3 | P2 |
| 46 | Sensitivity analysis (which input moves the answer most) | Tells what to change first | Flexible Retirement Planner | 2 | FRP |
| 47 | Solver: find spending or savings that reach a target success | Works backward from the goal | FIRECalc | 2 | FC |
| 48 | Metric "MRI": show how each number was derived | Explains the math | Pralana Online | 2 | PR |

### C. Spending and withdrawal strategies
| 49 | Constant spending after inflation | Default 4%-style plan | FIRECalc, FI Calc, all | 1 | FC, FI |
| 50 | Percent-of-portfolio spending with floor | Spend a share each year | FIRECalc; FI Calc | 2 | FC, FI |
| 51 | Catalog of named strategies (VPW, Guyton-Klinger, 95% rule, Clyatt, endowment, CAPE-based, Hebeler Autopilot II, Vanguard dynamic, 1/N, Sensible Withdrawals) | Compare rule-based spending | FI Calc (13); ProjectionLab (VPW, X%, Clyatt, G-K, Premium) | 3 | FI, P2 |
| 52 | Spending that falls with age (Bernicke "reality" model) | Models slower spending in late retirement | FIRECalc | 2 | FC |
| 53 | Spending flexibility: cut by X% if portfolio drops below Y% | Simple guardrail | Rich Broke or Dead; ProjectionLab Flex Spending (Premium) | 2 | RBD, P2 |
| 54 | One-time or lumpy extra spending or inflows (home sale, big purchase) | Real life events | FIRECalc (3 lines); FI Calc; ProjectionLab | 2 | FC, FI, P1 |
| 55 | Floor for estate: balance that must remain | Leave something behind | FIRECalc; ProjectionLab estate planning (Premium) | 2 | FC, P1 |
| 56 | Withdrawal order (which account first) and proportional vs sequential | Tax-aware drawdown | ProjectionLab (customizable); RightCapital (Adv); MaxiFi Retirement Withdrawal Optimizer (Paid); Boldin | 3 | P2, K1, M2 |
| 57 | Automatic strategy search for drawdown order, Roth conversions, gain harvesting, applied in one click | Optimizer | ProjectionLab (Premium); MaxiFi (Paid) | 3 | P1, M2 |
| 58 | Count the calculated withdrawal as desired spending | Link rule to budget | ProjectionLab | 2 | P2 |
| 59 | Cash-flow priorities and Sankey cash-flow picture | Where money goes each year | ProjectionLab | 2 | P2, P1 |
| 60 | Rebalancing frequency, asset allocation by account type (location) | Where to hold what | FI Calc (rebalance); Pralana (asset location through conversions); Boldin allocation check (Paid) | 2 | FI, PR, B1 |
| 61 | Investment fee entry and "what fees cost over time" | Show drag from fees | FIRECalc; RBD; Empower Fee Analyzer (Free, reads linked accounts [LOGIN]); Boldin fund-fee insights (Oct 2026) | 2 | FC, RBD, S*, B2 |

### D. Roth, taxes, accounts
| 62 | Roth conversion explorer, year by year | Tests converting now vs later | Boldin (Paid); ProjectionLab (Premium); MaxiFi Optimizer (Paid); Pralana; Fidelity standalone calc (Free); RightCapital (Adv) | 3 | B1, P2, M2, PR, F1 S*, K1 |
| 63 | Conversion targets: fill a tax bracket, stay under an Medicare-premium (IRMAA) line, stay under capital-gains bracket, keep ACA subsidy | Picks a rule not an amount | ProjectionLab; Pralana (IRMAA, marginal, LTCG; spouse priority; ACA) | 3 | P1, PR |
| 64 | Roth conversion "ladder" for early retirees; 72(t) early-payment plans | Reach money before 59 and a half | ProjectionLab (v3.4.0 ladder, 72(t)) | 3 | P2 |
| 65 | Backdoor and mega backdoor Roth | High-earner contributions | ProjectionLab | 3 | P2 |
| 66 | Lifetime tax projection (federal and state) | Taxes in each retired year | Boldin (Paid); ProjectionLab (free estimate, Premium detail); Fidelity (signed in); Pralana; MaxiFi | 3 | B1, P2, F1, PR, M1 |
| 67 | Flat average tax rate input | Simple tax setting | RBD, FI Calc excludes tax; FIRECalc none; cFIREsim none | 1 | RBD, S* |
| 68 | Taxes on Social Security shown (taxable share) | Avoid underestimating | ProjectionLab v3.5.0; MaxiFi | 2 | P2, M1 |
| 69 | Alternative minimum tax; scheduled tax-law change toggle | What-if law changes | ProjectionLab AMT, TCJA toggle | 3 | P2 |
| 70 | Net investment income tax; early-withdrawal 10% penalty | More complete tax | Boldin (Oct 2026) | 2 | B2 |
| 71 | Capital gain harvesting; withdrawal shielding | Use low brackets | ProjectionLab Tax Strategies (Apr 2026) | 3 | P2 |
| 72 | Required minimum distributions; qualified charitable distributions; donor-advised funds | Rules at 73+ and giving | Pralana (RMD, QCD); ProjectionLab (QCD, DAF, Feb 2026); Fidelity | 2 | S*, P2 |
| 73 | Inherited IRA 10-year and stretch rules | Account type for heirs | ProjectionLab v4.3.0 | 3 | P2 |
| 74 | HSA, 529, annuity, real estate modules | Account types beyond 401(k)/IRA | MaxiFi modules (Paid); Pralana (HSA); ProjectionLab | 2 | M2, S*, P1 |
| 75 | Equity compensation and deferred compensation inputs | Stock pay | Fidelity | 2 | F1 |
| 76 | Tax return upload that finds opportunities | Scan 1040 for savings | Holistiplan (Adv; not opened) | 3 | S* |
| 77 | Transfers between accounts | Move money in plan | ProjectionLab v4.5.0 | 1 | P2 |
| 78 | Other countries: Canada, UK, Australia, Germany, Netherlands; currency choice; CPP, OAS, GIS, UK pension methods | Non-US households | ProjectionLab | 3 | P1, P2 |

### E. Social Security, pensions, annuities
| 79 | Pick claiming age 62 to 70 and see result | Basic timing | Fidelity; Boldin Social Security explorer (Paid); RightCapital (Adv, limited ages); FIRECalc (start year) | 1 | F1, B1, K1, FC |
| 80 | Best claiming strategy for the highest present value, couples with spousal and survivor | Biggest dollar lever for many couples | Open Social Security (Free, open source); MaxiFi Social Security Maximizer (Paid); Income Lab (Adv, 9,000+ combos) | 3 | S*, M2, IL |
| 81 | Extras: divorced, widowed, disability, children, still working, mortality, discount rate, possible benefit cut | Real-life cases | Open Social Security | 3 | OSS, S* |
| 82 | Enter statement figures to estimate benefit | Avoid hand math | ProjectionLab (SSA statement, Apr 2026) | 2 | P2 |
| 83 | Pensions with start year and inflation yes/no (up to three lines) | Fixed income | FIRECalc; Fidelity; all full planners | 1 | FC, F1 |
| 84 | Annuity modeling | Income purchase | MaxiFi (annuity module, Paid) | 2 | M2 |
| 85 | Working in retirement; extra income and expense streams with start/end ages | Part-time work | RBD; FI Calc; Fidelity | 2 | RBD, FI, F1 |

### F. Health and longevity
| 86 | Health cost estimate by phase (COBRA, Marketplace, Medicare, Medigap, drugs, dental, vision) | Real cost of age 55 to 65 and beyond | Fidelity (default 15% of expenses unless detailed); Boldin healthcare cost modeling (Paid) | 2 | F1, B1 |
| 87 | Medicare Parts B and D, supplements; premium surcharge (IRMAA) | Medicare cost by income | ProjectionLab (Apr 2026); Boldin Medicare and IRMAA strategies (Paid) | 3 | P2, B1 |
| 88 | Marketplace subsidy (ACA) and poverty-level targeting | Keep income low enough pre-65 | ProjectionLab; Pralana | 3 | P2, PR |
| 89 | Long-term care event (default 4 years) | Cost shock | Fidelity | 2 | F1 |
| 90 | Mortality table choice and sex | Plan length | RBD (SSA or Society of Actuaries low/high); Fidelity (planning age at 25% survival) | 2 | RBD, F1 |
| 91 | Life-insurance contingency planning | Survivor protection | MaxiFi (Paid) | 3 | M1, M2 |

### G. Assumptions and big picture
| 92 | Inflation choice: CPI, PPI, custom; separate health inflation | Not one-size | FIRECalc; Fidelity (health fixed, can't change) | 2 | FC, F1 |
| 93 | Asset-mix presets (nine target mixes) or own holdings | Choose risk quickly | Fidelity | 2 | F1 |
| 94 | Return assumptions: historical, custom, or capital-market model | Control the future | ProjectionLab; Boldin adjustable (Paid); FIRECalc | 2 | P2, B1, FC |
| 95 | Investment strategy compare by risk profile and life stage; allocation vs risk survey; concentration risk | Check portfolio fit | Boldin Investments Today/Future (Sept 2026, Paid) | 2 | B2, B1 |
| 96 | Tax diversification view (pre-tax, Roth, taxable mix) | Balance of buckets | Boldin (Oct 2026) | 1 | B2 |
| 97 | Net worth and cash-flow "plan map" (Blueprint, Cash Flow Maps) | Whole-household picture | RightCapital (Adv) | 2 | S* (IL page) |
| 98 | Goal-based planning with probability scores | Rank goals | MoneyGuidePro (Adv) | 2 | S* |
| 99 | Estate planning and net legacy; US estate tax, UK inheritance tax | What heirs receive | ProjectionLab (Premium, Feb 2026) | 3 | P1, P2 |
| 100 | Real estate: home, rental, downsizing | Housing choices in the plan | Boldin, ProjectionLab, Pralana, MaxiFi | 2 | B1, P1, PR |
| 101 | College costs for children | Pre-retirement spending | Pralana | 2 | PR |
| 102 | Debt payoff timing (e.g., student loans) | Frees cash flow | ProjectionLab | 2 | P1 |
| 103 | Delayed-retirement window test (retire in each year of a range) | When is early enough | FIRECalc | 2 | FC |
| 104 | Allocation compare (what changing stocks/bonds does) | Risk trade | FIRECalc | 2 | FC |
| 105 | Advisor monthly monitoring that flags a needed spending change | Ongoing check-in | Income Lab (Adv) | 2 | IL |
| 106 | Custom plots / table drill-down year by year | See any line | ProjectionLab; FI Calc | 3 | P1, FI |
| 107 | International data presets, multi-currency | Expats | ProjectionLab | 3 | P1 |

## Things that need a connection, a license or paid data (do not copy)
- [LOGIN] Account linking and daily balances: Empower (Free), WealthTrace, Boldin PlannerPlus, RightCapital Premium+ (Yodlee aggregator). Conflicts with the app's promise "No bank logins or account numbers, ever."
- [ADVICE] Boldin Advisors, MaxiFi Co-Pilot/Concierge, advisor portals.
- [FEED] Market data refreshes (FIRECalc data updated by its author; Empower investment tracking), aggregator fees.
- [TRADE] Empower wealth management from 0.89% of assets with $100,000 minimum (B3) is the only trading/management product here.

## Where this app can beat everyone (what no single product combines)
1. Free, no-login, private, typed-in everything: FIRECalc-style 3-box start, then folded sections, with ProjectionLab/MaxiFi optimizers for free.
2. One plain "pick your style" for the answer (percent chance, steady-spending number, or guardrail range) rather than one method per product.
3. Roth/IRMAA/ACA/bracket targets (Pralana, ProjectionLab) plus Social Security couple optimizer (Open Social Security) in one plan, free.
4. A "show how this number was derived" button on every figure (only Pralana Online does this).
5. Withdrawal-rule catalog (13 in FI Calc) with a one-line plain explanation of each and a chip default.
6. Depth ladder per page: answer, 3 numbers, "More options," "Expert."
