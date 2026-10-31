"""Property answer key: the "Rental analysis" and "Home" pages. Three CSVs.

Run:  python3 -B -I tools/golden_property/property_key.py [out_dir] [--mutate NAME] [--skip-examples]

Writes tests/golden/property/depreciation.csv (1,500 rows for depreciation alone: a basis, the month and year placed in
service, 1995 to 2026, and a tax year from that year to 30 years later; every month's first year, recovery years 28 and
29, the years after the end; the page's formula, the law's Table A-6 amount and the difference), rentals.csv (2,000
invented households with one to three rentals, tax year 2025 or 2026: every rental's page figures, depreciation, taxable
result, the page's usable and carried loss and tax line; the law's passive activity result (Form 8582) per rental and in
total, and the law's federal tax change with the 3.8% tax) and homes.csv (1,500 invented households with a home: the
page's figures, the sale today by the page and by the law: the 2-of-5-year test, the exclusion, the reduced-exclusion
contrast, the term, the federal tax with the 3.8% tax and the keep figure). Standard library only, exact arithmetic
(fractions.Fraction), deterministic (random.Random(20261031); the generator draws only integers). The figures and the
model come from rules.py next to this file; the sources and the reasons are in tests/golden/property/RULES.md and in
README.md here. Nothing under modules/, core/ or tests/*.test.mjs was opened, and the app is never imported.

Model (the pages' documented conventions, made exact by rules.py; where the law says otherwise the main columns follow
the law and a contrast column keeps the page's way):
  * depreciation: basis / 27.5 a year, mid-month in the first year, the last year takes what is left (the page's formula
    and the statute's arithmetic, 168(b)(3), (c), (d)(2)); Pub. 946 Table A-6 (rounded percentages) beside it.
  * rentals (page): rent, vacancy, income, running costs, NOI, the 12-payment loan year, cash flow and the ratios; the
    loss usable up to the special allowance, used by the rentals in order; tax line = taxable x the marginal rate.
    Law: 469(d)(1) netting first, the allowance of 469(i) (none on a separate return when the spouses lived together),
    the rest suspended pro rata (469(j)(4), Form 8582 Parts VI-VIII); the federal tax with the allowed net result added
    to the wages, minus without, with the 3.8% tax on net rental income (1411(c)(1)(A)(i)).
  * homes (page): equity, LTV, growth since bought, the year's costs, values ahead, the sale with the exclusion always
    applied at a flat 15% / 20% + 3.8%. Law: 121(a) 2 years of 5 (730 days or 24 full months), 121(b) caps, 1222 term,
    the gain stacked at 0/15/20% through the year's own breakpoints (or ordinary when short-term), the 3.8% tax on the
    lesser of the taxable gain and MAGI over the line; 121(c)'s reduced exclusion as a contrast.

Two derivations of every value, run on every row before anything is written:
  derivation 1  rules.py: depreciation_exact, depreciation_table, table_a6 (the printed table), rental_case (rental_money,
                loan_year, depreciable_basis, passive_law, passive_page, page_marginal_rate, federal_tax = regular_tax +
                qdcg_tax + niit), home_case (whole_months_page, growth_since_bought in Decimal, days_owned,
                full_months_law, meets_two_of_five, first_long_day, federal_tax).
  derivation 2  this file, written separately, from the CSV's own input strings (its own number and date parser), with
                the page's conventions restated here from the brief (only the federal tables come from rules.py):
                depreciation as the share of 660 half-months (27.5 years) in service by each year end, a difference of
                two cumulative figures; Table A-6 rebuilt by its rounding rule in integer thousandths of a percent (and
                checked against the printed table); the loan year in closed form (b g^k - p (g^k - 1) / (g - 1), the
                first k at or under $0.005); the passive rules as a literal walk through Form 8582 Parts I-VIII (lines
                1a-11, the Part VI and VII ratios, the allowance from line 5 - line 6 halved); the page's in-order
                allowance from cumulative losses; the tax from the revenue procedures' printed "The Tax Is" base plus
                the rate on the excess (bisection on the tops), a gain stacked as the overlap of [ordinary, taxable]
                with the 0/15/20% bands, capped at the regular tax; days owned from day-of-year counts; full months
                from the calendar-month difference and a day test; the first long-term day as the day after the purchase
                moved one year on; growth since bought by bisection in 2^-64 fixed point (no logarithms); values ahead
                in integers of 1e-8 dollars.
The script refuses to write any CSV if an amount differs by more than a cent, a rate or ratio by more than 1e-6, or any
other value (count, date, term, flag, label) differs at all, between the two. All three CSVs are worked first and
written only if all pass. --mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show the guard
refuses; --skip-examples turns off the RULES.md examples check so the row guard has to find it alone.
"""
import sys
sys.dont_write_bytecode = True  # before importing rules.py, so no __pycache__ lands in the repo

import csv
import hashlib
import random
import time
from bisect import bisect_left
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal as D
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'property'
SEED = 20261031
N_DEP, N_RENT, N_HOME = 1500, 2000, 1500
ZERO, ONE, CENT, MICRO = F(0), F(1), F(1, 100), F(1, 10 ** 6)
DAY = timedelta(days=1)
STATUSES = ('single', 'married_joint', 'married_separate', 'head_of_household')
STATUS_CODE = {'single': 'sgl', 'married_joint': 'mfj', 'married_separate': 'mfs', 'head_of_household': 'hoh'}
MONTH_NAMES = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')
assert tuple(R.TAX_YEARS) == (2025, 2026) and tuple(R.STATUSES) == STATUSES

MUTATIONS = {
    'no_mid_month': 'the first year counts the month placed in service in full (12 - month + 1), not half of it',
    'a6_round_down': 'Table A-6 rebuilt rounding down to 0.001%, not half up',
    'loan_no_cap': 'the last loan payment is never cut to the balance plus interest',
    'no_netting': 'the passive activity loss ignores the rentals with income (no 469(d)(1) netting)',
    'mfs_together_allowance': 'a separate return gets $12,500 / $50,000 even when the spouses lived together',
    'phaseout_from_150k': 'the $25,000 starts phasing out at $150,000 of modified AGI, not $100,000',
    'suspend_in_order': 'the suspended loss is put on the rentals in input order, not pro rata (not 469(j)(4))',
    'no_niit_rentals': 'net rental income is not net investment income (no 1411(c)(1)(A)(i))',
    'magi_after_rentals': "modified AGI for the allowance includes the rentals' net result (not 469(i)(3)(E)(iv))",
    'exclusion_729_days': 'the 2-of-5-year test is met at 729 days',
    'anniversary_is_long': 'a home sold on its anniversary is long-term (held one year, not more than one year)',
    'niit_whole_gain': 'the 3.8% tax is on the whole taxable gain once MAGI is over the line (not the lesser)',
    'cg_2025_tops': "2026 gains are stacked through 2025's 0% and 15% tops",
    'growth_by_calendar_months': "the page's whole months are the calendar-month difference (M2), not M1",
    'joint_cap_250k': 'a joint return excludes at most $250,000',
}
MUT = None


# ======================================== small helpers ========================================

def fr(x):
    """str / int / Decimal / Fraction -> exact Fraction (never float)."""
    if isinstance(x, float):
        raise TypeError('no floats')
    if isinstance(x, F):
        return x
    if isinstance(x, (int, D)):
        return F(x)
    return F(str(x).strip())


def rhu(x):
    """Round an exact value to an integer, halves away from zero."""
    x = fr(x)
    n = abs(x)
    k = (2 * n.numerator + n.denominator) // (2 * n.denominator)
    return -k if x < 0 else k


def money(x):
    """Dollars with two decimals, half up (away from zero); '' for None. Rounding happens only here."""
    if x is None:
        return ''
    c = rhu(fr(x) * 100)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 100}.{c % 100:02d}'


def rate6(x):
    """A rate or ratio with six decimals, half up (away from zero); '' for None."""
    if x is None:
        return ''
    c = rhu(fr(x) * 10 ** 6)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 10 ** 6}.{c % 10 ** 6:06d}'


def pct3(x):
    """A Table A-6 percentage, three decimals (exact: the table has no more)."""
    if x is None:
        return ''
    n = fr(x) * 1000
    assert n.denominator == 1, x
    n = int(n)
    return f'{n // 1000}.{n % 1000:03d}'


def half1(x):
    """A count of months in multiples of 0.5, one decimal."""
    n = fr(x) * 2
    assert n.denominator == 1 and n >= 0, x
    n = int(n)
    return f'{n // 2}.{5 if n % 2 else 0}'


def usd(x):
    """Money for a note: two decimals, thousands separated."""
    m = money(x)
    sign = '-' if m.startswith('-') else ''
    whole, frac = m.lstrip('-').split('.')
    return f'{sign}{int(whole):,}.{frac}'


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


def yn(b):
    return 'yes' if b else 'no'


def iso(d):
    return '' if d is None else d.isoformat()


def fmt(kind, v):
    if kind == 'm':
        return money(v)
    if kind == 'r':
        return rate6(v)
    if v is None:
        return ''
    if isinstance(v, bool):
        return yn(v)
    if isinstance(v, date):
        return v.isoformat()
    return str(v)


class Guard:
    """Compares derivation 1 with derivation 2. An amount more than a cent apart, a rate more than 1e-6 apart, or any
    other value that differs at all, stops the run before a CSV is written."""

    def __init__(self, name):
        self.name = name
        self.n = Counter()
        self.max_gap = ZERO
        self.max_rate_gap = ZERO

    def _stop(self, where, what, a, b):
        raise SystemExit(f'{self.name} {where} {what}: derivation 1 gives {a!r}, derivation 2 gives {b!r}; '
                         'no CSV written')

    def same(self, where, what, a, b):
        self.n['other values compared exactly'] += 1
        if a != b:
            self._stop(where, what, a, b)

    def money(self, where, what, a, b):
        self.n['amounts compared'] += 1
        if (a is None) != (b is None):
            self._stop(where, what, a, b)
        if a is None:
            return
        fa, fb = fr(a), fr(b)
        gap = abs(fa - fb)
        if gap > CENT or abs(rhu(fa * 100) - rhu(fb * 100)) > 1:
            self._stop(where, what, money(fa), money(fb))
        self.max_gap = max(self.max_gap, gap)
        self.n['amounts that differ at all before rounding'] += gap != 0

    def rate(self, where, what, a, b):
        self.n['rates and ratios compared'] += 1
        if (a is None) != (b is None):
            self._stop(where, what, a, b)
        if a is None:
            return
        gap = abs(fr(a) - fr(b))
        if gap > MICRO:
            self._stop(where, what, rate6(a), rate6(b))
        self.max_rate_gap = max(self.max_rate_gap, gap)
        self.n['rates that differ at all before rounding'] += gap != 0

    def fields(self, where, spec, a, b):
        for key, kind in spec:
            if kind == 'm':
                self.money(where, key, a[key], b[key])
            elif kind == 'r':
                self.rate(where, key, a[key], b[key])
            else:
                self.same(where, key, a[key], b[key])


# ======================================== derivation 2: its own reading of the inputs ========================================
# The page's conventions restated from the brief (not imported from rules.py, so a slip in either shows in the guard).
LAND_2, VACANCY_2, MAINT_2, MGMT_2 = F(1, 5), F(1, 20), F(1, 100), ZERO      # blank land 20%, vacancy 5%, maintenance 1%, management 0
APPR_2, SELL_2, STOP_2 = F(7, 200), F(3, 50), F(1, 200)                     # blank growth 3.5%, selling costs 6%; loan stops at 0.005
HALF_MONTHS_2 = 660                                                         # 27.5 years x 24 half-months (168(c), (d)(2))
FORM_LINE5_2 = {'married_separate': 75000, 'other': 150000}                 # F8582 line 5; I8582: $75,000 apart
FORM_LINE8_MAX_2 = {'married_separate': 12500, 'other': 25000}              # F8582 line 8 "Do not enter more than $25,000"
EXCL_2 = {'married_joint': 500000, 'other': 250000}                         # 121(b)(1), (b)(2)
PAGE_20_2 = {'married_joint': 600050, 'other': 533400}                      # brief: the page's 20% line
PAGE_NIIT_2 = {'married_joint': 250000, 'other': 200000}                    # brief: the page's 3.8% line
DAYS_2, MONTHS_2 = 730, 24                                                  # 1.121-1(c)(1)


def num_2(s):
    """Derivation 2's own reading of a CSV number ('', '-0.0125', '1234.56') -> Fraction or None."""
    s = s.strip()
    if s == '':
        return None
    neg = s[0] == '-'
    if s[0] in '+-':
        s = s[1:]
    whole, _, frac = s.partition('.')
    assert (whole + frac).isdigit(), s
    v = F(int(whole or '0') * 10 ** len(frac) + int(frac or '0'), 10 ** len(frac))
    return -v if neg else v


def day_2(s):
    y, m, d = (int(p) for p in s.split('-'))
    return date(y, m, d)


def dflt(v, default):
    return default if v is None else v


def z_(v):
    return ZERO if v is None else v


def key_2(st):
    return 'married_joint' if st == 'married_joint' else 'other'


