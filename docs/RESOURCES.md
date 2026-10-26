# Resources: open-source programs, libraries and data to start from

Curated 2026-09-14. Everything here is public. Two ways each item is used:

* **lift** -- JavaScript/TypeScript we can port function-by-function into a module's
  `compute.js` (with attribution in that module's README and a licence check).
* **reference / service** -- study the model or run it as a separate local service the
  PC server calls (the way it already calls Ollama). Python and PHP projects fall here.

Licence note: the project is published under MIT. MIT / Apache / BSD code can be pasted
into it. GPL / AGPL code cannot (it would oblige relicensing the whole project): use those
projects as references and specs, or take only facts from them (IRS and SSA figures are not
anyone's copyright). Mark the source and licence in the module README whenever code or data
is lifted.

Suggested layout for clones: `C:\FinancialPlanner\vendor\<name>` (git-ignored).

## Whole apps worth studying (data models, import, rules, reports)

| Project | What it is | Stack / licence | Seeds which modules |
|---|---|---|---|
| [Actual Budget](https://github.com/actualbudget/actual) | Local-first budgeting (envelope / YNAB style), transaction import (OFX/QFX/CSV), rules engine, schedules, reports, multi-device sync. `packages/loot-core` is the platform-agnostic business logic. | TypeScript, MIT | cashflow/budget, transactions/import, transactions/rules, cashflow/recurring |
| [Firefly III](https://github.com/firefly-iii/firefly-iii) | Mature personal finance manager: accounts, budgets, bills, piggy banks (goals), rules, recurring, rich reports, REST API. | PHP/Laravel, AGPL | reference for goals, rules, reports, data model |
| [Maybe](https://github.com/maybe-finance/maybe) | Personal finance + wealth app: net worth, accounts, holdings, Plaid sync, an AI assistant over the plan. | Ruby on Rails, AGPL | balance/net-worth, investments/holdings, ai/assistant design |
| [Ghostfolio](https://github.com/ghostfolio/ghostfolio) | Portfolio tracker: allocation by class/sector/currency/region, performance, market data. | TypeScript (Angular + NestJS), AGPL | investments/allocation, investments/performance |
| [Wealthfolio](https://github.com/afadil/wealthfolio) | Desktop, local-first investment tracker. | Rust + React, LGPL | investments (local-first patterns) |
| [Portfolio Performance](https://github.com/portfolio-performance/portfolio) | Investment performance done properly: true time-weighted return, IRR, dividends, benchmarks. | Java, EPL | investments/performance (port the math) |
| [GnuCash](https://github.com/Gnucash/gnucash) | Double-entry accounting. | C, GPL | reference for a ledger-grade transactions model |

## Retirement and withdrawal engines (the heart of the projections)

| Project | What it is | Stack / licence | Use |
|---|---|---|---|
| [cFIREsim-open](https://github.com/boknows/cFIREsim-open) | Historical-cycle retirement simulator (every start year since 1871), spending rules, success rate. | JavaScript, open source | **lift** into retirement/historical-simulation |
| [FI Calc guide](https://github.com/jamesplease/fi-calc-guide) (the app's source went private in 2026; forks are blocked) | The guide book of ficalc.app: every withdrawal strategy (constant dollar, percent of portfolio, VPW, Guyton-Klinger guardrails, 95% rule, Hebeler...) explained with its formula. | Markdown, AGPL | **spec** for retirement/withdrawal-strategy; implement in our own compute.js |
| [TPAW Planner](https://github.com/bengmathew/tpaw) | Total Portfolio Allocation and Withdrawal: lifecycle-finance based planner with Monte Carlo, glide paths, legacy goals. Also offered as a spreadsheet. | TypeScript, open source | **lift / reference** for retirement/monte-carlo and investments/glide-path |
| [Owl](https://github.com/mdlacasse/Owl) | Retirement planner that OPTIMISES (linear programming): Roth conversion schedules, withdrawal order, taxes. | Python | **service** behind retirement/roth-conversions and retirement/withdrawal-order |
| [Bogleheads Retiree Portfolio Model](https://www.bogleheads.org/wiki/Retiree_Portfolio_Model) | Free Excel model: pensions, Social Security, RMDs, annuities, house sale, federal + state tax, Roth conversion comparison over 40 years. Download link is in the forum topic. | Excel | **reference**: the checklist of what a complete retirement cash-flow page must handle |
| [ERN Safe Withdrawal Rate toolbox](https://earlyretirementnow.com/safe-withdrawal-rate-series/) | Google Sheet behind the Safe Withdrawal Rate series. | Sheet | reference for guardrails / SWR pages |

## Social Security

| Project | What it is | Stack / licence | Use |
|---|---|---|---|
| [ssa.tools (social-security-tools)](https://github.com/Gregable/social-security-tools) | Paste your earnings record from ssa.gov, get PIA, benefit at every claiming age, spousal benefits, break-even. Runs entirely in the browser. | TypeScript/Svelte | **lift** PIA and bend-point math into retirement/social-security |
| [Open Social Security](https://github.com/MikePiper/open-social-security) | Claiming-age optimiser (singles and couples, survivor benefits, mortality tables). | TypeScript/Angular | **lift** the optimiser |

## Taxes

| Project | What it is | Stack / licence | Use |
|---|---|---|---|
| [UsTaxes](https://github.com/ustaxes/UsTaxes) | Open-source 1040 filing app; all federal calculations in the browser, tax years 2020-2025, many schedules, a handful of no-income-tax states. | TypeScript, AGPL | **lift** the federal engine (brackets, standard deduction, capital gains, credits) for taxes/federal-estimate |
| [PolicyEngine US](https://github.com/PolicyEngine/policyengine-us) | Rules engine for the whole US tax-and-benefit system, federal plus state income taxes, with a public [API](https://policyengine.github.io/policyengine-us/). | Python, AGPL | **service** for taxes/state and multi-year tax projection; the most complete free tax model there is |
| [PolicyEngine TAXSIM](https://github.com/PolicyEngine/policyengine-taxsim) | NBER TAXSIM-compatible interface on top of PolicyEngine. | Python | service |
| [Tax-Calculator (PSL)](https://github.com/PSLmodels/Tax-Calculator) | Federal individual income tax microsimulation. | Python, MIT | reference / service |
| [Open Tax Solver](https://opentaxsolver.sourceforge.net/) | Yearly federal + several state returns. | C, GPL | reference |
| IRS annual inflation adjustments (Rev. Proc.), [Tax Foundation brackets](https://taxfoundation.org/data/all/federal/) | Bracket, deduction and contribution-limit tables by year. | data | taxes/* tables |

## Finance math libraries

| Library | Use |
|---|---|
| [formulajs](https://github.com/formulajs/formulajs) | Excel functions in JS: PMT, FV, PV, NPER, RATE, IRR, XIRR, NPV. MIT. Cross-check our core/math against it in tests. |
| [financejs](https://github.com/essamjoubori/finance.js) | Small TVM/loan library, MIT. |
| [decimal.js](https://github.com/MikeMcl/decimal.js) / [dinero.js](https://github.com/dinerojs/dinero.js) | Exact money arithmetic when cents matter (ledger, tax). |
| [numpy-financial](https://github.com/numpy/numpy-financial) | Python reference implementations of the same functions. |

## Data sets (historical returns, inflation, mortality, benchmarks)

| Source | What | Feeds |
|---|---|---|
| [Shiller online data](http://www.econ.yale.edu/~shiller/data.htm) | Monthly S&P price, dividends, earnings, CPI, long rates since 1871 (xls). | historical simulation, inflation |
| [Damodaran historical returns](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html) | Annual stocks / T-bills / T-bonds / real estate / gold since 1928. | Monte Carlo assumptions |
| [Simba backtesting spreadsheet (Bogleheads)](https://www.bogleheads.org/wiki/Simba%27s_backtesting_spreadsheet) | Annual returns for dozens of asset classes since 1871, in one sheet. | allocation backtests |
| [Kenneth French data library](https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html) | Factor and portfolio returns. | investments/factors |
| [FRED API](https://fred.stlouisfed.org/docs/api/fred/) | CPI, treasury yields, mortgage rates, wages. Free key. | assumptions, live rates |
| [BLS CPI](https://www.bls.gov/cpi/) | Official inflation series. | inflation |
| [SSA period life tables](https://www.ssa.gov/oact/STATS/table4c6.html) | Mortality by age and sex. | longevity, insurance needs, annuity pricing |
| [IRS Uniform Lifetime Table (Pub 590-B)](https://www.irs.gov/publications/p590b) | RMD divisors. | retirement/rmd |
| [Federal Reserve Survey of Consumer Finances](https://www.federalreserve.gov/econres/scfindex.htm) | Net worth and income by age, for "how am I doing" benchmarks. | overview/benchmarks |

## Getting transactions in

| Tool | Use |
|---|---|
| [SimpleFIN Bridge](https://beta-bridge.simplefin.org/) | Cheap (about $15/yr) bank aggregator with an open, simple API; what Actual Budget uses. Best fit for a self-hosted app. |
| [Plaid](https://plaid.com/docs/) | The big aggregator; free development tier, needs a developer account. |
| [Papa Parse](https://www.papaparse.com/) | CSV parsing in the browser (bank exports). MIT. |
| [ofx-js](https://github.com/Reactive-Extensions/ofx-js) / [banking.js](https://github.com/euforic/banking.js) | OFX/QFX statement parsing. |
| [pdf.js](https://github.com/mozilla/pdf.js) | Extract text from PDF statements in the browser, then let the local model structure it. |

## UI pieces

| Library | Use |
|---|---|
| [Chart.js](https://www.chartjs.org/) or [uPlot](https://github.com/leeoniya/uPlot) | Charts (uPlot is tiny and very fast for long series). |
| [Tabulator](https://tabulator.info/) | Sortable/filterable/editable tables for the transactions page. |
| [Univer](https://github.com/dream-num/univer) or [jspreadsheet CE](https://github.com/jspreadsheet/ce) | A spreadsheet page for people who think in cells. |
| [Workbox](https://developer.chrome.com/docs/workbox) | PWA / offline caching so the phone keeps working without the PC. |

## Knowledge (the formulas and the "why")

* [Bogleheads wiki](https://www.bogleheads.org/wiki/Main_Page) -- retirement, withdrawal methods, tax-efficient placement, Roth conversions.
* [r/personalfinance wiki and flowchart](https://www.reddit.com/r/personalfinance/wiki/commontopics/) -- the prioritisation logic a "next best action" page should encode.
* Bengen (1994), the Trinity study, Kitces guardrails, Vanguard's dynamic spending -- the withdrawal-rule literature behind retirement/withdrawal-strategy.
* [NBER TAXSIM](https://taxsim.nber.org/) -- the classic tax calculator, for validating our tax numbers.
