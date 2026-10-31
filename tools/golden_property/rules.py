"""US rules for the answer key of two property pages, "Rental analysis" and "Home" (with the federal tax on selling it),
tax years 2025 and 2026, as data plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or tests/*.test.mjs
while writing this file, and it never imports or runs the app. Only the layout and conventions of tools/golden_tax_lots/
and tools/golden_estimated/ were looked at; no figure or code is shared with them. The federal brackets, standard
deductions and 0/15/20% breakpoints were read in the revenue procedures themselves and agree with
tests/golden/taxes/RULES.md (FEDKEY) and tests/golden/tax-lots/RULES.md s.5.1 (TLKEY), which are cited for them. Every
figure names its source and the date it was read on the same line. Money is an exact Fraction while it is worked and a
Decimal when it is shown. Importing this file runs check_tables().

The model (the pages' documented conventions; where the law says otherwise the key follows the law in the main columns
and keeps the page's way in a contrast column, see tests/golden/property/RULES.md):
  RENTAL    per rental (page): rent = 12 x monthly; vacancy; income; running costs (opex); NOI; cap rate; the loan year (12
            monthly payments from today's balance); cash flow; cash-on-cash; DSCR; break-even occupancy; one-percent;
            equity, growth, total return, return on equity.
  DEPREC    basis = price x (1 - land share) + improvements; straight line over 27.5 years, mid-month convention
            (168(b)(3)(B), (c), (d)(2), (d)(4)(B)): year 1 x (12 - month + 0.5) / 12, the last year takes what is left. This
            exact formula is the law's main column and equals the page's. Pub. 946 Table A-6 (rounded percentages) is a
            contrast column; table_a6_rebuilt() rebuilds the printed table exactly and the two differ by at most
            0.000636 percentage points of basis in a year.
  PASSIVE   law (469(d)(1), (i), (j)(4); 1.469-1T(f)(2); Form 8582): rentals with income absorb the other rentals' losses
            first; the passive activity loss (the excess) is allowed up to the special allowance ($25,000 less 50% of
            modified AGI over $100,000; married filing separately: $12,500 / $50,000 only when the spouses lived apart all
            year, otherwise none); the rest is suspended; allowed and suspended losses are spread over the loss rentals pro
            rata. Page: each rental alone, the allowance used by the rentals in order, no netting, $12,500 / $50,000 for
            every separate return.
  TAX A     law: federal tax (income tax + NIIT) with the allowed net rental result added to wages, minus without; net
            rental income is net investment income (1411(c)(1)(A)(i)); MAGI includes it. Page: per rental taxable x the
            marginal rate (taxable >= 0), else -(usable loss) x the marginal rate; marginal rate from $1,000 more ordinary
            non-wage, non-investment income.
  HOME      page: equity, LTV, growth since bought, the year's costs, values in 5/10/20 years, the sale today with the
            exclusion always applied and a flat 15% / 20% + 3.8% rate. Law: 121(a) 2-of-5-years test (730 days or 24 full
            months, 1.121-1(c)(1)); $250,000 / $500,000 (121(b)); the reduced maximum exclusion of 121(c) as a contrast
            (1.121-3(g)); long-term only when held more than 1 year (1222); the tax = federal tax with the taxable gain minus
            without, the gain stacked at 0/15/20% through the year's own breakpoints (or ordinary when short-term), NIIT on
            the lesser of the taxable gain and MAGI over the threshold (the excluded part is not NII, 1.1411-4(d)(3)(ii)
            Example 3).

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits). The U.S. Code pages are the OLRC
edition "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t26/s<N>/:
  USC121   26 U.S.C. 121(a), (b)(1)-(3), (c)(1)-(2), (d)(1), (d)(6) (last amended Pub. L. 115-97, 2017)   (25821328...2beca3d1c9)
  USC168   26 U.S.C. 168(a), (b)(3)(B), (b)(4), (c), (d)(2), (d)(4)(B), (e)(2)(A), (i)(6) (Pub. L. 119-21 amended (k) and
           (e)(3) only)   (b61ed81b...93f38b0cac)
  USC469   26 U.S.C. 469(a), (b), (c)(2), (c)(7), (d)(1), (i)(1)-(3), (i)(5), (i)(6), (j)(4), (j)(8) (last amended Pub. L.
           117-2, 2021; the modified-AGI rule is now (i)(3)(E), redesignated from (F) by Pub. L. 115-141)   (30b8eb12...cc7e51c01e)
  USC1222  26 U.S.C. 1222(1)-(4) "not more than 1 year" / "more than 1 year"   (608100ea...b0cae9749a)
  USC1411  26 U.S.C. 1411(a)(1), (b), (c)(1)-(2), (d)   (89721b18...741beafb33)
  The regulations are eCFR title 26 "up to date as of 2026-10-29" (https://www.ecfr.gov/api/versioner/v1/titles.json,
  b649b378...71de4d4618), read as XML from https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>
  (human page https://www.ecfr.gov/current/title-26/section-<N>):
  CFR1211  26 CFR 1.121-1(a), (c)(1), (c)(4) Example 3 [T.D. 9030, 67 FR 78361, Dec. 24, 2002]   (faf3e310...287e30bab2)
  CFR1213  26 CFR 1.121-3(a), (b), (g)(1)-(2) Examples 1-2 [T.D. 9030; T.D. 9152, 69 FR 50304]   (d16eee79...f4555a8465)
  CFR14691 26 CFR 1.469-1T(f)(2)(i)(A)-(B), (D) Example 1 (ratable allocation of the disallowed loss)   (13ccf2f7...449e2771f8)
  CFR14692 26 CFR 1.469-2T(b)(1) (passive activity loss = deductions over gross income)   (c4735b5d...00dc2bf53e)
  CFR14694 26 CFR 1.469-4(a), (c)(1)-(2) (grouping of activities; read for convention G1 only)   (2f236368...b59077fe91)
  CFR14114 26 CFR 1.1411-4(a)(1)(i), (a)(2), (d)(3)(i), (d)(3)(ii) Example 3, (f)(1)(ii), (f)(2)(i)
           [T.D. 9644, 78 FR 72424]   (76523685...59598039aa)
  P523     Publication 523 (2025) "Selling Your Home" (PDF of 2026-02-27): Eligibility Steps 2-3, Home's date of sale,
           Worksheet 1 section B (partial exclusion), Worksheet 2 line 7, Reporting recognized gain
           https://www.irs.gov/pub/irs-pdf/p523.pdf   (f11fca89...9a754f736b)
  P527     Publication 527 (2025) "Residential Rental Property" (PDF of 2026-01-08): Rental Expenses, Types of Expenses,
           Interest expense, Condominiums, Land, Additions or improvements, Separating cost of land and buildings,
           Table 2-2d and its example, Exception for Rental Real Estate With Active Participation
           https://www.irs.gov/pub/irs-pdf/p527.pdf   (20c826e9...ff651201d6)
  P925     Publication 925 (2025) "Passive Activity and At-Risk Rules" (PDF of 2026-02-24): Identification of Disallowed
           Passive Activity Deductions (Terry), Special $25,000 allowance and its examples, Phaseout rule and the 2025
           example, modified AGI list   https://www.irs.gov/pub/irs-pdf/p925.pdf   (dda751f0...6137cda5d3)
  P946     Publication 946 (2025) "How To Depreciate Property" (PDF of 2026-03-13): Table 4-1, Using the MACRS Percentage
           Tables (rules 1-4), Figuring the Deduction Without Using the Tables (Straight line rate, Mid-month convention),
           the July 2023 disposal example, Appendix A Table A-6 (p.73)
           https://www.irs.gov/pub/irs-pdf/p946.pdf   (07fadfb2...1b9b5904c4)
  I8582    Instructions for Form 8582 (2025) (PDF of 2025-12-01): Exception, Special Allowance for Rental Real Estate
           Activities, Part II lines 4-9 (line 5 $75,000, line 6 modified AGI, line 8 $12,500), Parts IV, VI, VII, VIII
           https://www.irs.gov/pub/irs-pdf/i8582.pdf   (76787e11...29e6035f71)
  F8582    Form 8582 (2025) Parts I-VIII   https://www.irs.gov/pub/irs-pdf/f8582.pdf   (d929884f...9501080537)
  P550     Publication 550 (2025), Holding Period (long-term "more than 1 year"; counting from the day after)
           https://www.irs.gov/pub/irs-pdf/p550.pdf   (83552968...92c5574317)
  I1040    Instructions for Form 1040 (2025), Qualified Dividends and Capital Gain Tax Worksheet-Line 16 (p.38)
           https://www.irs.gov/pub/irs-pdf/i1040gi.pdf   (482e9c48...590468364a)
  I8960    Instructions for Form 8960 (2025), Line 4a (Schedule 1 line 5 rental income or loss), Line 13 (MAGI = AGI)
           https://www.irs.gov/pub/irs-pdf/i8960.pdf   (b10fbb23...7867376428)
  RP2440   Rev. Proc. 2024-40, s.2.01 Tables 1-4 (2025 brackets and "The Tax Is" amounts), s.2.03 (2025 0%/15% tops)
           https://www.irs.gov/pub/irs-drop/rp-24-40.pdf   (4de9db6b...d4c302af1f)
  RP2532   Rev. Proc. 2025-32, s.3.01 (2025 standard deduction as amended), s.4.01 Tables 1-4 (2026), s.4.03 (2026 tops),
           s.4.14(1) (2026 standard deduction)   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf   (e9ada115...a96214635b)
  FEDKEY   tests/golden/taxes/RULES.md sections 1, 2, 5, 8 (this repo), cited for the federal figures   (96ddcd2f...6c4c6adeb7)
  TLKEY    tests/golden/tax-lots/RULES.md sections 3, 5.1, 5.2, 6 (R2) (this repo), cited for the federal figures, the
           holding-period rule and the rounding convention R2   (7e1afebd...e254d55a88)

NOT VERIFIED on any official source (the key states its own convention):
  - The 2026 Pubs. 523, 527, 925, 946 and the 2026 Form 8582 instructions do not exist yet; the 2025 editions are applied
    to 2026 rows (121, 168(b)-(d), 469 and 1411 have no Pub. L. 119-21 or later amendment touching these rules).
  - Rev. Rul. 66-7 (a purchase on the last day of a month is held more than a year from the first day of the 13th month
    after) was not re-read for this key; its rule is taken from TLKEY s.3, which read it in a secondary copy. It cannot
    change a 2025 or 2026 sale date's term here (see first_long_day()).
  - The rounding rule that rebuilds Table A-6 (year 1 and each later year's rate = unrecovered percentage / remaining
    recovery period, rounded half up to 0.001%; the year with less than one year left takes the rest) is the key's
    finding: it reproduces all 342 printed entries, but no source read states it. Rev. Proc. 87-57 (which prescribes the
    tables) was not read.
  - Section 199A (qualified business income deduction) for rental income, the at-risk rules (465), net operating losses
    (172) and the alternative minimum tax (55) are not modelled.
  - The page's own definitions where the brief leaves room: what "whole months owned" means (convention M1, with M2 and
    M3 as alternatives for the comparison), whether its rates come from totals rounded to the cent (R2, inherited from
    TLKEY's comparison with another page, not checked on these pages), what "federal taxable income" is in the home sale
    test (convention H6).
  - FINDING on the brief: it cites "469(i)(3)(F) modified AGI"; since Pub. L. 115-141 (2018) that paragraph is (i)(3)(E).
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from datetime import date, timedelta
from decimal import Decimal as D, localcontext
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CENT = F(1, 100)
RATE_PLACES = 6         # brief: "rates and ratios to six decimals"; no legal source; read 2026-10-31


# ---- exact arithmetic helpers ---------------------------------------------------------------------
def _F(x):
    """Exact Fraction from an int, str, Decimal or Fraction. Floats are refused (they are not exact)."""
    if isinstance(x, float):
        raise TypeError('pass money as str, int, Decimal or Fraction, never float')
    if isinstance(x, F):
        return x
    if isinstance(x, (int, D)):
        return F(x)
    return F(D(str(x).strip().replace(',', '').replace('$', '')))


def _opt(x):
    """None or blank stays None; anything else becomes an exact Fraction. A typed 0 is 0, not blank."""
    return None if x is None or (isinstance(x, str) and x.strip() == '') else _F(x)


def _or(x, default):
    """The brief's blanks: a blank takes the page's default, a typed value (0 included) is kept."""
    v = _opt(x)
    return _F(default) if v is None else v


def _d(x):
    """A date from a date or 'YYYY-MM-DD'; None for blank."""
    if x is None or isinstance(x, date):
        return x
    s = str(x).strip()
    return None if s == '' else date.fromisoformat(s)


def _ym(x):
    """(year, month) from a date, 'YYYY-MM' or 'YYYY-MM-DD' (the rental's month placed in service)."""
    if isinstance(x, date):
        return x.year, x.month
    s = str(x).strip()
    y, m = int(s[0:4]), int(s[5:7])
    if not 1 <= m <= 12:
        raise ValueError('bad month in %r' % x)
    return y, m


def round_half_up(x, quantum=CENT):
    """Round x to a multiple of quantum, halves away from zero (the key's display convention)."""
    x, q = _F(x), _F(quantum)
    n = abs(x) / q
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)  # floor(n + 1/2)
    return (k * q) if x >= 0 else -(k * q)


