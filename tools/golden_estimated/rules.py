"""US estimated-tax rules for the answer key of two pages, "Estimated payments" and "Withholding check", tax years
2025, 2026 and 2027, as data plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or
tests/*.test.mjs while writing this file, and it never imports or runs the app. Only the layout and conventions of
tools/golden_health/ and tools/golden_estate/ were looked at; no figure or code is shared with them. The federal
brackets and standard deductions were checked against the revenue procedures themselves (and agree with
tests/golden/taxes/RULES.md, whose section numbers for Rev. Proc. 2024-40 are off by one: see NOT VERIFIED / FINDINGS).
Every figure names its source and the date it was read on the same line. Money is an exact Fraction while it is
worked and a Decimal when it is shown. Importing this file runs check_tables().

The model (the pages' documented conventions; the key follows the law where it differs and keeps the page's way in a
contrast column, see tests/golden/estimated/RULES.md section 9):
  TAX       this year's tax = regular income tax on max(0, interest - standard deduction), exact bracket formula.
            2027 rows: no tax at all (the app inflates the 2026 figures; the key does not model that): due dates only.
  REQUIRED  lesser of 90% of this year's tax and 100% (110% when last year's AGI > $150,000, $75,000 if married filing
            separately this year) of last year's tax; no last-year figure typed: 90% of this year's. 6654(d)(1)(B)-(C).
  ESTIMATES amount to pay by estimates = max(0, required - projected withholding); a quarter of it each period,
            cumulative shares 25/50/75/100%. 6654(d)(1)(A), (g)(1).
  DATES     April 15, June 15, September 15, January 15 of the next year (6654(c)(2)), each moved to the next day that is
            not a Saturday, Sunday or District of Columbia legal holiday (7503; 26 CFR 301.7503-1(b); D.C. Code 28-2701).
  STAND     past due / behind / next payment / status per quarter, the page's conventions (RULES.md section 5).
  BALANCE   tax - projected withholding - estimated payments (+ owe, - refund).
  W/H       withheld so far + per-paycheck x paychecks left (page formula floor(days to Dec 31 / 365.25 x n));
            nothing typed so far: a full year at the per-paycheck rate.
  VERDICT   unknown / about right (|balance| < 500) / owe / refund; W-4 change for the first person with paychecks left.
  FLAGS     the pages' penalty flags next to the law's exposure (6654(e)(1), (e)(2), (b)); the addition to tax itself
            (6654(a), the 6621 rate) is out of scope.

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits). The U.S. Code pages are the
OLRC edition "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t<T>/s<N>/:
  USC6654  26 U.S.C. 6654 (a)-(h), (m), amendment notes (last amended by Pub. L. 115-141, 2018; no Pub. L. 119-21 entry)   (8d577fde...3c6a820b9f)
  USC7503  26 U.S.C. 7503 (Pub. L. 94-455 is the last amendment)   (6fd6414b...56dff7aeac)
  USC6103  5 U.S.C. 6103 (a)-(c) federal legal public holidays (Juneteenth added by Pub. L. 117-17)   (0b3b1f84...48ead66da8)
  USC55    26 U.S.C. 55 (b)(1), (d)(1)-(4) alternative minimum tax (only to check that it never applies here)   (e28808c7...162f2fe040)
  USC1411  26 U.S.C. 1411 (a)(1), (b) net investment income tax thresholds   (89721b18...741beafb33)
  The regulations are eCFR title 26 "up to date as of 2026-10-29" (https://www.ecfr.gov/api/versioner/v1/titles.json,
  b649b378...71de4d4618), read as XML from https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>
  (human page https://www.ecfr.gov/current/title-26/section-<N>):
  CFR7503  26 CFR 301.7503-1 (a), (b) [32 FR 15241; T.D. 7309; T.D. 8681, 61 FR 42179, Aug. 14, 1996]   (2c8d416a...506c8ea75c)
  CFR6654  26 CFR 1.6654-1, 1.6654-2 (text predates the 1984-2018 rewrites of 6654: 80% rule, old exceptions; read only for
           the deemed-withholding sentence and the joint/separate allocation; not relied on for any figure)
           (8f10aa57...a6c5559cd0; 7d6d2a7d...8ebab1f284)
  DC28     D.C. Code 28-2701 "Holidays designated - Time for performing acts extended" (the section 301.7503-1(b) cites)
           https://code.dccouncil.gov/us/dc/council/code/sections/28-2701   (fbf67571...f780e9db41)
  DC1612   D.C. Code 1-612.02 "Legal public holidays" (a)(11) Emancipation Day, (b)(1) Saturday/Sunday rule
           https://code.dccouncil.gov/us/dc/council/code/sections/1-612.02   (6fb14150...8a98416385)
  MAGL     Mass. Gen. Laws ch. 4, s.7, Eighteenth ("the third Monday in April")
           https://malegislature.gov/Laws/GeneralLaws/PartI/TitleI/Chapter4/Section7   (dcccceaa...95bc5b76da)
  MERS     Me. Rev. Stat. tit. 4, s.1051 ("Patriot's Day, the 3rd Monday in April")
           https://legislature.maine.gov/statutes/4/title4sec1051-1.html   (07a518b3...0d836f675e)
  RR1513   Rev. Rul. 2015-13 (s.7503; 26 CFR 301.7503-1(b); also 6654): Patriots' Day moves the RETURN of a MA/ME
           resident, not the first estimated-tax installment   https://www.irs.gov/pub/irs-drop/rr-15-13.pdf   (c44b7737...9b625e2796)
  ES24     Form 1040-ES (2024), Payment Due Dates   https://www.irs.gov/pub/irs-prior/f1040es--2024.pdf   (860a291f...bf21300ee6)
  ES25     Form 1040-ES (2025): General Rule, Exception, Higher income taxpayers, Payment Due Dates, footnote, vouchers
           https://www.irs.gov/pub/irs-prior/f1040es--2025.pdf   (a6e94741...325905cfb7)
  ES26     Form 1040-ES (2026) (same items; worksheet lines 12b, 14a, 14b; Where To File: MA and ME vouchers go to
           Louisville, KY)   https://www.irs.gov/pub/irs-pdf/f1040es.pdf (= .../irs-prior/f1040es--2026.pdf)   (396ffad2...9864f90b54)
  I2210    Instructions for Form 2210 (2025): Reminders, Who Must Pay, Exceptions, Waiver, Line 11 columns, January 31
           https://www.irs.gov/pub/irs-pdf/i2210.pdf   (7bd6a474...cd759e831d); Form 2210 (2025) Part I
           https://www.irs.gov/pub/irs-pdf/f2210.pdf   (6899ce67...5b8577159a); Instructions (2024), for the 2024 dates
           https://www.irs.gov/pub/irs-prior/i2210--2024.pdf   (c64608de...93c48ec031)
  P509_26  Publication 509 (2026), Legal holidays 2026, Statewide legal holidays, January 15 / February 2 entries
           https://www.irs.gov/pub/irs-pdf/p509.pdf   (d7d7e3f8...02f3f4a0cb)
  P509_27  Publication 509 (2027) DRAFT (PDF created 2026-08-24, modified 2026-09-16), Legal holidays 2027, January 15,
           February 1, April 15, June 15, September 15 entries   https://www.irs.gov/pub/irs-dft/p509--dft.pdf   (be4d399e...e18c9ee1d0)
  I1040    Instructions for Form 1040 (2025): age-65 rule ("born on January 1, 1961 ... considered to be age 65 at the end
           of 2025"), the Tax Table rule and rows   https://www.irs.gov/pub/irs-pdf/i1040gi.pdf   (482e9c48...590468364a)
  RP2440   Rev. Proc. 2024-40, s.2.01 Tables 1-4 (2025 brackets), s.2.11 (2025 AMT), s.2.15 (superseded for 2025 by
           RP2532 s.3.01)   https://www.irs.gov/pub/irs-drop/rp-24-40.pdf   (4de9db6b...d4c302af1f)
  RP2532   Rev. Proc. 2025-32, s.3.01 (2025 standard deduction as amended by Pub. L. 119-21), s.4.01 Tables 1-4 (2026
           brackets), s.4.10 (2026 AMT), s.4.14 (2026 standard deduction)   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf   (e9ada115...a96214635b)
  PL11921  Pub. L. 119-21, s.70102 (63(c)(7): $15,750 / $23,625 from 2025)
           https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm   (84000b07...c584e9004d)
  IRSET    IRS "Estimated taxes" page (last reviewed 25-Sep-2026): the three conditions for no estimated tax, holiday rule
           https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes   (4c322d40...ab75b90651)
  IRSNEWS  IR-2025-08 (Jan 10, 2025) and IR-2025-18 (Jan 27, 2025): "the Tuesday, April 15 federal deadline" (2025);
           IR-2026-02 (Jan 8, 2026): "until Wednesday, April 15, 2026"; IR-2026-12 (Jan 26, 2026); none mentions Maine
           or Massachusetts. Tax Tip 2024-30 (Apr 9, 2024): "Taxpayers in Maine and Massachusetts have until April 17,
           2024, to file their returns due to the Patriots' Day holiday"; Tax Tip 2022-47 / 2022-59 (April 19, 2022).
           https://www.irs.gov/newsroom/... (75ac90f4...446daa2c33; 3849e93e...723ef00d76; 2714158d...5c1a5098b7;
           d7850fd0...fe53231e07; 786ab360...b8b6a15f9d; 5c977d29...08b9f3fcd8); October 2026 releases IR-2026-117 to
           -129 (36a52141...4ea56d25a1): no estimated-tax relief.
  FEDKEY   tests/golden/taxes/RULES.md (the federal key) sections 1-2, read for comparison only.

NOT VERIFIED on any official source (the key states its own convention):
  - The January 2028 due date (Tuesday, January 18, 2028) and the January 31, 2028 option: no IRS publication for tax
    year 2027 prints them yet (no 2027 Form 1040-ES; the irs-dft 1040-ES draft is a stale 2018 draft; the 2027 Pub. 509
    is a draft and covers calendar 2027 only). Worked from 6654(c)(2), 7503 and D.C. Code 28-2701.
  - The 2027 due dates rest on the Pub. 509 (2027) DRAFT, not on a final publication.
  - An IRS statement on Patriots' Day for 2025, 2026 or 2027: none found (none needed: Patriots' Day falls on April 21,
    2025, April 20, 2026 and April 19, 2027, after April 15 each year).
  - Ad hoc closures (a day "appointed by the President", D.C. Code 28-2701) on a 2027-2028 due date cannot be known
    in advance; none is modelled.
  - The page's own definitions where the task text leaves room (whether "estimates needed" includes the $1,000 test,
    whether "covered" uses the $1 tolerance, whether "withheld so far" is per person or per household): the key
    states its reading and gives the other reading its own column where it can.
  - FINDINGS on the federal key: tests/golden/taxes/RULES.md cites "RP24 s.3.01" and "RP24 s.3.15"; in Rev. Proc. 2024-40
    the tax tables are s.2.01 and the standard deduction s.2.15 (section 3 is EFFECTIVE DATE). Its figures agree.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from datetime import date, timedelta
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
    return F(D(str(x).replace(',', '')))


def _opt(x):
    """None (blank) stays None; anything else becomes an exact Fraction. A typed 0 is 0, not blank."""
    return None if x is None or (isinstance(x, str) and x.strip() == '') else _F(x)


def round_half_up(x, quantum=DOLLAR):
    """Round x to a multiple of quantum, halves away from zero (the key's display convention)."""
    x, q = _F(x), _F(quantum)
    n = abs(x) / q
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)  # floor(n + 1/2)
    return (k * q) if x >= 0 else -(k * q)


