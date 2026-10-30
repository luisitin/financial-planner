"""2026 paycheck figures for the paycheck answer keys, as data only.

Written from the primary IRS sources below, never from the app's code. Every figure names its
source and the date it was read on the same line. Money is a Decimal string; a percentage is a
whole-number string ("22" = 22%).

Sources (all downloaded from irs.gov and read 2026-10-30):
  P15T   Publication 15-T (2026), Federal Income Tax Withholding Methods, dated Dec 3, 2025
         https://www.irs.gov/pub/irs-pdf/p15t.pdf   (sha256 31b3e242...d306d3fb, 71 pages)
           p.9   "Rounding"
           p.10  Worksheet 1A (Employer's Withholding Worksheet for Percentage Method Tables for
                 Automated Payroll Systems), line 1g, and Table 3 (pay periods per year)
           p.12  2026 Percentage Method Tables for Automated Payroll Systems: the annual
                 "STANDARD Withholding Rate Schedules" and "Form W-4, Step 2, Checkbox,
                 Withholding Rate Schedules"
           p.57  Worksheet 4 (manual payroll systems, Forms W-4 from 2020 or later)
           pp.58-62  2026 Percentage Method Tables for Manual Payroll Systems With Forms W-4 from
                 2020 or Later: WEEKLY, BIWEEKLY, SEMIMONTHLY, MONTHLY, DAILY (used only by the
                 third check in withholding_key.py)
  P15    Publication 15 (2026), (Circular E) Employer's Tax Guide, dated Dec 15, 2025
         https://www.irs.gov/pub/irs-pdf/p15.pdf    (sha256 b46c3622...f804c88b, 59 pages)
           pp.1-2 What's New, "Social security and Medicare taxes for 2026" (6.2% p.1, the base p.2)
           p.29  section 9, "Tax rates and the social security wage base limit"
           pp.29-30  section 9, "Additional Medicare Tax withholding"
  ADMT   IRS "Questions and Answers for the Additional Medicare Tax" (page last reviewed
         25-Oct-2026), question "Will Additional Medicare Tax be withheld from an individual's
         wages?" https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax
  RP25   Rev. Proc. 2025-32 (tax year 2026), s.4.01 Tables 1-3 and s.4.14(1)
         https://www.irs.gov/pub/irs-drop/rp-25-32.pdf   (sha256 e9ada115...a96214635b)
         Used only to rebuild the annual tables a second way (statute_tables, check_tables).
"""
from decimal import Decimal as D
from fractions import Fraction as F

YEAR = 2026
STATUSES = ('single', 'married_joint', 'head_of_household')  # Form W-4 Step 1(c); "single" also covers married filing separately (P15T p.12 "Single or Married Filing Separately")

# Worksheet 1A line 1b: pay periods per year. Table 3 lists 2, 4, 12, 24, 26, 52 and 260.
PAY_PERIODS_TABLE_3 = (2, 4, 12, 24, 26, 52, 260)  # P15T p.10 Table 3; read 2026-10-30
PAY_PERIODS = (260, 52, 26, 24, 12, 4, 2, 1)       # the key also uses 1 (an annual payroll); see README

# Worksheet 1A line 1g: entered when the Step 2 box is NOT checked (0 when it is checked).
LINE_1G = {
    'married_joint':     D('12900'),  # P15T p.10 Worksheet 1A line 1g "enter $12,900 if the taxpayer is married filing jointly"; read 2026-10-30
    'single':            D('8600'),   # P15T p.10 Worksheet 1A line 1g "or $8,600 otherwise"; read 2026-10-30
    'head_of_household': D('8600'),   # P15T p.10 Worksheet 1A line 1g "or $8,600 otherwise"; read 2026-10-30
}

