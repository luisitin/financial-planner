# Property answer key: rental depreciation, passive losses, the home sale

One independent answer key for two pages, "Rental analysis" and "Home" (with the federal tax on selling it):

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `property_key.py` | `tests/golden/property/depreciation.csv` | 1,500 | depreciation alone: a basis, the month and year placed in service (1995 to 2026) and a tax year from that year to 30 years later. Every month's first year, the 3.636 / 3.637 alternation, recovery years 28 and 29, the years after the end. Output: the page's formula, the law's Table A-6 amount, the difference, both running totals |
| | `tests/golden/property/rentals.csv` | 2,000 | invented households with one to three rentals, tax year 2025 or 2026. Per rental: the page's money figures and ratios, depreciation, the taxable result, the page's usable and carried loss and tax line, the law's allowed and suspended loss. Per household: the page's marginal rate, loss room and total tax line; the law's net passive result, allowance, allowed and suspended loss (Form 8582) and federal tax change with the 3.8% tax |
| | `tests/golden/property/homes.csv` | 1,500 | invented households with a home. The page's equity, LTV, growth since bought, the year's costs, values ahead, and the sale today with its flat rate. The law: the 2-of-5-year test, the exclusion, the term, the federal tax on the sale with the 3.8% tax, the keep figure, and 121(c)'s reduced exclusion as a contrast |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the model as small
functions. `tests/golden/property/RULES.md` gives each rule in plain words with the source text, and works six examples by
hand (section 9). Those examples are rows `rent-2026-sgl-0001` (Ivo), `-0002` and `-0003` (Jun), `rent-2025-mfs-0004` and
`-0005` (Kit), `rent-2026-mfj-0006` (Mo and Noor) of rentals.csv, and `home-2026-sgl-0001`, `-0002` (Pat) and `-0003`
(Quinn) of homes.csv; the duplex's depreciation schedule is `dep-0003` to `dep-0007` of depreciation.csv.

**Independence.** This key was written from the law (26 U.S.C. 121, 168, 469, 1222, 1411), the regulations (26 CFR 1.121-1,
1.121-3, 1.469-1T, 1.469-2T, 1.469-4, 1.1411-4), IRS Publications 523, 527, 550, 925 and 946, Form 8582 and its
instructions, the Form 1040 and Form 8960 instructions and Rev. Procs. 2024-40 and 2025-32, all read through `rules.py`
and RULES.md. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs the
app. The only things taken from `tools/golden_tax_lots/` and `tools/golden_estimated/` are their layout and conventions; no
figure or code is shared. The federal brackets, standard deductions and 0/15/20% tops agree with
`tests/golden/taxes/RULES.md` and `tests/golden/tax-lots/RULES.md`, which are cited for comparison only.

The pages' documented model (the brief's "page convention") is the spec. Where the law says otherwise, the main column
follows the law and a contrast column keeps the page's way.

The script works every row in two separate ways. It refuses to write any CSV if, between the two:
- an amount differs by more than a cent,
- a rate or ratio differs by more than 1e-6, or
- any other value (count, date, term, flag, label, Table A-6 percentage) differs at all.

In fact they agree exactly, before rounding, on every value of depreciation.csv (9,000 amounts, 6,000 other values) and
rentals.csv (125,225 amounts, 24,934 rates and ratios, 12,467 other values). In homes.csv the 13,500 other values agree
exactly; 4,025 of the 49,500 amounts differ before rounding by less than $0.00000001 (the values ahead, which derivation 2
works in whole units of 1e-8 dollars, rounded down), and 3,903 of the 10,500 rates differ by at most 5.0e-20 (growth since
bought: Decimal logarithms against fixed-point bisection).

## Run

```
python3 -B -I tools/golden_property/property_key.py
```

Python 3 standard library only (made with 3.13; about 11 seconds). The run is deterministic: `random.Random(20261031)`, and
the generator draws only integers, never a float. A second run writes byte-identical files. This was checked with two runs
into separate folders and a third into the real one:

| File | sha256 |
|---|---|
| depreciation.csv | `e202f78dac372623880ae3adc890cc54098440c891f36f5a26bdfad317b5b3ae` |
| rentals.csv | `571b79f915285bb4856b32015f63abed8d867e360d653e26afeca5bc6e200682` |
| homes.csv | `9e01d07df60284f227df45c1bd167872ffc781fd422e991f6e5223d703ef4e7b` |

The script sets `sys.dont_write_bytecode` *before* it imports `rules.py`, and `-B` covers Python's own cache, so no
`__pycache__` lands in the repo. `-I` keeps the environment and the current folder off the import path; the script puts its
own folder on it to find `rules.py`.

What a run does, in order:
1. Importing `rules.py` runs its 150 self-checks.
2. Derivation 2 is checked against RULES.md's worked examples and the sources' own examples (87 assertions): the Table A-6
   rebuild against all 342 printed entries, the largest yearly and running gaps (7/11000 and 97/33000 of a percent), P527's
   $160,000 February building, P946's July 2023 building, the duplex schedule, P925's Terry, $70,000 and $120,000 examples,
   1.121-3(g) Examples 1 and 2, 1.121-1(c)(4) Example 3, P550's holding-period example, 1.1411-4(d)(3)(ii) Example 3, and
   the edge rows' hand figures.
