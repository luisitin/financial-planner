"""US transfer-tax rules for the estate and gift answer key (federal estate tax, gift tax), as data plus small
pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or
tests/*.test.mjs while writing this file, and it never imports or runs the app. Only the layout and
conventions of tools/golden_health/ and tools/golden_debt/ were looked at; no figure or code is shared with
them. Every figure names its source and the date it was read on the same line. Money is an exact Fraction
while it is worked and a Decimal when it is shown. Importing this file runs check_tables().

Calculators covered (the page READMEs are the spec; where a source says otherwise the key follows the source
and says so in tests/golden/estate/RULES.md section 10):
  ESTATE   tentative tax on (taxable estate + lifetime taxable gifts) minus tentative tax on the exemption,
           never below zero (26 U.S.C. 2001(b), (c), 2010). Taxable estate = estate - charitable bequests
           (2055). Exemption = the basic exclusion amount of the year of death; from 2027 on the page carries the
           newest published figure forward. One person: that tax on today's estate. A couple: nothing at the
           first death (2056, all to a U.S.-citizen spouse); at the second death the whole estate against the
           exemption plus the first spouse's unused exclusion (DSUE, 2010(c)(4)-(5)) with portability, or the
           exemption alone without. The page does not know who dies first, so it takes the smaller DSUE and adds
           back the larger of the two people's lifetime taxable gifts ("conservative"). The key also works both
           real orders of death.
  GIFTS    per year, per recipient and per giver, the gifts counted against that year's annual exclusion
           (2503(b)); over = counted - exclusion when positive; exemption used = sum of over per giver; left =
           exemption - used, never below 0 (a used-up exemption is 0 left; what is over it is taxed, 2502, 2505).
           A gift "from both" is split half each (2513). A 529 contribution with the five-year election
           (529(c)(2)(B)): up to 5 x that year's exclusion counted one fifth a year for five years, the rest in
           the first year. Form 709 needed in a year with anything over, a split gift, or a 529
           election starting (6019). Gifts to a spouse (2523) and tuition or medical bills paid directly
           (2503(e)) are not entered.

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits). The U.S. Code pages are the
OLRC edition "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t26/s<N>/:
  USC2001  26 U.S.C. 2001 (b), (c), (g); amendment notes (rate table last changed by Pub. L. 112-240 s.101(c)(1),
           Jan. 2, 2013; Pub. L. 115-97 s.11061(b) rewrote (g) only; no amendment by Pub. L. 119-21)   (e2374b82...c1a589f685)
  USC2010  26 U.S.C. 2010 (a), (c)(1)-(6), (d); amendment notes (Pub. L. 119-21 s.70106(a), July 4, 2025)   (e78ecd59...180b94b5ec)
  USC2055  26 U.S.C. 2055(a) charitable bequests   (610e5323...3b1c21c3d4)
  USC2056  26 U.S.C. 2056(a), (b)(1), (d)(1)-(2) marital deduction   (b2b0271d...33540c9014)
  USC2042  26 U.S.C. 2042 life insurance   (792458ad...53b6a8803a)
  USC2035  26 U.S.C. 2035(a), (b) transfers within 3 years of death   (96f7f720...c27a6bd4c3)
  USC2053  26 U.S.C. 2053(a) expenses, debts   (39829912...3aa18dc8eb)
  USC2502  26 U.S.C. 2502(a) gift tax computation   (8c79a35b...ec3f0e98a8)
  USC2503  26 U.S.C. 2503(a), (b)(1)-(2), (e) annual exclusion, tuition and medical   (8ed278a2...47bb78f2a0)
  USC2505  26 U.S.C. 2505(a), (c) unified credit against gift tax   (755f50f0...0ab0d8e823)
  USC2513  26 U.S.C. 2513(a)-(d) gift splitting   (1b277ab1...5eabd3fed6)
  USC2522  26 U.S.C. 2522(a) charitable gifts   (9a26b287...c56f44346b)
  USC2523  26 U.S.C. 2523(a), (i) gifts to a spouse   (06a45756...563d4d8a71)
  USC529   26 U.S.C. 529(c)(2)(A)-(B), (c)(4)(C)   (3b8244e8...7656bb9c1e)
  USC6018  26 U.S.C. 6018(a)(1), (3) estate tax return   (8d14f3e1...b039464829)
  USC6019  26 U.S.C. 6019 gift tax returns   (078429fd...057b13be0a)
  USC6075  26 U.S.C. 6075(a), (b)(1)-(3) due dates   (007952bc...122c160520)
  USC1     26 U.S.C. 1(f)(3)-(6) cost-of-living adjustment, C-CPI-U   (acce504c...3ce7938060)
  PL11921  Pub. L. 119-21, 139 Stat. 72, s.70106 "EXTENSION AND ENHANCEMENT OF INCREASED ESTATE AND GIFT TAX
           EXEMPTION AMOUNTS"   https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm   (84000b07...c584e9004d)
  CGLAWS   congress.gov API, laws of the 119th Congress: count 138, highest public law 119-136 (Oct 22, 2026), the
           same law the U.S. Code edition above runs through   https://api.congress.gov/v3/law/119   (1a841288...d1661a36be)
  The regulations are eCFR title 26 "up to date as of 2026-10-29" (https://www.ecfr.gov/api/versioner/v1/titles.json,
  b649b378...71de4d4618), read as XML from https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>
  (human page https://www.ecfr.gov/current/title-26/section-<N>):
  CFR20101 26 CFR 20.2010-1(c), (d), (e) [T.D. 9725, 80 FR 34285, as amended by T.D. 9884, 84 FR 64999, Nov. 26, 2019];
           (e)(3)(iii) still has the pre-2026 "$10,000,000" text, not yet updated for Pub. L. 119-21   (4d7ee6a1...9330e075b0)
  CFR20102 26 CFR 20.2010-2(a), (b), (c) portability election, DSUE computation, Examples 1-3 [T.D. 9725, 80 FR 34285]   (bbc18435...16087e8557)
  CFR20103 26 CFR 20.2010-3(a), (b), (c) last deceased spouse   (f47f79d6...1a072cd024)
  CFR25032 26 CFR 25.2503-2(a), (f) exclusions from gifts   (e8889f4b...edf97a9bd9)
  CFR25036 26 CFR 25.2503-6(a), (b) tuition and medical   (afac0dd5...0a4acf6f08)
  CFR25052 26 CFR 25.2505-2(a), (b) surviving spouse's gifts with a DSUE amount   (d20d68a0...6a5a0ac736)
  CFR25131 26 CFR 25.2513-1(a)-(d) gift splitting, what the consent covers   (2cfab4b1...fc4a902e28)
  CFR25132 26 CFR 25.2513-2(a), (b) manner and time of consent   (1eef2767...80ba4eb65d)
  CFR60191 26 CFR 25.6019-1(a), (f) who must file   (90abc4da...1008355a68)
  CFR60192 26 CFR 25.6019-2 returns when spouses consent   (2db1c278...5617aa66eb)
  CFR60751 26 CFR 25.6075-1(a), (b) due date   (238ef640...6bbbb31184)
  FR98     Notice of proposed rulemaking REG-106177-97 "Qualified State Tuition Programs", 63 FR 45019 (Aug 24, 1998),
           proposed 26 CFR 1.529-5(b)(2) at 63 FR 45031 (never finalized)
           https://www.govinfo.gov/content/pkg/FR-1998-08-24/pdf/98-22465.pdf   (9e28a4d5...e33bb20a93)
  FR08     Advance notice of proposed rulemaking REG-127127-05 "Guidance on Qualified Tuition Programs Under Section
           529", 73 FR 3441 (Jan 18, 2008), part A "Rule 2", Examples A and B at 73 FR 3445
           https://www.govinfo.gov/content/pkg/FR-2008-01-18/pdf/E8-859.pdf   (064f764d...cf803142c9)
  RP2334   Rev. Proc. 2023-34, s.3.41 (2024 basic exclusion), s.3.43 (2024 annual exclusions)
           https://www.irs.gov/pub/irs-drop/rp-23-34.pdf   (544ba41c...52d5aaae57)
  RP2440   Rev. Proc. 2024-40, s.3.41 (2025 basic exclusion), s.3.43 (2025 annual exclusions)
           https://www.irs.gov/pub/irs-drop/rp-24-40.pdf   (4de9db6b...d4c302af1f)
  RP2532   Rev. Proc. 2025-32, s.2.14 (2026 basic exclusion $15,000,000 by statute, indexed from 2027), s.4.42 (2026
           annual exclusions)   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf   (e9ada115...a96214635b)
  IR25103  IRS news release IR-2025-103 (Oct 9, 2025), 2026 inflation adjustments
           https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill
           (c96c12ca...80d0deeda5)
  IRSWN    IRS "What's new - Estate and gift tax" (page last reviewed 23-Jul-2026): basic exclusion 2011-2026, annual
           exclusion 2011-2026   https://www.irs.gov/businesses/small-businesses-self-employed/whats-new-estate-and-gift-tax
           (0c16c80d...786afc7777)
  I709     Instructions for Form 709 (2025): Who Must File; Part III Spouse's Consent; "When the Consenting Spouse Must
           Also File"; Schedule A Line B (529 election, Pat example); Split Gifts
           https://www.irs.gov/pub/irs-pdf/i709.pdf   (7de1ce38...8a47b75bcf)
  I706     Instructions for Form 706 (Rev. July 2026), What's New, Which Estates Must File, Portability election,
           Table A Unified Rate Schedule, "Table of Basic Exclusion Amounts ... Credit Equivalent at 2026 Rates"
           https://www.irs.gov/pub/irs-pdf/i706.pdf   (8121d049...84e03d1c92)
  RP2625   Rev. Proc. 2026-25, transfer tax safe harbor for contributions to Trump accounts (out of the page's scope)
           https://www.irs.gov/pub/irs-drop/rp-26-25.pdf   (ccc5c989...1d42d22884)
  Searched for the 2027 inflation revenue procedure (none found, see NOT VERIFIED):
  IRSNR10  IRS news releases for the current month (October 2026: IR-2026-117 to IR-2026-129, page last reviewed
           29-Oct-2026)   https://www.irs.gov/newsroom/news-releases-for-current-month   (df1ffd31...d013176a19)
  IRSNR09  IRS news releases for September 2026 (IR-2026-103 to IR-2026-116)
           https://www.irs.gov/newsroom/news-releases-for-september-2026   (443ad8a9...ebc101c13e)
  IRB      Internal Revenue Bulletin index, newest 2026-45 (Nov 2, 2026); bulletins 2026-36 to 2026-45 read
           https://www.irs.gov/irb   (e4c21969...d9a23c60eb); https://www.irs.gov/irb/2026-45_IRB (1c15b7c4...a87655769c)
  IRSDROP  https://www.irs.gov/pub/irs-drop/rp-26-NN.pdf for NN = 20..60: 20-26, 28, 30, 32-34 exist (none is the annual
           inflation procedure); 27, 29, 31 and 35-60 answered 404 (2026-29 and 2026-31 are in IRB 2026-41 and 2026-44)

NOT VERIFIED on any official source (so the key states its own convention and says so):
  - The 2027 figures. By 2026-10-31 the IRS had not published the revenue procedure with the 2027 basic exclusion
    amount and the 2027 annual exclusion (IRSNR10, IRSNR09, IRB through 2026-45, IRSDROP; the guessed news-release
    address .../irs-releases-tax-inflation-adjustments-for-tax-year-2027 answered 404). Third-party sites print
    estimates; none is used. The key carries the 2026 figures forward, as the page does, and marks them unpublished.
  - The C-CPI-U and CPI-U values needed to recompute any indexed figure: api.bls.gov refused ("daily threshold ...
    reached") and download.bls.gov answered 403. So no indexed figure is rebuilt from the price index here; the
    published figures are checked only for the statute's rounding (multiples of $10,000 and $1,000).
  - Ties in "rounded to the nearest multiple of $10,000" (2010(c)(3)(B)): no rule on an exact $5,000; the key rounds
    half up. The tentative tax and the one-fifth 529 portions are kept exact; no rounding rule was found for them.
  - Proposed 26 CFR 1.529-5 (1998) was never finalized; the 2008 advance notice repeats its cap rule. The key follows
    both (they agree with the Form 709 instructions), but they are not binding regulations.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from decimal import Decimal as D
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CENT = F(1, 100)
DOLLAR = F(1)


# ---- exact arithmetic helpers ---------------------------------------------------------------------
def _F(x):
    """Exact Fraction from an int, str, Decimal or Fraction. Floats are refused (they are not exact)."""
    if isinstance(x, float):
        raise TypeError('pass money as str, int, Decimal or Fraction, never float')
    if isinstance(x, F):
        return x
    if isinstance(x, int):
        return F(x)
    return F(D(x))


def round_half_up(x, quantum=DOLLAR):
    """Round x to a multiple of quantum, halves away from zero (the key's convention; see RULES.md)."""
    x, q = _F(x), _F(quantum)
    n = abs(x) / q
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)  # floor(n + 1/2)
    return (k * q) if x >= 0 else -(k * q)


