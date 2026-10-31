# Tax lots and harvesting: rules sheet for the answer key

This sheet is the spec of an independent answer key for the "Tax lots and harvesting" page, tax years 2025 and 2026.
`tools/golden_tax_lots/rules.py` holds every figure as data, with its source and the date it was read on the same line,
plus each rule as a small pure function. This sheet gives each rule in plain words with the source text it rests on, the
conventions the key adopts, and four examples worked by hand (section 10), which `rules.py` asserts when imported.

**Independence.** Written from the law, the regulations, two revenue rulings, the IRS forms, instructions and Publication
550, and the revenue procedures. Nobody opened `modules/`, `core/` or `tests/*.test.mjs` while writing it, and the key never
imports or runs the app. Only the layout and conventions of `tools/golden_estimated/` and `tools/golden_estate/` were looked
at. The federal figures were read in the revenue procedures and agree with `tests/golden/taxes/RULES.md` (FEDKEY), which is
cited for comparison only. The page's README documents the model (the brief's rules 1 to 6). Where the law says otherwise
the key's main column follows the law, and a contrast column keeps the page's way.

Every source was read on **2026-10-31**. A source with a "sha" was saved and hashed (first 8 ... last 10 hex digits of
sha256); the full list is in the `rules.py` docstring.

## 1. Sources

| Id | Document | URL | Sha |
|---|---|---|---|
| USC1 | 26 U.S.C. 1(h)(1), (h)(3), (h)(11)(A), (j)(5) (OLRC, "current through Public Law 119-136 (October 22, 2026)") | https://uscode.house.gov/us/usc/119-136/t26/s1/ | acce504c...3ce7938060 |
| USC1091 | 26 U.S.C. 1091(a)-(d), wash sales | https://uscode.house.gov/us/usc/119-136/t26/s1091/ | 2f7fcffd...46759c2c9b |
| USC1211 | 26 U.S.C. 1211(b), limit on capital losses | https://uscode.house.gov/us/usc/119-136/t26/s1211/ | 0ef67741...bf8b64dde3 |
| USC1212 | 26 U.S.C. 1212(b), carryover | https://uscode.house.gov/us/usc/119-136/t26/s1212/ | 4b368fc6...48a0bd2dd0 |
| USC1222 | 26 U.S.C. 1222(1)-(11), short and long term | https://uscode.house.gov/us/usc/119-136/t26/s1222/ | 608100ea...b0cae9749a |
| USC1223 | 26 U.S.C. 1223(3), wash-sale holding period | https://uscode.house.gov/us/usc/119-136/t26/s1223/ | 581916b4...9d82c87260 |
| USC1411 | 26 U.S.C. 1411(a)(1), (b), (c)(1), net investment income tax | https://uscode.house.gov/us/usc/119-136/t26/s1411/ | 89721b18...741beafb33 |
| CFR10911 | 26 CFR 1.1091-1 (eCFR "up to date as of 2026-10-29") | https://www.ecfr.gov/current/title-26/section-1.1091-1 | e7afa023...6824a10a78 |
| CFR10912 | 26 CFR 1.1091-2, basis of the new shares | https://www.ecfr.gov/current/title-26/section-1.1091-2 | a9f2d596...38b7ec34a8 |
| CFR12231 | 26 CFR 1.1223-1(d) | https://www.ecfr.gov/current/title-26/section-1.1223-1 | eb546264...8e5a87cb03 |
| CFR14114 | 26 CFR 1.1411-4(d), net gain | https://www.ecfr.gov/current/title-26/section-1.1411-4 | 76523685...59598039aa |
| CFR10121 | 26 CFR 1.1012-1(c), identifying the lot sold | https://www.ecfr.gov/current/title-26/section-1.1012-1 | 909e34e1...90cd81ba98 |
| CFR60451 | 26 CFR 1.6045-1(d)(6)(iii), broker wash-sale reporting (for one note only) | https://www.ecfr.gov/current/title-26/section-1.6045-1 | aac2a2a4...bc6e44a73c |
| RR0805 | Rev. Rul. 2008-5, 2008-3 I.R.B. 271 | https://www.irs.gov/pub/irs-irbs/irb08-03.pdf | 623a6c1d...c2b28056c9 |
| RR6607 | Rev. Rul. 66-7, 1966-1 C.B. 188 (**secondary copy**; no irs.gov copy found) | https://timbertax.org/research/revenuerulings/capitalgain/66-7/ | 267a722e...324f4cfe87 |
| P550 | Publication 550 (2025), "For use in preparing 2025 Returns" | https://www.irs.gov/pub/irs-pdf/p550.pdf | 83552968...92c5574317 |
| ISD | Instructions for Schedule D (Form 1040) (2025) | https://www.irs.gov/pub/irs-pdf/i1040sd.pdf | 650643a6...f7b2276002 |
| FSD | Schedule D (Form 1040) (2025) | https://www.irs.gov/pub/irs-pdf/f1040sd.pdf | 90564c8b...c844da1d2e |
| I8960 | Instructions for Form 8960 (2025) | https://www.irs.gov/pub/irs-pdf/i8960.pdf | b10fbb23...7867376428 |
| F8960 | Form 8960 (2025) | https://www.irs.gov/pub/irs-pdf/f8960.pdf | 9b323b71...c3b3789731 |
| I8949 | Instructions for Form 8949 (2025), code W | https://www.irs.gov/pub/irs-pdf/i8949.pdf | f077991c...05d6e7ab45 |
| I1040 | Instructions for Form 1040 (2025), Qualified Dividends and Capital Gain Tax Worksheet | https://www.irs.gov/pub/irs-pdf/i1040gi.pdf | 482e9c48...590468364a |
| RP2440 | Rev. Proc. 2024-40 (tax year 2025) | https://www.irs.gov/pub/irs-drop/rp-24-40.pdf | 4de9db6b...d4c302af1f |
| RP2532 | Rev. Proc. 2025-32 (tax year 2026; s.3.01 amends 2025) | https://www.irs.gov/pub/irs-drop/rp-25-32.pdf | e9ada115...a96214635b |
| PL11921 | Pub. L. 119-21 (July 4, 2025), s.70101, s.70102 | https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm | 84000b07...c584e9004d |
| FEDKEY | tests/golden/taxes/RULES.md, sections 1, 2, 5, 8 | (this repo) | 96ddcd2f...6c4c6adeb7 |

