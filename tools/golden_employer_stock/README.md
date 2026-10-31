# Employer stock answer key: vesting, concentration, the vests' tax, the sale

One independent answer key for one page, "Employer stock" (RSUs and stock options):

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `es_key.py` | `tests/golden/employer-stock/schedules.csv` | 1,500 | vesting alone: shares, `vest_start` (month ends and the 29th to 31st included), `vest_months`, `cliff_months` (0 included), `every`, today. Output: every vest's date and shares, how many vested and unvested today, the next vest, and the months that add no share |
| | `tests/golden/employer-stock/households.csv` | 2,500 | invented households (single, joint, a smaller set filing separately). The page's position (held value, vested options, owned, unvested, exposure, invested, share, level, the loss in a halving). The vests of the next 12 months by calendar year: the federal tax they add, what the employer withholds (22% / 37% and the 0.9%), the gap, Illinois' share. The sale that gets the company under 10% and its tax. Law and contrast columns beside |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the model as small
functions. `tests/golden/employer-stock/RULES.md` gives each rule in plain words with the source text, and works nine
examples by hand (section 9). Those examples are the first rows of households.csv:

| RULES.md | Rows |
|---|---|
| 9.1 Ari, 9.2 Bo, 9.3 Cal | `es-sgl-0001`, `-0002`, `-0003` |
| 9.4 Dee and Eli | `es-mfj-0001` |
| 9.5 Fay, and Fay at $230,000 | `es-sgl-0004`, `-0005` |
| 9.6 Gus, 9.6b at a loss, 9.7 with a December vest | `es-sgl-0006`, `-0007`, `-0008` |
| 9.8 Bea (the whole page) | `es-sgl-0009`; Bea's RSU schedule is `es-sch-0001` of schedules.csv |
| 9.9 Hal and Ivy (joint account, Hal's, Ivy's), 9.9b at a loss | `es-mfs-0001` to `-0004` |

**Independence.** This key was written from the law (26 U.S.C. 1, 83, 402, 1211, 1222, 1411, 3101, 3102, 3121), the
regulations (26 CFR 1.83-3, 31.3102-4, 31.3402(g)-1), IRS Publications 15 (2026), 15-B (2026) and 525 (2025), Form 8959
and its instructions, the Form 1040 and Form 8960 instructions, Rev. Proc. 2025-32 and the Illinois Department of
Revenue, all read through `rules.py` and RULES.md. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing
it, and it never imports or runs the app. The only things taken from `tools/golden_property/` and `tools/golden_paycheck/`
are their layout and conventions; no figure or code is shared. The 2026 federal brackets, standard deductions and
0/15/20% tops agree with `tests/golden/taxes/RULES.md`, `tests/golden/tax-lots/RULES.md` and
`tests/golden/property/RULES.md`, which are cited for comparison only.

The page's documented model (the brief's "page convention") is the spec. Where the law says otherwise, the main column
keeps the page's way and a law column gives the law, so the test can compare both. Where no official figure exists yet
(the 2027 federal tables), the main column is left blank and a contrast column works it on the latest published tables.

The script works every row in two separate ways. It refuses to write any CSV if, between the two:
- an amount differs by more than a cent,
- a rate, ratio or share count differs by more than 1e-6, or
- any other value (date, count, flag, label) differs at all.

In fact, on schedules.csv the two agree exactly on all 10,500 values. On households.csv all 70,466 other values agree
exactly. 17,850 of the 185,071 amounts differ before rounding, by at most $0.0000000232, because derivation 2 works in
whole units of 1e-8 dollars and rounds down where it divides (a vest's share of a year figure, the pro rata gain). 3,822
of the 7,147 rates, ratios and share counts differ by at most 1e-12 (derivation 2 works them in units of 1e-12).

## Run

```
python3 -B -I tools/golden_employer_stock/es_key.py
```

Python 3 standard library only (made with 3.13; about 6 seconds). The run is deterministic: `random.Random(20261031)`,
and the generator draws only integers, never a float. A second run writes byte-identical files. This was checked with two
runs into separate folders and a third into the real one:

| File | sha256 |
|---|---|
| schedules.csv | `e51980cdd3734759805c80fa3d977d1551385fd8d3f0a8358df5277edf74583e` |
| households.csv | `639f92945994f1b3420c0477ed62583fa1fa31affce4cb38c2b98775e74b460e` |

The script sets `sys.dont_write_bytecode` *before* it imports `rules.py`, and `-B` covers Python's own cache, so no
`__pycache__` lands in the repo. `-I` keeps the environment and the current folder off the import path; the script puts
its own folder on it to find `rules.py`.

What a run does, in order:
1. Importing `rules.py` runs its 3,037 self-checks.
2. Derivation 2 is checked against RULES.md's worked examples, the corner rows' hand figures and the sources' own examples
   (53 assertions, many of them several figures at once): RULES.md 9.1 to 9.9b; the vest, level and $1,000,000 edges; the
   Illinois corners; the line 24 cap; 26 CFR 31.3402(g)-1(a)(8) Examples 1 and 3 at their assumed 25% / 35%; Pub. 15
   section 7 Example 3 ($220); the schedules of RULES.md 3.1 and 9.8.
3. Both CSVs are worked, every row both ways.
4. 88 coverage minimums taken from the brief are checked.
5. The CSVs are written only once all of that has passed, and the run prints every check count, the coverage, the edge
   rows and the two sha256.

Options:
- a folder argument writes the CSVs there instead (`es_key.py /tmp/x`);
- `--mutate NAME` puts one deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script);
- `--skip-examples` turns off the examples check, so the row guard has to find a mistake alone.

