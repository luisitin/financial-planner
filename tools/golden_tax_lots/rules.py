"""US tax-lot and loss-harvesting rules for the answer key of the "Tax lots and harvesting" page, tax years 2025 and
2026, as data plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or tests/*.test.mjs
while writing this file, and it never imports or runs the app. Only the layout and conventions of tools/golden_estimated/
and tools/golden_estate/ were looked at; no figure or code is shared with them. The federal brackets, standard deductions
and 0/15/20% breakpoints were read in the revenue procedures themselves and agree with tests/golden/taxes/RULES.md
(FEDKEY), which is cited for comparison only. Every figure names its source and the date it was read on the same line.
Money is an exact Fraction while it is worked and a Decimal when it is shown. Importing this file runs check_tables().

The model (the page's documented convention; where the law says otherwise the key follows the law and keeps the page's
way in a contrast column, see tests/golden/tax-lots/RULES.md):
  TERM      per lot: first long-term day, short/long today, days until long-term. Law: counting starts the day after the
            purchase, the sale day counts, long-term when held MORE than one year (1222(3); Pub. 550), in calendar months
            (Rev. Rul. 66-7: a purchase on the last day of a month is long-term from the first day of the 13th month after).
            Page: the day after the calendar anniversary (a February 29 purchase: March 1). The two differ only for a
            purchase on February 28 of the year before a leap year (law March 1, page February 29). No date: long (page).
  LOTS      value = shares x price, gain = value - cost; the holding's shares not covered by lots are one "unassigned"
            lot, cost = max(0, holding cost - lots' cost), no date, long-term.
  RATES     page convention: marginal rate = (total federal tax with $1,000 more taxable interest - without) / 1,000;
            gains rate = the same with $1,000 more qualified dividends; total tax = income tax + 3.8% NIIT; floor 0.
  HARVEST   page: candidates = lots in taxable accounts with a loss of more than $1; tax saved = loss x marginal rate
            (short-term) or gains rate (long-term). Law: the year's federal tax without selling minus with every candidate
            sold today (Schedule D netting, $3,000/$1,500 limit, carryover worksheet, NIIT with the allowed loss), after
            wash sales.
  WASH      26 U.S.C. 1091 and 26 CFR 1.1091-1: a candidate's loss is disallowed share for share against same-ticker lots
            bought in any account of the household from today - 30 days to today and not sold in the harvest; losses taken
            in order of purchase, replacement shares in order of purchase, each replacement share used once; an IRA
            replacement loses the loss for good (Rev. Rul. 2008-5), a taxable one carries it into its basis (1091(d)).
  ORDER     page: taxable lots by gain per share, lowest first, input order on ties, first eight. Contrast: losses first
            (most negative gain per dollar first), then tax per dollar raised = max(0, gain) x rate / value.

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits). The U.S. Code pages are the OLRC
edition "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t26/s<N>/:
  USC1     26 U.S.C. 1(h)(1), (h)(3), (h)(11)(A), (j)(5)(A)-(C); amendment notes (Pub. L. 119-21 s.70101: (j) now "beginning
           after 2017")   (acce504c...3ce7938060)
  USC1091  26 U.S.C. 1091(a)-(d) wash sales (last amended Pub. L. 107-147, 2002)   (2f7fcffd...46759c2c9b)
  USC1211  26 U.S.C. 1211(b) "$3,000 ($1,500 in the case of a married individual filing a separate return)"   (0ef67741...bf8b64dde3)
  USC1212  26 U.S.C. 1212(b)(1)-(2) carryover, character kept, 1211(b) amount treated as short-term gain   (4b368fc6...48a0bd2dd0)
  USC1222  26 U.S.C. 1222(1)-(11) short/long term "not more than 1 year" / "more than 1 year"; net capital loss / gain   (608100ea...b0cae9749a)
  USC1223  26 U.S.C. 1223(3) wash-sale holding period tacked   (581916b4...9d82c87260)
  USC1411  26 U.S.C. 1411(a)(1), (b), (c)(1) net investment income tax   (89721b18...741beafb33)
  The regulations are eCFR title 26 "up to date as of 2026-10-29" (https://www.ecfr.gov/api/versioner/v1/titles.json,
  b649b378...71de4d4618), read as XML from https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>
  (human page https://www.ecfr.gov/current/title-26/section-<N>):
  CFR10911 26 CFR 1.1091-1(a)-(f), (h) Examples 1-3 [T.D. 6500, 25 FR 11910; T.D. 6926, 32 FR 11468]   (e7afa023...6824a10a78)
  CFR10912 26 CFR 1.1091-2(a) Examples 1-2 (basis of the new shares)   (a9f2d596...38b7ec34a8)
  CFR12231 26 CFR 1.1223-1(d) (holding period of wash-sale replacement shares)   (eb546264...8e5a87cb03)
  CFR14114 26 CFR 1.1411-4(d)(2), (d)(3)(ii) Example 1 (net gain; the 1211(b) loss reduces net investment income)   (76523685...59598039aa)
  CFR10121 26 CFR 1.1012-1(c)(1)(i), (c)(3), (c)(8) (lot identification; first-in first-out when not identified)   (909e34e1...90cd81ba98)
  CFR60451 26 CFR 1.6045-1(d)(6)(iii)(A)-(B) (brokers apply 1091 only within one account; read for the note only)   (aac2a2a4...bc6e44a73c)
  RR0805   Rev. Rul. 2008-5, 2008-3 I.R.B. 271-272 (IRA or Roth IRA purchase: loss disallowed, IRA basis not increased)
           https://www.irs.gov/pub/irs-irbs/irb08-03.pdf   (623a6c1d...c2b28056c9)
  RR6607   Rev. Rul. 66-7, 1966-1 C.B. 188 (calendar months; last day of a month), SECONDARY COPY at
           https://timbertax.org/research/revenuerulings/capitalgain/66-7/ (no irs.gov copy of the 1966 Cumulative Bulletin
           was found)   (267a722e...324f4cfe87)
  P550     Publication 550 (2025) "For use in preparing 2025 Returns" (PDF of 2026-03-06): Holding Period (p.81), Wash
           Sales (pp.86-87), Capital Losses and Worksheet 4-1 (pp.101-102)   https://www.irs.gov/pub/irs-pdf/p550.pdf   (83552968...92c5574317)
  ISD      Instructions for Schedule D (Form 1040) (2025): Wash Sales (p.4), Capital Loss Carryover Worksheet (p.9),
           Line 21 (p.14)   https://www.irs.gov/pub/irs-pdf/i1040sd.pdf   (650643a6...f7b2276002)
  FSD      Schedule D (Form 1040) (2025) lines 7, 15, 16, 21   https://www.irs.gov/pub/irs-pdf/f1040sd.pdf   (90564c8b...c844da1d2e)
  I8960    Instructions for Form 8960 (2025): Lines 5a-5d, Line 5a, Line 13   https://www.irs.gov/pub/irs-pdf/i8960.pdf   (b10fbb23...7867376428)
  F8960    Form 8960 (2025) lines 5a, 5d, 8, 12-17   https://www.irs.gov/pub/irs-pdf/f8960.pdf   (9b323b71...c3b3789731)
  I8949    Instructions for Form 8949 (2025), code W   https://www.irs.gov/pub/irs-pdf/i8949.pdf   (f077991c...05d6e7ab45)
  I1040    Instructions for Form 1040 (2025), Qualified Dividends and Capital Gain Tax Worksheet-Line 16 (p.38)
           https://www.irs.gov/pub/irs-pdf/i1040gi.pdf   (482e9c48...590468364a)
  RP2440   Rev. Proc. 2024-40, s.2.01 Tables 1-4 (2025 brackets), s.2.03 (2025 0%/15% tops), s.2.15(1) (superseded)
           https://www.irs.gov/pub/irs-drop/rp-24-40.pdf   (4de9db6b...d4c302af1f)
  RP2532   Rev. Proc. 2025-32, s.3.01 (2025 standard deduction as amended by Pub. L. 119-21), s.4.01 Tables 1-4 (2026
           brackets), s.4.03 (2026 0%/15% tops), s.4.14(1) (2026 standard deduction)
           https://www.irs.gov/pub/irs-drop/rp-25-32.pdf   (e9ada115...a96214635b)
  PL11921  Pub. L. 119-21, s.70101 (rates made permanent), s.70102(b) (63(c)(7): $23,625 / $15,750 from 2025)
           https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm   (84000b07...c584e9004d)
  FEDKEY   tests/golden/taxes/RULES.md sections 1, 2, 5, 8 (the federal key), read for comparison only   (96ddcd2f...6c4c6adeb7)

NOT VERIFIED on any official source (the key states its own convention):
  - Rev. Rul. 66-7 was read in a secondary copy, and it rules on the old 6-month period; the key applies its calendar-month
    rule to the 1-year period by analogy (its reasoning, I.T. 3985 and I.T. 3287, is about counting months, not 6).
  - The 2026 Pub. 550, Schedule D and Form 8960 instructions do not exist yet; the 2025 editions are applied to 2026 (the
    statute did not change: 1091, 1211, 1212, 1222, 1411 have no Pub. L. 119-21 amendment).
  - Same-day replacement: no source read says whether a lot bought within the 30 days and itself sold in the same harvest
    is a "replacement". The key says no (convention W3); same_day_sensitive() flags the rows where it could matter.
  - "Substantially identical" is facts and circumstances (P550); the key treats the same ticker as identical and different
    tickers as not (convention W1).
  - The page's tie-break in the order to sell: the key keeps input order; how the page breaks ties was not checked (the
    independence rule forbids reading the page's code).
  - Alternative minimum tax (26 U.S.C. 55) is not modelled (no figure for it was read for this key).
  - FINDING on FEDKEY: it cites "RP24 s.3.01 / s.3.03 / s.3.15"; in Rev. Proc. 2024-40 the tax tables are s.2.01, the capital
    gains tops s.2.03 and the standard deduction s.2.15 (section 3 is EFFECTIVE DATE). Its figures agree.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from datetime import date, timedelta
from decimal import Decimal as D
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CENT = F(1, 100)
DOLLAR = F(1)
RATE_PLACES = 6         # page convention (brief): "rates to six decimals"; no legal source; read 2026-10-31


# ---- exact arithmetic helpers ---------------------------------------------------------------------
def _F(x):
    """Exact Fraction from an int, str, Decimal or Fraction. Floats are refused (they are not exact)."""
    if isinstance(x, float):
        raise TypeError('pass money as str, int, Decimal or Fraction, never float')
    if isinstance(x, F):
        return x
    if isinstance(x, int):
        return F(x)
    return F(D(str(x).replace(',', '').replace('$', '')))


def _opt(x):
    """None or blank stays None; anything else becomes an exact Fraction. A typed 0 is 0, not blank."""
    return None if x is None or (isinstance(x, str) and x.strip() == '') else _F(x)


def _d(x):
    """A date, or None for a blank date (the page reads a blank date as long-term)."""
    if x is None or isinstance(x, date):
        return x
    s = str(x).strip()
    return None if s == '' else date.fromisoformat(s)


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
    """A rate for display: Decimal rounded half up to six decimals (brief: "rates to six decimals")."""
    if x is None:
        return None
    q = F(1, 10 ** RATE_PLACES)
    r = round_half_up(x, q)
    return (D(r.numerator) / D(r.denominator)).quantize(D(1).scaleb(-RATE_PLACES))


STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
TAX_YEARS = (2025, 2026)  # the case's "today" falls in 2025 or 2026; the tax year is today's calendar year
ACCOUNT_KINDS = ('taxable', 'ira')
INVENTED_TICKERS = ('ZZTOT', 'ZZINT', 'ZZBND', 'ZZTEC', 'ZZDIV', 'ZZSML')  # key convention: invented symbols for the case generator (any match with a real symbol is accidental); no source

# =====================================================================================================
# 1. Federal figures (the brief: ordinary brackets and standard deduction of the year, 0/15/20% on top, NIIT, $3,000)
# =====================================================================================================
RATES = (10, 12, 22, 24, 32, 35, 37)  # RP2440 s.2.01 / RP2532 s.4.01 "10% / 12% / 22% / 24% / 32% / 35% / 37%" columns; USC1 (j)(2); read 2026-10-31
BRACKET_TOPS = {
    2025: {
        'married_joint':     (23850, 96950, 206700, 394600, 501050, 751600),   # RP2440 s.2.01 Table 1 (1(j)(2)(A)); unchanged by PL11921 (RP2532 s.3 modifies only s.2.15 and s.2.25); FEDKEY s.1 agrees; read 2026-10-31
        'head_of_household': (17000, 64850, 103350, 197300, 250500, 626350),   # RP2440 s.2.01 Table 2 (1(j)(2)(B)); FEDKEY s.1 agrees; read 2026-10-31
        'single':            (11925, 48475, 103350, 197300, 250525, 626350),   # RP2440 s.2.01 Table 3 (1(j)(2)(C)); FEDKEY s.1 agrees; read 2026-10-31
        'married_separate':  (11925, 48475, 103350, 197300, 250525, 375800),   # RP2440 s.2.01 Table 4 (1(j)(2)(D)); FEDKEY s.1 agrees; read 2026-10-31
    },
    2026: {
        'married_joint':     (24800, 100800, 211400, 403550, 512450, 768700),  # RP2532 s.4.01 Table 1; FEDKEY s.1 agrees; read 2026-10-31
        'head_of_household': (17700, 67450, 105700, 201750, 256200, 640600),   # RP2532 s.4.01 Table 2; FEDKEY s.1 agrees; read 2026-10-31
        'single':            (12400, 50400, 105700, 201775, 256225, 640600),   # RP2532 s.4.01 Table 3; FEDKEY s.1 agrees; read 2026-10-31
        'married_separate':  (12400, 50400, 105700, 201775, 256225, 384350),   # RP2532 s.4.01 Table 4; FEDKEY s.1 agrees; read 2026-10-31
    },
}
RP_BASE = {  # "The Tax Is: $Z plus N% of the excess" amounts as printed; check_tables() rebuilds them from the tops
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
    2025: {'married_joint': 31500, 'head_of_household': 23625, 'single': 15750, 'married_separate': 15750},  # RP2532 s.3.01 ("$31,500 / $23,625 / $15,750 / $15,750"; "section 2.15(1) of Rev. Proc. 2024-40 is removed"); PL11921 s.70102(b) ("inserting $23,625" / "$15,750"); FEDKEY s.2 agrees; read 2026-10-31
    2026: {'married_joint': 32200, 'head_of_household': 24150, 'single': 16100, 'married_separate': 16100},  # RP2532 s.4.14(1) ("$32,200 / $24,150 / $16,100 / $16,100"); FEDKEY s.2 agrees; read 2026-10-31
}
SUPERSEDED_2025_STANDARD_DEDUCTION = {'married_joint': 30000, 'head_of_household': 22500, 'single': 15000, 'married_separate': 15000}  # RP2440 s.2.15(1), removed by RP2532 s.3.01; kept only so check_tables() shows it is not used; read 2026-10-31
CG_ZERO_TOP = {  # "maximum zero rate amount" (1(j)(5)(B)(i)): qualified income stacked under this taxable income is taxed at 0%
    2025: {'married_joint': 96700, 'married_separate': 48350, 'head_of_household': 64750, 'single': 48350},  # RP2440 s.2.03 ("$96,700 / $48,350 / $64,750 / $48,350"); I1040 QDCG worksheet line 6; FEDKEY s.5 agrees; read 2026-10-31
    2026: {'married_joint': 98900, 'married_separate': 49450, 'head_of_household': 66200, 'single': 49450},  # RP2532 s.4.03 ("$98,900 / $49,450 / $66,200 / $49,450"); FEDKEY s.5 agrees; read 2026-10-31
}
CG_15_TOP = {  # "maximum 15-percent rate amount" (1(j)(5)(B)(ii)): above it, 20%
    2025: {'married_joint': 600050, 'married_separate': 300000, 'head_of_household': 566700, 'single': 533400},  # RP2440 s.2.03 ("$600,050 / $300,000 / $566,700 / $533,400"); I1040 QDCG worksheet line 13; FEDKEY s.5 agrees; read 2026-10-31
    2026: {'married_joint': 613700, 'married_separate': 306850, 'head_of_household': 579600, 'single': 545500},  # RP2532 s.4.03 ("$613,700 / $306,850 / $579,600 / $545,500"); FEDKEY s.5 agrees; read 2026-10-31
}
CG_RATES = (F(0), F(15, 100), F(20, 100))  # USC1 (h)(1)(B) "0 percent", (C) "15 percent", (D) "20 percent"; I1040 QDCG worksheet lines 9, 18 "15% (0.15)", 21 "20% (0.20)"; read 2026-10-31
NIIT_RATE = F(38, 1000)  # USC1411 (a)(1) "a tax equal to 3.8 percent of the lesser of"; F8960 line 17 "Multiply line 16 by 3.8% (0.038)"; read 2026-10-31
NIIT_THRESHOLD = {'married_joint': 250000, 'married_separate': 125000, 'single': 200000, 'head_of_household': 200000}  # USC1411 (b)(1) "$250,000", (b)(2) "1/2 of the dollar amount determined under paragraph (1)", (b)(3) "in any other case, $200,000"; not indexed; FEDKEY s.8 agrees; read 2026-10-31
CAPITAL_LOSS_LIMIT = {'married_separate': 1500, 'other': 3000}  # USC1211 (b)(1) "$3,000 ($1,500 in the case of a married individual filing a separate return)"; FSD line 21; P550 "Limit on deduction"; read 2026-10-31
EXTRA = 1000  # page convention (brief rule 3): "$1,000 more of ordinary income" / "of qualified income"; no legal source; read 2026-10-31
HARVEST_MIN_LOSS = 1  # page convention (brief rule 3): "a loss of more than $1"; no legal source; read 2026-10-31
SELL_ORDER_SHOWN = 8  # page convention (brief rule 6): "only the first eight listed"; no legal source; read 2026-10-31


def standard_deduction(year, status):
    return F(STANDARD_DEDUCTION[year][status])


def loss_limit(status):
    return F(CAPITAL_LOSS_LIMIT['married_separate' if status == 'married_separate' else 'other'])


def regular_tax(year, status, taxable_income):
    """Exact Tax Computation formula on the year's brackets, at every income (no Tax Table rounding under $100,000: the
    federal key's convention, FEDKEY s.1 "Tax is worked with the Tax Computation formula on exact amounts")."""
    if year not in BRACKET_TOPS:
        raise ValueError('%s: the key has brackets for 2025 and 2026 only' % year)
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