# 2026 Percentage Method Tables for Automated Payroll Systems (annual). Each row is
# (A "At least", B "But less than" (None on the last row), C "The tentative amount to withhold
# is", D "Plus this percentage"). Column E ("of the amount that the Adjusted Annual Wage
# exceeds") equals column A on every row of the printed table.
ANNUAL = {
    'standard': {
        'married_joint': (
            ('0', '19300', '0.00', '0'),                  # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('19300', '44100', '0.00', '10'),             # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('44100', '120100', '2480.00', '12'),         # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('120100', '230700', '11600.00', '22'),       # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('230700', '422850', '35932.00', '24'),       # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('422850', '531750', '82048.00', '32'),       # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('531750', '788000', '116896.00', '35'),      # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
            ('788000', None, '206583.50', '37'),          # P15T p.12, STANDARD, Married Filing Jointly; read 2026-10-30
        ),
        'single': (
            ('0', '7500', '0.00', '0'),                   # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('7500', '19900', '0.00', '10'),              # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('19900', '57900', '1240.00', '12'),          # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('57900', '113200', '5800.00', '22'),         # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('113200', '209275', '17966.00', '24'),       # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('209275', '263725', '41024.00', '32'),       # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('263725', '648100', '58448.00', '35'),       # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ('648100', None, '192979.25', '37'),          # P15T p.12, STANDARD, Single or Married Filing Separately; read 2026-10-30
        ),
        'head_of_household': (
            ('0', '15550', '0.00', '0'),                  # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('15550', '33250', '0.00', '10'),             # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('33250', '83000', '1770.00', '12'),          # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('83000', '121250', '7740.00', '22'),         # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('121250', '217300', '16155.00', '24'),       # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('217300', '271750', '39207.00', '32'),       # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('271750', '656150', '56631.00', '35'),       # P15T p.12, STANDARD, Head of Household; read 2026-10-30
            ('656150', None, '191171.00', '37'),          # P15T p.12, STANDARD, Head of Household; read 2026-10-30
        ),
    },
    'checkbox': {
        'married_joint': (
            ('0', '16100', '0.00', '0'),                  # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('16100', '28500', '0.00', '10'),             # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('28500', '66500', '1240.00', '12'),          # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('66500', '121800', '5800.00', '22'),         # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('121800', '217875', '17966.00', '24'),       # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('217875', '272325', '41024.00', '32'),       # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('272325', '400450', '58448.00', '35'),       # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ('400450', None, '103291.75', '37'),          # P15T p.12, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
        ),
        'single': (
            ('0', '8050', '0.00', '0'),                   # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('8050', '14250', '0.00', '10'),              # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('14250', '33250', '620.00', '12'),           # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('33250', '60900', '2900.00', '22'),          # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('60900', '108938', '8983.00', '24'),         # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('108938', '136163', '20512.00', '32'),       # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('136163', '328350', '29224.00', '35'),       # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ('328350', None, '96489.63', '37'),           # P15T p.12, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
        ),
        'head_of_household': (
            ('0', '12075', '0.00', '0'),                  # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('12075', '20925', '0.00', '10'),             # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('20925', '45800', '885.00', '12'),           # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('45800', '64925', '3870.00', '22'),          # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('64925', '112950', '8077.50', '24'),         # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('112950', '140175', '19603.50', '32'),       # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('140175', '332375', '28315.50', '35'),       # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
            ('332375', None, '95585.50', '37'),           # P15T p.12, Step 2 Checkbox, Head of Household; read 2026-10-30
        ),
    },
}