That is how the table under "Deliberate mistakes" was made.

`tests/golden/employer-stock/todo.json` is `{}`: no comparison with the page has been run yet. When one is, it lists, by
cause, the rows where the page disagrees with this key.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the `rules.py`
docstring and RULES.md section 1 give the sha256 of each copy. No source was read again for this script, and the script
adds no figure of its own. Every amount, date rule and line it uses comes from `rules.py` (derivation 1) or is restated
from the brief and the sources below (derivation 2).

| Tag | Source | Used for |
|---|---|---|
| USC83, CFR833, P525, USC3121 | 26 U.S.C. 83(a), (c)(1), (e)(3), (f); 26 CFR 1.83-3(e); Publication 525 (2025) Restricted Property and Example 12; 26 U.S.C. 3121(v)(2)(A) | RSU income at vest, at fair market value, in the vest's year, and Medicare wages then; option vests are not income; the holding period starts at vesting |
| P15, CFR3402G | Publication 15 (2026) What's New and section 7; 26 CFR 31.3402(g)-1(a)(1)(i), (a)(2), (a)(4)(iv), (a)(7), (a)(8) Examples 1 and 3 | supplemental wages: 22% flat; 37% on the part of the year's supplemental wages past $1,000,000 (or, the law's option, on the whole crossing payment) |
| USC3101, F8959, I8959 | 26 U.S.C. 3101(b)(2); Form 8959 (2025) lines 1-7; its instructions (2025) | 0.9% Additional Medicare Tax owed on the return's Medicare wages past 200,000 single / 250,000 joint / 125,000 separate |
| USC3102, CFR3102 | 26 U.S.C. 3102(f)(1)-(2); 26 CFR 31.3102-4(a) and its Example | the employer withholds 0.9% of the wages it pays past $200,000 in the calendar year, whatever the filing status |
| USC1, I1040, RP2532 | 26 U.S.C. 1(h)(1), (j)(5); Form 1040 instructions (2025) Qualified Dividends and Capital Gain Tax Worksheet; Rev. Proc. 2025-32 s.4.01, s.4.03, s.4.14(1), s.5 | the 2026 brackets, printed "The Tax Is" bases, standard deductions and 0% / 15% tops; a gain stacked on top, capped at the regular tax (line 25); 2025 and 2026 only |
| USC1411, I8960 | 26 U.S.C. 1411(a)(1), (b), (c)(1); Form 8960 instructions (2025) line 13 | 3.8% of the lesser of net investment income and MAGI over 200,000 / 250,000 / 125,000 |
| USC402, USC1211, USC1222 | 26 U.S.C. 402(a), 1211(b), 1222(3) | a 401(k) sale is not taxed; a capital loss up to $3,000 ($1,500 separate) against other income; long-term means more than a year |
| ILRATES, IL700T, ILQ851, ILB15, IL1040I | Illinois Department of Revenue: Income Tax Rates; IL-700-T (2026); the exemption Q&A; Bulletin FY 2026-15; 2025 IL-1040 instructions | 4.95%; $2,925 a person in 2026 ($2,850 in 2025), none above federal AGI $250,000 ($500,000 joint) |
| IRSNEWS, IRSINFL | IRS news releases (October 2026, last reviewed 29-Oct-2026); Inflation-adjusted tax items by tax year | no 2027 tables published on 2026-10-31 |
| FEDKEY, TLKEY, PROPKEY | `tests/golden/taxes/RULES.md`, `tests/golden/tax-lots/RULES.md`, `tests/golden/property/RULES.md` | comparison only (the same 2026 federal figures) |

## Figures

| Figure | Value | Source |
|---|---|---|
| Brackets 2026, single / joint / separate | tops 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600; 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700; separate as single up to 256,225, then 384,350 | RP2532 s.4.01 Tables 3, 1, 4 |
| Standard deduction 2026 | 16,100 / 32,200 / 16,100 | RP2532 s.4.14(1) |
| 0% and 15% tops 2026 | 49,450 / 98,900 / 49,450 and 545,500 / 613,700 / 306,850 | RP2532 s.4.03 |
| NIIT | 3.8% above MAGI 200,000 / 250,000 / 125,000 (not indexed) | USC1411 (a)(1), (b) |
| Additional Medicare owed | 0.9% above Medicare wages 200,000 / 250,000 / 125,000 (not indexed) | USC3101 (b)(2); I8959 |
| Additional Medicare withheld | 0.9% above $200,000 of the employer's wages, any status | USC3102 (f)(1); CFR3102 (a) |
| Supplemental withholding | 22%; 37% on the part past $1,000,000 of the year's supplemental wages | P15 section 7; CFR3402G (a)(2), (a)(7) |
| Illinois | 4.95%; page: $2,850 a person, no income limit; law: $2,925 a person, none above AGI $250,000 ($500,000 joint) | brief; ILRATES, ILQ851, IL700T |
| Capital loss limit | $3,000; $1,500 separate | USC1211 (b) |
| 2027 | no tables published: the 2026 tables held flat, as a contrast only | IRSNEWS, IRSINFL; rules.py Y1 |
| Page conventions | blank `vest_months` 48, `cliff_months` 12, `every` 3; 10% ok, 25% medium; 50% halving; every vest at today's price; money to the cent, rates and ratios to six decimals | the brief (no legal source) |

## Who each row is

- **schedules.csv.** One grant: whole shares, a start date, the three schedule numbers (blank allowed) and a day of 2026.
  Nothing else.
- **households.csv.** One household, on a day of 2026 (`today`):
  - `single`, `married_joint`, or `married_separate` (two adults, the employee and a spouse, each with their own return);
    every adult under 65, no dependents, the standard deduction;
  - income: the employee's salary and, for joint and separate rows, the spouse's (yearly, from the Income list), or for a
    few single and joint rows `wages_typed` for the whole return instead of any salary; nothing else. Salary = W-2 wages =
    Medicare wages (no 401(k) deferral modelled);
  - `state` `none` or `IL`;
  - the company's price today; 0 to 3 grants (RSUs or options, options with a strike and a granted date = `vest_start`);
  - the company's shares held in a brokerage account (shares and one total cost) and/or in a 401(k) (shares);
    `brokerage_owner` (`employee`, `spouse` or `joint`) on every separate row with brokerage shares;
  - account balances: brokerage and 401(k), each at least the value of the company shares in it, and sometimes savings,
    which the page never counts as invested.

## How each row is worked (derivation 1: rules.py)

- **schedules.csv.** `rules.vest_schedule` (months, `add_months` from the start date, floor of the cumulative shares, a
  vest of 0 shares left out) and `vested_shares`; `vest_months` for the count of months that add no share.
- **households.csv.** The CSV's input strings go into `rules.employer_stock_case`:
  - `position` (held value, spreads, vested and unvested per grant, owned, exposure, invested, share, `level`, halving);
  - `vests_in_view` (after today, to `add_months(today, 12)`, same-day vests in grant order) and the year's earlier vests;
  - `vest_year` for each calendar year: `federal_return` before and after (`regular_tax` summing bracket slices from 0,
    `addl_medicare_owed`), `supplemental_withholding` in order, `addl_medicare_withheld`, `il_tax_page` and `il_tax_law`
    before and after, each vest's share by value;
  - `sale`: `federal_return` with and without the gain (`qdcg_worksheet`, `niit`), and the law's loss
    (`capital_loss`, 1211(b)) and Illinois contrasts.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, with its own reader of the CSV's input strings (numbers, dates, the `|` and `;` fields)
and without calling a `rules.py` function. It uses `rules.py`'s 2026 federal tables only (bracket tops, the printed "The
Tax Is" bases, rates, standard deductions, 0% and 15% tops); the page's defaults and the statutory figures (22%, 37%,
$1,000,000, 0.9%, $200,000, the 0.9% and NIIT thresholds, 3.8%, 4.95%, $2,850, $2,925, the Illinois limits, $3,000 /
$1,500) are restated from the brief and the sources.

