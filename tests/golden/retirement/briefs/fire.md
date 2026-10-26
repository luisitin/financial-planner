# Financial independence worker brief

README: "FI number = yearly spending / withdrawal rate (4% -> 25x)."
"Saving a year = contributions (own + employer) + max(0, left over each month x 12 - own contributions) so nothing is counted twice."
"Real return = the stock/bond blend at stocksNow deflated by inflation. Years to FI: grow the invested pot by the real return plus the yearly saving until it reaches the number (80-year cap)."
"Coast number = FI number / (1 + real return)^(years to the retirement age)."

Rules separately: FI number/withdrawal override; invested excludes cash and excluded account types;
saving/leftover/no double counting; real return; years-to-FI end-year saving and cap;
age/year/years-to-retire; coast; progress/gap/savings rate clamps; missing spending/data.
Use algebraic FV or logarithmic inversion for second checks, with explicit zero/negative return branches.
No intermediate rounding; money two places, return/progress six. Ordinary annualization and birthday
vs calendar-year policies must be labeled. Gaps use worked examples, not production code.
Layout: common contract, compute, realRate and pmt only if connected explicitly to the page.

## Full worker inventory

All 1,800 rows target the FIRE page's `compute(plan, params)` with invented inputs.
There are 18 separate 100-row rule groups, each 60 grid, 30 edge, 10 extreme.
`tools/golden_retirement/fire.py` is an independent Decimal oracle: it imports only
Python standard-library arithmetic and the common CSV serializer. It does not
execute or import production code. Every tenth row has an enforced second
derivation; the generator refuses to write if any of the 180 checks disagrees.
The generator additionally enforces 100 distinct input cases per rule, ignoring
IDs, notes and expected values. Defaults cases vary annual spending, balances,
age, individual/family composition and 2026/2056 dates; precise FI boundaries vary
the scale of the target. This prevents an invariant default from becoming 100
copies of the same plan.

| Rule group | Formula or convention | Source and rounding |
|---|---|---|
| fi-number | F = 12 × monthly spending / withdrawal fraction; 0.04 means 25 × annual spending | README quoted above; exact algebra, cents at output |
| withdrawal-override | params rate takes precedence over stored rate, which takes precedence over 0.04 | Input contract; default is a model choice |
| invested-buckets | P = taxable + deferred + free; excludes cash, 529s, property, vehicles and liabilities | Projection README bucket rule; includes insurance cash value in deferred |
| saving-no-double-count | L = max(0, income − expenses); S = own + employer + max(0, L − own) | README quoted saving identity; equivalent independent check S = max(own,L)+employer |
| real-return | N = stocksNow × stock return + (1−stocksNow) × bond return; r = (1+N)/(1+inflation)−1 | README stock/bond blend deflated by inflation; exact purchasing-power algebra |
| years-positive-return | first integer n where P(1+r)^n + S((1+r)^n−1)/r ≥ F | README annual growth plus annual savings; end-of-year timing |
| years-zero-return | first integer n where P+nS ≥ F; no progress when P<F and S≤0 | Algebraic r→0 branch of same README rule |
| years-negative-return | same compound-growth identity; declining balances and savings equilibrium handled without assuming eventual success | Same identity, r<0 cases |
| eighty-year-boundary | include n=80; exclude first crossing at 81; report null if no crossing within cap; report 0 if already sufficient | README “80-year cap” |
| age-year-retirement | calendar age = evaluation year − birth year; years to retire = max(0, retirement age − age); FI age/year add n; self is primary even if partner listed first | Projection input convention, not exact birthday age |
| coast | C = F/(1+r)^yearsToRetire; reached iff P≥C | README quoted coast formula |
| progress-gap | progress = min(1,P/F); gap = max(0,F−P) | Display conventions, upper clamp only; signed balances may give negative progress |
| savings-rate | min(1,S/income) for positive annual income; null for nonpositive income; hasIncome tests nonzero annual income | Display/input convention |
| missing-spending | absent/zero recurring spending gives ready=false; one-time and ended expenses do not create a recurring spending baseline | Projection/FIRE input contract |
| incomplete-plan-fallback | without complete projection inputs, use recurring Expenses and invested=0 | Explicit input fallback; typed retirement spending is used only with valid projection inputs |
| expense-spending-source | if no positive retirement override, active recurring expenses supply annual spending | README “retirement figure or today's expenses” |
| default-assumptions | defaults: stocksNow=.7, stock return=.07, bond return=.04, inflation=.03, retirement age=65, withdrawal=.04 | Application assumptions, not predictions or statutory numbers |
| income-period-dates | active recurring income annualizes 52/26/24/12/4/1; once=0; unknown period=monthly; interval endpoints inclusive | Common periods/input contract; invented calendar worked examples |

