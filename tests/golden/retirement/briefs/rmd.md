# Required withdrawals worker brief

README: "IRS Publication 590-B Table III (Uniform Lifetime Table, in effect from 2022); start age 73 for people born 1951-1959, 75 from 1960 (SECURE 2.0), 72 before. Required amount = prior year-end pre-tax balance / factor for the age reached that year."

Rules separately: full Table III factors ages 72..120 plus bounds; start age birth cohorts;
balance/factor amount; per-person start year/years-until; page schedule/real totals and taxes;
ownership and first amount (each adult owns their account, not a household RMD); exclusions and empty data.
Read Pub 590-B for older cohorts (70.5 before July 1949; 72 after, before 1951) and spouse more than ten
years younger / sole beneficiary exception. Inputs do not model beneficiary status, so don't invent it.
Account type alone does not make life-insurance cash value subject to IRA RMDs; include a documented
statutory disagreement. Primary source data must not be copied from core/math/rmd.js.
Negative balance primitive is algebra, invalid retirement account balance is named in note.
Rounding: full division then cents; factor one decimal rendered six places by CSV rate convention.
Layout: common contract, primitive rmd helpers and complete-page compute rows.

## Completed independent oracle

The generator `tools/golden_retirement/rmd.py` uses Python Decimal for the primary
withdrawal ledger and exact Fraction retained-balance products for every tenth
schedule/real/tax/totals row. It never imports or executes application code.
All eleven separately named rules have100 cases:60 grid,30 edge,10 extreme (1100 total).

Additional rules from source where the README is incomplete:
- IRS Pub590-B IRA Owners distinguishes70.5 before July1,1949,72 through1950,
  and73 beginning1951. SECURE2.0 sec107 supplies75 for1960+. Older first distribution
  years depend on birth month. Current-year age remains the page's calendar-year age.
- The page's29-row display is72..100 inclusive; the IRS table continues through120+.
  Fractional helper ages use completed age; under72=Infinity is the helper convention,
  not a claim that historical IRA owners had no required distributions before72.
- Each person owns their own accounts. Pub590-B requires owner/account calculation;
  summing amounts is allowed for an owner's IRAs, not pooling spouses' ownership.
- Ordinary cash-value life insurance is not an IRA. IRS retirement-plan-investments-faqs
  and IRC408(a)(3) support the explicit insurance-exclusion disagreement.
- No beneficiary data exists in these inputs: TableII's spouse>10years younger and sole
  beneficiary exception is not silently inferred. Inherited IRA rules are out of scope.

Schedule fixture: invented $12 annual spending is paid by a large cash balance; no
contributions or income. RMD B/f is removed before return g: Bnext=(B-B/f)(1+g).
Price level=(1+inflation)^elapsedYears; rmdReal=rmd/price; taxes=rmd*flatRate;
totalRmdReal=sum(real RMD), totalTaxReal=sum(taxes/price). RMD schedule filters
strictly positive amounts. FirstRmd isnull when its first calendar year is absent
from the projection. Monetary outputs round half-up only at final serialization
to cents; factors, rates, and startAge use six decimals.

Known disagreements are explicit CSV TODOs: older70.5 cohorts; repeated household
balances/withdrawals on each adult; ordinary life insurance included as deferred.

Exact CSV header:

```csv
case_id,rule,kind,target,arg.0,arg.1,params.today,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.accounts.2.balance,plan.accounts.2.id,plan.accounts.2.name,plan.accounts.2.ownerId,plan.accounts.2.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.taxMode,plan.retirement.taxRate,expected.deferredAccounts.length,expected.deferredNow,expected.hasDeferred,expected.people.0.age,expected.people.0.birthYear,expected.people.0.deferredNow,expected.people.0.firstRmd,expected.people.0.firstRmdReal,expected.people.0.startAge,expected.people.0.startYear,expected.people.0.yearsUntil,expected.people.1.deferredNow,expected.people.1.firstRmd,expected.people.1.firstRmdReal,expected.people.length,expected.ready,expected.schedule.0.age,expected.schedule.0.deferredEnd,expected.schedule.0.factor,expected.schedule.0.rmd,expected.schedule.0.rmdReal,expected.schedule.0.taxes,expected.schedule.0.year,expected.schedule.1.age,expected.schedule.1.deferredEnd,expected.schedule.1.factor,expected.schedule.1.rmd,expected.schedule.1.rmdReal,expected.schedule.1.taxes,expected.schedule.1.year,expected.schedule.2.age,expected.schedule.2.deferredEnd,expected.schedule.2.factor,expected.schedule.2.rmd,expected.schedule.2.rmdReal,expected.schedule.2.taxes,expected.schedule.2.year,expected.schedule.29.age,expected.schedule.29.deferredEnd,expected.schedule.29.factor,expected.schedule.29.rmd,expected.schedule.29.rmdReal,expected.schedule.29.taxes,expected.schedule.29.year,expected.schedule.3.age,expected.schedule.3.deferredEnd,expected.schedule.3.factor,expected.schedule.3.rmd,expected.schedule.3.rmdReal,expected.schedule.3.taxes,expected.schedule.3.year,expected.schedule.4.age,expected.schedule.4.deferredEnd,expected.schedule.4.factor,expected.schedule.4.rmd,expected.schedule.4.rmdReal,expected.schedule.4.taxes,expected.schedule.4.year,expected.schedule.59.age,expected.schedule.59.deferredEnd,expected.schedule.59.factor,expected.schedule.59.rmd,expected.schedule.59.rmdReal,expected.schedule.59.taxes,expected.schedule.59.year,expected.schedule.9.age,expected.schedule.9.deferredEnd,expected.schedule.9.factor,expected.schedule.9.rmd,expected.schedule.9.rmdReal,expected.schedule.9.taxes,expected.schedule.9.year,expected.schedule.99.age,expected.schedule.99.deferredEnd,expected.schedule.99.factor,expected.schedule.99.rmd,expected.schedule.99.rmdReal,expected.schedule.99.taxes,expected.schedule.99.year,expected.schedule.length,expected.table.0.age,expected.table.0.factor,expected.table.1.age,expected.table.1.factor,expected.table.10.age,expected.table.10.factor,expected.table.11.age,expected.table.11.factor,expected.table.12.age,expected.table.12.factor,expected.table.13.age,expected.table.13.factor,expected.table.14.age,expected.table.14.factor,expected.table.15.age,expected.table.15.factor,expected.table.16.age,expected.table.16.factor,expected.table.17.age,expected.table.17.factor,expected.table.18.age,expected.table.18.factor,expected.table.19.age,expected.table.19.factor,expected.table.2.age,expected.table.2.factor,expected.table.20.age,expected.table.20.factor,expected.table.21.age,expected.table.21.factor,expected.table.22.age,expected.table.22.factor,expected.table.23.age,expected.table.23.factor,expected.table.24.age,expected.table.24.factor,expected.table.25.age,expected.table.25.factor,expected.table.26.age,expected.table.26.factor,expected.table.27.age,expected.table.27.factor,expected.table.28.age,expected.table.28.factor,expected.table.3.age,expected.table.3.factor,expected.table.4.age,expected.table.4.factor,expected.table.5.age,expected.table.5.factor,expected.table.6.age,expected.table.6.factor,expected.table.7.age,expected.table.7.factor,expected.table.8.age,expected.table.8.factor,expected.table.9.age,expected.table.9.factor,expected.table.length,expected.taxRate,expected.totalRmdReal,expected.totalTaxReal,expected.value,todo,note
```

## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,arg.0,arg.1,params.today,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.accounts.2.balance,plan.accounts.2.id,plan.accounts.2.name,plan.accounts.2.ownerId,plan.accounts.2.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.taxMode,plan.retirement.taxRate,expected.deferredAccounts.length,expected.deferredNow,expected.hasDeferred,expected.people.0.age,expected.people.0.birthYear,expected.people.0.deferredNow,expected.people.0.firstRmd,expected.people.0.firstRmdReal,expected.people.0.startAge,expected.people.0.startYear,expected.people.0.yearsUntil,expected.people.1.deferredNow,expected.people.1.firstRmd,expected.people.1.firstRmdReal,expected.people.length,expected.ready,expected.schedule.0.age,expected.schedule.0.deferredEnd,expected.schedule.0.factor,expected.schedule.0.rmd,expected.schedule.0.rmdReal,expected.schedule.0.taxes,expected.schedule.0.year,expected.schedule.1.age,expected.schedule.1.deferredEnd,expected.schedule.1.factor,expected.schedule.1.rmd,expected.schedule.1.rmdReal,expected.schedule.1.taxes,expected.schedule.1.year,expected.schedule.2.age,expected.schedule.2.deferredEnd,expected.schedule.2.factor,expected.schedule.2.rmd,expected.schedule.2.rmdReal,expected.schedule.2.taxes,expected.schedule.2.year,expected.schedule.29.age,expected.schedule.29.deferredEnd,expected.schedule.29.factor,expected.schedule.29.rmd,expected.schedule.29.rmdReal,expected.schedule.29.taxes,expected.schedule.29.year,expected.schedule.3.age,expected.schedule.3.deferredEnd,expected.schedule.3.factor,expected.schedule.3.rmd,expected.schedule.3.rmdReal,expected.schedule.3.taxes,expected.schedule.3.year,expected.schedule.4.age,expected.schedule.4.deferredEnd,expected.schedule.4.factor,expected.schedule.4.rmd,expected.schedule.4.rmdReal,expected.schedule.4.taxes,expected.schedule.4.year,expected.schedule.59.age,expected.schedule.59.deferredEnd,expected.schedule.59.factor,expected.schedule.59.rmd,expected.schedule.59.rmdReal,expected.schedule.59.taxes,expected.schedule.59.year,expected.schedule.9.age,expected.schedule.9.deferredEnd,expected.schedule.9.factor,expected.schedule.9.rmd,expected.schedule.9.rmdReal,expected.schedule.9.taxes,expected.schedule.9.year,expected.schedule.99.age,expected.schedule.99.deferredEnd,expected.schedule.99.factor,expected.schedule.99.rmd,expected.schedule.99.rmdReal,expected.schedule.99.taxes,expected.schedule.99.year,expected.schedule.length,expected.table.0.age,expected.table.0.factor,expected.table.1.age,expected.table.1.factor,expected.table.10.age,expected.table.10.factor,expected.table.11.age,expected.table.11.factor,expected.table.12.age,expected.table.12.factor,expected.table.13.age,expected.table.13.factor,expected.table.14.age,expected.table.14.factor,expected.table.15.age,expected.table.15.factor,expected.table.16.age,expected.table.16.factor,expected.table.17.age,expected.table.17.factor,expected.table.18.age,expected.table.18.factor,expected.table.19.age,expected.table.19.factor,expected.table.2.age,expected.table.2.factor,expected.table.20.age,expected.table.20.factor,expected.table.21.age,expected.table.21.factor,expected.table.22.age,expected.table.22.factor,expected.table.23.age,expected.table.23.factor,expected.table.24.age,expected.table.24.factor,expected.table.25.age,expected.table.25.factor,expected.table.26.age,expected.table.26.factor,expected.table.27.age,expected.table.27.factor,expected.table.28.age,expected.table.28.factor,expected.table.3.age,expected.table.3.factor,expected.table.4.age,expected.table.4.factor,expected.table.5.age,expected.table.5.factor,expected.table.6.age,expected.table.6.factor,expected.table.7.age,expected.table.7.factor,expected.table.8.age,expected.table.8.factor,expected.table.9.age,expected.table.9.factor,expected.table.length,expected.taxRate,expected.totalRmdReal,expected.totalTaxReal,expected.value,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| factor | 60 | 30 | 10 | 10 | 0 |
| cohort | 60 | 30 | 10 | 10 | 0 |
| amount | 60 | 30 | 10 | 10 | 0 |
| calendar | 60 | 30 | 10 | 10 | 0 |
| schedule | 60 | 30 | 10 | 10 | 0 |
| real | 60 | 30 | 10 | 10 | 0 |
| tax | 60 | 30 | 10 | 10 | 0 |
| totals | 60 | 30 | 10 | 10 | 0 |
| ownership | 60 | 30 | 10 | 10 | 0 |
| exclusions | 60 | 30 | 10 | 10 | 0 |
| page_table | 60 | 30 | 10 | 10 | 0 |
