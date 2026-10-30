"""S corporation answer key: 1,000 invented households where the business is an S corporation
wholly owned by the owner (a more-than-2% shareholder-employee) with no other employees.

Run:  python3 tools/golden_business/scorp_key.py
Writes tests/golden/business/scorp.csv. Standard library only, Decimal money, deterministic.

Never imports or reads the app. Every row is worked two separate ways and the CSV is written only
if both agree on every output column to the cent (in fact exactly, before rounding):
  1. the forms: Form 1120-S lines 7-21 and Schedule K-1 box 1, the corporation's Form W-2 boxes
     1, 3, 4, 5, 6 (Notice 2008-1 for the premiums), Schedule 3 line 11 (excess social security),
     Form 8959 Part I with and without the salary, Form 7206 lines 1-14 (line 11 for an S
     corporation), then household.forms_return();
  2. the statute: IRC 3111(a)/(b) with the 3121(a)(1) base per employer, 3101(a)/(b)(1)/(b)(2)
     with the 31(b)/6413(c) cap written as one 6.2% x base for the year, 1366(a) for the K-1,
     162(l)(5)(A) (3121 wages as earned income), Treas. Reg. 1.199A-3(b)(1)(vi) and IRS 199A FAQ
     39 for QBI, then household.statute_return().
"""
import sys
sys.dont_write_bytecode = True  # keep the repo free of __pycache__

import csv
import math
import random
from collections import Counter
from decimal import Decimal as D
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rules as R  # noqa: E402
import household as H  # noqa: E402
from household import ZERO, Unsettled, cents  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'business' / 'scorp.csv'
SEED = 20261102
ROWS_PER_CELL = 125          # 2 years x 4 statuses x 125 = 1,000 rows
MIN_PROFIT, MAX_PROFIT = 5000, 400000
MAX_COSTS = 4000

# IRS 199A FAQ 39 (https://www.irs.gov/newsroom/tax-cuts-and-jobs-act-provision-11011-section-199a-
# qualified-business-income-deduction-faqs): the shareholder's 162(l) deduction "will be a deduction
# in determining QBI. This may result in QBI being reduced at both the entity and the shareholder
# level." The key follows it. Set to False to read QBI as the K-1 income alone (README "Choices").
QBI_LESS_SEHI = True

INPUTS = ['case_id', 'year', 'filing_status', 'owner_other_wages', 'other_wages', 'qualified_dividends',
          'kids_under_17', 'profit', 'salary', 'costs', 'health_premiums']
OUTPUTS = ['employer_tax', 'employee_tax', 'passed', 'sehi', 'qbi', 'tax_with', 'tax_without']
COLUMNS = INPUTS + OUTPUTS


# =========================== derivation 1: the forms, line by line ===========================

def corp_w2(year, salary, premiums):
    """The corporation's Form W-2 for the owner (Notice 2008-1: premiums in box 1, not 3 or 5)."""
    base = R.SS_WAGE_BASE[year]
    box1 = salary + premiums
    box3 = min(salary, base)                     # social security wages, to the base
    box4 = box3 * R.EMPLOYEE_OASDI_RATE
    box5 = salary                                # Medicare wages
    box6 = box5 * R.EMPLOYEE_HI_RATE             # (any 0.9% withheld is settled on Form 8959)
    employer = box3 * R.EMPLOYER_OASDI_RATE + box5 * R.EMPLOYER_HI_RATE   # Form 941 lines 5a, 5c
    return {'box1': box1, 'box3': box3, 'box4': box4, 'box5': box5, 'box6': box6, 'employer': employer}


def form_1120s(profit, w2, costs, premiums):
    """Form 1120-S page 1 and Schedule K-1 box 1 (one shareholder, 100%)."""
    gross = profit                                # profit before the items below
    line7 = w2['box1'] - premiums                 # compensation of officers (the salary)
    line12 = w2['employer']                       # taxes: employer social security and Medicare
    line18 = premiums                             # 2% shareholder health premiums (Rev. Rul. 91-26), also in W-2 box 1
    line19 = costs                                # other deductions
    line20 = line7 + line12 + line18 + line19
    line21 = gross - line20                       # ordinary business income (loss)
    return line21                                 # K-1 box 1


def form_8959_part1(status, medicare_wages):
    line4 = medicare_wages
    line6 = max(ZERO, line4 - R.ADDL_MEDICARE_THRESHOLD[status])
    return line6 * R.ADDL_MEDICARE_RATE           # line 7


def schedule3_line11(year, box4_list):
    """Excess social security withheld (two or more employers): Schedule 3 line 11 worksheet."""
    total = sum(box4_list, ZERO)
    cap = R.SS_WAGE_BASE[year] * R.EMPLOYEE_OASDI_RATE
    return max(ZERO, total - cap)


def form_7206_scorp(premiums, box5_from_corp):
    line1 = premiums
    line3 = line1
    line11 = box5_from_corp                       # Medicare wages from the S corporation
    line13 = line11                               # no Form 2555
    return min(line3, line13)                     # line 14


