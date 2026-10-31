# Federal income tax rules sheet, tax years 2024 to 2026

The answer key in `federal-2024.csv`, `federal-2025.csv` and `federal-2026.csv` was worked from this
sheet and the IRS worksheets, never from the app's code. Every figure names its source.

Sources:
- **RP23** = Rev. Proc. 2023-34 (tax year 2024), https://www.irs.gov/pub/irs-drop/rp-23-34.pdf
- **RP24** = Rev. Proc. 2024-40 (tax year 2025), https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
- **OBBBA** = Pub. L. 119-21 of 2025-07-04 (the July 2025 law): §70102 standard deduction for 2025,
  §70103 senior deduction (IRC §151(d)(5)(C)), §70104 child tax credit (IRC §24), §70120 SALT cap
  (IRC §164(b)(7)), §70111 itemized-deduction limitation (IRC §68), §70424 charitable deduction for
  people who do not itemize (IRC §170(p)), §70425 0.5% floor on itemized charitable gifts
  (IRC §170(b)(1)(I)). IRS fact sheet FS-2025-03 for the senior deduction; draft 2025 Schedule 1-A
  Part V for the senior worksheet.
- **RP25** = Rev. Proc. 2025-32 (tax year 2026), https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
- **STAT** = figures fixed in the Code and not indexed: IRC §86 (Social Security), §1411 (NIIT),
  §3101(b)(2) (additional Medicare), §24(b) (credit phase-out), §1211(b) (capital loss limit).

Filing status ids: `single`, `married_joint`, `married_separate`, `head_of_household`.

## 1. Ordinary brackets (bracket tops; the 37% bracket has no top)

Rates 10, 12, 22, 24, 32, 35, 37%.

| Year | Status | 10% to | 12% to | 22% to | 24% to | 32% to | 35% to | Source |
|---|---|---|---|---|---|---|---|---|
| 2024 | single | 11,600 | 47,150 | 100,525 | 191,950 | 243,725 | 609,350 | RP23 §3.01 |
| 2024 | married_joint | 23,200 | 94,300 | 201,050 | 383,900 | 487,450 | 731,200 | RP23 §3.01 |
| 2024 | married_separate | 11,600 | 47,150 | 100,525 | 191,950 | 243,725 | 365,600 | RP23 §3.01 |
| 2024 | head_of_household | 16,550 | 63,100 | 100,500 | 191,950 | 243,700 | 609,350 | RP23 §3.01 |
| 2025 | single | 11,925 | 48,475 | 103,350 | 197,300 | 250,525 | 626,350 | RP24 §3.01 (unchanged by OBBBA) |
| 2025 | married_joint | 23,850 | 96,950 | 206,700 | 394,600 | 501,050 | 751,600 | RP24 §3.01 |
| 2025 | married_separate | 11,925 | 48,475 | 103,350 | 197,300 | 250,525 | 375,800 | RP24 §3.01 |
| 2025 | head_of_household | 17,000 | 64,850 | 103,350 | 197,300 | 250,500 | 626,350 | RP24 §3.01 |
| 2026 | single | 12,400 | 50,400 | 105,700 | 201,775 | 256,225 | 640,600 | RP25 §4.01 |
| 2026 | married_joint | 24,800 | 100,800 | 211,400 | 403,550 | 512,450 | 768,700 | RP25 §4.01 |
| 2026 | married_separate | 12,400 | 50,400 | 105,700 | 201,775 | 256,225 | 384,350 | RP25 §4.01 |
| 2026 | head_of_household | 17,700 | 67,450 | 105,700 | 201,750 | 256,200 | 640,600 | RP25 §4.01 |

Tax is worked with the Tax Computation formula on exact amounts (no Tax Table rounding, even under
100,000), so the key matches a calculator to the cent.

## 2. Standard deduction and the 65+/blind additions

| Year | single | married_joint | married_separate | head_of_household | Addition, married (MFJ, MFS) | Addition, unmarried (single, HoH) | Source |
|---|---|---|---|---|---|---|---|
| 2024 | 14,600 | 29,200 | 14,600 | 21,900 | 1,550 | 1,950 | RP23 §3.15 |
| 2025 | 15,750 | 31,500 | 15,750 | 23,625 | 1,600 | 2,000 | OBBBA §70102 (amounts); RP24 §3.15 (additions) |
| 2026 | 16,100 | 32,200 | 16,100 | 24,150 | 1,650 | 2,050 | RP25 §4.14 |

