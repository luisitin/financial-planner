# Longevity worker brief and answer-key specification

## Read-before-generate rule inventory

The lead read `compute.js`, this page's original README and its only import,
`ageOn` from `core/math/dates.js`. No production code may be run, imported,
translated or copied to obtain an expected value. The Python oracle uses algebra
derived from these rules, then the separate JavaScript runner replays the CSV.

Original README quotation: "A Gompertz mortality law S(t | x) =
exp(-e^((x-m)/b) (e^((t-x)/b) - 1))"; "men m = 84, b = 10.5; women
m = 88, b = 9.5; unsaid m = 86, b = 10." "Better" health shifts m by
+3 years, "worse" by -4. "Life expectancy = the sum of the survival
curve. Couple: 1 - (1 - S_a)(1 - S_b), on the first person's age clock."
These are **application modeling assumptions**, not a table reproduced from SSA.
SSA's [period life table](https://www.ssa.gov/oact/STATS/table4c6.html) defines
remaining life expectancy; the current linked page contains 2023 observations,
not the 2021 fit mentioned in the old README. No SSA table value was substituted.

| CSV rule | Complete formula or behavior | Source and rounding |
|---|---|---|
| `survival` | For future age t, cumulative hazard H(t)=exp((t-m)/b); S=exp(H(x)-H(t)). A reached age t<=x has probability one. Missing or unrecognized sex uses (86,10); missing or unrecognized health adds zero. | README quotation above. Unknown-option handling is an explicit app interface assumption. Six decimal probability. |
| `inverse-survival` | Solve t=m+b ln(exp((x-m)/b)-ln(p)); first whole age is ceil(t), never below current age. For p>=1 current age qualifies. Default page p=.1. | Algebraic inversion of the quoted survival law. Integer result. The original README was silent on endpoint inclusivity; at-or-below is the named helper's interface. |
| `life-expectancy-sum` | Remaining years = sum of S(x,x+j+.5) for integer j>=0 with x+j<120. Page expected age = current age + remaining years. | README says "sum" but gives no quadrature: midpoint unit rectangles through age120 are a separately disclosed numerical compatibility contract, not a mortality-source claim. Six decimals. |
| `birthday-aware-page` | Whole calendar years subtract one before the birthday. A February29 birthday is reached on March1 in nonleap years. No today means no computed age. | `ageOn` interface; worked Gregorian calendar examples. No source claims an IRS/SSA age convention for this general calendar function. |
| `couple-probability-clock` | At calendar offset y, union probability = S_a+S_b-S_a*S_b. Label ages on first adult's clock. Joint plan age is the first integer offset where union<=.1. Plan year is today's calendar year plus that offset. | README's couple quotation; independence is the model assumption implicit in its product. Six decimal probabilities, integer ages/years. |
| `page-defaults-omissions` | Exclude dependents and missing birth dates. Use first two adults for joint result. Person's plan end overrides plan assumption, otherwise95. No dated adult means hasData=false and empty suggestion; undated included adults retain null age/expectancy/planTo and empty age list. | App input/output assumptions (README is silent); invented worked examples in CSV. Name/sex/health and generated suggestion text are exact. |
| `individual-age120-tail` | Mathematical survival continues after120; the unbounded *same midpoint sum* is evaluated to200, with its negligible tail checked below. Compare with the current hard stop. | Quoted Gompertz law has no finite maximum age. This is an explicit discrepancy test, not a replacement of midpoint integration. |
| `couple-70year-cap` | Find the union-probability crossing without an arbitrary70-year limit. | Quoted joint-probability rule has no calendar-horizon limit. Rows whose crossing exceeds70 carry a specific TODO. |

No dollar values occur on this page. Probabilities and decimal years are stored
to six places; comparisons should allow only half a final decimal plus floating
point noise. Integer ages, strings, booleans, nulls and omitted/empty lists are exact.
Input dates use YYYY-MM-DD, and input p uses six decimal places.

## Volume and independent second derivation

`tools/golden_retirement/longevity.py` generates **800 rows**: each of the eight
rules has exactly60 grid,30 edge and10 extreme cases. There are2026 and2056
dates, singles/couples/dependents, missing inputs, option defaults, birthdays,
leap days, age0/120 boundaries, small probabilities, and long horizons.

Every tenth row (80 rows) is re-derived and asserted before writing. A survival
check uses initial hazard times expm1(elapsed/b), independent of the primary
hazard-difference expression. An inverse check tests the defining inequality at
the answer and previous integer. A duration check uses summation by parts:

`sum(s[j],j=0..n-1) = n*s[n-1] + sum((j+1)*(s[j]-s[j+1]),j=0..n-2)`.

Page checks additionally encode birthday order as100*month+day, and use the
complement-product form of joint probability against the primary inclusion-
exclusion expression. Actual successful checks are recorded in each selected
row's `note`; failures abort generation. For the unbounded duration tests,
the age200 endpoint leaves S(200) effectively zero at stored precision for the
allowed fit parameters. Since H grows and hazard H/b increases, the integral
tail is bounded by `S(200)*b/H(200)`; the discrete tail is also bounded by a
geometric sum with first term S(200.5) and ratio exp(-H(200.5)*(exp(1/b)-1)).
Both bounds are below0.0000005 throughout this invented grid.

## Explicit disagreements retained

75 rows are marked TODO before production replay:15 inverse ages stopped at120,
27 omitted life-expectancy tails, and33 joint crossings stopped at70 calendar
years. The other contract rows intentionally retain the existing numeric cutoff
where the brief requires compatibility. TODO reasons identify exactly which
expectation is testing the uncapped mathematical rule.

Examples are generated arithmetic, not hand-entered output from the application:

- At age119, unsaid sex/better health, survival to120 remains above10%; algebra gives the
  first at-or-below10% age121. Current inverse search cannot return121.
- At current age120, a positive midpoint survival to120.5 implies positive
  remaining life; a loop that ends at120 returns zero.
- A couple aged18 and13, male/better and female/average respectively, still has
  joint survival0.702748869 after70 years. Their crossing is84 years ahead,
  first adult age102 in2110; the hard stop would report age88 in2096.

## Fixed layout

Targets are `compute(plan,params)`, `survival(arg.0,arg.1,arg.2)`,
`ageAtSurvival(arg.0,arg.1,arg.2)` and `lifeExpectancy(arg.0,arg.1)`.
Scalar expectations use `expected.value`. Dot-separated integer components
are array indexes. Blank is omitted; `@null` is explicit null;
`@empty-array` is an empty list. The exact generated header follows.

```csv
case_id,rule,kind,target,arg.0,arg.1,arg.1.health,arg.1.sex,arg.2.health,arg.2.sex,params.today,plan.assumptions.planEndAge,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.name,plan.household.people.1.role,plan.household.people.2.birthDate,plan.household.people.2.id,plan.household.people.2.name,plan.household.people.2.role,plan.retirement.longevity.a.health,plan.retirement.longevity.a.sex,plan.retirement.longevity.b.health,plan.retirement.longevity.b.sex,expected.either,expected.either.ages.0.age,expected.either.ages.0.p,expected.either.ages.1.age,expected.either.ages.1.p,expected.either.ages.2.age,expected.either.ages.2.p,expected.either.ages.3.age,expected.either.ages.3.p,expected.either.ages.4.age,expected.either.ages.4.p,expected.either.first,expected.either.planTo,expected.either.planToYear,expected.either.second,expected.hasData,expected.people,expected.people.0.age,expected.people.0.ages,expected.people.0.ages.0.age,expected.people.0.ages.0.p,expected.people.0.ages.1.age,expected.people.0.ages.1.p,expected.people.0.ages.2.age,expected.people.0.ages.2.p,expected.people.0.ages.3.age,expected.people.0.ages.3.p,expected.people.0.ages.4.age,expected.people.0.ages.4.p,expected.people.0.currentPlanEnd,expected.people.0.expectancy,expected.people.0.health,expected.people.0.id,expected.people.0.name,expected.people.0.planTo,expected.people.0.sex,expected.people.1.age,expected.people.1.ages,expected.people.1.ages.0.age,expected.people.1.ages.0.p,expected.people.1.ages.1.age,expected.people.1.ages.1.p,expected.people.1.ages.2.age,expected.people.1.ages.2.p,expected.people.1.ages.3.age,expected.people.1.ages.3.p,expected.people.1.ages.4.age,expected.people.1.ages.4.p,expected.people.1.currentPlanEnd,expected.people.1.expectancy,expected.people.1.health,expected.people.1.id,expected.people.1.name,expected.people.1.planTo,expected.people.1.sex,expected.suggestion,expected.value,todo,note
```

## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,arg.0,arg.1,arg.1.health,arg.1.sex,arg.2.health,arg.2.sex,params.today,plan.assumptions.planEndAge,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.lifeExpectancy,plan.household.people.0.name,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.name,plan.household.people.1.role,plan.household.people.2.birthDate,plan.household.people.2.id,plan.household.people.2.name,plan.household.people.2.role,plan.retirement.longevity.a.health,plan.retirement.longevity.a.sex,plan.retirement.longevity.b.health,plan.retirement.longevity.b.sex,expected.either,expected.either.ages.0.age,expected.either.ages.0.p,expected.either.ages.1.age,expected.either.ages.1.p,expected.either.ages.2.age,expected.either.ages.2.p,expected.either.ages.3.age,expected.either.ages.3.p,expected.either.ages.4.age,expected.either.ages.4.p,expected.either.first,expected.either.planTo,expected.either.planToYear,expected.either.second,expected.hasData,expected.people,expected.people.0.age,expected.people.0.ages,expected.people.0.ages.0.age,expected.people.0.ages.0.p,expected.people.0.ages.1.age,expected.people.0.ages.1.p,expected.people.0.ages.2.age,expected.people.0.ages.2.p,expected.people.0.ages.3.age,expected.people.0.ages.3.p,expected.people.0.ages.4.age,expected.people.0.ages.4.p,expected.people.0.currentPlanEnd,expected.people.0.expectancy,expected.people.0.health,expected.people.0.id,expected.people.0.name,expected.people.0.planTo,expected.people.0.sex,expected.people.1.age,expected.people.1.ages,expected.people.1.ages.0.age,expected.people.1.ages.0.p,expected.people.1.ages.1.age,expected.people.1.ages.1.p,expected.people.1.ages.2.age,expected.people.1.ages.2.p,expected.people.1.ages.3.age,expected.people.1.ages.3.p,expected.people.1.ages.4.age,expected.people.1.ages.4.p,expected.people.1.currentPlanEnd,expected.people.1.expectancy,expected.people.1.health,expected.people.1.id,expected.people.1.name,expected.people.1.planTo,expected.people.1.sex,expected.suggestion,expected.value,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| survival | 60 | 30 | 10 | 10 | 0 |
| inverse-survival | 60 | 30 | 10 | 10 | 15 |
| life-expectancy-sum | 60 | 30 | 10 | 10 | 0 |
| birthday-aware-page | 60 | 30 | 10 | 10 | 0 |
| couple-probability-clock | 60 | 30 | 10 | 10 | 0 |
| page-defaults-omissions | 60 | 30 | 10 | 10 | 0 |
| individual-age120-tail | 60 | 30 | 10 | 10 | 27 |
| couple-70year-cap | 60 | 30 | 10 | 10 | 33 |