def ceil_int(x):
    x = _F(x)
    return -((-x.numerator) // x.denominator)


def floor_int(x):
    x = _F(x)
    return x.numerator // x.denominator


def show(x, quantum=CENT):
    """Decimal for display, rounded half up to the quantum (cents by default)."""
    if x is None:
        return None
    r = round_half_up(x, quantum)
    places = D('0.01') if _F(quantum) == CENT else D('1')
    return (D(r.numerator) / D(r.denominator)).quantize(places)


def _d(x):
    return x if isinstance(x, date) else date.fromisoformat(str(x))


STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
TAX_YEARS = (2025, 2026)       # years with published brackets and deductions
DATE_YEARS = (2025, 2026, 2027)  # years whose due dates the key works

# =====================================================================================================
# 1. This year's tax (the case's definition): regular income tax on max(0, interest - standard deduction)
# =====================================================================================================
# Bracket tops by rate, 10/12/22/24/32/35%; 37% has no top. Each row repeats the revenue procedure's "Over $X but not over
# $Y" lines; RP_BASE below is the procedure's "The Tax Is: $Z plus N% of the excess" column, rebuilt by check_tables().
RATES = (10, 12, 22, 24, 32, 35, 37)
BRACKET_TOPS = {
    2025: {
        'married_joint':     (23850, 96950, 206700, 394600, 501050, 751600),   # RP2440 s.2.01 Table 1 (s.1(j)(2)(A)); unchanged by PL11921 (RP2532 s.3 changes only 2.15 and 2.25); read 2026-10-31
        'head_of_household': (17000, 64850, 103350, 197300, 250500, 626350),   # RP2440 s.2.01 Table 2 (s.1(j)(2)(B)); read 2026-10-31
        'single':            (11925, 48475, 103350, 197300, 250525, 626350),   # RP2440 s.2.01 Table 3 (s.1(j)(2)(C)); read 2026-10-31
        'married_separate':  (11925, 48475, 103350, 197300, 250525, 375800),   # RP2440 s.2.01 Table 4 (s.1(j)(2)(D)); read 2026-10-31
    },
    2026: {
        'married_joint':     (24800, 100800, 211400, 403550, 512450, 768700),  # RP2532 s.4.01 Table 1; read 2026-10-31
        'head_of_household': (17700, 67450, 105700, 201750, 256200, 640600),   # RP2532 s.4.01 Table 2; read 2026-10-31
        'single':            (12400, 50400, 105700, 201775, 256225, 640600),   # RP2532 s.4.01 Table 3; read 2026-10-31
        'married_separate':  (12400, 50400, 105700, 201775, 256225, 384350),   # RP2532 s.4.01 Table 4; read 2026-10-31
    },
}
RP_BASE = {  # "The Tax Is" amount at the bottom of each bracket, as printed
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
    2025: {'married_joint': 31500, 'head_of_household': 23625, 'single': 15750, 'married_separate': 15750},
    # 2025: PL11921 s.70102(b) ("inserting $23,625" / "$15,750"; joint = 200% under 63(c)(2)(A)); RP2532 s.3.01 table
    # ("$31,500 / $23,625 / $15,750 / $15,750"; "section 2.15(1) of Rev. Proc. 2024-40 is removed"); read 2026-10-31
    2026: {'married_joint': 32200, 'head_of_household': 24150, 'single': 16100, 'married_separate': 16100},
    # 2026: RP2532 s.4.14(1) ("$32,200 / $24,150 / $16,100 / $16,100"); read 2026-10-31
}
SUPERSEDED_2025_STANDARD_DEDUCTION = {'married_joint': 30000, 'head_of_household': 22500, 'single': 15000, 'married_separate': 15000}  # RP2440 s.2.15(1), removed by RP2532 s.3.01; kept only so check_tables() can show it is not used; read 2026-10-31
AGE65_RULE = 'born on January 1 of (year - 64) or earlier = 65 at year end'  # I1040 "If you were born on January 1, 1961, you are considered to be age 65 at the end of 2025"; "born before January 2, 1961"; read 2026-10-31
NIIT_RATE = F(38, 1000)  # USC1411 (a)(1) "a tax equal to 3.8 percent of the lesser of"; read 2026-10-31
NIIT_THRESHOLD = {'married_joint': 250000, 'married_separate': 125000, 'single': 200000, 'head_of_household': 200000}  # USC1411 (b)(1) "$250,000", (b)(2) "1/2 of the dollar amount determined under paragraph (1)", (b)(3) "$200,000"; read 2026-10-31
TAX_TABLE_LIMIT = 100000  # I1040 "If your taxable income is less than $100,000, you must use the Tax Table"; read 2026-10-31


def is_65_or_older(birth, year):
    """True when a person born on `birth` counts as 65 or older at the end of `year` (I1040 day-before rule)."""
    return _d(birth) <= date(year - 64, 1, 1)


def regular_tax(year, status, taxable_income):
    """Exact Tax Computation formula on the year's brackets (no Tax Table rounding), the case's definition and the
    federal key's (FEDKEY s.1 "Tax is worked with the Tax Computation formula on exact amounts")."""
    if year not in BRACKET_TOPS:
        raise ValueError('%s: the key has no brackets for this year (2027 rows test due dates only)' % year)
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


def tax_table_tax(year, status, taxable_income):
    """The Tax Table amount the Form 1040 instructions require under $100,000 (contrast only): the formula tax at the
    middle of the row, rounded to the whole dollar (half up). Rows: [0,5) is 0; [5,15) and [15,25) use 10 and 20;
    then $25 rows to $3,000 and $50 rows to $100,000 (I1040 2025 Tax Table rows "0 5 0", "5 15 1", "15 25 2", "25 50 4",
    "3,000 3,050 303", "25,300 25,350 ... 2,562", "73,900 73,950 11,178 8,394 11,178 9,439"). For 2026 no Tax Table is
    published yet (NOT VERIFIED); the same method is assumed."""
    x = _F(taxable_income)
    if x >= TAX_TABLE_LIMIT:
        return regular_tax(year, status, x)
    if x < 5:
        return F(0)
    if x < 15:
        mid = F(10)
    elif x < 25:
        mid = F(20)
    elif x < 3000:
        mid = floor_int(x / 25) * 25 + F(25, 2)
    else:
        mid = floor_int(x / 50) * 50 + 25
    return round_half_up(regular_tax(year, status, mid))


def standard_deduction(year, status):
    return F(STANDARD_DEDUCTION[year][status])


def case_tax(year, status, other_income, births=()):
    """This year's total federal tax as the case defines it. Refuses 2027 (no tax: due dates only) and anyone 65 or
    older at year end (the case excludes them: the 65+ additions and the 2025-2028 senior deduction would apply)."""
    if year not in TAX_YEARS:
        raise ValueError('%s: 2027 rows are dropped from tax and only test due dates' % year)
    for b in births:
        if is_65_or_older(b, year):
            raise ValueError('born %s is 65 or older at the end of %s; the case allows nobody 65+' % (b, year))
    return regular_tax(year, status, max(F(0), _F(other_income) - standard_deduction(year, status)))


def niit(status, magi, net_investment_income):
    """Net investment income tax (chapter 2A). Not in the case's tax, but in 6654(f)(3)'s "tax": law contrast column."""
    return NIIT_RATE * min(max(F(0), _F(net_investment_income)), max(F(0), _F(magi) - NIIT_THRESHOLD[status]))


# Alternative minimum tax figures, used only by check_tables() to show that AMT is zero for every interest-only case.
AMT = {
    2025: {'exemption': {'married_joint': 137000, 'single': 88100, 'head_of_household': 88100, 'married_separate': 68500},   # RP2440 s.2.11 (unmarried = single and HoH); read 2026-10-31
           'phaseout_start': {'married_joint': 1252700, 'single': 626350, 'head_of_household': 626350, 'married_separate': 626350},  # RP2440 s.2.11 "Threshold Phaseout Amount"; read 2026-10-31
           'complete': {'married_joint': 1800700, 'single': 978750, 'head_of_household': 978750, 'married_separate': 900350},       # RP2440 s.2.11 "Complete Phaseout Amount" (implies the 25% rate); read 2026-10-31
           'breakpoint': {'married_separate': 119550, 'other': 239100}},  # RP2440 s.2.11 28% rate above this "excess taxable income"; read 2026-10-31
    2026: {'exemption': {'married_joint': 140200, 'single': 90100, 'head_of_household': 90100, 'married_separate': 70100},   # RP2532 s.4.10; read 2026-10-31
           'phaseout_start': {'married_joint': 1000000, 'single': 500000, 'head_of_household': 500000, 'married_separate': 500000},  # RP2532 s.4.10; read 2026-10-31
           'complete': {'married_joint': 1280400, 'single': 680200, 'head_of_household': 680200, 'married_separate': 640200},       # RP2532 s.4.10 (implies the 50% rate, USC55 (d)(4)(A)(ii)(IV)); read 2026-10-31
           'breakpoint': {'married_separate': 122250, 'other': 244500}},  # RP2532 s.4.10; read 2026-10-31
}
AMT_RATES = (F(26, 100), F(28, 100))  # USC55 (b)(1)(A)(i) "26 percent", (ii) "28 percent"; read 2026-10-31


def amt_tentative_upper(year, status, amti):
    """An upper bound on the tentative minimum tax (USC55 (b)(1)(A), (d)): exemption phased out at the rate the revenue
    procedure's complete-phaseout amount implies, and for married filing separately the (d)(2) add-back taken at the
    larger 50% rate (the 25%/50% reading of the add-back sentence does not matter for a bound). No 55(b)(3) gains rates
    (interest only)."""
    a = AMT[year]
    x = max(F(0), _F(amti))
    e, t, c = F(a['exemption'][status]), F(a['phaseout_start'][status]), F(a['complete'][status])
    rate = e / (c - t)
    ex = max(F(0), e - rate * max(F(0), x - t))
    if status == 'married_separate':
        x = x + min(e, F(1, 2) * max(F(0), x - c))
    te = max(F(0), x - ex)
    bp = F(a['breakpoint']['married_separate' if status == 'married_separate' else 'other'])
    return AMT_RATES[0] * min(te, bp) + AMT_RATES[1] * max(F(0), te - bp)


# =====================================================================================================
# 2. The estimated-tax rules (26 U.S.C. 6654)
# =====================================================================================================
INSTALLMENTS = 4                # USC6654 (c)(1) "There shall be 4 required installments for each taxable year."; read 2026-10-31
INSTALLMENT_SHARE = F(25, 100)  # USC6654 (d)(1)(A) "the amount of any required installment shall be 25 percent of the required annual payment"; read 2026-10-31
CURRENT_YEAR_SHARE = F(90, 100)  # USC6654 (d)(1)(B)(i) "90 percent of the tax shown on the return for the taxable year"; ES25/ES26 General Rule 2a; read 2026-10-31
PRIOR_YEAR_SHARE = F(100, 100)  # USC6654 (d)(1)(B)(ii) "100 percent of the tax shown on the return of the individual for the preceding taxable year"; read 2026-10-31
HIGH_AGI_SHARE = F(110, 100)    # USC6654 (d)(1)(C)(i) "by substituting '110 percent' for '100 percent'"; ES25/ES26 "substitute 110% for 100%"; read 2026-10-31
HIGH_AGI = 150000               # USC6654 (d)(1)(C)(i) "exceeds $150,000"; ES26 "more than $150,000"; read 2026-10-31
HIGH_AGI_SEPARATE = 75000       # USC6654 (d)(1)(C)(ii) "who files a separate return for the taxable year for which the amount of the installment is being determined ... '$75,000'"; ES26 "($75,000 if married filing separately for 2026)"; read 2026-10-31
SMALL_TAX = 1000                # USC6654 (e)(1) "reduced by the credit allowable under section 31, is less than $1,000"; F2210 line 7; read 2026-10-31
DUE_MONTH_DAY = ((4, 15, 0), (6, 15, 0), (9, 15, 0), (1, 15, 1))  # USC6654 (c)(2) "1st April 15 / 2nd June 15 / 3rd September 15 / 4th January 15 of the following taxable year" (third item: years after the tax year); read 2026-10-31
JAN31_OPTION = (1, 31)          # USC6654 (h) "If, on or before January 31 of the following taxable year, the taxpayer files a return ... and pays in full"; read 2026-10-31

# Page conventions (the task's documented model, rules 5, 7, 8 and 9; no legal source exists for these).
PAID_TOLERANCE = F(1)           # page convention (task rule 5) "paid (cumulative paid >= cumulative share - $1)"; no legal source; read 2026-10-31
ABOUT_RIGHT = 500               # page convention (task rule 8) "about right when |balance| < 500"; no legal source; read 2026-10-31
PAGE_PENALTY_BALANCE = 1000     # withholding page flag: tax less withholding only >= 1,000, the 6654(e)(1) test (the page counted estimates too until 2026-10-31); read 2026-10-31
PAYCHECKS_PER_YEAR = {'weekly': 52, 'biweekly': 26, 'semimonthly': 24, 'monthly': 12}  # page convention (task rule 7) "52/26/24/12 a year"; read 2026-10-31
DAYS_PER_YEAR = F(36525, 100)   # page convention (task rule 7) "floor(days from today to December 31 / 365.25 x paychecks a year)"; read 2026-10-31


def required_annual_payment(year, status, this_tax, prior_tax=None, prior_agi=None):
    """6654(d)(1)(B)-(C). Returns dict(required, basis, prior_share). A blank prior_tax: 90% of this year's (clause (ii)
    needs a filed 12-month return; the key's convention: typed = filed, 12 months). A blank prior_agi with a typed
    prior_tax: 100% (the key cannot see an AGI over $150,000). 'Exceeds' is strict: $150,000 exactly is 100%.
    A tie ('lesser of' two equal amounts; no source decides): last year's, the figure a filed return fixes (and, at 0 = 0,
    the 6654(e)(2) case); the amount is the same either way."""
    cur = CURRENT_YEAR_SHARE * _F(this_tax)
    pt, pa = _opt(prior_tax), _opt(prior_agi)
    if pt is None:
        return {'required': cur, 'basis': '90% of this year', 'prior_share': None}
    limit = HIGH_AGI_SEPARATE if status == 'married_separate' else HIGH_AGI
    share = HIGH_AGI_SHARE if (pa is not None and pa > limit) else PRIOR_YEAR_SHARE
    prior = share * pt
    if prior <= cur:
        return {'required': prior, 'basis': '%d%% of last year' % int(share * 100), 'prior_share': share}
    return {'required': cur, 'basis': '90% of this year', 'prior_share': share}


def zero_prior_exemption(prior_tax):
    """6654(e)(2): no addition at all when last year was 12 months, with no liability, and the person was a citizen or
    resident all year. Convention: a typed 0 means all three hold (filed, full year, citizen); blank means unknown."""
    pt = _opt(prior_tax)
    return pt is not None and pt == 0


def small_tax_exemption(this_tax, withholding):
    """6654(e)(1): this year's tax reduced by the section 31 credit (withholding only, never estimated payments) under $1,000."""
    return _F(this_tax) - _F(withholding) < SMALL_TAX


def amount_by_estimates(required, withholding):
    """Rule 3: what is left for estimates once withholding (deemed paid in four equal parts, 6654(g)(1)) is counted."""
    return max(F(0), _F(required) - _F(withholding))


def cumulative_shares(amount):
    """25/50/75/100% of the amount to pay by estimates (6654(d)(1)(A) with (g)(1))."""
    a = _F(amount)
    return tuple(a * k * INSTALLMENT_SHARE for k in range(1, INSTALLMENTS + 1))


# =====================================================================================================
# 3. Due dates: 6654(c)(2) moved by 7503 past Saturdays, Sundays and District of Columbia legal holidays
# =====================================================================================================
MON, TUE, WED, THU, FRI, SAT, SUN = range(7)
# D.C. Code 28-2701 (the list 26 CFR 301.7503-1(b) points to): "New Year's Day, January 1; Dr. Martin Luther King, Jr.'s
# Birthday, the third Monday in January; Washington's Birthday, the third Monday in February; District of Columbia
# Emancipation Day, April 16; Memorial Day, the last Monday in May; Juneteenth National Independence Day, June 19;
# Independence Day, July 4; Labor Day, the first Monday in September; Indigenous Peoples' Day, the second Monday in
# October; Veteran's Day, November 11; Thanksgiving Day, the fourth Thursday in November; Christmas Day, December 25;
# ... and the day of the inauguration of the President, in every fourth year". Read 2026-10-31.
DC_HOLIDAYS = (
    ('New Year\'s Day', ('fixed', 1, 1)),                       # DC28; DC1612 (a)(1); USC6103 (a); read 2026-10-31
    ('Birthday of Martin Luther King, Jr.', ('nth', 1, MON, 3)),  # DC28 "the third Monday in January"; USC6103 (a); read 2026-10-31
    ('Washington\'s Birthday', ('nth', 2, MON, 3)),             # DC28 "the third Monday in February"; read 2026-10-31
    ('District of Columbia Emancipation Day', ('fixed', 4, 16)),  # DC28 "April 16"; DC1612 (a)(11) "Beginning in the year 2007"; RR1513; read 2026-10-31
    ('Memorial Day', ('last', 5, MON)),                          # DC28 "the last Monday in May"; read 2026-10-31
    ('Juneteenth National Independence Day', ('fixed', 6, 19)),  # DC28 "June 19"; DC1612 (a)(4A); USC6103 (a) (Pub. L. 117-17); read 2026-10-31
    ('Independence Day', ('fixed', 7, 4)),                       # DC28 "July 4"; read 2026-10-31
    ('Labor Day', ('nth', 9, MON, 1)),                           # DC28 "the first Monday in September"; read 2026-10-31
    ('Indigenous Peoples\' Day (Columbus Day)', ('nth', 10, MON, 2)),  # DC28 "the second Monday in October"; USC6103 "Columbus Day"; read 2026-10-31
    ('Veterans Day', ('fixed', 11, 11)),                         # DC28 "November 11"; read 2026-10-31
    ('Thanksgiving Day', ('nth', 11, THU, 4)),                   # DC28 "the fourth Thursday in November"; read 2026-10-31
    ('Christmas Day', ('fixed', 12, 25)),                        # DC28 "December 25"; read 2026-10-31
)
# DC28: "When a day set apart as a legal holiday, other than the day of the inauguration of the President, falls on a
# Saturday, the next preceding day is a holiday. When a day set apart as a legal holiday falls on a Sunday, the next
# succeeding day is a holiday." RR1513 quotes the same for Emancipation Day. Read 2026-10-31.
INAUGURATION_EVERY = 4          # DC28 "the day of the inauguration of the President, in every fourth year"; USC6103 (c) "January 20 of each fourth year after 1965"; read 2026-10-31
PATRIOTS_DAY = (4, MON, 3)      # MAGL Eighteenth "the third Monday in April"; MERS "Patriot's Day, the 3rd Monday in April"; RR1513; read 2026-10-31
PATRIOTS_DAY_STATES = ('MA', 'ME')  # RR1513 "a statewide legal holiday in Massachusetts and Maine"; read 2026-10-31


def nth_weekday(year, month, weekday, n):
    first = date(year, month, 1)
    return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))


