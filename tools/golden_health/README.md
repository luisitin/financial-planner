# Health answer key: Marketplace credit, Medicare IRMAA, high-deductible plans

One independent answer key for the three health-cost pages:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `health_key.py` | `tests/golden/health/ptc.csv` | 2,000 | the Marketplace premium tax credit for coverage years 2026 and 2027: the poverty line used, income as a multiple of it, the band, the applicable percentage, the yearly contribution, each covered person's age factor, the household's yearly benchmark and the yearly credit. Beside them: the enhanced 2021-2025 rules as a what-if, and four contrasts (percentage unrounded, every child counted, no 100% floor, the Form 8962 method) |
| | `tests/golden/health/irmaa.csv` | 1,500 | the 2026 Medicare income surcharge (IRMAA): the tier from MAGI two years back by filing status, the Part B premium, the Part D add-on, the surcharge a month and a year per person and for the household, and a literal "first line at or under" reading of the top line as a contrast (the page itself agrees with the law there) |
| | `tests/golden/health/hdhp.csv` | 1,000 | a year's out of pocket on a plan with a deductible, coinsurance and an out-of-pocket maximum (or none), and whether the plan qualifies for an HSA in 2026 and in 2027, with the reason when it does not |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the
model as small functions. `tests/golden/health/RULES.md` gives each rule in plain words with the source text,
and works one example per page by hand. Those examples are rows `ptc-edge-001` to `-006`, `ir-edge-001` /
`-002` and `hd-edge-001` to `-006` of the CSVs.

**Independence.** This key was written from the law (26 U.S.C. 36B and 223, 42 U.S.C. 1395r and 1395w-113),
the regulations (26 CFR 1.36B-1 to -3, 45 CFR 147.102 and 155.410), the IRS revenue procedures and Form 8962
instructions, the HHS poverty guideline notices, the CMS age-curve bulletin, the CMS and Federal Register 2026
Medicare notices and SSA's POMS, through `rules.py` and RULES.md. Nobody opened `modules/`, `core/` or
`tests/*.test.mjs` while writing it, and it never imports or runs the app. The only things taken from
`tools/golden_debt/` and `tools/golden_student_loans/` are their layout and conventions; no figure or code is
shared. The script works every row in two separate ways, both in exact arithmetic. It refuses to write any CSV
if an amount differs by more than a cent, or any other value (poverty line, band, percentage, tier,
eligibility, reason) differs at all, between the two. In fact the two agree exactly, before rounding, on every
value of every row: 39,084 amounts and 30,584 other values.

## Run

```
python3 tools/golden_health/health_key.py
```

Python 3 standard library only (made with 3.13; about 3 seconds). The run is deterministic
(`random.Random(20261031)`, and the generator draws only integers, never a float logarithm), so a second run
writes byte-identical files. The script sets `sys.dont_write_bytecode` *before* it imports `rules.py`, so no
`__pycache__` lands in the repo. Importing `rules.py` runs its self-checks. The run then checks derivation 2
against RULES.md's worked examples, works all three CSVs, and writes them only once all three have passed. It
prints every check count and the coverage.

Options: a folder argument writes the CSVs there instead (`health_key.py /tmp/x`); `--mutate NAME` puts one
deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script); `--skip-examples` turns off the
RULES.md examples check, so the row guard has to find a mistake alone. That is how the table under "Deliberate
mistakes" was made.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the
`rules.py` docstring gives the sha256 of each copy. No source was read again for this script, and the script
adds no figure of its own: every amount it uses comes from `rules.py`.

