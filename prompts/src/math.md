# Heavy math
An hour or more of high-volume, mechanical work for a fleet of small models (for example 20 to 50
Haiku-class workers under one lead). No design decisions: every rule, column and split is spelled out,
so a worker cannot go wrong by following it. Small table jobs live in Quick.

---
id: heavy-federal-tax-grid
title: Federal income tax for 12,000 invented returns (2024 to 2026)
size: XL
effort: A fleet of about 48 small workers (one per year, filing status and income band), about an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
read: core/math/tax.js, modules/taxes/federal/data/federal.js, modules/taxes/federal/README.md, modules/taxes/federal/compute.js, tests/tax.test.mjs, core/csv.js
summary: Every filing status, income mix and threshold, worked from the IRS's own rules into CSV files the tests replay.

The federal tax engine (`federalTax(inputs, params)` in `core/math/tax.js`, year tables in `modules/taxes/federal/data/federal.js`) has a few dozen hand-worked tests. Give it twelve thousand.

**Scope: what the engine covers** (the README's "Edge cases" lists what it leaves out; do not test those): tax years 2024, 2025 and 2026; single, married filing jointly, married filing separately, head of household; wages, taxable interest, ordinary and qualified dividends, short- and long-term capital gains and losses (with the $3,000 loss limit), pensions and IRA distributions, Social Security benefits (the taxable-portion worksheet), the standard deduction with the 65+ and blind additions, the 2025 to 2028 senior deduction and its phase-out, itemized deductions (state and local taxes under that year's cap, mortgage interest, charity), the child tax credit and the credit for other dependents with their phase-outs, the 3.8% net investment income tax and the 0.9% additional Medicare tax.

**Step 1, the lead (about 10 minutes).**
- Read the input and output objects of `federalTax` and fix one CSV layout: `case_id, year, filing_status, age_1, age_2, blind_1, blind_2, kids_under_17, other_dependents, wages, interest, ordinary_dividends, qualified_dividends, st_gain, lt_gain, pensions, ira_distributions, social_security, salt_paid, mortgage_interest, charity`, then the expected results `agi, taxable_social_security, deduction, taxable_income, ordinary_tax, capital_gains_tax, credits, niit, additional_medicare, total_tax, marginal_rate`, then `note`.
- Write one rules sheet with each year's figures copied from the IRS's own documents: Rev. Proc. 2023-34 (2024), Rev. Proc. 2024-40 plus the July 2025 law's changes (2025), Rev. Proc. 2025-32 (2026). It covers brackets, standard deductions and additions, capital-gains thresholds, Social Security base amounts, credit amounts and phase-outs, the NIIT and additional Medicare thresholds, the SALT cap and its phase-down, and the senior deduction. Wherever `federal.js` differs from the IRS figure, that difference goes first in your answer.
- Give every worker the layout, the rules sheet and its shard.

**Step 2, the workers (in parallel).** 48 shards: 3 years × 4 filing statuses × 4 income bands (under $50,000; $50,000 to $150,000; $150,000 to $400,000; over $400,000 up to $5,000,000). Each worker writes 250 rows for its shard:
- 100 grid rows, incomes spread evenly through the band, the mix rotating through wages only, wages plus investment income, retirement income (pension, IRA, Social Security) and everything at once;
- 100 edge rows: exactly at, $1 below and $1 above every bracket edge, capital-gains threshold, Social Security base amount, credit phase-out start and end, NIIT threshold, senior-deduction phase-out and SALT phase-down point that falls inside the band;
- 50 random rows, every field drawn at random within the band.

Work each expected value from the rules sheet and the IRS worksheets (Qualified Dividends and Capital Gain Tax Worksheet, Social Security Benefits Worksheet, Schedule 8812, Forms 8960 and 8959). A calculator, or a short script you write yourself from the rules sheet, is fine. **Never run, import or copy the repo's code**: the point is an independent answer key. Use the same rounding in every row (exact cents, or whole dollars as the forms allow) and say which.

