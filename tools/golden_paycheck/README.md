# Paycheck answer keys: federal income tax withholding, Social Security and Medicare

Two independent answer keys for the paycheck page (2026):

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `withholding_key.py` | `tests/golden/paycheck/withholding.csv` | 3,000 | federal income tax withheld from one paycheck, Pub. 15-T (2026) Worksheet 1A (the percentage method for automated payroll systems, Form W-4 from 2020 or later) |
| `payroll_key.py` | `tests/golden/paycheck/payroll.csv` | 1,500 | one job paying the same every paycheck: the year's Social Security and Medicare withheld, the last paycheck with Social Security, the first paycheck with the 0.9% Additional Medicare Tax |

`rules.py` holds every figure as data, with its source and the date it was read on the same line.
`tests/golden/paycheck/RULES.md` works three rows of each CSV by hand.

**Independence.** These scripts were written from IRS publications only: Pub. 15-T, Pub. 15,
the IRS Additional Medicare Tax Q&A, and Rev. Proc. 2025-32. Nobody opened `modules/`, `core/` or
`tests/*.test.mjs` while writing them, and they never import or run the app. The only things taken
from `tools/golden_business/` and `tools/golden_career/` are their layout and conventions; no figure
or code is shared. Each script computes every row a second way and stops without writing if the
two disagree.

## Run

```
python3 tools/golden_paycheck/withholding_key.py
python3 tools/golden_paycheck/payroll_key.py
```

Python 3 standard library only (made with 3.13). The runs are deterministic
(`random.Random(20261110)` for withholding, `random.Random(20261111)` for payroll), so a second
run writes byte-identical files. The scripts set `sys.dont_write_bytecode`, so no `__pycache__`
lands in the repo. Each run prints its coverage. Importing `rules.py` runs its table checks.

## Sources (all downloaded from irs.gov and read on 2026-10-30)

| Tag | Source | URL | Used for |
|---|---|---|---|
| P15T | Publication 15-T (2026), *Federal Income Tax Withholding Methods*, dated Dec 3, 2025 (71 pages, sha256 `31b3e242...d9d306d3fb`) | https://www.irs.gov/pub/irs-pdf/p15t.pdf | p.9 "Rounding"; p.10 Worksheet 1A and Table 3; p.12 the annual tables; p.57 Worksheet 4; pp.58-62 the per-period tables |
| P15 | Publication 15 (2026), *(Circular E) Employer's Tax Guide*, dated Dec 15, 2025 (59 pages, sha256 `b46c3622...f804c88b`) | https://www.irs.gov/pub/irs-pdf/p15.pdf | pp.1-2 What's New; p.29 section 9 "Tax rates and the social security wage base limit"; pp.29-30 section 9 "Additional Medicare Tax withholding"; pp.40-41 section 13 "fractions-of-cents" |
| ADMT | IRS *Questions and Answers for the Additional Medicare Tax* (page last reviewed 25-Oct-2026), question "Will Additional Medicare Tax be withheld from an individual's wages?" | https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax | the employer withholds above 200,000 "without regard to the individual's filing status or wages paid by another employer" |
| RP25 | Rev. Proc. 2025-32 (tax year 2026), s.4.01 Tables 1-3 (rate schedules) and s.4.14(1) (standard deduction) (sha256 `e9ada115...a96214635b`) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | only the second ways: the annual tables rebuilt from the law |

## Figures

