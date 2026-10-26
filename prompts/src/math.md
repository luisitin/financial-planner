# Heavy math
Long, number-heavy work with little judgement. Best with a model that shows its arithmetic.

---
id: math-amortization-golden
title: Fifty golden loan schedules for the debt pages
size: L
to: ChatGPT, DeepSeek, Gemini, Claude (2nd account)
output: diff
read: core/math/finance.js, core/math/payoff.js, tests/finance.test.mjs, tests/payoff.test.mjs, modules/debt/mortgage/compute.js, modules/debt/refinance/compute.js
summary: Hand-checked amortisation, extra-payment, biweekly and recast cases.

Build `tests/amortization-golden.test.mjs` with fifty loan cases worked out independently of the code (show the formula and the key intermediate numbers in a comment for each):
- rates 0%, 0.01%, 2.75%, 6.5%, 7.25%, 19.99%, 29.99%; terms 12, 36, 60, 180, 360 months; principals from $500 to $1,250,000;
- the payment (to the cent), total interest, the payoff month, the balance after 12 and after 60 payments, and the final payment, which is smaller and must zero the balance exactly;
- extra principal every month, a one-time lump sum in month 13, biweekly payments (26 half-payments a year), a recast after a lump sum, and a payment below the monthly interest (never pays off: the code must say so, not loop);
- the mortgage page's "what an extra $X saves" figures for three of the cases.

Cross-check each payment against the standard formula `P·r / (1 − (1+r)^−n)` and say which convention the code uses for rounding each month's interest (to the cent or not); the tests must pin that convention.

---
id: math-tvm-excel-parity
title: PMT, FV, PV, NPER, RATE, NPV, IRR, XIRR: Excel parity
size: M
to: ChatGPT, DeepSeek, Gemini, Qwen
output: diff
read: core/math/finance.js, core/math/returns.js, tests/finance.test.mjs, tests/returns.test.mjs
summary: Thirty vectors each, matching spreadsheet semantics and edge cases.

People check this app against spreadsheets. For every time-value function in `core/math/finance.js` and `core/math/returns.js`, write thirty test vectors whose expected values follow Excel/LibreOffice semantics exactly (sign convention: money paid out is negative; `type` 0 = end of period, 1 = beginning):
- ordinary cases, rate 0, `type` 1, negative rates, very long horizons (600 periods);
- RATE and IRR with a guess, a cash-flow series with no sign change (must return an error or `null`, state which the code does), and a series with two real IRRs (say which one is returned and why);
- XIRR with irregular dates across a leap day, a first flow that is not the earliest date, and same-day flows.

Where the code's convention differs from Excel's on purpose, keep the code and write the test for the code's convention with a comment saying how Excel differs. Values to at least 1e-9 relative.

---
id: math-federal-tax-vectors
title: Forty federal returns worked by hand (2024 to 2026)
size: L
to: ChatGPT, Gemini, Claude (2nd account), DeepSeek
output: diff
read: core/math/tax.js, modules/taxes/federal/data/federal.js, modules/taxes/federal/README.md, modules/taxes/federal/compute.js, tests/tax.test.mjs, tests/tax-pages.test.mjs
summary: Brackets, capital-gains stacking, Social Security taxability, credits, NIIT, senior deduction.

Write forty invented households and work each one's federal income tax by hand for tax years 2024, 2025 and 2026 (2026 from IRS Rev. Proc. 2025-32), following the IRS worksheets, and add them as tests in `tests/tax-vectors.test.mjs`:
- every filing status; wages only; wages plus qualified dividends and long-term gains that straddle the 0%/15% and 15%/20% thresholds (the Qualified Dividends and Capital Gain Tax Worksheet); a short-term loss larger than $3,000 with carryover;
- Social Security benefits at the 0%, 50% and 85% taxable zones (the Social Security Benefits Worksheet), with and without a pension;
- the additional standard deduction for 65+ and blind, and the 2025 to 2028 senior deduction with its phase-out;
- child tax credit and credit for other dependents, including the phase-out;
- net investment income tax (3.8%) and the additional Medicare tax (0.9%);
- itemized vs standard deduction, including the SALT cap for the year in question.

