"""US health-cost figures for the health answer key (Marketplace credit, Medicare IRMAA, high-deductible plans), as data
plus small pure functions.

Written from the primary sources below, never from the app's code. Nobody opened modules/, core/ or
tests/*.test.mjs while writing this file, and it never imports or runs the app. Only the layout and
conventions of tools/golden_debt/ and tools/golden_student_loans/ were looked at; no figure or code is
shared with them. Every figure names its source and the date it was read on the same line. Money is an
exact Fraction while it is worked and a Decimal when it is shown; a percentage is a percent number
("9.96" = 9.96%), a share is a fraction. Importing this file runs check_tables().

Calculators covered (the page READMEs are the spec; where a source says otherwise the key follows the
source and says so in tests/golden/health/RULES.md):
  MARKET    Marketplace premium tax credit (26 U.S.C. 36B): household income as a multiple of the HHS poverty
            guideline (48 states + DC), the applicable percentage straight-line inside its band, required
            contribution = percentage x income, credit = max(0, benchmark - contribution). "law" = the
            indexed table with the 400% cliff (the law for 2026 and 2027); "enhanced" = the 2021-2025 table
            (no cliff, 8.5% cap) as a what-if. Benchmark = 12 x B40 / 1.278 x sum of the covered people's
            federal default age factors.
  IRMAA     Medicare income-related monthly adjustment amounts for 2026: the tier comes from MAGI two years
            back and the filing status; surcharge a year = (Part B over standard + Part D add-on) x 12 x people.
  HDHP      High-deductible plan out of pocket (the page's own model), HSA eligibility, HSA contribution limits.

Sources (all read 2026-10-31; sha256 of the copy read: first 8 ... last 10 hex digits):
  USC36B   26 U.S.C. 36B, Office of the Law Revision Counsel, "current through Public Law 119-136 (October 22, 2026)"
           https://uscode.house.gov/us/usc/119-136/t26/s36B/   (sha256 5617d507...1224dc547e)
             (b)(2), (b)(3)(A)(i) table and "linear manner", (b)(3)(A)(iii) 2021-2025 table, (b)(3)(C), (c)(1)(A),
             (c)(1)(E), (d)(1), (d)(3)(B); amendment notes (last amendment Pub. L. 119-21, July 4, 2025)
  USC223   26 U.S.C. 223, same edition   https://uscode.house.gov/us/usc/119-136/t26/s223/   (sha256 b7b5bdd4...b9d6f0bd15)
  USC1395R 42 U.S.C. 1395r (Social Security Act s.1839), same edition, (a)(3) and (i)
           https://uscode.house.gov/us/usc/119-136/t42/s1395r/   (sha256 e34851a3...fac933520b)
  USC1395W 42 U.S.C. 1395w-113 (SSA s.1860D-13), same edition, (a)(7)
           https://uscode.house.gov/us/usc/119-136/t42/s1395w-113/   (sha256 049ff49c...cd43c30f73)
  CGLAWS   congress.gov API, laws of the 119th Congress: 138 laws, the last public law is 119-136 (Oct 22, 2026)
           https://api.congress.gov/v3/law/119   (sha256 1407c847...b66c4aa63d); www.congress.gov pages answered
           HTTP 403 to this reader, so the API (congress.gov's own data service) was used instead
  CGHR1834 congress.gov API, H.R. 1834 (119th), the House's 3-year extension vehicle: latest action 2026-02-10
           "Placed on Senate Legislative Calendar under General Orders. Calendar No. 319."; no law
           https://api.congress.gov/v3/bill/119/hr/1834   (sha256 84c21043...8ca031cbb8); same in govinfo bulk
           BILLSTATUS-119hr1834.xml (sha256 fe158c51...f6ea375fc1)
  GPOHR1834 H.R. 1834 Engrossed in House ("Passed the House of Representatives January 8, 2026"), s.1 "EXTENSION OF
           ENHANCED PREMIUM TAX CREDIT": would strike "before January 1, 2026" in 36B(b)(3)(A)(iii) and (c)(1)(E) and
           insert "before January 1, 2029"   https://www.govinfo.gov/content/pkg/BILLS-119hr1834eh/html/BILLS-119hr1834eh.htm
           (sha256 da963879...17ca0a6d9b). Not enacted (CGHR1834, CGLAWS).
  GPOPLAW  govinfo "Public and Private Laws" RSS, highest number Public Law 119-136
           https://www.govinfo.gov/rss/plaw.xml   (sha256 f42ed9ba...bc46bd2005)
  CFR36B1  26 CFR 1.36B-1(h) Federal poverty line, eCFR title 26 "up to date as of 2026-10-29"
           https://www.ecfr.gov/current/title-26/section-1.36B-1   (XML sha256 50b71def...1beccca243)
  CFR36B2  26 CFR 1.36B-2(b)(1) applicable taxpayer, same edition
           https://www.ecfr.gov/current/title-26/section-1.36B-2   (XML sha256 fd093df9...3485fe2688)
  CFR36B3  26 CFR 1.36B-3(e) adjusted monthly premium, (g) applicable percentage (rounding, Examples 1 and 2), same edition
           https://www.ecfr.gov/current/title-26/section-1.36B-3   (XML sha256 5f7d92eb...fb025773a6)
  CFR147   45 CFR 147.102 Fair health insurance premiums, eCFR title 45 "up to date as of 2026-10-29"; text
           [78 FR 13436 ... as amended at 83 FR 17058, Apr. 17, 2018]
           https://www.ecfr.gov/current/title-45/section-147.102   (XML sha256 1648980c...a3f4f2b18d)
  CFR155   45 CFR 155.410(e) annual open enrollment period, same edition
           https://www.ecfr.gov/current/title-45/section-155.410   (XML sha256 865539c4...89531c1655)
  RP2525   Rev. Proc. 2025-25 (2026 applicable percentage table, required contribution percentage 9.96%)
           https://www.irs.gov/pub/irs-drop/rp-25-25.pdf   (sha256 ba950034...0fb6b67697)
  RP2626   Rev. Proc. 2026-26 (2027 applicable percentage table, required contribution percentage 10.22%)
           https://www.irs.gov/pub/irs-drop/rp-26-26.pdf   (sha256 b3ce6c8c...09e727ed60)
  I8962    IRS Instructions for Form 8962 (2025): Table 1-1 (2024 guidelines used for 2025 coverage), Worksheet 2,
           Table 2 "Applicable Figure", lines 8a, 8b   https://www.irs.gov/pub/irs-pdf/i8962.pdf   (sha256 f4ac86ad...10e07bf9a2)
  PG24     HHS, Annual Update of the HHS Poverty Guidelines, 89 FR 2961 (Jan 17, 2024)   (sha256 9bf6ec5b...d33a9a01fb)
           https://www.govinfo.gov/content/pkg/FR-2024-01-17/pdf/2024-00796.pdf
  PG25     HHS, same title, 90 FR 5917 (Jan 17, 2025), effective Jan 15, 2025   (sha256 a239506c...92ee2cebce)
           https://www.govinfo.gov/content/pkg/FR-2025-01-17/pdf/2025-01377.pdf
  PG26     HHS, same title, 91 FR 1797 (Jan 15, 2026), table p.1798, effective Jan 13, 2026   (sha256 67f71197...64d2d0f339)
           https://www.govinfo.gov/content/pkg/FR-2026-01-15/pdf/2026-00755.pdf
  ASPE     aspe.hhs.gov "Poverty Guidelines" (2026 tables)   https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines
           (sha256 7e54b7fd...91766937f4)
  HCGOV    HealthCare.gov glossary "Federal poverty level (FPL)" (CMS)   https://www.healthcare.gov/glossary/federal-poverty-level-fpl/
           (sha256 d378b47d...c48a717e67)
  CMSAGE   CMS/CCIIO Insurance Standards Bulletin "Guidance Regarding Age Curves and State Reporting" (Dec 16, 2016),
           Appendix I "Federal default standard age curve"
           https://www.cms.gov/CCIIO/Resources/Regulations-and-Guidance/Downloads/Final-Guidance-Regarding-Age-Curves-and-State-Reporting-12-16-16.pdf
           (sha256 5563e6d8...60eacfc060)
  CMSRATE  CMS "Market Rating Reforms" (table "Updated December 10, 2021"; page last modified 09/10/2024)
           https://www.cms.gov/cciio/programs-and-initiatives/health-insurance-market-reforms/state-rating   (sha256 37ba1304...eac301860e)
  CMSFS26  CMS fact sheet "2026 Medicare Parts A & B Premiums and Deductibles" (Nov 14, 2025), incl. the 2026 Part D IRMAA
           https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles   (sha256 6583dbf5...ad9871c7f7)
  FRB26    CMS-8091-N, "Medicare Part B Monthly Actuarial Rates, Premium Rates, and Annual Deductible Beginning
           January 1, 2026", 90 FR 52063 (Nov 19, 2025); IRMAA tables p.52066
           https://www.govinfo.gov/content/pkg/FR-2025-11-19/pdf/2025-20251.pdf   (sha256 b1c6d7ba...f72770a7bc)
  POMS     SSA POMS HI 01101.020 "IRMAA Sliding Scale Tables", TN 36 (12-25), effective 12/02/2025
           https://secure.ssa.gov/poms.nsf/lnx/0601101020   (sha256 3b90e472...a3d501f848)
  CMSD26   CMS fact sheet "2026 Medicare Part D Bid Information and Part D Premium Stabilization Demonstration
           Parameters" (Jul 28, 2025)   https://www.cms.gov/newsroom/fact-sheets/2026-medicare-part-d-bid-information-and-part-d-premium-stabilization-demonstration-parameters
           (sha256 3357e92d...2b0f2e3253)
  CMSD27   CMS fact sheet "Medicare Part D 2027 National Average Monthly Bid Amount Information" (Jul 28, 2026)
           https://www.cms.gov/newsroom/fact-sheets/medicare-part-d-2027-national-average-monthly-bid-amount-information
           (sha256 e6607c5b...11565bbaa6)
  RP2519   Rev. Proc. 2025-19 (2026 HSA / HDHP amounts)   https://www.irs.gov/pub/irs-drop/rp-25-19.pdf   (sha256 ff2ba4ba...c11da35bf4)
  RP2624   Rev. Proc. 2026-24 (2027 HSA / HDHP amounts)   https://www.irs.gov/pub/irs-drop/rp-26-24.pdf   (sha256 bcb6b41a...f45afcb715)
  P969     IRS Pub. 969 (2025), "Health Savings Accounts and Other Tax-Favored Health Plans" (page last reviewed 30-Apr-2026)
           https://www.irs.gov/publications/p969   (sha256 be786dac...40897122a5)

NOT VERIFIED on any official source (so the key states its own convention and says so):
  - The IRS has not published the Form 8962 instructions for 2026 or 2027 yet. The key's "form" track (whole
    percent of the poverty line, whole-dollar contribution) copies the method of the 2025 instructions (I8962).
  - Rounding of the required contribution and the credit on the "reg" track: neither USC36B nor CFR36B3 says.
    The key keeps both exact and rounds the credit to the cent, half up, only when it is shown.
  - Ties in "nearest whole dollar" (I8962 lines 8a, 8b): no rule on .50; the key rounds half up.
  - Per-member rounding of an age-rated premium: no federal rule found; the key keeps B40 / 1.278 x factor exact.
  - Whether CMS changed the federal default age curve after the Dec. 16, 2016 bulletin: CMSRATE (modified 2024)
    still says "If a cell is blank or a state is not listed, the federal default applies"; no later default curve
    was found. Not otherwise verified.
  - 2027 Medicare IRMAA: CMS had not published the 2027 Part B premium, the 2027 income tiers or the 2027 Part D
    IRMAA by 2026-10-31 (the 2027 fact-sheet address answered 404; no 2027 Part B notice in the Federal Register).
    Only the 2027 Part D base beneficiary premium ($41.33, CMSD27) is published. The key has no 2027 IRMAA table.
  - Part D IRMAA rounding: USC1395W (a)(7) has no rounding sentence. "Nearest 10 cents" reproduces all five 2026
    amounts from the $38.99 base premium (check_tables()); the rule itself was not found in a source read here.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

from decimal import Decimal as D
from fractions import Fraction as F

READ_ON = '2026-10-31'  # every source above was read on this date
CENT = F(1, 100)
DIME = F(1, 10)
DOLLAR = F(1)
BASIS_POINT = F(1, 100)  # 0.01 of a percentage point: CFR36B3 (g)(1) "rounded to the nearest one-hundredth of one percent"; read 2026-10-31
MONTHS_PER_YEAR = 12     # USC36B (b)(2)(B)(ii) "1/12 of the product of the applicable percentage and the taxpayer's household income"; read 2026-10-31


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


def round_half_up(x, quantum=CENT):
    """Round x to a multiple of quantum, halves away from zero (the key's convention; see RULES.md)."""
    x, q = _F(x), _F(quantum)
    n = abs(x) / q
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)  # floor(n + 1/2)
    return (k * q) if x >= 0 else -(k * q)


