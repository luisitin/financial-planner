"""Figures for the business answer keys (sole proprietor, S corporation, retirement plans), as data.

Written from the primary sources below, never from the app's code. Every figure names its source
on the same line. Money is Decimal; rates are Decimal fractions. The income tax brackets, the
standard deduction, the qualified-dividend rate tops and the AMT figures are imported from the
audited career key (tools/golden_career/rules.py), which cross-checks itself when it loads.

Sources (all read 2026-10-30):
  SE25   Schedule SE (Form 1040) 2025                         https://www.irs.gov/pub/irs-pdf/f1040sse.pdf
  SE26   Schedule SE (Form 1040) 2026, draft                  https://www.irs.gov/pub/irs-dft/f1040sse--dft.pdf
  SSA26  SSA 2026 COLA fact sheet (bases 2025 and 2026)       https://www.ssa.gov/news/en/cola/factsheets/2026.html
  P15    Publication 15 (2026), Circular E                    https://www.irs.gov/pub/irs-pdf/p15.pdf
  F7206  Form 7206 (2025) and instructions                    https://www.irs.gov/pub/irs-pdf/f7206.pdf , .../i7206.pdf
  F8959  Form 8959 (2025)                                     https://www.irs.gov/pub/irs-pdf/f8959.pdf
  F8960  Form 8960 (2025) and instructions                    https://www.irs.gov/pub/irs-pdf/f8960.pdf , .../i8960.pdf
  S8812  Schedule 8812 (2025) and instructions                https://www.irs.gov/pub/irs-pdf/f1040s8.pdf , .../i1040s8.pdf
  D8812  Schedule 8812 (2026), draft of 2026-04-24             https://www.irs.gov/pub/irs-dft/f1040s8--dft.pdf
  F8995  Form 8995 (2025) and instructions                    https://www.irs.gov/pub/irs-pdf/f8995.pdf , .../i8995.pdf
  D8995  Form 8995 (2026), draft of 2026-05-01, and draft instructions
                                                              https://www.irs.gov/pub/irs-dft/f8995--dft.pdf , .../i8995--dft.pdf
  RP24   Rev. Proc. 2024-40 (tax year 2025)                   https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
  RP25   Rev. Proc. 2025-32 (tax year 2026)                   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
  N2480  Notice 2024-80 (2025 retirement plan limits)         https://www.irs.gov/pub/irs-drop/n-24-80.pdf
  N2567  Notice 2025-67 (2026 retirement plan limits)         https://www.irs.gov/pub/irs-drop/n-25-67.pdf
  P560   Publication 560 (2025)                               https://www.irs.gov/pub/irs-pdf/p560.pdf
  TD10033 T.D. 10033, final catch-up regulations (2025-09)    https://public-inspection.federalregister.gov/2025-17865.pdf
  N0801  Notice 2008-1 (2% shareholder health insurance)      https://www.irs.gov/pub/irs-drop/n-08-01.pdf
  IRC    26 U.S.C. (current text with the 2025 amendments)   https://www.law.cornell.edu/uscode/text/26/<section>
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import importlib.util
from decimal import Decimal as D
from pathlib import Path


def _load_career_rules():
    """tools/golden_career/rules.py under its own module name (both files are called rules.py)."""
    path = Path(__file__).resolve().parents[1] / 'golden_career' / 'rules.py'
    spec = importlib.util.spec_from_file_location('golden_career_rules', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CAREER = _load_career_rules()  # audited: brackets, standard deduction, gain tops, AMT figures

STATUSES = CAREER.STATUSES
YEARS = CAREER.YEARS
RATES = CAREER.RATES
BRACKET_TOPS = CAREER.BRACKET_TOPS          # RP24 s.2.01 / RP25 s.4.01 (via career key)
BRACKET_BASES = CAREER.BRACKET_BASES        # same tables, "tax is $X plus" column (via career key)
STANDARD_DEDUCTION = CAREER.STANDARD_DEDUCTION  # OBBBA s.70102 (2025) / RP25 s.4.14 (2026) (via career key)
GAIN_TOPS = CAREER.GAIN_TOPS                # RP24 s.2.03 / RP25 s.4.03 (via career key)

# ---- Self-employment tax (IRC 1401, 1402; Schedule SE) ---------------------------------------
SS_WAGE_BASE = {2025: D(176100), 2026: D(184500)}  # SE25 line 7; SE26 line 7; SSA26; P15 (2026) "wage base limit is $184,500"
SE_OASDI_RATE = D('0.124')        # IRC 1401(a); SE25 line 10
SE_HI_RATE = D('0.029')           # IRC 1401(b)(1); SE25 line 11
SE_NET_FACTOR = D('0.9235')       # SE25 line 4a; = 1 - one-half of 15.3% (IRC 1402(a)(12))
SE_1402A12_SHARE = D('0.5')       # IRC 1402(a)(12)(B): one-half of the 1401(a) + 1401(b)(1) rates
SE_MIN_NET_EARNINGS = D(400)      # IRC 1402(b)(2); SE25 line 4c "If less than $400, stop"
SE_DEDUCTION_SHARE = D('0.5')     # IRC 164(f)(1); SE25 line 13; Schedule 1 line 15

# ---- FICA on wages (IRC 3101, 3111; Publication 15) ------------------------------------------
EMPLOYEE_OASDI_RATE = D('0.062')  # IRC 3101(a); P15 (2026) "6.2% each for the employee and employer"
EMPLOYER_OASDI_RATE = D('0.062')  # IRC 3111(a); P15 (2026)
EMPLOYEE_HI_RATE = D('0.0145')    # IRC 3101(b)(1); P15 (2026) "1.45% each"
EMPLOYER_HI_RATE = D('0.0145')    # IRC 3111(b); P15 (2026)

# ---- Additional Medicare tax (IRC 3101(b)(2), 1401(b)(2); Form 8959) -------------------------
ADDL_MEDICARE_RATE = D('0.009')   # IRC 3101(b)(2), 1401(b)(2)(A); F8959 lines 7 and 13
ADDL_MEDICARE_THRESHOLD = {       # IRC 3101(b)(2)(A)-(C); F8959 lines 5 and 9 (not indexed)
    'married_joint': D(250000), 'married_separate': D(125000),
    'single': D(200000), 'head_of_household': D(200000),
}

# ---- Net investment income tax (IRC 1411; Form 8960) -----------------------------------------
NIIT_RATE = D('0.038')            # IRC 1411(a)(1); F8960 line 17
NIIT_THRESHOLD = {                # IRC 1411(b); F8960 line 14 and its instructions (not indexed)
    'married_joint': D(250000), 'married_separate': D(125000),
    'single': D(200000), 'head_of_household': D(200000),
}

# ---- Child tax credit (IRC 24; Schedule 8812) ------------------------------------------------
CTC_PER_CHILD = {2025: D(2200), 2026: D(2200)}   # IRC 24(h)(2) as amended by OBBBA s.70104; S8812 line 5; RP25 s.2.03, s.4.05(1); D8812 line 5
ACTC_PER_CHILD = {2025: D(1700), 2026: D(1700)}  # IRC 24(h)(5); RP24 s.2.05; RP25 s.4.05(2); S8812 / D8812 line 16b
CTC_PHASEOUT_START = {            # IRC 24(h)(3); S8812 line 9
    'married_joint': D(400000), 'married_separate': D(200000),
    'single': D(200000), 'head_of_household': D(200000),
}
CTC_PHASEOUT_STEP = D(1000)       # IRC 24(b)(1) "each $1,000 (or fraction thereof)"; S8812 line 10
CTC_PHASEOUT_PER_STEP = D(50)     # IRC 24(b)(1) "$50"; S8812 line 11 (5% of the rounded-up excess)
ACTC_EARNED_FLOOR = D(2500)       # IRC 24(h)(6); S8812 line 19
ACTC_RATE = D('0.15')             # IRC 24(d)(1)(B)(i); S8812 line 20
ACTC_PART_IIB_FROM = D(5100)      # S8812 / D8812 line 20 "Next: is line 16b $5,100 or more?" (3+ children; never reached: 0-2 kids)

# ---- Qualified business income deduction (IRC 199A; Form 8995) -------------------------------
QBI_RATE = D('0.20')              # IRC 199A(a)(2), (b)(2)(A); F8995 lines 5 and 14
QBI_THRESHOLD = {
    2025: {'single': D(197300), 'head_of_household': D(197300), 'married_separate': D(197300),
           'married_joint': D(394600)},   # RP24 s.2.27; F8995 (2025) header
    2026: {'single': D(201750), 'head_of_household': D(201750), 'married_separate': D(201775),
           'married_joint': D(403500)},   # RP25 s.4.26; D8995 (2026) header
}
QBI_MIN_DEDUCTION = {2025: None, 2026: D(400)}   # IRC 199A(i)(1)(B), OBBBA s.70105(b), from tax years after 2025 (s.70105(c)); RP25 s.2.12; D8995 lines 16-17
QBI_MIN_ACTIVE_QBI = {2025: None, 2026: D(1000)} # IRC 199A(i)(2)(A); D8995 instructions "Line 17": aggregate QBI of materially participated businesses >= $1,000

# ---- Retirement plans (IRC 401(a)(17), 402(g), 404, 408(p), 414(v), 415(c); Publication 560) --
LIMIT_415C = {2025: D(70000), 2026: D(72000)}          # IRC 415(c)(1)(A); N2480; N2567; P560 Deduction Worksheet step 8
COMP_LIMIT_401A17 = {2025: D(350000), 2026: D(360000)} # IRC 401(a)(17), 404(l); N2480; N2567; P560 worksheet step 6
LIMIT_402G = {2025: D(23500), 2026: D(24500)}          # IRC 402(g)(1)(B); N2480; N2567; P560 worksheet step 9, ch. 4 "Limit on Elective Deferrals"
CATCHUP_401K = {2025: D(7500), 2026: D(8000)}          # IRC 414(v)(2)(B)(i); N2480; N2567; P560 ch. 4
CATCHUP_401K_60_63 = {2025: D(11250), 2026: D(11250)}  # IRC 414(v)(2)(E)(i); N2480; N2567; P560 "What's New"
SEP_PLAN_RATE = D('0.25')         # IRC 402(h)(2)(A), 404(a)(3)(A)(i)(I), 404(h)(1)(C): 25% of compensation
SE_REDUCED_RATE = D('0.20')       # P560 Rate Table for Self-Employed: 25% -> 0.200000 (= 0.25 / 1.25)
SIMPLE_DEFERRAL_SMALL = {2025: D(17600), 2026: D(18100)}   # IRC 408(p)(2)(E)(i)(I), (ii); N2480 ("remains $17,600"); N2567 ("$18,100"); P560 ch. 3
SIMPLE_DEFERRAL_GENERAL = {2025: D(16500), 2026: D(17000)} # IRC 408(p)(2)(E)(i)(III); N2480; N2567 (reference only: the key assumes the small-employer limit)
SIMPLE_CATCHUP_SMALL = {2025: D(3850), 2026: D(3850)}      # IRC 414(v)(2)(B)(iii); N2480; N2567 ("remains $3,850"); P560 "What's New"
SIMPLE_CATCHUP_GENERAL = {2025: D(3500), 2026: D(4000)}    # IRC 414(v)(2)(B)(ii); N2480; N2567 (reference only)
SIMPLE_CATCHUP_60_63 = {2025: D(5250), 2026: D(5250)}      # IRC 414(v)(2)(E)(ii); N2480; N2567; P560 ch. 3; TD10033: a 110% plan may give this instead at ages 60-63
SIMPLE_MATCH_RATE = D('0.03')     # IRC 408(p)(2)(A)(iii), (C)(ii); P560 ch. 3 "Employer matching contributions"
CATCHUP_AGE = 50                  # IRC 414(v)(5)(A): attains age 50 by the end of the taxable year
SUPER_CATCHUP_AGES = (60, 63)     # IRC 414(v)(2)(B)(i), (ii): "attain age 60 but would not attain age 64" by year end


def check_tables():
    """Cross-check the figures against each other; raises on any typo."""
    half_rate = (SE_OASDI_RATE + SE_HI_RATE) * SE_1402A12_SHARE
    assert SE_NET_FACTOR == 1 - half_rate, SE_NET_FACTOR                       # 92.35% = 1 - 7.65%
    assert SE_OASDI_RATE == EMPLOYEE_OASDI_RATE + EMPLOYER_OASDI_RATE           # 12.4% = 6.2% x 2
    assert SE_HI_RATE == EMPLOYEE_HI_RATE + EMPLOYER_HI_RATE                    # 2.9% = 1.45% x 2
    assert SE_REDUCED_RATE == SEP_PLAN_RATE / (1 + SEP_PLAN_RATE)               # P560 rate worksheet
    for year in YEARS:
        # P560 step 6 (25% x the 401(a)(17) limit) is above the 415(c) dollar limit, so it never binds.
        assert SEP_PLAN_RATE * COMP_LIMIT_401A17[year] > LIMIT_415C[year]
        # 414(v)(2)(E)(ii): the greater of $5,000 or 150% of the 2025 (B)(ii) amount.
        assert SIMPLE_CATCHUP_60_63[year] == max(D(5000), D('1.5') * SIMPLE_CATCHUP_GENERAL[2025])
        # 414(v)(2)(E)(i): the greater of $10,000 or 150% of the 2024 (B)(i) amount (7,500).
        assert CATCHUP_401K_60_63[year] == max(D(10000), D('1.5') * D(7500))
        # 408(p)(2)(E)(ii) and 414(v)(2)(B)(iii): 110% of the 2024 amounts (16,000 and 3,500) for 2025.
        assert SIMPLE_DEFERRAL_SMALL[2025] == D('1.1') * D(16000)
        assert SIMPLE_CATCHUP_SMALL[2025] == D('1.1') * D(3500)
        for s in STATUSES:
            assert QBI_THRESHOLD[year][s] > 0 and ADDL_MEDICARE_THRESHOLD[s] == NIIT_THRESHOLD[s]
    assert ACTC_PART_IIB_FROM == 3 * ACTC_PER_CHILD[2025] == 3 * ACTC_PER_CHILD[2026]


check_tables()
