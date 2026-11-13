# Gap map: what other money apps have, against what this app has (2026-11-13)

Mapper's pass over the five research files in this folder, checked against this app at branch tip 707355c:
`docs/MODULE_CATALOG.md` (about 190 pages), every `modules/*/*/README.md` (purpose, formulas, ideas), `docs/DATA_MODEL.md`,
`docs/DESIGN_LOG.md`, the retirement spec `scratchpad/rv/spec.md` (its build steps spec L1 to spec L8: built, landing soon) and the wave 1 plans
`scratchpad/w1/plan-place.md`, `plan-forms.md` (integ worktree). Where a README was thin I read the code (named in the row).

## How to read it

- **Rows** name every research row the line covers, by file and row number: **Pl** = research-plan.md (retirement planners),
  **Ca** = research-cash.md (budgeting), **In** = research-invest.md (investments, net worth), **Li** = research-life.md (tax,
  debt, credit, insurance, estate, education, property, household), **Ux** = research-ux.md (how apps let a person choose
  depth). A map line's own number is one capital letter (its section) and a number, such as B17. All 560 rows are
  placed; duplicates across files are merged into one line.
- **Verdict**
  - **HAVE**: the app does it; the page is named.
  - **PARTIAL**: some of it is there; the cell says what is there and what is missing.
  - **MISSING**: nothing yet.
  - **OUT**: cannot be done without breaking the app's promise or the law. The reason is one of **BANK** (a bank or broker
    login, or account numbers), **TRADE** (placing trades or moving money), **ADVICE** (licensed advice: a planner, CPA or
    attorney acting for you), **FEED** (a paid market, price, property, credit or quote feed) or **SERVICE** (a vendor's
    cloud or staff doing it for you: email, public pages, cancelling or negotiating bills). SERVICE is my addition: those
    rows fit none of the four named reasons but cannot run on the household's own devices. Each OUT cell says the version
    that fits the promise, and whether the app has it.
  - **(soon)**: lands with the retirement spec (spec L1 Goal seek and Sensitivity fixes, spec L2 "What this rests on", spec L3 match check,
    spec L4 left-over counted, spec L5 assumption presets, spec L6 pay the tax now or later per row, spec L7 pay stub reader,
    spec L8 OFX/QFX/QBO import) or with wave 1 (place memory: open sections survive a redraw, Back and reload; the "More details (optional)"
    form fold; Undo).
- Counts: 315 merged lines. HAVE 142, PARTIAL 102, MISSING 50, OUT 21 (a line whose verdict reads "HAVE / OUT" is counted
  once, as HAVE). The gap list in section 2 has every one of the 152 PARTIAL and MISSING lines.

---

## 1. The map