def show(x, quantum=CENT):
    """Decimal for display, rounded half up to the quantum (cents by default)."""
    r = round_half_up(x, quantum)
    places = {CENT: D('0.01'), DIME: D('0.01'), DOLLAR: D('1'), BASIS_POINT: D('0.01')}.get(_F(quantum), D('0.0001'))
    return (D(r.numerator) / D(r.denominator)).quantize(places)


# =====================================================================================================
# 1. MARKETPLACE: premium tax credit (26 U.S.C. 36B)
# =====================================================================================================

# ---- HHS poverty guidelines (42 U.S.C. 9902(2)), persons in family 1..8 -------------------------
# Each table: (amount for 1..8 persons), then "add $X for each additional person" above 8.
POVERTY = {
    2024: {'contiguous': ((15060, 20440, 25820, 31200, 36580, 41960, 47340, 52720), 5380)},  # PG24 89 FR 2961 table "48 contiguous states and the District of Columbia", "add $5,380"; I8962 Table 1-1 the same; read 2026-10-31
    2025: {
        'contiguous': ((15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150), 5500),  # PG25 90 FR 5917 "48 CONTIGUOUS STATES AND THE DISTRICT OF COLUMBIA", "add $5,500 for each additional person"; HCGOV "2025 income" column the same; read 2026-10-31
        'alaska':     ((19550, 26430, 33310, 40190, 47070, 53950, 60830, 67710), 6880),  # PG25 90 FR 5917 Alaska table, "add $6,880"; read 2026-10-31
        'hawaii':     ((17990, 24320, 30650, 36980, 43310, 49640, 55970, 62300), 6330),  # PG25 90 FR 5917 Hawaii table, "add $6,330"; read 2026-10-31
    },
    2026: {
        'contiguous': ((15960, 21640, 27320, 33000, 38680, 44360, 50040, 55720), 5680),  # PG26 91 FR 1798 "48 contiguous states and the District of Columbia", "add $5,680"; ASPE and HCGOV "2026 income" the same; read 2026-10-31
        'alaska':     ((19950, 27050, 34150, 41250, 48350, 55450, 62550, 69650), 7100),  # PG26 91 FR 1798 Alaska table, "add $7,100"; read 2026-10-31
        'hawaii':     ((18360, 24890, 31420, 37950, 44480, 51010, 57540, 64070), 6530),  # PG26 91 FR 1798 Hawaii table, "add $6,530"; read 2026-10-31
    },
}