For each case show taxable income, the tax before credits, credits, other taxes and the total, with the worksheet lines. If the code disagrees, mark the test `todo` with the line where you think the code is wrong, and lead your answer with those.

---
id: math-state-tax-northeast
title: State income tax tables, Northeast and DC (2025, 2026)
size: L
to: ChatGPT, Gemini, Perplexity, Claude (2nd account)
output: data
read: docs/DATA_MODEL.md, modules/taxes/state/README.md, core/math/tax.js, modules/taxes/federal/data/federal.js
summary: CT, DE, DC, ME, MD, MA, NH, NJ, NY, PA, RI, VT as data with sources.

The planned page `taxes/state` needs each state's personal income tax as data. Produce `modules/taxes/state/data/northeast.js` for Connecticut, Delaware, District of Columbia, Maine, Maryland, Massachusetts, New Hampshire, New Jersey, New York, Pennsylvania, Rhode Island and Vermont, tax years 2025 and 2026, in exactly this shape:

```js
export const STATES = {
  NY: {
    2025: {
      kind: "brackets",            // "brackets" | "flat" | "none" | "interest-dividends-only"
      brackets: { single: [[0, 0.04], [8500, 0.045]], married_joint: [...], married_separate: [...], head_of_household: [...] },
      standard: { single: 8000, married_joint: 16050, ... },   // 0 if the state has none
      exemption: { personal: 0, dependent: 1000 },              // per person
      startsFrom: "federal-agi",   // or "federal-taxable" or "own"
      notes: ["recapture of lower brackets above $107,650 AGI"], // anything the simple model leaves out
      source: "https://... (the revenue department's own page or form instructions)",
    },
    2026: { ... },
  },
};
```

Rules: every number from the state's revenue department (form instructions or rate schedule), not an aggregator; where 2026 is not yet published, carry 2025 forward and add `"projected: not yet published"` to `notes`. Mark local income taxes (New York City, Yonkers, Maryland counties, Pennsylvania local earned-income tax) in `notes` instead of modelling them. Then add `tests/state-tax-data.test.mjs` checking the shape and three hand-worked returns per state.

---
id: math-state-tax-midwest
title: State income tax tables, Midwest (2025, 2026)
size: L
to: ChatGPT, Gemini, Perplexity, DeepSeek
output: data
read: docs/DATA_MODEL.md, modules/taxes/state/README.md, core/math/tax.js, modules/taxes/federal/data/federal.js
summary: IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI as data with sources.

Same task and the same data shape as the Northeast prompt (copied here so this one stands alone). Produce `modules/taxes/state/data/midwest.js` for Illinois, Indiana, Iowa, Kansas, Michigan, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota and Wisconsin, tax years 2025 and 2026:

```js
export const STATES = {
  OH: {
    2025: {
      kind: "brackets",            // "brackets" | "flat" | "none" | "interest-dividends-only"
      brackets: { single: [[0, 0], [26050, 0.0275]], married_joint: [...], married_separate: [...], head_of_household: [...] },
      standard: { single: 0, married_joint: 0, ... },
      exemption: { personal: 0, dependent: 0 },
      startsFrom: "federal-agi",   // or "federal-taxable" or "own"
      notes: ["municipal income taxes not modelled"],
      source: "https://... (the revenue department's own page or form instructions)",
    },
    2026: { ... },
  },
};
```

Every number from the state's revenue department; where 2026 is not yet published, carry 2025 forward and note `"projected: not yet published"`. Watch the states that cut rates on a schedule (Iowa, Nebraska, Indiana, Missouri, Ohio) and note the trigger rules. Local taxes (Ohio cities, Michigan cities, Indiana counties, Missouri's two cities) go in `notes`. Add tests: shape plus three hand-worked returns per state.

---
id: math-state-tax-south
title: State income tax tables, South (2025, 2026)
size: L
to: ChatGPT, Gemini, Perplexity, Claude (2nd account)
output: data
read: docs/DATA_MODEL.md, modules/taxes/state/README.md, core/math/tax.js, modules/taxes/federal/data/federal.js
summary: AL, AR, FL, GA, KY, LA, MS, NC, OK, SC, TN, TX, VA, WV as data with sources.