def leap_2(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


MONTH_DAYS_2 = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


def mlen_2(y, m):
    return 29 if m == 2 and leap_2(y) else MONTH_DAYS_2[m - 1]


def doy_2(d):
    return sum(mlen_2(d.year, m) for m in range(1, d.month)) + d.day


def days_2(b, s):
    """Days from b to s by day-of-year counts and year lengths (the day after b is day 1, s is counted)."""
    return sum(366 if leap_2(y) else 365 for y in range(b.year, s.year)) + doy_2(s) - doy_2(b)


# ======================================== depreciation: derivation 2 ========================================

def hm_2(py, pm, y):
    """Half-months of the 660 in service by the end of year y (the first year from the middle of the month)."""
    if y < py:
        return 0
    first = 26 - 2 * pm if MUT == 'no_mid_month' else 25 - 2 * pm
    return min(HALF_MONTHS_2, 24 * (y - py) + first)


_A6 = {}


def a6_col_2(m):
    """Table A-6's column for month m in thousandths of a percent (100,000 = 100%), rebuilt in integers: year 1 the exact
    share rounded half up; then (100% - the rounded years so far) x 24 / half-months left, rounded half up; the rest
    once a year or less is left."""
    if (m, MUT) in _A6:
        return _A6[(m, MUT)]

    def div(a, b):
        return a // b if MUT == 'a6_round_down' else (2 * a + b) // (2 * b)

    first = 25 - 2 * m
    col = [div(100000 * first, HALF_MONTHS_2)]
    rem, left = 100000 - col[0], HALF_MONTHS_2 - first
    while rem > 0:
        r = rem if left <= 24 else min(rem, div(rem * 24, left))
        col.append(r)
        rem -= r
        left -= 24
    _A6[(m, MUT)] = tuple(col)
    return _A6[(m, MUT)]


def dep_2(basis, py, pm, ty):
    """One building in one tax year, worked as the difference of two cumulative shares of 660 half-months."""
    h1, h0 = hm_2(py, pm, ty), hm_2(py, pm, ty - 1)
    col = a6_col_2(pm)
    k = ty - py + 1
    milli = col[k - 1] if 1 <= k <= len(col) else None
    page = basis * (h1 - h0) / HALF_MONTHS_2
    table = ZERO if milli is None else basis * milli / 100000
    year_is = 'first' if ty == py else 'after_end' if h1 == h0 else 'last' if h1 == HALF_MONTHS_2 else 'full'
    return {'recovery_year': k, 'year_is': year_is, 'months': F(h1 - h0, 2), 'page': page,
            'pct': None if milli is None else F(milli, 1000), 'table': table, 'diff': table - page,
            'cum_page': basis * h1 / HALF_MONTHS_2, 'cum_table': basis * sum(col[:max(0, min(k, len(col)))]) / 100000,
            'unrecovered': basis - basis * h1 / HALF_MONTHS_2}


def dep_1(basis, py, pm, ty):
    b = fr(basis)
    k = ty - py + 1
    col = R.table_a6(pm)
    unit = R.depreciation_exact(R.RECOVERY_YEARS, py, pm, ty)       # a basis of 27.5: a full year is 1
    nxt = R.depreciation_exact(R.RECOVERY_YEARS, py, pm, ty + 1)
    page = R.depreciation_exact(b, py, pm, ty)
    table = R.depreciation_table(b, py, pm, ty)
    cum_p = sum((R.depreciation_exact(b, py, pm, y) for y in range(py, ty + 1)), ZERO)
    cum_t = sum((R.depreciation_table(b, py, pm, y) for y in range(py, ty + 1)), ZERO)
    year_is = 'first' if ty == py else 'after_end' if unit == 0 else 'last' if nxt == 0 else 'full'
    return {'recovery_year': k, 'year_is': year_is, 'months': unit * 12, 'page': page,
            'pct': col[k - 1] if 1 <= k <= len(col) else None, 'table': table, 'diff': table - page,
            'cum_page': cum_p, 'cum_table': cum_t, 'unrecovered': b - cum_p}


DEP_SPEC = (('recovery_year', 's'), ('year_is', 's'), ('months', 's'), ('page', 'm'), ('pct', 's'), ('table', 'm'),
            ('diff', 'm'), ('cum_page', 'm'), ('cum_table', 'm'), ('unrecovered', 'm'))
DEP_COLUMNS = ['case_id', 'row_kind', 'basis', 'placed_in_service', 'tax_year', 'recovery_year', 'year_is',
               'months_counted', 'depreciation_page', 'table_a6_percent', 'depreciation_law_table_a6', 'table_minus_page',
               'cumulative_page', 'cumulative_table_a6', 'unrecovered_page', 'note']


def dep_cases(rng):
    """depreciation.csv inputs: (basis, year, month, tax year, note, kind)."""
    rows, seen = [], set()

    def add(basis, py, pm, ty, note='', kind='edge'):
        if (basis, py, pm, ty) in seen:
            return
        seen.add((basis, py, pm, ty))
        rows.append((basis, py, pm, ty, note, kind))

    add('160000.00', 2025, 2, 2025, 'P527 Table 2-2d example: $160,000 building placed in service in February: the table '
        'gives 3.182% = $5,091.20 (P527 prints $5,091), the formula $5,090.91')
    add('100000.00', 2023, 7, 2025, 'P946 example: $100,000 placed in service in July 2023: a full 2025 year is $3,636 by '
        'the table, $3,636.36 by the formula')
    for ty, note in ((2019, 'year 1: 12,000 x 9.5/12 = 9,500.00; table 2.879% = 9,500.70'),
                     (2026, 'year 8: 12,000.00; table 3.636% = 11,998.80'),
                     (2028, 'year 10: 12,000.00; table 3.637% = 12,002.10'),
                     (2046, 'year 28, the last: 8,500.00 is left; table 2.576% = 8,500.80'),
                     (2047, 'after the end: 0 both ways; 330,000 recovered both ways')):
        add('330000.00', 2019, 3, ty, "RULES.md 9.1 Ivo's duplex (basis 330,000, placed in service March 2019): " + note)
    add('27.50', 1998, 3, 2025, 'RULES.md s.4: basis 27.50 (a full year is $1.00), March 1998: last deduction 2025, 8.5/12')
    add('27.50', 1998, 3, 2026, 'RULES.md s.4: March 1998: nothing in 2026')
    add('27.50', 1998, 8, 2026, 'RULES.md s.4: August 1998: 1.5/12 of a year in 2026 (recovery year 29)')
    add('0.00', 2010, 5, 2010, 'basis 0: nothing')
    add('0.00', 2010, 5, 2016, 'basis 0: nothing')
    add('0.01', 2020, 1, 2020, 'basis one cent, January: 0.01 x 11.5/330 rounds to 0.00')
    add('0.01', 2020, 1, 2047, 'basis one cent: the last year')
    bases = ('100000.00', '275000.00', '330000.00', '87654.32', '1234567.89', '55.00', '412345.67', '250000.00',
             '99999.99', '660000.00')
    for m in range(1, 13):
        for j, k in enumerate((1, 2, 9, 10, 11, 27, 28, 29, 30, 31)):
            py = 1995 + (7 * m + 3 * j) % 32
            add(bases[(m + j) % len(bases)], py, m, py + k - 1, '')
        for j in range(4):                       # more first years: every month placed in service, four more years
            py = 1995 + (5 * m + 11 * j + 2) % 32
            add(bases[(3 * m + j + 4) % len(bases)], py, m, py, '')
    while len(rows) < N_DEP:
        py, pm = rng.randint(1995, 2026), rng.randint(1, 12)
        ty = py + rng.randrange(31)
        k = rng.randrange(100)
        if k < 45:
            b = f'{rng.randint(50, 1500) * 1000}.00'
        elif k < 85:
            c = rng.randint(1000000, 300000000)
            b = f'{c // 100}.{c % 100:02d}'
        elif k < 95:
            c = rng.randint(1, 100000)
            b = f'{c // 100}.{c % 100:02d}'
        else:
            b = f'{rng.randint(1, 20000) * 55}.00'
        add(b, py, pm, ty, '', 'random')
    return rows


def dep_note(d1, pm, base):
    parts = [base] if base else []
    if d1['year_is'] == 'first':
        parts.append(f'first year: placed in service in {MONTH_NAMES[pm - 1]}, {half1(d1["months"])} months (mid-month)')
    elif d1['year_is'] == 'last':
        parts.append(f'last year: what is left ({half1(d1["months"])} months)')
    elif d1['year_is'] == 'after_end':
        parts.append('after the 27.5 years: nothing')
    return '; '.join(parts)


def build_dep(rng, guard):
    rows, s = [], Counter()
    for n, (basis, py, pm, ty, note, kind) in enumerate(dep_cases(rng), 1):
        cid = f'dep-{n:04d}'
        a = dep_1(basis, py, pm, ty)
        b = dep_2(num_2(basis), py, pm, ty)
        guard.fields(cid, DEP_SPEC, a, b)
        rows.append({'case_id': cid, 'row_kind': kind, 'basis': basis, 'placed_in_service': f'{py}-{pm:02d}',
                     'tax_year': ty, 'recovery_year': a['recovery_year'], 'year_is': a['year_is'],
                     'months_counted': half1(a['months']), 'depreciation_page': money(a['page']),
                     'table_a6_percent': pct3(a['pct']), 'depreciation_law_table_a6': money(a['table']),
                     'table_minus_page': money(a['diff']), 'cumulative_page': money(a['cum_page']),
                     'cumulative_table_a6': money(a['cum_table']), 'unrecovered_page': money(a['unrecovered']),
                     'note': dep_note(a, pm, note)})
        s[f'rows {kind}'] += 1
        s[f'year is {a["year_is"]}'] += 1
        if a['year_is'] == 'first':
            s[f'first year, placed in month {pm:02d}'] += 1
        s[f'recovery year {a["recovery_year"]:02d}'] += 1
        s[f'placed in service {py // 5 * 5}-{py // 5 * 5 + 4}'] += 1
        s['tax year after 2026'] += ty > 2026
        s['table and formula differ after rounding'] += money(a['table']) != money(a['page'])
        s['table and formula differ by more than $1'] += abs(a['diff']) > 1
        s['cumulative differs after rounding'] += money(a['cum_table']) != money(a['cum_page'])
        s['written amounts exactly on a half cent'] += sum(half_cent(a[k]) for k in ('page', 'table', 'diff'))
    assert len(rows) == N_DEP
    return rows, s


# ======================================== the loan year: derivation 2 (closed form) ========================================

def loan_2(bal, rate, pay):
    """12 monthly payments in closed form: after k uncut payments the balance is b g^k - p (g^k - 1) / (g - 1), g = 1 +
    rate / 12 (b - p k at a rate of 0). The year stops at the first k whose balance is $0.005 or less; that payment is cut
    to what is owed. Interest = paid - (b - balance at the end), at most what was paid."""
    if bal is None and rate is None and pay is None:
        return None
    b0, r, p = z_(bal), z_(rate), z_(pay)
    g = 1 + r / 12

    def B(k):
        if r == 0:
            return b0 - p * k
        gk = g ** k
        return b0 * gk - p * (gk - 1) / (g - 1)

    if b0 <= STOP_2:
        months, paid, end = 0, ZERO, b0
    else:
        months = next((k for k in range(1, 13) if B(k) <= STOP_2), 12)
        prev = B(months - 1)
        last = p if MUT == 'loan_no_cap' else min(p, prev * g)
        paid = p * (months - 1) + last
        end = prev * g - last
    interest = min(paid - (b0 - end), paid)
    return {'debt_service': paid, 'interest': interest, 'principal': paid - interest, 'months': months, 'end': end,
            'capped': paid - (b0 - end) > paid}


# ======================================== the federal tax: derivation 2 ========================================

def ord_tax_2(year, st, x):
    """The revenue procedure's own form: the "Over $X but not over $Y" row (bisection on the tops), then the printed
    "The Tax Is" base plus the rate on the excess over X."""
    if x <= 0:
        return ZERO
    tops = R.BRACKET_TOPS[year][st]
    k = bisect_left(tops, x)
    lo = 0 if k == 0 else tops[k - 1]
    return num_2(R.RP_BASE[year][st][k]) + (x - lo) * F(R.RATES[k], 100)


def overlap(a, b, c, d):
    """Length of [a, b] inside [c, d] (d None = no top)."""
    hi = b if d is None else min(b, d)
    return max(ZERO, hi - max(a, c))


def fed_2(year, st, wages, other=ZERO, lt=ZERO, stg=ZERO, nii=ZERO):
    """Income tax + NIIT: a long-term gain is the top slice of taxable income, taxed 0 / 15 / 20% where it overlaps the
    bands, and the whole is capped at the regular tax (1(h)(1)); a short-term gain is ordinary income."""
    agi = wages + other + lt + stg
    ti = max(ZERO, agi - R.STANDARD_DEDUCTION[year][st])
    if lt > 0:
        ordinary = max(ZERO, ti - lt)
        ty = 2025 if MUT == 'cg_2025_tops' else year
        z, f15 = F(R.CG_ZERO_TOP[ty][st]), F(R.CG_15_TOP[ty][st])
        stacked = (ord_tax_2(year, st, ordinary) + F(15, 100) * overlap(ordinary, ti, z, f15)
                   + F(20, 100) * overlap(ordinary, ti, f15, None))
        income_tax = min(stacked, ord_tax_2(year, st, ti))
    else:
        income_tax = ord_tax_2(year, st, ti)
    over = max(ZERO, agi - R.NIIT_THRESHOLD[st])
    nii = max(ZERO, nii)
    niit = F(38, 1000) * ((nii if over > 0 else ZERO) if MUT == 'niit_whole_gain' else min(nii, over))
    return {'agi': agi, 'ti': ti, 'income_tax': income_tax, 'niit': niit, 'total': income_tax + niit}


def cents_2(x):
    """A total of tax as money, to the cent, halves up (R2)."""
    return F(rhu(fr(x) * 100), 100)


def page_rate_2(year, st, wages):
    base = cents_2(fed_2(year, st, wages)['total'])
    return max(ZERO, (cents_2(fed_2(year, st, wages, other=F(1000))['total']) - base) / 1000)


# ======================================== rentals: derivation 2 ========================================

RENTAL_FIELDS = ('purchase_price', 'purchase_date', 'land_share', 'improvements', 'value', 'rent_monthly', 'vacancy',
                 'property_tax', 'insurance', 'hoa_monthly', 'maintenance', 'management', 'utilities_monthly',
                 'other_monthly', 'loan_balance', 'loan_rate', 'loan_payment', 'cash_in', 'appreciation')


def rental_2(x, ty):
    """One rental's page figures, from its parsed fields."""
    price, value, monthly = x['purchase_price'], x['value'], x['rent_monthly']
    rent = monthly * 12
    income = rent * (1 - dflt(x['vacancy'], VACANCY_2))
    fixed = z_(x['property_tax']) + z_(x['insurance']) + 12 * (z_(x['hoa_monthly']) + z_(x['utilities_monthly'])
                                                              + z_(x['other_monthly']))
    opex = fixed + value * dflt(x['maintenance'], MAINT_2) + income * dflt(x['management'], MGMT_2)
    noi = income - opex
    loan = loan_2(x['loan_balance'], x['loan_rate'], x['loan_payment'])
    ds = loan['debt_service'] if loan else ZERO
    interest = loan['interest'] if loan else ZERO
    principal = loan['principal'] if loan else ZERO
    cash_flow = noi - ds
    cash_in = x['cash_in']
    py, pm = int(x['purchase_date'][:4]), int(x['purchase_date'][5:7])
    basis = price - price * dflt(x['land_share'], LAND_2) + z_(x['improvements'])
    dp = dep_2(basis, py, pm, ty)
    taxable = noi - interest - dp['page']
    equity = value - (z_(x['loan_balance']) if loan else ZERO)
    growth = value * (1 + dflt(x['appreciation'], APPR_2)) - value
    total_return = cash_flow + principal + growth
    return {'rent': rent, 'vacancy': rent - income, 'income': income, 'opex': opex, 'noi': noi,
            'cap_rate': None if value == 0 else noi / value, 'debt_service': ds, 'interest': interest,
            'principal': principal, 'cash_flow': cash_flow,
            'cash_on_cash': None if cash_in is None or cash_in == 0 else cash_flow / cash_in,
            'dscr': None if loan is None or ds == 0 else noi / ds,
            'break_even': None if rent == 0 else (opex + ds) / rent,
            'one_percent': None if price == 0 else monthly / price,
            'basis': basis, 'depreciation': dp['page'], 'taxable': taxable, 'equity': equity, 'growth': growth,
            'total_return': total_return, 'return_on_equity': None if equity <= 0 else total_return / equity,
            'recovery_year': dp['recovery_year'], 'depreciation_table_a6': dp['table'], 'table_minus_page': dp['diff'],
            'placed_this_year': py == ty, 'payments_made': loan['months'] if loan else None,
            'balance_after': loan['end'] if loan else None}


def form_8582_2(results, st, apart, magi):
    """Form 8582 (2025), line by line, for rentals with no prior-year loss. A separate return whose spouses lived together
    puts the rentals in Part V (line 2) and skips Part II (I8582 Part IV caution)."""
    n = len(results)
    active = st != 'married_separate' or apart or MUT == 'mfs_together_allowance'
    inc = [x if x > 0 else ZERO for x in results]
    los = [-x if x < 0 else ZERO for x in results]
    inc_form = [ZERO] * n if MUT == 'no_netting' else inc
    l1a, l1b = (sum(inc_form), -sum(los)) if active else (ZERO, ZERO)
    l2a, l2b = (ZERO, ZERO) if active else (sum(inc_form), -sum(los))
    l1d, l2d = l1a + l1b, l2a + l2b
    l3 = l1d + l2d
    key = 'married_separate' if st == 'married_separate' else 'other'
    l5 = F(FORM_LINE5_2[key]) + (100000 if MUT == 'phaseout_from_150k' else 0)
    l6 = max(ZERO, magi + (sum(inc) - sum(los) if MUT == 'magi_after_rentals' else ZERO))
    l8 = ZERO if not active or l6 >= l5 else min(F(FORM_LINE8_MAX_2[key]), (l5 - l6) * F(1, 2))
    total_loss = sum(los)
    if l3 >= 0:
        l9, c_line, unallowed, l11 = ZERO, ZERO, [ZERO] * n, None
    else:
        l9 = min(min(-l1d, -l3), l8) if active else ZERO           # line 4, then the smaller of line 4 and line 8
        l10 = l1a + l2a
        l11 = l9 + l10
        if l9 > 0:                                                  # Part VI: the special allowance, by ratio
            col_d = [a - a / total_loss * l9 for a in los]
        else:
            col_d = list(los)
        c_line = -l3 - l9                                           # Part VII: A - B = C
        tot = sum(col_d)
        if MUT == 'suspend_in_order':
            left, unallowed = c_line, []
            for a in los:
                u = min(a, left)
                unallowed.append(u)
                left -= u
        else:
            unallowed = [a / tot * c_line if c_line else ZERO for a in col_d]
    allowed = [a - u for a, u in zip(los, unallowed)]                # Part VIII: (a) - (b)
    extra = sum(inc) - sum(inc_form)                                # income the mutated form left out
    return {'net': l3 + extra, 'pal': max(ZERO, -l3), 'allowance': l8, 'line9': l9,
            'loss_allowed': total_loss if l3 >= 0 else l11,
            'suspended': ZERO if l3 >= 0 else c_line, 'allowed_net': (l3 if l3 >= 0 else -l9) + extra,
            'allowed': allowed, 'unallowed': unallowed,
            'allowed_result': [x if x >= 0 else x + u for x, u in zip(results, unallowed)]}


def page_passive_2(results, st, magi):
    """The page's loss room from the form's lines 5-8 (no lived-apart test), used by the rentals in order: each loss
    takes what the earlier losses left (room - the earlier losses, never below 0)."""
    key = 'married_separate' if st == 'married_separate' else 'other'
    l5 = F(FORM_LINE5_2[key])
    room = ZERO if magi >= l5 else min(F(FORM_LINE8_MAX_2[key]), (l5 - magi) / 2)
    before, usable, carry = ZERO, [], []
    for x in results:
        if x < 0:
            u = min(-x, max(ZERO, room - before))
            before += -x
            usable.append(u)
            carry.append(-x - u)
        else:
            usable.append(ZERO)
            carry.append(ZERO)
    return room, usable, carry


def derive_rent_2(c):
    year, st = int(c['tax_year']), c['filing_status']
    apart = c['lived_apart_all_year'].strip().lower() == 'yes'
    wages = num_2(c['wages'])
    rentals = []
    for part in c['rentals'].split(';'):
        vals = part.split('|')
        assert len(vals) == len(RENTAL_FIELDS), part
        x = {k: (v if k == 'purchase_date' else num_2(v)) for k, v in zip(RENTAL_FIELDS, vals)}
        rentals.append(rental_2(x, year))
    results = [r['taxable'] for r in rentals]
    form = form_8582_2(results, st, apart, wages)
    room, usable, carry = page_passive_2(results, st, wages)
    m = page_rate_2(year, st, wages)
    for i, r in enumerate(rentals):
        r['loss_usable'], r['loss_carried'] = usable[i], carry[i]
        r['tax_line'] = m * r['taxable'] if r['taxable'] >= 0 else -m * usable[i]
        r['after_tax'] = r['cash_flow'] - r['tax_line']
        r['allowed_loss'], r['suspended_loss'] = form['allowed'][i], form['unallowed'][i]
        r['allowed_result'] = form['allowed_result'][i]
    w0 = fed_2(year, st, wages)
    nii = ZERO if MUT == 'no_niit_rentals' else max(ZERO, form['allowed_net'])
    w1 = fed_2(year, st, wages, other=form['allowed_net'], nii=nii)
    page_total = sum((r['tax_line'] for r in rentals), ZERO)
    cash_flow = sum((r['cash_flow'] for r in rentals), ZERO)
    change = w1['total'] - w0['total']
    house = {'marginal_rate': m, 'page_loss_room': room, 'page_loss_usable_total': sum(usable, ZERO),
             'page_loss_carried_total': sum(carry, ZERO), 'page_tax_line_total': page_total,
             'cash_flow_total': cash_flow, 'page_after_tax_total': cash_flow - page_total,
             'law_net_passive': form['net'], 'law_passive_activity_loss': form['pal'], 'law_allowance': form['allowance'],
             'law_allowed_against_wages': form['line9'], 'law_loss_allowed_total': form['loss_allowed'],
             'law_suspended_total': form['suspended'], 'law_allowed_net': form['allowed_net'],
             'law_tax_without': w0['total'], 'law_tax_with': w1['total'], 'law_niit_change': w1['niit'] - w0['niit'],
             'law_tax_change': change, 'law_after_tax_total': cash_flow - change, 'law_minus_page': change - page_total,
             'ratio_law_to_page': None if page_total == 0 else change / page_total}
    return {'rentals': rentals, 'house': house}


# ======================================== rentals: derivation 1 (rules.py) ========================================

def parse_rentals_1(s):
    return [dict(zip(RENTAL_FIELDS, part.split('|'))) for part in s.split(';')]


def derive_rent_1(c):
    case = {'tax_year': c['tax_year'], 'today': c['today'], 'filing_status': c['filing_status'],
            'lived_apart_all_year': c['lived_apart_all_year'], 'wages': c['wages'],
            'rentals': parse_rentals_1(c['rentals'])}
    r = R.rental_case(case)
    year = int(c['tax_year'])
    rentals = []
    for x in r['rentals']:
        py, pm = x['placed']
        unit = R.depreciation_exact(R.RECOVERY_YEARS, py, pm, year)
        nxt = R.depreciation_exact(R.RECOVERY_YEARS, py, pm, year + 1)
        loan = x['loan']
        rentals.append({
            'rent': x['rent'], 'vacancy': x['vacancy'], 'income': x['income'], 'opex': x['opex'], 'noi': x['noi'],
            'cap_rate': x['cap_rate'], 'debt_service': x['debt_service'], 'interest': x['interest'],
            'principal': x['principal'], 'cash_flow': x['cash_flow'], 'cash_on_cash': x['cash_on_cash'],
            'dscr': x['dscr'], 'break_even': x['break_even'], 'one_percent': x['one_percent'], 'basis': x['basis'],
            'depreciation': x['depreciation'], 'taxable': x['taxable'], 'loss_usable': x['page_usable'],
            'loss_carried': x['page_carry'], 'tax_line': x['page_tax_line'], 'after_tax': x['page_after_tax'],
            'equity': x['equity'], 'growth': x['growth'], 'total_return': x['total_return'],
            'return_on_equity': x['roe'], 'allowed_loss': x['law_allowed'], 'suspended_loss': x['law_suspended'],
            'allowed_result': x['law_allowed_result'], 'recovery_year': year - py + 1,
            'depreciation_table_a6': x['depreciation_table'], 'table_minus_page': x['depreciation_diff'],
            'placed_this_year': x['first_year'], 'payments_made': loan['months'] if loan else None,
            'balance_after': loan['end_balance'] if loan else None,
            '_year_is': 'first' if year == py else 'after_end' if unit == 0 else 'last' if nxt == 0 else 'full',
            '_month': pm, '_loan': loan})
    law = r['law']
    house = {'marginal_rate': r['marginal_rate'], 'page_loss_room': r['page']['cap'],
             'page_loss_usable_total': r['page_usable_total'], 'page_loss_carried_total': r['page_carry_total'],
             'page_tax_line_total': r['page_tax_line_total'], 'cash_flow_total': r['cash_flow_total'],
             'page_after_tax_total': r['page_after_tax_total'], 'law_net_passive': law['net'],
             'law_passive_activity_loss': law['pal'], 'law_allowance': law['cap'],
             'law_allowed_against_wages': law['allowed_against_other'],
             'law_loss_allowed_total': sum((p['allowed'] for p in law['per']), ZERO),
             'law_suspended_total': law['suspended'], 'law_allowed_net': law['allowed_net'],
             'law_tax_without': r['without']['total'], 'law_tax_with': r['with']['total'],
             'law_niit_change': r['law_niit_change'], 'law_tax_change': r['law_tax_change'],
             'law_after_tax_total': r['law_after_tax_total'],
             'law_minus_page': r['law_tax_change'] - r['page_tax_line_total'], 'ratio_law_to_page': r['ratio'],
             '_agi_with': r['with']['agi']}
    return {'rentals': rentals, 'house': house}


RENTAL_RESULT_SPEC = (('rent', 'm'), ('vacancy', 'm'), ('income', 'm'), ('opex', 'm'), ('noi', 'm'), ('cap_rate', 'r'),
                      ('debt_service', 'm'), ('interest', 'm'), ('principal', 'm'), ('cash_flow', 'm'),
                      ('cash_on_cash', 'r'), ('dscr', 'r'), ('break_even', 'r'), ('one_percent', 'r'), ('basis', 'm'),
                      ('depreciation', 'm'), ('taxable', 'm'), ('loss_usable', 'm'), ('loss_carried', 'm'),
                      ('tax_line', 'm'), ('after_tax', 'm'), ('equity', 'm'), ('growth', 'm'), ('total_return', 'm'),
                      ('return_on_equity', 'r'))
RENTAL_LAW_SPEC = (('allowed_loss', 'm'), ('suspended_loss', 'm'), ('allowed_result', 'm'))
RENTAL_DEP_SPEC = (('recovery_year', 's'), ('depreciation_table_a6', 'm'), ('table_minus_page', 'm'),
                   ('placed_this_year', 's'))
RENTAL_LOAN_SPEC = (('payments_made', 's'), ('balance_after', 'm'))
HOUSE_SPEC = (('marginal_rate', 'r'), ('page_loss_room', 'm'), ('page_loss_usable_total', 'm'),
              ('page_loss_carried_total', 'm'), ('page_tax_line_total', 'm'), ('cash_flow_total', 'm'),
              ('page_after_tax_total', 'm'), ('law_net_passive', 'm'), ('law_passive_activity_loss', 'm'),
              ('law_allowance', 'm'), ('law_allowed_against_wages', 'm'), ('law_loss_allowed_total', 'm'),
              ('law_suspended_total', 'm'), ('law_allowed_net', 'm'), ('law_tax_without', 'm'), ('law_tax_with', 'm'),
              ('law_niit_change', 'm'), ('law_tax_change', 'm'), ('law_after_tax_total', 'm'), ('law_minus_page', 'm'),
              ('ratio_law_to_page', 'r'))


def compare_rent(g, cid, a, b):
    g.same(cid, 'number of rentals', len(a['rentals']), len(b['rentals']))
    for i, (x, y) in enumerate(zip(a['rentals'], b['rentals'])):
        for spec in (RENTAL_RESULT_SPEC, RENTAL_LAW_SPEC, RENTAL_DEP_SPEC, RENTAL_LOAN_SPEC):
            g.fields(f'{cid} rental {i + 1}', spec, x, y)
    g.fields(cid, HOUSE_SPEC, a['house'], b['house'])


# ======================================== homes: derivation 2 ========================================

HOME_FIELDS = ('value', 'purchase_price', 'purchase_date', 'improvements', 'sell_share', 'property_tax', 'insurance',
               'hoa_monthly', 'maintenance', 'appreciation', 'loan_balance', 'loan_rate', 'loan_payment')


def months_m1_2(b, t):
    """M1 by stepping: one more month for each (year, month + k, purchase day) that is on or before today, compared
    as plain (year, month, day) triples with no month-end adjustment."""
    k = 0
    while True:
        y, m = divmod(b.year * 12 + b.month - 1 + k + 1, 12)
        if (y, m + 1, b.day) <= (t.year, t.month, t.day):
            k += 1
        else:
            return k


def months_m2_2(b, t):
    return (t.year * 12 + t.month) - (b.year * 12 + b.month)


def months_m3_2(b, t):
    return days_2(b, t) * 48 // 1461            # floor(days x 12 / 365.25)


def full_months_2(b, s):
    """Full months of ownership (L1): the k-th month ends on the purchase day of the k-th month after (the month's last
    day when the purchase was on a month end or the month is shorter)."""
    n = months_m2_2(b, s)
    if b.day == mlen_2(b.year, b.month):
        done = n if s.day == mlen_2(s.year, s.month) else n - 1
    else:
        done = n if s.day >= min(b.day, mlen_2(s.year, s.month)) else n - 1
    return max(0, done)


def first_long_2(b):
    """The holding period starts the day after the purchase; held more than one year from the start's month and day one
    year on (a start on February 29: March 1)."""
    if MUT == 'anniversary_is_long':
        return date(b.year + 1, b.month, 28 if (b.month, b.day) == (2, 29) else b.day)
    s = b + DAY
    if (s.month, s.day) == (2, 29):
        return date(s.year + 1, 3, 1)
    return date(s.year + 1, s.month, s.day)


FIX = 64


def pow_fix(t, n):
    """(t / 2^64)^n in 2^64 fixed point, truncating after each product."""
    res, base = 1 << FIX, t
    while n:
        if n & 1:
            res = (res * base) >> FIX
        n >>= 1
        if n:
            base = (base * base) >> FIX
    return res


def growth_2(value, price, months):
    """(value / price)^(12 / months) - 1 by bisection on t >= 1 with t^months = r^12, in 2^-64 fixed point, where r is
    value / price or, for a fall in value, price / value (then the growth is 1 / t - 1); no logarithms."""
    if months is None or months < 12 or price <= 0 or value <= 0:
        return None
    q = value / price
    r = q if q >= 1 else 1 / q
    target = (r.numerator ** 12 << FIX) // r.denominator ** 12
    lo, hi = 1 << FIX, ((r.numerator << FIX) // r.denominator) + 2
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if pow_fix(mid, months) <= target:
            lo = mid
        else:
            hi = mid
    t = F(lo, 1 << FIX)
    return t - 1 if q >= 1 else 1 / t - 1


def ahead_2(value, appreciation, years):
    """value x (1 + appreciation)^years in integers of 1e-8 dollars (floor)."""
    g = 1 + appreciation
    v8 = value * 10 ** 8
    assert v8.denominator == 1
    return F(int(v8) * g.numerator ** years // g.denominator ** years, 10 ** 8)


def derive_home_2(c):
    year, st = int(c['tax_year']), c['filing_status']
    today, bought = day_2(c['today']), day_2(c['purchase_date'])
    wages = num_2(c['wages'])
    x = {k: (v if k == 'purchase_date' else num_2(v)) for k, v in ((k, c[k]) for k in HOME_FIELDS)}
    value, price = x['value'], x['purchase_price']
    loan = loan_2(x['loan_balance'], x['loan_rate'], x['loan_payment'])
    balance = z_(x['loan_balance']) if loan else ZERO
    m1 = months_m2_2(bought, today) if MUT == 'growth_by_calendar_months' else months_m1_2(bought, today)
    m2, m3 = months_m2_2(bought, today), months_m3_2(bought, today)
    lines = {'cost_property_tax': z_(x['property_tax']), 'cost_insurance': z_(x['insurance']),
             'cost_hoa': 12 * z_(x['hoa_monthly']), 'cost_maintenance': value * dflt(x['maintenance'], MAINT_2),
             'cost_interest': loan['interest'] if loan else ZERO}
    sell = value * dflt(x['sell_share'], SELL_2)
    basis = price + z_(x['improvements'])
    gain = value - sell - basis
    k = key_2(st)
    cap = F(EXCL_2[k])
    page_taxable = max(ZERO, gain - cap)
    page_ti = max(ZERO, wages - R.STANDARD_DEDUCTION[year][st])
    page_rate = ((F(20, 100) if page_ti + page_taxable > PAGE_20_2[k] else F(15, 100))
                 + (F(38, 1000) if wages + page_taxable > PAGE_NIIT_2[k] else ZERO))
    page_tax = page_taxable * page_rate
    days, fm = days_2(bought, today), full_months_2(bought, today)
    meets = days >= (729 if MUT == 'exclusion_729_days' else DAYS_2) or fm >= MONTHS_2
    long_term = today >= first_long_2(bought)
    law_cap = F(250000) if MUT == 'joint_cap_250k' else cap
    law_taxable = (max(ZERO, gain - law_cap) if meets else max(ZERO, gain))
    law_excl = max(ZERO, gain) - law_taxable
    w0 = fed_2(year, st, wages)

    def tax_on(g):
        w = fed_2(year, st, wages, lt=g if long_term else ZERO, stg=ZERO if long_term else g, nii=g)
        return w['total'] - w0['total'], w['niit'] - w0['niit']

    law_tax, law_niit = tax_on(law_taxable)
    frac_d = ONE if meets else F(min(days, DAYS_2), DAYS_2)
    frac_m = ONE if meets else F(min(fm, MONTHS_2), MONTHS_2)
    red_taxable = max(ZERO, max(ZERO, gain) - law_cap * frac_d)
    red_tax, _ = tax_on(red_taxable)
    keep0 = value - sell - balance
    appr = dflt(x['appreciation'], APPR_2)
    out = {'equity': value - balance, 'ltv': None if value == 0 else balance / value,
           'months_owned': m1, 'growth_since_bought': growth_2(value, price, m1),
           'months_owned_m2': m2, 'growth_m2': growth_2(value, price, m2),
           'months_owned_m3': m3, 'growth_m3': growth_2(value, price, m3)}
    out.update(lines)
    out.update({'costs_year': sum(lines.values(), ZERO), 'loan_payments_made': loan['months'] if loan else None,
                'sell_costs': sell, 'basis': basis, 'gain': gain, 'page_exclusion': cap,
                'page_taxable_gain': page_taxable, 'page_taxable_income': page_ti, 'page_rate': page_rate,
                'page_tax': page_tax, 'page_keep': keep0 - page_tax, 'days_owned': days, 'full_months_owned': fm,
                'meets_2_of_5': meets, 'law_exclusion_max': law_cap if meets else ZERO, 'law_exclusion': law_excl,
                'law_taxable_gain': law_taxable, 'first_long_day': first_long_2(bought),
                'term': 'long' if long_term else 'short', 'law_tax_without': w0['total'],
                'law_income_tax': law_tax - law_niit, 'law_niit': law_niit, 'law_tax': law_tax,
                'law_keep': keep0 - law_tax, 'law_minus_page_tax': law_tax - page_tax,
                'reduced_fraction_days': frac_d, 'reduced_fraction_months': frac_m,
                'reduced_max_days': law_cap * frac_d, 'reduced_max_months': law_cap * frac_m,
                'reduced_exclusion': max(ZERO, gain) - red_taxable, 'reduced_taxable_gain': red_taxable,
                'reduced_tax': red_tax, 'reduced_keep': keep0 - red_tax,
                'value_5y': ahead_2(value, appr, 5), 'value_10y': ahead_2(value, appr, 10),
                'value_20y': ahead_2(value, appr, 20)})
    return out


# ======================================== homes: derivation 1 (rules.py) ========================================

def derive_home_1(c):
    h = R.home_case(dict(c))
    year, st = int(c['tax_year']), c['filing_status']
    loan = h['loan']
    lines = {'cost_property_tax': R._or(c['property_tax'], 0), 'cost_insurance': R._or(c['insurance'], 0),
             'cost_hoa': R._or(c['hoa_monthly'], 0) * R.MONTHS_A_YEAR,
             'cost_maintenance': R._F(c['value']) * R._or(c['maintenance'], R.DEFAULT_MAINTENANCE),
             'cost_interest': loan['interest'] if loan else ZERO}
    assert sum(lines.values()) == h['costs_year'], c['case_id']
    w0 = R.federal_tax(year, st, c['wages'])
    out = {'equity': h['equity'], 'ltv': h['ltv'], 'months_owned': h['months_owned']['M1'],
           'growth_since_bought': h['growth_since_bought'], 'months_owned_m2': h['months_owned']['M2'],
           'growth_m2': h['growth_since_bought_M2'], 'months_owned_m3': h['months_owned']['M3'],
           'growth_m3': h['growth_since_bought_M3']}
    out.update(lines)
    out.update({'costs_year': h['costs_year'], 'loan_payments_made': loan['months'] if loan else None,
                'sell_costs': h['sell_costs'], 'basis': h['basis'], 'gain': h['gain'],
                'page_exclusion': h['page_exclusion'], 'page_taxable_gain': h['page_taxable_gain'],
                'page_taxable_income': h['page_taxable_income'], 'page_rate': h['page_rate'],
                'page_tax': h['page_tax'], 'page_keep': h['page_keep'], 'days_owned': h['days_owned'],
                'full_months_owned': h['full_months_owned'], 'meets_2_of_5': h['meets_2_of_5'],
                'law_exclusion_max': h['law_exclusion_max'], 'law_exclusion': h['law_exclusion'],
                'law_taxable_gain': h['law_taxable_gain'], 'first_long_day': h['first_long_day'], 'term': h['term'],
                'law_tax_without': w0['total'], 'law_income_tax': h['law_tax'] - h['law_niit'],
                'law_niit': h['law_niit'], 'law_tax': h['law_tax'], 'law_keep': h['law_keep'],
                'law_minus_page_tax': h['law_tax'] - h['page_tax'],
                'reduced_fraction_days': h['reduced_fraction_days'],
                'reduced_fraction_months': h['reduced_fraction_months'], 'reduced_max_days': h['reduced_max_days'],
                'reduced_max_months': h['reduced_max_months'], 'reduced_exclusion': h['reduced_exclusion'],
                'reduced_taxable_gain': h['reduced_taxable_gain'], 'reduced_tax': h['reduced_tax'],
                'reduced_keep': h['reduced_keep'], 'value_5y': h['values_ahead'][5],
                'value_10y': h['values_ahead'][10], 'value_20y': h['values_ahead'][20],
                '_loan': loan, '_w0': w0})
    return out


HOME_SPEC = (('equity', 'm'), ('ltv', 'r'), ('months_owned', 's'), ('growth_since_bought', 'r'),
             ('months_owned_m2', 's'), ('growth_m2', 'r'), ('months_owned_m3', 's'), ('growth_m3', 'r'),
             ('cost_property_tax', 'm'), ('cost_insurance', 'm'), ('cost_hoa', 'm'), ('cost_maintenance', 'm'),
             ('cost_interest', 'm'), ('costs_year', 'm'), ('loan_payments_made', 's'), ('sell_costs', 'm'),
             ('basis', 'm'), ('gain', 'm'), ('page_exclusion', 'm'), ('page_taxable_gain', 'm'),
             ('page_taxable_income', 'm'), ('page_rate', 'r'), ('page_tax', 'm'), ('page_keep', 'm'),
             ('days_owned', 's'), ('full_months_owned', 's'), ('meets_2_of_5', 's'), ('law_exclusion_max', 'm'),
             ('law_exclusion', 'm'), ('law_taxable_gain', 'm'), ('first_long_day', 's'), ('term', 's'),
             ('law_tax_without', 'm'), ('law_income_tax', 'm'), ('law_niit', 'm'), ('law_tax', 'm'), ('law_keep', 'm'),
             ('law_minus_page_tax', 'm'), ('reduced_fraction_days', 'r'), ('reduced_fraction_months', 'r'),
             ('reduced_max_days', 'm'), ('reduced_max_months', 'm'), ('reduced_exclusion', 'm'),
             ('reduced_taxable_gain', 'm'), ('reduced_tax', 'm'), ('reduced_keep', 'm'), ('value_5y', 'm'),
             ('value_10y', 'm'), ('value_20y', 'm'))


# ======================================== edge cases ========================================

def Rt(price, placed, value, rent, **kw):
    """A rental's CSV fields (strings); unnamed fields blank."""
    r = {k: '' for k in RENTAL_FIELDS}
    r.update(purchase_price=str(price), purchase_date=placed, value=str(value), rent_monthly=str(rent))
    for k, v in kw.items():
        assert k in RENTAL_FIELDS, k
        r[k] = str(v)
    return r


def result_rental(target, placed='2015-01', **kw):
    """A rental whose taxable result is `target` exactly in a tax year with a full year of depreciation: price 275,000
    (basis 220,000: 8,000 a year), no vacancy, no maintenance; a large loss through an interest-only loan at 6%."""
    rent = 2000 + 1000 * max(0, -(-(target - 13000) // 12000))
    fields = dict(vacancy='0', maintenance='0', insurance='0', cash_in='60000')
    noi_less_interest = target + 8000
    if noi_less_interest >= 3000 or target >= 0:
        fields['property_tax'] = str(12 * rent - noi_less_interest)
        value = 300000
    else:
        j = (12 * rent - 3000 - noi_less_interest) // 12     # interest 12 j a year on a loan of 200 j at 6%
        fields.update(loan_balance=str(200 * j), loan_rate='0.06', loan_payment=str(j))
        fields['property_tax'] = str(12 * rent - 12 * j - noi_less_interest)
        value = 200 * j + 100000
    fields.update(kw)
    return Rt(275000, placed, value, rent, **fields)


DUPLEX = Rt(400000, '2019-03', 520000, 3400, improvements=10000, property_tax=6200, insurance=1800, hoa_monthly=0,
            management='0.08', utilities_monthly=150, other_monthly=0, cash_in=410000)
JUN_A = Rt(275000, '2015-01', 300000, 2000, improvements=0, property_tax=2800, insurance=1000, hoa_monthly=0,
           utilities_monthly=0, other_monthly=0, cash_in=275000)
JUN_B = Rt(400000, '2012-06', 755000, 2500, improvements=10000, property_tax=9000, insurance=2500, hoa_monthly=300,
           management='0.10', utilities_monthly=200, other_monthly=50, loan_balance=300000, loan_rate='0.06',
           loan_payment=1500, cash_in=80000)
KIT = Rt(275000, '2016-09', 350000, 1500, improvements=0, property_tax=1500, insurance=900, hoa_monthly=0,
         management='', utilities_monthly=100, other_monthly=0, loan_balance=240000, loan_rate='0.05',
         loan_payment=1000, cash_in=60000)


def rent_case(year, today, st, wages, rentals, note, apart=''):
    if st == 'married_separate' and apart == '':
        apart = 'no'
    return {'row_kind': 'edge', 'tax_year': str(year), 'today': today, 'filing_status': st,
            'lived_apart_all_year': apart, 'wages': str(wages),
            'rentals': ';'.join('|'.join(r[k] for k in RENTAL_FIELDS) for r in rentals), 'edge_note': note}


def rent_edges():
    E = []
    a = E.append
    a(rent_case(2026, '2026-11-16', 'single', 85000, [DUPLEX],
                "RULES.md 9.1 Ivo's duplex: taxable +8,659.20; law and page agree (8,659.20 x 22% = 1,905.02)"))
    a(rent_case(2026, '2026-11-16', 'single', 90000, [JUN_A, JUN_B],
                "RULES.md 9.2 Jun at wages 90,000: A's +8,000 absorbs part of B's -30,000 by law, nothing suspended "
                "(law -4,840.00); the page carries 5,000 (page -3,740.00)"))
    a(rent_case(2026, '2026-11-16', 'single', 130000, [JUN_A, JUN_B],
                'RULES.md 9.2 Jun at wages 130,000: law suspends 12,000 (law -2,364.00), the page carries 20,000 '
                '(page -480.00)'))
    a(rent_case(2025, '2025-12-01', 'married_separate', 60000, [KIT],
                'RULES.md 9.3 Kit, separate return, lived with the spouse: no allowance by law (469(i)(5)(B)), the '
                'whole 10,000 suspended; the page uses 7,500 (page -900.00)', apart='no'))
    a(rent_case(2025, '2025-12-01', 'married_separate', 60000, [KIT],
                'RULES.md 9.3 Kit had they lived apart all year: 12,500 - 50% x 10,000 = 7,500 both ways (-900.00)',
                apart='yes'))
    a(rent_case(2026, '2026-11-16', 'married_joint', 300000, [DUPLEX],
                'RULES.md 9.4 Mo and Noor: the law adds 3.8% x 8,659.20 = 329.05 on the net rental income '
                '(1411(c)(1)(A)(i)); the page leaves it out'))
    a(rent_case(2025, '2025-09-30', 'married_separate', 40000,
                [result_rental(-9000), result_rental(-16000), result_rental(4000)],
                'P925 Terry (1.469-1T(f)(2)(i)(D) Example 1): A -9,000, B -16,000, C +4,000, no allowance (separate '
                'return, lived together): suspended 7,560 and 13,440', apart='no'))
    a(rent_case(2025, '2025-09-30', 'single', 70000, [result_rental(15000), result_rental(-26000)],
                'P925 example: $70,000 wages, $15,000 passive income, $26,000 rental loss: 15,000 offsets the income, '
                '11,000 the wages'))
    a(rent_case(2025, '2025-09-30', 'single', 120000, [result_rental(-31000)],
                'P925 phaseout example: $120,000 salary, $31,000 rental loss: deduct 15,000, carry 16,000'))
    for st, year in (('single', 2025), ('married_joint', 2026), ('head_of_household', 2025)):
        for w in (60000, 100000, 125000, 150000, 160000):
            a(rent_case(year, f'{year}-08-20', st, w, [result_rental(-30000)],
                        f'wages {w:,}: allowance {max(0, 25000 - max(0, w - 100000) // 2):,} by law and page'))
    for w in (40000, 50000, 62500, 75000, 80000):
        a(rent_case(2026, '2026-08-20', 'married_separate', w, [result_rental(-15000)],
                    f'separate return, lived apart all year, wages {w:,}: allowance '
                    f'{max(0, 12500 - max(0, w - 50000) // 2):,} (469(i)(5)(A))', apart='yes'))
    for w in (40000, 62500):
        a(rent_case(2026, '2026-08-20', 'married_separate', w, [result_rental(-15000)],
                    f'separate return, lived together, wages {w:,}: no allowance by law; the page gives '
                    f'{max(0, 12500 - max(0, w - 50000) // 2):,}', apart='no'))
    a(rent_case(2026, '2026-05-05', 'single', 140000, [result_rental(20000), result_rental(-30000)],
                'netting with the allowance binding: +20,000 / -30,000 at wages 140,000 (allowance 5,000): law '
                'allows 25,000 (20,000 + 5,000) and suspends 5,000; the page carries 25,000'))
    a(rent_case(2025, '2025-05-05', 'head_of_household', 90000,
                [result_rental(30000), result_rental(-10000), result_rental(-5000)],
                'income covers every loss: +30,000 / -10,000 / -5,000, net +15,000: nothing is limited'))
    a(rent_case(2025, '2025-05-05', 'single', 130000,
                [result_rental(-12000), result_rental(-9000), result_rental(-6000)],
                'three losses over an allowance of 10,000: law suspends 17,000 pro rata (7,555.56 / 5,666.67 / '
                '3,777.78); the page uses the 10,000 in order (10,000 / 0 / 0)'))
    a(rent_case(2026, '2026-10-01', 'single', 195000, [result_rental(10000)],
                'NIIT part way: MAGI 205,000, 3.8% x 5,000 = 190.00 by law'))
    a(rent_case(2026, '2026-10-01', 'married_separate', 120000, [result_rental(10000)],
                'NIIT on a separate return: threshold 125,000 (1411(b)(2)): 3.8% x 5,000', apart='yes'))
    a(rent_case(2025, '2025-10-01', 'married_joint', 240000, [result_rental(25000), result_rental(-5000)],
                'NIIT on the net: +25,000 / -5,000, MAGI 260,000: 3.8% x 10,000 = 380.00'))
    a(rent_case(2026, '2026-10-01', 'head_of_household', 230000, [result_rental(-4000)],
                'NIIT off: a net rental loss is no net investment income'))
    a(rent_case(2025, '2025-06-30', 'single', 15000, [result_rental(5000)],
                'marginal rate straddles the standard deduction (15,750): $1,000 more is taxed on 250 only: 0.025'))
    a(rent_case(2026, '2026-06-30', 'head_of_household', 0, [result_rental(3000)],
                'no wages: marginal rate 0; the rental income is under the standard deduction'))
    a(rent_case(2026, '2026-06-30', 'single', 10000, [result_rental(-20000)],
                'the allowed loss exceeds the wages: AGI -10,000 (no net operating loss modelled); no tax either way'))
    a(rent_case(2026, '2026-03-15', 'single', 70000,
                [Rt(180000, '2010-04', 240000, 1600, property_tax=2400, insurance=900, loan_balance=4000,
                    loan_rate='0.06', loan_payment=1000, cash_in=40000)],
                'loan paid off in month 5: 1,000 x 4 + the rest'))
    a(rent_case(2025, '2025-03-15', 'married_joint', 110000,
                [Rt(210000, '2018-10', 260000, 1700, property_tax=3100, insurance=1100, loan_balance=50000,
                    loan_rate='0', loan_payment=500, cash_in=30000)],
                'loan at a rate of 0: no interest, principal 6,000'))
    a(rent_case(2025, '2025-03-15', 'married_joint', 110000,
                [Rt(260000, '2021-02', 280000, 1800, property_tax=3300, insurance=1300, loan_balance=200000,
                    loan_rate='0.06', loan_payment=800, cash_in=60000)],
                'payment below the interest (1,000 a month): interest counted at what was paid, principal 0'))
    a(rent_case(2026, '2026-03-15', 'single', 88000,
                [Rt(150000, '2008-07', 210000, 1300, property_tax=2000, insurance=800, loan_balance=0,
                    loan_rate='0.05', loan_payment=500, cash_in=150000)],
                'a loan typed with a balance of 0: no payments, DSCR blank'))
    a(rent_case(2026, '2026-04-01', 'single', 95000,
                [Rt(320000, '2014-05', 0, 2100, property_tax=3500, insurance=1200, loan_balance=150000,
                    loan_rate='0.045', loan_payment=1100, cash_in=70000)],
                'value 0: cap rate blank, no maintenance or growth, equity below 0 so return on equity blank'))
    a(rent_case(2025, '2025-04-01', 'head_of_household', 72000,
                [Rt(190000, '2017-11', 230000, 1550, property_tax=2600, insurance=950),
                 Rt(240000, '2019-02', 270000, 1900, property_tax=3000, insurance=1000, cash_in=0)],
                'cash in blank and cash in 0: cash-on-cash blank'))
    a(rent_case(2026, '2026-09-09', 'married_joint', 130000,
                [Rt(200000, '2020-06', 240000, 0, property_tax=2900, insurance=1000, cash_in=200000)],
                'no rent: vacancy 0, break-even blank, the costs and depreciation make a loss'))
    a(rent_case(2026, '2026-09-09', 'single', 64000,
                [Rt(0, '2020-06', 90000, 900, improvements=27500, property_tax=1200, insurance=600)],
                'purchase price 0 (inherited at no cost in this invented case): one-percent blank, basis = the '
                '27,500 of improvements'))
    for year, placed, note in ((2025, '1998-03', 'March 1998: the last year of depreciation in 2025 (8.5 of 12 months)'),
                               (2026, '1998-03', 'March 1998: fully depreciated in 2025, nothing in 2026'),
                               (2026, '1998-08', 'August 1998: recovery year 29, the last, 1.5 months in 2026'),
                               (2026, '1999-06', 'June 1999: recovery year 28, the last, 11.5 months in 2026'),
                               (2026, '1998-12', 'December 1998: recovery year 29, the last, 5.5 months in 2026')):
        a(rent_case(year, f'{year}-07-07', 'single', 82000,
                    [Rt(250000, placed, 420000, 2300, property_tax=3200, insurance=1100, cash_in=250000)], note))
    a(rent_case(2026, '2026-11-16', 'married_joint', 150000,
                [Rt(350000, '2026-11', 360000, 2600, property_tax=4200, insurance=1400, loan_balance=280000,
                    loan_rate='0.065', loan_payment=1769.79, cash_in=80000)],
                'placed in service this month: 1.5 months of depreciation; the page counts 12 months of rent and costs '
                '(C6)'))
    a(rent_case(2025, '2025-03-01', 'single', 99000,
                [Rt(300000, '2025-01', 310000, 2200, property_tax=3600, insurance=1200, cash_in=300000)],
                'placed in service in January of the tax year: 11.5 months'))
    a(rent_case(2026, '2026-02-02', 'single', 105000, [result_rental(0)],
                'taxable exactly 0: tax line 0 either way'))
    a(rent_case(2025, '2025-12-31', 'married_separate', 58000,
                [result_rental(6000), result_rental(-14000), result_rental(-4000)],
                'separate return, lived apart, wages 58,000 (allowance 8,500): +6,000 absorbs part of 18,000 of '
                'losses; law allows 8,500 more and suspends 3,500 pro rata', apart='yes'))
    a(rent_case(2026, '2026-12-31', 'married_joint', 99000,
                [result_rental(-12000), result_rental(-20000)],
                'all losses at wages 99,000: 32,000 of losses over the 25,000 allowance; law 2,625 / 4,375 '
                'suspended pro rata, the page 0 / 7,000 in order'))
    return E


def Hm(year, today, st, wages, value, price, bought, note, **kw):
    h = {k: '' for k in HOME_FIELDS}
    h.update(row_kind='edge', tax_year=str(year), today=today, filing_status=st, wages=str(wages), value=str(value),
             purchase_price=str(price), purchase_date=bought, edge_note=note)
    for k, v in kw.items():
        assert k in HOME_FIELDS, k
        h[k] = str(v)
    return h


def home_for_gain(year, st, wages, target, held, note, today=None, price=300000, **kw):
    """A home whose law taxable gain is `target` exactly: value in whole dollars, selling costs 6% (blank), the price set
    to what is left. held: 'long' (bought 2008-04-20, the exclusion applies) or 'short_test' (500 days, long-term, no
    exclusion)."""
    today = today or date(year, 7, 15)
    bought = date(2008, 4, 20) if held == 'long' else today - 500 * DAY
    excl = (500000 if st == 'married_joint' else 250000) if held == 'long' else 0
    need = target + excl + price
    v = -(-need * 100 // 94)
    p = F(v) - F(v) * F(6, 100) - excl - target
    return Hm(year, today.isoformat(), st, wages, v, money(p), bought.isoformat(), note, **kw)


def home_edges():
    E = []
    a = E.append
    pat = dict(improvements=5000, property_tax=5500, insurance=1600, hoa_monthly=0, loan_balance=360000,
               loan_rate='0.06', loan_payment=2200)
    a(Hm(2026, '2026-11-16', 'single', 95000, 460000, 400000, '2025-05-16',
         'RULES.md 9.5 Pat: bought 18 months ago (549 days): no exclusion by law, 15% x 27,400 = 4,110.00; the page '
         'applies the exclusion (tax 0)', **pat))
    a(Hm(2026, '2026-11-16', 'single', 95000, 460000, 400000, '2026-01-16',
         'RULES.md 9.5 Pat bought 2026-01-16: short-term, 22% x 26,800 + 24% x 600 = 6,040.00', **pat))
    a(Hm(2026, '2026-11-16', 'single', 180000, 1200000, 380000, '2004-06-15',
         'RULES.md 9.6 Quinn: 700,000 gain, 450,000 taxable: law 70,920 + 16,340 = 87,260.00; page 23.8% = 107,100.00',
         improvements=48000, property_tax=14000, insurance=3000, hoa_monthly=0, loan_balance=150000, loan_rate='0.04',
         loan_payment=1600))
    base = dict(property_tax=4200, insurance=1300, loan_balance=210000, loan_rate='0.055', loan_payment=1650)
    for today, bought, note in (
            ('2025-11-01', '2023-11-02', '1.121-1(c)(1): 730 days but 23 full months (February 29, 2024 inside): met'),
            ('2025-10-31', '2023-11-02', '729 days, 23 full months: not met'),
            ('2026-03-01', '2024-03-01', '730 days and 24 full months: met'),
            ('2026-02-28', '2024-03-02', '728 days, 23 full months: not met'),
            ('2026-03-01', '2024-03-02', '729 days (no February 29 inside), 23 full months: not met'),
            ('2026-06-10', '2025-06-10', 'sold on the anniversary: held exactly 1 year, short-term (1222(1))'),
            ('2026-06-11', '2025-06-10', 'sold the day after the anniversary: long-term'),
            ('2025-02-28', '2024-02-29', 'bought February 29, 2024, sold 2025-02-28: short-term (long from March 1)'),
            ('2025-03-01', '2024-02-29', 'bought February 29, 2024, sold 2025-03-01: long-term'),
            ('2026-02-28', '2024-02-29', 'bought February 29, 2024, sold 2026-02-28: 730 days and 24 full months (L1)'),
            ('2026-02-28', '2025-01-31', 'whole months: M1 12, M2 13, M3 12 (bought on a month end)'),
            ('2026-03-14', '2025-03-15', 'whole months: M1 11 (no growth figure), M2 12, M3 11')):
        year = int(today[:4])
        a(Hm(year, today, 'single', 85000, 420000, 360000, bought, note, improvements=2000, **base))
    a(Hm(2025, '2025-12-31', 'single', 85000, 362000, 360000, '2025-12-31',
         'bought today: 0 days, 0 months; a loss of the selling costs', improvements=2000, **base))
    a(Hm(2026, '2026-05-20', 'single', 120000, 600000, 314000, '2001-09-09',
         'gain exactly the 250,000 exclusion: taxable 0', sell_share='0.06', improvements='0'))
    a(Hm(2025, '2025-05-20', 'married_joint', 160000, '850000.01', 350000, '2001-09-09',
         'gain 500,000.01 on a joint return: 0.01 taxable', sell_share='0'))
    a(Hm(2026, '2026-05-20', 'head_of_household', 70000, 380000, 395000, '2019-01-10',
         'a loss: not deductible (P523); no tax either way'))
    for year in (2025, 2026):
        for j, st in enumerate(STATUSES):
            sd = R.STANDARD_DEDUCTION[year][st]
            zt, ft = R.CG_ZERO_TOP[year][st], R.CG_15_TOP[year][st]
            for k, (ti, g, label) in enumerate(((10000, 15000, 'all in the 0% band'),
                                                (zt - 10000, 30000, 'straddles the 0% top'),
                                                (zt + 20000, 60000, 'all at 15%'),
                                                (ft - 40000, 100000, 'straddles the 15% top'),
                                                (ft + 25000, 80000, 'all at 20%'))):
                held = 'long' if (j + k) % 2 == 0 else 'short_test'
                a(home_for_gain(year, st, sd + ti, g, held,
                                f'{year} {st}: taxable gain {g:,} on top of {ti:,} of ordinary taxable income: {label} '
                                f'(0% to {zt:,}, 15% to {ft:,})' + ('' if held == 'long' else '; held 500 days: long-term, '
                                                                   'no exclusion')))
            thr = R.NIIT_THRESHOLD[st]
            for over, label in ((0, 'MAGI exactly at the 3.8% line: no NIIT'), (20000, 'MAGI 20,000 over the line')):
                a(home_for_gain(year, st, thr - 50000 + over, 50000, 'long',
                                f'{year} {st}: {label} ({thr:,}); taxable gain 50,000'))
    # the page's own lines
    a(Hm(2026, '2026-04-04', 'single', 100000, 999500, 300000, '2003-03-03',
         "the page's 20% line exactly: 83,900 + 449,500 = 533,400, not over it (15% + 3.8%)", sell_share='0'))
    a(Hm(2026, '2026-04-04', 'single', 100000, '999500.01', 300000, '2003-03-03',
         "the page's 20% line plus a cent: 20% + 3.8% on the whole gain", sell_share='0'))
    a(Hm(2025, '2025-04-04', 'single', 60000, 690000, 300000, '2003-03-03',
         "the page's 3.8% line exactly: 60,000 + 140,000 = 200,000 (no 3.8%)", sell_share='0'))
    a(Hm(2025, '2025-04-04', 'single', 60000, '690000.01', 300000, '2003-03-03',
         "the page's 3.8% line plus a cent: 3.8% on the whole gain", sell_share='0'))
    a(Hm(2025, '2025-04-04', 'married_joint', 200000, 1231550, 300000, '1999-12-12',
         "joint 2025: 168,500 + 431,550 = 600,050, not over the page's 20% line (15% + 3.8%), and the law's 15% top "
         "(all at 15%)",
         sell_share='0'))
    a(Hm(2026, '2026-04-04', 'married_separate', 100000, 600000, 300000, '2002-02-02',
         'separate: the law\'s 3.8% line is 125,000, the page\'s 200,000 (MAGI 150,000)', sell_share='0'))
    a(Hm(2025, '2025-04-04', 'head_of_household', 90000, 790000, 50000, '1990-05-05',
         "head of household: the law's 15% top 566,700, the page's 20% line 533,400", sell_share='0',
         improvements=13625))
    a(Hm(2026, '2026-09-30', 'married_joint', 650000, 1500000, 1100000, '2026-01-02',
         'short-term on a high income: 325,000 of gain at 35% / 37%', sell_share='0.05'))
    a(Hm(2026, '2026-09-30', 'single', 72000, 310000, 140000, '1975-01-01', 'bought in 1975'))
    a(Hm(2025, '2025-08-08', 'married_joint', 140000, 650000, 410000, '2012-08-08', 'no mortgage'))
    a(Hm(2025, '2025-08-08', 'married_joint', 140000, 650000, 410000, '2012-08-08',
         'mortgage paid off in month 3', loan_balance=5000, loan_rate='0.045', loan_payment=2000))
    a(Hm(2026, '2026-08-08', 'single', 90000, 380000, 300000, '2016-08-08', 'mortgage at a rate of 0',
         loan_balance=24000, loan_rate='0', loan_payment=400))
    a(Hm(2026, '2026-08-08', 'single', 90000, 380000, 300000, '2016-08-08', 'interest-only mortgage',
         loan_balance=240000, loan_rate='0.06', loan_payment=1200))
    a(Hm(2026, '2026-08-08', 'head_of_household', 90000, 300000, 420000, '2022-06-08',
         'mortgage above the value: equity below 0, a loss on the sale, the keep figure below 0',
         loan_balance=390000, loan_rate='0.065', loan_payment=2600))
    a(Hm(2025, '2025-08-08', 'single', 0, 0, 200000, '2010-01-01', 'value 0: LTV and growth blank', loan_balance=10000,
         loan_rate='0.05', loan_payment=500))
    return E


# ======================================== random cases ========================================

def pick(rng, weighted):
    total = sum(w for _, w in weighted)
    k = rng.randrange(total)
    for v, w in weighted:
        if k < w:
            return v
        k -= w
    raise AssertionError


def cents_str(c):
    return f'{c // 100}.{c % 100:02d}'


def rate_str(bps):
    """Basis points -> a decimal string ('0.0425'; '0.06'; '0')."""
    if bps == 0:
        return '0'
    whole, frac = divmod(bps, 10000)
    return f'{whole}.{frac:04d}'.rstrip('0').rstrip('.')


def amortizing_payment(balance_cents, bps, months):
    b = F(balance_cents, 100)
    if bps == 0:
        return money(b / months)
    r = F(bps, 120000)
    return money(b * r / (1 - (1 + r) ** -months))


def random_loan(rng, value_dollars):
    kind = pick(rng, (('none', 30), ('amortizing', 52), ('payoff', 6), ('zero_rate', 4), ('interest_only', 6),
                      ('negative', 2)))
    top = max(1000, value_dollars)
    if kind == 'none':
        return kind, ('', '', '')
    if kind == 'amortizing':
        bal = top * rng.randint(10, 90) + rng.randrange(100)
        bps = rng.randint(250, 850)
        return kind, (cents_str(bal), rate_str(bps), amortizing_payment(bal, bps, 12 * rng.randint(3, 30)))
    if kind == 'payoff':
        bal = rng.randint(20000, 3000000)
        bps = rng.randint(0, 900)
        k = rng.randint(1, 11)
        pay = -(-bal * (120000 + k * bps) // (120000 * k)) + rng.randint(0, 5000)
        return kind, (cents_str(bal), rate_str(bps), cents_str(pay))
    if kind == 'zero_rate':
        bal = rng.randint(100000, 10000000)
        return kind, (cents_str(bal), '0', cents_str(rng.randint(10000, 300000)))
    if kind == 'interest_only':
        j = rng.randint(5, max(6, top // 7000))
        bps = rng.randint(300, 800)
        return kind, (str(6000 * j), rate_str(bps), cents_str(j * bps * 5))
    bal = top * rng.randint(30, 90)
    bps = rng.randint(500, 800)
    interest_c = bal * bps // 120000
    return kind, (cents_str(bal), rate_str(bps), cents_str(interest_c * rng.randint(50, 95) // 100))


def random_rental(rng, today):
    py = rng.randint(1998, today.year)
    pm = rng.randint(1, 12 if py < today.year else today.month)
    pk = rng.randint(60, 1500)
    price = str(pk * 1000) if rng.randrange(10) else cents_str(pk * 100000 + rng.randint(-99999, 99999))
    v = 0 if rng.randrange(150) == 0 else pk * rng.randint(70, 320) * 10
    loan_kind, (lb, lr, lp) = random_loan(rng, v)
    r = {'purchase_price': price, 'purchase_date': f'{py}-{pm:02d}',
         'land_share': pick(rng, (('', 45), ('0.1', 5), ('0.15', 10), ('0.2', 10), ('0.25', 15), ('0.3', 10),
                                  ('0.35', 5))),
         'improvements': pick(rng, (('', 35), ('0', 15), ('x', 50))),
         'value': str(v),
         'rent_monthly': str(max(5, (v or pk * 1000) * rng.randint(35, 110) // 10000 // 5 * 5)),
         'vacancy': pick(rng, (('', 45), ('0', 10), ('0.03', 10), ('0.05', 10), ('0.08', 15), ('0.1', 7),
                               ('0.125', 3))),
         'property_tax': str((v or pk * 1000) * rng.randint(40, 250) // 10000),
         'insurance': str(rng.randint(500, 4500)),
         'hoa_monthly': pick(rng, (('', 40), ('0', 30), ('x', 30))),
         'maintenance': pick(rng, (('', 45), ('0', 5), ('0.005', 10), ('0.0075', 5), ('0.01', 15), ('0.015', 10),
                                   ('0.02', 10))),
         'management': pick(rng, (('', 45), ('0', 10), ('0.06', 10), ('0.08', 15), ('0.1', 15), ('0.12', 5))),
         'utilities_monthly': pick(rng, (('', 35), ('0', 25), ('x', 40))),
         'other_monthly': pick(rng, (('', 50), ('0', 20), ('x', 30))),
         'loan_balance': lb, 'loan_rate': lr, 'loan_payment': lp,
         'cash_in': pick(rng, (('', 15), ('0', 3), ('x', 82))),
         'appreciation': pick(rng, (('', 45), ('0', 5), ('0.02', 10), ('0.025', 5), ('0.03', 10), ('0.04', 10),
                                    ('0.05', 10), ('-0.01', 5)))}
    if r['improvements'] == 'x':
        r['improvements'] = str(rng.randint(1, 120) * 500)
    if r['hoa_monthly'] == 'x':
        r['hoa_monthly'] = str(rng.randint(25, 650))
    if r['utilities_monthly'] == 'x':
        r['utilities_monthly'] = str(rng.randint(20, 450))
    if r['other_monthly'] == 'x':
        r['other_monthly'] = str(rng.randint(5, 250))
    if r['cash_in'] == 'x':
        r['cash_in'] = str(pk * 10 * rng.randint(10, 100))
    return r, loan_kind


def random_rent_wages(rng, year, st, apart):
    if st == 'married_separate':
        band = pick(rng, (('under 50,000', 22), ('50,000', 3), ('50,000-75,000', 25), ('75,000', 3),
                          ('75,000-125,000', 22), ('NIIT range', 25)))
        w = {'under 50,000': lambda: rng.randint(0, 49999), '50,000': lambda: 50000,
             '50,000-75,000': lambda: rng.randint(50001, 74999), '75,000': lambda: 75000,
             '75,000-125,000': lambda: rng.randint(75001, 125000),
             'NIIT range': lambda: rng.randint(110000, 400000)}[band]()
        return w, band
    sd, thr = R.STANDARD_DEDUCTION[year][st], R.NIIT_THRESHOLD[st]
    band = pick(rng, (('near the standard deduction', 4), ('under 100,000', 30), ('100,000', 3),
                      ('100,000-150,000', 25), ('150,000', 3), ('150,000-200,000', 12), ('NIIT range', 17),
                      ('high', 6)))
    w = {'near the standard deduction': lambda: rng.randint(max(0, sd - 1500), sd + 1500),
         'under 100,000': lambda: rng.randint(0, 99999), '100,000': lambda: 100000,
         '100,000-150,000': lambda: rng.randint(100001, 149999), '150,000': lambda: 150000,
         '150,000-200,000': lambda: rng.randint(150001, 199999),
         'NIIT range': lambda: rng.randint(thr - 30000, thr + 200000),
         'high': lambda: rng.randint(400000, 1500000)}[band]()
    return w, band


def random_rent_case(rng):
    year = rng.choice((2025, 2026))
    st = pick(rng, (('single', 32), ('married_joint', 32), ('married_separate', 16), ('head_of_household', 20)))
    apart = rng.choice(('yes', 'no')) if st == 'married_separate' else ''
    today = date(year, 1, 1) + rng.randrange(365) * DAY
    wages, band = random_rent_wages(rng, year, st, apart)
    n = pick(rng, ((1, 45), (2, 35), (3, 20)))
    rentals, kinds = [], []
    for _ in range(n):
        r, k = random_rental(rng, today)
        rentals.append(r)
        kinds.append(k)
    c = {'row_kind': 'random', 'tax_year': str(year), 'today': today.isoformat(), 'filing_status': st,
         'lived_apart_all_year': apart, 'wages': str(wages),
         'rentals': ';'.join('|'.join(r[k] for k in RENTAL_FIELDS) for r in rentals), 'edge_note': ''}
    return c, band, kinds


def random_home_wages(rng, st):
    thr = R.NIIT_THRESHOLD[st]
    band = pick(rng, (('low', 10), ('middle', 30), ('upper', 25), ('NIIT range', 20), ('high', 10), ('top', 5)))
    w = {'low': lambda: rng.randint(0, 40000), 'middle': lambda: rng.randint(40001, 150000),
         'upper': lambda: rng.randint(150001, 300000), 'NIIT range': lambda: rng.randint(thr - 50000, thr + 100000),
         'high': lambda: rng.randint(300001, 700000), 'top': lambda: rng.randint(700001, 2000000)}[band]()
    return w, band


def random_home_case(rng):
    year = rng.choice((2025, 2026))
    st = pick(rng, (('single', 32), ('married_joint', 32), ('married_separate', 14), ('head_of_household', 22)))
    today = date(year, 1, 1) + rng.randrange(365) * DAY
    wages, band = random_home_wages(rng, st)
    held = pick(rng, (('under 1 year', 12), ('about 1 year', 4), ('1-2 years', 16), ('about 2 years', 5),
                      ('2-5 years', 13), ('over 5 years', 50)))
    if held == 'under 1 year':
        bought = today - rng.randint(0, 364) * DAY
    elif held == 'about 1 year':
        y = today.year - 1
        try:
            a = today.replace(year=y)
        except ValueError:
            a = date(y, 2, 28)
        bought = a + rng.randint(-1, 1) * DAY
    elif held == '1-2 years':
        bought = today - rng.randint(366, 729) * DAY
    elif held == 'about 2 years':
        bought = today - rng.randint(727, 733) * DAY
    elif held == '2-5 years':
        bought = today - rng.randint(731, 1826) * DAY
    else:
        bought = today - (rng.randint(5, 45) * 365 + rng.randrange(365)) * DAY
    pk = rng.randint(80, 2000)
    price = str(pk * 1000) if rng.randrange(10) else cents_str(pk * 100000 + rng.randint(-99999, 99999))
    factor = rng.randint(85, 135) if held in ('under 1 year', 'about 1 year', '1-2 years', 'about 2 years') else \
        rng.randint(90, 170) if held == '2-5 years' else rng.randint(110, 600)
    v = pk * factor * 10
    loan_kind, (lb, lr, lp) = random_loan(rng, v)
    h = {'value': str(v), 'purchase_price': price, 'purchase_date': bought.isoformat(),
         'improvements': pick(rng, (('', 30), ('0', 20), ('x', 50))),
         'sell_share': pick(rng, (('', 50), ('0', 3), ('0.05', 15), ('0.055', 7), ('0.06', 10), ('0.07', 10),
                                  ('0.08', 5))),
         'property_tax': str(v * rng.randint(30, 250) // 10000), 'insurance': str(rng.randint(600, 6000)),
         'hoa_monthly': pick(rng, (('', 40), ('0', 30), ('x', 30))),
         'maintenance': pick(rng, (('', 50), ('0', 5), ('0.005', 10), ('0.01', 15), ('0.015', 10), ('0.02', 10))),
         'appreciation': pick(rng, (('', 45), ('0', 5), ('0.02', 10), ('0.03', 10), ('0.04', 10), ('0.05', 10),
                                    ('-0.02', 5), ('0.0275', 5))),
         'loan_balance': lb, 'loan_rate': lr, 'loan_payment': lp}
    if h['improvements'] == 'x':
        h['improvements'] = str(rng.randint(1, 200) * 500)
    if h['hoa_monthly'] == 'x':
        h['hoa_monthly'] = str(rng.randint(20, 900))
    h.update(row_kind='random', tax_year=str(year), today=today.isoformat(), filing_status=st, wages=str(wages),
             edge_note='')
    return h, band, held, loan_kind


# ======================================== RULES.md examples, worked by derivation 2 ========================================

def check_examples():
    """RULES.md section 9 and the sources' own examples, through derivation 2 only."""
    n = 0
    re_, he = rent_edges(), home_edges()

    def r2(prefix):
        hits = [c for c in re_ if c['edge_note'].startswith(prefix)]
        assert len(hits) == 1, ('edge note prefix', prefix, len(hits))
        return derive_rent_2(hits[0])

    def h2(prefix):
        hits = [c for c in he if c['edge_note'].startswith(prefix)]
        assert len(hits) == 1, ('edge note prefix', prefix, len(hits))
        return derive_home_2(hits[0])

    # depreciation
    for m in range(1, 13):
        assert tuple(F(x, 1000) for x in a6_col_2(m)) == R.table_a6(m), ('Table A-6 rebuild', m)
    n += 12
    worst = worst_cum = ZERO
    for m in range(1, 13):
        ce = ct = ZERO
        for k in range(1, 30):
            d = dep_2(F(100), 2000, m, 2000 + k - 1)
            ce, ct = ce + d['page'], ct + d['table']
            worst, worst_cum = max(worst, abs(d['diff'])), max(worst_cum, abs(ce - ct))
        assert ce == 100 and ct == 100, ('recovery totals', m)
    assert worst == F(7, 11000) and worst_cum == F(97, 33000), ('Table A-6 gaps', worst, worst_cum)
    n += 2
    d = dep_2(F(160000), 2025, 2, 2025)
    assert d['table'] == F('5091.20') and money(d['page']) == '5090.91', 'P527 Table 2-2d example'
    assert dep_2(F(100000), 2023, 7, 2025)['table'] == 3636, 'P946 July 2023 example'
    sched = {y: dep_2(F(330000), 2019, 3, y) for y in (2019, 2026, 2028, 2046, 2047)}
    assert [sched[y]['page'] for y in (2019, 2026, 2046, 2047)] == [9500, 12000, 8500, 0], 'RULES.md 9.1 schedule'
    assert [sched[y]['table'] for y in (2019, 2026, 2028, 2046)] == [F('9500.70'), F('11998.80'), F('12002.10'),
                                                                     F('8500.80')], 'RULES.md 9.1 table'
    assert dep_2(F(55, 2), 1998, 3, 2025)['page'] == F(17, 24) and dep_2(F(55, 2), 1998, 3, 2026)['page'] == 0, \
        'RULES.md s.4 March 1998'
    assert dep_2(F(55, 2), 1998, 8, 2026)['page'] == F(3, 24), 'RULES.md s.4 August 1998'
    n += 6
    # the loan year
    ly = loan_2(F(1000), F(12, 100), F(600))
    assert ly['months'] == 2 and ly['end'] == 0 and ly['debt_service'] == F('1014.10') and \
        ly['interest'] == F('14.10'), 'loan paid off in month 2 (1,000 at 12%, 600 a month)'
    ly = loan_2(F(240000), F(5, 100), F(1000))
    assert ly['interest'] == 12000 and ly['principal'] == 0 and ly['end'] == 240000, 'interest-only'
    n += 2
    # rentals, RULES.md 9.1-9.4
    x = r2('RULES.md 9.1')
    r, h = x['rentals'][0], x['house']
    assert r['income'] == 38760 and r['opex'] == F('18100.80') and r['noi'] == F('20659.20'), '9.1 money'
    assert r['taxable'] == F('8659.20') and rate6(r['cap_rate']) == '0.039729' and r['dscr'] is None, '9.1 taxable'
    assert rate6(r['cash_on_cash']) == '0.050388' and rate6(r['return_on_equity']) == '0.074729', '9.1 ratios'
    assert h['marginal_rate'] == F('0.22') and money(h['law_tax_change']) == '1905.02', '9.1 tax'
    assert h['page_tax_line_total'] == h['law_tax_change'], '9.1 agree'
    n += 5
    x = r2('RULES.md 9.2 Jun at wages 90,000')
    a_, b_ = x['rentals']
    h = x['house']
    assert a_['taxable'] == 8000 and b_['taxable'] == -30000 and b_['noi'] == 0 and b_['interest'] == 18000, '9.2'
    assert h['law_net_passive'] == -22000 and h['law_allowance'] == 25000 and h['law_suspended_total'] == 0, '9.2 law'
    assert b_['allowed_loss'] == 30000 and b_['loss_usable'] == 25000 and b_['loss_carried'] == 5000, '9.2 per rental'
    assert h['page_tax_line_total'] == -3740 and h['law_tax_change'] == -4840, '9.2 tax'
    assert rate6(h['ratio_law_to_page']) == '1.294118' and rate6(b_['break_even']) == '1.550000', '9.2 ratios'
    assert b_['equity'] == 455000 and b_['total_return'] == 8425, '9.2 return'
    n += 6
    x = r2('RULES.md 9.2 Jun at wages 130,000')
    b_, h = x['rentals'][1], x['house']
    assert h['law_allowance'] == 10000 and h['law_suspended_total'] == 12000, '9.2b law'
    assert b_['allowed_loss'] == 18000 and b_['suspended_loss'] == 12000, '9.2b per rental'
    assert b_['loss_usable'] == 10000 and b_['loss_carried'] == 20000 and h['marginal_rate'] == F('0.24'), '9.2b page'
    assert h['page_tax_line_total'] == -480 and h['law_tax_change'] == -2364 and h['law_allowed_net'] == -10000, '9.2b'
    n += 4
    x = r2('RULES.md 9.3 Kit, separate')
    r, h = x['rentals'][0], x['house']
    assert r['taxable'] == -10000 and h['law_allowance'] == 0 and r['suspended_loss'] == 10000, '9.3 law'
    assert h['law_tax_change'] == 0 and r['loss_usable'] == 7500 and r['loss_carried'] == 2500, '9.3 page'
    assert h['marginal_rate'] == F('0.12') and h['page_tax_line_total'] == -900 and r['opex'] == 7100, '9.3 rate'
    assert r['dscr'] == F(5, 6) and r['equity'] == 110000 and rate6(r['return_on_equity']) == '0.093182', '9.3 ratios'
    x = r2('RULES.md 9.3 Kit had they')
    assert x['house']['law_allowance'] == 7500 and x['rentals'][0]['suspended_loss'] == 2500, '9.3 apart'
    assert x['house']['law_tax_change'] == -900, '9.3 apart tax'
    n += 6
    x = r2('RULES.md 9.4')
    h = x['house']
    assert h['marginal_rate'] == F('0.24') and money(h['page_tax_line_total']) == '2078.21', '9.4 page'
    assert money(h['law_niit_change']) == '329.05' and money(h['law_tax_change']) == '2407.26', '9.4 law'
    n += 2
    # the sources' own passive examples
    x = r2('P925 Terry')
    assert [r['suspended_loss'] for r in x['rentals']] == [7560, 13440, 0], 'P925 Terry ratable split'
    assert x['house']['law_passive_activity_loss'] == 21000, 'P925 Terry passive activity loss'
    x = r2('P925 example: $70,000')
    assert x['house']['law_allowed_against_wages'] == 11000 and x['house']['law_suspended_total'] == 0, 'P925 70k'
    assert x['house']['law_allowed_net'] == -11000, 'P925 70k net'
    x = r2('P925 phaseout example')
    assert x['house']['law_allowance'] == 15000 and x['house']['law_allowed_against_wages'] == 15000, 'P925 120k'
    assert x['house']['law_suspended_total'] == 16000, 'P925 120k carry'
    x = r2('three losses over an allowance')
    assert [money(r['suspended_loss']) for r in x['rentals']] == ['7555.56', '5666.67', '3777.78'], 'pro rata'
    assert [r['loss_usable'] for r in x['rentals']] == [10000, 0, 0], 'in order'
    x = r2('NIIT part way')
    assert x['house']['law_niit_change'] == 190, 'NIIT part way'
    n += 6
    # homes, RULES.md 9.5-9.6
    x = h2('RULES.md 9.5 Pat: bought 18')
    assert x['gain'] == 27400 and x['days_owned'] == 549 and x['full_months_owned'] == 18, '9.5 days'
    assert not x['meets_2_of_5'] and x['term'] == 'long' and x['page_taxable_gain'] == 0, '9.5 test'
    assert x['page_keep'] == 72400 and x['law_exclusion'] == 0 and x['law_tax'] == 4110, '9.5 tax'
    assert x['law_keep'] == 68290 and money(x['reduced_max_days']) == '188013.70', '9.5 keep'
    assert x['reduced_max_months'] == 187500 and x['reduced_tax'] == 0, '9.5 reduced'
    assert (x['months_owned'], x['months_owned_m2'], x['months_owned_m3']) == (18, 18, 18), '9.5 months'
    assert rate6(x['growth_since_bought']) == '0.097653' and money(x['cost_interest']) == '21465.78', '9.5 growth'
    assert money(x['costs_year']) == '33165.78' and rate6(x['ltv']) == '0.782609', '9.5 costs'
    assert [money(x[k]) for k in ('value_5y', 'value_10y', 'value_20y')] == ['546335.70', '648875.43', '915302.88']
    n += 9
    x = h2('RULES.md 9.5 Pat bought 2026-01-16')
    assert x['term'] == 'short' and x['law_tax'] == 6040 and x['growth_since_bought'] is None, '9.5 short'
    assert money(x['reduced_max_days']) == '104109.59' and x['reduced_tax'] == 0, '9.5 short reduced'
    x = h2('RULES.md 9.6')
    assert x['gain'] == 700000 and x['meets_2_of_5'] and x['law_exclusion'] == 250000, '9.6 exclusion'
    assert x['law_taxable_gain'] == 450000 and x['law_tax'] == 87260 and x['law_niit'] == 16340, '9.6 tax'
    assert x['page_rate'] == F('0.238') and x['page_tax'] == 107100, '9.6 page'
    assert x['law_keep'] == 890740 and x['page_keep'] == 870900 and rate6(x['ltv']) == '0.125000', '9.6 keep'
    assert rate6(x['growth_since_bought']) == '0.052635' and money(x['costs_year']) == '34755.29', '9.6 growth'
    n += 7
    # the sources' own home examples
    assert F(min(full_months_2(day_2('2025-03-10'), day_2('2026-03-10')), 24), 24) * 250000 == 125000, '1.121-3 Ex 1'
    assert F(days_2(day_2('1999-01-15'), day_2('2000-01-15')), 730) * 250000 == 125000, '1.121-3 Ex 2'
    assert days_2(day_2('1997-01-18'), day_2('1999-01-18')) == 730, '1.121-1(c)(4) Ex 3'
    assert days_2(day_2('2023-11-02'), day_2('2025-11-01')) == 730, '730 days with a February 29'
    assert full_months_2(day_2('2023-11-02'), day_2('2025-11-01')) == 23, '23 months'
    assert first_long_2(day_2('2024-01-31')) == date(2025, 2, 1), 'P550 holding period'
    assert day_2('2025-01-29') < first_long_2(day_2('2024-01-31')) <= day_2('2025-02-06'), 'P550 example'
    assert [f(day_2('2025-01-31'), day_2('2026-02-28')) for f in (months_m1_2, months_m2_2, months_m3_2)] == \
        [12, 13, 12], 'RULES.md 8.1 months 2025-01-31'
    assert [f(day_2('2025-03-15'), day_2('2026-03-14')) for f in (months_m1_2, months_m2_2, months_m3_2)] == \
        [11, 12, 11], 'RULES.md 8.1 months 2025-03-15'
    assert F(38, 1000) * min(F(2000), max(ZERO, F(400000) - 200000)) == 76, '1.1411-4(d)(3)(ii) Example 3'
    n += 10
    x = h2('1.121-1(c)(1): 730 days')
    assert x['meets_2_of_5'] and x['days_owned'] == 730 and x['full_months_owned'] == 23, '730 edge'
    assert not h2('729 days, 23 full months: not met')['meets_2_of_5'], '729 edge'
    assert h2('sold on the anniversary')['term'] == 'short' and h2('sold the day after the anniversary')['term'] == 'long'
    x = h2('bought February 29, 2024, sold 2026-02-28')
    assert x['meets_2_of_5'] and x['full_months_owned'] == 24 and x['days_owned'] == 730, 'Feb 29 two years'
    assert h2('bought February 29, 2024, sold 2025-02-28')['term'] == 'short', 'Feb 29 one year'
    assert h2('bought February 29, 2024, sold 2025-03-01')['term'] == 'long', 'Feb 29 long'
    x = h2("the page's 20% line exactly")
    assert x['page_rate'] == F(188, 1000) and h2("the page's 20% line plus a cent")['page_rate'] == F(238, 1000), '20%'
    assert h2('joint 2025')['page_rate'] == F(188, 1000), 'joint 2025 page line'
    assert h2('joint 2025')['law_income_tax'] == F(15, 100) * 431550, 'joint 2025: all at 15% up to the top'
    x = h2("the page's 3.8% line exactly")
    assert x['page_rate'] == F(15, 100) and h2("the page's 3.8% line plus a cent")['page_rate'] == F(188, 1000), 'NIIT'
    x = h2('separate: the law')
    assert x['law_niit'] == F(38, 1000) * 25000 and x['page_rate'] == F(15, 100), 'separate NIIT'
    x = h2('mortgage paid off in month 3')
    assert x['loan_payments_made'] == 3, 'mortgage payoff'
    n += 10
    return n


# ======================================== rows, notes, statistics ========================================

RENT_INPUTS = ['case_id', 'row_kind', 'tax_year', 'today', 'filing_status', 'lived_apart_all_year', 'wages', 'rentals']
RENT_COLUMNS = RENT_INPUTS + ['rental_results', 'rental_law', 'rental_depreciation', 'rental_loan'] + \
    [k for k, _ in HOUSE_SPEC] + ['note']


def rent_note(c, d1):
    h, rs = d1['house'], d1['rentals']
    parts = [c['edge_note']] if c['edge_note'] else []
    st = c['filing_status']
    if st == 'married_separate' and c['lived_apart_all_year'] == 'no' and h['page_loss_usable_total'] > 0:
        parts.append(f'separate return, lived with the spouse: no special allowance by law (469(i)(5)(B)); the page '
                     f'uses {usd(h["page_loss_usable_total"])}')
    inc = sum((r['taxable'] for r in rs if r['taxable'] > 0), ZERO)
    los = sum((-r['taxable'] for r in rs if r['taxable'] < 0), ZERO)
    if inc > 0 and los > 0:
        parts.append(f'rentals with income absorb {usd(min(inc, los))} of losses first (469(d)(1))')
    if h['law_suspended_total'] != h['page_loss_carried_total']:
        parts.append(f'suspended {usd(h["law_suspended_total"])} by law, carried {usd(h["page_loss_carried_total"])} '
                     'by the page')
    elif any(r['suspended_loss'] != r['loss_carried'] for r in rs):
        parts.append('the same total suspended, spread pro rata by law and in order by the page')
    if h['law_niit_change'] > 0:
        parts.append(f'3.8% on net rental income {usd(h["law_niit_change"])} by law')
    for i, r in enumerate(rs, 1):
        loan = r['_loan']
        if loan and 0 < loan['months'] < 12:
            parts.append(f'rental {i}: loan paid off in month {loan["months"]}')
        if loan and loan['months'] and loan['interest'] == loan['debt_service'] and loan['debt_service'] > 0 \
                and loan['end_balance'] > 0:
            parts.append(f'rental {i}: payments at or below the interest, principal 0')
        if r['_year_is'] == 'last':
            parts.append(f'rental {i}: last year of depreciation')
        elif r['_year_is'] == 'after_end':
            parts.append(f'rental {i}: fully depreciated before this year')
        if r['placed_this_year']:
            parts.append(f'rental {i}: placed in service this year, the page counts 12 months of rent and costs (C6)')
        if r['cap_rate'] is None:
            parts.append(f'rental {i}: value 0, cap rate blank')
    if h['_agi_with'] < 0:
        parts.append('AGI below zero after the allowed loss (no net operating loss modelled)')
    return '; '.join(dict.fromkeys(parts))


def rent_row(cid, c, d1):
    row = {k: c[k] for k in RENT_INPUTS if k != 'case_id'}
    row['case_id'] = cid
    for col, spec in (('rental_results', RENTAL_RESULT_SPEC), ('rental_law', RENTAL_LAW_SPEC),
                      ('rental_depreciation', RENTAL_DEP_SPEC), ('rental_loan', RENTAL_LOAN_SPEC)):
        row[col] = ';'.join('|'.join(fmt(kind, r[key]) for key, kind in spec) for r in d1['rentals'])
    for key, kind in HOUSE_SPEC:
        row[key] = fmt(kind, d1['house'][key])
    row['note'] = rent_note(c, d1)
    return row


def rent_stats(s, c, d1, band, kinds):
    year, st, wages = int(c['tax_year']), c['filing_status'], int(c['wages'])
    h, rs = d1['house'], d1['rentals']
    s[f'year {year}'] += 1
    s[f'status {st}'] += 1
    if st == 'married_separate':
        apart = c['lived_apart_all_year'] == 'yes'
        s['separate: lived apart all year' if apart else 'separate: lived with the spouse'] += 1
        tag = 'separate apart' if apart else 'separate together'
        lo, hi = 50000, 75000
    else:
        tag, lo, hi = 'not separate', 100000, 150000
    s[f'{tag}: wages under {lo:,}'] += wages < lo
    s[f'{tag}: wages exactly {lo:,}'] += wages == lo
    s[f'{tag}: wages inside the phase-out'] += lo < wages < hi
    s[f'{tag}: wages exactly {hi:,}'] += wages == hi
    s[f'{tag}: wages above {hi:,}'] += wages > hi
    s[f'rows with {len(rs)} rental(s)'] += 1
    has_inc = any(r['taxable'] > 0 for r in rs)
    has_loss = any(r['taxable'] < 0 for r in rs)
    s['rows with a rental with income and another with a loss'] += has_inc and has_loss
    s['rows where every rental has a loss'] += all(r['taxable'] < 0 for r in rs)
    s['rows with two or three rentals, all with losses'] += len(rs) > 1 and all(r['taxable'] < 0 for r in rs)
    s['rows where every rental has income'] += all(r['taxable'] > 0 for r in rs)
    for r, k in zip(rs, kinds or [None] * len(rs)):
        s['rentals'] += 1
        loan = r['_loan']
        if loan is None:
            s['rentals without a loan'] += 1
        else:
            s['rentals with a loan'] += 1
            s['rentals with a loan paid off within the year'] += 0 < loan['months'] < 12
            s['rentals with no loan payment made (balance 0)'] += loan['months'] == 0
        if k:
            s[f'random loan kind {k}'] += 1
        s['rentals with a loan rate of 0'] += loan is not None and r['interest'] == 0 and r['debt_service'] > 0
        s[f'rentals placed in service in month {r["_month"]:02d}'] += 1
        s[f'rentals depreciation year {r["_year_is"]}'] += 1
        s['rentals with taxable income'] += r['taxable'] > 0
        s['rentals with a taxable loss'] += r['taxable'] < 0
        s['rentals with value 0 (cap rate blank)'] += r['cap_rate'] is None
        s['rentals with cash-on-cash blank'] += r['cash_on_cash'] is None
        s['rentals with return on equity blank'] += r['return_on_equity'] is None
        s['rentals where Table A-6 differs from the formula after rounding'] += \
            money(r['depreciation_table_a6']) != money(r['depreciation'])
    s['rows NIIT on (law)'] += h['law_niit_change'] > 0
    s['rows NIIT off'] += h['law_niit_change'] == 0
    s['rows NIIT off with net rental income'] += h['law_niit_change'] == 0 and h['law_allowed_net'] > 0
    s['rows law suspends a loss'] += h['law_suspended_total'] > 0
    s['rows page carries a loss'] += h['page_loss_carried_total'] > 0
    s['rows law suspended differs from page carried'] += h['law_suspended_total'] != h['page_loss_carried_total']
    s['rows netting lowers the suspended loss'] += has_inc and h['law_suspended_total'] < h['page_loss_carried_total']
    s['rows same total, split differs (pro rata vs in order)'] += \
        h['law_suspended_total'] == h['page_loss_carried_total'] and \
        any(r['suspended_loss'] != r['loss_carried'] for r in rs)
    s['rows separate together: page allows a loss the law does not'] += \
        st == 'married_separate' and c['lived_apart_all_year'] == 'no' and h['page_loss_usable_total'] > 0
    s['rows law and page tax differ by more than $1'] += abs(h['law_minus_page']) > 1
    s['rows law and page tax agree to the cent'] += money(h['law_tax_change']) == money(h['page_tax_line_total'])
    s['rows marginal rate strictly between 0 and 0.10'] += 0 < h['marginal_rate'] < F(1, 10)
    s['rows marginal rate 0'] += h['marginal_rate'] == 0
    s['rows AGI below zero after the rentals'] += h['_agi_with'] < 0
    s['written amounts exactly on a half cent'] += sum(
        half_cent(r[k]) for r in rs for spec in (RENTAL_RESULT_SPEC, RENTAL_LAW_SPEC, RENTAL_DEP_SPEC, RENTAL_LOAN_SPEC)
        for k, kind in spec if kind == 'm') + sum(half_cent(h[k]) for k, kind in HOUSE_SPEC if kind == 'm')
    if band:
        s[f'random wage band {band}'] += 1


def build_rent(rng, guard):
    rows, s = [], Counter()
    edges = rent_edges()
    for c in edges:
        cid = f'rent-{c["tax_year"]}-{STATUS_CODE[c["filing_status"]]}-{len(rows) + 1:04d}'
        d1, d2 = derive_rent_1(c), derive_rent_2(c)
        compare_rent(guard, cid, d1, d2)
        rows.append(rent_row(cid, c, d1))
        s['rows edge'] += 1
        rent_stats(s, c, d1, None, None)
    n_edge = len(rows)
    while len(rows) < N_RENT:
        c, band, kinds = random_rent_case(rng)
        cid = f'rent-{c["tax_year"]}-{STATUS_CODE[c["filing_status"]]}-{len(rows) + 1:04d}'
        d1, d2 = derive_rent_1(c), derive_rent_2(c)
        compare_rent(guard, cid, d1, d2)
        rows.append(rent_row(cid, c, d1))
        s['rows random'] += 1
        rent_stats(s, c, d1, band, kinds)
    return rows, s, n_edge


HOME_INPUTS = ['case_id', 'row_kind', 'tax_year', 'today', 'filing_status', 'wages'] + list(HOME_FIELDS)
HOME_COLUMNS = HOME_INPUTS + [k for k, _ in HOME_SPEC] + ['note']


def law_band(c, d1):
    """Where the law's long-term taxable gain sits: the I1040 worksheet's 0% / 15% / 20% lines (derivation 1)."""
    g = d1['law_taxable_gain']
    if g == 0 or d1['term'] == 'short':
        return None
    year, st = int(c['tax_year']), c['filing_status']
    ti = max(ZERO, fr(c['wages']) + g - R.STANDARD_DEDUCTION[year][st])
    q = R.qdcg_tax(year, st, ti, g)
    parts = [p for p, v in (('0', q['line9']), ('15', q['line17']), ('20', q['line20'])) if v > 0]
    return '/'.join(parts) or 'under the standard deduction'


def home_note(c, d):
    parts = [c['edge_note']] if c['edge_note'] else []
    gain = d['gain']
    if d['term'] == 'short' and gain > 0:
        parts.append('held 1 year or less: short-term, ordinary rates (1222(1))')
    if not d['meets_2_of_5'] and gain > 0:
        parts.append(f'owned {d["days_owned"]} days, {d["full_months_owned"]} full months: under 730 days and 24 '
                     'months, no exclusion by law; the page applies it')
    if d['days_owned'] >= 730 and d['full_months_owned'] < 24:
        parts.append('730 days before 24 full months (a February 29 inside): met by days')
    if gain < 0:
        parts.append('a loss on the sale: not deductible (P523)')
    elif d['meets_2_of_5'] and gain > d['law_exclusion_max']:
        parts.append('gain over the exclusion')
    band = law_band(c, d)
    if band == 'under the standard deduction':
        parts.append('law: the taxable gain is under the standard deduction, no tax')
    elif band:
        parts.append(f'law: the taxable gain sits in the {band}% band' + ('s' if '/' in band else ''))
    if d['law_niit'] > 0:
        parts.append(f'3.8% by law {usd(d["law_niit"])}')
    if d['page_rate'] in (F(188, 1000), F(238, 1000)) and d['page_taxable_gain'] > 0 and d['law_niit'] == 0:
        parts.append('the page adds 3.8% the law does not')
    if c['filing_status'] == 'married_separate' and d['page_taxable_gain'] > 0 and \
            125000 < fr(c['wages']) + d['law_taxable_gain'] and d['law_niit'] > 0 and d['page_rate'] < F(18, 100):
        parts.append("separate return: the law's 3.8% line is 125,000, the page's 200,000")
    loan = d['_loan']
    if loan and 0 < loan['months'] < 12:
        parts.append(f'mortgage paid off in month {loan["months"]}')
    if len({d['months_owned'], d['months_owned_m2'], d['months_owned_m3']}) > 1:
        parts.append(f'whole months: M1 {d["months_owned"]}, M2 {d["months_owned_m2"]}, M3 {d["months_owned_m3"]}')
    if d['months_owned'] < 12:
        parts.append('under 12 whole months: no growth figure')
    return '; '.join(dict.fromkeys(parts))


def home_row(cid, c, d1):
    row = {k: c[k] for k in HOME_INPUTS if k != 'case_id'}
    row['case_id'] = cid
    for key, kind in HOME_SPEC:
        row[key] = fmt(kind, d1[key])
    row['note'] = home_note(c, d1)
    return row


def home_stats(s, c, d, band, held, loan_kind):
    year, st = int(c['tax_year']), c['filing_status']
    s[f'year {year}'] += 1
    s[f'status {st}'] += 1
    days, fm = d['days_owned'], d['full_months_owned']
    s['held under 1 year (short-term)'] += d['term'] == 'short'
    s['held exactly 1 year (the anniversary, short-term)'] += d['term'] == 'short' and days in (365, 366) and \
        d['first_long_day'] == date.fromisoformat(c['today']) + DAY
    s['held more than 1 year, under 2 (long-term, test failed)'] += d['term'] == 'long' and not d['meets_2_of_5']
    s['exactly 729 days'] += days == 729
    s['exactly 730 days'] += days == 730
    s['730 days before 24 full months'] += days >= 730 and fm < 24
    s['held 2 to 5 years'] += 730 <= days <= 1826
    s['held more than 5 years'] += days > 1826
    gain = d['gain']
    s['gain negative (a loss)'] += gain < 0
    s['gain 0 to the exclusion'] += 0 <= gain <= (500000 if st == 'married_joint' else 250000)
    s['gain over the exclusion'] += gain > (500000 if st == 'married_joint' else 250000)
    s['gain exactly the exclusion'] += gain == (500000 if st == 'married_joint' else 250000)
    s['law taxable gain over 0'] += d['law_taxable_gain'] > 0
    b = law_band(c, d)
    if b:
        s[f'{year} law band {b}'] += 1
        for p in b.split('/'):
            if p.isdigit():
                s[f'{year} law band touches {p}%'] += 1
    if d['law_taxable_gain'] > 0 and d['term'] == 'short':
        s[f'{year} short-term taxable gain (ordinary rates)'] += 1
    if d['law_taxable_gain'] > 0:
        magi = fr(c['wages']) + d['law_taxable_gain']
        thr = R.NIIT_THRESHOLD[st]
        s[f'{year} NIIT line: MAGI above, with a taxable gain'] += magi > thr
        s[f'{year} NIIT line: MAGI at or below, with a taxable gain'] += magi <= thr
    if d['page_taxable_gain'] > 0:
        s['page rate 15%'] += d['page_rate'] in (F(15, 100), F(188, 1000))
        s['page rate 20%'] += d['page_rate'] in (F(20, 100), F(238, 1000))
        s['page adds 3.8%'] += d['page_rate'] in (F(188, 1000), F(238, 1000))
        s['page taxable gain, no 3.8%'] += d['page_rate'] in (F(15, 100), F(20, 100))
    loan = d['_loan']
    s['no mortgage'] += loan is None
    s['mortgage paid off within the year'] += loan is not None and 0 < loan['months'] < 12
    s['mortgage rate 0'] += loan is not None and d['cost_interest'] == 0 and loan['months'] > 0
    s['M1 differs from M2'] += d['months_owned'] != d['months_owned_m2']
    s['M1 differs from M3'] += d['months_owned'] != d['months_owned_m3']
    s['growth blank (under 12 whole months)'] += d['growth_since_bought'] is None
    s['law and page tax differ by more than $1'] += abs(d['law_minus_page_tax']) > 1
    s['law tax above the page'] += d['law_minus_page_tax'] > CENT
    s['law tax below the page'] += d['law_minus_page_tax'] < -CENT
    s['reduced exclusion would change the tax'] += d['reduced_tax'] != d['law_tax']
    s['written amounts exactly on a half cent'] += sum(half_cent(d[k]) for k, kind in HOME_SPEC if kind == 'm')
    if band:
        s[f'random wage band {band}'] += 1
        s[f'random holding {held}'] += 1
        s[f'random loan kind {loan_kind}'] += 1


def build_home(rng, guard):
    rows, s = [], Counter()
    for c in home_edges():
        cid = f'home-{c["tax_year"]}-{STATUS_CODE[c["filing_status"]]}-{len(rows) + 1:04d}'
        c['case_id'] = cid
        d1, d2 = derive_home_1(c), derive_home_2(c)
        guard.fields(cid, HOME_SPEC, d1, d2)
        rows.append(home_row(cid, c, d1))
        s['rows edge'] += 1
        home_stats(s, c, d1, None, None, None)
    n_edge = len(rows)
    while len(rows) < N_HOME:
        c, band, held, lk = random_home_case(rng)
        cid = f'home-{c["tax_year"]}-{STATUS_CODE[c["filing_status"]]}-{len(rows) + 1:04d}'
        c['case_id'] = cid
        d1, d2 = derive_home_1(c), derive_home_2(c)
        guard.fields(cid, HOME_SPEC, d1, d2)
        rows.append(home_row(cid, c, d1))
        s['rows random'] += 1
        home_stats(s, c, d1, band, held, lk)
    return rows, s, n_edge


COVERAGE_DEP = {
    **{f'first year, placed in month {m:02d}': 5 for m in range(1, 13)},
    'recovery year 28': 40, 'recovery year 29': 40, 'recovery year 30': 30, 'recovery year 31': 30,
    'year is last': 50, 'year is after_end': 100, 'year is first': 100, 'tax year after 2026': 300,
    'placed in service 1995-1999': 100, 'placed in service 2025-2029': 30,
    'table and formula differ after rounding': 500,
}
COVERAGE_RENT = {
    'year 2025': 700, 'year 2026': 700,
    'status single': 400, 'status married_joint': 400, 'status married_separate': 200, 'status head_of_household': 250,
    'separate: lived apart all year': 100, 'separate: lived with the spouse': 100,
    'not separate: wages under 100,000': 300, 'not separate: wages exactly 100,000': 20,
    'not separate: wages inside the phase-out': 250, 'not separate: wages exactly 150,000': 20,
    'not separate: wages above 150,000': 300,
    'separate apart: wages under 50,000': 20, 'separate apart: wages exactly 50,000': 3,
    'separate apart: wages inside the phase-out': 20, 'separate apart: wages exactly 75,000': 3,
    'separate apart: wages above 75,000': 30, 'separate together: wages under 50,000': 20,
    'rows with 1 rental(s)': 600, 'rows with 2 rental(s)': 500, 'rows with 3 rental(s)': 300,
    'rows with a rental with income and another with a loss': 300, 'rows where every rental has a loss': 300,
    'rows with two or three rentals, all with losses': 100,
    'rentals without a loan': 800, 'rentals with a loan paid off within the year': 100,
    'rentals with a loan rate of 0': 60, 'rentals with no loan payment made (balance 0)': 1,
    **{f'rentals placed in service in month {m:02d}': 200 for m in range(1, 13)},
    'rentals depreciation year last': 20, 'rentals depreciation year after_end': 20,
    'rentals depreciation year first': 40,
    'rentals with value 0 (cap rate blank)': 10, 'rentals with cash-on-cash blank': 300,
    'rows NIIT on (law)': 150, 'rows NIIT off': 1000, 'rows NIIT off with net rental income': 300,
    'rows law suspends a loss': 300, 'rows page carries a loss': 300,
    'rows law suspended differs from page carried': 300, 'rows netting lowers the suspended loss': 100,
    'rows same total, split differs (pro rata vs in order)': 20,
    'rows separate together: page allows a loss the law does not': 50,
    'rows law and page tax differ by more than $1': 600, 'rows law and page tax agree to the cent': 100,
    'rows marginal rate strictly between 0 and 0.10': 5, 'rows AGI below zero after the rentals': 1,
}
COVERAGE_HOME = {
    'year 2025': 500, 'year 2026': 500,
    'status single': 300, 'status married_joint': 300, 'status married_separate': 150,
    'status head_of_household': 200,
    'held under 1 year (short-term)': 150, 'held exactly 1 year (the anniversary, short-term)': 5,
    'held more than 1 year, under 2 (long-term, test failed)': 200, 'exactly 729 days': 5, 'exactly 730 days': 5,
    '730 days before 24 full months': 2, 'held 2 to 5 years': 150, 'held more than 5 years': 600,
    'gain negative (a loss)': 100, 'gain 0 to the exclusion': 400, 'gain over the exclusion': 300,
    'gain exactly the exclusion': 1,
    **{f'{y} law band {b}': 3 for y in (2025, 2026) for b in ('0', '0/15', '15', '15/20', '20')},
    **{f'{y} law band touches {p}%': 30 for y in (2025, 2026) for p in ('0', '15', '20')},
    '2025 short-term taxable gain (ordinary rates)': 40, '2026 short-term taxable gain (ordinary rates)': 40,
    '2025 NIIT line: MAGI above, with a taxable gain': 100, '2025 NIIT line: MAGI at or below, with a taxable gain': 40,
    '2026 NIIT line: MAGI above, with a taxable gain': 100, '2026 NIIT line: MAGI at or below, with a taxable gain': 40,
    'page rate 15%': 100, 'page rate 20%': 50, 'page adds 3.8%': 100, 'page taxable gain, no 3.8%': 50,
    'no mortgage': 300, 'mortgage paid off within the year': 50, 'mortgage rate 0': 20,
    'M1 differs from M2': 100, 'M1 differs from M3': 10, 'growth blank (under 12 whole months)': 100,
    'law and page tax differ by more than $1': 400,
}


def check_coverage(name, s, minimums):
    short = {k: (s.get(k, 0), v) for k, v in minimums.items() if s.get(k, 0) < v}
    if short:
        raise SystemExit(f'{name}: coverage short of the brief: {short}; no CSV written')
    return len(minimums)


# ======================================== run ========================================

def write_csv(path, columns, rows):
    with path.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=columns, lineterminator='\n')
        w.writeheader()
        w.writerows(rows)


def main(argv):
    global MUT
    out_dir, skip_examples = OUT_DIR, False
    args = list(argv)
    while args:
        a = args.pop(0)
        if a == '--mutate':
            MUT = args.pop(0)
        elif a.startswith('--mutate='):
            MUT = a.split('=', 1)[1]
        elif a == '--skip-examples':
            skip_examples = True
        else:
            out_dir = Path(a)
    if MUT is not None and MUT not in MUTATIONS:
        raise SystemExit(f'unknown mutation {MUT}; one of {", ".join(MUTATIONS)}')
    if MUT:
        print(f'MUTATION in derivation 2: {MUT}: {MUTATIONS[MUT]}')
    t0 = time.time()
    print(f'rules.py: {R.CHECKS} self-checks passed on import')
    if not skip_examples:
        try:
            n_ex = check_examples()
        except AssertionError as e:
            raise SystemExit(f'RULES.md examples check failed in derivation 2: {e.args}; no CSV written')
        print(f'RULES.md worked examples and source examples reproduced by derivation 2: {n_ex} assertions')
    rng = random.Random(SEED)
    g_dep, g_rent, g_home = Guard('depreciation.csv'), Guard('rentals.csv'), Guard('homes.csv')
    dep_rows, dep_stats = build_dep(rng, g_dep)
    rent_rows, rent_stats_, n_rent_edge = build_rent(rng, g_rent)
    home_rows, home_stats_, n_home_edge = build_home(rng, g_home)
    for rows, n in ((dep_rows, N_DEP), (rent_rows, N_RENT), (home_rows, N_HOME)):
        assert len(rows) == n and len({r['case_id'] for r in rows}) == n
    n_cov = 0
    for name, s, mins in (('depreciation.csv', dep_stats, COVERAGE_DEP), ('rentals.csv', rent_stats_, COVERAGE_RENT),
                          ('homes.csv', home_stats_, COVERAGE_HOME)):
        try:
            n_cov += check_coverage(name, s, mins)
        except SystemExit:
            for key in sorted(s):
                print(f'  {name} {key}: {s[key]}')
            raise
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = (('depreciation.csv', DEP_COLUMNS, dep_rows, g_dep, dep_stats, None),
             ('rentals.csv', RENT_COLUMNS, rent_rows, g_rent, rent_stats_, n_rent_edge),
             ('homes.csv', HOME_COLUMNS, home_rows, g_home, home_stats_, n_home_edge))
    for name, cols, rows, *_ in files:                                  # written only once all three have passed
        write_csv(out_dir / name, cols, rows)
    for name, cols, rows, g, s, n_edge in files:
        kinds = f' ({n_edge} edge, {len(rows) - n_edge} random)' if n_edge is not None else ''
        print(f'wrote {name}: {len(rows)} rows{kinds}; both derivations agree; largest gap before rounding '
              f'{money(g.max_gap)} (rates {float(g.max_rate_gap):.3g})')
        for key in sorted(g.n):
            print(f'  check: {key}: {g.n[key]}')
        for key in sorted(s):
            print(f'  {key}: {s[key]}')
    print(f'{n_cov} coverage minimums met')
    for name, *_ in files:
        print(f'  sha256 {name}: {hashlib.sha256((out_dir / name).read_bytes()).hexdigest()}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
