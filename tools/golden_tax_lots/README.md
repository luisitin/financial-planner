# Tax lots answer key: holding periods, loss harvesting, wash sales, the order to sell

One independent answer key for the "Tax lots and harvesting" page:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `tax_lots_key.py` | `tests/golden/tax-lots/lots.csv` | 3,000 | the holding-period rule alone: purchases dated 2023 to 2026 (every month end, February 29, December 31, January 1, February 28, March 1, and random days), plus 2027 and 2028 purchases and 20 undated lots, each seen on its anniversary, the day before, the day after and other days. Output: the first long-term day, the term today and the days left, by the law and by the page |
| | `tests/golden/tax-lots/households.csv` | 2,000 | invented households with "today" in 2025 or 2026. For every lot: value, gain, term, first long-term day, days left. Then the page's marginal and gains rates; the harvest candidates with the page's tax saved, wash sale and disallowed loss; the law's tax saved if every candidate is sold today, with the carryover to next year (short and long); the page's order to sell (first eight) and a tax-per-dollar contrast |

`rules.py` holds every figure as data, with its source and the date it was read on the same line, plus the model
as small functions. `tests/golden/tax-lots/RULES.md` gives each rule in plain words with the source text, and works
four examples by hand (section 10). Those examples are rows `lots-2026-sgl-0001` (Ana), `lots-2025-mfj-0002` (Ben and
Cy), `lots-2025-sgl-0003` and `-0004` (Dee) and `lots-2026-hoh-0007` and `-0008` (Eve) of households.csv.

**Independence.** This key was written from the law (26 U.S.C. 1, 1091, 1211, 1212, 1222, 1223 and 1411) and the
regulations (26 CFR 1.1091-1, 1.1091-2, 1.1223-1, 1.1411-4, 1.1012-1). It also rests on Rev. Rul. 2008-5 and 66-7,
Rev. Proc. 2024-40 and 2025-32, Pub. L. 119-21, Publication 550, the Schedule D, Form 8949, Form 8960 and Form 1040
instructions, and Schedule D and Form 8960 themselves, all read through `rules.py` and RULES.md. Nobody opened
`modules/`, `core/` or `tests/*.test.mjs` while writing it, and it never imports or runs the app. The only things taken
from `tools/golden_estimated/` and `tools/golden_estate/` are their layout and conventions; no figure or code is
shared. The federal brackets, standard deductions and 0/15/20% tops agree with `tests/golden/taxes/RULES.md`, which is
cited for comparison only.

The page's documented model (the brief's rules 1 to 6) is the spec. Where the law says otherwise, the main column
follows the law and a contrast column keeps the page's way.

The script works every row in two separate ways, both in exact arithmetic. It refuses to write either CSV if, between
the two:
- an amount differs by more than a cent,
- a rate or ratio differs by more than 1e-6, or
- any other value (date, term, day count, flag, lot key, order) differs at all.

In fact the two agree exactly, before rounding, on every value of every row: in households.csv 101,430 amounts, 6,705
rates and ratios and 165,584 other values; in lots.csv 21,000 values.

## Run

```
python3 -B -I tools/golden_tax_lots/tax_lots_key.py
```

Python 3 standard library only (made with 3.13; about 8 seconds). The run is deterministic:
`random.Random(20261031)`, and the generator draws only integers, never a float. A second run writes byte-identical
files. This was checked with two runs into separate folders:

| File | sha256 |
|---|---|
| lots.csv | `856688ac54794c7f39b91febb7fcf691de4456b0baf26cc95e6cab8763507956` |
| households.csv | `a39eb5da18d4471b6c2e09835bbfef3f27db3a16f1185b8eef771613cc3f20fd` |

The script sets `sys.dont_write_bytecode` *before* it imports `rules.py`, and `-B` covers Python's own cache, so no
`__pycache__` lands in the repo. `-I` keeps the environment and the current folder off the import path; the script puts
its own folder on it to find `rules.py`.

What a run does, in order:
1. Importing `rules.py` runs its 98 self-checks.
2. Derivation 2 is checked against RULES.md's worked examples, the edge notes' hand figures and the sources' own
   examples (50 assertions).
3. Both CSVs are worked, every row both ways.
4. 50 coverage minimums taken from the brief are checked.
5. The CSVs are written only once all of that has passed, and the run prints every check count, the coverage and
   both sha256.

Options:
- a folder argument writes the CSVs there instead (`tax_lots_key.py /tmp/x`);
- `--mutate NAME` puts one deliberate mistake into derivation 2 (the list is `MUTATIONS` in the script);
- `--skip-examples` turns off the examples check, so the row guard has to find a mistake alone.

That is how the table under "Deliberate mistakes" was made.

`tests/golden/tax-lots/todo.json` lists, by cause, the rows where the page disagrees with this key. The first check
against the page (2026-10-31) found three causes (open point 15); the page fixed all three the same day, and the list is
empty (`{}`) again.

## Sources

