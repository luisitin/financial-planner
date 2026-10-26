# Retirement contributions  (`retirement/contributions`)

**Status:** usable (phase 5)
**Purpose:** What goes into 401(k)s, IRAs, Roths and HSAs each year, with the employer match and this year's limits.

## Inputs
`retirement.contributions` `[{ id, accountId, personId, amount, period, employerMatch (yearly) }]`, `accounts` (the account's type decides the bucket and the limit kind), `household`. Writes: `retirement.contributions`.

## Outputs
`items[]`, `yearly`, `matchYearly`, `totalYearly`, `byPerson[]` (`limits[]`: kind, limit incl. catch-up, used, over), `limitsYear`, `warnings[]`, `hasData`.

## Formulas
- Yearly = amount x times per year (`core/math/periods.js`) + employer match.
- Limits (`data/limits.js`, IRS): 2026: 401(k)/403(b) 24,500 (+8,000 from 50; 11,250 from 60 to 63), IRA 7,500 traditional and Roth together (+1,100 from 50), HSA 4,400 self-only (+1,000 from 55; 8,750 family). 2025 also listed. The age reached in the year is what counts. Employer money is outside these limits.

## Tests
`tests/retirement-pages.test.mjs`: totals, match, catch-up limits, an over-limit warning.

## Ideas / not yet
- Family vs self-only HSA choice; the overall 415(c) limit; after-tax 401(k).

## Independent answer-key audit

`tests/golden/retirement/contributions.csv` contains 2,200 invented cases (22 rules;
60 grid, 30 edge and 10 extreme cases each). Its rules, exact flattened layout,
rounding and worked second checks are in
[`tests/golden/retirement/briefs/contributions.md`](../../../tests/golden/retirement/briefs/contributions.md).
The independent generator `tools/golden_retirement/contributions.py` uses Decimal
and rational arithmetic without executing application code. Every tenth case is
checked again with repeated addition, a direct total-cap table, remaining room or
a conservation identity. Money is written to cents; replay tolerance is 0.005.

The statutory source checks are [IRS Notice 2024-80](https://www.irs.gov/pub/irs-drop/n-24-80.pdf)
for 2025 employee/IRA limits and [Notice 2025-67](https://www.irs.gov/pub/irs-drop/n-25-67.pdf)
for 2026. The self-only HSA cap is 4,300 in 2025 and 4,400 in 2026; family caps are
8,550 and 8,750 respectively, from [Rev. Proc. 2024-25 §2.01(1)](https://www.irs.gov/pub/irs-drop/rp-24-25.pdf)
and [Rev. Proc. 2025-19 §2.01(1)](https://www.irs.gov/pub/irs-drop/rp-25-19.pdf).
[Publication 969](https://www.irs.gov/publications/p969), Additional contribution,
supports the age-55 additional 1,000. The future-year answer key freezes the 2026
table rather than inventing future law. All balances in the fixtures are invented
worked examples, whose arithmetic and source are in each row's note.

**Known discrepancy:** the earlier blanket sentence that employer money is outside
the limits is incorrect for HSAs. Publication 969, Employer contributions, requires
employer payments to reduce what the individual may contribute. Thus a 2026
self-only HSA at age 40 with 4,400 from the individual and 100 from the employer
uses 4,500 against the 4,400 limit and is over by 100. The current implementation
counts only 4,400 toward that limit. These sourced cases remain explicit TODO
tests until the discrepancy is corrected. Employer 401(k) money remains outside
the elective-deferral limit; this audit does not introduce the separate overall
defined-contribution cap. Family HSA selection remains a documented future feature.