| Figure | 2026 | Source |
|---|---|---|
| Worksheet 1A line 1g (Step 2 box not checked) | 12,900 married filing jointly; 8,600 otherwise (single, married filing separately, head of household). 0 when the box is checked | P15T p.10, Worksheet 1A line 1g |
| Pay periods (line 1b) | 2, 4, 12, 24, 26, 52, 260 | P15T p.10, Table 3 |
| STANDARD annual table, married filing jointly | 0 / 19,300 10% / 44,100 12% (C 2,480) / 120,100 22% (11,600) / 230,700 24% (35,932) / 422,850 32% (82,048) / 531,750 35% (116,896) / 788,000 37% (206,583.50) | P15T p.12 |
| STANDARD, single or married filing separately | 0 / 7,500 10% / 19,900 12% (1,240) / 57,900 22% (5,800) / 113,200 24% (17,966) / 209,275 32% (41,024) / 263,725 35% (58,448) / 648,100 37% (192,979.25) | P15T p.12 |
| STANDARD, head of household | 0 / 15,550 10% / 33,250 12% (1,770) / 83,000 22% (7,740) / 121,250 24% (16,155) / 217,300 32% (39,207) / 271,750 35% (56,631) / 656,150 37% (191,171) | P15T p.12 |
| Step 2 Checkbox annual table, married filing jointly | 0 / 16,100 10% / 28,500 12% (1,240) / 66,500 22% (5,800) / 121,800 24% (17,966) / 217,875 32% (41,024) / 272,325 35% (58,448) / 400,450 37% (103,291.75) | P15T p.12 |
| Step 2 Checkbox, single or married filing separately | 0 / 8,050 10% / 14,250 12% (620) / 33,250 22% (2,900) / 60,900 24% (8,983) / 108,938 32% (20,512) / 136,163 35% (29,224) / 328,350 37% (96,489.63) | P15T p.12 |
| Step 2 Checkbox, head of household | 0 / 12,075 10% / 20,925 12% (885) / 45,800 22% (3,870) / 64,925 24% (8,077.50) / 112,950 32% (19,603.50) / 140,175 35% (28,315.50) / 332,375 37% (95,585.50) | P15T p.12 |
| Per-period tables (weekly, biweekly, semimonthly, monthly, daily) | 30 tables of 8 rows, in `rules.PERIOD` | P15T pp.58-62 (third check only) |
| Social Security rate (employee) | 6.2% | P15 p.29 ("6.2% (amount withheld) each for the employer and employee"); p.1-2 What's New |
| Social Security wage base | 184,500 | P15 p.29 ("The social security wage base limit is $184,500"); pp.1-2 What's New (6.2% on p.1, the base on p.2) |
| Medicare rate (employee) | 1.45%, no wage base | P15 p.29 |
| Additional Medicare Tax | 0.9% of wages paid above 200,000 in the calendar year, withheld from the pay period in which wages pass 200,000, whatever the filing status | P15 pp.29-30 ("in excess of $200,000 in a calendar year"; "begin withholding ... in the pay period in which you pay wages in excess of $200,000"); ADMT |
| 2026 rate schedules and standard deductions | married jointly 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700; head of household 17,700 / 67,450 / 105,700 / 201,750 / 256,200 / 640,600; single 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600; deductions 32,200 / 24,150 / 16,100 | RP25 s.4.01 Tables 1-3, s.4.14(1) (second ways only) |

In each table row the figure before the slash is column A (at least), then column D, then column C
in parentheses. Column B is the next row's A. Column E equals A on every printed row.

`rules.py` checks itself when it loads:

- every annual table starts at 0 with C = 0 and D = 0%, B equals the next row's A, and the rates
  rise;
- every annual table is rebuilt from RP25. The STANDARD table is the 2026 schedule shifted by
  (standard deduction - line 1g), with the Rev. Proc. bases as C. The checkbox table is half the
  schedule shifted by half the standard deduction, with half the bases as C. The rebuilt tables
  must match the printed ones figure for figure. Two printed starts are rounded half up to the
  dollar (108,937.50 to 108,938 and 136,162.50 to 136,163), and one C is rounded half up to the
  cent (96,489.625 to 96,489.63). All three are in the single checkbox table;
- line 1g + the STANDARD table's first taxed dollar = the standard deduction (19,300 + 12,900 =
  32,200; 7,500 + 8,600 = 16,100; 15,550 + 8,600 = 24,150). Twice the checkbox table's first taxed
  dollar = the standard deduction;
- every per-period start is the annual start (+ line 1g on the STANDARD tables) / pay periods,
  rounded to the dollar (to the dime in the daily table). Every per-period C is the running sum
  of rate x width on those rounded starts, to the cent.

