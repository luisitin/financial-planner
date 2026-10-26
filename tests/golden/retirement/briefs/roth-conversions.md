# Roth conversion worker brief



README: "in each retirement year before the required-withdrawal age (and the until-age), once

the year's spending withdrawals are settled, convert pre-tax money to Roth until taxable income

sits at the top of the chosen bracket (roomUnder, then trimmed or topped up so the tax on the

conversion itself, when it has to come from pre-tax money, is included)". "Conversions are

skipped in a year they would make the plan fail." "Options are ranked by endAfterTaxReal."

"IRMAA first tier 2026: 109,000 single / 218,000 joint, indexed with the plan's inflation."



Rules separately: room/bracket top; eligibility and until-age exclusion; conversion tax from

available buckets including pretax gross-up; insufficient funds rollback; comparison five options

and chosen/best; converted/taxes/RMD real totals; table/income-before/span; IRMAA age 63 lookback,

strict crossing and filing status (qualifying surviving uses the single tier per SSA POMS HI01101.031); readiness.

Use algebra/root-solving of taxable-income target (independent bisection with tight convergence),

not the production fixed-iteration algorithm. Conversion cents rounding only at output. Use sources

in withdrawal-order plus CMS 2026 Parts A & B premiums/deductibles for IRMAA; index future as an

explicit hypothetical assumption. IRA conversions included in gross income per Pub 590-A/B.

Layout common compute and tax/engine helpers, fixed union flattened columns. Tax primitive coverage

may reference withdrawal-order but each conversion-specific rule still needs 100 cases.



## Completed independent oracle



10 rules ×100 rows=1,000 cases; each has60 grid/30 edge/10 extreme. Tax tables and

roots are independently calculated in tax_oracle.py. Room capacity is the cent-rounded

exact largest extra income, not the production four-step/dollar-round approximation.

Positive-cent conversions have no source-based1-dollar minimum; skipped small amounts

are explicit TODOs. Exhausted-account roots snap to the exact balance to avoid numerical dust.

Every tenth row has alternative formula, inverse-root, or conservation checks.

Tax helper parameters use params.taxYear/params.inflation injected only by replay.



IRMAA: SSA POMS HI01101.031 explicitly puts surviving spouse with dependent child

in the single tier109000, not the joint tier218000. The original brief was corrected

after primary-source verification. Strict greater-than means no surcharge at equality.

Ages63+ reflect the two-year lookback; future indexing follows the stated model.

The span counts years eligible to convert even when the balance is exhausted; table

only counts positive conversions. Money rounds to cents only at final output and

annual federal tax; rates six decimals.



Exact header:

```csv

case_id,rule,kind,target,arg.0,arg.0.ages65plus,arg.0.filingStatus,arg.0.otherOrdinary,arg.1,arg.2,params.inflation,params.taxYear,params.today,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.filingStatus,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.dividendYield,plan.retirement.gainShare,plan.retirement.pensions.0.cola,plan.retirement.pensions.0.monthly,plan.retirement.pensions.0.personId,plan.retirement.pensions.0.startAge,plan.retirement.rothConversion.fillRate,plan.retirement.rothConversion.on,plan.retirement.rothConversion.untilAge,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.taxMode,plan.retirement.taxRate,expected.best,expected.bracketsOn,expected.deferredNow,expected.fillRate,expected.on,expected.options.0.best,expected.options.0.chosen,expected.options.0.endAfterTaxReal,expected.options.0.endBalanceReal,expected.options.0.failYear,expected.options.0.fillRate,expected.options.0.rmdReal,expected.options.0.success,expected.options.0.taxesReal,expected.options.0.totalConvertedReal,expected.options.1.best,expected.options.1.chosen,expected.options.1.endAfterTaxReal,expected.options.1.endBalanceReal,expected.options.1.failYear,expected.options.1.fillRate,expected.options.1.rmdReal,expected.options.1.success,expected.options.1.taxesReal,expected.options.1.totalConvertedReal,expected.options.2.best,expected.options.2.chosen,expected.options.2.endAfterTaxReal,expected.options.2.endBalanceReal,expected.options.2.failYear,expected.options.2.fillRate,expected.options.2.rmdReal,expected.options.2.success,expected.options.2.taxesReal,expected.options.2.totalConvertedReal,expected.options.3.best,expected.options.3.chosen,expected.options.3.endAfterTaxReal,expected.options.3.endBalanceReal,expected.options.3.failYear,expected.options.3.fillRate,expected.options.3.rmdReal,expected.options.3.success,expected.options.3.taxesReal,expected.options.3.totalConvertedReal,expected.options.4.best,expected.options.4.chosen,expected.options.4.endAfterTaxReal,expected.options.4.endBalanceReal,expected.options.4.failYear,expected.options.4.fillRate,expected.options.4.rmdReal,expected.options.4.success,expected.options.4.taxesReal,expected.options.4.totalConvertedReal,expected.options.length,expected.ready,expected.rmdStartAge,expected.shown,expected.span,expected.span.from,expected.span.to,expected.span.years,expected.table.0.bracketTop,expected.table.0.conversion,expected.table.0.conversionReal,expected.table.0.incomeBefore,expected.table.0.irmaa,expected.table.0.taxableIncome,expected.table.0.taxes,expected.table.0.year,expected.table.1.bracketTop,expected.table.1.conversion,expected.table.1.conversionReal,expected.table.1.incomeBefore,expected.table.1.irmaa,expected.table.1.taxableIncome,expected.table.1.taxes,expected.table.1.year,expected.table.length,expected.untilAge,expected.value,todo,note

```


## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,arg.0,arg.0.ages65plus,arg.0.filingStatus,arg.0.otherOrdinary,arg.1,arg.2,params.inflation,params.taxYear,params.today,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.filingStatus,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.dividendYield,plan.retirement.gainShare,plan.retirement.pensions.0.cola,plan.retirement.pensions.0.monthly,plan.retirement.pensions.0.personId,plan.retirement.pensions.0.startAge,plan.retirement.rothConversion.fillRate,plan.retirement.rothConversion.on,plan.retirement.rothConversion.untilAge,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.taxMode,plan.retirement.taxRate,expected.best,expected.bracketsOn,expected.deferredNow,expected.fillRate,expected.on,expected.options.0.best,expected.options.0.chosen,expected.options.0.endAfterTaxReal,expected.options.0.endBalanceReal,expected.options.0.failYear,expected.options.0.fillRate,expected.options.0.rmdReal,expected.options.0.success,expected.options.0.taxesReal,expected.options.0.totalConvertedReal,expected.options.1.best,expected.options.1.chosen,expected.options.1.endAfterTaxReal,expected.options.1.endBalanceReal,expected.options.1.failYear,expected.options.1.fillRate,expected.options.1.rmdReal,expected.options.1.success,expected.options.1.taxesReal,expected.options.1.totalConvertedReal,expected.options.2.best,expected.options.2.chosen,expected.options.2.endAfterTaxReal,expected.options.2.endBalanceReal,expected.options.2.failYear,expected.options.2.fillRate,expected.options.2.rmdReal,expected.options.2.success,expected.options.2.taxesReal,expected.options.2.totalConvertedReal,expected.options.3.best,expected.options.3.chosen,expected.options.3.endAfterTaxReal,expected.options.3.endBalanceReal,expected.options.3.failYear,expected.options.3.fillRate,expected.options.3.rmdReal,expected.options.3.success,expected.options.3.taxesReal,expected.options.3.totalConvertedReal,expected.options.4.best,expected.options.4.chosen,expected.options.4.endAfterTaxReal,expected.options.4.endBalanceReal,expected.options.4.failYear,expected.options.4.fillRate,expected.options.4.rmdReal,expected.options.4.success,expected.options.4.taxesReal,expected.options.4.totalConvertedReal,expected.options.length,expected.ready,expected.rmdStartAge,expected.shown,expected.span,expected.span.from,expected.span.to,expected.span.years,expected.table.0.bracketTop,expected.table.0.conversion,expected.table.0.conversionReal,expected.table.0.incomeBefore,expected.table.0.irmaa,expected.table.0.taxableIncome,expected.table.0.taxes,expected.table.0.year,expected.table.1.bracketTop,expected.table.1.conversion,expected.table.1.conversionReal,expected.table.1.incomeBefore,expected.table.1.irmaa,expected.table.1.taxableIncome,expected.table.1.taxes,expected.table.1.year,expected.table.length,expected.untilAge,expected.value,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| bracket_top | 60 | 30 | 10 | 10 | 0 |
| room | 60 | 30 | 10 | 10 | 16 |
| eligibility | 60 | 30 | 10 | 10 | 11 |
| conversion_tax | 60 | 30 | 10 | 10 | 10 |
| insufficient | 60 | 30 | 10 | 10 | 0 |
| comparison | 60 | 30 | 10 | 10 | 10 |
| real_totals | 60 | 30 | 10 | 10 | 10 |
| table_span | 60 | 30 | 10 | 10 | 8 |
| irmaa | 60 | 30 | 10 | 10 | 0 |
| readiness | 60 | 30 | 10 | 10 | 9 |