def poverty_guideline(year, family_size, region='contiguous'):
    """HHS poverty guideline for the family size (PG24 / PG25 / PG26 tables), as an exact Fraction of dollars."""
    if family_size < 1:
        raise ValueError('family size is at least 1')
    table, extra = POVERTY[year][region]
    if family_size <= len(table):
        return F(table[family_size - 1])
    return F(table[-1] + extra * (family_size - len(table)))


# Which guideline year applies to which coverage year: the one most recently published on the first day of open
# enrollment (Nov 1 of the year before). USC36B (d)(3)(B) "the most recently published poverty line as of the 1st day
# of the regular enrollment period for coverage during such calendar year"; CFR36B1 (h) "the Federal poverty line in
# effect on the first day of the initial or annual open enrollment period preceding that taxable year"; CFR155
# (e)(4)(i) open enrollment "begins on November 1 of the calendar year preceding the benefit year" (through 2026),
# (e)(5)(i) "must begin no later than November 1" (2027 on); HHS publishes in January (PG25 Jan 17, 2025; PG26
# Jan 15, 2026); HCGOV "Income from the previous year is used to calculate Marketplace savings for the next year";
# I8962 (2025) prints the 2024 guideline ($15,060) for 2025 coverage. All read 2026-10-31.
POVERTY_YEAR_FOR_COVERAGE = {2025: 2024, 2026: 2025, 2027: 2026}  # USC36B (d)(3)(B); CFR36B1 (h); CFR155 (e); HCGOV; I8962 Table 1-1 (2025 coverage -> 2024 guideline); read 2026-10-31


def poverty_year_for_coverage(coverage_year):
    return POVERTY_YEAR_FOR_COVERAGE[coverage_year]


# ---- Applicable percentage tables ----------------------------------------------------------------
# Row: (lower % of poverty line, upper %, initial premium %, final premium %). A household at p% of the poverty
# line is in the row with lower <= p < upper ("At least ... but less than"), except the last row of a law table,
# which also takes p == 400 ("At least 300% but not more than 400%"). Above 400% a law table has no row: no credit.
AP_LAW = {
    # USC36B (b)(3)(A)(i) as enacted (before indexing); CFR36B3 (g)(2) the same table; read 2026-10-31
    2014: ((0, 133, '2.0', '2.0'), (133, 150, '3.0', '4.0'), (150, 200, '4.0', '6.3'), (200, 250, '6.3', '8.05'),  # USC36B (b)(3)(A)(i); CFR36B3 (g)(2); read 2026-10-31
           (250, 300, '8.05', '9.5'), (300, 400, '9.5', '9.5')),  # USC36B (b)(3)(A)(i); CFR36B3 (g)(2); read 2026-10-31
    # RP2525 s.3.01 "Applicable Percentage Table for 2026": Less than 133% 2.10/2.10; At least 133% but less than 150%
    # 3.14/4.19; 150-200 4.19/6.60; 200-250 6.60/8.44; 250-300 8.44/9.96; "At least 300% but not more than 400%" 9.96/9.96; read 2026-10-31
    2026: ((0, 133, '2.10', '2.10'), (133, 150, '3.14', '4.19'), (150, 200, '4.19', '6.60'), (200, 250, '6.60', '8.44'),  # RP2525 s.3.01; read 2026-10-31
           (250, 300, '8.44', '9.96'), (300, 400, '9.96', '9.96')),  # RP2525 s.3.01; read 2026-10-31
    # RP2626 s.3.01 "Applicable Percentage Table for 2027": 2.15/2.15; 3.23/4.3; 4.3/6.78; 6.78/8.66; 8.66/10.22;
    # 10.22/10.22, same row wording as RP2525; read 2026-10-31
    2027: ((0, 133, '2.15', '2.15'), (133, 150, '3.23', '4.3'), (150, 200, '4.3', '6.78'), (200, 250, '6.78', '8.66'),  # RP2626 s.3.01; read 2026-10-31
           (250, 300, '8.66', '10.22'), (300, 400, '10.22', '10.22')),  # RP2626 s.3.01; read 2026-10-31
}
# USC36B (b)(3)(A)(iii) "Temporary percentages for 2021 through 2025" (ARPA s.9661, extended by IRA s.12001): Up to 150.0
# percent 0.0/0.0; 150.0 up to 200.0 0.0/2.0; 200.0-250.0 2.0/4.0; 250.0-300.0 4.0/6.0; 300.0-400.0 6.0/8.5;
# "400.0 percent and higher" 8.5/8.5; applies to "a taxable year beginning after December 31, 2020, and before
# January 1, 2026", and (iii)(I) "clause (ii) [indexing] shall not apply"; read 2026-10-31
AP_ENHANCED = ((0, 150, '0.0', '0.0'), (150, 200, '0.0', '2.0'), (200, 250, '2.0', '4.0'), (250, 300, '4.0', '6.0'),  # USC36B (b)(3)(A)(iii)(II); read 2026-10-31
               (300, 400, '6.0', '8.5'), (400, None, '8.5', '8.5'))  # USC36B (b)(3)(A)(iii)(II); read 2026-10-31
ENHANCED_YEARS = (2021, 2022, 2023, 2024, 2025)  # USC36B (b)(3)(A)(iii), (c)(1)(E) "after December 31, 2020, and before January 1, 2026"; read 2026-10-31
# Not extended: USC36B (edition through Pub. L. 119-136) still ends both clauses "before January 1, 2026"; its last amendment is
# Pub. L. 119-21 (July 4, 2025), which did not extend them; CGLAWS shows no law after 119-136; the House-passed extension
# through 2028 (GPOHR1834; CGHR1834: passed Jan 8, 2026, 230-196) sits on the Senate calendar. Read 2026-10-31.
ENHANCED_EXTENDED_PAST_2025 = False

REQUIRED_CONTRIBUTION_PCT = {2026: '9.96', 2027: '10.22'}  # RP2525 s.3.02 "is 9.96%"; RP2626 s.3.02 "is 10.22%" (employer-coverage affordability test, USC36B (c)(2)(C)(i)(II)); read 2026-10-31

APPLICANT_FLOOR_PCT = 100   # USC36B (c)(1)(A) household income "equals or exceeds 100 percent but does not exceed 400 percent"; CFR36B2 (b)(1) "at least 100 percent but not more than 400 percent"; read 2026-10-31
LAW_CLIFF_PCT = 400         # same text; USC36B (c)(1)(E) waived the 400% cap only for 2021-2025; read 2026-10-31

