# Career answer keys: rules sheet and hand-worked rows

`amt.csv` (2,000 rows) and `espp.csv` (1,000 rows) come from `tools/golden_career/amt_key.py` and
`espp_key.py`. Those scripts were written from IRS sources without opening the app's code.
`tools/golden_career/README.md` lists every rule with its source, what the keys leave out, and the
two open points. `tools/golden_career/rules.py` holds the figures.

This sheet works six rows by hand, line by line, so a reader can check the method without
running anything. Each figure below matches the CSV to the cent.

Conventions:
- Tax is the exact Tax Computation formula, with no Tax Table rounding.
- Dividends are all qualified.
- Itemized "other" deductions are home mortgage interest, deductible for both the regular tax and
  the AMT.
- The room is the largest whole-dollar ISO spread that keeps the AMT where it is with no spread
  (0 in every row of this key).

## AMT row 1: `amt-2025-married_joint-052` (itemizes, no dividends, the 26% band)

Inputs: wages 65,930; dividends 0; state and local taxes 8,746; mortgage interest 22,755; ISO
spread 313,860.

| Step | Working | Amount |
|---|---|---|
| AGI | 65,930 | 65,930.00 |
| Deduction | itemized 8,746 + 22,755 = 31,501 > standard 31,500, so itemize | 31,501.00 |
| Taxable income | 65,930 - 31,501 | **34,429.00** |
| Regular tax | 10% x 23,850 = 2,385; 12% x (34,429 - 23,850) = 1,269.48 | **3,654.48** |
| 6251 line 1b | 65,930 - 31,501 | 34,429.00 |
| line 2a | taxes from Schedule A | 8,746.00 |
| line 2i | ISO spread | 313,860.00 |
| line 4 AMTI | 34,429 + 8,746 + 313,860 | **357,035.00** |
| line 5 | under the 1,252,700 start, so the full exemption | **137,000.00** |
| line 6 | 357,035 - 137,000 | 220,035.00 |
| line 7 = 9 | 220,035 is at most 239,100, so 26% | **57,209.10** |
| line 11 AMT | 57,209.10 - 3,654.48 | **53,554.62** |

Room: with no spread, AMTI = 43,175 and line 6 = max(0, 43,175 + s - 137,000) = s - 93,825. The
AMT stays 0 while 26% x (s - 93,825) <= 3,654.48, i.e. s <= 107,880.69. **Room 107,880.00**.

## AMT row 2: `amt-2026-single-077` (dividends through Part III, 2026 phase-out at 50 cents)

Inputs: wages 203,920; qualified dividends 89,234; state and local taxes 1,496; mortgage interest
25,898; ISO spread 306,382.

Regular tax:

| Step | Working | Amount |
|---|---|---|
| AGI | 203,920 + 89,234 | 293,154.00 |
| Deduction | 1,496 + 25,898 = 27,394 > 16,100. AGI is under the 640,600 start of the 37% bracket, so IRC 68 takes nothing | 27,394.00 |
| Taxable income | 293,154 - 27,394 | **265,760.00** |
| Worksheet lines 1, 2, 4 | 265,760; 89,234; 89,234 | |
| line 5 | 265,760 - 89,234 | 176,526.00 |
| lines 6-9 | line 6 = 49,450; line 7 = 49,450; line 8 = min(176,526, 49,450) = 49,450; line 9 = 0 at 0% | 0.00 |
| lines 10-17 | line 10 = 89,234; line 14 = 265,760; line 15 = 176,526; line 16 = 89,234; line 17 = 89,234 | |
| line 18 | 15% x 89,234 | 13,385.10 |
| line 20, 21 | 89,234 - 89,234 = 0 at 20% | 0.00 |
| line 22 | tax on 176,526 = 17,966 + 24% x 70,826 | 34,964.24 |
| line 23 | 13,385.10 + 0 + 34,964.24 | 48,349.34 |
| line 24 | tax on 265,760 = 58,448 + 35% x 9,535 | 61,785.25 |
| line 25 = regular tax | smaller of 48,349.34 and 61,785.25 | **48,349.34** |

Form 6251:

| Step | Working | Amount |
|---|---|---|
| line 4 AMTI | 265,760 + 1,496 + 306,382 | **573,638.00** |
| line 5 | 90,100 - 50% x (573,638 - 500,000) = 90,100 - 36,819 | **53,281.00** |
| line 6 = line 12 | 573,638 - 53,281 | 520,357.00 |
| lines 13, 15, 16 | 89,234 (worksheet line 4); 89,234; min(520,357, 89,234) = 89,234 | |
| line 17 | 520,357 - 89,234 | 431,123.00 |
| line 18 | over 244,500: 28% x 431,123 - 4,890 | 115,824.44 |
| lines 19-21 | line 19 = 49,450; line 20 = 176,526; line 21 = 0 | |
| lines 22-24 | line 22 = 89,234; line 23 = 0 at 0%; line 24 = 89,234 | |
| lines 25-29 | line 25 = 545,500; line 26 = 0; line 27 = 176,526; line 28 = 176,526; line 29 = 368,974 | |
| line 30, 31 | min(89,234, 368,974) = 89,234; x 15% | 13,385.10 |
| line 32 | 0 + 89,234 is not equal to line 12, so line 33 = 89,234 - 89,234 = 0, and line 34 = 0 | 0.00 |
| line 38 | 115,824.44 + 13,385.10 + 0 | 129,209.54 |
| line 39 | 28% x 520,357 - 4,890 | 140,809.96 |
| line 40 = 7 = 9 | smaller of the two | **129,209.54** |
| line 11 AMT | 129,209.54 - 48,349.34 | **80,860.20** |