def last_weekday(year, month, weekday):
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    last = nxt - timedelta(days=1)
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def _holiday_date(rule, year):
    kind = rule[0]
    if kind == 'fixed':
        return date(year, rule[1], rule[2])
    if kind == 'nth':
        return nth_weekday(year, rule[1], rule[2], rule[3])
    return last_weekday(year, rule[1], rule[2])


def dc_legal_holidays(year):
    """{date: name} of District of Columbia legal holidays on a weekday of calendar `year`, with the Saturday -> Friday and
    Sunday -> Monday days DC28 adds (so New Year's Day 2028, a Saturday, makes Friday Dec 31, 2027 a holiday, as P509_27
    lists it). Inauguration Day: January 20 of 1965 + 4k (January 21 when the 20th is a Sunday, USC6103 (c))."""
    out = {}
    for y in (year - 1, year, year + 1):
        for name, rule in DC_HOLIDAYS:
            d = _holiday_date(rule, y)
            for day, label in ((d, name),
                               (d - timedelta(days=1), name + ' (observed)') if d.weekday() == SAT else (None, None),
                               (d + timedelta(days=1), name + ' (observed)') if d.weekday() == SUN else (None, None)):
                if day is not None and day.year == year and day.weekday() < SAT:   # a weekend day is skipped anyway
                    out.setdefault(day, label)
        if (y - 1965) % INAUGURATION_EVERY == 0:
            d = date(y, 1, 20)
            d = d + timedelta(days=1) if d.weekday() == SUN else d
            if d.year == year and d.weekday() < SAT:
                out.setdefault(d, 'Inauguration Day')
    return out