The figures and the model are those of `rules.py`. Its author read every source on 2026-10-31, and the `rules.py`
docstring and RULES.md section 1 give the sha256 of each copy. No source was read again for this script, and the script
adds no figure of its own. Every amount, date rule and line it uses comes from `rules.py`, or is one of the page's
documented conventions: the $1,000 step for the rates, "more than $1", eight lots in the order to sell, six decimals.

| Tag | Source | Used for |
|---|---|---|
| USC1222, P550, RR6607 | 26 U.S.C. 1222(1)-(4); Publication 550 (2025) "Holding Period" (p.81) and its January 31, 2024 example; Rev. Rul. 66-7 (secondary copy) | short-term when held not more than 1 year; count from the day after the purchase; the sale day counts; a month-end purchase is long-term from the first day of the 13th month after |
| USC1, I1040 | 26 U.S.C. 1(h)(1), (h)(11), (j)(5); Form 1040 instructions (2025), Qualified Dividends and Capital Gain Tax Worksheet | qualified income stacked on top at 0 / 15 / 20%, capped at the regular tax (line 25) |
| RP2440, RP2532, PL11921 | Rev. Proc. 2024-40 s.2.01, s.2.03; Rev. Proc. 2025-32 s.3.01, s.4.01, s.4.03, s.4.14(1); Pub. L. 119-21 s.70101, s.70102(b) | 2025 and 2026 brackets, printed "The Tax Is" bases, 0% and 15% tops, standard deductions (2025 as amended) |
| USC1211, USC1212, FSD, ISD | 26 U.S.C. 1211(b), 1212(b); Schedule D (2025) lines 7, 15, 16, 21; its instructions, Capital Loss Carryover Worksheet (p.9) | netting short against short, long against long, then across; $3,000 / $1,500 against other income; the carryover, short and long |
| USC1411, I8960, F8960, CFR14114 | 26 U.S.C. 1411(a)(1), (b), (c)(1); Form 8960 (2025) lines 5a, 8, 12-17 and instructions; 26 CFR 1.1411-4(d)(3)(ii) Example 1 | 3.8% of the lesser of net investment income and MAGI over 250,000 / 125,000 / 200,000; a net capital loss reduces net investment income by the allowed $3,000 / $1,500 only |
| USC1091, CFR10911, CFR10912, USC1223, CFR12231 | 26 U.S.C. 1091(a), (b), (d); 26 CFR 1.1091-1(a)-(e), (h) Examples 1-3; 1.1091-2; 26 U.S.C. 1223(3); 1.1223-1(d) | the 61-day window; losses taken in order of purchase, replacement shares in order of purchase, share for share, each once; the new basis and holding period |
| RR0805 | Rev. Rul. 2008-5 | a purchase in an IRA (or Roth IRA) makes the wash sale; the loss is gone and the IRA basis is not increased |
| CFR10121 | 26 CFR 1.1012-1(c)(1)(i) | each lot sold is specifically identified (the page sells lot by lot) |
| FEDKEY | `tests/golden/taxes/RULES.md` sections 1, 2, 5, 8 | comparison only (same figures; its Rev. Proc. 2024-40 section numbers are s.2.01 / s.2.03 / s.2.15, not s.3.01 / s.3.03 / s.3.15) |

## Figures

| Figure | Value | Source |
|---|---|---|
| Brackets 2025 | single 11,925 / 48,475 / 103,350 / 197,300 / 250,525 / 626,350; joint 23,850 / 96,950 / 206,700 / 394,600 / 501,050 / 751,600; separate as single but 375,800; head of household 17,000 / 64,850 / 103,350 / 197,300 / 250,500 / 626,350 | RP2440 s.2.01 |
| Brackets 2026 | single 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600; joint 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700; separate as single but 384,350; head of household 17,700 / 67,450 / 105,700 / 201,750 / 256,200 / 640,600 | RP2532 s.4.01 |
| Standard deduction | 2025: 15,750 / 31,500 / 15,750 / 23,625; 2026: 16,100 / 32,200 / 16,100 / 24,150 (single / joint / separate / head of household) | RP2532 s.3.01, s.4.14(1); PL11921 |
| 0% top / 15% top | 2025: 48,350 / 533,400 single, 96,700 / 600,050 joint, 48,350 / 300,000 separate, 64,750 / 566,700 head; 2026: 49,450 / 545,500, 98,900 / 613,700, 49,450 / 306,850, 66,200 / 579,600 | RP2440 s.2.03; RP2532 s.4.03 |
| NIIT | 3.8% above MAGI 200,000 single and head, 250,000 joint, 125,000 separate (not indexed) | USC1411 (a)(1), (b) |
| Capital loss limit | $3,000; $1,500 married filing separately | USC1211 (b) |
| Wash-sale window | 30 days before to 30 days after the sale, the sale day included | USC1091 (a) |
| Long-term | held more than 1 year | USC1222 (3) |
| Page conventions | rates from $1,000 more income; a candidate loses more than $1; eight lots in the order to sell; rates and ratios to six decimals | the brief (no legal source) |

## Who each row is

