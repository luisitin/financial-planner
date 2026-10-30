"""Sole proprietor answer key: 2,000 invented households with a Schedule C business.

Run:  python3 tools/golden_business/sole_key.py
Writes tests/golden/business/sole.csv. Standard library only, Decimal money, deterministic.

Never imports or reads the app. Every row is worked two separate ways and the CSV is written only
if both agree on every output column to the cent (in fact exactly, before rounding):
  1. the forms, line by line: Schedule SE lines 2-13, Form 7206 lines 1-14, Form 8959 Part II
     lines 8-13, then household.forms_return() (Form 1040, Form 8995, the Qualified Dividends and
     Capital Gain Tax Worksheet, Schedule 8812, Form 8960);
  2. the statute: IRC 1401/1402 (net earnings as profit minus the 1402(a)(12) deduction, the
     1402(b) wage-base and $400 rules), 162(l)(2)(A) with 401(c)(2) earned income, 1401(b)(2)
     written as an increment, Treas. Reg. 1.199A-3(b)(1)(vi) for QBI, then
     household.statute_return() (IRC 62, 63, 199A, 1(h), 24, 32(c)(2), 1411).
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import csv
import math
import random
from collections import Counter
from decimal import Decimal as D, ROUND_FLOOR
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rules as R  # noqa: E402
import household as H  # noqa: E402
from household import ZERO, Unsettled, cents  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'business' / 'sole.csv'
SEED = 20261101
ROWS_PER_CELL = 250          # 2 years x 4 statuses x 250 = 2,000 rows
MAX_PROFIT = 400000
MAX_LOSS = 20000

INPUTS = ['case_id', 'year', 'filing_status', 'owner_wages', 'other_wages', 'qualified_dividends',
          'kids_under_17', 'profit', 'health_premiums', 'retirement']
OUTPUTS = ['se_tax', 'se_half', 'sehi', 'qbi', 'agi_with', 'taxable_income_with', 'tax_with',
           'tax_without', 'addl_medicare_se']
COLUMNS = INPUTS + OUTPUTS


# =========================== derivation 1: the forms, line by line ===========================

def schedule_se(year, profit, ss_wages):
    """Schedule SE (2025; 2026 draft) Part I, no farm, no church income, no optional method."""
    line2 = profit
    line3 = line2
    line4a = line3 * R.SE_NET_FACTOR if line3 > 0 else line3
    line4c = line4a
    if line4c < R.SE_MIN_NET_EARNINGS:            # "If less than $400, stop"
        return {'line4c': line4c, 'line6': ZERO, 'line9': None, 'line12': ZERO, 'line13': ZERO}
    line6 = line4c
    line7 = R.SS_WAGE_BASE[year]
    line8a = ss_wages                             # W-2 box 3 (the owner's own wages only)
    line8d = line8a
    line9 = max(ZERO, line7 - line8d)
    line10 = min(line6, line9) * R.SE_OASDI_RATE
    line11 = line6 * R.SE_HI_RATE
    line12 = line10 + line11
    line13 = line12 * R.SE_DEDUCTION_SHARE
    return {'line4c': line4c, 'line6': line6, 'line9': line9, 'line10': line10, 'line11': line11,
            'line12': line12, 'line13': line13}


def sep_maximum(year, profit, se_half):
    """Publication 560 Deduction Worksheet for Self-Employed, steps 1-8 and 21 (no deferrals)."""
    step3 = profit - se_half
    if step3 <= 0:
        return ZERO
    step5 = step3 * R.SE_REDUCED_RATE
    step6 = R.COMP_LIMIT_401A17[year] * R.SEP_PLAN_RATE
    step7 = min(step5, step6)
    return min(step7, R.LIMIT_415C[year])


def form_7206(premiums, profit, sch1_line15, sep):
    """Form 7206 (2025) for a Schedule C business, one plan."""
    line1 = premiums
    line3 = line1                                 # no long-term care premiums
    if line3 == 0:
        return ZERO
    line4 = profit                                # net profit of the business with the plan
    line5 = profit                                # all profitable businesses (just this one)
    line6 = line4 / line5
    line7 = sch1_line15 * line6
    line8 = line4 - line7
    line9 = sep                                   # Schedule 1 line 16 for this business
    line10 = line8 - line9
    line13 = line10                               # no Form 2555
    return max(ZERO, min(line3, line13))          # line 14


def form_8959_part2(status, se_line6, medicare_wages):
    line8 = max(ZERO, se_line6)
    line9 = R.ADDL_MEDICARE_THRESHOLD[status]
    line10 = medicare_wages                       # Part I line 4: both spouses' box 5 on a joint return
    line11 = max(ZERO, line9 - line10)
    line12 = max(ZERO, line8 - line11)
    return line12 * R.ADDL_MEDICARE_RATE          # line 13


def household_inputs(row, business):
    wages = row['owner_wages'] + row['other_wages']
    h = {'year': row['year'], 'status': row['filing_status'], 'kids': row['kids_under_17'],
         'wages': wages, 'qd': row['qualified_dividends'], 'k1': ZERO,
         'sched_c': ZERO, 'se_half': ZERO, 'sep': ZERO, 'sehi': ZERO, 'qbi': None, 'active': False}
    if business is not None:
        h.update(business)
    return h


def derive_forms(row):
    year, s, profit = row['year'], row['filing_status'], row['profit']
    se = schedule_se(year, profit, row['owner_wages'])
    se_half = se['line13']
    sehi = form_7206(row['health_premiums'], profit, se_half, row['retirement']) if profit > 0 else ZERO
    qbi_line1c = profit - se_half - sehi - row['retirement']
    h = household_inputs(row, {'sched_c': profit, 'se_half': se_half, 'sep': row['retirement'],
                               'sehi': sehi, 'qbi': qbi_line1c, 'active': True})
    with_biz = H.forms_return(h)
    h0 = household_inputs(row, None)
    without = H.forms_return(h0)
    addl = form_8959_part2(s, se['line6'], row['owner_wages'] + row['other_wages'])
    return {
        'se_tax': se['line12'], 'se_half': se_half, 'sehi': sehi, 'qbi': with_biz['qbi_deduction'],
        'agi_with': with_biz['agi'], 'taxable_income_with': with_biz['taxable_income'],
        'tax_with': with_biz['tax'], 'tax_without': without['tax'], 'addl_medicare_se': addl,
        '_se': se, '_with': with_biz, '_without': without, '_h': h, '_h0': h0, '_qbi_amount': qbi_line1c,
    }


# ========================= derivation 2: the statute, written differently ======================

def derive_statute(row):
    year, s, profit = row['year'], row['filing_status'], row['profit']
    wages = row['owner_wages']
    # IRC 1402(a) with the (a)(12) deduction: profit less 7.65% of profit.
    half_rate = R.SE_1402A12_SHARE * (R.SE_OASDI_RATE + R.SE_HI_RATE)
    nese = profit - profit * half_rate if profit > 0 else profit
    if nese < R.SE_MIN_NET_EARNINGS:                                  # 1402(b)(2)
        oasdi_income = hi_income = ZERO
    else:
        oasdi_income = min(nese, max(ZERO, R.SS_WAGE_BASE[year] - wages))  # 1402(b)(1)
        hi_income = nese
    se_tax = R.SE_OASDI_RATE * oasdi_income + R.SE_HI_RATE * hi_income     # 1401(a), (b)(1)
    se_half = se_tax / 2                                                   # 164(f)(1)
    sep = row['retirement']
    earned = profit - se_half - sep                                        # 401(c)(2)(A)(v), (vi)
    sehi = min(row['health_premiums'], max(ZERO, earned))                  # 162(l)(1), (2)(A)
    # Treas. Reg. 1.199A-3(b)(1)(vi): the 164(f), 162(l) and 404 deductions reduce QBI in
    # proportion to the gross income from this business that entered them: here 100%.
    share = D(1)
    qbi_amount = profit - share * (se_half + sehi + sep)
    h = household_inputs(row, {'sched_c': profit, 'se_half': se_half, 'sep': sep, 'sehi': sehi,
                               'qbi': qbi_amount, 'active': True})
    with_biz = H.statute_return(h)
    without = H.statute_return(household_inputs(row, None))
    # IRC 1401(b)(2): 0.9% of SE income over the threshold reduced by wages, written as the
    # increase over the tax on wages alone.
    thr = R.ADDL_MEDICARE_THRESHOLD[s]
    medicare_wages = row['owner_wages'] + row['other_wages']
    addl = R.ADDL_MEDICARE_RATE * (max(ZERO, medicare_wages + hi_income - thr) - max(ZERO, medicare_wages - thr))
    return {'se_tax': se_tax, 'se_half': se_half, 'sehi': sehi, 'qbi': with_biz['qbi_deduction'],
            'agi_with': with_biz['agi'], 'taxable_income_with': with_biz['taxable_income'],
            'tax_with': with_biz['tax'], 'tax_without': without['tax'], 'addl_medicare_se': addl}


# ======================================== the generator ========================================

def log_uniform(rng, low, high):
    return math.exp(rng.uniform(math.log(low), math.log(high)))


def whole(x):
    return D(int(round(x)))


def floor_cents(x):
    return x.quantize(D('0.01'), rounding=ROUND_FLOOR)


def draw_wages(rng, year):
    base = int(R.SS_WAGE_BASE[year])
    r = rng.random()
    if r < 0.25:
        return ZERO
    if r < 0.30:
        return D(base)                                       # exactly the wage base: line 9 = 0
    if r < 0.38:
        return whole(rng.uniform(base, base + 40000))        # above the base
    if r < 0.50:
        return whole(base - rng.uniform(1, 30000))           # just under: line 9 small
    if r < 0.75:
        return whole(log_uniform(rng, 1000, 170000))
    return whole(rng.uniform(1000, 170000))


def draw_inputs(rng, year, s, kind):
    owner = draw_wages(rng, year)
    other = ZERO
    if s == 'married_joint' and rng.random() >= 0.3:
        other = whole(log_uniform(rng, 2000, 250000) if rng.random() < 0.5 else rng.uniform(2000, 250000))
    qd = ZERO
    if rng.random() < 0.5:
        qd = whole(log_uniform(rng, 10, 60000)) if rng.random() < 0.85 else whole(rng.uniform(1, 120000))
    kids = rng.randint(1, 2) if s == 'head_of_household' else rng.randint(0, 2)
    cushion = owner + other + qd
    if kind == 'loss' and cushion >= 1:
        profit = -whole(rng.uniform(1, float(min(D(MAX_LOSS), cushion))))
        profit = max(profit, -cushion)
    elif kind in ('loss', 'small'):
        r = rng.random()
        if r < 0.10:
            profit = ZERO
        elif r < 0.25:
            profit = D(rng.choice([433, 434, 1082, 1083]))  # net earnings straddle $400; QBI around $1,000
        else:
            profit = whole(rng.uniform(1, 1499))
    else:
        profit = whole(log_uniform(rng, 1500, MAX_PROFIT) if rng.random() < 0.35 else rng.uniform(1500, MAX_PROFIT))
    premiums = ZERO
    if profit > 0 and rng.random() < 0.5:
        if rng.random() < 0.8:      # usually well inside the profit
            premiums = whole(rng.uniform(300, float(min(D(30000), max(D(600), profit / 2)))))
        else:                       # anything up to 30,000: often above the earned-income limit
            premiums = whole(rng.uniform(1, 30000))
    return {'year': year, 'filing_status': s, 'owner_wages': owner, 'other_wages': other,
            'qualified_dividends': qd, 'kids_under_17': kids, 'profit': profit,
            'health_premiums': premiums, 'retirement': ZERO}


def pick_retirement(rng, row):
    se_half = schedule_se(row['year'], row['profit'], row['owner_wages'])['line13']
    top = floor_cents(sep_maximum(row['year'], row['profit'], se_half))
    if top < 1 or rng.random() >= 0.30:
        return ZERO
    if rng.random() < 0.25:
        return top                                          # exactly the SEP maximum (to the cent)
    return whole(rng.uniform(1, float(top))).min(top).max(D(1))


def ti_before(row):
    return derive_forms(row)['_with']['ti_before_qbi']


def fit_to_threshold(row):
    """Largest whole-dollar profit (<= 400,000) keeping taxable income before QBI at or under the
    threshold; None if even 1,500 is too much or 400,000 is not enough to reach it."""
    thr = R.QBI_THRESHOLD[row['year']][row['filing_status']]
    trial = dict(row, retirement=ZERO)
    lo, hi = 1500, MAX_PROFIT
    if ti_before(dict(trial, profit=D(lo))) > thr or ti_before(dict(trial, profit=D(hi))) <= thr:
        return None
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ti_before(dict(trial, profit=D(mid))) <= thr:
            lo = mid
        else:
            hi = mid
    return D(lo)


def build_row(rng, year, s):
    """Draws until a row is inside the key's ground (199A threshold, no AMT, settled rules)."""
    for _ in range(10000):
        r = rng.random()
        kind = 'loss' if r < 0.10 else 'small' if r < 0.15 else 'near' if r < 0.19 else 'big'
        row = draw_inputs(rng, year, s, kind)
        if kind == 'near':
            fitted = fit_to_threshold(row)
            if fitted is None:
                continue
            row['profit'] = fitted
        else:
            row['retirement'] = pick_retirement(rng, row)
        try:
            f = derive_forms(row)
            if f['_with']['ti_before_qbi'] > R.QBI_THRESHOLD[year][s]:
                continue
            H.amt_guard(f['_h'], f['_with'])
            H.amt_guard(f['_h0'], f['_without'])
            st = derive_statute(row)
        except Unsettled:
            continue
        row['_kind'] = kind
        return row, f, st
    raise RuntimeError('could not draw a row')


