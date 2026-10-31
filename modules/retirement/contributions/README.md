# Retirement contributions  (`retirement/contributions`)

**Status:** usable (phase 5)
**Purpose:** What goes into 401(k)s, IRAs, Roths and HSAs each year, with the employer match and this year's limits.

## Inputs
`retirement.contributions` `[{ id, accountId, personId, amount, period, employerMatch (yearly) }]`, `accounts` (the account's type decides the bucket and the limit kind), `household`. Writes: `retirement.contributions`.

## Outputs
`items[]`, `yearly`, `matchYearly`, `totalYearly`, `byPerson[]` (`limits[]`: kind, label, limit incl. catch-up, used, over, catchUp, year of the figures), `limitsYear` (the newest year that has every kind), `kindYear`, `limits` (`limitsFor(year)`), `hsa` (`hsaPicture`), `warnings[]`, `hasData`.

## Shared helpers (exported from `compute.js`; every page that needs a limit uses them)
- **`limitsFor(year)`** -> `{ year, kinds: { "401k", ira, hsa, fsa }, kindYear: { kind: table year }, rothPhaseOut, rothPhaseOutYear, giftExclusion, giftExclusionYear, fullYear, complete }`. Each kind comes from the newest year of `data/limits.js` at or before `year` that has it; a year before the first table takes the first. The IRS publishes the HSA limits in the spring (Rev. Proc. 2026-24, dated 2026-05-29, for 2027) and the 401(k), IRA, FSA, Roth IRA and gift figures in October and November (none of 2027's by 2026-10-31), so a 2027 date gets 2027's HSA figures and 2026's others, and `kindYear` says which. Never read `LIMITS[year]` directly: a partial year has only some kinds.
- **`catchUpFor(def, age)`**: the catch-up for the age reached in the year (`def` = one kind of `limitsFor(year).kinds`): 401(k) from 50 (IRC 414(v)(5)(A)), the 60-63 amount instead in the years a person reaches 60, 61, 62 or 63 (414(v)(2)(E)(i), 11,250 in 2025 and 2026, Notices 2024-80 / 2025-67); IRA from 50 (219(b)(5)(B)); HSA 1,000 from 55 (223(b)(3), not indexed). 0 when the age is not known; the health FSA has none.
- **`hsaPicture(plan, year, { contributions })`** -> `{ year, kindYear, coverage, coverageChosen, coveredId, shared, base, catchUpAmount, catchUpAge, typed, rows, people: [{ id, name, role, age, eligible, catchUp, rowsPayroll, rowsEmployer, payroll, employer, used, limit, room, over, excess }], household: { limit, catchUp, payroll, employer, used, room, over, excess } }`. `contributions` is this page's `items` (or its `compute()` result); left out, they are read from the plan. Under IRC 223:
  - *Cover* (`taxes.hsa.coverage`): `"none"` no high-deductible plan, so nobody may have money in an HSA (223(b)(1): the limit counts only months the person "is an eligible individual"; 223(c)(1)(A)(i): eligible means covered by a high deductible health plan); `"self"` only the covered adult (`taxes.hsa.coveredId`, else the adult marked "Me", else the first adult); `"family"` every adult. Left out or unknown: read as `"self"`, the old default (`coverageChosen: false`).
  - *Money*: each adult's own HSA rows, amount + employer match (employer money "reduce[s] the amount you or any other person can contribute", Pub. 969; 223(b)(4)(B)); the HSA page's typed `contribution` and `employer` where they are more than all the HSA rows put together go on the covered adult (or "Me"), so a plan that types only the HSA page still works. A row that names no adult goes on its account's owner, else on that adult.
  - *Limit*: an eligible adult gets the self-only or family amount (`data/limits.js`: 4,300 / 8,550 in 2025, Rev. Proc. 2024-25 s.2.01(1); 4,400 / 8,750 in 2026, Rev. Proc. 2025-19 s.2.01(1); 4,500 / 9,000 in 2027, Rev. Proc. 2026-24 s.3.01(1)) + their own catch-up; others 0. Married (joint or separate) with family cover, the two spouses share one family limit (223(b)(5): "the limitation ... (without regard to any additional contribution amount ...) shall be divided equally between them unless they agree on a different division"; Pub. 969: "Each spouse must make the additional contribution to their own HSA"): each spouse's limit = own catch-up + max(0, family - max(0, the other spouse's money - the other spouse's catch-up)), the most that spouse could have given the other's money (answer key `tests/golden/limits/RULES.md` 5.4). Adults who are not married to each other each get the whole family amount. `room = max(0, limit - used)`, `over = max(0, used - limit)`; spouses sharing the limit can both show the same dollars over.
  - *Excess*, the money that is really over (taxed as pay, 106(d)(1) "to the extent such amounts do not exceed the limitation under section 223(b)"; Pub. 969 "Excess contributions made by your employer are included in your gross income"): `over` per adult, except for spouses sharing the family limit, who split it the way that leaves the least money over and, among those, nearest to equal halves (223(b)(5)'s default; RULES.md convention 6). Household excess = the sum; it can be more than the household's `over` when a spouse 55 or over does not use their own catch-up, which cannot go into the other's account.
  - *Household*: limit = the cover amount + the catch-ups of the eligible adults (0 without cover); used = all the money; room, over against it.
  - Not modelled: the month-by-month limit for part-year cover (223(b)(2)), Medicare ending eligibility (223(b)(7)), a general-purpose FSA ending eligibility (223(c)(1)(A)(ii); the HSA page warns).
  Checked against the answer key's `hsa_*` columns (3,000 households, `tests/golden/limits/households.csv`): every per-adult and household figure agrees when the plan names its cover.

## Formulas
- Yearly = amount x times per year (`core/math/periods.js`) + employer match.
- Limits (`data/limits.js`, IRS, read through `limitsFor`): 2026: 401(k)/403(b) 24,500 (+8,000 from 50; 11,250 from 60 to 63), IRA 7,500 traditional and Roth together (+1,100 from 50), HSA 4,400 self-only (+1,000 from 55; 8,750 family). 2025 also listed; 2027 has only the HSA so far (4,500 / 9,000, Rev. Proc. 2026-24 s.3.01(1)). The HSA row of each person is `hsaPicture`'s: it follows the HSA page's cover (a spouse outside self-only cover has a limit of 0 and is told why; spouses with family cover share the family limit). The age reached in the year is what counts. A Roth account counts as a Roth 401(k)/403(b) (with the 401(k) limit, IRC 402A(c)(2)) when it has an employer match or its name says 401(k), 403(b), 457 or TSP; otherwise as a Roth IRA (the IRA limit, 408A(c)(2)) (`limitKind`). An employer's 401(k) match is outside the elective-deferral limit; an employer's HSA deposits share the HSA limit (IRS Pub. 969, Employer contributions).

## Tests
`tests/retirement-pages.test.mjs`: totals, match, catch-up limits, an over-limit warning. `module.test.mjs`: `limitsFor` (2024 to 2030, the partial 2027), `catchUpFor` (every age band), `hsaPicture` (RULES.md 10.4's shared family limit, self-only and no cover, typed money, unmarried adults), the HSA rows.

## Ideas / not yet
- The overall 415(c) limit; after-tax 401(k).

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
supports the age-55 additional 1,000. The future-year answer key freezes the newest
published figure of each kind rather than inventing future law: 2026's, and for the HSA
2027's 4,500 ([Rev. Proc. 2026-24 §3.01(1)](https://www.irs.gov/pub/irs-drop/rp-26-24.pdf),
dated 2026-05-29, read 2026-10-31; the key's generator and lead audit were updated
2026-10-31 and the 33 future-year HSA rows regenerated). All balances in the fixtures are invented
worked examples, whose arithmetic and source are in each row's note.

**Fixed 2026-10-30 (F-030):** employer HSA deposits now count toward the HSA limit (Publication 969: employer payments reduce what the individual may contribute), so a 2026 self-only HSA at age 40 with 4,400 from the individual and 100 from the employer uses 4,500 against the 4,400 limit and is over by 100. Employer 401(k) money remains outside the elective-deferral limit; the separate overall defined-contribution cap is not modelled. The HSA cover now comes from the HSA page (`hsaPicture`); the key's cases name none, which reads as self-only cover of the adult marked "Me".