One addition for each of: filer 65 or older at year end, filer blind, and (married_joint only) spouse
65+, spouse blind. For single, head_of_household and married_separate only the filer's own age and
blindness count (`age_2`, `blind_2` are 0 on those rows).

## 3. Senior deduction (2025 to 2028 only; none in 2024)

- 6,000 for each person 65 or older at year end (filer, and spouse on a joint return). OBBBA §70103.
- **Married people must file jointly to get it: married_separate gets 0.** FS-2025-03 ("file jointly
  if married, to claim the deduction").
- Phase-out, per Schedule 1-A Part V: excess = AGI - 75,000 (150,000 married_joint), floor 0;
  per-person amount = max(0, 6,000 - 6% x excess); deduction = per-person amount x number of people
  65+. **The 6% reduction is applied to each person's 6,000**, so a joint return with both 65+ is
  fully phased out at 250,000 (single/HoH at 175,000).
- Taken whether the return itemizes or not; it is subtracted from AGI with the other deductions.

## 4. Itemized deductions

Itemized total = state and local taxes (capped) + mortgage interest + charity (2026: after the floor),
then (2026 only) the §68 reduction. The return itemizes only when that total is larger than the
standard deduction with additions (2026: larger than standard + the non-itemizer charity deduction);
a tie takes the standard deduction. Mortgage interest is assumed to be on acquisition debt under the
750,000 limit; charity is cash to public charities and stays under 60% of AGI.

**SALT cap** (MAGI = AGI here):

| Year | Status | Cap | Phase-down starts at AGI | Rate | Floor | Floor reached at AGI | Source |
|---|---|---|---|---|---|---|---|
| 2024 | all but MFS | 10,000 | none | | | | IRC §164(b)(6) |
| 2024 | married_separate | 5,000 | none | | | | IRC §164(b)(6) |
| 2025 | all but MFS | 40,000 | 500,000 | 30% | 10,000 | 600,000 | OBBBA §70120 |
| 2025 | married_separate | 20,000 | 250,000 | 30% | 5,000 | 300,000 | OBBBA §70120 |
| 2026 | all but MFS | 40,400 | 505,000 | 30% | 10,000 | 606,333.33 | OBBBA §70120 (101% of 2025) |
| 2026 | married_separate | 20,200 | 252,500 | 30% | 5,000 | 303,166.67 | OBBBA §70120 |

cap(AGI) = max(floor, cap - 30% x max(0, AGI - start)). **For married_separate the rate is the full
30% on the excess over the halved start**, not half of it.

**2026 charity and itemizing changes (OBBBA):**
- Itemized charity counts only above 0.5% of AGI: max(0, charity - 0.005 x AGI). §70425.
- Non-itemizers deduct cash gifts up to 1,000 (2,000 married_joint): min(charity, 1,000 or 2,000), on
  top of the standard deduction. §70424.
- §68 limitation (37% bracket): itemized deductions are reduced by 2/37 of the smaller of (a) the
  itemized total and (b) AGI - senior deduction - the 37% bracket start (taxable income before the
  limit, plus the itemized deductions, over the 37% start), floor 0. §70111.

## 5. Capital gains and qualified dividends

- `st_gain`, `lt_gain` are the year's net short-term and net long-term results (Schedule D lines 7 and
  15), either may be negative. Net them as Schedule D: a loss on one side offsets a gain on the other;
  a combined net loss is deductible up to 3,000 (1,500 married_separate), the rest carries forward
  (ignored here). IRC §1211(b).
- Net capital gain for the preferential rates = qualified dividends + max(0, min(net LT after
  offset, total net gain)). Qualified dividends are part of `ordinary_dividends` (1099-DIV box 1a
  includes box 1b), so the ordinary (non-qualified) part is ordinary_dividends - qualified_dividends.
- Qualified Dividends and Capital Gain Tax Worksheet: 0% up to the first threshold, 15% to the second,
  20% above, stacked on top of ordinary taxable income; line 25 takes the smaller of that and the
  regular tax on all taxable income.

