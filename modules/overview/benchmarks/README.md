# How am I doing  (`overview/benchmarks`)

**Status:** usable (phase 9)
**Purpose:** Your net worth against families of your age, your retirement savings against the usual guideline for your age, and the rules of thumb for saving, cash, housing and debt.

## Inputs
`household` (the head's age: the person marked "Me"), `accounts`, `income`, `expenses`, `debts`, `retirement.contributions`, through the Net worth, Income, Expenses, Emergency fund, Debts and Contributions computes. Writes nothing.

## Outputs
`{ ready, missing, age, group, scfYear, items[], ahead, judged }`; each item `{ id, title, you, benchmark, unit, better, verdict: ahead|on par|behind|unknown, sentence, source, go }`.

## The benchmarks
| item | you | benchmark | source |
|---|---|---|---|
| Net worth | Net worth page | the median net worth of families whose head is in the same age group | Federal Reserve, Survey of Consumer Finances 2025 ("Changes in U.S. Family Finances from 2022 to 2025", October 2026), 2025 dollars: `data/scf.js` |
| Retirement savings for your age | 401(k), IRA and Roth balances / a year's pay (salary and bonus) | Fidelity's multiple of pay for the age (1x by 30, 2x by 35, 3x by 40, 4x by 45, 6x by 50, 7x by 55, 8x by 60, 10x by 67), straight-line between (0 at 22) | Fidelity Viewpoints, "How much do I need to save for retirement?" |
| Saving for retirement | contributions with the employer's money / pay | 15% | Fidelity's 15% guideline |
| Cash for emergencies | the Emergency fund page's months of must-pay bills | 3 months (ahead from 3; the usual range is 3 to 6) | common rule |
| Housing cost | housing expenses / gross monthly income | 28% or less | lenders' front-end ratio |
| Debt payments | Debts page's debt-to-income | 36% or less (43%: the qualified-mortgage line) | lenders' back-end ratio |
Verdicts: "ahead" 10% or more past the benchmark (7% for rates), "on par" within it, "behind" short of it; cash is ahead from 3 months, on par from 2.1.

The SCF figures were read on 2026-10-30 from news reports of the release (federalreserve.gov was not reachable from the build session); the reports agree except the 75-and-over median ($504,900 in most, $504,600 in one). The survey is every three years: update `data/scf.js` when the 2028 survey is out (2029).

## Tests
`module.test.mjs`: the age groups and the savings multiple, not ready without a birth date, the family's six items and verdicts.

## Ideas / not yet
- Percentiles (not only the median) and income groups from the SCF tables; the trend from the net-worth history; a couple's own age gap.