- **lots.csv.** One lot: a purchase date (or none) and a `today`. Nothing else matters to the holding period.
  `today` is not limited to 2025 and 2026 here: the anniversary of a 2023 purchase falls in 2024, that of a 2026 one
  in 2027, and the 2027 and 2028 purchases (the brief's "February 29 in 2024/2028") are seen in 2028 and 2029.
- **households.csv.** One federal return for the calendar year of `today` (2025 or 2026):
  - who files: one adult under 65, or a couple filing jointly; no dependents; the standard deduction; head of household
    taken as given;
  - income: taxable interest (`other_ordinary`) and qualified dividends, which are all the dividends;
  - this year's realized net short-term and net long-term results from the Capital gains page (`st_realized`,
    `lt_realized`, one sale each, either sign);
  - nothing carried in from last year;
  - up to four holdings. Each holding has an invented ticker (`ZZTOT ZZINT ZZBND ZZTEC ZZDIV ZZSML`), an account kind
    (`taxable` or `ira`), today's price, total shares and total cost basis, and up to four lots (date or blank, shares,
    total cost);
  - the same ticker can sit in two holdings, in an IRA and a taxable account or in two taxable accounts, and then has
    one price;
  - a holding's total shares may exceed its lots' shares: the rest is the unassigned lot. A holding may have no lots
    at all;
  - no lot is dated after `today`.

## How each row is worked (derivation 1: rules.py)

- **lots.csv.** `rules.first_long_day_law`, `first_long_day_page`, `term(..., 'law' | 'page')`,
  `days_until_long(..., 'law' | 'page')`, `rules_differ`.
- **households.csv.** The CSV's input strings go into `rules.harvest`, which runs these steps:
  - `make_lots` builds the lots, adding the unassigned lot;
  - `page_rates` gives the two rates: `federal_tax` three times, at the base and with $1,000 more interest or
    dividends;
  - `is_candidate` and `page_tax_saved` give the candidates and the page's figure;
  - `wash_sales` applies the wash sales;
  - `federal_tax` runs without the sale and with it. Each run is `schedule_d`, `qdcg_tax` (the worksheet, lines 1-25),
    `net_investment_income`, `niit` and `carryover` (the worksheet, lines 1-13);
  - `same_day_sensitive` raises the W3 flag.

  Then `rules.term`, `first_long_day_*` and `days_until_long` per lot, `holding_totals`, `page_sell_order` and
  `contrast_sell_order`, all in exact fractions.

## The other way, run on every row before the CSVs are written (derivation 2)

Written separately in this file, with its own parser of the CSV's input strings and without calling a `rules.py`
function. It uses `rules.py`'s tables only: bracket tops, the printed bracket bases, rates, standard deductions, 0% and
15% tops, NIIT lines.

- **First long-term day.** Law: the holding period starts the day after the purchase. The lot is long-term from the
  start's month and day one year on; a start on February 29 has no such day, so March 1. `rules.py` instead tests for
  the last day of a month (Rev. Rul. 66-7) and counts 13 months. Page: month and day one year on, plus one day; a
  February 29 purchase gives March 1. Term and days come from date ordinals.
- **Tax.** The revenue procedure's own form: find the "Over $X but not over $Y" row by bisection on the tops, then add
  the printed "The Tax Is" base and the rate on the excess. `rules.py` sums each bracket's slice instead.
- **Qualified income.** The tax on ordinary income, plus 15% and 20% of the overlap of [ordinary, taxable income] with
  [0% top, 15% top] and [15% top, no top], capped at the regular tax. `rules.py` runs the worksheet's 25 lines.
- **Schedule D.** Net capital gain is computed as 1222(11) words it: the net long-term gain over the net short-term
  loss. `rules.py` takes the smaller of lines 15 and 16.
- **Carryover.** From the words of 1212(b). The allowed loss, up to adjusted taxable income (taxable income plus the
  allowed loss, possibly negative), counts as a short-term gain. Then the short carryover is the net short-term loss
  over the net long-term gain, and the long carryover is the net long-term loss over the net short-term gain.
  `rules.py` runs the worksheet's lines 1-13.
- **NIIT.** 3.8% of the lesser of max(0, interest + dividends + Form 1040 line 7a) and MAGI over the line.
- **Wash sales.** As overlaps of cumulative share ranges. Per ticker, the sold loss lots, in order of purchase, occupy
  [0, s1), [s1, s1 + s2) and so on. The replacement lots, in order of purchase, occupy [0, r1), [r1, r1 + r2) and so on.
  A sold lot is matched with the replacement shares its range overlaps. `rules.py` uses a greedy loop that draws
  shares down from a pool.
- **Orders.** Stable insertion sorts with cross-multiplied comparisons (gain x shares, never a division). `rules.py`
  uses Python's sort on Fraction keys.

### Rounding

- **Money** is exact until it is written, then rounded once to the cent, half up (away from zero for losses and
  negative gains). Rates and ratios are rounded the same way to six decimals. Nothing is rounded before it is used.
- Ties are real: 182 written amounts in households.csv sit exactly on a half cent before rounding. They come from
  shares with three decimals times a price.