def qdcg_tax(year, status, taxable_income, qualified_dividends, net_capital_gain):
    """I1040 Qualified Dividends and Capital Gain Tax Worksheet, lines 1-25 (the 1(h)(1) computation with the 1(j)(5)
    breakpoints), exact, with the formula tax on lines 22 and 24. Returns dict(line5, line9, line17, line20, tax)."""
    l1 = max(F(0), _F(taxable_income))
    l2, l3 = _F(qualified_dividends), max(F(0), _F(net_capital_gain))
    l4 = l2 + l3
    l5 = max(F(0), l1 - l4)
    l6 = F(CG_ZERO_TOP[year][status])
    l7 = min(l1, l6)
    l8 = min(l5, l7)
    l9 = l7 - l8                  # taxed at 0%
    l10 = min(l1, l4)
    l11 = l9
    l12 = l10 - l11
    l13 = F(CG_15_TOP[year][status])
    l14 = min(l1, l13)
    l15 = l5 + l9
    l16 = max(F(0), l14 - l15)
    l17 = min(l12, l16)           # taxed at 15%
    l18 = CG_RATES[1] * l17
    l19 = l9 + l17
    l20 = l10 - l19               # taxed at 20%
    l21 = CG_RATES[2] * l20
    l22 = regular_tax(year, status, l5)
    l23 = l18 + l21 + l22
    l24 = regular_tax(year, status, l1)
    l25 = min(l23, l24)
    return {'line5': l5, 'line9': l9, 'line17': l17, 'line20': l20, 'tax': l25}


