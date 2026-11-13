# Research: investments, net worth and portfolio tracking (feature gap list)

Read 2026-11-13. Researcher: web only (WebSearch and WebFetch). No repo files touched.

## How to read this

- Tier: F = free, P = paid (self-serve subscription), A = advisor-managed or advisor-only, ? = tier not confirmed.
- Confidence: [V] = on the product's own page read today; [T] = third-party review or search summary only (check before relying); [G] = general industry knowledge, not verified today.
- Flags: LOGIN = needs a bank or brokerage connection (conflicts with the app's "no bank logins, ever" promise, so file import or typing is the substitute); TRADE = places or executes trades; ADVICE = licensed or fiduciary advice or managed money; FEED = paid or licensed market-data feed (prices, fund holdings, history); CLOUD = needs an account on the vendor's server.
- Sources (S-codes) are listed at the end with URL and date read.

## 1. How each product lets a person pick depth

| Product | Default view | How depth is chosen | Src |
|---|---|---|---|
| Kubera | One net worth number plus sheets (accounts and assets listed by section) | Tiers do depth: Essentials ($250/yr) has 2 portfolios, 2 users; Black ($2,500/yr) adds nested portfolios, ownership tags, unlimited users. Cost basis, IRR, mark-to-sale are optional per manual asset | S1 S2 [V] |
| Empower (Personal Dashboard) | Net worth, cash flow, investments summary | Free tools are separate pages (Investment Checkup, Fee Analyzer, Retirement Planner) opened on demand; wealth management is the paid upsell | S17 [T] |
| Sharesight | Performance report by default | Plan tiers unlock more reports (Tax, Diversity, Exposure at Starter; Contribution, Drawdown Risk, Future Income, Multi-Currency at Standard; Multi-Period at Premium). Free plan sees a demo with advanced reports | S3 S4 S21 [V] |
| Snowball Analytics | Holdings, dividends, simple allocation | 4 tiers; heavier features gated (any-asset benchmark, 30+ year backtest, Why-is-it-moving report). Free allows 10 holdings | S5 [V] |
| Portfolio Visualizer | Pick one tool from a menu, fill a form | Free needs no login (15 assets); paid raises limits (150 assets, saved portfolios). Same tools on all tiers. Form has basic fields then advanced options | S6 S7 [V] |
| Morningstar | Free registered account tools | Premium (X-Ray, Instant X-Ray) was discontinued April 2025; current free toolset is smaller | S18 [T] |
| Ghostfolio | Overview with performance and allocation | Open source self-host (free) or paid cloud; X-Ray rules page is a separate tab | S8 [V] |
| getquin | Net worth plus holdings | Free tracker; Premium adds long-term dividend forecast and time-weighted return; DeepDive (look-through) is a separate view | S9 [V] |
| Delta | Holdings and price alerts | Free up to about 10 assets; PRO adds insights, unlimited connections | S19 [T] |
| Stock Rover | Free view of portfolio and market | Plans Essentials / Premium / Premium Plus; rebalancing, analytics and 700+ screeners climb with tier | S16 [T] |
| Portfolio Charts | A home page of 13 charts | Pick a portfolio (21 lazy ones) and a country; every chart has the same controls. No paywall | S10 [V] |
| Betterment | Goals with one recommended portfolio | Digital (0.25%) vs Premium (0.65%, $100,000 minimum, advisor access); custom portfolios and tax features are toggles | S11 S12 S13 [V/T] |
| Wealthfront | Goals plus Path planning | Core 0.25% fee; direct indexing from $5,000 (S&P 500 Direct, Nasdaq-100 Direct) or $100,000 (US Direct Indexing); line of credit at $25,000+ | S14 S15 [V] |

Pattern worth copying: nearly all products show one number first and put the rest behind tiers or separate pages. Only Portfolio Visualizer, Portfolio Charts and Ghostfolio let a person go deep without paying, and only by being a "tool menu" rather than a guided flow.

## 2. Merged feature list

### A. Net worth and the holdings list

| # | Feature (plain words) | What it does for a household | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 1 | One total of everything you own minus what you owe | The big-picture number | Kubera P, Empower F, getquin F, Delta F, Ghostfolio F/P, Wealthfront F (linked accounts) | Number only to full history chart | LOGIN for auto-sync; manual works | S1 S9 S14 S17 [V/T] |
| 2 | Net worth over time chart | Shows progress, not just today | Kubera, Empower, getquin, Sharesight (portfolio value) | Daily snapshots to yearly | none if typed monthly | S1 S9 [V] |
| 3 | Add an account by typing it in | Works without any connection | Kubera, Snowball, Sharesight, Ghostfolio, getquin, Delta | One balance or per-holding | none | S1 S3 S8 S9 [V] |
| 4 | Import trades or holdings from a file (CSV, broker report) | Fills holdings without logins | Snowball (all tiers), Ghostfolio, getquin, Sharesight (200+ brokers by auto-import, plus files) | Column mapping to named broker presets | none (file) | S5 S8 S9 [V] |
| 5 | Auto-sync with bank or broker | Balances update themselves | Kubera P (Yodlee per reviews), Empower F, Snowball P (Starter+), getquin, Sharesight (broker trade import), Delta, Wealthfront | One-click link | LOGIN | S1 S5 S17 S20 [V/T] |
| 6 | Holdings table with shares, price, value, cost, gain | The base of any portfolio view | all | Columns chosen by user (Stock Rover, Snowball) | FEED for live prices | S5 S16 [V/T] |
| 7 | Several portfolios (e.g. taxable, IRA, kids) | Keeps accounts apart | Snowball 1/10/unlimited by tier; Sharesight 1/4/10; Kubera 2/unlimited; PV 50/150 saved | Limit by tier | none | S1 S4 S5 S7 [V] |
| 8 | Combined "all accounts" view over several portfolios | One answer for the household | Sharesight (Standard+ custom groups), Snowball, Kubera nested (Black) | Group, nest | none | S1 S4 [V] |
| 9 | Groups/tags on holdings (your own labels: "kids", "retirement") | Slice by purpose, not asset type | Sharesight custom groups 1/3/5/10; Kubera ownership tags (Black) | Free-text labels to roll-ups | none | S2 S4 [V] |
| 10 | Owner per account (you, spouse, trust, shared %) | Splits household wealth by person; only your share of a partly-owned asset counts | Kubera (Black: ownership tags, partial ownership) | Per portfolio, sheet, section, or asset, lower overrides higher | none | S1 S2 [V] |
| 11 | Show in my currency, hold in others | Foreign holdings in one total | Kubera (any currency), Sharesight (Standard+ Multi-Currency Valuation), Portfolio Charts (12 countries), getquin | Display currency vs per-holding currency | FEED for rates | S1 S4 S10 [V] |
| 12 | Currency gain or loss separated from stock gain | Shows if a fund was down only because the dollar moved | Sharesight (multi-currency report), getquin [T] | Optional report | FEED | S4 S21 [V/T] |
| 13 | Watchlist | Track things you do not own | Snowball 1/2/10/20, getquin, Delta, Stock Rover | Count capped by tier | FEED | S5 S9 [V] |
| 14 | Price alerts and notifications | Nudges on price or dividend | Delta, Snowball (push/email dividend alerts by tier), Stock Rover alerts | Per asset | FEED, CLOUD | S5 S16 S19 [V/T] |
| 15 | Weekly summary email | Passive check-in | Snowball (Starter+) | On/off | CLOUD | S5 [V] |
| 16 | Share read-only view with accountant or family | Others see numbers without logging in as you | Kubera P (hide specific balances [T]), Sharesight (share portfolio and tax report), Snowball public portfolios, Ghostfolio public link | Link vs invite | CLOUD | S1 S3 S5 S8 [V/T] |
| 17 | Public portfolio page | Show a portfolio to friends | Snowball (all tiers), getquin community, Ghostfolio public API | Public toggle | CLOUD | S5 S8 S9 [V] |
| 18 | "If I stop checking in" hand-over to named people | Estate readiness for the whole picture | Kubera Dead Man's Switch, primary and contingent beneficiary ("Trusted Angel") | Pick people and wait period | CLOUD | S1 S20 [V/T] |
| 19 | Attach files (statements, deeds) to a holding | One place for proof | Sharesight (Starter+) | Per holding | CLOUD | S4 [V] |
| 20 | Mobile app plus web | Phone-first | all but PV and Portfolio Charts (web only) | n/a | none | S1 S3 S9 [V] |
| 21 | Dark mode, Zen mode (hide the numbers) | Calm viewing | Ghostfolio | Toggle | none | S8 [V] |
| 22 | AI assistant that reads your accounts and answers or models what-ifs | Ask "what if I had not sold" | Kubera (Claude, ChatGPT, Grok; limits by tier), Snowball Expert (MCP access), Snowball "Ask" [T] | Chat vs one-click analysis | CLOUD | S1 S5 S20 [V/T] |

### B. Other kinds of things you own

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 23 | Home or property with an automatic value | Counts the house without typing | Kubera P (auto-valued), Sharesight (property as a custom holding), Snowball (custom holdings, real estate) | Auto estimate vs your own number | FEED (home value data) | S1 S3 S5 [V] |
| 24 | Manual asset that grows by a rate you set | Land, collectibles, business share | Kubera, Snowball custom holdings (1/5/unlimited by tier), Sharesight | Fixed value, rate, or dated valuations | none | S1 S5 [V] |
| 25 | Private investments (private equity, VC, startup stakes, funds) | Counts illiquid wealth | Kubera P; Kubera help lists IRR and mark-to-sale for manual assets | Cost, current mark, IRR, capital calls [T] | none | S1 S20 [V/T] |
| 26 | Equity compensation (RSUs, options) listed with the rest | Includes unvested pay in the picture | Kubera ("retirement and equity") | Grant lines | none | S1 [V] |
| 27 | Precious metals | Gold and silver by weight | Kubera P | Spot price times weight | FEED | S1 [V] |
| 28 | Vehicles, jewelry, watches, other valuables | Full balance sheet | Kubera P | Typed value | none | S1 [V] |
| 29 | Loans and mortgages beside assets | Net worth, not just assets | Kubera, Empower, Ghostfolio (liability activity type) | Balance only vs payments | LOGIN to sync | S1 S8 S17 [V/T] |
| 30 | Cash and deposit accounts as holdings | Cash drag shown | Sharesight, Snowball, Ghostfolio | Balance, interest | none | S3 S5 [V] |
| 31 | Crypto holdings by coin | Counts coins | Delta, Kubera, Ghostfolio, Sharesight, getquin | Type quantity vs wallet sync | LOGIN/address for sync | S1 S3 S8 S19 [V/T] |
| 32 | Crypto wallets and exchanges on-chain sync | Auto balances | Kubera (major chains, exchanges), Delta | Address or API key | LOGIN, FEED | S1 S19 [V/T] |
| 33 | DeFi, NFTs, staking and lending positions | Counts non-simple crypto | Kubera ("tracked live"), Delta (NFTs) | Per protocol | LOGIN/FEED | S1 S19 [V/T] |
| 34 | Crypto cost basis methods (FIFO, LIFO, HIFO, specific lot) and Form 8949 export | Tax filing for coins | Dedicated crypto-tax tools (CoinTracker, CoinLedger, dTax); not core in the portfolio products | Method choice per tax year | LOGIN, FEED | S20 [T] |
| 35 | Wash-sale toggle for crypto | Rule status is unsettled (sources conflict) | dTax lists wash-sale detection [T] | On/off | none | S20 [T] |

### C. Performance

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 36 | Total gain or loss in dollars and percent | The first answer everyone wants | all | Number | FEED | S3 S5 [V] |
| 37 | Money-weighted return (IRR, XIRR) | "My" return, includes when I added money | Snowball (all tiers), Sharesight, Kubera (IRR for manual assets), Ghostfolio (ROAI) | Single vs per-period | none | S5 S8 S20 [V/T] |
| 38 | Time-weighted return | Return of the portfolio independent of deposits; fair to compare with a fund | Snowball [T], getquin Premium (TTWROR), Sharesight, Portfolio Visualizer | Single vs annualised | none | S9 S20 [V/T] |
| 39 | Return including dividends, fees and trades | Real, not price-only, return | Snowball, Sharesight, Ghostfolio (ROAI incl. dividends) | Toggle in some | none | S5 S8 S20 [V/T] |
| 40 | Preset periods (today, week, month, YTD, 1y, 5y, max) | Quick look back | Ghostfolio, Sharesight, Snowball | Chips | none | S8 [V] |
| 41 | Custom date range report | "Since I started this job" | Sharesight, Snowball, Portfolio Visualizer | Date pickers | none | S3 S5 [V/T] |
| 42 | Multi-period report (several years side by side) | Year-by-year table | Sharesight Premium; Snowball "multi-period analytics" (all tiers) | Table | none | S4 S5 [V] |
| 43 | Contribution analysis (which holdings drove the result) | Shows winners and losers by dollars | Sharesight (Standard+), Snowball [T] | Per holding, per period | none | S4 S21 [V] |
| 44 | Why-is-it-moving report | Plain explanation of a day's move | Snowball Investor+ | Portfolio report | FEED | S5 [V] |
| 45 | Best and worst performers | Fast triage | Delta PRO | List | none | S19 [T] |
| 46 | Realized vs unrealized split | Sold vs still held gains for tax | Sharesight (Sold Securities report, all plans), Stock Rover, Ghostfolio | Per lot | none | S4 S16 [V/T] |
| 47 | Drawdown risk of your portfolio | Worst fall and recovery time | Sharesight (Standard+), Portfolio Charts, Portfolio Visualizer | Chart + table | FEED for history | S4 S10 S21 [V] |
| 48 | Performance ignoring cash flows ("pure market return") | Compare with an index | Sharesight, Snowball, PV | Toggle | none | S5 S20 [T] |

### D. Benchmarks

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 49 | Compare to an index fund (S&P 500, total market) | "Did I beat just indexing?" | Snowball F (index funds only), getquin, Sharesight, Ghostfolio, PV | One index vs list | FEED | S5 S9 S21 [V] |
| 50 | Compare to any holding or custom benchmark | Pick your own yardstick | Snowball Investor+, Sharesight (any of 750,000+ securities), PV | Free-choice ticker | FEED | S5 S21 [V] |
| 51 | Trades vs what indexing would have done ("trade evaluator") | Did my buying and selling help? | Stock Rover | Trade bundles | FEED | S16 [T] |
| 52 | Flag holdings lagging the benchmark | Pointer to what to review | Snowball [T] | List | none | S20 [T] |

### E. Allocation and diversification

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 53 | Allocation by asset class (stocks, bonds, cash...) | Core balance check | all | Pie or bar | none | S3 S5 S8 [V] |
| 54 | Allocation by country, region, sector, currency | Concentration check | Snowball (sector, region), getquin, Ghostfolio, Sharesight Diversity | Choose dimension | FEED (fund breakdowns) | S4 S5 S9 [V] |
| 55 | Allocation by account type (taxable, IRA, Roth, 401k) | Bridge to tax planning | Ghostfolio (by account), Betterment, Wealthfront (tax-aware) | Per account | none | S12 S14 [V] |
| 56 | Look-through to what funds actually hold ("X-ray") | Finds hidden overlap, e.g. same stock in 3 funds | getquin DeepDive F/P, Sharesight Exposure (Starter+), Ghostfolio X-Ray (rules), Morningstar X-Ray (was Premium; discontinued 2025) | Asset class only vs top holdings vs style box | FEED | S4 S8 S9 S18 [V/T] |
| 57 | Style box (large/small, value/growth) and bond style | Detail for fund pickers | Morningstar (historic), Stock Rover [G] | Box | FEED | S18 [T] |
| 58 | Overlap and concentration warnings | "40% of you is one company" | Ghostfolio X-Ray, getquin, Snowball Ask [T] | Rule-based flags | none | S8 S9 [V/T] |
| 59 | Rule checks ("static analysis"): currency cluster, account cluster, emergency fund, fees, region | A checklist, green or red | Ghostfolio X-Ray | Per rule on/off | none | S8 [V] |
| 60 | Asset class mix versus your risk target | Drift shown against a goal | Empower Investment Checkup [T], Betterment, Wealthfront | One target vs custom | ADVICE flavour | S11 S14 S17 [V/T] |
| 61 | Stock overlap with your employer's stock | Over-concentration in your own company | Kubera (equity), Ghostfolio concentration [G] | Flag | none | S1 [V] |

### F. Rebalancing and what-if trades

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 62 | Set a target mix and see drift | Basic rebalance | Snowball (purchases-only on Free; full from Starter), Stock Rover (Premium+), Betterment, Wealthfront | Single target vs per-holding | none (view) | S5 S11 S14 S16 [V/T] |
| 63 | "Buy these shares to fix it" trade list | Turns drift into actions | Snowball Starter+, Stock Rover (quantity or value mode) | Shares and dollars | none if only a list | S5 S16 [V/T] |
| 64 | Rebalance using new money only | Avoids selling and tax | Snowball Free tier ("purchases only") | Contribution only | none | S5 [V] |
| 65 | Auto-rebalance (the service trades for you) | Hands-off | Betterment, Wealthfront (with dividends and deposits first) | On by default | TRADE, ADVICE, A | S11 S15 [V] |
| 66 | Rebalance band or schedule (drift %, calendar) | Rule choice | Stock Rover Future Simulations (frequency), PV backtest (monthly, quarterly, annual, none) | Frequency vs threshold | none | S16 S20 [V/T] |
| 67 | Trade preview with tax cost | Shows estimated tax before you act | Betterment (tax impact preview) | Per action | ADVICE flavour | S12 [V] |
| 68 | What-if trade: add or sell and see the new mix | Test before acting | Stock Rover rebalancing (quantity mode); Snowball [T] | Planned cost column | none (nothing placed) | S16 [T] |
| 69 | Compare buy-and-hold vs rebalanced over history | Is rebalancing worth it? | PV backtest, Portfolio Charts | Table | FEED | S10 S20 [V/T] |

### G. Income (dividends and interest)

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 70 | Dividends received, by month and year | See the income stream | Snowball, Sharesight (auto), getquin, Ghostfolio | List + chart | FEED | S3 S5 S9 [V] |
| 71 | Upcoming dividend calendar | When cash arrives | Snowball, getquin, Stock Rover [T] | Calendar | FEED | S5 S9 [V] |
| 72 | Future income forecast | Next 12 months of dividends | Sharesight Future Income (Standard+), getquin Premium (long-term forecast), Snowball | Short vs multi-year | FEED | S4 S9 [V] |
| 73 | Yield and yield on cost | Return on price vs on what I paid | Snowball (all tiers) | Two numbers | FEED | S5 [V] |
| 74 | Dividend safety or quality rating | Is the payout at risk? | Snowball dividend rating (Starter+) | Rating | FEED | S5 [V] |
| 75 | Dividend stock screener | Find new payers | Snowball top-dividend lists (5/20/50), Stock Rover | Basic vs advanced filters | FEED | S5 S16 [V/T] |
| 76 | Dividend reinvestment (DRP) and splits applied automatically | Keeps shares right | Sharesight, Snowball | Auto vs manual | FEED | S3 [V] |
| 77 | Interest income (bank, bonds) | Counts non-dividend income | Ghostfolio (interest activity), Sharesight | Entry | none | S8 [V] |

### H. Fees

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 78 | Fund expense ratio lookup per holding | Know what the funds cost | Empower Fee Analyzer F [T], Morningstar [G], Snowball (fees in performance) | Per fund | FEED | S17 [T] |
| 79 | Total yearly fees in dollars, and 30-year impact | Make small percents feel real | Empower Fee Analyzer (benchmark about 0.50% [T single source]) | Account vs total | FEED | S17 [T] |
| 80 | 401(k) fee view (plan fund costs) | Know what a workplace plan costs | Empower Fee Analyzer [T] | Per plan | LOGIN for auto | S17 [T] |
| 81 | Trading and crypto fees paid to date | Shows trading cost | Delta PRO | Total | LOGIN | S19 [T] |
| 82 | Fees entered per transaction (so returns are net) | Honest net return | Ghostfolio (fee activity), Sharesight, Snowball | Manual | none | S5 S8 [V] |
| 83 | Advisor fee comparison (flat vs % of assets) | Know what advice costs | Betterment ($5/month or 0.25% digital; 0.65% Premium); Wealthfront 0.25% | Fee schedule | ADVICE | S13 S14 [V/T] |

### I. Tax

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 84 | Tax report (gains, income) for your accountant | Filing help | Sharesight (Starter+; CGT for Australia and Canada, unrealised CGT for Australia), Stock Rover (US/Canada realized gains) | Country-specific forms | none | S3 S4 S21 [V] |
| 85 | Lots tracked per purchase with holding period | Short vs long term | Stock Rover, Sharesight, Snowball [G] | Per lot | none | S16 [T] |
| 86 | Lot method choice (FIFO, LIFO, highest cost, specific lot) | Pick the tax-smartest sale | Crypto-tax tools list all four [T]; Wealthfront does "tax-optimized lot selection" automatically | Method vs per-sale pick | none (view) | S15 S20 [V/T] |
| 87 | Tax-loss harvesting (sell losers, buy similar) | Offsets gains, up to $3,000 of regular income per year | Betterment, Wealthfront (daily); Wealthfront direct indexing at stock level | Auto vs user-initiated | TRADE, ADVICE, A | S12 S15 [V] |
| 88 | Harvest finder: list of your losses available now | Do it yourself | Not found as a free standalone in the products read; offered inside the managed ones [G] | Candidates list | none | S12 S15 |
| 89 | Wash-sale watcher across all your accounts | Avoid disallowed losses (30 days before/after) | Wealthfront ("monitors eligible accounts") | Auto | TRADE, A | S14 [V] |
| 90 | Asset location (bonds in IRA, stocks in taxable) | Cuts tax drag | Betterment Tax-Coordinated Portfolio (with caveat for short horizons, large pre-tax balances), Wealthfront tax-aware allocations | Auto | TRADE, ADVICE | S12 S20 [V/T] |
| 91 | Direct indexing (own the stocks, not the fund) | More harvest chances | Wealthfront ($5,000 S&P 500 Direct 0.12%; Nasdaq-100 Direct 0.09%; US Direct Indexing $100,000) | Tiered | TRADE, ADVICE, A | S15 [V] |
| 92 | Tax-smart withdrawals (which account first) | Lower tax in retirement | Wealthfront (lots), Betterment; PV withdrawal options pre or after tax | Order choice | ADVICE flavour | S15 S20 [V/T] |
| 93 | Charitable giving of appreciated shares | Skip the gain | Betterment (tool listed; details thin) | Donation flow | TRADE, ADVICE | S12 [T] |
| 94 | Tax-loss savings estimate vs fee | "Fee covered for 66% of users" marketing | Betterment | Estimate | ADVICE | S12 [V] |
| 95 | Export to tax software | Skip retyping | Quicken (TurboTax), Sharesight Xero, crypto tools | Export | none | S4 S20 [V/T] |

### J. Planning and projections

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 96 | Retirement planner with odds of success | Is my money enough? | Empower F (Monte Carlo [T]), Betterment (RetireGuide [T]), Wealthfront Path | Simple slider vs full inputs | CLOUD, LOGIN for auto-fill | S11 S14 S17 [V/T] |
| 97 | Monte Carlo simulation, set your own return and risk | Range of futures | Portfolio Visualizer (5 to 75 years; historical or parameterised), Stock Rover Future Simulations (default 1,000 runs, 5 years, bull/bear, inflation, rebalancing, withdrawals) | Basic vs bootstrap vs parameterised | FEED | S6 S16 S20 [V/T] |
| 98 | Withdrawal strategies (fixed, % of balance, with inflation, taxed) | Retirement spending test | Portfolio Visualizer; Portfolio Charts (Withdrawal Rates, Retirement Spending) | Rule choice | none | S10 S20 [V/T] |
| 99 | Safe, perpetual and long-term withdrawal rate charts | Shows how much can be taken | Portfolio Charts F | Chart per portfolio and country | none | S10 [V] |
| 100 | Years to financial independence at a savings rate | FIRE view | Portfolio Charts (Financial Independence, Savings Rates), Ghostfolio FIRE | Chart | none | S8 S10 [V] |
| 101 | Goals (house, college, wedding) with projections | Plain targets | Wealthfront Path, Betterment, Empower, PV Financial Goals | Per goal | CLOUD | S6 S11 S14 [V] |
| 102 | Home purchase planner using debt-to-income and down payment | Can I afford it? | Wealthfront Path (home price data via Zillow/Redfin [T]) | Levers: timing, size | LOGIN, FEED | S14 S20 [V/T] |
| 103 | College savings (target school, 529) | Funding plan | Wealthfront Path | School picker | FEED | S14 S20 [V/T] |
| 104 | Time off planning (reduced income effect on goals) | Sabbatical or leave test | Wealthfront Path [T] | Scenario | none | S20 [T] |
| 105 | Social Security timing in the plan (62, 67, 70) | Claim-age comparison | Wealthfront Path [T], Empower | Choose ages | none | S20 [T] |
| 106 | What-if scenarios (save less, retire early, job change) | Compare futures | Empower, Wealthfront Path, Kubera AI ($3M house) | Few toggles to full | CLOUD | S1 S17 [V/T] |
| 107 | Emergency fund check in months | Safety rule | Ghostfolio X-Ray rule | Months set | none | S8 [V] |

### K. Backtests, risk and research

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 108 | Backtest an allocation over history | "What if I had held this?" | Portfolio Visualizer F/P, Portfolio Charts, Snowball (10y; 30y+ Investor), Stock Rover | Time range, rebalancing, cash flows | FEED | S5 S6 S10 [V] |
| 109 | Famous model portfolios (60/40, Three-Fund, Golden Butterfly, All Seasons) | Starting points | Portfolio Charts (21 lazy portfolios) | Presets | none | S10 [V] |
| 110 | Rolling returns | How outcomes vary by start date | Portfolio Charts (Rolling Returns, Start Date Sensitivity, Heat Map), PV | Window length | FEED | S10 [V] |
| 111 | Annual return distribution (after inflation) | Odds of a bad year | Portfolio Charts F | Chart | none | S10 [V] |
| 112 | Drawdown chart and recovery time | Pain of bad years | Portfolio Charts, Sharesight, PV | Chart | none | S10 S21 [V] |
| 113 | Volatility, Sharpe, correlation, beta | Risk numbers | Portfolio Visualizer (Asset Correlations), Stock Rover, Sharesight [T] | Table | FEED | S6 [V] |
| 114 | Efficient frontier and optimisation (Black-Litterman, rolling) | Mix for best risk and return | Portfolio Visualizer | Heavy | FEED | S6 [V] |
| 115 | Factor regression (value, size, momentum) | Why returns happened | Portfolio Visualizer (Fama-French/Carhart [T]), Factor attribution | Heavy | FEED | S6 S20 [V/T] |
| 116 | Tactical allocation models with forward signals | Rules-based switching | Portfolio Visualizer (Basic and Pro include YTD and signals) | Heavy | FEED | S6 S7 [V] |
| 117 | Fund screener and fund comparison | Pick funds | Portfolio Visualizer, Stock Rover (700+ screeners on Premium Plus), Morningstar | Filters | FEED | S6 S16 [V/T] |
| 118 | Stock research reports, fundamentals history | Company detail | Stock Rover (research reports, 10 years fundamentals on Investor+ in Snowball) | Heavy | FEED, paid | S5 S16 [V/T] |
| 119 | Inflation-adjusted (real) view of any chart | Honest long-run | Portfolio Charts (all charts), PV, Empower | Toggle | none | S10 [V] |
| 120 | Show returns for a home country (12 countries, local currency and inflation) | Not US-only | Portfolio Charts F | Country picker | none | S10 [V] |

### L. Managed and advisor features (for comparison, mostly not self-serve)

| # | Feature | What it does | Products (tier) | Depth | Flags | Src |
|---|---|---|---|---|---|---|
| 121 | Risk quiz that picks a portfolio | Matches to risk | Betterment, Wealthfront | 5 to 10 questions | ADVICE | S11 S14 [V] |
| 122 | Socially responsible and climate portfolios | Values-based | Betterment | Choice | TRADE, ADVICE | S11 [V/T] |
| 123 | Custom portfolios (pick your own funds/stocks) | Hands-on control inside managed | Betterment; Wealthfront (add/remove funds, adjust weights) | Light to heavy | TRADE | S11 S14 [V] |
| 124 | Human advisor access | Talk to a person | Betterment Premium ($100,000 minimum, 0.65%), free chats with a licensed specialist | Call | ADVICE, A | S11 S13 [V] |
| 125 | Portfolio line of credit (borrow against holdings) | Avoid selling | Wealthfront (at least $25,000; up to 30%; margin risk) | Borrow now | ADVICE, TRADE | S15 [V] |
| 126 | Automated bond ladder (Treasuries) | State-tax-exempt interest | Wealthfront | Choose term | TRADE | S15 [V] |
| 127 | Cash account with APY, insured | Park cash | Betterment (variable 3.50% at 9/21/2026 per its page), Wealthfront | Rate | ADVICE-adjacent | S13 [T] |
| 128 | Retirement account types (Traditional, Roth, SEP, Solo 401(k), rollover, backdoor Roth) | Right container | Betterment, Wealthfront | Choose | ADVICE | S11 S14 [V] |
| 129 | Family office features (many portfolios, advisors, clients) | Pro use | Sharesight Business, Snowball Business, Kubera Black | Account types | CLOUD | S4 S5 [V] |

## 3. What needs a bank login, trading, advice or a paid feed (for the "no bank logins, ever" promise)

- LOGIN: rows 1 (auto), 5, 29 (auto), 32, 33, 80, 81, 102. All have a manual or file-import equivalent in at least one product (rows 3 and 4), so the app can match them without a connection.
- TRADE: rows 65, 87, 89, 90, 91, 93, 122, 125, 126. The app cannot trade; it can show a plan or a list (rows 63, 68) and say plainly that nothing is sent.
- ADVICE (licensed, fiduciary): rows 60 (when it recommends a product), 83, 87 to 94, 121, 124. Present as information with a "not advice" note; the app should avoid saying "buy this fund".
- FEED (prices, fund holdings, home values, historical returns): rows 6, 11, 14, 54, 56, 118. Offline-friendly versions are typed prices, dated prices, and user-entered fund mixes (see 4).

## 4. Gaps and options worth noting for a typed-in, private app

1. Hardly any product separates "typed once a month" from "live". A "price as of" date on each holding and a plain staleness hint (row 6) is a rare option and fits the promise.
2. Look-through (row 56) is paywalled or discontinued almost everywhere (Morningstar Premium ended April 2025 [T]). A free, user-entered "what this fund holds" table of roughly 10 broad categories would beat several paid tools.
3. Money-weighted and time-weighted return (rows 37, 38) are split across products. Few explain the difference in plain words next to the figure. Showing both with one sentence each is cheap depth.
4. Ownership by person (row 10) is gated behind Kubera Black ($2,500 per year). Every household with a spouse or a trust wants it.
5. Hand-over (row 18) is a Kubera selling point. A printable "where everything is" page with no server is the private equivalent.
6. Tax-loss harvesting (row 87) is only offered as managed money. A free "list of positions with a loss, holding period, wash-sale window warning" would be new and needs no trading or login. Note rows 85 and 89 rely on the user's own lot data.
7. Real vs nominal (row 119) is standard in free chart sites and absent from most trackers.
8. Four common pairings people ask for: backtest with contributions, withdrawal test with taxes, rebalancing using only new money, and dividend calendar. All four exist in free or low tiers elsewhere and need only typed or file-imported inputs.

## 5. Uncertainties and things I could not confirm

- Empower: its own pages returned 404 or were not read; every Empower row is from third-party reviews (S17). The 0.50% fee benchmark is from a single review.
- Morningstar: the discontinuation is from Morningstar's own "upcoming changes" page as surfaced by search (S18); I did not open it. Current free X-Ray scope unknown.
- Getquin price conflicts (EUR 4.99 per month, about EUR 50 per year, EUR 89.99 per year); Premium feature split between S9 (official: long-term dividend forecast, TTWROR) and reviews. DeepDive tier unclear.
- Delta pricing conflicts (USD 58.99, 99.90 per year; USD 10.49 monthly). Features are from App Store text and a 2024 review.
- Stock Rover prices differ by source: official snippet via search says Essentials $79.99/yr, Premium $179.99/yr, Premium Plus $279.99/yr; older pages say more. Feature-per-tier from a blog post, may be stale.
- Portfolio Visualizer: pricing page read today shows Free, Basic ($30/mo billed annually), Pro ($55/mo billed annually), same features, different limits. Features of Monte Carlo and backtests came from third-party guides.
- Kubera: Yodlee as aggregator, sharing granularity and cost basis/currency details are from reviews or help-center titles, not read in full.
- Ghostfolio X-Ray rule list (which rules exist) was not found. Source code is the place to read it.
- Wealthfront Path: net worth view not confirmed; Zillow/Redfin data and Social Security timing come from review sites (S20).
- Betterment: Premium minimum and APY come from search summaries of its own pages (S13); RetireGuide details not found.
- Crypto wash-sale status conflicts across sources; treat as unsettled and as a user toggle.
- Wealthfront and Betterment fees and minimums can change; verify before they appear in the app.

## 6. Sources (all read 2026-11-13)

- S1 Kubera home and features https://www.kubera.com/ (fetched) [V]
- S2 Kubera Help, ownership tags https://help.kubera.com/article/172-ownership (via search summary) [T]
- S3 Sharesight features https://www.sharesight.com/features/ (fetched) [V]
- S4 Sharesight pricing https://www.sharesight.com/pricing/ (fetched) [V]
- S5 Snowball Analytics pricing https://snowball-analytics.com/pricing/ (fetched) [V]
- S6 Portfolio Visualizer home https://www.portfoliovisualizer.com/ (fetched) [V]
- S7 Portfolio Visualizer pricing https://www.portfoliovisualizer.com/pricing (fetched) [V]
- S8 Ghostfolio README https://github.com/ghostfolio/ghostfolio (fetched); features list page https://ghostfol.io/en/features (names only)
- S9 getquin portfolio tracker https://getquin.com/portfolio-tracker (fetched) [V]
- S10 Portfolio Charts https://portfoliocharts.com/ (fetched) [V]
- S11 Betterment investing https://www.betterment.com/investing (fetched) [V]
- S12 Betterment taxes https://www.betterment.com/taxes (fetched) [V]
- S13 Betterment pricing and Premium https://www.betterment.com/pricing , https://www.betterment.com/premium (search result summaries) [T]
- S14 Wealthfront IRA / Path https://www.wealthfront.com/path (fetched; content was the IRA page) [V]
- S15 Wealthfront tax blog https://www.wealthfront.com/blog/how-wealthfront-helps-lower-taxes/ (fetched) [V]
- S16 Stock Rover help and pricing https://www.stockrover.com/features , https://ww1.stockrover.com/?p=29508 (rebalancing), https://ww1.stockrover.com/help/future-simulations/settings/ (search summaries; pricing page itself had no per-plan detail) [T]
- S17 Empower reviews (third party) https://www.roboadvisorpros.com/a-review-of-empowers-free-tools/ , https://robberger.com/empower-review/ , https://www.moneycrashers.com/personal-capital-review/ [T]
- S18 Morningstar changes https://global.morningstar.com/en-eu/updates/upcoming-changes-our-membership-offerings-tools-features (search summary) [T]
- S19 Delta https://delta.app/en/pro , App Store listing https://apps.apple.com/us/app/id[number removed] , https://themodestwallet.com/delta-app-review/ [T]
- S20 Other third-party: Portfolio Visualizer guides https://algotrading101.com/learn/portfolio-visualizer-guide/ ; crypto tax tools https://getdtax.com/en/features , https://coinledger.io/blog/crypto-accounting ; Wealthfront Path write-ups https://www.wealthmanagement.com/financial-planning/wealthfront-to-offer-free-financial-planning ; Snowball summary https://snowball-analytics.com/portfolio-tracker [T]
- S21 Sharesight help https://help.sharesight.com/reports/ , https://help.sharesight.com/contribution-analysis-report/ (search summaries) [T/V]
