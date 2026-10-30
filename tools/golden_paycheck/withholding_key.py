"""Withholding answer key: 3,000 invented 2026 paychecks worked through Pub. 15-T Worksheet 1A.

Run:  python3 tools/golden_paycheck/withholding_key.py
Writes tests/golden/paycheck/withholding.csv. Standard library only, Decimal money, deterministic.

Method (sources and the rounding choice in tools/golden_paycheck/README.md):
  Worksheet 1A (Pub. 15-T 2026 p.10), for a Form W-4 from 2020 or later, line by line:
    1a wages this paycheck; 1b pay periods a year; 1c = 1a x 1b; 1d Step 4(a); 1e = 1c + 1d;
    1f Step 4(b); 1g = 12,900 (married filing jointly) or 8,600 (otherwise), 0 if the Step 2 box
    is checked; 1h = 1f + 1g; 1i = 1e - 1h, not below 0 (the Adjusted Annual Wage Amount).
    2a-2g: the row of the annual STANDARD (box not checked) or Step 2 Checkbox (box checked) table
    with A <= 1i < B; 2g = C + D x (1i - A); 2h = 2g / 1b.
    3a Step 3; 3b = 3a / 1b; 3c = 2h - 3b, not below 0. 4a Step 4(c); 4b = 3c + 4a.
  Nothing is rounded until a value is written to the CSV; each written column is rounded half up
  to the cent on its own (tentative_annual = line 2g, withholding = line 4b from the unrounded 2g).

Checks, all on every row before anything is written:
  2. an exact second implementation (Fractions, tables rebuilt from Rev. Proc. 2025-32 and line 1g,
     a bisect lookup, the steps rearranged) must give the same 1i, 2g and 4b exactly;
  3. the law without the table's rounding (tax on wages minus the standard deduction, halved
     brackets for the checkbox) must match 2g exactly, except on the single checkbox table at or
     above 108,937.50, where Pub. 15-T printed rounded figures (differences up to $0.175 a year);
  4. for weekly, biweekly, semimonthly, monthly and daily pay, Worksheet 4 with the per-period
     tables (Pub. 15-T pp.57-62) must land within the bound its whole-dollar rounding allows.
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import bisect
import csv
import math
import random
from collections import Counter, defaultdict
from decimal import Decimal as D, ROUND_FLOOR, ROUND_HALF_EVEN, ROUND_HALF_UP, localcontext
from fractions import Fraction as F
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rules as R  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'paycheck' / 'withholding.csv'
SEED = 20261110
RANDOM_ROWS = 2712          # + 288 edge rows = 3,000
MAX_WAGES = D('40000')      # per paycheck
ZERO = D(0)
CENT = D('0.01')
COLUMNS = ['case_id', 'year', 'paychecks', 'wages', 'w4_status', 'step2', 'step3_credits',
           'step4a_other', 'step4b_deductions', 'step4c_extra', 'adjusted_annual',
           'tentative_annual', 'withholding']
PERIOD_WEIGHTS = ((52, 22), (26, 22), (24, 18), (12, 18), (260, 8), (4, 4), (2, 4), (1, 4))
assert {p for p, _ in PERIOD_WEIGHTS} == set(R.PAY_PERIODS)


def fr(x):
    return F(str(x))


def half_up_cents(x):
    """A non-negative Fraction rounded half up to whole cents, as a Decimal."""
    q = x * 100
    cents = (2 * q.numerator + q.denominator) // (2 * q.denominator)
    return D(cents) / 100


# =========================== derivation 1: Worksheet 1A, line by line ===========================

def worksheet_1a(c):
    """Pub. 15-T (2026) Worksheet 1A for a 2020-or-later Form W-4. Returns every line."""
    L = {}
    with localcontext() as ctx:
        ctx.prec = 60           # lines 2h, 3b are divisions; 60 digits, then snapped below
        ctx.rounding = ROUND_HALF_EVEN
        L['1a'] = c['wages']
        L['1b'] = D(c['paychecks'])
        L['1c'] = L['1a'] * L['1b']
        L['1d'] = c['step4a']
        L['1e'] = L['1c'] + L['1d']
        L['1f'] = c['step4b']
        L['1g'] = ZERO if c['step2'] else R.LINE_1G[c['status']]
        L['1h'] = L['1f'] + L['1g']
        L['1i'] = max(ZERO, L['1e'] - L['1h'])
        schedule = 'checkbox' if c['step2'] else 'standard'
        for k, (a, b, cc, d) in enumerate(R.table(schedule, c['status'])):
            if L['1i'] >= a and (b is None or L['1i'] < b):
                break
        else:
            raise AssertionError('no row')
        L['row'] = k
        L['2a'] = L['1i']
        L['2b'], L['2c'], L['2d'] = a, cc, d
        L['2e'] = L['2a'] - L['2b']
        L['2f'] = L['2e'] * L['2d']
        L['2g'] = L['2c'] + L['2f']
        L['2h'] = L['2g'] / L['1b']
        L['3a'] = c['step3']
        L['3b'] = L['3a'] / L['1b']
        L['3c'] = max(ZERO, L['2h'] - L['3b'])
        L['4a'] = c['step4c']
        L['4b'] = L['3c'] + L['4a']
    # 2g and 3a have at most 4 decimals and 4a at most 2, so the exact 4b is a multiple of
    # 1 / (10,000 x pay periods). Snap the 60-digit result to that grid (the error is < 1e-40, the
    # grid step >= 1/2,600,000) so a value sitting exactly on a half cent rounds half up exactly.
    grid = 10000 * c['paychecks']
    scaled = L['4b'] * grid
    k = scaled.to_integral_value(rounding=ROUND_HALF_EVEN)
    assert abs(scaled - k) < D('1e-30'), 'line 4b is not on its exact grid'
    L['4b_exact'] = F(int(k), grid)
    return L


# ======= derivation 2: exact Fractions, tables rebuilt from the law, steps rearranged ===========

STATUTE = R.statute_tables()


def exact_route(c):
    n = c['paychecks']
    shift = 0 if c['step2'] else fr(R.LINE_1G[c['status']])
    x = max(F(0), fr(c['wages']) * n + fr(c['step4a']) - fr(c['step4b']) - shift)
    rows = STATUTE['checkbox' if c['step2'] else 'standard'][c['status']]
    k = bisect.bisect_right([r[0] for r in rows], x) - 1
    a, _, base, pct = rows[k]
    tentative = base + pct * (x - a)
    per_check = max(F(0), (tentative - fr(c['step3'])) / n) + fr(c['step4c'])
    return x, tentative, per_check, k


# ============== derivation 3: the law itself (no table, no rounding of the table) ===============

def tax_by_bands(status, taxable):
    """Rev. Proc. 2025-32 s.4.01 schedule as a sum of rate bands (bases not used)."""
    tops = [fr(t) for t in R.BRACKET_TOPS[status]] + [None]
    tax, lower = F(0), F(0)
    for rate, top in zip(R.RATES, tops):
        upper = taxable if top is None else min(taxable, top)
        if upper > lower:
            tax += F(rate) / 100 * (upper - lower)
        if top is None or taxable <= top:
            break
        lower = top
    return tax


def law_route(c):
    """Tentative annual withholding = the year's tax on (annualized wages + 4(a) - 4(b) - the
    standard deduction); with the Step 2 box checked, half the tax on twice (... - half the
    standard deduction), i.e. each job taxed on half the brackets and half the deduction."""
    n = c['paychecks']
    std = F(R.STANDARD_DEDUCTION[c['status']])
    income = fr(c['wages']) * n + fr(c['step4a']) - fr(c['step4b'])
    if c['step2']:
        return tax_by_bands(c['status'], 2 * max(F(0), income - std / 2)) / 2
    return tax_by_bands(c['status'], max(F(0), income - std))


# ==================== derivation 4: Worksheet 4 with the per-period tables ======================

def worksheet_4(c):
    n = c['paychecks']
    u = max(F(0), fr(c['wages']) + fr(c['step4a']) / n - fr(c['step4b']) / n)   # line 1h
    schedule = 'checkbox' if c['step2'] else 'standard'
    for a, b, base, pct in R.period_table(n, schedule, c['status']):
        if u >= fr(a) and (b is None or u < fr(b)):
            break
    tentative = fr(base) + fr(pct) * (u - fr(a))                               # line 2f
    return max(F(0), tentative - fr(c['step3']) / n) + fr(c['step4c'])        # line 4b


def worksheet_4_bound(n, schedule, status):
    """Largest possible |Worksheet 4 - Worksheet 1A| per paycheck: each per-period row start is
    the annual start (+ line 1g) / n rounded, so the two tentative amounts can drift by the sum of
    (rate step x start shift), plus the annual table's own jumps / n, plus half a cent for the
    per-period amounts printed to the cent."""
    annual, per = R.table(schedule, status), R.period_table(n, schedule, status)
    shift = fr(R.LINE_1G[status]) if schedule == 'standard' else F(0)
    bound = F(1, 200)
    for k in range(1, 8):
        step = fr(annual[k][3]) - fr(annual[k - 1][3])
        bound += step * abs(fr(per[k][0]) - (fr(annual[k][0]) + shift) / n)
    for sch, st, _, gap in R.TABLE_JUMPS:
        if (sch, st) == (schedule, status):
            bound += abs(fr(gap)) / n
    return bound


# ======================================== the generator =========================================

def log_uniform(rng, lo, hi):
    return math.exp(rng.uniform(math.log(lo), math.log(hi)))


def money(x, unit=CENT):
    return D(repr(x)).quantize(unit, rounding=ROUND_HALF_UP)


def pick_periods(rng):
    return rng.choices([p for p, _ in PERIOD_WEIGHTS], [w for _, w in PERIOD_WEIGHTS])[0]


def draw_w4(rng):
    """Form W-4 entries: Step 3 and Step 4(a), 4(b) are annual; Step 4(c) is per paycheck."""
    step3 = ZERO if rng.random() < 0.55 else D(500 * rng.randint(1, 16))
    step4a = ZERO if rng.random() < 0.70 else money(log_uniform(rng, 100, 150000), D(1))
    step4b = ZERO if rng.random() < 0.70 else money(log_uniform(rng, 500, 50000), D(1))
    r = rng.random()
    if r < 0.75:
        step4c = ZERO
    elif r < 0.88:
        step4c = D(rng.randint(1, 300))
    else:
        step4c = D(rng.randint(1, 30000)) / 100
    return step3, step4a, step4b, step4c


def random_case(rng):
    status = rng.choice(R.STATUSES)
    step2 = 1 if rng.random() < 0.35 else 0
    n = pick_periods(rng)
    r = rng.random()
    if r < 0.015:
        wages = ZERO
    elif r < 0.05:                                   # tiny paychecks, any frequency
        wages = D(rng.randint(1, 5000)) / 100
    else:                                            # log-uniform, at least 6,000 a year
        wages = money(log_uniform(rng, min(6000 / n, 5000), float(MAX_WAGES)))
    step3, step4a, step4b, step4c = draw_w4(rng)
    return {'status': status, 'step2': step2, 'paychecks': n, 'wages': wages, 'step3': step3,
            'step4a': step4a, 'step4b': step4b, 'step4c': step4c, 'kind': 'random'}


def edge_case(rng, status, step2, target, plain):
    """A paycheck whose line 1e - line 1h is exactly `target` (a table row start, or one cent
    either side). Wages are whole cents, so any remainder goes into Step 4(a) as cents."""
    g = ZERO if step2 else R.LINE_1G[status]
    if plain:
        step3 = step4a0 = step4c = ZERO
        step4b = D(1000) if target + g < 0 else ZERO
    else:
        step3, step4a0, step4b, step4c = draw_w4(rng)
        if target + g < 0 and step4b == 0:
            step4b = D(1000)
    total = target + g + step4b - step4a0          # = wages x n + Step 4(a) remainder
    if total < 0:
        step4a0 = ZERO
        total = target + g + step4b
    fits = [n for n, _ in PERIOD_WEIGHTS if total / n <= MAX_WAGES]
    exact = [n for n in fits if (total * 100) % n == 0]
    n = rng.choice(exact if plain and exact else fits)
    wages = (total / n).quantize(CENT, rounding=ROUND_FLOOR)
    step4a = step4a0 + (total - wages * n)
    case = {'status': status, 'step2': step2, 'paychecks': n, 'wages': wages, 'step3': step3,
            'step4a': step4a, 'step4b': step4b, 'step4c': step4c, 'kind': 'edge'}
    assert wages * n + step4a - step4b - g == target and wages >= 0 and step4a >= 0
    return case


def edge_cases(rng):
    out = []
    for status in R.STATUSES:
        for step2 in (0, 1):
            for a, _, _, _ in R.table('checkbox' if step2 else 'standard', status):
                for offset in (D('-0.01'), ZERO, D('0.01')):
                    for plain in (True, False):
                        out.append(edge_case(rng, status, step2, a + offset, plain))
    return out


def fmt(x):
    return f'{x:.2f}'


def main():
    rng = random.Random(SEED)
    cases = edge_cases(rng)
    n_edge = len(cases)
    cases += [random_case(rng) for _ in range(RANDOM_ROWS)]
    stats, cover = Counter(), Counter()
    law_gap, ws4_gap = F(0), defaultdict(lambda: F(0))
    out = []
    for i, c in enumerate(cases):
        c['case_id'] = f'wh-edge-{i + 1:03}' if i < n_edge else f'wh-{i + 1 - n_edge:04}'
        L = worksheet_1a(c)
        # check 2: exact second implementation
        x, tentative, per_check, k = exact_route(c)
        if (x, tentative, per_check, k) != (fr(L['1i']), fr(L['2g']), L['4b_exact'], L['row']):
            raise AssertionError(f'{c["case_id"]}: worksheet {L["1i"]} {L["2g"]} {L["4b_exact"]} '
                                 f'vs exact route {x} {tentative} {per_check}')
        # check 3: the law without the printed table's rounding
        gap = law_route(c) - tentative
        rounded_zone = c['step2'] and c['status'] == 'single' and x >= F(217875, 2)  # 108,937.50
        if gap and not rounded_zone or abs(gap) > F(175, 1000):
            raise AssertionError(f'{c["case_id"]}: law route differs from the table by {gap}')
        stats['law route differs (single checkbox at or above 108,937.50)'] += gap != 0
        law_gap = max(law_gap, abs(gap))
        # check 4: Worksheet 4 and the per-period tables
        if c['paychecks'] in R.PERIOD:
            schedule = 'checkbox' if c['step2'] else 'standard'
            diff = abs(worksheet_4(c) - per_check)
            if diff > worksheet_4_bound(c['paychecks'], schedule, c['status']):
                raise AssertionError(f'{c["case_id"]}: Worksheet 4 differs by {diff}')
            ws4_gap[c['paychecks']] = max(ws4_gap[c['paychecks']], diff)
            stats['checked against Worksheet 4'] += 1
        withholding = half_up_cents(per_check)
        tentative_col = L['2g'].quantize(CENT, rounding=ROUND_HALF_UP)
        assert L['1i'] == L['1i'].quantize(CENT), 'line 1i is whole cents by construction'
        # coverage
        stats['rows'] += 1
        stats[f'kind {c["kind"]}'] += 1
        stats[f'paychecks {c["paychecks"]:>3}'] += 1
        stats[f'status {c["status"]}, step2 {c["step2"]}'] += 1
        cover[('checkbox' if c['step2'] else 'standard', c['status'], L['row'])] += 1
        raw = L['1e'] - L['1h']
        stats['line 1i floored at 0 (1e - 1h < 0)'] += raw < 0
        stats['line 1i exactly 0'] += L['1i'] == 0
        stats['wages 0'] += c['wages'] == 0
        stats['step3 credits > 0'] += c['step3'] > 0
        stats['step4a > 0'] += c['step4a'] > 0
        stats['step4a with cents (edge remainder)'] += c['step4a'] != c['step4a'].to_integral_value()
        stats['step4b > 0'] += c['step4b'] > 0
        stats['step4c > 0'] += c['step4c'] > 0
        stats['line 3c floored at 0 (credits >= tentative > 0)'] += L['2h'] > 0 and L['3b'] >= L['2h']
        stats['tentative_annual needed rounding'] += L['2g'] != tentative_col
        stats['withholding needed rounding'] += fr(withholding) != per_check
        stats['withholding exactly on a half cent'] += (per_check * 200).denominator == 1 and (per_check * 100).denominator != 1
        stats['withholding 0.00'] += withholding == 0
        # what a payroll that rounds lines 2h and 3b to the cent first would get (not the key)
        line_by_line = max(ZERO, L['2h'].quantize(CENT, rounding=ROUND_HALF_UP)
                           - L['3b'].quantize(CENT, rounding=ROUND_HALF_UP)) + L['4a']
        stats['would move a cent if lines 2h and 3b were rounded first'] += line_by_line != withholding
        assert abs(line_by_line - withholding) <= CENT
        out.append({
            'case_id': c['case_id'], 'year': R.YEAR, 'paychecks': c['paychecks'],
            'wages': fmt(c['wages']), 'w4_status': c['status'], 'step2': c['step2'],
            'step3_credits': fmt(c['step3']), 'step4a_other': fmt(c['step4a']),
            'step4b_deductions': fmt(c['step4b']), 'step4c_extra': fmt(c['step4c']),
            'adjusted_annual': fmt(L['1i']), 'tentative_annual': fmt(tentative_col),
            'withholding': fmt(withholding),
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        w.writeheader()
        w.writerows(out)
    print(f'wrote {OUT.relative_to(ROOT)}: {len(out)} rows ({n_edge} edge rows); '
          'the exact second route agrees on every row')
    for k in sorted(stats):
        print(f'  {k}: {stats[k]}')
    print(f'  law route: largest difference from the printed table {float(law_gap):.4f} a year')
    for n in sorted(ws4_gap):
        print(f'  Worksheet 4, {n} pay periods: largest difference {float(ws4_gap[n]):.4f} a paycheck')
    print('  rows per table row (schedule, status: rows 1-8):')
    for schedule in R.SCHEDULES:
        for status in R.STATUSES:
            print(f'    {schedule:8} {status:17}', ' '.join(f'{cover[(schedule, status, k)]:4}' for k in range(8)))


if __name__ == '__main__':
    main()
