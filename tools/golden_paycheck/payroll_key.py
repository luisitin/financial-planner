"""Payroll-tax answer key: 1,500 invented 2026 years of one job paying the same every paycheck.

Run:  python3 tools/golden_paycheck/payroll_key.py
Writes tests/golden/paycheck/payroll.csv. Standard library only, Decimal money, deterministic.

Rules (sources in tools/golden_paycheck/README.md; figures in rules.py):
  * Social Security (employee share): 6.2% of the year's wages up to the 184,500 wage base
    (Pub. 15 (2026) p.29). ss_year = 6.2% x min(wages x paychecks, 184,500).
  * Medicare (employee share, what the employer withholds): 1.45% of all wages, plus the 0.9%
    Additional Medicare Tax on the wages paid above 200,000 in the calendar year, whatever the
    filing status (Pub. 15 pp.29-30; IRS Additional Medicare Tax Q&A).
  * ss_last_paycheck: the first paycheck k at which the year's wages so far (k x wages) reach or
    pass the wage base; that paycheck is the last one with any Social Security taken (it takes
    only what is left under the base). Blank if the year's wages stay below the base. A year whose
    wages end exactly on the base gives the last paycheck's number (it reaches the base there).
  * extra_medicare_first_paycheck: the first paycheck k at which the year's wages so far exceed
    200,000 ("the pay period in which you pay wages in excess of $200,000"). Landing exactly on
    200,000 does not count; the next paycheck does. Blank if the year never passes 200,000.
  * The two year totals are figured on the year's wages and rounded half up to the cent once.

Second way, checked on every row before the CSV is written: a paycheck-by-paycheck payroll run in
exact Fractions (year-to-date wages, what is left under the base, the excess over 200,000 this
paycheck); its sums and the paychecks where the taxes change must match exactly.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import csv
import math
import random
from collections import Counter
from decimal import Decimal as D, ROUND_CEILING, ROUND_HALF_UP
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rules as R  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'paycheck' / 'payroll.csv'
SEED = 20261111
ROWS = 1500
PERIODS = (52, 26, 24, 12)
LO, HI = D('500'), D('60000')   # wages per paycheck
ZERO = D(0)
CENT = D('0.01')
COLUMNS = ['case_id', 'year', 'paychecks', 'wages', 'ss_year', 'medicare_year',
           'ss_last_paycheck', 'extra_medicare_first_paycheck']


def cents(x):
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


# ============================= derivation 1: the year's formulas ===============================

def ceil_div(a, b):
    """Smallest whole k with k x b >= a, for Decimals a >= 0, b > 0."""
    q = (a / b).to_integral_value(rounding=ROUND_CEILING)
    while (q - 1) * b >= a:     # guard against any division rounding
        q -= 1
    while q * b < a:
        q += 1
    return int(q)


def year_formulas(n, wages):
    year = wages * n
    ss = R.SS_RATE * min(year, R.SS_WAGE_BASE)
    medicare = R.MEDICARE_RATE * year + R.ADDL_MEDICARE_RATE * max(ZERO, year - R.ADDL_MEDICARE_THRESHOLD)
    # the first k with k x wages >= base
    ss_last = ceil_div(R.SS_WAGE_BASE, wages) if year >= R.SS_WAGE_BASE else None
    # the first k with k x wages > 200,000 = (the largest k with k x wages <= 200,000) + 1
    extra_first = int((R.ADDL_MEDICARE_THRESHOLD // wages)) + 1 if year > R.ADDL_MEDICARE_THRESHOLD else None
    return {'ss': ss, 'medicare': medicare, 'ss_last': ss_last, 'extra_first': extra_first}


# ================== derivation 2: run the payroll one paycheck at a time (exact) =================

def half_up(x):
    """A non-negative Fraction rounded half up to the cent, as a Decimal (information only)."""
    q = x * 100
    return D((2 * q.numerator + q.denominator) // (2 * q.denominator)) / 100


def payroll_run(n, wages):
    w, base, limit = F(str(wages)), F(str(R.SS_WAGE_BASE)), F(str(R.ADDL_MEDICARE_THRESHOLD))
    ss_rate, med_rate, add_rate = (F(str(x)) for x in (R.SS_RATE, R.MEDICARE_RATE, R.ADDL_MEDICARE_RATE))
    ytd = F(0)
    ss_total = med_total = F(0)
    ss_rounded = med_rounded = D(0)
    ss_paychecks, extra_paychecks = [], []
    for k in range(1, n + 1):
        before, ytd = ytd, ytd + w
        ss_wages = max(F(0), min(w, base - before))           # what is left under the base
        extra_wages = max(F(0), ytd - max(before, limit))      # this paycheck's part above 200,000
        ss_total += ss_rate * ss_wages
        med_total += med_rate * w + add_rate * extra_wages
        ss_rounded += half_up(ss_rate * ss_wages)
        med_rounded += half_up(med_rate * w) + half_up(add_rate * extra_wages)
        if ss_wages > 0:
            ss_paychecks.append(k)
        if extra_wages > 0:
            extra_paychecks.append(k)
    reached_base = ytd >= base
    return {'ss': ss_total, 'medicare': med_total,
            'ss_last': ss_paychecks[-1] if reached_base else None,
            'extra_first': extra_paychecks[0] if extra_paychecks else None,
            'ss_rounded': ss_rounded, 'medicare_rounded': med_rounded}


# ========================================= the generator ========================================

def divisors_landing(amount, n):
    """Paycheck numbers k (1..n) at which k equal paychecks of whole cents add up to `amount`
    exactly, keeping the paycheck between 500 and 60,000 (so k is 4 or more)."""
    total_cents = int(amount * 100)
    return [k for k in range(1, n + 1)
            if total_cents % k == 0 and LO <= amount / k <= HI]


def edge_rows():
    rows = []
    for target, label in ((R.SS_WAGE_BASE, 'base'), (R.ADDL_MEDICARE_THRESHOLD, '200k')):
        for n in PERIODS:
            for k in divisors_landing(target, n):
                exact = target / k
                for delta, tag in ((-CENT, 'below'), (ZERO, 'on'), (CENT, 'above')):
                    rows.append({'paychecks': n, 'wages': exact + delta,
                                 'kind': f'{label} {tag}', 'k': k})
    return rows


def random_row(rng):
    n = rng.choice(PERIODS)
    x = math.exp(rng.uniform(math.log(float(LO)), math.log(float(HI))))
    wages = D(repr(x)).quantize(CENT, rounding=ROUND_HALF_UP)
    return {'paychecks': n, 'wages': wages, 'kind': 'random', 'k': None}


def main():
    rng = random.Random(SEED)
    cases = edge_rows()
    n_edge = len(cases)
    while len(cases) < ROWS:
        cases.append(random_row(rng))
    stats = Counter()
    gaps = {'ss': ZERO, 'medicare': ZERO}
    out = []
    for i, c in enumerate(cases):
        n, wages = c['paychecks'], c['wages']
        case_id = f'pay-edge-{i + 1:03}' if i < n_edge else f'pay-{i + 1 - n_edge:04}'
        a, b = year_formulas(n, wages), payroll_run(n, wages)
        if (F(str(a['ss'])), F(str(a['medicare'])), a['ss_last'], a['extra_first']) != \
                (b['ss'], b['medicare'], b['ss_last'], b['extra_first']):
            raise AssertionError(f'{case_id}: formulas {a} vs payroll run {b}')
        # the edge rows land where they were built to land
        if c['kind'] == 'base on':
            assert a['ss_last'] == c['k'], case_id
        if c['kind'] == '200k on':
            assert a['extra_first'] == (c['k'] + 1 if c['k'] < n else None), case_id
        year = wages * n
        stats['rows'] += 1
        stats[f'kind {c["kind"]}'] += 1
        stats[f'paychecks {n}'] += 1
        stats['reaches the wage base'] += a['ss_last'] is not None
        stats['wage base reached on the last paycheck'] += a['ss_last'] == n
        stats['year ends exactly on the wage base'] += year == R.SS_WAGE_BASE
        stats['passes 200,000'] += a['extra_first'] is not None
        stats['passes 200,000 on the last paycheck'] += a['extra_first'] == n
        stats['year ends exactly on 200,000'] += year == R.ADDL_MEDICARE_THRESHOLD
        stats['below the wage base all year'] += a['ss_last'] is None
        stats['ss_year needed rounding'] += cents(a['ss']) != a['ss']
        stats['medicare_year needed rounding'] += cents(a['medicare']) != a['medicare']
        # what a payroll that rounds each paycheck's taxes to the cent would add up to (not the key)
        ss_gap = abs(b['ss_rounded'] - cents(a['ss']))
        med_gap = abs(b['medicare_rounded'] - cents(a['medicare']))
        stats['per-paycheck rounding would change ss_year'] += ss_gap != 0
        stats['per-paycheck rounding would change medicare_year'] += med_gap != 0
        gaps['ss'] = max(gaps['ss'], ss_gap)
        gaps['medicare'] = max(gaps['medicare'], med_gap)
        out.append({
            'case_id': case_id, 'year': R.YEAR, 'paychecks': n, 'wages': f'{wages:.2f}',
            'ss_year': f'{cents(a["ss"]):.2f}', 'medicare_year': f'{cents(a["medicare"]):.2f}',
            'ss_last_paycheck': '' if a['ss_last'] is None else a['ss_last'],
            'extra_medicare_first_paycheck': '' if a['extra_first'] is None else a['extra_first'],
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        w.writeheader()
        w.writerows(out)
    print(f'wrote {OUT.relative_to(ROOT)}: {len(out)} rows ({n_edge} edge rows); '
          'the paycheck-by-paycheck run agrees on every row')
    for k in sorted(stats):
        print(f'  {k}: {stats[k]}')
    print(f'  largest per-paycheck rounding gap: Social Security {gaps["ss"]}, Medicare {gaps["medicare"]}')


if __name__ == '__main__':
    main()