# =====================================================================================================
# 2. Schedule D netting, the $3,000 limit, the carryover, NIIT, and the federal total
# =====================================================================================================
def schedule_d(status, st_net, lt_net):
    """FSD: line 7 = net short-term, line 15 = net long-term, line 16 = 7 + 15. A gain on 16 goes to Form 1040 line 7a;
    a loss: the smaller of the loss and $3,000 ($1,500 married filing separately) (line 21; USC1211(b)). Net capital gain
    for the 0/15/20% rates = the smaller of lines 15 and 16, 0 when either is a loss (I1040 QDCG worksheet line 3;
    USC1222(11) "the excess of the net long-term capital gain ... over the net short-term capital loss")."""
    l7, l15 = _F(st_net), _F(lt_net)
    l16 = l7 + l15
    if l16 >= 0:
        line7a, allowed = l16, F(0)
    else:
        allowed = min(loss_limit(status), -l16)   # line 21 as a positive amount
        line7a = -allowed
    ncg = min(l15, l16) if (l15 > 0 and l16 > 0) else F(0)
    return {'line7': l7, 'line15': l15, 'line16': l16, 'line7a': line7a, 'allowed_loss': allowed, 'net_capital_gain': ncg}


def carryover(status, st_net, lt_net, taxable_income_signed):
    """Capital Loss Carryover Worksheet (ISD p.9 = P550 Worksheet 4-1) applied to THIS year's figures, giving the carryover
    to next year (USC1212(b)(1)-(2): the character is kept; the allowed 1211(b) amount, up to adjusted taxable income, is
    treated as a short-term gain, so short-term losses are used first, P550 "Use short-term losses first").
    taxable_income_signed = Form 1040 line 15 "if you could enter a negative amount". Returns (short_carry, long_carry)."""
    sd = schedule_d(status, st_net, lt_net)
    if sd['line16'] >= 0:
        return F(0), F(0)
    st, lt = sd['line7'], sd['line15']
    w1 = _F(taxable_income_signed)
    w2 = sd['allowed_loss']
    w3 = max(F(0), w1 + w2)
    w4 = min(w2, w3)
    if st < 0:
        w5, w6 = -st, max(F(0), lt)
        w8 = max(F(0), w5 - (w4 + w6))
    else:
        w5, w8 = F(0), F(0)
    if lt < 0:
        w9, w10 = -lt, max(F(0), st)
        w11 = max(F(0), w4 - w5)
        w13 = max(F(0), w9 - (w10 + w11))
    else:
        w13 = F(0)
    return w8, w13