3. All three CSVs are worked, every row both ways.
4. 133 coverage minimums taken from the brief are checked.
5. The CSVs are written only once all of that has passed, and the run prints every check count, the coverage and the three
   sha256.

Options:
- a folder argument writes the CSVs there instead (`property_key.py /tmp/x`);
- `--mutate NAME` puts one deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script);
- `--skip-examples` turns off the examples check, so the row guard has to find a mistake alone.

That is how the table under "Deliberate mistakes" was made.

`tests/golden/property/todo.json` lists, by cause, the rows where a page disagrees with this key. The first comparison
(2026-10-31, `tests/golden-property.test.mjs`) found every page-convention column in agreement with the pages and nine causes
in the law columns, all "app wrong" when checked against the sources: on the Rental page `rentlaw-separate-together` (23
rows), `-no-netting` (385), `-in-order` (86), `-one-rate` (973) and `-no-niit` (713); on the Home page
`homelaw-two-year-test` (276), `-short-term` (113), `-flat-rate` (609) and `-niit-whole-gain` (448). A row can be under more
than one cause. The test's `WHY` gives each cause's reason and source.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the `rules.py` docstring
and RULES.md section 1 give the sha256 of each copy. No source was read again for this script, and the script adds no
figure of its own. Every amount, date rule and line it uses comes from `rules.py` (derivation 1) or is restated from the
brief and the sources below (derivation 2's page conventions, Form 8582's lines).

| Tag | Source | Used for |
|---|---|---|
| USC168, P946, P527 | 26 U.S.C. 168(b)(3)(B), (b)(4), (c), (d)(2), (d)(4)(B), (i)(6); Publication 946 (2025) "Figuring the Deduction Without Using the Tables" and Appendix A Table A-6 (p.73); Publication 527 (2025) Land, Additions or improvements, Table 2-2d | straight line over 27.5 years, mid-month convention, the last year takes the unrecovered basis; land is not depreciated; the percentage table |
| USC469, CFR14691, CFR14692, F8582, I8582, P925 | 26 U.S.C. 469(a), (b), (c)(2), (d)(1), (i)(1)-(3), (i)(5), (j)(4); 26 CFR 1.469-1T(f)(2), 1.469-2T(b)(1); Form 8582 (2025) Parts I-VIII and its instructions; Publication 925 (2025) | netting of passive income and losses; the $25,000 allowance and its phase-out from $100,000; $12,500 / $50,000 on a separate return only when the spouses lived apart all year, else none; the pro rata split of the allowed and suspended loss; modified AGI without the passive loss |
| USC1411, CFR14114, I8960 | 26 U.S.C. 1411(a)(1), (b), (c)(1); 26 CFR 1.1411-4(a), (d)(3)(ii) Example 3, (f); Form 8960 instructions (2025) lines 4a and 13 | 3.8% of the lesser of net investment income and MAGI over 250,000 / 125,000 / 200,000; net rental income and the taxable home gain are net investment income, the excluded gain is not |
| USC121, CFR1211, CFR1213, P523 | 26 U.S.C. 121(a), (b)(1)-(3), (c); 26 CFR 1.121-1(c)(1), (c)(4) Example 3; 1.121-3(g); Publication 523 (2025) | 2 years of the last 5 as owner and main home (730 days or 24 full months); $250,000 / $500,000; the reduced maximum exclusion by days / 730 or months / 24; a loss is not deductible |
| USC1222, P550 | 26 U.S.C. 1222(1)-(4); Publication 550 (2025) Holding Period | long-term only when held more than 1 year, counted from the day after the purchase |
| I1040, RP2440, RP2532 | Form 1040 instructions (2025), Qualified Dividends and Capital Gain Tax Worksheet; Rev. Proc. 2024-40 s.2.01, s.2.03; Rev. Proc. 2025-32 s.3.01, s.4.01, s.4.03, s.4.14(1) | the brackets, printed "The Tax Is" bases, standard deductions and 0% / 15% tops for 2025 and 2026; a gain stacked on top, capped at the regular tax (line 25) |
| FEDKEY, TLKEY | `tests/golden/taxes/RULES.md`, `tests/golden/tax-lots/RULES.md` | comparison only (same federal figures); TLKEY's convention R2 for the page's rate |

## Figures

| Figure | Value | Source |
|---|---|---|
| Recovery | 27.5 years, straight line, mid-month (half of the month placed in service counts) | USC168 (b)(3)(B), (c), (d)(2), (d)(4)(B) |
| Special allowance | $25,000 less 50% of modified AGI over $100,000; separate return, lived apart all year: $12,500 less 50% over $50,000; separate return, lived together at any time: none | USC469 (i)(2), (i)(3)(A), (i)(5) |
| Home sale exclusion | $250,000; $500,000 joint; 730 days or 24 full months in the 5 years before the sale | USC121 (a), (b); CFR1211 (c)(1) |
| NIIT | 3.8% above MAGI 200,000 single and head, 250,000 joint, 125,000 separate (not indexed) | USC1411 (a)(1), (b) |
| Brackets, standard deductions, 0% / 15% tops | as in RULES.md section 6.1 (2025: single 0% to 48,350, 15% to 533,400; joint 96,700 / 600,050; separate 48,350 / 300,000; head 64,750 / 566,700. 2026: 49,450 / 545,500; 98,900 / 613,700; 49,450 / 306,850; 66,200 / 579,600) | RP2440; RP2532 |
| Page conventions | land 20%, vacancy 5%, maintenance 1% of value, management 0, growth 3.5%, selling costs 6% (all when blank); 12 payments in the loan year, stopping at a balance of $0.005 or less; $1,000 step for the marginal rate; the page's 20% line 600,050 joint / 533,400 others and 3.8% line 250,000 joint / 200,000 others in every year; exclusion always applied; money to the cent, rates and ratios to six decimals | the brief (no legal source) |