**The printed single checkbox table is not continuous.** Because of that rounding, its C at
108,938 is 20,512.00, but the row below reaches 20,512.12 there (8,983 + 24% x 48,038). At 328,350,
C is 96,489.63 against 96,489.45 from the row below. `rules.TABLE_JUMPS` lists both. This key
follows the printed table literally, so a paycheck one cent below 108,938 has 0.12 more tentative
tax a year than one at 108,938 (see `wh-edge-079` and `wh-edge-081` in RULES.md). Any method that
sums rate bands, or works from the brackets, misses both jumps. On the single checkbox table it
differs from the key by up to $0.18 a year, which can move a paycheck's cent.

## Withholding key (`withholding_key.py`)

### How each row is worked (derivation 1, Worksheet 1A literally)

Columns are in brackets.

1. **Step 1.** 1a = wages this paycheck [`wages`]. 1b = pay periods [`paychecks`]. 1c = 1a x 1b.
   1d = Step 4(a), other income, annual [`step4a_other`]. 1e = 1c + 1d. 1f = Step 4(b),
   deductions, annual [`step4b_deductions`]. 1g = 12,900 if married filing jointly, else 8,600,
   but 0 if the Step 2 box is checked [`step2` = 1]. 1h = 1f + 1g. 1i = 1e - 1h, or 0 if that is
   zero or less [`adjusted_annual`].
2. **Step 2.** The table is STANDARD if the box is not checked, or Step 2 Checkbox if it is, for
   the filing status [`w4_status`]. Use the row with A <= 1i < B (the last row has no B).
   2b = A, 2c = C, 2d = D. 2e = 1i - 2b. 2f = 2e x 2d. 2g = 2c + 2f [`tentative_annual`, the
   tentative annual withholding]. 2h = 2g / 1b.
3. **Step 3.** 3a = Step 3 credits, annual [`step3_credits`]. 3b = 3a / 1b. 3c = 2h - 3b, or 0 if
   that is zero or less.
4. **Step 4.** 4a = Step 4(c), extra withholding per paycheck [`step4c_extra`].
   4b = 3c + 4a [`withholding`].

`w4_status` `single` is the Form W-4 box "Single or Married filing separately". The key covers
Forms W-4 from 2020 or later only (lines 1j-1l and the 2019 W-4 are not used). It uses no
nonresident alien additions (P15T Tables 1-2).

### Rounding

- **What Pub. 15-T allows** (P15T p.9, "Rounding"): "you may reduce the last digit of the wages
  to zero, or figure the wages to the nearest dollar. You may also round the tax for the pay
  period to the nearest dollar. If rounding is used, it must be used consistently. Withheld tax
  amounts should be rounded to the nearest whole dollar by dropping amounts under 50 cents and
  increasing amounts from 50 to 99 cents to the next dollar." Worksheet 1A itself says nothing
  about rounding lines 2h, 3b or 3c.
- **What this key does.** It never rounds to whole dollars: not the wages, and not the tax.
  Nothing is rounded until a value is written. Each column is then rounded half up to the cent
  on its own:
  - `adjusted_annual` is always whole cents;
  - `tentative_annual` is line 2g, which can carry 4 decimals;
  - `withholding` is line 4b, figured from the unrounded 2g, 2h and 3b.

  The arithmetic is `Decimal` at 60 digits. Line 4b is then snapped to its exact grid (a multiple
  of 1 / (10,000 x pay periods)), so a value that sits exactly on a half cent rounds up exactly.
- A payroll that rounds to dollars, as Pub. 15-T allows, can differ from `withholding` by up to
  50 cents (more if it also rounds the wages). Compare with a tolerance in that case.
- A payroll that rounds 2h and 3b to the cent before subtracting can differ by 1 cent. That
  happens on 151 rows; the key asserts it is never more. Example: `wh-0001` gives 36.31 instead of
  36.30.
- 21 rows sit exactly on a half cent, for example `wh-0405` at 112.745, which the key writes as
  112.75. A binary float with `Math.round(x * 100) / 100` may give 112.74 on such rows.

### The other ways, run on every row before the CSV is written