def show(x):
    """Money for display: Decimal rounded half up to the cent (brief: "Money to the cent")."""
    if x is None:
        return None
    r = round_half_up(x, CENT)
    return (D(r.numerator) / D(r.denominator)).quantize(D('0.01'))


def show_rate(x):
    """A rate or ratio for display: Decimal rounded half up to six decimals (brief: "rates and ratios to six decimals")."""
    if x is None:
        return None
    q = F(1, 10 ** RATE_PLACES)
    r = round_half_up(_F(x), q)
    return (D(r.numerator) / D(r.denominator)).quantize(D(1).scaleb(-RATE_PLACES))


def _div(a, b):
    """a / b, or None when b is 0 (a ratio with no denominator is blank)."""
    return None if b == 0 else _F(a) / _F(b)


STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
TAX_YEARS = (2025, 2026)  # brief: "tax_year 2025 or 2026 and today (a day of that year)"

# =====================================================================================================
# 1. Federal figures (brief: brackets, standard deductions, 0/15/20% breakpoints, NIIT for 2025 and 2026)
# =====================================================================================================
RATES = (10, 12, 22, 24, 32, 35, 37)  # RP2440 s.2.01 / RP2532 s.4.01 Tables 1-4 "10% ... 37%"; FEDKEY s.1; read 2026-10-31
BRACKET_TOPS = {
    2025: {
        'married_joint':     (23850, 96950, 206700, 394600, 501050, 751600),   # RP2440 s.2.01 Table 1; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
        'head_of_household': (17000, 64850, 103350, 197300, 250500, 626350),   # RP2440 s.2.01 Table 2; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
        'single':            (11925, 48475, 103350, 197300, 250525, 626350),   # RP2440 s.2.01 Table 3; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
        'married_separate':  (11925, 48475, 103350, 197300, 250525, 375800),   # RP2440 s.2.01 Table 4; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
    },
    2026: {
        'married_joint':     (24800, 100800, 211400, 403550, 512450, 768700),  # RP2532 s.4.01 Table 1; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
        'head_of_household': (17700, 67450, 105700, 201750, 256200, 640600),   # RP2532 s.4.01 Table 2; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
        'single':            (12400, 50400, 105700, 201775, 256225, 640600),   # RP2532 s.4.01 Table 3; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
        'married_separate':  (12400, 50400, 105700, 201775, 256225, 384350),   # RP2532 s.4.01 Table 4; FEDKEY s.1 and TLKEY s.5.1 agree; read 2026-10-31
    },
}
RP_BASE = {  # "The Tax Is: $Z plus N% of the excess" as printed; check_tables() rebuilds every one from the tops
    2025: {
        'married_joint':     ('0', '2385', '11157', '35302', '80398', '114462', '202154.50'),     # RP2440 s.2.01 Table 1; read 2026-10-31
        'head_of_household': ('0', '1700', '7442', '15912', '38460', '55484', '187031.50'),       # RP2440 s.2.01 Table 2; read 2026-10-31
        'single':            ('0', '1192.50', '5578.50', '17651', '40199', '57231', '188769.75'), # RP2440 s.2.01 Table 3; read 2026-10-31
        'married_separate':  ('0', '1192.50', '5578.50', '17651', '40199', '57231', '101077.25'), # RP2440 s.2.01 Table 4; read 2026-10-31
    },
    2026: {
        'married_joint':     ('0', '2480', '11600', '35932', '82048', '116896', '206583.50'),     # RP2532 s.4.01 Table 1; read 2026-10-31
        'head_of_household': ('0', '1770', '7740', '16155', '39207', '56631', '191171'),          # RP2532 s.4.01 Table 2; read 2026-10-31
        'single':            ('0', '1240', '5800', '17966', '41024', '58448', '192979.25'),       # RP2532 s.4.01 Table 3; read 2026-10-31
        'married_separate':  ('0', '1240', '5800', '17966', '41024', '58448', '103291.75'),       # RP2532 s.4.01 Table 4; read 2026-10-31
    },
}
STANDARD_DEDUCTION = {
    2025: {'married_joint': 31500, 'head_of_household': 23625, 'single': 15750, 'married_separate': 15750},  # RP2532 s.3.01 ("$31,500 / $23,625 / $15,750 / $15,750"; "section 2.15(1) of Rev. Proc. 2024-40 is removed"); FEDKEY s.2, TLKEY s.5.1 agree; read 2026-10-31
    2026: {'married_joint': 32200, 'head_of_household': 24150, 'single': 16100, 'married_separate': 16100},  # RP2532 s.4.14(1) ("$32,200 / $24,150 / $16,100 / $16,100"); FEDKEY s.2, TLKEY s.5.1 agree; read 2026-10-31
}
CG_ZERO_TOP = {  # "Maximum Zero Rate Amount" (1(j)(5)(B)(i))
    2025: {'married_joint': 96700, 'married_separate': 48350, 'head_of_household': 64750, 'single': 48350},  # RP2440 s.2.03; I1040 QDCG worksheet line 6; FEDKEY s.5 agrees; read 2026-10-31
    2026: {'married_joint': 98900, 'married_separate': 49450, 'head_of_household': 66200, 'single': 49450},  # RP2532 s.4.03; FEDKEY s.5 agrees; read 2026-10-31
}
CG_15_TOP = {  # "Maximum 15% Rate Amount" (1(j)(5)(B)(ii)): above it, 20%
    2025: {'married_joint': 600050, 'married_separate': 300000, 'head_of_household': 566700, 'single': 533400},  # RP2440 s.2.03; I1040 QDCG worksheet line 13; FEDKEY s.5 agrees; read 2026-10-31
    2026: {'married_joint': 613700, 'married_separate': 306850, 'head_of_household': 579600, 'single': 545500},  # RP2532 s.4.03; FEDKEY s.5 agrees; read 2026-10-31
}
CG_RATES = (F(0), F(15, 100), F(20, 100))  # I1040 QDCG worksheet line 9 "taxed at 0%", line 18 "15% (0.15)", line 21 "20% (0.20)"; read 2026-10-31
NIIT_RATE = F(38, 1000)  # USC1411 (a)(1) "a tax equal to 3.8 percent of the lesser of"; read 2026-10-31
NIIT_THRESHOLD = {'married_joint': 250000, 'married_separate': 125000, 'single': 200000, 'head_of_household': 200000}  # USC1411 (b)(1) "$250,000", (b)(2) "1/2 of the dollar amount determined under paragraph (1)", (b)(3) "in any other case, $200,000"; not indexed; FEDKEY s.8 agrees; read 2026-10-31