| Year | Status | 0% to | 15% to | Source |
|---|---|---|---|---|
| 2024 | single | 47,025 | 518,900 | RP23 §3.03 |
| 2024 | married_joint | 94,050 | 583,750 | RP23 §3.03 |
| 2024 | married_separate | 47,025 | 291,850 | RP23 §3.03 |
| 2024 | head_of_household | 63,000 | 551,350 | RP23 §3.03 |
| 2025 | single | 48,350 | 533,400 | RP24 §3.03 |
| 2025 | married_joint | 96,700 | 600,050 | RP24 §3.03 |
| 2025 | married_separate | 48,350 | 300,000 | RP24 §3.03 |
| 2025 | head_of_household | 64,750 | 566,700 | RP24 §3.03 |
| 2026 | single | 49,450 | 545,500 | RP25 §4.03 |
| 2026 | married_joint | 98,900 | 613,700 | RP25 §4.03 |
| 2026 | married_separate | 49,450 | 306,850 | RP25 §4.03 |
| 2026 | head_of_household | 66,200 | 579,600 | RP25 §4.03 |

## 6. Social Security benefits (all years; not indexed, IRC §86)

| Status | Base amount | Adjusted base (base + extra) |
|---|---|---|
| single, head_of_household | 25,000 | 34,000 (extra 9,000) |
| married_joint | 32,000 | 44,000 (extra 12,000) |
| married_separate | 25,000 | 34,000 — assumed lived apart all year, which takes the single figures (living together at any time in the year the base is 0, IRC §86(c)(1)(C)(ii); since 2026-10-31 that is the engine's default, so `tests/golden-federal.test.mjs` feeds these rows the lived-apart figures) |

Social Security Benefits Worksheet (Form 1040 instructions): provisional = all other income in AGI
(wages, interest, all dividends, allowed capital gain or loss, pensions, IRA) + half the benefits
(no tax-exempt interest or adjustments on these rows); over = provisional - base (0 or less: nothing
taxable); taxable = min(0.85 x benefits, min(benefits/2, min(over, extra)/2) + 0.85 x max(0, over - extra)).

## 7. Child tax credit and credit for other dependents (Schedule 8812)

| Year | Per child under 17 | Per other dependent | Refundable (ACTC) cap per child | Source |
|---|---|---|---|---|
| 2024 | 2,000 | 500 | 1,700 | IRC §24(h); RP23 §3.06 |
| 2025 | 2,200 | 500 | 1,700 | OBBBA §70104; RP24 §3.06 |
| 2026 | 2,200 | 500 | 1,700 | RP25 §4.06 |

- Phase-out: 50 for each 1,000 **or fraction of 1,000** of AGI over 400,000 (married_joint) or 200,000
  (all others): reduction = 50 x ceil(max(0, AGI - threshold) / 1,000). STAT §24(b). The credit is gone once
  the reduction reaches the full credit: at AGI over threshold + 1,000 x (full credit / 50 - 1).
- Nonrefundable part = min(credit after phase-out, income tax before credits).
- ACTC = min(credit left over, 1,700 x children under 17, 15% x max(0, wages - 2,500)). Rows with
  3+ children keep wages at 0 or at least 6,000 so the 15% method is always the larger.

## 8. Net investment income tax (Form 8960) and additional Medicare tax (Form 8959)

| Status | NIIT threshold (MAGI) | Additional Medicare threshold (wages) |
|---|---|---|
| single | 200,000 | 200,000 |
| married_joint | 250,000 | 250,000 |
| married_separate | 125,000 | 125,000 |
| head_of_household | 200,000 | 200,000 |

STAT §1411(b), §3101(b)(2), same all three years.
- NIIT = 3.8% x min(max(0, net investment income), max(0, AGI - threshold)); net investment income =
  interest + ordinary dividends + the capital gain or allowed loss on Form 1040 line 7. Wages,
  pensions, IRA distributions and Social Security are not investment income.
- Additional Medicare = 0.9% x max(0, wages - threshold).

## 9. The output columns

- `agi`: Form 1040 line 11 (wages + interest + ordinary dividends + allowed capital gain or loss +
  pensions + IRA + taxable Social Security). It can be negative when a capital loss exceeds the rest.
- `deduction`: everything between AGI and taxable income: standard or itemized (2026: after the
  limits, or standard + non-itemizer charity) + senior deduction.
- `taxable_income` = max(0, agi - deduction).
- `ordinary_tax`: the brackets on taxable income minus the preferential part.
- `capital_gains_tax`: income tax (worksheet line 25) minus `ordinary_tax`.
- `credits`: nonrefundable child and other-dependent credit used + ACTC.
- `total_tax` = ordinary_tax + capital_gains_tax - nonrefundable credit + niit + additional_medicare
  - ACTC (negative when the refundable credit is larger).
- `marginal_rate` = (total_tax with ira_distributions + 1,000, everything recomputed) - total_tax,
  divided by 1,000; six decimals.
- Money is exact, rounded to the cent half-up only at the end. No intermediate rounding except the
  credit phase-out's whole-1,000 step.

## 10. How the key was made and checked

- 12 workers (one per year and filing status, 4 income bands each = the 48 shards of 250 rows: 100
  grid, 100 edge, 50 random) each wrote their own calculator from this sheet without opening the
  app's code, then re-derived every tenth row a second way (a separate line-by-line transcription of
  the IRS worksheets in Decimal arithmetic, plus a few rows with plain calculator arithmetic). All
  1,200 re-derivations agreed to the cent; no row is flagged.