- Totals are sums of exact values, so a written total can differ from the sum of its written parts by up to half a
  cent per part. This happens in 297 rows; the largest gap is 2 cents. A page that rounds each lot first and then adds
  needs that tolerance.
- The two rates come from federal totals rounded to the cent (R2, revised 2026-10-31), so every rate is a multiple of
  0.00001 and is written exactly (no rate has more than six decimals). The first run took the exact change instead; 47
  rows then had a rate up to 0.00001 off the page's, and 24 a tax saved up to $1.91 off.

### Deliberate mistakes

Each was put into derivation 2 only and run into a scratch folder twice: once with the examples check, and once
without it (`--skip-examples`), so that the row guard had to find it alone.

| Mistake (derivation 2 only) | Examples check | Row guard |
|---|---|---|
| a replacement must be bought within 29 days, not 30 | caught (today - 30 edge) | refused at `lots-2026-sgl-0044` (wash yes vs no) |
| replacement shares matched latest purchase first | caught (1.1091-1 Example 2 bases) | refused at `lots-2025-mfs-0078` (2 matches vs 1) |
| an IRA purchase is never a replacement | caught (10.4 Eve) | refused at `lots-2026-hoh-0007` |
| married filing separately deducts $3,000 | caught ($1,500.01 edge) | refused at `lots-2025-mfs-0017` (ratio 1.466657 vs 1.466667) |
| no cross netting (net capital gain ignores a short-term loss) | caught (10.2 Ben and Cy) | refused at `lots-2025-mfj-0002` (tax with 10,413.00 vs 9,453.00) |
| net investment income counts the whole net capital loss | not caught | refused at `lots-2026-mfs-0106` |
| the carryover treats the allowed loss as used when taxable income is negative | caught (K1) | refused at `lots-2026-sgl-0018` (10,000 vs 7,000) |
| no cap at the regular tax (worksheet line 25) | caught (0.145 / 0.165 edge) | refused at `lots-2026-sgl-0036` (marginal 0.145 vs 0.130) |
| long-term on the anniversary itself | caught (10.3 Dee) | refused at lots.csv `term-0001` |
| a lot losing exactly $1.00 is a candidate | not caught | refused at `lots-2026-sgl-0010` |
| ties in the order to sell broken by reverse input order | not caught | refused at `lots-2026-sgl-0050` |
| the unassigned lot's cost not floored at 0 | not caught | refused at `lots-2026-mfj-0042` (gain 1,100.00 vs 1,600.00) |

In all twenty-four runs no CSV was written.

## The generator

Edge rows come first, then random rows.

A random draw is redrawn in two cases:
- **Same-day sensitive** (convention W3): a lot bought inside the 30-day window is itself sold in the harvest together
  with an older loss lot of the same ticker. 235 draws were redrawn; one labelled edge row keeps the case.
- **On the $1 line:** a taxable lot loses between $0.99 and $1.01. No draw landed there this run; three labelled edge
  rows sit on it.

Nothing else is redrawn. Every draw, kept or not, goes through both derivations and the guard.

### lots.csv: 3,000 rows (`term-0001` to `term-3000`)

The rows come in this order:
- **The special purchase dates.** Every month end of 2023 to 2026 (December 31 and February 29, 2024 included),
  January 1, March 1 and February 28 of each year. Each is seen on: the anniversary, the day before, the day after, two
  days after; the law's and the page's first long-term day and the day before each; the purchase day itself; purchase
  + 365 and + 366 days.
- **Outside the grid.** February 28, 2027 (law and page differ), February 28, 2028, February 29, 2028, March 1, 2028,
  December 31, 2027 and January 1, 2028, seen on the days around their anniversaries and first long-term days.
- **No date:** 20 rows with distinct `today` values in 2025 and 2026.
- **Random:** a purchase day uniform over 2023 to 2026. It is seen on the anniversary (25%), the day after (25%), the
  day before (25%), or 0 to 900 days after the purchase (25%). Duplicates are skipped.

### households.csv: 69 edge rows (`lots-YYYY-sss-0001` to `-0069`), then 1,931 random rows (`-0070` to `-2000`)

`sss` is `sgl`, `mfj`, `mfs` or `hoh`, and the number runs over the whole file.