## Who each row is

- **depreciation.csv.** One building: a basis (cents allowed), a month placed in service, a tax year. Nothing else.
- **rentals.csv.** One federal return for `tax_year` (2025 or 2026; `today` is a day of that year):
  - one adult under 65 on the plan, no dependents, the standard deduction; a spouse of a married filer has no income;
  - W-2 `wages` (whole dollars) are the only other income; AGI before the rentals = the wages;
  - `lived_apart_all_year` is `yes` or `no` on a separate return, blank otherwise;
  - one to three rentals, each placed in service in its `purchase_date` month, 1998 to `today`; the filer actively
    participates in every one, each is its own activity, nothing is carried in from earlier years.
- **homes.csv.** One federal return for `tax_year`; the same household, with a home owned and lived in as the main home
  since `purchase_date` (1975 to `today`), sold `today`. No other sale of a home in the two years before, no rental or
  business use of it.

## How each row is worked (derivation 1: rules.py)

- **depreciation.csv.** `rules.depreciation_exact` (the page and the statute), `depreciation_table` and `table_a6` (the
  printed percentages); the running totals are sums of those per year; `year_is` and the months from a basis of 27.5 (a
  full year is $1).
- **rentals.csv.** The CSV's input strings go into `rules.rental_case`:
  - `rental_money` (the page's money figures and ratios, with `loan_year`), `depreciable_basis`, `depreciation_exact` and
    `depreciation_table`;
  - `passive_law` (netting, the allowance, the pro rata split) and `passive_page` (the page's room, in order);
  - `page_marginal_rate` and `federal_tax` (`regular_tax`, `qdcg_tax`, `niit`) without and with the allowed net result.
- **homes.csv.** `rules.home_case` (`whole_months_page` M1 / M2 / M3, `growth_since_bought` in 60-digit Decimal,
  `loan_year`, `days_owned`, `full_months_law`, `meets_two_of_five`, `first_long_day`, `federal_tax` with and without the
  gain), plus `federal_tax` on the wages alone for `law_tax_without`.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, with its own parser of the CSV's input strings (numbers and dates) and without calling a
`rules.py` function. It uses `rules.py`'s federal tables only (bracket tops, printed bases, rates, standard deductions, 0% and
15% tops, NIIT lines); the page's defaults and lines, the allowance figures and the exclusion caps are restated from the
brief and the sources.

- **Depreciation.** The share of the 660 half-months of 27.5 years in service by each year end (25 - 2 x month in the
  first year, 24 a year after, at most 660): a year's amount is the difference of two cumulative figures. `rules.py` works
  a first year, full years and the remainder.
- **Table A-6.** Rebuilt in integer thousandths of a percent by its rounding rule (year 1 rounded half up; then the rest
  x 24 / half-months left, rounded half up; the remainder once a year or less is left) and checked against the printed
  table. `rules.py` reads the printed table.
- **The loan year.** Closed form: after k uncut payments the balance is b g^k - p (g^k - 1) / (g - 1), g = 1 + rate / 12
  (b - p k at a rate of 0); the year stops at the first k whose balance is $0.005 or less, and that payment is cut to what
  is owed; interest = paid - (opening - closing balance), at most what was paid. `rules.py` loops month by month.
- **Passive losses.** A literal walk through Form 8582: Part I lines 1a-1d, 2a-2d and 3 (the rentals in Part V on a
  separate return whose spouses lived together), Part II lines 4-9 (line 5 $150,000 or $75,000, line 6 modified AGI,
  line 8 half the difference, at most $25,000 or $12,500), Part III lines 10-11, Part VI (the allowance by ratio), Part VII
  (the unallowed loss C = A - B by the Part VI column (d) ratios) and Part VIII. The allowed net result is line 3 when it is
  0 or more, else minus line 9. `rules.py` nets the totals and spreads the suspended loss by each loss over all losses.
- **The page's loss room.** From the form's lines 5-8 without the lived-apart test; each loss takes the room less all
  earlier losses (never below 0). `rules.py` keeps a running remainder.
- **Tax.** The revenue procedure's own form: the "Over $X but not over $Y" row (bisection on the tops), the printed "The
  Tax Is" base plus the rate on the excess. A long-term gain is the top slice of taxable income, taxed 0 / 15 / 20% where
  it overlaps the bands, capped at the regular tax. `rules.py` sums each bracket's slice and runs the worksheet's 25 lines.
- **Home dates.** Days owned from day-of-year counts and year lengths; full months from the calendar-month difference and
  one day test (the month's last day for a month-end purchase or a shorter month); the first long-term day as the day after
  the purchase moved one year on (a start on February 29: March 1); M1 by stepping plain (year, month, day) triples; M3 as
  days x 48 // 1461. `rules.py` uses date subtraction, a loop over month ends, Rev. Rul. 66-7's month-end rule and int().
- **Growth since bought.** Bisection in 2^-64 fixed point on t >= 1 with t^months = r^12 (r = value / price, or its inverse
  for a fall in value), no logarithms. `rules.py` takes exp(ln(ratio) x 12 / months) at 60 digits.
- **Values ahead.** value x (1 + growth)^n in whole units of 1e-8 dollars, rounded down. `rules.py` is exact.

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up (away from zero for losses). Rates and
  ratios are rounded the same way to six decimals; `months_counted` and Table A-6 percentages are exact as written.
- Ties are real: written amounts that sit exactly on a half cent before rounding number 1 in depreciation.csv, 359 in
  rentals.csv and 72 in homes.csv. They come from shares with three or four decimals times money (vacancy 0.125,
  maintenance 0.0075, selling costs 0.055) and from a rate times a result. They are rounded away from zero; a page that
  rounds half to even, or in floating point, can be a cent off there.
- Totals are sums of exact values, so a written total can differ from the sum of its written parts. In rentals.csv the
  written per-rental tax lines miss the written `page_tax_line_total` by a cent in 161 rows (never more). A page that rounds
  each rental first needs that tolerance.
- The page's marginal rate comes from federal totals rounded to the cent (R2, inherited from TLKEY); with whole-dollar
  wages every total is already whole cents, so R2 changes nothing here.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder twice: once with the examples check, and once without it
(`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | Examples check | Row guard |
|---|---|---|
| the first year counts the whole month placed in service | caught (Table A-6 gaps) | refused at `dep-0001` (months 10.5 vs 11) |
| Table A-6 rebuilt rounding down | caught (rebuild, January) | refused at `dep-0001` (3.182 vs 3.181) |
| the last loan payment is never cut | caught (paid off in month 2) | refused at `rent-2026-sgl-0042` (debt service 4,050.75 vs 5,000.00) |
| no 469(d)(1) netting | caught (9.2 Jun) | refused at `rent-2026-sgl-0002` (allowed 30,000 vs 25,000) |
| a separate return gets the allowance though the spouses lived together | caught (9.3 Kit) | refused at `rent-2025-mfs-0004` |
| the phase-out starts at $150,000 | caught (9.2 at 130,000) | refused at `rent-2026-sgl-0003` |
| the suspended loss put on the rentals in order | caught (P925 Terry) | refused at `rent-2025-mfs-0007` |
| net rental income not net investment income | caught (9.4) | refused at `rent-2026-mfj-0006` (51,875.26 vs 51,546.21) |
| modified AGI includes the rentals | caught (9.2 at 130,000) | refused at `rent-2026-sgl-0003` |
| the 2-of-5-year test met at 729 days | caught (729 edge) | refused at `home-2025-sgl-0005` |
| long-term on the anniversary | caught (P550 example) | refused at `home-2026-sgl-0001` (2026-05-17 vs 05-16) |
| 3.8% on the whole gain once over the line | caught (NIIT part way) | refused at `rent-2026-sgl-0035` |
| 2026 gains stacked through 2025's tops | caught (9.6 Quinn) | refused at `home-2026-sgl-0003` (70,920.00 vs 71,525.00) |
| whole months by the calendar difference (M2) | not caught | refused at `home-2025-sgl-0004` (23 vs 24) |
| a joint return excludes at most $250,000 | caught (joint 2025 edge) | refused at `home-2025-mfj-0018` |

In all thirty runs no CSV was written.

## The generator

Edge rows come first, then random rows. Nothing is redrawn: every draw goes through both derivations and the guard.

### depreciation.csv: 181 edge rows (`dep-0001` to `-0181`), then 1,319 random rows

| Rows | What they pin down |
|---|---|
| `0001`, `0002` | P527's $160,000 February building ($5,091.20 by the table, $5,090.91 by the formula); P946's $100,000 July 2023 building ($3,636 for 2025) |
| `0003` to `0007` | RULES.md 9.1: the duplex's 2019, 2026, 2028, 2046 (the last) and 2047 |
| `0008` to `0010` | RULES.md s.4: basis 27.50 placed in service March 1998 (last year 2025, nothing in 2026) and August 1998 (1.5 months in 2026) |
| `0011` to `0014` | basis 0 and one cent |
| `0015` to `0181` | every month: recovery years 1, 2, 9, 10, 11, 27, 28, 29, 30, 31 and four more first years, on ten bases |

Random rows: placed in service uniform over 1995 to 2026 and the twelve months; tax year 0 to 30 years later, uniform. Basis:
whole thousands $50,000 to $1,500,000 (45%), cents $10,000 to $3,000,000 (40%), under $1,000 (10%), a multiple of $55 (5%).

### rentals.csv: 59 edge rows (`rent-YYYY-sss-0001` to `-0059`), then 1,941 random rows (`-0060` to `-2000`)

`sss` is `sgl`, `mfj`, `mfs` or `hoh`, and the number runs over the whole file.

| Rows | What they pin down |
|---|---|
| `0001` to `0006` | RULES.md 9.1 to 9.4 |
| `0007` to `0009` | P925's Terry (suspended 7,560 / 13,440), its $70,000 / $15,000 / $26,000 example (11,000 against wages) and its $120,000 / $31,000 example (deduct 15,000, carry 16,000) |
| `0010` to `0024` | a -30,000 rental at wages 60,000, 100,000, 125,000, 150,000, 160,000; single 2025, joint 2026, head of household 2025 |
| `0025` to `0031` | separate return, a -15,000 rental: lived apart at 40,000, 50,000, 62,500, 75,000, 80,000; lived together at 40,000 and 62,500 |
| `0032` to `0034`, `0058`, `0059` | netting with the allowance binding; income covering every loss; three losses pro rata against in order; a separate return lived apart with netting; two losses over the allowance |
| `0035` to `0038` | NIIT part way (single 205,000), on a separate return (125,000 line), on a net of two rentals, and off for a net loss |
| `0039` to `0041` | the $1,000 step straddling the standard deduction (0.025); no wages; the allowed loss above the wages (AGI below 0) |
| `0042` to `0049` | a loan paid off in month 5; a rate of 0; a payment below the interest; a loan typed with balance 0; value 0; cash in blank and 0; no rent; purchase price 0 |
| `0050` to `0057` | depreciation's last year (March 1998 in 2025; August 1998, June 1999, December 1998 in 2026) and none after it (March 1998 in 2026); placed in service in the tax year (November 2026, January 2025); a taxable result of exactly 0 |

Random rows:
- **Year** 2025 or 2026, even odds. **Status:** single 32%, joint 32%, separate 16% (lived apart or not, even odds), head of
  household 20%. **Today:** uniform over the year.
- **Wages** (whole dollars). Not separate: within $1,500 of the standard deduction 4%, under 100,000 30%, exactly 100,000 3%,
  100,000 to 150,000 25%, exactly 150,000 3%, 150,000 to 200,000 12%, the 3.8% line - 30,000 to + 200,000 17%, 400,000 to
  1,500,000 6%. Separate: under 50,000 22%, exactly 50,000 3%, 50,000 to 75,000 25%, exactly 75,000 3%, 75,000 to 125,000
  22%, 110,000 to 400,000 25%.
- **Rentals:** one 45%, two 35%, three 20%. Each: placed in service 1998 to today; price $60,000 to $1,500,000 (10% with
  cents); value 70% to 320% of it (0 in about 1 in 150); rent 0.35% to 1.10% of value a month; land, vacancy,
  maintenance, management, growth blank about 45% of the time, else a typed share; property tax 0.4% to 2.5% of value;
  insurance $500 to $4,500; HOA, utilities, other costs blank, 0 or typed; improvements blank, 0 or up to $60,000; cash in
  blank 15%, 0 3%.
- **Loan:** none 30%; amortizing over 3 to 30 years at 2.5% to 8.5% (52%); paid off within the year (6%); a rate of 0 (4%);
  interest-only (6%); a payment below the interest (2%).

### homes.csv: 90 edge rows (`home-YYYY-sss-0001` to `-0090`), then 1,410 random rows

| Rows | What they pin down |
|---|---|
| `0001` to `0003` | RULES.md 9.5 (Pat, and Pat bought 10 months ago) and 9.6 (Quinn) |
| `0004` to `0016` | 730 days before 24 full months (February 29 inside), 729, 730 with 24, 728, 729 without February 29; the anniversary and the day after; February 29, 2024 seen on 2025-02-28, 2025-03-01, 2026-02-28; M1 / M2 / M3 differing; bought today |
| `0017` to `0019` | a gain of exactly $250,000; $500,000.01 joint; a loss |
| `0020` to `0075` | every year and status: a taxable gain wholly in the 0% band, straddling the 0% top, wholly at 15%, straddling the 15% top, wholly at 20% (held long, or 500 days with no exclusion, alternately), and MAGI exactly at and 20,000 over the 3.8% line |
| `0076` to `0082` | the page's own lines: 533,400 exactly and plus a cent; 200,000 exactly and plus a cent; joint 600,050; a separate return between the law's 125,000 and the page's 200,000; head of household between the page's 533,400 and the law's 566,700 |
| `0083` to `0090` | short-term on a high income; bought in 1975; no mortgage; paid off in month 3; a rate of 0; interest-only; a mortgage above the value; value 0 |

Random rows:
- **Year** even odds. **Status:** single 32%, joint 32%, separate 14%, head of household 22%. **Today:** uniform.
- **Wages** (whole dollars): to 40,000 10%, to 150,000 30%, to 300,000 25%, the 3.8% line - 50,000 to + 100,000 20%,
  300,000 to 700,000 10%, 700,000 to 2,000,000 5%.
- **Held:** under 1 year 12%; the anniversary or a day either side 4%; 366 to 729 days 16%; 727 to 733 days 5%; 731 days
  to 5 years 13%; 5 to 45 years 50%.
- **Value:** 85% to 135% of the price for holdings up to about two years, 90% to 170% to five, 110% to 600% beyond. Price
  $80,000 to $2,000,000 (10% with cents). Selling costs blank 50%, else 0% to 8%. Costs and growth as for rentals.
- **Mortgage** as for rentals' loans.

## Coverage (from the run)

**depreciation.csv**

| | Rows |
|---|---|
| total | 1,500 (181 edge, 1,319 random) |
| first year / full / last / after the end | 109 / 1,211 / 59 / 121 |
| first years per month placed in service (Jan ... Dec) | 12 / 7 / 9 / 9 / 7 / 9 / 8 / 11 / 7 / 10 / 12 / 8 |
| recovery year 28 / 29 / 30 / 31 | 57 / 50 / 52 / 45 |
| placed in service 1995-1999 / 2025-2026 / tax year after 2026 | 233 / 107 / 662 |
| Table A-6 differs from the formula after rounding / by more than $1 / largest | 1,251 / 1,023 / $19.01 (running totals: $82.19) |

**rentals.csv**

| | Rows |
|---|---|
| total | 2,000 (59 edge, 1,941 random); 3,489 rentals |
| year 2025 / 2026 | 997 / 1,003 |
| single / joint / separate / head of household | 654 / 633 / 321 / 392 |
| separate: lived apart / together | 160 / 161 |
| not separate: wages under 100,000 / exactly 100,000 / 100,000-150,000 / exactly 150,000 / above | 608 / 56 / 389 / 45 / 581 |
| separate, apart: under 50,000 / exactly 50,000 / 50,000-75,000 / exactly 75,000 / above | 35 / 5 / 33 / 5 / 82 |
| separate, together: under 50,000 / exactly 50,000 / 50,000-75,000 / exactly 75,000 / above | 45 / 7 / 42 / 7 / 60 |
| one / two / three rentals | 904 / 703 / 393 |
| a rental with income and one with a loss / every rental a loss / two or three, all losses / every rental income | 546 / 436 / 116 / 1,017 |
| rentals: no loan / paid off within the year / rate 0 / no payment made (balance 0) | 1,058 / 207 / 120 / 1 |
| rentals placed in service per month (Jan ... Dec) | 338 / 323 / 290 / 272 / 278 / 301 / 305 / 274 / 278 / 259 / 267 / 304 |
| rentals: first year / last year of depreciation / fully depreciated before | 116 / 85 / 23 |
| rentals: value 0 / cash-on-cash blank / return on equity blank | 31 / 620 / 31 |
| NIIT by law on / off / off with a net rental income | 713 / 1,287 / 702 |
| law suspends / page carries / they differ / netting lowers the suspended loss / same total, split differs | 421 / 683 / 392 / 372 / 53 |
| separate return, lived together: the page allows a loss the law does not | 50 |
| law and page tax differ by more than $1 (law higher / lower) / agree to the cent | 1,383 (1,130 / 253) / 616 |
| marginal rate 0 / strictly between 0 and 0.10 / AGI below 0 after the rentals | 156 / 28 / 38 |

**homes.csv**

| | Rows |
|---|---|
| total | 1,500 (90 edge, 1,410 random) |
| year 2025 / 2026 | 772 / 728 |
| single / joint / separate / head of household | 469 / 477 / 221 / 333 |
| short-term / the anniversary (short) / long-term but the test fails / 729 days / 730 days / 730 days before 24 months | 212 / 18 / 284 / 14 / 14 / 4 |
| held 2 to 5 years / more than 5 years | 233 / 771 |
| test met / not met | 1,004 / 496 |
| a loss / gain up to the exclusion / over it / exactly it | 295 / 457 / 748 / 1 |
| 2025 law band 0 / 0-15 / 15 / 15-20 / 20 / 0-15-20 | 11 / 38 / 94 / 215 / 52 / 44 |
| 2026 law band 0 / 0-15 / 15 / 15-20 / 20 / 0-15-20 | 14 / 27 / 101 / 193 / 37 / 56 |
| short-term taxable gain 2025 / 2026 | 54 / 59 |
| 3.8% line, with a taxable gain: 2025 above / at or below; 2026 above / at or below | 458 / 52; 420 / 67 |
| page rate 15% / 20% / with 3.8% / without | 195 / 553 / 681 / 67 |
| no mortgage / paid off within the year / rate 0 | 499 / 87 / 57 |
| M1 differs from M2 / from M3 / growth blank (under 12 months) | 704 / 61 / 196 |
| law and page tax differ by more than $1 (law higher / lower) | 869 (283 / 586) |
| the reduced exclusion would change the tax | 264 |

## CSV columns

Money has two decimals. Rates and ratios have six. Dates are ISO (`2026-04-15`). Flags are `yes` / `no`. A blank means "not
typed" in an input column and "does not apply" in an output column.

**depreciation.csv**

`case_id, row_kind, basis, placed_in_service, tax_year, recovery_year, year_is, months_counted, depreciation_page,
table_a6_percent, depreciation_law_table_a6, table_minus_page, cumulative_page, cumulative_table_a6, unrecovered_page, note`

- `placed_in_service` is `YYYY-MM`. `recovery_year` = tax year - year placed in service + 1. `year_is`: `first`, `full`,
  `last` (the year that takes what is left) or `after_end`.
- `months_counted`: the months of the year the formula counts (10.5 for February in the first year, 12.0, 8.5 ...).
- `depreciation_page`: basis / 27.5 x months_counted / 12, never beyond the basis (the page's formula; the statute's
  arithmetic too, so it is lawful).
- `table_a6_percent`: P946 Table A-6 for the month and recovery year (blank after the table ends);
  `depreciation_law_table_a6` = basis x that percentage (the IRS table, which a return may use instead); `table_minus_page`.
- `cumulative_*`: through the tax year. `unrecovered_page` = basis - `cumulative_page`.

**rentals.csv**

Inputs: `case_id, row_kind, tax_year, today, filing_status, lived_apart_all_year, wages, rentals`

- `rentals`: one rental per `;`, fields joined by `|` in this order (blank allowed): `purchase_price | purchase_date (YYYY-MM)
  | land_share | improvements | value | rent_monthly | vacancy | property_tax | insurance | hoa_monthly | maintenance |
  management | utilities_monthly | other_monthly | loan_balance | loan_rate | loan_payment | cash_in | appreciation`.
  Shares are decimals (0.05 = 5%). No loan: the three loan fields blank.

Outputs per rental, in input order, one rental per `;`, fields joined by `|`:

- `rental_results`: `rent | vacancy | income | opex | noi | cap_rate | debt_service | interest | principal | cash_flow |
  cash_on_cash | dscr | break_even | one_percent | basis | depreciation | taxable | loss_usable | loss_carried | tax_line |
  after_tax | equity | growth | total_return | return_on_equity` (the page convention; `depreciation` is the formula, which
  is also the law's main column). Blank: `cap_rate` at value 0, `cash_on_cash` with cash in blank or 0, `dscr` without a
  loan or with no payment made, `break_even` with no rent, `one_percent` at price 0, `return_on_equity` at equity 0 or less.
- `rental_law`: `allowed_loss | suspended_loss | allowed_result`: the law's loss allowed this year (0 for a rental with
  income), the loss suspended to next year, and the signed result that reaches the return.
- `rental_depreciation`: `recovery_year | depreciation_table_a6 | table_minus_page | placed_this_year`.
- `rental_loan`: `payments_made | balance_after` (blank without a loan).

Outputs per household:

- `marginal_rate`: the page's rate from $1,000 more ordinary income on the wages alone.
- `page_loss_room`: the page's allowance (no lived-apart test). `page_loss_usable_total`, `page_loss_carried_total`,
  `page_tax_line_total` (sum of the exact lines), `cash_flow_total`, `page_after_tax_total`.
- `law_net_passive`: the rentals' net result (Form 8582 line 3). `law_passive_activity_loss`: its loss, if any.
  `law_allowance`: the special allowance available (line 8; 0 on a separate return whose spouses lived together).
  `law_allowed_against_wages`: line 9. `law_loss_allowed_total`: all the rentals' losses allowed this year (line 11, or
  every loss when line 3 is 0 or more). `law_suspended_total`. `law_allowed_net`: the net result that reaches AGI.
- `law_tax_without`, `law_tax_with`: income tax + NIIT on the wages, and with `law_allowed_net` added (its positive part
  is net investment income). `law_niit_change`, `law_tax_change` (with - without), `law_after_tax_total` = cash flow total
  - `law_tax_change`, `law_minus_page` = `law_tax_change` - `page_tax_line_total`, `ratio_law_to_page` (blank when the page
  total is 0).
- `note`: on an edge row, what it pins down; on every row, the notable things (lived together on a separate return,
  netting, law and page suspending differently, NIIT, a loan paid off, payments at or below the interest, depreciation's
  last year or none, placed in service this year, value 0, AGI below 0).

**homes.csv**

Inputs: `case_id, row_kind, tax_year, today, filing_status, wages, value, purchase_price, purchase_date, improvements,
sell_share, property_tax, insurance, hoa_monthly, maintenance, appreciation, loan_balance, loan_rate, loan_payment`

Outputs:

- Page: `equity`, `ltv` (blank at value 0), `months_owned` (M1) and `growth_since_bought`, `months_owned_m2` and
  `growth_m2`, `months_owned_m3` and `growth_m3` (growth blank under 12 months), `cost_property_tax`, `cost_insurance`,
  `cost_hoa`, `cost_maintenance`, `cost_interest`, `costs_year`, `loan_payments_made`, `sell_costs`, `basis`, `gain`,
  `page_exclusion`, `page_taxable_gain`, `page_taxable_income` (convention H6), `page_rate` (shown even when nothing is
  taxed), `page_tax`, `page_keep`.
- Law: `days_owned`, `full_months_owned`, `meets_2_of_5`, `law_exclusion_max` (0 when the test fails), `law_exclusion`,
  `law_taxable_gain`, `first_long_day`, `term` (`short` / `long`), `law_tax_without`, `law_income_tax`, `law_niit`,
  `law_tax` (with - without), `law_keep` = value - selling costs - mortgage - `law_tax`, `law_minus_page_tax`.
- Contrast (121(c), if the sale were for work, health or an unforeseen event): `reduced_fraction_days` (days / 730),
  `reduced_fraction_months` (full months / 24), both 1 when the test is met; `reduced_max_days`, `reduced_max_months`; then,
  by days, `reduced_exclusion`, `reduced_taxable_gain`, `reduced_tax`, `reduced_keep`.
- `value_5y`, `value_10y`, `value_20y`; `note`.

## Open points (judgement calls a reviewer should know)

1. **Depreciation: the formula is the law's main column.** 168(b)-(d) give straight line, 27.5 years, mid-month; P946
   allows figuring it "without using the table". That is the page's formula, so the rentals use it for the taxable result.
   The brief calls Table A-6 "the law" for depreciation.csv, so that file names it `depreciation_law_table_a6`; it is the
   other lawful method (once started, the table must be kept for the whole recovery). The rule that rebuilds the table is
   `rules.py`'s finding, not read in Rev. Proc. 87-57.
2. **Improvements** join the building's basis from its own month (convention I1). By law each improvement is separate
   property with its own 27.5 years from its own month (168(i)(6)); the case gives no date.
3. **Passive activities.** Each rental is its own activity (G1), with active participation (C5) and nothing carried in
   (C4). Grouping would change only the per-rental split. Allowed and suspended losses go pro rata (469(j)(4),
   1.469-1T(f)(2), Form 8582 Parts VI-VIII). On a separate return whose spouses lived together at any time the rentals go
   to Part V: no allowance, but rental income still absorbs rental losses.
4. **Modified AGI** for the allowance is the wages (469(i)(3)(E): no passive loss in it). The brief's "469(i)(3)(F)" has been
   (E) since Pub. L. 115-141 (2018).
5. **The law's tax change.** The allowed net result is added to the wages as ordinary income; its positive part is net
   investment income (1411(c)(1)(A)(i)); MAGI includes it. The additional Medicare tax is on the wages only and cancels.
   AGI may fall below 0 (38 rows); taxable income then stops at 0 and no net operating loss is modelled.
6. **The page's rate** uses totals rounded to the cent (R2). Wages are drawn in whole dollars, so R2 is moot here.
7. **Placed in service this year** (116 rentals): the page's 12-month rent, costs and loan year are used as the tax year's
   (C6), though a real return would count only the months after.
8. **Blanks.** A blank share takes the page's default, a typed 0 is 0, a blank cost is 0. Cash-on-cash is blank when cash in
   is blank or 0; DSCR when there is no loan or no payment was made; return on equity when equity is 0 or less (E1). A loan
   is "none" only when all three loan fields are blank; a payment below the interest counts interest only up to what was
   paid (the brief).
9. **Whole months on the home page** are M1: months between the dates, less one when today's day of the month is before the
   purchase day. M2 (calendar months) and M3 (floor(days x 12 / 365.25)) are kept with their own growth. They differ often
   (M1 against M2 in 704 rows). M1 is not the law's full months: a home bought February 29, 2024 and sold February 28, 2026
   has 24 full months by law (L1) and 23 whole months by M1 (`home-2026-sgl-0013`).
10. **The 2-of-5-year test** is met by 730 days or 24 full months, whichever comes first (1.121-1(c)(1) "or"). Days come
    first when a February 29 lies inside (4 rows). Full months follow L1 (month ends).
11. **The home** was owned and lived in since the purchase, with no prior excluded sale, no nonqualified use and no
    depreciation (H1); on a joint return both spouses qualify ($500,000, H2); a separate return's filer alone owns it
    ($250,000). The sale date is today (H3). A loss is not deductible.
12. **The reduced exclusion** is a contrast only: the page cannot know whether the sale is for work, health or an
    unforeseen event. It is worked by days (H4); the months fraction and cap are shown too.
13. **The law's tax on the sale** stacks a long-term gain at 0 / 15 / 20% through the year's own tops with the worksheet's
    line 25 cap; a short-term gain is ordinary income. Only the taxable gain is net investment income (1.1411-4(d)(3)(ii)
    Example 3).
14. **The page's "federal taxable income"** in its 20% test is the wages less the year's standard deduction (H6); its AGI
    for the 3.8% test is the wages. Its lines are 2025's single and joint figures for every status and year (the brief):
    married filing separately is held to 200,000 on the page against 125,000 by law, and head of household to 533,400
    against 566,700 / 579,600.
15. **Rounding** happens only when a value is written; totals are sums of exact values (161 rental rows differ from their
    written parts by a cent).
16. **2026 forms.** The 2026 editions of Pubs. 523, 527, 925, 946 and the Form 8582 instructions do not exist yet; the 2025
    ones are applied. depreciation.csv runs to 2056 on the same rules.
17. **Not verified on an official source:** the Table A-6 rounding rule; Rev. Rul. 66-7 (month-end purchases, from TLKEY,
    cannot change a 2025-2026 sale's term); and every page convention the brief leaves open (M1, R2, H6, E1, blank
    handling), which need the pages' code, which the independence rule forbids reading. (The comparison of 2026-10-31 found
    the pages follow M1 and H6 on all 1,500 homes and E1 and the blank handling on every rental; R2 is moot with
    whole-dollar wages.)

## What the key leaves out (on purpose)

- Section 199A for rental income, the at-risk rules (465), net operating losses, AMT, credits, itemized deductions, the
  senior deduction and the 65+ standard deduction, state tax.
- Real estate professionals (469(c)(7)), rentals with personal use (280A), short-term rentals, prior-year suspended losses
  and passive credits.
- Depreciation recapture on a later sale of a rental; part-year rent for a rental placed in service this year.
- A home with rental or business use, nonqualified use after 2008, a like-kind exchange, a prior excluded sale within two
  years, a spouse who does not meet the use test, a surviving spouse's $500,000.
