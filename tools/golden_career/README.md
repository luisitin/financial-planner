# Career answer keys: AMT room and ESPP sales

Two independent answer keys for the career pages that deal with stock pay:

| Script | Writes | Rows | What it checks |
|---|---|---|---|
| `amt_key.py` | `tests/golden/career/amt.csv` | 2,000 | regular tax, Form 6251 alternative minimum tax, and the "AMT room" for incentive stock options |
| `espp_key.py` | `tests/golden/career/espp.csv` | 1,000 | employee stock purchase plan sales: qualifying or not, wages (ordinary income), short and long gain |

`rules.py` holds every tax figure as data, with its source on the same line.
`tests/golden/career/RULES.md` works three AMT rows and three ESPP rows by hand.

**Independence.** These scripts were written from the IRS sources below only. Nobody opened
`modules/career/`, `core/math/tax.js` or `modules/taxes/` while writing them, and they never import
or run the app. Each script computes every row in two separate ways (the forms line by line, and
the statute written differently) and refuses to write the CSV if the two ways disagree by even a
cent.

## Run

```
python3 tools/golden_career/amt_key.py
python3 tools/golden_career/espp_key.py
```

Python 3 standard library only (made with 3.13). Money is `decimal.Decimal`, exact until the CSV,
where it is rounded half-up to cents. The runs are deterministic (`random.Random(20261030)` for
the AMT key, `random.Random(20261031)` for the ESPP key), so running again writes byte-identical
files. The scripts set `sys.dont_write_bytecode`, so no `__pycache__` lands in the repo.

## Sources (all read on 2026-10-30)

| Tag | Source | URL |
|---|---|---|
| RP24 | Rev. Proc. 2024-40, tax year 2025 | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf |
| RP25 | Rev. Proc. 2025-32, tax year 2026 | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf |
| OBBBA | Pub. L. 119-21 (July 2025): s.70102 standard deduction, s.70107 AMT, s.70111 IRC 68, s.70120 SALT cap. RP25 s.2.07 and s.2.08 restate s.70107 and s.70102 | (see RP25) |
| F6251 | Form 6251 (2025) | https://www.irs.gov/pub/irs-pdf/f6251.pdf |
| I6251 | Instructions for Form 6251 (2025) | https://www.irs.gov/pub/irs-pdf/i6251.pdf |
| D6251 | Form 6251 (2026), early draft of 2026-05-26 | https://www.irs.gov/pub/irs-dft/f6251--dft.pdf |
| I1040 | Form 1040 instructions (2025), Qualified Dividends and Capital Gain Tax Worksheet, line 16 | https://www.irs.gov/pub/irs-pdf/i1040gi.pdf |
| IRC55, IRC56, IRC423 | 26 U.S.C. 55, 56, 423 (current text, with the 2025 amendment notes) | https://www.law.cornell.edu/uscode/text/26/55 , .../56 , .../423 |
| P525 | Publication 525 (2025), "Statutory Stock Options" | https://www.irs.gov/publications/p525 |
| P544 | Publication 544 (2025), "Long and Short Term", Tables 4-1 and 4-2 | https://www.irs.gov/publications/p544 |

## AMT key (`amt_key.py`)

### Figures

