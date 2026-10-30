# Paycheck answer keys: rules sheet and hand-worked rows

`withholding.csv` (3,000 rows) and `payroll.csv` (1,500 rows) come from
`tools/golden_paycheck/withholding_key.py` and `payroll_key.py`. Those scripts were written from
IRS Publication 15-T (2026), Publication 15 (2026), the IRS Additional Medicare Tax Q&A and
Rev. Proc. 2025-32, without opening the app's code. `tools/golden_paycheck/README.md` lists every
rule with its source, the rounding choice, the coverage and what the keys leave out.
`tools/golden_paycheck/rules.py` holds the figures.

This sheet works six rows by hand, line by line, so a reader can check the method without
running anything. Each figure below matches the CSV to the cent.

Conventions:

- Worksheet 1A (Pub. 15-T p.10) is worked with the annual tables on p.12. Nothing is rounded
  until a column is written; then each column is rounded half up to the cent on its own. There
  is no rounding to whole dollars.
- Long decimals below are cut to 6 places for reading. The key carries them exactly.

## Withholding row 1: `wh-0001` (married filing jointly, biweekly, every W-4 step used)

Inputs: 26 paychecks; wages 2,491.78 a paycheck; married filing jointly; Step 2 box not checked;
Step 3 credits 2,500; Step 4(a) other income 854; Step 4(b) deductions 608; Step 4(c) extra 0.

| Line | Working | Amount |
|---|---|---|
| 1a | wages this paycheck | 2,491.78 |
| 1b | pay periods | 26 |
| 1c | 2,491.78 x 26 | 64,786.28 |
| 1d | Step 4(a) | 854.00 |
| 1e | 64,786.28 + 854.00 | 65,640.28 |
| 1f | Step 4(b) | 608.00 |
| 1g | box not checked, married filing jointly | 12,900.00 |
| 1h | 608.00 + 12,900.00 | 13,508.00 |
| 1i | 65,640.28 - 13,508.00 | **52,132.28** (`adjusted_annual`) |
| 2b-2d | STANDARD, married filing jointly: the row from 44,100 to 120,100 | A 44,100; C 2,480.00; D 12% |
| 2e | 52,132.28 - 44,100 | 8,032.28 |
| 2f | 8,032.28 x 12% | 963.8736 |
| 2g | 2,480.00 + 963.8736 | 3,443.8736, written **3,443.87** (`tentative_annual`) |
| 2h | 3,443.8736 / 26 | 132.456677 |
| 3a | Step 3 | 2,500.00 |
| 3b | 2,500 / 26 | 96.153846 |
| 3c | 132.456677 - 96.153846 | 36.302831 |
| 4a | Step 4(c) | 0.00 |
| 4b | 36.302831 + 0 | **36.30** (`withholding`) |

Checks on this row:

- The law gives the same 2g. The taxable amount is 65,640.28 - 608 - 32,200 (standard deduction)
  = 32,832.28. The tax on it is 2,480 + 12% x (32,832.28 - 24,800) = 3,443.8736.
- A payroll that rounds 2h to 132.46 and 3b to 96.15 before subtracting gets 36.31, one cent
  more. The key does not round lines 2h and 3b.
- Worksheet 4 with the biweekly per-period tables (Pub. 15-T p.59) gives 36.355138, which rounds to 36.36. The two methods
  are not meant to agree to the cent.

## Withholding row 2: `wh-edge-081` (single, box checked, exactly on the 108,938 start)

Inputs: 4 paychecks (quarterly); wages 27,234.50; single or married filing separately; Step 2
box checked; no other W-4 entries.

| Line | Working | Amount |
|---|---|---|
| 1c | 27,234.50 x 4 | 108,938.00 |
| 1d, 1e | 0; 108,938.00 + 0 | 108,938.00 |
| 1f, 1g, 1h | 0; box checked, so 0; 0 | 0.00 |
| 1i | 108,938.00 - 0 | **108,938.00** |
| 2b-2d | Step 2 Checkbox, single: the row from 108,938 to 136,163 | A 108,938; C 20,512.00; D 32% |
| 2e, 2f | 108,938.00 - 108,938 = 0; 0 x 32% | 0.00 |
| 2g | 20,512.00 + 0 | **20,512.00** |
| 2h | 20,512.00 / 4 | 5,128.00 |
| 3a-3c | no credits | 5,128.00 |
| 4b | 5,128.00 + 0 | **5,128.00** |

**The neighbour one cent below:** `wh-edge-079` (24 paychecks of 4,539.08, Step 4(a) 0.07,
single, box checked).

- 1i = 4,539.08 x 24 + 0.07 = 108,937.99. That falls in the row from 60,900 to 108,938 (C 8,983,
  D 24%).
- 2g = 8,983 + 24% x 48,037.99 = 8,983 + 11,529.1176 = 20,512.1176, written **20,512.12**: 12
  cents more a year for one cent less pay.
- 2h = 4b = 20,512.1176 / 24 = 854.671567, written **854.67**.