def round_down(x, multiple):
    """Largest multiple of `multiple` not above x (2503(b)(2) "rounded to the next lowest multiple")."""
    x, m = _F(x), _F(multiple)
    return (x // m) * m


def show(x, quantum=CENT):
    """Decimal for display, rounded half up to the quantum (cents by default)."""
    r = round_half_up(x, quantum)
    places = D('0.01') if _F(quantum) == CENT else D('1')
    return (D(r.numerator) / D(r.denominator)).quantize(places)


# =====================================================================================================
# 1. The unified rate schedule (26 U.S.C. 2001(c)) and the tentative tax
# =====================================================================================================
# Row: (over, but not over, tax on "over", percent on the excess). The text is the 2013 table (Pub. L. 112-240
# s.101(c)(1) split the single "over $500,000" row into 37%, 39% and 40% rows); the 2017 law (Pub. L. 115-97
# s.11061(b)) rewrote 2001(g) only, and Pub. L. 119-21 did not amend 2001 (USC2001 source credit and notes).
RATE_SCHEDULE = (
    (0, 10000, 0, 18),             # USC2001 (c) "Not over $10,000 | 18 percent of such amount."; read 2026-10-31
    (10000, 20000, 1800, 20),      # USC2001 (c) "Over $10,000 but not over $20,000 | $1,800, plus 20 percent of the excess of such amount over $10,000."; read 2026-10-31
    (20000, 40000, 3800, 22),      # USC2001 (c) "Over $20,000 but not over $40,000 | $3,800, plus 22 percent ..."; read 2026-10-31
    (40000, 60000, 8200, 24),      # USC2001 (c) "Over $40,000 but not over $60,000 | $8,200 plus 24 percent ..."; read 2026-10-31
    (60000, 80000, 13000, 26),     # USC2001 (c) "Over $60,000 but not over $80,000 | $13,000, plus 26 percent ..."; read 2026-10-31
    (80000, 100000, 18200, 28),    # USC2001 (c) "Over $80,000 but not over $100,000 | $18,200, plus 28 percent ..."; read 2026-10-31
    (100000, 150000, 23800, 30),   # USC2001 (c) "Over $100,000 but not over $150,000 | $23,800, plus 30 percent ..."; read 2026-10-31
    (150000, 250000, 38800, 32),   # USC2001 (c) "Over $150,000 but not over $250,000 | $38,800, plus 32 percent ..."; read 2026-10-31
    (250000, 500000, 70800, 34),   # USC2001 (c) "Over $250,000 but not over $500,000 | $70,800, plus 34 percent ..."; read 2026-10-31
    (500000, 750000, 155800, 37),  # USC2001 (c) "Over $500,000 but not over $750,000 | $155,800, plus 37 percent ..."; read 2026-10-31
    (750000, 1000000, 248300, 39), # USC2001 (c) "Over $750,000 but not over $1,000,000 | $248,300, plus 39 percent ..."; read 2026-10-31
    (1000000, None, 345800, 40),   # USC2001 (c) "Over $1,000,000 | $345,800, plus 40 percent of the excess of such amount over $1,000,000."; I706 Table A the same; read 2026-10-31
)
TOP_RATE = F(40, 100)  # USC2001 (c) last row; read 2026-10-31


def tentative_tax(amount):
    """Tentative tax under 2001(c) on `amount` dollars, exact. Zero or less gives zero."""
    x = _F(amount)
    if x <= 0:
        return F(0)
    for lo, hi, base, pct in RATE_SCHEDULE:
        if hi is None or x <= hi:   # "Over lo but not over hi"
            return F(base) + F(pct, 100) * (x - lo)
    raise AssertionError('unreachable')


# =====================================================================================================
# 2. The exemption: basic exclusion amount (26 U.S.C. 2010(c)(3)) and the annual exclusion (2503(b))
# =====================================================================================================
# Basic exclusion amount for the year of death (IRSWN table "Basic exclusion amount for year of death"; I706 "Table of
# Basic Exclusion Amounts"). The page uses 2024-2026; earlier years are kept for check_tables().
BASIC_EXCLUSION = {
    2011: 5000000,   # IRSWN; I706 table; read 2026-10-31
    2012: 5120000,   # IRSWN; I706 table; read 2026-10-31
    2013: 5250000,   # IRSWN; I706 table; read 2026-10-31
    2014: 5340000,   # IRSWN; I706 table; read 2026-10-31
    2015: 5430000,   # IRSWN; I706 table; CFR20102 (c)(5) Example 1 "the $5,430,000 basic exclusion amount in 2015"; read 2026-10-31
    2016: 5450000,   # IRSWN; I706 table; read 2026-10-31
    2017: 5490000,   # IRSWN; I706 table; read 2026-10-31
    2018: 11180000,  # IRSWN; I706 table; read 2026-10-31
    2019: 11400000,  # IRSWN; I706 table; read 2026-10-31
    2020: 11580000,  # IRSWN; I706 table; read 2026-10-31
    2021: 11700000,  # IRSWN; I706 table; read 2026-10-31
    2022: 12060000,  # IRSWN; I706 table; read 2026-10-31
    2023: 12920000,  # IRSWN; I706 table; read 2026-10-31
    2024: 13610000,  # RP2334 s.3.41 "For an estate of any decedent dying in calendar year 2024, the basic exclusion amount is $13,610,000"; IRSWN; read 2026-10-31
    2025: 13990000,  # RP2440 s.3.41 "... dying in calendar year 2025, the basic exclusion amount is $13,990,000"; IRSWN; IR25103; read 2026-10-31
    2026: 15000000,  # USC2010 (c)(3)(A) "the basic exclusion amount is $15,000,000"; PL11921 s.70106(a)(1), (b) "after December 31, 2025"; RP2532 s.2.14; I706 What's New; read 2026-10-31
}
# Credit equivalent (tentative tax on the basic exclusion amount at the current rates), I706 "Table of Basic Exclusion
# Amounts ... Credit Equivalent at 2026 Rates", rows 2011-2026; check_tables() rebuilds each one from RATE_SCHEDULE.
I706_CREDIT_EQUIVALENT = {
    2011: 1945800, 2012: 1993800, 2013: 2045800, 2014: 2081800, 2015: 2117800, 2016: 2125800,  # I706 table; read 2026-10-31
    2017: 2141800, 2018: 4417800, 2019: 4505800, 2020: 4577800, 2021: 4625800, 2022: 4769800,  # I706 table; read 2026-10-31
    2023: 5113800, 2024: 5389800, 2025: 5541800, 2026: 5945800,                                # I706 table; I706 What's New "The basic credit amount is $5,945,800"; read 2026-10-31
}
BEA_STATUTE_AMOUNT = 15000000   # USC2010 (c)(3)(A); read 2026-10-31
BEA_INDEX_AFTER = 2026          # USC2010 (c)(3)(B) "In the case of any decedent dying in a calendar year after 2026"; read 2026-10-31
BEA_INDEX_BASE_YEAR = 2025      # USC2010 (c)(3)(B)(ii) "by substituting 'calendar year 2025' for 'calendar year 2016' in subparagraph (A)(ii)"; read 2026-10-31
BEA_ROUNDING = 10000            # USC2010 (c)(3)(B) "rounded to the nearest multiple of $10,000"; read 2026-10-31

# Annual exclusion per donee (2503(b)), gifts of present interests.
ANNUAL_EXCLUSION = {
    2011: 13000, 2012: 13000,                                       # IRSWN "2011 through 2012 $13,000"; read 2026-10-31
    2013: 14000, 2014: 14000, 2015: 14000, 2016: 14000, 2017: 14000,  # IRSWN "2013 through 2017 $14,000"; read 2026-10-31
    2018: 15000, 2019: 15000, 2020: 15000, 2021: 15000,             # IRSWN "2018 through 2021 $15,000"; read 2026-10-31
    2022: 16000,  # IRSWN; read 2026-10-31
    2023: 17000,  # IRSWN; read 2026-10-31
    2024: 18000,  # RP2334 s.3.43(1) "For calendar year 2024, the first $18,000 of gifts to any person (other than gifts of future interests in property) are not included"; read 2026-10-31
    2025: 19000,  # RP2440 s.3.43(1) "For calendar year 2025, the first $19,000 of gifts to any person ..."; I709 "more than $19,000"; read 2026-10-31
    2026: 19000,  # RP2532 s.4.42(1) "For calendar year 2026, the first $19,000 of gifts to any person ..."; IR25103 "remains at $19,000"; read 2026-10-31
}
AE_STATUTE_AMOUNT = 10000       # USC2503 (b)(1) "the first $10,000 of such gifts to such person"; read 2026-10-31
AE_INDEX_AFTER = 1998           # USC2503 (b)(2) "In the case of gifts made in a calendar year after 1998"; read 2026-10-31
AE_INDEX_BASE_YEAR = 1997       # USC2503 (b)(2)(B) "by substituting 'calendar year 1997' for 'calendar year 2016'"; read 2026-10-31
AE_ROUNDING = 1000              # USC2503 (b)(2) "rounded to the next lowest multiple of $1,000"; read 2026-10-31
# Gifts to a spouse who is not a U.S. citizen (2523(i)(2)); not used by the page (it does not enter gifts to a spouse).
NONCITIZEN_SPOUSE_EXCLUSION = {2024: 185000, 2025: 190000, 2026: 194000}  # RP2334 s.3.43(2); RP2440 s.3.43(2); RP2532 s.4.42(2); read 2026-10-31

LATEST_PUBLISHED = 2026         # newest year with an IRS figure for both tables (IRSNR10, IRSNR09, IRB, IRSDROP); read 2026-10-31
FIGURES_2027_PUBLISHED = False  # no 2027 inflation revenue procedure found on irs.gov by 2026-10-31 (see NOT VERIFIED)


def basic_exclusion(year, carry_forward=True):
    """(amount, published) for decedents dying in `year`. After LATEST_PUBLISHED the page's rule: the newest published
    figure carried forward (published=False). The law will index it (bea_indexed), with a figure not yet known."""
    if year in BASIC_EXCLUSION:
        return F(BASIC_EXCLUSION[year]), True
    if year > LATEST_PUBLISHED and carry_forward:
        return F(BASIC_EXCLUSION[LATEST_PUBLISHED]), False
    raise KeyError('no basic exclusion amount for %s' % year)


def annual_exclusion(year, carry_forward=True):
    """(amount, published) for gifts made in `year`; after LATEST_PUBLISHED the 2026 figure carried forward."""
    if year in ANNUAL_EXCLUSION:
        return F(ANNUAL_EXCLUSION[year]), True
    if year > LATEST_PUBLISHED and carry_forward:
        return F(ANNUAL_EXCLUSION[LATEST_PUBLISHED]), False
    raise KeyError('no annual exclusion for %s' % year)


def _ae(year):
    return annual_exclusion(year)[0]


def bea_indexed(c_cpi_u_prev_year, c_cpi_u_2025):
    """Law for decedents dying after 2026 (USC2010 (c)(3)(B); USC1 (f)(3)(A), (C), (6)(B)):
    $15,000,000 + $15,000,000 x COLA, COLA = C-CPI-U(preceding calendar year) / C-CPI-U(2025) - 1 "(if any)", each
    C-CPI-U being the average of the 12 months ending August 31 of that year, "rounded to the nearest multiple of
    $10,000" (ties half up, the key's convention). The inputs are not supplied here (see NOT VERIFIED)."""
    cola = max(F(0), _F(c_cpi_u_prev_year) / _F(c_cpi_u_2025) - 1)
    return round_half_up(BEA_STATUTE_AMOUNT + BEA_STATUTE_AMOUNT * cola, BEA_ROUNDING)


def annual_exclusion_indexed(c_cpi_u_prev_year, cpi_1997, c_cpi_u_2016, cpi_2016):
    """Law (USC2503 (b)(2); USC1 (f)(3)(A)-(B)): $10,000 + $10,000 x COLA, COLA = C-CPI-U(preceding year) /
    (CPI(1997) x C-CPI-U(2016) / CPI(2016)) - 1, then "rounded to the next lowest multiple of $1,000"."""
    cola = max(F(0), _F(c_cpi_u_prev_year) / (_F(cpi_1997) * _F(c_cpi_u_2016) / _F(cpi_2016)) - 1)
    return round_down(AE_STATUTE_AMOUNT + AE_STATUTE_AMOUNT * cola, AE_ROUNDING)


# =====================================================================================================
# 3. Estate tax (2001(b), 2010) for one person, and the unused exclusion (DSUE) of a spouse
# =====================================================================================================
def estate_tax(taxable_estate, adjusted_taxable_gifts, applicable_exclusion, gift_tax_payable=0):
    """26 U.S.C. 2001(b) less the 2010 credit, exact:
    tax under 2001 = tentative tax(taxable estate + adjusted taxable gifts) - gift tax payable on post-1976 gifts
    (2001(b)(2), at date-of-death rates per 2001(g)(1)); credit = tentative tax(applicable exclusion) (2010(a), (c)(1)),
    "shall not exceed the amount of the tax imposed by section 2001" (2010(d)). The page has gift_tax_payable = 0."""
    base = _F(taxable_estate) + _F(adjusted_taxable_gifts)
    tt = tentative_tax(base)
    tax_2001 = max(F(0), tt - _F(gift_tax_payable))
    credit = min(tentative_tax(applicable_exclusion), tax_2001)
    return {'base': base, 'tentative_tax': tt, 'tax_before_credit': tax_2001,
            'credit': credit, 'tax': tax_2001 - credit}


def single_estate_tax(estate, charity=0, lifetime_taxable_gifts=0, year=2026, gift_tax_payable=0):
    """One person. estate = the page's estate (gross estate after debts and expenses, 2053; life insurance the person
    owns on his or her own life is in it, 2042). taxable estate = estate - charitable bequests (2055)."""
    exemption, published = basic_exclusion(year)
    taxable = max(F(0), _F(estate) - _F(charity))
    r = estate_tax(taxable, lifetime_taxable_gifts, exemption, gift_tax_payable)
    r.update(taxable_estate=taxable, exemption=exemption, exemption_published=published)
    return r


def dsue(bea_year_of_death, deceased_applicable_exclusion, taxable_estate, adjusted_taxable_gifts, gift_taxed_gifts=0):
    """Deceased spousal unused exclusion, CFR20102 (c)(1)-(2) and USC2010 (c)(4): the lesser of (i) the basic exclusion
    amount in the year of the decedent's death and (ii) the decedent's applicable exclusion amount minus (taxable estate
    + adjusted taxable gifts), the gifts first reduced by the amount on which gift tax was paid. Never below zero."""
    used = _F(taxable_estate) + _F(adjusted_taxable_gifts) - _F(gift_taxed_gifts)
    return min(_F(bea_year_of_death), max(F(0), _F(deceased_applicable_exclusion) - used))


def couple_estate_tax(estate, gifts_a, gifts_b, charity=0, year=2026, portability=True, method='page'):
    """A married couple (both U.S. citizens), everything to the survivor at the first death.

    First death: taxable estate = 0 (2056(a) marital deduction for everything passing to the spouse), so no tax and
    DSUE = exemption - that person's lifetime taxable gifts (dsue() with taxable estate 0, same year).
    Second death: the whole estate (less charitable bequests) plus the survivor's lifetime taxable gifts, against the
    exemption + the first decedent's DSUE (portability elected) or the exemption alone.

    method 'page'    : the page's conservative rule: DSUE = the smaller of the two, gifts added back = the larger.
           'A_first' : A dies first, B survives (the law for that order).
           'B_first' : B dies first, A survives.
    """
    e, published = basic_exclusion(year)
    ga, gb = _F(gifts_a), _F(gifts_b)
    dsue_a, dsue_b = dsue(e, e, 0, ga), dsue(e, e, 0, gb)
    taxable = max(F(0), _F(estate) - _F(charity))
    if method == 'page':
        carried, added = min(dsue_a, dsue_b), max(ga, gb)
    elif method == 'A_first':
        carried, added = dsue_a, gb
    elif method == 'B_first':
        carried, added = dsue_b, ga
    else:
        raise ValueError(method)
    exclusion = e + (carried if portability else F(0))
    r = estate_tax(taxable, added, exclusion)
    r.update(first_death_tax=F(0), dsue_a=dsue_a, dsue_b=dsue_b, dsue_used=carried if portability else F(0),
             gifts_added=added, exemption=e, applicable_exclusion=exclusion, exemption_published=published,
             taxable_estate=taxable)
    return r


def estate_return_required(gross_estate, adjusted_taxable_gifts, year, electing_portability=False):
    """Form 706 needed (USC6018 (a)(1), (3); I706 Which Estates Must File): gross estate > basic exclusion amount minus
    adjusted taxable gifts, or the executor elects portability (CFR20102 (a): only on a timely filed Form 706)."""
    e, _ = basic_exclusion(year)
    return electing_portability or _F(gross_estate) > max(F(0), e - _F(adjusted_taxable_gifts))


# =====================================================================================================
# 4. Gifts: annual exclusion per donee and donor, gift splitting (2513), 529 five-year election, Form 709
# =====================================================================================================
QTP_YEARS = 5         # USC529 (c)(2)(B) "ratably over the 5-year period beginning with such calendar year"; read 2026-10-31
QTP_CAP_MULTIPLE = 5  # FR98 prop. 1.529-5(b)(2)(i) "not in excess of five times the section 2503(b) exclusion amount available in the calendar year of the contribution"; FR08 Rule 2; I709 "up to $95,000" (5 x $19,000) for 2025; read 2026-10-31
SPOUSES = ('A', 'B')


def _shares(gift, split_it):
    amt = _F(gift['amount'])
    if gift['giver'] == 'both' or split_it:
        return [('A', amt / 2), ('B', amt / 2)]
    if gift['giver'] not in SPOUSES:
        raise ValueError('giver is A, B or both')
    return [(gift['giver'], amt)]


def gift_ledger(gifts, mode='page', exclusion=None):
    """Work a list of gifts. Each gift is a dict:
        year, giver ('A', 'B' or 'both'), to (recipient), amount, kind ('cash' default or '529'),
        elect (the 529 five-year election, default False), split (marked "split with my spouse", default False).
    Gifts to the spouse and tuition or medical bills paid directly are not entered (2523(a); 2503(e)).

    mode 'page': only the gifts marked split (or "from both") are halved.
         'law' : USC2513 (a)(2), CFR25131 (b)(5), I709 "all gifts made by either you or your spouse to third parties
                 during the calendar year ... must be split": a year with any split gift halves every gift of both.
    exclusion: function year -> annual exclusion (default: the table, carried forward after 2026).

    Order (I709 Line B): split first, then each giver's 529 election on his or her own share. For each giver, year and
    recipient the 529 contributions are added up; with the election (law: only if that sum exceeds the year's exclusion,
    USC529 (c)(2)(B)) the part up to 5 x the exclusion is counted one fifth in each of five years and the rest in the
    first year (FR98; FR08 Example B; I709 Pat example). Deemed fifths stay with the giver of the contribution year.
    """
    if mode not in ('page', 'law'):
        raise ValueError(mode)
    ae = exclusion or _ae
    split_years = sorted({g['year'] for g in gifts if g.get('split') or g['giver'] == 'both'})
    counted, raw, qtp, elect_flag = {}, {}, {}, {}
    for g in gifts:
        y = g['year']
        split_it = bool(g.get('split')) if mode == 'page' else (y in split_years)
        if g['giver'] == 'both':
            pre = [('A', _F(g['amount']) / 2), ('B', _F(g['amount']) / 2)]
        else:
            pre = [(g['giver'], _F(g['amount']))]
        for who, amt in pre:   # amounts "without regard to section 2513" (CFR60192), before any 529 spreading
            raw[(who, y, g['to'])] = raw.get((who, y, g['to']), F(0)) + amt
        for who, amt in _shares(g, split_it):
            key = (who, y, g['to'])
            if g.get('kind', 'cash') == '529':
                qtp[key] = qtp.get(key, F(0)) + amt
                elect_flag[key] = elect_flag.get(key, False) or bool(g.get('elect'))
            else:
                counted[key] = counted.get(key, F(0)) + amt
    elections = {}
    deemed = {}   # (who, year, to) -> deemed fifths landing in that year from an earlier year's election
    for key, total in qtp.items():
        who, y, to = key
        cap = QTP_CAP_MULTIPLE * ae(y)
        can_elect = elect_flag[key] and (mode == 'page' or total > ae(y))
        if can_elect:
            elected = min(total, cap)
            excess = total - elected
            elections[key] = {'elected': elected, 'excess': excess, 'fifth': elected / QTP_YEARS}
            for k in range(QTP_YEARS):
                kk = (who, y + k, to)
                counted[kk] = counted.get(kk, F(0)) + elected / QTP_YEARS
                if k:
                    deemed[kk] = deemed.get(kk, F(0)) + elected / QTP_YEARS
            counted[key] = counted.get(key, F(0)) + excess
        else:
            counted[key] = counted.get(key, F(0)) + total
    over = {k: max(F(0), v - ae(k[1])) for k, v in counted.items()}
    used = {w: sum((v for k, v in over.items() if k[0] == w), F(0)) for w in SPOUSES}
    years = sorted({k[1] for k in counted})
    over_by_year = {w: {y: sum((v for k, v in over.items() if k[0] == w and k[1] == y), F(0)) for y in years} for w in SPOUSES}
    elect_years = {(k[0], k[1]) for k in elections}
    # Form 709, the page's rule: a year with anything over, a split gift, or a 529 election starting.
    form709_years = sorted({y for y in years if any(over_by_year[w][y] > 0 for w in SPOUSES)}
                           | set(split_years) | {y for _, y in elect_years})
    # Who files, the law's rule (USC6019; CFR60191 (a); CFR60192; I709 Who Must File, Line B).
    filers = {}
    for y in years:
        def required_alone(w):
            amounts = [v + deemed.get(k, F(0)) for k, v in raw.items() if k[0] == w and k[1] == y]
            amounts += [v for k, v in deemed.items() if k[0] == w and k[1] == y and (w, y, k[2]) not in raw]
            return any(a > ae(y) for a in amounts) or (w, y) in elect_years
        post = {w: over_by_year[w].get(y, F(0)) > 0 or (w, y) in elect_years for w in SPOUSES}
        if y not in split_years:
            f = {w for w in SPOUSES if post[w]}
        else:
            alone = {w for w in SPOUSES if required_alone(w)}
            if len(alone) == 2:
                f = set(SPOUSES)                      # CFR60192 "returns must be filed by both spouses"
            elif len(alone) == 1:
                (w,) = alone
                other = 'B' if w == 'A' else 'A'
                f = {w} | ({other} if post[other] else set())   # CFR60192 "a return must also be filed by such other spouse"
            else:
                # Nobody would have to file, but the consent is signified only on a return (CFR25132 (a)(1); I709 "You
                # must file a gift tax return to split gifts with your spouse (regardless of their amount)"). Key's
                # convention: the giver(s) of the gifts marked split file.
                f = set()
                for g in gifts:
                    if g['year'] == y and (g.get('split') or g['giver'] == 'both'):
                        f |= set(SPOUSES) if g['giver'] == 'both' else {g['giver']}
        if f:
            filers[y] = f
    return {'counted': counted, 'over': over, 'used': used, 'over_by_year': over_by_year, 'elections': elections,
            'split_years': split_years, 'form709_years': form709_years, 'filers': filers}


def exemption_left(used, year=2026):
    """Left = exemption - used, never below 0. The exemption is a credit that is used up, not a balance that goes
    negative: once taxable gifts pass it, the credit left is 0 and gift tax is due on the excess that year (USC2505
    (a): the credit is the applicable credit amount "reduced by" the credits allowed before; USC2502 (a)). The page
    floors it at 0 too; its README writes the formula without the floor. Checked again 2026-10-31."""
    return max(_F(0), basic_exclusion(year)[0] - _F(used))


def gift_tax_by_year(taxable_by_year, applicable_exclusion=None):
    """Gift tax a year for one giver (USC2502 (a); USC2505 (a), (c)): tentative tax(all taxable gifts to date) -
    tentative tax(prior taxable gifts) = tax before credit; credit = tentative tax(applicable exclusion of that year) -
    credits allowed in earlier years, not more than the tax before credit. Rates are those of 2001(c) today for every
    year (2505(a) last sentence). applicable_exclusion: function year -> amount (default the basic exclusion)."""
    aea = applicable_exclusion or (lambda y: basic_exclusion(y)[0])
    prior, credits, out = F(0), F(0), {}
    for y in sorted(taxable_by_year):
        cur = _F(taxable_by_year[y])
        before_credit = tentative_tax(prior + cur) - tentative_tax(prior)
        credit = min(max(F(0), tentative_tax(aea(y)) - credits), before_credit)
        out[y] = before_credit - credit
        credits += credit
        prior += cur
    return out


# =====================================================================================================
# 5. Checks: every figure the key can rebuild, the sources' own examples, and the RULES.md examples
# =====================================================================================================
def check_tables():
    # Rate schedule: rows meet, and each row's tax on "over" is the previous row's tax plus its rate on its width.
    for (lo, hi, base, pct), (lo2, hi2, base2, pct2) in zip(RATE_SCHEDULE, RATE_SCHEDULE[1:]):
        assert hi == lo2 and F(base) + F(pct, 100) * (hi - lo) == base2
    assert RATE_SCHEDULE[0][2] == 0 and RATE_SCHEDULE[-1][3] == 40
    assert tentative_tax(10000) == 1800 and tentative_tax(5000) == 900 and tentative_tax(0) == 0 and tentative_tax(-5) == 0
    assert tentative_tax(150000) == 38800 and tentative_tax(750000) == 248300 and tentative_tax(1000000) == 345800
    assert tentative_tax(1000001) == 345800 + TOP_RATE
    for x in (1000000, 2500000, 13610000, 15000000, 43000000):   # top bracket: 345,800 + 40% of the excess over $1,000,000
        assert tentative_tax(x) == 345800 + TOP_RATE * (x - 1000000)

    # Form 706 table: the credit equivalent of each year's basic exclusion amount is its tentative tax.
    for y, credit in I706_CREDIT_EQUIVALENT.items():
        assert tentative_tax(BASIC_EXCLUSION[y]) == credit, y
    assert tentative_tax(1000000) == 345800   # I706 table "2002 through 2010 | $1,000,000 | $345,800"
    # Statute's rounding: indexed basic exclusion amounts are multiples of $10,000, annual exclusions of $1,000.
    assert all(v % BEA_ROUNDING == 0 for v in BASIC_EXCLUSION.values())
    assert all(v % AE_ROUNDING == 0 and v >= AE_STATUTE_AMOUNT for v in ANNUAL_EXCLUSION.values())
    assert BASIC_EXCLUSION[2026] == BEA_STATUTE_AMOUNT and ANNUAL_EXCLUSION[2026] == ANNUAL_EXCLUSION[2025]
    assert basic_exclusion(2027) == (F(15000000), False) and annual_exclusion(2031) == (F(19000), False)
    assert QTP_CAP_MULTIPLE * ANNUAL_EXCLUSION[2025] == 95000   # I709 "up to $95,000"
    # Indexing helpers: no growth -> statute amount; a 3.2% rise -> 15,480,000 exactly; rounding to the nearest $10,000.
    assert bea_indexed(100, 100) == 15000000 and bea_indexed(F(1032, 10), 100) == 15480000
    assert bea_indexed(F(10033, 100), 100) == 15050000 and bea_indexed(F(1003, 1000), 1) == 15050000   # 15,045,000: a tie, half up
    assert bea_indexed(90, 100) == 15000000   # "(if any)": no decrease
    assert annual_exclusion_indexed(F(19999, 10000), 1, 1, 1) == 19000 and annual_exclusion_indexed(2, 1, 1, 1) == 20000

    # 26 CFR 20.2010-2(c)(5) Examples 1-3 (2015, basic exclusion $5,430,000).
    e15 = BASIC_EXCLUSION[2015]
    assert dsue(e15, e15, 1000000, 1000000) == 3430000                       # Example 1
    assert dsue(e15, e15, 1000000, 2000000, gift_taxed_gifts=1000000) == 3430000   # Example 2
    assert dsue(e15, e15, 500000, 1000000) == 3930000                        # Example 3, preliminary
    assert dsue(e15, e15, 500000 + 1800000, 1000000) == 2130000              # Example 3, redetermined with the QDOT assets
    # 26 CFR 20.2010-1(c)(2) Example 4: tax on $14 million and on $6.8 million at today's rates.
    assert tentative_tax(14000000) == 5545800 and tentative_tax(6800000) == 2665800
    # 26 CFR 20.2010-3(b)(2): W's remaining exclusion $8,120,000 = $3,000,000 + $5,120,000; at death $5,430,000 + $4,000,000.
    assert (5000000 - 2000000) + BASIC_EXCLUSION[2012] == 8120000 and BASIC_EXCLUSION[2015] + 2000000 + 2000000 == 9430000

    # Proposed 1.529-5(b)(2)(v) example (exclusion $10,000 in Years 1-2, $12,000 from Year 3).
    ex = lambda y: F(10000) if y < 3 else F(12000)
    r = gift_ledger([{'year': 1, 'giver': 'A', 'to': 'C', 'amount': 60000, 'kind': '529', 'elect': True},
                     {'year': 3, 'giver': 'A', 'to': 'C', 'amount': 8000, 'kind': '529'}], mode='law', exclusion=ex)
    assert r['elections'][('A', 1, 'C')] == {'elected': 50000, 'excess': 10000, 'fifth': 10000}
    assert [r['over'][('A', y, 'C')] for y in (1, 2, 3, 4, 5)] == [10000, 0, 6000, 0, 0]   # "taxable gift of $10,000 in Year 1"; "remaining $6,000 is a taxable gift in Year 3"
    # 2008 advance notice, Examples A and B (exclusion $12,000 in 2007).
    ex12 = lambda y: F(12000)
    a = gift_ledger([{'year': 2007, 'giver': 'A', 'to': 'D', 'amount': 30000, 'kind': '529', 'elect': True}]
                    + [{'year': y, 'giver': 'A', 'to': 'D', 'amount': 6000} for y in range(2007, 2012)], mode='law', exclusion=ex12)
    assert a['elections'][('A', 2007, 'D')]['fifth'] == 6000 and a['used']['A'] == 0
    b = gift_ledger([{'year': 2007, 'giver': 'A', 'to': 'D', 'amount': 65000, 'kind': '529', 'elect': True}], mode='law', exclusion=ex12)
    assert b['elections'][('A', 2007, 'D')]['excess'] == 5000 and b['used']['A'] == 5000
    # Form 709 instructions (2025), Line B, Pat: $100,000 to a 529 for Max in 2025, $20,000 cash to Alex in 2026.
    p = gift_ledger([{'year': 2025, 'giver': 'A', 'to': 'Max', 'amount': 100000, 'kind': '529', 'elect': True},
                     {'year': 2026, 'giver': 'A', 'to': 'Alex', 'amount': 20000}], mode='law')
    assert p['counted'][('A', 2025, 'Max')] == 24000                     # "$5,000 + $19,000 = $24,000"
    assert p['counted'][('A', 2026, 'Max')] == 19000 and p['counted'][('A', 2026, 'Alex')] == 20000
    assert sorted(p['filers']) == [2025, 2026]                           # "not required to file Form 709 in any of those years" (2027-2029)
    # A 529 contribution not above the exclusion cannot be spread under the law (529(c)(2)(B) "exceeds").
    s = gift_ledger([{'year': 2026, 'giver': 'A', 'to': 'K', 'amount': 15000, 'kind': '529', 'elect': True}], mode='law')
    assert s['elections'] == {} and s['form709_years'] == [] and s['filers'] == {}
    sp = gift_ledger([{'year': 2026, 'giver': 'A', 'to': 'K', 'amount': 15000, 'kind': '529', 'elect': True}], mode='page')
    assert sp['elections'][('A', 2026, 'K')]['fifth'] == 3000 and sp['form709_years'] == [2026]

    # 26 CFR 25.6019-2 (written with a $10,000 exclusion): consent signified, who files.
    ex10 = lambda y: F(10000)
    one = gift_ledger([{'year': 1990, 'giver': 'A', 'to': 'child', 'amount': 18000, 'split': True}], 'law', ex10)
    assert one['filers'][1990] == {'A'}                                   # "only the first spouse is required to file"
    two = gift_ledger([{'year': 1990, 'giver': 'A', 'to': 'child', 'amount': 18000, 'split': True},
                       {'year': 1990, 'giver': 'B', 'to': 'child', 'amount': 2500}], 'law', ex10)
    assert two['filers'][1990] == {'A', 'B'}                              # "in excess of $2,000 to the same child"
    big = gift_ledger([{'year': 1990, 'giver': 'A', 'to': 'child', 'amount': 21000, 'split': True}], 'law', ex10)
    assert big['filers'][1990] == {'A', 'B'}                              # "had amounted to $21,000"
    # Form 709 instructions (2025) Exceptions 1 and 2: only the donor spouse files.
    e1 = gift_ledger([{'year': 2025, 'giver': 'A', 'to': 'X', 'amount': 38000, 'split': True}], 'law')
    assert e1['filers'][2025] == {'A'} and e1['used'] == {'A': 0, 'B': 0}
    e2 = gift_ledger([{'year': 2025, 'giver': 'A', 'to': 'X', 'amount': 38000, 'split': True},
                      {'year': 2025, 'giver': 'B', 'to': 'Y', 'amount': 19000}], 'law')
    assert e2['filers'][2025] == {'A'}
    # Where the regulation and the instructions part: B gives $1,500 to A's donee. CFR60192: after splitting B's gifts
    # are excluded (9,000 + 750), so B need not file; I709 Exception 2 needs different donees. The key follows the regulation.
    edge = gift_ledger([{'year': 1990, 'giver': 'A', 'to': 'child', 'amount': 18000, 'split': True},
                        {'year': 1990, 'giver': 'B', 'to': 'child', 'amount': 1500}], 'law', ex10)
    assert edge['counted'][('B', 1990, 'child')] == 9750 and edge['filers'][1990] == {'A'}

    # Gift tax once the exemption is used up (2026, one giver): $16,000,000 over -> 40% of $1,000,000.
    assert gift_tax_by_year({2026: 16000000}) == {2026: 400000}
    assert gift_tax_by_year({2025: 13000000, 2026: 3000000}) == {2025: 0, 2026: 400000}   # 2025 credit 5,145,800; 2026 credit left 800,000 of 1,200,000
    assert estate_return_required(15000001, 0, 2026) and not estate_return_required(15000000, 0, 2026)
    assert estate_return_required(14000000, 2000000, 2026) and estate_return_required(1, 0, 2026, electing_portability=True)

    _check_examples()


# ---- RULES.md worked examples (invented households) ----------------------------------------------
def _check_examples():
    # 9.1 Morgan, single, dies in 2026: estate $18,000,000, $1,000,000 to charity, $2,500,000 lifetime taxable gifts.
    m = single_estate_tax(18000000, charity=1000000, lifetime_taxable_gifts=2500000, year=2026)
    assert m['taxable_estate'] == 17000000 and m['base'] == 19500000
    assert m['tentative_tax'] == 7745800 and m['credit'] == 5945800 and m['tax'] == 1800000
    assert single_estate_tax(18000000, 1000000, 2500000, year=2025)['tax'] == 2204000
    assert single_estate_tax(18000000, 1000000, 2500000, year=2024)['tax'] == 2356000
    assert single_estate_tax(12000000, 0, 3000000, year=2026)['tax'] == 0          # exactly at the exemption
    assert single_estate_tax(9000000, 0, 0, year=2026)['tax'] == 0                  # under it: zero, never negative
    # Same person with $16,000,000 of lifetime gifts (gift tax $400,000 paid in 2026) and a $5,000,000 estate.
    pg = single_estate_tax(5000000, 0, 16000000, 2026)
    lw = single_estate_tax(5000000, 0, 16000000, 2026, gift_tax_payable=400000)
    assert pg['tax'] == 2400000 and lw['tax'] == 2000000
    assert single_estate_tax(5400000, 0, 16000000, 2026, gift_tax_payable=400000)['tax'] == 2160000   # 2035(b) adds the 00,000 back

    # 9.2 Jordan (A) and Casey (B), 2026, estate $40,000,000, lifetime taxable gifts A $3,000,000, B $1,000,000.
    pp = couple_estate_tax(40000000, 3000000, 1000000)
    assert (pp['dsue_a'], pp['dsue_b'], pp['dsue_used'], pp['gifts_added']) == (12000000, 14000000, 12000000, 3000000)
    assert pp['base'] == 43000000 and pp['applicable_exclusion'] == 27000000 and pp['tax'] == 6400000
    assert couple_estate_tax(40000000, 3000000, 1000000, method='A_first')['tax'] == 5600000
    assert couple_estate_tax(40000000, 3000000, 1000000, method='B_first')['tax'] == 5600000
    assert couple_estate_tax(40000000, 3000000, 1000000, portability=False)['tax'] == 11200000
    assert couple_estate_tax(40000000, 3000000, 1000000, portability=False, method='A_first')['tax'] == 10400000
    assert couple_estate_tax(40000000, 3000000, 1000000, portability=False, method='B_first')['tax'] == 11200000
    assert couple_estate_tax(28000000, 0, 0)['tax'] == 0 and couple_estate_tax(28000000, 0, 0, portability=False)['tax'] == 5200000
    for est in (0, 1000000, 16000000, 27000000, 31000000, 60000000):   # the page's figure is never below either real order
        for port in (True, False):
            page = couple_estate_tax(est, 3000000, 1000000, portability=port)['tax']
            assert page >= couple_estate_tax(est, 3000000, 1000000, portability=port, method='A_first')['tax']
            assert page >= couple_estate_tax(est, 3000000, 1000000, portability=port, method='B_first')['tax']

    # 9.3 Split gift, 2026: Jordan (A) gives a daughter $38,000 from A's own account, marked split.
    s = gift_ledger([{'year': 2026, 'giver': 'A', 'to': 'daughter', 'amount': 38000, 'split': True}])
    assert s['over'] == {('A', 2026, 'daughter'): 0, ('B', 2026, 'daughter'): 0} and s['form709_years'] == [2026]
    assert gift_ledger([{'year': 2026, 'giver': 'A', 'to': 'daughter', 'amount': 38000, 'split': True}], 'law')['filers'] == {2026: {'A'}}
    ns = gift_ledger([{'year': 2026, 'giver': 'A', 'to': 'daughter', 'amount': 38000}])
    assert ns['used'] == {'A': 19000, 'B': 0} and exemption_left(ns['used']['A']) == 14981000
    assert exemption_left(15981000) == 0 and exemption_left(15000000) == 0   # used up: 0 left, never negative
    s40 = gift_ledger([{'year': 2026, 'giver': 'both', 'to': 'daughter', 'amount': 40000}], 'law')
    assert s40['used'] == {'A': 1000, 'B': 1000} and s40['filers'] == {2026: {'A', 'B'}}

    # 9.4 529 over the cap: Casey (B) puts $120,000 in a 529 for a grandson in 2026 and elects; $5,000 cash in 2027.
    q = [{'year': 2026, 'giver': 'B', 'to': 'grandson', 'amount': 120000, 'kind': '529', 'elect': True},
         {'year': 2027, 'giver': 'B', 'to': 'grandson', 'amount': 5000}]
    for mode in ('page', 'law'):
        r = gift_ledger(q, mode)
        assert r['elections'][('B', 2026, 'grandson')] == {'elected': 95000, 'excess': 25000, 'fifth': 19000}
        assert [r['counted'][('B', y, 'grandson')] for y in range(2026, 2031)] == [44000, 24000, 19000, 19000, 19000]
        assert [r['over'][('B', y, 'grandson')] for y in range(2026, 2031)] == [25000, 5000, 0, 0, 0]
        assert r['used']['B'] == 30000 and exemption_left(r['used']['B']) == 14970000
        assert r['form709_years'] == [2026, 2027]
    assert gift_ledger(q, 'law')['filers'] == {2026: {'B'}, 2027: {'B'}}
    # The same $120,000 given "from both": $60,000 each, each elects, $12,000 a year each, nothing over.
    qb = gift_ledger([{'year': 2026, 'giver': 'both', 'to': 'grandson', 'amount': 120000, 'kind': '529', 'elect': True}], 'law')
    assert qb['elections'][('A', 2026, 'grandson')]['fifth'] == 12000 and qb['used'] == {'A': 0, 'B': 0}
    assert qb['form709_years'] == [2026] and qb['filers'] == {2026: {'A', 'B'}}

    # 9.5 One gift marked split, other gifts not (2026): A gives a son $38,000 (split), A gives a nephew $50,000,
    # B gives a friend $25,000.
    mix = [{'year': 2026, 'giver': 'A', 'to': 'son', 'amount': 38000, 'split': True},
           {'year': 2026, 'giver': 'A', 'to': 'nephew', 'amount': 50000},
           {'year': 2026, 'giver': 'B', 'to': 'friend', 'amount': 25000}]
    pg = gift_ledger(mix, 'page')
    assert pg['over'][('A', 2026, 'nephew')] == 31000 and pg['over'][('B', 2026, 'friend')] == 6000
    assert pg['used'] == {'A': 31000, 'B': 6000}
    lw = gift_ledger(mix, 'law')
    assert lw['counted'][('A', 2026, 'nephew')] == 25000 and lw['counted'][('B', 2026, 'friend')] == 12500
    assert lw['used'] == {'A': 6000, 'B': 6000} and lw['filers'] == {2026: {'A', 'B'}}
    assert exemption_left(pg['used']['A']) == 14969000 and exemption_left(lw['used']['A']) == 14994000


check_tables()
