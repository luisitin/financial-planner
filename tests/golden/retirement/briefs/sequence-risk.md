# Sequence risk worker brief

README: "The working years keep their real order; the retirement years are sorted by the stock
return ascending (worst first) or descending (best first). Same set of years, same average,
different order." Average output is geometric stocks/bonds/inflation of retirement years.
Rules separately: tail-only sort and paired asset/inflation observations; geometric means;
actual/worst/best run summaries; steady assumptions; historical horizon guard and readiness.
Shared worstWindow and engine rules are referenced, not new approximations. Download primary
Damodaran data for expected historical results, do not import/copy repository history or engine.
Where no retirement years exist the mean is undefined: record null/NaN policy explicitly, never
turn missing information into zero. Cash returns travel with each historical observation.
Use independently computed permutations and product/geometric mean for every tenth row.
Layout common contract, compute target for historical behaviors, project for sequence arithmetic.

## Completed independent specification

`tools/golden_retirement/sequence_risk.py` writes 500 cases: five groups of
60 grid, 30 edge and 10 extreme rows. All cases call the page's real
`compute(plan,params)`. Expected values use this worker's independent
discounted-cash-flow oracle and directly sourced historical observations.
They never import the repository's engine or history data.

| Rule | Formulas, thresholds and behavior | Source |
|---|---|---|
| `tail-sort-paired` | Preserve the observations before the household retirement index. Sort the rest by stock return ascending/descending, with the complete stock/bond/cash/inflation tuple moving together. Compare all three actual runs, not only a sorting invariant. | Original README: "The working years keep their real order; the retirement years are sorted by the stock return ascending (worst first) or descending (best first). Same set of years, same average, different order." |
| `geometric-means` | For retirement tail length n, each average is `(product(1+r_i))^(1/n)-1`, separately for stocks, bonds and inflation. Empty tail has an undefined mean (`NaN`), not zero. | README's "Same set of years, same average" is silent about average type; the output API specifies geometric average. Formula is the compound growth identity. NaN is the explicitly retained empty-tail interface convention. |
| `run-summaries` | All three paths use fixed-real spending. Success means every beginning-year spending gap is covered; failAge is the first failed year. EndReal is final total divided by final price level. LowestReal is the least year-end real balance, including working years. | Projection README engine rules and this page Outputs. First failure at a shortfall exceeding half a cent is a disclosed numeric interface threshold. |
| `steady-assumptions` | Repeat the plan's constant stock/bond/cash/inflation assumptions with the same timing and spending, without substituting history. The price level is 1 in the first year and multiplies subsequent inflation factors. | Projection README and this page's steady output contract; values are invented planning assumptions, not a forecast. |
| `history-readiness` | Require a dated adult, at least one account and positive annual spending. Enumerate only complete historical windows and choose the worst by earliest failure then smallest final real balance. Horizon longer than 98 source years is explicitly not ready. | Shared `worstWindow` README contract; original missing-input messages are the app interface. Source file contains 98 observations, 1928 through 2025 inclusive. |

All group rows also carry the full expected means, all three run summaries and
the steady result wherever the page is ready. Coverage includes working years,
immediate retirement, no retired years, one year, the 98-year boundary, 99/120
years, singles/couples, 2026/2056 dates, tiny/large balances and zero allocation
to one asset class. Some paired-sort fixtures include a large separate cash
reserve: that exercises the independently sourced bill return traveling with
the stocks, bonds and CPI observation, rather than treating cash as a constant.
All dollar cells have cents; source rates and mean outputs have six decimals.

### Primary source and independently checked arithmetic