def _check_year_status(year, status):
    if year not in TAX_YEARS:
        raise ValueError('%s: the key covers tax years 2025 and 2026' % year)
    if status not in STATUSES:
        raise ValueError('unknown filing status %r' % status)


def standard_deduction(year, status):
    return F(STANDARD_DEDUCTION[year][status])


def regular_tax(year, status, taxable_income):
    """Exact Tax Computation formula on the year's brackets, at every income (no Tax Table rounding under $100,000:
    FEDKEY s.1's convention "Tax is worked with the Tax Computation formula on exact amounts")."""
    x = max(F(0), _F(taxable_income))
    tax, lo = F(0), F(0)
    for top, pct in zip(BRACKET_TOPS[year][status] + (None,), RATES):
        hi = x if top is None else min(x, F(top))
        if hi > lo:
            tax += (hi - lo) * pct / 100
        if top is None or x <= top:
            break
        lo = F(top)
    return tax


def qdcg_tax(year, status, taxable_income, net_capital_gain):
    """I1040 Qualified Dividends and Capital Gain Tax Worksheet, lines 1-25 (no qualified dividends in these cases: line 2
    is 0), exact, with the formula tax on lines 22 and 24. Returns dict(line5, line9, line17, line20, tax)."""
    l1 = max(F(0), _F(taxable_income))
    l4 = max(F(0), _F(net_capital_gain))                  # line 2 = 0, line 3 = the net capital gain
    l5 = max(F(0), l1 - l4)
    l7 = min(l1, F(CG_ZERO_TOP[year][status]))            # line 6 = the 0% top
    l9 = l7 - min(l5, l7)                                 # "This amount is taxed at 0%"
    l10 = min(l1, l4)
    l12 = l10 - l9
    l14 = min(l1, F(CG_15_TOP[year][status]))             # line 13 = the 15% top
    l16 = max(F(0), l14 - (l5 + l9))
    l17 = min(l12, l16)                                   # taxed at 15%
    l20 = l10 - (l9 + l17)                                # taxed at 20%
    l23 = CG_RATES[1] * l17 + CG_RATES[2] * l20 + regular_tax(year, status, l5)
    l25 = min(l23, regular_tax(year, status, l1))         # "Enter the smaller of line 23 or line 24"
    return {'line5': l5, 'line9': l9, 'line17': l17, 'line20': l20, 'tax': l25}


def niit(status, magi, nii):
    """USC1411(a)(1): 3.8% of the lesser of net investment income and MAGI over the threshold; MAGI = AGI (USC1411(d);
    I8960 Line 13: no foreign earned income, no CFC or PFIC)."""
    return NIIT_RATE * min(max(F(0), _F(nii)), max(F(0), _F(magi) - NIIT_THRESHOLD[status]))


def federal_tax(year, status, wages, other_ordinary=0, lt_gain=0, st_gain=0, nii=0):
    """The case's federal tax for the year: one adult under 65, no dependents, the standard deduction, wages plus
    `other_ordinary` (e.g. the allowed net rental result, either sign), plus a long-term or short-term gain (>= 0).
    Income tax (the QDCG worksheet when there is a long-term gain, else the brackets) + NIIT on `nii`. No credits, no
    AMT, no additional Medicare tax (on wages only: it is the same with and without the rentals or the sale and cancels
    in every difference the key takes). Exact; nothing rounded."""
    _check_year_status(year, status)
    w, o, lt, st = _F(wages), _F(other_ordinary), _F(lt_gain), _F(st_gain)
    if w < 0 or lt < 0 or st < 0:
        raise ValueError('wages and gains are never negative in the case')
    agi = w + o + lt + st
    ti = max(F(0), agi - standard_deduction(year, status))
    income_tax = qdcg_tax(year, status, ti, lt)['tax'] if lt > 0 else regular_tax(year, status, ti)
    n = niit(status, agi, nii)
    return {'agi': agi, 'taxable_income': ti, 'income_tax': income_tax, 'niit': n, 'total': income_tax + n}


# =====================================================================================================
# 2. Page A: one rental's money (page convention; the law has no counterpart for these figures)
# =====================================================================================================
MONTHS_A_YEAR = 12                 # brief: "rent = rent_monthly x 12", "hoa x 12", "the loan year = 12 monthly payments"; read 2026-10-31
DEFAULT_LAND_SHARE = F(20, 100)    # brief: "land_share (blank = 20%)"; a page convention (P527: "the ratio of the FMV of that asset to the FMV of the whole property"); read 2026-10-31
DEFAULT_VACANCY = F(5, 100)        # brief: "vacancy (blank = 5%)"; read 2026-10-31
DEFAULT_MAINTENANCE = F(1, 100)    # brief: "maintenance (share of value a year; blank = 1%)"; read 2026-10-31
DEFAULT_MANAGEMENT = F(0)          # brief: "management (share of collected rent; blank = 0)"; read 2026-10-31
DEFAULT_APPRECIATION = F(35, 1000) # brief: "appreciation (blank = 3.5%)" (both pages); read 2026-10-31
DEFAULT_SELL_SHARE = F(6, 100)     # brief (page B): "sell_costs share (blank = 6%)"; read 2026-10-31
LOAN_STOP = F(5, 1000)             # brief: "stopping once the balance is 0.005 or less"; read 2026-10-31


def loan_year(balance, annual_rate, payment):
    """Brief (both pages): 12 monthly payments from today's balance. Each month: interest = balance x rate / 12; payment
    = min(payment, balance + interest); balance = balance + interest - payment; stop once the balance is 0.005 or less.
    debt service = payments made; interest = the sum of interest, at most what was paid; principal = paid - interest.
    No loan (all blank): None."""
    b, r, p = _opt(balance), _opt(annual_rate), _opt(payment)
    if b is None and r is None and p is None:
        return None
    b, r, p = b or F(0), r or F(0), p or F(0)
    if b < 0 or r < 0 or p < 0:
        raise ValueError('loan figures are never negative')
    paid = interest = F(0)
    months = 0
    for _ in range(MONTHS_A_YEAR):
        if b <= LOAN_STOP:
            break
        i = b * r / MONTHS_A_YEAR
        pay = min(p, b + i)
        b = b + i - pay
        paid += pay
        interest += i
        months += 1
    interest = min(interest, paid)
    return {'debt_service': paid, 'interest': interest, 'principal': paid - interest, 'end_balance': b, 'months': months}


def rental_money(r):
    """Brief, page A, per rental (page convention). `r` is a dict of the CSV fields; shares are decimals (0.05 = 5%).
    Returns every money figure and ratio, exact; a ratio with a zero denominator is None."""
    price, value = _F(r['purchase_price']), _F(r['value'])
    rent = _F(r['rent_monthly']) * MONTHS_A_YEAR
    vacancy = rent * _or(r.get('vacancy'), DEFAULT_VACANCY)
    income = rent - vacancy
    maint = value * _or(r.get('maintenance'), DEFAULT_MAINTENANCE)
    mgmt = income * _or(r.get('management'), DEFAULT_MANAGEMENT)
    opex = (_or(r.get('property_tax'), 0) + _or(r.get('insurance'), 0) + _or(r.get('hoa_monthly'), 0) * MONTHS_A_YEAR
            + maint + mgmt + _or(r.get('utilities_monthly'), 0) * MONTHS_A_YEAR + _or(r.get('other_monthly'), 0) * MONTHS_A_YEAR)
    noi = income - opex
    loan = loan_year(r.get('loan_balance'), r.get('loan_rate'), r.get('loan_payment'))
    ds = loan['debt_service'] if loan else F(0)
    interest = loan['interest'] if loan else F(0)
    principal = loan['principal'] if loan else F(0)
    balance = _F(r.get('loan_balance') or 0) if loan else F(0)
    cash_flow = noi - ds
    cash_in = _opt(r.get('cash_in'))
    equity = value - balance
    growth = value * _or(r.get('appreciation'), DEFAULT_APPRECIATION)
    total_return = cash_flow + principal + growth
    return {'rent': rent, 'vacancy': vacancy, 'income': income, 'maintenance': maint, 'management': mgmt, 'opex': opex,
            'noi': noi, 'cap_rate': _div(noi, value), 'loan': loan, 'debt_service': ds, 'interest': interest,
            'principal': principal, 'cash_flow': cash_flow,
            'cash_on_cash': None if not cash_in else cash_flow / cash_in,        # blank cash_in = none (brief)
            'dscr': None if (loan is None or ds == 0) else noi / ds,              # "none without a loan" (brief)
            'break_even': _div(opex + ds, rent), 'one_percent': _div(_F(r['rent_monthly']), price),
            'equity': equity, 'growth': growth, 'total_return': total_return,
            'roe': None if equity <= 0 else total_return / equity}                 # convention E1: blank when equity <= 0