# 2026 Percentage Method Tables for Manual Payroll Systems With Forms W-4 from 2020 or Later,
# keyed by pay periods per year. Same layout; the amounts are per pay period. Used only by the
# third check (Worksheet 4), never to make the CSV.
PERIOD = {
    52: {  # P15T p.58, WEEKLY Payroll Period; read 2026-10-30
        'standard': {
            'married_joint': (
                ('0', '619', '0.00', '0'),                    # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('619', '1096', '0.00', '10'),                # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('1096', '2558', '47.70', '12'),              # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('2558', '4685', '223.14', '22'),             # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('4685', '8380', '691.08', '24'),             # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('8380', '10474', '1577.88', '32'),           # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('10474', '15402', '2247.96', '35'),          # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
                ('15402', None, '3972.76', '37'),             # P15T p.58, STANDARD, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '310', '0.00', '0'),                    # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('310', '548', '0.00', '10'),                 # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('548', '1279', '23.80', '12'),               # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('1279', '2342', '111.52', '22'),             # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('2342', '4190', '345.38', '24'),             # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('4190', '5237', '788.90', '32'),             # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('5237', '12629', '1123.94', '35'),           # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('12629', None, '3711.14', '37'),             # P15T p.58, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '464', '0.00', '0'),                    # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('464', '805', '0.00', '10'),                 # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('805', '1762', '34.10', '12'),               # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('1762', '2497', '148.94', '22'),             # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('2497', '4344', '310.64', '24'),             # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('4344', '5391', '753.92', '32'),             # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('5391', '12784', '1088.96', '35'),           # P15T p.58, STANDARD, Head of Household; read 2026-10-30
                ('12784', None, '3676.51', '37'),             # P15T p.58, STANDARD, Head of Household; read 2026-10-30
            ),
        },
        'checkbox': {
            'married_joint': (
                ('0', '310', '0.00', '0'),                    # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('310', '548', '0.00', '10'),                 # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('548', '1279', '23.80', '12'),               # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('1279', '2342', '111.52', '22'),             # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('2342', '4190', '345.38', '24'),             # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('4190', '5237', '788.90', '32'),             # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('5237', '7701', '1123.94', '35'),            # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('7701', None, '1986.34', '37'),              # P15T p.58, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '155', '0.00', '0'),                    # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('155', '274', '0.00', '10'),                 # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('274', '639', '11.90', '12'),                # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('639', '1171', '55.70', '22'),               # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('1171', '2095', '172.74', '24'),             # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('2095', '2619', '394.50', '32'),             # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('2619', '6314', '562.18', '35'),             # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('6314', None, '1855.43', '37'),              # P15T p.58, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '232', '0.00', '0'),                    # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('232', '402', '0.00', '10'),                 # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('402', '881', '17.00', '12'),                # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('881', '1249', '74.48', '22'),               # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('1249', '2172', '155.44', '24'),             # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('2172', '2696', '376.96', '32'),             # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('2696', '6392', '544.64', '35'),             # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('6392', None, '1838.24', '37'),              # P15T p.58, Step 2 Checkbox, Head of Household; read 2026-10-30
            ),
        },
    },
    26: {  # P15T p.59, BIWEEKLY Payroll Period; read 2026-10-30
        'standard': {
            'married_joint': (
                ('0', '1238', '0.00', '0'),                   # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('1238', '2192', '0.00', '10'),               # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('2192', '5115', '95.40', '12'),              # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('5115', '9369', '446.16', '22'),             # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('9369', '16760', '1382.04', '24'),           # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('16760', '20948', '3155.88', '32'),          # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('20948', '30804', '4496.04', '35'),          # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
                ('30804', None, '7945.64', '37'),             # P15T p.59, STANDARD, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '619', '0.00', '0'),                    # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('619', '1096', '0.00', '10'),                # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('1096', '2558', '47.70', '12'),              # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('2558', '4685', '223.14', '22'),             # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('4685', '8380', '691.08', '24'),             # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('8380', '10474', '1577.88', '32'),           # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('10474', '25258', '2247.96', '35'),          # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('25258', None, '7422.36', '37'),             # P15T p.59, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '929', '0.00', '0'),                    # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('929', '1610', '0.00', '10'),                # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('1610', '3523', '68.10', '12'),              # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('3523', '4994', '297.66', '22'),             # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('4994', '8688', '621.28', '24'),             # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('8688', '10783', '1507.84', '32'),           # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('10783', '25567', '2178.24', '35'),          # P15T p.59, STANDARD, Head of Household; read 2026-10-30
                ('25567', None, '7352.64', '37'),             # P15T p.59, STANDARD, Head of Household; read 2026-10-30
            ),
        },
        'checkbox': {
            'married_joint': (
                ('0', '619', '0.00', '0'),                    # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('619', '1096', '0.00', '10'),                # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('1096', '2558', '47.70', '12'),              # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('2558', '4685', '223.14', '22'),             # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('4685', '8380', '691.08', '24'),             # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('8380', '10474', '1577.88', '32'),           # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('10474', '15402', '2247.96', '35'),          # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('15402', None, '3972.76', '37'),             # P15T p.59, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '310', '0.00', '0'),                    # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('310', '548', '0.00', '10'),                 # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('548', '1279', '23.80', '12'),               # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('1279', '2342', '111.52', '22'),             # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('2342', '4190', '345.38', '24'),             # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('4190', '5237', '788.90', '32'),             # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('5237', '12629', '1123.94', '35'),           # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('12629', None, '3711.14', '37'),             # P15T p.59, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '464', '0.00', '0'),                    # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('464', '805', '0.00', '10'),                 # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('805', '1762', '34.10', '12'),               # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('1762', '2497', '148.94', '22'),             # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('2497', '4344', '310.64', '24'),             # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('4344', '5391', '753.92', '32'),             # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('5391', '12784', '1088.96', '35'),           # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('12784', None, '3676.51', '37'),             # P15T p.59, Step 2 Checkbox, Head of Household; read 2026-10-30
            ),
        },
    },
    24: {  # P15T p.60, SEMIMONTHLY Payroll Period; read 2026-10-30
        'standard': {
            'married_joint': (
                ('0', '1342', '0.00', '0'),                   # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('1342', '2375', '0.00', '10'),               # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('2375', '5542', '103.30', '12'),             # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('5542', '10150', '483.34', '22'),            # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('10150', '18156', '1497.10', '24'),          # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('18156', '22694', '3418.54', '32'),          # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('22694', '33371', '4870.70', '35'),          # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
                ('33371', None, '8607.65', '37'),             # P15T p.60, STANDARD, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '671', '0.00', '0'),                    # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('671', '1188', '0.00', '10'),                # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('1188', '2771', '51.70', '12'),              # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('2771', '5075', '241.66', '22'),             # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('5075', '9078', '748.54', '24'),             # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('9078', '11347', '1709.26', '32'),           # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('11347', '27363', '2435.34', '35'),          # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('27363', None, '8040.94', '37'),             # P15T p.60, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '1006', '0.00', '0'),                   # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('1006', '1744', '0.00', '10'),               # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('1744', '3817', '73.80', '12'),              # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('3817', '5410', '322.56', '22'),             # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('5410', '9413', '673.02', '24'),             # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('9413', '11681', '1633.74', '32'),           # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('11681', '27698', '2359.50', '35'),          # P15T p.60, STANDARD, Head of Household; read 2026-10-30
                ('27698', None, '7965.45', '37'),             # P15T p.60, STANDARD, Head of Household; read 2026-10-30
            ),
        },
        'checkbox': {
            'married_joint': (
                ('0', '671', '0.00', '0'),                    # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('671', '1188', '0.00', '10'),                # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('1188', '2771', '51.70', '12'),              # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('2771', '5075', '241.66', '22'),             # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('5075', '9078', '748.54', '24'),             # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('9078', '11347', '1709.26', '32'),           # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('11347', '16685', '2435.34', '35'),          # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('16685', None, '4303.64', '37'),             # P15T p.60, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '335', '0.00', '0'),                    # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('335', '594', '0.00', '10'),                 # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('594', '1385', '25.90', '12'),               # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('1385', '2538', '120.82', '22'),             # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('2538', '4539', '374.48', '24'),             # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('4539', '5673', '854.72', '32'),             # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('5673', '13681', '1217.60', '35'),           # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('13681', None, '4020.40', '37'),             # P15T p.60, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '503', '0.00', '0'),                    # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('503', '872', '0.00', '10'),                 # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('872', '1908', '36.90', '12'),               # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('1908', '2705', '161.22', '22'),             # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('2705', '4706', '336.56', '24'),             # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('4706', '5841', '816.80', '32'),             # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('5841', '13849', '1180.00', '35'),           # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('13849', None, '3982.80', '37'),             # P15T p.60, Step 2 Checkbox, Head of Household; read 2026-10-30
            ),
        },
    },
    12: {  # P15T p.61, MONTHLY Payroll Period; read 2026-10-30
        'standard': {
            'married_joint': (
                ('0', '2683', '0.00', '0'),                   # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('2683', '4750', '0.00', '10'),               # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('4750', '11083', '206.70', '12'),            # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('11083', '20300', '966.66', '22'),           # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('20300', '36313', '2994.40', '24'),          # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('36313', '45388', '6837.52', '32'),          # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('45388', '66742', '9741.52', '35'),          # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
                ('66742', None, '17215.42', '37'),            # P15T p.61, STANDARD, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '1342', '0.00', '0'),                   # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('1342', '2375', '0.00', '10'),               # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('2375', '5542', '103.30', '12'),             # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('5542', '10150', '483.34', '22'),            # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('10150', '18156', '1497.10', '24'),          # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('18156', '22694', '3418.54', '32'),          # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('22694', '54725', '4870.70', '35'),          # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('54725', None, '16081.55', '37'),            # P15T p.61, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '2013', '0.00', '0'),                   # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('2013', '3488', '0.00', '10'),               # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('3488', '7633', '147.50', '12'),             # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('7633', '10821', '644.90', '22'),            # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('10821', '18825', '1346.26', '24'),          # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('18825', '23363', '3267.22', '32'),          # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('23363', '55396', '4719.38', '35'),          # P15T p.61, STANDARD, Head of Household; read 2026-10-30
                ('55396', None, '15930.93', '37'),            # P15T p.61, STANDARD, Head of Household; read 2026-10-30
            ),
        },
        'checkbox': {
            'married_joint': (
                ('0', '1342', '0.00', '0'),                   # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('1342', '2375', '0.00', '10'),               # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('2375', '5542', '103.30', '12'),             # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('5542', '10150', '483.34', '22'),            # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('10150', '18156', '1497.10', '24'),          # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('18156', '22694', '3418.54', '32'),          # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('22694', '33371', '4870.70', '35'),          # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('33371', None, '8607.65', '37'),             # P15T p.61, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0', '671', '0.00', '0'),                    # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('671', '1188', '0.00', '10'),                # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('1188', '2771', '51.70', '12'),              # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('2771', '5075', '241.66', '22'),             # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('5075', '9078', '748.54', '24'),             # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('9078', '11347', '1709.26', '32'),           # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('11347', '27363', '2435.34', '35'),          # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('27363', None, '8040.94', '37'),             # P15T p.61, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0', '1006', '0.00', '0'),                   # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('1006', '1744', '0.00', '10'),               # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('1744', '3817', '73.80', '12'),              # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('3817', '5410', '322.56', '22'),             # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('5410', '9413', '673.02', '24'),             # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('9413', '11681', '1633.74', '32'),           # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('11681', '27698', '2359.50', '35'),          # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('27698', None, '7965.45', '37'),             # P15T p.61, Step 2 Checkbox, Head of Household; read 2026-10-30
            ),
        },
    },
    260: {  # P15T p.62, DAILY Payroll Period; read 2026-10-30
        'standard': {
            'married_joint': (
                ('0.00', '123.80', '0.00', '0'),              # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('123.80', '219.20', '0.00', '10'),           # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('219.20', '511.50', '9.54', '12'),           # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('511.50', '936.90', '44.62', '22'),          # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('936.90', '1676.00', '138.20', '24'),        # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('1676.00', '2094.80', '315.59', '32'),       # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('2094.80', '3080.40', '449.60', '35'),       # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
                ('3080.40', None, '794.56', '37'),            # P15T p.62, STANDARD, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0.00', '61.90', '0.00', '0'),               # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('61.90', '109.60', '0.00', '10'),            # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('109.60', '255.80', '4.77', '12'),           # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('255.80', '468.50', '22.31', '22'),          # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('468.50', '838.00', '69.11', '24'),          # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('838.00', '1047.40', '157.79', '32'),        # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('1047.40', '2525.80', '224.80', '35'),       # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
                ('2525.80', None, '742.24', '37'),            # P15T p.62, STANDARD, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0.00', '92.90', '0.00', '0'),               # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('92.90', '161.00', '0.00', '10'),            # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('161.00', '352.30', '6.81', '12'),           # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('352.30', '499.40', '29.77', '22'),          # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('499.40', '868.80', '62.13', '24'),          # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('868.80', '1078.30', '150.78', '32'),        # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('1078.30', '2556.70', '217.82', '35'),       # P15T p.62, STANDARD, Head of Household; read 2026-10-30
                ('2556.70', None, '735.26', '37'),            # P15T p.62, STANDARD, Head of Household; read 2026-10-30
            ),
        },
        'checkbox': {
            'married_joint': (
                ('0.00', '61.90', '0.00', '0'),               # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('61.90', '109.60', '0.00', '10'),            # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('109.60', '255.80', '4.77', '12'),           # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('255.80', '468.50', '22.31', '22'),          # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('468.50', '838.00', '69.11', '24'),          # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('838.00', '1047.40', '157.79', '32'),        # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('1047.40', '1540.20', '224.80', '35'),       # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
                ('1540.20', None, '397.28', '37'),            # P15T p.62, Step 2 Checkbox, Married Filing Jointly; read 2026-10-30
            ),
            'single': (
                ('0.00', '31.00', '0.00', '0'),               # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('31.00', '54.80', '0.00', '10'),             # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('54.80', '127.90', '2.38', '12'),            # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('127.90', '234.20', '11.15', '22'),          # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('234.20', '419.00', '34.54', '24'),          # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('419.00', '523.70', '78.89', '32'),          # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('523.70', '1262.90', '112.39', '35'),        # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
                ('1262.90', None, '371.11', '37'),            # P15T p.62, Step 2 Checkbox, Single or Married Filing Separately; read 2026-10-30
            ),
            'head_of_household': (
                ('0.00', '46.40', '0.00', '0'),               # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('46.40', '80.50', '0.00', '10'),             # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('80.50', '176.20', '3.41', '12'),            # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('176.20', '249.70', '14.89', '22'),          # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('249.70', '434.40', '31.06', '24'),          # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('434.40', '539.10', '75.39', '32'),          # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('539.10', '1278.40', '108.90', '35'),        # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
                ('1278.40', None, '367.65', '37'),            # P15T p.62, Step 2 Checkbox, Head of Household; read 2026-10-30
            ),
        },
    },
}