def net_investment_income(interest, dividends, line7a):
    """F8960 lines 1 (interest), 2 (ordinary dividends, which include qualified ones), 5a (Form 1040 line 7a: the net
    gain, or the ALLOWED loss of up to $3,000 / $1,500), line 8 combines them, line 12 "If zero or less, enter -0-".
    CFR14114 (d)(3)(ii) Example 1: "A may reduce net investment income by the $3,000 of the excess of capital losses over
    capital gains allowed for income tax purposes under section 1211(b)". No deductions (Part II) in the case."""
    return max(F(0), _F(interest) + _F(dividends) + _F(line7a))


def niit(status, magi, nii):
    """USC1411(a)(1): 3.8% of the lesser of net investment income and MAGI over the threshold (MAGI = AGI here, I8960
    Line 13: no foreign income, no CFC or PFIC)."""
    return NIIT_RATE * min(max(F(0), _F(nii)), max(F(0), _F(magi) - NIIT_THRESHOLD[status]))


def federal_tax(year, status, interest, qualified_dividends, st_net, lt_net):
    """The case's federal tax for the year: one or two adults under 65, no dependents, standard deduction (no additions),
    income = taxable interest + qualified dividends (= all ordinary dividends) + the Schedule D result.
    Income tax (QDCG worksheet) + NIIT. No credits, no AMT (not modelled). Exact; nothing rounded."""
    if year not in TAX_YEARS:
        raise ValueError('%s: the key covers tax years 2025 and 2026' % year)
    if status not in STATUSES:
        raise ValueError('unknown filing status %r' % status)
    i, q = _F(interest), _F(qualified_dividends)
    if i < 0 or q < 0:
        raise ValueError('interest and dividends are never negative in the case')
    sd = schedule_d(status, st_net, lt_net)
    agi = i + q + sd['line7a']
    ti_signed = agi - standard_deduction(year, status)
    ti = max(F(0), ti_signed)
    if q + sd['net_capital_gain'] > 0:
        income_tax = qdcg_tax(year, status, ti, q, sd['net_capital_gain'])['tax']
    else:
        income_tax = regular_tax(year, status, ti)
    nii = net_investment_income(i, q, sd['line7a'])
    n = niit(status, agi, nii)
    st_carry, lt_carry = carryover(status, st_net, lt_net, ti_signed)
    return {'agi': agi, 'taxable_income_signed': ti_signed, 'taxable_income': ti, 'income_tax': income_tax,
            'nii': nii, 'niit': n, 'total': income_tax + n, 'schedule_d': sd,
            'carry_short': st_carry, 'carry_long': lt_carry}


RATE_TOTALS_TO_CENT = True  # page convention (R2, revised 2026-10-31 after the comparison): each federal total is money, so it is rounded half up to the cent before the two are subtracted; no source decides how a rate is rounded (I1040 "Rounding off to whole dollars": "You can round off cents to whole dollars on your return and schedules", so a return's totals are rounded figures); read 2026-10-31


def page_rates(year, status, interest, qualified_dividends, st_realized, lt_realized):
    """Brief rule 3 (page convention): marginal rate = (total with $1,000 more taxable interest - total) / 1,000, gains rate
    = the same with $1,000 more qualified dividends; the total includes NIIT, where the extra $1,000 is investment income
    (USC1411(c)(1)(A)(i): "gross income from interest, dividends"); never below 0. Each total is rounded half up to the
    cent first (R2: a total of tax is an amount of money), so a rate is a multiple of 0.00001; exact Fractions otherwise."""
    def total(*a):
        t = federal_tax(year, status, *a)['total']
        return round_half_up(t, CENT) if RATE_TOTALS_TO_CENT else t
    base = total(interest, qualified_dividends, st_realized, lt_realized)
    up_i = total(_F(interest) + EXTRA, qualified_dividends, st_realized, lt_realized)
    up_q = total(interest, _F(qualified_dividends) + EXTRA, st_realized, lt_realized)
    return {'marginal': max(F(0), (up_i - base) / EXTRA), 'gains': max(F(0), (up_q - base) / EXTRA)}