# I8962 (2025) Table 2 "Applicable Figure" for line 5 = 150 ... 399 (4 digits each, so "0004" = 0.0004), built by the IRS
# from the 2021-2025 table. TIP: "If the amount on line 5 is 150 or less, your applicable figure is 0.0000. If the amount
# on line 5 is 400 or more, your applicable figure is 0.0850." Read 2026-10-31. check_tables() rebuilds it.
I8962_2025_TABLE2 = (  # I8962 (2025) Table 2, rows 150..399; read 2026-10-31
    '0000000400080012001600200024002800320036004000440048005200560060006400680072007600800084008800920096'
    '0100010401080112011601200124012801320136014001440148015201560160016401680172017601800184018801920196'
    '0200020402080212021602200224022802320236024002440248025202560260026402680272027602800284028802920296'
    '0300030403080312031603200324032803320336034003440348035203560360036403680372037603800384038803920396'
    '0400040404080412041604200424042804320436044004440448045204560460046404680472047604800484048804920496'
    '0500050405080512051605200524052805320536054005440548055205560560056405680572057605800584058805920596'
    '0600060306050608061006130615061806200623062506280630063306350638064006430645064806500653065506580660'
    '0663066506680670067306750678068006830685068806900693069506980700070307050708071007130715071807200723'
    '0725072807300733073507380740074307450748075007530755075807600763076507680770077307750778078007830785'
    '0788079007930795079808000803080508080810081308150818082008230825082808300833083508380840084308450848'
)


def i8962_2025_figure(line5):
    """Applicable figure from I8962 (2025) Table 2 for a whole-number line 5 (a Fraction share, e.g. 0.0412)."""
    if line5 <= 150:
        return F(0)
    if line5 >= 400:
        return F(85, 1000)
    i = line5 - 150
    return F(int(I8962_2025_TABLE2[4 * i:4 * i + 4]), 10000)


def _row(table, p, has_cliff):
    """Band of the table that holds p (% of poverty line), or None when p is over the law's 400% line."""
    for i, (lo, hi, a, b) in enumerate(table):
        if hi is None:
            if p >= lo:
                return (lo, hi, a, b)
        elif lo <= p < hi or (has_cliff and i == len(table) - 1 and p == hi):
            return (lo, hi, a, b)
    return None


def applicable_percentage(p, table, has_cliff=True, rounded=True):
    """Applicable percentage (a percent, e.g. Fraction(794, 100) = 7.94%) at p % of the poverty line.

    USC36B (b)(3)(A)(i): it "shall increase, on a sliding scale in a linear manner, from the initial premium percentage
    to the final premium percentage" inside the tier. CFR36B3 (g)(1): "rounded to the nearest one-hundredth of one
    percent"; (g)(3) Example 2 shows the arithmetic: initial + (p - lower) / (upper - lower) x (final - initial).
    Ties go up (CFR36B3 Example 1: 8.775 -> 8.78; I8962 Table 2: 6.025 -> 0.0603, see check_tables()).
    Returns None above 400% on a table with the cliff.
    """
    p = _F(p)
    row = _row(table, p, has_cliff)
    if row is None:
        return None
    lo, hi, a, b = row
    a, b = _F(a), _F(b)
    pct = a if a == b else a + (b - a) * (p - lo) / (hi - lo)
    return round_half_up(pct, BASIS_POINT) if rounded else pct


def premium_tax_credit(income, family_size, benchmark_annual, coverage_year, rules='law', method='reg',
                       region='contiguous', floor_100=True):
    """Premium tax credit for a full year of coverage, as a dict of exact Fractions.

    income            household income (USC36B (d)(2)), dollars
    family_size       USC36B (d)(1); the page's "household size"
    benchmark_annual  the year's premium for the benchmark (second-lowest-cost silver) plan for the covered people
    rules             'law' (the indexed table and the 400% cliff, AP_LAW[coverage_year]) or 'enhanced' (AP_ENHANCED)
    method            'reg': the poverty-line percentage is exact (CFR36B3 (g)(1)); the contribution is exact.
                      'form': I8962 Worksheet 2 (drop the decimals of the percentage; above 4 x guideline enter 401),
                      lines 8a / 8b and the 1095-A note (whole dollars).
    floor_100         True applies the law's 100% floor (USC36B (c)(1)(A)); the exceptions of CFR36B2 (b)(5)-(6) are
                      not modelled. False lets the page's formula run below 100% for comparison.
    """
    income, bench = _F(income), _F(benchmark_annual)
    fpl_year = poverty_year_for_coverage(coverage_year)
    fpl = poverty_guideline(fpl_year, family_size, region)
    exact_pct = 100 * income / fpl
    if method == 'form':
        # I8962 Worksheet 2: "Is the amount on line 1 more than the amount on line 3 [line 2 x 4.0]? Yes ... Enter 401";
        # "No. ... Do not round; instead, multiply this number by 100 ... and then drop any numbers after the decimal point."
        p = F(401) if income > 4 * fpl else F(int(exact_pct))
        bench = round_half_up(bench, DOLLAR)  # I8962: "round the amounts on Form 1095-A to the nearest whole dollar"
    elif method == 'reg':
        p = exact_pct
    else:
        raise ValueError(method)
    out = {'fpl_year': fpl_year, 'fpl': fpl, 'multiple': income / fpl, 'pct_of_fpl': p, 'benchmark': bench,
           'applicable_pct': None, 'contribution': None, 'credit': F(0), 'eligible': True, 'reason': ''}
    if floor_100 and p < APPLICANT_FLOOR_PCT:
        out.update(eligible=False, reason='under 100% of the poverty line')
        return out
    if rules == 'law':
        table, has_cliff = AP_LAW[coverage_year], True
    elif rules == 'enhanced':
        table, has_cliff = AP_ENHANCED, False
    else:
        raise ValueError(rules)
    pct = applicable_percentage(p, table, has_cliff)
    if pct is None:
        out.update(eligible=False, reason='over 400% of the poverty line (the cliff)')
        return out
    if method == 'form':
        contribution = round_half_up(income * pct / 100, DOLLAR)   # I8962 line 8a "rounded to the nearest whole dollar amount"
    else:
        contribution = income * pct / 100                          # USC36B (b)(2)(B)(ii); CFR36B3 (g)(1); no rounding stated
    out.update(applicable_pct=pct, contribution=contribution, credit=max(F(0), bench - contribution))
    return out


def form_monthly_contribution(annual_contribution):
    """I8962 line 8b: "Divide line 8a by 12.0 and enter the result on line 8b, rounded to the nearest whole dollar amount"."""
    return round_half_up(_F(annual_contribution) / MONTHS_PER_YEAR, DOLLAR)


