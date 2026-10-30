# Business answer keys: hand-worked rows

`sole.csv` (2,000 rows), `scorp.csv` (1,000 rows) and `plans.csv` (1,000 rows) come from
`tools/golden_business/sole_key.py`, `scorp_key.py` and `plans_key.py`. Those scripts were written
from IRS forms, publications and the Code without opening the app's code.
`tools/golden_business/README.md` lists every rule with its source and date, the choices made and
what the keys leave out. `tools/golden_business/rules.py` holds the figures.

This sheet works nine rows by hand (three per CSV), line by line, so a reader can check the method
without running anything. Each bold figure matches the CSV to the cent.

Conventions:
- Exact arithmetic, rounded half-up to cents only at the end. No IRS Tax Table, no rounding to whole
  dollars.
- Tax is the exact Tax Computation formula. With dividends it is the Qualified Dividends and Capital
  Gain Tax Worksheet. All dividends are qualified.
- `tax_with` / `tax_without` = regular tax - nonrefundable child tax credit + net investment income
  tax - additional child tax credit. No self-employment or additional Medicare tax in it.

## Sole row 1: `sole-2025-married_separate-242`

Married filing separately, 2025. This row has the wage base splitting the SE tax, the health
deduction, a SEP at its maximum, the net investment income tax and additional Medicare tax.

Inputs: owner wages 103,806; qualified dividends 22,300; 2 children; profit 81,926; health premiums
20,944; SEP contribution 15,269.34.

| Step | Working | Amount |
|---|---|---|
| Schedule SE line 4a = 6 | 81,926 x 92.35% | 75,658.661 |
| line 9 | 176,100 - 103,806 | 72,294.00 |
| line 10 | 12.4% x the smaller, 72,294 | 8,964.456 |
| line 11 | 2.9% x 75,658.661 | 2,194.101169 |
| line 12 SE tax | 8,964.456 + 2,194.101169 | **11,158.56** |
| line 13 | half | **5,579.28** (5,579.2785845) |
| SEP maximum | 20% x (81,926 - 5,579.2785845) = 20% x 76,346.7214155 = 15,269.344; the input is that, rounded down to the cent | 15,269.34 |
| Form 7206 line 8 | 81,926 - 5,579.2785845 | 76,346.7214155 |
| line 10 | 76,346.7214155 - 15,269.34 | 61,077.3814155 |
| line 14 SEHI | smaller of 20,944 and line 10 | **20,944.00** |
| AGI (line 11a) | 103,806 + 22,300 + 81,926 - 5,579.2785845 - 15,269.34 - 20,944 | **166,239.38** |
| Form 8995 line 11 | 166,239.3814155 - 15,750 (under the 197,300 threshold) | 150,489.3814155 |
| line 1(c) QBI | 81,926 - 5,579.2785845 - 20,944 - 15,269.34 | 40,133.3814155 |
| line 5 = 10 | 20% | 8,026.6762831 |
| line 14 | 20% x (150,489.3814155 - 22,300) | 25,637.88 |
| line 15 QBI deduction | the smaller | **8,026.68** |
| Taxable income | 150,489.3814155 - 8,026.6762831 | **142,462.71** (142,462.7051324) |
| Worksheet line 5 | 142,462.7051324 - 22,300 | 120,162.7051324 |
| line 22 | 17,651 + 24% x (120,162.7051324 - 103,350) | 21,686.0492318 |
| line 18 | the 0% top 48,350 is under line 5; 22,300 x 15% (the 15% top for separate is 300,000) | 3,345.00 |
| line 25 regular tax | 25,031.0492318, less than the tax on all 142,462.71 (27,038.05) | 25,031.05 |
| Child tax credit | AGI under 200,000: 2 x 2,200 = 4,400, all used | -4,400.00 |
| NIIT | 3.8% x smaller of 22,300 and 166,239.38 - 125,000 = 41,239.38 | 847.40 |
| **tax_with** | 25,031.0492318 - 4,400 + 847.40 | **21,478.45** |
| Without the business | AGI 126,106; taxable 110,356; line 5 = 88,056; 5,578.50 + 22% x 39,581 = 14,286.32; + 3,345 = 17,631.32 | |
| | credit 4,400; NIIT 3.8% x 1,106 = 42.028 | |
| **tax_without** | 17,631.32 - 4,400 + 42.028 | **13,273.35** |
| Form 8959 line 11 | 125,000 - 103,806 | 21,194 |
| line 13 | 0.9% x (75,658.661 - 21,194) | **490.18** |