# =====================================================================================================
# 3. Holding period (rule 1)
# =====================================================================================================
LONG_TERM_MONTHS = 12  # USC1222(3) "held for more than 1 year"; (1) "not more than 1 year" is short; P550 "If you hold investment property more than 1 year ... long-term"; read 2026-10-31
# P550 Holding Period: "begin counting on the date after the day you acquired the property. The day you disposed of the
# property is part of your holding period." Example: bought January 31, 2024: sold January 29, 2025 "not more than 1 year";
# sold February 6, 2025 "more than 1 year". Read 2026-10-31.
# RR6607: "the holding period of a capital asset begins to run on the day following the date of acquisition ... a capital
# asset acquired on the last day of any calendar month, regardless of whether the month has 31 days or less, must not be
# disposed of until on or after the first day of the seventh succeeding month" (6-month rule then; "an asset acquired on
# April 30, 1963, must not have been disposed of before November 1, 1963"). Read 2026-10-31 (secondary copy).


def _month_shift(y, m, k):
    """(year, month) k months after (y, m)."""
    n = y * 12 + (m - 1) + k
    return n // 12, n % 12 + 1


def _is_last_day_of_month(d):
    return (d + timedelta(days=1)).month != d.month


def first_long_day_law(acquired, months=LONG_TERM_MONTHS):
    """The first sale date on which the lot is held more than `months` months: calendar months counted from the day after
    the purchase (P550; RR6607). A purchase on the last day of a month: the first day of the (months + 1)th month after
    (RR6607). Any other day: the same day of the month `months` later, plus one day. None for a blank date."""
    d = _d(acquired)
    if d is None:
        return None
    if _is_last_day_of_month(d):
        y, m = _month_shift(d.year, d.month, months + 1)
        return date(y, m, 1)
    y, m = _month_shift(d.year, d.month, months)
    try:
        return date(y, m, d.day) + timedelta(days=1)  # months = 12 keeps the month, so the day always exists then
    except ValueError:  # only for other `months` (e.g. August 30 + 6): the period ends with the shorter month
        y, m = _month_shift(y, m, 1)
        return date(y, m, 1)


def anniversary(acquired, years=1):
    """Same month and day `years` later; February 29 falls back to February 28 in a common year."""
    d = _d(acquired)
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)


def first_long_day_page(acquired):
    """Brief rule 1 (page convention): the day after the first anniversary; a February 29 purchase: March 1 next year."""
    d = _d(acquired)
    return None if d is None else anniversary(d) + timedelta(days=1)


def term(acquired, on, rule='law'):
    """'long' or 'short' for a sale on date `on`. A blank date is long (page convention: the key cannot know better)."""
    first = (first_long_day_law if rule == 'law' else first_long_day_page)(acquired)
    if first is None:
        return 'long'
    return 'long' if _d(on) >= first else 'short'


def days_until_long(acquired, on, rule='law'):
    """Calendar days from `on` to the first long-term day; 0 when already long (or no date)."""
    first = (first_long_day_law if rule == 'law' else first_long_day_page)(acquired)
    if first is None:
        return 0
    return max(0, (first - _d(on)).days)


def rules_differ(acquired):
    """True when the law's and the page's first long-term day differ: only a purchase on February 28 of a year whose next
    year is a leap year (law March 1, page February 29)."""
    d = _d(acquired)
    return d is not None and first_long_day_law(d) != first_long_day_page(d)


# =====================================================================================================
# 4. Lots, values, the unassigned lot (rule 2)
# =====================================================================================================
def make_lots(holdings):
    """holdings: list of dicts {symbol, account ('taxable'|'ira'), price, total_shares (blank = the lots' shares),
    total_cost (blank = the lots' cost), lots: [(date or None, shares, cost), ...]}. Returns the flat list of lots, in input
    order (holding order, then lot order, the holding's unassigned lot last), each a dict with id, holding, symbol, account,
    date, shares, cost, price, value, gain, unassigned. Shares must be > 0 and costs >= 0 (refused otherwise)."""
    out = []
    for h, hold in enumerate(holdings):
        if hold['account'] not in ACCOUNT_KINDS:
            raise ValueError('account kind must be taxable or ira')
        price = _F(hold['price'])
        if price < 0:
            raise ValueError('a price is never negative')
        lot_sh, lot_cost = F(0), F(0)
        for k, (dt, sh, cost) in enumerate(hold.get('lots', ())):
            sh, cost = _F(sh), _F(cost)
            if sh <= 0 or cost < 0:
                raise ValueError('holding %d lot %d: shares must be > 0 and cost >= 0' % (h, k))
            lot_sh += sh
            lot_cost += cost
            out.append(_lot('h%dl%d' % (h, k), h, hold, _d(dt), sh, cost, price, False))
        tot_sh, tot_cost = _opt(hold.get('total_shares')), _opt(hold.get('total_cost'))
        tot_sh = lot_sh if tot_sh is None else tot_sh
        tot_cost = lot_cost if tot_cost is None else tot_cost
        rest = tot_sh - lot_sh
        if rest > 0:  # brief rule 2: "shares not covered by lots, cost = holding cost basis - lots' cost, floored at 0"
            out.append(_lot('h%du' % h, h, hold, None, rest, max(F(0), tot_cost - lot_cost), price, True))
    return out


def _lot(lid, h, hold, dt, sh, cost, price, unassigned):
    value = sh * price
    return {'id': lid, 'holding': h, 'symbol': hold['symbol'], 'account': hold['account'], 'date': dt, 'shares': sh,
            'cost': cost, 'price': price, 'value': value, 'gain': value - cost, 'unassigned': unassigned}


def holding_totals(lots):
    """Per holding: shares, value, cost, gain summed over its lots (the unassigned lot included)."""
    tot = {}
    for l in lots:
        t = tot.setdefault(l['holding'], {'shares': F(0), 'value': F(0), 'cost': F(0), 'gain': F(0)})
        for k in t:
            t[k] += l[k]
    return tot


# =====================================================================================================
# 5. Harvest candidates and the page's tax saved (rule 3)
# =====================================================================================================
def is_candidate(lot):
    """Brief rule 3: a lot in a taxable account with a loss of more than $1 (loss = cost - value, exact)."""
    return lot['account'] == 'taxable' and lot['cost'] - lot['value'] > HARVEST_MIN_LOSS


