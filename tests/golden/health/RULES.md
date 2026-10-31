# Health answer key: the rules

This file states the rules behind the health answer key in plain words. It covers three calculators:
the Marketplace premium tax credit, the Medicare income surcharge (IRMAA) and high-deductible plans with
health savings accounts (HSAs). Each rule comes with the source text it rests on, the address and the
date it was read. Where no source decides, the file says which convention the key adopts. It ends with
one worked example per calculator, using invented households.

`tools/golden_health/rules.py` holds the same figures as data, with the source and the date read on the
line of each figure, plus small pure functions. It uses Python 3's standard library only, and the arithmetic
is exact (`Fraction`). Importing it runs `check_tables()`, which rebuilds each figure it can from the
statute's own formula, checks the worked examples below, and fails loudly if anything disagrees.

**Independence.** The key was written from the law, the regulations and the agencies' own publications.
Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs
the app. The only things taken from `tools/golden_debt/` and `tools/golden_student_loans/` are their layout
and conventions; no figure or code is shared with them. The pages' model (their README) is the spec. Where
the law says otherwise, the key follows the law and section 5 records the difference.

All sources were read on **2026-10-31**. Section 6 lists them with their sha256.

---

## 1. Marketplace: the premium tax credit (26 U.S.C. 36B)

### 1.1 Which rules apply in 2026 and 2027: the enhanced credits ended with 2025

The enhanced credits of the American Rescue Plan (2021), which the Inflation Reduction Act (2022) extended,
were written into 36B as two temporary clauses. Both end with taxable years beginning before 2026.

> "(iii) Temporary percentages for 2021 through 2025. In the case of a taxable year beginning after
> December 31, 2020, and before January 1, 2026— (I) clause (ii) shall not apply for purposes of adjusting
> premium percentages under this subparagraph, and (II) the following table shall be applied in lieu of the
> table contained in clause (i)" (26 U.S.C. 36B(b)(3)(A)(iii))

> "(E) Temporary rule for 2021 through 2025. In the case of a taxable year beginning after December 31, 2020,
> and before January 1, 2026, subparagraph (A) shall be applied without regard to 'but does not exceed 400
> percent'." (36B(c)(1)(E))

Source: https://uscode.house.gov/us/usc/119-136/t26/s36B/, the edition "current through Public Law 119-136
(October 22, 2026)", read 2026-10-31. Its amendment notes end with Pub. L. 119-21 (July 4, 2025), which
did not extend either clause.