| | 2025 | 2026 |
|---|---|---|
| Ordinary brackets | RP24 s.2.01 (not changed by OBBBA) | RP25 s.4.01 |
| Standard deduction | 15,750 single and separate / 31,500 joint / 23,625 head of household (OBBBA s.70102, restated in RP25 s.2.08) | 16,100 / 32,200 / 24,150 (RP25 s.4.14) |
| 0% and 15% tops for qualified dividends | RP24 s.2.03 | RP25 s.4.03 |
| AMT exemption | 88,100 single and HoH / 137,000 joint / 68,500 separate (RP24 s.2.11) | 90,100 / 140,200 / 70,100 (RP25 s.4.10) |
| Phase-out start | 626,350 / 1,252,700 / 626,350 (RP24 s.2.11) | 500,000 / 1,000,000 / 500,000 (RP25 s.4.10) |
| Phase-out rate | 25 cents per dollar (IRC55(d)(2)) | 50 cents per dollar (OBBBA s.70107(c), IRC55(d)(4)(A)(ii)(IV); RP25's complete phase-out 1,280,400 = 1,000,000 + 2 x 140,200) |
| 28% applies above | 239,100 (119,550 separate), minus 4,782 (2,391) (RP24 s.2.11, F6251 line 7) | 244,500 (122,250 separate), minus 4,890 (2,445) (RP25 s.4.10, D6251 line 7) |
| Separate-return line 4 addition | over 900,350 add 25% of the excess, at most 68,500 (I6251 "Line 4") | not published yet (see "Open points") |

Note: the task brief cited "Rev. Proc. 2024-40 s.2.11" for the 2025 AMT figures. In the
published Rev. Proc. that section is numbered 3.11.

`rules.py` cross-checks itself when it loads. The bracket tops must reproduce the "tax is $X plus
N%" amounts printed in each Rev. Proc. table. Start + exemption / rate must equal the printed
complete phase-out. The 28% subtraction must equal 2% of the breakpoint.

### How each row is worked (derivation 1, the forms)

1. AGI (Form 1040 line 11b) = wages + qualified dividends. All dividends are qualified
   (1099-DIV box 1a = box 1b).
2. Deduction (line 12e = line 14): the standard deduction, or the itemized total (state and local
   taxes + other itemized) when that is larger. A tie takes the standard deduction. In the CSV
   both itemized columns are 0 when the standard deduction is taken. Every itemizing row
   beats the standard deduction by at least $1.
3. Taxable income (line 15) = max(0, AGI - deduction).
4. Regular tax (line 16): the Tax Computation formula on the exact amount. When dividends are
   above 0, the Qualified Dividends and Capital Gain Tax Worksheet, lines 1-25 (I1040). **No Tax
   Table rounding, even under 100,000**, the same as `tests/golden/taxes/`. The IRS Tax Table
   would move the tax by up to a few dollars on rows under 100,000.
5. Form 6251 line 1b = AGI - line 14 (it can be negative; F6251 "if less than zero, enter as a
   negative amount"). Line 2a = the itemized state and local taxes (Schedule A line 7), or the
   standard deduction. Line 2i = the ISO spread at exercise. Line 4 = 1b + 2a + 2i.
   On 2025 separate returns over 900,350, add 25% of the excess, at most 68,500.
6. Line 5 exemption = max(0, exemption - rate x max(0, line 4 - phase-out start)) (I6251 Exemption
   Worksheet). Line 6 = max(0, line 4 - line 5).
7. Line 7 = line 9 (tentative minimum tax). If line 6 is 0, it is 0. With qualified dividends,
   Part III lines 12-40, with line 13 = worksheet line 4 and lines 20 and 27 = worksheet line 5
   (as figured for the regular tax). Line 14 (section 1250 gain) is 0. Otherwise, 26% of line 6,
   or 28% minus the printed subtraction.
8. AMT (line 11) = max(0, tentative minimum tax - regular tax). Line 10 = line 16 (no credits,
   no Form 4972, no Schedule 2 line 1z).

### Derivation 2 (the statute), checked on every row

- The regular tax from the Rev. Proc. "base plus rate" tables with IRC 1(h) stacking. The
  dividend layers are 0%, 15% and 20% on top of ordinary income, and the result is the smaller
  of that and the tax on all income.
- AMTI built as AMT income minus AMT deductions, not as an add-back. Under IRC 56(b)(1) there is
  no standard deduction, no state and local taxes and no IRC 68. Other itemized deductions (home
  mortgage interest) stay, and the ISO spread is income (IRC 56(b)(3)). The separate-return
  addition is computed from the statute's wording: the lesser of the rate x the excess over the
  zero-exemption point, or the exemption.
- The tentative minimum tax by IRC 55(b)(3)(A)-(D). The 0% and 15% amounts use the regular-tax
  excesses of IRC 1(h)(1)(B) and (C), and the result is capped at 26/28% of the whole taxable
  excess. 26/28% is written as 26% x min(x, breakpoint) + 28% x the rest.

All 2,000 rows agree to the cent on taxable income, regular tax, AMTI, exemption, tentative
minimum tax and AMT.

### The AMT room

`room` = the largest whole-dollar ISO spread whose AMT equals the AMT with no spread. It is found by
doubling, then bisecting on the derivation-1 function. Derivation 2 confirms that
AMT(room) = AMT(0) and AMT(room + 1) > AMT(0). In every row the AMT with no spread is 0, so the
room is the largest spread that still leaves the AMT at 0. Because of that, `iso_spread = room`
rows show 0 AMT, and `room + 1` rows show a few cents.

### The generator

- 250 rows for each year (2025, 2026) and status (single, married_joint, married_separate,
  head_of_household). Case ids are `amt-<year>-<status>-<nnn>`. All inputs are whole dollars.
- Wages: 4% at 0, 3% at 900,000, 43% uniform from 0 to 900,000, and 50% log-uniform from 5,000 to
  900,000.
- Qualified dividends: 0 in half the rows. In the other half, 8% are at 120,000 and the rest are
  log-uniform from 50 to 120,000.
- Itemizing in 40% of rows. State and local taxes run from 0 to 10,000 (0 to 5,000 for separate
  returns), with 30% at that top. Other itemized deductions (read them as home mortgage interest on
  acquisition debt, deductible for both taxes) are at least the amount that makes the total beat the
  standard deduction by $1 (10% of itemizers sit exactly there), and up to 40,000 more.
- ISO spread: 15% are 0. 10% equal the room and 10% are the room + 1. 5% put AMTI exactly at the
  phase-out start, and 5% exactly at the complete phase-out (when that needs a spread from 0 to
  600,000). The rest are uniform or log-uniform up to 600,000.
- Coverage in the CSV:
  - 1,015 rows owe AMT, and 1,002 go through Part III.
  - 760 itemize.
  - 289 have a partly phased-out exemption, and 243 have none left.
  - 1,170 have line 6 above the 28% breakpoint.
  - 340 have a negative line 1b.
  - 26 are 2025 separate returns with the line 4 addition.

### What the AMT key leaves out (on purpose)

- Credits of any kind, including the AMT foreign tax credit and the prior-year minimum tax credit.
- Every AMT item other than the ISO spread (lines 2b-2h, 2j-3) and every disposition of ISO
  shares. The spread is assumed to stay in AMT income: no same-year disqualifying sale.
- Social Security, interest, non-qualified dividends and capital gains other than qualified
  dividends. Schedule D and section 1250 gain.
- Net investment income tax, additional Medicare tax and self-employment tax.
- Age 65+ or blindness (no extra standard deduction, no senior deduction) and Schedule 1-A
  deductions. All filers are under 65 and not blind.
- The state and local tax cap never binds, because taxes are drawn at or under the cap's floor
  (10,000; 5,000 separate) for any income. The 2026 IRC 68 limitation never applies, because a
  2026 row may itemize only if its AGI is at or under the 37% bracket start.
- The Tax Table (exact formula used instead), and the election to itemize when itemizing is
  smaller (IRC 63(e)).
- Qualifying surviving spouse (same figures as joint), estates and trusts.

### Open points (the reason for two generator limits)

1. **2026 separate returns over 640,200 of AMTI.** The 2026 draft Form 6251 line 4 says "If
   married filing separately and line 4 is more than $640,200, see instructions". The 2026
   instructions are not out yet. Read literally, IRC 55(d)(4)(A)(ii)(IV) changes every
   "25 percent" in 55(d)(2) to "50 percent", which would make the addition 50% of the excess, at
   most 70,100. No IRS text confirms that, so the key keeps every 2026 separate-return row
   (its AMTI at the given spread and at the room) at or under 640,200. Rows that would go over
   are redrawn, and the code raises if it ever needs the rule. As a result, 2026 separate-return
   wages top out near 576,000. When the IRS publishes the 2026 Form 6251 instructions, put the
   rate in `rules.AMT_MFS_EXTRA[2026]`. The rejection in `build_row` can then go.
2. **IRC 68 and the AMT in 2026.** IRC 56(b)(1)(E) says "Section 68 shall not apply" for the AMT,
   but the 2026 draft Form 6251 has no line for adding the reduction back. The key keeps 2026
   itemizers under the 37% bracket start, so the limitation is 0. `deduction_line` asserts that.

## ESPP key (`espp_key.py`)

### Rules and sources

- Grant date = offering date. Price paid = 85% of the lower of the offering-day and purchase-day
  prices (a 15% discount with a look-back; the IRC 423(b)(6) floor).
- **Qualifying** if the sale is more than 2 years after the offering date and more than 1 year
  after the purchase. IRC 423(a)(1): no disposition "within 2 years after the date of the granting
  of the option nor within 1 year after the transfer". P525 "Holding period requirement": "don't
  sell the stock until the end of the later of" those periods, and "Your holding period ...
  begins on the day after you exercise the option". P544 Table 4-2 starts the holding period on
  the day after the purchase. So a sale on either anniversary does not qualify, and the day after
  does.
- Qualifying: wages (ordinary income) per share = the smaller of (sale price - price paid) and
  (offering-day price - the option price figured as if bought on the offering day = 15% of the
  offering-day price), never below 0. The rest is a long-term gain or loss. Sources: IRC 423(c)
  ("lesser of" and "as if the option were exercised at such time"); P525 "Option granted at a
  discount" and Example 10; P525 "If you have a loss from the sale, it's a capital loss, and you
  don't have any ordinary income".
- Disqualifying: wages per share = purchase-day price - price paid, "not limited to your gain from
  the sale" (P525 "Holding period requirement not satisfied", Example 11; IRC 421(b)). Basis =
  purchase-day price. The rest is long-term only if the sale is more than 1 year after the
  purchase (P544 Table 4-1), otherwise short-term.
- The two derivations: (1) the rules above, with `date` comparisons against the anniversaries;
  (2) a basis method (proceeds - basis, where basis = cost + wages), with the holding period
  counted from the day after the purchase as (year, month, day) tuples. Both agree on all 1,000
  rows. Wages + short + long always equals (sale price - price paid) x shares.

### The generator

- Offering dates fall in 2018-2025, always on day 1-28 of the month, so no anniversary lands on a
  29th-31st or on 29 February. The purchase comes 3 to 27 whole months later on the same day. The
  sale comes 0 to 40 months after the purchase.
- Sale-date kinds, on purpose:
  - 46 on the purchase day
  - 94 on the purchase anniversary, and 81 the day after it
  - 35 the day before the purchase anniversary
  - 79 on the 2-year offering mark, and 79 the day after it
  - 23 the day before the 2-year offering mark
  - 563 random
- Prices are whole multiples of 20 cents, from 2.00 to 600.00, so 85% and 15% of them are whole
  cents and no plan rounding rule matters. The purchase price runs from 0.4 to 2.5 times the
  offering price (5% of rows have the same price on both days).
- Sale prices: 5% exactly at the price paid, 5% exactly at price paid + 15% of the offering price
  (the cap), 5% at the purchase-day price, 10% between the price paid and the purchase-day price,
  and the rest from 0.3 to 3 times the purchase-day price.
- Shares are whole numbers from 1 to 1,500. Every amount is a whole number of cents, so the key
  involves no rounding at all.
- Outcome:
  - 476 qualifying
  - 436 disqualifying short-term
  - 88 disqualifying long-term
  - 235 capital losses
  - 85 sales below the price paid

### What the ESPP key leaves out

- Fractional shares and plan-specific price rounding.
- Wash sales, gifts and transfers, and sales because of death (IRC 423(c) also covers death; not
  generated). Plans with no discount or no look-back. Options granted at more than a 15% discount.
- Form 3922 reporting and the W-2 versus Form 8949 basis adjustment. The key gives the true
  figures, not what a broker's 1099-B might show.
- The tax on the results: rates, the net investment income tax, and state tax.

## CSV columns

`amt.csv`: `case_id, year, filing_status, wages, qualified_dividends, itemized_salt, itemized_other,
iso_spread, taxable_income, regular_tax, amti, exemption, tentative_min_tax, amt, room`. All money
has two decimals. `amti` is Form 6251 line 4, including the 2025 separate-return addition.
`exemption` is line 5. `tentative_min_tax` is line 9. `regular_tax` is Form 1040 line 16.

`espp.csv`: `case_id, offering_date, purchase_date, sale_date, shares, fmv_offering, fmv_purchase,
price_paid, sale_price, qualifying, ordinary_income, short_gain, long_gain`. Dates are ISO. Prices
are per share. `qualifying` is `true` or `false`. The three result columns are totals for the
lot, and losses are negative.