## Sole row 2: `sole-2026-single-201`

Single, 2026. The $400 minimum QBI deduction overrides the taxable-income limit.

Inputs: owner wages 1,995; no dividends; no children; profit 16,542; no premiums; no SEP.

| Step | Working | Amount |
|---|---|---|
| Schedule SE line 4a = 6 | 16,542 x 92.35% | 15,276.537 |
| line 9 | 184,500 - 1,995 = 182,505, more than line 6 | |
| line 12 SE tax | 15.3% x 15,276.537 | **2,337.31** |
| line 13 | half | **1,168.66** (1,168.6550805) |
| AGI | 1,995 + 16,542 - 1,168.6550805 | **17,368.34** |
| Form 8995 line 11 | 17,368.3449195 - 16,100 | 1,268.3449195 |
| line 1(c) QBI | 16,542 - 1,168.6550805 | 15,373.3449195 |
| line 10 | 20% | 3,074.67 |
| line 14 | 20% x 1,268.3449195 | 253.67 |
| line 15 | the smaller | 253.67 |
| line 16 | QBI is at least 1,000, material participation: 400 | 400.00 |
| line 17 QBI deduction | the larger | **400.00** |
| Taxable income | 1,268.3449195 - 400 | **868.34** |
| **tax_with** | 10% x 868.3449195; no credits, no NIIT | **86.83** |
| **tax_without** | AGI 1,995, under the standard deduction | **0.00** |
| SEHI, additional Medicare | none | **0.00**, **0.00** |

In 2025 the same row would get only 253.67.

## Sole row 3: `sole-2025-married_joint-071`

Married filing jointly, 2025. A loss lowers AGI and earned income, and the refundable credit
hits its 1,700 per child cap.

Inputs: owner wages 41,552; spouse 0; no dividends; 1 child; profit -5,174 (a loss); no premiums; no SEP.

| Step | Working | Amount |
|---|---|---|
| Schedule SE | line 4a = -5,174, under $400: stop | **0.00** SE tax, **0.00** half |
| AGI | 41,552 - 5,174 | **36,378.00** |
| QBI | line 1(c) = -5,174; line 4 = 0 | **0.00** |
| Taxable income | 36,378 - 31,500 | **4,878.00** |
| Regular tax | 10% x 4,878 | 487.80 |
| Credit | 2,200; line 14 = smaller of 2,200 and 487.80 | -487.80 |
| ACTC | line 16a = 1,712.20; 16b = 1,700; line 17 = 1,700; earned income 41,552 - 5,174 = 36,378; line 20 = 15% x 33,878 = 5,081.70; line 27 = 1,700 | -1,700.00 |
| **tax_with** | 487.80 - 487.80 - 1,700 | **-1,700.00** |
| Without | AGI 41,552; taxable 10,052; tax 1,005.20, all offset; ACTC = smaller of 1,194.80, 1,700, 15% x 39,052 | |
| **tax_without** | 1,005.20 - 1,005.20 - 1,194.80 | **-1,194.80** |

## S corporation row 1: `scorp-2025-married_joint-095`

Married filing jointly, 2025. The salary is over the wage base, an excess social security credit
applies, and the salary adds additional Medicare tax.

Inputs: owner's other job 3,056; spouse 2,381; no dividends; 1 child; profit 373,204; salary
257,044; costs 1,791; premiums 27,960.

