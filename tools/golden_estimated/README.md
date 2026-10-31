# Estimated tax answer key: estimated payments and the withholding check

One independent answer key for two tax pages, "Estimated payments" and "Withholding check":

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `estimated_key.py` | `tests/golden/estimated/dates.csv` | 80 | every installment due date of tax years 2024 to 2027 (the fourth 2027 one falls in January 2028) for no state, DC, MA, ME and CA: the statutory date, the date the law moves it to and why, the date the page moves it to and why, what the IRS printed, and for the fourth installment the January 31 option |
| | `tests/golden/estimated/households.csv` | 3,000 | invented households, tax years 2025 and 2026: this year's tax, the safe amount (90% of this year or 100% / 110% of last year) and its basis, projected withholding and paychecks left, the amount to pay by estimates and each quarter's date, cumulative share and status on "today", what is paid, remaining, behind and next, the balance at filing, the verdict and W-4 suggestion, the pages' two penalty flags and the law's exposure beside them |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the
model as small functions. `tests/golden/estimated/RULES.md` gives each rule in plain words with the source text,
and works four examples by hand (section 9). Those examples are rows `est-edge-001` to `-011` of households.csv;
the 2027 example of RULES.md 9.5 is the 2027 rows of dates.csv.

**Independence.** This key was written from the law (26 U.S.C. 6654, 7503, 1411 and 55; 5 U.S.C. 6103), the
regulations (26 CFR 301.7503-1), the D.C. Code (28-2701, 1-612.02), the Massachusetts and Maine holiday statutes,
Rev. Rul. 2015-13, Rev. Proc. 2024-40 and 2025-32, Pub. L. 119-21, Forms 1040-ES (2024 to 2026), Form 2210 and its
instructions, the Form 1040 instructions and Publication 509 (2026, and the 2027 draft), through `rules.py` and
RULES.md. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs
the app. The only things taken from `tools/golden_health/` and `tools/golden_estate/` are their layout and
conventions; no figure or code is shared. The federal brackets and standard deductions agree with
`tests/golden/taxes/RULES.md`, which is cited for comparison only. The pages' documented model (the brief's rules 1
to 9) is the spec; where the law says otherwise the main column follows the law and a contrast column (or
dates.csv) keeps the page's way. The script works every row in two separate ways, both in exact arithmetic. It
refuses to write either CSV if an amount differs by more than a cent, or any other value (date, status, verdict,
flag, count, basis) differs at all, between the two. In fact the two agree exactly, before rounding, on every value
of every row: 53,279 amounts and 96,288 other values in households.csv, 505 values in dates.csv.

## Run

```
python3 -B -I tools/golden_estimated/estimated_key.py
```

Python 3 standard library only (made with 3.13; about 10 seconds). The run is deterministic
(`random.Random(20261031)`, and the generator draws only integers, never a float), so a second run writes
byte-identical files (checked: two runs into separate folders gave the same sha256 for both CSVs). The script
sets `sys.dont_write_bytecode` *before* it imports `rules.py`, and `-B` covers Python's own cache, so no
`__pycache__` lands in the repo. `-I` keeps the environment and the current folder off the import path; the script
puts its own folder on it to find `rules.py`. Importing `rules.py` runs its self-checks. The run then checks
derivation 2 against RULES.md's worked examples and the due-date table (176 assertions), works both CSVs, checks
95 coverage minimums taken from the brief, and writes the CSVs only once all of that has passed. It prints every
check count and the coverage.

Options: a folder argument writes the CSVs there instead (`estimated_key.py /tmp/x`); `--mutate NAME` puts one
deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script); `--skip-examples` turns off the
RULES.md examples check, so the row guard has to find a mistake alone. That is how the table under "Deliberate
mistakes" was made.

`tests/golden/estimated/todo.json` lists, by cause, the rows where the pages disagree with this key; the reason for
each cause is in `tests/golden-estimated.test.mjs` (`WHY`). The tie convention (RULES.md section 2) was changed from
"this year" to "last year" on 2026-10-31, when the check against the pages found that no source decides it.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the
`rules.py` docstring and RULES.md section 13 give the sha256 of each copy. No source was read again for this
script, and the script adds no figure of its own: every amount and date rule it uses comes from `rules.py`, or is
one of the pages' documented conventions (the $1 tolerance, the $500 and $1,000 lines, 52/26/24/12 paychecks,
365.25 days).

