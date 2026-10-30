"""AMT answer key: 2,000 invented returns worked with Form 6251 logic.

Run:  python3 tools/golden_career/amt_key.py
Writes tests/golden/career/amt.csv. Standard library only, Decimal money, deterministic.

Never imports or reads the app. Two derivations are written here on purpose and must agree on
every row before the CSV is written:
  1. the forms, line by line: Form 1040 lines 11b-16, the Qualified Dividends and Capital Gain
     Tax Worksheet (Form 1040 instructions), Form 6251 lines 1b-11 and Part III lines 12-40;
  2. the statute: IRC 1(h) stacking for the regular tax with the Rev. Proc. "base plus rate"
     tables, AMTI as AMT income minus AMT deductions (IRC 56(b)(1)), the exemption and
     IRC 55(b)(3) for the tentative minimum tax.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import csv
import math
import random
from collections import Counter
from decimal import Decimal as D, ROUND_HALF_UP
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rules as R  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'career' / 'amt.csv'
SEED = 20261030
ROWS_PER_CELL = 250          # 2 years x 4 statuses x 250 = 2,000 rows
MAX_WAGES = 900000
MAX_DIVIDENDS = 120000
MAX_SPREAD = 600000
ZERO = D(0)

COLUMNS = ['case_id', 'year', 'filing_status', 'wages', 'qualified_dividends', 'itemized_salt',
           'itemized_other', 'iso_spread', 'taxable_income', 'regular_tax', 'amti', 'exemption',
           'tentative_min_tax', 'amt', 'room']
MONEY = COLUMNS[3:]


class Unsettled(Exception):
    """The row needs a rule the IRS has not published yet (2026 separate-return line 4)."""


def cents(x):
    return x.quantize(D('0.01'), rounding=ROUND_HALF_UP)


# =========================== derivation 1: the forms, line by line ===========================

def bracket_tax(year, status, income):
    """Tax Computation on exact amounts (no Tax Table), bracket by bracket."""
    income = max(ZERO, income)
    tax, lower = ZERO, ZERO
    tops = list(R.BRACKET_TOPS[year][status]) + [None]
    for top, rate in zip(tops, R.RATES):
        if top is None or income <= top:
            return tax + (income - lower) * rate
        tax += (D(top) - lower) * rate
        lower = D(top)
    raise AssertionError('unreachable')


def salt_cap(year, status, agi):
    cap, start, floor = R.SALT_CAP[year]['married_separate' if status == 'married_separate' else 'other']
    return max(D(floor), D(cap) - D('0.30') * max(ZERO, agi - D(start)))


def deduction_line(row, agi):
    """Form 1040 line 12e (= line 14 here: no QBI, no Schedule 1-A deductions)."""
    year, s = row['year'], row['filing_status']
    std = D(R.STANDARD_DEDUCTION[year][s])
    if not row['itemizes']:
        return std
    salt, other = D(row['salt']), D(row['other'])
    assert salt <= salt_cap(year, s, agi), 'SALT cap would bind'
    total = salt + other
    if year >= 2026:
        excess = max(ZERO, agi - D(R.LIMIT68_START[year][s]))
        assert R.LIMIT68_FRACTION * min(total, excess) == 0, 'IRC 68 limitation would bite'
    assert total > std, 'row marked as itemizing but the standard deduction is larger'
    return total


def qdcg_worksheet(year, s, ti, qd):
    """Qualified Dividends and Capital Gain Tax Worksheet (Form 1040 instructions), lines 1-25."""
    top0, top15 = (D(x) for x in R.GAIN_TOPS[year][s])
    l1, l2, l3 = ti, qd, ZERO
    l4 = l2 + l3
    l5 = max(ZERO, l1 - l4)
    l6 = top0
    l7 = min(l1, l6)
    l8 = min(l5, l7)
    l9 = l7 - l8
    l10 = min(l1, l4)
    l11 = l9
    l12 = l10 - l11
    l13 = top15
    l14 = min(l1, l13)
    l15 = l5 + l9
    l16 = max(ZERO, l14 - l15)
    l17 = min(l12, l16)
    l18 = l17 * D('0.15')
    l19 = l9 + l17
    l20 = l10 - l19
    l21 = l20 * D('0.20')
    l22 = bracket_tax(year, s, l5)
    l23 = l18 + l21 + l22
    l24 = bracket_tax(year, s, l1)
    l25 = min(l23, l24)
    return {'line4': l4, 'line5': l5, 'line25': l25}


def regular_tax(row):
    year, s = row['year'], row['filing_status']
    wages, qd = D(row['wages']), D(row['qd'])
    agi = wages + qd                       # Form 1040 line 11b: all dividends are qualified
    line14 = deduction_line(row, agi)
    line1b = agi - line14                  # Form 6251 line 1b (may be negative)
    ti = max(ZERO, line1b)                 # Form 1040 line 15
    if qd > 0:
        w = qdcg_worksheet(year, s, ti, qd)
        tax = w['line25']                  # Form 1040 line 16
    else:
        w, tax = None, bracket_tax(year, s, ti)
    return {'agi': agi, 'line14': line14, 'line1b': line1b, 'ti': ti, 'tax': tax, 'qdcg': w}


def amt_rate(year, s, amount):
    """Form 6251 line 7 / 18 / 39: 26%, or 28% minus the printed subtraction."""
    if amount <= R.AMT_28_FROM[year][s]:
        return amount * R.AMT_RATE_LOW
    return amount * R.AMT_RATE_HIGH - D(R.AMT_28_SUBTRACT[year][s])


def part3(year, s, line6, w):
    """Form 6251 Part III, lines 12-40 (no Schedule D Tax Worksheet, no section 1250 gain)."""
    top0, top15 = (D(x) for x in R.GAIN_TOPS[year][s])
    l12 = line6
    l13 = w['line4']
    l14 = ZERO
    l15 = l13
    l16 = min(l12, l15)
    l17 = l12 - l16
    l18 = amt_rate(year, s, l17)
    l19 = top0
    l20 = w['line5']
    l21 = max(ZERO, l19 - l20)
    l22 = min(l12, l13)
    l23 = min(l21, l22)
    l24 = l22 - l23
    l25 = top15
    l26 = l21
    l27 = w['line5']
    l28 = l26 + l27
    l29 = max(ZERO, l25 - l28)
    l30 = min(l24, l29)
    l31 = l30 * D('0.15')
    l32 = l23 + l30
    if l32 == l12:
        l34 = ZERO
    else:
        l33 = l22 - l32
        l34 = l33 * D('0.20')
    assert l14 == 0
    l37 = ZERO
    l38 = l18 + l31 + l34 + l37
    l39 = amt_rate(year, s, l12)
    return min(l38, l39)


def form6251(row, spread, reg):
    year, s = row['year'], row['filing_status']
    line1b = reg['line1b']
    line2a = D(row['salt']) if row['itemizes'] else reg['line14']  # Schedule A line 7, or the standard deduction
    line2i = D(spread)
    line4 = line1b + line2a + line2i
    if s == 'married_separate':
        rate, start, cap = R.AMT_MFS_EXTRA[year]
        if line4 > start:                  # I6251 "Line 4"
            if rate is None:
                raise Unsettled(f'{year} separate return with AMTI {line4} over {start}')
            line4 += min(rate * (line4 - D(start)), D(cap))
    ex = D(R.AMT_EXEMPTION[year][s])
    start = D(R.AMT_PHASEOUT_START[year][s])
    line5 = max(ZERO, ex - R.AMT_PHASEOUT_RATE[year] * max(ZERO, line4 - start))  # Exemption Worksheet
    line6 = max(ZERO, line4 - line5)
    if line6 == 0:
        line7 = ZERO
    elif reg['qdcg'] is not None:
        line7 = part3(year, s, line6, reg['qdcg'])
    else:
        line7 = amt_rate(year, s, line6)
    line9 = line7                          # no AMT foreign tax credit (line 8)
    line10 = reg['tax']
    line11 = max(ZERO, line9 - line10)
    return {'amti': line4, 'exemption': line5, 'line6': line6, 'tmt': line9, 'amt': line11}


# ================== derivation 2: the statute, written separately as a check ==================

def table_tax(year, s, income):
    """Rev. Proc. tables: base amount plus rate times the excess over the bracket floor."""
    floors = [0] + list(R.BRACKET_TOPS[year][s])
    income = max(ZERO, income)
    i = max(k for k in range(7) if income > floors[k] or k == 0)
    return D(R.BRACKET_BASES[year][s][i]) + R.RATES[i] * (income - D(floors[i]))


def regular_alt(row):
    year, s = row['year'], row['filing_status']
    wages, qd = D(row['wages']), D(row['qd'])
    std = D(R.STANDARD_DEDUCTION[year][s])
    itemized = D(row['salt']) + D(row['other']) if row['itemizes'] else ZERO
    ti = max(ZERO, wages + qd - max(std, itemized))
    top0, top15 = (D(x) for x in R.GAIN_TOPS[year][s])
    gain = min(qd, ti)                     # IRC 1(h)(11): qualified dividends are net capital gain
    ordinary = ti - gain
    at0 = min(gain, max(ZERO, top0 - ordinary))
    at15 = min(gain - at0, max(ZERO, top15 - ordinary - at0))
    at20 = gain - at0 - at15
    tax = min(table_tax(year, s, ti), table_tax(year, s, ordinary) + D('0.15') * at15 + D('0.20') * at20)
    return ti, tax, ordinary


def amt_rate_alt(year, s, amount):
    brk = D(R.AMT_28_FROM[year][s])
    return D('0.26') * min(amount, brk) + D('0.28') * max(ZERO, amount - brk)


def amt_alt(row, spread):
    year, s = row['year'], row['filing_status']
    wages, qd = D(row['wages']), D(row['qd'])
    ti, tax, ordinary_regular = regular_alt(row)
    # IRC 56(b)(1): no standard deduction, no state and local taxes, no IRC 68; other itemized
    # deductions (home mortgage interest) stay; IRC 56(b)(3): the ISO spread is AMT income.
    amt_deductions = D(row['other']) if row['itemizes'] else ZERO
    amti = wages + qd + D(spread) - amt_deductions
    ex = D(R.AMT_EXEMPTION[year][s])
    start = D(R.AMT_PHASEOUT_START[year][s])
    rate = R.AMT_PHASEOUT_RATE[year]
    if s == 'married_separate':
        zero_point = start + ex / rate     # the minimum AMTI at which the exemption is zero
        extra_rate = R.AMT_MFS_EXTRA[year][0]
        if amti > zero_point:
            if extra_rate is None:
                raise Unsettled('alt')
            amti += min(extra_rate * (amti - zero_point), ex)
    exemption = max(ZERO, ex - rate * max(ZERO, amti - start))
    excess = max(ZERO, amti - exemption)   # taxable excess, IRC 55(b)(1)(A)(ii)
    if excess == 0:
        tmt = ZERO
    else:
        top0, top15 = (D(x) for x in R.GAIN_TOPS[year][s])
        gain = min(qd, excess)
        excess_b = max(ZERO, top0 - ordinary_regular)              # IRC 1(h)(1)(B)(ii) excess
        at0 = min(gain, excess_b)                                  # IRC 55(b)(3)(B)
        at0_regular = min(min(qd, ti), excess_b)
        excess_c = max(ZERO, top15 - (ordinary_regular + at0_regular))  # IRC 1(h)(1)(C)(ii) excess
        at15 = min(gain - at0, excess_c)                           # IRC 55(b)(3)(C)
        at20 = gain - at0 - at15                                   # IRC 55(b)(3)(D)
        capped = amt_rate_alt(year, s, excess - gain) + D('0.15') * at15 + D('0.20') * at20
        tmt = min(amt_rate_alt(year, s, excess), capped)          # "shall not exceed"
    return {'ti': ti, 'tax': tax, 'amti': amti, 'exemption': exemption, 'tmt': tmt,
            'amt': max(ZERO, tmt - tax)}


# ===================================== the AMT room ==========================================

def mfs_2026_limit(row, reg):
    """Largest spread that keeps a 2026 separate return at or under 640,200 of AMTI."""
    if not (row['year'] == 2026 and row['filing_status'] == 'married_separate'):
        return None
    base = reg['line1b'] + (D(row['salt']) if row['itemizes'] else reg['line14'])
    limit = D(R.AMT_MFS_EXTRA[2026][1]) - base
    if limit < 0:
        raise Unsettled('AMTI over 640,200 before any spread')
    return int(limit)


def room(row, reg):
    """Largest whole-dollar spread whose AMT equals the AMT with no spread (bisection)."""
    amt0 = form6251(row, 0, reg)['amt']

    def same(spread):
        return form6251(row, spread, reg)['amt'] == amt0

    limit = mfs_2026_limit(row, reg)
    lo = 0
    if limit is not None:
        if same(limit):
            raise Unsettled('room would pass 640,200 of AMTI')
        hi = limit
    else:
        hi = 1
        while same(hi):
            lo, hi = hi, hi * 2
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if same(mid):
            lo = mid
        else:
            hi = mid
    return lo


# ===================================== the generator =========================================

def log_uniform(rng, low, high):
    return int(round(math.exp(rng.uniform(math.log(low), math.log(high)))))


def draw_inputs(rng, year, s):
    r = rng.random()
    if r < 0.04:
        wages = 0
    elif r < 0.07:
        wages = MAX_WAGES
    elif r < 0.50:
        wages = rng.randint(0, MAX_WAGES)
    else:
        wages = log_uniform(rng, 5000, MAX_WAGES)
    if rng.random() < 0.5:
        qd = 0
    elif rng.random() < 0.08:
        qd = MAX_DIVIDENDS
    else:
        qd = log_uniform(rng, 50, MAX_DIVIDENDS)
    agi = wages + qd
    std = R.STANDARD_DEDUCTION[year][s]
    itemizes = rng.random() < 0.4
    if year >= 2026 and agi > R.LIMIT68_START[year][s]:
        itemizes = False                   # keep IRC 68 out of the key (see rules.py)
    salt = other = 0
    if itemizes:
        floor = 5000 if s == 'married_separate' else 10000
        salt = floor if rng.random() < 0.3 else rng.randint(0, floor)
        need = std - salt + 1              # itemized total must beat the standard deduction
        other = need if rng.random() < 0.1 else rng.randint(need, need + 40000)
    return {'year': year, 'filing_status': s, 'wages': wages, 'qd': qd, 'itemizes': itemizes,
            'salt': salt, 'other': other}


def pick_spread(rng, row, reg, room_value):
    """Spread kinds: none, at the room, one dollar past it, at the phase-out start and end, random."""
    r = rng.random()
    base = reg['line1b'] + (D(row['salt']) if row['itemizes'] else reg['line14'])
    year, s = row['year'], row['filing_status']
    targets = []
    if r < 0.15:
        return 0, 'none'
    if r < 0.25:
        targets = [(room_value, 'at room')]
    elif r < 0.35:
        targets = [(room_value + 1, 'room + 1')]
    elif r < 0.40:
        targets = [(int(D(R.AMT_PHASEOUT_START[year][s]) - base), 'AMTI at phase-out start')]
    elif r < 0.45:
        targets = [(int(D(R.AMT_PHASEOUT_END[year][s]) - base), 'AMTI at complete phase-out')]
    for value, kind in targets:
        if 0 <= value <= MAX_SPREAD:
            return value, kind
    if rng.random() < 0.5:
        return rng.randint(1, MAX_SPREAD), 'random'
    return log_uniform(rng, 1000, MAX_SPREAD), 'random'


def build_row(rng, year, s):
    """Draw until the row stays inside settled rules (only 2026 separate returns ever redraw)."""
    for _ in range(1000):
        row = draw_inputs(rng, year, s)
        reg = regular_tax(row)
        try:
            room_value = room(row, reg)
            spread, kind = pick_spread(rng, row, reg, room_value)
            limit = mfs_2026_limit(row, reg)
            if limit is not None and spread > limit:
                raise Unsettled('spread pushes AMTI over 640,200')
            f = form6251(row, spread, reg)
        except Unsettled:
            continue
        row.update(spread=spread, kind=kind)
        return row, reg, f, room_value
    raise RuntimeError('could not draw a settled row')


def second_check(row, reg, f, room_value):
    alt = amt_alt(row, row['spread'])
    pairs = [('taxable_income', reg['ti'], alt['ti']), ('regular_tax', reg['tax'], alt['tax']),
             ('amti', f['amti'], alt['amti']), ('exemption', f['exemption'], alt['exemption']),
             ('tentative_min_tax', f['tmt'], alt['tmt']), ('amt', f['amt'], alt['amt'])]
    for name, a, b in pairs:
        if a != b:
            raise AssertionError(f'{row["case_id"]} {name}: forms {a} vs statute {b}')
    amt0 = amt_alt(row, 0)['amt']
    assert amt_alt(row, room_value)['amt'] == amt0, row['case_id']
    assert amt_alt(row, room_value + 1)['amt'] > amt0, row['case_id']


def main():
    rng = random.Random(SEED)
    rows, stats = [], Counter()
    for year in R.YEARS:
        for s in R.STATUSES:
            for i in range(ROWS_PER_CELL):
                row, reg, f, room_value = build_row(rng, year, s)
                row['case_id'] = f'amt-{year}-{s}-{i + 1:03}'
                second_check(row, reg, f, room_value)
                stats['rows'] += 1
                stats[f'spread {row["kind"]}'] += 1
                stats['amt > 0'] += f['amt'] > 0
                stats['itemizes'] += row['itemizes']
                stats['qualified dividends > 0 (Part III)'] += row['qd'] > 0
                stats['exemption partly phased out'] += 0 < f['exemption'] < R.AMT_EXEMPTION[year][s]
                stats['exemption fully phased out'] += f['exemption'] == 0
                stats['line 6 over the 28% breakpoint'] += f['line6'] > R.AMT_28_FROM[year][s]
                stats['2025 separate-return line 4 addition'] += (
                    s == 'married_separate' and year == 2025 and f['amti'] > reg['line1b'] + D(row['spread'])
                    + (D(row['salt']) if row['itemizes'] else reg['line14']))
                stats['negative Form 6251 line 1b'] += reg['line1b'] < 0
                rows.append({
                    'case_id': row['case_id'], 'year': year, 'filing_status': s,
                    'wages': D(row['wages']), 'qualified_dividends': D(row['qd']),
                    'itemized_salt': D(row['salt']), 'itemized_other': D(row['other']),
                    'iso_spread': D(row['spread']), 'taxable_income': reg['ti'],
                    'regular_tax': reg['tax'], 'amti': f['amti'], 'exemption': f['exemption'],
                    'tentative_min_tax': f['tmt'], 'amt': f['amt'], 'room': D(room_value),
                })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        w.writeheader()
        for r in rows:
            w.writerow({k: (f'{cents(v):.2f}' if k in MONEY else v) for k, v in r.items()})
    print(f'wrote {OUT.relative_to(ROOT)}: {len(rows)} rows; both derivations agree on every row')
    for k in sorted(stats):
        print(f'  {k}: {stats[k]}')


if __name__ == '__main__':
    main()