## 2. The household and the year

One CSV row is one household: a `today` in 2025 or 2026 (the tax year is today's calendar year); a filing status
(`single`, `married_joint`, `married_separate`, `head_of_household`); taxable interest (`other_ordinary`) and qualified
dividends; the year's realized net short-term and net long-term results from the Capital gains page (`st_realized`,
`lt_realized`, each one sale, either sign); nobody 65 or older, nobody blind, no dependents, the standard deduction with
no additions; up to four holdings (symbol from the invented list `ZZTOT ZZINT ZZBND ZZTEC ZZDIV ZZSML`, account `taxable` or
`ira`, price today, total shares and total cost, up to four lots of date-or-blank, shares, total cost).

Conventions for the case (no source decides them):
- **C1** Qualified dividends are all of the ordinary dividends (Form 1040 line 3b = 3a); no non-qualified dividends.
- **C2** No capital loss carried in from last year; no other income, adjustment or credit; MAGI = AGI (I8960 Line 13:
  "your MAGI is your AGI" without foreign income, CFC or PFIC).
- **C3** Every account in the case belongs to the filer or, on a married status, the spouse (P550: "If you sell stock and
  your spouse ... buys substantially identical stock, you also have a wash sale"; this holds on separate returns too).
- **C4** Shares are more than 0, costs and prices are not negative, and no lot is dated after today (the key refuses such
  input). A blank total shares or total cost means the lots' sum.
- **C5** Alternative minimum tax (26 U.S.C. 55) is not modelled; no AMT figure was read for this key.

## 3. Rule 1: holding period

**Law.** USC1222(1)-(4): a gain or loss is short-term when the asset was "held for not more than 1 year" and long-term when
"held for more than 1 year". P550 (2025) p.81, Holding Period: "To determine how long you held the investment property,
begin counting on the date after the day you acquired the property. The day you disposed of the property is part of your
holding period. Example. If you bought investment property on January 31, 2024, and sold it on January 29, 2025, your
holding period is not more than 1 year and you have a short-term capital gain or loss. If you sold it on February 6, 2025,
your holding period is more than 1 year". And: "For securities traded on an established securities market, your holding
period begins the day after the trade date you bought the securities, and ends on the trade date you sold them."

RR6607 (read in a secondary copy): "the holding period of a capital asset begins to run on the day following the date of
acquisition of the asset involved. Accordingly, a capital asset acquired on the last day of any calendar month, regardless
of whether the month has 31 days or less, must not be disposed of until on or after the first day of the seventh succeeding
month of the calendar in order to have been 'held for more than 6 months' ... For example, an asset acquired on April 30,
1963, must not have been disposed of before November 1, 1963". It rests on I.T. 3985, which counts holding periods "with
reference to calendar months and fractions thereof, rather than with reference to days".

**What the key does** (`first_long_day_law`): the first long-term day is
- for a purchase on the last day of a month: the first day of the 13th month after it (RR6607 applied to 12 months);
- for any other day: the same day of the month one year later, plus one day.

So a lot bought February 29, 2024 is long-term from **March 1, 2025**; one bought January 31, 2024 from February 1, 2025;
one bought February 5, 2024 from February 6, 2025.

**Page convention** (`first_long_day_page`): the day after the calendar anniversary; a February 29 purchase uses February 28
as its anniversary, so March 1. The two rules agree on every purchase date except **February 28 of a year before a leap
year** (2023, 2027): law March 1, page February 29 (`rules_differ`). No lot dated 2024 to 2026 is affected; a lot dated
February 28, 2023 differs in its first long-term day only (it is long under both for any 2025 or 2026 `today`).

Outputs per lot: `first_long_day` (law; page in a contrast column), `term_today` (`long` when today is on or after the
first long-term day, else `short`), `days_until_long` (calendar days from today to the first long-term day, 0 when long).

- **H1** A lot with no date, and the unassigned lot, is long-term with 0 days to go (the page's convention; the key cannot
  know a date that was not typed). Its first long-term day is blank.
- **H2** CFR10121 (c)(1)(i): a sale is charged to the lot the seller "adequately identif[ies]"; otherwise "the stock sold
  ... is charged against the earliest lot". The key assumes every lot sold is identified (specific identification), as the
  page's lot-by-lot harvest does.

## 4. Rule 2: lots, values and the unassigned lot

Per lot: value = shares x price today; gain = value - cost (a loss is a negative gain). Per holding: the sums over its
lots. A holding's shares not covered by its lots form one more lot, the **unassigned lot**: shares = total shares - lots'
shares (only when positive), cost = max(0, total cost - lots' cost), no date, long-term (H1). It is a lot like any other
for rules 3, 5 and 6 (convention **L1**: the brief lists it as a lot; whether the page offers it for harvesting was not
checked). Order of lots everywhere: holding order, then lot order, the unassigned lot last in its holding.

## 5. The federal tax the key computes (used by rules 3 and 4)

### 5.1 Brackets, standard deduction, 0/15/20% tops

Read in the revenue procedures (and identical to FEDKEY sections 1, 2 and 5):

| Year | Status | Bracket tops 10/12/22/24/32/35% | Standard deduction | 0% to | 15% to | Source |
|---|---|---|---|---|---|---|
| 2025 | single | 11,925 / 48,475 / 103,350 / 197,300 / 250,525 / 626,350 | 15,750 | 48,350 | 533,400 | RP2440 s.2.01 Table 3, s.2.03; RP2532 s.3.01 |
| 2025 | married_joint | 23,850 / 96,950 / 206,700 / 394,600 / 501,050 / 751,600 | 31,500 | 96,700 | 600,050 | RP2440 s.2.01 Table 1, s.2.03; RP2532 s.3.01 |
| 2025 | married_separate | 11,925 / 48,475 / 103,350 / 197,300 / 250,525 / 375,800 | 15,750 | 48,350 | 300,000 | RP2440 s.2.01 Table 4, s.2.03; RP2532 s.3.01 |
| 2025 | head_of_household | 17,000 / 64,850 / 103,350 / 197,300 / 250,500 / 626,350 | 23,625 | 64,750 | 566,700 | RP2440 s.2.01 Table 2, s.2.03; RP2532 s.3.01 |
| 2026 | single | 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 640,600 | 16,100 | 49,450 | 545,500 | RP2532 s.4.01 Table 3, s.4.03, s.4.14(1) |
| 2026 | married_joint | 24,800 / 100,800 / 211,400 / 403,550 / 512,450 / 768,700 | 32,200 | 98,900 | 613,700 | RP2532 s.4.01 Table 1, s.4.03, s.4.14(1) |
| 2026 | married_separate | 12,400 / 50,400 / 105,700 / 201,775 / 256,225 / 384,350 | 16,100 | 49,450 | 306,850 | RP2532 s.4.01 Table 4, s.4.03, s.4.14(1) |
| 2026 | head_of_household | 17,700 / 67,450 / 105,700 / 201,750 / 256,200 / 640,600 | 24,150 | 66,200 | 579,600 | RP2532 s.4.01 Table 2, s.4.03, s.4.14(1) |

The 2025 standard deduction is the amended one: RP2532 s.3.01, "Section 63(c)(7) as amended by the OBBBA provides the
standard deduction amounts ... for any taxable year beginning in 2025 ... $31,500 ... $23,625 ... $15,750 ... $15,750.
Accordingly, section 2.15(1) of Rev. Proc. 2024-40 is removed" (PL11921 s.70102(b): "inserting $23,625" and "$15,750").
The rates are permanent: USC1 amendment note, "Pub. L. 119-21, s.70101(a)(2), substituted 'beginning after 2017' for '2018
through 2025' in heading" of 1(j). `check_tables()` rebuilds every "The Tax Is" base amount printed in the tables from the
tops (56 of 56 agree).

- **T1** Tax is the exact Tax Computation formula at every income, never the Tax Table (FEDKEY s.1's convention; I1040
  tells filers under $100,000 to use the Tax Table, which would move a result by a few dollars).

### 5.2 Qualified income stacked on top at 0/15/20%

USC1(h)(1)(B)-(D) tax the adjusted net capital gain at "0 percent", "15 percent" and "20 percent"; 1(j)(5)(A) puts the
breakpoints at "the maximum zero rate amount" and "the maximum 15-percent rate amount"; 1(h)(11)(A): "net capital gain
means net capital gain ... increased by qualified dividend income". The key runs the I1040 Qualified Dividends and Capital
Gain Tax Worksheet, lines 1 to 25, exactly: line 3 = "the smaller of line 15 or line 16 of Schedule D. If either line 15 or
line 16 is blank or a loss, enter -0-"; line 9 "This amount is taxed at 0%"; line 18 "Multiply line 17 by 15%"; line 21
"Multiply line 20 by 20%"; line 25 "Tax on all taxable income. Enter the smaller of line 23 or line 24" (`qdcg_tax`).

### 5.3 Schedule D netting and the $3,000 limit

FSD line 7 "Net short-term capital gain or (loss)", line 15 "Net long-term capital gain or (loss)", line 16 "Combine lines 7
and 15", line 21 "If line 16 is a loss, enter here and on Form 1040 ... line 7a, the smaller of: The loss on line 16; or
($3,000), or if married filing separately, ($1,500)". USC1211(b): losses "shall be allowed only to the extent of the gains
from such sales or exchanges, plus (if such losses exceed such gains) the lower of (1) $3,000 ($1,500 in the case of a
married individual filing a separate return), or (2) the excess of such losses over such gains." USC1222(11): "net capital
gain means the excess of the net long-term capital gain for the taxable year over the net short-term capital loss".

So: short against short and long against long (the CSV gives each side as one net figure, plus each harvested lot), then
across (line 16). AGI = interest + qualified dividends + line 7a. Taxable income = max(0, AGI - standard deduction).

### 5.4 Net investment income tax, and how a net capital loss counts

USC1411(a)(1): "a tax equal to 3.8 percent of the lesser of (A) net investment income for such taxable year, or (B) the
excess (if any) of (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount";
(b): "$250,000" joint, "1/2 of the dollar amount determined under paragraph (1)" (125,000) separate, "$200,000" in any other
case; (c)(1)(A): "(i) gross income from interest, dividends ... (iii) net gain (to the extent taken into account in
computing taxable income) attributable to the disposition of property".

**Does an allowed net loss reduce net investment income? Yes, by the allowed amount only.** I8960, Line 5a: "Calculate and
enter the amount of net gain or loss from the disposition of property by combining the following amounts from your properly
completed return. Form 1040 or 1040-SR, line 7a, and Schedule 1 (Form 1040), line 4." Line 7a holds the allowed loss
(at most $3,000 / $1,500, FSD line 21). F8960 line 8: "Total investment income. Combine lines 1, 2, 3, 4c, 5d, 6, and 7";
line 12: "Net investment income ... If zero or less, enter -0-". CFR14114 (d)(3)(ii) Example 1: "A may reduce net investment
income by the $3,000 of the excess of capital losses over capital gains allowed for income tax purposes under section
1211(b)", and in Year 2 the carryover reduces the next gain for NII too. (CFR14114 (d)(2) also says "The calculation of net
gain may not be less than zero. Losses allowable under section 1211(b) are permitted to offset gain from the disposition of
assets other than capital assets"; the form and Example 1 show that the allowed 1211(b) loss still reduces interest and
dividends, and the key follows them.) The disallowed part of a loss and the carryover do not count this year.

Key: NII = max(0, interest + dividends + line 7a); NIIT = 3.8% x min(NII, max(0, AGI - threshold)).
Federal total = income tax (5.2) + NIIT. No credits apply to the case.

### 5.5 The carryover to next year

USC1212(b)(1): "(A) the excess of the net short-term capital loss over the net long-term capital gain for such year shall
be a short-term capital loss in the succeeding taxable year, and (B) the excess of the net long-term capital loss over the
net short-term capital gain for such year shall be a long-term capital loss in the succeeding taxable year." (2)(A): "there
shall be treated as a short-term capital gain in the taxable year an amount equal to the lesser of (i) the amount allowed
for the taxable year under paragraph (1) or (2) of section 1211(b), or (ii) the adjusted taxable income", (2)(B): "taxable
income increased by the sum of (i) the amount allowed ... and (ii) the deduction allowed for such year under section 151"
(0 here: no exemption, nobody 65+), with "negative taxable income" counted. P550: "When you carry over a loss, it remains
long-term or short-term", "Use short-term losses first".

The key applies the ISD Capital Loss Carryover Worksheet (= P550 Worksheet 4-1) to this year's own figures (`carryover`):
1 taxable income, negative if it would be ("If the amount would have been a loss ... enclose the amount in parentheses");
2 the allowed loss; 3 = 1 + 2, "If zero or less, enter -0-"; 4 the smaller of 2 and 3; 5 the short-term loss; 6 any
long-term gain; 8 = 5 - (4 + 6), short-term carryover, floor 0; 9 the long-term loss; 10 any short-term gain; 11 = 4 - 5,
floor 0; 13 = 9 - (10 + 11), long-term carryover, floor 0. P550's example: "a capital loss of $7,000 ... taxable income was
$26,000 ... they can deduct $3,000. The unused part of the loss, $4,000 ... can be carried over" (asserted).

- **K1** When taxable income is below zero the carryover can exceed the loss over $3,000: a single filer in 2026 with $5,000
  of interest and a $10,000 long-term loss carries all $10,000 (line 3 = -14,100 + 3,000, so 0).

## 6. Rule 3: harvest candidates and the page's tax saved (page convention)

- Candidate: a lot (the unassigned lot included, L1) in a **taxable** account whose loss (cost - value) is **more than $1**,
  compared exactly before rounding (**R1**).
- Marginal rate = (federal total with $1,000 more taxable interest - federal total) / 1,000; gains rate = the same with
  $1,000 more qualified dividends. The base is the household as typed, with `st_realized` and `lt_realized` in place and
  nothing harvested. The extra $1,000 is investment income for the NIIT (USC1411(c)(1)(A)(i) "interest, dividends"). Both
  floored at 0. Each federal total is rounded half up to the cent before the two are subtracted (R2), so a rate is a
  multiple of 0.00001; six decimals shown.
- Page tax saved per candidate = loss x marginal rate when short-term today (page term), x gains rate when long-term. The
  page total is the sum of the unrounded amounts.

- **R2** The key takes the change in the federal total (income tax + NIIT), each total rounded half up to the cent first:
  a total of tax is an amount of money, and no source decides how a rate is rounded (I1040: "You can round off cents to
  whole dollars on your return and schedules"). Revised on 2026-10-31 after the first comparison with the page, which
  rounds its totals to the cent: the exact change put 47 rates up to 0.00001 and 24 tax-saved totals up to $1.91 away
  from the page for no reason a source gives. If a page instead adds a flat 0.038 when MAGI is over the threshold, the
  two differ only for households within $1,000 of the threshold or with net investment income near 0.
- **R3** The page's figure ignores wash sales (the brief gives it no wash-sale step); the key's law figure does not.

## 7. Rule 4: what the law saves this year

`harvest_tax_saved_law` = federal total without selling - federal total with every candidate sold today, given the year's
realized results. With the sale, each candidate's **allowed** loss (section 8) joins `st_realized` when the lot is short-term
today (law term) or `lt_realized` when long-term; then 5.3 to 5.5 run again. Outputs:
- `tax_without`, `tax_with`, `harvest_tax_saved_law`;
- `harvest_carryover_short`, `harvest_carryover_long`: the carryover to next year if harvested (5.5); also the carryover
  without harvesting and the new part (with - without), since a negative `st_realized` or `lt_realized` can carry alone;
- `page_total` (section 6) and `ratio` = law / page, six decimals, blank when the page total is 0.

Why they differ: a net capital loss counts against other income only up to $3,000 a year (the rest waits for next year); a
loss first cancels gains that may be taxed at 0% or 15%, whatever the lot's own term; a short-term loss cancels long-term
gains when there are no short-term gains (cross netting, 5.3); wash sales take part of a loss away.

## 8. Rule 5: wash sales

**Law.** USC1091(a): "In the case of any loss claimed to have been sustained from any sale or other disposition of shares of
stock or securities where it appears that, within a period beginning 30 days before the date of such sale or disposition and
ending 30 days after such date, the taxpayer has acquired (by purchase ...) ... substantially identical stock or securities,
then no deduction shall be allowed". (b): "If the amount of stock or securities acquired ... is less than the amount ...
sold ..., then the particular shares ... the loss from the sale or other disposition of which is not deductible shall be
determined under regulations". (d): the new shares' basis "shall be the basis of the stock or securities so sold or disposed
of, increased or decreased ... by the difference ... between the price at which the property was acquired and the price at
which such substantially identical stock or securities were sold".

CFR10911 (a) calls the window "the 61-day period". (b): "Where more than one loss is claimed ... the provisions of this
section shall be applied to the losses in the order in which the stock or securities the disposition of which resulted in
the respective losses were disposed of (beginning with the earliest disposition). If the order of disposition of stock or
securities disposed of at a loss on the same day cannot be determined, the stock or securities will be considered to have
been disposed of in the order in which they were originally acquired (beginning with the earliest acquisition)." (c): "The
stock or securities acquired will be matched in accordance with the order of their acquisition (beginning with the earliest
acquisition) with an equal number of the shares of stock or securities sold". (d): when not fewer were acquired, the shares
sold "will be matched with an equal number of the shares ... acquired in accordance with the order of acquisition". (e):
"The acquisition of any share of stock or any security which results in the nondeductibility of a loss under the
provisions of this section shall be disregarded in determining the deductibility of any other loss." Example 2: "the loss on
the sale of 75 of the shares ($3,750-$3,000, or $750) is not allowable ... The loss on the sale of the remaining 25 shares
($1,250-$1,000, or $250) is deductible ... the basis of the 50 shares ... is ... $3,250 ... the basis of the 25 shares ... is
$1,250 + $125, or $1,375" (asserted, with Examples 1 and 3 and CFR10912 Examples 1-2).

P550 (2025) Wash Sales: "A wash sale occurs when you sell or trade stock or securities at a loss and within 30 days before or
after the sale you: 1. Buy substantially identical stock or securities, ... 4. Acquire substantially identical stock for your
individual retirement arrangement (IRA) or Roth IRA." "If you sell stock and your spouse or a corporation you control buys
substantially identical stock, you also have a wash sale." "If your loss was disallowed because of the wash sale rules, add
the disallowed loss to the cost of the new stock or securities (except in (4) above) ... Your holding period for the new
stock or securities includes the holding period of the stock or securities sold." "Substantially identical. ... you must
consider all the facts and circumstances in your particular case. Ordinarily, stocks or securities of one corporation are
not considered substantially identical to stocks or securities of another corporation." ISD Wash Sales says the same and
"you can't deduct a loss from a wash sale even if it isn't reported on Form 1099-B"; I8949 code W: "enter the amount of the
nondeductible loss as a positive number in column (g)".

RR0805 holding: "The loss on the Sale of stock is disallowed under s.1091. A's basis in the individual retirement account
or Roth IRA is not increased by virtue of s.1091(d)." USC1223(3) and CFR12231 (d): the holding period of the new shares
"shall include the period for which the taxpayer held the securities with respect to which the loss was not allowable".

**What the key does** (`wash_sales`), for the harvest (every candidate sold today):
1. Replacement shares for a sold lot: lots of the **same symbol** (W1) in **any account** of the household (C3), **dated from
   today - 30 days to today** inclusive, **not sold in the same harvest** (W3), with a date (W4).
2. The sold lots of a symbol take replacement shares in order of their own purchase, earliest first (CFR10911 (b), same
   day); undated lots count as the earliest (W4); ties in input order.
3. Replacement shares are used in order of purchase, earliest first (CFR10911 (c), (d)), share for share, each share once
   (CFR10911 (e)); a lot can be split.
4. Disallowed loss = the sold lot's loss per share x matched shares; allowed = loss - disallowed. `wash_sale` = yes when any
   share matched.
5. Basis note per replacement: in a taxable account, its basis rises by the disallowed loss on its matched shares and its
   holding period includes the sold lot's (long-term at once when the sold lot was long-term); in an IRA, the loss is gone
   for good and the IRA basis is not increased (RR0805). Every note adds: a purchase within the next 30 days would also make
   it a wash sale; the key cannot know that today (note only).
6. Contrast flag `wash_sale_any_other_recent`: the brief's plain test, any other lot of the same symbol dated today - 30 to
   today, whether or not it is sold in the harvest.

Conventions:
- **W1** The same ticker is substantially identical; different tickers are not. This is a convention: P550 says the test is
  "all the facts and circumstances", and two different funds tracking the same index could be identical in fact.
- **W2** Two holdings with the same ticker in different accounts are one security for 1091 (P550 item 4; RR0805; C3). CFR60451
  (d)(6)(iii)(B) lets a broker skip wash sales across accounts on its forms; that is reporting only and does not change the
  law (ISD: "you can't deduct a loss from a wash sale even if it isn't reported").
- **W3** A lot that is itself sold in the harvest is never a replacement for another lot sold the same day. No source read
  decides this. The literal reading of 1091 would disallow the earlier lot's loss, add it to the later lot's basis and
  holding period, and allow it again at once on the later lot's sale: the same total loss this year, but the later lot's
  matched shares could turn long-term. When two lots bought inside the window are both sold, the literal reading goes in a
  circle. `same_day_sensitive` flags the households where a lot dated inside the window is sold in the harvest together
  with an older loss lot of the same symbol; the CSV builder should flag such rows or keep them out.
- **W4** An undated lot (and the unassigned lot) is never a replacement and counts as bought first among the lots sold.

## 9. Rule 6: the order to sell when cash is needed

**Page convention:** every lot in a taxable account (gains and losses, the unassigned lot too), sorted by gain per share
(gain / shares), lowest first; only the first eight. **O1** Ties keep input order: Python's sort is stable. How the page breaks
ties was **not checked**: the independence rule forbids reading its code. (ECMAScript has required a stable
`Array.prototype.sort` since its 2019 edition; not read for this key.)

**Contrast:** losses first, most negative gain per dollar (gain / value) first; then the rest by tax per dollar raised =
max(0, gain) x (marginal rate if short-term today, gains rate if long-term) / value, lowest first; a lot worth $0 last;
ties in input order. Both lists show the first eight lot ids.

## 10. Worked examples (invented people; asserted by `rules.py`)

### 10.1 Ana: a $40,000 harvest with no gains this year

Single, today Monday 2026-11-16, interest $240,000, no dividends, nothing realized. Taxable: 1,000 ZZTOT bought 2022-03-14
for $100,000, price $60.00: value $60,000, loss $40,000, long-term. No wash sale.

- Without selling: AGI 240,000; taxable 240,000 - 16,100 = 223,900; tax 41,024 + 32% x (223,900 - 201,775) = **48,104**;
  NIIT 3.8% x min(240,000, 40,000) = **1,520**; total **49,624**.
- Selling: line 16 = -40,000, allowed -3,000 (5.3). AGI 237,000; taxable 220,900; tax 41,024 + 32% x 19,125 = **47,144**;
  NII 240,000 - 3,000 = 237,000 (5.4); NIIT 3.8% x min(237,000, 37,000) = **1,406**; total **48,550**.
- `harvest_tax_saved_law` = **$1,074.00** (3,000 x 32% = 960, plus 3,000 x 3.8% = 114).
- Carryover: line 1 = 220,900, 2 = 3,000, 3 = 223,900, 4 = 3,000; long-term: 9 = 40,000, 10 = 0, 11 = 3,000, 13 =
  **37,000 long-term**, 0 short-term.
- Page: gains rate = 15% (the extra $1,000 of dividends sits above the 0% top) + 3.8% = **0.188000** (marginal 0.358000);
  page tax saved = 40,000 x 0.188 = **$7,520.00**. Ratio 1,074 / 7,520 = **0.142819**. Only $3,000 of the $40,000 saves
  tax now; the other $37,000 waits for next year's gains or $3,000 a year.

### 10.2 Ben and Cy: a harvest against $25,000 of realized long-term gains

Married filing jointly, today Monday 2025-12-15, interest $120,000, qualified dividends $5,000, `lt_realized` +25,000,
`st_realized` 0. Taxable ZZTEC at $40.00: 400 shares bought 2025-06-02 for $24,000 (value 16,000, **loss 8,000, short-term**:
long only from 2026-06-03) and 300 shares bought 2021-09-20 for $24,000 (value 12,000, **loss 12,000, long-term**). No lot is
dated after 2025-11-15, so no wash sale.

- Without selling: AGI 150,000; taxable 150,000 - 31,500 = 118,500; preferential 5,000 + 25,000 = 30,000; ordinary 88,500
  (worksheet line 5). 0% part: min(118,500, 96,700) - 88,500 = 8,200; 15% part 21,800 = 3,270; tax on 88,500 = 2,385 + 12% x
  64,650 = 10,143; total **13,413.00** (MAGI under 250,000: no NIIT).
- Selling: short -8,000, long 25,000 - 12,000 = 13,000, line 16 = 5,000, net capital gain min(13,000, 5,000) = 5,000 (the
  short-term loss cancels long-term gain: cross netting). AGI 130,000; taxable 98,500; preferential 10,000; ordinary 88,500;
  0% part 8,200; 15% part 1,800 = 270; total **10,413.00**.
- `harvest_tax_saved_law` = **$3,000.00**: the whole $20,000 removed long-term gain taxed at 15%. Carryover 0.
- Page: marginal rate **0.270000** (12% on the $1,000, and it pushes $1,000 of gains from 0% to 15%); gains rate **0.150000**;
  page = 8,000 x 0.27 + 12,000 x 0.15 = 2,160 + 1,800 = **$3,960.00**. Ratio 3,000 / 3,960 = **0.757576**: the page prices the
  short-term loss at the ordinary rate, but it only cancels gains taxed at 15%.

### 10.3 Dee: a February 29, 2024 purchase seen on February 28 and March 1, 2025

Single, interest $50,000, nothing realized. Taxable: 100 ZZSML bought **2024-02-29** for $5,000, price $42.00: value 4,200,
loss 800. First long-term day **2025-03-01** (law: February 29 is the last day of its month, so the first day of the 13th
month after; page: anniversary February 28, 2025, plus one day).

| Seen on | Term | Days until long | Page rate used | Page tax saved | Law saved |
|---|---|---|---|---|---|
| 2025-02-28 | short | 1 | marginal 0.120000 | $96.00 | $96.00 |
| 2025-03-01 | long | 0 | gains 0.000000 | $0.00 | $96.00 |

Rates: taxable income 50,000 - 15,750 = 34,250 (12% bracket); $1,000 more of dividends stays under the 48,350 top of the
0% band, so the gains rate is 0. The law saves $96 on both days: with no gains this year the $800 is a net capital loss,
allowed in full against interest (5.3), whatever its term (tax 3,871.50 without, 3,775.50 with). The ratio is 1.000000 on
February 28 and blank on March 1 (page 0). Waiting one day turns the page's figure to 0 while the real saving is unchanged.

### 10.4 Eve: a loss lot, with the same fund bought 12 days ago in her IRA

Head of household, today Friday 2026-11-20, interest $95,000, qualified dividends $1,500, `lt_realized` +2,000. Taxable: 200
ZZTOT bought 2023-05-10 for $24,000. IRA: 50 ZZTOT bought **2026-11-08** (12 days ago) for $5,100. Price $100.00.

- The taxable lot: value 20,000, loss 4,000, long-term, a candidate. The IRA lot is inside the window (2026-10-21 to today)
  and is not sold, so 50 of the 200 shares are matched: **wash sale yes**, disallowed 4,000 x 50/200 = **$1,000.00**, allowed
  **$3,000.00**. Note: "50 shares of h1l0 (IRA, bought 2026-11-08): loss 1000.00 lost for good; IRA basis not increased (Rev.
  Rul. 2008-5)". (Were those 50 shares in a taxable account, bought for $4,900 and kept, the note would read: basis 4,900 +
  1,000 = 5,900, long-term at once; the $1,000 would come back when they are sold.)