# =====================================================================================================
# 3. Depreciation of residential rental property (law = page's exact formula; Table A-6 as a contrast)
# =====================================================================================================
RECOVERY_YEARS = F(55, 2)   # USC168 (c) "Residential rental property 27.5 years"; P946 Table A-6 "Straight Line-27.5 Years"; read 2026-10-31
MID_MONTH = F(1, 2)         # USC168 (d)(2)(B) residential rental property: "the applicable convention is the mid-month convention"; (d)(4)(B) "as placed in service ... on the mid-point of such month"; P946 "the number of full months in the year that the property is in service plus 1/2 (or 0.5). The denominator is 12."; read 2026-10-31
# USC168 (b)(3)(B): straight line for "Residential rental property"; (b)(4) "Salvage value shall be treated as zero".
# P946 Straight line rate: "dividing the number 1 by the years remaining in the recovery period at the beginning of that
# year ... If the number of years remaining is less than 1, the depreciation rate for that tax year is 1.0 (100%)."
# P946 Mid-month convention: "the depreciation deduction for the year that includes the final month of the recovery
# period is the amount of your unrecovered basis in the property." Read 2026-10-31.
TABLE_A6_PRINTED = {  # P946 (2025) Appendix A, Table A-6 "Residential Rental Property, Mid-Month Convention, Straight Line-27.5 Years", percent of basis, columns = month placed in service 1..12, as printed (p.73); read 2026-10-31
    '1':   ('3.485', '3.182', '2.879', '2.576', '2.273', '1.970', '1.667', '1.364', '1.061', '0.758', '0.455', '0.152'),
    '2-9': ('3.636',) * 12,
    '10':  ('3.637',) * 6 + ('3.636',) * 6,
    '11':  ('3.636',) * 6 + ('3.637',) * 6,
    '12':  ('3.637',) * 6 + ('3.636',) * 6,
    '13':  ('3.636',) * 6 + ('3.637',) * 6,
    '14':  ('3.637',) * 6 + ('3.636',) * 6,
    '15':  ('3.636',) * 6 + ('3.637',) * 6,
    '16':  ('3.637',) * 6 + ('3.636',) * 6,
    '17':  ('3.636',) * 6 + ('3.637',) * 6,
    '18':  ('3.637',) * 6 + ('3.636',) * 6,
    '19':  ('3.636',) * 6 + ('3.637',) * 6,
    '20':  ('3.637',) * 6 + ('3.636',) * 6,
    '21':  ('3.636',) * 6 + ('3.637',) * 6,
    '22':  ('3.637',) * 6 + ('3.636',) * 6,
    '23':  ('3.636',) * 6 + ('3.637',) * 6,
    '24':  ('3.637',) * 6 + ('3.636',) * 6,
    '25':  ('3.636',) * 6 + ('3.637',) * 6,
    '26':  ('3.637',) * 6 + ('3.636',) * 6,
    '27':  ('3.636',) * 6 + ('3.637',) * 6,
    '28':  ('1.97', '2.273', '2.576', '2.879', '3.182', '3.485', '3.636', '3.636', '3.636', '3.636', '3.636', '3.636'),
    '29':  (None,) * 6 + ('0.152', '0.455', '0.758', '1.061', '1.364', '1.667'),
}
A6_QUANTUM = F(1, 1000)     # Table A-6 prints percentages to 0.001 (one entry "1.97"); the key's rebuild rounds to 0.001%; read 2026-10-31


def table_a6(month):
    """The printed Table A-6 column for a month placed in service: tuple of Fractions (percent), recovery years 1..28/29."""
    col = []
    for label, row in TABLE_A6_PRINTED.items():
        years = range(2, 10) if label == '2-9' else (int(label),)
        for _ in years:
            v = row[month - 1]
            if v is not None:
                col.append(_F(v))
    return tuple(col)


def depreciable_basis(price, land_share, improvements):
    """Brief: price x (1 - land share) + improvements (land share blank = 20%). P527 Land: "You can't depreciate the cost
    of land"; Additions or improvements: "Add to the basis of your property the amount an addition or improvement
    actually costs you". The improvements join the building here (convention I1; the law depreciates each one from its
    own placed-in-service date: USC168 (i)(6)(B), P527 "Treat additions or improvements ... as separate property items")."""
    return _F(price) * (1 - _or(land_share, DEFAULT_LAND_SHARE)) + _or(improvements, 0)


def first_year_fraction(month):
    """USC168 (d)(4)(B), P946: (full months after the month placed in service + 1/2) / 12 = (12 - month + 0.5) / 12."""
    return (MONTHS_A_YEAR - month + MID_MONTH) / MONTHS_A_YEAR


def depreciation_exact(basis, placed_year, placed_month, tax_year):
    """The law's main column and the page's convention: straight line, 27.5 years, mid-month. Nothing before the year
    placed in service; the first year basis / 27.5 x (12 - month + 0.5) / 12; then basis / 27.5 a year; never beyond the
    basis (the last year takes what is left: P946 "the amount of your unrecovered basis")."""
    b = _F(basis)
    if tax_year < placed_year or b <= 0:
        return F(0)
    annual = b / RECOVERY_YEARS
    first = annual * first_year_fraction(placed_month)
    if tax_year == placed_year:
        return min(first, b)
    before = first + annual * (tax_year - placed_year - 1)
    return max(F(0), min(annual, b - before))


def depreciation_schedule_exact(basis, placed_year, placed_month):
    """{year: amount} from the year placed in service to the last year with a deduction."""
    out, y = {}, placed_year
    while True:
        a = depreciation_exact(basis, placed_year, placed_month, y)
        if a == 0 and y > placed_year:
            return out
        out[y] = a
        y += 1


def table_a6_rebuilt(month):
    """Key finding (NOT VERIFIED as the IRS's own rule; it reproduces every printed entry): year 1 = the exact first-year
    percentage rounded half up to 0.001%; each later year = (100% - the rounded percentages so far) / (recovery years left
    at the start of the year), rounded half up to 0.001%; when less than one year is left, the rest (P946 Straight line
    rate: "the depreciation rate for that tax year is 1.0 (100%)")."""
    out = [round_half_up(F(100) * first_year_fraction(month) / RECOVERY_YEARS, A6_QUANTUM)]
    rem = 100 - out[0]
    left = RECOVERY_YEARS - first_year_fraction(month)
    while rem > 0:
        r = rem if left <= 1 else min(rem, round_half_up(rem / left, A6_QUANTUM))
        out.append(r)
        rem -= r
        left -= 1
    return tuple(out)


def depreciation_table(basis, placed_year, placed_month, tax_year):
    """Contrast column: basis x the Table A-6 percentage for the recovery year (P946 rules: "You must apply the rates in
    the percentage tables to your property's unadjusted basis"; Table 2-2d of P527 is the same table, years 1-6)."""
    k = tax_year - placed_year + 1
    col = table_a6(placed_month)
    if k < 1 or k > len(col):
        return F(0)
    return _F(basis) * col[k - 1] / 100


# =====================================================================================================
# 4. Passive activity loss rules (law) and the page's allowance
# =====================================================================================================
SPECIAL_ALLOWANCE = 25000       # USC469 (i)(2) "shall not exceed $25,000"; I8582 "$25,000 for single individuals and married individuals filing a joint return"; P925; read 2026-10-31
PHASEOUT_START = 100000         # USC469 (i)(3)(A) "the amount by which the adjusted gross income of the taxpayer for the taxable year exceeds $100,000"; read 2026-10-31
PHASEOUT_RATE = F(1, 2)         # USC469 (i)(3)(A) "reduced (but not below zero) by 50 percent"; F8582 line 8 "Multiply line 7 by 50% (0.50)"; read 2026-10-31
MFS_ALLOWANCE = 12500           # USC469 (i)(5)(A)(i) "'$12,500' for '$25,000' each place it appears"; I8582 line 8 "Don't enter more than $12,500 ... if ... you and your spouse lived apart at all times during the year"; read 2026-10-31
MFS_PHASEOUT_START = 50000      # USC469 (i)(5)(A)(ii) "'$50,000' for '$100,000' in paragraph (3)(A)"; I8582 line 5 "$75,000 on line 5 instead of $150,000"; read 2026-10-31
# USC469 (i)(5)(B): "This subsection shall not apply to a taxpayer who (i) is a married individual filing a separate return
# for any taxable year, and (ii) does not live apart from his spouse at all times during such taxable year." F8582 Part I:
# "If your filing status is married filing separately and you lived with your spouse at any time during the year, do not
# complete Part II." P925: "you can't use the special allowance to reduce your nonpassive income". Read 2026-10-31.
# USC469 (d)(1): "The term 'passive activity loss' means the amount (if any) by which (A) the aggregate losses from all
# passive activities for the taxable year, exceed (B) the aggregate income from all passive activities for such year."
# USC469 (j)(4): "The passive activity loss ... (and the $25,000 amount under subsection (i)) shall be allocated to
# activities, and within activities, on a pro rata basis". CFR14691 (f)(2)(i)(A): "a ratable portion of the loss (if any)
# from each passive activity ... is disallowed ... multiplying the passive activity loss that is disallowed for the taxable
# year by the fraction obtained by dividing (1) The loss from the activity ... by (2) The sum of the losses for the taxable
# year from all activities having losses". I8582 Part VI column (b) "Divide each of the individual losses ... by the total
# of all the losses", column (c) "Multiply each ratio ... by the amount on Part II, line 9"; Part VII column (c) "Part I,
# line 3 ... Subtract line B [line 9] from line A". USC469 (b): the disallowed loss is "treated as a deduction ... allocable
# to such activity in the next taxable year". Read 2026-10-31.