Same task and data shape as the other state prompts. Produce `modules/taxes/state/data/south.js` for Alabama, Arkansas, Florida, Georgia, Kentucky, Louisiana, Mississippi, North Carolina, Oklahoma, South Carolina, Tennessee, Texas, Virginia and West Virginia, tax years 2025 and 2026:

```js
export const STATES = {
  GA: {
    2025: {
      kind: "flat",                // "brackets" | "flat" | "none" | "interest-dividends-only"
      brackets: { single: [[0, 0.0519]], married_joint: [[0, 0.0519]], married_separate: [[0, 0.0519]], head_of_household: [[0, 0.0519]] },
      standard: { single: 12000, married_joint: 24000, ... },
      exemption: { personal: 0, dependent: 4000 },
      startsFrom: "federal-agi",
      notes: [],
      source: "https://... (the revenue department's own page or form instructions)",
    },
    2026: { ... },
  },
  TX: { 2025: { kind: "none", source: "..." }, 2026: { kind: "none", source: "..." } },
};
```

Every number from the state's revenue department; 2026 carried forward with `"projected: not yet published"` where needed. Several of these states moved to flat taxes or cut rates on triggers (Georgia, Louisiana, Mississippi, North Carolina, Arkansas, Kentucky, West Virginia, Oklahoma, South Carolina): note each schedule. Retirement-income exclusions that matter to retirees (pension and Social Security exclusions) go in a `retirement` field as plain data with the rule's limits. Tests: shape plus three hand-worked returns per state with an income tax.

---
id: math-state-tax-west
title: State income tax tables, West (2025, 2026)
size: L
to: ChatGPT, Gemini, Perplexity, DeepSeek
output: data
read: docs/DATA_MODEL.md, modules/taxes/state/README.md, core/math/tax.js, modules/taxes/federal/data/federal.js
summary: AK, AZ, CA, CO, HI, ID, MT, NV, NM, OR, UT, WA, WY as data with sources.

Same task and data shape as the other state prompts. Produce `modules/taxes/state/data/west.js` for Alaska, Arizona, California, Colorado, Hawaii, Idaho, Montana, Nevada, New Mexico, Oregon, Utah, Washington and Wyoming, tax years 2025 and 2026:

```js
export const STATES = {
  CA: {
    2025: {
      kind: "brackets",            // "brackets" | "flat" | "none" | "interest-dividends-only" | "capital-gains-only"
      brackets: { single: [[0, 0.01], [10756, 0.02]], married_joint: [...], married_separate: [...], head_of_household: [...] },
      standard: { single: 5540, married_joint: 11080, ... },
      exemption: { personal: 149, dependent: 461, kind: "credit" },   // say whether it is a deduction or a credit
      startsFrom: "federal-agi",
      notes: ["mental health services tax: 1% over $1,000,000"],
      source: "https://... (the revenue department's own page or form instructions)",
    },
    2026: { ... },
  },
  WA: { 2025: { kind: "capital-gains-only", ... } },
};
```

Every number from the state's revenue department; 2026 carried forward with `"projected: not yet published"` where needed. Washington's capital-gains excise tax and Hawaii's many brackets need care; Oregon and California index brackets yearly. Tests: shape plus three hand-worked returns per state with an income tax.

---
id: math-contribution-limits-history
title: Contribution limits, 2015 to 2027, every account type
size: M
to: ChatGPT, Perplexity, Gemini, DeepSeek
output: data
read: modules/retirement/contributions/data/limits.js, modules/investments/limits/compute.js, modules/investments/limits/README.md, modules/retirement/contributions/compute.js
summary: 401(k)/403(b)/457, IRA, Roth phase-outs, HSA, FSA, SIMPLE, SEP, catch-ups, 60-63 super catch-up.