| Step | Working | Amount |
|---|---|---|
| Employer social security | 6.2% x 176,100 (the base, per employer) | 10,918.20 |
| Employer Medicare | 1.45% x 257,044 | 3,727.138 |
| **employer_tax** | | **14,645.34** |
| W-2 box 4 (corporation) | 6.2% x 176,100 | 10,918.20 |
| Box 4 (other job) | 6.2% x 3,056 | 189.472 |
| Schedule 3 line 11 | 11,107.672 - 10,918.20 | 189.472 |
| Net social security on the salary | 10,918.20 - 189.472 | 10,728.728 |
| Additional Medicare added | household Medicare wages 3,056 + 2,381 = 5,437 without the salary (under 250,000); 262,481 with it: 0.9% x 12,481 | 112.329 |
| **employee_tax** | 10,728.728 + 3,727.138 + 112.329 | **14,568.20** |
| **passed** (K-1 box 1) | 373,204 - 257,044 - 14,645.338 - 1,791 - 27,960 | **71,763.66** |
| **sehi** | smaller of 27,960 and box 5 wages 257,044 | **27,960.00** |
| W-2 box 1 total | 3,056 + 2,381 + 257,044 + 27,960 | 290,441.00 |
| AGI | 290,441 + 71,763.662 - 27,960 | 334,244.662 |
| Form 8995 line 11 | 334,244.662 - 31,500 (under 394,600) | 302,744.662 |
| line 1(c) | 71,763.662 - 27,960 (IRS FAQ 39) | 43,803.662 |
| **qbi** | 20% = 8,760.7324; the limit 20% x 302,744.66 = 60,548.93 does not bind | **8,760.73** |
| Taxable income | 302,744.662 - 8,760.7324 | 293,983.9296 |
| Regular tax | 35,302 + 24% x (293,983.9296 - 206,700) | 56,250.1431 |
| Credit | AGI under 400,000: 2,200 | -2,200.00 |
| **tax_with** | | **54,050.14** |
| Without | AGI 5,437, taxable 0; ACTC = smaller of 2,200, 1,700, 15% x (5,437 - 2,500) = 440.55 | |
| **tax_without** | | **-440.55** |

## S corporation row 2: `scorp-2026-head_of_household-028`

Head of household, 2026. The K-1 shows a loss, and the health deduction still reduces QBI.

Inputs: other job 13,949; dividends 585; 2 children; profit 77,923; salary 60,282; costs 2,843;
premiums 12,312.

| Step | Working | Amount |
|---|---|---|
| **employer_tax** | 7.65% x 60,282 (under the 184,500 base) | **4,611.57** (4,611.573) |
| **employee_tax** | the same 7.65%: other job + salary = 74,231, under the base; Medicare wages under 200,000 | **4,611.57** |
| **passed** | 77,923 - 60,282 - 4,611.573 - 2,843 - 12,312 | **-2,125.57** |
| **sehi** | smaller of 12,312 and 60,282 | **12,312.00** |
| QBI line 1(c) | -2,125.573 - 12,312 = -14,437.573; under 1,000, so no 2026 minimum | **qbi 0.00** |
| AGI | wages 13,949 + 60,282 + 12,312 = 86,543; + 585 - 2,125.573 - 12,312 | 72,690.427 |
| Taxable income | 72,690.427 - 24,150 | 48,540.427 |
| Regular tax | line 5 = 47,955.427: 1,770 + 12% x 30,255.427 = 5,400.65; the 585 is under the 66,200 0% top | 5,400.65124 |
| Credit | 2 x 2,200, all used | -4,400.00 |
| **tax_with** | | **1,000.65** |
| Without | AGI 13,949 + 585 = 14,534, taxable 0; ACTC = smaller of 4,400, 3,400, 15% x (13,949 - 2,500) = 1,717.35 | |
| **tax_without** | | **-1,717.35** |

## S corporation row 3: `scorp-2026-head_of_household-062`

Head of household, 2026. There is no salary, so the premiums count as wages but give no health
deduction. The $400 minimum applies.

Inputs: other job 4,626; no dividends; 2 children; profit 22,079; salary 0; costs 716; premiums 4,807.

| Step | Working | Amount |
|---|---|---|
| **employer_tax**, **employee_tax** | no salary | **0.00**, **0.00** |
| **passed** | 22,079 - 0 - 0 - 716 - 4,807 | **16,556.00** |
| **sehi** | Form 7206 line 11: box 5 wages from the corporation = 0 | **0.00** |
| AGI | wages 4,626 + 4,807 (premiums in box 1) + 16,556 | 25,989.00 |
| Form 8995 | line 1(c) 16,556; line 10 = 3,311.20; line 11 = 25,989 - 24,150 = 1,839; line 14 = 367.80; line 15 = 367.80; line 16 = 400 | **qbi 400.00** |
| Taxable income | 1,839 - 400 | 1,439.00 |
| Regular tax | 10% | 143.90 |
| Credit | 4,400; line 14 = 143.90 | -143.90 |
| ACTC | line 16a = 4,256.10; 16b = 3,400; earned income = box 1 wages 9,433 (no K-1); 15% x 6,933 = 1,039.95 | -1,039.95 |
| **tax_with** | | **-1,039.95** |
| **tax_without** | earned 4,626: 15% x 2,126 | **-318.90** |

## Plans row 1: `plans-2026-053`

2026, age 61. Wages over the base mean only the 2.9% applies. Part of 402(g) is used at the job,
and the age 60-63 catch-ups apply.