# ---- Benchmark premium from the federal default age curve ----------------------------------------
# CMSAGE Appendix I "Federal default standard age curve" (premium ratios), for plan years beginning in 2018 and later in any
# State without its own curve; age bands per CFR147 (d)(1)(ii), (d)(2), (d)(3): 0-14 one band, 15-20 and 21-63 one-year
# bands, 64 and older one band. Read 2026-10-31.
AGE_CURVE = {
    0: '0.765',  # ages 0-14; CMSAGE Appendix I; read 2026-10-31
    15: '0.833', 16: '0.859', 17: '0.885', 18: '0.913', 19: '0.941', 20: '0.970',  # CMSAGE Appendix I; read 2026-10-31
    21: '1.000', 22: '1.000', 23: '1.000', 24: '1.000', 25: '1.004', 26: '1.024', 27: '1.048', 28: '1.087',  # CMSAGE Appendix I; read 2026-10-31
    29: '1.119', 30: '1.135', 31: '1.159', 32: '1.183', 33: '1.198', 34: '1.214', 35: '1.222', 36: '1.230',  # CMSAGE Appendix I; read 2026-10-31
    37: '1.238', 38: '1.246', 39: '1.262', 40: '1.278', 41: '1.302', 42: '1.325', 43: '1.357', 44: '1.397',  # CMSAGE Appendix I; read 2026-10-31
    45: '1.444', 46: '1.500', 47: '1.563', 48: '1.635', 49: '1.706', 50: '1.786', 51: '1.865', 52: '1.952',  # CMSAGE Appendix I; read 2026-10-31
    53: '2.040', 54: '2.135', 55: '2.230', 56: '2.333', 57: '2.437', 58: '2.548', 59: '2.603', 60: '2.714',  # CMSAGE Appendix I; read 2026-10-31
    61: '2.810', 62: '2.873', 63: '2.952',  # CMSAGE Appendix I; read 2026-10-31
    64: '3.000',  # "64 and Older"; CMSAGE Appendix I; read 2026-10-31
}
AGE_FACTOR_40 = AGE_CURVE[40]  # 1.278, the page's divisor (CMSAGE Appendix I, age 40); read 2026-10-31
CHILD_CAP_AGE = 21      # CFR147 (c)(1) "With respect to family members under the age of 21, the premiums for no more than the three oldest covered children must be taken into account"; read 2026-10-31
CHILD_CAP_COUNT = 3     # same sentence; read 2026-10-31
# States with their own individual-market curve (so the federal default does not apply there): Alabama, District of
# Columbia, Massachusetts, Minnesota, Mississippi, Oregon, Utah; New York and Vermont rate 1:1 by age (CMSRATE table
# "Updated December 10, 2021"); read 2026-10-31. The page uses the federal default everywhere.


def age_factor(age):
    """Federal default age factor (CMSAGE Appendix I). Age is the age at policy issuance or renewal (CFR147 (a)(1)(iii))."""
    if age < 0:
        raise ValueError('age')
    if age <= 14:
        return _F(AGE_CURVE[0])
    if age >= 64:
        return _F(AGE_CURVE[64])
    return _F(AGE_CURVE[age])


def counted_factors(adult_ages=(), child_ages=(), child_cap=True):
    """Age factors that enter the family premium. Children under 21: only the three oldest count (CFR147 (c)(1))
    when child_cap is True; children 21 and over and adults always count. child_cap=False is the page's plain sum."""
    kids = sorted(child_ages, reverse=True)
    young = [a for a in kids if a < CHILD_CAP_AGE]
    older = [a for a in kids if a >= CHILD_CAP_AGE]
    if child_cap:
        young = young[:CHILD_CAP_COUNT]
    return [age_factor(a) for a in list(adult_ages) + older + young]


def benchmark_annual(b40_monthly, adult_ages=(), child_ages=(), child_cap=True):
    """Page formula: 12 x (benchmark monthly premium for a 40-year-old) / 1.278 x sum of the covered people's factors.

    USC36B (b)(3)(C) and CFR36B3 (e): the benchmark covers "all members of the taxpayer's coverage family, adjusted
    only for the age of each member"; CFR147 (c)(1): "summing the premiums for each individual family member". Exact.
    """
    total = sum(counted_factors(adult_ages, child_ages, child_cap), F(0))
    return MONTHS_PER_YEAR * _F(b40_monthly) * total / _F(AGE_FACTOR_40)


# =====================================================================================================
# 2. MEDICARE: income-related monthly adjustment amounts (IRMAA), 2026
# =====================================================================================================
PART_B_STANDARD = {2026: '202.90'}       # CMSFS26 "The standard monthly premium for Medicare Part B enrollees will be $202.90 for 2026"; FRB26 p.52063 the same; read 2026-10-31
PART_B_AGED_ACTUARIAL_RATE = {2026: '405.40'}  # FRB26 p.52063 "The monthly actuarial rates for 2026 are $405.40 for aged enrollees"; read 2026-10-31
PART_D_BASE_BENEFICIARY_PREMIUM = {2026: '38.99', 2027: '41.33'}  # CMSD26 "For 2026, the base beneficiary premium will be $38.99"; CMSD27 "For 2027, the base beneficiary premium will be $41.33"; read 2026-10-31
IRMAA_MAGI_LOOKBACK_YEARS = 2  # USC1395R (i)(4)(B)(i) "last taxable year beginning in the second calendar year preceding the year involved"; POMS "If MAGI in 2024 (or 2023 if 2024 is not available)"; read 2026-10-31