| Rows | What they pin down |
|---|---|
| `0001` to `0008` | RULES.md 10.1 to 10.4. Ana's $40,000 loss (law $1,074.00, page $7,520.00, $37,000 carried long). Ben and Cy (law $3,000.00, page $3,960.00). Dee's February 29, 2024 lot seen on Feb 27, Feb 28 (short, 1 day), Mar 1 and Mar 2, 2025. Eve with and without the IRA purchase (law $520.00 / $740.00) |
| `0009` to `0011` | a loss of exactly $0.99, $1.00 (neither is a candidate) and $1.01 |
| `0012` to `0017` | net loss $2,999.99 / $3,000.00 / $3,000.01 (single) and $1,499.99 / $1,500.00 / $1,500.01 (separate): carryover $0 / $0 / $0.01 |
| `0018` to `0026` | K1: taxable income below zero, so the whole loss carries; no income at all for every status in both years (rates 0) |
| `0027` to `0033` | NIIT. MAGI exactly $200,000 (marginal 0.278) and $199,500 (0.259 / 0.169). Joint, separate and head of household at their lines. $201,000, where the harvest removes the $38 of NIIT. A $300,000 short-term gain wiped out by a $400,000 loss (NII 0, $100,000 carried) |
| `0034` to `0039` | the 0% band (gains rate 0, law $230). $1,000 straddling the 0% top (0.0825). The worksheet cap in 2026 (gains 0.165 above marginal 0.145) and in 2025. The top bracket (0.408 / 0.238). A long loss against short-term gains (page $1,500, law $2,200) |
| `0040` to `0043` | an unassigned lot losing money; a holding with no lots; the unassigned cost floored at 0; IRA only |
| `0044` to `0054` | wash sales. A replacement bought today - 30 (inside), today - 31 (outside) and today. An IRA buying more shares than were sold. 1.1091-1(b)-(c) ordering with lots listed out of date order. W4 (undated first). A second taxable account. The same-day case (W3, flagged). A gain lot in the same holding. A different ticker (W1). A married-filing-separately IRA purchase (C3) |
| `0055` to `0062` | the anniversary, the day after and the day before. February 28, 2023 (law and page differ). Bought today (366 days). December 31 and January 1. Undated lots |
| `0063` to `0065` | ties in gain per share (O1); 16 taxable lots plus 4 unassigned (only eight listed); the page's order against the contrast |
| `0066` to `0069` | $150,000 of short-term gains; $200,000 of long-term gains with NIIT; a realized short loss with a long gain; realized losses already over the limit (law $0) |

Random rows:

- **Scenario:** plain 77%. IRA wash 7% (a taxable holding with an old loss lot, and the same ticker in an IRA with a
  lot inside the window). Taxable wash 7% (the same, with the second holding taxable and its window lot a gain). IRA
  only 6%. February 29 3% (2025, today February 25 to March 4, a February 29, 2024 lot).
- **Year:** 2025 or 2026, even odds. **Status:** single 30%, joint 35%, separate 15%, head of household 20%.
- **Today:** December 31 5%, January 1 3%, otherwise uniform over the year.
- **Interest:**

  | Share | Range |
  |---|---|
  | 6% | up to the standard deduction |
  | 20% | the 0% band |
  | 5% | within $1,500 below to $300 above the 0% top (realized results 0 in 70% of these rows) |
  | 29% | the 0% top to $150,000 more |
  | 17% | $8,000 under to $4,000 over the NIIT line |
  | 17% | above the NIIT line up to $400,000 more |
  | 6% | $600,000 to $1,500,000 |

  Whole dollars 70%, cents 30%.
- **Qualified dividends:** 0 (40%), $1 to $5,000 (35%), $5,000 to $60,000 (25%).
- **Realized short and long, each:** 0 (45%), a gain of $1 to $10,000 (15%), $20,000 to $250,000 (10%), a loss of $1
  to $10,000 (20%), $10,000 to $80,000 (10%).
- **Holdings:** 1 to 4 (20 / 30 / 25 / 25%).
  - Taxable 75%, IRA 25%.
  - A later holding reuses an earlier ticker 25% of the time, in the other kind of account 85% of the time.
  - Price $5.00 to $500.00.
- **Lots per holding:** 0 to 4 (7 / 25 / 25 / 20 / 23%).
  - **Date:**

    | Share | Date |
    |---|---|
    | 6% | blank |
    | 4% each | the anniversary is today / yesterday / tomorrow |
    | 7% | inside the 30-day window |
    | 3% | exactly today - 30, today - 31 or today |
    | 1% | February 29, 2024 |
    | 1% | February 28, 2023 or 2019 |
    | 28% | 31 to 364 days ago |
    | 42% | 2012 to a year ago |

  - **Shares:** whole 1 to 1,500 (80%), or three decimals.
  - **Cost:** 30% to 99.5% of today's value (45%), 100.5% to 180% (42%), or 98.5% to 101.5% (13%).
- **Unassigned shares:** in 22% of holdings with lots, and always when there are none. Its cost is drawn the same way;
  in 5% of those holdings the cost basis is set 1% to 20% under the lots' cost, so the floor bites.

## Coverage (from the run)

**lots.csv**

| | Rows |
|---|---|
| total | 3,000 (20 undated) |
| purchase year 2023 / 2024 / 2025 / 2026 / 2027 / 2028 | 743 / 738 / 728 / 747 / 8 / 16 |
| purchase on a month end / February 29 / December 31 / January 1 | 286 / 10 / 28 / 27 |
| today is the anniversary / day after / day before / two days after / purchase day / other | 659 / 691 / 663 / 65 / 59 / 843 |
| term short / long | 1,723 / 1,277 |
| law and page differ: first long-term day / term today | 9 / 2 (2023-02-28 seen 2024-02-29; 2027-02-28 seen 2028-02-29) |

**households.csv**