# ---- Social Security and Medicare (FICA), employee share withheld by the employer --------------
SS_RATE = D('0.062')                 # P15 p.29 s.9 "the social security tax rate is 6.2% (amount withheld)"; also p.1-2 What's New; read 2026-10-30
SS_WAGE_BASE = D('184500')           # P15 p.29 s.9 "The social security wage base limit is $184,500"; also pp.1-2 What's New; read 2026-10-30
MEDICARE_RATE = D('0.0145')          # P15 p.29 s.9 "The tax rate for Medicare is 1.45% (amount withheld)"; "There is no wage base limit"; read 2026-10-30
ADDL_MEDICARE_RATE = D('0.009')      # P15 pp.29-30 s.9 "you must withhold a 0.9% Additional Medicare Tax"; read 2026-10-30
ADDL_MEDICARE_THRESHOLD = D('200000')  # P15 p.30 s.9 "from wages you pay to an employee in excess of $200,000 in a calendar year"; ADMT "without regard to the individual's filing status"; read 2026-10-30

# ---- The law the annual tables are built from (second way only) --------------------------------
# Rev. Proc. 2025-32 s.4.01: (top of bracket, tax at the top of the previous bracket) per rate.
RATES = ('10', '12', '22', '24', '32', '35', '37')  # RP25 s.4.01 Tables 1-3; read 2026-10-30
BRACKET_TOPS = {
    'married_joint':     ('24800', '100800', '211400', '403550', '512450', '768700'),  # RP25 s.4.01 Table 1; read 2026-10-30
    'single':            ('12400', '50400', '105700', '201775', '256225', '640600'),   # RP25 s.4.01 Table 3; read 2026-10-30
    'head_of_household': ('17700', '67450', '105700', '201750', '256200', '640600'),   # RP25 s.4.01 Table 2; read 2026-10-30
}
BRACKET_BASES = {  # "$X plus N% of the excess", one per rate
    'married_joint':     ('0', '2480', '11600', '35932', '82048', '116896', '206583.50'),  # RP25 s.4.01 Table 1; read 2026-10-30
    'single':            ('0', '1240', '5800', '17966', '41024', '58448', '192979.25'),    # RP25 s.4.01 Table 3; read 2026-10-30
    'head_of_household': ('0', '1770', '7740', '16155', '39207', '56631', '191171'),       # RP25 s.4.01 Table 2; read 2026-10-30
}
STANDARD_DEDUCTION = {
    'married_joint':     '32200',  # RP25 s.4.14(1); read 2026-10-30
    'single':            '16100',  # RP25 s.4.14(1) (unmarried individuals; married filing separately is also 16,100); read 2026-10-30
    'head_of_household': '24150',  # RP25 s.4.14(1); read 2026-10-30
}