def page_tax_saved(lot, today, rates):
    """Brief rule 3: loss x marginal rate (short-term today, page term) or x gains rate (long-term)."""
    r = rates['marginal'] if term(lot['date'], today, 'page') == 'short' else rates['gains']
    return (lot['cost'] - lot['value']) * r


# =====================================================================================================
# 6. Wash sales (rule 5)
# =====================================================================================================
WASH_DAYS = 30  # USC1091 (a) "within a period beginning 30 days before the date of such sale or disposition and ending 30 days after such date"; CFR10911 (a) "(referred to in this section as the 61-day period)"; P550 "within 30 days before or after the sale"; read 2026-10-31
# CFR10911 (b): same-day losses "will be considered to have been disposed of in the order in which they were originally
# acquired (beginning with the earliest acquisition)". (c): fewer shares acquired than sold: "The stock or securities
# acquired will be matched in accordance with the order of their acquisition (beginning with the earliest acquisition)
# with an equal number of the shares of stock or securities sold". (d): not fewer: the shares sold "will be matched with
# an equal number of the shares ... acquired in accordance with the order of acquisition". (e): an acquisition that made
# one loss nondeductible "shall be disregarded in determining the deductibility of any other loss". Read 2026-10-31.
# USC1091 (d) / CFR10912 / P550: the replacement's basis = its cost + the disallowed loss; RR0805: an IRA or Roth IRA
# purchase disallows the loss and "A's basis in the individual retirement account or Roth IRA is not increased";
# USC1223(3) / CFR12231 (d): the replacement's holding period includes the sold shares'. Read 2026-10-31.


def _acq_key(lot, order):
    """Order of acquisition: dated lots by date; a blank date (and the unassigned lot) counts as the earliest (key
    convention W4); ties in input order."""
    return (0, date.min, order) if lot['date'] is None else (1, lot['date'], order)


def wash_sales(lots, sale_date, sold_ids):
    """Every lot in sold_ids is sold on sale_date at its lot price. Returns {sold id: {...}} for the sold lots with a loss:
    wash_sale (bool), matched_shares, disallowed (the loss on the matched shares), allowed, chunks [(replacement id,
    shares, basis_add, account, lost_for_good)], any_other_recent (the brief's plain test: any other same-symbol lot dated in
    the window, whether or not sold). Replacements: same symbol (convention W1), any account (P550: spouse too), dated from
    sale_date - 30 to sale_date + 30 days (in the case nothing is dated after today), not sold in the same harvest
    (convention W3), with a date (convention W4)."""
    sale = _d(sale_date)
    lo, hi = sale - timedelta(days=WASH_DAYS), sale + timedelta(days=WASH_DAYS)
    sold_ids = set(sold_ids)
    order = {l['id']: n for n, l in enumerate(lots)}
    result = {}
    for sym in sorted({l['symbol'] for l in lots}):
        same = [l for l in lots if l['symbol'] == sym]
        sold = sorted((l for l in same if l['id'] in sold_ids and l['cost'] > l['value']),
                      key=lambda l: _acq_key(l, order[l['id']]))
        pool = sorted((l for l in same if l['id'] not in sold_ids and l['date'] is not None and lo <= l['date'] <= hi),
                      key=lambda l: _acq_key(l, order[l['id']]))
        left = {l['id']: l['shares'] for l in pool}
        for x in sold:
            loss = x['cost'] - x['value']
            per_share = loss / x['shares']
            need, chunks = x['shares'], []
            for r in pool:
                if need == 0:
                    break
                take = min(need, left[r['id']])
                if take > 0:
                    left[r['id']] -= take
                    need -= take
                    chunks.append((r['id'], take, per_share * take, r['account'], r['account'] == 'ira'))
            matched = x['shares'] - need
            disallowed = per_share * matched
            recent = any(l['id'] != x['id'] and l['date'] is not None and lo <= l['date'] <= hi for l in same)
            result[x['id']] = {'wash_sale': matched > 0, 'matched_shares': matched, 'disallowed': disallowed,
                               'allowed': loss - disallowed, 'chunks': chunks, 'any_other_recent': recent}
    return result


def _shares(x):
    """Shares for display: up to six decimals, trailing zeros dropped."""
    v = show_rate(x).normalize()
    return format(v, 'f')


def basis_note(wash, lots_by_id, sold_lot, sale_date):
    """Plain words for the basis adjustment of one sold lot's wash sale."""
    if not wash['wash_sale']:
        return ''
    parts = []
    for rid, sh, add, acct, lost in wash['chunks']:
        r = lots_by_id[rid]
        if lost:
            parts.append('%s shares of %s (IRA, bought %s): loss %s lost for good; IRA basis not increased (Rev. Rul. 2008-5)'
                         % (_shares(sh), rid, r['date'], show(add)))
        else:
            hp = ('long-term at once (holding period includes the sold lot\'s, IRC 1223(3))'
                  if term(sold_lot['date'], sale_date, 'law') == 'long' else
                  'holding period includes the sold lot\'s (IRC 1223(3))')
            parts.append('%s shares of %s (taxable, bought %s): basis %s + %s = %s; %s'
                         % (_shares(sh), rid, r['date'], show(r['cost'] * sh / r['shares']), show(add),
                            show(r['cost'] * sh / r['shares'] + add), hp))
    return '; '.join(parts) + '. A purchase in the next 30 days would also make it a wash sale (not knowable today).'


def same_day_sensitive(lots, sale_date, sold_ids):
    """Convention W3 check: True when a lot dated in the window is itself sold in the harvest while another loss lot of the
    same symbol, bought earlier, is sold too: the literal reading of 1091 would then defer the earlier lot's loss into the
    later lot's basis and holding period, changing the short/long split of this year's losses (not their total)."""
    sale = _d(sale_date)
    lo = sale - timedelta(days=WASH_DAYS)
    sold = [l for l in lots if l['id'] in set(sold_ids) and l['cost'] > l['value']]
    for r in sold:
        if r['date'] is None or not (lo <= r['date'] <= sale):
            continue
        for x in sold:
            if x is not r and x['symbol'] == r['symbol'] and (x['date'] is None or x['date'] < r['date']):
                return True
    return False


