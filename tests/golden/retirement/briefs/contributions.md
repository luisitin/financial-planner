# Contributions worker brief

README: "Yearly = amount x times per year (`core/math/periods.js`) + employer match."
"The age reached in the year is what counts. Employer money is outside these limits."
"2026: 401(k)/403(b) 24,500 (+8,000 from 50; 11,250 from 60 to 63), IRA 7,500 traditional and Roth together (+1,100 from 50), HSA 4,400 self-only (+1,000 from 55; 8,750 family). 2025 also listed."

Rules to cover separately: periods including once/unknown; own/match/total and per-person aggregation;
shared traditional/Roth IRA limit; 401k base/catch-up/super catch-up and endpoints;
HSA self/catch-up (employer HSA money counts under IRS Pub 969 despite README's blanket exclusion);
age reached (including December birthdays and leap dates); table year selection (latest known for future);
empty data/dependents/missing account and warning thresholds. Family HSA choice is explicitly a future
feature, so self-only is the modeled limit; do not assert nonexistent family selection behavior.
Use IRS Notices 2024-80/2025-67, Rev Procs 2024-25/2025-19, and Pub 969 for gaps, not the code.
Annualization 52,26,24,12,4,1,0 is a documented convention, not exact pay dates.
Rounding: no intermediate rounding; compare money at cents, age integers exactly.
Layout: common contract, `compute` and `perYear`; use fixed union of flattened columns.

## Complete worker inventory and oracle contract

`tools/golden_retirement/contributions.py` is an independent Decimal/rational oracle.
It imports only the common CSV serializer and Python standard-library arithmetic.
It neither imports nor executes application code. The application files were read
to identify input/output paths only. Each of the 22 rule groups has 100 rows:
60 grid, 30 edge, 10 extreme (2,200 rows altogether). The generator asserts those
counts and verifies every tenth row by a different calculation (220 checks).
An input-only duplicate audit (excluding case IDs, notes and expected results)
also enforces 100 distinct cases within every rule. Scalar annualization uses
distinct amounts; limit cases vary ages, amounts and calendar dates; empty cases
vary household composition and evaluation dates.

The original README statements quoted above govern annualization, output sums and
the age reached in the calendar year. The quoted sentence “Employer money is
outside these limits” conflicts with IRS Publication 969 for HSAs. Those 100 cases
retain the IRS result with a specific TODO; the production result is not used as
the answer key. The documented absence of family HSA selection is not a defect.
All examples assume full-year self-only HSA eligibility, enough compensation for
IRA contributions, and no income phaseout. Eligibility/phaseout rules are outside
this page's documented feature set.

| Rule group | Formula/rule and expected rounding | Provenance |
|---|---|---|
| period-weekly | own annual = amount × 52 | README “Yearly = amount x times per year”; application annualization convention, not exact pay dates |
| period-biweekly | amount × 26 | Same convention |
| period-semimonthly | amount × 24 | Same convention |
| period-monthly | amount × 12 | Same convention |
| period-quarterly | amount × 4 | Same convention |
| period-annual | amount × 1 | Same convention |
| period-once | recurring annual amount = 0 | `core/math/periods.js` documented API: one-off excluded from annual recurring totals |
| period-unknown | unknown period uses monthly convention × 12 | explicit application input fallback, recorded here as model assumption |
| own-match-total | yearly = Σ own; matchYearly = Σ annual employer; totalYearly = yearly + matchYearly; item totals follow the same identity | README yearly formula; invented worked amounts in each row |
| person-aggregation | each adult receives the sum of items carrying their ID; unassigned entries remain in the household sum | module output contract; conservation-of-money worked examples |
| ira-combined-limit | one combined traditional/Roth cap: 2025 7,000 (+1,000 at 50); 2026 7,500 (+1,100 at 50); used is their sum | IRS Notices 2024-80 and 2025-67, §219; README “traditional and Roth together” |
| 401k-base | elective cap below age 50: 2025 23,500; 2026 24,500 | Notices 2024-80 / 2025-67, §402(g) |
| 401k-catchup | age ≥50 outside 60–63: 2025 23,500+7,500=31,000; 2026 24,500+8,000=32,500 | Same notices, §414(v) |
| 401k-super-catchup | ages 60,61,62,63 replace ordinary catch-up with 11,250: total 34,750 / 35,750; age 59/64 use ordinary catch-up | Same notices, §414(v)(2)(E)(i) |
| hsa-self-catchup | self-only 2025 4,300; 2026 4,400; age ≥55 adds 1,000; family values 8,550 / 8,750 are documented constants but no family selector exists | Rev. Procs. 2024-25 / 2025-19; Publication 969 “Additional contribution” |
| hsa-employer-cap | used = employee + employer; excess = max(0, employee + employer − limit); allowed employee amount = limit − employer | Publication 969 “Employer contributions”; contradicts README blanket exclusion |
| age-reached | year of test − birth year; birthday need not have occurred; leap-day births count normally | README “The age reached in the year is what counts”; IRS year-end age rules |
| table-year | 2025→2025, 2026→2026; later years freeze the latest known 2026 limits | explicit planning assumption; no prediction of future law |
| empty-input | absent/empty entries mean empty items, zero totals, false hasData, no warnings; adults may still have zero summaries | module input/output contract and empty-sum identity |
| dependent-exclusion | dependent entries count in household sums but no dependent byPerson summary | application presentation contract, not an IRA eligibility assertion |
| missing-account-person | missing account retains entered sums, null accountType and one warning per dangling entry; missing person label is Household and no person assignment | application input/error contract |
| warning-threshold | excess = max(0, used − cap); warn strictly above; equality is allowed; zero net use suppresses empty limit; negative corrections reduce use | README over-limit purpose; independent remaining-room check in rows |

All money inputs and expected money are stored to the cent. Arithmetic is exact
Decimal with no intermediate rounding except splitting invented IRA examples into
two cent-denominated contributions; their sum is preserved. The runner tolerates
absolute money error ≤0.005. Ages/counts/years/booleans/labels compare exactly.
Dates are YYYY-MM-DD. Grid rows span 2025, 2026 and 2056, individual and two-adult
households; edges include zero, negatives, one cent either side of caps, ages
49/50, 54/55, 59/60/63/64, first/last days and leap birthdays. Extremes include
tiny cents and balances to 9,999,999,999.99. These are invented arithmetic examples,
not published balance data. For period helpers, family context and tax dates do
not affect the pure scalar conversion; full plans exercise that context separately.

The second derivation is recorded in every tenth note. Annualization uses repeated
rational addition instead of Decimal multiplication. Total checks regroup items
and remove employer/unassigned money. Limit checks use direct total-cap lookup
instead of adding catch-up, and compute remaining room instead of subtracting cap
from use. Age checks count intervening calendar years. Empty/reference checks use
set cardinality and conservation. No second check queries production code.

## Primary sources verified for this brief

- [IRS Notice 2025-67](https://www.irs.gov/pub/irs-drop/n-25-67.pdf), 2026 elective deferrals and catch-ups (pp.1–2), IRA amount/catch-up (p.4).
- [IRS Notice 2024-80](https://www.irs.gov/pub/irs-drop/n-24-80.pdf), corresponding 2025 amounts (pp.1–2,4).
- [IRS Rev. Proc. 2025-19](https://www.irs.gov/pub/irs-drop/rp-25-19.pdf), §2.01(1), 2026 self/family HSA limits.
- [IRS Rev. Proc. 2024-25](https://www.irs.gov/pub/irs-drop/rp-24-25.pdf), §2.01(1), 2025 self/family HSA limits.
- [IRS Publication 969](https://www.irs.gov/publications/p969), Additional contribution and Employer contributions. In particular, employer payments reduce the amount the individual can contribute.

## Fixed CSV header

The complete union header is reproduced below; blank means omitted, `@null` means
null, `@empty-array` means empty list. Helper calls use `arg.0`=amount and
`arg.1`=period with scalar `expected.value`; all other rows call page compute.

```csv
case_id,rule,kind,target,arg.0,arg.1,params.today,plan.accounts,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.type,plan.accounts.1.id,plan.accounts.1.type,plan.accounts.2.id,plan.accounts.2.type,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.name,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.name,plan.household.people.1.role,plan.retirement.contributions,plan.retirement.contributions.0.accountId,plan.retirement.contributions.0.amount,plan.retirement.contributions.0.employerMatch,plan.retirement.contributions.0.id,plan.retirement.contributions.0.period,plan.retirement.contributions.0.personId,plan.retirement.contributions.1.accountId,plan.retirement.contributions.1.amount,plan.retirement.contributions.1.employerMatch,plan.retirement.contributions.1.id,plan.retirement.contributions.1.period,plan.retirement.contributions.1.personId,plan.retirement.contributions.2.accountId,plan.retirement.contributions.2.amount,plan.retirement.contributions.2.employerMatch,plan.retirement.contributions.2.id,plan.retirement.contributions.2.period,plan.retirement.contributions.2.personId,expected.byPerson.0.age,expected.byPerson.0.limits,expected.byPerson.0.limits.0.catchUp,expected.byPerson.0.limits.0.kind,expected.byPerson.0.limits.0.limit,expected.byPerson.0.limits.0.over,expected.byPerson.0.limits.0.used,expected.byPerson.0.match,expected.byPerson.0.personId,expected.byPerson.0.yearly,expected.byPerson.1.limits,expected.byPerson.1.match,expected.byPerson.1.personId,expected.byPerson.1.yearly,expected.byPerson.length,expected.hasData,expected.items,expected.items.0.accountName,expected.items.0.accountType,expected.items.0.matchYearly,expected.items.0.periodLabel,expected.items.0.personName,expected.items.0.totalYearly,expected.items.0.yearly,expected.items.1.matchYearly,expected.items.1.totalYearly,expected.items.1.yearly,expected.limitsYear,expected.matchYearly,expected.totalYearly,expected.value,expected.warnings,expected.warnings.length,expected.yearly,todo,note
```

## Replay manifest

Exact fixed CSV layout (input columns precede expected columns):

```csv
case_id,rule,kind,target,arg.0,arg.1,params.today,plan.accounts,plan.accounts.0.id,plan.accounts.0.name,plan.accounts.0.type,plan.accounts.1.id,plan.accounts.1.type,plan.accounts.2.id,plan.accounts.2.type,plan.household.people,plan.household.people.0.birthDate,plan.household.people.0.id,plan.household.people.0.name,plan.household.people.0.role,plan.household.people.1.birthDate,plan.household.people.1.id,plan.household.people.1.name,plan.household.people.1.role,plan.retirement.contributions,plan.retirement.contributions.0.accountId,plan.retirement.contributions.0.amount,plan.retirement.contributions.0.employerMatch,plan.retirement.contributions.0.id,plan.retirement.contributions.0.period,plan.retirement.contributions.0.personId,plan.retirement.contributions.1.accountId,plan.retirement.contributions.1.amount,plan.retirement.contributions.1.employerMatch,plan.retirement.contributions.1.id,plan.retirement.contributions.1.period,plan.retirement.contributions.1.personId,plan.retirement.contributions.2.accountId,plan.retirement.contributions.2.amount,plan.retirement.contributions.2.employerMatch,plan.retirement.contributions.2.id,plan.retirement.contributions.2.period,plan.retirement.contributions.2.personId,expected.byPerson.0.age,expected.byPerson.0.limits,expected.byPerson.0.limits.0.catchUp,expected.byPerson.0.limits.0.kind,expected.byPerson.0.limits.0.limit,expected.byPerson.0.limits.0.over,expected.byPerson.0.limits.0.used,expected.byPerson.0.match,expected.byPerson.0.personId,expected.byPerson.0.yearly,expected.byPerson.1.limits,expected.byPerson.1.match,expected.byPerson.1.personId,expected.byPerson.1.yearly,expected.byPerson.length,expected.hasData,expected.items,expected.items.0.accountName,expected.items.0.accountType,expected.items.0.matchYearly,expected.items.0.periodLabel,expected.items.0.personName,expected.items.0.totalYearly,expected.items.0.yearly,expected.items.1.matchYearly,expected.items.1.totalYearly,expected.items.1.yearly,expected.limitsYear,expected.matchYearly,expected.totalYearly,expected.value,expected.warnings,expected.warnings.length,expected.yearly,todo,note
```

| Rule | Grid | Edge | Extreme | Second checks | TODO |
|---|---:|---:|---:|---:|---:|
| period-weekly | 60 | 30 | 10 | 10 | 0 |
| period-biweekly | 60 | 30 | 10 | 10 | 0 |
| period-semimonthly | 60 | 30 | 10 | 10 | 0 |
| period-monthly | 60 | 30 | 10 | 10 | 0 |
| period-quarterly | 60 | 30 | 10 | 10 | 0 |
| period-annual | 60 | 30 | 10 | 10 | 0 |
| period-once | 60 | 30 | 10 | 10 | 0 |
| period-unknown | 60 | 30 | 10 | 10 | 0 |
| own-match-total | 60 | 30 | 10 | 10 | 0 |
| person-aggregation | 60 | 30 | 10 | 10 | 0 |
| ira-combined-limit | 60 | 30 | 10 | 10 | 0 |
| 401k-base | 60 | 30 | 10 | 10 | 0 |
| 401k-catchup | 60 | 30 | 10 | 10 | 0 |
| 401k-super-catchup | 60 | 30 | 10 | 10 | 0 |
| hsa-self-catchup | 60 | 30 | 10 | 10 | 0 |
| hsa-employer-cap | 60 | 30 | 10 | 10 | 0 |
| age-reached | 60 | 30 | 10 | 10 | 0 |
| table-year | 60 | 30 | 10 | 10 | 0 |
| empty-input | 60 | 30 | 10 | 10 | 0 |
| dependent-exclusion | 60 | 30 | 10 | 10 | 0 |
| missing-account-person | 60 | 30 | 10 | 10 | 0 |
| warning-threshold | 60 | 30 | 10 | 10 | 0 |
