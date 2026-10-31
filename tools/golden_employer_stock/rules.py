"""US rules for the answer key of the "Employer stock" page (RSUs and options), today's year 2026 and the next year, as
data plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or tests/*.test.mjs
while writing this file, and it never imports or runs the app. Only the layout and conventions of tools/golden_property/
and tools/golden_paycheck/ were looked at; no figure or code is shared with them. The 2026 federal brackets, standard
deductions and 0/15/20% breakpoints were read in Rev. Proc. 2025-32 itself and agree with tests/golden/taxes/RULES.md
(FEDKEY) ss.1, 2, 5, 8, tests/golden/tax-lots/RULES.md (TLKEY) s.5.1 and tests/golden/property/RULES.md (PROPKEY) s.6.1,
which are cited for them. Every figure names its source and the date it was read on the same line. Money is an exact
Fraction while it is worked and a Decimal when it is shown. Importing this file runs check_tables() (the self-checks).

The model (the page's documented conventions, "page" below; where the law says otherwise the key keeps the page's way in
the main column and gives the law in a law column, see tests/golden/employer-stock/RULES.md):
  VEST      months m = cliff, cliff + every, ... below vest_months, then vest_months (cliff 0: start at every); whole
            shares at m = floor(shares x m / vest_months); each vest = the change, dated vest_start + m calendar months
            (a day the month lacks falls back to its last day); vested = vests dated on or before today.
  POSITION  held value, vested options value (spread = max(0, price - strike)), owned, unvested, exposure, invested,
            share, level (10% / 25%), the loss in a halving.
  VEST TAX  RSU vests dated after today and on or before today + 12 months, valued at today's price, by calendar year;
            owed_year = tax(after) - tax(before) where tax = income tax + 0.9% Additional Medicare Tax (3101(b)(2));
            withheld = 22% / 37% past $1,000,000 of the year's supplemental wages (31.3402(g)-1(a)(2), (a)(7)) + the
            employer's 0.9% past $200,000 of its wages (3102(f)(1)); gap = owed - withheld; Illinois share.
  SALE      getting under 10%: the 401(k) first (no tax, 402(a)), then the brokerage; the gain taxed as long-term at
            0/15/20% stacked on top (1(h), 1(j)(5)) plus the 3.8% NIIT (1411); married filing separately by the owner.

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits). The U.S. Code pages are the OLRC
edition "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t26/s<N>/:
  USC1     26 U.S.C. 1(h)(1), (h)(3), (j)(1), (j)(2)(F), (j)(5) (1(j) made permanent by Pub. L. 119-21 s.70101)   (acce504c...3ce7938060)
  USC83    26 U.S.C. 83(a), (b), (c)(1), (e)(3)-(4), (f) (last amended Pub. L. 115-97, 2017, added (i))        (b4008bec...b7599f66be)
  USC402   26 U.S.C. 402(a) (an exempt 401(a) trust's amounts are taxable to the distributee when distributed)    (5e82a2eb...06a671254f)
  USC1211  26 U.S.C. 1211(b) ($3,000 / $1,500 capital loss limit; law contrast of a sale at a loss only)          (0ef67741...bf8b64dde3)
  USC1222  26 U.S.C. 1222(3) ("held for more than 1 year")                                                       (608100ea...b0cae9749a)
  USC1411  26 U.S.C. 1411(a)(1), (b), (c)(1), (d)                                                                (89721b18...741beafb33)
  USC3101  26 U.S.C. 3101(b)(1)-(2) (last amended Pub. L. 115-141, 2018)                                         (04bdb134...e071c36d77)
  USC3102  26 U.S.C. 3102(a), (f)(1)-(3)                                                                         (19f91715...de3697dba2)
  USC3121  26 U.S.C. 3121(v)(2)(A) (deferred compensation is FICA wages when no longer forfeitable)               (a97b7469...b7ec1e4ccd)
  The regulations are eCFR title 26 "up to date as of 2026-10-29" (https://www.ecfr.gov/api/versioner/v1/titles.json,
  b649b378...71de4d4618), read as XML from https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>
  (human page https://www.ecfr.gov/current/title-26/section-<N>):
  CFR3402G 26 CFR 31.3402(g)-1(a)(1)(i), (a)(2), (a)(3)(i), (a)(4)(iv), (a)(5)-(7), (a)(8) Examples 1 and 3
           [T.D. 9276, 71 FR 42054; T.D. 9924, 85 FR 63033]                                                      (b128554a...60666370f9)
  CFR3102  26 CFR 31.3102-4(a) and its Example, (b)                                                              (1776d6c6...63c08c1994)
  CFR833   26 CFR 1.83-3(e) ("property" excludes "an unfunded and unsecured promise to pay money or property")  (9c5a4978...f23ad9d003)
  The IRS documents:
  P15      Publication 15 (2026), (Circular E) Employer's Tax Guide, dated Dec 15, 2025, 59 pages: pp.1-2 What's New
           "Withholding on supplemental wages"; pp.23-24 section 7 Supplemental Wages, Examples 1-4; pp.29-30 section 9
           "Additional Medicare Tax withholding"   https://www.irs.gov/pub/irs-pdf/p15.pdf                      (b46c3622...c9f804c88b)
  P15B     Publication 15-B (2026), Employee Stock Options (no RSU text; read for options only)
           https://www.irs.gov/pub/irs-pdf/p15b.pdf                                                              (a0af8513...77b639ec46)
  P525     Publication 525 (2025) "for use in preparing 2025 Returns" (PDF of 2026-02-25, 42 pages), pp.12-14:
           Nonstatutory Stock Options, Qualified Equity Grants, Restricted Property and its Example 12
           https://www.irs.gov/pub/irs-pdf/p525.pdf                                                              (39b0fa5e...4cebc2c25b)
  I8959    Instructions for Form 8959 (2025), dated Aug 7, 2025: Threshold Amounts chart, Amounts Subject to Additional
           Medicare Tax, Examples 4-5, Line 1, Part V   https://www.irs.gov/pub/irs-pdf/i8959.pdf                    (1d223be7...abf687b68f)
  F8959    Form 8959 (2025) lines 1-7 and 19-24   https://www.irs.gov/pub/irs-pdf/f8959.pdf                       (13e64004...a9afaa996d)
  I1040    Instructions for Form 1040 (2025), Qualified Dividends and Capital Gain Tax Worksheet-Line 16 (p.38)
           https://www.irs.gov/pub/irs-pdf/i1040gi.pdf                                                           (482e9c48...590468364a)
  I8960    Instructions for Form 8960 (2025), Line 13 (MAGI = AGI)   https://www.irs.gov/pub/irs-pdf/i8960.pdf       (b10fbb23...7867376428)
  RP2532   Rev. Proc. 2025-32, s.4.01 Tables 1, 3, 4 (2026), s.4.03 (2026 0%/15% tops), s.4.14(1) (2026 standard
           deduction), s.5.01-5.02 (it covers 2025 and 2026 only)   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf (e9ada115...a96214635b)
  IRSNEWS  IRS "News releases for current month" (October 2026, page last reviewed 29-Oct-2026), IR-2026-118 to
           IR-2026-129: none is a 2027 inflation adjustment   https://www.irs.gov/newsroom/news-releases-for-current-month  (b8e7d2a2...e50706d333)
  IRSINFL  IRS "Inflation-adjusted tax items by tax year" (page last reviewed 01-Dec-2025): the latest year listed is
           2026 (IR-2025-103)   https://www.irs.gov/newsroom/inflation-adjusted-tax-items-by-tax-year             (07ae74b6...8751d9f31e)
  The Illinois Department of Revenue (IDOR):
  ILQ851   "What is the Illinois personal exemption allowance?" https://tax.illinois.gov/questionsandanswers/answer.851.html  (a4cb136d...ee670d9dd0)
  ILB15    Informational Bulletin FY 2026-15 (December 2025), "What's New for Illinois Income Taxes"
           https://tax.illinois.gov/content/dam/soi/en/web/tax/research/publications/bulletins/documents/2026/fy-2026-15.pdf  (b1e82e9c...71232e593f)
  IL700T   2026 Booklet IL-700-T, Illinois Withholding Tax Tables, effective January 1, 2026 (R-12/25)
           https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/withholding/documents/currentyear/il-700-t.pdf  (f8f05eda...b5fc6d635e)
  ILRATES  IDOR "Income Tax Rates" https://tax.illinois.gov/research/taxrates/income.html                          (7bfe12cb...d18c8e9ac5)
  IL1040I  2025 IL-1040 Instructions, Line B (filing status), Line 10 (exemption chart and Income Exceptions)
           https://tax.illinois.gov/content/dam/soi/en/web/tax/forms/incometax/documents/currentyear/individual/il-1040-instr.pdf  (e888e819...d67646d35a)
  This repo, cited for the federal figures they already source (and agreeing with RP2532 as read here):
  FEDKEY   tests/golden/taxes/RULES.md ss.1, 2, 5, 8                                                             (96ddcd2f...6c4c6adeb7)
  TLKEY    tests/golden/tax-lots/RULES.md ss.5.1, 5.2, 5.3                                                       (7e1afebd...e254d55a88)
  PROPKEY  tests/golden/property/RULES.md s.6                                                                    (4f0c341a...6234bbc116)

NOT VERIFIED on any official source (the key states its own convention):
  - The 2027 federal tables. Rev. Proc. 2025-32 covers 2025 (as modified) and 2026 only (s.5.01-5.02); on 2026-10-31 the
    IRS had not published 2027 brackets, standard deductions or 0/15% tops (IRSNEWS, IRSINFL). The key works next-year
    vest tax on the 2026 tables held flat, as a contrast only (TABLES_2027_CONTRAST); the main columns check 2026 years.
  - The 2027 Illinois exemption (35 ILCS 5/204 indexes it; IDOR has published only 2025 and 2026). The law contrast for
    2027 holds 2026's $2,925 flat. The statute (35 ILCS 5/201, 5/204) was not read; IDOR's figures are used.
  - Pub. 15 (2027), Pub. 525 (2026) and the 2026 Form 8959 instructions do not exist yet; the 2026 Pub. 15 and the 2025
    Pub. 525 and Form 8959 instructions are applied (3101(b)(2), 3102(f) and 83(a) have no amendment since 2018).
  - The 22% optional flat rate rests on Pub. 15 (2026); CFR3402G (a)(7)(iii)(F) still reads "28 percent (or the
    corresponding rate in effect under section 1(i)(2) ...)", and the uncodified Pub. L. 108-357 s.904(b) and the
    TCJA/OBBBA mapping of that rate to 22% were not read.
  - The page's own choices the brief leaves open (vests of 0 shares Z1, same-day vests T1, the level boundaries L1).
FINDINGS:
  - The brief's Illinois exemption "$2,850 per person ... 2026" is the 2025 figure. IDOR (ILQ851, ILB15, IL700T): "For
    tax year beginning January 1, 2026, it is $2,925 per exemption", and it "is not allowed if a taxpayer's federal
    adjusted gross income (AGI) exceeds $500,000 for returns with a federal filing status of married filing jointly, or
    $250,000 for all other returns". The main state column keeps the page's $2,850 and no income limit; the law column
    uses $2,925 and the limit.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from datetime import date
from decimal import Decimal as D
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CENT = F(1, 100)
RATE_PLACES = 6         # brief: "Money to the cent; rates and ratios to six decimals"; no legal source; read 2026-10-31
TODAY_YEAR = 2026       # brief: "today (a day in 2026)"; read 2026-10-31


# ---- exact arithmetic helpers ---------------------------------------------------------------------
def _F(x):
    """Exact Fraction from an int, str, Decimal or Fraction. Floats are refused (they are not exact)."""
    if isinstance(x, bool):
        raise TypeError('a flag is not a number')
    if isinstance(x, float):
        raise TypeError('pass money as str, int, Decimal or Fraction, never float')
    if isinstance(x, F):
        return x
    if isinstance(x, (int, D)):
        return F(x)
    return F(D(str(x).strip().replace(',', '').replace('$', '')))


def _blank(x):
    return x is None or (isinstance(x, str) and x.strip() == '')


def _opt(x):
    """None or blank stays None; anything else becomes an exact Fraction. A typed 0 is 0, not blank."""
    return None if _blank(x) else _F(x)


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


def round_half_up(x, quantum=CENT):
    """Round x to a multiple of quantum, halves away from zero (the key's display convention R1)."""
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


def _last_day(y, m):
    return (date(y + (m == 12), m % 12 + 1, 1) - date(y, m, 1)).days


def add_months(d, k):
    """Brief: "vest_start + m calendar months (same day of month; a day the month lacks falls back to its last day)".
    Always counted from the start date, never chained (so a February 28 does not pull later vests to the 28th)."""
    d = _d(d)
    y, m0 = divmod(d.month - 1 + int(k), 12)
    y, m = d.year + y, m0 + 1
    return date(y, m, min(d.day, _last_day(y, m)))


STATUSES = ('single', 'married_joint', 'married_separate')  # brief: "single or married_joint (and a smaller set married_separate)"; read 2026-10-31
PEOPLE = {'single': 1, 'married_joint': 2, 'married_separate': 1}  # people on the return (Illinois allowance); IL1040I Line 10a chart ("Single*" includes "Married filing separately": one exemption; joint: two); read 2026-10-31

# =====================================================================================================
# 1. Federal figures for 2026 (brief: brackets, standard deductions, 0/15/20% breakpoints, NIIT, Additional Medicare)
# =====================================================================================================
RATES = (10, 12, 22, 24, 32, 35, 37)  # RP2532 s.4.01 Tables 1, 3, 4 "10% ... 37%"; FEDKEY s.1; read 2026-10-31
BRACKET_TOPS = {
    2026: {
        'married_joint':    (24800, 100800, 211400, 403550, 512450, 768700),  # RP2532 s.4.01 Table 1; FEDKEY s.1, TLKEY s.5.1, PROPKEY s.6.1 agree; read 2026-10-31
        'single':           (12400, 50400, 105700, 201775, 256225, 640600),   # RP2532 s.4.01 Table 3; FEDKEY s.1, TLKEY s.5.1, PROPKEY s.6.1 agree; read 2026-10-31
        'married_separate': (12400, 50400, 105700, 201775, 256225, 384350),   # RP2532 s.4.01 Table 4; FEDKEY s.1, TLKEY s.5.1, PROPKEY s.6.1 agree; read 2026-10-31
    },
}
RP_BASE = {  # "The Tax Is: $Z plus N% of the excess" as printed; check_tables() rebuilds every one from the tops
    2026: {
        'married_joint':    ('0', '2480', '11600', '35932', '82048', '116896', '206583.50'),   # RP2532 s.4.01 Table 1; read 2026-10-31
        'single':           ('0', '1240', '5800', '17966', '41024', '58448', '192979.25'),     # RP2532 s.4.01 Table 3; read 2026-10-31
        'married_separate': ('0', '1240', '5800', '17966', '41024', '58448', '103291.75'),     # RP2532 s.4.01 Table 4; read 2026-10-31
    },
}
STANDARD_DEDUCTION = {
    2026: {'married_joint': 32200, 'single': 16100, 'married_separate': 16100},  # RP2532 s.4.14(1) ("$32,200 ... $16,100 ... $16,100"); FEDKEY s.2, TLKEY s.5.1 agree; read 2026-10-31
}
CG_ZERO_TOP = {  # "Maximum Zero Rate Amount" (USC1 (j)(5)(B)(i))
    2026: {'married_joint': 98900, 'married_separate': 49450, 'single': 49450},     # RP2532 s.4.03; FEDKEY s.5 agrees; read 2026-10-31
}
CG_15_TOP = {  # "Maximum 15% Rate Amount" (USC1 (j)(5)(B)(ii)): above it, 20%
    2026: {'married_joint': 613700, 'married_separate': 306850, 'single': 545500},  # RP2532 s.4.03; FEDKEY s.5 agrees; read 2026-10-31
}
CG_RATES = (F(0), F(15, 100), F(20, 100))  # USC1 (h)(1)(B) "0 percent", (C) "15 percent", (D) "20 percent"; I1040 QDCG worksheet lines 9, 18, 21; read 2026-10-31
NIIT_RATE = F(38, 1000)  # USC1411 (a)(1) "a tax equal to 3.8 percent of the lesser of"; read 2026-10-31
NIIT_THRESHOLD = {'married_joint': 250000, 'married_separate': 125000, 'single': 200000}  # USC1411 (b)(1) "$250,000", (b)(2) "1/2 of the dollar amount determined under paragraph (1)", (b)(3) "in any other case, $200,000"; not indexed; FEDKEY s.8 agrees; read 2026-10-31
ADDL_MEDICARE_RATE = F(9, 1000)  # USC3101 (b)(2) "a tax equal to 0.9 percent of wages"; F8959 line 7 "Multiply line 6 by 0.9% (0.009)"; read 2026-10-31
ADDL_MEDICARE_THRESHOLD = {'married_joint': 250000, 'married_separate': 125000, 'single': 200000}  # USC3101 (b)(2)(A) "$250,000", (B) "1/2 of the dollar amount determined under subparagraph (A)", (C) "$200,000"; I8959 chart "aren't indexed for inflation"; FEDKEY s.8 agrees; read 2026-10-31
ADDL_MEDICARE_WITHHOLD_OVER = 200000  # USC3102 (f)(1) "wages from the employer in excess of $200,000, and the employer may disregard the amount of wages received by such taxpayer's spouse"; CFR3102 (a) "regardless of the employee's filing status or other income"; P15 p.30; read 2026-10-31
REGULAR_MEDICARE_RATE = F(145, 10000)  # USC3101 (b)(1) "1.45 percent"; F8959 line 21 "Multiply line 20 by 1.45% (0.0145)" (used only in the Part V self-check); read 2026-10-31
CAPITAL_LOSS_LIMIT = {'married_joint': 3000, 'single': 3000, 'married_separate': 1500}  # USC1211 (b)(1) "$3,000 ($1,500 in the case of a married individual filing a separate return)"; law contrast only; read 2026-10-31

TABLES_VERIFIED = (2026,)    # RP2532 s.5.02 "section 4 of this revenue procedure applies to taxable years beginning in 2026"; read 2026-10-31
TABLES_2027_CONTRAST = 2026  # NOT VERIFIED: no 2027 tables on 2026-10-31 (IRSNEWS through IR-2026-129 of Oct. 29, 2026; IRSINFL lists 2026 last); the key holds 2026 flat for 2027, contrast only; read 2026-10-31


def table_year(year):
    """The tables the key uses for a tax year: (table_year, verified). 2026 is verified; 2027 is worked on the 2026 tables
    as a contrast (not verified); any other year is refused."""
    if year in TABLES_VERIFIED:
        return year, True
    if year == TODAY_YEAR + 1:
        return TABLES_2027_CONTRAST, False
    raise ValueError('%s: the key covers 2026 (and 2027 as a contrast on the 2026 tables)' % year)


def _check_status(status):
    if status not in STATUSES:
        raise ValueError('unknown filing status %r' % status)


def regular_tax(ty, status, taxable_income):
    """Exact Tax Computation formula on the year's brackets, at every income (no Tax Table rounding under $100,000:
    FEDKEY s.1's convention "Tax is worked with the Tax Computation formula on exact amounts"; TLKEY T1)."""
    x = max(F(0), _F(taxable_income))
    tax, lo = F(0), F(0)
    for top, pct in zip(BRACKET_TOPS[ty][status] + (None,), RATES):
        hi = x if top is None else min(x, F(top))
        if hi > lo:
            tax += (hi - lo) * pct / 100
        if top is None or x <= top:
            break
        lo = F(top)
    return tax


def qdcg_worksheet(ty, status, taxable_income, net_capital_gain):
    """I1040 Qualified Dividends and Capital Gain Tax Worksheet, lines 1-25 (no qualified dividends in these cases: line 2
    is 0), exact, with the formula tax on lines 22 and 24. Returns the lines that matter and the tax (line 25)."""
    l1 = max(F(0), _F(taxable_income))
    l4 = max(F(0), _F(net_capital_gain))                  # line 2 = 0, line 3 = the net capital gain
    l5 = max(F(0), l1 - l4)                               # "Subtract line 4 from line 1. If zero or less, enter -0-"
    l7 = min(l1, F(CG_ZERO_TOP[ty][status]))              # line 6 = the 0% top
    l8 = min(l5, l7)
    l9 = l7 - l8                                          # "This amount is taxed at 0%"
    l10 = min(l1, l4)
    l12 = l10 - l9
    l14 = min(l1, F(CG_15_TOP[ty][status]))               # line 13 = the 15% top
    l16 = max(F(0), l14 - (l5 + l9))
    l17 = min(l12, l16)                                   # taxed at 15%
    l20 = l10 - (l9 + l17)                                # taxed at 20%
    l23 = CG_RATES[1] * l17 + CG_RATES[2] * l20 + regular_tax(ty, status, l5)
    l24 = regular_tax(ty, status, l1)
    return {'line5': l5, 'line9': l9, 'line17': l17, 'line20': l20, 'line23': l23, 'line24': l24, 'tax': min(l23, l24)}


def stacked_gain_tax(ty, status, taxable_income, gain):
    """Second way (self-check only): 1(h)(1)(A)-(D) with 1(j)(5)(A) read directly. The gain sits on top of ordinary
    taxable income; the part under the maximum zero rate amount is taxed at 0%, the part under the maximum 15-percent
    rate amount at 15%, the rest at 20%; the ordinary part on the brackets."""
    ti, g = max(F(0), _F(taxable_income)), max(F(0), _F(gain))
    g = min(g, ti)
    ordinary = ti - g
    z, t15 = F(CG_ZERO_TOP[ty][status]), F(CG_15_TOP[ty][status])
    at0 = max(F(0), min(ti, z) - ordinary)
    at15 = max(F(0), min(ti, t15) - max(ordinary, z))
    at15 = min(at15, g - at0)
    at20 = g - at0 - at15
    return regular_tax(ty, status, ordinary) + CG_RATES[1] * at15 + CG_RATES[2] * at20


def niit(status, magi, nii):
    """USC1411(a)(1): 3.8% of the lesser of net investment income and MAGI over the threshold; MAGI = AGI (USC1411(d);
    I8960 Line 13: no foreign earned income)."""
    return NIIT_RATE * min(max(F(0), _F(nii)), max(F(0), _F(magi) - NIIT_THRESHOLD[status]))


def addl_medicare_owed(status, medicare_wages):
    """USC3101(b)(2) and F8959 lines 1-7: 0.9% of the return's Medicare wages over 250,000 joint (both spouses' wages
    together, I8959 Line 1 "If you are filing a joint return, also include your spouse's wages"), 125,000 separate,
    200,000 otherwise."""
    return ADDL_MEDICARE_RATE * max(F(0), _F(medicare_wages) - ADDL_MEDICARE_THRESHOLD[status])


def addl_medicare_withheld(employer_wages):
    """USC3102(f)(1), CFR3102(a), P15 p.30: the employer withholds 0.9% of the wages it pays over 200,000 in the calendar
    year, whatever the filing status, disregarding the spouse's wages and other employers."""
    return ADDL_MEDICARE_RATE * max(F(0), _F(employer_wages) - ADDL_MEDICARE_WITHHOLD_OVER)


def federal_return(year, status, wages, lt_gain=0, capital_loss=0):
    """One federal return of the case for `year`: adults under 65, no dependents, the standard deduction, W-2 wages (=
    Medicare wages, convention C2) plus an optional long-term gain or (law contrast only) a net capital loss.
    total = income tax (QDCG worksheet when there is a gain, else the brackets) + NIIT + Additional Medicare Tax.
    Exact; nothing rounded. No credits, no AMT."""
    _check_status(status)
    ty, verified = table_year(year)
    w, lt, cl = _F(wages), _F(lt_gain), _F(capital_loss)
    if w < 0 or lt < 0 or cl < 0 or (lt > 0 and cl > 0):
        raise ValueError('wages, the gain and the loss are never negative, and a return has a gain or a loss, not both')
    allowed_loss = min(cl, F(CAPITAL_LOSS_LIMIT[status]))      # USC1211(b): losses only to the extent of gains plus $3,000 / $1,500
    agi = w + lt - allowed_loss
    ti = max(F(0), agi - STANDARD_DEDUCTION[ty][status])
    income_tax = qdcg_worksheet(ty, status, ti, lt)['tax'] if lt > 0 else regular_tax(ty, status, ti)
    n = niit(status, agi, lt)                                   # the gain is the only net investment income (C3)
    am = addl_medicare_owed(status, w)
    return {'table_year': ty, 'verified': verified, 'agi': agi, 'taxable_income': ti, 'income_tax': income_tax,
            'niit': n, 'addl_medicare': am, 'total': income_tax + n + am, 'allowed_loss': allowed_loss,
            'carryover': cl - allowed_loss}


# =====================================================================================================
# 2. Supplemental wage withholding (federal income tax) on RSU vests
# =====================================================================================================
SUPP_FLAT_RATE = F(22, 100)       # P15 p.24 section 7 "1a. Withhold a flat 22% (no other percentage allowed)"; P15 p.1 What's New "remains 22%"; CFR3402G (a)(7)(iii)(F) (see NOT VERIFIED); read 2026-10-31
SUPP_MANDATORY_RATE = F(37, 100)  # P15 p.24 "the excess is subject to withholding at 37% (or the highest rate of income tax for the year)"; CFR3402G (a)(2) "equal to the highest rate of tax applicable under section 1"; RP2532 s.4.01 top rate 37%; read 2026-10-31
SUPP_MANDATORY_OVER = 1000000     # CFR3402G (a)(2) "exceeds $1,000,000"; P15 p.24 "exceed $1 million"; not indexed; read 2026-10-31


def supplemental_withholding(prior, amount, crossing='split', flat=SUPP_FLAT_RATE, mandatory=SUPP_MANDATORY_RATE,
                             over=SUPP_MANDATORY_OVER):
    """Federal income tax withheld from one supplemental wage payment of `amount`, after `prior` supplemental wages paid by
    the same employer in the calendar year. CFR3402G (a)(2): the mandatory rate on "the excess (including any excess which
    is a portion of a supplemental wage payment)"; (a)(4)(iv): only "on the portion of the payment that is in excess of
    $1,000,000 ... However, an employer may subject the entire amount ... to the withholding imposed by paragraph (a)(2)";
    (a)(7): the optional flat rate on the rest. crossing='split' (page, and P15's reading) or 'whole' (the (a)(4)(iv)
    option, law contrast). Returns dict(below, above, withheld)."""
    p, a, o = _F(prior), _F(amount), _F(over)
    if p < 0 or a < 0:
        raise ValueError('supplemental wages are never negative')
    below = max(F(0), min(p + a, o) - min(p, o))
    above = a - below
    if crossing == 'whole' and above > 0:
        return {'below': F(0), 'above': a, 'withheld': _F(mandatory) * a}
    if crossing not in ('split', 'whole'):
        raise ValueError(crossing)
    return {'below': below, 'above': above, 'withheld': _F(flat) * below + _F(mandatory) * above}


# =====================================================================================================
# 3. Illinois income tax (page convention and law)
# =====================================================================================================
IL_RATE = F(495, 10000)               # ILRATES "Individual Income Tax ... Effective July 1, 2017: 4.95 percent of net income"; IL700T p.1 "The income tax rate is 4.95 percent"; read 2026-10-31
IL_EXEMPTION_LAW = {2025: 2850, 2026: 2925}  # ILQ851 "For tax year beginning January 1, 2025, it is $2,850 per exemption" / "For tax year beginning January 1, 2026, it is $2,925 per exemption"; ILB15 p.2 "will increase to $2,925"; IL700T "the exemption allowance is $2,925"; read 2026-10-31
IL_EXEMPTION_PAGE = 2850              # brief (page convention): "income less $2,850 per person on the return, 2026" (= IDOR's 2025 figure: FINDING); read 2026-10-31
IL_EXEMPTION_2027_CONTRAST = 2925     # NOT VERIFIED: IDOR has not published 2027; 2026's figure held flat for the law contrast; read 2026-10-31
IL_AGI_LIMIT = {'married_joint': 500000, 'single': 250000, 'married_separate': 250000}  # ILQ851 "not allowed if a taxpayer's federal adjusted gross income (AGI) exceeds $500,000 ... married filing jointly, or $250,000 for all other returns"; IL1040I Line 10 Income Exceptions; ILB15 p.2; read 2026-10-31


def il_tax_page(base, people):
    """Brief: 4.95% x max(0, income - $2,850 x people on the return), no income limit (page convention)."""
    return IL_RATE * max(F(0), _F(base) - IL_EXEMPTION_PAGE * people)


def il_tax_law(year, status, federal_agi):
    """IDOR: 4.95% of base income less the exemption allowance ($2,925 per exemption in 2026), the allowance being 0 when
    federal AGI exceeds $500,000 (joint) or $250,000 (others). Base income = federal AGI here (wages and a capital gain:
    no Illinois additions or subtractions apply, convention S2). 2027: 2026's allowance held flat (not verified)."""
    each = IL_EXEMPTION_LAW.get(year, IL_EXEMPTION_2027_CONTRAST if year == TODAY_YEAR + 1 else None)
    if each is None:
        raise ValueError(year)
    agi = _F(federal_agi)
    allowance = 0 if agi > IL_AGI_LIMIT[status] else each * PEOPLE[status]
    return IL_RATE * max(F(0), agi - allowance)


# =====================================================================================================
# 4. The vesting schedule (page convention)
# =====================================================================================================
DEFAULT_VEST_MONTHS = 48  # brief: "vest_months (blank = 48)"; read 2026-10-31
DEFAULT_CLIFF_MONTHS = 12  # brief: "cliff_months (blank = 12)"; read 2026-10-31
DEFAULT_EVERY = 3          # brief: "every (blank = 3)"; read 2026-10-31


def vest_months(total_months, cliff, every):
    """Brief: "months m = cliff, cliff+every, cliff+2*every, ... below vest_months, then vest_months itself (when cliff is
    0, start at every)". A cliff longer than the schedule is refused (convention V2)."""
    n, c, e = int(total_months), int(cliff), int(every)
    if n <= 0 or e <= 0 or c < 0 or c > n:
        raise ValueError('vesting needs vest_months > 0, every > 0 and 0 <= cliff <= vest_months')
    m, out = (c if c > 0 else e), []
    while m < n:
        out.append(m)
        m += e
    out.append(n)
    return out


def vest_schedule(shares, vest_start, total_months=None, cliff=None, every=None):
    """Each vest: month m, date vest_start + m months, cumulative whole shares floor(shares x m / vest_months), shares =
    the change. A vest of 0 shares is left out (convention Z1; the cumulative still moves on)."""
    s = _F(shares)
    if s < 0 or s.denominator != 1:
        raise ValueError('a grant is a whole number of shares')
    s = int(s)
    n = int(_or(total_months, DEFAULT_VEST_MONTHS))
    c = int(_or(cliff, DEFAULT_CLIFF_MONTHS))
    e = int(_or(every, DEFAULT_EVERY))
    start = _d(vest_start)
    out, prev = [], 0
    for m in vest_months(n, c, e):
        cum = s * m // n
        if cum > prev:
            out.append({'month': m, 'date': add_months(start, m), 'cumulative': cum, 'shares': cum - prev})
        prev = cum
    assert prev == s
    return out


def vested_shares(schedule, today):
    """Brief: "vested = vests dated on or before today"."""
    t = _d(today)
    return sum((v['shares'] for v in schedule if v['date'] <= t), 0)


# =====================================================================================================
# 5. The page's position figures (page convention; no law counterpart)
# =====================================================================================================
TARGET_SHARE = F(10, 100)   # brief: "Getting under 10%"; level "up to 10% ok"; read 2026-10-31
MEDIUM_SHARE = F(25, 100)   # brief: "up to 25% medium, above large"; read 2026-10-31
HALVING = F(1, 2)           # brief: "A halving: loss = (held value + unvested RSU value) x 50% + the fall in every option's spread"; read 2026-10-31


def spread(price, strike):
    """Brief: "spread = max(0, price - strike) per share"."""
    return max(F(0), _F(price) - _F(strike))


def level(share):
    """Brief: "up to 10% ok, up to 25% medium, above large" (convention L1: "up to" includes the boundary, on the exact
    share). None when there is no share (nothing invested)."""
    if share is None:
        return None
    return 'ok' if share <= TARGET_SHARE else ('medium' if share <= MEDIUM_SHARE else 'large')


def _grants(case):
    out = []
    for i, g in enumerate(case.get('grants') or []):
        kind = str(g['kind']).strip().lower()
        if kind not in ('rsu', 'option'):
            raise ValueError('grant kind is rsu or option')
        sched = vest_schedule(g['shares'], g['vest_start'], g.get('vest_months'), g.get('cliff_months'), g.get('every'))
        strike = _F(g['strike']) if kind == 'option' else None
        out.append({'index': i, 'kind': kind, 'shares': int(_F(g['shares'])), 'schedule': sched, 'strike': strike})
    if len(out) > 3:
        raise ValueError('the case has 0 to 3 grants')
    return out


def position(case):
    """Brief, page convention: held value, options, owned, unvested, exposure, invested, share, level, halving loss."""
    today, price = _d(case['today']), _F(case['price'])
    grants = _grants(case)
    b_sh, k_sh = _or(case.get('brokerage_shares'), 0), _or(case.get('k401_shares'), 0)
    b_cost = _or(case.get('brokerage_cost'), 0)
    b_bal, k_bal = _or(case.get('brokerage_balance'), 0), _or(case.get('k401_balance'), 0)
    held_b, held_k = b_sh * price, k_sh * price
    if b_bal < held_b or k_bal < held_k:
        raise ValueError('an account balance is at least the value of the company shares in it (brief)')
    vested_opt_value = unv_rsu_value = unv_opt_value = halving_opt = F(0)
    per = []
    for g in grants:
        v = vested_shares(g['schedule'], today)
        u = g['shares'] - v
        if g['kind'] == 'rsu':
            unv_rsu_value += u * price
            per.append({'index': g['index'], 'kind': 'rsu', 'vested': v, 'unvested': u, 'spread': None})
        else:
            sp = spread(price, g['strike'])
            vested_opt_value += v * sp
            unv_opt_value += u * sp
            halving_opt += g['shares'] * (sp - spread(price * HALVING, g['strike']))
            per.append({'index': g['index'], 'kind': 'option', 'vested': v, 'unvested': u, 'spread': sp})
    held = held_b + held_k
    owned = held + vested_opt_value
    unvested = unv_rsu_value + unv_opt_value
    exposure = owned + unvested
    invested = b_bal + k_bal + vested_opt_value + unvested
    share = _div(exposure, invested)
    return {'grants': per, 'held_brokerage': held_b, 'held_401k': held_k, 'held_value': held,
            'vested_options_value': vested_opt_value, 'owned': owned, 'unvested_rsu_value': unv_rsu_value,
            'unvested_options_value': unv_opt_value, 'unvested': unvested, 'exposure': exposure, 'invested': invested,
            'share': share, 'level': level(share), 'halving_loss': (held + unv_rsu_value) * HALVING + halving_opt,
            'brokerage_cost': b_cost, 'brokerage_shares': b_sh, 'k401_shares': k_sh}


# =====================================================================================================
# 6. The household's returns and pay
# =====================================================================================================
def incomes(case):
    """Brief: salaries on an Income list (the employee's; the spouse's for joint and separate) or, for a few rows, wages
    typed for the whole return instead of any salary. Returns the wages of the return that carries the vests (`base`),
    the spouse's separate return (`spouse_base`, separate only), and `pay` for the employer's 0.9% withholding (brief:
    "the employee's salary (or, with no salary on file, the typed wages divided by the number of adults on a joint
    return)")."""
    status = case['filing_status']
    _check_status(status)
    se, ss, tw = _opt(case.get('salary_employee')), _opt(case.get('salary_spouse')), _opt(case.get('wages_typed'))
    if tw is not None:
        if se is not None or ss is not None:
            raise ValueError('typed wages replace every salary')
        if status == 'married_separate':
            raise ValueError('separate returns carry each adult\'s own salary (brief)')
        return {'base': tw, 'spouse_base': None, 'pay': tw / PEOPLE[status], 'typed': True}
    se = se or F(0)
    if status == 'single':
        if ss is not None:
            raise ValueError('a single filer has no spouse salary')
        return {'base': se, 'spouse_base': None, 'pay': se, 'typed': False}
    ss = ss or F(0)
    if status == 'married_joint':
        return {'base': se + ss, 'spouse_base': None, 'pay': se, 'typed': False}
    return {'base': se, 'spouse_base': ss, 'pay': se, 'typed': False}


# =====================================================================================================
# 7. Vests in view: owed, withheld, gap, state share (page convention, law columns where they differ)
# =====================================================================================================
def vests_in_view(case):
    """Brief: "RSU vests dated after today and on or before today + 12 calendar months, at today's price, value = shares x
    price". Sorted by date, same-day vests in grant order (convention T1). Also returns the earlier vests of today's year
    (RSU vests dated on or before today in today's year), valued at today's price (convention P1)."""
    today, price = _d(case['today']), _F(case['price'])
    if today.year != TODAY_YEAR:
        raise ValueError('today is a day in 2026 (brief)')
    end = add_months(today, 12)
    view, earlier = [], F(0)
    for g in _grants(case):
        if g['kind'] != 'rsu':
            continue
        for v in g['schedule']:
            if today < v['date'] <= end:
                view.append({'grant': g['index'], 'month': v['month'], 'date': v['date'], 'shares': v['shares'],
                             'value': v['shares'] * price, 'year': v['date'].year})
            elif v['date'] <= today and v['date'].year == today.year:
                earlier += v['shares'] * price
    view.sort(key=lambda r: (r['date'], r['grant']))
    return view, earlier, end


def vest_year(case, year, earlier, vests, inc=None):
    """One calendar year's vests in view (brief, page convention): before = the return with `earlier` added to the
    employee's wages and Medicare wages, after = before + the year's in-view total; owed_year = tax(after) - tax(before)
    (income tax + Additional Medicare Tax); withheld = 22% / 37% supplemental (earlier vests first, then in date order) +
    the employer's 0.9% past $200,000 (salary first, convention M1); gap = owed - withheld; each vest's share of a year
    figure is by value. Illinois rows: the page's state share and the law's. Exact."""
    status = case['filing_status']
    inc = inc or incomes(case)
    earlier = _F(earlier)
    total = sum((v['value'] for v in vests), F(0))
    base = inc['base']
    before = federal_return(year, status, base + earlier)
    after = federal_return(year, status, base + earlier + total)
    owed_year = after['total'] - before['total']
    cum, cum_w = earlier, earlier
    rows = []
    for v in vests:
        s = supplemental_withholding(cum, v['value'])
        w = supplemental_withholding(cum_w, v['value'], crossing='whole')
        cum += v['value']
        cum_w += v['value']
        rows.append(dict(v, supp_withheld=s['withheld'], supp_above_1m=s['above'], supp_withheld_whole=w['withheld']))
    pay = inc['pay']
    med_held_year = addl_medicare_withheld(pay + earlier + total) - addl_medicare_withheld(pay + earlier)
    il = str(case.get('state') or 'none').strip().lower() in ('il', 'illinois')
    st_page = st_law = None
    if il:
        people = PEOPLE[status]
        st_page = il_tax_page(base + earlier + total, people) - il_tax_page(base + earlier, people)
        st_law = il_tax_law(year, status, base + earlier + total) - il_tax_law(year, status, base + earlier)
    supp_year = sum((r['supp_withheld'] for r in rows), F(0))
    supp_whole_year = sum((r['supp_withheld_whole'] for r in rows), F(0))
    for r in rows:
        k = r['value'] / total if total else F(0)
        r['owed'] = owed_year * k
        r['medicare_held'] = med_held_year * k
        r['withheld'] = r['supp_withheld'] + r['medicare_held']
        r['gap'] = r['owed'] - r['withheld']
        r['gap_whole'] = r['owed'] - r['supp_withheld_whole'] - r['medicare_held']
        r['state_page'] = None if st_page is None else st_page * k
        r['state_law'] = None if st_law is None else st_law * k
    withheld_year = supp_year + med_held_year
    return {'year': year, 'table_year': before['table_year'], 'verified': before['verified'], 'earlier': earlier,
            'total': total, 'before': before, 'after': after, 'owed_year': owed_year,
            'income_tax_owed_year': after['income_tax'] - before['income_tax'],
            'addl_medicare_owed_year': after['addl_medicare'] - before['addl_medicare'],
            'supp_withheld_year': supp_year, 'medicare_held_year': med_held_year, 'withheld_year': withheld_year,
            'gap_year': owed_year - withheld_year, 'supp_withheld_whole_year': supp_whole_year,
            'gap_whole_year': owed_year - supp_whole_year - med_held_year,
            'state_page_year': st_page, 'state_law_year': st_law, 'vests': rows,
            'tie_crosses_1m': _tie_crosses(rows, earlier)}


def _tie_crosses(rows, earlier):
    """True when two vests share a date and the $1,000,000 line falls inside that day's payments: then the per-vest split
    of the withholding depends on their order (convention T1); the day's total does not."""
    cum = _F(earlier)
    by_day = {}
    for r in rows:
        by_day.setdefault(r['date'], []).append(r['value'])
    for d in sorted(by_day):
        vals = by_day[d]
        lo, hi = cum, cum + sum(vals, F(0))
        if len(vals) > 1 and lo < SUPP_MANDATORY_OVER < hi:
            return True
        cum = hi
    return False


# =====================================================================================================
# 8. Getting under 10%: the diversifying sale (page convention; the law's loss and state contrasts)
# =====================================================================================================
def sale(case, pos=None, this_year_vests=None, inc=None):
    """Brief: only when share > 10% and held value > 0. need = min(held value, exposure - 10% x invested); the 401(k)
    first (no tax: USC402(a) taxes plan amounts only "in which distributed"), the rest from the brokerage; gain = the
    brokerage amount x max(0, value - cost) / value; the tax = the federal return of today's year with this year's vests
    (earlier + in-view vests dated in today's year) in the wages, with the gain as a long-term gain and net investment
    income, less the same without it. Married filing separately: the gain goes on the brokerage owner's return (employee,
    spouse; joint = half on each). Law contrasts: a sale at a loss (USC1211(b)), and Illinois' tax on the gain."""
    pos = pos or position(case)
    inc = inc or incomes(case)
    status = case['filing_status']
    if pos['share'] is None or pos['share'] <= TARGET_SHARE or pos['held_value'] <= 0:
        return None
    need = min(pos['held_value'], pos['exposure'] - TARGET_SHARE * pos['invested'])
    from_k = min(need, pos['held_401k'])
    from_b = need - from_k
    bv = pos['held_brokerage']
    ratio_signed = _div(bv - pos['brokerage_cost'], bv) if bv > 0 else F(0)
    gain_signed = from_b * ratio_signed if from_b > 0 else F(0)
    gain = max(F(0), gain_signed)
    vests = _F(this_year_vests or 0)
    owner = str(case.get('brokerage_owner') or '').strip().lower()
    if status == 'married_separate':
        if from_b > 0 and owner not in ('employee', 'spouse', 'joint'):
            raise ValueError('a separate-return row names the brokerage owner: employee, spouse or joint')
        split = {'employee': (F(1), F(0)), 'spouse': (F(0), F(1)), 'joint': (F(1, 2), F(1, 2))}.get(owner, (F(1), F(0)))
        returns = [(inc['base'] + vests, split[0]), (inc['spouse_base'], split[1])]
    else:
        returns = [(inc['base'] + vests, F(1))]
    year = _d(case['today']).year
    tax_page = tax_law = F(0)
    il = str(case.get('state') or 'none').strip().lower() in ('il', 'illinois')
    il_law = F(0) if il else None
    detail = []
    for wages, part in returns:
        if part == 0:
            continue
        g = gain * part
        gs = gain_signed * part
        w0 = federal_return(year, status, wages)
        w1 = federal_return(year, status, wages, lt_gain=g)
        wl = federal_return(year, status, wages, lt_gain=max(F(0), gs), capital_loss=max(F(0), -gs))
        tax_page += w1['total'] - w0['total']
        tax_law += wl['total'] - w0['total']
        if il:
            il_law += il_tax_law(year, status, wl['agi']) - il_tax_law(year, status, w0['agi'])
        detail.append({'wages': wages, 'part': part, 'gain': g, 'without': w0, 'with': w1, 'law': wl})
    exposure_after = pos['exposure'] - need
    return {'need': need, 'from_401k': from_k, 'from_brokerage': from_b, 'gain': gain, 'gain_signed': gain_signed,
            'shares_401k': from_k / _F(case['price']), 'shares_brokerage': from_b / _F(case['price']),
            'tax': tax_page, 'tax_law': tax_law, 'state_tax_law': il_law, 'returns': detail,
            'share_after': _div(exposure_after, pos['invested']), 'owner': owner or None}


# =====================================================================================================
# 9. The whole case
# =====================================================================================================
def employer_stock_case(case):
    """Everything the key reports for one household (exact Fractions; show() / show_rate() for the CSV)."""
    inc = incomes(case)
    pos = position(case)
    view, earlier, end = vests_in_view(case)
    years = {}
    for y in sorted({v['year'] for v in view}):
        ys = [v for v in view if v['year'] == y]
        years[y] = vest_year(case, y, earlier if y == TODAY_YEAR else 0, ys, inc)
    this_year = earlier + (years[TODAY_YEAR]['total'] if TODAY_YEAR in years else 0)
    return {'incomes': inc, 'position': pos, 'view_end': end, 'earlier': earlier, 'vests': view, 'years': years,
            'this_year_vests': this_year, 'sale': sale(case, pos, this_year, inc),
            'flat_rate_condition_met': inc['pay'] > 0}


def rsu_income_83a(shares, fmv_at_vest, paid=0):
    """Per share FMV and price paid. USC83(a): the excess of the fair market value at the first time the rights are transferable or not subject to a
    substantial risk of forfeiture over the amount paid, in that taxable year (P525 Restricted Property: "you must include
    its FMV, minus any amount you paid for it, in your income for that year")."""
    return _F(shares) * (_F(fmv_at_vest) - _F(paid))


# =====================================================================================================
# 10. Self-checks: the printed tables, the sources' own examples, RULES.md section 9
# =====================================================================================================
_CHECKED = [0]


def ok(cond, info=None):
    """One self-check: assert it and count it."""
    if not cond:
        raise AssertionError(info if info is not None else 'self-check failed')
    _CHECKED[0] += 1


def check_tables():
    """Run every self-check once; returns how many passed."""
    _CHECKED[0] = 0
    for st in STATUSES:
        tops = BRACKET_TOPS[2026][st]
        ok(list(tops) == sorted(tops) and len(tops) == 6)
        for k, base in enumerate(RP_BASE[2026][st]):
            lo = 0 if k == 0 else tops[k - 1]
            ok(regular_tax(2026, st, lo) == _F(base), (st, k))
        ok(CG_ZERO_TOP[2026][st] < CG_15_TOP[2026][st])
    # separate = half of joint where the law says so (1(j)(5)(B)(i)(III) is "1/2 of" joint only for the zero rate amount
    # of "any other individual"; (ii)(I) halves the 15% amount for separate returns), 1411(b)(2), 3101(b)(2)(B)
    ok(2 * CG_15_TOP[2026]['married_separate'] == CG_15_TOP[2026]['married_joint'])
    ok(2 * CG_ZERO_TOP[2026]['single'] == CG_ZERO_TOP[2026]['married_joint'])
    ok(2 * NIIT_THRESHOLD['married_separate'] == NIIT_THRESHOLD['married_joint'])
    ok(2 * ADDL_MEDICARE_THRESHOLD['married_separate'] == ADDL_MEDICARE_THRESHOLD['married_joint'])
    # The QDCG worksheet against 1(h)(1) read directly, on a grid that crosses every breakpoint.
    pts = 0
    for st in STATUSES:
        for ti in range(0, 900001, 7500):
            for g in (0, 1, 5000, 25550, 45000, 90000, 250000, 700000):
                a = qdcg_worksheet(2026, st, ti, g)['tax']
                b = min(stacked_gain_tax(2026, st, ti, g), regular_tax(2026, st, ti))
                ok(a == b, (st, ti, g, a, b))
                pts += 1
    ok(pts == 3 * 121 * 8)
    # Supplemental withholding: CFR3402G (a)(8) Example 1 with its assumed 25% / 35%: $600,000, then $2,300,000 (first
    # $400,000 at 25% = $100,000; $1,900,000 at 35% = $665,000; all at 35% = $805,000), then $10,000 at 35% = $3,500.
    r25, r35 = F(25, 100), F(35, 100)
    e1 = supplemental_withholding(600000, 2300000, flat=r25, mandatory=r35)
    ok(e1['below'] == 400000 and e1['above'] == 1900000 and e1['withheld'] == 765000)
    ok(supplemental_withholding(600000, 2300000, 'whole', r25, r35)['withheld'] == 805000)
    ok(supplemental_withholding(2900000, 10000, flat=r25, mandatory=r35)['withheld'] == 3500)
    # Example 3: a $3,000,000 bonus as the first supplemental payment: $1,000,000 at 25% = $250,000, $2,000,000 at 35%;
    # the later $100,000 bonus all at 35%.
    e3 = supplemental_withholding(0, 3000000, flat=r25, mandatory=r35)
    ok(e3['below'] == 1000000 and e3['withheld'] == 250000 + 700000)
    ok(supplemental_withholding(3050000, 100000, flat=r25, mandatory=r35)['withheld'] == 35000)
    # P15 section 7 Example 3: "You withhold 22% of $1,000, or $220, from Sharon's bonus payment."
    ok(supplemental_withholding(0, 1000)['withheld'] == 220)
    # Additional Medicare: I8959 Example 5 (Erin and Frank, joint, $150,000 + $175,000: liable on $75,000; neither
    # employer withholds); Example 4 (Don, separate, $200,000 of wages: liable on $75,000; no withholding).
    ok(addl_medicare_owed('married_joint', 150000 + 175000) == F(9, 1000) * 75000 == F(675))
    ok(addl_medicare_withheld(150000) == 0 and addl_medicare_withheld(175000) == 0)
    ok(addl_medicare_owed('married_separate', 200000) == 675 and addl_medicare_withheld(200000) == 0)
    # CFR3102 (a) Example: H $100,000, I $300,000, joint: H's employer withholds nothing; I's withholds on $100,000.
    ok(addl_medicare_withheld(100000) == 0 and addl_medicare_withheld(300000) == 900)
    ok(addl_medicare_owed('married_joint', 400000) == 1350)
    # F8959 Part V: Medicare tax withheld (box 6) on $300,000 = 1.45% x 300,000 + 900; line 22 gives back the 900.
    box6 = REGULAR_MEDICARE_RATE * 300000 + addl_medicare_withheld(300000)
    ok(box6 - REGULAR_MEDICARE_RATE * 300000 == 900 and box6 == F('5250'))
    # USC83(a) / P525 Example 12 (Holly Corporation): 100 shares, $200 FMV when vested, $10 paid: $19,000.
    ok(rsu_income_83a(100, 200, 10) == 19000)
    # Illinois: IL700T Step 2a "2 x $2,925 = $5,850"; the AGI limit is "exceeds", so $250,000 keeps the allowance.
    ok(IL_EXEMPTION_LAW[2026] * 2 == 5850)
    ok(il_tax_law(2026, 'single', 250000) == IL_RATE * (250000 - 2925))
    ok(il_tax_law(2026, 'single', 250001) == IL_RATE * 250001)
    ok(il_tax_law(2026, 'married_joint', 500000) == IL_RATE * (500000 - 5850))
    ok(il_tax_law(2026, 'married_separate', 260000) == IL_RATE * 260000)
    ok(il_tax_page(2000, 1) == 0 and il_tax_page(40000, 1) == F('1838.925'))
    # Vesting: the month lists of the brief, whole shares, month ends.
    ok(vest_months(48, 12, 3) == [12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48])
    ok(vest_months(12, 0, 3) == [3, 6, 9, 12] and vest_months(10, 0, 3) == [3, 6, 9, 10])
    ok(vest_months(12, 12, 3) == [12] and vest_months(48, 12, 12) == [12, 24, 36, 48] and vest_months(6, 0, 12) == [6])
    ok([v['shares'] for v in vest_schedule(100, '2026-01-01', 10, 0, 3)] == [30, 30, 30, 10])
    ok([v['shares'] for v in vest_schedule(5, '2026-01-01', 48, 12, 3)] == [1, 1, 1, 1, 1])   # 0-share vests left out (Z1)
    ok([v['month'] for v in vest_schedule(5, '2026-01-01', 48, 12, 3)] == [12, 21, 30, 39, 48])
    ok(add_months('2024-01-31', 1) == date(2024, 2, 29) and add_months('2024-01-31', 13) == date(2025, 2, 28))
    ok(add_months('2023-08-31', 18) == date(2025, 2, 28) and add_months('2023-08-31', 21) == date(2025, 5, 31))
    ok(add_months('2026-10-31', 12) == date(2027, 10, 31) and add_months('2026-12-15', 0) == date(2026, 12, 15))
    # The edges of "vested" and "in view": a vest dated today is vested (and one of the year's earlier vests); one dated
    # today + 12 months is in view; one a day later is not.
    edge = {'today': '2026-10-31', 'filing_status': 'single', 'salary_employee': 50000, 'price': 10,
            'grants': [{'kind': 'rsu', 'shares': 100, 'vest_start': '2025-10-31', 'vest_months': 12, 'cliff_months': 12},
                       {'kind': 'rsu', 'shares': 200, 'vest_start': '2026-10-31', 'vest_months': 12, 'cliff_months': 12},
                       {'kind': 'rsu', 'shares': 300, 'vest_start': '2026-11-01', 'vest_months': 12, 'cliff_months': 12}],
            'brokerage_balance': 0, 'k401_balance': 0}
    view, earlier, end = vests_in_view(edge)
    ok(earlier == 1000 and end == date(2027, 10, 31) and [(v['date'], v['shares']) for v in view] == [(end, 200)])
    ok([g['vested'] for g in position(edge)['grants']] == [100, 0, 0])
    # Level boundaries (L1) and the sale's "only when share > 10%": exactly 10% is ok and sells nothing.
    ok((level(F(1, 10)), level(F(1, 10) + F(1, 10 ** 9)), level(F(1, 4)), level(F(1, 4) + F(1, 10 ** 9))) == \
        ('ok', 'medium', 'medium', 'large') and level(None) is None)
    ten = {'today': '2026-10-31', 'filing_status': 'single', 'salary_employee': 50000, 'price': 10, 'grants': [],
           'brokerage_shares': 1000, 'brokerage_cost': 0, 'brokerage_balance': 10000, 'k401_balance': 90000}
    ok(position(ten)['share'] == F(1, 10) and sale(ten) is None)
    ok(sale(dict(ten, k401_balance=89999))['need'] == F('0.1'))
    worked_examples()
    return _CHECKED[0]


def worked_examples():
    """tests/golden/employer-stock/RULES.md section 9, worked by hand there and asserted here. today = 2026-10-31,
    price $100 unless said."""
    T = '2026-10-31'
    one_dec = {'kind': 'rsu', 'vest_start': '2025-12-15', 'vest_months': 12, 'cliff_months': 12, 'every': ''}

    # 9.1 Ari: single, $90,000 of pay, one $100,000 vest on 2026-12-15 (taxable 73,900 -> 173,900: 22% into 24%).
    ari = {'today': T, 'filing_status': 'single', 'salary_employee': 90000, 'state': 'none', 'price': 100,
           'grants': [dict(one_dec, shares=1000)], 'brokerage_balance': 50000, 'k401_balance': 150000}
    r = employer_stock_case(ari)
    y = r['years'][2026]
    ok([v['date'] for v in r['vests']] == [date(2026, 12, 15)] and r['earlier'] == 0)
    ok(y['before']['taxable_income'] == 73900 and y['after']['taxable_income'] == 173900)
    ok(y['before']['total'] == 10970 and y['after']['total'] == 34334 and y['owed_year'] == 23364)
    ok(y['supp_withheld_year'] == 22000 and y['medicare_held_year'] == 0 and y['gap_year'] == 1364)
    p = r['position']
    ok(p['unvested'] == 100000 and p['invested'] == 300000 and p['share'] == F(1, 3) and p['level'] == 'large')
    ok(p['halving_loss'] == 50000 and r['sale'] is None and 2027 not in r['years'])

    # 9.2 Bo: the same pay, $300,000 vested earlier in 2026 (16,000 RSUs from 2022-12-15, 1,000 a quarter).
    bo = {'today': T, 'filing_status': 'single', 'salary_employee': 90000, 'state': 'none', 'price': 100,
          'grants': [{'kind': 'rsu', 'shares': 16000, 'vest_start': '2022-12-15'}],
          'brokerage_balance': 400000, 'k401_balance': 300000}
    r = employer_stock_case(bo)
    y = r['years'][2026]
    ok(r['earlier'] == 300000 and [v['value'] for v in r['vests']] == [100000])
    ok(y['before']['taxable_income'] == 373900 and y['after']['taxable_income'] == 473900)
    ok(y['before']['income_tax'] == F('99634.25') and y['after']['income_tax'] == F('134634.25'))
    ok(y['income_tax_owed_year'] == 35000 and y['addl_medicare_owed_year'] == 900 and y['owed_year'] == 35900)
    ok(y['before']['addl_medicare'] == 1710 and y['after']['addl_medicare'] == 2610)
    ok(y['supp_withheld_year'] == 22000 and y['medicare_held_year'] == 900 and y['withheld_year'] == 22900)
    ok(y['gap_year'] == 13000 and r['position']['share'] == F(1, 8) and r['position']['level'] == 'medium')

    # 9.3 Cal: four $300,000 vests in 2026 (48,000 RSUs from 2022-12-15): 200,000 of the December one at 37%.
    cal = dict(bo, grants=[{'kind': 'rsu', 'shares': 48000, 'vest_start': '2022-12-15'}],
               brokerage_balance=2000000, k401_balance=500000)
    r = employer_stock_case(cal)
    y = r['years'][2026]
    v = y['vests'][0]
    ok(r['earlier'] == 900000 and v['value'] == 300000)
    ok(v['supp_above_1m'] == 200000 and v['supp_withheld'] == 22000 + 74000)
    ok(y['before']['total'] == F('323410.25') and y['after']['total'] == F('437110.25') and y['owed_year'] == 113700)
    ok(y['medicare_held_year'] == 2700 and y['withheld_year'] == 98700 and y['gap_year'] == 15000)
    ok(y['supp_withheld_whole_year'] == 111000 and y['gap_whole_year'] == 0)
    ok(show_rate(r['position']['share']) == D('0.107143') and r['position']['level'] == 'medium')

    # 9.4 Dee and Eli: joint, $180,000 (Dee, the employee) and $60,000 of pay, a $120,000 vest: 0.9% owed on $110,000
    # (combined wages over $250,000) against 0.9% withheld on $100,000 (Dee's employer, over $200,000).
    de = {'today': T, 'filing_status': 'married_joint', 'salary_employee': 180000, 'salary_spouse': 60000,
          'state': 'none', 'price': 100, 'grants': [dict(one_dec, shares=1200)],
          'brokerage_balance': 100000, 'k401_balance': 380000}
    r = employer_stock_case(de)
    y = r['years'][2026]
    ok(y['before']['taxable_income'] == 207800 and y['after']['taxable_income'] == 327800)
    ok(y['before']['total'] == 35140 and y['after']['income_tax'] == 63868 and y['income_tax_owed_year'] == 28728)
    ok(y['addl_medicare_owed_year'] == 990 and y['medicare_held_year'] == 900 and y['owed_year'] == 29718)
    ok(y['supp_withheld_year'] == 26400 and y['withheld_year'] == 27300 and y['gap_year'] == 2418)
    ok(r['position']['share'] == F(1, 5) and r['position']['level'] == 'medium')

    # 9.5 Fay: Illinois, single, $40,000 of pay, a $50,000 vest; and Fay at $230,000 (the law's AGI limit bites).
    fay = {'today': T, 'filing_status': 'single', 'salary_employee': 40000, 'state': 'IL', 'price': 100,
           'grants': [dict(one_dec, shares=500)], 'brokerage_balance': 20000, 'k401_balance': 80000}
    r = employer_stock_case(fay)
    y = r['years'][2026]
    ok(y['before']['total'] == 2620 and y['after']['total'] == 10970 and y['owed_year'] == 8350)
    ok(y['withheld_year'] == 11000 and y['gap_year'] == -2650)
    ok(y['state_page_year'] == 2475 and y['state_law_year'] == 2475 and y['vests'][0]['state_page'] == 2475)
    ok(il_tax_page(40000, 1) == F('1838.925') and il_tax_law(2026, 'single', 40000) == F('1835.2125'))
    r = employer_stock_case(dict(fay, salary_employee=230000, brokerage_balance=200000, k401_balance=300000))
    y = r['years'][2026]
    ok(y['state_page_year'] == 2475 and y['state_law_year'] == F('2619.7875') and show(y['state_law_year']) == D('2619.79'))
    ok(il_tax_law(2026, 'single', 230000) == F('11240.2125') and il_tax_law(2026, 'single', 280000) == 13860)

    # 9.6 Gus: single, $40,000 of pay, no grants, 2,000 shares in the brokerage (value $200,000, cost $100,000):
    # a $90,000 sale with a $45,000 gain, 25,550 of it at 0% and 19,450 at 15%.
    gus = {'today': T, 'filing_status': 'single', 'salary_employee': 40000, 'state': 'none', 'price': 100, 'grants': [],
           'brokerage_shares': 2000, 'brokerage_cost': 100000, 'k401_shares': 0,
           'brokerage_balance': 300000, 'k401_balance': 800000}
    r = employer_stock_case(gus)
    s = r['sale']
    ok(show_rate(r['position']['share']) == D('0.181818') and r['position']['level'] == 'medium')
    ok(s['need'] == 90000 and s['from_401k'] == 0 and s['from_brokerage'] == 90000 and s['gain'] == 45000)
    ws = qdcg_worksheet(2026, 'single', 68900, 45000)
    ok(ws['line5'] == 23900 and ws['line9'] == 25550 and ws['line17'] == 19450 and ws['tax'] == F('5537.50'))
    ok(s['tax'] == F('2917.50') and s['tax_law'] == F('2917.50') and s['share_after'] == F(1, 10))
    ok(r['position']['halving_loss'] == 100000 and s['shares_brokerage'] == 900)
    # 9.6b the same shares bought for $300,000 (a loss): the page taxes nothing; the law allows $3,000 of the $45,000
    # loss against the wages (1211(b)): tax on 20,900 instead of 23,900, 360 less; $42,000 carries over.
    r = employer_stock_case(dict(gus, brokerage_cost=300000))
    s = r['sale']
    ok(s['gain'] == 0 and s['gain_signed'] == -45000 and s['tax'] == 0 and s['tax_law'] == -360)
    ok(s['returns'][0]['law']['carryover'] == 42000)

    # 9.7 Gus with a $100,000 vest in December (balances raised so the sale is still $90,000): all 45,000 at 15%.
    gus2 = dict(gus, grants=[dict(one_dec, shares=1000)], k401_balance=1700000)
    r = employer_stock_case(gus2)
    s, y = r['sale'], r['years'][2026]
    ok(show_rate(r['position']['share']) == D('0.142857') and s['need'] == 90000 and s['gain'] == 45000)
    ok(r['this_year_vests'] == 100000 and s['returns'][0]['without']['total'] == 22334)
    ok(s['returns'][0]['with']['total'] == 29084 and s['tax'] == 6750)
    ok(y['owed_year'] == 19714 and y['gap_year'] == -2286)

    # 9.8 Bea: the whole page. Single, $120,000 of pay; 1,000 RSUs from 2023-08-31 and 2,000 options at $60 from
    # 2024-04-15 (both 48 / 12 / 3); 500 shares in the brokerage (cost $20,000) and 300 in the 401(k).
    bea = {'today': T, 'filing_status': 'single', 'salary_employee': 120000, 'state': 'none', 'price': 100,
           'grants': [{'kind': 'rsu', 'shares': 1000, 'vest_start': '2023-08-31'},
                      {'kind': 'option', 'shares': 2000, 'vest_start': '2024-04-15', 'strike': 60}],
           'brokerage_shares': 500, 'brokerage_cost': 20000, 'k401_shares': 300,
           'brokerage_balance': 120000, 'k401_balance': 250000}
    sch = vest_schedule(1000, '2023-08-31')
    ok([v['cumulative'] for v in sch] == [250, 312, 375, 437, 500, 562, 625, 687, 750, 812, 875, 937, 1000])
    ok([v['date'] for v in sch][1:4] == [date(2024, 11, 30), date(2025, 2, 28), date(2025, 5, 31)])
    ok([v['date'] for v in sch][-4:] == [date(2026, 11, 30), date(2027, 2, 28), date(2027, 5, 31), date(2027, 8, 31)])
    r = employer_stock_case(bea)
    p = r['position']
    ok([(g['vested'], g['unvested']) for g in p['grants']] == [(750, 250), (1250, 750)])
    ok(p['held_value'] == 80000 and p['vested_options_value'] == 50000 and p['owned'] == 130000)
    ok(p['unvested'] == 55000 and p['exposure'] == 185000 and p['invested'] == 475000)
    ok(p['share'] == F(37, 95) and show_rate(p['share']) == D('0.389474') and p['level'] == 'large')
    ok(p['halving_loss'] == 132500)
    ok(r['earlier'] == 18800 and [(v['date'], v['shares']) for v in r['vests']] == [
        (date(2026, 11, 30), 62), (date(2027, 2, 28), 63), (date(2027, 5, 31), 62), (date(2027, 8, 31), 63)])
    y = r['years'][2026]
    ok(y['before']['total'] == 22046 and y['after']['total'] == 23534 and y['owed_year'] == 1488)
    ok(y['withheld_year'] == 1364 and y['gap_year'] == 124)
    y = r['years'][2027]
    ok(not y['verified'] and y['table_year'] == 2026 and y['earlier'] == 0 and y['total'] == 18800)
    ok(y['before']['total'] == 17570 and y['after']['total'] == 22046 and y['owed_year'] == 4476)
    ok(y['supp_withheld_year'] == 4136 and y['gap_year'] == 340)
    ok([show(v['owed']) for v in y['vests']] == [D('1499.94'), D('1476.13'), D('1499.94')])
    s = r['sale']
    ok(s['need'] == 80000 and s['from_401k'] == 30000 and s['from_brokerage'] == 50000 and s['gain'] == 30000)
    ok(s['tax'] == 4500 and show_rate(s['share_after']) == D('0.221053'))

    # 9.9 Hal and Ivy: married filing separately, Hal (the employee) $150,000, Ivy $90,000, a $50,000 vest; 1,000 shares
    # in a joint brokerage account (cost $60,000): Additional Medicare owed past $125,000, withheld past $200,000; the
    # $20,000 gain half on each return, NIIT on Hal's half only.
    hal = {'today': T, 'filing_status': 'married_separate', 'salary_employee': 150000, 'salary_spouse': 90000,
           'state': 'none', 'price': 100, 'grants': [dict(one_dec, shares=500)],
           'brokerage_shares': 1000, 'brokerage_cost': 60000, 'k401_shares': 0, 'brokerage_owner': 'joint',
           'brokerage_balance': 150000, 'k401_balance': 800000}
    r = employer_stock_case(hal)
    y, s = r['years'][2026], r['sale']
    ok(y['before']['total'] == 24959 and y['after']['total'] == 37409 and y['owed_year'] == 12450)
    ok(y['addl_medicare_owed_year'] == 450 and y['medicare_held_year'] == 0 and y['gap_year'] == 1450)
    ok(r['position']['share'] == F(15, 100) and s['need'] == 50000 and s['gain'] == 20000)
    hal_part, ivy_part = s['returns']
    ok(hal_part['with']['total'] - hal_part['without']['total'] == 1880 and hal_part['with']['niit'] == 380)
    ok(ivy_part['with']['total'] - ivy_part['without']['total'] == 1500 and ivy_part['with']['niit'] == 0)
    ok(s['tax'] == 3380)
    ok(employer_stock_case(dict(hal, brokerage_owner='employee'))['sale']['tax'] == 3760)
    ok(employer_stock_case(dict(hal, brokerage_owner='spouse'))['sale']['tax'] == 3000)
    # 9.9b Hal's own account bought for $160,000 (a loss): the page taxes nothing; the law allows $1,500 of the $30,000
    # loss on a separate return (1211(b)(1)), at Hal's 24%: 360 less; $28,500 carries over.
    s = employer_stock_case(dict(hal, brokerage_cost=160000, brokerage_owner='employee'))['sale']
    ok(s['gain'] == 0 and s['gain_signed'] == -30000 and s['tax'] == 0 and s['tax_law'] == -360)
    ok(s['returns'][0]['law']['allowed_loss'] == 1500 and s['returns'][0]['law']['carryover'] == 28500)


CHECKS = check_tables()

if __name__ == '__main__':
    print('rules.py: %d self-checks passed (sources read %s)' % (CHECKS, READ_ON))