def allowance_cap_law(status, lived_apart_all_year, magi):
    """USC469 (i)(2), (3)(A), (5); F8582 lines 5-8: the most of a passive activity loss from actively managed rental real
    estate that may offset other income this year. Modified AGI per USC469 (i)(3)(E) / I8582 line 6 ("Any passive activity
    loss as defined in section 469(d)(1)" is left out; here: the wages), "but not less than zero" (F8582 line 6)."""
    m = max(F(0), _F(magi))
    if status == 'married_separate':
        if not lived_apart_all_year:
            return F(0)
        cap, start = F(MFS_ALLOWANCE), F(MFS_PHASEOUT_START)
    else:
        cap, start = F(SPECIAL_ALLOWANCE), F(PHASEOUT_START)
    return max(F(0), cap - PHASEOUT_RATE * max(F(0), m - start))


def allowance_cap_page(status, magi):
    """Brief (page convention): $25,000 less half of modified AGI over $100,000; on a married-separate return $12,500
    less half of the excess over $50,000, whether or not the spouses lived apart. Floor 0."""
    m = _F(magi)
    if status == 'married_separate':
        cap, start = F(MFS_ALLOWANCE), F(MFS_PHASEOUT_START)
    else:
        cap, start = F(SPECIAL_ALLOWANCE), F(PHASEOUT_START)
    return max(F(0), cap - PHASEOUT_RATE * max(F(0), m - start))


def passive_law(results, status, lived_apart_all_year, magi):
    """The law (USC469 (d)(1), (i), (j)(4); CFR14691 (f)(2); F8582 Parts I-VIII) for the rentals' taxable results (one
    activity each, convention G1; no prior-year unallowed loss, convention C4; active participation, convention C5).
    Returns net (the household's net passive result), pal (the passive activity loss), cap, allowed_against_other (line 9),
    suspended (total carried to next year), allowed_net (what reaches AGI), and per rental: allowed (the loss allowed,
    positive; 0 for a rental with income), suspended, allowed_result (signed result that reaches Schedule E)."""
    res = [_F(x) for x in results]
    income = sum((x for x in res if x > 0), F(0))
    losses = sum((-x for x in res if x < 0), F(0))
    net = income - losses
    pal = max(F(0), -net)
    cap = allowance_cap_law(status, lived_apart_all_year, magi)
    line9 = min(pal, cap)                    # F8582 line 9: the smaller of line 4 (the loss) and line 8
    disallowed = pal - line9                 # Part VII line C
    per = []
    for x in res:
        if x >= 0:
            per.append({'allowed': F(0), 'suspended': F(0), 'allowed_result': x})
        else:
            s = disallowed * (-x) / losses   # ratable share (Part VI/VII ratios = loss / total losses)
            per.append({'allowed': -x - s, 'suspended': s, 'allowed_result': x + s})
    return {'net': net, 'pal': pal, 'cap': cap, 'allowed_against_other': line9, 'suspended': disallowed,
            'allowed_net': net + disallowed, 'per': per}


def passive_page(results, status, magi):
    """Brief (page convention): a loss is usable now up to the allowance, used by the rentals in order, each loss taking
    what the earlier ones left; the rest of a loss is carried forward; rentals with income are left alone."""
    left = allowance_cap_page(status, magi)
    per = []
    for x in (_F(v) for v in results):
        if x >= 0:
            per.append({'usable': F(0), 'carry': F(0)})
        else:
            u = min(-x, left)
            left -= u
            per.append({'usable': u, 'carry': -x - u})
    return {'cap': allowance_cap_page(status, magi), 'per': per}


# =====================================================================================================
# 5. Page A: the household (law and page tax figures)
# =====================================================================================================
EXTRA = 1000  # brief: "federal tax with $1,000 more ordinary non-wage, non-investment income ... / 1,000"; read 2026-10-31
RATE_TOTALS_TO_CENT = True  # convention R2 (TLKEY s.6 R2): each federal total is rounded half up to the cent before the two are subtracted for the page's marginal rate; not checked on this page; read 2026-10-31


def page_marginal_rate(year, status, wages):
    """Brief: (federal tax with $1,000 more ordinary non-wage, non-investment income - federal tax) / 1,000, on the
    household before the rentals (wages only). The extra $1,000 is not investment income, so NIIT does not move."""
    def total(extra):
        t = federal_tax(year, status, wages, other_ordinary=extra)['total']
        return round_half_up(t, CENT) if RATE_TOTALS_TO_CENT else t
    return max(F(0), (total(EXTRA) - total(0)) / EXTRA)


def rental_case(case):
    """Page A for one household. case: tax_year, today, filing_status, lived_apart_all_year (yes/no, married_separate
    only), wages, rentals (1-3 dicts). Returns per-rental page figures, depreciation (exact and Table A-6), the law's
    passive result per rental and in total, the page's allowance and tax line, the law's federal tax change, totals."""
    year, status = int(case['tax_year']), case['filing_status']
    _check_year_status(year, status)
    today = _d(case['today'])
    if today.year != year:
        raise ValueError('today must be a day of the tax year')
    apart = str(case.get('lived_apart_all_year') or 'no').strip().lower() in ('yes', 'y', 'true', '1')
    wages = _F(case['wages'])
    rentals = case['rentals']
    if not 1 <= len(rentals) <= 3:
        raise ValueError('one to three rentals')
    out = []
    for r in rentals:
        py, pm = _ym(r['purchase_date'])
        if (py, pm) > (today.year, today.month) or py < 1998:
            raise ValueError('placed in service between 1998 and today (convention C3)')
        m = rental_money(r)
        basis = depreciable_basis(r['purchase_price'], r.get('land_share'), r.get('improvements'))
        dep = depreciation_exact(basis, py, pm, year)
        dep_t = depreciation_table(basis, py, pm, year)
        taxable = m['income'] - m['opex'] - m['interest'] - dep
        out.append(dict(m, basis=basis, placed=(py, pm), depreciation=dep, depreciation_table=dep_t,
                        depreciation_diff=dep_t - dep, taxable=taxable, first_year=(py == year)))
    results = [x['taxable'] for x in out]
    law = passive_law(results, status, apart, wages)          # modified AGI = wages (USC469 (i)(3)(E)(iv); I8582 line 6)
    page = passive_page(results, status, wages)               # brief: "the page uses AGI before the rentals"
    mrate = page_marginal_rate(year, status, wages)
    for x, lp, pp in zip(out, law['per'], page['per']):
        x['law_allowed'], x['law_suspended'], x['law_allowed_result'] = lp['allowed'], lp['suspended'], lp['allowed_result']
        x['page_usable'], x['page_carry'] = pp['usable'], pp['carry']
        x['page_tax_line'] = x['taxable'] * mrate if x['taxable'] >= 0 else -pp['usable'] * mrate
        x['page_after_tax'] = x['cash_flow'] - x['page_tax_line']
    without = federal_tax(year, status, wages)
    with_ = federal_tax(year, status, wages, other_ordinary=law['allowed_net'], nii=max(F(0), law['allowed_net']))
    law_change = with_['total'] - without['total']
    page_total = sum((x['page_tax_line'] for x in out), F(0))
    cash_flow = sum((x['cash_flow'] for x in out), F(0))
    return {'rentals': out, 'law': law, 'page': page, 'marginal_rate': mrate, 'without': without, 'with': with_,
            'law_tax_change': law_change, 'law_niit_change': with_['niit'] - without['niit'],
            'page_tax_line_total': page_total, 'ratio': _div(law_change, page_total),
            'cash_flow_total': cash_flow, 'law_after_tax_total': cash_flow - law_change,
            'page_after_tax_total': cash_flow - page_total,
            'page_usable_total': sum((x['page_usable'] for x in out), F(0)),
            'page_carry_total': sum((x['page_carry'] for x in out), F(0))}