| | Rows |
|---|---|
| total | 2,000 (69 edge, 1,931 random; 2,166 random draws, 235 redrawn) |
| year 2025 / 2026 | 1,002 / 998 |
| single / joint / separate / head of household | 615 / 679 / 314 / 392 |
| realized: none at all / short gain 20,000+ / long gain 20,000+ / short negative / long negative / both gains | 507 / 197 / 206 / 555 / 506 / 123 |
| after the harvest: net gain or 0 / net loss up to the limit / above it (carryover) | 536 / 123 / 1,341 |
| NIIT without harvest: MAGI above / at or below the line | 951 / 1,049 |
| NIIT changed by the harvest / removed by it | 510 / 104 |
| gains rate 0 (0% band) / between 0 and 0.15 / 0.15 / 0.20 or more | 391 / 52 / 578 / 218 |
| marginal rate 0 / rates with NIIT in them / the $1,000 crosses the NIIT line part way | 93 / 975 / 20 |
| gains rate above the marginal rate (worksheet cap) / line 25 takes the regular tax | 6 / 5 |
| lots / taxable / unassigned / undated (typed) | 12,358 / 7,843 / 1,296 / 651 |
| rows with an unassigned lot / a holding with no lots / an undated lot | 1,001 / 294 / 536 |
| lots short / long | 5,028 / 7,330 |
| lots seen on the anniversary / the day after / the day before | 461 / 442 / 411 |
| lots bought 2024-02-29 / law and page first day differ (2019 and 2023 February 28) | 155 / 119 (term never differs) |
| lots bought in the window / exactly today - 30 or - 31 / today | 1,041 / 209 / 119 |
| rows IRA only / a ticker in taxable and IRA / a ticker in two holdings | 251 / 707 / 1,096 |
| candidates (short / long / unassigned lots) | 3,676 (1,269 / 2,407 / 357) |
| rows with no candidate / page total 0 with candidates (gains rate 0) | 453 / 179 |
| wash sales / partly matched / plain test differs from the match | 774 / 395 / 310 |
| rows with a wash sale against an IRA purchase / a taxable purchase | 237 / 346 |
| carryover after the harvest / without it / short part / long part | 1,342 / 625 / 857 / 1,111 |
| taxable income below zero after the harvest, with a carryover (K1) | 75 |
| law saves less / more / the same as the page (ratio written) | 1,214 / 111 / 43 |
| more than eight taxable lots / a tie decides the order / contrast order differs | 160 / 7 / 554 |
| same-day sensitive (labelled edge only) | 1 (`lots-2026-sgl-0051`) |
| largest harvest / largest law saved | $1,095,365.33 / $114,620.18 |
| a harvest that raises the tax | 0 (the script refuses one) |

## CSV columns

Money has two decimals. Rates and ratios have six. Dates are ISO (`2026-04-15`). Flags are `yes` / `no`. A blank means
"not typed" in an input column and "does not apply" in an output column.

**Lot keys.** A lot is `holding_index|lot_index`, both counted from 0 in the order of the input fields: the holding's
place in `holdings`, the lot's place among that holding's lots in `lots`. The unassigned lot is `holding_index|u`.
Lists of lots follow input order: holding by holding, lots in their order, the unassigned lot last in its holding.

**lots.csv**

`case_id, acquired, today, today_is, long_on, term, days_to_long, long_on_page, term_page, days_to_long_page,
law_page_differ, note`

- `long_on`: the law's first long-term day (blank when undated). `term`: `long` when `today` is on or after it, else
  `short` (undated: `long`). `days_to_long`: calendar days from `today` to `long_on`, 0 when long.
- `*_page`: the page's convention (the day after the calendar anniversary; a February 29 purchase: March 1).
  `today_is` labels the input (`anniversary`, `day_after_anniversary`, `day_before_anniversary`,
  `two_days_after_anniversary`, `purchase_day`, `other`, `no_date`).

**households.csv**

Inputs:

`case_id, row_kind, tax_year, today, filing_status, other_ordinary, qualified_dividends, st_realized, lt_realized,
holdings, lots`

- `row_kind`: `edge` or `random`. `tax_year` is `today`'s year.
- `holdings`: `symbol|kind|price|shares|cost_basis` joined by `;`. `kind` is `taxable` or `ira`.
- `lots`: `holding_index|date|shares|cost` joined by `;`. The date is blank when undated.

Outputs:

- `lot_results`: `key|value|gain|term|long_on|days_to_long|assigned`, every lot, IRA lots included. `assigned` is `no`
  for the unassigned lot. The term is the law's.
- `lot_page_contrast`: `key|long_on_page|term_page|days_to_long_page` for the lots where the page's way differs (only
  first long-term days, February 28 of 2019 or 2023; the term never differs in 2025-2026).
- `holding_results`: `holding_index|shares|value|cost|gain`, the sums over the holding's lots. The cost is the lots'
  cost, so it is above the typed basis where the floor bit.
- `marginal_rate`, `gains_rate`: the page's rates (rule 3), from the change in income tax + NIIT between federal totals
  each rounded to the cent (R2), never below 0.