def patriots_day(year):
    return nth_weekday(year, PATRIOTS_DAY[0], PATRIOTS_DAY[1], PATRIOTS_DAY[2])


def next_business_day(d, extra=()):
    """7503: d itself if it is not a Saturday, Sunday or legal holiday, else the next day that is none of them.
    Returns (date, reasons) with one reason per day skipped."""
    d, why = _d(d), []
    while True:
        hol = dc_legal_holidays(d.year)
        if d.weekday() == SAT:
            why.append('%s Saturday' % d.isoformat())
        elif d.weekday() == SUN:
            why.append('%s Sunday' % d.isoformat())
        elif d in hol:
            why.append('%s %s' % (d.isoformat(), hol[d]))
        elif d in extra:
            why.append('%s %s' % (d.isoformat(), extra[d]))
        else:
            return d, why
        d += timedelta(days=1)


def nominal_due_date(year, quarter):
    m, dd, plus = DUE_MONTH_DAY[quarter - 1]
    return date(year + plus, m, dd)


def due_date(year, quarter, state=None, mode='law'):
    """Due date of installment `quarter` (1-4) for a calendar `year`, with the reasons it moved.
    mode='law': Saturdays, Sundays and DC legal holidays only, for every filer. Patriots' Day never moves an estimated
      payment: RR1513 "The fact that A is a resident of Massachusetts ... has no effect on A's due date for payment of A's
      first installment of estimated tax" (the vouchers go to an office outside MA and ME; ES26 lists Louisville, KY);
      ES24 printed "April 15, 2024" for the first payment though April 15, 2024 was Patriots' Day.
    mode='page': the task's documented convention: also Patriots' Day for MA and ME filers, April payment only."""
    extra = {}
    if mode == 'page' and quarter == 1 and (state or '').upper() in PATRIOTS_DAY_STATES:
        extra = {patriots_day(year): "Patriots' Day (MA, ME)"}
    elif mode not in ('law', 'page'):
        raise ValueError(mode)
    return next_business_day(nominal_due_date(year, quarter), extra)