**Step 3, the workers.** Re-derive every tenth row a second way (by hand if the first pass was a script, by script if it was by hand). Fix the row, or flag it in `note`.

**Step 4, the lead.**
- Re-derive a 2% sample yourself; redo any shard with an error in it.
- Deliver `tests/golden/taxes/federal-<year>.csv` (one per year) and `tests/golden-federal.test.mjs`. The test reads each CSV with `parseCsv` from `core/csv.js`, maps the columns to `federalTax`'s inputs and asserts every result within $1.
- A row where the engine disagrees stays in the CSV and becomes a `{ todo: "<reason>" }` test. Put those first in your answer with the worked numbers: they are the point of the exercise.

---
id: heavy-state-tax-grid
title: State income tax for every state: an answer key of 40,000 rows (2025, 2026)
size: XL
effort: A fleet of 51 small workers (one per state and DC), about an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
read: modules/taxes/state/README.md, modules/taxes/state/module.js, core/math/tax.js, core/csv.js, docs/DATA_MODEL.md
summary: Each state's tax on a grid of incomes and households, worked from the state's own forms, ready to test the State tax page.

The State tax page (`taxes/state`) is planned; its tables come from the Quick prompt `quick-state-tax-tables`. This job builds, independently of those tables, the answer key the page will be tested against.

**Step 1, the lead.** Fix one CSV layout: `case_id, state, year, filing_status, age_1, age_2, dependents, federal_agi, federal_taxable_income, wages, social_security, pension, lt_gain, state_taxable_income, state_tax_before_credits, state_credits, state_tax, note`. Brief every worker with it and the rules below.