# =====================================================================================================
# 6. Page B: the home and the tax on selling it
# =====================================================================================================
EXCLUSION_MAX = {'married_joint': 500000, 'other': 250000}  # USC121 (b)(1) "shall not exceed $250,000"; (b)(2)(A) "substituting '$500,000' for '$250,000'" for a joint return when either spouse owns, both use, neither excluded in 2 years; P523; read 2026-10-31
USE_DAYS = 730      # CFR1211 (c)(1) "24 full months or for 730 days (365 x 2)"; P523 "a total of 24 months (730 days)"; read 2026-10-31
USE_MONTHS = 24     # CFR1211 (c)(1) "24 full months"; USC121 (a) "periods aggregating 2 years or more"; read 2026-10-31
WINDOW_YEARS = 5    # USC121 (a) "during the 5-year period ending on the date of the sale or exchange"; read 2026-10-31
LONG_TERM_MONTHS = 12  # USC1222 (3) "held for more than 1 year"; (1) "not more than 1 year" is short; P550; read 2026-10-31
PAGE_20_THRESHOLD = {'married_joint': 600050, 'other': 533400}  # brief (page convention): "600,050 (joint) / 533,400 (every other status) (the 2025 thresholds, used in every year)"; the law's are CG_15_TOP; read 2026-10-31
PAGE_NIIT_THRESHOLD = {'married_joint': 250000, 'other': 200000}  # brief (page convention): "250,000 (joint) / 200,000 (others)"; the law's married_separate figure is 125,000 (NIIT_THRESHOLD); read 2026-10-31
PAGE_RATE_LOW, PAGE_RATE_HIGH, PAGE_RATE_NIIT = F(15, 100), F(20, 100), F(38, 1000)  # brief (page convention): "rate = 15%, or 20% ... plus 3.8%"; read 2026-10-31
YEARS_AHEAD = (5, 10, 20)  # brief: "values ahead in 5, 10, 20 years"; read 2026-10-31


def _st(status, table):
    return F(table['married_joint' if status == 'married_joint' else 'other'])


