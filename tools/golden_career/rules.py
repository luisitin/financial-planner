"""Tax figures for the career answer keys (AMT and ESPP), as data only.

Written from the primary sources below, never from the app's code. Every figure
names its source on the same line. Money is Decimal; rates are Decimal fractions.

Sources (all read 2026-10-30):
  RP24   Rev. Proc. 2024-40 (tax year 2025)      https://www.irs.gov/pub/irs-drop/rp-24-40.pdf
  RP25   Rev. Proc. 2025-32 (tax year 2026)      https://www.irs.gov/pub/irs-drop/rp-25-32.pdf
  OBBBA  Pub. L. 119-21 of 2025-07-04 (the July 2025 law); RP25 s.2.07 and s.2.08 summarise
         s.70107 (AMT) and s.70102 (2025 standard deduction)
  F6251  Form 6251 (2025)                        https://www.irs.gov/pub/irs-pdf/f6251.pdf
  I6251  Instructions for Form 6251 (2025)       https://www.irs.gov/pub/irs-pdf/i6251.pdf
  D6251  Form 6251 (2026) draft of 2026-05-26    https://www.irs.gov/pub/irs-dft/f6251--dft.pdf
  IRC55  26 U.S.C. 55 as amended by OBBBA        https://www.law.cornell.edu/uscode/text/26/55
  IRC56  26 U.S.C. 56                            https://www.law.cornell.edu/uscode/text/26/56
"""
from decimal import Decimal as D

STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
YEARS = (2025, 2026)

# Ordinary brackets: (top of bracket, rate); the 37% bracket has no top (None).
RATES = (D('0.10'), D('0.12'), D('0.22'), D('0.24'), D('0.32'), D('0.35'), D('0.37'))

BRACKET_TOPS = {
    2025: {  # RP24 s.3.01 Tables 1-4 (OBBBA left the 2025 brackets unchanged)
        'single':            (11925, 48475, 103350, 197300, 250525, 626350),   # RP24 s.3.01 Table 3
        'married_joint':     (23850, 96950, 206700, 394600, 501050, 751600),   # RP24 s.3.01 Table 1
        'married_separate':  (11925, 48475, 103350, 197300, 250525, 375800),   # RP24 s.3.01 Table 4
        'head_of_household': (17000, 64850, 103350, 197300, 250500, 626350),   # RP24 s.3.01 Table 2
    },
    2026: {
        'single':            (12400, 50400, 105700, 201775, 256225, 640600),   # RP25 s.4.01 Table 3
        'married_joint':     (24800, 100800, 211400, 403550, 512450, 768700),  # RP25 s.4.01 Table 1
        'married_separate':  (12400, 50400, 105700, 201775, 256225, 384350),   # RP25 s.4.01 Table 4
        'head_of_household': (17700, 67450, 105700, 201750, 256200, 640600),   # RP25 s.4.01 Table 2
    },
}

# The "tax is $X plus N% of the excess over $Y" amounts printed in the same tables. Used only
# by the second derivation in amt_key.py (a check on the bracket tops above, typed separately).
BRACKET_BASES = {
    2025: {
        'single':            ('0', '1192.50', '5578.50', '17651', '40199', '57231', '188769.75'),  # RP24 s.3.01 Table 3
        'married_joint':     ('0', '2385', '11157', '35302', '80398', '114462', '202154.50'),      # RP24 s.3.01 Table 1
        'married_separate':  ('0', '1192.50', '5578.50', '17651', '40199', '57231', '101077.25'),  # RP24 s.3.01 Table 4
        'head_of_household': ('0', '1700', '7442', '15912', '38460', '55484', '187031.50'),        # RP24 s.3.01 Table 2
    },
    2026: {
        'single':            ('0', '1240', '5800', '17966', '41024', '58448', '192979.25'),        # RP25 s.4.01 Table 3
        'married_joint':     ('0', '2480', '11600', '35932', '82048', '116896', '206583.50'),      # RP25 s.4.01 Table 1
        'married_separate':  ('0', '1240', '5800', '17966', '41024', '58448', '103291.75'),        # RP25 s.4.01 Table 4
        'head_of_household': ('0', '1770', '7740', '16155', '39207', '56631', '191171'),           # RP25 s.4.01 Table 2
    },
}

STANDARD_DEDUCTION = {
    # OBBBA s.70102 (IRC 63(c)(7) as amended), restated in RP25 s.2.08; replaces RP24 s.3.15
    2025: {'single': 15750, 'married_joint': 31500, 'married_separate': 15750, 'head_of_household': 23625},
    # RP25 s.4.14(1)
    2026: {'single': 16100, 'married_joint': 32200, 'married_separate': 16100, 'head_of_household': 24150},
}

# Long-term gain and qualified dividend rate tops: (0% up to, 15% up to); 20% above.
GAIN_TOPS = {
    2025: {  # RP24 s.3.03
        'single': (48350, 533400), 'married_joint': (96700, 600050),
        'married_separate': (48350, 300000), 'head_of_household': (64750, 566700),
    },
    2026: {  # RP25 s.4.03
        'single': (49450, 545500), 'married_joint': (98900, 613700),
        'married_separate': (49450, 306850), 'head_of_household': (66200, 579600),
    },
}

