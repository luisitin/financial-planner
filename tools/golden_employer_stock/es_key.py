"""Employer stock answer key: the "Employer stock" page (RSUs and stock options). Two CSVs.

Run:  python3 -B -I tools/golden_employer_stock/es_key.py [out_dir] [--mutate NAME] [--skip-examples]

Writes tests/golden/employer-stock/schedules.csv (1,500 vesting schedules alone: shares, vest_start with month ends and
the 29th-31st, vest_months, cliff_months with 0, every, today; the vest dates and shares, vested and unvested today) and
households.csv (2,500 invented households: the page's position figures, the vests of the next 12 months with the federal
tax they add, what the employer withholds, the gap and Illinois' share, by calendar year, and the sale that gets the
company under 10%; law and contrast columns beside). Standard library only, exact arithmetic (fractions.Fraction in
derivation 1, whole units of 1e-8 dollars in derivation 2), deterministic (random.Random(20261031); the generator draws
only integers). The figures and the model come from rules.py next to this file; the sources and the reasons are in
tests/golden/employer-stock/RULES.md and in README.md here. Nothing under modules/, core/ or tests/*.test.mjs was opened,
and the app is never imported.

Model (the page's documented conventions, made exact by rules.py; where the law says otherwise the main columns keep the
page's way and a law column gives the law):
  * vesting: months cliff, cliff + every, ... below vest_months, then vest_months (cliff 0: start at every); whole shares
    floor(shares x m / vest_months); dated vest_start + m calendar months (the month's last day when it is shorter);
    vested = dated on or before today.
  * position: held value, vested options value (spread = max(0, price - strike)), owned, unvested, exposure, invested
    (brokerage + 401(k) balances + vested options + unvested; savings never), share, level (10% / 25%), the halving loss.
  * vests in view (after today, to today + 12 months, at today's price), by calendar year: owed = tax(after) - tax(before),
    tax = income tax + 0.9% Additional Medicare Tax at the return's threshold; withheld = 22% / 37% past $1,000,000 of the
    year's supplemental wages + the employer's 0.9% past $200,000; gap; Illinois' share (page $2,850, no income limit;
    law $2,925, lost above AGI $250,000 / $500,000 joint). 2027: no published tables, so its owed and gap are a contrast
    on the 2026 tables (rules.py Y1) and the main columns check 2026 years only.
  * the sale: need = min(held value, exposure - 10% x invested), the 401(k) first (no tax), then the brokerage; the gain
    pro rata; tax = the 2026 return with this year's vests and the gain at 0/15/20% stacked on top plus the 3.8% NIIT,
    less the same without; separate returns put it on the owner's return (joint = half on each). Law: a loss is allowed
    up to $3,000 ($1,500 separate) against wages; Illinois taxes the gain.

Two derivations of every value, run on every row before anything is written:
  derivation 1  rules.py: vest_schedule, vested_shares, employer_stock_case (position, vests_in_view, vest_year =
                federal_return (regular_tax by bracket slices, addl_medicare_owed), supplemental_withholding,
                addl_medicare_withheld, il_tax_page / il_tax_law, and sale = federal_return with qdcg_worksheet + niit).
  derivation 2  this file, written separately, from the CSV's own input strings (its own number, date and compact-field
                reader), with the page's conventions and the statutory figures restated here from the brief (only the
                federal tables come from rules.py: bracket tops, the printed "The Tax Is" bases, rates, standard
                deductions, 0% and 15% tops). Vest months in closed form (ceil((vest_months - first) / every) steps);
                dates by month counting with its own month lengths; money in whole units of 1e-8 dollars; the tax from
                the printed base plus the rate on the excess (bisection on the tops); the Additional Medicare, NIIT,
                withholding and Illinois amounts as the overlap of an income interval with a band; the gain as the
                slice from ordinary taxable income up, taxed by its overlap with the 0/15/20% bands and capped at the
                regular-tax change; Illinois' law share as the band overlap plus a jump of 4.95% x the allowance when
                the income crosses the limit; a value's share of a year figure by floor division.
The script refuses to write any CSV if an amount differs by more than a cent, a rate or ratio by more than 1e-6, or any
other value (count, date, flag, label) differs at all, between the two. Both CSVs are worked first and written only if
all pass. --mutate NAME puts one deliberate mistake into derivation 2 (see MUTATIONS) to show the guard refuses;
--skip-examples turns off the RULES.md examples check so the row guard has to find it alone.
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
from fractions import Fraction as F
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import rules as R  # noqa: E402  (importing it runs rules.check_tables())

ROOT = HERE.parents[1]
OUT_DIR = ROOT / 'tests' / 'golden' / 'employer-stock'
SEED = 20261031
N_SCHED, N_HOUSE = 1500, 2500
ZERO, CENT, MICRO = F(0), F(1, 100), F(1, 10 ** 6)
U = 10 ** 8        # derivation 2: money in whole units of 1e-8 dollars
RU = 10 ** 12      # derivation 2: rates, ratios and share counts in whole units of 1e-12
STATUSES = ('single', 'married_joint', 'married_separate')
STATUS_CODE = {'single': 'sgl', 'married_joint': 'mfj', 'married_separate': 'mfs'}
SYMBOLS = ('EMPLA', 'EMPLB', 'EMPLC', 'EMPLD')   # invented tickers
assert tuple(R.STATUSES) == STATUSES and R.TODAY_YEAR == 2026

MUTATIONS = {
    'month_end_chained': 'each vest date is counted from the previous vest, so a fallback to the 28th sticks',
    'today_not_vested': 'a vest dated today is not vested yet (it is in view instead of earlier)',
    'zero_vests_kept': 'months whose whole shares do not move are listed as vests of 0 shares',
    'level_10_is_medium': 'a share of exactly 10% is medium, not ok',
    'halving_vested_options_only': "the halving counts only the vested options' fall in spread",
    'savings_invested': 'savings balances count as invested',
    'earlier_ignored': "the year's earlier vests are left out of 'before'",
    'no_addl_medicare_owed': 'owed leaves out the 0.9% Additional Medicare Tax',
    'medicare_withheld_by_status': "the employer's 0.9% starts at the return's threshold (250,000 joint, 125,000 separate)",
    'supp_whole_37': 'a vest crossing $1,000,000 is withheld at 37% in full in the main column',
    'medicare_pay_whole_return': "typed wages on a joint return all count as the employee's pay for the 0.9% withholding",
    'il_page_2925': "the page's Illinois share uses $2,925 a person",
    'sale_brokerage_first': 'the sale takes the brokerage shares before the 401(k)',
    'niit_whole_gain': 'the 3.8% tax is on the whole gain once MAGI is over the line',
    'gain_ordinary': 'the gain is taxed at the ordinary brackets',
    'separate_gain_on_employee': "on a separate return the whole gain goes on the employee's return",
}
MUT = None


# ======================================== small helpers ========================================

def fr(x):
    """str / int / Fraction -> exact Fraction (never float)."""
    if isinstance(x, float):
        raise TypeError('no floats')
    if isinstance(x, F):
        return x
    if isinstance(x, int):
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
    """A rate, ratio or share count with six decimals, half up (away from zero); '' for None."""
    if x is None:
        return ''
    c = rhu(fr(x) * 10 ** 6)
    sign = '-' if c < 0 else ''
    c = abs(c)
    return f'{sign}{c // 10 ** 6}.{c % 10 ** 6:06d}'


def usd(x):
    """Money for a note: thousands separated."""
    m = money(x)
    sign = '-' if m.startswith('-') else ''
    whole, frac = m.lstrip('-').split('.')
    return f'{sign}{int(whole):,}.{frac}'


def half_cent(x):
    return x is not None and (fr(x) * 100).denominator == 2


def yn(b):
    return '' if b is None else ('yes' if b else 'no')


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
        self.n['rates, ratios and share counts compared'] += 1
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


# ======================================== derivation 1: rules.py ========================================

GRANT_FIELDS = ('kind', 'shares', 'vest_start', 'vest_months', 'cliff_months', 'every', 'strike', 'granted')


def compact_1(s):
    return [p.split('|') for p in s.split(';')] if s.strip() else []


def sched_1(row):
    sch = R.vest_schedule(row['shares'], row['vest_start'], row['vest_months'], row['cliff_months'], row['every'])
    n = int(R._or(row['vest_months'], R.DEFAULT_VEST_MONTHS))
    c = int(R._or(row['cliff_months'], R.DEFAULT_CLIFF_MONTHS))
    e = int(R._or(row['every'], R.DEFAULT_EVERY))
    today = date.fromisoformat(row['today'])
    vested = R.vested_shares(sch, today)
    nxt = next((v for v in sch if v['date'] > today), None)
    return {'vests': [(v['date'].isoformat(), v['shares']) for v in sch], 'vest_count': len(sch), 'vested': vested,
            'unvested': int(row['shares']) - vested, 'next': None if nxt is None else (nxt['date'].isoformat(), nxt['shares']),
            'zero': len(R.vest_months(n, c, e)) - len(sch), 'fallback': any(v['date'].day != int(row['vest_start'][8:])
                                                                         for v in sch)}


def case_1(row):
    """The CSV's input strings as a rules.py case (rules.py reads the strings itself)."""
    c = {'today': row['today'], 'filing_status': row['filing_status'], 'salary_employee': row['salary_employee'],
         'salary_spouse': row['salary_spouse'], 'wages_typed': row['wages_typed'], 'state': row['state'],
         'price': row['price'], 'brokerage_owner': row['brokerage_owner'],
         'grants': [dict(zip(GRANT_FIELDS, p)) for p in compact_1(row['grants'])]}
    for p in compact_1(row['holdings']):
        if p[0] == 'brokerage':
            c['brokerage_shares'], c['brokerage_cost'] = p[1], p[2]
        elif p[0] == '401k':
            c['k401_shares'] = p[1]
    for p in compact_1(row['accounts']):
        if p[0] == 'brokerage':
            c['brokerage_balance'] = p[1]
        elif p[0] == '401k':
            c['k401_balance'] = p[1]
    return c


POS_MONEY = ('held_brokerage', 'held_401k', 'held_value', 'vested_options_value', 'owned', 'unvested_rsu_value',
             'unvested_options_value', 'unvested', 'exposure', 'invested', 'halving_loss')


def derive_1(row):
    r = R.employer_stock_case(case_1(row))
    p = r['position']
    out = {k: p[k] for k in POS_MONEY}
    out.update(share=p['share'], level=p['level'], grants=[(g['vested'], g['unvested'], g['spread']) for g in p['grants']],
               view_end=r['view_end'].isoformat(), earlier=r['earlier'],
               flat_ok=(r['flat_rate_condition_met'] if r['vests'] else None), this_year=r['this_year_vests'])
    vests, years = [], []
    for y in sorted(r['years']):
        Y = r['years'][y]
        years.append({'year': y, 'verified': Y['verified'], 'earlier': Y['earlier'], 'total': Y['total'],
                      'tax_before': Y['before']['total'], 'tax_after': Y['after']['total'],
                      'income_tax_owed': Y['income_tax_owed_year'], 'addl_owed': Y['addl_medicare_owed_year'],
                      'owed': Y['owed_year'], 'supp': Y['supp_withheld_year'], 'med': Y['medicare_held_year'],
                      'withheld': Y['withheld_year'], 'gap': Y['gap_year'],
                      'withheld_whole': Y['supp_withheld_whole_year'] + Y['medicare_held_year'],
                      'gap_whole': Y['gap_whole_year'], 'state_page': Y['state_page_year'],
                      'state_law': Y['state_law_year'], 'over_1m': any(v['supp_above_1m'] > 0 for v in Y['vests']),
                      'tie': Y['tie_crosses_1m']})
        for v in Y['vests']:
            vests.append({'date': v['date'].isoformat(), 'grant': v['grant'] + 1, 'shares': v['shares'], 'year': y,
                          'value': v['value'], 'owed': v['owed'], 'supp': v['supp_withheld'],
                          'supp_whole': v['supp_withheld_whole'], 'med': v['medicare_held'],
                          'withheld': v['withheld'], 'gap': v['gap'], 'gap_whole': v['gap_whole'],
                          'withheld_whole': v['supp_withheld_whole'] + v['medicare_held'],
                          'state_page': v['state_page'], 'state_law': v['state_law']})
    out['vests'], out['years'] = vests, years
    s = r['sale']
    out['sale'] = None if s is None else {
        'need': s['need'], 'from_401k': s['from_401k'], 'from_brokerage': s['from_brokerage'], 'gain': s['gain'],
        'gain_signed': s['gain_signed'], 'tax': s['tax'], 'tax_law': s['tax_law'], 'state_tax_law': s['state_tax_law'],
        'share_after': s['share_after'], 'shares_401k': s['shares_401k'], 'shares_brokerage': s['shares_brokerage'],
        'niit': sum((x['with']['niit'] - x['without']['niit'] for x in s['returns']), ZERO),
        'bands': sorted({b for x in s['returns'] for b in bands_1(x, row['filing_status'])})}
    return out