- Without selling: AGI 98,500; taxable 98,500 - 24,150 = 74,350; preferential 3,500 all at 15% (ordinary 70,850 is over the
  66,200 top) = 525; tax on 70,850 = 7,740 + 22% x 3,400 = 8,488; total **9,013.00**.
- Selling: long 2,000 - 3,000 = -1,000, allowed in full. AGI 95,500; taxable 71,350; 1,500 dividends at 15% = 225; tax on
  69,850 = 7,740 + 22% x 2,400 = 8,268; total **8,493.00**. `harvest_tax_saved_law` = **$520.00** (2,000 of gains at 15% = 300,
  plus 1,000 against interest at 22% = 220). Carryover 0.
- Without the IRA purchase the whole 4,000 would count: saved $740.00. The wash sale costs $220 this year and the $1,000 for
  good.
- Page: gains rate **0.150000** (marginal 0.220000); page = 4,000 x 0.15 = **$600.00**; ratio 520 / 600 = **0.866667**.

## 11. Rounding and outputs

Exact Fractions throughout; money is rounded half up to the cent and rates to six decimals only when shown. The page total
is the sum of unrounded lot figures (a page that rounds each lot first can differ by a cent per lot). Suggested columns:
per lot `first_long_day_law`, `first_long_day_page`, `term_law`, `term_page`, `days_until_long_law`, `days_until_long_page`,
`value`, `gain`; per candidate `rate_used`, `page_tax_saved`, `wash_sale`, `wash_sale_any_other_recent`, `matched_shares`,
`disallowed_loss`, `allowed_loss`, `basis_note`; per household `marginal_rate`, `gains_rate`, `page_total`, `tax_without`,
`tax_with`, `harvest_tax_saved_law`, `ratio`, `carry_short/long` (with, without, new), `same_day_sensitive`,
`sell_order_page`, `sell_order_contrast` (first eight lot ids each).