2. **An exact second implementation** must agree exactly on 1i, the table row, 2g and 4b, before
   any rounding. It differs from derivation 1 in four ways:
   - it works in `fractions.Fraction`;
   - its tables are rebuilt from RP25 and line 1g (`rules.statute_tables()`), not the
     transcribed ones;
   - it finds the row by bisection;
   - it rearranges the steps as max(0, (2g - 3a) / 1b) + 4a.

   It agrees on all 3,000 rows.
3. **The law without the table** must equal 2g exactly, except on the single checkbox table. The
   law is the RP25 schedule summed band by band: the tax on (1c + 4(a) - 4(b) - the standard
   deduction), or half the tax on twice (1c + 4(a) - 4(b) - half the standard deduction) with the
   box checked. On the single checkbox table at or above 108,937.50, Pub. 15-T printed rounded
   figures, so there it must stay within $0.175 a year. It is exact on 2,872 rows. The 128 rows
   on the single checkbox table at or above 108,937.50 differ by at most $0.175 a year.
4. **Worksheet 4 with the per-period tables** (P15T pp.58-62; p.57 is Worksheet 4) covers weekly, biweekly,
   semimonthly, monthly and daily pay: 2,576 rows. It must stay within the bound its rounding
   allows. Each per-period start is a rounded annual start, so the two tentative amounts can
   drift by:
   - the sum over rows of (rate step x start shift);
   - plus the annual table's jumps / pay periods;
   - plus half a cent.

   The bound is 0.013-0.018 a paycheck daily and 0.07-0.14 otherwise. The largest drift seen is
   0.0131 (daily), 0.0563 (weekly), 0.0954 (biweekly), 0.0938 (semimonthly) and 0.0667 (monthly).
   Worksheet 4 is an alternative IRS method, so it gives slightly different cents; the CSV is
   Worksheet 1A.

### The generator

- 288 edge rows (`wh-edge-001` to `wh-edge-288`). Each one puts 1e - 1h exactly at a table row's
  start, one cent below it, or one cent above. That covers every row of every table: 3 statuses
  x 2 checkbox states x 8 rows x 3 offsets. Each combination appears twice:
  - once with an empty W-4 (pay periods chosen so the wages divide exactly when they can), except the three
    box-checked rows one cent below 0 (`wh-edge-049`, `-145`, `-241`), which carry Step 4(b) = 1,000 since line 1g is 0
    when the box is checked;
  - once with random W-4 entries.

  Wages are whole cents, so the remainder (under n cents) goes into Step 4(a). That is why
  184 rows have a Step 4(a) with cents. At the 0 start, "one cent below" means 1e - 1h = -0.01,
  so 1i floors to 0.
- 2,712 random rows (`wh-0001` to `wh-2712`):
  - Filing status uniform. Box checked in 35%.
  - Pay periods: 52 (22%), 26 (22%), 24 (18%), 12 (18%), 260 (8%), 4, 2 and 1 (4% each).
  - Wages per paycheck: 1.5% are 0. 3.5% are tiny (0.01 to 50.00). The rest are log-uniform from
    6,000 a year / pay periods (at most 5,000) to 40,000 a paycheck.
  - Step 3: 0 in 55%, else a multiple of 500 up to 8,000.
  - Step 4(a): 0 in 70%, else log-uniform 100 to 150,000 whole dollars.
  - Step 4(b): 0 in 70%, else log-uniform 500 to 50,000 whole dollars.
  - Step 4(c): 0 in 75%, else up to 300 dollars, whole or with cents (the smallest is 0.30, `wh-0156`).
- No edge row's wages pass 40,000. An edge row only uses pay periods that keep its paycheck at
  or under 40,000.

### Coverage (from the run)