def bands_1(x, status):
    """Which of the 0/15/20% bands the sale's gain touches on one return (coverage and notes only), by the worksheet."""
    if x['gain'] <= 0:
        return []
    ws = R.qdcg_worksheet(2026, status, x['with']['taxable_income'], x['gain'])
    return [b for b, amt in (('0', ws['line9']), ('15', ws['line17']), ('20', ws['line20'])) if amt > 0]


# ======================================== derivation 2: its own reading of the inputs ========================================
# The page's conventions and the statutory figures restated from the brief (not imported from rules.py, so a slip in
# either shows in the guard). Only the federal tables come from rules.py.
VM_2, CLIFF_2, EVERY_2 = 48, 12, 3                     # brief: blank vest_months = 48, cliff_months = 12, every = 3
SUPP_2, MAND_2 = 22, 37                                 # brief / Pub. 15 (2026) s.7: 22%; 37% on the part past $1,000,000
MAND_OVER_2 = 1000000 * U
AM_WH_OVER_2 = 200000 * U                               # brief / IRC 3102(f)(1): withheld past $200,000, any status
AM_OWED_OVER_2 = {'single': 200000 * U, 'married_joint': 250000 * U, 'married_separate': 125000 * U}  # IRC 3101(b)(2)
NIIT_OVER_2 = {'single': 200000 * U, 'married_joint': 250000 * U, 'married_separate': 125000 * U}     # IRC 1411(b)
IL_PAGE_2, IL_LAW_2 = 2850 * U, 2925 * U                # brief (page) / IDOR 2026 (law, RULES.md s.7)
IL_LIMIT_2 = {'married_joint': 500000 * U, 'single': 250000 * U, 'married_separate': 250000 * U}       # IDOR
LOSS_LIMIT_2 = {'married_joint': 3000 * U, 'single': 3000 * U, 'married_separate': 1500 * U}           # IRC 1211(b)
PEOPLE_2 = {'single': 1, 'married_joint': 2, 'married_separate': 1}
TABLES_2 = {2026: (2026, True), 2027: (2026, False)}    # rules.py Y1: 2027 on the 2026 tables held flat, not verified
MONTH_DAYS_2 = (31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)


def num_u(s):
    """Derivation 2's own reading of a CSV number ('', '1234.56', '-45000', '0.5') -> whole units of 1e-8, or None."""
    s = str(s).strip()
    if s == '':
        return None
    neg = s[0] == '-'
    if s[0] in '+-':
        s = s[1:]
    whole, _, frac = s.partition('.')
    assert (whole + frac).isdigit() and len(frac) <= 8, s
    v = int(whole or '0') * U + int((frac + '00000000')[:8])
    return -v if neg else v


def int_2(s):
    s = s.strip()
    if s == '':
        return None
    assert s.isdigit(), s
    return int(s)


def day_2(s):
    y, m, d = (int(p) for p in s.split('-'))
    assert 1 <= m <= 12 and 1 <= d <= mlen_2(y, m), s
    return (y, m, d)


def iso_2(t):
    return '%04d-%02d-%02d' % t


def leap_2(y):
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def mlen_2(y, m):
    return 29 if (m == 2 and leap_2(y)) else MONTH_DAYS_2[m - 1]


def plus_months_2(t, k):
    """(y, m, d) moved k calendar months on, the day kept or, in a shorter month, its last day."""
    y, m, d = t
    y2, m0 = divmod(y * 12 + m - 1 + k, 12)
    return (y2, m0 + 1, min(d, mlen_2(y2, m0 + 1)))


def compact_2(s):
    out = []
    for part in s.split(';') if s != '' else []:
        out.append(part.split('|'))
    return out


