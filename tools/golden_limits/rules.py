"""US contribution-limit rules for the limits answer key (401(k), IRAs, the Roth IRA income limit, HSAs, the
health FSA, contribution deadlines, 529 gifts and the tax an HSA saves through payroll), as data plus small pure
functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or
tests/*.test.mjs while writing this file, and it never imports or runs the app. Only the layout and
conventions of tools/golden_health/ and tools/golden_estate/ were looked at; no figure or code is shared with
them. Every figure names its source and the date it was read on the same line. Money is an exact Fraction
while it is worked and a Decimal when it is shown. Importing this file runs check_tables(), which also checks
the worked examples of tests/golden/limits/RULES.md.

Tax years covered: 2025 and 2026 for everything. 2027 only where the IRS had published the figure by
2026-10-31: the HSA limits (Rev. Proc. 2026-24) and the contribution deadline (a rule, not a figure). The
IRS had NOT published the 2027 retirement-plan notice (402(g), 414(v), 415(c), IRA, phase-outs) nor the 2027
inflation-adjustment revenue procedure (brackets, standard deduction, FSA limit, gift exclusion) by 2026-10-31,
so those tables have no 2027 entry and work_household() returns None for them in a 2027 row.

Rules covered (the page READMEs are the spec; where the law says otherwise the key follows the law and says so
in tests/golden/limits/RULES.md section 12):
  K401   402(g) elective-deferral limit, 414(v) catch-up from the year a person reaches 50, the higher catch-up
         for 60-63 (414(v)(2)(E)), pre-tax and Roth 401(k) sharing one limit (402A(c)(2)); contrast: the 415(c)
         annual-additions limit on deferrals (without catch-up) + employer match.
  IRA    219(b)(5) limit shared by traditional and Roth IRAs (408A(c)(2)); catch-up from 50, indexed from 2024.
  ROTH   408A(c)(3) income limit: MAGI, the year's phase-out range by filing status, the reduction with the
         219(g)(2)(B)-(C) $200 floor and $10 rounding; allowed = min(reduced limit, limit - traditional).
  TRAD   (contrast) the traditional IRA deduction under 219(g) for an active participant or a participant's spouse.
  HSA    223(b) self-only / family limits, the $1,000 catch-up at 55 into the person's own HSA, the family limit
         shared by spouses (223(b)(5)), employer and payroll money counted (223(b)(4), 106(d)).
  SAVE   the federal income tax and the employee payroll tax that the HSA payroll money saves; contrast 7.65% flat.
  FSA    125(i) salary-reduction limit, the carryover maximum (Notice 2013-71 as indexed by Notice 2020-33),
         the FSA + HSA conflict (223(c)(1)).
  DUE    the IRA / HSA deadline: the return due date without extensions (219(f)(3), 223(d)(4)(B), 408A(c)(6),
         6072(a)), moved by 7503 past weekends and District of Columbia legal holidays (D.C. Code 28-2701).
  GIFT   the 2503(b) annual exclusion and the 529(c)(2)(B) five-year election (5 x exclusion per giver).

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits). The U.S. Code pages are the
OLRC edition "current through Public Law 119-136 (October 22, 2026)", https://uscode.house.gov/us/usc/119-136/t26/s<N>/:
  USC402   26 U.S.C. 402(g)(1)-(4); amendment note: Pub. L. 117-328 s.603(b)(1) struck (g)(1)(C)   (5e82a2eb...06a671254f)
  USC402A  26 U.S.C. 402A(c)(1)-(2) designated Roth contributions   (fdd63642...25a1c2069b)
  USC414   26 U.S.C. 414(v)(1)-(3), (5), (7)   (aa3909ba...2833ad01fd)
  USC415   26 U.S.C. 415(c)(1)-(3)   (a569b3e0...e80eb43d67)
  USC219   26 U.S.C. 219(b), (c), (f)(1)-(3), (g)(1)-(8)   (205d6464...52444227ff)
  USC408A  26 U.S.C. 408A(c)(2), (3)(A)-(D), (6)   (0c54c46d...06d58c05a2)
  USC223   26 U.S.C. 223(a), (b)(1)-(8), (c)(1), (d)(1), (d)(4), (g)   (b7b5bdd4...b9d6f0bd15)
  USC106   26 U.S.C. 106(d)(1) employer HSA contributions   (bc00c0cb...ad9cd8798d)
  USC125   26 U.S.C. 125(i) health FSA limit   (a134d73f...c6d7bf300c)
  USC7503  26 U.S.C. 7503   (6fd6414b...56dff7aeac)
  USC6072  26 U.S.C. 6072(a)   (222fc98f...402f83081b)
  USC63    26 U.S.C. 63(c)(2), (c)(7) and the 2025 amendment notes   (ed5cc3db...c6cabf21e4)
  USC3101  26 U.S.C. 3101(a), (b)(1)-(2)   (04bdb134...e071c36d77)
  USC3102  26 U.S.C. 3102(f)(1)   (19f91715...de3697dba2)
  USC3121  26 U.S.C. 3121(a)(1), (a)(2)(B), (a)(5)(G), (v)(1)(A)   (a97b7469...b7ec1e4ccd)
  USC1401  26 U.S.C. 1401(b)(2)   (fe306dfb...0cd9f4a969)
  USC7703  26 U.S.C. 7703(a), (b): (b) needs a child, so spouses with no dependents stay married   (3b86233b...f919086579)
  USC529   26 U.S.C. 529(c)(2)(A)-(B)   (3b8244e8...7656bb9c1e)
  USC2503  26 U.S.C. 2503(b)(1)-(2)   (8ed278a2...47bb78f2a0)
  CGLAWS   congress.gov API, laws of the 119th Congress: count 138, the highest public law is 119-136 (Oct 22, 2026),
           the law the U.S. Code edition above runs through   https://api.congress.gov/v3/law/119   (a69dcbda...4523e89947)
  PL11921  Pub. L. 119-21, 139 Stat. 72, s.70102 (standard deduction)   https://www.congress.gov/119/plaws/publ21/PLAW-119publ21.htm
           (84000b07...c584e9004d; the govinfo copy is byte-identical)
  eCFR title 26 "up to date as of 2026-10-29" (https://www.ecfr.gov/api/versioner/v1/titles.json, b649b378...71de4d4618),
  read as XML from https://www.ecfr.gov/api/versioner/v1/full/2026-10-29/title-26.xml?section=<N>:
  CFR402G  26 CFR 1.402(g)-1(a), (d)(1), (e)(8)   (76bbb386...b829726970)
  CFR414V  26 CFR 1.414(v)-1(c)(2)(i)(B), (g)(3) [T.D. 9072, as amended by T.D. 10033, 90 FR 44547, Sept. 16, 2025]   (58d82560...871f70d248)
  CFR415C  26 CFR 1.415(c)-1(b)(1)(ii), (b)(2)(ii)(B), (D)   (78f6c111...1446d88e12)
  CFR7503  26 CFR 301.7503-1(a), (b)   (2c8d416a...506c8ea75c)
  CFR3101  26 CFR 31.3101-2(a), (b)(2) [T.D. 9645]   (24667e5f...6842367d05)
  DC2701   D.C. Code 28-2701 "Holidays designated", D.C. Council / Open Law Library
           https://code.dccouncil.gov/us/dc/council/code/sections/28-2701   (fbf67571...f780e9db41)
  N2480    IRS Notice 2024-80, 2025 retirement amounts   https://www.irs.gov/pub/irs-drop/n-24-80.pdf   (cbf7843c...4ed22e59ad)
  N2567    IRS Notice 2025-67, 2026 retirement amounts   https://www.irs.gov/pub/irs-drop/n-25-67.pdf   (1eea8f14...11dc0a1f8d)
  N2362    IRS Notice 2023-62, Roth catch-up transition and the stricken 402(g)(1)(C)   https://www.irs.gov/pub/irs-drop/n-23-62.pdf   (e1022cce...043c1534b9)
  N1371    IRS Notice 2013-71, health FSA $500 carryover   https://www.irs.gov/pub/irs-drop/n-13-71.pdf   (134ffa91...0fbc7d2d8a)
  N2033    IRS Notice 2020-33, carryover indexed to 20% of the 125(i) limit   https://www.irs.gov/pub/irs-drop/n-20-33.pdf   (5149c59b...076ff2f73a)
  RP2425   Rev. Proc. 2024-25, 2025 HSA amounts   https://www.irs.gov/pub/irs-drop/rp-24-25.pdf   (6093d2e3...c1ac65dc00)
  RP2519   Rev. Proc. 2025-19, 2026 HSA amounts   https://www.irs.gov/pub/irs-drop/rp-25-19.pdf   (ff2ba4ba...c11da35bf4)
  RP2624   Rev. Proc. 2026-24, 2027 HSA amounts   https://www.irs.gov/pub/irs-drop/rp-26-24.pdf   (bcb6b41a...f45afcb715)
  RP2440   Rev. Proc. 2024-40, 2025 inflation items: s.2.01 tables, s.2.15 standard deduction (later removed), s.2.16
           cafeteria plans, s.2.43 gifts   https://www.irs.gov/pub/irs-drop/rp-24-40.pdf   (4de9db6b...d4c302af1f)
  RP2532   Rev. Proc. 2025-32, s.3.01 (2025 standard deduction under Pub. L. 119-21), s.4.01 tables, s.4.14 standard
           deduction, s.4.15 cafeteria plans, s.4.42 gifts   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf   (e9ada115...a96214635b)
  RP2625   Rev. Proc. 2026-25 (Trump accounts safe harbor): "For calendar year 2026, the annual exclusion amount ... is
           $19,000"   https://www.irs.gov/pub/irs-drop/rp-26-25.pdf   (ccc5c989...1d42d22884)
  P590A    IRS Pub. 590-A (2025) "For use in preparing 2025 Returns": Tables 1-2, 1-3, 2-1, Worksheets 1-2 and 2-2
           with their illustrated examples, "What's New for 2026"   https://www.irs.gov/pub/irs-pdf/p590a.pdf   (ca0e4287...cc06a0e1c7)
  P590A15  Pub. 590-A (2015) "contributions for 2015 by April 18, 2016"   https://www.irs.gov/pub/irs-prior/p590a--2015.pdf   (eafd9d5b...e6a030a27f)
  P590A16  Pub. 590-A (2016) "contributions for 2016 by April 18, 2017"   https://www.irs.gov/pub/irs-prior/p590a--2016.pdf   (cbdcb506...b5d5afa97b)
  P590A21  Pub. 590-A (2021) "contributions for 2021 by April 18, 2022"   https://www.irs.gov/pub/irs-prior/p590a--2021.pdf   (0c1105ca...34f7c68147)
  P590A22  Pub. 590-A (2022) "contributions for 2022 by April 18, 2023"   https://www.irs.gov/pub/irs-prior/p590a--2022.pdf   (b84d1e67...a48847553c)
  P969     IRS Pub. 969 (2025), HSAs and other tax-favored health plans   https://www.irs.gov/pub/irs-pdf/p969.pdf   (d51681ec...407a5b522f)
  P15B     IRS Pub. 15-B (2026), "Health Savings Accounts (HSAs)"   https://www.irs.gov/pub/irs-pdf/p15b.pdf   (a0af8513...77b639ec46)
  I8959    Instructions for Form 8959 (2025), Example 5   https://www.irs.gov/pub/irs-pdf/i8959.pdf   (1d223be7...abf687b68f)
  I709     Instructions for Form 709 (2025), Line B and the Pat example   https://www.irs.gov/pub/irs-pdf/i709.pdf   (7de1ce38...8a47b75bcf)
  IRSCOLA  irs.gov "COLA increases for dollar limitations on benefits and contributions" (last reviewed 24-Aug-2026):
           columns 2026, 2025, 2024, 2023 only; "Taxable wage base 184,500 176,100"
           https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions   (f71666b8...c0cb6be4ff)
  IRSNEWS  irs.gov news releases for October 2026 (last reviewed 29-Oct-2026, IR-2026-117 to IR-2026-129), September 2026
           and August 2026: no release of 2027 retirement limits or of 2027 inflation adjustments
           https://www.irs.gov/newsroom/news-releases-for-current-month   (36a52141...4ea56d25a1),
           .../news-releases-for-september-2026 (a13ebe25...2f0b25adac), .../news-releases-for-august-2026 (e0eec8c5...251c67ba15)
  SSA25    SSA, "Cost-of-Living Increase and Other Determinations for 2025", 89 FR 85276 (Oct 25, 2024)
           https://www.govinfo.gov/content/pkg/FR-2024-10-25/pdf/2024-24871.pdf   (dea3f4c9...d3aeec5de6)
  SSA26    SSA, same title for 2026, 90 FR 49047 (Nov 3, 2025)
           https://www.govinfo.gov/content/pkg/FR-2025-11-03/pdf/2025-19763.pdf   (4d275490...d8d9326f97)
  SSA27    SSA, same title for 2027, 91 FR 67380 (Oct 26, 2026)
           https://www.govinfo.gov/content/pkg/FR-2026-10-26/pdf/2026-21796.pdf   (700ede41...444e40a20c)
  ssa.gov itself (https://www.ssa.gov/oact/cola/cbb.html) answered HTTP 403 "Access Denied" to this reader, so SSA's own
  notices in the Federal Register (govinfo) and the IRS COLA page were used for the wage bases.

NOT VERIFIED on any official source (the key states its own convention and RULES.md section 13 says so):
  - 2027 retirement-plan limits and 2027 inflation adjustments (brackets, standard deduction, FSA, gift exclusion):
    not published by 2026-10-31 (IRSCOLA has no 2027 column; IRSNEWS Aug-Oct 2026 has no such release; irs-drop
    n-26-64 to n-26-75 and rp-26-35 to rp-26-45 answered 404; the published rp-26-25 to -34 are on other subjects).
  - Whether an FSA election over the 125(i) limit is excluded up to the limit or not at all: the key excludes it up
    to the limit (convention).
  - The order in which the 401(k) catch-up is "used" for 415(c): the key counts deferrals over the 402(g) limit as
    catch-up first, up to the catch-up limit (CFR415C (b)(2)(ii)(B)), the rest as annual additions (excess deferrals
    not distributed, CFR415C (b)(2)(ii)(D)).
  - The IRS Tax Table (taxable income under $100,000, $50 steps) is not used: tax comes from the rate schedule on
    exact taxable income (convention), so it can differ from a Form 1040 by a few dollars.
  - Pub. 590-A (2025) contradicts itself twice (RULES.md section 11): Worksheet 1-2 Example 1 prints $6,825 where
    its own instruction and 219(g)(2)(C) give $6,830; the Roth example text says MAGI $150,000 / $6,530 while its
    illustrated worksheet shows $151,000 / $6,540. The key follows the statute.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import datetime as _dt
from decimal import Decimal as D
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CENT = F(1, 100)
DOLLAR = F(1)
TEN = F(10)
FILING_STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
COVERAGES = ('none', 'self', 'family')
PEOPLE = ('A', 'B')


# ---- exact arithmetic helpers ---------------------------------------------------------------------
def _F(x):
    """Exact Fraction from an int, str, Decimal or Fraction. Floats are refused (they are not exact)."""
    if isinstance(x, float):
        raise TypeError('pass money as str, int, Decimal or Fraction, never float')
    if isinstance(x, F):
        return x
    if isinstance(x, int):
        return F(x)
    return F(D(str(x)))


def round_half_up(x, quantum=CENT):
    """Round x to a multiple of quantum, halves away from zero (the key's display convention)."""
    x, q = _F(x), _F(quantum)
    n = abs(x) / q
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)  # floor(n + 1/2)
    return (k * q) if x >= 0 else -(k * q)