## 12. Conventions in one list

C1 qualified = all dividends; C2 no carry-in, MAGI = AGI; C3 every account is the household's; C4 no future-dated lots;
C5 no AMT; H1 undated and unassigned lots are long-term; H2 lots are specifically identified; L1 the unassigned lot is a
lot for rules 3, 5, 6; T1 exact formula, no Tax Table; R1 "more than $1" compared exactly; R2 the change between federal
totals rounded to the cent for the rates; R3 the page's figure ignores wash sales; K1 the carryover worksheet with negative taxable
income; W1 same ticker = identical; W2 across accounts; W3 same-day sales are not replacements; W4 undated lots are never
replacements and are sold first; O1 stable input order on ties.

## 13. Not verified, open points, findings

- **RR6607** was read in a secondary copy (timbertax.org); the 1966 Cumulative Bulletin was not found on irs.gov. It rules on
  the old six-month period; the key applies its calendar-month rule to twelve months by analogy. It changes only February 28
  purchases in a year before a leap year, and no 2025 or 2026 `today` term.
- The **2026** Pub. 550, Schedule D, Form 8949 and Form 8960 instructions are not published yet; the 2025 editions are used for
  2026 rows (1091, 1211, 1212, 1222 and 1411 have no amendment by Pub. L. 119-21 or later).
- **W3** (same-day replacement) and **W1** (substantially identical) are conventions, not law found in a source.
- The page's tie-break in the order to sell, whether it offers the unassigned lot (L1), whether its rates use the exact
  NIIT change (R2): not checked, by the independence rule.
- AMT is not modelled (C5).
- **Checked against the page (2026-10-31, after the key was written).** The page's rates come from totals rounded to the
  cent (R2 now does the same). The law's columns were reproduced with the app's own federal engine on 1,547 of 1,547
  rows with candidates. The federal page's carryover (net loss less the allowed loss) is short of the key's on 65 rows
  with taxable income below zero (K1; 1212(b)(2)(B): "any excess of the deductions allowed for the taxable year over
  the gross income for such year shall be taken into account as negative taxable income").
- **Finding on FEDKEY** (`tests/golden/taxes/RULES.md`): it cites "RP24 s.3.01 / s.3.03 / s.3.15" for 2025; in Rev. Proc.
  2024-40 the tax tables are s.2.01, the capital gains tops s.2.03 and the standard deduction s.2.15 (section 3 is
  "EFFECTIVE DATE"). Its figures agree with the key's.