- `harvest`: `key|loss|page_tax_saved|wash_sale|disallowed` per candidate, in lot order. A candidate is a taxable lot
  losing more than $1. `page_tax_saved` = loss x marginal rate (short today) or gains rate (long). `wash_sale` and
  `disallowed` are the law's share-for-share match.
- `harvest_count`, `harvest_total` (sum of losses), `page_tax_saved_total`.
- `short_losses`, `long_losses`: candidate losses by term. `disallowed_total`, `short_losses_allowed`,
  `long_losses_allowed`: after wash sales.
- `tax_without`, `tax_with`: the federal total (income tax + NIIT) for the year without selling, and with every
  candidate sold today. `niit_without`, `niit_with` are the NIIT parts. `harvest_tax_saved_law` = without - with.
- `ratio_law_to_page` = law / page total; blank when the page total is 0.
- `harvest_carryover_short`, `harvest_carryover_long`: the capital loss carried to next year if every candidate is
  sold (the worksheet; character kept). `carryover_without_*`: the same without selling (a negative `st_realized` or
  `lt_realized` can carry alone). `carryover_added_*` = with - without.
- `wash_matches`: `sold_key|replacement_key|shares|disallowed|account|new_basis` per match. `new_basis` is the matched
  replacement shares' cost plus the disallowed loss; it is blank for an IRA, where the loss is lost for good.
- `wash_plain_test`: the candidates for which the brief's plain test (any other lot of the ticker dated today - 30 to
  today, sold or not) says yes.
- `wash_basis_note`: plain words for each match, plus the not-knowable note (a purchase of the ticker in the next 30
  days, to `today + 30`, would also make a wash sale).
- `same_day_sensitive`: the W3 flag; a test should skip the short / long split on such a row.
- `sell_first`: the page's order (rule 6), the first eight taxable lots by gain per share, lowest first, `;`-joined
  keys. `sell_first_tie`: `yes` when a tie in gain per share touches the first eight, so the tie-break decides.
- `sell_first_tax_per_dollar`: the contrast. Losses first, most negative gain per dollar first; then max(0, gain) x
  (marginal if short, gains rate if long) / value, lowest first; input order on ties; first eight.
- `note`: on an edge row, what it pins down. On a random row, the notable things:
  - same-day sensitive;
  - a wash sale against an IRA or a taxable purchase;
  - the plain test and the match differ;
  - an unassigned cost floored;
  - first long-term days that differ;
  - a tie that decides the order;
  - worksheet line 25 binding;
  - a carryover.

## Open points (judgement calls a reviewer should know)

1. **Law first, the page beside it.**
   - The law's first long-term day follows Pub. 550 and Rev. Rul. 66-7: a purchase on a month's last day is long-term
     from the first day of the 13th month after. The page's is the day after the anniversary.
   - They part only for February 28 of a year before a leap year. Law: March 1. Page: February 29.
   - households.csv: this changes only `long_on` of 2019 and 2023 February 28 lots (`lot_page_contrast`), never a term.
   - lots.csv: two rows differ in their term too (`term-0014`, `term-0288`).
   - Rev. Rul. 66-7 was read in a secondary copy only.
2. **The page's figure against the law's.** `page_tax_saved_total` is the page's rule 3, which ignores wash sales and
   the $3,000 limit. `harvest_tax_saved_law` is the law. They differ on most rows. The law saves less on 1,214: the
   limit, the 0% band, a short loss that only cancels gains taxed at 15%, wash sales. It saves more on 161 by more than
   $1 (52 of them where the page's figure is $0; the coverage table's 111 counts only rows with a ratio): a long-term
   loss that cancels short-term gains or ordinary income, which the page prices at the gains rate. The golden test's
   `saved` part holds the page's total to `harvest_tax_saved_law` (verdict: the page is wrong, open point 15).
3. **Rates.** The extra $1,000 is interest (marginal) or qualified dividends (gains rate), with the household as typed
   and nothing harvested. It counts as investment income for the NIIT. The rate is the change in income tax + NIIT
   between the two totals, each rounded to the cent (R2: a total of tax is money; revised 2026-10-31, see 15). A page that adds a flat 0.038 whenever MAGI is over the line differs where the $1,000 crosses the line part
   way (20 rows for the marginal rate), or where net investment income is below $1,000.
4. **The worksheet cap.** Line 25 of the Qualified Dividends and Capital Gain Tax Worksheet takes the regular tax when
   that is lower. That happens when the dividends sit just above the 0% top inside the 12% bracket. There the gains
   rate can exceed the marginal rate (`lots-2026-sgl-0036`: 0.165 against 0.145; 6 rows in all).