def due_dates(year, state=None, mode='law'):
    return tuple(due_date(year, q, state, mode)[0] for q in range(1, INSTALLMENTS + 1))


def jan31_option_date(year):
    """6654(h) last day to file and pay in full so the 4th installment carries no addition, moved by 7503 as the IRS
    prints it (ES25 "by February 2, 2026"; ES26 "by February 1, 2027"; P509_26, P509_27). I2210 (2025) prints
    "by January 31, 2026" without the move; contrast note only."""
    return next_business_day(date(year + 1, JAN31_OPTION[0], JAN31_OPTION[1]))[0]


# What the IRS printed (check_tables() rebuilds each one).
IRS_DUE_DATES = {
    2024: ('2024-04-15', '2024-06-17', '2024-09-16', '2025-01-15'),  # ES24 Payment Due Dates "April 15, 2024 / June 17, 2024 / Sept. 16, 2024 / Jan. 15, 2025"; I2210 (2024) columns; read 2026-10-31
    2025: ('2025-04-15', '2025-06-16', '2025-09-15', '2026-01-15'),  # ES25 "April 15, 2025 / June 16, 2025 / Sept. 15, 2025 / Jan. 15, 2026"; vouchers "Calendar year-Due June 16, 2025"; P509_26 January 15; read 2026-10-31
    2026: ('2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'),  # ES26 "April 15, 2026 / June 15, 2026 / Sept. 15, 2026 / Jan. 15, 2027"; P509_26; P509_27 (draft) January 15; read 2026-10-31
    2027: ('2027-04-15', '2027-06-15', '2027-09-15', None),          # P509_27 DRAFT April 15 "first installment of your 2027 estimated tax", June 15 "second installment date", September 15 "third installment date"; January 2028 not published; read 2026-10-31
}
IRS_JAN31_OPTION = {
    2025: '2026-02-02',  # ES25 "if you file your 2025 tax return by February 2, 2026"; P509_26 "pay all tax due by February 2, 2026" (I2210 2025 says "by January 31, 2026"); read 2026-10-31
    2026: '2027-02-01',  # ES26 "if you file your 2026 tax return by February 1, 2027"; P509_27 DRAFT "by February 1, 2027"; read 2026-10-31
}
IRS_LEGAL_HOLIDAYS = {
    2026: ('2026-01-01', '2026-01-19', '2026-02-16', '2026-04-16', '2026-05-25', '2026-06-19', '2026-07-03',
           '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25'),  # P509_26 "Legal holidays occurring in 2026" (July 3 "Independence Day (observed)"); read 2026-10-31
    2027: ('2027-01-01', '2027-01-18', '2027-02-15', '2027-04-16', '2027-05-31', '2027-06-18', '2027-07-05',
           '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-24', '2027-12-31'),  # P509_27 DRAFT list ("June 18 ... (observed)", "December 31-New Year's Day 2028 (observed)"); read 2026-10-31
}


# =====================================================================================================
# 4. Projected withholding (Withholding check), the page's conventions
# =====================================================================================================
def paychecks_left(today, year, period):
    """Page convention: floor(days from today to December 31 / 365.25 x paychecks a year), never below 0 (today in the
    January after the year) and at most a year's. No legal rule; real paydays would need a first payday (none given)."""
    n = PAYCHECKS_PER_YEAR[period]
    days = (date(year, 12, 31) - _d(today)).days
    if days <= 0:
        return 0
    return min(n, floor_int(F(days) * n / DAYS_PER_YEAR))


def projected_withholding(today, year, people, so_far=None):
    """people: list (self first, then partner) of dicts {per_check, period, so_far?}; so_far: the household's typed
    "withheld so far" (None = blank). With a household so_far: so_far + sum(per_check x paychecks left). Without it, per
    person: so_far_i + per_check_i x left_i when that person's so_far is typed, else a full year per_check_i x n_i.
    Returns dict(total, has_figures, per_person=[...])."""
    sf = _opt(so_far)
    rows, total = [], F(0)
    has = sf is not None
    for p in people:
        per, period, own = _opt(p.get('per_check')), p.get('period'), _opt(p.get('so_far'))
        has = has or per is not None or own is not None
        left = paychecks_left(today, year, period) if (per is not None and period) else 0
        n = PAYCHECKS_PER_YEAR[period] if period else 0
        if per is None:
            amt = own or F(0)
        elif sf is not None or own is not None:
            amt = (own or F(0)) + per * left
        else:
            amt = per * n
        rows.append({'per_check': per, 'period': period, 'left': left, 'a_year': n, 'projected': amt})
        total += amt
    if sf is not None:
        total += sf
    return {'total': total, 'has_figures': has, 'per_person': rows}


# =====================================================================================================
# 5. Where you stand on "today" (Estimated payments), the page's conventions, and the law's installment test
# =====================================================================================================
def where_you_stand(today, dues, amount, paid, tol=PAID_TOLERANCE):
    """Page rules (task rule 5). paid: four typed amounts or None; every typed payment counts as paid now (a payment for
    a later quarter typed early included). 'covered' uses the same $1 tolerance as 'paid' (key's reading)."""
    today = _d(today)
    shares = cumulative_shares(amount)
    pays = [_opt(x) or F(0) for x in paid]
    total = sum(pays, F(0))
    remaining = max(F(0), _F(amount) - total)
    past = [today > d for d in dues]
    last_past = max([k + 1 for k in range(INSTALLMENTS) if past[k]], default=0)
    behind = min(remaining, max(F(0), (shares[last_past - 1] if last_past else F(0)) - total))
    covered = [total >= s - tol for s in shares]
    nxt = next((k + 1 for k in range(INSTALLMENTS) if not past[k] and not covered[k]), None)
    nxt_amt = min(remaining, max(F(0), shares[nxt - 1] - total - behind)) if nxt else F(0)
    status = []
    for k, d in enumerate(dues):
        if covered[k]:
            status.append('paid')
        elif past[k]:
            status.append('short')
        elif (today.year, today.month) == (d.year, d.month) and today <= d:
            status.append('due')
        else:
            status.append('upcoming')
    sensitive = any(s - tol <= total < s for s in shares if s > 0)   # a page without the $1 tolerance would differ
    # late on its own date: a past-due quarter whose boxes 1..k were under its share (less $1) when it fell due, even if a
    # later box has caught it up since (6654(b)(1)-(2): the charge runs from that date to the day it is paid)
    late = [k + 1 for k in range(INSTALLMENTS) if past[k] and sum(pays[:k + 1], F(0)) < shares[k] - tol]
    return {'shares': shares, 'late_on_its_date': late, 'total_paid': total, 'remaining': remaining, 'past_due': past, 'last_past_due': last_past,
            'behind': behind, 'next_quarter': nxt, 'next_amount': nxt_amt, 'next_due': dues[nxt - 1] if nxt else None,
            'status': status, 'tolerance_sensitive': sensitive}


