# Research
Current figures and law with primary sources, turned into the repo's tables. Best with a model that browses (Perplexity, Gemini Deep Research, ChatGPT deep research).

---
id: research-2027-figures
title: Every 2027 figure the app uses, with sources
size: M
to: Perplexity, Gemini, ChatGPT, Grok
output: research
read: modules/taxes/federal/data/federal.js, modules/retirement/contributions/data/limits.js, modules/retirement/social-security/data/ssa.js, modules/investments/limits/compute.js, modules/taxes/hsa-fsa/compute.js
summary: Brackets, deductions, contribution limits, Social Security, Medicare for 2027.

Find the official 2027 values (or note that they are not yet published, and the expected date) for everything the app's tables hold:
- federal tax brackets, standard deduction, additional standard deduction, capital-gains thresholds, the senior deduction (IRS revenue procedure for 2027);
- 401(k)/403(b)/457 limits and catch-ups including the 60 to 63 super catch-up, IRA limit, Roth phase-outs, SIMPLE, SEP, HSA, health FSA, dependent-care FSA, the annual gift exclusion (IRS notices);
- Social Security: cost-of-living adjustment, taxable maximum, bend points, earnings-test thresholds, quarter of coverage (SSA fact sheet);
- Medicare Part B premium and deductible, IRMAA brackets (CMS).

Compare each with what the repo's data files hold for 2027 (often an inflated projection) and give the changes as diffs, every figure with its source link and publication date.

---
id: research-2025-tax-law
title: The 2025 tax law: what it changed for households, year by year
size: M
to: Perplexity, Gemini, ChatGPT, Claude (2nd account)
output: research
read: core/math/tax.js, modules/taxes/federal/README.md, modules/taxes/federal/data/federal.js, modules/goals/education/README.md, modules/estate/estate-tax/README.md
summary: Senior deduction, SALT cap, tips, overtime, car-loan interest, child credit, estate exemption, 529s, children's accounts.

List every individual provision of the 2025 budget law (Public Law 119-21) that affects a household plan, with its years, amounts, phase-outs and the section of the law or IRS guidance: the senior deduction (2025 to 2028), the SALT cap and its phase-down, the deductions for qualified tips and overtime, car-loan interest, the child tax credit amount and indexing, the standard deduction, the estate and gift exemption, 529 plan uses, the new children's investment accounts, HSA changes, and anything else for individuals.

Then compare with what `core/math/tax.js` and the federal page README say the engine covers, and give: the diffs to the data tables, and for anything not modelled, a short entry for the README's "not covered" list with what it typically costs to ignore.

---
id: research-state-changes
title: State income tax changes for 2026 and 2027
size: M
to: Perplexity, Gemini, ChatGPT
output: research
read: modules/taxes/state/README.md, docs/MODULE_CATALOG.md
summary: Which states changed rates, brackets or retirement exclusions, and when.

List every state that changed its personal income tax for 2026 or has a change scheduled for 2027 (rate cuts on triggers, moves to a flat tax, new or ended retirement-income exclusions, new taxes on high earners or capital gains), with the law or the revenue department's announcement, the effective date, and the new figures. Mark trigger-based cuts with their trigger and whether it has been met.

Deliver the table and a Markdown section to append to `modules/taxes/state/README.md` ("Changes to watch"), so whoever builds the state page knows which states need two versions.

---
id: research-open-source-2026
title: The best open-source finance projects to learn from, late 2026
size: M
to: Perplexity, Gemini, ChatGPT, Grok
output: diff
read: docs/RESOURCES.md, docs/PLAN.md, AGENTS.md
summary: Refresh RESOURCES.md: what is active, what licence, what is worth lifting.

`docs/RESOURCES.md` was curated in September 2026. Check every project in it (last release, still maintained, licence today) and find what is missing: open-source personal-finance apps, retirement and Monte Carlo engines, tax calculators (federal and state), Social Security optimisers, bank-file parsers (OFX, QIF, CSV profiles), and data sets (returns, inflation, mortality) published since 2024.

This repo is public under MIT: mark which projects' code can be lifted (MIT, Apache, BSD) and which can only be references (GPL, AGPL, no licence). Deliver a diff to `docs/RESOURCES.md`, each row with the URL, licence, last activity and the module it would feed.

---
id: research-aca-subsidies
title: Health insurance before 65: the marketplace subsidy rules now
size: M
to: Perplexity, Gemini, ChatGPT
output: research
read: modules/retirement/healthcare/README.md, modules/retirement/healthcare/module.js
summary: Applicable percentages, the 400% cliff, income definition, coverage years 2025 to 2027.

The planned page `retirement/healthcare` shows what marketplace plans cost at each income level before Medicare. Establish the current rules with sources:
- what happened to the enhanced premium tax credit after 2025 (law, dates, and anything enacted or pending since);
- the applicable-percentage table and the income cliff for coverage years 2025, 2026 and 2027;
- the income that counts (MAGI for the premium tax credit) and how retirees can manage it (Roth conversions, capital gains, which withdrawals count);
- cost-sharing reductions and the Medicaid floor in expansion vs non-expansion states.