Inputs: wages 232,345 (over 184,500); job deferrals 6,482; profit 261,632.

| Step | Working | Amount |
|---|---|---|
| Schedule SE | line 6 = 261,632 x 92.35% = 241,617.152; line 9 = 0; 2.9% only = 7,006.8974 | |
| **se_half** | | **3,503.45** (3,503.448704) |
| **earned** (step 3) | 261,632 - 3,503.448704 | **258,128.55** |
| **sep_max** | step 5 = 20% = 51,625.71; step 6 = 360,000 x 25% = 90,000; step 8 = 72,000 | **51,625.71** |
| Solo step 9 | 24,500 - 6,482 = 18,018 (under earned) | 18,018.00 |
| step 10, 12 | 72,000 - 18,018 = 53,982; (258,128.55 - 18,018) / 2 = 120,055.28 | |
| step 13 | smallest of 51,625.71, 53,982, 120,055.28 | 51,625.71 |
| step 15 | smaller of 18,018 and 258,128.55 - 51,625.71 | 18,018.00 |
| step 18 | catch-up at 61: 11,250 (room 188,484.84) | 11,250.00 |
| **solo_max** | 51,625.71 + 18,018 + 11,250 | **80,893.71** |
| **simple_comp** | Schedule SE line 4 | **241,617.15** |
| SIMPLE regular | smallest of 18,100, the 402(g) room 18,018, compensation | 18,018.00 |
| Catch-up | age 61: 5,250 | 5,250.00 |
| Match | smaller of 23,268 and 3% x 241,617.152 = 7,248.51 | 7,248.51 |
| **simple_max** | | **30,516.51** |

## Plans row 2: `plans-2025-361`

2025, age 64. Back to the regular catch-up. The job used almost all of 402(g), so the SIMPLE match
is capped by the small deferral.

Inputs: wages 188,301 (over 176,100); job deferrals 22,917; profit 447,298.

| Step | Working | Amount |
|---|---|---|
| **se_half** | 2.9% x 413,079.703 / 2 | **5,989.66** |
| **earned** | 447,298 - 5,989.6556935 | **441,308.34** |
| **sep_max** | step 5 = 88,261.67; step 6 = 87,500; step 7 = 87,500; step 8 = 70,000 | **70,000.00** |
| Solo step 9 | 23,500 - 22,917 | 583.00 |
| step 13 | smallest of 87,500, 70,000 - 583 = 69,417, (441,308.34 - 583) / 2 | 69,417.00 |
| step 18 | catch-up at 64: 7,500 (not 60-63) | 7,500.00 |
| **solo_max** | 69,417 + 583 + 7,500 (the 415(c) cap plus the catch-up) | **77,500.00** |
| **simple_comp** | 447,298 x 92.35% | **413,079.70** |
| SIMPLE regular | smallest of 17,600, the room 583, compensation | 583.00 |
| Catch-up | 3,850 (higher-limit plan, age 64) | 3,850.00 |
| Match | smaller of 4,433 and 3% x 413,079.70 = 12,392.39 | 4,433.00 |
| **simple_max** | | **8,866.00** |

## Plans row 3: `plans-2025-363`

2025, age 29. A small profit, so the solo 401(k) is held by 100% of compensation (step 12).

Inputs: wages 8,739; job deferrals 4,338; profit 24,627.

| Step | Working | Amount |
|---|---|---|
| Schedule SE | line 6 = 24,627 x 92.35% = 22,743.0345; line 9 = 167,361; 15.3% = 3,479.6843 | |
| **se_half** | | **1,739.84** |
| **earned** | 24,627 - 1,739.8421393 | **22,887.16** |
| **sep_max** | 20% x 22,887.1578608 | **4,577.43** |
| Solo step 9 | 23,500 - 4,338 = 19,162 (under earned) | 19,162.00 |
| step 12 | (22,887.1578608 - 19,162) / 2 | 1,862.5789 |
| step 13 | smallest of 4,577.43, 70,000 - 19,162, 1,862.58 | 1,862.58 |
| step 15 | smaller of 19,162 and 22,887.16 - 1,862.58 = 21,024.58 | 19,162.00 |
| **solo_max** | no catch-up under 50 | **21,024.58** |
| **simple_comp** | | **22,743.03** |
| SIMPLE | regular = smallest of 17,600, the room 19,162, 22,743.03 = 17,600; no catch-up; match 3% x 22,743.0345 = 682.29 | |
| **simple_max** | 17,600 + 682.29 | **18,282.29** |