| Tag | Source | Used for |
|---|---|---|
| USC6654 | 26 U.S.C. 6654, OLRC edition current through Pub. L. 119-136 (Oct 22, 2026) | (b) underpayment per installment, payments credited oldest first; (c) four installments, April 15 / June 15 / September 15 / January 15; (d)(1) 25% installments, 90% / 100% / 110%, the $150,000 and $75,000 lines; (e)(1) the $1,000 test; (e)(2) no tax last year; (f) what "tax" includes; (g)(1) withholding deemed paid in equal parts; (h) the January 31 option |
| USC7503, CFR7503 | 26 U.S.C. 7503; 26 CFR 301.7503-1(a), (b) | a due date on a Saturday, Sunday or legal holiday moves to the next day that is none; legal holidays are those of the District of Columbia |
| DC28, DC1612, USC6103 | D.C. Code 28-2701 and 1-612.02(a)(11), (b)(1); 5 U.S.C. 6103 | the D.C. holiday list (Emancipation Day April 16), Saturday -> Friday, Sunday -> Monday, Inauguration Day |
| MAGL, MERS, RR1513 | Mass. Gen. Laws ch. 4 s.7; Me. Rev. Stat. tit. 4 s.1051; Rev. Rul. 2015-13 | Patriots' Day is the third Monday in April; it moves a MA or ME resident's return, not the first estimated payment |
| ES24, ES25, ES26 | Form 1040-ES (2024), (2025), (2026) | the printed due dates and January 31 options; the 110% rule as the IRS words it; MA and ME vouchers go to Louisville, KY |
| I2210, F2210 | Instructions for Form 2210 (2025, and 2024 for its dates); Form 2210 (2025) Part I | the $1,000 test uses withholding only; the penalty is figured separately for each installment; withholding counts one fourth on each date |
| P509_26, P509_27 | Publication 509 (2026); Publication 509 (2027) DRAFT | the IRS's own lists of legal holidays (rebuilt by `rules.check_tables()`); the January dates; the 2027 installment dates |
| RP2440, RP2532, PL11921 | Rev. Proc. 2024-40 s.2.01; Rev. Proc. 2025-32 s.3.01, s.4.01, s.4.14; Pub. L. 119-21 s.70102 | the 2025 and 2026 brackets and standard deductions |
| I1040 | Instructions for Form 1040 (2025) | the day-before rule for age 65; the Tax Table under $100,000 (contrast column) |
| P501 | Publication 501 (2025), Married Filing Separately (read 2026-10-31) | a separate return reports only the filer's own income: two returns on a separate row with two adults, half the interest each |
| USC1411, USC55 | 26 U.S.C. 1411(a)(1), (b); 55(b)(1), (d) | the net investment income tax lines the generator stays under; the AMT can never apply here (`rules.check_tables()`) |
| IRSET, IRSNEWS | IRS "Estimated taxes" page; the 2025 and 2026 filing-season releases, Tax Tips 2024-30 and 2022-47 | the three conditions for no estimated tax; no Patriots' Day statement for estimated payments in 2025-2027 |
| FEDKEY | `tests/golden/taxes/RULES.md` sections 1-2 | comparison only (same figures; its Rev. Proc. 2024-40 section numbers are s.2.01 / s.2.15, not s.3.01 / s.3.15) |

## Figures

| Figure | Value | Source |
|---|---|---|
| Brackets 2025 | single 11,925 / 48,475 / 103,350 / 197,300 / 250,525 / 626,350; joint twice single up to 501,050, then 751,600; separate as single but 375,800; head of household 17,000 / 64,850 / 103,350 / 197,300 / 250,500 / 626,350 | RP2440 s.2.01 |
| Brackets 2026 | single 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600; joint twice single up to 512,450, then 768,700; separate as single but 384,350; head of household 17,700 / 67,450 / 105,700 / 201,750 / 256,200 / 640,600 | RP2532 s.4.01 |
| Standard deduction | 2025: 15,750 / 31,500 / 15,750 / 23,625; 2026: 16,100 / 32,200 / 16,100 / 24,150 (single / joint / separate / head of household) | PL11921; RP2532 s.3.01, s.4.14 |
| Safe amount | lesser of 90% of this year and 100% of last year; 110% when last year's AGI exceeds $150,000 ($75,000 if married filing separately this year) | USC6654 (d)(1) |
| No addition | this year's tax minus withholding under $1,000; or last year's tax 0 for a full year as a citizen or resident | USC6654 (e)(1), (e)(2) |
| Due dates 2024 | Mon Apr 15, Mon Jun 17, Mon Sep 16, 2024, Wed Jan 15, 2025 | ES24 |
| Due dates 2025 | Tue Apr 15, Mon Jun 16, Mon Sep 15, 2025, Thu Jan 15, 2026; January 31 option Mon Feb 2, 2026 | ES25; P509_26 |
| Due dates 2026 | Wed Apr 15, Mon Jun 15, Tue Sep 15, 2026, Fri Jan 15, 2027; January 31 option Mon Feb 1, 2027 | ES26; P509_27 draft |
| Due dates 2027 | Thu Apr 15, Tue Jun 15, Wed Sep 15, 2027 (draft); Tue Jan 18, 2028 and Mon Jan 31, 2028 (computed, not printed yet) | P509_27 draft; USC6654 (c)(2) with 7503 |
| Page conventions | paid at cumulative share - $1; about right under $500 either way; withholding flag at a balance of $1,000; 52 / 26 / 24 / 12 paychecks a year; 365.25 days | the brief (no legal source) |

## Who each row is

- **dates.csv.** One installment of one tax year for a filer in one place: no state given, the District of
  Columbia, Massachusetts, Maine or California. The law's date is the same for all five; the page's date differs
  only for MA and ME in a year when Patriots' Day reaches the April date (2024 here).