# ---- Alternative minimum tax (IRC 55) -------------------------------------------------------
AMT_EXEMPTION = {
    2025: {'single': 88100, 'married_joint': 137000, 'married_separate': 68500, 'head_of_household': 88100},  # RP24 s.3.11; F6251 line 5
    2026: {'single': 90100, 'married_joint': 140200, 'married_separate': 70100, 'head_of_household': 90100},  # RP25 s.4.10; D6251 line 5
}
AMT_PHASEOUT_START = {
    2025: {'single': 626350, 'married_joint': 1252700, 'married_separate': 626350, 'head_of_household': 626350},  # RP24 s.3.11
    2026: {'single': 500000, 'married_joint': 1000000, 'married_separate': 500000, 'head_of_household': 500000},  # RP25 s.4.10; IRC55(d)(4)(A)(ii)
}
AMT_PHASEOUT_RATE = {
    2025: D('0.25'),  # IRC55(d)(2); I6251 Exemption Worksheet line 5
    2026: D('0.50'),  # OBBBA s.70107(c), IRC55(d)(4)(A)(ii)(IV); RP25 s.4.10 complete phase-out 1,280,400 = 1,000,000 + 2 x 140,200
}
# Complete phase-out points printed in the Rev. Procs (a check on start + exemption / rate).
AMT_PHASEOUT_END = {
    2025: {'single': 978750, 'married_joint': 1800700, 'married_separate': 900350, 'head_of_household': 978750},  # RP24 s.3.11
    2026: {'single': 680200, 'married_joint': 1280400, 'married_separate': 640200, 'head_of_household': 680200},  # RP25 s.4.10
}
# The 28% rate applies to the taxable excess above this amount (IRC 55(b)(1)).
AMT_28_FROM = {
    2025: {'single': 239100, 'married_joint': 239100, 'married_separate': 119550, 'head_of_household': 239100},  # RP24 s.3.11; F6251 line 7
    2026: {'single': 244500, 'married_joint': 244500, 'married_separate': 122250, 'head_of_household': 244500},  # RP25 s.4.10; D6251 line 7
}
# Amount subtracted after multiplying by 28% (= 2% of the breakpoint), as printed on the form.
AMT_28_SUBTRACT = {
    2025: {'single': 4782, 'married_joint': 4782, 'married_separate': 2391, 'head_of_household': 4782},  # F6251 lines 7, 18, 39
    2026: {'single': 4890, 'married_joint': 4890, 'married_separate': 2445, 'head_of_household': 4890},  # D6251 lines 7, 18, 39
}
AMT_RATE_LOW, AMT_RATE_HIGH = D('0.26'), D('0.28')  # IRC 55(b)(1)(A)(i)

# Married filing separately: line 4 is increased once AMTI passes the point where the exemption
# is zero (IRC 55(d)(2), last sentence). (rate, starting point, cap).
AMT_MFS_EXTRA = {
    # I6251 (2025) "Line 4": over 900,350 add 25% of the excess; at 1,174,350 or more add 68,500.
    2025: (D('0.25'), 900350, 68500),
    # D6251 line 4 says "more than $640,200, see instructions"; the 2026 instructions are not
    # published yet. Read literally, IRC 55(d)(4)(A)(ii)(IV) turns every "25 percent" in
    # 55(d)(2) into "50 percent", which would make it 50% of the excess up to 70,100, but no IRS
    # text confirms that. The key therefore never lets a 2026 separate return reach 640,200 of
    # AMTI (amt_key.py rejects and redraws such rows) and amt_key.py raises if it ever would.
    2026: (None, 640200, 70100),
}

# ---- Itemized deductions (only to keep the generator inside settled ground) ----------------
# State and local tax cap after OBBBA s.70120 (IRC 164(b)(7)): cap, phase-down start, floor.
# The key draws SALT at or under the floor (10,000; 5,000 married filing separately), so the
# cap never binds whatever the income; the figures are kept here for that guard.
SALT_CAP = {
    2025: {'married_separate': (20000, 250000, 5000), 'other': (40000, 500000, 10000)},  # OBBBA s.70120
    2026: {'married_separate': (20200, 252500, 5000), 'other': (40400, 505000, 10000)},  # OBBBA s.70120 (101% of 2025)
}
# 2026 itemized-deduction limitation, IRC 68 as rewritten by OBBBA s.70111: itemized deductions
# shrink by 2/37 of the smaller of themselves and (AGI here) over the start of the 37% bracket.
# IRC56(b)(1)(E): "Section 68 shall not apply" for the AMT, and D6251 has no line for it yet,
# so the key keeps every 2026 itemizer at or under the 37% start (the limitation is then zero).
LIMIT68_FRACTION = D(2) / D(37)
LIMIT68_START = {year: {s: BRACKET_TOPS[year][s][5] for s in STATUSES} for year in YEARS}  # 37% bracket start


def check_tables():
    """Cross-check the tables against each other; raises on any typo."""
    for year in YEARS:
        rate = AMT_PHASEOUT_RATE[year]
        for s in STATUSES:
            tops = BRACKET_TOPS[year][s]
            bases = [D(b) for b in BRACKET_BASES[year][s]]
            running, lower = D(0), D(0)
            for i, top in enumerate(tops):
                assert running == bases[i], (year, s, i, running, bases[i])
                running += (D(top) - lower) * RATES[i]
                lower = D(top)
            assert running == bases[6], (year, s, 'top', running, bases[6])
            end = D(AMT_PHASEOUT_START[year][s]) + D(AMT_EXEMPTION[year][s]) / rate
            assert end == AMT_PHASEOUT_END[year][s], (year, s, end)
            assert D(AMT_28_SUBTRACT[year][s]) == D(AMT_28_FROM[year][s]) * D('0.02'), (year, s)
        assert AMT_MFS_EXTRA[year][1] == AMT_PHASEOUT_END[year]['married_separate']
        assert AMT_MFS_EXTRA[year][2] == AMT_EXEMPTION[year]['married_separate']


check_tables()