def household_inputs(row, business):
    h = {'year': row['year'], 'status': row['filing_status'], 'kids': row['kids_under_17'],
         'wages': row['owner_other_wages'] + row['other_wages'], 'qd': row['qualified_dividends'],
         'k1': ZERO, 'sched_c': ZERO, 'se_half': ZERO, 'sep': ZERO, 'sehi': ZERO, 'qbi': None,
         'active': False}
    if business is not None:
        h.update(business)
    return h


def derive_forms(row):
    year, s = row['year'], row['filing_status']
    salary, premiums = row['salary'], row['health_premiums']
    w2 = corp_w2(year, salary, premiums)
    k1 = form_1120s(row['profit'], w2, row['costs'], premiums)
    job_box4 = min(row['owner_other_wages'], R.SS_WAGE_BASE[year]) * R.EMPLOYEE_OASDI_RATE
    excess = schedule3_line11(year, [job_box4, w2['box4']])
    other_medicare = row['owner_other_wages'] + row['other_wages']
    addl_added = form_8959_part1(s, other_medicare + w2['box5']) - form_8959_part1(s, other_medicare)
    employee = (w2['box4'] - excess) + w2['box6'] + addl_added
    sehi = form_7206_scorp(premiums, w2['box5'])
    qbi_line1c = k1 - sehi if QBI_LESS_SEHI else k1
    h = household_inputs(row, {'wages': row['owner_other_wages'] + row['other_wages'] + w2['box1'],
                               'k1': k1, 'sehi': sehi, 'qbi': qbi_line1c, 'active': True})
    with_biz = H.forms_return(h)
    h0 = household_inputs(row, None)
    without = H.forms_return(h0)
    return {'employer_tax': w2['employer'], 'employee_tax': employee, 'passed': k1, 'sehi': sehi,
            'qbi': with_biz['qbi_deduction'], 'tax_with': with_biz['tax'], 'tax_without': without['tax'],
            '_with': with_biz, '_without': without, '_h': h, '_h0': h0, '_qbi_amount': qbi_line1c,
            '_excess': excess, '_addl': addl_added}


# ========================= derivation 2: the statute, written differently ======================

def derive_statute(row):
    year, s = row['year'], row['filing_status']
    salary, premiums, other = row['salary'], row['health_premiums'], row['owner_other_wages']
    base = R.SS_WAGE_BASE[year]
    # 3121(a)(2)(B): the premiums are not FICA wages. 3121(a)(1): the base applies per employer.
    fica_wages = salary
    employer_tax = (R.EMPLOYER_OASDI_RATE * min(fica_wages, base)          # 3111(a)
                    + R.EMPLOYER_HI_RATE * fica_wages)                     # 3111(b)
    # 3101(a) with the 31(b) / 6413(c) refund: the owner's own social security tax for the year is
    # 6.2% of at most one base; the other job's share comes first, the salary gets the rest.
    oasdi_year = R.EMPLOYEE_OASDI_RATE * min(other + fica_wages, base)
    oasdi_job = R.EMPLOYEE_OASDI_RATE * min(other, base)
    thr = R.ADDL_MEDICARE_THRESHOLD[s]
    household_medicare = other + row['other_wages']
    addl_share = R.ADDL_MEDICARE_RATE * max(ZERO, min(fica_wages, household_medicare + fica_wages - thr))  # 3101(b)(2)
    employee_tax = (oasdi_year - oasdi_job) + R.EMPLOYEE_HI_RATE * fica_wages + addl_share
    # 1366(a): the shareholder's pro rata share (100%) of the corporation's nonseparately stated
    # income: profit less its deductions under 162(a) (salary and the premiums) and 164(a) (payroll tax).
    passed = row['profit'] - (salary + premiums + employer_tax + row['costs'])
    # 162(l)(5)(A): wages from the S corporation as defined in 3121 are the earned income.
    sehi = min(premiums, max(ZERO, fica_wages))
    qbi_amount = passed - (sehi if QBI_LESS_SEHI else ZERO)
    h = household_inputs(row, {'wages': other + row['other_wages'] + salary + premiums,
                               'k1': passed, 'sehi': sehi, 'qbi': qbi_amount, 'active': True})
    with_biz = H.statute_return(h)
    without = H.statute_return(household_inputs(row, None))
    return {'employer_tax': employer_tax, 'employee_tax': employee_tax, 'passed': passed, 'sehi': sehi,
            'qbi': with_biz['qbi_deduction'], 'tax_with': with_biz['tax'], 'tax_without': without['tax']}


# ======================================== the generator ========================================

def log_uniform(rng, low, high):
    return math.exp(rng.uniform(math.log(low), math.log(high)))


def whole(x):
    return D(int(round(x)))