def _last_day(y, m):
    return (date(y + m // 12, m % 12 + 1, 1) - timedelta(days=1))


def add_months(d, k):
    """The date k calendar months after d; a d on the last day of its month gives the last day of the target month, and a
    day that does not exist in the target month falls back to its last day (key convention L1)."""
    n = d.year * 12 + (d.month - 1) + k
    y, m = n // 12, n % 12 + 1
    last = _last_day(y, m)
    if d == _last_day(d.year, d.month):
        return last
    return date(y, m, min(d.day, last.day))


def days_owned(bought, sold):
    """Days of ownership: counting starts the day after the purchase and the sale day counts (P550 Holding Period "begin
    counting on the date after the day you acquired the property. The day you disposed of the property is part of your
    holding period"; CFR1211 (c)(4) Example 3: bought January 18, 1997, owned "from January 19, 1997")."""
    return (_d(sold) - _d(bought)).days


def full_months_law(bought, sold):
    """Full calendar months of ownership (CFR1211 (c)(1) "24 full months"; CFR1213 (g)(1) "may be expressed in ... months"),
    month ends by add_months() (convention L1)."""
    b, s = _d(bought), _d(sold)
    k = (s.year - b.year) * 12 + (s.month - b.month) + 1
    while k > 0 and add_months(b, k) > s:
        k -= 1
    return max(0, k)


def whole_months_page(bought, today, rule='M1'):
    """The page's "whole months owned" (NOT VERIFIED; the brief says to state the assumption). M1 (the key's assumption):
    (years x 12 + months) between the two dates, less one when today's day of the month is before the purchase's (no
    month-end adjustment). M2: the calendar-month difference, days ignored. M3: floor(days x 12 / 365.25)."""
    b, t = _d(bought), _d(today)
    n = (t.year - b.year) * 12 + (t.month - b.month)
    if rule == 'M1':
        return n - (1 if t.day < b.day else 0)
    if rule == 'M2':
        return n
    if rule == 'M3':
        return int(F((t - b).days) * 12 / F(36525, 100))
    raise ValueError(rule)


def meets_two_of_five(bought, sold):
    """USC121 (a) with CFR1211 (c)(1): owned and used as the main home (every case: since the purchase) for 730 days or 24
    full months within the 5 years ending on the sale date."""
    return days_owned(bought, sold) >= USE_DAYS or full_months_law(bought, sold) >= USE_MONTHS


def first_long_day(bought):
    """The first sale date on which the home is held "more than 1 year" (USC1222 (3); P550: counting from the day after
    the purchase, the sale day included): the day after the first anniversary; a purchase on the last day of a month is
    long-term from the first day of the 13th month after (Rev. Rul. 66-7 as read in TLKEY s.3; NOT re-read here). The two
    readings differ only for February 28 of a year before a leap year, which no 2025-2026 sale can reach as a short/long
    question."""
    b = _d(bought)
    if b == _last_day(b.year, b.month):
        n = b.year * 12 + b.month - 1 + LONG_TERM_MONTHS + 1
        return date(n // 12, n % 12 + 1, 1)
    return date(b.year + 1, b.month, b.day) + timedelta(days=1)


def growth_since_bought(value, price, months):
    """Brief (page): (value / price)^(12 / whole months owned) - 1, only when owned 12 months or more. Worked in Decimal
    with 60 significant digits (exp and ln are correctly rounded there), returned as a Decimal; None when not shown."""
    v, p = _F(value), _F(price)
    if months is None or months < 12 or p <= 0 or v <= 0:
        return None
    with localcontext() as ctx:
        ctx.prec = 60
        ratio = D(v.numerator) / D(v.denominator) / (D(p.numerator) / D(p.denominator))
        return (ratio.ln() * D(12) / D(months)).exp() - 1


def home_case(case):
    """Page B for one household. case: tax_year, today, filing_status, wages, and the home fields (value, purchase_price,
    purchase_date, improvements, sell_share, property_tax, insurance, hoa_monthly, maintenance, appreciation,
    loan_balance, loan_rate, loan_payment). Returns the page's figures, the law's sale figures and the contrasts."""
    year, status = int(case['tax_year']), case['filing_status']
    _check_year_status(year, status)
    today, bought = _d(case['today']), _d(case['purchase_date'])
    if today.year != year or bought > today:
        raise ValueError('today is a day of the tax year and the purchase is not after it')
    wages = _F(case['wages'])
    value, price = _F(case['value']), _F(case['purchase_price'])
    improvements = _or(case.get('improvements'), 0)
    loan = loan_year(case.get('loan_balance'), case.get('loan_rate'), case.get('loan_payment'))
    balance = _F(case.get('loan_balance') or 0) if loan else F(0)
    appreciation = _or(case.get('appreciation'), DEFAULT_APPRECIATION)
    # page figures
    months = {k: whole_months_page(bought, today, k) for k in ('M1', 'M2', 'M3')}
    costs_year = (_or(case.get('property_tax'), 0) + _or(case.get('insurance'), 0)
                  + _or(case.get('hoa_monthly'), 0) * MONTHS_A_YEAR + value * _or(case.get('maintenance'), DEFAULT_MAINTENANCE)
                  + (loan['interest'] if loan else F(0)))
    sell_costs = value * _or(case.get('sell_share'), DEFAULT_SELL_SHARE)
    basis = price + improvements
    gain = value - sell_costs - basis                        # P523 Worksheet 2: amount realized - adjusted basis
    page_excl = _st(status, EXCLUSION_MAX)
    page_taxable = max(F(0), gain - page_excl)
    page_ti = max(F(0), wages - standard_deduction(year, status))  # convention H6: the page's "federal taxable income"
    page_rate = ((PAGE_RATE_HIGH if page_ti + page_taxable > _st(status, PAGE_20_THRESHOLD) else PAGE_RATE_LOW)
                 + (PAGE_RATE_NIIT if wages + page_taxable > _st(status, PAGE_NIIT_THRESHOLD) else F(0)))
    page_tax = page_taxable * page_rate
    # the law
    d_owned, m_owned = days_owned(bought, today), full_months_law(bought, today)
    meets = meets_two_of_five(bought, today)
    long_term = today >= first_long_day(bought)
    max_excl = _st(status, EXCLUSION_MAX)

    def law_tax(taxable_gain):
        g = max(F(0), taxable_gain)
        w = federal_tax(year, status, wages, lt_gain=g if long_term else 0, st_gain=0 if long_term else g, nii=g)
        return w['total'] - federal_tax(year, status, wages)['total'], w

    law_excl = min(max(F(0), gain), max_excl) if meets else F(0)
    law_taxable = max(F(0), gain - law_excl)
    law_t, law_with = law_tax(law_taxable)
    # 121(c) contrast: the reduced maximum exclusion if the sale is for work, health or an unforeseen circumstance
    frac_days = F(1) if meets else F(min(d_owned, USE_DAYS), USE_DAYS)
    frac_months = F(1) if meets else F(min(m_owned, USE_MONTHS), USE_MONTHS)
    red_max_days, red_max_months = max_excl * frac_days, max_excl * frac_months
    red_excl = min(max(F(0), gain), red_max_days)
    red_taxable = max(F(0), gain - red_excl)
    red_t, _ = law_tax(red_taxable)
    keep = lambda tax: value - sell_costs - balance - tax
    return {
        'equity': value - balance, 'ltv': _div(balance, value), 'months_owned': months,
        'growth_since_bought': growth_since_bought(value, price, months['M1']),
        'growth_since_bought_M2': growth_since_bought(value, price, months['M2']),
        'growth_since_bought_M3': growth_since_bought(value, price, months['M3']),
        'loan': loan, 'costs_year': costs_year,
        'values_ahead': {n: value * (1 + appreciation) ** n for n in YEARS_AHEAD},
        'sell_costs': sell_costs, 'basis': basis, 'gain': gain,
        'page_exclusion': page_excl, 'page_taxable_gain': page_taxable, 'page_taxable_income': page_ti,
        'page_rate': page_rate, 'page_tax': page_tax, 'page_keep': keep(page_tax),
        'days_owned': d_owned, 'full_months_owned': m_owned, 'meets_2_of_5': meets,
        'first_long_day': first_long_day(bought), 'term': 'long' if long_term else 'short',
        'law_exclusion_max': max_excl if meets else F(0), 'law_exclusion': law_excl, 'law_taxable_gain': law_taxable,
        'law_tax': law_t, 'law_niit': law_with['niit'] - federal_tax(year, status, wages)['niit'],
        'law_keep': keep(law_t),
        'reduced_fraction_days': frac_days, 'reduced_fraction_months': frac_months,
        'reduced_max_days': red_max_days, 'reduced_max_months': red_max_months,
        'reduced_exclusion': red_excl, 'reduced_taxable_gain': red_taxable, 'reduced_tax': red_t, 'reduced_keep': keep(red_t),
    }


# =====================================================================================================
# 7. Self-checks: the printed tables, the sources' own examples, RULES.md section 9
# =====================================================================================================
def check_tables():
    n = 0
    for year in TAX_YEARS:
        for st in STATUSES:
            tops = BRACKET_TOPS[year][st]
            assert list(tops) == sorted(tops)
            for k, base in enumerate(RP_BASE[year][st]):
                lo = 0 if k == 0 else tops[k - 1]
                assert regular_tax(year, st, lo) == _F(base), (year, st, k)
                n += 1
            assert CG_ZERO_TOP[year][st] < CG_15_TOP[year][st]
    # Table A-6: every column sums to 100%, the rebuild reproduces all 342 printed entries, and the exact formula differs
    # from the printed percentages by at most 0.000636 percentage points in any year (7/11000).
    # Over the years, the cumulative difference is at most 0.002939 percentage points (97/33000; July, after year 10).
    entries, worst, worst_cum = 0, F(0), F(0)
    for m in range(1, 13):
        col = table_a6(m)
        assert sum(col) == 100 and len(col) == (28 if m <= 6 else 29), m
        assert table_a6_rebuilt(m) == col, m
        exact = depreciation_schedule_exact(100, 2000, m)
        assert len(exact) == len(col) and sum(exact.values()) == 100
        ce = ct = F(0)
        for a, b in zip(exact.values(), col):
            ce, ct = ce + a, ct + b
            worst, worst_cum = max(worst, abs(a - b)), max(worst_cum, abs(ce - ct))
        entries += len(col)
    assert entries == 342 and worst == F(7, 11000) and worst_cum == F(97, 33000), (entries, worst, worst_cum)
    n += 12 * 3 + 1
    # P527 Table 2-2d example: building $160,000 placed in service February 8: 3.182% -> "$5,091"; exact 5,090.91.
    assert depreciation_table(160000, 2025, 2, 2025) == F('5091.20') and show(depreciation_exact(160000, 2025, 2, 2025)) == D('5090.91')
    # P946 disposal example: $100,000 placed in service July 2, 2023; a full year for 2025 is "$3,636" (third recovery year).
    assert depreciation_table(100000, 2023, 7, 2025) == 3636
    # Table A-6 year 28 for January is printed "1.97"; year 29 exists only for July to December.
    assert table_a6(1)[27] == F('1.97') and len(table_a6(6)) == 28 and table_a6(12)[28] == F('1.667')
    # The last year: January-June placed, year 28 is (month + 5.5) / 12 of a year; July-December, year 29 is (month - 6.5) / 12.
    for m in range(1, 13):
        s = depreciation_schedule_exact(F(55, 2), 2000, m)          # basis 27.5: a full year is 1
        last = list(s.values())[-1]
        assert (len(s), last) == ((28, F(2 * m + 11, 24)) if m <= 6 else (29, F(2 * m - 13, 24))), m
    # RULES.md s.4: placed in service March 1998 -> last deduction 2025 (8.5/12), none in 2026; August 1998 -> 1.5/12 in 2026.
    assert depreciation_exact(F(55, 2), 1998, 3, 2025) == F(17, 24) and depreciation_exact(F(55, 2), 1998, 3, 2026) == 0
    assert depreciation_exact(F(55, 2), 1998, 8, 2026) == F(3, 24)
    n += 5
    # P925 Terry (= CFR14691 (f)(2)(i)(D) Example 1): A -9,000, B -16,000, C +4,000; the $21,000 passive activity loss is
    # disallowed ratably: A 7,560, B 13,440 (no allowance applies: here a married-separate filer living with the spouse).
    t = passive_law([-9000, -16000, 4000], 'married_separate', False, 40000)
    assert t['pal'] == 21000 and [p['suspended'] for p in t['per']] == [7560, 13440, 0]
    # P925: single, $70,000 wages, $15,000 passive income, $26,000 rental loss: 15,000 offsets the income, 11,000 the wages.
    t = passive_law([15000, -26000], 'single', False, 70000)
    assert t['allowed_against_other'] == 11000 and t['suspended'] == 0 and t['allowed_net'] == -11000
    # P527: single, $40,000 wages, $2,000 passive income, $3,500 rental loss: 2,000 offsets the income, 1,500 the wages.
    t = passive_law([2000, -3500], 'single', False, 40000)
    assert t['allowed_against_other'] == 1500 and t['allowed_net'] == -1500
    # P925 phaseout example (2025): unmarried, $120,000 salary, $31,000 rental loss: deduct $15,000, carry $16,000.
    t = passive_law([-31000], 'single', False, 120000)
    assert t['cap'] == 15000 and t['allowed_against_other'] == 15000 and t['suspended'] == 16000
    # P925 Stacey: salary 42,300 (+ 300 dividends + 1,400 interest), rental loss 4,000: the entire loss offsets other income.
    assert passive_law([-4000], 'single', False, 44000)['suspended'] == 0
    # I8582 line 5 / 8: married filing separately and lived apart: $75,000 on line 5, at most $12,500 on line 8.
    assert allowance_cap_law('married_separate', True, 40000) == 12500 and allowance_cap_law('married_separate', True, 75000) == 0
    assert allowance_cap_law('married_separate', True, 60000) == 7500 and allowance_cap_law('married_separate', False, 0) == 0
    assert allowance_cap_law('single', False, 150000) == 0 and allowance_cap_law('married_joint', False, 100000) == 25000
    n += 8
    # CFR1213 (g)(2) Example 1: sold twelve months after the purchase for a change in place of employment: 12/24 x $250,000.
    assert F(min(full_months_law('2025-03-10', '2026-03-10'), USE_MONTHS), USE_MONTHS) * 250000 == 125000
    # CFR1213 (g)(2) Example 2: W used the house from January 15, 1999 to January 15, 2000: 365/730 x $250,000 = $125,000.
    assert F(days_owned('1999-01-15', '2000-01-15'), USE_DAYS) * 250000 == 125000
    # CFR1211 (c)(4) Example 3: bought January 18, 1997, sold May 25, 2000: owned "at least 2 years out of the 5 years".
    assert meets_two_of_five('1997-01-18', '2000-05-25') and days_owned('1997-01-18', '1999-01-18') == 730
    # 730 days are reached a day before 24 full months when a February 29 lies inside (CFR1211 (c)(1) "either").
    assert days_owned('2023-11-02', '2025-11-01') == 730 and full_months_law('2023-11-02', '2025-11-01') == 23
    assert meets_two_of_five('2023-11-02', '2025-11-01') and not meets_two_of_five('2023-11-02', '2025-10-31')
    # P550 holding period example: bought January 31, 2024: January 29, 2025 short; February 6, 2025 long.
    assert first_long_day('2024-01-31') == date(2025, 2, 1) and first_long_day('2024-02-29') == date(2025, 3, 1)
    assert first_long_day('2025-05-16') == date(2026, 5, 17)
    # Convention L1 and RULES.md s.8.3: a month-end purchase completes a month on the next month end; days can be below months.
    assert full_months_law('2025-01-31', '2025-02-28') == 1 and days_owned('2025-01-31', '2025-02-28') == 28
    assert full_months_law('2024-02-29', '2026-02-28') == 24 and days_owned('2024-02-29', '2026-02-28') == 730
    # RULES.md s.8.1: the page's month counts M1 / M2 / M3 on two dates where they differ.
    assert [whole_months_page('2025-01-31', '2026-02-28', k) for k in ('M1', 'M2', 'M3')] == [12, 13, 12]
    assert [whole_months_page('2025-03-15', '2026-03-14', k) for k in ('M1', 'M2', 'M3')] == [11, 12, 11]
    n += 11
    # CFR14114 (d)(3)(ii) Example 3: the $200,000 excluded home gain is out of gross income "and, consequently, from A's net
    # investment income": with $7,000 of other long-term gain less a $5,000 carryover, NII is 2,000 (key: nii = taxable gain).
    assert niit('single', 400000, 7000 - 5000) == F('76')
    # Loan year: a loan paid off inside the year stops; an interest-only payment leaves the balance unchanged.
    ly = loan_year(1000, '0.12', 600)
    assert ly['months'] == 2 and ly['end_balance'] == 0 and ly['interest'] == F(10) + F('4.1') and ly['debt_service'] == F('1014.10')
    ly = loan_year(240000, '0.05', 1000)
    assert ly['interest'] == 12000 and ly['principal'] == 0 and ly['end_balance'] == 240000
    n += 3
    n += worked_examples()
    return n


def worked_examples():
    """tests/golden/property/RULES.md section 9, worked by hand there and asserted here."""
    n = 0
    # 9.1 The duplex bought in March 2019: basis 400,000 x 0.8 + 10,000 = 330,000; 12,000 a year.
    sched = depreciation_schedule_exact(330000, 2019, 3)
    assert depreciable_basis(400000, '', 10000) == 330000
    assert sched[2019] == 9500 and sched[2026] == 12000 and max(sched) == 2046 and sched[2046] == 8500
    assert len(sched) == 28 and sum(sched.values()) == 330000
    assert depreciation_table(330000, 2019, 3, 2019) == F('9500.70') and depreciation_table(330000, 2019, 3, 2026) == F('11998.80')
    assert depreciation_table(330000, 2019, 3, 2046) == F('8500.80') and depreciation_table(330000, 2019, 3, 2047) == 0
    duplex = {'purchase_price': 400000, 'purchase_date': '2019-03', 'land_share': '', 'improvements': 10000, 'value': 520000,
              'rent_monthly': 3400, 'vacancy': '', 'property_tax': 6200, 'insurance': 1800, 'hoa_monthly': 0,
              'maintenance': '', 'management': '0.08', 'utilities_monthly': 150, 'other_monthly': 0, 'cash_in': 410000,
              'appreciation': ''}
    r = rental_case({'tax_year': 2026, 'today': '2026-11-16', 'filing_status': 'single', 'wages': 85000, 'rentals': [duplex]})
    x = r['rentals'][0]
    assert x['income'] == 38760 and x['opex'] == F('18100.80') and x['noi'] == F('20659.20') and x['taxable'] == F('8659.20')
    assert show_rate(x['cap_rate']) == D('0.039729') and x['dscr'] is None and show_rate(x['cash_on_cash']) == D('0.050388')
    assert r['marginal_rate'] == F('0.22') and show(r['law_tax_change']) == D('1905.02') and r['page_tax_line_total'] == r['law_tax_change']
    n += 6
    # 9.2 Two rentals: A +8,000, B -30,000; single 2026; wages 90,000 and 130,000.
    a = {'purchase_price': 275000, 'purchase_date': '2015-01', 'land_share': '', 'improvements': 0, 'value': 300000,
         'rent_monthly': 2000, 'vacancy': '', 'property_tax': 2800, 'insurance': 1000, 'hoa_monthly': 0, 'maintenance': '',
         'management': '', 'utilities_monthly': 0, 'other_monthly': 0, 'cash_in': 275000, 'appreciation': ''}
    b = {'purchase_price': 400000, 'purchase_date': '2012-06', 'land_share': '', 'improvements': 10000, 'value': 755000,
         'rent_monthly': 2500, 'vacancy': '', 'property_tax': 9000, 'insurance': 2500, 'hoa_monthly': 300, 'maintenance': '',
         'management': '0.10', 'utilities_monthly': 200, 'other_monthly': 50, 'loan_balance': 300000, 'loan_rate': '0.06',
         'loan_payment': 1500, 'cash_in': 80000, 'appreciation': ''}
    r = rental_case({'tax_year': 2026, 'today': '2026-11-16', 'filing_status': 'single', 'wages': 90000, 'rentals': [a, b]})
    ra, rb = r['rentals']
    assert ra['taxable'] == 8000 and rb['taxable'] == -30000 and rb['noi'] == 0 and rb['interest'] == 18000
    assert r['law']['net'] == -22000 and r['law']['cap'] == 25000 and r['law']['suspended'] == 0 and rb['law_allowed'] == 30000
    assert rb['page_usable'] == 25000 and rb['page_carry'] == 5000 and r['marginal_rate'] == F('0.22')
    assert r['page_tax_line_total'] == -3740 and r['law_tax_change'] == -4840 and show_rate(r['ratio']) == D('1.294118')
    assert rb['equity'] == 455000 and rb['total_return'] == 8425 and show_rate(rb['break_even']) == D('1.550000')
    r = rental_case({'tax_year': 2026, 'today': '2026-11-16', 'filing_status': 'single', 'wages': 130000, 'rentals': [a, b]})
    ra, rb = r['rentals']
    assert r['law']['cap'] == 10000 and r['law']['suspended'] == 12000 and rb['law_allowed'] == 18000 and rb['law_suspended'] == 12000
    assert rb['page_usable'] == 10000 and rb['page_carry'] == 20000 and r['marginal_rate'] == F('0.24')
    assert r['page_tax_line_total'] == -480 and r['law_tax_change'] == -2364 and r['law']['allowed_net'] == -10000
    n += 8
    # 9.3 Married filing separately, living with the spouse, a $10,000 rental loss, wages $60,000, 2025.
    c = {'purchase_price': 275000, 'purchase_date': '2016-09', 'land_share': '', 'improvements': 0, 'value': 350000,
         'rent_monthly': 1500, 'vacancy': '', 'property_tax': 1500, 'insurance': 900, 'hoa_monthly': 0, 'maintenance': '',
         'management': '', 'utilities_monthly': 100, 'other_monthly': 0, 'loan_balance': 240000, 'loan_rate': '0.05',
         'loan_payment': 1000, 'cash_in': 60000, 'appreciation': ''}
    case = {'tax_year': 2025, 'today': '2025-12-01', 'filing_status': 'married_separate', 'lived_apart_all_year': 'no',
            'wages': 60000, 'rentals': [c]}
    r = rental_case(case)
    x = r['rentals'][0]
    assert x['taxable'] == -10000 and r['law']['cap'] == 0 and x['law_suspended'] == 10000 and r['law_tax_change'] == 0
    assert x['page_usable'] == 7500 and x['page_carry'] == 2500 and r['marginal_rate'] == F('0.12') and r['page_tax_line_total'] == -900
    assert x['opex'] == 7100 and x['dscr'] == F(5, 6) and x['equity'] == 110000 and show_rate(x['roe']) == D('0.093182')
    r = rental_case(dict(case, lived_apart_all_year='yes'))
    assert r['law']['cap'] == 7500 and r['rentals'][0]['law_suspended'] == 2500 and r['law_tax_change'] == -900
    n += 4
    # 9.4 Married filing jointly, wages $300,000, the duplex's $8,659.20: the law adds 3.8% NIIT; the page does not.
    r = rental_case({'tax_year': 2026, 'today': '2026-11-16', 'filing_status': 'married_joint', 'wages': 300000,
                     'rentals': [duplex]})
    assert r['marginal_rate'] == F('0.24') and show(r['page_tax_line_total']) == D('2078.21')
    assert show(r['law_niit_change']) == D('329.05') and show(r['law_tax_change']) == D('2407.26')
    n += 2
    # 9.5 A home bought 18 months ago (2025-05-16), sold 2026-11-16, single, wages $95,000.
    h1 = {'tax_year': 2026, 'today': '2026-11-16', 'filing_status': 'single', 'wages': 95000, 'value': 460000,
          'purchase_price': 400000, 'purchase_date': '2025-05-16', 'improvements': 5000, 'sell_share': '',
          'property_tax': 5500, 'insurance': 1600, 'hoa_monthly': 0, 'maintenance': '', 'appreciation': '',
          'loan_balance': 360000, 'loan_rate': '0.06', 'loan_payment': 2200}
    h = home_case(h1)
    assert h['gain'] == 27400 and h['days_owned'] == 549 and h['full_months_owned'] == 18 and not h['meets_2_of_5']
    assert h['term'] == 'long' and h['page_taxable_gain'] == 0 and h['page_keep'] == 72400
    assert h['law_exclusion'] == 0 and h['law_tax'] == 4110 and h['law_keep'] == 68290
    assert show(h['reduced_max_days']) == D('188013.70') and h['reduced_max_months'] == 187500 and h['reduced_tax'] == 0
    assert h['months_owned'] == {'M1': 18, 'M2': 18, 'M3': 18} and show_rate(h['growth_since_bought']) == D('0.097653')
    assert show(h['loan']['interest']) == D('21465.78') and show(h['costs_year']) == D('33165.78') and show_rate(h['ltv']) == D('0.782609')
    # The same home bought 10 months ago (2026-01-16) is short-term: ordinary rates on the whole gain, no exclusion.
    h = home_case(dict(h1, purchase_date='2026-01-16'))
    assert h['term'] == 'short' and h['law_tax'] == 6040 and h['growth_since_bought'] is None and h['reduced_tax'] == 0
    n += 7
    # 9.6 A long-held home: $700,000 gain, single, wages $180,000, 2026.
    h2 = {'tax_year': 2026, 'today': '2026-11-16', 'filing_status': 'single', 'wages': 180000, 'value': 1200000,
          'purchase_price': 380000, 'purchase_date': '2004-06-15', 'improvements': 48000, 'sell_share': '',
          'property_tax': 14000, 'insurance': 3000, 'hoa_monthly': 0, 'maintenance': '', 'appreciation': '',
          'loan_balance': 150000, 'loan_rate': '0.04', 'loan_payment': 1600}
    h = home_case(h2)
    assert h['gain'] == 700000 and h['meets_2_of_5'] and h['law_exclusion'] == 250000 and h['law_taxable_gain'] == 450000
    assert h['law_tax'] == 87260 and h['law_niit'] == 16340 and h['page_rate'] == F('0.238') and h['page_tax'] == 107100
    assert h['law_keep'] == 890740 and h['page_keep'] == 870900
    n += 3
    return n


CHECKS = check_tables()

if __name__ == '__main__':
    print('rules.py: %d self-checks passed (sources read %s)' % (CHECKS, READ_ON))