def months_2(n, c, e):
    """The schedule's months in closed form: first = cliff (or every when the cliff is 0), then ceil((n - first) / e)
    months first + j x e below n, then n."""
    first = c if c > 0 else e
    if first >= n:
        return [n]
    steps = -(-(n - first) // e)
    return [first + j * e for j in range(steps)] + [n]


def schedule_2(shares, start, n, c, e):
    """[(date, shares)] and the count of months that add no share."""
    out, zero, prev, prev_m, d = [], 0, 0, 0, start
    for m in months_2(n, c, e):
        if MUT == 'month_end_chained':
            d = plus_months_2(d, m - prev_m)
            prev_m = m
        else:
            d = plus_months_2(start, m)
        cum = shares * m // n
        if cum == prev and MUT != 'zero_vests_kept':
            zero += 1
        else:
            out.append((d, cum - prev))
        prev = cum
    assert prev == shares
    return out, zero


def is_vested_2(d, today):
    return d < today if MUT == 'today_not_vested' else d <= today


def sched_2(row):
    shares = int_2(row['shares'])
    n = int_2(row['vest_months'])
    c = int_2(row['cliff_months'])
    e = int_2(row['every'])
    start = day_2(row['vest_start'])
    sch, zero = schedule_2(shares, start, VM_2 if n is None else n, CLIFF_2 if c is None else c, EVERY_2 if e is None else e)
    today = day_2(row['today'])
    vested = sum(sh for d, sh in sch if is_vested_2(d, today))
    nxt = [(iso_2(d), sh) for d, sh in sch if not is_vested_2(d, today)]
    return {'vests': [(iso_2(d), sh) for d, sh in sch], 'vest_count': len(sch), 'vested': vested,
            'unvested': shares - vested, 'next': nxt[0] if nxt else None, 'zero': zero,
            'fallback': any(d[2] != start[2] for d, _ in sch)}


FED_2 = {st: {'tops': [t * U for t in R.BRACKET_TOPS[2026][st]],
              'bases': [num_u(b) for b in R.RP_BASE[2026][st]],
              'sd': R.STANDARD_DEDUCTION[2026][st] * U,
              'z0': R.CG_ZERO_TOP[2026][st] * U, 'z15': R.CG_15_TOP[2026][st] * U} for st in STATUSES}
RATES_2 = tuple(R.RATES)


def over_2(a, b, lo, hi=None):
    """Length of the overlap of [a, b] with [lo, hi] (hi None = no top)."""
    top = b if hi is None else min(b, hi)
    return max(0, top - max(a, lo))


def regular_2(st, ti):
    """Rev. Proc. 2025-32's own form: the row "Over $lo but not over $top", its printed base plus the rate on the excess."""
    if ti <= 0:
        return 0
    T = FED_2[st]
    k = bisect_left(T['tops'], ti)
    lo = 0 if k == 0 else T['tops'][k - 1]
    return T['bases'][k] + (ti - lo) * RATES_2[k] // 100


def supp_2(cum, value, flat=SUPP_2, mand=MAND_2, over=MAND_OVER_2):
    """22% on the part of the payment up to $1,000,000 of the year's supplemental wages, 37% past it; and 37% on the whole
    payment when any of it is past (the law's option, W2)."""
    below = over_2(cum, cum + value, 0, over)
    above = value - below
    split = (flat * below + mand * above) // 100
    whole = mand * value // 100 if above > 0 else split
    if MUT == 'supp_whole_37':
        split = whole
    return split, whole, above


def il_law_2(st, a0, a1):
    """IDOR: tax(x) = 4.95% x max(0, x - A(x)), A = $2,925 a person, 0 above the AGI limit; = 4.95% x (max(0, x - a) +
    a x [x > limit]) because the limit is above the allowance. The change from a0 to a1, either direction."""
    a, lim = IL_LAW_2 * PEOPLE_2[st], IL_LIMIT_2[st]
    lo, hi, sign = (a0, a1, 1) if a1 >= a0 else (a1, a0, -1)
    jump = a if lo <= lim < hi else 0
    return sign * (495 * (over_2(lo, hi, a) + jump) // 10000)


def gain_tax_2(st, w, g):
    """A long-term gain g on top of wages w: the slice [ordinary taxable income, taxable income with the gain] by its
    overlap with the 0 / 15 / 20% bands, capped at the regular-tax change (worksheet line 25), plus the 3.8% NIIT as the
    overlap of [w, w + g] with the line."""
    T = FED_2[st]
    ti0, ti1 = max(0, w - T['sd']), max(0, w + g - T['sd'])
    pref = (15 * over_2(ti0, ti1, T['z0'], T['z15']) + 20 * over_2(ti0, ti1, T['z15'])) // 100
    cap = regular_2(st, ti1) - regular_2(st, ti0)
    if MUT == 'gain_ordinary':
        pref = cap
    if MUT == 'niit_whole_gain':
        niit = 38 * g // 1000 if w + g > NIIT_OVER_2[st] else 0
    else:
        niit = 38 * over_2(w, w + g, NIIT_OVER_2[st]) // 1000
    return min(pref, cap) + niit, niit


def derive_2(row):
    st = row['filing_status']
    today = day_2(row['today'])
    price = num_u(row['price'])
    il = row['state'] == 'IL'
    assert row['state'] in ('IL', 'none') and st in STATUSES and price > 0
    # the incomes (brief): salaries, or typed wages for the whole return; pay for the employer's 0.9%
    se, ss, tw = num_u(row['salary_employee']), num_u(row['salary_spouse']), num_u(row['wages_typed'])
    if tw is not None:
        assert se is None and ss is None and st != 'married_separate'
        base, spouse = tw, None
        pay = tw if MUT == 'medicare_pay_whole_return' else tw // PEOPLE_2[st]
    else:
        se, ss = se or 0, ss or 0
        assert st != 'single' or ss == 0
        base = se + ss if st == 'married_joint' else se
        spouse = ss if st == 'married_separate' else None
        pay = se
    # the grants
    grants = []
    for i, p in enumerate(compact_2(row['grants'])):
        kind, shares, start, vm, cl, ev, strike, granted = p
        assert kind in ('rsu', 'option') and (kind == 'rsu') == (strike == '') and granted in ('', start)
        n, c, e = int_2(vm), int_2(cl), int_2(ev)
        sch, _ = schedule_2(int_2(shares), day_2(start), VM_2 if n is None else n, CLIFF_2 if c is None else c,
                            EVERY_2 if e is None else e)
        grants.append({'i': i + 1, 'kind': kind, 'shares': int_2(shares), 'sched': sch,
                       'strike': num_u(strike) if kind == 'option' else None})
    # holdings and balances
    b_sh = k_sh = cost = bal_b = bal_k = bal_other = 0
    for p in compact_2(row['holdings']):
        if p[0] == 'brokerage':
            b_sh, cost = int_2(p[1]), num_u(p[2]) or 0
        else:
            assert p[0] == '401k'
            k_sh = int_2(p[1])
    for p in compact_2(row['accounts']):
        if p[0] == 'brokerage':
            bal_b += num_u(p[1])
        elif p[0] == '401k':
            bal_k += num_u(p[1])
        else:
            bal_other += num_u(p[1])          # savings: not investable (brief)
    if MUT == 'savings_invested':
        bal_b += bal_other
    held_b, held_k = b_sh * price, k_sh * price
    assert bal_b >= held_b and bal_k >= held_k
    vopt = unv_rsu = unv_opt = fall = 0
    per = []
    half = price // 2                          # price is whole cents, so exact
    for g in grants:
        v = sum(sh for d, sh in g['sched'] if is_vested_2(d, today))
        u = g['shares'] - v
        if g['kind'] == 'rsu':
            unv_rsu += u * price
            per.append((v, u, None))
        else:
            sp, sp_half = max(0, price - g['strike']), max(0, half - g['strike'])
            vopt += v * sp
            unv_opt += u * sp
            fall += (v if MUT == 'halving_vested_options_only' else g['shares']) * (sp - sp_half)
            per.append((v, u, sp))
    held = held_b + held_k
    owned = held + vopt
    unvested = unv_rsu + unv_opt
    exposure = owned + unvested
    invested = bal_b + bal_k + vopt + unvested
    if invested == 0:
        share = level = None
    else:
        share = exposure * RU // invested
        ok_line = exposure * 10 < invested if MUT == 'level_10_is_medium' else exposure * 10 <= invested
        level = 'ok' if ok_line else ('medium' if exposure * 4 <= invested else 'large')
    out = {'held_brokerage': held_b, 'held_401k': held_k, 'held_value': held, 'vested_options_value': vopt,
           'owned': owned, 'unvested_rsu_value': unv_rsu, 'unvested_options_value': unv_opt, 'unvested': unvested,
           'exposure': exposure, 'invested': invested, 'halving_loss': (held + unv_rsu) // 2 + fall}
    # the vests in view and the year's earlier vests
    end = plus_months_2(today, 12)
    view, earlier = [], 0
    for g in grants:
        if g['kind'] != 'rsu':
            continue
        for d, sh in g['sched']:
            if not is_vested_2(d, today) and d <= end:
                view.append({'date': d, 'grant': g['i'], 'shares': sh, 'value': sh * price, 'year': d[0]})
            elif is_vested_2(d, today) and d[0] == today[0]:
                earlier += sh * price
    view.sort(key=lambda v: (v['date'], v['grant']))
    years, vests = [], []
    for y in sorted({v['year'] for v in view}):
        vs = [v for v in view if v['year'] == y]
        Y = year_2(st, y, base, pay, earlier if y == today[0] else 0, vs, il)
        years.append(Y)
        vests.extend(vs)
    this_year = earlier + sum(v['value'] for v in view if v['year'] == today[0])
    # the sale
    sale = None
    if invested > 0 and exposure * 10 > invested and held > 0:
        need = min(held, exposure - invested // 10)          # invested is whole cents, so exact
        if MUT == 'sale_brokerage_first':
            from_b = min(need, held_b)
            from_k = need - from_b
        else:
            from_k = min(need, held_k)
            from_b = need - from_k
        gs = from_b * (held_b - cost) // held_b if from_b > 0 else 0
        gain = max(0, gs)
        owner = row['brokerage_owner']
        if st == 'married_separate':
            parts = {'employee': ((1, 1), (0, 1)), 'spouse': ((0, 1), (1, 1)), 'joint': ((1, 2), (1, 2))}
            if MUT == 'separate_gain_on_employee':
                parts = {k: ((1, 1), (0, 1)) for k in parts}
            assert from_b == 0 or owner in parts
            pe, ps = parts.get(owner, ((1, 1), (0, 1)))
            rets = [(base + this_year, pe), (spouse, ps)]
        else:
            rets = [(base + this_year, (1, 1))]
        tax = tax_law = niit = 0
        state_law = 0 if il else None
        for w, (pn, pd) in rets:
            if pn == 0:
                continue
            g, g_signed = gain * pn // pd, gs * pn // pd
            t, n_ = gain_tax_2(st, w, g)
            tax += t
            niit += n_
            if g_signed >= 0:
                tax_law += gain_tax_2(st, w, g_signed)[0]
                agi1 = w + g_signed
            else:
                allowed = min(-g_signed, LOSS_LIMIT_2[st])
                sd = FED_2[st]['sd']
                tax_law += regular_2(st, max(0, w - allowed - sd)) - regular_2(st, max(0, w - sd))
                agi1 = w - allowed
            if il:
                state_law += il_law_2(st, w, agi1)
        sale = {'need': need, 'from_401k': from_k, 'from_brokerage': from_b, 'gain': gain, 'gain_signed': gs,
                'tax': tax, 'tax_law': tax_law, 'state_tax_law': state_law, 'niit': niit,
                'share_after': (exposure - need) * RU // invested, 'shares_401k': from_k * RU // price,
                'shares_brokerage': from_b * RU // price}
    # back to exact Fractions for the guard
    res = {k: F(v, U) for k, v in out.items()}
    res.update(share=None if share is None else F(share, RU), level=level,
               grants=[(v, u, None if sp is None else F(sp, U)) for v, u, sp in per], view_end=iso_2(end),
               earlier=F(earlier, U), flat_ok=(pay > 0) if view else None, this_year=F(this_year, U))
    res['vests'] = [{**{k: (F(v[k], U) if v[k] is not None else None) for k in VEST_MONEY_KEYS},
                     'date': iso_2(v['date']), 'grant': v['grant'], 'shares': v['shares'], 'year': v['year']}
                    for v in vests]
    res['years'] = [{**{k: (F(Y[k], U) if Y[k] is not None else None) for k in YEAR_MONEY_KEYS},
                     'year': Y['year'], 'verified': Y['verified'], 'over_1m': Y['over_1m'], 'tie': Y['tie']}
                    for Y in years]
    if sale is not None:
        res['sale'] = {k: (None if sale[k] is None else F(sale[k], RU if k in SALE_RATE_KEYS else U)) for k in sale}
    else:
        res['sale'] = None
    return res


VEST_MONEY_KEYS = ('value', 'owed', 'supp', 'supp_whole', 'med', 'withheld', 'gap', 'gap_whole', 'withheld_whole',
                   'state_page', 'state_law')
YEAR_MONEY_KEYS = ('earlier', 'total', 'tax_before', 'tax_after', 'income_tax_owed', 'addl_owed', 'owed', 'supp', 'med',
                   'withheld', 'gap', 'withheld_whole', 'gap_whole', 'state_page', 'state_law')
SALE_RATE_KEYS = ('share_after', 'shares_401k', 'shares_brokerage')


def year_2(st, y, base, pay, earlier, vs, il):
    """One calendar year's vests in view, derivation 2."""
    _, verified = TABLES_2[y]
    T = FED_2[st]
    total = sum(v['value'] for v in vs)
    w0 = base + (0 if MUT == 'earlier_ignored' else earlier)
    w1 = w0 + total
    ti0, ti1 = max(0, w0 - T['sd']), max(0, w1 - T['sd'])
    inc0, inc1 = regular_2(st, ti0), regular_2(st, ti1)
    thr = AM_OWED_OVER_2[st]
    am0, am1 = 9 * max(0, w0 - thr) // 1000, 9 * max(0, w1 - thr) // 1000
    am_owed = 0 if MUT == 'no_addl_medicare_owed' else 9 * over_2(w0, w1, thr) // 1000
    owed = inc1 - inc0 + am_owed
    cum, supp_y, whole_y = earlier, 0, 0
    for v in vs:
        v['supp'], v['supp_whole'], _ = supp_2(cum, v['value'])
        cum += v['value']
        supp_y += v['supp']
        whole_y += v['supp_whole']
    wh_line = AM_OWED_OVER_2[st] if MUT == 'medicare_withheld_by_status' else AM_WH_OVER_2
    med = 9 * over_2(pay + earlier, pay + earlier + total, wh_line) // 1000
    st_page = st_law = None
    if il:
        allow = (IL_LAW_2 if MUT == 'il_page_2925' else IL_PAGE_2) * PEOPLE_2[st]
        st_page = 495 * over_2(w0, w1, allow) // 10000
        st_law = il_law_2(st, w0, w1)
    for v in vs:
        k = v['value']
        v['owed'] = owed * k // total
        v['med'] = med * k // total
        v['withheld'] = v['supp'] + v['med']
        v['gap'] = v['owed'] - v['withheld']
        v['withheld_whole'] = v['supp_whole'] + v['med']
        v['gap_whole'] = v['owed'] - v['withheld_whole']
        v['state_page'] = None if st_page is None else st_page * k // total
        v['state_law'] = None if st_law is None else st_law * k // total
    # same-day vests whose day's payments straddle $1,000,000 (T1)
    tie, run, i = False, earlier, 0
    while i < len(vs):
        j = i
        while j < len(vs) and vs[j]['date'] == vs[i]['date']:
            j += 1
        day = sum(v['value'] for v in vs[i:j])
        if j - i > 1 and run < MAND_OVER_2 < run + day:
            tie = True
        run += day
        i = j
    return {'year': y, 'verified': verified, 'earlier': earlier, 'total': total, 'tax_before': inc0 + am0,
            'tax_after': inc1 + am1, 'income_tax_owed': inc1 - inc0, 'addl_owed': am_owed, 'owed': owed,
            'supp': supp_y, 'med': med, 'withheld': supp_y + med, 'gap': owed - supp_y - med,
            'withheld_whole': whole_y + med, 'gap_whole': owed - whole_y - med, 'state_page': st_page,
            'state_law': st_law, 'over_1m': earlier + total > MAND_OVER_2, 'tie': tie}


# ======================================== comparing ========================================
POS_SPEC = tuple((k, 'm') for k in POS_MONEY) + (('share', 'r'), ('level', 's'), ('view_end', 's'), ('earlier', 'm'),
                                                ('flat_ok', 's'), ('this_year', 'm'))
VEST_SPEC = (('date', 's'), ('grant', 's'), ('shares', 's'), ('year', 's')) + tuple((k, 'm') for k in VEST_MONEY_KEYS)
YEAR_SPEC = (('year', 's'), ('verified', 's'), ('over_1m', 's'), ('tie', 's')) + tuple((k, 'm') for k in YEAR_MONEY_KEYS)
SALE_SPEC = tuple((k, 'm') for k in ('need', 'from_401k', 'from_brokerage', 'gain', 'gain_signed', 'tax', 'tax_law',
                                      'state_tax_law', 'niit')) + tuple((k, 'r') for k in SALE_RATE_KEYS)
SCHED_SPEC = (('vests', 's'), ('vest_count', 's'), ('vested', 's'), ('unvested', 's'), ('next', 's'), ('zero', 's'),
              ('fallback', 's'))


def compare_house(g, cid, a, b):
    g.fields(cid, POS_SPEC, a, b)
    g.same(cid, 'grant count', len(a['grants']), len(b['grants']))
    for i, (x, y) in enumerate(zip(a['grants'], b['grants'])):
        g.same(cid, f'grant {i + 1} vested', x[0], y[0])
        g.same(cid, f'grant {i + 1} unvested', x[1], y[1])
        g.money(cid, f'grant {i + 1} spread', x[2], y[2])
    g.same(cid, 'vest count', len(a['vests']), len(b['vests']))
    for i, (x, y) in enumerate(zip(a['vests'], b['vests'])):
        g.fields(f'{cid} vest {i + 1}', VEST_SPEC, x, y)
    g.same(cid, 'year count', len(a['years']), len(b['years']))
    for x, y in zip(a['years'], b['years']):
        g.fields(f'{cid} year {x["year"]}', YEAR_SPEC, x, y)
    g.same(cid, 'sale', a['sale'] is None, b['sale'] is None)
    if a['sale'] is not None:
        g.fields(f'{cid} sale', SALE_SPEC, a['sale'], b['sale'])


# ======================================== the RULES.md examples, by derivation 2 ========================================

def blank_house():
    return {k: '' for k in HOUSE_INPUTS}


def grant_str(gs):
    out = []
    for g in gs:
        kind, shares, start, vm, cl, ev, strike = (list(g) + [''] * 7)[:7]
        out.append('|'.join(str(x) for x in (kind, shares, start, vm, cl, ev, strike,
                                              start if kind == 'option' else '')))
    return ';'.join(out)


def H(label, st, today='2026-10-31', se='', ss='', tw='', state='none', price='100.00', grants=(), holdings='',
      owner='', accounts='', symbol='EMPLA'):
    r = blank_house()
    r.update(today=today, filing_status=st, salary_employee=str(se), salary_spouse=str(ss), wages_typed=str(tw),
             state=state, symbol=symbol, price=price, grants=grant_str(grants), holdings=holdings,
             brokerage_owner=owner, accounts=accounts)
    r['_label'] = label
    return r


def one_dec(n):
    """RULES.md s.9 "one December vest": all its shares vest on 2026-12-15."""
    return ('rsu', n, '2025-12-15', 12, 12, '', '')


def house_edges():
    """Edge rows: RULES.md s.9's worked examples first, then the brief's corners."""
    E = []
    E.append(H('RULES.md 9.1 Ari: one $100,000 December vest on $90,000 of pay (22% into 24%)', 'single', se=90000,
               grants=[one_dec(1000)], accounts='brokerage|50000.00;401k|150000.00'))
    E.append(H('RULES.md 9.2 Bo: $300,000 vested earlier in 2026, the December vest in the 35% band', 'single', se=90000,
               grants=[('rsu', 16000, '2022-12-15')], accounts='brokerage|400000.00;401k|300000.00'))
    E.append(H('RULES.md 9.3 Cal: $900,000 earlier, the December $300,000 crosses $1,000,000 (200,000 at 37%)', 'single',
               se=90000, grants=[('rsu', 48000, '2022-12-15')], accounts='brokerage|2000000.00;401k|500000.00'))
    E.append(H('RULES.md 9.4 Dee and Eli: joint, 0.9% owed past 250,000, withheld past Dee\'s 200,000', 'married_joint',
               se=180000, ss=60000, grants=[one_dec(1200)], accounts='brokerage|100000.00;401k|380000.00'))
    E.append(H('RULES.md 9.5 Fay: Illinois, $40,000 of pay, a $50,000 vest', 'single', se=40000, state='IL',
               grants=[one_dec(500)], accounts='brokerage|20000.00;401k|80000.00'))
    E.append(H('RULES.md 9.5 Fay at $230,000: the vest crosses the Illinois $250,000 limit (law 2,619.79, page 2,475)',
               'single', se=230000, state='IL', grants=[one_dec(500)], accounts='brokerage|200000.00;401k|300000.00'))
    gus = dict(st='single', se=40000, holdings='brokerage|2000|100000.00', accounts='brokerage|300000.00;401k|800000.00')
    E.append(H('RULES.md 9.6 Gus: a $90,000 sale with a $45,000 gain, 25,550 at 0% and 19,450 at 15%', **gus))
    E.append(H('RULES.md 9.6b Gus at a loss: page tax 0; law -360 ($3,000 against the wages)',
               **dict(gus, holdings='brokerage|2000|300000.00')))
    E.append(H('RULES.md 9.7 Gus with a $100,000 December vest: all of the gain at 15%',
               **dict(gus, grants=[one_dec(1000)], accounts='brokerage|300000.00;401k|1700000.00')))
    E.append(H('RULES.md 9.8 Bea: the whole page (RSUs from a month end, options, both holdings, 2026 and 2027 vests)',
               'single', se=120000, grants=[('rsu', 1000, '2023-08-31'), ('option', 2000, '2024-04-15', '', '', '', '60.00')],
               holdings='brokerage|500|20000.00;401k|300|', accounts='brokerage|120000.00;401k|250000.00'))
    hal = dict(st='married_separate', se=150000, ss=90000, grants=[one_dec(500)], holdings='brokerage|1000|60000.00',
               accounts='brokerage|150000.00;401k|800000.00')
    E.append(H('RULES.md 9.9 Hal and Ivy: separate, 0.9% owed past 125,000, withheld past 200,000; joint account sale',
               owner='joint', **hal))
    E.append(H('RULES.md 9.9 Hal and Ivy, the account Hal\'s alone (3,760)', owner='employee', **hal))
    E.append(H('RULES.md 9.9 Hal and Ivy, the account Ivy\'s alone (3,000)', owner='spouse', **hal))
    E.append(H('RULES.md 9.9b Hal\'s own account at a loss: page 0; law -360 ($1,500 on a separate return)',
               owner='employee', **dict(hal, holdings='brokerage|1000|160000.00')))
    # the brief's corners
    E.append(H('vest edges: a vest dated today is vested and earlier; today + 12 months is in view; a day later is not',
               'single', se=50000, price='10.00',
               grants=[('rsu', 100, '2025-10-31', 12, 12), ('rsu', 200, '2026-10-31', 12, 12),
                       ('rsu', 300, '2026-11-01', 12, 12)]))
    ten = dict(st='single', se=50000, price='10.00', holdings='brokerage|1000|0.00')
    E.append(H('share exactly 10%: ok, no sale', accounts='brokerage|10000.00;401k|90000.00', **ten))
    E.append(H('share just over 10%: sale of 0.10', accounts='brokerage|10000.00;401k|89999.00', **ten))
    q = dict(st='single', se=50000, price='10.00', holdings='brokerage|2500|10000.00')
    E.append(H('share exactly 25%: medium', accounts='brokerage|25000.00;401k|75000.00', **q))
    E.append(H('share just over 25%: large', accounts='brokerage|25000.00;401k|74999.99', **q))
    E.append(H('nothing at all: share blank', 'single', se=50000))
    E.append(H('savings only: not invested, share blank', 'single', se=50000, accounts='savings|20000.00'))
    E.append(H('no grants, no company shares: share 0', 'single', se=50000,
               accounts='brokerage|50000.00;savings|10000.00'))
    E.append(H('options only, under water: spread 0', 'single', se=80000, price='20.00',
               grants=[('option', 5000, '2024-01-15', '', '', '', '35.00')], accounts='brokerage|30000.00'))
    E.append(H('options in the money, one strike above and one below half the price', 'single', se=80000,
               grants=[('option', 1000, '2023-03-10', '', '', '', '70.00'), ('option', 1000, '2023-03-10', '', '', '', '40.00')],
               accounts='brokerage|30000.00'))
    big = ('rsu', 40000, '2025-01-15', 16, 0, 1)
    E.append(H('earlier exactly $1,000,000: the next vest is all at 37%', 'single', se=250000, today='2026-04-20',
               grants=[big], accounts='brokerage|500000.00;401k|500000.00'))
    E.append(H('earlier + in view exactly $1,000,000: nothing at 37%', 'single', se=250000, today='2026-03-20',
               grants=[('rsu', 37500, '2025-01-15', 15, 0, 1)], accounts='brokerage|500000.00;401k|500000.00'))
    E.append(H('two grants vest the same day across $1,000,000: grant order (T1), compare the day', 'single', se=150000,
               grants=[one_dec(7000), one_dec(5000)], accounts='brokerage|500000.00;401k|900000.00'))
    E.append(H('pay exactly $200,000: the whole vest has 0.9% withheld', 'single', se=200000, grants=[one_dec(300)],
               accounts='brokerage|100000.00;401k|200000.00'))
    E.append(H('no employee pay: the 22% flat rate needs regular-wage withholding (W1 flag)', 'single',
               grants=[one_dec(500)], accounts='brokerage|50000.00'))
    E.append(H('wages typed for a single return', 'single', tw=150000, grants=[one_dec(1000)],
               accounts='brokerage|200000.00;401k|300000.00'))
    E.append(H('wages typed for a joint return: pay = half for the 0.9% withholding', 'married_joint', tw=300000,
               grants=[one_dec(1000)], accounts='brokerage|200000.00;401k|300000.00'))
    E.append(H('Illinois, no other income, a $2,000 vest under the allowance: no state share', 'single', state='IL',
               grants=[one_dec(20)], accounts='brokerage|5000.00'))
    E.append(H('Illinois, no other income, a $10,000 vest across the allowance: page 353.93, law 350.21', 'single',
               state='IL', grants=[one_dec(100)], accounts='brokerage|5000.00'))
    E.append(H('Illinois joint, the vest crosses the $500,000 limit', 'married_joint', se=300000, ss=180000, state='IL',
               grants=[one_dec(400)], accounts='brokerage|300000.00;401k|500000.00'))
    E.append(H('Illinois separate, the vest crosses the $250,000 limit', 'married_separate', se=240000, ss=50000,
               state='IL', grants=[one_dec(200)], accounts='brokerage|300000.00;401k|500000.00'))
    E.append(H('today December 31: every vest in view is in 2027; earlier vests still count for the sale', 'single',
               se=130000, today='2026-12-31', grants=[('rsu', 4800, '2025-01-31')], holdings='brokerage|500|20000.00',
               accounts='brokerage|60000.00;401k|40000.00'))
    E.append(H('today January 1: the vest dated today is earlier', 'single', se=130000, today='2026-01-01',
               grants=[('rsu', 4800, '2025-01-01')], accounts='brokerage|60000.00;401k|40000.00'))
    E.append(H('sale from the 401(k) only: no tax', 'single', se=100000, holdings='401k|1000|',
               accounts='401k|300000.00'))
    E.append(H('the 401(k) first though the brokerage holds shares too: no tax', 'single', se=100000,
               holdings='brokerage|500|20000.00;401k|1000|', accounts='brokerage|50000.00;401k|600000.00'))
    E.append(H('the 3.8% NIIT on part of the gain (MAGI crosses 200,000 inside it)', 'single', se=190000,
               holdings='brokerage|2000|100000.00', accounts='brokerage|200000.00;401k|1200000.00'))
    E.append(H('brokerage cost equals value: gain 0', 'single', se=100000, holdings='brokerage|1000|100000.00',
               accounts='brokerage|100000.00;401k|100000.00'))
    E.append(H('separate, Illinois, joint account sale: the law taxes each half in Illinois', 'married_separate',
               se=120000, ss=80000, state='IL', holdings='brokerage|2000|50000.00', owner='joint',
               accounts='brokerage|200000.00;401k|300000.00'))
    E.append(H('pay $900,000 with quarterly vests (37% bracket)', 'single', se=900000, price='150.00',
               grants=[('rsu', 20000, '2024-03-15')], accounts='brokerage|1500000.00;401k|900000.00'))
    E.append(H('2027 vests crossing $1,000,000 from January (contrast owed)', 'single', se=250000, price='200.00',
               grants=[('rsu', 60000, '2026-01-10')], accounts='brokerage|900000.00;401k|600000.00'))
    E.append(H('the worksheet line 24 cap: a $500 gain just above the 0% top is taxed at 12%, not 15%', 'single',
               se=65600, holdings='brokerage|2000|199000.00', accounts='brokerage|200000.00;401k|800000.00'))
    E.append(H('no pay: the gain is absorbed by the standard deduction', 'single', holdings='brokerage|3000|150000.00',
               accounts='brokerage|300000.00;401k|2400000.00'))
    E.append(H('joint sale with the 3.8% NIIT on the whole gain', 'married_joint', se=300000, ss=100000,
               holdings='brokerage|3000|60000.00', accounts='brokerage|400000.00;401k|600000.00'))
    E.append(H('joint, the employee has no pay and the spouse does (W1 flag)', 'married_joint', ss=150000,
               grants=[one_dec(1000)], accounts='brokerage|100000.00;401k|200000.00'))
    E.append(H('separate, the employee\'s pay over $200,000 and the spouse with none', 'married_separate', se=260000,
               grants=[one_dec(400)], holdings='brokerage|800|30000.00', owner='spouse',
               accounts='brokerage|100000.00;401k|100000.00'))
    return E


def check_examples(edges):
    """RULES.md s.9 and the corners above, worked by hand, reproduced by derivation 2 (in whole dollars and cents)."""
    n = [0]

    def ok(cond, info):
        if not cond:
            raise AssertionError(info)
        n[0] += 1

    def m(x):
        return F(str(x))

    d = {e['_label'].split(':')[0]: derive_2(e) for e in edges}
    a = d['RULES.md 9.1 Ari']
    y = a['years'][0]
    ok(len(a['years']) == 1 and y['year'] == 2026 and y['owed'] == 23364 and y['supp'] == 22000 and y['med'] == 0
       and y['gap'] == 1364 and y['tax_before'] == 10970 and y['tax_after'] == 34334, ('9.1', y))
    ok(a['unvested'] == 100000 and a['invested'] == 300000 and abs(a['share'] - F(1, 3)) < MICRO
       and a['level'] == 'large' and a['halving_loss'] == 50000 and a['sale'] is None, ('9.1 position', a))
    b = d['RULES.md 9.2 Bo']
    y = b['years'][0]
    ok(b['earlier'] == 300000 and y['owed'] == 35900 and y['addl_owed'] == 900 and y['med'] == 900
       and y['withheld'] == 22900 and y['gap'] == 13000 and b['share'] == F(1, 8) and b['level'] == 'medium', ('9.2', y))
    c = d['RULES.md 9.3 Cal']
    y, v = c['years'][0], c['vests'][0]
    ok(c['earlier'] == 900000 and v['supp'] == 96000 and y['owed'] == 113700 and y['med'] == 2700
       and y['withheld'] == 98700 and y['gap'] == 15000 and y['withheld_whole'] == 113700 and y['gap_whole'] == 0
       and y['over_1m'] and rate6(c['share']) == '0.107143', ('9.3', y))
    de = d["RULES.md 9.4 Dee and Eli"]
    y = de['years'][0]
    ok(y['owed'] == 29718 and y['addl_owed'] == 990 and y['med'] == 900 and y['withheld'] == 27300 and y['gap'] == 2418
       and de['share'] == F(1, 5), ('9.4', y))
    f = d['RULES.md 9.5 Fay']
    y = f['years'][0]
    ok(y['owed'] == 8350 and y['withheld'] == 11000 and y['gap'] == -2650 and y['state_page'] == 2475
       and y['state_law'] == 2475, ('9.5', y))
    f = d['RULES.md 9.5 Fay at $230,000']
    y = f['years'][0]
    ok(y['state_page'] == 2475 and y['state_law'] == m('2619.7875'), ('9.5 at 230,000', y))
    g = d['RULES.md 9.6 Gus']['sale']
    ok(g['need'] == 90000 and g['from_401k'] == 0 and g['from_brokerage'] == 90000 and g['gain'] == 45000
       and g['tax'] == m('2917.50') and g['tax_law'] == m('2917.50') and g['share_after'] == F(1, 10)
       and g['shares_brokerage'] == 900 and d['RULES.md 9.6 Gus']['halving_loss'] == 100000, ('9.6', g))
    g = d['RULES.md 9.6b Gus at a loss']['sale']
    ok(g['gain'] == 0 and g['gain_signed'] == -45000 and g['tax'] == 0 and g['tax_law'] == -360, ('9.6b', g))
    g2 = d['RULES.md 9.7 Gus with a $100,000 December vest']
    ok(g2['sale']['tax'] == 6750 and g2['sale']['need'] == 90000 and g2['years'][0]['owed'] == 19714
       and g2['years'][0]['gap'] == -2286 and g2['this_year'] == 100000, ('9.7', g2['sale']))
    be = d['RULES.md 9.8 Bea']
    ok([(x['date'], x['shares']) for x in be['vests']] == [('2026-11-30', 62), ('2027-02-28', 63), ('2027-05-31', 62),
                                                            ('2027-08-31', 63)], ('9.8 vests', be['vests']))
    ok(be['held_value'] == 80000 and be['vested_options_value'] == 50000 and be['owned'] == 130000
       and be['unvested'] == 55000 and be['exposure'] == 185000 and be['invested'] == 475000
       and be['halving_loss'] == 132500 and be['earlier'] == 18800 and be['level'] == 'large'
       and be['grants'] == [(750, 250, None), (1250, 750, 40)], ('9.8 position', be))
    y6, y7 = be['years']
    ok(y6['owed'] == 1488 and y6['withheld'] == 1364 and y6['gap'] == 124 and y6['verified'], ('9.8 2026', y6))
    ok(not y7['verified'] and y7['earlier'] == 0 and y7['total'] == 18800 and y7['owed'] == 4476 and y7['supp'] == 4136
       and y7['gap'] == 340 and [money(x['owed']) for x in be['vests'][1:]] == ['1499.94', '1476.13', '1499.94'],
       ('9.8 2027', y7))
    s = be['sale']
    ok(s['need'] == 80000 and s['from_401k'] == 30000 and s['from_brokerage'] == 50000 and s['gain'] == 30000
       and s['tax'] == 4500 and rate6(s['share_after']) == '0.221053', ('9.8 sale', s))
    h = d['RULES.md 9.9 Hal and Ivy']
    y = h['years'][0]
    ok(y['owed'] == 12450 and y['addl_owed'] == 450 and y['med'] == 0 and y['gap'] == 1450 and h['share'] == F(15, 100)
       and h['sale']['need'] == 50000 and h['sale']['gain'] == 20000 and h['sale']['tax'] == 3380
       and h['sale']['niit'] == 380, ('9.9', y, h['sale']))
    ok(d["RULES.md 9.9 Hal and Ivy, the account Hal's alone (3,760)"]['sale']['tax'] == 3760, '9.9 Hal alone')
    ok(d["RULES.md 9.9 Hal and Ivy, the account Ivy's alone (3,000)"]['sale']['tax'] == 3000, '9.9 Ivy alone')
    s = d["RULES.md 9.9b Hal's own account at a loss"]['sale']
    ok(s['tax'] == 0 and s['gain_signed'] == -30000 and s['tax_law'] == -360, ('9.9b', s))
    # the corners
    e = d['vest edges']
    ok(e['earlier'] == 1000 and [(x['date'], x['shares']) for x in e['vests']] == [('2027-10-31', 200)]
       and [x[0] for x in e['grants']] == [100, 0, 0] and e['view_end'] == '2027-10-31', ('edges', e['vests']))
    ok(d['share exactly 10%']['level'] == 'ok' and d['share exactly 10%']['sale'] is None, '10%')
    s = d['share just over 10%']['sale']
    ok(s['need'] == m('0.10') and s['gain'] == m('0.10') and s['tax'] == 0, ('10% + ', s))
    ok(d['share exactly 25%']['level'] == 'medium' and d['share just over 25%']['level'] == 'large', '25%')
    ok(d['nothing at all']['share'] is None and d['savings only']['share'] is None
       and d['no grants, no company shares']['share'] == 0, 'blank shares')
    o = d['options only, under water']
    ok(o['exposure'] == 0 and o['halving_loss'] == 0 and o['grants'][0][2] == 0 and o['vests'] == [], ('under water', o))
    o = d['options in the money, one strike above and one below half the price']
    ok(o['halving_loss'] == 1000 * 30 + 1000 * 50, ('options halving', o['halving_loss']))
    y = d['earlier exactly $1,000,000']['years'][0]
    ok(y['earlier'] == 1000000 and y['over_1m'] and y['supp'] == 92500, ('earlier 1M', y))
    y = d['earlier + in view exactly $1,000,000']['years'][0]
    ok(y['earlier'] == 750000 and y['total'] == 250000 and not y['over_1m'] and y['supp'] == 55000, ('exactly 1M', y))
    tw = d['two grants vest the same day across $1,000,000']
    ok(tw['years'][0]['tie'] and [x['supp'] for x in tw['vests']] == [154000, 140000], ('tie', tw['vests']))
    ok(d['pay exactly $200,000']['years'][0]['med'] == 270, 'pay 200,000')
    ok(d['no employee pay']['flat_ok'] is False and d['RULES.md 9.1 Ari']['flat_ok'] is True, 'W1')
    y = d['wages typed for a single return']['years'][0]
    ok(y['owed'] == 27020 and y['med'] == 450 and y['gap'] == 4570, ('typed single', y))
    y = d['wages typed for a joint return']['years'][0]
    ok(y['owed'] == 24900 and y['addl_owed'] == 900 and y['med'] == 450 and y['gap'] == 2450, ('typed joint', y))
    y = d['Illinois, no other income, a $2,000 vest under the allowance']['years'][0]
    ok(y['state_page'] == 0 and y['state_law'] == 0, ('IL small', y))
    y = d['Illinois, no other income, a $10,000 vest across the allowance']['years'][0]
    ok(y['state_page'] == m('353.925') and y['state_law'] == m('350.2125'), ('IL straddle', y))
    y = d['Illinois joint, the vest crosses the $500,000 limit']['years'][0]
    ok(y['state_page'] == 1980 and y['state_law'] == m('2269.575'), ('IL joint limit', y))
    y = d['Illinois separate, the vest crosses the $250,000 limit']['years'][0]
    ok(y['state_page'] == 990 and y['state_law'] == m('1134.7875'), ('IL separate limit', y))
    dec = d['today December 31']
    ok([x['year'] for x in dec['years']] == [2027] and dec['earlier'] == 2100 * 100 and dec['this_year'] == 210000
       and dec['view_end'] == '2027-12-31', ('Dec 31', dec['years'], dec['earlier']))
    jan = d['today January 1']
    ok(jan['earlier'] == 1200 * 100 and jan['vests'][0]['date'] == '2026-04-01', ('Jan 1', jan['vests'][:1]))
    s = d['sale from the 401(k) only']['sale']
    ok(s['from_401k'] == 70000 and s['from_brokerage'] == 0 and s['tax'] == 0 and s['gain'] == 0, ('401k only', s))
    ok(d['brokerage cost equals value']['sale']['gain'] == 0, 'cost = value')
    s = d['the 401(k) first though the brokerage holds shares too']['sale']
    ok(s['need'] == 85000 and s['from_401k'] == 85000 and s['from_brokerage'] == 0 and s['tax'] == 0, ('401k first', s))
    s = d['the 3.8% NIIT on part of the gain (MAGI crosses 200,000 inside it)']['sale']
    ok(s['gain'] == 30000 and s['niit'] == 760 and s['tax'] == 5260, ('NIIT part', s))
    s = d['the worksheet line 24 cap']['sale']
    ok(s['gain'] == 500 and s['tax'] == 60, ('line 24 cap', s))
    s = d['no pay']['sale']
    ok(s['gain'] == 15000 and s['tax'] == 0, ('no pay sale', s))
    s = d['joint sale with the 3.8% NIIT on the whole gain']['sale']
    ok(s['gain'] == 160000 and s['niit'] == 6080 and s['tax'] == 30080, ('joint NIIT', s))
    # the sources' own withholding examples through supp_2 (CFR 31.3402(g)-1(a)(8) Examples 1 and 3 at their 25% / 35%)
    ok(supp_2(600000 * U, 2300000 * U, 25, 35)[0] == 765000 * U and supp_2(600000 * U, 2300000 * U, 25, 35)[1] == 805000 * U,
       'CFR Example 1')
    ok(supp_2(2900000 * U, 10000 * U, 25, 35)[0] == 3500 * U and supp_2(0, 3000000 * U, 25, 35)[0] == 950000 * U,
       'CFR Examples 1 and 3')
    ok(supp_2(0, 1000 * U)[0] == 220 * U, 'Pub. 15 s.7 Example 3')
    # the schedules of RULES.md s.3.1 and s.9.8
    ok([sh for _, sh in schedule_2(5, (2026, 1, 1), 48, 12, 3)[0]] == [1] * 5
       and schedule_2(5, (2026, 1, 1), 48, 12, 3)[1] == 8, 'Z1')
    ok([sh for _, sh in schedule_2(100, (2026, 1, 1), 10, 0, 3)[0]] == [30, 30, 30, 10], '10 / 0 / 3')
    ok(months_2(48, 12, 3) == [12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48] and months_2(6, 0, 12) == [6]
       and months_2(12, 12, 3) == [12], 'months')
    bea = schedule_2(1000, (2023, 8, 31), 48, 12, 3)[0]
    ok([iso_2(x) for x, _ in bea][:4] == ['2024-08-31', '2024-11-30', '2025-02-28', '2025-05-31'], 'month ends')
    return n[0]


# ======================================== the generator ========================================

def pick(rng, weighted):
    total = sum(w for _, w in weighted)
    x = rng.randrange(total)
    for v, w in weighted:
        if x < w:
            return v
        x -= w
    raise AssertionError


def in_range(rng, ranges):
    """A whole number from one of [((lo, hi), weight), ...]."""
    lo, hi = pick(rng, ranges)
    return rng.randint(lo, hi)


def cents_str(c):
    assert c >= 0
    return f'{c // 100}.{c % 100:02d}'


def month_len(y, m):
    return (date(y + (m == 12), m % 12 + 1, 1) - date(y, m, 1)).days


def start_day(rng, y, m, month_end_share):
    """A day of month (y, m): 1-28 mostly; the 29th, 30th, 31st or the month's last day `month_end_share` % of the time
    (a day the month lacks becomes its last day, since an input date must exist)."""
    ml = month_len(y, m)
    if rng.randrange(100) < month_end_share:
        return date(y, m, min(pick(rng, [(29, 2), (30, 2), (31, 3), (ml, 3)]), ml))
    return date(y, m, rng.randint(1, 28))


D2026 = date(2026, 1, 1)


def sched_edges():
    E = []

    def S(note, shares, start, vm='', cl='', ev='', today='2026-10-31'):
        E.append({'shares': str(shares), 'vest_start': start, 'vest_months': str(vm), 'cliff_months': str(cl),
                  'every': str(ev), 'today': today, '_label': note})

    S('RULES.md 9.8 Bea: 1,000 from 2023-08-31, all blank (48 / 12 / 3): month ends', 1000, '2023-08-31')
    S('RULES.md 3.1 Z1: 5 shares over 48 months vest 1 at months 12, 21, 30, 39, 48', 5, '2026-01-01', 48, 12, 3)
    S('5 shares over 48 months, started 2023-01-01', 5, '2023-01-01', 48, 12, 3)
    S('100 shares, 10 months, no cliff, every 3: 30, 30, 30, then 10 at month 10', 100, '2026-01-01', 10, 0, 3)
    S('one vest: cliff = vest_months = 12', 1200, '2025-12-15', 12, 12, '')
    S('vest_months 6 under every 12, no cliff: one vest at month 6', 600, '2026-03-31', 6, 0, 12)
    S('monthly from January 31, 2024: February 29, 2024, then 28ths and month ends', 4800, '2024-01-31', 48, 0, 1)
    S('February 29, 2024 start, yearly: 2025-02-28, 2026-02-28, 2027-02-28, 2028-02-29', 400, '2024-02-29', 48, 12, 12)
    S('August 31 start, cliff 6, every 3: February 28, then May 31 again', 960, '2025-08-31', 24, 6, 3)
    S('January 30 start, monthly', 360, '2025-01-30', 36, 0, 1)
    S('January 29 start, monthly (2028 has a February 29)', 360, '2025-01-29', 36, 0, 1)
    S('December 31 start, monthly for a year', 1200, '2025-12-31', 12, 0, 1)
    S('a vest the day after today', 4000, '2025-03-15', '', '', '', '2026-03-14')
    S('a vest dated today: vested', 4000, '2025-03-15', '', '', '', '2026-03-15')
    S('a vest the day before today', 4000, '2025-03-15', '', '', '', '2026-03-16')
    S('starts after today: nothing vested', 4000, '2026-12-01')
    S('ended years ago: all vested', 4000, '2018-01-01')
    S('1 share: one vest at month 48, 12 months without shares', 1, '2023-05-20')
    S('1,000,000 shares, monthly after the cliff', 1000000, '2024-06-10', 48, 12, 1)
    S('vest_months 1, no cliff, every 1', 50, '2026-05-31', 1, 0, 1)
    S('every longer than what follows the cliff: months 12 and 48', 4800, '2023-07-31', 48, 12, 40)
    S('cliff = vest_months = 48', 4800, '2022-11-30', 48, 48, 3)
    S('no cliff, every 7: 7, 14, ... 42, then 48', 4800, '2023-02-28', 48, 0, 7)
    S('vest_months 36 typed, cliff and every blank', 3600, '2024-10-31', 36)
    S('cliff 0 typed, the rest blank', 4800, '2024-10-31', '', 0)
    S('every 1 typed, the rest blank', 4800, '2024-10-31', '', '', 1)
    S('today December 31', 4800, '2023-12-31', '', '', '', '2026-12-31')
    S('today January 1', 4800, '2023-01-01', '', '', '', '2026-01-01')
    S('cliff 1, every 1, 7 shares over 12 months', 7, '2026-02-28', 12, 1, 1)
    S('odd count: 1,001 shares over 48 / 12 / 3', 1001, '2024-05-31')
    return E


def random_sched(rng):
    shares = in_range(rng, [((1, 20), 8), ((21, 500), 25), ((501, 5000), 35), ((5001, 50000), 25), ((50001, 1000000), 7)])
    t = in_range(rng, [((0, 47), 12), ((48, 107), 78), ((108, 113), 10)])   # 2018-01 to 2021-12 / 2022-01 to 2026-12 / 2027-01 to 06
    y, m = 2018 + t // 12, t % 12 + 1
    start = start_day(rng, y, m, 35)
    vm = '' if rng.randrange(100) < 35 else str(pick(rng, [(48, 20), (36, 15), (24, 15), (12, 10), (60, 8),
                                                           (rng.randint(1, 72), 32)]))
    n_eff = 48 if vm == '' else int(vm)
    if rng.randrange(100) < 35 and n_eff >= 12:
        cl = ''
    else:
        cl = str(pick(rng, [(0, 35), (min(12, n_eff), 20), (rng.randint(1, min(n_eff, 24)), 45)]))
    ev = '' if rng.randrange(100) < 35 else str(pick(rng, [(1, 25), (3, 25), (6, 10), (12, 10), (rng.randint(1, 24), 30)]))
    today = D2026 + timedelta(days=rng.randrange(365))
    row = {'shares': str(shares), 'vest_start': start.isoformat(), 'vest_months': vm, 'cliff_months': cl, 'every': ev,
           'today': today.isoformat(), '_label': ''}
    if rng.randrange(100) < 20:                          # today on a vest of 2026, or a day either side
        dates = [v['date'] for v in R.vest_schedule(shares, start, vm, cl, ev) if v['date'].year == 2026]
        if dates:
            d = dates[rng.randrange(len(dates))] + timedelta(days=rng.randint(-1, 1))
            if d.year == 2026:
                row['today'] = d.isoformat()
    return row


SCHED_INPUTS = ['case_id', 'row_kind', 'shares', 'vest_start', 'vest_months', 'cliff_months', 'every', 'today']
SCHED_COLUMNS = SCHED_INPUTS + ['vests', 'vest_count', 'vested', 'unvested', 'next_vest', 'zero_share_months', 'note']


def sched_note(r, d):
    parts = [r['_label']] if r['_label'] else []
    if d['zero']:
        parts.append(f'{d["zero"]} month(s) add no whole share and are not listed (Z1)')
    if d['fallback']:
        parts.append('a vest falls on a shorter month\'s last day')
    if any(dt == r['today'] for dt, _ in d['vests']):
        parts.append('a vest is dated today (vested)')
    return '; '.join(parts)


def sched_stats(s, r, d):
    s['rows'] += 1
    for k, lab in (('vest_months', 'vest_months'), ('cliff_months', 'cliff_months'), ('every', 'every')):
        s[f'{lab} blank'] += r[k] == ''
    s['all three blank'] += r['vest_months'] == r['cliff_months'] == r['every'] == ''
    s['cliff 0 typed'] += r['cliff_months'] == '0'
    day = int(r['vest_start'][8:])
    y, m = int(r['vest_start'][:4]), int(r['vest_start'][5:7])
    s['vest_start on the 29th'] += day == 29
    s['vest_start on the 30th'] += day == 30
    s['vest_start on the 31st'] += day == 31
    s['vest_start on a month end'] += day == month_len(y, m)
    s['a vest falls back to a shorter month\'s last day'] += d['fallback']
    s['a vest on February 29'] += any(dt[5:] == '02-29' for dt, _ in d['vests'])
    s['a vest dated today'] += any(dt == r['today'] for dt, _ in d['vests'])
    s['nothing vested'] += d['vested'] == 0
    s['all vested'] += d['unvested'] == 0
    s['part vested'] += 0 < d['vested'] < int(r['shares'])
    s['months without shares (Z1)'] += d['zero'] > 0
    s['one vest'] += d['vest_count'] == 1
    s['every 1 (monthly)'] += r['every'] == '1'
    s['vest_start after today'] += r['vest_start'] > r['today']


def build_sched(rng, guard):
    cases = sched_edges()
    n_edge = len(cases)
    while len(cases) < N_SCHED:
        cases.append(random_sched(rng))
    rows, s = [], Counter()
    for i, c in enumerate(cases):
        cid = f'es-sch-{i + 1:04d}'
        d1, d2 = sched_1(c), sched_2(c)
        guard.fields(cid, SCHED_SPEC, d1, d2)
        sched_stats(s, c, d1)
        s['rows edge' if i < n_edge else 'rows random'] += 1
        rows.append({'case_id': cid, 'row_kind': 'edge' if i < n_edge else 'random',
                     **{k: c[k] for k in SCHED_INPUTS[2:]},
                     'vests': ';'.join(f'{dt}:{sh}' for dt, sh in d1['vests']), 'vest_count': d1['vest_count'],
                     'vested': d1['vested'], 'unvested': d1['unvested'],
                     'next_vest': '' if d1['next'] is None else f'{d1["next"][0]}:{d1["next"][1]}',
                     'zero_share_months': d1['zero'], 'note': sched_note(c, d1)})
    return rows, s, n_edge


# ---- households ----
HOUSE_INPUTS = ['case_id', 'row_kind', 'today', 'filing_status', 'salary_employee', 'salary_spouse', 'wages_typed',
                'state', 'symbol', 'price', 'grants', 'holdings', 'brokerage_owner', 'accounts']


def salary(rng, who):
    if who == 'employee':
        return in_range(rng, [((15000, 59999), 14), ((60000, 149999), 30), ((150000, 199999), 15),
                              ((200000, 200000), 1), ((200001, 349999), 18), ((350000, 599999), 10),
                              ((600000, 900000), 6)])
    return in_range(rng, [((8000, 99999), 45), ((100000, 299999), 45), ((300000, 600000), 10)])


def money_str(rng, dollars, cents_share):
    if rng.randrange(100) < cents_share:
        return cents_str(dollars * 100 + rng.randint(1, 99))
    return str(dollars)


def random_house(rng):
    st = pick(rng, [('single', 44), ('married_joint', 40), ('married_separate', 16)])
    today = D2026 + timedelta(days=rng.randrange(365))
    il = rng.randrange(100) < 20
    big = rng.randrange(100) < 10
    r = blank_house()
    r.update(today=today.isoformat(), filing_status=st, state='IL' if il else 'none', symbol=SYMBOLS[rng.randrange(4)],
             _label='')
    if st != 'married_separate' and rng.randrange(100) < 7:
        r['wages_typed'] = str(in_range(rng, [((20000, 199999), 40), ((200000, 499999), 40), ((500000, 900000), 20)]))
    elif il and rng.randrange(100) < 18:
        pass                                              # Illinois with no other income
    else:
        if rng.randrange(100) >= 6:
            r['salary_employee'] = money_str(rng, salary(rng, 'employee'), 5)
        if st == 'married_joint' and rng.randrange(100) >= 25:
            r['salary_spouse'] = money_str(rng, salary(rng, 'spouse'), 5)
        if st == 'married_separate' and rng.randrange(100) >= 5:
            r['salary_spouse'] = money_str(rng, salary(rng, 'spouse'), 5)
    price_c = in_range(rng, [((500, 3999), 25), ((4000, 14999), 45), ((15000, 60000), 30)])
    r['price'] = cents_str(price_c)
    grants = []
    for _ in range(pick(rng, [(0, 10), (1, 40), (2, 32), (3, 18)])):
        kind = 'rsu' if rng.randrange(100) < 72 else 'option'
        if kind == 'rsu':
            value = in_range(rng, [((3000000, 16000000), 1)] if big else
                             [((5000, 59999), 30), ((60000, 249999), 40), ((250000, 799999), 25), ((800000, 2000000), 5)])
        else:
            value = in_range(rng, [((5000, 400000), 1)])
        shares = max(1, value * 100 // price_c)
        back = in_range(rng, [((-4, -1), 5), ((0, 11), 20), ((12, 44), 62), ((45, 58), 13)])   # months since vest_start
        t = today.year * 12 + today.month - 1 - back
        start = start_day(rng, t // 12, t % 12 + 1, 30)
        vm = '' if rng.randrange(100) < 55 else str(pick(rng, [(48, 30), (36, 20), (24, 15), (12, 10), (60, 10),
                                                               (30, 8), (18, 7)]))
        cl = '' if rng.randrange(100) < 55 else str(pick(rng, [(0, 40), (12, 20), (6, 15), (3, 10), (1, 5), (24, 10)]))
        ev = '' if rng.randrange(100) < 55 else str(pick(rng, [(1, 30), (3, 25), (6, 15), (12, 15), (2, 10), (4, 5)]))
        if int(cl or 12) > int(vm or 48):
            cl = '0'
        strike = ''
        if kind == 'option':
            mode = pick(rng, [('under', 30), ('deep', 45), ('partial', 25)])
            pct = {'under': (105, 250), 'deep': (10, 50), 'partial': (51, 95)}[mode]
            strike = cents_str(max(1, price_c * rng.randint(*pct) // 100))
        grants.append((kind, shares, start.isoformat(), vm, cl, ev, strike))
    r['grants'] = grant_str(grants)
    mode = pick(rng, [('none', 25), ('brokerage', 25), ('401k', 15), ('both', 35)])
    hold, b_sh, k_sh = [], 0, 0
    if mode in ('brokerage', 'both'):
        b_sh = max(1, in_range(rng, [((1000, 49999), 30), ((50000, 299999), 50), ((300000, 1500000), 20)]) * 100 // price_c)
        held_c = b_sh * price_c
        cmode = pick(rng, [('gain', 62), ('loss', 16), ('zero', 4), ('equal', 3), ('near', 15)])
        cost_c = {'gain': held_c * rng.randint(5, 95) // 100, 'loss': held_c * rng.randint(105, 190) // 100, 'zero': 0,
                  'equal': held_c, 'near': held_c * rng.randint(95, 105) // 100}[cmode]
        hold.append(f'brokerage|{b_sh}|{cents_str(cost_c)}')
    if mode in ('401k', 'both'):
        k_sh = max(1, in_range(rng, [((1000, 39999), 40), ((40000, 400000), 60)]) * 100 // price_c)
        hold.append(f'401k|{k_sh}|')
    r['holdings'] = ';'.join(hold)
    if st == 'married_separate' and b_sh:
        r['brokerage_owner'] = pick(rng, [('employee', 40), ('spouse', 30), ('joint', 30)])
    extra = [((0, 0), 10), ((1000, 49999), 18), ((50000, 399999), 36), ((400000, 2500000), 36)]
    acc = []
    if b_sh or rng.randrange(100) < 70:
        acc.append(f'brokerage|{cents_str(b_sh * price_c + in_range(rng, extra) * 100 + rng.randint(0, 99))}')
    if k_sh or rng.randrange(100) < 75:
        acc.append(f'401k|{cents_str(k_sh * price_c + in_range(rng, extra) * 100 + rng.randint(0, 99))}')
    if rng.randrange(100) < 40:
        acc.append(f'savings|{cents_str(rng.randint(50000, 15000000))}')
    r['accounts'] = ';'.join(acc)
    return r


VEST_COLUMNS = ('date', 'shares', 'value', 'owed', 'withheld', 'gap', 'state')
HOUSE_COLUMNS = HOUSE_INPUTS + [
    'held_value', 'vested_options_value', 'owned', 'unvested', 'exposure', 'invested', 'share', 'level', 'stress_loss',
    'held_brokerage', 'held_401k', 'unvested_rsu_value', 'unvested_options_value', 'grant_results',
    'view_end', 'earlier_this_year', 'flat_rate_ok', 'vests', 'vests_detail', 'years', 'years_detail',
    'sell_need', 'sell_from_401k', 'sell_from_brokerage', 'sell_gain', 'sell_tax', 'sell_share_after',
    'sell_shares_401k', 'sell_shares_brokerage',
    'vests_law', 'years_law', 'sell_gain_law', 'sell_tax_law', 'sell_state_tax_law',
    'contrast_2027_years', 'contrast_2027_vests', 'note']


def house_row(cid, kind, r, d):
    ver = {Y['year']: Y['verified'] for Y in d['years']}

    def main(v, key):
        return money(v[key]) if ver[v['year']] else ''

    out = {k: r[k] for k in HOUSE_INPUTS[2:]}
    out.update(case_id=cid, row_kind=kind,
               held_value=money(d['held_value']), vested_options_value=money(d['vested_options_value']),
               owned=money(d['owned']), unvested=money(d['unvested']), exposure=money(d['exposure']),
               invested=money(d['invested']), share=rate6(d['share']), level=d['level'] or '',
               stress_loss=money(d['halving_loss']), held_brokerage=money(d['held_brokerage']),
               held_401k=money(d['held_401k']), unvested_rsu_value=money(d['unvested_rsu_value']),
               unvested_options_value=money(d['unvested_options_value']),
               grant_results=';'.join(f'{v}|{u}|{money(sp)}' for v, u, sp in d['grants']),
               view_end=d['view_end'], earlier_this_year=money(d['earlier']), flat_rate_ok=yn(d['flat_ok']))
    out['vests'] = ';'.join('|'.join((v['date'], str(v['shares']), money(v['value']), main(v, 'owed'),
                                      money(v['withheld']), main(v, 'gap'), money(v['state_page']))) for v in d['vests'])
    out['vests_detail'] = ';'.join(f'{v["grant"]}|{money(v["supp"])}|{money(v["med"])}' for v in d['vests'])
    out['years'] = ';'.join('|'.join((str(Y['year']), money(Y['earlier']), money(Y['total']),
                                      money(Y['owed']) if Y['verified'] else '', money(Y['withheld']),
                                      money(Y['gap']) if Y['verified'] else '', yn(Y['over_1m']), money(Y['med']),
                                      money(Y['state_page']))) for Y in d['years'])
    out['years_detail'] = ';'.join('|'.join((str(Y['year']), *(money(Y[k]) if Y['verified'] else '' for k in
                                            ('tax_before', 'tax_after', 'income_tax_owed', 'addl_owed')),
                                             money(Y['supp']))) for Y in d['years'])
    s = d['sale']
    for col, key in (('sell_need', 'need'), ('sell_from_401k', 'from_401k'), ('sell_from_brokerage', 'from_brokerage'),
                     ('sell_gain', 'gain'), ('sell_tax', 'tax'), ('sell_gain_law', 'gain_signed'),
                     ('sell_tax_law', 'tax_law'), ('sell_state_tax_law', 'state_tax_law')):
        out[col] = '' if s is None else money(s[key])
    for col, key in (('sell_share_after', 'share_after'), ('sell_shares_401k', 'shares_401k'),
                     ('sell_shares_brokerage', 'shares_brokerage')):
        out[col] = '' if s is None else rate6(s[key])
    out['vests_law'] = ';'.join('|'.join((v['date'], money(v['withheld_whole']), main(v, 'gap_whole'),
                                          money(v['state_law']))) for v in d['vests'])
    out['years_law'] = ';'.join('|'.join((str(Y['year']), money(Y['withheld_whole']),
                                          money(Y['gap_whole']) if Y['verified'] else '', money(Y['state_law']),
                                          yn(Y['tie']))) for Y in d['years'])
    out['contrast_2027_years'] = ';'.join('|'.join((str(Y['year']), *(money(Y[k]) for k in
                                                   ('tax_before', 'tax_after', 'owed', 'gap', 'gap_whole'))))
                                          for Y in d['years'] if not Y['verified'])
    out['contrast_2027_vests'] = ';'.join('|'.join((v['date'], money(v['owed']), money(v['gap']), money(v['gap_whole'])))
                                          for v in d['vests'] if not ver[v['year']])
    out['note'] = house_note(r, d)
    return out


def written_amounts(d):
    """Every amount the row writes (for the half-cent count)."""
    xs = [d[k] for k in POS_MONEY] + [d['earlier']] + [sp for _, _, sp in d['grants']]
    for v in d['vests']:
        xs += [v[k] for k in ('value', 'owed', 'withheld', 'gap', 'state_page', 'supp', 'med', 'withheld_whole',
                              'gap_whole', 'state_law')]
    for Y in d['years']:
        xs += [Y[k] for k in YEAR_MONEY_KEYS]
    if d['sale']:
        xs += [d['sale'][k] for k in ('need', 'from_401k', 'from_brokerage', 'gain', 'gain_signed', 'tax', 'tax_law',
                                     'state_tax_law')]
    return xs


def house_note(r, d):
    parts = [r['_label']] if r.get('_label') else []
    if any(not Y['verified'] for Y in d['years']):
        parts.append('2027 vests: owed and gap are blank in the main columns; contrast_2027_* works them on the 2026 '
                     'tables held flat (2027 tables not published on 2026-10-31)')
    if d['flat_ok'] is False:
        parts.append('no employee pay: the 22% flat rate presumes income tax withheld from regular wages (W1); the law '
                     'would need the aggregate method')
    for Y in d['years']:
        if Y['over_1m'] and Y['earlier'] < R.SUPP_MANDATORY_OVER:
            parts.append(f'{Y["year"]}: the vests cross $1,000,000 of supplemental wages (37% on the excess; law '
                         'contrast: 37% on the whole crossing vest)')
        elif Y['over_1m']:
            parts.append(f'{Y["year"]}: earlier vests already past $1,000,000, every vest at 37%')
        if Y['tie']:
            parts.append(f'{Y["year"]}: same-day vests straddle $1,000,000 (T1, grant order): compare the day\'s total')
        if Y['state_law'] is not None and abs(Y['state_law'] - Y['state_page']) >= CENT:
            parts.append(f'{Y["year"]}: Illinois law share differs from the page by {usd(Y["state_law"] - Y["state_page"])}')
    s = d['sale']
    if s:
        if s['gain_signed'] < 0:
            parts.append(f'the brokerage is at a loss: page tax 0; law {usd(s["tax_law"])} (1211(b))')
        if s['share_after'] > F(1, 10):
            parts.append('the held shares run out first: the share stays above 10% after the sale')
        if s['state_tax_law']:
            parts.append(f'Illinois would tax the sale: {usd(s["state_tax_law"])} (law column; the page\'s sale tax is '
                         'federal only)')
    if 'savings|' in r['accounts']:
        parts.append('savings not counted as invested')
    if any(sp == 0 for _, _, sp in d['grants']):
        parts.append('options under water')
    ties = sum(half_cent(x) for x in written_amounts(d))
    if ties:
        parts.append(f'{ties} written amount(s) sit on a half cent (rounded up)')
    return '; '.join(parts)


def house_stats(s, r, d):
    st = r['filing_status']
    s['rows'] += 1
    s[f'status {st}'] += 1
    s[f'state {r["state"]}'] += 1
    no_income = r['salary_employee'] == r['salary_spouse'] == r['wages_typed'] == ''
    if r['state'] == 'IL':
        s['Illinois without other income' if no_income else 'Illinois with other income'] += 1
    if r['wages_typed']:
        s[f'typed wages {st}'] += 1
    pay = d1_pay(r)
    s['pay ' + ('0' if pay == 0 else 'under 100,000' if pay < 100000 else '100,000 to 199,999' if pay < 200000 else
                '200,000 to 499,999' if pay < 500000 else '500,000 to 900,000')] += 1
    gs = compact_1(r['grants'])
    s[f'grants {len(gs)}'] += 1
    price = fr(r['price'])
    for g in gs:
        if g[0] == 'option':
            k = fr(g[6])
            s['option grants under water' if k >= price else 'option grants, strike at or below half the price'
              if k <= price / 2 else 'option grants, strike between half the price and the price'] += 1
        else:
            s['RSU grants'] += 1
    h = r['holdings']
    s['holdings ' + ('none' if h == '' else 'both' if ';' in h else 'brokerage only' if h.startswith('b') else
                     '401(k) only')] += 1
    for p in compact_1(h):
        if p[0] == 'brokerage':
            v, c = int(p[1]) * price, fr(p[2])
            s['brokerage at a loss' if c > v else 'brokerage at a gain' if c < v else 'brokerage at cost'] += 1
    s['savings balance (not invested)'] += 'savings|' in r['accounts']
    s['level ' + (d['level'] or 'blank (nothing invested)')] += 1
    s['share under 10%'] += d['share'] is not None and d['share'] < F(1, 10)
    sale = d['sale']
    if sale:
        s['sale'] += 1
        s['sale from ' + ('both' if sale['from_401k'] and sale['from_brokerage'] else
                          'the 401(k) only' if sale['from_401k'] else 'the brokerage only')] += 1
        s['sale at a loss (law contrast)'] += sale['gain_signed'] < 0
        s['sale with NIIT'] += sale['niit'] > 0
        s['sale capped at the held value'] += sale['share_after'] > F(1, 10)
        for b in sale['bands']:
            s[f'sale gain touches {b}%'] += 1
        if st == 'married_separate' and sale['from_brokerage']:
            s[f'separate: sale from the {r["brokerage_owner"]} account'] += 1
        if sale['state_tax_law'] is not None:
            s['Illinois sale (law state tax)'] += 1
    yrs = {Y['year']: Y for Y in d['years']}
    s['vests in view: ' + ('none' if not yrs else 'two calendar years' if len(yrs) == 2 else f'{list(yrs)[0]} only')] += 1
    if st == 'married_separate' and yrs:
        s['separate with vests in view'] += 1
        Y = yrs.get(2026)
        if Y and Y['addl_owed'] > Y['med']:
            s['separate: 0.9% owed more than withheld (2026)'] += 1
    Y = yrs.get(2026)
    if Y:
        e = Y['earlier']
        s['2026: ' + ('no earlier vests' if e == 0 else 'earlier at or under $1,000,000' if e <= 1000000 else
                      'earlier over $1,000,000')] += 1
        if e <= 1000000 < e + Y['total']:
            s['2026: the in-view vests cross $1,000,000'] += 1
        p0 = pay + e
        s['2026: pay + earlier + vests ' + ('at or under 200,000' if p0 + Y['total'] <= 200000 else
                                            'across 200,000' if p0 < 200000 else 'from 200,000 up')] += 1
        s['2026: gap ' + ('negative (over-withheld)' if Y['gap'] < 0 else 'positive' if Y['gap'] > 0 else 'zero')] += 1
        if Y['state_law'] is not None:
            s['2026 Illinois: law share differs from the page' if abs(Y['state_law'] - Y['state_page']) >= CENT
              else '2026 Illinois: law share equals the page'] += 1
    Y = yrs.get(2027)
    if Y and Y['total'] > 1000000:
        s['2027: the in-view vests cross $1,000,000'] += 1
    s['same-day vests straddle $1,000,000 (T1)'] += any(Y['tie'] for Y in d['years'])
    s['vests in view with no employee pay (W1 flag)'] += d['flat_ok'] is False
    s['written amounts on a half cent'] += sum(half_cent(x) for x in written_amounts(d))
    s['rows with an amount on a half cent'] += any(half_cent(x) for x in written_amounts(d))


def d1_pay(r):
    inc = R.incomes(case_1(r))
    return inc['pay']


def build_house(rng, guard, edges):
    cases = list(edges)
    while len(cases) < N_HOUSE:
        cases.append(random_house(rng))
    count = Counter()
    rows, s = [], Counter()
    for i, c in enumerate(cases):
        code = STATUS_CODE[c['filing_status']]
        count[code] += 1
        cid = f'es-{code}-{count[code]:04d}'
        c['_id'] = cid
        d1, d2 = derive_1(c), derive_2(c)
        compare_house(guard, cid, d1, d2)
        kind = 'edge' if i < len(edges) else 'random'
        s[f'rows {kind}'] += 1
        house_stats(s, c, d1)
        rows.append(house_row(cid, kind, c, d1))
    return rows, s, len(edges), {c['_label']: c['_id'] for c in edges}


COVERAGE_SCHED = {
    'rows': N_SCHED, 'vest_months blank': 400, 'cliff_months blank': 300, 'every blank': 400, 'all three blank': 30,
    'cliff 0 typed': 250, 'vest_start on the 29th': 30, 'vest_start on the 30th': 30, 'vest_start on the 31st': 30,
    'vest_start on a month end': 150, 'a vest falls back to a shorter month\'s last day': 150,
    'a vest on February 29': 10, 'a vest dated today': 50, 'nothing vested': 150, 'all vested': 150,
    'part vested': 500, 'months without shares (Z1)': 50, 'one vest': 30, 'every 1 (monthly)': 150,
    'vest_start after today': 50,
}
COVERAGE_HOUSE = {
    'rows': N_HOUSE, 'status single': 900, 'status married_joint': 800, 'status married_separate': 300,
    'state none': 1800, 'state IL': 400, 'Illinois without other income': 40, 'Illinois with other income': 300,
    'typed wages single': 40, 'typed wages married_joint': 40,
    'pay 0': 60, 'pay under 100,000': 400, 'pay 100,000 to 199,999': 400, 'pay 200,000 to 499,999': 400,
    'pay 500,000 to 900,000': 100,
    'grants 0': 150, 'grants 1': 700, 'grants 2': 600, 'grants 3': 300, 'RSU grants': 2000,
    'option grants under water': 150, 'option grants, strike at or below half the price': 200,
    'option grants, strike between half the price and the price': 100,
    'holdings none': 400, 'holdings 401(k) only': 250, 'holdings brokerage only': 400, 'holdings both': 600,
    'brokerage at a loss': 150, 'brokerage at a gain': 600, 'savings balance (not invested)': 600,
    'level ok': 300, 'level medium': 300, 'level large': 300, 'share under 10%': 250,
    'sale': 900, 'sale from both': 200, 'sale from the 401(k) only': 100, 'sale from the brokerage only': 300,
    'sale at a loss (law contrast)': 60, 'sale with NIIT': 100, 'sale capped at the held value': 100,
    'sale gain touches 0%': 50, 'sale gain touches 15%': 300, 'sale gain touches 20%': 30,
    'separate: sale from the employee account': 20, 'separate: sale from the spouse account': 15,
    'separate: sale from the joint account': 15, 'Illinois sale (law state tax)': 100,
    'vests in view: two calendar years': 1000, 'vests in view: 2026 only': 50, 'vests in view: 2027 only': 150,
    'vests in view: none': 200, 'separate with vests in view': 200, 'separate: 0.9% owed more than withheld (2026)': 40,
    '2026: no earlier vests': 300, '2026: earlier at or under $1,000,000': 600, '2026: earlier over $1,000,000': 30,
    '2026: the in-view vests cross $1,000,000': 15, '2027: the in-view vests cross $1,000,000': 30,
    '2026: pay + earlier + vests at or under 200,000': 300, '2026: pay + earlier + vests across 200,000': 150,
    '2026: pay + earlier + vests from 200,000 up': 300, '2026: gap negative (over-withheld)': 200,
    '2026: gap positive': 300, '2026 Illinois: law share differs from the page': 20,
    '2026 Illinois: law share equals the page': 100, 'same-day vests straddle $1,000,000 (T1)': 1,
    'vests in view with no employee pay (W1 flag)': 40,
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
    edges = house_edges()
    if not skip_examples:
        try:
            n_ex = check_examples(edges)
        except AssertionError as e:
            raise SystemExit(f'RULES.md examples check failed in derivation 2: {e.args}; no CSV written')
        print(f'RULES.md worked examples, corner rows and source examples reproduced by derivation 2: {n_ex} assertions')
    rng = random.Random(SEED)
    g_s, g_h = Guard('schedules.csv'), Guard('households.csv')
    s_rows, s_stats, n_s_edge = build_sched(rng, g_s)
    h_rows, h_stats, n_h_edge, edge_ids = build_house(rng, g_h, edges)
    for rows, n in ((s_rows, N_SCHED), (h_rows, N_HOUSE)):
        assert len(rows) == n and len({r['case_id'] for r in rows}) == n
    n_cov = 0
    for name, s, mins in (('schedules.csv', s_stats, COVERAGE_SCHED), ('households.csv', h_stats, COVERAGE_HOUSE)):
        try:
            n_cov += check_coverage(name, s, mins)
        except SystemExit:
            for key in sorted(s):
                print(f'  {name} {key}: {s[key]}')
            raise
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    files = (('schedules.csv', SCHED_COLUMNS, s_rows, g_s, s_stats, n_s_edge),
             ('households.csv', HOUSE_COLUMNS, h_rows, g_h, h_stats, n_h_edge))
    for name, cols, rows, *_ in files:                                  # written only once both have passed
        write_csv(out_dir / name, cols, rows)
    for name, cols, rows, g, s, n_edge in files:
        print(f'wrote {name}: {len(rows)} rows ({n_edge} edge, {len(rows) - n_edge} random); both derivations agree; '
              f'largest gap before rounding ${float(g.max_gap):.3g} (rates {float(g.max_rate_gap):.3g})')
        for key in sorted(g.n):
            print(f'  check: {key}: {g.n[key]}')
        for key in sorted(s):
            print(f'  {key}: {s[key]}')
    print(f'{n_cov} coverage minimums met')
    print('edge rows of households.csv:')
    for label, cid in edge_ids.items():
        print(f'  {cid}: {label}')
    for name, *_ in files:
        print(f'  sha256 {name}: {hashlib.sha256((out_dir / name).read_bytes()).hexdigest()}')
    print(f'total {time.time() - t0:.1f} s')


if __name__ == '__main__':
    main(sys.argv[1:])