- **Vest months** in closed form: first = the cliff (or `every` when the cliff is 0), then ceil((vest_months - first) /
  every) months first + j x every, then vest_months. `rules.py` loops while below.
- **Dates** by counting months (year x 12 + month + m) with its own month lengths and leap rule, the day kept or cut to
  the month's last day. `rules.py` uses `datetime` subtraction for month lengths.
- **Money** in whole units of 1e-8 dollars. Prices and balances are whole cents, so positions, spreads, the halving (50%
  of whole cents) and `need` (10% of whole cents) are exact; division (a vest's share of a year figure, the pro rata gain,
  a rate on an amount) rounds down. `rules.py` is exact (Fraction).
- **Tax** from the revenue procedure's own form: the "Over $X but not over $Y" row (bisection on the tops), the printed base
  plus the rate on the excess. `rules.py` sums each bracket's slice.
- **The 0.9% owed, the 0.9% withheld, the 22% / 37% split, the page's Illinois share** as the length of the overlap of an
  income interval with a band ([before, after] against [threshold, no top]; [running total, + vest] against [0,
  $1,000,000]). `rules.py` takes differences of max(0, x - threshold).
- **Illinois' law share** as 4.95% x (the overlap with [allowance, no top] + the allowance when the income crosses the
  limit inside the interval), since the limit is above the allowance. `rules.py` works the tax before and after.