**No later law extended them.** The checks behind this, all made on 2026-10-31:
- The congress.gov API lists the laws of the 119th Congress. The last public law is 119-136, signed
  October 22, 2026, and the U.S. Code edition above already includes it
  (https://api.congress.gov/v3/law/119). The govinfo public-law feed also stops at 119-136
  (https://www.govinfo.gov/rss/plaw.xml).
- H.R. 1834, as passed by the House on January 8, 2026 (230-196), would extend both clauses: "by striking
  'before January 1, 2026' and inserting 'before January 1, 2029'"
  (https://www.govinfo.gov/content/pkg/BILLS-119hr1834eh/html/BILLS-119hr1834eh.htm). Its latest action, on
  2026-02-10, reads "Read the second time. Placed on Senate Legislative Calendar under General Orders.
  Calendar No. 319." It lists no law (https://api.congress.gov/v3/bill/119/hr/1834).
- The www.congress.gov web pages answered HTTP 403 to this reader, so the key used congress.gov's own API
  and the govinfo bulk bill status (`BILLSTATUS-119hr1834.xml`) instead.

So the "law rules" apply to coverage in 2026 and 2027: the indexed table and the 400% cliff. The
"enhanced" rules are a what-if: the 2021-2025 table, with no cliff and an 8.5% cap.

### 1.2 The poverty line, and which year of it a coverage year uses

**Rule.** Income is measured as a percentage of the HHS poverty guideline for the family's size. The
guideline used is the latest one published on the first day of open enrollment, November 1 of the year
before coverage. HHS publishes each January, so **coverage year 2026 uses the 2025 guideline, and
coverage year 2027 uses the 2026 guideline.**

> "In the case of any qualified health plan offered through an Exchange for coverage during a taxable year
> beginning in a calendar year, the poverty line used shall be the most recently published poverty line as
> of the 1st day of the regular enrollment period for coverage during such calendar year." (36B(d)(3)(B))

> "Thus, the Federal poverty line for computing the premium tax credit for a taxable year is the Federal
> poverty line in effect on the first day of the initial or annual open enrollment period preceding that
> taxable year." (26 CFR 1.36B-1(h), https://www.ecfr.gov/current/title-26/section-1.36B-1, eCFR up to date
> as of 2026-10-29)

> Open enrollment "begins on November 1 of the calendar year preceding the benefit year" (benefit years
> 2022 through 2026), and "must begin no later than November 1" (2027 on). (45 CFR 155.410(e)(4)(i),
> (e)(5)(i), https://www.ecfr.gov/current/title-45/section-155.410)

The agencies confirm it. HealthCare.gov's glossary says "Income from the previous year is used to calculate
Marketplace savings for the next year" (https://www.healthcare.gov/glossary/federal-poverty-level-fpl/).
The IRS's 2025 Form 8962 instructions print the **2024** guideline ($15,060 for one person) for 2025
coverage (https://www.irs.gov/pub/irs-pdf/i8962.pdf, Table 1-1).

| Guideline (48 states and DC) | 1 person | each additional person | used for coverage year | source |
|---|---|---|---|---|
| 2024 | $15,060 | $5,380 | 2025 (check only) | 89 FR 2961 (Jan 17, 2024); Form 8962 instructions (2025) Table 1-1 |
| 2025 | $15,650 | $5,500 | **2026** | 90 FR 5917 (Jan 17, 2025), https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf |
| 2026 | $15,960 | $5,680 | **2027** | 91 FR 1797, table p.1798 (Jan 15, 2026), https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf; the ASPE page the same |

Family sizes 1 to 8 are listed in each notice, which says "For families/households with more than 8
persons, add $X for each additional person". The steps are equal from 1 to 8 as well, so guideline =
first person + step x (size - 1). `rules.py` also holds the Alaska and Hawaii tables. The page uses the
48 states and DC only.

### 1.3 The applicable-percentage tables

**Coverage year 2026.** The table comes from Rev. Proc. 2025-25, section 3.01, "Applicable Percentage Table
for 2026" (https://www.irs.gov/pub/irs-drop/rp-25-25.pdf):

| Household income, % of poverty line | Initial | Final |
|---|---|---|
| Less than 133% | 2.10% | 2.10% |
| At least 133% but less than 150% | 3.14% | 4.19% |
| At least 150% but less than 200% | 4.19% | 6.60% |
| At least 200% but less than 250% | 6.60% | 8.44% |
| At least 250% but less than 300% | 8.44% | 9.96% |
| At least 300% but not more than 400% | 9.96% | 9.96% |

"For plan years beginning in calendar year 2026, the Required Contribution Percentage ... is 9.96%" (s.3.02).
That figure is the affordability test for employer coverage, not part of this credit's math.

**Coverage year 2027 (published).** The table comes from Rev. Proc. 2026-26, section 3.01, with the same
row wording (https://www.irs.gov/pub/irs-drop/rp-26-26.pdf): 2.15/2.15; 3.23/4.3; 4.3/6.78; 6.78/8.66;
8.66/10.22; 10.22/10.22. The required contribution percentage is 10.22%.

**Enhanced (2021-2025, the what-if).** 36B(b)(3)(A)(iii)(II): "Up to 150.0 percent 0.0 0.0; 150.0 percent up
to 200.0 percent 0.0 2.0; 200.0 percent up to 250.0 percent 2.0 4.0; 250.0 percent up to 300.0 percent 4.0
6.0; 300.0 percent up to 400.0 percent 6.0 8.5; 400.0 percent and higher 8.5 8.5". This table is not
indexed: "(I) clause (ii) shall not apply".

**Base table** (as enacted; used only to check the regulation's examples): 2.0/2.0, 3.0/4.0, 4.0/6.3,
6.3/8.05, 8.05/9.5, 9.5/9.5 (36B(b)(3)(A)(i); 26 CFR 1.36B-3(g)(2)).

### 1.4 Straight line inside the band, rounded to 0.01 of a percentage point

**Rule.** Inside a band, the percentage rises in a straight line from the band's initial to its final
percentage. Then it is rounded to the nearest 0.01 of a percentage point:

    pct = initial + (final - initial) x (p - lower) / (upper - lower),   rounded to 0.01

Here p is household income as a percentage of the poverty line.

> "the applicable percentage for any taxpayer whose household income is within an income tier specified in
> the following table shall increase, on a sliding scale in a linear manner, from the initial premium
> percentage to the final premium percentage specified in such table for such income tier" (36B(b)(3)(A)(i))

> "An applicable percentage within an income category increases on a sliding scale in a linear manner and is
> rounded to the nearest one-hundredth of one percent." (26 CFR 1.36B-3(g)(1),
> https://www.ecfr.gov/current/title-26/section-1.36B-3)

The regulation's Example 2 shows the arithmetic: "210 − 200 = 10; 250 − 200 = 50; 10 / 50 = .20 ...
8.05−6.3 = 1.75 ... .20 × 1.75 = .35; 6.3 + .35 = 6.65." `check_tables()` reproduces both examples.

**Ties go up.** The regulation says only "nearest", but two sources decide the half-way case:
- Example 1 rounds 275% on the base table, which is exactly 8.775, to "8.78". That rules out truncation.
- The IRS's own Table 2 in the 2025 Form 8962 instructions turns 301% on the enhanced table (exactly 6.025%)
  into "0.0603". `check_tables()` rebuilds all 250 rows of that table, from 150 to 399. Half-up matches
  every row. Half-to-even misses 25 rows and truncation misses 50.

### 1.5 The contribution and the credit

**Rule.** The required contribution is the percentage times household income. The credit is the
benchmark premium minus that contribution, never below zero. It is also never more than the premium of
the plan actually bought.

> "the lesser of— (A) the monthly premiums for such month for 1 or more qualified health plans ... which
> cover the taxpayer ..., or (B) the excess (if any) of— (i) the adjusted monthly premium for such month for
> the applicable second lowest cost silver plan with respect to the taxpayer, over (ii) an amount equal to
> 1/12 of the product of the applicable percentage and the taxpayer's household income for the taxable year."
> (36B(b)(2))

> "The applicable percentage multiplied by a taxpayer's household income determines the taxpayer's annual
> required share of premiums for the benchmark plan. The required share is divided by 12 and this monthly
> amount is subtracted from the adjusted monthly premium" (1.36B-3(g)(1))

For twelve equal months, 12 x (monthly benchmark - contribution / 12) = annual benchmark - contribution.
The key therefore works with whole years.

### 1.6 Who qualifies: the 100% floor and the 400% cliff

> "The term 'applicable taxpayer' means, with respect to any taxable year, a taxpayer whose household income
> for the taxable year equals or exceeds 100 percent but does not exceed 400 percent of an amount equal to the
> poverty line for a family of the size involved." (36B(c)(1)(A))

> "an applicable taxpayer is a taxpayer whose household income is at least 100 percent but not more than 400
> percent of the Federal poverty line" (26 CFR 1.36B-2(b)(1), https://www.ecfr.gov/current/title-26/section-1.36B-2)

- **Exactly 400% gets the credit**, at the last band's rate: "not more than 400%" in both the regulation and
  Rev. Proc. 2025-25. One dollar above it gets nothing under the law rules. The Form 8962 worksheet agrees:
  "Is the amount on line 1 more than the amount on line 3 [4 x the guideline]? Yes ... Enter 401", and a
  line 5 over 400 is not eligible.
- **Under 100% gets nothing**, under both rule sets: the enhanced rules lifted only the top limit. There are
  exceptions, such as a Marketplace estimate made at enrollment (1.36B-2(b)(6)). The key does not model them.
- **Enhanced:** over 400%, the percentage stays at 8.5% ("400.0 percent and higher 8.5 8.5").

### 1.7 The benchmark: age factors from the federal default curve

**Rule (the page's formula).** The benchmark for a year is 12 x (the benchmark's monthly premium for a
40-year-old) / 1.278 x the sum of the age factors of the people covered. The factor 1.278 belongs to age
40 on the federal default curve.

> The adjusted monthly premium is "the premium an issuer would charge for the applicable benchmark plan to
> cover all members of the taxpayer's coverage family, adjusted only for the age of each member ... and may
> not include any adjustments for tobacco use." (1.36B-3(e); also 36B(b)(3)(C))

> "(1) Per-member rating. The total premium for family coverage must be determined by summing the premiums for
> each individual family member. With respect to family members under the age of 21, the premiums for no more
> than the three oldest covered children must be taken into account in determining the total family premium."
> (45 CFR 147.102(c)(1), https://www.ecfr.gov/current/title-45/section-147.102)

> "the enrollee's age as of the date of policy issuance or renewal must be used" (147.102(a)(1)(iii)). The age
> bands are "a single age band for individuals age 0 through 14", one-year bands for 15 through 63, and "a single
> age band for individuals age 64 and older" (147.102(d)). "If a State does not establish a uniform age rating
> curve ... a default uniform age rating curve specified in guidance by the Secretary ... will apply"
> (147.102(e)).

The federal default standard age curve comes from the CMS bulletin "Guidance Regarding Age Curves and State
Reporting" (Dec. 16, 2016), Appendix I, "effective for plan or policy years beginning in 2018 in any State
not specifying its own age curve"
(https://www.cms.gov/CCIIO/Resources/Regulations-and-Guidance/Downloads/Final-Guidance-Regarding-Age-Curves-and-State-Reporting-12-16-16.pdf):

| Age | Factor | Age | Factor | Age | Factor | Age | Factor |
|---|---|---|---|---|---|---|---|
| 0-14 | 0.765 | 27 | 1.048 | 40 | **1.278** | 53 | 2.040 |
| 15 | 0.833 | 28 | 1.087 | 41 | 1.302 | 54 | 2.135 |
| 16 | 0.859 | 29 | 1.119 | 42 | 1.325 | 55 | 2.230 |
| 17 | 0.885 | 30 | 1.135 | 43 | 1.357 | 56 | 2.333 |
| 18 | 0.913 | 31 | 1.159 | 44 | 1.397 | 57 | 2.437 |
| 19 | 0.941 | 32 | 1.183 | 45 | 1.444 | 58 | 2.548 |
| 20 | 0.970 | 33 | 1.198 | 46 | 1.500 | 59 | 2.603 |
| 21 | 1.000 | 34 | 1.214 | 47 | 1.563 | 60 | 2.714 |
| 22 | 1.000 | 35 | 1.222 | 48 | 1.635 | 61 | 2.810 |
| 23 | 1.000 | 36 | 1.230 | 49 | 1.706 | 62 | 2.873 |
| 24 | 1.000 | 37 | 1.238 | 50 | 1.786 | 63 | 2.952 |
| 25 | 1.004 | 38 | 1.246 | 51 | 1.865 | 64 and older | 3.000 |
| 26 | 1.024 | 39 | 1.262 | 52 | 1.952 | | |

CMS's "Market Rating Reforms" page (table "Updated December 10, 2021", page last modified 09/10/2024)
says "If a cell is blank or a state is not listed, the federal default applies." It lists these state
curves for the individual market: Alabama, District of Columbia, Massachusetts, Minnesota, Mississippi,
Oregon and Utah. New York and Vermont do not vary premiums by age (1:1). Note that DC is inside "48
states and DC".

**Children under 26.** A covered child of 21 to 25 is rated as an adult (factors 1.000 to 1.004) and always
counts. Among children **under 21**, only the three oldest count (147.102(c)(1)). `benchmark_annual(...,
child_cap=False)` gives the page's plain sum, for comparison.

### 1.8 A second track: the way Form 8962 rounds

The tax return does the same math in whole numbers. It is a legitimate second answer and can differ from
the exact one by a few dollars:
- the percentage of the poverty line: "Do not round; instead, multiply this number by 100 ... and then drop
  any numbers after the decimal point. For example, for 0.9984, enter the result as 99; for 1.8565, enter the
  result as 185" (Form 8962 instructions (2025), Worksheet 2);
- line 8a: "Multiply line 3 by line 7 ... rounded to the nearest whole dollar amount"; line 8b: "Divide line 8a
  by 12.0 ... rounded to the nearest whole dollar amount";
- "round the amounts on Form 1095-A to the nearest whole dollar" (the benchmark).

`premium_tax_credit(..., method='form')` follows these steps. **Unverified for 2026 and 2027:** the IRS has
not published those years' instructions yet. The key assumes the 2025 method carries over.

### 1.9 Conventions the key adopts where no source decides

| Question | Key's answer | Why |
|---|---|---|
| Rounding of the applicable percentage | nearest 0.01 point, ties up | 1.36B-3(g)(1); ties: Example 1 and the IRS Table 2 (section 1.4) |
| Percentage of the poverty line (main track) | exact: no rounding, no truncation | 1.36B-3(g)(1) says "the percentage that the taxpayer's household income bears to the Federal poverty line"; truncation is the form's track (1.8) |
| Rounding of the contribution and the credit (main track) | none until shown; the credit is shown to the cent, half up | no source says; exactness keeps the key independent of display |
| Ties in the form's "nearest whole dollar" | half up | no source says |
| Edge of a band | "at least" the lower line, "less than" the upper line | Rev. Proc. 2025-25 and 2026-26 row wording. It matters only at 133%, where 2.10% jumps to 3.14% in 2026 (2.15% to 3.23% in 2027); at 150, 200, 250 and 300 the next band starts where the last one ended |
| Exactly 400% | eligible, at 9.96% (2026) / 10.22% (2027) | "does not exceed 400 percent", "not more than 400%" |
| Over 400%, law | no credit (the cliff) | 36B(c)(1)(A) |
| Under 100% | no credit, both rule sets; `floor_100=False` turns this off for comparison | 36B(c)(1)(A); exceptions not modelled |
| Benchmark per-member rounding | none (exact B40 / 1.278 x factor) | no federal rule found |
| Credit cap at the plan bought | the key's credit is against the benchmark only, like the page; the cap is a recorded difference | 36B(b)(2)(A) |
| Enhanced rules for 2026+ | allowed as a what-if; the poverty guideline year is still the year before coverage | the page's toggle; the law ended them (1.1) |

---

## 2. Medicare: the income-related monthly adjustment amount (IRMAA), 2026

### 2.1 Income from two years before

> "the individual's modified adjusted gross income shall be such income determined for the individual's last
> taxable year beginning in the second calendar year preceding the year involved." (42 U.S.C.
> 1395r(i)(4)(B)(i), https://uscode.house.gov/us/usc/119-136/t42/s1395r/)

Social Security's manual applies it this way: "If MAGI in 2024 (or 2023 if 2024 is not available) was:" (POMS HI
01101.020, effective 12/02/2025, https://secure.ssa.gov/poms.nsf/lnx/0601101020). So **2026 premiums use
2024 income.** MAGI here is adjusted gross income plus tax-exempt interest, with the foreign-income
exclusions added back (1395r(i)(4)(A)). A joint return's MAGI applies to each spouse.

### 2.2 The tiers: which line counts as "at or under"

The statute shapes the tiers: "More than $85,000 but not more than $107,000: 35 percent; More than $107,000 but
not more than $133,500: 50 percent; More than $133,500 but not more than $160,000: 65 percent; More than
$160,000 but less than $500,000: 80 percent; At least $500,000: 85 percent" (1395r(i)(3)(C)(i)(III); the lower
lines are indexed and "rounded to the nearest multiple of $1,000", (i)(5)(B)). Joint returns use twice the
lines, except that the $500,000 line becomes 150% of itself ($750,000) ((i)(3)(C)(ii)). A married person
filing separately who lived with the spouse at any time in the year has every line reduced by the single
threshold ((i)(3)(C)(iii)). That leaves only $109,000 and $391,000 (= $500,000 - $109,000).

**So the tier is the first line the MAGI is at or under, except the next-to-top line, which is "less than".**
MAGI exactly $500,000 (single), $750,000 (joint) or $391,000 (separate) is in the **top** tier. The $500,000
line is not indexed until 2028 ((i)(5)(C)).

### 2.3 The 2026 table

From the CMS fact sheet "2026 Medicare Parts A & B Premiums and Deductibles" (Nov 14, 2025)
(https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles). The same figures
appear in CMS-8091-N, 90 FR 52063 (Nov 19, 2025), tables on p.52066
(https://www.govinfo.gov/content/pkg/FR-2025-11-19/pdf/2025-20251.pdf), and in POMS HI 01101.020 B.

"The standard monthly premium for Medicare Part B enrollees will be $202.90 for 2026."

| Single (also head of household, surviving spouse), MAGI 2024 | Joint, MAGI 2024 | Part B total | Part B over standard | Part D add-on |
|---|---|---|---|---|
| Less than or equal to $109,000 | Less than or equal to $218,000 | $202.90 | $0.00 | $0.00 |
| Greater than $109,000 and less than or equal to $137,000 | Greater than $218,000 and less than or equal to $274,000 | $284.10 | $81.20 | $14.50 |
| Greater than $137,000 and less than or equal to $171,000 | Greater than $274,000 and less than or equal to $342,000 | $405.80 | $202.90 | $37.50 |
| Greater than $171,000 and less than or equal to $205,000 | Greater than $342,000 and less than or equal to $410,000 | $527.50 | $324.60 | $60.40 |
| Greater than $205,000 and less than $500,000 | Greater than $410,000 and less than $750,000 | $649.20 | $446.30 | $83.30 |
| Greater than or equal to $500,000 | Greater than or equal to $750,000 | $689.90 | $487.00 | $91.00 |

Married filing separately, having lived with the spouse at any time during the year: "Less than or equal to
$109,000" $202.90 / $0.00 / $0.00; "Greater than $109,000 and less than $391,000" $649.20 / $446.30 / $83.30;
"Greater than or equal to $391,000" $689.90 / $487.00 / $91.00. Someone filing separately who lived apart
all year uses the single column (1395r(i)(3)(C)(iii)(II); POMS B, note).

**The published amounts rebuild from the statute** (`check_tables()`):
- The Federal Register notice says "The monthly actuarial rates for 2026 are $405.40 for aged enrollees". The
  standard premium is "50 percent of the monthly actuarial rate for aged enrollees ... plus the $0.20 repayment
  amount". A surcharge tier pays "about 35, 50, 65, 80, or 85 percent of the total cost ... plus a repayment
  amount of $0.30, $0.40, $0.50, $0.60, or $0.70". The statute rounds "to the nearest multiple of 10 cents"
  (1395r(a)(3)). Rebuilt: 0.35 x 810.80 + 0.30 = 284.08, which rounds to 284.10, and so on for every tier.
- Part D: "(applicable percentage − 25.5 percent) / 25.5 percent x the base beneficiary premium"
  (1395w-113(a)(7)(B)). CMS: "For 2026, the base beneficiary premium will be $38.99". Rebuilt: 38.99 x
  9.5/25.5 = 14.53, which shows as 14.50; 37.46 → 37.50; 60.40; 83.33 → 83.30; 90.98 → 91.00. These match
  only with rounding to the nearest 10 cents. **Unverified:** the Part D rounding rule itself was not found in
  the statute text read.

### 2.4 The surcharge a year (the page's formula)

    surcharge = (Part B over the standard + the Part D add-on) x 12 x people on Medicare

Each spouse enrolled in Medicare pays the amount set by the joint MAGI. The Part D add-on applies only to
someone in a Part D plan or a Medicare Advantage plan with drug coverage (1395w-113(a)(7)(A)). The key's
`part_d=False` drops it.

### 2.5 2027

**Not published as of 2026-10-31.** The CMS fact-sheet address for 2027 answered 404, and the Federal
Register API showed no Part B notice for 2027. CMS normally publishes in mid-November. CMS has published
the 2027 Part D base beneficiary premium, $41.33 ("Medicare Part D 2027 National Average Monthly Bid Amount
Information", Jul 28, 2026). It has not published the 2027 income lines, the Part B premium or the 2027
Part D add-ons. The key carries **no 2027 IRMAA table**. Figures on other websites are projections.

### 2.6 Conventions

| Question | Key's answer | Why |
|---|---|---|
| MAGI exactly on a "less than or equal" line | stays in the lower tier | the fact sheet and statute wording |
| MAGI exactly $500,000 / $750,000 / $391,000 | top tier | "less than $500,000", "Greater than or equal to $500,000"; `at_or_under=True` gives a literal "at or under" reading |
| Head of household, surviving spouse, separate-and-apart | single column | POMS B.1; 1395r(i)(3)(C)(iii) |
| Rounding | none: published amounts are exact to 10 cents; the year's total is exact to the cent | no further step needed |

---

## 3. High-deductible plans and health savings accounts (26 U.S.C. 223)

### 3.1 Out of pocket for the year (the page's own model)

    out of pocket(m) = min(oopMax, min(m, deductible) + coinsurance x max(0, m − deductible))

The member pays the bills in full up to the deductible, then the coinsurance share of the rest, and never
more than the out-of-pocket maximum in all. **No law fixes this shape.** Real plans add copays, separate drug
deductibles, embedded family deductibles and network rules. The statute only limits "the sum of the annual
deductible and the other annual out-of-pocket expenses required to be paid under the plan (other than for
premiums)" (223(c)(2)(A)(ii)). The key computes it exactly. Coinsurance is the member's share, so 0.2 means
20%.

### 3.2 What counts as a high-deductible plan (HSA eligibility)

> "a health plan— (i) which has an annual deductible which is not less than— (I) $1,000 for self-only coverage,
> and (II) twice the dollar amount in subclause (I) for family coverage, and (ii) the sum of the annual deductible
> and the other annual out-of-pocket expenses ... does not exceed— (I) $5,000 for self-only coverage, and (II)
> twice the dollar amount in subclause (I) for family coverage." (223(c)(2)(A),
> https://uscode.house.gov/us/usc/119-136/t26/s223/; indexed under (g), increases "rounded to the nearest
> multiple of $50")

| Year | Minimum deductible, self-only / family | Maximum out of pocket, self-only / family | Source |
|---|---|---|---|
| 2026 | $1,700 / $3,400 | $8,500 / $17,000 | Rev. Proc. 2025-19 s.2.01(2), https://www.irs.gov/pub/irs-drop/rp-25-19.pdf; Pub. 969 (2025) table |
| 2027 | $1,750 / $3,500 | $8,700 / $17,400 | Rev. Proc. 2026-24 s.3.01(3), https://www.irs.gov/pub/irs-drop/rp-26-24.pdf |

**Both lines are inclusive.** A deductible exactly at the minimum qualifies ("not less than"), and an
out-of-pocket maximum exactly at the limit qualifies ("does not exceed").

Two further rules the page may not have:
- **A family plan with a low individual deductible fails.** "If either the deductible for the family as a whole
  or the deductible for an individual family member is less than the minimum annual deductible for family
  coverage, the plan doesn't qualify as an HDHP." (IRS Pub. 969 (2025), https://www.irs.gov/publications/p969)
- **From 2026, Marketplace bronze and catastrophic plans count as HDHPs** whatever their numbers. The term
  "shall include any plan which is— (i) available as individual coverage through an Exchange ... and (ii)
  described in subsection (d)(1)(A) or (e) of section 1302" (223(c)(2)(H), added by Pub. L. 119-21
  s.71307, "months beginning after December 31, 2025").

### 3.3 HSA contribution limits

| Year | Self-only | Family | Source |
|---|---|---|---|
| 2026 | $4,400 | $8,750 | Rev. Proc. 2025-19 s.2.01(1); Pub. 969 "For 2026 ... up to $4,400 ... up to $8,750" |
| 2027 | $4,500 | $9,000 | Rev. Proc. 2026-24 s.3.01(1) |

At age 55 or older, add $1,000: "2009 and thereafter $1,000" (223(b)(3)(B)). This amount is not indexed,
because (g)(1) names only (b)(2), (c)(2)(A) and (c)(1)(E). The limit is figured month by month, "1/12
of" the annual amount for each month the person is eligible on the first day (223(b)(1)-(2)), with a
last-month rule ((b)(8)). `hsa_limit(..., months=)` prorates. The last-month rule is not modelled.

### 3.4 Conventions

| Question | Key's answer | Why |
|---|---|---|
| Bills at exactly the deductible | out of pocket = the deductible | the formula is continuous there |
| oopMax below the deductible | the formula still caps at oopMax | the page's formula; a real plan's out-of-pocket maximum includes the deductible, so the case should not arise |
| Coinsurance outside 0 to 1, or negative bills | refused (ValueError) | not a plan |
| Eligibility lines | inclusive on both | "not less than", "does not exceed" |

---

## 4. Worked examples (invented households)

### 4.1 Marketplace, coverage year 2026

Two adults aged 45 and 43 live in one of the 48 states. Household income is $50,000, and the benchmark
plan costs $500 a month for a 40-year-old.

1. Benchmark: factors 1.444 + 1.357 = 2.801. Then 12 x 500 / 1.278 x 2.801 = 6,000 x 2.801 / 1.278 =
   **$13,150.23** a year (6,779.34 for the 45-year-old plus 6,370.89 for the 43-year-old).
2. Poverty line: coverage year 2026 uses the 2025 guideline, which for 2 people is $15,650 + $5,500 = **$21,150**.
3. Income as a percentage of the poverty line: 50,000 / 21,150 = 2.364066, or **236.4066%**. That is in
   the band "at least 200% but less than 250%", which runs from 6.60% to 8.44%.
4. Applicable percentage: (236.4066 − 200) / 50 = 0.728132, and 6.60 + 0.728132 x 1.84 = 7.939764, which
   rounds to **7.94%**.
5. Contribution: 7.94% x 50,000 = **$3,970.00**.
6. Credit: 13,150.23 − 3,970.00 = **$9,180.23** a year.

**Enhanced what-if.** The band runs from 2.0% to 4.0%: 2.0 + 0.728132 x 2.0 = 3.456265, which rounds to
3.46%. The contribution is $1,730.00 and the credit **$11,420.23**.

**Form 8962 track.** Line 5 is 236 (decimals dropped), so the percentage is 6.60 + 36/50 x 1.84 = 7.9248,
which rounds to 7.92%. Line 8a is 50,000 x 0.0792 = $3,960, line 8b is $330 a month, and the benchmark
rounds to $13,150. The credit is **$9,190**, $9.77 more than the exact track, all because the decimals of
236.4066 were dropped.

**The cliff.** At $90,000 the same household is at 425.5319%. Under the law rules the credit is **$0**.
Under the enhanced rules it is 13,150.23 − 8.5% x 90,000 (7,650) = **$5,500.23**. At exactly $84,600
(4 x 21,150) the law still allows the credit at 9.96%. At $84,601 the credit is $0.

**Coverage year 2027** (2026 guideline, Rev. Proc. 2026-26). The poverty line for 2 is $21,640, and
50,000 / 21,640 is 231.0536%. The percentage is 6.78 + 0.621072 x 1.88 = 7.9476, which rounds to 7.95%.
The contribution is $3,975.00 and the credit $9,175.23.

**The three-child cap.** Add four children aged 3, 7, 12 and 16. Only the 16-, 12- and 7-year-olds count
(0.859 + 0.765 + 0.765), so the benchmark is $24,366.20. The page's plain sum, counting all four, gives
$27,957.75.

### 4.2 Medicare, 2026

A married couple files jointly and both are on Medicare. Their 2024 MAGI was $300,000, which is "greater
than $274,000 and less than or equal to $342,000". Part B is $405.80, which is $202.90 over the standard
premium, and the Part D add-on is $37.50.
Surcharge = (202.90 + 37.50) x 12 x 2 = 240.40 x 24 = **$5,769.60** a year.

**Edge.** A single person's MAGI is exactly $500,000. The law puts that in the top tier: (487.00 + 91.00) x 12 =
**$6,936.00**. Reading "the first line at or under" literally, with $500,000 as a line, gives the tier below:
(446.30 + 83.30) x 12 = $6,355.20. (The page itself stores the line as $499,999.99 inclusive, so it gives the law's
$6,936.00.)

### 4.3 High-deductible plan, 2026

A self-only plan has a $3,000 deductible, 20% coinsurance and a $6,000 out-of-pocket maximum.

| Bills m | min(m, 3,000) | 20% x (m − 3,000) | Sum | Out of pocket |
|---|---|---|---|---|
| 2,000 | 2,000 | 0 | 2,000 | **2,000** |
| 10,000 | 3,000 | 1,400 | 4,400 | **4,400** |
| 18,000 | 3,000 | 3,000 | 6,000 | **6,000** (cap just reached) |
| 30,000 | 3,000 | 5,400 | 8,400 | **6,000** |

HSA: $3,000 ≥ $1,700 and $6,000 ≤ $8,500, so the plan **qualifies** in 2026. The limit is $4,400, or $5,400
at 55 or older, and six eligible months give $2,200. The same numbers sold as **family** coverage do not
qualify, because $3,000 is under the $3,400 family minimum.

---

## 5. Where the page's model and the law differ (to record, not to "fix" in the key)

1. **IRMAA top tier.** MAGI exactly $500,000 (single), $750,000 (joint) or $391,000 (separate) is the top tier
   by law. "The first line it is at or under", read with $500,000 as a line, puts it one tier lower. (Checked
   against the page on 2026-10-31: it stores $499,999.99 / $749,999.99 / $390,999.99 inclusive, so it follows the
   law here.)
2. **Three oldest children under 21.** The law counts at most three children under 21 in the family premium
   (45 CFR 147.102(c)(1)). A plain sum of every child's factor overstates the benchmark for families with four
   or more children under 21. (The page summed every child until 2026-10-31; it now counts the three oldest.)
3. **State age curves.** Seven individual markets use their own curves (AL, DC, MA, MN, MS, OR, UT), and NY and
   VT do not rate by age at all. The federal default curve is the law only elsewhere.
4. **Credit cap at the premium paid.** The credit is the lesser of the chosen plan's premium and benchmark minus
   contribution (36B(b)(2)). A credit computed against the benchmark alone can exceed what a cheap plan costs.
5. **Under 100% of the poverty line.** There is no credit under either rule set, apart from narrow
   exceptions. A straight-line formula would give the full benchmark minus 2.10% of income. (The page did until
   2026-10-31; it now gives no credit there, under either rule set.)
6. **Enhanced rules.** These are law only for 2021-2025. For 2026 and 2027 they are a what-if (section 1.1).
7. **Part D add-on** applies only to people with drug coverage through Medicare.
8. **HSA eligibility.** The embedded-deductible rule for family plans and the 2026 bronze/catastrophic rule
   are law that a two-number test (deductible, out-of-pocket maximum) does not see.
9. **Form 8962 rounding.** The tax return drops the decimals of the percentage and works in whole dollars,
   so the IRS's final number can differ from the exact one by a few dollars (example 4.1: $9.77).

## 6. What could not be verified

- The 2026 and 2027 Form 8962 instructions are not published. The form track assumes the 2025 method.
- **2027 Medicare IRMAA** (income lines, Part B premium, Part D add-ons): not published by 2026-10-31.
- The rounding rule for the Part D add-on: not found in the statute read. The nearest 10 cents reproduces
  all five 2026 amounts.
- Rounding of the contribution and credit (main track), ties in the form's whole dollars, and per-member
  premium rounding: no source found. See the conventions above.
- That CMS has not replaced the 2016 default age curve: the CMS page (modified 2024) still points to the
  federal default, and no later curve was found. This was not otherwise confirmed.
- www.congress.gov itself answered HTTP 403. The congress.gov API and govinfo were used for the same records.

## 7. Sources (all read 2026-10-31)

| Tag | Source | Address | sha256 of the copy read |
|---|---|---|---|
| USC36B | 26 U.S.C. 36B, OLRC, current through Pub. L. 119-136 (Oct 22, 2026) | https://uscode.house.gov/us/usc/119-136/t26/s36B/ | 5617d507...1224dc547e |
| USC223 | 26 U.S.C. 223, same edition | https://uscode.house.gov/us/usc/119-136/t26/s223/ | b7b5bdd4...b9d6f0bd15 |
| USC1395R | 42 U.S.C. 1395r, same edition | https://uscode.house.gov/us/usc/119-136/t42/s1395r/ | e34851a3...fac933520b |
| USC1395W | 42 U.S.C. 1395w-113, same edition | https://uscode.house.gov/us/usc/119-136/t42/s1395w-113/ | 049ff49c...cd43c30f73 |
| CGLAWS | congress.gov API, laws of the 119th Congress (last: Pub. L. 119-136) | https://api.congress.gov/v3/law/119 | 1407c847...b66c4aa63d |
| CGHR1834 | congress.gov API, H.R. 1834 (latest action 2026-02-10, Senate calendar) | https://api.congress.gov/v3/bill/119/hr/1834 | 84c21043...8ca031cbb8 |
| GPOHR1834 | H.R. 1834 Engrossed in House (Jan 8, 2026), s.1 extension to 2028 | https://www.govinfo.gov/content/pkg/BILLS-119hr1834eh/html/BILLS-119hr1834eh.htm | da963879...17ca0a6d9b |
| GPOPLAW | govinfo public and private laws feed | https://www.govinfo.gov/rss/plaw.xml | f42ed9ba...bc46bd2005 |
| CFR36B1 | 26 CFR 1.36B-1(h), eCFR as of 2026-10-29 | https://www.ecfr.gov/current/title-26/section-1.36B-1 | 50b71def...1beccca243 |
| CFR36B2 | 26 CFR 1.36B-2(b), same | https://www.ecfr.gov/current/title-26/section-1.36B-2 | fd093df9...3485fe2688 |
| CFR36B3 | 26 CFR 1.36B-3(e), (g), same | https://www.ecfr.gov/current/title-26/section-1.36B-3 | 5f7d92eb...fb025773a6 |
| CFR147 | 45 CFR 147.102, eCFR as of 2026-10-29 | https://www.ecfr.gov/current/title-45/section-147.102 | 1648980c...a3f4f2b18d |
| CFR155 | 45 CFR 155.410(e), same | https://www.ecfr.gov/current/title-45/section-155.410 | 865539c4...89531c1655 |
| RP2525 | Rev. Proc. 2025-25 (2026 table) | https://www.irs.gov/pub/irs-drop/rp-25-25.pdf | ba950034...0fb6b67697 |
| RP2626 | Rev. Proc. 2026-26 (2027 table) | https://www.irs.gov/pub/irs-drop/rp-26-26.pdf | b3ce6c8c...09e727ed60 |
| I8962 | Instructions for Form 8962 (2025) | https://www.irs.gov/pub/irs-pdf/i8962.pdf | f4ac86ad...10e07bf9a2 |
| PG24 | HHS poverty guidelines, 89 FR 2961 | https://www.govinfo.gov/content/pkg/FR-2024-01-17/pdf/2024-00796.pdf | 9bf6ec5b...d33a9a01fb |
| PG25 | HHS poverty guidelines, 90 FR 5917 | https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf | a239506c...92ee2cebce |
| PG26 | HHS poverty guidelines, 91 FR 1797 | https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf | 67f71197...64d2d0f339 |
| ASPE | ASPE poverty guidelines page | https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines | 7e54b7fd...91766937f4 |
| HCGOV | HealthCare.gov glossary, federal poverty level | https://www.healthcare.gov/glossary/federal-poverty-level-fpl/ | d378b47d...c48a717e67 |
| CMSAGE | CMS age-curve bulletin (Dec 16, 2016), Appendix I | https://www.cms.gov/CCIIO/Resources/Regulations-and-Guidance/Downloads/Final-Guidance-Regarding-Age-Curves-and-State-Reporting-12-16-16.pdf | 5563e6d8...60eacfc060 |
| CMSRATE | CMS Market Rating Reforms (state variations) | https://www.cms.gov/cciio/programs-and-initiatives/health-insurance-market-reforms/state-rating | 37ba1304...eac301860e |
| CMSFS26 | CMS fact sheet, 2026 Parts A & B (Nov 14, 2025) | https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles | 6583dbf5...ad9871c7f7 |
| FRB26 | CMS-8091-N, 90 FR 52063 (Nov 19, 2025) | https://www.govinfo.gov/content/pkg/FR-2025-11-19/pdf/2025-20251.pdf | b1c6d7ba...f72770a7bc |
| POMS | SSA POMS HI 01101.020 (TN 36, 12/02/2025) | https://secure.ssa.gov/poms.nsf/lnx/0601101020 | 3b90e472...a3d501f848 |
| CMSD26 | CMS fact sheet, 2026 Part D bid information (Jul 28, 2025) | https://www.cms.gov/newsroom/fact-sheets/2026-medicare-part-d-bid-information-and-part-d-premium-stabilization-demonstration-parameters | 3357e92d...2b0f2e3253 |
| CMSD27 | CMS fact sheet, Part D 2027 bid information (Jul 28, 2026) | https://www.cms.gov/newsroom/fact-sheets/medicare-part-d-2027-national-average-monthly-bid-amount-information | e6607c5b...11565bbaa6 |
| RP2519 | Rev. Proc. 2025-19 (2026 HSA / HDHP) | https://www.irs.gov/pub/irs-drop/rp-25-19.pdf | ff2ba4ba...c11da35bf4 |
| RP2624 | Rev. Proc. 2026-24 (2027 HSA / HDHP) | https://www.irs.gov/pub/irs-drop/rp-26-24.pdf | bcb6b41a...f45afcb715 |
| P969 | IRS Pub. 969 (2025), last reviewed 30-Apr-2026 | https://www.irs.gov/publications/p969 | be786dac...40897122a5 |