def draw_inputs(rng, year, s):
    base = int(R.SS_WAGE_BASE[year])
    r = rng.random()
    if r < 0.45:
        other_job = ZERO
    elif r < 0.52:
        other_job = whole(rng.uniform(base, base + 40000))           # the other job used the whole base
    elif r < 0.62:
        other_job = whole(base - rng.uniform(1, 40000))              # part of the base left for the salary
    else:
        other_job = whole(log_uniform(rng, 2000, 170000))
    spouse = ZERO
    if s == 'married_joint' and rng.random() >= 0.3:
        spouse = whole(log_uniform(rng, 2000, 250000) if rng.random() < 0.5 else rng.uniform(2000, 250000))
    qd = ZERO
    if rng.random() < 0.5:
        qd = whole(log_uniform(rng, 10, 60000))
    kids = rng.randint(1, 2) if s == 'head_of_household' else rng.randint(0, 2)
    r = rng.random()
    if r < 0.03:
        profit = D(MIN_PROFIT)
    elif r < 0.40:
        profit = whole(log_uniform(rng, MIN_PROFIT, MAX_PROFIT))
    else:
        profit = whole(rng.uniform(MIN_PROFIT, MAX_PROFIT))
    r = rng.random()
    if r < 0.10:
        salary = ZERO
    elif r < 0.18:
        salary = profit
    elif r < 0.28 and profit >= base - 5000:
        salary = min(D(base), profit) if rng.random() < 0.4 else whole(rng.uniform(base - 5000, float(min(profit, D(base + 5000)))))
    else:
        salary = whole(float(profit) * rng.uniform(0.2, 0.8))
    r = rng.random()
    costs = ZERO if r < 0.2 else D(MAX_COSTS) if r < 0.25 else whole(rng.uniform(1, MAX_COSTS))
    premiums = ZERO
    if rng.random() < 0.5:
        if rng.random() < 0.85:     # usually a fraction of the profit
            premiums = whole(rng.uniform(1000, float(min(D(30000), max(D(2000), profit / 4)))))
        else:                       # anything up to 30,000: can exceed the salary or the profit
            premiums = whole(rng.uniform(1, 30000))
    return {'year': year, 'filing_status': s, 'owner_other_wages': other_job, 'other_wages': spouse,
            'qualified_dividends': qd, 'kids_under_17': kids, 'profit': profit, 'salary': salary,
            'costs': costs, 'health_premiums': premiums}


def build_row(rng, year, s):
    for _ in range(10000):
        row = draw_inputs(rng, year, s)
        assert ZERO <= row['salary'] <= row['profit'] and ZERO <= row['costs'] <= MAX_COSTS
        try:
            f = derive_forms(row)
            if f['_with']['ti_before_qbi'] > R.QBI_THRESHOLD[year][s]:
                continue
            H.amt_guard(f['_h'], f['_with'])
            H.amt_guard(f['_h0'], f['_without'])
            st = derive_statute(row)
        except Unsettled:
            continue
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
                row['case_id'] = f'scorp-{year}-{s}-{i:03d}'
                compare(row, f, st)
                row.update({k: f[k] for k in OUTPUTS})
                rows.append(row)
                w = f['_with']
                base = R.SS_WAGE_BASE[year]
                cover['salary 0'] += row['salary'] == 0
                cover['salary = profit'] += row['salary'] == row['profit']
                cover['salary over the base (employer tax capped)'] += row['salary'] > base
                cover['excess social security credit'] += f['_excess'] > 0
                cover['other job used the whole base'] += row['owner_other_wages'] >= base and row['salary'] > 0
                cover['additional Medicare added by the salary'] += f['_addl'] > 0
                cover['K-1 loss'] += f['passed'] < 0
                cover['SEHI claimed'] += f['sehi'] > 0
                cover['SEHI limited by box 5 wages'] += f['sehi'] < row['health_premiums']
                ws8995 = w['f8995']
                cover['QBI limited by 20% of TI'] += ws8995.get('line14', ZERO) < ws8995.get('line10', ZERO)
                cover['2026 $400 minimum applied'] += ws8995.get('min_applied', False)
                cover['QBI amount <= 0'] += f['_qbi_amount'] <= 0
                cover['CTC phased out partly or fully'] += row['kids_under_17'] > 0 and w['agi'] > R.CTC_PHASEOUT_START[s]
                cover['ACTC > 0'] += w['actc'] > 0
                cover['NIIT > 0'] += w['niit'] > 0
                cover['tax_with < 0'] += f['tax_with'] < 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open('w', newline='', encoding='utf-8') as fh:
        wr = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator='\n')
        wr.writeheader()
        for row in rows:
            wr.writerow({c: (f'{cents(row[c]):.2f}' if isinstance(row[c], D) else row[c]) for c in COLUMNS})
    print(f'wrote {len(rows)} rows to {OUT.relative_to(ROOT)}; both derivations agree on every row')
    for k in sorted(cover):
        print(f'  {k}: {cover[k]}')


if __name__ == '__main__':
    main()