- **The sale's tax** as the slice from ordinary taxable income (which the gain never changes) up to taxable income with the
  gain, taxed by its overlap with the 0 / 15 / 20% bands, capped at the regular-tax change, plus 3.8% of the overlap of
  [wages, wages + gain] with the NIIT line. `rules.py` runs the worksheet's 25 lines and `niit` on both returns.
- **Same-day vests across $1,000,000** by grouping consecutive vests of one date. `rules.py` builds a dictionary of days.
- Shared with derivation 1, so not checked by the guard: the 2027 convention (the 2026 tables held flat, Y1) and the
  federal tables themselves (checked instead against the printed bases by `rules.py` and against FEDKEY, TLKEY, PROPKEY).

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up (away from zero for negatives). Rates,
  ratios and `sell_shares_*` are rounded the same way to six decimals.
- Ties are real: 2,192 written amounts in 851 rows sit exactly on a half cent before rounding. Most are the halving loss
  (586: 50% of an odd number of cents), then the 22% and 37% withholding on a value with an odd cent (vest `supp` 230),
  the gaps (vest 220, year 97), the sale's `need` (83: 10% of whole cents) and the year's taxes before (82). They are
  rounded away from zero; a page that rounds half to even, or in floating point, can be a cent off there.
- Each written value is rounded on its own. A vest's owed, withheld, gap and state share are the year's figure x its value
  / the year's total, rounded each, so the written per-vest values of a year can miss the written year by a few cents:
  owed in 961 of 2,623 years, withheld 1,026, gap 897, the 0.9% withheld 659, the state share 213, by at most 6 cents (a
  year with many monthly vests). A page that rounds each vest first and adds them up needs that tolerance on the year.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder twice: once with the examples check, and once without