History is downloaded directly from
[Damodaran at NYU Stern](https://www.stern.nyu.edu/~adamodar/pc/datasets/histretSP.xls).
The frozen source CSV is `tests/golden/retirement/sources/damodaran-1928-2025.csv`.
It uses the labeled annual S&P 500 total return, 10-year Treasury and T.Bill
columns, plus the FRED CPI percent-change worksheet. Source rounding to six
decimal places is explicit, allowing the application and independent oracle
to share a precision contract without sharing executable code. Raw source
SHA-256: `28b8110916a15a4dcc11c87c6422510704608ddedcdfa67a1298abdc22e49c69`.
See `history_source.py` and the withdrawal-strategy brief for download details.

Every tenth row (50 rows) is checked independently before the CSV is written:
year identities prove the complete observations were preserved, log-space
geometric averages check the product expression, and discounted liabilities
check each variant's ending balance, minimum balance and failure against the
independent cash-balance recurrence. Worst-window selection is rederived over
all candidate windows with the discounted-liability method. A cash-reserve
case independently discounts its spending using bill-return factors while
the separate invested account compounds stock/bond factors. Assertions fail
generation if any check disagrees. Empty-tail means are deliberately NaN.

No discrepancy was predeclared for the sampled mathematical contracts on this
page; an unexpected disagreement must fail the runner rather than automatically
becoming TODO. The lead separately audits at least 2% of the complete answer key.

### Fixed CSV layout

One row is one flattened plan and `params.today`, with complete numerical output
paths under `expected.*`. Every target is `compute`. Blank means omitted,
`@null` means explicit null, `@empty-array` means an empty list, and `NaN` is an
undefined geometric mean. The exact generated header is appended below.

```csv
case_id,rule,kind,target,params.today,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.strategy,plan.retirement.taxRate,plan.retirement.withdrawalRate,expected.average.bonds,expected.average.inflation,expected.average.stocks,expected.missing.0,expected.ready,expected.retireYear,expected.runs.0.endReal,expected.runs.0.failAge,expected.runs.0.key,expected.runs.0.lowestReal,expected.runs.0.success,expected.runs.1.endReal,expected.runs.1.failAge,expected.runs.1.key,expected.runs.1.lowestReal,expected.runs.1.success,expected.runs.2.endReal,expected.runs.2.failAge,expected.runs.2.key,expected.runs.2.lowestReal,expected.runs.2.success,expected.spendingYearly,expected.startYear,expected.steady.endReal,expected.steady.failAge,expected.steady.lowestReal,expected.steady.success,expected.years,todo,note
```

## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,params.today,plan.accounts,plan.accounts.0.balance,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.ownerId,plan.accounts.0.type,plan.accounts.1.balance,plan.accounts.1.id,plan.accounts.1.name,plan.accounts.1.ownerId,plan.accounts.1.type,plan.assumptions.inflation,plan.assumptions.returnBonds,plan.assumptions.returnCash,plan.assumptions.returnStocks,plan.assumptions.salaryGrowth,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.retirementAge,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.lifeExpectancy,plan.household.people.1.name,plan.household.people.1.retirementAge,plan.household.people.1.role,plan.retirement.spendingMonthly,plan.retirement.stocksNow,plan.retirement.stocksRetired,plan.retirement.strategy,plan.retirement.taxRate,plan.retirement.withdrawalRate,expected.average.bonds,expected.average.inflation,expected.average.stocks,expected.missing.0,expected.ready,expected.retireYear,expected.runs.0.endReal,expected.runs.0.failAge,expected.runs.0.key,expected.runs.0.lowestReal,expected.runs.0.success,expected.runs.1.endReal,expected.runs.1.failAge,expected.runs.1.key,expected.runs.1.lowestReal,expected.runs.1.success,expected.runs.2.endReal,expected.runs.2.failAge,expected.runs.2.key,expected.runs.2.lowestReal,expected.runs.2.success,expected.spendingYearly,expected.startYear,expected.steady.endReal,expected.steady.failAge,expected.steady.lowestReal,expected.steady.success,expected.years,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| tail-sort-paired | 60 | 30 | 10 | 10 | 0 |
| geometric-means | 60 | 30 | 10 | 10 | 0 |
| run-summaries | 60 | 30 | 10 | 10 | 0 |
| steady-assumptions | 60 | 30 | 10 | 10 | 0 |
| history-readiness | 60 | 30 | 10 | 10 | 0 |