Extend `modules/retirement/contributions/data/limits.js` so it holds every year from 2015 to 2027 (keep its current shape; add fields if needed and update the two computes that read it):
- elective deferral limit (401(k), 403(b), governmental 457(b)), catch-up at 50+, the SECURE 2.0 super catch-up for ages 60 to 63 (from 2025), and the 2026 rule that catch-ups for wages over the threshold must be Roth;
- total annual additions limit (415(c)); SIMPLE IRA and its catch-ups; SEP percentage and dollar cap;
- IRA and Roth IRA limit and catch-up; the Roth income phase-out ranges and the deductible-IRA phase-outs, by filing status;
- HSA self and family limits and the 55+ catch-up; health FSA limit and carryover; dependent-care FSA;
- the annual gift exclusion (for 529 front-loading).

Each year with its IRS notice or revenue procedure. 2027 figures not yet announced on the day you answer: mark them projected and say how you projected them. Tests: the table's shape, monotonic where the law says so, and five hand-checked "room left" cases.

---
id: math-monte-carlo-validation
title: Prove the Monte Carlo engine is statistically sound
size: L
to: ChatGPT, Gemini, DeepSeek, Claude (2nd account)
output: diff
read: core/math/montecarlo.js, tests/montecarlo.test.mjs, modules/retirement/monte-carlo/compute.js, modules/retirement/monte-carlo/README.md, core/math/retirement.js
summary: Seed reproducibility, zero volatility, moments, convergence, success-rate error bars.

Write `tests/montecarlo-stats.test.mjs` that checks the random-return engine the way a statistician would, using fixed seeds so the tests are deterministic:
- the same seed gives identical paths; different seeds give different ones;
- zero volatility reproduces the deterministic compound-growth path exactly;
- over 20,000 draws, the sample mean and standard deviation of annual (log or simple, whichever the code draws) returns fall inside 99.9% confidence intervals around the configured values; skew and kurtosis match the distribution the code claims (lognormal or normal: say which it is);
- if stocks and bonds are drawn jointly, the sample correlation matches the configured one;
- the success rate converges: the difference between 5,000 and 20,000 paths is inside the binomial standard error, and the page could show that error (give the formula `sqrt(p(1-p)/n)` and a test of a helper that returns it).

If any check fails, find out why and say so before proposing a fix.

---
id: math-rmd-tables
title: Required minimum distributions: tables, start ages, worked cases
size: M
to: ChatGPT, Gemini, DeepSeek, Perplexity
output: diff
read: core/math/rmd.js, modules/retirement/rmd/compute.js, modules/retirement/rmd/README.md, modules/retirement/rmd/module.test.mjs
summary: Uniform Lifetime, Joint and Last Survivor, Single Life; SECURE 2.0 start ages.

Check and extend `core/math/rmd.js` against IRS Publication 590-B (tables in effect from 2022):
- the full Uniform Lifetime Table (ages 72 to 120+), the Joint and Last Survivor table for a spouse more than ten years younger (at least the rows the app needs, with how to look up the rest), and the Single Life table for inherited accounts;
- start age by birth date: 70½ (born before July 1, 1949), 72 (born July 1, 1949 to 1950), 73 (born 1951 to 1959), 75 (born 1960 or later), with the first-year deadline of April 1 of the following year and the double-distribution trap that creates;
- the 10-year rule for most non-spouse beneficiaries and the annual-RMD requirement when the owner had already started.

Twenty worked cases as tests: balance on December 31 of the prior year, age, divisor, RMD to the cent.

---
id: math-social-security-vectors
title: Social Security benefit math: twenty-five worked cases
size: L
to: ChatGPT, Gemini, Claude (2nd account), DeepSeek
output: diff
read: modules/retirement/social-security/compute.js, modules/retirement/social-security/data/ssa.js, modules/retirement/social-security/README.md, modules/retirement/social-security/module.test.mjs
summary: AWI indexing, bend points, PIA rounding, early and delayed claiming, spousal, earnings test.