5. **Net investment income and a net capital loss** (the brief's Form 8960 question): yes, the loss reduces it, but
   only by the allowed $3,000 / $1,500 (Form 1040 line 7a, Form 8960 line 5a; 1.1411-4(d)(3)(ii) Example 1), floored
   at 0 (line 12).
6. **The carryover columns.** `harvest_carryover_*` is the whole carryover to next year if every candidate is sold. A
   negative realized figure can carry on its own, so `carryover_without_*` and `carryover_added_*` are given too. With
   taxable income below zero, more than the loss over $3,000 carries (K1, 75 rows).
7. **The unassigned lot** (L1) is undated, long-term with 0 days to go, a harvest candidate when it loses, in the order
   to sell, never a replacement, and counted as bought first when sold (W4). Its cost is the typed basis minus the
   lots' cost, floored at 0. Whether the page offers it for harvesting was not checked (the independence rule).
8. **Wash sales.**
   - The window is today - 30 to today, both days included.
   - Every account of the household counts, the spouse's on a separate return too (C3).
   - The same ticker is substantially identical; a different ticker is not (W1, a convention: the law's test is facts
     and circumstances).
   - Losses take replacement shares in order of their own purchase, and replacement shares are used in order of
     purchase, each once (1.1091-1(b)-(e)).
   - The plain reading of the brief (any other lot in the window) is the contrast `wash_plain_test`. It differs on 310
     candidates, mostly where an earlier loss lot already used the replacement shares.
   - A purchase in the next 30 days cannot be known; it is a note only.
9. **Same-day replacements (W3).** A lot that is itself sold in the harvest is never a replacement. No source read
   decides this. The literal reading of 1091 moves part of an older lot's loss into the newer lot's basis and holding
   period: the same total this year, but the newer lot can turn long-term. Random rows where this could matter are
   redrawn (235); the one labelled edge row (`lots-2026-sgl-0051`) is flagged `same_day_sensitive`.
10. **The order to sell.**
    - It covers every taxable lot, gains and losses, the unassigned lot too.
    - Ties keep input order (O1, Python's stable sort). How the page breaks ties was not checked; `sell_first_tie`
      marks the 7 rows where it matters.
    - The contrast's term is the law's, which equals the page's on every row.
11. **Tax computation.** The exact formula at every income, never the Tax Table (T1, as the federal key does). No AMT
    (C5). Head of household with no dependents is taken as given. Qualified dividends are all the dividends (C1).
    MAGI = AGI, and nothing is carried in (C2).
12. **The 2026 forms.** The 2026 editions of Pub. 550, Schedule D, Form 8949 and Form 8960 instructions do not exist
    yet; the 2025 ones are applied (the statutes did not change).
13. **Per-lot figures are as of today, before the harvest.** A taxable replacement's basis rises by the disallowed
    loss and its holding period includes the sold lot's. That is in `wash_matches` and `wash_basis_note`, not in its
    `lot_results`.
14. **Not verified on an official source:**
    - Rev. Rul. 66-7 (secondary copy);
    - W1 and W3 (conventions);
    - the page's tie-break, its handling of the unassigned lot, and whether it adds the NIIT as an exact change (all
      three need the page's code, which the independence rule forbids reading).
15. **Checked against the page on 2026-10-31 (after the key was written).** The golden test and a review of its
    disagreements against the sources gave:
    - R2 revised: the page takes its rates from federal totals rounded to the cent. No source decides how a rate is
      rounded, so the key now does the same (`rules.RATE_TOTALS_TO_CENT`, `cents_2`); only `marginal_rate`,
      `gains_rate`, `harvest` (its `page_tax_saved`), `page_tax_saved_total` and `ratio_law_to_page` moved, on 47
      rows; lots.csv did not change.
    - The law's columns were reproduced with the app's own federal engine (the key's allowed losses added to the
      year's sales, the key's interest counted as investment income): `tax_without`, `tax_with`, `niit_*` and
      `harvest_tax_saved_law` agree on 1,547 of 1,547 rows with candidates, and a JavaScript wash-sale match (W1-W4)
      reproduces `harvest_tax_saved_law` on every row. The federal page's own carryover (net loss less the allowed
      loss) is short of `harvest_carryover_*` on 65 rows, all with taxable income below zero: there the key follows
      1212(b)(2) and the worksheet's line 3 (K1).
    - Verdicts: the February 28 holding period (open point 1), the page's "worth about ... of tax" total against the
      law (2) and wash sales against purchases already on file (8) are the page's errors; the order to sell (10) is a
      convention.
    - The same day the page took up all three: the holding period counts a year from the day after the buy, wash sales
      are matched share for share against the household's lots (W1-W4), the tax saved this year is the federal tax
      without the harvest less with it, and the page shows the carryover by the worksheet (`harvest_carryover_*` and
      `carryover_added_*` are now compared too, with each candidate's wash sale, disallowed loss and every match).
      Every row agrees.

## What the key leaves out (on purpose)

- AMT, credits, itemized deductions, the senior deduction and the 65+ standard deduction.
- Non-qualified dividends, wages, state tax, a loss carried in from last year.
- Sales of IRA lots, and a lot's own sale day other than `today`.
- Purchases after `today`. Wash sales from options, short sales or substantially identical funds with different
  tickers.
- First-in first-out or average-cost identification (1.1012-1(c)(1)(i), (e)).
- The broker's single-account reporting under 1.6045-1(d)(6)(iii), which does not change the law.
- The tax effect next year of a carryover or of a replacement's raised basis.
