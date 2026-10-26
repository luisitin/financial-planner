# Withdrawal order worker brief



README: "project() once per order with withdrawalOrder and tax: { mode: brackets }."

"Orders are ranked by what is left at the end after the tax still owed on pre-tax money

(endAfterTaxReal: cash + taxable + Roth + pre-tax x (1 - the last year's bracket)); a plan that

runs out ranks by how late it does." "Cash always goes first."

Four orders: taxable/deferred/free, deferred/taxable/free, deferred/free/taxable, free/taxable/deferred.

Rules separately: normalized cash-first order; bracket withdrawal gross-up/bucket exhaustion;

ordinary brackets; qualified gains/dividends stacking; SSA taxable income; standard/age/senior

deductions, future table indexing; RMD income; real tax/RMD totals; after-tax estate and last marginal

rate; ranking/failure/ties; current selection and flat-mode note/readiness. Cover only tax helpers

actually reachable from retirement: wage surtax and child credits are not passed by the engine.

Use IRS Rev Procs 2024-40/2025-32, Pub 915, SECURE 2.0, IRS senior deduction guidance and NIIT.

Do not implement expected tax by copying tax.js; independently piecewise integrate bracket widths.

README silent indexing uses application assumption with statutory rounding; identify mismatches in

base-year standard deduction rounding. Money tax rounded at final yearly federal tax to cents;

engine subcent iteration must not set expected outputs. Layout common compute plus shared tax targets.



## Completed independent oracle



14 rules ×100 cases =1,400. Each has60 grid/30 edge/10 extreme cases. Sources and

independent methods are `tax_oracle.py` and the row notes. Primitive parameters are

injected by the replay runner using `params.taxYear` and `params.inflation`. Source-year

figures are exact; only hypothetical later years receive rounding. Money uses final

half-up cents; rates six places. SSA married-separate assumes lived apart all year.

Every tenth primitive uses alternate bracket/intersection/worksheet arithmetic; every

tenth page uses conservation plus alternate tax integration.



Known disagreements: married-separate senior eligibility, phaseout applied to each

eligible senior separately, and unmodified2025 HOH deduction23625.



Exact header:

```csv

case_id,rule,kind,target,arg.0,arg.0.ages65plus,arg.0.filingStatus,arg.0.otherOrdinary,arg.0.qualifiedIncome,arg.1,arg.1.inflation,arg.2,arg.2.ages65plus,arg.3,params.inflation,params.taxYear,params.today,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.accounts.2.balance,plan.accounts.2.id,plan.accounts.2.name,plan.accounts.2.ownerId,plan.accounts.2.type,plan.accounts.3.balance,plan.accounts.3.id,plan.accounts.3.name,plan.accounts.3.ownerId,plan.accounts.3.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.filingStatus,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.dividendYield,plan.retirement.gainShare,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.taxMode,plan.retirement.taxRate,plan.retirement.withdrawalOrder.0,plan.retirement.withdrawalOrder.1,plan.retirement.withdrawalOrder.2,expected.allFail,expected.best,expected.bracketRate,expected.bracketsOn,expected.current,expected.deduction.amount,expected.deduction.senior,expected.deduction.standard,expected.gainVsWorst,expected.niit,expected.options.0.best,expected.options.0.current,expected.options.0.endAfterTaxReal,expected.options.0.endBalanceReal,expected.options.0.endTaxRate,expected.options.0.failYear,expected.options.0.key,expected.options.0.order.0,expected.options.0.order.1,expected.options.0.order.2,expected.options.0.rmdReal,expected.options.0.success,expected.options.0.taxesReal,expected.options.1.best,expected.options.1.current,expected.options.1.endAfterTaxReal,expected.options.1.endBalanceReal,expected.options.1.endTaxRate,expected.options.1.failYear,expected.options.1.key,expected.options.1.order.0,expected.options.1.order.1,expected.options.1.order.2,expected.options.1.rmdReal,expected.options.1.success,expected.options.1.taxesReal,expected.options.2.best,expected.options.2.current,expected.options.2.endAfterTaxReal,expected.options.2.endBalanceReal,expected.options.2.endTaxRate,expected.options.2.failYear,expected.options.2.key,expected.options.2.order.0,expected.options.2.order.1,expected.options.2.order.2,expected.options.2.rmdReal,expected.options.2.success,expected.options.2.taxesReal,expected.options.3.best,expected.options.3.current,expected.options.3.endAfterTaxReal,expected.options.3.endBalanceReal,expected.options.3.endTaxRate,expected.options.3.failYear,expected.options.3.key,expected.options.3.order.0,expected.options.3.order.1,expected.options.3.order.2,expected.options.3.rmdReal,expected.options.3.success,expected.options.3.taxesReal,expected.options.length,expected.ready,expected.roomInBracket,expected.status.head_of_household.brackets.0,expected.status.head_of_household.brackets.1,expected.status.head_of_household.brackets.2,expected.status.head_of_household.brackets.3,expected.status.head_of_household.brackets.4,expected.status.head_of_household.brackets.5,expected.status.head_of_household.extraAllowance,expected.status.head_of_household.ltcgBrackets.0,expected.status.head_of_household.ltcgBrackets.1,expected.status.head_of_household.standardDeduction,expected.status.married_joint.brackets.0,expected.status.married_joint.brackets.1,expected.status.married_joint.brackets.2,expected.status.married_joint.brackets.3,expected.status.married_joint.brackets.4,expected.status.married_joint.brackets.5,expected.status.married_joint.extraAllowance,expected.status.married_joint.ltcgBrackets.0,expected.status.married_joint.ltcgBrackets.1,expected.status.married_joint.standardDeduction,expected.status.married_separate.brackets.0,expected.status.married_separate.brackets.1,expected.status.married_separate.brackets.2,expected.status.married_separate.brackets.3,expected.status.married_separate.brackets.4,expected.status.married_separate.brackets.5,expected.status.married_separate.extraAllowance,expected.status.married_separate.ltcgBrackets.0,expected.status.married_separate.ltcgBrackets.1,expected.status.married_separate.standardDeduction,expected.status.qualifying_surviving.brackets.0,expected.status.qualifying_surviving.brackets.1,expected.status.qualifying_surviving.brackets.2,expected.status.qualifying_surviving.brackets.3,expected.status.qualifying_surviving.brackets.4,expected.status.qualifying_surviving.brackets.5,expected.status.qualifying_surviving.extraAllowance,expected.status.qualifying_surviving.ltcgBrackets.0,expected.status.qualifying_surviving.ltcgBrackets.1,expected.status.qualifying_surviving.standardDeduction,expected.status.single.brackets.0,expected.status.single.brackets.1,expected.status.single.brackets.2,expected.status.single.brackets.3,expected.status.single.brackets.4,expected.status.single.brackets.5,expected.status.single.extraAllowance,expected.status.single.ltcgBrackets.0,expected.status.single.ltcgBrackets.1,expected.status.single.standardDeduction,expected.tax,expected.taxSpread,expected.totalTax,expected.value,expected.year,todo,note

```



Explicit source-disagreement TODO rows: 20. The $0.01-above-senior-phaseout boundary remains a passing case: its missing second reduction is $0.0006, within the $0.005 comparison tolerance.


## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,arg.0,arg.0.ages65plus,arg.0.filingStatus,arg.0.otherOrdinary,arg.0.qualifiedIncome,arg.1,arg.1.inflation,arg.2,arg.2.ages65plus,arg.3,params.inflation,params.taxYear,params.today,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.accounts.2.balance,plan.accounts.2.id,plan.accounts.2.name,plan.accounts.2.ownerId,plan.accounts.2.type,plan.accounts.3.balance,plan.accounts.3.id,plan.accounts.3.name,plan.accounts.3.ownerId,plan.accounts.3.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.filingStatus,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.dividendYield,plan.retirement.gainShare,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.taxMode,plan.retirement.taxRate,plan.retirement.withdrawalOrder.0,plan.retirement.withdrawalOrder.1,plan.retirement.withdrawalOrder.2,expected.allFail,expected.best,expected.bracketRate,expected.bracketsOn,expected.current,expected.deduction.amount,expected.deduction.senior,expected.deduction.standard,expected.gainVsWorst,expected.niit,expected.options.0.best,expected.options.0.current,expected.options.0.endAfterTaxReal,expected.options.0.endBalanceReal,expected.options.0.endTaxRate,expected.options.0.failYear,expected.options.0.key,expected.options.0.order.0,expected.options.0.order.1,expected.options.0.order.2,expected.options.0.rmdReal,expected.options.0.success,expected.options.0.taxesReal,expected.options.1.best,expected.options.1.current,expected.options.1.endAfterTaxReal,expected.options.1.endBalanceReal,expected.options.1.endTaxRate,expected.options.1.failYear,expected.options.1.key,expected.options.1.order.0,expected.options.1.order.1,expected.options.1.order.2,expected.options.1.rmdReal,expected.options.1.success,expected.options.1.taxesReal,expected.options.2.best,expected.options.2.current,expected.options.2.endAfterTaxReal,expected.options.2.endBalanceReal,expected.options.2.endTaxRate,expected.options.2.failYear,expected.options.2.key,expected.options.2.order.0,expected.options.2.order.1,expected.options.2.order.2,expected.options.2.rmdReal,expected.options.2.success,expected.options.2.taxesReal,expected.options.3.best,expected.options.3.current,expected.options.3.endAfterTaxReal,expected.options.3.endBalanceReal,expected.options.3.endTaxRate,expected.options.3.failYear,expected.options.3.key,expected.options.3.order.0,expected.options.3.order.1,expected.options.3.order.2,expected.options.3.rmdReal,expected.options.3.success,expected.options.3.taxesReal,expected.options.length,expected.ready,expected.roomInBracket,expected.status.head_of_household.brackets.0,expected.status.head_of_household.brackets.1,expected.status.head_of_household.brackets.2,expected.status.head_of_household.brackets.3,expected.status.head_of_household.brackets.4,expected.status.head_of_household.brackets.5,expected.status.head_of_household.extraAllowance,expected.status.head_of_household.ltcgBrackets.0,expected.status.head_of_household.ltcgBrackets.1,expected.status.head_of_household.standardDeduction,expected.status.married_joint.brackets.0,expected.status.married_joint.brackets.1,expected.status.married_joint.brackets.2,expected.status.married_joint.brackets.3,expected.status.married_joint.brackets.4,expected.status.married_joint.brackets.5,expected.status.married_joint.extraAllowance,expected.status.married_joint.ltcgBrackets.0,expected.status.married_joint.ltcgBrackets.1,expected.status.married_joint.standardDeduction,expected.status.married_separate.brackets.0,expected.status.married_separate.brackets.1,expected.status.married_separate.brackets.2,expected.status.married_separate.brackets.3,expected.status.married_separate.brackets.4,expected.status.married_separate.brackets.5,expected.status.married_separate.extraAllowance,expected.status.married_separate.ltcgBrackets.0,expected.status.married_separate.ltcgBrackets.1,expected.status.married_separate.standardDeduction,expected.status.qualifying_surviving.brackets.0,expected.status.qualifying_surviving.brackets.1,expected.status.qualifying_surviving.brackets.2,expected.status.qualifying_surviving.brackets.3,expected.status.qualifying_surviving.brackets.4,expected.status.qualifying_surviving.brackets.5,expected.status.qualifying_surviving.extraAllowance,expected.status.qualifying_surviving.ltcgBrackets.0,expected.status.qualifying_surviving.ltcgBrackets.1,expected.status.qualifying_surviving.standardDeduction,expected.status.single.brackets.0,expected.status.single.brackets.1,expected.status.single.brackets.2,expected.status.single.brackets.3,expected.status.single.brackets.4,expected.status.single.brackets.5,expected.status.single.extraAllowance,expected.status.single.ltcgBrackets.0,expected.status.single.ltcgBrackets.1,expected.status.single.standardDeduction,expected.tax,expected.taxSpread,expected.totalTax,expected.value,expected.year,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| ordinary | 60 | 30 | 10 | 10 | 0 |
| qualified | 60 | 30 | 10 | 10 | 0 |
| social | 60 | 30 | 10 | 10 | 0 |
| standard | 60 | 30 | 10 | 10 | 0 |
| senior | 60 | 30 | 10 | 10 | 11 |
| indexing | 60 | 30 | 10 | 10 | 9 |
| niit | 60 | 30 | 10 | 10 | 0 |
| normalization | 60 | 30 | 10 | 10 | 0 |
| grossup | 60 | 30 | 10 | 10 | 0 |
| rmd | 60 | 30 | 10 | 10 | 0 |
| totals | 60 | 30 | 10 | 10 | 0 |
| estate | 60 | 30 | 10 | 10 | 0 |
| ranking | 60 | 30 | 10 | 10 | 0 |
| selection | 60 | 30 | 10 | 10 | 0 |