- The lead re-derived every row (well over the 2% sample) with a third calculator written from this
  sheet: 12,000 of 12,000 agree to the cent (marginal rate to 0.001).
- Rounding: exact arithmetic, each column rounded half-up to the cent at the end; the marginal rate
  uses the unrounded totals, six decimals.

## 11. Known disagreements with the engine (the `todo` rows)

**All seven fixed 2026-10-30 (F-029):** `core/math/tax.js` and `itemizedTotal` now follow this sheet, the
runner passes the allowed capital loss and the cash gifts the way the Federal page does, and
`federal-todo.json` is empty; all 12,000 rows agree within $1. The table below is kept as the record.

`tests/golden/taxes/federal-todo.json` lists the case ids for each cause; 2,246 of the 12,000 rows.
Applying all seven fixes below to a scratch copy of the engine made all 12,000 rows agree, and
leaving out any one of them brought its rows back.

| Cause | Rows | Example | Key | Engine |
|---|---|---|---|---|
| capital-loss-dropped | 870 | `2024-head_of_household-b1-g082`: wages 40,749, interest 815, dividends 2,038 (1,223 qualified), ST -1,222, LT -1,630 | net loss -2,852 allowed; AGI 40,750; taxable 18,850; tax 1,784.24; credit 2,000 (1,784.24 + ACTC 215.76); total -215.76 | the loss only offsets 815 + 815 of interest and non-qualified dividends, then otherOrdinary is floored at 0: AGI 41,972; total -69.12 |
| senior-deduction-separate | 325 | `2025-married_separate-b1-g003`: age 75, pension 364, IRA 242 | standard 15,750 + 1,600 = 17,350, no senior deduction (married must file jointly) | 23,350 |
| senior-phase-out-per-person | 96 | `2025-married_joint-b3-g007`: both 65+, AGI 157,521.80 | 6% x 7,521.80 = 451.31 off each 6,000: 2 x 5,548.69 = 11,097.38; deduction 34,700 + 11,097.38 = 45,797.38; total 5,107.37 | 12,000 - 451.31 = 11,548.69; deduction 46,248.69; total 5,008.08 |
| gains-worksheet-line-25 | 1 | `2026-single-b2-r027`: taxable 48,644 with 188 qualified; +1,000 IRA puts taxable at 49,644, over the 49,450 0% top but under the 12% top 50,400 | line 25 takes the regular tax: marginal (120 + 188 x 12%) / 1,000 = 0.142560 | 188 at 15%: 0.148200 |
| salt-separate-phase-down | 50 | `2025-married_separate-b3-g048`: AGI 263,849.70, SALT paid 17,621 | cap 20,000 - 30% x 13,849.70 = 15,845.09; itemized 15,845.09 + 18,808 + 8,061 = 42,714.09; total 45,133.14 | cap 20,000 - 15% x 13,849.70 = 17,922.55, so all 17,621 counts: 44,490; total 44,706.92 |
| charity-2026 | 998 | `2026-head_of_household-b1-g004`: standard deduction, 45 of gifts | 24,150 + 45 = 24,195 | 24,150 |
| itemized-limit-2026 | 225 | `2026-head_of_household-b4-r041`: AGI 2,785,977, itemized 10,000 (SALT at the floor) + 18,526 | cut 2/37 x 28,526 = 1,541.95; deduction 26,984.05; total 682,487.64 | 28,526; total 681,870.86 |

Also seen while mapping, not a CSV column: `taxInputs()` in `modules/taxes/federal/compute.js`
never passes `investmentIncome`, so on the page the NIIT only sees qualified dividends and long
gains (interest, non-qualified dividends and short gains are left out, Form 8960 lines 1, 2, 5a).
The golden runner passes it explicitly, so the CSV rows do not show this.