| | Rows |
|---|---|
| total | 3,000 (288 edge, 2,712 random) |
| pay periods 52 / 26 / 24 / 12 / 260 / 4 / 2 / 1 | 611 / 641 / 491 / 555 / 278 / 127 / 129 / 168 |
| single / married jointly / head of household, box not checked | 652 / 624 / 640 |
| single / married jointly / head of household, box checked | 361 / 352 / 371 |
| Step 3 credits > 0 / Step 4(a) > 0 / Step 4(b) > 0 / Step 4(c) > 0 | 1,273 / 1,035 / 851 / 711 |
| 1i floored at 0 (1e - 1h below 0) / 1i exactly 0 | 361 / 380 |
| 3c floored at 0 (credits at least the tentative amount, which is above 0) | 244 |
| withholding 0.00 | 807 |
| wages 0 | 43 |
| `tentative_annual` needed rounding / `withholding` needed rounding | 1,897 / 1,905 |
| `withholding` exactly on a half cent | 21 |
| checked against Worksheet 4 | 2,576 |

Rows in each table row (rows 1-8 of the table):

| Table | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| STANDARD single | 167 | 78 | 111 | 71 | 54 | 22 | 85 | 64 |
| STANDARD married jointly | 224 | 67 | 110 | 64 | 53 | 30 | 27 | 49 |
| STANDARD head of household | 202 | 59 | 94 | 41 | 71 | 26 | 82 | 65 |
| Checkbox single | 50 | 35 | 57 | 51 | 42 | 22 | 43 | 61 |
| Checkbox married jointly | 80 | 44 | 49 | 35 | 29 | 19 | 30 | 66 |
| Checkbox head of household | 77 | 38 | 43 | 23 | 37 | 23 | 60 | 70 |

### What the withholding key leaves out (on purpose)

- Forms W-4 from 2019 or earlier (allowances, lines 1j-1l). The computational bridge, Worksheet
  1B (pensions) and Worksheets 2-5 are out too; Worksheet 4 is used only as a check.
- Nonresident alien additions (P15T Tables 1-2), supplemental wages (22% / 37% flat rates),
  exempt employees and the "no withholding" box.
- Rounding to whole dollars (allowed by P15T p.9, not done here).
- Any state or local tax, and anything a W-4 worksheet would compute (the CSV takes the Step 3
  and Step 4 entries as given).

## Payroll key (`payroll_key.py`)

### Rules

- `ss_year` = 6.2% x min(wages x paychecks, 184,500): the employee's Social Security for the year
  from this job.
- `medicare_year` = 1.45% x (wages x paychecks) + 0.9% x max(0, wages x paychecks - 200,000):
  what the employer withholds, the Additional Medicare Tax included, whatever the filing status
  (ADMT). The employee's own liability can differ (thresholds 250,000 joint, 125,000 separate; Form 8959 instructions, IRC 3101(b)(2));
  that is settled on Form 8959, not by the employer.
- `ss_last_paycheck` = the first paycheck k at which k x wages >= 184,500. That is the paycheck in
  which the year's wages so far first reach or pass the wage base, which is also the last one with
  any Social Security taken. It takes only what is left under the base (all of the paycheck if it
  lands exactly on the base). Blank if wages x paychecks < 184,500.
  - **A year that ends exactly on the base** (wages x paychecks = 184,500: `pay-edge-155` with 12
    paychecks and `pay-edge-134` with 24) gives the last paycheck's number. The base is reached
    in that paycheck, which takes full Social Security. One cent less per paycheck gives a blank.
- `extra_medicare_first_paycheck` = the first paycheck k at which k x wages > 200,000: "the pay
  period in which you pay wages in excess of $200,000" (P15 p.30). It is the largest k with
  k x wages <= 200,000, plus 1. Landing exactly on 200,000 does not start it; the next paycheck
  does. Blank if wages x paychecks <= 200,000.
- The two totals are figured on the year's wages and rounded half up to the cent once.
  - A real payroll rounds each paycheck's taxes to the cent. Its year total can then differ from
    this figure by cents (P15 pp.40-41, the "fractions-of-cents" adjustment on Form 941 line 7).
    In this key, summing per-paycheck rounded amounts would change `ss_year` on 1,273 rows (at
    most 0.26) and `medicare_year` on 1,389 rows (at most 0.45). That is printed as information.
  - Compare per-paycheck totals with a tolerance of n/2 cents.

### Second way, run on every row