| # | Feature (plain words) | Rows | Verdict | What this app has, what is missing, or why it is out |
|---|---|---|---|---|
| | **A. Getting started, depth and guidance** | | | |
| A1 | A first "am I on track" answer from a few questions | Pl1 Ux5 | HAVE | Set up my plan (7 questions, our guesses fill the rest, then where you stand and three moves); Get started; the Dashboard verdict. |
| A2 | A three-box answer ("I have X, I spend Y, for Z years") with defaults for the rest, no plan needed | Pl2 | PARTIAL | Quick answers opens 11 calculators that work on an empty plan (house, rent or buy, backtest, risk...). "Will my money last?" still needs the plan: 7 questions or a 20-minute guide. |
| A3 | Change a number and watch the answer move (sliders, levers, retest) | Pl3 Ux24 | PARTIAL (soon) | Pages recompute on save; spec L2 "What this rests on" shows each number's effect on Will the money last?; Scenario compare. No live slider that moves the answer before saving. |
| A4 | Optional sections that open on request; folded advanced settings with a status line | Pl4 Ux6 Ux13 | HAVE | DESIGN_LOG 2026-11-12 "simple first" rule; fold cards with a one-line status; wave 1 "More details (optional)" fold and open sections that survive Back and reload (soon). |
| A5 | Completeness or wellness score split into parts, with what to add next | Pl5 Ux5 Ux9 Ux19 | HAVE | Plan health score (7 parts, where the missing points are); Dashboard setup steps; Your plan "not finished yet"; Help first steps. |
| A6 | Guided interview first, free use after; a learning path | Ca97 Ux10 | HAVE | Set up my plan; Step by step guides; one path with Next on every page to Your plan. |
| A7 | Life milestones as the plan's building blocks: part-time years, a career break or sabbatical, a big trip | Pl6 In104 | PARTIAL | Life timeline shows the dates; Life events walks six events (marriage, baby, job, move, inheritance, divorce). The engine takes one-off events and spending changes (`core/math/retirement.js` `events`, `spendingChanges`), but a person cannot add "no pay in 2028" or "part-time 60 to 65" to their own projection. |
| A8 | Retire when a condition is met ("when savings reach $X") | Pl7 | MISSING | Goal seek finds an age; Financial independence finds a year; no rule in the plan. |
| A9 | My own definition of financial independence | Pl8 In100 | HAVE | Financial independence: withdrawal rate, FI number, coast number, years to FI. |
| A10 | Edit any input year by year (or month by month) | Pl9 Pl10 | MISSING | Year by year is a read-only table. |
| A11 | Two people, two ages, two incomes | Pl11 | HAVE | People, every engine. |
| A12 | Survivor years after a partner dies | Pl12 | HAVE | How long to plan for (each and either of a couple), survivor benefit on Social Security, "losing a partner" stress test, Life insurance needs. |
| A13 | Saved alternative plans side by side | Pl13 Pl14 Ux25 Ux26 Ux27 Ca16 In106 | PARTIAL | Scenario compare (copies with changed returns, inflation, stock share, ages, claiming, spending, saving; chance and spending side by side); Advisor's plan. Missing: "make this version my plan", levers for selling the house, a part-time job, a pension or the withdrawal rule, and a what-if copy of the budget. |
| A14 | Start from an example household or a template | Pl15 Ux12 | PARTIAL | `?sandbox=1` opens a private practice plan, but empty; the invented households in `qa/` are for builders. No "look around with a pretend family", no starting templates. |
| A15 | Works with no account linking | Pl16 Ux98 Ux68 | HAVE | The on-screen promise; everything can be typed. |
| A16 | Link the bank or broker for automatic balances, transactions, holdings, bill and income detection | Pl17 Ca39 Ca40 In5 In29 In32 In80 In81 Ux44 Ux92 Li20 Li28 Li91 | OUT (BANK) | Fits, and the app has them: CSV import, Statement reader (PDF or photo, on the PC), Update my balances, holdings from the broker's positions file; OFX/QFX/QBO (soon, spec L8) and the pay stub reader (soon, spec L7). `transactions/connect` (SimpleFIN) is a placeholder that waits on the owner's yes and would break the promise. |
| A17 | Ask an AI about my money | Pl18 Ca66 Ux82 In22 Li21 | HAVE | Ask the plan, Explain a page, Plan critic; local model by default, names hidden. |
| A18 | AI drafts changes to the plan for me to approve | Pl18 Ux38 Ux84 | PARTIAL | Document reader and Voice notes propose entries applied one by one (rule 5). Ask the plan only chats; it cannot propose a change. |
| A19 | Keep the actual files (statements, deeds) with the plan | Pl19 In19 | PARTIAL (by design) | Document vault index keeps where each paper is, never the file (its own rule); the readers keep nothing. |
| A20 | The whole plan as one document; printable reports; PDF, CSV and JSON | Pl20 Pl21 Ux99 Ca89 Ux64 | HAVE | Your plan, Plan summary, Financial statements, Retirement report, Tax report, Annual review, Export (any table to CSV), the plan file in Settings, print to PDF. |
| A21 | Share a link that rebuilds a calculator's inputs | Pl22 | MISSING | |
| A22 | Partner, advisor or accountant with their own access; read-only; explore without saving | Pl23 Pl24 Ca81 Ca84 In16 Ux75 Ux77 | PARTIAL | The PC serves one plan to every device; `?sandbox=1` explores without touching it; print and export for an advisor. Devices (name, revoke, read-only) is still a placeholder. |
| A23 | Mine, yours, ours: views per partner, hide an account | Ca82 Ux76 | PARTIAL | Balance sheet by owner; Income by person. No per-person filter on spending or accounts; nothing can be hidden from a partner. |
| A24 | Progress against the plan drawn earlier | Pl25 | MISSING | Performance compares returns with the plan's; nothing compares today's net worth with the path the plan drew a year ago. |
| A25 | The actual year against the plan (income and spending) | Pl26 Ca55 Ux51 | HAVE | Income statement (actual next to the Income and Expenses pages), Budget, Monthly check-in, Annual review. |
| A26 | The same plan on phone and computer | Pl27 | HAVE | The PC server with a version check; the phone copy. (Plugins: the module system, for builders.) |
| A27 | Short lessons, classes, newsletter | Pl28 Ux20 | PARTIAL | Glossary, Help, guides. No short lessons. |
| A28 | A glossary of every term | Ux16 | HAVE | Glossary (plain words, an example, the pages that use it). |
| A29 | Human help: coaching, planner, CPA, attorney | Pl29 Ux21 Ca96 Li22 Li72 In124 | OUT (ADVICE) | Fits, and the app has them: Advisor's plan (their assumptions through this engine), Contacts. |
| A30 | Choose and arrange what the first screen shows | Ux1 Ca62 Ca93 | PARTIAL | Pages can be switched off in Settings; the Dashboard's cards are fixed. |
| A31 | Switch a whole area off; try unfinished features | Ux3 Ca91 | HAVE | Settings page switches; "Show what is still being built". |
| A32 | One figure or itemized, per section | Ux8 | PARTIAL | Setup takes totals and guesses the rows; Expenses has rows. No "one figure / itemize" choice per section. |
| A33 | Edit like a spreadsheet; own the data | Ux11 Ux96 | PARTIAL | CSV of any table and the plan file; no grid editing. |
| A34 | A monthly review ritual; an emailed recap | Ux80 Ux81 Ca87 In15 | HAVE / OUT (SERVICE) | Monthly check-in (ten minutes, a streak, a note). Email needs a mail service. |
| A35 | Reminders and a money to-do list | Ca90 | HAVE | Voice notes reminders, Needs attention, Monthly check-in. |
| A36 | Ways to improve my plan, ranked | Ux37 | HAVE | Goal seek, Next best action, health score gains, Plan critic. |
| A37 | A nudge to recheck old figures | Ux39 | HAVE | Stale balances (31 days), Assumptions review date, Monthly check-in. |
| A38 | All features free and the same on phone and computer | Ca94 Ca95 Ux7 Ux88 | HAVE | No paid tiers; nothing is desktop-only. |
| | **B. "Will the money last?": how the answer is shown** | | | |
| B1 | Chance of success from random runs, with the count shown | Pl30 Ux22 In96 | HAVE | Chance the money lasts: 2,000 runs, the share that last, bands, share still funded by age. |
| B2 | Replay every start year in history | Pl31 Ux15 | HAVE | If history repeated (1928-2025); Backtest (1871-2025). |
| B3 | Bootstrap sampling, loop choice, fixed seed, random inflation | Pl32 Pl33 Pl34 | PARTIAL | Seeds are fixed (reports use seed 1). Bootstrap and random inflation are README ideas. |
| B4 | My own average return, spread and inflation | Pl35 | HAVE | Assumptions (returns, volatility, inflation). |
| B5 | A fan chart of the range by year | Pl36 | HAVE | Chance the money lasts (10th to 90th percentile). |
| B6 | Histogram of outcomes; milestone table | Pl37 | PARTIAL | Median end, 10th percentile, failure ages, share funded by age; no histogram. |
| B7 | Every run in a table | Pl38 | PARTIAL | If history repeated lists every start year; random runs are not listed or exported. |
| B8 | Money and survival together ("rich, broke or dead") | Pl39 | PARTIAL | Longevity odds and share funded by age are on separate pages. |
| B9 | Choose how cautious (50, 75, 90%) | Pl40 | PARTIAL | The careful figure is fixed at 9 markets in 10. |
| B10 | My own thresholds and colors for "good" | Pl41 | MISSING | Fixed at 85% and 70%. |
| B11 | A spending range with guardrails instead of one figure | Pl42 Ux36 | HAVE | Guardrails rule on How much to take out and in the engine. |
| B12 | The most I can spend, steadily | Pl43 Ux23 | HAVE | "Spending it can carry" and the careful figure. |
| B13 | Stress tests | Pl44 | HAVE | Stress tests: crash at retirement, high-inflation decade, job loss, illness, losing a partner, long life. |
| B14 | Which accounts count toward success | Pl45 | MISSING | |
| B15 | Which input moves the answer most | Pl46 | HAVE | Sensitivity ("What changes your answer", soon, spec L1). |
| B16 | Solve backward from the goal | Pl47 | HAVE | Goal seek (spending, retirement age, saving, return, lump sum, claim age). |
| B17 | Show how each number was made | Pl48 Ux17 Ux18 | PARTIAL (soon) | spec L2 "What this rests on" (each number: Yours, Our guess, Usual figure, Not counted, and its effect); "What goes into this"; Explain a page (AI). Missing: a "how we got this" fold on other figures, and a methodology page in the household's view (Docs is builder-only). |
| | **C. Spending and withdrawals in retirement** | | | |
| C1 | Steady, inflation-adjusted spending | Pl49 | HAVE | Fixed-real rule. |
| C2 | A percent of savings, with a floor | Pl50 | HAVE | Share-of-savings rule; guardrails floor. |
| C3 | A catalog of named withdrawal rules | Pl51 In98 | PARTIAL | Four (fixed-real, share of savings, guardrails, VPW) on your plan and the worst history. FI Calc has 13 (95% rule, endowment, CAPE-based, 1/N, Vanguard dynamic...). |
| C4 | Spending that eases with age | Pl52 | MISSING | The engine's `spendingChanges` is used only for a survivor. |
| C5 | Cut spending by X% after a fall of Y% | Pl53 | PARTIAL | Guardrails cuts 10% at fixed bands (1.2 and 0.8 of the rate); not settable. |
| C6 | One-off spending or money in: selling or downsizing the home, a big purchase, an inheritance | Pl54 Pl100 | PARTIAL | Expected inheritance runs as a what-if; Big purchase and Travel are goals; the engine takes one-off events, but the main projection drops one-offs and the person cannot add one. |
| C7 | Leave a minimum for heirs | Pl55 | HAVE | Legacy goals; Goal seek's "leave". |
| C8 | Which account first; or a share from each | Pl56 Ux31 In92 | PARTIAL | Withdrawal order (four orders, lifetime tax, one tap). A proportional order is a README idea. |
| C9 | The best strategy found and applied in one tap | Pl57 | PARTIAL | Withdrawal order and Roth conversions each rank options with "Use this one"; no joint search over order, conversions and gain harvesting. |
| C10 | Spend what the rule allows | Pl58 | HAVE | "Use this one" on How much to take out. |
| C11 | A flow picture of where money goes each year (Sankey) | Pl59 Ca56 | MISSING | |
| C12 | The cost of fees over the plan | Pl61 | HAVE | Fees (lifetime cost), Advisor's plan (what the fee costs). |
| | **D. Roth and taxes in retirement** | | | |
| D1 | Roth conversions year by year | Pl62 Li15 | HAVE | Roth conversions: fill the 10, 12, 22 or 24% bracket before required withdrawals, a table by year, lifetime tax. |
| D2 | Conversion targets: stay under the Medicare surcharge line, the marketplace credit line, the 0% gains band; most for heirs; least lifetime tax | Pl63 Ux28 Li13 | PARTIAL | Bracket fill only; IRMAA and the credit cliff are shown as warnings. "Stop at the IRMAA line" and "stay under the credit line" are README ideas. |
| D3 | Early access: a Roth conversion ladder, 72(t) payments | Pl64 | MISSING | Only the age-55 rule is noted (Will the money last? README). |
| D4 | Backdoor and mega-backdoor Roth | Pl65 | PARTIAL | Contribution limits says when a direct Roth IRA is not allowed; after-tax 401(k) money (mega) is not modelled. |
| D5 | Lifetime tax, federal and state | Pl66 | PARTIAL | Federal through the real brackets every year (Tax, year by year); no state tax in retirement years. |
| D6 | A flat average tax rate as the simple choice | Pl67 | HAVE | The projection's flat setting, beside the brackets. |
| D7 | Tax on Social Security | Pl68 | HAVE | The benefits worksheet in every tax page. |
| D8 | Alternative minimum tax; a law-change toggle | Pl69 | PARTIAL | AMT for incentive options on Equity compensation; not in the Federal estimate otherwise; no law-change switch. |
| D9 | The 3.8% investment tax; the 10% early-withdrawal penalty | Pl70 | PARTIAL | The 3.8% tax is in. The 10% penalty is on the balance sheet's cashed-in value only; the projection does not charge it when the plan draws early. |
| D10 | Harvest gains in low years | Pl71 Ux30 Li17 | PARTIAL | Capital gains shows the gain that still fits at 0% this year; nothing over several years. |
| D11 | Required withdrawals; gifts from an IRA; donor-advised funds | Pl72 Li118 Li121 | PARTIAL | Required withdrawals (this year's amount, deadline, "I've taken it"); Giving (IRA gifts after 70 1/2, bunching). A donor-advised fund is mentioned, not modelled. |
| D12 | An inherited IRA's ten-year rule | Pl73 | MISSING | Expected inheritance has an "ira" kind; the spread of its tax is an idea. |
| D13 | HSA, 529, annuity and real-estate accounts | Pl74 | HAVE | |
| D14 | Stock pay and deferred pay | Pl75 In26 | PARTIAL | RSUs, options (ISO and NSO), ESPP: Equity compensation, Employer stock. Deferred compensation plans are not there. |
| D15 | Read last year's tax return, W-2 or 1099 for ideas and figures | Pl76 Li11 | MISSING | Document reader reads pay stubs, statements, a Social Security statement, an advisor's plan; 1040, W-2 and 1099 are README ideas. |
| D16 | Move money between accounts inside the plan | Pl77 | MISSING | |
| D17 | Other countries: their taxes, pensions, currency, market history | Pl78 Pl107 Ux35 In120 | MISSING | US only. |
| | **E. Social Security, pensions, annuities, work** | | | |
| E1 | Claim at any age 62 to 70 | Pl79 In105 | HAVE | Social Security; Goal seek's claiming lever. |
| E2 | The best pair of claiming ages for a couple | Pl80 Ux32 | PARTIAL | Each age's benefit, spousal top-up and survivor amount; Goal seek moves everyone to the same age. No search over both ages. |
| E3 | Special cases: divorced, still working (earnings test), children, possible benefit cut | Pl81 | PARTIAL | Disability and survivor benefits before 62; Sensitivity nudges the benefit down. Earnings test, ex-spouse and child benefits are missing. |
| E4 | Benefit from the statement or the earnings record | Pl82 | HAVE | Social Security (record or statement); Document reader. |
| E5 | Pensions: start, inflation, lump sum, survivor option | Pl83 | HAVE | Pensions. |
| E6 | An income annuity | Pl84 | HAVE | Annuities (a quote against the plan). |
| E7 | Working in retirement; income with start and end ages | Pl85 | PARTIAL | A partner's pay, rent and other income with dates count. Part-time pay after one's own retirement date and the FI page's "barista" view are not there. |
| | **F. Health, care, how long** | | | |
| F1 | Health costs by stage of life | Pl86 | HAVE | Healthcare before 65, Medicare and IRMAA, the health line in the projection. |
| F2 | Medicare parts, supplements, the income surcharge | Pl87 | HAVE | Medicare and IRMAA. |
| F3 | Marketplace credit before 65 | Pl88 Ux29 | HAVE | Healthcare before 65 (the credit, the cliff). |
| F4 | Long-term care: odds and cost | Pl89 Li64 | PARTIAL | Long-term care (odds, cost, self-insure or a policy). National medians; costs by state are an idea. |
| F5 | Life table, sex, health, the age to plan to | Pl90 | HAVE | How long to plan for. |
| F6 | Life insurance in the plan | Pl91 Ux33 | HAVE | Life insurance needs (the plan's own answer for a couple). |
| | **G. Assumptions and the big picture** | | | |
| G1 | Inflation choices; a separate rate for health costs | Pl92 | PARTIAL | One inflation figure (chips 2.5, 3, 4% soon, spec L5); no separate health inflation. |
| G2 | Ready-made mixes (60/40, Three-Fund, Golden Butterfly) | Pl93 In109 | PARTIAL | Backtest presets 100/0 to 0/100 (stocks and bonds only). |
| G3 | Return assumptions: careful, middle, hopeful, historical, my own | Pl94 Ux14 | HAVE (soon) | Assumptions; spec L5 presets with sources and the effect on the answer. |
| G4 | A mix for my risk and stage of life; a risk questionnaire | Pl95 In60 In121 | PARTIAL | Stocks by age (plan path, 110 minus age, target-date), Risk (worst year in dollars), Allocation drift. No questionnaire. |
| G5 | Mix of tax buckets (pay tax later, now, never) | Pl96 | HAVE | Net worth's tax buckets; per row soon (spec L6). |
| G6 | A map of the whole household | Pl97 | HAVE | Your plan, Balance sheet, Cash-flow statement. |
| G7 | A chance of reaching each goal | Pl98 | PARTIAL | Each goal on time or late (Goals, Goal prioritizer); no chance per goal. |
| G8 | Estate, what heirs get, estate tax | Pl99 Ux34 | HAVE | Legacy goals, Estate tax, Gifting. |
| G9 | The home and rentals in the plan | Pl100 | PARTIAL | Home value and equity in Net worth projection; rent counts as income. Selling or downsizing: see C6. |
| G10 | College costs before retirement | Pl101 | PARTIAL | Education (529); goals are not taken out of savings in Net worth projection (README idea). |
| G11 | Debts paid off free up money | Pl102 | HAVE | Loans end in the projection on the payoff plan. |
| G12 | Retire in each year of a range | Pl103 | HAVE | Goal seek; Scenario compare. |
| G13 | What changing stocks and bonds does | Pl104 | HAVE | Backtest, Risk, Sensitivity. |
| G14 | An alert when spending should change | Pl105 | PARTIAL | Monthly check-in and Needs attention; no "your guardrail was crossed, trim by $X". |
| G15 | My own charts and saved reports | Pl106 Ca60 Ux100 | MISSING | CSV export and fixed tables only. |
| | **H. Budgeting** | | | |
| H1 | Give every dollar a job (zero-based, "money to assign") | Ca1 Ux40 | MISSING | A README idea on Budget. |
| H2 | Envelopes that hold money; move money between them | Ca2 Ux53 | PARTIAL | Budget: monthly envelopes with rollover. Moving money between envelopes is missing. |
| H3 | A tracking budget (watch, no envelopes) | Ca3 | HAVE | Budget pace, Where the money goes, Expenses. |
| H4 | Percent splits (50/30/20 or my own) | Ca4 | HAVE | Budget (50/30/20). |
| H5 | A flex budget: fixed, flexible, non-monthly | Ca5 Ux2 | PARTIAL | Expenses (must pay or could cut) and Irregular expenses; no three-bucket budget mode. |
| H6 | One "left over" figure after bills and saving | Ca6 Ux4 | HAVE | Dashboard, Next best action, Expenses. |
| H7 | Safe to spend today or this week | Ca7 | PARTIAL | Budget shows what is left in each envelope and the pace this month; no single figure for today. |
| H8 | Roll over what is unspent | Ca8 Ux41 | HAVE | Budget. |
| H9 | Choose how overspending is handled | Ca9 | MISSING | Overspending never carries. |
| H10 | Hold money for next month; age of money | Ca10 Ca63 Ux52 | MISSING | |
| H11 | Copy last month; fill from an average | Ca11 | HAVE | Suggestions from whole bank months; "Use these as my budget" from Expenses. |
| H12 | Targets per category (by a date, monthly, weekly) | Ca12 Ux42 | PARTIAL | Goals and Irregular expenses give monthly set-asides; envelopes are monthly only (yearly envelopes are an idea). |
| H13 | Sinking funds, with what is already set aside in each | Ca13 | PARTIAL | Irregular expenses turns each into a monthly amount; what is already set aside per fund is an idea. |
| H14 | A budget per paycheck | Ca14 | MISSING | Paycheck shows take-home per paycheck; no budget by pay period. |
| H15 | Start the budget over, keep the history | Ca15 Ux50 | PARTIAL | Settings erases the device's plan; no budget-only reset. |
| H16 | His, hers, ours: sharing costs fairly as a couple | Ca17 | MISSING | |
| H17 | Switch budget method | Ca92 | HAVE | Budget, Budget (50/30/20), tracking through Expenses; page switches. |
| | **I. Categories, rules and cleaning up** | | | |
| I1 | Own categories: rename, icon, hide; groups or sub-categories | Ca18 Ca19 Ux62 | PARTIAL | Categories (rename, icon, hide, add). Sub-categories and merging two are ideas. |
| I2 | Rules that file transactions | Ca20 Ux58 | HAVE | Rules (text, account, direction, rename). |
| I3 | Categorizing that learns | Ca21 Ux83 | HAVE | Categorize (rules, history), Categorizer (AI in bulk, with confidence, local). |
| I4 | Advanced rules: amounts, patterns, several actions, order | Ca22 | PARTIAL | Amount ranges, patterns, tags in the "then" part and ordering are README ideas. |
| I5 | Clean payee names; merge merchants | Ca23 | PARTIAL | Rename through rules; the AI's clean names. Merging ("Amazon Mktpl" + "Amazon Prime") is an idea. |
| I6 | Split one transaction across categories | Ca24 Ux59 Ux57 | MISSING | A README idea on Ledger. |
| I7 | Split a bill with other people; who owes whom | Ca25 | MISSING | |
| I8 | Tags across categories (a trip, tax-deductible) | Ca26 Ux60 | PARTIAL | Tags can be typed on a transaction (Ledger); no filter, report or rule uses them. |
| I9 | Notes on a transaction | Ca27 | HAVE | Ledger (searchable). |
| I10 | Flags; a "to review" inbox | Ca28 Ux61 | PARTIAL | Categorize is the inbox for unfiled lines; no flags. |
| I11 | A receipt photo on a transaction | Ca29 Li93 | MISSING | The app keeps places, not files. |
| I12 | Returns and reimbursements linked to the purchase | Ca30 | MISSING | |
| I13 | Leave a line or category out of reports | Ca31 Ux66 | PARTIAL | Transfers and hidden categories are left out; no per-line exclude. |
| I14 | Transfers between my own accounts not counted as spending | Ca32 | HAVE | Transfers. |
| | **J. Getting transactions in** | | | |
| J1 | Type a transaction | Ca33 | HAVE | Ledger. |
| J2 | Bank CSV with columns worked out | Ca34 Ux63 | HAVE | Import (profiles remembered). |
| J3 | OFX, QFX, QBO and QIF files | Ca35 | PARTIAL (soon) | OFX/QFX/QBO in spec L8 (no account number kept); QIF is not planned. |
| J4 | European bank files (CAMT.053) | Ca36 | MISSING | |
| J5 | Duplicates skipped on import | Ca37 | HAVE | Import, Duplicates. No "off" switch; "keep both" is not remembered. |
| J6 | A PDF or photo of a statement read into rows | Ca38 | HAVE | Statement reader (on the PC). |
| J7 | Check against the statement balance | Ca41 Ca42 Ux49 | HAVE | Check a statement. |
| J8 | Undo; a log of what changed | Ca43 | HAVE | Change log, Backups; one-tap Undo (soon, wave 1). |
| J9 | Bring files from another app (Mint, YNAB, Monarch) | Ux65 | PARTIAL | Any CSV with mapping; no named presets for other apps' exports. |
| | **K. Bills, subscriptions, the calendar** | | | |
| K1 | Regular bills and paychecks | Ca44 Ux43 | HAVE | Bills and regular payments (from the files and from Income and Expenses). |
| K2 | Find repeating charges by themselves | Ca45 | HAVE | From imported files (live detection is A16, OUT). |
| K3 | Tie a found payment to a bill; "add it to Expenses" | Ca46 | PARTIAL | Found by payee and rhythm; one-tap "Add to Expenses" is an idea. |
| K4 | Upcoming bills, paydays and tax dates on a calendar | Ca47 Ux45 Ux46 Li43 Li123 | HAVE | Money calendar (bills, paydays, tax dates, RMD, renewals) and its calendar file; due within 14 days. |
| K5 | List of subscriptions; cancel them for me | Ux54 Ca48 | HAVE / OUT (SERVICE) | Subscriptions. Cancelling needs a service with your logins. |
| K6 | Bill negotiation | Ca49 Ux55 | OUT (SERVICE) | A company haggling for a fee. |
| K7 | Pay bills from the app | Ca50 | OUT (TRADE: moving money) | |
| K8 | Alert when a bill goes up or a new charge appears | Ca51 | MISSING | "Amount drift" is a README idea. |
| K9 | Find paychecks in the files | Ca52 | HAVE | Bills and regular payments. |
| | **L. Cash-flow forecast and reports** | | | |
| L1 | Balance day by day ahead; warning before it dips | Ca53 Ca54 Ux89 | HAVE | Cash-flow forecast (90 days, shortfall date), Needs attention. |
| L2 | Cash flow by account or by person | Ca57 | PARTIAL | By account (Forecast, Account detail). Not by person. |
| L3 | Spending by category over months (trend) | Ca58 | PARTIAL | Where the money goes: a month against the one before; a 12-month trend is an idea. |
| L4 | The year in review | Ca61 | HAVE | Annual review pack. |
| L5 | Watch one payee or category | Ca64 Ux56 | PARTIAL | Envelopes watch a category; nothing watches a payee. |
| L6 | Pace: spending against where it should be by today | Ca65 Ux47 | HAVE | Budget pace. |
| L7 | Compare with households like mine | Ca67 | HAVE | How am I doing (Fed survey medians; percentiles are an idea). |
| | **M. Goals and saving** | | | |
| M1 | Savings goals with a date, tied to accounts | Ca68 Ca69 Ca70 In101 | HAVE | Goals, Goal prioritizer, and the planners for house, car, college, travel. |
| M2 | Round-ups and automatic transfers | Ca72 | OUT (TRADE: moving money) | Fit: the monthly amount to set up at the bank (Goals has it). |
| M3 | An order of steps (Baby Steps style) | Ca73 | HAVE | Next best action. |
| | **N. What you own and owe** | | | |
| N1 | Net worth and its history; typed accounts | Ca59 Ca74 In1 In2 In3 Ux67 Ux48 | HAVE | Net worth, Account detail, Update my balances. |
| N2 | "As of" dates and staleness | In6 | HAVE | Every balance is dated; stale after 31 days; holdings carry a price date. |
| N3 | Several currencies; one total in mine; currency gains | Ca79 In11 In12 Ux102 | MISSING | One currency per plan. |
| N4 | Owner per account; part shares; a trust | In10 | PARTIAL | Owner per account; Balance sheet by owner. No part shares, no trust as owner. |
| N5 | My own labels on accounts or holdings ("kids", "retirement") | In9 | MISSING | |
| N6 | Several portfolios and one combined view | In7 In8 | HAVE | Accounts and Holdings. |
| N7 | Home and car values filled in | Ca77 In23 Li98 | OUT (FEED) | Fit, and the app has it: a typed value with its date. |
| N8 | Assets that grow or lose value at a set rate | In24 | HAVE | Net worth projection (home growth, car loss); Asset register (worth now). |
| N9 | Private investments: cost, mark, IRR, capital calls | In25 | PARTIAL | Typed as another asset; no IRR or capital calls. |
| N10 | Gold and silver by weight | In27 | PARTIAL | Typed value only; spot prices are FEED. |
| N11 | Cars, jewelry, valuables; a home inventory | In28 Li124 | HAVE | Asset register (belongings, the policy that covers each). |
| N12 | Loans beside assets | In29 | HAVE | Debts. |
| N13 | Cash accounts and their interest | In30 | HAVE | Emergency fund (what the cash earns). |
| N14 | Crypto by coin | In31 Ca76 Ux73 | HAVE | Crypto (typed coins and lots). |
| N15 | Wallet and exchange sync; DeFi and NFTs | In32 In33 | OUT (BANK, FEED) | Fit: typed coins (HAVE). Staking income is not modelled. |
| N16 | Crypto lot methods and Form 8949 | In34 In35 | PARTIAL | Lots, tax if sold, harvest with the wash-sale check; no method choice, no 8949 file. |
| N17 | Hide the amounts (privacy mode) | In21 | MISSING | |
| N18 | Phone and computer | In20 Ux91 | HAVE | |
| N19 | If I stop checking in, my family gets the list | In18 Ux74 Li76 | OUT (SERVICE) | Fit: a printable "if something happens to us" packet. The parts are on Document vault index, Contacts, Beneficiary audit, Digital assets and Estate documents; one printable packet is a README idea. |
| N20 | A public portfolio page | In17 | OUT (SERVICE) | Needs a public server; against the private design. |
| | **O. Investments** | | | |
| O1 | Holdings typed or from the broker's positions file | In4 In6 Ca75 | HAVE | Holdings (Fidelity, Schwab, Vanguard CSV); OFX positions later. |
| O2 | Buy and sell history imported | In4 | MISSING | Positions only; lots typed on Tax lots. |
| O3 | Live prices; watchlist; price alerts | In6 In13 In14 | OUT (FEED) | Fit: typed price with its date (HAVE). |
| O4 | Gain, return with dividends and fees | In36 In39 | HAVE | Holdings, Performance. |
| O5 | Money-weighted and time-weighted return, each explained | In37 In38 In48 | HAVE | Performance. |
| O6 | Quick periods (YTD, 1 year, 5 years), my own dates, year by year | In40 In41 In42 | PARTIAL | Periods between saved balance points; whole calendar years for the benchmark. No chips, no date range. |
| O7 | Which holdings drove the result; best and worst | In43 In45 | MISSING | Needs per-holding history; Tax lots shows gain per lot. |
| O8 | Why my portfolio moved today | In44 | OUT (FEED) | |
| O9 | Realized and unrealized gains | In46 | PARTIAL | Unrealized per lot (Tax lots); sales typed on Capital gains. |
| O10 | How far my mix has fallen in the past | In47 In112 | HAVE | Risk, Backtest (deepest fall, years to recover). |
| O11 | Compared with an index | In49 Ux71 | HAVE | Performance (an index mix of the plan's stock share). |
| O12 | Compared with a benchmark of my choice | In50 | PARTIAL | Index mix only. |
| O13 | My trades against plain indexing; holdings that lag | In51 In52 | OUT (FEED) | |
| O14 | Mix by asset class and by account type | In53 In55 Ux70 | HAVE | Allocation, Asset location. |
| O15 | Mix by country, region, sector, currency | In54 | PARTIAL | US and international only; finer splits need fund data (FEED) or typing. |
| O16 | What funds hold inside ("X-ray"); overlap | In56 In58 | PARTIAL | Balanced and target-date funds split into US, international and bonds from a 100-fund table; no typed look-through, no overlap of one company across funds. |
| O17 | Style box | In57 | OUT (FEED) | |
| O18 | A checklist of portfolio rules | In59 In107 | HAVE | Plan health score, Needs attention, Fees (priciest), Employer stock, Crypto share. |
| O19 | Too much in my employer's stock | In61 | HAVE | Employer stock. |
| O20 | Target mix, drift, the trades to fix it, new money first, a band | In60 In62 In63 In64 In66 Pl60 | HAVE | Allocation, Rebalance. A calendar schedule and whole-share rounding are not there. |
| O21 | Done-for-you investing: auto-rebalance, harvesting, direct indexing, values-based or custom portfolios, a line of credit, a bond ladder bought for you, a cash account | In65 In87 In91 In93 In94 In122 In123 In125 In126 In127 Li27 | OUT (TRADE, ADVICE) | Fit, and the app has it: the list of what to do (Rebalance, Tax lots, Asset location swaps, Giving's shares); nothing is sent. |
| O22 | Preview a trade and its tax; see the new mix | In67 In68 | PARTIAL | Rebalance names the tax on its own sells; trying any trade and seeing the new mix is missing. |
| O23 | Rebalanced against buy-and-hold over history | In69 | MISSING | Backtest rebalances yearly only. |
| O24 | Dividends: what came in, a monthly calendar, the next year, yield on cost | In70 In71 In72 In73 In77 | PARTIAL | Dividends: a year's estimate by fund and account, interest, what it covers. Actual payments (ledger or 1099), the calendar and yield on cost are missing. |
| O25 | Dividend ratings, screeners, research, factor analysis, timing signals, automatic splits | In74 In75 In76 In115 In116 In117 In118 | OUT (FEED) | |
| O26 | Fund costs, total fees a year, the lifetime cost, a 401(k)'s own fees, an advisor's fee | In78 In79 In80 In83 Ux69 Ca80 | PARTIAL | Fees (fund table and typed ratios, advisory fee, lifetime cost, a cheap alternative). A 401(k)'s administration fee has no box. |
| O27 | Trading and crypto fees paid | In81 In82 | MISSING | |
| O28 | A tax report for the accountant | In84 | PARTIAL | Tax report, Tax documents checklist, Capital gains (typed sales). No year-end gains summary from the lots. |
| O29 | Lots with holding periods; choose the lot method | In85 In86 | PARTIAL | Tax lots (short or long, days to long, sell-first order); no FIFO, highest-cost or specific-lot choice. |
| O30 | Losses worth harvesting, with the wash-sale window | In88 In89 | HAVE | Tax lots and harvesting, Crypto. |
| O31 | Bonds in the IRA, stocks in the taxable account | In90 | HAVE | Asset location. |
| O32 | Export to tax software | In95 | MISSING | CSV only. |
| O33 | Backtest a mix, in today's dollars or not | In108 In119 | HAVE | Backtest (1871-2025, real or nominal). |
| O34 | Backtest with money added and taken out | In97 | PARTIAL | If history repeated replays the whole plan; Backtest has no cash flows. |
| O35 | Rolling returns; spread of yearly returns | In110 In111 | PARTIAL | Ten-year stretches, losing-year share, best and worst year; no rolling chart or distribution. |
| O36 | Volatility, Sharpe, correlation; efficient frontier | In113 In114 | PARTIAL | Standard deviation only. |
| O37 | Safe and perpetual withdrawal rates | In99 | PARTIAL | Safe spending from the hardest starts (If history repeated); no perpetual rate. |
| O38 | Years to FI at each savings rate | In100 | PARTIAL | Financial independence for your rate; the full table is an idea. |
| O39 | The right account type (Roth, traditional, SEP, solo 401(k)) | In128 | HAVE | Contributions, Contribution limits, Self-employment; per row soon (spec L6). |
| O40 | Advisor or family-office tools for many clients | In129 Ux78 | OUT (ADVICE) | |
| | **P. Taxes this year** | | | |
| P1 | Refund or owe | Li1 | HAVE | Federal estimate, Withholding check. |
| P2 | Fix my paycheck withholding (W-4), two earners, from a pay stub | Li2 Li5 Li6 | HAVE | Withholding check (W-4 step and amount); pay stub reader soon (spec L7). |
| P3 | Pension withholding (W-4P) | Li3 | PARTIAL | Withholding per person works for any payer; the advice is worded for a job's W-4. |
| P4 | A filled-in W-4 to hand over | Li4 | PARTIAL | Says which line and how much; no filled form. |
| P5 | Quarterly estimates; the safe-harbor amount | Li7 Li8 | HAVE | Estimated payments. |
| P6 | A reminder before each payment is due | Li9 | PARTIAL | Due dates on the Money calendar; a Needs attention item the week before is an idea. |
| P7 | The underpayment penalty in dollars | Li10 | PARTIAL | The risk is flagged; no amount. |
| P8 | Where my income sits in the brackets; the true cost of the next dollar | Li12 Li14 Li16 | HAVE | Bracket explorer. |
| P9 | Bunching gifts, appreciated shares, giving from an IRA | Li18 Li119 Li120 In93 | HAVE | Giving. |
| P10 | Deductions a self-employed person often misses | Li19 | PARTIAL | Small business takes typed expenses, home office, miles; no checklist. |
| P11 | Business expenses from the bank files | Li20 | PARTIAL | Typed; reading a business category from the ledger is an idea. |
| P12 | Self-employment tax and the 20% deduction | Li23 | HAVE | Self-employment, Small business. |
| P13 | State tax | Li24 | PARTIAL | State: last year's return, a flat rate or your own; other states compared. Graduated brackets for the big states are an idea. |
| P14 | Try a change and see the tax | Li25 | HAVE | Bracket explorer, Capital gains, Filing status compare. |
| P15 | Itemize or take the standard deduction | Li26 | HAVE | Federal estimate uses the larger. |
| P16 | Tax forms gathered; W-2 and 1099 read in | Li28 | PARTIAL | Tax documents checklist; reading the forms is D15. |
| | **Q. Debt** | | | |
| Q1 | Snowball, avalanche, side by side | Li29 Li30 Li31 Ca71 | HAVE | Pay off debts. |
| Q2 | Other orders: hybrid, biggest payment, cash-flow index | Li32 Li33 | PARTIAL | Custom order covers them by hand. |
| Q3 | My own order | Li34 | HAVE | Pay off debts. |
| Q4 | Extra each month | Li35 | HAVE | Pay off debts (extra; what $100 more does). |
| Q5 | One-time extra payments (a bonus, a refund) and planned costs that slow payoff | Li36 Li37 | MISSING | "One-off lump sums" is a README idea. |
| Q6 | Debt-free date, minimum-only against the plan, a timeline | Li38 Li39 Li40 | HAVE | Pay off debts, Life timeline. |
| Q7 | Payments made against the plan | Li41 | MISSING | |
| Q8 | A printable payoff table | Li42 | PARTIAL | Mortgage's yearly schedule; no payoff table laid out for print. |
| Q9 | Velocity banking | Li44 | MISSING | |
| Q10 | Debt-to-income | Li45 | HAVE | What lenders see, Debts. |
| Q11 | Balance transfer or a consolidation loan | Li46 | HAVE | Consolidation, Credit cards. |
| Q12 | A card paid at a fixed amount against the minimum | Li47 | HAVE | Credit cards. |
| Q13 | A plan written from a description, by AI | Li48 | MISSING | |
| Q14 | Student loan plans (income-driven, RAP, forgiveness) | Li49 | HAVE | Student loans. |
| | **R. Credit** | | | |
| R1 | Credit score, report, monitoring, simulator, offers | Li50 Li51 Li53 Li56 Ca78 Ux72 | OUT (FEED) | Fit, not built: type your score and its date and track it. |
| R2 | What moves a score; disputing errors; a freeze and fraud-alert checklist | Li52 Li55 Li57 | MISSING | |
| R3 | Card use against limits | Li54 | HAVE | Credit cards, What lenders see. |
| | **S. Insurance** | | | |
| S1 | How much life cover (DIME), how long, counting work cover | Li58 Li59 Li60 | HAVE | Life insurance needs. |
| S2 | A rough premium | Li61 | PARTIAL | Term vs permanent and Policies use the prices you type; no estimate. |
| S3 | Live quotes from insurers | Li62 | OUT (FEED, ADVICE: licensed agents) | Fit, and the app has it: typed quotes compared (Term vs permanent, Annuities). |
| S4 | Disability cover needed | Li63 | HAVE | Disability. |
| S5 | Home, car and umbrella cover against what I own | Li65 | HAVE | Auto, home, umbrella. |
| S6 | Every policy on one list | Li66 | HAVE | Policies. |
| | **T. Estate and papers** | | | |
| T1 | A will or trust written for me | Li67 Li68 | OUT (ADVICE: a legal document service) | Fit: Estate documents checklist (HAVE); a worksheet of the choices to take to a lawyer is not built. |
| T2 | Powers of attorney, health directive, guardian, executor | Li69 Li70 | HAVE | Estate documents. |
| T3 | Who is named on each account | Li71 | HAVE | Beneficiary audit. |
| T4 | A lawyer checks the papers | Li72 | OUT (ADVICE) | Contacts holds the attorney. |
| T5 | Estate and gift tax | Li73 | HAVE | Estate tax, Gifting. |
| T6 | A picture of who gets what | Li74 | MISSING | Legacy goals and Beneficiary audit are lists. |
| T7 | AI reads a will or trust | Li75 | MISSING | |
| T8 | Final wishes, funeral, pets, a letter of instruction | Li77 | PARTIAL | The letter of instruction is on the checklist; funeral wishes and pets are ideas. |
| T9 | Who can get into my online accounts | Li78 | HAVE | Digital assets (never the passwords). |
| T10 | Look again after a life event | Li79 | HAVE | Estate documents (old papers, born after signing). |
| | **U. College and children** | | | |
| U1 | What college will cost and the monthly saving | Li80 In103 | HAVE | Education (529). |
| U2 | Cost of a named school | Li81 | HAVE / OUT (FEED) | A custom yearly cost per child; looking schools up is FEED. |
| U3 | Compare 529 plans | Li82 | MISSING | Needs each state's plan data. |
| U4 | My state's tax break on 529 money | Li83 | MISSING | Mentioned on Education, not modelled. |
| U5 | 529 against loans; borrow or save | Li84 Li89 | MISSING | |
| U6 | Saving for private school before college | Li85 | MISSING | Only through Goals. |
| U7 | Expected aid (Student Aid Index) | Li86 | MISSING | FAFSA is mentioned. |
| U8 | Five years of gifts into a 529 at once | Li87 | HAVE | Gifting. |
| U9 | Custodial accounts (UGMA, UTMA) into a 529 | Li88 | MISSING | |
| U10 | Allowance and kids' money | Ca83 | MISSING | |
| | **V. Home, rentals, cars** | | | |
| V1 | Rental books per property; Schedule E | Li90 Li92 Li96 | PARTIAL | Rental analysis (NOI, cap rate, cash-on-cash, DSCR, depreciation, passive-loss rules, tax). Per-property income and costs from the ledger and a Schedule E layout are missing. |
| V2 | Rent collection; rental bank feeds | Li91 Li94 | OUT (BANK, TRADE) | |
| V3 | A maintenance log | Li95 | PARTIAL | Yearly upkeep typed (Home, Rental); no dated log. |
| V4 | Cap rate, cash-on-cash, NOI | Li97 | HAVE | Rental analysis. |
| V5 | How much home; the full monthly cost; rent or buy | Li99 Li100 Li101 In102 | HAVE | House down payment, Rent vs buy. |
| V6 | Refinance break-even, interest either way, extra payments | Li102 Li106 Li107 | HAVE | Refinance, Mortgage. |
| V7 | Points or a lower rate; costs rolled in; lender credits; two offers side by side | Li103 Li104 Li105 | PARTIAL | README ideas on Refinance and Mortgage; a cash-out refinance is on Renovation. |
| V8 | Lease or buy a car; the true cost to own | Li108 Li109 | HAVE | Vehicles. |
| V9 | Electric against gas, with the credits | Li110 | PARTIAL | Vehicles has an electric car's cost per mile; the side-by-side with credits is an idea. |
| V10 | Save up for a big purchase | Li111 | HAVE | Big purchase planner. |
| | **W. Household admin** | | | |
| W1 | HSA limits and whether my plan qualifies | Li112 Li113 | HAVE | HSA and FSA, Health plan compare, Contribution limits. |
| W2 | HSA: invest it, keep receipts to pay yourself back later | Li114 | PARTIAL | What the HSA grows into by 65; a receipt list is an idea. |
| W3 | FSA use-it-or-lose-it | Li115 | HAVE | HSA and FSA. |
| W4 | Emergency fund size, progress, where to keep it | Li116 Li117 In107 | HAVE | Emergency fund. |
| W5 | A list of my gifts to charity for tax time | Li122 | PARTIAL | Giving takes a yearly figure; no list of gifts. |
| W6 | People to call | Li125 | HAVE | Contacts. |
| | **X. Alerts, privacy, access, platform** | | | |
| X1 | Notifications on the phone (bill due, budget limit, large charge) | Ca86 | PARTIAL | Needs attention and the calendar file; no push notification. "Large charge" from a live feed is A16 (OUT). |
| X2 | An API or webhooks | Ca88 | PARTIAL | The PC server has routes for the app; nothing documented for the household. |
| X3 | Local-first, own server, open source | Ca85 Ux93 Ux94 Ux95 | HAVE | The PC server, MIT. |
| X4 | Encrypted at rest with a passphrase | Ux97 | MISSING | A README idea in Settings. |
| X5 | Home-screen widgets | Ux90 | MISSING | A web app cannot place iPhone widgets; the app installs to the home screen. |
| X6 | Text size, contrast, light or dark by choice | Ux101 | PARTIAL | Dark mode follows the phone; 16 px boxes, 44 px taps, labels. No text-size, contrast or manual theme setting. |
| X7 | AI on or off; how my data is used | Ux86 Ux87 | HAVE | Settings; the AI pages say names are hidden. |
| X8 | AI tone (supportive, plain, blunt) | Ux85 | MISSING | |
| X9 | Partners comment on a transaction | Ux79 | PARTIAL | A note per transaction only. |

---

## 2. Gap list (every MISSING and PARTIAL line)

Size: **S** about a day (a box, a choice, a line, a list), **M** a few days (a new card with its compute and tests), **L** a
week or more (a new engine part, yearly data to source and verify, or a new page with several parts). **Depth** = an
option on an existing page (named); **Breadth** = a new page. **Value** is my judgment for a household on a 390 px phone
and the owner's two asks (simple by default, every option there for whoever wants it): High, Medium, Low. Sorted by value,
then size. "Apps" are the products the research names for the feature.

| Value | Gap (map line) | What a household gains | Apps that have it | Size | Depth or breadth |
|---|---|---|---|---|---|
| High | Things that will happen, in the plan: sell or downsize the home, a part-time stretch, a career break, a big trip, an inheritance (A7, C6, E7, G9) | The answer reflects their real life instead of a straight line; "what if we downsize at 70" in two taps | ProjectionLab, FIRECalc (3 lines), FI Calc, Boldin, Pralana, MaxiFi, Rich Broke or Dead, Wealthfront Path | M (the engine already takes events) | Depth: Will the money last?, a "Things that will happen" fold |
| High | A three-box retirement answer with nothing set up (A2) | A first answer in one minute, before trusting the app with their numbers | FIRECalc, Rich Broke or Dead, T. Rowe and Vanguard calculators | S | Depth: Quick answers |
| High | Live levers: move a number, watch the answer move before saving (A3) | Understands what drives the answer; plays without fear of breaking the plan | Vanguard sliders, RightCapital levers, Boldin, ProjectionLab | M | Depth: Will the money last? (on the spec L2 card) |
| High | "How we got this" on every big figure, and a plain methodology page (B17) | Trust: every number can be checked; no app does this except Pralana Online's "MRI" | Pralana Online; Fidelity and MaxiFi publish methodology only | L (cross-cutting) | Depth on each page, plus Breadth: a Help section |
| High | Pretend family to look around; starting templates (A14) | See a full plan before typing anything; learn the app on fake numbers | ProjectionLab sandbox, Tiller templates | S to M | Depth: Get started, Settings (sandbox with a household from `qa/`) |
| High | One-time extra debt payments and known costs that slow payoff (Q5) | "Put my tax refund on the card" shows the new debt-free date | Undebt.it (snowflakes), Debt Payoff Planner | S | Depth: Pay off debts |
| High | Safe to spend today or this week (H7) | One number to check before buying | PocketGuard "In My Pocket", Simplifi, Rocket Money | S | Depth: Budget, Dashboard |
| High | Split a transaction (I6) | A grocery trip that is also pharmacy and household counts right | YNAB, Monarch, Lunch Money, Actual, Copilot, GnuCash, Firefly III, Rocket Money | M | Depth: Ledger |
| High | Credit: type the score and date; what moves it; dispute; freeze and fraud-alert steps (R1 fit, R2) | Knows where they stand and what to do, with no bureau login | Credit Karma, Experian, CreditWise, myFICO (all by feed) | M | Breadth: a "Credit score" page in Debt |
| High | Best claiming ages for a couple (E2) | Often the largest single money decision a couple makes | Open Social Security (free), MaxiFi, Income Lab | M | Depth: Social Security |
| High | Spending that eases with age (C4) | Retirees spend less at 80 than at 65; the plan stops over-saving | FIRECalc (Bernicke), ProjectionLab | S | Depth: Will the money last?, one choice in its settings |
| High | Read a tax return, W-2 or 1099 into the plan (D15, P16) | No retyping; tax pages filled in from the paper they already have | Holistiplan (advisor), Keeper, TurboTax | M | Depth: Document reader (new kinds) |
| High | Hide the amounts (N17) | Open the app in front of others without showing balances | Ghostfolio (Zen mode), Monarch and Copilot privacy blur | S | Depth: shell (one switch) |
| High | Text size and light or dark by choice (X6) | Readable on a phone for older eyes; dark mode when the phone is light | Actual (themes), most apps | S | Depth: Settings |
| High | Printable "if something happens to us" packet (N19 fit) | The family finds papers, contacts, beneficiaries and digital access in one place | Kubera (dead man's switch, online), Everplans, Trustworthy | M | Breadth: a report page, or Depth: Reports |
| High | His, hers, ours: share costs fairly as a couple (H16) | Ends the "who pays for what" argument with a fair split by income | Actual (docs), Monarch and Copilot partner modes, Honeydue | M | Breadth: a page in Cash flow |
| High | State tax by brackets, and in retirement years (P13, D5) | Accurate take-home and lifetime tax in the states that tax by bracket | ProjectionLab, Boldin, TurboTax, FreeTaxUSA | L (yearly data per state, each with a source and date) | Depth: State, Tax year by year |
| Medium | Saved versions of the plan: more levers, "make this version my plan" (A13) | Try a whole different life and keep it if it wins | ProjectionLab, MaxiFi (25 plans), Boldin, Pralana, Buckets | M | Depth: Scenario compare |
| Medium | Conversion targets: stop at the Medicare surcharge line or the marketplace credit line (D2) | Avoids a surprise jump in premiums or a lost credit | Pralana, ProjectionLab, Boldin, Holistiplan | M | Depth: Roth conversions |
| Medium | Early access: Roth ladder, 72(t), and the 10% penalty in the plan (D3, D9) | An early retiree sees how to reach money before 59 1/2 and what the penalty costs | ProjectionLab, Boldin | M | Depth: Will the money last?, Roth conversions |
| Medium | Inherited IRA ten-year rule (D12) | Heirs see the tax of emptying it in ten years | ProjectionLab | M | Depth: Expected inheritance |
| Medium | Social Security special cases: earnings test, ex-spouse, children (E3) | Right benefit for divorced, working or parent households | Open Social Security | M | Depth: Social Security |
| Medium | Separate health inflation (G1) | Health costs that rise faster than prices are not underestimated | Fidelity (fixed), FIRECalc (choices) | S | Depth: Assumptions |
| Medium | Choose how cautious the answer is (B9) | A worrier can plan at 95%, a relaxed person at 75% | Fidelity (50, 75, 90%) | S | Depth: Will the money last?, Chance the money lasts |
| Medium | Alert when spending should change (G14) | Told when markets moved enough to trim or raise spending | Income Lab (advisor) | S | Depth: Needs attention |
| Medium | Progress against the plan drawn a year ago (A24) | "Are we ahead or behind?" with one line | ProjectionLab | M | Depth: Net worth projection, Annual review |
| Medium | Zero-based budget: money to assign (H1) | Every dollar of pay given a purpose; the method many budgeters want | YNAB, Actual, EveryDollar, Buckets | M | Depth: Budget, a method choice |
| Medium | Move money between envelopes (H2) | Covers an overspent envelope from another, as people do in life | Actual, YNAB, Buckets, Goodbudget | S | Depth: Budget |
| Medium | A flex budget (fixed, flexible, non-monthly) (H5) | Three numbers to watch instead of twenty | Monarch (default), Simplifi | M | Depth: Budget, a method choice |
| Medium | Targets per envelope by date; yearly envelopes (H12) | Saves the right amount for a December bill | YNAB targets, Monarch goals | M | Depth: Budget |
| Medium | Money already set aside per irregular bill (H13) | Sees which yearly bills are covered | YNAB, Goodbudget, Buckets | S | Depth: Irregular expenses |
| Medium | A budget per paycheck (H14) | Households paid every two weeks plan pay by pay | YNAB users, Origin, Tiller templates | M | Depth: Budget, Paycheck |
| Medium | Tags that do something: filter, report, rule (I8) | "What did the trip cost?" across categories | Monarch, Lunch Money, Firefly III, Copilot, Rocket Money | S | Depth: Ledger, Where the money goes, Rules |
| Medium | Sub-categories; merge two categories (I1) | Groceries under Food; tidy lists | Most budgeting apps | M | Depth: Categories |
| Medium | Split a bill with others; who owes whom (I7) | Roommates and shared trips settled | Lunch Money, Splitwise-style tools | M | Breadth or Depth: Ledger |
| Medium | Returns and reimbursements linked to the purchase (I12) | A refund or a work expense paid back is not counted as spending | Actual, Lunch Money | S | Depth: Ledger |
| Medium | Bill went up or a new charge appeared (K8) | Catches price rises and forgotten trials | Rocket Money, Monarch | S | Depth: Bills and regular payments, Needs attention |
| Medium | "Add it to Expenses" from a found payment (K3) | One tap from bank file to plan | Lunch Money, Actual | S | Depth: Bills and regular payments |
| Medium | Spending trend over 12 months (L3) | Sees whether eating out is creeping up | Every budgeting app | S | Depth: Where the money goes |
| Medium | Presets for other apps' exports (J9) | Switching from Mint, YNAB or Monarch is one file | Actual, YNAB | S | Depth: Import |
| Medium | Several currencies (N3) | Households with a foreign account or pension see one true total | Kubera, Lunch Money, Actual, Firefly III, Sharesight, getquin | L | Depth: Net worth, every money box |
| Medium | Part shares of an account; a trust as owner (N4) | A rental owned 50/50 with a sibling counts at half | Kubera (Black tier only) | S | Depth: Net worth |
| Medium | A 401(k)'s own administration fee (O26) | Sees the whole cost of the workplace plan | Empower Fee Analyzer | S | Depth: Fees |
| Medium | Realized gains this year from the lots; a report for the accountant (O9, O28) | Hands the accountant one page | Sharesight, Stock Rover, Ghostfolio | M | Depth: Tax lots, Tax report |
| Medium | Dividends actually received, a monthly calendar, yield on cost (O24) | Income investors see when cash arrives | Snowball, Sharesight, getquin, Ghostfolio | M | Depth: Dividends |
| Medium | A filled W-4 to print; W-4P wording for pensions (P4, P3) | Hands the employer or pension payer the exact form | IRS estimator, TurboTax W-4 calculator | S to M | Depth: Withholding check |
| Medium | Reminder the week before each estimated payment (P6) | No late quarter | Keeper | S | Depth: Needs attention |
| Medium | Self-employed deduction checklist; business costs from the ledger (P10, P11) | Fewer missed write-offs | Keeper, Stessa, Baselane | S to M | Depth: Small business |
| Medium | Payments made against the debt plan (Q7) | Motivation: ahead or behind the payoff plan | Debt Payoff Planner | M | Depth: Pay off debts |
| Medium | Rental books from the ledger; a Schedule E layout (V1) | A landlord's year ready for tax | Stessa, Baselane | M to L | Depth: Rental analysis |
| Medium | Refinance: points, rolled-in costs, two offers side by side (V7) | Picks the better of two real offers | Credible, Lower, Refi.com calculators | M | Depth: Refinance |
| Medium | 529: state tax break, against loans, K-12, aid estimate (U4, U5, U6, U7) | Knows what the state gives back and what aid to expect | Saving for College, Fidelity, Vanguard, StudentAid.gov | M each (U4 and U7 need yearly state and federal data) | Depth: Education (529) |
| Medium | HSA receipts kept to pay yourself back later (W2) | Uses the HSA as the long-term account it can be | Fidelity, HSA providers | S | Depth: HSA and FSA |
| Medium | A risk questionnaire (G4) | Picks a mix that fits nerves and timeline, with "not advice" | Betterment, Wealthfront (as advice) | S to M | Depth: Stocks by age or Allocation |
| Medium | Chance of reaching each goal (G7) | Knows which goals are safe, not only "on time" | MoneyGuidePro (advisor) | M | Depth: Goals |
| Medium | College and other goals taken out of savings in the projection (G10) | Net worth ahead shows the dip when tuition is paid | Pralana, ProjectionLab | M | Depth: Net worth projection |
| Medium | Short lessons (A27) | Learns the ideas behind a page in two minutes | Rocket Money, YNAB, Boldin classes | M | Breadth: Help or Glossary section |
| Medium | Partner views and access: mine/yours/ours filter, read-only device (A22, A23, L2) | Privacy inside a couple; a parent or advisor sees without changing | Monarch, Honeydue, RightCapital portal, Kubera | M (Devices is a placeholder) | Depth: Ledger, Net worth; Breadth: Devices |
| Medium | Choose and arrange the Dashboard (A30) | The first screen shows what this household cares about | Monarch, Rocket Money, Simplifi | M | Depth: Dashboard |
| Medium | One figure or itemized, per section (A32) | A rushed person types one number; a careful one itemizes | Boldin, ProjectionLab | S to M | Depth: Expenses, Net worth |
| Medium | Encrypted at rest with a passphrase (X4) | A stolen laptop or phone does not expose the plan | Actual (encrypted sync), Copilot | M | Depth: Settings, `core/store.js` |
| Medium | Push notifications (X1) | Hears about a bill or a shortfall without opening the app | Monarch, Simplifi, Rocket Money, Actual | L (web push through the PC; iPhone needs the home-screen app) | Depth: Settings |
| Medium | AI proposes a change from the chat, applied on a tap (A18) | "Lower my spending to 6,000" from the chat, checked before it lands | Boldin AI, Copilot | M | Depth: Ask the plan |
| Medium | Final wishes, funeral, pets on the papers list (T8) | The family knows the wishes | Everplans | S | Depth: Estate documents |
| Medium | Who gets what, as a picture (T6) | One look at where everything goes | Wealth.com (advisor) | M | Depth: Legacy goals |
| Low | More withdrawal rules (C3) | Compare more spending styles | FI Calc (13), ProjectionLab | M | Depth: How much to take out |
| Low | Guardrail settings: the cut and the bands (C5) | A flexible household sets its own guardrails | Rich Broke or Dead, ProjectionLab | S | Depth: How much to take out |
| Low | Proportional withdrawals (C8) | Smoother tax when drawing from every account | ProjectionLab, RightCapital | S | Depth: Withdrawal order |
| Low | One search across order, conversions and gain harvesting (C9) | The lowest-tax path found for them | ProjectionLab, MaxiFi | L | Depth: Withdrawal order |
| Low | Sankey flow picture (C11) | Sees where the money goes in one picture | ProjectionLab, Monarch | M | Depth: Cash-flow statement or Year by year |
| Low | Gain harvesting over several years (D10) | Uses low-income years to reset gains | ProjectionLab | M | Depth: Tax, year by year |
| Low | Donor-advised fund modelled (D11) | Sees the deduction now and gifts later | ProjectionLab, Fidelity Charitable | S | Depth: Giving |
| Low | Mega-backdoor (after-tax 401(k)) (D4) | High savers find more Roth room | ProjectionLab | S | Depth: Contribution limits |
| Low | AMT beyond stock options (D8) | Rare high-deduction years are not underestimated | ProjectionLab | M | Depth: Federal estimate |
| Low | Deferred compensation plans (D14) | Executives see when deferred pay lands and its tax | Fidelity | M | Depth: Equity compensation |
| Low | Money moved between accounts in the plan (D16) | Models "move cash to the brokerage in 2027" | ProjectionLab | S | Depth: Will the money last? |
| Low | Other countries (D17) | Non-US households and expats | ProjectionLab, Portfolio Charts | L | Breadth |
| Low | Retire when savings reach a figure (A8) | A rule-based retirement date | ProjectionLab | M | Depth: Will the money last? |
| Low | Edit any year by hand (A10) | Power users shape a single year | Flexible Retirement Planner, ProjectionLab | M to L | Depth: Year by year |
| Low | Share a calculator by link (A21) | Send a rent-or-buy answer to a partner | Open Social Security, Rich Broke or Dead, FI Calc | M | Depth: the calculator pages |
| Low | Files kept on the PC (A19, I11) | Statements and receipts next to the plan, at home | Boldin vault, Sharesight, Monarch | M | Depth: Document vault index, Ledger |
| Low | Spreadsheet-style editing (A33) | Experts edit tables in place | Tiller, Actual | L | Depth: Ledger and lists |
| Low | Bootstrap, random inflation, seeds (B3) | Fatter-tailed runs for the curious | ProjectionLab | M | Depth: Chance the money lasts |
| Low | Histogram; every run in a table or file (B6, B7) | Inspects the spread of results | ProjectionLab, FI Calc, Rich Broke or Dead | S | Depth: Chance the money lasts, Export |
| Low | Money and survival in one view (B8) | Sees the chance of being alive and short together | Rich Broke or Dead | S to M | Depth: Chance the money lasts |
| Low | Own thresholds for "good"; which accounts count (B10, B14) | Personal meaning of success | ProjectionLab | S | Depth: Chance the money lasts |
| Low | More ready-made mixes (G2) | Tries Three-Fund or Golden Butterfly | Portfolio Charts (21), Fidelity (9) | M (more asset-class history) | Depth: Backtest |
| Low | Custom charts and saved reports (G15) | Builds their own view | Actual, Monarch, Lunch Money, Firefly III, ProjectionLab | L | Breadth: Reports |
| Low | Overspending choice; hold for next month; age of money (H9, H10) | Envelope purists get their method | Actual, YNAB | S each | Depth: Budget |
| Low | Reset the budget only (H15) | A fresh month without losing history | YNAB Fresh Start | S | Depth: Budget |
| Low | Advanced rules; merchant merge (I4, I5) | Fewer manual fixes | Actual, Firefly III, Lunch Money | S to M | Depth: Rules |
| Low | Flags (I10) | Marks a line to look at later | YNAB | S | Depth: Ledger |
| Low | Leave one line out of reports (I13) | A one-off does not distort a month | Monarch, Lunch Money, Copilot | S | Depth: Ledger |
| Low | QIF and CAMT.053 files (J3, J4) | Old Quicken and European bank files | Actual, YNAB, GnuCash | S each | Depth: Import |
| Low | Watch one payee (L5) | Keeps an eye on one shop | Simplifi, Copilot | S | Depth: Where the money goes |
| Low | Labels on accounts and holdings (N5) | Slices by purpose ("kids") | Sharesight, Kubera | S | Depth: Net worth, Holdings |
| Low | Private investments with IRR; gold by weight; staking income (N9, N10, N15 fit) | Unusual assets counted properly | Kubera, Delta | S to M | Depth: Net worth, Crypto |
| Low | Crypto lot method and an 8949 file (N16) | Crypto tax at filing time | CoinTracker, CoinLedger | M | Depth: Crypto |
| Low | Trade history import (O2) | Lots filled from the broker | Snowball, Ghostfolio, getquin, Sharesight | M | Depth: Holdings, Tax lots |
| Low | Period chips and a date range for returns (O6) | "Since I started this job" return | Ghostfolio, Sharesight, Snowball | S to M | Depth: Performance |
| Low | Which holdings drove the result (O7) | Sees winners and losers in dollars | Sharesight, Snowball, Delta | M | Depth: Performance |
| Low | My own benchmark (O12) | Measures against what they would have bought | Snowball, Sharesight, Portfolio Visualizer | S | Depth: Performance |
| Low | Region, sector and look-through typed in (O15, O16) | Finds hidden overlap | getquin, Sharesight, Ghostfolio, Morningstar (ended) | M | Depth: Allocation, Holdings |
| Low | Try a trade, see the new mix (O22) | Tests a sale before calling the broker | Stock Rover | S | Depth: Rebalance |
| Low | Rebalanced against buy-and-hold; a schedule (O20, O23) | Sees whether rebalancing pays | Portfolio Visualizer, Portfolio Charts, Stock Rover | S | Depth: Backtest, Rebalance |
| Low | Trading and crypto fees paid (O27) | Sees what trading costs | Delta, Ghostfolio | S | Depth: Fees |
| Low | Lot method choice (O29) | Picks the cheapest shares to sell | Wealthfront (auto), crypto tax tools | S | Depth: Tax lots |
| Low | Export to tax software (O32) | No retyping at filing | Quicken, Sharesight, crypto tax tools | M | Depth: Export |
| Low | Backtest with money in and out (O34) | "What if I had saved $500 a month since 2000?" | Portfolio Visualizer, Snowball | M | Depth: Backtest |
| Low | Rolling returns; spread of years; Sharpe, correlation, frontier (O35, O36) | Deeper risk statistics for the curious | Portfolio Visualizer, Portfolio Charts | M | Depth: Risk, Backtest |
| Low | Perpetual withdrawal rate; savings-rate table (O37, O38) | Two classic FIRE charts | Portfolio Charts, ProjectionLab | S each | Depth: If history repeated, Financial independence |
| Low | Underpayment penalty in dollars (P7) | Knows what paying late costs | TurboTax, IRS Form 2210 | S | Depth: Estimated payments |
| Low | Other payoff orders as named choices (Q2) | One tap instead of dragging | Undebt.it | S | Depth: Pay off debts |
| Low | Printable payoff table (Q8) | A paper schedule on the fridge | Undebt.it+ | S | Depth: Pay off debts |
| Low | Velocity banking, explained (Q9) | Learns why it rarely helps before trying it | Undebt.it calculator | S | Depth: Pay off debts or Glossary |
| Low | A debt plan from a description (Q13) | Speaks the debts, gets a plan | Undebt.AI | S | Depth: Voice notes |
| Low | A rough insurance premium (S2) | A ballpark before shopping | Policygenius calculator | M (rate data) | Depth: Life insurance needs |
| Low | AI reads a will (T7) | Checks what the will says against the plan | Wealth.com (advisor) | M | Depth: Document reader |
| Low | 529 plan comparison; custodial accounts (U3, U9) | Picks a plan; moves a custodial account | Saving for College | M | Depth: Education |
| Low | Kids' allowance (U10) | Teaches money | Greenlight-type apps | M | Breadth |
| Low | Maintenance log (V3) | A dated record of repairs for a sale or tax | Stessa | S | Depth: Home, Rental analysis |
| Low | Electric against gas with credits (V9) | Picks the cheaper car for their miles | Edmunds, ChargePort | S | Depth: Vehicles |
| Low | A list of gifts to charity (W5) | Totals for tax time | ItsDeductible-style tools | S | Depth: Giving |
| Low | Long-term care costs by state (F4) | Local prices, not national | Genworth/CareScout | S (data, verify) | Depth: Long-term care |
| Low | API for the household; webhooks (X2) | Power users connect their own tools | Firefly III, Lunch Money, Actual | M | Depth: server docs |
| Low | Home-screen widgets (X5) | A glance without opening | Monarch, Copilot | not possible as a web app | (none) |
| Low | AI tone (X8) | A gentler or blunter helper | Copilot | S | Depth: Settings |
| Low | Partner comments on a transaction (X9) | Settles "what was this?" | Honeydue | S | Depth: Ledger |

### OUT lines with a fitting version not built yet
- R1 credit score: a typed score and date, tracked over time (in the High row above).
- N19 hand-over: the printable packet (in the High row above).
- T1 will or trust: a worksheet of the choices to take to a lawyer (guardian, executor, who gets what), printable. S, Depth:
  Estate documents.
- M2 automatic transfers and K5 cancelling: plain "how to set it up at your bank" and "how to cancel" notes. S.
- Everything else marked OUT already has its fitting version (file import, typed values, typed quotes, lists of what to do).