def compare(row, f, st):
    for col in OUTPUTS:
        a, b = f[col], st[col]
        if a != b or cents(a) != cents(b):
            raise SystemExit(f"MISMATCH {row['case_id']} {col}: forms {a} statute {b}")


def main():
    rng = random.Random(SEED)
    rows, cover = [], Counter()
    for year in R.YEARS:
        for s in R.STATUSES:
            for i in range(1, ROWS_PER_CELL + 1):
                row, f, st = build_row(rng, year, s)
                row['case_id'] = f'sole-{year}-{s}-{i:03d}'
                compare(row, f, st)
                row.update({k: f[k] for k in OUTPUTS})
                rows.append(row)
                se, w = f['_se'], f['_with']
                cover['kind ' + row['_kind']] += 1
                cover['loss'] += row['profit'] < 0
                cover['net earnings under $400 (profit > 0)'] += 0 < row['profit'] and se['line12'] == 0
                cover['SE: wages at/over base (line 9 = 0)'] += se['line9'] == 0
                cover['SE: base splits line 6 (0 < line 9 < line 6)'] += (se['line9'] or 0) > 0 and se['line9'] < se['line6']
                cover['SEHI limited by earned income'] += 0 < f['sehi'] < row['health_premiums']
                cover['SEHI claimed'] += f['sehi'] > 0
                cover['SEP contribution'] += row['retirement'] > 0
                ws8995 = w['f8995']
                cover['QBI limited by 20% of TI'] += ws8995.get('line14', ZERO) < ws8995.get('line10', ZERO)
                cover['2026 $400 minimum applied'] += ws8995.get('min_applied', False)
                cover['QBI amount <= 0'] += f['_qbi_amount'] <= 0
                cover['CTC phased out partly or fully'] += row['kids_under_17'] > 0 and w['agi'] > R.CTC_PHASEOUT_START[s]
                cover['ACTC > 0'] += w['actc'] > 0
                cover['ACTC limited by 15% of earned'] += 0 < w['actc'] < min(w['ctc_after_phaseout'] - w['ctc'], R.ACTC_PER_CHILD[year] * row['kids_under_17'])
                cover['NIIT > 0'] += w['niit'] > 0
                cover['addl Medicare on SE > 0'] += f['addl_medicare_se'] > 0
                cover['tax_with < 0'] += f['tax_with'] < 0
                cover['TI before QBI within $1 of threshold'] += R.QBI_THRESHOLD[year][s] - w['ti_before_qbi'] < 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        w.writeheader()
        for row in rows:
            out = {}
            for col in COLUMNS:
                v = row[col]
                out[col] = f'{cents(v):.2f}' if isinstance(v, D) else v
            w.writerow(out)
    print(f'wrote {len(rows)} rows to {OUT.relative_to(ROOT)}; both derivations agree on every row')
    for k in sorted(cover):
        print(f'  {k}: {cover[k]}')


if __name__ == '__main__':
    main()