The printed table jumps here because Pub. 15-T rounded this row's start (half of 217,875 =
108,937.50) up to 108,938. The law gives 20,512.16: half the single tax on 2 x (108,938 - 8,050)
= 201,776, which is (41,024 + 32% x 1) / 2. The key follows the printed table.

## Withholding row 3: `wh-0405` (head of household, box checked, extra withholding, a half cent)

Inputs: 12 paychecks (monthly); wages 1,713.70; head of household; Step 2 box checked; Step 4(c)
extra 42.00; nothing else.

| Line | Working | Amount |
|---|---|---|
| 1c, 1e | 1,713.70 x 12; + 0 | 20,564.40 |
| 1g, 1h | box checked, so 0; 0 | 0.00 |
| 1i | 20,564.40 - 0 | **20,564.40** |
| 2b-2d | Step 2 Checkbox, head of household: the row from 12,075 to 20,925 | A 12,075; C 0.00; D 10% |
| 2e | 20,564.40 - 12,075 | 8,489.40 |
| 2f, 2g | 8,489.40 x 10%; 0 + 848.94 | **848.94** |
| 2h | 848.94 / 12 | 70.745 (exactly) |
| 3a-3c | no credits | 70.745 |
| 4a | Step 4(c) | 42.00 |
| 4b | 70.745 + 42.00 = 112.745, exactly on a half cent, rounded half up | **112.75** |

Banker's rounding, or `Math.round(x * 100) / 100` on a binary float that lands just under
112.745, gives 112.74. Twenty-one rows of the CSV sit on an exact half cent like this one.
Worksheet 4 with the monthly per-period tables gives 112.77.

## Payroll row 1: `pay-0007` (never reaches the wage base)

Inputs: 24 paychecks of 2,833.33.

| Step | Working | Amount |
|---|---|---|
| Year's wages | 2,833.33 x 24 | 67,999.92 |
| Social Security | 6.2% x 67,999.92 (under 184,500, so all of it) = 4,215.99504 | **4,216.00** |
| Medicare | 1.45% x 67,999.92 = 985.99884; nothing above 200,000 | **986.00** |
| `ss_last_paycheck` | 67,999.92 < 184,500: the base is never reached | blank |
| `extra_medicare_first_paycheck` | 67,999.92 <= 200,000 | blank |

## Payroll row 2: `pay-edge-020` (lands exactly on the wage base at paycheck 12)

Inputs: 52 paychecks of 15,375.00 (184,500 / 12 = 15,375.00 exactly).

| Step | Working | Amount |
|---|---|---|
| Year's wages | 15,375 x 52 | 799,500.00 |
| Social Security | 6.2% x 184,500 (the base) | **11,439.00** |
| Medicare | 1.45% x 799,500 = 11,592.75; plus 0.9% x (799,500 - 200,000) = 5,395.50 | **16,988.25** |
| `ss_last_paycheck` | after 11 paychecks 169,125 < 184,500; after 12 exactly 184,500, the first to reach the base. Paycheck 12 takes full Social Security, paycheck 13 takes none | **12** |
| `extra_medicare_first_paycheck` | after 13 paychecks 199,875 <= 200,000; after 14, 215,250 > 200,000. Paycheck 14 is the first with wages over 200,000 (15,250 of them) | **14** |

Its twins one cent either side:

- `pay-edge-019` (15,374.99): after 12 paychecks 184,499.88, so the base is reached at 13.
- `pay-edge-021` (15,375.01): after 12 paychecks 184,500.12, so still 12.

Both keep 14 for the Additional Medicare Tax.

## Payroll row 3: `pay-0022` (passes the base inside a paycheck, then 200,000)

Inputs: 26 paychecks of 9,020.28.

| Step | Working | Amount |
|---|---|---|
| Year's wages | 9,020.28 x 26 | 234,527.28 |
| Paychecks 1-20 | 6.2% x 9,020.28 = 559.25736 each; wages so far after 20: 180,405.60 | |
| Paycheck 21 | wages so far 189,425.88, which passes 184,500. Only 184,500 - 180,405.60 = 4,094.40 is taxed: 6.2% x 4,094.40 = 253.8528 | |
| Social Security | 20 x 559.25736 + 253.8528 = 11,439.0000 (= 6.2% x 184,500) | **11,439.00** |
| `ss_last_paycheck` | paycheck 21 is the first at or past the base, and the last with any Social Security | **21** |
| Paychecks 22, 23 | after 22: 198,446.16 <= 200,000; after 23: 207,466.44 > 200,000. Paycheck 23 carries 7,466.44 above 200,000 | |
| `extra_medicare_first_paycheck` | | **23** |
| Medicare | 1.45% x 234,527.28 = 3,400.64556; plus 0.9% x (234,527.28 - 200,000) = 0.9% x 34,527.28 = 310.74552; total 3,711.39108 | **3,711.39** |

The Additional Medicare Tax adds up the same way paycheck by paycheck:
0.9% x (7,466.44 + 3 x 9,020.28) = 67.19796 + 243.54756 = 310.74552.