def law_underpaid(today, dues, required, withholding, paid, only_past_due=True):
    """6654(b)(1), (b)(3), (g)(1): installment j is underpaid when everything paid by its due date (a quarter of the
    year's withholding on each due date, plus the estimated payments dated on or before it) is less than j quarters of
    the required annual payment. Each typed payment is dated at the latest day the row allows: its own due date, or
    today if that is earlier. only_past_due: look only at installments whose due date is before today."""
    today = _d(today)
    r, w = _F(required), _F(withholding)
    pays = [(_opt(x) or F(0), min(d, today)) for x, d in zip(paid, dues)]
    out = []
    for j, dj in enumerate(dues, start=1):
        if only_past_due and not today > dj:
            continue
        credited = w * j * INSTALLMENT_SHARE + sum((a for a, when in pays if when <= dj), F(0))
        need = r * j * INSTALLMENT_SHARE
        if credited < need:
            out.append((j, need - credited))
    return out


# =====================================================================================================
# 6. Balance, verdict, W-4 suggestion, and the penalty flags
# =====================================================================================================
def balance_at_filing(this_tax, withholding, estimates_paid):
    return _F(this_tax) - _F(withholding) - _F(estimates_paid)


def verdict(has_figures, balance):
    if not has_figures:
        return 'unknown'
    b = _F(balance)
    if abs(b) < ABOUT_RIGHT:
        return 'about right'
    return 'owe' if b > 0 else 'refund'


def w4_suggestion(v, balance, wh):
    """Page: owe -> ceil(balance / left) more a paycheck for the first person with paychecks left; refund -> floor(-balance
    / left) less; owing with nobody's pay left to change -> use estimates. Returns (kind, person index, dollars, ambiguous):
    ambiguous is True when somebody has a per-paycheck amount but no paycheck is left (the page's words "nothing withheld
    from pay" do not say which way it goes; the key answers 'use estimates')."""
    first = next((i for i, p in enumerate(wh['per_person']) if p['per_check'] is not None and p['left'] > 0), None)
    ambiguous = first is None and any(p['per_check'] is not None for p in wh['per_person'])
    b = _F(balance)
    if v == 'owe':
        if first is None:
            return ('use estimates', None, None, ambiguous)
        return ('more', first, ceil_int(b / wh['per_person'][first]['left']), False)
    if v == 'refund' and first is not None:
        return ('less', first, floor_int(-b / wh['per_person'][first]['left']), False)
    return (None, None, None, False)


def page_withholding_flag(has_figures, tax_less_withholding, withholding, estimates_paid, required):
    """Withholding figures typed, this year's tax less withholding (not estimated payments: 6654(e)(1), Form 2210 line 6)
    at least $1,000, and withholding plus estimates under the safe amount. Until 2026-10-31 the page tested the balance
    after estimates; the verify step found that misleading and the page now follows the law's $1,000 test."""
    return bool(has_figures and _F(tax_less_withholding) >= PAGE_PENALTY_BALANCE and _F(withholding) + _F(estimates_paid) < _F(required))


def page_estimates_flag(estimates_needed, total_paid, amount, late_on_its_date):
    """Estimates needed, something still to pay for the year, and some past-due quarter was short on its own due date
    (its boxes 1..k under its share less $1), caught up since or not. A quarter 'short' now is always one of those."""
    return bool(estimates_needed and _F(total_paid) + 1 < _F(amount) and late_on_its_date)


def law_flag(this_tax, withholding, prior_tax, underpaid):
    """Exposure under the law: the $1,000 test fails, the zero-tax exemption does not apply, and some installment due
    before today was underpaid on its due date. The amount of the addition (6621 rate x days) is out of scope."""
    return bool(not small_tax_exemption(this_tax, withholding) and not zero_prior_exemption(prior_tax) and underpaid)


# =====================================================================================================
# 7. One CSV row
# =====================================================================================================
def evaluate(case):
    """case keys: year, today, state, filing_status, births (1-2 ISO dates), other_income, prior_tax, prior_agi,
    withheld_so_far, per_check_self, period_self, per_check_partner, period_partner, paid_q1..paid_q4, and optionally
    total_tax (a tax given directly; the key derives none for 2027). Blank = None. Returns every output column."""
    year, today, state = int(case['year']), _d(case['today']), (case.get('state') or '').upper()
    status = case['filing_status']
    if status not in STATUSES:
        raise ValueError(status)
    if year not in DATE_YEARS or not date(year, 1, 1) <= today <= date(year + 1, 1, 31):
        raise ValueError('today %s outside January 1 of %s to January 31 of the next year' % (today, year))
    births = [b for b in (case.get('births') or []) if b]
    if not 1 <= len(births) <= 2 or any(not 1960 <= _d(b).year <= 1995 for b in births):
        raise ValueError('one or two adults born 1960-1995')
    law_dues = due_dates(year, state, 'law')
    page_dues = due_dates(year, state, 'page')
    out = {'due_law': law_dues, 'due_page': page_dues, 'jan31_option': jan31_option_date(year),
           'due_reasons': [due_date(year, q, state, 'law')[1] for q in range(1, 5)]}
    given = _opt(case.get('total_tax'))
    if year not in TAX_YEARS and given is None:
        out['tax'] = None   # 2027: due dates only
        return out
    tax = given if given is not None else case_tax(year, status, case['other_income'], births)
    out['tax'] = tax
    if given is None:
        inc = _F(case['other_income'])
        ti = max(F(0), inc - standard_deduction(year, status))
        out['law_tax_with_niit'] = tax + niit(status, inc, inc)
        out['tax_table_tax'] = tax_table_tax(year, status, ti)
    people = []
    for who in ('self', 'partner'):
        per, per_d = case.get('per_check_' + who), case.get('period_' + who)
        if _opt(per) is not None or per_d:
            people.append({'per_check': per, 'period': per_d})
    wh = projected_withholding(today, year, people, case.get('withheld_so_far'))
    w = wh['total']
    # The law credits a separate or single return only with the filer's own withholding (section 31): contrast column.
    if status == 'married_joint' or len(wh['per_person']) <= 1:
        w_law = w
    else:
        w_law = (_opt(case.get('withheld_so_far')) or F(0)) + wh['per_person'][0]['projected']
    req = required_annual_payment(year, status, tax, case.get('prior_tax'), case.get('prior_agi'))
    amount = amount_by_estimates(req['required'], w)
    paid = [case.get('paid_q%d' % k) for k in range(1, 5)]
    stand = where_you_stand(today, page_dues, amount, paid)
    bal = balance_at_filing(tax, w, stand['total_paid'])
    v = verdict(wh['has_figures'], bal)
    needed = amount > 0 and not small_tax_exemption(tax, w)
    under = law_underpaid(today, law_dues, req['required'], w_law, paid)
    out.update({
        'required': req['required'], 'required_basis': req['basis'],
        'small_tax_exemption': small_tax_exemption(tax, w_law), 'zero_prior_exemption': zero_prior_exemption(case.get('prior_tax')),
        'withholding': w, 'withholding_law': w_law, 'has_withholding': wh['has_figures'],
        'paychecks_left': [p['left'] for p in wh['per_person']],
        'amount_by_estimates': amount, 'estimates_needed': needed, 'estimates_needed_amount_only': amount > 0,
        'shares': stand['shares'], 'status': stand['status'], 'behind': stand['behind'],
        'next_quarter': stand['next_quarter'], 'next_amount': stand['next_amount'], 'next_due': stand['next_due'],
        'total_paid': stand['total_paid'], 'remaining': stand['remaining'], 'tolerance_sensitive': stand['tolerance_sensitive'],
        'balance': bal, 'verdict': v, 'w4': w4_suggestion(v, bal, wh),
        'page_flag_withholding': page_withholding_flag(wh['has_figures'], _F(tax) - _F(w), w, stand['total_paid'], req['required']),
        'page_flag_estimates': page_estimates_flag(needed, stand['total_paid'], amount, stand['late_on_its_date']),
        'law_underpaid': under, 'law_flag': law_flag(tax, w_law, case.get('prior_tax'), under),
        'law_underpaid_full_year': law_underpaid(today, law_dues, req['required'], w_law, paid, only_past_due=False),
    })
    return out