# =====================================================================================================
# 7. The law's harvest figure (rule 4)
# =====================================================================================================
def harvest(year, status, interest, qualified_dividends, st_realized, lt_realized, holdings, today):
    """Rules 3 to 5 for one household. The law's figure sells every candidate today: allowed losses (after wash sales) join
    the year's realized short/long results by each lot's term today (law), then the federal total with and without."""
    today = _d(today)
    if today.year != year:
        raise ValueError('the tax year is today\'s year')
    lots = make_lots(holdings)
    for l in lots:
        if l['date'] is not None and l['date'] > today:
            raise ValueError('%s is dated after today' % l['id'])
    rates = page_rates(year, status, interest, qualified_dividends, st_realized, lt_realized)
    cands = [l for l in lots if is_candidate(l)]
    ids = [l['id'] for l in cands]
    wash = wash_sales(lots, today, ids)
    st_loss = sum((wash[l['id']]['allowed'] for l in cands if term(l['date'], today, 'law') == 'short'), F(0))
    lt_loss = sum((wash[l['id']]['allowed'] for l in cands if term(l['date'], today, 'law') == 'long'), F(0))
    without = federal_tax(year, status, interest, qualified_dividends, st_realized, lt_realized)
    with_ = federal_tax(year, status, interest, qualified_dividends, _F(st_realized) - st_loss, _F(lt_realized) - lt_loss)
    page_each = {l['id']: page_tax_saved(l, today, rates) for l in cands}
    page_total = sum(page_each.values(), F(0))
    law = without['total'] - with_['total']
    return {'lots': lots, 'rates': rates, 'candidates': ids, 'wash': wash, 'page_each': page_each,
            'page_total': page_total, 'st_loss_allowed': st_loss, 'lt_loss_allowed': lt_loss,
            'without': without, 'with': with_, 'law_saved': law,
            'ratio': None if page_total == 0 else law / page_total,
            'carry_with': (with_['carry_short'], with_['carry_long']),
            'carry_without': (without['carry_short'], without['carry_long']),
            'carry_new': (with_['carry_short'] - without['carry_short'], with_['carry_long'] - without['carry_long']),
            'same_day_sensitive': same_day_sensitive(lots, today, ids)}


# =====================================================================================================
# 8. Order to sell when cash is needed (rule 6)
# =====================================================================================================
def page_sell_order(lots):
    """Brief rule 6 (page convention): taxable lots by gain per share, lowest first; Python's sort is stable, so ties keep
    input order (key convention O1); the first eight."""
    tl = [l for l in lots if l['account'] == 'taxable']
    return [l['id'] for l in sorted(tl, key=lambda l: l['gain'] / l['shares'])][:SELL_ORDER_SHOWN]


def tax_per_dollar(lot, today, rates):
    """max(0, gain) x (marginal rate if short today, gains rate if long) / value; None when value is 0."""
    if lot['value'] == 0:
        return None
    r = rates['marginal'] if term(lot['date'], today, 'law') == 'short' else rates['gains']
    return max(F(0), lot['gain']) * r / lot['value']


def contrast_sell_order(lots, today, rates, limit=SELL_ORDER_SHOWN):
    """Contrast: losses first, most negative gain per dollar first; then tax per dollar raised, lowest first; a lot worth
    0 last; ties in input order."""
    def key(l):
        if l['value'] == 0:
            return (2, F(0))
        if l['gain'] < 0:
            return (0, l['gain'] / l['value'])
        return (1, tax_per_dollar(l, today, rates))
    tl = [l for l in lots if l['account'] == 'taxable']
    out = [l['id'] for l in sorted(tl, key=key)]
    return out if limit is None else out[:limit]


# =====================================================================================================
# 9. Self-checks: the revenue procedures' printed bases, the sources' own examples, RULES.md section 10
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
    assert STANDARD_DEDUCTION[2025]['single'] != SUPERSEDED_2025_STANDARD_DEDUCTION['single']
    # P550 Holding Period example: bought January 31, 2024; January 29, 2025 short; February 6, 2025 long.
    assert term('2024-01-31', '2025-01-29') == 'short' and term('2024-01-31', '2025-02-06') == 'long'
    assert first_long_day_law('2024-01-31') == first_long_day_page('2024-01-31') == date(2025, 2, 1)
    # RR6607: April 30, 1963 + "more than 6 months" -> not before November 1, 1963.
    assert first_long_day_law('1963-04-30', months=6) == date(1963, 11, 1)
    # February 29 and the one case where law and page differ.
    assert first_long_day_law('2024-02-29') == first_long_day_page('2024-02-29') == date(2025, 3, 1)
    assert first_long_day_law('2024-02-28') == first_long_day_page('2024-02-28') == date(2025, 3, 1)
    assert first_long_day_law('2023-02-28') == date(2024, 3, 1) and first_long_day_page('2023-02-28') == date(2024, 2, 29)
    assert first_long_day_law('2027-02-28') == date(2028, 3, 1) and first_long_day_page('2027-02-28') == date(2028, 2, 29)
    assert rules_differ('2023-02-28') and not rules_differ('2025-02-28') and not rules_differ('2024-02-29')
    assert all(not rules_differ(date(2024, 1, 1) + timedelta(days=k)) for k in range(366 + 365 + 365))  # 2024-2026 purchases: none differ
    n += 12
    # CFR10911 (h) Example 1: Dec 1, 1954 100 sh $10,000; Dec 15 100 sh $9,000; Jan 3, 1955 sells the Dec 1 shares for $9,000.
    hs = [{'symbol': 'M', 'account': 'taxable', 'price': 90, 'lots': [('1954-12-01', 100, 10000), ('1954-12-15', 100, 9000)]}]
    w = wash_sales(make_lots(hs), '1955-01-03', ['h0l0'])['h0l0']
    assert w['wash_sale'] and w['disallowed'] == 1000 and w['allowed'] == 0
    # CFR10911 (h) Example 2 = P550 Wash Sales Example 1: 100 sh $5,000 sold for $4,000; 50 sh for $2,750 and 25 sh for $1,125
    # within 30 days before: $750 disallowed, $250 allowed, new bases $3,250 and $1,375.
    hs = [{'symbol': 'M', 'account': 'taxable', 'price': 40,
           'lots': [('1954-09-21', 100, 5000), ('1954-12-21', 50, 2750), ('1954-12-27', 25, 1125)]}]
    lots = make_lots(hs)
    w = wash_sales(lots, '1955-01-03', ['h0l0'])['h0l0']
    assert w['disallowed'] == 750 and w['allowed'] == 250 and w['matched_shares'] == 75
    assert [(c[0], 2750 + c[2] if c[0] == 'h0l1' else 1125 + c[2]) for c in w['chunks']] == [('h0l1', 3250), ('h0l2', 1375)]
    # CFR10911 (h) Example 3 (and P550 Example 2): 50 sh bought on each of four days after the sale: the first 100 match.
    hs = [{'symbol': 'M', 'account': 'taxable', 'price': 40,
           'lots': [('1954-09-15', 100, 5000)] + [('1956-02-%02d' % d, 50, 2000) for d in (15, 16, 17, 18)]}]
    w = wash_sales(make_lots(hs), '1956-02-01', ['h0l0'])['h0l0']
    assert w['disallowed'] == 1000 and [c[0] for c in w['chunks']] == ['h0l1', 'h0l2']
    # CFR10912 Examples 1-2: old share $100 sold for $80; new share $90 -> basis $110; new share $70 -> basis $90.
    for new, basis in ((90, 110), (70, 90)):
        hs = [{'symbol': 'Y', 'account': 'taxable', 'price': 80, 'lots': [('1935-06-01', 1, 100), ('1955-01-01', 1, new)]}]
        w = wash_sales(make_lots(hs), '1955-01-15', ['h0l0'])['h0l0']
        assert new + w['chunks'][0][2] == basis
    # RR0805: 100 sh basis $1,000 sold for $600; the IRA buys 100 sh the next day: loss disallowed, IRA basis not increased.
    hs = [{'symbol': 'X', 'account': 'taxable', 'price': 6, 'lots': [('2007-01-02', 100, 1000)]},
          {'symbol': 'X', 'account': 'ira', 'price': 6, 'lots': [('2007-12-21', 100, 600)]}]
    w = wash_sales(make_lots(hs), '2007-12-20', ['h0l0'])['h0l0']
    assert w['disallowed'] == 400 and w['chunks'][0][4] is True
    n += 9
    # P550 Capital loss carryover example (Bob and Shelly): $7,000 loss, taxable income $26,000: deduct $3,000, carry $4,000.
    assert sum(carryover('married_joint', -7000, 0, 26000)) == 4000 and sum(carryover('married_joint', -2000, 0, 27000)) == 0
    # CFR14114 (d)(3)(ii) Example 1: interest $5,000, net capital loss $30,000 of which $3,000 allowed: NII 5,000 - 3,000.
    assert net_investment_income(5000, 0, schedule_d('single', 0, -30000)['line7a']) == 2000
    assert carryover('single', 0, -30000, 300000 + 5000 - 3000 - 16100)[1] == 27000
    n += 4
    n += worked_examples()
    return n