Room: with no spread, AMTI = 267,256. While AMTI stays at or under 500,000 the exemption is the
full 90,100, so line 17 = 267,256 + s - 90,100 - 89,234 = 87,922 + s. The tentative tax is
13,385.10 + 26% x (87,922 + s). That stays at or under 48,349.34 while s <= 46,555.85 (AMTI
313,811, inside the full-exemption zone). **Room 46,555.00**.

## AMT row 3: `amt-2025-married_separate-219` (separate return over 900,350: the line 4 addition)

Inputs: wages 489,043; no dividends; standard deduction; ISO spread 412,110.

| Step | Working | Amount |
|---|---|---|
| Taxable income | 489,043 - 15,750 | **473,293.00** |
| Regular tax | 101,077.25 + 37% x (473,293 - 375,800) = 101,077.25 + 36,072.41 | **137,149.66** |
| line 1b + 2a + 2i | 473,293 + 15,750 + 412,110 | 901,153.00 |
| line 4 addition | over 900,350 by 803: add 25% x 803 = 200.75 (at most 68,500) | 200.75 |
| line 4 AMTI | 901,153 + 200.75 | **901,353.75** |
| line 5 | 68,500 - 25% x (901,353.75 - 626,350) is below 0, so 0 | **0.00** |
| line 6 | | 901,353.75 |
| line 7 = 9 | 28% x 901,353.75 - 2,391 | **249,988.05** |
| line 11 AMT | 249,988.05 - 137,149.66 | **112,838.39** |

Room: with no spread, AMTI = 489,043, under the 626,350 start, so line 6 = 489,043 + s - 68,500.
The AMT stays 0 while 28% x (420,543 + s) - 2,391 <= 137,149.66, i.e. 420,543 + s <= 498,359.50,
s <= 77,816.50. That is AMTI 566,859, still under the phase-out. **Room 77,816.00**.

## ESPP row 1: `espp-0053` (qualifying: sold the day after the 2-year mark; the 15% cap binds)

Offering 2024-04-08 at 22.00; purchase 2025-01-08 at 22.40; sale 2026-04-09 at 45.70; 583 shares.

- Price paid = 85% x min(22.00, 22.40) = 85% x 22.00 = **18.70**.
- 2 years after the offering = 2026-04-08. The sale is the day after, so it is more than 2 years.
  1 year after the purchase = 2026-01-08, which is also passed. **Qualifying**.
- Gain per share = 45.70 - 18.70 = 27.00. The cap is 15% x 22.00 = 3.30, so wages per share =
  min(27.00, 3.30) = 3.30.
- Ordinary income = 3.30 x 583 = **1,923.90**. Long gain = (27.00 - 3.30) x 583 = 23.70 x 583 =
  **13,817.10**. Short gain **0.00**.

## ESPP row 2: `espp-0004` (sold ON the 2-year mark: disqualifying, long-term loss)

Offering 2020-01-14 at 184.00; purchase 2020-06-14 at 426.80; sale 2022-01-14 at 353.09; 246 shares.

- Price paid = 85% x min(184.00, 426.80) = **156.40**.
- 2 years after the offering = 2022-01-14, the sale date itself. That is not *more* than 2 years,
  so the sale is **not qualifying**. It is more than 1 year after the purchase (2021-06-14), so the
  rest is long-term.
- Wages = (426.80 - 156.40) x 246 = 270.40 x 246 = **66,518.40**. This is owed even though the
  shares sold below their purchase-day value.
- Basis = 426.80 per share. Long gain = (353.09 - 426.80) x 246 = -73.71 x 246 = **-18,132.66**.
  Short gain **0.00**.
- Check: 66,518.40 - 18,132.66 = 48,385.74 = (353.09 - 156.40) x 246.

## ESPP row 3: `espp-0033` (sold ON the purchase anniversary: disqualifying, short-term)

Offering 2022-03-07 at 84.60; purchase 2023-12-07 at 125.00; sale 2024-12-07 at 336.66; 1,433 shares.

- Price paid = 85% x min(84.60, 125.00) = 85% x 84.60 = **71.91**.
- 2 years after the offering = 2024-03-07, which is passed. But 1 year after the purchase =
  2024-12-07, the sale date itself. Because the holding period starts the day after the purchase,
  this sale is held exactly 1 year, not more. So it is **not qualifying** and **short-term**.
- Wages = (125.00 - 71.91) x 1,433 = 53.09 x 1,433 = **76,077.97**.
- Short gain = (336.66 - 125.00) x 1,433 = 211.66 x 1,433 = **303,308.78**. Long gain **0.00**.
- Had it been sold one day later (2024-12-08), it would qualify. Wages would then be capped at
  15% x 84.60 = 12.69 per share (18,184.77), and the rest would be a long gain.