# =====================================================================================================
# 8. Checks: every figure the key can rebuild, the IRS's printed dates and holidays, and the RULES.md examples
# =====================================================================================================
def check_tables():
    # Brackets: the procedure's "The Tax Is" base of each bracket is the formula tax at the bracket's bottom.
    for y in BRACKET_TOPS:
        for s in STATUSES:
            tops = BRACKET_TOPS[y][s]
            assert list(tops) == sorted(tops) and len(tops) == 6
            bottoms = (0,) + tops
            for b, base in zip(bottoms, RP_BASE[y][s]):
                assert regular_tax(y, s, b) == _F(base), (y, s, b)
        # joint brackets are twice single up to the 32% top (1(j)(2)); separate equals single except the 35% top (half joint)
        assert BRACKET_TOPS[y]['married_joint'][:5] == tuple(2 * t for t in BRACKET_TOPS[y]['single'][:5])
        assert BRACKET_TOPS[y]['married_separate'][5] * 2 == BRACKET_TOPS[y]['married_joint'][5]
        sd = STANDARD_DEDUCTION[y]
        assert sd['married_joint'] == 2 * sd['single'] and sd['married_separate'] == sd['single']
    assert STANDARD_DEDUCTION[2025] != SUPERSEDED_2025_STANDARD_DEDUCTION
    # Federal key (tests/golden/taxes/RULES.md s.1-2) has the same figures.
    assert BRACKET_TOPS[2025]['head_of_household'] == (17000, 64850, 103350, 197300, 250500, 626350)
    assert BRACKET_TOPS[2026]['head_of_household'] == (17700, 67450, 105700, 201750, 256200, 640600)
    # Tax Table rows printed in I1040 (2025).
    assert tax_table_tax(2025, 'single', 3) == 0 and tax_table_tax(2025, 'single', 10) == 1 and tax_table_tax(2025, 'single', 20) == 2
    assert tax_table_tax(2025, 'single', 30) == 4 and tax_table_tax(2025, 'married_joint', 3010) == 303
    assert tax_table_tax(2025, 'married_joint', 25300) == 2562
    assert [tax_table_tax(2025, s, 73900) for s in ('single', 'married_joint', 'married_separate', 'head_of_household')] == [11178, 8394, 11178, 9439]
    assert [tax_table_tax(2025, s, 99999) for s in ('single', 'married_joint', 'married_separate', 'head_of_household')] == [16909, 11823, 16909, 15170]
    # Age rule: born January 1, 1961 is 65 at the end of 2025; January 2, 1961 is not.
    assert is_65_or_older('1961-01-01', 2025) and not is_65_or_older('1961-01-02', 2025) and is_65_or_older('1960-06-30', 2025)
    assert is_65_or_older('1962-01-01', 2026) and not is_65_or_older('1962-01-02', 2026)
    # AMT never applies to an interest-only return with the standard deduction: the tentative minimum tax (upper bound)
    # stays at or under the regular tax at every kink of both schedules and on a $500 grid to $3,000,000; past the last
    # kink the regular tax grows at 37% and the bound at 28%, so the difference keeps growing.
    for y in TAX_YEARS:
        for s in STATUSES:
            sd = standard_deduction(y, s)
            a = AMT[y]
            e, t, c = F(a['exemption'][s]), F(a['phaseout_start'][s]), F(a['complete'][s])
            bp = F(a['breakpoint']['married_separate' if s == 'married_separate' else 'other'])
            te_kinks = sorted({F(0), e, t, c, c + 2 * e, F(3000000)})   # where the taxable excess changes slope

            def te(x):
                ex = max(F(0), e - e / (c - t) * max(F(0), x - t))
                x2 = x + (min(e, F(1, 2) * max(F(0), x - c)) if s == 'married_separate' else 0)
                return max(F(0), x2 - ex)
            kinks = set(te_kinks) | {F(top) + sd for top in BRACKET_TOPS[y][s]} | {sd}
            for lo, hi in zip(te_kinks, te_kinks[1:]):                     # where the taxable excess crosses the 28% line
                if te(lo) < bp < te(hi):
                    kinks.add(lo + (bp - te(lo)) * (hi - lo) / (te(hi) - te(lo)))
            for x in sorted(kinks | {F(v) for v in range(0, 3000001, 5000)}):
                assert amt_tentative_upper(y, s, x) <= regular_tax(y, s, max(F(0), x - sd)), (y, s, x)
    # Calendar: Patriots' Day, DC holidays as the IRS lists them, due dates as the IRS prints them.
    assert [patriots_day(y).isoformat() for y in (2024, 2025, 2026, 2027)] == ['2024-04-15', '2025-04-21', '2026-04-20', '2027-04-19']
    for y, days in IRS_LEGAL_HOLIDAYS.items():
        assert sorted(d.isoformat() for d in dc_legal_holidays(y)) == sorted(days), y
    for y, printed in IRS_DUE_DATES.items():
        for q, p in enumerate(printed, start=1):
            if p is not None:
                assert due_date(y, q)[0].isoformat() == p, (y, q)
                assert due_date(y, q, 'MA', 'law')[0].isoformat() == p   # Patriots' Day never moves an estimated payment
    for y, p in IRS_JAN31_OPTION.items():
        assert jan31_option_date(y).isoformat() == p
    # The hand-worked table of RULES.md section 4.
    worked = {
        2025: ('2025-04-15', '2025-06-16', '2025-09-15', '2026-01-15'),
        2026: ('2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'),
        2027: ('2027-04-15', '2027-06-15', '2027-09-15', '2028-01-18'),
    }
    for y, ds in worked.items():
        for st in (None, 'MA', 'ME', 'NY', 'DC'):
            for mode in ('law', 'page'):
                assert tuple(d.isoformat() for d in due_dates(y, st, mode)) == ds, (y, st, mode)
    assert due_date(2027, 4)[1] == ['2028-01-15 Saturday', '2028-01-16 Sunday', '2028-01-17 Birthday of Martin Luther King, Jr.']
    assert due_date(2025, 2)[1] == ['2025-06-15 Sunday']
    assert jan31_option_date(2027) == date(2028, 1, 31)
    # Where page and law part: 2024 (April 15 was Patriots' Day, April 16 Emancipation Day) and 2030.
    assert due_date(2024, 1, 'MA', 'page')[0] == date(2024, 4, 17) and due_date(2024, 1, 'MA', 'law')[0] == date(2024, 4, 15)
    assert due_date(2030, 1, 'ME', 'page')[0] == date(2030, 4, 17) and due_date(2030, 1, 'ME', 'law')[0] == date(2030, 4, 15)
    assert due_date(2024, 1, 'NY', 'page')[0] == date(2024, 4, 15)
    # RR1513's facts: April 15 a Friday, April 16 a Saturday (Emancipation Day observed Friday April 15): 2016 and 2022.
    assert due_date(2022, 1)[0] == date(2022, 4, 18) and due_date(2016, 1)[0] == date(2016, 4, 18)
    assert due_date(2022, 1, 'MA', 'page')[0] == date(2022, 4, 19)   # the return date RR1513 gives MA; the payment stays April 18
    # Required annual payment edges.
    assert required_annual_payment(2026, 'single', 10000, 9000, 150000)['required'] == 9000      # exactly $150,000: 100%
    assert required_annual_payment(2026, 'single', 20000, 9000, '150000.01')['required'] == 9900  # over: 110%
    assert required_annual_payment(2026, 'married_separate', 20000, 9000, 75001)['required'] == 9900
    assert required_annual_payment(2026, 'married_separate', 20000, 9000, 75000)['required'] == 9000
    assert required_annual_payment(2026, 'single', 10000, None, None)['required'] == 9000
    assert required_annual_payment(2026, 'single', 10000, 0, 5000)['required'] == 0 and zero_prior_exemption('0') and not zero_prior_exemption(None)
    # Paychecks left.
    assert paychecks_left('2026-01-01', 2026, 'weekly') == 51 and paychecks_left('2026-12-31', 2026, 'monthly') == 0
    assert paychecks_left('2027-01-10', 2026, 'biweekly') == 0 and paychecks_left('2026-07-01', 2026, 'biweekly') == 13
    assert paychecks_left('2026-08-01', 2026, 'monthly') == 4 and paychecks_left('2026-10-01', 2026, 'monthly') == 2
    _check_examples()