The source of the 4% historical context is William Bengen's October 1994
“Determining Withdrawal Rates Using Historical Data,” republished by the
[Financial Planning Association](https://www.financialplanningassociation.org/sites/default/files/2021-04/MAR04%20Determining%20Withdrawal%20Rates%20Using%20Historical%20Data.pdf),
pp.4–5. The page's arithmetic inversion of a chosen withdrawal rate does not claim
that every plan is safe at 4%, or copy any of the paper's historical calculations.
The README itself names no external source for the remaining accounting rules.
Those rules are explicit planning conventions, with algebraic derivations here
and numeric worked examples in the CSV, rather than invented statutory claims.

For compound growth, deposit k grows for n−k years: the capital after n years is
P(1+r)^n + SΣ(j=0…n−1)(1+r)^j. Summing that geometric series gives the annuity
identity above. When r=0, each deposit stays S, giving P+nS. The oracle evaluates
this closed form for integer horizons. Every tenth growth row is independently
checked by expanding all individual deposits rather than using the annuity
formula, then proving the crossing and every earlier failure. Coast rows check
that the proposed capital compounds back to F. This follows directly from the
README's annual timing; the oracle does not copy the production year loop.

Money inputs/outputs have two decimals, rates and progress six, dates YYYY-MM-DD.
The oracle keeps higher precision internally and never rounds intermediate
growth. Checks compare money within 0.005; counts/booleans/nulls/years are exact.
No statutory tax or Social Security model runs in this page's expected values.
The inputs include negative balances and returns, zero deposits, exact threshold
crossings, individual/family plans, 2026/2056 dates, year endpoints and leap days.
Extreme rows use cents, billion-dollar amounts and a 100-year coast horizon.
Fixed returns, 80-year search and default rates are model assumptions, not
investment forecasts. Every invented amount has its arithmetic in the row note.

## Fixed CSV header

Blank means omitted, `@null` explicit null, `@empty-array` an empty list. Inputs
are flattened `plan.*` / `params.*`; expected columns identify exact output paths.

```csv
case_id,rule,kind,target,params.today,params.withdrawalRate,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.type,plan.accounts.10.balance,plan.accounts.10.id,plan.accounts.10.type,plan.accounts.11.balance,plan.accounts.11.id,plan.accounts.11.type,plan.accounts.12.balance,plan.accounts.12.id,plan.accounts.12.type,plan.accounts.13.balance,plan.accounts.13.id,plan.accounts.13.type,plan.accounts.14.balance,plan.accounts.14.id,plan.accounts.14.type,plan.accounts.15.balance,plan.accounts.15.id,plan.accounts.15.type,plan.accounts.16.balance,plan.accounts.16.id,plan.accounts.16.type,plan.accounts.17.balance,plan.accounts.17.id,plan.accounts.17.type,plan.accounts.18.balance,plan.accounts.18.id,plan.accounts.18.type,plan.accounts.2.balance,plan.accounts.2.id,plan.accounts.2.type,plan.accounts.3.balance,plan.accounts.3.id,plan.accounts.3.type,plan.accounts.4.balance,plan.accounts.4.id,plan.accounts.4.type,plan.accounts.5.balance,plan.accounts.5.id,plan.accounts.5.type,plan.accounts.6.balance,plan.accounts.6.id,plan.accounts.6.type,plan.accounts.7.balance,plan.accounts.7.id,plan.accounts.7.type,plan.accounts.8.balance,plan.accounts.8.id,plan.accounts.8.type,plan.accounts.9.balance,plan.accounts.9.id,plan.accounts.9.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnStocks,plan.expenses,plan.expenses.0.amount,plan.expenses.0.category,plan.expenses.0.endDate,plan.expenses.0.id,plan.expenses.0.name,plan.expenses.0.period,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.income.0.amount,plan.income.0.endDate,plan.income.0.id,plan.income.0.name,plan.income.0.period,plan.income.0.personId,plan.income.0.startDate,plan.income.0.type,plan.retirement.contributions.0.accountId,plan.retirement.contributions.0.amount,plan.retirement.contributions.0.employerMatch,plan.retirement.contributions.0.id,plan.retirement.contributions.0.period,plan.retirement.contributions.0.personId,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.withdrawalRate,expected.age,expected.coast.number,expected.coast.reached,expected.fiAge,expected.fiNumber,expected.fiYear,expected.gap,expected.hasIncome,expected.invested,expected.missing.length,expected.progress,expected.ready,expected.realReturn,expected.retireAge,expected.savingYearly,expected.savingsRate,expected.spendingYearly,expected.withdrawalRate,expected.yearsToFi,expected.yearsToRetire,todo,note
```

## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,params.today,params.withdrawalRate,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.type,plan.accounts.10.balance,plan.accounts.10.id,plan.accounts.10.type,plan.accounts.11.balance,plan.accounts.11.id,plan.accounts.11.type,plan.accounts.12.balance,plan.accounts.12.id,plan.accounts.12.type,plan.accounts.13.balance,plan.accounts.13.id,plan.accounts.13.type,plan.accounts.14.balance,plan.accounts.14.id,plan.accounts.14.type,plan.accounts.15.balance,plan.accounts.15.id,plan.accounts.15.type,plan.accounts.16.balance,plan.accounts.16.id,plan.accounts.16.type,plan.accounts.17.balance,plan.accounts.17.id,plan.accounts.17.type,plan.accounts.18.balance,plan.accounts.18.id,plan.accounts.18.type,plan.accounts.2.balance,plan.accounts.2.id,plan.accounts.2.type,plan.accounts.3.balance,plan.accounts.3.id,plan.accounts.3.type,plan.accounts.4.balance,plan.accounts.4.id,plan.accounts.4.type,plan.accounts.5.balance,plan.accounts.5.id,plan.accounts.5.type,plan.accounts.6.balance,plan.accounts.6.id,plan.accounts.6.type,plan.accounts.7.balance,plan.accounts.7.id,plan.accounts.7.type,plan.accounts.8.balance,plan.accounts.8.id,plan.accounts.8.type,plan.accounts.9.balance,plan.accounts.9.id,plan.accounts.9.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnStocks,plan.expenses,plan.expenses.0.amount,plan.expenses.0.category,plan.expenses.0.endDate,plan.expenses.0.id,plan.expenses.0.name,plan.expenses.0.period,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.income.0.amount,plan.income.0.endDate,plan.income.0.id,plan.income.0.name,plan.income.0.period,plan.income.0.personId,plan.income.0.startDate,plan.income.0.type,plan.retirement.contributions.0.accountId,plan.retirement.contributions.0.amount,plan.retirement.contributions.0.employerMatch,plan.retirement.contributions.0.id,plan.retirement.contributions.0.period,plan.retirement.contributions.0.personId,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.withdrawalRate,expected.age,expected.coast.number,expected.coast.reached,expected.fiAge,expected.fiNumber,expected.fiYear,expected.gap,expected.hasIncome,expected.invested,expected.missing.length,expected.progress,expected.ready,expected.realReturn,expected.retireAge,expected.savingYearly,expected.savingsRate,expected.spendingYearly,expected.withdrawalRate,expected.yearsToFi,expected.yearsToRetire,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| fi-number | 60 | 30 | 10 | 10 | 0 |
| withdrawal-override | 60 | 30 | 10 | 10 | 0 |
| invested-buckets | 60 | 30 | 10 | 10 | 0 |
| saving-no-double-count | 60 | 30 | 10 | 10 | 0 |
| real-return | 60 | 30 | 10 | 10 | 0 |
| years-positive-return | 60 | 30 | 10 | 10 | 0 |
| years-zero-return | 60 | 30 | 10 | 10 | 0 |
| years-negative-return | 60 | 30 | 10 | 10 | 0 |
| eighty-year-boundary | 60 | 30 | 10 | 10 | 0 |
| age-year-retirement | 60 | 30 | 10 | 10 | 0 |
| coast | 60 | 30 | 10 | 10 | 0 |
| progress-gap | 60 | 30 | 10 | 10 | 0 |
| savings-rate | 60 | 30 | 10 | 10 | 0 |
| missing-spending | 60 | 30 | 10 | 10 | 0 |
| incomplete-plan-fallback | 60 | 30 | 10 | 10 | 0 |
| expense-spending-source | 60 | 30 | 10 | 10 | 0 |
| default-assumptions | 60 | 30 | 10 | 10 | 0 |
| income-period-dates | 60 | 30 | 10 | 10 | 0 |