SCHEDULES = ('standard', 'checkbox')


def table(schedule, status):
    """The printed annual table as Decimals: tuple of (A, B or None, C, D as a fraction)."""
    return tuple((D(a), None if b is None else D(b), D(c), D(d) / 100)
                 for a, b, c, d in ANNUAL[schedule][status])


def period_table(n, schedule, status):
    return tuple((D(a), None if b is None else D(b), D(c), D(d) / 100)
                 for a, b, c, d in PERIOD[n][schedule][status])


def _half_up(x, unit):
    """Round a Fraction half up (away from zero for x >= 0) to a multiple of unit."""
    q = x / unit
    return (q.numerator * 2 + q.denominator) // (2 * q.denominator) * unit


def statute_tables():
    """Rebuild the annual tables from the law (exact Fractions), the way they are designed:

    STANDARD: the tax on (adjusted annual wage - (standard deduction - line 1g)), so row k starts
    at standard deduction - line 1g + the bracket top below it, with the Rev. Proc. base.
    Checkbox: half the tax on twice (adjusted annual wage - half the standard deduction), so row k
    starts at half the standard deduction + half the bracket top, with half the base.
    Pub. 15-T prints whole-dollar starts and whole-cent amounts; where a half-dollar start or a
    half-cent base comes out, the printed table rounds it half up (only the single checkbox table
    has any). Returns {schedule: {status: ((A, B, C, D), ...)}} with Fractions, D as a fraction.
    """
    out = {'standard': {}, 'checkbox': {}}
    for s in STATUSES:
        tops = [F(t) for t in BRACKET_TOPS[s]]
        bases = [F(b) for b in BRACKET_BASES[s]]
        rates = [F(r) / 100 for r in RATES]
        std = F(STANDARD_DEDUCTION[s])
        for schedule in SCHEDULES:
            if schedule == 'standard':
                offset, scale = std - F(str(LINE_1G[s])), F(1)
            else:
                offset, scale = std / 2, F(1, 2)
            starts = [F(0), offset] + [_half_up(offset + t * scale, F(1)) for t in tops]
            amounts = [F(0), F(0)] + [_half_up(b * scale, F(1, 100)) for b in bases[1:]]
            pcts = [F(0)] + rates
            rows = []
            for k in range(8):
                rows.append((starts[k], starts[k + 1] if k < 7 else None, amounts[k], pcts[k]))
            out[schedule][s] = tuple(rows)
    return out