| Tag | Source | Used for |
|---|---|---|
| USC36B | 26 U.S.C. 36B, OLRC edition current through Pub. L. 119-136 (Oct 22, 2026) | the credit: (b)(2) benchmark minus contribution, (b)(3)(A)(i) straight line inside a band, (b)(3)(A)(iii) and (c)(1)(E) the enhanced rules ended with 2025, (c)(1)(A) 100% to 400%, (d)(3)(B) which poverty line |
| CGLAWS, CGHR1834, GPOHR1834, GPOPLAW | congress.gov API, H.R. 1834 as passed by the House, govinfo's public-law feed | no law extended the enhanced credits past 2025 (H.R. 1834 sits on the Senate calendar) |
| CFR36B1 | 26 CFR 1.36B-1(h) | the poverty line in effect on the first day of open enrollment |
| CFR36B2 | 26 CFR 1.36B-2(b)(1) | "at least 100 percent but not more than 400 percent" |
| CFR36B3 | 26 CFR 1.36B-3(e), (g) | the benchmark covers every member, adjusted only for age; the percentage "rounded to the nearest one-hundredth of one percent"; Examples 1 and 2 |
| CFR147 | 45 CFR 147.102 | per-member rating; only the three oldest children under 21 count; the age bands |
| CFR155 | 45 CFR 155.410(e) | open enrollment begins November 1 of the year before |
| RP2525, RP2626 | Rev. Proc. 2025-25 and 2026-26 | the 2026 and 2027 applicable percentage tables |
| I8962 | Instructions for Form 8962 (2025) | the Form 8962 method (whole percent, whole dollars); Table 2, which pins half-up rounding |
| PG25, PG26 | HHS poverty guidelines, 90 FR 5917 and 91 FR 1797 | the 2025 and 2026 guidelines, 48 states and DC |
| HCGOV | HealthCare.gov glossary | last year's guideline is used for next year's savings |
| CMSAGE | CMS bulletin of Dec 16, 2016, Appendix I | the federal default age curve |
| USC1395R, USC1395W | 42 U.S.C. 1395r(i), 1395w-113(a)(7) | the IRMAA tiers, MAGI two years back, the joint and separate lines, the Part B and Part D formulas |
| CMSFS26, FRB26, POMS | CMS 2026 Parts A and B fact sheet; 90 FR 52063; SSA POMS HI 01101.020 | the 2026 Part B premiums, Part D add-ons and income lines |
| CMSD26, CMSD27 | CMS Part D bid fact sheets for 2026 and 2027 | the $38.99 base premium the Part D add-ons rebuild from; 2027 has only the base premium |
| USC223, RP2519, RP2624, P969 | 26 U.S.C. 223; Rev. Proc. 2025-19 and 2026-24; IRS Pub. 969 | high-deductible plan lines and HSA limits for 2026 and 2027 |

## Figures

| Figure | Value | Source |
|---|---|---|
| Poverty line, coverage year 2026 | 2025 guideline: $15,650 + $5,500 for each added person | PG25; USC36B (d)(3)(B); CFR36B1 (h) |
| Poverty line, coverage year 2027 | 2026 guideline: $15,960 + $5,680 for each added person | PG26 |
| Applicable percentage, 2026 | under 133% 2.10; 133-150 3.14 to 4.19; 150-200 4.19 to 6.60; 200-250 6.60 to 8.44; 250-300 8.44 to 9.96; 300-400 9.96 | RP2525 |
| Applicable percentage, 2027 | 2.15; 3.23 to 4.30; 4.30 to 6.78; 6.78 to 8.66; 8.66 to 10.22; 10.22 | RP2626 |
| Enhanced (what-if) | under 150% 0; 150-200 0 to 2; 200-250 2 to 4; 250-300 4 to 6; 300-400 6 to 8.5; 400 and over 8.5 | USC36B (b)(3)(A)(iii) |
| Age factors | 0-14 0.765 ... 21-24 1.000, 40 1.278, 64 and over 3.000 | CMSAGE |
| Part B, 2026 | standard $202.90; tiers $284.10, $405.80, $527.50, $649.20, $689.90 | CMSFS26; FRB26 |
| Part D add-on, 2026 | $14.50, $37.50, $60.40, $83.30, $91.00 | CMSFS26; FRB26 |
| IRMAA lines, 2026 (MAGI of 2024) | single 109k / 137k / 171k / 205k / "less than" 500k; joint 218k / 274k / 342k / 410k / "less than" 750k; separate 109k / "less than" 391k | CMSFS26; POMS |
| High-deductible plan, 2026 | deductible at least $1,700 / $3,400; out of pocket at most $8,500 / $17,000; HSA limit $4,400 / $8,750 | RP2519 |
| High-deductible plan, 2027 | $1,750 / $3,500; $8,700 / $17,400; HSA limit $4,500 / $9,000 | RP2624 |

## Who each row is

- **Marketplace.** A household of `household_size` people (everyone on the tax return: the poverty line uses
  this number), living in one of the 48 states or DC. `adults` and `children` are the people covered by the
  Marketplace plan, so they can be fewer than the household. Adults are 21 to 64, children 0 to 25.
  `benchmark_40` is the monthly second-lowest-cost silver premium for a 40-year-old. Coverage runs all twelve
  months, the income is the year's household income (`magi`), and there is no tobacco rating.