it (`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | Examples check | Row guard |
|---|---|---|
| vest dates chained from the previous vest | caught (9.8 Bea's vests) | refused at `es-sch-0001` (2025-05-31 vs 2025-05-28 ...) |
| a vest dated today not yet vested | caught (vest edges) | refused at `es-sch-0007` (vested 3,300 vs 3,200) |
| months without a share listed as vests of 0 | caught (Z1) | refused at `es-sch-0002` |
| exactly 10% is medium | caught (10%) | refused at `es-sgl-0011` (ok vs medium) |
| the halving counts vested options only | caught (9.8 position) | refused at `es-sgl-0009` (132,500.00 vs 102,500.00) |
| savings counted as invested | caught (blank shares) | refused at `es-sgl-0016` (0.00 vs 20,000.00) |
| the year's earlier vests left out of "before" | caught (9.2) | refused at `es-sgl-0002` (owed 35,900.00 vs 23,364.00) |
| owed without the 0.9% | caught (9.2) | refused at `es-sgl-0002` (35,900.00 vs 35,000.00) |
| the employer's 0.9% from the return's threshold | caught (9.4) | refused at `es-mfj-0001` (900.00 vs 450.00) |
| a vest crossing $1,000,000 all at 37% in the main column | caught (9.3) | refused at `es-sgl-0003` (96,000.00 vs 111,000.00) |
| typed joint wages all the employee's pay | caught (typed joint) | refused at `es-mfj-0002` (450.00 vs 900.00) |
| the page's Illinois share at $2,925 | caught (Illinois straddle) | refused at `es-sgl-0027` (353.93 vs 350.21) |
| the brokerage sold before the 401(k) | caught (401(k) first) | refused at `es-sgl-0031` (85,000.00 vs 35,000.00) |
| the 3.8% on the whole gain once over the line | caught (NIIT part way) | refused at `es-sgl-0032` (5,260.00 vs 5,640.00) |
| the gain taxed as ordinary income | caught (9.6) | refused at `es-sgl-0006` (2,917.50 vs 7,250.00) |
| a separate return's gain all on the employee's return | caught (9.9) | refused at `es-mfs-0001` (3,380.00 vs 3,760.00) |

In all thirty-two runs no CSV was written.

## The generator

Edge rows come first, then random rows. Nothing is redrawn: every draw goes through both derivations and the guard.

### schedules.csv: 30 edge rows (`es-sch-0001` to `-0030`), then 1,470 random rows

| Rows | What they pin down |
|---|---|
| `0001` | RULES.md 9.8 Bea: 1,000 from 2023-08-31, all blank: November 30, February 28, then May 31 again |
| `0002`, `0003` | RULES.md 3.1 Z1: 5 shares over 48 months vest 1 at months 12, 21, 30, 39, 48 (8 months add none) |
| `0004` to `0006` | 10 months, no cliff, every 3 (30, 30, 30, 10); cliff = vest_months = 12; vest_months 6 under every 12 |
| `0007` to `0012` | month ends: monthly from January 31, 2024 (February 29, 2024); February 29, 2024 yearly (2025-02-28 ... 2028-02-29); August 31 with a 6-month cliff; January 30 and 29 monthly; December 31 monthly |
| `0013` to `0015` | today the day before, on, and the day after a vest |
| `0016`, `0017` | starts after today; ended years ago |
| `0018` to `0023` | 1 share; 1,000,000 shares monthly; vest_months 1; every longer than what follows the cliff; cliff = vest_months = 48; every 7 |
| `0024` to `0026` | one of the three typed, the other two blank |
| `0027`, `0028` | today December 31 and January 1 |
| `0029`, `0030` | cliff 1 every 1 with 7 shares; 1,001 shares over 48 / 12 / 3 |

Random rows:
- **Shares** 1 to 20 (8%), 21 to 500 (25%), 501 to 5,000 (35%), 5,001 to 50,000 (25%), to 1,000,000 (7%).
- **vest_start**: 2018-2021 (12%), 2022-2026 (78%), 2027 to June (10%); the day 1 to 28, or 35% of the time the 29th,
  30th, 31st or the month's last day (cut to the month's last day when it lacks the day).
- **vest_months** blank 35%, else 48, 36, 24, 12, 60 or any 1 to 72. **cliff_months** blank 35% (only when vest_months is
  12 or more), else 0, 12 or any 1 to 24 (never above vest_months). **every** blank 35%, else 1, 3, 6, 12 or any 1 to 24.
- **Today** uniform over 2026; in 20% of rows it is then moved onto one of the grant's 2026 vests or a day either side
  (when the grant has a 2026 vest and the day stays in 2026).

### households.csv: 49 edge rows, then 2,451 random rows

Ids are `es-sgl-NNNN`, `es-mfj-NNNN`, `es-mfs-NNNN`, numbered per filing status in file order.

| Rows | What they pin down |
|---|---|
| `es-sgl-0001` to `-0009`, `es-mfj-0001`, `es-mfs-0001` to `-0004` | RULES.md 9.1 to 9.9b (table above) |
| `es-sgl-0010` | a vest dated today is vested and one of the year's earlier vests; one dated today + 12 months is in view; a day later is not |
| `es-sgl-0011` to `-0014` | share exactly 10% (ok, no sale), 10% + $1 of balance short (sale of $0.10), exactly 25% (medium), just over 25% (large) |
| `es-sgl-0015` to `-0019` | nothing at all (share blank); savings only (share blank); no company shares (share 0); options under water only; options with a strike above and below half the price (halving) |
| `es-sgl-0020` to `-0023` | earlier vests exactly $1,000,000 (the next all at 37%); earlier + in view exactly $1,000,000 (none at 37%); two grants the same day across $1,000,000 (T1); pay exactly $200,000 |
| `es-sgl-0024`, `es-mfj-0005` | no employee pay (W1 flag), single and joint with the spouse's pay |
| `es-sgl-0025`, `es-mfj-0002` | typed wages, single and joint (pay = half) |
| `es-sgl-0026`, `-0027`, `es-mfj-0003`, `es-mfs-0005` | Illinois: no other income with a vest under and across the allowance (page 353.93, law 350.21); joint crossing $500,000; separate crossing $250,000 |
| `es-sgl-0028`, `-0029` | today December 31 (every vest in view in 2027, earlier vests still in the sale's wages); today January 1 |
| `es-sgl-0030` to `-0033`, `es-mfs-0006` | sale from the 401(k) only; the 401(k) first with brokerage shares too; NIIT on part of the gain; cost = value; separate Illinois joint account |
| `es-sgl-0034` to `-0037`, `es-mfj-0004`, `es-mfs-0007` | pay $900,000; 2027 vests crossing $1,000,000; the worksheet line 24 cap (a $500 gain taxed at 12% = $60, not 15% = $75); a gain absorbed by the standard deduction; joint NIIT on the whole gain; separate with the spouse's account and no spouse pay |

Random rows:
- **Status** single 44%, joint 40%, separate 16%. **Today** uniform over 2026. **State** Illinois 20%.
- **Income**: typed wages 7% of single and joint rows ($20,000 to $900,000); Illinois rows with no income at all 18% of the
  rest; else the employee's salary (blank 6%; 15,000-59,999 14%, 60,000-149,999 30%, 150,000-199,999 15%, exactly
  200,000 1%, 200,001-349,999 18%, 350,000-599,999 10%, 600,000-900,000 6%; 5% with cents), the joint spouse's (blank 25%)
  and the separate spouse's (blank 5%): 8,000-99,999 45%, 100,000-299,999 45%, 300,000-600,000 10%.
- **Price** $5 to $39.99 (25%), $40 to $149.99 (45%), $150 to $600 (30%), in cents.
- **Grants** 0 (10%), 1 (40%), 2 (32%), 3 (18%); RSU 72%, option 28%. RSU value at today's price $5,000 to $2,000,000 (a
  tenth of households: $3,000,000 to $16,000,000 a grant, for earlier vests and in-view vests past $1,000,000); options on
  $5,000 to $400,000 of stock with the strike 105-250% (under water, 30%), 10-50% (45%) or 51-95% (25%) of the price.
  `vest_start` 1 to 4 months ahead (5%), 0 to 11 months back (20%), 12 to 44 (62%), 45 to 58 (13%); month ends 30% of the
  time; each of `vest_months`, `cliff_months`, `every` blank 55%, else a common value (a cliff above vest_months is typed
  0 instead).
- **Holdings** none 25%, brokerage only 25%, 401(k) only 15%, both 35%. The brokerage's cost: a gain (5-95% of value) 62%,
  a loss (105-190%) 16%, 0 4%, exactly the value 3%, within 5% 15%.
- **Balances**: the company shares in the account plus nothing (10%), $1,000-$49,999 (18%), $50,000-$399,999 (36%) or
  $400,000-$2,500,000 (36%), with cents; a brokerage without company shares 70% of the time, a 401(k) 75%; savings 40%.
- **Brokerage owner** on separate rows with brokerage shares: employee 40%, spouse 30%, joint 30%.

## Coverage (from the run)

**schedules.csv**

| | Rows |
|---|---|
| total | 1,500 (30 edge, 1,470 random); 18,027 vests |
| vest_months / cliff_months / every blank; all three | 538 / 520 / 521; 78 |
| cliff 0 typed / every 1 | 345 / 246 |
| vest_start on the 29th / 30th / 31st / a month end | 105 / 205 / 189 / 366 |
| a vest falls back to a shorter month's last day / a vest on February 29 | 240 / 112 |
| a vest dated today | 58 |
| nothing vested / part vested / all vested / starts after today | 447 / 597 / 456 / 249 |
| months that add no share (Z1) / a single vest | 78 / 94 |

**households.csv**

| | Rows |
|---|---|
| total | 2,500 (49 edge, 2,451 random); 8,672 vests in view, 2,623 calendar years |
| single / joint / separate | 1,138 / 946 / 416 |
| state none / Illinois (no other income / with) | 1,972 / 528 (111 / 417) |
| typed wages single / joint | 80 / 74 |
| employee pay 0 / under 100,000 / 100,000-199,999 / 200,000-499,999 / 500,000-900,000 | 244 / 662 / 775 / 595 / 224 |
| grants 0 / 1 / 2 / 3 | 272 / 1,005 / 781 / 442 |
| option grants under water / strike at most half the price / between half and the price | 314 / 432 / 277 |
| holdings none / 401(k) only / brokerage only / both | 652 / 377 / 636 / 835 |
| brokerage at a gain / at a loss / at cost | 1,087 / 328 / 56 |
| savings balance (not invested) | 1,002 |
| level ok / medium / large / blank; share under 10% | 586 / 558 / 1,343 / 13; 585 |
| vests in view: 2026 and 2027 / 2026 only / 2027 only / none | 1,010 / 341 / 262 / 887 |
| 2026: no earlier vests / earlier up to $1,000,000 / over | 345 / 950 / 56 |
| in-view vests crossing $1,000,000: 2026 / 2027 | 66 / 83 |
| 2026: pay + earlier + vests up to 200,000 / across / from 200,000 up | 468 / 224 / 659 |
| 2026 gap negative / zero / positive | 219 / 135 / 997 |
| separate rows with vests in view / with 0.9% owed above withheld | 273 / 74 |
| no employee pay with vests in view (W1) / same-day vests across $1,000,000 (T1) | 165 / 2 |
| Illinois 2026: law share differs from the page / equals it | 48 / 226 |
| sale / from both / 401(k) only / brokerage only | 1,549 / 639 / 400 / 510 |
| sale at a loss / with NIIT / the share stays above 10% (held shares run out) | 259 / 665 / 791 |
| sale gain touches 0% / 15% / 20% (by return) | 131 / 617 / 298 |
| separate: sale from the employee's / spouse's / joint account | 83 / 57 / 58 |
| Illinois rows with a sale (law state tax column filled) | 332 |
| rows with an amount on a half cent / amounts | 851 / 2,192 |

Law and contrast columns: the 2027 contrast fills 1,272 years; the whole-vest 37% option differs from the main column in
65 years of 2026 and 83 of 2027; Illinois' law share differs from the page in 48 years of 2026 and 92 of 2027 (at most
$289.58, the joint allowance lost at $500,000); the law's sale tax differs from the page's in the 243 sales at a loss with
a tax effect; Illinois' law tax on the sale is non-zero in 237 rows; the worksheet's line 24 cap binds in 1 row
(`es-sgl-0036`).

## CSV columns

Money has two decimals. Rates, ratios and share counts have six. Dates are ISO (`2026-04-15`). Flags are `yes` / `no`.
A blank means "not typed" in an input column and "does not apply" (or, for 2027 owed and gap, "not verified") in an output
column. Compact fields hold one item per `;` and its fields joined by `|`, blank allowed.

**schedules.csv**

`case_id, row_kind, shares, vest_start, vest_months, cliff_months, every, today, vests, vest_count, vested, unvested,
next_vest, zero_share_months, note`

- `vests`: `date:shares;...` in date order, vests of 0 shares left out (Z1). `vest_count` counts them.
- `vested`: shares in vests dated on or before today; `unvested` = shares - vested.
- `next_vest`: `date:shares` of the first vest after today (blank when none).
- `zero_share_months`: months of the schedule whose whole shares do not move (a page that lists them as vests of 0 shows
  that many more rows, with the same totals).

**households.csv**

Inputs: `case_id, row_kind, today, filing_status, salary_employee, salary_spouse, wages_typed, state, symbol, price,
grants, holdings, brokerage_owner, accounts`

- `grants`: `kind | shares | vest_start | vest_months | cliff_months | every | strike | granted`; `kind` `rsu` or `option`;
  `strike` and `granted` (= `vest_start`) only for options.
- `holdings`: `brokerage | shares | cost` and/or `401k | shares |`.
- `brokerage_owner`: `employee`, `spouse` or `joint`, on separate rows with brokerage shares only.
- `accounts`: `brokerage | balance`, `401k | balance`, `savings | balance` (savings is never invested).
- `symbol` is an invented ticker; only `price` matters.

Outputs, page convention (main columns):

- Position: `held_value`, `vested_options_value`, `owned`, `unvested`, `exposure`, `invested`, `share` (blank when invested
  is 0), `level` (`ok` / `medium` / `large`, blank with the share), `stress_loss` (the halving loss), and the parts
  `held_brokerage`, `held_401k`, `unvested_rsu_value`, `unvested_options_value`.
- `grant_results`: per grant in input order `vested | unvested | spread` (spread blank for RSUs).
- `view_end`: today + 12 calendar months. `earlier_this_year`: the year's earlier RSU vests at today's price (also when no
  2026 vest is in view). `flat_rate_ok`: `no` when there are vests in view but no employee pay (W1), blank with no vests.
- `vests`: per vest in view, in date order (same day: grant order), `date | shares | value | owed | withheld | gap | state`.
  `withheld` = the 22% / 37% supplemental withholding + its share of the 0.9%; `state` = Illinois' share by the page
  (blank outside Illinois). For 2027 vests `owed` and `gap` are blank (see the contrast columns).
- `vests_detail`: per vest `grant | supplemental withheld | 0.9% withheld` (`grant` is 1-based).
- `years`: per calendar year with a vest in view `year | earlier | value | owed | withheld | gap | over_1m | medicare_held |
  state`. `value` is the year's in-view total; `over_1m` is `yes` when the year's supplemental wages (earlier + value) pass
  $1,000,000; `medicare_held` is the 0.9% withheld; `state` the page's Illinois share. 2027: `earlier` is 0, `owed` and
  `gap` blank.
- `years_detail`: `year | tax before | tax after | income tax owed | 0.9% owed | supplemental withheld` (the first four
  blank for 2027).
- The sale (blank when there is none): `sell_need`, `sell_from_401k`, `sell_from_brokerage`, `sell_gain`, `sell_tax`
  (federal), `sell_share_after`, `sell_shares_401k`, `sell_shares_brokerage` (fractional, H3).

Law columns:

- `vests_law`: per vest `date | withheld if the whole crossing vest is at 37% | gap so | state by law` (W2; the same as
  the main column when nothing crosses $1,000,000). `years_law`: `year | withheld | gap | state by law |
  same_day_crossing` (T1: compare the day's total there, not the split).
- `sell_gain_law`: the signed gain (negative at a loss). `sell_tax_law`: with a loss, up to $3,000 ($1,500 separate)
  against the wages on the owner's return (negative), the rest carried over; with a gain, the same as `sell_tax`.
  `sell_state_tax_law`: Illinois' tax on the sale (Illinois rows; the page's sale tax is federal only).

Contrast columns (2027 tables not published on 2026-10-31; the 2026 tables held flat, not verified):

- `contrast_2027_years`: `year | tax before | tax after | owed | gap | gap if the whole crossing vest is at 37%`.
- `contrast_2027_vests`: per 2027 vest `date | owed | gap | gap whole`.

`note`: on an edge row, what it pins down; on every row, the notable things (2027 contrast, the W1 flag, vests crossing
$1,000,000, same-day crossings, Illinois law against page, a sale at a loss, the held shares running out, Illinois tax
on the sale, savings not counted, options under water, how many written amounts sit on a half cent).

## Open points (judgement calls a reviewer should know)

1. **2027 tables.** Rev. Proc. 2025-32 covers 2025 and 2026 only, and the IRS had published no 2027 inflation release on
   2026-10-31 (rules.py Y1). So the 2027 owed and gap are blank in the main columns and worked as a contrast on the 2026
   tables held flat. The 2027 withholding (22% / 37%, the 0.9% from $200,000: statutory, not indexed) and the page's 2027
   Illinois share (the page's own formula) stay in the main columns. The law's 2027 Illinois share holds 2026's $2,925
   (not verified, Y2). The 2027 contrast is shared by both derivations, so the guard does not check its convention.
2. **Illinois.** The brief's "$2,850 per person ... 2026" is IDOR's 2025 figure. The main column keeps $2,850 with no income
   limit (the page); the law column uses $2,925 and drops the allowance above federal AGI $250,000 ($500,000 joint). Most
   rows agree, since the allowance cancels when the income before the vests is already above it.
3. **Years listed** are the calendar years that have a vest in view. A household whose 2026 vests are all on or before
   today has no 2026 entry; its earlier vests show in `earlier_this_year` and in the sale's wages.
4. **Prices.** Every vest, the year's earlier ones included, is valued at today's price (P1, a page convention). By law each
   vest is income at its own vest-day value (83(a)); the case has no historical prices.
5. **Zero-share months** (floor does not move) are not vests (Z1); `zero_share_months` counts them.
6. **Same-day vests** are taken in grant order (T1). Only the per-vest split of the withholding depends on it, and only
   when $1,000,000 falls inside that day (2 rows, flagged).
7. **The 22% flat rate** is used whenever the employee has pay (W1). The 165 rows with vests in view and no employee pay
   are flagged; the law would need the aggregate method, which the key does not model.
8. **The 0.9% withheld** counts the salary before the vests (M1, as the brief's formula does), and typed wages on a joint
   return count half as the employee's pay (M2, the brief). On a separate return the 0.9% is owed past $125,000 but
   withheld only past $200,000 (74 rows owe more than is withheld in 2026).
9. **The sale.** The brokerage shares are long-term (H1: no purchase dates), one lot with one total cost so the gain is pro
   rata (H2), and fractional shares may be sold (H3). The 401(k)'s company shares are the employee's; a separate row's
   brokerage gain goes on the owner's return, half on each when joint. The gain is taxed with this year's vests (earlier +
   2026 in view) in the wages. A loss: the page taxes nothing; the law allows $3,000 / $1,500 against wages.
10. **The worksheet's line 24 cap** binds only in a narrow band (taxable income just above the 0% top but below the 12% top:
    49,450 to 50,400 single and separate, 98,900 to 100,800 joint), where 12% is less than 15%. One edge row pins it
    (`es-sgl-0036`: $60, not $75); no random row lands there.
11. **Invested** is the brokerage and 401(k) balances (plus vested options and unvested); savings, typed in 1,002 rows,
    never count (the brief). Balances are at least the company shares in them; 10% of the time exactly that.
12. **Level boundaries** are inclusive on the exact share (L1): exactly 10% is ok and sells nothing (`es-sgl-0011`).
13. **Vest starts in the future.** 249 of the 3,893 household grants (6.4%; 71 of them options, whose granted date is
    then in the future too) and 249 schedules start after today. A page that refuses a future grant date would differ
    there.
14. **Inputs.** Salaries are whole dollars (5% with cents); prices, strikes, costs and balances are in cents; shares are
    whole. A blank salary means no Income entry (pay 0), never a typed 0. Typed wages are never on a separate row.
15. **Rounding** happens only when a value is written; per-vest values do not add up to the written year to the cent (up
    to 6 cents), and 2,192 amounts sit on a half cent (Rounding, above).
16. **Not modelled** (as RULES.md 12): Social Security and the 1.45% Medicare (withheld as owed, F1), net settlement of
    shares for tax, delivery after vesting, bonuses, the aggregate method, 401(k) deferrals, option exercises and the AMT,
    short-term holdings, Illinois withholding.
17. **Not verified on an official source:** the 2027 federal tables and Illinois exemption; the 22% rate's basis beyond
    Pub. 15 (2026) (the regulation still says "28 percent (or the corresponding rate ...)"); every page convention the
    brief leaves open (Z1, T1, L1, M1, the years listed, future grants), which need the page's code, which the independence
    rule forbids reading.

## What the key leaves out (on purpose)

- Incentive stock options, the AMT, exercises and dispositions of option shares, 83(b) and 83(i) elections.
- Prices on past vest days, the employee's own basis and holding period per vest lot, wash sales.
- Social Security and regular Medicare, state withholding, every state but Illinois, local taxes.
- Itemized deductions, credits, the 65+ standard deduction, dependents, other income of any kind.
