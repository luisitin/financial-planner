"""Retirement plan answer key: 1,000 invented self-employed people with no employees, and the most
each can put in a SEP, a solo 401(k) and a SIMPLE IRA for the year.

Run:  python3 tools/golden_business/plans_key.py
Writes tests/golden/business/plans.csv. Standard library only, Decimal money, deterministic.

Never imports or reads the app. Every row is worked two separate ways and the CSV is written only
if both agree on every output column to the cent (in fact exactly, before rounding):
  1. Publication 560 (2025): Schedule SE lines 2-13, the Deduction Worksheet for Self-Employed
     steps 1-19 (SEP: steps 1-8; solo 401(k): steps 9-19 with the elective deferral and the
     catch-up at their largest allowed amounts), and chapter 3's SIMPLE IRA rules taken in order;
  2. the statute in closed form: IRC 1401/1402 for the half SE tax, 401(c)(2) earned income,
     402(h)(2) / 404(a)(3) as 25% of compensation net of the contribution (rate / (1 + rate)),
     415(c)(1) as one minimum over the dollar cap and 100% of compensation, 402(g) and 414(v)
     for the deferral and catch-up, 408(p)(2)(A) and (p)(6)(A)(ii) for the SIMPLE IRA.
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
from household import ZERO, cents  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tests' / 'golden' / 'business' / 'plans.csv'
SEED = 20261103
ROWS_PER_YEAR = 500          # 2 years x 500 = 1,000 rows
MIN_PROFIT, MAX_PROFIT = 500, 600000
SPECIAL_AGES = (49, 50, 59, 60, 63, 64)

INPUTS = ['case_id', 'year', 'age', 'owner_wages', 'job_deferrals', 'profit']
OUTPUTS = ['se_half', 'earned', 'sep_max', 'solo_max', 'simple_comp', 'simple_max']
COLUMNS = INPUTS + OUTPUTS


def catchup_401k(year, age):
    """414(v)(2)(B)(i) and (E)(i): ages 60-63 get the higher amount; 50-59 and 64+ the regular one."""
    if age < R.CATCHUP_AGE:
        return ZERO
    lo, hi = R.SUPER_CATCHUP_AGES
    return R.CATCHUP_401K_60_63[year] if lo <= age <= hi else R.CATCHUP_401K[year]


def catchup_simple(year, age):
    """414(v)(2)(B)(iii) for a small-employer SIMPLE (3,850); ages 60-63 take (E)(ii) instead
    (5,250), which T.D. 10033 lets such a plan give because it is larger."""
    if age < R.CATCHUP_AGE:
        return ZERO
    lo, hi = R.SUPER_CATCHUP_AGES
    if lo <= age <= hi:
        return max(R.SIMPLE_CATCHUP_60_63[year], R.SIMPLE_CATCHUP_SMALL[year])
    return R.SIMPLE_CATCHUP_SMALL[year]


# =========================== derivation 1: Publication 560, step by step ======================

def schedule_se(year, profit, ss_wages):
    line3 = profit
    line4a = line3 * R.SE_NET_FACTOR if line3 > 0 else line3
    line4c = line4a
    if line4c < R.SE_MIN_NET_EARNINGS:
        return {'line4c': line4c, 'line12': ZERO, 'line13': ZERO}
    line6 = line4c
    line9 = max(ZERO, R.SS_WAGE_BASE[year] - ss_wages)
    line12 = min(line6, line9) * R.SE_OASDI_RATE + line6 * R.SE_HI_RATE
    return {'line4c': line4c, 'line9': line9, 'line12': line12, 'line13': line12 * R.SE_DEDUCTION_SHARE}


def deduction_worksheet(year, profit, se_half, deferral_room, catchup):
    """Publication 560 (2025) Deduction Worksheet for Self-Employed, plan rate 25%."""
    step1 = profit
    step2 = se_half
    step3 = step1 - step2                              # net earnings from self-employment
    step4 = R.SE_REDUCED_RATE                          # rate table: 25% -> 0.200000
    step5 = step3 * step4
    step6 = R.COMP_LIMIT_401A17[year] * R.SEP_PLAN_RATE
    step7 = min(step5, step6)
    step8 = R.LIMIT_415C[year]
    sep = min(step7, step8)                            # no deferrals: smaller of step 7 or step 8
    # Solo 401(k): step 9 = the largest allowable elective deferral: the 402(g) room left after the
    # job's deferrals, and never more than the net earnings (the deferral comes out of them).
    step9 = min(deferral_room, step3)
    step10 = step8 - step9
    step11 = step3 - step9
    step12 = step11 / 2
    step13 = min(step7, step10, step12)               # employer (profit-sharing) contribution
    step14 = step3 - step13
    step15 = min(step9, step14)                        # elective deferral
    step16 = step14 - step15
    step17 = catchup                                   # catch-up contribution, at its limit
    step18 = min(step16, step17)
    step19 = step13 + step15 + step18
    return {'step3': step3, 'sep': sep, 'step13': step13, 'step15': step15, 'step18': step18,
            'solo': step19}


def simple_ira(year, age, profit, job_deferrals):
    """Publication 560 chapter 3, for the owner of a one-person SIMPLE IRA plan."""
    comp = schedule_se(year, profit, ZERO)['line4c']   # "line 4 of Schedule SE", before SIMPLE contributions
    plan_limit = R.SIMPLE_DEFERRAL_SMALL[year]         # higher limit: 25 or fewer employees
    overall_room = max(ZERO, R.LIMIT_402G[year] - job_deferrals)   # salary reductions count toward 402(g)
    regular = min(plan_limit, overall_room, comp)      # expressed as a % of compensation: at most 100%
    catch = min(catchup_simple(year, age), comp - regular)  # lesser of the limit or comp - non-catch-up deferrals
    match = min(regular + catch, comp * R.SIMPLE_MATCH_RATE)  # dollar for dollar up to 3% of compensation
    return {'comp': comp, 'regular': regular, 'catch': catch, 'match': match,
            'max': regular + catch + match}


def derive_forms(row):
    year, age, profit = row['year'], row['age'], row['profit']
    se_half = schedule_se(year, profit, row['owner_wages'])['line13']
    room = max(ZERO, R.LIMIT_402G[year] - row['job_deferrals'])
    ws = deduction_worksheet(year, profit, se_half, room, catchup_401k(year, age))
    simple = simple_ira(year, age, profit, row['job_deferrals'])
    return {'se_half': se_half, 'earned': ws['step3'], 'sep_max': ws['sep'], 'solo_max': ws['solo'],
            'simple_comp': simple['comp'], 'simple_max': simple['max'], '_ws': ws, '_simple': simple}


# ========================= derivation 2: the statute in closed form ============================

def derive_statute(row):
    year, age, profit, wages = row['year'], row['age'], row['profit'], row['owner_wages']
    half_rate = R.SE_1402A12_SHARE * (R.SE_OASDI_RATE + R.SE_HI_RATE)
    nese = profit - profit * half_rate                                    # 1402(a), (a)(12)
    if nese < R.SE_MIN_NET_EARNINGS:                                      # 1402(b)(2)
        se_tax = ZERO
    else:
        se_tax = (R.SE_OASDI_RATE * min(nese, max(ZERO, R.SS_WAGE_BASE[year] - wages))  # 1401(a), 1402(b)(1)
                  + R.SE_HI_RATE * nese)                                  # 1401(b)(1)
    se_half = se_tax / 2                                                   # 164(f)
    earned = profit - se_half                                              # 401(c)(2)(A)(vi), before 404 deductions
    rate = R.SEP_PLAN_RATE
    # E <= 25% x (earned - E)  <=>  E <= earned x rate / (1 + rate); the 401(a)(17) cap on
    # compensation gives E <= 25% x that cap; 415(c)(1)(A) the dollar cap.
    employer_cap = min(earned * rate / (1 + rate), rate * R.COMP_LIMIT_401A17[year])
    sep_max = min(R.LIMIT_415C[year], employer_cap)
    # Solo 401(k): deferral d (402(g) room, at most the earned income), employer E; 415(c)(1):
    # d + E <= the dollar cap and <= 100% of compensation (earned - E, deferrals counted in:
    # 415(c)(3)(B), (D)), i.e. d + E <= (earned + d) / 2. Catch-ups sit outside 415(c)
    # (414(v)(3)(A)) but within compensation (414(v)(2)(A)(ii)): the total never passes earned.
    d = min(max(ZERO, R.LIMIT_402G[year] - row['job_deferrals']), earned)
    regular_total = min(R.LIMIT_415C[year], d + employer_cap, (earned + d) / 2)
    solo_max = min(earned, regular_total + catchup_401k(year, age))
    # SIMPLE IRA: 408(p)(6)(A)(ii) compensation = 1402(a) net earnings before SIMPLE contributions.
    comp = nese
    room = min(R.SIMPLE_DEFERRAL_SMALL[year], max(ZERO, R.LIMIT_402G[year] - row['job_deferrals']))
    deferrals = min(comp, room + catchup_simple(year, age))               # 408(p)(2)(A)(ii), 402(g), 414(v)
    simple_max = deferrals + min(deferrals, R.SIMPLE_MATCH_RATE * comp)   # 408(p)(2)(A)(iii)
    return {'se_half': se_half, 'earned': earned, 'sep_max': sep_max, 'solo_max': solo_max,
            'simple_comp': comp, 'simple_max': simple_max}


# ======================================== the generator ========================================

def log_uniform(rng, low, high):
    return math.exp(rng.uniform(math.log(low), math.log(high)))


def whole(x):
    return D(int(round(x)))


def profit_for_sep_cap(year, wages):
    """Smallest whole-dollar profit whose SEP maximum reaches the 415(c) dollar cap."""
    lo, hi = MIN_PROFIT, MAX_PROFIT
    f = lambda p: derive_forms({'year': year, 'age': 40, 'owner_wages': wages, 'job_deferrals': ZERO,
                                'profit': D(p)})['sep_max']
    if f(hi) < R.LIMIT_415C[year]:
        return None
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if f(mid) >= R.LIMIT_415C[year]:
            hi = mid
        else:
            lo = mid
    return D(hi)


def draw_row(rng, year):
    age = rng.choice(SPECIAL_AGES) if rng.random() < 0.4 else rng.randint(25, 70)
    base = int(R.SS_WAGE_BASE[year])
    r = rng.random()
    if r < 0.40:
        wages = ZERO
    elif r < 0.48:
        wages = whole(rng.uniform(base, base + 60000))
    elif r < 0.58:
        wages = whole(base - rng.uniform(1, 50000))
    else:
        wages = whole(log_uniform(rng, 3000, 170000))
    limit = R.LIMIT_402G[year]
    deferrals = ZERO
    if wages > 0 and rng.random() < 0.5:
        top = min(limit, wages)
        deferrals = top if rng.random() < 0.2 else whole(rng.uniform(1, float(top))).min(top)
    r = rng.random()
    profit = None
    if r < 0.05:
        profit = profit_for_sep_cap(year, wages)
    elif r < 0.08:
        profit = D(rng.choice([MIN_PROFIT, MAX_PROFIT]))
    elif r < 0.16:
        profit = whole(rng.uniform(MIN_PROFIT, 5000))
    elif r < 0.41:
        profit = whole(log_uniform(rng, MIN_PROFIT, MAX_PROFIT))
    if profit is None:
        profit = whole(rng.uniform(MIN_PROFIT, MAX_PROFIT))
    return {'year': year, 'age': age, 'owner_wages': wages, 'job_deferrals': deferrals, 'profit': profit}


def compare(row, f, st):
    for col in OUTPUTS:
        a, b = f[col], st[col]
        if a != b or cents(a) != cents(b):
            raise SystemExit(f"MISMATCH {row['case_id']} {col}: forms {a} statute {b}")


def main():
    rng = random.Random(SEED)
    rows, cover = [], Counter()
    for year in R.YEARS:
        for i in range(1, ROWS_PER_YEAR + 1):
            row = draw_row(rng, year)
            row['case_id'] = f'plans-{year}-{i:03d}'
            f, st = derive_forms(row), derive_statute(row)
            compare(row, f, st)
            row.update({k: f[k] for k in OUTPUTS})
            rows.append(row)
            ws, sm = f['_ws'], f['_simple']
            age = row['age']
            cover['age 50-59 or 64+ (regular catch-up)'] += age >= 50 and not 60 <= age <= 63
            cover['age 60-63 (higher catch-up)'] += 60 <= age <= 63
            cover['under 50'] += age < 50
            cover['job deferrals > 0'] += row['job_deferrals'] > 0
            cover['job deferrals used all of 402(g)'] += row['job_deferrals'] == R.LIMIT_402G[year]
            cover['SEP at the 415(c) dollar cap'] += f['sep_max'] == R.LIMIT_415C[year]
            cover['solo: employer + deferral at the 415(c) cap'] += ws['step13'] + ws['step15'] == R.LIMIT_415C[year]
            cover['solo: limited by 100% of compensation (step 12 or 15/16)'] += ws['step13'] < min(ws['step3'] * R.SE_REDUCED_RATE, R.LIMIT_415C[year] - ws['step15']) or (ws['step18'] < catchup_401k(year, age))
            cover['solo = all of earned'] += f['solo_max'] == f['earned']
            cover['solo: catch-up added'] += ws['step18'] > 0
            cover['SIMPLE: deferral limited by compensation'] += sm['regular'] + sm['catch'] == sm['comp']
            cover['SIMPLE: 402(g) room below the plan limit'] += R.LIMIT_402G[year] - row['job_deferrals'] < R.SIMPLE_DEFERRAL_SMALL[year]
            cover['SIMPLE: catch-up added'] += sm['catch'] > 0
            cover['SIMPLE: match below 3% (deferral smaller)'] += sm['match'] < sm['comp'] * R.SIMPLE_MATCH_RATE
            cover['wages at/over the SS base'] += row['owner_wages'] >= R.SS_WAGE_BASE[year]
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