- **Medicare.** One tax return. `magi` is the MAGI of that return two years before (2024 for 2026 premiums).
  `separate` means married filing separately, having lived with the spouse at some time in the year. `people`
  is how many people on the return are on Medicare: 1 or 2 on a joint return, 1 otherwise. Each pays Part B
  and Part D (a drug plan); `surcharge_year_part_b_only` is for someone without Medicare drug coverage.
- **High-deductible plan.** One year of `bills` (the plan's allowed amounts for covered care) on a plan with
  `deductible`, `coinsurance` (the member's share after the deductible, 0.20 = 20%) and `oop_max` (the
  out-of-pocket maximum, which includes the deductible). A blank `oop_max` means the plan has none.

## How each row is worked (derivation 1: rules.py)

- **Marketplace.** `rules.benchmark_annual` (12 x B40 / 1.278 x the factors of every adult and every child 21
  or over, plus the three oldest children under 21), then `rules.premium_tax_credit` four times: the law rules,
  the enhanced rules, the law with no 100% floor, and the Form 8962 method; once more with every child counted.
  The unrounded track uses `rules.applicable_percentage(..., rounded=False)`. The band label is worked by a
  small loop in this script.
- **Medicare.** `rules.irmaa_row`, `irmaa_monthly` and `irmaa_surcharge_annual`, by the law and with
  `at_or_under=True`.
- **High-deductible plan.** `rules.hdhp_out_of_pocket` and `rules.hsa_eligible`. A blank `oop_max` is passed as
  a cap equal to the bills, which changes nothing: min(m, d) + c x max(0, m - d) is never more than m when c is
  at most 1. For HSA eligibility a blank `oop_max` with coinsurance 0 is tested with the deductible as the
  limit (the member never pays more); with coinsurance above 0 there is no limit, and the plan fails.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, in integers and exact fractions, without calling a `rules.py` function. It
uses `rules.py`'s tables only.

- **Marketplace.**
  - The guideline year is the coverage year minus 1, and the guideline is the first person's amount + the
    step x (size - 1). `rules.py` looks the year up in a table and the amount up by index.
  - Income is held in integer cents M and the guideline in dollars L, so the percent of the poverty line is
    exactly M / L.
  - The band is found by bisection on the band floors. The percentage is held in hundredths of a point: initial
    + (final - initial) x (p - lower) / (upper - lower). It is rounded as floor((2n + d) / 2d) on its numerator n
    and denominator d.
  - Contribution in cents = M x hundredths / 10,000.
  - The benchmark is in cents from integer thousandths: 12 x B40 cents x the summed factors / 1,278. Under 21,
    the three largest factors count, not the three oldest ages; the two agree because the curve never falls with
    age.
  - The Form 8962 track uses M // L, and 401 when M > 400 L.
- **Medicare.** The amounts are rebuilt from the statute, not read from the table:
  - Part B = 2 x the $405.40 aged actuarial rate x 25 / 35 / 50 / 65 / 80 / 85% + the $0.20 to $0.70
    repayment amount, rounded to 10 cents.
  - Part D = $38.99 x (pct - 25.5) / 25.5, rounded to 10 cents.
  - The joint lines are twice the single ones, except the top, which is 150% of $500,000. The separate lines are
    the single threshold and $500,000 minus it.
  - The tier counts the lines passed: "more than" each lower line, "at least" the top one.
- **High-deductible plan.** Piecewise in cents: the bills up to the deductible, then the deductible + the
  coinsurance share of the rest, then the cap. HSA eligibility is tested in cents against `rules.HDHP`, with the
  same reason order.

The guard compares the two on 24,084 + 12,000 + 3,000 amounts and 24,084 + 4,500 + 2,000 other values. No
amount differs at all before rounding, and the largest gap is 0.

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up. Ties are real here: 45
  written amounts in ptc.csv and 17 in hdhp.csv are exactly on a half cent before rounding. IRMAA amounts are
  multiples of 10 cents, so they never are.
- **The applicable percentage** (`applicable_pct`, `enhanced_applicable_pct`, `form_applicable_pct`) is the
  IRS's: nearest 0.01 of a point, ties up (CFR36B3 (g)(1); RULES.md 1.4). The contribution uses the rounded
  figure. `applicable_pct_unrounded` is written to 6 decimals (rounded half up for display only), and
  `contribution_unrounded_pct` / `credit_unrounded_pct` use it exactly.
- **`income_multiple`** is income / poverty line, exact, written to 8 decimals for display. Eight are needed so
  that a cent over 400% still shows above 4.
- **Form 8962 track** (`form_*`): whole percent with the decimals dropped (401 over 4 x the guideline), the
  contribution and the benchmark each to the whole dollar, ties up.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder: once with the RULES.md examples check, and
once without it (`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | RULES.md examples check | Row guard |
|---|---|---|
| percentage truncated to 0.01, not rounded | caught | refused at `ptc-edge-001` (7.93 vs 7.94) |
| percentage ties rounded to even | not caught | refused at `ptc-edge-007` (3.66 vs 3.67) |
| exactly 133% put in the lower band | not caught | refused at `ptc-edge-026` (2.10 vs 3.14) |
| exactly 400% gets no credit | caught | refused at `ptc-edge-003` (eligibility) |
| the guideline of the coverage year itself | caught | refused at `ptc-edge-001` (guideline year 2026 vs 2025) |
| every child counted (no cap) | caught | refused at `ptc-edge-006` (benchmark 27,957.75 vs 24,366.20) |
| IRMAA top line read "at or under" | caught | refused at `ir-edge-002` (tier 4 vs 5) |
| Part D add-on rounded to the cent | caught | refused at `ir-edge-001` (37.46 vs 37.50) |
| coinsurance on all the bills past the deductible | caught | refused at `hd-edge-003` (5,000.00 vs 4,400.00) |
| HSA minimum deductible exclusive | not caught | refused at `hd-edge-008` (eligibility) |

In all twenty runs no CSV was written.

## The generator

Edge rows come first, then random rows. A random Marketplace draw is redrawn when its income is exactly on a
band line, which is left to the edge rows (1 draw). It is also redrawn when its unrounded percentage is within
1e-9 of a point of a rounding tie, on the law, enhanced or Form 8962 track (6 draws), so float error in an app
cannot flip it. A random IRMAA draw exactly on a line would be redrawn; none was. HDHP rows are never redrawn.

### ptc.csv: 357 edge rows (`ptc-edge-001` to `-357`), then 1,643 random rows (`ptc-0001` to `ptc-1643`)

| Rows | What they pin down |
|---|---|
| `-001` to `-006` | RULES.md 4.1. The couple 45 and 43 on $50,000 with a $500 benchmark: 9,180.23 (enhanced 11,420.23, Form 8962 9,190). At $90,000: 0 (enhanced 5,500.23). Exactly 400% ($84,600): 9.96%. $84,601: 0. Coverage year 2027: 9,175.23. Four children under 21: benchmark 24,366.20, or 27,957.75 counting every child |
| `-007` to `-010` | **rounding ties, labelled.** 141.5% in 2026 (3.665 written 3.67), 175% in 2026 (5.395 written 5.40), 141.5% in 2027 (3.765 written 3.77), 301% on the enhanced table (6.025 written 6.03, as the IRS's 2025 Table 2 prints) |
| `-011` to `-021` | no income; exactly 6 x the poverty line; a 21-year-old child beside four under 21; ages at the curve's edges (64, 63, 15, 14); children of 25 and 20; a contribution above the benchmark (eligible, credit 0); a 64-year-old with a $900 benchmark; eight people with six children under 21; one of four covered; a family under 100%; only the children covered |
| `-022` to `-357` | **every line, for every household size and both years:** 100%, 133%, 150%, 200%, 250%, 300% and 400% of the poverty line, each at -0.01, exactly, and +0.01. People and benchmark random. 2026 is `-022` to `-189`, 2027 `-190` to `-357`; within a year, size 1 to 8 in blocks of 21 |

Random rows:

- **Coverage year:** 2026 in 60% of rows, 2027 in 40%.
- **Household size:** 1 to 8, with weights 20/20/15/15/10/8/6/6.
- **Adults:** one in a household of one; otherwise two (75%) or one.
  - Age: 21 to 64 (60%) or 50 to 64 (40%).
- **Children:** the rest of the household.
  - Age: 0 to min(20, youngest adult - 16) in 80% of cases, 0 to min(25, youngest adult - 16) otherwise.
- **Not covered:** in 15% of households of 2 or more, one person (70%) or 1 to n - 1 people are not
  covered.
- **Income band, weights:** under 100% 6, 100-133 8, 133-150 8, 150-200 17, 200-250 15, 250-300 13,
  300-400 18, 400-600 15.
  - Uniform in cents strictly inside the band.
  - 20% are rounded to whole dollars and 10% to whole hundreds, never above 6 x.
- **benchmark_40:** $300.00 to $900.00 in cents (70%) or in whole dollars (30%).

### irmaa.csv: 68 edge rows (`ir-edge-001` to `-068`), then 1,432 random rows (`ir-0001` to `ir-1432`)

| Rows | What they pin down |
|---|---|
| `-001`, `-002` | RULES.md 4.2. Joint, $300,000, both on Medicare: 5,769.60 a year. Single, exactly $500,000: the top tier by law, 6,936.00; the page's reading 6,355.20 |
| `-003` to `-029` | single: each of the five lines at -1, -0.01, exactly, +0.01 and +1; then MAGI $0 and $1,000,000 |
| `-030` to `-056` | joint, the same; people alternate 2 and 1 |
| `-057` to `-068` | separate: $109,000 and $391,000, the same five offsets; $0 and $1,000,000 |

Random rows:

- **Filing status:** single 40%, joint 40%, separate 20%.
- **Tier:** one of the status's tiers, uniformly (six, or three for separate).
  - MAGI is uniform within that tier, from $0 for the lowest and up to $1,000,000 for the top.
  - Whole dollars in 80% of rows, cents in 20%.
- **People:** on a joint return, 2 (60%) or 1.

### hdhp.csv: 51 edge rows (`hd-edge-001` to `-051`), then 949 random rows (`hd-0001` to `hd-0949`)

| Rows | What they pin down |
|---|---|
| `-001` to `-006` | RULES.md 4.3: $3,000 deductible, 20%, $6,000 cap. Bills of 2,000 / 3,000 / 10,000 / 18,000 / 30,000 give 2,000 / 3,000 / 4,400 / 6,000 / 6,000. The same plan as family coverage fails the HSA test ($3,000 is under $3,400) |
| `-007` to `-030` | the HSA lines of 2026 and 2027, self-only and family: minimum deductible and out-of-pocket limit, each at -1, exactly and +1 |
| `-031` to `-037` | bills at the deductible (-0.01, exactly, +0.01) and where the cap is reached (-1, -0.01, exactly, +0.01; the -0.01 row is 5,999.9975, written 6,000.00) |
| `-038` to `-051` | no bills; $150,000; coinsurance 0 and 50%; no out-of-pocket limit with coinsurance 0 (qualifies) and 20% (fails); family with no limit and a deductible over the limit; a deductible under the minimum with no limit (the reason is the deductible); no deductible; a limit below the deductible (the formula caps there; not a real plan); a limit equal to the deductible; a half cent (1,000.005 written 1,000.01); a family plan on the 2026 lines (2026 yes, 2027 no); a self-only plan on the 2027 lines (2027 yes, 2026 no) |

Random rows:

- **Coverage:** self-only 55%, family 45%. Below, k = 1 for self-only and 2 for family.
- **Deductible:**
  - whole hundreds from $1,000 k to $4,000 k (35%);
  - multiples of $50 up to $7,500 k (45%);
  - whole dollars up to $9,000 k (20%).
- **Out-of-pocket maximum:** never below the deductible.
  - Blank in 8% of rows.
  - In 25% it is one of the 2026 or 2027 HSA limits or $5,000 k to $10,000 k in whole thousands.
  - Otherwise it is the deductible + a multiple of $50, up to $12,000 k.
- **Coinsurance:** 0 (15%), one of 10% to 50% in steps of 5 (55%), or 1% to 50% in whole percent (30%).
- **Bills:**
  - 0 (5%);
  - whole hundreds to $150,000 (10%);
  - otherwise one of $20-$1,000, $1,000-$10,000, $10,000-$50,000 and $50,000-$150,000, chosen evenly, in
    cents (70%) or whole dollars (30%).

## Coverage (from the run)

**ptc.csv**

| | Rows |
|---|---|
| total | 2,000 (357 edge, 1,643 random; 1,650 random draws) |
| coverage year 2026 / 2027 | 1,167 / 833 |
| household size 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 | 367 / 358 / 279 / 267 / 238 / 205 / 142 / 144 |
| band (law) under 100 / 100-133 / 133-150 / 150-200 / 200-250 / 250-300 / 300-400 / over 400 | 117 / 180 / 172 / 311 / 287 / 279 / 362 / 292 |
| eligible (law) / credit above 0 / eligible but credit 0 | 1,591 / 1,542 / 49 |
| fewer people covered than in the household / only children covered | 272 / 28 |
| the three-oldest-children cap applies (the law and the plain sum differ) | 492 |
| a covered child of 21 to 25 / an adult of 64 / a child of 14 or under | 101 / 120 / 1,251 |
| enhanced credit higher than the law's / enhanced credit above 0 over 400% | 1,825 / 254 |
| credit with the unrounded percentage differs by more than a cent | 843 |
| Form 8962 credit differs by more than a cent / largest difference | 1,522 / $55.95 |
| law percentage exactly on a rounding tie (labelled edge rows) | 3 |
| written amounts exactly on a half cent before rounding | 45 |
| largest credit | $64,475.11 |
| draws redrawn: on a band line / on a rounding tie | 1 / 6 |

**irmaa.csv**

| | Rows |
|---|---|
| total | 1,500 (68 edge, 1,432 random; 1,432 random draws) |
| single / joint / separate | 620 / 574 / 306 |
| single tier 0 / 1 / 2 / 3 / 4 / 5 | 90 / 108 / 109 / 90 / 112 / 111 |
| joint tier 0 / 1 / 2 / 3 / 4 / 5 | 97 / 92 / 95 / 103 / 91 / 96 |
| separate tier 0 / 4 / 5 | 97 / 105 / 104 |
| joint with 2 people on Medicare | 354 |
| MAGI with cents | 317 |
| an "at or under" reading gives another tier | 4 (`ir-edge-002`, `-025`, `-052`, `-064`) |

**hdhp.csv**

| | Rows |
|---|---|
| total | 1,000 (51 edge, 949 random) |
| self-only / family | 573 / 427 |
| bills within the deductible / past it / at the cap | 326 / 376 / 298 |
| out-of-pocket maximum blank / coinsurance 0 / bills 0 | 79 / 150 / 46 |
| HSA 2026 yes / 2027 yes / the two years differ | 397 / 431 / 66 |
| HSA 2026 no: deductible under the minimum / limit over the maximum / no limit | 234 / 325 / 44 |
| HSA 2027 no: deductible under the minimum / limit over the maximum / no limit | 258 / 268 / 43 |
| deductible exactly at the 2026 minimum / limit exactly at the 2026 maximum | 19 / 43 |
| written amounts exactly on a half cent before rounding | 17 |

## CSV columns

Money has two decimals. A blank means "does not apply" (no percentage or contribution for someone who does not
qualify). `note` is empty on every random row; on an edge row it says what the row shows.

**ptc.csv**

`case_id, label, coverage_year, household_size, magi, adults, children, benchmark_40, fpl_year, fpl,
income_multiple, band, eligible, applicable_pct, contribution, age_factors, children_not_counted, benchmark,
credit, applicable_pct_unrounded, contribution_unrounded_pct, credit_unrounded_pct, enhanced_applicable_pct,
enhanced_contribution, enhanced_credit, benchmark_all_children, credit_all_children, credit_no_floor,
form_pct_of_fpl, form_applicable_pct, form_contribution, form_credit, note`

- `adults`, `children`: the covered people's ages, oldest first, joined by `|` (`45|43`, `16|12|7|3`).
- `fpl_year`, `fpl`: the guideline year and the poverty line for `household_size`, in whole dollars.
- `band` (the law's): `under 100`, `100-133`, `133-150`, `150-200`, `200-250`, `250-300`, `300-400` (which
  takes 400 itself), `over 400`. `eligible` is `yes` from 100% to 400%.
- `applicable_pct` is a percent (`7.94` = 7.94%). `contribution` and `benchmark` are a year's. `credit` =
  max(0, benchmark - contribution), or 0 when not eligible.
- `age_factors`: each covered person's factor in the order of `adults` then `children`.
  `children_not_counted` is how many of the youngest children under 21 are left out (all but the three
  oldest). They are left out of `benchmark` but kept in `benchmark_all_children`.
- `*_unrounded_pct`: the same, with the percentage not rounded.
- `enhanced_*`: the 2021-2025 table as a what-if. No cliff, 8.5% at 400% and over, no credit under 100%, and
  the same guideline year.
- `credit_all_children`: the law with every child counted (the page's plain sum). `credit_no_floor`: the law
  with no 100% floor, so under 100% the first band's rate applies; the cliff still applies.
- `form_*`: the Form 8962 method. `form_pct_of_fpl` is line 5 (decimals dropped, 401 over 4 x the guideline).
  The contribution and credit are in whole dollars, against the benchmark rounded to the whole dollar.

**irmaa.csv**

`case_id, label, premium_year, magi_year, filing_status, magi, people, tier, part_b_premium, part_b_irmaa,
part_d_irmaa, surcharge_month_per_person, surcharge_year_per_person, surcharge_year_household,
surcharge_year_part_b_only, at_or_under_tier, at_or_under_surcharge_year_per_person, note`

- `filing_status`: `single` (also head of household and surviving spouse), `joint`, `separate` (married filing
  separately, lived with the spouse at some time in the year).
- `tier`: 0 (no surcharge) to 5 (top). `separate` has only 0, 4 and 5, the tiers whose amounts it shares.
- `part_b_premium` is the whole monthly Part B premium; `part_b_irmaa` is that minus the $202.90 standard.
- `surcharge_month_per_person` = Part B over the standard + the Part D add-on.
  `surcharge_year_per_person` = that x 12. `surcharge_year_household` = that x `people`.
  `surcharge_year_part_b_only` = Part B over the standard x 12, for one person.
- `at_or_under_tier`, `at_or_under_surcharge_year_per_person`: "the first line the MAGI is at or under", read
  literally with $500,000 / $750,000 / $391,000 as lines. It differs only exactly on those lines. This is not the
  page: the page stores its lines as $499,999.99 / $749,999.99 / $390,999.99, inclusive, so it puts exactly
  $500,000 in the top tier as the law does and matches `tier` (checked against the page on 2026-10-31).

**hdhp.csv**

`case_id, label, coverage, deductible, coinsurance, oop_max, bills, out_of_pocket, phase, hsa_2026,
hsa_2026_reason, hsa_2027, hsa_2027_reason, hsa_limit_2026, hsa_limit_2027, note`

- `coverage`: `self` (self-only) or `family`. `coinsurance` is the member's share (`0.20` = 20%). `oop_max`
  blank = none.
- `out_of_pocket` = min(oop_max, min(bills, deductible) + coinsurance x max(0, bills - deductible)), with no
  min when `oop_max` is blank.
- `phase`: `deductible` (bills at or under the deductible), `coinsurance` (past it, under the cap; also at 0%
  coinsurance), `capped`.
- `hsa_2026`, `hsa_2027`: `yes` / `no`. The reason, when no, is one of `deductible under the minimum`,
  `out-of-pocket maximum over the limit`, `no out-of-pocket limit`. The deductible is checked first.
- `hsa_limit_*`: the year's HSA contribution limit for the coverage, for someone under 55 eligible all year.

## Open points (judgement calls a reviewer should know)

1. **Law, not the page, where they differ; the page's reading beside it.** The main columns follow the law.
   A contrast column gives the page's literal reading where RULES.md section 5 records a difference:
   - `credit_all_children`: the three oldest children under 21 (45 CFR 147.102(c)(1));
   - `credit_no_floor`: no credit under 100%;
   - `at_or_under_tier`, `at_or_under_surcharge_year_per_person`: exactly $500,000 / $750,000 / $391,000 is the top
     tier. (The page turned out to follow the law here; the column is kept as a contrast for any reader of
     "at or under".)

   So an app that follows its README matches either the main column or the contrast. Any other mismatch is a
   bug on one side.
2. **The applicable percentage is rounded** to 0.01 of a point, half up, before it multiplies income (the
   IRS's rule; RULES.md 1.4). The unrounded track is written beside it, because the page README says only
   "straight-line". The two credits differ by more than a cent on 843 rows (up to 0.005% of income).
3. **The percentage of the poverty line is exact on the main track**, not truncated. Truncation is the Form
   8962 track, a contrast that differs by more than a cent on 1,522 rows (up to $55.95). The 2026 and 2027
   Form 8962 instructions are not published, so that track assumes the 2025 method. It uses the income as given,
   cents included; the form lets a filer round to whole dollars, which could move line 5 only within 50 cents
   of a whole percent.
4. **Band edges:** "at least" the lower line, "less than" the upper line, and 300-400 takes 400 itself. It
   matters only at 133%, where the rate jumps (2.10 to 3.14 in 2026, 2.15 to 3.23 in 2027). **Exactly 400%
   qualifies**; a cent more gets nothing under the law. Under 100% gets nothing under either rule set.
5. **Poverty line year:** coverage year 2026 uses the 2025 guideline, 2027 the 2026 guideline (RULES.md 1.2). The
   enhanced what-if uses the same.
6. **2027 Marketplace rows are included** because Rev. Proc. 2026-26 has published the 2027 table. **There are
   no 2027 IRMAA rows**, because CMS had not published them by 2026-10-31. HSA columns cover 2026 and 2027
   (Rev. Proc. 2025-19 and 2026-24).
7. **Household and covered people.** The poverty line uses the whole household; the benchmark uses only the
   covered people. A child of 21 to 25 is rated by age on the curve (1.000 to 1.004) and always counts.
   `children_not_counted` and `benchmark_all_children` show the cap. The per-person premium is not rounded, and
   the year is 12 equal months.
8. **The credit is against the benchmark only.** It is not capped at the premium of the plan actually bought,
   because the row has no such premium (RULES.md section 5, item 4).
9. **IRMAA.** Tiers are numbered 0 to 5, and the separate status uses 0, 4 and 5 so its amounts line up. Each
   spouse on Medicare pays the joint return's amount, so a joint household with 2 people pays twice. The
   surcharge includes the Part D add-on, as the page's formula does. `surcharge_year_part_b_only` is for people
   without Medicare drug coverage. Head of household, surviving spouse, and married filing separately while
   living apart all year use the single column; they are not separate rows.
10. **A blank out-of-pocket maximum** means no cap in the formula. For the HSA test, the key asks what the member
    can be made to pay. With coinsurance 0 that is the deductible, which is tested against the limit. With
    coinsurance above 0 there is no ceiling, so the plan fails ("no out-of-pocket limit"). When both the
    deductible and the limit fail, the reason given is the deductible's. An app that shows "can't tell" for a
    blank limit is making another valid choice, and these 79 rows will not match it.
11. **Both HSA lines are inclusive**: a deductible exactly at the minimum, and a limit exactly at the maximum,
    qualify. The embedded-deductible rule for family plans and the 2026 rule that Marketplace bronze and
    catastrophic plans count are law, but the row has no input for them (RULES.md 3.2).
12. **Out-of-pocket limit below the deductible** (`hd-edge-047`) is kept as the formula reads: the cap wins.
    Random rows never have it.
13. **Float traps in the edge rows.** A plain float version of the percentage path, written for this README and
    not shipped, computes income / guideline x 100 in doubles. It misses by more than a cent on 4 rows:
    - `ptc-edge-009`, the 2027 tie: 3.765 comes out a hair under and rounds to 3.76;
    - `ptc-edge-194`, `-236`, `-320`: exactly 133% in 2027, where the float percentage is 132.99999999999997,
      so the row falls into the 2.15% band. Computed as income x 100 / guideline, these three come out exactly
      133.

    These rows are right in the key. An app that misses them needs exact or epsilon-guarded comparisons at the
    band lines and the rounding step. Random rows sit away from both (redraws above).
14. **Inputs the brief left open:** all the mixes under "The generator". They include the share of 2027 rows,
    the household and age mixes, the share of people not covered, the income bands' weights and the HDHP plan
    mixes.

## What the key leaves out (on purpose)

Alaska and Hawaii poverty lines (in `rules.py`, not used); the state age curves (Alabama, DC, Massachusetts,
Minnesota, Mississippi, Oregon, Utah) and New York and Vermont's flat rating; tobacco rating; the premium of
the plan actually bought; part-year coverage and monthly changes; reconciling advance payments; the employer
coverage affordability test (9.96% / 10.22%); the exceptions under 100% (26 CFR 1.36B-2(b)(5)-(6)); Medicaid;
IRMAA appeals for a life-changing event, Medicare Advantage premiums and the not-yet-published 2027 tiers;
copays, separate drug deductibles and family members' own deductibles; the HSA catch-up at 55 ($1,000), the
month-by-month proration and the last-month rule.

## Checked against the pages (2026-10-31)

The first run of `tests/golden-health.test.mjs` found the pages and the key apart on 22 causes. Each was checked
against the sources: the pages had the 100% floor missing, exactly 133% in the lower band, the percentage
unrounded, a straight line between the age curve's anchor ages (and 1.429 at 45), every child counted, a blank
out-of-pocket maximum passed as HSA-eligible, and one year of figures for 2027 coverage and 2027 HSA dates. All
were fixed on the pages the same day (`modules/retirement/healthcare`, `modules/insurance/health`), and the test
now runs with no to-do rows. IRMAA agreed on every row from the start.