Verify `modules/retirement/social-security` against the SSA's own rules and add twenty-five hand-worked tests:
- AIME from a 35-year earnings record indexed by the average wage index of the year the person turns 60 (and not indexed after 60), with the taxable maximum per year;
- PIA from the bend points of the year of eligibility (age 62), each factor applied and the result rounded down to the dime, then COLAs from 62 onward;
- benefit at every claiming age from 62 to 70 by month: 5/9 of 1% for the first 36 months early, 5/12 of 1% beyond, 8%/year delayed credits up to 70, with full retirement age by birth year;
- spousal benefit (up to 50% of the worker's PIA, reduced if claimed early, no delayed credits) and the survivor benefit;
- the earnings test before full retirement age (2025 to 2027 thresholds) and how withheld months are credited back.

Use the data in `data/ssa.js` where it covers the year; say which tables are missing. For each case show the arithmetic.

---
id: math-aca-irmaa-tables
title: Health cost tables: ACA subsidy and Medicare income surcharges
size: M
to: ChatGPT, Perplexity, Gemini, Claude (2nd account)
output: data
read: modules/retirement/healthcare/README.md, modules/retirement/medicare/README.md, docs/DATA_MODEL.md, core/math/tax.js
summary: Federal poverty guidelines, applicable percentages, IRMAA brackets and premiums.

Two planned pages need tables. Produce both as data modules with sources, plus tests that use them:
1. `modules/retirement/healthcare/data/aca.js`: federal poverty guidelines (48 states, Alaska, Hawaii) for the coverage years 2024 to 2027; the applicable-percentage table for each coverage year (say plainly what happened to the enhanced subsidies after 2025 and the 400% cliff, with the law and date); the definition of household income for the subsidy (modified AGI including untaxed Social Security and tax-exempt interest).
2. `modules/retirement/medicare/data/medicare.js`: Part B standard premium and deductible, Part D base premium, and the IRMAA brackets (single and joint, with the two-year look-back on MAGI) and surcharges for 2024 to 2027; the 2027 figures marked projected if not yet announced.

Tests: a 63-year-old couple's subsidy at 150%, 300%, 400% and 450% of the poverty line for the second-lowest-cost silver plan premium you assume, and five IRMAA lookups at bracket edges.

---
id: math-historical-returns-check
title: Check the historical return data and the 4% rule replays
size: L
to: ChatGPT, Gemini, DeepSeek, Claude (2nd account)
output: diff
read: modules/retirement/historical/data/returns.js, modules/investments/backtest/data/shiller.js, modules/retirement/historical/compute.js, modules/investments/backtest/compute.js, tools/extract-history.py, tools/extract-shiller.py
summary: Damodaran 1928-2025 and Shiller 1871- against their sources; Trinity-style success rates.

The historical pages replay real years. Check the data and the replays:
1. Compare `modules/retirement/historical/data/returns.js` (Damodaran, 1928 to 2025: stocks, T-bills, T-bonds, inflation) and `modules/investments/backtest/data/shiller.js` against the published source files: list any year that differs by more than 0.05 percentage points and say which value is right.
2. Compute by hand (show your method) the compound annual growth, worst year, best year and deepest peak-to-trough fall for 100% stocks, 60/40 and 40/60 over the full span.
3. Replay a 30-year retirement with 4% of the starting balance, raised with inflation, for every start year with 30 years of data, for 50/50 and 75/25 mixes: the share of start years where the money lasts. Compare with the Trinity study and Bengen (1994), and explain differences (data source, rebalancing, fees, monthly vs yearly).

Turn steps 2 and 3 into tests for the two pages' computes.

---
id: math-longevity-tables
title: Life tables for "How long to plan for"
size: M
to: ChatGPT, Gemini, DeepSeek, Perplexity
output: data
read: modules/retirement/longevity/compute.js, modules/retirement/longevity/README.md, modules/retirement/longevity/module.test.mjs
summary: The SSA period life table as data, joint survival, and how far the Gompertz fit drifts.

The longevity page fits a Gompertz curve. Add the real table and measure the fit:
1. `modules/retirement/longevity/data/ssa-life-table.js`: the latest SSA period life table (from the Trustees Report actuarial tables): death probability q(x) by single age 0 to 119, male and female, with the table year and source link.
2. Survival from any age to every later age, single and joint (at least one of a couple alive), from the table.
3. For ages 50, 60, 65, 70 and 80: the age with a 50%, 25% and 10% chance of being reached, from the table and from the code's Gompertz fit, and the difference.

Tests from step 3 (table values) and a note in the README on when the fit is good enough.