Deliver a sourced summary and a rewrite of the page's README "Formulas" section that a builder can implement directly.

---
id: research-student-loans
title: Federal student loan repayment after the 2025 law
size: M
to: Perplexity, Gemini, ChatGPT
output: research
read: modules/debt/student-loans/README.md, modules/debt/student-loans/module.js, core/math/payoff.js
summary: The new repayment plan, what happened to SAVE, IBR, forgiveness timing.

The planned page `debt/student-loans` compares repayment plans. Establish, with sources (studentaid.gov, the Department of Education, the statute):
- the plans open to new and existing borrowers as of today, including the Repayment Assistance Plan created by the 2025 law, standard and graduated plans, income-based repayment, and what happened to SAVE and PAYE/ICR, with dates;
- each plan's payment formula (percent of discretionary or adjusted income, the poverty-line multiple, minimums), forgiveness horizon and tax treatment of forgiveness;
- Public Service Loan Forgiveness rules in force.

Deliver the formulas as a README "Formulas" section a builder can implement, plus five worked borrower examples with monthly payments for each plan.

---
id: research-bank-export-formats
title: What the big banks' export files really look like
size: M
to: Perplexity, ChatGPT, Gemini, Grok
output: diff
read: modules/transactions/import/compute.js, modules/transactions/import/README.md, tests/import-banks.test.mjs, qa/fixtures/chase-checking.csv
summary: Column names, sign conventions and date formats for 20 US banks and brokerages.

The importer works out columns by itself and has fixtures for seven banks. Research the CSV (and OFX/QFX) downloads of the twenty largest US banks, card issuers and brokerages (checking, savings, credit card, brokerage positions): header row, column names, date format, whether charges are positive or negative, separate debit/credit columns, extra lines before the header or after the data.

For each, add an invented fixture file in `qa/fixtures/` with five rows in that exact format (invented merchants and amounts, no real account numbers) and a test case in `tests/import-banks.test.mjs`. Fix the importer where a format would be misread, and tabulate the formats in the import README.

---
id: research-withdrawal-research
title: Safe withdrawal research since 2023
size: M
to: Perplexity, Gemini, ChatGPT, Claude (2nd account)
output: report
read: modules/retirement/withdrawal-strategy/README.md, modules/system/assumptions/README.md, modules/system/assumptions/compute.js, core/math/retirement.js
summary: Morningstar's yearly report, guardrails updates, capital-market assumptions.

Summarise what the safe-withdrawal and capital-market research published since 2023 says, with sources: Morningstar's "State of Retirement Income" reports, Kitces and Guyton-Klinger guardrail updates, ERN's series, Vanguard and other firms' 10-year return assumptions, and academic work on sequence risk and spending flexibility.

Then say which of the app's default assumptions and withdrawal methods are now out of line, with the change you would make to each (as diffs to the assumptions compute and its README), and which are fine.

---
id: research-529-deductions
title: State tax breaks for 529 college savings
size: M
to: Perplexity, Gemini, ChatGPT
output: data
read: modules/goals/education/README.md, modules/goals/education/module.js
summary: Deduction or credit, limits, recapture rules, by state, for 2026.

The planned page `goals/education` should count the state tax benefit of 529 contributions. Produce `modules/goals/education/data/state-529.js`: for each state and DC, whether contributions are deductible or earn a credit, the annual limit per taxpayer and per beneficiary (single and joint), whether any state's plan qualifies or only the home state's, carry-forward, recapture on rollovers out, and K-12 tuition treatment; each row with its source and the year it applies to. Add tests checking the shape and five lookups.

---
id: research-estate-inheritance-taxes
title: State estate and inheritance taxes, 2026
size: S
to: Perplexity, Gemini, ChatGPT
output: data
read: modules/estate/estate-tax/README.md, modules/estate/estate-tax/module.js
summary: Exemptions, rates and who pays, with the federal exemption after the 2025 law.

Produce `modules/estate/estate-tax/data/states.js`: the federal estate and gift exemption for 2025 to 2027 (after the 2025 law), the top rate, portability; and for every state with an estate tax or an inheritance tax: the exemption, rates or brackets, which heirs are exempt or taxed at what rate (inheritance taxes), and any cliff (such as New York's). Sources for every row; tests for the shape and three hand-worked estates.

---
id: research-long-term-care-costs
title: What long-term care costs, by state
size: S
to: Perplexity, Gemini, ChatGPT
output: data
read: modules/insurance/ltc/README.md, modules/insurance/ltc/module.js
summary: Home care, assisted living and nursing home costs, plus the odds of needing care.

Produce `modules/insurance/ltc/data/costs.js` from the latest published cost-of-care survey (say which and when): median yearly cost by state for a home health aide, adult day care, assisted living and a private nursing-home room, plus the national figures and the survey's own growth rate. Add the probability of needing paid long-term care and the average duration from a government or peer-reviewed source (for example HHS/ASPE). Sources on every figure; a test of the shape.