**Step 2, the workers (one per state and DC).** For tax years 2025 and 2026, write about 850 rows:
- 4 filing statuses × 100 income points from $0 to $1,000,000 (denser around the state's bracket edges, and each edge exactly) × 2 households (no dependents and under 65; two dependents);
- 50 retiree rows (65 and over, Social Security and a pension) that exercise the state's retirement-income exclusions.

Rules for every worker:
- Work every row from that state revenue department's own form instructions and rate schedule for that year. Never use an aggregator site, and never the repo's tables or code. Cite the form in a comment line at the top of your shard.
- Where 2026 is not yet published, use 2025 and put `projected` in `note`.
- States with no wage income tax need only a short shard confirming $0, plus their special cases (Washington's capital-gains excise tax; New Hampshire's interest-and-dividends tax for the years it applies).
- Local income taxes (New York City, Yonkers, Maryland counties, Pennsylvania, Ohio and Michigan localities and so on) are out: state tax only.

**Step 3, the workers.** Re-derive every tenth row a second way; fix or flag.

**Step 4, the lead.**
- Re-derive a 2% sample; redo any shard with an error.
- Deliver `tests/golden/taxes/state-<code>.csv` per state and `tests/golden-state.test.mjs`. It runs each row through `modules/taxes/state/compute.js` once that page exists, and until then skips with a message saying so.

---
id: heavy-loan-schedules
title: Twenty thousand loans worked to the cent
size: XL
effort: A fleet of about 40 small workers (one per rate band and loan kind), about an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
read: core/math/finance.js, core/math/payoff.js, modules/debt/mortgage/README.md, modules/debt/payoff/README.md, modules/debt/refinance/README.md, tests/finance.test.mjs, core/csv.js
summary: Payment, interest, payoff month and balances for every kind of loan and extra payment, plus 500 full month-by-month schedules.

**Step 1, the lead.**
- Find out how `core/math/finance.js` and `core/math/payoff.js` round each month's interest and the final payment. The comments and the debt READMEs say; if they do not, read the code for that convention only, and state it.
- Write one rules sheet: the payment `P·r / (1 − (1 + r)^−n)` with `r` = annual rate / 12; the rounding convention; extra payments applied after the month's interest, in the same month; biweekly as the mortgage README defines it; a recast as a new payment over the remaining term after a lump sum.
- CSV layout: `case_id, principal, annual_rate, term_months, extra_monthly, lump_sum, lump_month, schedule (monthly|biweekly), recast (0|1), payment, total_interest, payoff_month, balance_12, balance_60, balance_120, final_payment, note`.

**Step 2, the workers.** 40 shards: 8 rate bands (0%; 0.01 to 3%; 3 to 5%; 5 to 7%; 7 to 10%; 10 to 18%; 18 to 30%; payments below the month's interest) × 5 loan kinds (plain; extra every month; one lump sum; biweekly; lump sum then recast). Each worker writes:
- 500 rows with principals from $500 to $2,000,000 and terms from 6 to 480 months;
- every edge: a 0% rate, a one-month term, an extra payment that pays the loan off the next month, and a payment below the interest that must never pay off (`payoff_month` = `never`);
- 12 full month-by-month schedules in their own CSV (`month, payment, interest, principal, extra, balance`).

Work each from the rules sheet with your own arithmetic or your own short script, never the repo's code.

**Step 3, the workers.** Every tenth row a second way; fix or flag.

**Step 4, the lead.** Sample 2% yourself. Deliver `tests/golden/debt/loans.csv`, `tests/golden/debt/schedules/<case_id>.csv` and `tests/golden-loans.test.mjs`, checking `core/math/finance.js` and `core/math/payoff.js` to the cent. Disagreements become `todo` tests and lead your answer.

---
id: heavy-spreadsheet-parity
title: Ten thousand spreadsheet cases: PMT, PV, FV, NPER, RATE, NPV, IRR, XIRR
size: XL
effort: A fleet of about 40 small workers (five per function), about an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
read: core/math/finance.js, core/math/returns.js, tests/finance.test.mjs, tests/returns.test.mjs, core/csv.js
summary: Every time-value function against Excel's own rules, including the awkward cases people hit in real spreadsheets.

People check this app against spreadsheets, so its time-value functions should give Excel's answers.

**Step 1, the lead.** Write the rules sheet with Excel's definitions:
- the sign convention: money paid out is negative; `type` 0 is the end of the period, 1 the beginning;
- the closed forms for PMT, PV, FV and NPER, including `type` 1 and a rate of exactly 0;
- NPV discounts the first value by one period;
- RATE and IRR use Newton's method from a guess of 0.1, and give an error when the flows never change sign;
- XIRR counts actual days over 365 from the first date in the list.

Then fix one CSV layout per function: the arguments in Excel's order, then `expected, note`.

**Step 2, the workers.** 8 functions × 5 workers × 250 rows = 10,000 rows:
- ordinary grids: rates from −5% to 50% a period, 1 to 600 periods, tiny and huge amounts;
- a rate of exactly 0 and `type` 1 for every function that takes them;
- each function's awkward cases. For RATE and IRR: flows with no sign change (error), and two sign changes with two real roots (the root Excel returns from guess 0.1). For XIRR: dates across a leap day, a first flow that is not the earliest date, and same-day flows.

Expected values come from Excel's formulas, worked with your own arithmetic or script, or with LibreOffice Calc if your tool can run it. Never use the repo's code. 10 significant digits.

**Step 3, the workers.** Every tenth row a second way.

**Step 4, the lead.** Sample 2%. Deliver `tests/golden/finance/<function>.csv` and `tests/golden-finance.test.mjs` (relative tolerance 1e-9). Where the code differs from Excel on purpose, the test asserts the code's convention and the row's `note` says how Excel differs. Unintended differences become `todo` tests and lead your answer.

---
id: heavy-social-security-grid
title: Social Security for 2,000 invented work histories at every claiming age
size: XL
effort: A fleet of 40 small workers (50 histories each), about an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
read: modules/retirement/social-security/compute.js, modules/retirement/social-security/data/ssa.js, modules/retirement/social-security/README.md, modules/retirement/social-security/module.test.mjs, core/csv.js
summary: Earnings records to monthly benefits at every claiming age from 62 to 70, plus spousal and survivor amounts, from the SSA's own rules.

**Step 1, the lead.** Write the rules sheet from the Social Security Administration's own pages, linking each:
- the national average wage index series, and the taxable maximum by year;
- AIME: the 35 highest years, earnings indexed to the year the person turns 60 and not indexed after that;
- PIA: 90%, 32% and 15% of AIME across the bend points of the year the person turns 62, rounded down to the dime; then cost-of-living raises from 62 on;
- full retirement age by birth year;
- claiming early: 5/9 of 1% per month for the first 36 months, 5/12 of 1% beyond that;
- claiming late: 2/3 of 1% per month (8% a year), up to 70;
- spousal benefit: up to 50% of the worker's PIA, reduced for early claiming (25/36 of 1% and 5/12 of 1% per month), with no delayed credits;
- the survivor benefit rules.

Then two CSV layouts:
- `histories.csv`: `history_id, birth_date`, then one column of covered earnings per year from 1966 to 2030;
- `benefits.csv`: `history_id, claim_age_years, claim_age_months, aime, pia, monthly_benefit, spousal_at_same_age, survivor, note`.

**Step 2, the workers.** Each invents 50 histories:
- birth years 1950 to 1995;
- patterns: steady, rising, a late start, gaps, part-time, at the taxable maximum, under 35 years of work, too few credits to qualify, and a high earner above the maximum.

For each history, compute the benefit at every claiming age from 62y0m to 70y0m in 3-month steps (33 rows), plus the spousal and survivor amounts. Use the SSA's figures, never the repo's `ssa.js` or code. Your own script written from the rules sheet is fine.

**Step 3, the workers.** Every tenth history a second way.

**Step 4, the lead.** Sample 2%. Wherever `data/ssa.js` differs from the SSA's figures, say so first. Deliver `tests/golden/retirement/ss-histories.csv`, `ss-benefits.csv` and `tests/golden-social-security.test.mjs`, which checks the page's compute to the dime. Disagreements become `todo` tests.

---
id: heavy-retirement-replays
title: Every retirement start year since 1871: about 100,000 historical replays
size: XL
effort: A fleet of 33 small workers (one per stock mix and length of retirement), about an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: golden
read: modules/retirement/historical/README.md, modules/retirement/historical/compute.js, modules/retirement/historical/data/returns.js, modules/investments/backtest/data/shiller.js, modules/investments/backtest/README.md, core/csv.js
summary: Whether the money lasts, the ending balance and the worst point, for every start year, withdrawal rate, stock mix and length of retirement.

The historical page answers "would my plan have survived every real start year?". This job builds the whole answer table independently, so the page can be checked against it.

**Step 1, the lead.**
- Copy the conventions word for word from `modules/retirement/historical/README.md` into the rules sheet: when in the year the withdrawal happens, how it grows with inflation, yearly rebalancing, which series stand for stocks, bonds and cash, and any fees.
- The data is given, not tested: the yearly series in `modules/retirement/historical/data/returns.js` for 1928 to 2025, and for 1871 to 1927 the yearly series built from `modules/investments/backtest/data/shiller.js` as its README describes.
- CSV layout, with a starting balance of 1,000,000: `start_year, years, withdrawal_rate, stock_share, lasted (0|1), years_lasted, ending_real_balance, lowest_real_balance, lowest_year, note`.

**Step 2, the workers.** One per stock share (0%, 10%, ... 100%) × length of retirement (20, 30, 40 years) = 33 workers. Each replays every start year that has enough data, for withdrawal rates from 2.0% to 8.0% in 0.25% steps (25 rates): about 3,000 rows each. Use your own short script written from the rules sheet, never the repo's code.

**Step 3, the workers.** Recompute 30 random rows year by year by hand, shown, to prove the script.

**Step 4, the lead.**
- Build the success-rate table (the share of start years whose money lasted) for every rate × mix × length.
- Compare it with the Trinity study (1998, updated 2011) and Bengen (1994) where they overlap, and explain the gaps (data, rebalancing, timing, fees).
- Deliver `tests/golden/retirement/replays-<years>.csv` and `tests/golden-historical.test.mjs`, which checks `modules/retirement/historical/compute.js` on a 1% sample of rows (all of them if that runs in under ten seconds). Disagreements become `todo` tests and lead your answer.

---
id: heavy-historical-data-audit
title: Check every number in the historical return tables against the original files
size: XL
effort: A fleet of 16 small workers (one per decade), about half an hour
to: Claude Code, Codex, Gemini CLI, ChatGPT
output: report
read: modules/retirement/historical/data/returns.js, modules/investments/backtest/data/shiller.js, tools/extract-history.py, tools/extract-shiller.py, modules/retirement/historical/README.md
summary: About 10,000 data points (yearly 1928 to 2025, monthly from 1871) compared one by one with Damodaran's and Shiller's published files.

Every historical page rests on two data files. This job compares every value in them with the published originals.

**Step 1, the lead.** Fetch the source files the two extract scripts name (Damodaran's `histretSP` spreadsheet and Shiller's `ie_data` spreadsheet). Note each file's version date. Give each worker its decade of rows, from both the repo files and the sources.

**Step 2, the workers (one per decade, 1870s to 2020s).**
- Compare every value: stocks, T-bills, T-bonds and inflation from Damodaran; price, dividend, earnings, CPI and the long rate from Shiller.
- List each difference larger than 0.01 percentage points (0.01 on an index level), with both values and a verdict: a typo, a later revision of the source, or a units mix-up.

**Step 3, the lead.**
- Merge the lists.
- For every confirmed error, give the corrected value and the fix, as a change to the extract script if the error is systematic, otherwise to the data file.
- Add `tests/historical-data.test.mjs`, pinning 50 spot values per series to their source cells.

---
id: heavy-households-verify
title: Recompute the key figures for the 1,400 pretend households
size: XL
effort: A fleet of 14 to 28 small workers (one or two per household type), about an hour
to: Claude Code, Codex, Gemini CLI
output: report
read: qa/households/README.md, qa/households/INDEX.md, qa/households/lib/catalog.mjs, qa/households/lib/expect.mjs, qa/households/run.mjs, qa/households/01-single-adult/base/H-0001-base.md
summary: Net worth, monthly income and spending, emergency-fund months, debt payoff dates and goal status, worked by hand for every failing case and a sample of the passing ones.

`qa/households/` holds 1,400 invented households (14 types × 100 variations). Alongside them, `lib/expect.mjs` holds the tester's own math for what each page should show, and `run.mjs` compares the app against it. Some cases fail.

**Step 1, the lead.** Read `lib/expect.mjs` and turn each figure it checks into a plain rule, with its formula, rounding and the page it belongs to. That rules sheet is every worker's brief. Then give each worker one type folder (`01-single-adult` ... `14-unusual-structures`); a big folder can go to two workers.

**Step 2, the workers.** Recompute by hand, from the case file and the rules sheet, every figure the case lists. Cover the base case, every case whose `INDEX.md` status is `fail`, and 10 random passing cases. Decide each disagreement:
- the app is wrong: a bug in the app;
- `expect.mjs` is wrong: a wrong expectation;
- the case asks for something the rules do not define: undefined.

Report one row per figure: `case_id, figure, app_value, expect_value, your_value, verdict, one-line reason`.

**Step 3, the lead.**
- Group the verdicts by root cause; one bug usually explains many cases.
- For each app bug, give a diff to the page's compute with a test.
- For each wrong expectation, give a diff to `lib/expect.mjs`.
- For each undefined case, write the decision into the case catalog.

Deliver the root-cause table first. The cases' `results/` folder is not in the repo, so reason from the case files and the code.