def worked_examples():
    """tests/golden/tax-lots/RULES.md section 10, worked by hand there and asserted here."""
    n = 0
    # 10.1 Ana: single, 2026, interest $240,000; one long-term lot with a $40,000 loss; nothing realized this year.
    r = harvest(2026, 'single', 240000, 0, 0, 0,
                [{'symbol': 'ZZTOT', 'account': 'taxable', 'price': '60.00', 'lots': [('2022-03-14', 1000, 100000)]}],
                '2026-11-16')
    assert r['without']['income_tax'] == 48104 and r['without']['niit'] == 1520
    assert r['with']['income_tax'] == 47144 and r['with']['niit'] == 1406
    assert r['law_saved'] == 1074 and r['rates']['gains'] == F('0.188') and r['page_total'] == 7520
    assert show_rate(r['ratio']) == D('0.142819') and r['carry_with'] == (0, 37000) and r['carry_new'] == (0, 37000)
    n += 4
    # 10.2 Ben and Cy: married filing jointly, 2025, interest $120,000, qualified dividends $5,000, realized long-term $25,000;
    # a short-term lot losing $8,000 and a long-term lot losing $12,000.
    r = harvest(2025, 'married_joint', 120000, 5000, 0, 25000,
                [{'symbol': 'ZZTEC', 'account': 'taxable', 'price': '40.00',
                  'lots': [('2025-06-02', 400, 24000), ('2021-09-20', 300, 24000)]}],
                '2025-12-15')
    assert r['without']['total'] == 13413 and r['with']['total'] == 10413 and r['law_saved'] == 3000
    assert r['rates']['marginal'] == F('0.27') and r['rates']['gains'] == F('0.15')
    assert r['page_each'] == {'h0l0': 2160, 'h0l1': 1800} and r['page_total'] == 3960
    assert show_rate(r['ratio']) == D('0.757576') and r['carry_with'] == (0, 0)
    n += 4
    # 10.3 Dee: single, 2025, interest $50,000; 100 shares bought February 29, 2024 for $5,000, worth $42 a share.
    hs = [{'symbol': 'ZZSML', 'account': 'taxable', 'price': '42.00', 'lots': [('2024-02-29', 100, 5000)]}]
    a = harvest(2025, 'single', 50000, 0, 0, 0, hs, '2025-02-28')
    b = harvest(2025, 'single', 50000, 0, 0, 0, hs, '2025-03-01')
    assert term('2024-02-29', '2025-02-28') == 'short' and days_until_long('2024-02-29', '2025-02-28') == 1
    assert term('2024-02-29', '2025-03-01') == 'long' and days_until_long('2024-02-29', '2025-03-01') == 0
    assert a['rates'] == b['rates'] == {'marginal': F('0.12'), 'gains': F(0)}
    assert a['page_total'] == 96 and b['page_total'] == 0 and a['law_saved'] == b['law_saved'] == 96 and b['ratio'] is None
    n += 4
    # 10.4 Eve: head of household, 2026, interest $95,000, qualified dividends $1,500, realized long-term $2,000; 200 shares in
    # her taxable account (2023, $24,000), 50 more in her IRA bought 12 days ago for $5,100; price $100.
    hs = [{'symbol': 'ZZTOT', 'account': 'taxable', 'price': '100.00', 'lots': [('2023-05-10', 200, 24000)]},
          {'symbol': 'ZZTOT', 'account': 'ira', 'price': '100.00', 'lots': [('2026-11-08', 50, 5100)]}]
    r = harvest(2026, 'head_of_household', 95000, 1500, 0, 2000, hs, '2026-11-20')
    w = r['wash']['h0l0']
    assert w['wash_sale'] and w['matched_shares'] == 50 and w['disallowed'] == 1000 and w['allowed'] == 3000
    assert w['chunks'] == [('h1l0', 50, 1000, 'ira', True)]
    assert r['without']['total'] == 9013 and r['with']['total'] == 8493 and r['law_saved'] == 520
    assert r['page_total'] == 600 and show_rate(r['ratio']) == D('0.866667') and r['carry_with'] == (0, 0)
    hs_no_ira = hs[:1]
    assert harvest(2026, 'head_of_household', 95000, 1500, 0, 2000, hs_no_ira, '2026-11-20')['law_saved'] == 740
    n += 5
    return n


CHECKS = check_tables()

if __name__ == '__main__':
    print('rules.py: %d self-checks passed (sources read %s)' % (CHECKS, READ_ON))