def floor_to(x, multiple):
    """Largest multiple of `multiple` not above x ("rounded to the next lowest $10", USC219 (g)(2)(C))."""
    x, m = _F(x), _F(multiple)
    return (x // m) * m


def ceil_to(x, multiple):
    """Smallest multiple of `multiple` not below x ("Round the result up to the nearest $10", P590A Worksheet 2-2 line 8)."""
    x, m = _F(x), _F(multiple)
    return -((-x) // m) * m


def show(x, quantum=CENT):
    """Decimal for display, rounded half up to the quantum (cents by default)."""
    if x is None:
        return None
    r = round_half_up(x, quantum)
    places = D('1') if _F(quantum) == DOLLAR else D('0.01')
    return (D(r.numerator) / D(r.denominator)).quantize(places)


def _date(x):
    if isinstance(x, _dt.date):
        return x
    return _dt.date.fromisoformat(str(x))


# =====================================================================================================
# 0. AGES
# =====================================================================================================
# USC414 (v)(5)(A) "who would attain age 50 by the end of the taxable year"; CFR414V (g)(3)(ii) "The employee's 50th or
# higher birthday would occur before the end of the employee's taxable year"; USC414 (v)(2)(B)(i) "attain age 60 but would
# not attain age 64 before the close of the taxable year"; USC219 (b)(5)(B)(i) "attained the age of 50 before the close of
# the taxable year"; USC223 (b)(3)(A) "attained age 55 before the close of the taxable year"; read 2026-10-31.
def age_at_year_end(birth_date, year):
    """Age reached by December 31 of `year`: year - birth year. A birthday on any day of the year counts, December 31
    included (convention; the sources speak of the birthday occurring before the end of the taxable year)."""
    return year - _date(birth_date).year


# =====================================================================================================
# 1. 401(k): 402(g) limit, 414(v) catch-up, 402A shared limit; contrast 415(c)
# =====================================================================================================
ELECTIVE_DEFERRAL = {2025: 23500, 2026: 24500}   # N2480 "402(g)(1) ... is increased from $23,000 to $23,500"; N2567 "is increased from $23,500 to $24,500"; read 2026-10-31
CATCH_UP_50 = {2025: 7500, 2026: 8000}            # N2480 "414(v)(2)(B)(i) ... remains $7,500"; N2567 "is increased from $7,500 to $8,000"; read 2026-10-31
CATCH_UP_60_63 = {2025: 11250, 2026: 11250}       # N2480 "414(v)(2)(E)(i) ... attain age 60, 61, 62, or 63 in 2025 is $11,250"; N2567 "... in 2026 remains $11,250"; CFR414V (c)(2)(i)(B) "$11,250"; read 2026-10-31
CATCH_UP_60_63_FLOOR = 10000                      # USC414 (v)(2)(E)(i)(I) "the greater of ... $10,000, or (II) ... 150 percent of the dollar amount ... for 2024"; read 2026-10-31
CATCH_UP_60_63_PCT = F(150, 100)                  # same clause; read 2026-10-31
CATCH_UP_50_IN_2024 = 7500                        # N2480 "remains $7,500" (so the 2024 amount was $7,500); read 2026-10-31
ANNUAL_ADDITIONS = {2025: 70000, 2026: 72000}     # N2480 "415(c)(1)(A) is increased in 2025 from $69,000 to $70,000"; N2567 "increased in 2026 from $70,000 to $72,000"; read 2026-10-31
ROTH_CATCH_UP_WAGE_THRESHOLD = {2025: 145000, 2026: 150000}  # prior-year FICA wages: N2480 "Roth catch-up wage threshold for 2024 ... for 2025 ... remains $145,000"; N2567 "threshold for 2025 ... for 2026 ... increased from $145,000 to $150,000"; read 2026-10-31
ROTH_CATCH_UP_ENFORCED_FROM = 2026                # N2362 s.IV "until taxable years beginning after December 31, 2025, (1) those catch-up contributions will be treated as satisfying the requirements of section 414(v)(7)(A)"; read 2026-10-31


def k401_catch_up(year, age):
    """414(v) catch-up dollar amount for the person's age at year end (USC414 (v)(2)(B)(i), (E)(i); N2480; N2567)."""
    if 60 <= age <= 63:
        return F(CATCH_UP_60_63[year])
    if age >= 50:
        return F(CATCH_UP_50[year])
    return F(0)


def k401(year, age, pretax, roth, match=0, pay=None):
    """Elective-deferral position of one person with one employer.

    limit      402(g)(1) applicable dollar amount (USC402 (g)(1)(B); N2480 / N2567)
    catch_up   414(v)(2) dollar amount, never above pay - deferrals within the limit (USC414 (v)(2)(A)(ii))
    used       pre-tax + Roth 401(k): USC402A (c)(2) the Roth designation cannot exceed the deferrals excludable
               "over ... the aggregate amount of elective deferrals ... which the employee does not designate", i.e.
               both draw on one 402(g) limit
    room/over  against limit + catch_up
    in_income  the excess deferral included in gross income this year: USC402 (g)(1)(A) "shall be included ... to the
               extent the amount of such deferrals ... exceeds the applicable dollar amount. The preceding sentence shall
               not apply to the portion of such excess as does not exceed the designated Roth contributions"; pre-tax
               catch-ups are not included (N2362 s.III.A); so in_income = max(0, over - roth)
    contrast   additions = deferrals - the part treated as catch-up + match (USC415 (c)(2); CFR415C (b)(2)(ii)(B)
               catch-ups are not annual additions; (D) only distributed excess deferrals are not), against
               limit_415c = min(415(c)(1)(A) dollar amount, 100% of compensation) (USC415 (c)(1)(B); (c)(3)(D)
               compensation includes elective deferrals and section 125 amounts, so it is the gross pay).
    """
    pretax, roth, match = _F(pretax), _F(roth), _F(match)
    limit = F(ELECTIVE_DEFERRAL[year])
    used = pretax + roth
    cu = k401_catch_up(year, age)
    if pay is not None:
        cu = min(cu, max(F(0), _F(pay) - min(used, limit)))
    cap = limit + cu
    over = max(F(0), used - cap)
    cu_used = min(cu, max(F(0), used - limit))
    additions = used - cu_used + match
    lim415 = F(ANNUAL_ADDITIONS[year]) if pay is None else min(F(ANNUAL_ADDITIONS[year]), _F(pay))
    over415 = max(F(0), additions - lim415)
    return {'limit': limit, 'catch_up': cu, 'used': used, 'room': max(F(0), cap - used), 'over': over,
            'in_income': max(F(0), over - roth), 'catch_up_used': cu_used,
            'annual_additions': additions, 'limit_415c': lim415, 'over_415c': over415,
            'exceeds_415c': 1 if over415 > 0 else 0,
            'active_participant': 1 if used + match > 0 else 0}


def roth_catch_up_required(year, prior_year_fica_wages_same_employer, age):
    """True when 414(v)(7)(A) forces this year's catch-up to be Roth (prior-year FICA wages from the plan sponsor over the
    threshold), enforced from 2026 (N2362). Needs last year's wages, which a household case does not carry."""
    if age < 50 or year < ROTH_CATCH_UP_ENFORCED_FROM:
        return False
    return _F(prior_year_fica_wages_same_employer) > ROTH_CATCH_UP_WAGE_THRESHOLD[year]


# =====================================================================================================
# 2. IRA limit (219(b)(5), 408A(c)(2))
# =====================================================================================================
IRA_LIMIT = {2025: 7000, 2026: 7500}      # N2480 "219(b)(5)(A) ... remains $7,000"; N2567 "is increased from $7,000 to $7,500"; P590A What's New for 2026 "$7,500 ($8,600 for individuals age 50 or older)"; read 2026-10-31
IRA_CATCH_UP = {2025: 1000, 2026: 1100}   # N2480 "219(b)(5)(B)(ii) ... remains $1,000"; N2567 "is increased from $1,000 to $1,100"; USC219 (b)(5)(C)(iii) indexed after 2023, next lower $100; read 2026-10-31
IRA_CATCH_UP_AGE = 50                     # USC219 (b)(5)(B)(i); read 2026-10-31


def ira_limit(year, age):
    """(limit, catch_up) for one person (USC219 (b)(5); N2480; N2567). Compensation is assumed to cover it."""
    return F(IRA_LIMIT[year]), F(IRA_CATCH_UP[year] if age >= IRA_CATCH_UP_AGE else 0)


def ira(year, age, trad, roth):
    """Traditional and Roth IRA money share one limit: USC408A (c)(2) the Roth limit is the 219 maximum "over ... the
    aggregate amount of contributions for such taxable year to all other individual retirement plans"."""
    lim, cu = ira_limit(year, age)
    used = _F(trad) + _F(roth)
    return {'limit': lim, 'catch_up': cu, 'used': used, 'room': max(F(0), lim + cu - used),
            'over': max(F(0), used - lim - cu)}


def ira_compensation(own_box1, spouse_box1=None, spouse_ira_contributions=0, joint=False):
    """Compensation that supports one person's IRA: own wages included in gross income (USC219 (b)(1)(B), (f)(1)); on a
    joint return, when it is below the spouse's, plus the spouse's compensation reduced by the spouse's IRA deduction,
    nondeductible and Roth contributions (USC219 (c)(1)(B), (c)(2)). Recorded only: the key assumes it covers the limit."""
    own = _F(own_box1)
    if joint and spouse_box1 is not None and own < _F(spouse_box1):
        return own + max(F(0), _F(spouse_box1) - _F(spouse_ira_contributions))
    return own


# =====================================================================================================
# 3. Roth IRA income limit (408A(c)(3)) and the traditional IRA deduction contrast (219(g))
# =====================================================================================================
# (start, end) of each phase-out. Width = end - start: USC408A (c)(3)(A)(ii) "$15,000 ($10,000 in the case of a joint return
# or a married individual filing a separate return)"; USC219 (g)(2)(A)(ii) "$10,000 ($20,000 in the case of a joint return)",
# (g)(7)(B) "$10,000" for the spouse of a participant; read 2026-10-31.
ROTH_PHASEOUT = {
    2025: {'joint': (236000, 246000), 'single': (150000, 165000), 'separate': (0, 10000)},  # N2480 "between $236,000 and $246,000 for married couples filing jointly ... singles and heads of household ... between $150,000 and $165,000 ... married individual filing a separate return ... between $0 and $10,000"; P590A Table 2-1; read 2026-10-31
    2026: {'joint': (242000, 252000), 'single': (153000, 168000), 'separate': (0, 10000)},  # N2567 "between $242,000 and $252,000 ... between $153,000 and $168,000 ... between $0 and $10,000"; read 2026-10-31
}
TRAD_PHASEOUT = {
    2025: {'single': (79000, 89000), 'joint': (126000, 146000), 'spouse': (236000, 246000), 'separate': (0, 10000)},  # N2480 "between $79,000 and $89,000 ... between $126,000 and $146,000 ... between $236,000 and $246,000 ... remains $0 to $10,000"; P590A Tables 1-2, 1-3; read 2026-10-31
    2026: {'single': (81000, 91000), 'joint': (129000, 149000), 'spouse': (242000, 252000), 'separate': (0, 10000)},  # N2567 "between $81,000 and $91,000 ... between $129,000 and $149,000 ... between $242,000 and $252,000 ... remains $0 to $10,000"; P590A What's New for 2026; read 2026-10-31
}
PHASEOUT_FLOOR = 200      # USC219 (g)(2)(B) "No dollar limitation shall be reduced below $200 under paragraph (1) unless (without regard to this subparagraph) such limitation is reduced to zero"; applied to Roth by USC408A (c)(3)(A) last sentence; read 2026-10-31
PHASEOUT_ROUNDING = 10    # USC219 (g)(2)(C) "Any amount determined under this paragraph which is not a multiple of $10 shall be rounded to the next lowest $10"; read 2026-10-31
WORKSHEET_RATIO_PLACES = F(1, 1000)  # P590A Worksheet 2-2 line 5 "enter the result as a decimal (rounded to at least three places)"; read 2026-10-31


def roth_range(year, filing_status, lived_apart=False):
    """Roth phase-out range for the return (USC408A (c)(3)(B)(ii), (c)(3)(C) "Section 219(g)(4) shall apply"; USC219 (g)(4):
    spouses who file separately and "live apart at all times during such taxable year, shall not be treated as married")."""
    t = ROTH_PHASEOUT[year]
    if filing_status == 'married_joint':
        return t['joint']
    if filing_status == 'married_separate' and not lived_apart:
        return t['separate']
    return t['single']  # single, head of household, married filing separately and apart all year


def phase_out(full, magi, start, end, method='law'):
    """The reduced IRA dollar limit inside a phase-out range.

    'law' (the key): reduction = full x (MAGI - start) / (end - start), rounded down to $10 (USC219 (g)(2)(C)); the
          limit = full - reduction, raised to $200 when it is above 0 but below $200 (USC219 (g)(2)(B)); 0 at or above
          the end, full at or below the start.
    'worksheet': P590A Worksheet 2-2: line 5 ratio rounded to three places (half up, the key's reading of "rounded"),
          1.000 at most; line 8 = full - ratio x full, "Round the result up to the nearest $10. If the result is less
          than $200, enter $200". Pub. 590-A allows "at least three places", so 'law' is also a valid worksheet result.
    """
    full, magi = _F(full), _F(magi)
    if magi <= start:
        return full
    if magi >= end:
        return F(0)
    if method == 'law':
        out = full - floor_to(full * (magi - start) / (end - start), PHASEOUT_ROUNDING)
    elif method == 'worksheet':
        ratio = min(F(1), round_half_up((magi - start) / F(end - start), WORKSHEET_RATIO_PLACES))
        out = ceil_to(full - ratio * full, PHASEOUT_ROUNDING)
    else:
        raise ValueError(method)
    return max(F(PHASEOUT_FLOOR), out) if out > 0 else F(0)


def roth_status(magi, start, end):
    """P590A Table 2-1's bands, read literally: 'ok' below the start ("less than $236,000"; on the separate-and-together
    range "zero (-0-)"), 'partial' from the start ("at least $236,000 but less than $246,000"; "more than zero (-0-) but
    less than $10,000"), 'over' at or above the end ("$246,000 or more"). At exactly a start above 0 nothing is reduced
    yet (the "excess" of USC408A (c)(3)(A)(i) is zero), so the allowed amount is the full limit either way; only the
    label follows the table. RULES.md section 4.4. (Changed 2026-10-31 from 'ok' at or below every start.)"""
    magi = _F(magi)
    if magi < start or (start == 0 and magi <= 0):
        return 'ok'
    if magi >= end:
        return 'over'
    return 'partial'


def roth_ira(year, filing_status, lived_apart, magi, age, trad, roth, method='law'):
    """Roth IRA position of one person: USC408A (c)(3)(A) the reduced limit applies to the (c)(2)(A) amount (the 219 limit
    with catch-up); USC408A (c)(2) the Roth limit is that amount minus traditional contributions; allowed is the smaller."""
    lim, cu = ira_limit(year, age)
    full = lim + cu
    start, end = roth_range(year, filing_status, lived_apart)
    reduced = phase_out(full, magi, start, end, method)
    allowed = max(F(0), min(reduced, full - _F(trad)))
    return {'magi': _F(magi), 'range': (start, end), 'status': roth_status(magi, start, end),
            'reduced_limit': reduced, 'allowed': allowed, 'over': max(F(0), _F(roth) - allowed)}


def trad_range(year, filing_status, lived_apart, self_active, spouse_active):
    """Which 219(g) phase-out applies to one person, or None for a full deduction.

    USC219 (g)(1): the limit is reduced if "an individual or the individual's spouse is an active participant";
    (g)(3)(B) applicable dollar amounts by return; (g)(4) separate returns living apart all year: not married;
    (g)(7) a non-participant whose spouse participates: $150,000 (indexed: N2480 / N2567 $236,000 / $242,000) and $10,000
    width, joint returns only; a separate return stays at zero (P590A Table 1-3, Worksheet 1-2 table)."""
    t = TRAD_PHASEOUT[year]
    married = filing_status == 'married_joint' or (filing_status == 'married_separate' and not lived_apart)
    if self_active:
        if filing_status == 'married_joint':
            return t['joint']
        if filing_status == 'married_separate' and not lived_apart:
            return t['separate']
        return t['single']
    if married and spouse_active:
        return t['spouse'] if filing_status == 'married_joint' else t['separate']
    return None


def trad_ira_deduction(year, filing_status, lived_apart, magi, age, trad, self_active, spouse_active):
    """The real deductible traditional IRA amount (the contrast to the page's 'fully deductible'): min(contribution,
    reduced 219(b)(1) limit). MAGI is USC219 (g)(3)(A) AGI without the IRA deduction itself."""
    lim, cu = ira_limit(year, age)
    full = lim + cu
    rng = trad_range(year, filing_status, lived_apart, self_active, spouse_active)
    limit = full if rng is None else phase_out(full, magi, rng[0], rng[1])
    return {'range': rng, 'deduction_limit': limit, 'deductible': min(_F(trad), limit)}


def trad_ira_page_deduction(year, age, trad):
    """The page's assumption (every traditional dollar deductible), kept inside the 219(b)(1) dollar limit, which applies
    whether or not anyone is in a workplace plan (USC219 (b)(1)(A), (b)(5))."""
    lim, cu = ira_limit(year, age)
    return min(_F(trad), lim + cu)


# =====================================================================================================
# 4. HSA (223(b))
# =====================================================================================================
HSA_LIMIT = {  # (self-only, family)
    2025: (4300, 8550),   # RP2425 s.2.01(1) "self-only coverage ... is $4,300 ... family coverage ... is $8,550"; P969 (2025) the same; read 2026-10-31
    2026: (4400, 8750),   # RP2519 s.2.01(1) "$4,400 ... $8,750"; P15B (2026) "$4,400 for self-only coverage ... or $8,750 for family coverage"; read 2026-10-31
    2027: (4500, 9000),   # RP2624 s.3.01(1) "For calendar year 2027 ... self-only coverage ... is $4,500 ... family coverage ... is $9,000"; read 2026-10-31
}
HSA_CATCH_UP = 1000       # USC223 (b)(3)(B) table "2009 and thereafter $1,000" (not indexed: (g)(1) indexes only (b)(2), (c)(2)(A), (c)(1)(E)); P969 "increased by $1,000"; read 2026-10-31
HSA_CATCH_UP_AGE = 55     # USC223 (b)(3)(A) "attained age 55 before the close of the taxable year"; read 2026-10-31
MEDICARE_AGE = 65         # note only: USC223 (b)(7) limit zero from the first month of Medicare entitlement; rows carry no one 65+; read 2026-10-31


def hsa_eligible(coverage, person):
    """Who is HSA-eligible under the case's own definition: 'self' = only A (self-only HDHP); 'family' = everyone; 'none' =
    nobody. A general-purpose FSA would end eligibility under USC223 (c)(1)(A)(ii); the key reports that as fsa_with_hsa."""
    if coverage == 'family':
        return True
    if coverage == 'self':
        return person == 'A'
    if coverage == 'none':
        return False
    raise ValueError(coverage)


def hsa_positions(year, coverage, ages, uses, married):
    """Per-person and household HSA position.

    ages, uses: {person: value} for the adults present; a use = own payroll money + employer deposits (USC223 (b)(4)(B)
    employer money excludable under 106(d) reduces the limit; P969 "This includes amounts contributed to your account by
    your employer through a cafeteria plan").

    Per person: the most that person could have in the year given the other spouse's actual money. With family cover and
    two married eligible spouses (USC223 (b)(5): one family limit "divided equally between them unless they agree on a
    different division", catch-ups outside the division; P969 "Each spouse must make the additional contribution to their
    own HSA"):  limit_p = catch_up_p + max(0, family - max(0, use_q - catch_up_q)).
    That is the brief's min(family + cu_p - use_p, family + cu_p + cu_q - use_p - use_q) + use_p, clamped so that the
    other spouse's own excess never eats into this person's catch-up (they agree whenever use_q <= family + cu_q).
    Otherwise: limit_p = (self-only or family amount) + catch_up_p when eligible, else 0.
    Household: limit = coverage amount + catch-ups of the eligible people 55 and over; total = sum of uses.

    The per-person 'over' answers "how much of this person's money is over, if the other's money stays as it is"; with
    shared family cover both spouses can show the same dollars over, so the two are not additive. What is really over
    (the money excluded from neither income nor payroll tax, USC106 (d)(1)) needs one division of the family limit.
    Convention: the spouses agree on the division that leaves the least money over (USC223 (b)(5)(B)(ii) "unless they
    agree on a different division") and, among those, the one closest to equal halves (the statute's default). Each
    spouse's need for the shared limit is x_p = max(0, use_p - catch_up_p); A's share is f/2 clamped to
    [max(0, f - x_B), min(x_A, f)] when that interval is not empty (otherwise nothing is over); 'excess' is
    max(0, x_p - share_p), and hh['excess'] = max(0, x_A + x_B - f), the least money the couple must take out. Without
    shared cover, 'excess' is the per-person 'over'.
    """
    self_lim, fam_lim = HSA_LIMIT[year]
    base = F(fam_lim) if coverage == 'family' else F(self_lim) if coverage == 'self' else F(0)
    elig = {p: hsa_eligible(coverage, p) for p in ages}
    cu = {p: F(HSA_CATCH_UP) if elig[p] and ages[p] >= HSA_CATCH_UP_AGE else F(0) for p in ages}
    uses = {p: _F(uses[p]) for p in ages}
    shared = coverage == 'family' and married and len(ages) == 2 and all(elig.values())
    per = {}
    for p in ages:
        if not elig[p]:
            lim = F(0)
        elif shared:
            q = 'B' if p == 'A' else 'A'
            lim = cu[p] + max(F(0), base - max(F(0), uses[q] - cu[q]))
        else:
            lim = base + cu[p]
        per[p] = {'eligible': 1 if elig[p] else 0, 'catch_up': cu[p], 'limit': lim, 'used': uses[p],
                  'room': max(F(0), lim - uses[p]), 'over': max(F(0), uses[p] - lim)}
        per[p]['excess'] = per[p]['over']
    if shared:
        need = {p: max(F(0), uses[p] - cu[p]) for p in ages}
        lo, hi = max(F(0), base - need['B']), min(need['A'], base)
        if lo <= hi:
            share_a = min(max(base / 2, lo), hi)
            per['A']['excess'] = max(F(0), need['A'] - share_a)
            per['B']['excess'] = max(F(0), need['B'] - (base - share_a))
        else:
            per['A']['excess'] = per['B']['excess'] = F(0)
    hh_limit = (base + sum(cu.values(), F(0))) if any(elig.values()) else F(0)
    total = sum(uses.values(), F(0))
    hh = {'limit': hh_limit, 'total': total, 'room': max(F(0), hh_limit - total), 'over': max(F(0), total - hh_limit),
          'excess': sum((per[p]['excess'] for p in ages), F(0))}
    return per, hh


# =====================================================================================================
# 5. Income tax and payroll tax (for the HSA saving)
# =====================================================================================================
# Each table: ((upper bound of the bracket, rate), ..., (None, top rate)); "The Tax Is" base amounts are rebuilt in
# check_tables() and must equal the printed ones (BRACKET_BASES).
BRACKETS = {
    2025: {  # RP2440 s.2.01 Tables 1-4 (unchanged for 2025 by Pub. L. 119-21: RP2532 s.3 modifies only s.2.15(1) and s.2.25); read 2026-10-31
        'married_joint':     ((23850, '0.10'), (96950, '0.12'), (206700, '0.22'), (394600, '0.24'), (501050, '0.32'), (751600, '0.35'), (None, '0.37')),  # RP2440 Table 1; read 2026-10-31
        'head_of_household': ((17000, '0.10'), (64850, '0.12'), (103350, '0.22'), (197300, '0.24'), (250500, '0.32'), (626350, '0.35'), (None, '0.37')),  # RP2440 Table 2; read 2026-10-31
        'single':            ((11925, '0.10'), (48475, '0.12'), (103350, '0.22'), (197300, '0.24'), (250525, '0.32'), (626350, '0.35'), (None, '0.37')),  # RP2440 Table 3; read 2026-10-31
        'married_separate':  ((11925, '0.10'), (48475, '0.12'), (103350, '0.22'), (197300, '0.24'), (250525, '0.32'), (375800, '0.35'), (None, '0.37')),  # RP2440 Table 4; read 2026-10-31
    },
    2026: {  # RP2532 s.4.01 Tables 1-4; read 2026-10-31
        'married_joint':     ((24800, '0.10'), (100800, '0.12'), (211400, '0.22'), (403550, '0.24'), (512450, '0.32'), (768700, '0.35'), (None, '0.37')),  # RP2532 Table 1; read 2026-10-31
        'head_of_household': ((17700, '0.10'), (67450, '0.12'), (105700, '0.22'), (201750, '0.24'), (256200, '0.32'), (640600, '0.35'), (None, '0.37')),  # RP2532 Table 2; read 2026-10-31
        'single':            ((12400, '0.10'), (50400, '0.12'), (105700, '0.22'), (201775, '0.24'), (256225, '0.32'), (640600, '0.35'), (None, '0.37')),  # RP2532 Table 3; read 2026-10-31
        'married_separate':  ((12400, '0.10'), (50400, '0.12'), (105700, '0.22'), (201775, '0.24'), (256225, '0.32'), (384350, '0.35'), (None, '0.37')),  # RP2532 Table 4; read 2026-10-31
    },
}
BRACKET_BASES = {  # the printed "$X plus N% of the excess over" amounts, brackets 2..7
    2025: {'married_joint': ('2385', '11157', '35302', '80398', '114462', '202154.50'),        # RP2440 Table 1; read 2026-10-31
           'head_of_household': ('1700', '7442', '15912', '38460', '55484', '187031.50'),     # RP2440 Table 2; read 2026-10-31
           'single': ('1192.50', '5578.50', '17651', '40199', '57231', '188769.75'),          # RP2440 Table 3; read 2026-10-31
           'married_separate': ('1192.50', '5578.50', '17651', '40199', '57231', '101077.25')},  # RP2440 Table 4; read 2026-10-31
    2026: {'married_joint': ('2480', '11600', '35932', '82048', '116896', '206583.50'),        # RP2532 Table 1; read 2026-10-31
           'head_of_household': ('1770', '7740', '16155', '39207', '56631', '191171'),        # RP2532 Table 2; read 2026-10-31
           'single': ('1240', '5800', '17966', '41024', '58448', '192979.25'),                # RP2532 Table 3; read 2026-10-31
           'married_separate': ('1240', '5800', '17966', '41024', '58448', '103291.75')},     # RP2532 Table 4; read 2026-10-31
}
STANDARD_DEDUCTION = {
    2025: {'married_joint': 31500, 'head_of_household': 23625, 'single': 15750, 'married_separate': 15750},  # RP2532 s.3.01 (63(c)(7) as amended by Pub. L. 119-21; "section 2.15(1) of Rev. Proc. 2024-40 is removed"); USC63 (c)(7)(A); PL11921 s.70102(b), (c); read 2026-10-31
    2026: {'married_joint': 32200, 'head_of_household': 24150, 'single': 16100, 'married_separate': 16100},  # RP2532 s.4.14(1); read 2026-10-31
}
STANDARD_DEDUCTION_2025_REMOVED = {'married_joint': 30000, 'head_of_household': 22500, 'single': 15000, 'married_separate': 15000}  # RP2440 s.2.15(1), removed by RP2532 s.3.01 (kept only so the checks can show the change); read 2026-10-31

SS_RATE = F(62, 1000)           # USC3101 (a) "6.2 percent of the wages"; CFR3101 (a) "1990 and subsequent years 6.2"; read 2026-10-31
MEDICARE_RATE = F(145, 10000)   # USC3101 (b)(1) "1.45 percent of the wages"; CFR3101 (b)(1); read 2026-10-31
ADDL_MEDICARE_RATE = F(9, 1000)  # USC3101 (b)(2) "0.9 percent of wages ... in excess of"; USC1401 (b)(2)(A) the same on self-employment income; read 2026-10-31
ADDL_MEDICARE_THRESHOLD = {'married_joint': 250000, 'married_separate': 125000, 'single': 200000, 'head_of_household': 200000}  # USC3101 (b)(2)(A)-(C) "$250,000 ... ½ of the dollar amount determined under subparagraph (A) ... $200,000"; CFR3101 (b)(2)(ii); I8959 "aren't indexed for inflation"; read 2026-10-31
FLAT_FICA_RATE = SS_RATE + MEDICARE_RATE  # 7.65%: the page's documented simplification (contrast only)
SS_WAGE_BASE = {
    2025: 176100,   # SSA25 89 FR 85276 "The OASDI contribution and benefit base is $176,100 for remuneration paid in 2025"; IRSCOLA "Taxable wage base ... 176,100"; read 2026-10-31
    2026: 184500,   # SSA26 90 FR 49047 "... is $184,500 for remuneration paid in 2026"; IRSCOLA "Taxable wage base 184,500"; read 2026-10-31
    2027: 192300,   # SSA27 91 FR 67380 "... is $192,300 for remuneration paid in 2027" (SSA, not IRS; unused: 2027 rows carry no tax figure); read 2026-10-31
}


def bracket_tax(year, filing_status, taxable):
    """Regular income tax from the rate schedule on exact taxable income (no Tax Table, no rounding; convention)."""
    taxable = max(F(0), _F(taxable))
    tax, lower = F(0), F(0)
    for upper, rate in BRACKETS[year][filing_status]:
        top = taxable if upper is None else min(taxable, F(upper))
        if top > lower:
            tax += (top - lower) * _F(rate)
        if upper is None or taxable <= upper:
            break
        lower = F(upper)
    return tax


def income_tax(year, filing_status, agi):
    """Tax with the standard deduction and nothing else (no dependents, no credits, no one 65 or older)."""
    return bracket_tax(year, filing_status, max(F(0), _F(agi) - STANDARD_DEDUCTION[year][filing_status]))


def employee_fica(year, fica_wages):
    """(social security 6.2% up to the wage base, Medicare 1.45% on all) for one person's wages from one employer
    (USC3101 (a), (b)(1); USC3121 (a)(1) wages above the contribution and benefit base are not wages for 3101(a))."""
    w = max(F(0), _F(fica_wages))
    return SS_RATE * min(w, F(SS_WAGE_BASE[year])), MEDICARE_RATE * w


def additional_medicare(filing_status, medicare_wages_on_return):
    """0.9% of the return's Medicare wages above the threshold (USC3101 (b)(2)); a joint return adds both spouses' wages
    (I8959 (2025) Example 5: "their combined $325,000 in wages exceeds the $250,000 threshold"). Liability, not the
    employer's withholding (USC3102 (f)(1) withholds only above $200,000 per employer)."""
    total = sum((_F(w) for w in medicare_wages_on_return), F(0))
    return ADDL_MEDICARE_RATE * max(F(0), total - ADDL_MEDICARE_THRESHOLD[filing_status])


# =====================================================================================================
# 6. Health FSA (125(i))
# =====================================================================================================
FSA_LIMIT = {2025: 3300, 2026: 3400}       # RP2440 s.2.16 "the dollar limitation under § 125(i) ... is $3,300"; RP2532 s.4.15 "is $3,400"; read 2026-10-31
FSA_CARRYOVER = {2025: 660, 2026: 680}     # RP2440 s.2.16 "If the cafeteria plan permits the carryover of unused amounts, the maximum carryover amount is $660"; RP2532 s.4.15 "$680"; read 2026-10-31
FSA_CARRYOVER_SHARE = F(20, 100)           # N2033 s.III.A "an amount equal to 20 percent of the maximum salary reduction contribution under § 125(i) for that plan year"; N1371 the original $500; read 2026-10-31


def fsa(year, election, spent, hsa_funded):
    """Health FSA through A's employer.

    fsa_over      election - limit when positive (USC125 (i)(1): no qualified benefit unless the plan bars elections over it)
    fsa_unspent   election - spent when positive
    fsa_carryover the plan year's carryover maximum, if the plan has a carryover (N1371; N2033; RP2440 / RP2532)
    fsa_forfeit   unspent above that maximum, if the plan has a carryover and no grace period (N1371: not both)
    fsa_with_hsa  1 when a general-purpose FSA and an HSA are both funded (USC223 (c)(1)(A)(ii); P969 "An employee covered
                  by an HDHP and a health FSA ... can't generally make contributions to an HSA"; P15B)
    excluded      the salary reduction kept out of wages: the election up to the limit (convention; P969 "You don't pay
                  federal income tax or employment taxes on the salary you contribute ... to the FSA")
    """
    election, spent = _F(election), _F(spent)
    lim, co = F(FSA_LIMIT[year]), F(FSA_CARRYOVER[year])
    unspent = max(F(0), election - spent)
    return {'fsa_limit': lim, 'fsa_carryover': co, 'fsa_over': max(F(0), election - lim), 'fsa_unspent': unspent,
            'fsa_forfeit': max(F(0), unspent - co), 'fsa_with_hsa': 1 if election > 0 and hsa_funded else 0,
            'excluded': min(election, lim)}


# =====================================================================================================
# 7. Deadlines (219(f)(3), 223(d)(4)(B), 408A(c)(6), 6072(a), 7503)
# =====================================================================================================
RETURN_DUE_MONTH_DAY = (4, 15)  # USC6072 (a) "returns made on the basis of the calendar year shall be filed on or before the 15th day of April following the close of the calendar year"; read 2026-10-31
# USC219 (f)(3) contribution deemed made on the last day of the year "if ... made not later than the time prescribed by law for
# filing the return for such taxable year (not including extensions thereof)"; USC223 (d)(4)(B) "Section 219(f)(3) (relating to
# time when contributions deemed made)"; USC408A (c)(6) "the rule of section 219(f)(3) shall apply"; USC7503 "the next succeeding
# day which is not a Saturday, Sunday, or a legal holiday ... the term 'legal holiday' means a legal holiday in the District of
# Columbia"; CFR7503 (b) "as found in D.C. Code Ann. 28-2701"; DC2701 the list and "When a day set apart as a legal holiday,
# other than the day of the inauguration of the President, falls on a Saturday, the next preceding day is a holiday. When a
# day set apart as a legal holiday falls on a Sunday, the next succeeding day is a holiday."; read 2026-10-31.


def _nth_weekday(year, month, weekday, n):
    d = _dt.date(year, month, 1)
    d += _dt.timedelta(days=(weekday - d.weekday()) % 7)
    return d + _dt.timedelta(weeks=n - 1)


def _last_weekday(year, month, weekday):
    d = _dt.date(year + (month == 12), month % 12 + 1, 1) - _dt.timedelta(days=1)
    return d - _dt.timedelta(days=(d.weekday() - weekday) % 7)


def dc_legal_holidays(year):
    """Legal holidays in the District of Columbia falling in `year`, observed dates included (DC2701). Days appointed ad hoc
    by the President are not known in advance and are not included."""
    days = set()
    for y in (year - 1, year, year + 1):
        fixed = [_dt.date(y, 1, 1), _dt.date(y, 4, 16), _dt.date(y, 6, 19), _dt.date(y, 7, 4), _dt.date(y, 11, 11),
                 _dt.date(y, 12, 25)]   # New Year's Day; DC Emancipation Day; Juneteenth; Independence Day; Veterans Day; Christmas (DC2701)
        moving = [_nth_weekday(y, 1, 0, 3), _nth_weekday(y, 2, 0, 3), _last_weekday(y, 5, 0), _nth_weekday(y, 9, 0, 1),
                  _nth_weekday(y, 10, 0, 2), _nth_weekday(y, 11, 3, 4)]  # MLK; Washington's Birthday; Memorial; Labor; Indigenous Peoples'; Thanksgiving (DC2701)
        for d in fixed:
            days.add(d)
            if d.weekday() == 5:
                days.add(d - _dt.timedelta(days=1))
            elif d.weekday() == 6:
                days.add(d + _dt.timedelta(days=1))
        days.update(moving)
        if y % 4 == 1:  # inauguration day, January 20 after a presidential election year (DC2701); no Saturday shift
            inaug = _dt.date(y, 1, 20)
            days.add(inaug if inaug.weekday() != 6 else inaug + _dt.timedelta(days=1))
    return {d for d in days if d.year == year}


def ira_hsa_deadline(tax_year):
    """Last day to make IRA (traditional or Roth) and HSA contributions for `tax_year`: April 15 of the next year, moved to
    the next day that is not a Saturday, Sunday or D.C. legal holiday. 401(k) deferrals must come out of pay in the year.
    Disaster postponements (7508A) and statewide holidays for filings at offices outside D.C. (7503 last clause) are not
    modelled."""
    d = _dt.date(tax_year + 1, *RETURN_DUE_MONTH_DAY)
    while d.weekday() >= 5 or d in dc_legal_holidays(d.year):
        d += _dt.timedelta(days=1)
    return d


# =====================================================================================================
# 8. 529 gifts (2503(b), 529(c)(2)(B))
# =====================================================================================================
GIFT_EXCLUSION = {2025: 19000, 2026: 19000}  # RP2440 s.2.43(1) "For calendar year 2025, the first $19,000 of gifts to any person"; RP2532 s.4.42(1) "For calendar year 2026, the first $19,000"; RP2625 s.2.02 the same; read 2026-10-31
QTP_YEARS = 5                                # USC529 (c)(2)(B) "ratably over the 5-year period beginning with such calendar year"; read 2026-10-31
QTP_MULTIPLE = 5                             # I709 (2025) Line B "treat up to $95,000 of the contribution for that person as if you had made it ratably over a 5-year period ... You can only apply the election to a maximum of $95,000" (= 5 x $19,000); read 2026-10-31


def gift_529(year):
    """(annual exclusion, five-year election amount) per giver per beneficiary."""
    ex = F(GIFT_EXCLUSION[year])
    return ex, QTP_MULTIPLE * ex


def qtp_election(contribution, year):
    """One giver's 529 contribution for one beneficiary with the five-year election: up to 5 x exclusion spread over 5
    years, the rest counted in the first year (I709 Line B and its Pat example)."""
    ex, cap = gift_529(year)
    c = _F(contribution)
    elected = min(c, cap)
    per_year = elected / QTP_YEARS
    first_year = (c - elected) + per_year
    return {'elected': elected, 'per_year': per_year, 'first_year_counted': first_year,
            'first_year_taxable': max(F(0), first_year - ex)}


# =====================================================================================================
# 9. One household case, every output
# =====================================================================================================
MONEY_FIELDS = ('pay', 'k401', 'roth401k', 'k401_match', 'trad_ira', 'roth_ira', 'hsa_payroll', 'hsa_employer')


def _returns(filing_status):
    if filing_status == 'married_joint':
        return [('married_joint', ('A', 'B'))]
    if filing_status == 'married_separate':
        return [('married_separate', ('A',)), ('married_separate', ('B',))]
    return [(filing_status, ('A',))]


def work_household(case):
    """Every output of the two pages for one household case (see RULES.md section 1 for the fields).

    case = {'year', 'today', 'filing_status', 'lived_apart', 'coverage', 'other_income', 'fsa_election', 'fsa_spent',
            'adults': {'A': {'birth_date', 'pay', 'k401', 'roth401k', 'k401_match', 'trad_ira', 'roth_ira', 'hsa_payroll',
                             'hsa_employer'}, 'B': {...}}}
    Married statuses need A and B; single and head of household need A only. Outputs that need a figure the IRS had not
    published for the year (2027 retirement, FSA, gift, brackets) are None; so are the tax outputs when anyone is 65+.
    """
    year, fs = case['year'], case['filing_status']
    if fs not in FILING_STATUSES or case['coverage'] not in COVERAGES:
        raise ValueError((fs, case['coverage']))
    married = fs in ('married_joint', 'married_separate')
    adults = case['adults']
    if set(adults) != ({'A', 'B'} if married else {'A'}):
        raise ValueError('married statuses need adults A and B; single and head of household need A only')
    apart = bool(int(case.get('lived_apart', 0))) and fs == 'married_separate'
    if case.get('today') is not None and _date(case['today']).year != year:
        raise ValueError('today must be inside the year')
    ppl = [p for p in PEOPLE if p in adults]
    m = {p: {k: _F(adults[p].get(k, 0)) for k in MONEY_FIELDS} for p in ppl}
    age = {p: age_at_year_end(adults[p]['birth_date'], year) for p in ppl}
    other = _F(case.get('other_income', 0))
    election, spent = _F(case.get('fsa_election', 0)), _F(case.get('fsa_spent', 0))
    out = {'year': year, 'ira_hsa_deadline': ira_hsa_deadline(year)}
    for p in ppl:
        out[p + '_age'] = age[p]

    # HSA (published for 2025-2027)
    uses = {p: m[p]['hsa_payroll'] + m[p]['hsa_employer'] for p in ppl}
    per, hh = hsa_positions(year, case['coverage'], age, uses, married)
    for p in ppl:
        for k in ('eligible', 'limit', 'used', 'room', 'over'):
            out['%s_hsa_%s' % (p, k)] = per[p][k]
    out.update(hsa_limit_household=hh['limit'], hsa_total=hh['total'], hsa_room_household=hh['room'],
               hsa_over_household=hh['over'], hsa_excess_to_remove=hh['excess'])   # the last one is an extra (see hsa_positions)

    published = year in ELECTIVE_DEFERRAL and year in FSA_LIMIT and year in BRACKETS and year in GIFT_EXCLUSION
    if not published:
        return out

    # 401(k)
    k = {p: k401(year, age[p], m[p]['k401'], m[p]['roth401k'], m[p]['k401_match'], m[p]['pay']) for p in ppl}
    for p in ppl:
        for key in ('limit', 'catch_up', 'used', 'room', 'over', 'in_income'):
            out['%s_k401_%s' % (p, key)] = k[p][key]
        for key in ('annual_additions', 'limit_415c', 'over_415c', 'exceeds_415c', 'active_participant'):
            out['%s_%s' % (p, key)] = k[p][key]

    # FSA (A's employer)
    f = fsa(year, election, spent, hh['total'] > 0)
    out.update({key: f[key] for key in ('fsa_limit', 'fsa_carryover', 'fsa_over', 'fsa_unspent', 'fsa_forfeit', 'fsa_with_hsa')})
    fsa_excl = {p: (f['excluded'] if p == 'A' else F(0)) for p in ppl}

    # 529
    out['gift_exclusion'], out['qtp_five_year_max'] = gift_529(year)

    def wages(hsa_over, with_payroll_hsa):
        """(box 1 wages, FICA wages) per person. Box 1 = pay - pre-tax 401(k) + excess deferral in income - FSA
        excluded - HSA payroll money + the person's HSA excess (hsa_positions 'excess') (USC402 (g)(1)(A); USC106 (d)(1) "to the
        extent such amounts do not exceed the limitation under section 223(b)"; P969 "Excess contributions made by your
        employer are included in your gross income"). FICA wages = the same without the 401(k) lines (USC3121 (v)(1)(A))
        and with the HSA excess (P15B "Up to specified dollar limits ... exempt from ... social security tax, Medicare tax")."""
        box1, fw = {}, {}
        for p in ppl:
            hp = m[p]['hsa_payroll'] if with_payroll_hsa else F(0)
            fw[p] = m[p]['pay'] - fsa_excl[p] - hp + hsa_over[p]
            box1[p] = fw[p] - m[p]['k401'] + k[p]['in_income']
        return box1, fw

    over_with = {p: per[p]['excess'] for p in ppl}
    per0, _ = hsa_positions(year, case['coverage'], age, {p: m[p]['hsa_employer'] for p in ppl}, married)
    over_without = {p: per0[p]['excess'] for p in ppl}
    box1, fw = wages(over_with, True)
    box1_0, fw_0 = wages(over_without, False)
    share = {p: (other / 2 if fs == 'married_separate' else (other if p == 'A' else F(0))) for p in ppl}
    page_ded = {p: trad_ira_page_deduction(year, age[p], m[p]['trad_ira']) for p in ppl}

    magi, agi, agi_real, tax_with, tax_without, addl_with, addl_without = {}, {}, {}, F(0), F(0), F(0), F(0)
    returns = _returns(fs)
    for status, members in returns:
        mg = sum((box1[p] + share[p] for p in members), F(0)) if status != 'married_joint' else sum((box1[p] for p in members), F(0)) + other
        mg0 = sum((box1_0[p] + share[p] for p in members), F(0)) if status != 'married_joint' else sum((box1_0[p] for p in members), F(0)) + other
        ded = sum((page_ded[p] for p in members), F(0))
        for p in members:
            magi[p] = mg
            agi[p] = mg - ded
        tax_with += income_tax(year, status, mg - ded)
        tax_without += income_tax(year, status, mg0 - ded)
        addl_with += additional_medicare(status, [fw[p] for p in members])
        addl_without += additional_medicare(status, [fw_0[p] for p in members])

    # IRA, Roth, traditional deduction contrast
    for p in ppl:
        q = 'B' if p == 'A' else 'A'
        r = ira(year, age[p], m[p]['trad_ira'], m[p]['roth_ira'])
        for key in ('limit', 'catch_up', 'used', 'room', 'over'):
            out['%s_ira_%s' % (p, key)] = r[key]
        comp = ira_compensation(box1[p], box1[q] if married else None,
                                (m[q]['trad_ira'] + m[q]['roth_ira']) if married else 0, fs == 'married_joint')
        out[p + '_ira_compensation'] = comp
        out[p + '_ira_comp_ok'] = 1 if comp >= r['limit'] + r['catch_up'] else 0
        ro = roth_ira(year, fs, apart, magi[p], age[p], m[p]['trad_ira'], m[p]['roth_ira'])
        out[p + '_magi'] = ro['magi']
        out[p + '_roth_status'] = ro['status']
        out[p + '_roth_reduced_limit'] = ro['reduced_limit']
        out[p + '_roth_allowed'] = ro['allowed']
        out[p + '_roth_over'] = ro['over']
        spouse_active = k[q]['active_participant'] if married else 0
        td = trad_ira_deduction(year, fs, apart, magi[p], age[p], m[p]['trad_ira'], k[p]['active_participant'], spouse_active)
        out[p + '_trad_ira_page_deduction'] = page_ded[p]
        out[p + '_trad_ira_deductible'] = td['deductible']          # contrast: the real 219(g) amount
        out[p + '_agi'] = agi[p]
    if fs == 'married_joint':
        out['magi'], out['agi'] = magi['A'], agi['A']
        out['agi_real_deduction'] = magi['A'] - out['A_trad_ira_deductible'] - out['B_trad_ira_deductible']

    # Tax saved by the HSA payroll money (none of it computed when anyone is 65+)
    if any(a >= MEDICARE_AGE for a in age.values()):
        out.update(income_tax_with=None, income_tax_without=None, income_tax_saved=None, fica_saved_ss=None,
                   fica_saved_medicare=None, fica_saved=None, addl_medicare_saved=None, fica_saved_flat=None)
        return out
    ss_saved = med_saved = F(0)
    for p in ppl:
        s1, m1 = employee_fica(year, fw[p])
        s0, m0 = employee_fica(year, fw_0[p])
        ss_saved += s0 - s1
        med_saved += m0 - m1
    out.update(income_tax_with=tax_with, income_tax_without=tax_without, income_tax_saved=tax_without - tax_with,
               fica_saved_ss=ss_saved, fica_saved_medicare=med_saved, fica_saved=ss_saved + med_saved,
               addl_medicare_saved=addl_without - addl_with,
               fica_saved_flat=FLAT_FICA_RATE * sum((m[p]['hsa_payroll'] for p in ppl), F(0)))   # contrast (the page)
    return out


# =====================================================================================================
# 10. Self-checks
# =====================================================================================================
def check_tables():
    """Cross-check the figures against the statutes' own structure and the agencies' worked numbers."""
    for y in (2025, 2026):
        # 60-63 catch-up: the greater of $10,000 or 150% of the 2024 amount (USC414 (v)(2)(E)(i)); kept for 2026 (N2567).
        assert CATCH_UP_60_63[y] == max(CATCH_UP_60_63_FLOOR, CATCH_UP_60_63_PCT * CATCH_UP_50_IN_2024) == 11250
        # Phase-out widths are the statute's: Roth 10,000 joint and separate, 15,000 others; traditional 10,000 / 20,000.
        r, t = ROTH_PHASEOUT[y], TRAD_PHASEOUT[y]
        assert r['joint'][1] - r['joint'][0] == 10000 and r['single'][1] - r['single'][0] == 15000 and r['separate'] == (0, 10000)
        assert t['single'][1] - t['single'][0] == 10000 and t['joint'][1] - t['joint'][0] == 20000
        assert t['spouse'][1] - t['spouse'][0] == 10000 and t['separate'] == (0, 10000)
        # 219(g)(7)(A) and 408A(c)(3)(B)(ii)(I) are both $150,000 indexed from 2005 to the nearest $1,000: equal every year.
        assert t['spouse'] == r['joint']
        # FSA carryover = 20% of the 125(i) limit (N2033).
        assert FSA_CARRYOVER[y] == FSA_CARRYOVER_SHARE * FSA_LIMIT[y]
        # Standard deduction: joint = 200% of single (USC63 (c)(2)(A)); separate = single.
        sd = STANDARD_DEDUCTION[y]
        assert sd['married_joint'] == 2 * sd['single'] and sd['married_separate'] == sd['single']
        # Brackets: contiguous, rates 10..37, the printed base amounts rebuilt exactly.
        for st, table in BRACKETS[y].items():
            assert [rt for _, rt in table] == ['0.10', '0.12', '0.22', '0.24', '0.32', '0.35', '0.37']
            uppers = [u for u, _ in table[:-1]]
            assert uppers == sorted(uppers)
            assert [bracket_tax(y, st, u) for u in uppers] == [_F(b) for b in BRACKET_BASES[y][st]], (y, st)
        assert BRACKETS[y]['married_joint'][0][0] == 2 * BRACKETS[y]['single'][0][0]
        assert 5 * GIFT_EXCLUSION[y] == 95000
    # Pub. L. 119-21 numbers are the statute's: 63(c)(7)(A) $23,625 (head of household) and $15,750 (others) for 2025.
    assert STANDARD_DEDUCTION[2025]['head_of_household'] == 23625 and STANDARD_DEDUCTION[2025]['single'] == 15750
    assert STANDARD_DEDUCTION_2025_REMOVED['single'] == 15000
    # HSA: 2027 published; trustee cap (USC223 (d)(1)(A)(ii)) = family + catch-up; P969 "$5,300" and "$10,550" (2025).
    assert sorted(HSA_LIMIT) == [2025, 2026, 2027]
    per, hh = hsa_positions(2025, 'self', {'A': 56}, {'A': 0}, False)
    assert per['A']['limit'] == 5300
    per, hh = hsa_positions(2025, 'family', {'A': 55, 'B': 57}, {'A': 0, 'B': 0}, True)
    assert hh['limit'] == 10550
    # IRA: P590A What's New for 2026 "$7,500 ($8,600 for individuals age 50 or older)".
    assert sum(ira_limit(2026, 50)) == 8600 and sum(ira_limit(2025, 49)) == 7000
    # Phase-out: P590A Worksheet 2-2 Example (2025, single, under 50, MAGI 151,000): line 5 0.067, line 7 469, line 8 6,540.
    assert phase_out(7000, 151000, 150000, 165000, 'worksheet') == phase_out(7000, 151000, 150000, 165000) == 6540
    # P590A Worksheet 1-2 Example 1 (2025, joint, covered, MAGI 126,500): 219(g)(2)(C) gives 6,830 (the IRS prints 6,825).
    assert phase_out(7000, 126500, 126000, 146000) == 6830 == phase_out(7000, 126500, 126000, 146000, 'worksheet')
    # $200 floor, zero at the end, full at the start; the floor applies only when the limit is above zero.
    assert phase_out(7000, 164999, 150000, 165000) == 200 and phase_out(7000, 165000, 150000, 165000) == 0
    assert phase_out(7000, 150000, 150000, 165000) == 7000
    # Law and worksheet can differ by $10 when the 3-place ratio crosses a $10 step (both are valid readings).
    assert phase_out(8000, F(374, 100), 0, 1000) == 7980 and phase_out(8000, F(374, 100), 0, 1000, 'worksheet') == 7970
    # Form 8959 (2025) Example 5: joint wages 150,000 + 175,000 -> tax on 75,000.
    assert additional_medicare('married_joint', [150000, 175000]) == F(675)
    # Deadlines: P590A (2025) and P969 (2025) "April 15, 2026"; prior editions April 18 in 2016, 2017, 2022, 2023.
    assert ira_hsa_deadline(2025) == _dt.date(2026, 4, 15)
    for ty, d in ((2015, (2016, 4, 18)), (2016, (2017, 4, 18)), (2021, (2022, 4, 18)), (2022, (2023, 4, 18))):
        assert ira_hsa_deadline(ty) == _dt.date(*d), ty
    assert ira_hsa_deadline(2026) == _dt.date(2027, 4, 15) and ira_hsa_deadline(2027) == _dt.date(2028, 4, 18)
    # 529: I709 Pat example: $100,000, election on $95,000 -> 2025 counts $5,000 + $19,000 = $24,000.
    q = qtp_election(100000, 2025)
    assert q['elected'] == 95000 and q['per_year'] == 19000 and q['first_year_counted'] == 24000
    _check_examples()


def _check_examples():
    """The worked examples of tests/golden/limits/RULES.md section 10, number for number."""
    # 10.1 Rosa, 61 in 2026: pre-tax 26,000 + Roth 10,000 over 24,500 + 11,250 by 250; Roth covers the excess.
    r = k401(2026, 61, 26000, 10000, 6000, 150000)
    assert (r['limit'], r['catch_up'], r['used'], r['room'], r['over'], r['in_income']) == (24500, 11250, 36000, 0, 250, 0)
    assert r['annual_additions'] == 30750 and r['limit_415c'] == 72000 and r['exceeds_415c'] == 0
    r = k401(2026, 61, 36000, 0, 6000, 150000)
    assert r['over'] == 250 and r['in_income'] == 250
    assert k401(2026, 64, 0, 0)['catch_up'] == 8000 and k401(2025, 60, 0, 0)['catch_up'] == 11250
    # 10.2 Dev (45) and Mara (52), joint 2026, MAGI 246,321.
    case = {'year': 2026, 'today': '2026-10-31', 'filing_status': 'married_joint', 'coverage': 'none', 'other_income': 1321,
            'adults': {'A': {'birth_date': '1981-05-02', 'pay': 150000, 'k401': 10000, 'roth_ira': 4260},
                       'B': {'birth_date': '1974-09-20', 'pay': 105000, 'trad_ira': 6000, 'roth_ira': 3000}}}
    o = work_household(case)
    assert o['magi'] == 246321 and o['A_roth_status'] == o['B_roth_status'] == 'partial'
    assert o['A_roth_reduced_limit'] == 4260 and o['A_roth_allowed'] == 4260 and o['A_roth_over'] == 0
    assert o['B_roth_reduced_limit'] == 4890 and o['B_roth_allowed'] == 2600 and o['B_roth_over'] == 400
    assert o['B_ira_over'] == 400 and o['B_trad_ira_page_deduction'] == 6000 and o['B_trad_ira_deductible'] == 4890
    assert o['agi'] == 240321 and o['agi_real_deduction'] == 241431
    assert phase_out(8600, 246321, 242000, 252000, 'worksheet') == 4890 == phase_out(8600, 246321, 242000, 252000)
    # 10.3 Sam (pay 90,000) and Lee (pay 9,000), separate 2026, age 40 and 38.
    for apart, want in ((0, ('over', 0, 7500, 'partial', 750, 6750)), (1, ('ok', 7500, 0, 'ok', 7500, 0))):
        case = {'year': 2026, 'filing_status': 'married_separate', 'lived_apart': apart, 'coverage': 'none',
                'adults': {'A': {'birth_date': '1986-01-10', 'pay': 90000, 'roth_ira': 7500},
                           'B': {'birth_date': '1988-03-03', 'pay': 9000, 'roth_ira': 7500}}}
        o = work_household(case)
        got = (o['A_roth_status'], o['A_roth_allowed'], o['A_roth_over'], o['B_roth_status'], o['B_roth_allowed'], o['B_roth_over'])
        assert got == want, (apart, got)
    assert phase_out(7500, 9990, 0, 10000) == 200
    # 10.4 Ana (56) and Ben (52), family HDHP 2026.
    per, hh = hsa_positions(2026, 'family', {'A': 56, 'B': 52}, {'A': 4000, 'B': 5500}, True)
    assert (per['A']['limit'], per['A']['room'], per['B']['limit'], per['B']['room']) == (4250, 250, 5750, 250)
    assert (hh['limit'], hh['total'], hh['room'], hh['over']) == (9750, 9500, 250, 0)
    per, hh = hsa_positions(2026, 'family', {'A': 56, 'B': 52}, {'A': 4000, 'B': 6500}, True)
    assert (per['A']['over'], per['B']['over'], hh['over']) == (750, 750, 750)
    assert (per['A']['excess'], per['B']['excess'], hh['excess']) == (0, 750, 750)
    per, hh = hsa_positions(2026, 'family', {'A': 52, 'B': 56}, {'A': 9750, 'B': 0}, True)
    assert per['A']['over'] == 1000 and hh['over'] == 0 and hh['excess'] == 1000 and per['A']['excess'] == 1000
    per, hh = hsa_positions(2026, 'family', {'A': 40, 'B': 40}, {'A': 6000, 'B': 6000}, True)
    assert per['A']['over'] == per['B']['over'] == 3250 and per['A']['excess'] == per['B']['excess'] == 1625 and hh['over'] == 3250
    # 10.5 Kai, single 2026, age 45, pay 210,000, 401(k) 24,500, self-only HSA 4,400 by payroll.
    case = {'year': 2026, 'filing_status': 'single', 'coverage': 'self',
            'adults': {'A': {'birth_date': '1981-07-07', 'pay': 210000, 'k401': 24500, 'hsa_payroll': 4400}}}
    o = work_household(case)
    assert o['income_tax_with'] == 32198 and o['income_tax_without'] == 33254 and o['income_tax_saved'] == 1056
    assert o['fica_saved_ss'] == 0 and o['fica_saved_medicare'] == F(6380, 100) and o['addl_medicare_saved'] == F(3960, 100)
    assert o['fica_saved_flat'] == F(33660, 100)
    case['adults']['A']['pay'] = 186000
    o = work_household(case)
    assert o['fica_saved_ss'] == F(17980, 100) and o['fica_saved_medicare'] == F(6380, 100) and o['addl_medicare_saved'] == 0
    # 10.6 Jo, FSA 2026: election 3,600, spent 2,900.
    f = fsa(2026, 3600, 2900, False)
    assert (f['fsa_limit'], f['fsa_carryover'], f['fsa_over'], f['fsa_unspent'], f['fsa_forfeit'], f['fsa_with_hsa']) == (3400, 680, 200, 700, 20, 0)
    assert fsa(2026, 3600, 2900, True)['fsa_with_hsa'] == 1


check_tables()