# Rows: (upper MAGI of the tier or None for the top tier, upper is inclusive?, Part B total monthly premium,
# Part B IRMAA, Part D IRMAA). A tier holds MAGI above the previous row's upper and up to its own upper:
# "Greater than $X and less than or equal to $Y" (inclusive) or "Greater than $205,000 and less than $500,000"
# (exclusive); the top row is "Greater than or equal to $500,000".
IRMAA = {
    2026: {
        # CMSFS26 "Full Part B Coverage" table and the 2026 Part D table, "individual tax returns" column; FRB26 p.52066 the
        # same; POMS B.1 the same ("Single, head-of-household, or qualifying surviving spouse"); read 2026-10-31
        'single': ((109000, True, '202.90', '0.00', '0.00'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                   (137000, True, '284.10', '81.20', '14.50'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                   (171000, True, '405.80', '202.90', '37.50'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                   (205000, True, '527.50', '324.60', '60.40'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                   (500000, False, '649.20', '446.30', '83.30'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                   (None, None, '689.90', '487.00', '91.00')),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
        # same tables, "joint tax returns" column; POMS B.2; read 2026-10-31
        'joint': ((218000, True, '202.90', '0.00', '0.00'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                  (274000, True, '284.10', '81.20', '14.50'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                  (342000, True, '405.80', '202.90', '37.50'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                  (410000, True, '527.50', '324.60', '60.40'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                  (750000, False, '649.20', '446.30', '83.30'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                  (None, None, '689.90', '487.00', '91.00')),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
        # CMSFS26 / FRB26 "married and lived with their spouses at any time during the year, but who file separate tax
        # returns": <= $109,000; > $109,000 and < $391,000; >= $391,000; POMS B.3; read 2026-10-31
        'mfs': ((109000, True, '202.90', '0.00', '0.00'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                (391000, False, '649.20', '446.30', '83.30'),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
                (None, None, '689.90', '487.00', '91.00')),  # CMSFS26; FRB26 p.52066; POMS B; read 2026-10-31
    },
}
# Levels so the three tables line up (0 = no IRMAA ... 5 = top); married-separate rows are levels 0, 4, 5.
IRMAA_LEVELS = {'single': (0, 1, 2, 3, 4, 5), 'joint': (0, 1, 2, 3, 4, 5), 'mfs': (0, 4, 5)}  # key convention (aligns the three tables; not a source figure)
# Head of household and qualifying surviving spouse use the single table (POMS B.1); a married person filing separately
# who lived apart from the spouse all year also uses it (USC1395R (i)(3)(C)(iii)(II) applies the reduced table only to one
# who "does not live apart from such individual's spouse at all times during the taxable year"; POMS B note); read 2026-10-31.
FILING_STATUS = {'single': 'single', 'hoh': 'single', 'qss': 'single', 'mfs_apart': 'single', 'joint': 'joint', 'mfs': 'mfs'}  # POMS B.1; USC1395R (i)(3)(C)(iii); read 2026-10-31
IRMAA_2027_PUBLISHED = False  # see the module docstring; read 2026-10-31


def irmaa_row(magi, status, year=2026, at_or_under=False):
    """(level, row) of the IRMAA table for the MAGI from two years before.

    Law (default): "less than or equal to" for the lower tiers, "less than $500,000" (joint $750,000, separate $391,000)
    for the next-to-top tier, so MAGI exactly on that line is in the top tier.
    at_or_under=True: a literal "first line the MAGI is at or under", with $500,000 / $750,000 / $391,000 as lines,
    which differs only exactly on that line (the page itself stores $499,999.99 / $749,999.99 / $390,999.99 and so
    agrees with the law).
    """
    status = FILING_STATUS[status]
    magi = _F(magi)
    rows = IRMAA[year][status]
    for i, (upper, inclusive, *_rest) in enumerate(rows):
        if upper is None:
            return IRMAA_LEVELS[status][i], rows[i]
        if magi < upper or (magi == upper and (inclusive or at_or_under)):
            return IRMAA_LEVELS[status][i], rows[i]
    raise AssertionError('unreachable')


def irmaa_monthly(magi, status, year=2026, part_d=True, at_or_under=False):
    """(Part B over the standard premium, Part D add-on) a month for one person, exact Fractions."""
    _level, row = irmaa_row(magi, status, year, at_or_under)
    b_total, b_irmaa, d_irmaa = (_F(x) for x in row[2:])
    assert b_total - _F(PART_B_STANDARD[year]) == b_irmaa
    return b_irmaa, (d_irmaa if part_d else F(0))


def irmaa_surcharge_annual(magi, status, people=1, year=2026, part_d=True, at_or_under=False):
    """Page formula: (Part B over the standard + the Part D add-on) x 12 x people on Medicare.

    Each enrolled spouse on a joint return pays the amount set by the joint MAGI (USC1395R (i)(4)(A) last sentence:
    the MAGI "of such individual shall be to such return's modified adjusted gross income"). The Part D add-on applies
    only to someone enrolled in a Part D plan or a Medicare Advantage plan with drug coverage (USC1395W (a)(7)(A)).
    """
    b, d = irmaa_monthly(magi, status, year, part_d, at_or_under)
    return (b + d) * MONTHS_PER_YEAR * people


# Statutory shape, used by check_tables() (USC1395R (i)): applicable percentage 35/50/65/80/85 by tier, "minus 25
# percentage points", times 200% of the aged actuarial rate; FRB26 p.52063: "about 35, 50, 65, 80, or 85 percent of the
# total cost of Part B coverage plus a repayment amount of $0.30, $0.40, $0.50, $0.60, or $0.70"; the standard premium is
# "50 percent of the monthly actuarial rate for aged enrollees ... plus the $0.20 repayment amount"; USC1395R (a)(3) "rounded
# to the nearest multiple of 10 cents". USC1395W (a)(7)(B): Part D add-on = (applicable % - 25.5%) / 25.5% x base
# beneficiary premium. All read 2026-10-31.
IRMAA_APPLICABLE_PCT = (25, 35, 50, 65, 80, 85)  # level 0 is the standard premium's 25% (USC1395R (i)(3)(C)(i)(III)); read 2026-10-31
FRB26_REPAYMENT = ('0.20', '0.30', '0.40', '0.50', '0.60', '0.70')  # FRB26 p.52063; read 2026-10-31
PART_D_IRMAA_BASE_PCT = F(255, 10)  # USC1395W (a)(7)(B)(i) "reduced by 25.5 percent ... by 25.5 percent"; read 2026-10-31


# =====================================================================================================
# 3. HIGH-DEDUCTIBLE PLANS and HSAs (26 U.S.C. 223)
# =====================================================================================================
# HDHP: annual deductible "not less than" the minimum; deductible plus other out-of-pocket "does not exceed" the maximum
# (USC223 (c)(2)(A)). Rows: (minimum deductible, maximum out of pocket).
HDHP = {
    2026: {'self': (1700, 8500), 'family': (3400, 17000)},  # RP2519 s.2.01(2) "not less than $1,700 for self-only coverage or $3,400 for family coverage ... do not exceed $8,500 ... or $17,000"; P969 2026 table the same; read 2026-10-31
    2027: {'self': (1750, 8700), 'family': (3500, 17400)},  # RP2624 s.3.01(3) "not less than $1,750 ... or $3,500 ... do not exceed $8,700 ... or $17,400"; read 2026-10-31
}
HSA_LIMIT = {
    2026: {'self': 4400, 'family': 8750},  # RP2519 s.2.01(1) "$4,400" self-only, "$8,750" family; P969 "For 2026 ... up to $4,400 ... up to $8,750"; read 2026-10-31
    2027: {'self': 4500, 'family': 9000},  # RP2624 s.3.01(1) "$4,500" self-only, "$9,000" family; read 2026-10-31
}
HSA_CATCH_UP_55 = 1000  # USC223 (b)(3)(B) table "2009 and thereafter $1,000" (not indexed: (g)(1) names only (b)(2), (c)(2)(A), (c)(1)(E)); read 2026-10-31
HSA_INDEX_ROUNDING = 50  # USC223 (g)(2) "rounded to the nearest multiple of $50"; read 2026-10-31
HDHP_STATUTE_BASE = {'self': (1000, 5000), 'family': (2000, 10000)}  # USC223 (c)(2)(A) "$1,000 ... twice ...", "$5,000 ... twice ..."; read 2026-10-31
HSA_STATUTE_BASE = {'self': 2250, 'family': 4500}  # USC223 (b)(2)(A)-(B) monthly limitation "1/12 of ... $2,250 ... $4,500"; read 2026-10-31
BRONZE_CATASTROPHIC_ARE_HDHP_FROM = '2026-01-01'  # USC223 (c)(2)(H) added by Pub. L. 119-21 s.71307(a): Exchange bronze and catastrophic plans "shall include"; s.71307(b) "months beginning after December 31, 2025"; read 2026-10-31


def hdhp_out_of_pocket(bills, deductible, coinsurance, oop_max):
    """Page formula: min(oopMax, min(m, deductible) + coinsurance x max(0, m - deductible)). Exact.

    No law fixes this shape; it is the page's model of a plan with a deductible, then coinsurance, then an
    out-of-pocket cap (USC223 (c)(2)(A)(ii) only limits "the sum of the annual deductible and the other annual
    out-of-pocket expenses"). coinsurance is the member's share (0.2 = 20%).
    """
    m, ded, c, cap = _F(bills), _F(deductible), _F(coinsurance), _F(oop_max)
    if m < 0 or not (0 <= c <= 1):
        raise ValueError('bills >= 0 and 0 <= coinsurance <= 1')
    return min(cap, min(m, ded) + c * max(F(0), m - ded))


def hsa_eligible(deductible, oop_max, coverage, year, embedded_deductible=None, exchange_bronze_or_catastrophic=False):
    """(qualifies as an HDHP, reason). Inclusive on both lines: "not less than" the minimum, "does not exceed" the maximum.

    For family coverage, an individual (embedded) deductible below the family minimum disqualifies the plan (P969:
    "If either the deductible for the family as a whole or the deductible for an individual family member is less than the
    minimum annual deductible for family coverage, the plan doesn't qualify as an HDHP"). From 2026 an Exchange bronze
    or catastrophic plan counts whatever its numbers (USC223 (c)(2)(H)).
    """
    if exchange_bronze_or_catastrophic and year >= 2026:
        return True, 'Exchange bronze or catastrophic plan (26 U.S.C. 223(c)(2)(H))'
    min_ded, max_oop = HDHP[year][coverage]
    ded, oop = _F(deductible), _F(oop_max)
    if ded < min_ded:
        return False, 'deductible under the minimum'
    if coverage == 'family' and embedded_deductible is not None and _F(embedded_deductible) < min_ded:
        return False, 'individual deductible inside the family plan under the family minimum'
    if oop > max_oop:
        return False, 'out-of-pocket maximum over the limit'
    return True, ''


def hsa_limit(coverage, year, age_55_or_older=False, months=12):
    """Annual HSA contribution limit: the indexed limit, + $1,000 at 55 or older, prorated by eligible months
    (USC223 (b)(1)-(2) monthly 1/12; the last-month rule of (b)(8) is not modelled). Exact Fraction."""
    base = _F(HSA_LIMIT[year][coverage]) + (HSA_CATCH_UP_55 if age_55_or_older else 0)
    return base * months / MONTHS_PER_YEAR


# =====================================================================================================
# Checks
# =====================================================================================================
def check_tables():
    """Cross-check the figures against each other and against the agencies' own worked numbers."""
    # Poverty tables: uniform steps, as the notices say ("add $X for each additional person").
    for year, regions in POVERTY.items():
        for region, (table, extra) in regions.items():
            for i, amount in enumerate(table):
                assert amount == table[0] + extra * i, (year, region, i)
            assert poverty_guideline(year, 9, region) == table[-1] + extra
    assert poverty_guideline(2025, 4) == 32150 and poverty_guideline(2026, 4) == 33000
    assert poverty_guideline(2024, 11) == 68860  # I8962 Table 1-1 note: "Multiply $5,380 by 3 and add the result of $16,140 to $52,720 ... $68,860"
    assert [poverty_year_for_coverage(y) for y in (2025, 2026, 2027)] == [2024, 2025, 2026]

    # Applicable percentage tables: contiguous bands; continuous at 150/200/250/300 (initial = previous final) in every
    # law table; the only jump is at 133%.
    for year, t in AP_LAW.items():
        assert [r[0] for r in t] == [0, 133, 150, 200, 250, 300] and [r[1] for r in t] == [133, 150, 200, 250, 300, 400]
        for k in range(2, len(t)):
            assert _F(t[k][2]) == _F(t[k - 1][3]), (year, k)
        assert _F(t[1][2]) > _F(t[0][3])
        below, at = applicable_percentage(F(13299, 100), t), applicable_percentage(133, t)
        assert below == _F(t[0][2]) and at == _F(t[1][2])
        assert applicable_percentage(400, t) == _F(t[-1][3]) and applicable_percentage(F(40001, 100), t) is None
    for k in range(1, len(AP_ENHANCED)):
        assert _F(AP_ENHANCED[k][2]) == _F(AP_ENHANCED[k - 1][3])
    assert applicable_percentage(1000, AP_ENHANCED, has_cliff=False) == F(85, 10)
    assert _F(REQUIRED_CONTRIBUTION_PCT[2026]) == _F(AP_LAW[2026][-1][3]) and _F(REQUIRED_CONTRIBUTION_PCT[2027]) == _F(AP_LAW[2027][-1][3])

    # CFR36B3 (g)(3) Example 1: 275% on the base table -> 8.78 (8.775 rounded; truncation would give 8.77).
    assert applicable_percentage(275, AP_LAW[2014], rounded=False) == F(8775, 1000)
    assert applicable_percentage(275, AP_LAW[2014]) == F(878, 100)
    # Example 2: 210% -> (210 - 200) / 50 = .20; .20 x 1.75 = .35; 6.3 + .35 = 6.65.
    assert applicable_percentage(210, AP_LAW[2014]) == F(665, 100)

    # I8962 (2025) Table 2, rebuilt for every line-5 value 150..399 from the 2021-2025 table with half-up rounding to
    # 0.01%. Half-even would miss 25 rows (301 -> 6.025% -> 0.0602, but the IRS prints 0.0603), truncation 50 rows.
    assert len(I8962_2025_TABLE2) == 4 * 250
    for n in range(150, 400):
        assert applicable_percentage(n, AP_ENHANCED, has_cliff=False) / 100 == i8962_2025_figure(n), n
    assert applicable_percentage(301, AP_ENHANCED, False, rounded=False) == F(6025, 1000) and i8962_2025_figure(301) == F(603, 10000)

    # Age curve: 0-14 one band at 0.765, 64+ at 3.000, adults 21-64 within 3:1 (CFR147 (a)(1)(iii)), never decreasing.
    ages = list(range(0, 80))
    fs = [age_factor(a) for a in ages]
    assert all(fs[i] <= fs[i + 1] for i in range(len(fs) - 1))
    assert age_factor(14) == F(765, 1000) and age_factor(64) == age_factor(99) == 3 and age_factor(21) == 1
    assert age_factor(64) / age_factor(21) == 3 and _F(AGE_FACTOR_40) == F(1278, 1000)
    assert len(AGE_CURVE) == 1 + 6 + 43 + 1   # 0-14, 15-20, 21-63, 64+ (CFR147 (d))
    # 3-oldest-children cap: four kids 3, 7, 12, 16 -> the 3-year-old is not counted; a 22-year-old child always counts.
    assert counted_factors((), (3, 7, 12, 16)) == [age_factor(16), age_factor(12), age_factor(7)]
    assert len(counted_factors((), (3, 7, 12, 16), child_cap=False)) == 4
    assert len(counted_factors((40,), (22, 3, 7, 12, 16))) == 5

    # IRMAA: published amounts rebuilt from the statute's shape (FRB26 actuarial rate and repayment amounts, 10-cent
    # rounding of USC1395R (a)(3)); Part B IRMAA = total - standard; Part D from the $38.99 base premium.
    ar = _F(PART_B_AGED_ACTUARIAL_RATE[2026])
    std = _F(PART_B_STANDARD[2026])
    assert ar / 2 + _F(FRB26_REPAYMENT[0]) == std
    single = IRMAA[2026]['single']
    for level in range(6):
        b_total, b_irmaa, d_irmaa = (_F(x) for x in single[level][2:])
        built = round_half_up(2 * ar * F(IRMAA_APPLICABLE_PCT[level], 100) + _F(FRB26_REPAYMENT[level]), DIME)
        assert built == b_total, (level, built, b_total)
        assert b_total - std == b_irmaa
        d_built = round_half_up(_F(PART_D_BASE_BENEFICIARY_PREMIUM[2026]) * (IRMAA_APPLICABLE_PCT[level] - PART_D_IRMAA_BASE_PCT)
                                / PART_D_IRMAA_BASE_PCT, DIME) if level else F(0)
        assert d_built == d_irmaa, (level, d_built, d_irmaa)
    # Joint lines = twice the single lines, except the top line = 150% of $500,000 (USC1395R (i)(3)(C)(ii)); married
    # filing separately = the single lines minus the $109,000 threshold, so only $391,000 = 500,000 - 109,000 is left.
    joint = IRMAA[2026]['joint']
    for k in range(4):
        assert joint[k][0] == 2 * single[k][0] and joint[k][2:] == single[k][2:]
    assert joint[4][0] == single[4][0] * 3 // 2 == 750000 and joint[4][2:] == single[4][2:] and joint[5][2:] == single[5][2:]
    mfs = IRMAA[2026]['mfs']
    assert mfs[0][0] == single[0][0] and mfs[1][0] == single[4][0] - single[0][0] == 391000
    assert mfs[1][2:] == single[4][2:] and mfs[2][2:] == single[5][2:]
    for t in IRMAA[2026].values():   # USC1395R (i)(5)(B): indexed lines are whole thousands
        assert all(r[0] % 1000 == 0 for r in t if r[0] is not None)
    # Boundaries: at a "less than or equal" line you stay; at $500,000 the law moves you up, the page's rule does not.
    assert irmaa_row(109000, 'single')[0] == 0 and irmaa_row(109001, 'single')[0] == 1
    assert irmaa_row(205000, 'single')[0] == 3 and irmaa_row(F(20500001, 100), 'single')[0] == 4
    assert irmaa_row(500000, 'single')[0] == 5 and irmaa_row(500000, 'single', at_or_under=True)[0] == 4
    assert irmaa_row(750000, 'joint')[0] == 5 and irmaa_row(391000, 'mfs')[0] == 5 and irmaa_row(109001, 'mfs')[0] == 4
    assert irmaa_row(150000, 'mfs_apart')[0] == irmaa_row(150000, 'single')[0] == 2

    # HSA / HDHP: family = twice self-only for the HDHP lines (USC223 (c)(2)(A) "twice"), every indexed figure a
    # multiple of $50 (USC223 (g)(2)), and each year at least the statute's base amount.
    for year in HDHP:
        for i in range(2):
            assert HDHP[year]['family'][i] == 2 * HDHP[year]['self'][i]
        for cov in ('self', 'family'):
            assert all(x % HSA_INDEX_ROUNDING == 0 for x in HDHP[year][cov] + (HSA_LIMIT[year][cov],))
            assert HDHP[year][cov][0] >= HDHP_STATUTE_BASE[cov][0] and HDHP[year][cov][1] >= HDHP_STATUTE_BASE[cov][1]
            assert HSA_LIMIT[year][cov] >= HSA_STATUTE_BASE[cov]
    assert hsa_eligible(1700, 8500, 'self', 2026) == (True, '') and hsa_eligible(1699, 8500, 'self', 2026)[0] is False
    assert hsa_eligible(1700, 8501, 'self', 2026)[0] is False and hsa_eligible(1750, 8501, 'self', 2027)[0] is True
    assert hsa_eligible(1700, 8500, 'self', 2027) == (False, 'deductible under the minimum')
    assert hsa_eligible(4000, 12000, 'family', 2026, embedded_deductible=2000)[0] is False
    assert hsa_eligible(500, 9200, 'self', 2026, exchange_bronze_or_catastrophic=True)[0] is True

    _check_examples()


# ---- RULES.md worked examples (invented households) ----------------------------------------------
def _check_examples():
    # Marketplace, coverage year 2026, two adults 45 and 43, household income $50,000, benchmark for a 40-year-old $500 a month.
    bench = benchmark_annual(500, (45, 43))
    assert bench == F(12 * 500) * (F(1444, 1000) + F(1357, 1000)) / F(1278, 1000)
    assert show(bench) == D('13150.23')
    r = premium_tax_credit(50000, 2, bench, 2026)
    assert r['fpl_year'] == 2025 and r['fpl'] == 21150
    assert show(r['pct_of_fpl'], F(1, 10000)) == D('236.4066')
    assert r['applicable_pct'] == F(794, 100) and r['contribution'] == 3970
    assert show(r['credit']) == D('9180.23')
    e = premium_tax_credit(50000, 2, bench, 2026, rules='enhanced')
    assert e['applicable_pct'] == F(346, 100) and e['contribution'] == 1730 and show(e['credit']) == D('11420.23')
    f = premium_tax_credit(50000, 2, bench, 2026, method='form')
    assert f['pct_of_fpl'] == 236 and f['applicable_pct'] == F(792, 100) and f['contribution'] == 3960
    assert f['benchmark'] == 13150 and f['credit'] == 9190 and form_monthly_contribution(3960) == 330
    # The cliff: same family at $90,000 (425.53%): law none, enhanced 8.5% x 90,000 = 7,650.
    c = premium_tax_credit(90000, 2, bench, 2026)
    assert c['eligible'] is False and c['credit'] == 0
    ce = premium_tax_credit(90000, 2, bench, 2026, rules='enhanced')
    assert ce['contribution'] == 7650 and show(ce['credit']) == D('5500.23')
    # Exactly 400% ($84,600 = 4 x 21,150) keeps the credit; one dollar more loses it.
    assert premium_tax_credit(84600, 2, bench, 2026)['applicable_pct'] == F(996, 100)
    assert premium_tax_credit(84601, 2, bench, 2026)['credit'] == 0
    assert premium_tax_credit(84601, 2, bench, 2026, method='form')['pct_of_fpl'] == 401
    # Coverage year 2027 uses the 2026 guideline and RP2626.
    r27 = premium_tax_credit(50000, 2, bench, 2027)
    assert r27['fpl'] == 21640 and r27['applicable_pct'] == round_half_up(F(678, 100) + (F(866, 100) - F(678, 100)) * (100 * F(50000, 21640) - 200) / 50, BASIS_POINT)

    # Medicare 2026: joint, MAGI (2024) $300,000, both on Medicare: tier "> 274,000 and <= 342,000".
    assert irmaa_monthly(300000, 'joint') == (F(20290, 100), F(3750, 100))
    assert irmaa_surcharge_annual(300000, 'joint', people=2) == F(576960, 100)
    # Single exactly $500,000: law top tier (487.00 + 91.00) x 12 = 6,936.00; an "at or under" reading of that line gives 6,355.20.
    assert irmaa_surcharge_annual(500000, 'single') == 6936
    assert irmaa_surcharge_annual(500000, 'single', at_or_under=True) == F(635520, 100)

    # High-deductible plan: deductible 3,000, 20% coinsurance, out-of-pocket cap 6,000.
    assert [hdhp_out_of_pocket(m, 3000, '0.2', 6000) for m in (2000, 3000, 10000, 18000, 30000)] == [2000, 3000, 4400, 6000, 6000]
    assert hsa_eligible(3000, 6000, 'self', 2026) == (True, '')
    assert hsa_limit('self', 2026) == 4400 and hsa_limit('self', 2026, age_55_or_older=True) == 5400
    assert hsa_eligible(3000, 6000, 'family', 2026) == (False, 'deductible under the minimum')
    assert hsa_limit('family', 2027) == 9000 and hsa_limit('self', 2026, months=6) == 2200


check_tables()