- **households.csv.** One tax return for 2025 or 2026: one filer (single, head of household, married filing
  separately) or a couple filing jointly, nobody 65 or older at the end of the year. `adults` lists each adult's
  birth date; on a married-filing-separately row a second adult is the spouse, who files his or her own return.
  Since 2026-10-31 such a row is two returns (the page took this up that day): each spouse reports half the
  interest (the household's, in neither name), takes their own standard deduction and works their own tax to the
  cent, and the row's tax is the two added. The withholding and estimates stay the household's, as the page keeps
  them (married filing separately splits them only on the returns themselves). Before that day the key, like the
  page, worked one combined return at the separate rates.
  The only income is taxable interest (`other_income`), there are no dependents, no credits, and the standard
  deduction applies. `prior_tax` and `prior_agi` are last year's total tax and adjusted gross income as typed
  (blank = not typed). Withholding is either nothing at all, or per-paycheck amounts for the filer and (joint
  returns only) the partner, each with a pay period, plus the household's `withheld_so_far` or a blank one.
  `paid_q1` to `paid_q4` are estimated payments typed in each quarter's box, each made on or before its own due
  date. `today` is the day the page is looked at, from January 1 of the year to January 31 of the next.

## How each row is worked (derivation 1: rules.py)

- **dates.csv.** `rules.due_date(year, quarter, state, 'law')` and `(..., 'page')`, which return the date and the
  reason for each day skipped; `rules.nominal_due_date`; `rules.jan31_option_date`; `rules.IRS_DUE_DATES` and
  `rules.IRS_JAN31_OPTION` for what the IRS printed.
- **households.csv.** `rules.evaluate(case)`, which runs `case_tax` (refusing anyone 65 or older and any 2027
  row), `required_annual_payment`, `projected_withholding` with `paychecks_left`, `amount_by_estimates`,
  `where_you_stand` (on the page's dates), `law_underpaid` (on the law's dates), `balance_at_filing`, `verdict`,
  `w4_suggestion`, the two page flags and `law_flag`, all in exact fractions. The script adds three checks that
  hold on every row and explain why some contrast columns are absent: the net investment income tax is 0, the
  law's withholding (the filer's own on a separate return) equals the page's, and the page's dates equal the
  law's.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, in integers of 1e-8 dollar, without calling a `rules.py` function. It uses
`rules.py`'s tables only (bracket tops, the printed bracket bases, rates, standard deductions).

- **Tax.** The revenue procedure's own form: find the "Over $X but not over $Y" row by bisection on the bracket
  tops, then the printed "The Tax Is" base plus the rate on the excess. `rules.py` sums each bracket's slice
  instead. Every intermediate is proved whole: income in cents times a whole percent is a multiple of 1e-4, 90%
  of it of 1e-5, a quarter of that of 2.5e-6.
- **Safe amount.** 9 x tax / 10 and pct x last year / 100 in integers; the line is compared in cents.
- **Withholding.** Paychecks left as `days x n x 4 // 1461` with `days` from date ordinals; the household's "so
  far" plus each person's per-paycheck amount times that, or a full year for each when "so far" is blank.
- **Schedule.** A quarter of the amount times 1, 2, 3, 4. Past-due quarters are counted as a prefix (the due
  dates rise), not tested one by one.
- **The law's test.** For each past-due installment j: the payments typed in boxes 1 to j against j quarters of
  (safe amount - withholding). `rules.py` instead dates every payment at the latest day the row allows and adds a
  quarter of the withholding on each date. The two are the same rule; neither was derived from the other.
- **Dates.** Each day is tested against D.C. Code 28-2701 written as predicates on the day itself: a fixed date
  on a weekday; a Friday whose Saturday is a fixed holiday; a Monday whose Sunday is one; the third Monday as "a
  Monday on the 15th to the 21st", the last Monday in May as "a Monday on the 25th or later", the fourth Thursday
  of November as "a Thursday on the 22nd to the 28th"; Inauguration Day on January 20 of a year that is 1 more
  than a multiple of 4 (January 21 when the 20th is a Sunday). `rules.py` builds the year's holiday list from
  rules instead. Patriots' Day is "a Monday in April on the 15th to the 21st". The skipped days and why are
  compared too.

The guard compares the two on 53,279 amounts and 96,288 other values in households.csv and 505 values in
dates.csv. No amount differs at all before rounding, and the largest gap is 0.

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up (away from zero for the 722
  negative balances; 4 of them sit exactly on a half cent). Ties are real here: 1,316 written amounts in
  households.csv are exactly on a half cent before rounding (quarters of 90% of a tax, mostly; 16 taxes
  themselves). Example: `est-edge-052`, shares 2,036.025 / 4,072.05 / 6,108.075 / 8,144.10, written 2,036.03 /
  4,072.05 / 6,108.08 / 8,144.10.
- Nothing is rounded before it is used: the next payment, the balance and the W-4 change all use exact values.
  `est-edge-114` (tax $0.001) shows the consequence: every figure is a fraction of a cent, `behind` is written
  0.00 yet the row has an `overdue_due` date.