def check_tables():
    """Cross-check the transcribed tables; raises on any typo. Returns the list of places where
    the printed annual tables are not continuous (a row's C differs from the previous row's
    C + D x width), which the README discusses."""
    jumps = []
    built = statute_tables()
    for schedule in SCHEDULES:
        for s in STATUSES:
            rows = table(schedule, s)
            assert len(rows) == 8 and rows[0][0] == 0 and rows[0][2] == 0 and rows[0][3] == 0
            for k, (a, b, c, d) in enumerate(rows):
                assert (b is None) == (k == 7), (schedule, s, k)
                if b is not None:
                    assert b == rows[k + 1][0] and b > a, (schedule, s, k)
                if k:
                    assert d > rows[k - 1][3], (schedule, s, k)
                    pa, _, pc, pd = rows[k - 1]
                    gap = c - (pc + pd * (a - pa))
                    if gap:
                        jumps.append((schedule, s, a, gap))
                # the same table, built from Rev. Proc. 2025-32 and line 1g
                ba, bb, bc, bd = built[schedule][s][k]
                assert (F(str(a)), F(str(c)), F(str(d))) == (ba, bc, bd), (schedule, s, k, (a, c, d), (ba, bc, bd))
            # line 1g: the STANDARD table's first taxed dollar + line 1g = the standard deduction
            if schedule == 'standard':
                assert rows[1][0] + LINE_1G[s] == D(STANDARD_DEDUCTION[s]), s
            else:
                assert rows[1][0] * 2 == D(STANDARD_DEDUCTION[s]), s
    for n, sched in PERIOD.items():
        unit = D('0.10') if n == 260 else D(1)  # the daily table prints dimes, the others dollars
        for schedule in SCHEDULES:
            for s in STATUSES:
                rows, annual = period_table(n, schedule, s), table(schedule, s)
                shift = LINE_1G[s] if schedule == 'standard' else D(0)
                exact_c = D(0)
                for k, (a, b, c, d) in enumerate(rows):
                    assert (b is None) == (k == 7) and (b is None or b == rows[k + 1][0]), (n, schedule, s, k)
                    assert d == annual[k][3], (n, schedule, s, k)
                    if k:
                        # the per-period start is the annual start (+ line 1g) / n, rounded to the unit
                        assert abs(a - (annual[k][0] + shift) / n) <= unit / 2, (n, schedule, s, k)
                        exact_c += rows[k - 1][3] * (a - rows[k - 1][0])
                    # the per-period amount is the running sum on the rounded starts, to the cent
                    assert abs(c - exact_c) <= D('0.005'), (n, schedule, s, k, c, exact_c)
    # Social Security and Medicare
    assert SS_RATE == D('0.062') and MEDICARE_RATE == D('0.0145') and ADDL_MEDICARE_RATE == D('0.009')
    return jumps


TABLE_JUMPS = check_tables()