def _check_examples():
    # 8.1 Retired couple paying 110% of last year's tax (2026, married filing jointly, born 1964 and 1966).
    c1 = {'year': 2026, 'today': '2026-10-31', 'state': 'OR', 'filing_status': 'married_joint',
          'births': ['1964-05-10', '1966-02-03'], 'other_income': '250000', 'prior_tax': '30000', 'prior_agi': '210000',
          'paid_q1': '8250', 'paid_q2': '8250', 'paid_q3': '8250'}
    r = evaluate(c1)
    assert r['tax'] == 37468 and r['law_tax_with_niit'] == 37468 and r['required'] == 33000 and r['required_basis'] == '110% of last year'
    assert r['amount_by_estimates'] == 33000 and r['shares'] == (8250, 16500, 24750, 33000)
    assert r['status'] == ['paid', 'paid', 'paid', 'upcoming'] and r['behind'] == 0
    assert (r['next_quarter'], r['next_amount'], r['next_due']) == (4, 8250, date(2027, 1, 15))
    assert r['balance'] == 12718 and r['verdict'] == 'unknown' and r['w4'] == (None, None, None, False)
    assert not r['page_flag_estimates'] and not r['page_flag_withholding'] and not r['law_flag'] and r['law_underpaid'] == []
    assert required_annual_payment(2026, 'married_joint', 37468, 30000, 150000)['required'] == 30000
    # the same couple paying 7,500 a quarter (100% instead of 110%): Q1-Q3 short by 750 each under both page and law
    r = evaluate(dict(c1, paid_q1='7500', paid_q2='7500', paid_q3='7500'))
    assert r['status'] == ['paid', 'paid', 'short', 'upcoming'] and r['behind'] == 2250 and r['next_amount'] == 8250
    assert r['law_underpaid'] == [(1, 750), (2, 1500), (3, 2250)] and r['law_flag'] and r['page_flag_estimates']

    # 8.2 Skipped the first two payments, seen in July (2026, single, born 1985).
    c2 = {'year': 2026, 'today': '2026-07-20', 'state': 'TX', 'filing_status': 'single', 'births': ['1985-09-14'],
          'other_income': '90000', 'prior_tax': '12000', 'prior_agi': '85000'}
    r = evaluate(c2)
    assert r['tax'] == 10970 and r['required'] == F('9873') and r['required_basis'] == '90% of this year'
    assert r['shares'] == (F('2468.25'), F('4936.50'), F('7404.75'), F('9873'))
    assert r['status'] == ['short', 'short', 'upcoming', 'upcoming'] and r['behind'] == F('4936.50')
    assert (r['next_quarter'], r['next_amount'], r['next_due']) == (3, F('2468.25'), date(2026, 9, 15))
    assert r['page_flag_estimates'] and r['law_flag'] and r['law_underpaid'] == [(1, F('2468.25')), (2, F('4936.50'))]
    # she catches up the same day, typing 4,936.50 as the Q3 payment: the page shows Q1 and Q2 paid (credited oldest
    # first, 6654(b)(3)), and its flag stays on because both were short on their own dates, as the law says
    r = evaluate(dict(c2, paid_q3='4936.50'))
    assert r['status'] == ['paid', 'paid', 'upcoming', 'upcoming'] and r['behind'] == 0
    assert (r['next_quarter'], r['next_amount']) == (3, F('2468.25'))
    assert r['page_flag_estimates'] and r['law_flag'] and [j for j, _ in r['law_underpaid']] == [1, 2]

    # 8.3 A $950 balance with estimates that still miss the safe amount (2026, single, born 1975).
    c3 = {'year': 2026, 'today': '2026-10-01', 'state': 'MA', 'filing_status': 'single', 'births': ['1975-11-30'],
          'other_income': '52000', 'prior_tax': '4200', 'prior_agi': '50000', 'withheld_so_far': '1350',
          'per_check_self': '150', 'period_self': 'monthly', 'paid_q1': '700', 'paid_q2': '760'}
    r = evaluate(c3)
    assert r['tax'] == 4060 and r['required'] == F('3654') and r['paychecks_left'] == [2] and r['withholding'] == 1650
    assert r['balance'] == 950 and r['verdict'] == 'owe' and r['w4'] == ('more', 0, 475, False)
    assert r['page_flag_withholding'] and r['withholding'] + r['total_paid'] == 3110 < r['required']   # tax less withholding 2,410 >= 1,000
    assert r['amount_by_estimates'] == 2004 and r['shares'] == (501, 1002, 1503, 2004)
    assert r['status'] == ['paid', 'paid', 'short', 'upcoming'] and r['behind'] == 43
    assert (r['next_quarter'], r['next_amount'], r['next_due']) == (4, 501, date(2027, 1, 15))
    assert r['page_flag_estimates'] and r['law_flag'] and r['law_underpaid'] == [(3, F('43'))]
    assert not r['small_tax_exemption']                     # 4,060 - 1,650 = 2,410: estimates do not count in 6654(e)(1)
    # following the W-4 advice (+475 on each of the two paychecks left) cures the September shortfall under the law,
    # because withholding is deemed paid in equal parts on every due date (6654(g)(1))
    r2 = evaluate(dict(c3, per_check_self='625'))
    assert r2['withholding'] == 2600 and r2['balance'] == 0 and r2['verdict'] == 'about right' and r2['law_underpaid'] == []
    assert r2['amount_by_estimates'] == 1054 and r2['status'] == ['paid'] * 4
    # the same row seen on August 1, before September 15: nothing past due is short yet
    r3 = evaluate(dict(c3, today='2026-08-01', withheld_so_far='1050'))
    assert r3['paychecks_left'] == [4] and r3['withholding'] == 1650 and r3['balance'] == 950 and r3['w4'] == ('more', 0, 238, False)
    assert r3['law_underpaid'] == [] and not r3['law_flag'] and not r3['page_flag_estimates']

    # 8.4 Last year's tax of zero (2026, head of household, born 1990).
    c4 = {'year': 2026, 'today': '2026-06-20', 'state': 'ME', 'filing_status': 'head_of_household', 'births': ['1990-04-04'],
          'other_income': '60000', 'prior_tax': '0', 'prior_agi': '20000'}
    r = evaluate(c4)
    assert r['tax'] == 3948 and r['required'] == 0 and r['amount_by_estimates'] == 0 and not r['estimates_needed']
    assert r['status'] == ['paid'] * 4 and r['zero_prior_exemption'] and not r['law_flag'] and not r['page_flag_estimates']
    assert r['balance'] == 3948
    # the same row with last year's tax left blank: 90% of this year's is required
    r = evaluate(dict(c4, prior_tax=None, prior_agi=None))
    assert r['required'] == F('3553.20') and r['status'] == ['short', 'short', 'upcoming', 'upcoming'] and r['behind'] == F('1776.60')
    assert r['page_flag_estimates'] and r['law_flag']

    # 2027 rows: due dates only.
    r = evaluate({'year': 2027, 'today': '2028-01-10', 'state': 'MA', 'filing_status': 'single', 'births': ['1980-01-01'],
                  'other_income': '50000'})
    assert r['tax'] is None and r['due_law'][3] == date(2028, 1, 18) and r['due_page'] == r['due_law']
    try:
        case_tax(2027, 'single', 50000)
        raise AssertionError('2027 must be refused')
    except ValueError:
        pass
    try:
        case_tax(2025, 'single', 50000, ['1961-01-01'])
        raise AssertionError('65+ must be refused')
    except ValueError:
        pass


check_tables()