A paycheck-by-paycheck payroll in exact Fractions. For each paycheck it takes the year-to-date
wages before and after:

- Social Security wages = min(wages, base - year to date before), not below 0;
- Additional Medicare wages = year to date after - max(year to date before, 200,000), not below 0.

The sums must equal the year formulas exactly. The last paycheck with Social Security wages above
0 (when the base is reached) and the first with Additional Medicare wages above 0 must equal the
two paycheck columns. The run agrees on all 1,500 rows. Each "on" edge row also asserts it lands
where it was built to land.

### The generator

- 237 edge rows (`pay-edge-001` to `pay-edge-237`).
  - 156 rows land k equal paychecks exactly on 184,500, plus a twin one cent per paycheck below
    and one cent above. That is every k up to the year's paychecks for which 184,500 / k is whole
    cents and between 500 and 60,000: 20 values of k for 52 paychecks, 13 for 26, 12 for 24 and 7
    for 12.
  - 81 rows do the same for 200,000: 10, 7, 6 and 4 values of k.
- 1,263 random rows (`pay-0001` to `pay-1263`): paychecks 52, 26, 24 or 12 (equal odds). Wages are
  log-uniform from 500 to 60,000 a paycheck, in whole cents.

### Coverage (from the run)

| | Rows |
|---|---|
| total | 1,500 (237 edge, 1,263 random) |
| paychecks 52 / 26 / 24 / 12 | 402 / 369 / 386 / 343 |
| reach the wage base / below it all year (blank) | 774 / 726 |
| base reached on the last paycheck / year ends exactly on the base | 19 / 2 |
| pass 200,000 / pass it on the last paycheck | 738 / 10 |
| year ends exactly on 200,000 | 0 (not possible: 200,000 / 52, 26, 24 or 12 is never whole cents) |
| `ss_year` needed rounding / `medicare_year` needed rounding | 722 / 1,431 |

### What the payroll key leaves out

- More than one job, a mid-year raise, bonuses, pre-tax deductions that change Social Security
  and Medicare wages (the CSV's wages are the Social Security and Medicare wages), and tips.
- A successor employer's wages carried over (P15 p.30), and the employer's share.
- The employee's Form 8959 reconciliation and estimated tax.

## CSV columns

`withholding.csv`: `case_id, year, paychecks, wages, w4_status, step2, step3_credits,
step4a_other, step4b_deductions, step4c_extra, adjusted_annual, tentative_annual, withholding`.
`w4_status` is `single`, `married_joint` or `head_of_household`. `step2` is `0` or `1`. Annual
amounts are `step3_credits`, `step4a_other`, `step4b_deductions`, `adjusted_annual` (Worksheet 1A
line 1i) and `tentative_annual` (line 2g). Per-paycheck amounts are `wages`, `step4c_extra` and
`withholding` (line 4b). All money has two decimals.

`payroll.csv`: `case_id, year, paychecks, wages, ss_year, medicare_year, ss_last_paycheck,
extra_medicare_first_paycheck`. `wages` is per paycheck. The two paycheck columns are whole
numbers from 1 to `paychecks`, or empty.

## Open points (things a reviewer should know)

1. **One pay period a year.** P15T Table 3 does not list 1 (it lists 2, 4, 12, 24, 26, 52 and
   260). The key still has 168 rows with `paychecks` = 1, worked with 1b = 1. Worksheet 1A works
   unchanged, and P15T Tables 1-2 (pp.6-7) name "Annually" as a payroll period. Drop those rows if the app
   does not offer an annual payroll.
2. **The checkbox-table rounding rule is inferred.** Pub. 15-T does not say how it rounds
   half-dollar starts and half-cent amounts. "Half up" reproduces all three rounded figures, and
   the CSV uses the printed figures in any case.
3. **Step 4(a) with cents** on 184 edge rows. A W-4 normally has whole dollars there. The cents
   make a whole-cent paycheck land exactly on a table start.
4. **Lines 2h and 3b are not rounded** before line 3c. Worksheet 1A does not say to round them. A
   payroll that rounds them gets 1 cent more or less on 151 rows.