- **W-4 changes** are whole dollars: the ceiling (more) or the floor (less) of the exact quotient.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder: once with the RULES.md examples check, and
once without it (`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | RULES.md examples check | Row guard |
|---|---|---|
| last-year AGI of exactly $150,000 / $75,000 takes 110% | caught (9.1, AGI $150,000: 33,000 vs 30,000) | refused at `est-edge-003` (110% vs 100%) |
| married filing separately uses the $150,000 line | not caught | refused at `est-edge-020` (100% vs 110%) |
| a blank last-year tax read as 0 | caught (9.4 blank) | refused at `est-edge-010` |
| no $1 tolerance for paid / covered | not caught | refused at `est-edge-038` (Q1 short vs paid) |
| the law counts every typed payment on every date | caught (9.1 at 7,500) | refused at `est-edge-002` (law Q3 only vs Q1-Q3) |
| the $1,000 test subtracts estimated payments | caught (9.3) | refused at `est-edge-006` (estimates needed no vs yes) |
| the law moves the April date for Patriots' Day | caught (2024 MA) | refused at dates.csv 2024 MA Q1 (Apr 17 vs Apr 15) |
| King's Birthday not a holiday | caught (2027 Q4) | refused at dates.csv 2027 Q4 (Jan 17 vs Jan 18, 2028) |
| paychecks left over 365 days, not 365.25 | not caught | refused at `est-0322` (14 vs 13) |
| a typed 0 "withheld so far" read as blank | not caught | refused at `est-edge-087` (W-4 24 vs 21) |
| about right at exactly $500 | not caught | refused at `est-edge-044` |
| "due" whenever the date is 30 days away or less | not caught | refused at `est-edge-060` |

In all twenty-four runs no CSV was written.

## The generator

Edge rows come first, then random rows. A random draw is redrawn when the total paid sits within $1 under a
cumulative share (10 draws), because only there does the $1 tolerance decide a status; the labelled edge rows
test it. Nothing else is redrawn.

### dates.csv: 80 rows

Every year 2024 to 2027, every state of the five, every quarter, in that order.

### households.csv: 126 edge rows (`est-edge-001` to `-126`), then 2,874 random rows (`est-0001` to `est-2874`)

| Rows | What they pin down |
|---|---|
| `-001` to `-011` | RULES.md 9.1 to 9.4: the retired couple (110%: $33,000, next $8,250 by Jan 15, 2027), paying $7,500 instead, last-year AGI exactly $150,000 and $150,000.01; Cora behind $4,936.50 and her catch-up (page flag off, law on); Dev's $950 balance (W-4 +$475, Q3 short $43), after the W-4 advice, and seen on August 1; Eli's zero tax last year and the blank instead |
| `-012` to `-031` | last-year AGI at $150,000.00 / $150,000.01 for single, joint and head of household, $75,000.00 / $75,000.01 / $150,000.00 for married filing separately, $75,000.01 for single; 2025 and 2026 |
| `-032` to `-039` | last-year tax 0 with AGI blank; blank tax with AGI typed; typed tax with AGI blank; a tie with 90% of this year, a cent over and a cent under; $4 (installments of $1); 0 on a joint return that still owes |
| `-040` to `-047` | tax minus withholding $999.99 / $1,000.00; balance at filing $999.99 / $1,000.00 with withholding + estimates under the safe amount; balance $500.00 / $499.99 / -$499.99 / -$500.00 |
| `-048` to `-051` | the $1 tolerance: $1.00 and $1.01 under a past-due share, $0.50 under a share not yet due, exactly the share |
| `-052` to `-085` | 2025, half-cent shares, nothing paid and on-time payments, `today` on Jan 1, Apr 14 / 15 / 16, May 31, Jun 1, Jun 15 (a Sunday) / 16 / 17, Sep 15 / 16, Dec 31, and Jan 1 / 14 / 15 / 16 / 31 of 2026 |
| `-086` to `-093` | 2026 weekly pay seen on Jan 1 (so far blank or 0), Dec 31, Jan 1 / 15 / 16 / 31, 2027: 51 or 0 paychecks left |
| `-094` to `-105` | withholding shapes: so far 0, so far blank, so far only (use estimates), partner's pay only, both paychecks with and without so far, a refund (W-4 less), an owe that divides exactly, December 31 (ambiguous), January after the year, withholding above the safe amount, January 1 |
| `-106` to `-111` | payments: a Q2 payment typed in March, overpaid, all four on time, everything in the January box, a typed 0 then a catch-up, a skipped Q1 caught up in Q2 |
| `-112` to `-119` | income 0, at the standard deduction, a cent over it, taxable income exactly at a bracket top, and exactly at each status's investment income tax line |
| `-120` to `-126` | births Jan 2, 1961 (2025), Jan 2, 1962 and Dec 31, 1995 (2026); MA, ME and DC rows seen on Apr 15, Emancipation Day and Patriots' Day |

Random rows:

- **Year:** 2025 or 2026, even odds.
- **Filing status:** single 30%, joint 35%, separate 15%, head of household 20%. Two adults on joint rows, and on
  40% of separate rows (the spouse); otherwise one.
- **State:** MA 12%, ME 12%, DC 10%, CA 10%, otherwise one of the other 47 states.
- **Births:** uniform from max(Jan 1, 1960, Jan 2 of year - 64) to Dec 31, 1995; 8% within 30 days of that
  first day.
- **Today:** on a due date 22%, the day after one 12%, the day before one 5%, Jan 1-14 of the next year 9%, Jan
  16-31 of the next year 4%, Jan 1 4%, Dec 31 4%, otherwise uniform over the year.
- **Interest:** 0 (3%); at or under the standard deduction (5%); the standard deduction plus up to $60,000
  (47%); up to the investment income tax line (45%). Whole dollars 70%, cents 30%.
- **Last year's tax:** blank 20% (AGI typed anyway in 10% of those); 0 10%; $1 to $1,999.99 15%; 60% to 140% of
  this year's 40%; 150% to 300% of this year's plus up to $20,000 15%.
- **Last year's AGI** (when the tax is typed): blank 8%; exactly $75,000.00 / $75,000.01 / $150,000.00 /
  $150,000.01 14%; otherwise under $75,000 (35%), $75,000.02 to $149,999.99 (30%) or $150,000.02 to $400,000
  (35%).
- **Withholding:** none 40%. Otherwise a target of 0 to 130% of this year's tax, split between the filer and (on
  joint rows: filer only 50%, both 35%, partner only 15%) the partner; period weekly 20, biweekly 40, semimonthly
  20, monthly 20; the per-paycheck amount rounded up to the cent or the dollar, at least $1. "So far" typed in 65%
  (7% of those 0, the rest the paychecks already past times 85% to 115%), blank in 35%.
- **Estimated payments,** worked from the row's own amount to pay by estimates: nothing (18%); on time, every
  past-due box rounded up to the cent or dollar, and half the time the next box if it is due within 45 days
  (22%); late, the first one or more past-due boxes blank, half the time with a catch-up in the next box (15%);
  short, 30% to 97% of the quarter (15%); over, 103% to 200% (12%); one lump of 50% to 120% of the year in any
  box (8%); random amounts in random boxes (10%). When nothing is needed, 40% of the rows that drew a pattern
  pay $100 to $3,000 in one box anyway.

## Coverage (from the run)

**dates.csv**

| | Rows |
|---|---|
| total | 80 (4 years x 5 places x 4 quarters) |
| moved by the law (weekend or holiday) | 20 (2024 Q2 and Q3, 2025 Q2, 2027 Q4, for each place) |
| the page's date differs from the law's | 2 (2024 Q1 for MA and ME: April 17 against April 15) |
| printed by the IRS and rebuilt / not yet published | 75 / 5 (2027 Q4) |

**households.csv**

| | Rows |
|---|---|
| total | 3,000 (126 edge, 2,874 random; 2,883 random draws, 9 redrawn) |
| year 2025 / 2026 | 1,471 / 1,529 |
| single / joint / separate / head of household | 933 / 1,016 / 464 / 587 |
| one adult / two | 1,782 / 1,218 |
| state MA / ME / DC / CA / other (51 codes in all) | 309 / 346 / 310 / 270 / 1,765 |
| today in Jan / Feb / Mar / Apr / May / Jun / Jul / Aug / Sep / Oct / Nov / Dec / January after | 215 / 97 / 98 / 409 / 84 / 408 / 111 / 110 / 378 / 124 / 93 / 194 / 679 |
| today on the Q1 / Q2 / Q3 / Q4 due date | 159 / 170 / 150 / 161 |
| today the day after the Q1 / Q2 / Q3 / Q4 due date | 118 / 89 / 96 / 101 |
| today Jan 1 / Dec 31 / Jan 1-14 next year / Jan 16-31 next year | 122 / 114 / 312 / 206 |
| last-year tax blank / 0 / under 2,000 / over 1.5 x this year / other | 662 / 393 / 708 / 416 / 821 |
| last-year AGI at or under the line / over / blank with a typed tax | 1,354 / 807 / 177 |
| last-year AGI exactly 150,000.00 / 150,000.01 (not separate) | 87 / 76 |
| last-year AGI exactly 75,000.00 / 75,000.01 (separate) | 21 / 18 |
| basis this year / last year at 100% / last year at 110% | 1,836 / 771 / 393 (143 ties named last year) |
| withholding nothing typed / typed | 1,268 / 1,732 |
| so far blank / typed / typed 0 | 620 / 1,030 / 82 |
| paychecks for the filer / both / the partner only / nobody (so far only) | 1,418 / 220 / 93 / 1 |
| periods weekly / biweekly / semimonthly / monthly (people) | 410 / 781 / 373 / 387 |
| estimates none typed | 1,150 |
| every past-due box with its quarter, up to $1 over (on time) | 311 |
| a past-due box blank (late or not typed) / under its quarter (short) | 642 / 250 |
| a box more than $1 above its quarter (over) / typed before its due date | 1,135 / 791 |
| total paid at or above the amount | 810 |
| Q1 status paid / short / due / upcoming | 2,270 / 459 / 98 / 173 |
| Q2 status paid / short / due / upcoming | 1,956 / 447 / 113 / 484 |
| Q3 status paid / short / due / upcoming | 1,656 / 396 / 104 / 844 |
| Q4 status paid / short / due / upcoming | 1,378 / 78 / 220 / 1,324 |
| behind above 0 / no next payment | 732 / 1,456 |
| estimates needed yes / no / the amount-only reading differs | 1,572 / 1,428 / 315 |
| tax minus withholding under $1,000 / last-year tax 0 | 1,138 / 393 |
| tax minus withholding exactly 999.99 / 1,000.00 | 1 / 1 |
| balance (with withholding figures) under 1,000 / 1,000 or more | 1,082 / 650 |
| balance exactly 999.99 / 1,000.00 / 500.00 / 499.99 / -499.99 / -500.00 | 2 / 2 / 1 / 1 / 1 / 1 |
| verdict unknown / about right / owe / refund | 1,268 / 496 / 817 / 419 |
| suggestion more / less / use estimates / use estimates (ambiguous) / none | 593 / 295 / 1 (`est-edge-096`) / 223 / 1,888 |
| suggestion for the partner / "less" larger than the per-paycheck amount | 43 / 142 |
| withholding page flag / estimates page flag / law exposure | 540 / 753 / 793 (the withholding flag uses the law's $1,000 test since 2026-10-31: tax less withholding only) |
| law on, estimates page off / estimates page on, law off | 40 / 0 (impossible, see open point 9) |
| law on, withholding page off / withholding page on, law off | 493 / 240 |
| tax 0 / income with cents / largest tax | 275 / 829 / $37,468.00 |
| Tax Table differs from the formula by a cent or more (largest $6) | 2,165 |
| tolerance-sensitive (labelled edge rows only) | 4 (`est-edge-038`, `-048`, `-050`, `-114`) |
| written amounts exactly on a half cent before rounding | 1,304 |

## CSV columns

Money has two decimals. Dates are ISO (`2026-04-15`). Flags are `yes` / `no`. A blank means "not typed" in an
input column and "does not apply" in an output column. `note` says what an edge row shows; on a random row it is
empty unless one of four things holds (W-4 "less" above the per-paycheck amount, an ambiguous suggestion, estimates
not needed only because of the $1,000 test, law exposure the estimates page does not flag).

**dates.csv**

`tax_year, state, quarter, statutory_date, statutory_weekday, due_law, due_law_weekday, law_moved_because,
due_page, due_page_weekday, page_moved_because, page_differs, irs_printed, irs_source, jan31_option,
jan31_option_weekday, jan31_irs_printed, note`

- `state`: blank (no state given), `DC`, `MA`, `ME` or `CA`. `quarter` 1 to 4; the fourth is in January of the
  next year.
- `statutory_date`: April 15, June 15, September 15 or January 15 (6654(c)(2)). `due_law`: moved past Saturdays,
  Sundays and D.C. legal holidays only, for every filer (7503). `due_page`: the page's convention, which also moves
  the April payment past Patriots' Day for MA and ME filers.
- `*_moved_because`: each day skipped, `date reason`, joined by `; ` (`2028-01-15 Saturday; 2028-01-16 Sunday;
  2028-01-17 Birthday of Martin Luther King, Jr.`). Blank when the date did not move.
- `irs_printed`, `irs_source`: the date the IRS printed for that installment and where, or blank and `not yet
  published` (2027 Q4).
- `jan31_*` (fourth-quarter rows only): the last day to file and pay in full so the fourth installment carries no
  addition (6654(h)), moved the same way, and what the IRS printed (2025 and 2026 only).

**households.csv**

Inputs: `case_id, year, today, state, filing_status, adults, other_income, prior_tax, prior_agi,
withheld_so_far, self_per_paycheck, self_period, partner_per_paycheck, partner_period, paid_q1, paid_q2, paid_q3,
paid_q4`

- `filing_status`: `single`, `married_joint`, `married_separate`, `head_of_household`. `adults`: birth dates
  joined by `|`. Periods: `weekly`, `biweekly`, `semimonthly`, `monthly`, filled exactly when the amount is.
  Partner amounts appear only on `married_joint` rows.

Outputs, in the brief's order:

- `total_tax`: regular income tax on max(0, `other_income` - standard deduction), exact formula.
- `required`: the safe amount. `ninety`: 90% of `total_tax`. `prior_share`: 100% or 110% of `prior_tax` (an
  amount; blank with no last-year tax). `basis`: `this year` or `last year` (a tie is `last year`; RULES.md section 2).
- `withholding_projected`: so far + per-paycheck x paychecks left for each person, or a full year at the
  per-paycheck rate when so far is blank; blank when nothing at all is typed. `paychecks_left_self`,
  `paychecks_left_partner`: floor(days from today to Dec 31 / 365.25 x paychecks a year), blank for a person
  with no per-paycheck amount.
- `needs_estimates`: `to_pay_by_estimates` above 0 **and** tax minus withholding at least $1,000.
  `to_pay_by_estimates` = max(0, `required` - `withholding_projected`); `per_quarter` = a quarter of it.
- `q1_due` to `q4_due` (the law's date; equal to the page's for 2025 and 2026), `q*_cumulative` (25 / 50 / 75 /
  100% of `to_pay_by_estimates`), `q*_status` (`paid`, `short`, `due`, `upcoming`).
- `paid`: all four boxes. `remaining` = max(0, amount - paid). `behind`: the cumulative share through the last
  past-due quarter minus paid, floored at 0, capped at remaining. `overdue_due`: the due date of that last
  past-due quarter, when `behind` is above 0. `next_due`, `next_amount`: the first quarter not past due whose
  share is not covered (paid >= share - $1), its share - paid - behind; both blank when there is none.
- `balance_at_filing` = tax - withholding - paid (+ owe, - refund). `verdict`: `unknown`, `about right`, `owe`,
  `refund`. `suggestion_kind`: `more`, `less`, `use estimates` or blank; `suggestion_per_paycheck` whole dollars.
- `page_penalty_flag_withholding`: withholding figures typed, balance >= $1,000 and withholding + paid <
  required. `page_penalty_flag_estimates`: `needs_estimates`, paid + $1 < `to_pay_by_estimates`, and some past-due
  quarter k short on its own date (boxes 1 to k under its share less $1), caught up since or not (RULES.md 9.2). `law_penalty_exposure`: tax minus withholding at least $1,000, last-year tax not a typed 0, and some
  installment due before today underpaid on its due date.

Detail and contrast columns:

- `prior_pct` (100 / 110), `last_past_due_quarter` (0 to 4), `next_quarter` (1 to 4 or blank),
  `suggestion_person` (`self` / `partner`).
- `suggestion_ambiguous`: owing, somebody has a per-paycheck amount, and nobody has a paycheck left (Dec 31 or
  January); the key says `use estimates` (open point 7).
- `needs_estimates_amount_only`: the other reading of "estimates needed" (amount above 0 only).
- `small_tax_exemption` (6654(e)(1)), `zero_prior_exemption` (6654(e)(2)).
- `law_underpaid`: each past-due installment underpaid on its due date, `quarter:shortfall` joined by `|`
  (`1:750.00|2:1500.00|3:2250.00`). The shortfall is cumulative at that date (j quarters of the safe amount minus
  j quarters of withholding minus boxes 1 to j). It is filled even when an exemption removes the exposure.
- `tolerance_sensitive`: paid sits within $1 under a cumulative share, so a page without the tolerance would
  differ.
- `tax_table_tax`: the Tax Table amount the return would use under $100,000 of taxable income (the middle of the
  $50 row, to the dollar; 2026 by the 2025 method).

## Open points (judgement calls a reviewer should know)

1. **Law first, the page beside it.** The main columns follow the law where it differs from the page's
   documented model, and the page's way is kept beside it:
   - Patriots' Day never moves an estimated payment (Rev. Rul. 2015-13; Form 1040-ES (2024) printed April 15,
     2024 for everyone). The brief's premise ("as the IRS says each year") is wrong for estimated payments; the
     IRS's yearly statements are about the MA / ME **return**. The page's way is `due_page` in dates.csv. In
     2025-2027 Patriots' Day falls on April 21, 20 and 19, so the two agree on every households.csv row (the
     script asserts it); they part in 2024 (and 2030): law April 15, page April 17.
   - The law judges each installment on its own date (6654(b)), the page counts every typed payment now: the
     page's `q*_status` and `behind` against the law's `law_underpaid` and `law_penalty_exposure`.
   - The $1,000 test uses withholding only (6654(e)(1)); the withholding page's flag uses the balance after
     estimates: `page_penalty_flag_withholding` against `law_penalty_exposure`.
   - Where the law and the case's own definition part on the tax itself, the case wins: `total_tax` is the exact
     formula (as the brief and the federal key define it), and `tax_table_tax` is the Tax Table amount the return
     would use (differs by a cent or more on 2,202 rows, at most $6).
2. **2027 rows are dropped from tax and test due dates only.** The app inflates the 2026 figures for 2027, and
   the key does not model that indexing. dates.csv carries 2027 (and January 2028); households.csv has no 2027
   row. `rules.case_tax` refuses 2027.
3. **Inputs the brief leaves open, read one way:**
   - A typed last-year tax means a filed, full 12-month return; a typed 0 also means a citizen or resident all
     year (so 6654(e)(2) applies). Blank is not zero: 90% of this year.
   - A typed last-year tax with a blank AGI is 100%. "Exceeds $150,000" is strict: exactly $150,000 is 100%.
   - "Withheld so far" is one household figure. A typed 0 is a figure (0 + paychecks left), not a full year.
   - `prior_share` is written as an amount, with `prior_pct` beside it.
4. **"Covered" uses the $1 tolerance**, the same as "paid", so a quarter shown as paid is never the next
   payment. `est-edge-050` is the row where the other reading would give "next: Q3 $0.50" instead of "Q4 $914".
   `behind` has no tolerance (the brief gives none), so `est-edge-048` shows Q2 `paid` and $1.00 behind. Random
   rows never sit within $1 under a share (redrawn); four labelled edge rows do.
5. **"Estimates needed" includes the $1,000 test** (Form 1040-ES worksheet lines 14a and 14b). The amount, the
   shares and the statuses are still worked when it says no, so a row can show `short` quarters with
   `needs_estimates = no` and no flag (`est-edge-040`). The amount-only reading is `needs_estimates_amount_only`;
   320 rows differ.
6. **`overdue_due`** is the due date of the last past-due quarter, the date `behind` is measured to, and only
   when `behind` is above 0. A page that shows the date of the first short quarter instead can rebuild it from
   `q*_status` and `q*_due`.
7. **The W-4 suggestion when nobody has a paycheck left.** The brief says "nothing withheld from pay and owing
   -> use estimates". With a per-paycheck amount typed but no paycheck left (December 31, or January after the
   year), the key also says `use estimates` and marks the row `suggestion_ambiguous` (220 rows: 214 random and
   `est-edge-088`, `-090`, `-091`, `-093`, `-102`, `-103`). A test can skip the suggestion on those rows. Only
   `est-edge-096` (so far typed, nothing per paycheck) is the unambiguous case; random rows always type a
   per-paycheck amount when they type withholding, as the brief describes. A refund with nobody's pay left gets
   no suggestion.
8. **The W-4 "less" figure has no cap.** floor(-balance / paychecks left) can be more than the per-paycheck
   amount when the refund comes from estimated payments (143 rows, noted). The key follows the page's formula.
9. **The estimates page's flag implies the law's exposure.** The flag needs a past-due quarter k whose boxes 1 to
   k were under share k - $1, so installment k is underpaid under the law too (the needs test is the law's $1,000
   test). The script asserts it on every row; the reverse fails on 42 rows (41 where the year has been paid in
   full, late; `est-edge-048` inside the $1 tolerance). Until 2026-10-31 the flag used the statuses ("some quarter
   short" now), which a catch-up clears, and the reverse failed on 169 rows; RULES.md 9.2 says why it changed.
10. **The law's test, in detail.** Each typed payment is dated at the latest day the row allows (its own due date,
    or today if earlier), so a catch-up never cures an earlier installment. Only installments due before today are
    judged. Withholding is the page's projection for the year, spread in four equal parts over the due dates
    (6654(g)(1)), with no election of actual dates. The addition to tax itself (6654(a), the 6621 rate, the days)
    is out of scope, and so is the January 31 option (dates.csv gives the date; no number changes). A tiny
    shortfall counts: `est-edge-038` ($4 last year) has law exposure for $1 and $2.
11. **Contrast columns left out because they never differ on these rows:** the net investment income tax
    (interest is kept at or under the 1411 lines, `est-edge-116` to `-119` sit exactly on them), the law's
    withholding on a separate return (partner paychecks only on joint rows), and the page's due dates (equal to
    the law's in 2025-2026). The script asserts all three on every row.
12. **Births.** The brief's 1960-1995 range clashes with "nobody 65 or older": a person born on or before January
    1 of (year - 64) counts as 65 at year end (Form 1040 instructions). Births run from January 2, 1961 (2025) and
    January 2, 1962 (2026); `est-edge-120` and `-121` sit on that day.
13. **Head of household with no dependents** is possible (a qualifying child released to the other parent), and
    the key does not test it; the tax needs only the status.
14. **Paychecks left** follow the page's formula, floor(days / 365.25 x n), which often counts one fewer than a
    calendar would (August 1, monthly: 4, though five 15th-of-the-month paydays remain). A contrast counting real
    biweekly paydays needs a first payday; the rows have none, so that contrast is not possible and is skipped.
15. **California** is a control: no California holiday is modelled. The second clause of 7503 (a statewide
    holiday where the IRS office is) turns on where the payment is due, not where the filer lives (Rev. Rul.
    2015-13), and no state holiday other than D.C.'s is modelled for the law.
16. **Not verified on an official source** (from RULES.md section 12): the January 18, 2028 and January 31, 2028
    dates (computed); the 2027 dates (Pub. 509 (2027) is a draft); closures ordered at short notice in 2027-2028;
    the 2026 Tax Table (the 2025 method is assumed); the 2024 January 31 option (computed, January 31, 2025, not
    compared with a print).
17. **Inputs the brief left open:** all the mixes under "The generator": the share of each status, state and
    `today`, the income bands, the last-year mixes, the withholding target and split, and the payment patterns.

## What the key leaves out (on purpose)

Tax year 2027 households; the addition to tax itself and its interest rate; the annualized income installment
method (6654(d)(2)) and Form 2210 Schedule AI; the election to use actual withholding dates; waivers for casualty,
disaster, retirement after 62 or disability (6654(e)(3)); farmers and fishermen (6654(i)); the January 31 option's
effect on the fourth installment; self-employment tax, wages, credits, dependents, itemized deductions, the senior
deduction and the 65+ standard deduction; the net investment income tax and the AMT (shown never to apply);
splitting or adding last year's tax when the filing status changed (the typed figure is taken as already right
for this year's status); state estimated tax; disaster postponements and other ad hoc relief.
